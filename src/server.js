const express = require('express');
const cors = require('cors');
require('dotenv').config();

const usersRouter = require('./api/users');
const authRouter = require('./api/auth');
const productsRouter = require('./api/products');
const campaignsRouter = require('./api/campaigns');
const affiliatesRouter = require('./api/affiliates');
const authenticateToken = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use('/users', usersRouter);
app.use('/auth', authRouter);
app.use('/products', productsRouter);
app.use('/campaigns', authenticateToken, campaignsRouter);
app.use('/affiliates', authenticateToken, affiliatesRouter);



const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 