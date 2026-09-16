// Writes the translator's worklist for a merged installment.
//   npm run i18n:handoff                      — during a merge: HEAD vs MERGE_HEAD
//   npm run i18n:handoff -- <theirs>          — against that ref instead
//   npm run i18n:handoff -- <theirs> <ours>   — after the merge is committed, when HEAD is no
//                                               longer the "before" and both sides must be named
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
import { renamesBetween, schemeAt } from "./rekey.js";
import { corpusFor } from "./corpus.js";
import { readPackDocuments } from "./packCatalog.js";
import { AwaitingTranslator } from "./awaiting.js";
import { TRANSLATED_PACKS, authoringPath, awaitingPath, languageDir, readAuthoring, writeJson } from "./files.js";
import { TAG_PACK, reconcileTagLabels } from "./tagLabels.js";
import { promises as fs } from "fs";

export const handoffPath = (lang, root = ".") => path.join(languageDir(lang, root), "_handoff.md");

/** How many sibling slots to list for an orphan before the list stops being a help. */
const MAX_SLOTS = 12;

/** One untranslated key an orphan's words could belong in. */
export class HandoffSlot {
	constructor(key, english, sharedWith = 0, elsewhere = null) {
		// Set when the slot is in another file: text pulled OUT of a container into its own move
		// lands in a different pack entirely, and a destination you cannot see is no destination.
		this.elsewhere  = elsewhere;
		this.key        = key;
		this.english    = english;
		// How many OTHER untranslated keys hold this same English. Translating it once covers them
		// all — extract reuses it everywhere — so the count is the difference between answering a
		// question once and answering it a dozen times.
		this.sharedWith = sharedWith;
	}

	get line() {
		const shared = this.sharedWith ? `  ← also fills ${this.sharedWith} other ${this.sharedWith === 1 ? "entry" : "entries"}` : "";
		const where  = this.elsewhere ? `${this.elsewhere} › ` : "";
		return `- ${where}\`"${this.key}"\` — ${JSON.stringify(this.english)}${shared}`;
	}
}

