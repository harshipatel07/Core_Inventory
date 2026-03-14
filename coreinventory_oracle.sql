-- =============================================================
--  CoreInventory — Full Oracle SQL Schema
--  Compatible with: Oracle Database 12c R2 and above
--  NOTE: Run this as your app schema user, NOT as SYS/SYSTEM
--  In Oracle, you don't CREATE a separate database per app.
--  Just connect to your schema/user and run all statements below.
-- =============================================================


-- =============================================================
--  1. USERS
-- =============================================================

CREATE TABLE users (
    id               CHAR(32)        DEFAULT SYS_GUID()      NOT NULL,
    name             VARCHAR2(100)                            NOT NULL,
    email            VARCHAR2(255)                            NOT NULL,
    password_hash    VARCHAR2(4000)                           NOT NULL,
    role             VARCHAR2(10)    DEFAULT 'staff'          NOT NULL,
    otp_code         VARCHAR2(6),
    otp_expires_at   TIMESTAMP,
    is_active        NUMBER(1)       DEFAULT 1                NOT NULL,
    created_at       TIMESTAMP       DEFAULT SYSTIMESTAMP     NOT NULL,
    CONSTRAINT pk_users         PRIMARY KEY (id),
    CONSTRAINT uq_users_email   UNIQUE (email),
    CONSTRAINT chk_users_role   CHECK (role IN ('manager','staff')),
    CONSTRAINT chk_users_active CHECK (is_active IN (0,1))
);

CREATE INDEX idx_users_email ON users (email);


-- =============================================================
--  2. SUPPLIERS
-- =============================================================

CREATE TABLE suppliers (
    id               CHAR(32)        DEFAULT SYS_GUID()      NOT NULL,
    name             VARCHAR2(150)                            NOT NULL,
    contact_person   VARCHAR2(100),
    email            VARCHAR2(255),
    phone            VARCHAR2(20),
    address          VARCHAR2(4000),
    is_active        NUMBER(1)       DEFAULT 1                NOT NULL,
    created_at       TIMESTAMP       DEFAULT SYSTIMESTAMP     NOT NULL,
    CONSTRAINT pk_suppliers         PRIMARY KEY (id),
    CONSTRAINT chk_suppliers_active CHECK (is_active IN (0,1))
);


-- =============================================================
--  3. CATEGORIES
-- =============================================================

CREATE TABLE categories (
    id               CHAR(32)        DEFAULT SYS_GUID()      NOT NULL,
    name             VARCHAR2(100)                            NOT NULL,
    parent_id        CHAR(32),
    created_at       TIMESTAMP       DEFAULT SYSTIMESTAMP     NOT NULL,
    CONSTRAINT pk_categories        PRIMARY KEY (id),
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id)
        REFERENCES categories (id) ON DELETE SET NULL
);

CREATE INDEX idx_categories_parent ON categories (parent_id);


-- =============================================================
--  4. PRODUCTS
-- =============================================================

CREATE TABLE products (
    id                   CHAR(32)        DEFAULT SYS_GUID()  NOT NULL,
    name                 VARCHAR2(150)                        NOT NULL,
    sku                  VARCHAR2(50)                         NOT NULL,
    category_id          CHAR(32),
    unit_of_measure      VARCHAR2(20)    DEFAULT 'pcs'        NOT NULL,
    low_stock_threshold  NUMBER(10)      DEFAULT 0            NOT NULL,
    is_active            NUMBER(1)       DEFAULT 1            NOT NULL,
    created_at           TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT pk_products           PRIMARY KEY (id),
    CONSTRAINT uq_products_sku       UNIQUE (sku),
    CONSTRAINT fk_products_category  FOREIGN KEY (category_id)
        REFERENCES categories (id) ON DELETE SET NULL,
    CONSTRAINT chk_products_active   CHECK (is_active IN (0,1)),
    CONSTRAINT chk_low_stock         CHECK (low_stock_threshold >= 0)
);

CREATE INDEX idx_products_sku      ON products (sku);
CREATE INDEX idx_products_category ON products (category_id);


-- =============================================================
--  5. WAREHOUSES
-- =============================================================

CREATE TABLE warehouses (
    id               CHAR(32)        DEFAULT SYS_GUID()      NOT NULL,
    name             VARCHAR2(100)                            NOT NULL,
    address          VARCHAR2(4000),
    is_active        NUMBER(1)       DEFAULT 1                NOT NULL,
    created_at       TIMESTAMP       DEFAULT SYSTIMESTAMP     NOT NULL,
    CONSTRAINT pk_warehouses         PRIMARY KEY (id),
    CONSTRAINT chk_warehouses_active CHECK (is_active IN (0,1))
);


