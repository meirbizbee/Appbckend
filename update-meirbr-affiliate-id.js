const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateMeirbrAffiliateId() {
  try {
    console.log('🔧 Updating Affiliate ID for user meirbr...\n');

    // Find meirbr user
    const user = await prisma.user.findFirst({
      where: {
        phoneNumber: '+972587160468'
      }
    });

    if (!user) {
      console.log('❌ User meirbr not found');
      return;
    }

    console.log(`👤 Found user: ${user.fullName} (${user.phoneNumber})`);
    console.log(`🔗 Current Affiliate ID: ${user.affiliateId || 'Not defined'}`);

    // Create new Affiliate ID
    const newAffiliateId = `AFF_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: { affiliateId: newAffiliateId }
    });

    console.log(`✅ Update completed!`);
    console.log(`🆔 New Affiliate ID: ${newAffiliateId}`);
    console.log('\n🎯 Now the user can receive real data from UpPromote!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateMeirbrAffiliateId(); 