// Extract the artifact stat blocks embedded in the Wider World articles into possession items.
//
//   node scripts/import/build-artifacts.js
//
// Reads the wider-world-and-other-wonders pack SOURCE (the already-rendered article HTML), so it
// needs no PDF tooling and can be rerun after any pack regeneration. Each artifact block is an
// <h3> title followed by a `<p class="artifact-tags">` tag line and body paragraphs; the same
// markup also carries spirit/follower stat blocks, which are filtered out by their tag lines
// (Solitary/Group/Horde/spirit/Instinct — those are NPCs, not items).
//
// Output: packs/src/possessions/artifacts/<slug>.json — possession items in an Artifacts
// compendium folder. Artifacts don't share the arcanum front/back model, so the whole block is
// one description: the tag line, the body (move text as bold-italic markdown, matching how
// possessions render it), and a source link back to the article. The book marks carried gear
// with ◇ weight pips on the tag line (the same convention as the arcana call-outs) — those
// artifacts carry an outfit entry (weight = pip count, italic qualities as the tagList, plain
// extras as the note); pipless artifacts (immobile, wearable-weightless) are possession-only.
// Ids are deterministic, so regeneration never breaks links.

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { deterministicId, documentKey } from "./ids.js";
import { toSlug } from "../../src/utils/slug.js";

const WONDERS_SRC = "packs/src/wider-world-and-other-wonders";
const OUT_DIR = "packs/src/possessions/artifacts";
const FOLDER_DIR = "packs/src/possessions/_folders";
const PACK = "possessions";
const FOLDER_NAME = "Artifacts";

// NPC-shaped tag lines: spirits and followers share the artifact markup but are not items.
export const NPC_TAGS = /\b(spirit|solitary|group|horde|primordial)\b|instinct/i;

/** UUID of an artifact's possession item — deterministic, so the journal can link to it
 *  before (or without) the item file existing on disk. */
export function artifactUuid(slug) {
	return `Compendium.stonetop.${PACK}.Item.${deterministicId(PACK, `artifact:${slug}`)}`;
}

/**
 * Wrap each artifact block's `<h3>` title in article HTML with a @UUID link to its generated
 * possession item. NPC-shaped blocks (spirits/followers — see NPC_TAGS) stay plain, matching
 * what main() extracts. Idempotent: an already-linked title (leading `@`) is left alone.
 * Returns `{html, linked}`.
 */
export function linkArtifacts(html) {
	let linked = 0;
	const re = /(<h3>(?:<img[^>]*>)?\s*)([^<@]+?)(\s*<\/h3>\s*<p class="artifact-tags">)(.*?)(<\/p>)/g;
	const out = html.replace(re, (whole, pre, title, mid, tags, close) => {
		if (NPC_TAGS.test(htmlToMarkdown(tags))) return whole;
		linked++;
		return `${pre}@UUID[${artifactUuid(toSlug(htmlToMarkdown(title)))}]{${title.trim()}}${mid}${tags}${close}`;
	});
	return { html: out, linked };
}

/** Minimal HTML → the markdown dialect used by existing pack descriptions. */
export function htmlToMarkdown(html) {
	let s = html;
	s = s.replace(/<img[^>]*>/g, "");                       // icons, decor — never content
	s = s.replace(/<hr[^>]*>/g, "");
	s = s.replace(/<\/?div[^>]*>/g, "");
	s = s.replace(/<(?:strong><em|em><strong)>/g, "**_").replace(/<\/(?:em><\/strong|strong><\/em)>/g, "_**");
	s = s.replace(/<\/?strong>/g, "**").replace(/<\/?em>/g, "*");
	s = s.replace(/<li[^>]*>/g, "\n- ").replace(/<\/li>/g, "");
	s = s.replace(/<\/?[ou]l[^>]*>/g, "\n");
	s = s.replace(/<tr[^>]*>/g, "\n- ").replace(/<\/tr>/g, "");
	s = s.replace(/<\/t[dh]>\s*<t[dh][^>]*>/g, " — ").replace(/<\/?t[dhr][^>]*>/g, "");
	s = s.replace(/<\/?(?:table|thead|tbody)[^>]*>/g, "\n");
	s = s.replace(/<\/p>\s*<p[^>]*>/g, "\n\n").replace(/<\/?p[^>]*>/g, "");
	s = s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
	return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** All artifact blocks in one article's rendered HTML. */
export function extractBlocks(html) {
	const blocks = [];
	const re = /<h3>(?:<img[^>]*>)?\s*([^<]+?)\s*<\/h3>\s*<p class="artifact-tags">(.*?)<\/p>/g;
	let m;
	while ((m = re.exec(html))) {
		// The journal build cross-links artifact headings to their items, so the heading text can
		// arrive as @UUID[...]{Name} — the item's name (and slug) want the bare label.
		const name = htmlToMarkdown(m[1]).replace(/@UUID\[[^\]]*\]\{([^}]*)\}/g, "$1");
		// The book prints a tracking checkbox before some tags (□ magical); the glyph is page
		// furniture, not part of the tag.
		const tags = htmlToMarkdown(m[2]).replace(/□\s*/g, "");
		// Body: everything up to the next heading (any level). Column/page wrappers inside the
		// span are structural noise that htmlToMarkdown strips.
		const rest = html.slice(re.lastIndex);
		const end = rest.search(/<h[1-6][ >]/);
		const body = htmlToMarkdown(end === -1 ? rest : rest.slice(0, end));
		blocks.push({ name, tags, body });
	}
	return blocks;
}

