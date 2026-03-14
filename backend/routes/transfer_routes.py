"""
transfer_routes.py — Internal stock transfers between warehouses.
"""

import random
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import Transfer, TransferLine, Product, StockLevel, Warehouse, StockLedger
from backend.schemas import TransferCreate, TransferResponse, TransferLineResponse

router = APIRouter(prefix="/api/transfers", tags=["Transfers"])


def _build_transfer_response(t, db):
    from_wh = db.query(Warehouse).filter(Warehouse.id == t.from_warehouse_id).first()
    to_wh = db.query(Warehouse).filter(Warehouse.id == t.to_warehouse_id).first()
    items = []
    for line in t.lines:
        prod = db.query(Product).filter(Product.id == line.product_id).first()
        items.append(TransferLineResponse(
            id=line.id, product_id=line.product_id,
            product_name=prod.name if prod else "Unknown",
            qty=line.qty
        ))
    return TransferResponse(
        id=t.id, ref_number=t.ref_number,
        from_warehouse_id=t.from_warehouse_id,
        from_warehouse_name=from_wh.name if from_wh else "Unknown",
        to_warehouse_id=t.to_warehouse_id,
        to_warehouse_name=to_wh.name if to_wh else "Unknown",
        status=t.status, scheduled_date=t.scheduled_date,
        notes=t.notes, created_at=t.created_at,
        items=items
    )


@router.get("", response_model=List[TransferResponse])
def list_transfers(status: str = "", db: Session = Depends(get_db)):
    query = db.query(Transfer)
    if status:
        query = query.filter(Transfer.status == status)
    transfers = query.order_by(Transfer.created_at.desc()).all()
    return [_build_transfer_response(t, db) for t in transfers]


@router.get("/{transfer_id}", response_model=TransferResponse)
def get_transfer(transfer_id: str, db: Session = Depends(get_db)):
    t = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    return _build_transfer_response(t, db)


@router.post("", response_model=TransferResponse, status_code=201)
def create_transfer(req: TransferCreate, db: Session = Depends(get_db)):
    if req.from_warehouse_id == req.to_warehouse_id:
        raise HTTPException(status_code=400, detail="Source and destination must be different")

    ref = f"TRF-{random.randint(1000, 9999)}"
    transfer = Transfer(
        ref_number=ref,
        from_warehouse_id=req.from_warehouse_id,
        to_warehouse_id=req.to_warehouse_id,
        scheduled_date=req.scheduled_date,
        notes=req.notes,
        status="draft"
    )
    for item in req.items:
        transfer.lines.append(TransferLine(
            product_id=item.product_id,
            qty=item.qty,
        ))
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return _build_transfer_response(transfer, db)


@router.put("/{transfer_id}/status")
def update_transfer_status(transfer_id: str, new_status: str, db: Session = Depends(get_db)):
    """When validated (done): subtract from source, add to destination."""
    t = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")

    valid = {"draft", "waiting", "ready", "done", "canceled"}
    if new_status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status. Use: {valid}")

    old_status = t.status

    if new_status == "done" and old_status != "done":
        for line in t.lines:
            # Subtract from source
            sl_from = db.query(StockLevel).filter(
                StockLevel.product_id == line.product_id,
                StockLevel.warehouse_id == t.from_warehouse_id
            ).first()

            if not sl_from or sl_from.qty_on_hand < line.qty:
                prod = db.query(Product).filter(Product.id == line.product_id).first()
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for {prod.name if prod else line.product_id} in source warehouse"
                )
            sl_from.qty_on_hand -= line.qty

            # Add to destination
            sl_to = db.query(StockLevel).filter(
                StockLevel.product_id == line.product_id,
                StockLevel.warehouse_id == t.to_warehouse_id
            ).first()
            if sl_to:
                sl_to.qty_on_hand += line.qty
            else:
                sl_to = StockLevel(
                    product_id=line.product_id,
                    warehouse_id=t.to_warehouse_id,
                    qty_on_hand=line.qty
                )
                db.add(sl_to)
                db.flush()

            # Ledger: source (outgoing)
            db.add(StockLedger(
                product_id=line.product_id,
                warehouse_id=t.from_warehouse_id,
                operation_type="transfer",
                ref_id=t.id, ref_number=t.ref_number,
                qty_change=-line.qty,
                qty_after=sl_from.qty_on_hand,
            ))
            # Ledger: destination (incoming)
            db.add(StockLedger(
                product_id=line.product_id,
                warehouse_id=t.to_warehouse_id,
                operation_type="transfer",
                ref_id=t.id, ref_number=t.ref_number,
                qty_change=line.qty,
                qty_after=sl_to.qty_on_hand,
            ))

    t.status = new_status
    db.commit()
    return {"message": f"Transfer status updated to '{new_status}'"}


@router.delete("/{transfer_id}")
def delete_transfer(transfer_id: str, db: Session = Depends(get_db)):
    t = db.query(Transfer).filter(Transfer.id == transfer_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Transfer not found")
    if t.status == "done":
        raise HTTPException(status_code=400, detail="Cannot delete a completed transfer")
    db.delete(t)
    db.commit()
    return {"message": "Transfer deleted"}
