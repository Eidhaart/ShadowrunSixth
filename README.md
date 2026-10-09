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
| Dice | Pool roller, Edge boosts, odds, history |
| Forge | Guided priority-system character creation with live budget checks |
| Runners | Saved characters (this browser), JSON import/export, automated sheet with tabs: **Sheet** (condition, attributes, skills, attacks), **Matrix** (arrangeable deck, Matrix stats, actions with limits, Overwatch, technomancer forms and sprites), **Magic** (casting with automatic drain, sustaining, spirits, foci), **Rigging** (vehicles and drones) and **Gear** (inventory, contacts, money) |
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
