import { getDriveClient } from './_shared.js';

const getQueryValue = (value) => (Array.isArray(value) ? value[0] : value);

const findExistingFileId = async (drive, folderId, fileName) => {
  const response = await drive.files.list({
    q: `name = '${fileName.replace(/'/g, "\\'")}' and trashed = false and '${folderId}' in parents`,
    fields: 'files(id, name)',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  });

  const files = response.data.files || [];
  return files.length > 0 ? files[0].id : null;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const drive = getDriveClient();
    const folderId = getQueryValue(req.query?.folderId);
    const fileName = getQueryValue(req.query?.fileName);
    const payload = req.body;

    if (!folderId || !fileName) {
      res.status(400).json({ error: 'Missing folderId or fileName' });
      return;
    }

    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Missing JSON payload' });
      return;
    }

    const media = {
      mimeType: 'application/json',
      body: JSON.stringify(payload)
    };

    const existingFileId = await findExistingFileId(drive, folderId, fileName);

    if (existingFileId) {
      const updateResponse = await drive.files.update({
        fileId: existingFileId,
        media,
        supportsAllDrives: true
      });
      res.status(200).json({ id: updateResponse.data.id, updated: true });
      return;
    }

    const createResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: 'application/json'
      },
      media,
      fields: 'id',
      supportsAllDrives: true
    });

    res.status(200).json({ id: createResponse.data.id, updated: false });
  } catch (error) {
    console.error('Drive upload-result error:', error);
    res.status(500).json({ error: error?.message || 'Failed to upload result file' });
  }
}
