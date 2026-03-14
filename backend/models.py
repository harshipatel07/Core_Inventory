"""
models.py — SQLAlchemy ORM models (aligned with Oracle SQL schema).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Date,
    ForeignKey, Text, UniqueConstraint, CheckConstraint
)
from sqlalchemy.orm import relationship
from backend.database import Base


def gen_uuid():
    return str(uuid.uuid4())


def utcnow():
    return datetime.now(timezone.utc)


# ──────────────────────────────────────
# 1. USERS
# ──────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(4000), nullable=False)
    role = Column(String(10), default="staff")       # manager | staff
    otp_code = Column(String(6), nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)


# ──────────────────────────────────────
# 2. SUPPLIERS
# ──────────────────────────────────────
class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(150), nullable=False)
    contact_person = Column(String(100))
    email = Column(String(255))
    phone = Column(String(20))
    address = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)


# ──────────────────────────────────────
# 3. CATEGORIES
# ──────────────────────────────────────
class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(100), nullable=False)
    parent_id = Column(String, ForeignKey("categories.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    parent = relationship("Category", remote_side=[id])
    products = relationship("Product", back_populates="category")


# ──────────────────────────────────────
# 4. WAREHOUSES
# ──────────────────────────────────────
class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True)
    address = Column(Text)
    capacity = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    locations = relationship("Location", back_populates="warehouse")


# ──────────────────────────────────────
# 5. LOCATIONS
# ──────────────────────────────────────
class Location(Base):
    __tablename__ = "locations"

    id = Column(String, primary_key=True, default=gen_uuid)
    warehouse_id = Column(String, ForeignKey("warehouses.id"), nullable=False)
    name = Column(String(100), nullable=False)
    code = Column(String(50))
    type = Column(String(10), default="rack")        # rack | shelf | floor | bin
    is_active = Column(Boolean, default=True)

    warehouse = relationship("Warehouse", back_populates="locations")


# ──────────────────────────────────────
# 6. PRODUCTS
# ──────────────────────────────────────
class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String(150), nullable=False)
    sku = Column(String(50), unique=True, nullable=False, index=True)
    category_id = Column(String, ForeignKey("categories.id"), nullable=True)
    unit_of_measure = Column(String(20), default="pcs")
    low_stock_threshold = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    category = relationship("Category", back_populates="products")
    stock_levels = relationship("StockLevel", back_populates="product")


# ──────────────────────────────────────
# 7. STOCK LEVELS
# ──────────────────────────────────────
class StockLevel(Base):
    __tablename__ = "stock_levels"

    id = Column(String, primary_key=True, default=gen_uuid)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(String, ForeignKey("warehouses.id"), nullable=False)
    qty_on_hand = Column(Integer, default=0)
    qty_reserved = Column(Integer, default=0)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    __table_args__ = (
        UniqueConstraint("product_id", "warehouse_id", name="uq_stock_product_wh"),
    )

    product = relationship("Product", back_populates="stock_levels")
    warehouse = relationship("Warehouse")


# ──────────────────────────────────────
# 8. RECEIPTS (Incoming Goods)
# ──────────────────────────────────────
class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(String, primary_key=True, default=gen_uuid)
    ref_number = Column(String(30), unique=True, nullable=False)
    supplier_name = Column(String(150))
    warehouse_id = Column(String, ForeignKey("warehouses.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    status = Column(String(10), default="draft", index=True)  # draft|waiting|ready|done|canceled
    date_val = Column(Date, default=lambda: datetime.now(timezone.utc).date())
    notes = Column(Text)
    created_at = Column(DateTime, default=utcnow)

    lines = relationship("ReceiptLine", back_populates="receipt", cascade="all, delete-orphan")
    warehouse = relationship("Warehouse")


class ReceiptLine(Base):
    __tablename__ = "receipt_lines"

    id = Column(String, primary_key=True, default=gen_uuid)
    receipt_id = Column(String, ForeignKey("receipts.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    qty_expected = Column(Integer, default=0)
    qty_received = Column(Integer, default=0)

    receipt = relationship("Receipt", back_populates="lines")
    product = relationship("Product")


# ──────────────────────────────────────
# 9. DELIVERY ORDERS (Outgoing Goods)
# ──────────────────────────────────────
class DeliveryOrder(Base):
    __tablename__ = "delivery_orders"

    id = Column(String, primary_key=True, default=gen_uuid)
    ref_number = Column(String(30), unique=True, nullable=False)
    customer_name = Column(String(150))
    warehouse_id = Column(String, ForeignKey("warehouses.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    status = Column(String(10), default="draft", index=True)
    date_val = Column(Date, default=lambda: datetime.now(timezone.utc).date())
    notes = Column(Text)
    created_at = Column(DateTime, default=utcnow)

    lines = relationship("DeliveryLine", back_populates="delivery", cascade="all, delete-orphan")
    warehouse = relationship("Warehouse")


class DeliveryLine(Base):
    __tablename__ = "delivery_lines"

    id = Column(String, primary_key=True, default=gen_uuid)
    delivery_id = Column(String, ForeignKey("delivery_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    qty = Column(Integer, nullable=False)

    delivery = relationship("DeliveryOrder", back_populates="lines")
    product = relationship("Product")


# ──────────────────────────────────────
# 10. TRANSFERS (Internal Moves)
# ──────────────────────────────────────
class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(String, primary_key=True, default=gen_uuid)
    ref_number = Column(String(30), unique=True, nullable=False)
    from_warehouse_id = Column(String, ForeignKey("warehouses.id"), nullable=False)
    to_warehouse_id = Column(String, ForeignKey("warehouses.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    status = Column(String(10), default="draft", index=True)
    scheduled_date = Column(Date, nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=utcnow)

    lines = relationship("TransferLine", back_populates="transfer", cascade="all, delete-orphan")
    from_warehouse = relationship("Warehouse", foreign_keys=[from_warehouse_id])
    to_warehouse = relationship("Warehouse", foreign_keys=[to_warehouse_id])


class TransferLine(Base):
    __tablename__ = "transfer_lines"

    id = Column(String, primary_key=True, default=gen_uuid)
    transfer_id = Column(String, ForeignKey("transfers.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    qty = Column(Integer, nullable=False)

    transfer = relationship("Transfer", back_populates="lines")
    product = relationship("Product")


# ──────────────────────────────────────
# 11. ADJUSTMENTS
# ──────────────────────────────────────
class Adjustment(Base):
    __tablename__ = "adjustments"

    id = Column(String, primary_key=True, default=gen_uuid)
    ref_number = Column(String(30), unique=True, nullable=False)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    warehouse_id = Column(String, ForeignKey("warehouses.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    qty_system = Column(Integer, nullable=False)
    qty_counted = Column(Integer, nullable=False)
    reason = Column(Text)
    date_val = Column(Date, default=lambda: datetime.now(timezone.utc).date())
    created_at = Column(DateTime, default=utcnow)

    product = relationship("Product")
    warehouse = relationship("Warehouse")


# ──────────────────────────────────────
# 12. STOCK LEDGER (Append-only log)
# ──────────────────────────────────────
class StockLedger(Base):
    __tablename__ = "stock_ledger"

    id = Column(String, primary_key=True, default=gen_uuid)
    product_id = Column(String, ForeignKey("products.id"), nullable=False, index=True)
    warehouse_id = Column(String, ForeignKey("warehouses.id"), nullable=False)
    operation_type = Column(String(15), nullable=False)  # receipt|delivery|transfer|adjustment
    ref_id = Column(String, nullable=False)
    ref_number = Column(String(30), nullable=False)
    qty_change = Column(Integer, nullable=False)
    qty_after = Column(Integer, nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=utcnow, index=True)

    product = relationship("Product")
    warehouse = relationship("Warehouse")