function main() {
	const articles = fs.readdirSync(WONDERS_SRC).filter((f) => f.endsWith(".json"));
	fs.rmSync(OUT_DIR, { recursive: true, force: true });
	fs.mkdirSync(OUT_DIR, { recursive: true });

	const folderId = deterministicId(PACK, `folder:${FOLDER_NAME}`);
	fs.mkdirSync(FOLDER_DIR, { recursive: true });
	fs.writeFileSync(path.join(FOLDER_DIR, "artifacts.json"), JSON.stringify({
		name: FOLDER_NAME, type: "Item", description: "", folder: null,
		sorting: "a", sort: 0, color: null, flags: {},
		_id: folderId, _key: documentKey("Folder", folderId),
	}, null, "\t") + "\n");

	let count = 0, skipped = 0;
	for (const file of articles) {
		const entry = JSON.parse(fs.readFileSync(path.join(WONDERS_SRC, file), "utf8"));
		for (const page of entry.pages ?? []) {
			const html = page.text?.content ?? "";
			for (const { name, tags, body } of extractBlocks(html)) {
				if (NPC_TAGS.test(tags)) { skipped++; continue; }
				const slug = toSlug(name);
				const id = deterministicId(PACK, `artifact:${slug}`);
				// The tag line: ◇ weight pips (the carried-gear marker), italic qualities (already
				// star-wrapped by htmlToMarkdown), and plain extras ("+1 damage", "Value 4", "3 uses").
				const pips = (tags.match(/◇/g) || []).length;
				const parts = tags.replace(/◇/g, "").split(/,\s*/).map((t) => t.trim()).filter(Boolean);
				const quals = parts.filter((t) => /^\*.*\*$/.test(t));
				const extras = parts.filter((t) => !/^\*.*\*$/.test(t));
				const tagLine = ["◇".repeat(pips), parts.join(", ")].filter(Boolean).join(" ");
				const source =
					`*An artifact of the wider world — see @UUID[Compendium.stonetop.wider-world-and-other-wonders.JournalEntry.${entry._id}]{${entry.name}}.*`;
				const item = {
					_id: id, _key: documentKey("Item", id),
					name, type: "possession",
					img: "icons/svg/item-bag.svg",
					system: {
						slug,
						description: [tagLine, body, source].filter(Boolean).join("\n\n"),
						resource: null,
						outfitItems: pips ? [{
							slug, name, weight: pips, inventoryColumn: "regular",
							tagList: quals.map((t) => t.replace(/^\*|\*$/g, "")).join(", "),
							note: extras.join(", "),
						}] : [],
						choices: null,
						scaling: null,
						sortOrder: null,
						playbookSlug: null,
					},
					flags: {},
					folder: folderId,
				};
				fs.writeFileSync(path.join(OUT_DIR, `${slug}.json`), JSON.stringify(item, null, "\t") + "\n");
				count++;
			}
		}
	}
	console.log(`artifacts: ${count} written to ${OUT_DIR}, ${skipped} NPC-shaped blocks skipped`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
