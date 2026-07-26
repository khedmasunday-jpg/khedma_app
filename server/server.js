require('dotenv').config();
if (!process.env.VERCEL) {
  require('./jobs/backupJob');
  require('./jobs/promotionJob');
  require('./jobs/weeklyreminder');
}
const { runBirthdayJob } = require('./jobs/birthdayJob');

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/users');

const app = express();
app.set('trust proxy', 1); 
const PORT = process.env.PORT || 5000;

mongoose.connection.on('connected', () => {});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {});

// CORS: Paused strict origin check for local testing
app.use(cors());

app.use(helmet());
app.use(express.json({ limit: '2mb' })); 
app.use(express.urlencoded({ limit: '2mb', extended: true })); 

const sanitizeInput = require('./middleware/sanitize');
app.use(sanitizeInput);

const rateLimit = require('express-rate-limit');
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
  if (vaultName) {    try {
      const { DefaultAzureCredential } = require('@azure/identity');
      const { SecretClient } = require('@azure/keyvault-secrets');
      
      const url = `https://${vaultName}.vault.azure.net`;
      const credential = new DefaultAzureCredential();
      const client = new SecretClient(url, credential);

      const mongoUriSecret = await client.getSecret('MONGO-URI');
      process.env.MONGO_URI = mongoUriSecret.value;      
      
      try {
        const jwtSecret = await client.getSecret('JWT-SECRET');
        process.env.JWT_SECRET = jwtSecret.value;      } catch (e) {
        console.warn('ℹ️ [Secrets] JWT-SECRET not found in Key Vault, using local environment value.');
      }
    } catch (err) {
      console.error('❌ [Secrets] Failed to fetch secrets from Azure Key Vault:', err.message);    }
  }
}

async function startServer() {
  
  await loadAzureSecrets();

  mongoose
    .connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(async () => { 

      try {
        const { triggerQueueWorker } = require('./services/notificationService');
        const { initializeScheduler } = require('./services/schedulerService');
        const { initializeTelegram } = require('./services/telegramClient');
        
        if (!process.env.VERCEL) {
          await initializeTelegram();
          triggerQueueWorker();
          await initializeScheduler();
        }      } catch (err) {
        console.error('❌ Failed to initialize WhatsApp/Scheduler Services:', err);
      }

      if (!process.env.VERCEL) {
        app.listen(PORT, '0.0.0.0', () => {      });
      }
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err); 
    });
}

startServer();

const { translateMessage } = require('./utils/translations');
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const msg = err && err.message ? translateMessage(err.message) : translateMessage('Server error');
  res.status(500).json({ msg });
});

module.exports = app;