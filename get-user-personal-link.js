const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getUserPersonalLink(userId) {
  try {
    console.log(`🔍 מחפש לינק אישי למשתמש: ${userId}`);
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        phoneNumber: true,
        personalLink: true,
        affiliateId: true
      }
    });
    
    if (!user) {
      console.log('❌ משתמש לא נמצא');
      return null;
    }
    
    console.log(`✅ נמצא משתמש: ${user.fullName}`);
    console.log(`🔗 לינק אישי: ${user.personalLink || 'לא מוגדר'}`);
    console.log(`🆔 Affiliate ID: ${user.affiliateId || 'לא מוגדר'}`);
    
    return user;
    
  } catch (error) {
    console.error('❌ שגיאה:', error);
    return null;
  } finally {
    await prisma.$disconnect();
  }
}

// דוגמה לשימוש
// getUserPersonalLink('user-id-here');

module.exports = { getUserPersonalLink }; 