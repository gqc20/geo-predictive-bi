import os
from dotenv import load_dotenv
from pathlib import Path

# Rutas Base del Proyecto
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

# Cargar variables del .env usando la ruta absoluta de la raíz
load_dotenv(dotenv_path=BASE_DIR / ".env")

# Direcciones de Archivos (Capas de Datos)
BRONZE_PATH = DATA_DIR / "bronze_madrid_food.csv"
SILVER_REVIEWS_PATH = DATA_DIR / "silver_reviews_sample.csv"
SILVER_ENRICHED_PATH = DATA_DIR / "silver_enriched_sentiment.csv"
GOLD_VIABILITY_PATH = DATA_DIR / "gold_viability_index.csv"

# API Keys
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Configuración de Base de Datos (PostgreSQL / PostGIS)
DB_USER = os.getenv("POSTGRES_USER")
DB_PASS = os.getenv("POSTGRES_PASSWORD")

if not DB_USER or not DB_PASS:
    raise ValueError(
        "CRÍTICO: Las variables de entorno POSTGRES_USER y POSTGRES_PASSWORD deben estar configuradas. "
        "No se permiten fallbacks inseguros en producción."
    )

DB_HOST = os.getenv("POSTGRES_HOST", "localhost")
DB_PORT = os.getenv("POSTGRES_PORT", "5432")
DB_NAME = os.getenv("POSTGRES_DB", "geobi")

# Parámetros del Modelo
KNN_NEIGHBORS = 5
VIABILITY_WEIGHT_DENSITY = 0.4
VIABILITY_WEIGHT_SENTIMENT = 0.6

# Logging Config
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
LOG_LEVEL = "INFO"
