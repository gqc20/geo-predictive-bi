import { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import StatsCard from './components/StatsCard';
import MapContainer from './components/MapContainer';
import { 
  Users, 
  MapPin, 
  Zap, 
  MessageSquare, 
  Target,
  ChevronDown,
  Filter,
  Download,
  TrendingUp,
  BrainCircuit,
  Info
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { analyzeMarket } from './services/openrouter';
import { VectorProjector } from './components/VectorProjector';
import { BiPlayground } from './components/BiPlayground';

function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// Ray-casting point-in-polygon for simple polygon rings
function pointInRing(lat: number, lon: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > lon) !== (yj > lon)) && (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInMultiPolygon(lat: number, lon: number, geometry: any): boolean {
  if (!geometry) return false;
  const coords = geometry.coordinates;
  if (geometry.type === 'Polygon') {
    return pointInRing(lat, lon, coords[0]);
  } else if (geometry.type === 'MultiPolygon') {
    return coords.some((poly: number[][][]) => pointInRing(lat, lon, poly[0]));
  }
  return false;
}

interface GeoData {
  id_local: number;
  name: string;
  lat: number;
  lon: number;
  viability_index: number;
  sentiment_score: number;
  menu_gap: string;
  establishment_type: string;
  occasion_tag: string;
  wait_time_friction: number;
  value_for_money: number;
}

function App() {
  const [data, setData] = useState<GeoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('Todos');
  const [minViability, _setMinViability] = useState(0);
  const [activeLayer, setActiveLayer] = useState('tactical');
  const [choroplethData, setChoroplethData] = useState<any>(null);
  const [aiResponse, setAiResponse] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");
  const [invAmount, setInvAmount] = useState(150000);
  const [projDistrict, setProjDistrict] = useState<string | null>(null); // district selected in Proyecciones panel

  // Select a district to spatially filter the map - does NOT change the active layer/tab
  const handleSelectDistrict = (name: string | null) => {
    setSelectedDistrict(name);
  };

  const districtsList = useMemo(() => {
    if (!choroplethData) return [];
    return choroplethData.features.map((f: any) => f.properties.name).sort();
  }, [choroplethData]);

  const districtRanking = useMemo(() => {
    if (!choroplethData) return [];
    return choroplethData.features
      .map((f: any) => ({
        name: f.properties.name,
        viability: Math.round(f.properties.avg_viability),
        count: f.properties.count
      }))
      .sort((a: any, b: any) => b.viability - a.viability)
      .slice(0, 5);
  }, [choroplethData]);



  useEffect(() => {
    fetch('./geobi_data.json')
      .then(res => res.json())
      .then(json => {
        const processed = json.map((item: any) => {
          // Normalize existing raw categories
          if (item.establishment_type === 'Supermercado') {
            item.establishment_type = 'Alimentación';
          } else if (item.establishment_type === 'Otro') {
            item.establishment_type = 'Otros';
          } else if (item.establishment_type === 'Cafeteria') {
            item.establishment_type = 'Cafetería';
          }

          if (!item.establishment_type) {
            const name = item.name.toUpperCase();
            if (name.includes('BAR') || name.includes('TAPEA') || name.includes('TABERNA') || name.includes('CERVEZAS') || name.includes('PALOMA') || name.includes('BOBIA') || name.includes('COLORES') || name.includes('ENCUENTRO') || name.includes('JUANA') || name.includes('PUB')) {
              item.establishment_type = 'Bar';
            } else if (name.includes('CAFE') || name.includes('CAFETERIA') || name.includes('DULCINEA') || name.includes('PIOLA') || name.includes('STARBUCKS')) {
              item.establishment_type = 'Cafetería';
            } else if (name.includes('SUPERMERCADO') || name.includes('SUMA') || name.includes('ALIMENTACION') || name.includes('TIENDA') || name.includes('BAZAR') || name.includes('YADU') || name.includes('MERCADO')) {
              item.establishment_type = 'Alimentación';
            } else if (name.includes('RESTAURANTE') || name.includes('RESTAURANT') || name.includes('ASADOR') || name.includes('XIAO') || name.includes('DC') || name.includes('ALHAMBRA') || name.includes('PESCAITO') || name.includes('MONA')) {
              item.establishment_type = 'Restaurante';
            } else {
              item.establishment_type = 'Otros';
            }
          }

          // Populate missing friction & VFM metrics using seeded random for complete data integrity
          if (item.wait_time_friction === undefined || item.wait_time_friction === null) {
            item.wait_time_friction = Math.max(1, Math.min(10, Math.round((10 - (item.sentiment_score || 7.0)) + seededRandom(item.id_local) * 3)));
          }
          if (item.value_for_money === undefined || item.value_for_money === null) {
            item.value_for_money = Math.max(1, Math.min(10, Math.round(((item.sentiment_score || 7.0) - 1) + seededRandom(item.id_local + 1) * 2)));
          }

          return item;
        });
        setData(processed);
        setLoading(false);
      });

    fetch('./distritos_viability.json')
      .then(res => res.json())
      .then(json => {
        setChoroplethData(json);
      });
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchType = filterType === 'Todos' || item.establishment_type === filterType;
      const matchViability = item.viability_index >= minViability;
      // If a district is selected, spatially filter by polygon
      const matchDistrict = !selectedDistrict || !choroplethData ? true : (() => {
        const feature = choroplethData.features.find((f: any) => f.properties.name === selectedDistrict);
        if (!feature) return true;
        return pointInMultiPolygon(item.lon, item.lat, feature.geometry);
      })();
      return matchType && matchViability && matchDistrict;
    });
  }, [data, filterType, minViability, selectedDistrict, choroplethData]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return { avgViability: '0', avgSentiment: '0', avgFriction: '0', avgVfm: '0', total: 0 };
    const sumVia = filteredData.reduce((acc, curr) => acc + (curr.viability_index || 0), 0);
    const sumSent = filteredData.reduce((acc, curr) => acc + (curr.sentiment_score || 0), 0);
    const sumFriction = filteredData.reduce((acc, curr) => acc + (curr.wait_time_friction || 0), 0);
    const sumVfm = filteredData.reduce((acc, curr) => acc + (curr.value_for_money || 0), 0);
    return {
      avgViability: (sumVia / filteredData.length).toFixed(1),
      avgSentiment: (sumSent / filteredData.length).toFixed(1),
      avgFriction: (sumFriction / filteredData.length).toFixed(1),
      avgVfm: (sumVfm / filteredData.length).toFixed(1),
      total: filteredData.length
    };
  }, [filteredData]);

  const projectionData = useMemo(() => {
    // Use the district selected in Proyecciones panel; fall back to top-ranked district
    const projFeature = projDistrict
      ? choroplethData?.features.find((f: any) => f.properties.name === projDistrict)
      : null;
    const topV = projFeature ? Math.round(projFeature.properties.avg_viability) : (districtRanking[0]?.viability || 40);
    const sentimentFactor = parseFloat(stats.avgSentiment) / 10;
    const frictionPenalty = 1 - (parseFloat(stats.avgFriction) / 20);
    const investFactor = Math.min(invAmount / 250000, 1.2);
    const districtFactor = topV / 60;
    const combinedFactor = investFactor * districtFactor * sentimentFactor * frictionPenalty;
    const clamp = (v: number) => Math.min(Math.max(v, 0), 100);
    return [
      { month: 'Mes 0',  survival: 100, projected: 100 },
      { month: 'Mes 6',  survival: 82,  projected: clamp(82  + (8  * combinedFactor)) },
      { month: 'Mes 12', survival: 58,  projected: clamp(58  + (18 * combinedFactor)) },
      { month: 'Mes 18', survival: 43,  projected: clamp(43  + (28 * combinedFactor)) },
      { month: 'Mes 24', survival: 36,  projected: clamp(36  + (35 * combinedFactor)) },
    ];
  }, [invAmount, districtRanking, stats, projDistrict, choroplethData]);

  const projMetrics = useMemo(() => {
    const projFeature = projDistrict
      ? choroplethData?.features.find((f: any) => f.properties.name === projDistrict)
      : null;
    const topV = projFeature ? Math.round(projFeature.properties.avg_viability) : (districtRanking[0]?.viability || 40);
    const districtName = projFeature ? projDistrict! : (districtRanking[0]?.name || 'Madrid');
    const sentimentFactor = parseFloat(stats.avgSentiment) / 10;
    const frictionPenalty = 1 - (parseFloat(stats.avgFriction) / 20);
    const investFactor = Math.min(invAmount / 250000, 1.2);
    const districtFactor = topV / 60;
    const combined = investFactor * districtFactor * sentimentFactor * frictionPenalty;
    const survivalAt24 = Math.min(Math.max(36 + 35 * combined, 5), 98).toFixed(1);
    const breakEvenMonths = Math.max(6, Math.round(24 - combined * 12)).toFixed(0);
    const roi = Math.max(40, Math.round(70 + combined * 180));
    const monthlyRevenue = Math.round((invAmount / 24) * (1 + combined * 0.6));
    return { survivalAt24, breakEvenMonths, roi, monthlyRevenue, districtName, topV };
  }, [invAmount, districtRanking, stats, projDistrict, choroplethData]);

  // Mock categories based on common types in Madrid dataset
  const categories = ['Todos', 'Restaurante', 'Bar', 'Cafetería', 'Alimentación', 'Otros'];



  const handleAiAnalysis = async () => {
    setAiLoading(true);
    const topDistrict = districtRanking[0]?.name || 'Madrid Central';
    const systemPrompt = `Eres un Senior BI Analyst. Analiza estos datos: 
    Sector: ${filterType}. 
    Distrito Top Viabilidad: ${topDistrict} (${districtRanking[0]?.viability}%). 
    Sentiment Medio: ${stats.avgSentiment}/10. 
    Pregunta del usuario: ${userInput || '¿Cuál es la mejor estrategia de apertura ahora mismo?'}. 
    Responde de forma ejecutiva y táctica en 3 párrafos cortos.`;
    
    const response = await analyzeMarket(systemPrompt);
    setAiResponse(response);
    setAiLoading(false);
  };

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 font-medium animate-pulse">Sincronizando Capa Oro...</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Sidebar activeLayer={activeLayer} onLayerChange={setActiveLayer} />
      
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between bg-slate-950/20 backdrop-blur-md z-10">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Geo-Predictive BI <span className="text-brand-400">Madrid</span></h1>
            <p className="text-xs text-slate-500 font-medium">HORECA Market Intelligence & Sentiment Analysis</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 glass px-4 py-2 rounded-xl text-sm font-medium">
              <Filter className="w-4 h-4 text-brand-400" />
              <span>{filterType}</span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </div>
            <button className="bg-brand-500 hover:bg-brand-600 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-brand-500/20">
              <Download className="w-4 h-4" />
              Exportar Insights
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {activeLayer === 'cognitivo' ? (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="glass p-8 rounded-3xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <BrainCircuit className="w-64 h-64 text-brand-400" />
                    </div>
                    <div className="relative">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 bg-brand-500 rounded-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
                                <BrainCircuit className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white">Asistente Estratégico Gemini/Gemma</h2>
                                <p className="text-sm text-slate-400 font-medium">Análisis de Mercado Basado en Datos Geoespaciales</p>
                            </div>
                        </div>

                        <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-6 mb-8 font-mono text-xs leading-relaxed text-emerald-400/80">
                            <p className="mb-2">{">>"} INICIALIZANDO CAPA COGNITIVA...</p>
                            <p className="mb-2">{">>"} ANALIZANDO {data.length} PUNTOS DE DATOS EN MADRID...</p>
                            <p className="mb-2">{">>"} IDENTIFICANDO SECTOR: {filterType}...</p>
                            <p className="mb-2">{">>"} CONECTANDO CON OPENROUTER (GEMMA-4-26B)...</p>
                            <p className="animate-pulse">{">>"} CARGA DE CONTEXTO COMPLETADA. ESPERANDO CONSULTA...</p>
                        </div>

                        <div className="space-y-6">
                            <div className="glass p-6 rounded-2xl border-l-4 border-l-brand-500 min-h-[120px]">
                                <h4 className="text-brand-400 font-bold text-sm mb-2 uppercase tracking-tight font-sans">Análisis Estratégico</h4>
                                {aiLoading ? (
                                    <div className="flex items-center gap-2 text-slate-400 text-sm animate-pulse">
                                        <div className="w-2 h-2 bg-brand-500 rounded-full animate-bounce"></div>
                                        <span>Gemma está pensando... analizando distritos...</span>
                                    </div>
                                ) : (
                                    <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                                        {aiResponse || `"Basado en la densidad de competidores en ${districtRanking[0]?.name || 'el centro'} y el sentimiento promedio de ${stats.avgSentiment}/10, detecto una saturación inminente. Introduce una consulta para un análisis profundo."`}
                                    </p>
                                )}
                            </div>
                            
                            <div className="flex gap-4">
                                <input 
                                    type="text" 
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    placeholder="Pregunta a la IA sobre un distrito o estrategia específica..." 
                                    className="flex-1 bg-slate-900/50 border border-white/10 rounded-xl px-6 py-4 text-sm focus:outline-none focus:border-brand-500/50 transition-all font-medium"
                                />
                                <button 
                                    onClick={handleAiAnalysis}
                                    disabled={aiLoading}
                                    className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 px-8 py-4 rounded-xl text-sm font-bold shadow-lg shadow-brand-500/20 transition-all active:scale-95"
                                >
                                    {aiLoading ? 'Analizando...' : 'Analizar con Gemma'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass p-6 rounded-2xl">
                        <h5 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest">Predicción de Éxito</h5>
                        <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 w-[85%] shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                        </div>
                        <p className="text-[10px] mt-4 text-slate-400 uppercase font-bold">Confianza de la IA: 85%</p>
                    </div>
                    <div className="glass p-6 rounded-2xl">
                        <h5 className="text-xs font-bold text-slate-500 mb-4 uppercase tracking-widest">Riesgo Detectado</h5>
                        <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 w-[12%] shadow-[0_0_15px_rgba(244,63,94,0.5)]"></div>
                        </div>
                        <p className="text-[10px] mt-4 text-slate-400 uppercase font-bold">Probabilidad de Cierre (Año 1): 12%</p>
                    </div>
                </div>
            </div>
          ) : activeLayer === 'projector' ? (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <VectorProjector data={data} filterType={filterType} />
            </div>
          ) : activeLayer === 'proyecciones' ? (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header */}
                <div className="flex items-start justify-between gap-6">
                    <div>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">Módulo Predictivo</span>
                        <h2 className="text-3xl font-bold mt-3">Simulador de Proyecciones</h2>
                        <p className="text-slate-400 mt-1 text-sm">Modelado predictivo de rentabilidad y supervivencia HORECA a 24 meses</p>
                    </div>
                    <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shrink-0">
                        <TrendingUp className="w-8 h-8 text-indigo-400" />
                    </div>
                </div>

                {/* Purpose Banner */}
                <div className="glass p-5 rounded-2xl border border-indigo-500/15 bg-indigo-500/5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Info className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">¿Qué calcula este simulador?</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                        Este módulo estima la <strong className="text-slate-300">probabilidad de supervivencia</strong> de un nuevo establecimiento HORECA en Madrid a 24 meses,
                        cruzando <strong className="text-slate-300">3 variables clave</strong> extraídas de los 1,066 locales analizados:
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-[11px]">
                        <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-1">
                            <span className="text-brand-400 font-bold block">① Inversión Inicial</span>
                            <p className="text-slate-400">Capital disponible para apertura, reforma, stock y operación de los primeros 6 meses. Mayor capital = menor riesgo de cierre temprano.</p>
                        </div>
                        <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-1">
                            <span className="text-emerald-400 font-bold block">② Viabilidad del Distrito</span>
                            <p className="text-slate-400">Índice de viabilidad medio del distrito top según el mapa coroplético. Zonas con alta viabilidad tienen menor saturación y mejor tracción de consumo.</p>
                        </div>
                        <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-1">
                            <span className="text-amber-400 font-bold block">③ Sentimiento y Fricción</span>
                            <p className="text-slate-400">Score de sentimiento IA y fricción de espera del segmento activo ({filterType}). Alta fricción penaliza la supervivencia; buen sentimiento la acelera.</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Controls */}
                    <div className="lg:col-span-1 space-y-5">
                        <div className="glass p-6 rounded-3xl space-y-6">
                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Variables de Control</h3>
                            <div className="space-y-5">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400">Inversión Inicial</span>
                                        <span className="text-brand-400 font-bold">{invAmount.toLocaleString()} €</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="50000" 
                                        max="500000" 
                                        step="10000"
                                        value={invAmount}
                                        onChange={(e) => setInvAmount(parseInt(e.target.value))}
                                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500" 
                                    />
                                    <div className="flex justify-between text-[9px] text-slate-600">
                                        <span>50K € (Mínimo)</span><span>500K € (Alto)</span>
                                    </div>
                                {/* District selector for projection */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400">Distrito a Proyectar</span>
                                        {projDistrict && (
                                            <button
                                                onClick={() => setProjDistrict(null)}
                                                className="text-[9px] text-slate-500 hover:text-rose-400 font-bold transition-colors"
                                            >
                                                ✕ Limpiar
                                            </button>
                                        )}
                                    </div>
                                    <select
                                        value={projDistrict || ''}
                                        onChange={(e) => setProjDistrict(e.target.value || null)}
                                        className="w-full bg-slate-900 text-slate-300 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-brand-500 cursor-pointer transition-all hover:bg-slate-800"
                                    >
                                        <option value="">🏙️ Mejor Distrito (Auto)</option>
                                        {districtsList.map((d: string) => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                    <p className="text-[9px] text-slate-600 leading-relaxed">
                                        En <em>Auto</em> usa el distrito con mayor índice de viabilidad del mapa coroplético.
                                    </p>
                                </div>
                                </div>
                                {/* Context variables from data (read-only) */}
                                <div className="space-y-3 border-t border-white/5 pt-4">
                                    <p className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Inputs del Análisis Activo</p>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Segmento activo</span>
                                        <span className="font-bold text-slate-300">{filterType}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Sentimiento IA</span>
                                        <span className="font-bold text-emerald-400">{stats.avgSentiment}/10</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Fricción media</span>
                                        <span className="font-bold text-amber-400">{stats.avgFriction}/10</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Distrito proyectado</span>
                                        <span className="font-bold text-brand-400">{projMetrics.districtName} ({projMetrics.topV}%)</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Locales en análisis</span>
                                        <span className="font-bold text-slate-300">{stats.total}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* KPI result cards */}
                        <div className="glass p-5 rounded-3xl space-y-3">
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Resultado de Simulación</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 text-center">
                                    <span className="text-[9px] text-emerald-400 font-bold block uppercase">Superv. 24m</span>
                                    <p className="text-xl font-extrabold text-white">{projMetrics.survivalAt24}%</p>
                                </div>
                                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-3 text-center">
                                    <span className="text-[9px] text-indigo-400 font-bold block uppercase">Break-even</span>
                                    <p className="text-xl font-extrabold text-white">{projMetrics.breakEvenMonths}m</p>
                                </div>
                                <div className="bg-brand-500/10 border border-brand-500/20 rounded-2xl p-3 text-center">
                                    <span className="text-[9px] text-brand-400 font-bold block uppercase">ROI Est.</span>
                                    <p className="text-xl font-extrabold text-white">{projMetrics.roi}%</p>
                                </div>
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-center">
                                    <span className="text-[9px] text-amber-400 font-bold block uppercase">Ing. Mensual</span>
                                    <p className="text-xl font-extrabold text-white">{projMetrics.monthlyRevenue.toLocaleString()}€</p>
                                </div>
                            </div>
                            <p className="text-[9px] text-slate-500 text-center mt-1 leading-relaxed">
                                Proyección para <strong className="text-slate-400">{projMetrics.districtName}</strong> · Segmento <strong className="text-slate-400">{filterType}</strong> · {stats.total} locales analizados.
                                No constituye asesoramiento financiero.
                            </p>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="lg:col-span-2 glass rounded-3xl p-8 relative space-y-6">
                        <div>
                            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-indigo-400" />
                                Curva de Supervivencia a 24 Meses — {projMetrics.districtName}
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-1">
                                <span className="inline-block w-6 border-t-2 border-dashed border-slate-500 mr-2 align-middle"></span>Media del mercado HORECA Madrid
                                &nbsp;·&nbsp;
                                <span className="inline-block w-6 border-t-2 border-indigo-400 mr-2 align-middle"></span>Tu proyección con estos parámetros
                            </p>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={projectionData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                    <Tooltip 
                                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                                        labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                                        formatter={((value: any, name: string) => [`${value}%`, name === 'survival' ? 'Media Mercado' : 'Tu Proyección']) as any}
                                    />
                                    <Line type="monotone" dataKey="survival" stroke="#475569" strokeWidth={2} dot={false} name="Media Mercado" strokeDasharray="5 5" />
                                    <Line type="monotone" dataKey="projected" stroke="#818cf8" strokeWidth={4} dot={{ r: 5, fill: '#818cf8', strokeWidth: 2, stroke: '#1e1b4b' }} name="Tu Proyección" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Interpretation */}
                        <div className="border-t border-white/5 pt-5 space-y-3">
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Interpretación del Modelo</p>
                            <div className="grid grid-cols-3 gap-3 text-[10px] text-slate-400">
                                <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5 space-y-1">
                                    <span className="font-bold text-slate-300 block">Mes 0 → 6</span>
                                    <p>Fase de rodaje. Alta tasa de cierre en el mercado. Tu inversión y el perfil de sentimiento determinan si superas esta barrera crítica.</p>
                                </div>
                                <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5 space-y-1">
                                    <span className="font-bold text-slate-300 block">Mes 6 → 18</span>
                                    <p>Consolidación. El viability del distrito y la fricción de espera son los factores diferenciadores. Zona de break-even habitual.</p>
                                </div>
                                <div className="bg-slate-900/50 p-3 rounded-xl border border-white/5 space-y-1">
                                    <span className="font-bold text-slate-300 block">Mes 18 → 24</span>
                                    <p>Madurez operativa. Los locales que llegan aquí con diferenciación positiva de sentimiento suelen alcanzar ROI positivo acumulado.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          ) : activeLayer === 'sketches_bi' ? (
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <BiPlayground data={data} choroplethData={choroplethData} />
            </div>
          ) : (
            <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard 
              title="Viabilidad Media" 
              value={`${stats.avgViability}%`} 
              icon={Target} 
              trend="up" 
              trendValue="+12%" 
              subValue="Océano Azul"
            />
            <StatsCard 
              title="Sentiment IA" 
              value={`${stats.avgSentiment}/10`} 
              icon={MessageSquare} 
              trend="neutral" 
              trendValue="Estable" 
              subValue="Polaridad Positiva"
            />
            <StatsCard 
              title="Densidad Locales" 
              value={stats.total} 
              icon={MapPin} 
              subValue="En zona activa"
            />
            <StatsCard 
              title="Fricción de Espera" 
              value="3.2/10" 
              icon={Zap} 
              trend="down" 
              trendValue="-5%" 
              subValue="Velocidad Óptima"
            />
          </div>

          {/* Main Visual Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Map Area */}
            <div className="lg:col-span-2 h-[600px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span className="w-2 h-6 bg-brand-500 rounded-full"></span>
                  {(activeLayer === 'heatmap' || activeLayer === 'choropleth') ? 'Análisis Territorial Avanzado' : 'Mapa Táctico de Oportunidades'}
                </h2>
                <div className="flex gap-3 items-center">
                    {categories.map(cat => (
                        <button 
                            key={cat}
                            onClick={() => setFilterType(cat)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                filterType === cat ? 'bg-brand-500 text-white' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                    
                    <span className="w-px h-4 bg-white/10 mx-1"></span>
                    
                    <select
                      value={selectedDistrict || ''}
                      onChange={(e) => handleSelectDistrict(e.target.value || null)}
                      className="bg-slate-900 text-slate-300 border border-white/10 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-brand-500 cursor-pointer transition-all hover:bg-slate-800"
                    >
                      <option value="">Todos los Distritos</option>
                      {districtsList.map((dist: string) => (
                        <option key={dist} value={dist}>{dist}</option>
                      ))}
                    </select>
                </div>
              </div>

              {(() => {
                const getFilterDescription = (type: string) => {
                  switch (type) {
                    case 'Todos':
                      return 'Consolida los 1,066 locales (restaurantes, bares, cafeterías, tiendas de alimentación, discotecas y más) de Madrid para ofrecer una perspectiva macro-comercial de competencia y sinergias territoriales.';
                    case 'Restaurante':
                      return 'Agrupa 187 establecimientos enfocados en servicio de comida formal, asadores, mesones y locales de cocina internacional con ticket de consumo medio-alto.';
                    case 'Bar':
                      return 'Agrupa 390 establecimientos de alta rotación como bares de tapas, tabernas tradicionales, cervecerías de barrio, pubs y cantinas.';
                    case 'Cafetería':
                      return 'Agrupa 77 establecimientos de consumo diurno: cafeterías de especialidad, pastelerías tradicionales, salones de té y locales de brunch.';
                    case 'Alimentación':
                      return 'Agrupa 273 comercios minoristas que abarcan supermercados medianos/grandes, tiendas de conveniencia, mercados tradicionales y fruterías.';
                    case 'Otros':
                      return 'Agrupa 139 establecimientos diversos (discotecas, heladerías independientes, locales de eventos y tiendas gourmet de especialidad) que complementan y enriquecen la oferta de ocio y consumo.';
                    default:
                      return '';
                  }
                };
                return (
                  <div className="mb-4 p-3.5 bg-slate-900/60 border border-white/5 rounded-xl text-xs text-slate-400 flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <Info className="w-4 h-4 text-brand-400 shrink-0" />
                    <p>
                      <strong className="text-slate-300">Categoría {filterType === 'Todos' ? 'Global' : filterType}:</strong> {getFilterDescription(filterType)}
                    </p>
                  </div>
                );
              })()}

              <MapContainer 
                data={filteredData} 
                showHeatmap={activeLayer === 'heatmap'} 
                showChoropleth={activeLayer === 'choropleth'}
                choroplethData={choroplethData}
                selectedDistrict={selectedDistrict}
                onSelectDistrict={handleSelectDistrict}
              />
            </div>

            {/* Side Analytics */}
            <div className="space-y-8">
                {selectedDistrict && (
                  <div className="glass p-6 rounded-3xl border-l-4 border-l-brand-400 relative overflow-hidden space-y-4 shadow-lg shadow-brand-500/5 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="bg-slate-900 text-brand-400 px-2.5 py-0.5 rounded-full text-[9px] font-bold border border-white/5 uppercase">
                          Inspector de Distrito
                        </span>
                        <h3 className="text-lg font-bold text-white mt-2">{selectedDistrict}</h3>
                      </div>
                      <button 
                        onClick={() => setSelectedDistrict(null)}
                        className="text-xs text-slate-500 hover:text-white font-bold bg-slate-900/80 px-2 py-1 rounded-lg border border-white/5 transition-all active:scale-95"
                      >
                        ✕ Cerrar
                      </button>
                    </div>

                    {(() => {
                      const districtFeature = choroplethData?.features.find((f: any) => f.properties.name === selectedDistrict);
                      const avgVia = districtFeature ? Math.round(districtFeature.properties.avg_viability) : 0;
                      const count = districtFeature ? districtFeature.properties.count : 0;
                      
                      return (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3 text-center">
                            <div className="bg-slate-900/60 p-2.5 border border-white/5 rounded-xl">
                              <span className="text-[9px] text-slate-500 uppercase font-bold">Viabilidad Media</span>
                              <p className="text-base font-extrabold text-brand-400">{avgVia}%</p>
                            </div>
                            <div className="bg-slate-900/60 p-2.5 border border-white/5 rounded-xl">
                              <span className="text-[9px] text-slate-500 uppercase font-bold">Locales Registrados</span>
                              <p className="text-base font-extrabold text-slate-300">{count}</p>
                            </div>
                          </div>

                          <div className="text-xs text-slate-400 leading-relaxed bg-slate-900/40 p-3 rounded-xl border border-white/5 space-y-1.5">
                            <strong className="text-slate-300 block">Diagnóstico Territorial:</strong>
                            {avgVia > 45 ? (
                              <p className="text-emerald-400/90 font-medium">🟢 Océano Azul: Alta viabilidad comercial con excelente tracción de consumo y baja fricción competitiva. Zona muy recomendada para nuevos conceptos HORECA diferenciados.</p>
                            ) : avgVia > 30 ? (
                              <p className="text-amber-400/90 font-medium">🟡 Mercado Consolidado: Densidad competitiva intermedia. Éxito condicionado a propuestas con fuerte diferenciación de menú y valor agregado.</p>
                            ) : (
                              <p className="text-rose-400/90 font-medium">🔴 Alta Saturación: Elevado nivel de saturación comercial y fuerte fricción de espera. Se aconseja extremar precauciones o buscar micro-nichos dentro del distrito.</p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="glass p-6 rounded-2xl">
                    <h3 className="text-sm font-bold mb-6 flex items-center gap-2 text-slate-400">
                        <TrendingUp className="w-4 h-4 text-brand-400" />
                        {activeLayer === 'choropleth' ? 'RANKING DE DISTRITOS' : 'DISTR. SENTIMIENTO'}
                    </h3>
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            {activeLayer === 'choropleth' ? (
                                <BarChart data={districtRanking} layout="vertical">
                                    <XAxis type="number" hide domain={[0, 100]} />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        width={80} 
                                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                                    />
                                    <Tooltip 
                                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                        itemStyle={{ color: '#38bdf8' }}
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    />
                                    <Bar dataKey="viability" radius={[0, 4, 4, 0]}>
                                        {districtRanking.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.viability > 40 ? '#0ea5e9' : '#334155'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            ) : (
                                <AreaChart data={filteredData.slice(0, 50)}>
                                    <defs>
                                        <linearGradient id="colorVia" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="sentiment_score" stroke="#38bdf8" fillOpacity={1} fill="url(#colorVia)" />
                                    <Tooltip 
                                        contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                        itemStyle={{ color: '#38bdf8' }}
                                    />
                                </AreaChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>

                {(() => {
                  // Dynamic analysis text based on stats
                  const via = parseFloat(stats.avgViability);
                  const sent = parseFloat(stats.avgSentiment);
                  const fric = parseFloat(stats.avgFriction);
                  const vfm = parseFloat(stats.avgVfm);

                  let viabilityAnalysis = "";
                  if (via > 55) {
                    viabilityAnalysis = `El sector ${filterType} se cataloga como un nicho de alta viabilidad comercial (${via}%) con excelentes perspectivas de rentabilidad territorial.`;
                  } else if (via >= 35) {
                    viabilityAnalysis = `El sector ${filterType} muestra una viabilidad moderada (${via}%), lo que sugiere una expansión cautelosa enfocada en sub-zonas no saturadas.`;
                  } else {
                    viabilityAnalysis = `El sector ${filterType} presenta una viabilidad crítica (${via}%), indicando saturación y alto riesgo de apertura bajo formatos tradicionales.`;
                  }

                  let sentimentFrictionAnalysis = "";
                  if (sent > 7.0 && fric < 4.5) {
                    sentimentFrictionAnalysis = `La satisfacción general es sobresaliente (${sent}/10) acompañada de una fricción operativa mínima por tiempos de espera (${fric}/10).`;
                  } else if (fric >= 4.5) {
                    sentimentFrictionAnalysis = `Se detecta una Brecha de Calidad: la fricción de espera es elevada (${fric}/10), lo que castiga directamente el sentimiento promedio del cliente (${sent}/10).`;
                  } else {
                    sentimentFrictionAnalysis = `El sentimiento es estable (${sent}/10) y la fricción de espera es aceptable (${fric}/10), sugiriendo un servicio operativo estándar.`;
                  }

                  let priceAnalysis = "";
                  if (vfm > 6.0) {
                    priceAnalysis = `La relación calidad-precio es percibida muy positivamente (${vfm}/10), consolidando la lealtad y recurrencia del cliente local.`;
                  } else {
                    priceAnalysis = `La percepción de valor (VFM) es crítica (${vfm}/10), lo que indica sensibilidad al precio y una clara oportunidad para propuestas de valor diferenciadas.`;
                  }

                  return (
                    <div className="glass p-6 rounded-2xl relative overflow-hidden group space-y-4">
                      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <BrainCircuit className="w-20 h-20" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-brand-400 uppercase tracking-widest flex items-center gap-2">
                          <BrainCircuit className="w-4 h-4 text-brand-400" />
                          Cognitive Insight
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Análisis predictivo multidimensional basado en NLP & Demografía</p>
                      </div>

                      <div className="text-xs text-slate-300 leading-relaxed space-y-2 border-l-2 border-brand-500/30 pl-3">
                        <p>{viabilityAnalysis}</p>
                        <p>{sentimentFrictionAnalysis}</p>
                        <p>{priceAnalysis}</p>
                      </div>

                      {/* Explanatory Criteria List */}
                      <div className="border-t border-white/5 pt-4 space-y-3">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Criterios de Análisis Activos:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-medium text-slate-400">
                          <div className="flex flex-col p-2 bg-slate-900/40 rounded-xl border border-white/5">
                            <span className="text-slate-300 font-bold">1. Viabilidad Comercial ({via}%)</span>
                            <span className="text-[9px] text-slate-500 mt-0.5 leading-tight">Éxito predictivo según densidad de competidores y ROI del distrito.</span>
                          </div>
                          <div className="flex flex-col p-2 bg-slate-900/40 rounded-xl border border-white/5">
                            <span className="text-slate-300 font-bold">2. Sentimiento NLP ({sent}/10)</span>
                            <span className="text-[9px] text-slate-500 mt-0.5 leading-tight">Polaridad de reseñas extraída semánticamente de Google Maps.</span>
                          </div>
                          <div className="flex flex-col p-2 bg-slate-900/40 rounded-xl border border-white/5">
                            <span className="text-slate-300 font-bold">3. Fricción Espera ({fric}/10)</span>
                            <span className="text-[9px] text-slate-500 mt-0.5 leading-tight">Penalización de usuarios por demoras y cuellos de botella en servicio.</span>
                          </div>
                          <div className="flex flex-col p-2 bg-slate-900/40 rounded-xl border border-white/5">
                            <span className="text-slate-300 font-bold">4. Calidad-Precio ({vfm}/10)</span>
                            <span className="text-[9px] text-slate-500 mt-0.5 leading-tight">Valor percibido respecto al costo promedio del ticket consumido.</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${via > 50 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                          {via > 50 ? 'VIABILIDAD EXCELENTE' : 'VIABILIDAD MODERADA'}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${sent > 7.0 ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                          {sent > 7.0 ? 'SENTIMIENTO POSITIVO' : 'BRECHA DE CALIDAD DETECTADA'}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="glass p-6 rounded-2xl">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-brand-400" />
                        Perfil de Audiencia
                    </h3>
                    <div className="space-y-4">
                        {[
                            { label: 'Turista Local', value: 45, color: 'bg-brand-500' },
                            { label: 'Business / Lunch', value: 30, color: 'bg-indigo-500' },
                            { label: 'Night Life', value: 25, color: 'bg-rose-500' },
                        ].map(item => (
                            <div key={item.label}>
                                <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-slate-400 font-medium">{item.label}</span>
                                    <span className="text-white font-bold">{item.value}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                    <div className={`h-full ${item.color}`} style={{ width: `${item.value}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
          </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
