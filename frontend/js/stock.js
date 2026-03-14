// ============================================
// stock.js — Stock Availability View
// ============================================

let stockCache = [];

async function renderStock() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="page-header">
            <h1>Stock Availability</h1>
            <div class="page-header-actions">
                <div class="search-bar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="stock-search" placeholder="Search by name or SKU..." oninput="filterStock()">
                </div>
            </div>
        </div>

        <div class="filters-bar">
            <span class="filter-chip active" onclick="filterStockByStatus(event, '')">All</span>
            <span class="filter-chip" onclick="filterStockByStatus(event, 'in')">✓ In Stock</span>
            <span class="filter-chip" onclick="filterStockByStatus(event, 'low')">⚠ Low Stock</span>
            <span class="filter-chip" onclick="filterStockByStatus(event, 'out')">✕ Out of Stock</span>
        </div>

        <div class="table-container">
            <table class="data-table" id="stock-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>SKU</th>
                        <th>Unit</th>
                        <th style="text-align:right">On Hand</th>
                        <th style="text-align:right">Reserved</th>
                        <th style="text-align:right">Free to Use</th>
                        <th>Status</th>
                        <th>Stock by Warehouse</th>
                    </tr>
                </thead>
                <tbody id="stock-tbody">
                    <tr><td colspan="8"><div class="empty-state"><div class="loading-spinner"></div><p>Loading stock data...</p></div></td></tr>
                </tbody>
            </table>
        </div>
    </div>`;

    await loadStock();
}

async function loadStock(search = '', statusFilter = '') {
    try {
        let endpoint = '/products?';
        if (search) endpoint += `search=${encodeURIComponent(search)}&`;
        if (statusFilter) endpoint += `stock_status=${statusFilter}&`;
        stockCache = await API.get(endpoint);
        renderStockTable(stockCache);
    } catch (err) {
        showToast('Failed to load stock data', 'error');
    }
}

function renderStockTable(products) {
    const tbody = document.getElementById('stock-tbody');
    if (!tbody) return;
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>No products found</p></div></td></tr>';
        return;
    }

    tbody.innerHTML = products.map(p => {
        const totalOnHand = p.total_stock;
        const totalReserved = (p.stock_by_warehouse || []).reduce((s, w) => s + (w.qty_reserved || 0), 0);
        const freeToUse = Math.max(0, totalOnHand - totalReserved);

        const whBreakdown = (p.stock_by_warehouse || [])
            .map(w => `<span class="wh-pill" title="${escapeHTML(w.warehouse_name)}: ${w.qty_on_hand} on hand, ${w.qty_reserved} reserved">
                <strong>${escapeHTML(w.warehouse_name)}</strong>: ${w.qty_on_hand}
            </span>`)
            .join('') || '<span style="color:var(--text-muted);font-size:0.75rem">No stock records</span>';

        return `<tr>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <div class="stock-product-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                    </div>
                    <strong>${escapeHTML(p.name)}</strong>
                </div>
            </td>
            <td><code style="color:var(--text-accent);font-size:0.78rem">${escapeHTML(p.sku)}</code></td>
            <td style="color:var(--text-secondary)">${escapeHTML(p.unit_of_measure)}</td>
            <td style="text-align:right">
                <span class="stock-qty-cell" 
                      onclick="showAdjustStockModal('${p.id}', '${escapeHTML(p.name)}', ${totalOnHand})"
                      title="Click to adjust stock">
                    <strong>${totalOnHand}</strong>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12" class="edit-icon"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </span>
            </td>
            <td style="text-align:right;color:var(--accent-warning)">${totalReserved}</td>
            <td style="text-align:right">
                <strong style="color:${freeToUse > 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)'}">${freeToUse}</strong>
            </td>
            <td>${stockBadge(totalOnHand, p.low_stock_threshold)}</td>
            <td><div class="wh-pills">${whBreakdown}</div></td>
        </tr>`;
    }).join('');
}

function filterStock() {
    const q = document.getElementById('stock-search').value;
    const activeChip = document.querySelector('#page-content .filter-chip.active');
    const status = activeChip ? activeChip.dataset.status || '' : '';
    loadStock(q, status);
}

function filterStockByStatus(event, status) {
    document.querySelectorAll('#page-content .filter-chip').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    event.target.dataset.status = status;
    const q = document.getElementById('stock-search')?.value || '';
    loadStock(q, status);
}

function showAdjustStockModal(productId, productName, currentStock) {
    // Navigate to adjustments page with pre-filled product
    showModal(`Adjust Stock — ${productName}`, `
        <div style="margin-bottom:1.5rem">
            <p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:1rem">
                Current total stock: <strong style="color:var(--text-primary)">${currentStock}</strong> units.
                Use <a href="#" onclick="closeModal();navigate('adjustments')" style="color:var(--accent-primary)">Adjustments</a> 
                for full stock correction workflow, or go to 
                <a href="#" onclick="closeModal();navigate('receipts')" style="color:var(--accent-primary)">Receipts</a> 
                to receive new stock.
            </p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
                <div class="card" style="text-align:center;cursor:pointer;border:1px solid var(--border-color)" 
                     onclick="closeModal();navigate('receipts')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-secondary)" stroke-width="2" width="32" height="32" style="margin-bottom:8px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <div style="font-weight:600">New Receipt</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">Receive incoming goods</div>
                </div>
                <div class="card" style="text-align:center;cursor:pointer;border:1px solid var(--border-color)" 
                     onclick="closeModal();navigate('adjustments')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-warning)" stroke-width="2" width="32" height="32" style="margin-bottom:8px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
                    <div style="font-weight:600">Stock Adjustment</div>
                    <div style="font-size:0.75rem;color:var(--text-muted)">Manual correction / write-off</div>
                </div>
            </div>
        </div>
        <div class="modal-actions" style="border:none;padding:0">
            <button class="btn btn-secondary" onclick="closeModal()">Close</button>
        </div>
    `);
}