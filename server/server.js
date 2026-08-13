const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/users');

const app = express();
app.set('trust proxy', 1); 

// Global CORS Handler for Vercel
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, X-CSRF-Token, Accept, Accept-Version, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  next();
});

const PORT = process.env.PORT || 5000;

mongoose.connection.on('connected', () => {});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {});

let dbConnectionPromise = null;
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  if (!dbConnectionPromise) {
    await loadAzureSecrets();
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI is missing in environment variables');
    }
    dbConnectionPromise = mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }).catch(err => {
      dbConnectionPromise = null;
      throw err;
    });
  }
  await dbConnectionPromise;
}

// CORS handled globally at the top

app.use(helmet());
app.use(express.json({ limit: '2mb' })); 
app.use(express.urlencoded({ limit: '2mb', extended: true })); 

const sanitizeInput = require('./middleware/sanitize');
app.use(sanitizeInput);

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 300, 
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Too many requests, please try again later.' }
});

app.use(generalLimiter);

const arabicResponse = require('./middleware/arabicResponse');
app.use(arabicResponse);

// Ensure DB is connected before processing any API route (crucial for Vercel serverless)
app.use(async (req, res, next) => {
  if (req.path === '/ping') return next();
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('❌ Database connection error on request:', err.message);
    res.status(500).json({ msg: 'Database connection failed', error: err.message });
  }
});

app.use('/api/auth', authRoutes); 
app.use('/api/users', userRoutes); 
app.use('/api/classes', require('./routes/classRoutes')); 
app.use('/api/attendance', require('./routes/attendanceRoutes')); 
app.use('/api/assignment', require('./routes/assign_Students')); 
app.use('/api/notifications', require('./routes/notifications')); 
app.use('/api/students', require('./routes/studentRoutes')); 
app.use('/api/birthdays', require('./routes/birthdays'));
app.use('/api/telegram', require('./routes/telegramRoutes')); 
app.use('/api/tayo', require('./routes/tayo')); 
app.use('/api/backup', require('./routes/backupRoutes')); 
app.use('/api/cron', require('./routes/cronRoutes'));
app.use('/api/rss', require('./routes/rssRoutes'));
app.use('/api/promotion', require('./routes/promotion'));

app.get('/ping', (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ msg: 'Malformed JSON payload provided.' });
  }
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ msg: 'Payload too large. Exceeds maximum allowed limit.' });
  }
  next(err);
});

async function loadAzureSecrets() {
  const vaultName = process.env.AZURE_KEYVAULT_NAME;
  if (vaultName) {
    try {
      const { DefaultAzureCredential } = require('@azure/identity');
      const { SecretClient } = require('@azure/keyvault-secrets');
      
      const url = `https://${vaultName}.vault.azure.net`;
      const credential = new DefaultAzureCredential();
      const client = new SecretClient(url, credential);

      const mongoUriSecret = await client.getSecret('MONGO-URI');
      process.env.MONGO_URI = mongoUriSecret.value;      
      
      try {
        const jwtSecret = await client.getSecret('JWT-SECRET');
        process.env.JWT_SECRET = jwtSecret.value;
      } catch (e) {
        console.warn('ℹ️ [Secrets] JWT-SECRET not found in Key Vault, using local environment value.');
      }
    } catch (err) {
      console.error('❌ [Secrets] Failed to fetch secrets from Azure Key Vault:', err.message);
    }
  }
}

async function startServer() {
  try {
    await connectDB();
    try {
      const { initializeTelegram } = require('./services/telegramClient');
      await initializeTelegram();
    } catch (err) {
      console.error('❌ Failed to initialize Telegram Service:', err);
    }

    if (!process.env.VERCEL) {
      app.listen(PORT, '0.0.0.0', () => {});
    }
  } catch (err) {
    console.error('MongoDB connection error in startServer:', err);
  }
}

startServer();

const { translateMessage } = require('./utils/translations');
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const msg = err && err.message ? translateMessage(err.message) : translateMessage('Server error');
  res.status(500).json({ msg });
});

module.exports = app;