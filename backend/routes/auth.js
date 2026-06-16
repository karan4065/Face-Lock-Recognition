const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const User = require('../models/User');
const pythonService = require('../services/pythonService');
const auth = require('../middleware/auth');

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB file size limit

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 10, // Limit each IP to 10 attempts
  message: { error: 'Too many login attempts. Please try again after 2 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Helper: Computes Cosine Similarity between two arrays of numbers
 */
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Route: POST /api/auth/register
 * Desc: Register credentials (Name, Email, Password)
 */
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Please enter all fields' });
  }

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    user = new User({ name, email, password });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    await user.save();
    res.json({ message: 'Account credentials created. Proceeding to face capture...', email: user.email });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

/**
 * Route: POST /api/auth/register-face
 * Desc: Upload 5-10 face images to generate and store face embeddings
 */
router.post('/register-face', upload.array('faces', 10), async (req, res) => {
  const { email } = req.body;
  const files = req.files;

  if (!email || !files || files.length === 0) {
    return res.status(400).json({ error: 'Please provide email and webcam face images' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`Processing ${files.length} face images for registration of ${email}...`);
    const embeddings = [];

    for (const file of files) {
      try {
        const embedding = await pythonService.extractEmbedding(file.buffer, file.mimetype);
        if (embedding) {
          embeddings.push(embedding);
        }
      } catch (err) {
        console.warn('Failed to extract embedding for one frame:', err.message);
      }
    }

    if (embeddings.length < 3) {
      return res.status(400).json({ 
        error: `Could only extract ${embeddings.length} clear face profiles. Please try capturing again in better lighting.` 
      });
    }

    user.faceEmbeddings = embeddings;
    await user.save();

    res.json({ message: 'Facial embeddings successfully generated and stored. Registration complete!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during face registration' });
  }
});

/**
 * Route: POST /api/auth/login
 * Desc: Conventional Email/Password login, returns token and trusted status
 */
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password, deviceId } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Please enter all fields' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check if current deviceId is trusted
    const isDeviceTrusted = user.trustedDevices.some(d => d.deviceId === deviceId);

    // Create JWT Token
    const payload = {
      user: {
        id: user.id
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'super_secret_jwt_key_123456',
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({
          token,
          user: { id: user.id, name: user.name, email: user.email },
          isDeviceTrusted
        });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error during login' });
  }
});

/**
 * Route: POST /api/auth/verify-first-login-face
 * Desc: After first login, capture face, compare, and trust device if it matches
 */
router.post('/verify-first-login-face', auth, upload.single('face'), async (req, res) => {
  const { deviceId, userAgent, ip } = req.body;
  const file = req.file;

  if (!file || !deviceId) {
    return res.status(400).json({ error: 'Missing face capture or device identification' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.faceEmbeddings || user.faceEmbeddings.length === 0) {
      return res.status(400).json({ error: 'No enrolled face data found. Please register face first.' });
    }

    // Extract embedding of the fresh face capture
    const freshEmbedding = await pythonService.extractEmbedding(file.buffer, file.mimetype);
    
    // Compare with user's stored embeddings using cosine similarity
    const threshold = 0.85;
    let maxSimilarity = 0;

    for (const storedEmbedding of user.faceEmbeddings) {
      const sim = cosineSimilarity(freshEmbedding, storedEmbedding);
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
      }
    }

    console.log(`First login face verification for ${user.email}. Max similarity score: ${maxSimilarity.toFixed(4)}`);

    if (maxSimilarity >= threshold) {
      // Add device to trusted devices if not already present
      if (!user.trustedDevices.some(d => d.deviceId === deviceId)) {
        user.trustedDevices.push({
          deviceId,
          userAgent: userAgent || 'Unknown browser',
          ip: ip || 'Unknown IP',
          trustedAt: new Date()
        });
        await user.save();
      }

      res.json({ success: true, message: 'Identity verified. Device marked as trusted.', score: maxSimilarity });
    } else {
      res.status(401).json({ success: false, error: 'Face verification failed. Score does not meet security threshold.', score: maxSimilarity });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Face verification server error: ${err.message}` });
  }
});

/**
 * Route: POST /api/auth/login-face
 * Desc: 1-to-N Face login with liveness blink verification. No email/password input.
 */
router.post('/login-face', loginLimiter, upload.array('frames', 6), async (req, res) => {
  const files = req.files;

  if (!files || files.length < 2) {
    return res.status(400).json({ error: 'Blink/Liveness sequence of frames is required' });
  }

  try {
    // 1. Run liveness check
    const buffers = files.map(f => f.buffer);
    const livenessResult = await pythonService.livenessCheck(buffers, files[0].mimetype);

    if (!livenessResult.liveness) {
      return res.status(401).json({ 
        error: 'Liveness detection failed. Please blink your eyes clearly to authenticate.',
        details: livenessResult.details
      });
    }

    console.log('Liveness checks passed. Performing 1-to-N face matching...');

    // 2. Extract embedding from the middle/best frame
    const targetFrameIndex = Math.floor(files.length / 2);
    const targetFrame = files[targetFrameIndex];
    const freshEmbedding = await pythonService.extractEmbedding(targetFrame.buffer, targetFrame.mimetype);

    // 3. Find matching user in database (1-to-N)
    const users = await User.find({ faceLoginEnabled: true, 'faceEmbeddings.0': { $exists: true } });
    const threshold = 0.85;

    let bestMatchUser = null;
    let highestScore = 0;

    for (const user of users) {
      for (const storedEmbedding of user.faceEmbeddings) {
        const score = cosineSimilarity(freshEmbedding, storedEmbedding);
        if (score > highestScore) {
          highestScore = score;
          bestMatchUser = user;
        }
      }
    }

    console.log(`1-to-N Match attempt. Best score: ${highestScore.toFixed(4)} for User: ${bestMatchUser ? bestMatchUser.email : 'None'}`);

    if (bestMatchUser && highestScore >= threshold) {
      // Create JWT token for matched user
      const payload = {
        user: {
          id: bestMatchUser.id
        }
      };

      // Update last login
      bestMatchUser.lastLogin = new Date();
      await bestMatchUser.save();

      jwt.sign(
        payload,
        process.env.JWT_SECRET || 'super_secret_jwt_key_123456',
        { expiresIn: '1h' },
        (err, token) => {
          if (err) throw err;
          res.json({
            token,
            user: { id: bestMatchUser.id, name: bestMatchUser.name, email: bestMatchUser.email },
            score: highestScore,
            authMethod: 'Face Login'
          });
        }
      );
    } else {
      res.status(401).json({ error: 'Face not recognized. Please log in with password.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: `Face login failed: ${err.message}` });
  }
});

/**
 * Route: GET /api/auth/profile
 * Desc: Get current logged-in user profile details (Dashboard)
 */
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error loading profile' });
  }
});

/**
 * Route: PUT /api/auth/update-settings
 * Desc: Toggle face login or update face settings
 */
router.put('/update-settings', auth, async (req, res) => {
  const { faceLoginEnabled, clearFaceData } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (faceLoginEnabled !== undefined) {
      user.faceLoginEnabled = faceLoginEnabled;
    }

    if (clearFaceData) {
      user.faceEmbeddings = [];
      user.faceLoginEnabled = false;
    }

    await user.save();
    res.json({ message: 'Settings updated successfully', user });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error updating settings' });
  }
});

module.exports = router;
