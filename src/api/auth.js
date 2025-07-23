const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { sendSMS } = require('../services/sms');
const { generateToken } = require('../services/jwt');

// POST /auth/login - שליחת קוד SMS למשתמש קיים
router.post('/login', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: 'Missing phoneNumber' });
  try {
    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    // יצירת קוד חדש
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    await prisma.user.update({ where: { phoneNumber }, data: { verificationCode } });
    await sendSMS(phoneNumber, verificationCode);
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
    await prisma.user.update({ where: { phoneNumber }, data: { isVerified: true, verificationCode: null } });
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