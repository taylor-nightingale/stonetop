// @vitest-environment happy-dom
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, globSync } from "fs";
import path from "path";
import { renderPartial } from "../fakes/renderTemplate.js";
import { AdviceSnapshot } from "../../src/model/snapshot/AdviceSnapshot.js";
import { Advice, AdviceTopic } from "../../src/model/data/Advice.js";

const root = process.cwd();
const en = JSON.parse(readFileSync(path.resolve(root, "languages/en.json"), "utf8")).stonetop;

const dom = html => { const d = document.createElement("div"); d.innerHTML = html; return d; };

// The button names itself out of the advice in force, so the shipped advice has to be loaded — the
// same thing i18nInit does in play.
let previousAdvice;
beforeAll(() => { previousAdvice = Advice.current; Advice.current = Advice.fromTranslations(en.advice); });
afterAll(() => { Advice.current = previousAdvice; });

const LABEL = "If you want to… increase Fortunes";

const button = (params) =>
	dom(renderPartial("stonetop.advice-button", { topic: "fortunes", ...params })).firstElementChild;

describe("advice button partial", () => {
	it("carries the topic the sheet action reads", () => {
		const el = button({ variant: "inline" });
		expect(el.dataset.action).toBe("showAdvice");
		expect(el.dataset.topic).toBe("fortunes");
	});

	// Core binds only `click` for [data-action]; anything else is keyboard-dead.
	it("is a button", () => {
		expect(button({ variant: "inline" }).tagName).toBe("BUTTON");
		expect(button({ variant: "inline" }).getAttribute("type")).toBe("button");
	});

	// The icon says nothing to a screen reader, so the label has to.
	it("names itself for assistive tech in every variant", () => {
		for (const variant of ["inline", "labelled"]) {
			const el = button({ variant });
			expect(el.getAttribute("aria-label"), variant).toBe(LABEL);
			expect(el.querySelector("i").getAttribute("aria-hidden"), variant).toBe("true");
		}
	});

	// It writes nothing, so it must stay usable on a sheet the player can only read.
	it("stays live on a non-editable sheet", () => {
		expect(button({ variant: "inline" }).hasAttribute("data-view-state")).toBe(true);
	});

	it("spells the label out only in the toolbar variant", () => {
		expect(button({ variant: "labelled" }).textContent).toContain("increase Fortunes");
		expect(button({ variant: "labelled" }).getAttribute("title")).toBe(LABEL);
		expect(button({ variant: "inline" }).textContent.trim()).toBe("");
	});

	it("borrows the toolbar look for the labelled variant and the icon look otherwise", () => {
		expect([...button({ variant: "labelled" }).classList]).toContain("stonetop-view-toggle");
		expect([...button({ variant: "inline" }).classList]).toContain("stonetop-icon-btn");
	});
});

describe("advice dialog body", () => {
	const body = () => dom(renderPartial("stonetop.advice", {
		advice: AdviceSnapshot.of(AdviceTopic.fromStored("fortunes", {
			title: "increase Fortunes",
			blocks: [
				{ type: "para", text: "The main ways are:" },
				{ type: "list", items: ["Return **Triumphant**.", "Complete an improvement."] },
			],
		})),
	}));

	it("renders prose as paragraphs and options as a list", () => {
		const el = body();
		expect([...el.querySelectorAll("p")].map(p => p.textContent)).toEqual(["The main ways are:"]);
		expect(el.querySelectorAll("ul.stonetop-advice-options li")).toHaveLength(2);
	});

	it("renders the stored markdown rather than printing it", () => {
		expect(body().querySelector("li strong").textContent).toBe("Triumphant");
	});

	// The window title already names the topic; a heading here would say it twice.
	it("leaves the title to the window", () => {
		expect(body().querySelector("h1, h2, h3")).toBeNull();
	});
});

describe("advice button placements", () => {
	const templates = globSync("templates/**/*.hbs", { cwd: root })
		.map(f => readFileSync(path.resolve(root, f), "utf8"));
	const placements = templates.flatMap(src =>
		[...src.matchAll(/(?:topic|advice)="(\w+)"/g)].map(m => m[1]));

	it("places a button for every topic the book covers", () => {
		expect([...new Set(placements)].sort()).toEqual(Object.keys(en.advice).sort());
	});
});

describe("a topic the book has no advice for", () => {
	// Better no button than one that opens an empty window — and it means a typo'd topic key is
	// visible as a missing control rather than silently shipping a nameless button.
	it("renders no button", () => {
		expect(renderPartial("stonetop.advice-button", { topic: "wonders", variant: "inline" }).trim()).toBe("");
	});
});
