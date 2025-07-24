const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const jwt = require("../services/jwt");
const { sendSMS, sendWhatsApp } = require('../services/sms');

// POST /users - הרשמה
router.post('/', async (req, res) => {
  console.log('req.body:', req.body); // לוג לבדיקת גוף הבקשה
  const { fullName, phoneNumber, countryCode } = req.body;
  if (!fullName || !phoneNumber || !countryCode) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    // בדיקה אם המשתמש כבר קיים
    const existing = await prisma.user.findUnique({ where: { phoneNumber } });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }
    // יצירת קוד אימות
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    // יצירת משתמש
    const user = await prisma.user.create({
      data: { fullName, phoneNumber, countryCode, verificationCode, isVerified: false },
    });
    
    // עדכן את ה-affiliateId להיות המזהה הייחודי של היוזר
    await prisma.user.update({
      where: { id: user.id },
      data: { affiliateId: user.id }
    });

    res.status(201).json({
      message: 'User created successfully',
      userId: user.id,
      affiliateId: user.id, // המזהה לשימוש ב-UpPromote
      nextStep: 'Send SMS verification code via /auth/login'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// / GET /users / me
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token provided" });

    const token = authHeader.split(" ")[1];
    const payload = jwt.verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { fullName: true, phoneNumber: true, countryCode: true }
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Invalid token" });
  }
});

// עדכון Affiliate ID ליוזר
router.put('/:id/affiliate-id', async (req, res) => {
  try {
    const { id } = req.params;
    const { affiliateId } = req.body;
    
    if (!affiliateId) {
      return res.status(400).json({ error: 'Missing affiliateId' });
    }
    
    const user = await prisma.user.update({
      where: { id },
      data: { affiliateId }
    });
    
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        fullName: user.fullName, 
        affiliateId: user.affiliateId 
      } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update affiliate ID' });
  }
});

// Endpoint לשליחת הודעת ווטסאפ על קמפיין חדש
router.post('/whatsapp-campaign', async (req, res) => {
  try {
    const { productName, fullName, phoneNumber, userId } = req.body;

    if (!productName || !fullName || !phoneNumber) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // שליחת הודעת ווטסאפ למנהל על בקשת קמפיין חדש
    const whatsappMessage = `🆕 בקשת קמפיין חדש!

👤 יוזר: ${fullName}
📱 טלפון: ${phoneNumber}
🛍️ מוצר: ${productName}
🆔 User ID: ${userId || 'לא ידוע'}
📅 תאריך: ${new Date().toLocaleString('he-IL')}

היוזר רוצה להתחיל קמפיין חדש!`;

    // שליחה למנהל (הטלפון מוגדר ב-.env)
    const managerPhone = process.env.MANAGER_PHONE || '+972587160468';
    await sendWhatsApp(managerPhone, whatsappMessage);

    res.json({
      success: true,
      message: 'WhatsApp notification sent to manager'
    });

  } catch (err) {
    console.error('שגיאה בשליחת הודעת ווטסאפ:', err);
    res.status(500).json({ error: 'Failed to send WhatsApp notification' });
  }
});

// Endpoint לבדיקת Callmebot API
router.post('/test-whatsapp', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        error: 'Missing phoneNumber or message',
        example: {
          phoneNumber: '+972587160468',
          message: 'זהו בדיקה של Callmebot API! 🚀'
        }
      });
    }

    console.log(`🧪 בדיקת Callmebot API...`);
    console.log(`📱 טלפון: ${phoneNumber}`);
    console.log(`📄 הודעה: ${message}`);

    await sendWhatsApp(phoneNumber, message);

    res.json({
      success: true,
      message: 'WhatsApp test sent successfully',
      sentTo: phoneNumber,
      sentMessage: message
    });

  } catch (err) {
    console.error('שגיאה בבדיקת ווטסאפ:', err);
    res.status(500).json({ 
      error: 'Failed to send WhatsApp test',
      details: err.message 
    });
  }
});

module.exports = router; 