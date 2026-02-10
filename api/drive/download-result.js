import { getDriveClient } from './_shared.js';

const getQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const drive = getDriveClient();
    const fileId = getQueryValue(req.query?.fileId);

    if (!fileId) {
      res.status(400).json({ error: 'Missing fileId' });
      return;
    }

    const response = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    res.setHeader('Content-Type', 'application/json');
    response.data.on('error', (error) => {
      console.error('Drive download-result stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download result file' });
      }
    });

    response.data.pipe(res);
  } catch (error) {
    console.error('Drive download-result error:', error);
    res.status(500).json({ error: error?.message || 'Failed to download result file' });
  }
}
