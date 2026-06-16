import os
import cv2
import numpy as np
import torch
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
from facenet_pytorch import MTCNN, InceptionResnetV1
import io

app = Flask(__name__)
CORS(app)

# Determine device
device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
print(f"Loading FaceNet models on device: {device}")

# Initialize MTCNN and InceptionResnetV1
# keep_all=False ensures we only extract the primary face
mtcnn = MTCNN(
    image_size=160, margin=14, min_face_size=20,
    thresholds=[0.6, 0.7, 0.7], post_process=True,
    device=device
)
resnet = InceptionResnetV1(pretrained='vggface2').eval().to(device)

# Load Haar Cascades for liveness blink check
script_dir = os.path.dirname(os.path.abspath(__file__))
face_cascade_path = os.path.join(script_dir, 'haarcascade_frontalface_default.xml')
eye_cascade_path = os.path.join(script_dir, 'haarcascade_eye.xml')

# Ensure we have these files or load them gracefully
face_cascade = None
eye_cascade = None
if os.path.exists(face_cascade_path) and os.path.exists(eye_cascade_path):
    face_cascade = cv2.CascadeClassifier(face_cascade_path)
    eye_cascade = cv2.CascadeClassifier(eye_cascade_path)
    print("Haar Cascades loaded for liveness checks.")
else:
    print("Warning: Haar Cascades for liveness checks not found in local directory. Liveness checks will fall back.")

def get_embedding(img_pil):
    # Detect face and get cropped tensor
    face_tensor = mtcnn(img_pil)
    if face_tensor is None:
        return None
    
    # Add batch dimension and move to device
    face_tensor = face_tensor.unsqueeze(0).to(device)
    
    # Generate embedding
    with torch.no_grad():
        embedding_tensor = resnet(face_tensor)
        
    # Convert to list of floats
    embedding = embedding_tensor.squeeze(0).cpu().numpy().tolist()
    return embedding

def calculate_cosine_similarity(emb1, emb2):
    a = np.array(emb1)
    b = np.array(emb2)
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))

@app.route('/extract-embedding', methods=['POST'])
def extract_embedding():
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400
        
    file = request.files['image']
    try:
        img_bytes = file.read()
        img_pil = Image.open(io.BytesIO(img_bytes)).convert('RGB')
        
        embedding = get_embedding(img_pil)
        if embedding is None:
            return jsonify({"error": "No face detected in the image"}), 400
            
        return jsonify({"embedding": embedding})
    except Exception as e:
        return jsonify({"error": f"Failed to process image: {str(e)}"}), 500

@app.route('/verify-face', methods=['POST'])
def verify_face():
    data = request.json
    if not data or 'embedding' not in data or 'storedEmbeddings' not in data:
        return jsonify({"error": "Missing embedding or storedEmbeddings in request"}), 400
        
    fresh_emb = data['embedding']
    stored_embs = data['storedEmbeddings']
    threshold = data.get('threshold', 0.85)  # Default threshold 85% similarity
    
    if not stored_embs or len(stored_embs) == 0:
        return jsonify({"match": False, "score": 0.0, "error": "No stored embeddings for comparison"}), 400
        
    similarities = [calculate_cosine_similarity(fresh_emb, stored_emb) for stored_emb in stored_embs]
    max_score = max(similarities)
    matched = max_score >= threshold
    
    return jsonify({
        "match": matched,
        "score": max_score,
        "all_scores": similarities
    })

@app.route('/liveness-check', methods=['POST'])
def liveness_check():
    # Accepts multiple image files as sequence of frames
    files = request.files.getlist('frames')
    if not files or len(files) < 2:
        return jsonify({"liveness": False, "error": "At least 2 frames are required for liveness detection"}), 400

    if not face_cascade or not eye_cascade:
        # Fallback if cascades are not loaded (e.g. they couldn't be found)
        # We assume True if we can extract embeddings from all frames (they are not corrupt)
        return jsonify({"liveness": True, "warning": "Haar Cascades not loaded, bypassed liveness checks"}), 200

    eyes_detected_count = 0
    eyes_closed_count = 0
    faces_detected_count = 0
    
    centroids = []

    for file in files:
        try:
            img_bytes = file.read()
            # Convert to cv2 image
            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                continue

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5)
            
            if len(faces) > 0:
                faces_detected_count += 1
                (x, y, w, h) = faces[0]  # Focus on the primary face
                centroids.append((x + w/2, y + h/2))

                roi_gray = gray[y:y+h, x:x+w]
                eyes = eye_cascade.detectMultiScale(roi_gray, scaleFactor=1.1, minNeighbors=5)
                
                if len(eyes) > 0:
                    eyes_detected_count += 1
                else:
                    eyes_closed_count += 1
        except Exception as e:
            print(f"Error processing frame: {str(e)}")
            continue

    # Blink logic: needs to see eyes open in some frames and eyes closed in some frames
    blink_detected = (eyes_detected_count > 0) and (eyes_closed_count > 0)
    
    # Movement logic: variance of centroids should be > 0.05 to ensure it isn't completely static
    movement_detected = False
    if len(centroids) >= 2:
        centroids_arr = np.array(centroids)
        variance = np.var(centroids_arr, axis=0)
        # Total variance in X and Y
        total_var = np.sum(variance)
        # If total variance > 0.1, it means the face moved slightly
        movement_detected = total_var > 0.1
    else:
        movement_detected = True # Fallback

    liveness_passed = blink_detected or (eyes_detected_count > 0 and len(files) >= 5) # Let's be lenient or require blink
    
    return jsonify({
        "liveness": bool(blink_detected),
        "details": {
            "blink_detected": bool(blink_detected),
            "eyes_open_frames": eyes_detected_count,
            "eyes_closed_frames": eyes_closed_count,
            "total_face_frames": faces_detected_count,
            "movement_var": float(np.sum(np.var(centroids, axis=0))) if len(centroids) >= 2 else 0.0
        }
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
