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

# Change to API directory
WORKDIR /app/api

# Expose the port that the app will run on
EXPOSE 3100

# Command to run the application using Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3100", "--workers", "4"]