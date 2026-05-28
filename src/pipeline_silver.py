import os
import logging
import time
import re
from datetime import datetime
from dotenv import load_dotenv
from extractors.get_places import process_bronze_sample
from transformers.analyze_sentiment import process_sentiment_batch

# Configuración Senior: Logging Centralizado
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("SilverPipeline")

load_dotenv()

def update_documentation(num_records):
    """Actualiza automáticamente PROJECT_STATE.md con las últimas métricas."""
    doc_path = "docs/PROJECT_STATE.md"
    try:
        with open(doc_path, "r", encoding="utf-8") as f:
            content = f.read()

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if "<!-- AUTO_METRIC -->" in content:
            content = re.sub(
                r"<!-- AUTO_METRIC -->.*<!-- /AUTO_METRIC -->",
                f"<!-- AUTO_METRIC -->\n* **Última Ejecución Capa Plata:** {timestamp}\n* **Locales Procesados Totales:** {num_records}\n<!-- /AUTO_METRIC -->",
                content,
                flags=re.DOTALL
            )
            with open(doc_path, "w", encoding="utf-8") as f:
                f.write(content)
            logger.info("📄 Documentación (PROJECT_STATE.md) actualizada automáticamente.")
    except Exception as e:
        logger.warning(f"No se pudo actualizar la documentación: {e}")

def run_silver_pipeline(limit: int = 100):
    """
    Orquestador de la Capa Plata:
    1. Extrae datos de Google Places (Reviews) para N locales.
    2. Ejecuta análisis de sentimiento con Gemini sobre esos datos.
    """
    start_time = time.time()
    logger.info(f"🚀 Iniciando Pipeline Plata (Batch: {limit} locales)...")

    # Fase 1: Extracción
    logger.info("--- Fase 1: Extracción Google Places ---")
    df_places = process_bronze_sample(limit=limit)
    
    if df_places.empty:
        logger.error("❌ La extracción falló o no devolvió datos. Abortando pipeline.")
        return

    logger.info(f"✅ Extracción completada para {len(df_places)} locales.")

    # Fase 2: Análisis de Sentimiento
    logger.info("--- Fase 2: Análisis Cognitivo Gemini ---")
    # Nota: Si el batch es muy grande, podríamos necesitar splittear o añadir sleeps
    # para evitar Rate Limits de Gemini (Flash: 15 RPM).
    df_enriched = process_sentiment_batch(df_places)

    if not df_enriched.empty:
        logger.info(f"🏁 Pipeline Finalizado con Éxito.")
        logger.info(f"📊 Total Registros Procesados: {len(df_enriched)}")
        
        # Actualización automática de la documentación
        update_documentation(len(df_enriched))
        
        print("\n--- 🗺️ MUESTRA DE CAPA PLATA (100 LOCALES) ---")
        print(df_enriched[['name', 'rating', 'sentiment_score', 'top_strength']].head(10))
    else:
        logger.error("❌ El análisis de sentimiento no generó resultados.")

    duration = time.time() - start_time
    logger.info(f"⏱️ Tiempo total de ejecución: {duration:.2f} segundos.")

if __name__ == "__main__":
    # Escalar a 100 locales según la Tarea Actual
    batch_limit = int(os.getenv("BATCH_LIMIT", 100))
    run_silver_pipeline(limit=batch_limit)
