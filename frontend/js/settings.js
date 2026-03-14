// ============================================
// settings.js — Settings page
// Covers: Warehouse mgmt, Categories, Reorder rules,
//         System preferences, User management
// ============================================

async function renderSettings() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="page-header"><h1>⚙️ Settings</h1></div>
        <div style="display:flex;gap:0;border:1px solid var(--border-color);border-radius:var(--radius-md);overflow:hidden;margin-bottom:1.5rem">
            <button class="settings-tab active" onclick="switchSettingsTab('warehouses',this)">🏭 Warehouses</button>
            <button class="settings-tab" onclick="switchSettingsTab('categories',this)">🏷 Categories</button>
            <button class="settings-tab" onclick="switchSettingsTab('reorder',this)">🔔 Reorder Rules</button>
            <button class="settings-tab" onclick="switchSettingsTab('system',this)">🔧 System</button>
        </div>
        <div id="settings-content"></div>
    </div>`;
    switchSettingsTab('warehouses', document.querySelector('.settings-tab'));
}

function switchSettingsTab(tab, el) {
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const fns = { warehouses: loadSettingsWarehouses, categories: loadSettingsCategories, reorder: loadSettingsReorder, system: loadSettingsSystem };
    if (fns[tab]) fns[tab]();
}

// ── Warehouses tab ──
async function loadSettingsWarehouses() {
    const c = document.getElementById('settings-content');
    c.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center">Loading...</div>';
    const [warehouses] = await Promise.all([API.get('/warehouses')]);
    c.innerHTML = `
        <div class="page-header" style="margin-bottom:1rem">
            <h3 style="font-size:1rem;font-weight:600">Warehouses</h3>
            <button class="btn btn-primary btn-sm" onclick="showCreateWarehouseModal()">+ Add Warehouse</button>
        </div>
        <div class="table-container">
            <table class="data-table"><thead><tr>
                <th>Name</th><th>Short Code</th><th>Address</th><th>Capacity</th><th>Locations</th><th>Actions</th>
            </tr></thead><tbody>
            ${warehouses.map(w => `<tr>
                <td><strong>${escapeHTML(w.name)}</strong></td>
                <td><code>${escapeHTML(w.code||'—')}</code></td>
                <td>${escapeHTML(w.address||'—')}</td>
                <td>${w.capacity}</td>
                <td>${w.location_count}</td>
                <td class="actions-cell">
                    <button class="btn btn-ghost btn-sm" onclick="showEditWarehouseModal('${w.id}')">✎</button>
                    <button class="btn btn-ghost btn-sm" onclick="deleteWarehouse('${w.id}')" style="color:var(--accent-danger)">✕</button>
                </td>
            </tr>`).join('')}
            </tbody></table>
        </div>`;
}

// ── Categories tab ──
async function loadSettingsCategories() {
    const c = document.getElementById('settings-content');
    const cats = await API.get('/products/categories/list');
    c.innerHTML = `
        <div class="page-header" style="margin-bottom:1rem">
            <h3 style="font-size:1rem;font-weight:600">Product Categories</h3>
            <button class="btn btn-primary btn-sm" onclick="showAddCategoryModal()">+ Add Category</button>
        </div>
        <div class="table-container">
            <table class="data-table"><thead><tr><th>Name</th><th>Parent</th></tr></thead><tbody>
            ${cats.length === 0 ? '<tr><td colspan="2"><div class="empty-state"><p>No categories yet</p></div></td></tr>' :
              cats.map(c => `<tr><td><strong>${escapeHTML(c.name)}</strong></td><td>${escapeHTML(cats.find(x=>x.id===c.parent_id)?.name||'—')}</td></tr>`).join('')}
            </tbody></table>
        </div>`;
}

function showAddCategoryModal() {
    showModal('Add Category', `
        <form onsubmit="handleAddCategory(event)">
            <div class="form-group"><label>Category Name</label><input class="form-control" id="cat-name" required placeholder="e.g. Electronics"></div>
            <div class="modal-actions" style="border:none;padding-top:12px">
                <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary">Add</button>
            </div>
        </form>`);
}

async function handleAddCategory(e) {
    e.preventDefault();
    try {
        await API.post('/products/categories/create', { name: document.getElementById('cat-name').value });
        closeModal();
        showToast('Category added!', 'success');
        loadSettingsCategories();
    } catch(err) { showToast(err.message, 'error'); }
}

// ── Reorder Rules tab ──
async function loadSettingsReorder() {
    const c = document.getElementById('settings-content');
    const products = await API.get('/products');
    c.innerHTML = `
        <div style="margin-bottom:1rem">
            <h3 style="font-size:1rem;font-weight:600;margin-bottom:4px">Reorder Rules</h3>
            <p style="font-size:12px;color:var(--text-muted)">Set minimum stock thresholds. When stock drops to or below the threshold, a low-stock alert fires.</p>
        </div>
        <div class="table-container">
            <table class="data-table"><thead><tr>
                <th>Product</th><th>SKU</th><th>Current Stock</th><th>Reorder Threshold</th><th>Status</th><th>Action</th>
            </tr></thead><tbody>
            ${products.map(p => {
                const st = p.total_stock === 0 ? 'out' : p.total_stock <= p.low_stock_threshold ? 'low' : 'ok';
                const badge = st === 'out' ? '<span style="color:#d63031;font-size:11px;font-weight:700">● Out of Stock</span>'
                            : st === 'low' ? '<span style="color:#fdcb6e;font-size:11px;font-weight:700">⚠ Low Stock</span>'
                            : '<span style="color:#00b894;font-size:11px">✓ OK</span>';
                return `<tr>
                    <td><strong>${escapeHTML(p.name)}</strong></td>
                    <td><code style="font-size:11px">${escapeHTML(p.sku)}</code></td>
                    <td style="${st!=='ok'?'color:'+(st==='out'?'#d63031':'#fdcb6e')+';font-weight:700':''}">
                        ${p.total_stock} ${p.unit_of_measure}
                    </td>
                    <td>
                        <input type="number" class="form-control" style="width:80px;padding:4px 8px;font-size:12px;display:inline-block"
                            id="threshold-${p.id}" value="${p.low_stock_threshold}" min="0">
                    </td>
                    <td>${badge}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="saveReorderThreshold('${p.id}')">Save</button>
                    </td>
                </tr>`;
            }).join('')}
            </tbody></table>
        </div>`;
}

async function saveReorderThreshold(productId) {
    const val = parseInt(document.getElementById(`threshold-${productId}`).value) || 0;
    try {
        await API.put(`/products/${productId}`, { low_stock_threshold: val });
        showToast('Reorder threshold updated!', 'success');
        loadSettingsReorder();
    } catch(err) { showToast(err.message, 'error'); }
}

// ── System tab ──
function loadSettingsSystem() {
    const c = document.getElementById('settings-content');
    c.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem">
            <div class="card">
                <h4 style="font-size:0.9rem;font-weight:600;margin-bottom:12px">System Info</h4>
                <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">App Name</span><strong>Core Inventory</strong></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Version</span><strong>1.0.0</strong></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Backend</span><strong>FastAPI + SQLite</strong></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">API Docs</span><a href="/docs" target="_blank" style="color:var(--accent-primary)">View Swagger</a></div>
                </div>
            </div>
            <div class="card">
                <h4 style="font-size:0.9rem;font-weight:600;margin-bottom:12px">Reference Formats</h4>
                <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Receipt</span><code>WH/IN/0001</code></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Delivery</span><code>WH/OUT/0001</code></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Transfer</span><code>TRF-XXXX</code></div>
                    <div style="display:flex;justify-content:space-between"><span style="color:var(--text-muted)">Adjustment</span><code>ADJ-XXXX</code></div>
                </div>
            </div>
            <div class="card">
                <h4 style="font-size:0.9rem;font-weight:600;margin-bottom:12px">Status Flows</h4>
                <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
                    <div><span style="color:var(--text-muted)">Receipt:</span> Draft → Ready → Done</div>
                    <div><span style="color:var(--text-muted)">Delivery:</span> Draft → Waiting → Ready → Done</div>
                    <div><span style="color:var(--text-muted)">Transfer:</span> Draft → Done</div>
                </div>
            </div>
            <div class="card">
                <h4 style="font-size:0.9rem;font-weight:600;margin-bottom:12px">Quick Actions</h4>
                <div style="display:flex;flex-direction:column;gap:8px">
                    <button class="btn btn-secondary btn-sm" onclick="navigate('warehouses')">→ Manage Warehouses</button>
                    <button class="btn btn-secondary btn-sm" onclick="navigate('products')">→ Manage Products</button>
                    <button class="btn btn-secondary btn-sm" onclick="navigate('adjustments')">→ Stock Adjustments</button>
                </div>
            </div>
        </div>`;
}