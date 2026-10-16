# Attribution & License Proof

This repo is an **independent index**. It is **not affiliated with, sponsored, or endorsed by**
Kenney, OpenGameArt, or any listed author.

CC0 = public domain. You may copy, modify, distribute, and use the sounds
for any purpose (including commercial) **without asking permission and without attribution**.
Credit is appreciated but not legally required.

## Source 1 — Kenney (kenney.nl)

- Collection: https://kenney.nl/assets/category:Audio
- License for every pack: **Creative Commons CC0 1.0 Universal**
  (https://creativecommons.org/publicdomain/zero/1.0/)

Packs indexed (all CC0, verified on each pack page):

1. UI Audio (50 files) — https://kenney.nl/assets/ui-audio
2. Interface Sounds (100 files) — https://kenney.nl/assets/interface-sounds
3. Impact Sounds (130 files) — https://kenney.nl/assets/impact-sounds
4. Sci-fi Sounds (70 files) — https://kenney.nl/assets/sci-fi-sounds
5. Digital Audio (60 files) — https://kenney.nl/assets/digital-audio
6. RPG Audio (50 files) — https://kenney.nl/assets/rpg-audio
7. Casino Audio (50 files) — https://kenney.nl/assets/casino-audio
8. Music Jingles (85 files) — https://kenney.nl/assets/music-jingles
9. Voiceover Pack (90 files) — https://kenney.nl/assets/voiceover-pack
10. Voiceover Pack (Fighter) (45 files) — https://kenney.nl/assets/voiceover-pack-fighter

## Source 2 — OpenGameArt.org (CC0-verified per page)

Each OGA page's license badge was checked for **CC0** before mirroring
(see `scripts/oga_audit.py`). Non-CC0 packs were excluded; Kenney re-uploads
were skipped as duplicates.

1. 512 Sound Effects, 8-bit style (512) — SubspaceAudio — https://opengameart.org/content/512-sound-effects-8-bit-style
2. RPG Sound Pack (96) — artisticdude — https://opengameart.org/content/rpg-sound-pack
3. GUI Sound Effects (13) — LokiF — https://opengameart.org/content/gui-sound-effects
4. 37 Hits/Punches (37) — qubodup — https://opengameart.org/content/37-hitspunches
5. Level Up / Power Up / Coin (13) — wobbleboxx — https://opengameart.org/content/level-up-power-up-coin-get-13-sounds
6. Zombies Sound Pack (24) — artisticdude — https://opengameart.org/content/zombies-sound-pack
7. Different Steps (8) — TinyWorlds — https://opengameart.org/content/different-steps-on-wood-stone-leaves-gravel-and-mud
8. Battle Sound Effects (4) — Ogrebane — https://opengameart.org/content/battle-sound-effects

## Source 3 — additional OpenGameArt CC0 packs (verified 2026-10-16)

The official asset pages for all 10 packs explicitly designate the files as
**Creative Commons CC0 1.0**. All are by **rubberduck**. Their original archive
URLs and SHA-256 checksums are recorded in [SOURCES.md](SOURCES.md) and
[docs/CC0_IMPORT_AUDIT.json](docs/CC0_IMPORT_AUDIT.json).

1. 100 CC0 SFX (100) — https://opengameart.org/content/100-cc0-sfx
2. 80 CC0 RPG SFX (80) — https://opengameart.org/content/80-cc0-rpg-sfx
3. 80 CC0 creature SFX (80) — https://opengameart.org/content/80-cc0-creature-sfx
4. 75 CC0 breaking/falling/hit SFX (75) — https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx
5. 50 CC0 Sci-Fi SFX (50) — https://opengameart.org/content/50-cc0-sci-fi-sfx
6. 40 CC0 water/splash/slime SFX (40) — https://opengameart.org/content/40-cc0-water-splash-slime-sfx
7. 100 CC0 metal and wood SFX (100) — https://opengameart.org/content/100-cc0-metal-and-wood-sfx
8. 100 CC0 SFX #2 (100) — https://opengameart.org/content/100-cc0-sfx-2
9. 80 CC0 creature SFX #2 (80) — https://opengameart.org/content/80-cc0-creture-sfx-2
10. 30 CC0 SFX loops (30) — https://opengameart.org/content/30-cc0-sfx-loops

Newly imported sounds are checked against prior files by file SHA-256 and
decoded PCM SHA-256 before inclusion; sound IDs are unique in the index.

## Explicitly NOT included (license forbids it)

- **Sonniss GDC bundles** — the license (v2.0, sonniss.com/gdc-bundle-license)
  prohibits redistribution as standalone files / sound libraries / asset packs,
  and prohibits AI/ML use. Our repo is a sound library for AI agents, so these
  files **cannot** legally be mirrored here. Download them free from
  https://sonniss.com/gameaudiogdc/ for use inside your own game/film.
- **Freesound.org** — original-file downloads need per-user OAuth; the API ToS
  forbids replicating the database on another site. Awaiting API credentials
  before any curated import (see `batches/STATUS.md`).

## Why the repo name is safe

`open-game-sfx-index` is a generic descriptive name. It does not use the
"Kenney" trademark as a brand, it only **names the source factually**
(as CC0 requires for provenance), which is nominative fair use.

## Code/metadata license

All files created for this index (`scripts/`, `index.json`, `categories.json`,
docs) are MIT-licensed (see LICENSE) to maximize reuse by AI agents.
