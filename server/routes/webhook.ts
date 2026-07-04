import { Router } from 'express';
import { fileURLToPath } from 'url';
import path from 'path';
import * as db from '../db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const APP_URL = process.env.APP_URL || 'https://habitlink-z4ys.onrender.com';

const router = Router();

// Telegram webhook endpoint — no auth needed (Telegram sends updates here)
router.post('/', async (req, res) => {
  const update = req.body;

  // Always respond 200 to Telegram immediately
  res.sendStatus(200);

  try {
    // Handle messages
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = msg.text || '';
      const user = msg.from;

      if (user) {
        db.ensureUser(user.id, user.first_name, user.username, user.photo_url);
      }

      // Handle /start command with deep link (invite)
      if (text.startsWith('/start')) {
        const parts = text.split(' ');
        const startParam = parts[1]; // e.g. invite_123456

        if (startParam && startParam.startsWith('invite_')) {
          const inviterId = parseInt(startParam.replace('invite_', ''), 10);
          if (!isNaN(inviterId) && inviterId !== user?.id) {
            // Send the Mini App button
            await sendMessage(chatId, {
              text: `👋 Привет! Тебя пригласил друг прокачивать привычки вместе.\n\nНажми кнопку ниже, чтобы открыть HabitLink и принять приглашение:`,
              reply_markup: {
                inline_keyboard: [[
                  { text: '🚀 Открыть HabitLink', web_app: { url: `${APP_URL}?startapp=invite_${inviterId}` } }
                ]]
              }
            });
            return;
          }
        }

        // Default /start message
        await sendMessage(chatId, {
          text: `🎯 <b>HabitLink</b> — трекер привычек с друзьями!\n\nСоздавай привычки, отмечай выполнение и соревнуйся с напарниками.\n\nНажми кнопку ниже, чтобы начать:`,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '🚀 Открыть HabitLink', web_app: { url: APP_URL } }
            ]]
          }
        });
      }

      // Handle /help
      if (text === '/help') {
        await sendMessage(chatId, {
          text: `📋 Команды:\n\n/start — Запустить приложение\n/help — Помощь\n\nЧтобы добавить друга, открой приложение и нажми "Пригласить напарника".`
        });
      }
    }

    // Handle callback queries (inline button presses)
    if (update.callback_query) {
      const cq = update.callback_query;
      const data = cq.data;
      const chatId = cq.message?.chat.id;

      if (data?.startsWith('accept_')) {
        const fromId = parseInt(data.replace('accept_', ''), 10);
        const toId = cq.from.id;

        db.acceptFriendRequest(toId, fromId);

        await answerCallbackQuery(cq.id, '✅ Вы теперь напарники!');
        await sendMessage(chatId!, {
          text: `🤝 Вы теперь напарники! Откройте HabitLink, чтобы вместе отслеживать привычки.`,
          reply_markup: {
            inline_keyboard: [[
              { text: '🚀 Открыть HabitLink', web_app: { url: APP_URL } }
            ]]
          }
        });

        // Notify the requester
        try {
          await sendMessage(fromId, {
            text: `🎉 ${cq.from.first_name} принял твоё приглашение! Теперь вы напарники.`,
            reply_markup: {
              inline_keyboard: [[
                { text: '🚀 Открыть HabitLink', web_app: { url: APP_URL } }
              ]]
            }
          });
        } catch {}
      }

      if (data?.startsWith('reject_')) {
        const fromId = parseInt(data.replace('reject_', ''), 10);
        const toId = cq.from.id;

        db.rejectFriendRequest(toId, fromId);
        await answerCallbackQuery(cq.id, 'Запрос отклонён');
      }
    }
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
});

// Helper: send a message via Telegram Bot API
async function sendMessage(chatId: number, payload: any) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, ...payload }),
  });
  return res.json();
}

// Helper: answer callback query
async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
  return res.json();
}

export default router;

// Export sendMessage for use in friends routes
export { sendMessage };
