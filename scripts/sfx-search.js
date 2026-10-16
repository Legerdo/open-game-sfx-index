/* Shared search engine for the SFX Atlas website and the MCP server.
 * This file is intentionally dependency-free and works in browsers and Node.js.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SfxSearch = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const FORMATS = ['ogg', 'mp3', 'wav', 'flac'];
  const GENERIC_WORDS = new Set([
    '효과음', '효과', '소리', '사운드', '음향', '주세요', '찾아줘',
    '찾아', '부탁', '원해', '해줘', '나는', '나오는', '같은', '위한', '때', '게임',
    'sound', 'sounds', 'effect', 'effects', 'sfx', 'audio', 'please',
    'صوت', 'صوتي'
  ]);
  const ALIASES = {
    '클릭': ['click', 'tap'], '버튼': ['button', 'click'], '탭': ['tap', 'click'],
    '클릭할': ['click', 'tap'], '누르는': ['button', 'click', 'press'],
    '폭발': ['explosion', 'explode'], '폭발음': ['explosion', 'explode'],
    '충돌': ['impact', 'collision', 'hit'],
    '타격': ['hit', 'punch'], '점프': ['jump'], '코인': ['coin', 'pickup'],
    '동전': ['coin'], '승리': ['win', 'victory', 'fanfare'], '실패': ['lose', 'error'],
    '카드': ['card'], '주사위': ['dice'], '레이저': ['laser'], '우주': ['space', 'sci-fi'],
    '좀비': ['zombie'], '공포': ['horror'], '목소리': ['voice'], '발소리': ['footstep'],
    '신음': ['growl', 'groan', 'moan'], '신음소리': ['growl', 'groan', 'moan'],
    '울음': ['growl', 'roar', 'moan'], '괴물': ['monster', 'creature'],
    '전투': ['battle', 'fight'], '방어': ['shield'], '게임': ['game'], '메뉴': ['menu', 'ui'],
    '알림': ['notification'], '축하': ['win', 'jingle'], '음악': ['music', 'jingle'],
    '종이': ['paper'], '바람': ['wind', 'whoosh'], '비행기': ['airplane', 'engine', 'whoosh'],
    '발자국': ['footstep', 'step'], '발걸음': ['footstep', 'step'], '자갈': ['gravel'],
    '검': ['sword', 'swing', 'melee'], '칼': ['sword', 'swing', 'melee'],
    '베기': ['sword', 'swing', 'melee'], '휘두르는': ['swing', 'sword', 'whoosh'],
    '휘두를': ['swing', 'sword', 'whoosh'],
    '공격': ['attack', 'hit'], '피격': ['hit', 'damage'],
    '마법': ['magic', 'spell'], '총': ['gun', 'shot'],
    '아이템': ['item', 'pickup'], '획득': ['pickup', 'collect'],
    '문': ['door'], '걷기': ['footstep', 'walk'],
    '열기': ['open', 'opening', 'dooropen'], '열리는': ['open', 'opening', 'dooropen'],
    '발사': ['laser', 'shoot', 'shot', 'fire'], '발동': ['magic', 'spell', 'powerup'],
    '시전': ['spell', 'magic', 'cast'], '획득음': ['pickup', 'coin'],
    'ui': ['ui', 'interface'], 'confirmation': ['confirmation', 'confirm'],
    'victory': ['victory', 'win', 'fanfare'], 'winning': ['win', 'victory'],
    'sword': ['sword', 'swing', 'melee'], 'swing': ['swing', 'sword', 'whoosh'],
    'laser': ['laser'], 'shooting': ['shoot', 'shot', 'fire'],
    'footsteps': ['footstep', 'footsteps', 'walk'],
    'opening': ['open', 'opening', 'dooropen']
  };

  const PARTICLES = ['에서', '에게', '으로', '처럼', '까지', '부터',
    '을', '를', '이', '가', '은', '는', '에', '도', '로', '와', '과', '의'];

  function normalizeWord(word) {
    if (ALIASES[word] || GENERIC_WORDS.has(word)) return word;
    // Korean grammatical particles often attach to a word, e.g. "문을", "버튼을".
    for (const ending of PARTICLES) {
      if (!word.endsWith(ending)) continue;
      const stem = word.slice(0, -ending.length);
      if (ALIASES[stem] || GENERIC_WORDS.has(stem)) return stem;
    }
    return word;
  }

  function parseQuery(query) {
    return (String(query || '').toLowerCase().match(/[\p{L}\p{M}\p{N}_-]+/gu) || [])
      .map(normalizeWord)
      .filter(piece => !GENERIC_WORDS.has(piece))
      .map(piece => ALIASES[piece] || [piece]);
  }

  // All query terms must match. Korean aliases are alternatives within a term.
  function scoreSound(sound, terms) {
    if (!terms.length) return 0;
    const title = String(sound.title || '').toLowerCase();
    const tags = (sound.tags || []).join(' ').toLowerCase();
    const extra = [sound.pack, sound.category, ...(sound.use_cases || []),
      ...(sound.mood || []), ...(sound.keywords_en || []),
      ...(sound.keywords_ar || [])].join(' ').toLowerCase();
    let score = 0;
    for (const group of terms) {
      let highest = 0;
      for (const token of group) {
        if (title.includes(token)) highest = Math.max(highest, 6);
        if (tags.includes(token)) highest = Math.max(highest, 4);
        if (extra.includes(token)) highest = Math.max(highest, 2);
      }
      if (!highest) return -1;
      score += highest;
    }
    return score;
  }

  // Metadata comes from the catalog, never from an agent-provided URL.
  function audioURL(sound, format) {
    const value = sound[`download_url_${format}`];
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.hostname !== 'raw.githubusercontent.com') return null;
      if (!/^\/[^/]+\/open-game-sfx-index\/[^/]+\/audio\//.test(url.pathname)) return null;
      return value;
    } catch { return null; }
  }

  function soundURLs(sound) {
    const urls = {};
    for (const format of FORMATS) {
      const url = audioURL(sound, format);
      if (url) urls[format] = url;
    }
    return urls;
  }

  function soundSummary(sound) {
    const download_urls = soundURLs(sound);
    return {
      id: sound.id,
      title: sound.title,
      category: sound.category,
      pack: sound.pack,
      tags: sound.tags || [],
      use_cases: sound.use_cases || [],
      mood: sound.mood || [],
      duration_sec: sound.duration_sec,
      formats: Object.keys(download_urls),
      preview_url: download_urls.mp3 || download_urls.ogg || download_urls.wav || download_urls.flac || null,
      download_urls,
      license: sound.license,
      source: sound.source
    };
  }

  function getSound(items, id) {
    const sound = items.find(item => item.id === id);
    if (!sound) return null;
    return { ...sound, ...soundSummary(sound) };
  }

  function listCategories(items) {
    const categories = new Map();
    const packs = new Map();
    for (const sound of items) {
      categories.set(sound.category, (categories.get(sound.category) || 0) + 1);
      packs.set(sound.pack, (packs.get(sound.pack) || 0) + 1);
    }
    return {
      total_sounds: items.length,
      categories: [...categories].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count })),
      packs: [...packs].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, count]) => ({ name, count }))
    };
  }

  function searchSounds(items, {
    query = '', category, pack, format, max_duration_sec, min_duration_sec, limit = 10,
    match_mode = 'all'
  } = {}) {
    const terms = parseQuery(query);
    const matches = [];
    for (const sound of items) {
      if (category && sound.category !== category) continue;
      if (pack && sound.pack !== pack) continue;
      if (format && !audioURL(sound, format)) continue;
      const duration = Number(sound.duration_sec);
      if (max_duration_sec !== undefined && (!Number.isFinite(duration) || duration > max_duration_sec)) continue;
      if (min_duration_sec !== undefined && (!Number.isFinite(duration) || duration < min_duration_sec)) continue;
      const score = scoreSound(sound, terms);
      if (match_mode === 'any' && terms.length) {
        const groupScores = terms.map(group => scoreSound(sound, [group]));
        const matched_terms = groupScores.filter(s => s > 0).length;
        if (!matched_terms) continue;
        matches.push({ sound, score: groupScores.reduce((sum, s) => sum + Math.max(0, s), 0), matched_terms });
      } else {
        if (score < 0) continue;
        matches.push({ sound, score, matched_terms: terms.length });
      }
    }
    matches.sort((a, b) => b.matched_terms - a.matched_terms || b.score - a.score ||
      String(a.sound.title || '').localeCompare(String(b.sound.title || ''), 'en') ||
      a.sound.id.localeCompare(b.sound.id, 'en'));
    const count = Math.min(30, Math.max(1, Number.isFinite(limit) ? Math.trunc(limit) : 10));
    return {
      query: String(query || ''),
      match_mode: match_mode === 'any' ? 'any' : 'all',
      query_terms: terms.length,
      total: matches.length,
      results: matches.slice(0, count).map(({ sound, score, matched_terms }) =>
        ({ ...soundSummary(sound), score, matched_terms }))
    };
  }

  return { FORMATS, parseQuery, scoreSound, soundSummary, getSound, listCategories, searchSounds };
});
