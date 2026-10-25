const fs = require('fs');

const dict = JSON.parse(fs.readFileSync('generated_dictionary_data.json', 'utf8'));

// Group tables into modules
const modules = [
  {
    name: "1. User Authentication & Identity Management",
    tables: ['users', 'email_verifications', 'audit_logs']
  },
  {
    name: "2. Property & Unit Inventory Management",
    tables: ['properties', 'property_amenities', 'property_documents', 'property_images', 'property_reservations', 'property_units', 'unit_amenities', 'unit_images', 'unit_beds']
  },
  {
    name: "3. TOPSIS Multi-Criteria Recommendation Engine",
    tables: ['recommendation_runs', 'recommendation_candidates', 'recommendation_exclusions']
  },
  {
    name: "4. Tenant Screening & Rental Applications",
    tables: ['tenant_applications', 'tenant_application_documents', 'tenant_screening']
  },
  {
    name: "5. Digital Lease Contract Management",
    tables: ['lease_records']
  },
  {
    name: "6. Utility Tracking, Billing & Payment Processing",
    tables: ['utility_records', 'billing_records', 'payment_records']
  },
  {
    name: "7. Maintenance Operations & Work Order Lifecycle",
    tables: ['maintenance_requests', 'maintenance_categories', 'maintenance_assignments', 'maintenance_updates', 'maintenance_task_updates', 'maintenance_photos', 'maintenance_materials', 'maintenance_reports']
  },
  {
    name: "8. Complaints, Disputes & Policy Governance",
    tables: ['complaints', 'complaint_status_logs', 'disputes', 'policy_violations']
  },
  {
    name: "9. Incident Case Triage & Case Messaging",
    tables: ['tenant_reports', 'tenant_report_evidence', 'landlord_reports', 'landlord_report_evidence', 'user_reports', 'report_messages']
  },
  {
    name: "10. Ratings, Reviews & Feedback System",
    tables: ['property_ratings', 'landlord_ratings_v2', 'landlord_ratings', 'ratings_feedback', 'property_feedback_summary']
  },
  {
    name: "11. System Notifications",
    tables: ['notifications']
  }
];

// 1. Build Markdown File
let md = `# DOMIKNOW DATABASE DATA DICTIONARY\n`;
md += `**Standard Table Format:** Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship\n\n`;

for (const mod of modules) {
  md += `## ${mod.name}\n\n`;
  for (const tableName of mod.tables) {
    const fields = dict[tableName] || [];
    md += `### \`${tableName}\`\n\n`;
    md += `| Field Name | Data Type | Data Format | Field Size | Description | Example | Relationship |\n`;
    md += `|:---|:---|:---|:---:|:---|:---|:---:|\n`;
    for (const f of fields) {
      md += `| \`${f.fieldName}\` | \`${f.dataType}\` | ${f.dataFormat} | ${f.fieldSize} | ${f.description} | \`${f.example}\` | ${f.relationship} |\n`;
    }
    md += `\n---\n\n`;
  }
}

fs.writeFileSync('../DATA_DICTIONARY_TABLES.md', md);
fs.writeFileSync('DATA_DICTIONARY_TABLES.md', md);
console.log('Generated DATA_DICTIONARY_TABLES.md successfully!');

