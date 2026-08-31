import { rich } from "../model/snapshot/RichText.js";
import { richTextToHtml } from "../migration/richTextToHtml.js";

// An item sheet's description, in the two forms its two branches need.
//
//   description     — a RichText for the read-only branch. The sheet's enrichRichTextTree pass
//                     enriches it and the template renders it with {{rich}}.
//   descriptionHtml — the same text as the paragraph HTML the <prose-mirror> branch is SEEDED with.
//
// The seed is the whole point. A <prose-mirror> parses its `value` as HTML, where newlines mean
// nothing — so markdown handed to it straight arrives as a single text run, and the editor writes
// that back on blur as one <p> with every line break and list marker welded in. Opening a move's
// sheet destroyed the move's own text, without anyone typing. Converting first is what keeps a
// list a list.
//
// Idempotent, so a description the editor has already saved passes through untouched. Same device
// the choice-group editor already uses for `content.textHtml`, which is why choice rows never broke.
//
// Pure so it's unit-testable without instantiating the sheet.
export function itemDescriptionRich(system) {
	const description = system?.description ?? "";
	return { description: rich(description), descriptionHtml: richTextToHtml(description) };
}
