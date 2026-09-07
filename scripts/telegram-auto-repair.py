#!/usr/bin/env python3
"""Apply the Telegram integration to the current checkout without replacing catalog data."""
from pathlib import Path
import re

app = Path('js/app.js').read_text(encoding='utf-8')
for name in ['openEditForm', 'saveCatalog', 'downloadSource', 'telegramProxyUrl', 'openReader', 'renderPDFReader']:
    matches = list(re.finditer(r'(?:async\s+)?function\s+' + name + r'\s*\(', app))
    print(name, [app.count('\n', 0, m.start()) + 1 for m in matches])
print('app lines:', len(app.splitlines()))
print('telegram references:', app.count('telegramFileId'))
