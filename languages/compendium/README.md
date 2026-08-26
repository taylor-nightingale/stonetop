# Translating the compendiums

Compendium prose — playbook descriptions, backgrounds, the questions on a sheet — is translated
here. You never edit `packs/src/`.

These are the *authoring* files. `npm run pack` compiles them into the Babele translation files the
system ships, in `babele/<lang>/`. Players need the [Babele](https://foundryvtt.com/packages/babele)
module installed to see translations; the system itself is fully playable in English without it.

## Starting a language

```sh
mkdir -p languages/compendium/<lang>     # e.g. fr, es, pt-BR
npm run i18n:extract -- --lang <lang>
```

That writes one file per pack — today only `playbooks.json` — containing every translatable string.
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

Keys are addresses into the playbook (`backgrounds/patriot/label` is the Patriot background's
label). They are built from the slugs in the data rather than from positions, so they survive the
packs being rebuilt and rows being reordered.

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
move or follower it points at, so they never appear in these files. Personal names
(`origin[].names[]`) are left alone too.

Only the playbooks pack is covered so far. Until the moves pack follows, a translated playbook still
shows English move names.
