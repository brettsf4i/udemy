require('dotenv').config();

const express = require('express');
const cors = require('cors');

const healthRouter = require('./routes/health');
const extractRouter = require('./routes/extract');
const exportRouter = require('./routes/export');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/health', healthRouter);
app.use('/api/extract', extractRouter);
app.use('/api/export', exportRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${err.message}`);
  if (err.stack) {
    console.error(err.stack);
  }

  const statusCode = err.statusCode || 500;
  const message = err.expose ? err.message : 'Internal server error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { detail: err.message }),
  });
});

app.listen(PORT, () => {
  console.log(`LaserMap Studio server listening on port ${PORT}`);
});

module.exports = app;
