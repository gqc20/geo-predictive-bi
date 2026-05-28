import pytest
import numpy as np
import pandas as pd
from src.models.knn_similarity import haversine_distance

def test_haversine_distance_zero():
    """Test: La distancia de un punto consigo mismo debe ser 0.0 metros."""
    dist = haversine_distance(40.4168, -3.7038, 40.4168, -3.7038)
    assert dist == 0.0, f"Error: Esperado 0.0, obtenido {dist}"

def test_haversine_distance_known_points():
    """Test: Distancia entre dos puntos con distancia conocida (Ej. 111km aprox por grado)."""
    # Madrid vs un punto un grado más al norte
    dist = haversine_distance(40.4168, -3.7038, 41.4168, -3.7038)
    # 1 grado de latitud son aproximadamente 111,000 metros
    assert 110000 < dist < 112000, f"Error en cálculo Haversine: {dist}"

def test_haversine_formula_valid_types():
    """Test: El tipado y la estructura devuelven un float."""
    dist = haversine_distance(40.4168, -3.7038, 41.4168, -3.7038)
    assert isinstance(dist, float), "La distancia devuelta no es un número decimal (float)"
