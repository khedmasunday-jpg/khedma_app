// services/telegramClient.js
const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');

// Fallback to empty string to prevent crashes if token is missing
const token = process.env.TELEGRAM_BOT_TOKEN || '';
let bot = null;

let botStatus = 'disconnected';

function initializeTelegram() {
  if (!token) {
    console.warn('⚠️ [Telegram] No TELEGRAM_BOT_TOKEN provided in .env. Bot will not initialize.');
    botStatus = 'error';
    return false;
  }

  try {
    bot = new TelegramBot(token, { polling: true });
    
    bot.on('polling_error', (error) => {
      console.error(`❌ [Telegram Polling Error]: ${error.code} - ${error.message}`);
    });

    bot.on('message', (msg) => {
      const chatId = msg.chat.id;
      // In a real app, you'd map this chatId to the user in your database using their phone number or a specific command
      if (msg.text === '/start') {
        bot.sendMessage(chatId, `Welcome to Khedma Notifications! Your Chat ID is: ${chatId}\n\nPlease share this ID with the admin so they can send you notifications.`);
      }
    });

    console.log('✅ [Telegram] Bot started and polling successfully.');
    botStatus = 'connected';
    return true;
  } catch (err) {
    console.error('❌ [Telegram] Failed to initialize bot:', err);
    botStatus = 'error';
    return false;
  }
}

/**
 * Send a Telegram text message
 * @param {string} to The Telegram Chat ID of the recipient
 * @param {string} message The text content of the message
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendTelegramMessage(to, message) {
  if (!bot || botStatus !== 'connected') {
    return { success: false, error: 'Telegram bot is not connected' };
  }

  try {
    const result = await bot.sendMessage(to, message);
    return { success: true, messageId: String(result.message_id) };
  } catch (err) {
    console.error(`❌ [Telegram Send Error]:`, err.message);
    return { success: false, error: err.message };
  }
}

function getTelegramStatus() {
  return botStatus;
}

function getTelegramQrCode() {
  return null;
}

async function reconnectTelegram() {
  return initializeTelegram();
}

async function logoutTelegram() {
  botStatus = 'disconnected';
  if (bot) bot.stopPolling();
  bot = null;
  return true;
}

module.exports = {
  initializeTelegram,
  sendTelegramMessage,
  getTelegramStatus,
  getTelegramQrCode,
  reconnectTelegram,
  logoutTelegram
};
