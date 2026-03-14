// ============================================
// adjustments.js — Stock adjustments (physical count)
// ============================================

async function renderAdjustments() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="page-header"><h1>Inventory Adjustments</h1>
            <div class="page-header-actions">
                <button class="btn btn-primary" onclick="showCreateAdjustmentModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New Adjustment
                </button>
            </div>
        </div>
        <div class="table-container"><table class="data-table"><thead><tr>
            <th>Reference</th><th>Product</th><th>Warehouse</th><th>System Qty</th><th>Counted</th><th>Difference</th><th>Reason</th><th>Date</th>
        </tr></thead><tbody id="adjustments-tbody"></tbody></table></div>
    </div>`;
    await loadAdjustments();
}

async function loadAdjustments() {
    try {
        const adjustments = await API.get('/adjustments');
        const tbody = document.getElementById('adjustments-tbody');
        if (adjustments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>No adjustments yet</p></div></td></tr>';
            return;
        }
        tbody.innerHTML = adjustments.map(a => {
            const diffClass = a.difference > 0 ? 'color:#00B894' : a.difference < 0 ? 'color:#E17055' : '';
            const diffSign = a.difference > 0 ? '+' : '';
            return `<tr>
                <td><strong>${escapeHTML(a.ref_number)}</strong></td>
                <td>${escapeHTML(a.product_name)}</td>
                <td>${escapeHTML(a.warehouse_name)}</td>
                <td>${a.qty_system}</td>
                <td>${a.qty_counted}</td>
                <td style="${diffClass};font-weight:700">${diffSign}${a.difference}</td>
                <td>${escapeHTML(a.reason || '—')}</td>
                <td>${formatDate(a.date_val || a.created_at)}</td>
            </tr>`;
        }).join('');
    } catch (err) {
        showToast('Failed to load adjustments', 'error');
    }
}

async function showCreateAdjustmentModal() {
    const [products, warehouses] = await Promise.all([API.get('/products'), API.get('/warehouses')]);
    const prodOpts = products.map(p => `<option value="${p.id}">${escapeHTML(p.name)} (${p.sku}) — Stock: ${p.total_stock}</option>`).join('');
    const whOpts = warehouses.map(w => `<option value="${w.id}">${escapeHTML(w.name)}</option>`).join('');
    showModal('Create Stock Adjustment', `
        <form onsubmit="handleCreateAdjustment(event)">
            <div class="form-group"><label>Product</label><select class="form-control" id="adj-product" required>${prodOpts}</select></div>
            <div class="form-group"><label>Warehouse / Location</label><select class="form-control" id="adj-wh" required>${whOpts}</select></div>
            <div class="form-group"><label>Physical Count (Actual Quantity)</label><input type="number" class="form-control" id="adj-counted" required min="0" placeholder="Enter counted quantity"></div>
            <div class="form-group"><label>Reason</label><textarea class="form-control" id="adj-reason" rows="2" placeholder="e.g. Damaged items, counting error..."></textarea></div>
            <div class="modal-actions" style="border:none;padding:1rem 0 0"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-warning">Apply Adjustment</button></div>
        </form>`);
}

async function handleCreateAdjustment(e) {
    e.preventDefault();
    try {
        await API.post('/adjustments', {
            product_id: document.getElementById('adj-product').value,
            warehouse_id: document.getElementById('adj-wh').value,
            qty_counted: parseInt(document.getElementById('adj-counted').value),
            reason: document.getElementById('adj-reason').value,
        });
        closeModal();
        showToast('Adjustment applied! Stock updated.', 'success');
        await loadAdjustments();
    } catch (err) {
        showToast(err.message, 'error');
    }
}
