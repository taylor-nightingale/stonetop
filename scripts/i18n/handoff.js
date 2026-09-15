// Writes the translator's worklist for a merged installment.
//   npm run i18n:handoff              — compares against MERGE_HEAD, during a merge
//   npm run i18n:handoff -- <ref>     — compares against that ref instead
//
// `npm run i18n:check` names what is flagged; it does not say what changed or where the words
// should go. That difference is most of the work: an entry marked `needsReview` is a sentence the
// translator has to diff against English they can no longer see, and an orphan is a translation
// whose row was restructured, so re-filing it means finding which new keys replaced it.
//
// Both answers are derivable, so neither should cost the translator anything. The previous English
// comes out of the authoring files as they stood before the merge, and an orphan is listed with
// every untranslated key left in its document — the slots its words belong in.
//
// Nothing here writes a translation. Splitting or rewording German is the translator's call.
import { pathToFileURL } from "url";
import path from "path";
import { EntryStatus, reconcile } from "./reconcile.js";
import { englishCatalogForPack } from "./packCatalog.js";
import { AuthoringFile } from "./mergeAuthoring.js";
import { authoringAt, mergeInProgress } from "./mergeTranslations.js";
import { AwaitingTranslator } from "./awaiting.js";
import { TRANSLATED_PACKS, authoringPath, awaitingPath, languageDir, readAuthoring, writeJson } from "./files.js";
import { TAG_PACK, reconcileTagLabels } from "./tagLabels.js";
import { promises as fs } from "fs";

export const handoffPath = (lang, root = ".") => path.join(languageDir(lang, root), "_handoff.md");

/** How many sibling slots to list for an orphan before the list stops being a help. */
const MAX_SLOTS = 12;

/** One untranslated key an orphan's words could belong in. */
export class HandoffSlot {
	constructor(key, english) {
		this.key     = key;
		this.english = english;
	}
}

/** The untranslated keys left in a document, capped at what a reader can actually scan. */
export class HandoffSlots {
	constructor(shown = [], truncated = false) {
		this.shown     = shown;
		this.truncated = truncated;
	}

	static of(slots) {
		return new HandoffSlots(slots.slice(0, MAX_SLOTS), slots.length > MAX_SLOTS);
	}

	get length() {
		return this.shown.length;
	}
}

const fence = (text) => "```\n" + String(text ?? "").replace(/```/gu, "``​`") + "\n```";

/** One thing the translator has to do, with everything needed to do it. */
export class HandoffItem {
	constructor({ pack, slug, key, status, english, german, previousEnglish = null, slots = new HandoffSlots() }) {
		this.pack            = pack;
		this.slug            = slug;
		this.key             = key;
		this.status          = status;
		this.english         = english;
		this.german          = german;
		this.previousEnglish = previousEnglish;
		this.slots           = slots;
	}

	get isOrphan() {
		return this.status === EntryStatus.ORPHANED;
	}

	/** True when the English moved but the words did not — a markup or spacing edit. */
	get isMarkupOnly() {
		const bare = (s) => String(s ?? "").replace(/[◇☐□]/gu, "").replace(/\s+/gu, " ").trim();
		return !this.isOrphan && this.previousEnglish !== null && bare(this.previousEnglish) === bare(this.english);
	}

	get heading() {
		return `#### \`${this.key}\``;
	}

	toMarkdown() {
		const lines = [this.heading, ""];

		if (this.isOrphan) {
			lines.push("This row was restructured; the key is gone. Your German:", "", fence(this.german), "");
			if (this.slots.length) {
				lines.push("Untranslated keys left in this document — the slots these words belong in:", "");
				for (const slot of this.slots.shown) lines.push(`- \`${slot.key}\` — ${JSON.stringify(slot.english)}`);
				if (this.slots.truncated) lines.push(`- …and more; see \`${this.pack}.json\`.`);
				lines.push("");
			} else {
				lines.push("No untranslated keys remain in this document — this text may simply be gone.", "");
			}
			return lines.join("\n");
		}

		lines.push(this.isMarkupOnly
			? "Markup or spacing only — the wording did not change."
			: "The English changed after this was translated.");
		lines.push("");
		if (this.previousEnglish !== null) lines.push("Was:", "", fence(this.previousEnglish), "");
		lines.push("Now:", "", fence(this.english), "", "Your German:", "", fence(this.german), "");
		return lines.join("\n");
	}
}

export class TranslatorHandoff {
	constructor(lang, items = []) {
		this.lang  = lang;
		this.items = items;
	}

