import { google } from 'googleapis';

const getEnvValue = (value) => (Array.isArray(value) ? value[0] : value);

export const getDriveClient = () => {
  const clientEmail = getEnvValue(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  const privateKeyRaw = getEnvValue(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);

  if (!clientEmail || !privateKeyRaw) {
    throw new Error('Missing Google service account env vars. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.');
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive']
  });

  return google.drive({ version: 'v3', auth });
};
