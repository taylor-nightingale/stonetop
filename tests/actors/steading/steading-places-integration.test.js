// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderPartial } from "../../fakes/renderTemplate.js";
import { NeighborPlaces } from "../../../src/actors/steading/NeighborPlaces.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { steadingChangeHandlers } from "../../../src/actors/steading/steadingChangeHandlers.js";
import { applySteadfast } from "../../../src/actors/steading/applySteadfast.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { steadingRepos } from "../../fakes/FakeSteadingRepos.js";

// The Places tab, end to end: the REAL partial rendered from the REAL snapshot, then the control it
// stamps driven through the REAL change-action router down to actor state.
//
// The split this guards is the whole point of the tab. A neighbour's Size is DEFINITIONAL — the
// book's word for the place — so it is authored on the steadfast and only read here. Travel is the
// opposite: measured from THIS steading, so it exists only here and a steadfast never carries it.
// Rendering the same partial both ways is what proves the two sheets don't quietly swap roles.

function steading() {
	const actor = new FakeSteadingBuilder()
		.withTypedActor(a => new StonetopSteading(a, steadingRepos({
			improvements: { getBySlug: async () => null },
			moves: new FakeMoveRepository(),
		})))
		.build();
	return { actor, typed: actor.typedActor };
}

const dom = html => {
	const root = document.createElement("div");
	root.innerHTML = html;
	return root;
};

// The two sheets render one partial with different flags — see steading-neighbor-places.hbs.
const asSteading = actor => dom(renderPartial("stonetop.steading-neighbor-places", {
	title: "Neighbouring Communities",
	places: new NeighborPlaces(actor).buildSnapshot(),
	showNames: false, showTravel: true, editable: true,
}));

const asSteadfast = actor => dom(renderPartial("stonetop.steading-neighbor-places", {
	title: "Neighbouring Communities",
	places: new NeighborPlaces(actor).buildSnapshot(),
	showNames: true, editableSize: true, editable: true,
}));

const row = (root, slug) => root.querySelector(`[data-id="${slug}"]`).closest(".steading-neighbor-place");

