/* =========================================================
   TaskUp — backup.js
   Exportar / importar dados (JSON), exportar CSV,
   cópias automáticas locais e reset.
   ========================================================= */
(function () {
  'use strict';

  const { U, Store, UI } = window.TU;
  const SNAP_PREFIX = 'taskup:snapshot:';
  const MAX_SNAPSHOTS = 5;
  const MAX_IMPORT_BYTES = 5 * 1048576;
  const isDaily = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k);

  const Backup = {
    /** Pergunta se o arquivo deve ser protegido por senha e exporta. */
    async exportJSON() {
      const Sec = window.TU.Security;
      let password = null;
      if (Sec && window.TU.Crypto.available) {
        password = await Sec.askPassword({
          title: '💾 Exportar backup',
          text: 'Opcional: proteja <strong>só o arquivo de backup</strong> com senha (criptografia AES-256), útil se for guardá-lo na nuvem, e-mail ou pen drive. <strong>Deixe em branco para exportar sem senha.</strong> O app continua abrindo normalmente, sem senha.',
          confirm: true,
          optional: true,
          strength: true,
          okText: 'Exportar',
        });
        if (password === undefined) return; // cancelou
      }
      const { notified, ...rest } = Store.state;
      void notified;
      const json = JSON.stringify({ ...rest, exportedAt: new Date().toISOString() }, null, 2);
      let content = json;
      let name = `taskup-backup-${U.today()}.json`;
      if (password) {
        content = JSON.stringify(await window.TU.Crypto.encryptWithPassword(password, json, 'backup'));
        name = `taskup-backup-protegido-${U.today()}.json`;
      }
      U.download(name, content, 'application/json');
      Store.update((s) => (s.settings.lastBackup = new Date().toISOString()));
      UI.toast(password ? 'Backup protegido por senha exportado! 🔐' : 'Backup exportado! Guarde o arquivo em local seguro.', { type: 'success', icon: '💾' });
    },

    exportCSV() {
      const s = Store.state;
      const head = ['Título', 'Categoria', 'Prioridade', 'Data', 'Horário', 'Duração (min)', 'Repetição', 'Concluída', 'Concluída em', 'Subtarefas', 'Pomodoros', 'Notas'];
      // células que começam com = + - @ são executadas como fórmula no Excel/Planilhas: neutraliza
      const esc = (v) => {
        let t = String(v ?? '');
        if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
        return `"${t.replace(/"/g, '""')}"`;
      };
      const rows = s.tasks.map((t) =>
        [
          t.title,
          Store.category(t.categoryId).name,
          window.TU.Tasks.PRIORITIES[t.priority].label,
          t.date || '',
          t.time || '',
          t.duration,
          window.TU.Tasks.RECURRENCE[t.recurrence],
          t.done ? 'Sim' : 'Não',
          t.completedAt ? new Date(t.completedAt).toLocaleString('pt-BR') : '',
          t.subtasks.map((x) => (x.done ? '[x] ' : '[ ] ') + x.title).join(' | '),
          t.pomodoros,
          t.notes,
        ]
          .map(esc)
          .join(';')
      );
      U.download(`taskup-tarefas-${U.today()}.csv`, '﻿' + [head.map(esc).join(';'), ...rows].join('\r\n'), 'text/csv;charset=utf-8');
      UI.toast('Planilha CSV exportada!', { type: 'success', icon: '📊' });
    },

    /** Aplica um estado importado; se algo falhar, volta exatamente ao estado anterior. */
    applyState(obj) {
      const before = JSON.stringify(Store.state);
      try {
        Store.hydrate(obj); // valida antes de gravar qualquer coisa
        Store.replace(obj);
        window.TU.App.applyTheme();
      } catch (e) {
        Store.replace(JSON.parse(before));
        window.TU.App.applyTheme();
        throw e;
      }
    },

    importFile(file) {
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) {
        UI.toast(`Arquivo grande demais (${(file.size / 1048576).toFixed(1)} MB). O limite é 5 MB.`, { type: 'error', duration: 6000 });
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        let data;
        try {
          data = JSON.parse(reader.result);
          if (window.TU.Crypto && window.TU.Crypto.isEnvelope(data)) {
            data = await Backup.openProtected(data);
            if (!data) return;
          }
          if (!data || data.app !== 'TaskUp' || !Array.isArray(data.tasks)) throw new Error('Arquivo não é um backup do TaskUp');
        } catch (e) {
          UI.toast('Arquivo inválido: ' + e.message, { type: 'error', duration: 6000 });
          return;
        }
        // tudo que vai para a tela vem do arquivo: só números contados e data validada/escapada
        const nTasks = data.tasks.length;
        const nCats = Array.isArray(data.categories) ? data.categories.length : 0;
        const when = typeof data.exportedAt === 'string' && !isNaN(Date.parse(data.exportedAt)) ? new Date(data.exportedAt).toLocaleString('pt-BR') : '';
        const ok = await UI.confirm({
          title: 'Restaurar backup?',
          text: `O arquivo contém <strong>${nTasks} tarefas</strong> e ${nCats} categorias${when ? `, exportado em ${U.escape(when)}` : ''}.<br>Seus dados atuais serão substituídos (uma cópia de segurança automática será criada antes).`,
          okText: 'Restaurar',
          icon: '📦',
        });
        if (!ok) return;
        if (!Backup.snapshot('antes-da-importacao')) {
          const go = await UI.confirm({
            title: 'Sem cópia de segurança',
            text: 'Não foi possível guardar uma cópia dos dados atuais (armazenamento cheio?). Se continuar, eles serão substituídos sem volta.',
            okText: 'Importar mesmo assim',
            danger: true,
            icon: '⚠️',
          });
          if (!go) return;
        }
        try {
          Backup.applyState(data);
          UI.toast('Backup restaurado com sucesso!', { type: 'success', icon: '✅' });
        } catch (e) {
          UI.toast('Falha ao restaurar (nada foi alterado): ' + e.message, { type: 'error', duration: 7000 });
        }
      };
      reader.readAsText(file);
    },

    /** Pede a senha de um backup protegido (até acertar ou cancelar). */
    async openProtected(envelope) {
      if (!window.TU.Crypto.validEnvelope(envelope)) {
        UI.toast('Este backup protegido está danificado ou incompleto.', { type: 'error', duration: 6000 });
        return null;
      }
      let error = '';
      for (;;) {
        const pw = await window.TU.Security.askPassword({ title: '🔐 Backup protegido', text: 'Este arquivo está protegido por senha. Digite a senha usada ao exportar.', error, okText: 'Abrir' });
        if (!pw) return null;
        try {
          const { text } = await window.TU.Crypto.decryptWithPassword(pw, envelope);
          return JSON.parse(text);
        } catch (_) {
          error = 'Senha incorreta (ou arquivo alterado). Tente de novo.';
        }
      }
    },

    /* ---------- Cópias automáticas no próprio navegador ----------
       Também servem para a recuperação automática se os dados se corromperem. */
    /** Grava uma cópia. Retorna true se conseguiu. */
    snapshot(label = U.today()) {
      const json = JSON.stringify({ ...Store.state, snapshotAt: new Date().toISOString() });
      Backup.pruneSnapshots(label); // abre espaço antes de gravar
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          U.storage.setItem(SNAP_PREFIX + label, json);
          return true;
        } catch (e) {
          // armazenamento cheio: descarta a cópia mais antiga (nunca a principal) e tenta de novo
          if (!Backup.dropOldestSnapshot(label)) break;
        }
      }
      console.warn('Não foi possível gravar a cópia', label);
      return false;
    },

    /** Remove a cópia mais antiga (exceto `keep`). Retorna false se não havia o que remover. */
    dropOldestSnapshot(keep) {
      const list = Backup.listSnapshots()
        .filter((k) => k !== keep)
        .map((k) => {
          let at = 0;
          try {
            at = Date.parse(JSON.parse(U.storage.getItem(SNAP_PREFIX + k)).snapshotAt) || 0;
          } catch (_) {}
          return { k, at };
        })
        .sort((a, b) => a.at - b.at);
      if (!list.length) return false;
      U.storage.removeItem(SNAP_PREFIX + list[0].k);
      return true;
    },

    listSnapshots() {
      const out = [];
      try {
        U.storage.keys().forEach((k) => {
          if (k && k.startsWith(SNAP_PREFIX)) out.push(k.slice(SNAP_PREFIX.length));
        });
      } catch (_) {}
      return out.sort().reverse();
    },

    /** Mantém no máximo 5 cópias diárias e 2 especiais. Com `incoming`, já libera a vaga dessa cópia nova. */
    pruneSnapshots(incoming = null) {
      const prune = (filter, max) => {
        const list = Backup.listSnapshots().filter(filter);
        const reserve = incoming && filter(incoming) && !list.includes(incoming) ? 1 : 0;
        list.slice(Math.max(0, max - reserve)).forEach((k) => U.storage.removeItem(SNAP_PREFIX + k));
      };
      prune(isDaily, MAX_SNAPSHOTS);
      prune((k) => !isDaily(k), 2);
    },

    autoSnapshot() {
      const today = U.today();
      if (!Backup.listSnapshots().includes(today) && Store.state.tasks.length) Backup.snapshot(today);
    },

    async restoreSnapshot(label) {
      const raw = U.storage.getItem(SNAP_PREFIX + label);
      if (!raw) return;
      const ok = await UI.confirm({ title: 'Restaurar cópia automática?', text: `Cópia: <strong>${U.escape(label)}</strong>. Os dados atuais serão substituídos.`, okText: 'Restaurar', icon: '🕰️' });
      if (!ok) return;
      try {
        Backup.applyState(JSON.parse(raw));
        UI.toast('Cópia restaurada!', { type: 'success' });
      } catch (e) {
        UI.toast('Não foi possível abrir a cópia: ' + e.message, { type: 'error' });
      }
    },

    async resetAll() {
      const ok = await UI.confirm({
        title: 'Apagar TODOS os dados?',
        text: 'Tarefas, categorias, XP, conquistas e configurações serão apagados deste dispositivo. Essa ação não pode ser desfeita.',
        okText: 'Apagar tudo',
        danger: true,
        icon: '💣',
      });
      if (!ok) return;
      Backup.snapshot('antes-do-reset');
      Store.reset();
      window.TU.App.applyTheme();
      UI.toast('Tudo limpo. Recomeçando do zero! 🌱', { type: 'success' });
      window.TU.App.onboarding();
    },
  };

  window.TU.Backup = Backup;
})();
