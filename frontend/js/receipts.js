// ============================================
// receipts.js — Incoming goods management
// Spec: List + Kanban views, search, detail
// ============================================

let _receiptsCache = [];
let _receiptsView = 'list'; // 'list' | 'kanban'


// ══════════════════════════════════════════
//  MAIN RENDER — List landing page
// ══════════════════════════════════════════

async function renderReceipts() {
    const content = document.getElementById('page-content');
    content.innerHTML = `
    <div class="animate-in">

        <!-- Page header -->
        <div class="rcpt-page-header">
            <button class="btn btn-primary rcpt-new-btn" onclick="showCreateReceiptModal()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New
            </button>
            <h1 class="rcpt-title">Receipts</h1>

            <!-- Search -->
            <div class="rcpt-search-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="rcpt-search" placeholder="Search by reference or contact..." oninput="filterReceipts()">
            </div>

            <!-- View toggle -->
            <div class="rcpt-view-toggle">
                <button id="toggle-list" class="rcpt-toggle-btn active" title="List view" onclick="switchReceiptsView('list')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
                <button id="toggle-kanban" class="rcpt-toggle-btn" title="Kanban view" onclick="switchReceiptsView('kanban')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                </button>
            </div>
        </div>

        <!-- Content area (list or kanban renders here) -->
        <div id="rcpt-content-area">
            <div class="rcpt-loading"><div class="loading-spinner"></div><span>Loading receipts...</span></div>
        </div>

    </div>`;

    await loadAllReceipts();
}


// ══════════════════════════════════════════
//  DATA LOADING
// ══════════════════════════════════════════

async function loadAllReceipts() {
    try {
        _receiptsCache = await API.get('/receipts');
        renderReceiptsContent(_receiptsCache);
    } catch (err) {
        showToast('Failed to load receipts', 'error');
    }
}

function filterReceipts() {
    const q = (document.getElementById('rcpt-search')?.value || '').toLowerCase();
    const filtered = _receiptsCache.filter(r =>
        r.ref_number.toLowerCase().includes(q) ||
        (r.supplier_name || '').toLowerCase().includes(q)
    );
    renderReceiptsContent(filtered);
}

function switchReceiptsView(view) {
    _receiptsView = view;
    document.getElementById('toggle-list')?.classList.toggle('active', view === 'list');
    document.getElementById('toggle-kanban')?.classList.toggle('active', view === 'kanban');
    const q = (document.getElementById('rcpt-search')?.value || '').toLowerCase();
    const filtered = q
        ? _receiptsCache.filter(r => r.ref_number.toLowerCase().includes(q) || (r.supplier_name||'').toLowerCase().includes(q))
        : _receiptsCache;
    renderReceiptsContent(filtered);
}

function renderReceiptsContent(receipts) {
    if (_receiptsView === 'kanban') {
        renderKanban(receipts);
    } else {
        renderListView(receipts);
    }
}


// ══════════════════════════════════════════
//  LIST VIEW
// ══════════════════════════════════════════

function renderListView(receipts) {
    const area = document.getElementById('rcpt-content-area');
    if (!area) return;

    if (receipts.length === 0) {
        area.innerHTML = '<div class="empty-state" style="padding:4rem"><p>No receipts found</p></div>';
        return;
    }

    area.innerHTML = `
    <div class="table-container">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Reference</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Contact</th>
                    <th>Schedule Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody id="receipts-tbody">
                ${receipts.map(r => renderReceiptRow(r)).join('')}
            </tbody>
        </table>
    </div>
    <p style="font-size:0.73rem;color:var(--text-muted);margin-top:0.75rem;text-align:center">
        Click a row to open the receipt detail view
    </p>`;
}

