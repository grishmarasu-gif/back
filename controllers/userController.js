const User = require('../models/User');
const Preference = require('../models/Preference');

// @desc    Save or update user preferences
// @route   POST /api/users/preferences
// @access  Private
const savePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const { securityAnswers, preferredCountry, ...prefsData } = req.body;

    let preference = await Preference.findOne({ userId });

    if (preference) {
      // Update existing
      preference = await Preference.findOneAndUpdate(
        { userId },
        { $set: prefsData },
        { new: true }
      );
    } else {
      // Create new
      preference = await Preference.create({
        userId,
        ...prefsData
      });
    }

    // Evaluate security questions
    let canApplyJobs = true;
    let securityReviewRequired = false;
    let securityQuestionsCompleted = false;
    
    if (securityAnswers) {
      securityQuestionsCompleted = true;
      const answers = Object.values(securityAnswers);
      if (answers.some(val => val === 'Yes' || val === true)) {
        canApplyJobs = false;
        securityReviewRequired = true;
      }
    }

    // Update user with preference ID, security fields, and onboarding completed
    const userUpdate = { 
      preferences: preference._id,
      onboardingCompleted: true 
    };

    if (securityAnswers) {
      userUpdate.securityAnswers = securityAnswers;
      userUpdate.securityQuestionsCompleted = securityQuestionsCompleted;
      userUpdate.canApplyJobs = canApplyJobs;
      userUpdate.securityReviewRequired = securityReviewRequired;
    }
    
    if (preferredCountry) {
      userUpdate.preferredCountry = preferredCountry;
    }

    await User.findByIdAndUpdate(userId, userUpdate);

    // Return the updated user object so frontend state stays in sync
    const updatedUser = await User.findById(userId).select('-password').populate('preferences');

    res.json({
      success: true,
      message: 'Preferences saved successfully',
      user: updatedUser,
      preferences: preference
    });

  } catch (error) {
    console.error('Save Preferences Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error saving preferences' });
  }
};

const completePricing = async (req, res) => {
  try {
    const userId = req.user.id;
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { pricingCompleted: true },
      { new: true }
    ).select('-password').populate('preferences');

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Pricing completed successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Complete Pricing Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error completing pricing' });
  }
};

module.exports = {
  savePreferences,
  completePricing
};
