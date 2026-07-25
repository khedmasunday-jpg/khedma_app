const { google } = require('googleapis');
const readline = require('readline');

// Usage: node scripts/get-oauth-token.js <CLIENT_ID> <CLIENT_SECRET>

const clientId = process.argv[2];
const clientSecret = process.argv[3];

if (!clientId || !clientSecret) {
  console.log('Usage: node scripts/get-oauth-token.js <CLIENT_ID> <CLIENT_SECRET>');
  process.exit(1);
}

const REDIRECT_URI = 'https://developers.google.com/oauthplayground';
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'],
  prompt: 'consent'
});

console.log('\n--- Google OAuth Token Generator ---');
console.log('1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Authorize with your Google Account.');
console.log('3. Copy the authorization code from the browser and paste it below:\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Enter Code: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\n✅ Success! Here are your credentials for server/.env:\n');
    console.log(`GOOGLE_CLIENT_ID=${clientId}`);
    console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  } catch (err) {
    console.error('❌ Error getting token:', err.message);
  }
  rl.close();
});