-- =============================================================
--  6. LOCATIONS
-- =============================================================

CREATE TABLE locations (
    id               CHAR(32)        DEFAULT SYS_GUID()      NOT NULL,
    warehouse_id     CHAR(32)                                 NOT NULL,
    name             VARCHAR2(100)                            NOT NULL,
    type             VARCHAR2(10)    DEFAULT 'rack'           NOT NULL,
    is_active        NUMBER(1)       DEFAULT 1                NOT NULL,
    CONSTRAINT pk_locations          PRIMARY KEY (id),
    CONSTRAINT fk_locations_wh       FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id) ON DELETE CASCADE,
    CONSTRAINT chk_locations_type    CHECK (type IN ('rack','shelf','floor','bin')),
    CONSTRAINT chk_locations_active  CHECK (is_active IN (0,1))
);

CREATE INDEX idx_locations_warehouse ON locations (warehouse_id);


-- =============================================================
--  7. STOCK LEVELS
-- =============================================================

CREATE TABLE stock_levels (
    id               CHAR(32)        DEFAULT SYS_GUID()      NOT NULL,
    product_id       CHAR(32)                                 NOT NULL,
    location_id      CHAR(32)                                 NOT NULL,
    qty_on_hand      NUMBER(10)      DEFAULT 0                NOT NULL,
    qty_reserved     NUMBER(10)      DEFAULT 0                NOT NULL,
    updated_at       TIMESTAMP       DEFAULT SYSTIMESTAMP     NOT NULL,
    CONSTRAINT pk_stock_levels           PRIMARY KEY (id),
    CONSTRAINT uq_stock_product_location UNIQUE (product_id, location_id),
    CONSTRAINT fk_stock_product          FOREIGN KEY (product_id)
        REFERENCES products  (id) ON DELETE CASCADE,
    CONSTRAINT fk_stock_location         FOREIGN KEY (location_id)
        REFERENCES locations (id) ON DELETE CASCADE,
    CONSTRAINT chk_qty_on_hand           CHECK (qty_on_hand  >= 0),
    CONSTRAINT chk_qty_reserved          CHECK (qty_reserved >= 0)
);

CREATE INDEX idx_stock_product  ON stock_levels (product_id);
CREATE INDEX idx_stock_location ON stock_levels (location_id);

CREATE OR REPLACE TRIGGER trg_stock_levels_updated
BEFORE UPDATE ON stock_levels
FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/


-- =============================================================
--  8. REORDER RULES
-- =============================================================

CREATE TABLE reorder_rules (
    id                    CHAR(32)    DEFAULT SYS_GUID()     NOT NULL,
    product_id            CHAR(32)                            NOT NULL,
    warehouse_id          CHAR(32)                            NOT NULL,
    min_qty               NUMBER(10)  DEFAULT 0               NOT NULL,
    max_qty               NUMBER(10),
    replenish_qty         NUMBER(10)  DEFAULT 1               NOT NULL,
    preferred_supplier_id CHAR(32),
    CONSTRAINT pk_reorder_rules             PRIMARY KEY (id),
    CONSTRAINT uq_reorder_product_warehouse UNIQUE (product_id, warehouse_id),
    CONSTRAINT fk_reorder_product           FOREIGN KEY (product_id)
        REFERENCES products   (id) ON DELETE CASCADE,
    CONSTRAINT fk_reorder_warehouse         FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id) ON DELETE CASCADE,
    CONSTRAINT fk_reorder_supplier          FOREIGN KEY (preferred_supplier_id)
        REFERENCES suppliers  (id) ON DELETE SET NULL
);


-- =============================================================
--  9. RECEIPTS
-- =============================================================

