require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const jobRoutes = require('./routes/jobsRoutes');
const { fetchJobs } = require('./services/jobFetcher');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({origin: process.env.FRONTEND_URL || "http://localhost:5173"}));
app.use(express.json());

// Routes
app.use('/api', jobRoutes);

// Connect to DB and Start Server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Start job fetching chron job (runs immediately on start for testing, then every 6 hours)
    fetchJobs();
    const cron = require('node-cron');
    cron.schedule('0 */6 * * *', () => {
      console.log('Running cron job to fetch jobs...');
      fetchJobs();
    });
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB', err);
});
