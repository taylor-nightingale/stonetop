import { describe, expect, it } from "vitest";
import { makeRewriter, remapPageData, managedHash, stableStringify, carryOverPageState } from "../../module/hooks/journal-sync-core.js";

// The managed-journal update channel decides "did the GM edit this?" by comparing a
// content fingerprint to the baseline we stamped. These tests pin the two properties
// that make that safe: the fingerprint ignores cosmetic churn (page ids, key order)
// but reacts to any authored-content change, in all three section kinds.

const linkMap = new Map([["Compendium.stonetop.stonetop-journal.JournalEntry.abc", "JournalEntry.world123"]]);

describe("makeRewriter / remapPageData", () => {
	it("repoints a seeded compendium @UUID at its world copy, leaves unknown links alone", () => {
		const rewrite = makeRewriter(linkMap);
		expect(rewrite("see @UUID[Compendium.stonetop.stonetop-journal.JournalEntry.abc]{X}"))
			.toBe("see @UUID[JournalEntry.world123]{X}");
		expect(rewrite("see @UUID[Compendium.stonetop.arcana.Item.zzz]{Y}"))
			.toBe("see @UUID[Compendium.stonetop.arcana.Item.zzz]{Y}"); // not seeded → untouched
	});

	it("remaps links across a location page's prose, Q&A, and grouped Dangers", () => {
		const rewrite = makeRewriter(linkMap);
		const link = "@UUID[Compendium.stonetop.stonetop-journal.JournalEntry.abc]";
		const page = remapPageData({
			type: "location",
			system: { sections: [
				{ kind: "prose", body: `p ${link}` },
				{ kind: "qa", pairs: [{ prompt: `q ${link}`, answer: `a ${link}` }] },
				{ kind: "groups", groups: [{ heading: `h ${link}`, body: `b ${link}` }] },
			] },
		}, rewrite);
		const [prose, qa, groups] = page.system.sections;
		expect(prose.body).toBe("p @UUID[JournalEntry.world123]");
		expect(qa.pairs[0]).toEqual({ prompt: "q @UUID[JournalEntry.world123]", answer: "a @UUID[JournalEntry.world123]" });
		expect(groups.groups[0]).toEqual({ heading: "h @UUID[JournalEntry.world123]", body: "b @UUID[JournalEntry.world123]" });
	});
});

describe("managedHash", () => {
	const base = { pages: [
		{ _id: "p1", name: "Overview", type: "text", sort: 100, text: { content: "<p>Hello</p>" } },
		{ _id: "p2", name: "Region", type: "location", sort: 200, system: { sections: [{ kind: "qa", pairs: [{ prompt: "Why?", answer: "" }] }] } },
	] };

	it("ignores page ids, sort, and key order — same content, same fingerprint", () => {
		const reordered = { pages: [
			{ sort: 999, type: "text", name: "Overview", _id: "DIFFERENT", text: { content: "<p>Hello</p>" } },
			{ name: "Region", _id: "ALSO-DIFF", type: "location", sort: 1, system: { sections: [{ pairs: [{ answer: "", prompt: "Why?" }], kind: "qa" }] } },
		] };
		expect(managedHash(reordered)).toBe(managedHash(base));
	});

	it("changes when the GM fills in a Q&A answer", () => {
		const edited = structuredClone(base);
		edited.pages[1].system.sections[0].pairs[0].answer = "Because.";
		expect(managedHash(edited)).not.toBe(managedHash(base));
	});

	it("changes when prose body text changes", () => {
		const edited = structuredClone(base);
		edited.pages[0].text.content = "<p>Hello, world</p>";
		expect(managedHash(edited)).not.toBe(managedHash(base));
	});

	it("changes when a page is added or removed", () => {
		const fewer = { pages: [base.pages[0]] };
		expect(managedHash(fewer)).not.toBe(managedHash(base));
	});
});

describe("carryOverPageState", () => {
	// A reader has ticked checkboxes on two pages; only flags.stonetop.checks holds
	// that state, and managedHash ignores flags — so a content refresh must carry it.
	const oldPages = [
		{ name: "Requirements", type: "text", flags: { stonetop: { checks: { a: true, c: true } } } },
		{ name: "Overview", type: "text", flags: {} },
	];

	it("carries checkbox ticks onto the matching new page, by name", () => {
		const newPages = [
			{ name: "Requirements", type: "text", text: { content: "<p>new</p>" } },
			{ name: "Overview", type: "text", text: { content: "<p>new</p>" } },
		];
		const [req, overview] = carryOverPageState(newPages, oldPages);
		expect(req.flags.stonetop.checks).toEqual({ a: true, c: true });
		expect(overview.flags?.stonetop?.checks).toBeUndefined();
	});

	it("preserves the shipped page's own baked flags, only adding checks", () => {
		const newPages = [{ name: "Requirements", type: "text", flags: { stonetop: { summary: "S" }, core: { x: 1 } } }];
		const [req] = carryOverPageState(newPages, oldPages);
		expect(req.flags).toEqual({ stonetop: { summary: "S", checks: { a: true, c: true } }, core: { x: 1 } });
	});

	it("does not mutate the inputs", () => {
		const newPages = [{ name: "Requirements", type: "text" }];
		carryOverPageState(newPages, oldPages);
		expect(newPages[0].flags).toBeUndefined();
	});

	it("returns pages unchanged when there is no stored state", () => {
		const newPages = [{ name: "Requirements", type: "text" }];
		expect(carryOverPageState(newPages, [{ name: "Requirements", flags: {} }])).toBe(newPages);
		expect(carryOverPageState(newPages, [])).toBe(newPages);
	});

	it("leaves a renamed/removed page's ticks behind (no match) without erroring", () => {
		const newPages = [{ name: "Renamed", type: "text" }];
		const [page] = carryOverPageState(newPages, oldPages);
		expect(page.flags?.stonetop?.checks).toBeUndefined();
	});

	it("a carried-over page still hashes equal to the shipped content (flags ignored)", () => {
		const shipped = { pages: [{ name: "Requirements", type: "text", text: { content: "<p>v2</p>" } }] };
		const carried = { pages: carryOverPageState(shipped.pages, oldPages) };
		expect(managedHash(carried)).toBe(managedHash(shipped));
	});
});

describe("stableStringify", () => {
	it("is key-order independent and null-safe", () => {
		expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
		expect(stableStringify(undefined)).toBe("null");
	});
});
