const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteMeirbrCampaigns() {
  try {
    console.log('🗑️ Deleting all campaigns for meirbr...\n');
    
    // Find meirbr user
    const meirbr = await prisma.user.findFirst({
      where: {
        phoneNumber: '+972587160468'
      }
    });
    
    if (!meirbr) {
      console.log('❌ User meirbr not found');
      return;
    }
    
    console.log(`👤 Found user: ${meirbr.fullName}`);
    console.log(`📱 Phone: ${meirbr.phoneNumber}`);
    console.log('');
    
    // Delete all campaigns for meirbr
    const deletedCampaigns = await prisma.campaign.deleteMany({
      where: {
        userId: meirbr.id
      }
    });
    
    console.log(`✅ Deleted ${deletedCampaigns.count} campaigns for meirbr`);
    console.log('');
    
    // Verify deletion
    const remainingCampaigns = await prisma.campaign.findMany({
      where: {
        userId: meirbr.id
      }
    });
    
    if (remainingCampaigns.length === 0) {
      console.log('✅ All campaigns deleted successfully!');
      console.log('🎯 User meirbr now has 0 campaigns');
    } else {
      console.log(`⚠️ Warning: ${remainingCampaigns.length} campaigns still exist`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

deleteMeirbrCampaigns();