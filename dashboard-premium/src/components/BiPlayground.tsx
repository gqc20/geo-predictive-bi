import { useState, useMemo } from 'react';
import type { FC } from 'react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, ScatterChart, Scatter, PieChart, Pie,
  Legend
} from 'recharts';

/* ─── Spatial helper (same as App.tsx) ─────────────────────────────────── */
function pointInRing(lat: number, lon: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const ok = ((yi > lon) !== (yj > lon)) && (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
    if (ok) inside = !inside;
  }
  return inside;
}
function ptInGeo(lat: number, lon: number, geo: any): boolean {
  if (!geo) return false;
  const c = geo.coordinates;
  if (geo.type === 'Polygon') return pointInRing(lat, lon, c[0]);
  if (geo.type === 'MultiPolygon') return c.some((p: number[][][]) => pointInRing(lat, lon, p[0]));
  return false;
}

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface BiPlaygroundProps { data: any[]; choroplethData: any; }

/* ─── Palettes ───────────────────────────────────────────────────────────── */
const PBI_COLORS = ['#F2C811', '#4182e6', '#228B22', '#d6436e', '#a66999', '#e8823b'];
const TAB_COLORS = ['#E87624', '#2F7ED8', '#8bbc21', '#910000', '#1aadce', '#492970'];
const LKR_COLORS = ['#4285F4', '#34A853', '#FBBC04', '#EA4335', '#9C27B0', '#00BCD4'];

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export const BiPlayground: FC<BiPlaygroundProps> = ({ data, choroplethData }) => {
  const [activeTool, setActiveTool] = useState<'powerbi' | 'tableau' | 'looker'>('powerbi');
  const [districtFilter, setDistrictFilter] = useState('Todos');
  const [typeFilter, setTypeFilter] = useState('Todos');
  const [tableauTab, setTableauTab] = useState<'sheet1' | 'sheet2' | 'dashboard'>('dashboard');

  /* ── Enrich each local with its district via spatial join ── */
  const enriched = useMemo(() => {
    if (!data?.length) return [];
    return data.map(item => {
      let dist = 'Otros';
      if (choroplethData?.features) {
        for (const f of choroplethData.features) {
          if (ptInGeo(item.lon, item.lat, f.geometry)) { dist = f.properties.name; break; }
        }
      }
      return { ...item, calculatedDistrict: dist };
    });
  }, [data, choroplethData]);

  const districts = useMemo(() => ['Todos', ...Array.from(new Set(enriched.map(d => d.calculatedDistrict))).sort()], [enriched]);
  const types = useMemo(() => ['Todos', ...Array.from(new Set(enriched.map(d => d.establishment_type).filter(Boolean))).sort()], [enriched]);

  const filtered = useMemo(() => enriched.filter(d =>
    (districtFilter === 'Todos' || d.calculatedDistrict === districtFilter) &&
    (typeFilter === 'Todos' || d.establishment_type === typeFilter)
  ), [enriched, districtFilter, typeFilter]);

  const kpis = useMemo(() => {
    if (!filtered.length) return { count: 0, avgVia: 0, avgSent: '0.0' };
    const count = filtered.length;
    return {
      count,
      avgVia: Math.round(filtered.reduce((a, c) => a + (c.viability_index || 0), 0) / count),
      avgSent: (filtered.reduce((a, c) => a + (c.sentiment_score || 0), 0) / count).toFixed(1),
    };
  }, [filtered]);

  const byType = useMemo(() => {
    const g: Record<string, { count: number; sumVia: number; sumSent: number }> = {};
    filtered.forEach(d => {
      const t = d.establishment_type || 'Otros';
      if (!g[t]) g[t] = { count: 0, sumVia: 0, sumSent: 0 };
      g[t].count++; g[t].sumVia += d.viability_index || 0; g[t].sumSent += d.sentiment_score || 0;
    });
    return Object.entries(g).map(([name, v]) => ({
      name, count: v.count,
      via: Math.round(v.sumVia / v.count),
      sent: +(v.sumSent / v.count).toFixed(1),
    }));
  }, [filtered]);

  const scatterData = useMemo(() => filtered.slice(0, 300).map(d => ({
    x: d.lon, y: d.lat,
    z: d.viability_index,
    name: d.name,
    via: d.viability_index,
    sent: d.sentiment_score,
  })), [filtered]);

  return (
    <div className="w-full space-y-5">
      {/* ── Tool Switcher ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-white/5 rounded-2xl p-4">
        <div>
          <h2 className="text-lg font-bold text-white">🖥️ BI Corporate Playground</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Simulaciones ultra-fieles de herramientas BI líderes — 100% estático, compatible con GitHub Pages.</p>
        </div>
        <div className="flex gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-white/5 shrink-0">
          {([['powerbi','📊 Power BI','#F2C811','#1a1a1a'],
             ['tableau','📈 Tableau','#E87624','#fff'],
             ['looker','📉 Looker Studio','#4285F4','#fff']] as const).map(([id, label, bg, fg]) => (
            <button
              key={id}
              onClick={() => setActiveTool(id)}
              style={activeTool === id ? { background: bg, color: fg } : {}}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTool === id ? 'shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          POWER BI MOCKUP
      ═══════════════════════════════════════════════════════ */}
      {activeTool === 'powerbi' && (
        <div className="rounded-xl overflow-hidden border border-[#333] shadow-2xl animate-in fade-in duration-300" style={{ fontFamily: 'Segoe UI, system-ui, sans-serif', background: '#201F1F' }}>

          {/* Title bar */}
          <div style={{ background: '#1b1a1a', borderBottom: '1px solid #333' }} className="flex items-center justify-between px-4 h-8">
            <div className="flex items-center gap-2 text-[11px] text-[#c8c8c8]">
              <span style={{ background: '#F2C811', color: '#000' }} className="font-extrabold text-[9px] px-1.5 py-0.5 rounded-sm">PBI</span>
              <span className="font-semibold">Power BI Desktop — Geo_BI_Madrid_Analysis.pbix</span>
            </div>
            <div className="flex gap-3 text-[#666] text-[10px]">
              <span>─</span><span>□</span><span className="text-red-400">✕</span>
            </div>
          </div>

          {/* Ribbon */}
          <div style={{ background: '#262525', borderBottom: '1px solid #333' }} className="flex items-end">
            {['Archivo', 'Inicio', 'Insertar', 'Modelado', 'Ver', 'Optimizar', 'Ayuda'].map((tab, i) => (
              <div
                key={tab}
                style={i === 1 ? { borderBottom: '2px solid #F2C811', color: '#F2C811' } : { color: '#c8c8c8' }}
                className="px-4 py-2 text-[11px] font-medium cursor-default hover:bg-white/5 transition-colors"
              >{tab}</div>
            ))}
          </div>

          {/* Ribbon toolbar (Home) */}
          <div style={{ background: '#252424', borderBottom: '1px solid #2d2d2d' }} className="flex items-center gap-6 px-4 py-1.5">
            {[
              ['📋', 'Pegar'],['✂️', 'Cortar'],['📑', 'Copiar'],
              ['|', ''],
              ['📊', 'Nuevo visual'],['📝', 'Cuadro texto'],['📐', 'Forma'],
              ['|', ''],
              ['🔍', 'Obtener datos'],['🔄', 'Actualizar'],
            ].map(([icon, label], i) => (
              icon === '|'
                ? <div key={i} className="w-px h-6 bg-[#444]" />
                : <button key={i} className="flex flex-col items-center gap-0.5 px-2 py-1 rounded hover:bg-white/8 transition-colors">
                    <span className="text-base leading-none">{icon}</span>
                    <span className="text-[9px] text-[#a0a0a0]">{label}</span>
                  </button>
            ))}
          </div>

          {/* Main layout */}
          <div className="flex" style={{ height: '660px' }}>

            {/* Canvas */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4" style={{ background: '#201F1F' }}>
              {/* Report title */}
              <div className="text-[10px] text-[#a0a0a0] font-semibold tracking-wider uppercase mb-2">Madrid HORECA — Reporte de Viabilidad Comercial</div>

              {/* KPI Cards row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Locales en Muestra', value: kpis.count, unit: '', color: '#F2C811' },
                  { label: 'Viabilidad Media', value: `${kpis.avgVia}%`, unit: 'vs. Objetivo 40%', color: '#228B22' },
                  { label: 'Sentiment Score', value: `${kpis.avgSent}`, unit: '/10 — IA Cognitiva', color: '#4182e6' },
                ].map(card => (
                  <div key={card.label} style={{ background: '#2a2a2a', borderLeft: `3px solid ${card.color}`, border: '1px solid #353535' }} className="p-4 rounded-sm">
                    <div className="text-[9px] text-[#808080] uppercase tracking-wider font-semibold mb-1">{card.label}</div>
                    <div className="text-2xl font-extrabold text-white leading-none">{card.value}</div>
                    {card.unit && <div className="text-[9px] mt-1.5 font-medium" style={{ color: card.color }}>{card.unit}</div>}
                  </div>
                ))}
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-5 gap-3">
                {/* Clustered bar */}
                <div style={{ background: '#2a2a2a', border: '1px solid #353535' }} className="col-span-3 p-4 rounded-sm">
                  <div className="text-[9px] text-[#a0a0a0] uppercase font-bold tracking-wider mb-3">Recuento de Locales y Viabilidad por Segmento</div>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byType} barSize={14}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: '#808080', fontSize: 9 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#808080', fontSize: 9 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff', fontSize: 10 }} />
                        <Bar dataKey="count" name="Cantidad" fill="#4182e6" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="via" name="Viabilidad %" radius={[2, 2, 0, 0]}>
                          {byType.map((_, i) => <Cell key={i} fill={PBI_COLORS[i % PBI_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Donut */}
                <div style={{ background: '#2a2a2a', border: '1px solid #353535' }} className="col-span-2 p-4 rounded-sm">
                  <div className="text-[9px] text-[#a0a0a0] uppercase font-bold tracking-wider mb-3">Distribución por Canal HORECA</div>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={byType} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius="45%" outerRadius="70%">
                          {byType.map((_, i) => <Cell key={i} fill={PBI_COLORS[i % PBI_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#2a2a2a', border: '1px solid #444', color: '#fff', fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Scatter map */}
              <div style={{ background: '#2a2a2a', border: '1px solid #353535' }} className="p-4 rounded-sm">
                <div className="text-[9px] text-[#a0a0a0] uppercase font-bold tracking-wider mb-2">Mapa de Dispersión Territorial — Longitud / Latitud (Madrid)</div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="2 2" stroke="#2d2d2d" />
                      <XAxis type="number" dataKey="x" name="Lon" domain={['auto', 'auto']} tick={{ fill: '#666', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(2)} />
                      <YAxis type="number" dataKey="y" name="Lat" domain={['auto', 'auto']} tick={{ fill: '#666', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(2)} />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3', stroke: '#444' }}
                        content={({ payload }) => payload?.[0] ? (
                          <div style={{ background: '#1e1e1e', border: '1px solid #444', borderRadius: 4, padding: '6px 10px', fontSize: 10, color: '#eee' }}>
                            <p className="font-bold">{payload[0]?.payload?.name}</p>
                            <p>Viabilidad: <span className="text-[#F2C811] font-bold">{payload[0]?.payload?.via}%</span></p>
                            <p>Sentimiento: {payload[0]?.payload?.sent}/10</p>
                          </div>
                        ) : null}
                      />
                      <Scatter data={scatterData} shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        const color = payload.via > 55 ? '#F2C811' : payload.via > 35 ? '#4182e6' : '#d6436e';
                        return <circle cx={cx} cy={cy} r={4} fill={color} fillOpacity={0.75} stroke={color} strokeWidth={0.5} />;
                      }} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 mt-2 text-[9px]">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block bg-[#F2C811]" />Alta viabilidad ({'>'}55%)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block bg-[#4182e6]" />Media (35-55%)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block bg-[#d6436e]" />Baja ({'<'}35%)</span>
                </div>
              </div>
            </div>

            {/* Filter pane */}
            <div style={{ width: 220, background: '#1b1a1a', borderLeft: '1px solid #2d2d2d' }} className="flex flex-col text-[11px] shrink-0">
              <div style={{ borderBottom: '1px solid #2d2d2d' }} className="px-3 py-2.5 text-[#a0a0a0] font-semibold flex items-center gap-2">
                <span>⚡</span> Filtros
              </div>
              <div className="p-3 space-y-4 overflow-y-auto flex-1">
                {/* Filters on this page */}
                <div>
                  <div className="text-[9px] text-[#666] uppercase font-bold tracking-wider mb-2">Filtros en esta página</div>
                  <div style={{ background: '#252525', border: '1px solid #353535' }} className="rounded-sm">
                    <div className="px-3 py-2 border-b border-[#333] text-[#c0c0c0] flex items-center justify-between">
                      <span>🏙️ Distrito</span>
                      <span className="text-[#666]">▾</span>
                    </div>
                    <div className="p-2 max-h-32 overflow-y-auto space-y-1">
                      {districts.map(d => (
                        <label key={d} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-1 py-0.5 rounded">
                          <input
                            type="checkbox"
                            checked={districtFilter === d || (districtFilter === 'Todos' && d === 'Todos')}
                            onChange={() => setDistrictFilter(d)}
                            className="accent-[#F2C811] w-3 h-3"
                          />
                          <span className={`text-[10px] ${districtFilter === d ? 'text-white font-semibold' : 'text-[#a0a0a0]'}`}>{d}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ background: '#252525', border: '1px solid #353535' }} className="rounded-sm">
                    <div className="px-3 py-2 border-b border-[#333] text-[#c0c0c0] flex items-center justify-between">
                      <span>🍽️ Canal HORECA</span>
                      <span className="text-[#666]">▾</span>
                    </div>
                    <div className="p-2 max-h-28 overflow-y-auto space-y-1">
                      {types.map(t => (
                        <label key={t} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-1 py-0.5 rounded">
                          <input
                            type="checkbox"
                            checked={typeFilter === t || (typeFilter === 'Todos' && t === 'Todos')}
                            onChange={() => setTypeFilter(t)}
                            className="accent-[#F2C811] w-3 h-3"
                          />
                          <span className={`text-[10px] ${typeFilter === t ? 'text-white font-semibold' : 'text-[#a0a0a0]'}`}>{t}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Status bar */}
              <div style={{ borderTop: '1px solid #2d2d2d', background: '#1b1a1a' }} className="px-3 py-1.5 text-[9px] text-[#666]">
                {kpis.count} filas · Última actualización: ahora
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div style={{ background: '#1a1919', borderTop: '1px solid #2d2d2d' }} className="flex items-center justify-between px-4 py-1 text-[9px] text-[#666]">
            <span>✔ Página 1 de 1 — Informe guardado</span>
            <span>Vista: Diseño de lectura &nbsp;|&nbsp; Actualizado: Ahora mismo</span>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          TABLEAU MOCKUP
      ═══════════════════════════════════════════════════════ */}
      {activeTool === 'tableau' && (
        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-2xl animate-in fade-in duration-300" style={{ fontFamily: '"Tableau", "Benton Sans", Arial, sans-serif', background: '#fafafa' }}>

          {/* Title bar */}
          <div style={{ background: '#2d2d2d' }} className="flex items-center justify-between px-4 h-8">
            <div className="flex items-center gap-2 text-[11px] text-slate-300">
              <span style={{ background: '#E87624' }} className="font-extrabold text-white text-[9px] px-1.5 py-0.5 rounded-sm">T</span>
              <span>Tableau Desktop Professional — Madrid_HORECA_Analysis.twbx</span>
            </div>
            <div className="flex gap-3 text-[#888] text-[10px]">
              <span>─</span><span>□</span><span className="text-red-400">✕</span>
            </div>
          </div>

          {/* Menu bar */}
          <div style={{ background: '#3c3c3c', borderBottom: '1px solid #555' }} className="flex items-center text-[11px]">
            {['Archivo', 'Editar', 'Hoja', 'Panel', 'Historia', 'Análisis', 'Mapa', 'Formato', 'Servidor', 'Ventana', 'Ayuda'].map((m, i) => (
              <button key={m} style={i === 0 ? { color: '#ddd' } : { color: '#bbb' }} className="px-3 py-1.5 hover:bg-white/10 transition-colors">{m}</button>
            ))}
            <div className="ml-auto flex items-center gap-2 px-3">
              <button style={{ background: '#E87624', color: '#fff' }} className="text-[10px] font-bold px-3 py-1 rounded">▶ Mostrar me</button>
            </div>
          </div>

          {/* Toolbar */}
          <div style={{ background: '#f3f3f3', borderBottom: '1px solid #ddd' }} className="flex items-center gap-1 px-2 py-1.5 text-slate-600">
            {['↩','↪','✖','🔄','💾','⚡','🔍','⇐','⇒','□'].map((ic, i) => (
              i === 3 || i === 6 ? <div key={i} className="w-px h-5 bg-slate-300 mx-1" /> :
              <button key={i} className="w-7 h-7 flex items-center justify-center text-sm hover:bg-slate-200 rounded transition-colors">{ic}</button>
            ))}
            {/* Search bar */}
            <div style={{ border: '1px solid #ccc', background: '#fff' }} className="ml-2 flex items-center px-2 gap-1 rounded text-[11px] h-6">
              <span className="text-slate-400">🔍</span>
              <span className="text-slate-400">Buscar vistas, hojas...</span>
            </div>
          </div>

          <div className="flex flex-col" style={{ height: '680px' }}>
            <div className="flex flex-1 overflow-hidden">

              {/* Left panel: Data + Marks card */}
              <div style={{ width: 220, borderRight: '1px solid #ddd', background: '#f3f3f3' }} className="flex flex-col shrink-0 text-[11px]">
                {/* Data pane header */}
                <div style={{ borderBottom: '1px solid #ddd', background: '#e8e8e8' }} className="flex items-center justify-between px-3 py-1.5 text-slate-600 font-semibold text-[10px]">
                  <span>Datos</span>
                  <span className="text-[#E87624] font-bold">+ Añadir</span>
                </div>

                {/* Dimensions & Measures */}
                <div className="p-2 border-b border-slate-200">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dimensiones</div>
                  {['Nombre', 'Distrito', 'Tipo Establecimiento', 'Latitud', 'Longitud'].map(f => (
                    <div key={f} className="flex items-center gap-1.5 py-0.5 px-1 hover:bg-[#E87624]/10 rounded cursor-default text-[10px] text-slate-600">
                      <span className="text-[#2F7ED8] text-[8px] font-bold">Abc</span>{f}
                    </div>
                  ))}
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 mt-2">Medidas</div>
                  {['Índice de Viabilidad', 'Sentimiento IA', 'Fricción de Espera', 'Valor por Dinero'].map(f => (
                    <div key={f} className="flex items-center gap-1.5 py-0.5 px-1 hover:bg-[#E87624]/10 rounded cursor-default text-[10px] text-slate-600">
                      <span className="text-[#4C8E3C] text-[8px] font-bold">#</span>{f}
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div className="p-2 border-b border-slate-200">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filtros Activos</div>
                  <div className="space-y-1">
                    <div>
                      <label className="text-[9px] text-slate-500 block mb-0.5">Distrito</label>
                      <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)}
                        className="w-full border border-slate-300 bg-white text-[10px] rounded px-1.5 py-1 focus:outline-none focus:border-[#E87624] cursor-pointer">
                        {districts.map(d => <option key={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-slate-500 block mb-0.5">Canal</label>
                      <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                        className="w-full border border-slate-300 bg-white text-[10px] rounded px-1.5 py-1 focus:outline-none focus:border-[#E87624] cursor-pointer">
                        {types.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Marks card */}
                <div className="p-2 flex-1">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Marcas</div>
                  <div style={{ background: '#fff', border: '1px solid #ddd' }} className="rounded p-2 text-[10px] text-slate-600 space-y-1.5">
                    {[['Color','●','text-[#E87624]'],['Tamaño','⊞','text-[#2F7ED8]'],['Etiqueta','Aa','text-slate-500'],['Detalle','◈','text-slate-500'],['Sugerencia','🗨','text-slate-400']].map(([l, ic, cls]) => (
                      <div key={l as string} className="flex items-center gap-2">
                        <span className={`text-sm ${cls}`}>{ic}</span>
                        <span>{l}</span>
                        <div style={{ background: '#f0f0f0', border: '1px solid #ddd' }} className="flex-1 h-5 rounded-sm text-[9px] text-slate-400 flex items-center px-1">Viabilidad</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Main canvas */}
              <div className="flex-1 flex flex-col bg-white overflow-hidden">
                {/* Shelves (Rows/Columns) */}
                <div style={{ borderBottom: '1px solid #ddd', background: '#f8f8f8' }} className="px-4 py-1 space-y-1">
                  {[['Columnas', 'Tipo Establecimiento'],['Filas', 'Índice de Viabilidad']].map(([shelf, pill]) => (
                    <div key={shelf} className="flex items-center gap-2 text-[10px]">
                      <span className="text-slate-400 font-bold w-14">{shelf}</span>
                      <span style={{ background: '#2F7ED8', color: '#fff' }} className="px-2 py-0.5 rounded-sm font-semibold text-[9px]">{pill}</span>
                    </div>
                  ))}
                </div>

                {/* View area */}
                <div className="flex-1 p-6 overflow-y-auto space-y-4">
                  {tableauTab === 'dashboard' && (
                    <div className="grid grid-cols-5 gap-4">
                      {/* Main chart */}
                      <div style={{ border: '1px solid #e0e0e0' }} className="col-span-3 p-4 bg-white rounded">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Hoja 1 — Viabilidad por Segmento</div>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={byType}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="name" tick={{ fill: '#666', fontSize: 9 }} />
                              <YAxis tick={{ fill: '#666', fontSize: 9 }} />
                              <Tooltip />
                              <Bar dataKey="via" name="Viabilidad %">
                                {byType.map((_, i) => <Cell key={i} fill={TAB_COLORS[i % TAB_COLORS.length]} />)}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      {/* KPIs */}
                      <div className="col-span-2 space-y-3">
                        {[
                          { label: 'LOCALES', val: kpis.count, c: '#E87624' },
                          { label: 'VIABILIDAD MEDIA', val: `${kpis.avgVia}%`, c: '#2F7ED8' },
                          { label: 'SENTIMENT IA', val: `${kpis.avgSent}/10`, c: '#8bbc21' },
                        ].map(k => (
                          <div key={k.label} style={{ border: `1px solid ${k.c}40`, borderTop: `3px solid ${k.c}` }} className="p-4 rounded bg-white">
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</div>
                            <div className="text-2xl font-extrabold mt-1" style={{ color: k.c }}>{k.val}</div>
                          </div>
                        ))}
                      </div>

                      {/* Scatter Map */}
                      <div style={{ border: '1px solid #e0e0e0' }} className="col-span-3 p-4 bg-white rounded">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Hoja 2 — Mapa Territorial Madrid</div>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis type="number" dataKey="x" name="Lon" domain={['auto','auto']} tick={{ fill: '#999', fontSize: 8 }} tickFormatter={v => v.toFixed(2)} />
                              <YAxis type="number" dataKey="y" name="Lat" domain={['auto','auto']} tick={{ fill: '#999', fontSize: 8 }} tickFormatter={v => v.toFixed(2)} />
                              <Tooltip content={({ payload }) => payload?.[0] ? (
                                <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: '6px 10px', fontSize: 10, color: '#333', boxShadow: '0 2px 6px rgba(0,0,0,.1)' }}>
                                  <p className="font-bold">{payload[0].payload.name}</p>
                                  <p>Via: <b style={{ color: '#E87624' }}>{payload[0].payload.via}%</b></p>
                                </div>
                              ) : null} />
                              <Scatter data={scatterData} shape={(props: any) => {
                                const { cx, cy, payload } = props;
                                const c = payload.via > 55 ? '#E87624' : payload.via > 35 ? '#2F7ED8' : '#910000';
                                return <circle cx={cx} cy={cy} r={4} fill={c} fillOpacity={0.7} />;
                              }} />
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Area chart */}
                      <div style={{ border: '1px solid #e0e0e0' }} className="col-span-2 p-4 bg-white rounded">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Hoja 3 — Sentimiento</div>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={byType}>
                              <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 9 }} />
                              <YAxis tick={{ fill: '#999', fontSize: 9 }} />
                              <Tooltip />
                              <Area type="monotone" dataKey="sent" stroke="#E87624" fill="#fce4d6" strokeWidth={2.5} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sheet tabs at bottom (classic Tableau) */}
            <div style={{ background: '#e8e8e8', borderTop: '1px solid #ccc' }} className="flex items-end px-2 gap-0.5">
              {([['sheet1','Hoja 1'],['sheet2','Hoja 2'],['dashboard','Dashboard ★']] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTableauTab(id)}
                  style={tableauTab === id
                    ? { background: '#fff', borderBottom: '2px solid #E87624', color: '#333' }
                    : { background: '#d8d8d8', color: '#666' }}
                  className="px-4 py-1.5 text-[10px] font-semibold border border-b-0 border-slate-300 rounded-t transition-all"
                >{label}</button>
              ))}
              <button style={{ background: 'transparent', color: '#E87624' }} className="px-3 py-1.5 text-[11px] font-bold ml-2">＋</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          LOOKER STUDIO MOCKUP
      ═══════════════════════════════════════════════════════ */}
      {activeTool === 'looker' && (
        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-2xl animate-in fade-in duration-300" style={{ fontFamily: '"Google Sans", Roboto, Arial, sans-serif', background: '#f8f9fa' }}>

          {/* Top nav (Google Workspace style) */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e0e0e0' }} className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-sm grid grid-cols-2 gap-0.5">
                  <div className="bg-[#4285F4] rounded-sm" /><div className="bg-[#EA4335] rounded-sm" />
                  <div className="bg-[#FBBC04] rounded-sm" /><div className="bg-[#34A853] rounded-sm" />
                </div>
                <span className="text-[12px] font-medium text-slate-700">Looker Studio</span>
              </div>
              <span className="text-slate-300">|</span>
              <span className="text-[12px] text-slate-600">Madrid HORECA — Informe de Viabilidad</span>
              <span className="text-yellow-500 text-sm">⭐</span>
            </div>
            <div className="flex items-center gap-2">
              <button style={{ background: '#f1f3f4', color: '#333' }} className="text-[11px] font-medium px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors">Ver</button>
              <button style={{ background: '#f1f3f4', color: '#333' }} className="text-[11px] font-medium px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors">✏️ Editar</button>
              <button style={{ background: '#4285F4', color: '#fff' }} className="text-[11px] font-medium px-4 py-1.5 rounded-full shadow-sm hover:bg-[#3b77dc] transition-colors">Compartir</button>
            </div>
          </div>

          {/* Secondary toolbar (date range + view controls) */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e0e0e0' }} className="flex items-center gap-3 px-6 py-2">
            <div style={{ border: '1px solid #dadce0' }} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors">
              <span>📅</span>
              <span className="font-medium">Rango personalizado: Todo el período</span>
              <span className="text-slate-400">▾</span>
            </div>
            <div style={{ border: '1px solid #dadce0' }} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors">
              <span>🔄</span> Actualizar datos
            </div>
            <div className="flex-1" />
            <span className="text-[10px] text-slate-400">Última actualización: hace unos segundos</span>
          </div>

          {/* Control row (Looker-style filter chips) */}
          <div className="px-6 py-3 flex flex-wrap gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider self-center mr-2">Filtros:</span>
            <div className="flex gap-2">
              <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)}
                style={{ border: '1px solid #dadce0', background: districtFilter !== 'Todos' ? '#e8f0fe' : '#fff', color: districtFilter !== 'Todos' ? '#1a73e8' : '#444' }}
                className="text-[11px] font-medium px-3 py-1.5 rounded-full focus:outline-none focus:border-[#4285F4] cursor-pointer transition-all">
                {districts.map(d => <option key={d} value={d}>🏙️ {d}</option>)}
              </select>
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                style={{ border: '1px solid #dadce0', background: typeFilter !== 'Todos' ? '#e8f0fe' : '#fff', color: typeFilter !== 'Todos' ? '#1a73e8' : '#444' }}
                className="text-[11px] font-medium px-3 py-1.5 rounded-full focus:outline-none focus:border-[#4285F4] cursor-pointer transition-all">
                {types.map(t => <option key={t} value={t}>🍽️ {t}</option>)}
              </select>
            </div>
          </div>

          {/* Dashboard area */}
          <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: 620 }}>
            {/* Scorecard row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Locales Analizados', val: kpis.count, icon: '📍', trend: '+12% vs. ayer', color: '#4285F4' },
                { label: 'Viabilidad Comercial Media', val: `${kpis.avgVia}%`, icon: '📈', trend: 'Objetivo: 40%', color: '#34A853' },
                { label: 'Sentiment Score IA', val: `${kpis.avgSent} / 10`, icon: '🤖', trend: 'Cognitivo KNN', color: '#FBBC04' },
              ].map(sc => (
                <div key={sc.label} style={{ background: '#fff', border: '1px solid #e0e0e0', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }} className="p-5 rounded-2xl">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-500 mb-2">{sc.label}</div>
                      <div className="text-3xl font-bold" style={{ color: sc.color }}>{sc.val}</div>
                      <div className="text-[9px] text-slate-400 mt-1">{sc.trend}</div>
                    </div>
                    <span className="text-2xl opacity-60">{sc.icon}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Main chart grid */}
            <div className="grid grid-cols-5 gap-4">
              {/* Scatter map */}
              <div style={{ background: '#fff', border: '1px solid #e0e0e0', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }} className="col-span-3 p-5 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[11px] font-bold text-slate-600">🗺️ Distribución Territorial de Locales</div>
                  <button style={{ color: '#4285F4' }} className="text-[10px] font-medium">Ver en Mapa</button>
                </div>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" />
                      <XAxis type="number" dataKey="x" name="Lon" domain={['auto','auto']} tick={{ fill: '#aaa', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(2)} />
                      <YAxis type="number" dataKey="y" name="Lat" domain={['auto','auto']} tick={{ fill: '#aaa', fontSize: 8 }} axisLine={false} tickLine={false} tickFormatter={v => v.toFixed(2)} />
                      <Tooltip content={({ payload }) => payload?.[0] ? (
                        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 12px', fontSize: 10, color: '#333', boxShadow: '0 4px 12px rgba(0,0,0,.15)' }}>
                          <p className="font-bold text-[11px]">{payload[0].payload.name}</p>
                          <p>Viabilidad: <b style={{ color: '#4285F4' }}>{payload[0].payload.via}%</b></p>
                          <p>Sentimiento: {payload[0].payload.sent}/10</p>
                        </div>
                      ) : null} />
                      <Scatter data={scatterData} shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        const c = payload.via > 55 ? '#34A853' : payload.via > 35 ? '#4285F4' : '#EA4335';
                        return <circle cx={cx} cy={cy} r={4.5} fill={c} fillOpacity={0.7} strokeWidth={0} />;
                      }} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex gap-4 mt-2 text-[9px] text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block bg-[#34A853]" />Alta ({'>'}55%)</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block bg-[#4285F4]" />Media</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block bg-[#EA4335]" />Baja ({'<'}35%)</span>
                </div>
              </div>

              {/* Donut + mini legend */}
              <div style={{ background: '#fff', border: '1px solid #e0e0e0', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }} className="col-span-2 p-5 rounded-2xl">
                <div className="text-[11px] font-bold text-slate-600 mb-4">🍽️ Distribución HORECA</div>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={byType} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius="40%" outerRadius="70%" paddingAngle={2}>
                        {byType.map((_, i) => <Cell key={i} fill={LKR_COLORS[i % LKR_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.15)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  {byType.slice(0, 6).map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-[9px] text-slate-500">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: LKR_COLORS[i % LKR_COLORS.length] }} />
                      {d.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom bar chart */}
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }} className="p-5 rounded-2xl">
              <div className="text-[11px] font-bold text-slate-600 mb-4">📊 Viabilidad vs. Sentimiento por Canal</div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byType} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f4" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 10, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,.15)' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="via" name="Viabilidad %" fill="#4285F4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="count" name="Cantidad" fill="#34A853" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ background: '#fff', borderTop: '1px solid #e0e0e0' }} className="flex items-center justify-between px-6 py-2 text-[10px] text-slate-400">
            <span>Datos: geobi_data.json · {kpis.count} filas activas</span>
            <span>Powered by Geo-Predictive BI Madrid · Looker Studio Sketch</span>
          </div>
        </div>
      )}
    </div>
  );
};