function renderReceiptRow(r) {
    const fromLoc  = 'Vendors';
    const toLoc    = r.warehouse_code ? r.warehouse_code + '/Stock' : r.warehouse_name;
    const contact  = r.supplier_name || '—';
    const schedDate = r.date_val ? formatDate(r.date_val) : '—';

    return `<tr class="clickable-row" onclick="renderReceiptDetail('${r.id}')">
        <td>
            <span style="font-family:monospace;font-size:0.82rem;font-weight:700;color:var(--text-accent)">
                ${escapeHTML(r.ref_number)}
            </span>
        </td>
        <td>
            <div style="display:flex;align-items:center;gap:6px;color:var(--text-secondary)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                ${escapeHTML(fromLoc)}
            </div>
        </td>
        <td>
            <div style="display:flex;align-items:center;gap:6px;font-weight:600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                ${escapeHTML(toLoc)}
            </div>
        </td>
        <td>${escapeHTML(contact)}</td>
        <td style="color:var(--text-secondary)">${schedDate}</td>
        <td>${statusBadge(r.status)}</td>
        <td class="actions-cell" onclick="event.stopPropagation()">
            ${r.status === 'draft'
                ? `<button class="btn btn-secondary btn-sm" onclick="markReceiptReady('${r.id}',false)">→ Ready</button>`
                : ''}
            ${r.status === 'ready'
                ? `<button class="btn btn-success btn-sm" onclick="quickValidateReceipt('${r.id}')">✓ Validate</button>`
                : ''}
            ${r.status !== 'done' && r.status !== 'canceled'
                ? `<button class="btn btn-ghost btn-sm" onclick="deleteReceipt('${r.id}')" style="color:var(--accent-danger)" title="Delete">✕</button>`
                : ''}
        </td>
    </tr>`;
}


// ══════════════════════════════════════════
//  KANBAN VIEW
// ══════════════════════════════════════════

function renderKanban(receipts) {
    const area = document.getElementById('rcpt-content-area');
    if (!area) return;

    const columns = [
        { key: 'draft',    label: 'Draft',    color: '#636E72', bg: 'rgba(99,110,114,0.08)'   },
        { key: 'ready',    label: 'Ready',    color: '#0984E3', bg: 'rgba(9,132,227,0.08)'    },
        { key: 'done',     label: 'Done',     color: '#00B894', bg: 'rgba(0,184,148,0.08)'    },
        { key: 'canceled', label: 'Canceled', color: '#E17055', bg: 'rgba(225,112,85,0.08)'   },
    ];

    area.innerHTML = `<div class="kanban-board">
        ${columns.map(col => {
            const colReceipts = receipts.filter(r => r.status === col.key);
            return `
            <div class="kanban-col">
                <div class="kanban-col-header" style="border-top:3px solid ${col.color};background:${col.bg}">
                    <span class="kanban-col-label" style="color:${col.color}">${col.label}</span>
                    <span class="kanban-col-count" style="background:${col.color}20;color:${col.color}">${colReceipts.length}</span>
                </div>
                <div class="kanban-cards">
                    ${colReceipts.length === 0
                        ? `<div class="kanban-empty">No receipts</div>`
                        : colReceipts.map(r => renderKanbanCard(r)).join('')
                    }
                </div>
            </div>`;
        }).join('')}
    </div>`;
}

function renderKanbanCard(r) {
    const toLoc = r.warehouse_code ? r.warehouse_code + '/Stock' : r.warehouse_name;
    return `
    <div class="kanban-card" onclick="renderReceiptDetail('${r.id}')">
        <div class="kanban-card-ref">${escapeHTML(r.ref_number)}</div>
        <div class="kanban-card-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>${escapeHTML(r.supplier_name || '—')}</span>
        </div>
        <div class="kanban-card-row">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            <span>${escapeHTML(toLoc)}</span>
        </div>
        <div class="kanban-card-footer">
            <span class="kanban-items-badge">${r.items.length} item(s)</span>
            <span class="kanban-date">${r.date_val ? formatDate(r.date_val) : '—'}</span>
        </div>
    </div>`;
}


// ══════════════════════════════════════════
//  DETAIL VIEW
// ══════════════════════════════════════════

