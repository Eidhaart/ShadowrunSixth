# SixthDeck

A Shadowrun Sixth World companion in a cyberdeck skin: searchable rules, a dice roller with Edge, a guided character forge, fully automated runner sheets, table chat and a Foundry VTT bridge.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm run chat           # optional: table chat relay on ws://<host>:8787
```

## Load the rules (your own copy)

No book text ships with the app. Import your own legitimately obtained PDF:

- In the app: open **Library** and drop the PDF on the import panel. It is parsed in your browser and stored in IndexedDB.
- Or from the CLI: `npm run import:rules -- path/to/book.pdf` writes `data/rulebook.local.json` (git-ignored), which the dev server picks up automatically.

Quality and spell/power lists in the Forge are read from the imported book.

## What is where

| Page | What it does |
| --- | --- |
| Deck | Home, quick roll, runners, pinned rules |
| Library | Full-text search, lenses (combat, magic, hacking, GM, ...), pins, share to chat |
| Compendium | Gear catalog built from the community 6th World Gear List: search, category and type filters, availability and legality, Attack Rating by range. Drag items onto a runner (Compendium page, sheet Gear tab, Forge gear step) or tap + on a phone. Import your own copy of the .xlsx to add wireless bonuses and notes; it stays on the device. Rebuild the bundled stats with `npx tsx scripts/build-gear.ts list.xlsx` |
| Dice | Pool roller, Edge boosts, odds, history |
| Forge | Guided priority-system character creation with live budget checks. Starts with three paths: 13 ready-to-run premade runners (story, gear, contacts, most with portraits), eight archetype templates that fill in the numbers and walk you through every step, or a blank build. Every premade and template is checked by the Forge validator in the test suite |
| Runners | Saved characters (this browser) with optional portraits (cropped and compressed on the device, carried in JSON and Foundry exports), JSON import/export, automated sheet with tabs: **Sheet** (condition, attributes, skills, attacks), **Matrix** (deck, commlink or cyberjack from the book tables, attribute arrangement, programs with slots, noise, Overwatch, dumpshock, living persona, complex forms, sprites), **Magic** (spell table with drain, Amp Up and Area, damage preview, sustaining, summoning and banishing with stat blocks, foci), **Rigging** (Handling, Speed Interval, jumped-in rules, RCC, drones), **Gear** (inventory with a compendium drawer, contacts, money) and **Advance** (Karma awards and spending on attributes, Edge, Magic/Resonance, skills, specializations, expertise, knowledge, qualities, spells, complex forms, power points, initiation and submersion, with a history and undo; kept apart from the creation build) |
| Table | Virtual tabletop for the room, modelled on Roll20 without dynamic lighting or voice. Scenes the GM switches between (players follow the ribbon), Map, Tokens and GM layers (the relay never sends GM-layer objects, other scenes, scene notes or unshared handouts to players), grid with snap and meters per square, map image upload or drop, fog of war boxes, freehand and shape drawing, text, shared rulers with Sixth World range bands, pings (shift-ping pulls everyone's view), token bars (Physical, Stun, Edge), status markers, auras, rotation, lock and per-player control. Drag your runner on and its token stays in sync with the sheet both ways; the GM drags premades, templates or blank grunts on as NPCs with stat blocks and secret rolls. Attacks follow the Sixth World sequence: pick Attack on your token and click the target, choose a weapon (range band and Attack Rating come from the distance, AR against DR awards Edge automatically, wound modifiers apply), roll; whoever controls the target gets a Defend prompt (Reaction + Intuition), a tie grazes for no damage, then Soak (Body) and the boxes land on the token or straight on the runner sheet, Stun spilling into Physical and overflow tracked. The GM's device rolls defense and soak for NPCs automatically if wanted. SR6 turn order: initiative score, Minor action pips, delay, next and new round, players roll their own and end their own turn. Sidebar: chat with `/r 12 Perception`, journal (runners, NPCs, handouts), compendium and rules search, scene settings, JSON export and import. Keys: V H R P D F, Delete, arrows, Esc |
| Comms | Rooms, in-character chat as your runner, GM-called checks (players accept, the dice roll in the chat), shared rolls |
| Foundry | Setup for the bridge module in `foundry/sixthdeck-bridge` |

## Tests

`npm test` (rules engine against the book's worked examples), `npm run lint`, `npm run build`.

## Academy (Hacking and Magic for Dummies)

`/learn` has two self-contained modules, written in original wording so no book text is bundled:

- **Hacking for Dummies**: 11 short lessons, interactive widgets (deck builder, OS counter, access ladder, IC, damage), a final exam and a live mission, "Ledger Lift at Corvid Freight".
- **Magic for Dummies**: 11 lessons (casting, drain, direct/indirect spells, sustaining, summoning, banishing, the astral plane), widgets that roll real dice, an exam and a live mission, "Night Job at Halcyon Biolab".

Progress is stored in the browser. Both missions use the real dice engine with Edge boosts. Simplifications: Probe is a single roll, hosts and guards use one fixed set of numbers, spirits are generic, a failed summoning costs no drain, and a link-lock also ends when the Tar Baby is destroyed.

## Known gaps

- Edge starts at rank 1; Edge, Magic and racial attribute increases cost 1 adjustment point each. Check against your book.
- Untrained skill rolls use a -1 penalty.
- Gear prices are not parsed from the book; gear is entered by hand.
- The Foundry module has not been run inside Foundry yet.
- Table: the relay keeps tables in `data/vtt.json`, which the free Render plan loses when it sleeps. The GM's device keeps a copy and offers it back when the relay comes up empty or older. Images are stored inside the table (maps are resized to 2600 px), so very large campaigns grow the snapshot. No dynamic lighting, line of sight, undo history or hex grids.
