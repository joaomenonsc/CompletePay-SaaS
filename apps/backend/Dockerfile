FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY apps/backend/pyproject.toml ./pyproject.toml
COPY apps/backend/src ./src

RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir .


FROM python:3.12-slim AS runtime

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY apps/backend/src ./src
COPY apps/backend/templates ./templates
COPY apps/backend/uploads ./uploads
COPY apps/backend/pyproject.toml ./pyproject.toml

RUN groupadd --gid 1000 app \
    && useradd --uid 1000 --gid app --shell /bin/false app \
    && chown -R app:app /app

ENV PYTHONPATH=/app

USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "-m", "uvicorn", "src.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
