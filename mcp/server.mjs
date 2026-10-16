#!/usr/bin/env node
/** Local stdio MCP server. Reads only index.json; never downloads audio. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

const require = createRequire(import.meta.url);
const { searchSounds, getSound, listCategories, FORMATS } = require('../scripts/sfx-search.js');
const catalog = JSON.parse(readFileSync(new URL('../index.json', import.meta.url), 'utf8'));
if (!Array.isArray(catalog.sounds) || !catalog.sounds.length) {
  throw new Error('index.json does not contain a nonempty sounds array');
}
const sounds = catalog.sounds;

function result(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value
  };
}

serveStdio(() => {
  const server = new McpServer({ name: 'open-game-sfx-index', version: '1.0.0' });

  server.registerTool('search_sfx', {
    title: 'Search game sound effects',
    description: 'Find CC0 game SFX by Korean, English, or Arabic keywords. All meaningful query words match by default (Korean words have English synonyms). Returns ranked direct preview/download URLs with license/source. If no results, retry with match_mode any for clearly marked partial matches, or use simpler terms. Filter by category, pack, format or duration.',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({
      query: z.string().max(160).default('').describe('Sound description, e.g. 폭발, button click, sword hit'),
      category: z.string().optional().describe('Category returned by list_sfx_categories'),
      pack: z.string().optional().describe('Pack returned by list_sfx_categories'),
      format: z.enum(FORMATS).optional(),
      min_duration_sec: z.number().min(0).optional(),
      max_duration_sec: z.number().min(0).optional(),
      match_mode: z.enum(['all', 'any']).default('all'),
      limit: z.number().int().min(1).max(30).default(10)
    })
  }, async args => result(searchSounds(sounds, args)));

  server.registerTool('get_sfx', {
    title: 'Get a sound effect',
    description: 'Look up a single effect by exact ID from search_sfx. Returns full metadata including checksums, license, and original direct audio URLs.',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({ id: z.string().min(1).describe('Exact sound ID') })
  }, async ({ id }) => {
    const sound = getSound(sounds, id);
    return result(sound || { error: 'not_found', id });
  });

  server.registerTool('list_sfx_categories', {
    title: 'List categories and packs',
    description: 'Discover all available categories and sound packs with counts before searching.',
    annotations: { readOnlyHint: true },
    inputSchema: z.object({})
  }, async () => result(listCategories(sounds)));

  return server;
});
