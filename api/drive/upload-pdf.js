import { getDriveClient } from './_shared.js';
import { Readable } from 'node:stream';

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
    const base64 = req.body?.base64;

    if (!folderId || !fileName) {
      res.status(400).json({ error: 'Missing folderId or fileName' });
      return;
    }

    if (!base64 || typeof base64 !== 'string') {
      res.status(400).json({ error: 'Missing base64 PDF payload' });
      return;
    }

    const existingFileId = await findExistingFileId(drive, folderId, fileName);
    if (existingFileId) {
      res.status(200).json({ id: existingFileId, updated: false, exists: true });
      return;
    }

    const buffer = Buffer.from(base64, 'base64');
    const media = {
      mimeType: 'application/pdf',
      body: Readable.from(buffer)
    };

    const createResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: 'application/pdf'
      },
      media,
      fields: 'id',
      supportsAllDrives: true
    });

    res.status(200).json({ id: createResponse.data.id, updated: false, exists: false });
  } catch (error) {
    console.error('Drive upload-pdf error:', error);
    res.status(500).json({ error: error?.message || 'Failed to upload PDF' });
  }
}
