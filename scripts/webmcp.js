/* WebMCP integration. Only registers tools in browsers exposing
 * document.modelContext; the website works normally everywhere else.
 */
(function (root, factory) {
  const search = typeof module !== 'undefined' && module.exports
    ? require('./sfx-search.js') : root.SfxSearch;
  const api = factory(search);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SfxWebMcp = api;
})(typeof window !== 'undefined' ? window : null, function (search) {
  'use strict';

  let registration;

  function toolDefinitions(getItems, playSound) {
    return [
      {
        name: 'search_sfx',
        description: 'Search the CC0 game sound effects catalog by Korean, English, or Arabic keywords. Rank matches and return direct preview/download URLs. Filter by category, pack, format, and duration. Search matches all query words.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', maxLength: 160, description: 'Describe the sound, e.g. 폭발, sword hit, button click' },
            category: { type: 'string', description: 'Optional category from list_sfx_categories' },
            pack: { type: 'string', description: 'Optional pack name from list_sfx_categories' },
            format: { type: 'string', enum: search.FORMATS },
            min_duration_sec: { type: 'number', minimum: 0 },
            max_duration_sec: { type: 'number', minimum: 0 },
            limit: { type: 'integer', minimum: 1, maximum: 30, default: 10 }
          },
          additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async args => search.searchSounds(getItems(), args)
      },
      {
        name: 'get_sfx',
        description: 'Retrieve one game sound effect by its exact ID, with its metadata, license, and direct download URLs. Use an ID returned by search_sfx.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Exact sound ID' } },
          required: ['id'], additionalProperties: false
        },
        annotations: { readOnlyHint: true },
        execute: async ({ id }) => search.getSound(getItems(), id) || { error: 'not_found', id }
      },
      {
        name: 'list_sfx_categories',
        description: 'List available sound effect categories and packs with counts. Use this to select search filters.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: async () => search.listCategories(getItems())
      },
      {
        name: 'preview_sfx',
        description: 'Play the given sound in this browser tab so the user can audition it. May require a user gesture or browser permission. Returns the direct audio URL even when playback is blocked.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Exact sound ID' } },
          required: ['id'], additionalProperties: false
        },
        annotations: { readOnlyHint: false },
        execute: async ({ id }) => {
          const sound = getItems().find(item => item.id === id);
          if (!sound) return { error: 'not_found', id };
          try {
            const playing = await playSound(sound);
            return { id, playing: Boolean(playing), preview_url: search.soundSummary(sound).preview_url };
          } catch (error) {
            return { id, playing: false, error: 'playback_failed',
              message: String(error?.message || error), preview_url: search.soundSummary(sound).preview_url };
          }
        }
      }
    ];
  }

  function registerTools({ context, getItems, playSound }) {
    if (!context || typeof context.registerTool !== 'function') return Promise.resolve(false);
    if (registration) return registration;
    registration = Promise.all(toolDefinitions(getItems, playSound)
      .map(tool => Promise.resolve().then(() => context.registerTool(tool))))
      .then(() => true).catch(error => {
        // WebMCP is experimental; registration problems must not break browsing.
        console.warn('WebMCP tools unavailable:', error);
        return false;
      });
    return registration;
  }

  return { registerTools, toolDefinitions };
});
