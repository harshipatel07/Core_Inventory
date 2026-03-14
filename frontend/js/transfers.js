// ============================================
// transfers.js — Internal stock transfers
// Warehouse-to-warehouse + location-level
// Status: Draft → Done | Cancel
// ============================================

async function renderTransfers() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="page-header">
            <h1>🔀 Internal Transfers</h1>
            <div class="page-header-actions">
                <input type="text" id="transfer-search" class="form-control" placeholder="Search reference..." style="width:200px" oninput="searchTransfers(this.value)">
                <button class="btn btn-primary" onclick="showCreateTransferModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New Transfer
                </button>
            </div>
        </div>
        <div class="filters-bar">
            <span class="filter-chip active" onclick="loadTransfers('',this)">All</span>
            <span class="filter-chip" onclick="loadTransfers('draft',this)">Draft</span>
            <span class="filter-chip" onclick="loadTransfers('done',this)">Done</span>
            <span class="filter-chip" onclick="loadTransfers('canceled',this)">Canceled</span>
        </div>
        <div id="transfers-container"></div>
    </div>`;
    window._transferStatus = '';
    await loadTransfers('');
}

async function searchTransfers(q) {
    const all = window._transfersData || [];
    const filtered = q ? all.filter(t => t.ref_number.toLowerCase().includes(q.toLowerCase()) ||
        t.from_warehouse_name.toLowerCase().includes(q.toLowerCase()) ||
        t.to_warehouse_name.toLowerCase().includes(q.toLowerCase())) : all;
    renderTransferList(filtered);
}

async function loadTransfers(status, chipEl) {
    if (chipEl) {
        document.querySelectorAll('.filters-bar .filter-chip').forEach(c => c.classList.remove('active'));
        chipEl.classList.add('active');
    }
    window._transferStatus = status;
    try {
        const endpoint = status ? `/transfers?status=${status}` : '/transfers';
        const transfers = await API.get(endpoint);
        window._transfersData = transfers;
        renderTransferList(transfers);
    } catch (err) { showToast('Failed to load transfers', 'error'); }
}

function renderTransferList(transfers) {
    const container = document.getElementById('transfers-container');
    if (transfers.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No transfers found</p></div>';
        return;
    }
    container.innerHTML = `<div class="table-container"><table class="data-table"><thead><tr>
        <th>Reference</th><th>From</th><th>To</th><th>Items</th><th>Status</th><th>Scheduled Date</th><th>Actions</th>
    </tr></thead><tbody>
    ${transfers.map(t => `<tr onclick="showTransferDetail('${t.id}')" style="cursor:pointer">
        <td><strong>${escapeHTML(t.ref_number)}</strong></td>
        <td>
            <div style="font-size:12px;color:var(--text-muted)">From</div>
            <strong>${escapeHTML(t.from_warehouse_name)}</strong>
            ${t.from_location_name ? `<div style="font-size:11px;color:var(--text-muted)">📍 ${escapeHTML(t.from_location_name)}</div>` : ''}
        </td>
        <td>
            <div style="font-size:12px;color:var(--text-muted)">To</div>
            <strong>${escapeHTML(t.to_warehouse_name)}</strong>
            ${t.to_location_name ? `<div style="font-size:11px;color:var(--text-muted)">📍 ${escapeHTML(t.to_location_name)}</div>` : ''}
        </td>
        <td>${t.items.length} item(s)</td>
        <td>${transferStatusBadge(t.status)}</td>
        <td>${formatDate(t.scheduled_date || t.created_at)}</td>
        <td class="actions-cell" onclick="event.stopPropagation()">
            ${t.status === 'draft' ? `<button class="btn btn-success btn-sm" onclick="validateTransfer('${t.id}')">✓ Validate</button>` : ''}
            ${t.status === 'draft' ? `<button class="btn btn-ghost btn-sm" onclick="updateTransferStatus('${t.id}','canceled')" style="color:var(--accent-danger)">✕</button>` : ''}
        </td>
    </tr>`).join('')}
    </tbody></table></div>`;
}

async function showTransferDetail(id) {
    const t = await API.get(`/transfers/${id}`);
    const itemRows = t.items.map(item => `
        <tr>
            <td>${escapeHTML(item.product_name)}</td>
            <td style="text-align:center">${item.qty}</td>
        </tr>`).join('');
    showModal(`Transfer — ${t.ref_number}`, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
            <div><label style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Reference</label><div style="font-weight:700">${escapeHTML(t.ref_number)}</div></div>
            <div><label style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Status</label><div>${transferStatusBadge(t.status)}</div></div>
            <div>
                <label style="font-size:11px;color:var(--text-muted);text-transform:uppercase">From</label>
                <div>${escapeHTML(t.from_warehouse_name)}</div>
                ${t.from_location_name ? `<div style="font-size:12px;color:var(--text-muted)">📍 ${escapeHTML(t.from_location_name)}</div>` : ''}
            </div>
            <div>
                <label style="font-size:11px;color:var(--text-muted);text-transform:uppercase">To</label>
                <div>${escapeHTML(t.to_warehouse_name)}</div>
                ${t.to_location_name ? `<div style="font-size:12px;color:var(--text-muted)">📍 ${escapeHTML(t.to_location_name)}</div>` : ''}
            </div>
            <div><label style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Scheduled Date</label><div>${formatDate(t.scheduled_date || t.created_at)}</div></div>
            <div><label style="font-size:11px;color:var(--text-muted);text-transform:uppercase">Notes</label><div style="font-size:13px">${escapeHTML(t.notes||'—')}</div></div>
        </div>
        <h4 style="font-size:0.85rem;margin-bottom:8px">Products</h4>
        <table class="data-table" style="margin-bottom:16px">
            <thead><tr><th>Product</th><th>Quantity</th></tr></thead>
            <tbody>${itemRows}</tbody>
        </table>
        <div class="modal-actions" style="border:none;padding-top:8px;justify-content:flex-start;gap:8px">
            ${t.status === 'draft' ? `<button class="btn btn-success" onclick="closeModal();validateTransfer('${t.id}')">✓ Validate</button>` : ''}
            ${t.status === 'draft' ? `<button class="btn btn-ghost" onclick="closeModal();updateTransferStatus('${t.id}','canceled')" style="color:var(--accent-danger)">✕ Cancel</button>` : ''}
            <button class="btn btn-ghost" onclick="closeModal()">Close</button>
        </div>`);
}

