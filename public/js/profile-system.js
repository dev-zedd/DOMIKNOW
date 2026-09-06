(function () {
    'use strict';

    if (window.DomiKnowProfile) {
        window.DomiKnowProfile.initialize();
        return;
    }

    const API_URL = '/api/users/me';
    const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
    const PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const state = {
        profile: null,
        initialForm: '',
        dirty: false,
        pendingFile: null,
        pendingPreview: ''
    };

    const icons = {
        user: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>',
        mail: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
        calendar: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>',
        shield: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
        camera: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3h5Z"/><circle cx="12" cy="13" r="3"/></svg>',
        save: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>',
        key: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="5"/><path d="m11.5 11.5 8-8M15 8l3 3M17 6l3 3"/></svg>'
    };

    function token() {
        return localStorage.getItem('domiknow_token');
    }

    async function request(path = '', options = {}) {
        const response = await fetch(`${API_URL}${path}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token()}`,
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
            const validationMessage = (Array.isArray(result.errors) && (result.errors[0]?.message || result.errors[0]?.msg))
                || (Array.isArray(result.error?.errors) && result.error.errors[0]?.message);
            throw new Error(validationMessage || result.message || 'The account request could not be completed.');
        }
        return result.data || null;
    }

    function roleLabel(value) {
        return ({
            tenant: 'Tenant',
            landlord: 'Landlord',
            maintenance: 'Maintenance personnel',
            admin: 'Administrator'
        })[value] || 'DOMIKNOW user';
    }

    function initials(name) {
        return String(name || 'DOMIKNOW User')
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join('') || 'DU';
    }

    function safeImageUrl(value) {
        try {
            const url = new URL(String(value || ''), window.location.origin);
            return ['http:', 'https:', 'data:', 'blob:'].includes(url.protocol) ? url.href : '';
        } catch (error) {
            return '';
        }
    }

    function formatDate(value) {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) return 'Not available';
        return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function buildShell(root) {
        root.innerHTML = `
            <div class="profile-container">
                <!-- Identity Card -->
                <section class="profile-card profile-identity-card" aria-labelledby="profileHeroName">
                    <div class="profile-identity-main">
                        <div class="profile-avatar-block">
                            <div class="profile-avatar" data-profile-avatar>
                                <span data-avatar-initials>DU</span>
                                <img data-avatar-image alt="Profile photo" hidden>
                            </div>
                            <button type="button" class="profile-photo-change-btn" data-profile-photo-select>
                                ${icons.camera}<span>Change photo</span>
                            </button>
                            <input type="file" data-profile-photo-input accept="image/jpeg,image/png,image/webp" hidden>
                        </div>
                        <div class="profile-identity-info">
                            <div class="profile-identity-row">
                                <h2 id="profileHeroName" data-profile-name>Loading profile...</h2>
                                <span class="profile-pill profile-pill--role" data-profile-role>Tenant</span>
                            </div>
                            <p class="profile-identity-email" data-profile-email>Retrieving your account details</p>
                            <div class="profile-identity-tags">
                                <span class="profile-pill" data-profile-status>Account status</span>
                                <span class="profile-pill" data-profile-verified>Verification</span>
                                <span class="profile-identity-since">Member since <strong data-fact-created>—</strong></span>
                            </div>
                        </div>
                    </div>

                    <!-- Photo Pending/Active Controls -->
                    <div class="profile-photo-bar" data-photo-bar>
                        <span class="profile-photo-filename" data-photo-name>No profile photo yet</span>
                        <div class="profile-photo-bar-actions">
                            <button type="button" class="profile-button profile-button--primary profile-button--sm" data-profile-photo-save disabled>Save photo</button>
                            <button type="button" class="profile-button profile-button--danger profile-button--sm" data-profile-photo-remove hidden>Remove photo</button>
                        </div>
                    </div>
                    <p class="profile-form-status" data-photo-status role="status"></p>

                    <!-- Hidden elements required for profile-system.js API compatibility -->
                    <div hidden aria-hidden="true">
                        <span data-profile-completion>0%</span>
                        <div data-profile-completion-bar></div>
                        <span data-profile-completion-copy></span>
                        <span data-fact-email></span>
                        <span data-fact-role></span>
                        <span data-fact-verification></span>
                    </div>
                </section>

                <!-- Personal Information Card -->
                <section class="profile-card" aria-labelledby="personalInfoHeading">
                    <header class="profile-card__header">
                        <div>
                            <h3 id="personalInfoHeading">Personal Information</h3>
                            <p>Update your contact and residential information.</p>
                        </div>
                        <span class="profile-unsaved" data-profile-unsaved data-dirty="false">Saved</span>
                    </header>
                    <div class="profile-card__body">
                        <form class="profile-form" data-profile-form novalidate>
                            <div class="profile-form-grid">
                                <div class="profile-field">
                                    <label for="profileFullName">Full name</label>
                                    <input id="profileFullName" class="profile-input" name="full_name" type="text" minlength="2" maxlength="255" autocomplete="name" required placeholder="Enter your full name">
                                </div>
                                <div class="profile-field">
                                    <label for="profileContact">Contact number</label>
                                    <input id="profileContact" class="profile-input" name="contact_number" type="tel" maxlength="50" autocomplete="tel" placeholder="+63 9XX XXX XXXX">
                                </div>
                                <div class="profile-field profile-field--wide">
                                    <label for="profileEmail">Email address</label>
                                    <div class="profile-readonly-wrap">
                                        <input id="profileEmail" class="profile-input" type="email" readonly aria-describedby="profileEmailHint">
                                        <span class="profile-readonly-badge">Verified</span>
                                    </div>
                                    <p id="profileEmailHint" class="profile-field__hint">Your sign-in email is managed securely by DOMIKNOW.</p>
                                </div>
                                <div class="profile-field profile-field--wide">
                                    <label for="profileAddress">Current address</label>
                                    <textarea id="profileAddress" class="profile-textarea" name="address" maxlength="500" autocomplete="street-address" placeholder="Enter your residential address" rows="3"></textarea>
                                </div>
                            </div>
                            <p class="profile-form-status" data-profile-form-status role="status"></p>
                            <div class="profile-form-actions">
                                <button type="submit" class="profile-button profile-button--primary" data-profile-save>${icons.save}<span>Save changes</span></button>
                                <button type="button" class="profile-button" data-profile-reset>Reset</button>
                            </div>
                        </form>
                    </div>
                </section>

                <!-- Password and Security Card -->
                <section class="profile-card" aria-labelledby="profileSecurityHeading">
                    <header class="profile-card__header">
                        <div>
                            <h3 id="profileSecurityHeading">Password & Security</h3>
                            <p>Manage your account password.</p>
                        </div>
                    </header>
                    <div class="profile-card__body">
                        <form class="profile-form" data-password-form novalidate>
                            <div class="profile-form-grid">
                                <div class="profile-field profile-field--wide">
                                    <label for="currentPassword">Current password</label>
                                    <input id="currentPassword" class="profile-input" name="current_password" type="password" autocomplete="current-password" required placeholder="Enter current password">
                                </div>
                                <div class="profile-field">
                                    <label for="newPassword">New password</label>
                                    <input id="newPassword" class="profile-input" name="new_password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required placeholder="New password">
                                </div>
                                <div class="profile-field">
                                    <label for="confirmNewPassword">Confirm new password</label>
                                    <input id="confirmNewPassword" class="profile-input" name="confirm_password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required placeholder="Confirm new password">
                                </div>
                                <div class="profile-field profile-field--wide">
                                    <div class="profile-password-meter" data-password-meter data-score="0" aria-hidden="true">
                                        <span></span><span></span><span></span><span></span>
                                    </div>
                                    <ul class="profile-password-rules" aria-label="Password requirements">
                                        <li data-password-rule="length">8+ characters</li>
                                        <li data-password-rule="upper">Uppercase</li>
                                        <li data-password-rule="lower">Lowercase</li>
                                        <li data-password-rule="number">Number</li>
                                    </ul>
                                </div>
                            </div>
                            <div class="profile-password-row">
                                <label class="profile-password-visibility">
                                    <input type="checkbox" data-password-visibility>
                                    <span>Show passwords</span>
                                </label>
                            </div>
                            <p class="profile-form-status" data-password-status role="status"></p>
                            <div class="profile-form-actions">
                                <button type="submit" class="profile-button profile-button--primary" data-password-save>${icons.key}<span>Change password</span></button>
                            </div>
                        </form>
                    </div>
                </section>
            </div>`;
    }

    function formSnapshot(root) {
        return JSON.stringify({
            full_name: root.querySelector('#profileFullName')?.value.trim() || '',
            contact_number: root.querySelector('#profileContact')?.value.trim() || '',
            address: root.querySelector('#profileAddress')?.value.trim() || ''
        });
    }

    function setDirty(root) {
        state.dirty = formSnapshot(root) !== state.initialForm;
        const indicator = root.querySelector('[data-profile-unsaved]');
        if (indicator) {
            indicator.dataset.dirty = String(state.dirty);
            indicator.textContent = state.dirty ? 'Unsaved changes' : 'Saved';
        }
    }

    function showStatus(element, message = '', variant = 'error') {
        if (!element) return;
        element.textContent = message;
        element.dataset.variant = variant;
    }

    function setButtonLoading(button, loading, loadingLabel) {
        if (!button) return;
        if (loading) {
            button.dataset.originalHtml = button.innerHTML;
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            button.textContent = loadingLabel;
        } else {
            button.disabled = false;
            button.removeAttribute('aria-busy');
            if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
            delete button.dataset.originalHtml;
        }
    }

    function toast(message, variant = 'success') {
        if (window.DomiKnowNotifications?.toast) {
            window.DomiKnowNotifications.toast(message, variant);
        }
    }

    function updateAvatar(root, profile, overrideUrl = '') {
        const imageUrl = safeImageUrl(overrideUrl || profile.profile_image_url);
        root.querySelectorAll('[data-profile-avatar]').forEach(avatar => {
            const image = avatar.querySelector('[data-avatar-image]');
            const copy = avatar.querySelector('[data-avatar-initials]');
            if (copy) copy.textContent = initials(profile.full_name);
            if (!image) return;
            image.hidden = !imageUrl;
            if (imageUrl) {
                image.src = imageUrl;
                image.onerror = () => { image.hidden = true; };
            } else {
                image.removeAttribute('src');
            }
        });

        const topbarAvatar = document.querySelector('.topbar-avatar');
        if (topbarAvatar) {
            topbarAvatar.textContent = imageUrl ? '' : initials(profile.full_name);
            topbarAvatar.style.backgroundImage = imageUrl ? `url("${imageUrl.replace(/"/g, '%22')}")` : '';
            topbarAvatar.style.backgroundSize = imageUrl ? 'cover' : '';
            topbarAvatar.style.backgroundPosition = imageUrl ? 'center' : '';
        }
    }

    function updateCompletion(root, profile) {
        const fields = [profile.full_name, profile.email, profile.contact_number, profile.address, profile.profile_image_url];
        const complete = fields.filter(value => String(value || '').trim()).length;
        const percent = Math.round((complete / fields.length) * 100);
        root.querySelector('[data-profile-completion]').textContent = `${percent}%`;
        root.querySelector('[data-profile-completion-bar]').style.width = `${percent}%`;
        root.querySelector('[data-profile-completion-copy]').textContent = percent === 100
            ? 'Your core profile information is complete.'
            : 'Add your contact details, address, and photo to complete your profile.';
    }

    function renderProfile(root, profile, options = {}) {
        state.profile = { ...(state.profile || {}), ...profile };
        const current = state.profile;
        root.querySelector('[data-profile-name]').textContent = current.full_name || 'DOMIKNOW user';
        root.querySelector('[data-profile-email]').textContent = current.email || 'No email available';
        root.querySelector('[data-profile-role]').textContent = roleLabel(current.role);

        const status = root.querySelector('[data-profile-status]');
        status.textContent = `${String(current.account_status || 'unknown').replace(/_/g, ' ')} account`;
        status.dataset.status = current.account_status || 'unknown';

        const verified = root.querySelector('[data-profile-verified]');
        verified.textContent = current.is_verified ? 'Email verified' : 'Email not verified';
        verified.dataset.verified = String(Boolean(current.is_verified));

        root.querySelector('[data-fact-email]').textContent = current.email || 'Not available';
        root.querySelector('[data-fact-role]').textContent = roleLabel(current.role);
        root.querySelector('[data-fact-created]').textContent = formatDate(current.created_at);
        root.querySelector('[data-fact-verification]').textContent = current.is_verified ? 'Verified email' : 'Verification required';

        if (!options.preserveForm) {
            root.querySelector('#profileFullName').value = current.full_name || '';
            root.querySelector('#profileContact').value = current.contact_number || '';
            root.querySelector('#profileEmail').value = current.email || '';
            root.querySelector('#profileAddress').value = current.address || '';
            state.initialForm = formSnapshot(root);
            state.dirty = false;
            setDirty(root);
        }

        root.querySelector('[data-profile-photo-remove]').hidden = !current.profile_image_url;
        root.querySelector('[data-photo-name]').textContent = current.profile_image_url ? 'Current profile photo' : 'No profile photo yet';
        updateAvatar(root, current, state.pendingPreview);
        updateCompletion(root, current);

        document.querySelectorAll('.user-name').forEach(element => { element.textContent = current.full_name || 'DOMIKNOW user'; });
    }

    async function loadProfile(root) {
        root.setAttribute('aria-busy', 'true');
        try {
            const profile = await request();
            renderProfile(root, profile || {});
        } catch (error) {
            root.innerHTML = `<section class="profile-card"><div class="profile-card__body"><p class="profile-form-status" role="alert"></p><button type="button" class="profile-button profile-button--primary" data-profile-retry>Try again</button></div></section>`;
            root.querySelector('[role="alert"]').textContent = error.message;
            root.querySelector('[data-profile-retry]').addEventListener('click', () => initialize(true));
        } finally {
            root.removeAttribute('aria-busy');
        }
    }

    async function saveProfile(root, event) {
        event.preventDefault();
        const status = root.querySelector('[data-profile-form-status]');
        const name = root.querySelector('#profileFullName').value.trim();
        if (name.length < 2) {
            showStatus(status, 'Enter a full name with at least 2 characters.');
            root.querySelector('#profileFullName').focus();
            return;
        }
        if (!state.dirty) {
            showStatus(status, 'Your profile information is already up to date.', 'success');
            return;
        }

        const button = root.querySelector('[data-profile-save]');
        setButtonLoading(button, true, 'Saving...');
        showStatus(status);
        try {
            const updated = await request('', {
                method: 'PUT',
                body: JSON.stringify({
                    full_name: name,
                    contact_number: root.querySelector('#profileContact').value.trim(),
                    address: root.querySelector('#profileAddress').value.trim()
                })
            });
            renderProfile(root, updated || {});
            showStatus(status, 'Personal information saved successfully.', 'success');
            toast('Profile information updated.');
        } catch (error) {
            showStatus(status, error.message);
        } finally {
            setButtonLoading(button, false);
        }
    }

    function resetProfileForm(root) {
        if (!state.profile) return;
        renderProfile(root, state.profile);
        showStatus(root.querySelector('[data-profile-form-status]'));
    }

    function selectPhoto(root) {
        root.querySelector('[data-profile-photo-input]').click();
    }

    function handlePhotoSelection(root, event) {
        const file = event.target.files?.[0];
        const status = root.querySelector('[data-photo-status]');
        showStatus(status);
        if (!file) return;
        if (!PHOTO_TYPES.includes(file.type)) {
            showStatus(status, 'Choose a JPG, PNG, or WEBP image.');
            event.target.value = '';
            return;
        }
        if (file.size > MAX_PHOTO_BYTES) {
            showStatus(status, 'Choose an image smaller than 3 MB.');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            state.pendingFile = file;
            state.pendingPreview = String(reader.result || '');
            root.querySelector('[data-photo-name]').textContent = file.name;
            root.querySelector('[data-profile-photo-save]').disabled = false;
            updateAvatar(root, state.profile || {}, state.pendingPreview);
        };
        reader.onerror = () => showStatus(status, 'The selected image could not be read.');
        reader.readAsDataURL(file);
    }

    async function savePhoto(root) {
        if (!state.pendingFile || !state.pendingPreview) return;
        const button = root.querySelector('[data-profile-photo-save]');
        const status = root.querySelector('[data-photo-status]');
        setButtonLoading(button, true, 'Uploading...');
        showStatus(status);
        try {
            const updated = await request('/avatar', {
                method: 'POST',
                body: JSON.stringify({
                    base64_content: state.pendingPreview,
                    mime_type: state.pendingFile.type,
                    file_size: state.pendingFile.size
                })
            });
            state.pendingFile = null;
            state.pendingPreview = '';
            root.querySelector('[data-profile-photo-input]').value = '';
            renderProfile(root, updated || {}, { preserveForm: true });
            button.disabled = true;
            showStatus(status, 'Profile photo saved successfully.', 'success');
            toast('Profile photo updated.');
        } catch (error) {
            showStatus(status, error.message);
        } finally {
            setButtonLoading(button, false);
            button.disabled = !state.pendingFile;
        }
    }

    async function removePhoto(root) {
        const confirmed = typeof window.domiknowConfirm === 'function'
            ? await window.domiknowConfirm({
                variant: 'danger',
                eyebrow: 'Profile photo',
                title: 'Remove your profile photo?',
                message: 'Your initials will be shown until you upload another photo.',
                confirmLabel: 'Remove photo',
                cancelLabel: 'Keep photo'
            })
            : window.confirm('Remove your profile photo?');
        if (!confirmed) return;

        const button = root.querySelector('[data-profile-photo-remove]');
        const status = root.querySelector('[data-photo-status]');
        setButtonLoading(button, true, 'Removing...');
        try {
            const updated = await request('/avatar', { method: 'DELETE' });
            state.pendingFile = null;
            state.pendingPreview = '';
            renderProfile(root, updated || {}, { preserveForm: true });
            showStatus(status, 'Profile photo removed.', 'success');
            toast('Profile photo removed.');
        } catch (error) {
            showStatus(status, error.message);
        } finally {
            setButtonLoading(button, false);
        }
    }

    function updatePasswordRules(root) {
        const password = root.querySelector('#newPassword').value;
        const tests = {
            length: password.length >= 8,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            number: /\d/.test(password)
        };
        Object.entries(tests).forEach(([rule, valid]) => {
            root.querySelector(`[data-password-rule="${rule}"]`)?.classList.toggle('is-valid', valid);
        });
        root.querySelector('[data-password-meter]').dataset.score = String(Object.values(tests).filter(Boolean).length);
        return Object.values(tests).every(Boolean);
    }

    async function changePassword(root, event) {
        event.preventDefault();
        const form = event.currentTarget;
        const status = root.querySelector('[data-password-status]');
        const currentPassword = form.elements.current_password.value;
        const newPassword = form.elements.new_password.value;
        const confirmPassword = form.elements.confirm_password.value;
        showStatus(status);

        if (!currentPassword) {
            showStatus(status, 'Enter your current password.');
            form.elements.current_password.focus();
            return;
        }
        if (!updatePasswordRules(root)) {
            showStatus(status, 'Your new password does not meet all requirements.');
            form.elements.new_password.focus();
            return;
        }
        if (newPassword !== confirmPassword) {
            showStatus(status, 'The new password confirmation does not match.');
            form.elements.confirm_password.focus();
            return;
        }

        const confirmed = typeof window.domiknowConfirm === 'function'
            ? await window.domiknowConfirm({
                variant: 'warning',
                eyebrow: 'Account security',
                title: 'Change your password now?',
                message: 'Use the new password the next time you sign in to DOMIKNOW.',
                confirmLabel: 'Change password',
                cancelLabel: 'Not yet'
            })
            : window.confirm('Change your password now?');
        if (!confirmed) return;

        const button = root.querySelector('[data-password-save]');
        setButtonLoading(button, true, 'Updating...');
        try {
            await request('/password', {
                method: 'PUT',
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
            });
            form.reset();
            updatePasswordRules(root);
            showStatus(status, 'Password changed successfully.', 'success');
            toast('Password changed successfully.');
            window.DomiKnowNotifications?.refresh?.({ silent: true });
        } catch (error) {
            showStatus(status, error.message);
        } finally {
            setButtonLoading(button, false);
        }
    }

    function bindControls(root) {
        root.querySelector('[data-profile-form]').addEventListener('submit', event => saveProfile(root, event));
        root.querySelector('[data-profile-form]').addEventListener('input', () => setDirty(root));
        root.querySelector('[data-profile-reset]').addEventListener('click', () => resetProfileForm(root));
        root.querySelector('[data-profile-photo-select]').addEventListener('click', () => selectPhoto(root));
        root.querySelector('[data-profile-photo-input]').addEventListener('change', event => handlePhotoSelection(root, event));
        root.querySelector('[data-profile-photo-save]').addEventListener('click', () => savePhoto(root));
        root.querySelector('[data-profile-photo-remove]').addEventListener('click', () => removePhoto(root));
        root.querySelector('[data-password-form]').addEventListener('submit', event => changePassword(root, event));
        root.querySelector('#newPassword').addEventListener('input', () => updatePasswordRules(root));
        root.querySelector('[data-password-visibility]').addEventListener('change', event => {
            root.querySelectorAll('[data-password-form] input[type="password"], [data-password-form] input[type="text"]').forEach(input => {
                if (input === event.target) return;
                input.type = event.target.checked ? 'text' : 'password';
            });
        });
    }

    function initialize(force = false) {
        const root = document.querySelector('[data-profile-module]');
        if (!root || (root.dataset.profileReady && !force)) return;
        root.dataset.profileReady = 'true';
        buildShell(root);
        bindControls(root);
        loadProfile(root);
    }

    async function guardNavigation(event) {
        if (!state.dirty && !state.pendingFile) return;
        const link = event.target.closest?.('a[href]');
        if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
        const href = link.href;
        if (!href || href === window.location.href) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        const confirmed = typeof window.domiknowConfirm === 'function'
            ? await window.domiknowConfirm({
                variant: 'warning',
                eyebrow: 'Unsaved profile',
                title: 'Leave without saving?',
                message: 'Your unsaved profile changes or selected photo will be discarded.',
                confirmLabel: 'Discard changes',
                cancelLabel: 'Continue editing'
            })
            : window.confirm('Discard your unsaved profile changes?');
        if (confirmed) {
            state.dirty = false;
            state.pendingFile = null;
            window.location.href = href;
        }
    }

    document.addEventListener('click', guardNavigation, true);
    window.addEventListener('beforeunload', event => {
        if (!state.dirty && !state.pendingFile) return;
        event.preventDefault();
        event.returnValue = '';
    });
    document.addEventListener('domiknow:page-content-updated', initialize);

    window.DomiKnowProfile = Object.freeze({ initialize });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
    else initialize();
})();
