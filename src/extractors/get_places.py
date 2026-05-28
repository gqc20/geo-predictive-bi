import os
import pandas as pd
import requests
import logging
from typing import Optional, Dict, List
from config import GOOGLE_PLACES_API_KEY, BRONZE_PATH, SILVER_REVIEWS_PATH
from utils.logger import get_logger

# Configuración Senior: Logger Centralizado
logger = get_logger("GooglePlacesExtractor")

class GooglePlacesAPI:
    """
    Wrapper para interactuar con la API de Google Places (New/Text Search & Details).
    Diseñado siguiendo principios de mantenibilidad y robustez.
    """
    
    BASE_URL = "https://maps.googleapis.com/maps/api/place"
    
    def __init__(self):
        self.api_key = GOOGLE_PLACES_API_KEY
        if not self.api_key:
            logger.error("GOOGLE_PLACES_API_KEY no encontrada en el entorno.")
            raise ValueError("Falta la API Key de Google Places.")

    def find_place_id(self, name: str, latitude: float, longitude: float) -> Optional[str]:
        """
        Busca el Place ID de un local basándose en su nombre y coordenadas.
        """
        endpoint = f"{self.BASE_URL}/findplacefromtext/json"
        params = {
            "input": name,
            "inputtype": "textquery",
            "locationbias": f"point:{latitude},{longitude}",
            "fields": "place_id,name",
            "key": self.api_key
        }
        
        try:
            response = requests.get(endpoint, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") == "OK" and data.get("candidates"):
                place_id = data["candidates"][0]["place_id"]
                logger.info(f"Place ID encontrado para '{name}': {place_id}")
                return place_id
            
            logger.warning(f"No se encontró Place ID para '{name}' (Status: {data.get('status')})")
            return None
        except Exception as e:
            logger.error(f"Error en find_place_id para '{name}': {str(e)}")
            return None

    def get_place_details(self, place_id: str) -> Optional[Dict]:
        """
        Obtiene detalles específicos del local: rating, total_user_ratings y reviews.
        """
        endpoint = f"{self.BASE_URL}/details/json"
        params = {
            "place_id": place_id,
            "fields": "name,rating,user_ratings_total,reviews",
            "language": "es",
            "key": self.api_key
        }
        
        try:
            response = requests.get(endpoint, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get("status") == "OK":
                return data.get("result")
            
            logger.warning(f"Error obteniendo detalles para {place_id}: {data.get('status')}")
            return None
        except Exception as e:
            logger.error(f"Error en get_place_details para {place_id}: {str(e)}")
            return None

def process_bronze_sample(limit: int = 5):
    """
    Orquestador para procesar una muestra inicial de la capa Bronce.
    """
    input_path = BRONZE_PATH
    if not os.path.exists(input_path):
        logger.error(f"No se encuentra el archivo: {input_path}")
        return

    try:
        logger.info(f"Cargando muestra de Bronce (Límite: {limit})...")
        # Leemos el dataset y eliminamos duplicados de locales para no procesar el mismo varias veces
        df = pd.read_csv(input_path, sep=';')
        df_unique = df.drop_duplicates(subset=['id_local']).copy()
        
        output_path = SILVER_REVIEWS_PATH
        processed_ids = set()
        existing_data = []

        if os.path.exists(output_path):
            try:
                existing_df = pd.read_csv(output_path, sep=';')
                processed_ids = set(existing_df['id_local'])
                existing_data = existing_df.to_dict('records')
                logger.info(f"Omitiendo {len(processed_ids)} locales ya extraídos.")
            except Exception as e:
                logger.warning(f"No se pudo leer archivo existente: {e}")

        df_unique = df_unique[~df_unique['id_local'].isin(processed_ids)]
        
        # Tomamos una muestra aleatoria o los primeros N
        process_df = df_unique.head(limit)
        
        api = GooglePlacesAPI()
        enriched_data = []

        for _, row in process_df.iterrows():
            # Limpiamos el nombre y añadimos contexto geográfico para mejorar el match
            raw_name = str(row.get('rotulo', 'Local Desconocido')).strip()
            search_name = f"{raw_name}, Madrid, Spain"
            
            lat = row.get('latitude')
            lon = row.get('longitude')
            
            logger.info(f"Procesando: {raw_name} (ID: {row.get('id_local')})...")
            
            place_id = api.find_place_id(search_name, lat, lon)
            if place_id:
                details = api.get_place_details(place_id)
                if details:
                    # Extraemos las reseñas como un string consolidado para Gemini
                    reviews = details.get("reviews", [])
                    review_text = " | ".join([r.get("text", "") for r in reviews])
                    
                    enriched_row = {
                        "id_local": row.get("id_local"),
                        "name": raw_name,
                        "rating": details.get("rating"),
                        "total_ratings": details.get("user_ratings_total"),
                        "reviews_sample": review_text,
                        "place_id": place_id,
                        "lat": lat,
                        "lon": lon
                    }
                    enriched_data.append(enriched_row)
            
        all_data = existing_data + enriched_data
            
        if all_data:
            output_df = pd.DataFrame(all_data)
            output_df.to_csv(output_path, index=False, sep=';', encoding='utf-8')
            logger.info(f"Muestra Plata generada con éxito en: {output_path} ({len(enriched_data)} nuevos, {len(all_data)} totales)")
            return output_df
        else:
            logger.warning("No se generaron datos enriquecidos.")
            return pd.DataFrame()

    except Exception as e:
        logger.exception(f"Fallo crítico en el proceso de extracción: {str(e)}")
        return pd.DataFrame()

if __name__ == "__main__":
    # Iniciamos el piloto con 3 locales por defecto, pero permitimos escalar
    limit = int(os.getenv("BATCH_LIMIT", 3))
    process_bronze_sample(limit=limit)
