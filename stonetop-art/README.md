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

| Subfolder            | Source                       | How to get it                                          |
| -------------------- | ---------------------------- | ------------------------------------------------------ |
| `wonders/<hash>.png` | Book II                      | `node scripts/import/pdf/build-journal.js` (see below) |
| `arcana/<slug>.png`  | Book II (separate tool)      | supply manually                                        |
| `steading/*.png`     | core book (Book I)           | supply manually                                        |
| `playbooks/*.png`    | core book (Book I)           | supply manually                                        |

The **arcana** images were cropped/processed with a separate CLI tool (raw PDF extraction does not
reproduce them byte-for-byte), and **steading/playbook** art comes from the core book — supply all
three manually by dropping correctly-named files into the matching subfolder. Being slug-named,
any correctly-named file resolves, whatever produced it.

The **wonders** illustrations are content-addressed (`<sha256>.png`) — and that comes with a
caveat.

## The content-addressing caveat (read before extracting)

A wonders filename hashes the **final encoded PNG bytes**, and the encoder's zlib deflate step
produces different bytes on different zlib builds — pixel-identical images, different hashes.
(Verified the hard way: an exhaustive deflate parameter sweep and a pako fallback both fail to
match across toolchains.) Consequences:

- **You cannot expect to reproduce the hashes in the committed pack source.** `npm run
  extract-art` alone regenerates the *images*, but on a different zlib build their filenames won't
  match the shipped refs.
- Art files and the pack refs that point at them must come from the **same importer run on the
  same machine**. Run the full journal build — `BOOK_PDF=/path/to/Book_II.pdf node
  scripts/import/pdf/build-journal.js` — which extracts the art *and* rewrites the pack source
  refs together, then recompile packs (`npm run pack`). Re-running on the same machine is stable;
  refs only churn when the toolchain's zlib changes.
- Recurring marker glyphs (trade dress, shipped in `assets/`) are recognized and routed *out* of
  this folder by sha256 via `scripts/import/pdf/trade-dress.json`. On a new toolchain your marker
  hashes won't be listed there yet — if small swirl/marker glyphs start appearing under
  `wonders/`, add your toolchain's hashes to that routing table (keep the existing entries; it is
  a merged, multi-toolchain list).

The importers shell out to `mutool` (MuPDF) and poppler's `pdfimages`/`pdftoppm`; install those
first (`apt install mupdf-tools poppler-utils`, `dnf install mupdf poppler-utils`, or similar).

## Using it on a Foundry server

Image refs point at `stonetop-art/...`, which lives *outside* `Data/systems/stonetop/`, so it
**survives manifest re-installs/updates** of the system.

1. Populate this folder locally (run the journal build and/or drop in your manual art).
2. Copy it to your server's data dir as **`Data/stonetop-art/`** (one-time), then re-sync after
   meaningful re-imports — `rsync` only transfers changed files, since wonders art is
   content-addressed.

For local development, `scripts/development/link.sh` also symlinks `Data/stonetop-art` → this
folder so a linked dev world resolves the art with no copying.

Players/GMs who don't own the books simply won't have these files; the system still works, those
illustrations just show as missing images.
