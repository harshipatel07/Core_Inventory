"""
dashboard_routes.py — Dashboard KPIs.
Fixed: low_stock = stock > 0 AND <= threshold (NOT out of stock).
out_of_stock = stock == 0. These are separate counts.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date
from typing import List

from backend.database import get_db
from backend.models import Product, StockLevel, Receipt, DeliveryOrder, Transfer, StockLedger, Warehouse
from backend.schemas import LedgerResponse

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/kpis")
def get_kpis(db: Session = Depends(get_db)):
    today = date.today()

    total_products = db.query(Product).filter(Product.is_active == True).count()

    products = db.query(Product).filter(Product.is_active == True).all()
    # FIX: low_stock = stock > 0 AND <= threshold (NOT zero)
    # out_of_stock = stock == 0 (completely different)
    low_stock = 0
    out_of_stock = 0
    reorder_alerts = []
    for p in products:
        total = sum(s.qty_on_hand for s in p.stock_levels)
        if total == 0:
            out_of_stock += 1
            reorder_alerts.append({"product_id": p.id, "name": p.name, "sku": p.sku,
                                    "stock": total, "threshold": p.low_stock_threshold, "status": "out"})
        elif p.low_stock_threshold > 0 and total <= p.low_stock_threshold:
            low_stock += 1
            reorder_alerts.append({"product_id": p.id, "name": p.name, "sku": p.sku,
                                    "stock": total, "threshold": p.low_stock_threshold, "status": "low"})

    # Receipt cards
    all_receipts = db.query(Receipt).filter(Receipt.status.in_(["draft", "ready"])).all()
    receipt_total = len(all_receipts)
    receipt_late = sum(1 for r in all_receipts if r.date_val and r.date_val < today)
    receipt_operations = db.query(Receipt).filter(Receipt.status == "ready").count()

    # Delivery cards
    all_deliveries = db.query(DeliveryOrder).filter(DeliveryOrder.status.in_(["draft", "waiting", "ready"])).all()
    delivery_total = len(all_deliveries)
    delivery_late = sum(1 for d in all_deliveries if d.date_val and d.date_val < today)
    delivery_waiting = sum(1 for d in all_deliveries if d.status == "waiting")
    delivery_operations = db.query(DeliveryOrder).filter(DeliveryOrder.status == "ready").count()

    pending_transfers = db.query(Transfer).filter(Transfer.status.in_(["draft"])).count()

    return {
        "total_products": total_products,
        "low_stock_count": low_stock,         # stock > 0 but <= threshold
        "out_of_stock_count": out_of_stock,   # stock == 0
        "reorder_alerts": reorder_alerts,     # list for sidebar badge
        "pending_receipts": receipt_total,
        "receipt_late": receipt_late,
        "receipt_operations": receipt_operations,
        "pending_deliveries": delivery_total,
        "delivery_late": delivery_late,
        "delivery_waiting": delivery_waiting,
        "delivery_operations": delivery_operations,
        "pending_transfers": pending_transfers,
    }


@router.get("/recent-activity", response_model=List[LedgerResponse])
def recent_activity(limit: int = 20, db: Session = Depends(get_db)):
    entries = db.query(StockLedger).order_by(StockLedger.created_at.desc()).limit(limit).all()
    result = []
    for e in entries:
        prod = db.query(Product).filter(Product.id == e.product_id).first()
        wh = db.query(Warehouse).filter(Warehouse.id == e.warehouse_id).first()
        result.append(LedgerResponse(
            id=e.id, product_id=e.product_id,
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


@router.get("/stock-overview")
def stock_overview(db: Session = Depends(get_db)):
    warehouses = db.query(Warehouse).filter(Warehouse.is_active == True).all()
    result = []
    for wh in warehouses:
        levels = db.query(StockLevel).filter(StockLevel.warehouse_id == wh.id).all()
        total = sum(s.qty_on_hand for s in levels)
        result.append({
            "warehouse_id": wh.id,
            "warehouse_name": wh.name,
            "warehouse_code": wh.code,
            "total_stock": total,
            "product_count": len(levels),
        })
    return result