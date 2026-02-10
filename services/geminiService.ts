import { GoogleGenAI, Type } from "@google/genai";
import { InstrumentReport } from '../types';

// Initialize Gemini Client
// Note: Vite only exposes env vars prefixed with VITE_ to the client.
const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

if (!apiKey) {
  console.warn('Missing VITE_GEMINI_API_KEY. Gemini calls will fail until it is set.');
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export const parseInstrumentReport = async (rawText: string, fileName: string): Promise<Partial<InstrumentReport>> => {
  if (!apiKey) {
    throw new Error('Missing VITE_GEMINI_API_KEY. Set it in .env.local and restart the dev server.');
  }

  const model = "gemini-3-flash-preview";
  const maxAttempts = 3;
  const baseDelayMs = 1000;

  const prompt = `
    You are an expert laboratory data assistant. 
    Analyze the following text extracted from an instrument PDF report.
    
    Tasks:
    1. Extract the "Report Type". This is usually the very first line of the text (e.g., "TOF Mass Calibration", "Q-TOFCheckTune", "TOFTransmissionTune", "Q-TOFTransmissionTune", "TOFSystemTune", "Q-TOFSystemTune").
    2. Extract key metadata: Report ID, Date, Instrument, Sample ID.
    3. Look for specific instrument settings: "Mass Range" and "Slicer Mode".
    4. Extract the main results table into 'results'.
    5. SPECIFICALLY look for a table labeled "TOF Mass Calibration Data" or similar. Extract all rows from this table into 'tofCalibrationData'. 
       - Columns usually include Reference Mass, Measured Mass, Error/Diff, Intensity, Resolution, and MCP.
     6. Provide a brief summary using this template:
       "The {reportType} for the {massRange} in {polarity} polarity was successful with negligible corrected residuals across the calibrated mass range."
    7. Determine overall status.

    If specific fields are missing, infer reasonable defaults or mark as "Unknown".
     Use the filename metadata if it is more reliable for reportType/massRange/polarity/time.

    Input Text:
    ${rawText.substring(0, 30000)} // Truncate if too long
  `;

  const generateContent = async () => ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reportType: { type: Type.STRING, description: "The title or type found on the first line of the text" },
          reportId: { type: Type.STRING, description: "The unique ID of the report found in text" },
          reportDate: { type: Type.STRING, description: "Date of the report YYYY-MM-DD" },
          instrumentName: { type: Type.STRING, description: "Name or model of the instrument" },
          sampleId: { type: Type.STRING, description: "Identifier for the sample tested" },
          massRange: { type: Type.STRING, description: "The mass range setting used" },
          slicerMode: { type: Type.STRING, description: "The slicer mode setting" },
          results: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                parameter: { type: Type.STRING },
                value: { type: Type.STRING },
                unit: { type: Type.STRING },
                status: { type: Type.STRING, enum: ['Pass', 'Fail', 'Warning', 'Normal', 'Unknown'] }
              }
            }
          },
          tofCalibrationData: {
            type: Type.ARRAY,
            description: "Rows from the TOF Mass Calibration Data table",
            items: {
              type: Type.OBJECT,
              properties: {
                referenceMass: { type: Type.STRING, description: "Reference/Expected Mass" },
                measuredMass: { type: Type.STRING, description: "Measured/Observed Mass" },
                diff: { type: Type.STRING, description: "Difference or Error (ppm/mDa)" },
                intensity: { type: Type.STRING, description: "Intensity or Area count if available" },
                resolution: { type: Type.STRING, description: "Resolution value" },
                mcp: { type: Type.STRING, description: "MCP value" }
              },
              required: ["referenceMass", "measuredMass", "diff"]
            }
          },
          summary: { type: Type.STRING, description: "A brief 1-sentence summary of the findings" },
          overallStatus: { type: Type.STRING, enum: ['Pass', 'Fail', 'Review Needed'] }
        },
        required: ["reportId", "results", "overallStatus"]
      }
    }
  });

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const isRetryableError = (error: any) => {
    const message = error?.message || '';
    const status = error?.status || error?.error?.status || error?.error?.code;
    return status === 429 || status === 503 || /UNAVAILABLE|RESOURCE_EXHAUSTED|rate|quota|temporar/i.test(message);
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await generateContent();
      const resultText = response.text;
      if (!resultText) throw new Error("No response from AI");

      const parsedData = JSON.parse(resultText);

      return {
        fileName,
        ...parsedData
      };
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableError(error)) {
        console.error("Gemini Extraction Error:", error);
        throw new Error("Failed to extract data using AI.");
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await wait(delay);
    }
  }

  throw new Error("Failed to extract data using AI.");
};