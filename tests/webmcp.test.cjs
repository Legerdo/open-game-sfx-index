const test = require('node:test');
const assert = require('node:assert/strict');
const { sounds } = require('../index.json');
const { registerTools, toolDefinitions } = require('../scripts/webmcp.js');

test('WebMCP exposes search, detail, inventory and user-visible preview tools', async () => {
  const played = [];
  const tools = toolDefinitions(() => sounds, async sound => { played.push(sound.id); return true; });
  assert.deepEqual(tools.map(tool => tool.name),
    ['search_sfx', 'get_sfx', 'list_sfx_categories', 'preview_sfx']);
  assert.equal(tools[0].annotations.readOnlyHint, true);
  assert.equal(tools[3].annotations.readOnlyHint, false);

  const matches = await tools[0].execute({ query: '폭발', limit: 3 });
  assert.ok(matches.results.length > 0);
  assert.ok(matches.results.length <= 3);
  assert.deepEqual(tools[0].inputSchema.properties.match_mode.enum, ['all', 'any']);
  const natural = await tools[0].execute({ query: '문 열기', limit: 3 });
  assert.match(natural.results[0].title, /door.*open/i);
  const partial = await tools[0].execute({ query: 'zombie unknownterm', match_mode: 'any', limit: 3 });
  assert.equal(partial.results[0].matched_terms, 1);
  const detail = await tools[1].execute({ id: matches.results[0].id });
  assert.equal(detail.id, matches.results[0].id);
  assert.match(detail.preview_url, /^https:\/\//);
  assert.equal((await tools[1].execute({ id: 'not-there' })).error, 'not_found');

  const categories = await tools[2].execute({});
  assert.equal(categories.total_sounds, sounds.length);
  const playback = await tools[3].execute({ id: detail.id });
  assert.equal(playback.playing, true);
  assert.deepEqual(played, [detail.id]);
});

test('WebMCP registers only when browser API is available', async () => {
  assert.equal(await registerTools({ context: null, getItems: () => sounds, playSound: async () => true }), false);
  const names = [];
  const context = { registerTool: async tool => { names.push(tool.name); } };
  assert.equal(await registerTools({ context, getItems: () => sounds, playSound: async () => true }), true);
  assert.deepEqual(names, ['search_sfx', 'get_sfx', 'list_sfx_categories', 'preview_sfx']);
});
