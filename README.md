<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# TuneReport AI Parser

<div align="center">

[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vercel](https://img.shields.io/badge/Vercel-Deploy-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![Commit Activity](https://img.shields.io/github/commit-activity/m/JustinZZW/TuneReport)](https://github.com/JustinZZW/TuneReport/commits/main)
[![Last Commit](https://img.shields.io/github/last-commit/JustinZZW/TuneReport)](https://github.com/JustinZZW/TuneReport/commits/main)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

[TuneReport AI Parser](https://tunereport-ai-parser.vercel.app/) is a Vite + React app that ingests instrument PDF reports, extracts structured
metadata with Gemini, and visualizes QTOF instrument status trends. It supports Google Drive sync for both
raw PDFs and parsed JSON results, allowing state to persist across deployments.

## Architecture and Design

- **Frontend (Vite + React)**
  - Upload/drag PDFs for parsing.
  - List view with search, filters, sorting, and inline comments.
  - Summary view aggregating calibration rows and exporting CSV.
  - Visualization view with configurable filters, date range, and zoom.
- **Parsing Pipeline**
  - PDF text extraction via `pdfjs-dist`.
  - Gemini prompt parsing into a structured schema.
  - Filename metadata normalization for report type, mass range, polarity, and time.
- **Persistence**
  - Local storage cache for quick reloads.
  - Optional Google Drive persistence for PDFs and results JSON.
- **Backend (Vercel Serverless)**
  - `/api/drive/*` routes for listing, downloading, and uploading Drive files.
  - Shared Drive support for Service Account write access.

## Key Screens

<div align="center">
  <img src="https://raw.githubusercontent.com/JustinZZW/blogImg/main/202602120913049.png" width="900" alt="UI Overview" />
</div>

## Implementation Notes

- PDF parsing is synchronous per file to provide reliable progress and error capture.
- Results are stored as `<PDF name>.labreport.json` alongside PDFs in Drive.
- Comments are saved into results JSON and loaded back on startup.
- Visualizations are grouped by report type, mass range, and polarity, with selectable date ranges.

## Usage

1. Upload PDFs via the Upload button or drag-and-drop.
2. Use the List view to add comments and manage records.
3. Use Summary to export CSV and review calibration rows.
4. Use Visualization for interactive trend exploration.

## Local Development

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set `VITE_GEMINI_API_KEY` in `.env.local`.
3. Start the dev server:
   `npm run dev`

> Note: `/api/drive/*` routes only work under `vercel dev`.

## Google Drive Sync (Vercel Backend)

This project uses a Google Service Account for Drive access. Write operations require a Shared Drive.
Share the target Shared Drive with the service account email.

**Required environment variables:**

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (replace newlines with `\n`)

**Local backend preview:**

`vercel dev`

## Deployment (Vercel)

1. Set environment variables in Vercel (Production/Preview/Development):
   - `VITE_GEMINI_API_KEY`
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
2. Deploy:
   `npx vercel --prod`

## Developer

- **Zhiwei Zhou**, PhD (Department of Pathology, Stanford University)

## License

MIT
