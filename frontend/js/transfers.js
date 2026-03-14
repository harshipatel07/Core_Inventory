// ============================================
// transfers.js — Internal stock transfers
// ============================================

async function renderTransfers() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="page-header"><h1>Internal Transfers</h1>
            <div class="page-header-actions">
                <button class="btn btn-primary" onclick="showCreateTransferModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New Transfer
                </button>
            </div>
        </div>
        <div class="filters-bar">
            <span class="filter-chip active" onclick="loadTransfers('')">All</span>
            <span class="filter-chip" onclick="loadTransfers('draft')">Draft</span>
            <span class="filter-chip" onclick="loadTransfers('done')">Done</span>
            <span class="filter-chip" onclick="loadTransfers('cancelled')">Cancelled</span>
        </div>
        <div class="table-container"><table class="data-table"><thead><tr>
            <th>Reference</th><th>From</th><th>To</th><th>Items</th><th>Status</th><th>Scheduled Date</th><th>Actions</th>
        </tr></thead><tbody id="transfers-tbody"></tbody></table></div>
    </div>`;
    await loadTransfers('');
}

async function loadTransfers(status) {
    document.querySelectorAll('.filters-bar .filter-chip').forEach(c => c.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    try {
        const endpoint = status ? `/transfers?status=${status}` : '/transfers';
        const transfers = await API.get(endpoint);
        const tbody = document.getElementById('transfers-tbody');
        if (transfers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>No transfers found</p></div></td></tr>';
            return;
        }
        tbody.innerHTML = transfers.map(t => `<tr>
            <td><strong>${escapeHTML(t.ref_number)}</strong></td>
            <td>
                <div style="font-size:0.75rem;color:var(--text-secondary)">From</div>
                <strong>${escapeHTML(t.from_warehouse_name)}</strong>
            </td>
            <td>
                <div style="font-size:0.75rem;color:var(--text-secondary)">To</div>
                <strong>${escapeHTML(t.to_warehouse_name)}</strong>
            </td>
            <td>${t.items.length} item(s)</td>
            <td>${statusBadge(t.status)}</td>
            <td>${formatDate(t.scheduled_date || t.created_at)}</td>
            <td class="actions-cell">
                ${t.status === 'draft' ? `
                    <button class="btn btn-success btn-sm" onclick="validateTransfer('${t.id}', '${escapeHTML(t.ref_number)}')">
                        ✓ Validate
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="cancelTransfer('${t.id}', '${escapeHTML(t.ref_number)}')"
                        title="Cancel this transfer"
                        style="background:transparent;border:1px solid var(--accent-danger);color:var(--accent-danger);">
                        ✕ Cancel
                    </button>
                ` : ''}
                ${t.status === 'done' ? `
                    <span style="font-size:0.78rem;color:var(--text-secondary);padding:0 4px;">
                        Cannot cancel — already done
                    </span>
                ` : ''}
                ${t.status === 'cancelled' ? `
                    <span style="font-size:0.78rem;color:var(--text-secondary);padding:0 4px;">Cancelled</span>
                ` : ''}
            </td>
        </tr>`).join('');
    } catch (err) {
        showToast('Failed to load transfers', 'error');
    }
}

// ── Cancel Transfer ───────────────────────────────────────────────────────────

async function cancelTransfer(id, refNumber) {
    // Show confirmation modal instead of native confirm() to match app style
    showModal('Cancel Transfer', `
        <div style="text-align:center;padding:1rem 0;">
            <div style="font-size:2rem;margin-bottom:0.75rem;">⚠️</div>
            <p style="font-size:1rem;font-weight:600;margin-bottom:0.5rem;">
                Cancel <strong>${escapeHTML(refNumber)}</strong>?
            </p>
            <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:1.5rem;">
                This transfer will be marked as cancelled. No stock will be moved.<br>
                This action cannot be undone.
            </p>
            <div class="modal-actions" style="border:none;padding:0;justify-content:center;gap:1rem;">
                <button class="btn btn-secondary" onclick="closeModal()">Go Back</button>
                <button class="btn btn-danger" onclick="confirmCancelTransfer('${id}')">
                    Yes, Cancel Transfer
                </button>
            </div>
        </div>
    `);
}

async function confirmCancelTransfer(id) {
    try {
        closeModal();
        await API.put(`/transfers/${id}/cancel`);
        showToast('Transfer cancelled successfully.', 'success');
        await loadTransfers('');
    } catch (err) {
        showToast(err.message || 'Failed to cancel transfer', 'error');
    }
}

// ── Validate Transfer ─────────────────────────────────────────────────────────

async function validateTransfer(id, refNumber) {
    if (!confirm(`Validate ${refNumber}? Stock will be moved from source to destination warehouse.`)) return;
    try {
        await API.put(`/transfers/${id}/validate`);
        showToast('Transfer validated! Stock updated.', 'success');
        await loadTransfers('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ── Create Transfer Modal ─────────────────────────────────────────────────────

async function showCreateTransferModal() {
    const [products, warehouses] = await Promise.all([
        API.get('/products'),
        API.get('/warehouses'),
    ]);
    const prodOpts = products.map(p =>
        `<option value="${p.id}">${escapeHTML(p.name)} (${p.sku}) — Stock: ${p.total_stock}</option>`
    ).join('');
    const whOpts = warehouses.map(w =>
        `<option value="${w.id}">${escapeHTML(w.name)}</option>`
    ).join('');

    showModal('New Internal Transfer', `
        <form onsubmit="handleCreateTransfer(event)">
            <div class="form-row">
                <div class="form-group">
                    <label>From Warehouse</label>
                    <select class="form-control" id="trf-from" required>${whOpts}</select>
                </div>
                <div class="form-group">
                    <label>To Warehouse</label>
                    <select class="form-control" id="trf-to" required>${whOpts}</select>
                </div>
            </div>
            <div class="form-group">
                <label>Scheduled Date</label>
                <input type="date" class="form-control" id="trf-date" value="${new Date().toISOString().slice(0,10)}">
            </div>
            <div class="form-group">
                <label>Notes</label>
                <textarea class="form-control" id="trf-notes" rows="2"></textarea>
            </div>
            <h4 style="margin:1rem 0 0.5rem;font-size:0.85rem;color:var(--text-secondary)">Items</h4>
            <div id="trf-items">
                <div class="form-row" style="margin-bottom:0.5rem">
                    <div class="form-group" style="margin:0"><select class="form-control trf-prod">${prodOpts}</select></div>
                    <div class="form-group" style="margin:0"><input type="number" class="form-control trf-qty" placeholder="Qty" min="1" value="1"></div>
                </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="addTransferItemRow()" style="margin-bottom:1rem">+ Add Item</button>
            <div class="modal-actions" style="border:none;padding:1rem 0 0">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Create Transfer</button>
            </div>
        </form>
    `);
    window._trfProdOpts = prodOpts;
}

function addTransferItemRow() {
    const div = document.createElement('div');
    div.className = 'form-row';
    div.style.marginBottom = '0.5rem';
    div.innerHTML = `
        <div class="form-group" style="margin:0"><select class="form-control trf-prod">${window._trfProdOpts}</select></div>
        <div class="form-group" style="margin:0"><input type="number" class="form-control trf-qty" placeholder="Qty" min="1" value="1"></div>
    `;
    document.getElementById('trf-items').appendChild(div);
}

async function handleCreateTransfer(e) {
    e.preventDefault();
    const fromId = document.getElementById('trf-from').value;
    const toId = document.getElementById('trf-to').value;
    if (fromId === toId) {
        showToast('Source and destination warehouse must be different.', 'error');
        return;
    }
    const prods = document.querySelectorAll('.trf-prod');
    const qtys = document.querySelectorAll('.trf-qty');
    const items = [];
    prods.forEach((p, i) => {
        items.push({ product_id: p.value, qty: parseInt(qtys[i].value) || 1 });
    });
    try {
        await API.post('/transfers', {
            from_warehouse_id: fromId,
            to_warehouse_id: toId,
            scheduled_date: document.getElementById('trf-date').value || null,
            notes: document.getElementById('trf-notes').value,
            items,
        });
        closeModal();
        showToast('Transfer created!', 'success');
        await loadTransfers('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}