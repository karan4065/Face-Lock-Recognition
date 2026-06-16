import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { getDeviceId, setSession, clearSession } from '../utils/api';
import WebcamCapture from '../components/WebcamCapture';
import { LogIn, Scan, ShieldAlert, ShieldCheck, HelpCircle } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState('password'); // 'password' or 'face'
  const [step, setStep] = useState('credentials'); // 'credentials' or 'first_login_face'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [tempToken, setTempToken] = useState(''); // Used for first-login face check
  const [tempUser, setTempUser] = useState(null);
  const [resetWebcam, setResetWebcam] = useState(0);

  const { email, password } = formData;

  // Clear session on mounting login page
  useEffect(() => {
    clearSession();
  }, []);

  const onChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  // 1. Password Login Submit
  const onSubmitPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const deviceId = getDeviceId();
      const res = await api.post('/auth/login', { email, password, deviceId });
      
      const { token, user, isDeviceTrusted } = res.data;

      if (isDeviceTrusted) {
        // Device is trusted, log in immediately
        setSession(token, user);
        setSuccess('Login successful! Redirecting...');
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        // Device not trusted, require face verification
        setTempToken(token);
        setTempUser(user);
        // Temporarily store token in localStorage so axios interceptor can pick it up for auth route
        localStorage.setItem('token', token);
        setSuccess('First login on this device detected. Please verify your face to trust this device.');
        setStep('first_login_face');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  // 2. First Login Face Verification Capture Complete
  const onFirstLoginFaceCapture = async (faceBlobs) => {
    setError('');
    setLoading(true);

    try {
      const data = new FormData();
      data.append('face', faceBlobs[0], 'verify.jpg');
      data.append('deviceId', getDeviceId());
      data.append('userAgent', navigator.userAgent);
      data.append('ip', 'Local Client');

      await api.post('/auth/verify-first-login-face', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSession(tempToken, tempUser);
      setSuccess('Identity verified! Device trusted. Redirecting...');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Face verification failed. Please try again under better lighting.');
      setResetWebcam(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  // 3. Face Login (1-to-N Match + Liveness) Capture Complete
  const onFaceLoginCapture = async (frames) => {
    setError('');
    setLoading(true);

    try {
      const data = new FormData();
      frames.forEach((frame) => {
        data.append('frames', frame, 'frame.jpg');
      });

      const res = await api.post('/auth/login-face', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const { token, user } = res.data;
      setSession(token, user);
      setSuccess('Face recognized! Logged in successfully. Redirecting...');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Face not recognized or blink not detected. Try again.');
      setResetWebcam(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="glass-panel">
        {step === 'credentials' && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)', marginBottom: '2rem' }}>
            <button
              onClick={() => { setTab('password'); setError(''); }}
              style={{
                flex: 1,
                padding: '1rem',
                background: 'none',
                border: 'none',
                color: tab === 'password' ? 'white' : 'var(--text-secondary)',
                borderBottom: tab === 'password' ? '2px solid var(--primary)' : 'none',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              Password Login
            </button>
            <button
              onClick={() => { setTab('face'); setError(''); }}
              style={{
                flex: 1,
                padding: '1rem',
                background: 'none',
                border: 'none',
                color: tab === 'face' ? 'white' : 'var(--text-secondary)',
                borderBottom: tab === 'face' ? '2px solid var(--primary)' : 'none',
                cursor: 'pointer',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              <Scan size={16} /> Face ID Login
            </button>
          </div>
        )}

        {step === 'first_login_face' && (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.35rem' }}>Face Verification</h3>
            <p style={{ fontSize: '0.875rem' }}>Look directly at the camera to trust this browser</p>
          </div>
        )}

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

        {step === 'credentials' && tab === 'password' && (
          <form onSubmit={onSubmitPassword}>
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
                placeholder="Enter your password"
                required
              />
            </div>

            <button className="btn" type="submit" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
              {loading ? 'Authenticating...' : (
                <>
                  <LogIn size={18} /> Log In
                </>
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <p style={{ fontSize: '0.875rem' }}>
                Don't have an account? <Link to="/register" style={{ color: '#3B82F6', textDecoration: 'none' }}>Sign Up</Link>
              </p>
            </div>
          </form>
        )}

        {step === 'credentials' && tab === 'face' && (
          <div>
            <WebcamCapture 
              mode="login" 
              onCaptureComplete={onFaceLoginCapture} 
              resetTrigger={resetWebcam}
            />
            {loading && (
              <p style={{ marginTop: '1rem', color: '#3B82F6', fontWeight: '500' }}>
                Analyzing blink patterns & searching matching profiles...
              </p>
            )}
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <p style={{ fontSize: '0.875rem' }}>
                Problems? <button onClick={() => setTab('password')} style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', textDecoration: 'underline' }}>Login with Password</button>
              </p>
            </div>
          </div>
        )}

        {step === 'first_login_face' && (
          <div>
            <WebcamCapture 
              mode="verify" 
              onCaptureComplete={onFirstLoginFaceCapture} 
              resetTrigger={resetWebcam}
            />
            {loading && (
              <p style={{ marginTop: '1rem', color: '#3B82F6', fontWeight: '500' }}>
                Checking facial structure against registry...
              </p>
            )}
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                // Cancel and return to login
                clearSession();
                setStep('credentials');
                setSuccess('');
                setError('');
              }} 
              style={{ width: '100%', marginTop: '1rem' }}
            >
              Cancel Verification
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
