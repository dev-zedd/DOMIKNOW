# DOMIKNOW

Cloud-based smart rental property operations platform.

## Features

### Objective 1: Authentication & User Management ✅
This objective includes authentication, email verification, role-based access, role-based dashboards, user profiles, and admin user management.

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account
- SMTP email service (Gmail, SendGrid, etc.)

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "DOMIKNOW 2026"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Copy the example file
   copy .env.example .env
   
   # Edit .env and fill in your actual values
   ```

4. **Set up the database**
   - Go to your Supabase project SQL editor
   - Execute the SQL scripts in order:
     - `database/objective1_tables.sql`
     - `database/objective2_tables.sql`
     - `database/objective3_tables.sql`
     - `database/objective4_tables.sql`
     - `database/objective5_tables.sql`

5. **Create an initial admin user**
   ```bash
   node database/seedAdmin.js
   ```

6. **Start the server**
   ```bash
   # Development mode (with auto-reload)
   npm run dev
   
   # Production mode
   npm start
   ```

7. **Access the application**
   - Open your browser and visit `http://localhost:3000`
   - You'll be redirected to the login page

## Security

⚠️ **IMPORTANT**: Never commit your `.env` file to version control. See `SECURITY_SETUP_GUIDE.md` for detailed security instructions.

## Default Admin Credentials

After running the seed script, you can login with:
- **Email**: admin@domiknow.com
- **Password**: Admin123!

**⚠️ Change these credentials immediately after first login**

## Project Structure

```
DOMIKNOW 2026/
├── server/                  # Backend application
│   ├── controllers/         # Request handlers
│   ├── models/             # Database access layer
│   ├── routes/             # API endpoints
│   ├── middleware/         # Authentication, validation
│   ├── utils/              # Helper functions
│   └── config/             # Configuration files
├── public/                 # Frontend static files
│   ├── pages/              # HTML pages by role
│   ├── js/                 # JavaScript files
│   └── css/                # Stylesheets
├── database/               # Database schema and seeds
└── docs/                   # Documentation

```

## API Endpoints

See `ARCHITECTURAL_AUDIT_REPORT.md` for complete API documentation.

## User Roles

- **Tenant**: Search properties, apply for rentals, manage payments
- **Landlord**: Manage properties, review applications, handle billing
- **Maintenance**: View and update assigned maintenance tasks
- **Admin**: System-wide management and monitoring

## Development

```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Run tests (when implemented)
npm test
```

## Troubleshooting

**Cannot connect to database:**
- Verify your Supabase credentials in `.env`
- Check that your IP is whitelisted in Supabase settings

**Email verification not working:**
- Verify SMTP credentials in `.env`
- Check that "Less secure app access" is enabled (for Gmail)
- Consider using app-specific passwords

**Rate limiting errors:**
- Wait 15 minutes before retrying
- Clear browser cache and cookies

## Documentation

- `ARCHITECTURAL_AUDIT_REPORT.md` - Complete system architecture analysis
- `DEVELOPMENT_CHECKLIST.md` - Development progress tracking
- `SECURITY_SETUP_GUIDE.md` - Security configuration guide

## License

ISC

## Support

For issues and questions, please contact the development team.

