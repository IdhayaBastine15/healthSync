# Build context is the repo root (see docker-compose.yml / render.yaml) so
# this Dockerfile can pull in the shared/ folder alongside the service code.
FROM python:3.11-slim AS base

WORKDIR /app

COPY services/analytics-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY services/analytics-service/app ./app
COPY shared ./shared
RUN chmod +x ./shared/entrypoint.sh

EXPOSE 8005

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8005/health')" || exit 1

ENTRYPOINT ["./shared/entrypoint.sh"]
CMD ["8005"]
