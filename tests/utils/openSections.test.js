// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { openSections } from "../../src/utils/openSections.js";
import { OpenDisclosures } from "../../src/utils/OpenDisclosures.js";

const section = key => `
<section data-section="${key}" data-disclosure-row>
	<button type="button" data-disclosure aria-controls="s-${key}" aria-expanded="false"></button>
	<div id="s-${key}" hidden></div>
</section>`;

beforeEach(() => { document.body.innerHTML = section("instinct") + section("appearance") + section("origin"); });

describe("openSections", () => {
	it("opens each named section and nothing else", () => {
		openSections(document.body, ["instinct", "appearance"], new OpenDisclosures());
		expect(["instinct", "appearance", "origin"].map(k => document.getElementById(`s-${k}`).hidden)).toEqual([false, false, true]);
	});

	it("remembers what it opened, so a re-render keeps it open", () => {
		const memory = new OpenDisclosures();
		openSections(document.body, ["instinct"], memory);
		document.body.innerHTML = section("instinct");
		memory.restore(document.body);
		expect(document.getElementById("s-instinct").hidden).toBe(false);
	});

	it("brings the first into view", () => {
		const first = document.querySelector('[data-section="appearance"]');
		first.scrollIntoView = vi.fn();
		openSections(document.body, ["appearance", "instinct"], new OpenDisclosures());
		expect(first.scrollIntoView).toHaveBeenCalledOnce();
	});

	// A Moves panel's bar has its door and its caret: a route to it opens both, or the door would
	// open inside a panel the reader had shut. The moves' own carets, inside it, stay as they are.
	it("opens a panel a caret shut, as well as its door, and none of the rows inside", () => {
		document.body.innerHTML = `
			<section data-section="moves-other" data-disclosure-row>
				<button type="button" data-disclosure aria-controls="door" aria-expanded="false"></button>
				<button type="button" data-disclosure data-disclosure-region-only aria-controls="body" aria-expanded="false"></button>
				<div id="body" hidden>
					<li data-disclosure-row><button type="button" data-disclosure aria-controls="text" aria-expanded="false"></button><div id="text" hidden></div></li>
					<div id="door" hidden></div>
				</div>
			</section>`;
		openSections(document.body, ["moves-other"], new OpenDisclosures());
		expect(["door", "body", "text"].map(id => document.getElementById(id).hidden)).toEqual([false, false, true]);
	});

	it("passes over a key the tab does not have", () => {
		expect(openSections(document.body, ["lore-nothing", "origin"], new OpenDisclosures())).toHaveLength(1);
	});
});
