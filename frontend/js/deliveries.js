// ============================================
// deliveries.js — Outgoing goods management
// ============================================

async function renderDeliveries() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="page-header"><h1>Delivery Orders (Outgoing)</h1>
            <div class="page-header-actions">
                <button class="btn btn-primary" onclick="showCreateDeliveryModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    New Delivery
                </button>
            </div>
        </div>
        <div class="filters-bar">
            <span class="filter-chip active" onclick="loadDeliveries('')">All</span>
            <span class="filter-chip" onclick="loadDeliveries('draft')">Draft</span>
            <span class="filter-chip" onclick="loadDeliveries('waiting')">Waiting</span>
            <span class="filter-chip" onclick="loadDeliveries('ready')">Ready</span>
            <span class="filter-chip" onclick="loadDeliveries('done')">Done</span>
        </div>
        <div class="table-container"><table class="data-table"><thead><tr>
            <th>Reference</th><th>Customer</th><th>Warehouse</th><th>Items</th><th>Status</th><th>Date</th><th>Actions</th>
        </tr></thead><tbody id="deliveries-tbody"></tbody></table></div>
    </div>`;
    await loadDeliveries('');
}

async function loadDeliveries(status) {
    document.querySelectorAll('.filters-bar .filter-chip').forEach(c => c.classList.remove('active'));
    event && event.target && event.target.classList.add('active');
    try {
        const endpoint = status ? `/deliveries?status=${status}` : '/deliveries';
        const deliveries = await API.get(endpoint);
        const tbody = document.getElementById('deliveries-tbody');
        if (deliveries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>No deliveries found</p></div></td></tr>';
            return;
        }
        tbody.innerHTML = deliveries.map(d => `<tr>
            <td><strong>${escapeHTML(d.ref_number)}</strong></td>
            <td>${escapeHTML(d.customer_name || '—')}</td>
            <td>${escapeHTML(d.warehouse_name)}</td>
            <td>${d.items.length} item(s)</td>
            <td>${statusBadge(d.status)}</td>
            <td>${formatDate(d.date_val || d.created_at)}</td>
            <td class="actions-cell">
                ${d.status !== 'done' && d.status !== 'canceled' ? `<button class="btn btn-success btn-sm" onclick="validateDelivery('${d.id}')">✓ Validate</button>` : ''}
                ${d.status !== 'done' ? `<button class="btn btn-ghost btn-sm" onclick="deleteDelivery('${d.id}')" style="color:var(--accent-danger)">✕</button>` : ''}
            </td>
        </tr>`).join('');
    } catch (err) {
        showToast('Failed to load deliveries', 'error');
    }
}

async function showCreateDeliveryModal() {
    const [products, warehouses] = await Promise.all([API.get('/products'), API.get('/warehouses')]);
    const prodOpts = products.map(p => `<option value="${p.id}">${escapeHTML(p.name)} (${p.sku}) — Stock: ${p.total_stock}</option>`).join('');
    const whOpts = warehouses.map(w => `<option value="${w.id}">${escapeHTML(w.name)}</option>`).join('');
    showModal('Create Delivery Order', `
        <form onsubmit="handleCreateDelivery(event)">
            <div class="form-row">
                <div class="form-group"><label>Customer Name</label><input class="form-control" id="del-customer" required></div>
                <div class="form-group"><label>Warehouse</label><select class="form-control" id="del-wh" required>${whOpts}</select></div>
            </div>
            <div class="form-group"><label>Notes</label><textarea class="form-control" id="del-notes" rows="2"></textarea></div>
            <h4 style="margin:1rem 0 0.5rem;font-size:0.85rem;color:var(--text-secondary)">Items</h4>
            <div id="del-items"><div class="form-row" style="margin-bottom:0.5rem"><div class="form-group" style="margin:0"><select class="form-control del-prod">${prodOpts}</select></div><div class="form-group" style="margin:0"><input type="number" class="form-control del-qty" placeholder="Qty" min="1" value="1"></div></div></div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="addDeliveryItemRow()" style="margin-bottom:1rem">+ Add Item</button>
            <div class="modal-actions" style="border:none;padding:1rem 0 0"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Create Delivery</button></div>
        </form>`);
    window._delProdOpts = prodOpts;
}

function addDeliveryItemRow() {
    const div = document.createElement('div');
    div.className = 'form-row'; div.style.marginBottom = '0.5rem';
    div.innerHTML = `<div class="form-group" style="margin:0"><select class="form-control del-prod">${window._delProdOpts}</select></div><div class="form-group" style="margin:0"><input type="number" class="form-control del-qty" placeholder="Qty" min="1" value="1"></div>`;
    document.getElementById('del-items').appendChild(div);
}

async function handleCreateDelivery(e) {
    e.preventDefault();
    const prods = document.querySelectorAll('.del-prod');
    const qtys = document.querySelectorAll('.del-qty');
    const items = [];
    prods.forEach((p, i) => { items.push({ product_id: p.value, qty: parseInt(qtys[i].value) || 1 }); });
    try {
        await API.post('/deliveries', {
            customer_name: document.getElementById('del-customer').value,
            warehouse_id: document.getElementById('del-wh').value,
            notes: document.getElementById('del-notes').value,
            items
        });
        closeModal();
        showToast('Delivery created!', 'success');
        await loadDeliveries('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function validateDelivery(id) {
    if (!confirm('Validate delivery? Stock will decrease.')) return;
    try {
        await API.put(`/deliveries/${id}/status?new_status=done`);
        showToast('Delivery validated! Stock updated.', 'success');
        await loadDeliveries('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteDelivery(id) {
    if (!confirm('Delete this delivery?')) return;
    try {
        await API.delete(`/deliveries/${id}`);
        showToast('Delivery deleted', 'success');
        await loadDeliveries('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}
