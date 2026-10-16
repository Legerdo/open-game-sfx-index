const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const catalog = require('../index.json');
const categories = require('../categories.json');
const manifest = require('../scripts/cc0_oga_packs.json');
const audit = require('../docs/CC0_IMPORT_AUDIT.json');
const rfc3986Encode = segment => encodeURIComponent(segment).replace(/[!'()*]/g,
  char => '%' + char.charCodeAt(0).toString(16).toUpperCase());

test('all sounds have distinct resolvable IDs and the correct category coverage', () => {
  assert.equal(catalog.count, 2186);
  assert.equal(catalog.sounds.length, 2186);
  assert.equal(new Set(catalog.sounds.map(s => s.id)).size, catalog.sounds.length);
  assert.equal(catalog.batches.length, 28);
  assert.equal(new Set(categories.categories.map(c => c.id)).size, categories.categories.length);
  for (const item of catalog.sounds) {
    assert.ok(item.id && item.title && item.pack && item.source, `incomplete metadata: ${item.id}`);
    assert.ok(item.duration_sec > 0, `missing duration: ${item.id}`);
    assert.equal(item.license, 'CC0-1.0');
    const group = categories.categories.find(c => c.id === item.category);
    assert.ok(group?.packs.includes(item.pack), `missing category mapping for ${item.id}`);
  }
});

test('the 10 new packs preserve 735 distinct sounds and audited CC0 provenance', () => {
  assert.equal(manifest.length, 10);
  assert.equal(audit.packs.length, manifest.length);
  const newPackNames = new Set(manifest.map(p => p.pack));
  assert.equal(manifest.reduce((sum, item) => sum + item.expected, 0), 735);
  assert.equal(catalog.sounds.filter(s => newPackNames.has(s.pack)).length, 735);
  for (const pack of manifest) {
    const related = catalog.sounds.filter(sound => sound.pack === pack.pack);
    const record = audit.packs.find(p => p.pack === pack.pack);
    assert.ok(record, `Missing import report for ${pack.pack}`);
    assert.equal(related.length, pack.expected);
    assert.equal(record.included, related.length);
    assert.equal(record.original_audio, related.length);
    assert.equal(record.duplicate_bytes + record.duplicate_pcm, 0);
    assert.equal(record.archive, pack.archive);
    assert.match(record.archive_sha256, /^[a-f0-9]{64}$/);
    assert.equal(record.license, 'CC0-1.0');
    for (const sound of related) {
      assert.equal(sound.source, pack.page);
      assert.equal(sound.author, pack.author);
      assert.equal(sound.source_archive, pack.archive);
      assert.equal(sound.category, pack.category);
    }
  }
});

test('every indexed file exists and matches its declared byte size and SHA-256', { timeout: 60000 }, () => {
  let checked = 0;
  const rawFingerprints = new Map();
  const newPacks = new Set(manifest.map(p => p.pack));
  // Old audio first, then new audio. A new file may not duplicate an existing
  // file or another newly imported file, independent of entry sorting.
  const ordered = [...catalog.sounds].sort((a, b) => Number(newPacks.has(a.pack)) - Number(newPacks.has(b.pack)));
  for (const sound of ordered) {
    for (const format of sound.formats) {
      const relative = sound[`file_${format}`];
      assert.ok(relative?.startsWith('audio/'), `invalid file path: ${sound.id}`);
      const absolute = path.resolve(__dirname, '..', relative);
      assert.ok(absolute.startsWith(path.resolve(__dirname, '..', 'audio') + path.sep));
      const bytes = fs.readFileSync(absolute);
      const digest = crypto.createHash('sha256').update(bytes).digest('hex');
      assert.equal(bytes.length, sound[`size_${format}`], `incorrect size for ${relative}`);
      assert.equal(digest, sound[`sha256_${format}`], `incorrect SHA for ${relative}`);
      const prev = rawFingerprints.get(digest);
      if (newPacks.has(sound.pack)) assert.equal(prev, undefined, `Duplicate new audio: ${relative} duplicates ${prev}`);
      rawFingerprints.set(digest, relative);
      assert.equal(sound[`download_url_${format}`],
        'https://raw.githubusercontent.com/Legerdo/open-game-sfx-index/main/' +
        relative.split('/').map(rfc3986Encode).join('/'));
      checked += 1;
    }
  }
  assert.equal(checked, 2186);
});
