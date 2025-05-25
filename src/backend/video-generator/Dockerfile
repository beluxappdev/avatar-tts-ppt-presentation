FROM mcr.microsoft.com/devcontainers/python:3.11

WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && rm -rf /var/lib/apt/lists/*

# Copy and install common package first
COPY ./common/ ./common/
COPY setup.py .
RUN pip install --no-cache-dir -e .

# Copy video generator code
COPY ./video-generator/ ./video-generator/

# Run the video genrator
CMD ["python", "video-generator/main.py"]