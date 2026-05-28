import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

interface HeatmapLayerProps {
  points: [number, number, number][]; // [lat, lon, intensity]
}

const HeatmapLayer = ({ points }: HeatmapLayerProps) => {
  const map = useMap();

  useEffect(() => {
    if (!map || !points.length) return;

    // @ts-ignore - leaflet.heat adds this method to L
    const heatLayer = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 17,
      gradient: {
        0.4: '#38bdf8', // Light blue (brand)
        0.6: '#fbbf24', // Amber
        0.8: '#f97316', // Orange
        1.0: '#ef4444'  // Red (highest density)
      }
    });

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, points]);

  return null;
};

export default HeatmapLayer;
