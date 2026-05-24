const express = require('express');
const router = express.Router();
const jobsController = require('../controllers/jobsController');
router.get('/jobs', jobsController.getJobs);
router.get('/jobs/search', jobsController.searchJobs);
router.get('/stats', jobsController.getStats);
router.get('/jobs/:id', jobsController.getJobById);
router.post('/save-job', jobsController.saveJob);
router.post('/apply-job', jobsController.applyJob);
router.get('/my-jobs', jobsController.getMyJobs);
router.put('/jobs/:id/status', jobsController.updateJobStatus);

module.exports = router;
