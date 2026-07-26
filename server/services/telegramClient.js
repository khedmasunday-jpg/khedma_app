
const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');
const axios = require('axios');

let bot = null;
let botStatus = 'disconnected';

function initializeTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('⚠️ [Telegram] No TELEGRAM_BOT_TOKEN provided in environment variables.');
    botStatus = 'disconnected';
    return false;
  }

  try {
    if (!bot) {
      bot = new TelegramBot(token, { polling: false });
    }
    botStatus = 'connected';
    return true;
  } catch (err) {
    console.error('❌ [Telegram] Failed to initialize bot:', err.message);
    botStatus = 'error';
    return false;
  }
}

async function sendTelegramMessage(to, message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN is missing in environment variables' };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: to,
      text: message,
      parse_mode: 'Markdown'
    });
    botStatus = 'connected';
    return { success: true, messageId: String(response.data?.result?.message_id) };
  } catch (err) {
    const errorDetails = err.response?.data?.description || err.message;
    console.error(`❌ [Telegram Send Error]:`, errorDetails);
    return { success: false, error: errorDetails };
  }
}

function getTelegramStatus() {
  if (process.env.TELEGRAM_BOT_TOKEN) {
    return 'connected';
  }
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
  if (bot) {
    try { bot.stopPolling(); } catch (e) {}
  }
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
