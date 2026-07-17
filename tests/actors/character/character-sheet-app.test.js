// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { createStonetopCharacterSheetClass } from "../../../src/actors/character/StonetopCharacterSheet.js";
import { StonetopCharacter } from "../../../src/actors/character/StonetopCharacter.js";
import { FakeCharacterActorBuilder } from "../../fakes/FakeCharacterActorBuilder.js";
import { FakeRepositoryFactory } from "../../fakes/FakeRepositoryFactory.js";
import { FakeGameBuilder } from "../../fakes/FakeGameBuilder.js";

// -- Fake V2 base ---------------------------------------------------------------
// Mini-core: ApplicationV2 seeds tabGroups from the tabs config and routes _prepareTabs through
// _getTabsConfig (which the sheet overrides for the per-insert tabs).

function makeBase(actor) {
	return class {
		tabGroups = {};
		element = document.createElement("form");
		_editable = true;
		superDrop = vi.fn(async () => "super-drop");
		render = vi.fn();

		get actor() { return actor; }
		get isEditable() { return this._editable; }

		_getTabsConfig(group) { return this.constructor.TABS[group] ?? null; }

		_prepareTabs(group) {
			const { tabs, initial = null, labelPrefix } = this._getTabsConfig(group) ?? { tabs: [] };
			this.tabGroups[group] ??= initial;
			return tabs.reduce((prepared, { id, ...cfg }) => {
				const active = this.tabGroups[group] === id;
				const tab = { id, group, active, cssClass: active ? "active" : "", ...cfg };
				if (labelPrefix) tab.label ??= `${labelPrefix}.${id}`;
				prepared[id] = tab;
				return prepared;
			}, {});
		}

		async _prepareContext() { return { tabs: this._prepareTabs("primary") }; }
		async _onFirstRender() {}
		_onRender() {}
		async _onDropItem(event, item) { return this.superDrop(event, item); }
		// Core expands the form's named inputs; the fake hands back the already-expanded object.
		_processFormData(event, form, data) { return data; }
	};
}

// Spy bag standing in for StonetopCharacter: the sheet must reduce every event to ONE call here.
function spyChar() {
	const fns = [
		"setHP", "setMaxHP", "setDamage", "setArmor", "setXP", "setLevel", "setDebility",
		"setRollMode", "applyPlaybookBySlug", "selectBackground", "selectCustomInstinct",
		"setChoiceTrackFor", "setChoicePickFor", "setChoiceTextFor", "setArcanumBlank",
		"setMoveChecked", "setMoveResourceText", "setInventoryItemCheckedFor",
		"setInventoryLoadLevel", "toggleInventoryRegularPool", "toggleInventorySmallPool",
		"setInventoryOtherItems", "setPossessionSelected", "setSubChoiceSelected",
		"selectSubChoiceExclusive", "setBio", "setNotes", "setFollowerName", "setFollowerHp",
		"setFollowerHpMax", "toggleFollowerTag", "toggleArcanumFlip", "toggleMoveResourcePip",
		"togglePossessionUsePip", "toggleInventoryResourcePipFor", "toggleArcanumResourcePip",
		"toggleBackgroundResourcePip", "toggleFollowerLoyaltyPip", "removeArcanum",
		"deletePossession", "removeFollower", "deleteMove", "removeCustomInventoryItemFor",
		"removeInsert", "addCustomFollower", "addFollowerMember", "removeFollowerMember",
		"addCustomInventoryItemFor", "applyDroppedItems", "addFollowerFromActor",
	];
	const char = Object.fromEntries(fns.map(f => [f, vi.fn(async () => {})]));
	char.origin = { select: vi.fn(), selectName: vi.fn() };
	char.setOpenFollowerInventories = vi.fn();
	char.buildSnapshot = vi.fn(async () => ({}));
	char.getArcanumBlanks = vi.fn(() => ({}));
	return char;
}

function makeSheet({ char = spyChar(), items = [] } = {}) {
	const actor = new FakeCharacterActorBuilder()
		.withItems(items)
		.withTypedActor(() => char)
		.build();
	const Sheet = createStonetopCharacterSheetClass(makeBase(actor));
	const sheet = new Sheet();
	return { sheet, char, actor };
}

