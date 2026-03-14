// ============================================
// receipts.js — Incoming goods management
// ============================================

// ── LIST VIEW ──────────────────────────────

async function renderReceipts() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="page-header"><h1>Receipts (Incoming Goods)</h1>
            <div class="page-header-actions">
                <button class="btn btn-primary" onclick="showCreateReceiptModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New Receipt
                </button>
            </div>
        </div>
        <div class="filters-bar">
            <span class="filter-chip active" data-status="" onclick="loadReceipts(event,'')">All</span>
            <span class="filter-chip" data-status="draft" onclick="loadReceipts(event,'draft')">Draft</span>
            <span class="filter-chip" data-status="ready" onclick="loadReceipts(event,'ready')">Ready</span>
            <span class="filter-chip" data-status="done" onclick="loadReceipts(event,'done')">Done</span>
            <span class="filter-chip" data-status="canceled" onclick="loadReceipts(event,'canceled')">Canceled</span>
        </div>
        <div class="table-container">
            <table class="data-table">
                <thead><tr>
                    <th>Reference</th><th>Supplier</th><th>Warehouse</th><th>Items</th><th>Status</th><th>Date</th><th>Actions</th>
                </tr></thead>
                <tbody id="receipts-tbody">
                    <tr><td colspan="7"><div class="empty-state"><div class="loading-spinner"></div><p>Loading...</p></div></td></tr>
                </tbody>
            </table>
        </div>
        <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.75rem;text-align:center">Click a row to open the receipt detail view</p>
    </div>`;
    await loadReceipts(null, '');
}

async function loadReceipts(event, status) {
    document.querySelectorAll('#page-content .filters-bar .filter-chip').forEach(c => c.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    try {
        const endpoint = status ? '/receipts?status=' + status : '/receipts';
        const receipts = await API.get(endpoint);
        const tbody = document.getElementById('receipts-tbody');
        if (!tbody) return;
        if (receipts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>No receipts found</p></div></td></tr>';
            return;
        }
        tbody.innerHTML = receipts.map(r => '<tr class="clickable-row" onclick="renderReceiptDetail(\'' + r.id + '\')">' +
            '<td><strong style="color:var(--text-accent)">' + escapeHTML(r.ref_number) + '</strong></td>' +
            '<td>' + escapeHTML(r.supplier_name || '—') + '</td>' +
            '<td>' + escapeHTML(r.warehouse_name) + '</td>' +
            '<td>' + r.items.length + ' item(s)</td>' +
            '<td>' + statusBadge(r.status) + '</td>' +
            '<td>' + formatDate(r.date_val || r.created_at) + '</td>' +
            '<td class="actions-cell" onclick="event.stopPropagation()">' +
                (r.status === 'draft' ? '<button class="btn btn-secondary btn-sm" onclick="markReceiptReady(\'' + r.id + '\',false)">→ Ready</button>' : '') +
                (r.status === 'ready' ? '<button class="btn btn-success btn-sm" onclick="validateReceipt(\'' + r.id + '\')">✓ Validate</button>' : '') +
                (r.status !== 'done' && r.status !== 'canceled' ? '<button class="btn btn-ghost btn-sm" onclick="deleteReceipt(\'' + r.id + '\')" style="color:var(--accent-danger)">✕</button>' : '') +
            '</td>' +
        '</tr>').join('');
    } catch (err) {
        showToast('Failed to load receipts', 'error');
    }
}


// ── DETAIL VIEW ────────────────────────────

async function renderReceiptDetail(id) {
    const content = document.getElementById('page-content');
    content.innerHTML = '<div class="animate-in">' +
        '<div style="margin-bottom:1.5rem">' +
            '<button class="btn btn-ghost" onclick="renderReceipts()" style="gap:6px;padding:6px 12px;font-size:0.82rem;color:var(--text-secondary)">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>' +
                'Back to Receipts' +
            '</button>' +
        '</div>' +
        '<div class="detail-card" id="receipt-detail-card">' +
            '<div class="detail-loading"><div class="loading-spinner"></div><p>Loading receipt...</p></div>' +
        '</div>' +
    '</div>';

    try {
        const r = await API.get('/receipts/' + id);
        renderReceiptDetailContent(r);
    } catch (err) {
        const card = document.getElementById('receipt-detail-card');
        if (card) card.innerHTML = '<div class="empty-state"><p style="color:var(--accent-danger)">Failed to load receipt</p></div>';
        showToast('Failed to load receipt details', 'error');
    }
}

function renderReceiptDetailContent(r) {
    const card = document.getElementById('receipt-detail-card');
    if (!card) return;
    const isDone = r.status === 'done';
    const isCanceled = r.status === 'canceled';
    const isEditable = !isDone && !isCanceled;

    card.innerHTML =
        // ── Top bar ──
        '<div class="detail-top-bar">' +
            '<div class="detail-actions">' +
                (r.status === 'draft' ?
                    '<button class="btn btn-secondary detail-btn" onclick="markReceiptReady(\'' + r.id + '\',true)">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="9 18 15 12 9 6"/></svg>Mark Ready</button>' : '') +
                (r.status === 'ready' ?
                    '<button class="btn btn-success detail-btn" id="validate-btn" onclick="handleDetailValidate(\'' + r.id + '\')">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>Validate</button>' : '') +
                (isDone ?
                    '<button class="btn btn-secondary detail-btn" onclick="window.open(\'/api/receipts/' + r.id + '/print\',\'_blank\')">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Print</button>' : '') +
                (isEditable ?
                    '<button class="btn btn-ghost detail-btn" style="color:var(--accent-danger)" onclick="cancelReceipt(\'' + r.id + '\')">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Cancel</button>' : '') +
            '</div>' +
            '<div class="stepper">' + buildStepperHTML(r.status) + '</div>' +
        '</div>' +

        // ── Document header ──
        '<div class="detail-header">' +
            '<div class="detail-title">' +
                '<div class="detail-title-icon">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
                '</div>' +
                '<span>' + escapeHTML(r.ref_number) + '</span>' +
            '</div>' +
            '<div class="detail-info-grid">' +
                '<div class="detail-info-group"><span class="detail-info-label">Receive From</span><span class="detail-info-value">' + escapeHTML(r.supplier_name || '—') + '</span></div>' +
                '<div class="detail-info-group"><span class="detail-info-label">Destination Warehouse</span><span class="detail-info-value">' + escapeHTML(r.warehouse_name) + '</span></div>' +
                '<div class="detail-info-group"><span class="detail-info-label">Scheduled Date</span><span class="detail-info-value">' + (r.date_val ? formatDateTime(r.date_val) : '—') + '</span></div>' +
                '<div class="detail-info-group"><span class="detail-info-label">Created At</span><span class="detail-info-value">' + formatDateTime(r.created_at) + '</span></div>' +
                (r.notes ? '<div class="detail-info-group" style="grid-column:1/-1"><span class="detail-info-label">Notes</span><span class="detail-info-value">' + escapeHTML(r.notes) + '</span></div>' : '') +
            '</div>' +
        '</div>' +

        // ── Products ──
        '<div class="detail-section">' +
            '<h3 class="detail-section-title">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>' +
                'Products to Receive' +
            '</h3>' +
            '<div class="table-container"><table class="data-table">' +
                '<thead><tr><th>Product</th><th>SKU</th><th style="text-align:right">Demand Qty</th><th style="text-align:right">Received</th></tr></thead>' +
                '<tbody>' +
                r.items.map(item =>
                    '<tr>' +
                    '<td><strong>' + escapeHTML(item.product_name) + '</strong></td>' +
                    '<td><code style="color:var(--text-accent);font-size:0.78rem">' + escapeHTML(item.product_sku) + '</code></td>' +
                    '<td style="text-align:right">' + item.qty_expected + '</td>' +
                    '<td style="text-align:right">' + (isDone ? '<strong style="color:var(--accent-secondary)">' + item.qty_received + '</strong>' : '<span style="color:var(--text-muted)">Pending</span>') + '</td>' +
                    '</tr>'
                ).join('') +
                '</tbody></table></div>' +
            (isDone ? '<div class="detail-done-banner">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
                'Receipt validated. Stock has been updated.' +
            '</div>' : '') +
        '</div>';
}

function buildStepperHTML(currentStatus) {
    const steps = [{key:'draft',label:'Draft'},{key:'ready',label:'Ready'},{key:'done',label:'Done'}];
    if (currentStatus === 'canceled') {
        return steps.map(s => '<div class="step step-canceled">' + s.label + '</div><div class="step-arrow">›</div>').join('') +
               '<div class="step step-active">Canceled</div>';
    }
    const order = ['draft','ready','done'];
    const idx = order.indexOf(currentStatus);
    return steps.map((s, i) => {
        let cls = 'step';
        if (i < idx) cls += ' step-done';
        else if (i === idx) cls += ' step-active';
        return '<div class="' + cls + '">' + (i < idx ? '✓ ' : '') + s.label + '</div>' +
               (i < steps.length - 1 ? '<div class="step-arrow">›</div>' : '');
    }).join('');
}

async function handleDetailValidate(id) {
    const btn = document.getElementById('validate-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Processing...'; }
    try {
        await API.put('/receipts/' + id + '/status?new_status=done');
        showToast('Receipt validated! Stock has been updated.', 'success');
        const r = await API.get('/receipts/' + id);
        renderReceiptDetailContent(r);
    } catch (err) {
        showToast(err.message || 'Validation failed', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '✓ Validate'; }
    }
}

async function markReceiptReady(id, fromDetail) {
    try {
        await API.put('/receipts/' + id + '/status?new_status=ready');
        showToast('Receipt marked as Ready', 'success');
        if (fromDetail) {
            const r = await API.get('/receipts/' + id);
            renderReceiptDetailContent(r);
        } else {
            await loadReceipts(null, '');
        }
    } catch (err) {
        showToast(err.message || 'Failed to update status', 'error');
    }
}

async function cancelReceipt(id) {
    if (!confirm('Cancel this receipt?')) return;
    try {
        await API.put('/receipts/' + id + '/status?new_status=canceled');
        showToast('Receipt canceled', 'warning');
        const r = await API.get('/receipts/' + id);
        renderReceiptDetailContent(r);
    } catch (err) {
        showToast(err.message || 'Cancel failed', 'error');
    }
}


// ── CREATE / DELETE ─────────────────────────

async function showCreateReceiptModal() {
    const [products, warehouses] = await Promise.all([API.get('/products'), API.get('/warehouses')]);
    const prodOpts = products.map(p => '<option value="' + p.id + '">' + escapeHTML(p.name) + ' (' + p.sku + ')</option>').join('');
    const whOpts = warehouses.map(w => '<option value="' + w.id + '">' + escapeHTML(w.name) + '</option>').join('');
    showModal('Create Receipt',
        '<form onsubmit="handleCreateReceipt(event)">' +
        '<div class="form-row">' +
            '<div class="form-group"><label>Supplier Name</label><input class="form-control" id="rcpt-supplier" required></div>' +
            '<div class="form-group"><label>Warehouse</label><select class="form-control" id="rcpt-wh" required>' + whOpts + '</select></div>' +
        '</div>' +
        '<div class="form-group"><label>Notes</label><textarea class="form-control" id="rcpt-notes" rows="2"></textarea></div>' +
        '<h4 style="margin:1rem 0 0.5rem;font-size:0.85rem;color:var(--text-secondary)">Items to Receive</h4>' +
        '<div id="rcpt-items"><div class="form-row" style="margin-bottom:0.5rem">' +
            '<div class="form-group" style="margin:0"><select class="form-control rcpt-prod">' + prodOpts + '</select></div>' +
            '<div class="form-group" style="margin:0"><input type="number" class="form-control rcpt-qty" placeholder="Qty" min="1" value="1"></div>' +
        '</div></div>' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="addReceiptItemRow()" style="margin-bottom:1rem">+ Add Item</button>' +
        '<div class="modal-actions" style="border:none;padding:1rem 0 0">' +
            '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
            '<button type="submit" class="btn btn-primary">Create Receipt</button>' +
        '</div></form>');
    window._rcptProdOpts = prodOpts;
}

function addReceiptItemRow() {
    const div = document.createElement('div');
    div.className = 'form-row';
    div.style.marginBottom = '0.5rem';
    div.innerHTML = '<div class="form-group" style="margin:0"><select class="form-control rcpt-prod">' + window._rcptProdOpts + '</select></div>' +
                    '<div class="form-group" style="margin:0"><input type="number" class="form-control rcpt-qty" placeholder="Qty" min="1" value="1"></div>';
    document.getElementById('rcpt-items').appendChild(div);
}

async function handleCreateReceipt(e) {
    e.preventDefault();
    const prods = document.querySelectorAll('.rcpt-prod');
    const qtys = document.querySelectorAll('.rcpt-qty');
    const items = [];
    prods.forEach((p, i) => items.push({ product_id: p.value, qty_expected: parseInt(qtys[i].value) || 1 }));
    try {
        const newReceipt = await API.post('/receipts', {
            supplier_name: document.getElementById('rcpt-supplier').value,
            warehouse_id: document.getElementById('rcpt-wh').value,
            notes: document.getElementById('rcpt-notes').value,
            items
        });
        closeModal();
        showToast('Receipt created! Opening detail view...', 'success');
        await renderReceiptDetail(newReceipt.id);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function validateReceipt(id) {
    if (!confirm('Validate this receipt? Stock will be updated.')) return;
    try {
        await API.put('/receipts/' + id + '/status?new_status=done');
        showToast('Receipt validated! Stock updated.', 'success');
        await loadReceipts(null, '');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteReceipt(id) {
    if (!confirm('Delete this receipt?')) return;
    try {
        await API.delete('/receipts/' + id);
        showToast('Receipt deleted', 'success');
        await loadReceipts(null, '');
    } catch (err) {
        showToast(err.message, 'error');
    }
}