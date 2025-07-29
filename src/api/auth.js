const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const { sendSMS, sendWhatsApp } = require('../services/sms');
const { generateToken } = require('../services/jwt');

// POST /auth/login - Send SMS code to existing user
router.post('/login', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: 'Missing phoneNumber' });
  
  console.log(`📱 Login request for: ${phoneNumber}`);
  
  try {
    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    console.log(`✅ User found: ${user.fullName}, sending SMS...`);
    
    // Create new code
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

// POST /auth/verify/sms - Verify SMS code
router.post('/verify/sms', async (req, res) => {
  const { phoneNumber, verificationCode } = req.body;
  if (!phoneNumber || !verificationCode) {
    return res.status(400).json({ error: 'Missing phoneNumber or verificationCode' });
  }
  
  try {
    const user = await prisma.user.findUnique({ where: { phoneNumber } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Check if this is first time verification
    const isFirstTimeVerification = !user.isVerified;
    
    // Mark as verified
    await prisma.user.update({ 
      where: { phoneNumber }, 
      data: { isVerified: true, verificationCode: null } 
    });
    
    // Send WhatsApp to manager only if this is a new user (first verification)
    if (isFirstTimeVerification) {
      console.log(`🎉 This is a new user! Sending WhatsApp to manager...`);
      
      // Create long name with unique identifier
      const fullNameWithId = `${user.fullName} (AFF_${user.id})`;
      
      const whatsappMessage = `🎉 New user registered to the system!

👤 Full name: ${user.fullName}
📝 First name for UpPromote: ${user.fullName}
📝 Last name for UpPromote: (AFF_${user.id})
📱 Phone: ${user.phoneNumber}
🌍 Country code: ${user.countryCode}
🆔 Affiliate ID: ${user.affiliateId || user.id}
🔗 Personal link: ${user.personalLink || 'Not defined'}
📅 Date: ${new Date().toLocaleString('he-IL')}
✅ Verification: Completed successfully

📋 Instructions for UpPromote:
1. Go to UpPromote
2. Create new Affiliate
3. In "First name" field enter: ${user.fullName}
4. In "Last name" field enter: (AFF_${user.id})
5. Leave other fields empty or as needed

🔗 Personal link for internal use: ${user.personalLink || 'Not defined'}

This will enable automatic campaign synchronization!`;

      console.log(`📱 Sending WhatsApp to manager after verification...`);
      
      // Send to manager (phone configured in .env)
      const managerPhone = process.env.MANAGER_PHONE || '+972587160468';
      await sendWhatsApp(managerPhone, whatsappMessage);
      
      console.log(`✅ WhatsApp sent successfully to manager after verification`);
    } else {
      console.log(`👤 Existing user logging in: ${user.fullName} - not sending WhatsApp`);
    }
    
    const token = generateToken({ userId: user.id, phoneNumber });
    res.json({ token: { access_token: token } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 