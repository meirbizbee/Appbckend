const prisma = require('./src/db/prisma');

async function main() {
  // מצא את המשתמש xcxvx
  const user = await prisma.user.findFirst({ where: { fullName: 'breslauer' } });
  if (!user) {
    console.log('User xcxvx not found');
    process.exit(1);
  }

  // צור קמפיינים דמה
  await prisma.campaign.createMany({
    data: [
      {
        name: 'קמפיין דמה 1',
        userId: user.id,
        productId: 'dummy-product-1',
        affiliateLink: 'https://hhmf10-p1.myshopify.com/products/dummy1?ref=aff_xcxvx',
        clicks: 7,
        referrals: 3,
      },
      {
        name: 'קמפיין דמה 2',
        userId: user.id,
        productId: 'dummy-product-2',
        affiliateLink: 'https://hhmf10-p1.myshopify.com/products/dummy2?ref=aff_xcxvx',
        clicks: 2,
        referrals: 1,
      },
    ]
  });

  console.log('Dummy campaigns created!');
  process.exit(0);
}

main(); 