const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { sendSMS, sendWhatsApp } = require('../services/sms');
const { generateToken } = require('../services/jwt');

// POST /auth/login - שליחת קוד SMS למשתמש קיים
router.post('/login', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: 'Missing phoneNumber' });
  
  console.log(`📱 Login request for: ${phoneNumber}`);
  
  try {
    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    console.log(`✅ User found: ${user.fullName}, sending SMS...`);
    
    // יצירת קוד חדש
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    await prisma.user.update({ where: { phoneNumber }, data: { verificationCode } });
    await sendSMS(phoneNumber, verificationCode);
    
    console.log(`✅ SMS sent to: ${phoneNumber}`);
    
    res.json({ message: 'Verification code sent' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /auth/verify/sms - אימות קוד
router.post('/verify/sms', async (req, res) => {
  const { phoneNumber, code } = req.body;
  if (!phoneNumber || !code) return res.status(400).json({ error: 'Missing fields' });
  try {
    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user || user.verificationCode !== code) {
      return res.status(401).json({ error: 'Invalid code' });
    }
    
    // בדיקה אם זה אימות ראשון (יוזר חדש) או יוזר קיים
    const isFirstTimeVerification = !user.isVerified;
    
    // עדכון היוזר לאימות
    await prisma.user.update({ where: { phoneNumber }, data: { isVerified: true, verificationCode: null } });
    
    console.log(`✅ אימות מוצלח ליוזר: ${user.fullName} (${phoneNumber})`);
    
    // שליחת ווטסאפ למנהל רק אם זה יוזר חדש (אימות ראשון)
    if (isFirstTimeVerification) {
      console.log(`🎉 זהו יוזר חדש! שולח ווטסאפ למנהל...`);
      
      const whatsappMessage = `🎉 יוזר חדש נרשם למערכת!

👤 שם: ${user.fullName}
📱 טלפון: ${user.phoneNumber}
🌍 קוד מדינה: ${user.countryCode}
🆔 Affiliate ID: ${user.id}
📅 תאריך: ${new Date().toLocaleString('he-IL')}
✅ אימות: הושלם בהצלחה

השתמש ב-Affiliate ID הזה ב-UpPromote!`;

      console.log(`📱 שולח ווטסאפ למנהל אחרי אימות...`);
      
      // שליחה למנהל (הטלפון מוגדר ב-.env)
      const managerPhone = process.env.MANAGER_PHONE || '+972587160468';
      await sendWhatsApp(managerPhone, whatsappMessage);
      
      console.log(`✅ ווטסאפ נשלח בהצלחה למנהל אחרי אימות`);
    } else {
      console.log(`👤 יוזר קיים מתחבר: ${user.fullName} - לא שולח ווטסאפ`);
    }
    
    const token = generateToken({ userId: user.id, phoneNumber });
    res.json({ token: { access_token: token } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// // GET /users/me - מחזיר את פרטי המשתמש לפי ה-token
// router.get('/me', async (req, res) => {
//   try {
//     const authHeader = req.headers.authorization;
//     if (!authHeader) return res.status(401).json({ error: "No token provided" });

//     const token = authHeader.split(" ")[1];
//     const payload = jwt.verifyToken(token);

//     const user = await prisma.user.findUnique({
//       where: { id: payload.userId },
//       select: { fullName: true, phoneNumber: true, countryCode: true }
//     });

//     if (!user) return res.status(404).json({ error: "User not found" });

//     res.json(user);
//   } catch (err) {
//     console.error(err);
//     res.status(401).json({ error: "Invalid token" });
//   }
// });

module.exports = router; 