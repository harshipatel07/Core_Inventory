"""
database.py — SQLAlchemy engine, session, and base model configuration.
Uses SQLite for hackathon demo; easily swap to Oracle/PostgreSQL later.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# ── SQLite for instant demo (no setup required) ──
DATABASE_URL = "sqlite:///./core_inventory.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False)

# ── To switch to MySQL, comment the above and uncomment below: ──
# DATABASE_URL = "mysql+pymysql://root:password@localhost:3306/core_inventory"
# engine = create_engine(DATABASE_URL, echo=False, pool_pre_ping=True, pool_recycle=3600)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables if they don't exist."""
    from backend.models import (
        User, Category, Supplier, Warehouse, Location,
        Product, StockLevel, Receipt, ReceiptLine,
        DeliveryOrder, DeliveryLine, Transfer, TransferLine,
        Adjustment, StockLedger
    )
    Base.metadata.create_all(bind=engine)
