const express = require('express');
const axios = require('axios');
const router = express.Router();

// הגדר כאן את הפרטים של החנות שלך
const SHOPIFY_DOMAIN = 'hhmf10-p1.myshopify.com'; // החלף לדומיין שלך
const SHOPIFY_ADMIN_ACCESS_TOKEN = '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'; // שמור בסביבה בטוחה!

router.get('/', async (req, res) => {
  try {
    const response = await axios.get(
      `https://${SHOPIFY_DOMAIN}/admin/api/2023-07/products.json`,
      {
        headers: {
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
        },
      }
    );
    const products = response.data.products.map(product => ({
      id: product.id,
      title: product.title,
      price: product.variants[0]?.price ? Number(product.variants[0].price) : 0,
      description: product.body_html,
      imageUrl: product.image?.src || (product.images[0]?.src ?? null),
      body: product.body_html,
      handle: product.handle, // תוכל להשתמש בזה ליצירת קישור אפיליאציה
    }));
    res.json(products);
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).json({ error: 'Shopify fetch error' });
  }
});

async function syncUserCampaignsFromShopify(userId) {
  // שלוף את כל המוצרים של היוזר משופיפיי (בהנחה שיש לך דרך לדעת אילו מוצרים שייכים ליוזר)
  const response = await axios.get(
    `https://${SHOPIFY_DOMAIN}/admin/api/2023-07/products.json?fields=id,title,handle,images,variants`,
    {
      headers: {
        'X-Shopify-Access-Token': SHOPIFY_ADMIN_ACCESS_TOKEN,
      },
    }
  );
  const products = response.data.products;

  for (const product of products) {
    // בדוק אם קיים קמפיין כזה בדאטהבייס
    const existing = await prisma.campaign.findFirst({
      where: { userId, productId: product.id.toString() }
    });
    if (!existing) {
      // צור קמפיין חדש
      await prisma.campaign.create({
        data: {
          name: product.title,
          userId,
          productId: product.id.toString(),
          affiliateLink: `https://${SHOPIFY_DOMAIN}/products/${product.handle}?ref=aff${userId}_${Date.now()}`
        }
      });
    }
  }
}

module.exports = router;