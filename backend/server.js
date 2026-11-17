
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();
const auditLogRoutes = require('./routes/auditLogRoutes');
const { startAccountDeletionScheduler } = require('./services/accountDeletionService');
const app = express();

const gameRoutes = require('./routes/gameRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const libraryRoutes = require('./routes/libraryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
// Import API hoàn tiền
const refundRoutes = require('./routes/refundRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Middleware phân tích dữ liệu body (Nâng giới hạn lên 20MB cho phép upload ảnh Base64)
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Kết nối các API
app.use('/api/store', gameRoutes);
app.use('/api/store', categoryRoutes);
app.use('/api/store', reviewRoutes);
app.use('/api/store', authRoutes);
app.use('/api/store', userRoutes);
app.use('/api/store', libraryRoutes);
app.use('/api/store', orderRoutes);
app.use('/api/store', promotionRoutes);
// Kết nối API hoàn tiền
app.use('/api/store', refundRoutes);
app.use('/api/store', notificationRoutes);
app.use('/api/store', auditLogRoutes);
app.get('/api/store/order-test', (req, res) => {
  res.json({
    success: true,
    message: 'ORDER ROUTE TEST ĐANG CHẠY'
  });
});

// Kết nối MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected successfully!");
    startAccountDeletionScheduler();

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log(`Server đang chạy tại http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error.message);
  });

// API kiểm tra
app.get("/", (req, res) => {
  res.json({
    message: "Backend Game Store đang chạy!"
  });
});
