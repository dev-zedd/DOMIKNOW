// Base API URL
const API_BASE_URL = '/api';

function domiknowSafeAuthRedirect(rawRedirect, role = null) {
    if (!rawRedirect) return null;
    try {
        const target = new URL(String(rawRedirect), window.location.origin);
        if (target.origin !== window.location.origin || target.username || target.password) return null;
        if (!target.pathname.startsWith('/pages/')) return null;
        if (role) {
            const rolePrefix = {
                tenant: '/pages/tenant/',
                landlord: '/pages/landlord/',
                maintenance: '/pages/maintenance/',
                admin: '/pages/admin/'
            }[role];
            if (!rolePrefix || !target.pathname.startsWith(rolePrefix)) return null;
        }
        return `${target.pathname}${target.search}${target.hash}`;
    } catch (error) {
        return null;
    }
}
window.domiknowSafeAuthRedirect = domiknowSafeAuthRedirect;

function setAuthButtonLoading(button, loading, label) {
    if (!button) return;
    if (window.DomiKnowLoading) {
        window.DomiKnowLoading.setButton(button, loading, label);
        return;
    }
    if (loading) {
        button.dataset.authDefaultHtml ||= button.innerHTML;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.textContent = label || 'Working…';
    } else {
        button.disabled = false;
        button.removeAttribute('aria-busy');
        if (button.dataset.authDefaultHtml) button.innerHTML = button.dataset.authDefaultHtml;
    }
}

function prepareAuthMessage(element, variant) {
    if (!element) return;
    element.classList.toggle('alert-danger', variant === 'error');
    element.classList.toggle('alert-success', variant === 'success');
    element.setAttribute('role', variant === 'error' ? 'alert' : 'status');
    element.setAttribute('aria-live', variant === 'error' ? 'assertive' : 'polite');
}

// Helper to show error
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        prepareAuthMessage(errorDiv, 'error');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
        setTimeout(() => errorDiv.classList.add('hidden'), 5000);
    } else {
        alert(message);
    }
}

// Helper to show success
function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    if (successDiv) {
        prepareAuthMessage(successDiv, 'success');
        successDiv.textContent = message;
        successDiv.classList.remove('hidden');
        setTimeout(() => successDiv.classList.add('hidden'), 5000);
    } else {
        alert(message);
    }
}

// Handle Registration
async function handleRegister(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    setAuthButtonLoading(submitBtn, true, 'Creating account…');

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    if (data.password !== data.confirm_password) {
        showError('Passwords do not match');
        setAuthButtonLoading(submitBtn, false);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            // Redirect to verify page with email
            const verifyParams = new URLSearchParams({ email: data.email });
            const redirectUrl = domiknowSafeAuthRedirect(new URLSearchParams(window.location.search).get('redirect'));
            if (redirectUrl) verifyParams.set('redirect', redirectUrl);
            window.location.href = `verify-code.html?${verifyParams.toString()}`;
        } else {
            showError(result.message || 'Registration failed');
        }
    } catch (error) {
        showError('An error occurred during registration');
    } finally {
        setAuthButtonLoading(submitBtn, false);
    }
}

// Handle Verification
async function handleVerify(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    setAuthButtonLoading(submitBtn, true, 'Verifying email…');

    const formData = new FormData(e.target);
    const data = {
        email: formData.get('email'),
        verification_code: formData.get('code')
    };

    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            showSuccess(result.message);
            document.getElementById('verifyForm').classList.add('hidden');
            document.getElementById('resendBtn').classList.add('hidden');
            const pendingApproval = result.data?.account_status === 'pending';
            const statusTitle = document.getElementById('verifyStatusTitle');
            const statusText = document.getElementById('verifyStatusText');
            if (statusTitle) statusTitle.lastChild.textContent = pendingApproval
                ? ' Email verified — approval pending'
                : ' Email verified successfully!';
            if (statusText) statusText.textContent = pendingApproval
                ? 'An administrator must approve your role before you can sign in. You will be able to access your workspace after approval.'
                : 'Your tenant account is ready. Continue to sign in and open your workspace.';
            document.getElementById('postVerifyActions').classList.remove('hidden');
        } else {
            showError(result.message || 'Verification failed');
        }
    } catch (error) {
        showError('An error occurred during verification');
    } finally {
        setAuthButtonLoading(submitBtn, false);
    }
}