CREATE TABLE receipts (
    id            CHAR(32)        DEFAULT SYS_GUID()         NOT NULL,
    ref_number    VARCHAR2(30)                                NOT NULL,
    supplier_id   CHAR(32),
    warehouse_id  CHAR(32)                                    NOT NULL,
    created_by    CHAR(32)                                    NOT NULL,
    status        VARCHAR2(10)    DEFAULT 'draft'             NOT NULL,
    date_val      DATE            DEFAULT SYSDATE             NOT NULL,
    notes         VARCHAR2(4000),
    created_at    TIMESTAMP       DEFAULT SYSTIMESTAMP        NOT NULL,
    CONSTRAINT pk_receipts          PRIMARY KEY (id),
    CONSTRAINT uq_receipts_ref      UNIQUE (ref_number),
    CONSTRAINT fk_receipts_supplier FOREIGN KEY (supplier_id)
        REFERENCES suppliers  (id) ON DELETE SET NULL,
    CONSTRAINT fk_receipts_wh       FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id),
    CONSTRAINT fk_receipts_user     FOREIGN KEY (created_by)
        REFERENCES users      (id),
    CONSTRAINT chk_receipts_status  CHECK (status IN ('draft','waiting','ready','done','canceled'))
);

CREATE INDEX idx_receipts_status    ON receipts (status);
CREATE INDEX idx_receipts_warehouse ON receipts (warehouse_id);


-- =============================================================
--  10. RECEIPT LINES
-- =============================================================

CREATE TABLE receipt_lines (
    id            CHAR(32)    DEFAULT SYS_GUID()             NOT NULL,
    receipt_id    CHAR(32)                                    NOT NULL,
    product_id    CHAR(32)                                    NOT NULL,
    location_id   CHAR(32)                                    NOT NULL,
    qty_expected  NUMBER(10)  DEFAULT 0                       NOT NULL,
    qty_received  NUMBER(10)  DEFAULT 0                       NOT NULL,
    CONSTRAINT pk_receipt_lines    PRIMARY KEY (id),
    CONSTRAINT fk_rlines_receipt   FOREIGN KEY (receipt_id)
        REFERENCES receipts  (id) ON DELETE CASCADE,
    CONSTRAINT fk_rlines_product   FOREIGN KEY (product_id)
        REFERENCES products  (id),
    CONSTRAINT fk_rlines_location  FOREIGN KEY (location_id)
        REFERENCES locations (id),
    CONSTRAINT chk_rlines_expected CHECK (qty_expected >= 0),
    CONSTRAINT chk_rlines_received CHECK (qty_received >= 0)
);

CREATE INDEX idx_receipt_lines_receipt ON receipt_lines (receipt_id);


-- =============================================================
--  11. DELIVERY ORDERS
-- =============================================================

CREATE TABLE delivery_orders (
    id            CHAR(32)        DEFAULT SYS_GUID()         NOT NULL,
    ref_number    VARCHAR2(30)                                NOT NULL,
    customer_ref  VARCHAR2(100),
    warehouse_id  CHAR(32)                                    NOT NULL,
    created_by    CHAR(32)                                    NOT NULL,
    status        VARCHAR2(10)    DEFAULT 'draft'             NOT NULL,
    date_val      DATE            DEFAULT SYSDATE             NOT NULL,
    notes         VARCHAR2(4000),
    created_at    TIMESTAMP       DEFAULT SYSTIMESTAMP        NOT NULL,
    CONSTRAINT pk_delivery_orders   PRIMARY KEY (id),
    CONSTRAINT uq_delivery_ref      UNIQUE (ref_number),
    CONSTRAINT fk_delivery_wh       FOREIGN KEY (warehouse_id)
        REFERENCES warehouses (id),
    CONSTRAINT fk_delivery_user     FOREIGN KEY (created_by)
        REFERENCES users      (id),
    CONSTRAINT chk_delivery_status  CHECK (status IN ('draft','waiting','ready','done','canceled'))
);

CREATE INDEX idx_delivery_status    ON delivery_orders (status);
CREATE INDEX idx_delivery_warehouse ON delivery_orders (warehouse_id);


-- =============================================================
--  12. DELIVERY LINES
-- =============================================================

CREATE TABLE delivery_lines (
    id           CHAR(32)    DEFAULT SYS_GUID()              NOT NULL,
    delivery_id  CHAR(32)                                     NOT NULL,
    product_id   CHAR(32)                                     NOT NULL,
    location_id  CHAR(32)                                     NOT NULL,
    qty          NUMBER(10)                                   NOT NULL,
    CONSTRAINT pk_delivery_lines  PRIMARY KEY (id),
    CONSTRAINT fk_dlines_delivery FOREIGN KEY (delivery_id)
        REFERENCES delivery_orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_dlines_product  FOREIGN KEY (product_id)
        REFERENCES products  (id),
    CONSTRAINT fk_dlines_location FOREIGN KEY (location_id)
        REFERENCES locations (id),
    CONSTRAINT chk_dlines_qty     CHECK (qty > 0)
);

