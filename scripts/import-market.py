#!/usr/bin/env python3
"""Publish a verified snapshot to this private Site's R2, then atomically activate it.

Read credentials from hidden stdin JSON; never put them in arguments or files.
Requires only Python's standard library. Intended for the Site owner/updater.
"""
import concurrent.futures
import hashlib
import json
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def read_config():
    old = None
    if sys.stdin.isatty():
        import termios
        old = termios.tcgetattr(sys.stdin)
        quiet = termios.tcgetattr(sys.stdin)
        quiet[3] &= ~termios.ECHO
        termios.tcsetattr(sys.stdin, termios.TCSANOW, quiet)
    print('Ready for import JSON on stdin (input is hidden).', flush=True)
    try:
        value = json.loads(sys.stdin.readline())
    finally:
        if old is not None:
            termios.tcsetattr(sys.stdin, termios.TCSANOW, old)
    return value


def main():
    config = read_config()
    base = config['siteUrl'].rstrip('/')
    parsed = urllib.parse.urlsplit(base)
    if parsed.scheme != 'https' or parsed.hostname != 'tokyo-food-atlas-1024.lielikelife.chatgpt.site' or parsed.path or parsed.query or parsed.fragment:
        raise ValueError('Use the verified Atlas Site origin. No credentials were sent.')
    root = pathlib.Path(__file__).resolve().parents[1] / 'public' / 'market'
    manifest_path = root / 'manifest.json'
    manifest = json.loads(manifest_path.read_bytes())
    version = config.get('version', manifest['version'])
    files = manifest['files']
    expected = len(files) + 1
    if manifest['fileCount'] != expected:
        raise ValueError('Manifest count mismatch')
    for item in files:
        path = (root / item['path']).resolve()
        if not path.is_relative_to(root) or path.stat().st_size > 6 * 1024 * 1024:
            raise ValueError('Invalid or oversized snapshot path')
        raw = path.read_bytes()
        if len(raw) != item['bytes'] or hashlib.sha256(raw).hexdigest() != item['sha256']:
            raise ValueError('Snapshot integrity mismatch: ' + item['path'])
    headers = {'OAI-Sites-Authorization': 'Bearer ' + config['siteToken'], 'X-Atlas-Import-Secret': config['importSecret'], 'Content-Type': 'application/json', 'Accept': 'application/json'}

    def api(path, method='GET', value=None, raw=None):
        payload = raw if raw is not None else json.dumps(value, ensure_ascii=False).encode() if value is not None else None
        for attempt in range(4):
            try:
                request = urllib.request.Request(base + path, data=payload, headers=headers, method=method)
                with urllib.request.urlopen(request, timeout=45) as response:
                    return json.load(response)
            except urllib.error.HTTPError as error:
                if error.code in [429, 502, 503, 504] and attempt < 3:
                    time.sleep(min(2 ** attempt, 4))
                    continue
                # Do not print request objects, headers or raw error bodies.
                raise RuntimeError('Import request failed: HTTP ' + str(error.code)) from None
            except (urllib.error.URLError, TimeoutError):
                if attempt == 3:
                    raise RuntimeError('Import connection failed; staging release stays inactive') from None
                time.sleep(min(2 ** attempt, 4))

    initial = api('/api/ops/import/start', 'POST', {'version': version, 'expectedCount': expected, 'metadata': {'sourceManifestVersion': manifest['version'], 'builtAt': manifest['builtAt'], 'coverage': manifest['coverage']}})
    if initial['status'] == 'active':
        print(json.dumps({'version': version, 'status': 'already_active'}), flush=True)
        return
    print(json.dumps({'version': version, 'files': expected, 'status': 'verified_upload_started'}), flush=True)
    paths = ['manifest.json'] + [f['path'] for f in files]

    def upload(path):
        raw = (root / path).read_bytes()
        query = urllib.parse.urlencode({'version': version, 'path': path})
        result = api('/api/ops/import/file?' + query, 'PUT', raw=raw)
        if result.get('sha256') != hashlib.sha256(raw).hexdigest():
            raise RuntimeError('Server digest mismatch: ' + path)
        return path

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        for count, _ in enumerate(executor.map(upload, paths), 1):
            if count % 25 == 0 or count == expected:
                print(json.dumps({'uploaded': count, 'total': expected}), flush=True)
    result = api('/api/ops/import/commit', 'POST', {'version': version})
    status = api('/api/ops/import/status')
    if result.get('status') != 'active' or status.get('active', {}).get('version') != version:
        raise RuntimeError('Activation readback did not match; inspect import status')
    print(json.dumps({'version': version, 'status': 'active_verified', 'files': expected}), flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Only errors constructed above or filesystem path errors, never config or request headers.
        print('Import stopped: ' + (str(error) if isinstance(error, (RuntimeError, ValueError)) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
