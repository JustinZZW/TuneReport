import React, { useEffect, useMemo, useState, useRef } from 'react';
import { InstrumentReport } from '../types';
import { TrendingUp, AlertCircle, Info, Layers } from 'lucide-react';
import clsx from 'clsx';

interface VisualizationViewProps {
  reports: InstrumentReport[];
}

interface DataPoint {
  date: string;
  displayDate: string;
  intensity: number;
  resolution: number;
  fileName: string;
}

interface GroupedByMass {
  [mass: string]: DataPoint[];
}

interface GroupedByConfig {
  type: string;
  range: string;
  polarity: string;
  reports: InstrumentReport[];
}

// Custom Tooltip Component
const Tooltip = ({ x, y, data, label }: { x: number, y: number, data: DataPoint, label: string }) => (
  <div 
    className="absolute pointer-events-none bg-slate-900 text-white text-xs rounded shadow-lg p-2 z-50 whitespace-nowrap"
    style={{ left: x, top: y, transform: 'translate(-50%, -120%)' }}
  >
    <div className="font-semibold mb-1">{data.displayDate}</div>
    <div>{label}: {label === 'Resolution' ? data.resolution.toLocaleString() : data.intensity.toLocaleString()}</div>
    <div className="text-slate-400 text-[10px] mt-1 truncate max-w-[150px]">{data.fileName}</div>
    {/* Triangle arrow */}
    <div className="absolute left-1/2 bottom-0 -mb-1 w-2 h-2 bg-slate-900 rotate-45 -translate-x-1/2"></div>
  </div>
);

