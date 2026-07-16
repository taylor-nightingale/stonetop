// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";

// Drives the WHOLE steading sheet _prepareContext (real StonetopSteading + every steading snapshot +
// RichText + the one enrichRichTextTree pass) and proves a homefront move's @UUID and a default
// note both come out enriched. Only the V2 actor-sheet base + the Foundry enrichHTML boundary are
// mocked.
function makeSheet(movesRepo) {
	const actor = new FakeSteadingBuilder().build();
	actor.typedActor = new StonetopSteading(actor, { getBySlug: async () => null }, movesRepo);

	const Base = class {
		get actor() { return actor; }
		get isEditable() { return true; }
		tabGroups = {};
		element = document.createElement("form");
		// Mini-core: ApplicationV2 seeds tabGroups from static TABS and hands context.tabs to a
		// single-group application via _prepareTabs (the sheet itself declares TABS only).
		_prepareTabs(group) {
			const { tabs, initial } = this.constructor.TABS[group];
			this.tabGroups[group] ??= initial;
			return tabs.reduce((prepared, { id }) => {
				const active = this.tabGroups[group] === id;
				prepared[id] = { id, group, active, cssClass: active ? "active" : "" };
				return prepared;
			}, {});
		}
		async _prepareContext() { return { tabs: this._prepareTabs("primary") }; }
		async _onFirstRender() {}
		_onRender() {}
		render = vi.fn();
	};
	return new (createStonetopSteadingSheetClass(Base))();
}

describe("StonetopSteadingSheet._prepareContext — rich-text enrichment (integration)", () => {
	it("enriches a homefront move's @UUID and a default note through the one pass", async () => {
		const movesRepo = new FakeMoveRepository().addBasic(
			new FakeCompendiumMoveBuilder()
				.withName("Trade")
				.withMoveType("homefront")
				.withDescription("see @UUID[JournalEntry.x]{the Barrow}")
				.build()
		);
		const sheet = makeSheet(movesRepo);
		await sheet.actor.typedActor.moves.seedHomefrontMoves();   // create-time seed (no longer on render)

		const orig = foundry.applications.ux.TextEditor.implementation.enrichHTML;
		foundry.applications.ux.TextEditor.implementation.enrichHTML =
			async html => html.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '<a class="content-link">$1</a>');
		let ctx;
		try {
			ctx = await sheet._prepareContext({});
		} finally {
			foundry.applications.ux.TextEditor.implementation.enrichHTML = orig;
		}

		// Move description: @UUID → real anchor in the rendered HTML.
		const move = ctx.stonetop.moves.moves[0];
		expect(move.description.render()).toContain('<a class="content-link">the Barrow</a>');

		// A plain default note (fortunes) also flowed through enrich — html is filled, not null.
		expect(typeof ctx.stonetop.fortunes.note.html).toBe("string");

		// The template reads these directly.
		expect(ctx.actor).toBe(sheet.actor);
		expect(ctx.editable).toBe(true);
	});

	it("marks the overview tab active by default and reflects tabGroups.primary", async () => {
		const sheet = makeSheet(new FakeMoveRepository());

		const first = await sheet._prepareContext({});
		expect(Object.keys(first.tabs)).toEqual(["overview", "residents", "neighbors", "improvements", "moves", "notes"]);
		expect(first.tabs.overview.active).toBe(true);
		expect(first.tabs.overview.cssClass).toBe("active");
		expect(first.tabs.residents.active).toBe(false);
		expect(first.tabs.residents.cssClass).toBe("");

		// Switching the active tab (what changeTab records) is reflected on the next context build.
		sheet.tabGroups.primary = "residents";
		const next = await sheet._prepareContext({});
		expect(next.tabs.residents.active).toBe(true);
		expect(next.tabs.overview.active).toBe(false);
	});
});
