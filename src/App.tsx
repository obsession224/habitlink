/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Check, 
  Plus, 
  Users, 
  TrendingUp, 
  X, 
  ArrowLeft, 
  Activity, 
  Moon, 
  Sun, 
  CheckCircle2, 
  XCircle, 
  UserPlus, 
  Trash2,
  Calendar,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { Habit, Friend, FriendRequest } from './types';
import { renderInitialsAvatar } from './components/Avatars';
import { UserProfileModal } from './components/UserProfileModal';
import { AddHabitModal } from './components/AddHabitModal';
import { HabitDetailsModal } from './components/HabitDetailsModal';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

// Telegram WebApp API helper
const tg = window.Telegram?.WebApp;

// Authenticated fetch wrapper — sends Telegram initData for server-side validation
async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const initData = tg?.initData || '';
  const headers = new Headers(options.headers);
  if (initData) {
    headers.set('x-telegram-initdata', initData);
  }
  return fetch(url, { ...options, headers });
}

export default function App() {
  // --- STATE ---
  const [currentScreen, setCurrentScreen] = useState<'main' | 'friends' | 'stats'>('main');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [user, setUser] = useState<{ id: number | null; name: string; username?: string; photo_url?: string }>({
    id: null,
    name: 'Алексей',
  });
  const [rawWeeklyProgress, setWeeklyProgress] = useState<number[]>([85, 70, 60, 90, 75, 80, 72]);

  const weeklyProgress = useMemo(() => {
    if (habits.length === 0) return rawWeeklyProgress;
    const progress: number[] = [];
    for (let idx = 0; idx < 7; idx++) {
      const completedCount = habits.filter(h => h.history[idx]).length;
      const rate = Math.round((completedCount / habits.length) * 100);
      progress.push(rate);
    }
    return progress;
  }, [habits, rawWeeklyProgress]);

  // UI state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('habitlink_theme_v1');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'light'; // fallback, will be refined on mount
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeHabitDetails, setActiveHabitDetails] = useState<Habit | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Form states
  const [newHabitName, setNewHabitName] = useState(''); // Shared between Sidebar and Bottom Sheet
  const [friendIdInput, setFriendIdInput] = useState('');

  // Local storage cache keys
  const STORAGE_KEY_HABITS = 'habitlink_habits_v1';
  const STORAGE_KEY_FRIENDS = 'habitlink_friends_v2';
  const STORAGE_KEY_REQUESTS = 'habitlink_requests_v1';

  // API Config
  const API_BASE_URL = '/api';
  const TG_USER_ID = user.id || 123456;

  // Ref to trigger animations sequentially
  const [animateCards, setAnimateCards] = useState(false);

  // Helper to dynamically add friend on invite
  const handleIncomingInvite = (inviterId: number) => {
    let alreadyExists = false;
    setFriends(prev => {
      const exists = prev.some(f => f.id === inviterId);
      if (exists) {
        alreadyExists = true;
        return prev;
      }

      const newFriend: Friend = {
        id: inviterId,
        name: `Напарник #${inviterId % 10000}`,
        username: `tg_${inviterId}`,
        status: 'active',
        habits: { 1: Math.random() > 0.5, 2: Math.random() > 0.5, 3: Math.random() > 0.5 }
      };
      
      const updated = [...prev, newFriend];
      localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updated));
      return updated;
    });

    if (!alreadyExists) {
      setTimeout(() => {
        showToast(`Вы успешно добавили напарника #${inviterId % 10000} по приглашению! 🤝`, 'success');
      }, 600);
    }
  };

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Initialize Telegram WebApp
    if (tg) {
      tg.ready();
      tg.expand();
      tg.MainButton?.hide();
      
      // Load user data if available
      const tgUser = tg.initDataUnsafe?.user;
      if (tgUser) {
        setUser({
          id: tgUser.id,
          name: tgUser.first_name,
          username: tgUser.username,
          photo_url: tgUser.photo_url,
        });
      }
    }

    // Determine initial theme
    const savedTheme = localStorage.getItem('habitlink_theme_v1');
    let initialTheme: 'light' | 'dark' = 'light';

    if (savedTheme === 'light' || savedTheme === 'dark') {
      initialTheme = savedTheme;
    } else if (tg && (tg.colorScheme === 'dark' || tg.colorScheme === 'light')) {
      initialTheme = tg.colorScheme;
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      initialTheme = prefersDark ? 'dark' : 'light';
    }

    setTheme(initialTheme);
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Listener for system preference changes (only if no manual saved theme)
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => {
      const hasSaved = localStorage.getItem('habitlink_theme_v1');
      if (!hasSaved) {
        const nextTheme = e.matches ? 'dark' : 'light';
        setTheme(nextTheme);
        if (nextTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  // --- HANDLE INCOMING INVITES ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const startParam = tg?.initDataUnsafe?.start_param || urlParams.get('startapp') || urlParams.get('invite');
    if (startParam && startParam.startsWith('invite_')) {
      const inviterId = parseInt(startParam.replace('invite_', ''), 10);
      if (!isNaN(inviterId) && inviterId !== TG_USER_ID) {
        handleIncomingInvite(inviterId);
        
        // Clean up URL parameters to avoid re-triggering on reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [user.id]);

  // --- LOAD INITIAL DATA & API ---
  useEffect(() => {
    let active = true;

    // Load static mockup or localStorage backups first for instantaneous rendering
    const localHabits = localStorage.getItem(STORAGE_KEY_HABITS);
    const localFriends = localStorage.getItem(STORAGE_KEY_FRIENDS);
    const localRequests = localStorage.getItem(STORAGE_KEY_REQUESTS);

    const todayIdx = getMskDayIndex();

    if (localHabits) {
      try {
        const parsed = JSON.parse(localHabits) as Habit[];
        const synced = parsed.map(h => ({
          ...h,
          done: !!h.history[todayIdx]
        }));
        setHabits(synced);
      } catch (e) {
        setHabits([]);
      }
    } else {
      setHabits([]);
    }

    if (localFriends) {
      setFriends(JSON.parse(localFriends));
    } else {
      // Migrate old singular friend if exists
      const oldFriend = localStorage.getItem('habitlink_friend_v1');
      if (oldFriend) {
        try {
          const parsed = JSON.parse(oldFriend);
          const migrated = parsed ? [parsed] : [];
          setFriends(migrated);
          localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(migrated));
        } catch {
          // fallback
        }
      } else {
        setFriends([]);
        localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify([]));
      }
    }

    if (localRequests) {
      setFriendRequests(JSON.parse(localRequests));
    } else {
      setFriendRequests([]);
      localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify([]));
    }

    // Trigger page-load animations
    setTimeout(() => {
      if (active) setAnimateCards(true);
    }, 100);

    // Fetch from mock endpoints with catch clauses
    apiFetch(`${API_BASE_URL}/habits?tg_id=${TG_USER_ID}`)
      .then(res => {
        if (!res.ok) throw new Error('API server unavailable');
        return res.json();
      })
      .then(data => {
        if (active && data && data.habits) {
          const synced = (data.habits as Habit[]).map(h => ({
            ...h,
            done: !!h.history[todayIdx]
          }));
          setHabits(synced);
          localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(synced));
          if (data.weekly_progress) setWeeklyProgress(data.weekly_progress);
          showToast('Данные успешно синхронизированы с сервером', 'success');
        }
      })
      .catch((err) => {
        console.warn('API error (using offline mockup mode):', err.message);
      });

    return () => {
      active = false;
    };
  }, [TG_USER_ID]);

  // --- UTILS ---
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const getMskDate = () => {
    const now = new Date();
    const mskTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
    return mskTime;
  };

  const getMskDayIndex = () => {
    const mskDate = getMskDate();
    const day = mskDate.getDay(); // 0 is Sunday, 1 is Monday, etc.
    return day === 0 ? 6 : day - 1;
  };

  const getMskDaysShort = () => {
    const mskDate = getMskDate();
    const weekdaysShort = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const result: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(mskDate);
      d.setDate(mskDate.getDate() - i);
      result.push(weekdaysShort[d.getDay()]);
    }
    return result;
  };

  const getRussianDate = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' };
    const formatter = new Intl.DateTimeFormat('ru-RU', options);
    const formatted = formatter.format(new Date());
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const isHabitScheduledForDay = (h: Habit, dayIndex: number): boolean => {
    const type = h.periodicityType || 'daily';
    if (type === 'custom_days') {
      const days = h.periodicityDays || [];
      return days.includes(dayIndex + 1);
    }
    return true;
  };

  const isDayFullyClosed = (dayIndex: number): boolean => {
    if (habits.length === 0) return false;
    const scheduledHabits = habits.filter(h => isHabitScheduledForDay(h, dayIndex));
    if (scheduledHabits.length === 0) {
      return true;
    }
    return scheduledHabits.every(h => h.history[dayIndex] === true);
  };

  const getWeekBarString = () => {
    if (habits.length === 0) return '▱▱▱▱▱▱▱';
    let result = '';
    for (let idx = 0; idx < 7; idx++) {
      result += isDayFullyClosed(idx) ? '▰' : '▱';
    }
    return result;
  };

  const getWeekBarEncouragement = () => {
    if (habits.length === 0) return 'Создай привычку! ✨';
    let closedDays = 0;
    for (let idx = 0; idx < 7; idx++) {
      if (isDayFullyClosed(idx)) {
        closedDays++;
      }
    }
    if (closedDays === 7) return 'Идеальная неделя! 🏆';
    if (closedDays >= 4) return 'Отличный темп! 🔥';
    if (closedDays >= 1) return 'Хорошее начало! 💪';
    return 'Начни сегодня! ✨';
  };

  // --- ACTIONS ---

  // Toggling habit status (Optimistic UI)
  const handleToggleHabitLocal = (habitId: number) => {
    const todayIndex = getMskDayIndex();
    let nextState = false;

    const updatedHabits = habits.map(h => {
      if (h.id === habitId) {
        const nextDone = !h.history[todayIndex];
        nextState = nextDone;
        const newHistory = [...h.history];
        newHistory[todayIndex] = nextDone;
        return { ...h, done: nextDone, history: newHistory };
      }
      return h;
    });

    setHabits(updatedHabits);
    localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(updatedHabits));
    
    if (nextState) {
      showToast('Ура! Привычка отмечена выполненной 🔥', 'success');
    } else {
      showToast('Отметка снята', 'info');
    }

    // Perform API call in background
    apiFetch(`${API_BASE_URL}/habits/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habit_id: habitId, tg_id: TG_USER_ID, done: nextState })
    })
      .then(res => {
        if (!res.ok) throw new Error('Ошибка обновления на сервере');
        return res.json();
      })
      .catch(err => {
        console.error('API toggle failed, rolling back (Offline fallback works fine though):', err);
      });
  };

  const handleToggleHabit = (e: React.MouseEvent, habitId: number) => {
    e.stopPropagation(); // Prevent opening detail modal
    handleToggleHabitLocal(habitId);
  };

  // Delete habit
  const handleDeleteHabit = (habitId: number) => {
    const updated = habits.filter(h => h.id !== habitId);
    setHabits(updated);
    localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(updated));
    showToast('Привычка успешно удалена 🗑️', 'success');

    apiFetch(`${API_BASE_URL}/habits/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habit_id: habitId, tg_id: TG_USER_ID })
    }).catch(() => {
      console.warn('API deletion failed, handled locally');
    });
  };

  // Create Habit
  const handleCreateHabitLocal = (
    name: string,
    description: string,
    color: string,
    periodicityType?: 'daily' | 'every_other_day' | 'weekly' | 'custom_days',
    periodicityDays?: number[],
    friendIds?: number[]
  ) => {
    const formatFrequency = (
      type: 'daily' | 'every_other_day' | 'weekly' | 'custom_days',
      days: number[]
    ) => {
      if (type === 'daily') return '🔥 Ежедневно';
      if (type === 'every_other_day') return '🔄 Через день';
      if (type === 'weekly') return '🗓️ Раз в неделю';
      if (type === 'custom_days') {
        const DAYS_SHORT_LOCAL = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        const names = days.map(d => DAYS_SHORT_LOCAL[d - 1]).filter(Boolean);
        return `🗓️ ${names.join(', ')}`;
      }
      return '🔥 Ежедневно';
    };

    const freq = periodicityType ? formatFrequency(periodicityType, periodicityDays || []) : '🔥 Ежедневно';

    const newHabit: Habit = {
      id: Date.now(),
      name,
      description: description || 'Без описания',
      done: false,
      frequency: freq,
      periodicityType: periodicityType || 'daily',
      periodicityDays: periodicityDays || [],
      friendIds: friendIds || [],
      color,
      history: [false, false, false, false, false, false, false]
    };

    const updated = [...habits, newHabit];
    setHabits(updated);
    localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(updated));
    showToast('Новая привычка добавлена! Удачи 🌟', 'success');

    // Server request
    apiFetch(`${API_BASE_URL}/habits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ habit: newHabit, tg_id: TG_USER_ID })
    }).catch(() => {
      console.warn('API creation failed, saved locally');
    });
  };

  // Submit Habit from Bottom Sheet Modal
  const handleCreateHabitFromModal = (
    name: string,
    description: string,
    color: string,
    periodicityType: 'daily' | 'every_other_day' | 'weekly' | 'custom_days',
    periodicityDays: number[],
    friendIds: number[]
  ) => {
    handleCreateHabitLocal(name, description, color, periodicityType, periodicityDays, friendIds);
    setNewHabitName('');
  };

  // Send request to friend partner
  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendIdInput.trim()) return;

    const targetId = parseInt(friendIdInput.trim(), 10);
    if (isNaN(targetId)) return;

    showToast('Запрос отправлен напарнику ✉️', 'info');
    setFriendIdInput('');

    apiFetch(`${API_BASE_URL}/friends/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friend_id: targetId, tg_id: TG_USER_ID })
    })
      .then(res => {
        if (!res.ok) throw new Error('Пользователь не найден');
        return res.json();
      })
      .then(data => {
        if (data.success) {
          showToast('Запрос успешно доставлен!', 'success');
        }
      })
      .catch(() => {
        showToast('Ошибка отправки запроса. Проверьте ID и попробуйте снова.', 'error');
      });
  };

  // Accept incoming friend request
  const handleAcceptRequest = (req: FriendRequest) => {
    const mockFriend: Friend = {
      id: req.id,
      name: req.name,
      username: req.username,
      photo_url: req.photo_url,
      status: 'active',
      habits: { 1: true, 2: false, 3: false }
    };

    setFriends(prev => {
      const updated = [...prev.filter(f => f.id !== req.id), mockFriend];
      localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updated));
      return updated;
    });
    setFriendRequests(prev => {
      const updated = prev.filter(r => r.id !== req.id);
      localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(updated));
      return updated;
    });

    showToast(`Вы успешно объединились с ${req.name}!`, 'success');

    apiFetch(`${API_BASE_URL}/friends/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friend_id: req.id, tg_id: TG_USER_ID })
    }).catch(() => {
      console.warn('API Accept failed, updated locally');
    });
  };

  // Reject friend request
  const handleRejectRequest = (requestId: number) => {
    setFriendRequests(prev => {
      const updated = prev.filter(r => r.id !== requestId);
      localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(updated));
      return updated;
    });
    showToast('Запрос отклонен', 'info');

    apiFetch(`${API_BASE_URL}/friends/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friend_id: requestId, tg_id: TG_USER_ID })
    }).catch(() => {
      console.warn('API Reject failed, updated locally');
    });
  };

  // Disconnect from friend partner
  const handleUnbindFriend = (friendId: number) => {
    const targetFriend = friends.find(f => f.id === friendId);
    const friendName = targetFriend ? targetFriend.name : 'напарником';

    setFriends(prev => {
      const updated = prev.filter(f => f.id !== friendId);
      localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updated));
      return updated;
    });

    showToast(`Связь с ${friendName} разорвана`, 'info');

    apiFetch(`${API_BASE_URL}/friends/unbind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tg_id: TG_USER_ID, friend_id: friendId })
    }).catch(() => {
      console.warn('API Unbind failed, executed locally');
    });
  };

  // Toggle Theme helper manually
  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
      document.documentElement.classList.add('dark');
      localStorage.setItem('habitlink_theme_v1', 'dark');
      showToast('Включена тёмная тема 🌙', 'info');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
      localStorage.setItem('habitlink_theme_v1', 'light');
      showToast('Включена светлая тема ☀️', 'info');
    }
  };

  // Invite friend via Telegram Share URL or clipboard fallback
  const handleInviteFriend = () => {
    const inviteLink = tg 
      ? `https://t.me/habitlink_bot/app?startapp=invite_${TG_USER_ID}` 
      : `${window.location.origin}?invite=invite_${TG_USER_ID}`;

    const text = 'Привет! Давай вместе трекать привычки в HabitLink 🚀 Подключайся ко мне по ссылке!';

    if (tg) {
      const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;
      tg.openTelegramLink(telegramShareUrl);
      showToast('Открываем список чатов Telegram для отправки 💬', 'info');
    } else {
      navigator.clipboard.writeText(inviteLink)
        .then(() => {
          showToast('Ссылка приглашения скопирована в буфер обмена! ✉️', 'success');
        })
        .catch(() => {
          showToast('Не удалось скопировать ссылку. Скопируйте её вручную.', 'error');
        });
    }
  };

  // Calculate stats percentage helper
  const calculateCompletionPercentage = (h: Habit) => {
    const totalDays = h.history.length;
    if (totalDays === 0) return 0;
    const completedDays = h.history.filter(Boolean).length;
    return Math.round((completedDays / totalDays) * 100);
  };

  // Average weekly stats
  const getOverallProgress = () => {
    if (habits.length === 0) return 0;
    const sum = habits.reduce((acc, h) => acc + calculateCompletionPercentage(h), 0);
    return Math.round(sum / habits.length);
  };

  // Russian day letters (static Monday to Sunday week)
  const DAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  // --- TRANSITIONS ---
  const changeScreen = (screen: 'main' | 'friends' | 'stats') => {
    setAnimateCards(false);
    setCurrentScreen(screen);
    setTimeout(() => {
      setAnimateCards(true);
    }, 100);
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300 flex items-center justify-center p-0 lg:p-6 overflow-x-hidden">
      
      {/* Основной двухколоночный контейнер High Density */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        
        {/* ЛЕВАЯ КОЛОНКА: Мобильное Mini App приложение / Телефон-эмулятор */}
        <div className="relative w-full h-screen lg:h-[720px] bg-[var(--bg-primary)] lg:border-[8px] lg:border-black lg:rounded-[40px] lg:shadow-2xl overflow-hidden flex flex-col transition-colors duration-300">
          
          {/* --- HEADER --- */}
          <header className="sticky top-0 z-40 h-16 px-4 flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--header-bg)] modal-blur transition-colors duration-300">
            
            {/* Слева: Аватарка или кнопка "Назад" */}
            <div className="flex items-center min-w-[80px]">
              {currentScreen === 'main' ? (
                <button 
                  onClick={() => setIsProfileModalOpen(true)}
                  className="focus:outline-none transition-transform active:scale-95 focus:ring-2 focus:ring-[#4A90D9]/50 rounded-full cursor-pointer border-none"
                  aria-label="Профиль пользователя"
                  role="button"
                >
                  {user.photo_url ? (
                    <img 
                      src={user.photo_url} 
                      alt={user.name} 
                      className="w-10 h-10 rounded-full border-2 border-white dark:border-zinc-800 object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    renderInitialsAvatar(user.name, 'w-10 h-10 text-sm')
                  )}
                </button>
              ) : (
                <button 
                  onClick={() => changeScreen('main')}
                  className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors active:scale-95 text-base font-medium focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50 px-2 py-1 rounded-lg border-none"
                  aria-label="Вернуться на главный экран"
                  role="button"
                >
                  <ArrowLeft size={20} className="stroke-[2.5]" />
                  <span>Назад</span>
                </button>
              )}
            </div>

            {/* По центру: Название экрана или дата */}
            <div className="text-center flex-1">
              {currentScreen === 'main' ? (
                <div className="flex flex-col items-center">
                  <span className="text-[13px] text-[var(--text-secondary)] font-medium leading-none mb-1">
                    Сегодня
                  </span>
                  <span className="text-[15px] font-bold tracking-tight">
                    {getRussianDate()}
                  </span>
                </div>
              ) : currentScreen === 'friends' ? (
                <span className="text-lg font-bold">Друзья</span>
              ) : (
                <span className="text-lg font-bold">Статистика</span>
              )}
            </div>

            {/* Справа: Кнопка темы и Кнопка друзей / Скрытый плейсхолдер */}
            <div className="flex items-center gap-2 justify-end min-w-[80px]">
              {/* Кнопка ручного переключения темы для удобства тестирования */}
              <button
                onClick={toggleTheme}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--chip-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-90 border-none"
                aria-label="Переключить тему оформления"
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>

              {currentScreen === 'main' ? (
                <button 
                  onClick={() => changeScreen('friends')}
                  className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--chip-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-90 border-none"
                  aria-label="Открыть экран друзей"
                  role="button"
                >
                  <Users size={19} className="stroke-[2]" />
                  {friendRequests.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border-2 border-[var(--bg-card)]">
                      {friendRequests.length}
                    </span>
                  )}
                </button>
              ) : (
                <div className="w-9" />
              )}
            </div>
          </header>

          {/* Область основного контента внутри телефона */}
          <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
            
            {/* --- ЭКРАН 1: ГЛАВНЫЙ (СПИСОК ПРИВЫЧЕК) --- */}
            {currentScreen === 'main' && (
              <div className="px-4 py-5 max-w-md mx-auto">
                
                {/* Приветствие пользователя */}
                <section className="mb-6 animate-fade-in-up">
                  <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                    Привет, {user.name}! <Sparkles className="text-amber-500 animate-pulse fill-amber-500/20" size={24} />
                  </h1>
                  <p className="text-[15px] text-[var(--text-secondary)] mt-1 font-medium">
                    Вот твой прогресс по привычкам на сегодня:
                  </p>
                </section>

                {/* Список привычек */}
                <section className="space-y-4 mb-7">
                  {habits.length === 0 ? (
                    <div className="bg-[var(--bg-card)] rounded-2xl p-8 text-center border border-[var(--border-color)] shadow-[var(--shadow-card)] animate-fade-in-up">
                      <p className="text-[var(--text-secondary)] text-base font-medium">Список привычек пуст 🧘</p>
                      <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#4A90D9] to-[#357ABD] text-white font-semibold text-sm active:scale-95 transition-transform border-none cursor-pointer"
                      >
                        Создать первую привычку
                      </button>
                    </div>
                  ) : (
                    habits.map((h, index) => {
                      return (
                        <div
                          key={h.id}
                          onClick={() => setActiveHabitDetails(h)}
                          className={`bg-[var(--bg-card)] rounded-2xl p-4 flex items-center gap-3.5 border border-[var(--border-color)] shadow-[var(--shadow-card)] active:scale-[0.98] transition-all cursor-pointer ${
                            animateCards ? 'animate-fade-in-up' : 'opacity-0'
                          }`}
                          style={{ animationDelay: `${(index + 1) * 50}ms` }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Привычка: ${h.name}. Нажмите, чтобы открыть подробности`}
                        >
                          
                          {/* Слева: Кнопка Статуса Выполнения */}
                          <button
                            onClick={(e) => handleToggleHabit(e, h.id)}
                            className={`relative w-12 h-12 rounded-full flex flex-col items-center justify-center font-bold text-xs transition-all duration-300 border-2 active:scale-90 cursor-pointer ${
                              h.done
                                ? 'bg-[#22C55E] border-[#22C55E] text-white shadow-lg shadow-emerald-500/20'
                                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 text-[var(--text-secondary)]'
                            }`}
                            aria-label={h.done ? 'Отметить невыполненной' : 'Отметить выполненной'}
                          >
                            {h.done ? (
                              <Check size={22} className="animate-spring-check stroke-[3]" />
                            ) : (
                              <span className="text-[11px] font-extrabold tracking-tight">Отм.</span>
                            )}
                          </button>

                          {/* Центр: Название, Описание, Частота */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span 
                                className="w-2.5 h-2.5 rounded-full inline-block shrink-0" 
                                style={{ backgroundColor: h.color }}
                              />
                              <h3 className="text-[17px] font-bold tracking-tight truncate leading-tight">
                                {h.name}
                              </h3>
                            </div>
                            <p className="text-[13px] text-[var(--text-secondary)] mt-1 line-clamp-2 leading-relaxed">
                              {h.description}
                            </p>
                            <div className="mt-2.5 flex">
                              <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md bg-[var(--chip-bg)] text-[var(--text-secondary)]">
                                {h.frequency}
                              </span>
                            </div>
                          </div>

                          {/* Справа: Статусы напарников по этой привычке */}
                          {(() => {
                            const habitFriends = h.friendIds && h.friendIds.length > 0
                              ? friends.filter(f => h.friendIds.includes(f.id))
                              : h.friendIds ? [] : friends; // if friendIds is empty array, show none. If undefined, show all (legacy)

                            if (habitFriends.length === 0) return null;

                            return (
                              <div 
                                className="flex items-center gap-1.5 shrink-0 border-l border-[var(--border-color)] pl-3.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex -space-x-2 overflow-hidden py-1">
                                  {habitFriends.map((f) => {
                                    const isFriendCompleted = f.habits[h.id];
                                    return (
                                      <div 
                                        key={f.id} 
                                        className="relative group cursor-help"
                                        title={`${f.name}: ${isFriendCompleted ? 'Выполнено ✓' : 'Ожидает выполнения'}`}
                                      >
                                        {renderInitialsAvatar(f.name, 'w-8 h-8 text-[11px] ring-2 ring-[var(--bg-card)]')}
                                        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center border border-[var(--bg-card)] ${
                                          isFriendCompleted 
                                            ? 'bg-[#22C55E]' 
                                            : 'bg-amber-500'
                                        }`}>
                                          {isFriendCompleted ? (
                                            <Check size={7} className="text-white stroke-[4]" />
                                          ) : (
                                            <div className="w-1 h-1 rounded-full bg-white" />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })
                  )}
                </section>

                {/* Плашка прогресса за неделю */}
                <section 
                  onClick={() => changeScreen('stats')}
                  className={`relative overflow-hidden bg-gradient-to-br from-[#4A90D9] to-[#6366F1] text-white rounded-2xl p-4 shadow-lg shadow-blue-500/15 border border-white/10 active:scale-[0.98] transition-all cursor-pointer ${
                    animateCards ? 'animate-fade-in-up' : 'opacity-0'
                  }`}
                  style={{ animationDelay: `${(habits.length + 1) * 50}ms` }}
                  role="button"
                  aria-label="Открыть подробную недельную статистику"
                >
                  <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full translate-x-12 -translate-y-12 blur-xl pointer-events-none" />
                  <div className="absolute left-1/3 bottom-0 w-24 h-24 bg-white/5 rounded-full -translate-x-12 translate-y-12 blur-xl pointer-events-none" />

                  <div className="flex justify-between items-start mb-2.5">
                    <div>
                      <span className="text-[12px] font-bold tracking-widest uppercase text-blue-100 flex items-center gap-1.5">
                        <Activity size={14} /> Недельный прогресс
                      </span>
                      <h2 className="text-3xl font-black mt-1">
                        {getOverallProgress()}%
                      </h2>
                    </div>
                    <ChevronRight className="text-white/75 shrink-0" size={22} />
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[11px] font-semibold text-blue-100 bg-black/10 rounded-xl p-2.5">
                    <span className="shrink-0 tracking-wide font-mono">Пн-Вс: {getWeekBarString()}</span>
                    <span className="shrink-0 text-white font-extrabold flex items-center gap-1">
                      {getWeekBarEncouragement()}
                    </span>
                  </div>
                </section>
              </div>
            )}

            {/* --- ЭКРАН 2: ДРУЗЬЯ --- */}
            {currentScreen === 'friends' && (
              <div className="px-4 py-5 max-w-md mx-auto space-y-6">

                {/* Секция "Мои напарники" */}
                <section className={`transition-all ${animateCards ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '50ms' }}>
                  <h2 className="text-[13px] font-bold text-[var(--text-secondary)] tracking-wider uppercase mb-3 px-1">
                    Мои напарники по привычкам ({friends.length})
                  </h2>

                  {friends.length > 0 ? (
                    <div className="space-y-3">
                      {friends.map((f) => (
                        <div key={f.id} className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)] shadow-[var(--shadow-card)] flex flex-col gap-3">
                          <div className="flex items-center gap-3.5">
                            {renderInitialsAvatar(f.name, 'w-12 h-12 text-sm')}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-[17px] font-bold tracking-tight truncate leading-tight">
                                {f.name}
                              </h3>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="relative flex h-2.5 w-2.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22C55E]"></span>
                                </span>
                                <span className="text-[13px] font-medium text-[var(--text-secondary)]">
                                  В связке (@{f.username || `id_${f.id}`})
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleUnbindFriend(f.id)}
                              className="h-9 px-3.5 rounded-xl bg-rose-500/10 text-rose-500 font-semibold text-[13px] active:scale-95 transition-transform hover:bg-rose-500/20 border-none cursor-pointer shrink-0"
                              role="button"
                              aria-label={`Отвязаться от друга ${f.name}`}
                            >
                              Отвязаться
                            </button>
                          </div>

                          {/* Список общих привычек напарника и их выполнение на сегодня */}
                          {(() => {
                            const linkedHabits = habits.filter(h => {
                              if (h.friendIds && h.friendIds.length > 0) {
                                  return h.friendIds.includes(f.id);
                              }
                              return h.friendIds === undefined;
                            });

                            if (linkedHabits.length === 0) return null;

                            return (
                              <div className="pt-3 border-t border-[var(--border-color)]/60 space-y-2">
                                <div className="text-[11px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider pl-0.5">
                                  Прогресс общих привычек сегодня:
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                  {linkedHabits.map(h => {
                                    const isDone = f.habits[h.id];
                                    return (
                                      <div key={h.id} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]/40">
                                        <span className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
                                          {h.name}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1.5 ${
                                          isDone 
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                        }`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${isDone ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                          {isDone ? 'Выполнено ✓' : 'Ожидает'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-[var(--bg-card)] rounded-2xl p-6 text-center border border-[var(--border-color)] shadow-[var(--shadow-card)]">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-3">
                        <Users size={24} />
                      </div>
                      <h3 className="text-base font-bold tracking-tight">У вас пока нет напарников</h3>
                      <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 max-w-[240px] mx-auto leading-relaxed">
                        Добавьте друзей по их Telegram ID ниже или пригласите их, чтобы отслеживать прогресс друг друга каждый день!
                      </p>
                    </div>
                  )}
                </section>

                {/* Секция "Добавить друга" */}
                <section className={`transition-all ${animateCards ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '100ms' }}>
                  <h2 className="text-[13px] font-bold text-[var(--text-secondary)] tracking-wider uppercase mb-3 px-1">
                    Добавить напарника
                  </h2>
                  <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)] shadow-[var(--shadow-card)] space-y-4">
                    <form onSubmit={handleSendRequest} className="space-y-4">
                      <div>
                        <label htmlFor="friend-tg-id" className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1.5 pl-0.5">
                          Telegram ID друга
                        </label>
                        <input
                          id="friend-tg-id"
                          type="text"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          placeholder="Например, 123456789"
                          value={friendIdInput}
                          onChange={(e) => setFriendIdInput(e.target.value.replace(/\D/g, ''))}
                          className="w-full h-12 px-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] font-medium text-[15px] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50 transition-all placeholder:text-[var(--text-secondary)]/60"
                        />
                        <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 pl-0.5">
                          Допускается только числовой ID Telegram, состоящий из 9 или 10 цифр.
                        </p>
                      </div>
                      <button
                        type="submit"
                        disabled={!/^\d{9,10}$/.test(friendIdInput)}
                        className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4A90D9] to-[#357ABD] hover:opacity-95 text-white font-bold text-[15px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 cursor-pointer border-none"
                      >
                        <UserPlus size={18} />
                        <span>Отправить запрос</span>
                      </button>
                    </form>

                    <div className="relative flex items-center my-2 py-1">
                      <div className="flex-grow border-t border-[var(--border-color)]"></div>
                      <span className="flex-shrink mx-3 text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wider">или</span>
                      <div className="flex-grow border-t border-[var(--border-color)]"></div>
                    </div>

                    <button
                      type="button"
                      onClick={handleInviteFriend}
                      className="w-full h-12 rounded-xl bg-[#4A90D9]/10 hover:bg-[#4A90D9]/15 text-[#4A90D9] font-bold text-[14px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border border-[#4A90D9]/20"
                    >
                      <Sparkles size={16} className="text-[#4A90D9]" />
                      <span>Пригласить напарника в Telegram</span>
                    </button>
                  </div>
                </section>

                {/* Секция "Входящие запросы" */}
                <section className={`transition-all ${animateCards ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: '150ms' }}>
                  <h2 className="text-[13px] font-bold text-[var(--text-secondary)] tracking-wider uppercase mb-3 px-1">
                    Входящие запросы {friendRequests.length > 0 ? `(${friendRequests.length})` : ''}
                  </h2>

                  {friendRequests.length === 0 ? (
                    <div className="bg-[var(--bg-card)] rounded-2xl p-6 text-center border border-[var(--border-color)] shadow-[var(--shadow-card)]">
                      <p className="text-[14px] text-[var(--text-secondary)] font-medium">
                        Нет входящих запросов
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {friendRequests.map((request) => (
                        <div 
                          key={request.id} 
                          className="bg-[var(--bg-card)] rounded-2xl p-3 flex items-center gap-3.5 border border-[var(--border-color)] shadow-[var(--shadow-card)]"
                        >
                          {renderInitialsAvatar(request.name, 'w-10 h-10 text-xs')}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[15px] font-bold tracking-tight truncate">
                              {request.name}
                            </h3>
                            <p className="text-[12px] text-[var(--text-secondary)] truncate">
                              @{request.username}
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleAcceptRequest(request)}
                              className="h-9 px-3.5 rounded-xl bg-[#22C55E] text-white font-bold text-[12px] active:scale-95 transition-transform cursor-pointer border-none"
                            >
                              Принять
                            </button>
                            <button
                              onClick={() => handleRejectRequest(request.id)}
                              className="h-9 px-3 rounded-xl bg-[var(--chip-bg)] text-[var(--text-secondary)] font-bold text-[12px] active:scale-95 transition-transform cursor-pointer border-none"
                            >
                              Отклонить
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* --- ЭКРАН 3: СТАТИСТИКА --- */}
            {currentScreen === 'stats' && (
              <div className="px-4 py-5 max-w-md mx-auto space-y-6">

                {/* График общей производительности */}
                <section className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)] shadow-[var(--shadow-card)]">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                      <TrendingUp className="text-[#4A90D9]" size={20} /> Динамика выполнения
                    </h2>
                    <span className="text-[13px] font-bold px-2 py-0.5 rounded-md bg-[var(--chip-bg)] text-[var(--text-secondary)]">
                      7 дней
                    </span>
                  </div>

                  {/* SVG-диаграмма */}
                  <div className="relative w-full h-36 mt-2 mb-1">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 340 120">
                      <defs>
                        <linearGradient id="gradient-line-mockup" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stopColor="#4A90D9" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#4A90D9" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Горизонтальные сетки */}
                      <line x1="0" y1="20" x2="340" y2="20" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" />
                      <line x1="0" y1="60" x2="340" y2="60" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" />
                      <line x1="0" y1="100" x2="340" y2="100" stroke="var(--border-color)" strokeWidth="1" />

                      {/* Векторный график */}
                      <path
                        d={`M 0 ${110 - (weeklyProgress[0] * 0.9)} 
                            L 56 ${110 - (weeklyProgress[1] * 0.9)} 
                            L 112 ${110 - (weeklyProgress[2] * 0.9)} 
                            L 168 ${110 - (weeklyProgress[3] * 0.9)} 
                            L 224 ${110 - (weeklyProgress[4] * 0.9)} 
                            L 280 ${110 - (weeklyProgress[5] * 0.9)} 
                            L 340 ${110 - (weeklyProgress[6] * 0.9)}`}
                        fill="none"
                        stroke="#4A90D9"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Градиентное заполнение */}
                      <path
                        d={`M 0 ${110 - (weeklyProgress[0] * 0.9)} 
                            L 56 ${110 - (weeklyProgress[1] * 0.9)} 
                            L 112 ${110 - (weeklyProgress[2] * 0.9)} 
                            L 168 ${110 - (weeklyProgress[3] * 0.9)} 
                            L 224 ${110 - (weeklyProgress[4] * 0.9)} 
                            L 280 ${110 - (weeklyProgress[5] * 0.9)} 
                            L 340 ${110 - (weeklyProgress[6] * 0.9)}
                            L 340 110 L 0 110 Z`}
                        fill="url(#gradient-line-mockup)"
                      />

                      {/* Точки */}
                      {[0, 56, 112, 168, 224, 280, 340].map((x, i) => (
                        <circle
                          key={x}
                          cx={x}
                          cy={110 - (weeklyProgress[i] * 0.9)}
                          r="4.5"
                          fill="#FFFFFF"
                          stroke="#4A90D9"
                          strokeWidth="2.5"
                        />
                      ))}
                    </svg>
                  </div>

                  {/* Буквенные маркеры */}
                  <div className="flex justify-between text-[11px] font-bold text-[var(--text-secondary)] px-1 mt-1">
                    {DAYS_SHORT.map((day) => (
                      <span key={day} className="w-8 text-center">{day}</span>
                    ))}
                  </div>
                </section>

                {/* Статистика по привычкам */}
                <section className="space-y-4">
                  <h2 className="text-[13px] font-bold text-[var(--text-secondary)] tracking-wider uppercase mb-3 px-1">
                    Детальный отчет по привычкам
                  </h2>

                  {habits.length === 0 ? (
                    <div className="bg-[var(--bg-card)] rounded-2xl p-6 text-center border border-[var(--border-color)]">
                      <p className="text-[14px] text-[var(--text-secondary)] font-medium">Нет активных привычек</p>
                    </div>
                  ) : (
                    habits.map((h, index) => {
                      const rate = calculateCompletionPercentage(h);
                      return (
                        <div 
                          key={h.id} 
                          className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)] shadow-[var(--shadow-card)] space-y-3.5"
                          style={{ animationDelay: `${(index + 2) * 50}ms` }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
                              <h3 className="text-[15px] font-bold tracking-tight">{h.name}</h3>
                            </div>
                            <span className="text-[14px] font-black text-[#4A90D9]">{rate}%</span>
                          </div>

                          {/* Линейка из 7 дней */}
                          <div className="flex justify-between items-center bg-[var(--bg-primary)] p-2.5 rounded-xl border border-[var(--border-color)]">
                            {h.history.map((dayDone, idx) => {
                              const isToday = idx === getMskDayIndex();
                              return (
                                <div key={idx} className="flex flex-col items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                                    {DAYS_SHORT[idx]}
                                  </span>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                                    dayDone 
                                      ? 'bg-[#22C55E] text-white shadow-sm' 
                                      : isToday 
                                      ? 'bg-amber-500/10 text-amber-500 border-2 border-amber-500/30' 
                                      : 'bg-rose-500/10 text-rose-500 border-2 border-rose-500/15'
                                  }`}>
                                    {dayDone ? (
                                      <Check size={16} className="stroke-[3.5]" />
                                    ) : isToday ? (
                                      <span className="text-[10px] font-bold">Ожид</span>
                                    ) : (
                                      <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </section>
              </div>
            )}

          </div>

          {/* КНОПКА ДОБАВЛЕНИЯ (FAB) внутри телефона */}
          {currentScreen === 'main' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-[#4A90D9] to-[#357ABD] text-white shadow-lg shadow-blue-500/30 flex items-center justify-center active:scale-90 transition-transform cursor-pointer z-40 focus:outline-none focus:ring-4 focus:ring-blue-500/30 border-none"
              aria-label="Создать новую привычку"
              role="button"
            >
              <Plus size={30} className="stroke-[2.5]" />
            </button>
          )}

        </div>

        {/* ПРАВАЯ КОЛОНКА: Настольные виджеты High Density (скрыта на мобильных, видна на lg:) */}
        <div className="hidden lg:flex flex-col gap-6 select-text h-full">
          
          {/* Виджет 1: Динамика / Общая статистика */}
          <div className="bg-[var(--bg-card)] p-6 rounded-[24px] border border-[var(--border-color)] shadow-[var(--shadow-card)] flex flex-col justify-between transition-colors duration-300">
            <div>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <TrendingUp className="text-[#4A90D9]" size={20} />
                  <span>Общая статистика выполнения</span>
                </h3>
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[var(--chip-bg)] text-[var(--text-secondary)]">
                  7 дней
                </span>
              </div>

              {/* Красивый график High Density столбиками */}
              <div className="h-44 flex items-end gap-3.5 pb-4 border-b border-[var(--border-color)]">
                {weeklyProgress.map((prog, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2.5 group cursor-pointer h-full justify-end relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 bg-[var(--bg-primary)] border border-[var(--border-color)] text-[10px] font-black px-2 py-0.5 rounded shadow-[var(--shadow-card)] pointer-events-none whitespace-nowrap z-10 text-[var(--text-primary)]">
                      {prog}% выполнено
                    </div>

                    {/* Столбец */}
                    <div 
                      className="w-full bg-[#4A90D9] hover:bg-[#357ABD] rounded-lg transition-all duration-300 shadow-sm"
                      style={{ height: `${Math.max(prog, 8)}%` }}
                    />
                  </div>
                ))}
              </div>

              {/* Дни недели */}
              <div className="flex justify-between mt-3 text-xs font-bold text-[var(--text-secondary)] px-1">
                {DAYS_SHORT.map((day) => (
                  <span key={day} className="w-8 text-center">{day}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Виджет 2: Сетка Напарника и Новой Привычки */}
          <div className="grid grid-cols-2 gap-6">
            
            {/* Карточка: Твои напарники */}
            <div className="bg-[var(--bg-card)] p-6 rounded-[24px] border border-[var(--border-color)] shadow-[var(--shadow-card)] flex flex-col justify-between transition-colors duration-300">
              <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-4">
                Твои напарники ({friends.length})
              </h3>

              {friends.length > 0 ? (
                <div className="space-y-4 max-h-[160px] overflow-y-auto no-scrollbar">
                  {friends.map((f) => {
                    const linkedHabits = habits.filter(h => {
                      if (h.friendIds && h.friendIds.length > 0) {
                        return h.friendIds.includes(f.id);
                      }
                      return h.friendIds === undefined;
                    });

                    return (
                      <div key={f.id} className="space-y-2 border-b border-[var(--border-color)]/40 pb-2 last:border-none last:pb-0">
                        <div className="flex items-center gap-3">
                          {renderInitialsAvatar(f.name, 'w-9 h-9 text-xs shrink-0')}
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-[14px] truncate leading-tight">{f.name}</div>
                            <div className="text-[10px] text-emerald-500 font-bold flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                              <span>В связке</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleUnbindFriend(f.id)}
                            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border-none px-2 py-1 rounded-md font-bold text-[10px] transition-all active:scale-95 cursor-pointer shrink-0"
                          >
                            Отвязаться
                          </button>
                        </div>

                        {linkedHabits.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pl-0.5">
                            {linkedHabits.map((h) => {
                              const isDone = f.habits[h.id];
                              return (
                                <button
                                  key={h.id}
                                  title={`Кликните, чтобы симулировать отметку у ${f.name}`}
                                  onClick={() => {
                                    setFriends(prev => {
                                      const updated = prev.map(item => {
                                        if (item.id === f.id) {
                                          return {
                                            ...item,
                                            habits: {
                                              ...item.habits,
                                              [h.id]: !isDone
                                            }
                                          };
                                        }
                                        return item;
                                      });
                                      localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updated));
                                      return updated;
                                    });
                                    showToast(`Статус привычки "${h.name}" у напарника ${f.name} обновлен!`, 'success');
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold border flex items-center gap-1 transition-all cursor-pointer ${
                                    isDone
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  <span className="w-1 h-1 rounded-full" style={{ backgroundColor: h.color }} />
                                  <span>{h.name}</span>
                                  <span>{isDone ? '✓' : '○'}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-[var(--text-secondary)] leading-relaxed">
                  Напарники не привязаны.<br />Используйте вкладку <strong>Друзья</strong> эмулятора, чтобы подключить друга.
                </div>
              )}
            </div>

            {/* Карточка: Быстрое создание новой привычки */}
            <div className="bg-[var(--bg-card)] p-6 rounded-[24px] border border-[var(--border-color)] shadow-[var(--shadow-card)] flex flex-col justify-between transition-colors duration-300">
              <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                Создать привычку
              </h3>

              <div className="space-y-3">
                <input
                  type="text"
                  maxLength={30}
                  placeholder="Название новой привычки..."
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] font-medium text-xs focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50 transition-all placeholder:text-[var(--text-secondary)]/50"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewHabitName('');
                    }}
                    className="flex-1 h-10 rounded-xl bg-[var(--chip-bg)] text-[var(--text-primary)] font-bold text-xs active:scale-[0.98] transition-all cursor-pointer border-none"
                  >
                    Сброс
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newHabitName.trim()) {
                        showToast('Введите название привычки', 'error');
                        return;
                      }
                      handleCreateHabitLocal(newHabitName.trim(), '', '#4A90D9');
                      setNewHabitName('');
                    }}
                    className="flex-1 h-10 rounded-xl bg-[#4A90D9] hover:bg-[#357ABD] text-white font-bold text-xs active:scale-[0.98] transition-all cursor-pointer border-none"
                  >
                    Создать
                  </button>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* --- МОДАЛКИ (ЭКСТРАГИРОВАННЫЕ КОМПОНЕНТЫ) --- */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        TG_USER_ID={TG_USER_ID}
        tg={tg}
        showToast={showToast}
      />

      <AddHabitModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onCreateHabit={handleCreateHabitFromModal}
        friends={friends}
      />

      <HabitDetailsModal
        habit={activeHabitDetails}
        onClose={() => setActiveHabitDetails(null)}
        onToggle={handleToggleHabitLocal}
        onDelete={handleDeleteHabit}
        calculateCompletionPercentage={calculateCompletionPercentage}
        friends={friends}
      />

      {/* --- ТОСТ-УВЕДОМЛЕНИЯ --- */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2.5 max-w-sm w-full px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`w-full p-4 rounded-xl border shadow-lg flex items-center gap-3 transition-all duration-300 pointer-events-auto animate-fade-in-up ${
              toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300'
                : toast.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/25 border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300'
                : 'bg-blue-50 dark:bg-blue-950/25 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-300'
            }`}
          >
            <div className="shrink-0">
              {toast.type === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-500" />
              ) : toast.type === 'error' ? (
                <XCircle size={18} className="text-rose-500" />
              ) : (
                <Calendar size={18} className="text-blue-500" />
              )}
            </div>
            <div className="text-[13px] font-bold leading-tight flex-1">
              {toast.message}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