// Lightweight SVG Chart Component
const SimpleLineChart = ({ 
  data, 
  dataKey, 
  color, 
  height = 200, 
  label,
  yZoom = 1,
  resetSignal = 0
}: { 
  data: DataPoint[], 
  dataKey: 'intensity' | 'resolution', 
  color: string, 
  height?: number,
  label: string,
  yZoom?: number,
  resetSignal?: number
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{x: number, y: number} | null>(null);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [dragEnd, setDragEnd] = useState<{x: number, y: number} | null>(null);
  const [manualZoom, setManualZoom] = useState<{
    xMinIndex: number;
    xMaxIndex: number;
    yMin: number;
    yMax: number;
  } | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setManualZoom(null);
    setDragStart(null);
    setDragEnd(null);
  }, [resetSignal]);

  if (data.length === 0) return null;

  const visibleData = manualZoom
    ? data.slice(manualZoom.xMinIndex, manualZoom.xMaxIndex + 1)
    : data;

  // 1. Calculate Scales
  const values = visibleData.map(d => d[dataKey]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  
  // Add some padding to Y-axis (10%)
  const yRange = maxVal - minVal;
  const paddedMin = Math.max(0, minVal - (yRange * 0.1));
  const paddedMax = maxVal + (yRange === 0 ? maxVal * 0.1 : yRange * 0.1);
  const center = (paddedMin + paddedMax) / 2;
  const halfRange = ((paddedMax - paddedMin) / 2) / Math.max(1, yZoom);
  const defaultYMin = center - halfRange;
  const defaultYMax = center + halfRange;
  const yMin = manualZoom ? manualZoom.yMin : defaultYMin;
  const yMax = manualZoom ? manualZoom.yMax : defaultYMax;
  const effectiveYRange = yMax - yMin;

  const width = 100; // SVG uses 100% width, viewBox handles aspect
  const paddingX = 40; // Pixels for left axis
  const paddingY = 20; // Pixels for bottom axis

  // Helper to map values to SVG coordinates (percentages)
  // X is strictly equidistant for categorical dates
  const getX = (index: number) => {
    if (data.length <= 1) return 50; // Center if single point
    return (index / (data.length - 1)) * 100;
  };

  const getY = (val: number) => {
    if (effectiveYRange === 0) return 50; // Center line if flat
    return 100 - ((val - yMin) / effectiveYRange) * 100;
  };

  // Generate Path
  const points = visibleData.map((d, i) => `${getX(i)},${getY(d[dataKey])}`).join(' ');

  const clearZoom = () => {
    setManualZoom(null);
  };

  const formatYAxisLabel = (value: number) => {
    if (Math.abs(value) >= 1000) {
      return `${Math.round(value / 1000).toLocaleString()}K`;
    }
    return Math.round(value).toLocaleString();
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!plotRef.current) return;
    const rect = plotRef.current.getBoundingClientRect();
    setDragStart({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
    setDragEnd(null);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStart || !plotRef.current) return;
    const rect = plotRef.current.getBoundingClientRect();
    setDragEnd({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  const handleMouseUp = () => {
    if (!dragStart || !dragEnd || !plotRef.current) {
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const rect = plotRef.current.getBoundingClientRect();
    const width = rect.width;
    const heightPx = rect.height;
    const dx = Math.abs(dragEnd.x - dragStart.x);
    const dy = Math.abs(dragEnd.y - dragStart.y);

    if (dx < 10 || dy < 10) {
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const minX = Math.max(0, Math.min(dragStart.x, dragEnd.x));
    const maxX = Math.min(width, Math.max(dragStart.x, dragEnd.x));
    const minY = Math.max(0, Math.min(dragStart.y, dragEnd.y));
    const maxY = Math.min(heightPx, Math.max(dragStart.y, dragEnd.y));

    const xMinPct = (minX / width) * 100;
    const xMaxPct = (maxX / width) * 100;
    const maxIndex = Math.max(visibleData.length - 1, 1);
    const xMinIndex = Math.max(0, Math.floor((xMinPct / 100) * maxIndex));
    const xMaxIndex = Math.max(xMinIndex + 1, Math.ceil((xMaxPct / 100) * maxIndex));

    const valueHigh = yMax - (minY / heightPx) * (yMax - yMin);
    const valueLow = yMax - (maxY / heightPx) * (yMax - yMin);

    setManualZoom({
      xMinIndex: xMinIndex + (manualZoom ? manualZoom.xMinIndex : 0),
      xMaxIndex: xMaxIndex + (manualZoom ? manualZoom.xMinIndex : 0),
      yMin: Math.max(0, Math.min(valueLow, valueHigh)),
      yMax: Math.max(valueLow, valueHigh)
    });
    setDragStart(null);
    setDragEnd(null);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!visibleData.length) return;
    event.preventDefault();

    const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
    const center = (yMin + yMax) / 2;
    const halfRange = ((yMax - yMin) / 2) * zoomFactor;

    setManualZoom({
      xMinIndex: manualZoom ? manualZoom.xMinIndex : 0,
      xMaxIndex: manualZoom ? manualZoom.xMaxIndex : data.length - 1,
      yMin: Math.max(0, center - halfRange),
      yMax: center + halfRange
    });
  };

  return (
    <div className="relative w-full" style={{ height: height + 50 }}>
      {/* Title */}
      <div className="absolute top-0 left-0 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
        {label}
      </div>
      {manualZoom && (
        <button
          onClick={clearZoom}
          className="absolute top-0 right-0 text-[10px] text-slate-500 hover:text-blue-600"
        >
          Reset zoom
        </button>
      )}

      {/* Y-axis labels */}
      <div className="absolute left-0 top-6 bottom-6 w-12 text-[10px] text-slate-400">
        {[0, 0.25, 0.5, 0.75, 1].map(tick => (
          <div
            key={tick}
            className="absolute -translate-y-1/2"
            style={{ top: `${(1 - tick) * 100}%` }}
          >
            {formatYAxisLabel(yMin + (yMax - yMin) * tick)}
          </div>
        ))}
      </div>

      <div className="absolute inset-0 top-6 bottom-6 left-12 right-0" ref={plotRef}>
        <svg 
          width="100%" 
          height="100%" 
          viewBox={`-5 -10 110 120`} 
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          {/* Grid Lines (Horizontal) */}
          {[0, 0.25, 0.5, 0.75, 1].map(t => (
            <line 
              key={t}
              x1="0" 
              y1={t * 100} 
              x2="100" 
              y2={t * 100} 
              stroke="#e2e8f0" 
              strokeWidth="0.5" 
              strokeDasharray="2 2"
            />
          ))}

          {/* Data Path */}
          <polyline 
            points={points} 
            fill="none" 
            stroke={color} 
            strokeWidth="2" 
            strokeLinejoin="round" 
            strokeLinecap="round"
          />

          {/* Dots */}
          {visibleData.map((d, i) => (
            <circle 
              key={i}
              cx={getX(i)}
              cy={getY(d[dataKey])}
              r={hoverIndex === i ? 4 : 2}
              fill="white"
              stroke={color}
              strokeWidth="2"
              className="transition-all duration-200 cursor-pointer"
              onMouseEnter={(e) => {
                setHoverIndex(i);
                // Calculate position relative to the container
                // We pass this up or handle simple absolute positioning
                const rect = e.currentTarget.getBoundingClientRect();
                const parentRect = e.currentTarget.closest('.relative')?.getBoundingClientRect();
                if (rect && parentRect) {
                   setHoverPos({
                      x: (getX(i) / 100) * parentRect.width, 
                      y: (getY(d[dataKey]) / 100) * (parentRect.height - 48) + 24 // Adjust for header/padding roughly
                   });
                }
              }}
              onMouseLeave={() => {
                setHoverIndex(null);
                setHoverPos(null);
              }}
            />
          ))}
          
        </svg>

        <div
          className="absolute inset-0 cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />

        {dragStart && dragEnd && (
          <div
            className="absolute border border-blue-500 bg-blue-200/20"
            style={{
              left: Math.min(dragStart.x, dragEnd.x),
              top: Math.min(dragStart.y, dragEnd.y),
              width: Math.abs(dragEnd.x - dragStart.x),
              height: Math.abs(dragEnd.y - dragStart.y)
            }}
          />
        )}

        {/* Axis Labels */}
          <div className="absolute bottom-0 left-0 right-0 translate-y-full flex justify-between text-[10px] text-slate-400 mt-2 px-1">
            {visibleData.map((d, i) => (
               <div key={i} style={{ 
                  position: 'absolute', 
                  left: `${(i / (visibleData.length - 1 || 1)) * 100}%`, 
                transform: 'translateX(-50%) rotate(-30deg)',
                transformOrigin: 'center top',
                  whiteSpace: 'nowrap'
               }}>
                 {d.displayDate}
               </div>
            ))}
        </div>
      </div>
      
      {/* Interactive Tooltip */}
      {hoverIndex !== null && hoverPos && (
        <Tooltip 
           x={hoverPos.x} 
           y={hoverPos.y} 
           data={data[hoverIndex]} 
           label={label} 
        />
      )}
    </div>
  );
};

// Sub-component to render charts for a specific configuration group
const ConfigurationGroupView = ({
  group,
  yZoom,
  startDate,
  endDate,
  resetSignal
}: {
  group: GroupedByConfig;
  yZoom: number;
  startDate: string;
  endDate: string;
  resetSignal: number;
}) => {
  // Process Data for this specific group
  const groupedData = useMemo(() => {
    const map: GroupedByMass = {};

    group.reports.forEach(report => {
      if (report.tofCalibrationData) {
        report.tofCalibrationData.forEach(row => {
          // Normalize Reference Mass
          const massKey = row.referenceMass.trim();
          
          if (!map[massKey]) map[massKey] = [];

          // Parse values safely
          const intensity = parseFloat(row.intensity?.replace(/,/g, '') || '0');
          const resolution = parseFloat(row.resolution?.replace(/,/g, '') || '0');

          if (!isNaN(intensity) && !isNaN(resolution)) {
            map[massKey].push({
              date: report.reportDate,
              displayDate: report.reportDate.split(' ')[0],
              intensity,
              resolution,
              fileName: report.fileName
            });
          }
        });
      }
    });

    // Sort by date inside each mass group
    Object.keys(map).forEach(key => {
      map[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    });

    return map;
  }, [group.reports]);

  // Sort masses numerically
  const sortedMasses = Object.keys(groupedData).sort((a, b) => parseFloat(a) - parseFloat(b));
  const startTime = startDate ? new Date(startDate).getTime() : null;
  const endTime = endDate ? new Date(`${endDate}T23:59:59`).getTime() : null;

  if (sortedMasses.length === 0) return null;

  return (
    <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
           <Layers className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
             {group.type} 
             <span className="text-slate-400 font-normal">/</span> 
             {group.range}
          </h2>
          <div className="flex items-center gap-2 mt-1">
             <span className={clsx("text-xs font-semibold px-2 py-0.5 rounded-full border", 
                group.polarity.toLowerCase().includes('pos') ? "bg-purple-50 text-purple-700 border-purple-100" :
                group.polarity.toLowerCase().includes('neg') ? "bg-orange-50 text-orange-700 border-orange-100" :
                "bg-slate-100 text-slate-600 border-slate-200"
             )}>
                {group.polarity}
             </span>
             <span className="text-xs text-slate-500">{group.reports.length} reports</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {sortedMasses.map(mass => (
          <div key={mass} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <span className="text-slate-500 font-medium text-xs uppercase tracking-wider">Ref Mass</span>
                {mass}
              </h3>
              <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                {groupedData[mass].length} pts
              </span>
            </div>
            
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
              {(() => {
                const displayData = groupedData[mass].filter(point => {
                  const pointTime = new Date(point.date).getTime();
                  if (startTime !== null && pointTime < startTime) return false;
                  if (endTime !== null && pointTime > endTime) return false;
                  return true;
                });
                return (
                  <>
              <SimpleLineChart 
                data={displayData} 
                dataKey="intensity" 
                color="#4f46e5" 
                label="Intensity"
                yZoom={yZoom}
                resetSignal={resetSignal}
              />
              <SimpleLineChart 
                data={displayData} 
                dataKey="resolution" 
                color="#059669" 
                label="Resolution"
                yZoom={yZoom}
                resetSignal={resetSignal}
              />
                  </>
                );
              })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const VisualizationView: React.FC<VisualizationViewProps> = ({ reports }) => {
  const [selectedType, setSelectedType] = useState('All');
  const [selectedRange, setSelectedRange] = useState('All');
  const [selectedPolarity, setSelectedPolarity] = useState('All');
  const [yZoom, setYZoom] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [resetSignal, setResetSignal] = useState(0);

  useEffect(() => {
    if (startDate || endDate) return;
    const today = new Date();
    const prior = new Date();
    prior.setDate(today.getDate() - 30);
    const format = (value: Date) => value.toISOString().split('T')[0];
    setStartDate(format(prior));
    setEndDate(format(today));
  }, [startDate, endDate]);
  
  // Group reports by Type/Range/Polarity first
  const filteredReports = useMemo(() => {
    return reports.filter(report => {
      const type = report.reportType || 'Unknown';
      const range = report.massRange || 'Unknown';
      const polarity = report.polarity || 'Unknown';
      if (selectedType !== 'All' && type !== selectedType) return false;
      if (selectedRange !== 'All' && range !== selectedRange) return false;
      if (selectedPolarity !== 'All' && polarity !== selectedPolarity) return false;
      return true;
    });
  }, [reports, selectedType, selectedRange, selectedPolarity]);

  const configGroups = useMemo(() => {
    const groups: Record<string, GroupedByConfig> = {};

    filteredReports.forEach(report => {
      const type = report.reportType || 'Unknown';
      const range = report.massRange || 'Unknown';
      const polarity = report.polarity || 'Unknown';
      const key = `${type}|${range}|${polarity}`;

      if (!groups[key]) {
        groups[key] = { type, range, polarity, reports: [] };
      }
      groups[key].reports.push(report);
    });

    return groups;
  }, [filteredReports]);

  const typeOptions = useMemo(() => ['All', ...Array.from(new Set(reports.map(r => r.reportType || 'Unknown'))).sort()], [reports]);
  const rangeOptions = useMemo(() => ['All', ...Array.from(new Set(reports.map(r => r.massRange || 'Unknown'))).sort()], [reports]);
  const polarityOptions = useMemo(() => ['All', ...Array.from(new Set(reports.map(r => r.polarity || 'Unknown'))).sort()], [reports]);

  const groupKeys = Object.keys(configGroups).sort();

  if (reports.length === 0) return null;
  if (groupKeys.length === 0) {
     return (
       <div className="flex flex-col items-center justify-center py-16 text-center border border-slate-200 rounded-xl bg-white shadow-sm animate-in fade-in">
         <div className="bg-slate-50 p-3 rounded-full mb-3">
           <TrendingUp className="w-6 h-6 text-slate-400" />
         </div>
         <h3 className="text-sm font-semibold text-slate-800">No Chart Data</h3>
         <p className="text-slate-500 text-xs mt-1">
           Could not extract calibration points to visualize.
         </p>
       </div>
     );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Report Type</label>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              {typeOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mass Range</label>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={selectedRange}
              onChange={(e) => setSelectedRange(e.target.value)}
            >
              {rangeOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Polarity</label>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={selectedPolarity}
              onChange={(e) => setSelectedPolarity(e.target.value)}
            >
              {polarityOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Start Date</label>
            <input
              type="date"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">End Date</label>
            <input
              type="date"
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Y-Axis Zoom</label>
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={yZoom}
              onChange={(e) => setYZoom(Number(e.target.value))}
            />
            <span className="text-xs text-slate-500">{yZoom.toFixed(1)}x</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            className="text-xs font-medium text-slate-600 hover:text-blue-600"
          >
            Clear date range
          </button>
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              setYZoom(1);
              setResetSignal(prev => prev + 1);
            }}
            className="text-xs font-medium text-slate-600 hover:text-blue-600"
          >
            Reset zoom
          </button>
        </div>
      </div>
      
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
         <Info className="w-5 h-5 text-blue-600 mt-0.5" />
         <div>
           <h3 className="text-sm font-semibold text-blue-900">Visualization Analysis</h3>
           <p className="text-xs text-blue-700 mt-1">
             Comparing {reports.length} reports. Charts are grouped by <strong>Configuration</strong> (Type, Range, Polarity) and then by <strong>Reference Mass</strong>.
           </p>
         </div>
      </div>

      {groupKeys.map(key => (
        <ConfigurationGroupView
          key={key}
          group={configGroups[key]}
          yZoom={yZoom}
          startDate={startDate}
          endDate={endDate}
          resetSignal={resetSignal}
        />
      ))}

    </div>
  );
};