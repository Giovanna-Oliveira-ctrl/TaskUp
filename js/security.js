/* =========================================================
   TaskUp — security.js
   Segurança e privacidade dos dados locais (sem senha para
   entrar no app):
   - janela de senha usada SÓ para proteger arquivos de backup
   - seção "Segurança e privacidade" das Configurações
   A proteção principal fica em: index.html (política de segurança
   que proíbe rede e scripts externos), storage.js (validação e
   recuperação automática) e crypto.js (cifra dos backups).
   ========================================================= */
(function () {
  'use strict';

  const { U, UI, Crypto } = window.TU;
  const MIN_LENGTH = 6;
  const STRENGTH = [
    ['Muito fraca', '#ef4444'],
    ['Fraca', '#f97316'],
    ['Razoável', '#eab308'],
    ['Boa', '#22c55e'],
    ['Forte', '#10b981'],
  ];

  const Security = {
    MIN_LENGTH,

    /* ---------- Janela de senha reutilizável ----------
       Resolve com a senha, '' (opcional e em branco) ou undefined (cancelado). */
    askPassword({ title = '🔐 Senha', text = '', confirm = false, optional = false, strength = false, okText = 'Continuar', error = '', autocomplete = 'current-password' } = {}) {
      return new Promise((resolve) => {
        let done = false;
        UI.modal({
          title,
          size: 'sm',
          body: `
            <div class="form pw-form">
              ${text ? `<p class="muted small">${text}</p>` : ''}
              <label class="field"><span>Senha</span>
                <div class="pw-field">
                  <input type="password" class="input input-lg" data-pw1 autocomplete="${confirm ? 'new-password' : autocomplete}" maxlength="128" autofocus>
                  <button type="button" class="icon-btn" data-toggle-pw aria-label="Mostrar senha">👁️</button>
                </div>
              </label>
              ${strength ? `<div class="pw-meter"><i></i><i></i><i></i><i></i></div><span class="pw-meter-label muted small"></span>` : ''}
              ${confirm ? `<label class="field"><span>Repita a senha</span><input type="password" class="input input-lg" data-pw2 autocomplete="new-password" maxlength="128"></label>` : ''}
              <p class="pw-error" role="alert">${U.escape(error)}</p>
              <div class="form-actions">
                <span></span>
                <div class="row gap">
                  <button type="button" class="btn btn-ghost" data-cancel>Cancelar</button>
                  <button type="button" class="btn btn-primary" data-ok>${U.escape(okText)}</button>
                </div>
              </div>
            </div>`,
          onMount(el, api) {
            const p1 = el.querySelector('[data-pw1]');
            const p2 = el.querySelector('[data-pw2]');
            const err = el.querySelector('.pw-error');
            const meter = el.querySelector('.pw-meter');
            const label = el.querySelector('.pw-meter-label');
            el.querySelector('[data-toggle-pw]').onclick = () => {
              p1.type = p1.type === 'password' ? 'text' : 'password';
              if (p2) p2.type = p1.type;
            };
            if (meter) {
              p1.addEventListener('input', () => {
                const sc = p1.value ? Crypto.strength(p1.value) : -1;
                meter.querySelectorAll('i').forEach((b, i) => (b.style.background = i < sc ? STRENGTH[sc][1] : ''));
                label.textContent = sc < 0 ? '' : `Força: ${STRENGTH[sc][0]}`;
              });
            }
            const submit = () => {
              const a = p1.value;
              if (optional && !a && (!p2 || !p2.value)) {
                done = true;
                api.close();
                return resolve('');
              }
              if (!a) return (err.textContent = 'Digite a senha.');
              if (confirm && a.length < MIN_LENGTH) return (err.textContent = `Use pelo menos ${MIN_LENGTH} caracteres.`);
              if (confirm && a !== p2.value) return (err.textContent = 'As senhas não conferem.');
              done = true;
              api.close();
              resolve(a);
            };
            el.querySelector('[data-ok]').onclick = submit;
            el.querySelector('[data-cancel]').onclick = () => api.close();
            el.addEventListener('keydown', (e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            });
          },
          onClose() {
            if (!done) resolve(undefined);
          },
        });
      });
    },

    /* ---------- Seção nas Configurações ---------- */
    settingsHtml() {
      const snaps = window.TU.Backup.listSnapshots().length;
      return `<section class="card" id="sec-security">
        <h3>🛡️ Segurança e privacidade</h3>
        <p class="muted small">O app abre direto, sem senha. Mesmo assim, seus dados contam com estas proteções:</p>
        ${Security.privacyList(snaps)}
      </section>`;
    },

    privacyList(snaps = 0) {
      return `<ul class="privacy-list">
        <li>📵 <strong>Sem rede:</strong> o app é proibido de fazer qualquer conexão (política de segurança de conteúdo), então nenhum dado sai do aparelho.</li>
        <li>🧱 <strong>Sem código externo:</strong> só os arquivos do próprio app podem ser executados.</li>
        <li>🧼 <strong>Dados validados:</strong> backups importados são verificados e limpos antes de entrar no app.</li>
        <li>🛟 <strong>Recuperação automática:</strong> cada salvamento grava também uma cópia espelho, e uma cópia por dia fica guardada no aparelho (${snaps} agora). Se os dados se corromperem, o app restaura sozinho a cópia mais recente.</li>
        <li>🔐 <strong>Backup com senha (opcional):</strong> ao exportar, você pode proteger só o arquivo com criptografia AES-256 — ou deixar sem senha.</li>
      </ul>`;
    },
  };

  window.TU.Security = Security;
})();