// Mount markup into the sheet root and wire the (one-time) delegated router.
async function mount(sheet, html) {
	sheet.element.innerHTML = html;
	document.body.appendChild(sheet.element);
	await sheet._onFirstRender({}, {});
}

const change = el => el.dispatchEvent(new Event("change", { bubbles: true }));

// Invoke a data-action handler the way core does: handler.call(app, event, target).
function fireAction(sheet, name, target, ev = { type: "click", button: 0, preventDefault: vi.fn() }) {
	const def = sheet.constructor.DEFAULT_OPTIONS.actions[name];
	const handler = typeof def === "function" ? def : def.handler;
	return handler.call(sheet, ev, target);
}

function el(html) {
	const holder = document.createElement("div");
	holder.innerHTML = html;
	document.body.appendChild(holder);
	return holder.firstElementChild;
}

beforeEach(() => { document.body.innerHTML = ""; });

// -- Tabs -------------------------------------------------------------------------

describe("StonetopCharacterSheet tabs", () => {
	beforeEach(() => new FakeGameBuilder().build());

	it("prepares the six fixed tabs with the playbook active and localized labels", async () => {
		const { sheet } = makeSheet();
		const ctx = await sheet._prepareContext({});
		expect(Object.keys(ctx.tabs)).toEqual(["playbook", "moves", "inventory", "arcana", "followers", "notes"]);
		expect(ctx.tabs.playbook.active).toBe(true);
		expect(ctx.tabs.playbook.label).toBe("stonetop.sheet.tabs.playbook");
	});

	it("appends one tab per owned insert item via _getTabsConfig", async () => {
		const { sheet } = makeSheet({
			items: [{ _id: "i1", type: "insert", name: "The Crew", system: { slug: "the-crew" } }],
		});
		const ctx = await sheet._prepareContext({});
		expect(ctx.tabs["insert-the-crew"]).toMatchObject({ id: "insert-the-crew", label: "The Crew" });
		// insert tabs come after the fixed six
		expect(Object.keys(ctx.tabs).at(-1)).toBe("insert-the-crew");
	});
});

// -- _prepareContext integration (real StonetopCharacter) --------------------------

describe("StonetopCharacterSheet._prepareContext (integration)", () => {
	it("builds the snapshot and the playbook list through real domain code", async () => {
		new FakeGameBuilder().build();
		const actor = new FakeCharacterActorBuilder()
			.withName("Brakken")
			.withTypedActor(a => new StonetopCharacter(a, new FakeRepositoryFactory()))
			.build();
		const Sheet = createStonetopCharacterSheetClass(makeBase(actor));
		const sheet = new Sheet();

		const ctx = await sheet._prepareContext({});

		expect(ctx.stonetop.name).toBe("Brakken");
		expect(ctx.stonetop.vitals.hp.max).toBe(8);
		expect(Array.isArray(ctx.availablePlaybooks)).toBe(true);
		expect(ctx.editable).toBe(true);
		expect(ctx.actor).toBe(actor);
	});
});

// -- Change router ------------------------------------------------------------------

