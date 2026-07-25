require('dotenv').config();
require('./jobs/backupJob');
require('./jobs/promotionJob');
require('./jobs/weeklyreminder');
const { runBirthdayJob } = require('./jobs/birthdayJob');
//runBirthdayJob(true); // force run
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Enable CORS for cross-origin requests
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

// Add MongoDB connection logging
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
// Basic security headers
app.use(helmet());
//app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' })); // Parse JSON request bodies and limit payload size to 2MB
app.use(express.urlencoded({ limit: '2mb', extended: true })); // Parse urlencoded request bodies and limit size to 2MB

// Input sanitization middleware (XSS and NoSQL injection protection)
const sanitizeInput = require('./middleware/sanitize');
app.use(sanitizeInput);

const rateLimit = require('express-rate-limit');
// General rate limiter for all endpoints (15 minutes, max 200 requests)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: 'Too many requests, please try again later.' }
});

// app.use(generalLimiter); // ⚠️ Paused for local testing. Uncomment when going live!

// Arabic response translator (translates common 'msg' fields to Arabic)
const arabicResponse = require('./middleware/arabicResponse');
app.use(arabicResponse);


// Routes
app.use('/api/auth', authRoutes); // Mount authentication routes
app.use('/api/users', userRoutes); // Mount user-related routes
app.use('/api/classes', require('./routes/classRoutes')); // Mount class routes
app.use('/api/attendance', require('./routes/attendanceRoutes')); // Mount attendance routes
app.use('/api/assignment', require('./routes/assign_Students')); // Mount assignment routes
app.use('/api/notifications', require('./routes/notifications')); // Mount notification routes
app.use('/api/students', require('./routes/studentRoutes')); // Mount student routes
app.use('/api/birthdays', require('./routes/birthdays'));
app.use('/api/telegram', require('./routes/telegramRoutes')); // Mount Telegram notification routes
app.use('/api/tayo', require('./routes/tayo')); // Mount Tayo routes
app.use('/api/backup', require('./routes/backupRoutes')); // Mount Backup routes

// Simple ping endpoint for device reachability tests
app.get('/ping', (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

// Load Azure Secrets if deployed in Azure
async function loadAzureSecrets() {
  const vaultName = process.env.AZURE_KEYVAULT_NAME;
  if (vaultName) {
    console.log(`🔒 [Secrets] Connecting to Azure Key Vault: ${vaultName}...`);
    try {
      const { DefaultAzureCredential } = require('@azure/identity');
      const { SecretClient } = require('@azure/keyvault-secrets');
      
      const url = `https://${vaultName}.vault.azure.net`;
      const credential = new DefaultAzureCredential();
      const client = new SecretClient(url, credential);
      
      // Fetch MONGO_URI from Key Vault
      const mongoUriSecret = await client.getSecret('MONGO-URI');
      process.env.MONGO_URI = mongoUriSecret.value;
      console.log('✅ [Secrets] Successfully loaded MONGO_URI from Azure Key Vault.');
      
      // Fetch JWT_SECRET if stored there
      try {
        const jwtSecret = await client.getSecret('JWT-SECRET');
        process.env.JWT_SECRET = jwtSecret.value;
        console.log('✅ [Secrets] Successfully loaded JWT_SECRET from Azure Key Vault.');
      } catch (e) {
        console.warn('ℹ️ [Secrets] JWT-SECRET not found in Key Vault, using local environment value.');
      }
    } catch (err) {
      console.error('❌ [Secrets] Failed to fetch secrets from Azure Key Vault:', err.message);
      console.log('Fallback: Using local environment variables.');
    }
  }
}

async function startServer() {
  // Load secrets from Azure Key Vault if configured
  await loadAzureSecrets();

  // Connect to MongoDB
  mongoose
    .connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then(async () => {
      console.log('MongoDB connected successfully'); // Log successful connection
      
      // Initialize WhatsApp Client and Scheduler Services
      try {
        const { triggerQueueWorker } = require('./services/notificationService');
        const { initializeScheduler } = require('./services/schedulerService');
        const { initializeTelegram } = require('./services/telegramClient');
        
        await initializeTelegram();
        triggerQueueWorker();
        await initializeScheduler();
        console.log('✅ Telegram and Scheduler Services initialized.');
      } catch (err) {
        console.error('❌ Failed to initialize WhatsApp/Scheduler Services:', err);
      }
      
      // Start the server after successful database connection
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('MongoDB connection error:', err); // Log any connection errors
    });
}

startServer();

// Final error handler: return JSON with translated 'msg' where possible
const { translateMessage } = require('./utils/translations');
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  const msg = err && err.message ? translateMessage(err.message) : translateMessage('Server error');
  res.status(500).json({ msg });
});