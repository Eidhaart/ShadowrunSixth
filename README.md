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
| My items | Make your own weapons, armor, implants and gear from the Compendium ("Make your own item"), a sheet's Gear tab or the Table's compendium tab. Weapons start from a type (hold-out pistol to sniper rifle, blades, clubs, throwing) with Sixth World DV and Attack Ratings you can change; a live preview shows the card. Keep it in My items (it joins the Compendium marked Mine), give it to a runner (optionally paying for it), or both. GMs can pull their items into the table's house rules |
| Dice | Pool roller, Edge boosts, odds, history |
| Forge | Guided priority-system character creation with live budget checks. Starts with three paths: 13 ready-to-run premade runners (story, gear, contacts, most with portraits), eight archetype templates that fill in the numbers and walk you through every step, or a blank build. Every premade and template is checked by the Forge validator in the test suite |
| Runners | Saved characters (this browser) with optional portraits (cropped and compressed on the device, carried in JSON and Foundry exports), JSON import/export, automated sheet with tabs: **Sheet** (condition, attributes, skills, attacks), **Matrix** (deck, commlink or cyberjack from the book tables, attribute arrangement, programs with slots, noise, Overwatch, dumpshock, living persona, complex forms, sprites), **Magic** (spell table with drain, Amp Up and Area, damage preview, sustaining, summoning and banishing with stat blocks, foci), **Rigging** (Handling, Speed Interval, jumped-in rules, RCC, drones), **Gear** (inventory with a compendium drawer, contacts, money) and **Advance** (Karma awards and spending on attributes, Edge, Magic/Resonance, skills, specializations, expertise, knowledge, qualities, spells, complex forms, power points, initiation and submersion, with a history and undo; kept apart from the creation build) |
| Table | Virtual tabletop for the room, modelled on Roll20. Opening it asks for your seat: Player or Game master, with your name and room; the connection chip switches seat or leaves later. without dynamic lighting or voice. Scenes the GM switches between (players follow the ribbon), Map, Tokens and GM layers (the relay never sends GM-layer objects, other scenes, scene notes or unshared handouts to players), grid with snap and meters per square, map images as movable objects on the Map layer with eight resize handles that snap to the grid and keep the picture's shape (Shift stretches, Alt places freely), exact size in squares, a grid alignment tool (type how many squares the picture's own grid has), fill, fit and scene-to-map buttons and a lock, fog of war boxes, freehand and shape drawing, text, shared rulers with Sixth World range bands, pings (shift-ping pulls everyone's view), token bars (Physical, Stun, Edge), status markers, auras, rotation, lock and per-player control. Drag your runner on and its token stays in sync with the sheet both ways; the GM drags premades, templates or blank grunts on as NPCs with stat blocks and secret rolls. Attacks follow the Sixth World sequence: pick Attack on your token and click the target, choose a weapon (range band and Attack Rating come from the distance, AR against DR awards Edge automatically, wound modifiers apply), roll; whoever controls the target gets a Defend prompt (Reaction + Intuition), a tie grazes for no damage, then Soak (Body) and the boxes land on the token or straight on the runner sheet, Stun spilling into Physical and overflow tracked. The GM's device rolls defense and soak for NPCs automatically if wanted. SR6 turn order: initiative score, Minor action pips, delay, next and new round, players roll their own and end their own turn. Sidebar: chat with `/r 12 Perception`, journal (runners, NPCs, handouts), compendium and rules search, scene settings, JSON export and import. Keys: V H R P D F, Delete, arrows, Esc |
| GM | Behind the screen, one place for the GM. **Screen**: boards of panels you drag by the title, resize from the edges (snapping to a 20 px grid), fold, rename and close; several screens side by side (Running the game, Combat, Legwork or blank), each remembered on the device, stacked on phones. Panels: rules at a glance (your table's numbers, house changes highlighted), turn order with Next and New round, the crew's damage, Edge and statuses, binder NPCs with one-tap (optionally secret) rolls, music, notes, dice, a binder page, a session clock and countdown, and names on the fly. **Binder**: NPCs with stat blocks and condition monitors, places, factions, clues, session logs and notes with pictures, tags, pins and [[links]] with backlinks; put an NPC on the table, show any entry to the players as a handout, drag binder NPCs from the Table's journal; your custom items live here too; export and import as one file (kept in IndexedDB). **Music**: nine soundscapes made live with Web Audio in every browser (rain, sprawl, Barrens wind, Matrix, club, tension, firefight, astral, corp lobby), played as the table's track or layered under it, plus your own YouTube links and https audio files; everyone hears the same moment, players get a header control for their own volume and mute, and a tap-to-listen prompt when the browser blocks autoplay. **House rules**: below |
| House | House rules for GMs: start from a style (By the book, Gritty streets, Chrome and action, Prime runners, Old school) and tune every mechanic the deck computes, each shown against the book with a reset, plus a live "book against your table" comparison. Combat (ties, Edge from AR against DR, zero-hit misses), damage (armor soak, Stun spill, wound interval, monitor bases, overflow), Edge and initiative (Edge cap, dice cap, Minor actions, NPC rerolls) and creation and advancement (starting Karma, unspent Karma, nuyen per Karma, availability cap, Karma price). Homebrew weapons, armor, implants and gear join the Compendium marked House (or copy a book item to start), written house rules are searchable from the Table (GM-only notes stay with the GM) and custom statuses join sheets and tokens. The active ruleset travels with the table: players in your room play by it automatically. Rulesets export and import as files |
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
