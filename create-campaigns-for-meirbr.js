const { PrismaClient } = require('@prisma/client');
const axios = require('axios');

const prisma = new PrismaClient();

// Shopify Configuration
const SHOPIFY_DOMAIN = 'hhmf10-p1.myshopify.com';
const SHOPIFY_ADMIN_ACCESS_TOKEN = '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';

async function createCampaignsForMeirbr() {
  try {
    console.log('🚀 Creating campaigns for meirbr...\n');

    // 1. Find meirbr user (number 14)
    console.log('1️⃣ Finding meirbr user...');
    const meirbr = await prisma.user.findFirst({
      where: {
        phoneNumber: '+972587160468'
      }
    });

    if (!meirbr) {
      console.log('❌ User meirbr not found');
      return;
    }

    console.log(`✅ Found user: ${meirbr.fullName}`);
    console.log(`📱 Phone: ${meirbr.phoneNumber}`);
    console.log(`🆔 Affiliate ID: ${meirbr.affiliateId || 'None'}`);
    console.log(`🔗 Personal Link: ${meirbr.personalLink || 'None'}`);
    console.log('');

    // 2. Fetch products from Shopify
    console.log('2️⃣ Fetching products from Shopify...');
    const productsResponse = await axios.get(
      `https://${SHOPIFY_DOMAIN}/admin/api/2023-07/products.json`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
        },
      }
    );

    const products = productsResponse.data.products;
    console.log(`✅ Found ${products.length} products`);

    // 3. Create campaigns for each product
    console.log('\n3️⃣ Creating campaigns...');
    let createdCount = 0;
    
    for (const product of products) {
      // Check if campaign already exists for this product and user
      const existingCampaign = await prisma.campaign.findFirst({
        where: {
          userId: meirbr.id,
          productId: product.id.toString()
        }
      });

      if (existingCampaign) {
        console.log(`⏭️ Campaign exists for product: ${product.title}`);
        continue;
      }

      // Create affiliate link
      const affiliateCode = `AFF_${meirbr.id}_${Date.now()}`;
      const affiliateLink = `https://${SHOPIFY_DOMAIN}/products/${product.handle}?ref=${affiliateCode}`;

      // Create campaign
      const campaign = await prisma.campaign.create({
        data: {
          name: `${product.title} - Campaign ${meirbr.fullName}`,
          userId: meirbr.id,
          productId: product.id.toString(),
          affiliateLink: affiliateLink,
          clicks: Math.floor(Math.random() * 100) + 10, // Random data for demo
          referrals: Math.floor(Math.random() * 20) + 1,
          revenue: 0, // Will be updated automatically
          commission: 0, // Will be updated automatically
          status: "active"
        }
      });

      console.log(`✅ Created campaign: ${campaign.name}`);
      console.log(`   🔗 Link: ${affiliateLink}`);
      console.log(`   👁️ Clicks: ${campaign.clicks}`);
      console.log(`   💰 Sales: ${campaign.referrals}`);
      createdCount++;
    }

    // 4. Update data automatically
    console.log('\n4️⃣ Updating data automatically...');

    // Calculate revenue and commissions
    const campaigns = await prisma.campaign.findMany({
      where: { userId: meirbr.id }
    });

    for (const campaign of campaigns) {
      const product = products.find(p => p.id.toString() === campaign.productId);
      if (product) {
        const price = product.variants[0]?.price ? Number(product.variants[0].price) : 0;
        const revenue = campaign.referrals * price;
        const commission = revenue * 0.1; // 10% commission

        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            revenue: revenue,
            commission: commission
          }
        });

        console.log(`💰 Updated campaign: ${campaign.name}`);
        console.log(`   💵 Revenue: €${revenue}`);
        console.log(`   💸 Commission: €${commission}`);
      }
    }

    console.log('\n🎉 Finished creating campaigns for meirbr!');
    console.log(`📊 Total campaigns created: ${createdCount}`);
    console.log(`👤 For user: ${meirbr.fullName}`);

    // 5. Show summary
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
    const totalSales = campaigns.reduce((sum, c) => sum + c.referrals, 0);
    const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue, 0);
    const totalCommission = campaigns.reduce((sum, c) => sum + c.commission, 0);

    console.log('\n📈 Overall Summary for meirbr:');
    console.log(`   👁️ Total clicks: ${totalClicks}`);
    console.log(`   💰 Total sales: ${totalSales}`);
    console.log(`   💵 Total revenue: €${totalRevenue}`);
    console.log(`   💸 Total commission: €${totalCommission}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createCampaignsForMeirbr();