const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
require('dotenv').config();

const prisma = new PrismaClient();

const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

async function updateLocalDataWithRealInfo() {
  try {
    console.log('🔄 Updating local data with real product information...\n');
    
    // Get all campaigns
    const campaigns = await prisma.campaign.findMany({
      include: {
        user: true
      }
    });
    
    console.log(`📊 Found ${campaigns.length} campaigns to update\n`);
    
    for (const campaign of campaigns) {
      console.log(`📦 Processing campaign: ${campaign.name}`);
      console.log(`   👤 User: ${campaign.user.fullName}`);
      console.log(`   🆔 Product ID: ${campaign.productId}`);
      
      // Get real product data from Shopify
      let productData = null;
      try {
        const productResponse = await axios.get(
          `https://${SHOPIFY_DOMAIN}/admin/api/2023-07/products/${campaign.productId}.json`,
          {
            headers: {
              'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
            },
          }
        );
        productData = productResponse.data.product;
        console.log(`   ✅ Got product data: ${productData.title}`);
        console.log(`   💰 Price: €${productData.variants[0]?.price || 'N/A'}`);
        
      } catch (error) {
        console.log(`   ❌ Could not get product data: ${error.message}`);
        continue;
      }
      
      // Calculate real revenue based on product price
      const price = productData?.variants?.[0]?.price ? Number(productData.variants[0].price) : 0;
      const currentSales = campaign.referrals || 0;
      const realRevenue = currentSales * price;
      const realCommission = realRevenue * 0.1; // 10% commission
      
      // Update campaign with real data
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          revenue: realRevenue,
          commission: realCommission
        }
      });
      
      console.log(`   💵 Updated revenue: €${realRevenue}`);
      console.log(`   💸 Updated commission: €${realCommission}`);
      console.log('');
    }
    
    // Show summary
    console.log('📈 Summary of updated campaigns:');
    const updatedCampaigns = await prisma.campaign.findMany({
      include: {
        user: true
      }
    });
    
    let totalRevenue = 0;
    let totalCommission = 0;
    
    updatedCampaigns.forEach(campaign => {
      totalRevenue += campaign.revenue || 0;
      totalCommission += campaign.commission || 0;
    });
    
    console.log(`   💰 Total Revenue: €${totalRevenue}`);
    console.log(`   💸 Total Commission: €${totalCommission}`);
    console.log(`   📊 Total Campaigns: ${updatedCampaigns.length}`);
    
    console.log('\n✅ Local data updated with real product information!');
    console.log('💡 Note: Sales and clicks remain as local data until real tracking is set up');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateLocalDataWithRealInfo();