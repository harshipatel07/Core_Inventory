// ============================================
// dashboard.js — Dashboard (Complete)
// Receipt/Delivery cards per flow spec
// Reorder alerts sidebar badge
// Low stock ≠ Out of stock (fixed)
// ============================================

async function renderDashboard() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="page-header"><h1>Dashboard</h1></div>
        <div class="grid-2" style="margin-bottom:1.5rem">
            <div class="card" style="cursor:pointer" onclick="navigate('receipts')">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                    <div class="kpi-icon green"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
                    <h3 style="margin:0;font-size:1rem;font-weight:600">Receipt</h3>
                </div>
                <div id="receipt-card-body" style="display:flex;gap:16px;flex-wrap:wrap"></div>
            </div>
            <div class="card" style="cursor:pointer" onclick="navigate('deliveries')">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                    <div class="kpi-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></div>
                    <h3 style="margin:0;font-size:1rem;font-weight:600">Delivery</h3>
                </div>
                <div id="delivery-card-body" style="display:flex;gap:16px;flex-wrap:wrap"></div>
            </div>
        </div>
        <div class="kpi-grid" id="kpi-grid" style="margin-bottom:1.5rem"></div>
        <div id="reorder-alerts-section" style="margin-bottom:1.5rem;display:none"></div>
        <div class="grid-2">
            <div class="card">
                <div class="card-header"><h3>Recent Activity</h3></div>
                <div id="recent-activity"></div>
            </div>
            <div class="card">
                <div class="card-header"><h3>Stock by Warehouse</h3></div>
                <div id="stock-overview"></div>
            </div>
        </div>
    </div>`;

    try {
        const [kpis, activity, stockOverview] = await Promise.all([
            API.get('/dashboard/kpis'),
            API.get('/dashboard/recent-activity?limit=10'),
            API.get('/dashboard/stock-overview'),
        ]);

        // ── Receipt card ──
        document.getElementById('receipt-card-body').innerHTML = `
            <div style="text-align:center;padding:8px 14px;background:var(--bg-secondary);border-radius:8px;min-width:72px">
                <div style="font-size:1.8rem;font-weight:800;color:#00b894">${kpis.pending_receipts}</div>
                <div style="font-size:11px;color:var(--text-muted)">To Receive</div>
            </div>
            ${kpis.receipt_late > 0 ? `<div style="text-align:center;padding:8px 14px;background:rgba(214,48,49,0.1);border-radius:8px;min-width:72px">
                <div style="font-size:1.8rem;font-weight:800;color:#d63031">${kpis.receipt_late}</div>
                <div style="font-size:11px;color:#d63031">Late</div>
            </div>` : ''}
            <div style="text-align:center;padding:8px 14px;background:var(--bg-secondary);border-radius:8px;min-width:72px">
                <div style="font-size:1.8rem;font-weight:800;color:var(--accent-primary)">${kpis.receipt_operations}</div>
                <div style="font-size:11px;color:var(--text-muted)">Operations</div>
            </div>`;

        // ── Delivery card ──
        document.getElementById('delivery-card-body').innerHTML = `
            <div style="text-align:center;padding:8px 14px;background:var(--bg-secondary);border-radius:8px;min-width:72px">
                <div style="font-size:1.8rem;font-weight:800;color:#00b894">${kpis.pending_deliveries}</div>
                <div style="font-size:11px;color:var(--text-muted)">To Deliver</div>
            </div>
            ${kpis.delivery_late > 0 ? `<div style="text-align:center;padding:8px 14px;background:rgba(214,48,49,0.1);border-radius:8px;min-width:72px">
                <div style="font-size:1.8rem;font-weight:800;color:#d63031">${kpis.delivery_late}</div>
                <div style="font-size:11px;color:#d63031">Late</div>
            </div>` : ''}
            ${kpis.delivery_waiting > 0 ? `<div style="text-align:center;padding:8px 14px;background:rgba(225,112,85,0.1);border-radius:8px;min-width:72px">
                <div style="font-size:1.8rem;font-weight:800;color:#e17055">${kpis.delivery_waiting}</div>
                <div style="font-size:11px;color:#e17055">Waiting</div>
            </div>` : ''}
            <div style="text-align:center;padding:8px 14px;background:var(--bg-secondary);border-radius:8px;min-width:72px">
                <div style="font-size:1.8rem;font-weight:800;color:var(--accent-primary)">${kpis.delivery_operations}</div>
                <div style="font-size:11px;color:var(--text-muted)">Operations</div>
            </div>`;

        // ── KPI grid ──
        document.getElementById('kpi-grid').innerHTML = `
            <div class="kpi-card kpi-purple" style="cursor:pointer" onclick="navigate('products')">
                <div class="kpi-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>
                <div class="kpi-value">${kpis.total_products}</div>
                <div class="kpi-label">Total Products</div>
            </div>
            <div class="kpi-card kpi-yellow" style="cursor:pointer" onclick="navigate('products')">
                <div class="kpi-icon yellow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
                <div class="kpi-value">${kpis.low_stock_count}</div>
                <div class="kpi-label">Low Stock <span style="font-size:10px;opacity:0.7">(stock ≤ threshold)</span></div>
            </div>
            <div class="kpi-card kpi-red" style="cursor:pointer" onclick="navigate('products')">
                <div class="kpi-icon red"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
                <div class="kpi-value">${kpis.out_of_stock_count}</div>
                <div class="kpi-label">Out of Stock <span style="font-size:10px;opacity:0.7">(stock = 0)</span></div>
            </div>
            <div class="kpi-card kpi-blue" style="cursor:pointer" onclick="navigate('transfers')">
                <div class="kpi-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></div>
                <div class="kpi-value">${kpis.pending_transfers}</div>
                <div class="kpi-label">Pending Transfers</div>
            </div>`;

        // ── Sidebar badges ──
        const br = document.getElementById('badge-receipts');
        const bd = document.getElementById('badge-deliveries');
        const bs = document.getElementById('badge-stock');
        if (br) br.textContent = kpis.pending_receipts > 0 ? kpis.pending_receipts : '';
        if (bd) bd.textContent = kpis.pending_deliveries > 0 ? kpis.pending_deliveries : '';
        const totalAlerts = (kpis.low_stock_count || 0) + (kpis.out_of_stock_count || 0);
        if (bs) bs.textContent = totalAlerts > 0 ? totalAlerts : '';

        // ── Reorder alerts section ──
        if (kpis.reorder_alerts && kpis.reorder_alerts.length > 0) {
            const alertsEl = document.getElementById('reorder-alerts-section');
            alertsEl.style.display = 'block';
            alertsEl.innerHTML = `<div class="card" style="border-color:rgba(253,203,110,0.3)">
                <div class="card-header">
                    <h3 style="color:#fdcb6e">⚠ Reorder Alerts (${kpis.reorder_alerts.length})</h3>
                    <button class="btn btn-secondary btn-sm" onclick="navigate('settings')">Manage Thresholds</button>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:8px">
                    ${kpis.reorder_alerts.map(a => `
                        <div style="padding:8px 14px;border-radius:8px;background:${a.status==='out'?'rgba(214,48,49,0.1)':'rgba(253,203,110,0.1)'};border:1px solid ${a.status==='out'?'rgba(214,48,49,0.3)':'rgba(253,203,110,0.3)'}">
                            <div style="font-size:12px;font-weight:700;color:${a.status==='out'?'#d63031':'#fdcb6e'}">${a.status==='out'?'OUT OF STOCK':'LOW STOCK'}</div>
                            <div style="font-size:13px;font-weight:600">${escapeHTML(a.name)}</div>
                            <div style="font-size:11px;color:var(--text-muted)">${a.stock} / ${a.threshold} threshold</div>
                        </div>`).join('')}
                </div>
            </div>`;
        }

        // ── Recent Activity ──
        const actEl = document.getElementById('recent-activity');
        if (activity.length === 0) {
            actEl.innerHTML = '<div class="empty-state"><p>No recent activity</p></div>';
        } else {
            actEl.innerHTML = activity.map(e => {
                const isIn = e.qty_change > 0;
                const color = isIn ? '#00b894' : '#d63031';
                const bg = isIn ? 'rgba(0,184,148,0.12)' : 'rgba(214,48,49,0.12)';
                const typeLabel = { receipt: '📥 Receipt', delivery: '📤 Delivery', transfer: '🔄 Transfer', adjustment: '📝 Adjust' };
                const sign = isIn ? '+' : '';
                return `<div class="activity-item">
                    <div style="background:${bg};color:${color};border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">${isIn?'↑':'↓'}</div>
                    <div class="activity-info">
                        <div class="activity-title">${escapeHTML(e.product_name)} — ${escapeHTML(e.ref_number)}</div>
                        <div class="activity-meta">${typeLabel[e.operation_type]||e.operation_type} · ${escapeHTML(e.warehouse_name)} · ${formatDateTime(e.created_at)}</div>
                    </div>
                    <div style="color:${color};font-weight:700;font-size:1rem">${sign}${e.qty_change}</div>
                </div>`;
            }).join('');
        }

        // ── Stock Overview ──
        const soEl = document.getElementById('stock-overview');
        if (stockOverview.length === 0) {
            soEl.innerHTML = '<div class="empty-state"><p>No warehouses configured</p></div>';
        } else {
            const maxStock = Math.max(...stockOverview.map(s => s.total_stock), 1);
            soEl.innerHTML = stockOverview.map(s => {
                const pct = Math.round((s.total_stock / maxStock) * 100);
                return `<div style="margin-bottom:0.75rem">
                    <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:0.3rem">
                        <span><strong>${escapeHTML(s.warehouse_name)}</strong> <span style="color:var(--text-muted)">(${escapeHTML(s.warehouse_code||'')})</span></span>
                        <span style="color:var(--text-secondary)">${s.total_stock} units · ${s.product_count} products</span>
                    </div>
                    <div style="height:8px;background:var(--bg-secondary);border-radius:4px;overflow:hidden">
                        <div style="height:100%;width:${pct}%;background:var(--gradient-primary);border-radius:4px;transition:width 0.5s ease"></div>
                    </div>
                </div>`;
            }).join('');
        }

    } catch (err) {
        document.getElementById('page-content').innerHTML = `<div class="empty-state"><p>Failed to load dashboard: ${err.message}</p></div>`;
    }
}