/* =========================================================
   TaskUp — utils.js
   Funções utilitárias, datas, eventos e helpers de DOM.
   ========================================================= */
(function () {
  'use strict';

  const TU = (window.TU = window.TU || {});

  const pad = (n) => String(n).padStart(2, '0');

  const U = {
    pad,

    uid() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    /* ---------- Datas ---------- */
    dateKey(d = new Date()) {
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    },
    today() {
      return U.dateKey(new Date());
    },
    parseDateKey(key) {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m - 1, d);
    },
    addDays(key, n) {
      const d = U.parseDateKey(key);
      d.setDate(d.getDate() + n);
      return U.dateKey(d);
    },
    addMonths(key, n) {
      const d = U.parseDateKey(key);
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + n);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last));
      return U.dateKey(d);
    },
    diffDays(a, b) {
      // b - a em dias
      return Math.round((U.parseDateKey(b) - U.parseDateKey(a)) / 86400000);
    },
    weekStart(key) {
      const d = U.parseDateKey(key);
      const dow = (d.getDay() + 6) % 7; // segunda = 0
      d.setDate(d.getDate() - dow);
      return U.dateKey(d);
    },
    timeToMinutes(t) {
      if (!t) return null;
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    },
    minutesToTime(min) {
      min = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
      return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
    },
    nowMinutes() {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    },
    nowTime() {
      return U.minutesToTime(U.nowMinutes());
    },
    nextRoundHour() {
      const d = new Date();
      return U.minutesToTime(Math.min(23 * 60, (d.getHours() + 1) * 60));
    },
    /** Data/hora de vencimento de uma tarefa (ou null) */
    dueDate(task) {
      if (!task.date) return null;
      const d = U.parseDateKey(task.date);
      if (task.time) {
        const [h, m] = task.time.split(':').map(Number);
        d.setHours(h, m, 0, 0);
      } else {
        d.setHours(23, 59, 59, 999);
      }
      return d;
    },
    WEEKDAYS: ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'],
    WEEKDAYS_SHORT: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
    MONTHS: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
    MONTHS_SHORT: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],

    formatDateHuman(key) {
      if (!key) return 'Sem data';
      const t = U.today();
      const diff = U.diffDays(t, key);
      if (diff === 0) return 'Hoje';
      if (diff === 1) return 'Amanhã';
      if (diff === -1) return 'Ontem';
      const d = U.parseDateKey(key);
      const base = `${U.WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${U.MONTHS_SHORT[d.getMonth()]}`;
      return d.getFullYear() !== new Date().getFullYear() ? `${base} ${d.getFullYear()}` : base;
    },
    formatDateLong(key) {
      const d = U.parseDateKey(key);
      return `${U.WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${U.MONTHS[d.getMonth()]}`;
    },
    formatDuration(min) {
      if (!min) return '';
      if (min < 60) return `${min} min`;
      const h = Math.floor(min / 60);
      const m = min % 60;
      return m ? `${h}h${pad(m)}` : `${h}h`;
    },

    greeting(date = new Date()) {
      const h = date.getHours();
      if (h >= 5 && h < 12) return { text: 'Bom dia', emoji: '☀️' };
      if (h >= 12 && h < 18) return { text: 'Boa tarde', emoji: '🌤️' };
      return { text: 'Boa noite', emoji: '🌙' };
    },

    /* ---------- Strings / DOM ---------- */
    escape(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },
    normalize(str) {
      return String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
    },
    $(sel, root = document) {
      return root.querySelector(sel);
    },
    $$(sel, root = document) {
      return Array.from(root.querySelectorAll(sel));
    },
    debounce(fn, ms = 200) {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
      };
    },
    clamp(v, min, max) {
      return Math.max(min, Math.min(max, v));
    },
    pick(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    },
    /** Gerador pseudo-aleatório determinístico (para missões do dia) */
    seeded(seedStr) {
      let h = 2166136261;
      for (let i = 0; i < seedStr.length; i++) {
        h ^= seedStr.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return function () {
        h += 0x6d2b79f5;
        let t = h;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    download(filename, content, mime = 'application/json') {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    hexToRgba(hex, a) {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    },
  };

  /* ---------- Event bus ---------- */
  const listeners = {};
  const Bus = {
    on(evt, fn) {
      (listeners[evt] = listeners[evt] || []).push(fn);
      return () => Bus.off(evt, fn);
    },
    off(evt, fn) {
      listeners[evt] = (listeners[evt] || []).filter((f) => f !== fn);
    },
    emit(evt, payload) {
      (listeners[evt] || []).slice().forEach((fn) => {
        try {
          fn(payload);
        } catch (e) {
          console.error('[Bus]', evt, e);
        }
      });
    },
  };

  /* ---------- Paletas e emojis ---------- */
  U.COLORS = ['#7c5cff', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#ec4899', '#a855f7', '#64748b', '#14b8a6'];
  U.EMOJIS = ['📌', '💼', '📚', '🎓', '🙋', '🛒', '💰', '❤️', '📅', '🚀', '🗂️', '🏃', '🍽️', '💻', '📞', '✉️', '🧹', '🧺', '💊', '🦷', '🧘', '🎯', '🎨', '🎵', '🎮', '📖', '✍️', '🧠', '🐶', '🌱', '🚗', '✈️', '🏠', '🎂', '🎁', '☕', '💡', '🔧', '📝', '⭐'];

  TU.U = U;
  TU.Bus = Bus;
})();
