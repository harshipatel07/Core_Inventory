"""
backend/audit.py — Central helper to write audit log entries.
Import and call log_action() from any route after a successful DB operation.
"""

from backend.models import AuditLog
from sqlalchemy.orm import Session


def log_action(
    db: Session,
    module: str,
    action: str,
    description: str,
    ref_number: str = None,
    performed_by: str = None,
):
    """
    Write a single audit log row.

    Args:
        db:           Active SQLAlchemy session (will commit).
        module:       Module name: 'product', 'warehouse', 'delivery',
                      'transfer', 'receipt', 'adjustment'.
        action:       Action verb: 'create', 'update', 'delete',
                      'validate', 'cancel'.
        description:  Human-readable summary, e.g. "Transfer TRF-001 cancelled".
        ref_number:   Optional document reference for filtering/linking.
        performed_by: Username or email of the actor (from auth token).
    """
    entry = AuditLog(
        module=module,
        action=action,
        ref_number=ref_number,
        description=description,
        performed_by=performed_by,
    )
    db.add(entry)
    db.commit()