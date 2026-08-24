import { afterEach, describe, expect, it, vi } from "vitest";
import { PersonActorPlans } from "../../../src/actors/steading/PersonActorPlans.js";
import { PersonActorPlan } from "../../../src/actors/steading/PersonActorPlan.js";

const plan = (name, action) => new PersonActorPlan(name, "Stonetop", action);

function stubI18n() {
	vi.stubGlobal("game", {
		i18n: { localize: key => key, format: (key, data) => `${key}:${JSON.stringify(data)}` },
	});
}

afterEach(() => vi.unstubAllGlobals());

describe("PersonActorPlans grouping", () => {
	it("separates rows that need an actor from rows that link one that exists", () => {
		const plans = new PersonActorPlans([
			plan("Willa", PersonActorPlan.CREATE),
			plan("Brennan", PersonActorPlan.LINK),
			plan("Idony", PersonActorPlan.LINKED),
			plan("", PersonActorPlan.UNNAMED),
		]);
		expect(plans.toCreate.map(p => p.name)).toEqual(["Willa"]);
		expect(plans.toLink.map(p => p.name)).toEqual(["Brennan"]);
	});

	it("has no work when every row is already linked or unnamed", () => {
		expect(new PersonActorPlans([plan("Idony", PersonActorPlan.LINKED)]).hasWork).toBe(false);
		expect(new PersonActorPlans([]).hasWork).toBe(false);
	});

	it("has work as soon as one row needs creating or linking", () => {
		expect(new PersonActorPlans([plan("Willa", PersonActorPlan.CREATE)]).hasWork).toBe(true);
		expect(new PersonActorPlans([plan("Brennan", PersonActorPlan.LINK)]).hasWork).toBe(true);
	});
});

describe("PersonActorPlans.describe", () => {
	it("names each group in its own sentence", () => {
		stubI18n();
		const body = new PersonActorPlans([
			plan("Willa", PersonActorPlan.CREATE),
			plan("Marek", PersonActorPlan.CREATE),
			plan("Brennan", PersonActorPlan.LINK),
			plan("Idony", PersonActorPlan.LINKED),
		]).describe();
		expect(body).toContain('createActors.creating:{"count":2,"names":"Willa, Marek"}');
		expect(body).toContain('createActors.linking:{"count":1,"names":"Brennan"}');
		expect(body).not.toContain("Idony");
	});

	it("claims nothing is created when every row links an actor that already exists", () => {
		stubI18n();
		const body = new PersonActorPlans([
			plan("Brennan", PersonActorPlan.LINK),
			plan("Aratis", PersonActorPlan.LINK),
		]).describe();
		expect(body).toContain('createActors.linking:{"count":2,"names":"Brennan, Aratis"}');
		expect(body).not.toContain("createActors.creating");
	});

	it("mentions no linking when every row needs a new actor", () => {
		stubI18n();
		const body = new PersonActorPlans([plan("Willa", PersonActorPlan.CREATE)]).describe();
		expect(body).toContain('createActors.creating:{"count":1,"names":"Willa"}');
		expect(body).not.toContain("createActors.linking");
	});

	it("always ends by asking", () => {
		stubI18n();
		expect(new PersonActorPlans([plan("Willa", PersonActorPlan.CREATE)]).describe())
			.toContain("createActors.proceed");
	});

	it("escapes names, so a roster entry cannot inject markup into the prompt", () => {
		stubI18n();
		expect(new PersonActorPlans([plan("<b>Willa</b>", PersonActorPlan.CREATE)]).describe())
			.toContain("&lt;b&gt;Willa&lt;/b&gt;");
	});
});
