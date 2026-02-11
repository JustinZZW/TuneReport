export interface ResultItem {
  parameter: string;
  value: string;
  unit: string;
  status: 'Pass' | 'Fail' | 'Warning' | 'Normal' | 'Unknown';
}

export interface CalibrationRow {
  referenceMass: string;
  measuredMass: string;
  diff: string;
  intensity?: string;
  resolution?: string;
  mcp?: string;
}

export interface InstrumentReport {
  id: string; // UUID for local storage
  fileName: string;
  parsedAt: string;
  comment?: string;
  
  // Extracted Data
  reportType?: string; // e.g. "TOF Mass Calibration" (From filename or First line)
  reportId: string;
  reportDate: string;
  instrumentName: string;
  sampleId: string;
  massRange?: string; // From filename or text
  slicerMode?: string;
  polarity?: string; // From filename (e.g. Positive/Negative)
  results: ResultItem[];
  tofCalibrationData?: CalibrationRow[];
  summary: string;
  overallStatus: 'Pass' | 'Fail' | 'Review Needed';
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  READING_PDF = 'READING_PDF',
  ANALYZING_AI = 'ANALYZING_AI',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}