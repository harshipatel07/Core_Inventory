"""
ledger_routes.py — Stock movement history with contact & from/to locations.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import StockLedger, Product, Warehouse, Receipt, DeliveryOrder
from backend.schemas import LedgerResponse
from backend.auth import get_current_user

router = APIRouter(prefix="/api/ledger", tags=["Stock Ledger"])


@router.get("", response_model=List[LedgerResponse])
def list_ledger(
    product_id: str = "",
    warehouse_id: str = "",
    operation_type: str = "",
    search: str = "",
    limit: int = 200,
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
        wh   = db.query(Warehouse).filter(Warehouse.id == e.warehouse_id).first()

        wh_name  = wh.name if wh else "Unknown"
        wh_code  = (wh.code or "WH") if wh else "WH"
        prod_name = prod.name if prod else "Unknown"

        # Resolve contact + from/to + status from parent document
        contact       = ""
        from_location = ""
        to_location   = ""
        status        = ""

        if e.operation_type == "receipt":
            r = db.query(Receipt).filter(Receipt.id == e.ref_id).first()
            if r:
                contact       = r.supplier_name or "Vendor"
                from_location = "Vendors"
                to_location   = f"{wh_code}/Stock"
                status        = r.status
        elif e.operation_type == "delivery":
            d = db.query(DeliveryOrder).filter(DeliveryOrder.id == e.ref_id).first()
            if d:
                contact       = d.customer_name or "Customer"
                from_location = f"{wh_code}/Stock"
                to_location   = "Customer"
                status        = d.status
        elif e.operation_type == "transfer":
            from_location = wh_name
            to_location   = "Transfer"
        elif e.operation_type == "adjustment":
            from_location = wh_name
            to_location   = wh_name

        # search filter (client-side friendly but also server-side)
        if search:
            s = search.lower()
            if s not in e.ref_number.lower() and s not in contact.lower() and s not in prod_name.lower():
                continue

        result.append(LedgerResponse(
            id=e.id,
            product_id=e.product_id,
            product_name=prod_name,
            warehouse_id=e.warehouse_id,
            warehouse_name=wh_name,
            operation_type=e.operation_type,
            ref_number=e.ref_number,
            qty_change=e.qty_change,
            qty_after=e.qty_after,
            contact=contact,
            from_location=from_location,
            to_location=to_location,
            status=status,
            created_at=e.created_at,
        ))
    return result