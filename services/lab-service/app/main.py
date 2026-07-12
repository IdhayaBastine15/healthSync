import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from starlette.responses import Response

from app.core.config import get_settings
from app.routers import results

settings = get_settings()

app = FastAPI(title="HealthSync Lab Service", version="1.0.0", docs_url="/docs", openapi_url="/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REQUESTS = Counter("lab_service_requests_total", "Total lab service requests", ["method", "path", "status_code"])
LATENCY = Histogram("lab_service_request_duration_seconds", "Request latency", buckets=[0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0])


@app.middleware("http")
async def observability_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    start = time.perf_counter()
    response = await call_next(request)
    duration = time.perf_counter() - start
    REQUESTS.labels(request.method, request.url.path, response.status_code).inc()
    LATENCY.observe(duration)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}})


@app.get("/health")
async def health():
    return {"status": "ok", "service": "lab-service"}


@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


app.include_router(results.router)
