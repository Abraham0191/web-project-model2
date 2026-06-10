import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const WEEKDAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const SECTION_PIN = "1234";

const FAQ_ITEMS = [
  {
    question: "¿Cómo funciona la escala de 0 a 10 puntos en la UNEG?",
    answer: "La escala oficial de calificación de la UNEG va de 0 a 10 puntos, donde el 100% de la materia equivale a los 10 puntos. Para aprobar una materia, debes acumular una nota final mínima de 5.0 puntos. En cada evaluación, multiplicas tu nota por el porcentaje correspondiente para sumar al acumulado."
  },
  {
    question: "Inscripciones, choques de horario y cambios de sección (SIP)",
    answer: "Si tienes choques de horario o necesitas ajustar tu carga de materias, debes estar atento a las fechas de 'Modificación de Inscripción' dictadas por Control de Estudios. Este proceso se gestiona directamente en línea a través del Sistema de Inscripción de Pregrado (SIP)."
  },
  {
    question: "Aulas Virtuales de informática y pregrado (UNEGVIRTUAL)",
    answer: "Debes ingresar al Campus Virtual (virtual.uneg.edu.ve) con tus datos de estudiante. Allí los docentes cargarán los cursos académicos complementarios de este semestre (Cálculo, Materiales, Inglés, etc.)."
  },
  {
    question: "Soporte estudiantil, comedor y becas (SASE)",
    answer: "El Sistema de Apoyo a los Servicios Estudiantiles (SASE) gestiona los beneficios para el pregrado como las postulaciones a becas estudiantiles, alertas del servicio de comedor universitario o apoyo médico básico."
  }
];

