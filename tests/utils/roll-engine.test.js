import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeActorBuilder } from "../fakes/FakeActorBuilder.js";
import { rollDamage, rollFormula, rollStat, sign } from "../../module/utils/roll-engine.js";

let rollMessages;
let rollTotal;
let rollInstances;
let rollDice;

beforeEach(() => {
	rollMessages = [];
	rollTotal = 6;
	rollInstances = [];
	rollDice = [{ results: [{ result: 2, active: true }, { result: 4, active: true }] }];
	global.game.settings = { get: vi.fn(() => "publicroll") };
	global.ChatMessage = {
		getSpeaker: vi.fn(({ actor }) => ({ alias: actor.name })),
		create: vi.fn(),
	};
	global.Roll = class {
		constructor(formula, data = {}, options = {}) {
			this.formula = formula;
			this.data = data;
			this.options = options;
			this.total = rollTotal;
			this.dice = rollDice;
			rollInstances.push(this);
		}

		async evaluate() {
			return this;
		}

		async toMessage(message) {
			rollMessages.push(message);
		}
	};
});

function makeActor() {
	return new FakeActorBuilder()
		.withXp(2, 8)
		.withLevel(1)
		.build();
}

describe("sign", () => {
	it("formats positive, zero, and negative modifiers", () => {
		expect(sign(2)).toBe("+2");
		expect(sign(0)).toBe("+0");
		expect(sign(-1)).toBe("-1");
	});
});

describe("rollStat", () => {
	it("posts the miss XP award using the styled Stonetop roll card", async () => {
		const actor = makeActor();

		await rollStat("str", actor);

		const rollMessage = rollMessages[0];
		expect(rollMessage.flavor).toContain("stonetop-roll-card");
		expect(rollMessage.flavor).toContain("result failure");
		expect(rollMessage.flavor).toContain("Miss");
		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.xp.value": 3 }, {});
		expect(ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({
			content: expect.stringContaining("stonetop-roll-card"),
		}));
		const xpMessage = ChatMessage.create.mock.calls[0][0];
		expect(xpMessage.content).toContain("result success");
		expect(xpMessage.content).toContain("+1 XP (3 / 8)");
	});

	it("attributes the miss XP to the rolled move so the ledger can name it", async () => {
		const actor = makeActor();

		await rollStat("str", actor, { moveName: "Defy Danger" });

		expect(actor.update).toHaveBeenCalledWith({ "system.attributes.xp.value": 3 }, { stonetopMove: "Defy Danger" });
	});

	it("shows each rolled die face as a tooltip on the result total", async () => {
		rollTotal = 8;
		rollDice = [{ results: [{ result: 3, active: true }, { result: 5, active: true }] }];

		await rollStat("str", makeActor(), { noXpOnMiss: true });

		expect(rollMessages[0].flavor).toContain('class="stonetop-roll-result-number" data-tooltip="3 5"');
	});

	it("brackets the dropped die on an advantage/disadvantage roll", async () => {
		rollTotal = 9;
		rollDice = [{ results: [
			{ result: 2, active: false, discarded: true },
			{ result: 4, active: true },
			{ result: 5, active: true },
		] }];

		await rollStat("str", makeActor(), { rollMode: "adv", noXpOnMiss: true });

		expect(rollMessages[0].flavor).toContain('data-tooltip="(2) 4 5"');
	});

	it.each([
		{ total: 6, label: "Miss",       resultClass: "failure" },
		{ total: 7, label: "Weak Hit",   resultClass: "partial" },
		{ total: 10, label: "Strong Hit", resultClass: "success" },
	])("renders $label for a total of $total", async ({ total, label, resultClass }) => {
		rollTotal = total;

		await rollStat("wis", makeActor(), { noXpOnMiss: true });

		expect(rollMessages[0].flavor).toContain(`result ${resultClass}`);
		expect(rollMessages[0].flavor).toContain(label);
	});

	it("uses the expected formula, data, and roll options", async () => {
		rollTotal = 10;

		await rollStat("dex", makeActor(), {
			rollMode: "adv",
			statValue: 2,
			modifier: 3,
			stonetopDebility: "Weakened",
			stonetopDebilityTooltip: "Shaky",
		});

		expect(rollInstances[0]).toMatchObject({
			formula: "3d6kh2+@stat+@mod",
			data: { stat: 2, mod: 3 },
			options: {
				stonetopDebility: "Weakened",
				stonetopDebilityTooltip: "Shaky",
			},
		});
	});

	it("renders move descriptions and roll condition pills", async () => {
		rollTotal = 10;

		await rollStat("str", makeActor(), {
			moveName: "Clash",
			moveDescription: "<p>Trade blows.</p>",
			rollMode: "dis",
			modifier: 4,
			forward: 1,
			ongoing: 2,
		});

		const flavor = rollMessages[0].flavor;
		expect(flavor).toContain("Clash");
		expect(flavor).toContain("stonetop-roll-card-description");
		expect(flavor).toContain("<p>Trade blows.</p>");
		expect(flavor).toContain("stonetop-roll-conditions");
		expect(flavor).toContain("Disadvantage");
		expect(flavor).toContain("Forward +1");
		expect(flavor).toContain("Ongoing +2");
		expect(flavor).toContain("Situational +1");
	});

	it("does not award XP when noXpOnMiss is true", async () => {
		const actor = makeActor();

		await rollStat("str", actor, { noXpOnMiss: true });

		expect(actor.update).not.toHaveBeenCalled();
		expect(ChatMessage.create).not.toHaveBeenCalled();
	});

	it("renders the matched-tier move outcome and stashes every tier for shifting", async () => {
		rollTotal = 10;
		const moveResults = {
			success: { value: "You pull it off." },
			partial: { value: "A cost or consequence." },
			failure: { value: "Things get worse." },
		};

		await rollStat("str", makeActor(), { noXpOnMiss: true, moveResults });

		const flavor = rollMessages[0].flavor;
		expect(flavor).toContain("You pull it off.");
		expect(flavor).toContain('data-outcome-success="You pull it off."');
		expect(flavor).toContain('data-outcome-partial="A cost or consequence."');
		expect(flavor).toContain('data-outcome-failure="Things get worse."');
	});

	it("shows the failure outcome on a miss", async () => {
		rollTotal = 6;

		await rollStat("str", makeActor(), {
			noXpOnMiss: true,
			moveResults: { failure: { value: "Disaster strikes." } },
		});

		expect(rollMessages[0].flavor).toContain("Disaster strikes.");
	});

	it("escapes HTML in outcome text", async () => {
		rollTotal = 10;

		await rollStat("str", makeActor(), {
			noXpOnMiss: true,
			moveResults: { success: { value: "A & B < C" } },
		});

		expect(rollMessages[0].flavor).toContain("A &amp; B &lt; C");
	});

	it("omits the outcome line when the move has no moveResults", async () => {
		rollTotal = 10;

		await rollStat("str", makeActor(), { noXpOnMiss: true });

		expect(rollMessages[0].flavor).toContain('<span class="stonetop-roll-result-details"></span>');
	});
});

