import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';

const videoConstraints = {
  width: 640,
  height: 480,
  facingMode: 'user',
};

// Helper: Converts base64 screenshot data URI to a binary Blob
const dataURItoBlob = (dataURI) => {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
};

const WebcamCapture = ({ mode, onCaptureComplete, resetTrigger }) => {
  const webcamRef = useRef(null);
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Align your face inside the dashed frame');
  const [capturedCount, setCapturedCount] = useState(0);
  const [capturedImages, setCapturedImages] = useState([]);

  // Reset local state when resetTrigger changes
  useEffect(() => {
    setCapturing(false);
    setProgress(0);
    setStatusText('Align your face inside the dashed frame');
    setCapturedCount(0);
    setCapturedImages([]);
  }, [resetTrigger]);

  const captureSingle = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const blob = dataURItoBlob(imageSrc);
        onCaptureComplete([blob]);
      }
    }
  }, [onCaptureComplete]);

  const runRegistrationCapture = async () => {
    setCapturing(true);
    const frames = [];
    const prompts = [
      'Look straight at the camera',
      'Tilt your head slightly left',
      'Tilt your head slightly right',
      'Tilt your head slightly up',
      'Smile or look straight again'
    ];

    for (let i = 0; i < 5; i++) {
      setStatusText(prompts[i]);
      setProgress(((i) / 5) * 100);
      setCapturedCount(i);
      
      // Delay to let the user change angles
      await new Promise((resolve) => setTimeout(resolve, 1200));

      if (webcamRef.current) {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          const blob = dataURItoBlob(imageSrc);
          frames.push(blob);
        }
      }
    }

    setProgress(100);
    setCapturedCount(5);
    setStatusText('Capture complete! Processing...');
    setCapturing(false);
    onCaptureComplete(frames);
  };

  const runLivenessCapture = async () => {
    setCapturing(true);
    setStatusText('Get ready... align your face');
    setProgress(10);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setStatusText('Blink your eyes now! (Capturing...)');
    setProgress(40);

    const frames = [];
    // Capture 6 frames in rapid succession (every 250ms) to catch the blink cycle
    for (let i = 0; i < 6; i++) {
      if (webcamRef.current) {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) {
          frames.push(dataURItoBlob(imageSrc));
        }
      }
      setProgress(40 + (i * 10));
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    setProgress(100);
    setStatusText('Analyzing liveness and matching face...');
    setCapturing(false);
    onCaptureComplete(frames);
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <div className="webcam-container">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div className={`webcam-overlay ${capturing ? 'active' : ''}`}></div>
        <div className="webcam-guide-ring"></div>
      </div>

      <div style={{ minHeight: '24px', margin: '0.5rem 0' }}>
        <p style={{ fontWeight: '500', color: capturing ? '#3B82F6' : '#9CA3AF' }}>
          {statusText}
        </p>
      </div>

      {mode === 'register' && (
        <div style={{ marginTop: '1rem' }}>
          {!capturing && progress === 0 && (
            <button className="btn" onClick={runRegistrationCapture} style={{ width: '100%' }}>
              <Camera size={18} /> Start Face Scanning
            </button>
          )}
          {capturing && (
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
          )}
          {progress === 100 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#10B981', marginTop: '1rem' }}>
              <CheckCircle2 size={18} />
              <span>Captured {capturedCount} angles successfully!</span>
            </div>
          )}
        </div>
      )}

      {mode === 'login' && (
        <div style={{ marginTop: '1rem' }}>
          {!capturing && (
            <button className="btn" onClick={runLivenessCapture} style={{ width: '100%' }}>
              <Camera size={18} /> Scan Face & Verify Liveness
            </button>
          )}
          {capturing && (
            <div className="progress-container">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
          )}
        </div>
      )}

      {mode === 'verify' && (
        <div style={{ marginTop: '1rem' }}>
          <button className="btn" onClick={captureSingle} style={{ width: '100%' }}>
            <Camera size={18} /> Capture Verification Image
          </button>
        </div>
      )}
    </div>
  );
};

export default WebcamCapture;
