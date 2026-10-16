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

test('agent-style Korean and English sound requests rank a relevant effect first', () => {
  const scenarios = [
    { query: '버튼을 누르는 소리', category: 'ui', expected: /click|button/i },
    { query: '검 휘두르는 소리', expected: /sword|swing/i },
    { query: '좀비 신음소리', category: 'horror', expected: /zombie/i },
    { query: '레이저 발사', expected: /laser/i },
    { query: '마법 발동 효과음', category: 'rpg', expected: /magic|spell/i },
    { query: '문을 열기', expected: /door.*open/i },
    { query: 'confirmation ui', category: 'interface', expected: /confirmation/i },
    { query: 'victory jingle', category: 'music-jingle', expected: /jingle/i },
    { query: 'gravel footsteps', expected: /gravel/i }
  ];
  for (const { query, category, expected } of scenarios) {
    const { total, results } = searchSounds(sounds, { query, category, limit: 3 });
    assert.ok(total > 0, `${query}: no matching sounds`);
    assert.match(results[0].title, expected, `${query}: irrelevant top match`);
    assert.ok(results[0].preview_url, `${query}: missing playable URL`);
    if (category) assert.equal(results[0].category, category);
  }
});

test('partial mode is explicit and reports how many query concepts were matched', () => {
  const query = 'laser notacatalogkeyword';
  assert.equal(searchSounds(sounds, { query }).total, 0);
  const partial = searchSounds(sounds, { query, match_mode: 'any', limit: 4 });
  assert.ok(partial.total > 0);
  assert.equal(partial.match_mode, 'any');
  assert.equal(partial.query_terms, 2);
  assert.equal(partial.results[0].matched_terms, 1);
  assert.match(partial.results[0].title, /laser/i);
  assert.equal(searchSounds(sounds, { query: 'notacatalogkeyword', match_mode: 'any' }).total, 0);
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
