"""
warehouse_routes.py — Warehouse & Location management.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from backend.database import get_db
from backend.models import Warehouse, Location
from backend.schemas import WarehouseCreate, WarehouseUpdate, WarehouseResponse
from backend.audit import log_action

router = APIRouter(prefix="/api/warehouses", tags=["Warehouses"])




@router.get("", response_model=List[WarehouseResponse])
def list_warehouses(db: Session = Depends(get_db)):
    warehouses = db.query(Warehouse).filter(Warehouse.is_active == True).order_by(Warehouse.name).all()
    result = []
    for wh in warehouses:
        loc_count = db.query(Location).filter(Location.warehouse_id == wh.id).count()
        result.append(WarehouseResponse(
            id=wh.id, name=wh.name, code=wh.code,
            address=wh.address, capacity=wh.capacity,
            is_active=wh.is_active, location_count=loc_count
        ))
    return result


@router.get("/{warehouse_id}", response_model=WarehouseResponse)
def get_warehouse(warehouse_id: str, db: Session = Depends(get_db)):
    wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    loc_count = db.query(Location).filter(Location.warehouse_id == wh.id).count()
    return WarehouseResponse(
        id=wh.id, name=wh.name, code=wh.code,
        address=wh.address, capacity=wh.capacity,
        is_active=wh.is_active, location_count=loc_count
    )


@router.post("", response_model=WarehouseResponse, status_code=201)
def create_warehouse(req: WarehouseCreate, db: Session = Depends(get_db)):
    existing = db.query(Warehouse).filter(Warehouse.code == req.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Warehouse code already exists")
    wh = Warehouse(name=req.name, code=req.code, address=req.address, capacity=req.capacity)
    db.add(wh)
    db.commit()
    db.refresh(wh)

    log_action(db, "warehouse", "create",
        f"Warehouse '{wh.name}' (code: {wh.code}) created",
        ref_number=wh.code)

    return WarehouseResponse(
        id=wh.id, name=wh.name, code=wh.code,
        address=wh.address, capacity=wh.capacity,
        is_active=wh.is_active, location_count=0
    )


@router.put("/{warehouse_id}", response_model=WarehouseResponse)
def update_warehouse(warehouse_id: str, req: WarehouseUpdate, db: Session = Depends(get_db)):
    wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    if req.name is not None:
        wh.name = req.name
    if req.code is not None:
        wh.code = req.code
    if req.address is not None:
        wh.address = req.address
    if req.capacity is not None:
        wh.capacity = req.capacity
    db.commit()
    db.refresh(wh)

    log_action(db, "warehouse", "update",
        f"Warehouse '{wh.name}' (code: {wh.code}) updated",
        ref_number=wh.code)

    return get_warehouse(warehouse_id, db)


@router.delete("/{warehouse_id}")
def delete_warehouse(warehouse_id: str, db: Session = Depends(get_db)):
    wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    wh.is_active = False
    db.commit()

    log_action(db, "warehouse", "delete",
        f"Warehouse '{wh.name}' (code: {wh.code}) deactivated",
        ref_number=wh.code)

    return {"message": "Warehouse deactivated"}


# ── Locations under a warehouse ──

@router.get("/{warehouse_id}/locations")
def list_locations(warehouse_id: str, db: Session = Depends(get_db)):
    locs = db.query(Location).filter(
        Location.warehouse_id == warehouse_id,
        Location.is_active == True
    ).all()
    return [{"id": l.id, "name": l.name, "code": l.code, "type": l.type} for l in locs]


@router.post("/{warehouse_id}/locations")
def create_location(warehouse_id: str, name: str, code: str = "", type: str = "rack", db: Session = Depends(get_db)):
    loc = Location(warehouse_id=warehouse_id, name=name, code=code, type=type)
    db.add(loc)
    db.commit()
    db.refresh(loc)

    wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    log_action(db, "warehouse", "create",
        f"Location '{loc.name}' added to warehouse '{wh.name if wh else warehouse_id}'",
        ref_number=wh.code if wh else None)

    return {"id": loc.id, "name": loc.name, "code": loc.code, "type": loc.type}


@router.delete("/{warehouse_id}/locations/{location_id}")
def delete_location(warehouse_id: str, location_id: str, db: Session = Depends(get_db)):
    loc = db.query(Location).filter(Location.id == location_id, Location.warehouse_id == warehouse_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    loc.is_active = False
    db.commit()

    wh = db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
    log_action(db, "warehouse", "delete",
        f"Location '{loc.name}' removed from warehouse '{wh.name if wh else warehouse_id}'",
        ref_number=wh.code if wh else None)

    return {"message": "Location deleted"}