async function validateTransfer(id) {
    if (!confirm('Validate transfer? Stock will be moved between warehouses.')) return;
    try {
        await API.put(`/transfers/${id}/status?new_status=done`);
        showToast('Transfer validated! Stock moved.', 'success');
        await loadTransfers(window._transferStatus || '');
    } catch (err) { showToast(err.message, 'error'); }
}

async function updateTransferStatus(id, newStatus) {
    try {
        await API.put(`/transfers/${id}/status?new_status=${newStatus}`);
        showToast(`Transfer ${newStatus}`, 'success');
        await loadTransfers(window._transferStatus || '');
    } catch (err) { showToast(err.message, 'error'); }
}

async function showCreateTransferModal() {
    const [products, warehouses] = await Promise.all([API.get('/products'), API.get('/warehouses')]);
    const prodOpts = products.map(p => `<option value="${p.id}">[${escapeHTML(p.sku)}] ${escapeHTML(p.name)} — Stock: ${p.total_stock}</option>`).join('');
    const whOpts = warehouses.map(w => `<option value="${w.id}">${escapeHTML(w.name)} (${w.code})</option>`).join('');

    // Build location options per warehouse (loaded dynamically)
    showModal('New Internal Transfer', `
        <form onsubmit="handleCreateTransfer(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>From Warehouse</label>
                    <select class="form-control" id="trf-from" required onchange="loadTransferLocations('from',this.value)">${whOpts}</select>
                    <select class="form-control" id="trf-from-loc" style="margin-top:6px"><option value="">— Any Location —</option></select>
                </div>
                <div class="form-group">
                    <label>To Warehouse</label>
                    <select class="form-control" id="trf-to" required onchange="loadTransferLocations('to',this.value)">${whOpts}</select>
                    <select class="form-control" id="trf-to-loc" style="margin-top:6px"><option value="">— Any Location —</option></select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Scheduled Date</label><input type="date" class="form-control" id="trf-date"></div>
                <div class="form-group"><label>Notes</label><input class="form-control" id="trf-notes" placeholder="Optional"></div>
            </div>
            <h4 style="margin:0.5rem 0;font-size:0.85rem;color:var(--text-secondary)">Products to Transfer</h4>
            <div id="trf-items">
                <div class="form-row trf-item-row" style="margin-bottom:0.5rem;align-items:center">
                    <div class="form-group" style="margin:0;flex:3"><select class="form-control trf-prod">${prodOpts}</select></div>
                    <div class="form-group" style="margin:0;flex:1"><input type="number" class="form-control trf-qty" placeholder="Qty" min="1" value="1"></div>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('.trf-item-row').remove()" style="color:var(--accent-danger);flex:0">✕</button>
                </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="addTransferItemRow()" style="margin-bottom:1rem">+ Add Product</button>
            <div class="modal-actions" style="border:none;padding:1rem 0 0">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Transfer</button>
            </div>
        </form>`);
    window._trfProdOpts = prodOpts;
    // Load locations for default selected warehouses
    if (warehouses.length > 0) {
        loadTransferLocations('from', warehouses[0].id);
        loadTransferLocations('to', warehouses[0].id);
    }
}

