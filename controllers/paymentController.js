const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

const planAmounts = {
  'Basic': 999, // 999 cents = $9.99
  'Pro': 2499, // 2499 cents = $24.99
  'Pro Plus': 3900 // 3900 cents = $39.00
};

const validCoupons = {
  'FREE100': 100,
  'HALF50': 50,
  'SAVE25': 25
};

exports.validateCoupon = async (req, res) => {
  const { coupon } = req.body;
  const upperCoupon = coupon ? coupon.toUpperCase() : '';
  if (!upperCoupon || !validCoupons[upperCoupon]) {
    return res.status(400).json({ success: false, message: 'Invalid Coupon Code' });
  }
  return res.json({ 
    success: true, 
    discount: validCoupons[upperCoupon], 
    message: `Coupon Applied Successfully — ${validCoupons[upperCoupon]}% Discount` 
  });
};

exports.createOrder = async (req, res) => {
  try {
    const { plan, coupon } = req.body;
    const userId = req.user.id;

    if (!plan || !planAmounts[plan]) {
      return res.status(400).json({ success: false, message: 'Invalid plan selected' });
    }

    const originalAmount = planAmounts[plan];
    let finalAmount = originalAmount;
    let discountPercentage = 0;
    let discountAmount = 0;
    const upperCoupon = coupon ? coupon.toUpperCase() : null;
    
    if (upperCoupon) {
      if (validCoupons[upperCoupon]) {
        discountPercentage = validCoupons[upperCoupon];
        discountAmount = originalAmount * (discountPercentage / 100);
        finalAmount = Math.round(originalAmount - discountAmount);
      } else {
        return res.status(400).json({ success: false, message: 'Invalid Coupon Code' });
      }
    }

    if (finalAmount === 0) {
      const now = new Date();
      const subEnd = new Date(now.getTime());
      subEnd.setMonth(subEnd.getMonth() + 1);

      await User.findByIdAndUpdate(userId, {
        plan,
        paymentStatus: 'Completed',
        pricingCompleted: true,
        subscriptionStart: now,
        subscriptionEnd: subEnd,
        appliedCoupon: upperCoupon,
        originalAmount: originalAmount / 100,
        discountPercentage,
        discountAmount: discountAmount / 100,
        finalAmountPaid: 0,
        currency: 'USD'
      });

      await Subscription.create({
        userId,
        activePlan: plan,
        paymentStatus: 'paid',
        subscriptionStatus: 'active',
        purchasedAt: now,
        expiryDate: subEnd,
        currency: 'USD',
        finalAmountPaid: 0,
        appliedCoupon: upperCoupon
      });

      return res.json({
        success: true,
        bypassed: true,
        originalAmount: originalAmount / 100,
        discountAmount: discountAmount / 100,
        finalAmount: 0,
        appliedCoupon: upperCoupon,
        currency: 'USD',
        message: 'Plan activated successfully via 100% free coupon.'
      });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const options = {
      amount: finalAmount,
      currency: 'USD',
      receipt: `rcpt_${Date.now()}`,
      payment_capture: 1
    };

    const order = await razorpay.orders.create(options);

    if (!order) {
      return res.status(500).json({ success: false, message: 'Failed to create Razorpay order' });
    }

    await User.findByIdAndUpdate(userId, {
      plan,
      paymentStatus: 'Pending',
      razorpayOrderId: order.id,
      appliedCoupon: upperCoupon,
      originalAmount: originalAmount / 100,
      discountPercentage,
      discountAmount: discountAmount / 100,
      finalAmountPaid: finalAmount / 100,
      currency: 'USD'
    });

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      originalAmount: originalAmount / 100,
      discountAmount: discountAmount / 100,
      finalAmount: finalAmount / 100,
      appliedCoupon: upperCoupon,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error in createOrder:', error);
    res.status(500).json({ success: false, message: 'Server error creating order' });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;
    
    const userId = req.user.id;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment details' });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      await User.findByIdAndUpdate(userId, { paymentStatus: 'Failed' });
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    const user = await User.findById(userId);
    
    user.paymentStatus = 'Completed';
    user.razorpayPaymentId = razorpay_payment_id;
    user.pricingCompleted = true;
    
    const now = new Date();
    user.subscriptionStart = now;
    const subEnd = new Date(now.getTime());
    subEnd.setMonth(subEnd.getMonth() + 1);
    user.subscriptionEnd = subEnd;

    await user.save();

    await Subscription.create({
      userId,
      activePlan: user.plan,
      paymentStatus: 'paid',
      subscriptionStatus: 'active',
      purchasedAt: now,
      expiryDate: subEnd,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      currency: user.currency || 'USD',
      finalAmountPaid: user.finalAmountPaid,
      appliedCoupon: user.appliedCoupon
    });

    res.json({ success: true, message: 'Payment verified and plan activated' });
  } catch (error) {
    console.error('Error in verifyPayment:', error);
    res.status(500).json({ success: false, message: 'Server error verifying payment' });
  }
};
