# Image de production pour le backend Fitness Royale (FastAPI).
# Voir "Hébergement du backend" dans CLAUDE.md pour le déploiement sur Fly.io.

FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Le volume persistant Fly.io est monté sur /data (voir fly.toml) : la base
# SQLite et les vidéos uploadées y vivent, pour survivre aux redéploiements.
ENV FITNESS_ROYALE_DATA_DIR=/data

EXPOSE 8000

# Pas de --reload en production (réservé au développement local).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
