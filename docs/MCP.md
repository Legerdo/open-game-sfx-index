# Agent search with WebMCP and MCP

This repository contains **1,451 CC0 game sound effects** indexed by title,
category, tags, use cases, mood, duration and available audio formats.
The tools below return small, ranked JSON responses with **direct preview and
download URLs**, so agents do not need to download all 1,451 audio files.

## 1. WebMCP (browser agents)

Open **https://legerdo.github.io/open-game-sfx-index/** in a WebMCP-capable
browser. When `document.modelContext.registerTool` is supported, the page
registers four tools automatically:

| Tool | Inputs | Result |
|------|--------|--------|
| `search_sfx` | `query`, optionally `category`, `pack`, `format`, `min_duration_sec`, `max_duration_sec`, `limit` | Ranked effects, scores, durations, licenses, original audio URLs |
| `get_sfx` | `id` | Exact sound metadata, checksums, formats, source and URLs |
| `list_sfx_categories` | none | Available categories and packs with counts |
| `preview_sfx` | `id` | Plays the sound in the page and returns playback status and preview URL |

WebMCP is an **experimental browser API**: it requires a supported Chrome
version/configuration and a secure site context. Normal web search, playback,
download and favorites continue to work in browsers without the API.
`preview_sfx` may report `playing: false` if the browser blocks autoplay; the
returned `preview_url` can still be opened directly. WebMCP tools are exposed
to the agent attached to the page and are **not an HTTP MCP endpoint**.

## 2. Standard MCP over stdio (coding agents)

Requires Node.js 20+ and npm. Clone the repository, then run:

```powershell
git clone https://github.com/Legerdo/open-game-sfx-index.git
cd open-game-sfx-index
npm ci
node mcp/server.mjs
```

The server uses the official MCP TypeScript SDK v2. Configure your MCP client
to spawn this script. For example, in a client accepting `mcpServers` JSON on
Windows 11 (replace the path with your checkout):

```json
{
  "mcpServers": {
    "game-sfx": {
      "command": "node",
      "args": ["C:\\Projects\\open-game-sfx-index\\mcp\\server.mjs"]
    }
  }
}
```

MCP clients using TOML or another configuration format need the equivalent
`command` and `args` settings. Restart/reconnect your MCP client after setup.

The stdio server provides `search_sfx`, `get_sfx`, and `list_sfx_categories`.
It performs **local reads of `index.json` only**, without API keys, remote
queries, or audio downloads. It returns catalog download URLs unchanged so
the agent can fetch only the chosen file. Those URLs currently point to the
upstream public repository that hosts the sounds.

## 3. Example agent workflow

Ask: **"1초 이내의 UI 버튼 클릭 효과음 3개를 찾아줘"**.

1. Call `search_sfx` with:

   ```json
   { "query": "클릭", "category": "ui", "max_duration_sec": 1, "limit": 3 }
   ```

2. Inspect the `results` entries (IDs, score, duration, license,
   `preview_url`, `download_urls`) and audition the preview URLs. A browser
   agent can also call `preview_sfx` with a result ID.
3. Call `get_sfx` with the selected ID for its checksum and metadata.
4. Download only the desired `download_urls.ogg`/`.mp3`/`.wav`/`.flac` URL.

Search requires **all query words** to match at least one metadata field;
individual Korean words use an English synonym map. It is keyword retrieval,
not sound similarity search or audio recognition. If the result set is empty,
try a broader term, or use `list_sfx_categories` to narrow by category/pack.
Only formats actually provided by each file are returned. Never assume an
MP3 or OGG variant exists if it is absent from `formats`.

## 4. Validation

```powershell
npm ci
npm test
```

Tests cover Korean/English/Arabic search, filtering, URL handling, browser
tool registration and live MCP stdio protocol calls. The browser's native
WebMCP API must be validated separately on a compatible browser: the test
suite checks tool registration and execution through a controlled API mock.
