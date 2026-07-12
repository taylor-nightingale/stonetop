# Stonetop for Foundry VTT

An unofficial [Foundry VTT](https://foundryvtt.com) system for playing [Stonetop](https://plusoneexp.com/collections/stonetop) by Jeremy Strandberg.

> This system is under active development and may be unstable.

## Prerequisites

- Foundry VTT v13 or v14

## Installation

In Foundry VTT, go to **Game Systems → Install System** and paste this manifest URL:

```
https://github.com/taylor-nightingale/stonetop/releases/latest/download/system.json
```

### Art assets

The book illustrations are copyrighted and aren't shipped with the system. If you own the books you can generate them
from your PDFs; the game works fine without them. See [`stonetop-art/README.md`](stonetop-art/README.md) for instructions.

## Development

```bash
npm install        # install dev dependencies
npm run pack       # compile JSON source into LevelDB compendium packs
npm run unpack     # extract packs back to JSON source
npm test           # run tests
```

## License

Code is licensed under the [MIT License](LICENSE).

Some CSS/HTML and assets derived with permission from dice-goblin's beautiful [stonetop system](https://github.com/Dice-Goblin-Click-Clack/Stonetop)

Game content (and trade dress) are derived from [Stonetop](https://plusoneexp.com/collections/stonetop) by Jeremy Strandberg and used under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

The Stonetop illustrations are Lucie’s (C), and should not be distributed in this repository.
