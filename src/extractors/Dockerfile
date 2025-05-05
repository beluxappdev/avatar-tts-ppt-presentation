FROM python:3.11-slim

ARG EXTRACTOR_TYPE

# Install required system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    poppler-utils \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create a command script that will be used at runtime
RUN echo "#!/bin/bash\npython /app/\${EXTRACTOR_TYPE}.py" > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Set the entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]