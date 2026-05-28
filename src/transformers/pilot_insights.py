import pandas as pd
import google.generativeai as genai
import logging
from dotenv import load_dotenv

# Configuración de Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()

from src.config import GEMINI_API_KEY

def pilot_cognitive_layer(df_path, district_name, sector_keyword, limit=5):
    """
    Simula la Capa Plata (Cognitiva) para un distrito y sector específico.
    Utiliza Gemini para extraer 'Insights de Negocio' de datos crudos.
    """
    try:
        # 1. Carga de datos
        df = pd.read_csv(df_path, sep=';')
        
        # 2. Filtrado para el Piloto (Chamberí / Cafeterías)
        df_pilot = df[
            (df['desc_distrito_local'].str.contains(district_name, case=False)) & 
            (df['rotulo'].str.contains(sector_keyword, case=False))
        ].head(limit)
        
        if df_pilot.empty:
            logger.warning(f"No se encontraron locales para {sector_keyword} en {district_name}")
            return
        
        # 3. Preparación de Gemini
        api_key = GEMINI_API_KEY
        if not api_key or api_key == "tu_api_key_aqui":
            logger.error("No se encontró GEMINI_API_KEY configurada.")
            return

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.0-flash')

        logger.info(f"Procesando {len(df_pilot)} locales del distrito {district_name} con Gemini...")

        results = []
        for index, row in df_pilot.iterrows():
            # Construimos un 'Contexto de Negocio' para la IA
            prompt = f"""
            Actúa como un Consultor de BI experto en España.
            Analiza este local de Madrid:
            Nombre: {row['rotulo']}
            Barrio: {row['desc_barrio_local']}
            Coordenadas: {row['latitude']}, {row['longitude']}
            Situación: {row['desc_situacion_local']}
            
            Como no tenemos las reseñas reales todavía para este piloto, basándote en tu conocimiento 
            del mercado gastronómico en Madrid y este barrio específico, dime:
            1. ¿Cuál es el perfil de cliente típico en este barrio?
            2. ¿Cuáles son los 2 mayores riesgos competitivos de este local?
            3. Una sugerencia estratégica para mejorar su viabilidad.
            SÉ BREVE Y DIRECTO.
            """
            
            response = model.generate_content(prompt)
            logger.info(f"Insight extraído para: {row['rotulo']}")
            results.append({
                "local": row['rotulo'],
                "insight": response.text
            })

        return results

    except Exception as e:
        logger.error(f"Error en el piloto cognitivo: {str(e)}")
        raise

if __name__ == "__main__":
    # CONFIGURACIÓN DEL PILOTO
    DISTRICT = "CHAMBERI"
    SECTOR = "CAFETERIA"
    DATA_PATH = "data/bronze_madrid_food.csv"
    
    logger.info("INICIANDO PILOTO COGNITIVO (FASE 2 - PLATA)")
    pilot_results = pilot_cognitive_layer(DATA_PATH, DISTRICT, SECTOR)
    
    if pilot_results:
        print("\n--- 🧠 INSIGHTS GENERADOS POR IA (PILOTO MADRID) ---")
        for res in pilot_results:
            print(f"\n📍 LOCAL: {res['local']}")
            print(f"{res['insight']}")
            print("-" * 50)
