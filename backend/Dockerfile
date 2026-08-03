FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN useradd --system --create-home --uid 10001 app

COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    --trusted-host pypi.tuna.tsinghua.edu.cn \
    -r requirements.txt

COPY --chown=app:app alembic.ini ./
COPY --chown=app:app alembic ./alembic
COPY --chown=app:app app ./app
COPY docker-entrypoint.sh /usr/local/bin/lanying-backend

RUN mkdir -p /app/uploads \
    && chown -R app:app /app \
    && chmod 755 /usr/local/bin/lanying-backend

USER app

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/lanying-backend"]
