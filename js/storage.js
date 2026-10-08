/* =========================================================
   TaskUp — storage.js
   Estado global da aplicação persistido em localStorage.
   Nada sai do dispositivo.
   ========================================================= */
(function () {
  'use strict';

  const { U, Bus } = window.TU;
  const KEY = 'taskup:data:v1';
  const MIRROR_KEY = 'taskup:data:v1:mirror';
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
    background: 'none',
    effect: 'classic',
    soundPack: 'classic',
    title: 'none',
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
        focusByDate: {},
        achievements: {},
        missions: { date: null, list: [] },
        weekly: { week: null, claimed: false },
        unlocked: { accents: ['violeta'], mascots: ['🐣'], backgrounds: ['none'], effects: ['classic'], sounds: ['classic'], titles: ['none'] },
        inventory: { freeze: 0 },
        boostUntil: 0,
        frozenDays: {},
      },
      pomodoro: {
        mode: 'focus', // focus | short | long
        running: false,
        endAt: null,
        remaining: null, // segundos restantes quando pausado
        taskId: null,
        length: null, // duração (min) da sessão em andamento
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

  /* ---------- Sanitização (dados importados/corrompidos) ---------- */
  const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const RE_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
  const RE_ID = /^[\w-]{1,64}$/;
  const isId = (v) => typeof v === 'string' && RE_ID.test(v);
  const RE_COLOR = /^#[0-9a-f]{3,8}$/i;
  const PRIOS = ['low', 'medium', 'high'];
  const RECS = ['none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly'];
  const str = (v, max = 500) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
  /** Emoji: texto curto sem caracteres de marcação. */
  const emoji = (v) => str(v, 16).replace(/[<>"'&`=\\/]/g, '').trim();
  const num = (v, def, min = 0, max = 1e9) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.min(max, Math.max(min, +v)) : def);
  const isoOrNull = (v) => (typeof v === 'string' && !isNaN(Date.parse(v)) ? v : null);
  const color = (v, def = '#64748b') => (typeof v === 'string' && RE_COLOR.test(v) ? v : def);

  function sanitizeTask(t) {
    if (!isId(t.id)) t.id = U.uid();
    t.title = str(t.title, 300).trim() || 'Tarefa';
    t.emoji = emoji(t.emoji);
    t.notes = str(t.notes, 5000);
    t.categoryId = isId(t.categoryId) ? String(t.categoryId) : 'cat-outros';
    if (!PRIOS.includes(t.priority)) t.priority = 'medium';
    if (!RECS.includes(t.recurrence)) t.recurrence = 'none';
    t.date = typeof t.date === 'string' && RE_DATE.test(t.date) ? t.date : null;
    t.time = typeof t.time === 'string' && RE_TIME.test(t.time) ? t.time : null;
    t.duration = num(t.duration, 30, 0, 1440);
    t.reminder = t.reminder === null || t.reminder === undefined || t.reminder === '' ? null : num(t.reminder, null, 0, 10080);
    t.subtasks = (Array.isArray(t.subtasks) ? t.subtasks : [])
      .filter((x) => x && typeof x === 'object')
      .map((x) => ({ id: isId(x.id) ? String(x.id) : U.uid(), title: str(x.title, 300), done: !!x.done }));
    t.done = !!t.done;
    t.completedAt = isoOrNull(t.completedAt);
    t.createdAt = isoOrNull(t.createdAt) || new Date().toISOString();
    t.updatedAt = isoOrNull(t.updatedAt);
    t.pomodoros = num(t.pomodoros, 0, 0, 1e6);
    t.xpAwarded = num(t.xpAwarded, 0, 0, 1e4);
    t.coinsAwarded = num(t.coinsAwarded, 0, 0, 1e4);
    t.spawnedNext = isId(t.spawnedNext) ? String(t.spawnedNext) : null;
    t.snoozeUntil = Number.isFinite(t.snoozeUntil) ? t.snoozeUntil : null;
    t.recurDay = Number.isInteger(t.recurDay) && t.recurDay >= 1 && t.recurDay <= 31 ? t.recurDay : null;
    return t;
  }

  function sanitizeCategory(c) {
    return {
      id: isId(c && c.id) ? String(c.id) : 'c-' + U.uid(),
      name: str(c && c.name, 40).trim() || 'Categoria',
      emoji: emoji(c && c.emoji) || '📌',
      color: color(c && c.color),
    };
  }

  function normalizeTask(t) {
    return sanitizeTask(normalizeTaskRaw(t));
  }

  function normalizeTaskRaw(t) {
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
        updatedAt: null,
      },
      t
    );
  }

  let state = null;
  let storageOk = true;
  let dirty = false; // há alterações ainda não gravadas
  const debouncedSave = U.debounce(() => dirty && Store.saveNow(), 150);

  const Store = {
    KEY,
    DEFAULT_CATEGORIES,
    DEFAULT_SETTINGS,
    defaultState,
    normalizeTask,
    sanitizeCategory,

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
          console.error('Dados corrompidos', e);
          try {
            U.storage.setItem(KEY + ':corrupted:' + Date.now(), raw);
          } catch (_) {}
          // recuperação automática: usa a cópia automática mais recente que estiver íntegra
          state = Store.recoverFromSnapshot() || defaultState();
          dirty = true;
          debouncedSave();
        }
      } else {
        state = defaultState();
      }
      return state;
    },

    /** Procura a cópia válida mais recente: primeiro a cópia espelho (último estado
        salvo), depois as cópias automáticas diárias, da mais nova para a mais antiga. */
    recoverFromSnapshot() {
      const candidates = [];
      const mirror = U.storage.getItem(MIRROR_KEY);
      if (mirror) candidates.push({ label: 'espelho', raw: mirror, at: Infinity });
      const prefix = 'taskup:snapshot:';
      U.storage.keys().forEach((k) => {
        if (!k || !k.startsWith(prefix)) return;
        const raw = U.storage.getItem(k);
        let at = 0;
        try {
          at = Date.parse(JSON.parse(raw).snapshotAt) || 0;
        } catch (_) {}
        candidates.push({ label: k.slice(prefix.length), raw, at });
      });
      candidates.sort((a, b) => b.at - a.at);
      for (const c of candidates) {
        try {
          const st = Store.hydrate(JSON.parse(c.raw));
          delete st.snapshotAt;
          Store.recoveredFrom = c.label === 'espelho' ? 'cópia espelho (último salvamento)' : `cópia automática "${c.label}"`;
          return st;
        } catch (_) {}
      }
      return null;
    },

    /** Valida e completa um objeto de estado (usado no load e na importação). */
    hydrate(obj) {
      if (!obj || typeof obj !== 'object' || !Array.isArray(obj.tasks)) {
        throw new Error('Formato inválido');
      }
      const s = mergeDefaults(obj, defaultState());
      s.tasks = s.tasks.filter((t) => t && typeof t === 'object').map(normalizeTask);
      // ids duplicados quebrariam edição/remoção
      const seen = new Set();
      s.tasks.forEach((t) => {
        if (seen.has(t.id)) t.id = U.uid();
        seen.add(t.id);
      });
      if (!Array.isArray(s.categories) || !s.categories.length) {
        s.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
      }
      s.categories = s.categories.filter((c) => c && typeof c === 'object').map(sanitizeCategory);
      if (!s.categories.some((c) => c.id === 'cat-outros')) {
        s.categories.push({ ...DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1] });
      }
      // configurações e jogo
      const st = s.settings;
      if (!['auto', 'light', 'dark'].includes(st.theme)) st.theme = 'auto';
      st.name = str(st.name, 40);
      if (!RE_TIME.test(st.dailySummaryTime)) st.dailySummaryTime = '08:00';
      st.volume = num(st.volume, 0.6, 0, 1);
      ['focus', 'short', 'long', 'longEvery'].forEach((k) => (st.pomodoro[k] = num(st.pomodoro[k], DEFAULT_SETTINGS.pomodoro[k], 1, 180)));
      const g = s.game;
      ['xp', 'streak', 'bestStreak', 'totalCompleted', 'totalPomodoros', 'focusMinutes'].forEach((k) => (g[k] = num(g[k], 0, 0, 1e9)));
      g.coins = num(g.coins, 0, -1e6, 1e9);
      if (window.TU.Shop) window.TU.Shop.validate(s);
      if (g.lastActiveDate && !RE_DATE.test(g.lastActiveDate)) g.lastActiveDate = null;
      ['xpByDate', 'completedByDate', 'pomodorosByDate', 'focusByDate', 'achievements', 'notified'].forEach((k) => {
        const o = k === 'notified' ? s : g;
        if (!o[k] || typeof o[k] !== 'object' || Array.isArray(o[k])) o[k] = {};
      });
      if (!Array.isArray(g.missions.list)) g.missions = { date: null, list: [] };
      s.version = VERSION;
      return s;
    },

    get state() {
      return state;
    },
    get storageOk() {
      return storageOk;
    },

    save() {
      dirty = true;
      debouncedSave();
    },

    saveNow() {
      dirty = false;
      try {
        const json = JSON.stringify(state);
        U.storage.setItem(KEY, json);
        // cópia espelho: se a principal se corromper, o app recupera o último estado
        try {
          U.storage.setItem(MIRROR_KEY, json);
        } catch (_) {}
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

  // Salva imediatamente ao sair / esconder a página (só se houver algo pendente,
  // para uma aba antiga não sobrescrever dados mais novos de outra aba)
  window.addEventListener('pagehide', () => state && dirty && Store.saveNow());
  window.addEventListener('beforeunload', () => state && dirty && Store.saveNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && state && dirty) Store.saveNow();
  });
  // Outra aba (ou o app instalado) alterou os dados: recarrega
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue || !state) return;
    try {
      state = Store.hydrate(JSON.parse(e.newValue));
      dirty = false;
      Bus.emit('change', state);
      Bus.emit('theme');
    } catch (_) {}
  });

  window.TU.Store = Store;
})();
