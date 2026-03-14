// ============================================
// stock.js — Stock Availability
// Spec: Product | Per Unit Cost | On Hand | Free to Use
//       Inline editable On Hand, search
// ============================================

let _stockCache = [];

async function renderStock() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="rcpt-page-header">
            <h1 class="rcpt-title">Stock</h1>
            <div class="rcpt-search-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="stock-search" placeholder="Search product..." oninput="filterStock()">
            </div>
        </div>
        <div class="table-container">
            <table class="data-table" id="stock-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th>Per Unit Cost</th>
                        <th style="text-align:right">On Hand</th>
                        <th style="text-align:right">Free to Use</th>
                    </tr>
                </thead>
                <tbody id="stock-tbody">
                    <tr><td colspan="4"><div class="empty-state"><div class="loading-spinner"></div><p>Loading...</p></div></td></tr>
                </tbody>
            </table>
        </div>
        <p style="font-size:0.73rem;color:var(--text-muted);margin-top:0.75rem;text-align:center">
            Click the dashed <strong>On Hand</strong> value to update stock directly
        </p>
    </div>`;
    await loadStock();
}

async function loadStock() {
    try {
        _stockCache = await API.get('/products');
        renderStockTable(_stockCache);
    } catch (err) {
        showToast('Failed to load stock', 'error');
    }
}

function filterStock() {
    const q = (document.getElementById('stock-search')?.value || '').toLowerCase();
    const filtered = _stockCache.filter(p =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
    renderStockTable(filtered);
}

function renderStockTable(products) {
    const tbody = document.getElementById('stock-tbody');
    if (!tbody) return;

    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><p>No products found</p></div></td></tr>';
        return;
    }

    tbody.innerHTML = products.map(p => {
        const onHand    = p.total_stock || 0;
        const reserved  = (p.stock_by_warehouse || []).reduce((s, w) => s + (w.qty_reserved || 0), 0);
        const freeToUse = Math.max(0, onHand - reserved);

        return `<tr>
            <td>
                <div style="display:flex;align-items:center;gap:10px">
                    <div class="stock-product-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                    </div>
                    <div>
                        <div style="font-weight:600">${escapeHTML(p.name)}</div>
                        <div style="font-size:0.72rem;color:var(--text-muted)">${escapeHTML(p.sku)}</div>
                    </div>
                </div>
            </td>
            <td style="color:var(--text-secondary)">— Rs</td>
            <td style="text-align:right">
                <span class="stock-editable-cell" onclick="openStockEditor(this,'${p.id}',${onHand})" title="Click to update">
                    <strong>${onHand}</strong>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11" class="edit-icon"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </span>
            </td>
            <td style="text-align:right">
                <strong style="color:${freeToUse > 0 ? 'var(--accent-secondary)' : 'var(--accent-danger)'}">${freeToUse}</strong>
            </td>
        </tr>`;
    }).join('');
}

function openStockEditor(el, productId, currentQty) {
    showModal('Update Stock — On Hand', `
        <div style="margin-bottom:1.25rem;padding:1rem;background:var(--bg-secondary);border-radius:var(--radius-sm)">
            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">Current On Hand</div>
            <div style="font-size:1.6rem;font-weight:800;color:var(--text-white)">${currentQty}</div>
        </div>
        <form onsubmit="handleStockUpdate(event,'${productId}',${currentQty})">
            <div class="form-group">
                <label>Adjustment Type</label>
                <select class="form-control" id="adj-type" onchange="updateAdjPreview(${currentQty})">
                    <option value="set">Set to exact value</option>
                    <option value="add">Add quantity</option>
                    <option value="sub">Remove quantity</option>
                </select>
            </div>
            <div class="form-group">
                <label>Quantity</label>
                <input type="number" class="form-control" id="adj-qty" value="${currentQty}" min="0" oninput="updateAdjPreview(${currentQty})" required>
            </div>
            <div id="adj-preview" style="padding:0.75rem;background:rgba(108,92,231,0.08);border:1px solid rgba(108,92,231,0.2);border-radius:var(--radius-sm);font-size:0.82rem;color:var(--text-secondary);margin-bottom:1rem">
                New value: <strong style="color:var(--text-white)">${currentQty}</strong>
            </div>
            <div class="form-group">
                <label>Reason / Notes</label>
                <input class="form-control" id="adj-reason" placeholder="e.g. Physical count correction">
            </div>
            <div class="modal-actions" style="border:none;padding:1rem 0 0">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Save Change</button>
            </div>
        </form>
    `);
}

function updateAdjPreview(current) {
    const type = document.getElementById('adj-type')?.value;
    const qty  = parseInt(document.getElementById('adj-qty')?.value) || 0;
    let newVal = current;
    if (type === 'set') newVal = qty;
    else if (type === 'add') newVal = current + qty;
    else if (type === 'sub') newVal = Math.max(0, current - qty);
    const preview = document.getElementById('adj-preview');
    if (preview) preview.innerHTML = `New On Hand: <strong style="color:var(--text-white)">${newVal}</strong>`;
}

async function handleStockUpdate(e, productId, currentQty) {
    e.preventDefault();
    const type   = document.getElementById('adj-type').value;
    const qty    = parseInt(document.getElementById('adj-qty').value) || 0;
    const reason = document.getElementById('adj-reason').value || 'Stock update from Stock page';

    let newQty = currentQty;
    if (type === 'set') newQty = qty;
    else if (type === 'add') newQty = currentQty + qty;
    else if (type === 'sub') newQty = Math.max(0, currentQty - qty);

    const diff = newQty - currentQty;

    try {
        // Use adjustments API — get warehouses to pick first available
        const whs = await API.get('/warehouses');
        if (!whs.length) { showToast('No warehouse configured', 'error'); return; }

        await API.post('/adjustments', {
            warehouse_id: whs[0].id,
            notes: reason,
            lines: [{ product_id: productId, qty_change: diff }]
        });
        closeModal();
        showToast('Stock updated!', 'success');
        await loadStock();
    } catch (err) {
        showToast(err.message || 'Failed to update stock', 'error');
    }
}