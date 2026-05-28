import os
import logging
import pandas as pd
import numpy as np
from sklearn.neighbors import BallTree
import math
from config import SILVER_ENRICHED_PATH, GOLD_VIABILITY_PATH, KNN_NEIGHBORS, VIABILITY_WEIGHT_DENSITY, VIABILITY_WEIGHT_SENTIMENT
from utils.logger import get_logger

logger = get_logger("GoldKNNModel")

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calcula la distancia en metros entre dos puntos geográficos."""
    R = 6371000  # Radio de la Tierra en metros
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2.0)**2 + math.cos(phi1)*math.cos(phi2) * math.sin(delta_lambda/2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def run_knn_model():
    """
    Capa Oro: Ejecuta el modelo predictivo espacial (KNN BallTree).
    Calcula el 'Índice de Viabilidad de Apertura' para cada local analizado, 
    basándose en la competencia y la calidad (sentimiento) de sus vecinos próximos.
    """
    input_path = SILVER_ENRICHED_PATH
    output_path = GOLD_VIABILITY_PATH
    
    if not os.path.exists(input_path):
        logger.error(f"Falta la capa Plata: {input_path}")
        return

    try:
        logger.info("🌟 Iniciando Modelado Predictivo (Capa Oro)...")
        df = pd.read_csv(input_path, sep=';')
        
        # Filtros de Resiliencia: Nos aseguramos de tener coordenadas y scores
        df = df.dropna(subset=['lat', 'lon']).copy()
        
        # Si un local "Silver" no tiene sentimiento, lo imputamos al neutro conservador (5.0)
        if 'sentiment_score' not in df.columns:
            logger.error("No se encontró la columna 'sentiment_score'. ¿Se completó la Fase 2?")
            return
            
        df['sentiment_score'] = df['sentiment_score'].fillna(5.0)
        
        coords_rad = np.radians(df[['lat', 'lon']])
        tree = BallTree(coords_rad, metric='haversine')
        
        K = KNN_NEIGHBORS # Analizamos los competidores más cercanos de config
        # Si hay menos de K locales en la muestra, ajustamos K
        actual_K = min(K, len(df))
        
        logger.info(f"Buscando los {actual_K} vecinos más próximos con BallTree...")
        distances_rad, indices = tree.query(coords_rad, k=actual_K)
        
        viability_scores = []
        
        # --- CÁLCULO DE ESCALA URBANA (ADAPTATIVO) ---
        # En lugar de usar 1km fijo, calculamos qué distancia se considera "baja densidad" en este dataset
        # Usamos el percentil 75 de las distancias medias como referencia de 'un mar de distancia'.
        all_neighbor_dists = [np.mean(d[1:]) * 6371000 for d in distances_rad] 
        dynamic_max_dist = np.percentile(all_neighbor_dists, 75)
        logger.info(f"Escala urbana dinámica establecida en: {dynamic_max_dist:.2f} metros (P75)")

        for i in range(len(df)):
            neighbor_indices = [idx for idx in indices[i] if idx != i]
            
            if not neighbor_indices:
                viability_scores.append(50.0)
                continue
                
            neighbor_dists_rad = [d for idx, d in zip(indices[i], distances_rad[i]) if idx != i]
            mean_dist_comp_meters = np.mean(neighbor_dists_rad) * 6371000
            
            neighbor_scores = df.iloc[neighbor_indices]['sentiment_score']
            mean_sentiment_comp = neighbor_scores.mean()
            
            # --- MOTOR DE REGLAS (Lógica de Negocio Adaptativa) ---
            # Normalizamos contra el dinamismo urbano del dataset
            norm_dist = min(mean_dist_comp_meters / dynamic_max_dist, 1.0) 
            
            # 2. Premiamos mala calidad de competencia (Océano Azul):
            # Si el sentimiento de la competencia es 2.0 (malo), la oportunidad es (10-2.0)/10 = 0.8 (Alta)
            opportunity_score = (10.0 - mean_sentiment_comp) / 10.0
            
            # PONDERACIONES DESDE CONFIGURACIÓN
            # El índice base ya está compuesto de porcentajes (0-100)
            viability_index = (norm_dist * (VIABILITY_WEIGHT_DENSITY * 100)) + (opportunity_score * (VIABILITY_WEIGHT_SENTIMENT * 100))
            
            # Limitar entre 0 y 100 de forma natural
            viability_index = max(0, min(viability_index, 100))
            viability_scores.append(round(viability_index, 2))
            
        df['viability_index'] = viability_scores
        
        # Guardar artefacto Oro
        df.to_csv(output_path, index=False, sep=';', encoding='utf-8')
        logger.info(f"🏆 Cálculo Oro finalizado. Índice de viabilidad inyectado.")
        logger.info(f"Archivo guardado: {output_path} ({len(df)} registros)")
        
        print("\n--- 🏅 TOP 5 LOCALES POR VIABILIDAD DE APERTURA (CAPA ORO) ---")
        top_gold = df.sort_values(by='viability_index', ascending=False)
        print(top_gold[['name', 'viability_index', 'sentiment_score']].head(5))

    except Exception as e:
        logger.error(f"Fallo crítico en modelado predictivo Oro: {e}")

if __name__ == "__main__":
    run_knn_model()
