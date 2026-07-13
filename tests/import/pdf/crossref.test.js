import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPageMap, linkPageRefs, linkNpcs, loadNpcSlugs } from "../../../scripts/import/pdf/crossref.js";
import { journalUuid, npcUuid } from "../../../scripts/import/pdf/creatures.js";
import { deterministicId } from "../../../scripts/import/ids.js";

const articles = [
	{ slug: "aratis-the-lawkeeper", pageNumbers: [22, 23, 24] },
	{ slug: "the-great-wood", pageNumbers: [210, 211, 214] },
	{ slug: "marshedge", pageNumbers: [24, 25] }, // 24 shared at a boundary
];
const map = buildPageMap(articles);

describe("buildPageMap", () => {
	it("maps each printed page to its article; first (book-order) writer wins a shared page", () => {
		expect(map.get(23)).toBe("aratis-the-lawkeeper");
		expect(map.get(214)).toBe("the-great-wood");
		expect(map.get(24)).toBe("aratis-the-lawkeeper"); // not marshedge
		expect(map.get(999)).toBeUndefined();
	});
});

describe("linkPageRefs", () => {
	it("links a '(page N)' citation to the target journal entry", () => {
		const { html, linked } = linkPageRefs("A ruin (page 214) lies north.", map, { selfSlug: "x" });
		expect(linked).toBe(1);
		expect(html).toBe(`A ruin (page @UUID[${journalUuid("the-great-wood")}]{214}) lies north.`);
	});

	it("links each number in a range or list, leaving separators intact", () => {
		const { html } = linkPageRefs("see pages 23, 214", map, { selfSlug: "x" });
		expect(html).toBe(`see pages @UUID[${journalUuid("aratis-the-lawkeeper")}]{23}, @UUID[${journalUuid("the-great-wood")}]{214}`);
	});

	it("does not link a 'step N' that follows a page citation", () => {
		const { html, linked } = linkPageRefs("(page 214, step 2)", map, { selfSlug: "x" });
		expect(linked).toBe(1);
		expect(html).toBe(`(page @UUID[${journalUuid("the-great-wood")}]{214}, step 2)`);
	});

	it("leaves unknown pages and self-references as plain text", () => {
		const unknown = linkPageRefs("(page 999)", map, { selfSlug: "x" });
		expect(unknown.html).toBe("(page 999)");
		expect(unknown.linked).toBe(0);

		const self = linkPageRefs("(page 23)", map, { selfSlug: "aratis-the-lawkeeper" });
		expect(self.html).toBe("(page 23)");
		expect(self.linked).toBe(0);
	});
});

describe("npcUuid", () => {
	it("addresses the actor by its deterministic monster-pack id", () => {
		expect(npcUuid("crag-wyvern"))
			.toBe(`Compendium.stonetop.wider-world-npcs.Actor.${deterministicId("wider-world-npcs", "crag-wyvern")}`);
	});
});

describe("loadNpcSlugs", () => {
	it("collects one slug per actor source file, and an absent pack directory yields an empty set", () => {
		const dir = mkdtempSync(join(tmpdir(), "ww-npcs-"));
		try {
			writeFileSync(join(dir, "crag-wyvern.json"), "{}");
			writeFileSync(join(dir, "hearth-spirit.json"), "{}");
			writeFileSync(join(dir, "notes.txt"), "");
			expect(loadNpcSlugs(dir)).toEqual(new Set(["crag-wyvern", "hearth-spirit"]));
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
		expect(loadNpcSlugs("/nonexistent/pack/dir")).toEqual(new Set());
	});
});

describe("linkNpcs", () => {
	const slugs = new Set(["crag-wyvern", "ghoul"]);
	const ICON = '<img class="icon" src="systems/stonetop/assets/content/wonders/markers/marker-beast.png">';

	it("links a stat-block name (sb-name, strong-wrapped) to its generated actor", () => {
		const { html, linked } = linkNpcs(`<aside class="statblock"><div class="sb-name">${ICON}<strong>Crag Wyvern</strong></div><div>HP 12</div></aside>`, slugs);
		expect(linked).toBe(1);
		expect(html).toContain(`<div class="sb-name">${ICON}<strong>@UUID[${npcUuid("crag-wyvern")}]{Crag Wyvern}</strong></div>`);
	});

	it("links an NPC-box title (npc-title, bare text)", () => {
		const { html, linked } = linkNpcs('<section class="npc-box"><div class="npc-title">Ghoul</div><div>HP 6</div></section>', slugs);
		expect(linked).toBe(1);
		expect(html).toContain(`<div class="npc-title">@UUID[${npcUuid("ghoul")}]{Ghoul}</div>`);
	});

	it("leaves names without a generated actor as plain text", () => {
		const src = '<div class="sb-name"><strong>Unbuilt Creature</strong></div>';
		const { html, linked } = linkNpcs(src, slugs);
		expect(linked).toBe(0);
		expect(html).toBe(src);
	});

	it("slugifies through HTML entities when matching", () => {
		const { linked } = linkNpcs('<div class="sb-name"><strong>Ghoul&#39;s Kin</strong></div>', new Set(["ghouls-kin"]));
		expect(linked).toBe(1);
	});

	it("is idempotent", () => {
		const once = linkNpcs('<div class="npc-title">Ghoul</div>', slugs);
		const twice = linkNpcs(once.html, slugs);
		expect(twice.linked).toBe(0);
		expect(twice.html).toBe(once.html);
	});
});
