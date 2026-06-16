import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import WebcamCapture from '../components/WebcamCapture';
import { UserPlus, Camera, ArrowRight, ShieldCheck, Lock } from 'lucide-react';

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // Step 1: Credentials, Step 2: Face Enrollment
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [resetWebcam, setResetWebcam] = useState(0);

  const { name, email, password } = formData;

  const onChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmitCredentials = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/register', { name, email, password });
      setSuccess(res.data.message);
      // Advance to face enrollment step
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to register. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  const onFaceCaptureComplete = async (faceBlobs) => {
    setError('');
    setLoading(true);

    try {
      const data = new FormData();
      data.append('email', email);
      faceBlobs.forEach((blob) => {
        data.append('faces', blob, 'face.jpg');
      });

      const res = await api.post('/auth/register-face', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess('Account and face enrollment completed successfully!');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Face registration failed. Please ensure good lighting and try again.');
      // Let the user retry capturing
      setResetWebcam(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-panel">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Create Account</h2>
          <p style={{ fontSize: '0.875rem' }}>
            {step === 1 ? 'Fill in your details to set up credentials' : 'Scan your face to secure your account'}
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <ShieldCheck size={18} />
            <span>{success}</span>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={onSubmitCredentials}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">Full Name</label>
              <input
                className="form-input"
                type="text"
                name="name"
                value={name}
                onChange={onChange}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input
                className="form-input"
                type="email"
                name="email"
                value={email}
                onChange={onChange}
                placeholder="john@example.com"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                className="form-input"
                type="password"
                name="password"
                value={password}
                onChange={onChange}
                placeholder="Min 6 characters"
                minLength="6"
                required
              />
            </div>

            <button className="btn" type="submit" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
              {loading ? 'Registering...' : (
                <>
                  Next: Setup Face ID <ArrowRight size={18} />
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <p style={{ fontSize: '0.875rem' }}>
                Already have an account? <Link to="/login" style={{ color: '#3B82F6', textDecoration: 'none' }}>Log In</Link>
              </p>
            </div>
          </form>
        )}

        {step === 2 && (
          <div>
            <WebcamCapture 
              mode="register" 
              onCaptureComplete={onFaceCaptureComplete} 
              resetTrigger={resetWebcam}
            />
            
            {loading && (
              <p style={{ marginTop: '1rem', color: '#3B82F6', fontWeight: '500' }}>
                Extracting facial vector embeddings... Please wait.
              </p>
            )}

            {!loading && error && (
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setError('');
                  setResetWebcam(prev => prev + 1);
                }} 
                style={{ width: '100%', marginTop: '1rem' }}
              >
                Retry Scan
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;
