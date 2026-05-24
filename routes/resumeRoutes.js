const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { protect } = require('../middleware/authMiddleware');
const { uploadResume, getMyResume } = require('../controllers/resumeController');

const router = express.Router();

// ── Multer disk storage ────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB guard
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|doc|docx)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC and DOCX files are allowed.'));
    }
  },
});

// ── Routes ─────────────────────────────────────────────────────────────────────
router.post('/upload', protect, upload.single('resume'), uploadResume);
router.get('/me',      protect, getMyResume);

module.exports = router;
