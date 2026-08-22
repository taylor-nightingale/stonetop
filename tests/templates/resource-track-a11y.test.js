import { describe, it, expect, beforeAll } from "vitest";
import { renderTemplate } from "../fakes/renderTemplate.js";

// A track draws as a row of identical buttons carrying no text. Rendered without labels it reaches a
// screen reader as N nameless controls with no state — no way to tell which pip is which, how full
// the track is, or what it belongs to. These assert what the markup actually announces.

const TRACK = "systems/stonetop/templates/actor/partials/resource-track.hbs";

/** The i18n `format` core supplies; the test fake defers to it when a localize call has hash args. */
beforeAll(() => {
	globalThis.game = {
		i18n: {
			format: (key, data) => key === "stonetop.a11y.trackPip"
				? `${data.name} ${data.position} of ${data.total}`
				: key
		}
	};
});

const labelsOf = html => [...html.matchAll(/aria-label="([^"]*)"/g)].map(m => m[1]);
const pressedOf = html => [...html.matchAll(/aria-pressed="([^"]*)"/g)].map(m => m[1]);

describe("a resource track announces itself", () => {
	it("names each pip by its position in the track", async () => {
		const html = await renderTemplate(TRACK, { resource: { title: "HP", current: 2, max: 5 } });
		expect(labelsOf(html)).toEqual([
			"HP 1 of 5", "HP 2 of 5", "HP 3 of 5", "HP 4 of 5", "HP 5 of 5"
		]);
	});

	it("reports which pips are filled, as a pressed state", async () => {
		const html = await renderTemplate(TRACK, { resource: { title: "HP", current: 2, max: 4 } });
		expect(pressedOf(html)).toEqual(["true", "true", "false", "false"]);
	});

	it("falls back to a generic name when the track has no title of its own", async () => {
		const html = await renderTemplate(TRACK, { resource: { current: 0, max: 2 } });
		expect(labelsOf(html)).toEqual([
			"stonetop.a11y.track 1 of 2", "stonetop.a11y.track 2 of 2"
		]);
	});

	it("puts a pip's own label first, where the resource gives one", async () => {
		const html = await renderTemplate(TRACK, {
			resource: { title: "Uses", current: 0, max: 2, labels: ["dawn", "dusk"] }
		});
		expect(labelsOf(html)).toEqual(["dawn, Uses 1 of 2", "dusk, Uses 2 of 2"]);
	});

	it("gives every pip a label and a state, never some of them", async () => {
		const html = await renderTemplate(TRACK, { resource: { title: "Load", current: 1, max: 6 } });
		const pips = html.match(/<button/g) ?? [];
		expect(labelsOf(html)).toHaveLength(pips.length);
		expect(pressedOf(html)).toHaveLength(pips.length);
	});
});
