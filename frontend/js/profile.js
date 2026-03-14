// ============================================
// profile.js — User profile page
// ============================================

async function renderProfile() {
    const user = JSON.parse(localStorage.getItem('ims_user') || '{}');
    const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase();
    const content = document.getElementById('page-content');
    content.innerHTML = `<div class="animate-in">
        <div class="page-header"><h1>My Profile</h1></div>
        <div class="card profile-card" style="max-width:500px">
            <div class="profile-avatar-lg">${initials}</div>
            <div style="text-align:center;margin-bottom:1.5rem">
                <h2 style="font-size:1.3rem;font-weight:700">${escapeHTML(user.name || 'User')}</h2>
                <p style="color:var(--text-secondary);font-size:0.85rem">${escapeHTML(user.email || '')}</p>
                <span class="status-badge badge-done" style="margin-top:0.5rem;display:inline-block">${(user.role || 'staff').charAt(0).toUpperCase() + (user.role || 'staff').slice(1)}</span>
            </div>
            <div style="border-top:1px solid var(--border-color);padding-top:1rem">
                <div style="display:flex;justify-content:space-between;padding:0.5rem 0;font-size:0.85rem">
                    <span style="color:var(--text-secondary)">User ID</span>
                    <span><code style="font-size:0.75rem">${user.id || '—'}</code></span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:0.5rem 0;font-size:0.85rem">
                    <span style="color:var(--text-secondary)">Role</span>
                    <span>${user.role || 'staff'}</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:0.5rem 0;font-size:0.85rem">
                    <span style="color:var(--text-secondary)">Status</span>
                    <span class="status-badge badge-done">Active</span>
                </div>
            </div>
            <button class="btn btn-danger btn-block" style="margin-top:1.5rem" onclick="handleLogout()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Logout
            </button>
        </div>
    </div>`;
}
