# Headroom context-compression sidecar (local dev + Render private service).
# Docs: https://headroom-docs.vercel.app/docs/proxy
FROM python:3.11-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential \
  && pip install --no-cache-dir "headroom-ai[proxy]" \
  && apt-get purge -y build-essential \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

ENV HEADROOM_TELEMETRY=off
EXPOSE 8787

CMD ["headroom", "proxy", "--host", "0.0.0.0", "--port", "8787", "--no-telemetry"]
