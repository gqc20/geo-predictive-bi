import pandas as pd
import geopandas as gpd
import json
import os
from shapely.geometry import Point
from pathlib import Path

def calculate_district_viability(csv_path, geojson_path, output_path):
    # 1. Cargar CSV
    df = pd.read_csv(csv_path, sep=';', encoding='utf-8')
    
    # 2. Cargar GeoJSON
    distritos = gpd.read_file(geojson_path)
    
    # 3. Convertir DataFrame a GeoDataFrame
    geometry = [Point(xy) for xy in zip(df.lon, df.lat)]
    gdf_locales = gpd.GeoDataFrame(df, crs=distritos.crs, geometry=geometry)
    
    # 4. Spatial Join (Asignar cada local a un distrito)
    # Note: 'name' is often the district name in click_that_hood data
    joined = gpd.sjoin(gdf_locales, distritos, how="left", predicate="within")
    
    # 5. Calcular promedios por distrito
    # Suponemos que la columna del nombre del distrito en el GeoJSON se llama 'name'
    summary = joined.groupby('name_right')['viability_index'].agg(['mean', 'count']).reset_index()
    summary.columns = ['district', 'avg_viability', 'count']
    
    # 6. Preparar datos para el frontend (GeoJSON enriquecido)
    # Merge de los resultados con el GeoJSON original
    distritos_final = distritos.merge(summary, left_on='name', right_on='district', how='left')
    
    # Rellenar vacíos
    distritos_final['avg_viability'] = distritos_final['avg_viability'].fillna(0)
    distritos_final['count'] = distritos_final['count'].fillna(0)
    
    # 7. Guardar resultado
    distritos_final.to_file(output_path, driver='GeoJSON')
    print(f"✅ Océanos Azules calculados: {output_path}")

if __name__ == "__main__":
    # Resolución dinámica de la carpeta raíz
    base_dir = Path(__file__).resolve().parent.parent
    csv_file = os.path.join(base_dir, "data", "gold_viability_index.csv")
    geojson_file = os.path.join(base_dir, "dashboard-premium", "public", "madrid_districts.json")
    output_file = os.path.join(base_dir, "dashboard-premium", "public", "distritos_viability.json")
    
    if os.path.exists(csv_file) and os.path.exists(geojson_file):
        calculate_district_viability(csv_file, geojson_file, output_file)
    else:
        print("❌ Error: Faltan archivos de entrada.")
