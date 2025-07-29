const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const axios = require('axios');
const schedule = require('node-schedule');
require('dotenv').config();

const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const UPPROMOTE_API_KEY = process.env.UPPROMOTE_API_KEY;

// Function to get real data from Shopify Analytics
async function getShopifyRealData(affiliateCode, startDate = null) {
  try {
    console.log(`📊 Getting real data from Shopify for: ${affiliateCode}`);
    
    // If no start date, use 30 days ago
    if (!startDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startDate = thirtyDaysAgo.toISOString().split('T')[0];
    }
    
    // Get orders from Shopify with affiliate code filter
    const ordersResponse = await axios.get(
      `https://${SHOPIFY_DOMAIN}/admin/api/2023-07/orders.json`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
        },
        params: {
          financial_status: 'paid',
          created_at_min: startDate,
          status: 'any'
        }
      }
    );
    
    const orders = ordersResponse.data.orders;
    console.log(`📦 Got ${orders.length} orders from Shopify`);
    
    // Filter orders by affiliate code
    const affiliateOrders = orders.filter(order => {
      // Check if code appears in URL or tags
      const orderTags = order.tags || '';
      const orderNote = order.note || '';
      const orderAttributes = order.note_attributes || [];
      
      return orderTags.includes(affiliateCode) || 
             orderNote.includes(affiliateCode) ||
             orderAttributes.some(attr => attr.value && attr.value.includes(affiliateCode));
    });
    
    console.log(`🎯 Found ${affiliateOrders.length} orders for affiliate`);
    
    // Calculate data
    let totalRevenue = 0;
    let totalSales = affiliateOrders.length;
    
    affiliateOrders.forEach(order => {
      totalRevenue += parseFloat(order.total_price || 0);
    });
    
    return {
      sales: totalSales,
      revenue: totalRevenue,
      orders: affiliateOrders
    };
    
  } catch (error) {
    console.log(`⚠️ Error getting data from Shopify: ${error.message}`);
    
    // If it's a 403 error, provide helpful message
    if (error.response?.status === 403) {
      console.log(`💡 Shopify Orders API requires read_orders permission`);
      console.log(`💡 Please update your Shopify app permissions or use a Private App`);
    }
    
    return {
      sales: 0,
      revenue: 0,
      orders: []
    };
  }
}

