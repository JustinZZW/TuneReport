import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Upload, Database, Plus, Search, Loader2, FileText, BarChart3, Trash2, Table, LayoutList, TrendingUp, RefreshCw, CloudDownload } from 'lucide-react';
import { InstrumentReport, ProcessingStatus } from './types';
import { extractTextFromPdf } from './services/pdfService';
import { parseInstrumentReport } from './services/geminiService';
import EmptyState from './components/EmptyState';
import ReportCard from './components/ReportCard';
import { CalibrationSummary } from './components/CalibrationSummary';
import { VisualizationView } from './components/VisualizationView';
import clsx from 'clsx';

function App() {
  // State
  const [reports, setReports] = useState<InstrumentReport[]>([]);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<InstrumentReport | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'summary' | 'visualization'>('list');
  const [listTypeFilter, setListTypeFilter] = useState('All');
  const [listRangeFilter, setListRangeFilter] = useState('All');
  const [listPolarityFilter, setListPolarityFilter] = useState('All');
  const [listStartDate, setListStartDate] = useState('');
  const [listEndDate, setListEndDate] = useState('');
  const [listSortBy, setListSortBy] = useState<'date-desc' | 'date-asc' | 'type' | 'mass'>('date-desc');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [driveList, setDriveList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedDriveId, setSelectedDriveId] = useState('');
  const [driveFolders, setDriveFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [drivePath, setDrivePath] = useState<Array<{ id: string; name: string }>>([]);
  const [driveFolderId, setDriveFolderId] = useState('');
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncOnlyNew, setSyncOnlyNew] = useState(true);
  const [lastDriveSync, setLastDriveSync] = useState<string | null>(null);
  const [storeResultsToDrive, setStoreResultsToDrive] = useState(true);
  const [autoLoadResults, setAutoLoadResults] = useState(true);
  const [lastDriveLoad, setLastDriveLoad] = useState<string | null>(null);
  const [driveResultStatus, setDriveResultStatus] = useState<string | null>(null);
  const driveSyncInProgressRef = useRef(false);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('lab_reports_db');
    if (saved) {
      try {
        setReports(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load local database", e);
      }
    }
  }, []);

  // Save to local storage whenever reports change
  useEffect(() => {
    localStorage.setItem('lab_reports_db', JSON.stringify(reports));
  }, [reports]);

  // Helper to parse filename metadata
  const parseFileNameMetadata = (fileName: string) => {
    const name = fileName.replace(/\.pdf$/i, '');
    const parts = name.split('_');

    const metadata = {
      reportType: '',
      massRange: '',
      polarity: '',
      reportDate: ''
    };

    if (parts.length >= 3) {
      const firstPart = parts[0];
      const dashIndex = firstPart.lastIndexOf('-');
      
      if (dashIndex !== -1) {
        metadata.reportType = firstPart.substring(0, dashIndex);
        metadata.massRange = firstPart.substring(dashIndex + 1);
      } else {
        metadata.reportType = firstPart;
      }

      const polarityRaw = parts[1] || '';
      metadata.polarity = polarityRaw
        ? `${polarityRaw.charAt(0).toUpperCase()}${polarityRaw.slice(1).toLowerCase()}`
        : '';

      const datePart = parts[2];
      const timePart = parts[3];

      if (datePart && datePart.length === 8) {
        metadata.reportDate = `${datePart.substring(0, 4)}-${datePart.substring(4, 6)}-${datePart.substring(6, 8)}`;
        if (timePart && timePart.length === 6) {
          metadata.reportDate += ` ${timePart.substring(0, 2)}:${timePart.substring(2, 4)}:${timePart.substring(4, 6)}`;
        }
      }
    }

    return metadata;
  };

  const formatReportType = (reportType: string) => {
    if (!reportType) return 'unknown report';
    const withSpaces = reportType.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
    const lower = withSpaces.toLowerCase();
    return lower
      .replace(/\btof\b/g, 'TOF')
      .replace(/\bq-\s*tof\b/g, 'Q-TOF');
  };

  const formatMassRange = (massRange: string) => {
    if (!massRange) return 'unknown m/z range';
    const normalized = massRange.replace(/(\d+)mzrange/i, '$1 m/z range');
    return normalized.replace(/\s+/g, ' ').trim();
  };

  const buildSummary = (reportType: string, massRange: string, polarity: string) => {
    const typeLabel = formatReportType(reportType);
    const massRangeLabel = formatMassRange(massRange);
    const polarityLabel = polarity ? polarity.toLowerCase() : 'unknown';
    return `The ${typeLabel} for the ${massRangeLabel} in ${polarityLabel} polarity was successful with negligible corrected residuals across the calibrated mass range.`;
  };

  const buildResultFileName = (fileName: string) => `${fileName}.labreport.json`;

  const uploadResultToDrive = useCallback(async (report: InstrumentReport) => {
    if (!storeResultsToDrive || !driveFolderId) return;

    const response = await fetch(
      `/api/drive/upload-result?folderId=${encodeURIComponent(driveFolderId)}&fileName=${encodeURIComponent(buildResultFileName(report.fileName))}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(report)
      }
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || 'Failed to save result to Drive.');
    }
  }, [driveFolderId, storeResultsToDrive]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));

    if (validFiles.length === 0) {
      setErrorMessage('Please upload valid PDF files.');
      setStatus(ProcessingStatus.ERROR);
      return;
    }

    setStatus(ProcessingStatus.READING_PDF);
    setErrorMessage(null);

    let processedCount = 0;
    let successCount = 0;
    const errors: string[] = [];

    for (const file of validFiles) {
      setLoadingMessage(`Processing ${file.name} (${processedCount + 1}/${validFiles.length})...`);
      
      try {
        // 1. Extract Text
        const text = await extractTextFromPdf(file);
        
        const fileMetadata = parseFileNameMetadata(file.name);
        
        // 2. Analyze
        setStatus(ProcessingStatus.ANALYZING_AI);
        const extractedData = await parseInstrumentReport(text, file.name);
        
        // 3. Create Record
        const newReport: InstrumentReport = {
          id: crypto.randomUUID(),
          parsedAt: new Date().toLocaleString(),
          
          reportType: fileMetadata.reportType || extractedData.reportType || "Unknown Type",
          massRange: fileMetadata.massRange || extractedData.massRange,
          polarity: fileMetadata.polarity,
          reportDate: fileMetadata.reportDate || extractedData.reportDate || new Date().toISOString().split('T')[0],
          
          reportId: extractedData.reportId || "Unknown",
          instrumentName: extractedData.instrumentName || "Unknown Instrument",
          sampleId: extractedData.sampleId || "Unknown Sample",
          slicerMode: extractedData.slicerMode,
          fileName: file.name,
          results: extractedData.results || [],
          tofCalibrationData: extractedData.tofCalibrationData || [],
          summary: buildSummary(
            fileMetadata.reportType || extractedData.reportType || "Unknown Type",
            fileMetadata.massRange || extractedData.massRange || '',
            fileMetadata.polarity || ''
          ),
          overallStatus: (extractedData.overallStatus as any) || 'Review Needed'
        };

        setReports(prev => [newReport, ...prev]);
        await uploadResultToDrive(newReport);
        successCount++;
      } catch (err: any) {
        console.error(`Error processing ${file.name}:`, err);
        errors.push(`${file.name}: ${err?.message || 'Unknown error'}`);
      }
      processedCount++;
      setStatus(ProcessingStatus.READING_PDF);
    }

    setLoadingMessage("");

    if (errors.length > 0) {
      setErrorMessage(`Failed to process ${errors.length} file(s). ${errors[0]}${errors.length > 1 ? ' (see console for details)' : ''}`);
    }

    if (successCount === 0) {
      setStatus(ProcessingStatus.ERROR);
      return;
    }

    setStatus(ProcessingStatus.COMPLETED);
    setTimeout(() => setStatus(ProcessingStatus.IDLE), 2000);
  }, [uploadResultToDrive]);

  const fetchDriveList = useCallback(async () => {
    try {
      const response = await fetch('/api/drive/list-drives');
      if (!response.ok) {
        throw new Error('Failed to load shared drives.');
      }
      const data = await response.json();
      const drives = Array.isArray(data.drives) ? data.drives : [];
      setDriveList(drives);
    } catch (error: any) {
      setDriveError(error?.message || 'Failed to load shared drives.');
    }
  }, []);

  const getRootLabel = useCallback(() => {
    if (!selectedDriveId) return 'My Drive';
    return driveList.find(drive => drive.id === selectedDriveId)?.name || 'Shared Drive';
  }, [driveList, selectedDriveId]);

  const fetchDriveFolders = useCallback(async (parentId?: string, driveId?: string) => {
    setDriveLoading(true);
    setDriveError(null);

    try {
      const query = new URLSearchParams();
      const rootParentId = driveId || 'root';
      const activeParentId = parentId || rootParentId;
      query.set('parentId', activeParentId);
      if (driveId) {
        query.set('driveId', driveId);
      }

      const response = await fetch(`/api/drive/list-folders?${query.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load Drive folders.');
      }
      const data = await response.json();
      const folders = Array.isArray(data.folders) ? data.folders : [];
      setDriveFolders(folders);
    } catch (error: any) {
      setDriveError(error?.message || 'Failed to load Drive folders.');
    } finally {
      setDriveLoading(false);
    }
  }, []);

  const enterFolder = useCallback((folder: { id: string; name: string }) => {
    setDrivePath(prev => [...prev, { id: folder.id, name: folder.name }]);
    setDriveFolderId(folder.id);
    fetchDriveFolders(folder.id, selectedDriveId || undefined);
  }, [fetchDriveFolders, selectedDriveId]);

  const goToPathIndex = useCallback((index: number) => {
    if (index < 0) {
      setDrivePath([]);
      setDriveFolderId('');
      fetchDriveFolders(selectedDriveId || 'root', selectedDriveId || undefined);
      return;
    }

    setDrivePath(prev => {
      const nextPath = prev.slice(0, index + 1);
      const targetId = nextPath[nextPath.length - 1]?.id;
      if (targetId) {
        setDriveFolderId(targetId);
        fetchDriveFolders(targetId, selectedDriveId || undefined);
      }
      return nextPath;
    });
  }, [fetchDriveFolders, selectedDriveId]);

  const syncFromDrive = useCallback(async (silent = false) => {
    if (driveSyncInProgressRef.current) return;

    if (!driveFolderId) {
      if (!silent) setDriveError('Please select a Drive folder to sync.');
      return;
    }

    driveSyncInProgressRef.current = true;
    if (!silent) setDriveLoading(true);
    setDriveError(null);

    try {
      const listResponse = await fetch(`/api/drive/list-pdfs?folderId=${encodeURIComponent(driveFolderId)}`);
      if (!listResponse.ok) {
        throw new Error('Failed to list PDFs in Drive folder.');
      }

      const listData = await listResponse.json();
      const files = Array.isArray(listData.files) ? listData.files : [];

      const existingNames = new Set(reports.map(report => report.fileName));
      const newFiles = files.filter((file: any) => file?.name && !existingNames.has(file.name));
      const filesToDownload = syncOnlyNew ? newFiles : files;

      if (filesToDownload.length === 0) {
        setLastDriveSync(new Date().toLocaleString());
        return;
      }

      if (!syncOnlyNew) {
        const fileNames = new Set(filesToDownload.map((file: any) => file?.name).filter(Boolean));
        setReports(prev => prev.filter(report => !fileNames.has(report.fileName)));
      }

      const downloadedFiles = await Promise.all(filesToDownload.map(async (file: any) => {
        const downloadResponse = await fetch(`/api/drive/download?fileId=${encodeURIComponent(file.id)}&fileName=${encodeURIComponent(file.name)}`);
        if (!downloadResponse.ok) {
          throw new Error(`Failed to download ${file.name}.`);
        }
        const blob = await downloadResponse.blob();
        return new File([blob], file.name, { type: 'application/pdf' });
      }));

      await processFiles(downloadedFiles);
      setLastDriveSync(new Date().toLocaleString());
    } catch (error: any) {
      setDriveError(error?.message || 'Drive sync failed.');
    } finally {
      driveSyncInProgressRef.current = false;
      if (!silent) setDriveLoading(false);
    }
  }, [driveFolderId, processFiles, reports, syncOnlyNew]);

  const loadResultsFromDrive = useCallback(async (silent = false) => {
    if (driveSyncInProgressRef.current) return;

    if (!driveFolderId) {
      if (!silent) setDriveError('Please select a Drive folder to load results.');
      return;
    }

    driveSyncInProgressRef.current = true;
    if (!silent) setDriveLoading(true);
    setDriveError(null);

    try {
      setDriveResultStatus('Loading results from Drive...');
      const listResponse = await fetch(`/api/drive/list-results?folderId=${encodeURIComponent(driveFolderId)}`);
      if (!listResponse.ok) {
        throw new Error('Failed to list Drive results.');
      }

      const listData = await listResponse.json();
      const files = Array.isArray(listData.files) ? listData.files : [];

      if (files.length === 0) {
        setDriveResultStatus('No result files found in Drive.');
        setLastDriveLoad(new Date().toLocaleString());
        return;
      }

      const downloadedReports = await Promise.all(files.map(async (file: any) => {
        const downloadResponse = await fetch(`/api/drive/download-result?fileId=${encodeURIComponent(file.id)}`);
        if (!downloadResponse.ok) {
          throw new Error(`Failed to download ${file.name}.`);
        }
        const report = await downloadResponse.json();
        return {
          id: report.id || crypto.randomUUID(),
          ...report
        } as InstrumentReport;
      }));

      setReports(prev => {
        const merged = new Map<string, InstrumentReport>();
        prev.forEach(report => merged.set(report.fileName, report));
        const existingNames = new Set(merged.keys());
        downloadedReports.forEach(report => merged.set(report.fileName, report));
        const addedCount = downloadedReports.filter(report => !existingNames.has(report.fileName)).length;
        setDriveResultStatus(`Loaded ${downloadedReports.length} result file(s). New: ${addedCount}.`);
        return Array.from(merged.values());
      });

      setLastDriveLoad(new Date().toLocaleString());
    } catch (error: any) {
      setDriveError(error?.message || 'Failed to load results from Drive.');
      setDriveResultStatus(null);
    } finally {
      driveSyncInProgressRef.current = false;
      if (!silent) setDriveLoading(false);
    }
  }, [driveFolderId]);

  useEffect(() => {
    fetchDriveList();
  }, [fetchDriveList]);

  useEffect(() => {
    if (!selectedDriveId && driveList.length === 1) {
      setSelectedDriveId(driveList[0].id);
    }
  }, [driveList, selectedDriveId]);

  useEffect(() => {
    const rootParentId = selectedDriveId || 'root';
    setDrivePath([]);
    setDriveFolderId('');
    fetchDriveFolders(rootParentId, selectedDriveId || undefined);
  }, [selectedDriveId, fetchDriveFolders]);

  useEffect(() => {
    if (!driveFolderId && driveFolders.length > 0) {
      setDriveFolderId(driveFolders[0].id);
    }
  }, [driveFolderId, driveFolders]);

  useEffect(() => {
    if (!autoLoadResults || !driveFolderId) return;
    loadResultsFromDrive(true);
  }, [autoLoadResults, driveFolderId, loadResultsFromDrive]);

  useEffect(() => {
    if (!autoSyncEnabled) return;
    const intervalId = window.setInterval(() => {
      syncFromDrive(true);
    }, 5 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [autoSyncEnabled, syncFromDrive]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this record?")) {
      setReports(prev => prev.filter(r => r.id !== id));
      if (selectedReport?.id === id) setSelectedReport(null);
    }
  };

  const listTypeOptions = useMemo(
    () => ['All', ...Array.from(new Set(reports.map(r => r.reportType || 'Unknown'))).sort()],
    [reports]
  );
  const listRangeOptions = useMemo(
    () => ['All', ...Array.from(new Set(reports.map(r => r.massRange || 'Unknown'))).sort()],
    [reports]
  );
  const listPolarityOptions = useMemo(
    () => ['All', ...Array.from(new Set(reports.map(r => r.polarity || 'Unknown'))).sort()],
    [reports]
  );

  const getReportDateOnly = (value: string) => value ? value.split(' ')[0] : '';

  const filteredReports = reports.filter(r => {
    const matchesSearch =
      r.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.sampleId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.instrumentName.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const type = r.reportType || 'Unknown';
    const range = r.massRange || 'Unknown';
    const polarity = r.polarity || 'Unknown';
    const dateOnly = getReportDateOnly(r.reportDate);

    if (listTypeFilter !== 'All' && type !== listTypeFilter) return false;
    if (listRangeFilter !== 'All' && range !== listRangeFilter) return false;
    if (listPolarityFilter !== 'All' && polarity !== listPolarityFilter) return false;
    if (listStartDate && dateOnly < listStartDate) return false;
    if (listEndDate && dateOnly > listEndDate) return false;

    return true;
  });

  const sortedReports = useMemo(() => {
    const sorted = [...filteredReports];
    sorted.sort((a, b) => {
      if (listSortBy === 'date-asc' || listSortBy === 'date-desc') {
        const aTime = new Date(a.reportDate).getTime();
        const bTime = new Date(b.reportDate).getTime();
        return listSortBy === 'date-asc' ? aTime - bTime : bTime - aTime;
      }
      if (listSortBy === 'type') {
        return (a.reportType || '').localeCompare(b.reportType || '');
      }
      if (listSortBy === 'mass') {
        return (a.massRange || '').localeCompare(b.massRange || '');
      }
      return 0;
    });
    return sorted;
  }, [filteredReports, listSortBy]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Database className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                LabReport AI
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:block text-sm text-slate-500">
                <span className="font-semibold text-slate-900">{reports.length}</span> reports indexed
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm shadow-blue-200"
                disabled={status !== ProcessingStatus.IDLE && status !== ProcessingStatus.COMPLETED && status !== ProcessingStatus.ERROR}
              >
                {status === ProcessingStatus.ANALYZING_AI || status === ProcessingStatus.READING_PDF ? (
                   <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                   <Plus className="w-4 h-4" />
                )}
                Upload Reports
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="application/pdf"
                multiple // Enable multiple files
                onChange={onFileChange}
              />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Processing Indicator */}
        {(status === ProcessingStatus.READING_PDF || status === ProcessingStatus.ANALYZING_AI) && (
          <div className="mb-8 bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-white p-2 rounded-full shadow-sm">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
            <div>
              <h3 className="text-blue-900 font-medium">Processing Reports...</h3>
              <p className="text-blue-700 text-sm">
                {loadingMessage || "Analyzing documents..."}
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="mb-8 bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-4">
             <div className="bg-white p-2 rounded-full shadow-sm">
               <span className="text-red-500 font-bold text-xl">!</span>
             </div>
             <div>
               <h3 className="text-red-900 font-medium">Processing Failed</h3>
               <p className="text-red-700 text-sm">{errorMessage}</p>
             </div>
          </div>
        )}

        {/* Drive Import */}
        <div className="mb-8 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-slate-800">Google Drive Folder</label>
                <button
                  onClick={fetchDriveFolders}
                  className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-blue-600"
                  disabled={driveLoading}
                >
                  <RefreshCw className={clsx("w-3.5 h-3.5", driveLoading && "animate-spin")} />
                  Refresh
                </button>
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  className="w-full sm:w-80 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={selectedDriveId}
                  onChange={(e) => {
                    setSelectedDriveId(e.target.value);
                    setDriveFolderId('');
                    setDriveFolders([]);
                  }}
                  disabled={driveLoading}
                >
                  <option value="">My Drive</option>
                  {driveList.map(drive => (
                    <option key={drive.id} value={drive.id}>{drive.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    fetchDriveList();
                    fetchDriveFolders();
                  }}
                  className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-blue-600"
                  disabled={driveLoading}
                >
                  <RefreshCw className={clsx("w-3.5 h-3.5", driveLoading && "animate-spin")} />
                  Reload Drives
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <button
                  onClick={() => goToPathIndex(-1)}
                  className="text-blue-600 hover:text-blue-700"
                  disabled={driveLoading}
                >
                  {getRootLabel()}
                </button>
                {drivePath.map((segment, index) => (
                  <button
                    key={segment.id}
                    onClick={() => goToPathIndex(index)}
                    className="flex items-center gap-1 text-slate-600 hover:text-blue-600"
                    disabled={driveLoading}
                  >
                    <span className="text-slate-300">/</span>
                    {segment.name}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  className="w-full sm:w-80 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={driveFolderId}
                  onChange={(e) => setDriveFolderId(e.target.value)}
                  disabled={driveLoading || driveFolders.length === 0}
                >
                  {driveFolders.length === 0 ? (
                    <option value="">No folders available</option>
                  ) : (
                    driveFolders.map(folder => (
                      <option key={folder.id} value={folder.id}>{folder.name}</option>
                    ))
                  )}
                </select>
                <input
                  type="text"
                  className="w-full sm:flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Or paste folder ID"
                  value={driveFolderId}
                  onChange={(e) => setDriveFolderId(e.target.value)}
                />
              </div>
              <div className="mt-3 border border-slate-200 rounded-lg p-3 bg-slate-50/60">
                <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Subfolders</div>
                <div className="mt-2 grid gap-2">
                  {driveFolders.length === 0 ? (
                    <span className="text-xs text-slate-400">No subfolders found.</span>
                  ) : (
                    driveFolders.map(folder => (
                      <button
                        key={folder.id}
                        onClick={() => enterFolder(folder)}
                        className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-blue-200 hover:text-blue-600"
                        disabled={driveLoading}
                      >
                        <span className="truncate">{folder.name}</span>
                        <span className="text-[10px] text-slate-400">Open</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Share the folder with the service account email so it can access PDFs.
              </p>
              {driveError && (
                <p className="mt-2 text-xs text-red-600">{driveError}</p>
              )}
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <button
                onClick={() => syncFromDrive(false)}
                className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium"
                disabled={driveLoading}
              >
                <CloudDownload className="w-4 h-4" />
                Sync PDFs
              </button>
              <button
                onClick={() => loadResultsFromDrive(false)}
                className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-200 px-4 py-2 rounded-lg text-sm font-medium"
                disabled={driveLoading}
              >
                Load Results
              </button>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={syncOnlyNew}
                  onChange={(e) => setSyncOnlyNew(e.target.checked)}
                />
                Only sync new files
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={storeResultsToDrive}
                  onChange={(e) => setStoreResultsToDrive(e.target.checked)}
                />
                Store results to Drive
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={autoLoadResults}
                  onChange={(e) => setAutoLoadResults(e.target.checked)}
                />
                Auto-load results on startup
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                />
                Auto-sync every 5 minutes
              </label>
              {!syncOnlyNew && (
                <span className="text-[11px] text-slate-500">
                  Re-sync will replace existing reports with the same file name.
                </span>
              )}
              {lastDriveSync && (
                <span className="text-[11px] text-slate-400">Last sync: {lastDriveSync}</span>
              )}
              {lastDriveLoad && (
                <span className="text-[11px] text-slate-400">Last results load: {lastDriveLoad}</span>
              )}
              {driveResultStatus && (
                <span className="text-[11px] text-slate-500">{driveResultStatus}</span>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="flex flex-col gap-6">
          
          {/* Controls: Search, View Toggle, Stats */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
             
             <div className="flex gap-4 items-center w-full sm:w-auto">
               <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search files..." 
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
               </div>
             </div>

             <div className="flex flex-wrap gap-3 w-full sm:w-auto justify-between sm:justify-end">
                {/* View Toggles */}
                <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                  <button 
                    onClick={() => setViewMode('list')}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      viewMode === 'list' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <LayoutList className="w-4 h-4" /> List
                  </button>
                  <button 
                    onClick={() => setViewMode('summary')}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      viewMode === 'summary' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <Table className="w-4 h-4" /> Summary
                  </button>
                  <button 
                    onClick={() => setViewMode('visualization')}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      viewMode === 'visualization' ? "bg-blue-50 text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <TrendingUp className="w-4 h-4" /> Visualization
                  </button>
                </div>

                {/* Stats Summary (Mini) */}
                <div className="flex gap-4 text-sm font-medium text-slate-600 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm items-center">
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      Pass: {reports.filter(r => r.overallStatus === 'Pass').length}
                   </div>
                   <div className="w-px h-4 bg-slate-200"></div>
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      Fail: {reports.filter(r => r.overallStatus === 'Fail').length}
                   </div>
                </div>
             </div>
          </div>

          {viewMode === 'list' && (
            <div className="flex flex-wrap gap-3 items-end bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-sm">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</span>
                <select
                  className="border border-slate-200 rounded-md px-3 py-2 text-sm"
                  value={listTypeFilter}
                  onChange={(e) => setListTypeFilter(e.target.value)}
                >
                  {listTypeOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mass Range</span>
                <select
                  className="border border-slate-200 rounded-md px-3 py-2 text-sm"
                  value={listRangeFilter}
                  onChange={(e) => setListRangeFilter(e.target.value)}
                >
                  {listRangeOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Polarity</span>
                <select
                  className="border border-slate-200 rounded-md px-3 py-2 text-sm"
                  value={listPolarityFilter}
                  onChange={(e) => setListPolarityFilter(e.target.value)}
                >
                  {listPolarityOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Start</span>
                <input
                  type="date"
                  className="border border-slate-200 rounded-md px-3 py-2 text-sm"
                  value={listStartDate}
                  onChange={(e) => setListStartDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">End</span>
                <input
                  type="date"
                  className="border border-slate-200 rounded-md px-3 py-2 text-sm"
                  value={listEndDate}
                  onChange={(e) => setListEndDate(e.target.value)}
                />
              </div>
              <button
                onClick={() => {
                  setListTypeFilter('All');
                  setListRangeFilter('All');
                  setListPolarityFilter('All');
                  setListStartDate('');
                  setListEndDate('');
                }}
                className="text-xs font-medium text-slate-500 hover:text-blue-600"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Main View Area */}
           {reports.length === 0 ? (
            <EmptyState />
          ) : viewMode === 'visualization' ? (
             <VisualizationView reports={filteredReports} />
          ) : viewMode === 'summary' ? (
             <CalibrationSummary reports={filteredReports} />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in duration-300">
               <div className="overflow-x-auto">
                 <table className="w-full text-sm text-left">
                   <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                     <tr>
                      <th className="px-6 py-4">Report File</th>
                      <th className="px-6 py-4">
                        <button
                          onClick={() => setListSortBy(listSortBy === 'date-desc' ? 'date-asc' : 'date-desc')}
                          className="flex items-center gap-1 text-slate-500 hover:text-blue-600"
                        >
                          Date
                          <span className="text-[10px]">
                            {listSortBy === 'date-desc' ? '▼' : listSortBy === 'date-asc' ? '▲' : ''}
                          </span>
                        </button>
                      </th>
                      <th className="px-6 py-4">
                        <button
                          onClick={() => setListSortBy('type')}
                          className="flex items-center gap-1 text-slate-500 hover:text-blue-600"
                        >
                          Type
                          <span className="text-[10px]">
                            {listSortBy === 'type' ? '▲' : ''}
                          </span>
                        </button>
                      </th>
                      <th className="px-6 py-4">Status</th>
                       <th className="px-6 py-4 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {sortedReports.map((report) => (
                       <tr key={report.id} className="hover:bg-slate-50/50 group transition-colors cursor-pointer" onClick={() => setSelectedReport(report)}>
                         <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                             <div className="bg-blue-50 p-2 rounded text-blue-600">
                               <FileText className="w-4 h-4" />
                             </div>
                             <div>
                               <div className="font-semibold text-slate-900">{report.fileName}</div>
                               <div className="text-xs text-slate-500">Sample: {report.sampleId}</div>
                             </div>
                           </div>
                         </td>
                         <td className="px-6 py-4 text-slate-600">{report.reportDate}</td>
                         <td className="px-6 py-4">
                           <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                             {report.reportType || "Standard Report"}
                           </span>
                         </td>
                         <td className="px-6 py-4">
                            <span className={clsx("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", 
                              report.overallStatus === 'Pass' ? "bg-green-50 text-green-700 border-green-200" :
                              report.overallStatus === 'Fail' ? "bg-red-50 text-red-700 border-red-200" :
                              "bg-amber-50 text-amber-700 border-amber-200"
                            )}>
                              {report.overallStatus}
                            </span>
                         </td>
                         <td className="px-6 py-4 text-right">
                           <button 
                             onClick={(e) => { e.stopPropagation(); handleDelete(report.id); }}
                             className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-slate-100 rounded-full"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </td>
                       </tr>
                     ))}
                     {filteredReports.length === 0 && (
                       <tr>
                         <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                           No reports match your search.
                         </td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedReport && (
        <ReportCard 
          report={selectedReport} 
          onClose={() => setSelectedReport(null)} 
          onDelete={handleDelete}
        />
      )}

    </div>
  );
}

export default App;