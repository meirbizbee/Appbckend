/**
 * מחיקת משתמשים מהדאטאבייס כדי לאפשר הרשמה מחדש.
 *
 * שימוש:
 *   node delete-users.js                       # מציג את כל המשתמשים
 *   node delete-users.js +972587160468         # מוחק משתמש לפי מספר טלפון
 *   node delete-users.js 0587160467 0501234567 # מוחק כמה משתמשים
 *   node delete-users.js --all                 # מוחק את כל המשתמשים (זהירות!)
 */
require('dotenv').config();
const prisma = require('./src/db/prisma');
const { findUserByPhone } = require('./src/services/phone');

async function listUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
      countryCode: true,
      isVerified: true,
      createdAt: true,
      _count: { select: { campaigns: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (users.length === 0) {
    console.log('אין משתמשים בדאטאבייס.');
    return;
  }

  console.log(`נמצאו ${users.length} משתמשים:\n`);
  for (const u of users) {
    console.log(
      `- ${u.fullName} | ${u.countryCode}${u.phoneNumber} | verified=${u.isVerified} | campaigns=${u._count.campaigns} | id=${u.id}`
    );
  }
  console.log('\nלמחיקה: node delete-users.js <phoneNumber> [...]');
}

async function deleteByPhone(phoneNumber) {
  const user = await findUserByPhone(prisma, phoneNumber);
  if (!user) {
    console.log(`לא נמצא משתמש עם טלפון: ${phoneNumber}`);
    return false;
  }

  await prisma.$transaction([
    prisma.campaign.deleteMany({ where: { userId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  console.log(`נמחק: ${user.fullName} (${user.countryCode}${user.phoneNumber})`);
  return true;
}

async function deleteAll() {
  const count = await prisma.user.count();
  if (count === 0) {
    console.log('אין משתמשים למחיקה.');
    return;
  }

  await prisma.$transaction([
    prisma.campaign.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);

  console.log(`נמחקו ${count} משתמשים (וכל הקמפיינים שלהם).`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await listUsers();
    return;
  }

  if (args.includes('--all')) {
    await deleteAll();
    return;
  }

  let deleted = 0;
  for (const phone of args) {
    if (await deleteByPhone(phone)) deleted += 1;
  }
  console.log(`\nסה"כ נמחקו: ${deleted}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
