import { describe, it, expect } from "vitest";
import { AdviceSnapshot, AdviceParagraphSnapshot, AdviceListSnapshot } from "../../../src/model/snapshot/AdviceSnapshot.js";
import { AdviceTopic } from "../../../src/model/data/Advice.js";
import { RichText } from "../../../src/model/snapshot/RichText.js";

const topic = () => AdviceTopic.fromStored("defenses", {
	title: "improve Defenses",
	blocks: [
		{ type: "para", text: "Boost it via the @UUID[Compendium.stonetop.moves.Item.abc]{Muster} move." },
		{ type: "list", items: ["Build a **Palisade**.", "Establish a **Standing Watch**."] },
	],
});

describe("AdviceSnapshot.of", () => {
	const snapshot = AdviceSnapshot.of(topic());

	it("carries the topic's key and title through", () => {
		expect(snapshot.key).toBe("defenses");
		expect(snapshot.title).toBe("improve Defenses");
	});

	it("renders each kind of block as its own snapshot", () => {
		expect(snapshot.blocks[0]).toBeInstanceOf(AdviceParagraphSnapshot);
		expect(snapshot.blocks[0].type).toBe("para");
		expect(snapshot.blocks[1]).toBeInstanceOf(AdviceListSnapshot);
		expect(snapshot.blocks[1].type).toBe("list");
	});

	// Every string is a RichText so the dialog's one enrich pass finds it — that is what turns the
	// @UUID tokens into clickable links to the moves and improvements the book cites.
	it("wraps every string as rich text", () => {
		expect(snapshot.blocks[0].text).toBeInstanceOf(RichText);
		expect(snapshot.blocks[1].items.every(i => i instanceof RichText)).toBe(true);
	});

	it("renders markdown emphasis without enrichment", () => {
		expect(snapshot.blocks[1].items[0].render()).toBe("Build a <strong>Palisade</strong>.");
	});

	// Prose, not creature stats: "d6" in a sentence stays text rather than becoming a roll button.
	it("does not turn bare dice into rolls", () => {
		const dice = AdviceSnapshot.of(AdviceTopic.fromStored("coin", {
			title: "get some coin", blocks: [{ type: "para", text: "A purse of d6 silvers." }],
		}));
		expect(dice.blocks[0].text.render()).toBe("A purse of d6 silvers.");
	});

	it("has nothing to render for a topic with no blocks", () => {
		expect(AdviceSnapshot.of(AdviceTopic.fromStored("coin", { title: "x" })).blocks).toEqual([]);
	});
});
