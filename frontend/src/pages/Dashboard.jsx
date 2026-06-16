import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { clearSession, getCurrentUser, getDeviceId } from '../utils/api';
import WebcamCapture from '../components/WebcamCapture';
import { 
  User, ShieldCheck, ShieldAlert, Monitor, LogOut, 
  Settings, Camera, Calendar, History, Trash2, KeyRound 
} from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [faceUpdateMode, setFaceUpdateMode] = useState(false);
  const [resetWebcam, setResetWebcam] = useState(0);

  const localUser = getCurrentUser();

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get('/auth/profile');
      setProfile(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load user profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleToggleFaceLogin = async () => {
    if (!profile) return;
    setError('');
    setSuccess('');
    const originalSetting = profile.faceLoginEnabled;
    
    // Optimistic UI update
    setProfile({ ...profile, faceLoginEnabled: !originalSetting });

    try {
      await api.put('/auth/update-settings', { faceLoginEnabled: !originalSetting });
      setSuccess(`Face Login ${!originalSetting ? 'enabled' : 'disabled'} successfully.`);
    } catch (err) {
      setProfile({ ...profile, faceLoginEnabled: originalSetting });
      setError(err.response?.data?.error || 'Failed to update settings.');
    }
  };

  const handleClearFaceData = async () => {
    if (!window.confirm('Are you sure you want to clear your registered Face ID data? This will disable Face Login.')) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await api.put('/auth/update-settings', { clearFaceData: true });
      setProfile({ ...profile, faceEmbeddings: [], faceLoginEnabled: false });
      setSuccess('Face ID data cleared successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to clear face data.');
    }
  };

  const handleFaceUpdateComplete = async (faceBlobs) => {
    setError('');
    setLoading(true);

    try {
      const data = new FormData();
      data.append('email', profile.email);
      faceBlobs.forEach((blob) => {
        data.append('faces', blob, 'face.jpg');
      });

      await api.post('/auth/register-face', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccess('Face ID updated successfully!');
      setFaceUpdateMode(false);
      fetchProfile();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update face scans. Please try again.');
      setResetWebcam(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  if (loading && !profile) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#3B82F6', fontSize: '1.25rem', fontWeight: '500' }}>Loading your dashboard...</p>
      </div>
    );
  }

  const currentDeviceId = getDeviceId();

  return (
    <div style={{ flex: 1, padding: '2rem 1rem' }}>
      <header className="navbar" style={{ maxWidth: '1200px', margin: '0 auto 2rem auto', borderRadius: '12px' }}>
        <div className="logo">🛡️ FaceAuth Secure</div>
        <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '0.5rem 1rem' }}>
          <LogOut size={16} /> Log Out
        </button>
      </header>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
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
      </div>

      {profile && (
        <div className="dashboard-grid">
          {/* Sidebar / Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <User size={40} color="white" />
              </div>
              <h3 style={{ marginBottom: '0.25rem' }}>{profile.name}</h3>
              <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>{profile.email}</p>

              <div style={{ width: '100%', borderTop: '1px solid var(--border-glass)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <Calendar size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Joined:</span>
                  <span style={{ marginLeft: 'auto', fontWeight: '500' }}>
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <History size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Last Login:</span>
                  <span style={{ marginLeft: 'auto', fontWeight: '500' }}>
                    {new Date(profile.lastLogin).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  <KeyRound size={16} style={{ color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--text-secondary)' }}>Face Enrolled:</span>
                  <span style={{ 
                    marginLeft: 'auto', 
                    fontWeight: '600', 
                    color: profile.faceEmbeddings?.length > 0 ? '#10B981' : '#EF4444' 
                  }}>
                    {profile.faceEmbeddings?.length > 0 ? 'Enrolled' : 'Not Configured'}
                  </span>
                </div>
              </div>
            </div>

            <div className="dashboard-card">
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', marginBottom: '1rem' }}>
                <Settings size={18} /> Face ID Settings
              </h4>
              
              <div className="switch-container">
                <div>
                  <p style={{ fontWeight: '500', fontSize: '0.9rem' }}>Toggle Face Login</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Quick biometric authentication</p>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={profile.faceLoginEnabled} 
                    onChange={handleToggleFaceLogin}
                    disabled={!profile.faceEmbeddings || profile.faceEmbeddings.length === 0}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button 
                  className="btn" 
                  onClick={() => {
                    setFaceUpdateMode(true);
                    setSuccess('');
                    setError('');
                  }} 
                  style={{ width: '100%', fontSize: '0.9rem' }}
                >
                  <Camera size={16} /> Scan/Update Face ID
                </button>
                
                {profile.faceEmbeddings?.length > 0 && (
                  <button 
                    className="btn btn-secondary btn-danger" 
                    onClick={handleClearFaceData} 
                    style={{ width: '100%', fontSize: '0.9rem', color: '#F87171', background: 'rgba(239, 68, 68, 0.08)' }}
                  >
                    <Trash2 size={16} /> Delete Face Data
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Main Content / Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {faceUpdateMode ? (
              <div className="dashboard-card" style={{ textAlign: 'center' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Recalibrate Face Scanner</h3>
                <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                  <WebcamCapture 
                    mode="register" 
                    onCaptureComplete={handleFaceUpdateComplete}
                    resetTrigger={resetWebcam}
                  />
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => setFaceUpdateMode(false)}
                    style={{ width: '100%', marginTop: '1rem' }}
                  >
                    Cancel Scan
                  </button>
                </div>
              </div>
            ) : (
              <div className="dashboard-card">
                <h3 style={{ marginBottom: '1.5rem' }}>Trusted Devices Registry</h3>
                <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                  The following devices are authorized to bypass secondary face verification when logging in with email and password.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {profile.trustedDevices?.map((device) => {
                    const isCurrent = device.deviceId === currentDeviceId;
                    return (
                      <div 
                        key={device.deviceId} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '1rem', 
                          padding: '1rem', 
                          background: isCurrent ? 'rgba(37, 99, 235, 0.05)' : 'rgba(255, 255, 255, 0.01)', 
                          border: isCurrent ? '1px solid rgba(37, 99, 235, 0.3)' : '1px solid var(--border-glass)', 
                          borderRadius: '12px' 
                        }}
                      >
                        <div style={{ padding: '0.5rem', borderRadius: '8px', background: isCurrent ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)' }}>
                          <Monitor size={20} color="white" />
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                          <p style={{ fontWeight: '500', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {isCurrent && <span style={{ background: '#10B981', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem' }}>Current</span>}
                            {device.userAgent.split(' ')[0]} Browser
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            IP: {device.ip} • Registered: {new Date(device.trustedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  
                  {(!profile.trustedDevices || profile.trustedDevices.length === 0) && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No trusted devices registered yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
