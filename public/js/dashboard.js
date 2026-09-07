// Dashboard guard and initialization

function domiknowEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function domiknowSafeExternalUrl(value) {
    try {
        const rawValue = String(value || '').trim();
        if (!rawValue) return '#';
        const url = new URL(rawValue, window.location.origin);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : '#';
    } catch (error) {
        return '#';
    }
}

function domiknowDocumentLink(value, label = 'View document', className = '') {
    const raw = String(value || '').trim();
    const url = raw && !raw.startsWith('#') ? domiknowSafeExternalUrl(raw) : '#';
    const text = domiknowEscapeHtml(label);
    if (url === '#') {
        return `<span class="document-unavailable">${text} <small>— File unavailable</small></span>`;
    }
    return `<a href="${domiknowEscapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="${domiknowEscapeHtml(className)}">${text}</a>`;
}

// Run on page load
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check token
    const token = localStorage.getItem('domiknow_token');
    if (!token) {
        redirectToDashboardLogin();
        return;
    }

    // Determine expected role based on path
    const path = window.location.pathname;
    
    // Auto-redirect removed dashboard pages to properties.html
    if (path.includes('/tenant/dashboard.html')) {
        window.location.href = '/pages/tenant/properties.html';
        return;
    }
    if (path.includes('/landlord/dashboard.html')) {
        window.location.href = '/pages/landlord/properties.html';
        return;
    }
    if (path.includes('/admin/reservations.html')) {
        window.location.href = '/pages/admin/users.html';
        return;
    }

    let expectedRole = null;
    if (path.includes('/tenant/')) expectedRole = 'tenant';
    if (path.includes('/landlord/')) expectedRole = 'landlord';
    if (path.includes('/maintenance/')) expectedRole = 'maintenance';
    if (path.includes('/admin/')) expectedRole = 'admin';

    const storedRole = localStorage.getItem('domiknow_role');
    const activeRole = expectedRole || storedRole || 'tenant';

    // INSTANT SIDEBAR RENDER: Render layout synchronously BEFORE network fetch
    // Eliminates any millisecond delay or layout shift on refresh
    renderNewDashboardLayout({ role: activeRole });

    try {
        // 2. Fetch user data to verify token and role
        const response = await fetch('/api/dashboard/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            // Temporary service failures must not sign users out or lose their route.
            if (response.status === 401) {
                localStorage.removeItem('domiknow_token');
                localStorage.removeItem('domiknow_role');
                redirectToDashboardLogin();
            } else {
                showDashboardLoadError();
            }
            return;
        }

        const result = await response.json();
        const user = result.data;

        // 3. Verify role
        if (expectedRole && user.role !== expectedRole) {
            const landingPagesByRole = {
                tenant: '/pages/tenant/properties.html',
                landlord: '/pages/landlord/properties.html',
                admin: '/pages/admin/users.html',
                maintenance: '/pages/maintenance/dashboard.html'
            };
            window.location.href = landingPagesByRole[user.role] || '/pages/auth/login.html';
            return;
        }

        // 4. Populate UI
        populateDashboardUI(user);

    } catch (error) {
        console.error('Error loading dashboard:', error);
        showDashboardLoadError();
    }
});

function redirectToDashboardLogin() {
    const returnTo = window.location.pathname + window.location.search + window.location.hash;
    window.location.href = '/pages/auth/login.html?redirect=' + encodeURIComponent(returnTo);
}

function showDashboardLoadError() {
    const account = document.querySelector('.topbar-account');
    if (!account || account.querySelector('[data-dashboard-error]')) return;

    const error = document.createElement('span');
    error.setAttribute('data-dashboard-error', '');
    error.setAttribute('role', 'alert');
    error.className = 'topbar-account-error';
    error.textContent = 'Account details unavailable.';

    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'topbar-account-retry';
    retry.textContent = 'Retry';
    retry.addEventListener('click', () => window.location.reload());

    const login = document.createElement('a');
    login.href = '/pages/auth/login.html';
    login.className = 'topbar-account-login';
    login.textContent = 'Sign in again';

    error.append(' ', retry, ' ', login);
    account.appendChild(error);
}

function populateDashboardUI(user) {
    // Populate User Name
    const userNameEls = document.querySelectorAll('.user-name');
    userNameEls.forEach(el => el.textContent = user.full_name);

    const avatar = document.querySelector('.topbar-avatar');
    if (avatar) {
        const fallbackInitial = (user && user.role === 'landlord') ? 'L' : (user && user.role === 'admin') ? 'A' : 'T';
        const fallbackName = (user && user.role === 'landlord') ? 'Landlord' : (user && user.role === 'admin') ? 'Admin' : 'Tenant';
        const initials = String(user.full_name || fallbackName)
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join('');
        const profileImageUrl = user.profile_image_url ? domiknowSafeExternalUrl(user.profile_image_url) : '';
        const hasProfileImage = Boolean(profileImageUrl && profileImageUrl !== '#');
        avatar.textContent = hasProfileImage ? '' : (initials || fallbackInitial);
        avatar.style.backgroundImage = hasProfileImage ? `url("${profileImageUrl.replace(/"/g, '%22')}")` : '';
        avatar.style.backgroundSize = hasProfileImage ? 'cover' : '';
        avatar.style.backgroundPosition = hasProfileImage ? 'center' : '';
    }

    // Populate Account Status
    const statusEl = document.getElementById('accountStatus');
    if (statusEl) {
        statusEl.textContent = user.account_status.toUpperCase();
        
        // Color coding for status using custom semantic classes
        statusEl.className = 'status-badge';
        if (user.account_status === 'active') {
            statusEl.classList.add('status-active');
        } else if (user.account_status === 'pending') {
            statusEl.classList.add('status-pending');
        } else {
            statusEl.classList.add('status-rejected');
        }
    }

    // Role specific pending message
    const pendingMsg = document.getElementById('pendingApprovalMsg');
    if (pendingMsg && user.account_status === 'pending') {
        pendingMsg.classList.remove('hidden');
    }

    // Modern Sidebar & Layout Injection
    renderNewDashboardLayout(user);
    window.requestAnimationFrame(() => window.DomiKnowLoading?.upgradeLegacyLoading(document.body));
}

function loadTenantModuleAssets() {
    document.documentElement.setAttribute('data-tenant-portal', 'true');
    if (!document.querySelector('link[data-tenant-module]')) {
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = '/css/tenant.css?v=20260904-15';
        stylesheet.setAttribute('data-tenant-module', '');
        document.head.appendChild(stylesheet);
    }

    loadMobileFirstAssets();

    if (!document.querySelector('script[data-tenant-module]')) {
        const script = document.createElement('script');
        script.src = '/js/tenant.js?v=20260904-4';
        script.defer = true;
        script.setAttribute('data-tenant-module', '');
        document.head.appendChild(script);
    }
}

function loadLandlordModuleAssets() {
    document.documentElement.setAttribute('data-landlord-portal', 'true');
    if (!document.querySelector('link[data-landlord-module]')) {
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = '/css/landlord.css?v=20260905-3';
        stylesheet.setAttribute('data-landlord-module', '');
        document.head.appendChild(stylesheet);
    }

    loadMobileFirstAssets();

    if (!document.querySelector('script[data-landlord-module]')) {
        const script = document.createElement('script');
        script.src = '/js/landlord.js?v=20260905-1';
        script.defer = true;
        script.setAttribute('data-landlord-module', '');
        document.head.appendChild(script);
    }
}

function loadMaintenanceModuleAssets() {
    if (!document.querySelector('link[data-maintenance-module]')) {
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = '/css/maintenance.css?v=20260827-1';
        stylesheet.setAttribute('data-maintenance-module', '');
        document.head.appendChild(stylesheet);
    }

    loadMobileFirstAssets();

    if (!document.querySelector('script[data-maintenance-module]')) {
        const script = document.createElement('script');
        script.src = '/js/maintenance.js?v=20260827-1';
        script.defer = true;
        script.setAttribute('data-maintenance-module', '');
        document.head.appendChild(script);
    }
}

