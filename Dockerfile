FROM python:3.12-slim

WORKDIR /app

# sqlite3 já vem embutido no Python — não precisa de apt-get

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py schema.sql ./
# Frontend estático na raiz do repositório (index.html, app.js)
COPY index.html app.js ./static/

# Diretório de dados (será montado como volume)
RUN mkdir -p /app/data

ENV DATABASE_PATH=/app/data/database.db
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

# 2 workers, threaded para SQLite (cada worker abre sua própria conexão por request)
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "--timeout", "60", "app:app"]
