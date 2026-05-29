const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  preferences: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Preference'
  },
  resume: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Resume',
    default: null
  },
  pricingCompleted: {
    type: Boolean,
    default: false
  },
  onboardingCompleted: {
    type: Boolean,
    default: false
  },
  plan: {
    type: String,
    enum: ['Free', 'Basic', 'Pro', 'Pro Plus'],
    default: 'Free'
  },
  planType: {
    type: String,
    enum: ['BASIC', 'PRO'],
    default: 'BASIC'
  },
  securityQuestionsCompleted: {
    type: Boolean,
    default: false
  },
  securityAnswers: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  canApplyJobs: {
    type: Boolean,
    default: true
  },
  securityReviewRequired: {
    type: Boolean,
    default: false
  },
  preferredCountry: {
    type: String,
    default: ''
  },
  autoApplyEnabled: {
    type: Boolean,
    default: false
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending'
  },
  razorpayOrderId: {
    type: String,
    default: null
  },
  razorpayPaymentId: {
    type: String,
    default: null
  },
  subscriptionStart: {
    type: Date,
    default: null
  },
  subscriptionEnd: {
    type: Date,
    default: null
  },
  appliedCoupon: {
    type: String,
    default: null
  },
  originalAmount: {
    type: Number,
    default: null
  },
  discountPercentage: {
    type: Number,
    default: null
  },
  discountAmount: {
    type: Number,
    default: null
  },
  finalAmountPaid: {
    type: Number,
    default: null
  },
  currency: {
    type: String,
    default: 'USD'
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
