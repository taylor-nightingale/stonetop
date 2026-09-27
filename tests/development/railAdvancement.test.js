import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { rail } from "../../scripts/development/redesign-mock/rail.js";
import { CharacterSnapshot } from "../../scripts/development/redesign-mock/CharacterSnapshot.js";

/**
 * At the threshold the rail offers two things that share it and nothing else: Level Up, done at home
 * and once, and Burn Brightly, spent after any roll anywhere. They must not read as one prompt.
 */

const maelen = new CharacterSnapshot(JSON.parse(readFileSync("scripts/development/mockup/maelen.json", "utf8")));
const ready = maelen.withVitals({ xp: { value: maelen.xp.max } });

const advancement = S => {
	const html = rail(S);
	const start = html.indexOf('class="rd-adv"');
	return html.slice(start, html.indexOf('id="rd-group-basic"', start));
};

/* The box a marker sits in, from its opening tag to the next box. */
const boxOf = (html, marker) => {
	const at = html.indexOf(marker);
	const start = html.lastIndexOf('<div class="rd-conditional', at);
	const next = html.indexOf('<div class="rd-conditional', at);
	return html.slice(start, next === -1 ? undefined : next);
};

describe("the rail at the level threshold", () => {
	const html = advancement(ready);

	it("offers Level Up first, directly under the bar that says it is ready", () => {
		expect(html.indexOf('class="rd-levelup"')).toBeGreaterThan(-1);
		expect(html.indexOf('class="rd-levelup"')).toBeLessThan(html.indexOf('data-expand="burn-brightly"'));
	});

	it("says that levelling is done at home, above the book's trigger", () => {
		const box = boxOf(html, 'class="rd-levelup"');
		expect(box).toContain('<p class="rd-levelup-home"><i class="fas fa-house" aria-hidden="true"></i> Only at home, in a quiet stretch of time</p>');
		expect(box.indexOf("rd-levelup-home")).toBeLessThan(box.indexOf("rd-route-when"));
	});

	// Advisory: the sheet says where, and leaves the button to the player.
	it("does not disable the offer", () => {
		expect(boxOf(html, 'class="rd-levelup"')).not.toContain("disabled");
	});

	it("sets Burn Brightly apart: its own edge, and the words that say it is the other choice", () => {
		const box = boxOf(html, 'data-expand="burn-brightly"');
		expect(box).toContain('class="rd-conditional rd-conditional--spend"');
		expect(box).not.toContain("rd-conditional--ready");
		expect(box).toContain('<p class="rd-conditional-label">Or spend it now</p>');
	});
});

describe("the rail with a level taken and a move still owed", () => {
	const html = advancement(maelen.withLevelUpOwing(1));

	it("routes to choosing the move, without the reminder about home", () => {
		expect(html).toContain("Choose a new move");
		expect(html).not.toContain("rd-levelup-home");
	});

	it("still says nothing about home when the bar is full again as well", () => {
		expect(advancement(ready.withLevelUpOwing(1))).not.toContain("rd-levelup-home");
	});
});

describe("the rail below the threshold", () => {
	it("offers neither", () => {
		const html = advancement(maelen.withVitals({ xp: { value: 0 } }).withLevelUpOwing(0));
		expect(html).not.toContain("rd-levelup");
		expect(html).not.toContain("burn-brightly");
	});
});
