import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Compass, 
  Search, 
  RotateCcw, 
  Sliders, 
  BrainCircuit, 
  Layers, 
  Info
} from 'lucide-react';

interface GeoData {
  id_local: number;
  name: string;
  lat: number;
  lon: number;
  rating?: number;
  total_ratings?: number;
  sentiment_score: number;
  viability_index: number;
  top_strength?: string;
  top_weakness?: string;
  customer_profile?: string;
  wait_time_friction?: number | null;
  value_for_money?: number | null;
  menu_gap?: string | null;
  establishment_type?: string | null;
  occasion_tag?: string | null;
}

interface VectorProjectorProps {
  data: GeoData[];
  filterType: string;
}

interface ProjectedPoint {
  item: GeoData;
  id: number;
  name: string;
  category: 'Restaurante' | 'Bar' | 'Cafetería' | 'Alimentación' | 'Otros';
  viability: number;
  sentiment: number;
  friction: number;
  vfm: number;
  cluster: string;
  clusterColor: string;
  // Dynamic coordinates
  x: number;
  y: number;
  // Coordinates for interpolation
  umapX: number;
  umapY: number;
  tsneX: number;
  tsneY: number;
  pcaX: number;
  pcaY: number;
}

// Simple seed-based random generator to keep clusters stable
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export const VectorProjector: React.FC<VectorProjectorProps> = ({ data, filterType }) => {
  const [algorithm, setAlgorithm] = useState<'umap' | 'tsne' | 'pca'>('umap');
  const [colorMode, setColorMode] = useState<'category' | 'cluster'>('cluster');
  const [kNeighbors, setKNeighbors] = useState<number>(3);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [hoveredAlg, setHoveredAlg] = useState<'umap' | 'tsne' | 'pca' | null>(null);
  
  // Legend toggles state (Multi-select)
  const [activeCategories, setActiveCategories] = useState<string[]>([
    'Restaurante', 'Bar', 'Cafetería', 'Alimentación', 'Otros'
  ]);
  const [activeClusters, setActiveClusters] = useState<string[]>([
    'Océanos Azules (Alta Viabilidad)',
    'Riesgo Saturado (Alta Fricción & Bajo VFM)',
    'Estables / Menú Tradicional',
    'Locales de Paso (Tránsito Alto)'
  ]);

  // Canvas Zoom/Pan State
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastOffset = useRef({ x: 0, y: 0 });

  // 1. Normalize categories helper
  const getEstablishmentType = (item: GeoData): 'Restaurante' | 'Bar' | 'Cafetería' | 'Alimentación' | 'Otros' => {
    let estType = item.establishment_type;
    if (estType === 'Supermercado') {
      estType = 'Alimentación';
    } else if (estType === 'Otro') {
      estType = 'Otros';
    } else if (estType === 'Cafeteria') {
      estType = 'Cafetería';
    }

    if (estType) {
      if (estType === 'Restaurante') return 'Restaurante';
      if (estType === 'Bar') return 'Bar';
      if (estType === 'Cafetería') return 'Cafetería';
      if (estType === 'Alimentación') return 'Alimentación';
      if (estType === 'Otros') return 'Otros';
    }
    const name = item.name.toUpperCase();
    if (name.includes('BAR') || name.includes('TAPEA') || name.includes('TABERNA') || name.includes('CERVEZAS') || name.includes('PALOMA') || name.includes('BOBIA') || name.includes('COLORES') || name.includes('ENCUENTRO') || name.includes('JUANA') || name.includes('PUB')) return 'Bar';
    if (name.includes('CAFE') || name.includes('CAFETERIA') || name.includes('DULCINEA') || name.includes('PIOLA') || name.includes('STARBUCKS')) return 'Cafetería';
    if (name.includes('SUPERMERCADO') || name.includes('SUMA') || name.includes('ALIMENTACION') || name.includes('TIENDA') || name.includes('BAZAR') || name.includes('YADU') || name.includes('MERCADO')) return 'Alimentación';
    if (name.includes('RESTAURANTE') || name.includes('RESTAURANT') || name.includes('ASADOR') || name.includes('XIAO') || name.includes('DC') || name.includes('ALHAMBRA') || name.includes('PESCAITO') || name.includes('MONA')) return 'Restaurante';
    return 'Otros'; // Fallback default
  };

  // 2. Preprocess points and project coordinates
  const projectedPoints = useMemo<ProjectedPoint[]>(() => {
    return data.map((item, idx) => {
      const category = getEstablishmentType(item);
      const viability = item.viability_index || 50;
      const sentiment = item.sentiment_score || 5;
      
      // Synthesize missing properties for mock realism based on rating/viability
      const friction = item.wait_time_friction !== undefined && item.wait_time_friction !== null 
        ? item.wait_time_friction 
        : Math.max(1, Math.min(10, Math.round((10 - (item.rating || 4.0)) + seededRandom(item.id_local) * 3)));
      
      const vfm = item.value_for_money !== undefined && item.value_for_money !== null 
        ? item.value_for_money 
        : Math.max(1, Math.min(10, Math.round(((item.rating || 4.0) - 1) + seededRandom(item.id_local + 1) * 2)));

      // Cluster Determination (Logic rules for clustering)
      let cluster = 'Locales de Paso (Tránsito Alto)';
      let clusterColor = '#6366f1'; // Indigo

      if (viability > 62 && sentiment > 7.0) {
        cluster = 'Océanos Azules (Alta Viabilidad)';
        clusterColor = '#10b981'; // Emerald
      } else if (friction > 6.5 && vfm < 4.5) {
        cluster = 'Riesgo Saturado (Alta Fricción & Bajo VFM)';
        clusterColor = '#f43f5e'; // Rose
      } else if (viability >= 35 && viability <= 62) {
        cluster = 'Estables / Menú Tradicional';
        clusterColor = '#fbbf24'; // Amber
      }

      // Projection mapping calculations (umap, tsne, pca coordinates)
      // Normalizing all coords between 10% and 90% of a virtual 800x800 coordinate system.
      const seed = item.id_local;
      const noiseX = seededRandom(seed) - 0.5;
      const noiseY = seededRandom(seed + 1) - 0.5;

      // 2.1 UMAP Coordinates (Local structure / compact density groups)
      let umapX = 400;
      let umapY = 400;
      if (cluster === 'Océanos Azules (Alta Viabilidad)') {
        umapX = 220 + noiseX * 120;
        umapY = 220 + noiseY * 120;
      } else if (cluster === 'Riesgo Saturado (Alta Fricción & Bajo VFM)') {
        umapX = 580 + noiseX * 120;
        umapY = 220 + noiseY * 120;
      } else if (cluster === 'Estables / Menú Tradicional') {
        umapX = 300 + noiseX * 130;
        umapY = 580 + noiseY * 130;
      } else { // Locales de Paso
        umapX = 580 + noiseX * 130;
        umapY = 580 + noiseY * 130;
      }

      // 2.2 t-SNE Coordinates (Outlier isolation & massive spiral groups)
      const angle = (idx / data.length) * Math.PI * 4; // double spiral
      const radius = 100 + (viability / 100) * 220 + noiseX * 35;
      const tsneX = 400 + Math.cos(angle) * radius;
      const tsneY = 400 + Math.sin(angle) * radius;

      // 2.3 PCA Coordinates (Orthogonal dimensions, linear projection)
      const pcaX = 80 + ((viability * 0.85 + vfm * 1.5) / 105) * 640 + noiseX * 15;
      const pcaY = 720 - (((sentiment * 0.85 + (10 - friction) * 1.5)) / 23.5) * 640 + noiseY * 15;

      return {
        item,
        id: item.id_local,
        name: item.name,
        category,
        viability,
        sentiment,
        friction,
        vfm,
        cluster,
        clusterColor,
        // Start current coordinates at UMAP
        x: umapX,
        y: umapY,
        umapX,
        umapY,
        tsneX,
        tsneY,
        pcaX,
        pcaY
      };
    });
  }, [data]);


  // 4. Calculate K-Nearest Neighbors in real-time
  const selectedPoint = useMemo(() => {
    if (selectedId === null) return null;
    return projectedPoints.find(p => p.id === selectedId) || null;
  }, [projectedPoints, selectedId]);

  const nearestNeighbors = useMemo(() => {
    if (!selectedPoint) return [];
    
    // Calculate Euclidean distance in high-dimensional feature space (Normalized 0-1)
    const candidates = projectedPoints
      .filter(p => p.id !== selectedPoint.id) // exclude self
      // ► Only look within the SAME category (intra-category KNN)
      .filter(p => p.category === selectedPoint.category)
      .map(p => {
        const dViability = (p.viability - selectedPoint.viability) / 100;
        const dSentiment = (p.sentiment - selectedPoint.sentiment) / 10;
        const dFriction = (p.friction - selectedPoint.friction) / 10;
        const dVfm = (p.vfm - selectedPoint.vfm) / 10;

        // Euclidean distance
        const distance = Math.sqrt(
          dViability * dViability + 
          dSentiment * dSentiment + 
          dFriction * dFriction + 
          dVfm * dVfm
        );

        // Convert distance to similarity percentage
        const similarity = Math.max(0, Math.round((1 - distance / 2) * 1000) / 10);

        // Generate explainability justification text dynamically
        const featuresMatched: string[] = [];
        if (Math.abs(p.viability - selectedPoint.viability) < 6) {
          featuresMatched.push(`viabilidad de éxito similar (${p.viability}% vs ${selectedPoint.viability}%)`);
        }
        if (Math.abs(p.sentiment - selectedPoint.sentiment) < 0.6) {
          featuresMatched.push(`polaridad de reseñas idéntica (${p.sentiment}/10)`);
        }
        if (Math.abs(p.friction - selectedPoint.friction) < 0.8) {
          featuresMatched.push(`fricción operativa equiparable`);
        }
        if (Math.abs(p.vfm - selectedPoint.vfm) < 0.8) {
          featuresMatched.push(`percepción de valor muy similar (${p.vfm}/10)`);
        }
        
        let justification = `Dentro del mismo segmento ${selectedPoint.category}, este establecimiento comparte un perfil comercial muy similar al seleccionado.`;
        if (featuresMatched.length > 0) {
          justification = `Vecino ${selectedPoint.category} más cercano: comparte ${featuresMatched.slice(0, 2).join(' y ')}, con una distancia euclidiana reducida de ${distance.toFixed(3)} unidades en el espacio de features.`;
        }

        return {
          point: p,
          distance,
          similarity,
          justification
        };
      })
      .sort((a, b) => a.distance - b.distance); // closest first

    return candidates.slice(0, kNeighbors);
  }, [selectedPoint, projectedPoints, kNeighbors]);

  // 5. Searching points
  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    return projectedPoints.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      activeCategories.includes(p.category)
    ).slice(0, 10);
  }, [projectedPoints, searchQuery, activeCategories]);

  // 6. Responsive Canvas Sizing (Anti-Stretching / DPI retina fix)
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get parent dimensions
    const rect = canvas.parentElement?.getBoundingClientRect() || { width: 750, height: 460 };
    
    // Set display dimensions in attributes scaled by devicePixelRatio
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // Let CSS control actual display layout size (fills 100% of container)
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    drawCanvas();
  };

  useEffect(() => {
    // Sizing canvas initially and on window resize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [projectedPoints, selectedId, hoveredId, zoom, offsetX, offsetY, colorMode, filterType, activeCategories, activeClusters, kNeighbors]);

  // 7. Easing interpolation for points transition (UMAP <-> t-SNE <-> PCA)
  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 750; // 750ms transition
    
    const startCoords = projectedPoints.map(p => ({ x: p.x, y: p.y }));
    
    const animate = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function: easeInOutCubic
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      projectedPoints.forEach((p, idx) => {
        let targetX = p.umapX;
        let targetY = p.umapY;
        
        if (algorithm === 'tsne') {
          targetX = p.tsneX;
          targetY = p.tsneY;
        } else if (algorithm === 'pca') {
          targetX = p.pcaX;
          targetY = p.pcaY;
        }

        const startX = startCoords[idx]?.x ?? p.x;
        const startY = startCoords[idx]?.y ?? p.y;

        p.x = startX + (targetX - startX) * ease;
        p.y = startY + (targetY - startY) * ease;
      });

      drawCanvas();

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [algorithm, projectedPoints]);

  // 8. Interactive canvas painting logic (With dynamic cluster shapes and anti-alias)
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // Reset standard canvas scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply DPI scaling
    ctx.scale(dpr, dpr);
    
    // Get actual width and height in CSS pixels
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Save context state for zoom/pan
    ctx.save();
    
    // Center of coordinates
    ctx.translate(width / 2 + offsetX, height / 2 + offsetY);
    ctx.scale(zoom, zoom);
    
    // Draw coordinates grid (scaled to offset coordinates space)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1 / zoom;
    const gridSize = 100;
    
    // Virtual grid boundaries
    for (let x = -1000; x <= 1000; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x - 400, -1000);
      ctx.lineTo(x - 400, 1000);
      ctx.stroke();
    }
    for (let y = -1000; y <= 1000; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(-1000, y - 400);
      ctx.lineTo(1000, y - 400);
      ctx.stroke();
    }

    // Centered Virtual Space mapping adjustment
    // The UMAP coordinates are roughly inside [0, 800] space, let's translate them to center at (0, 0)
    ctx.translate(-400, -400);

    // DYNAMIC KNN NEIGHBORHOOD BOUNDARY HULL (Soft filled polygon)
    if (selectedPoint && nearestNeighbors.length > 0) {
      const activeNeighs = nearestNeighbors.filter(n => activeCategories.includes(n.point.category));
      
      if (activeNeighs.length > 0) {
        // Collect points forming the neighborhood: selectedPoint + active neighbors
        const hullPoints = [
          { x: selectedPoint.x, y: selectedPoint.y },
          ...activeNeighs.map(n => ({ x: n.point.x, y: n.point.y }))
        ];

        // Sort points radially around their center to draw a clean polygon shape without overlapping lines
        const centroidX = hullPoints.reduce((sum, p) => sum + p.x, 0) / hullPoints.length;
        const centroidY = hullPoints.reduce((sum, p) => sum + p.y, 0) / hullPoints.length;
        
        hullPoints.sort((a, b) => {
          const angleA = Math.atan2(a.y - centroidY, a.x - centroidX);
          const angleB = Math.atan2(b.y - centroidY, b.x - centroidX);
          return angleA - angleB;
        });

        // Draw Soft Glowing Gradient Hull
        ctx.beginPath();
        ctx.moveTo(hullPoints[0].x, hullPoints[0].y);
        for (let i = 1; i < hullPoints.length; i++) {
          ctx.lineTo(hullPoints[i].x, hullPoints[i].y);
        }
        ctx.closePath();
        
        // Soft glowing emerald fill
        ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
        ctx.fill();
        
        // Soft dashed border
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash
      }
    }

    // Draw connection lines to KNN neighbors
    if (selectedPoint && nearestNeighbors.length > 0) {
      nearestNeighbors.forEach(neigh => {
        if (!activeCategories.includes(neigh.point.category)) return;

        ctx.beginPath();
        // Thin glowing line
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
        ctx.lineWidth = 1.5 / zoom;
        ctx.setLineDash([3, 3]);
        ctx.moveTo(selectedPoint.x, selectedPoint.y);
        ctx.lineTo(neigh.point.x, neigh.point.y);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    // Paint all points
    projectedPoints.forEach(p => {
      const isCategoryToggledOff = !activeCategories.includes(p.category);
      const isClusterToggledOff = !activeClusters.includes(p.cluster);
      
      const isFilteredOut = (colorMode === 'category' && isCategoryToggledOff) || 
                            (colorMode === 'cluster' && isClusterToggledOff);
      
      const isSelected = selectedId === p.id;
      const isHovered = hoveredId === p.id;
      const isNeigh = selectedId !== null && nearestNeighbors.some(n => n.point.id === p.id);

      // Color mapping
      let color = colorMode === 'category' ? getCategoryColor(p.category) : p.clusterColor;
      
      ctx.beginPath();

      // State determination: If there is an active selected point, all non-neighbors fade out heavily!
      const isAnyActiveSelection = selectedId !== null;
      const isInActiveNeighborhood = isSelected || isNeigh;

      // 1. Point is toggled off from legend or top filter -> fade out completely (almost transparent)
      if (isFilteredOut) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.arc(p.x, p.y, 2.5 / zoom, 0, Math.PI * 2);
      } 
      // 2. Point is selected -> glowing green ring and perfect circle
      else if (isSelected) {
        // High Contrast Glow effect
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#10b981';
        ctx.arc(p.x, p.y, 8 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
        
        ctx.beginPath();
        ctx.fillStyle = '#ffffff';
        ctx.arc(p.x, p.y, 4 / zoom, 0, Math.PI * 2);
      } 
      // 3. Point is an active KNN neighbor -> glowing green halo
      else if (isNeigh) {
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#34d399';
        ctx.arc(p.x, p.y, 6.5 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // reset
        
        ctx.beginPath();
        ctx.fillStyle = '#064e3b';
        ctx.arc(p.x, p.y, 3 / zoom, 0, Math.PI * 2);
      } 
      // 4. Point is hovered
      else if (isHovered) {
        ctx.fillStyle = '#ffffff';
        ctx.arc(p.x, p.y, 6.5 / zoom, 0, Math.PI * 2);
      } 
      // 5. Point is outside the selected neighborhood (DIMS heavy to create beautiful contrast)
      else if (isAnyActiveSelection && !isInActiveNeighborhood) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.arc(p.x, p.y, 2.5 / zoom, 0, Math.PI * 2);
      }
      // 6. Normal state
      else {
        ctx.fillStyle = color;
        ctx.arc(p.x, p.y, 3.8 / zoom, 0, Math.PI * 2);
      }
      
      ctx.fill();
    });

    ctx.restore();
  };

  const getCategoryColor = (cat: string) => {
    if (cat === 'Restaurante') return '#38bdf8'; // Sky Blue
    if (cat === 'Bar') return '#fbbf24'; // Amber
    if (cat === 'Cafetería') return '#a78bfa'; // Purple
    if (cat === 'Alimentación') return '#f472b6'; // Pink
    if (cat === 'Otros') return '#94a3b8'; // Slate Gray
    return '#94a3b8';
  };

  // 9. Interactive Panning/Zooming mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    lastOffset.current = { x: offsetX, y: offsetY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDragging.current) {
      // Pan
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setOffsetX(lastOffset.current.x + dx);
      setOffsetY(lastOffset.current.y + dy);
      return;
    }

    // Hover detection (accounting for DPI scaling and Centered layout space transformation)
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    // Convert screen coordinate to dynamic canvas coordinates
    const virtX = (clientX - width / 2 - offsetX) / zoom + 400;
    const virtY = (clientY - height / 2 - offsetY) / zoom + 400;

    // Check hit radius
    let foundId: number | null = null;
    let minDistance = 14 / zoom;

    projectedPoints.forEach(p => {
      const isCategoryToggledOff = !activeCategories.includes(p.category);
      const isClusterToggledOff = !activeClusters.includes(p.cluster);
      const isFilteredOut = (colorMode === 'category' && isCategoryToggledOff) || 
                            (colorMode === 'cluster' && isClusterToggledOff) || 
                            (filterType !== 'Todos' && p.category !== filterType);
      if (isFilteredOut) return;

      const dx = p.x - virtX;
      const dy = p.y - virtY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) {
        minDistance = dist;
        foundId = p.id;
      }
    });

    if (foundId !== hoveredId) {
      setHoveredId(foundId);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDragging.current = false;
    
    // If user clicked without moving much, treat as Click / Select
    const dx = Math.abs(e.clientX - dragStart.current.x);
    const dy = Math.abs(e.clientY - dragStart.current.y);
    if (dx < 4 && dy < 4) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      const virtX = (clientX - width / 2 - offsetX) / zoom + 400;
      const virtY = (clientY - height / 2 - offsetY) / zoom + 400;

      let clickFoundId: number | null = null;
      let minDistance = 16 / zoom;

      projectedPoints.forEach(p => {
        const isCategoryToggledOff = !activeCategories.includes(p.category);
        const isClusterToggledOff = !activeClusters.includes(p.cluster);
        const isFilteredOut = (colorMode === 'category' && isCategoryToggledOff) || 
                              (colorMode === 'cluster' && isClusterToggledOff) || 
                              (filterType !== 'Todos' && p.category !== filterType);
        if (isFilteredOut) return;

        const cdx = p.x - virtX;
        const cdy = p.y - virtY;
        const dist = Math.sqrt(cdx * cdx + cdy * cdy);
        if (dist < minDistance) {
          minDistance = dist;
          clickFoundId = p.id;
        }
      });

      setSelectedId(clickFoundId);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const scaleFactor = 1.1;
    const newZoom = e.deltaY < 0 ? zoom * scaleFactor : zoom / scaleFactor;
    
    const clampedZoom = Math.max(0.15, Math.min(newZoom, 12));
    setZoom(clampedZoom);
  };

  const resetZoom = () => {
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setSelectedId(null);
  };

  // Toggle Category state from interactive legend
  const toggleCategoryLegend = (cat: string) => {
    setActiveCategories(prev => {
      if (prev.includes(cat)) {
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== cat);
      } else {
        return [...prev, cat];
      }
    });
  };

  // Toggle Cluster state from interactive legend
  const toggleClusterLegend = (clust: string) => {
    setActiveClusters(prev => {
      if (prev.includes(clust)) {
        if (prev.length === 1) return prev;
        return prev.filter(c => c !== clust);
      } else {
        return [...prev, clust];
      }
    });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 min-h-[650px] animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* 1. Main Projector Visualizer Column (Span 3) */}
      <div ref={containerRef} className="xl:col-span-3 glass rounded-3xl p-6 flex flex-col relative">
        {/* Visualizer controls top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 z-10">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-brand-400" />
              Proyector de Espacio Vectorial
            </h3>
            <p className="text-xs text-slate-400 font-medium">Representación reducida UMAP/t-SNE de afinidad de mercado</p>
          </div>

          {/* Algorithm selector */}
          <div className="relative flex bg-slate-900/60 p-1 border border-white/5 rounded-xl text-xs font-bold">
            {(['umap', 'tsne', 'pca'] as const).map(alg => (
              <button
                key={alg}
                onClick={() => setAlgorithm(alg)}
                onMouseEnter={() => setHoveredAlg(alg)}
                onMouseLeave={() => setHoveredAlg(null)}
                className={`px-3 py-1.5 rounded-lg uppercase transition-all ${
                  algorithm === alg 
                    ? 'bg-brand-500 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {alg}
              </button>
            ))}

            {/* Premium Alg Tooltip */}
            {hoveredAlg && (
              <div 
                className="absolute right-0 bottom-full mb-3 w-72 p-3.5 bg-slate-950/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl z-[200] animate-in fade-in slide-in-from-bottom-1 text-[11px] leading-relaxed text-slate-300 font-medium"
              >
                <div className="absolute right-8 bottom-0 translate-y-1.5 w-2.5 h-2.5 rotate-45 bg-[#0b0f19] border-r border-b border-white/10"></div>
                {hoveredAlg === 'umap' && (
                  <>
                    <strong className="text-brand-400 font-bold block mb-1">UMAP (Uniform Manifold Approximation)</strong>
                    Preserva la estructura local no lineal. Excelente para identificar micro-nichos comerciales de negocio y nubes de comportamiento similar.
                  </>
                )}
                {hoveredAlg === 'tsne' && (
                  <>
                    <strong className="text-brand-400 font-bold block mb-1">t-SNE (t-Distributed Stochastic Neighbor)</strong>
                    Agrupamiento probabilístico estocástico no lineal. Destaca relaciones globales y aísla outliers atípicos en el mercado.
                  </>
                )}
                {hoveredAlg === 'pca' && (
                  <>
                    <strong className="text-brand-400 font-bold block mb-1">PCA (Principal Component Analysis)</strong>
                    Reducción lineal clásica de máxima varianza. Proyecta ortogonalmente sobre dos ejes clave: Viabilidad Financiera (Eje X) vs Satisfacción (Eje Y).
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Canvas Visual Area */}
        <div className="flex-1 min-h-[480px] bg-slate-950/80 border border-white/5 rounded-2xl relative overflow-hidden cursor-crosshair">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-full block"
          />

          {/* Floaters UI */}
          <div className="absolute bottom-4 left-4 flex gap-2">
            <button 
              onClick={resetZoom}
              className="bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white p-2.5 rounded-xl border border-white/10 text-xs font-bold flex items-center gap-2 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              Reiniciar Vista
            </button>
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-white/10 text-[10px] text-slate-400 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-brand-400" />
              Arrastra para mover • Rueda del mouse para Zoom
            </div>
          </div>

          <div className="absolute top-4 right-4 flex flex-col gap-2 bg-slate-900/80 backdrop-blur-md p-3.5 border border-white/10 rounded-xl text-xs font-medium z-10">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Coloreado por:</span>
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
              <input 
                type="radio" 
                name="colorMode" 
                checked={colorMode === 'cluster'} 
                onChange={() => setColorMode('cluster')}
                className="accent-brand-500"
              />
              Clúster de Segmentación
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
              <input 
                type="radio" 
                name="colorMode" 
                checked={colorMode === 'category'} 
                onChange={() => setColorMode('category')}
                className="accent-brand-500"
              />
              Categoría HORECA
            </label>
          </div>

          {/* Search floating box */}
          <div className="absolute top-4 left-4 w-60 z-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                placeholder="Buscar en el espacio vectorial..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/90 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-brand-500 transition-all text-slate-200"
              />
            </div>
            
            {searchResults.length > 0 && (
              <div className="mt-1 bg-slate-900/95 border border-white/10 rounded-xl max-h-40 overflow-y-auto shadow-2xl z-50">
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedId(p.id);
                      setSearchQuery('');
                      // Center coordinates roughly in display coordinates space
                      setOffsetX(0);
                      setOffsetY(0);
                      // Zoom in slightly
                      setZoom(1.3);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs text-slate-300 hover:bg-brand-500 hover:text-white border-b border-white/5 transition-colors font-medium"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* INTERACTIVE LEGEND SELECTORS (Click toggles categories or clusters on/off) */}
        <div className={`grid grid-cols-2 ${colorMode === 'category' ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 mt-6 border-t border-white/5 pt-6 select-none`}>
          {colorMode === 'category' ? (
            [
              { id: 'Restaurante', label: 'Restaurante', color: '#38bdf8', desc: 'Restaurantes, mesones, asadores y locales de comida formal.' },
              { id: 'Bar', label: 'Bar', color: '#fbbf24', desc: 'Bares de tapas, tabernas, cervecerías, pubs y cantinas.' },
              { id: 'Cafetería', label: 'Cafetería', color: '#a78bfa', desc: 'Cafés, pastelerías tradicionales, heladerías y locales de brunch.' },
              { id: 'Alimentación', label: 'Alimentación', color: '#f472b6', desc: 'Supermercados, tiendas de conveniencia, fruterías y bazares de alimentación.' },
              { id: 'Otros', label: 'Otros', color: '#94a3b8', desc: 'Discotecas, heladerías especializadas, locales de eventos y tiendas gourmet que complementan el ecosistema HORECA.' }
            ].map(leg => {
              const isActive = activeCategories.includes(leg.id);
              return (
                <div 
                  key={leg.id}
                  onClick={() => toggleCategoryLegend(leg.id)}
                  title={leg.desc}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-all active:scale-95 group relative ${
                    isActive 
                      ? 'bg-slate-900/40 border-white/10 text-white' 
                      : 'bg-transparent border-transparent text-slate-500 hover:text-slate-400'
                  }`}
                >
                  <span 
                    className="w-3.5 h-3.5 rounded-full transition-all"
                    style={{ 
                      backgroundColor: isActive ? leg.color : '#475569',
                      boxShadow: isActive ? `0 0 10px ${leg.color}60` : 'none'
                    }}
                  />
                  <span className="text-[10px] font-bold tracking-wide uppercase">{leg.label}</span>
                  <span className="ml-auto text-[8px] font-extrabold text-slate-500">{isActive ? 'ACTIVO' : 'OCULTO'}</span>
                </div>
              );
            })
          ) : (
            [
              { id: 'Océanos Azules (Alta Viabilidad)', label: 'Océanos Azules', color: '#10b981' },
              { id: 'Riesgo Saturado (Alta Fricción & Bajo VFM)', label: 'Saturación Crítica', color: '#f43f5e' },
              { id: 'Estables / Menú Tradicional', label: 'Estable Tradicional', color: '#fbbf24' },
              { id: 'Locales de Paso (Tránsito Alto)', label: 'Alto Tránsito', color: '#6366f1' }
            ].map(leg => {
              const isActive = activeClusters.includes(leg.id);
              return (
                <div 
                  key={leg.id}
                  onClick={() => toggleClusterLegend(leg.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-all active:scale-95 ${
                    isActive 
                      ? 'bg-slate-900/40 border-white/10 text-white' 
                      : 'bg-transparent border-transparent text-slate-500 hover:text-slate-400'
                  }`}
                >
                  <span 
                    className="w-3.5 h-3.5 rounded-full transition-all"
                    style={{ 
                      backgroundColor: isActive ? leg.color : '#475569',
                      boxShadow: isActive ? `0 0 10px ${leg.color}60` : 'none'
                    }}
                  />
                  <span className="text-[10px] font-bold tracking-wide uppercase">{leg.label}</span>
                  <span className="ml-auto text-[8px] font-extrabold text-slate-500">{isActive ? 'ACTIVO' : 'OCULTO'}</span>
                </div>
              );
            })
          )}
        </div>

        {colorMode === 'category' && (
          <div className="mt-4 p-3.5 bg-slate-900/30 border border-white/5 rounded-2xl text-[11px] leading-relaxed text-slate-400 flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
            <p>
              <strong className="text-slate-300">Nota de Categorización HORECA:</strong> La categoría <strong className="text-slate-300">"Otros"</strong> agrupa locales diversos (heladerías independientes, discotecas, pastelerías, espacios de eventos y tiendas gourmet) que no entran directamente en las cuatro tipologías tradicionales, logrando que el total sume exactamente <strong className="text-brand-400">1,066 locales</strong> sin distorsionar el análisis.
            </p>
          </div>
        )}
      </div>

      {/* 2. Side Panel Inspectors (Span 1) */}
      <div className="xl:col-span-1 flex flex-col gap-6">
        
        {/* Selected Local inspector */}
        {selectedPoint ? (
          <div className="glass rounded-3xl p-6 space-y-5 border-l-4 border-l-brand-400 relative overflow-hidden animate-in fade-in slide-in-from-right-4">
            <div>
              <span className="bg-slate-900 text-brand-400 px-3 py-1 rounded-full text-[9px] font-bold border border-white/5 uppercase">
                Establecimiento Seleccionado
              </span>
              <h4 className="text-base font-bold text-white mt-3 truncate">{selectedPoint.name}</h4>
              <p className="text-[10px] text-slate-400 font-medium">Categoría: {selectedPoint.category}</p>
            </div>

            <div className="grid grid-cols-2 gap-3.5 text-center">
              <div className="bg-slate-900/60 p-2.5 border border-white/5 rounded-xl">
                <span className="text-[9px] text-slate-500 uppercase font-bold">Viabilidad</span>
                <p className="text-sm font-extrabold text-brand-400">{selectedPoint.viability}%</p>
              </div>
              <div className="bg-slate-900/60 p-2.5 border border-white/5 rounded-xl">
                <span className="text-[9px] text-slate-500 uppercase font-bold">Sentiment</span>
                <p className="text-sm font-extrabold text-emerald-400">{selectedPoint.sentiment}/10</p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-900/30 rounded-xl border border-white/5">
                <span className="text-[9px] text-emerald-400 font-bold uppercase block mb-1">Top Fortaleza</span>
                <p className="text-slate-300 font-medium leading-relaxed">{selectedPoint.item.top_strength || 'Atención al cliente rápida'}</p>
              </div>
              <div className="p-3 bg-slate-900/30 rounded-xl border border-white/5">
                <span className="text-[9px] text-rose-400 font-bold uppercase block mb-1">Top Debilidad</span>
                <p className="text-slate-300 font-medium leading-relaxed">{selectedPoint.item.top_weakness || 'Precios altos en bebidas'}</p>
              </div>
            </div>

            {/* NEAREST NEIGHBORS (KNN CALCULATOR WITH K-SLIDER) */}
            <div className="border-t border-white/5 pt-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-brand-400" />
                    Vecinos K-NN · {selectedPoint?.category}
                  </span>
                  <span className="text-[10px] font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-md">
                    K = {kNeighbors}
                  </span>
                </div>
                
                {/* K-Neighbors Dynamic Slider (2 to 5) */}
                <input
                  type="range"
                  min="2"
                  max="5"
                  step="1"
                  value={kNeighbors}
                  onChange={(e) => setKNeighbors(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
              </div>

              {/* Neighbors list */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {nearestNeighbors.map((neigh) => (
                  <div 
                    key={neigh.point.id}
                    className="p-3 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 rounded-2xl space-y-2 transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedId(neigh.point.id);
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                        Afinidad: {neigh.similarity}%
                      </span>
                      <span className="text-[8px] text-slate-500 font-bold uppercase">Distancia: {neigh.distance.toFixed(3)}</span>
                    </div>
                    <p className="text-xs font-bold text-white truncate">{neigh.point.name}</p>
                    
                    {/* Explainability justification card ("¿Por qué se eligió?") */}
                    <div className="p-2.5 bg-slate-950/60 border border-white/5 rounded-xl text-[10px] leading-relaxed text-slate-300 font-medium">
                      <span className="text-[8px] text-slate-500 font-extrabold uppercase block mb-1">¿Por qué se eligió?</span>
                      {neigh.justification}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="glass rounded-3xl p-6 flex flex-col items-center justify-center text-center space-y-4 h-[320px]">
            <div className="w-12 h-12 bg-slate-900 border border-white/5 rounded-2xl flex items-center justify-center text-slate-400">
              <BrainCircuit className="w-6 h-6 text-brand-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Visualizador K-NN Activo</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-[200px] leading-relaxed mx-auto font-medium">
                Haz clic en cualquier local en el espacio vectorial para analizar su segmentación y vecinos más cercanos.
              </p>
            </div>
          </div>
        )}

        {/* Segmentation Methodology Explainability card */}
        <div className="glass rounded-3xl p-6 space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            Metodología de Segmentación
          </h4>
          <div className="space-y-3.5 text-[11px] leading-relaxed text-slate-400 font-medium">
            <div className="flex gap-3">
              <div className="w-5 h-5 bg-slate-900 rounded-lg flex items-center justify-center text-white shrink-0 mt-0.5">1</div>
              <p><strong className="text-slate-300">Análisis NLP (Gemma-4):</strong> Extracción cognitiva de sentimiento, fricciones de espera y tickets de consumo en base a reseñas de Google Maps.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-5 h-5 bg-slate-900 rounded-lg flex items-center justify-center text-white shrink-0 mt-0.5">2</div>
              <p><strong className="text-slate-300">Vectorización:</strong> Construcción de matriz de características de 5 dimensiones (Sentiment, Viabilidad, Wait Time, VFM, Densidad).</p>
            </div>
            <div className="flex gap-3">
              <div className="w-5 h-5 bg-slate-900 rounded-lg flex items-center justify-center text-white shrink-0 mt-0.5">3</div>
              <p><strong className="text-slate-300">UMAP Proyección:</strong> Reducción topológica del espacio de embeddings a 2D para identificar patrones no lineales y Océanos Azules.</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
