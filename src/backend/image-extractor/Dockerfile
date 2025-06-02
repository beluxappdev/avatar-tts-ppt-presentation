FROM mcr.microsoft.com/devcontainers/python:3.11

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libreoffice \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy and install common package first
COPY ./common/ ./common/
COPY setup.py .
RUN pip install --no-cache-dir -e .

# Copy image extractor code
COPY ./image-extractor/ ./image-extractor/

# Run the image extractor
CMD ["python", "image-extractor/main.py"]