describe("rollDamage", () => {
	it("posts damage rolls using the Stonetop card shell", async () => {
		await rollDamage("d6+1", makeActor(), { label: "Hammer" });

		expect(rollInstances[0].formula).toBe("d6+1");
		expect(rollMessages[0]).toMatchObject({
			rollMode: "publicroll",
			speaker: { alias: "Brakken" },
		});
		expect(rollMessages[0].flavor).toContain("stonetop-roll-card");
		expect(rollMessages[0].flavor).toContain("Hammer");
		expect(rollMessages[0].flavor).toContain("stonetop-card-buttons");
	});

	it("rolls a disadvantaged die twice and keeps the lower, with a pill", async () => {
		await rollDamage("d6", makeActor(), {
			label: "icy touch d6 w/disadvantage (hand, ignores armor)",
			rollMode: "dis",
		});

		expect(rollInstances[0].formula).toBe("2d6kl1");
		expect(rollMessages[0].flavor).toContain("icy touch d6 w/disadvantage");
		expect(rollMessages[0].flavor).toContain("stonetop-condition-disadvantage");
	});

	it("rolls an advantaged die twice and keeps the higher, preserving the modifier", async () => {
		await rollDamage("d8+2", makeActor(), { label: "Maw", rollMode: "adv" });

		expect(rollInstances[0].formula).toBe("2d8kh1+2");
		expect(rollMessages[0].flavor).toContain("stonetop-condition-advantage");
	});
});

describe("rollFormula", () => {
	it("posts generic formula rolls with formula and description", async () => {
		await rollFormula("1d4+2", makeActor(), {
			label: "Supply",
			description: "<p>Roll surplus.</p>",
		});

		expect(rollInstances[0].formula).toBe("1d4+2");
		expect(rollMessages[0].flavor).toContain("Supply");
		expect(rollMessages[0].flavor).toContain("1d4+2");
		expect(rollMessages[0].flavor).toContain("<p>Roll surplus.</p>");
		expect(rollMessages[0].flavor).toContain("stonetop-card-buttons");
	});
});
