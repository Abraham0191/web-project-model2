import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const SECTION_PIN = "1234"; // PIN para añadir tareas o editar materias

export default function App() {
  const [subjects, setSubjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados de control
  const [activeSubject, setActiveSubject] = useState(null);
  const [editingSubject, setEditingSubject] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskSubject, setNewTaskSubject] = useState('');
  const [newTaskDay, setNewTaskDay] = useState('Lunes');
  
  // Seguridad
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState('');

  // 1. Obtener materias desde Supabase al cargar
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

  // 2. Obtener tareas y escuchar cambios en tiempo real
  useEffect(() => {
    async function fetchTasks() {
      const { data, error } = await supabase.from('tareas').select('*');
      if (!error && data) {
        setTasks(data);
      }
      setLoading(false);
    }

    fetchTasks();

    // Sincronización en tiempo real
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tareas' },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 3. Insertar tarea nueva en Supabase
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
        day: newTaskDay,
        completed: false
      }
    ]);

    if (!error) {
      setNewTaskTitle('');
      setInputPin('');
      setPinError('');
    } else {
      setPinError('Error de red al guardar tarea.');
    }
  };

  // 4. Marcar tarea como completada o pendiente
  const handleToggleTask = async (task) => {
    const { error } = await supabase
      .from('tareas')
      .update({ completed: !task.completed })
      .eq('id', task.id);

    if (error) {
      console.error('Error al actualizar tarea:', error.message);
    }
  };

  // 5. Eliminar tarea
  const handleDeleteTask = async (taskId) => {
    const { error } = await supabase
      .from('tareas')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Error al eliminar:', error.message);
    }
  };

  // 6. Editar información de la materia
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-100">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm">Iniciando portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100 font-sans relative overflow-x-hidden p-4 md:p-8 pb-24">
      
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-pink-500/10 blur-3xl pointer-events-none"></div>

      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-xl">
          <div>
            <span className="text-xs uppercase tracking-widest text-indigo-400 font-bold">Portal Académico</span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Ingeniería de Software
            </h1>
          </div>
          
          <nav className="flex items-center gap-2 bg-black/20 p-1.5 rounded-full border border-white/5">
            <a href="#materias" className="px-4 py-2 text-sm font-medium rounded-full hover:bg-white/10 transition-colors">
              Materias
            </a>
            <a href="#horario" className="px-4 py-2 text-sm font-medium rounded-full hover:bg-white/10 transition-colors">
              Horario y To-Do
            </a>
          </nav>
        </header>

        {/* MATERIAS */}
        <section id="materias" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white/90">Materias del Semestre</h2>
            <span className="text-xs text-slate-400">Selecciona una para ver plan de evaluación y recursos</span>
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
                className={`group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br ${subj.color} backdrop-blur-md border border-white/10 shadow-lg hover:shadow-2xl hover:border-white/20 hover:-translate-y-1 transition-all duration-300 cursor-pointer`}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="p-2 rounded-lg bg-white/5 text-xs font-semibold text-indigo-300 border border-white/5">
                    {subj.classroom || 'Aula por definir'}
                  </span>
                  <svg className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-1 group-hover:text-indigo-200 transition-colors">{subj.name}</h3>
                <p className="text-sm text-slate-400 truncate">{subj.professor}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HORARIO Y TO-DO */}
        <section id="horario" className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-6">
          
          {/* HORARIO SEMANAL */}
          <div className="lg:col-span-2 space-y-4 rounded-3xl p-6 bg-white/5 backdrop-blur-lg border border-white/10 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2">Horario Semanal</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {DAYS_OF_WEEK.map((day) => {
                const dayClasses = subjects.filter(s => s.schedule && s.schedule.some(sc => sc.day === day));
                const dayTasks = tasks.filter(t => t.day === day && !t.completed);

                return (
                  <div key={day} className="rounded-xl p-4 bg-white/5 border border-white/5 flex flex-col min-h-[220px]">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3 border-b border-white/5 pb-1 block">
                      {day}
                    </span>
                    
                    <div className="space-y-2 mb-4">
                      {dayClasses.map(cls => {
                        const time = cls.schedule.find(sc => sc.day === day)?.time;
                        return (
                          <div key={cls.id} className="p-2 rounded bg-indigo-500/10 border border-indigo-500/20 text-xs">
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

                    <div className="mt-auto pt-2 border-t border-white/5 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 block">Tareas del día:</span>
                      {dayTasks.map(task => {
                        const subj = subjects.find(s => s.id === task.subject_id);
                        return (
                          <div key={task.id} className="p-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200">
                            <span className="font-bold">[{subj?.name?.substring(0,6)}..]</span> {task.title}
                          </div>
                        );
                      })}
                      {dayTasks.length === 0 && (
                        <div className="text-[10px] text-emerald-400/70">✓ Al día</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TO-DO LIST */}
          <div className="space-y-4 rounded-3xl p-6 bg-white/5 backdrop-blur-lg border border-white/10 shadow-xl">
            <h3 className="text-lg font-bold text-white">To-Do List de la Sección</h3>
            
            <form onSubmit={handleAddTask} className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/5">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Nueva Tarea</label>
                <input
                  type="text"
                  placeholder="Ej. Entregar Guía"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Materia</label>
                  <select
                    value={newTaskSubject}
                    onChange={(e) => setNewTaskSubject(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Día Entrega</label>
                  <select
                    value={newTaskDay}
                    onChange={(e) => setNewTaskDay(e.target.value)}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none"
                  >
                    {DAYS_OF_WEEK.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Código de Sección</label>
                <input
                  type="password"
                  placeholder="PIN para publicar"
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value)}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {pinError && <p className="text-xs text-red-400 font-semibold">{pinError}</p>}

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2 px-4 rounded-lg transition-colors"
              >
                Agregar Tarea
              </button>
            </form>

            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {tasks.map(task => {
                const subj = subjects.find(s => s.id === task.subject_id);
                return (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 group hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleToggleTask(task)}
                        className="w-4 h-4 rounded border-white/20 bg-black/40 text-indigo-600 cursor-pointer"
                      />
                      <div className="text-sm">
                        <p className={`font-medium ${task.completed ? 'line-through text-slate-500' : 'text-white'}`}>
                          {task.title}
                        </p>
                        <span className="text-[10px] text-slate-400">
                          {subj?.name} • {task.day}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="text-slate-500 hover:text-red-400 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
              {tasks.length === 0 && (
                <p className="text-center text-xs text-slate-500 py-4">No hay tareas creadas.</p>
              )}
            </div>
          </div>
        </section>

      </div>

      {/* MODAL DETALLES */}
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
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
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
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs font-bold">Google Drive Compartido</p>
                          <p className="text-[10px] text-indigo-300">Acceder a carpetas de PDFs, Guías y Diapositivas</p>
                        </div>
                        <svg className="w-4 h-4 ml-auto text-slate-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
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
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
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