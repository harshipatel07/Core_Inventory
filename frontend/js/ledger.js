// ============================================
// ledger.js — Move History
// Spec: Reference | Date | Contact | From | To | Quantity | Status
//       IN moves = green row, OUT moves = red row
//       List + Kanban toggle, search
// ============================================

let _ledgerCache  = [];
let _ledgerView   = 'list';

async function renderLedger() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="rcpt-page-header">
            <h1 class="rcpt-title">Move History</h1>
            <div class="rcpt-search-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" id="ledger-search" placeholder="Search by reference or contact..." oninput="filterLedger()">
            </div>
            <div class="rcpt-view-toggle">
                <button id="ledger-toggle-list" class="rcpt-toggle-btn active" title="List view" onclick="switchLedgerView('list')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
                <button id="ledger-toggle-kanban" class="rcpt-toggle-btn" title="Kanban view" onclick="switchLedgerView('kanban')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                </button>
            </div>
        </div>
        <div id="ledger-content">
            <div class="rcpt-loading"><div class="loading-spinner"></div><span>Loading history...</span></div>
        </div>
    </div>`;
    await loadLedger();
}

async function loadLedger() {
    try {
        _ledgerCache = await API.get('/ledger?limit=200');
        renderLedgerContent(_ledgerCache);
    } catch (err) {
        showToast('Failed to load move history', 'error');
    }
}

function filterLedger() {
    const q = (document.getElementById('ledger-search')?.value || '').toLowerCase();
    const filtered = _ledgerCache.filter(e =>
        e.ref_number.toLowerCase().includes(q) ||
        (e.contact || '').toLowerCase().includes(q) ||
        (e.product_name || '').toLowerCase().includes(q)
    );
    renderLedgerContent(filtered);
}

function switchLedgerView(view) {
    _ledgerView = view;
    document.getElementById('ledger-toggle-list')?.classList.toggle('active', view === 'list');
    document.getElementById('ledger-toggle-kanban')?.classList.toggle('active', view === 'kanban');
    const q = (document.getElementById('ledger-search')?.value || '').toLowerCase();
    const filtered = q ? _ledgerCache.filter(e =>
        e.ref_number.toLowerCase().includes(q) || (e.contact || '').toLowerCase().includes(q)
    ) : _ledgerCache;
    renderLedgerContent(filtered);
}

function renderLedgerContent(entries) {
    if (_ledgerView === 'kanban') renderLedgerKanban(entries);
    else renderLedgerList(entries);
}


// ── LIST VIEW ──────────────────────────────

function renderLedgerList(entries) {
    const area = document.getElementById('ledger-content');
    if (!area) return;

    if (entries.length === 0) {
        area.innerHTML = '<div class="empty-state" style="padding:4rem"><p>No movement history found</p></div>';
        return;
    }

    area.innerHTML = `<div class="table-container">
        <table class="data-table">
            <thead>
                <tr>
                    <th>Reference</th>
                    <th>Date</th>
                    <th>Contact</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Product</th>
                    <th style="text-align:right">Quantity</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${entries.map(e => {
                    const isIn  = e.qty_change > 0;
                    const rowCls = isIn ? 'ledger-row-in' : 'ledger-row-out';
                    const sign   = isIn ? '+' : '';
                    const qtyColor = isIn ? 'var(--accent-secondary)' : 'var(--accent-danger)';
                    const typeIcon = {
                        receipt:    '📥',
                        delivery:   '📤',
                        transfer:   '🔄',
                        adjustment: '📝',
                    }[e.operation_type] || '•';

                    return `<tr class="${rowCls}">
                        <td>
                            <div style="display:flex;align-items:center;gap:6px">
                                <span style="font-size:0.9rem">${typeIcon}</span>
                                <span style="font-family:monospace;font-size:0.8rem;font-weight:700;color:var(--text-accent)">${escapeHTML(e.ref_number)}</span>
                            </div>
                        </td>
                        <td style="color:var(--text-secondary);font-size:0.8rem">${formatDate(e.created_at)}</td>
                        <td>${escapeHTML(e.contact || '—')}</td>
                        <td>
                            <span class="loc-tag loc-tag-from">${escapeHTML(e.from_location || '—')}</span>
                        </td>
                        <td>
                            <span class="loc-tag loc-tag-to">${escapeHTML(e.to_location || '—')}</span>
                        </td>
                        <td style="font-size:0.82rem">${escapeHTML(e.product_name)}</td>
                        <td style="text-align:right;font-weight:700;color:${qtyColor}">${sign}${e.qty_change}</td>
                        <td>${e.status ? statusBadge(e.status) : '—'}</td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>
    <p style="font-size:0.73rem;color:var(--text-muted);margin-top:0.75rem;display:flex;gap:1.5rem;align-items:center;padding:0 0.25rem">
        <span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;background:rgba(0,184,148,0.15);border-left:3px solid #00B894;display:inline-block"></span>IN moves (receipts)</span>
        <span style="display:flex;align-items:center;gap:6px"><span style="width:12px;height:12px;background:rgba(225,112,85,0.15);border-left:3px solid #E17055;display:inline-block"></span>OUT moves (deliveries)</span>
    </p>`;
}


// ── KANBAN VIEW ────────────────────────────

function renderLedgerKanban(entries) {
    const area = document.getElementById('ledger-content');
    if (!area) return;

    const cols = [
        { key: 'receipt',    label: 'Receipts (IN)',   color: '#00B894', bg: 'rgba(0,184,148,0.08)'   },
        { key: 'delivery',   label: 'Deliveries (OUT)', color: '#E17055', bg: 'rgba(225,112,85,0.08)'  },
        { key: 'transfer',   label: 'Transfers',        color: '#0984E3', bg: 'rgba(9,132,227,0.08)'   },
        { key: 'adjustment', label: 'Adjustments',      color: '#FDCB6E', bg: 'rgba(253,203,110,0.08)' },
    ];

    area.innerHTML = `<div class="kanban-board">
        ${cols.map(col => {
            const colEntries = entries.filter(e => e.operation_type === col.key);
            return `<div class="kanban-col">
                <div class="kanban-col-header" style="border-top:3px solid ${col.color};background:${col.bg}">
                    <span class="kanban-col-label" style="color:${col.color}">${col.label}</span>
                    <span class="kanban-col-count" style="background:${col.color}20;color:${col.color}">${colEntries.length}</span>
                </div>
                <div class="kanban-cards">
                    ${colEntries.length === 0
                        ? '<div class="kanban-empty">No entries</div>'
                        : colEntries.map(e => {
                            const isIn = e.qty_change > 0;
                            const sign = isIn ? '+' : '';
                            const qtyColor = isIn ? '#00B894' : '#E17055';
                            return `<div class="kanban-card" style="border-left:3px solid ${col.color}">
                                <div class="kanban-card-ref">${escapeHTML(e.ref_number)}</div>
                                <div class="kanban-card-row" style="font-weight:600;font-size:0.8rem">${escapeHTML(e.product_name)}</div>
                                <div class="kanban-card-row"><span style="color:var(--text-muted)">Contact:</span> ${escapeHTML(e.contact || '—')}</div>
                                <div class="kanban-card-row">
                                    <span class="loc-tag loc-tag-from" style="font-size:0.68rem">${escapeHTML(e.from_location || '—')}</span>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                                    <span class="loc-tag loc-tag-to" style="font-size:0.68rem">${escapeHTML(e.to_location || '—')}</span>
                                </div>
                                <div class="kanban-card-footer">
                                    <span style="font-weight:700;color:${qtyColor}">${sign}${e.qty_change}</span>
                                    <span class="kanban-date">${formatDate(e.created_at)}</span>
                                </div>
                            </div>`;
                        }).join('')}
                </div>
            </div>`;
        }).join('')}
    </div>`;
}