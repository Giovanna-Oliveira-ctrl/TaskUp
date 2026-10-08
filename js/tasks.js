/* =========================================================
   TaskUp — tasks.js
   Tarefas: CRUD, recorrência, subtarefas, formulário,
   adição rápida com linguagem natural e tela "Tarefas".
   ========================================================= */
(function () {
  'use strict';

  const { U, Bus, Store, UI, Game, Sound } = window.TU;
  const Actions = (window.TU.Actions = window.TU.Actions || {});

  const PRIORITIES = {
    high: { label: 'Alta', emoji: '🔴', order: 0 },
    medium: { label: 'Média', emoji: '🟡', order: 1 },
    low: { label: 'Baixa', emoji: '🟢', order: 2 },
  };
  const RECURRENCE = {
    none: 'Não repete',
    daily: 'Todos os dias',
    weekdays: 'Dias úteis (seg–sex)',
    weekly: 'Toda semana',
    monthly: 'Todo mês',
    yearly: 'Todo ano',
  };
  const REMINDERS = [
    [null, 'Sem lembrete'],
    [0, 'Na hora'],
    [5, '5 min antes'],
    [10, '10 min antes'],
    [15, '15 min antes'],
    [30, '30 min antes'],
    [60, '1 hora antes'],
    [120, '2 horas antes'],
    [1440, '1 dia antes'],
  ];

  /* ---------------- Consultas ---------------- */
  function isOverdue(t, now = new Date()) {
    if (t.done || !t.date) return false;
    const due = U.dueDate(t);
    return due < now;
  }

  function sortTasks(list, by = 'date') {
    const pr = (t) => PRIORITIES[t.priority]?.order ?? 1;
    const dt = (t) => (t.date ? t.date + ' ' + (t.time || '99:99') : '9999');
    return list.slice().sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (by === 'priority') return pr(a) - pr(b) || dt(a).localeCompare(dt(b));
      if (by === 'created') return b.createdAt.localeCompare(a.createdAt);
      if (by === 'title') return a.title.localeCompare(b.title, 'pt-BR');
      return dt(a).localeCompare(dt(b)) || pr(a) - pr(b);
    });
  }

  function forDate(key) {
    return Store.state.tasks.filter((t) => t.date === key);
  }

  function dayStats(key = U.today()) {
    const list = forDate(key);
    const done = list.filter((t) => t.done).length;
    return { total: list.length, done, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
  }

  /* ---------------- Recorrência ---------------- */
  function nextDate(task) {
    const base = task.date || U.today();
    switch (task.recurrence) {
      case 'daily':
        return U.addDays(base, 1);
      case 'weekdays': {
        let d = U.addDays(base, 1);
        while ([0, 6].includes(U.parseDateKey(d).getDay())) d = U.addDays(d, 1);
        return d;
      }
      case 'weekly':
        return U.addDays(base, 7);
      case 'monthly':
        return U.addMonths(base, 1);
      case 'yearly':
        return U.addMonths(base, 12);
      default:
        return null;
    }
  }

  /* ---------------- Mutations ---------------- */
  const Tasks = {
    PRIORITIES,
    RECURRENCE,
    REMINDERS,
    isOverdue,
    sortTasks,
    forDate,
    dayStats,
    filters: { status: 'pending', category: 'all', priority: 'all', q: '', sort: 'date' },
    showDone: false,

    get(id) {
      return Store.state.tasks.find((t) => t.id === id);
    },

    create(data) {
      const task = Store.normalizeTask({ ...data, id: U.uid(), createdAt: new Date().toISOString() });
      Store.update((s) => {
        s.tasks.push(task);
        Game.onTaskCreated();
      });
      return task;
    },

    update(id, patch) {
      Store.update((s) => {
        const t = s.tasks.find((x) => x.id === id);
        if (!t) return;
        // se data/hora mudou, permite notificar de novo
        if ((patch.date !== undefined && patch.date !== t.date) || (patch.time !== undefined && patch.time !== t.time)) {
          Object.keys(s.notified).forEach((k) => k.startsWith(id + '|') && delete s.notified[k]);
        }
        Object.assign(t, patch);
      });
    },

    remove(id, { undo = true } = {}) {
      const s = Store.state;
      const idx = s.tasks.findIndex((t) => t.id === id);
      if (idx < 0) return;
      const removed = s.tasks[idx];
      Store.update((st) => st.tasks.splice(idx, 1));
      if (Store.state.pomodoro.taskId === id) Store.update((st) => (st.pomodoro.taskId = null), { silent: true });
      if (undo) {
        UI.toast(`"${removed.title}" excluída`, {
          icon: '🗑️',
          action: {
            label: 'Desfazer',
            fn: () => Store.update((st) => st.tasks.splice(Math.min(idx, st.tasks.length), 0, removed)),
          },
          duration: 5000,
        });
      }
    },

    toggle(id, origin) {
      const t = Tasks.get(id);
      if (!t) return;
      const levelBefore = Game.levelFromXp(Store.state.game.xp);
      if (!t.done) {
        let reward = { xp: 0, coins: 0 };
        let allDone = false;
        Store.update((s) => {
          const task = s.tasks.find((x) => x.id === id);
          task.done = true;
          task.completedAt = new Date().toISOString();
          reward = Game.onTaskCompleted(s, task);
          task.xpAwarded = reward.xp;
          task.coinsAwarded = reward.coins;
          // marca subtarefas restantes como feitas
          task.subtasks.forEach((st) => (st.done = true));
          // recorrência: cria a próxima ocorrência
          if (task.recurrence && task.recurrence !== 'none' && !task.spawnedNext) {
            const nd = nextDate(task);
            if (nd) {
              const next = Store.normalizeTask({
                ...task,
                id: U.uid(),
                date: nd,
                done: false,
                completedAt: null,
                createdAt: new Date().toISOString(),
                pomodoros: 0,
                xpAwarded: 0,
                coinsAwarded: 0,
                spawnedNext: null,
                subtasks: task.subtasks.map((st) => ({ ...st, id: U.uid(), done: false })),
              });
              s.tasks.push(next);
              task.spawnedNext = next.id;
            }
          }
          const today = s.tasks.filter((x) => x.date === U.today());
          allDone = task.date === U.today() && today.length >= 3 && today.every((x) => x.done);
        });
        Game.feedbackComplete({ xp: reward.xp, levelBefore, origin, allDone });
      } else {
        Store.update((s) => {
          const task = s.tasks.find((x) => x.id === id);
          Game.onTaskUncompleted(s, task);
          task.done = false;
          task.completedAt = null;
          task.xpAwarded = 0;
          task.coinsAwarded = 0;
          // remove a próxima ocorrência gerada se ainda não foi mexida
          if (task.spawnedNext) {
            const i = s.tasks.findIndex((x) => x.id === task.spawnedNext && !x.done);
            if (i >= 0) s.tasks.splice(i, 1);
            task.spawnedNext = null;
          }
        });
        Sound.play('undo');
        Bus.emit('game');
      }
    },

    toggleSubtask(taskId, subId) {
      let delta = 0;
      Store.update((s) => {
        const t = s.tasks.find((x) => x.id === taskId);
        const st = t && t.subtasks.find((x) => x.id === subId);
        if (!st) return;
        st.done = !st.done;
        delta = st.done ? 1 : -1;
        Game.onSubtaskCompleted(s, delta);
      });
      Sound.play(delta > 0 ? 'click' : 'undo');
      const t = Tasks.get(taskId);
      if (t && !t.done && t.subtasks.length && t.subtasks.every((x) => x.done)) {
        UI.toast('Todas as subtarefas feitas! Concluir a tarefa?', {
          icon: '🧩',
          action: { label: 'Concluir', fn: () => Tasks.toggle(taskId) },
        });
      }
    },

    duplicate(id) {
      const t = Tasks.get(id);
      if (!t) return;
      Tasks.create({ ...t, title: t.title + ' (cópia)', done: false, completedAt: null, pomodoros: 0, xpAwarded: 0, coinsAwarded: 0, spawnedNext: null, subtasks: t.subtasks.map((s) => ({ ...s, id: U.uid(), done: false })) });
      UI.toast('Tarefa duplicada', { icon: '📄' });
    },

    /* ---------------- Adição rápida ---------------- */
    parseQuick(text) {
      let t = ' ' + text + ' ';
      const out = { date: null, time: null, priority: 'medium', categoryId: null };
      const norm = (x) => U.normalize(x);
      const today = U.today();

      // prioridade
      t = t.replace(/\s!(alta|urgente|high|!!)(?=\s)/gi, () => ((out.priority = 'high'), ' '));
      t = t.replace(/\s!(baixa|low)(?=\s)/gi, () => ((out.priority = 'low'), ' '));
      t = t.replace(/\s!(media|média|medium)(?=\s)/gi, () => ((out.priority = 'medium'), ' '));

      // categoria #nome
      t = t.replace(/\s#([\p{L}\p{N}_-]+)/giu, (m, name) => {
        const cat = Store.state.categories.find((c) => norm(c.name).startsWith(norm(name)));
        if (cat) {
          out.categoryId = cat.id;
          return ' ';
        }
        return m;
      });

      // datas relativas
      const rel = [
        [/\s(depois de amanh[ãa])(?=\s)/i, 2],
        [/\s(amanh[ãa])(?=\s)/i, 1],
        [/\s(hoje)(?=\s)/i, 0],
      ];
      for (const [re, n] of rel) {
        if (re.test(t)) {
          out.date = U.addDays(today, n);
          t = t.replace(re, ' ');
          break;
        }
      }
      // dia da semana
      if (!out.date) {
        const days = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
        const re = /\s(?:na |no |n[ao]s? )?(domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado)(?:-feira)?(?=\s)/i;
        const m = t.match(re);
        if (m) {
          const target = days.indexOf(norm(m[1]));
          const cur = new Date().getDay();
          let diff = (target - cur + 7) % 7;
          if (diff === 0) diff = 7;
          out.date = U.addDays(today, diff);
          t = t.replace(re, ' ');
        }
      }
      // dd/mm
      if (!out.date) {
        const m = t.match(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/);
        if (m) {
          const now = new Date();
          let y = m[3] ? +m[3] : now.getFullYear();
          if (y < 100) y += 2000;
          const d = new Date(y, +m[2] - 1, +m[1]);
          if (!m[3] && U.dateKey(d) < today) d.setFullYear(y + 1);
          if (!isNaN(d)) {
            out.date = U.dateKey(d);
            t = t.replace(m[0], ' ');
          }
        }
      }
      // horário: 14h, 14:30, 9h30, às 8
      const tm = t.match(/\s(?:[àa]s\s)?(\d{1,2})(?::(\d{2})|h(\d{2})?)(?=\s)/i);
      if (tm) {
        const h = +tm[1];
        const mi = +(tm[2] || tm[3] || 0);
        if (h < 24 && mi < 60) {
          out.time = `${U.pad(h)}:${U.pad(mi)}`;
          t = t.replace(tm[0], ' ');
        }
      }
      out.title = t.replace(/\s+/g, ' ').trim();
      return out;
    },

    quickAdd(text, defaults = {}) {
      const p = Tasks.parseQuick(text);
      if (!p.title) return null;
      const task = Tasks.create({
        title: p.title,
        priority: p.priority,
        categoryId: p.categoryId || defaults.categoryId || 'cat-outros',
        date: p.date || defaults.date || U.today(),
        time: p.time || defaults.time || null,
        reminder: p.time ? Store.state.settings.defaultReminder : null,
      });
      Sound.play('click');
      UI.toast(`Tarefa criada: ${task.title}`, { type: 'success', icon: '📝', duration: 2200 });
      return task;
    },

    /* ---------------- Renderização de item ---------------- */
    itemHtml(t, { showDate = true, compact = false } = {}) {
      const cat = Store.category(t.categoryId);
      const overdue = isOverdue(t);
      const subDone = t.subtasks.filter((s) => s.done).length;
      const meta = [];
      meta.push(`<span class="chip" style="--c:${cat.color}">${cat.emoji} ${U.escape(cat.name)}</span>`);
      if (showDate && t.date) meta.push(`<span class="meta ${overdue ? 'danger' : ''}">📅 ${U.formatDateHuman(t.date)}</span>`);
      if (t.time) meta.push(`<span class="meta ${overdue ? 'danger' : ''}">🕒 ${t.time}</span>`);
      if (t.subtasks.length) meta.push(`<span class="meta">🧩 ${subDone}/${t.subtasks.length}</span>`);
      if (t.recurrence && t.recurrence !== 'none') meta.push(`<span class="meta" title="${RECURRENCE[t.recurrence]}">🔁</span>`);
      if (t.reminder !== null && t.reminder !== undefined && t.time) meta.push(`<span class="meta" title="Lembrete">🔔</span>`);
      if (t.pomodoros) meta.push(`<span class="meta">🍅 ${t.pomodoros}</span>`);
      if (overdue) meta.push(`<span class="pill pill-danger">Atrasada</span>`);

      return `
        <div class="task-item prio-${t.priority} ${t.done ? 'done' : ''} ${overdue ? 'overdue' : ''} ${compact ? 'compact' : ''}" data-id="${t.id}" style="--cat:${cat.color}">
          <button class="check" data-action="toggle-task" data-id="${t.id}" aria-label="${t.done ? 'Desmarcar' : 'Concluir'} tarefa"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
          <div class="task-body" data-action="edit-task" data-id="${t.id}" tabindex="0" role="button">
            <div class="task-title">${t.emoji ? `<span class="task-emoji">${t.emoji}</span>` : ''}<span>${U.escape(t.title)}</span><span class="prio-dot" title="Prioridade ${PRIORITIES[t.priority].label}"></span></div>
            <div class="task-meta">${meta.join('')}</div>
          </div>
          <div class="task-actions">
            ${!t.done ? `<button class="icon-btn" data-action="pomo-task" data-id="${t.id}" title="Iniciar Pomodoro">🍅</button>` : ''}
            <button class="icon-btn" data-action="task-menu" data-id="${t.id}" title="Mais opções">⋯</button>
          </div>
        </div>`;
    },

    /* ---------------- Formulário ---------------- */
    openForm({ id = null, defaults = {} } = {}) {
      const s = Store.state;
      const editing = id ? Tasks.get(id) : null;
      const t = editing ? JSON.parse(JSON.stringify(editing)) : Store.normalizeTask({ date: U.today(), reminder: null, ...defaults });
      if (!editing && t.time && (defaults.reminder === undefined)) t.reminder = s.settings.defaultReminder;
      let subtasks = t.subtasks.map((x) => ({ ...x }));

      const catOptions = s.categories.map((c) => `<option value="${c.id}" ${c.id === t.categoryId ? 'selected' : ''}>${c.emoji} ${U.escape(c.name)}</option>`).join('');

      const m = UI.modal({
        title: editing ? 'Editar tarefa' : 'Nova tarefa',
        size: 'md',
        body: `
          <form class="form task-form" autocomplete="off">
            <div class="field-row title-row">
              ${UI.emojiPicker(t.emoji)}
              <input class="input input-lg" name="title" placeholder="O que você precisa fazer?" value="${U.escape(t.title === 'Tarefa' && !editing ? '' : t.title)}" required maxlength="200" autofocus>
            </div>

            <div class="field">
              <label>Prioridade</label>
              <div class="segmented">
                ${Object.entries(PRIORITIES).reverse().map(([k, p]) => `
                  <label><input type="radio" name="priority" value="${k}" ${t.priority === k ? 'checked' : ''}><span>${p.emoji} ${p.label}</span></label>`).join('')}
              </div>
            </div>

            <div class="grid two tight">
              <div class="field">
                <label for="f-cat">Categoria</label>
                <select id="f-cat" name="categoryId" class="input">${catOptions}</select>
              </div>
              <div class="field">
                <label for="f-rec">Repetir</label>
                <select id="f-rec" name="recurrence" class="input">
                  ${Object.entries(RECURRENCE).map(([k, v]) => `<option value="${k}" ${t.recurrence === k ? 'selected' : ''}>${v}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label for="f-date">Data</label>
                <div class="input-group">
                  <input id="f-date" type="date" name="date" class="input" value="${t.date || ''}">
                </div>
                <div class="quick-dates">
                  <button type="button" class="link-btn" data-qd="0">Hoje</button>
                  <button type="button" class="link-btn" data-qd="1">Amanhã</button>
                  <button type="button" class="link-btn" data-qd="7">+1 semana</button>
                  <button type="button" class="link-btn" data-qd="none">Sem data</button>
                </div>
              </div>
              <div class="field">
                <label for="f-time">Horário</label>
                <input id="f-time" type="time" name="time" class="input" value="${t.time || ''}">
                <div class="quick-dates"><button type="button" class="link-btn" data-qt="clear">Sem horário</button></div>
              </div>
              <div class="field">
                <label for="f-dur">Duração</label>
                <select id="f-dur" name="duration" class="input">
                  ${[5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240].map((d) => `<option value="${d}" ${+t.duration === d ? 'selected' : ''}>${U.formatDuration(d)}</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label for="f-rem">Lembrete</label>
                <select id="f-rem" name="reminder" class="input">
                  ${REMINDERS.map(([v, l]) => `<option value="${v === null ? '' : v}" ${t.reminder === v ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="field">
              <label>Subtarefas</label>
              <ul class="subtask-editor"></ul>
              <div class="input-group">
                <input class="input" data-new-sub placeholder="Adicionar subtarefa e pressionar Enter">
                <button type="button" class="btn" data-add-sub>Adicionar</button>
              </div>
            </div>

            <div class="field">
              <label for="f-notes">Notas</label>
              <textarea id="f-notes" name="notes" class="input" rows="3" placeholder="Detalhes, links, observações...">${U.escape(t.notes)}</textarea>
            </div>

            ${editing ? `<p class="muted small">Criada em ${new Date(editing.createdAt).toLocaleString('pt-BR')}${editing.completedAt ? ` · concluída em ${new Date(editing.completedAt).toLocaleString('pt-BR')}` : ''}${editing.pomodoros ? ` · ${editing.pomodoros} 🍅` : ''}</p>` : ''}

            <div class="form-actions">
              ${editing ? `<button type="button" class="btn btn-ghost danger" data-del>🗑️ Excluir</button>` : '<span></span>'}
              <div class="row gap">
                <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
                <button type="submit" class="btn btn-primary">${editing ? 'Salvar' : 'Criar tarefa'}</button>
              </div>
            </div>
          </form>`,
        onMount(el, api) {
          UI.bindEmojiPicker(el);
          const form = el.querySelector('form');
          const list = el.querySelector('.subtask-editor');
          const newSub = el.querySelector('[data-new-sub]');

          const renderSubs = () => {
            list.innerHTML = subtasks
              .map(
                (st, i) => `<li>
                <label class="mini-check"><input type="checkbox" data-sub-done="${i}" ${st.done ? 'checked' : ''}><span></span></label>
                <input class="input input-sm" data-sub-title="${i}" value="${U.escape(st.title)}">
                <button type="button" class="icon-btn" data-sub-rm="${i}" aria-label="Remover">✕</button>
              </li>`
              )
              .join('');
          };
          renderSubs();
          const addSub = () => {
            const v = newSub.value.trim();
            if (!v) return;
            subtasks.push({ id: U.uid(), title: v, done: false });
            newSub.value = '';
            renderSubs();
            newSub.focus();
          };
          el.querySelector('[data-add-sub]').onclick = addSub;
          newSub.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSub();
            }
          });
          list.addEventListener('input', (e) => {
            const i = e.target.dataset.subTitle;
            if (i !== undefined) subtasks[i].title = e.target.value;
          });
          list.addEventListener('change', (e) => {
            const i = e.target.dataset.subDone;
            if (i !== undefined) subtasks[i].done = e.target.checked;
          });
          list.addEventListener('click', (e) => {
            const b = e.target.closest('[data-sub-rm]');
            if (b) {
              subtasks.splice(+b.dataset.subRm, 1);
              renderSubs();
            }
          });

          el.querySelectorAll('[data-qd]').forEach((b) =>
            b.addEventListener('click', () => {
              form.date.value = b.dataset.qd === 'none' ? '' : U.addDays(U.today(), +b.dataset.qd);
            })
          );
          el.querySelector('[data-qt]').onclick = () => (form.time.value = '');
          form.time.addEventListener('change', () => {
            if (form.time.value && form.reminder.value === '') form.reminder.value = String(s.settings.defaultReminder ?? '');
            if (form.time.value && !form.date.value) form.date.value = U.today();
          });
          el.querySelector('[data-cancel]').onclick = () => api.close();
          const del = el.querySelector('[data-del]');
          if (del) {
            del.onclick = async () => {
              const ok = await UI.confirm({ title: 'Excluir tarefa?', text: U.escape(editing.title), okText: 'Excluir', danger: true, icon: '🗑️' });
              if (ok) {
                api.close();
                Tasks.remove(editing.id);
              }
            };
          }

          form.addEventListener('submit', (e) => {
            e.preventDefault();
            const d = UI.formData(form);
            if (!d.title) return form.title.focus();
            const data = {
              title: d.title,
              emoji: d.emoji || '',
              priority: d.priority || 'medium',
              categoryId: d.categoryId,
              recurrence: d.recurrence,
              date: d.date || null,
              time: d.time || null,
              duration: +d.duration || 30,
              reminder: d.reminder === '' ? null : +d.reminder,
              notes: d.notes || '',
              subtasks: subtasks.filter((x) => x.title.trim()),
            };
            if (data.recurrence !== 'none' && !data.date) data.date = U.today();
            if (editing) {
              Tasks.update(editing.id, data);
              UI.toast('Tarefa atualizada', { type: 'success', duration: 1800 });
            } else {
              Tasks.create(data);
              Sound.play('click');
              UI.toast(`Tarefa criada: ${data.title}`, { type: 'success', icon: '📝', duration: 2200 });
            }
            api.close();
          });
        },
      });
      return m;
    },

    openMenu(id, anchor) {
      const t = Tasks.get(id);
      if (!t) return;
      document.querySelectorAll('.popover').forEach((p) => p.remove());
      const pop = document.createElement('div');
      pop.className = 'popover';
      pop.innerHTML = `
        <button data-m="edit">✏️ Editar</button>
        ${!t.done ? '<button data-m="pomo">🍅 Iniciar Pomodoro</button>' : ''}
        <button data-m="today">📅 Mover para hoje</button>
        <button data-m="tomorrow">➡️ Adiar para amanhã</button>
        <button data-m="dup">📄 Duplicar</button>
        <button data-m="del" class="danger">🗑️ Excluir</button>`;
      document.body.appendChild(pop);
      const r = anchor.getBoundingClientRect();
      const pw = 210;
      pop.style.top = Math.min(r.bottom + 6, innerHeight - pop.offsetHeight - 10) + 'px';
      pop.style.left = Math.max(10, Math.min(r.right - pw, innerWidth - pw - 10)) + 'px';
      const close = () => {
        pop.remove();
        document.removeEventListener('mousedown', outside, true);
      };
      const outside = (e) => !pop.contains(e.target) && close();
      setTimeout(() => document.addEventListener('mousedown', outside, true));
      pop.addEventListener('click', (e) => {
        const b = e.target.closest('[data-m]');
        if (!b) return;
        close();
        const a = b.dataset.m;
        if (a === 'edit') Tasks.openForm({ id });
        if (a === 'pomo') window.TU.Pomodoro.startForTask(id);
        if (a === 'today') Tasks.update(id, { date: U.today() });
        if (a === 'tomorrow') {
          Tasks.update(id, { date: U.addDays(t.date && t.date > U.today() ? t.date : U.today(), 1) });
          UI.toast('Adiada para amanhã', { icon: '➡️', duration: 1800 });
        }
        if (a === 'dup') Tasks.duplicate(id);
        if (a === 'del') Tasks.remove(id);
      });
    },

    /* ---------------- Tela "Tarefas" ---------------- */
    render(view) {
      const s = Store.state;
      const f = Tasks.filters;
      const today = U.today();
      const q = U.normalize(f.q);

      let list = s.tasks.filter((t) => {
        if (f.category !== 'all' && t.categoryId !== f.category) return false;
        if (f.priority !== 'all' && t.priority !== f.priority) return false;
        if (q && !U.normalize(t.title + ' ' + t.notes + ' ' + t.subtasks.map((x) => x.title).join(' ')).includes(q)) return false;
        switch (f.status) {
          case 'pending':
            return !t.done;
          case 'today':
            return t.date === today;
          case 'upcoming':
            return !t.done && t.date && t.date > today;
          case 'overdue':
            return isOverdue(t);
          case 'done':
            return t.done;
          case 'nodate':
            return !t.date;
          default:
            return true;
        }
      });
      list = sortTasks(list, f.sort);

      const counts = {
        all: s.tasks.length,
        pending: s.tasks.filter((t) => !t.done).length,
        today: s.tasks.filter((t) => t.date === today).length,
        upcoming: s.tasks.filter((t) => !t.done && t.date && t.date > today).length,
        overdue: s.tasks.filter((t) => isOverdue(t)).length,
        nodate: s.tasks.filter((t) => !t.date).length,
        done: s.tasks.filter((t) => t.done).length,
      };
      const statusLabels = { pending: 'Pendentes', today: 'Hoje', upcoming: 'Próximas', overdue: 'Atrasadas', nodate: 'Sem data', done: 'Concluídas', all: 'Todas' };

      // agrupamento
      let groupsHtml = '';
      if (!list.length) {
        groupsHtml = `<div class="empty-state">
          <div class="empty-emoji">${f.status === 'overdue' ? '🎉' : '🪴'}</div>
          <h3>${f.status === 'overdue' ? 'Nada atrasado!' : q ? 'Nada encontrado' : 'Nenhuma tarefa aqui'}</h3>
          <p class="muted">${q ? 'Tente outra busca ou limpe os filtros.' : 'Use a barra acima para adicionar algo rapidinho.'}</p>
        </div>`;
      } else if (f.sort === 'date' && !['done'].includes(f.status)) {
        const groups = [
          ['⚠️ Atrasadas', (t) => isOverdue(t)],
          ['☀️ Hoje', (t) => t.date === today],
          ['🌤️ Amanhã', (t) => t.date === U.addDays(today, 1)],
          ['📆 Próximos dias', (t) => t.date && t.date > U.addDays(today, 1)],
          ['📭 Sem data', (t) => !t.date],
          ['🕰️ Anteriores', () => true],
        ];
        const used = new Set();
        groups.forEach(([label, fn]) => {
          const items = list.filter((t) => !used.has(t.id) && fn(t));
          items.forEach((t) => used.add(t.id));
          if (items.length) {
            groupsHtml += `<section class="task-group"><h4 class="group-title">${label} <span class="count">${items.length}</span></h4>
              <div class="task-list">${items.map((t) => Tasks.itemHtml(t, { showDate: !label.includes('Hoje') })).join('')}</div></section>`;
          }
        });
      } else if (f.sort === 'category') {
        s.categories.forEach((c) => {
          const items = list.filter((t) => t.categoryId === c.id);
          if (items.length)
            groupsHtml += `<section class="task-group"><h4 class="group-title">${c.emoji} ${U.escape(c.name)} <span class="count">${items.length}</span></h4>
              <div class="task-list">${items.map((t) => Tasks.itemHtml(t)).join('')}</div></section>`;
        });
      } else {
        groupsHtml = `<div class="task-list">${list.map((t) => Tasks.itemHtml(t)).join('')}</div>`;
      }

      view.innerHTML = `
        <div class="card quick-add-card">
          <form class="quick-add" data-form="quick-add">
            <span class="qa-icon">✨</span>
            <input class="input" name="q" placeholder='Ex.: "Pagar conta amanhã 10h #financeiro !alta"' autocomplete="off" aria-label="Adicionar tarefa rápida">
            <button class="btn btn-primary" type="submit">Adicionar</button>
            <button class="btn" type="button" data-action="new-task" title="Formulário completo">⚙️ Detalhes</button>
          </form>
          <p class="muted small qa-hint">Dica: use <code>hoje</code>, <code>amanhã</code>, <code>sexta</code>, <code>25/12</code>, <code>14h</code>, <code>#categoria</code> e <code>!alta</code> / <code>!baixa</code>.</p>
        </div>

        <div class="filters">
          <div class="chips-scroll">
            ${Object.keys(statusLabels)
              .map((k) => `<button class="filter-chip ${f.status === k ? 'active' : ''}" data-action="filter-status" data-v="${k}">${statusLabels[k]} <span>${counts[k]}</span></button>`)
              .join('')}
          </div>
          <div class="filters-row">
            <div class="search">
              <span>🔎</span>
              <input type="search" class="input" data-filter="q" placeholder="Buscar tarefas..." value="${U.escape(f.q)}">
            </div>
            <select class="input" data-filter="category" aria-label="Categoria">
              <option value="all">Todas as categorias</option>
              ${s.categories.map((c) => `<option value="${c.id}" ${f.category === c.id ? 'selected' : ''}>${c.emoji} ${U.escape(c.name)}</option>`).join('')}
            </select>
            <select class="input" data-filter="priority" aria-label="Prioridade">
              <option value="all">Qualquer prioridade</option>
              ${Object.entries(PRIORITIES).map(([k, p]) => `<option value="${k}" ${f.priority === k ? 'selected' : ''}>${p.emoji} ${p.label}</option>`).join('')}
            </select>
            <select class="input" data-filter="sort" aria-label="Ordenar">
              <option value="date" ${f.sort === 'date' ? 'selected' : ''}>Ordenar: data</option>
              <option value="priority" ${f.sort === 'priority' ? 'selected' : ''}>Ordenar: prioridade</option>
              <option value="category" ${f.sort === 'category' ? 'selected' : ''}>Agrupar: categoria</option>
              <option value="created" ${f.sort === 'created' ? 'selected' : ''}>Ordenar: mais recentes</option>
              <option value="title" ${f.sort === 'title' ? 'selected' : ''}>Ordenar: A–Z</option>
            </select>
            ${f.category !== 'all' || f.priority !== 'all' || f.q ? '<button class="btn btn-ghost" data-action="clear-filters">Limpar filtros</button>' : ''}
          </div>
        </div>

        <div class="tasks-wrap">${groupsHtml}</div>
        ${f.status === 'done' && counts.done ? '<div class="center mt"><button class="btn btn-ghost danger" data-action="clear-done">🧹 Apagar todas as concluídas</button></div>' : ''}
      `;

      const qa = view.querySelector('[data-form="quick-add"]');
      qa.addEventListener('submit', (e) => {
        e.preventDefault();
        const v = qa.q.value.trim();
        if (!v) return;
        Tasks.quickAdd(v, { categoryId: f.category !== 'all' ? f.category : undefined });
        setTimeout(() => {
          const inp = document.querySelector('[data-form="quick-add"] input');
          inp && inp.focus();
        }, 30);
      });
      view.querySelectorAll('[data-filter]').forEach((el) => {
        const key = el.dataset.filter;
        const handler = () => {
          f[key] = el.value;
          if (key === 'q') {
            Tasks.renderListOnly(view);
          } else Bus.emit('rerender');
        };
        el.addEventListener(key === 'q' ? 'input' : 'change', key === 'q' ? U.debounce(handler, 180) : handler);
      });
    },

    /** Re-renderiza preservando o foco no campo de busca. */
    renderListOnly(view) {
      const pos = view.querySelector('[data-filter="q"]')?.selectionStart;
      Tasks.render(view);
      const inp = view.querySelector('[data-filter="q"]');
      if (inp) {
        inp.focus();
        try {
          inp.setSelectionRange(pos, pos);
        } catch (_) {}
      }
    },
  };

  /* ---------------- Ações (delegação global) ---------------- */
  Actions['toggle-task'] = (el) => {
    const r = el.getBoundingClientRect();
    el.closest('.task-item')?.classList.add('just-toggled');
    Tasks.toggle(el.dataset.id, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };
  Actions['edit-task'] = (el) => Tasks.openForm({ id: el.dataset.id });
  Actions['new-task'] = (el) => {
    const d = {};
    if (el.dataset.date) d.date = el.dataset.date;
    if (el.dataset.time) d.time = el.dataset.time;
    if (el.dataset.category) d.categoryId = el.dataset.category;
    Tasks.openForm({ defaults: d });
  };
  Actions['task-menu'] = (el) => Tasks.openMenu(el.dataset.id, el);
  Actions['delete-task'] = (el) => Tasks.remove(el.dataset.id);
  Actions['toggle-sub'] = (el) => Tasks.toggleSubtask(el.dataset.task, el.dataset.sub);
  Actions['filter-status'] = (el) => {
    Tasks.filters.status = el.dataset.v;
    Bus.emit('rerender');
  };
  Actions['clear-filters'] = () => {
    Object.assign(Tasks.filters, { category: 'all', priority: 'all', q: '' });
    Bus.emit('rerender');
  };
  Actions['clear-done'] = async () => {
    const n = Store.state.tasks.filter((t) => t.done).length;
    const ok = await UI.confirm({ title: `Apagar ${n} tarefas concluídas?`, text: 'Seu XP e histórico continuam salvos.', okText: 'Apagar', danger: true, icon: '🧹' });
    if (ok) Store.update((s) => (s.tasks = s.tasks.filter((t) => !t.done)));
  };

  window.TU.Tasks = Tasks;
})();
