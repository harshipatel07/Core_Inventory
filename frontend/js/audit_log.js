// ============================================
// audit_log.js — System Audit Log viewer
// ============================================

async function renderAuditLog() {
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="page-header">
            <h1>Audit Log</h1>
            <div class="page-header-actions">
                <button class="btn btn-secondary" onclick="exportAuditCSV()" title="Export to CSV">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export CSV
                </button>
            </div>
        </div>

        <div class="filters-bar" style="flex-wrap:wrap;gap:0.5rem;margin-bottom:1rem;">
            <div style="display:flex;gap:0.5rem;align-items:center;flex:1;min-width:200px;">
                <input class="form-control" id="audit-search" placeholder="Search ref, description, user..."
                    oninput="debounceAuditLoad()" style="max-width:280px;height:36px;font-size:0.85rem;">
            </div>
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                <span style="font-size:0.78rem;color:var(--text-secondary);align-self:center;padding-right:4px;">Module:</span>
                <span class="filter-chip active" onclick="setAuditFilter('module','',this)">All</span>
                <span class="filter-chip" onclick="setAuditFilter('module','product',this)">Products</span>
                <span class="filter-chip" onclick="setAuditFilter('module','warehouse',this)">Warehouses</span>
                <span class="filter-chip" onclick="setAuditFilter('module','receipt',this)">Receipts</span>
                <span class="filter-chip" onclick="setAuditFilter('module','delivery',this)">Deliveries</span>
                <span class="filter-chip" onclick="setAuditFilter('module','transfer',this)">Transfers</span>
                <span class="filter-chip" onclick="setAuditFilter('module','adjustment',this)">Adjustments</span>
            </div>
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
                <span style="font-size:0.78rem;color:var(--text-secondary);align-self:center;padding-right:4px;">Action:</span>
                <span class="filter-chip active" onclick="setAuditFilter('action','',this)">All</span>
                <span class="filter-chip" onclick="setAuditFilter('action','create',this)">Create</span>
                <span class="filter-chip" onclick="setAuditFilter('action','update',this)">Update</span>
                <span class="filter-chip" onclick="setAuditFilter('action','validate',this)">Validate</span>
                <span class="filter-chip" onclick="setAuditFilter('action','cancel',this)">Cancel</span>
                <span class="filter-chip" onclick="setAuditFilter('action','delete',this)">Delete</span>
            </div>
        </div>

        <div class="table-container">
            <table class="data-table">
                <thead><tr>
                    <th style="width:150px">Time</th>
                    <th style="width:110px">Module</th>
                    <th style="width:90px">Action</th>
                    <th style="width:120px">Reference</th>
                    <th>Description</th>
                    <th style="width:120px">Performed By</th>
                </tr></thead>
                <tbody id="audit-tbody"></tbody>
            </table>
        </div>
        <div id="audit-footer" style="padding:0.75rem 0;font-size:0.78rem;color:var(--text-secondary);text-align:right;"></div>
    </div>`;

    window._auditFilters = { module: '', action: '' };
    window._auditDebounce = null;
    await loadAuditLog();
}

// ── Filters ───────────────────────────────────────────────────────────────────

function setAuditFilter(type, value, el) {
    window._auditFilters[type] = value;
    // Update active chip within that filter group
    const allChips = el.parentElement.querySelectorAll('.filter-chip');
    allChips.forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    loadAuditLog();
}

function debounceAuditLoad() {
    clearTimeout(window._auditDebounce);
    window._auditDebounce = setTimeout(loadAuditLog, 300);
}

// ── Load & Render ─────────────────────────────────────────────────────────────

async function loadAuditLog() {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;

    const search = document.getElementById('audit-search')?.value || '';
    const { module, action } = window._auditFilters || {};

    const params = new URLSearchParams();
    if (module) params.set('module', module);
    if (action) params.set('action', action);
    if (search) params.set('search', search);
    params.set('limit', '200');

    try {
        const logs = await API.get(`/audit?${params.toString()}`);

        const tbodyNow = document.getElementById('audit-tbody');
        if (!tbodyNow) return;

        const footer = document.getElementById('audit-footer');

        if (logs.length === 0) {
            tbodyNow.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>No audit entries found</p></div></td></tr>';
            if (footer) footer.textContent = '';
            return;
        }

        tbodyNow.innerHTML = logs.map(log => `<tr>
            <td style="font-size:0.78rem;color:var(--text-secondary);white-space:nowrap;">
                ${formatAuditDate(log.created_at)}
            </td>
            <td>${auditModuleBadge(log.module)}</td>
            <td>${auditActionBadge(log.action)}</td>
            <td style="font-size:0.82rem;font-family:monospace;color:var(--text-primary);">
                ${escapeHTML(log.ref_number || '—')}
            </td>
            <td style="font-size:0.85rem;">${escapeHTML(log.description)}</td>
            <td style="font-size:0.82rem;color:var(--text-secondary);">
                ${escapeHTML(log.performed_by || 'system')}
            </td>
        </tr>`).join('');

        if (footer) {
            footer.textContent = `Showing ${logs.length} most recent entries`;
        }

        // Store logs for CSV export
        window._auditLogsCache = logs;

    } catch (err) {
        const tbodyErr = document.getElementById('audit-tbody');
        if (tbodyErr) {
            tbodyErr.innerHTML = '<tr><td colspan="6"><div class="empty-state"><p>Failed to load audit log</p></div></td></tr>';
        }
        showToast('Failed to load audit log', 'error');
    }
}

// ── Badges ────────────────────────────────────────────────────────────────────

function auditModuleBadge(module) {
    const map = {
        product:    { color: '#6C5CE7', bg: '#6C5CE715', label: 'Product' },
        warehouse:  { color: '#0984E3', bg: '#0984E315', label: 'Warehouse' },
        receipt:    { color: '#00B894', bg: '#00B89415', label: 'Receipt' },
        delivery:   { color: '#FDCB6E', bg: '#FDCB6E15', label: 'Delivery' },
        transfer:   { color: '#A29BFE', bg: '#A29BFE15', label: 'Transfer' },
        adjustment: { color: '#E17055', bg: '#E1705515', label: 'Adjustment' },
    };
    const m = map[module?.toLowerCase()] || { color: '#888', bg: '#88888815', label: module || '—' };
    return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;background:${m.bg};color:${m.color};">${m.label}</span>`;
}

