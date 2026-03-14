"""
receipt_routes.py — Incoming goods (Receipts).
Flow spec:
  - Ref format: WH/<warehouse_code>/IN/<auto_id>
  - Status: draft → ready → done (validate), or cancel
  - On done: increase stock, log ledger
  - Print endpoint for done receipts
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import Receipt, ReceiptLine, Product, StockLevel, Warehouse, StockLedger
from backend.schemas import ReceiptCreate, ReceiptResponse, ReceiptLineResponse
from backend.audit import log_action

router = APIRouter(prefix="/api/receipts", tags=["Receipts"])


def _next_receipt_ref(warehouse_code: str, db: Session) -> str:
    code = (warehouse_code or "WH").upper()
    count = db.query(Receipt).count() + 1
    return f"{code}/IN/{str(count).zfill(3)}"


def _build_receipt_response(r, db):
    wh = db.query(Warehouse).filter(Warehouse.id == r.warehouse_id).first()
    items = []
    for line in r.lines:
        prod = db.query(Product).filter(Product.id == line.product_id).first()
        items.append(ReceiptLineResponse(
            id=line.id, product_id=line.product_id,
            product_name=prod.name if prod else "Unknown",
            product_sku=prod.sku if prod else "",
            qty_expected=line.qty_expected,
            qty_received=line.qty_received,
        ))
    return ReceiptResponse(
        id=r.id, ref_number=r.ref_number,
        supplier_name=r.supplier_name,
        warehouse_id=r.warehouse_id,
        warehouse_name=wh.name if wh else "Unknown",
        warehouse_code=wh.code if wh else "",
        status=r.status,
        date_val=r.date_val,
        notes=r.notes,
        created_at=r.created_at,
        items=items
    )


@router.get("", response_model=List[ReceiptResponse])
def list_receipts(status: str = "", search: str = "", db: Session = Depends(get_db)):
    query = db.query(Receipt)
    if status:
        query = query.filter(Receipt.status == status)
    if search:
        query = query.filter(
            Receipt.ref_number.ilike(f"%{search}%") |
            Receipt.supplier_name.ilike(f"%{search}%")
        )
    return [_build_receipt_response(r, db) for r in query.order_by(Receipt.created_at.desc()).all()]


@router.get("/{receipt_id}", response_model=ReceiptResponse)
def get_receipt(receipt_id: str, db: Session = Depends(get_db)):
    r = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return _build_receipt_response(r, db)


@router.post("", response_model=ReceiptResponse, status_code=201)
def create_receipt(req: ReceiptCreate, db: Session = Depends(get_db)):
    wh = db.query(Warehouse).filter(Warehouse.id == req.warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    ref = _next_receipt_ref(wh.code, db)
    receipt = Receipt(
        ref_number=ref,
        supplier_name=req.supplier_name,
        warehouse_id=req.warehouse_id,
        notes=req.notes,
        status="draft"
    )
    for item in req.items:
        receipt.lines.append(ReceiptLine(
            product_id=item.product_id,
            qty_expected=item.qty_expected,
            qty_received=0,
        ))
    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    log_action(db, "receipt", "create",
        f"Receipt {ref} created from supplier '{req.supplier_name}' at {wh.name}",
        ref_number=ref)

    return _build_receipt_response(receipt, db)


@router.put("/{receipt_id}/status")
def update_receipt_status(receipt_id: str, new_status: str, db: Session = Depends(get_db)):
    r = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Receipt not found")

    valid = {"draft", "ready", "done", "canceled"}
    if new_status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Use: {valid}")

    transitions = {
        "draft": ["ready", "canceled"],
        "ready": ["done", "canceled"],
        "done": [],
        "canceled": [],
    }
    allowed = transitions.get(r.status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move from '{r.status}' to '{new_status}'. Allowed: {allowed}"
        )

    # On done → increase stock
    if new_status == "done":
        for line in r.lines:
            line.qty_received = line.qty_expected
            sl = db.query(StockLevel).filter(
                StockLevel.product_id == line.product_id,
                StockLevel.warehouse_id == r.warehouse_id
            ).first()
            if sl:
                sl.qty_on_hand += line.qty_expected
            else:
                sl = StockLevel(
                    product_id=line.product_id,
                    warehouse_id=r.warehouse_id,
                    qty_on_hand=line.qty_expected
                )
                db.add(sl)
                db.flush()
            db.add(StockLedger(
                product_id=line.product_id,
                warehouse_id=r.warehouse_id,
                operation_type="receipt",
                ref_id=r.id,
                ref_number=r.ref_number,
                qty_change=line.qty_expected,
                qty_after=sl.qty_on_hand,
            ))

    r.status = new_status
    db.commit()

    # Audit log per status change
    action_map = {"ready": "update", "done": "validate", "canceled": "cancel"}
    desc_map = {
        "ready":    f"Receipt {r.ref_number} marked as ready",
        "done":     f"Receipt {r.ref_number} validated — stock increased",
        "canceled": f"Receipt {r.ref_number} cancelled",
    }
    log_action(db, "receipt", action_map.get(new_status, "update"),
        desc_map.get(new_status, f"Receipt {r.ref_number} status changed to {new_status}"),
        ref_number=r.ref_number)

    return {"message": f"Receipt status updated to '{new_status}'", "ref_number": r.ref_number}


@router.get("/{receipt_id}/print", response_class=HTMLResponse)
def print_receipt(receipt_id: str, db: Session = Depends(get_db)):
    r = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Receipt not found")

    wh = db.query(Warehouse).filter(Warehouse.id == r.warehouse_id).first()
    lines_html = ""
    for line in r.lines:
        prod = db.query(Product).filter(Product.id == line.product_id).first()
        lines_html += f"""
        <tr>
            <td>[{prod.sku if prod else ''}] {prod.name if prod else 'Unknown'}</td>
            <td style="text-align:center">{line.qty_expected}</td>
            <td style="text-align:center">{line.qty_received}</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Receipt {r.ref_number}</title>
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; color: #333; }}
        h1 {{ color: #6C5CE7; border-bottom: 2px solid #6C5CE7; padding-bottom: 8px; }}
        .meta {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; background: #f8f8f8; padding: 16px; border-radius: 8px; }}
        .meta div {{ font-size: 14px; }} .meta strong {{ display: block; color: #666; font-size: 11px; text-transform: uppercase; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
        th {{ background: #6C5CE7; color: white; padding: 10px; text-align: left; }}
        td {{ padding: 9px 10px; border-bottom: 1px solid #eee; }}
        .status {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;
                   background: {'#00B89420' if r.status=='done' else '#FDCB6E20'}; color: {'#00B894' if r.status=='done' else '#FDCB6E'}; }}
        .footer {{ margin-top: 40px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 16px; }}
        @media print {{ button {{ display: none; }} }}
    </style>
</head>
<body>
    <h1>📦 Core Inventory — Receipt</h1>
    <div class="meta">
        <div><strong>Reference</strong>{r.ref_number}</div>
        <div><strong>Status</strong><span class="status">{r.status.upper()}</span></div>
        <div><strong>Receive From (Supplier)</strong>{r.supplier_name or '—'}</div>
        <div><strong>Warehouse</strong>{wh.name if wh else '—'}</div>
        <div><strong>Schedule Date</strong>{r.date_val}</div>
        <div><strong>Notes</strong>{r.notes or '—'}</div>
    </div>
    <table>
        <thead><tr><th>Product</th><th style="text-align:center">Expected Qty</th><th style="text-align:center">Received Qty</th></tr></thead>
        <tbody>{lines_html}</tbody>
    </table>
    <div class="footer">
        <p>Core Inventory Management System &mdash; Generated {r.created_at}</p>
    </div>
    <br>
    <button onclick="window.print()" style="background:#6C5CE7;color:white;border:none;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:14px;">🖨 Print</button>
</body>
</html>"""
    return HTMLResponse(content=html)


@router.delete("/{receipt_id}")
def delete_receipt(receipt_id: str, db: Session = Depends(get_db)):
    r = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if r.status == "done":
        raise HTTPException(status_code=400, detail="Cannot delete a completed receipt")
    db.delete(r)
    db.commit()

    log_action(db, "receipt", "delete",
        f"Receipt {r.ref_number} deleted",
        ref_number=r.ref_number)

    return {"message": "Receipt deleted"}