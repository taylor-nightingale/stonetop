import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { band } from "../../scripts/development/redesign-mock/band.js";
import { CharacterSnapshot } from "../../scripts/development/redesign-mock/CharacterSnapshot.js";

/**
 * Instinct and appearance hold one line each and cut to "…" on a narrow sheet, so the words the cut
 * hides are carried whole on the line itself.
 */

const S = new CharacterSnapshot(JSON.parse(readFileSync("scripts/development/mockup/maelen.json", "utf8")));
const html = band(S);
const who = html.slice(html.indexOf('class="rd-who"'), html.indexOf("</div>", html.indexOf('class="rd-who"')));

describe("appearanceText", () => {
	it("is the appearance's words without their markup", () => {
		expect(S.appearanceText).not.toBe("");
		expect(S.appearanceText).not.toMatch(/[<>]/);
		expect(S.appearance.replace(/<[^>]*>/g, "")).toBe(S.appearanceText);
	});
});

describe("the masthead's instinct and appearance", () => {
	it("names the whole instinct in the tooltip, where the cut line may not show it", () => {
		expect(who).toContain(`title="${S.instinct.label} — change it on ${S.instinct.source}"`);
	});

	it("carries the whole appearance as the line's title", () => {
		expect(who).toContain(`<p class="rd-appearance" title="${S.appearanceText}">`);
	});
});
