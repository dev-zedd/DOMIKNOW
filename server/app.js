require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const landlordRoutes = require('./routes/landlordRoutes');
const adminReviewRoutes = require('./routes/adminReviewRoutes');
const tenantAppRoutes = require('./routes/tenantAppRoutes');
const screeningRoutes = require('./routes/screeningRoutes');
const leaseRoutes = require('./routes/leaseRoutes');
const utilityRoutes = require('./routes/utilityRoutes');
const billingRoutes = require('./routes/billingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminMonitorRoutes = require('./routes/adminMonitorRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const storageRoutes = require('./routes/storageRoutes');
const ratingsRoutes = require('./routes/ratingsRoutes');
const propertyRatingRoutes = require('./routes/propertyRatingRoutes');
const landlordRatingRoutes = require('./routes/landlordRatingRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const unitRoutes = require('./routes/unitRoutes');
const policyRoutes = require('./routes/policyRoutes');
const notificationRoutes = require('./routes/notificationRoutes');



const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            mediaSrc: ["'self'", "data:", "blob:", "https:", "https://*.supabase.co"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "https://nominatim.openstreetmap.org", "https://*.tile.openstreetmap.org", "https://api.bigdatacloud.net", "https://geocode.arcgis.com", "https://*.arcgis.com", "https://server.arcgisonline.com", "https://*.basemaps.cartocdn.com", "https://basemaps.cartocdn.com", "https://unpkg.com", "https://*.supabase.co"]
        }
    }
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Compression middleware
app.use(compression());

// Body parsing middleware (Increased limit for Base64 evidence and image uploads)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, '../public')));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/landlord', landlordRoutes);
app.use('/api/admin', adminReviewRoutes);
app.use('/api/tenant/applications', tenantAppRoutes);

// Objective 4 Routing (HTML Client compatible & Validation script compatible mounts)
app.use('/api/screening', screeningRoutes);
app.use('/api/tenant/screening', screeningRoutes);
app.use('/api/landlord/screening', screeningRoutes);

app.use('/api/leases', leaseRoutes);
app.use('/api/landlord/leases', leaseRoutes);
app.use('/api/tenant/leases', leaseRoutes);

app.use('/api/utilities', utilityRoutes);
app.use('/api/landlord/utilities', utilityRoutes);
app.use('/api/tenant/utilities', utilityRoutes);

app.use('/api/billings', billingRoutes);
app.use('/api/landlord/billings', billingRoutes);
app.use('/api/tenant/billings', billingRoutes);

app.use('/api/payments', paymentRoutes);
app.use('/api/tenant/payments', paymentRoutes);
app.use('/api/landlord/payments', paymentRoutes);

app.use('/api/admin/monitor', adminMonitorRoutes);
app.use('/api/admin', adminMonitorRoutes);

// Objective 5 Routing
app.use('/api/policies', policyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', unitRoutes);
app.use('/api', maintenanceRoutes);
app.use('/api', reportRoutes);
app.use('/api', feedbackRoutes);
app.use('/api', ratingsRoutes);
app.use('/api', propertyRatingRoutes);
app.use('/api', landlordRatingRoutes);
app.use('/api', complaintRoutes);
app.use('/api/storage', storageRoutes);


// Favicon route
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Default Route
app.get('/', (req, res) => {
    res.redirect('/pages/auth/login.html');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;
