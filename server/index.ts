import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { telegramAuth } from './auth';
import habitsRouter from './routes/habits';
import friendsRouter from './routes/friends';
import webhookRouter from './routes/webhook';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// One-time setup: set webhook on Telegram
app.get('/api/setup-webhook', async (_req, res) => {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const APP_URL = process.env.APP_URL || 'https://habitlink-z4ys.onrender.com';
  if (!BOT_TOKEN) return res.json({ error: 'No bot token' });

  const webhookUrl = `${APP_URL}/api/webhook`;
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query']
      })
    });
    const data = await r.json();
    res.json({ webhook_url: webhookUrl, result: data });
  } catch (err: any) {
    res.json({ error: err.message });
  }
});

// Webhook — no auth (Telegram sends updates here)
app.use('/api/webhook', webhookRouter);

// API routes with Telegram auth
app.use('/api/habits', telegramAuth, habitsRouter);
app.use('/api/friends', telegramAuth, friendsRouter);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  // dist is at project root, server is at server/
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 HabitLink server running on http://localhost:${PORT}`);
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('⚠️  TELEGRAM_BOT_TOKEN not set — auth validation disabled (dev mode)');
  } else {
    console.log('✅ Telegram auth validation enabled');
  }
});
