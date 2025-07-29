const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listAllUsers() {
  try {
    console.log('👥 Listing all users...\n');
    
    // Get all users with their campaigns count
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: {
            campaigns: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`📊 Found ${users.length} users\n`);
    
    if (users.length === 0) {
      console.log('❌ No users found');
      return;
    }
    
    // Display each user
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.fullName}`);
      console.log(`   📱 Phone: ${user.phoneNumber}`);
      console.log(`   🌍 Country Code: ${user.countryCode}`);
      console.log(`   ✅ Verified: ${user.isVerified ? 'Yes' : 'No'}`);
      console.log(`   🆔 Affiliate ID: ${user.affiliateId || 'None'}`);
      console.log(`   🔗 Personal Link: ${user.personalLink ? 'Yes' : 'No'}`);
      console.log(`   📊 Campaigns: ${user._count.campaigns}`);
      console.log(`   📅 Created: ${user.createdAt.toLocaleDateString()}`);
      console.log('');
    });
    
    // Calculate statistics
    const verifiedUsers = users.filter(u => u.isVerified).length;
    const usersWithAffiliateId = users.filter(u => u.affiliateId).length;
    const usersWithPersonalLink = users.filter(u => u.personalLink).length;
    const totalCampaigns = users.reduce((sum, u) => sum + u._count.campaigns, 0);
    
    console.log('📈 Summary:');
    console.log(`   👥 Total Users: ${users.length}`);
    console.log(`   ✅ Verified Users: ${verifiedUsers}`);
    console.log(`   🆔 Users with Affiliate ID: ${usersWithAffiliateId}`);
    console.log(`   🔗 Users with Personal Link: ${usersWithPersonalLink}`);
    console.log(`   📊 Total Campaigns: ${totalCampaigns}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

listAllUsers();