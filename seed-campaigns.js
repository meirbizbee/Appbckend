const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// נתוני דמה לקמפיינים
const mockCampaigns = [
  {
    name: "iPhone 15 Pro - Gold Campaign",
    productId: "123456789",
    clicks: 245,
    referrals: 18,
    revenue: 45000,
    commission: 2250,
    status: "active"
  },
  {
    name: "MacBook Air M2 - Silver Campaign", 
    productId: "987654321",
    clicks: 189,
    referrals: 12,
    revenue: 36000,
    commission: 1800,
    status: "active"
  },
  {
    name: "AirPods Pro - Bronze Campaign",
    productId: "456789123",
    clicks: 156,
    referrals: 8,
    revenue: 12000,
    commission: 600,
    status: "active"
  },
  {
    name: "iPad Air - Diamond Campaign",
    productId: "789123456",
    clicks: 312,
    referrals: 25,
    revenue: 75000,
    commission: 3750,
    status: "active"
  },
  {
    name: "Apple Watch Series 9 - Platinum Campaign",
    productId: "321654987",
    clicks: 198,
    referrals: 15,
    revenue: 45000,
    commission: 2250,
    status: "active"
  }
];

async function seedCampaigns() {
  try {
    console.log('🌱 מתחיל יצירת קמפיינים עם נתוני דמה...');
    
    // מצא יוזר קיים (או צור אחד אם אין)
    let user = await prisma.user.findFirst();
    
    if (!user) {
      console.log('לא נמצא יוזר, יוצר יוזר חדש...');
      user = await prisma.user.create({
        data: {
          fullName: "John Smith",
          phoneNumber: "+972501234567",
          countryCode: "+972",
          isVerified: true,
          affiliateId: "AFF_MOCK_USER"
        }
      });
      console.log(`✅ נוצר יוזר: ${user.fullName} (${user.id})`);
    } else {
      console.log(`✅ נמצא יוזר: ${user.fullName} (${user.id})`);
    }
    
    // יצירת קמפיינים
    for (const mockCampaign of mockCampaigns) {
      const affiliateCode = `MOCK_${user.id}_${Math.random().toString(36).substr(2, 9)}`;
      const affiliateLink = `https://your-shop.myshopify.com/products/mock-product?ref=${affiliateCode}`;
      
      const campaign = await prisma.campaign.create({
        data: {
          name: mockCampaign.name,
          userId: user.id,
          productId: mockCampaign.productId,
          affiliateLink: affiliateLink,
          clicks: mockCampaign.clicks,
          referrals: mockCampaign.referrals,
          revenue: mockCampaign.revenue,
          commission: mockCampaign.commission,
          status: mockCampaign.status
        }
      });
      
      console.log(`✅ נוצר קמפיין: ${campaign.name}`);
      console.log(`   - קליקים: ${campaign.clicks}`);
      console.log(`   - מכירות: ${campaign.referrals}`);
      console.log(`   - רווחים: ₪${campaign.commission}`);
    }
    
    console.log('🎉 סיימתי יצירת קמפיינים!');
    console.log(`📊 סה"כ נוצרו ${mockCampaigns.length} קמפיינים ליוזר ${user.fullName}`);
    
  } catch (error) {
    console.error('❌ שגיאה ביצירת קמפיינים:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// הרץ את הסקריפט
seedCampaigns(); 