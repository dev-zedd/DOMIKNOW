// Shared Navigation Configuration for DOMIKNOW System
// This file contains role-based navigation items for the sidebar

const NAVIGATION_CONFIG = {
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
        { label: 'User Access', href: 'users.html' },
        { label: 'Property Approvals', href: 'property-review.html' }
      ]
    },
    {
      section: 'Platform Monitoring',
      items: [
        { label: 'Payment Verification', href: 'payments.html' }
      ]
    },
    {
      section: 'Trust & Governance',
      items: [
        { label: 'Case Triage', href: 'reports.html' },
        { label: 'Policies', href: 'policy-management.html' },
        { label: 'Audit Logs', href: 'audit-logs.html' }
      ]
    }
  ],
  maintenance: [
    {
      section: 'Main',
      items: [
        { label: 'Dashboard', href: 'dashboard.html' },
        { label: 'Assigned Tasks', href: 'tasks.html' },
        { label: 'Notifications', href: 'notifications.html' },
        { label: 'My Profile', href: 'profile.html' }
      ]
    }
  ]
};
