const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');
const axios = require('axios');
require('dotenv').config();
const schedule = require('node-schedule');

const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

// פונקציה ליצירת קוד אפיליאציה ייחודי
function generateAffiliateCode(userId) {
  return `aff${userId}_${Date.now()}`;
}

// שליפת handle של מוצר משופיפיי
async function getProductHandle(productId) {
  const response = await axios.get(
    `https://${SHOPIFY_DOMAIN}/admin/api/2023-07/products/${productId}.json`,
    {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
      },
    }
  );
  return response.data.product.handle;
}

// שליפת נתוני מכירות ועמלות ממוצר בשופיפיי
async function getShopifyStatsForProduct(productId) {
  const response = await axios.get(
    `https://${SHOPIFY_DOMAIN}/admin/api/2023-07/orders.json?status=any&fields=line_items,total_price,financial_status`,
    {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
      },
    }
  );
  let total_sales = 0;
  let commission_pending = 0;
  let commission_approve = 0;
  let commission_paid = 0;
  response.data.orders.forEach(order => {
    order.line_items.forEach(item => {
      if (item.product_id == productId) {
        total_sales += Number(item.quantity);
        if (order.financial_status === 'pending') commission_pending += Number(item.price);
        if (order.financial_status === 'paid') commission_paid += Number(item.price);
        if (order.financial_status === 'authorized') commission_approve += Number(item.price);
      }
    });
  });
  return {
    total_sales,
    commissions: {
      commission_pending,
      commission_approve,
      commission_paid,
    }
  };
}

// פונקציה שמבצעת polling ל-Shopify ומעדכנת מכירות לכל קמפיין
async function updateCampaignSales() {
  try {
    // שלוף את כל הקמפיינים מה-DB
    const campaigns = await prisma.campaign.findMany();
    // שלוף את כל ההזמנות מה-API של Shopify
    const response = await axios.get(
      `https://${process.env.SHOPIFY_DOMAIN}/admin/api/2023-07/orders.json?status=any&fields=id,line_items,note,cart_token,created_at,updated_at,order_number,customer,tags`,
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
        },
      }
    );
    const orders = response.data.orders;
    // עבור כל קמפיין, ספור מכירות לפי ref (למשל, מזהה ייחודי ב-note/tag)
    for (const campaign of campaigns) {
      // נניח שה-ref הוא ה-id של הקמפיין (או כל מזהה שתבחר)
      const ref = campaign.id;
      // ספור הזמנות שבהן ה-note או ה-tags מכילים את ה-ref
      const sales = orders.filter(order => {
        return (order.note && order.note.includes(ref)) ||
               (order.tags && order.tags.includes(ref));
      }).length;
      // עדכן את ה-referrals (או total_sales) ב-DB
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { referrals: sales, total_sales: sales }
      });
    }
    console.log('Campaign sales updated from Shopify!');
  } catch (err) {
    console.error('Error updating campaign sales:', err.message);
  }
}

// הרץ את הפונקציה כל 5 דקות
schedule.scheduleJob('*/5 * * * *', updateCampaignSales);

// פונקציה שמסנכרנת קמפיינים מ-UpPromote
async function syncUpPromoteCampaigns() {
  try {
    const UPPROMOTE_API_KEY = process.env.UPPROMOTE_API_KEY;
    if (!UPPROMOTE_API_KEY) {
      console.log('אין UPPROMOTE_API_KEY, מדלג על סנכרון...');
      return;
    }
    
    const response = await axios.get(
      'https://app.uppromote.com/api/campaigns',
      { headers: { 'Authorization': `Bearer ${UPPROMOTE_API_KEY}` } }
    );
    const campaigns = response.data.campaigns;
    
    for (const campaign of campaigns) {
      // חפש יוזר לפי affiliateId (שזה המזהה הייחודי שלך)
      const user = await prisma.user.findFirst({
        where: { affiliateId: campaign.affiliate_id?.toString() }
      });
      
      if (!user) {
        console.log(`לא נמצא יוזר עם affiliateId: ${campaign.affiliate_id}`);
        continue;
      }
      
      // בדוק אם הקמפיין כבר קיים
      const exists = await prisma.campaign.findFirst({
        where: { affiliateLink: campaign.affiliate_link }
      });
      
      if (!exists) {
        await prisma.campaign.create({
          data: {
            name: campaign.name,
            userId: user.id,
            productId: campaign.product_id,
            affiliateLink: campaign.affiliate_link,
            clicks: campaign.clicks || 0,
            referrals: campaign.sales || 0,
          }
        });
        console.log(`נוסף קמפיין חדש: ${campaign.name} ליוזר ${user.fullName}`);
      }
    }
  } catch (err) {
    console.error('שגיאה בסנכרון קמפיינים:', err.message);
  }
}