function loadMobileFirstAssets() {
    if (document.querySelector('link[data-mobile-first]')) return;

    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/css/mobile-first.css?v=20260817-1';
    stylesheet.setAttribute('data-mobile-first', '');
    document.head.appendChild(stylesheet);
}

function loadAdminModuleAssets() {
    if (!document.querySelector('link[data-admin-module]')) {
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = '/css/admin.css';
        stylesheet.setAttribute('data-admin-module', '');
        document.head.appendChild(stylesheet);
    }

    if (!document.querySelector('script[data-admin-module]')) {
        const script = document.createElement('script');
        script.src = '/js/admin.js';
        script.defer = true;
        script.setAttribute('data-admin-module', '');
        document.head.appendChild(script);
    }
}

function loadNotificationSystemAssets() {
    if (!document.head.querySelector('link[data-notification-system]')) {
        const stylesheet = document.createElement('link');
        stylesheet.rel = 'stylesheet';
        stylesheet.href = '/css/notification-system.css?v=20260824-2';
        stylesheet.setAttribute('data-notification-system', '');
        document.head.appendChild(stylesheet);
    }

    if (window.DomiKnowNotifications) {
        window.DomiKnowNotifications.refreshSurface?.();
        return;
    }

    if (!document.head.querySelector('script[data-notification-system]')) {
        const script = document.createElement('script');
        script.src = '/js/notification-system.js?v=20260826-1';
        script.async = true;
        script.setAttribute('data-notification-system', '');
        script.addEventListener('load', () => window.DomiKnowNotifications?.refreshSurface?.(), { once: true });
        script.addEventListener('error', () => {
            script.remove();
            console.error('Unable to load the DOMIKNOW notification system.');
        }, { once: true });
        document.head.appendChild(script);
    }
}

async function requestAuthenticatedLogout() {
    try {
        if (typeof window.logout === 'function') {
            const res = await window.logout();
            if (res !== false) return res;
        }
    } catch (e) {
        console.warn('window.logout error:', e);
    }

    const modalOptions = {
        variant: 'info',
        icon: 'logout',
        eyebrow: '',
        title: 'Log out',
        message: 'Are you sure you want to log out?',
        confirmLabel: 'Log out',
        cancelLabel: 'Cancel'
    };
    let shouldLogout = false;
    try {
        shouldLogout = typeof window.domiknowConfirm === 'function'
            ? await window.domiknowConfirm(modalOptions)
            : window.confirm(modalOptions.message);
    } catch (e) {
        shouldLogout = window.confirm(modalOptions.message);
    }

    if (!shouldLogout) return false;
    localStorage.removeItem('domiknow_token');
    localStorage.removeItem('domiknow_role');
    window.location.href = '/pages/auth/login.html';
    return true;
}

