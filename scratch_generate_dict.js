const fs = require('fs');
const path = require('path');

const tablesData = JSON.parse(fs.readFileSync('all_tables_detailed.json', 'utf8'));

// Categorization of the 53 tables
const categories = [
    {
        name: "1. User Authentication & Access Control (Users & Security)",
        description: "Mga talahanayan para sa user accounts, authentication, email verification, at security audit logs.",
        tables: ["users", "email_verifications", "audit_logs"]
    },
    {
        name: "2. Property & Unit Inventory Management",
        description: "Mga talahanayan para sa pagpaparehistro ng boarding house/apartment, units, bedspaces, amenities, at photos.",
        tables: [
            "properties", "property_amenities", "property_documents", "property_images",
            "property_reservations", "property_units", "unit_amenities", "unit_images", "unit_beds"
        ]
    },
    {
        name: "3. Multi-Criteria Recommendation Engine (TOPSIS)",
        description: "Mga talahanayan para sa recommendation runs, tenant criteria weighting, at algorithmic scoring.",
        tables: ["recommendation_runs", "recommendation_candidates", "recommendation_exclusions"]
    },
    {
        name: "4. Tenant Application & Screening",
        description: "Mga talahanayan para sa rental applications, requirements submission, at landlord tenant screening.",
        tables: ["tenant_applications", "tenant_application_documents", "tenant_screening"]
    },
    {
        name: "5. Digital Lease Contract Management",
        description: "Talahanayan para sa legal na digital lease agreements, terms, rent amount, security deposit, at digital signatures.",
        tables: ["lease_records"]
    },
    {
        name: "6. Billing, Utility Submetering & Payments",
        description: "Mga talahanayan para sa submeter electric/water readings, monthly statement of accounts, at payment receipts.",
        tables: ["utility_records", "billing_records", "payment_records", "statements"]
    },
    {
        name: "7. Maintenance & Work Order Operations",
        description: "Mga talahanayan para sa repair requests, category triage, staff assignment, progress updates, at materials.",
        tables: [
            "maintenance_requests", "maintenance_categories", "maintenance_personnel",
            "maintenance_assignments", "maintenance_updates", "maintenance_task_updates",
            "maintenance_photos", "maintenance_materials", "maintenance_reports", "landlord_workers"
        ]
    },
    {
        name: "8. Complaints, Disputes & Policy Governance",
        description: "Mga talahanayan para sa tenant/landlord complaints, formal dispute escalation, at policy violations.",
        tables: ["complaints", "complaint_status_logs", "disputes", "policy_violations", "policies", "platform_policies"]
    },
    {
        name: "9. Incident Case Triage & Evidence Reports",
        description: "Mga talahanayan para sa administrative reporting ng misconduct, photo evidence, at live message threads.",
        tables: ["tenant_reports", "tenant_report_evidence", "landlord_reports", "landlord_report_evidence", "user_reports", "reports", "report_messages", "messages"]
    },
    {
        name: "10. Ratings, Reviews & Feedback System",
        description: "Mga talahanayan para sa multi-criteria property reviews, landlord performance ratings, at feedback summary.",
        tables: ["property_ratings", "landlord_ratings_v2", "landlord_ratings", "ratings_feedback", "property_feedback_summary"]
    },
    {
        name: "11. In-App Notifications & Alerts",
        description: "Talahanayan para sa system notifications, payment alerts, lease reminders, at ticket updates.",
        tables: ["notifications"]
    }
];

let md = `# DOMIKNOW DATABASE DATA DICTIONARY\n`;
md += `**System:** DOMIKNOW - Property & Rental Management Platform\n`;
md += `**Database Engine:** PostgreSQL (Supabase Cloud Database)\n`;
md += `**Kabuuang Dami ng Tables:** 53 Active Tables\n\n`;
md += `---\n\n`;

md += `## Talaan ng Nilalaman (Summary List ng 53 Tables)\n\n`;
let counter = 1;
for (const cat of categories) {
    md += `### ${cat.name}\n`;
    for (const t of cat.tables) {
        md += `${counter++}. [\`${t}\`](#${t.replace(/_/g, '-')})\n`;
    }
    md += `\n`;
}

md += `---\n\n`;
md += `## Detalyadong Data Dictionary ng Bawat Table\n\n`;

for (const cat of categories) {
    md += `## ${cat.name}\n> ${cat.description}\n\n`;
    for (const t of cat.tables) {
        const info = tablesData[t] || { cols: [] };
        md += `### <a id="${t.replace(/_/g, '-')}"></a> Table: \`${t}\`\n\n`;
        md += `| Column Name | Description / Sample Value |\n`;
        md += `| :--- | :--- |\n`;
        for (const col of info.cols) {
            md += `| \`${col}\` | Field ng table na \`${t}\` |\n`;
        }
        md += `\n`;
        if (info.sqlDefinition) {
            md += `<details><summary>Tingnan ang SQL Definition</summary>\n\n\`\`\`sql\nCREATE TABLE ${t} (\n${info.sqlDefinition}\n);\n\`\`\`\n</details>\n\n`;
        }
        md += `---\n\n`;
    }
}

fs.writeFileSync('DATA_DICTIONARY.md', md, 'utf8');
console.log('DATA_DICTIONARY.md generated successfully!');
