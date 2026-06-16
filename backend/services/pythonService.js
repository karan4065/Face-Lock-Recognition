const axios = require('axios');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

/**
 * Sends a face image buffer to the Python Flask microservice to extract its 512-dim embedding.
 */
const extractEmbedding = async (imageBuffer, mimeType = 'image/jpeg') => {
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: mimeType });
  formData.append('image', blob, 'face.jpg');

  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/extract-embedding`, formData);
    return response.data.embedding;
  } catch (error) {
    const errMsg = error.response?.data?.error || error.message;
    throw new Error(errMsg);
  }
};

/**
 * Compares a fresh embedding against a list of stored embeddings using FaceNet cosine similarity.
 */
const verifyFace = async (embedding, storedEmbeddings, threshold = 0.85) => {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/verify-face`, {
      embedding,
      storedEmbeddings,
      threshold
    });
    return response.data; // { match, score, all_scores }
  } catch (error) {
    const errMsg = error.response?.data?.error || error.message;
    throw new Error(errMsg);
  }
};

/**
 * Sends a sequence of image buffers representing consecutive frames to detect blinks and motion.
 */
const livenessCheck = async (imageBuffers, mimeType = 'image/jpeg') => {
  const formData = new FormData();
  imageBuffers.forEach((buffer, index) => {
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('frames', blob, `frame_${index}.jpg`);
  });

  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/liveness-check`, formData);
    return response.data; // { liveness, details }
  } catch (error) {
    const errMsg = error.response?.data?.error || error.message;
    throw new Error(errMsg);
  }
};

module.exports = {
  extractEmbedding,
  verifyFace,
  livenessCheck
};
