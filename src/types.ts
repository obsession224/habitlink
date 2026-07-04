/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Habit {
  id: number;
  name: string;
  description: string;
  done: boolean;
  frequency: string; // e.g. 'daily' or '🔥 Ежедневно'
  periodicityType?: 'daily' | 'every_other_day' | 'weekly' | 'custom_days';
  periodicityDays?: number[]; // [1, 2, 3, 4, 5, 6, 7] (1 = Пн, 7 = Вс)
  friendIds?: number[]; // list of friend IDs invited/linked to this habit
  color: string; // hex color or color index
  history: boolean[]; // 7 boolean values for the past 7 days (including today)
  owner_id?: number; // ID of the habit creator
  owner_name?: string; // Name of the habit creator
  shared_with?: number[]; // list of user IDs this habit is shared with
}

export interface Friend {
  id: number;
  name: string;
  username: string;
  photo_url?: string;
  status: 'active' | 'pending' | 'none';
  habits: Record<number, boolean>; // habitId -> done today
}

export interface FriendRequest {
  id: number;
  name: string;
  username: string;
  photo_url?: string;
}

export interface AppState {
  currentScreen: 'main' | 'friends' | 'stats';
  habits: Habit[];
  friends: Friend[];
  friendRequests: FriendRequest[];
  user: {
    id: number | null;
    name: string;
    username?: string;
    photo_url?: string;
  };
  weeklyProgress: number[]; // percentage for each day of the week
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
          };
          start_param?: string;
        };
        MainButton: {
          hide: () => void;
          show: () => void;
        };
        colorScheme: 'light' | 'dark';
        themeParams: Record<string, string>;
        openTelegramLink: (url: string) => void;
      };
    };
  }
}
