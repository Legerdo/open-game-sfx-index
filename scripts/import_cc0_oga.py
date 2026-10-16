#!/usr/bin/env python3
"""Import selected OpenGameArt CC0 ZIP packs without duplicating existing SFX.

The importer rechecks the official asset page's CC0 badge and archive link,
validates ZIP entries, decodes each audio file, and rejects duplicate bytes or
identical decoded PCM. It never overwrites existing audio or trusts ZIP paths.

Dependencies: pip install -r scripts/requirements-import.txt
Run: python scripts/import_cc0_oga.py
"""

import hashlib
import html
import json
import pathlib
import re
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from datetime import datetime, timezone

import soundfile as sf

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'scripts' / 'cc0_oga_packs.json'
AUDIT = ROOT / 'docs' / 'CC0_IMPORT_AUDIT.json'
STAGING = ROOT / '_tmp' / 'cc0_import'
EXTENSIONS = {'.wav', '.ogg', '.flac', '.mp3', '.aiff', '.aif'}
MAX_ARCHIVE_BYTES = 60 * 1024 * 1024
MAX_FILE_BYTES = 80 * 1024 * 1024
MAX_EXPANDED_BYTES = 400 * 1024 * 1024


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def pcm_fingerprint(path):
    """Decoded 16-bit PCM content signature including rate and channel count.

    This catches losslessly repackaged audio (WAV vs FLAC) and identical PCM
    files with different headers. It does not claim to detect altered audio.
    """
    digest = hashlib.sha256()
    with sf.SoundFile(str(path)) as handle:
        if handle.frames < 1 or handle.samplerate <= 0:
            raise ValueError('Empty or invalid audio')
        digest.update(f'{handle.samplerate}:{handle.channels}:{handle.frames}:'.encode('ascii'))
        while True:
            frames = handle.read(65536, dtype='int16', always_2d=True)
            if not len(frames):
                break
            digest.update(frames.tobytes())
    return digest.hexdigest()


def request(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; cc0-audit/1.0)'})
    return urllib.request.urlopen(req, timeout=45)


def require_cc0(page, archive):
    with request(page) as response:
        markup = response.read(1024 * 1024).decode('utf-8', 'replace')
    # OpenGameArt's license-icon field is the asset's own declared license.
    if 'license_images/cc0' not in markup.lower() or 'publicdomain/zero/1.0' not in markup.lower():
        raise ValueError(f'No explicit CC0 license badge on {page}')
    links = re.findall(r'href\s*=\s*[\x22\x27]([^\x22\x27]+)[\x22\x27]', markup, flags=re.I)
    if archive not in [html.unescape(link) for link in links]:
        raise ValueError(f'Configured archive is absent from the official asset page: {archive}')