function auditActionBadge(action) {
    const map = {
        create:   { color: '#00B894', bg: '#00B89415' },
        update:   { color: '#0984E3', bg: '#0984E315' },
        validate: { color: '#6C5CE7', bg: '#6C5CE715' },
        cancel:   { color: '#E17055', bg: '#E1705515' },
        delete:   { color: '#D63031', bg: '#D6303115' },
    };
    const a = map[action?.toLowerCase()] || { color: '#888', bg: '#88888815' };
    const label = action ? action.charAt(0).toUpperCase() + action.slice(1) : '—';
    return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;background:${a.bg};color:${a.color};">${label}</span>`;
}

// ── Date Formatter ────────────────────────────────────────────────────────────

function formatAuditDate(isoString) {
    if (!isoString) return '—';
    try {
        const d = new Date(isoString);
        const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `${date}<br><span style="color:var(--text-secondary)">${time}</span>`;
    } catch {
        return isoString;
    }
}

// ── CSV Export ────────────────────────────────────────────────────────────────

function exportAuditCSV() {
    const logs = window._auditLogsCache;
    if (!logs || logs.length === 0) {
        showToast('No audit data to export', 'error');
        return;
    }

    const headers = ['Time', 'Module', 'Action', 'Reference', 'Description', 'Performed By'];
    const rows = logs.map(log => [
        new Date(log.created_at).toISOString(),
        log.module || '',
        log.action || '',
        log.ref_number || '',
        `"${(log.description || '').replace(/"/g, '""')}"`,
        log.performed_by || 'system',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Audit log exported!', 'success');
}