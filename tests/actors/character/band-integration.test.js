// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";
import { TestPlaybookItemBuilder } from "../../fakes/TestPlaybookItemBuilder.js";
import { renderTemplate } from "../../fakes/renderTemplate.js";
import { OpenDisclosures } from "../../../src/utils/OpenDisclosures.js";
import { fire, settle } from "../../fakes/domEvents.js";

// The band, end to end (D7, D9): the masthead with the instinct and appearance readouts, the stats
// with the debilities' brackets, the Ailments panel and its editor, and the folded line of stat
// pairs. Real playbook item, real character, real template, pressed through the sheet's own actions.

const INSTINCT = { slug: "instinct", list: [{ type: "pick", pickCount: 1, options: [
	{ slug: "duty", content: { title: "Duty", text: "To do what must be done." } },
]}]};

const APPEARANCE = { slug: "appearance", list: [
	{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "grizzled", text: "grizzled" }, { slug: "youth", text: "upstart youth" }] },
	{ type: "pick", pickCount: 1, inline: true, options: [{ slug: "clear-voice", text: "clear voice" }] },
]};

const playbook = () => new TestPlaybookItemBuilder()
	.withSlug("the-marshal").withName("The Marshal").withInstinct(INSTINCT).withAppearance(APPEARANCE)
	.withChoiceValues({ instinct: { duty: 1 }, appearance: { grizzled: 1, "clear-voice": 1 } })
	.build();

function makeSheet({ wounds = [], dazed = false } = {}) {
	new FakeGameBuilder().build();
	const actor = new FakeCharacterActorBuilder()
		.withPlaybook("the-marshal").withItems([playbook()]).withWounds(wounds).withDebility("dazed", dazed)
		.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory()))
		.build();
	const Base = class {
		tabGroups = {};
		element = document.createElement("form");
		openDisclosures = new OpenDisclosures();
		render = vi.fn();
		changeTab = vi.fn();
		get actor() { return actor; }
		get typedActor() { return actor.typedActor; }
		get isEditable() { return true; }
		_getTabsConfig(group) { return this.constructor.TABS[group] ?? null; }
		async _prepareContext() {
			return { tabs: {}, actor, editable: true, sheetIdPrefix: "sheet", stonetop: await actor.typedActor.buildSnapshot() };
		}
		async _onFirstRender() {}
		_onRender() {}
		restoreViewState() {}
	};
	const sheet = new (createStonetopCharacterSheetClass(Base))();
	return { sheet, actor };
}

// The sheet's own context (so its view state is in it), the real template, in the document as core
// has it by _onRender, then its own wiring once.
async function render(sheet) {
	const context = await sheet._prepareContext({});
	sheet.element.innerHTML = renderTemplate("systems/stonetop/templates/actor/character.hbs", context);
	document.body.replaceChildren(sheet.element);
	if (!sheet._wired) { await sheet._onFirstRender(context, {}); sheet._wired = true; }
	sheet._onRender(context, {});
	return sheet.element;
}

const band = root => root.querySelector(".stonetop-band");
// A destructive action is registered with both mouse buttons, as `{ buttons, handler }`.
const press = async (sheet, target, event = new MouseEvent("click", { button: 0 })) => {
	const action = sheet.constructor.DEFAULT_OPTIONS.actions[target.dataset.action];
	await (action.handler ?? action).call(sheet, event, target);
	await settle();
};
const rightClick = () => new MouseEvent("contextmenu", { button: 2 });
const woundsOf = actor => actor.system.wounds.map(w => [w.name, w.state]);

beforeEach(() => { document.body.innerHTML = ""; });

describe("the masthead (integration)", () => {
	it("names the character with the playbook in one heading", async () => {
		const root = await render(makeSheet().sheet);
		expect(band(root).querySelector("h1.charname .stonetop-charname-playbook").textContent).toBe("The Marshal");
	});

	it("reads the instinct beside the name, routing to where it is edited", async () => {
		const { sheet } = makeSheet();
		const root = await render(sheet);
		const instinct = band(root).querySelector(".stonetop-instinct .stonetop-goto");
		expect(instinct.textContent.trim()).toBe("Duty — To do what must be done.");
		expect(instinct.dataset.tab).toBe("playbook");
		await press(sheet, instinct);
		expect(sheet.changeTab).toHaveBeenCalledWith("playbook", "primary");
	});

	it("reads the appearance under it as one line", async () => {
		const root = await render(makeSheet().sheet);
		expect(band(root).querySelector(".stonetop-appearance").textContent.trim()).toBe("grizzled · clear voice");
	});

	it("no longer carries the debility strip", async () => {
		const root = await render(makeSheet().sheet);
		expect(root.querySelector(".stonetop-masthead-debilities")).toBeNull();
	});
});

