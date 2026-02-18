# Dockerfile producao - multi-stage build (Fase 8)
# Stage 1: builder
FROM python:3.12-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*
COPY pyproject.toml .
COPY src/ src/
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

# Stage 2: runtime enxuto
FROM python:3.12-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Copiar site-packages do builder (pacote + dependencias)
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
ENV PYTHONPATH=/usr/local/lib/python3.12/site-packages
RUN groupadd --gid 1000 app && useradd --uid 1000 --gid app --shell /bin/false app
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
# python -m uvicorn: nao depende de /usr/local/bin (so copiamos site-packages no runtime)
CMD ["sh", "-c", "echo 'CompletePay Agent starting...' && exec python -m uvicorn src.api.app:app --host 0.0.0.0 --port 8000"]
