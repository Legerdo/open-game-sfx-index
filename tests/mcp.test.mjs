import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath } from 'node:url';

test('MCP stdio client can discover and call the live server', { timeout: 15_000 }, async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../mcp/server.mjs', import.meta.url))]
  });
  const client = new Client({ name: 'sfx-integration-test', version: '1.0.0' });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name).sort(),
      ['get_sfx', 'list_sfx_categories', 'search_sfx']);

    const categories = await client.callTool({ name: 'list_sfx_categories', arguments: {} });
    assert.equal(categories.structuredContent.total_sounds, 2186);

    const search = await client.callTool({ name: 'search_sfx',
      arguments: { query: '클릭', category: 'ui', limit: 3 } });
    assert.ok(search.structuredContent.results.length > 0);
    assert.ok(search.structuredContent.results.length <= 3);

    const id = search.structuredContent.results[0].id;
    const detail = await client.callTool({ name: 'get_sfx', arguments: { id } });
    assert.equal(detail.structuredContent.id, id);
    assert.ok(detail.structuredContent.preview_url);

    for (const [query, expectedCategory] of [
      ['좀비 신음소리', 'horror'],
      ['마법 발동 효과음', 'rpg'],
      ['victory jingle', 'music-jingle'],
      ['confirmation ui', 'interface']
    ]) {
      const found = await client.callTool({ name: 'search_sfx', arguments: { query, limit: 3 } });
      assert.ok(found.structuredContent.total > 0, query);
      assert.equal(found.structuredContent.results[0].category, expectedCategory, query);
    }

    const partial = await client.callTool({ name: 'search_sfx', arguments: {
      query: 'door not-in-catalog', match_mode: 'any', limit: 3
    } });
    assert.ok(partial.structuredContent.total > 0);
    assert.equal(partial.structuredContent.results[0].matched_terms, 1);

    const newSearch = await client.callTool({ name: 'search_sfx', arguments: {
      query: 'splash', pack: 'oga-rubberduck-water-40', limit: 5
    } });
    assert.ok(newSearch.structuredContent.total > 0);
    const newSound = newSearch.structuredContent.results[0];
    assert.equal(newSound.author, 'rubberduck');
    assert.equal(newSound.license, 'CC0-1.0');
    assert.equal(newSound.source, 'https://opengameart.org/content/40-cc0-water-splash-slime-sfx');
    assert.match(newSound.source_archive, /water-splash-slime-sfx\.zip$/);
    const newDetail = await client.callTool({ name: 'get_sfx', arguments: { id: newSound.id } });
    assert.equal(newDetail.structuredContent.source_archive, newSound.source_archive);
  } finally {
    await client.close();
  }
});
