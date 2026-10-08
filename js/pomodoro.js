/* =========================================================
   TaskUp — pomodoro.js
   Timer Pomodoro persistente (continua após recarregar).
   ========================================================= */
(function () {
  'use strict';

  const { U, Bus, Store, UI, Game, Sound } = window.TU;
  const Actions = window.TU.Actions;

  const MODES = {
    focus: { label: 'Foco', emoji: '🍅', color: 'var(--accent)' },
    short: { label: 'Pausa curta', emoji: '☕', color: '#10b981' },
    long: { label: 'Pausa longa', emoji: '🌴', color: '#0ea5e9' },
  };
  const R = 110;
  const CIRC = 2 * Math.PI * R;
  const BASE_TITLE = document.title || 'TaskUp';

  const P = () => Store.state.pomodoro;
  const cfg = () => Store.state.settings.pomodoro;

  const Pomodoro = {
    MODES,

    duration(mode = P().mode) {
      return Math.max(1, +cfg()[mode] || 25) * 60;
    },

    remaining() {
      const p = P();
      if (p.running && p.endAt) return Math.max(0, Math.round((p.endAt - Date.now()) / 1000));
      return p.remaining ?? Pomodoro.duration();
    },

    start() {
      const fresh = P().remaining === null || P().remaining === undefined;
      const rem = Pomodoro.remaining();
      Store.update((s) => {
        // guarda a duração real da sessão (mudar as configurações depois não altera a contagem)
        if (fresh || !s.pomodoro.length) s.pomodoro.length = rem / 60;
        s.pomodoro.running = true;
        s.pomodoro.endAt = Date.now() + rem * 1000;
        s.pomodoro.remaining = null;
      });
      Sound.play('click');
      window.TU.Notify && window.TU.Notify.schedulePomodoro();
    },

    pause() {
      const rem = Pomodoro.remaining();
      Store.update((s) => {
        s.pomodoro.running = false;
        s.pomodoro.endAt = null;
        s.pomodoro.remaining = rem;
      });
      Sound.play('click');
    },

    toggle() {
      P().running ? Pomodoro.pause() : Pomodoro.start();
    },

    reset() {
      Store.update((s) => {
        s.pomodoro.running = false;
        s.pomodoro.endAt = null;
        s.pomodoro.remaining = null;
        s.pomodoro.length = null;
      });
    },

    setMode(mode, autostart = false) {
      Store.update((s) => {
        s.pomodoro.mode = mode;
        s.pomodoro.running = false;
        s.pomodoro.endAt = null;
        s.pomodoro.remaining = null;
        s.pomodoro.length = null;
      });
      if (autostart) Pomodoro.start();
    },

    setTask(id) {
      Store.update((s) => (s.pomodoro.taskId = id || null));
    },

    startForTask(id) {
      const p = P();
      if (p.running && p.mode === 'focus' && p.taskId && p.taskId !== id) {
        // já existe foco em andamento: apenas troca a tarefa vinculada
        Pomodoro.setTask(id);
        UI.toast('Tarefa vinculada ao Pomodoro em andamento', { icon: '🍅' });
      } else {
        Store.update((s) => {
          s.pomodoro.taskId = id;
          if (!(s.pomodoro.running && s.pomodoro.mode === 'focus')) {
            s.pomodoro.mode = 'focus';
            s.pomodoro.remaining = null;
            s.pomodoro.running = false;
            s.pomodoro.endAt = null;
          }
        });
        if (!P().running) Pomodoro.start();
      }
      window.TU.App.go('pomodoro');
    },

    skip() {
      Pomodoro.finish(false);
    },

    /** Encerra a sessão atual e prepara a próxima. */
    finish(completed) {
      const p = P();
      const mode = p.mode;
      const levelBefore = Game.levelFromXp(Store.state.game.xp);
      let next = 'focus';
      let reward = null;
      const task = p.taskId ? Store.state.tasks.find((t) => t.id === p.taskId) : null;

      Store.update((s) => {
        if (mode === 'focus') {
          if (completed) {
            reward = Game.onPomodoro(s, Math.round(s.pomodoro.length || +cfg().focus));
            if (task) {
              const t = s.tasks.find((x) => x.id === task.id);
              if (t) t.pomodoros = (t.pomodoros || 0) + 1;
            }
          }
          s.pomodoro.cycle = (s.pomodoro.cycle || 0) + (completed ? 1 : 0);
          next = completed && s.pomodoro.cycle % Math.max(1, +cfg().longEvery) === 0 ? 'long' : 'short';
        }
        s.pomodoro.length = null;
        s.pomodoro.mode = next;
        s.pomodoro.running = false;
        s.pomodoro.endAt = null;
        s.pomodoro.remaining = null;
      });

      if (completed) {
        Sound.play('pomodoro');
        const title = mode === 'focus' ? '🍅 Pomodoro concluído!' : '⏰ Pausa encerrada!';
        const body = mode === 'focus' ? `Hora de uma ${MODES[next].label.toLowerCase()}. ${task ? `Foco em "${task.title}" registrado.` : ''}` : 'Bora voltar ao foco? 💪';
        window.TU.Notify && window.TU.Notify.show(title, body, { tag: 'pomodoro', toast: false });
        UI.toast(`${title} ${reward && Game.enabled('showXP') ? `+${reward.xp} XP` : ''}`, { type: mode === 'focus' ? 'xp' : 'info', icon: mode === 'focus' ? '🍅' : '⏰', duration: 5000 });
        if (mode === 'focus') {
          Game.celebrate({});
          Game.checkAchievements();
          if (task && !task.done) {
            UI.toast(`Concluiu "${task.title}"?`, { icon: '✅', duration: 8000, action: { label: 'Marcar feita', fn: () => window.TU.Tasks.get(task.id) && !window.TU.Tasks.get(task.id).done && window.TU.Tasks.toggle(task.id) } });
          }
        }
        Game.afterXp(levelBefore);
        const auto = next === 'focus' ? cfg().autoStartFocus : cfg().autoStartBreaks;
        if (auto) setTimeout(() => Pomodoro.start(), 800);
      }
    },

    /* ---------- Atualização contínua ---------- */
    tick() {
      const p = P();
      if (!p) return;
      const rem = Pomodoro.remaining();
      if (p.running && rem <= 0) {
        Pomodoro.finish(true);
        return;
      }
      const mm = U.pad(Math.floor(rem / 60));
      const ss = U.pad(rem % 60);
      const text = `${mm}:${ss}`;
      const timeEl = document.getElementById('pomo-time');
      if (timeEl && timeEl.textContent !== text) timeEl.textContent = text;
      const ring = document.getElementById('pomo-ring');
      if (ring) {
        const total = p.length ? p.length * 60 : Pomodoro.duration();
        const frac = Math.min(1, rem / total);
        ring.style.strokeDashoffset = String(CIRC * (1 - frac));
      }
      // mini chip no topo
      const chip = document.getElementById('pomo-chip');
      if (chip) {
        const show = p.running || (p.remaining !== null && p.remaining !== undefined);
        chip.hidden = !show;
        if (show) {
          chip.querySelector('.pc-time').textContent = text;
          chip.querySelector('.pc-emoji').textContent = MODES[p.mode].emoji;
          chip.classList.toggle('paused', !p.running);
        }
      }
      document.title = p.running ? `${text} · ${MODES[p.mode].label} — TaskUp` : BASE_TITLE;
    },

    /* ---------- Tela ---------- */
    render(view) {
      const s = Store.state;
      const p = P();
      const mode = MODES[p.mode];
      const today = U.today();
      const todayPomos = s.game.pomodorosByDate[today] || 0;
      const pendingTasks = Tasks().sortTasks(
        s.tasks.filter((t) => !t.done && (!t.date || t.date <= U.addDays(today, 1))),
        'date'
      );
      const task = p.taskId ? s.tasks.find((t) => t.id === p.taskId) : null;
      const every = Math.max(1, +cfg().longEvery);
      const inCycle = (p.cycle || 0) % every;

      view.innerHTML = `
        <div class="grid pomo-grid">
          <div class="card pomo-card mode-${p.mode}">
            <div class="segmented pomo-modes">
              ${Object.entries(MODES).map(([k, md]) => `<label><input type="radio" name="pmode" value="${k}" ${p.mode === k ? 'checked' : ''} data-change="pomo-mode"><span>${md.emoji} ${md.label}</span></label>`).join('')}
            </div>

            <div class="pomo-ring-wrap ${p.running ? 'running' : ''}">
              <svg viewBox="0 0 260 260" class="pomo-svg" aria-hidden="true">
                <circle cx="130" cy="130" r="${R}" class="pomo-track"/>
                <circle cx="130" cy="130" r="${R}" class="pomo-progress" id="pomo-ring" style="stroke-dasharray:${CIRC};stroke-dashoffset:0"/>
              </svg>
              <div class="pomo-center">
                <span class="pomo-mode-label">${mode.emoji} ${mode.label}</span>
                <span class="pomo-time" id="pomo-time">--:--</span>
                <span class="pomo-task-label">${task ? `${task.emoji || '🎯'} ${U.escape(task.title)}` : 'Foco livre'}</span>
              </div>
            </div>

            <div class="pomo-controls">
              <button class="icon-btn lg" data-action="pomo-reset" title="Reiniciar">↺</button>
              <button class="btn btn-primary btn-xl" data-action="pomo-toggle">${p.running ? '⏸ Pausar' : '▶ Iniciar'}</button>
              <button class="icon-btn lg" data-action="pomo-skip" title="Pular">⏭</button>
            </div>

            <div class="pomo-cycle" title="Ciclo até a pausa longa">
              ${Array.from({ length: every }, (_, i) => `<span class="${i < inCycle ? 'on' : ''}">🍅</span>`).join('')}
              <small class="muted">${inCycle}/${every} até a pausa longa</small>
            </div>
          </div>

          <div class="pomo-side">
            <div class="card">
              <div class="card-head"><h3>🎯 Focar em</h3></div>
              <select class="input" data-change="pomo-task">
                <option value="">— Foco livre (sem tarefa) —</option>
                ${pendingTasks.map((t) => `<option value="${t.id}" ${t.id === p.taskId ? 'selected' : ''}>${t.emoji || Store.category(t.categoryId).emoji} ${U.escape(t.title)}${t.time ? ' · ' + t.time : ''}</option>`).join('')}
                ${task && !pendingTasks.includes(task) ? `<option value="${task.id}" selected>${U.escape(task.title)}</option>` : ''}
              </select>
              ${task ? `<div class="row between mt"><span class="muted small">🍅 ${task.pomodoros || 0} pomodoros nesta tarefa</span>${!task.done ? `<button class="btn btn-sm btn-success" data-action="toggle-task" data-id="${task.id}">✓ Concluir tarefa</button>` : '<span class="pill pill-success">Concluída</span>'}</div>` : ''}
            </div>

            <div class="card">
              <div class="card-head"><h3>📊 Hoje</h3></div>
              <div class="stat-row">
                <div><strong>${todayPomos}</strong><span class="muted small">pomodoros</span></div>
                <div><strong>${U.formatDuration((s.game.focusByDate || {})[today] || 0) || '0 min'}</strong><span class="muted small">de foco</span></div>
                <div><strong>${s.game.totalPomodoros}</strong><span class="muted small">no total</span></div>
              </div>
            </div>

            <div class="card">
              <div class="card-head"><h3>⚙️ Durações</h3><button class="link-btn" data-action="go" data-view="settings" data-anchor="pomodoro">editar</button></div>
              <p class="muted small">Foco ${cfg().focus} min · Pausa curta ${cfg().short} min · Pausa longa ${cfg().long} min a cada ${every} focos.</p>
              <ul class="tips">
                <li>📵 Silencie o celular e feche abas que distraem.</li>
                <li>💧 Use as pausas para beber água e alongar.</li>
                <li>🧠 Uma tarefa por vez — multitarefa é ilusão!</li>
              </ul>
            </div>
          </div>
        </div>`;
      Pomodoro.tick();
    },
  };

  const Tasks = () => window.TU.Tasks;

  Actions['pomo-toggle'] = () => Pomodoro.toggle();
  Actions['pomo-reset'] = () => Pomodoro.reset();
  Actions['pomo-skip'] = async () => {
    const p = P();
    if (p.running || p.remaining !== null) {
      const ok = await UI.confirm({ title: 'Pular esta sessão?', text: 'Ela não contará como concluída.', okText: 'Pular', icon: '⏭' });
      if (!ok) return;
    }
    Pomodoro.skip();
  };
  Actions['pomo-task'] = (el) => Pomodoro.startForTask(el.dataset.id);
  Actions['pomo-chip'] = () => window.TU.App.go('pomodoro');

  window.TU.Changes = window.TU.Changes || {};
  window.TU.Changes['pomo-mode'] = async (el) => {
    const p = P();
    if (p.running) {
      const ok = await UI.confirm({ title: 'Trocar de modo?', text: 'Isso interrompe o timer atual.', okText: 'Trocar', icon: '🍅' });
      if (!ok) {
        Bus.emit('rerender');
        return;
      }
    }
    Pomodoro.setMode(el.value);
  };
  window.TU.Changes['pomo-task'] = (el) => Pomodoro.setTask(el.value);

  window.TU.Pomodoro = Pomodoro;
})();
