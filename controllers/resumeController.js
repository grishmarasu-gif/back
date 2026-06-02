const path    = require('path');
const fs      = require('fs');
const pdfParse = require('pdf-parse');
const mammoth  = require('mammoth');
const Resume   = require('../models/Resume');
const { parseResume } = require('../services/resumeParser');

// ── POST /api/resume/upload ────────────────────────────────────────────────────
async function uploadResume(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const { originalname, mimetype, path: filePath, size } = req.file;
    const ext = path.extname(originalname).toLowerCase();

    // Validate extension
    const allowed = ['.pdf', '.doc', '.docx'];
    if (!allowed.includes(ext)) {
      fs.unlinkSync(filePath); // remove bad file
      return res.status(400).json({ success: false, message: 'Only PDF, DOC and DOCX files are allowed.' });
    }

    // Validate size (5 MB)
    if (size > 5 * 1024 * 1024) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, message: 'File too large. Maximum size is 5 MB.' });
    }

    // ── Extract raw text ──────────────────────────────────────────────────────
    let rawText = '';
    try {
      if (ext === '.pdf') {
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData    = await pdfParse(dataBuffer);
        rawText          = pdfData.text;
      } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        rawText      = result.value;
      } else {
        // .doc — basic fallback (mammoth handles some .doc)
        try {
          const result = await mammoth.extractRawText({ path: filePath });
          rawText      = result.value;
        } catch {
          rawText = ''; // unable to parse old .doc binary
        }
      }
    } catch (parseErr) {
      console.error('Text extraction error:', parseErr.message);
      try { fs.unlinkSync(filePath); } catch (e) {}
      return res.status(500).json({ success: false, message: 'Unable to parse resume' });
    }

    // ── Parse structured fields ───────────────────────────────────────────────
    const parsed = parseResume(rawText);

    // ── Upsert & Replace Resume document (one per user) ───────────────────────
    const userId = req.user._id;
    
    // Strict replacement: new upload completely replaces old data to prevent mixed sample data
    let finalParsed = parsed;

    console.log('[DEBUG UPLOAD] Uploaded Resume ID (New File):', originalname);
    console.log('[DEBUG UPLOAD] Parsed Projects Count:', finalParsed.projects?.length || 0);
    console.log('[DEBUG UPLOAD] Parsed Experience Count:', finalParsed.experience?.length || 0);
    console.log('[DEBUG UPLOAD] Clearing old state and saving strictly new parsed data.');

    const resume = await Resume.findOneAndUpdate(
      { user: userId },
      {
        user: userId,
        fileName: originalname,
        fileType: ext.replace('.', ''),
        filePath,
        rawText,
        parsed: finalParsed,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // ── Link to user model ────────────────────────────────────────────────────
    const User = require('../models/User');
    await User.findByIdAndUpdate(userId, { resume: resume._id });

    return res.status(200).json({
      success: true,
      message: 'Resume uploaded and parsed successfully.',
      resume: {
        id:       resume._id,
        fileName: resume.fileName,
        fileType: resume.fileType,
        parsed:   resume.parsed,
      },
    });
  } catch (err) {
    console.error('Resume upload error:', err);
    return res.status(500).json({ success: false, message: 'Server error during resume upload.' });
  }
}

// ── GET /api/resume/me ────────────────────────────────────────────────────────
async function getMyResume(req, res) {
  try {
    const resume = await Resume.findOne({ user: req.user._id }).select('-rawText -filePath');
    if (!resume) {
      return res.status(404).json({ success: false, message: 'No resume found.' });
    }
    return res.json({ success: true, resume });
  } catch (err) {
    console.error('Get resume error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

// ── POST /api/resume/enhance ───────────────────────────────────────────────────
const { tailorResume } = require('../services/atsEngine');

async function enhanceUserResume(req, res) {
  try {
    const { resume, job, keywordsToInclude = [] } = req.body;
    if (!resume || !job) {
      return res.status(400).json({ success: false, message: 'Resume and job data are required.' });
    }

    console.log('[DEBUG ENHANCE] Tailoring Resume with Local ATS Engine:', {
      sourceOfProjects: resume.projects?.length ? 'Uploaded/User' : 'Empty',
      sourceOfExperience: resume.experience?.length ? 'Uploaded/User' : 'Empty',
      uploadedResumeId: resume.id || 'unknown',
      parsedResumeId: resume.id || 'unknown',
      projectCount: resume.projects?.length || 0,
      experienceCount: resume.experience?.length || 0,
      targetJobTitle: job.title || 'unknown',
      keywordsToInclude
    });

    const enhanced = await tailorResume(resume, job, keywordsToInclude);
    
    // We do NOT save this tailored version to the database to preserve the original parsed data.
    // The tailored data is returned directly to the frontend builder.
    return res.json({ success: true, enhanced });
  } catch (err) {
    console.error('Tailor resume error:', err);
    return res.status(500).json({ success: false, message: 'Server error during ATS tailoring.' });
  }
}

module.exports = { uploadResume, getMyResume, enhanceUserResume };
