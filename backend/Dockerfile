# Use Python 3.11 slim image as base (torch supports 3.11)
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies required for torch and other packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create output directory for generated images
RUN mkdir -p /app/output && chmod 755 /app/output

# Create non-root user for security
RUN useradd -m -u 1001 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port 8080 (Cloud Run default)
EXPOSE 8080

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV OUTPUT_DIR=/app/output

# Health check using built-in urllib (no external deps needed)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/api/health', timeout=5)" || exit 1

# Run the application
# Cloud Run sets PORT env var (defaults to 8080), listen on 0.0.0.0
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
