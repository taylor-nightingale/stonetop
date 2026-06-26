import { describe, expect, it } from "vitest";
import {
	buildChroniclePages,
	mergeChronicleSections,
	SPRING_PAGE_KEY,
	SPRING_PAGE_NAME,
	EXPEDITION_PAGE_KEY_PREFIX,
} from "../../module/utils/chronicle-core.js";

// The compiler is pure — it only needs the recorded-answer blobs and a shaped PC
// roster, so these assert page shape, section omission, question-index resolution,
// the Spring Burst fold-in, and HTML escaping without any Foundry document wiring.
// Pages are structured: each is { key, name, sections }, where a section is a prose
// block ({ kind:"prose", heading, group, body }) or a Q&A block ({ kind:"qa",
// heading, group, pairs:[{prompt, answer}] }) — the LocationPageModel shape.

const sec     = (page, heading) => page.sections.find(s => s.heading === heading);
const bodyOf  = (page, heading) => sec(page, heading)?.body ?? "";
const pairsOf = (page, heading) => sec(page, heading)?.pairs ?? [];
const allBody = (page) => page.sections.map(s => s.body ?? "").join("\n");

const blessed = { id: "pc1", name: "Ana", playbookName: "The Blessed", slug: "the-blessed" };

function fullAnswers() {
	return {
		pc1: {
			r1: "She/her, raised by goat-herds.",
			r2: "A sacred pouch of seeds.",
			r3: "Danu's shrine sits by the spring.",
			r4: { q: 0, a: "Old Bemis, the goat-herd, is my closest kin." },
			r5: { q: 2, a: "Mother Aldercrone taught me the secret ways." },
			r6: { q: 3, a: "Bram has open doubts about Danu." },
			r7: { q: null, a: "" }, // passed
		},
	};
}

const springFull = {
	gains:   { trade: true },
	hook:    "Trade opportunity with the Hillfolk.",
	excites: { pc1: "Playing a healer who can also fight." },
};

describe("buildChroniclePages", () => {
	it("builds one page per PC with recorded content, named with the playbook", () => {
		const pages = buildChroniclePages({ pcs: [blessed], introAnswers: fullAnswers(), springAnswers: {} });
		expect(pages).toHaveLength(1);
		expect(pages[0].key).toBe("pc1");
		expect(pages[0].name).toBe("Ana — The Blessed");
	});

	it("renders prose sections and resolves Q&A question indices to their text", () => {
		const page = buildChroniclePages({ pcs: [blessed], introAnswers: fullAnswers(), springAnswers: {} })[0];
		expect(sec(page, "Introduction").kind).toBe("prose");
		expect(bodyOf(page, "Introduction")).toContain("She/her, raised by goat-herds.");
		expect(sec(page, "Possessions & contribution")).toBeTruthy();
		expect(sec(page, "Their place in Stonetop")).toBeTruthy();

		// r4 → step4[0], r5 → step4[2] (the playbook's "answer" questions).
		const bonds = sec(page, "Bonds & ties");
		expect(bonds.kind).toBe("qa");
		expect(bonds.pairs).toEqual([
			{ prompt: "Who is your closest kin?",        answer: "Old Bemis, the goat-herd, is my closest kin." },
			{ prompt: "Who taught you the secret ways?", answer: "Mother Aldercrone taught me the secret ways." },
		]);

		// r6 → step6[3] (the playbook's "ask" questions); r7 had no answer, so it's dropped.
		expect(pairsOf(page, "Asked of the others")).toEqual([
			{ prompt: "Which one of you doubts the power of Danu?", answer: "Bram has open doubts about Danu." },
		]);
	});

	it("decodes HTML entities in the resolved question text", () => {
		// step4[1] is authored as "Whose heart &amp; soul is entwined with yours?".
		const page = buildChroniclePages({
			pcs:          [blessed],
			introAnswers: { pc1: { r4: { q: 1, a: "My twin, Cerys." } } },
			springAnswers: {},
		})[0];
		expect(pairsOf(page, "Bonds & ties")[0].prompt).toBe("Whose heart & soul is entwined with yours?");
	});

	it("puts every section in the opening act so the page sheet draws no banner", () => {
		const page = buildChroniclePages({ pcs: [blessed], introAnswers: fullAnswers(), springAnswers: {} })[0];
		expect(page.sections.every(s => s.group === "glance")).toBe(true);
	});

	it("folds the per-PC Spring Burst 'what excites you' note onto the PC page", () => {
		const page = buildChroniclePages({ pcs: [blessed], introAnswers: fullAnswers(), springAnswers: springFull })[0];
		expect(bodyOf(page, "What excites their player")).toContain("Playing a healer who can also fight.");
	});

	it("appends a party Spring Burst page from the omen notes", () => {
		const pages = buildChroniclePages({ pcs: [blessed], introAnswers: fullAnswers(), springAnswers: springFull });
		const spring = pages.at(-1);
		expect(spring.key).toBe(SPRING_PAGE_KEY);
		expect(spring.name).toBe(SPRING_PAGE_NAME);
		expect(sec(spring, "The most hopeful")).toBeUndefined();
		expect(bodyOf(spring, "The season's omen")).toContain("Trade opportunity with the Hillfolk.");
	});

	it("names the ticked seasonal gain(s) in the omen section", () => {
		const spring = buildChroniclePages({
			pcs: [blessed], introAnswers: fullAnswers(),
			springAnswers: { gains: { trade: true, news: true }, hook: "Word from a passing merchant." },
		}).at(-1);
		const omen = bodyOf(spring, "The season's omen");
		expect(omen).toContain("Gains chosen:");
		expect(omen).toContain("Trade opportunity");
		expect(omen).toContain("Interesting news");
		expect(omen).toContain("Word from a passing merchant.");
	});

	it("omits empty sections and skips PCs with nothing recorded", () => {
		const pages = buildChroniclePages({
			pcs: [blessed, { id: "pc2", name: "Bram", playbookName: "The Heavy", slug: "the-heavy" }],
			introAnswers: { pc1: { r1: "Just an intro." } }, // pc2 has nothing
			springAnswers: {},
		});
		expect(pages).toHaveLength(1);
		expect(pages[0].sections.map(s => s.heading)).toEqual(["Introduction"]);
	});

	it("records an answer even when no question was marked", () => {
		const page = buildChroniclePages({
			pcs: [blessed],
			introAnswers: { pc1: { r4: { q: null, a: "A bond with no chosen prompt." } } },
			springAnswers: {},
		})[0];
		expect(pairsOf(page, "Bonds & ties")).toEqual([{ prompt: "", answer: "A bond with no chosen prompt." }]);
	});

	it("escapes user-entered answer text in prose bodies", () => {
		const page = buildChroniclePages({
			pcs: [blessed],
			introAnswers: { pc1: { r1: "<script>alert('x')</script>" } },
			springAnswers: {},
		})[0];
		expect(bodyOf(page, "Introduction")).toContain("&lt;script&gt;");
		expect(bodyOf(page, "Introduction")).not.toContain("<script>");
	});

	it("returns no pages when nothing has been recorded", () => {
		expect(buildChroniclePages({ pcs: [blessed], introAnswers: {}, springAnswers: {} })).toEqual([]);
	});
});