describe("the stats (integration)", () => {
	it("marks the two tiles a ticked debility hinders, and no others", async () => {
		const root = await render(makeSheet({ dazed: true }).sheet);
		const hindered = [...band(root).querySelectorAll(".sheet-top .stonetop-stat.is-hindered")].map(t => t.dataset.stat);
		expect(hindered.sort()).toEqual(["int", "wis"]);
	});
});

describe("the Ailments panel (integration)", () => {
	const ailments = root => band(root).querySelector(".stonetop-ailments");
	const rows = root => [...ailments(root).querySelectorAll(".stonetop-ailment")]
		.map(li => li.querySelector(".stonetop-ailment-name").textContent.trim());

	it("says nothing ails you while nothing does", async () => {
		const root = await render(makeSheet().sheet);
		expect(ailments(root).querySelector(".stonetop-ailments-empty")).not.toBeNull();
		expect(rows(root)).toEqual([]);
	});

	it("lists a marked debility, then the wounds", async () => {
		const root = await render(makeSheet({ dazed: true, wounds: [{ id: "w1", name: "bad knee", state: "permanent" }] }).sheet);
		expect(rows(root)).toEqual(["stonetop.character.debilities.name.dazed", "bad knee"]);
		expect(ailments(root).querySelector(".stonetop-ailment--wound .stonetop-ailment-note").textContent.trim())
			.toBe("stonetop.character.wounds.state.permanent");
	});

	it("shows three and counts the rest on the bar", async () => {
		const wounds = ["a", "b", "c", "d"].map(n => ({ id: n, name: n, state: "active" }));
		const root = await render(makeSheet({ dazed: true, wounds }).sheet);
		expect(rows(root)).toHaveLength(3);
		expect(ailments(root).querySelector(".stonetop-bar .stonetop-ailments-more").dataset.action).toBe("openAilments");
	});
});

