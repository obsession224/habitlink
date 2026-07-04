import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

export interface AuthenticatedRequest extends Request {
  userId?: number;
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  };
}

/**
 * Validate Telegram WebApp initData according to:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramInitData(initData: string): { valid: boolean; user?: any } {
  if (!BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN not set — skipping auth validation');
    return { valid: true };
  }

  if (!initData) return { valid: false };

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');

  // Sort params alphabetically
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  // Compute HMAC-SHA256
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) {
    return { valid: false };
  }

  // Parse user data
  const userStr = urlParams.get('user');
  if (userStr) {
    try {
      return { valid: true, user: JSON.parse(userStr) };
    } catch {
      return { valid: false };
    }
  }

  return { valid: true };
}

/**
 * Express middleware: validates Telegram initData from x-telegram-initdata header.
 * If TELEGRAM_BOT_TOKEN is not set, validation is skipped (dev mode).
 */
export function telegramAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!BOT_TOKEN) {
    // Dev mode: extract user from header or query
    const tgUserHeader = req.headers['x-telegram-user'] as string;
    if (tgUserHeader) {
      try {
        req.user = JSON.parse(tgUserHeader);
        req.userId = req.user!.id;
      } catch {}
    }
    if (!req.userId) {
      req.userId = Number(req.query.tg_id) || 123456;
    }
    return next();
  }

  const initData = req.headers['x-telegram-initdata'] as string;
  if (!initData) {
    return res.status(401).json({ error: 'Missing Telegram initData' });
  }

  const result = validateTelegramInitData(initData);
  if (!result.valid) {
    return res.status(401).json({ error: 'Invalid Telegram initData' });
  }

  req.user = result.user;
  req.userId = result.user?.id;
  next();
}