function expeditionFull() {
	return {
		id:    "exp1",
		title: "The Wandering Tower",
		chart: {
			route:  "North along the old logging road to the ridge.",
			checks: { guide: true, perilous: true }, // one Requirement, one Challenge
			notes:  "Borrowed Old Finn's map.",
		},
		outfit:      "Light loads; Bram hauls the rope.",
		requisition: "Two ponies from the commons.",
		prep:        "Mustered the watch to cover the gate.",
		running:     "Ridge camp, then the ravine, then the tower.",
		home:        { checks: { absence: true }, notes: "A true triumph — clear a debility." },
	};
}

describe("buildChroniclePages — expeditions", () => {
	it("builds one page per logged expedition, titled and keyed by trip id", () => {
		const pages = buildChroniclePages({ pcs: [], expeditions: [expeditionFull()] });
		expect(pages).toHaveLength(1);
		expect(pages[0].key).toBe(`${EXPEDITION_PAGE_KEY_PREFIX}exp1`);
		expect(pages[0].name).toBe("Expedition: The Wandering Tower");
	});

	it("renders every recorded step section as prose", () => {
		const page = buildChroniclePages({ pcs: [], expeditions: [expeditionFull()] })[0];
		expect(bodyOf(page, "Destination & route")).toContain("North along the old logging road to the ridge.");
		expect(bodyOf(page, "The way ahead")).toContain("Borrowed Old Finn"); // apostrophe is HTML-escaped (Finn&#39;s)
		expect(bodyOf(page, "Outfit & supplies")).toContain("Light loads; Bram hauls the rope.");
		expect(bodyOf(page, "Requisitioned")).toContain("Two ponies from the commons.");
		expect(sec(page, "Other preparations")).toBeTruthy();
		expect(bodyOf(page, "The journey")).toContain("Ridge camp, then the ravine, then the tower.");
		expect(bodyOf(page, "Coming home")).toContain("A true triumph");
	});

	it("lists only the ticked chart checks, grouped, with the spiral-bullet wrapper", () => {
		const way = bodyOf(buildChroniclePages({ pcs: [], expeditions: [expeditionFull()] })[0], "The way ahead");
		expect(way).toContain('<div class="stonetop-location-body">'); // list-bearing body gets spiral bullets
		expect(way).toContain("<p><strong>Requirements</strong></p>");
		expect(way).toContain("A knowledgeable guide / accurate map / detailed directions");
		expect(way).toContain("<p><strong>Challenges</strong></p>");
		expect(way).toContain("The way is perilous, plagued with danger");
		// An unticked challenge is omitted.
		expect(way).not.toContain("You risk getting lost");
	});

	it("omits the arriving-home prep questions (only the free-text note carries through)", () => {
		const page = buildChroniclePages({ pcs: [], expeditions: [expeditionFull()] })[0];
		expect(allBody(page)).not.toContain("How long have they been gone");
	});

	it("falls back to a numbered name for an untitled trip", () => {
		const pages = buildChroniclePages({
			pcs:         [],
			expeditions: [{ id: "x", chart: { route: "Down to the fen." } }],
		});
		expect(pages[0].name).toBe("Expedition 1");
	});

	it("skips an expedition with no recorded content", () => {
		const pages = buildChroniclePages({
			pcs:         [],
			expeditions: [{ id: "empty", title: "Unstarted", chart: { checks: {} } }],
		});
		expect(pages).toEqual([]);
	});

	it("escapes user-entered expedition text", () => {
		const page = buildChroniclePages({
			pcs:         [],
			expeditions: [{ id: "x", chart: { route: "<script>alert('x')</script>" } }],
		})[0];
		expect(bodyOf(page, "Destination & route")).toContain("&lt;script&gt;");
		expect(bodyOf(page, "Destination & route")).not.toContain("<script>");
	});

	it("appends expedition pages after the PC and Spring Burst pages, oldest first", () => {
		const pages = buildChroniclePages({
			pcs:           [blessed],
			introAnswers:  fullAnswers(),
			springAnswers: springFull,
			expeditions:   [expeditionFull(), { id: "exp2", title: "Down the Dread River", chart: { route: "By raft." } }],
		});
		expect(pages.map(p => p.key)).toEqual([
			"pc1",
			SPRING_PAGE_KEY,
			`${EXPEDITION_PAGE_KEY_PREFIX}exp1`,
			`${EXPEDITION_PAGE_KEY_PREFIX}exp2`,
		]);
	});
});