describe("StonetopCharacterSheet change routing", () => {
	it("routes vitals inputs to their setters", async () => {
		const { sheet, char } = makeSheet();
		await mount(sheet, `<input data-change-action="hp" value="7">`);
		change(sheet.element.querySelector("input"));
		expect(char.setHP).toHaveBeenCalledWith("7");
	});

	it("routes a debility checkbox with its slug", async () => {
		const { sheet, char } = makeSheet();
		await mount(sheet, `<input type="checkbox" data-change-action="debility" data-slug="weakened">`);
		const box = sheet.element.querySelector("input");
		box.checked = true;
		change(box);
		expect(char.setDebility).toHaveBeenCalledWith("weakened", true);
	});

	it("builds a real ChoiceTarget: a cg track inside a possession routes with the possession slug", async () => {
		const { sheet, char } = makeSheet();
		await mount(sheet, `
			<div data-possession-slug="lucky-charm">
				<input type="checkbox" data-change-action="cgTrack" class="stonetop-cg-track"
				       data-cg-group="g" data-cg-option="o" data-cg-index="1">
			</div>`);
		const box = sheet.element.querySelector("input");
		box.checked = true;
		change(box);
		expect(char.setChoiceTrackFor).toHaveBeenCalledTimes(1);
		const [target, index, checked] = char.setChoiceTrackFor.mock.calls[0];
		expect(target.possessionSlug).toBe("lucky-charm");
		expect(target.option).toBe("o");
		expect(index).toBe("1");
		expect(checked).toBe(true);
	});

	it("tagAdd blanks the box on the first change so the combobox's second change no-ops", async () => {
		const { sheet, char } = makeSheet();
		await mount(sheet, `
			<div class="stonetop-tags" data-slug="enfys" data-field="tagList">
				<input data-change-action="tagAdd" value=" sturdy ">
			</div>`);
		const input = sheet.element.querySelector("input");
		change(input);
		change(input); // Enter fires twice (native + synthetic); the second sees a blank box
		expect(char.toggleFollowerTag).toHaveBeenCalledTimes(1);
		expect(char.toggleFollowerTag).toHaveBeenCalledWith("enfys", "tagList", null, "sturdy");
		expect(input.value).toBe("");
	});

	it("follower HP passes the card's current max box for the clamp", async () => {
		const { sheet, char } = makeSheet();
		await mount(sheet, `
			<div class="stonetop-follower-card">
				<input class="hp" data-change-action="followerHp" data-slug="enfys" value="12">
				<input class="stonetop-follower-hp-max" value="10">
			</div>`);
		change(sheet.element.querySelector(".hp"));
		expect(char.setFollowerHp).toHaveBeenCalledWith("enfys", "12", "10");
	});

	it("ignores every change when the sheet is not editable", async () => {
		const { sheet, char } = makeSheet();
		sheet._editable = false;
		await mount(sheet, `<input data-change-action="hp" value="7">`);
		change(sheet.element.querySelector("input"));
		expect(char.setHP).not.toHaveBeenCalled();
	});
});

// -- Click actions --------------------------------------------------------------------

describe("StonetopCharacterSheet actions", () => {
	it("flipArcanum reads the current side off the dataset", async () => {
		const { sheet, char } = makeSheet();
		await fireAction(sheet, "flipArcanum", el(`<button data-slug="eye" data-flipped="true"></button>`));
		expect(char.toggleArcanumFlip).toHaveBeenCalledWith("eye", true);
	});

	it("moveResourcePip passes the pip's current checked state", async () => {
		const { sheet, char } = makeSheet();
		await fireAction(sheet, "moveResourcePip",
			el(`<button class="is-checked" data-move-slug="mystic" data-index="2"></button>`));
		expect(char.toggleMoveResourcePip).toHaveBeenCalledWith("mystic", "2", true);
	});

	it("inventoryResourcePip routes to the follower when inside its inventory wrapper", async () => {
		const { sheet, char } = makeSheet();
		const wrap = el(`
			<div class="stonetop-follower-inventory" data-slug="enfys">
				<button data-slug="rations" data-index="0"></button>
			</div>`);
		await fireAction(sheet, "inventoryResourcePip", wrap.querySelector("button"));
		expect(char.toggleInventoryResourcePipFor).toHaveBeenCalledWith("enfys", "rations", "0", false);
	});

	it("selectOriginName sends the trimmed name", async () => {
		const { sheet, char } = makeSheet();
		await fireAction(sheet, "selectOriginName", el(`<span>  Arwel  </span>`));
		expect(char.origin.selectName).toHaveBeenCalledWith("Arwel");
	});

	it("toggleTop flips the collapse class on the wrapper", async () => {
		const { sheet } = makeSheet();
		const wrap = el(`<div class="sheet-wrapper"><button></button></div>`);
		await fireAction(sheet, "toggleTop", wrap.querySelector("button"));
		expect(wrap.classList.contains("top-collapsed")).toBe(true);
	});

	it("toggleFollowerInventory tracks the open set and re-renders", async () => {
		const { sheet } = makeSheet();
		const btn = el(`<button data-slug="enfys"></button>`);
		await fireAction(sheet, "toggleFollowerInventory", btn);
		expect(sheet._openFollowerInventories.has("enfys")).toBe(true);
		await fireAction(sheet, "toggleFollowerInventory", btn);
		expect(sheet._openFollowerInventories.has("enfys")).toBe(false);
		expect(sheet.render).toHaveBeenCalledTimes(2);
	});

	it("mutating actions are blocked on a non-editable sheet", async () => {
		const { sheet, char } = makeSheet();
		sheet._editable = false;
		await fireAction(sheet, "flipArcanum", el(`<button data-slug="eye" data-flipped="false"></button>`));
		await fireAction(sheet, "addFollower", el(`<button></button>`));
		expect(char.toggleArcanumFlip).not.toHaveBeenCalled();
		expect(char.addCustomFollower).not.toHaveBeenCalled();
	});
});

