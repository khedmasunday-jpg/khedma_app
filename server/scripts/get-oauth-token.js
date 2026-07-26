const { google } = require('googleapis');
const readline = require('readline');

const clientId = process.argv[2];
const clientSecret = process.argv[3];

if (!clientId || !clientSecret) {
  process.exit(1);
}

const REDIRECT_URI = 'https://developers.google.com/oauthplayground';
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
  prompt: 'consent'
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter Code: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
  } catch (err) {
    console.error('❌ Error getting token:', err.message);
  }
  rl.close();
});
