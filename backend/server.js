require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const connectDB = require('./config/db');

const app = express();

// Trust reverse proxy (e.g. Nginx, Render, Railway, AWS ALB) for correct IP rate-limiting
app.set('trust proxy', 1);

// Connect to Database
connectDB();

// Security Headers
app.use(helmet());

// Gzip Compression
app.use(compression());

// CORS Configuration supporting comma-separated origins
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(origin => origin.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      return callback(null, true);
    } else {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define Routes
app.use('/api/auth', require('./routes/auth'));

// Catch-all/Health route
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'face-auth-backend' });
});

// Centralized Error Handling Middleware (Production-ready)
app.use((err, req, res, next) => {
  console.error(`Unhandled Error: ${err.message}`);
  
  const status = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'An unexpected error occurred on the server.' 
    : err.message;
    
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend server started on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});
