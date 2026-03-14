"""
transfer_routes.py — Internal stock transfers between warehouses/locations.
Flow spec:
  - Ref format: TRF-<auto_id>
  - Status: draft → done, or cancelled
  - On done: decrease stock from source, increase stock at destination, log ledger
  - Cancel allowed only on draft transfers (not done)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import Transfer, TransferLine, Product, StockLevel, Warehouse, StockLedger
from backend.schemas import TransferCreate, TransferResponse, TransferLineResponse
from backend.auth import get_current_user
from backend.audit import log_action

router = APIRouter(prefix="/api/transfers", tags=["Transfers"])


def _next_transfer_ref(db: Session) -> str:
    count = db.query(Transfer).count() + 1
    return f"TRF-{str(count).zfill(3)}"


def _build_transfer_response(t, db) -> "TransferResponse":
    from_wh = db.query(Warehouse).filter(Warehouse.id == t.from_warehouse_id).first()
    to_wh = db.query(Warehouse).filter(Warehouse.id == t.to_warehouse_id).first()
    items = []
    for line in t.lines:
        prod = db.query(Product).filter(Product.id == line.product_id).first()
        items.append(TransferLineResponse(
            id=line.id,
            product_id=line.product_id,
            product_name=prod.name if prod else "Unknown",
            product_sku=prod.sku if prod else "",
            qty=line.qty,
        ))
    return TransferResponse(
        id=t.id,
        ref_number=t.ref_number,
        from_warehouse_id=t.from_warehouse_id,
        from_warehouse_name=from_wh.name if from_wh else "Unknown",
        to_warehouse_id=t.to_warehouse_id,
        to_warehouse_name=to_wh.name if to_wh else "Unknown",
        status=t.status,
        scheduled_date=t.scheduled_date,
        notes=t.notes,
        created_at=t.created_at,
        items=items,
    )


@router.get("", response_model=List[TransferResponse])
def list_transfers(
    status: str = "",
    search: str = "",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = db.query(Transfer)
    if status:
        query = query.filter(Transfer.status == status)
    if search:
        query = query.filter(Transfer.ref_number.ilike(f"%{search}%"))
    return [
        _build_transfer_response(t, db)
        for t in query.order_by(Transfer.created_at.desc()).all()
    ]


@router.get("/{transfer_id}", response_model=TransferResponse)
def get_transfer(
    transfer_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return _build_transfer_response(t, db)


@router.post("", response_model=TransferResponse, status_code=201)
def create_transfer(
    req: TransferCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from_wh = db.query(Warehouse).filter(Warehouse.id == req.from_warehouse_id).first()
    to_wh = db.query(Warehouse).filter(Warehouse.id == req.to_warehouse_id).first()
    if not from_wh:
        raise HTTPException(status_code=404, detail="Source warehouse not found")
    if not to_wh:
        raise HTTPException(status_code=404, detail="Destination warehouse not found")
    if req.from_warehouse_id == req.to_warehouse_id:
        raise HTTPException(status_code=400, detail="Source and destination must differ")

    ref = _next_transfer_ref(db)
    transfer = Transfer(
        ref_number=ref,
        from_warehouse_id=req.from_warehouse_id,
        to_warehouse_id=req.to_warehouse_id,
        notes=req.notes,
        scheduled_date=req.scheduled_date,
        status="draft",
    )
    for item in req.items:
        transfer.lines.append(TransferLine(product_id=item.product_id, qty=item.qty))

    db.add(transfer)
    db.commit()
    db.refresh(transfer)

    log_action(db, "transfer", "create",
        f"Transfer {ref} created from '{from_wh.name}' to '{to_wh.name}'",
        ref_number=ref,
        performed_by=current_user.get("email"))

    return _build_transfer_response(transfer, db)


@router.put("/{transfer_id}/validate")
def validate_transfer(
    transfer_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if t.status != "draft":
        raise HTTPException(
            status_code=400,
            detail=f"Only draft transfers can be validated. Current status: '{t.status}'"
        )

    for line in t.lines:
        sl = db.query(StockLevel).filter(
            StockLevel.product_id == line.product_id,
            StockLevel.warehouse_id == t.from_warehouse_id,
        ).first()
        available = sl.qty_on_hand if sl else 0
        if available < line.qty:
            prod = db.query(Product).filter(Product.id == line.product_id).first()
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for '{prod.name if prod else line.product_id}': "
                       f"need {line.qty}, have {available}"
            )

    for line in t.lines:
        src = db.query(StockLevel).filter(
            StockLevel.product_id == line.product_id,
            StockLevel.warehouse_id == t.from_warehouse_id,
        ).first()
        src.qty_on_hand -= line.qty
        db.add(StockLedger(
            product_id=line.product_id,
            warehouse_id=t.from_warehouse_id,
            operation_type="transfer_out",
            ref_id=t.id,
            ref_number=t.ref_number,
            qty_change=-line.qty,
            qty_after=src.qty_on_hand,
        ))

        dst = db.query(StockLevel).filter(
            StockLevel.product_id == line.product_id,
            StockLevel.warehouse_id == t.to_warehouse_id,
        ).first()
        if not dst:
            dst = StockLevel(
                product_id=line.product_id,
                warehouse_id=t.to_warehouse_id,
                qty_on_hand=0,
            )
            db.add(dst)
            db.flush()
        dst.qty_on_hand += line.qty
        db.add(StockLedger(
            product_id=line.product_id,
            warehouse_id=t.to_warehouse_id,
            operation_type="transfer_in",
            ref_id=t.id,
            ref_number=t.ref_number,
            qty_change=line.qty,
            qty_after=dst.qty_on_hand,
        ))

    t.status = "done"
    db.commit()

    log_action(db, "transfer", "validate",
        f"Transfer {t.ref_number} validated — stock moved successfully",
        ref_number=t.ref_number,
        performed_by=current_user.get("email"))

    return {"message": f"Transfer '{t.ref_number}' validated and stock updated."}


@router.put("/{transfer_id}/cancel")
def cancel_transfer(
    transfer_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")

    if t.status == "cancelled":
        raise HTTPException(status_code=400, detail="Transfer is already cancelled.")

    if t.status == "done":
        raise HTTPException(
            status_code=400,
            detail=(
                f"Transfer '{t.ref_number}' is already done and cannot be cancelled. "
                "Stock has already been moved. Create a reverse transfer if needed."
            ),
        )

    t.status = "cancelled"
    db.commit()

    log_action(db, "transfer", "cancel",
        f"Transfer {t.ref_number} cancelled",
        ref_number=t.ref_number,
        performed_by=current_user.get("email"))

    return {
        "message": f"Transfer '{t.ref_number}' has been cancelled.",
        "ref_number": t.ref_number,
        "status": "cancelled",
    }


@router.delete("/{transfer_id}")
def delete_transfer(
    transfer_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if t.status == "done":
        raise HTTPException(status_code=400, detail="Cannot delete a completed transfer")
    db.delete(t)
    db.commit()

    log_action(db, "transfer", "delete",
        f"Transfer {t.ref_number} deleted",
        ref_number=t.ref_number,
        performed_by=current_user.get("email"))

    return {"message": "Transfer deleted"}