/* =========================================================
   TaskUp — crypto.js
   Criptografia local com a Web Crypto API nativa do navegador.
   - Chave: PBKDF2-SHA256 (310.000 iterações, sal aleatório de 16 bytes)
   - Cifra: AES-256-GCM (IV aleatório de 12 bytes a cada gravação;
     o GCM também detecta qualquer alteração nos dados cifrados)
   Usada para proteger (opcionalmente) os arquivos de backup.
   A senha nunca é armazenada e a chave não pode ser exportada.
   ========================================================= */
(function () {
  'use strict';

  const subtle = window.crypto && window.crypto.subtle;
  const ITERATIONS = 310000;
  const MIN_ITER = 100000;
  const MAX_ITER = 2000000;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function toB64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function fromB64(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const random = (n) => window.crypto.getRandomValues(new Uint8Array(n));

  const Crypto = {
    ITERATIONS,
    /** Disponível apenas em contexto seguro (https, localhost ou arquivo local). */
    available: !!(subtle && window.crypto.getRandomValues),

    isEnvelope(obj) {
      return !!(obj && typeof obj === 'object' && obj.taskup === 'enc' && typeof obj.data === 'string' && typeof obj.iv === 'string' && typeof obj.salt === 'string');
    },

    /** Estrutura válida (base64 e tamanhos corretos)? Evita "senha incorreta" para arquivo danificado. */
    validEnvelope(env) {
      const b64 = /^[A-Za-z0-9+/]+={0,2}$/;
      return (
        Crypto.isEnvelope(env) &&
        b64.test(env.salt) && fromB64(env.salt).length >= 16 &&
        b64.test(env.iv) && fromB64(env.iv).length === 12 &&
        b64.test(env.data) && env.data.length >= 24 &&
        (env.iter === undefined || (Number.isInteger(env.iter) && env.iter >= MIN_ITER && env.iter <= MAX_ITER))
      );
    },

    newSalt() {
      return toB64(random(16));
    },

    /** Deriva a chave AES a partir da senha (lento de propósito: dificulta força bruta). */
    async deriveKey(password, saltB64, iterations = ITERATIONS) {
      const base = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
      return subtle.deriveKey(
        { name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' },
        base,
        { name: 'AES-GCM', length: 256 },
        false, // não exportável
        ['encrypt', 'decrypt']
      );
    },

    /** Cifra um texto com uma chave já derivada. */
    async encrypt(vault, plaintext, kind = 'data') {
      const iv = random(12);
      const data = await subtle.encrypt({ name: 'AES-GCM', iv }, vault.key, enc.encode(plaintext));
      return { taskup: 'enc', v: 1, kind, alg: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iter: vault.iter, salt: vault.salt, iv: toB64(iv), data: toB64(data) };
    },

    /** Decifra. Lança erro se a chave estiver errada ou os dados tiverem sido alterados. */
    async decrypt(key, envelope) {
      const plain = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(envelope.iv) }, key, fromB64(envelope.data));
      return dec.decode(plain);
    },

    async encryptWithPassword(password, plaintext, kind = 'backup') {
      const salt = Crypto.newSalt();
      const key = await Crypto.deriveKey(password, salt, ITERATIONS);
      return Crypto.encrypt({ key, salt, iter: ITERATIONS }, plaintext, kind);
    },

    async decryptWithPassword(password, envelope) {
      // o número de iterações vem do arquivo: limitado para um arquivo malicioso não travar o app
      const iter = Number.isInteger(envelope.iter) && envelope.iter >= MIN_ITER && envelope.iter <= MAX_ITER ? envelope.iter : ITERATIONS;
      const key = await Crypto.deriveKey(password, envelope.salt, iter);
      return { text: await Crypto.decrypt(key, envelope), vault: { key, salt: envelope.salt, iter } };
    },

    /** Avaliação simples da força da senha (0 a 4). */
    strength(pw) {
      let score = 0;
      if (pw.length >= 8) score++;
      if (pw.length >= 12) score++;
      if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
      if (/\d/.test(pw)) score++;
      if (/[^A-Za-z0-9]/.test(pw)) score++;
      if (/^(.)\1+$/.test(pw) || /^(123456|senha|password|qwerty|abcdef)/i.test(pw)) score = 0;
      return Math.min(4, score);
    },
  };

  window.TU = window.TU || {};
  window.TU.Crypto = Crypto;
})();
