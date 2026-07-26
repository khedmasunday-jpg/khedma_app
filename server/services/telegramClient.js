
const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');

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
      if (msg.text && msg.text.startsWith('/start')) {
        const welcomeText = `🎉 أهلاً بك في خدمة إشعارات تطبيق الخدمة (Khedma App)!\n\n` +
          `🆔 رمز المعرف الخاص بك (Chat ID):\n` +
          `\`${chatId}\`\n\n` +
          `قم بنسخ هذا الرقم وإدخاله في التطبيق تحت قائمة "الملف الشخصي" (Profile) أو إعطائه للمسؤول لتلقي التنبيهات والإشعارات فوراً على تليجرام.\n\n` +
          `-----------------------------------\n` +
          `Welcome to Khedma Notifications!\n` +
          `Your Telegram Chat ID is: \`${chatId}\`\n` +
          `Please copy this ID into your Khedma App profile settings to receive notifications.`;

        bot.sendMessage(chatId, welcomeText, { parse_mode: 'Markdown' });
      }
    });
    botStatus = 'connected';
    return true;
  } catch (err) {
    console.error('❌ [Telegram] Failed to initialize bot:', err);
    botStatus = 'error';
    return false;
  }
}

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
