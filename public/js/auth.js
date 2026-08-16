// Base API URL
const API_BASE_URL = '/api';

// Helper to show error
function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
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
    const defaultLabel = submitBtn.dataset.defaultLabel || submitBtn.textContent.trim() || 'Create account';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    if (data.password !== data.confirm_password) {
        showError('Passwords do not match');
        submitBtn.disabled = false;
        submitBtn.textContent = defaultLabel;
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
            const redirectUrl = new URLSearchParams(window.location.search).get('redirect');
            if (redirectUrl) verifyParams.set('redirect', redirectUrl);
            window.location.href = `verify-code.html?${verifyParams.toString()}`;
        } else {
            showError(result.message || 'Registration failed');
        }
    } catch (error) {
        showError('An error occurred during registration');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = defaultLabel;
    }
}

// Handle Verification
async function handleVerify(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying...';

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
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify';
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
    resendBtn.disabled = true;
    resendBtn.textContent = 'Sending...';

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
        resendBtn.disabled = false;
        resendBtn.textContent = "Didn't receive the code? Resend";
    }
}

// Handle Login
async function handleLogin(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

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
            const redirectUrl = urlParams.get('redirect');
            if (redirectUrl) {
                window.location.href = decodeURIComponent(redirectUrl);
            } else {
                // Redirect based on role
                const role = result.data.user.role;
                if (role === 'tenant') window.location.href = '../tenant/properties.html';
                else if (role === 'landlord') window.location.href = '../landlord/properties.html';
                else if (role === 'maintenance') window.location.href = '../maintenance/dashboard.html';
                else if (role === 'admin') window.location.href = '../admin/overview.html';
            }
        } else {
            showError(result.message || 'Login failed');
        }
    } catch (error) {
        showError('An error occurred during login');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in';
    }
}

// Shared logout function. Every shell routes through this guarded confirmation.
let logoutConfirmationPending = false;
async function logout() {
    if (logoutConfirmationPending) return false;
    logoutConfirmationPending = true;

    try {
        const shouldLogout = await window.domiknowConfirm({
            variant: 'warning',
            eyebrow: 'End your session',
            title: 'Log out of DOMIKNOW?',
            message: 'You will need to sign in again to access your account and continue your current work.',
            confirmLabel: 'Log out',
            cancelLabel: 'Stay signed in'
        });

        if (!shouldLogout) return false;

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
