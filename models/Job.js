const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  company: {
    type: String,
    required: true,
  },
  location: {
    type: String,
  },
  salary: {
    type: String,
  },
  job_type: {
    type: String,
  },
  skills_required: {
    type: [String],
    default: [],
  },
  description: {
    type: String,
  },
  apply_link: {
    type: String,
  },
  source: {
    type: String,
  },
  experienceLevel: {
    type: String,
  },
  companyLogo: {
    type: String,
  },
  employmentType: {
    type: String,
  },
  deadline: {
    type: String,
  },
  responsibilities: {
    type: [String],
    default: [],
  },
  companyOverview: {
    type: String,
  },
  preferredSkills: {
    type: [String],
    default: [],
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  userStatus: {
    type: String,
    enum: ['New', 'Saved', 'Applied', 'Interview', 'Offer', 'Rejected'],
    default: 'New'
  }
});

// Create a compound index to ensure title + company uniqueness
jobSchema.index({ title: 1, company: 1 }, { unique: true });

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
