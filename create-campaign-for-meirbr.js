const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function createCampaignForMeirbr() {
  try {
    console.log('🚀 Creating campaign for meirbr via API...\n');
    
    // 1. Get products from Shopify
    console.log('1️⃣ Getting products from Shopify...');
    const productsResponse = await axios.get(`${BASE_URL}/products`);
    const products = productsResponse.data;
    
    if (products.length === 0) {
      console.log('❌ No products found');
      return;
    }
    
    const selectedProduct = products[0]; // Argan Biotin Hair Serum
    console.log(`✅ Selected product: ${selectedProduct.title} (ID: ${selectedProduct.id})`);
    
    // 2. Get meirbr user ID
    console.log('\n2️⃣ Getting meirbr user...');
    const meirbrUserId = '274a0711-4b25-4659-86ce-2cc3d8f9e3f1'; // meirbr's UUID
    
    // 3. Create campaign
    console.log('\n3️⃣ Creating campaign...');
    const campaignData = {
      userId: meirbrUserId,
      productId: selectedProduct.id,
      campaignName: `${selectedProduct.title} - Campaign meirbr`
    };
    
    console.log('📋 Campaign data:');
    console.log(`   👤 User ID: ${campaignData.userId}`);
    console.log(`   🛍️ Product ID: ${campaignData.productId}`);
    console.log(`   📦 Campaign Name: ${campaignData.campaignName}`);
    
    // 4. Send WhatsApp notification
    console.log('\n4️⃣ Sending WhatsApp notification...');
    const whatsappData = {
      productName: selectedProduct.title,
      fullName: 'meirbr',
      phoneNumber: '+972587160468',
      userId: meirbrUserId
    };
    
    const whatsappResponse = await axios.post(`${BASE_URL}/users/whatsapp-campaign`, whatsappData);
    console.log('✅ WhatsApp notification sent!');
    
    // 5. Create campaign via API
    console.log('\n5️⃣ Creating campaign via API...');
    const campaignResponse = await axios.post(`${BASE_URL}/campaigns/with-personal-link`, campaignData);
    
    console.log('✅ Campaign created successfully!');
    console.log(`   📦 Campaign Name: ${campaignResponse.data.campaign.name}`);
    console.log(`   🔗 Affiliate Link: ${campaignResponse.data.campaign.affiliateLink}`);
    console.log(`   👤 User: ${campaignResponse.data.campaign.user.fullName}`);
    console.log(`   🛍️ Product: ${campaignResponse.data.campaign.product.title}`);
    console.log(`   💰 Price: €${campaignResponse.data.campaign.product.price}`);
    
    console.log('\n🎯 Campaign created successfully!');
    console.log('📱 WhatsApp notification sent to manager');
    console.log('🔗 Affiliate link ready for use');
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

createCampaignForMeirbr();