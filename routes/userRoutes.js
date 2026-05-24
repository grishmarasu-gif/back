const express = require('express');
const router = express.Router();
const { savePreferences, completePricing } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.post('/preferences', protect, savePreferences);
router.post('/complete-pricing', protect, completePricing);

module.exports = router;
