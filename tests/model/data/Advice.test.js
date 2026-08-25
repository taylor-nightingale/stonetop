import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { Advice, AdviceParagraph, AdviceList, adviceLabel, ADVICE_LABEL_KEY } from "../../../src/model/data/Advice.js";
import { ADVICE_TOPICS } from "../../../scripts/import/pdf/advice.js";

// The advice ships as ordinary localized strings, so this reads it the way the system does at
// i18nInit: straight out of the language file's `stonetop.advice` tree.
const en = JSON.parse(
	readFileSync(fileURLToPath(new URL("../../../languages/en.json", import.meta.url)), "utf8")).stonetop;

const TREE = {
	fortunes: {
		title: "increase Fortunes",
		blocks: [
			{ type: "para", text: "The main ways are:" },
			{ type: "list", items: ["Return Triumphant.", "Complete an improvement."] },
		],
	},
};

describe("Advice.fromTranslations", () => {
	const advice = Advice.fromTranslations(TREE);

	it("looks a topic up by the key a ? button carries", () => {
		expect(advice.lookup("fortunes").title).toBe("increase Fortunes");
	});

	it("reads each block as the kind of block it is", () => {
		const [prose, options] = advice.lookup("fortunes").blocks;
		expect(prose).toBeInstanceOf(AdviceParagraph);
		expect(prose.text).toBe("The main ways are:");
		expect(options).toBeInstanceOf(AdviceList);
		expect(options.items).toEqual(["Return Triumphant.", "Complete an improvement."]);
	});

	// A language file may predate a topic; a sheet asking for one renders no button, not an error.
	it("returns null for a topic it has no entry for", () => {
		expect(advice.lookup("coin")).toBeNull();
		expect(advice.has("coin")).toBe(false);
	});

	it("survives a missing tree", () => {
		expect(Advice.fromTranslations().all).toEqual([]);
		expect(Advice.fromTranslations(undefined).lookup("fortunes")).toBeNull();
	});

	it("skips a block of a kind it doesn't know", () => {
		const odd = Advice.fromTranslations({ coin: { title: "get some coin", blocks: [{ type: "table" }] } });
		expect(odd.lookup("coin").blocks).toEqual([]);
	});

	// Empty until i18nInit reads the language file, so a sheet rendered before then shows no buttons.
	it("starts empty", () => {
		expect(new Advice().all).toEqual([]);
	});
});

describe("the shipped advice", () => {
	const advice = Advice.fromTranslations(en.advice);

	it("carries every topic the build script extracts", () => {
		expect(advice.all.map(t => t.key).sort()).toEqual(ADVICE_TOPICS.map(t => t.key).sort());
	});

	it("gives every topic a title and something to say", () => {
		for (const topic of advice.all) {
			expect(topic.title, topic.key).not.toBe("");
			expect(topic.blocks.length, topic.key).toBeGreaterThan(0);
		}
	});

	// One format string, filled with each topic's own heading — so the ten headings are written
	// once (here, as titles) rather than again as a parallel list of button labels.
	it("names every topic from the one shipped format string", () => {
		const format = (key, data) => en.sheet.advice.label.replace("{topic}", data.topic) + `|${key}`;
		for (const topic of advice.all) {
			expect(adviceLabel(topic, format), topic.key)
				.toBe(`If you want to… ${topic.title}|${ADVICE_LABEL_KEY}`);
		}
	});
});

describe("adviceLabel", () => {
	const format = (key, data) => `${key}:${data.topic}`;

	it("names a topic by its heading", () => {
		const topic = Advice.fromTranslations(TREE).lookup("fortunes");
		expect(adviceLabel(topic, format)).toBe(`${ADVICE_LABEL_KEY}:increase Fortunes`);
	});

	// Nothing to label means nothing to render: the partial drops the button entirely.
	it("has no name for a topic that isn't there", () => {
		expect(adviceLabel(null, format)).toBe("");
	});
});
