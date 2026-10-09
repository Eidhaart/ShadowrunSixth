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
| Runners | Saved characters (this browser), JSON import/export, automated sheet |
| Comms | Rooms, chat, shared rolls |
| Foundry | Setup for the bridge module in `foundry/sixthdeck-bridge` |

## Tests

`npm test` (rules engine against the book's worked examples), `npm run lint`, `npm run build`.

## Known gaps

- Edge starts at rank 1; Edge, Magic and racial attribute increases cost 1 adjustment point each. Check against your book.
- Untrained skill rolls use a -1 penalty.
- Gear prices are not parsed from the book; gear is entered by hand.
- The Foundry module has not been run inside Foundry yet.
