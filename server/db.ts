import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'data', 'habitlink.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT,
    photo_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    frequency TEXT DEFAULT '🔥 Ежедневно',
    periodicity_type TEXT DEFAULT 'daily',
    periodicity_days TEXT DEFAULT '[]',
    color TEXT DEFAULT '#4A90D9',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS habit_history (
    habit_id INTEGER NOT NULL,
    day_index INTEGER NOT NULL,
    done BOOLEAN DEFAULT 0,
    PRIMARY KEY (habit_id, day_index),
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS habit_friends (
    habit_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    PRIMARY KEY (habit_id, friend_id),
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS friendships (
    user_id INTEGER NOT NULL,
    friend_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, friend_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (friend_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS friend_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    to_user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id)
  );
`);

export default db;

// --- Helper functions ---

export function ensureUser(id: number, name: string, username?: string, photo_url?: string) {
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) {
    db.prepare('INSERT INTO users (id, name, username, photo_url) VALUES (?, ?, ?, ?)').run(id, name, username || null, photo_url || null);
  } else if (username || photo_url) {
    db.prepare('UPDATE users SET name = ?, username = COALESCE(?, username), photo_url = COALESCE(?, photo_url) WHERE id = ?').run(name, username || null, photo_url || null, id);
  }
}

export function getHabits(userId: number) {
  const habits = db.prepare(`
    SELECT h.*, GROUP_CONCAT(hf.friend_id) as friend_id_str
    FROM habits h
    LEFT JOIN habit_friends hf ON h.id = hf.habit_id
    WHERE h.user_id = ?
    GROUP BY h.id
    ORDER BY h.created_at ASC
  `).all(userId) as any[];

  return habits.map(h => {
    const history = db.prepare('SELECT day_index, done FROM habit_history WHERE habit_id = ?').all(h.id) as any[];
    const historyArray = [false, false, false, false, false, false, false];
    history.forEach(r => { historyArray[r.day_index] = !!r.done; });

    const friendIds = h.friend_id_str ? h.friend_id_str.split(',').map(Number) : [];

    return {
      id: h.id,
      name: h.name,
      description: h.description,
      done: historyArray[getMskDayIndex()],
      frequency: h.frequency,
      periodicity_type: h.periodicity_type,
      periodicity_days: JSON.parse(h.periodicity_days || '[]'),
      friend_ids: friendIds,
      color: h.color,
      history: historyArray,
    };
  });
}

export function createHabit(userId: number, habit: any) {
  const result = db.prepare(`
    INSERT INTO habits (id, user_id, name, description, frequency, periodicity_type, periodicity_days, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    habit.id || Date.now(),
    userId,
    habit.name,
    habit.description || '',
    habit.frequency || '🔥 Ежедневно',
    habit.periodicityType || habit.periodicity_type || 'daily',
    JSON.stringify(habit.periodicityDays || habit.periodicity_days || []),
    habit.color || '#4A90D9'
  );

  const habitId = habit.id || result.lastInsertRowid;

  // Initialize history (all false)
  for (let i = 0; i < 7; i++) {
    db.prepare('INSERT OR IGNORE INTO habit_history (habit_id, day_index, done) VALUES (?, ?, ?)').run(habitId, i, 0);
  }

  // Link friends
  const friendIds = habit.friendIds || habit.friend_ids || [];
  const insertFriend = db.prepare('INSERT OR IGNORE INTO habit_friends (habit_id, friend_id) VALUES (?, ?)');
  for (const fid of friendIds) {
    insertFriend.run(habitId, fid);
  }

  return habitId;
}

export function toggleHabit(habitId: number, userId: number, done: boolean) {
  const dayIndex = getMskDayIndex();
  db.prepare(`
    INSERT INTO habit_history (habit_id, day_index, done) VALUES (?, ?, ?)
    ON CONFLICT(habit_id, day_index) DO UPDATE SET done = ?
  `).run(habitId, dayIndex, done ? 1 : 0, done ? 1 : 0);
}

export function deleteHabit(habitId: number, userId: number) {
  db.prepare('DELETE FROM habits WHERE id = ? AND user_id = ?').run(habitId, userId);
}

export function getFriends(userId: number) {
  const rows = db.prepare(`
    SELECT u.id, u.name, u.username, u.photo_url, f.status
    FROM friendships f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ? AND f.status = 'active'
  `).all(userId) as any[];

  return rows.map(r => {
    const habitDoneMap: Record<number, boolean> = {};
    const todayIndex = getMskDayIndex();

    // Get all habits the friend has
    const friendHabits = db.prepare('SELECT id FROM habits WHERE user_id = ?').all(r.id) as any[];
    for (const h of friendHabits) {
      const record = db.prepare('SELECT done FROM habit_history WHERE habit_id = ? AND day_index = ?').get(h.id, todayIndex) as any;
      habitDoneMap[h.id] = record ? !!record.done : false;
    }

    return {
      id: r.id,
      name: r.name,
      username: r.username,
      photo_url: r.photo_url,
      status: r.status,
      habits: habitDoneMap,
    };
  });
}

export function getFriendRequests(userId: number) {
  return db.prepare(`
    SELECT fr.id as request_id, u.id, u.name, u.username, u.photo_url
    FROM friend_requests fr
    JOIN users u ON u.id = fr.from_user_id
    WHERE fr.to_user_id = ? AND fr.status = 'pending'
  `).all(userId).map((r: any) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    photo_url: r.photo_url,
  }));
}

export function sendFriendRequest(fromUserId: number, toUserId: number) {
  // Check if already friends
  const existing = db.prepare(
    'SELECT 1 FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)'
  ).get(fromUserId, toUserId, toUserId, fromUserId);
  if (existing) return { success: false, error: 'already_friends' };

  // Check if request already pending
  const pending = db.prepare(
    "SELECT 1 FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'"
  ).get(fromUserId, toUserId);
  if (pending) return { success: false, error: 'already_pending' };

  db.prepare('INSERT INTO friend_requests (from_user_id, to_user_id) VALUES (?, ?)').run(fromUserId, toUserId);
  return { success: true };
}

export function acceptFriendRequest(userId: number, friendId: number) {
  db.prepare("UPDATE friend_requests SET status = 'accepted' WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'").run(friendId, userId);

  // Create bidirectional friendship
  db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)').run(userId, friendId, 'active');
  db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id, status) VALUES (?, ?, ?)').run(friendId, userId, 'active');

  return { success: true };
}

export function rejectFriendRequest(userId: number, friendId: number) {
  db.prepare("UPDATE friend_requests SET status = 'rejected' WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'").run(friendId, userId);
  return { success: true };
}

export function unbindFriend(userId: number, friendId: number) {
  db.prepare('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)').run(userId, friendId, friendId, userId);
  return { success: true };
}

function getMskDayIndex(): number {
  const now = new Date();
  const mskTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const day = mskTime.getDay();
  return day === 0 ? 6 : day - 1;
}
