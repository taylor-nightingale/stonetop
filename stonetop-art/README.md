# stonetop-art — illustrations from the Stonetop books

The Stonetop compendium can show the artwork from the books, but that art is copyrighted, so it
can't be shipped with the system. This folder is where it goes. It starts empty — if you own the
books, you can fill it from your own PDFs. If you don't, no problem: the game works normally, the
pictures are just missing.

## Installing from inside Foundry (recommended)

You don't need this folder or any command line at all. In Foundry, go to
**Settings → Configure Settings → Stonetop → Install Artwork**, select your book PDFs
(Book II carries most of the art; Book I adds the steading illustration), and click
**Install Artwork**. The illustrations are extracted right in your browser and uploaded to the
server's `Data/stonetop-art/` folder — this works on hosted/remote servers too, since nothing
touches your local filesystem.

The rest of this file describes the command-line alternative, mainly useful for development.

## Generating the art from the command line

You need the book PDFs and two command-line tools on your `PATH`: **MuPDF** (`mutool`) and **Poppler**
(`pdfimages`, `pdftoppm`). Install them with your package manager — `apt install mupdf-tools poppler-utils`
on Linux, `brew install mupdf poppler` on macOS, `scoop install mupdf poppler` on Windows. If one is
missing the script tells you which. Then run one command:

```sh
npm run extract-art -- path/to/Book_II.pdf path/to/Book_I.pdf
```

The order doesn't matter — the books are recognized by their filenames, so you can list them either way.
That fills this folder with the illustrations — the wonders, the arcana, and the steading residents.
Book I is optional: leave it off and you only miss the steading illustrations. (If your PDFs already sit
in the `helper/` folder, plain `npm run extract-art` finds them.)

You can re-run it any time; it just refreshes the files.

### Using the generated folder in Foundry

Copy this whole folder into Foundry's data directory as **`Data/stonetop-art/`** — next to the
system, not inside it, so updating Stonetop never wipes your art. Re-copy it whenever you regenerate.
That's all; Foundry picks up the pictures on its own.

### For developers: the art manifest

The in-Foundry installer recognizes book images via `art-manifest.json` (committed at the repo
root). It maps each referenced illustration's content hash to its store path — hashes and names
only, no book content. After regenerating art or changing which images the packs reference, rebuild
it with `npm run art-manifest` (requires a fully populated local `stonetop-art/`).
