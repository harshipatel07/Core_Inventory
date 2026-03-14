// ============================================
// auth.js — Login, Signup, OTP reset handlers
// ============================================

function showAuthForm(form) {
    document.getElementById('login-form').style.display = form === 'login' ? 'block' : 'none';
    document.getElementById('signup-form').style.display = form === 'signup' ? 'block' : 'none';
    document.getElementById('forgot-form').style.display = form === 'forgot' ? 'block' : 'none';
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const data = await API.post('/auth/login', { email, password });
        localStorage.setItem('ims_token', data.access_token);
        localStorage.setItem('ims_user', JSON.stringify(data.user));
        showToast('Welcome back!', 'success');
        showApp();
    } catch (err) {
        showToast(err.message || 'Login failed', 'error');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const role = document.getElementById('signup-role').value;
    try {
        const data = await API.post('/auth/signup', { name, email, password, role });
        localStorage.setItem('ims_token', data.access_token);
        localStorage.setItem('ims_user', JSON.stringify(data.user));
        showToast('Account created!', 'success');
        showApp();
    } catch (err) {
        showToast(err.message || 'Signup failed', 'error');
    }
}

async function handleRequestOTP(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    try {
        const data = await API.post('/auth/request-otp', { email });
        document.getElementById('otp-section').style.display = 'block';
        showToast(`OTP sent! (Demo OTP: ${data.otp})`, 'info');
    } catch (err) {
        showToast(err.message || 'Failed to send OTP', 'error');
    }
}

async function handleResetPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value;
    const otp = document.getElementById('otp-code').value;
    const new_password = document.getElementById('new-password').value;
    try {
        await API.post('/auth/reset-password', { email, otp, new_password });
        showToast('Password reset! Please login.', 'success');
        showAuthForm('login');
    } catch (err) {
        showToast(err.message || 'Reset failed', 'error');
    }
}

function handleLogout() {
    localStorage.removeItem('ims_token');
    localStorage.removeItem('ims_user');
    document.getElementById('app-layout').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'flex';
    showToast('Logged out', 'info');
}

function showApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app-layout').style.display = 'flex';
    const user = JSON.parse(localStorage.getItem('ims_user') || '{}');
    const initials = (user.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase();
    document.getElementById('sidebar-avatar').textContent = initials;
    document.getElementById('sidebar-name').textContent = user.name || 'User';
    document.getElementById('sidebar-role').textContent = user.role || 'staff';
    navigate('dashboard');
}