CREATE INDEX idx_delivery_lines_delivery ON delivery_lines (delivery_id);


-- =============================================================
--  13. TRANSFERS
-- =============================================================

CREATE TABLE transfers (
    id                CHAR(32)        DEFAULT SYS_GUID()     NOT NULL,
    ref_number        VARCHAR2(30)                            NOT NULL,
    from_location_id  CHAR(32)                                NOT NULL,
    to_location_id    CHAR(32)                                NOT NULL,
    created_by        CHAR(32)                                NOT NULL,
    status            VARCHAR2(10)    DEFAULT 'draft'         NOT NULL,
    scheduled_date    DATE,
    notes             VARCHAR2(4000),
    created_at        TIMESTAMP       DEFAULT SYSTIMESTAMP    NOT NULL,
    CONSTRAINT pk_transfers           PRIMARY KEY (id),
    CONSTRAINT uq_transfers_ref       UNIQUE (ref_number),
    CONSTRAINT fk_transfers_from      FOREIGN KEY (from_location_id)
        REFERENCES locations (id),
    CONSTRAINT fk_transfers_to        FOREIGN KEY (to_location_id)
        REFERENCES locations (id),
    CONSTRAINT fk_transfers_user      FOREIGN KEY (created_by)
        REFERENCES users     (id),
    CONSTRAINT chk_transfers_status   CHECK (status IN ('draft','waiting','ready','done','canceled')),
    CONSTRAINT chk_transfer_locations CHECK (from_location_id <> to_location_id)
);

CREATE INDEX idx_transfers_status ON transfers (status);


-- =============================================================
--  14. TRANSFER LINES
-- =============================================================

CREATE TABLE transfer_lines (
    id           CHAR(32)    DEFAULT SYS_GUID()              NOT NULL,
    transfer_id  CHAR(32)                                     NOT NULL,
    product_id   CHAR(32)                                     NOT NULL,
    qty          NUMBER(10)                                   NOT NULL,
    CONSTRAINT pk_transfer_lines  PRIMARY KEY (id),
    CONSTRAINT fk_tlines_transfer FOREIGN KEY (transfer_id)
        REFERENCES transfers (id) ON DELETE CASCADE,
    CONSTRAINT fk_tlines_product  FOREIGN KEY (product_id)
        REFERENCES products  (id),
    CONSTRAINT chk_tlines_qty     CHECK (qty > 0)
);

CREATE INDEX idx_transfer_lines_transfer ON transfer_lines (transfer_id);


-- =============================================================
--  15. ADJUSTMENTS
-- =============================================================

CREATE TABLE adjustments (
    id           CHAR(32)        DEFAULT SYS_GUID()          NOT NULL,
    ref_number   VARCHAR2(30)                                 NOT NULL,
    product_id   CHAR(32)                                     NOT NULL,
    location_id  CHAR(32)                                     NOT NULL,
    created_by   CHAR(32)                                     NOT NULL,
    qty_system   NUMBER(10)                                   NOT NULL,
    qty_counted  NUMBER(10)                                   NOT NULL,
    difference   NUMBER(10) GENERATED ALWAYS AS (qty_counted - qty_system) VIRTUAL,
    reason       VARCHAR2(4000),
    date_val     DATE            DEFAULT SYSDATE              NOT NULL,
    created_at   TIMESTAMP       DEFAULT SYSTIMESTAMP         NOT NULL,
    CONSTRAINT pk_adjustments     PRIMARY KEY (id),
    CONSTRAINT uq_adjustments_ref UNIQUE (ref_number),
    CONSTRAINT fk_adj_product     FOREIGN KEY (product_id)
        REFERENCES products  (id),
    CONSTRAINT fk_adj_location    FOREIGN KEY (location_id)
        REFERENCES locations (id),
    CONSTRAINT fk_adj_user        FOREIGN KEY (created_by)
        REFERENCES users     (id)
);

CREATE INDEX idx_adj_product  ON adjustments (product_id);
CREATE INDEX idx_adj_location ON adjustments (location_id);


-- =============================================================
--  16. STOCK LEDGER  (Append-only — never delete rows)
-- =============================================================