function renderNewDashboardLayout(user) {
    // Don't run on login/register pages
    if (window.location.pathname.includes('/auth/') || window.location.pathname.includes('/login') || window.location.pathname.includes('/register')) return;

    // Check if already rendered
    if (document.querySelector('.dashboard-layout')) return;

    const oldNavbar = document.querySelector('nav.navbar');
    if (oldNavbar) oldNavbar.remove();

    // Define sidebar link structures based on role
    const linksByRole = {
        tenant: [
            {
                section: 'Overview',
                items: [
                    {
                        label: 'Discovery',
                        icon: 'Discovery',
                        subItems: [
                            { label: 'Properties', href: 'properties.html' }
                        ]
                    },
                    {
                        label: 'Applications',
                        icon: 'Applications',
                        subItems: [
                            { label: 'My Applications', href: 'applications.html' }
                        ]
                    },
                    {
                        label: 'Leases',
                        icon: 'Leases',
                        subItems: [
                            { label: 'My Lease', href: 'leases.html' }
                        ]
                    },
                    {
                        label: 'Payments',
                        icon: 'Payments',
                        subItems: [
                            { label: 'Billings & Payments', href: 'billings.html' }
                        ]
                    },
                    {
                        label: 'Support',
                        icon: 'Support',
                        subItems: [
                            { label: 'Maintenance Requests', href: 'maintenance.html' },
                            { label: 'Disputes', href: 'disputes.html' },
                            { label: 'Ratings & Feedback', href: 'feedback.html' }
                        ]
                    },
                    {
                        label: 'Reports',
                        icon: 'Reports',
                        subItems: [
                            { label: 'My Reports', href: 'reports.html' }
                        ]
                    }
                ]
            }
        ],
        landlord: [
            {
                section: 'Portfolio',
                items: [
                    { label: 'Properties', href: 'properties.html' }
                ]
            },
            {
                section: 'Tenancy',
                items: [
                    { label: 'Tenant Applications', href: 'applications.html' },
                    { label: 'Lease Agreements', href: 'leases.html' }
                ]
            },
            {
                section: 'Financials',
                items: [
                    { label: 'Billing & Payments', href: 'billings.html' }
                ]
            },
            {
                section: 'Operations & Support',
                items: [
                    { label: 'Maintenance', href: 'maintenance.html' },
                    { label: 'Reports Center', href: 'reports.html' },
                    { label: 'Complaints', href: 'disputes.html' },
                    { label: 'Reviews & Feedback', href: 'feedback.html' }
                ]
            }
        ],
        admin: [
            {
                section: 'Command Center',
                items: [
                    { label: 'Descriptive Analytics', href: 'analytics.html', icon: 'Dashboard' },
                    { label: 'User Access', href: 'users.html' },
                    { label: 'Property Approvals', href: 'property-review.html' }
                ]
            },
            {
                section: 'Platform Monitoring',
                items: [
                    { label: 'Payment Monitoring', href: 'payments.html' }
                ]
            },
            {
                section: 'Trust & Governance',
                items: [
                    { label: 'Case Triage', href: 'reports.html' },
                    { label: 'Policies', href: 'policy-management.html' },
                    { label: 'Audit Trail', href: 'audit-logs.html' }
                ]
            }
        ],
        maintenance: [
            {
                section: 'Main',
                items: [
                    { label: 'Dashboard', href: 'dashboard.html' },
                    { label: 'Assigned Tasks', href: 'tasks.html' }
                ]
            }
        ]
    };

    const role = (user && user.role) ? user.role : 'tenant';
    const menuGroups = (typeof NAVIGATION_CONFIG !== 'undefined' && NAVIGATION_CONFIG[role]) ? NAVIGATION_CONFIG[role] : (linksByRole[role] || []);

    if (role === 'tenant') {
        loadTenantModuleAssets();
    } else if (role === 'landlord') {
        loadLandlordModuleAssets();
    } else if (role === 'maintenance') {
        loadMaintenanceModuleAssets();
    } else if (role === 'admin') {
        loadAdminModuleAssets();
    }

    // Create main container layout
    const dashboardLayout = document.createElement('div');
    dashboardLayout.className = `dashboard-layout dashboard-layout-${role}`;

    // 1. Sidebar HTML
    let roleBadgeClass = 'navbar-badge-tenant';
    if (role === 'landlord') roleBadgeClass = 'navbar-badge-landlord';
    if (role === 'maintenance') roleBadgeClass = 'navbar-badge-maintenance';
    if (role === 'admin') roleBadgeClass = 'navbar-badge-admin';

    let sidebarHtml = '';
    const currentPath = window.location.pathname;
    const currentPageFilename = currentPath.split('/').pop() || 'dashboard.html';
    const parentNavigationPages = {
        admin: {
            'property-review-details.html': 'property-review.html',
            'report-detail.html': 'reports.html'
        },
        maintenance: {
            'task-details.html': 'tasks.html'
        },
        tenant: {
            'property-details.html': 'properties.html',
            'apply.html': 'properties.html',
            'application-details.html': 'applications.html',
            'landlord-report-form.html': 'reports.html',
            'tenant-reports.html': 'reports.html'
        },
        landlord: {
            'property-details.html': 'properties.html',
            'units.html': 'properties.html',
            'application-details.html': 'applications.html',
            'lease-create.html': 'leases.html',
            'maintenance-details.html': 'maintenance.html',
            'tenant-report-form.html': 'reports.html',
            'landlord-reports.html': 'reports.html'
        }
    };
    const activeNavigationFilename = parentNavigationPages[role]?.[currentPageFilename] || currentPageFilename;
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
    const shellUserName = (user && user.full_name) ? user.full_name : (role === 'landlord' ? 'Landlord' : role === 'admin' ? 'Admin' : 'Tenant');

    if (role === 'tenant') {
        const tenantGroups = [
            {
                section: 'Find a home',
                items: [
                    { label: 'Explore homes', href: 'properties.html', icon: 'Discovery' },
                    { label: 'My applications', href: 'applications.html', icon: 'Applications' }
                ]
            },
            {
                section: 'My tenancy',
                items: [
                    { label: 'Lease agreement', href: 'leases.html', icon: 'Leases' },
                    { label: 'Billing & payments', href: 'billings.html', icon: 'Payments' }
                ]
            },
            {
                section: 'Care & support',
                items: [
                    { label: 'Maintenance', href: 'maintenance.html', icon: 'Maintenance Requests' },
                    { label: 'Disputes', href: 'disputes.html', icon: 'Disputes' },
                    { label: 'Ratings & feedback', href: 'feedback.html', icon: 'Ratings and Feedback' }
                ]
            },
            {
                section: 'Safety & records',
                items: [
                    { label: 'Reports center', href: 'reports.html', icon: 'Reports' },
                    { label: 'Policy violations', href: 'policy-violations.html', icon: 'Policy Violations' }
                ]
            }
        ];

        sidebarHtml = `
            <aside class="sidebar sidebar-tenant" id="domiknowSidebar" aria-label="${roleLabel} navigation">
                <div class="sidebar-logo-container">
                    <div class="app-brand" aria-label="DOMIKNOW">
                        <span class="app-brand-mark" aria-hidden="true">D</span>
                        <span class="tenant-brand-copy">
                            <span class="app-brand-name">DOMI<span class="app-brand-accent">KNOW</span></span>
                        </span>
                    </div>
                </div>

                <nav class="sidebar-menu" aria-label="Primary navigation">
        `;

        tenantGroups.forEach(group => {
            sidebarHtml += `<div class="sidebar-section-title">${group.section}</div>`;
            group.items.forEach(item => {
                const isActive = activeNavigationFilename === item.href;
                const icon = getTenantIcon(item.icon) || getLinkIcon(item.icon);
                sidebarHtml += `
                    <a href="${item.href}" class="sidebar-link ${isActive ? 'active' : ''}" ${isActive ? 'aria-current="page"' : ''}>
                        ${icon}
                        <span>${item.label}</span>
                    </a>
                `;
            });
        });
        
        sidebarHtml += `
                </nav>
            </aside>
        `;
    } else if (role === 'landlord') {
        const landlordGroups = [
            {
                section: 'Portfolio',
                items: [
                    { label: 'Properties', href: 'properties.html', icon: 'Properties' }
                ]
            },
            {
                section: 'Tenancy',
                items: [
                    { label: 'Tenant Applications', href: 'applications.html', icon: 'Tenant Applications' },
                    { label: 'Lease Agreements', href: 'leases.html', icon: 'Leases' }
                ]
            },
            {
                section: 'Financials',
                items: [
                    { label: 'Billing & Payments', href: 'billings.html', icon: 'Billings' }
                ]
            },
            {
                section: 'Operations & Support',
                items: [
                    { label: 'Maintenance', href: 'maintenance.html', icon: 'Maintenance Management' },
                    { label: 'Reports Center', href: 'reports.html', icon: 'Reports' },
                    { label: 'Complaints', href: 'disputes.html', icon: 'Disputes' },
                    { label: 'Reviews & Feedback', href: 'feedback.html', icon: 'Ratings and Feedback' }
                ]
            }
        ];

        sidebarHtml = `
            <aside class="sidebar sidebar-landlord" id="domiknowSidebar" aria-label="Landlord navigation">
                <div class="sidebar-logo-container">
                    <div class="app-brand" aria-label="DOMIKNOW">
                        <span class="app-brand-mark" aria-hidden="true">D</span>
                        <span class="landlord-brand-copy">
                            <span class="app-brand-name">DOMI<span class="app-brand-accent">KNOW</span></span>
                        </span>
                    </div>
                </div>
                <nav class="sidebar-menu" aria-label="Primary navigation">
        `;

        let landlordItemIndex = 0;
        landlordGroups.forEach(group => {
            sidebarHtml += `<div class="sidebar-section-title">${group.section}</div>`;
            group.items.forEach(item => {
                const isActive = activeNavigationFilename === item.href;
                landlordItemIndex++;
                sidebarHtml += `
                    <a href="${item.href}" class="sidebar-link ${isActive ? 'active' : ''}" ${isActive ? 'aria-current="page"' : ''} style="--sidebar-item-index: ${landlordItemIndex};">
                        ${getLinkIcon(item.icon)}
                        <span>${item.label}</span>
                    </a>
                `;
            });
        });

        sidebarHtml += `
                </nav>
            </aside>
        `;
    } else if (role === 'admin') {
        const adminGroups = [
            {
                section: 'Command Center',
                items: [
                    { label: 'Descriptive Analytics', href: 'analytics.html', icon: 'Dashboard' },
                    { label: 'User Access', href: 'users.html', icon: 'User Access' },
                    { label: 'Property Approvals', href: 'property-review.html', icon: 'Property Approvals' }
                ]
            },
            {
                section: 'Platform Monitoring',
                items: [
                    { label: 'Payment Monitoring', href: 'payments.html', icon: 'Payment Monitoring' }
                ]
            },
            {
                section: 'Trust & Governance',
                items: [
                    { label: 'Case Triage', href: 'reports.html', icon: 'Case Triage' },
                    { label: 'Policies', href: 'policy-management.html', icon: 'Policies' },
                    { label: 'Audit Trail', href: 'audit-logs.html', icon: 'Audit Trail' }
                ]
            }
        ];

        sidebarHtml = `
            <aside class="sidebar sidebar-admin" id="domiknowSidebar" aria-label="Admin navigation">
                <div class="sidebar-logo-container">
                    <div class="app-brand" aria-label="DOMIKNOW">
                        <span class="app-brand-mark" aria-hidden="true">D</span>
                        <span class="admin-brand-copy">
                            <span class="app-brand-name">DOMI<span class="app-brand-accent">KNOW</span></span>
                        </span>
                    </div>
                </div>
                <nav class="sidebar-menu" aria-label="Primary navigation">
        `;

        let adminItemIndex = 0;
        adminGroups.forEach(group => {
            sidebarHtml += `<div class="sidebar-section-title">${group.section}</div>`;
            group.items.forEach(item => {
                const isActive = activeNavigationFilename === item.href;
                adminItemIndex++;
                sidebarHtml += `
                    <a href="${item.href}" class="sidebar-link ${isActive ? 'active' : ''}" ${isActive ? 'aria-current="page"' : ''} style="--sidebar-item-index: ${adminItemIndex};">
                        ${getLinkIcon(item.icon)}
                        <span>${item.label}</span>
                    </a>
                `;
            });
        });

        sidebarHtml += `
                </nav>
            </aside>
        `;
    } else if (role === 'maintenance') {
        const maintenanceItems = [
            { label: 'Work overview', href: 'dashboard.html', icon: 'Dashboard' },
            { label: 'Assigned tasks', href: 'tasks.html', icon: 'Assigned Tasks' },
            { label: 'Notifications', href: 'notifications.html', icon: 'Notifications' },
            { label: 'My profile', href: 'profile.html', icon: 'Profile' }
        ];

        sidebarHtml = `
            <aside class="sidebar sidebar-maintenance" id="domiknowSidebar" aria-label="Maintenance personnel navigation">
                <div class="sidebar-logo-container">
                    <div class="app-brand" aria-label="DOMIKNOW">
                        <span class="app-brand-mark" aria-hidden="true">D</span>
                        <span class="app-brand-name">DOMI<span class="app-brand-accent">KNOW</span></span>
                    </div>
                </div>
                <nav class="sidebar-menu" aria-label="Primary navigation">
                    <div class="sidebar-section-title">Workspace</div>
        `;

        maintenanceItems.forEach(item => {
            const isActive = activeNavigationFilename === item.href;
            sidebarHtml += `
                <a href="${item.href}" class="sidebar-link ${isActive ? 'active' : ''}" ${isActive ? 'aria-current="page"' : ''}>
                    ${getLinkIcon(item.icon)}
                    <span>${item.label}</span>
                </a>
            `;
        });

        sidebarHtml += `
                </nav>
            </aside>
        `;
    } else {
        sidebarHtml = `
            <aside class="sidebar sidebar-${role}" id="domiknowSidebar" aria-label="${roleLabel} navigation">
                <div class="sidebar-logo-container">
                    <div class="app-brand" aria-label="DOMIKNOW">
                        <span class="app-brand-mark" aria-hidden="true">D</span>
                        <span class="app-brand-name">DOMI<span class="app-brand-accent">KNOW</span></span>
                    </div>
                    <span class="role-badge navbar-badge ${roleBadgeClass}">${roleLabel}</span>
                </div>
                <nav class="sidebar-menu" aria-label="Primary navigation">
        `;
        
        menuGroups.forEach(group => {
            if (!(role === 'tenant' && group.section === 'Main')) {
                sidebarHtml += `<div class="sidebar-section-title">${group.section}</div>`;
            }
            group.items.forEach(item => {
                const isItemActive = activeNavigationFilename === item.href;
                const activeClass = isItemActive ? 'active' : '';
                sidebarHtml += `<a href="${item.href}" class="sidebar-link ${activeClass}" ${isItemActive ? 'aria-current="page"' : ''}>
                    ${getLinkIcon(item.label)}
                    <span>${item.label}</span>
                </a>`;
            });
        });
        
        sidebarHtml += `
                </nav>
                <div class="sidebar-footer">
                    <button type="button" id="newLogoutBtn" class="sidebar-link sidebar-logout" aria-label="Log out of DOMIKNOW">
                        <svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        <span>Log out</span>
                    </button>
                </div>
            </aside>
        `;
    }

    // Get page title dynamically from document.title
    let pageTitle = (document.body.getAttribute('data-page-title') || '').trim() || 'Dashboard';
    const docTitle = document.title;
    if (docTitle && pageTitle === 'Dashboard') {
        pageTitle = docTitle.split(' - ')[0];
    }

    // 2. Main area and contextual header
    let topbarHtml = `
        <div class="main-wrapper">
            <header class="topbar" aria-label="Page header">
                <div class="topbar-left">
                    <button type="button" id="menuToggleBtn" class="mobile-menu-toggle topbar-action" aria-label="Open navigation" aria-controls="domiknowSidebar" aria-expanded="false">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                    </button>
                    <div class="topbar-heading">
                        <span class="topbar-context">${role === 'maintenance' ? 'Field operations' : `${roleLabel} workspace`}</span>
                        <h1 class="topbar-title" id="appPageTitle">${domiknowEscapeHtml(pageTitle)}</h1>
                    </div>
                </div>
                <div class="topbar-right">
                    <button type="button" class="topbar-action notification-trigger" data-notification-trigger aria-label="Open notifications" aria-controls="domiknowNotificationOverlay" aria-expanded="false" title="Notifications">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                        <span class="notification-trigger__badge" data-notification-badge hidden>0</span>
                    </button>
                    <div class="topbar-account-dropdown" id="topbarAccountDropdown">
                        <button type="button" class="topbar-avatar-btn" id="profileDropdownBtn" aria-expanded="false" aria-haspopup="true" aria-label="Open account menu" title="Account menu">
                            <span class="topbar-avatar" aria-hidden="true">${shellUserName.trim().charAt(0).toUpperCase() || (role === 'landlord' ? 'L' : role === 'admin' ? 'A' : role === 'maintenance' ? 'M' : 'T')}</span>
                        </button>
                        <div class="topbar-dropdown-menu" id="profileDropdownMenu" role="menu" aria-labelledby="profileDropdownBtn" hidden>
                            <a href="/pages/${role}/profile.html" class="topbar-dropdown-item ${activeNavigationFilename === 'profile.html' ? 'active' : ''}" id="dropdownProfileLink" role="menuitem">
                                <span class="dropdown-item-icon" aria-hidden="true">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                </span>
                                <span>Profile</span>
                            </a>
                            <button type="button" class="topbar-dropdown-item" id="dropdownThemeBtn" role="menuitem" aria-label="Toggle color theme">
                                <span class="dropdown-item-icon" id="dropdownThemeIcon" aria-hidden="true">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                                </span>
                                <span id="dropdownThemeLabel">Dark mode</span>
                            </button>
                            <button type="button" class="topbar-dropdown-item" id="dropdownTutorialBtn" data-walkthrough-replay role="menuitem" aria-label="Play guide walkthrough">
                                <span class="dropdown-item-icon" aria-hidden="true">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                                </span>
                                <span>Guide</span>
                            </button>
                            <div class="topbar-dropdown-divider" role="separator"></div>
                            <button type="button" class="topbar-dropdown-item topbar-dropdown-logout" id="dropdownLogoutBtn" role="menuitem">
                                <span class="dropdown-item-icon" aria-hidden="true">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                </span>
                                <span>Log out</span>
                            </button>
                        </div>
                    </div>

                </div>
            </header>
            <div class="main-content-inner">
                <!-- Content will be moved here -->
            </div>
        </div>
        <div class="sidebar-overlay" id="sidebarOverlay" aria-hidden="true"></div>
    `;

    if (role === 'tenant') {
        const activeTab = activeNavigationFilename === 'properties.html' ? 'discovery' :
                          activeNavigationFilename === 'applications.html' ? 'applications' :
                          activeNavigationFilename === 'leases.html' ? 'leases' :
                          activeNavigationFilename === 'billings.html' ? 'payments' :
                          activeNavigationFilename === 'reports.html' ? 'reports' :
                          ['maintenance.html', 'disputes.html', 'feedback.html'].includes(activeNavigationFilename) ? 'support' :
                          ['policy-violations.html', 'notifications.html', 'profile.html'].includes(activeNavigationFilename) ? 'more' : '';

        topbarHtml += `
            <nav class="bottom-nav-bar" aria-label="Tenant quick navigation">
                <a href="/pages/tenant/properties.html" class="bottom-nav-item ${activeTab === 'discovery' ? 'active' : ''}" aria-label="Explore properties" ${activeTab === 'discovery' ? 'aria-current="page"' : ''}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <span>Explore</span>
                </a>
                <a href="/pages/tenant/applications.html" class="bottom-nav-item ${activeTab === 'applications' ? 'active' : ''}" aria-label="Applications" ${activeTab === 'applications' ? 'aria-current="page"' : ''}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    <span>Applications</span>
                </a>
                <a href="/pages/tenant/leases.html" class="bottom-nav-item ${activeTab === 'leases' ? 'active' : ''}" aria-label="Lease" ${activeTab === 'leases' ? 'aria-current="page"' : ''}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    <span>Lease</span>
                </a>
                <a href="/pages/tenant/billings.html" class="bottom-nav-item ${activeTab === 'payments' ? 'active' : ''}" aria-label="Payments" ${activeTab === 'payments' ? 'aria-current="page"' : ''}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    <span>Payments</span>
                </a>
                <button type="button" id="btnOpenNavSheet" class="bottom-nav-item ${['support', 'reports', 'more'].includes(activeTab) ? 'active' : ''}" aria-label="Open more tenant tools" aria-controls="navSheetOverlay" aria-expanded="false">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
                    <span>More</span>
                </button>
            </nav>

            <div id="navSheetOverlay" class="nav-sheet-overlay" aria-hidden="true">
                <section class="nav-sheet" role="dialog" aria-modal="true" aria-labelledby="navSheetTitle">
                    <div class="nav-sheet-header">
                        <h2 class="nav-sheet-title" id="navSheetTitle">More tenant tools</h2>
                        <button type="button" id="btnCloseNavSheet" class="nav-sheet-close" aria-label="Close tenant tools">&times;</button>
                    </div>
                    <nav class="nav-sheet-menu" aria-label="Tenant support navigation">
                        <a href="/pages/tenant/reports.html" class="nav-sheet-item" ${activeNavigationFilename === 'reports.html' ? 'aria-current="page"' : ''}>
                            ${getTenantIcon('Reports')}
                            <span>Reports center</span>
                        </a>
                        <a href="/pages/tenant/maintenance.html" class="nav-sheet-item" ${activeNavigationFilename === 'maintenance.html' ? 'aria-current="page"' : ''}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                            <span>Maintenance requests</span>
                        </a>
                        <a href="/pages/tenant/disputes.html" class="nav-sheet-item" ${activeNavigationFilename === 'disputes.html' ? 'aria-current="page"' : ''}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            <span>Disputes</span>
                        </a>
                        <a href="/pages/tenant/feedback.html" class="nav-sheet-item" ${activeNavigationFilename === 'feedback.html' ? 'aria-current="page"' : ''}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 1 0-9-9c0 1.48.36 2.88 1 4.11L3 21l4.89-1c1.23.64 2.63 1 4.11 1z"/><circle cx="8" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke-none"/><circle cx="16" cy="12" r="1" fill="currentColor" stroke-none"/></svg>
                            <span>Ratings &amp; feedback</span>
                        </a>
                        <a href="/pages/tenant/policy-violations.html" class="nav-sheet-item" ${activeNavigationFilename === 'policy-violations.html' ? 'aria-current="page"' : ''}>
                            ${getLinkIcon('Policy Violations')}
                            <span>Policy violations</span>
                        </a>
                    </nav>
                </section>
            </div>
        `;
    } else if (role === 'landlord') {
        const activeTab = ['properties.html', 'property-create.html', 'property-details.html', 'units.html'].includes(activeNavigationFilename) ? 'portfolio' :
                          ['applications.html', 'application-details.html'].includes(activeNavigationFilename) ? 'applications' :
                          ['leases.html', 'lease-create.html'].includes(activeNavigationFilename) ? 'leases' :
                          ['billings.html', 'payments.html'].includes(activeNavigationFilename) ? 'revenue' : 'more';

        topbarHtml += `
            <nav class="bottom-nav-bar" aria-label="Landlord quick navigation">
                <a href="/pages/landlord/properties.html" class="bottom-nav-item ${activeTab === 'portfolio' ? 'active' : ''}" aria-label="Property portfolio" ${activeTab === 'portfolio' ? 'aria-current="page"' : ''}>
                    ${getLinkIcon('My Properties')}
                    <span>Portfolio</span>
                </a>
                <a href="/pages/landlord/applications.html" class="bottom-nav-item ${activeTab === 'applications' ? 'active' : ''}" aria-label="Tenant applications" ${activeTab === 'applications' ? 'aria-current="page"' : ''}>
                    ${getLinkIcon('Tenant Applications')}
                    <span>Applicants</span>
                </a>
                <a href="/pages/landlord/leases.html" class="bottom-nav-item ${activeTab === 'leases' ? 'active' : ''}" aria-label="Lease agreements" ${activeTab === 'leases' ? 'aria-current="page"' : ''}>
                    ${getLinkIcon('Leases')}
                    <span>Leases</span>
                </a>
                <a href="/pages/landlord/billings.html" class="bottom-nav-item ${activeTab === 'revenue' ? 'active' : ''}" aria-label="Billing and revenue" ${activeTab === 'revenue' ? 'aria-current="page"' : ''}>
                    ${getLinkIcon('Billings')}
                    <span>Revenue</span>
                </a>
                <button type="button" id="btnOpenNavSheet" class="bottom-nav-item ${activeTab === 'more' ? 'active' : ''}" aria-label="Open more landlord tools" aria-controls="navSheetOverlay" aria-expanded="false">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
                    <span>More</span>
                </button>
            </nav>

            <div id="navSheetOverlay" class="nav-sheet-overlay" aria-hidden="true">
                <section class="nav-sheet" role="dialog" aria-modal="true" aria-labelledby="navSheetTitle">
                    <div class="nav-sheet-header">
                        <h2 class="nav-sheet-title" id="navSheetTitle">More landlord tools</h2>
                        <button type="button" id="btnCloseNavSheet" class="nav-sheet-close" aria-label="Close landlord tools">&times;</button>
                    </div>
                    <nav class="nav-sheet-menu" aria-label="Landlord operations navigation">
                        <a href="/pages/landlord/property-create.html" class="nav-sheet-item" ${activeNavigationFilename === 'property-create.html' ? 'aria-current="page"' : ''}>
                            ${getLinkIcon('Register Property')}
                            <span>Register property</span>
                        </a>
                        <a href="/pages/landlord/maintenance.html" class="nav-sheet-item" ${activeNavigationFilename === 'maintenance.html' ? 'aria-current="page"' : ''}>
                            ${getLinkIcon('Maintenance Management')}
                            <span>Maintenance</span>
                        </a>
                        <a href="/pages/landlord/reports.html" class="nav-sheet-item" ${activeNavigationFilename === 'reports.html' ? 'aria-current="page"' : ''}>
                            ${getLinkIcon('Reports')}
                            <span>Reports Center</span>
                        </a>
                        <a href="/pages/landlord/disputes.html" class="nav-sheet-item" ${activeNavigationFilename === 'disputes.html' ? 'aria-current="page"' : ''}>
                            ${getLinkIcon('Disputes')}
                            <span>Complaints</span>
                        </a>
                        <a href="/pages/landlord/feedback.html" class="nav-sheet-item" ${activeNavigationFilename === 'feedback.html' ? 'aria-current="page"' : ''}>
                            ${getLinkIcon('Ratings and Feedback')}
                            <span>Reviews &amp; Feedback</span>
                        </a>
                        <button type="button" id="sheetLogoutBtn" class="nav-sheet-item logout" aria-label="Log out of DOMIKNOW">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                            <span>Log out</span>
                        </button>
                    </nav>
                </section>
            </div>
        `;
    } else if (role === 'maintenance') {
        const isOverviewActive = activeNavigationFilename === 'dashboard.html';
        const isTasksActive = ['tasks.html', 'task-details.html'].includes(activeNavigationFilename);
        const isNotificationsActive = activeNavigationFilename === 'notifications.html';
        const isProfileActive = activeNavigationFilename === 'profile.html';
        topbarHtml += `
            <nav class="bottom-nav-bar" aria-label="Maintenance quick navigation">
                <a href="/pages/maintenance/dashboard.html" class="bottom-nav-item ${isOverviewActive ? 'active' : ''}" ${isOverviewActive ? 'aria-current="page"' : ''}>
                    ${getLinkIcon('Dashboard')}
                    <span>Overview</span>
                </a>
                <a href="/pages/maintenance/tasks.html" class="bottom-nav-item ${isTasksActive ? 'active' : ''}" ${isTasksActive ? 'aria-current="page"' : ''}>
                    ${getLinkIcon('Assigned Tasks')}
                    <span>Tasks</span>
                </a>
                <a href="/pages/maintenance/notifications.html" class="bottom-nav-item ${isNotificationsActive ? 'active' : ''}" ${isNotificationsActive ? 'aria-current="page"' : ''}>
                    ${getLinkIcon('Notifications')}
                    <span>Alerts</span>
                </a>
                <a href="/pages/maintenance/profile.html" class="bottom-nav-item ${isProfileActive ? 'active' : ''}" ${isProfileActive ? 'aria-current="page"' : ''}>
                    ${getLinkIcon('Profile')}
                    <span>Profile</span>
                </a>
            </nav>
        `;
    }

    dashboardLayout.innerHTML = sidebarHtml + topbarHtml;
    const shellUserNameEl = dashboardLayout.querySelector('.user-name');
    if (shellUserNameEl) shellUserNameEl.textContent = shellUserName;

    // Get original page content direct children of body (excluding script, style, modals, overlays)
    const bodyChildren = Array.from(document.body.children);
    const contentTarget = dashboardLayout.querySelector('.main-content-inner');

    // Insert the new dashboard layout as the first element in body
    document.body.insertBefore(dashboardLayout, document.body.firstChild);

    // Move the appropriate children inside the main-content-inner
    bodyChildren.forEach(child => {
        if (
            child.tagName !== 'SCRIPT' &&
            child.tagName !== 'STYLE' &&
            child !== dashboardLayout &&
            child.id !== 'updateModal' &&
            child.id !== 'reservationModal' &&
            !child.classList.contains('modal') &&
            !child.classList.contains('modal-overlay')
        ) {
            contentTarget.appendChild(child);
        }
    });

    ensureContextBreadcrumbs(role, window.location.pathname);

    // 3. Attach interactive behaviors
    // Mobile Sidebar toggle
    const menuToggleBtn = document.getElementById('menuToggleBtn');
    const sidebar = dashboardLayout.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (menuToggleBtn && sidebar && overlay) {
        menuToggleBtn.addEventListener('click', () => {
            sidebar.classList.add('open');
            overlay.classList.add('open');
            menuToggleBtn.setAttribute('aria-expanded', 'true');
            overlay.setAttribute('aria-hidden', 'false');
            window.requestAnimationFrame(() => {
                const firstNavigationControl = sidebar.querySelector('a[href], button:not([disabled])');
                if (firstNavigationControl) firstNavigationControl.focus();
            });
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
            menuToggleBtn.setAttribute('aria-expanded', 'false');
            overlay.setAttribute('aria-hidden', 'true');
            menuToggleBtn.focus();
        });
    }

    // 4. Preserve navigation position across document loads
    initDashboardNavigation(role, sidebar);

    // Logout button behavior
    const logoutBtn = document.getElementById('newLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', requestAuthenticatedLogout);
    }

    // Tenant Header Profile Dropdown behavior
    const profileDropdownBtn = document.getElementById('profileDropdownBtn');
    const profileDropdownMenu = document.getElementById('profileDropdownMenu');
    const dropdownProfileLink = document.getElementById('dropdownProfileLink');
    const dropdownThemeBtn = document.getElementById('dropdownThemeBtn');
    const dropdownTutorialBtn = document.getElementById('dropdownTutorialBtn');
    const dropdownLogoutBtn = document.getElementById('dropdownLogoutBtn');

    const updateDropdownThemeState = () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('domiknow_theme') || 'light';
        const isDark = currentTheme === 'dark';
        const label = document.getElementById('dropdownThemeLabel');
        const iconContainer = document.getElementById('dropdownThemeIcon');
        if (label) {
            label.textContent = isDark ? 'Light mode' : 'Dark mode';
        }
        if (iconContainer) {
            iconContainer.innerHTML = isDark
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
        }
    };

    if (profileDropdownBtn && profileDropdownMenu) {
        updateDropdownThemeState();
        window.addEventListener('domiknow:theme-changed', updateDropdownThemeState);

        profileDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = !profileDropdownMenu.hidden;
            profileDropdownMenu.hidden = isOpen;
            profileDropdownBtn.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) {
                updateDropdownThemeState();
                profileDropdownMenu.querySelector('[role="menuitem"]')?.focus();
            }
        });

        profileDropdownBtn.addEventListener('keydown', (event) => {
            if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
            event.preventDefault();
            profileDropdownMenu.hidden = false;
            profileDropdownBtn.setAttribute('aria-expanded', 'true');
            updateDropdownThemeState();
            const items = profileDropdownMenu.querySelectorAll('[role="menuitem"]');
            items[event.key === 'ArrowUp' ? items.length - 1 : 0]?.focus();
        });
        profileDropdownMenu.addEventListener('keydown', (event) => {
            const items = Array.from(profileDropdownMenu.querySelectorAll('[role="menuitem"]'));
            const current = items.indexOf(document.activeElement);
            const positions = {
                ArrowDown: (current + 1) % items.length,
                ArrowUp: (current - 1 + items.length) % items.length,
                Home: 0,
                End: items.length - 1
            };
            if (event.key in positions) {
                event.preventDefault();
                items[positions[event.key]]?.focus();
            } else if (event.key === 'Tab') {
                profileDropdownMenu.hidden = true;
                profileDropdownBtn.setAttribute('aria-expanded', 'false');
                profileDropdownBtn.focus();
            }
        });

        document.addEventListener('click', (e) => {
            if (!profileDropdownMenu.hidden && !profileDropdownBtn.contains(e.target) && !profileDropdownMenu.contains(e.target)) {
                profileDropdownMenu.hidden = true;
                profileDropdownBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (dropdownProfileLink) {
        dropdownProfileLink.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (profileDropdownMenu) profileDropdownMenu.hidden = true;
            if (profileDropdownBtn) profileDropdownBtn.setAttribute('aria-expanded', 'false');
            window.location.href = dropdownProfileLink.getAttribute('href') || ('/pages/' + (role || 'tenant') + '/profile.html');
        });
    }

    if (dropdownThemeBtn) {
        dropdownThemeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.DomiKnowTheme?.toggle();
        });
    }

    if (dropdownTutorialBtn) {
        dropdownTutorialBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (profileDropdownMenu) profileDropdownMenu.hidden = true;
            if (profileDropdownBtn) profileDropdownBtn.setAttribute('aria-expanded', 'false');
            if (window.DomiKnowWalkthrough && typeof window.DomiKnowWalkthrough.replay === 'function') {
                window.DomiKnowWalkthrough.replay();
            } else if (window.DomiKnowWalkthrough && typeof window.DomiKnowWalkthrough.start === 'function') {
                window.DomiKnowWalkthrough.start({ force: true });
            } else {
                const existingReplayBtn = document.querySelector('.dk-tour-replay');
                if (existingReplayBtn) existingReplayBtn.click();
            }
        });
    }

    if (dropdownLogoutBtn) {
        dropdownLogoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (profileDropdownMenu) profileDropdownMenu.hidden = true;
            if (profileDropdownBtn) profileDropdownBtn.setAttribute('aria-expanded', 'false');
            await requestAuthenticatedLogout();
        });
    }

    // --- Tenant Specific Custom Interactive Behaviors ---
    const isTenant = sidebar && sidebar.classList.contains('sidebar-tenant');
    if (isTenant || document.getElementById('btnOpenNavSheet')) {
        const sidebarEl = document.getElementById('domiknowSidebar');
        
        // Bottom Nav Sheet open/close toggles
        const btnOpenNavSheet = document.getElementById('btnOpenNavSheet');
        const btnCloseNavSheet = document.getElementById('btnCloseNavSheet');
        const navSheetOverlay = document.getElementById('navSheetOverlay');
        const sheetLogoutBtn = document.getElementById('sheetLogoutBtn');

        if (btnOpenNavSheet && btnCloseNavSheet && navSheetOverlay) {
            btnOpenNavSheet.addEventListener('click', () => {
                navSheetOverlay.classList.add('open');
                btnOpenNavSheet.setAttribute('aria-expanded', 'true');
                navSheetOverlay.setAttribute('aria-hidden', 'false');
                window.requestAnimationFrame(() => btnCloseNavSheet.focus());
            });

            btnCloseNavSheet.addEventListener('click', () => {
                navSheetOverlay.classList.remove('open');
                btnOpenNavSheet.setAttribute('aria-expanded', 'false');
                navSheetOverlay.setAttribute('aria-hidden', 'true');
                btnOpenNavSheet.focus();
            });

            navSheetOverlay.addEventListener('click', (e) => {
                if (e.target === navSheetOverlay) {
                    navSheetOverlay.classList.remove('open');
                    btnOpenNavSheet.setAttribute('aria-expanded', 'false');
                    navSheetOverlay.setAttribute('aria-hidden', 'true');
                    btnOpenNavSheet.focus();
                }
            });
        }

        if (sheetLogoutBtn) {
            sheetLogoutBtn.addEventListener('click', requestAuthenticatedLogout);
        }

        if (sidebarEl) {
            // 1. Group Header accordion toggles
            const groupHeaders = sidebarEl.querySelectorAll('.sidebar-group-header');
            groupHeaders.forEach(header => {
                if (header.tagName.toLowerCase() !== 'button') return;
                header.addEventListener('click', (e) => {
                    const group = header.closest('.sidebar-group');
                    const groupName = group.getAttribute('data-group');
                    const isExpanded = group.classList.toggle('expanded');
                    header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
                    sessionStorage.setItem(`domiknow_group_${groupName}`, isExpanded ? 'true' : 'false');
                });
            });
        }

        // 5. Keyboard Shortcuts alert trigger
        const shortcutsBtn = document.getElementById('popoverShortcutsBtn');
        if (shortcutsBtn) {
            shortcutsBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await window.domiknowAlert({
                    variant: 'info',
                    eyebrow: 'Tenant navigation',
                    title: 'Keyboard shortcuts',
                    message: 'Use these shortcuts to move between the main tenant tools.',
                    details: [
                        'Alt + D — Property discovery',
                        'Alt + A — Applications',
                        'Alt + L — Lease agreement',
                        'Alt + P — Billing and payments',
                        'Alt + S — Support tools',
                        'Alt + R — Reports center'
                    ],
                    confirmLabel: 'Got it'
                });
            });
        }
    }

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;

        const profileMenu = document.getElementById('profileDropdownMenu');
        const profileBtn = document.getElementById('profileDropdownBtn');
        if (profileMenu && !profileMenu.hidden) {
            profileMenu.hidden = true;
            if (profileBtn) {
                profileBtn.setAttribute('aria-expanded', 'false');
                profileBtn.focus();
            }
            return;
        }

        const openNavSheet = document.getElementById('navSheetOverlay');
        const navSheetTrigger = document.getElementById('btnOpenNavSheet');
        if (openNavSheet && openNavSheet.classList.contains('open')) {
            openNavSheet.classList.remove('open');
            openNavSheet.setAttribute('aria-hidden', 'true');
            if (navSheetTrigger) {
                navSheetTrigger.setAttribute('aria-expanded', 'false');
                navSheetTrigger.focus();
            }
            return;
        }

        if (sidebar && overlay && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
            overlay.setAttribute('aria-hidden', 'true');
            if (menuToggleBtn) {
                menuToggleBtn.setAttribute('aria-expanded', 'false');
                menuToggleBtn.focus();
            }
        }
    });

    // INSTANT FADE-IN: Reveal layout smooth & flicker-free once sidebar is constructed
    loadNotificationSystemAssets();
    document.body.classList.remove('app-loading');
    document.body.classList.add('app-ready');
    document.dispatchEvent(new CustomEvent('domiknow:shell-ready', { detail: { role } }));
}

