import { describe, it, expect } from "vitest";
import { SeasonalGain, SeasonalGains, SEASONAL_GAINS_GROUP } from "../../src/model/data/steading/SeasonalGains.js";

describe("SeasonalGain", () => {
	it("carries key, name and text", () => {
		const gain = new SeasonalGain("bounty", "Unexpected bounty", "1 Surplus, now.");
		expect(gain.key).toBe("bounty");
		expect(gain.name).toBe("Unexpected bounty");
		expect(gain.text).toBe("1 Surplus, now.");
	});
});

describe("SeasonalGains", () => {
	it("holds the six gains from Book I", () => {
		expect(SeasonalGains.all().map(g => g.name)).toEqual([
			"Population boom", "Tor's blessing", "Unexpected bounty",
			"Trade opportunity", "Interesting news", "Valuable insight",
		]);
	});

	it("returns a new array, so a caller cannot mutate the shared list", () => {
		const first = SeasonalGains.all();
		first.pop();
		expect(SeasonalGains.all()).toHaveLength(6);
	});



	// Book I, p.30: on a 10+ the GM steers the first spring towards one of these three.
});

describe("SeasonalGains.toChoiceGroupData", () => {
	const group = SeasonalGains.toChoiceGroupData();
	const row   = group.list[0];

	it("names the group the steading's choice values are keyed under", () => {
		expect(group.slug).toBe(SEASONAL_GAINS_GROUP);
	});

	// "Pick 1 seasonal gain" — pickCount 1 is what makes the rendered row radios, so a new pick
	// releases the last one instead of stacking up.
	it("is a single pick-1 row", () => {
		expect(group.list).toHaveLength(1);
		expect(row.type).toBe("pick");
		expect(row.pickCount).toBe(1);
	});

	it("offers every gain as an option, keyed by the gain's key", () => {
		expect(row.options.map(o => o.slug)).toEqual(SeasonalGains.all().map(g => g.key));
	});

	it("carries each gain's name and text as the option's content", () => {
		const gain   = SeasonalGains.all().find(g => g.key === "bounty");
		const bounty = row.options.find(o => o.slug === "bounty");
		expect(bounty.content.title).toBe(gain.name);
		expect(bounty.content.text).toBe(gain.text);
	});
});
