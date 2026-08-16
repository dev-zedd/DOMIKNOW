(function () {
    'use strict';

    const form = document.getElementById('registerForm');
    if (!form) return;

    const panels = [...document.querySelectorAll('[data-registration-step]')];
    const indicators = [...document.querySelectorAll('[data-step-indicator]')];
    const backButton = document.getElementById('registrationBack');
    const nextButton = document.getElementById('registrationNext');
    const submitButton = document.getElementById('submitBtn');
    const stepCount = document.getElementById('registrationStepCount');
    const stepTitle = document.getElementById('registrationStepTitle');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm_password');
    const passwordToggle = document.getElementById('togglePassword');
    const passwordStrength = document.getElementById('passwordStrength');
    const totalSteps = panels.length;
    const titles = ['Choose your workspace', 'Complete your profile', 'Secure your account', 'Review and create'];
    const roleNames = {
        tenant: 'Tenant',
        landlord: 'Landlord'
    };
    let currentStep = 1;

    submitButton.dataset.defaultLabel = 'Create account';

    const requestedRole = new URLSearchParams(window.location.search).get('role');
    const requestedRoleInput = [...form.querySelectorAll('input[name="role"]')]
        .find(input => input.value === requestedRole);
    if (requestedRoleInput) requestedRoleInput.checked = true;

    preserveRedirectParameters();
    updateStep(1, false);

    backButton.addEventListener('click', () => updateStep(currentStep - 1));
    nextButton.addEventListener('click', () => {
        if (!validateStep(currentStep)) return;
        updateStep(currentStep + 1);
    });

    form.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || currentStep >= totalSteps || event.target.matches('textarea, button')) return;
        event.preventDefault();
        nextButton.click();
    });

    form.addEventListener('input', event => {
        if (!event.target.matches('input, textarea, select')) return;
        clearFieldError(event.target.id);
        if (currentStep === totalSteps) updateReview();
    });

    form.addEventListener('change', event => {
        if (event.target.name === 'role') updateReview();
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (currentStep < totalSteps) {
            nextButton.click();
            return;
        }
        if (!validateStep(2) || !validateStep(3)) return;
        await handleRegister(event);
    });

    passwordToggle.addEventListener('click', () => {
        const reveal = passwordInput.type === 'password';
        passwordInput.type = reveal ? 'text' : 'password';
        confirmPasswordInput.type = reveal ? 'text' : 'password';
        passwordToggle.textContent = reveal ? 'Hide' : 'Show';
        passwordToggle.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
    });

    passwordInput.addEventListener('input', renderPasswordStrength);

    function updateStep(nextStep, moveFocus = true) {
        if (nextStep < 1 || nextStep > totalSteps) return;
        currentStep = nextStep;
        panels.forEach(panel => {
            const panelStep = Number(panel.dataset.registrationStep);
            const active = panelStep === currentStep;
            panel.hidden = !active;
            panel.classList.toggle('is-active', active);
        });
        indicators.forEach(indicator => {
            const indicatorStep = Number(indicator.dataset.stepIndicator);
            indicator.classList.toggle('is-active', indicatorStep === currentStep);
            indicator.classList.toggle('is-complete', indicatorStep < currentStep);
            if (indicatorStep === currentStep) indicator.setAttribute('aria-current', 'step');
            else indicator.removeAttribute('aria-current');
        });

        stepCount.textContent = `Step ${currentStep} of ${totalSteps}`;
        stepTitle.textContent = titles[currentStep - 1];
        backButton.hidden = currentStep === 1;
        nextButton.hidden = currentStep === totalSteps;
        submitButton.hidden = currentStep !== totalSteps;
        if (currentStep === totalSteps) updateReview();

        if (moveFocus) {
            const heading = panels[currentStep - 1].querySelector('h2');
            heading?.setAttribute('tabindex', '-1');
            heading?.focus({ preventScroll: true });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function validateStep(step) {
        clearStepErrors(step);
        let valid = true;
        let firstInvalid = null;

        if (step === 1 && !form.querySelector('input[name="role"]:checked')) {
            valid = false;
            firstInvalid = form.querySelector('input[name="role"]');
        }

        if (step === 2) {
            const fullName = document.getElementById('full_name');
            const value = fullName.value.trim();
            if (!value) {
                showFieldError('full_name', 'Enter your full name.');
                valid = false;
                firstInvalid ||= fullName;
            } else if (value.length < 2) {
                showFieldError('full_name', 'Full name must contain at least two characters.');
                valid = false;
                firstInvalid ||= fullName;
            }
        }

        if (step === 3) {
            const email = document.getElementById('email');
            const password = passwordInput.value;
            const confirmation = confirmPasswordInput.value;
            if (!email.value.trim()) {
                showFieldError('email', 'Enter your email address.');
                valid = false;
                firstInvalid ||= email;
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
                showFieldError('email', 'Enter a valid email address.');
                valid = false;
                firstInvalid ||= email;
            }
            if (!password) {
                showFieldError('password', 'Create a password.');
                valid = false;
                firstInvalid ||= passwordInput;
            } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
                showFieldError('password', 'Use at least 8 characters with uppercase, lowercase, and a number.');
                valid = false;
                firstInvalid ||= passwordInput;
            }
            if (!confirmation) {
                showFieldError('confirm_password', 'Repeat your password.');
                valid = false;
                firstInvalid ||= confirmPasswordInput;
            } else if (password !== confirmation) {
                showFieldError('confirm_password', 'The passwords do not match.');
                valid = false;
                firstInvalid ||= confirmPasswordInput;
            }
        }

        if (!valid) {
            if (step !== currentStep) updateStep(step, false);
            firstInvalid?.focus();
        }
        return valid;
    }

    function showFieldError(fieldId, message) {
        const input = document.getElementById(fieldId);
        const error = document.getElementById(`${fieldId}_error`);
        input?.setAttribute('aria-invalid', 'true');
        input?.classList.add('is-invalid');
        if (error) {
            error.textContent = message;
            input?.setAttribute('aria-describedby', error.id);
        }
    }

    function clearFieldError(fieldId) {
        if (!fieldId) return;
        const input = document.getElementById(fieldId);
        const error = document.getElementById(`${fieldId}_error`);
        input?.removeAttribute('aria-invalid');
        input?.classList.remove('is-invalid');
        if (error) error.textContent = '';
    }

    function clearStepErrors(step) {
        panels[step - 1]?.querySelectorAll('.form-input, .form-textarea, .form-select').forEach(input => clearFieldError(input.id));
    }

    function updateReview() {
        const role = form.querySelector('input[name="role"]:checked')?.value;
        document.getElementById('reviewRole').textContent = roleNames[role] || 'Not selected';
        document.getElementById('reviewName').textContent = document.getElementById('full_name').value.trim() || '—';
        document.getElementById('reviewEmail').textContent = document.getElementById('email').value.trim() || '—';
        document.getElementById('reviewContact').textContent = document.getElementById('contact_number').value.trim() || 'Not provided';
        document.getElementById('reviewAddress').textContent = document.getElementById('address').value.trim() || 'Not provided';
        const requiresApproval = role === 'landlord';
        document.getElementById('reviewNextTitle').textContent = requiresApproval
            ? 'Next: email verification, then approval'
            : 'Next: verify your email';
        document.getElementById('reviewNextText').textContent = requiresApproval
            ? 'After email verification, an administrator reviews this role before workspace access is enabled.'
            : 'A six-digit code will be sent to the email above. Tenant access opens after verification and sign-in.';
    }

    function renderPasswordStrength() {
        const password = passwordInput.value;
        passwordStrength.replaceChildren();
        if (!password) return;

        const checks = [
            password.length >= 8,
            /[a-z]/.test(password),
            /[A-Z]/.test(password),
            /\d/.test(password),
            /[^a-zA-Z0-9]/.test(password)
        ];
        const score = checks.filter(Boolean).length;
        const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
        const row = document.createElement('div');
        row.className = 'password-strength__row';
        const track = document.createElement('span');
        track.className = 'password-strength__track';
        const fill = document.createElement('span');
        fill.className = 'password-strength__fill';
        fill.style.width = `${Math.max(score, 1) * 20}%`;
        track.appendChild(fill);
        const label = document.createElement('strong');
        label.textContent = labels[Math.max(score - 1, 0)];
        row.append(track, label);
        passwordStrength.dataset.score = String(score);
        passwordStrength.appendChild(row);
    }

    function preserveRedirectParameters() {
        const redirect = new URLSearchParams(window.location.search).get('redirect');
        if (!redirect) return;
        document.querySelectorAll('[data-preserve-redirect]').forEach(link => {
            const url = new URL(link.href, window.location.href);
            url.searchParams.set('redirect', redirect);
            link.href = `${url.pathname}${url.search}`;
        });
    }
})();
