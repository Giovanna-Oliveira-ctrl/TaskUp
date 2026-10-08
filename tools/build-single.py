#!/usr/bin/env python3
"""Gera dist/TaskUp.html: o app inteiro (HTML + CSS + JS) em um único arquivo."""
import base64, os, re, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'dist', 'TaskUp.html')
read = lambda p: open(os.path.join(root, p), encoding='utf-8').read()

html = read('index.html')
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + read('css/style.css') + '\n</style>')
html = re.sub(r'\s*<link rel="(manifest|icon|apple-touch-icon)"[^>]*>', '', html)
svg = base64.b64encode(read('assets/icons/icon.svg').encode()).decode()
html = html.replace('<title>TaskUp</title>', '<title>TaskUp</title>\n  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,' + svg + '">')
html = re.sub(r'<script src="(js/[\w.]+)"></script>', lambda m: '<script>\n' + read(m.group(1)).replace('</script', '<\\/script') + '\n</script>', html)

os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(html)
print(f'{out} ({len(html) // 1024} KB)')
