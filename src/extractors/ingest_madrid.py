import os
import pandas as pd
import json
import logging
from pyproj import Transformer
from dotenv import load_dotenv

# Configuración Senior: Logging y Errores
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

def clean_madrid_data(file_path):
    """
    Carga y limpia el censo de locales de Madrid (JSON).
    Aplica estandarización de columnas y filtrado inicial.
    """
    if not os.path.exists(file_path):
        logger.error(f"Archivo no encontrado: {file_path}")
        return None

    try:
        logger.info(f"Cargando dataset: {file_path}...")
        # Envolviendo en un dataframe para manipulacion rapida
        df = pd.read_json(file_path)
        
        # 1. Normalización de Cabeceras (Snake Case limpio)
        df.columns = (df.columns
                      .str.strip()
                      .str.lower()
                      .str.normalize('NFKD')
                      .str.encode('ascii', errors='ignore')
                      .str.decode('utf-8')
                      .str.replace(' ', '_')
                      .str.replace('.', ''))

        # 2. Conversión de Coordenadas (UTM 30N -> Lat/Lon)
        logger.info("Convirtiendo coordenadas UTM a Lat/Lon...")
        transformer = Transformer.from_crs("epsg:25830", "epsg:4326")
        
        # Filtramos nulos en coordenadas antes de convertir
        df = df.dropna(subset=['coordenada_x_local', 'coordenada_y_local'])
        
        # Aplicamos la transformación
        lat, lon = transformer.transform(df['coordenada_x_local'].values, df['coordenada_y_local'].values)
        df['latitude'] = lat
        df['longitude'] = lon

        # 3. Filtrado Sectorial (Solo Comida/Alimentación)
        keywords = ['SUPERMERCADO', 'FRUTERIA', 'CARNICERIA', 'CAFETERIA', 'BAR', 'RESTAURANTE', 'ALIMENTACION']
        mask_sector = df['rotulo'].fillna('').str.contains('|'.join(keywords), case=False, na=False)
        
        # 4. Filtrado Geográfico Crítico (Limpieza de 0,0 y coordenadas fuera de Madrid)
        # Latitud Madrid ~ 40.3 a 40.6 | Longitud Madrid ~ -3.8 a -3.5
        mask_geo = (df['latitude'] > 40.0) & (df['latitude'] < 41.0) & \
                   (df['longitude'] > -4.5) & (df['longitude'] < -3.0)
        
        df_filtered = df[mask_sector & mask_geo].copy()

        logger.info(f"Pasamos de {len(df)} registros a {len(df_filtered)} tras filtrar sector comida y limpiar coordenadas inválidas.")
        
        return df_filtered

    except Exception as e:
        logger.error(f"Error procesando JSON: {str(e)}")
        raise

if __name__ == "__main__":
    # Caminos de archivos proporcionados por el usuario
    json_licencias = "data/209548-790-censo-locales-historico.json"
    
    # Procesar capa Bronce
    df_clean = clean_madrid_data(json_licencias)
    
    if df_clean is not None:
        # Guardamos un checkpoint en CSV para que el usuario pueda verlo facil
        output_path = "data/bronze_madrid_food.csv"
        df_clean.to_csv(output_path, index=False, sep=';', encoding='utf-8')
        logger.info(f"Capa Bronce (Parcial) guardada en: {output_path}")
