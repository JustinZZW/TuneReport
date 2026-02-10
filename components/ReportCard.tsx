import React from 'react';
import { InstrumentReport, ResultItem } from '../types';
import { FileText, CheckCircle, XCircle, AlertCircle, Calendar, Microscope, Beaker, Table2, Layers, Gauge, Activity, Zap } from 'lucide-react';
import clsx from 'clsx';

interface ReportCardProps {
  report: InstrumentReport;
  onClose: () => void;
  onDelete: (id: string) => void;
}

const ReportCard: React.FC<ReportCardProps> = ({ report, onClose, onDelete }) => {
  
  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Pass': return 'text-green-600 bg-green-50 border-green-200';
      case 'Fail': return 'text-red-600 bg-red-50 border-red-200';
      case 'Warning': return 'text-amber-600 bg-amber-50 border-amber-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'Pass': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'Fail': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'Warning': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default: return <div className="w-4 h-4 rounded-full bg-slate-300" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={clsx("px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wider", getStatusColor(report.overallStatus))}>
                {report.overallStatus}
              </span>
              <span className="text-slate-400 text-xs">{report.parsedAt}</span>
            </div>
            {/* Title uses File Name now */}
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
               <FileText className="w-5 h-5 text-slate-500" />
               {report.fileName}
            </h2>
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
              Sample ID: <span className="font-medium text-slate-700">{report.sampleId}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <span className="sr-only">Close</span>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
             <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
               <div className="flex items-center gap-2 text-slate-500 text-xs mb-1 uppercase font-semibold tracking-wide">
                 <Calendar className="w-3 h-3" /> Report Date
               </div>
               <div className="text-slate-800 font-medium truncate">{report.reportDate}</div>
             </div>
             <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
               <div className="flex items-center gap-2 text-slate-500 text-xs mb-1 uppercase font-semibold tracking-wide">
                 <Microscope className="w-3 h-3" /> Instrument
               </div>
               <div className="text-slate-800 font-medium truncate">{report.instrumentName}</div>
             </div>
             <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
               <div className="flex items-center gap-2 text-slate-500 text-xs mb-1 uppercase font-semibold tracking-wide">
                 <Beaker className="w-3 h-3" /> Report ID
               </div>
               <div className="text-slate-800 font-medium truncate">{report.reportId}</div>
             </div>
          </div>

          {/* Report Details (Type, Mass Range, Polarity, Slicer) & Summary */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">Report Details</h3>
            <div className="flex flex-wrap gap-3 mb-4">
               {report.reportType && (
                 <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-md text-sm border border-indigo-100">
                   <Activity className="w-3.5 h-3.5" />
                   <span className="font-medium">{report.reportType}</span>
                 </div>
               )}
               {report.massRange && (
                 <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-sm border border-slate-200">
                   <Gauge className="w-3.5 h-3.5 text-slate-500" />
                   <span>Mass Range: {report.massRange}</span>
                 </div>
               )}
               {report.polarity && (
                 <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-md text-sm border border-purple-100">
                   <Zap className="w-3.5 h-3.5" />
                   <span>Polarity: {report.polarity}</span>
                 </div>
               )}
               {report.slicerMode && (
                 <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md text-sm border border-slate-200">
                   <Layers className="w-3.5 h-3.5 text-slate-500" />
                   <span>Slicer Mode: {report.slicerMode}</span>
                 </div>
               )}
            </div>
            
            <p className="text-sm text-slate-600 bg-blue-50/50 p-4 rounded-lg border border-blue-100 leading-relaxed">
              {report.summary}
            </p>
          </div>

          {/* TOF Calibration Table */}
          {report.tofCalibrationData && report.tofCalibrationData.length > 0 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
               <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                 <Table2 className="w-4 h-4 text-blue-500" />
                 TOF Mass Calibration Data
               </h3>
               <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                 <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-500 font-medium border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2">Reference Mass</th>
                          <th className="px-4 py-2">Measured Mass</th>
                          <th className="px-4 py-2">Diff / Error</th>
                          <th className="px-4 py-2">Intensity</th>
                          <th className="px-4 py-2">Resolution</th>
                          <th className="px-4 py-2">MCP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {report.tofCalibrationData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-100/50">
                            <td className="px-4 py-2 text-slate-700 font-medium font-mono">{row.referenceMass}</td>
                            <td className="px-4 py-2 text-slate-600 font-mono">{row.measuredMass}</td>
                            <td className="px-4 py-2 text-slate-600">{row.diff}</td>
                            <td className="px-4 py-2 text-slate-500">{row.intensity || '-'}</td>
                            <td className="px-4 py-2 text-slate-500">{row.resolution || '-'}</td>
                            <td className="px-4 py-2 text-slate-500">{row.mcp || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                 </div>
               </div>
            </div>
          )}

          {/* General Results Table */}
          {report.results.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Extracted Results</h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Parameter</th>
                      <th className="px-4 py-3">Value</th>
                      <th className="px-4 py-3">Unit</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.results.map((res, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-800 font-medium">{res.parameter}</td>
                        <td className="px-4 py-3 text-slate-600">{res.value}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{res.unit}</td>
                        <td className="px-4 py-3 text-right flex justify-end items-center gap-2">
                          <span className={clsx("text-xs font-semibold", 
                            res.status === 'Pass' ? "text-green-600" : 
                            res.status === 'Fail' ? "text-red-600" : "text-slate-500"
                          )}>
                            {res.status}
                          </span>
                          <StatusIcon status={res.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <button 
            onClick={() => { onDelete(report.id); onClose(); }}
            className="text-red-500 hover:text-red-700 text-sm font-medium px-4 py-2 hover:bg-red-50 rounded-lg transition-colors"
          >
            Delete Record
          </button>
          <button 
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-slate-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportCard;