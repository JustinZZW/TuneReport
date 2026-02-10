import { getDriveClient } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const drive = getDriveClient();
    const response = await drive.drives.list({
      fields: 'drives(id, name)',
      pageSize: 100
    });

    res.status(200).json({
      drives: response.data.drives || []
    });
  } catch (error) {
    console.error('Drive list-drives error:', error);
    res.status(500).json({ error: error?.message || 'Failed to list drives' });
  }
}