// הרץ סנכרון כל 5 דקות
schedule.scheduleJob('*/5 * * * *', syncUpPromoteCampaigns);

// יצירת קמפיין חדש
router.post('/', async (req, res) => {
  const { name, userId, productId } = req.body;
  if (!name || !userId || !productId) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    const productHandle = await getProductHandle(productId);
    const affiliateCode = generateAffiliateCode(userId);
    const affiliateLink = `https://${SHOPIFY_DOMAIN}/products/${productHandle}?ref=${affiliateCode}`;
    const campaign = await prisma.campaign.create({
      data: { name, userId, productId, affiliateLink }
    });
    res.status(201).json({
      id: campaign.id,
      name: campaign.name,
      url: campaign.affiliateLink,
      clicks: campaign.clicks,
      commissions: { commission_pending: 0, commission_approve: 0, commission_paid: 0 },
      referrals: campaign.referrals,
      created_at: campaign.createdAt,
      total_sales: 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// שליפת כל הקמפיינים של יוזר (נתוני דמה בפורמט מדויק)
router.get('/', async (req, res) => {
  const userId = req.query.userId || req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Missing userId' });

  try {
    const campaigns = await prisma.campaign.findMany({ where: { userId } });
    if (campaigns.length === 0) return res.json([]);

    const productIds = campaigns.map(c => c.productId).join(',');
    const response = await axios.get(
      `https://${process.env.SHOPIFY_DOMAIN}/admin/api/2023-07/products.json?ids=${productIds}`,
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
        },
      }
    );
    const products = response.data.products;

    const result = campaigns.map(campaign => {
      const product = products.find(p => p.id.toString() === campaign.productId);
      return {
        id: campaign.id,
        name: campaign.name,
        url: campaign.affiliateLink,
        image: product?.image?.src || null,
        price: product?.variants[0]?.price ? Number(product.variants[0].price) : null,
        currency: product?.variants[0]?.currency || "₪",
        clicks: campaign.clicks,
        referrals: campaign.referrals,
        created_at: campaign.createdAt,
        commissions: {
          commission_pending: 0,
          commission_approve: 0,
          commission_paid: 0
        }
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// עדכון קליק על קמפיין (אופציונלי)
router.post('/:id/click', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.campaign.update({
      where: { id },
      data: { clicks: { increment: 1 } }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Endpoint שמחזיר קמפיינים עם נתוני אמת משופיפיי ו-UpPromote
router.get('/real-data/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const UPPROMOTE_API_KEY = process.env.UPPROMOTE_API_KEY;
    const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
    const SHOPIFY_ADMIN_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    const axios = require('axios');
    const campaigns = await prisma.campaign.findMany({ where: { userId } });

    // נשלוף את כל המוצרים הרלוונטיים במכה אחת
    const productIds = campaigns.map(c => c.productId).join(',');
    const shopifyRes = await axios.get(
      `https://${SHOPIFY_DOMAIN}/admin/api/2023-07/products.json?ids=${productIds}`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
        },
      }
    );
    const products = shopifyRes.data.products;

    // פונקציה שמביאה נתוני אפיליאייט מ-UpPromote (דוגמה בסיסית)
    async function getAffiliateStatsFromUpPromote(campaignId) {
      try {
        const response = await axios.get(
          `https://app.uppromote.com/api/campaigns/${campaignId}/stats`,
          {
            headers: {
              'Authorization': `Bearer ${UPPROMOTE_API_KEY}`
            }
          }
        );
        return response.data;
      } catch (err) {
        return { clicks: 0, sales: 0, commission: 0 };
      }
    }

    // בנה את התשובה
    const result = await Promise.all(campaigns.map(async (campaign) => {
      const product = products.find(p => p.id.toString() === campaign.productId);
      const affiliateStats = await getAffiliateStatsFromUpPromote(campaign.id);
      return {
        id: campaign.id,
        name: campaign.name,
        affiliateLink: campaign.affiliateLink,
        clicks: affiliateStats.clicks ?? campaign.clicks,
        sales: affiliateStats.sales ?? campaign.referrals,
        commission: affiliateStats.commission ?? 0,
        product: {
          name: product?.title || null,
          price: product?.variants?.[0]?.price ? Number(product.variants[0].price) : null,
          imageUrl: product?.image?.src || null,
          description: product?.body_html || null
        },
        createdAt: campaign.createdAt
      };
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch real campaign data', details: err.message });
  }
});

// Endpoint לסנכרון קמפיינים מ-UpPromote לפי שם יוזר
router.post('/sync-uppromote', async (req, res) => {
  try {
    const UPPROMOTE_API_KEY = process.env.UPPROMOTE_API_KEY;
    const axios = require('axios');
    // שלוף את כל הקמפיינים מ-UpPromote
    const response = await axios.get(
      'https://app.uppromote.com/api/campaigns',
      { headers: { 'Authorization': `Bearer ${UPPROMOTE_API_KEY}` } }
    );
    const campaigns = response.data.campaigns;
    let added = 0, skipped = 0;
    for (const campaign of campaigns) {
      // מצא את היוזר שלך לפי שם (fullName)
      const user = await prisma.user.findFirst({
        where: { fullName: campaign.affiliate_name }
      });
      if (!user) {
        skipped++;
        continue;
      }
      // בדוק אם הקמפיין כבר קיים אצלך
      const exists = await prisma.campaign.findFirst({
        where: { affiliateLink: campaign.affiliate_link }
      });
      if (!exists) {
        await prisma.campaign.create({
          data: {
            name: campaign.name,
            userId: user.id,
            productId: campaign.product_id,
            affiliateLink: campaign.affiliate_link,
            clicks: campaign.clicks,
            referrals: campaign.sales,
          }
        });
        added++;
      } else {
        skipped++;
      }
    }
    res.json({ success: true, added, skipped });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync campaigns from UpPromote', details: err.message });
  }
});

// Endpoint לסנכרון אפיליאייטים מ-UpPromote
router.post('/sync-affiliates', async (req, res) => {
  try {
    const UPPROMOTE_API_KEY = process.env.UPPROMOTE_API_KEY;
    if (!UPPROMOTE_API_KEY) {
      return res.status(400).json({ error: 'No UPPROMOTE_API_KEY configured' });
    }
    
    // שלוף את כל האפיליאייטים מ-UpPromote
    const response = await axios.get(
      'https://app.uppromote.com/api/affiliates',
      { headers: { 'Authorization': `Bearer ${UPPROMOTE_API_KEY}` } }
    );
    const affiliates = response.data.affiliates;
    
    let updated = 0;
    let notFound = 0;
    
    for (const affiliate of affiliates) {
      // נסה למצוא יוזר לפי שם
      let user = await prisma.user.findFirst({
        where: { 
          fullName: `${affiliate.first_name} ${affiliate.last_name}`.trim()
        }
      });
      
      // אם לא נמצא לפי שם, נסה לפי אימייל (אם יש שדה email)
      if (!user && affiliate.email) {
        user = await prisma.user.findFirst({
          where: { email: affiliate.email }
        });
      }
      
      if (user) {
        // עדכן את ה-affiliateId
        await prisma.user.update({
          where: { id: user.id },
          data: { affiliateId: affiliate.id.toString() }
        });
        updated++;
        console.log(`עודכן affiliateId ליוזר ${user.fullName}: ${affiliate.id}`);
      } else {
        notFound++;
        console.log(`לא נמצא יוזר עבור אפיליאייט: ${affiliate.first_name} ${affiliate.last_name}`);
      }
    }
    
    res.json({ 
      success: true, 
      updated, 
      notFound, 
      total: affiliates.length 
    });
  } catch (err) {
    console.error('שגיאה בסנכרון אפיליאייטים:', err.message);
    res.status(500).json({ error: 'Failed to sync affiliates', details: err.message });
  }
});

module.exports = router;