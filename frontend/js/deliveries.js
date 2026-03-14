// ============================================
// deliveries.js — Delivery Orders
// Spec: List (Ref,From,To,Contact,Date,Status) + Kanban
//       Detail: Draft>Waiting>Ready>Done stepper
//       Stock alert (red row if out of stock)
// ============================================



let _deliveriesCache = [];
let _deliveriesView  = 'list';

async function renderDeliveries() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="rcpt-page-header">
            <button class="btn btn-primary rcpt-new-btn" onclick="showCreateDeliveryModal()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New
            </button>
            <h1 class="rcpt-title">Delivery</h1>
            <div class="rcpt-search-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="del-search" placeholder="Search by reference or contact..." oninput="filterDeliveries()">
            </div>
            <div class="rcpt-view-toggle">
                <button id="del-toggle-list" class="rcpt-toggle-btn active" title="List view" onclick="switchDeliveriesView('list')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
                <button id="del-toggle-kanban" class="rcpt-toggle-btn" title="Kanban view" onclick="switchDeliveriesView('kanban')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                </button>
            </div>
        </div>
        <div id="del-content">
            <div class="rcpt-loading"><div class="loading-spinner"></div><span>Loading deliveries...</span></div>
        </div>
    </div>`;
    await loadAllDeliveries();
}

async function loadAllDeliveries() {
    try {
        _deliveriesCache = await API.get('/deliveries');
        renderDeliveriesContent(_deliveriesCache);
    } catch (err) {
        showToast('Failed to load deliveries', 'error');
    }
}

function filterDeliveries() {
    const q = (document.getElementById('del-search')?.value || '').toLowerCase();
    const filtered = _deliveriesCache.filter(d =>
        d.ref_number.toLowerCase().includes(q) ||
        (d.customer_name || '').toLowerCase().includes(q)
    );
    renderDeliveriesContent(filtered);
}

function switchDeliveriesView(view) {
    _deliveriesView = view;
    document.getElementById('del-toggle-list')?.classList.toggle('active', view === 'list');
    document.getElementById('del-toggle-kanban')?.classList.toggle('active', view === 'kanban');
    const q = (document.getElementById('del-search')?.value || '').toLowerCase();
    const filtered = q ? _deliveriesCache.filter(d =>
        d.ref_number.toLowerCase().includes(q) || (d.customer_name || '').toLowerCase().includes(q)
    ) : _deliveriesCache;
    renderDeliveriesContent(filtered);
}

function renderDeliveriesContent(deliveries) {
    if (_deliveriesView === 'kanban') renderDeliveriesKanban(deliveries);
    else renderDeliveriesList(deliveries);
}


// ── LIST VIEW ──────────────────────────────

function renderDeliveriesList(deliveries) {
    const area = document.getElementById('del-content');
    if (!area) return;

    if (deliveries.length === 0) {
        area.innerHTML = '<div class="empty-state" style="padding:4rem"><p>No deliveries found</p></div>';
        return;
    }

    area.innerHTML = `<div class="table-container">
        <table class="data-table">
            <thead><tr>
                <th>Reference</th><th>From</th><th>To</th><th>Contact</th><th>Schedule Date</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
                ${deliveries.map(d => {
                    const fromLoc = (d.warehouse_code || 'WH') + '/Stock';
                    const toLoc   = 'Customer';
                    return `<tr class="clickable-row" onclick="renderDeliveryDetail('${d.id}')">
                        <td><span style="font-family:monospace;font-size:0.82rem;font-weight:700;color:var(--text-accent)">${escapeHTML(d.ref_number)}</span></td>
                        <td><span class="loc-tag loc-tag-from">${escapeHTML(fromLoc)}</span></td>
                        <td><span class="loc-tag loc-tag-to">${escapeHTML(toLoc)}</span></td>
                        <td>${escapeHTML(d.customer_name || '—')}</td>
                        <td style="color:var(--text-secondary)">${d.date_val ? formatDate(d.date_val) : '—'}</td>
                        <td>${statusBadge(d.status)}</td>
                        <td class="actions-cell" onclick="event.stopPropagation()">
                            ${d.status === 'draft' ? `<button class="btn btn-secondary btn-sm" onclick="advanceDelivery('${d.id}','waiting')">→ Wait</button>` : ''}
                            ${d.status === 'waiting' ? `<button class="btn btn-secondary btn-sm" onclick="advanceDelivery('${d.id}','ready')">→ Ready</button>` : ''}
                            ${d.status === 'ready' ? `<button class="btn btn-success btn-sm" onclick="quickValidateDelivery('${d.id}')">✓ Validate</button>` : ''}
                            ${d.status !== 'done' && d.status !== 'canceled' ? `<button class="btn btn-ghost btn-sm" onclick="deleteDelivery('${d.id}')" style="color:var(--accent-danger)">✕</button>` : ''}
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>
    <p style="font-size:0.73rem;color:var(--text-muted);margin-top:0.75rem;text-align:center">Click a row to open the delivery detail view</p>`;
}


// ── KANBAN VIEW ────────────────────────────

function renderDeliveriesKanban(deliveries) {
    const area = document.getElementById('del-content');
    const cols = [
        { key: 'draft',    label: 'Draft',    color: '#636E72', bg: 'rgba(99,110,114,0.08)'  },
        { key: 'waiting',  label: 'Waiting',  color: '#FDCB6E', bg: 'rgba(253,203,110,0.08)' },
        { key: 'ready',    label: 'Ready',    color: '#0984E3', bg: 'rgba(9,132,227,0.08)'   },
        { key: 'done',     label: 'Done',     color: '#00B894', bg: 'rgba(0,184,148,0.08)'   },
    ];
    area.innerHTML = `<div class="kanban-board">
        ${cols.map(col => {
            const items = deliveries.filter(d => d.status === col.key);
            return `<div class="kanban-col">
                <div class="kanban-col-header" style="border-top:3px solid ${col.color};background:${col.bg}">
                    <span class="kanban-col-label" style="color:${col.color}">${col.label}</span>
                    <span class="kanban-col-count" style="background:${col.color}20;color:${col.color}">${items.length}</span>
                </div>
                <div class="kanban-cards">
                    ${items.length === 0 ? '<div class="kanban-empty">No deliveries</div>' : items.map(d => {
                        const fromLoc = (d.warehouse_code || 'WH') + '/Stock';
                        return `<div class="kanban-card" onclick="renderDeliveryDetail('${d.id}')">
                            <div class="kanban-card-ref">${escapeHTML(d.ref_number)}</div>
                            <div class="kanban-card-row">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                ${escapeHTML(d.customer_name || '—')}
                            </div>
                            <div class="kanban-card-row">
                                <span class="loc-tag loc-tag-from" style="font-size:0.68rem">${escapeHTML(fromLoc)}</span>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                <span class="loc-tag loc-tag-to" style="font-size:0.68rem">Customer</span>
                            </div>
                            <div class="kanban-card-footer">
                                <span class="kanban-items-badge">${d.items.length} item(s)</span>
                                <span class="kanban-date">${d.date_val ? formatDate(d.date_val) : '—'}</span>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        }).join('')}
    </div>`;
}


// ── DETAIL VIEW ────────────────────────────

async function renderDeliveryDetail(id) {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div style="margin-bottom:1.5rem">
            <button class="btn btn-ghost" onclick="renderDeliveries()" style="gap:6px;padding:6px 12px;font-size:0.82rem;color:var(--text-secondary)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
                Back to Deliveries
            </button>
        </div>
        <div class="detail-card" id="del-detail-card">
            <div class="detail-loading"><div class="loading-spinner"></div><p>Loading delivery...</p></div>
        </div>
    </div>`;
    try {
        const d = await API.get('/deliveries/' + id);
        renderDeliveryDetailContent(d);
    } catch (err) {
        document.getElementById('del-detail-card').innerHTML = '<div class="empty-state"><p style="color:var(--accent-danger)">Failed to load delivery</p></div>';
        showToast('Failed to load delivery', 'error');
    }
}

function renderDeliveryDetailContent(d) {
    const card = document.getElementById('del-detail-card');
    if (!card) return;

    const isDone     = d.status === 'done';
    const isCanceled = d.status === 'canceled';
    const isEditable = !isDone && !isCanceled;
    const fromLoc    = (d.warehouse_code || 'WH') + '/Stock';
    const currentUser = JSON.parse(localStorage.getItem('ims_user') || '{}');
    const responsible = currentUser.name || currentUser.email || 'Operator';

    // Delivery stepper: Draft > Waiting > Ready > Done
    const stepOrder = ['draft', 'waiting', 'ready', 'done'];
    const stepIdx   = stepOrder.indexOf(d.status);

    const stepperHTML = isCanceled
        ? stepOrder.map(s => `<div class="step step-canceled">${s.charAt(0).toUpperCase()+s.slice(1)}</div><div class="step-arrow">›</div>`).join('') + '<div class="step step-active">Canceled</div>'
        : stepOrder.map((s, i) => {
            let cls = 'step' + (i < stepIdx ? ' step-done' : i === stepIdx ? ' step-active' : '');
            return `<div class="${cls}">${i < stepIdx ? '✓ ' : ''}${s.charAt(0).toUpperCase()+s.slice(1)}</div>` +
                   (i < stepOrder.length - 1 ? '<div class="step-arrow">›</div>' : '');
          }).join('');

    card.innerHTML =
        // ── Top bar ──
        '<div class="detail-top-bar">' +
            '<div class="detail-actions">' +
                (d.status === 'draft'
                    ? `<button class="btn btn-secondary detail-btn" onclick="advanceDelivery('${d.id}','waiting',true)">→ Mark Waiting</button>` : '') +
                (d.status === 'waiting'
                    ? `<button class="btn btn-secondary detail-btn" onclick="advanceDelivery('${d.id}','ready',true)">→ Mark Ready</button>` : '') +
                (d.status === 'ready'
                    ? `<button class="btn btn-success detail-btn" id="del-validate-btn" onclick="handleDeliveryValidate('${d.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="20 6 9 17 4 12"/></svg>Validate</button>` : '') +
                (isDone
                    ? `<button class="btn btn-secondary detail-btn" onclick="window.open('/api/deliveries/${d.id}/print','_blank')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Print</button>` : '') +
                (isEditable
                    ? `<button class="btn btn-ghost detail-btn" style="color:var(--accent-danger)" onclick="cancelDelivery('${d.id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Cancel</button>` : '') +
            '</div>' +
            '<div class="stepper">' + stepperHTML + '</div>' +
        '</div>' +

        // ── Document header ──
        '<div class="detail-header">' +
            '<div class="detail-title">' +
                '<div class="detail-title-icon" style="background:rgba(9,132,227,0.12);color:#74B9FF">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' +
                '</div>' +
                '<span>' + escapeHTML(d.ref_number) + '</span>' +
            '</div>' +
            '<div class="detail-info-grid">' +
                '<div class="detail-info-group"><span class="detail-info-label">Delivery Address</span>' +
                    '<span class="detail-info-value">' + escapeHTML(d.customer_name || '—') + '</span></div>' +
                '<div class="detail-info-group"><span class="detail-info-label">Schedule Date</span>' +
                    '<span class="detail-info-value">' + (d.date_val ? formatDate(d.date_val) : '—') + '</span></div>' +
                '<div class="detail-info-group"><span class="detail-info-label">Responsible</span>' +
                    '<span class="detail-info-value">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="color:var(--text-muted)"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                        escapeHTML(responsible) +
                    '</span></div>' +
                '<div class="detail-info-group"><span class="detail-info-label">Operation Type</span>' +
                    '<span class="detail-info-value">Outgoing Shipment</span></div>' +
            '</div>' +
        '</div>' +

        // ── Products ──
        '<div class="detail-section">' +
            '<h3 class="detail-section-title">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>' +
                'Products' +
            '</h3>' +
            '<div class="table-container"><table class="data-table">' +
                '<thead><tr><th>Product</th><th style="text-align:right">Quantity</th><th>Stock Alert</th></tr></thead>' +
                '<tbody>' +
                d.items.map(item => {
                    const outOfStock = item.out_of_stock;
                    const rowStyle   = outOfStock ? 'background:rgba(225,112,85,0.08);' : '';
                    return `<tr style="${rowStyle}">
                        <td>
                            <div style="display:flex;align-items:center;gap:8px">
                                ${outOfStock ? '<svg viewBox="0 0 24 24" fill="none" stroke="#E17055" stroke-width="2" width="14" height="14"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' : ''}
                                <span><strong>[${escapeHTML(item.product_sku || '')}]</strong> ${escapeHTML(item.product_name)}</span>
                            </div>
                        </td>
                        <td style="text-align:right;font-weight:600">${item.qty}</td>
                        <td>${outOfStock
                            ? '<span class="status-badge badge-out-of-stock">Out of Stock</span>'
                            : `<span style="color:var(--accent-secondary);font-size:0.78rem">✓ Avail: ${item.qty_available}</span>`}</td>
                    </tr>`;
                }).join('') +
                '</tbody></table></div>' +

            (d.status === 'waiting' && d.items.some(i => i.out_of_stock) ?
                '<div class="detail-done-banner" style="background:rgba(225,112,85,0.08);border-color:rgba(225,112,85,0.25);color:#E17055;margin-top:1rem">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
                'Waiting — some products are out of stock. Restock via Receipts to proceed.' +
                '</div>' : '') +

            (isDone ? '<div class="detail-done-banner">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
                'Delivery validated — stock has been deducted.' +
                '</div>' : '') +
        '</div>';
}


// ── ACTION HANDLERS ────────────────────────

async function advanceDelivery(id, newStatus, fromDetail = false) {
    try {
        await API.put('/deliveries/' + id + '/status?new_status=' + newStatus);
        showToast('Status updated to ' + newStatus, 'success');
        if (fromDetail) {
            const d = await API.get('/deliveries/' + id);
            renderDeliveryDetailContent(d);
        } else {
            await loadAllDeliveries();
        }
    } catch (err) {
        showToast(err.message || 'Failed', 'error');
    }
}

async function handleDeliveryValidate(id) {
    const btn = document.getElementById('del-validate-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Processing...'; }
    try {
        await API.put('/deliveries/' + id + '/status?new_status=done');
        showToast('Delivery validated! Stock deducted.', 'success');
        const d = await API.get('/deliveries/' + id);
        renderDeliveryDetailContent(d);
    } catch (err) {
        showToast(err.message || 'Validation failed', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '✓ Validate'; }
    }
}

async function cancelDelivery(id) {
    if (!confirm('Cancel this delivery?')) return;
    try {
        await API.put('/deliveries/' + id + '/status?new_status=canceled');
        showToast('Delivery canceled', 'warning');
        const d = await API.get('/deliveries/' + id);
        renderDeliveryDetailContent(d);
    } catch (err) {
        showToast(err.message || 'Cancel failed', 'error');
    }
}

async function quickValidateDelivery(id) {
    if (!confirm('Validate delivery? Stock will decrease.')) return;
    try {
        await API.put('/deliveries/' + id + '/status?new_status=done');
        showToast('Delivery validated! Stock updated.', 'success');
        await loadAllDeliveries();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteDelivery(id) {
    if (!confirm('Delete this delivery?')) return;
    try {
        await API.delete('/deliveries/' + id);
        showToast('Delivery deleted', 'success');
        await loadAllDeliveries();
    } catch (err) {
        showToast(err.message, 'error');
    }
}


// ── CREATE MODAL ───────────────────────────

async function showCreateDeliveryModal() {
    const [products, warehouses] = await Promise.all([API.get('/products'), API.get('/warehouses')]);
    const prodOpts = products.map(p =>
        '<option value="' + p.id + '">[' + p.sku + '] ' + escapeHTML(p.name) + ' — Stock: ' + p.total_stock + '</option>'
    ).join('');
    const whOpts = warehouses.map(w => '<option value="' + w.id + '">' + escapeHTML(w.name) + '</option>').join('');

    showModal('New Delivery Order', `
        <form onsubmit="handleCreateDelivery(event)">
            <div class="form-row">
                <div class="form-group"><label>Delivery Address / Customer</label><input class="form-control" id="del-customer" placeholder="Customer name or address" required></div>
                <div class="form-group"><label>From Warehouse</label><select class="form-control" id="del-wh" required>${whOpts}</select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Schedule Date</label><input type="date" class="form-control" id="del-date"></div>
                <div class="form-group"><label>Notes</label><input class="form-control" id="del-notes" placeholder="Optional..."></div>
            </div>
            <h4 style="margin:1rem 0 0.5rem;font-size:0.82rem;color:var(--text-secondary)">Products</h4>
            <div id="del-items">
                <div class="rcpt-item-row">
                    <select class="form-control del-prod">${prodOpts}</select>
                    <input type="number" class="form-control del-qty" placeholder="Qty" min="1" value="1" style="max-width:90px">
                    <button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('.rcpt-item-row').remove()" style="color:var(--accent-danger);padding:6px">✕</button>
                </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="addDeliveryItemRow()" style="margin:0.75rem 0 1.25rem">+ Add Product</button>
            <div class="modal-actions" style="border:none;padding:1rem 0 0">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Delivery</button>
            </div>
        </form>`, 'large');
    window._delProdOpts = prodOpts;
}

function addDeliveryItemRow() {
    const div = document.createElement('div');
    div.className = 'rcpt-item-row';
    div.innerHTML = '<select class="form-control del-prod">' + window._delProdOpts + '</select>' +
        '<input type="number" class="form-control del-qty" placeholder="Qty" min="1" value="1" style="max-width:90px">' +
        '<button type="button" class="btn btn-ghost btn-sm" onclick="this.closest(\'.rcpt-item-row\').remove()" style="color:var(--accent-danger);padding:6px">✕</button>';
    document.getElementById('del-items').appendChild(div);
}

async function handleCreateDelivery(e) {
    e.preventDefault();
    const prods = document.querySelectorAll('.del-prod');
    const qtys  = document.querySelectorAll('.del-qty');
    const items = [];
    prods.forEach((p, i) => items.push({ product_id: p.value, qty: parseInt(qtys[i].value) || 1 }));
    try {
        const newDel = await API.post('/deliveries', {
            customer_name: document.getElementById('del-customer').value,
            warehouse_id:  document.getElementById('del-wh').value,
            notes:         document.getElementById('del-notes').value,
            items
        });
        closeModal();
        showToast('Delivery created!', 'success');
        await renderDeliveryDetail(newDel.id);
    } catch (err) {
        showToast(err.message, 'error');
    }
}
