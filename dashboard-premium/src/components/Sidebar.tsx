import React, { useState } from 'react';
import { 
  BarChart3, 
  Map as MapIcon, 
  Search, 
  Settings, 
  Layers, 
  TrendingUp,
  BrainCircuit,
  PanelLeftClose,
  Flame,
  Compass
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SidebarProps {
  activeLayer: string;
  onLayerChange: (layer: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeLayer, onLayerChange }) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const menuItems = [
    { 
      id: 'tactical', 
      icon: MapIcon, 
      label: 'Táctico Madrid',
      tooltip: 'Vista detallada local a local con KPIs individuales.'
    },
    { 
      id: 'heatmap', 
      icon: Flame, 
      label: 'Geo Heatmap',
      tooltip: 'Identifica zonas de saturación y alta densidad HORECA.'
    },
    { 
      id: 'choropleth', 
      icon: Layers, 
      label: 'Océanos Azules',
      tooltip: 'Ranking estratégico de distritos por potencial de éxito.'
    },
    { 
      id: 'analytics', 
      icon: BarChart3, 
      label: 'Analytics',
      tooltip: 'Métricas agregadas y comparativa de mercado.'
    },
    { 
      id: 'cognitivo', 
      icon: BrainCircuit, 
      label: 'Cognitivo AI',
      tooltip: 'Análisis profundo de Gemini sobre sentimientos.'
    },
    { 
      id: 'projector', 
      icon: Compass, 
      label: 'Proyector Vectorial',
      tooltip: 'Visualiza embeddings 2D de locales con K-NN interactivo.'
    },
    { 
      id: 'proyecciones', 
      icon: TrendingUp, 
      label: 'Proyecciones',
      tooltip: 'Modelos de supervivencia y ROI estimado.'
    },
    { 
      id: 'sketches_bi', 
      icon: BarChart3, 
      label: 'Sketches BI',
      tooltip: 'Simula el comportamiento en Tableau, PowerBI o Looker Studio.'
    },
  ];

  return (
    <aside className="w-64 h-screen border-r border-white/10 flex flex-col bg-slate-950/50 backdrop-blur-xl shrink-0 z-50">
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-brand-500/20">
            G
          </div>
          <span className="font-bold text-lg tracking-tight">Geo BI</span>
        </div>
        <PanelLeftClose className="w-5 h-5 text-slate-500 hover:text-white cursor-pointer transition-colors" />
      </div>

      <div className="px-4 mb-8">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-brand-400 transition-colors" />
          <input 
            type="text" 
            placeholder="Buscar locales..." 
            className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all font-medium"
          />
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1 relative">
        <div className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Visualización Geo</div>
        {menuItems.map((item) => (
          <div key={item.id} className="relative">
            <button 
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={() => onLayerChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all group ${
                activeLayer === item.id 
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`w-5 h-5 ${activeLayer === item.id ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'} transition-colors`} />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {activeLayer === item.id && <div className="w-1 h-4 bg-brand-500 rounded-full" />}
            </button>

            {/* Premium Tooltip */}
            <AnimatePresence>
              {hoveredItem === item.id && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="absolute left-full ml-4 top-1/2 -translate-y-1/2 w-48 p-3 glass rounded-xl pointer-events-none z-[100] shadow-2xl shadow-black/50"
                  style={{ backdropFilter: 'blur(12px)' }}
                >
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 rotate-45 bg-[#0f172a] border-l border-b border-white/10"></div>
                  <p className="text-[10px] leading-relaxed text-slate-300 font-medium">
                    {item.tooltip}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/5">
        <div className="bg-slate-900/50 rounded-xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-tight">Configuración</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed mb-3">Versión Enterprise v2.4.0 <br /> Madrid Core Insights.</p>
          <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors">
            Cerrar Sesión
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
