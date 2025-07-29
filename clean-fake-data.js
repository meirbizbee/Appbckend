const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
require('dotenv').config();

const prisma = new PrismaClient();
const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

async function cleanFakeData() {
  try {
    console.log('🧹 Cleaning fake data from database...\n');
    
    // 1. Get all campaigns
    const allCampaigns = await prisma.campaign.findMany({
      include: {
        user: true
      }
    });
    
    console.log(`📊 Found ${allCampaigns.length} total campaigns`);
    
    // 2. Reset all fake data to 0
    console.log('\n🔄 Resetting all fake data to 0...');
    
    for (const campaign of allCampaigns) {
      console.log(`📦 Processing: ${campaign.name}`);
      console.log(`   👤 User: ${campaign.user.fullName}`);
      
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
        console.log(`   ✅ Product: ${productData.title} - €${productData.variants[0]?.price || 0}`);
      } catch (error) {
        console.log(`   ❌ Could not get product data: ${error.message}`);
        continue;
      }
      
      // Reset to 0 (real data will come from Shopify orders)
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          clicks: 0,
          referrals: 0,
          revenue: 0,
          commission: 0
        }
      });
      
      console.log(`   🧹 Reset to: 0 clicks, 0 sales, €0 revenue, €0 commission`);
    }
    
    // 3. Check for real orders with affiliate codes
    console.log('\n🔍 Checking for real orders with affiliate codes...');
    
    try {
      const ordersResponse = await axios.get(
        `https://${SHOPIFY_DOMAIN}/admin/api/2023-07/orders.json?limit=50`,
        {
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
          },
        }
      );
      
      const orders = ordersResponse.data.orders;
      console.log(`📦 Found ${orders.length} orders in Shopify`);
      
      // Find orders with affiliate codes
      const ordersWithAffiliateCodes = orders.filter(order => {
        const tags = order.tags || '';
        const note = order.note || '';
        return tags.includes('AFF_') || note.includes('AFF_');
      });
      
      console.log(`🎯 Found ${ordersWithAffiliateCodes.length} orders with affiliate codes`);
      
      if (ordersWithAffiliateCodes.length > 0) {
        console.log('\n📋 Real affiliate orders found:');
        ordersWithAffiliateCodes.forEach(order => {
          console.log(`   Order ${order.id}: €${order.total_price} - Tags: ${order.tags || 'None'}`);
        });
        
        // Update campaigns with real data
        console.log('\n🔄 Updating campaigns with real order data...');
        
        for (const order of ordersWithAffiliateCodes) {
          const orderTags = order.tags || '';
          const orderNote = order.note || '';
          
          // Find matching campaign by affiliate code
          for (const campaign of allCampaigns) {
            const affiliateCode = campaign.affiliateLink.split('ref=')[1]?.split('&')[0];
            
            if (orderTags.includes(affiliateCode) || orderNote.includes(affiliateCode)) {
              console.log(`   🎯 Found match: ${campaign.name} with order ${order.id}`);
              
              // Update campaign with real data
              await prisma.campaign.update({
                where: { id: campaign.id },
                data: {
                  referrals: 1, // This order
                  revenue: parseFloat(order.total_price),
                  commission: parseFloat(order.total_price) * 0.1 // 10% commission
                }
              });
              
              console.log(`   ✅ Updated: €${order.total_price} revenue, €${parseFloat(order.total_price) * 0.1} commission`);
            }
          }
        }
      } else {
        console.log('💡 No real affiliate orders found yet');
        console.log('💡 Create test orders with affiliate codes to see real data');
      }
      
    } catch (error) {
      console.log(`❌ Error checking orders: ${error.message}`);
    }
    
    // 4. Show final status
    console.log('\n📈 Final database status:');
    const finalCampaigns = await prisma.campaign.findMany({
      include: {
        user: true
      }
    });
    
    let totalRevenue = 0;
    let totalCommission = 0;
    let campaignsWithRealData = 0;
    
    finalCampaigns.forEach(campaign => {
      totalRevenue += campaign.revenue || 0;
      totalCommission += campaign.commission || 0;
      if (campaign.revenue > 0) campaignsWithRealData++;
    });
    
    console.log(`   📊 Total campaigns: ${finalCampaigns.length}`);
    console.log(`   🎯 Campaigns with real data: ${campaignsWithRealData}`);
    console.log(`   💰 Total real revenue: €${totalRevenue}`);
    console.log(`   💸 Total real commission: €${totalCommission}`);
    
    console.log('\n✅ Database cleaned! Only real data remains.');
    console.log('🚀 Real-time updates will continue to add real data from Shopify orders');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanFakeData();