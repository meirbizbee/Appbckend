const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const jwt = require("../services/jwt");
const { sendSMS } = require('../services/sms');

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
    // שליחת SMS (פייק)
    await sendSMS(phoneNumber, verificationCode);
    res.status(201).json({ message: 'User created, verification code sent' });
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

// DELETE /users - מחיקת משתמש לפי מספר טלפון (כולל קמפיינים) כדי לאפשר הרשמה מחדש
router.delete('/', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Missing phoneNumber' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await prisma.$transaction([
      prisma.campaign.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    res.json({ message: 'User deleted', phoneNumber });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


module.exports = router; 