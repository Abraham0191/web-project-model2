import React, { useState, useRef } from 'react';

const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_LOWER = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export default function CalendarWidget({ 
  subjects = [], 
  tasks = [], 
  selectedDate, 
  setSelectedDate, 
  handleToggleTask, 
  handleDeleteTask,
  viewMode,
  setViewMode
}) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate ? selectedDate.getMonth() : 5); 
  const [currentYear, setCurrentYear] = useState(selectedDate ? selectedDate.getFullYear() : 2026);

  const containerRef = useRef(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(0);

  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !containerRef.current) return;
    const width = containerRef.current.offsetWidth;
    const currentX = e.targetTouches[0].clientX;
    const deltaX = currentX - touchStartX.current;

    let clampedDelta = deltaX;
    if (viewMode === 'semanal' && deltaX > 0) {
      clampedDelta = Math.pow(deltaX, 0.7); 
    } else if (viewMode === 'mensual' && deltaX < 0) {
      clampedDelta = -Math.pow(-deltaX, 0.7); 
    }
    setDragOffset(clampedDelta);
  };

  const handleTouchEnd = () => {
    if (!isDragging || !containerRef.current) return;
    setIsDragging(false);
    const width = containerRef.current.offsetWidth;
    const snapThreshold = width * 0.20;

    if (dragOffset < -snapThreshold && viewMode === 'semanal') {
      setViewMode('mensual');
    } else if (dragOffset > snapThreshold && viewMode === 'mensual') {
      setViewMode('semanal');
    }
    setDragOffset(0);
  };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; 
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(currentYear, currentMonth, i));
  }

  // Protección contra cadenas de fecha nulas o corruptas
  const getTasksForDate = (date) => {
    if (!date || !Array.isArray(tasks)) return [];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const localString = `${year}-${month}-${day}`;
    return tasks.filter(t => t && t.due_date === localString);
  };

  const hasClassesOnDayOfWeek = (date) => {
    if (!date || !Array.isArray(subjects)) return false;
    const weekdayName = WEEKDAYS_FULL[date.getDay()];
    return subjects.some(s => s && Array.isArray(s.schedule) && s.schedule.some(sc => sc.day === weekdayName));
  };

  // Divide las fechas de forma segura previniendo colapsos por campos nulos
  const getWeeklyData = (dayName) => {
    const dayClasses = subjects.filter(s => s && Array.isArray(s.schedule) && s.schedule.some(sc => sc.day === dayName));
    const dayTasks = tasks.filter(t => {
      if (!t || !t.due_date || typeof t.due_date !== 'string') return false;
      const parts = t.due_date.split('-');
      if (parts.length !== 3) return false;
      const [y, m, d] = parts.map(Number);
      const taskDate = new Date(y, m - 1, d); 
      return WEEKDAYS_FULL[taskDate.getDay()] === dayName && !t.completed;
    });
    return { dayClasses, dayTasks };
  };

  const activeIndex = viewMode === 'mensual' ? 1 : 0;
  const containerWidthValue = containerRef.current?.offsetWidth || 1;
  const viewsTranslatePercent = -(activeIndex * 50) + (dragOffset / containerWidthValue) * 50;

  const activeDateTasks = getTasksForDate(selectedDate);
  const activeDateClasses = subjects.filter(s => 
    s && Array.isArray(s.schedule) && s.schedule.some(sc => sc.day === WEEKDAYS_FULL[selectedDate ? selectedDate.getDay() : 0])
  );
  const hasEvents = activeDateTasks.length > 0 || activeDateClasses.length > 0;

  return (
    <div className="bg-[#1f1f21] rounded-[2.5rem] border border-white/[0.04] shadow-2xl p-6 select-none overflow-hidden text-slate-100 flex flex-col md:flex-row gap-8 min-h-[340px]">
      
      {/* SECCIÓN IZQUIERDA: CALENDARIO */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex-1 flex flex-col justify-between"
      >
        <div className="space-y-4">
          
          <div className="flex items-center justify-between">
            <h3 className="text-3xl font-extrabold text-white tracking-tight capitalize px-2">
              {MONTHS_LOWER[currentMonth]}
            </h3>
            
            {viewMode === 'mensual' && (
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => {
                    if (currentMonth === 0) {
                      setCurrentMonth(11);
                      setCurrentYear(currentYear - 1);
                    } else {
                      setCurrentMonth(currentMonth - 1);
                    }
                  }} 
                  className="p-1.5 rounded-full hover:bg-white/5 transition-colors text-slate-400 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button 
                  onClick={() => {
                    if (currentMonth === 11) {
                      setCurrentMonth(0);
                      setCurrentYear(currentYear + 1);
                    } else {
                      setCurrentMonth(currentMonth + 1);
                    }
                  }} 
                  className="p-1.5 rounded-full hover:bg-white/5 transition-colors text-slate-400 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          <div className="relative overflow-hidden w-full">
            <div 
              ref={containerRef}
              className={`flex w-[200%] ${isDragging ? 'transition-none' : 'transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1)'}`}
              style={{ transform: `translateX(${viewsTranslatePercent}%)` }}
            >
              
              {/* VISTA SEMANAL */}
              <div className="w-1/2 shrink-0 pr-2">
                <div className="grid grid-cols-5 gap-2">
                  {WEEKDAYS.map((day) => {
                    const { dayClasses, dayTasks } = getWeeklyData(day);
                    return (
                      <div key={day} className="rounded-xl p-3 bg-white/[0.02] border border-white/[0.05] flex flex-col min-h-[160px]">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 mb-2 border-b border-white/[0.04] pb-0.5 block">
                          {day.substring(0, 3)}
                        </span>
                        <div className="space-y-1 mb-2">
                          {dayClasses.map(cls => (
                            <div key={cls.id} className="text-[10px] text-indigo-200 truncate">
                              • {cls.name}
                            </div>
                          ))}
                        </div>
                        <div className="mt-auto text-[9px] text-emerald-400">
                          {dayTasks.length > 0 ? `${dayTasks.length} pendiente(s)` : '✓ Libre'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* VISTA MENSUAL */}
              <div className="w-1/2 shrink-0 pl-2">
                <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center">
                  {WEEKDAYS_SHORT.map((day, idx) => (
                    <span 
                      key={idx} 
                      className={`text-[11px] font-extrabold uppercase py-1 ${idx === 6 ? 'text-red-500' : 'text-slate-500'}`}
                    >
                      {day}
                    </span>
                  ))}

                  {calendarDays.map((date, idx) => {
                    if (!date) {
                      return <div key={`empty-${idx}`} className="p-2 opacity-0"></div>;
                    }

                    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                    const hasClasses = hasClassesOnDayOfWeek(date);
                    const dayTasks = getTasksForDate(date);
                    const hasTasks = dayTasks.length > 0;

                    return (
                      <button
                        key={date.toDateString()}
                        onClick={() => setSelectedDate(date)}
                        className={`p-1.5 rounded-full flex flex-col items-center justify-center relative transition-all h-9 w-9 aspect-square mx-auto ${
                          isSelected 
                            ? 'bg-white text-slate-950 font-black shadow-md' 
                            : 'hover:bg-white/5 border border-transparent text-slate-300'
                        }`}
                      >
                        <span className="text-sm font-semibold">{date.getDate()}</span>
                        {!isSelected && (hasClasses || hasTasks) && (
                          <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${hasTasks ? 'bg-amber-400' : 'bg-indigo-400'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN DERECHA: EVENTOS Y TAREAS */}
      <div className="w-full md:w-[42%] border-t md:border-t-0 md:border-l border-white/[0.06] pt-6 md:pt-0 md:pl-8 flex flex-col justify-center">
        {!hasEvents ? (
          <div className="text-center py-8">
            <h4 className="text-xl font-bold text-slate-400 tracking-tight">
              No hay eventos
            </h4>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              ¡Disfruta del día!
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 block border-b border-white/[0.05] pb-1.5">
              Eventos programados
            </span>
            
            {activeDateClasses.map(cls => {
              const time = cls.schedule.find(sc => sc.day === WEEKDAYS_FULL[selectedDate ? selectedDate.getDay() : 0])?.time;
              return (
                <div key={cls.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-200">{cls.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{time}</p>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-[9px] font-bold text-indigo-300">
                    {cls.classroom}
                  </span>
                </div>
              );
            })}

            {activeDateTasks.map(task => {
              const subj = subjects.find(s => s && s.id === task.subject_id);
              return (
                <div key={task.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs group">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTask(task)}
                      className="w-4 h-4 rounded border-white/20 bg-black/40 text-indigo-600 cursor-pointer"
                    />
                    <span className={`${task.completed ? 'line-through text-slate-500' : 'text-slate-200 font-medium'}`}>
                      [{subj ? subj.name.substring(0,5) : '..'}..] {task.title}
                    </span>
                  </div>
                  <button onClick={() => handleDeleteTask(task.id)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}