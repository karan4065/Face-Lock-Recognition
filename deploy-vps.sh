#!/bin/bash
# VPS Automated Deployment Script for Face Authentication System
# Usage: ./deploy-vps.sh [yourdomain.com] [your_email@example.com]

set -e

DOMAIN=$1
EMAIL=$2

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "Usage: $0 [domain_name] [ssl_notification_email]"
    echo "Example: $0 example.com admin@example.com"
    exit 1
fi

echo "=============================================="
echo "Starting Production Deployment on VPS for $DOMAIN"
echo "=============================================="

# 1. Update OS & Install Docker / Docker Compose
echo "--> Installing System Dependencies (Docker, Nginx, Certbot)..."
sudo apt-get update -y
sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release nginx certbot python3-certbot-nginx

if ! command -v docker &> /dev/null; then
    echo "--> Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

if ! command -v docker-compose &> /dev/null; then
    echo "--> Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# 2. Configure Environment variables
echo "--> Configuring Production .env..."
JWT_SECRET=$(openssl rand -hex 32)
cat <<EOF > .env
# Production Environment Variables
JWT_SECRET=$JWT_SECRET
FRONTEND_URL=https://$DOMAIN
MONGODB_URI=mongodb+srv://karanjadhav4065_db_user:Rns52u1RJJFcYVlm@cluster0.qvg3uwh.mongodb.net/User?appName=Cluster0
VITE_API_URL=https://api.$DOMAIN/api
EOF

# 3. Build & Run Containers
echo "--> Launching Docker containers..."
sudo docker-compose down || true
sudo docker-compose up -d --build

# 4. Generate SSL Certificates via Let's Encrypt
echo "--> Obtaining SSL Certificates for $DOMAIN and api.$DOMAIN..."
sudo systemctl stop nginx || true
sudo certbot certonly --standalone -d "$DOMAIN" -d "api.$DOMAIN" --non-interactive --agree-tos --email "$EMAIL"

# 5. Configure Nginx Reverse Proxy
echo "--> Configuring Nginx reverse proxy..."
cat <<EOF | sudo tee /etc/nginx/sites-available/face-auth
server {
    listen 80;
    server_name $DOMAIN api.$DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    location / {
        proxy_pass http://localhost:80; # Front container (Nginx)
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 443 ssl;
    server_name api.$DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    location / {
        proxy_pass http://localhost:5000; # Backend container (Express)
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/face-auth /etc/nginx/sites-enabled/default
sudo systemctl restart nginx

echo "=============================================="
echo "Deployment Complete!"
echo "Frontend: https://$DOMAIN"
echo "Backend: https://api.$DOMAIN"
echo "=============================================="
