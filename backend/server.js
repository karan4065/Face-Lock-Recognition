require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const app = express();

// Connect to Database
connectDB();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', // React client dev server
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define Routes
app.use('/api/auth', require('./routes/auth'));

// Catch-all route for test purposes
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'face-auth-backend' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend server started on port ${PORT}`);
});