// ── 4. Persistent Sidebar Navigation & Active Indicator ──

const parentNavigationPages = {
    admin: {
        'property-review-details.html': 'property-review.html',
        'report-detail.html': 'reports.html'
    },
    maintenance: {
        'task-details.html': 'tasks.html'
    },
    tenant: {
        'property-details.html': 'properties.html',
        'apply.html': 'properties.html',
        'application-details.html': 'applications.html',
        'lease-details.html': 'leases.html',
        'landlord-report-form.html': 'reports.html',
        'tenant-reports.html': 'reports.html'
    },
    landlord: {
        'property-create.html': 'properties.html',
        'property-details.html': 'properties.html',
        'units.html': 'properties.html',
        'application-details.html': 'applications.html',
        'lease-details.html': 'leases.html',
        'lease-create.html': 'leases.html',
        'maintenance-details.html': 'maintenance.html',
        'tenant-report-form.html': 'reports.html',
        'landlord-reports.html': 'reports.html'
    }
};

const contextualPageLabels = {
    'property-create.html': 'Register property',
    'property-details.html': 'Property details',
    'units.html': 'Rooms and units',
    'apply.html': 'Rental application',
    'application-details.html': 'Application details',
    'lease-details.html': 'Lease details',
    'lease-create.html': 'Create lease',
    'maintenance-details.html': 'Maintenance details',
    'task-details.html': 'Task details',
    'property-review-details.html': 'Property review details',
    'report-detail.html': 'Case details',
    'landlord-report-form.html': 'Report landlord',
    'tenant-report-form.html': 'Report tenant',
    'tenant-reports.html': 'Reports against me',
    'landlord-reports.html': 'Reports against me'
};