CREATE TABLE stock_ledger (
    id              CHAR(32)        DEFAULT SYS_GUID()       NOT NULL,
    product_id      CHAR(32)                                  NOT NULL,
    location_id     CHAR(32)                                  NOT NULL,
    operation_type  VARCHAR2(15)                              NOT NULL,
    ref_id          CHAR(32)                                  NOT NULL,
    ref_number      VARCHAR2(30)                              NOT NULL,
    qty_change      NUMBER(10)                                NOT NULL,
    qty_after       NUMBER(10)                                NOT NULL,
    created_by      CHAR(32)                                  NOT NULL,
    created_at      TIMESTAMP       DEFAULT SYSTIMESTAMP      NOT NULL,
    CONSTRAINT pk_stock_ledger    PRIMARY KEY (id),
    CONSTRAINT fk_ledger_product  FOREIGN KEY (product_id)
        REFERENCES products  (id),
    CONSTRAINT fk_ledger_location FOREIGN KEY (location_id)
        REFERENCES locations (id),
    CONSTRAINT fk_ledger_user     FOREIGN KEY (created_by)
        REFERENCES users     (id),
    CONSTRAINT chk_ledger_op_type CHECK (operation_type IN ('receipt','delivery','transfer','adjustment'))
);

CREATE INDEX idx_ledger_product  ON stock_ledger (product_id);
CREATE INDEX idx_ledger_location ON stock_ledger (location_id);
CREATE INDEX idx_ledger_ref      ON stock_ledger (ref_id);
CREATE INDEX idx_ledger_created  ON stock_ledger (created_at);


-- =============================================================
--  VIEWS
-- =============================================================

CREATE OR REPLACE VIEW v_stock_available AS
SELECT
    p.id                             AS product_id,
    p.name                           AS product_name,
    p.sku,
    l.id                             AS location_id,
    l.name                           AS location_name,
    w.id                             AS warehouse_id,
    w.name                           AS warehouse_name,
    s.qty_on_hand,
    s.qty_reserved,
    (s.qty_on_hand - s.qty_reserved) AS qty_available,
    p.low_stock_threshold,
    CASE
        WHEN s.qty_on_hand = 0                      THEN 'out_of_stock'
        WHEN s.qty_on_hand <= p.low_stock_threshold THEN 'low_stock'
        ELSE 'in_stock'
    END AS stock_status
FROM stock_levels s
JOIN products   p ON p.id = s.product_id
JOIN locations  l ON l.id = s.location_id
JOIN warehouses w ON w.id = l.warehouse_id;


CREATE OR REPLACE VIEW v_dashboard_kpis AS
SELECT
    (SELECT COUNT(*) FROM products        WHERE is_active = 1)                          AS total_products,
    (SELECT COUNT(*) FROM v_stock_available WHERE stock_status = 'low_stock')            AS low_stock_count,
    (SELECT COUNT(*) FROM v_stock_available WHERE stock_status = 'out_of_stock')         AS out_of_stock_count,
    (SELECT COUNT(*) FROM receipts        WHERE status IN ('draft','waiting','ready'))   AS pending_receipts,
    (SELECT COUNT(*) FROM delivery_orders WHERE status IN ('draft','waiting','ready'))   AS pending_deliveries,
    (SELECT COUNT(*) FROM transfers       WHERE status IN ('draft','waiting','ready'))   AS pending_transfers
FROM DUAL;


-- =============================================================
--  USEFUL QUERIES
-- =============================================================

-- Full stock position for a specific warehouse
-- SELECT * FROM v_stock_available WHERE warehouse_id = '<warehouse_id>';

-- All pending receipts with supplier name
-- SELECT r.ref_number, s.name AS supplier, r.status, r.date_val
-- FROM receipts r
-- LEFT JOIN suppliers s ON s.id = r.supplier_id
-- WHERE r.status IN ('draft','waiting','ready')
-- ORDER BY r.date_val DESC;

-- Move history for a product
-- SELECT sl.created_at, sl.operation_type, sl.ref_number,
--        sl.qty_change, sl.qty_after, u.name AS done_by
-- FROM stock_ledger sl
-- JOIN users u ON u.id = sl.created_by
-- WHERE sl.product_id = '<product_id>'
-- ORDER BY sl.created_at DESC;

-- Low stock and out of stock items
-- SELECT * FROM v_stock_available
-- WHERE stock_status IN ('low_stock','out_of_stock')
-- ORDER BY qty_on_hand ASC;

-- Products with stock totals across all locations
-- SELECT product_id, product_name, sku,
--        SUM(qty_on_hand)   AS total_on_hand,
--        SUM(qty_available) AS total_available
-- FROM v_stock_available
-- GROUP BY product_id, product_name, sku
-- ORDER BY total_on_hand ASC;
