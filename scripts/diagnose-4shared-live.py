#!/usr/bin/env python3
"""Inspect the exact public source and deployed proxy without credentials or full downloads."""
import html
import json
import re
import urllib.parse
import urllib.request
import urllib.error

SOURCE = 'https://www.4shared.com/office/_Gh4MImh/Aves_de_Rapina_08.html'
PROXY = 'https://vqfmbpqurapcsuixgvql.supabase.co/functions/v1/fourshared-proxy'
URLS = [SOURCE, 'https://www.4shared.com/get/_Gh4MImh/Aves_de_Rapina_08.html', PROXY + '?' + urllib.parse.urlencode({'url': SOURCE, 'meta': '1'})]

def inspect(url, headers=None):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 BancaDigital/1.0', 'Accept': 'text/html,application/octet-stream,*/*', **(headers or {})})
    try:
        response = urllib.request.urlopen(req, timeout=35)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        data = response.read(262144)
        result = {'status': response.status, 'url': response.url, 'content_type': response.headers.get('content-type'), 'content_length': response.headers.get('content-length'), 'content_range': response.headers.get('content-range'), 'signature': data[:16].hex()}
        if data.startswith((b'%PDF-', b'PK\x03\x04', b'Rar!\x1a\x07')):
            result['binary'] = True
        else:
            text = data.decode('utf-8', errors='replace')
            title = re.search(r'<title[^>]*>(.*?)</title>', text, re.I | re.S)
            if title: result['title'] = html.unescape(re.sub(r'<[^>]+>', '', title.group(1))).strip()
            relevant = re.findall(r'(?:href|data-href|data-download-url|downloadUrl|downloadLink|directLink)\s*[=:]\s*[\"\']([^\"\']+)', text, re.I)
            result['candidate_links'] = []
            for candidate in relevant:
                candidate = urllib.parse.urljoin(response.url, html.unescape(candidate.replace('\\/', '/')))
                host = urllib.parse.urlparse(candidate).hostname or ''
                if (host == '4shared.com' or host.endswith('.4shared.com')) and re.search(r'download|/get/|/file/|\.pdf|\.cb[rz]', candidate, re.I):
                    if candidate not in result['candidate_links']: result['candidate_links'].append(candidate)
            result['candidate_links'] = result['candidate_links'][:15]
            result['text_indicators'] = sorted(set(re.findall(r'(?i)(?:file not found|file has been deleted|file is not available|sign in to download|download is not available|download file|arquivo não encontrado|arquivo foi removido|arquivo não está disponível)', text)))
            if 'json' in (response.headers.get('content-type') or ''):
                try: result['json'] = json.loads(text)
                except ValueError: result['text_excerpt'] = text[:500]
    return result

for url in URLS:
    try: print(json.dumps(inspect(url), ensure_ascii=False))
    except Exception as error: print(json.dumps({'url': url, 'error': type(error).__name__ + ': ' + str(error)}, ensure_ascii=False))
