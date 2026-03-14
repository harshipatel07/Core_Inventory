"""
seed.py - Populate the database with demo data for hackathon presentation.
"""

from backend.database import SessionLocal
from backend.models import (
    User, Category, Supplier, Warehouse, Location, Product,
    StockLevel, Receipt, ReceiptLine, DeliveryOrder, DeliveryLine,
    Transfer, TransferLine, StockLedger
)
from backend.auth import hash_password


def seed_database():
    db = SessionLocal()

    # Skip if already seeded
    if db.query(User).first():
        db.close()
        return

    # -- Users --
    admin = User(
        id="user-001", name="Admin User", email="admin@inventory.com",
        password_hash=hash_password("admin123"), role="manager"
    )
    staff = User(
        id="user-002", name="Warehouse Staff", email="staff@inventory.com",
        password_hash=hash_password("staff123"), role="staff"
    )
    db.add_all([admin, staff])

    # -- Categories --
    cats = [
        Category(id="cat-1", name="Raw Materials"),
        Category(id="cat-2", name="Finished Goods"),
        Category(id="cat-3", name="Packaging"),
        Category(id="cat-4", name="Consumables"),
        Category(id="cat-5", name="Spare Parts"),
    ]
    db.add_all(cats)

    # -- Suppliers --
    suppliers = [
        Supplier(id="sup-1", name="Tata Steel", contact_person="Rajesh Kumar", email="raj@tata.com", phone="+91 9876543210"),
        Supplier(id="sup-2", name="Furniture Hub", contact_person="Amit Patel", email="amit@fhub.com", phone="+91 9876543211"),
        Supplier(id="sup-3", name="PackPro Ltd", contact_person="Priya Sharma", email="priya@packpro.com", phone="+91 9876543212"),
    ]
    db.add_all(suppliers)

    # -- Warehouses --
    warehouses = [
        Warehouse(id="wh-1", name="Main Warehouse", code="WH-MAIN", address="123 Industrial Ave", capacity=10000),
        Warehouse(id="wh-2", name="Production Floor", code="WH-PROD", address="Building B", capacity=5000),
        Warehouse(id="wh-3", name="Cold Storage", code="WH-COLD", address="Building C", capacity=2000),
    ]
    db.add_all(warehouses)

    # -- Locations --
    locations = [
        Location(id="loc-1", warehouse_id="wh-1", name="Rack A", code="WH-MAIN/A"),
        Location(id="loc-2", warehouse_id="wh-1", name="Rack B", code="WH-MAIN/B"),
        Location(id="loc-3", warehouse_id="wh-1", name="Rack C", code="WH-MAIN/C"),
        Location(id="loc-4", warehouse_id="wh-2", name="Assembly Line", code="WH-PROD/AL"),
        Location(id="loc-5", warehouse_id="wh-2", name="Quality Check", code="WH-PROD/QC"),
        Location(id="loc-6", warehouse_id="wh-3", name="Zone 1", code="WH-COLD/Z1"),
    ]
    db.add_all(locations)

    # -- Products --
    products = [
        Product(id="prod-1", name="Steel Rods", sku="STL-001", category_id="cat-1", unit_of_measure="kg", low_stock_threshold=50),
        Product(id="prod-2", name="Wooden Chairs", sku="FUR-002", category_id="cat-2", unit_of_measure="pcs", low_stock_threshold=20),
        Product(id="prod-3", name="Cardboard Boxes", sku="PKG-003", category_id="cat-3", unit_of_measure="pcs", low_stock_threshold=100),
        Product(id="prod-4", name="Lubricant Oil", sku="CON-004", category_id="cat-4", unit_of_measure="liters", low_stock_threshold=10),
        Product(id="prod-5", name="Bearings Set", sku="SPR-005", category_id="cat-5", unit_of_measure="sets", low_stock_threshold=15),
        Product(id="prod-6", name="Aluminum Sheets", sku="STL-006", category_id="cat-1", unit_of_measure="sheets", low_stock_threshold=30),
        Product(id="prod-7", name="Office Desks", sku="FUR-007", category_id="cat-2", unit_of_measure="pcs", low_stock_threshold=10),
        Product(id="prod-8", name="Bubble Wrap", sku="PKG-008", category_id="cat-3", unit_of_measure="rolls", low_stock_threshold=25),
    ]
    db.add_all(products)

    # -- Stock Levels --
    stock = [
        StockLevel(product_id="prod-1", warehouse_id="wh-1", qty_on_hand=150),
        StockLevel(product_id="prod-1", warehouse_id="wh-2", qty_on_hand=50),
        StockLevel(product_id="prod-2", warehouse_id="wh-1", qty_on_hand=85),
        StockLevel(product_id="prod-3", warehouse_id="wh-1", qty_on_hand=500),
        StockLevel(product_id="prod-4", warehouse_id="wh-2", qty_on_hand=8),
        StockLevel(product_id="prod-5", warehouse_id="wh-1", qty_on_hand=12),
        StockLevel(product_id="prod-7", warehouse_id="wh-1", qty_on_hand=45),
        StockLevel(product_id="prod-8", warehouse_id="wh-1", qty_on_hand=18),
    ]
    db.add_all(stock)

    # -- Sample Receipts --
    r1 = Receipt(id="rcpt-1", ref_number="RCP-001", supplier_name="Tata Steel", warehouse_id="wh-1", created_by="user-001", status="done")
    r1.lines = [ReceiptLine(product_id="prod-1", qty_expected=100, qty_received=100)]
    r2 = Receipt(id="rcpt-2", ref_number="RCP-002", supplier_name="Furniture Hub", warehouse_id="wh-1", created_by="user-001", status="waiting")
    r2.lines = [ReceiptLine(product_id="prod-2", qty_expected=30, qty_received=0)]
    r3 = Receipt(id="rcpt-3", ref_number="RCP-003", supplier_name="PackPro Ltd", warehouse_id="wh-1", created_by="user-001", status="draft")
    r3.lines = [
        ReceiptLine(product_id="prod-3", qty_expected=200, qty_received=0),
        ReceiptLine(product_id="prod-8", qty_expected=10, qty_received=0),
    ]
    db.add_all([r1, r2, r3])

    # -- Sample Deliveries --
    d1 = DeliveryOrder(id="del-1", ref_number="DEL-001", customer_name="ABC Corp", warehouse_id="wh-1", created_by="user-001", status="done")
    d1.lines = [DeliveryLine(product_id="prod-2", qty=10)]
    d2 = DeliveryOrder(id="del-2", ref_number="DEL-002", customer_name="XYZ Industries", warehouse_id="wh-1", created_by="user-001", status="ready")
    d2.lines = [DeliveryLine(product_id="prod-7", qty=5)]
    db.add_all([d1, d2])

    # -- Sample Transfer --
    t1 = Transfer(id="trf-1", ref_number="TRF-001", from_warehouse_id="wh-1", to_warehouse_id="wh-2", created_by="user-001", status="done")
    t1.lines = [TransferLine(product_id="prod-1", qty=50)]
    db.add(t1)

    # -- Sample Ledger Entries --
    ledger = [
        StockLedger(product_id="prod-1", warehouse_id="wh-1", operation_type="receipt", ref_id="rcpt-1", ref_number="RCP-001", qty_change=100, qty_after=250, created_by="user-001"),
        StockLedger(product_id="prod-1", warehouse_id="wh-1", operation_type="transfer", ref_id="trf-1", ref_number="TRF-001", qty_change=-50, qty_after=150, created_by="user-001"),
        StockLedger(product_id="prod-1", warehouse_id="wh-2", operation_type="transfer", ref_id="trf-1", ref_number="TRF-001", qty_change=50, qty_after=50, created_by="user-001"),
        StockLedger(product_id="prod-2", warehouse_id="wh-1", operation_type="delivery", ref_id="del-1", ref_number="DEL-001", qty_change=-10, qty_after=85, created_by="user-001"),
    ]
    db.add_all(ledger)

    db.commit()
    db.close()
    print("[OK] Database seeded with demo data!")
