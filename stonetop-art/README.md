# stonetop-art — illustrations from the Stonetop books

The Stonetop compendium can show the artwork from the books, but that art is copyrighted, so it
can't be shipped with the system. This folder is where it goes. It starts empty — if you own the
books, you can fill it from your own PDFs. If you don't, no problem: the game works normally, the
pictures are just missing.

## Generating the art

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

## Using it in Foundry

Copy this whole folder into Foundry's data directory as **`Data/stonetop-art/`** — next to the
system, not inside it, so updating Stonetop never wipes your art. Re-copy it whenever you regenerate.
That's all; Foundry picks up the pictures on its own.

