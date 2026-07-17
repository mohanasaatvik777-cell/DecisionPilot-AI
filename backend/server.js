require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
 // force IPv4, fixes querySrv ECONNREFUSED on Windows
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
const insightsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many AI insight requests. Please wait a moment.' }
});
app.use('/api/', apiLimiter);
app.use('/api/insights', insightsLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/analyze', require('./routes/analyze'));
app.use('/api/insights', require('./routes/insights'));
app.use('/api/report', require('./routes/report'));
app.use('/api/ai-query', require('./routes/aiquery'));
app.use('/api/graph-fields', require('./routes/graphfields'));
app.use('/api/chatbot', require('./routes/chatbot'));
app.use('/api/executive', require('./routes/executive'));
app.use('/api/whatif', require('./routes/whatif'));
app.use('/api/decision', require('./routes/decision'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Serve frontend static files — always (dev and production)
const frontendPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));
// SPA fallback — all non-API routes serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

// Connect DB then start
const startServer = async () => {
  try {
    if (process.env.MONGODB_URI) {
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  console.log('✅ MongoDB connected');
}
else {
      console.warn('⚠️ No MONGODB_URI set - running without DB persistence');
    }
    
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

  

