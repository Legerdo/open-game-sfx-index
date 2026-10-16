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
    assert.equal(categories.structuredContent.total_sounds, 1451);

    const search = await client.callTool({ name: 'search_sfx',
      arguments: { query: '클릭', category: 'ui', limit: 3 } });
    assert.ok(search.structuredContent.results.length > 0);
    assert.ok(search.structuredContent.results.length <= 3);

    const id = search.structuredContent.results[0].id;
    const detail = await client.callTool({ name: 'get_sfx', arguments: { id } });
    assert.equal(detail.structuredContent.id, id);
    assert.ok(detail.structuredContent.preview_url);
  } finally {
    await client.close();
  }
});
