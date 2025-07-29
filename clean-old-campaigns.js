const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanOldCampaigns() {
  try {
    console.log('🧹 Cleaning old fake campaigns...\n');
    
    // Find campaigns with fake data (old campaigns)
    const oldCampaigns = await prisma.campaign.findMany({
      where: {
        OR: [
          { affiliateLink: { contains: 'your-shop.myshopify.com' } },
          { affiliateLink: { contains: 'mock-product' } },
          { name: { contains: 'קמפיין פלטינה' } },
          { name: { contains: 'קמפיין זהב' } },
          { name: { contains: 'קמפיין כסף' } },
          { name: { contains: 'קמפיין ברונזה' } },
          { name: { contains: 'קמפיין יהלום' } }
        ]
      }
    });
    
    console.log(`📊 Found ${oldCampaigns.length} old campaigns to delete\n`);
    
    if (oldCampaigns.length === 0) {
      console.log('✅ No old campaigns found');
      return;
    }
    
    // Show what will be deleted
    oldCampaigns.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.name}`);
      console.log(`   🔗 Link: ${campaign.affiliateLink}`);
      console.log(`   👁️ Clicks: ${campaign.clicks}`);
      console.log(`   💰 Sales: ${campaign.referrals}`);
      console.log('');
    });
    
    // Delete old campaigns
    const deleteResult = await prisma.campaign.deleteMany({
      where: {
        OR: [
          { affiliateLink: { contains: 'your-shop.myshopify.com' } },
          { affiliateLink: { contains: 'mock-product' } },
          { name: { contains: 'קמפיין פלטינה' } },
          { name: { contains: 'קמפיין זהב' } },
          { name: { contains: 'קמפיין כסף' } },
          { name: { contains: 'קמפיין ברונזה' } },
          { name: { contains: 'קמפיין יהלום' } }
        ]
      }
    });
    
    console.log(`✅ Deleted ${deleteResult.count} old campaigns`);
    
    // Show remaining campaigns
    const remainingCampaigns = await prisma.campaign.findMany({
      include: { user: true }
    });
    
    console.log(`\n📊 Remaining campaigns: ${remainingCampaigns.length}`);
    
    remainingCampaigns.forEach((campaign, index) => {
      console.log(`${index + 1}. ${campaign.name}`);
      console.log(`   👤 User: ${campaign.user.fullName}`);
      console.log(`   🔗 Link: ${campaign.affiliateLink}`);
      console.log(`   👁️ Clicks: ${campaign.clicks}`);
      console.log(`   💰 Sales: ${campaign.referrals}`);
      console.log(`   💵 Revenue: €${campaign.revenue}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanOldCampaigns();