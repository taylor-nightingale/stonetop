import { describe, it, expect } from "vitest";
import { parseAdvice, ADVICE_TOPICS, AdviceParagraph, AdviceList } from "../../../scripts/import/pdf/advice.js";

// The spread as extractArticle hands it over: sections of left/right printed pages, each a couple of
// columns of heading / para / list blocks. Only `text`, `spans` and the block shape matter here —
// joinLines reads nothing else — so the fixtures spell out exactly those.
const BODY = "ACaslonPro-Regular";
const BOLD = "ACaslonPro-Bold";
const HEAD = "Avara-Bold";

const span = (text, font = BODY) => ({ font, size: 9, text });
const line = (...spans) => ({ text: spans.map(s => s.text).join(""), font: spans[0].font, size: 9, spans });

const heading = (text) => ({ type: "heading", level: "h2", line: line(span(text, HEAD)) });
const para    = (...lines) => ({ type: "para", lines });
const list    = (...items) => ({ type: "list", items });
const column  = (...blocks) => ({ base: 36, blocks });
const article = (...columns) => ({ sections: [{ left: columns, right: [] }] });

/** A document carrying all ten headings, so a test can add just the block it cares about. */
const everyTopic = (extra = []) => article(column(
	...extra,
	...ADVICE_TOPICS.map(t => heading(headingFor(t.key))),
));

const HEADINGS = {
	fortunes:            "… increase Fortunes",
	surplus:             "… gain Surplus",
	defenses:            "…improve Defenses",
	population:          "… increase Population",
	prosperity:          "… improve Prosperity",
	steadingImprovement: "… unlock a steading improvement",
	coin:                "… get some coin",
	arcana:              "… find new arcana",
	arcanumMystery:      "… unlock the mysteries of an arcanum",
	followers:           "… recruit followers",
};
const headingFor = (key) => HEADINGS[key];

