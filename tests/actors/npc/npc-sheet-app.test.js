// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { createStonetopNpcSheetClass } from "../../../src/actors/npc/StonetopNpcSheet.js";
import { StonetopNpc } from "../../../src/actors/npc/StonetopNpc.js";
import { FakeNpcActorBuilder } from "../../fakes/FakeNpcActorBuilder.js";
import { fire } from "../../fakes/domEvents.js";

// Drives the whole NPC sheet _prepareContext (real StonetopNpc + NpcSnapshot + RichText + the one
// enrichRichTextTree pass) and proves a damage line's dice and a description's @UUID both come out
// enriched. Only the V2 actor-sheet base + the Foundry enrichHTML boundary are mocked.
function makeSheet(actor, { editable = true } = {}) {
	const Base = class {
		get actor() { return actor; }
		get isEditable() { return editable; }
		async _prepareContext() { return {}; }
		_onRender() {}
		element = document.createElement("form");
		render = vi.fn();
	};
	return new (createStonetopNpcSheetClass(Base))();
}


describe("StonetopNpcSheet._prepareContext — rich-text enrichment (integration)", () => {
	it("auto-rolls damage dice and links a description @UUID through the one pass", async () => {
		const actor = new FakeNpcActorBuilder()
			.withDamage("**maw** d10+2 (messy)")
			.withDescription("lairs in @UUID[JournalEntry.x]{the Barrow}")
			.withTypedActor(a => new StonetopNpc(a))
			.build();
		const sheet = makeSheet(actor);

		const orig = foundry.applications.ux.TextEditor.implementation.enrichHTML;
		foundry.applications.ux.TextEditor.implementation.enrichHTML = async html => html
			.replace(/\[\[\/r ([^\]]+)\]\]/g, '<a class="inline-roll">$1</a>')
			.replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '<a class="content-link">$1</a>');
		let ctx;
		try {
			ctx = await sheet._prepareContext({});
		} finally {
			foundry.applications.ux.TextEditor.implementation.enrichHTML = orig;
		}

		// damage carries roll:true, so the bare d10+2 becomes a roll link.
		expect(ctx.stonetop.damage.render()).toContain('<a class="inline-roll">d10+2</a>');
		expect(ctx.stonetop.damage.render()).toContain("<strong>maw</strong>");
		// description (roll:false) keeps prose but resolves the @UUID link.
		expect(ctx.stonetop.description.render()).toContain('<a class="content-link">the Barrow</a>');
		// the template reads these directly.
		expect(ctx.actor).toBe(actor);
		expect(ctx.editable).toBe(true);
	});
});

describe("StonetopNpcSheet._onRender — direct bindings (V2 lifecycle)", () => {
	// A spy typed actor: _onRender only routes DOM events to these setters, so the real
	// StonetopNpc isn't needed here (it's exercised by the integration test above).
	function makeSpyNpc() {
		return {
			setHp: vi.fn(), setMaxHp: vi.fn(), setArmor: vi.fn(), setDamage: vi.fn(),
			setSpecialQuality: vi.fn(), toggleSelection: vi.fn(), setInstinct: vi.fn(),
			setMoves: vi.fn(), setDescription: vi.fn(),
		};
	}

	function renderSheet({ editable = true } = {}) {
		const npc = makeSpyNpc();
		const sheet = makeSheet({ typedActor: npc }, { editable });
		sheet.element.innerHTML = `
			<input id="npc-hp" type="number" value="3">
			<input id="npc-max-hp" type="number" value="6">
			<input id="npc-armor" value="1">
			<input id="npc-damage" value="d8">
			<input id="npc-special-qualities" value="flies">
			<div class="stonetop-tags" data-field="tagList">
				<span class="stonetop-tag-chip" data-tag="devious"></span>
				<input class="stonetop-tag-add" data-field="tagList" value="  sneaky  ">
			</div>
			<input class="stonetop-npc-instinct" value=" To skulk ">
			<textarea id="npc-moves">bite</textarea>
			<textarea class="stonetop-follower-description-textarea">a rat</textarea>`;
		sheet._onRender({}, {});
		return { sheet, npc };
	}

	it("routes every field change to the matching typed-actor setter", () => {
		const { sheet, npc } = renderSheet();
		const el = sel => sheet.element.querySelector(sel);

		fire(el("#npc-hp"), "change");
		fire(el("#npc-max-hp"), "change");
		fire(el("#npc-armor"), "change");
		fire(el("#npc-damage"), "change");
		fire(el("#npc-special-qualities"), "change");
		fire(el("#npc-moves"), "change");
		fire(el(".stonetop-follower-description-textarea"), "change");

		expect(npc.setHp).toHaveBeenCalledWith("3");
		expect(npc.setMaxHp).toHaveBeenCalledWith("6");
		expect(npc.setArmor).toHaveBeenCalledWith("1");
		expect(npc.setDamage).toHaveBeenCalledWith("d8");
		expect(npc.setSpecialQuality).toHaveBeenCalledWith("flies");
		expect(npc.setMoves).toHaveBeenCalledWith("bite");
		expect(npc.setDescription).toHaveBeenCalledWith("a rat");
	});

	it("toggles a chip by its wrapper's field, adds trimmed free-text tags, trims the instinct", () => {
		const { sheet, npc } = renderSheet();

		fire(sheet.element.querySelector(".stonetop-tag-chip"), "click");
		expect(npc.toggleSelection).toHaveBeenCalledWith("tagList", "devious");

		fire(sheet.element.querySelector(".stonetop-tag-add"), "change");
		expect(npc.toggleSelection).toHaveBeenCalledWith("tagList", "sneaky");

		fire(sheet.element.querySelector(".stonetop-npc-instinct"), "change");
		expect(npc.setInstinct).toHaveBeenCalledWith("To skulk");
	});

	it("ignores an empty free-text tag box", () => {
		const { sheet, npc } = renderSheet();
		const add = sheet.element.querySelector(".stonetop-tag-add");
		add.value = "   ";
		fire(add, "change");
		expect(npc.toggleSelection).not.toHaveBeenCalled();
	});

	it("commits an Enter-added tag exactly once despite the paired change events", () => {
		// Pressing Enter fires TWO change events (native value-commit + comboBox's synthetic one).
		// Since toggleSelection *toggles*, firing it twice would add then remove the tag. The
		// handler blanks the box on the first change so the second is guarded out — one net add.
		const { sheet, npc } = renderSheet();
		const add = sheet.element.querySelector(".stonetop-tag-add");
		fire(add, "change");
		fire(add, "change");
		expect(npc.toggleSelection).toHaveBeenCalledTimes(1);
		expect(npc.toggleSelection).toHaveBeenCalledWith("tagList", "sneaky");
		expect(add.value).toBe("");
	});

	it("binds nothing when the sheet is not editable", () => {
		const { sheet, npc } = renderSheet({ editable: false });
		fire(sheet.element.querySelector("#npc-hp"), "change");
		fire(sheet.element.querySelector(".stonetop-tag-chip"), "click");
		expect(npc.setHp).not.toHaveBeenCalled();
		expect(npc.toggleSelection).not.toHaveBeenCalled();
	});
});
