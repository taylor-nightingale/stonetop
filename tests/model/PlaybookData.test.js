import { describe, it, expect } from "vitest";
import { PlaybookData } from "../../src/data/PlaybookData.js";

describe("PlaybookData defaults", () => {
	it("defaults slug and actorType to null", () => {
		const d = new PlaybookData();
		expect(d.slug).toBeNull();
		expect(d.actorType).toBeNull();
	});

	it("defaults description, statsNote, startingMovesNote to empty string", () => {
		const d = new PlaybookData();
		expect(d.description).toBe("");
		expect(d.statsNote).toBe("");
		expect(d.startingMovesNote).toBe("");
	});

	it("defaults hp to 0 and damage.value to null", () => {
		const d = new PlaybookData();
		expect(d.hp).toBe(0);
		expect(d.damage.value).toBeNull();
	});

	it("defaults arrays to empty", () => {
		const d = new PlaybookData();
		expect(d.backgrounds).toEqual([]);
		expect(d.origin).toEqual([]);
		expect(d.choices).toEqual([]);
	});

	it("defaults the playbook-grant lists (followers, inserts) to empty arrays", () => {
		const d = new PlaybookData();
		expect(d.followers).toEqual([]);
		expect(d.inserts).toEqual([]);
	});

	it("keeps follower/insert grant slugs as string arrays", () => {
		const d = new PlaybookData({ followers: ["crew", "animal-companion"], inserts: ["lightbearer-invocations-insert"] });
		expect(d.followers).toEqual(["crew", "animal-companion"]);
		expect(d.inserts).toEqual(["lightbearer-invocations-insert"]);
	});

	it("defaults introductions to null", () => {
		const d = new PlaybookData();
		expect(d.introductions).toBeNull();
	});

	it("defaults choiceValues to empty object and specialPossessions to null", () => {
		const d = new PlaybookData();
		expect(d.choiceValues).toEqual({});
		expect(d.specialPossessions).toBeNull();
	});
});

describe("PlaybookData.migrateData", () => {
	it("normalizes legacy rows in choices and specialPossessions", () => {
		const source = {
			choices: [{ slug: "g", list: [{ type: "heading", content: { subHeading: "H" } }] }],
			specialPossessions: { slug: "sp", list: [{ type: "follower", slug: "enfys", title: "Enfys" }] },
		};
		PlaybookData.migrateData(source);
		expect(source.choices[0].list[0].type).toBe("entry");
		expect(source.choices[0].list[0].content.subtitle).toBe("H");
		expect(source.specialPossessions.list[0].followers).toEqual(["enfys"]);
	});

	it("normalizes the introductions step4/step6 choice groups", () => {
		const source = {
			introductions: {
				step3: "plain string, untouched",
				step4: { slug: "intro-npc", list: [{ type: "heading", note: "(reload)", content: {} }] },
				step6: { slug: "intro-pc", list: [{ type: "entry", content: { subNote: "(p1)" }, input: {} }] },
			},
		};
		PlaybookData.migrateData(source);
		expect(source.introductions.step3).toBe("plain string, untouched");
		expect(source.introductions.step4.list[0].type).toBe("entry");
		expect(source.introductions.step4.list[0].content.titleNote).toBe("(reload)");
		expect(source.introductions.step6.list[0].content.subtitleNote).toBe("(p1)");
		expect(source.introductions.step6.list[0].input.type).toBe("inline");
	});

	it("does not throw when introductions is absent", () => {
		expect(() => PlaybookData.migrateData({})).not.toThrow();
	});
});
