import React from 'react';
import { X } from 'lucide-react';
import { renderInitialsAvatar } from './Avatars';

interface User {
  id: number | null;
  name: string;
  username?: string;
  photo_url?: string;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  TG_USER_ID: number;
  tg?: any;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  TG_USER_ID,
  tg,
  showToast,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center select-text">
      {/* Темный размытый оверлей */}
      <div 
        className="absolute inset-0 bg-black/60 modal-blur" 
        onClick={onClose}
      />

      {/* Шторка профиля */}
      <div className="relative w-full max-w-md bg-[var(--bg-card)] rounded-t-3xl p-5 border-t border-[var(--border-color)] shadow-2xl animate-fade-in-up z-10 text-center">
        <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-4" />

        <div className="flex justify-end absolute top-5 right-5">
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--chip-bg)] text-[var(--text-secondary)] flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
            aria-label="Закрыть детали"
          >
            <X size={18} />
          </button>
        </div>

        {/* Юзер-информация */}
        <div className="mt-2 flex flex-col items-center">
          {user.photo_url ? (
            <img 
              src={user.photo_url} 
              alt={user.name} 
              className="w-20 h-20 rounded-full border-4 border-[#4A90D9]/20 object-cover shadow-md"
              referrerPolicy="no-referrer"
            />
          ) : (
            renderInitialsAvatar(user.name, 'w-20 h-20 text-2xl border-4')
          )}

          <h2 className="text-xl font-black tracking-tight mt-3.5 leading-tight">{user.name}</h2>
          {user.username && (
            <p className="text-[13px] text-[var(--text-secondary)] font-semibold mt-0.5">
              @{user.username}
            </p>
          )}
          <span className="inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/15 mt-3">
            ID Telegram: {TG_USER_ID}
          </span>
        </div>

        {/* Описание приложения и лицензия */}
        <div className="bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)] space-y-3 mt-5 text-left text-xs leading-relaxed text-[var(--text-secondary)] font-medium">
          <p>
            <strong>HabitLink Clone v1.0</strong> — это мини-приложение для Telegram, созданное для социальной геймификации полезных привычек в парах.
          </p>
          <p className="border-t border-[var(--border-color)] pt-2">
            Синхронизация происходит автоматически. Приложение поддерживает автономный режим работы и сохраняет весь прогресс на вашем устройстве при отсутствии сети.
          </p>
        </div>

        <button
          onClick={() => {
            onClose();
            if (tg) {
              tg.close();
            } else {
              showToast('Приложение работает вне Telegram', 'info');
            }
          }}
          className="w-full h-12 rounded-xl bg-rose-500 text-white font-bold text-[15px] active:scale-[0.98] transition-all mt-4.5 cursor-pointer"
        >
          Закрыть WebApp
        </button>
      </div>
    </div>
  );
};
