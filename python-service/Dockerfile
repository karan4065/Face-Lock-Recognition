FROM python:3.10-slim

WORKDIR /app

# Install system dependencies for OpenCV and other packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5001

CMD ["gunicorn", "--bind", "0.0.0.0:5001", "app:app", "--workers", "1", "--timeout", "120"]
