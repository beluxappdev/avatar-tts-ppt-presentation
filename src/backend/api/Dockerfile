FROM mcr.microsoft.com/devcontainers/python:3.11

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install common package first
COPY ./common/ ./common/
COPY setup.py .
RUN pip install --no-cache-dir -e .

# Copy requirements and install API-specific dependencies
COPY api/requirements.txt ./api/
RUN pip install --no-cache-dir -r api/requirements.txt

# Copy API code
COPY ./api/ ./api/

# Expose port
EXPOSE 8000

# Run the API
CMD ["python", "api/main.py"]