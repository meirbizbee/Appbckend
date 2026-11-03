const express = require('express');
const cors = require('cors');
const prisma = require('./db/prisma');
require('dotenv').config();

async function ensureProfileImageColumn() {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileImage" TEXT',
  );
  console.log('profileImage column is ready');
}

const usersRouter = require('./api/users');
const authRouter = require('./api/auth');
const productsRouter = require('./api/products');
const campaignsRouter = require('./api/campaigns');
const authenticateToken = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use('/users', usersRouter);
app.use('/auth', authRouter);
app.use('/products', productsRouter);
app.use('/campaigns', authenticateToken, campaignsRouter);



const PORT = process.env.PORT || 3001;

ensureProfileImageColumn()
  .catch((error) => {
    console.error('Could not prepare profile image column:', error.message);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }); 