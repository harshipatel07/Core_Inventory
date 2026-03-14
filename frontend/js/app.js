// ============================================
// app.js — SPA Router & App Initialization
// ============================================

const PAGES = {
    dashboard: renderDashboard,
    products: renderProducts,
    stock: renderStock,
    receipts: renderReceipts,
    deliveries: renderDeliveries,
    transfers: renderTransfers,
    adjustments: renderAdjustments,
    ledger: renderLedger,
    warehouses: renderWarehouses,
    settings: renderSettings,
    profile: renderProfile,
};

let currentPage = 'dashboard';

function navigate(page) {
    if (!PAGES[page]) return;
    currentPage = page;
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });
    PAGES[page]();
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('ims_token');
    if (token) {
        showApp();
    } else {
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app-layout').style.display = 'none';
    }
});