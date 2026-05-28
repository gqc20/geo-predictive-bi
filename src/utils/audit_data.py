import pandas as pd
import numpy as np
import os
import sys
import logging

# Configuración de Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - AUDIT - %(levelname)s - %(message)s')
logger = logging.getLogger("DataAudit")

# Añadir raíz al path para importar config
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from src.config import GOLD_VIABILITY_PATH

def run_data_audit():
    """Ejecuta 4 pruebas críticas de auditoría sobre la capa Oro."""
    if not os.path.exists(GOLD_VIABILITY_PATH):
        logger.error(f"No existe el archivo de la capa Oro en: {GOLD_VIABILITY_PATH}")
        return

    df = pd.read_csv(GOLD_VIABILITY_PATH, sep=';')
    total_records = len(df)
    logger.info(f"--- Iniciando Auditoría de {total_records} registros ---")

    # --- TEST 1: Nombres Fantasma (Genéricos) ---
    genericos = ['ALIMENTACION', 'RESTAURANTE', 'BAR', 'CAFETERIA', 'TIENDA', 'SUPERMERCADO']
    mask_fantasma = df['name'].fillna('').str.upper().isin(genericos) | (df['name'].str.len() < 3)
    fantasma_count = mask_fantasma.sum()
    
    # --- TEST 2: Polaridad Imposible (Google vs Gemini) ---
    # Convertimos Rating (1-5) a escala 0-10 para comparar con Sentiment (0-10)
    if 'rating' in df.columns and 'sentiment_score' in df.columns:
        diff = np.abs((df['rating'] * 2) - df['sentiment_score'])
        mask_polaridad = diff > 4.5  # Diferencia de más de 4.5 puntos es sospechosa
        polaridad_count = mask_polaridad.sum()
    else:
        mask_polaridad = pd.Series([False] * total_records)
        polaridad_count = 0

    # --- TEST 3: Efecto Espejismo (Muestra Pequeña < 15 reseñas) ---
    if 'total_ratings' in df.columns:
        mask_espejismo = df['total_ratings'] < 15
        espejismo_count = mask_espejismo.sum()
    else:
        mask_espejismo = pd.Series([False] * total_records)
        espejismo_count = 0

    # --- TEST 4: Coordenadas Gemelas (Duplicados Geo) ---
    mask_duplicados = df.duplicated(subset=['lat', 'lon'], keep=False)
    duplicados_count = mask_duplicados.sum()

    # --- RESUMEN DE RESULTADOS ---
    logger.info("\n" + "="*40)
    logger.info("📊 RESUMEN DE CALIDAD DE DATOS")
    logger.info("="*40)
    logger.info(f"1. Nombres Fantasma (Genéricos): {fantasma_count} locales")
    logger.info(f"2. Polaridad Sospechosa (Google vs AI): {polaridad_count} locales")
    logger.info(f"3. Efecto Espejismo (Sin significancia): {espejismo_count} locales")
    logger.info(f"4. Duplicados Geográficos: {duplicados_count} locales")
    logger.info("="*40)

    # --- GUARDAR INFORME DE "SOSPECHOSOS" ---
    df['audit_fail_flags'] = ""
    df.loc[mask_fantasma, 'audit_fail_flags'] += "|FANTASMA|"
    df.loc[mask_polaridad, 'audit_fail_flags'] += "|POLARIDAD|"
    df.loc[mask_espejismo, 'audit_fail_flags'] += "|MIRAGE|"
    df.loc[mask_duplicados, 'audit_fail_flags'] += "|GEO_DUP|"

    # Solo locales que fallaron en algo
    df_fails = df[df['audit_fail_flags'] != ""].copy()
    
    audit_report_path = os.path.join(os.path.dirname(GOLD_VIABILITY_PATH), 'audit_report.csv')
    df_fails.to_csv(audit_report_path, index=False, sep=';')
    
    logger.info(f"Archivo de auditoría detallado guardado en: {audit_report_path}")
    logger.info(f"Salud general del dataset: {((total_records - len(df_fails))/total_records)*100:.1f}% de 'Datos Limpios'.")

if __name__ == "__main__":
    run_data_audit()
