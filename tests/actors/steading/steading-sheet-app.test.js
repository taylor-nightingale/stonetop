import { describe, it, expect, vi } from "vitest";
import { createStonetopSteadingSheetClass } from "../../../src/actors/steading/StonetopSteadingSheet.js";
import { StonetopSteading } from "../../../src/actors/steading/StonetopSteading.js";
import { FakeSteadingBuilder } from "../../fakes/FakeSteadingBuilder.js";
import { FakeMoveRepository } from "../../fakes/FakeMoveRepository.js";
import { FakeCompendiumMoveBuilder } from "../../fakes/FakeCompendiumMoveBuilder.js";

// Drives the WHOLE steading sheet getData (real StonetopSteading + every steading snapshot +
// RichText + the one enrichRichTextTree pass) and proves a homefront move's @UUID and a default
// note both come out enriched. Only the Foundry enrichHTML boundary is mocked.
function makeSheet(movesRepo) {
	const actor = new FakeSteadingBuilder().build();
	actor.typedActor = new StonetopSteading(actor, { getBySlug: async () => null }, movesRepo);

	const Base = class {
		get actor() { return actor; }
		get isEditable() { return true; }
		async getData() { return {}; }
		activateListeners() {}
		render = vi.fn();
	};
	return new (createStonetopSteadingSheetClass(Base))();
}

describe("StonetopSteadingSheet.getData — rich-text enrichment (integration)", () => {
	it("enriches a homefront move's @UUID and a default note through the one pass", async () => {
		const movesRepo = new FakeMoveRepository().addWorld(
			new FakeCompendiumMoveBuilder()
				.withName("Trade")
				.withMoveType("homefront")
				.withDescription("see @UUID[JournalEntry.x]{the Barrow}")
				.build()
		);
		const sheet = makeSheet(movesRepo);

		const orig = foundry.applications.ux.TextEditor.implementation.enrichHTML;
		foundry.applications.ux.TextEditor.implementation.enrichHTML =
			async html => html.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '<a class="content-link">$1</a>');
		let ctx;
		try {
			ctx = await sheet.getData();
		} finally {
			foundry.applications.ux.TextEditor.implementation.enrichHTML = orig;
		}

		// Move description: @UUID → real anchor in the rendered HTML.
		const move = ctx.stonetop.moves.moves[0];
		expect(move.description.render()).toContain('<a class="content-link">the Barrow</a>');

		// A plain default note (fortunes) also flowed through enrich — html is filled, not null.
		expect(typeof ctx.stonetop.fortunes.note.html).toBe("string");
	});
});
