const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  faceEmbeddings: {
    type: [[Number]], // Array of 512-dimensional vector representations
    default: []
  },
  trustedDevices: [
    {
      deviceId: { type: String, required: true },
      userAgent: { type: String, required: true },
      ip: { type: String, required: true },
      trustedAt: { type: Date, default: Date.now }
    }
  ],
  faceLoginEnabled: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);
