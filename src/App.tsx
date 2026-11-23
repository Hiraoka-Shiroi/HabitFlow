import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
  Activity, ArrowUpRight, BarChart3, CalendarDays, Check, CheckCircle2,
  ChevronLeft, ChevronRight, Cloud, Flame, LayoutDashboard,
  ListTodo, LogOut, Plus, Search, Settings2, ShieldCheck, Sparkles,
  Target, Trash2, Trophy, X, Clock3, SlidersHorizontal, Pencil, Wallet,
  TrendingUp, TrendingDown, Receipt, ArrowDownLeft
} from 'lucide-react';

type Habit = { id: string; name: string; color: string; frequency: 'daily' | 'weekly' };
type Log = { habit_id: string; log_date: string };
type Task = {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  due_time?: string | null;
  category: string;
  priority: 'normal' | 'important';
  completed: boolean;
  created_at?: string;
};
type TaskFilter = 'Все' | 'Предстоящие' | 'Просроченные' | 'Без даты' | 'Выполненные';
type Transaction = { id: string; title: string; amount: number; kind: 'income' | 'expense'; category: string; transaction_date: string; note?: string; created_at?: string };
const taskCategories = ['Личное', 'Работа', 'Покупки', 'Здоровье', 'Обучение', 'Встреча', 'Другое'];
const expenseCategories = ['Еда', 'Транспорт', 'Покупки', 'Жильё', 'Здоровье', 'Развлечения', 'Подписки', 'Другое'];
const incomeCategories = ['Зарплата', 'Фриланс', 'Бизнес', 'Подарок', 'Возврат', 'Другое'];

const colors = ['#8980b8', '#bd829a', '#729b8c', '#bd9b68', '#7893b4', '#a58bb7'];
const today = new Date();
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const localDay = dateKey(today);
const initialHabits: Habit[] = [];
const envReady = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
const allowSignup = import.meta.env.VITE_ALLOW_SIGNUP !== 'false';
const supabase: SupabaseClient | null = envReady
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  : null;

function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch { return fallback; }
}
function formatDate(value: string | null) {
  if (!value) return 'Без даты';
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
function isTaskOverdue(task: Task) { const now = new Date().toTimeString().slice(0, 5); return !!task.due_date && (task.due_date < localDay || (task.due_date === localDay && !!task.due_time && task.due_time < now)); }
function formatMoney(value: number) { return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'KZT', maximumFractionDigits: 0 }).format(value); }

