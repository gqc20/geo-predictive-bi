import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import HeatmapLayer from './HeatmapLayer';

// Fix for default marker icon in Leaflet + React
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface GeoItem {
  id_local: number;
  name: string;
  lat: number;
  lon: number;
  viability_index: number;
  sentiment_score: number;
  menu_gap: string;
}

interface MapProps {
  data: GeoItem[];
  showHeatmap: boolean;
  showChoropleth: boolean;
  choroplethData: any;
  selectedDistrict: string | null;
  onSelectDistrict: (districtName: string | null) => void;
}

const MapComponent: React.FC<MapProps> = ({ data, showHeatmap, showChoropleth, choroplethData, selectedDistrict, onSelectDistrict }) => {
  const madridCenter: [number, number] = [40.4168, -3.7038];

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative">
      <MapContainer 
        center={madridCenter} 
        zoom={13} 
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <ZoomControl position="bottomright" />
        
        {showChoropleth && choroplethData && (
          <GeoJSON 
            data={choroplethData} 
            key={selectedDistrict || 'none'} // Re-render GeoJSON layer when selected district changes to apply style changes
            style={(feature) => {
              const isSelected = feature?.properties.name === selectedDistrict;
              return {
                fillColor: isSelected ? '#10b981' : 
                           feature?.properties.avg_viability > 40 ? '#0ea5e9' : 
                           feature?.properties.avg_viability > 30 ? '#38bdf8' :
                           feature?.properties.avg_viability > 20 ? '#7dd3fc' : '#1e293b',
                weight: isSelected ? 3.5 : 1.5,
                opacity: 1,
                color: isSelected ? '#10b981' : 'white',
                fillOpacity: isSelected ? 0.75 : 0.45,
                dashArray: isSelected ? '0' : '3'
              };
            }}
            onEachFeature={(feature, layer) => {
              layer.on({
                click: () => {
                  onSelectDistrict(feature.properties.name);
                }
              });
              layer.bindPopup(`
                <div class="p-2">
                  <h4 class="font-bold text-slate-900 leading-tight">${feature.properties.name}</h4>
                  <div class="text-xs mt-1 text-slate-700">
                    <p>Viabilidad Media: <strong>${Math.round(feature.properties.avg_viability)}%</strong></p>
                    <p>Muestra Locales: <strong>${feature.properties.count}</strong></p>
                    <p class="text-[10px] text-brand-600 font-bold mt-1.5">💡 Haz clic para fijar inspección de distrito</p>
                  </div>
                </div>
              `);
            }}
          />
        )}
        
        {showHeatmap ? (
          <HeatmapLayer 
            points={data.map(item => [item.lat, item.lon, item.viability_index / 100])} 
          />
        ) : (
          data.slice(0, 200).map((item) => (
            <Marker 
              key={item.id_local} 
              position={[item.lat, item.lon]}
              icon={L.divIcon({
                  className: 'custom-icon',
                  html: `<div style="background-color: ${item.viability_index > 30 ? '#38bdf8' : '#64748b'}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);"></div>`,
                  iconSize: [12, 12],
                  iconAnchor: [6, 6]
              })}
            >
              <Popup>
                <div className="p-1 min-w-[150px]">
                  <h4 className="font-bold text-slate-900 leading-tight mb-1">{item.name}</h4>
                  <div className="flex flex-col gap-1 text-xs">
                      <div className="flex justify-between">
                          <span className="text-slate-500">Viabilidad:</span>
                          <span className="font-bold text-brand-600"> {item.viability_index}%</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-slate-500">Sentimiento:</span>
                          <span className="font-bold text-slate-700"> {item.sentiment_score}/10</span>
                      </div>
                      {item.menu_gap && (
                          <div className="mt-1 pt-1 border-t border-slate-100">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Brecha de Mercado</span>
                              <p className="text-slate-700 font-medium"> {item.menu_gap}</p>
                          </div>
                      )}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))
        )}
      </MapContainer>
      
      {/* Legend overlay */}
      <div className="absolute bottom-6 left-6 z-[1000] glass p-3 rounded-xl pointer-events-none">
        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Indicadores</h5>
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-400"></div>
                <span className="text-[10px] leading-none text-slate-300">Alta Viabilidad</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-500"></div>
                <span className="text-[10px] leading-none text-slate-300">Saturado / Bajo</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MapComponent;