describe("the wound editor (integration)", () => {
	const editor = root => root.querySelector(".stonetop-ailment-editor");
	const open = async (sheet, root, selector = ".stonetop-ailments-edit") => {
		await press(sheet, band(root).querySelector(selector));
		return render(sheet);
	};

	it("is shut until asked for", async () => {
		expect(editor(await render(makeSheet().sheet))).toBeNull();
	});

	it("opens from the + on the bar, listing every wound", async () => {
		const wounds = ["a", "b", "c", "d"].map(n => ({ id: n, name: n, state: "active" }));
		const { sheet } = makeSheet({ wounds });
		const root = await open(sheet, await render(sheet));
		expect(editor(root).querySelectorAll(".stonetop-ailment-edit")).toHaveLength(4);
	});

	it("adds a wound, and stays open to name it", async () => {
		const { sheet, actor } = makeSheet();
		let root = await open(sheet, await render(sheet));
		await press(sheet, editor(root).querySelector(".stonetop-ailment-add"));
		root = await render(sheet);
		expect(woundsOf(actor)).toEqual([["", "active"]]);
		expect(editor(root).querySelectorAll(".stonetop-ailment-edit")).toHaveLength(1);
		expect(document.activeElement).toBe(editor(root).querySelector(".stonetop-ailment-edit-name"));
	});

	it("renames a wound when its name changes", async () => {
		const { sheet, actor } = makeSheet({ wounds: [{ id: "w1", name: "", state: "active" }] });
		const root = await open(sheet, await render(sheet));
		const name = editor(root).querySelector(".stonetop-ailment-edit-name");
		name.value = "broken arm";
		fire(name, "change");
		await settle();
		expect(woundsOf(actor)).toEqual([["broken arm", "active"]]);
	});

	it("moves a wound on to its next state", async () => {
		const { sheet, actor } = makeSheet({ wounds: [{ id: "w1", name: "cut", state: "active" }] });
		const root = await open(sheet, await render(sheet));
		await press(sheet, editor(root).querySelector(".stonetop-ailment-state"));
		expect(woundsOf(actor)).toEqual([["cut", "stabilized"]]);
	});

	// Removing is the sheet's delete: a click asks first, naming the wound; a right-click does not.
	describe("removing a wound", () => {
		let confirm;
		const answer = result => {
			confirm = vi.fn(async () => result);
			globalThis.foundry.applications.api.DialogV2 = { confirm };
		};
		let saved;
		beforeEach(() => {
			globalThis.foundry ??= {};
			globalThis.foundry.applications ??= {};
			globalThis.foundry.applications.api ??= {};
			saved = globalThis.foundry.applications.api.DialogV2;
		});
		afterEach(() => { globalThis.foundry.applications.api.DialogV2 = saved; });

		const remove = async (answerWith, event) => {
			answer(answerWith);
			const { sheet, actor } = makeSheet({ wounds: [{ id: "w1", name: "cut", state: "active" }] });
			const root = await open(sheet, await render(sheet));
			await press(sheet, editor(root).querySelector(".stonetop-ailment-remove"), event);
			return { actor, root: await render(sheet) };
		};

		it("asks, naming the wound, and removes it on yes — the editor still open", async () => {
			const { actor, root } = await remove(true);
			expect(confirm).toHaveBeenCalledOnce();
			expect(confirm.mock.calls[0][0].content).toContain("cut");
			expect(woundsOf(actor)).toEqual([]);
			expect(editor(root)).not.toBeNull();
		});

		it("keeps the wound on no", async () => {
			const { actor } = await remove(false);
			expect(woundsOf(actor)).toEqual([["cut", "active"]]);
		});

		it("removes it without asking on a right-click", async () => {
			const { actor } = await remove(false, rightClick());
			expect(confirm).not.toHaveBeenCalled();
			expect(woundsOf(actor)).toEqual([]);
		});
	});

	// Two ×s in one small panel read as the same control: the way out says it in a word.
	it("says Done on its way out, never the × a wound's removal wears", async () => {
		const { sheet } = makeSheet({ wounds: [{ id: "w1", name: "cut", state: "active" }] });
		const root = await open(sheet, await render(sheet));
		const done = editor(root).querySelector(".stonetop-ailment-close");
		expect(done.textContent.trim()).toBe("stonetop.character.ailments.done");
		expect(done.textContent).not.toContain(editor(root).querySelector(".stonetop-ailment-remove").textContent.trim());
	});

	it("opens from a wound's own row, on that wound", async () => {
		const wounds = [{ id: "w1", name: "cut", state: "active" }, { id: "w2", name: "bruise", state: "active" }];
		const { sheet } = makeSheet({ wounds });
		const root = await open(sheet, await render(sheet), '.stonetop-ailment--wound [data-wound-id="w2"]');
		expect(document.activeElement).toBe(editor(root).querySelector('[data-wound-id="w2"] .stonetop-ailment-edit-name'));
	});

	it("shuts from its close button, on Escape, and on a click elsewhere on the sheet", async () => {
		const { sheet } = makeSheet();
		let root = await open(sheet, await render(sheet));
		await press(sheet, editor(root).querySelector(".stonetop-ailment-close"));
		expect(editor(await render(sheet))).toBeNull();

		root = await open(sheet, await render(sheet));
		editor(root).querySelector(".stonetop-ailment-add").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		expect(editor(await render(sheet))).toBeNull();

		root = await open(sheet, await render(sheet));
		fire(root.querySelector(".sheet-body"), "click");
		expect(editor(await render(sheet))).toBeNull();
	});

	// Reported: + and then nothing typed took "nothing ails you" away, for an empty row.
	it("still says nothing ails you while the added wound has no name", async () => {
		const { sheet } = makeSheet();
		let root = await open(sheet, await render(sheet));
		await press(sheet, editor(root).querySelector(".stonetop-ailment-add"));
		root = await render(sheet);
		expect(band(root).querySelector(".stonetop-ailments-empty")).not.toBeNull();
		expect(band(root).querySelectorAll(".stonetop-ailment")).toHaveLength(0);
	});

	it("leaves no wound behind when shut on an empty line, from its close button or a click elsewhere", async () => {
		const { sheet, actor } = makeSheet();
		let root = await open(sheet, await render(sheet));
		await press(sheet, editor(root).querySelector(".stonetop-ailment-add"));
		root = await render(sheet);
		await press(sheet, editor(root).querySelector(".stonetop-ailment-close"));
		expect(woundsOf(actor)).toEqual([]);

		root = await open(sheet, await render(sheet));
		await press(sheet, editor(root).querySelector(".stonetop-ailment-add"));
		root = await render(sheet);
		fire(root.querySelector(".sheet-body"), "click");
		await settle();
		expect(woundsOf(actor)).toEqual([]);
	});

	// The name is saved as its field is left — by the very click that shuts the editor.
	it("keeps a wound named on the way out", async () => {
		const { sheet, actor } = makeSheet();
		let root = await open(sheet, await render(sheet));
		await press(sheet, editor(root).querySelector(".stonetop-ailment-add"));
		root = await render(sheet);
		const name = editor(root).querySelector(".stonetop-ailment-edit-name");
		name.value = "broken arm";
		fire(name, "change");
		fire(root.querySelector(".sheet-body"), "click");
		await settle();
		expect(woundsOf(actor)).toEqual([["broken arm", "active"]]);
	});

	it("stays open for a click inside it", async () => {
		const { sheet } = makeSheet();
		const root = await open(sheet, await render(sheet));
		fire(editor(root).querySelector(".stonetop-ailment-editor-note"), "click");
		expect(editor(await render(sheet))).not.toBeNull();
	});
});