export default function App() {
  const [subjects, setSubjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para vistas de calendario
  const [viewMode, setViewMode] = useState('mensual'); 
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 5, 10)); 
  const [currentMonth, setCurrentMonth] = useState(5); 
  const [currentYear, setCurrentYear] = useState(2026);

  // Estados de control de modals y formularios
  const [activeSubject, setActiveSubject] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSubject, setNewTaskSubject] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('2026-06-10');
  
  const [activeFaq, setActiveFaq] = useState(null);
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState('');

  // --- REFS PARA CONTROL DE GESTOS EN MÓVIL ---
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(0);

  const handleTouchStart = (e) => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
    touchStartX.current = e.targetTouches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !containerWidth) return;
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
    if (!isDragging) return;
    setIsDragging(false);

    const snapThreshold = containerWidth * 0.20;

    if (dragOffset < -snapThreshold && viewMode === 'semanal') {
      setViewMode('mensual');
    } else if (dragOffset > snapThreshold && viewMode === 'mensual') {
      setViewMode('semanal');
    }

    setDragOffset(0);
  };

  // Cargar materias
  useEffect(() => {
    async function fetchSubjects() {
      const { data, error } = await supabase
        .from('materias')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data) {
        setSubjects(data);
        if (data.length > 0) setNewTaskSubject(data[0].id);
      }
    }
    fetchSubjects();
  }, []);

  // Cargar tareas
  useEffect(() => {
    async function fetchTasks() {
      const { data, error } = await supabase.from('tareas').select('*');
      if (!error && data) {
        setTasks(data);
      }
      setLoading(false);
    }

    fetchTasks();

    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Agregar una tarea nueva
  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    if (inputPin !== SECTION_PIN) {
      setPinError('Código de sección incorrecto.');
      return;
    }

    const { error } = await supabase.from('tareas').insert([
      {
        title: newTaskTitle,
        subject_id: newTaskSubject,
        due_date: newTaskDate,
        completed: false
      }
    ]);

    if (!error) {
      setNewTaskTitle('');
      setInputPin('');
      setPinError('');
    } else {
      setPinError('Error al registrar la tarea.');
    }
  };

  // Completar tarea
  const handleToggleTask = async (task) => {
    const { error } = await supabase
      .from('tareas')
      .update({ completed: !task.completed })
      .eq('id', task.id);

    if (error) console.error(error.message);
  };

  // Eliminar tarea
  const handleDeleteTask = async (taskId) => {
    const { error } = await supabase.from('tareas').delete().eq('id', taskId);
    if (error) console.error(error.message);
  };

  // Editar materia
  const handleSaveSubjectDetails = async (e) => {
    e.preventDefault();
    if (inputPin !== SECTION_PIN) {
      setPinError('Código de sección incorrecto.');
      return;
    }

    const { error } = await supabase
      .from('materias')
      .update({
        professor: editingSubject.professor,
        contact: editingSubject.contact,
        classroom: editingSubject.classroom,
        drive_link: editingSubject.drive_link,
        evaluation_plan: editingSubject.evaluation_plan
      })
      .eq('id', editingSubject.id);

    if (!error) {
      setSubjects(subjects.map(s => s.id === editingSubject.id ? editingSubject : s));
      setActiveSubject(editingSubject);
      setEditingSubject(null);
      setInputPin('');
      setPinError('');
    } else {
      setPinError('Error al actualizar materia.');
    }
  };

  // Lógica de fechas
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

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const getTasksForDate = (date) => {
    if (!date) return [];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const localString = `${year}-${month}-${day}`;
    return tasks.filter(t => t.due_date === localString);
  };

  const hasClassesOnDayOfWeek = (date) => {
    if (!date) return false;
    const weekdayName = WEEKDAYS_FULL[date.getDay()];
    return subjects.some(s => s.schedule && s.schedule.some(sc => sc.day === weekdayName));
  };

  const formatFriendlyDate = (date) => {
    const dayName = WEEKDAYS_FULL[date.getDay()];
    const dayNum = date.getDate();
    const monthName = MONTHS[date.getMonth()];
    return `${dayName}, ${dayNum} de ${monthName}`;
  };

  const getWeeklyData = (dayName) => {
    const dayClasses = subjects.filter(s => s.schedule && s.schedule.some(sc => sc.day === dayName));
    const dayTasks = tasks.filter(t => {
      const [y, m, d] = t.due_date.split('-').map(Number);
      const taskDate = new Date(y, m - 1, d); 
      return WEEKDAYS_FULL[taskDate.getDay()] === dayName && !t.completed;
    });

    return { dayClasses, dayTasks };
  };

  // --- INTERPOLACIÓN DE MOVIMIENTO ---
  const activeIndex = viewMode === 'mensual' ? 1 : 0;
  const widthDenominator = containerWidth || 1;
  const viewsTranslatePercent = -(activeIndex * 50) + (dragOffset / widthDenominator) * 50;
  const capsuleTranslatePercent = (activeIndex * 100) - (dragOffset / widthDenominator) * 100;
  const clampedCapsuleTranslate = Math.max(0, Math.min(100, capsuleTranslatePercent));

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-100">
        <div className="text-center space-y-3">
          <div className="w-9 h-9 border-[3.5px] border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Cargando Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-slate-100 font-sans relative overflow-x-hidden p-4 md:p-8 pb-24">
      
      {/* Mesh Gradient Animado (Pulsación difuminada estilo iOS) */}
      <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px] animate-pulse duration-10000 pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-15%] w-[700px] h-[700px] rounded-full bg-pink-500/5 blur-[150px] animate-pulse duration-7000 pointer-events-none"></div>
      <div className="absolute top-[30%] left-[20%] w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[130px] animate-pulse duration-8000 pointer-events-none"></div>

      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] shadow-2xl">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-extrabold">Portal Académico</span>
            <h1 className="text-xl md:text-2xl font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Ingeniería de Software
            </h1>
          </div>
          
          <nav className="flex items-center gap-1.5 bg-black/35 p-1 rounded-full border border-white/[0.06]">
            <a href="#materias" className="px-4 py-2 text-xs font-bold rounded-full hover:bg-white/[0.06] transition-all">
              Materias
            </a>
            <a href="#cronograma" className="px-4 py-2 text-xs font-bold rounded-full hover:bg-white/[0.06] transition-all">
              Cronograma
            </a>
            <a href="#guia" className="px-4 py-2 text-xs font-bold rounded-full hover:bg-white/[0.06] transition-all">
              Guía UNEG
            </a>
          </nav>
        </header>

        {/* MATERIAS */}
        <section id="materias" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold text-white/95 tracking-tight">Materias del Semestre</h2>
            <span className="text-[11px] text-slate-400">Presiona una para ver aulas, planes y guías</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {subjects.map((subj) => (
              <div
                key={subj.id}
                onClick={() => {
                  setActiveSubject(subj);
                  setEditingSubject(null);
                  setPinError('');
                }}
                className={`group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br ${subj.color} backdrop-blur-xl border border-white/[0.07] shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] shadow-lg hover:shadow-2xl hover:border-white/[0.15] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer`}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="px-2.5 py-1 rounded-lg bg-black/20 text-[10px] font-bold text-indigo-300 border border-white/[0.05]">
                    {subj.classroom || 'Aula por definir'}
                  </span>
                  <svg className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight mb-1 group-hover:text-indigo-200 transition-colors">{subj.name}</h3>
                <p className="text-xs text-slate-400 truncate">{subj.professor}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECCIÓN CRONOGRAMA INTERACTIVO */}
        <section id="cronograma" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* PANEL PRINCIPAL: CALENDARIO DE ARRASTRE */}
          <div 
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="lg:col-span-2 space-y-4 rounded-3xl p-6 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] shadow-2xl flex flex-col justify-between select-none overflow-hidden"
          >
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-white/[0.06]">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Cronograma de la Sección</h3>
                <p className="text-xs text-slate-400">Controla el horario y las entregas grupales</p>
              </div>
              
              {/* SWITCH IOS SEGMENTED CONTROL */}
              <div className="relative flex bg-black/45 p-1 rounded-xl border border-white/[0.08] w-44 h-9 select-none shrink-0 self-start">
                
                {/* Pastilla indicadora */}
                <div 
                  className={`absolute top-1 bottom-1 left-1 rounded-lg bg-indigo-600/90 shadow-[0_2px_8px_rgba(99,102,241,0.3)] ${isDragging ? 'transition-none' : 'transition-transform duration-300 ease-out'}`}
                  style={{ 
                    width: 'calc(50% - 4px)',
                    transform: `translateX(${clampedCapsuleTranslate}%)` 
                  }}
                />
                
                <button
                  onClick={() => setViewMode('semanal')}
                  className={`relative z-10 flex-1 text-center text-xs font-bold transition-colors duration-300 ${viewMode === 'semanal' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Semanal
                </button>
                <button
                  onClick={() => setViewMode('mensual')}
                  className={`relative z-10 flex-1 text-center text-xs font-bold transition-colors duration-300 ${viewMode === 'mensual' ? 'text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Mensual
                </button>
              </div>
            </div>

            {/* CARRUSEL DE VISTAS (SLIDER) */}
            <div className="relative overflow-hidden w-full flex-1">
              <div 
                ref={containerRef}
                className={`flex w-[200%] ${isDragging ? 'transition-none' : 'transition-transform duration-300 cubic-bezier(0.16, 1, 0.3, 1)'}`}
                style={{ transform: `translateX(${viewsTranslatePercent}%)` }}
              >
                
                {/* 1. VISTA SEMANAL */}
                <div className="w-1/2 shrink-0 pr-2">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {WEEKDAYS.map((day) => {
                      const { dayClasses, dayTasks } = getWeeklyData(day);

                      return (
                        <div key={day} className="rounded-xl p-4 bg-white/[0.02] border border-white/[0.05] shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)] flex flex-col min-h-[220px]">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-400 mb-3 border-b border-white/[0.05] pb-1 block">
                            {day}
                          </span>
                          
                          <div className="space-y-2 mb-4">
                            {dayClasses.map(cls => {
                              const time = cls.schedule.find(sc => sc.day === day)?.time;
                              return (
                                <div key={cls.id} className="p-2 rounded bg-indigo-500/10 border border-indigo-500/15 text-xs">
                                  <div className="font-semibold text-indigo-200 truncate">{cls.name}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">{time}</div>
                                  <div className="text-[10px] text-indigo-400 font-semibold">{cls.classroom}</div>
                                </div>
                              );
                            })}
                            {dayClasses.length === 0 && (
                              <div className="text-[10px] text-slate-500 italic">Sin clases</div>
                            )}
                          </div>

                          <div className="mt-auto pt-2 border-t border-white/[0.05] space-y-1.5">
                            <span className="text-[10px] font-bold text-slate-400 block">Entregas de la semana:</span>
                            {dayTasks.map(task => {
                              const subj = subjects.find(s => s.id === task.subject_id);
                              return (
                                <div key={task.id} className="p-1.5 rounded bg-amber-500/10 border border-amber-500/15 text-[11px] text-amber-200">
                                  <span className="font-bold">[{subj?.name?.substring(0,5)}..]</span> {task.title}
                                </div>
                              );
                            })}
                            {dayTasks.length === 0 && (
                              <div className="text-[10px] text-emerald-400/70">✓ Sin tareas</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. VISTA MENSUAL (CALENDARIO) */}
                <div className="w-1/2 shrink-0 pl-2">
                  <div className="space-y-4">
                    {/* Selector de Mes */}
                    <div className="flex items-center justify-between bg-white/[0.03] px-4 py-2 rounded-xl border border-white/[0.05]">
                      <button onClick={handlePrevMonth} className="p-1 hover:text-indigo-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <span className="text-xs font-bold tracking-widest uppercase text-white">
                        {MONTHS[currentMonth]} {currentYear}
                      </span>
                      <button onClick={handleNextMonth} className="p-1 hover:text-indigo-400 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>

                    {/* Rejilla de días */}
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                        <span key={d} className="text-[10px] font-bold text-slate-500 uppercase py-1">{d}</span>
                      ))}

                      {calendarDays.map((date, idx) => {
                        if (!date) {
                          return <div key={`empty-${idx}`} className="p-2 opacity-0"></div>;
                        }

                        const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                        const hasClasses = hasClassesOnDayOfWeek(date);
                        const dayTasks = getTasksForDate(date);
                        const hasTasks = dayTasks.length > 0;
                        const hasPendingTasks = dayTasks.some(t => !t.completed);

                        return (
                          <button
                            key={date.toDateString()}
                            onClick={() => {
                              setSelectedDate(date);
                              const localDateStr = date.toISOString().split('T')[0];
                              setNewTaskDate(localDateStr);
                            }}
                            className={`p-2.5 rounded-xl flex flex-col items-center justify-between relative transition-all min-h-[50px] ${
                              isSelected 
                                ? 'bg-indigo-600 text-white shadow-lg border border-indigo-400' 
                                : 'bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] text-slate-300'
                            }`}
                          >
                            <span className="text-xs font-semibold">{date.getDate()}</span>
                            
                            <div className="flex gap-1 mt-1 shrink-0">
                              {hasClasses && (
                                <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-400'}`}></span>
                              )}
                              {hasTasks && (
                                <span className={`w-1.5 h-1.5 rounded-full ${hasPendingTasks ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* PANEL LATERAL DETALLES */}
          <div className="space-y-4 rounded-3xl p-6 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] shadow-2xl flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Actividades del Día</span>
              <h4 className="text-sm font-bold text-white mt-0.5">
                {selectedDate ? formatFriendlyDate(selectedDate) : 'Ningún día seleccionado'}
              </h4>
            </div>

            <div className="space-y-3 pt-3 border-t border-white/[0.05] max-h-[220px] overflow-y-auto">
              
              {selectedDate && (
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Clases fijos:</span>
                  {subjects
                    .filter(s => s.schedule && s.schedule.some(sc => sc.day === WEEKDAYS_FULL[selectedDate.getDay()]))
                    .map(cls => {
                      const time = cls.schedule.find(sc => sc.day === WEEKDAYS_FULL[selectedDate.getDay()])?.time;
                      return (
                        <div key={cls.id} className="p-2 mb-1.5 rounded bg-white/[0.02] border border-white/[0.04] flex items-center justify-between text-xs">
                          <div>
                            <p className="font-semibold text-slate-200">{cls.name}</p>
                            <p className="text-[10px] text-slate-400">{time}</p>
                          </div>
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-bold text-indigo-300">
                            {cls.classroom}
                          </span>
                        </div>
                      );
                    })}
                  {subjects.filter(s => s.schedule && s.schedule.some(sc => sc.day === WEEKDAYS_FULL[selectedDate.getDay()])).length === 0 && (
                    <p className="text-[10px] text-slate-500 italic">No hay clases presenciales hoy.</p>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-white/[0.05]">
                <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Tareas y Evaluaciones:</span>
                {getTasksForDate(selectedDate).map(task => {
                  const subj = subjects.find(s => s.id === task.subject_id);
                  return (
                    <div key={task.id} className="flex items-center justify-between p-2 mb-1 rounded bg-white/[0.02] border border-white/[0.04] text-xs group">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => handleToggleTask(task)}
                          className="w-3.5 h-3.5 rounded border-white/20 bg-black/40 text-indigo-600 cursor-pointer"
                        />
                        <span className={`${task.completed ? 'line-through text-slate-500' : 'text-slate-200 font-medium'}`}>
                          [{subj?.name?.substring(0,5)}..] {task.title}
                        </span>
                      </div>
                      <button onClick={() => handleDeleteTask(task.id)} className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  );
                })}
                {getTasksForDate(selectedDate).length === 0 && (
                  <p className="text-[10px] text-slate-500 italic">No hay tareas programadas para esta fecha.</p>
                )}
              </div>
            </div>

            <form onSubmit={handleAddTask} className="space-y-3 bg-white/[0.01] p-4 rounded-xl border border-white/[0.05] mt-auto">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block border-b border-white/[0.05] pb-1">
                Añadir Tarea para este día
              </span>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Nombre de la Tarea / Evaluación</label>
                <input
                  type="text"
                  placeholder="Ej. Examen Escrito (20%)"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Materia</label>
                  <select
                    value={newTaskSubject}
                    onChange={(e) => setNewTaskSubject(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Fecha límite</label>
                  <input
                    type="date"
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Código de Sección</label>
                <input
                  type="password"
                  placeholder="PIN para publicar"
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/40"
                />
              </div>

              {pinError && <p className="text-[11px] text-red-400 font-semibold">{pinError}</p>}

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-4 rounded-lg transition-colors shadow-lg shadow-indigo-600/20"
              >
                Publicar Tarea
              </button>
            </form>
          </div>
        </section>

        {/* NUEVA SECCIÓN: GUÍA ESTUDIANTIL Y ENLACES INSTITUCIONALES */}
        <section id="guia" className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Acordeón de Preguntas Frecuentes */}
          <div className="md:col-span-2 space-y-4 rounded-3xl p-6 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] shadow-2xl">
            <div className="mb-4">
              <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">Ayuda e Información</span>
              <h3 className="text-lg font-bold text-white mt-1">Preguntas Frecuentes UNEG</h3>
              <p className="text-xs text-slate-400">Guía rápida de supervivencia para estudiantes de pregrado</p>
            </div>
            
            <div className="space-y-3">
              {FAQ_ITEMS.map((faq, index) => {
                const isOpen = activeFaq === index;
                return (
                  <div 
                    key={index} 
                    className="rounded-xl border border-white/[0.05] bg-white/[0.01] overflow-hidden transition-all duration-300"
                  >
                    <button
                      onClick={() => setActiveFaq(isOpen ? null : index)}
                      className="w-full flex items-center justify-between p-4 text-left font-semibold text-sm text-slate-200 hover:text-white transition-colors"
                    >
                      <span>{faq.question}</span>
                      <svg
                        className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-400' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    <div
                      className={`transition-all duration-300 overflow-hidden ${
                        isOpen ? 'max-h-56 border-t border-white/[0.05] p-4 bg-black/20' : 'max-h-0'
                      }`}
                    >
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Enlaces Oficiales */}
          <div className="space-y-4 rounded-3xl p-6 bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] shadow-2xl flex flex-col justify-between">
            <div>
              <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">Enlaces de Interés</span>
              <h3 className="text-lg font-bold text-white mt-1">Portales Oficiales</h3>
              <p className="text-xs text-slate-400 mb-4">Acceso rápido a los sistemas de la universidad</p>
            </div>

            <div className="space-y-3 flex-1 flex flex-col justify-center">
              <a
                href="https://virtual.uneg.edu.ve"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] transition-all group"
              >
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-300 group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.168.477-4.5 1.253" /></svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">UNEGVIRTUAL</p>
                  <p className="text-[10px] text-slate-400">Campus Virtual de Pregrado</p>
                </div>
              </a>

              <a
                href="https://virtual.uneg.edu.ve/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] transition-all group"
              >
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-300 group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">SIP (Inscripciones)</p>
                  <p className="text-[10px] text-slate-400">Modificación y carga académica</p>
                </div>
              </a>

              <a
                href="https://virtual.uneg.edu.ve/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] transition-all group"
              >
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-300 group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">SASE</p>
                  <p className="text-[10px] text-slate-400">Becas, Comedor y Apoyo</p>
                </div>
              </a>

              <a
                href="http://www.uneg.edu.ve"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] transition-all group"
              >
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-300 group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">Sitio Web UNEG</p>
                  <p className="text-[10px] text-slate-400">Página oficial de la institución</p>
                </div>
              </a>
            </div>
          </div>
        </section>

      </div>

      {/* MODAL DETALLES DE MATERIA */}
      {activeSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-md p-6 max-h-[90vh] flex flex-col">
            
            <div className="flex justify-between items-start mb-6 shrink-0">
              <div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Información de Materia</span>
                <h3 className="text-xl font-bold text-white mt-1">{activeSubject.name}</h3>
              </div>
              <button
                onClick={() => { setActiveSubject(null); setEditingSubject(null); }}
                className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="overflow-y-auto space-y-6 pr-1 flex-1">
              {editingSubject ? (
                /* MODO EDICIÓN */
                <form onSubmit={handleSaveSubjectDetails} className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Nombre del Profesor</label>
                    <input
                      type="text"
                      value={editingSubject.professor || ''}
                      onChange={(e) => setEditingSubject({...editingSubject, professor: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Contacto (Email / Teléfono)</label>
                    <input
                      type="text"
                      value={editingSubject.contact || ''}
                      onChange={(e) => setEditingSubject({...editingSubject, contact: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Aula de Clases</label>
                    <input
                      type="text"
                      value={editingSubject.classroom || ''}
                      onChange={(e) => setEditingSubject({...editingSubject, classroom: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Carpeta de Google Drive (Enlace)</label>
                    <input
                      type="text"
                      value={editingSubject.drive_link || ''}
                      onChange={(e) => setEditingSubject({...editingSubject, drive_link: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Plan de Evaluación</label>
                    <textarea
                      rows="6"
                      value={editingSubject.evaluation_plan || ''}
                      onChange={(e) => setEditingSubject({...editingSubject, evaluation_plan: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    ></textarea>
                  </div>
                  <div className="pt-2 border-t border-white/5">
                    <label className="text-xs text-slate-400 block mb-1">PIN de Sección para Confirmar</label>
                    <input
                      type="password"
                      placeholder="Introduce el código para editar"
                      value={inputPin}
                      onChange={(e) => setInputPin(e.target.value)}
                      className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
                    />
                    {pinError && <p className="text-xs text-red-400 font-semibold mt-1">{pinError}</p>}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => { setEditingSubject(null); setPinError(''); }}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-xs font-semibold py-2 rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold py-2 rounded-lg transition-colors"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              ) : (
                /* MODO VISTA */
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Profesor(a)</span>
                      <p className="text-sm font-semibold text-white">{activeSubject.professor}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide block">Contacto</span>
                      <p className="text-xs text-slate-300 truncate">{activeSubject.contact || 'No asignado'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide block mb-1">Horario</span>
                      <div className="flex flex-col gap-1">
                        {activeSubject.schedule && activeSubject.schedule.map((sc, i) => (
                          <span key={i} className="text-xs text-indigo-300">
                            {sc.day}: {sc.time}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide block mb-1">Ubicación</span>
                      <span className="text-xs font-semibold text-white px-2 py-1 rounded bg-white/5 border border-white/5">
                        {activeSubject.classroom || 'Por definir'}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wide block mb-2">Plan de Evaluación</span>
                    <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                      {activeSubject.evaluation_plan || 'No registrado todavía.'}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wide block mb-2">Materiales de Estudio</span>
                    {activeSubject.drive_link && activeSubject.drive_link !== '#' ? (
                      <a
                        href={activeSubject.drive_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-200 hover:bg-indigo-600/30 transition-all group"
                      >
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                        </div>
                        <div>
                          <p className="text-xs font-bold">Google Drive Compartido</p>
                          <p className="text-[10px] text-indigo-300">Acceder a carpetas de PDFs, Guías y Diapositivas</p>
                        </div>
                        <svg className="w-4 h-4 ml-auto text-slate-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    ) : (
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center text-xs text-slate-400">
                        Próximamente se agregarán recursos de estudio.
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-white/5">
                    <button
                      onClick={() => { setEditingSubject(activeSubject); setInputPin(''); setPinError(''); }}
                      className="w-full flex items-center justify-center gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs text-indigo-300 font-semibold transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      Editar Información de Materia
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}