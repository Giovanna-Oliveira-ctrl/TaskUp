/* =========================================================
   TaskUp — ui.js
   Componentes de interface: toasts, modais, confirmação,
   confete e sons sintetizados (Web Audio API — sem arquivos).
   ========================================================= */
(function () {
  'use strict';

  const { U, Bus } = window.TU;

  /* ---------------- Toasts ---------------- */
  function toast(text, opts = {}) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const { type = 'info', icon, action, duration = 3500 } = opts;
    const icons = { info: '💬', success: '✅', error: '⚠️', xp: '⭐', achievement: '🏆' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <span class="toast-icon">${icon || icons[type] || '💬'}</span>
      <span class="toast-text">${U.escape(text)}</span>
      ${action ? `<button class="toast-action">${U.escape(action.label)}</button>` : ''}
      <button class="toast-close" aria-label="Fechar">×</button>`;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    let timer;
    const close = () => {
      clearTimeout(timer);
      el.classList.remove('show');
      el.classList.add('hide');
      setTimeout(() => el.remove(), 300);
    };
    timer = setTimeout(close, duration);
    el.querySelector('.toast-close').onclick = close;
    if (action) {
      el.querySelector('.toast-action').onclick = () => {
        action.fn();
        close();
      };
    }
    // limita a quantidade de toasts visíveis
    const all = root.querySelectorAll('.toast:not(.hide)');
    if (all.length > 4) all[0].querySelector('.toast-close').click();
    return close;
  }
  Bus.on('toast', (p) => toast(p.text, p));

  /* ---------------- Modais ---------------- */
  const stack = [];

  function modal({ title = '', body = '', size = 'md', onMount, onClose, footer = '', className = '' } = {}) {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal modal-${size} ${className}" role="dialog" aria-modal="true" aria-label="${U.escape(title)}">
        ${title ? `<header class="modal-header"><h2>${title}</h2><button class="icon-btn modal-x" aria-label="Fechar">✕</button></header>` : ''}
        <div class="modal-body">${body}</div>
        ${footer ? `<footer class="modal-footer">${footer}</footer>` : ''}
      </div>`;
    root.appendChild(wrap);
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => wrap.classList.add('show'));

    let closed = false;
    const api = {
      el: wrap.querySelector('.modal'),
      close(result) {
        if (closed) return;
        closed = true;
        // bloqueia novos cliques/Enter durante a animação de saída (evita envio duplo)
        wrap.classList.add('closing');
        wrap.inert = true;
        wrap.classList.remove('show');
        const i = stack.indexOf(api);
        if (i >= 0) stack.splice(i, 1);
        if (!stack.length) document.body.classList.remove('no-scroll');
        setTimeout(() => wrap.remove(), 200);
        onClose && onClose(result);
      },
    };
    stack.push(api);
    wrap.addEventListener('mousedown', (e) => {
      if (e.target === wrap) api.close();
    });
    const x = wrap.querySelector('.modal-x');
    if (x) x.onclick = () => api.close();
    onMount && onMount(api.el, api);
    // foco no primeiro campo
    setTimeout(() => {
      const f = api.el.querySelector('[autofocus], input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select, button.btn-primary');
      f && f.focus({ preventScroll: true });
    }, 50);
    return api;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stack.length) {
      stack[stack.length - 1].close();
    }
  });

  function confirm({ title = 'Tem certeza?', text = '', okText = 'Confirmar', cancelText = 'Cancelar', danger = false, icon = '🤔' } = {}) {
    return new Promise((resolve) => {
      let answered = false;
      modal({
        size: 'sm',
        className: 'modal-confirm',
        body: `
          <div class="confirm-icon">${icon}</div>
          <h3>${U.escape(title)}</h3>
          ${text ? `<p class="muted">${text}</p>` : ''}
          <div class="confirm-actions">
            <button class="btn btn-ghost" data-r="0">${U.escape(cancelText)}</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-r="1">${U.escape(okText)}</button>
          </div>`,
        onMount(el, api) {
          el.querySelectorAll('[data-r]').forEach((b) =>
            b.addEventListener('click', () => {
              answered = true;
              api.close();
              resolve(b.dataset.r === '1');
            })
          );
        },
        onClose() {
          if (!answered) resolve(false);
        },
      });
    });
  }

  /* ---------------- Confete ---------------- */
  let confettiParts = [];
  let confettiRAF = null;

  function confetti({ count = 120, origin = null } = {}) {
    const canvas = document.getElementById('confetti');
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) count = Math.min(count, 25);
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = ['#7c5cff', '#22d3ee', '#f472b6', '#facc15', '#34d399', '#fb923c'];
    const ox = origin ? origin.x : innerWidth / 2;
    const oy = origin ? origin.y : innerHeight / 3;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      confettiParts.push({
        x: ox,
        y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 6,
        size: 5 + Math.random() * 6,
        color: U.pick(colors),
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 20,
        life: 0,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      });
    }
    canvas.style.display = 'block';
    if (!confettiRAF) loop();

    function loop() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      confettiParts.forEach((p) => {
        p.vy += 0.25;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, 1 - p.life / 160);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      confettiParts = confettiParts.filter((p) => p.life < 160 && p.y < innerHeight + 40);
      if (confettiParts.length) confettiRAF = requestAnimationFrame(loop);
      else {
        confettiRAF = null;
        ctx.clearRect(0, 0, innerWidth, innerHeight);
        canvas.style.display = 'none';
      }
    }
  }

  /* ---------------- Sons (Web Audio API) ---------------- */
  let audioCtx = null;
  function ctx() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tone(ac, freq, start, dur, { type = 'sine', vol = 0.3 } = {}) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime + start);
    g.gain.setValueAtTime(0.0001, ac.currentTime + start);
    g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
    o.connect(g).connect(ac.destination);
    o.start(ac.currentTime + start);
    o.stop(ac.currentTime + start + dur + 0.05);
  }

  const SOUNDS = {
    click: [[880, 0, 0.06, 'triangle']],
    complete: [
      [523.25, 0, 0.12, 'triangle'],
      [783.99, 0.08, 0.2, 'triangle'],
    ],
    undo: [
      [600, 0, 0.1, 'sine'],
      [400, 0.07, 0.15, 'sine'],
    ],
    levelup: [
      [523.25, 0, 0.15, 'square'],
      [659.25, 0.12, 0.15, 'square'],
      [783.99, 0.24, 0.15, 'square'],
      [1046.5, 0.36, 0.4, 'square'],
    ],
    achievement: [
      [659.25, 0, 0.12, 'triangle'],
      [880, 0.1, 0.12, 'triangle'],
      [1318.5, 0.2, 0.35, 'triangle'],
    ],
    pomodoro: [
      [880, 0, 0.25, 'sine'],
      [880, 0.35, 0.25, 'sine'],
      [1174.66, 0.7, 0.5, 'sine'],
    ],
    reminder: [
      [740, 0, 0.18, 'sine'],
      [988, 0.2, 0.3, 'sine'],
    ],
    coin: [
      [987.77, 0, 0.08, 'square'],
      [1318.5, 0.07, 0.25, 'square'],
    ],
  };

  const Sound = {
    play(name, force = false) {
      const s = window.TU.Store && window.TU.Store.state;
      if (!force && s && !s.settings.sounds) return;
      const ac = ctx();
      if (!ac) return;
      const vol = (s ? s.settings.volume : 0.6) * 0.35;
      const seq = SOUNDS[name] || SOUNDS.click;
      const v = name === 'levelup' || name === 'coin' ? vol * 0.5 : vol;
      seq.forEach(([f, st, d, type]) => tone(ac, f, st, d, { type, vol: Math.max(0.0002, v) }));
    },
  };

  // desbloqueia o AudioContext na primeira interação (políticas de autoplay)
  const unlock = () => {
    ctx();
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);

  /* ---------------- Helpers de formulário ---------------- */
  function formData(form) {
    const data = {};
    new FormData(form).forEach((v, k) => (data[k] = typeof v === 'string' ? v.trim() : v));
    return data;
  }

  function emojiPicker(current, name = 'emoji') {
    return `
      <div class="emoji-picker" data-name="${name}">
        <input type="hidden" name="${name}" value="${U.escape(current || '')}">
        <button type="button" class="emoji-current" aria-label="Escolher emoji">${U.escape(current) || '➕'}</button>
        <div class="emoji-grid" hidden>
          <button type="button" class="emoji-opt" data-emoji="">∅</button>
          ${U.EMOJIS.map((e) => `<button type="button" class="emoji-opt" data-emoji="${e}">${e}</button>`).join('')}
        </div>
      </div>`;
  }

  function bindEmojiPicker(root) {
    root.querySelectorAll('.emoji-picker').forEach((p) => {
      const cur = p.querySelector('.emoji-current');
      const grid = p.querySelector('.emoji-grid');
      const input = p.querySelector('input');
      cur.addEventListener('click', () => (grid.hidden = !grid.hidden));
      grid.addEventListener('click', (e) => {
        const b = e.target.closest('.emoji-opt');
        if (!b) return;
        input.value = b.dataset.emoji;
        cur.textContent = b.dataset.emoji || '➕';
        grid.hidden = true;
      });
    });
  }

  // fecha seletores de emoji abertos ao clicar fora deles
  document.addEventListener('mousedown', (e) => {
    document.querySelectorAll('.emoji-picker .emoji-grid:not([hidden])').forEach((g) => {
      if (!g.parentElement.contains(e.target)) g.hidden = true;
    });
  });

  function colorPicker(current, name = 'color') {
    return `
      <div class="color-picker">
        ${U.COLORS.map(
          (c) => `<label class="color-opt" style="--c:${c}">
            <input type="radio" name="${name}" value="${c}" ${c === current ? 'checked' : ''}><span></span></label>`
        ).join('')}
        <label class="color-opt color-custom" title="Cor personalizada">
          <input type="color" name="${name}-custom" value="${/^#[0-9a-f]{6}$/i.test(current || '') ? current : '#7c5cff'}">
        </label>
      </div>`;
  }

  window.TU.UI = { toast, modal, confirm, confetti, formData, emojiPicker, bindEmojiPicker, colorPicker };
  window.TU.Sound = Sound;
})();
