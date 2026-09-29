import { describe, it, expect } from "vitest";
import { AppearanceLine } from "../../../../src/model/snapshot/character/AppearanceLine.js";
import { buildChoiceGroup } from "../../../../src/model/snapshot/character/buildChoiceGroup.js";
import { ChoiceValues } from "../../../../src/model/snapshot/character/ChoiceGroup.js";

const pickRow = options => ({ type: "pick", pickCount: 1, inline: true,
	options: options.map(text => ({ slug: text.replace(/\W+/g, "-"), text })) });

const APPEARANCE = { slug: "appearance", list: [
	pickRow(["upstart youth", "grizzled"]),
	pickRow(["clear voice", "rumbling voice"]),
	pickRow(["badge of office", "spit & polish"]),
] };

const group = (...picked) => buildChoiceGroup(APPEARANCE,
	new ChoiceValues({ appearance: Object.fromEntries(picked.map(slug => [slug, 1])) }));

describe("AppearanceLine.from", () => {
	it("joins what was chosen onto one line", () => {
		const line = AppearanceLine.from(group("grizzled", "clear-voice", "spit-polish"));
		expect(line.text.raw).toBe("grizzled · clear voice · spit & polish");
	});

	it("says it again as plain words for its tooltip", () => {
		const line = AppearanceLine.from(group("spit-polish"));
		expect(line.plain).toBe("spit & polish");
	});

	it("is empty while nothing is chosen, and with no group", () => {
		expect(AppearanceLine.from(group()).isEmpty).toBe(true);
		expect(AppearanceLine.from(null).isEmpty).toBe(true);
	});
});
