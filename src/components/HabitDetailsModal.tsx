import React from 'react';
import { X, CheckCircle2, Trash2 } from 'lucide-react';
import { Habit, Friend } from '../types';

interface HabitDetailsModalProps {
  habit: Habit | null;
  onClose: () => void;
  onToggle: (habitId: number) => void;
  onDelete: (habitId: number) => void;
  calculateCompletionPercentage: (h: Habit) => number;
  friends: Friend[];
}

export const HabitDetailsModal: React.FC<HabitDetailsModalProps> = ({
  habit,
  onClose,
  onToggle,
  onDelete,
  calculateCompletionPercentage,
  friends,
}) => {
  if (!habit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Темный размытый оверлей */}
      <div 
        className="absolute inset-0 bg-black/60 modal-blur animate-fade-in" 
        onClick={onClose}
      />

      {/* Сама шторка */}
      <div className="relative w-full max-w-md bg-[var(--bg-card)] rounded-t-3xl p-5 border-t border-[var(--border-color)] shadow-2xl animate-fade-in-up z-10 max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-4" />

        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className="w-4.5 h-4.5 rounded-full" style={{ backgroundColor: habit.color }} />
            <h2 className="text-xl font-bold tracking-tight">{habit.name}</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--chip-bg)] text-[var(--text-secondary)] flex items-center justify-center active:scale-90 transition-transform cursor-pointer border-none"
            aria-label="Закрыть детали"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-[14px] text-[var(--text-secondary)] mb-4 leading-relaxed">
          {habit.description}
        </p>

        {/* Участвующие напарники */}
        {(() => {
          const habitFriends = habit.friendIds && habit.friendIds.length > 0
            ? friends.filter(f => habit.friendIds.includes(f.id))
            : habit.friendIds ? [] : friends; // if friendIds is empty array, show none. If undefined, show all (legacy)

          if (habitFriends.length === 0) return null;

          return (
            <div className="mb-4 space-y-2">
              <span className="block text-[11px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider pl-0.5">
                Участвующие напарники ({habitFriends.length}):
              </span>
              <div className="flex flex-wrap gap-2">
                {habitFriends.map(f => {
                  const doneToday = f.habits[habit.id];
                  return (
                    <div 
                      key={f.id} 
                      className="flex items-center gap-2 bg-[var(--bg-primary)] px-2.5 py-1.5 rounded-xl border border-[var(--border-color)]"
                    >
                      <div className="w-5 h-5 rounded-full bg-[#4A90D9] text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                        {f.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[12px] font-bold text-[var(--text-primary)]">{f.name}</span>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${doneToday ? 'bg-emerald-500' : 'bg-amber-400'}`} title={doneToday ? 'Выполнено' : 'Ожидает'} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Статистика выполнения */}
        <div className="bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)] space-y-3 mb-5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[var(--text-secondary)]">Регулярность:</span>
            <span className="text-[13px] font-bold text-[var(--text-primary)]">{habit.frequency}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[var(--text-secondary)]">Успешность (7 дней):</span>
            <span className="text-[13px] font-bold text-[#4A90D9]">{calculateCompletionPercentage(habit)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[var(--text-secondary)]">Текущий статус на сегодня:</span>
            <span className={`text-[13px] font-bold px-2.5 py-0.5 rounded-md ${
              habit.done 
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            }`}>
              {habit.done ? 'Выполнено ✓' : 'Ожидает выполнения'}
            </span>
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              onToggle(habit.id);
              onClose();
            }}
            className={`flex-1 h-12 rounded-xl font-bold text-[14px] active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none ${
              habit.done
                ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                : 'bg-[#22C55E] text-white hover:opacity-95 shadow-sm shadow-emerald-500/20'
            }`}
          >
            <CheckCircle2 size={18} />
            <span>{habit.done ? 'Снять отметку' : 'Отметить как готово'}</span>
          </button>
          
          <button
            onClick={() => {
              onDelete(habit.id);
              onClose();
            }}
            className="w-12 h-12 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 flex items-center justify-center active:scale-[0.98] transition-all shrink-0 cursor-pointer border-none"
            aria-label="Удалить привычку"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
