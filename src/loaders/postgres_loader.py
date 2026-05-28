import os
import pandas as pd
import logging
from sqlalchemy import create_engine
from config import DB_USER, DB_PASS, DB_HOST, DB_PORT, DB_NAME, GOLD_VIABILITY_PATH

logger = logging.getLogger(__name__)

def load_gold_to_postgres(input_path=GOLD_VIABILITY_PATH):
    """
    Carga el artefacto final (Capa Oro) hacia la base de datos relacional PostgreSQL.
    En el futuro, usando PostGIS, aquí se ejecutarán los índices espaciales nativos.
    """
    if not os.path.exists(input_path):
        logger.warning(f"No se encontró el archivo {input_path}. No hay data Oro para cargar.")
        return

    logger.info("🏭 Iniciando carga masiva a PostgreSQL (Capa Servidor)...")
    
    # Credenciales desde configuración central
    db_user = DB_USER
    db_pass = DB_PASS
    db_host = DB_HOST
    db_port = DB_PORT
    db_name = DB_NAME
    
    # String de conexión SQLAlchemy
    conn_str = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
    
    try:
        engine = create_engine(conn_str)
        df_gold = pd.read_csv(input_path, sep=';')
        
        # Inserción con pandas (reemplaza toda la tabla para recrear la foto actual del mercado, 
        # en prd podríamos usar 'append' o UPSERTS más complejos).
        df_gold.to_sql(
            name='viability_index', 
            con=engine, 
            schema='public', 
            if_exists='replace', 
            index=False
        )
        
        logger.info(f"✅ ¡Éxito! {len(df_gold)} registros Oro insertados en 'public.viability_index'.")
        
    except Exception as e:
        logger.error(f"❌ Fallo al cargar los datos en PostgreSQL: {e}")
        logger.error("Asegúrate de que el contenedor Docker (geo_bi_postgres) esté ejecutándose.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    load_gold_to_postgres()
