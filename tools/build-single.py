#!/usr/bin/env python3
"""Gera dist/TaskUp.html: o app inteiro (HTML + CSS + JS) em um único arquivo.

Segurança: em vez de liberar qualquer script embutido ('unsafe-inline'), a política
de segurança (CSP) lista o hash SHA-256 de cada script do app. Assim, só o código
original roda; qualquer script injetado continua bloqueado, como na versão em pastas.
"""
import base64, hashlib, os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'dist', 'TaskUp.html')
read = lambda p: open(os.path.join(root, p), encoding='utf-8').read()


def safe_inline(code, tag):
    """Impede que o conteúdo feche a tag antes da hora (</script>, </style>, <!--)."""
    code = re.sub(r'(?i)</(' + tag + r')', r'<\\/\1', code)
    return code.replace('<!--', '<\\!--')


html = read('index.html')
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + safe_inline(read('css/style.css'), 'style') + '\n</style>')
html = re.sub(r'\s*<link rel="(manifest|icon|apple-touch-icon)"[^>]*>', '', html)
svg = base64.b64encode(read('assets/icons/icon.svg').encode()).decode()
html = html.replace('<title>TaskUp</title>', '<title>TaskUp</title>\n  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,' + svg + '">')

hashes = []


def inline_script(m):
    body = '\n' + safe_inline(read(m.group(1)), 'script') + '\n'
    hashes.append("'sha256-" + base64.b64encode(hashlib.sha256(body.encode('utf-8')).digest()).decode() + "'")
    return '<script>' + body + '</script>'


html = re.sub(r'<script src="(js/[\w.]+)"></script>', inline_script, html)

# política: só os scripts do app (por hash); sem service worker nem manifesto no arquivo único
csp_re = re.compile(r'(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")')
m = csp_re.search(html)
if not m:
    sys.exit('ERRO: meta Content-Security-Policy não encontrada em index.html')
policy = m.group(2).replace("script-src 'self'", "script-src " + ' '.join(hashes))
policy = policy.replace("worker-src 'self'; manifest-src 'self'", "worker-src 'none'")
if 'unsafe-inline' in policy.split('style-src')[0]:
    sys.exit('ERRO: script-src não pode conter unsafe-inline')
html = html[: m.start()] + m.group(1) + policy + m.group(3) + html[m.end():]

os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(html)
print(f'{out} ({len(html) // 1024} KB, {len(hashes)} scripts com hash)')
