/* =========================================================
   TaskUp — routine.js
   "Minha Rotina": linha do tempo das atividades do dia.
   ========================================================= */
(function () {
  'use strict';

  const { U, Bus, Store, UI, Tasks } = window.TU;
  const Actions = window.TU.Actions;

  const TEMPLATES = [
    { emoji: '📚', title: 'Estudar', time: '08:00', duration: 60, categoryId: 'cat-escola' },
    { emoji: '💼', title: 'Reunião', time: '09:30', duration: 60, categoryId: 'cat-trabalho' },
    { emoji: '🍽️', title: 'Almoço', time: '12:00', duration: 60, categoryId: 'cat-pessoal' },
    { emoji: '💻', title: 'Projeto', time: '14:00', duration: 120, categoryId: 'cat-projetos' },
    { emoji: '🏃', title: 'Exercício', time: '18:00', duration: 45, categoryId: 'cat-saude' },
    { emoji: '💧', title: 'Beber água', time: '10:00', duration: 5, categoryId: 'cat-saude' },
    { emoji: '🧘', title: 'Meditar', time: '07:00', duration: 10, categoryId: 'cat-saude' },
    { emoji: '📖', title: 'Leitura', time: '21:00', duration: 30, categoryId: 'cat-pessoal' },
    { emoji: '😴', title: 'Dormir', time: '23:00', duration: 5, categoryId: 'cat-pessoal' },
  ];

  const Routine = {
    date: null,

    render(view) {
      const s = Store.state;
      const date = (Routine.date = Routine.date || U.today());
      const isToday = date === U.today();
      const all = Tasks.forDate(date);
      const timed = all.filter((t) => t.time).sort((a, b) => a.time.localeCompare(b.time));
      const untimed = Tasks.sortTasks(all.filter((t) => !t.time), 'priority');
      const st = Tasks.dayStats(date);
      const now = U.nowMinutes();

      let rows = '';
      let nowPlaced = !isToday;
      const nowLine = `<div class="tl-now" id="tl-now"><span>${U.nowTime()}</span><i></i><b>agora</b></div>`;
      let prevEnd = null;

      timed.forEach((t) => {
        const start = U.timeToMinutes(t.time);
        const end = start + (+t.duration || 0);
        if (!nowPlaced && now < start) {
          rows += nowLine;
          nowPlaced = true;
        }
        // intervalo livre entre atividades
        if (prevEnd !== null && start - prevEnd >= 60) {
          rows += `<button class="tl-gap" data-action="new-task" data-date="${date}" data-time="${U.minutesToTime(prevEnd)}">☕ ${U.formatDuration(start - prevEnd)} livres — adicionar algo?</button>`;
        }
        prevEnd = Math.max(prevEnd || 0, end);

        const cat = Store.category(t.categoryId);
        const current = isToday && !t.done && now >= start && now < Math.max(end, start + 1);
        const past = isToday && !t.done && now >= end;
        rows += `
          <div class="tl-item ${t.done ? 'done' : ''} ${current ? 'current' : ''} ${past ? 'late' : ''}" style="--cat:${cat.color}" data-id="${t.id}">
            <div class="tl-time">
              <button class="time-label" data-action="edit-time" data-id="${t.id}" title="Alterar horário">${t.time}</button>
              ${t.duration ? `<span class="tl-end">até ${U.minutesToTime(end)}</span>` : ''}
            </div>
            <div class="tl-dot"><span>${t.emoji || cat.emoji}</span></div>
            <div class="tl-card">
              <div class="tl-main" data-action="edit-task" data-id="${t.id}" role="button" tabindex="0">
                <div class="tl-title">${U.escape(t.title)} ${current ? '<span class="pill pill-live">● Agora</span>' : ''}${past ? '<span class="pill pill-danger">Atrasada</span>' : ''}</div>
                <div class="tl-meta">
                  <span class="chip" style="--c:${cat.color}">${cat.emoji} ${U.escape(cat.name)}</span>
                  ${t.duration ? `<span class="meta">⏱️ ${U.formatDuration(+t.duration)}</span>` : ''}
                  ${t.subtasks.length ? `<span class="meta">🧩 ${t.subtasks.filter((x) => x.done).length}/${t.subtasks.length}</span>` : ''}
                  ${t.recurrence !== 'none' ? '<span class="meta">🔁</span>' : ''}
                  ${t.pomodoros ? `<span class="meta">🍅 ${t.pomodoros}</span>` : ''}
                </div>
              </div>
              <div class="tl-actions">
                <button class="btn btn-sm ${t.done ? '' : 'btn-success'}" data-action="toggle-task" data-id="${t.id}">${t.done ? '↩️ Desfazer' : '✓ Concluir'}</button>
                ${!t.done ? `<button class="btn btn-sm" data-action="pomo-task" data-id="${t.id}">🍅 Pomodoro</button>` : ''}
                <button class="icon-btn" data-action="task-menu" data-id="${t.id}" title="Mais opções">⋯</button>
              </div>
            </div>
          </div>`;
      });
      if (!nowPlaced) rows += nowLine;

      view.innerHTML = `
        <div class="routine-head card">
          <div class="date-nav">
            <button class="icon-btn" data-action="routine-day" data-d="-1" aria-label="Dia anterior">‹</button>
            <div class="date-nav-label">
              <strong>${isToday ? 'Hoje' : U.formatDateHuman(date)}</strong>
              <span class="muted small">${U.formatDateLong(date)}</span>
            </div>
            <button class="icon-btn" data-action="routine-day" data-d="1" aria-label="Próximo dia">›</button>
            ${!isToday ? '<button class="btn btn-sm" data-action="routine-day" data-d="0">Hoje</button>' : ''}
            <input type="date" class="input input-sm" value="${date}" data-change="routine-date" aria-label="Escolher data">
          </div>
          <div class="routine-progress">
            <div class="row between"><span>${st.done} de ${st.total} atividades concluídas</span><strong>${st.pct}%</strong></div>
            <div class="progress"><span style="width:${st.pct}%"></span></div>
          </div>
          <button class="btn btn-primary" data-action="new-task" data-date="${date}" data-time="${isToday ? U.nextRoundHour() : '08:00'}">＋ Adicionar à rotina</button>
        </div>

        <div class="grid routine-grid">
          <div class="card timeline-card">
            <div class="card-head"><h3>🕒 Linha do tempo</h3><span class="muted small">${timed.length} com horário</span></div>
            ${timed.length ? `<div class="timeline">${rows}</div>` : `
              <div class="empty-state">
                <div class="empty-emoji">🗓️</div>
                <h3>Sua rotina está vazia</h3>
                <p class="muted">Crie atividades com horário ou use um dos modelos rápidos ao lado.</p>
              </div>`}
          </div>

          <div class="routine-side">
            <div class="card">
              <div class="card-head"><h3>📥 Sem horário</h3><span class="muted small">${untimed.length}</span></div>
              ${untimed.length ? `<div class="untimed">
                ${untimed.map((t) => {
                  const cat = Store.category(t.categoryId);
                  return `<div class="untimed-item ${t.done ? 'done' : ''}" style="--cat:${cat.color}">
                    <button class="check sm" data-action="toggle-task" data-id="${t.id}" aria-label="Concluir"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
                    <span class="untimed-title" data-action="edit-task" data-id="${t.id}">${t.emoji || cat.emoji} ${U.escape(t.title)}</span>
                    <input type="time" class="time-input sm" data-change="routine-time" data-id="${t.id}" title="Definir horário" aria-label="Definir horário">
                  </div>`;
                }).join('')}
              </div><p class="muted small">Defina um horário para colocar na linha do tempo.</p>` : '<p class="muted small">Tudo com horário definido. 👌</p>'}
            </div>

            <div class="card">
              <div class="card-head"><h3>⚡ Modelos rápidos</h3></div>
              <p class="muted small">Toque para adicionar em ${isToday ? 'hoje' : U.formatDateHuman(date).toLowerCase()}. Segure Shift para repetir todo dia.</p>
              <div class="templates">
                ${TEMPLATES.map((tp, i) => `<button class="template" data-action="routine-template" data-i="${i}">${tp.emoji} ${tp.title} <span>${tp.time}</span></button>`).join('')}
              </div>
            </div>
          </div>
        </div>`;

      // rola até "agora"
      if (isToday && Routine._scrollNow) {
        Routine._scrollNow = false;
        const n = view.querySelector('#tl-now');
        n && setTimeout(() => n.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
      }
    },
  };

  Actions['routine-day'] = (el) => {
    const d = +el.dataset.d;
    Routine.date = d === 0 ? U.today() : U.addDays(Routine.date || U.today(), d);
    Bus.emit('rerender');
  };
  Actions['routine-template'] = (el, e) => {
    const tp = TEMPLATES[+el.dataset.i];
    const date = Routine.date || U.today();
    const catId = Store.state.categories.some((c) => c.id === tp.categoryId) ? tp.categoryId : 'cat-outros';
    Tasks.create({
      title: tp.title,
      emoji: tp.emoji,
      time: tp.time,
      duration: tp.duration,
      categoryId: catId,
      date,
      reminder: Store.state.settings.defaultReminder,
      recurrence: e && e.shiftKey ? 'daily' : 'none',
    });
    UI.toast(`${tp.emoji} ${tp.title} às ${tp.time} adicionado${e && e.shiftKey ? ' (todo dia)' : ''}`, { type: 'success', duration: 2000 });
  };

  Actions['edit-time'] = (el) => {
    const t = Tasks.get(el.dataset.id);
    if (!t) return;
    const inp = document.createElement('input');
    inp.type = 'time';
    inp.className = 'time-input';
    inp.value = t.time || '';
    inp.setAttribute('aria-label', 'Alterar horário');
    el.replaceWith(inp);
    inp.focus();
    try {
      inp.showPicker && inp.showPicker();
    } catch (_) {}
    let saved = false;
    inp.addEventListener('change', () => {
      if (!inp.value || inp.value === t.time) return;
      saved = true;
      Tasks.update(t.id, { time: inp.value });
      UI.toast(`Horário alterado para ${inp.value}`, { icon: '🕒', duration: 1600 });
    });
    inp.addEventListener('keydown', (e) => e.key === 'Enter' && inp.blur());
    inp.addEventListener('blur', () => !saved && Bus.emit('rerender'));
  };

  window.TU.Changes = window.TU.Changes || {};
  window.TU.Changes['routine-time'] = (el) => {
    if (!el.value) return;
    Tasks.update(el.dataset.id, { time: el.value });
    UI.toast(`Horário alterado para ${el.value}`, { icon: '🕒', duration: 1600 });
  };
  window.TU.Changes['routine-date'] = (el) => {
    if (!el.value) return;
    Routine.date = el.value;
    Bus.emit('rerender');
  };

  window.TU.Routine = Routine;
})();
