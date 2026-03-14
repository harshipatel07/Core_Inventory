// ============================================
// ledger.js — Stock movement history (Stock Ledger)
// ============================================

async function renderLedger() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="page-header"><h1>Move History (Stock Ledger)</h1></div>
        <div class="filters-bar">
            <span class="filter-chip active" data-op="" onclick="loadLedger('')">All</span>
            <span class="filter-chip" data-op="receipt" onclick="loadLedger('receipt')">📥 Receipts</span>
            <span class="filter-chip" data-op="delivery" onclick="loadLedger('delivery')">📤 Deliveries</span>
            <span class="filter-chip" data-op="transfer" onclick="loadLedger('transfer')">🔄 Transfers</span>
            <span class="filter-chip" data-op="adjustment" onclick="loadLedger('adjustment')">📝 Adjustments</span>
        </div>
        <div class="table-container"><table class="data-table"><thead><tr>
            <th>Date</th><th>Type</th><th>Reference</th><th>Product</th><th>Warehouse</th><th>Change</th><th>Stock After</th>
        </tr></thead><tbody id="ledger-tbody"></tbody></table></div>
    </div>`;
    await loadLedger('');
}

async function loadLedger(opType) {
    document.querySelectorAll('.filters-bar .filter-chip').forEach(c => c.classList.remove('active'));
    event && event.target && event.target.classList.add('active');
    try {
        const endpoint = opType ? `/ledger?operation_type=${opType}` : '/ledger';
        const entries = await API.get(endpoint);
        const tbody = document.getElementById('ledger-tbody');
        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>No movement history</p></div></td></tr>';
            return;
        }
        tbody.innerHTML = entries.map(e => {
            const sign = e.qty_change > 0 ? '+' : '';
            const qtyStyle = e.qty_change > 0 ? 'color:#00B894' : 'color:#E17055';
            const typeIcons = { receipt: '📥', delivery: '📤', transfer: '🔄', adjustment: '📝' };
            return `<tr>
                <td>${formatDateTime(e.created_at)}</td>
                <td>${typeIcons[e.operation_type] || '•'} ${e.operation_type.charAt(0).toUpperCase() + e.operation_type.slice(1)}</td>
                <td><strong>${escapeHTML(e.ref_number)}</strong></td>
                <td>${escapeHTML(e.product_name)}</td>
                <td>${escapeHTML(e.warehouse_name)}</td>
                <td style="${qtyStyle};font-weight:700">${sign}${e.qty_change}</td>
                <td>${e.qty_after}</td>
            </tr>`;
        }).join('');
    } catch (err) {
        showToast('Failed to load ledger', 'error');
    }
}
