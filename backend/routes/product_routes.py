"""
product_routes.py — Product CRUD, categories, stock availability.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import Product, Category, StockLevel, Warehouse
from backend.schemas import (
    ProductCreate, ProductUpdate, ProductResponse,
    CategoryCreate, CategoryResponse
)
from backend.auth import get_current_user
from backend.audit import log_action

router = APIRouter(prefix="/api/products", tags=["Products"])


# ── Categories ──

@router.get("/categories/list", response_model=List[CategoryResponse])
def list_categories(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return db.query(Category).order_by(Category.name).all()


@router.post("/categories/create", response_model=CategoryResponse, status_code=201)
def create_category(
    req: CategoryCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    cat = Category(name=req.name, parent_id=req.parent_id)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    log_action(db, "product", "create",
        f"Category '{cat.name}' created",
        performed_by=current_user.get("email"))
    return cat


# ── Products ──

@router.get("", response_model=List[ProductResponse])
def list_products(
    search: str = "",
    category_id: str = "",
    warehouse_id: str = "",
    stock_status: str = "",
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    query = db.query(Product).filter(Product.is_active == True)

    if search:
        query = query.filter(
            (Product.name.ilike(f"%{search}%")) | (Product.sku.ilike(f"%{search}%"))
        )
    if category_id:
        query = query.filter(Product.category_id == category_id)

    products = query.order_by(Product.name).all()

    result = []
    for p in products:
        stock_levels = db.query(StockLevel).filter(StockLevel.product_id == p.id).all()
        if warehouse_id:
            stock_levels = [s for s in stock_levels if s.warehouse_id == warehouse_id]

        total = sum(s.qty_on_hand for s in stock_levels)

        if stock_status == "out" and total > 0:
            continue
        if stock_status == "low" and (total == 0 or total > p.low_stock_threshold):
            continue
        if stock_status == "in" and total <= p.low_stock_threshold:
            continue

        cat_name = p.category.name if p.category else None

        stock_by_wh = []
        for s in stock_levels:
            wh = db.query(Warehouse).filter(Warehouse.id == s.warehouse_id).first()
            stock_by_wh.append({
                "warehouse_id": s.warehouse_id,
                "warehouse_name": wh.name if wh else "Unknown",
                "qty_on_hand": s.qty_on_hand,
                "qty_reserved": s.qty_reserved,
            })

        result.append(ProductResponse(
            id=p.id, name=p.name, sku=p.sku,
            category_id=p.category_id, category_name=cat_name,
            unit_of_measure=p.unit_of_measure,
            low_stock_threshold=p.low_stock_threshold,
            total_stock=total, stock_by_warehouse=stock_by_wh,
            is_active=p.is_active, created_at=p.created_at
        ))

    return result


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    p = db.query(Product).filter(Product.id == product_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")

    stock_levels = db.query(StockLevel).filter(StockLevel.product_id == p.id).all()
    total = sum(s.qty_on_hand for s in stock_levels)
    cat_name = p.category.name if p.category else None

    stock_by_wh = []
    for s in stock_levels:
        wh = db.query(Warehouse).filter(Warehouse.id == s.warehouse_id).first()
        stock_by_wh.append({
            "warehouse_id": s.warehouse_id,
            "warehouse_name": wh.name if wh else "Unknown",
            "qty_on_hand": s.qty_on_hand,
            "qty_reserved": s.qty_reserved,
        })

    return ProductResponse(
        id=p.id, name=p.name, sku=p.sku,
        category_id=p.category_id, category_name=cat_name,
        unit_of_measure=p.unit_of_measure,
        low_stock_threshold=p.low_stock_threshold,
        total_stock=total, stock_by_warehouse=stock_by_wh,
        is_active=p.is_active, created_at=p.created_at
    )


@router.post("", response_model=ProductResponse, status_code=201)
def create_product(
    req: ProductCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    existing = db.query(Product).filter(Product.sku == req.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail="SKU already exists")

    product = Product(
        name=req.name, sku=req.sku,
        category_id=req.category_id,
        unit_of_measure=req.unit_of_measure,
        low_stock_threshold=req.low_stock_threshold,
    )
    db.add(product)
    db.flush()

    if req.initial_stock > 0 and req.warehouse_id:
        sl = StockLevel(
            product_id=product.id,
            warehouse_id=req.warehouse_id,
            qty_on_hand=req.initial_stock
        )
        db.add(sl)

    db.commit()
    db.refresh(product)

    log_action(db, "product", "create",
        f"Product '{product.name}' (SKU: {product.sku}) created with initial stock {req.initial_stock}",
        ref_number=product.sku,
        performed_by=current_user.get("email"))

    return ProductResponse(
        id=product.id, name=product.name, sku=product.sku,
        category_id=product.category_id,
        unit_of_measure=product.unit_of_measure,
        low_stock_threshold=product.low_stock_threshold,
        total_stock=req.initial_stock,
        is_active=product.is_active, created_at=product.created_at
    )


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: str, req: ProductUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if req.name is not None:
        product.name = req.name
    if req.sku is not None:
        dup = db.query(Product).filter(Product.sku == req.sku, Product.id != product_id).first()
        if dup:
            raise HTTPException(status_code=400, detail="SKU already in use")
        product.sku = req.sku
    if req.category_id is not None:
        product.category_id = req.category_id
    if req.unit_of_measure is not None:
        product.unit_of_measure = req.unit_of_measure
    if req.low_stock_threshold is not None:
        product.low_stock_threshold = req.low_stock_threshold

    db.commit()
    db.refresh(product)

    log_action(db, "product", "update",
        f"Product '{product.name}' (SKU: {product.sku}) updated",
        ref_number=product.sku,
        performed_by=current_user.get("email"))

    return get_product(product_id, db, current_user)


@router.delete("/{product_id}")
def delete_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.is_active = False
    db.commit()

    log_action(db, "product", "delete",
        f"Product '{product.name}' (SKU: {product.sku}) deactivated",
        ref_number=product.sku,
        performed_by=current_user.get("email"))

    return {"message": "Product deactivated"}