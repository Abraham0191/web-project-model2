import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient'; // Conexión segura

// --- CONSTANTES GLOBALES DE DISEÑO ---
const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAYS_FULL = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const WEEKDAYS_SEM = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const MONTHS_LOWER = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
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

// --- COMPONENTE 1: WIDGET DE CALENDARIO (ESTILO IOS UNIFICADO) ---
function CalendarWidget({ 
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
    <div className="bg-[#1c1c1e] rounded-[2.2rem] border border-white/[0.05] shadow-2xl p-6 select-none overflow-hidden text-slate-100 flex flex-col md:flex-row gap-8 min-h-[340px]">
      
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
                  className="p-1.5 rounded-full hover:bg-white/5 transition-colors text-[#8e8e93] hover:text-white"
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
                  className="p-1.5 rounded-full hover:bg-white/5 transition-colors text-[#8e8e93] hover:text-white"
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
                  {WEEKDAYS_SEM.map((day) => {
                    const { dayClasses, dayTasks } = getWeeklyData(day);
                    return (
                      <div key={day} className="rounded-2xl p-3 bg-[#0c0c0d]/40 border border-white/[0.04] flex flex-col min-h-[160px]">
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
                      className={`text-[11px] font-extrabold uppercase py-1 ${idx === 6 ? 'text-red-500' : 'text-[#8e8e93]'}`}
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
                            ? 'bg-white text-[#0c0c0d] font-black shadow-md' 
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
            <h4 className="text-xl font-bold text-[#8e8e93] tracking-tight">
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
                <div key={cls.id} className="p-2.5 rounded-xl bg-[#0c0c0d]/40 border border-white/[0.04] text-xs flex justify-between items-center">
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
                <div key={task.id} className="flex items-center justify-between p-2.5 rounded-xl bg-[#0c0c0d]/40 border border-white/[0.04] text-xs group">
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

// --- COMPONENTE 2: ORQUESTRADOR PRINCIPAL (DEFAULT EXPORT) ---
export default function App() {
  if (!supabase) {
    return (
      <div className="min-h-screen bg-[#0c0c0d] flex items-center justify-center text-slate-100 p-6 text-center">
        <div className="max-w-md p-8 bg-[#1c1c1e] border border-white/[0.05] rounded-[2.2rem] space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-red-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-red-400">Error de Configuración</h2>
          <p className="text-sm text-[#8e8e93]">
            No se han detectado tus credenciales en el archivo <code className="bg-black/40 px-1.5 py-0.5 rounded text-indigo-300">.env.local</code>.
          </p>
          <div className="bg-[#0c0c0d] text-left p-4 rounded-xl text-xs space-y-2 text-slate-400 border border-white/[0.03]">
            <p>1. Para solucionar esto de manera permanente, verifica que tu archivo <code className="text-white">.env.local</code> esté en la raíz del proyecto.</p>
            <p>2. Detén tu servidor local en la terminal presionando <code className="text-white">Ctrl + C</code>.</p>
            <p>3. Reinícialo ejecutando <code className="text-white">npm run dev</code> para forzar la lectura de las claves.</p>
          </div>
        </div>
      </div>
    );
  }

  const [subjects, setSubjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [viewMode, setViewMode] = useState('mensual'); 
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 5, 10)); // 10 de Junio de 2026

  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSubject, setNewTaskSubject] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('2026-06-10');
  
  const [activeSubject, setActiveSubject] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [activeFaq, setActiveFaq] = useState(null);
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState('');

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

  const formatFriendlyDate = (date) => {
    const dayName = WEEKDAYS_FULL[date.getDay()];
    const dayNum = date.getDate();
    return `${dayName}, ${dayNum}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0c0d] flex items-center justify-center text-slate-100">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto"></div>
          <p className="text-xs uppercase tracking-widest text-[#8e8e93] font-semibold">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0c0d] text-[#f2f2f7] font-sans p-6 md:p-12 pb-24 relative overflow-x-hidden selection:bg-white/20">
      
      {/* Mesh Glow ambiental muy sutil en las esquinas */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-indigo-500/[0.02] blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-purple-500/[0.02] blur-[120px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* ENCABEZADO CENTRADO DE LA 2DA FOTO */}
        <header className="text-center space-y-4 py-8">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white select-none">
            Ingeniería en Materiales
          </h1>
          <p className="text-sm md:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed select-none font-medium">
            Web dedicada a la carrera de Ingeniería en Materiales, con recursos, documentación y herramientas para estudiantes.
          </p>
        </header>

        {/* BOTONES NAVEGACIÓN "PILL" CENTRADOS DE LA 2DA FOTO */}
        <div className="flex items-center justify-center gap-2.5 select-none px-2">
          <a href="#materias" className="px-5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs font-bold tracking-wide transition-all duration-300 text-[#f2f2f7] hover:text-white">
            Materias
          </a>
          <a href="#cronograma" className="px-5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs font-bold tracking-wide transition-all duration-300 text-[#f2f2f7] hover:text-white">
            Cronograma
          </a>
          <a href="#guia" className="px-5 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-xs font-bold tracking-wide transition-all duration-300 text-[#f2f2f7] hover:text-white">
            Guía UNEG
          </a>
        </div>

        {/* MATERIAS EN CUADRÍCULA ESTILO RECTÁNGULO */}
        <section id="materias" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {subjects.map((subj) => (
              <div
                key={subj.id}
                onClick={() => {
                  setActiveSubject(subj);
                  setEditingSubject(null);
                  setPinError('');
                }}
                className="flex items-center justify-center text-center p-8 bg-[#1c1c1e] border border-white/[0.06] hover:bg-[#252528] hover:border-white/[0.12] rounded-[2.2rem] shadow-lg hover:shadow-2xl hover:-translate-y-0.5 aspect-[1.6/1] transition-all duration-300 cursor-pointer select-none"
              >
                <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
                  {subj.name}
                </h3>
              </div>
            ))}
          </div>
        </section>

        {/* SECCIÓN CRONOGRAMA INTERACTIVO */}
        <section id="cronograma" className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6">
          
          {/* PANEL PRINCIPAL: CALENDARIO WIDGET MODULAR INTEGRADO */}
          <div className="lg:col-span-2">
            <CalendarWidget
              subjects={subjects}
              tasks={tasks}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              handleToggleTask={handleToggleTask}
              handleDeleteTask={handleDeleteTask}
              viewMode={viewMode}
              setViewMode={setViewMode}
            />
          </div>

          {/* PANEL LATERAL: CREADOR DE TAREAS */}
          <div className="space-y-4 rounded-[2.2rem] p-6 bg-[#1c1c1e] border border-white/[0.08] shadow-2xl flex flex-col justify-between">
            <form onSubmit={handleAddTask} className="space-y-3 bg-[#0c0c0d]/40 p-4 rounded-2xl border border-white/[0.04] mt-auto">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block border-b border-white/[0.05] pb-1">
                Añadir Tarea para este día ({selectedDate ? formatFriendlyDate(selectedDate) : ''})
              </span>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Nombre de la Tarea / Evaluación</label>
                <input
                  type="text"
                  placeholder="Ej. Examen Escrito (20%)"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-[#0c0c0d] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Materia</label>
                  <select
                    value={newTaskSubject}
                    onChange={(e) => setNewTaskSubject(e.target.value)}
                    className="w-full bg-[#0c0c0d] border border-white/[0.08] rounded-xl px-2 py-1.5 text-[11px] text-white focus:outline-none"
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
                    className="w-full bg-[#0c0c0d] border border-white/[0.08] rounded-xl px-2 py-1.5 text-[11px] text-white focus:outline-none"
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
                  className="w-full bg-[#0c0c0d] border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/40"
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

        {/* GUÍA ESTUDIANTIL Y ENLACES INSTITUCIONALES */}
        <section id="guia" className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Acordeón de Preguntas Frecuentes */}
          <div className="md:col-span-2 space-y-4 rounded-[2.2rem] p-6 bg-[#1c1c1e] border border-white/[0.08] shadow-2xl">
            <div className="mb-4">
              <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">Ayuda e Información</span>
              <h3 className="text-lg font-bold text-white mt-1">Preguntas Frecuentes UNEG</h3>
              <p className="text-xs text-[#8e8e93]">Guía rápida de supervivencia para estudiantes de pregrado</p>
            </div>
            
            <div className="space-y-3">
              {FAQ_ITEMS.map((faq, index) => {
                const isOpen = activeFaq === index;
                return (
                  <div 
                    key={index} 
                    className="rounded-xl border border-white/[0.05] bg-black/[0.15] overflow-hidden transition-all duration-300"
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
                        isOpen ? 'max-h-56 border-t border-white/[0.05] p-4 bg-[#0c0c0d]/40' : 'max-h-0'
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
          <div className="space-y-4 rounded-[2.2rem] p-6 bg-[#1c1c1e] border border-white/[0.08] shadow-2xl flex flex-col justify-between">
            <div>
              <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">Enlaces de Interés</span>
              <h3 className="text-lg font-bold text-white mt-1">Portales Oficiales</h3>
              <p className="text-xs text-[#8e8e93] mb-4">Acceso rápido a los sistemas de la universidad</p>
            </div>

            <div className="space-y-3 flex-1 flex flex-col justify-center">
              <a
                href="https://virtual.uneg.edu.ve"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-2xl bg-[#0c0c0d]/40 border border-white/[0.04] hover:bg-white/[0.04] transition-all group"
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
                className="flex items-center gap-3 p-3 rounded-2xl bg-[#0c0c0d]/40 border border-white/[0.04] hover:bg-white/[0.04] transition-all group"
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
                className="flex items-center gap-3 p-3 rounded-2xl bg-[#0c0c0d]/40 border border-white/[0.04] hover:bg-white/[0.04] transition-all group"
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
                className="flex items-center gap-3 p-3 rounded-2xl bg-[#0c0c0d]/40 border border-white/[0.04] hover:bg-white/[0.04] transition-all group"
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

      {/* MODAL DETALLES */}
      {activeSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-hidden rounded-[2.2rem] bg-slate-900/90 border border-white/10 shadow-2xl backdrop-blur-md p-6 max-h-[90vh] flex flex-col">
            
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
                      className="w-full bg-[#0c0c0d] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Contacto (Email / Teléfono)</label>
                    <input
                      type="text"
                      value={editingSubject.contact || ''}
                      onChange={(e) => setEditingSubject({...editingSubject, contact: e.target.value})}
                      className="w-full bg-[#0c0c0d] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Aula de Clases</label>
                    <input
                      type="text"
                      value={editingSubject.classroom || ''}
                      onChange={(e) => setEditingSubject({...editingSubject, classroom: e.target.value})}
                      className="w-full bg-[#0c0c0d] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Carpeta de Google Drive (Enlace)</label>
                    <input
                      type="text"
                      value={editingSubject.drive_link || ''}
                      onChange={(e) => setEditingSubject({...editingSubject, drive_link: e.target.value})}
                      className="w-full bg-[#0c0c0d] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">Plan de Evaluación</label>
                    <textarea
                      rows="6"
                      value={editingSubject.evaluation_plan || ''}
                      onChange={(e) => setEditingSubject({...editingSubject, evaluation_plan: e.target.value})}
                      className="w-full bg-[#0c0c0d] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                    ></textarea>
                  </div>
                  <div className="pt-2 border-t border-white/5">
                    <label className="text-xs text-slate-400 block mb-1">PIN de Sección para Confirmar</label>
                    <input
                      type="password"
                      placeholder="Introduce el código para editar"
                      value={inputPin}
                      onChange={(e) => setInputPin(e.target.value)}
                      className="w-full bg-[#0c0c0d] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/40"
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
                        <div className="p-2 rounded-lg bg-[#0c0c0d]/40 text-indigo-300 group-hover:scale-105 transition-transform">
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