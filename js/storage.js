/* =========================================================
   TaskUp — storage.js
   Estado global da aplicação persistido em localStorage.
   Nada sai do dispositivo.
   ========================================================= */
(function () {
  'use strict';

  const { U, Bus } = window.TU;
  const KEY = 'taskup:data:v1';
  const VERSION = 1;

  const DEFAULT_CATEGORIES = [
    { id: 'cat-trabalho', name: 'Trabalho', emoji: '💼', color: '#3b82f6' },
    { id: 'cat-escola', name: 'Escola', emoji: '📚', color: '#f59e0b' },
    { id: 'cat-faculdade', name: 'Faculdade', emoji: '🎓', color: '#a855f7' },
    { id: 'cat-pessoal', name: 'Pessoal', emoji: '🙋', color: '#ec4899' },
    { id: 'cat-compras', name: 'Compras', emoji: '🛒', color: '#f97316' },
    { id: 'cat-financeiro', name: 'Financeiro', emoji: '💰', color: '#10b981' },
    { id: 'cat-saude', name: 'Saúde', emoji: '❤️', color: '#ef4444' },
    { id: 'cat-compromissos', name: 'Compromissos', emoji: '📅', color: '#06b6d4' },
    { id: 'cat-projetos', name: 'Projetos', emoji: '🚀', color: '#7c5cff' },
    { id: 'cat-outros', name: 'Outros', emoji: '🗂️', color: '#64748b' },
  ];

  const DEFAULT_SETTINGS = {
    name: '',
    onboarded: false,
    theme: 'auto', // auto | light | dark
    accent: 'violeta',
    mascot: '🐣',
    // gamificação
    gamification: true,
    showXP: true,
    streaks: true,
    achievements: true,
    missions: true,
    motivation: true,
    celebrations: true,
    // sons
    sounds: true,
    volume: 0.6,
    // notificações
    notifications: true,
    defaultReminder: 10,
    dailySummary: true,
    dailySummaryTime: '08:00',
    // pomodoro
    pomodoro: {
      focus: 25,
      short: 5,
      long: 15,
      longEvery: 4,
      autoStartBreaks: false,
      autoStartFocus: false,
    },
    lastBackup: null,
    lastBackupNag: null,
  };

  function defaultState() {
    return {
      app: 'TaskUp',
      version: VERSION,
      createdAt: new Date().toISOString(),
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      tasks: [],
      game: {
        xp: 0,
        coins: 0,
        streak: 0,
        bestStreak: 0,
        lastActiveDate: null,
        totalCompleted: 0,
        totalPomodoros: 0,
        focusMinutes: 0,
        xpByDate: {},
        completedByDate: {},
        pomodorosByDate: {},
        achievements: {},
        missions: { date: null, list: [] },
        weekly: { week: null, claimed: false },
        unlocked: { accents: ['violeta'], mascots: ['🐣'] },
      },
      pomodoro: {
        mode: 'focus', // focus | short | long
        running: false,
        endAt: null,
        remaining: null, // segundos restantes quando pausado
        taskId: null,
        cycle: 0, // focos concluídos no ciclo atual
      },
      notified: {},
    };
  }

  /** Mescla recursivamente valores padrão em objetos carregados (migração leve). */
  function mergeDefaults(target, defaults) {
    for (const k of Object.keys(defaults)) {
      if (target[k] === undefined || target[k] === null) {
        if (defaults[k] !== null) target[k] = JSON.parse(JSON.stringify(defaults[k]));
        else if (target[k] === undefined) target[k] = null;
      } else if (
        typeof defaults[k] === 'object' &&
        defaults[k] !== null &&
        !Array.isArray(defaults[k]) &&
        typeof target[k] === 'object'
      ) {
        mergeDefaults(target[k], defaults[k]);
      }
    }
    return target;
  }

  function normalizeTask(t) {
    return Object.assign(
      {
        id: U.uid(),
        title: 'Tarefa',
        emoji: '',
        notes: '',
        categoryId: 'cat-outros',
        priority: 'medium',
        date: null,
        time: null,
        duration: 30,
        reminder: null,
        recurrence: 'none',
        subtasks: [],
        done: false,
        completedAt: null,
        createdAt: new Date().toISOString(),
        pomodoros: 0,
        xpAwarded: 0,
        coinsAwarded: 0,
        spawnedNext: null,
        snoozeUntil: null,
      },
      t
    );
  }

  let state = null;
  let storageOk = true;

  const Store = {
    KEY,
    DEFAULT_CATEGORIES,
    DEFAULT_SETTINGS,
    defaultState,
    normalizeTask,

    load() {
      let raw = null;
      storageOk = U.storage.persistent;
      try {
        raw = U.storage.getItem(KEY);
      } catch (e) {
        storageOk = false;
        console.warn('localStorage indisponível', e);
      }
      if (raw) {
        try {
          state = Store.hydrate(JSON.parse(raw));
        } catch (e) {
          console.error('Dados corrompidos, iniciando do zero', e);
          try {
            U.storage.setItem(KEY + ':corrupted:' + Date.now(), raw);
          } catch (_) {}
          state = defaultState();
        }
      } else {
        state = defaultState();
      }
      return state;
    },

    /** Valida e completa um objeto de estado (usado no load e na importação). */
    hydrate(obj) {
      if (!obj || typeof obj !== 'object' || !Array.isArray(obj.tasks)) {
        throw new Error('Formato inválido');
      }
      const s = mergeDefaults(obj, defaultState());
      s.tasks = s.tasks.map(normalizeTask);
      if (!Array.isArray(s.categories) || !s.categories.length) {
        s.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
      }
      if (!s.categories.some((c) => c.id === 'cat-outros')) {
        s.categories.push({ ...DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1] });
      }
      s.version = VERSION;
      return s;
    },

    get state() {
      return state;
    },
    get storageOk() {
      return storageOk;
    },

    save: U.debounce(() => Store.saveNow(), 150),

    saveNow() {
      try {
        U.storage.setItem(KEY, JSON.stringify(state));
      } catch (e) {
        console.error('Falha ao salvar', e);
        Bus.emit('toast', { text: 'Não foi possível salvar os dados (armazenamento cheio?)', type: 'error' });
      }
    },

    /** Altera o estado e notifica a interface. */
    update(fn, { silent = false } = {}) {
      fn(state);
      Store.save();
      if (!silent) Bus.emit('change', state);
    },

    replace(newState) {
      state = Store.hydrate(newState);
      Store.saveNow();
      Bus.emit('change', state);
    },

    reset() {
      state = defaultState();
      Store.saveNow();
      Bus.emit('change', state);
    },

    category(id) {
      return state.categories.find((c) => c.id === id) || state.categories.find((c) => c.id === 'cat-outros') || state.categories[0];
    },

    usageBytes() {
      try {
        return (U.storage.getItem(KEY) || '').length * 2;
      } catch (_) {
        return 0;
      }
    },
  };

  // Salva imediatamente ao sair / esconder a página
  window.addEventListener('pagehide', () => state && Store.saveNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && state) Store.saveNow();
  });

  window.TU.Store = Store;
})();
