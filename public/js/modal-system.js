(function () {
    'use strict';

    if (window.DomiKnowModal) return;

    const ICONS = {
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
        success: '<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16.5 9"/>',
        warning: '<path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v4M12 16h.01"/>',
        danger: '<path d="M5 5l14 14M19 5 5 19"/><circle cx="12" cy="12" r="9"/>'
    };

    const DEFAULTS = {
        info: { eyebrow: 'DOMIKNOW notice', title: 'Please review' },
        success: { eyebrow: 'Action completed', title: 'Success' },
        warning: { eyebrow: 'Confirmation required', title: 'Continue with this action?' },
        danger: { eyebrow: 'Important warning', title: 'Confirm this action' }
    };

    let shell = null;
    let activeResolve = null;
    let activeOptions = null;
    let returnFocus = null;
    let queue = Promise.resolve();

    function createIcon(variant) {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[variant] || ICONS.info}</svg>`;
    }

    function ensureShell() {
        if (shell?.root?.isConnected) return shell;

        const root = document.createElement('div');
        root.className = 'dk-modal-root';
        root.hidden = true;
        root.innerHTML = `
            <div class="dk-modal-backdrop" data-dk-dismiss></div>
            <section class="dk-modal-dialog modal-container" tabindex="-1" aria-modal="true" aria-labelledby="dkModalTitle" aria-describedby="dkModalMessage">
                <div class="dk-modal-accent" aria-hidden="true"></div>
                <header class="dk-modal-header modal-header">
                    <span class="dk-modal-icon" data-dk-icon aria-hidden="true"></span>
                    <div class="dk-modal-heading">
                        <p class="dk-modal-eyebrow" data-dk-eyebrow></p>
                        <h2 class="dk-modal-title modal-title" id="dkModalTitle" data-dk-title></h2>
                    </div>
                    <button type="button" class="dk-modal-close modal-close" data-dk-cancel aria-label="Close dialog">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
                    </button>
                </header>
                <div class="dk-modal-body modal-body">
                    <p class="dk-modal-message modal-desc" id="dkModalMessage" data-dk-message></p>
                    <ul class="dk-modal-details" data-dk-details hidden></ul>
                    <label class="dk-modal-field" data-dk-field hidden>
                        <span class="dk-modal-label" data-dk-input-label></span>
                        <textarea class="dk-modal-input" data-dk-textarea></textarea>
                        <input class="dk-modal-input" data-dk-input />
                        <span class="dk-modal-field-error" data-dk-error hidden></span>
                    </label>
                </div>
                <footer class="dk-modal-footer modal-footer">
                    <button type="button" class="dk-modal-button dk-modal-button--secondary btn btn-secondary" data-dk-cancel>Cancel</button>
                    <button type="button" class="dk-modal-button dk-modal-button--primary btn btn-primary" data-dk-confirm>Continue</button>
                </footer>
            </section>
        `;
        document.body.appendChild(root);

        shell = {
            root,
            dialog: root.querySelector('.dk-modal-dialog'),
            icon: root.querySelector('[data-dk-icon]'),
            eyebrow: root.querySelector('[data-dk-eyebrow]'),
            title: root.querySelector('[data-dk-title]'),
            message: root.querySelector('[data-dk-message]'),
            details: root.querySelector('[data-dk-details]'),
            field: root.querySelector('[data-dk-field]'),
            inputLabel: root.querySelector('[data-dk-input-label]'),
            input: root.querySelector('[data-dk-input]'),
            textarea: root.querySelector('[data-dk-textarea]'),
            error: root.querySelector('[data-dk-error]'),
            confirm: root.querySelector('[data-dk-confirm]'),
            cancelButtons: Array.from(root.querySelectorAll('[data-dk-cancel]'))
        };

        shell.confirm.addEventListener('click', confirmActive);
        shell.cancelButtons.forEach((button) => button.addEventListener('click', cancelActive));
        root.querySelector('[data-dk-dismiss]').addEventListener('click', () => {
            if (activeOptions?.dismissible !== false) cancelActive();
        });
        root.addEventListener('keydown', handleKeydown);
        return shell;
    }

    function normalize(mode, input) {
        const raw = typeof input === 'string' ? { message: input } : { ...(input || {}) };
        const variant = ['info', 'success', 'warning', 'danger'].includes(raw.variant)
            ? raw.variant
            : mode === 'confirm' ? 'warning' : 'info';
        const defaults = DEFAULTS[variant];

        return {
            mode,
            variant,
            eyebrow: raw.eyebrow || defaults.eyebrow,
            title: raw.title || defaults.title,
            message: String(raw.message || ''),
            details: Array.isArray(raw.details) ? raw.details.filter(Boolean).map(String) : [],
            confirmLabel: raw.confirmLabel || (mode === 'alert' ? 'Got it' : mode === 'prompt' ? 'Submit' : 'Continue'),
            cancelLabel: raw.cancelLabel || 'Cancel',
            dismissible: raw.dismissible !== false,
            input: mode === 'prompt' ? {
                label: raw.input?.label || raw.label || 'Your response',
                placeholder: raw.input?.placeholder || raw.placeholder || '',
                value: raw.input?.value || raw.value || '',
                required: raw.input?.required !== false,
                multiline: raw.input?.multiline !== false,
                maxLength: Number(raw.input?.maxLength || raw.maxLength || 1000),
                errorMessage: raw.input?.errorMessage || raw.errorMessage || 'Please enter a response before continuing.'
            } : null
        };
    }

    function setText(element, value) {
        element.textContent = value;
    }

    function open(options) {
        return new Promise((resolve) => {
            const current = ensureShell();
            activeResolve = resolve;
            activeOptions = options;
            returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

            current.root.dataset.variant = options.variant;
            current.root.dataset.mode = options.mode;
            current.dialog.setAttribute('role', options.variant === 'danger' || options.variant === 'warning' ? 'alertdialog' : 'dialog');
            current.icon.innerHTML = createIcon(options.variant);
            setText(current.eyebrow, options.eyebrow);
            setText(current.title, options.title);
            setText(current.message, options.message);
            setText(current.confirm, options.confirmLabel);
            current.cancelButtons.forEach((button) => {
                if (button.classList.contains('dk-modal-button')) setText(button, options.cancelLabel);
            });

            current.details.replaceChildren();
            options.details.forEach((detail) => {
                const item = document.createElement('li');
                item.textContent = detail;
                current.details.appendChild(item);
            });
            current.details.hidden = options.details.length === 0;

            const isAlert = options.mode === 'alert';
            current.cancelButtons.forEach((button) => { button.hidden = isAlert; });
            current.field.hidden = !options.input;
            current.error.hidden = true;

            if (options.input) {
                const control = options.input.multiline ? current.textarea : current.input;
                const unusedControl = options.input.multiline ? current.input : current.textarea;
                unusedControl.hidden = true;
                control.hidden = false;
                control.value = options.input.value;
                control.placeholder = options.input.placeholder;
                control.maxLength = options.input.maxLength;
                control.removeAttribute('aria-invalid');
                setText(current.inputLabel, options.input.label);
            } else {
                current.input.hidden = false;
                current.textarea.hidden = false;
            }

            current.root.hidden = false;
            document.body.classList.add('dk-modal-open');
            requestAnimationFrame(() => {
                if (options.input) {
                    (options.input.multiline ? current.textarea : current.input).focus();
                } else if (options.variant === 'danger' && !isAlert) {
                    current.cancelButtons.find((button) => button.classList.contains('dk-modal-button'))?.focus();
                } else {
                    current.confirm.focus();
                }
            });
        });
    }

    function finish(value) {
        if (!activeResolve || !shell) return;
        const resolve = activeResolve;
        activeResolve = null;
        activeOptions = null;
        shell.root.hidden = true;
        document.body.classList.remove('dk-modal-open');
        const focusTarget = returnFocus;
        returnFocus = null;
        resolve(value);
        requestAnimationFrame(() => focusTarget?.isConnected && focusTarget.focus());
    }

    function cancelActive() {
        if (!activeOptions) return;
        finish(activeOptions.mode === 'prompt' ? null : activeOptions.mode === 'confirm' ? false : undefined);
    }

    function confirmActive() {
        if (!activeOptions) return;
        if (activeOptions.mode === 'prompt') {
            const control = activeOptions.input.multiline ? shell.textarea : shell.input;
            const value = control.value.trim();
            if (activeOptions.input.required && !value) {
                control.setAttribute('aria-invalid', 'true');
                setText(shell.error, activeOptions.input.errorMessage);
                shell.error.hidden = false;
                control.focus();
                return;
            }
            finish(value);
            return;
        }
        finish(activeOptions.mode === 'confirm' ? true : undefined);
    }

    function handleKeydown(event) {
        if (!activeOptions || shell.root.hidden) return;
        if (event.key === 'Escape' && activeOptions.dismissible !== false) {
            event.preventDefault();
            cancelActive();
            return;
        }
        if (event.key !== 'Tab') return;

        const focusable = Array.from(shell.dialog.querySelectorAll('button:not([hidden]):not([disabled]), input:not([hidden]):not([disabled]), textarea:not([hidden]):not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function enqueue(mode, input) {
        const options = normalize(mode, input);
        const result = queue.then(() => open(options));
        queue = result.catch(() => undefined);
        return result;
    }

    window.DomiKnowModal = Object.freeze({
        alert: (options) => enqueue('alert', options),
        confirm: (options) => enqueue('confirm', options),
        prompt: (options) => enqueue('prompt', options),
        info: (message, options = {}) => enqueue('alert', { ...options, message, variant: 'info' }),
        success: (message, options = {}) => enqueue('alert', { ...options, message, variant: 'success' }),
        warning: (message, options = {}) => enqueue('alert', { ...options, message, variant: 'warning' }),
        danger: (message, options = {}) => enqueue('alert', { ...options, message, variant: 'danger' })
    });

    window.dispatchEvent(new CustomEvent('domiknow:modal-ready'));
}());