describe("mergeChronicleSections", () => {
	const prose = (heading, body) => ({ kind: "prose", heading, group: "glance", body });
	const qa    = (heading, pairs) => ({ kind: "qa", heading, group: "glance", pairs });

	it("appends a section recorded after the first save (new heading)", () => {
		const existing = [prose("Destination & route", "<p>North.</p>")];
		const computed = [prose("Destination & route", "<p>North.</p>"), prose("The journey", "<p>Rough.</p>")];
		const { sections, added } = mergeChronicleSections(existing, computed);
		expect(added).toBe(1);
		expect(sections.map(s => s.heading)).toEqual(["Destination & route", "The journey"]);
	});

	it("leaves an already-present prose section untouched (inline edits stick)", () => {
		const existing = [prose("Destination & route", "<p>EDITED IN JOURNAL.</p>")];
		const computed = [prose("Destination & route", "<p>North.</p>")];
		const { sections, added } = mergeChronicleSections(existing, computed);
		expect(added).toBe(0);
		expect(sections[0].body).toBe("<p>EDITED IN JOURNAL.</p>");
	});

	it("folds a later-round answer into an existing Q&A section", () => {
		const existing = [qa("Bonds & ties", [{ prompt: "Who is your closest kin?", answer: "My sister." }])];
		const computed = [qa("Bonds & ties", [
			{ prompt: "Who is your closest kin?", answer: "My sister." },          // already present
			{ prompt: "Who taught you the secret ways?", answer: "Old Maren." },   // recorded later
		])];
		const { sections, added } = mergeChronicleSections(existing, computed);
		expect(added).toBe(1);
		expect(sections[0].pairs.map(p => p.answer)).toEqual(["My sister.", "Old Maren."]);
	});

	it("doesn't duplicate an unchanged Q&A pair, and never mutates the input", () => {
		const existing = [qa("Bonds & ties", [{ prompt: "Q", answer: "A" }])];
		const computed = [qa("Bonds & ties", [{ prompt: "Q", answer: "A" }])];
		const { sections, added } = mergeChronicleSections(existing, computed);
		expect(added).toBe(0);
		expect(sections[0].pairs).toHaveLength(1);
		expect(existing[0].pairs).toHaveLength(1); // input untouched
		expect(sections[0].pairs).not.toBe(existing[0].pairs);
	});

	it("treats same-text pairs under different prompts as distinct", () => {
		const existing = [qa("Asked", [{ prompt: "P1", answer: "yes" }])];
		const computed = [qa("Asked", [{ prompt: "P1", answer: "yes" }, { prompt: "P2", answer: "yes" }])];
		const { added } = mergeChronicleSections(existing, computed);
		expect(added).toBe(1);
	});
});
