"""
delivery_routes.py — Outgoing goods (Delivery Orders).
Flow spec:
  - Ref format: WH/<warehouse_code>/OUT/<auto_id>
  - Status: draft → waiting → ready → done, or cancel
  - On done: decrease stock, log ledger
  - Waiting = product out of stock
  - Red alert if product not in stock
  - Print endpoint for done deliveries
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import DeliveryOrder, DeliveryLine, Product, StockLevel, Warehouse, StockLedger
from backend.schemas import DeliveryCreate, DeliveryResponse, DeliveryLineResponse

router = APIRouter(prefix="/api/deliveries", tags=["Deliveries"])


def _next_delivery_ref(warehouse_code: str, db: Session) -> str:
    """Generate WH/<code>/OUT/<id> format reference per flow spec."""
    code = (warehouse_code or "WH").upper()
    count = db.query(DeliveryOrder).count() + 1
    return f"{code}/OUT/{str(count).zfill(4)}"


def _check_stock_availability(lines, warehouse_id, db):
    """Returns list of out-of-stock product names."""
    out_of_stock = []
    for line in lines:
        sl = db.query(StockLevel).filter(
            StockLevel.product_id == line.product_id,
            StockLevel.warehouse_id == warehouse_id
        ).first()
        available = sl.qty_on_hand if sl else 0
        if available < line.qty:
            prod = db.query(Product).filter(Product.id == line.product_id).first()
            out_of_stock.append(prod.name if prod else line.product_id)
    return out_of_stock


def _build_delivery_response(d, db):
    wh = db.query(Warehouse).filter(Warehouse.id == d.warehouse_id).first()
    items = []
    for line in d.lines:
        prod = db.query(Product).filter(Product.id == line.product_id).first()
        sl = db.query(StockLevel).filter(
            StockLevel.product_id == line.product_id,
            StockLevel.warehouse_id == d.warehouse_id
        ).first()
        available = sl.qty_on_hand if sl else 0
        items.append(DeliveryLineResponse(
            id=line.id,
            product_id=line.product_id,
            product_name=prod.name if prod else "Unknown",
            product_sku=prod.sku if prod else "",
            qty=line.qty,
            qty_available=available,
            out_of_stock=(available < line.qty),
        ))
    return DeliveryResponse(
        id=d.id, ref_number=d.ref_number,
        customer_name=d.customer_name,
        warehouse_id=d.warehouse_id,
        warehouse_name=wh.name if wh else "Unknown",
        warehouse_code=wh.code if wh else "",
        status=d.status,
        date_val=d.date_val,
        notes=d.notes,
        created_at=d.created_at,
        items=items
    )


@router.get("", response_model=List[DeliveryResponse])
def list_deliveries(status: str = "", search: str = "", db: Session = Depends(get_db)):
    query = db.query(DeliveryOrder)
    if status:
        query = query.filter(DeliveryOrder.status == status)
    if search:
        query = query.filter(
            DeliveryOrder.ref_number.ilike(f"%{search}%") |
            DeliveryOrder.customer_name.ilike(f"%{search}%")
        )
    return [_build_delivery_response(d, db) for d in query.order_by(DeliveryOrder.created_at.desc()).all()]


@router.get("/{delivery_id}", response_model=DeliveryResponse)
def get_delivery(delivery_id: str, db: Session = Depends(get_db)):
    d = db.query(DeliveryOrder).filter(DeliveryOrder.id == delivery_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return _build_delivery_response(d, db)


@router.post("", response_model=DeliveryResponse, status_code=201)
def create_delivery(req: DeliveryCreate, db: Session = Depends(get_db)):
    wh = db.query(Warehouse).filter(Warehouse.id == req.warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    ref = _next_delivery_ref(wh.code, db)

    # Flow spec: auto-set to waiting if any product is out of stock
    temp_lines = req.items
    out_of_stock = []
    for item in temp_lines:
        sl = db.query(StockLevel).filter(
            StockLevel.product_id == item.product_id,
            StockLevel.warehouse_id == req.warehouse_id
        ).first()
        available = sl.qty_on_hand if sl else 0
        if available < item.qty:
            prod = db.query(Product).filter(Product.id == item.product_id).first()
            out_of_stock.append(prod.name if prod else item.product_id)

    initial_status = "waiting" if out_of_stock else "draft"

    delivery = DeliveryOrder(
        ref_number=ref,
        customer_name=req.customer_name,
        warehouse_id=req.warehouse_id,
        notes=req.notes,
        status=initial_status
    )
    for item in req.items:
        delivery.lines.append(DeliveryLine(product_id=item.product_id, qty=item.qty))
    db.add(delivery)
    db.commit()
    db.refresh(delivery)

    resp = _build_delivery_response(delivery, db)
    if out_of_stock:
        resp.notes = (resp.notes or "") + f" [WAITING: Out of stock — {', '.join(out_of_stock)}]"
    return resp


@router.put("/{delivery_id}/status")
def update_delivery_status(delivery_id: str, new_status: str, db: Session = Depends(get_db)):
    """
    Flow spec status transitions:
      draft → waiting (if stock unavailable) or ready
      waiting → ready (once stock is available)
      ready → done (Validate) → decreases stock
      any → canceled
    """
    d = db.query(DeliveryOrder).filter(DeliveryOrder.id == delivery_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Delivery not found")

    valid = {"draft", "waiting", "ready", "done", "canceled"}
    if new_status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Use: {valid}")

    transitions = {
        "draft": ["waiting", "ready", "canceled"],
        "waiting": ["ready", "canceled"],
        "ready": ["done", "canceled"],
        "done": [],
        "canceled": [],
    }
    allowed = transitions.get(d.status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot move from '{d.status}' to '{new_status}'. Allowed: {allowed}"
        )

    # On moving to ready: check stock is available
    if new_status == "ready":
        out_of_stock = _check_stock_availability(d.lines, d.warehouse_id, db)
        if out_of_stock:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot set to Ready. Products out of stock: {', '.join(out_of_stock)}"
            )

    # On done: decrease stock
    if new_status == "done":
        out_of_stock = _check_stock_availability(d.lines, d.warehouse_id, db)
        if out_of_stock:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for: {', '.join(out_of_stock)}"
            )
        for line in d.lines:
            sl = db.query(StockLevel).filter(
                StockLevel.product_id == line.product_id,
                StockLevel.warehouse_id == d.warehouse_id
            ).first()
            sl.qty_on_hand -= line.qty
            db.add(StockLedger(
                product_id=line.product_id,
                warehouse_id=d.warehouse_id,
                operation_type="delivery",
                ref_id=d.id,
                ref_number=d.ref_number,
                qty_change=-line.qty,
                qty_after=sl.qty_on_hand,
            ))

    d.status = new_status
    db.commit()
    return {"message": f"Delivery status updated to '{new_status}'", "ref_number": d.ref_number}


@router.get("/{delivery_id}/print", response_class=HTMLResponse)
def print_delivery(delivery_id: str, db: Session = Depends(get_db)):
    """Flow spec: Print the delivery once it's DONE."""
    d = db.query(DeliveryOrder).filter(DeliveryOrder.id == delivery_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Delivery not found")

    wh = db.query(Warehouse).filter(Warehouse.id == d.warehouse_id).first()
    lines_html = ""
    for line in d.lines:
        prod = db.query(Product).filter(Product.id == line.product_id).first()
        lines_html += f"""
        <tr>
            <td>[{prod.sku if prod else ''}] {prod.name if prod else 'Unknown'}</td>
            <td style="text-align:center">{line.qty}</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Delivery {d.ref_number}</title>
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; color: #333; }}
        h1 {{ color: #6C5CE7; border-bottom: 2px solid #6C5CE7; padding-bottom: 8px; }}
        .meta {{ display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; background: #f8f8f8; padding: 16px; border-radius: 8px; }}
        .meta div {{ font-size: 14px; }} .meta strong {{ display: block; color: #666; font-size: 11px; text-transform: uppercase; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
        th {{ background: #6C5CE7; color: white; padding: 10px; text-align: left; }}
        td {{ padding: 9px 10px; border-bottom: 1px solid #eee; }}
        .status {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;
                   background: {'#00B89420' if d.status=='done' else '#FDCB6E20'}; color: {'#00B894' if d.status=='done' else '#FDCB6E'}; }}
        .footer {{ margin-top: 40px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 16px; }}
        @media print {{ button {{ display: none; }} }}
    </style>
</head>
<body>
    <h1>🚚 Core Inventory — Delivery Order</h1>
    <div class="meta">
        <div><strong>Reference</strong>{d.ref_number}</div>
        <div><strong>Status</strong><span class="status">{d.status.upper()}</span></div>
        <div><strong>Delivery Address / Customer</strong>{d.customer_name or '—'}</div>
        <div><strong>From Warehouse</strong>{wh.name if wh else '—'}</div>
        <div><strong>Schedule Date</strong>{d.date_val}</div>
        <div><strong>Notes</strong>{d.notes or '—'}</div>
    </div>
    <table>
        <thead><tr><th>Product</th><th style="text-align:center">Quantity</th></tr></thead>
        <tbody>{lines_html}</tbody>
    </table>
    <div class="footer">
        <p>Core Inventory Management System &mdash; Generated {d.created_at}</p>
    </div>
    <br>
    <button onclick="window.print()" style="background:#6C5CE7;color:white;border:none;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:14px;">🖨 Print</button>
</body>
</html>"""
    return HTMLResponse(content=html)


@router.delete("/{delivery_id}")
def delete_delivery(delivery_id: str, db: Session = Depends(get_db)):
    d = db.query(DeliveryOrder).filter(DeliveryOrder.id == delivery_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if d.status == "done":
        raise HTTPException(status_code=400, detail="Cannot delete a completed delivery")
    db.delete(d)
    db.commit()
    return {"message": "Delivery deleted"}