function navigationLabelForFile(role, filename) {
    if (typeof NAVIGATION_CONFIG === 'undefined') return null;
    for (const section of NAVIGATION_CONFIG[role] || []) {
        for (const item of section.items || []) {
            if (String(item.href || '').endsWith(filename)) return item.label;
            const subItem = (item.subItems || []).find(candidate => String(candidate.href || '').endsWith(filename));
            if (subItem) return subItem.label;
        }
    }
    return null;
}

function ensureContextBreadcrumbs(role, pathname = window.location.pathname) {
    const content = document.querySelector('.main-content-inner');
    if (!content) return;
    content.querySelectorAll('[data-domiknow-breadcrumbs], .dk-breadcrumbs').forEach(el => el.remove());

    if (role === 'tenant') {
        content.querySelectorAll('.breadcrumb-nav').forEach(el => el.remove());
        return;
    }

    const filename = pathname.split('/').pop().split('?')[0].split('#')[0];
    const parentFilename = parentNavigationPages[role]?.[filename];
    if (!parentFilename) return;

    const legacyBreadcrumb = content.querySelector('.breadcrumb-nav');
    if (legacyBreadcrumb) {
        legacyBreadcrumb.classList.add('dk-breadcrumbs', 'dk-breadcrumbs--legacy');
        legacyBreadcrumb.dataset.domiknowBreadcrumbs = '';
        legacyBreadcrumb.setAttribute('role', 'navigation');
        legacyBreadcrumb.setAttribute('aria-label', 'Breadcrumb');
        legacyBreadcrumb.removeAttribute('style');
        legacyBreadcrumb.querySelectorAll('a, .breadcrumb-separator, .breadcrumb-current').forEach(element => {
            element.removeAttribute('style');
        });
        legacyBreadcrumb.querySelectorAll('.breadcrumb-separator').forEach(separator => {
            separator.textContent = '/';
        });
        legacyBreadcrumb.querySelector('.breadcrumb-current')?.setAttribute('aria-current', 'page');
        return;
    }

    const parentLabel = navigationLabelForFile(role, parentFilename) || 'Back to list';
    const currentLabel = contextualPageLabels[filename]
        || document.getElementById('appPageTitle')?.textContent.trim()
        || 'Details';
    const nav = document.createElement('nav');
    nav.className = 'dk-breadcrumbs';
    nav.dataset.domiknowBreadcrumbs = '';
    nav.setAttribute('aria-label', 'Breadcrumb');
    const list = document.createElement('ol');
    const parentItem = document.createElement('li');
    const parentLink = document.createElement('a');
    parentLink.href = `/pages/${role}/${parentFilename}`;
    parentLink.textContent = parentLabel;
    parentItem.appendChild(parentLink);
    const currentItem = document.createElement('li');
    currentItem.textContent = currentLabel;
    currentItem.setAttribute('aria-current', 'page');
    list.append(parentItem, currentItem);
    nav.appendChild(list);
    content.insertBefore(nav, content.firstChild);
}

