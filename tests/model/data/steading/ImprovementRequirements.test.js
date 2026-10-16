import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { ImprovementRequirements, SectionRule } from "../../../../src/model/data/steading/ImprovementRequirements.js";
import { warn } from "../../../../src/utils/logger.js";

vi.mock("../../../../src/utils/logger.js", () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }));
beforeEach(() => vi.mocked(warn).mockClear());

const line = text => ({ type: "entry", content: { title: null, text }, track: null });
const req  = (slug, text = slug, max = 1) => ({ type: "entry", slug, content: { title: null, text }, track: { max } });
const group = (...list) => ({ slug: "watchtower", list });

// Headings are written by a wording the test controls, so "generated" is a fact the test can set up.
const WORDING = {
	heading: (rule, first) => {
		const words = { all: ["Requires all:", "And then:"], some: [`Requires ${rule.count}:`, `And ${rule.count} of these:`],
			or: ["Requires either:", "Or all of these:"] }[rule.kind];
		return words ? words[first ? 0 : 1] : null;
	},
};
const read = (choices, requires) => ImprovementRequirements.fromStored(choices, requires, WORDING, "Watchtower");

function packImprovements() {
	const root = path.resolve(process.cwd(), "packs/src/steading-improvements");
	const out = [];
	(function walk(dir) {
		for (const name of readdirSync(dir)) {
			const p = path.join(dir, name);
			if (statSync(p).isDirectory()) { if (name !== "_folders") walk(p); }
			else if (name.endsWith(".json")) out.push(JSON.parse(readFileSync(p, "utf8")));
		}
	})(root);
	return out;
}

describe("ImprovementRequirements — reading the book's layout", () => {
	it("makes the last line before a run of requirements that run's heading", () => {
		const r = read(group(line("Intro"), line("Requires all:"), req("a"), req("b")), { all: ["a", "b"] });
		expect(r.rows.map(row => r.isHeading(row))).toEqual([false, true, false, false]);
		expect(r.sections).toHaveLength(1);
		expect(r.sections[0].slugs).toEqual(["a", "b"]);
	});

	it("reads each section's rule from the stored requirement", () => {
		const r = read(group(line("Requires 2:"), req("a"), req("b"), req("c"), line("And then:"), req("d")),
			{ all: [{ any: 2, of: ["a", "b", "c"] }, "d"] });
		expect(r.sections.map(s => [s.rule.kind, s.rule.count])).toEqual([["some", 2], ["all", null]]);
	});

	it("reads a section the requirement never names as not counting", () => {
		const r = read(group(line("Requires:"), req("a"), line("Tactics:"), req("t1"), req("t2")), { all: ["a"] });
		expect(r.sections[1].rule.kind).toBe("none");
	});

	it("reads Weapons of War's either-or as a section that is the alternative to the one above", () => {
		const r = read(group(line("Requires either:"), req("buy"), line("Or all of these:"), req("smith"), req("ore"), line("And then:"), req("vet")),
			{ all: [{ any: 1, of: ["buy", { all: ["smith", "ore"] }] }, "vet"] });
		expect(r.sections.map(s => s.rule.kind)).toEqual(["all", "or", "all"]);
	});

	// Nothing the system writes produces this — the pack, the editor and the migration all write
	// sections of the rows. A rule made outside it (a macro, a hand-edited file) is read as far as it
	// can be, each section it cannot place as "all of these", and said out loud: editing the
	// improvement will rewrite it.
	it("reads a section it cannot place as all of these, and warns which improvement", () => {
		const r = read(group(line("Requires:"), req("a"), req("b")), { any: 1, of: ["a", { all: ["b", "gone"] }] });
		expect(r.sections[0].rule.kind).toBe("all");
		expect(warn).toHaveBeenCalledOnce();
		expect(vi.mocked(warn).mock.calls[0].join(" ")).toContain("Watchtower");
	});

	it("warns of nothing when the rule is sections of its rows", () => {
		read(group(line("Requires all:"), req("a"), req("b")), { all: ["a", "b"] });
		expect(warn).not.toHaveBeenCalled();
	});

	// The whole design rests on this: the editor reads every book improvement and, untouched, writes
	// back the requirement the book stores. Pack data is never changed to fit the editor.
	it.each(packImprovements().map(d => [d.name, d]))("round-trips %s exactly", (_name, doc) => {
		const r = ImprovementRequirements.fromStored(doc.system.choices, doc.system.requires, WORDING, doc.name);
		expect(warn).not.toHaveBeenCalled();
		expect(r.toRequires()).toEqual(doc.system.requires);
		expect(r.toChoices()).toEqual(doc.system.choices);
	});
});

