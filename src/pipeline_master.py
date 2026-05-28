import os
import sys
import time
import logging

from utils.logger import get_logger

logger = get_logger("MasterPipeline")

# Importar flujos
from pipeline_silver import run_silver_pipeline
from models.knn_similarity import run_knn_model
from loaders.postgres_loader import load_gold_to_postgres

def run_all(limit=100):
    total_start = time.time()
    logger.info("====================================================")
    logger.info("🌐 GEO-PREDICTIVE BI: INICIANDO PIPELINE MAESTRO 🌐")
    logger.info(f"Target Batch (Límite máximo): {limit} locales")
    logger.info("====================================================\n")

    # 1. CAPA PLATA (Engloba Extracción Bronce -> Plata Externa y Sentimiento IA)
    logger.info(">> FASE 1: Construyendo CAPA PLATA (Ingesta & Cognición)")
    try:
        run_silver_pipeline(limit=limit)
    except Exception as e:
        logger.error(f"Fallo catastrófico en la Capa Plata: {e}. Abortando pipeline.")
        sys.exit(1)

    # 2. CAPA ORO (Motor Predictivo y de Negocio Georreferenciado)
    logger.info("\n>> FASE 2: Construyendo CAPA ORO (Índice de Viabilidad KNN)")
    try:
        run_knn_model()
    except Exception as e:
        logger.error(f"Fallo catastrófico en la Capa Oro: {e}. Abortando pipeline.")
        sys.exit(1)

    # 3. CAPA SERVIDOR (Persistencia hacia Base de Datos SQL Relacional)
    logger.info("\n>> FASE 3: Persistencia en CAPA SERVIDOR (PostGIS Dashboard)")
    try:
        load_gold_to_postgres()
    except Exception as e:
        logger.error(f"Fallo al sincronizar base de datos: {e}. Abortando.")
        sys.exit(1)

    # 4. RESULTADO GLOBAL
    total_time = time.time() - total_start
    logger.info("\n====================================================")
    logger.info("✅ PIPELINE GLOBAL EJECUTADO CORRECTAMENTE")
    logger.info(f"⏱️ Tiempo total de la orquestación: {total_time:.2f} segundos")
    logger.info("   Artefactos en /data/ y persistencia segura en Docker - DB: geobi")
    logger.info("====================================================")


if __name__ == "__main__":
    # Límite desde variables de entorno, por defecto a 100
    batch_limit = int(os.getenv("BATCH_LIMIT", 100))
    run_all(limit=batch_limit)
