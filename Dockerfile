# Python runtime
FROM python:3.11-slim

# System deps: ffmpeg is required by pydub for audio conversion
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y build-essential
# App folder
WORKDIR /app

# Install Python deps first
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY . .

# Expose port 5000
EXPOSE 5000

# Run the Flask app
CMD ["python","app.py"]