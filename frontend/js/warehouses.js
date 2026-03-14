// ============================================
// warehouses.js — Warehouse management page
// ============================================

async function renderWarehouses() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="page-header"><h1>Warehouses</h1>
            <div class="page-header-actions">
                <button class="btn btn-primary" onclick="showCreateWarehouseModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Warehouse
                </button>
            </div>
        </div>
        <div class="kpi-grid" id="warehouses-grid"></div>
    </div>`;
    await loadWarehouses();
}

async function loadWarehouses() {
    try {
        const warehouses = await API.get('/warehouses');
        const grid = document.getElementById('warehouses-grid');
        if (warehouses.length === 0) {
            grid.innerHTML = '<div class="empty-state"><p>No warehouses configured</p></div>';
            return;
        }
        grid.innerHTML = warehouses.map(w => `
            <div class="card" style="cursor:pointer" onclick="showWarehouseLocations('${w.id}', '${escapeHTML(w.name)}')">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem">
                    <div class="kpi-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
                    <div class="actions-cell">
                        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); showEditWarehouseModal('${w.id}')">✎</button>
                        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); deleteWarehouse('${w.id}')" style="color:var(--accent-danger)">✕</button>
                    </div>
                </div>
                <h3 style="font-size:1.05rem;font-weight:700;margin-bottom:0.25rem">${escapeHTML(w.name)}</h3>
                <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.5rem">${escapeHTML(w.code || '')} · ${escapeHTML(w.address || 'No address')}</p>
                <div style="display:flex;gap:1rem;font-size:0.8rem;color:var(--text-secondary)">
                    <span>Capacity: <strong style="color:var(--text-primary)">${w.capacity}</strong></span>
                    <span>Locations: <strong style="color:var(--text-primary)">${w.location_count}</strong></span>
                </div>
            </div>
        `).join('');
    } catch (err) {
        showToast('Failed to load warehouses', 'error');
    }
}

function showCreateWarehouseModal() {
    showModal('Add Warehouse', `
        <form onsubmit="handleCreateWarehouse(event)">
            <div class="form-row">
                <div class="form-group"><label>Name</label><input class="form-control" id="wh-name" required></div>
                <div class="form-group"><label>Code</label><input class="form-control" id="wh-code" required placeholder="WH-XXX"></div>
            </div>
            <div class="form-group"><label>Address</label><input class="form-control" id="wh-address"></div>
            <div class="form-group"><label>Capacity (units)</label><input type="number" class="form-control" id="wh-capacity" value="1000" min="0"></div>
            <div class="modal-actions" style="border:none;padding:1rem 0 0"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Create</button></div>
        </form>`);
}

async function handleCreateWarehouse(e) {
    e.preventDefault();
    try {
        await API.post('/warehouses', {
            name: document.getElementById('wh-name').value,
            code: document.getElementById('wh-code').value,
            address: document.getElementById('wh-address').value,
            capacity: parseInt(document.getElementById('wh-capacity').value) || 0,
        });
        closeModal();
        showToast('Warehouse created!', 'success');
        await loadWarehouses();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function showEditWarehouseModal(id) {
    const wh = (await API.get('/warehouses')).find(w => w.id === id);
    if (!wh) return;
    showModal('Edit Warehouse', `
        <form onsubmit="handleEditWarehouse(event, '${id}')">
            <div class="form-row">
                <div class="form-group"><label>Name</label><input class="form-control" id="ewh-name" value="${escapeHTML(wh.name)}" required></div>
                <div class="form-group"><label>Code</label><input class="form-control" id="ewh-code" value="${escapeHTML(wh.code || '')}" required></div>
            </div>
            <div class="form-group"><label>Address</label><input class="form-control" id="ewh-address" value="${escapeHTML(wh.address || '')}"></div>
            <div class="form-group"><label>Capacity</label><input type="number" class="form-control" id="ewh-capacity" value="${wh.capacity}" min="0"></div>
            <div class="modal-actions" style="border:none;padding:1rem 0 0"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save</button></div>
        </form>`);
}

async function handleEditWarehouse(e, id) {
    e.preventDefault();
    try {
        await API.put(`/warehouses/${id}`, {
            name: document.getElementById('ewh-name').value,
            code: document.getElementById('ewh-code').value,
            address: document.getElementById('ewh-address').value,
            capacity: parseInt(document.getElementById('ewh-capacity').value) || 0,
        });
        closeModal();
        showToast('Warehouse updated!', 'success');
        await loadWarehouses();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteWarehouse(id) {
    if (!confirm('Deactivate this warehouse?')) return;
    try {
        await API.delete(`/warehouses/${id}`);
        showToast('Warehouse deactivated', 'success');
        await loadWarehouses();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function showWarehouseLocations(whId, whName) {
    try {
        const locs = await API.get(`/warehouses/${whId}/locations`);
        const rows = locs.length > 0
            ? locs.map(l => `<tr><td>${escapeHTML(l.name)}</td><td><code>${escapeHTML(l.code||'')}</code></td><td>${l.type}</td></tr>`).join('')
            : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No locations configured</td></tr>';
        showModal(`Locations — ${whName}`, `<table class="data-table"><thead><tr><th>Name</th><th>Code</th><th>Type</th></tr></thead><tbody>${rows}</tbody></table>`);
    } catch (err) {
        showToast('Failed to load locations', 'error');
    }
}
