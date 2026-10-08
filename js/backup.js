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

  const Backup = {
    exportJSON() {
      const data = JSON.stringify({ ...Store.state, exportedAt: new Date().toISOString() }, null, 2);
      U.download(`taskup-backup-${U.today()}.json`, data, 'application/json');
      Store.update((s) => (s.settings.lastBackup = new Date().toISOString()));
      UI.toast('Backup exportado! Guarde o arquivo em local seguro.', { type: 'success', icon: '💾' });
    },

    exportCSV() {
      const s = Store.state;
      const head = ['Título', 'Categoria', 'Prioridade', 'Data', 'Horário', 'Duração (min)', 'Repetição', 'Concluída', 'Concluída em', 'Subtarefas', 'Pomodoros', 'Notas'];
      const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
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

    importFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        let data;
        try {
          data = JSON.parse(reader.result);
          if (data.app !== 'TaskUp' || !Array.isArray(data.tasks)) throw new Error('Arquivo não é um backup do TaskUp');
        } catch (e) {
          UI.toast('Arquivo inválido: ' + e.message, { type: 'error', duration: 6000 });
          return;
        }
        const ok = await UI.confirm({
          title: 'Restaurar backup?',
          text: `O arquivo contém <strong>${data.tasks.length} tarefas</strong> e ${data.categories?.length || 0} categorias${data.exportedAt ? `, exportado em ${new Date(data.exportedAt).toLocaleString('pt-BR')}` : ''}.<br>Seus dados atuais serão substituídos (uma cópia de segurança automática será criada antes).`,
          okText: 'Restaurar',
          icon: '📦',
        });
        if (!ok) return;
        Backup.snapshot('antes-da-importacao');
        try {
          delete data.exportedAt;
          Store.replace(data);
          window.TU.App.applyTheme();
          UI.toast('Backup restaurado com sucesso!', { type: 'success', icon: '✅' });
        } catch (e) {
          UI.toast('Falha ao restaurar: ' + e.message, { type: 'error' });
        }
      };
      reader.readAsText(file);
    },

    /* ---------- Cópias automáticas no próprio navegador ---------- */
    snapshot(label = U.today()) {
      try {
        U.storage.setItem(SNAP_PREFIX + label, JSON.stringify(Store.state));
        Backup.pruneSnapshots();
      } catch (e) {
        console.warn('Snapshot falhou', e);
      }
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

    pruneSnapshots() {
      const daily = Backup.listSnapshots().filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
      daily.slice(MAX_SNAPSHOTS).forEach((k) => U.storage.removeItem(SNAP_PREFIX + k));
      const other = Backup.listSnapshots().filter((k) => !/^\d{4}-\d{2}-\d{2}$/.test(k));
      other.slice(2).forEach((k) => U.storage.removeItem(SNAP_PREFIX + k));
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
        Store.replace(JSON.parse(raw));
        window.TU.App.applyTheme();
        UI.toast('Cópia restaurada!', { type: 'success' });
      } catch (e) {
        UI.toast('Cópia corrompida', { type: 'error' });
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