describe("ImprovementRequirements — editing", () => {
	const raincatching = () => read(group(line("Intro"), line("Requires all:"), req("a"), req("b")), { all: ["a", "b"] });

	it("adds a requirement to its section, counted by its rule", () => {
		const r = raincatching().withRequirementAddedTo(1);
		expect(r.rows).toHaveLength(5);
		expect(r.toRequires()).toEqual({ all: ["a", "b", r.rows[4].slug] });
	});

	it("gives an added requirement a slug no row has", () => {
		const r = raincatching().withRequirementAddedTo(1).withRequirementAddedTo(1);
		const slugs = r.rows.filter(row => row.isRequirement).map(row => row.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});

	it("adds a line of text at the end", () => {
		const r = raincatching().withLineAdded();
		expect(r.rows.at(-1).isRequirement).toBe(false);
		expect(r.toRequires()).toEqual({ all: ["a", "b"] });
	});

	it("adds a heading as a new section with one requirement under it, worded for its place", () => {
		const r = raincatching().withHeadingAdded();
		expect(r.sections).toHaveLength(2);
		expect(r.rows.at(-2).text).toBe("And then:");
		expect(r.toRequires()).toEqual({ all: ["a", "b", r.rows.at(-1).slug] });
	});

	it("sets a section's rule, and rewrites a heading still in the generated words", () => {
		const r = raincatching().withSectionRule(1, new SectionRule("some", 1));
		expect(r.toRequires()).toEqual({ any: 1, of: ["a", "b"] });
		expect(r.rows[1].text).toBe("Requires 1:");
	});

	it("leaves a heading in the author's own words alone when its rule changes", () => {
		const r = read(group(line("Requires all, in order:"), req("a"), req("b")), { all: ["a", "b"] })
			.withSectionRule(0, new SectionRule("some", 1));
		expect(r.rows[0].text).toBe("Requires all, in order:");
		expect(r.toRequires()).toEqual({ any: 1, of: ["a", "b"] });
	});

	it("rewords a generated heading that moves from a later section to the first", () => {
		const r = read(group(line("Requires all:"), req("a"), line("And then:"), req("b")), { all: ["a", "b"] })
			.withRowRemoved(0).withRowRemoved(0);
		expect(r.rows[0].text).toBe("Requires all:");
	});

	it("merges two sections when the heading between them goes", () => {
		const r = read(group(line("Requires 1:"), req("a"), req("b"), line("And then:"), req("c")),
			{ all: [{ any: 1, of: ["a", "b"] }, "c"] }).withRowRemoved(3);
		expect(r.sections).toHaveLength(1);
		expect(r.toRequires()).toEqual({ any: 1, of: ["a", "b", "c"] });
	});

	it("sets a row's words, and a requirement's boxes", () => {
		const r = raincatching().withRowText(2, "An engineer").withRowBoxes(3, 3);
		expect(r.rows[2].text).toBe("An engineer");
		expect(r.toChoices().list[3].track).toEqual({ max: 3 });
	});

	it("keeps a requirement at one box or more", () => {
		expect(raincatching().withRowBoxes(2, 0).rows[2].boxes).toBe(1);
	});

	it("never changes the requirements it was asked of", () => {
		const r = raincatching();
		r.withRequirementAddedTo(1);
		r.withSectionRule(1, new SectionRule("some", 1));
		expect(r.toRequires()).toEqual({ all: ["a", "b"] });
	});
});

/**
 * The card groups its rows: a section is its heading over its requirements, and a line of text
 * stands alone. A heading is never left saying nothing, and a requirement never leaves its section
 * by being moved.
 */
describe("ImprovementRequirements — sections as groups", () => {
	const two = () => read(group(line("Intro"), line("Requires all:"), req("a"), req("b"), line("And then:"), req("c")),
		{ all: ["a", "b", "c"] });

	it("reads the rows as blocks: a lone line, then each section with its heading", () => {
		expect(two().blocks.map(b => [b.kind, b.rowIndexes])).toEqual([["line", [0]], ["section", [1, 2, 3]], ["section", [4, 5]]]);
	});

	it("adds a requirement at the end of the section it is added to", () => {
		const r = two().withRequirementAddedTo(1);
		expect(r.rows[4].isRequirement).toBe(true);
		expect(r.sections[0].slugs).toEqual(["a", "b", r.rows[4].slug]);
	});

	it("removes a whole section, heading and all", () => {
		const r = two().withSectionRemoved(4);
		expect(r.rows.map(x => x.text)).toEqual(["Intro", "Requires all:", "a", "b"]);
		expect(r.toRequires()).toEqual({ all: ["a", "b"] });
	});

	it("folds a section into the one above when its heading goes", () => {
		const r = two().withHeadingRemoved(4);
		expect(r.sections).toHaveLength(1);
		expect(r.sections[0].slugs).toEqual(["a", "b", "c"]);
	});

	// A first section has no section above to fold into; its heading goes with it.
	// What is left is now the first section, so its generated heading is reworded for that.
	it("removes the first section whole when its heading goes, since there is nothing above to fold into", () => {
		const r = two().withHeadingRemoved(1);
		expect(r.rows.map(x => x.text)).toEqual(["Intro", "Requires all:", "c"]);
	});

	it("moves a section as a whole, and rewords a generated heading for where it lands", () => {
		const r = two().withBlockMoved(2, -1);
		expect(r.rows.map(x => x.text)).toEqual(["Intro", "Requires all:", "c", "And then:", "a", "b"]);
	});

	it("moves a line past a section as a whole", () => {
		const r = two().withBlockMoved(0, 1);
		expect(r.blocks.map(b => b.kind)).toEqual(["section", "line", "section"]);
	});

	it("moves a requirement within its section", () => {
		expect(two().withRequirementMoved(3, -1).sections[0].slugs).toEqual(["b", "a"]);
	});

	it("never moves a requirement out of its section", () => {
		const r = two();
		expect(r.withRequirementMoved(3, 1)).toBe(r);
		expect(r.withRequirementMoved(2, -1)).toBe(r);
	});
});
