import pandas as pd
import json
import os
from pathlib import Path

def convert_csv_to_json(csv_path, json_path):
    # Leer CSV con separador punto y coma
    df = pd.read_csv(csv_path, sep=';', encoding='utf-8')
    
    # Manejar valores NaN (importante para JSON)
    df = df.replace({float('nan'): None})
    
    # Convertir a lista de diccionarios
    data = df.to_dict(orient='records')
    
    # Guardar como JSON
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Conversión completada: {json_path}")
    print(f"📊 Registros procesados: {len(data)}")

if __name__ == "__main__":
    # Resolución dinámica de la carpeta raíz
    base_dir = Path(__file__).resolve().parent.parent
    csv_file = os.path.join(base_dir, "data", "gold_viability_index.csv")
    output_dir = os.path.join(base_dir, "dashboard-premium", "public")
    
    # Asegurar que el directorio de salida existe
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    json_file = os.path.join(output_dir, "geobi_data.json")
    
    if os.path.exists(csv_file):
        convert_csv_to_json(csv_file, json_file)
    else:
        print(f"❌ Error: No se encuentra el archivo {csv_file}")
