FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .

# Install python dependencies
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 7860

CMD ["gunicorn", "--bind", "0.0.0.0:7860", "app:app", "--workers", "1", "--timeout", "120"]
