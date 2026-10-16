const test = require('node:test');
const assert = require('node:assert/strict');
const { sounds } = require('../index.json');
const { searchSounds, getSound, listCategories, soundSummary } = require('../scripts/sfx-search.js');

test('Korean and English keyword searches return useful ranked matches', () => {
  for (const query of ['클릭', 'click', '폭발', 'explosion', 'زر']) {
    const response = searchSounds(sounds, { query, limit: 5 });
    assert.ok(response.total > 0, `No matches for ${query}`);
    assert.ok(response.results.length <= 5);
    assert.ok(response.results[0].score > 0);
    assert.ok(response.results.every(hit => hit.preview_url && hit.license === 'CC0-1.0'));
  }
  assert.equal(searchSounds(sounds, { query: '폭발 효과음' }).total,
    searchSounds(sounds, { query: '폭발' }).total);
  assert.equal(searchSounds(sounds, { query: 'explosion sound effects' }).total,
    searchSounds(sounds, { query: 'explosion' }).total);
});

test('all search terms must match, and category/format/duration filters are applied together', () => {
  assert.equal(searchSounds(sounds, { query: 'click nonexistent-sfx-xyz' }).total, 0);
  const matches = searchSounds(sounds, {
    query: 'click', category: 'ui', format: 'ogg', max_duration_sec: 1, limit: 30
  });
  assert.ok(matches.total > 0);
  for (const hit of matches.results) {
    assert.equal(hit.category, 'ui');
    assert.ok(hit.formats.includes('ogg'));
    assert.ok(hit.duration_sec <= 1);
  }
  assert.ok(searchSounds(sounds, { query: 'click', limit: 10_000 }).results.length <= 30);
});

test('exact ID returns source and download fields; missing IDs do not guess', () => {
  const hit = getSound(sounds, 'casino-audio_card-fan-1');
  assert.ok(hit);
  assert.equal(hit.id, 'casino-audio_card-fan-1');
  assert.ok(hit.download_urls.ogg.endsWith('.ogg'));
  assert.match(hit.sha256_ogg, /^[a-f0-9]{64}$/);
  assert.equal(getSound(sounds, 'missing-audio'), null);
});

test('category and pack counts match full catalog', () => {
  const inventory = listCategories(sounds);
  assert.equal(inventory.total_sounds, sounds.length);
  assert.equal(inventory.categories.reduce((sum, cat) => sum + cat.count, 0), sounds.length);
  assert.equal(inventory.packs.reduce((sum, pack) => sum + pack.count, 0), sounds.length);
});

test('invalid download URLs do not escape to arbitrary remote hosts', () => {
  const unsafe = {
    id: 'test', title: 'Unsafe', pack: 'x', category: 'ui', formats: ['ogg'],
    download_url_ogg: 'https://example.com/track.ogg', license: 'CC0-1.0'
  };
  assert.deepEqual(soundSummary(unsafe).download_urls, {});
  assert.equal(soundSummary(unsafe).preview_url, null);
  assert.equal(searchSounds([unsafe], { format: 'ogg' }).total, 0);
});
