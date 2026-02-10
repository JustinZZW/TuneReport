import { getDriveClient } from './_shared.js';

const getQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

const sanitizeFileName = (name) => name.replace(/[\\/]/g, '_');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const drive = getDriveClient();
    const fileId = getQueryValue(req.query?.fileId);
    const fileName = getQueryValue(req.query?.fileName) || 'report.pdf';

    if (!fileId) {
      res.status(400).json({ error: 'Missing fileId' });
      return;
    }

    const response = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFileName(fileName)}"`);

    response.data.on('error', (error) => {
      console.error('Drive download stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to download PDF' });
      }
    });

    response.data.pipe(res);
  } catch (error) {
    console.error('Drive download error:', error);
    res.status(500).json({ error: error?.message || 'Failed to download PDF' });
  }
}
