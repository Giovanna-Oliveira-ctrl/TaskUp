/* =========================================================
   TaskUp — settings.js
   Tela de configurações: perfil, aparência, gamificação,
   sons, notificações, Pomodoro e dados.
   ========================================================= */
(function () {
  'use strict';

  const { U, Bus, Store, UI, Game, Notify, Backup, Sound } = window.TU;
  const Actions = window.TU.Actions;
  const Changes = (window.TU.Changes = window.TU.Changes || {});

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
  }
  function setPath(obj, path, val) {
    const keys = path.split('.');
    const last = keys.pop();
    keys.reduce((o, k) => o[k], obj)[last] = val;
  }

  const toggle = (key, label, desc = '', disabled = false) => `
    <label class="switch-row ${disabled ? 'disabled' : ''}">
      <span><strong>${label}</strong>${desc ? `<small class="muted">${desc}</small>` : ''}</span>
      <span class="switch"><input type="checkbox" data-change="setting" data-key="${key}" ${getPath(Store.state.settings, key) ? 'checked' : ''} ${disabled ? 'disabled' : ''}><i></i></span>
    </label>`;

  const number = (key, label, min, max, suffix = 'min') => `
    <label class="num-row">
      <span>${label}</span>
      <span class="num-input"><input type="number" class="input input-sm" min="${min}" max="${max}" value="${getPath(Store.state.settings, key)}" data-change="setting" data-key="${key}" data-type="number"> <small class="muted">${suffix}</small></span>
    </label>`;

  const Settings = {
    render(view) {
      const s = Store.state;
      const st = s.settings;
      const perm = Notify.permission();
      const permLabel = { granted: '✅ Permitidas', denied: '⛔ Bloqueadas no navegador', default: '❔ Ainda não autorizadas', unsupported: '🚫 Não suportadas neste navegador' }[perm];
      const g = st.gamification;
      const snaps = Backup.listSnapshots();
      const kb = (Store.usageBytes() / 1024).toFixed(1);

      view.innerHTML = `
        <div class="settings">
          <section class="card" id="sec-profile">
            <h3>👤 Perfil</h3>
            <label class="field">
              <span>Seu nome (usado na saudação)</span>
              <input class="input" value="${U.escape(st.name)}" data-change="setting" data-key="name" maxlength="40" placeholder="Como quer ser chamado(a)?">
            </label>
          </section>

          <section class="card" id="sec-appearance">
            <h3>🎨 Aparência</h3>
            <div class="field">
              <span>Tema</span>
              <div class="segmented">
                ${[['auto', '🌗 Automático'], ['light', '☀️ Claro'], ['dark', '🌙 Escuro']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" ${st.theme === v ? 'checked' : ''} data-change="setting" data-key="theme"><span>${l}</span></label>`).join('')}
              </div>
            </div>
            <div class="field">
              <span>Cor de destaque ${g ? '<small class="muted">(desbloqueie mais na loja 🛍️)</small>' : ''}</span>
              <div class="accent-list">
                ${Object.entries(Game.ACCENTS)
                  .map(([k, a]) => {
                    const owned = !g || s.game.unlocked.accents.includes(k);
                    return `<button class="accent-opt ${st.accent === k ? 'active' : ''}" ${owned ? `data-action="equip" data-kind="accent" data-key="${k}"` : 'disabled'} title="${a.name}${owned ? '' : ' (bloqueado)'}" style="background:linear-gradient(135deg, ${a.color}, ${a.color2})">${owned ? (st.accent === k ? '✓' : '') : '🔒'}</button>`;
                  })
                  .join('')}
              </div>
            </div>
          </section>

          <section class="card" id="sec-game">
            <h3>🎮 Gamificação</h3>
            ${toggle('gamification', 'Ativar gamificação', 'XP, níveis, moedas, conquistas e missões')}
            <div class="sub-settings ${g ? '' : 'disabled'}">
              ${toggle('showXP', 'XP e níveis', 'Mostrar XP ganho e subir de nível', !g)}
              ${toggle('streaks', 'Sequência de dias', 'Contador de dias seguidos produtivos 🔥', !g)}
              ${toggle('achievements', 'Conquistas', 'Medalhas por marcos alcançados', !g)}
              ${toggle('missions', 'Missões e desafios', 'Missões diárias e desafio semanal', !g)}
              ${toggle('motivation', 'Mensagens motivacionais', 'Frases de incentivo no painel', !g)}
              ${toggle('celebrations', 'Comemorações', 'Confetes ao concluir tarefas 🎉', !g)}
            </div>
          </section>

          <section class="card" id="sec-sound">
            <h3>🔊 Sons</h3>
            ${toggle('sounds', 'Efeitos sonoros', 'Sons ao concluir tarefas, Pomodoro e lembretes')}
            <label class="num-row">
              <span>Volume</span>
              <input type="range" min="0" max="1" step="0.05" value="${st.volume}" data-change="setting" data-key="volume" data-type="number" class="range">
            </label>
            <div class="row gap wrap">
              <button class="btn btn-sm" data-action="test-sound" data-s="complete">▶ Conclusão</button>
              <button class="btn btn-sm" data-action="test-sound" data-s="levelup">▶ Nível</button>
              <button class="btn btn-sm" data-action="test-sound" data-s="pomodoro">▶ Pomodoro</button>
              <button class="btn btn-sm" data-action="test-sound" data-s="reminder">▶ Lembrete</button>
            </div>
          </section>

          <section class="card" id="sec-notif">
            <h3>🔔 Notificações</h3>
            <div class="row between wrap gap">
              <span>Permissão do navegador: <strong>${permLabel}</strong></span>
              ${perm === 'default' ? '<button class="btn btn-sm btn-primary" data-action="notif-request">Permitir notificações</button>' : ''}
              ${perm === 'granted' ? '<button class="btn btn-sm" data-action="notif-test">Testar notificação</button>' : ''}
            </div>
            ${toggle('notifications', 'Lembretes ativos', 'Avisar no horário configurado em cada tarefa')}
            <label class="num-row">
              <span>Lembrete padrão para tarefas com horário</span>
              <select class="input input-sm" data-change="setting" data-key="defaultReminder" data-type="nullable-number">
                ${window.TU.Tasks.REMINDERS.map(([v, l]) => `<option value="${v === null ? '' : v}" ${st.defaultReminder === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </label>
            ${toggle('dailySummary', 'Resumo diário', 'Uma notificação com as tarefas do dia')}
            <label class="num-row">
              <span>Horário do resumo</span>
              <input type="time" class="input input-sm" value="${st.dailySummaryTime}" data-change="setting" data-key="dailySummaryTime">
            </label>
            <p class="muted small">ℹ️ Como o app funciona 100% offline e sem servidor, os lembretes são disparados enquanto o TaskUp estiver aberto (mesmo em segundo plano/aba minimizada). Instale como app para melhor experiência.${Notify.triggersSupported ? ' Seu navegador também permite agendar lembretes no sistema. ✅' : ''}</p>
          </section>

          <section class="card" id="sec-pomodoro">
            <h3>🍅 Pomodoro</h3>
            ${number('pomodoro.focus', 'Tempo de foco', 1, 120)}
            ${number('pomodoro.short', 'Pausa curta', 1, 60)}
            ${number('pomodoro.long', 'Pausa longa', 1, 90)}
            ${number('pomodoro.longEvery', 'Pausa longa a cada', 1, 12, 'focos')}
            ${toggle('pomodoro.autoStartBreaks', 'Iniciar pausas automaticamente')}
            ${toggle('pomodoro.autoStartFocus', 'Iniciar foco automaticamente após a pausa')}
          </section>

          <section class="card" id="sec-data">
            <h3>💾 Seus dados</h3>
            <p class="muted small">Tudo fica salvo somente neste dispositivo (${kb} KB usados). Faça backups para não perder nada ao trocar de navegador ou limpar dados.
            ${st.lastBackup ? `Último backup: <strong>${new Date(st.lastBackup).toLocaleString('pt-BR')}</strong>.` : '<strong>Você ainda não fez nenhum backup.</strong>'}</p>
            <div class="row gap wrap">
              <button class="btn btn-primary" data-action="export-json">💾 Exportar backup (JSON)</button>
              <label class="btn">📂 Importar backup<input type="file" accept="application/json,.json" data-change="import-file" hidden></label>
              <button class="btn" data-action="export-csv">📊 Exportar planilha (CSV)</button>
            </div>
            ${snaps.length ? `<div class="field mt">
              <span>Cópias automáticas locais</span>
              <div class="row gap wrap">${snaps.map((k) => `<button class="btn btn-sm btn-ghost" data-action="restore-snap" data-k="${U.escape(k)}">🕰️ ${U.escape(k)}</button>`).join('')}</div>
            </div>` : ''}
            <hr>
            <div class="row between wrap gap">
              <span class="muted small">Zona de perigo</span>
              <button class="btn btn-danger" data-action="reset-all">💣 Apagar todos os dados</button>
            </div>
          </section>

          <section class="card about">
            <h3>ℹ️ Sobre</h3>
            <p class="muted small">TaskUp · organizador pessoal offline. Sem contas, sem servidores, sem rastreamento. Feito com HTML, CSS e JavaScript puro.</p>
            <p class="muted small">Atalhos: <kbd>N</kbd> nova tarefa · <kbd>/</kbd> buscar · <kbd>1</kbd>–<kbd>7</kbd> navegar · <kbd>P</kbd> play/pause Pomodoro · <kbd>T</kbd> tema · <kbd>?</kbd> ajuda · <kbd>Esc</kbd> fechar</p>
            <div class="row gap wrap"><button class="btn btn-sm btn-ghost" data-action="shortcuts">⌨️ Atalhos de teclado</button><button class="btn btn-sm btn-ghost" data-action="show-onboarding">👋 Rever boas-vindas</button></div>
          </section>
        </div>`;

      if (Settings._anchor) {
        const el = view.querySelector('#sec-' + Settings._anchor);
        Settings._anchor = null;
        el && setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      }
    },
  };

  Changes['setting'] = (el) => {
    const key = el.dataset.key;
    let val;
    if (el.type === 'checkbox') val = el.checked;
    else if (el.dataset.type === 'number') {
      val = parseFloat(el.value);
      if (isNaN(val)) return;
      if (el.min !== '') val = Math.max(+el.min, val);
      if (el.max !== '') val = Math.min(+el.max, val);
    } else if (el.dataset.type === 'nullable-number') val = el.value === '' ? null : +el.value;
    else val = el.value;
    Store.update((s) => setPath(s.settings, key, val), { silent: el.type === 'range' || key === 'name' });
    if (key === 'theme') Bus.emit('theme');
    if (key === 'name') Bus.emit('header');
    if (key === 'volume') Sound.play('click');
    if (key.startsWith('pomodoro.')) {
      const p = Store.state.pomodoro;
      if (!p.running && p.remaining === null) window.TU.Pomodoro.tick();
    }
    if (key === 'notifications' && val && Notify.permission() === 'default') Notify.request().then(() => Bus.emit('rerender'));
  };
  Changes['import-file'] = (el) => {
    Backup.importFile(el.files[0]);
    el.value = '';
  };

  Actions['test-sound'] = (el) => Sound.play(el.dataset.s, true);
  Actions['notif-request'] = async () => {
    await Notify.request();
    Bus.emit('rerender');
  };
  Actions['notif-test'] = () => Notify.show('🔔 Teste do TaskUp', 'As notificações estão funcionando!', { tag: 'test', sound: 'reminder' });
  Actions['export-json'] = () => Backup.exportJSON();
  Actions['export-csv'] = () => Backup.exportCSV();
  Actions['restore-snap'] = (el) => Backup.restoreSnapshot(el.dataset.k);
  Actions['reset-all'] = () => Backup.resetAll();
  Actions['show-onboarding'] = () => window.TU.App.onboarding(true);

  window.TU.Settings = Settings;
})();
