const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/user.routes');
const exerciseRoutes = require('./routes/exercise.routes');
const memberRoutes = require('./routes/member.routes');
const shareRoutes = require('./routes/share.routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/user', userRoutes);
app.use('/api/exercise', exerciseRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/share', shareRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    code: 500,
    message: 'Internal server error'
  });
});

// 404 handling
app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: 'Not found'
  });
});

module.exports = app;