def retrieve_archive(archive_url, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        target.unlink()  # do not reuse an unverified / partially downloaded ZIP
    total = 0
    with request(archive_url) as source, target.open('wb') as output:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            total += len(block)
            if total > MAX_ARCHIVE_BYTES:
                raise ValueError(f'Archive exceeds size limit: {archive_url}')
            output.write(block)
    if not zipfile.is_zipfile(target):
        raise ValueError(f'Not a valid ZIP: {archive_url}')


def archive_entries(zipped):
    candidates = []
    expanded_size = 0
    for info in zipped.infolist():
        name = info.filename.replace('\\', '/')
        rel = pathlib.PurePosixPath(name)
        if info.is_dir() or not name or name.startswith('/') or '..' in rel.parts:
            continue
        if any(s.startswith('.') or s == '__MACOSX' for s in rel.parts):
            continue
        if rel.suffix.lower() not in EXTENSIONS or 'preview' in rel.stem.lower():
            continue
        if info.file_size > MAX_FILE_BYTES:
            raise ValueError(f'Unexpectedly large audio file: {name}')
        expanded_size += info.file_size
        if expanded_size > MAX_EXPANDED_BYTES:
            raise ValueError('Total uncompressed audio exceeds archive limit')
        if (info.external_attr >> 16) & 0o170000 == 0o120000:
            raise ValueError(f'Symlink is not an audio file: {name}')
        candidates.append((info, rel))
    return candidates


def fingerprint_existing():
    raw, decoded = {}, {}
    count = 0
    for path in sorted((ROOT / 'audio').rglob('*')):
        if not path.is_file() or path.suffix.lower() not in EXTENSIONS:
            continue
        identifier = path.relative_to(ROOT).as_posix()
        raw.setdefault(sha256_file(path), identifier)
        decoded.setdefault(pcm_fingerprint(path), identifier)
        count += 1
    print(f'Existing decoded audio fingerprinted: {count}', flush=True)
    return raw, decoded


def import_one(pack, raw, decoded):
    pack_id = pack['pack']
    directory = ROOT / 'audio' / pack_id
    if directory.exists() and any(directory.rglob('*')):
        raise ValueError(f'Pack directory exists, refusing to overwrite: {directory}')
    if not pack['page'].startswith('https://opengameart.org/content/'):
        raise ValueError('Untrusted page URL')
    if not pack['archive'].startswith('https://opengameart.org/sites/default/files/'):
        raise ValueError('Untrusted archive URL')
    print(f'Checking license: {pack_id}', flush=True)
    require_cc0(pack['page'], pack['archive'])
    archive = STAGING / f'{pack_id}.zip'
    retrieve_archive(pack['archive'], archive)
    report = {
        'pack': pack_id, 'source': pack['page'], 'author': pack['author'],
        'license': 'CC0-1.0', 'archive': pack['archive'],
        'license_verified_at_utc': datetime.now(timezone.utc).isoformat(),
        'archive_sha256': sha256_file(archive), 'archive_bytes': archive.stat().st_size,
        'original_audio': 0, 'included': 0, 'duplicate_bytes': 0,
        'duplicate_pcm': 0, 'discarded': [],
    }
    try:
        with tempfile.TemporaryDirectory(prefix='extract-', dir=STAGING) as temp_name:
            temp = pathlib.Path(temp_name)
            with zipfile.ZipFile(archive) as zipped:
                bad = zipped.testzip()
                if bad is not None:
                    raise ValueError(f'ZIP CRC failed: {bad}')
                entries = archive_entries(zipped)
                if not entries:
                    raise ValueError(f'No audio in archive: {pack_id}')
                if len(entries) < pack['expected'] * 0.70:
                    raise ValueError(f'Too few audio entries ({len(entries)}) for {pack_id}')
                report['original_audio'] = len(entries)
                # Strip packaging folder only if every audio shares that prefix.
                strip_first = all(len(rel.parts) > 1 and rel.parts[0] == entries[0][1].parts[0]
                                  for _, rel in entries)
                for offset, (info, rel) in enumerate(entries):
                    parts = rel.parts[1:] if strip_first else rel.parts
                    target_rel = pathlib.Path(*parts)
                    source = temp / f'{offset}{target_rel.suffix.lower()}'
                    with zipped.open(info) as input_file, source.open('wb') as output:
                        shutil.copyfileobj(input_file, output)
                    # Fail closed on any file that the audio decoder cannot read.
                    raw_key = sha256_file(source)
                    decoded_key = pcm_fingerprint(source)
                    prev = raw.get(raw_key)
                    if prev:
                        report['duplicate_bytes'] += 1
                        report['discarded'].append({'path': rel.as_posix(), 'reason': 'identical_bytes', 'duplicate_of': prev})
                        continue
                    prev = decoded.get(decoded_key)
                    if prev:
                        report['duplicate_pcm'] += 1
                        report['discarded'].append({'path': rel.as_posix(), 'reason': 'identical_decoded_pcm', 'duplicate_of': prev})
                        continue
                    destination = directory / target_rel
                    if destination.exists():
                        raise ValueError(f'Target name collision: {destination}')
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source, destination)
                    identifier = destination.relative_to(ROOT).as_posix()
                    raw[raw_key] = identifier
                    decoded[decoded_key] = identifier
                    report['included'] += 1
        print(f'  {pack_id}: {report["included"]} kept / {report["original_audio"]} extracted '
              f'(byte dupes={report["duplicate_bytes"]}, PCM dupes={report["duplicate_pcm"]})', flush=True)
        return report
    finally:
        archive.unlink(missing_ok=True)


def main():
    packs = json.loads(MANIFEST.read_text('utf-8'))
    previous_audit = json.loads(AUDIT.read_text('utf-8')) if AUDIT.exists() else {}
    previous = {record['pack']: record for record in previous_audit.get('packs', [])}
    raw, decoded = fingerprint_existing()
    reports = []
    for pack in packs:
        directory = ROOT / 'audio' / pack['pack']
        if directory.exists():
            record = previous.get(pack['pack'])
            if not record or record['source'] != pack['page'] or record['archive'] != pack['archive']:
                raise ValueError(f'Existing pack has no matching audited source: {pack["pack"]}')
            count = sum(f.is_file() and f.suffix.lower() in EXTENSIONS for f in directory.rglob('*'))
            if record['included'] != count:
                raise ValueError(f'Previously imported pack has unexpected file count: {pack["pack"]}')
            print(f'Already audited: {pack["pack"]} ({count} sounds)', flush=True)
            reports.append(record)
        else:
            reports.append(import_one(pack, raw, decoded))
    payload = {
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'license_proof': 'Official OpenGameArt pack license field declares CC0 (verified at import)',
        'deduplication': 'SHA-256 of source bytes and SHA-256 of decoded 16-bit PCM including rate/channels/frame count',
        'packs': reports,
    }
    AUDIT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Imported {sum(p["included"] for p in reports)} distinct sounds from {len(reports)} CC0 packs', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as err:
        print(f'IMPORT FAILED: {err}', file=sys.stderr)
        raise
