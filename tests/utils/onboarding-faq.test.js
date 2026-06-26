import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	parseFaqItems,
	faqItemsForStep,
	STEP_FAQ_KEYS,
	FAQ_PAGE_NAME,
} from "../../module/utils/onboarding-faq.js";

// The character-creation FAQ is single-sourced in the seeded Setting Overview
// journal; the onboarding dialog parses it and maps questions onto steps. The
// logic worth guarding is the string parser (no DOM at runtime here) and the
// step→question matching — plus a guard that the shipped prose still satisfies
// every mapping, so the badges don't silently go empty if the FAQ is reworded.

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function realFaqHtml() {
	const journal = JSON.parse(fs.readFileSync(
		path.join(__dirname, "../../packs/src/stonetop-journals/setting-overview.json"), "utf8"));
	return journal.pages.find(p => p.name === FAQ_PAGE_NAME)?.text?.content ?? "";
}

const FIXTURE =
	"<p>Intro paragraph, not a question.</p>" +
	"<h3>Filling in your playbook</h3>" +
	"<p><strong>What does my instinct do?</strong><br>It describes how you behave.</p>" +
	"<h3>Armor, gear &amp; load</h3>" +
	"<p><strong>How does “armor” work?</strong><br>It reduces damage.</p>" +
	"<p>A trailing note with no bold lead.</p>";

describe("parseFaqItems", () => {
	it("returns only the bold-led paragraphs, in document order", () => {
		const items = parseFaqItems(FIXTURE);
		expect(items.map(i => i.question)).toEqual([
			"What does my instinct do?",
			"How does “armor” work?",
		]);
	});

	it("tracks the current <h3> section for each item", () => {
		const items = parseFaqItems(FIXTURE);
		expect(items[0].section).toBe("Filling in your playbook");
		// &amp; in the heading is decoded for the section label.
		expect(items[1].section).toBe("Armor, gear & load");
	});

	it("keeps the full <p> html (question + answer) for display", () => {
		const [first] = parseFaqItems(FIXTURE);
		expect(first.html).toBe(
			"<p><strong>What does my instinct do?</strong><br>It describes how you behave.</p>");
	});

	it("is empty for content without bold-led paragraphs", () => {
		expect(parseFaqItems("<p>Just prose.</p><h3>Header</h3>")).toEqual([]);
		expect(parseFaqItems("")).toEqual([]);
	});
});

describe("faqItemsForStep", () => {
	const items = parseFaqItems(realFaqHtml());

	it("matches a single question for a simple step", () => {
		const qs = faqItemsForStep("instinct", items).map(i => i.question);
		expect(qs).toEqual(["What does my instinct do?"]);
	});

	it("matches both origin questions (names + living in Stonetop)", () => {
		const qs = faqItemsForStep("origin", items).map(i => i.question);
		expect(qs).toContain("Do I have to pick one of these names?");
		expect(qs).toContain("Do I have to live in Stonetop?");
		expect(qs).toHaveLength(2);
	});

	it("gives the dynamic lore:N steps no FAQ (back-page content is N/A here)", () => {
		expect(faqItemsForStep("lore:0", items)).toEqual([]);
		expect(faqItemsForStep("lore:7", items)).toEqual([]);
	});

	it("returns nothing for steps with no mapping", () => {
		expect(faqItemsForStep("crew", items)).toEqual([]);
		expect(faqItemsForStep("animalCompanion", items)).toEqual([]);
		expect(faqItemsForStep(undefined, items)).toEqual([]);
	});

	it("de-duplicates when several keys hit the same question", () => {
		// "stats" lists "advantage" and "6 or less"; each is a distinct question,
		// but no question should appear twice in the result.
		const qs = faqItemsForStep("stats", items).map(i => i.question);
		expect(new Set(qs).size).toBe(qs.length);
	});
});

describe("shipped FAQ keeps every mapping populated", () => {
	const items = parseFaqItems(realFaqHtml());

	it("parses a non-trivial number of questions from the real page", () => {
		expect(items.length).toBeGreaterThanOrEqual(10);
	});

	for (const stepType of Object.keys(STEP_FAQ_KEYS)) {
		it(`step "${stepType}" still matches at least one question`, () => {
			expect(faqItemsForStep(stepType, items).length).toBeGreaterThan(0);
		});
	}
});
