FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# A BuildKit cache mount for pip's wheel cache, plus explicit retries and a
# per-read timeout. `--no-cache-dir` with pip's defaults (5 s read timeout,
# effectively no retry on a mid-download stall) turned any slow link into a
# hard build failure:
#   pip._vendor.urllib3.exceptions.ReadTimeoutError:
#     HTTPSConnectionPool(host='files.pythonhosted.org', port=443): Read timed out.
# The cache mount is not part of the image layer, so the image stays as small
# as it was with --no-cache-dir while rebuilds reuse already-downloaded wheels.
RUN --mount=type=cache,id=pip-cache,target=/root/.cache/pip \
    pip install --retries 10 --timeout 120 -r requirements.txt

COPY . .

# Drop privileges. Every other service in the stack runs unprivileged; this one
# stayed root, so a flaw in the AI service would have run as root inside the
# container. The app only needs to read /app.
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

# The port comes from PORT when the platform sets one (Render does), and stays
# 5000 otherwise (Compose). Shell form so the variable is expanded at runtime.
HEALTHCHECK --interval=15s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -f "http://localhost:${PORT:-5000}/health" || exit 1

CMD exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-5000}"
