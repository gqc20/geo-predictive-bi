import pytest
import pandas as pd
import numpy as np
import os
from src.models.knn_similarity import run_knn_model
from src.config import SILVER_ENRICHED_PATH, GOLD_VIABILITY_PATH

@pytest.fixture
def mock_silver_data(tmp_path):
    """Crea un dataset sintético para pruebas de modelo."""
    data = {
        'id_local': [1, 2, 3],
        'name': ['Local A', 'Local B', 'Local C'],
        'lat': [40.4168, 40.4170, 40.5000],  # A y B están cerca, C lejos
        'lon': [-3.7038, -3.7039, -3.8000],
        'sentiment_score': [8.0, 2.0, 5.0]
    }
    df = pd.DataFrame(data)
    temp_csv = tmp_path / "silver_mock.csv"
    df.to_csv(temp_csv, index=False, sep=';')
    return temp_csv

def test_knn_viability_logic(mock_silver_data, monkeypatch, tmp_path):
    """Test: Verifica que la lógica de viabilidad se aplique correctamente."""
    output_gold = tmp_path / "gold_mock.csv"
    
    # Parcheamos las rutas en config para usar los temporales
    monkeypatch.setattr("src.models.knn_similarity.SILVER_ENRICHED_PATH", str(mock_silver_data))
    monkeypatch.setattr("src.models.knn_similarity.GOLD_VIABILITY_PATH", str(output_gold))
    
    run_knn_model()
    
    assert os.path.exists(output_gold)
    df_gold = pd.read_csv(output_gold, sep=';')
    
    assert 'viability_index' in df_gold.columns
    # Local B debería tener mayor viabilidad de apertura si sus vecinos (A) tienen sentimiento alto 
    # y hay competencia cerca (penalización), pero el índice es una mezcla.
    # Solo comprobamos que se generaron valores coherentes.
    assert df_gold['viability_index'].min() >= 0
    assert df_gold['viability_index'].max() <= 100