// Handle Resend Code
async function handleResendCode() {
    const email = document.getElementById('email').value;
    if (!email) {
        showError('Please enter your email address first');
        return;
    }

    const resendBtn = document.getElementById('resendBtn');
    setAuthButtonLoading(resendBtn, true, 'Sending code…');

    try {
        const response = await fetch(`${API_BASE_URL}/auth/resend-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (response.ok) {
            showSuccess(result.message);
        } else {
            showError(result.message || 'Failed to resend code');
        }
    } catch (error) {
        showError('An error occurred while resending code');
    } finally {
        setAuthButtonLoading(resendBtn, false);
    }
}

// Helper to show verify notice with a direct action button
function showVerifyNotice(message, email) {
    const errorDiv = document.getElementById('errorMessage');
    const emailParam = email ? `?email=${encodeURIComponent(email)}` : '';
    const verifyUrl = `verify-code.html${emailParam}`;
    
    if (errorDiv) {
        prepareAuthMessage(errorDiv, 'error');
        errorDiv.replaceChildren();
        const content = document.createElement('div');
        content.className = 'auth-alert-action';
        const text = document.createElement('span');
        text.textContent = message;
        const link = document.createElement('a');
        link.href = verifyUrl;
        link.className = 'btn-primary auth-alert-action__button';
        link.textContent = 'Enter verification code';
        content.append(text, link);
        errorDiv.appendChild(content);
        errorDiv.classList.remove('hidden');
    } else {
        if (confirm(`${message}\n\nDo you want to go to the verification page now?`)) {
            window.location.href = verifyUrl;
        }
    }
}

// Handle Login
async function handleLogin(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    setAuthButtonLoading(submitBtn, true, 'Signing in…');

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            // Save token and role
            localStorage.setItem('domiknow_token', result.data.token);
            localStorage.setItem('domiknow_role', result.data.user.role);
            
            // Check for redirect parameter
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUrl = domiknowSafeAuthRedirect(urlParams.get('redirect'), result.data.user.role);
            if (redirectUrl) {
                window.location.href = redirectUrl;
            } else {
                // Redirect based on role
                const role = result.data.user.role;
                if (role === 'tenant') window.location.href = '../tenant/properties.html';
                else if (role === 'landlord') window.location.href = '../landlord/properties.html';
                else if (role === 'maintenance') window.location.href = '../maintenance/dashboard.html';
                else if (role === 'admin') window.location.href = '../admin/overview.html';
            }
        } else {
            const errorMsg = result.message || 'Login failed';
            if (response.status === 403 && errorMsg.toLowerCase().includes('verify')) {
                showVerifyNotice(errorMsg, data.email);
            } else {
                showError(errorMsg);
            }
        }
    } catch (error) {
        showError('An error occurred during login');
    } finally {
        setAuthButtonLoading(submitBtn, false);
    }
}

// Shared logout function. Every shell routes through this guarded confirmation.
let logoutConfirmationPending = false;
async function logout() {
    if (logoutConfirmationPending) return false;
    logoutConfirmationPending = true;

    try {
        const shouldLogout = await window.domiknowConfirm({
            variant: 'danger',
            eyebrow: 'End your session',
            title: 'Log out of DOMIKNOW?',
            message: 'You will need to sign in again to access your account and continue your current work.',
            confirmLabel: 'Log out',
            cancelLabel: 'Stay signed in'
        });

        if (!shouldLogout) return false;

        if (window.landlordCache) window.landlordCache.invalidateAll();
        localStorage.removeItem('domiknow_token');
        localStorage.removeItem('domiknow_role');
        window.location.href = '/pages/auth/login.html';
        return true;
    } finally {
        logoutConfirmationPending = false;
    }
}
window.logout = logout;

// Set up logout buttons if they exist
document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => window.logout());
    }
});
