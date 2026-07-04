import { Router } from 'express';
import { AuthenticatedRequest } from '../auth';
import * as db from '../db';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const APP_URL = process.env.APP_URL || 'https://habitlink-z4ys.onrender.com';

const router = Router();

// GET /api/friends?tg_id= - Get friends list
router.get('/', (req, res) => {
  const tgId = Number(req.query.tg_id) || (req as AuthenticatedRequest).userId;
  if (!tgId) return res.status(400).json({ error: 'tg_id required' });

  const friends = db.getFriends(tgId);
  res.json({ friends });
});

// GET /api/friends/requests?tg_id= - Get pending friend requests
router.get('/requests', (req, res) => {
  const tgId = Number(req.query.tg_id) || (req as AuthenticatedRequest).userId;
  if (!tgId) return res.status(400).json({ error: 'tg_id required' });

  const requests = db.getFriendRequests(tgId);
  res.json({ requests });
});

// POST /api/friends/request - Send friend request
router.post('/request', async (req, res) => {
  const { friend_id, tg_id } = req.body;
  const userId = tg_id || (req as AuthenticatedRequest).userId;
  if (!userId || !friend_id) return res.status(400).json({ error: 'friend_id and tg_id required' });

  // Ensure both users exist
  const user = (req as AuthenticatedRequest).user;
  if (user) {
    db.ensureUser(user.id, user.first_name, user.username, user.photo_url);
  }

  // Check if target user exists in DB
  const targetUser = db.getUserById(friend_id);
  if (!targetUser) {
    return res.json({ success: false, error: 'user_not_found', message: 'Пользователь не найден в HabitLink. Попросите его сначала открыть приложение.' });
  }

  const result = db.sendFriendRequest(userId, friend_id);

  if (result.success) {
    // Send Telegram notification to the target user
    if (BOT_TOKEN) {
      const fromUser = db.getUserById(userId);
      const fromName = fromUser?.name || `Пользователь #${userId}`;

      try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: friend_id,
            text: `🤝 ${fromName} хочет быть твоим напарником по привычкам!\n\nПрими или отклони запрос в приложении.`,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ Принять', callback_data: `accept_${userId}` },
                  { text: '❌ Отклонить', callback_data: `reject_${userId}` }
                ],
                [
                  { text: '🚀 Открыть HabitLink', web_app: { url: APP_URL } }
                ]
              ]
            }
          })
        });
      } catch (err) {
        console.error('Failed to send Telegram notification:', err);
      }
    }
  }

  res.json(result);
});

// POST /api/friends/accept - Accept friend request
router.post('/accept', (req, res) => {
  const { friend_id, tg_id } = req.body;
  const userId = tg_id || (req as AuthenticatedRequest).userId;
  if (!userId || !friend_id) return res.status(400).json({ error: 'friend_id and tg_id required' });

  const result = db.acceptFriendRequest(userId, friend_id);

  // Notify the requester via Telegram
  if (result.success && BOT_TOKEN) {
    const acceptorName = db.getUserById(userId)?.name || 'Напарник';
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: friend_id,
        text: `🎉 ${acceptorName} принял твоё приглашение! Теперь вы напарники.`,
        reply_markup: {
          inline_keyboard: [[
            { text: '🚀 Открыть HabitLink', web_app: { url: APP_URL } }
          ]]
        }
      })
    }).catch(() => {});
  }

  res.json(result);
});

// POST /api/friends/reject - Reject friend request
router.post('/reject', (req, res) => {
  const { friend_id, tg_id } = req.body;
  const userId = tg_id || (req as AuthenticatedRequest).userId;
  if (!userId || !friend_id) return res.status(400).json({ error: 'friend_id and tg_id required' });

  const result = db.rejectFriendRequest(userId, friend_id);
  res.json(result);
});

// POST /api/friends/unbind - Unbind friend
router.post('/unbind', (req, res) => {
  const { tg_id, friend_id } = req.body;
  const userId = tg_id || (req as AuthenticatedRequest).userId;
  if (!userId || !friend_id) return res.status(400).json({ error: 'friend_id and tg_id required' });

  const result = db.unbindFriend(userId, friend_id);
  res.json(result);
});

// GET /api/friends/lookup?username= - Find user by Telegram username
router.get('/lookup', (req, res) => {
  const username = req.query.username as string;
  if (!username) return res.status(400).json({ error: 'username required' });

  const clean = username.replace('@', '').trim();
  const user = db.getUserByUsername(clean);
  if (!user) {
    return res.json({ found: false, message: 'Пользователь не найден. Убедитесь, что он уже opening HabitLink.' });
  }

  res.json({
    found: true,
    user: { id: user.id, name: user.name, username: user.username, photo_url: user.photo_url }
  });
});

export default router;
