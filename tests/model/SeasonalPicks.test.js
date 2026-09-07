import { describe, it, expect } from "vitest";
import {
	SeasonalOption, SeasonalGains, WinterLosses, SeasonalPicks,
	SEASONAL_GAINS_GROUP, WINTER_LOSSES_GROUP,
} from "../../src/model/data/steading/SeasonalPicks.js";

describe("SeasonalOption", () => {
	it("carries key, name and text", () => {
		const gain = new SeasonalOption("bounty", "Unexpected bounty", "1 Surplus, now.");
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

	// Summer's move gives 2 on a 10+. The count was hardcoded here, so summer offered one.
	it("takes the count the season's move offers", () => {
		expect(SeasonalGains.toChoiceGroupData(2).list[0].pickCount).toBe(2);
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


// Winter grants no gains — it TAKES. The sheet had only ever modelled the gains and handed a winter
// steading that list, which reads as a reward for the hardest season of the year.
describe("WinterLosses", () => {
	it("holds the four losses winter picks from", () => {
		expect(WinterLosses.all().map(o => o.key)).toEqual(["population", "resource", "npc", "pc"]);
	});

	it("returns a new array, so a caller cannot mutate the shared list", () => {
		WinterLosses.all().pop();
		expect(WinterLosses.all()).toHaveLength(4);
	});

	it("is its own choice group, keyed apart from the gains", () => {
		const group = WinterLosses.toChoiceGroupData();
		expect(group.slug).toBe(WINTER_LOSSES_GROUP);
		expect(group.slug).not.toBe(SEASONAL_GAINS_GROUP);
		expect(group.list[0].pickCount).toBe(1);
	});

	it("carries each loss's name and text as the option's content", () => {
		const row = WinterLosses.toChoiceGroupData().list[0];
		const pc  = row.options.find(o => o.slug === "pc");
		expect(pc.content.title).toBe("A PC leaves");
		expect(pc.content.text).toContain("retires from play");
	});
});

// A `pick` step carries the list's slug, so nothing between the pack and here has to know that
// spring picks gains and winter picks losses.
describe("SeasonalPicks", () => {
	it("resolves each list by the slug a step names", () => {
		expect(SeasonalPicks.byKey(SEASONAL_GAINS_GROUP).options).toHaveLength(6);
		expect(SeasonalPicks.byKey(WINTER_LOSSES_GROUP).options).toHaveLength(4);
	});

	it("resolves nothing for a slug no list claims", () => {
		expect(SeasonalPicks.byKey("nope")).toBeNull();
	});

	// What the turn of the wheel clears: last season's pick, whichever list it came from.
	it("names every group a season can write to", () => {
		expect(SeasonalPicks.GROUPS).toEqual([SEASONAL_GAINS_GROUP, WINTER_LOSSES_GROUP]);
	});
});