describe("the folded line (integration)", () => {
	const ledger = root => band(root).querySelector(".stonetop-folded-ledger");

	it("sets the stats out in the pairs their conditions hinder, each condition after its pair", async () => {
		const root = await render(makeSheet().sheet);
		const pairs = [...ledger(root).querySelectorAll(".stonetop-folded-pair")].map(pair => [
			[...pair.querySelectorAll(".stonetop-folded-stat .stonetop-folded-abbr")].map(b => b.dataset.roll),
			pair.querySelector(".stonetop-folded-cond input").dataset.slug,
		]);
		expect(pairs).toEqual([[["str", "dex"], "weakened"], [["int", "wis"], "dazed"], [["con", "cha"], "miserable"]]);
	});

	it("marks a condition from the line", async () => {
		const { sheet, actor } = makeSheet();
		const root = await render(sheet);
		const tick = ledger(root).querySelector('.stonetop-folded-cond input[data-slug="dazed"]');
		tick.checked = true;
		fire(tick, "change");
		await settle();
		expect(actor.system.attributes.debilities.options.dazed.value).toBe(true);
	});

	it("no longer carries HP, Armor or Damage", async () => {
		const root = await render(makeSheet().sheet);
		expect(ledger(root).querySelector(".stonetop-folded-vitals")).toBeNull();
		expect(ledger(root).querySelector("[data-change-action='hp']")).toBeNull();
	});
});

describe("the band's foot (integration)", () => {
	// happy-dom lays nothing out, so the widths the sheet measures are given: six tiles' worth of
	// stats in a band too narrow to seat the fold control beside them.
	const WIDTHS = { "stonetop-band": 600, "stonetop-stats-column": 460, "stonetop-top-toggle": 240 };
	let original;
	beforeEach(() => {
		original = Element.prototype.getBoundingClientRect;
		Element.prototype.getBoundingClientRect = function () {
			const width = Object.entries(WIDTHS).find(([cls]) => this.classList?.contains(cls))?.[1] ?? 0;
			return { width, height: 10, left: 0, top: 0, right: width, bottom: 10 };
		};
	});
	afterEach(() => { Element.prototype.getBoundingClientRect = original; });

	// Never under the stats: short of room the line keeps to its column and wraps there.
	it("wraps in its own column where it does not fit beside the stats, and stays so across a render", async () => {
		const { sheet } = makeSheet();
		const root = await render(sheet);
		expect([...band(root).classList]).toEqual(expect.arrayContaining(["is-foot-compact", "is-foot-wrapped"]));
		expect(band(root).classList.contains("is-foot-under")).toBe(false);

		const fresh = document.createElement("div");
		fresh.innerHTML = root.innerHTML.replace(/ is-foot-compact| is-foot-wrapped/g, "");
		sheet.restoreViewState(fresh);
		expect([...fresh.querySelector(".stonetop-band").classList]).toEqual(expect.arrayContaining(["is-foot-compact", "is-foot-wrapped"]));
	});
});
