
const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');
const axios = require('axios');

let bot = null;
let botStatus = 'disconnected';

let isWebhookSet = false;
async function autoRegisterWebhook(host) {
  if (isWebhookSet) return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const targetHost = host || process.env.VERCEL_URL || 'khedma-app-one.vercel.app';
  let cleanHost = targetHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const webhookUrl = `https://${cleanHost}/api/telegram/webhook`;

  try {
    await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, { url: webhookUrl });
    console.log('✅ Auto-registered Telegram Webhook to:', webhookUrl);
    isWebhookSet = true;
  } catch (err) {
    console.error('❌ Auto-register Telegram Webhook failed:', err.response?.data?.description || err.message);
  }
}

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
    autoRegisterWebhook();
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

async function registerWebhook(baseUrl) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !baseUrl) return false;
  try {
    const cleanUrl = baseUrl.replace(/\/$/, '');
    const webhookUrl = `${cleanUrl}/api/telegram/webhook`;
    await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, { url: webhookUrl });
    console.log('✅ Registered Telegram Webhook:', webhookUrl);
    return true;
  } catch (err) {
    console.error('❌ Failed to register Telegram Webhook:', err.response?.data || err.message);
    return false;
  }
}

async function handleIncomingUpdate(update) {
  if (!update || !update.message) return;
  const msg = update.message;
  const chatId = msg.chat ? msg.chat.id : null;
  if (!chatId) return;

  if (msg.text && msg.text.startsWith('/start')) {
    const welcomeText = `🎉 أهلاً بك في خدمة إشعارات تطبيق الخدمة (Khedma App)!\n\n` +
      `🆔 رمز المعرف الخاص بك (Chat ID):\n` +
      `\`${chatId}\`\n\n` +
      `قم بنسخ هذا الرقم وإدخاله في التطبيق تحت قائمة "الملف الشخصي" (Profile) أو إعطائه للمسؤول لتلقي التنبيهات والإشعارات فوراً على تليجرام.\n\n` +
      `-----------------------------------\n` +
      `Welcome to Khedma Notifications!\n` +
      `Your Telegram Chat ID is: \`${chatId}\`\n` +
      `Please copy this ID into your Khedma App profile settings to receive notifications.`;

    await sendTelegramMessage(chatId, welcomeText);
  }
}

module.exports = {
  initializeTelegram,
  sendTelegramMessage,
  getTelegramStatus,
  getTelegramQrCode,
  reconnectTelegram,
  logoutTelegram,
  registerWebhook,
  handleIncomingUpdate
};
