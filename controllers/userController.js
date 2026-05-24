const User = require('../models/User');
const Preference = require('../models/Preference');

// @desc    Save or update user preferences
// @route   POST /api/users/preferences
// @access  Private
const savePreferences = async (req, res) => {
  try {
    const userId = req.user.id;
    const prefsData = req.body;

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

    // Update user with preference ID and set onboarding completed
    await User.findByIdAndUpdate(userId, { 
      preferences: preference._id,
      onboardingCompleted: true 
    });

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
