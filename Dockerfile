FROM python:3.12-alpine

# Set environment configuration
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8082

# Create secure non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy application code
COPY --chown=appuser:appgroup . /app

# Switch to non-root user
USER appuser

EXPOSE 8082

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/ || exit 1

# Start the zero-dependency server
CMD ["python3", "server.py"]
