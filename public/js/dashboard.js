// Dashboard guard and initialization

// Run on page load
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Check token
    const token = localStorage.getItem('domiknow_token');
    if (!token) {
        window.location.href = '/pages/auth/login.html';
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

    let expectedRole = null;
    if (path.includes('/tenant/')) expectedRole = 'tenant';
    if (path.includes('/landlord/')) expectedRole = 'landlord';
    if (path.includes('/maintenance/')) expectedRole = 'maintenance';
    if (path.includes('/admin/')) expectedRole = 'admin';

    const storedRole = localStorage.getItem('domiknow_role');
    const activeRole = expectedRole || storedRole || 'tenant';

    // ⚡ INSTANT SIDEBAR RENDER: Render layout synchronously BEFORE network fetch
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
            // Token invalid or expired
            localStorage.removeItem('domiknow_token');
            localStorage.removeItem('domiknow_role');
            window.location.href = '/pages/auth/login.html';
            return;
        }

        const result = await response.json();
        const user = result.data;

        // 3. Verify role
        if (expectedRole && user.role !== expectedRole) {
            const landingPagesByRole = {
                tenant: '/pages/tenant/properties.html',
                landlord: '/pages/landlord/properties.html',
                admin: '/pages/admin/reports.html',
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
                section: 'Main',
                items: [
                    { label: 'My Properties', href: 'properties.html' },
                    { label: 'Register Property', href: 'property-create.html' }
                ]
            },
            {
                section: 'Tenant Management',
                items: [
                    { label: 'Tenant Applications', href: 'applications.html' },
                    { label: 'Leases', href: 'leases.html' }
                ]
            },
            {
                section: 'Rental Operations',
                items: [
                    { label: 'Billings', href: 'billings.html' },
                    { label: 'Payments', href: 'payments.html' }
                ]
            },
            {
                section: 'Support and Regulation',
                items: [
                    { label: 'Maintenance Management', href: 'maintenance.html' },
                    { label: 'Reports', href: 'reports.html' },
                    { label: 'Disputes', href: 'disputes.html' },
                    { label: 'Ratings and Feedback', href: 'feedback.html' }
                ]
            }
        ],
        admin: [
            {
                section: 'Main',
                items: [
                    { label: 'Users', href: 'users.html' },
                    { label: 'Property Review', href: 'property-review.html' },
                    { label: 'Reservation Monitoring', href: 'reservations.html' }
                ]
            },
            {
                section: 'Monitoring & Governance',
                items: [
                    { label: 'Payment Monitor', href: 'payments.html' },
                    { label: 'Reports Triage', href: 'reports.html' },
                    { label: 'Policy Management', href: 'policy-management.html' },
                    { label: 'Audit Logs', href: 'audit-logs.html' }
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
    const shellUserName = (user && user.full_name) ? user.full_name : 'Checking account...';

    if (role === 'tenant') {
        // Render the full tenant sidebar; mobile navigation uses the drawer.
        sidebarHtml = `
            <aside class="sidebar sidebar-tenant" id="domiknowSidebar" aria-label="${roleLabel} navigation">
                <div class="sidebar-logo-container">
                    <div class="app-brand" aria-label="DOMIKNOW">
                        <span class="app-brand-mark" aria-hidden="true">D</span>
                        <span class="app-brand-name">DOMI<span class="app-brand-accent">KNOW</span></span>
                    </div>
                    <span class="role-badge navbar-badge ${roleBadgeClass}">${roleLabel}</span>
                </div>

                <nav class="sidebar-menu" aria-label="Primary navigation">
                    <div class="sidebar-section-title">Overview</div>
        `;
        
        const overviewGroup = menuGroups.find(g => g.section === 'Overview');
        if (overviewGroup) {
            overviewGroup.items.forEach(item => {
                let isGroupActive = false;
                if (item.subItems) {
                    item.subItems.forEach(sub => {
                        if (activeNavigationFilename === sub.href) {
                            isGroupActive = true;
                        }
                    });
                }
                
                const activeGroupKey = `domiknow_group_${item.label.toLowerCase()}`;
                let isExpanded = sessionStorage.getItem(activeGroupKey);
                if (isExpanded === null) {
                    isExpanded = isGroupActive ? 'true' : 'false';
                }
                
                const expandedClass = isExpanded === 'true' ? 'expanded' : '';
                const groupActiveClass = isGroupActive ? 'group-active' : '';
                const groupPanelId = `sidebar-group-${item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
                
                if (item.subItems && item.subItems.length === 1) {
                    const isSubActive = activeNavigationFilename === item.subItems[0].href;
                    sidebarHtml += `
                        <div class="sidebar-group ${groupActiveClass}" data-group="${item.label.toLowerCase()}">
                            <a href="${item.subItems[0].href}" class="sidebar-group-header ${isSubActive ? 'active' : ''}" ${isSubActive ? 'aria-current="page"' : ''}>
                                <span class="sidebar-group-header-left">
                                    ${getTenantIcon(item.label)}
                                    <span class="sidebar-group-label">${item.label}</span>
                                </span>
                            </a>
                        </div>
                    `;
                } else {
                    sidebarHtml += `
                        <div class="sidebar-group ${expandedClass} ${groupActiveClass}" data-group="${item.label.toLowerCase()}">
                            <button type="button" class="sidebar-group-header" aria-expanded="${isExpanded === 'true'}" aria-controls="${groupPanelId}">
                                <span class="sidebar-group-header-left">
                                    ${getTenantIcon(item.label)}
                                    <span class="sidebar-group-label">${item.label}</span>
                                </span>
                                <span class="sidebar-group-arrow">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                        <polyline points="6 9 12 15 18 9"></polyline>
                                    </svg>
                                </span>
                            </button>
                            <div class="sidebar-sub-menu" id="${groupPanelId}">
                    `;
                    
                    if (item.subItems) {
                        item.subItems.forEach(sub => {
                            const isSubActive = activeNavigationFilename === sub.href;
                            const subActiveClass = isSubActive ? 'active' : '';
                            sidebarHtml += `
                                <a href="${sub.href}" class="sidebar-sub-link ${subActiveClass}" ${isSubActive ? 'aria-current="page"' : ''}>
                                    <span class="sub-link-dot"></span>
                                    <span class="sidebar-sub-label">${sub.label}</span>
                                </a>
                            `;
                        });
                    }
                    
                    sidebarHtml += `
                            </div>
                        </div>
                    `;
                }
            });
        }
        
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
                        <span class="topbar-context">${roleLabel} workspace</span>
                        <h1 class="topbar-title" id="appPageTitle">${pageTitle}</h1>
                    </div>
                </div>
                <div class="topbar-right">
                    <button type="button" class="topbar-action theme-toggle" data-theme-toggle aria-label="Toggle color theme" aria-pressed="false" title="Toggle color theme">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>
                    </button>
                    <div class="topbar-account" aria-label="Signed in user">
                        <span class="topbar-account-role">${roleLabel}</span>
                        <span class="user-name">Checking account...</span>
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
                          ['maintenance.html', 'disputes.html', 'feedback.html'].includes(activeNavigationFilename) ? 'support' : '';

        topbarHtml += `
            <nav class="bottom-nav-bar" aria-label="Tenant quick navigation">
                <a href="/pages/tenant/properties.html" class="bottom-nav-item ${activeTab === 'discovery' ? 'active' : ''}" aria-label="Explore properties" ${activeTab === 'discovery' ? 'aria-current="page"' : ''}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </a>
                <a href="/pages/tenant/applications.html" class="bottom-nav-item ${activeTab === 'applications' ? 'active' : ''}" aria-label="Applications" ${activeTab === 'applications' ? 'aria-current="page"' : ''}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </a>
                <a href="/pages/tenant/leases.html" class="bottom-nav-item ${activeTab === 'leases' ? 'active' : ''}" aria-label="Lease" ${activeTab === 'leases' ? 'aria-current="page"' : ''}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </a>
                <a href="/pages/tenant/billings.html" class="bottom-nav-item ${activeTab === 'payments' ? 'active' : ''}" aria-label="Payments" ${activeTab === 'payments' ? 'aria-current="page"' : ''}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                </a>
                <a href="/pages/tenant/reports.html" class="bottom-nav-item ${activeTab === 'reports' ? 'active' : ''}" aria-label="Reports" ${activeTab === 'reports' ? 'aria-current="page"' : ''}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </a>
                <button type="button" id="btnOpenNavSheet" class="bottom-nav-item ${activeTab === 'support' ? 'active' : ''}" aria-label="Open help and settings" aria-controls="navSheetOverlay" aria-expanded="false">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </button>
            </nav>

            <div id="navSheetOverlay" class="nav-sheet-overlay" aria-hidden="true">
                <section class="nav-sheet" role="dialog" aria-modal="true" aria-labelledby="navSheetTitle">
                    <div class="nav-sheet-header">
                        <h2 class="nav-sheet-title" id="navSheetTitle">Help &amp; settings</h2>
                        <button type="button" id="btnCloseNavSheet" class="nav-sheet-close" aria-label="Close help and settings">&times;</button>
                    </div>
                    <nav class="nav-sheet-menu" aria-label="Tenant support navigation">
                        <a href="/pages/tenant/maintenance.html" class="nav-sheet-item" ${activeNavigationFilename === 'maintenance.html' ? 'aria-current="page"' : ''}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                            <span>Maintenance requests</span>
                        </a>
                        <a href="/pages/tenant/disputes.html" class="nav-sheet-item" ${activeNavigationFilename === 'disputes.html' ? 'aria-current="page"' : ''}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            <span>Disputes</span>
                        </a>
                        <a href="/pages/tenant/feedback.html" class="nav-sheet-item" ${activeNavigationFilename === 'feedback.html' ? 'aria-current="page"' : ''}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            <span>Ratings &amp; feedback</span>
                        </a>
                        <button type="button" id="sheetLogoutBtn" class="nav-sheet-item logout" aria-label="Log out of DOMIKNOW">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                            <span>Log out</span>
                        </button>
                    </nav>
                </section>
            </div>
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

    // 4. Attach Sidebar Scroll Persistence (remembers scroll position across page transitions)
    initSidebarScrollPersistence(sidebar);

    // Logout button behavior
    const logoutBtn = document.getElementById('newLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('domiknow_token');
            localStorage.removeItem('domiknow_role');
            window.location.href = '/pages/auth/login.html';
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
            sheetLogoutBtn.addEventListener('click', () => {
                localStorage.removeItem('domiknow_token');
                localStorage.removeItem('domiknow_role');
                window.location.href = '/pages/auth/login.html';
            });
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
            shortcutsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                alert('Shortcuts:\nAlt + D: Discovery\nAlt + A: Applications\nAlt + L: Leases\nAlt + P: Payments\nAlt + S: Support\nAlt + R: Reports');
            });
        }
    }

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;

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

    // ⚡ INSTANT FADE-IN: Reveal layout smooth & flicker-free once sidebar is constructed
    document.body.classList.remove('app-loading');
    document.body.classList.add('app-ready');
}

function initSidebarScrollPersistence(sidebar) {
    if (!sidebar) return;

    // Restore scroll position from sessionStorage
    const savedScroll = sessionStorage.getItem('domiknow_sidebar_scroll');
    if (savedScroll !== null) {
        sidebar.scrollTop = parseInt(savedScroll, 10);
    } else {
        const activeLink = sidebar.querySelector('.sidebar-link.active, .sidebar-sub-link.active');
        if (activeLink) {
            activeLink.scrollIntoView({ block: 'nearest' });
        }
    }

    // Save scroll position on scroll
    sidebar.addEventListener('scroll', () => {
        sessionStorage.setItem('domiknow_sidebar_scroll', sidebar.scrollTop);
    }, { passive: true });

    // Save scroll position and smoothly fade out ONLY main content panel on link click (sidebar stays rock solid)
    sidebar.addEventListener('click', (e) => {
        const link = e.target.closest('.sidebar-link, .sidebar-sub-link');
        if (link && link.href) {
            sessionStorage.setItem('domiknow_sidebar_scroll', sidebar.scrollTop);
            const mainContent = document.querySelector('.main-content-inner');
            if (mainContent) {
                mainContent.style.opacity = '0';
            }
        }
    });
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
        'Audit Logs': baseSvg('<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>')
    };
    
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
        'Support': `<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
        'Reports': `<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>`,
        'Help': `<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
        'Setting': `<svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
    };
    return (icons[label] || '').replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
}
