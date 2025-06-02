FROM mcr.microsoft.com/devcontainers/python:3.11

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy and install common package first
COPY ./common/ ./common/
COPY setup.py .
RUN pip install --no-cache-dir -e .

# Copy requirements and install service specific dependencies
COPY video-transformation/requirements.txt ./video-transformation/
RUN pip install --no-cache-dir -r video-transformation/requirements.txt

# Copy video transformation code
COPY ./video-transformation/ ./video-transformation/

# Run the video transformation
CMD ["python", "video-transformation/main.py"]