// ============================================
// warehouses.js — Warehouse & Location management
// ============================================

async function renderWarehouses() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="page-header"><h1>Warehouses</h1>
            <div class="page-header-actions">
                <button class="btn btn-primary" onclick="showCreateWarehouseModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    + Add Warehouse
                </button>
            </div>
        </div>
        <div class="table-container"><table class="data-table"><thead><tr>
            <th>Name</th><th>Code</th><th>Address</th><th>Capacity</th><th>Locations</th><th>Actions</th>
        </tr></thead><tbody id="warehouses-tbody"></tbody></table></div>
    </div>`;
    await loadWarehouses();
}

async function loadWarehouses() {
    // Guard: if the table is not on the page, do nothing (page may have changed)
    const tbody = document.getElementById('warehouses-tbody');
    if (!tbody) return;

    try {
        const warehouses = await API.get('/warehouses');

        // Guard again after async call — user may have navigated away while fetching
        const tbodyAfter = document.getElementById('warehouses-tbody');
        if (!tbodyAfter) return;

        if (warehouses.length === 0) {
            tbodyAfter.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>No warehouses found</p></div></td></tr>';
            return;
        }
        tbodyAfter.innerHTML = warehouses.map(w => `<tr>
            <td><strong>${escapeHTML(w.name)}</strong></td>
            <td><code>${escapeHTML(w.code)}</code></td>
            <td>${escapeHTML(w.address || '—')}</td>
            <td>${w.capacity ?? '—'}</td>
            <td>${w.location_count ?? 0}</td>
            <td class="actions-cell">
                <button class="btn btn-ghost btn-sm" onclick="showEditWarehouseModal('${w.id}')" title="Edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn btn-ghost btn-sm" onclick="deleteWarehouse('${w.id}', '${escapeHTML(w.name)}')" title="Delete" style="color:var(--accent-danger)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
            </td>
        </tr>`).join('');
    } catch (err) {
        const tbodyErr = document.getElementById('warehouses-tbody');
        if (tbodyErr) {
            tbodyErr.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>Failed to load warehouses</p></div></td></tr>';
        }
        showToast('Failed to load warehouses', 'error');
    }
}

// ── Create ────────────────────────────────────────────────────────────────────

async function showCreateWarehouseModal() {
    showModal('Add Warehouse', `
        <form onsubmit="handleCreateWarehouse(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>Name <span style="color:var(--accent-danger)">*</span></label>
                    <input class="form-control" id="wh-name" required placeholder="e.g. Main Warehouse">
                </div>
                <div class="form-group">
                    <label>Code <span style="color:var(--accent-danger)">*</span></label>
                    <input class="form-control" id="wh-code" required placeholder="e.g. WH01" style="text-transform:uppercase">
                </div>
            </div>
            <div class="form-group">
                <label>Address</label>
                <input class="form-control" id="wh-address" placeholder="Street, City">
            </div>
            <div class="form-group">
                <label>Capacity</label>
                <input type="number" class="form-control" id="wh-capacity" min="0" placeholder="Maximum units (optional)">
            </div>
            <div class="modal-actions" style="border:none;padding:1rem 0 0">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Warehouse</button>
            </div>
        </form>
    `);
}

async function handleCreateWarehouse(e) {
    e.preventDefault();
    try {
        await API.post('/warehouses', {
            name: document.getElementById('wh-name').value,
            code: document.getElementById('wh-code').value.toUpperCase(),
            address: document.getElementById('wh-address').value || null,
            capacity: parseInt(document.getElementById('wh-capacity').value) || null,
        });
        closeModal();
        showToast('Warehouse created!', 'success');
        await loadWarehouses();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Edit ──────────────────────────────────────────────────────────────────────

async function showEditWarehouseModal(id) {
    try {
        const w = await API.get(`/warehouses/${id}`);
        showModal('Edit Warehouse', `
            <form onsubmit="handleEditWarehouse(event, '${id}')">
                <div class="form-row">
                    <div class="form-group">
                        <label>Name <span style="color:var(--accent-danger)">*</span></label>
                        <input class="form-control" id="wh-edit-name" required value="${escapeHTML(w.name)}">
                    </div>
                    <div class="form-group">
                        <label>Code <span style="color:var(--accent-danger)">*</span></label>
                        <input class="form-control" id="wh-edit-code" required value="${escapeHTML(w.code)}" style="text-transform:uppercase">
                    </div>
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <input class="form-control" id="wh-edit-address" value="${escapeHTML(w.address || '')}">
                </div>
                <div class="form-group">
                    <label>Capacity</label>
                    <input type="number" class="form-control" id="wh-edit-capacity" min="0" value="${w.capacity ?? ''}">
                </div>
                <div class="modal-actions" style="border:none;padding:1rem 0 0">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        `);
    } catch (err) {
        showToast('Failed to load warehouse details', 'error');
    }
}

async function handleEditWarehouse(e, id) {
    e.preventDefault();
    try {
        await API.put(`/warehouses/${id}`, {
            name: document.getElementById('wh-edit-name').value,
            code: document.getElementById('wh-edit-code').value.toUpperCase(),
            address: document.getElementById('wh-edit-address').value || null,
            capacity: parseInt(document.getElementById('wh-edit-capacity').value) || null,
        });
        closeModal();
        showToast('Warehouse updated!', 'success');
        await loadWarehouses();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteWarehouse(id, name) {
    showModal('Delete Warehouse', `
        <div style="text-align:center;padding:1rem 0;">
            <div style="font-size:2rem;margin-bottom:0.75rem;">🗑️</div>
            <p style="font-size:1rem;font-weight:600;margin-bottom:0.5rem;">
                Delete <strong>${escapeHTML(name)}</strong>?
            </p>
            <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:1.5rem;">
                This will permanently remove the warehouse and all its locations.<br>
                This action cannot be undone.
            </p>
            <div class="modal-actions" style="border:none;padding:0;justify-content:center;gap:1rem;">
                <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button class="btn btn-danger" onclick="confirmDeleteWarehouse('${id}')">
                    Yes, Delete Warehouse
                </button>
            </div>
        </div>
    `);
}

async function confirmDeleteWarehouse(id) {
    try {
        closeModal();
        await API.delete(`/warehouses/${id}`);
        showToast('Warehouse deleted', 'success');
        // Guard: only reload if the warehouses page is still active
        await loadWarehouses();
    } catch (err) {
        showToast(err.message || 'Failed to delete warehouse', 'error');
    }
}