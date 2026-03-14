// ============================================
// products.js — Product CRUD & Category management
// ============================================

let productsCache = [];
let categoriesCache = [];
let warehousesCache = [];



async function renderProducts() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="page-header">
            <h1>Products</h1>
            <div class="page-header-actions">
                <div class="search-bar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="product-search" placeholder="Search by name or SKU..." oninput="filterProducts()">
                </div>
                <button class="btn btn-primary" onclick="showAddProductModal()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Add Product
                </button>
            </div>
        </div>
        <div class="filters-bar" id="product-filters"></div>
        <div class="table-container"><table class="data-table" id="products-table"><thead><tr>
            <th>Product</th><th>SKU</th><th>Category</th><th>Unit</th><th>Total Stock</th><th>Status</th><th>Actions</th>
        </tr></thead><tbody id="products-tbody"></tbody></table></div>
    </div>`;

    try {
        [categoriesCache, warehousesCache] = await Promise.all([
            API.get('/products/categories/list'),
            API.get('/warehouses')
        ]);

        // Build category filter chips
        const filtersEl = document.getElementById('product-filters');
        filtersEl.innerHTML = `<span class="filter-chip active" onclick="filterProductsByCategory('')">All</span>` +
            categoriesCache.map(c => `<span class="filter-chip" onclick="filterProductsByCategory('${c.id}')">${escapeHTML(c.name)}</span>`).join('') +
            `<span class="filter-chip" onclick="filterProductsByStock('low')">⚠ Low Stock</span>` +
            `<span class="filter-chip" onclick="filterProductsByStock('out')">✕ Out of Stock</span>`;

        await loadProducts();
    } catch (err) {
        showToast('Failed to load products', 'error');
    }
}

async function loadProducts(search = '', category = '', stockStatus = '') {
    let endpoint = '/products?';
    if (search) endpoint += `search=${encodeURIComponent(search)}&`;
    if (category) endpoint += `category_id=${category}&`;
    if (stockStatus) endpoint += `stock_status=${stockStatus}&`;

    productsCache = await API.get(endpoint);
    renderProductsTable(productsCache);
}

function renderProductsTable(products) {
    const tbody = document.getElementById('products-tbody');
    if (products.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>No products found</p></div></td></tr>';
        return;
    }
    tbody.innerHTML = products.map(p => `<tr>
        <td><strong>${escapeHTML(p.name)}</strong></td>
        <td><code style="color:var(--text-accent);font-size:0.8rem">${escapeHTML(p.sku)}</code></td>
        <td>${escapeHTML(p.category_name || '—')}</td>
        <td>${escapeHTML(p.unit_of_measure)}</td>
        <td><strong>${p.total_stock}</strong></td>
        <td>${stockBadge(p.total_stock, p.low_stock_threshold)}</td>
        <td class="actions-cell">
            <button class="btn btn-ghost btn-sm" onclick="showEditProductModal('${p.id}')" title="Edit">✎</button>
            <button class="btn btn-ghost btn-sm" onclick="showProductStock('${p.id}')" title="Stock Details">📦</button>
            <button class="btn btn-ghost btn-sm" onclick="deleteProduct('${p.id}')" title="Delete" style="color:var(--accent-danger)">✕</button>
        </td>
    </tr>`).join('');
}

function filterProducts() {
    const q = document.getElementById('product-search').value;
    loadProducts(q);
}

function filterProductsByCategory(catId) {
    document.querySelectorAll('#product-filters .filter-chip').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    loadProducts('', catId);
}

function filterProductsByStock(status) {
    document.querySelectorAll('#product-filters .filter-chip').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    loadProducts('', '', status);
}

function showAddProductModal() {
    const catOptions = categoriesCache.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');
    const whOptions = warehousesCache.map(w => `<option value="${w.id}">${escapeHTML(w.name)}</option>`).join('');
    showModal('Add New Product', `
        <form id="add-product-form" onsubmit="handleAddProduct(event)">
            <div class="form-row">
                <div class="form-group"><label>Product Name</label><input class="form-control" id="ap-name" required></div>
                <div class="form-group"><label>SKU / Code</label><input class="form-control" id="ap-sku" required></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Category</label><select class="form-control" id="ap-category"><option value="">— None —</option>${catOptions}</select></div>
                <div class="form-group"><label>Unit of Measure</label><select class="form-control" id="ap-unit"><option>pcs</option><option>kg</option><option>liters</option><option>meters</option><option>sheets</option><option>rolls</option><option>sets</option><option>boxes</option></select></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Low Stock Threshold</label><input type="number" class="form-control" id="ap-threshold" value="0" min="0"></div>
                <div class="form-group"><label>Initial Stock</label><input type="number" class="form-control" id="ap-stock" value="0" min="0"></div>
            </div>
            <div class="form-group"><label>Warehouse (for initial stock)</label><select class="form-control" id="ap-warehouse"><option value="">— Select —</option>${whOptions}</select></div>
            <div class="modal-actions" style="border:none;padding:1rem 0 0"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Create Product</button></div>
        </form>`);
}

async function handleAddProduct(e) {
    e.preventDefault();
    try {
        await API.post('/products', {
            name: document.getElementById('ap-name').value,
            sku: document.getElementById('ap-sku').value,
            category_id: document.getElementById('ap-category').value || null,
            unit_of_measure: document.getElementById('ap-unit').value,
            low_stock_threshold: parseInt(document.getElementById('ap-threshold').value) || 0,
            initial_stock: parseInt(document.getElementById('ap-stock').value) || 0,
            warehouse_id: document.getElementById('ap-warehouse').value || null,
        });
        closeModal();
        showToast('Product created!', 'success');
        await loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function showEditProductModal(id) {
    const p = productsCache.find(x => x.id === id);
    if (!p) return;
    const catOptions = categoriesCache.map(c => `<option value="${c.id}" ${c.id===p.category_id?'selected':''}>${escapeHTML(c.name)}</option>`).join('');
    showModal('Edit Product', `
        <form onsubmit="handleEditProduct(event, '${id}')">
            <div class="form-row">
                <div class="form-group"><label>Product Name</label><input class="form-control" id="ep-name" value="${escapeHTML(p.name)}" required></div>
                <div class="form-group"><label>SKU</label><input class="form-control" id="ep-sku" value="${escapeHTML(p.sku)}" required></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Category</label><select class="form-control" id="ep-category"><option value="">— None —</option>${catOptions}</select></div>
                <div class="form-group"><label>Unit</label><input class="form-control" id="ep-unit" value="${escapeHTML(p.unit_of_measure)}"></div>
            </div>
            <div class="form-group"><label>Low Stock Threshold</label><input type="number" class="form-control" id="ep-threshold" value="${p.low_stock_threshold}" min="0"></div>
            <div class="modal-actions" style="border:none;padding:1rem 0 0"><button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Save Changes</button></div>
        </form>`);
}

async function handleEditProduct(e, id) {
    e.preventDefault();
    try {
        await API.put(`/products/${id}`, {
            name: document.getElementById('ep-name').value,
            sku: document.getElementById('ep-sku').value,
            category_id: document.getElementById('ep-category').value || null,
            unit_of_measure: document.getElementById('ep-unit').value,
            low_stock_threshold: parseInt(document.getElementById('ep-threshold').value) || 0,
        });
        closeModal();
        showToast('Product updated!', 'success');
        await loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteProduct(id) {
    if (!confirm('Deactivate this product?')) return;
    try {
        await API.delete(`/products/${id}`);
        showToast('Product deactivated', 'success');
        await loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function showProductStock(id) {
    const p = productsCache.find(x => x.id === id);
    if (!p) return;
    const rows = (p.stock_by_warehouse || []).map(s =>
        `<tr><td>${escapeHTML(s.warehouse_name)}</td><td><strong>${s.qty_on_hand}</strong></td><td>${s.qty_reserved||0}</td></tr>`
    ).join('') || '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No stock records</td></tr>';
    showModal(`Stock Details — ${escapeHTML(p.name)}`, `<table class="data-table"><thead><tr><th>Warehouse</th><th>On Hand</th><th>Reserved</th></tr></thead><tbody>${rows}</tbody></table>`);
}