// Function to get real data from UpPromote
async function getUpPromoteRealData(affiliateId) {
  try {
    if (!UPPROMOTE_API_KEY || !affiliateId) {
      console.log(`⚠️ No UpPromote API key or Affiliate ID`);
      return null;
    }
    
    console.log(`📊 Getting real data from UpPromote for: ${affiliateId}`);
    
    const upPromoteResponse = await axios.get(
      `https://api.uppromote.com/v1/affiliates/${affiliateId}/stats`,
      {
        headers: {
          'Authorization': `Bearer ${UPPROMOTE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const stats = upPromoteResponse.data;
    console.log(`✅ Got real data from UpPromote: ${stats.total_clicks || 0} clicks`);
    
    return {
      clicks: stats.total_clicks || 0,
      sales: stats.total_sales || 0,
      revenue: stats.total_revenue || 0,
      commission: stats.total_commission || 0
    };
    
  } catch (error) {
    console.log(`⚠️ Error getting data from UpPromote: ${error.message}`);
    
    // If it's a 404 error, provide helpful message
    if (error.response?.status === 404) {
      console.log(`💡 Affiliate ID ${affiliateId} not found in UpPromote`);
      console.log(`💡 Please register the affiliate in UpPromote first`);
    }
    
    return null;
  }
}

// Function to update real data for affiliate
async function updateAffiliateRealTimeData(userId) {
  try {
    console.log(`🔄 Updating real data for affiliate: ${userId}`);
    
    // Get affiliate and their campaigns
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        campaigns: true
      }
    });
    
    if (!user) {
      console.log(`❌ Affiliate not found: ${userId}`);
      return;
    }
    
    console.log(`👤 Processing affiliate: ${user.fullName} with ${user.campaigns.length} campaigns`);
    
    // Get real data from UpPromote
    const upPromoteData = await getUpPromoteRealData(user.affiliateId);
    
    // Update each campaign
    for (const campaign of user.campaigns) {
      console.log(`📦 Processing campaign: ${campaign.name}`);
      
      // Extract affiliate code from link
      const affiliateCode = campaign.affiliateLink.split('ref=')[1]?.split('&')[0];
      
      // Get real data from Shopify
      const shopifyData = await getShopifyRealData(affiliateCode);
      
      // Get product data from Shopify
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
      } catch (error) {
        console.log(`⚠️ Could not get product data: ${campaign.productId}`);
      }
      
      // Calculate updated data
      const price = productData?.variants?.[0]?.price ? Number(productData.variants[0].price) : 0;
      
      // Use real data if available, otherwise use existing data
      let clicks = campaign.clicks || 0;
      let sales = campaign.referrals || 0;
      let revenue = campaign.revenue || 0;
      
      if (upPromoteData) {
        // Distribute data between campaigns
        clicks = Math.floor(upPromoteData.clicks / user.campaigns.length);
      }
      
      if (shopifyData.sales > 0) {
        sales = shopifyData.sales;
        revenue = shopifyData.revenue;
      } else {
        revenue = sales * price;
      }
      
      const commission = revenue * 0.1; // 10% commission
      
      // Update campaign in database
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          clicks: clicks,
          referrals: sales,
          revenue: revenue,
          commission: commission
        }
      });
      
      console.log(`✅ Updated campaign: ${campaign.name}`);
      console.log(`   👁️ Clicks: ${clicks} (${upPromoteData ? 'Real from UpPromote' : 'Local'})`);
      console.log(`   💰 Sales: ${sales} (${shopifyData.sales > 0 ? 'Real from Shopify' : 'Local'})`);
      console.log(`   💵 Revenue: €${revenue}`);
      console.log(`   💸 Commission: €${commission}`);
    }
    
    console.log(`✅ Finished updating data for affiliate: ${user.fullName}`);
    
  } catch (error) {
    console.error(`❌ Error updating data for affiliate ${userId}:`, error);
  }
}

// Automatic system to update data every 5 minutes
schedule.scheduleJob('*/5 * * * *', async () => {
  console.log('🕐 Updating data automatically for all affiliates...');
  
  try {
    const users = await prisma.user.findMany({
      select: { id: true }
    });
    
    console.log(`📊 Found ${users.length} affiliates to update`);
    
    for (const user of users) {
      await updateAffiliateRealTimeData(user.id);
    }
    
    console.log('✅ Finished automatic update for all affiliates');
  } catch (error) {
    console.error('❌ Error in automatic update:', error);
  }
});

// Fetch data for all affiliates
router.get('/all-affiliates-data', async (req, res) => {
  try {
    console.log('🔄 Fetching data for all affiliates...');
    
    // Get all affiliates (users) from the database
    const users = await prisma.user.findMany({
      include: {
        campaigns: true // Include all campaigns for each affiliate
      }
    });
    
    console.log(`📊 Found ${users.length} affiliates`);
    
    const affiliatesData = [];
    
    for (const user of users) {
      console.log(`👤 Processing affiliate: ${user.fullName}`);
      
      // Fetch sales data for each campaign of the affiliate
      const campaignsData = [];
      let totalClicks = 0;
      let totalSales = 0;
      let totalRevenue = 0;
      let totalCommission = 0;
      
      for (const campaign of user.campaigns) {
        console.log(`📦 Processing campaign: ${campaign.name}`);
        
        // Fetch product data from Shopify
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
        } catch (error) {
          console.log(`⚠️ Could not get product data: ${campaign.productId}`);
        }
        
        // Calculate data
        const clicks = campaign.clicks || 0;
        const sales = campaign.referrals || 0;
        const price = productData?.variants?.[0]?.price ? Number(productData.variants[0].price) : 0;
        const revenue = sales * price;
        const commission = revenue * 0.1; // 10% commission
        
        totalClicks += clicks;
        totalSales += sales;
        totalRevenue += revenue;
        totalCommission += commission;
        
        campaignsData.push({
          id: campaign.id,
          name: campaign.name,
          affiliateLink: campaign.affiliateLink,
          product: {
            id: campaign.productId,
            name: productData?.title || 'Unknown product',
            price: price,
            image: productData?.image?.src || null
          },
          stats: {
            clicks: clicks,
            sales: sales,
            revenue: revenue,
            commission: commission,
            conversionRate: clicks > 0 ? ((sales / clicks) * 100).toFixed(1) + '%' : '0%'
          },
          createdAt: campaign.createdAt
        });
      }
      
      // Create affiliate data object
      const affiliateData = {
        id: user.id,
        name: user.fullName,
        phoneNumber: user.phoneNumber,
        affiliateId: user.affiliateId,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        totalStats: {
          clicks: totalClicks,
          sales: totalSales,
          revenue: totalRevenue,
          commission: totalCommission,
          conversionRate: totalClicks > 0 ? ((totalSales / totalClicks) * 100).toFixed(1) + '%' : '0%'
        },
        campaigns: campaignsData,
        campaignsCount: campaignsData.length
      };
      
      affiliatesData.push(affiliateData);
    }
    
    console.log('✅ Finished fetching data for all affiliates');
    
    res.json({
      success: true,
      totalAffiliates: affiliatesData.length,
      data: affiliatesData
    });
    
  } catch (error) {
    console.error('❌ Error fetching data for affiliates:', error);
    res.status(500).json({ 
      error: 'Error fetching data',
      details: error.message 
    });
  }
});

// Fetch data for a specific affiliate
router.get('/affiliate/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        campaigns: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }
    
    // Fetch data as in the previous function
    const campaignsData = [];
    let totalClicks = 0;
    let totalSales = 0;
    let totalRevenue = 0;
    let totalCommission = 0;
    
    for (const campaign of user.campaigns) {
      // Fetch product data from Shopify
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
      } catch (error) {
        console.log(`⚠️ Could not get product data: ${campaign.productId}`);
      }
      
      const clicks = campaign.clicks || 0;
      const sales = campaign.referrals || 0;
      const price = productData?.variants?.[0]?.price ? Number(productData.variants[0].price) : 0;
      const revenue = sales * price;
      const commission = revenue * 0.1;
      
      totalClicks += clicks;
      totalSales += sales;
      totalRevenue += revenue;
      totalCommission += commission;
      
      campaignsData.push({
        id: campaign.id,
        name: campaign.name,
        affiliateLink: campaign.affiliateLink,
        product: {
          id: campaign.productId,
          name: productData?.title || 'Unknown product',
          price: price,
          image: productData?.image?.src || null
        },
        stats: {
          clicks: clicks,
          sales: sales,
          revenue: revenue,
          commission: commission,
          conversionRate: clicks > 0 ? ((sales / clicks) * 100).toFixed(1) + '%' : '0%'
        },
        createdAt: campaign.createdAt
      });
    }
    
    const affiliateData = {
      id: user.id,
      name: user.fullName,
      phoneNumber: user.phoneNumber,
      affiliateId: user.affiliateId,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      totalStats: {
        clicks: totalClicks,
        sales: totalSales,
        revenue: totalRevenue,
        commission: totalCommission,
        conversionRate: totalClicks > 0 ? ((totalSales / totalClicks) * 100).toFixed(1) + '%' : '0%'
      },
      campaigns: campaignsData,
      campaignsCount: campaignsData.length
    };
    
    res.json({
      success: true,
      data: affiliateData
    });
    
  } catch (error) {
    console.error('❌ Error fetching data for affiliate:', error);
    res.status(500).json({ 
      error: 'Error fetching data',
      details: error.message 
    });
  }
});

// Manual update of data for a specific affiliate
router.post('/update-affiliate-data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔄 Manual update of data for affiliate: ${userId}`);
    
    await updateAffiliateRealTimeData(userId);
    
    res.json({
      success: true,
      message: 'Data updated successfully',
      userId: userId
    });
    
  } catch (error) {
    console.error('❌ Error in manual update:', error);
    res.status(500).json({ 
      error: 'Error updating data',
      details: error.message 
    });
  }
});

// Manual update of data for all affiliates
router.post('/update-all-affiliates-data', async (req, res) => {
  try {
    console.log('🔄 Manual update of data for all affiliates...');
    
    const users = await prisma.user.findMany({
      select: { id: true }
    });
    
    console.log(`📊 Found ${users.length} affiliates to update`);
    
    for (const user of users) {
      await updateAffiliateRealTimeData(user.id);
    }
    
    res.json({
      success: true,
      message: 'Data updated successfully for all affiliates',
      totalAffiliates: users.length
    });
    
  } catch (error) {
    console.error('❌ Error in manual update for all affiliates:', error);
    res.status(500).json({ 
      error: 'Error updating data',
      details: error.message 
    });
  }
});

// Get real-time data for a specific affiliate (with automatic update)
router.get('/realtime-affiliate/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔄 Getting real-time data for affiliate: ${userId}`);
    
    // Update data before returning
    await updateAffiliateRealTimeData(userId);
    
    // Fetch the updated data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        campaigns: true
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }
    
    // Fetch data as in the previous function
    const campaignsData = [];
    let totalClicks = 0;
    let totalSales = 0;
    let totalRevenue = 0;
    let totalCommission = 0;
    
    for (const campaign of user.campaigns) {
      // Fetch product data from Shopify
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
      } catch (error) {
        console.log(`⚠️ Could not get product data: ${campaign.productId}`);
      }
      
      const clicks = campaign.clicks || 0;
      const sales = campaign.referrals || 0;
      const price = productData?.variants?.[0]?.price ? Number(productData.variants[0].price) : 0;
      const revenue = sales * price;
      const commission = revenue * 0.1;
      
      totalClicks += clicks;
      totalSales += sales;
      totalRevenue += revenue;
      totalCommission += commission;
      
      campaignsData.push({
        id: campaign.id,
        name: campaign.name,
        affiliateLink: campaign.affiliateLink,
        product: {
          id: campaign.productId,
          name: productData?.title || 'Unknown product',
          price: price,
          image: productData?.image?.src || null
        },
        stats: {
          clicks: clicks,
          sales: sales,
          revenue: revenue,
          commission: commission,
          conversionRate: clicks > 0 ? ((sales / clicks) * 100).toFixed(1) + '%' : '0%'
        },
        createdAt: campaign.createdAt
      });
    }
    
    const affiliateData = {
      id: user.id,
      name: user.fullName,
      phoneNumber: user.phoneNumber,
      affiliateId: user.affiliateId,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      totalStats: {
        clicks: totalClicks,
        sales: totalSales,
        revenue: totalRevenue,
        commission: totalCommission,
        conversionRate: totalClicks > 0 ? ((totalSales / totalClicks) * 100).toFixed(1) + '%' : '0%'
      },
      campaigns: campaignsData,
      campaignsCount: campaignsData.length
    };
    
    res.json({
      success: true,
      message: 'Real-time data fetched successfully',
      data: affiliateData
    });
    
  } catch (error) {
    console.error('❌ Error fetching real-time data:', error);
    res.status(500).json({ 
      error: 'Error fetching data',
      details: error.message 
    });
  }
});

module.exports = router; 