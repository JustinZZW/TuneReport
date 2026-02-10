import React, { useMemo } from 'react';
import { InstrumentReport } from '../types';
import { Download, AlertCircle, Layers, Zap, Gauge, Activity } from 'lucide-react';
import clsx from 'clsx';

interface CalibrationSummaryProps {
  reports: InstrumentReport[];
}

interface GroupedData {
  [key: string]: {
    type: string;
    range: string;
    polarity: string;
    rows: any[];
  };
}

export const CalibrationSummary: React.FC<CalibrationSummaryProps> = ({ reports }) => {
  
  // Group data by Type + Mass Range + Polarity
  const groupedData = useMemo(() => {
    const groups: GroupedData = {};

    reports.forEach(report => {
      // Create a unique key for the configuration
      const type = report.reportType || 'Unknown Type';
      const range = report.massRange || 'Unknown Range';
      const polarity = report.polarity || 'Unknown Polarity';
      const key = `${type}|${range}|${polarity}`;

      if (!groups[key]) {
        groups[key] = {
          type,
          range,
          polarity,
          rows: []
        };
      }

      if (report.tofCalibrationData) {
        const newRows = report.tofCalibrationData.map(row => ({
          ...row,
          fileName: report.fileName,
          date: report.reportDate,
          // Store these for CSV export convenience, even if implied by group
          polarity: report.polarity, 
          massRange: report.massRange,
          reportType: report.reportType
        }));
        groups[key].rows.push(...newRows);
      }
    });

    // Sort rows within groups by date
    Object.values(groups).forEach(group => {
      group.rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });

    return groups;
  }, [reports]);

  const groupKeys = Object.keys(groupedData).sort();

  if (groupKeys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border border-slate-200 rounded-xl bg-white shadow-sm">
        <div className="bg-slate-50 p-3 rounded-full mb-3">
          <AlertCircle className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">No Calibration Data Found</h3>
        <p className="text-slate-500 text-xs mt-1">
          None of the current reports contain "TOF Mass Calibration Data".
        </p>
      </div>
    );
  }

  // Helper to download CSV (All data combined, with columns for classification)
  const downloadAllCsv = () => {
    const escapeCsvValue = (value: unknown) => {
      const stringValue = value === null || value === undefined ? '' : String(value);
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const headers = [
      "Report Type", "Mass Range", "Polarity", 
      "File Name", "Date", 
      "Ref Mass", "Measured Mass", "Diff", "Intensity", "Resolution", "MCP"
    ];

    const allRows = Object.values(groupedData).flatMap(group => 
      group.rows.map(row => [
        escapeCsvValue(row.reportType),
        escapeCsvValue(row.massRange),
        escapeCsvValue(row.polarity),
        escapeCsvValue(row.fileName),
        escapeCsvValue(row.date),
        escapeCsvValue(row.referenceMass),
        escapeCsvValue(row.measuredMass),
        escapeCsvValue(row.diff),
        escapeCsvValue(row.intensity),
        escapeCsvValue(row.resolution),
        escapeCsvValue(row.mcp)
      ])
    );
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...allRows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "calibration_summary_all.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Global Actions */}
      <div className="flex justify-end">
        <button 
            onClick={downloadAllCsv}
            className="text-sm flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-200 font-medium px-4 py-2 rounded-lg transition-all shadow-sm"
          >
            <Download className="w-4 h-4" /> Export All as CSV
        </button>
      </div>

      {/* Render a table for each group */}
      {groupKeys.map(key => {
        const group = groupedData[key];
        
        return (
          <div key={key} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            
            {/* Group Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="bg-white p-1.5 rounded-md border border-slate-200 shadow-sm">
                   <Layers className="w-4 h-4 text-slate-500" />
                 </div>
                 <div className="flex flex-col">
                    <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Configuration</span>
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                       {group.type} 
                       <span className="text-slate-300">•</span> 
                       {group.range} 
                       <span className="text-slate-300">•</span> 
                       <span className={clsx(
                         group.polarity.toLowerCase().includes('pos') ? "text-purple-600" : 
                         group.polarity.toLowerCase().includes('neg') ? "text-orange-600" : "text-slate-600"
                       )}>{group.polarity}</span>
                    </div>
                 </div>
              </div>
              <div className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
                 {group.rows.length} records
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-100">File Name</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-100">Date</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-100">Ref Mass</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-100">Measured</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-100">Diff</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-100">Intensity</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-100">Resolution</th>
                    <th className="px-4 py-3 whitespace-nowrap bg-slate-100">MCP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2 font-medium text-slate-800 max-w-[200px] truncate" title={row.fileName}>
                        {row.fileName}
                      </td>
                      <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{row.date}</td>
                      <td className="px-4 py-2 font-mono text-slate-700">{row.referenceMass}</td>
                      <td className="px-4 py-2 font-mono text-slate-600">{row.measuredMass}</td>
                      <td className="px-4 py-2 font-mono font-medium text-slate-800">{row.diff}</td>
                      <td className="px-4 py-2 text-slate-500">{row.intensity}</td>
                      <td className="px-4 py-2 text-slate-500">{row.resolution}</td>
                      <td className="px-4 py-2 text-slate-500">{row.mcp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};