# stonetop-art — copyrighted book illustrations (not committed)

The compendium packs reference illustrations from this folder using paths like
`stonetop-art/arcana/mindgem.png` and `stonetop-art/wonders/<hash>.png`. Those paths resolve to
**`Data/stonetop-art/...`** in a Foundry install (i.e. a top-level folder under Foundry's user
data dir, *outside* the system install).

These images are extracted from the copyrighted Stonetop books and **are not redistributable**, so
everything in this folder except this README is git-ignored and never shipped. The shipped system
contains only "trade dress" (UI chrome and the small marker glyphs under
`assets/content/wonders/markers/`).

## What goes here

| Subfolder                                       | Source  | How to get it                                    |
| ----------------------------------------------- | ------- | ------------------------------------------------ |
| `wonders/<hash>.png`                            | Book II | `npm run extract-art`                            |
| `arcana/<slug>.png`                             | Book II | `npm run extract-art` (major-arcana front art)   |
| `steading/residents.png`                        | Book I  | `npm run extract-art -- <Book_II> <Book_I>`      |

`npm run extract-art` regenerates the **wonders**, **major-arcana**, and **steading residents**
illustrations from the books you own. Wonders are content-addressed (`<sha256>.png`) by the same
pipeline that produced the shipped references, so the filenames always match; arcana and steading are
saved under stable slug/name paths the packs/sheet reference (they need not be byte-identical to any
earlier hand-supplied crop).

## Using it on a Foundry server

Image refs point at `stonetop-art/...`, which lives *outside* `Data/systems/stonetop/`, so it
**survives manifest re-installs/updates** of the system.

1. Populate this folder locally (run the extractor and/or drop in your manual art).
2. Copy it to your server's data dir as **`Data/stonetop-art/`** (one-time), then re-sync after
   meaningful re-imports — `rsync` only transfers changed files, since wonders art is
   content-addressed.

For local development, `scripts/development/link.sh` also symlinks `Data/stonetop-art` → this
folder so a linked dev world resolves the art with no copying.

Players/GMs who don't own the books simply won't have these files; the system still works, those
illustrations are just absent.
