/* =========================================================
   TaskUp — app.js
   Inicialização, navegação, tema, delegação de eventos,
   atalhos de teclado, onboarding e PWA.
   ========================================================= */
(function () {
  'use strict';

  const TU = window.TU;
  const { U, Bus, Store, UI, Tasks, Game, Pomodoro, Notify, Backup, Sound } = TU;
  const Actions = TU.Actions;
  const Changes = (TU.Changes = TU.Changes || {});

  const VIEWS = {
    dashboard: { title: 'Início', icon: '🏠', mod: () => TU.Dashboard },
    routine: { title: 'Minha Rotina', icon: '🕒', mod: () => TU.Routine },
    tasks: { title: 'Tarefas', icon: '✅', mod: () => TU.Tasks },
    calendar: { title: 'Calendário', icon: '📅', mod: () => TU.Calendar },
    pomodoro: { title: 'Pomodoro', icon: '🍅', mod: () => TU.Pomodoro },
    categories: { title: 'Categorias', icon: '🗂️', mod: () => TU.Categories },
    game: { title: 'Conquistas', icon: '🏆', mod: () => Game },
    settings: { title: 'Configurações', icon: '⚙️', mod: () => TU.Settings },
  };
  const NAV_ORDER = Object.keys(VIEWS);

  let current = 'dashboard';
  let rendered = null; // última tela desenhada
  let renderQueued = false;
  let lastDay = U.today();
  let deferredInstall = null;

  const App = {
    VIEWS,

    get current() {
      return current;
    },

    go(view, opts = {}) {
      if (!VIEWS[view]) view = 'dashboard';
      if (view === 'routine' && opts.resetDate) TU.Routine.date = U.today();
      current = view;
      // o endereço (#/tela) é só um bônus: em visualizadores restritos pode ser bloqueado
      try {
        if (location.hash !== '#/' + view) history.pushState(null, '', '#/' + view);
      } catch (_) {}
      App.render(true);
      document.body.classList.remove('menu-open');
    },

    fromHash() {
      const v = (location.hash.match(/^#\/(\w+)/) || [])[1];
      return VIEWS[v] ? v : 'dashboard';
    },

    render(scrollTop = false) {
      const view = document.getElementById('view');
      const changed = rendered !== current;
      rendered = current;
      const keepScroll = !changed && !scrollTop ? window.scrollY : 0;
      const def = VIEWS[current];
      if (changed && current === 'routine') TU.Routine._scrollNow = true;
      view.dataset.view = current;
      try {
        def.mod().render(view);
      } catch (e) {
        console.error(e);
        view.innerHTML = `<div class="card empty-state"><div class="empty-emoji">🐛</div><h3>Ops! Algo deu errado.</h3><p class="muted">${U.escape(e.message)}</p></div>`;
      }
      if (changed) {
        view.classList.remove('view-enter');
        void view.offsetWidth;
        view.classList.add('view-enter');
        window.scrollTo(0, 0);
      } else window.scrollTo(0, keepScroll);
      App.renderChrome();
    },

    queueRender() {
      if (renderQueued) return;
      renderQueued = true;
      requestAnimationFrame(() => {
        renderQueued = false;
        App.render();
      });
    },

    /** Cabeçalho, menu lateral e navegação inferior. */
    renderChrome() {
      const s = Store.state;
      const st = s.settings;
      const def = VIEWS[current];
      document.getElementById('page-title').innerHTML = `<span>${def.icon}</span> ${def.title}`;
      const today = U.today();
      const badge = {
        tasks: s.tasks.filter((t) => Tasks.isOverdue(t)).length,
        routine: s.tasks.filter((t) => t.date === today && !t.done && t.time).length,
        game: Game.enabled('missions') ? (Game.ensureMissions(), s.game.missions.list.filter((m) => !m.claimed && m.progress >= (Game.missionDef(m.id)?.target || 1)).length) : 0,
      };
      document.querySelectorAll('[data-nav]').forEach((b) => {
        const v = b.dataset.nav;
        b.classList.toggle('active', v === current);
        b.setAttribute('aria-current', v === current ? 'page' : 'false');
        const bd = b.querySelector('.nav-badge');
        if (bd) {
          const n = badge[v] || 0;
          bd.textContent = n;
          bd.hidden = !n;
          bd.classList.toggle('danger', v === 'tasks');
        }
      });

      // perfil no menu lateral
      const prof = document.getElementById('side-profile');
      if (prof) {
        if (st.gamification) {
          const li = Game.levelInfo();
          const streak = Game.computeStreak();
          prof.hidden = false;
          prof.innerHTML = `
            <div class="sp-top">
              <span class="sp-mascot">${st.mascot}</span>
              <div>
                <strong>${U.escape(st.name || 'Você')}</strong>
                <small>Nv. ${li.level} · ${li.title}</small>
              </div>
            </div>
            ${st.showXP ? `<div class="progress sm xp"><span style="width:${li.pct}%"></span></div>
            <div class="sp-stats"><span>⭐ ${li.xp} XP</span>${st.streaks ? `<span>🔥 ${streak}</span>` : ''}<span>🪙 ${s.game.coins}</span></div>` : ''}`;
        } else prof.hidden = true;
      }
      const xpChip = document.getElementById('xp-chip');
      if (xpChip) {
        xpChip.hidden = !(st.gamification && st.showXP);
        if (!xpChip.hidden) {
          const li = Game.levelInfo();
          xpChip.innerHTML = `<span class="xc-level">${li.level}</span><span class="xc-bar"><i style="width:${li.pct}%"></i></span>`;
          xpChip.title = `Nível ${li.level} · ${li.current}/${li.needed} XP`;
        }
      }
      Pomodoro.tick();
    },

    /* ---------- Tema ---------- */
    applyTheme() {
      const st = Store.state.settings;
      const root = document.documentElement;
      const dark = st.theme === 'dark' || (st.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'dark' : 'light';
      const a = Game.ACCENTS[st.accent] || Game.ACCENTS.violeta;
      root.style.setProperty('--accent', a.color);
      root.style.setProperty('--accent-2', a.color2);
      root.style.setProperty('--accent-soft', U.hexToRgba(a.color, dark ? 0.22 : 0.12));
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#0f0f1a' : a.color);
      const tb = document.getElementById('theme-toggle');
      if (tb) tb.textContent = dark ? '☀️' : '🌙';
    },

    /* ---------- Onboarding ---------- */
    onboarding(force = false) {
      const st = Store.state.settings;
      if (st.onboarded && !force) return;
      UI.modal({
        size: 'md',
        className: 'modal-onboarding',
        body: `
          <div class="onb">
            <div class="onb-hero">🐣✨</div>
            <h2>Bem-vindo(a) ao TaskUp!</h2>
            <p class="muted">Seu organizador pessoal divertido: tarefas, rotina, lembretes, Pomodoro e muito XP. Tudo salvo só no seu dispositivo, funcionando offline. 🔒</p>
            <form class="form">
              <label class="field"><span>Como podemos te chamar?</span>
                <input class="input input-lg" name="name" value="${U.escape(st.name)}" placeholder="Seu nome" maxlength="40" autofocus>
              </label>
              <label class="switch-row"><span><strong>🎮 Modo divertido</strong><small class="muted">XP, níveis, conquistas, missões e confetes</small></span>
                <span class="switch"><input type="checkbox" name="game" ${st.gamification ? 'checked' : ''}><i></i></span></label>
              ${!Store.state.tasks.length ? `<label class="switch-row"><span><strong>📋 Começar com exemplos</strong><small class="muted">Cria uma rotina de exemplo para hoje (pode apagar depois)</small></span>
                <span class="switch"><input type="checkbox" name="samples" checked><i></i></span></label>` : ''}
              ${Notify.supported && Notify.permission() === 'default' ? `<button type="button" class="btn btn-block" data-notif>🔔 Permitir lembretes por notificação</button>` : ''}
              <button type="submit" class="btn btn-primary btn-block btn-xl">Começar 🚀</button>
            </form>
          </div>`,
        onMount(el, api) {
          const form = el.querySelector('form');
          const nb = el.querySelector('[data-notif]');
          if (nb)
            nb.onclick = async () => {
              const p = await Notify.request();
              nb.textContent = p === 'granted' ? '✅ Notificações permitidas' : '⛔ Notificações não permitidas';
              nb.disabled = true;
            };
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            const samples = form.samples && form.samples.checked;
            Store.update((s) => {
              s.settings.name = form.name.value.trim();
              s.settings.gamification = form.game.checked;
              s.settings.onboarded = true;
            });
            if (samples) App.createSamples();
            api.close();
            if (form.game.checked) Game.celebrate({ big: true });
            Sound.play('levelup');
          });
        },
        onClose() {
          if (!Store.state.settings.onboarded) Store.update((s) => (s.settings.onboarded = true));
        },
      });
    },

    createSamples() {
      const today = U.today();
      const rem = Store.state.settings.defaultReminder;
      const samples = [
        { title: 'Estudar', emoji: '📚', time: '08:00', duration: 60, categoryId: 'cat-escola', priority: 'medium' },
        { title: 'Reunião de equipe', emoji: '💼', time: '09:30', duration: 60, categoryId: 'cat-trabalho', priority: 'high' },
        { title: 'Almoço', emoji: '🍽️', time: '12:00', duration: 60, categoryId: 'cat-pessoal', priority: 'low' },
        {
          title: 'Projeto pessoal',
          emoji: '💻',
          time: '14:00',
          duration: 120,
          categoryId: 'cat-projetos',
          priority: 'medium',
          subtasks: [
            { id: U.uid(), title: 'Definir objetivo', done: false },
            { id: U.uid(), title: 'Rascunhar ideias', done: false },
            { id: U.uid(), title: 'Revisar', done: false },
          ],
        },
        { title: 'Exercício', emoji: '🏃', time: '18:00', duration: 45, categoryId: 'cat-saude', priority: 'medium', recurrence: 'daily' },
        { title: 'Comprar frutas', emoji: '🛒', time: null, categoryId: 'cat-compras', priority: 'low' },
        { title: 'Pagar conta de luz', emoji: '💡', time: null, categoryId: 'cat-financeiro', priority: 'high', dateOffset: 1 },
      ];
      Store.update((s) => {
        samples.forEach((x) => {
          const { dateOffset, ...rest } = x;
          s.tasks.push(Store.normalizeTask({ id: U.uid(), ...rest, date: U.addDays(today, dateOffset || 0), reminder: x.time ? rem : null, createdAt: new Date(Date.now() - 86400000).toISOString() }));
        });
      });
    },

    /* ---------- Inicialização ---------- */
    init() {
      Store.load();
      App.applyTheme();
      Game.ensureMissions();

      // links de navegação
      const navHtml = NAV_ORDER.map(
        (k) => `<button class="nav-item" data-nav="${k}" data-action="go" data-view="${k}"><span class="nav-icon">${VIEWS[k].icon}</span><span class="nav-label">${VIEWS[k].title}</span><span class="nav-badge" hidden></span></button>`
      ).join('');
      document.getElementById('side-nav').innerHTML = navHtml;
      document.getElementById('bottom-nav').innerHTML =
        ['dashboard', 'routine', 'tasks', 'calendar', 'pomodoro']
          .map((k) => `<button class="bn-item" data-nav="${k}" data-action="go" data-view="${k}"><span>${VIEWS[k].icon}</span><small>${VIEWS[k].title.replace('Minha ', '')}</small><span class="nav-badge" hidden></span></button>`)
          .join('');

      Bus.on('change', App.queueRender);
      Bus.on('rerender', App.queueRender);
      Bus.on('game', App.queueRender);
      Bus.on('header', App.renderChrome);
      Bus.on('theme', () => {
        App.applyTheme();
        App.queueRender();
      });
      const onHash = () => {
        const v = App.fromHash();
        if (v !== current) {
          current = v;
          App.render(true);
        }
      };
      window.addEventListener('hashchange', onHash);
      window.addEventListener('popstate', onHash);
      current = App.fromHash();
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', App.applyTheme);

      App.bindEvents();
      App.render(true);

      // laços de atualização
      setInterval(Pomodoro.tick, 500);
      setInterval(App.minuteTick, 30000);
      Notify.start();
      Backup.autoSnapshot();

      // Pomodoro que terminou com o app fechado
      const p = Store.state.pomodoro;
      if (p.running && p.endAt && p.endAt <= Date.now()) Pomodoro.finish(true);

      setTimeout(() => App.onboarding(), 400);
      if (!Store.storageOk) UI.toast('Modo de visualização: o armazenamento está bloqueado aqui, então os dados não serão salvos. Baixe o arquivo e abra no navegador para salvar.', { type: 'error', duration: 10000 });
      App.registerSW();
    },

    minuteTick() {
      const today = U.today();
      if (today !== lastDay) {
        if (TU.Routine.date === lastDay) TU.Routine.date = today;
        lastDay = today;
        TU.Dashboard._motivation = null;
        Game.ensureMissions();
        Backup.autoSnapshot();
        App.queueRender();
        return;
      }
      // atualiza indicadores de horário sem atrapalhar o usuário
      const busy = document.querySelector('.modal-backdrop') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (!busy && ['routine', 'dashboard', 'tasks'].includes(current) && document.visibilityState === 'visible') App.render();
    },

    bindEvents() {
      // Formulários: dispara "submit" manualmente. Alguns visualizadores
      // (iframes restritos) bloqueiam o envio nativo de formulários.
      const fakeSubmit = (form) => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('button[type="submit"], input[type="submit"]');
        if (!btn || !btn.form || btn.disabled) return;
        e.preventDefault();
        fakeSubmit(btn.form);
      });
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing) return;
        const el = e.target;
        if (!el.form || el.tagName !== 'INPUT' || ['checkbox', 'radio', 'button', 'submit', 'file'].includes(el.type)) return;
        e.preventDefault();
        fakeSubmit(el.form);
      });

      // cliques com data-action
      document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el || el.disabled) return;
        const fn = Actions[el.dataset.action];
        if (fn) {
          e.preventDefault();
          fn(el, e);
        }
      });
      // Enter/Espaço em elementos role=button
      document.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-action]')) {
          e.preventDefault();
          e.target.click();
        }
      });
      // mudanças com data-change
      document.addEventListener('change', (e) => {
        const el = e.target.closest('[data-change]');
        if (!el) return;
        const fn = Changes[el.dataset.change];
        fn && fn(el, e);
      });
      document.addEventListener('input', (e) => {
        if (e.target.matches('input[type=range][data-change]')) Changes[e.target.dataset.change]?.(e.target, e);
      });

      // atalhos de teclado
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = document.activeElement?.tagName;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable) return;
        if (document.querySelector('.modal-backdrop')) return;
        const k = e.key.toLowerCase();
        if (k === 'n') {
          e.preventDefault();
          Tasks.openForm({ defaults: current === 'routine' ? { date: TU.Routine.date, time: U.nextRoundHour() } : current === 'calendar' ? { date: TU.Calendar.selected } : {} });
        } else if (k === '/') {
          e.preventDefault();
          if (current !== 'tasks') App.go('tasks');
          setTimeout(() => document.querySelector('[data-filter="q"]')?.focus(), 60);
        } else if (k === 'p') {
          Pomodoro.toggle();
        } else if (/^[1-8]$/.test(k)) {
          App.go(NAV_ORDER[+k - 1]);
        }
      });

      // menu mobile
      document.getElementById('menu-btn').addEventListener('click', () => document.body.classList.toggle('menu-open'));
      document.getElementById('scrim').addEventListener('click', () => document.body.classList.remove('menu-open'));

      // instalação PWA
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstall = e;
        document.getElementById('install-btn').hidden = false;
      });
      window.addEventListener('appinstalled', () => {
        document.getElementById('install-btn').hidden = true;
        UI.toast('TaskUp instalado! 🎉', { type: 'success' });
      });
    },

    registerSW() {
      if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
      navigator.serviceWorker
        .register('service-worker.js')
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const nw = reg.installing;
            nw &&
              nw.addEventListener('statechange', () => {
                if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                  UI.toast('Nova versão disponível!', { icon: '✨', duration: 10000, action: { label: 'Atualizar', fn: () => location.reload() } });
                }
              });
          });
        })
        .catch((e) => console.warn('SW não registrado', e));
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'navigate') App.go(e.data.view);
      });
    },
  };

  /* ---------- Ações gerais ---------- */
  Actions['go'] = (el) => {
    if (el.dataset.anchor) TU.Settings._anchor = el.dataset.anchor;
    App.go(el.dataset.view, { resetDate: el.dataset.view === 'routine' && el.dataset.nav !== undefined });
  };
  Actions['goto-filter'] = (el) => {
    Object.assign(Tasks.filters, { status: el.dataset.status, priority: el.dataset.priority || 'all', category: 'all', q: '' });
    App.go('tasks');
  };
  Actions['equip'] = (el) => Game.equip(el.dataset.kind, el.dataset.key);
  Actions['buy'] = (el) => Game.buy(el.dataset.kind, el.dataset.key);
  Actions['claim-mission'] = (el) => Game.claimMission(el.dataset.id);
  Actions['claim-weekly'] = () => Game.claimWeekly();
  Actions['enable-game'] = () => {
    Store.update((s) => (s.settings.gamification = true));
    Game.celebrate({ big: true });
  };
  Actions['theme-toggle'] = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    Store.update((s) => (s.settings.theme = dark ? 'light' : 'dark'));
    App.applyTheme();
  };
  Actions['quick-new'] = () =>
    Tasks.openForm({ defaults: current === 'routine' ? { date: TU.Routine.date, time: U.nextRoundHour() } : current === 'calendar' ? { date: TU.Calendar.selected } : {} });
  Actions['install'] = async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    document.getElementById('install-btn').hidden = true;
  };

  TU.App = App;
  document.addEventListener('DOMContentLoaded', App.init);
})();
