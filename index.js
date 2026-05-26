require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const jobRoutes = require('./routes/jobsRoutes');
const { fetchJobs } = require('./services/jobFetcher');

const authRoutes   = require('./routes/authRoutes');
const userRoutes   = require('./routes/userRoutes');
const resumeRoutes = require('./routes/resumeRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
   'https://apply4works.com/',
  'http://localhost:5173'
];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.replace(/\/$/, ''));
}

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight OPTIONS requests explicitly
app.use(express.json());
app.use('/uploads', require('express').static(require('path').join(__dirname, 'uploads')));

// Routes
app.use('/api', jobRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/payment', paymentRoutes);


// Connect to DB and Start Server
connectDB().then(async () => {
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    
    const Job = require('./models/Job');
    const mongoose = require('mongoose');
    console.log(`Connected DB (index.js): ${mongoose.connection.name}`);
    
    const jobCount = await Job.countDocuments();
    console.log(`Actual DB jobs: ${jobCount}`);
    if (jobCount === 0) {
      console.log('Database is empty. Triggering initial Apify fetch...');
      fetchJobs();
    } else {
      console.log(`Database already contains ${jobCount} jobs. Skipping initial fetch.`);
    }
    
    const cron = require('node-cron');
    cron.schedule('0 */4 * * *', () => {
      console.log('Running cron job to fetch jobs (every 4 hours)...');
      fetchJobs();
    });
    
    const nextSync = new Date(Date.now() + 4 * 60 * 60 * 1000);
    console.log(`Next scheduled background sync time: ~${nextSync.toLocaleString()}`);
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB', err);
});

// Global 404 JSON Handler
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Global Server Error:', err);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});
