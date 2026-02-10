import { getDriveClient } from './_shared.js';

const getQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const drive = getDriveClient();
    const parentId = getQueryValue(req.query?.parentId);
    const driveId = getQueryValue(req.query?.driveId);

    const qParts = ["mimeType = 'application/vnd.google-apps.folder'", 'trashed = false'];
    if (parentId) {
      qParts.push(`'${parentId}' in parents`);
    }

    const response = await drive.files.list({
      q: qParts.join(' and '),
      fields: 'files(id, name, modifiedTime, parents)',
      orderBy: 'name',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      ...(driveId ? { corpora: 'drive', driveId } : {})
    });

    res.status(200).json({
      folders: response.data.files || []
    });
  } catch (error) {
    console.error('Drive list-folders error:', error);
    res.status(500).json({ error: error?.message || 'Failed to list folders' });
  }
}