// -- Deletes (click confirms, right-click skips) -----------------------------------------

describe("StonetopCharacterSheet delete actions", () => {
	afterEach(() => vi.unstubAllGlobals());

	function stubConfirm(result) {
		const confirm = vi.fn(async () => result);
		vi.stubGlobal("foundry", {
			...globalThis.foundry,
			applications: {
				...globalThis.foundry?.applications,
				api: { DialogV2: { confirm } },
			},
		});
		vi.stubGlobal("game", { i18n: { localize: k => k, format: k => k } });
		return confirm;
	}

	const rightClick = () => ({ type: "contextmenu", button: 2, preventDefault: vi.fn() });

	// action name, target markup, spied domain method, expected args
	const cases = [
		["deleteArcanum", `<button data-slug="eye" data-name="The Eye"></button>`, "removeArcanum", ["eye"]],
		["deletePossession", `<a data-slug="map" data-name="Map"></a>`, "deletePossession", ["map"]],
		["deleteFollower", `<button data-slug="astor" data-name="Astor"></button>`, "removeFollower", ["astor"]],
		["deleteOtherMove", `<a data-move-slug="cleave" data-name="Cleave"></a>`, "deleteMove", ["cleave"]],
		["deleteInventoryItem", `<a data-owned-id="x1" data-name="Rope"></a>`, "removeCustomInventoryItemFor", [null, "x1"]],
	];

	for (const [action, markup, method, args] of cases) {
		it(`${action} deletes when confirmed`, async () => {
			stubConfirm(true);
			const { sheet, char } = makeSheet();
			await fireAction(sheet, action, el(markup));
			expect(char[method]).toHaveBeenCalledWith(...args);
		});

		it(`${action} does nothing when cancelled`, async () => {
			stubConfirm(false);
			const { sheet, char } = makeSheet();
			await fireAction(sheet, action, el(markup));
			expect(char[method]).not.toHaveBeenCalled();
		});

		it(`${action} skips the confirm on right-click`, async () => {
			const confirm = stubConfirm(false);
			const { sheet, char } = makeSheet();
			await fireAction(sheet, action, el(markup), rightClick());
			expect(confirm).not.toHaveBeenCalled();
			expect(char[method]).toHaveBeenCalledWith(...args);
		});

		it(`${action} is registered for both mouse buttons`, () => {
			const { sheet } = makeSheet();
			expect(sheet.constructor.DEFAULT_OPTIONS.actions[action].buttons).toEqual([0, 2]);
		});
	}
});

// -- Drops ------------------------------------------------------------------------------

describe("StonetopCharacterSheet drops", () => {
	it("routes a foreign item through applyDroppedItems", async () => {
		const { sheet, char } = makeSheet();
		const item = { parent: { uuid: "Actor.other" }, toObject: () => ({ type: "outfitItem", name: "Rope" }) };
		const result = await sheet._onDropItem({}, item);
		expect(char.applyDroppedItems).toHaveBeenCalledWith([{ type: "outfitItem", name: "Rope" }]);
		expect(result).toBeNull();
	});

	it("lets core sort a same-sheet drop", async () => {
		const { sheet, char, actor } = makeSheet();
		const item = { parent: { uuid: actor.uuid }, toObject: () => ({}) };
		const result = await sheet._onDropItem({}, item);
		expect(result).toBe("super-drop");
		expect(char.applyDroppedItems).not.toHaveBeenCalled();
	});

	it("ignores drops when not editable", async () => {
		const { sheet, char } = makeSheet();
		sheet._editable = false;
		await sheet._onDropItem({}, { parent: null, toObject: () => ({}) });
		expect(char.applyDroppedItems).not.toHaveBeenCalled();
	});

	it("a dropped NPC becomes a follower; other actor types are ignored", async () => {
		const { sheet, char } = makeSheet();
		const npc = { type: "npc" };
		await sheet._onDropActor({}, npc);
		expect(char.addFollowerFromActor).toHaveBeenCalledWith(npc);
		await sheet._onDropActor({}, { type: "character" });
		expect(char.addFollowerFromActor).toHaveBeenCalledTimes(1);
	});
});