async function renderReceiptDetail(id) {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div style="margin-bottom:1.5rem">
            <button class="btn btn-ghost" onclick="renderReceipts()" style="gap:6px;padding:6px 12px;font-size:0.82rem;color:var(--text-secondary)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
                Back to Receipts
            </button>
        </div>
        <div class="detail-card" id="receipt-detail-card">
            <div class="detail-loading"><div class="loading-spinner"></div><p>Loading receipt...</p></div>
        </div>
    </div>`;

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
    const isDone     = r.status === 'done';
    const isCanceled = r.status === 'canceled';
    const isEditable = !isDone && !isCanceled;
    const fromLoc    = 'Vendors';
    const toLoc      = r.warehouse_code ? r.warehouse_code + '/Stock' : r.warehouse_name;

    card.innerHTML =
        // ── Top action bar ──────────────────
        '<div class="detail-top-bar">' +
            '<div class="detail-actions">' +
                (r.status === 'draft'
                    ? '<button class="btn btn-secondary detail-btn" onclick="markReceiptReady(\'' + r.id + '\',true)">' +
                      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="9 18 15 12 9 6"/></svg>Mark Ready</button>' : '') +
                (r.status === 'ready'
                    ? '<button class="btn btn-success detail-btn" id="validate-btn" onclick="handleDetailValidate(\'' + r.id + '\')">' +
                      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="20 6 9 17 4 12"/></svg>Validate</button>' : '') +
                (isDone
                    ? '<button class="btn btn-secondary detail-btn" onclick="window.open(\'/api/receipts/' + r.id + '/print\',\'_blank\')">' +
                      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Print</button>' : '') +
                (isEditable
                    ? '<button class="btn btn-ghost detail-btn" style="color:var(--accent-danger)" onclick="cancelReceipt(\'' + r.id + '\')">' +
                      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Cancel</button>' : '') +
            '</div>' +
            '<div class="stepper">' + buildStepperHTML(r.status) + '</div>' +
        '</div>' +

        // ── Document title ───────────────────
        '<div class="detail-header">' +
            '<div class="detail-title">' +
                '<div class="detail-title-icon">' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
                '</div>' +
                '<span>' + escapeHTML(r.ref_number) + '</span>' +
            '</div>' +
            '<div class="detail-info-grid">' +
                '<div class="detail-info-group"><span class="detail-info-label">Receive From (Source)</span>' +
                    '<span class="detail-info-value">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="color:var(--text-muted)"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>' +
                        escapeHTML(fromLoc) +
                    '</span></div>' +
                '<div class="detail-info-group"><span class="detail-info-label">Destination (To)</span>' +
                    '<span class="detail-info-value">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="color:var(--text-muted)"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' +
                        escapeHTML(toLoc) +
                    '</span></div>' +
                '<div class="detail-info-group"><span class="detail-info-label">Contact (Supplier)</span>' +
                    '<span class="detail-info-value">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" style="color:var(--text-muted)"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
                        escapeHTML(r.supplier_name || '—') +
                    '</span></div>' +
                '<div class="detail-info-group"><span class="detail-info-label">Schedule Date</span>' +
                    '<span class="detail-info-value">' + (r.date_val ? formatDate(r.date_val) : '—') + '</span></div>' +
                '<div class="detail-info-group"><span class="detail-info-label">Created At</span>' +
                    '<span class="detail-info-value">' + formatDateTime(r.created_at) + '</span></div>' +
                (function(){ var u=JSON.parse(localStorage.getItem("ims_user")||"{}"); var name=u.name||u.email||"Operator"; return '<div class="detail-info-group"><span class="detail-info-label">Responsible</span><span class="detail-info-value">' + escapeHTML(name) + '</span></div>'; })() +
                (r.notes
                    ? '<div class="detail-info-group" style="grid-column:1/-1"><span class="detail-info-label">Notes</span>' +
                      '<span class="detail-info-value">' + escapeHTML(r.notes) + '</span></div>'
                    : '') +
            '</div>' +
        '</div>' +

        // ── Products table ───────────────────
        '<div class="detail-section">' +
            '<h3 class="detail-section-title">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>' +
                'Products to Receive' +
            '</h3>' +
            '<div class="table-container">' +
                '<table class="data-table">' +
                    '<thead><tr><th>Product</th><th>SKU</th><th style="text-align:right">Demand Qty</th><th style="text-align:right">Done</th></tr></thead>' +
                    '<tbody>' +
                    r.items.map(item =>
                        '<tr>' +
                        '<td><strong>' + escapeHTML(item.product_name) + '</strong></td>' +
                        '<td><code style="color:var(--text-accent);font-size:0.78rem">' + escapeHTML(item.product_sku) + '</code></td>' +
                        '<td style="text-align:right">' + item.qty_expected + '</td>' +
                        '<td style="text-align:right">' +
                            (isDone
                                ? '<strong style="color:var(--accent-secondary)">' + item.qty_received + '</strong>'
                                : '<span style="color:var(--text-muted)">—</span>') +
                        '</td></tr>'
                    ).join('') +
                    '</tbody>' +
                '</table>' +
            '</div>' +
            (isDone
                ? '<div class="detail-done-banner">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' +
                  'Receipt validated — stock levels have been updated.' +
                  '</div>'
                : '') +
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
        let cls = 'step' + (i < idx ? ' step-done' : i === idx ? ' step-active' : '');
        return '<div class="' + cls + '">' + (i < idx ? '✓ ' : '') + s.label + '</div>' +
               (i < steps.length - 1 ? '<div class="step-arrow">›</div>' : '');
    }).join('');
}


// ══════════════════════════════════════════
//  ACTION HANDLERS
// ══════════════════════════════════════════

async function handleDetailValidate(id) {
    const btn = document.getElementById('validate-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Processing...'; }
    try {
        await API.put('/receipts/' + id + '/status?new_status=done');
        showToast('Receipt validated! Stock updated.', 'success');
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
            await loadAllReceipts();
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

async function quickValidateReceipt(id) {
    if (!confirm('Validate this receipt? Stock will be updated.')) return;
    try {
        await API.put('/receipts/' + id + '/status?new_status=done');
        showToast('Receipt validated! Stock updated.', 'success');
        await loadAllReceipts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteReceipt(id) {
    if (!confirm('Delete this receipt?')) return;
    try {
        await API.delete('/receipts/' + id);
        showToast('Receipt deleted', 'success');
        await loadAllReceipts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}


// ══════════════════════════════════════════
//  CREATE RECEIPT MODAL
// ══════════════════════════════════════════

async function showCreateReceiptModal() {
    const [products, warehouses] = await Promise.all([API.get('/products'), API.get('/warehouses')]);
    const prodOpts = products.map(p => '<option value="' + p.id + '">' + escapeHTML(p.name) + ' (' + p.sku + ')</option>').join('');
    const whOpts   = warehouses.map(w => '<option value="' + w.id + '">' + escapeHTML(w.name) + '</option>').join('');

    showModal('New Receipt', `
        <form onsubmit="handleCreateReceipt(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>Contact (Supplier)</label>
                    <input class="form-control" id="rcpt-supplier" placeholder="e.g. Azure Interior" required>
                </div>
                <div class="form-group">
                    <label>Destination Warehouse</label>
                    <select class="form-control" id="rcpt-wh" required>${whOpts}</select>
                </div>
            </div>
            <div class="form-group">
                <label>Schedule Date</label>
                <input type="date" class="form-control" id="rcpt-date">
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea class="form-control" id="rcpt-notes" rows="2" placeholder="Optional notes..."></textarea>
            </div>
            <h4 style="margin:1rem 0 0.5rem;font-size:0.82rem;color:var(--text-secondary);display:flex;align-items:center;gap:6px">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                Products to Receive
            </h4>
            <div id="rcpt-items">
                <div class="rcpt-item-row">
                    <select class="form-control rcpt-prod">${prodOpts}</select>
                    <input type="number" class="form-control rcpt-qty" placeholder="Qty" min="1" value="1" style="max-width:90px">
                    <button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('.rcpt-item-row').remove()" style="color:var(--accent-danger);padding:6px">✕</button>
                </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="addReceiptItemRow()" style="margin:0.75rem 0 1.25rem;gap:6px">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Product Line
            </button>
            <div class="modal-actions" style="border:none;padding:1rem 0 0">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Receipt</button>
            </div>
        </form>`, 'large');
    window._rcptProdOpts = prodOpts;
}

function addReceiptItemRow() {
    const container = document.getElementById('rcpt-items');
    const div = document.createElement('div');
    div.className = 'rcpt-item-row';
    div.innerHTML = '<select class="form-control rcpt-prod">' + window._rcptProdOpts + '</select>' +
        '<input type="number" class="form-control rcpt-qty" placeholder="Qty" min="1" value="1" style="max-width:90px">' +
        '<button type="button" class="btn btn-ghost btn-sm" onclick="this.closest(\'.rcpt-item-row\').remove()" style="color:var(--accent-danger);padding:6px">✕</button>';
    container.appendChild(div);
}

async function handleCreateReceipt(e) {
    e.preventDefault();
    const prods = document.querySelectorAll('.rcpt-prod');
    const qtys  = document.querySelectorAll('.rcpt-qty');
    const items = [];
    prods.forEach((p, i) => items.push({ product_id: p.value, qty_expected: parseInt(qtys[i].value) || 1 }));
    try {
        const newReceipt = await API.post('/receipts', {
            supplier_name: document.getElementById('rcpt-supplier').value,
            warehouse_id:  document.getElementById('rcpt-wh').value,
            notes:         document.getElementById('rcpt-notes').value,
            items
        });
        closeModal();
        showToast('Receipt created!', 'success');
        await renderReceiptDetail(newReceipt.id);
    } catch (err) {
        showToast(err.message, 'error');
    }
}