function updateActiveNavigationIndicators(pathname, role) {
    const filename = (pathname || window.location.pathname).split('/').pop().split('?')[0].split('#')[0] || 'properties.html';
    const activeNavFilename = parentNavigationPages[role]?.[filename] || filename;

    // 1. Sidebar links
    document.querySelectorAll('.sidebar-link, .sidebar-sub-link').forEach(link => {
        if (!link.href || link.id === 'newLogoutBtn') return;
        const linkHref = link.getAttribute('href') || '';
        const linkFile = linkHref.split('/').pop().split('?')[0].split('#')[0];
        const isActive = linkFile === activeNavFilename;
        if (isActive) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        } else {
            link.classList.remove('active');
            link.removeAttribute('aria-current');
        }
    });

    // 2. Bottom nav items
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
        if (item.tagName === 'BUTTON') return;
        const linkHref = item.getAttribute('href') || '';
        const linkFile = linkHref.split('/').pop().split('?')[0].split('#')[0];
        const isActive = linkFile === activeNavFilename;
        if (isActive) {
            item.classList.add('active');
            item.setAttribute('aria-current', 'page');
        } else {
            item.classList.remove('active');
            item.removeAttribute('aria-current');
        }
    });

    // 3. Nav sheet items
    document.querySelectorAll('.nav-sheet-item').forEach(item => {
        if (item.tagName === 'BUTTON') return;
        const linkHref = item.getAttribute('href') || '';
        const linkFile = linkHref.split('/').pop().split('?')[0].split('#')[0];
        const isActive = linkFile === activeNavFilename;
        if (isActive) {
            item.classList.add('active');
            item.setAttribute('aria-current', 'page');
        } else {
            item.classList.remove('active');
            item.removeAttribute('aria-current');
        }
    });

    // 4. Header dropdown items
    document.querySelectorAll('.topbar-dropdown-item').forEach(item => {
        if (item.tagName === 'BUTTON') return;
        const linkHref = item.getAttribute('href') || '';
        const linkFile = linkHref.split('/').pop().split('?')[0].split('#')[0];
        const isActive = linkFile === activeNavFilename;
        if (isActive) {
            item.classList.add('active');
            item.setAttribute('aria-current', 'page');
        } else {
            item.classList.remove('active');
            item.removeAttribute('aria-current');
        }
    });
}

