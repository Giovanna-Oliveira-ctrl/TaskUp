/* =========================================================
   TaskUp — boot.js
   Aplica o tema antes de pintar a tela (evita "flash" claro
   no modo escuro). Fica em arquivo próprio para que a política
   de segurança possa proibir scripts embutidos no HTML.
   ========================================================= */
(function () {
  try {
    var s = JSON.parse(localStorage.getItem('taskup:data:v1') || '{}').settings || {};
    var t = s.theme || 'auto';
    var dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {}
})();
