/* =========================================================
   TaskUp — shop.js
   Loja de recompensas: catálogo, compra, equipar,
   pré-visualização e poderes (itens consumíveis).
   ========================================================= */
(function () {
  'use strict';

  const { U, Bus, Store, UI, Sound } = window.TU;
  const Actions = (window.TU.Actions = window.TU.Actions || {});
  const Game = () => window.TU.Game;

  /* ---------- Catálogo ---------- */
  const ACCENTS = {
    violeta: { name: 'Violeta', color: '#7c5cff', color2: '#b05cff', price: 0 },
    oceano: { name: 'Oceano', color: '#0ea5e9', color2: '#22d3ee', price: 40 },
    floresta: { name: 'Floresta', color: '#10b981', color2: '#84cc16', price: 40 },
    menta: { name: 'Menta', color: '#14b8a6', color2: '#5eead4', price: 50 },
    lavanda: { name: 'Lavanda', color: '#8b5cf6', color2: '#c4b5fd', price: 50 },
    sunset: { name: 'Pôr do sol', color: '#f97316', color2: '#ec4899', price: 60 },
    chiclete: { name: 'Chiclete', color: '#ec4899', color2: '#a855f7', price: 60 },
    cereja: { name: 'Cereja', color: '#e11d48', color2: '#fb7185', price: 70 },
    cafe: { name: 'Café', color: '#92400e', color2: '#d97706', price: 70 },
    galaxia: { name: 'Galáxia', color: '#6366f1', color2: '#0ea5e9', price: 90 },
    neon: { name: 'Neon', color: '#16a34a', color2: '#06b6d4', price: 100 },
    meianoite: { name: 'Meia-noite', color: '#1e3a8a', color2: '#7c3aed', price: 120 },
    ouro: { name: 'Ouro', color: '#d97706', color2: '#facc15', price: 150 },
    arcoiris: { name: 'Arco-íris', color: '#ef4444', color2: '#8b5cf6', price: 200, rainbow: true },
  };

  const MASCOTS = {
    '🐣': { name: 'Pintinho', price: 0 },
    '🐱': { name: 'Gato', price: 30 },
    '🐶': { name: 'Cachorro', price: 30 },
    '🐰': { name: 'Coelho', price: 40 },
    '🐢': { name: 'Tartaruga', price: 40 },
    '🦊': { name: 'Raposa', price: 50 },
    '🐼': { name: 'Panda', price: 50 },
    '🐨': { name: 'Coala', price: 50 },
    '🐧': { name: 'Pinguim', price: 50 },
    '🐸': { name: 'Sapo', price: 60 },
    '🐝': { name: 'Abelha', price: 60 },
    '🧸': { name: 'Ursinho', price: 60 },
    '🦋': { name: 'Borboleta', price: 70 },
    '🦉': { name: 'Coruja', price: 80 },
    '🐙': { name: 'Polvo', price: 80 },
    '🦁': { name: 'Leão', price: 100 },
    '🐯': { name: 'Tigre', price: 100 },
    '🦄': { name: 'Unicórnio', price: 120 },
    '👻': { name: 'Fantasminha', price: 120 },
    '🦖': { name: 'Dinossauro', price: 150 },
    '👽': { name: 'ET', price: 150 },
    '🐉': { name: 'Dragão', price: 200 },
    '🤖': { name: 'Robô', price: 200 },
  };

  const BACKGROUNDS = {
    none: { name: 'Liso', price: 0 },
    dots: { name: 'Bolinhas', price: 40 },
    grid: { name: 'Caderno quadriculado', price: 50 },
    lines: { name: 'Caderno pautado', price: 50 },
    stripes: { name: 'Listras', price: 60 },
    aurora: { name: 'Aurora', price: 90 },
    party: { name: 'Festa', price: 100 },
    stars: { name: 'Céu estrelado', price: 120 },
  };

  // Os símbolos de cada efeito ficam em ui.js (UI.EFFECTS)
  const EFFECTS = {
    classic: { name: 'Confete clássico', price: 0 },
    hearts: { name: 'Corações', price: 40 },
    stars: { name: 'Estrelas', price: 50 },
    fruits: { name: 'Salada de frutas', price: 60 },
    snow: { name: 'Neve', price: 70 },
    party: { name: 'Festa', price: 80 },
    space: { name: 'Espacial', price: 100 },
    money: { name: 'Chuva de dinheiro', price: 120 },
  };

  // As notas de cada pacote ficam em ui.js (Sound.PACKS)
  const SOUNDS = {
    classic: { name: 'Clássico', price: 0 },
    pop: { name: 'Pop', price: 30 },
    bell: { name: 'Sininho', price: 40 },
    retro: { name: 'Retrô 8-bit', price: 50 },
    xylo: { name: 'Xilofone', price: 60 },
    harp: { name: 'Harpa mágica', price: 80 },
    fanfare: { name: 'Fanfarra', price: 120 },
  };

  const TITLES = {
    none: { name: 'Sem título', price: 0 },
    focado: { name: 'Foco Total 🎯', price: 30 },
    madrugador: { name: 'Madrugador(a) 🐓', price: 40 },
    coruja: { name: 'Coruja da Noite 🦉', price: 40 },
    zen: { name: 'Mente Zen 🧘', price: 60 },
    rotina: { name: 'Realeza da Rotina 👑', price: 80 },
    pomodoro: { name: 'Mestre do Pomodoro 🍅', price: 80 },
    metas: { name: 'Caçador(a) de Metas 🏹', price: 100 },
    imparavel: { name: 'Imparável 🚀', price: 150 },
    lenda: { name: 'Lenda Viva 🦄', price: 200 },
  };

  const POWERUPS = {
    freeze: { name: 'Congelador de sequência', emoji: '🧊', price: 60, max: 3, desc: 'Se você ficar um dia sem concluir nada, ele é usado automaticamente e sua sequência 🔥 continua. Acumula até 3.' },
    boost: { name: 'XP em dobro (1 hora)', emoji: '⚡', price: 80, desc: 'Dobra o XP de tarefas, Pomodoros e missões por 1 hora. Comprar de novo soma mais 1 hora.' },
    mystery: { name: 'Caixa surpresa', emoji: '🎁', price: 50, desc: 'Um item aleatório que você ainda não tem (tema, fundo, mascote, efeito, som ou título).' },
    reroll: { name: 'Trocar missões', emoji: '🔄', price: 25, desc: 'Sorteia novas missões para hoje (as já resgatadas são mantidas).' },
  };

  /** kind → onde fica a lista de desbloqueados, a configuração e o item padrão */
  const KINDS = {
    accent: { label: '🎨 Temas', items: ACCENTS, unlock: 'accents', setting: 'accent', def: 'violeta' },
    background: { label: '🖼️ Fundos', items: BACKGROUNDS, unlock: 'backgrounds', setting: 'background', def: 'none' },
    mascot: { label: '🐾 Mascotes', items: MASCOTS, unlock: 'mascots', setting: 'mascot', def: '🐣' },
    effect: { label: '🎉 Comemorações', items: EFFECTS, unlock: 'effects', setting: 'effect', def: 'classic' },
    sound: { label: '🔔 Sons', items: SOUNDS, unlock: 'sounds', setting: 'soundPack', def: 'classic' },
    title: { label: '🏷️ Títulos', items: TITLES, unlock: 'titles', setting: 'title', def: 'none' },
  };

  const g = () => Store.state.game;
  const coins = () => Math.max(0, g().coins);

  const Shop = {
    ACCENTS,
    MASCOTS,
    BACKGROUNDS,
    EFFECTS,
    SOUNDS,
    TITLES,
    POWERUPS,
    KINDS,
    tab: 'accent',

    owned(kind, key) {
      const k = U.own(KINDS, kind);
      return !!k && (g().unlocked[k.unlock] || []).includes(key);
    },

    /** Quantos cosméticos o usuário possui (sem contar os gratuitos). */
    collectionSize() {
      return Object.values(KINDS).reduce((n, k) => n + Math.max(0, (g().unlocked[k.unlock] || []).length - 1), 0);
    },

    titleText() {
      const t = U.own(TITLES, Store.state.settings.title);
      return t && Store.state.settings.title !== 'none' ? t.name : '';
    },

    boostActive() {
      return Date.now() < (g().boostUntil || 0);
    },

    /** Valida itens/configurações (usado ao carregar e importar dados). */
    validate(s) {
      const game = s.game;
      game.unlocked = game.unlocked && typeof game.unlocked === 'object' ? game.unlocked : {};
      Object.values(KINDS).forEach((k) => {
        const list = Array.isArray(game.unlocked[k.unlock]) ? game.unlocked[k.unlock] : [];
        game.unlocked[k.unlock] = [...new Set(list.filter((x) => U.own(k.items, x)))];
        if (!game.unlocked[k.unlock].includes(k.def)) game.unlocked[k.unlock].unshift(k.def);
        if (!U.own(k.items, s.settings[k.setting]) || !game.unlocked[k.unlock].includes(s.settings[k.setting])) s.settings[k.setting] = k.def;
      });
      const inv = game.inventory && typeof game.inventory === 'object' ? game.inventory : {};
      const f = typeof inv.freeze === 'number' ? inv.freeze : 0;
      game.inventory = {};
      game.inventory.freeze = Number.isFinite(f) ? Math.max(0, Math.min(POWERUPS.freeze.max, Math.floor(f))) : 0;
      // o reforço dura no máximo algumas horas a partir de agora (impede "XP em dobro eterno" por importação)
      const b = typeof game.boostUntil === 'number' && Number.isFinite(game.boostUntil) ? game.boostUntil : 0;
      game.boostUntil = Math.min(b, Date.now() + 24 * 3600000);
      if (!game.frozenDays || typeof game.frozenDays !== 'object' || Array.isArray(game.frozenDays)) game.frozenDays = {};
      const un = {};
      Object.values(KINDS).forEach((k) => (un[k.unlock] = game.unlocked[k.unlock]));
      game.unlocked = un; // descarta listas desconhecidas
    },

    canPay(price) {
      if (g().coins >= price) return true;
      UI.toast(`Faltam ${price - coins()} moedas para esse item.`, { type: 'error', icon: '🪙' });
      return false;
    },

    buy(kind, key) {
      const k = U.own(KINDS, kind);
      const item = k && U.own(k.items, key);
      if (!item || Shop.owned(kind, key) || !Shop.canPay(item.price)) return;
      Store.update((s) => {
        s.game.coins -= item.price;
        s.game.unlocked[k.unlock].push(key);
        s.settings[k.setting] = key;
      });
      Sound.play('coin');
      Game().celebrate({});
      UI.toast(`${item.name} desbloqueado e equipado!`, { type: 'success', icon: kind === 'mascot' ? key : '🛍️' });
      Game().checkAchievements();
      Bus.emit('theme');
    },

    equip(kind, key) {
      const k = U.own(KINDS, kind);
      if (!k || !U.own(k.items, key) || !Shop.owned(kind, key)) return;
      Store.update((s) => (s.settings[k.setting] = key));
      Bus.emit('theme');
      if (kind === 'sound') Sound.play('complete');
      if (kind === 'effect') Game().celebrate({});
    },

    preview(kind, key) {
      if (kind === 'sound') Sound.play('complete', true, key);
      if (kind === 'effect') UI.confetti({ count: 60, effect: key });
    },

    /* ---------- Poderes ---------- */
    buyPowerup(key) {
      const p = U.own(POWERUPS, key);
      if (!p) return;
      if (key === 'freeze' && (g().inventory.freeze || 0) >= p.max) {
        UI.toast(`Você já tem o máximo de ${p.max} congeladores.`, { icon: '🧊' });
        return;
      }
      if (key === 'mystery' && !Shop.mysteryPool().length) {
        UI.toast('Você já tem todos os itens! 🏆 Não há nada novo na caixa.', { icon: '🎁' });
        return;
      }
      if (key === 'reroll' && !g().missions.list.some((m) => !m.claimed)) {
        UI.toast('Todas as missões de hoje já foram resgatadas.', { icon: '🔄' });
        return;
      }
      if (!Shop.canPay(p.price)) return;
      Store.update((s) => (s.game.coins -= p.price));
      Sound.play('coin');
      if (key === 'freeze') {
        Store.update((s) => {
          s.game.inventory.freeze = (s.game.inventory.freeze || 0) + 1;
          // a sequência já tinha quebrado antes da compra: o congelador vale só para o futuro
          if (s.game.lastActiveDate && U.diffDays(s.game.lastActiveDate, U.today()) > 1) s.game.streak = 0;
        });
        UI.toast(`Congelador guardado! Você tem ${g().inventory.freeze}.`, { type: 'success', icon: '🧊' });
      } else if (key === 'boost') {
        Store.update((s) => (s.game.boostUntil = Math.max(Date.now(), s.game.boostUntil || 0) + 3600000));
        UI.toast(`XP em dobro ativo até ${new Date(g().boostUntil).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}!`, { type: 'xp', icon: '⚡' });
        Game().celebrate({});
      } else if (key === 'mystery') {
        Shop.openMystery();
      } else if (key === 'reroll') {
        Game().rerollMissions();
        UI.toast('Novas missões sorteadas!', { type: 'success', icon: '🔄' });
      }
      Bus.emit('game');
    },

    mysteryPool() {
      const pool = [];
      Object.entries(KINDS).forEach(([kind, k]) =>
        Object.keys(k.items).forEach((key) => {
          if (!Shop.owned(kind, key) && k.items[key].price > 0) pool.push([kind, key]);
        })
      );
      return pool;
    },

    openMystery() {
      const pool = Shop.mysteryPool();
      const [kind, key] = U.pick(pool);
      const k = KINDS[kind];
      const item = k.items[key];
      Store.update((s) => s.game.unlocked[k.unlock].push(key));
      Sound.play('achievement');
      Game().celebrate({ big: true });
      Game().checkAchievements();
      UI.modal({
        size: 'sm',
        className: 'modal-levelup',
        body: `
          <div class="levelup">
            <div class="levelup-badge mystery">${Shop.thumb(kind, key, true)}</div>
            <p class="levelup-kicker">Caixa surpresa!</p>
            <h2>${U.escape(item.name)}</h2>
            <p class="muted">${k.label} · vale 🪙 ${item.price}</p>
            <div class="row gap" style="justify-content:center">
              <button class="btn" data-close>Guardar</button>
              <button class="btn btn-primary" data-equip>Usar agora</button>
            </div>
          </div>`,
        onMount(el, api) {
          el.querySelector('[data-close]').onclick = () => api.close();
          el.querySelector('[data-equip]').onclick = () => {
            api.close();
            Shop.equip(kind, key);
          };
        },
      });
    },

    /** Usa congeladores para cobrir dias perdidos (chamado na abertura e na virada do dia). */
    applyFreezes() {
      const game = g();
      if (!game.lastActiveDate || !game.streak || !Store.state.settings.gamification) return;
      const missed = U.diffDays(game.lastActiveDate, U.today()) - 1;
      const inv = game.inventory.freeze || 0;
      if (missed <= 0 || inv < missed) return;
      Store.update((s) => {
        for (let i = 1; i <= missed; i++) s.game.frozenDays[U.addDays(game.lastActiveDate, i)] = 1;
        s.game.inventory.freeze -= missed;
        s.game.lastActiveDate = U.addDays(U.today(), -1);
      }, { silent: true });
      setTimeout(() => UI.toast(`🧊 ${missed > 1 ? missed + ' congeladores usados' : 'Congelador usado'}: sua sequência de ${game.streak} dias está salva!`, { type: 'success', icon: '🧊', duration: 7000 }), 1200);
    },

    /* ---------- Renderização ---------- */
    thumb(kind, key, big = false) {
      const item = KINDS[kind].items[key];
      switch (kind) {
        case 'accent':
          return `<div class="swatch ${item.rainbow ? 'rainbow' : ''}" style="background:linear-gradient(135deg, ${item.color}, ${item.color2})"></div>`;
        case 'background':
          return `<div class="bg-preview" data-bg="${key}"></div>`;
        case 'mascot':
          return `<div class="mascot-big">${key}</div>`;
        case 'effect':
          return `<div class="effect-preview">${(U.own(UI.EFFECTS, key) || ['🎊']).slice(0, 3).join('')}</div>`;
        case 'sound':
          return `<div class="mascot-big">${['🎵', '🫧', '🔔', '👾', '🎹', '🪕', '🎺'][Object.keys(SOUNDS).indexOf(key)] || '🎵'}</div>`;
        case 'title':
          return `<div class="title-preview ${big ? 'big' : ''}">${key === 'none' ? '—' : U.escape(item.name)}</div>`;
        default:
          return '';
      }
    },

    render(view) {
      if (!Store.state.settings.gamification) {
        view.innerHTML = `
          <div class="empty-state card">
            <div class="empty-emoji">🛍️</div>
            <h3>Loja desativada</h3>
            <p class="muted">A loja faz parte da gamificação, que está desligada.</p>
            <button class="btn btn-primary" data-action="enable-game">Ativar gamificação</button>
          </div>`;
        return;
      }
      view.innerHTML = Shop.html();
    },

    html() {
      const s = Store.state;
      const tab = Shop.tab;
      const tabs = [...Object.entries(KINDS).map(([k, v]) => [k, v.label]), ['powerup', '⚡ Poderes']];
      let total = 0;
      let have = 0;
      Object.values(KINDS).forEach((k) => {
        total += Object.keys(k.items).length;
        have += (s.game.unlocked[k.unlock] || []).length;
      });

      let body = '';
      if (tab === 'powerup') {
        body = `<div class="shop powerups">${Object.entries(POWERUPS)
          .map(([key, p]) => {
            const extra =
              key === 'freeze'
                ? `<span class="pill">Você tem ${s.game.inventory.freeze || 0}/${p.max}</span>`
                : key === 'boost' && Shop.boostActive()
                ? `<span class="pill pill-live">Ativo até ${new Date(s.game.boostUntil).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>`
                : '';
            return `<div class="shop-item powerup">
              <div class="mascot-big">${p.emoji}</div>
              <strong>${p.name}</strong>
              <p class="muted small">${p.desc}</p>
              ${extra}
              <button class="btn btn-sm btn-primary" data-action="buy-powerup" data-key="${key}" ${s.game.coins < p.price ? 'disabled' : ''}>🪙 ${p.price}</button>
            </div>`;
          })
          .join('')}</div>`;
      } else {
        const k = KINDS[tab];
        const current = s.settings[k.setting];
        body = `<div class="shop">${Object.entries(k.items)
          .map(([key, item]) => {
            const owned = Shop.owned(tab, key);
            const equipped = current === key;
            const canPreview = tab === 'sound' || tab === 'effect';
            return `<div class="shop-item ${equipped ? 'equipped' : ''} ${owned ? '' : 'locked'}">
              ${Shop.thumb(tab, key)}
              <strong>${U.escape(item.name)}</strong>
              <div class="shop-actions">
                ${canPreview ? `<button class="icon-btn sm" data-action="shop-preview" data-kind="${tab}" data-key="${U.escape(key)}" title="Experimentar">${tab === 'sound' ? '🔊' : '👀'}</button>` : ''}
                ${equipped ? '<span class="pill pill-success">Em uso</span>' : owned ? `<button class="btn btn-sm" data-action="equip" data-kind="${tab}" data-key="${U.escape(key)}">Usar</button>` : `<button class="btn btn-sm btn-primary" data-action="buy" data-kind="${tab}" data-key="${U.escape(key)}" ${s.game.coins < item.price ? 'disabled' : ''}>🪙 ${item.price}</button>`}
              </div>
            </div>`;
          })
          .join('')}</div>`;
      }

      return `
        <div class="card shop-card">
          <div class="card-head"><h3>🛍️ Loja de recompensas</h3><span class="pill">🪙 ${coins()}</span></div>
          <p class="muted small">Ganhe moedas concluindo tarefas, Pomodoros, missões e conquistas. Coleção: <strong>${have}/${total}</strong> itens.${Shop.boostActive() ? ' ⚡ XP em dobro ativo!' : ''}</p>
          <div class="chips-scroll shop-tabs">
            ${tabs.map(([k, label]) => `<button class="filter-chip ${tab === k ? 'active' : ''}" data-action="shop-tab" data-tab="${k}">${label}</button>`).join('')}
          </div>
          ${body}
        </div>`;
    },
  };

  Actions['shop-tab'] = (el) => {
    Shop.tab = U.own(KINDS, el.dataset.tab) || el.dataset.tab === 'powerup' ? el.dataset.tab : 'accent';
    Bus.emit('rerender');
  };
  Actions['buy'] = (el) => Shop.buy(el.dataset.kind, el.dataset.key);
  Actions['equip'] = (el) => Shop.equip(el.dataset.kind, el.dataset.key);
  Actions['shop-preview'] = (el) => Shop.preview(el.dataset.kind, el.dataset.key);
  Actions['buy-powerup'] = (el) => Shop.buyPowerup(el.dataset.key);

  window.TU.Shop = Shop;
})();