// 2. Build HTML File
let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DOMIKNOW - Database Data Dictionary</title>
    <style>
        :root {
            --bg-color: #0b1528;
            --card-bg: #112240;
            --table-border: #1e3a68;
            --header-bg: #182e56;
            --row-alt: #0e1b33;
            --text-main: #e2e8f0;
            --text-muted: #94a3b8;
            --text-highlight: #38bdf8;
            --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        body.light-theme {
            --bg-color: #f8fafc;
            --card-bg: #ffffff;
            --table-border: #cbd5e1;
            --header-bg: #0f172a;
            --row-alt: #f8fafc;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --text-highlight: #0284c7;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--font-family);
            background-color: var(--bg-color);
            color: var(--text-main);
            line-height: 1.5;
            padding: 24px;
            transition: background-color 0.2s, color 0.2s;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--table-border);
            margin-bottom: 24px;
        }

        .title-area h1 {
            font-size: 1.6rem;
            font-weight: 700;
            letter-spacing: -0.5px;
            color: var(--text-main);
        }

        .title-area p {
            font-size: 0.9rem;
            color: var(--text-muted);
            margin-top: 4px;
        }

        .controls {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }

        .search-box {
            padding: 8px 14px;
            background: var(--card-bg);
            border: 1px solid var(--table-border);
            border-radius: 6px;
            color: var(--text-main);
            font-size: 0.9rem;
            width: 280px;
            outline: none;
        }

        .search-box:focus {
            border-color: var(--text-highlight);
        }

        .btn {
            padding: 8px 16px;
            background: var(--header-bg);
            border: 1px solid var(--table-border);
            color: var(--text-main);
            border-radius: 6px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .btn:hover {
            background: var(--text-highlight);
            color: #0b1528;
            border-color: var(--text-highlight);
        }

        /* Navigation Pills */
        .nav-pills {
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 16px;
            margin-bottom: 24px;
        }

        .pill {
            padding: 6px 12px;
            background: var(--card-bg);
            border: 1px solid var(--table-border);
            border-radius: 20px;
            font-size: 0.8rem;
            color: var(--text-muted);
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.2s;
            text-decoration: none;
        }

        .pill:hover, .pill.active {
            color: var(--text-main);
            background: var(--header-bg);
            border-color: var(--text-highlight);
        }

        /* Module section */
        .module-section {
            margin-bottom: 40px;
        }

        .module-title {
            font-size: 1.25rem;
            font-weight: 700;
            color: var(--text-highlight);
            margin-bottom: 16px;
            padding-left: 8px;
            border-left: 4px solid var(--text-highlight);
        }

        /* Table Card */
        .table-card {
            background: var(--card-bg);
            border: 1px solid var(--table-border);
            border-radius: 8px;
            overflow: hidden;
            margin-bottom: 28px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .table-banner {
            background: var(--header-bg);
            padding: 12px 20px;
            border-bottom: 1px solid var(--table-border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .table-name {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 1.1rem;
            font-weight: 700;
            color: #ffffff;
            letter-spacing: 0.5px;
        }

        body.light-theme .table-banner {
            background: #0f172a;
            color: #ffffff;
        }

        body.light-theme .table-name {
            color: #ffffff;
        }

        .table-meta {
            font-size: 0.8rem;
            color: var(--text-muted);
        }

        /* Data Dictionary Table */
        .table-wrapper {
            width: 100%;
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
            text-align: left;
        }

        th {
            background: rgba(0, 0, 0, 0.2);
            color: #cbd5e1;
            font-weight: 600;
            padding: 10px 16px;
            border-bottom: 1px solid var(--table-border);
            white-space: nowrap;
        }

        body.light-theme th {
            background: #f1f5f9;
            color: #334155;
        }

        td {
            padding: 10px 16px;
            border-bottom: 1px solid var(--table-border);
            vertical-align: top;
        }

        tbody tr:nth-child(even) {
            background: var(--row-alt);
        }

        tbody tr:hover {
            background: rgba(56, 189, 248, 0.05);
        }

        .col-name {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-weight: 600;
            color: var(--text-highlight);
            white-space: nowrap;
        }

        .col-type {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 0.82rem;
            color: #f43f5e;
            white-space: nowrap;
        }

        body.light-theme .col-type {
            color: #be123c;
        }

        .col-fmt {
            color: var(--text-muted);
            white-space: nowrap;
        }

        .col-size {
            text-align: center;
            color: var(--text-muted);
            white-space: nowrap;
        }

        .col-desc {
            min-width: 240px;
        }

        .col-ex {
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 0.82rem;
            color: #10b981;
            word-break: break-all;
        }

        body.light-theme .col-ex {
            color: #047857;
        }

        .col-rel {
            text-align: center;
            font-weight: 700;
            white-space: nowrap;
        }

        .badge-pk {
            background: #ef4444;
            color: #ffffff;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            letter-spacing: 0.5px;
        }

        .badge-fk {
            background: #3b82f6;
            color: #ffffff;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            letter-spacing: 0.5px;
        }

        .badge-none {
            color: var(--text-muted);
        }

        @media print {
            body {
                background: #ffffff !important;
                color: #000000 !important;
                padding: 0 !important;
            }
            .controls, .nav-pills, header .btn {
                display: none !important;
            }
            .table-card {
                border: 1px solid #000000 !important;
                break-inside: avoid;
                margin-bottom: 20px !important;
                box-shadow: none !important;
            }
            .table-banner {
                background: #f1f5f9 !important;
                color: #000000 !important;
                border-bottom: 1px solid #000000 !important;
            }
            .table-name {
                color: #000000 !important;
            }
            th, td {
                border-bottom: 1px solid #cccccc !important;
                color: #000000 !important;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="title-area">
                <h1>DOMIKNOW DATABASE DATA DICTIONARY</h1>
                <p>Standard Capstone / Thesis Specification • Total Active Tables: 46</p>
            </div>
            <div class="controls">
                <input type="text" id="searchInput" class="search-box" placeholder="Search table or column name..." oninput="filterTables()">
                <button class="btn" onclick="toggleTheme()">Theme Toggle</button>
                <button class="btn" onclick="window.print()">Print / Export PDF</button>
            </div>
        </header>

        <div class="nav-pills">
`;

for (let i = 0; i < modules.length; i++) {
  const m = modules[i];
  html += `            <a href="#mod-${i}" class="pill">${m.name}</a>\n`;
}

html += `        </div>\n\n`;

for (let i = 0; i < modules.length; i++) {
  const mod = modules[i];
  html += `        <section id="mod-${i}" class="module-section">\n`;
  html += `            <h2 class="module-title">${mod.name}</h2>\n`;

  for (const tableName of mod.tables) {
    const fields = dict[tableName] || [];
    html += `            <div class="table-card" id="card-${tableName}">\n`;
    html += `                <div class="table-banner">\n`;
    html += `                    <span class="table-name">${tableName}</span>\n`;
    html += `                    <span class="table-meta">${fields.length} Columns</span>\n`;
    html += `                </div>\n`;
    html += `                <div class="table-wrapper">\n`;
    html += `                    <table>\n`;
    html += `                        <thead>\n`;
    html += `                            <tr>\n`;
    html += `                                <th>Field Name</th>\n`;
    html += `                                <th>Data Type</th>\n`;
    html += `                                <th>Data Format</th>\n`;
    html += `                                <th>Field Size</th>\n`;
    html += `                                <th>Description</th>\n`;
    html += `                                <th>Example</th>\n`;
    html += `                                <th>Relationship</th>\n`;
    html += `                            </tr>\n`;
    html += `                        </thead>\n`;
    html += `                        <tbody>\n`;

    for (const f of fields) {
      let relBadge = `<span class="badge-none">-</span>`;
      if (f.relationship === 'PK') {
        relBadge = `<span class="badge-pk">PK</span>`;
      } else if (f.relationship.startsWith('FK')) {
        relBadge = `<span class="badge-fk" title="${f.relationship}">${f.relationship}</span>`;
      }

      html += `                            <tr>\n`;
      html += `                                <td class="col-name">${f.fieldName}</td>\n`;
      html += `                                <td class="col-type">${f.dataType}</td>\n`;
      html += `                                <td class="col-fmt">${f.dataFormat}</td>\n`;
      html += `                                <td class="col-size">${f.fieldSize}</td>\n`;
      html += `                                <td class="col-desc">${f.description}</td>\n`;
      html += `                                <td class="col-ex">${f.example}</td>\n`;
      html += `                                <td class="col-rel">${relBadge}</td>\n`;
      html += `                            </tr>\n`;
    }

    html += `                        </tbody>\n`;
    html += `                    </table>\n`;
    html += `                </div>\n`;
    html += `            </div>\n`;
  }

  html += `        </section>\n\n`;
}

html += `    </div>

    <script>
        function toggleTheme() {
            document.body.classList.toggle('light-theme');
        }

        function filterTables() {
            const query = document.getElementById('searchInput').value.toLowerCase().trim();
            const cards = document.querySelectorAll('.table-card');

            cards.forEach(card => {
                const text = card.textContent.toLowerCase();
                if (!query || text.includes(query)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        }
    </script>
</body>
</html>`;

fs.writeFileSync('../data_dictionary.html', html);
fs.writeFileSync('public/data_dictionary.html', html);
console.log('Generated data_dictionary.html in root and public directory!');
