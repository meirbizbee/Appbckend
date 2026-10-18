const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const jwt = require("../services/jwt");
const { sendSMS, sendWhatsApp } = require('../services/sms');

// POST /users - Registration
router.post('/', async (req, res) => {
  console.log('req.body:', req.body);
  const { fullName, phoneNumber, countryCode } = req.body;
  if (!fullName || !phoneNumber || !countryCode) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const existing = await prisma.user.findUnique({ where: { phoneNumber } });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Create unique internal identifier for user
    const internalId = `AFF_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // Name with internal identifier for UpPromote use
    const fullNameWithId = `${fullName} (${internalId})`;
    
    // Create personal link for user
    const personalLink = `https://yourdomain.com/affiliate/${internalId}`;
    
    const user = await prisma.user.create({
      data: { 
        fullName, // Original name saved in database
        phoneNumber, 
        countryCode, 
        verificationCode, 
        isVerified: false,
        affiliateId: internalId, // Internal identifier
        personalLink: personalLink // Personal link
      },
    });

    // Send SMS (fake)
    await sendSMS(phoneNumber, verificationCode);

    res.status(201).json({
      message: 'User created successfully',
      userId: user.id,
      affiliateId: internalId, // Identifier for UpPromote use (admin only)
      nextStep: 'Send SMS verification code via /auth/login'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /users - Get all users
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        countryCode: true,
        isVerified: true,
        affiliateId: true,
        personalLink: true,
        createdAt: true,
        _count: {
          select: {
            campaigns: true
          }
        }
      }
    });
    
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /users/me - Get the current user, including the profile image
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const payload = jwt.verifyToken(token);
    if (!payload || !payload.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        countryCode: true,
        isVerified: true,
        affiliateId: true,
        personalLink: true,
        profileImage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /users/me - Save the current user's profile image
router.patch('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const payload = jwt.verifyToken(token);
    if (!payload || !payload.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { profileImage } = req.body;
    const isImage =
      typeof profileImage === 'string' &&
      /^data:image\/(jpeg|jpg|png|webp|heic|heif);base64,/i.test(profileImage);

    if (!isImage) {
      return res.status(400).json({ error: 'Invalid image' });
    }

    if (profileImage.length > 1500000) {
      return res.status(413).json({ error: 'Image is too large' });
    }

    const user = await prisma.user.update({
      where: { id: payload.userId },
      data: { profileImage },
      select: {
        id: true,
        profileImage: true,
      },
    });

    res.json(user);
  } catch (err) {
    console.error(err);
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /users/:id - Get specific user
router.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        campaigns: {
          include: {
            product: true
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint to send WhatsApp message about new campaign
router.post('/whatsapp-campaign', async (req, res) => {
  try {
    const { productName, fullName, phoneNumber, userId } = req.body;

    if (!productName || !fullName || !phoneNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user details if userId exists
    let userInfo = '';
    if (userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { affiliateId: true, personalLink: true }
        });
        if (user) {
          userInfo = `
🆔 Affiliate ID: ${user.affiliateId || 'Not defined'}
🔗 Personal link: ${user.personalLink || 'Not defined'}`;
        }
      } catch (error) {
        console.log('Could not get user details:', error.message);
      }
    }

    // Send WhatsApp message to manager about new campaign request
    const whatsappMessage = `🆕 New campaign request!

👤 User: ${fullName}
📱 Phone: ${phoneNumber}
🛍️ Product: ${productName}
🆔 User ID: ${userId || 'Unknown'}${userInfo}
📅 Date: ${new Date().toLocaleString('he-IL')}

User wants to start a new campaign!`;

    // Send to manager (phone configured in .env)
    const managerPhone = process.env.MANAGER_PHONE || '+972587160468';
    await sendWhatsApp(managerPhone, whatsappMessage);

    res.json({
      success: true,
      message: 'WhatsApp notification sent to manager'
    });

  } catch (err) {
    console.error('Error sending WhatsApp message:', err);
    res.status(500).json({ error: 'Failed to send WhatsApp notification' });
  }
});

// Endpoint to test Callmebot API
router.post('/test-whatsapp', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        error: 'Missing phoneNumber or message',
        example: {
          phoneNumber: '+972587160468',
          message: 'This is a Callmebot API test! 🚀'
        }
      });
    }

    console.log(`🧪 Testing Callmebot API...`);
    console.log(`📱 Phone: ${phoneNumber}`);
    console.log(`📄 Message: ${message}`);

    await sendWhatsApp(phoneNumber, message);

    res.json({
      success: true,
      message: 'WhatsApp test sent successfully',
      sentTo: phoneNumber,
      sentMessage: message
    });

  } catch (err) {
    console.error('Error testing WhatsApp:', err);
    res.status(500).json({ 
      error: 'Failed to send WhatsApp test',
      details: err.message 
    });
  }
});

module.exports = router; 