import { getDriveClient } from './_shared.js';

const getQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const drive = getDriveClient();
    const folderId = getQueryValue(req.query?.folderId);

    if (!folderId) {
      res.status(400).json({ error: 'Missing folderId' });
      return;
    }

    const response = await drive.files.list({
      q: `mimeType = 'application/pdf' and trashed = false and '${folderId}' in parents`,
      fields: 'files(id, name, modifiedTime, size)',
      orderBy: 'modifiedTime desc',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    res.status(200).json({
      files: response.data.files || []
    });
  } catch (error) {
    console.error('Drive list-pdfs error:', error);
    res.status(500).json({ error: error?.message || 'Failed to list PDFs' });
  }
}
