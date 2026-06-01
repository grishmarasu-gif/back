const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },   // pdf | docx | doc
  filePath: { type: String, required: true },   // local path
  rawText:  { type: String, default: '' },       // full extracted text

  // Structured parsed fields
  parsed: {
    fullName:         { type: String, default: '' },
    email:            { type: String, default: '' },
    phone:            { type: String, default: '' },
    location:         { type: String, default: '' },
    linkedin:         { type: String, default: '' },
    github:           { type: String, default: '' },
    portfolio:        { type: String, default: '' },
    leetcode:         { type: String, default: '' },
    hackerrank:       { type: String, default: '' },
    summary:          { type: String, default: '' },
    skills:           [{ type: String }],
    softSkills:       [{ type: String }],
    tools:            [{ type: String }],
    frameworks:       [{ type: String }],
    achievements:     [{ type: String }],
    technologies:     [{ type: String }],
    experience:       [{ type: mongoose.Schema.Types.Mixed }],
    projects:         [{ type: mongoose.Schema.Types.Mixed }],
    education:        [{ type: mongoose.Schema.Types.Mixed }],
    certifications:   [{ type: String }],
    languages:        [{ type: String }],
    volunteerExperience: [{ type: mongoose.Schema.Types.Mixed }],
    additionalInformation: [{ type: String }],
    preferredRoles:   [{ type: String }],
    yearsOfExperience: { type: Number, default: 0 },
    experienceLevel:   { type: String, default: '' },
  },
}, { timestamps: true });

module.exports = mongoose.model('Resume', resumeSchema);
