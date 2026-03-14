"""
main.py — FastAPI application entry point.
Serves both API endpoints and static frontend files.
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os

from backend.database import init_db
from backend.seed import seed_database
from backend.routes import (
    auth_routes,
    product_routes,
    receipt_routes,
    delivery_routes,
    transfer_routes,
    adjustment_routes,
    dashboard_routes,
    warehouse_routes,
    ledger_routes,
)

app = FastAPI(
    title="Core Inventory Management System",
    description="Modular IMS for managing stock operations, warehouses, and inventory flow.",
    version="1.0.0"
)

# CORS — allow frontend to call API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(auth_routes.router)
app.include_router(product_routes.router)
app.include_router(receipt_routes.router)
app.include_router(delivery_routes.router)
app.include_router(transfer_routes.router)
app.include_router(adjustment_routes.router)
app.include_router(dashboard_routes.router)
app.include_router(warehouse_routes.router)
app.include_router(ledger_routes.router)

# Serve static frontend files
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")
if os.path.exists(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
def serve_index():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Core Inventory API is running. Visit /docs for Swagger UI."}


@app.on_event("startup")
def on_startup():
    init_db()
    seed_database()
    print(">>> Core Inventory Management System is running!")
    print("    API Docs: http://localhost:8000/docs")
    print("    Frontend: http://localhost:8000/")
