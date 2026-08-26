# Translating the compendiums

Compendium prose — playbook descriptions, backgrounds, the questions on a sheet — is translated
here. You never edit `packs/src/`, and you never need Babele or any other module: the system loads
these translations itself.

## Starting a language

```sh
mkdir -p languages/compendium/<lang>     # e.g. fr, es, pt-BR
npm run i18n:extract -- --lang <lang>
```

That writes one file per pack — today only `playbooks.json` — containing every translatable string.
Then add the language to `"languages"` in `system.json` so Foundry offers it.

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

`npm run pack` compiles these files into `languages/<lang>.json`, which is what the system loads.
There is no separate build step to remember.

## What is not translated here

Slugs, ids and cross-pack references are structure, not prose — translating one would break the
move or follower it points at, so they never appear in these files. Personal names
(`origin[].names[]`) are left alone too.

Only the playbooks pack is covered so far. Until the moves pack follows, a translated playbook still
shows English move names.
