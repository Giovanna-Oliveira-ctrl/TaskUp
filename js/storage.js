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
  const MIRROR_AT_KEY = 'taskup:data:v1:mirror-at';
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
        unattended: false, // começou sozinha (início automático) e ninguém mexeu no app
        cycle: 0, // focos concluídos no ciclo atual
      },
      notified: {},
    };
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
  /** Limites contra arquivos gigantes que travariam o app ou estourariam o armazenamento. */
  const LIMITS = { tasks: 20000, categories: 100, subtasks: 100, days: 3660, notified: 5000 };

  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const bool = (v, def = false) => (typeof v === 'boolean' ? v : def);
  const finiteOrNull = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null);

  /** Monta uma tarefa NOVA só com os campos conhecidos (lista de permissões). */
  function sanitizeTask(t) {
    return {
      id: isId(t.id) ? t.id : U.uid(),
      title: str(t.title, 300).trim() || 'Tarefa',
      emoji: emoji(t.emoji),
      notes: str(t.notes, 5000),
      categoryId: isId(t.categoryId) ? t.categoryId : 'cat-outros',
      priority: PRIOS.includes(t.priority) ? t.priority : 'medium',
      date: typeof t.date === 'string' && RE_DATE.test(t.date) ? t.date : null,
      time: typeof t.time === 'string' && RE_TIME.test(t.time) ? t.time : null,
      duration: num(t.duration, 30, 0, 1440),
      reminder: t.reminder === null || t.reminder === undefined || t.reminder === '' ? null : num(t.reminder, null, 0, 10080),
      recurrence: RECS.includes(t.recurrence) ? t.recurrence : 'none',
      recurDay: Number.isInteger(t.recurDay) && t.recurDay >= 1 && t.recurDay <= 31 ? t.recurDay : null,
      subtasks: (Array.isArray(t.subtasks) ? t.subtasks : [])
        .slice(0, LIMITS.subtasks)
        .filter((x) => x && typeof x === 'object')
        .map((x) => ({ id: isId(x.id) ? x.id : U.uid(), title: str(x.title, 300), done: x.done === true })),
      done: t.done === true,
      completedAt: isoOrNull(t.completedAt),
      createdAt: isoOrNull(t.createdAt) || new Date().toISOString(),
      updatedAt: isoOrNull(t.updatedAt),
      pomodoros: num(t.pomodoros, 0, 0, 1e6),
      xpAwarded: num(t.xpAwarded, 0, 0, 1e4),
      coinsAwarded: num(t.coinsAwarded, 0, 0, 1e4),
      spawnedNext: isId(t.spawnedNext) ? t.spawnedNext : null,
      spawnedFrom: isId(t.spawnedFrom) ? t.spawnedFrom : null,
      snoozeUntil: finiteOrNull(t.snoozeUntil, 0, 8.64e15),
      wasOnTime: t.wasOnTime === true,
      wasMorning: t.wasMorning === true,
      autoDoneSubs: (Array.isArray(t.autoDoneSubs) ? t.autoDoneSubs : []).filter(isId).slice(0, LIMITS.subtasks),
    };
  }

  /** Mapa { 'AAAA-MM-DD': número } — descarta chaves e valores inválidos. */
  function dateMap(o, max = 1e7) {
    const out = {};
    if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
    Object.keys(o)
      .filter((k) => RE_DATE.test(k))
      .slice(-LIMITS.days)
      .forEach((k) => {
        const v = num(o[k], 0, 0, max);
        if (v) out[k] = v;
      });
    return out;
  }

  /** Configurações: só as chaves conhecidas, com o mesmo tipo do valor padrão. */
  function sanitizeSettings(src, defaults) {
    const out = {};
    src = src && typeof src === 'object' && !Array.isArray(src) ? src : {};
    Object.keys(defaults).forEach((k) => {
      const d = defaults[k];
      const v = own(src, k) ? src[k] : undefined;
      if (d === null) out[k] = isoOrNull(v);
      else if (typeof d === 'boolean') out[k] = bool(v, d);
      else if (typeof d === 'number') out[k] = num(v, d, 0, 1e6);
      else if (typeof d === 'string') out[k] = typeof v === 'string' ? v.slice(0, 40) : d;
      else if (typeof d === 'object') out[k] = sanitizeSettings(v, d);
    });
    return out;
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
    // espalhar ({...}) cria propriedades próprias: uma chave "__proto__" vira dado inerte
    return {
      ...{
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
      ...t,
    };
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
            // guarda só as 2 cópias corrompidas mais recentes (para diagnóstico)
            U.storage
              .keys()
              .filter((k) => k && k.startsWith(KEY + ':corrupted:'))
              .sort()
              .slice(0, -1)
              .forEach((k) => U.storage.removeItem(k));
            U.storage.setItem(KEY + ':corrupted:' + Date.now(), raw.slice(0, 1048576));
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
      // a cópia espelho só vale se sua gravação foi concluída (tem horário registrado)
      if (mirror) candidates.push({ label: 'espelho', raw: mirror, at: +U.storage.getItem(MIRROR_AT_KEY) || 0 });
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
      const def = defaultState();

      // tarefas (ids duplicados quebrariam edição/remoção)
      const seen = new Set();
      const tasks = obj.tasks
        .slice(0, LIMITS.tasks)
        .filter((t) => t && typeof t === 'object')
        .map((t) => {
          const task = normalizeTask(t);
          if (seen.has(task.id)) task.id = U.uid();
          seen.add(task.id);
          return task;
        });

      // categorias
      let categories = (Array.isArray(obj.categories) ? obj.categories : [])
        .slice(0, LIMITS.categories)
        .filter((c) => c && typeof c === 'object')
        .map(sanitizeCategory);
      const catIds = new Set();
      categories = categories.filter((c) => !catIds.has(c.id) && catIds.add(c.id));
      if (!categories.length) categories = def.categories;
      if (!catIds.has('cat-outros')) categories.push({ ...DEFAULT_CATEGORIES[DEFAULT_CATEGORIES.length - 1] });

      // configurações
      const settings = sanitizeSettings(obj.settings, DEFAULT_SETTINGS);
      if (!['auto', 'light', 'dark'].includes(settings.theme)) settings.theme = 'auto';
      if (!RE_TIME.test(settings.dailySummaryTime)) settings.dailySummaryTime = '08:00';
      settings.volume = num(settings.volume, 0.6, 0, 1);
      settings.defaultReminder = own(obj.settings, 'defaultReminder') && obj.settings.defaultReminder === null ? null : num(settings.defaultReminder, 10, 0, 10080);
      ['focus', 'short', 'long', 'longEvery'].forEach((k) => (settings.pomodoro[k] = num(settings.pomodoro[k], DEFAULT_SETTINGS.pomodoro[k], 1, 180)));

      // jogo
      const gi = obj.game && typeof obj.game === 'object' ? obj.game : {};
      const G = window.TU.Game;
      const achIds = G ? new Set(G.ACHIEVEMENTS.map((a) => a.id)) : null;
      const misIds = G ? new Set(G.MISSION_POOL.map((m) => m.id)) : null;
      const achievements = {};
      if (gi.achievements && typeof gi.achievements === 'object') {
        Object.keys(gi.achievements).forEach((k) => {
          if (isId(k) && (!achIds || achIds.has(k)) && isoOrNull(gi.achievements[k])) achievements[k] = gi.achievements[k];
        });
      }
      const mi = gi.missions && typeof gi.missions === 'object' ? gi.missions : {};
      const game = {
        xp: num(gi.xp, 0, 0, 1e9),
        coins: num(gi.coins, 0, -1e6, 1e9),
        streak: num(gi.streak, 0, 0, 1e5),
        bestStreak: num(gi.bestStreak, 0, 0, 1e5),
        lastActiveDate: typeof gi.lastActiveDate === 'string' && RE_DATE.test(gi.lastActiveDate) ? gi.lastActiveDate : null,
        totalCompleted: num(gi.totalCompleted, 0, 0, 1e9),
        totalPomodoros: num(gi.totalPomodoros, 0, 0, 1e9),
        focusMinutes: num(gi.focusMinutes, 0, 0, 1e9),
        xpByDate: dateMap(gi.xpByDate),
        completedByDate: dateMap(gi.completedByDate),
        pomodorosByDate: dateMap(gi.pomodorosByDate),
        focusByDate: dateMap(gi.focusByDate),
        frozenDays: dateMap(gi.frozenDays, 1),
        achievements,
        missions: {
          date: typeof mi.date === 'string' && RE_DATE.test(mi.date) ? mi.date : null,
          list: (Array.isArray(mi.list) ? mi.list : [])
            .filter((m) => m && typeof m === 'object' && isId(m.id) && (!misIds || misIds.has(m.id)))
            .slice(0, 5)
            .map((m) => ({ id: m.id, progress: num(m.progress, 0, 0, 1e6), claimed: m.claimed === true })),
        },
        weekly: {
          week: gi.weekly && typeof gi.weekly.week === 'string' && RE_DATE.test(gi.weekly.week) ? gi.weekly.week : null,
          claimed: !!(gi.weekly && gi.weekly.claimed === true),
        },
        unlocked: gi.unlocked,
        inventory: gi.inventory,
        boostUntil: gi.boostUntil,
      };
      // pomodoro
      const pi = obj.pomodoro && typeof obj.pomodoro === 'object' ? obj.pomodoro : {};
      const pomodoro = {
        mode: ['focus', 'short', 'long'].includes(pi.mode) ? pi.mode : 'focus',
        running: pi.running === true,
        endAt: finiteOrNull(pi.endAt, 0, 8.64e15),
        remaining: finiteOrNull(pi.remaining, 0, 86400),
        taskId: isId(pi.taskId) ? pi.taskId : null,
        length: finiteOrNull(pi.length, 0, 1440),
        cycle: num(pi.cycle, 0, 0, 1e6),
        unattended: pi.unattended === true,
      };
      if (pomodoro.running && !pomodoro.endAt) pomodoro.running = false;
      // lembretes já avisados
      const notified = {};
      if (obj.notified && typeof obj.notified === 'object') {
        Object.keys(obj.notified)
          .slice(-LIMITS.notified)
          .forEach((k) => {
            if (k.length <= 200 && typeof obj.notified[k] === 'number' && Number.isFinite(obj.notified[k])) notified[k] = obj.notified[k];
          });
      }

      const s = { app: 'TaskUp', version: VERSION, createdAt: isoOrNull(obj.createdAt) || def.createdAt, settings, categories, tasks, game, pomodoro, notified };
      if (window.TU.Shop) window.TU.Shop.validate(s); // itens da loja, inventário e reforço de XP
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
      if (!state) return false;
      const json = JSON.stringify(state);
      // 1) dados principais: se o espaço acabar, libera cópias antigas e tenta de novo
      let saved = false;
      for (let attempt = 0; attempt < 8 && !saved; attempt++) {
        try {
          U.storage.setItem(KEY, json);
          saved = true;
        } catch (e) {
          if (!Store.freeSpace()) break;
        }
      }
      if (!saved) {
        dirty = true; // continua pendente: tenta de novo na próxima alteração
        console.error('Falha ao salvar: armazenamento cheio');
        Bus.emit('toast', { text: 'Armazenamento cheio: não foi possível salvar. Exporte um backup e apague tarefas concluídas antigas.', type: 'error', duration: 10000 });
        return false;
      }
      // 2) cópia espelho (com horário): se a principal se corromper, o app recupera o último estado
      try {
        U.storage.removeItem(MIRROR_AT_KEY); // marca "gravação em andamento"
        U.storage.setItem(MIRROR_KEY, json);
        U.storage.setItem(MIRROR_AT_KEY, String(Date.now()));
      } catch (_) {
        U.storage.removeItem(MIRROR_KEY); // espelho incompleto não serve para recuperar
      }
      return true;
    },

    /** Libera espaço: cópias "corrompidas" antigas, depois a cópia automática mais antiga, por fim o espelho. */
    freeSpace() {
      const corrupted = U.storage.keys().filter((k) => k && k.startsWith(KEY + ':corrupted:'));
      if (corrupted.length) {
        U.storage.removeItem(corrupted.sort()[0]);
        return true;
      }
      const B = window.TU.Backup;
      if (B && B.dropOldestSnapshot()) return true;
      if (U.storage.getItem(MIRROR_KEY) !== null) {
        U.storage.removeItem(MIRROR_KEY);
        U.storage.removeItem(MIRROR_AT_KEY);
        return true;
      }
      return false;
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

    /** Espaço usado por todos os dados do TaskUp (principal, espelho e cópias). */
    usageBytes() {
      try {
        return U.storage
          .keys()
          .filter((k) => k && k.startsWith('taskup:'))
          .reduce((n, k) => n + (k.length + (U.storage.getItem(k) || '').length) * 2, 0);
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
    // esta aba tem alterações ainda não gravadas: grava as dela (a última gravação vence)
    if (dirty) {
      Store.saveNow();
      return;
    }
    try {
      state = Store.hydrate(JSON.parse(e.newValue));
      dirty = false;
      Bus.emit('change', state);
      Bus.emit('theme');
    } catch (_) {}
  });

  window.TU.Store = Store;
})();