describe("parseAdvice", () => {
	it("reads every topic the book prints, in book order", () => {
		const doc = parseAdvice(everyTopic());
		expect(doc.topics.map(t => t.key)).toEqual(ADVICE_TOPICS.map(t => t.key));
	});

	it("keeps the heading as its title, without the leading ellipsis", () => {
		const doc = parseAdvice(everyTopic());
		expect(doc.topics.find(t => t.key === "fortunes").title).toBe("increase Fortunes");
		// The book sets this one tight against the ellipsis; the title reads the same either way.
		expect(doc.topics.find(t => t.key === "defenses").title).toBe("improve Defenses");
	});

	it("collects the prose and lists under the heading they follow", () => {
		const doc = parseAdvice(article(column(
			heading("… increase Fortunes"),
			para(line(span("The main ways are:"))),
			list([line(span("Return Triumphant."))], [line(span("Complete an improvement."))]),
			...ADVICE_TOPICS.slice(1).map(t => heading(headingFor(t.key))),
		)));
		const fortunes = doc.topics[0];
		expect(fortunes.blocks[0]).toBeInstanceOf(AdviceParagraph);
		expect(fortunes.blocks[0].text).toBe("The main ways are:");
		expect(fortunes.blocks[1]).toBeInstanceOf(AdviceList);
		expect(fortunes.blocks[1].items).toEqual(["Return Triumphant.", "Complete an improvement."]);
	});

	// The spread opens with a line about itself, which belongs to no topic.
	it("drops prose printed above the first heading", () => {
		const doc = parseAdvice(everyTopic([para(line(span("Here are some things you might want to do.")))]));
		expect(doc.topics.every(t => t.blocks.length === 0)).toBe(true);
	});

	it("writes emphasis as markdown", () => {
		const doc = parseAdvice(article(column(
			heading("…improve Defenses"),
			para(line(span("Boost it via the "), span("Muster", BOLD), span(" move."))),
			...ADVICE_TOPICS.filter(t => t.key !== "defenses").map(t => heading(headingFor(t.key))),
		)));
		expect(doc.topics[0].blocks[0].text).toBe("Boost it via the **Muster** move.");
	});

	// The book breaks a cited name across a line end; the two halves are one name.
	it("rejoins a bold name split across lines", () => {
		const doc = parseAdvice(article(column(
			heading("… gain Surplus"),
			para(line(span("You'll need to "), span("Trade &", BOLD)), line(span("Barter", BOLD), span(" for it."))),
			...ADVICE_TOPICS.filter(t => t.key !== "surplus").map(t => heading(headingFor(t.key))),
		)));
		expect(doc.topics[0].blocks[0].text).toBe("You'll need to **Trade & Barter** for it.");
	});

	it("de-hyphenates a word broken across lines", () => {
		const doc = parseAdvice(article(column(
			heading("… get some coin"),
			para(line(span("Surplus isn't commonly avail-")), line(span("able here."))),
			...ADVICE_TOPICS.filter(t => t.key !== "coin").map(t => heading(headingFor(t.key))),
		)));
		expect(doc.topics[0].blocks[0].text).toBe("Surplus isn't commonly available here.");
	});

	it("reads left page then right page, column by column", () => {
		const doc = parseAdvice({ sections: [
			{ left: [column(heading("… increase Fortunes")), column(heading("… gain Surplus"))],
			  right: [column(heading("…improve Defenses"))] },
			{ left: [column(...ADVICE_TOPICS.slice(3).map(t => heading(headingFor(t.key))))], right: [] },
		] });
		expect(doc.topics.map(t => t.key)).toEqual(ADVICE_TOPICS.map(t => t.key));
	});

	it("refuses a heading it doesn't know", () => {
		expect(() => parseAdvice(everyTopic([heading("… befriend a dragon")])))
			.toThrow(/unrecognized topic heading "befriend a dragon"/);
	});

	// A page that half-parses would leave a ? button opening an empty window.
	it("refuses a spread missing a topic", () => {
		const short = article(column(...ADVICE_TOPICS.slice(0, -1).map(t => heading(headingFor(t.key)))));
		expect(() => parseAdvice(short)).toThrow(/no section found for followers/);
	});
});

describe("withReferences", () => {
	const uuids = new Map([["muster", "Compendium.stonetop.moves.Item.abc"]]);

	const doc = () => parseAdvice(article(column(
		heading("…improve Defenses"),
		para(line(span("Try "), span("Muster", BOLD), span(" or "), span("Pull Together", BOLD), span("."))),
		list([line(span("Build a "), span("Muster", BOLD), span("."))]),
		...ADVICE_TOPICS.filter(t => t.key !== "defenses").map(t => heading(headingFor(t.key))),
	)));

	it("turns a cited name the packs know into a content link", () => {
		const linked = doc().withReferences(uuids);
		expect(linked.topics[0].blocks[0].text)
			.toBe("Try @UUID[Compendium.stonetop.moves.Item.abc]{Muster} or **Pull Together**.");
	});

	it("links inside list items too", () => {
		expect(doc().withReferences(uuids).topics[0].blocks[1].items[0])
			.toBe("Build a @UUID[Compendium.stonetop.moves.Item.abc]{Muster}.");
	});

	it("leaves the parsed document untouched", () => {
		const original = doc();
		original.withReferences(uuids);
		expect(original.topics[0].blocks[0].text).toContain("**Muster**");
	});
});

describe("toTranslation", () => {
	it("hangs each topic off its key, with only what the language file holds", () => {
		const doc = parseAdvice(article(column(
			heading("… recruit followers"),
			para(line(span("Ask them."))),
			...ADVICE_TOPICS.filter(t => t.key !== "followers").map(t => heading(headingFor(t.key))),
		)));
		expect(doc.toTranslation().followers)
			.toEqual({ title: "recruit followers", blocks: [{ type: "para", text: "Ask them." }] });
	});
});