	get orphans() {
		return this.items.filter(item => item.isOrphan);
	}

	get reviews() {
		return this.items.filter(item => !item.isOrphan);
	}

	get markupOnly() {
		return this.items.filter(item => item.isMarkupOnly);
	}

	/** pack → slug → items, so the document renders in the order a translator reads it. */
	get byPack() {
		const packs = new Map();
		for (const item of this.items) {
			const slugs = packs.get(item.pack) ?? new Map();
			packs.set(item.pack, slugs);
			slugs.set(item.slug, [...(slugs.get(item.slug) ?? []), item]);
		}
		return packs;
	}

	toMarkdown() {
		const lines = [
			`# Translation worklist — ${this.lang}`,
			"",
			"Generated by `npm run i18n:handoff`. Every entry below is still in the authoring files with",
			"your German attached — edit them there, not here.",
			"",
			`- **${this.reviews.length}** entries where the English changed under an existing translation`
				+ (this.markupOnly.length ? ` (${this.markupOnly.length} of them markup only)` : ""),
			`- **${this.orphans.length}** translations whose row was restructured and need re-filing`,
			"",
		];

		for (const [pack, slugs] of this.byPack) {
			lines.push(`## ${pack}`, "");
			for (const [slug, items] of slugs) {
				lines.push(`### ${slug}`, "");
				for (const item of items) lines.push(item.toMarkdown());
			}
		}
		return lines.join("\n");
	}
}

/** Untranslated keys in a document, which is where an orphan's words have to go. */
function slotsFor(document) {
	return HandoffSlots.of(document.entries
		.filter(entry => entry.status === EntryStatus.UNTRANSLATED)
		.map(entry => new HandoffSlot(entry.key, entry.source)));
}

function itemsFor(reconciliation, previous) {
	const items = [];
	for (const documents of reconciliation.documentsByType.values()) {
		for (const document of documents) {
			const slots = slotsFor(document);
			for (const entry of document.entries) {
				if (entry.status !== EntryStatus.NEEDS_REVIEW && entry.status !== EntryStatus.ORPHANED) continue;
				items.push(new HandoffItem({
					pack:   reconciliation.pack,
					slug:   document.slug,
					key:    entry.key,
					status: entry.status,
					english: entry.source,
					german:  entry.text,
					previousEnglish: previous?.entryAt(document.slug, entry.key)?.source ?? null,
					slots:  entry.status === EntryStatus.ORPHANED ? slots : new HandoffSlots(),
				}));
			}
		}
	}
	return items;
}

export async function handoff({ lang = "de", incoming, root = "." } = {}) {
	const theirRef = incoming ?? (mergeInProgress(root) ? "MERGE_HEAD" : null);

	// The English a `needsReview` entry was translated against is gone from the files — extract has
	// already rewritten `source` to the current English — so it is read back off the merge's two
	// sides, unioned the same way the files themselves were.
	const previousFor = (pack) => {
		const file = authoringPath(lang, pack, root);
		const mine = AuthoringFile.fromJson(authoringAt("HEAD", file, root));
		return theirRef ? mine.mergedWith(AuthoringFile.fromJson(authoringAt(theirRef, file, root))) : mine;
	};

	const items   = [];
	const flagged = [];
	for (const pack of TRANSLATED_PACKS) {
		const english = await englishCatalogForPack(pack, root);
		const result  = reconcile(lang, pack, english, await readAuthoring(lang, pack, root));
		items.push(...itemsFor(result, previousFor(pack)));
		flagged.push(...result.flaggedEntries);
	}
	const tags = await reconcileTagLabels(lang, root);
	items.push(...itemsFor(tags, previousFor(TAG_PACK)));
	flagged.push(...tags.flaggedEntries);

	const document = new TranslatorHandoff(lang, items);
	await fs.writeFile(handoffPath(lang, root), document.toMarkdown(), "utf8");
	await writeJson(awaitingPath(lang, root), AwaitingTranslator.fromFlagged(flagged).toJson());

	console.log(`${handoffPath(lang, root)}: ${document.reviews.length} to review, ${document.orphans.length} to re-file`);
	console.log(`${awaitingPath(lang, root)}: ${flagged.length} acknowledged, so i18n:check stays green`);
	return document;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const args = process.argv.slice(2).filter(arg => !arg.startsWith("-"));
	handoff({ incoming: args[0] }).catch(err => { console.error(err); process.exit(1); });
}