export default function App() {
  const [habits, setHabits] = useState<Habit[]>(() => readLocal('hf_habits', initialHabits));
  const [logs, setLogs] = useState<Log[]>(() => readLocal('hf_logs', []));
  const [tasks, setTasks] = useState<Task[]>(() => readLocal<Task[]>('hf_tasks', []).map(t => ({ ...t, category: t.category === 'Курс' || t.category === 'Учёба' ? 'Обучение' : t.category === 'Семинар' ? 'Встреча' : t.category })));
  const [transactions, setTransactions] = useState<Transaction[]>(() => readLocal('hf_transactions', []));
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [tab, setTab] = useState('Обзор');
  const [user, setUser] = useState<any>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authMsg, setAuthMsg] = useState('');
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [transactionTitle, setTransactionTitle] = useState('');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionKind, setTransactionKind] = useState<'income' | 'expense'>('expense');
  const [transactionCategory, setTransactionCategory] = useState('Еда');
  const [transactionDate, setTransactionDate] = useState(localDay);
  const [transactionNote, setTransactionNote] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(colors[0]);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDate, setTaskDate] = useState('');
  const [taskTime, setTaskTime] = useState('');
  const [taskCategory, setTaskCategory] = useState('Личное');
  const [taskPriority, setTaskPriority] = useState<'normal' | 'important'>('normal');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('Все');
  const [taskSearch, setTaskSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(() => readLocal('hf_dark', false));
  const [notice, setNotice] = useState('');

  const completedToday = habits.filter(h => logs.some(l => l.habit_id === h.id && l.log_date === localDay)).length;
  const percent = habits.length ? Math.round(completedToday / habits.length * 100) : 0;
  const activeTasks = tasks.filter(t => !t.completed).length;
  const overdueTasks = tasks.filter(t => !t.completed && isTaskOverdue(t)).length;
  const currentStreak = useMemo(() => {
    let n = 0;
    const d = new Date(today);
    while (true) {
      const k = dateKey(d);
      if (habits.length && habits.every(h => logs.some(l => l.habit_id === h.id && l.log_date === k))) {
        n++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    return n;
  }, [habits, logs]);

  useEffect(() => {
    localStorage.setItem('hf_habits', JSON.stringify(habits));
    localStorage.setItem('hf_logs', JSON.stringify(logs));
    localStorage.setItem('hf_tasks', JSON.stringify(tasks));
    localStorage.setItem('hf_transactions', JSON.stringify(transactions));
    localStorage.setItem('hf_dark', JSON.stringify(dark));
  }, [habits, logs, tasks, transactions, dark]);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setAuthReady(true);
      if (error) setAuthMsg(error.message);
    }).catch(error => {
      if (!mounted) return;
      setAuthReady(true);
      setAuthMsg(error instanceof Error ? error.message : 'Не удалось проверить сессию. Попробуй обновить страницу.');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [h, l, t, tx] = await Promise.all([
        supabase!.from('habits').select('*').order('created_at'),
        supabase!.from('habit_logs').select('habit_id,log_date'),
        supabase!.from('planner_tasks').select('*').order('due_date', { ascending: true, nullsFirst: false }),
        supabase!.from('planner_transactions').select('*').order('transaction_date', { ascending: false })
      ]);
      if (active) {
        if (!h.error) setHabits(h.data as Habit[]);
        if (!l.error) setLogs(l.data as Log[]);
        if (!t.error) setTasks((t.data as Task[]).map(task => ({ ...task, category: task.category === 'Курс' || task.category === 'Учёба' ? 'Обучение' : task.category === 'Семинар' ? 'Встреча' : task.category }))); 
        else if (t.error.code !== '42P01') setNotice(`Не удалось загрузить дела: ${t.error.message}`);
        if (!tx.error) setTransactions(tx.data as Transaction[]);
        else if (tx.error.code !== '42P01') setNotice(`Не удалось загрузить финансы: ${tx.error.message}`);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user]);

  const persistLog = async (habit: Habit, day: string, exists: boolean) => {
    if (!supabase || !user) return;
    if (exists) await supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('log_date', day);
    else await supabase.from('habit_logs').insert({ user_id: user.id, habit_id: habit.id, log_date: day });
  };
  const toggleHabit = (habit: Habit, day: string) => {
    const exists = logs.some(l => l.habit_id === habit.id && l.log_date === day);
    setLogs(p => exists
      ? p.filter(l => !(l.habit_id === habit.id && l.log_date === day))
      : [...p, { habit_id: habit.id, log_date: day }]);
    void persistLog(habit, day, exists);
  };
  const addHabit = async () => {
    if (!newName.trim()) return;
    const item: Habit = { id: crypto.randomUUID(), name: newName.trim(), color: newColor, frequency: 'daily' };
    if (supabase && user) {
      const { data, error } = await supabase.from('habits').insert({ user_id: user.id, name: item.name, color: item.color, frequency: item.frequency }).select().single();
      if (error) { setNotice(error.message); return; }
      setHabits(p => [...p, data as Habit]);
    } else setHabits(p => [...p, item]);
    setNewName('');
    setShowAddHabit(false);
  };
  const removeHabit = async (id: string) => {
    setHabits(p => p.filter(h => h.id !== id));
    setLogs(p => p.filter(l => l.habit_id !== id));
    if (supabase && user) await supabase.from('habits').delete().eq('id', id);
  };

  const resetTaskForm = () => {
    setTaskTitle(''); setTaskDescription(''); setTaskDate(''); setTaskTime(''); setTaskCategory('Личное');
    setTaskPriority('normal'); setEditingTaskId(null);
  };
  const openNewTask = () => { resetTaskForm(); setShowAddTask(true); };
  const openEditTask = (task: Task) => {
    setEditingTaskId(task.id); setTaskTitle(task.title); setTaskDescription(task.description || '');
    setTaskDate(task.due_date || ''); setTaskTime(task.due_time || ''); setTaskCategory(task.category); setTaskPriority(task.priority);
    setShowAddTask(true);
  };
  const addTask = async () => {
    if (!taskTitle.trim()) return;
    const fields = {
      title: taskTitle.trim(), description: taskDescription.trim(), due_date: taskDate || null, due_time: taskTime || null,
      category: taskCategory, priority: taskPriority
    };
    if (editingTaskId) {
      if (supabase && user) {
        const { data, error } = await supabase.from('planner_tasks').update(fields).eq('id', editingTaskId).select().single();
        if (error) { setNotice(`Не удалось изменить дело: ${error.message}`); return; }
        setTasks(p => p.map(t => t.id === editingTaskId ? data as Task : t));
      } else setTasks(p => p.map(t => t.id === editingTaskId ? { ...t, ...fields } : t));
    } else {
      const item: Task = { id: crypto.randomUUID(), ...fields, completed: false };
      if (supabase && user) {
        const { data, error } = await supabase.from('planner_tasks').insert({ ...fields, user_id: user.id, completed: false }).select().single();
        if (error) { setNotice(`Не удалось сохранить дело: ${error.message}. Проверь таблицу planner_tasks в Supabase.`); return; }
        setTasks(p => [...p, data as Task]);
      } else setTasks(p => [...p, item]);
    }
    resetTaskForm(); setShowAddTask(false);
  };
  const toggleTask = async (task: Task) => {
    const completed = !task.completed;
    setTasks(p => p.map(t => t.id === task.id ? { ...t, completed } : t));
    if (supabase && user) {
      const { error } = await supabase.from('planner_tasks').update({ completed }).eq('id', task.id);
      if (error) setNotice(`Не удалось обновить дело: ${error.message}`);
    }
  };
  const deleteTask = async (id: string) => {
    setTasks(p => p.filter(t => t.id !== id));
    if (supabase && user) {
      const { error } = await supabase.from('planner_tasks').delete().eq('id', id);
      if (error) setNotice(`Не удалось удалить дело: ${error.message}`);
    }
  };
  const auth = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!supabase) {
      setAuthMsg('Сначала подключи Supabase: добавь URL и публичный ключ в файл .env, затем перезапусти приложение.');
      return;
    }
    if (authMode === 'signup' && !allowSignup) {
      setAuthMsg('Создание новых аккаунтов отключено владельцем HabitFlow.');
      return;
    }
    if (!email.trim() || !password) {
      setAuthMsg('Введи почту и пароль.');
      return;
    }
    setLoading(true);
    setAuthMsg('');
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) setAuthMsg(error.message);
        else if (!data.session) setAuthMsg('Аккаунт создан. Проверь почту и подтверди адрес, затем войди в HabitFlow.');
        else setAuthMsg('Аккаунт создан. Открываем твоё пространство…');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setAuthMsg(error.message);
        else setAuthMsg('Вход выполнен. Открываем HabitFlow…');
      }
    } catch (error) {
      setAuthMsg(error instanceof Error ? error.message : 'Не удалось выполнить запрос. Проверь соединение и попробуй ещё раз.');
    } finally {
      setLoading(false);
    }
  };

  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthName = month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const monthLogs = logs.filter(l => l.log_date.startsWith(monthKey));
  const monthTasks = tasks.filter(t => t.due_date?.startsWith(monthKey));
  const monthTotal = habits.length * days;
  const monthDone = monthLogs.length;
  const monthPct = monthTotal ? Math.round(monthDone / monthTotal * 100) : 0;
  const monthTransactions = transactions.filter(t => t.transaction_date.startsWith(monthKey));
  const monthIncome = monthTransactions.filter(t => t.kind === 'income').reduce((sum, t) => sum + Number(t.amount), 0);
  const monthExpenses = monthTransactions.filter(t => t.kind === 'expense').reduce((sum, t) => sum + Number(t.amount), 0);
  const monthBalance = monthIncome - monthExpenses;
  const totalBalance = transactions.reduce((sum, t) => sum + (t.kind === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
  const expenseSummary = Object.entries(monthTransactions.filter(t => t.kind === 'expense').reduce<Record<string, number>>((acc, t) => { acc[t.category] = (acc[t.category] || 0) + Number(t.amount); return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxExpense = Math.max(1, ...expenseSummary.map(([, amount]) => amount));
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - 6 + i); const k = dateKey(d);
    return { day: d.toLocaleDateString('ru-RU', { weekday: 'short' }), value: habits.filter(h => logs.some(l => l.habit_id === h.id && l.log_date === k)).length };
  });
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearLength = (new Date(today.getFullYear() + 1, 0, 1).getTime() - yearStart.getTime()) / 86400000;
  const yearLogs = logs.filter(l => l.log_date.startsWith(String(today.getFullYear())));
  const yearActivity = Array.from({ length: yearLength }, (_, i) => {
    const d = new Date(today.getFullYear(), 0, i + 1); const k = dateKey(d);
    return { k, n: yearLogs.filter(l => l.log_date === k).length };
  });
  const yearActivityMap = new Map(yearActivity.map(day => [day.k, day.n]));
  // Dense contribution-style calendar: 53 week columns × 7 weekday rows.
  // The grid starts on Monday and fills the full available width.
  const yearGridStart = new Date(yearStart);
  yearGridStart.setDate(yearGridStart.getDate() - ((yearGridStart.getDay() + 6) % 7));
  const yearEnd = new Date(today.getFullYear(), 11, 31);
  const yearGridEnd = new Date(yearEnd);
  yearGridEnd.setDate(yearGridEnd.getDate() + (6 - ((yearGridEnd.getDay() + 6) % 7)));
  const utcDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const yearWeeks = Math.ceil((utcDay(yearGridEnd) - utcDay(yearGridStart) + 86400000) / (7 * 86400000));
  const yearGridCells = Array.from({ length: yearWeeks * 7 }, (_, index) => {
    const d = new Date(yearGridStart);
    d.setDate(d.getDate() + index);
    const key = dateKey(d);
    const inYear = d.getFullYear() === today.getFullYear();
    const count = inYear ? (yearActivityMap.get(key) || 0) : 0;
    const ratio = habits.length ? count / habits.length : 0;
    const level = count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil(ratio * 4)));
    return { key, count, inYear, future: key > localDay, level };
  });
  const yearMonthLabels = Array.from({ length: 12 }, (_, monthIndex) => {
    const firstDay = new Date(today.getFullYear(), monthIndex, 1);
    const week = Math.floor((utcDay(firstDay) - utcDay(yearGridStart)) / (7 * 86400000));
    return { monthIndex, week: week + 1, title: firstDay.toLocaleDateString('ru-RU', { month: 'short' }) };
  });
  const activeDaysYear = yearActivity.filter(day => day.n > 0).length;
  const completedYear = yearLogs.length;
  const upcomingTasks = [...tasks].filter(t => !t.completed).sort((a, b) => {
    if (!a.due_date) return 1; if (!b.due_date) return -1; return a.due_date.localeCompare(b.due_date) || (a.due_time || '').localeCompare(b.due_time || '');
  }).slice(0, 4);
  const filteredTasks = tasks.filter(t => {
    const matchFilter = taskFilter === 'Все' || (taskFilter === 'Предстоящие' && !t.completed && !!t.due_date && !isTaskOverdue(t)) || (taskFilter === 'Просроченные' && !t.completed && isTaskOverdue(t)) || (taskFilter === 'Без даты' && !t.due_date && !t.completed) || (taskFilter === 'Выполненные' && t.completed);
    const q = taskSearch.trim().toLowerCase();
    const matchSearch = !q || `${t.title} ${t.description} ${t.category}`.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  }).sort((a, b) => {
    if (!a.due_date) return 1; if (!b.due_date) return -1; return a.due_date.localeCompare(b.due_date) || (a.due_time || '').localeCompare(b.due_time || '');
  });
  const resetTransactionForm = () => { setTransactionTitle(''); setTransactionAmount(''); setTransactionKind('expense'); setTransactionCategory('Еда'); setTransactionDate(localDay); setTransactionNote(''); setEditingTransactionId(null); };
  const openNewTransaction = () => { resetTransactionForm(); setShowTransactionModal(true); };
  const openEditTransaction = (transaction: Transaction) => { setEditingTransactionId(transaction.id); setTransactionTitle(transaction.title); setTransactionAmount(String(transaction.amount)); setTransactionKind(transaction.kind); setTransactionCategory(transaction.category); setTransactionDate(transaction.transaction_date); setTransactionNote(transaction.note || ''); setShowTransactionModal(true); };
  const saveTransaction = async () => {
    const amount = Number(transactionAmount.replace(',', '.'));
    if (!transactionTitle.trim() || !Number.isFinite(amount) || amount <= 0 || !transactionDate) return;
    const fields = { title: transactionTitle.trim(), amount, kind: transactionKind, category: transactionCategory, transaction_date: transactionDate, note: transactionNote.trim() };
    if (editingTransactionId) {
      if (supabase && user) { const { data, error } = await supabase.from('planner_transactions').update(fields).eq('id', editingTransactionId).select().single(); if (error) { setNotice(`Не удалось изменить запись: ${error.message}`); return; } setTransactions(items => items.map(item => item.id === editingTransactionId ? data as Transaction : item)); }
      else setTransactions(items => items.map(item => item.id === editingTransactionId ? { ...item, ...fields } : item));
    } else {
      const item: Transaction = { id: crypto.randomUUID(), ...fields };
      if (supabase && user) { const { data, error } = await supabase.from('planner_transactions').insert({ ...fields, user_id: user.id }).select().single(); if (error) { setNotice(`Не удалось сохранить запись: ${error.message}. Проверь таблицу planner_transactions в Supabase.`); return; } setTransactions(items => [data as Transaction, ...items]); }
      else setTransactions(items => [item, ...items]);
    }
    resetTransactionForm(); setShowTransactionModal(false);
  };
  const deleteTransaction = async (id: string) => { setTransactions(items => items.filter(item => item.id !== id)); if (supabase && user) { const { error } = await supabase.from('planner_transactions').delete().eq('id', id); if (error) setNotice(`Не удалось удалить запись: ${error.message}`); } };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ habits, logs, tasks, transactions }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'habitflow-backup.json'; a.click(); URL.revokeObjectURL(a.href);
  };

  if (!authReady || !user) {
    return <div className={`authShell ${dark ? 'dark' : ''}`}>
      <div className="authGlow authGlowOne" />
      <div className="authGlow authGlowTwo" />
      <div className="authFrame">
        <section className="authStory">
          <div className="authBrand"><span><Activity size={19} /></span><b>habitflow</b><i>✦</i></div>
          <div className="authStoryBody">
            <span className="authEyebrow"><Sparkles size={13} /> ТВОЁ ЛИЧНОЕ ПРОСТРАНСТВО</span>
            <h1>Меньше хаоса.<br /><em>Больше твоего.</em></h1>
            <p>Привычки, планы и финансы в одном спокойном пространстве. Веди свой ритм и замечай, как складывается прогресс.</p>
            <div className="authFeatureList">
              <div><span><Target size={16} /></span><section><b>Привычки и цели</b><small>Отмечай каждый маленький шаг</small></section></div>
              <div><span><CalendarDays size={16} /></span><section><b>Дела и дедлайны</b><small>Держи важное под рукой</small></section></div>
              <div><span><Wallet size={16} /></span><section><b>Личные финансы</b><small>Понимай, куда уходят деньги</small></section></div>
            </div>
          </div>
          <div className="authStoryFoot"><ShieldCheck size={14} /> Личные данные доступны только твоему аккаунту</div>
          <div className="authDecorRing authDecorRingA" /><div className="authDecorRing authDecorRingB" />
        </section>
        <section className="authFormSide">
          <div className="authTopLine"><span>HABITFLOW · PERSONAL</span><button type="button" className="authThemeToggle" onClick={() => setDark(!dark)} aria-label="Сменить тему">{dark ? '☀' : '☾'}</button></div>
          <div className="authFormCard">
            {!authReady ? <div className="authChecking"><span className="authSpinner" /><b>Проверяем вход…</b><small>Подготавливаем твоё пространство</small></div> : !supabase ? <>
              <span className="authFormEyebrow">ПОСЛЕДНИЙ ШАГ</span>
              <h2>Подключи своё пространство</h2>
              <p className="authLead">Чтобы создать аккаунт и входить с телефона, компьютера и ноутбука, сначала подключи облачную базу Supabase.</p>
              <div className="authSetupSteps">
                <div><b>01</b><span>Создай проект в Supabase</span></div>
                <div><b>02</b><span>Выполни файл <code>supabase.sql</code> в SQL Editor</span></div>
                <div><b>03</b><span>Заполни <code>.env</code> по образцу <code>.env.example</code></span></div>
              </div>
              <div className="authSetupCode"><span>VITE_SUPABASE_URL=...</span><span>VITE_SUPABASE_ANON_KEY=...</span></div>
              <p className="authSetupHint">После этого перезапусти проект — здесь появятся формы входа и регистрации.</p>
              {authMsg && <div className="authFeedback error" role="alert">{authMsg}</div>}
            </> : <>
              <span className="authFormEyebrow">РАДЫ ТЕБЯ ВИДЕТЬ</span>
              <h2>{authMode === 'login' ? 'С возвращением' : 'Создай свой аккаунт'}</h2>
              <p className="authLead">{authMode === 'login' ? 'Войди, чтобы открыть своё личное пространство.' : 'Один аккаунт для всех твоих устройств.'}</p>
              <div className={`authTabs ${allowSignup ? '' : 'single'}`} role="tablist" aria-label="Авторизация">
                <button type="button" role="tab" aria-selected={authMode === 'login'} className={authMode === 'login' ? 'active' : ''} onClick={() => { setAuthMode('login'); setAuthMsg(''); }}>Войти</button>
                {allowSignup && <button type="button" role="tab" aria-selected={authMode === 'signup'} className={authMode === 'signup' ? 'active' : ''} onClick={() => { setAuthMode('signup'); setAuthMsg(''); }}>Регистрация</button>}
              </div>
              <form className="authForm" onSubmit={auth}>
                <label htmlFor="auth-email">Электронная почта</label>
                <input id="auth-email" type="email" autoComplete="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
                <div className="authPasswordLabel"><label htmlFor="auth-password">Пароль</label>{authMode === 'signup' && <small>Не менее 6 символов</small>}</div>
                <input id="auth-password" type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder="Введи пароль" value={password} onChange={e => setPassword(e.target.value)} minLength={6} required disabled={loading} />
                {authMsg && <div className={`authFeedback ${authMsg.includes('создан') || authMsg.includes('Вход выполнен') ? 'success' : 'error'}`} role="status">{authMsg}</div>}
                <button className="authSubmit" type="submit" disabled={loading || !email.trim() || password.length < 6}>
                  {loading ? 'Подключаем…' : authMode === 'login' ? 'Войти в HabitFlow' : 'Создать аккаунт'} <ArrowUpRight size={17} />
                </button>
              </form>
              <div className="authPrivacy"><ShieldCheck size={15} /><span>Твои записи приватны. Другие аккаунты не имеют к ним доступа.</span></div>
            </>}
          </div>
          <div className="authCopyright">HABITFLOW <span>·</span> ТВОЙ РИТМ, ТВОИ ПРАВИЛА</div>
        </section>
      </div>
    </div>;
  }

  return <div className={dark ? 'app dark' : 'app'}>
    <aside className="sidebar">
      <div className="brand"><div className="brandIcon"><Activity size={20} /></div><span>habitflow</span><i>✦</i></div>
      <div className="workspace"><div className="avatar">H</div><div><b>Личное пространство</b><small>{user?.email ?? 'Мой трекер'}</small></div><ChevronRight size={15} /></div>
      <label className="navLabel">ПРОСТРАНСТВО</label>
      {[
        ['Обзор', LayoutDashboard], ['Привычки', Target], ['Дела', ListTodo], ['Финансы', Wallet], ['Календарь', CalendarDays], ['Аналитика', BarChart3]
      ].map(([name, Icon]: any) => <button key={name} className={`nav ${tab === name ? 'active' : ''}`} onClick={() => setTab(name)}>
        <Icon size={17} />{name}{name === 'Привычки' && <span className="navCount">{habits.length}</span>}{name === 'Дела' && <span className="navCount">{activeTasks}</span>}
      </button>)}
      <div className="sideBottom">
        <div className="quote"><Sparkles size={15} /><p>Большие перемены начинаются с маленьких действий.</p><small>— Твой будущий ты</small></div>
        <button className="nav" onClick={() => setDark(!dark)}><Settings2 size={17} />{dark ? 'Светлая тема' : 'Тёмная тема'}</button>
        <button className="nav" onClick={exportData}><Cloud size={17} />Экспорт данных</button>
        {user && <button className="nav" onClick={() => supabase?.auth.signOut()}><LogOut size={17} />Выйти</button>}
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div><span className="eyebrow">ТВОЙ ЛИЧНЫЙ ПРОГРЕСС</span><h1>{tab === 'Обзор' ? 'Твой ритм жизни' : tab}</h1><p>Привычки, планы и деньги — в одном пространстве.</p></div>
        <div className="topActions"><span className="datePill"><CalendarDays size={14} />{today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</span><button className="iconButton" title="Сменить тему" onClick={() => setDark(!dark)}><span className="themeGlyph">◐</span></button><div className="avatar">H</div></div>
      </header>

      {notice && <div className="noticeBanner">{notice}<button onClick={() => setNotice('')}><X size={14} /></button></div>}

      {tab === 'Обзор' && <>
        <section className="welcome">
          <div><span className="welcomeTag"><Sparkles size={13} /> ТВОЯ СИСТЕМА РОСТА</span><h2>Собери свой день.<br /><em>Живи в своём ритме.</em></h2><p>Отмечай важное, планируй дальше и замечай свой прогресс.</p></div>
          <div className="welcomeRing" style={{ '--progress': `${percent}%` } as CSSProperties}><div><b>{percent}%</b><small>сегодня</small></div></div>
          <div className="welcomeDecor">✳</div>
        </section>

        <section className="stats">
          <div className="statCard"><div className="statTop"><span>Привычки сегодня</span><span className="statIcon purple"><Target size={16} /></span></div><strong>{completedToday}<small> / {habits.length}</small></strong><div className="progress"><i style={{ width: `${percent}%` }} /></div><small className="muted">{percent}% дневной цели</small></div>
          <div className="statCard"><div className="statTop"><span>Текущая серия</span><span className="statIcon warm"><Flame size={16} /></span></div><strong>{currentStreak}<small> дней</small></strong><small className="muted">День за днём — без спешки</small></div>
          <div className="statCard"><div className="statTop"><span>Запланировано дел</span><span className="statIcon sage"><ListTodo size={16} /></span></div><strong>{activeTasks}<small> активных</small></strong><small className="muted">{overdueTasks ? `${overdueTasks} просрочено` : 'Всё под контролем'}</small></div>
          <div className="statCard financeMiniCard"><div className="statTop"><span>Баланс за месяц</span><span className="statIcon financeIcon"><Wallet size={16} /></span></div><strong className={monthBalance < 0 ? 'negativeValue' : 'positiveValue'}>{formatMoney(monthBalance)}</strong><small className="muted">Доходы − расходы</small></div>
        </section>

        <section className="contentGrid">
          <div className="panel todayPanel">
            <div className="panelHead"><div><span className="eyebrow">МАЛЕНЬКИЕ РИТУАЛЫ</span><h3>Привычки на сегодня</h3></div><button className="textButton" onClick={() => setTab('Привычки')}>Все привычки <ArrowUpRight size={14} /></button></div>
            <div className="habitList">
              {habits.map(h => {
                const done = logs.some(l => l.habit_id === h.id && l.log_date === localDay);
                return <div className={`habitRow ${done ? 'isDone' : ''}`} key={h.id}>
                  <div className="habitColor" style={{ background: h.color }} />
                  <div className="habitName"><b>{h.name}</b><small>Ежедневная привычка</small></div>
                  <button aria-label={done ? `Снять отметку ${h.name}` : `Отметить ${h.name}`} className={`habitCheckRing ${done ? 'checked' : ''}`} style={{ '--ring-color': h.color, '--ring-progress': done ? '100%' : '0%' } as CSSProperties} onClick={() => toggleHabit(h, localDay)}>{done ? <Check size={16} /> : <span />}</button>
                </div>;
              })}
            </div>
            <button className="addHabit" onClick={() => setShowAddHabit(true)}><Plus size={15} /> Добавить привычку</button>
          </div>
          <div className="panel weekPanel">
            <div className="panelHead"><div><span className="eyebrow">ПОСЛЕДНИЕ 7 ДНЕЙ</span><h3>Твоя неделя</h3></div><span className="miniBadge">РИТМ</span></div>
            <div className="weekChart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weeklyData}>
              <defs><linearGradient id="fillWeek" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9288bd" stopOpacity={0.25} /><stop offset="100%" stopColor="#9288bd" stopOpacity={0.01} /></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--grid)" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} /><Tooltip contentStyle={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)', fontSize: 11 }} /><Area type="monotone" dataKey="value" name="Привычки" stroke="#9288bd" strokeWidth={2.5} fill="url(#fillWeek)" animationDuration={800} /></AreaChart></ResponsiveContainer></div>
            <div className="weekFoot"><span><i className="legendDot" /> Выполнено привычек</span><b>{weeklyData.reduce((a, b) => a + b.value, 0)} отметок</b></div>
          </div>
        </section>

        <section className="panel upcomingPanel">
          <div className="panelHead"><div><span className="eyebrow">ЧТО ДАЛЬШЕ</span><h3>Ближайшие дела</h3></div><button className="textButton" onClick={() => setTab('Дела')}>Все дела <ArrowUpRight size={14} /></button></div>
          {upcomingTasks.length ? <div className="upcomingList">{upcomingTasks.map(task => <div className="upcomingRow" key={task.id}>
            <span className="taskDateBubble">{task.due_date ? task.due_date.slice(8, 10) : '—'}<small>{task.due_date ? new Date(`${task.due_date}T00:00:00`).toLocaleDateString('ru-RU', { month: 'short' }) : 'дата'}</small></span>
            <div className="taskSummary"><b>{task.title}</b><small>{task.category}{task.due_time ? ` · ${task.due_time}` : ''}{task.description ? ` · ${task.description}` : ''}</small></div>
            <span className={`taskStatus ${isTaskOverdue(task) ? 'late' : ''}`}>{isTaskOverdue(task) ? 'Просрочено' : formatDate(task.due_date)}</span>
          </div>)}</div> : <div className="emptyState compact"><div className="emptyIcon"><ListTodo size={19} /></div><b>Пока нет запланированных дел</b><span>Добавь любую задачу или напоминание на будущее.</span></div>}
          <button className="secondaryButton" onClick={openNewTask}><Plus size={15} /> Записать дело</button>
        </section>

        <section className="panel heatPanel yearActivityPanel">
          <div className="panelHead yearActivityHead">
            <div><span className="eyebrow">ТВОЙ ГОД В ДЕЙСТВИИ</span><h3>Активность за год</h3><p className="panelSub">Каждый день — отдельный круг. Цвет показывает, сколько привычек было выполнено.</p></div>
            <div className="yearSummary"><b>{today.getFullYear()}</b><span>{activeDaysYear} активных дней</span></div>
          </div>
          <div className="yearGraphScroll">
            <div className="yearGraph" style={{ '--year-weeks': yearWeeks } as CSSProperties}>
              <div className="yearMonthLabels">
                {yearMonthLabels.map(monthLabel => <span key={monthLabel.monthIndex} style={{ gridColumnStart: monthLabel.week }}>{monthLabel.title}</span>)}
              </div>
              <div className="yearDayLabels"><span>Пн</span><i /><span>Ср</span><i /><span>Пт</span><i /></div>
              <div className="yearDotsGrid">
                {yearGridCells.map(day => day.inYear
                  ? <span
                      key={day.key}
                      title={`${formatDate(day.key)} · ${day.count} из ${habits.length} привычек`}
                      aria-label={`${formatDate(day.key)}: ${day.count} выполнено`}
                      className={`yearDot level${day.level}${day.future ? ' future' : ''}${day.key === localDay ? ' today' : ''}`}
                    />
                  : <span className="yearDot yearDotEmpty" key={day.key} />)}
              </div>
            </div>
          </div>
          <div className="heatLegend yearLegend"><span>Нет отметок</span>{[0, 1, 2, 3, 4].map(n => <i key={n} className={`level${n}`} />)}<span>Больше выполнено</span><b>{completedYear} отметок за год</b></div>
        </section>
      </>}

      {tab === 'Привычки' && <section className="panel pagePanel">
        <div className="panelHead"><div><span className="eyebrow">ТВОИ ПОВТОРЯЮЩИЕСЯ ДЕЙСТВИЯ</span><h3>Мои привычки</h3><p className="panelSub">Отмечай выполнение каждый день и наблюдай за сериями.</p></div><button className="primaryButton" onClick={() => setShowAddHabit(true)}><Plus size={15} /> Новая привычка</button></div>
        <div className="habitManageList">{habits.map(h => {
          const done = logs.some(l => l.habit_id === h.id && l.log_date === localDay);
          const total = logs.filter(l => l.habit_id === h.id).length;
          return <div className="habitManageRow" key={h.id}><span className="habitColor large" style={{ background: h.color }} /><div className="habitName"><b>{h.name}</b><small>{total} отметок за всё время · Ежедневно</small></div><div className="habitTotal">{total} <small>дней</small></div><button className={`habitCheckRing manageRing ${done ? 'checked' : ''}`} style={{ '--ring-color': h.color, '--ring-progress': done ? '100%' : '0%' } as CSSProperties} onClick={() => toggleHabit(h, localDay)}>{done ? <Check size={16} /> : <span />}</button><button className="deleteButton" aria-label="Удалить привычку" onClick={() => removeHabit(h.id)}><Trash2 size={16} /></button></div>;
        })}</div>
        {!habits.length && <div className="emptyState"><div className="emptyIcon"><Target size={20} /></div><b>Список пока пуст</b><span>Добавь первую привычку, которую хочешь закрепить.</span></div>}
      </section>}

      {tab === 'Дела' && <section className="panel pagePanel taskPage">
        <div className="panelHead taskPageHead"><div><span className="eyebrow">ТВОЙ ЛИЧНЫЙ ПЛАНИРОВЩИК</span><h3>Все дела и планы</h3><p className="panelSub">Все планы, задачи и дедлайны — в одном списке.</p></div><button className="primaryButton" onClick={openNewTask}><Plus size={15} /> Записать дело</button></div>
        <div className="taskToolbar"><div className="taskFilters">{(['Все', 'Предстоящие', 'Просроченные', 'Без даты', 'Выполненные'] as TaskFilter[]).map(f => <button key={f} className={taskFilter === f ? 'selected' : ''} onClick={() => setTaskFilter(f)}>{f}{f === 'Предстоящие' && <span>{tasks.filter(t => !t.completed && !!t.due_date && !isTaskOverdue(t)).length}</span>}</button>)}</div><label className="searchBox"><Search size={15} /><input value={taskSearch} onChange={e => setTaskSearch(e.target.value)} placeholder="Найти дело..." /></label></div>
        <div className="taskTableWrap"><table className="taskTable"><thead><tr><th>Дело</th><th>Категория</th><th>Дата</th><th>Приоритет</th><th>Статус</th><th></th></tr></thead><tbody>
          {filteredTasks.map(task => <tr key={task.id} className={task.completed ? 'taskCompleted' : ''}>
            <td><div className="taskTitleCell"><button className={`taskDoneCheck ${task.completed ? 'done' : ''}`} onClick={() => toggleTask(task)} aria-label="Изменить статус">{task.completed && <Check size={13} />}</button><div><b>{task.title}</b>{task.description && <small>{task.description}</small>}</div></div></td>
            <td><span className={`categoryPill ${task.category === 'Работа' ? 'work' : task.category === 'Здоровье' ? 'health' : task.category === 'Покупки' ? 'shopping' : 'personal'}`}>{task.category}</span></td>
            <td><span className={`dueDate ${isTaskOverdue(task) && !task.completed ? 'overdue' : ''}`}><CalendarDays size={13} />{formatDate(task.due_date)}{task.due_time ? ` · ${task.due_time}` : ''}</span></td>
            <td><span className={`priority ${task.priority}`}>{task.priority === 'important' ? 'Важное' : 'Обычное'}</span></td>
            <td><span className={`statusPill ${task.completed ? 'complete' : isTaskOverdue(task) ? 'late' : 'pending'}`}>{task.completed ? 'Готово' : isTaskOverdue(task) ? 'Просрочено' : 'В планах'}</span></td>
            <td><div className="taskRowActions"><button className="deleteButton" aria-label="Изменить дело" title="Изменить" onClick={() => openEditTask(task)}><Pencil size={14} /></button><button className="deleteButton" aria-label="Удалить дело" title="Удалить" onClick={() => deleteTask(task.id)}><Trash2 size={15} /></button></div></td>
          </tr>)}
        </tbody></table></div>
        {!filteredTasks.length && <div className="emptyState"><div className="emptyIcon"><ListTodo size={20} /></div><b>{taskSearch || taskFilter !== 'Все' ? 'Ничего не найдено' : 'Пока нет записей'}</b><span>{taskSearch || taskFilter !== 'Все' ? 'Попробуй изменить фильтр или поисковый запрос.' : 'Добавь задачу, напоминание или любой план на будущее.'}</span>{!taskSearch && taskFilter === 'Все' && <button className="secondaryButton" onClick={openNewTask}><Plus size={15} /> Добавить первое дело</button>}</div>}
        <div className="taskFooter"><span><CheckCircle2 size={14} /> Выполнено: {tasks.filter(t => t.completed).length}</span><span><Clock3 size={14} /> Осталось: {activeTasks}</span><span><SlidersHorizontal size={14} /> Всего записей: {tasks.length}</span></div>
      </section>}

      {tab === 'Финансы' && <section className="financePage">
        <div className="financeHeader"><div><span className="eyebrow">ЛИЧНЫЙ БЮДЖЕТ</span><h2>Финансы</h2><p>Доходы, расходы и движение денег за месяц.</p></div><button className="primaryButton" onClick={openNewTransaction}><Plus size={15} /> Добавить запись</button></div>
        <div className="financeHero"><div><span>Общий баланс по записям</span><strong>{formatMoney(totalBalance)}</strong><small>Суммарный доход минус расходы за всё время</small></div><div className="financeHeroOrb"><Wallet size={27} /></div></div>
        <div className="financeStats"><article className="moneyCard incomeCard"><span><TrendingUp size={17} /> Доходы за месяц</span><b>{formatMoney(monthIncome)}</b><small>{monthTransactions.filter(t => t.kind === 'income').length} записей</small></article><article className="moneyCard expenseCard"><span><TrendingDown size={17} /> Расходы за месяц</span><b>{formatMoney(monthExpenses)}</b><small>{monthTransactions.filter(t => t.kind === 'expense').length} записей</small></article><article className="moneyCard balanceCard"><span><Wallet size={17} /> Итог за месяц</span><b className={monthBalance < 0 ? 'negativeValue' : 'positiveValue'}>{formatMoney(monthBalance)}</b><small>{monthBalance >= 0 ? 'Положительный баланс' : 'Расходы выше доходов'}</small></article></div>
        {expenseSummary.length > 0 && <section className="panel expenseBreakdown"><div className="panelHead"><div><span className="eyebrow">СТРУКТУРА РАСХОДОВ</span><h3>Куда уходят деньги</h3></div><span className="yearPill">{monthName}</span></div><div className="expenseBars">{expenseSummary.map(([category, amount], index) => <div className="expenseBarRow" key={category}><div><b>{category}</b><strong>{formatMoney(amount)}</strong></div><span className="expenseBarTrack"><i style={{ width: `${amount / maxExpense * 100}%`, background: ['#8a72ef', '#e9a17d', '#66b99b', '#6e9ce0', '#d17fa6', '#b19b65'][index] }} /></span></div>)}</div></section>}
        <section className="panel financeListPanel"><div className="panelHead"><div><span className="eyebrow">ИСТОРИЯ ОПЕРАЦИЙ</span><h3>Все записи</h3></div><span className="yearPill">{monthName}</span></div>
          {transactions.length ? <div className="transactionsList">{[...transactions].sort((a,b) => b.transaction_date.localeCompare(a.transaction_date)).map(transaction => <div className="transactionRow" key={transaction.id}><div className={`transactionIcon ${transaction.kind}`} >{transaction.kind === 'income' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</div><div className="transactionDetails"><b>{transaction.title}</b><small>{transaction.category} · {formatDate(transaction.transaction_date)}{transaction.note ? ` · ${transaction.note}` : ''}</small></div><strong className={transaction.kind === 'income' ? 'positiveValue' : 'negativeValue'}>{transaction.kind === 'income' ? '+' : '−'}{formatMoney(Number(transaction.amount))}</strong><div className="transactionActions"><button className="deleteButton" title="Изменить" onClick={() => openEditTransaction(transaction)}><Pencil size={14} /></button><button className="deleteButton" title="Удалить" onClick={() => void deleteTransaction(transaction.id)}><Trash2 size={14} /></button></div></div>)}</div> : <div className="emptyState"><div className="emptyIcon"><Receipt size={20} /></div><b>Пока нет финансовых записей</b><span>Добавь доход или расход, чтобы видеть картину бюджета.</span><button className="secondaryButton" onClick={openNewTransaction}><Plus size={15} /> Добавить первую запись</button></div>}
        </section>
      </section>}

      {tab === 'Календарь' && <section className="panel pagePanel">
        <div className="panelHead"><div><span className="eyebrow">ДАТЫ И СОБЫТИЯ</span><h3>{monthName}</h3><p className="panelSub">Отметки привычек и запланированные дела.</p></div><div className="monthNav"><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={17} /></button><button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={17} /></button></div></div>
        <div className="monthGrid">{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => <b key={d}>{d}</b>)}{Array.from({ length: (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7 }, (_, i) => <i key={`blank${i}`} />)}{Array.from({ length: days }, (_, i) => {
          const d = new Date(month.getFullYear(), month.getMonth(), i + 1); const k = dateKey(d);
          const n = logs.filter(l => l.log_date === k).length; const dayTasks = tasks.filter(t => t.due_date === k && !t.completed);
          return <div className={`calendarDay ${k === localDay ? 'today' : ''}`} key={k}><span>{i + 1}</span><div className="calendarMarks">{n > 0 && <i className="habitMark" title={`${n} отметок привычек`} />}{dayTasks.length > 0 && <i className="taskMark" title={`${dayTasks.length} дел`} />}</div>{dayTasks.length > 0 && <small>{dayTasks.length} {dayTasks.length === 1 ? 'дело' : 'дела'}</small>}</div>;
        })}</div>
        <div className="calendarLegend"><span><i className="habitMark" /> Отметки привычек</span><span><i className="taskMark" /> Запланированные дела</span></div>
        {monthTasks.length > 0 && <div className="monthTaskList"><h4>Дела в этом месяце</h4>{monthTasks.map(t => <div key={t.id}><span className="taskDateBubble smallBubble">{t.due_date?.slice(8, 10)}</span><b>{t.title}</b><small>{formatDate(t.due_date)}{t.due_time ? ` · ${t.due_time}` : ''} · {t.category}</small></div>)}</div>}
        <p className="muted monthSummary">Отметок за месяц: {monthDone} · Выполнение привычек: {monthPct}%</p>
      </section>}

      {tab === 'Аналитика' && <section className="panel pagePanel">
        <div className="panelHead"><div><span className="eyebrow">СПОКОЙНЫЙ ВЗГЛЯД НА ПРОГРЕСС</span><h3>Твоя аналитика</h3><p className="panelSub">Общий обзор привычек, дел и финансов.</p></div></div>
        <div className="analyticsHero"><div className="donut" style={{ '--p': `${percent * 3.6}deg` } as CSSProperties}><div><b>{percent}%</b><small>сегодня</small></div></div><div><h2>Ты движешься вперёд.</h2><p className="muted">Выполнено {completedToday} из {habits.length} привычек сегодня.</p><span className="analyticsNote">Главное — возвращаться к своему ритму.</span></div></div>
        <div className="analyticsNumbers"><div><b>{completedYear}</b><small>Отметок за год</small></div><div><b>{currentStreak}</b><small>Дней серии</small></div><div><b>{monthPct}%</b><small>Прогресс месяца</small></div><div><b>{tasks.filter(t => t.completed).length}</b><small>Выполнено дел</small></div><div><b>{formatMoney(monthBalance)}</b><small>Баланс месяца</small></div></div>
      </section>}

      <footer>HABITFLOW <span>·</span> ТВОЙ РИТМ, ТВОИ ПРАВИЛА <span className="footerRight">Личные данные остаются личными</span></footer>
    </main>

    {showAddHabit && <div className="modalBackdrop" onClick={() => setShowAddHabit(false)}><div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modalHead"><div><span className="eyebrow">НОВЫЙ РИТУАЛ</span><h3>Добавить привычку</h3></div><button className="iconButton" onClick={() => setShowAddHabit(false)}><X size={17} /></button></div>
      <label>Название привычки</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Например, читать 20 минут" autoFocus onKeyDown={e => e.key === 'Enter' && void addHabit()} />
      <label>Цвет индикатора</label><div className="colorChoices">{colors.map(c => <button key={c} onClick={() => setNewColor(c)} style={{ background: c, outline: newColor === c ? '3px solid var(--text)' : 'none' }} />)}</div>
      <button className="primaryButton full" onClick={addHabit}><Plus size={15} /> Создать привычку</button>
    </div></div>}

    {showAddTask && <div className="modalBackdrop" onClick={() => setShowAddTask(false)}><div className="modal taskModal" onClick={e => e.stopPropagation()}>
      <div className="modalHead"><div><span className="eyebrow">НЕ ПОТЕРЯЙ ВАЖНОЕ</span><h3>{editingTaskId ? 'Изменить дело' : 'Записать новое дело'}</h3></div><button className="iconButton" onClick={() => { setShowAddTask(false); resetTaskForm(); }}><X size={17} /></button></div>
      <label>Что нужно сделать?</label><input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Например, оплатить счета или купить продукты" autoFocus />
      <label>Подробности <span className="optional">необязательно</span></label><textarea value={taskDescription} onChange={e => setTaskDescription(e.target.value)} placeholder="Дополнительные детали или заметки..." rows={3} />
      <div className="formTwoCols"><div><label>Дедлайн · дата</label><input type="date" value={taskDate} onChange={e => setTaskDate(e.target.value)} /></div><div><label>Время <span className="optional">необязательно</span></label><input type="time" value={taskTime} onChange={e => setTaskTime(e.target.value)} /></div></div><label>Категория</label><select value={taskCategory} onChange={e => setTaskCategory(e.target.value)}>{taskCategories.map(category => <option key={category}>{category}</option>)}</select>
      <label>Приоритет</label><div className="priorityChoices"><button className={taskPriority === 'normal' ? 'selected' : ''} onClick={() => setTaskPriority('normal')}>Обычное дело</button><button className={taskPriority === 'important' ? 'selected importantChoice' : ''} onClick={() => setTaskPriority('important')}>Важное</button></div>
      <button className="primaryButton full" onClick={() => void addTask()} disabled={!taskTitle.trim()}>{editingTaskId ? <Check size={15} /> : <Plus size={15} />}{editingTaskId ? 'Сохранить изменения' : 'Сохранить дело'}</button>
    </div></div>}

    {showTransactionModal && <div className="modalBackdrop" onClick={() => setShowTransactionModal(false)}><div className="modal financeModal" onClick={e => e.stopPropagation()}>
      <div className="modalHead"><div><span className="eyebrow">УЧЁТ ДЕНЕГ</span><h3>{editingTransactionId ? 'Изменить запись' : 'Новая финансовая запись'}</h3></div><button className="iconButton" onClick={() => { setShowTransactionModal(false); resetTransactionForm(); }}><X size={17} /></button></div>
      <label>Тип операции</label><div className="transactionKindSwitch"><button className={transactionKind === 'expense' ? 'active expenseActive' : ''} onClick={() => { setTransactionKind('expense'); setTransactionCategory('Еда'); }}><TrendingDown size={15} /> Расход</button><button className={transactionKind === 'income' ? 'active incomeActive' : ''} onClick={() => { setTransactionKind('income'); setTransactionCategory('Зарплата'); }}><TrendingUp size={15} /> Доход</button></div>
      <label>Название</label><input value={transactionTitle} onChange={e => setTransactionTitle(e.target.value)} placeholder={transactionKind === 'income' ? 'Например, зарплата' : 'Например, продукты'} autoFocus />
      <div className="formTwoCols"><div><label>Сумма · ₸</label><input type="number" min="1" step="1" value={transactionAmount} onChange={e => setTransactionAmount(e.target.value)} placeholder="0" /></div><div><label>Дата</label><input type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} /></div></div>
      <label>Категория</label><select value={transactionCategory} onChange={e => setTransactionCategory(e.target.value)}>{(transactionKind === 'income' ? incomeCategories : expenseCategories).map(category => <option key={category}>{category}</option>)}</select>
      <label>Заметка <span className="optional">необязательно</span></label><input value={transactionNote} onChange={e => setTransactionNote(e.target.value)} placeholder="Дополнительная информация" />
      <button className="primaryButton full" onClick={() => void saveTransaction()} disabled={!transactionTitle.trim() || !(Number(transactionAmount.replace(',', '.')) > 0)}>{editingTransactionId ? 'Сохранить изменения' : 'Добавить запись'}</button>
    </div></div>}

    {loading && <div className="loadingPill">Синхронизация...</div>}
  </div>;
}
