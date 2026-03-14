"""
audit_routes.py — Audit Log for all system actions.

Tracks who did what and when across every module:
  - Products (create, update, deactivate)
  - Warehouses (create, update, delete)
  - Receipts (create, validate, cancel)
  - Deliveries (create, validate, cancel, delete)
  - Transfers (create, validate, cancel)
  - Adjustments (apply)

AuditLog model fields:
  id, action, module, ref_number, description, performed_by, created_at
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from backend.database import get_db
from backend.models import AuditLog
from backend.schemas import AuditLogResponse

router = APIRouter(prefix="/api/audit", tags=["Audit Log"])


@router.get("", response_model=List[AuditLogResponse])
def list_audit_logs(
    module: Optional[str] = Query(default=""),
    action: Optional[str] = Query(default=""),
    search: Optional[str] = Query(default=""),
    limit: int = Query(default=200, le=500),
    db: Session = Depends(get_db),
):
    """
    Return audit log entries, newest first.
    Filter by module (product, warehouse, delivery, transfer, receipt, adjustment)
    or action (create, update, delete, validate, cancel).
    """
    query = db.query(AuditLog)

    if module:
        query = query.filter(AuditLog.module.ilike(f"%{module}%"))
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if search:
        query = query.filter(
            AuditLog.ref_number.ilike(f"%{search}%") |
            AuditLog.description.ilike(f"%{search}%") |
            AuditLog.performed_by.ilike(f"%{search}%")
        )

    logs = query.order_by(AuditLog.created_at.desc()).limit(limit).all()
    return logs