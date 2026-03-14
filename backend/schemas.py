"""
schemas.py — Pydantic models for request/response validation.
"""

from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import date, datetime


# ── Auth ──
class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "staff"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class OTPRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


# ── Products ──
class ProductCreate(BaseModel):
    name: str
    sku: str
    category_id: Optional[str] = None
    unit_of_measure: str = "pcs"
    low_stock_threshold: int = 0
    initial_stock: int = 0
    warehouse_id: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category_id: Optional[str] = None
    unit_of_measure: Optional[str] = None
    low_stock_threshold: Optional[int] = None

class ProductResponse(BaseModel):
    id: str
    name: str
    sku: str
    category_id: Optional[str]
    category_name: Optional[str] = None
    unit_of_measure: str
    low_stock_threshold: int
    total_stock: int = 0
    stock_by_warehouse: list = []
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Categories ──
class CategoryCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None

class CategoryResponse(BaseModel):
    id: str
    name: str
    parent_id: Optional[str] = None

    class Config:
        from_attributes = True


# ── Warehouses ──
class WarehouseCreate(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    capacity: int = 0

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    capacity: Optional[int] = None

class WarehouseResponse(BaseModel):
    id: str
    name: str
    code: Optional[str]
    address: Optional[str]
    capacity: int
    is_active: bool
    location_count: int = 0

    class Config:
        from_attributes = True


# ── Receipt Lines ──
class ReceiptLineCreate(BaseModel):
    product_id: str
    qty_expected: int
    qty_received: int = 0

class ReceiptLineResponse(BaseModel):
    id: str
    product_id: str
    product_name: str = ""
    qty_expected: int
    qty_received: int

    class Config:
        from_attributes = True


# ── Receipts ──
class ReceiptCreate(BaseModel):
    supplier_name: str
    warehouse_id: str
    notes: Optional[str] = None
    items: List[ReceiptLineCreate]

class ReceiptResponse(BaseModel):
    id: str
    ref_number: str
    supplier_name: Optional[str]
    warehouse_id: str
    warehouse_name: str = ""
    warehouse_code: str = ""
    status: str
    date_val: Optional[date]
    notes: Optional[str]
    created_at: Optional[datetime]
    items: List[ReceiptLineResponse] = []

    class Config:
        from_attributes = True


# ── Delivery Lines ──
class DeliveryLineCreate(BaseModel):
    product_id: str
    qty: int

class DeliveryLineResponse(BaseModel):
    id: str
    product_id: str
    product_name: str = ""
    product_sku: str = ""
    qty: int
    qty_available: int = 0
    out_of_stock: bool = False

    class Config:
        from_attributes = True


# ── Deliveries ──
class DeliveryCreate(BaseModel):
    customer_name: str
    warehouse_id: str
    notes: Optional[str] = None
    items: List[DeliveryLineCreate]

class DeliveryResponse(BaseModel):
    id: str
    ref_number: str
    customer_name: Optional[str]
    warehouse_id: str
    warehouse_name: str = ""
    warehouse_code: str = ""
    status: str
    date_val: Optional[date]
    notes: Optional[str]
    created_at: Optional[datetime]
    items: List[DeliveryLineResponse] = []

    class Config:
        from_attributes = True


# ── Transfer Lines ──
class TransferLineCreate(BaseModel):
    product_id: str
    qty: int

class TransferLineResponse(BaseModel):
    id: str
    product_id: str
    product_name: str = ""
    qty: int

    class Config:
        from_attributes = True


# ── Transfers ──
class TransferCreate(BaseModel):
    from_warehouse_id: str
    to_warehouse_id: str
    scheduled_date: Optional[date] = None
    notes: Optional[str] = None
    items: List[TransferLineCreate]

class TransferResponse(BaseModel):
    id: str
    ref_number: str
    from_warehouse_id: str
    from_warehouse_name: str = ""
    to_warehouse_id: str
    to_warehouse_name: str = ""
    status: str
    scheduled_date: Optional[date]
    notes: Optional[str]
    created_at: Optional[datetime]
    items: List[TransferLineResponse] = []

    class Config:
        from_attributes = True


# ── Adjustments ──
class AdjustmentCreate(BaseModel):
    product_id: str
    warehouse_id: str
    qty_counted: int
    reason: Optional[str] = None

class AdjustmentResponse(BaseModel):
    id: str
    ref_number: str
    product_id: str
    product_name: str = ""
    warehouse_id: str
    warehouse_name: str = ""
    qty_system: int
    qty_counted: int
    difference: int = 0
    reason: Optional[str]
    date_val: Optional[date]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Stock Ledger ──
class LedgerResponse(BaseModel):
    id: str
    product_id: str
    product_name: str = ""
    warehouse_id: str
    warehouse_name: str = ""
    operation_type: str
    ref_number: str
    qty_change: int
    qty_after: int
    contact: str = ""
    from_location: str = ""
    to_location: str = ""
    status: str = ""
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Dashboard ──
class DashboardKPIs(BaseModel):
    total_products: int
    low_stock_count: int
    out_of_stock_count: int
    pending_receipts: int
    pending_deliveries: int
    pending_transfers: int

# ── Audit Log ──
class AuditLogResponse(BaseModel):
    id:           str
    module:       str
    action:       str
    ref_number:   Optional[str] = None
    description:  str
    performed_by: Optional[str] = None
    created_at:   Optional[datetime] = None

    class Config:
        from_attributes = True
