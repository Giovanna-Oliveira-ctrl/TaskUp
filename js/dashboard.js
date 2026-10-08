/* =========================================================
   TaskUp — dashboard.js
   Painel inicial: saudação, resumo do dia, progresso,
   próximas atividades, missões e visão por categoria.
   ========================================================= */
(function () {
  'use strict';

  const { U, Store, Tasks, Game } = window.TU;

  const Dashboard = {
    _motivation: null,

    render(view) {
      const s = Store.state;
      const st = s.settings;
      const today = U.today();
      const g = U.greeting();
      const name = st.name ? `, ${U.escape(st.name.split(' ')[0])}` : '';
      const gameOn = st.gamification;
      if (!Dashboard._motivation) Dashboard._motivation = Game.motivation();

      const todays = s.tasks.filter((t) => t.date === today);
      const done = todays.filter((t) => t.done).length;
      const overdue = s.tasks.filter((t) => Tasks.isOverdue(t));
      const highPending = s.tasks.filter((t) => !t.done && t.priority === 'high' && (!t.date || t.date <= today));
      const pct = todays.length ? Math.round((done / todays.length) * 100) : 0;
      const streak = Game.computeStreak();
      const xpToday = s.game.xpByDate[today] || 0;
      const li = Game.levelInfo();

      const upcoming = Tasks.sortTasks(
        s.tasks.filter((t) => !t.done && (t.date === today || Tasks.isOverdue(t))),
        'date'
      ).slice(0, 6);

      // últimos 7 dias
      const week = [];
      for (let i = 6; i >= 0; i--) {
        const k = U.addDays(today, -i);
        week.push({ k, n: s.game.completedByDate[k] || 0, label: i === 0 ? 'hoje' : U.WEEKDAYS_SHORT[U.parseDateKey(k).getDay()] });
      }
      const maxW = Math.max(1, ...week.map((w) => w.n));

      // categorias com pendências
      const catStats = s.categories
        .map((c) => {
          const list = s.tasks.filter((t) => t.categoryId === c.id && (t.date === today || (!t.done && (!t.date || t.date < today))));
          return { c, total: list.length, done: list.filter((t) => t.done).length };
        })
        .filter((x) => x.total)
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);

      const ringC = 2 * Math.PI * 42;
      const progressMsg =
        !todays.length ? 'Nenhuma tarefa para hoje ainda. Que tal planejar o dia?' : pct === 100 ? 'Dia concluído! Você arrasou! 🏆' : pct >= 50 ? 'Mais da metade! Continue assim! 💪' : done ? 'Bom começo! Vamos em frente! 🚀' : 'Bora começar com a primeira? 🎯';

      view.innerHTML = `
        <section class="hero card">
          <div class="hero-text">
            <p class="kicker">${U.formatDateLong(today)}${gameOn && window.TU.Shop.titleText() ? ` · <span class="user-title">${U.escape(window.TU.Shop.titleText())}</span>` : ''}${gameOn && window.TU.Shop.boostActive() ? ' · <span class="pill pill-live">⚡ XP em dobro</span>' : ''}</p>
            <h1>${g.text}${name}! <span class="wave">${g.emoji}</span></h1>
            <p class="hero-sub">${gameOn && st.motivation ? Dashboard._motivation : 'Vamos fazer acontecer hoje?'}</p>
            <div class="row gap wrap mt">
              <button class="btn btn-primary" data-action="new-task" data-date="${today}">＋ Nova tarefa</button>
              <button class="btn" data-action="go" data-view="routine">🕒 Minha rotina</button>
              <button class="btn" data-action="go" data-view="pomodoro">🍅 Focar agora</button>
            </div>
          </div>
          <div class="hero-mascot" title="Seu mascote">
            <div class="mascot ${pct === 100 && todays.length ? 'happy' : ''}">${gameOn ? st.mascot : '📋'}</div>
            ${gameOn ? `<div class="speech">${pct === 100 && todays.length ? 'Uhuul! 🎉' : overdue.length ? `${overdue.length} atrasada${overdue.length > 1 ? 's' : ''}… bora? 👀` : streak > 1 ? `${streak} dias seguidos! 🔥` : 'Partiu! ✨'}</div>` : ''}
          </div>
        </section>

        <section class="stats">
          <button class="stat-card" data-action="goto-filter" data-status="today">
            <span class="stat-icon" style="--c:#7c5cff">📋</span>
            <strong>${todays.length}</strong><span>tarefas de hoje</span>
          </button>
          <button class="stat-card" data-action="goto-filter" data-status="done">
            <span class="stat-icon" style="--c:#10b981">✅</span>
            <strong>${done}</strong><span>concluídas hoje</span>
          </button>
          <button class="stat-card ${overdue.length ? 'alert' : ''}" data-action="goto-filter" data-status="overdue">
            <span class="stat-icon" style="--c:#ef4444">⏰</span>
            <strong>${overdue.length}</strong><span>atrasadas</span>
          </button>
          <button class="stat-card" data-action="goto-filter" data-status="pending" data-priority="high">
            <span class="stat-icon" style="--c:#f97316">🔴</span>
            <strong>${highPending.length}</strong><span>alta prioridade</span>
          </button>
          ${gameOn && st.streaks ? `<button class="stat-card" data-action="go" data-view="game">
            <span class="stat-icon flame ${streak ? 'on' : ''}" style="--c:#f59e0b">🔥</span>
            <strong>${streak}</strong><span>dia${streak === 1 ? '' : 's'} de sequência</span>
          </button>` : ''}
          ${gameOn && st.showXP ? `<button class="stat-card" data-action="go" data-view="game">
            <span class="stat-icon" style="--c:#eab308">⭐</span>
            <strong>+${xpToday}</strong><span>XP hoje</span>
          </button>` : ''}
        </section>

        <div class="grid dash-grid">
          <section class="card progress-card">
            <div class="card-head"><h3>📈 Progresso do dia</h3></div>
            <div class="progress-wrap">
              <svg viewBox="0 0 100 100" class="ring">
                <circle cx="50" cy="50" r="42" class="ring-track"/>
                <circle cx="50" cy="50" r="42" class="ring-bar" style="stroke-dasharray:${ringC};stroke-dashoffset:${ringC * (1 - pct / 100)}"/>
                <text x="50" y="50" class="ring-text">${pct}%</text>
              </svg>
              <div>
                <p class="big"><strong>${done} de ${todays.length}</strong> tarefas concluídas</p>
                <div class="progress lg"><span style="width:${pct}%"></span></div>
                <p class="muted small mt">${progressMsg}</p>
              </div>
            </div>
            ${gameOn && st.showXP ? `
            <div class="level-strip" data-action="go" data-view="game" role="button" tabindex="0">
              <span class="level-badge">${li.emoji}</span>
              <div class="grow">
                <div class="row between small"><strong>Nível ${li.level} · ${li.title}</strong><span class="muted">${li.current}/${li.needed} XP</span></div>
                <div class="progress sm xp"><span style="width:${li.pct}%"></span></div>
              </div>
              <span class="pill">🪙 ${Math.max(0, s.game.coins)}</span>
            </div>` : ''}
          </section>

          <section class="card next-card">
            <div class="card-head">
              <h3>🎯 Próximas de hoje</h3>
              <button class="link-btn" data-action="go" data-view="tasks">ver todas</button>
            </div>
            <div class="task-list">
              ${upcoming.length ? upcoming.map((t) => Tasks.itemHtml(t, { showDate: t.date !== today, compact: true })).join('') : `
                <div class="empty-state small">
                  <div class="empty-emoji">${todays.length ? '🏖️' : '🌱'}</div>
                  <p class="muted">${todays.length ? 'Tudo feito por hoje. Aproveite!' : 'Sem tarefas pendentes para hoje.'}</p>
                </div>`}
            </div>
            <form class="quick-add mini" data-form="dash-quick">
              <input class="input" name="q" placeholder="Adicionar rapidinho para hoje..." autocomplete="off" aria-label="Adicionar tarefa para hoje">
              <button class="btn btn-primary" type="submit">＋</button>
            </form>
          </section>

          ${gameOn && st.missions ? `<section class="card">
            <div class="card-head"><h3>🎯 Missões do dia</h3><button class="link-btn" data-action="go" data-view="game">conquistas</button></div>
            ${Game.missionsHtml()}
          </section>` : ''}

          <section class="card">
            <div class="card-head"><h3>📊 Últimos 7 dias</h3><span class="muted small">${week.reduce((a, w) => a + w.n, 0)} concluídas</span></div>
            <div class="bars">
              ${week.map((w) => `<div class="bar ${w.k === today ? 'today' : ''}" title="${w.n} tarefas"><span class="bar-n">${w.n || ''}</span><i style="height:${(w.n / maxW) * 100}%"></i><small>${w.label}</small></div>`).join('')}
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h3>🗂️ Por categoria</h3><button class="link-btn" data-action="go" data-view="categories">gerenciar</button></div>
            ${catStats.length ? `<ul class="cat-stats">
              ${catStats.map(({ c, total, done: d }) => `
                <li data-action="open-category" data-id="${c.id}" role="button" tabindex="0">
                  <span class="cat-emoji sm" style="--c:${c.color}">${c.emoji}</span>
                  <div class="grow">
                    <div class="row between small"><span>${U.escape(c.name)}</span><span class="muted">${d}/${total}</span></div>
                    <div class="progress sm" style="--bar:${c.color}"><span style="width:${(d / total) * 100}%;background:${c.color}"></span></div>
                  </div>
                </li>`).join('')}
            </ul>` : '<p class="muted small">Quando houver tarefas para hoje, você verá o progresso de cada área aqui.</p>'}
          </section>
        </div>`;

      const form = view.querySelector('[data-form="dash-quick"]');
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = form.q.value.trim();
        if (!v) return;
        form.q.value = '';
        Tasks.quickAdd(v, { date: today });
        setTimeout(() => document.querySelector('[data-form="dash-quick"] input')?.focus(), 30);
      });
    },
  };

  window.TU.Dashboard = Dashboard;
})();
