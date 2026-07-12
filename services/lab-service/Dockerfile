# Build context is the repo root (see docker-compose.yml / render.yaml) so
# this Dockerfile can pull in the shared/ folder alongside the service code.
FROM python:3.11-slim AS base

WORKDIR /app

COPY services/lab-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/lab-service/app ./app
COPY shared ./shared

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8002/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
