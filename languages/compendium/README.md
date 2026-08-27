# Translating the compendiums

Compendiums translations live here

These are the *authoring* files. `npm run pack` compiles them into the Babele translation files the
system ships, in `babele/<lang>/`. Players need the [Babele](https://foundryvtt.com/packages/babele)
module installed to see translations; the system itself is fully playable in English without it.

## Starting a language

```sh
npm run i18n:extract fr      # or es, pt-BR, …
```

That is the whole setup. It creates the directory and a file per translated pack, each holding every
translatable string in it. Re-run it whenever the packs change and it picks up anything new.

`npm run i18n:check` tells you what exists and how far along each file is.

Nothing else needs registering: Babele finds a language by its directory here.

## Translating

Each entry is a key, the English it was written against, and your translation:

```json
"the-seeker": {
  "name":                            { "source": "The Seeker",   "text": "Der Sucher" },
  "backgrounds/patriot/label":       { "source": "Patriot",      "text": "Patriotin" },
  "backgrounds/patriot/description": { "source": "These people…", "text": "" }
}
```

Fill in `text` and leave everything else alone. An empty `text` simply shows the English, so a
part-finished translation is always safe to ship.

Two kinds of markup must survive translation **unchanged**, because Foundry acts on them:

```
@UUID[Compendium.stonetop.moves.abc123]{Defy Danger}   ← rewrite the {label}, never the [target]
[[/r 1d6]]                                             ← don't change the dice
```

`i18n:check` compares them against the English and fails if they differ, so a broken link cannot
reach a player.

Compendium **folder names** appear under a `_folders` entry in each file, and are translated the
same way.

## Keeping up with changes to the book

Re-run `npm run i18n:extract` after the packs change. Two markers can appear in your file:

- **`"needsReview": true`** — the English changed since you translated it. `source` now shows the
  new English; update `text`, then delete the marker.
- **`"orphaned": true`** — that key no longer exists in the pack (usually a row that gained a slug).
  Your words are kept so you can move them to the right key, then delete the entry.

Both keep the entry out of the game until a human clears them, so a stale translation never reaches
a player — they see English instead.

`npm run i18n:check` reports coverage and fails if anything needs review or is orphaned.

## Shipping

`npm run pack` compiles these files into `babele/<lang>/stonetop.<pack>.json`. There is no separate
build step to remember.

Entries are keyed by document id rather than by name, which is Babele's default — so renaming a
playbook in English cannot silently detach its translation.

One Babele behaviour worth knowing: it translates compendium documents, not the copies already
embedded on a character. A player whose character was built before the translation existed uses the
globe button in their sheet header ("Translate actor") to bring it across; that pass is reversible.

## What is not translated here

Slugs, ids and cross-pack references are structure, not prose — translating one would break the
move or follower it points at, so they never appear in these files. Personal names, dice notation
and tag tokens (see above) are left out for the same kind of reason. `src/i18n/translatablePaths.js` records every exception and why,
and a test fails if a new prose field appears that is neither translatable nor a recorded exception.

Still untranslated: the NPCs of the wider world, the journals, and the roll tables.
