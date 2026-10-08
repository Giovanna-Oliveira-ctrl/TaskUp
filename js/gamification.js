/* =========================================================
   TaskUp — gamification.js
   XP, níveis, sequência, conquistas, missões diárias,
   desafio semanal, moedas e loja de recompensas.
   Tudo opcional (Configurações → Gamificação).
   ========================================================= */
(function () {
  'use strict';

  const { U, Bus, Store, UI, Sound } = window.TU;

  /* ---------- Níveis ---------- */
  // XP acumulado necessário para atingir o nível L: 50 * L * (L - 1)
  const xpForLevel = (L) => 50 * L * (L - 1);
  function levelFromXp(xp) {
    let L = 1;
    while (xp >= xpForLevel(L + 1)) L++;
    return L;
  }
  const TITLES = [
    [1, 'Iniciante', '🐣'],
    [3, 'Aprendiz', '🌱'],
    [5, 'Focado', '🎯'],
    [8, 'Produtivo', '⚡'],
    [12, 'Mestre das Tarefas', '🧠'],
    [16, 'Lenda', '🦄'],
    [20, 'Imparável', '🚀'],
    [30, 'Divindade da Produtividade', '👑'],
  ];
  function levelTitle(L) {
    let t = TITLES[0];
    for (const row of TITLES) if (L >= row[0]) t = row;
    return { title: t[1], emoji: t[2] };
  }
  function levelInfo(xp = Store.state.game.xp) {
    const level = levelFromXp(xp);
    const base = xpForLevel(level);
    const next = xpForLevel(level + 1);
    return { level, xp, current: xp - base, needed: next - base, pct: ((xp - base) / (next - base)) * 100, ...levelTitle(level) };
  }

  /* ---------- Recompensas por ação ---------- */
  const XP_TABLE = { low: 10, medium: 20, high: 35 };
  const COIN_TABLE = { low: 2, medium: 4, high: 6 };

  /* ---------- Mensagens motivacionais ---------- */
  const MOTIVATION = [
    'Vamos fazer acontecer hoje?',
    'Um passo de cada vez já é progresso! 🚶',
    'Você é mais capaz do que imagina. 💪',
    'Feito é melhor que perfeito. ✨',
    'Pequenas vitórias constroem grandes conquistas. 🏆',
    'Foco no agora, o resto a gente resolve depois. 🎯',
    'Hoje é um ótimo dia para riscar coisas da lista! ✅',
    'Respira, organiza e vai! 🌬️',
    'Sua versão do futuro vai agradecer. 🙌',
    'Disciplina é lembrar o que você quer. 🧭',
    'Comece pelo mais difícil e o resto fica leve. 🐸',
    'Bora subir de nível na vida real! 🎮',
  ];
  const CELEBRATE = ['Mandou bem! 🎉', 'Uhuul! Mais uma! 🙌', 'Arrasou! ✨', 'Isso aí! 💥', 'Tarefa esmagada! 🔨', 'Que produtividade! 🚀', 'Check! ✅', 'Show de bola! ⚽'];
  const ALL_DONE = ['Dia zerado! Você é incrível! 🏆', 'Todas as tarefas do dia concluídas! 🎊', 'Lista limpa! Hora de descansar 😎'];

  /* ---------- Conquistas ---------- */
  const ACHIEVEMENTS = [
    { id: 'first', emoji: '🌟', name: 'Primeiro passo', desc: 'Conclua sua primeira tarefa', test: (g) => g.totalCompleted >= 1 },
    { id: 'ten', emoji: '🔟', name: 'Dezena', desc: 'Conclua 10 tarefas', test: (g) => g.totalCompleted >= 10 },
    { id: 'fifty', emoji: '🥈', name: 'Meio centenário', desc: 'Conclua 50 tarefas', test: (g) => g.totalCompleted >= 50 },
    { id: 'hundred', emoji: '💯', name: 'Centena', desc: 'Conclua 100 tarefas', test: (g) => g.totalCompleted >= 100 },
    { id: 'fivehundred', emoji: '🏛️', name: 'Monumental', desc: 'Conclua 500 tarefas', test: (g) => g.totalCompleted >= 500 },
    { id: 'streak3', emoji: '🔥', name: 'Esquentando', desc: 'Sequência de 3 dias', test: (g) => g.bestStreak >= 3 },
    { id: 'streak7', emoji: '📆', name: 'Semana perfeita', desc: 'Sequência de 7 dias', test: (g) => g.bestStreak >= 7 },
    { id: 'streak30', emoji: '🌋', name: 'Vulcão', desc: 'Sequência de 30 dias', test: (g) => g.bestStreak >= 30 },
    { id: 'pomo1', emoji: '🍅', name: 'Primeiro tomate', desc: 'Conclua 1 Pomodoro', test: (g) => g.totalPomodoros >= 1 },
    { id: 'pomo25', emoji: '🧃', name: 'Molho de tomate', desc: 'Conclua 25 Pomodoros', test: (g) => g.totalPomodoros >= 25 },
    { id: 'focus10h', emoji: '🧘', name: 'Zen', desc: '10 horas de foco', test: (g) => g.focusMinutes >= 600 },
    { id: 'level5', emoji: '⚡', name: 'Nível 5', desc: 'Alcance o nível 5', test: (g) => levelFromXp(g.xp) >= 5 },
    { id: 'level10', emoji: '🧠', name: 'Nível 10', desc: 'Alcance o nível 10', test: (g) => levelFromXp(g.xp) >= 10 },
    { id: 'bigday', emoji: '💥', name: 'Dia épico', desc: 'Conclua 10 tarefas em um dia', test: (g) => Object.values(g.completedByDate).some((n) => n >= 10) },
    { id: 'early', emoji: '🐓', name: 'Madrugador', desc: 'Conclua uma tarefa antes das 7h', test: (g, ctx) => ctx && ctx.hour < 7 && ctx.hour >= 4 },
    { id: 'night', emoji: '🦉', name: 'Coruja', desc: 'Conclua uma tarefa depois das 23h', test: (g, ctx) => ctx && ctx.hour >= 23 },
    { id: 'high', emoji: '🐸', name: 'Engolindo sapos', desc: 'Conclua 10 tarefas de alta prioridade', test: () => Store.state.tasks.filter((t) => t.done && t.priority === 'high').length >= 10 },
    { id: 'organizer', emoji: '🗂️', name: 'Organizador', desc: 'Crie uma categoria personalizada', test: () => Store.state.categories.some((c) => !c.id.startsWith('cat-')) },
    { id: 'shopper', emoji: '🛍️', name: 'Colecionador', desc: 'Compre um item na loja', test: (g) => g.unlocked.accents.length + g.unlocked.mascots.length > 2 },
    { id: 'allday', emoji: '🏆', name: 'Dia zerado', desc: 'Conclua todas as tarefas de um dia (mín. 3)', test: (g, ctx) => ctx && ctx.allDone },
  ];

  /* ---------- Missões diárias ---------- */
  const MISSION_POOL = [
    { id: 'm-done3', emoji: '✅', text: 'Conclua 3 tarefas', target: 3, metric: 'done', reward: { xp: 30, coins: 10 } },
    { id: 'm-done5', emoji: '🏃', text: 'Conclua 5 tarefas', target: 5, metric: 'done', reward: { xp: 50, coins: 15 } },
    { id: 'm-high1', emoji: '🐸', text: 'Conclua 1 tarefa de alta prioridade', target: 1, metric: 'high', reward: { xp: 25, coins: 8 } },
    { id: 'm-pomo1', emoji: '🍅', text: 'Faça 1 Pomodoro', target: 1, metric: 'pomo', reward: { xp: 25, coins: 8 } },
    { id: 'm-pomo3', emoji: '🧠', text: 'Faça 3 Pomodoros', target: 3, metric: 'pomo', reward: { xp: 45, coins: 14 } },
    { id: 'm-ontime2', emoji: '⏰', text: 'Conclua 2 tarefas no horário', target: 2, metric: 'ontime', reward: { xp: 30, coins: 10 } },
    { id: 'm-create3', emoji: '📝', text: 'Planeje 3 novas tarefas', target: 3, metric: 'create', reward: { xp: 20, coins: 6 } },
    { id: 'm-sub3', emoji: '🧩', text: 'Conclua 3 subtarefas', target: 3, metric: 'subtask', reward: { xp: 20, coins: 6 } },
    { id: 'm-before12', emoji: '🌅', text: 'Conclua 2 tarefas antes do meio-dia', target: 2, metric: 'morning', reward: { xp: 30, coins: 10 } },
  ];

  const WEEKLY_TARGET = 20;
  const WEEKLY_REWARD = { xp: 150, coins: 50 };

  /* ---------- Loja ---------- */
  const ACCENTS = {
    violeta: { name: 'Violeta', color: '#7c5cff', color2: '#b05cff', price: 0 },
    oceano: { name: 'Oceano', color: '#0ea5e9', color2: '#22d3ee', price: 40 },
    floresta: { name: 'Floresta', color: '#10b981', color2: '#84cc16', price: 40 },
    sunset: { name: 'Pôr do sol', color: '#f97316', color2: '#ec4899', price: 60 },
    chiclete: { name: 'Chiclete', color: '#ec4899', color2: '#a855f7', price: 60 },
    galaxia: { name: 'Galáxia', color: '#6366f1', color2: '#0ea5e9', price: 90 },
    ouro: { name: 'Ouro', color: '#d97706', color2: '#facc15', price: 150 },
  };
  const MASCOTS = {
    '🐣': { name: 'Pintinho', price: 0 },
    '🐱': { name: 'Gato', price: 30 },
    '🐶': { name: 'Cachorro', price: 30 },
    '🦊': { name: 'Raposa', price: 50 },
    '🐼': { name: 'Panda', price: 50 },
    '🐸': { name: 'Sapo', price: 60 },
    '🦉': { name: 'Coruja', price: 80 },
    '🦄': { name: 'Unicórnio', price: 120 },
    '🐉': { name: 'Dragão', price: 200 },
    '🤖': { name: 'Robô', price: 200 },
  };

  /* ---------- Helpers ---------- */
  const enabled = (k) => {
    const s = Store.state.settings;
    return s.gamification && (k ? s[k] !== false : true);
  };
  const game = () => Store.state.game;

  function addXp(g, date, xp, coins) {
    g.xp = Math.max(0, g.xp + xp);
    g.coins = Math.max(0, g.coins + coins);
    g.xpByDate[date] = Math.max(0, (g.xpByDate[date] || 0) + xp);
  }

  function computeStreak() {
    const g = game();
    if (!g.lastActiveDate) return 0;
    const diff = U.diffDays(g.lastActiveDate, U.today());
    return diff <= 1 ? g.streak : 0;
  }

  function touchStreak(g, today) {
    if (g.lastActiveDate === today) return false;
    const diff = g.lastActiveDate ? U.diffDays(g.lastActiveDate, today) : null;
    g.streak = diff === 1 ? g.streak + 1 : 1;
    g.lastActiveDate = today;
    g.bestStreak = Math.max(g.bestStreak, g.streak);
    return true;
  }

  /** Recalcula sequência quando um dia fica sem tarefas concluídas (desfazer). */
  function recomputeStreak(g) {
    const days = Object.keys(g.completedByDate)
      .filter((d) => g.completedByDate[d] > 0)
      .sort();
    if (!days.length) {
      g.streak = 0;
      g.lastActiveDate = null;
      return;
    }
    const last = days[days.length - 1];
    let streak = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (U.diffDays(days[i - 1], days[i]) === 1) streak++;
      else break;
    }
    g.streak = streak;
    g.lastActiveDate = last;
  }

  /* ---------- Missões ---------- */
  function ensureMissions() {
    const g = game();
    const today = U.today();
    if (g.missions.date !== today) {
      const rnd = U.seeded('missions-' + today);
      const pool = MISSION_POOL.slice();
      const list = [];
      while (list.length < 3 && pool.length) {
        const i = Math.floor(rnd() * pool.length);
        list.push({ id: pool[i].id, progress: 0, claimed: false });
        pool.splice(i, 1);
      }
      g.missions = { date: today, list };
    }
    const week = U.weekStart(today);
    if (g.weekly.week !== week) g.weekly = { week, claimed: false };
    return g.missions;
  }

  function missionDef(id) {
    return MISSION_POOL.find((m) => m.id === id);
  }

  function bumpMission(metric, delta = 1) {
    ensureMissions();
    const g = game();
    g.missions.list.forEach((m) => {
      const def = missionDef(m.id);
      if (!def || def.metric !== metric) return;
      const before = m.progress;
      m.progress = U.clamp(m.progress + delta, 0, def.target);
      if (before < def.target && m.progress >= def.target && enabled('missions') && !m.claimed) {
        Bus.emit('toast', { text: `Missão completa: ${def.text}! Resgate sua recompensa.`, type: 'achievement', icon: '🎯' });
      }
    });
  }

  function claimMission(id) {
    const g = game();
    const m = g.missions.list.find((x) => x.id === id);
    const def = missionDef(id);
    if (!m || !def || m.claimed || m.progress < def.target) return;
    const before = levelFromXp(g.xp);
    Store.update((s) => {
      m.claimed = true;
      addXp(s.game, U.today(), def.reward.xp, def.reward.coins);
    });
    Sound.play('coin');
    UI.toast(`+${def.reward.xp} XP e +${def.reward.coins} moedas!`, { type: 'xp', icon: '🪙' });
    afterXp(before);
  }

  function weeklyProgress() {
    const g = game();
    ensureMissions();
    let n = 0;
    for (let i = 0; i < 7; i++) n += g.completedByDate[U.addDays(g.weekly.week, i)] || 0;
    return { done: n, target: WEEKLY_TARGET, claimed: g.weekly.claimed, reward: WEEKLY_REWARD };
  }

  function claimWeekly() {
    const w = weeklyProgress();
    if (w.claimed || w.done < w.target) return;
    const before = levelFromXp(game().xp);
    Store.update((s) => {
      s.game.weekly.claimed = true;
      addXp(s.game, U.today(), WEEKLY_REWARD.xp, WEEKLY_REWARD.coins);
    });
    Sound.play('coin');
    celebrate({ big: true });
    UI.toast(`Desafio semanal concluído! +${WEEKLY_REWARD.xp} XP`, { type: 'achievement', icon: '🏅' });
    afterXp(before);
  }

  /* ---------- Conquistas ---------- */
  function checkAchievements(ctx) {
    const g = game();
    const newly = [];
    ACHIEVEMENTS.forEach((a) => {
      if (g.achievements[a.id]) return;
      let ok = false;
      try {
        ok = a.test(g, ctx);
      } catch (_) {}
      if (ok) {
        g.achievements[a.id] = new Date().toISOString();
        g.coins += 15;
        newly.push(a);
      }
    });
    if (newly.length) {
      Store.save();
      if (enabled('achievements')) {
        newly.forEach((a, i) =>
          setTimeout(() => {
            Sound.play('achievement');
            UI.toast(`Conquista desbloqueada: ${a.name} (+15 moedas)`, { type: 'achievement', icon: a.emoji, duration: 5000 });
          }, 400 + i * 700)
        );
      }
    }
    return newly;
  }

  /* ---------- Celebrações ---------- */
  function celebrate({ big = false, origin = null } = {}) {
    if (!Store.state.settings.celebrations || !Store.state.settings.gamification) return;
    UI.confetti({ count: big ? 180 : 50, origin });
  }

  function afterXp(levelBefore) {
    const after = levelFromXp(game().xp);
    if (after > levelBefore && enabled('showXP')) {
      setTimeout(() => showLevelUp(after), 350);
    }
    Bus.emit('game');
  }

  function showLevelUp(level) {
    const t = levelTitle(level);
    Sound.play('levelup');
    celebrate({ big: true });
    UI.modal({
      size: 'sm',
      className: 'modal-levelup',
      body: `
        <div class="levelup">
          <div class="levelup-badge">${t.emoji}</div>
          <p class="levelup-kicker">Subiu de nível!</p>
          <h2>Nível ${level}</h2>
          <p class="muted">Agora você é <strong>${t.title}</strong>. Continue assim!</p>
          <button class="btn btn-primary btn-block" data-close>Bora! 🚀</button>
        </div>`,
      onMount(el, api) {
        el.querySelector('[data-close]').onclick = () => api.close();
      },
    });
  }

  /* ---------- API pública chamada pelos outros módulos ---------- */
  const Game = {
    ACHIEVEMENTS,
    MISSION_POOL,
    ACCENTS,
    MASCOTS,
    levelInfo,
    levelFromXp,
    levelTitle,
    computeStreak,
    ensureMissions,
    missionDef,
    claimMission,
    weeklyProgress,
    claimWeekly,
    celebrate,
    checkAchievements,
    enabled,
    afterXp,

    motivation() {
      return U.pick(MOTIVATION);
    },

    /** Chamado ao concluir tarefa. Retorna {xp, coins}. Muta o estado (dentro de Store.update). */
    onTaskCompleted(s, task) {
      const g = s.game;
      const today = U.today();
      const now = new Date();
      let xp = XP_TABLE[task.priority] || 15;
      let coins = COIN_TABLE[task.priority] || 3;
      const due = U.dueDate(task);
      const onTime = due && now <= due;
      if (onTime) xp += 5;
      const streakDay = touchStreak(g, today);
      // bônus por sequência
      if (streakDay && g.streak > 1) xp += Math.min(g.streak, 10) * 2;
      addXp(g, today, xp, coins);
      g.totalCompleted++;
      g.completedByDate[today] = (g.completedByDate[today] || 0) + 1;
      bumpMission('done');
      if (task.priority === 'high') bumpMission('high');
      if (onTime) bumpMission('ontime');
      if (now.getHours() < 12) bumpMission('morning');
      return { xp, coins };
    },

    /** Reverte recompensas ao desmarcar uma tarefa. */
    onTaskUncompleted(s, task) {
      const g = s.game;
      const day = task.completedAt ? U.dateKey(new Date(task.completedAt)) : U.today();
      g.xp = Math.max(0, g.xp - (task.xpAwarded || 0));
      g.coins = Math.max(0, g.coins - (task.coinsAwarded || 0));
      g.xpByDate[day] = Math.max(0, (g.xpByDate[day] || 0) - (task.xpAwarded || 0));
      g.totalCompleted = Math.max(0, g.totalCompleted - 1);
      g.completedByDate[day] = Math.max(0, (g.completedByDate[day] || 0) - 1);
      if (day === U.today()) {
        bumpMission('done', -1);
        if (task.priority === 'high') bumpMission('high', -1);
      }
      if (!g.completedByDate[day]) recomputeStreak(g);
    },

    onSubtaskCompleted(s, delta) {
      const xp = 2 * delta;
      addXp(s.game, U.today(), xp, 0);
      bumpMission('subtask', delta);
    },

    onTaskCreated() {
      bumpMission('create');
    },

    onPomodoro(s, minutes) {
      const g = s.game;
      const today = U.today();
      g.totalPomodoros++;
      g.focusMinutes += minutes;
      g.pomodorosByDate[today] = (g.pomodorosByDate[today] || 0) + 1;
      addXp(g, today, 15, 3);
      touchStreak(g, today);
      bumpMission('pomo');
      return { xp: 15, coins: 3 };
    },

    /** Feedback visual/sonoro após concluir (fora do Store.update). */
    feedbackComplete({ xp, levelBefore, origin, allDone, undo }) {
      Sound.play('complete');
      const action = undo ? { label: 'Desfazer', fn: undo } : null;
      if (enabled() && enabled('showXP')) UI.toast(`${U.pick(CELEBRATE)} +${xp} XP`, { type: 'xp', icon: '⭐', duration: 4000, action });
      else UI.toast('Tarefa concluída', { type: 'success', duration: 4000, action });
      if (enabled()) {
        celebrate({ origin, big: allDone });
        if (allDone && enabled('motivation')) setTimeout(() => UI.toast(U.pick(ALL_DONE), { type: 'success', icon: '🏆' }), 600);
      }
      checkAchievements({ hour: new Date().getHours(), allDone });
      afterXp(levelBefore);
    },

    buy(kind, key) {
      const g = game();
      const item = kind === 'accent' ? ACCENTS[key] : MASCOTS[key];
      const list = kind === 'accent' ? g.unlocked.accents : g.unlocked.mascots;
      if (!item || list.includes(key)) return;
      if (g.coins < item.price) {
        UI.toast(`Faltam ${item.price - g.coins} moedas para esse item.`, { type: 'error', icon: '🪙' });
        return;
      }
      Store.update((s) => {
        s.game.coins -= item.price;
        (kind === 'accent' ? s.game.unlocked.accents : s.game.unlocked.mascots).push(key);
        if (kind === 'accent') s.settings.accent = key;
        else s.settings.mascot = key;
      });
      Sound.play('coin');
      celebrate({});
      UI.toast(`${item.name} desbloqueado e equipado!`, { type: 'success', icon: kind === 'accent' ? '🎨' : key });
      checkAchievements();
      Bus.emit('theme');
    },

    equip(kind, key) {
      Store.update((s) => {
        if (kind === 'accent') s.settings.accent = key;
        else s.settings.mascot = key;
      });
      Bus.emit('theme');
    },

    /* ---------- Tela de Conquistas ---------- */
    render(view) {
      const s = Store.state;
      const g = s.game;
      if (!s.settings.gamification) {
        view.innerHTML = `
          <div class="empty-state card">
            <div class="empty-emoji">🎮</div>
            <h3>Gamificação desativada</h3>
            <p class="muted">XP, níveis, conquistas e missões estão desligados. Você pode ativá-los quando quiser.</p>
            <button class="btn btn-primary" data-action="enable-game">Ativar gamificação</button>
          </div>`;
        return;
      }
      ensureMissions();
      const li = levelInfo();
      const streak = computeStreak();
      const w = weeklyProgress();
      const unlockedCount = Object.keys(g.achievements).length;

      view.innerHTML = `
        <div class="grid game-top">
          <div class="card level-hero">
            <div class="level-hero-badge">${li.emoji}</div>
            <div class="level-hero-info">
              <span class="kicker">Nível ${li.level}</span>
              <h2>${li.title}</h2>
              <div class="progress lg"><span style="width:${li.pct}%"></span></div>
              <p class="muted small">${li.current} / ${li.needed} XP para o nível ${li.level + 1} · total ${li.xp} XP</p>
            </div>
          </div>
          <div class="card stat-mini"><span class="stat-emoji flame ${streak ? 'on' : ''}">🔥</span><div><strong>${streak}</strong><span>dias de sequência</span></div></div>
          <div class="card stat-mini"><span class="stat-emoji">🏅</span><div><strong>${g.bestStreak}</strong><span>melhor sequência</span></div></div>
          <div class="card stat-mini"><span class="stat-emoji">🪙</span><div><strong>${g.coins}</strong><span>moedas</span></div></div>
          <div class="card stat-mini"><span class="stat-emoji">✅</span><div><strong>${g.totalCompleted}</strong><span>tarefas concluídas</span></div></div>
          <div class="card stat-mini"><span class="stat-emoji">🍅</span><div><strong>${g.totalPomodoros}</strong><span>pomodoros · ${U.formatDuration(g.focusMinutes) || '0 min'}</span></div></div>
        </div>

        <div class="grid two">
          ${enabled('missions') ? `<div class="card">
            <div class="card-head"><h3>🎯 Missões de hoje</h3><span class="muted small">renovam à meia-noite</span></div>
            ${Game.missionsHtml()}
          </div>
          <div class="card">
            <div class="card-head"><h3>🏁 Desafio da semana</h3><span class="muted small">seg → dom</span></div>
            <p>Conclua <strong>${w.target} tarefas</strong> nesta semana.</p>
            <div class="progress lg"><span style="width:${Math.min(100, (w.done / w.target) * 100)}%"></span></div>
            <div class="row between mt">
              <span class="muted small">${Math.min(w.done, w.target)} / ${w.target} · recompensa: ${w.reward.xp} XP + ${w.reward.coins} 🪙</span>
              ${w.claimed ? '<span class="pill pill-success">Resgatado ✓</span>' : `<button class="btn btn-sm btn-primary" data-action="claim-weekly" ${w.done < w.target ? 'disabled' : ''}>Resgatar</button>`}
            </div>
          </div>` : ''}
        </div>

        ${enabled('achievements') ? `<div class="card">
          <div class="card-head"><h3>🏆 Conquistas</h3><span class="muted small">${unlockedCount} / ${ACHIEVEMENTS.length}</span></div>
          <div class="achievements">
            ${ACHIEVEMENTS.map((a) => {
              const at = g.achievements[a.id];
              return `<div class="achievement ${at ? 'unlocked' : 'locked'}" title="${U.escape(a.desc)}">
                <div class="ach-emoji">${at ? a.emoji : '🔒'}</div>
                <strong>${a.name}</strong>
                <span class="muted small">${a.desc}</span>
                ${at ? `<span class="ach-date">${U.formatDateHuman(U.dateKey(new Date(at)))}</span>` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}

        <div class="card">
          <div class="card-head"><h3>🛍️ Loja de recompensas</h3><span class="pill">🪙 ${g.coins}</span></div>
          <p class="muted small">Ganhe moedas concluindo tarefas, Pomodoros, missões e conquistas. Troque por temas e mascotes!</p>
          <h4 class="shop-title">Cores do tema</h4>
          <div class="shop">
            ${Object.entries(ACCENTS).map(([k, a]) => {
              const owned = g.unlocked.accents.includes(k);
              const equipped = s.settings.accent === k;
              return `<div class="shop-item ${equipped ? 'equipped' : ''}">
                <div class="swatch" style="background:linear-gradient(135deg, ${a.color}, ${a.color2})"></div>
                <strong>${a.name}</strong>
                ${equipped ? '<span class="pill pill-success">Em uso</span>' : owned ? `<button class="btn btn-sm" data-action="equip" data-kind="accent" data-key="${k}">Usar</button>` : `<button class="btn btn-sm btn-primary" data-action="buy" data-kind="accent" data-key="${k}" ${g.coins < a.price ? 'disabled' : ''}>🪙 ${a.price}</button>`}
              </div>`;
            }).join('')}
          </div>
          <h4 class="shop-title">Mascotes</h4>
          <div class="shop">
            ${Object.entries(MASCOTS).map(([k, m]) => {
              const owned = g.unlocked.mascots.includes(k);
              const equipped = s.settings.mascot === k;
              return `<div class="shop-item ${equipped ? 'equipped' : ''}">
                <div class="mascot-big">${k}</div>
                <strong>${m.name}</strong>
                ${equipped ? '<span class="pill pill-success">Em uso</span>' : owned ? `<button class="btn btn-sm" data-action="equip" data-kind="mascot" data-key="${k}">Usar</button>` : `<button class="btn btn-sm btn-primary" data-action="buy" data-kind="mascot" data-key="${k}" ${g.coins < m.price ? 'disabled' : ''}>🪙 ${m.price}</button>`}
              </div>`;
            }).join('')}
          </div>
        </div>`;
    },

    missionsHtml() {
      const g = game();
      ensureMissions();
      return `<ul class="missions">
        ${g.missions.list
          .map((m) => {
            const d = missionDef(m.id);
            if (!d) return '';
            const done = m.progress >= d.target;
            return `<li class="mission ${done ? 'done' : ''} ${m.claimed ? 'claimed' : ''}">
              <span class="mission-emoji">${d.emoji}</span>
              <div class="mission-body">
                <span>${d.text}</span>
                <div class="progress sm"><span style="width:${(m.progress / d.target) * 100}%"></span></div>
                <span class="muted small">${m.progress}/${d.target} · ${d.reward.xp} XP + ${d.reward.coins} 🪙</span>
              </div>
              ${m.claimed ? '<span class="pill pill-success">✓</span>' : `<button class="btn btn-sm ${done ? 'btn-primary pulse' : ''}" data-action="claim-mission" data-id="${m.id}" ${done ? '' : 'disabled'}>Resgatar</button>`}
            </li>`;
          })
          .join('')}
      </ul>`;
    },
  };

  window.TU.Game = Game;
})();