/** A translation of the same English that is already filed at a live key. */
export class CompetingTranslation {
	constructor(locator, german) {
		this.locator = locator;
		this.german  = german;
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
	constructor({ pack, slug, key, status, english, german, previousEnglish = null,
		slots = new HandoffSlots(), competing = [] }) {
		this.competing = competing;
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

	/**
	 * Whether there is actually a before-and-after to show. An entry can be flagged by a durable
	 * `needsReview` mark long after its English settled, and an entry reconciled outside a merge has
	 * no earlier revision to compare against — in both cases the previous English IS the current one,
	 * and printing it twice says nothing.
	 */
	get hasDiff() {
		return !this.isOrphan && this.previousEnglish !== null && this.previousEnglish !== this.english;
	}

	/** True when the English moved but the words did not — a markup or spacing edit. */
	get isMarkupOnly() {
		const bare = (s) => String(s ?? "").replace(/[◇☐□]/gu, "").replace(/\s+/gu, " ").trim();
		return this.hasDiff && bare(this.previousEnglish) === bare(this.english);
	}

	/** The file to open, the document key inside it, and the key to edit — literally what you type. */
	get locator() {
		return `\`${this.pack}.json\` › \`"${this.slug}"\` › \`"${this.key}"\``;
	}

	/**
	 * Self-contained, because the section heading can be fifty lines of fenced text above: landing
	 * here by searching for a key has to tell you which file and which document it belongs to.
	 * `moveResults/success/value` occurs in four different moves, and a bare slug like `stonetop`
	 * is a document key, not a file — naming both is the difference between findable and not.
	 */
	get heading() {
		return `### ${this.locator}`;
	}

	toMarkdown() {
		const lines = [this.heading, ""];

		if (this.isOrphan) {
			// Every branch ends in an instruction. An orphan is the one entry type where the key named
			// in the heading is not somewhere to type a translation, so saying only "the key is gone"
			// leaves the reader with nothing to do.
			if (this.competing.length) {
				lines.push("**The same English is already translated elsewhere, differently.** Yours is a second",
					"translation of one string — compare the two, keep the better one, and delete the other entry.",
					"", "Yours, at the key above:", "", fence(this.german), "");
				for (const { locator, german } of this.competing) {
					lines.push(`Already filed at ${locator}:`, "", fence(german), "");
				}
				return lines.join("\n");
			}

			if (this.slots.length) {
				lines.push("**This row was split up.** Your German covers all of the keys below. Move the matching",
					"part of it into each one, then delete the entry named in the heading.", "",
					"Your German:", "", fence(this.german), "", "The keys it was split into:", "");
				for (const slot of this.slots.shown) lines.push(slot.line);
				if (this.slots.truncated) lines.push(`- …and more; see \`${this.pack}.json\`.`);
				lines.push("");
				return lines.join("\n");
			}

			lines.push("**This string is no longer in the game text, and nothing here needs these words.**",
				"Delete the entry named in the heading. Say so if you think the text should still exist.",
				"", "Your German:", "", fence(this.german), "");
			return lines.join("\n");
		}

		if (!this.hasDiff) {
			lines.push("Flagged for review earlier; the English has not changed since.", "");
			lines.push("English:", "", fence(this.english), "", "Your German:", "", fence(this.german), "");
			return lines.join("\n");
		}

		lines.push(this.isMarkupOnly
			? "Markup or spacing only — the wording did not change."
			: "The English changed after this was translated.");
		lines.push("", "Was:", "", fence(this.previousEnglish), "");
		lines.push("Now:", "", fence(this.english), "", "Your German:", "", fence(this.german), "");
		return lines.join("\n");
	}
}

export class TranslatorHandoff {
	constructor(lang, items = [], conflicts = []) {
		this.lang      = lang;
		this.items     = items;
		this.conflicts = conflicts;
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

	/** Flagged, but with no English change to look at — waiting on the translator, not on a diff. */
	get standing() {
		return this.reviews.filter(item => !item.hasDiff);
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
			"Generated by `npm run i18n:handoff`. Do not edit this file — it is rewritten each time.",
			"",
			`Every entry below is already in the translation files under \`languages/compendium/${this.lang}/\`,`,
			"with your German still attached. Each heading names the three things you need:",
			"",
			"```",
			"### `steadfasts.json` › `\"stonetop\"` › `\"neighborPlaces/other/subtitle\"`",
			"       the file to open      the document      the key to edit inside it",
			"```",
			"",
			`So: open \`languages/compendium/${this.lang}/steadfasts.json\`, find \`"stonetop"\`, find`,
			'`"neighborPlaces/other/subtitle"` inside it, and edit its `"text"`. Leave `"source"` alone —',
			"it is regenerated, and it is there to show you what the German is meant to say.",
			"",
			`- **${this.reviews.length - this.standing.length}** entries where the English changed under an existing translation`
				+ (this.markupOnly.length ? ` (${this.markupOnly.length} of them markup or spacing only)` : ""),
			`- **${this.standing.length}** flagged earlier and still awaiting a revision`,
			`- **${this.orphans.length}** translations whose row was restructured and need re-filing`,
			...(this.conflicts.length
				? [`- **${this.conflicts.length}** strings translated two different ways, where one has to be chosen`]
				: []),
			"",
		];

		if (this.conflicts.length) {
			lines.push("## One English string, two German translations", "");
			lines.push("Nothing was filled in for these — pick one and the rest follow automatically.", "");
			for (const conflict of this.conflicts) {
				const { pack, slug, key } = conflict.address;
				lines.push(`- \`${pack}.json\` › \`"${slug}"\` › \`"${key}"\` — ${JSON.stringify(conflict.english)}`);
				for (const german of conflict.germans) lines.push(`    - ${JSON.stringify(german)}`);
			}
			lines.push("");
		}

		for (const [pack, slugs] of this.byPack) {
			lines.push(`## ${pack}.json`, "");
			for (const items of slugs.values()) {
				for (const item of items) lines.push(item.toMarkdown());
			}
		}
		return lines.join("\n");
	}
}

// Emphasis and spacing are rewritten when a blob is cut into rows, so containment is tested on the
// words alone. Anything shorter than a few words matches too easily to mean anything.
const bareWords = (text) => String(text ?? "").replace(/[*_~`◇☐□]/gu, "").replace(/\s+/gu, " ").trim().toLowerCase();
const MIN_FRAGMENT = 12;

/**
 * The keys an orphan's words were split into — those whose English the orphan's English contains.
 *
 * Listing every untranslated key in the document instead would offer "Drip drip drip of snow
 * melting from roofs" as a home for a paragraph about draft horses: noise at best, and an invitation
 * to file the words in the wrong place at worst.
 */
function slotsFor(document, pack, orphanEnglish, shared = new Map(), vacantElsewhere = []) {
	const haystack = bareWords(orphanEnglish);
	const fits = (english) => {
		const fragment = bareWords(english);
		return fragment.length >= MIN_FRAGMENT && haystack.includes(fragment);
	};

	const here = document.entries
		.filter(entry => entry.status === EntryStatus.UNTRANSLATED && fits(entry.source))
		.map(entry => new HandoffSlot(entry.key, entry.source, (shared.get(entry.source) ?? 1) - 1));

	// Text pulled out of a container into its own move is not in this document at all. Searching
	// only here is why a steading improvement whose words became `moves/news-at-the-inn` looked
	// like it had nowhere to go.
	const away = vacantElsewhere
		.filter(({ address, english }) => !(address.pack === pack && address.slug === document.slug) && fits(english))
		.map(({ address, english }) => new HandoffSlot(address.key, english,
			(shared.get(english) ?? 1) - 1, `\`${address.pack}.json\` › \`"${address.slug}"\``));

	// One slot per distinct English. The same string in another document is not a second destination
	// for these words — the "also fills N" note already says it will be carried there.
	const seen = new Set();
	const distinct = [];
	for (const slot of [...here, ...away]) {
		const key = bareWords(slot.english);
		if (seen.has(key)) continue;
		seen.add(key);
		distinct.push(slot);
	}
	return HandoffSlots.of(distinct);
}

function itemsFor(reconciliation, previous, shared, competingFor, vacantElsewhere) {
	const items = [];
	for (const documents of reconciliation.documentsByType.values()) {
		for (const document of documents) {
			for (const entry of document.entries) {
				if (entry.status !== EntryStatus.NEEDS_REVIEW && entry.status !== EntryStatus.ORPHANED) continue;
				const orphaned = entry.status === EntryStatus.ORPHANED;
				items.push(new HandoffItem({
					pack:   reconciliation.pack,
					slug:   document.slug,
					key:    entry.key,
					status: entry.status,
					english: entry.source,
					german:  entry.text,
					previousEnglish: previous?.entryAt(document.slug, entry.key)?.source ?? null,
					slots:     orphaned
						? slotsFor(document, reconciliation.pack, entry.source, shared, vacantElsewhere)
						: new HandoffSlots(),
					competing: orphaned ? competingFor(entry.source, entry.text) : [],
				}));
			}
		}
	}
	return items;
}

export async function handoff({ lang = "de", incoming, ours = "HEAD", root = "." } = {}) {
	const theirRef = incoming ?? (mergeInProgress(root) ? "MERGE_HEAD" : null);

	// The English a `needsReview` entry was translated against is gone from the files — extract has
	// already rewritten `source` to the current English — so it is read back off the merge's two
	// sides, unioned the same way the files themselves were.
	//
	// Those revisions may also predate a key-scheme change, in which case their keys no longer name
	// today's entries. Renaming them forward first is what keeps the before-and-after lined up.
	const previousFor = async (pack) => {
		const file   = authoringPath(lang, pack, root);
		const mine   = AuthoringFile.fromJson(authoringAt(ours, file, root));
		const union  = theirRef
			? mine.mergedWith(AuthoringFile.fromJson(authoringAt(theirRef, file, root)))
			: mine;
		if (pack === TAG_PACK) return union;
		const documents = await readPackDocuments(path.join(root, "packs", "src", pack));
		const renames   = renamesBetween(await schemeAt(ours, root), documents);
		return renames.size ? AuthoringFile.fromJson(renames.applyTo(union.toJson())) : union;
	};

	// How many untranslated keys share each English string: answering one covers all of them.
	const corpus = await corpusFor(lang, root);
	corpus.apply();
	const shared = new Map([...corpus.vacantByEnglish()].map(([english, addresses]) => [english, addresses.length]));
	const { conflicts } = corpus.memoryFills();

	// An orphan whose English is live AND already translated is a second translation of one string,
	// not a homeless one. Neither rehoming (which needs a vacant target) nor de-duplication (which
	// needs identical German) covers it, so it is the handoff's job to put the two side by side.
	// Every untranslated address in the corpus, so an orphan can be pointed at a destination in
	// another file — which is where extracted moves live.
	const vacantElsewhere = [...corpus.vacantByEnglish()]
		.flatMap(([english, addresses]) => addresses.map(address => ({ address, english })));

	const translatedByEnglish = corpus.germanByEnglish();
	const competingFor = (english, german) => [...(translatedByEnglish.get(english) ?? new Map())]
		.filter(([text]) => text !== german?.trim())
		.map(([text, address]) => new CompetingTranslation(
			`\`${address.pack}.json\` › \`"${address.slug}"\` › \`"${address.key}"\``, text));

	const items   = [];
	const flagged = [];
	for (const pack of TRANSLATED_PACKS) {
		const english = await englishCatalogForPack(pack, root);
		const result  = reconcile(lang, pack, english, await readAuthoring(lang, pack, root));
		items.push(...itemsFor(result, await previousFor(pack), shared, competingFor, vacantElsewhere));
		flagged.push(...result.flaggedEntries);
	}
	const tags = await reconcileTagLabels(lang, root);
	items.push(...itemsFor(tags, await previousFor(TAG_PACK), shared, competingFor, vacantElsewhere));
	flagged.push(...tags.flaggedEntries);

	const document = new TranslatorHandoff(lang, items, conflicts);
	await fs.writeFile(handoffPath(lang, root), document.toMarkdown(), "utf8");
	await writeJson(awaitingPath(lang, root), AwaitingTranslator.fromFlagged(flagged).toJson());

	console.log(`${handoffPath(lang, root)}: ${document.reviews.length} to review, ${document.orphans.length} to re-file`);
	console.log(`${awaitingPath(lang, root)}: ${flagged.length} acknowledged, so i18n:check stays green`);
	return document;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const args = process.argv.slice(2).filter(arg => !arg.startsWith("-"));
	handoff({ incoming: args[0], ours: args[1] }).catch(err => { console.error(err); process.exit(1); });
}
