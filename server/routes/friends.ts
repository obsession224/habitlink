import { Router } from 'express';
import { AuthenticatedRequest } from '../auth';
import * as db from '../db';

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
router.post('/request', (req, res) => {
  const { friend_id, tg_id } = req.body;
  const userId = tg_id || (req as AuthenticatedRequest).userId;
  if (!userId || !friend_id) return res.status(400).json({ error: 'friend_id and tg_id required' });

  // Ensure both users exist
  const user = (req as AuthenticatedRequest).user;
  if (user) {
    db.ensureUser(user.id, user.first_name, user.username, user.photo_url);
  }
  db.ensureUser(friend_id, `User#${friend_id}`);

  const result = db.sendFriendRequest(userId, friend_id);
  res.json(result);
});

// POST /api/friends/accept - Accept friend request
router.post('/accept', (req, res) => {
  const { friend_id, tg_id } = req.body;
  const userId = tg_id || (req as AuthenticatedRequest).userId;
  if (!userId || !friend_id) return res.status(400).json({ error: 'friend_id and tg_id required' });

  const result = db.acceptFriendRequest(userId, friend_id);
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

export default router;