describe("the Places tab — neighbouring communities", () => {
	it("names every place the steading knows", () => {
		const { actor } = steading();
		const names = [...asSteading(actor).querySelectorAll(".steading-neighbor-name")].map(h => h.textContent.trim());
		expect(names[0]).toBe("Marshedge");
		expect(names).toHaveLength(6);
	});

	// Five sibling headings with nothing naming them was the old shape; "Marshedge" says what it is
	// only to someone who already knows.
	it("puts the group's heading above the places, a level up from their names", () => {
		const root = asSteading(steading().actor);
		expect(root.querySelector("h3").textContent).toContain("Neighbouring Communities");
		expect(root.querySelectorAll("h4.steading-neighbor-name")).toHaveLength(6);
	});

	it("carries a place's subtitle beside its name", () => {
		const steplands = row(asSteading(steading().actor), "steplands");
		expect(steplands.querySelector(".steading-neighbor-subtitle").textContent.trim()).toBe("Hillfolk");
	});

	describe("Size — definitional, so this sheet only reads it", () => {
		it("states the book's word for a place that has one", () => {
			const marshedge = row(asSteading(steading().actor), "marshedge");
			expect(marshedge.querySelector(".steading-neighbor-fact-value").textContent.trim())
				.toBe("stonetop.steading.tier.size.town");
		});

		// A fact with nothing in it is not a fact. The Steplands and Lygos are regions rather than
		// steadings and the book gives them no size at all, so a label and a dash would be furniture
		// saying nothing.
		it("draws no Size at all for a grouping the book gives none", () => {
			const lygos = row(asSteading(steading().actor), "lygos");
			expect(lygos.querySelector(".steading-neighbor-fact-value")).toBeNull();
			expect(lygos.querySelectorAll(".steading-neighbor-fact")).toHaveLength(1);
		});

		it("offers no control to change it, here", () => {
			expect(asSteading(steading().actor).querySelector(".steading-neighbor-size-select")).toBeNull();
		});

		// The router's vocabulary belongs to the actor sheets; nothing there writes a neighbour's Size,
		// so stamping one would be a name no handler answers (see templateHandlerContract).
		it("stamps no change-action for it on either sheet", () => {
			const { actor } = steading();
			for (const root of [asSteading(actor), asSteadfast(actor)])
				expect(root.querySelector('[data-change-action="neighborPlaceSize"]')).toBeNull();
		});
	});

	// The tab's whole reason for existing, and the half of a row that has no other home: what this
	// table knows about the place. It had no end-to-end cover at all, in either tab it has lived in.
	describe("Notes — the table's own, and nothing else's", () => {
		it("writes what the table typed all the way down to actor state", async () => {
			const { actor, typed } = steading();
			const note = row(asSteading(actor), "marshedge").querySelector(".stonetop-neighbor-place-note");
			expect(note.tagName).toBe("TEXTAREA");
			expect(note.dataset.changeAction).toBe("neighborPlaceNote");
			note.value = "Owes us grain since the spring";

			const handlers = steadingChangeHandlers(typed, { availableSteadfasts: () => [] });
			await handlers[note.dataset.changeAction](note);

			expect(actor.system.neighborPlaces.find(p => p.slug === "marshedge").note)
				.toBe("Owes us grain since the spring");
		});

		it("reads back into the box it was typed in, and into no other row", async () => {
			const { actor, typed } = steading();
			const handlers = steadingChangeHandlers(typed, { availableSteadfasts: () => [] });
			await handlers.neighborPlaceNote({ dataset: { id: "marshedge" }, value: "Owes us grain" });

			const root = asSteading(actor);
			expect(row(root, "marshedge").querySelector(".stonetop-neighbor-place-note").textContent)
				.toBe("Owes us grain");
			expect(row(root, "lygos").querySelector(".stonetop-neighbor-place-note").textContent).toBe("");
		});

		it("leaves the definitional half of the row alone when it lands", async () => {
			const { actor, typed } = steading();
			const handlers = steadingChangeHandlers(typed, { availableSteadfasts: () => [] });
			await handlers.neighborPlaceNote({ dataset: { id: "marshedge" }, value: "Owes us grain" });

			expect(actor.system.neighborPlaces.find(p => p.slug === "marshedge"))
				.toMatchObject({ name: "Marshedge", size: "town", travel: "10 days" });
		});

		// The steadfast is a definition; a note is a record. Re-applying one used to blank every note
		// on the sheet, which is the loss this tab can least afford — see applySteadfast.
		it("survives the steadfast being applied over the top", async () => {
			const { actor, typed } = steading();
			const handlers = steadingChangeHandlers(typed, { availableSteadfasts: () => [] });
			await handlers.neighborPlaceNote({ dataset: { id: "marshedge" }, value: "Owes us grain" });

			await applySteadfast(actor, { name: "Stonetop", system: {
				slug: "stonetop", attributes: {}, assets: {}, placesOfInterest: [], residents: {},
				improvements: [], impressions: [],
				neighborPlaces: [{ slug: "marshedge", name: "Marshedge", subtitle: "", note: "", names: "Abben", size: "town", travel: "10 days" }],
			} });

			expect(row(asSteading(actor), "marshedge").querySelector(".stonetop-neighbor-place-note").textContent)
				.toBe("Owes us grain");
		});
	});

	// Barrier Pass was split out of "Other places" for exactly this reason: the GM playbook prints a
	// travel time for it, and a grouping cannot carry one.
	describe("Travel — seeded from the book, then the steading's own", () => {
		it("shows the book's printed time against each place that has one", () => {
			const root = asSteading(steading().actor);
			const timeFor = slug => row(root, slug).querySelector(".steading-neighbor-travel").getAttribute("value");
			expect(timeFor("marshedge")).toBe("10 days");
			expect(timeFor("gordins-delve")).toBe("4 days");
			expect(timeFor("barrier-pass")).toBe("5 days");
		});

		// "Other places" is several journeys, so it is none of them — and a row with neither fact
		// carries no fact row at all. Barrier Pass was split out of it precisely because the book DOES
		// print a time for that one.
		it("draws no facts at all on the catch-all row", () => {
			const other = asSteading(steading().actor)
				.querySelectorAll(".steading-neighbor-place")[5];
			expect(other.querySelector(".steading-neighbor-name").textContent).toContain("Other places");
			expect(other.querySelectorAll(".steading-neighbor-fact")).toHaveLength(0);
		});

		it("is an editable field, stamped with the action the steading routes", () => {
			const marshedge = row(asSteading(steading().actor), "marshedge");
			const input = marshedge.querySelector(".steading-neighbor-travel");
			expect(input.tagName).toBe("INPUT");
			expect(input.getAttribute("data-change-action")).toBe("neighborPlaceTravel");
			expect(input.getAttribute("data-id")).toBe("marshedge");
		});

		it("is named for assistive tech, since its visible label is one word shared by five rows", () => {
			const marshedge = row(asSteading(steading().actor), "marshedge");
			expect(marshedge.querySelector(".steading-neighbor-travel").getAttribute("aria-label"))
				.toBe("Travel to Marshedge from here");
		});

		it("reaches actor state through the real change-action router", async () => {
			const { actor, typed } = steading();
			const input = row(asSteading(actor), "marshedge").querySelector(".steading-neighbor-travel");
			input.value = "4 days, the West Road";

			const handlers = steadingChangeHandlers(typed, { availableSteadfasts: () => [] });
			await handlers[input.dataset.changeAction](input);

			expect(actor.system.neighborPlaces.find(p => p.slug === "marshedge").travel)
				.toBe("4 days, the West Road");
		});

		it("leaves the definitional half of the row alone when it lands", async () => {
			const { actor, typed } = steading();
			const handlers = steadingChangeHandlers(typed, { availableSteadfasts: () => [] });
			await handlers.neighborPlaceTravel({ dataset: { id: "marshedge" }, value: "months" });

			expect(actor.system.neighborPlaces.find(p => p.slug === "marshedge"))
				.toMatchObject({ name: "Marshedge", size: "town" });
		});
	});

	// The same partial, the other way round: the steadfast authors the Size and never sees a Travel
	// field, because its rows have no such thing to hold.
	describe("the steadfast sheet, from the same partial", () => {
		// Ticked via the `selected` ATTRIBUTE rather than `select.value`: happy-dom mis-assigns the
		// selected index when the options are separated by whitespace, so reading the property here
		// would be testing the fake DOM instead of the markup a browser gets.
		const ticked = select => [...select.querySelectorAll("option[selected]")].map(o => o.value);

		it("makes Size a real select over the book's four tiers, ticking the one it is", () => {
			const marshedge = row(asSteadfast(steading().actor), "marshedge");
			const select = marshedge.querySelector("select.steading-neighbor-size-select");
			expect([...select.options].map(o => o.value)).toEqual(["hamlet", "village", "town", "city"]);
			expect(ticked(select)).toEqual(["town"]);
		});

		// A select with nothing matching silently shows its first option — so an unsized place would
		// read as "hamlet", a value nobody chose.
		it("offers a ticked blank option where nothing is chosen", () => {
			const lygos = row(asSteadfast(steading().actor), "lygos");
			const select = lygos.querySelector("select.steading-neighbor-size-select");
			expect(select.options[0].value).toBe("");
			expect(ticked(select)).toEqual([""]);
		});

		it("shows no travel field, which a definition cannot state", () => {
			expect(asSteadfast(steading().actor).querySelector(".steading-neighbor-travel")).toBeNull();
		});

		// The pools are clickable entries in Folk's reference column on the steading; a second, inert
		// copy here would be the wall that tab exists to retire.
		it("keeps the name pools it alone renders", () => {
			const { actor } = steading();
			expect(asSteadfast(actor).querySelector(".steading-names-text").textContent).toContain("Abben");
			expect(asSteading(actor).querySelector(".steading-names-text")).toBeNull();
		});
	});
});
