const express = require('express');
const router = express.Router();
const jobsController = require('../controllers/jobsController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');

router.get('/jobs', optionalAuth, jobsController.getJobs);
router.get('/jobs/search', optionalAuth, jobsController.searchJobs);
router.get('/stats', optionalAuth, jobsController.getStats);
router.get('/jobs/:id', optionalAuth, jobsController.getJobById);
router.post('/save-job', protect, jobsController.saveJob);
router.post('/apply-job', protect, jobsController.applyJob);
router.get('/my-jobs', protect, jobsController.getMyJobs);
router.put('/jobs/:id/status', protect, jobsController.updateJobStatus);

module.exports = router;
