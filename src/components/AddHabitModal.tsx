import React, { useState } from 'react';
import { X, Check, Users, Calendar, Clock, Sparkles } from 'lucide-react';
import { Friend } from '../types';

export const HABIT_COLORS = [
  { id: 'blue', value: '#4A90D9', bgClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { id: 'green', value: '#22C55E', bgClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  { id: 'amber', value: '#F59E0B', bgClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  { id: 'rose', value: '#EF4444', bgClass: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
  { id: 'purple', value: '#8B5CF6', bgClass: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  { id: 'pink', value: '#EC4899', bgClass: 'bg-pink-500/10 text-pink-500 border-pink-500/20' },
];

const WEEK_DAYS = [
  { id: 1, label: 'Пн', fullName: 'Понедельник' },
  { id: 2, label: 'Вт', fullName: 'Вторник' },
  { id: 3, label: 'Ср', fullName: 'Среда' },
  { id: 4, label: 'Чт', fullName: 'Четверг' },
  { id: 5, label: 'Пт', fullName: 'Пятница' },
  { id: 6, label: 'Сб', fullName: 'Суббота' },
  { id: 7, label: 'Вс', fullName: 'Воскресенье' },
];

interface AddHabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateHabit: (
    name: string,
    description: string,
    color: string,
    periodicityType: 'daily' | 'every_other_day' | 'weekly' | 'custom_days',
    periodicityDays: number[],
    friendIds: number[]
  ) => void;
  friends: Friend[];
}

export const AddHabitModal: React.FC<AddHabitModalProps> = ({
  isOpen,
  onClose,
  onCreateHabit,
  friends,
}) => {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedColorId, setSelectedColorId] = useState('blue');

  // New states for periodicity
  const [periodicityType, setPeriodicityType] = useState<'daily' | 'every_other_day' | 'weekly' | 'custom_days'>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]); // default Mon, Wed, Fri for custom_days

  // New states for friend inviting
  const [invitedFriendIds, setInvitedFriendIds] = useState<number[]>([]);

  if (!isOpen) return null;

  const handleToggleDay = (dayId: number) => {
    setSelectedDays(prev => 
      prev.includes(dayId) 
        ? prev.filter(id => id !== dayId) 
        : [...prev, dayId].sort((a, b) => a - b)
    );
  };

  const handleToggleFriend = (friendId: number) => {
    setInvitedFriendIds(prev => 
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleSelectAllFriends = () => {
    if (invitedFriendIds.length === friends.length) {
      setInvitedFriendIds([]);
    } else {
      setInvitedFriendIds(friends.map(f => f.id));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Validate custom days
    const finalDays = periodicityType === 'custom_days' ? (selectedDays.length > 0 ? selectedDays : [1, 2, 3, 4, 5, 6, 7]) : [];
    
    const colorVal = HABIT_COLORS.find(c => c.id === selectedColorId)?.value || '#4A90D9';
    
    onCreateHabit(
      name.trim(),
      desc.trim(),
      colorVal,
      periodicityType,
      finalDays,
      invitedFriendIds
    );

    // Reset form
    setName('');
    setDesc('');
    setSelectedColorId('blue');
    setPeriodicityType('daily');
    setSelectedDays([1, 3, 5]);
    setInvitedFriendIds([]);
    onClose();
  };

  const renderInitials = (friendName: string) => {
    const parts = friendName.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return friendName.substring(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center select-text">
      {/* Темный размытый оверлей */}
      <div 
        className="absolute inset-0 bg-black/60 modal-blur animate-fade-in" 
        onClick={onClose}
      />

      {/* Сама шторка с прокруткой для контента */}
      <div className="relative w-full max-w-md bg-[var(--bg-card)] rounded-t-3xl p-5 border-t border-[var(--border-color)] shadow-2xl animate-fade-in-up z-10 max-h-[92vh] overflow-y-auto no-scrollbar flex flex-col">
        <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-4 shrink-0" />
        
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h2 className="text-xl font-bold tracking-tight">Новая привычка</h2>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--chip-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
            aria-label="Закрыть окно"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pb-4">
          {/* 1. НАЗВАНИЕ ПРИВЫЧКИ */}
          <div>
            <label htmlFor="modal-habit-name" className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1.5 pl-0.5">
              Название привычки
            </label>
            <input
              id="modal-habit-name"
              type="text"
              maxLength={30}
              placeholder="Например: Чтение книги"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] font-medium text-[15px] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50 transition-all placeholder:text-[var(--text-secondary)]/50"
              required
            />
          </div>

          {/* 2. ОПИСАНИЕ ПРИВЫЧКИ */}
          <div>
            <label htmlFor="modal-habit-desc" className="block text-[13px] font-bold text-[var(--text-secondary)] mb-1.5 pl-0.5">
              Описание (кратко)
            </label>
            <textarea
              id="modal-habit-desc"
              rows={2}
              maxLength={100}
              placeholder="Зачем или как выполнять... (например: 15 страниц перед сном)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] font-medium text-[15px] focus:outline-none focus:ring-2 focus:ring-[#4A90D9]/50 transition-all placeholder:text-[var(--text-secondary)]/50 resize-none"
            />
          </div>

          {/* 3. ВЫБОР ПЕРИОДИЧНОСТИ */}
          <div className="space-y-2">
            <span className="block text-[13px] font-bold text-[var(--text-secondary)] pl-0.5 flex items-center gap-1.5">
              <Calendar size={14} className="text-[#4A90D9]" />
              Периодичность отметки
            </span>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPeriodicityType('daily')}
                className={`h-11 px-3 rounded-xl border text-[13px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer justify-start ${
                  periodicityType === 'daily'
                    ? 'border-[#4A90D9] bg-[#4A90D9]/10 text-[#4A90D9]'
                    : 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${periodicityType === 'daily' ? 'border-[#4A90D9]' : 'border-[var(--text-secondary)]'}`}>
                  {periodicityType === 'daily' && <div className="w-1.5 h-1.5 rounded-full bg-[#4A90D9]" />}
                </div>
                <span>Ежедневно</span>
              </button>

              <button
                type="button"
                onClick={() => setPeriodicityType('every_other_day')}
                className={`h-11 px-3 rounded-xl border text-[13px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer justify-start ${
                  periodicityType === 'every_other_day'
                    ? 'border-[#4A90D9] bg-[#4A90D9]/10 text-[#4A90D9]'
                    : 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${periodicityType === 'every_other_day' ? 'border-[#4A90D9]' : 'border-[var(--text-secondary)]'}`}>
                  {periodicityType === 'every_other_day' && <div className="w-1.5 h-1.5 rounded-full bg-[#4A90D9]" />}
                </div>
                <span>Через день</span>
              </button>

              <button
                type="button"
                onClick={() => setPeriodicityType('weekly')}
                className={`h-11 px-3 rounded-xl border text-[13px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer justify-start ${
                  periodicityType === 'weekly'
                    ? 'border-[#4A90D9] bg-[#4A90D9]/10 text-[#4A90D9]'
                    : 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${periodicityType === 'weekly' ? 'border-[#4A90D9]' : 'border-[var(--text-secondary)]'}`}>
                  {periodicityType === 'weekly' && <div className="w-1.5 h-1.5 rounded-full bg-[#4A90D9]" />}
                </div>
                <span>Раз в неделю</span>
              </button>

              <button
                type="button"
                onClick={() => setPeriodicityType('custom_days')}
                className={`h-11 px-3 rounded-xl border text-[13px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer justify-start ${
                  periodicityType === 'custom_days'
                    ? 'border-[#4A90D9] bg-[#4A90D9]/10 text-[#4A90D9]'
                    : 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${periodicityType === 'custom_days' ? 'border-[#4A90D9]' : 'border-[var(--text-secondary)]'}`}>
                  {periodicityType === 'custom_days' && <div className="w-1.5 h-1.5 rounded-full bg-[#4A90D9]" />}
                </div>
                <span>Дни недели</span>
              </button>
            </div>

            {/* Выбор дней недели, если выбраны Определенные дни */}
            {periodicityType === 'custom_days' && (
              <div className="bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-color)] animate-fade-in space-y-2">
                <span className="block text-[11px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider mb-1 pl-0.5">
                  Выберите дни (хотя бы один):
                </span>
                <div className="flex items-center justify-between gap-1.5">
                  {WEEK_DAYS.map((day) => {
                    const isSelected = selectedDays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => handleToggleDay(day.id)}
                        className={`w-9 h-9 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center justify-center ${
                          isSelected
                            ? 'bg-[#4A90D9] text-white border-[#4A90D9] shadow-sm shadow-[#4A90D9]/20'
                            : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                        title={day.fullName}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4. ВЫБОР ДРУЗЕЙ ДЛЯ СВЯЗКИ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pl-0.5">
              <span className="text-[13px] font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                <Users size={14} className="text-[#4A90D9]" />
                Кто участвует из напарников?
              </span>
              {friends.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllFriends}
                  className="text-[11px] text-[#4A90D9] font-bold border-none bg-transparent cursor-pointer hover:underline p-0"
                >
                  {invitedFriendIds.length === friends.length ? 'Снять всех' : 'Выбрать всех'}
                </button>
              )}
            </div>

            {friends.length === 0 ? (
              <div className="bg-[var(--bg-primary)] p-4 rounded-xl border border-[var(--border-color)] text-center text-xs text-[var(--text-secondary)] leading-relaxed">
                У вас пока нет привязанных напарников. Вы можете добавить их во вкладке <strong>Друзья</strong>, чтобы вместе отслеживать прогресс!
              </div>
            ) : (
              <div className="bg-[var(--bg-primary)] p-2.5 rounded-xl border border-[var(--border-color)] max-h-[140px] overflow-y-auto space-y-1.5 no-scrollbar">
                {friends.map((friend) => {
                  const isInvited = invitedFriendIds.includes(friend.id);
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => handleToggleFriend(friend.id)}
                      className={`w-full p-2 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                        isInvited
                          ? 'bg-[#4A90D9]/8 border-[#4A90D9]/30 text-[var(--text-primary)]'
                          : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Аватарка */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                          isInvited ? 'bg-[#4A90D9] text-white' : 'bg-[var(--chip-bg)] text-[var(--text-primary)]'
                        }`}>
                          {renderInitials(friend.name)}
                        </div>
                        <div className="text-left min-w-0">
                          <div className="font-bold text-[13px] truncate leading-tight">{friend.name}</div>
                          <div className="text-[10px] opacity-60 truncate">@{friend.username}</div>
                        </div>
                      </div>

                      {/* Галочка */}
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                        isInvited
                          ? 'bg-[#4A90D9] border-[#4A90D9] text-white'
                          : 'border-[var(--border-color)] bg-[var(--bg-primary)]'
                      }`}>
                        {isInvited && <Check size={12} className="stroke-[3.5]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. ВЫБОР ЦВЕТА */}
          <div>
            <span className="block text-[13px] font-bold text-[var(--text-secondary)] mb-2 pl-0.5 flex items-center gap-1.5">
              <Clock size={14} className="text-[#4A90D9]" />
              Цветовой маркер
            </span>
            <div className="flex items-center gap-3 bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-color)] justify-between">
              {HABIT_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setSelectedColorId(color.id)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform cursor-pointer relative flex items-center justify-center ${
                    selectedColorId === color.id 
                      ? 'scale-110 border-[var(--text-primary)] ring-4 ring-[#4A90D9]/25' 
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                  aria-label={`Выбрать цвет ${color.id}`}
                >
                  {selectedColorId === color.id && (
                    <Check size={16} className="text-white stroke-[3.5]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-3 pt-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl bg-[var(--chip-bg)] text-[var(--text-primary)] font-bold text-[15px] active:scale-[0.98] transition-all cursor-pointer border-none"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#4A90D9] to-[#357ABD] text-white font-bold text-[15px] active:scale-[0.98] transition-all cursor-pointer border-none"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
