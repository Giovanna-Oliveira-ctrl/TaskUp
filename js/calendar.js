/* =========================================================
   TaskUp — calendar.js
   Calendário mensal com tarefas por dia.
   ========================================================= */
(function () {
  'use strict';

  const { U, Bus, Store, Tasks } = window.TU;
  const Actions = window.TU.Actions;

  const Calendar = {
    month: null, // 'YYYY-MM-01'
    selected: null,

    render(view) {
      const s = Store.state;
      const today = U.today();
      Calendar.selected = Calendar.selected || today;
      Calendar.month = Calendar.month || Calendar.selected.slice(0, 8) + '01';

      const first = U.parseDateKey(Calendar.month);
      const y = first.getFullYear();
      const m = first.getMonth();
      const offset = (first.getDay() + 6) % 7; // semana começa na segunda
      const gridStart = U.addDays(Calendar.month, -offset);
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const weeks = Math.ceil((offset + daysInMonth) / 7);

      // indexa tarefas por data
      const byDate = {};
      s.tasks.forEach((t) => {
        if (t.date) (byDate[t.date] = byDate[t.date] || []).push(t);
      });

      let cells = '';
      for (let i = 0; i < weeks * 7; i++) {
        const key = U.addDays(gridStart, i);
        const d = U.parseDateKey(key);
        const list = byDate[key] || [];
        const pending = list.filter((t) => !t.done);
        const allDone = list.length && !pending.length;
        const overdue = list.some((t) => Tasks.isOverdue(t));
        const dots = list
          .slice(0, 4)
          .map((t) => `<i style="background:${Store.category(t.categoryId).color}" class="${t.done ? 'faded' : ''}"></i>`)
          .join('');
        cells += `
          <button class="cal-cell ${d.getMonth() !== m ? 'other' : ''} ${key === today ? 'today' : ''} ${key === Calendar.selected ? 'selected' : ''} ${overdue ? 'has-overdue' : ''} ${allDone ? 'all-done' : ''}"
            data-action="cal-select" data-date="${key}" aria-label="${U.formatDateLong(key)}, ${list.length} tarefas">
            <span class="cal-num">${d.getDate()}</span>
            ${list.length ? `<span class="cal-dots">${dots}${list.length > 4 ? `<b>+${list.length - 4}</b>` : ''}</span>` : ''}
            ${list.length ? `<span class="cal-count">${allDone ? '✓' : pending.length}</span>` : ''}
          </button>`;
      }

      const sel = Calendar.selected;
      const selTasks = Tasks.sortTasks(byDate[sel] || [], 'date');
      const st = Tasks.dayStats(sel);

      view.innerHTML = `
        <div class="grid cal-grid">
          <div class="card calendar-card">
            <div class="cal-head">
              <button class="icon-btn" data-action="cal-month" data-d="-1" aria-label="Mês anterior">‹</button>
              <h3>${U.MONTHS[m]} <span class="muted">${y}</span></h3>
              <button class="icon-btn" data-action="cal-month" data-d="1" aria-label="Próximo mês">›</button>
              <button class="btn btn-sm" data-action="cal-today">Hoje</button>
            </div>
            <div class="cal-weekdays">${['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map((w) => `<span>${w}</span>`).join('')}</div>
            <div class="cal-days">${cells}</div>
            <div class="cal-legend muted small">
              <span><i class="lg today"></i> hoje</span>
              <span><i class="lg overdue"></i> com atrasos</span>
              <span><i class="lg done"></i> tudo concluído</span>
            </div>
          </div>

          <div class="card day-panel">
            <div class="card-head">
              <div>
                <h3>${U.formatDateHuman(sel)}</h3>
                <span class="muted small">${U.formatDateLong(sel)}</span>
              </div>
              <button class="btn btn-sm btn-primary" data-action="new-task" data-date="${sel}">＋ Tarefa</button>
            </div>
            ${st.total ? `<div class="routine-progress"><div class="row between small"><span>${st.done} de ${st.total} concluídas</span><strong>${st.pct}%</strong></div><div class="progress"><span style="width:${st.pct}%"></span></div></div>` : ''}
            <div class="task-list">
              ${selTasks.length ? selTasks.map((t) => Tasks.itemHtml(t, { showDate: false, compact: true })).join('') : `
                <div class="empty-state small">
                  <div class="empty-emoji">🌤️</div>
                  <p class="muted">Nada planejado para este dia.</p>
                </div>`}
            </div>
            <button class="btn btn-ghost btn-block mt" data-action="open-routine-day" data-date="${sel}">🕒 Ver como rotina</button>
          </div>
        </div>`;
    },
  };

  Actions['cal-select'] = (el) => {
    Calendar.selected = el.dataset.date;
    if (Calendar.selected.slice(0, 7) !== Calendar.month.slice(0, 7)) Calendar.month = Calendar.selected.slice(0, 8) + '01';
    Bus.emit('rerender');
  };
  Actions['cal-month'] = (el) => {
    Calendar.month = U.addMonths(Calendar.month, +el.dataset.d);
    Bus.emit('rerender');
  };
  Actions['cal-today'] = () => {
    Calendar.selected = U.today();
    Calendar.month = U.today().slice(0, 8) + '01';
    Bus.emit('rerender');
  };
  Actions['open-routine-day'] = (el) => {
    window.TU.Routine.date = el.dataset.date;
    window.TU.App.go('routine');
  };

  window.TU.Calendar = Calendar;
})();