// -- Add-inventory dialog ------------------------------------------------------------------

describe("StonetopCharacterSheet add-inventory dialog", () => {
	afterEach(() => vi.unstubAllGlobals());

	function stubPrompt(result) {
		const prompt = vi.fn(async () => result);
		vi.stubGlobal("foundry", {
			...globalThis.foundry,
			applications: {
				...globalThis.foundry?.applications,
				api: { DialogV2: { prompt } },
				handlebars: { renderTemplate: vi.fn(async () => "<div></div>") },
			},
		});
		vi.stubGlobal("game", { i18n: { localize: k => k, format: k => k } });
		return prompt;
	}

	it("adds a regular item with its weight", async () => {
		stubPrompt({ name: "Rope", weight: 2 });
		const { sheet, char } = makeSheet();
		await fireAction(sheet, "addInventoryItem", el(`<button data-column="regular"></button>`));
		expect(char.addCustomInventoryItemFor).toHaveBeenCalledWith(null, "Rope", 2, true);
	});

	it("routes to the follower inventory when opened from its wrapper", async () => {
		stubPrompt({ name: "Rope", weight: 1 });
		const { sheet, char } = makeSheet();
		const wrap = el(`
			<div class="stonetop-follower-inventory" data-slug="enfys">
				<button data-column="regular"></button>
			</div>`);
		await fireAction(sheet, "addInventoryItem", wrap.querySelector("button"));
		expect(char.addCustomInventoryItemFor).toHaveBeenCalledWith("enfys", "Rope", 1, true);
	});

	it("does nothing when the dialog is dismissed or the name is blank", async () => {
		stubPrompt(null);
		const { sheet, char } = makeSheet();
		await fireAction(sheet, "addInventoryItem", el(`<button data-column="small"></button>`));
		expect(char.addCustomInventoryItemFor).not.toHaveBeenCalled();
	});
});

// -- Form-submit filtering -----------------------------------------------------------------

describe("StonetopCharacterSheet._processFormData", () => {
	it("keeps only name/img/system, dropping the router-managed radio-group fields", () => {
		const { sheet } = makeSheet();
		const expanded = {
			name: "Brakken",
			system: { stats: { str: { value: 2 } } },
			"stonetop-roll-mode": "adv",
			"stonetop-background": "vessel",
			"stonetop-load-level": "light",
			"stonetop-origin": "the-hills",
		};
		expect(sheet._processFormData(null, null, expanded)).toEqual({
			name: "Brakken",
			system: { stats: { str: { value: 2 } } },
		});
	});

	it("omits keys that are absent rather than emitting undefined", () => {
		const { sheet } = makeSheet();
		expect(sheet._processFormData(null, null, { "stonetop-roll-mode": "dis" })).toEqual({});
	});
});

// -- Arcanum blank fill pass ---------------------------------------------------------------

describe("StonetopCharacterSheet arcanum blanks", () => {
	it("seeds blank inputs from storage on every render", async () => {
		const { sheet, char } = makeSheet();
		char.getArcanumBlanks = vi.fn(() => ({ "storm-die": "d8" }));
		sheet.element.innerHTML = `
			<div class="stonetop-arcanum-card" data-slug="azure-hand">
				<input class="stonetop-arcanum-blank" data-blank-key="storm-die">
				<input class="stonetop-arcanum-blank" data-blank-key="other">
			</div>`;
		sheet._onRender({}, {});
		const [seeded, empty] = sheet.element.querySelectorAll("input");
		expect(seeded.value).toBe("d8");
		expect(empty.value).toBe("");
	});
});
