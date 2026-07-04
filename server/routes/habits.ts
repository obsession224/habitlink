import { Router } from 'express';
import { AuthenticatedRequest } from '../auth';
import * as db from '../db';

const router = Router();

// GET /api/habits?tg_id= - Get habits for user
router.get('/', (req, res) => {
  const tgId = Number(req.query.tg_id) || (req as AuthenticatedRequest).userId;
  if (!tgId) return res.status(400).json({ error: 'tg_id required' });

  // Ensure user exists
  const user = (req as AuthenticatedRequest).user;
  db.ensureUser(tgId, user?.first_name || `User#${tgId}`, user?.username, user?.photo_url);

  const habits = db.getHabits(tgId);

  // Calculate weekly progress
  const weeklyProgress = [0, 0, 0, 0, 0, 0, 0];
  if (habits.length > 0) {
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const completedCount = habits.filter(h => h.history[dayIdx]).length;
      weeklyProgress[dayIdx] = Math.round((completedCount / habits.length) * 100);
    }
  }

  res.json({ habits, weekly_progress: weeklyProgress });
});

// POST /api/habits - Create habit
router.post('/', (req, res) => {
  const tgId = Number(req.body.tg_id) || (req as AuthenticatedRequest).userId;
  if (!tgId) return res.status(400).json({ error: 'tg_id required' });

  const habit = req.body.habit;
  if (!habit || !habit.name) return res.status(400).json({ error: 'habit.name required' });

  // Ensure user exists (create with fallback name if needed)
  const user = (req as AuthenticatedRequest).user;
  db.ensureUser(tgId, user?.first_name || `User#${tgId}`, user?.username, user?.photo_url);

  const habitId = db.createHabit(tgId, habit);
  res.json({ success: true, habit_id: habitId });
});

// POST /api/habits/toggle - Toggle habit done status
router.post('/toggle', (req, res) => {
  const { habit_id, tg_id, done } = req.body;
  if (!habit_id) return res.status(400).json({ error: 'habit_id required' });

  db.toggleHabit(habit_id, tg_id, done);
  res.json({ success: true });
});

// DELETE /api/habits/delete - Delete habit
router.delete('/delete', (req, res) => {
  const { habit_id, tg_id } = req.body;
  if (!habit_id) return res.status(400).json({ error: 'habit_id required' });

  db.deleteHabit(habit_id, tg_id);
  res.json({ success: true });
});

export default router;
