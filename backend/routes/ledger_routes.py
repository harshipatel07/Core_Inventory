"""
ledger_routes.py — Stock movement history (Stock Ledger).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import StockLedger, Product, Warehouse
from backend.schemas import LedgerResponse
from backend.auth import get_current_user

router = APIRouter(prefix="/api/ledger", tags=["Stock Ledger"])


@router.get("", response_model=List[LedgerResponse])
def list_ledger(
    product_id: str = "",
    warehouse_id: str = "",
    operation_type: str = "",   # receipt | delivery | transfer | adjustment
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(StockLedger)
    if product_id:
        query = query.filter(StockLedger.product_id == product_id)
    if warehouse_id:
        query = query.filter(StockLedger.warehouse_id == warehouse_id)
    if operation_type:
        query = query.filter(StockLedger.operation_type == operation_type)

    entries = query.order_by(StockLedger.created_at.desc()).limit(limit).all()

    result = []
    for e in entries:
        prod = db.query(Product).filter(Product.id == e.product_id).first()
        wh = db.query(Warehouse).filter(Warehouse.id == e.warehouse_id).first()
        result.append(LedgerResponse(
            id=e.id,
            product_id=e.product_id,
            product_name=prod.name if prod else "Unknown",
            warehouse_id=e.warehouse_id,
            warehouse_name=wh.name if wh else "Unknown",
            operation_type=e.operation_type,
            ref_number=e.ref_number,
            qty_change=e.qty_change,
            qty_after=e.qty_after,
            created_at=e.created_at,
        ))
    return result