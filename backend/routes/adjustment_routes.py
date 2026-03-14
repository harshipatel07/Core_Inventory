"""
adjustment_routes.py — Stock adjustments (physical count vs recorded).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import Adjustment, Product, StockLevel, Warehouse, StockLedger
from backend.schemas import AdjustmentCreate, AdjustmentResponse
from backend.auth import get_current_user
from backend.audit import log_action

router = APIRouter(prefix="/api/adjustments", tags=["Adjustments"])


@router.get("", response_model=List[AdjustmentResponse])
def list_adjustments(
    product_id: str = "", warehouse_id: str = "",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(Adjustment)
    if product_id:
        query = query.filter(Adjustment.product_id == product_id)
    if warehouse_id:
        query = query.filter(Adjustment.warehouse_id == warehouse_id)
    adjs = query.order_by(Adjustment.created_at.desc()).all()

    result = []
    for a in adjs:
        prod = db.query(Product).filter(Product.id == a.product_id).first()
        wh = db.query(Warehouse).filter(Warehouse.id == a.warehouse_id).first()
        result.append(AdjustmentResponse(
            id=a.id, ref_number=a.ref_number,
            product_id=a.product_id,
            product_name=prod.name if prod else "Unknown",
            warehouse_id=a.warehouse_id,
            warehouse_name=wh.name if wh else "Unknown",
            qty_system=a.qty_system, qty_counted=a.qty_counted,
            difference=a.qty_counted - a.qty_system,
            reason=a.reason, date_val=a.date_val,
            created_at=a.created_at
        ))
    return result


@router.post("", response_model=AdjustmentResponse, status_code=201)
def create_adjustment(
    req: AdjustmentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    prod = db.query(Product).filter(Product.id == req.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    wh = db.query(Warehouse).filter(Warehouse.id == req.warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    sl = db.query(StockLevel).filter(
        StockLevel.product_id == req.product_id,
        StockLevel.warehouse_id == req.warehouse_id
    ).first()

    qty_system = sl.qty_on_hand if sl else 0
    difference = req.qty_counted - qty_system

    count = db.query(Adjustment).count()
    ref = f"ADJ-{str(count + 1).zfill(4)}"

    adj = Adjustment(
        ref_number=ref,
        product_id=req.product_id,
        warehouse_id=req.warehouse_id,
        created_by=current_user["sub"],
        qty_system=qty_system,
        qty_counted=req.qty_counted,
        reason=req.reason,
    )
    db.add(adj)

    if sl:
        sl.qty_on_hand = req.qty_counted
    else:
        sl = StockLevel(
            product_id=req.product_id,
            warehouse_id=req.warehouse_id,
            qty_on_hand=req.qty_counted
        )
        db.add(sl)

    db.flush()

    db.add(StockLedger(
        product_id=req.product_id,
        warehouse_id=req.warehouse_id,
        operation_type="adjustment",
        ref_id=adj.id,
        ref_number=ref,
        qty_change=difference,
        qty_after=req.qty_counted,
        created_by=current_user["sub"]
    ))

    db.commit()
    db.refresh(adj)

    sign = f"+{difference}" if difference > 0 else str(difference)
    log_action(db, "adjustment", "create",
        f"Stock adjustment {ref}: '{prod.name}' in {wh.name} — "
        f"system {qty_system} → counted {req.qty_counted} (diff {sign})"
        + (f" | reason: {req.reason}" if req.reason else ""),
        ref_number=ref,
        performed_by=current_user.get("email"))

    return AdjustmentResponse(
        id=adj.id, ref_number=adj.ref_number,
        product_id=adj.product_id,
        product_name=prod.name,
        warehouse_id=adj.warehouse_id,
        warehouse_name=wh.name,
        qty_system=qty_system, qty_counted=req.qty_counted,
        difference=difference, reason=adj.reason,
        date_val=adj.date_val, created_at=adj.created_at
    )