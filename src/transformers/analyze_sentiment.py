import os
import json
import time
from typing import Dict, Optional
import pandas as pd
import google.generativeai as genai
from config import GEMINI_API_KEY, SILVER_REVIEWS_PATH, SILVER_ENRICHED_PATH
from utils.logger import get_logger

# Configuración Senior: IA con Logger Centralizado
logger = get_logger("SentimentAnalyzer")

class SentimentAnalyzer:
    """
    Motor de Análisis de Sentimiento usando Gemini API.
    Transforma reseñas crudas en indicadores estructurados de calidad.
    """
    
    def __init__(self):
        self.api_key = GEMINI_API_KEY
        self.prompt_version = "v1.2-structural-bi" # Versionado para trazabilidad
        if not self.api_key:
            logger.error("GEMINI_API_KEY no encontrada.")
            raise ValueError("Falta la API Key de Gemini.")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-2.0-flash-lite')

    def analyze_local_reviews(self, row: pd.Series) -> Optional[Dict]:
        """
        Envía las reseñas a Gemini con reintentos exponenciales y devuelve análisis JSON.
        """
        reviews = row.get("reviews_sample", "")
        name = row.get("name", "Local")
        
        if not reviews or pd.isna(reviews):
            return None

        prompt = f"""
        (VERSION: {self.prompt_version})
        Actúa como un experto Analista de Datos para Business Intelligence.
        Analiza las siguientes reseñas de clientes para el local '{name}' en Madrid.
        ...
        """
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = self.model.generate_content(prompt)
                clean_response = response.text.replace("```json", "").replace("```", "").strip()
                result = json.loads(clean_response)
                # Inyectamos la versión del prompt para auditoría
                result["prompt_v"] = self.prompt_version
                return result
            except Exception as e:
                wait_time = (2 ** attempt) * 5
                logger.warning(f"Error en Gemini para {name} (Intento {attempt+1}/{max_retries}): {e}. Reintentando en {wait_time}s...")
                time.sleep(wait_time)
                
        return None

def process_sentiment_batch(df: Optional[pd.DataFrame] = None):
    """
    Carga los datos enriquecidos (Silver) y añade el análisis cognitivo.
    """
    input_path = SILVER_REVIEWS_PATH
    output_path = SILVER_ENRICHED_PATH
    
    if df is None:
        if not os.path.exists(input_path):
            logger.error(f"No existe el archivo de entrada: {input_path}")
            return
        df = pd.read_csv(input_path, sep=';')

    try:
        logger.info("Iniciando Proceso Cognitivo (Capa Plata - Sentimiento)...")
        
        processed_ids = set()
        existing_data = []
        if os.path.exists(output_path):
            try:
                existing_df = pd.read_csv(output_path, sep=';')
                processed_ids = set(existing_df['id_local'])
                existing_data = existing_df.to_dict('records')
                logger.info(f"Omitiendo {len(processed_ids)} locales ya analizados en Sentimiento.")
            except Exception as e:
                logger.warning(f"No se pudo leer archivo de sentimiento existente: {e}")

        # Filtramos los que ya están procesados
        df_to_process = df[~df['id_local'].isin(processed_ids)]

        analyzer = SentimentAnalyzer()
        results = []

        for index, row in df_to_process.iterrows():
            logger.info(f"Analizando sentimiento para: {row['name']}...")
            analysis = analyzer.analyze_local_reviews(row)
            
            if analysis:
                # Combinamos los datos originales con el análisis de la IA
                enriched_row = {**row.to_dict(), **analysis}
                results.append(enriched_row)
            
            # Rate Limiting: Gemini Flash Free Tier allows ~15 RPM. Let's wait 4s.
            time.sleep(4)
        
        all_data = existing_data + results
            
        if all_data:
            final_df = pd.DataFrame(all_data)
            final_df.to_csv(output_path, index=False, sep=';', encoding='utf-8')
            logger.info(f"Análisis completado. Resultados guardados en: {output_path} ({len(results)} nuevos, {len(all_data)} totales)")
            return final_df
        else:
            logger.warning("No se pudo generar ningún análisis.")
            return pd.DataFrame()

    except Exception as e:
        logger.exception(f"Fallo en el proceso de sentimiento: {str(e)}")
        return pd.DataFrame()

if __name__ == "__main__":
    process_sentiment_batch()