// Each workspace page owns its scripts, forms and styles. Use the browser's
// document lifecycle so page listeners cannot leak into the next workflow.
function initDashboardNavigation(role, sidebar) {
    if (!sidebar) return;
    const scrollKey = `domiknow_sidebar_scroll_${role}`;
    try {
        const savedScroll = sessionStorage.getItem(scrollKey);
        if (savedScroll !== null && Number.isFinite(Number(savedScroll))) {
            sidebar.scrollTop = Math.max(0, Number(savedScroll));
        }
    } catch (_) {
        // Navigation remains usable when browser storage is unavailable.
    }
    sidebar.addEventListener('scroll', () => {
        try { sessionStorage.setItem(scrollKey, String(sidebar.scrollTop)); } catch (_) {}
    }, { passive: true });
    updateActiveNavigationIndicators(window.location.pathname, role);
}

// Minimal inline SVG icons for sidebar links (Serious & System-like)
function getLinkIcon(label) {
    const baseSvg = (pathData) => `<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${pathData}</svg>`;
    
    const icons = {
        'Dashboard': baseSvg('<rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect>'),
        'Property Discovery': baseSvg('<circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>'),
        'Recommendations': baseSvg('<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>'),
        'Compare Properties': baseSvg('<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"></path>'),
        
        'My Reservations': baseSvg('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>'),
        'Reservation Monitoring': baseSvg('<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>'),
        
        'My Applications': baseSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>'),
        'Tenant Applications': baseSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>'),
        
        'Screening': baseSvg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>'),
        'Tenant Screening': baseSvg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>'),
        'Screening Monitor': baseSvg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>'),
        
        'My Lease': baseSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>'),
        'Leases': baseSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>'),
        'Lease Monitor': baseSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>'),
        
        'My Billings': baseSvg('<rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line>'),
        'Billings': baseSvg('<rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line>'),
        'Billing Monitor': baseSvg('<rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line>'),
        
        'My Payments': baseSvg('<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>'),
        'Payments': baseSvg('<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>'),
        'Payment Monitor': baseSvg('<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>'),
        
        'Maintenance Requests': baseSvg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>'),
        'Maintenance Management': baseSvg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>'),
        'Maintenance Monitor': baseSvg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>'),
        'Assigned Tasks': baseSvg('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>'),
        
        'Reports': baseSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>'),
        'Reports Monitor': baseSvg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line>'),
        
        'Disputes': baseSvg('<circle cx="6" cy="19" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M6 12V6a6 6 0 1 1 12 0v6M12 2v10"></path>'),
        'Disputes Monitor': baseSvg('<circle cx="6" cy="19" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M6 12V6a6 6 0 1 1 12 0v6M12 2v10"></path>'),
        
        'Policy Violations': baseSvg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'),
        'Policy Violations Monitor': baseSvg('<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'),
        
        'Ratings and Feedback': baseSvg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>'),
        'Feedback Monitor': baseSvg('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>'),
        
        'My Properties': baseSvg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>'),
        'Property Review': baseSvg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>'),
        'Register Property': baseSvg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>'),
        'User Management': baseSvg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>'),
        'Utilities': baseSvg('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>'),
        'Audit Logs': baseSvg('<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>'),
        'Notifications': baseSvg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path>'),
        'Profile': baseSvg('<path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle>')
    };

    icons['Overview'] = icons['Dashboard'];
    icons['Properties'] = icons['My Properties'];
    icons['Tenant Applications'] = icons['Tenant Applications'];
    icons['Lease Agreements'] = icons['Leases'];
    icons['Billing & Payments'] = icons['Billings'];
    icons['Reports Center'] = icons['Reports'];
    icons['Complaints'] = icons['Disputes'];
    icons['Reviews & Feedback'] = icons['Ratings and Feedback'];
    icons['User Access'] = icons['User Management'];
    icons['Property Approvals'] = icons['Property Review'];
    icons['Reservations'] = icons['Reservation Monitoring'];
    icons['Payment Monitoring'] = icons['Payment Monitor'];
    icons['Case Triage'] = icons['Reports Monitor'];
    icons['Policies'] = icons['Policy Violations'];
    icons['Audit Trail'] = icons['Audit Logs'];
    icons['My Profile'] = icons['Profile'];
    
    return icons[label] || baseSvg('<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line>');
}

// Custom Premium Icons for Tenant Sidebar redesign
function getTenantIcon(label) {
    const icons = {
        'Home': `<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
        'Discovery': `<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
        'Applications': `<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
        'Leases': `<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
        'Payments': `<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`,
        'Support': `<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21a9 9 0 1 0-9-9c0 1.48.36 2.88 1 4.11L3 21l4.89-1c1.23.64 2.63 1 4.11 1z"></path><circle cx="8" cy="12" r="1" fill="currentColor" stroke="none"></circle><circle cx="12" cy="12" r="1" fill="currentColor" stroke-none"></circle><circle cx="16" cy="12" r="1" fill="currentColor" stroke-none"></circle></svg>`,
        'Reports': `<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>`,
        'Help': `<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        'Setting': `<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
    };
    return (icons[label] || '').replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
}