async function loadTransferLocations(side, warehouseId) {
    if (!warehouseId) return;
    try {
        const locs = await API.get(`/warehouses/${warehouseId}/locations`);
        const sel = document.getElementById(`trf-${side}-loc`);
        if (!sel) return;
        sel.innerHTML = '<option value="">— Any Location —</option>' +
            locs.map(l => `<option value="${l.id}">${escapeHTML(l.name)} (${escapeHTML(l.code||'')})</option>`).join('');
    } catch(e) {}
}

function addTransferItemRow() {
    const div = document.createElement('div');
    div.className = 'form-row trf-item-row';
    div.style.cssText = 'margin-bottom:0.5rem;align-items:center';
    div.innerHTML = `<div class="form-group" style="margin:0;flex:3"><select class="form-control trf-prod">${window._trfProdOpts}</select></div><div class="form-group" style="margin:0;flex:1"><input type="number" class="form-control trf-qty" placeholder="Qty" min="1" value="1"></div><button type="button" class="btn btn-ghost btn-sm" onclick="this.closest('.trf-item-row').remove()" style="color:var(--accent-danger);flex:0">✕</button>`;
    document.getElementById('trf-items').appendChild(div);
}

async function handleCreateTransfer(e) {
    e.preventDefault();
    const from = document.getElementById('trf-from').value;
    const to = document.getElementById('trf-to').value;
    const fromLoc = document.getElementById('trf-from-loc').value;
    const toLoc = document.getElementById('trf-to-loc').value;
    if (from === to && fromLoc === toLoc) { showToast('Source and destination must be different', 'warning'); return; }
    const prods = document.querySelectorAll('.trf-prod');
    const qtys = document.querySelectorAll('.trf-qty');
    const items = [];
    prods.forEach((p, i) => { items.push({ product_id: p.value, qty: parseInt(qtys[i].value) || 1 }); });
    try {
        await API.post('/transfers', {
            from_warehouse_id: from,
            to_warehouse_id: to,
            from_location_id: fromLoc || null,
            to_location_id: toLoc || null,
            scheduled_date: document.getElementById('trf-date').value || null,
            notes: document.getElementById('trf-notes').value,
            items
        });
        closeModal();
        showToast('Transfer created!', 'success');
        await loadTransfers('');
    } catch (err) { showToast(err.message, 'error'); }
}

function transferStatusBadge(status) {
    const map = {
        draft:    ['Draft',    '#636e72', '#636e7220'],
        done:     ['Done',     '#00b894', '#00b89420'],
        canceled: ['Canceled', '#d63031', '#d6303120'],
    };
    const [label, color, bg] = map[status] || [status, '#999', '#99920'];
    return `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;color:${color};background:${bg}">${label}</span>`;
}