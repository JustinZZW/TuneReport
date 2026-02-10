<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/182C5byIiE87D1iYcExfAgKqGqn25L8Ms

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `VITE_GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Google Drive Sync (Vercel Backend)

This project includes Vercel serverless routes for reading PDFs from a Google Drive folder
using a Service Account. For write access, place folders in a Shared Drive and share it with
the service account email.

**Required env vars (Vercel Project Settings):**

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (replace newlines with `\n`)

**Local development:**

Use `vercel dev` so the `/api/drive/*` routes are available during local preview.

### Results Storage

Processed reports can be stored as JSON files in Drive (same folder as PDFs).
The app can load these results on startup to restore prior sessions.
