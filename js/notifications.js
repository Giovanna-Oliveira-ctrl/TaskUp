/* =========================================================
   TaskUp — notifications.js
   Lembretes locais via Notification API (+ Service Worker
   quando disponível), resumo diário e badge do app.
   Observação: navegadores só disparam lembretes enquanto o
   app estiver aberto (ou em segundo plano). Onde houver
   suporte a Notification Triggers, agendamos no sistema.
   ========================================================= */
(function () {
  'use strict';

  const { U, Store, UI, Sound } = window.TU;

  const supported = 'Notification' in window;
  const LATE = 15 * 60000; // lembretes perdidos há mais de 15 min não são disparados
  const triggersSupported = supported && 'showTrigger' in Notification.prototype && 'TimestampTrigger' in window;

  async function swReg() {
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return null;
    try {
      return await Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 800))]);
    } catch (_) {
      return null;
    }
  }

  const Notify = {
    supported,
    triggersSupported,

    permission() {
      return supported ? Notification.permission : 'unsupported';
    },

    async request() {
      if (!supported) {
        UI.toast('Seu navegador não suporta notificações.', { type: 'error' });
        return 'unsupported';
      }
      let p = Notification.permission;
      if (p === 'default') {
        try {
          p = await Notification.requestPermission();
        } catch (_) {
          p = Notification.permission;
        }
      }
      if (p === 'granted') UI.toast('Notificações ativadas! 🔔', { type: 'success' });
      else if (p === 'denied') UI.toast('Notificações bloqueadas. Libere nas configurações do navegador.', { type: 'error', duration: 6000 });
      return p;
    },

    /** Exibe uma notificação do sistema (se permitido) e/ou um toast. */
    async show(title, body = '', { tag, toast = true, onlyHidden = false, sound = null, data = {}, action = null } = {}) {
      const s = Store.state.settings;
      if (sound) Sound.play(sound);
      if (toast) {
        const m = title.match(/^(\p{Extended_Pictographic}\uFE0F?)\s*/u);
        UI.toast(`${m ? title.slice(m[0].length) : title}${body ? ' — ' + body : ''}`, { icon: m ? m[1] : '🔔', duration: action ? 12000 : 7000, action });
      }
      if (!s.notifications || !supported || Notification.permission !== 'granted') return;
      if (onlyHidden && document.visibilityState === 'visible') return;
      const opts = {
        body,
        tag: tag || 'taskup-' + Date.now(),
        icon: 'assets/icons/icon-192.png',
        badge: 'assets/icons/icon-192.png',
        renotify: !!tag,
        data,
      };
      try {
        const reg = await swReg();
        if (reg && reg.showNotification) return reg.showNotification(title, opts);
        const n = new Notification(title, opts);
        n.onclick = () => {
          window.focus();
          if (data.view) window.TU.App.go(data.view);
          n.close();
        };
      } catch (e) {
        console.warn('Falha ao notificar', e);
      }
    },

    /** Agenda uma notificação no sistema (somente navegadores com Notification Triggers). */
    async scheduleAt(ts, title, body, tag) {
      if (!triggersSupported || Notification.permission !== 'granted' || !Store.state.settings.notifications) return;
      try {
        const reg = await swReg();
        if (!reg) return;
        // eslint-disable-next-line no-undef
        await reg.showNotification(title, { body, tag, icon: 'assets/icons/icon-192.png', showTrigger: new TimestampTrigger(ts) });
      } catch (_) {}
    },

    schedulePomodoro() {
      const p = Store.state.pomodoro;
      if (p.running && p.endAt) Notify.scheduleAt(p.endAt, '🍅 Tempo esgotado!', 'Sua sessão terminou.', 'pomodoro');
    },

    /** Adia o lembrete de uma tarefa por alguns minutos. */
    snooze(id, minutes = 10) {
      Store.update((s) => {
        const t = s.tasks.find((x) => x.id === id);
        if (!t) return;
        t.snoozeUntil = Date.now() + minutes * 60000;
        // o lembrete adiado substitui o aviso "Agora" do horário exato
        if (t.date && t.time) s.notified[`${t.id}|${t.date}|${t.time}|d`] = Date.now();
      }, { silent: true });
      UI.toast(`Ok! Lembro de novo em ${minutes} min.`, { icon: '😴', duration: 2500 });
    },

    /** Verifica lembretes pendentes. Executado periodicamente. */
    check() {
      const s = Store.state;
      if (!s) return;
      const now = Date.now();
      const notified = s.notified;
      let changed = false;

      s.tasks.forEach((t) => {
        if (t.done || !t.date || !t.time) return;
        const due = U.dueDate(t).getTime();
        const base = `${t.id}|${t.date}|${t.time}`;
        const created = new Date(t.createdAt).getTime();
        const snooze = { label: 'Adiar 10 min', fn: () => Notify.snooze(t.id, 10) };
        // lembrete adiado ("soneca")
        const snoozed = !!t.snoozeUntil;
        if (t.snoozeUntil && now >= t.snoozeUntil) {
          Store.update((st) => {
            const x = st.tasks.find((y) => y.id === t.id);
            if (x) x.snoozeUntil = null;
          }, { silent: true });
          Notify.show(`🔔 ${t.emoji ? t.emoji + ' ' : ''}${t.title}`, `Lembrete adiado · ${t.time}`, { tag: base + 's', sound: 'reminder', data: { view: 'routine' }, action: snooze });
        }
        if (t.reminder !== null && t.reminder !== undefined) {
          const fireAt = due - t.reminder * 60000;
          const key = base + '|r';
          if (now >= fireAt && now <= due + LATE && created <= due - 60000 && !notified[key]) {
            notified[key] = now;
            changed = true;
            const mins = Math.round((due - now) / 60000);
            const when = mins > 1 ? `Começa às ${t.time} (em ${mins >= 60 ? U.formatDuration(mins) : mins + ' min'})` : `Está na hora! (${t.time})`;
            Notify.show(`🔔 ${t.emoji ? t.emoji + ' ' : ''}${t.title}`, when, { tag: base, sound: 'reminder', data: { view: 'routine' }, action: snooze });
          }
          // aviso no horário exato, se o lembrete foi antecipado
          const keyDue = base + '|d';
          if (t.reminder > 0 && now >= due && now - due < LATE && created <= due && !notified[keyDue] && !snoozed) {
            notified[keyDue] = now;
            changed = true;
            Notify.show(`⏰ Agora: ${t.emoji ? t.emoji + ' ' : ''}${t.title}`, 'Bora fazer acontecer!', { tag: base + 'd', sound: 'reminder', data: { view: 'routine' }, action: snooze });
          }
        }
      });

      // resumo diário
      const today = U.today();
      if (s.settings.dailySummary && s.settings.dailySummaryTime) {
        const at = U.parseDateKey(today);
        const [h, m] = s.settings.dailySummaryTime.split(':').map(Number);
        at.setHours(h, m, 0, 0);
        const key = 'summary|' + today;
        if (now >= at.getTime() && now - at.getTime() < 4 * 3600000 && !notified[key]) {
          notified[key] = now;
          changed = true;
          const list = s.tasks.filter((t) => t.date === today && !t.done);
          const overdue = s.tasks.filter((t) => window.TU.Tasks.isOverdue(t) && t.date < today).length;
          if (list.length || overdue) {
            const g = U.greeting();
            Notify.show(`${g.text}! ${g.emoji}`, `Você tem ${list.length} tarefa${list.length === 1 ? '' : 's'} para hoje${overdue ? ` e ${overdue} atrasada${overdue === 1 ? '' : 's'}` : ''}.`, { tag: 'summary', toast: false, data: { view: 'dashboard' } });
          }
        }
      }

      // limpeza de chaves antigas
      Object.keys(notified).forEach((k) => {
        if (now - notified[k] > 8 * 86400000) {
          delete notified[k];
          changed = true;
        }
      });
      if (changed) Store.save();
      Notify.updateBadge();
    },

    updateBadge() {
      if (!('setAppBadge' in navigator)) return;
      const s = Store.state;
      const today = U.today();
      const n = s.tasks.filter((t) => !t.done && t.date && t.date <= today).length;
      try {
        n ? navigator.setAppBadge(n) : navigator.clearAppBadge();
      } catch (_) {}
    },

    /** Agenda (quando suportado) os lembretes das próximas 24h no sistema. */
    async scheduleUpcoming() {
      if (!triggersSupported) return;
      const s = Store.state;
      const now = Date.now();
      for (const t of s.tasks) {
        if (t.done || !t.time || !t.date || t.reminder === null) continue;
        const fireAt = U.dueDate(t).getTime() - t.reminder * 60000;
        if (fireAt > now && fireAt - now < 86400000) {
          await Notify.scheduleAt(fireAt, `🔔 ${t.title}`, `Às ${t.time}`, `${t.id}|${t.date}|${t.time}`);
        }
      }
    },

    start() {
      Notify.check();
      setInterval(Notify.check, 20000);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && Notify.check());
      Notify.scheduleUpcoming();
    },
  };

  window.TU.Notify = Notify;
})();
