import { describe, it, expect, vi } from "vitest";
import { createStonetopMonsterSheetClass } from "../../../module/actors/monster/StonetopMonsterSheet.js";

function makeItems(items) {
	return {
		filter: callback => items.filter(callback),
		get: id => items.find(item => item.id === id),
	};
}

function makeSheet(actor, { editable = true } = {}) {
	const Base = class {
		constructor() { this._actor = actor; }
		get actor() { return this._actor; }
		get isEditable() { return editable; }
		async getData() { return {}; }
		activateListeners() {}
	};
	const Sheet = createStonetopMonsterSheetClass(Base);
	return new Sheet();
}

describe("StonetopMonsterSheet", () => {
	it("returns only monster moves in sheet data", async () => {
		const actor = {
			system: { concept: "tree-dwelling menace" },
			items: makeItems([
				{ id: "move1", type: "monsterMove", name: "Snatch", system: { rollFormula: "1d6" } },
				{ id: "npc1", type: "npcMove", name: "Ignore me", system: {} },
			]),
		};

		const data = await makeSheet(actor).getData();

		expect(data.system).toBe(actor.system);
		expect(data.monsterMoves).toEqual([
			{
				id: "move1", name: "Snatch", system: { rollFormula: "1d6" },
				armorBoost: null, boostActive: false, showBoostIcon: false, boostTooltip: null,
			},
		]);
	});

	it("preserves the book's move order (does not sort)", async () => {
		const actor = {
			system: {},
			items: makeItems([
				{ id: "c", type: "monsterMove", name: "Claw", system: {} },
				{ id: "z", type: "monsterMove", name: "Zap", system: { rollFormula: "1d8" } },
				{ id: "a", type: "monsterMove", name: "Ambush", system: {} },
				{ id: "b", type: "monsterMove", name: "Bite", system: { rollFormula: "1d6" } },
			]),
		};

		const data = await makeSheet(actor).getData();

		expect(data.monsterMoves.map(move => move.name)).toEqual([
			"Claw",
			"Zap",
			"Ambush",
			"Bite",
		]);
	});

	it("filters organization and size out of readonly display tags", async () => {
		const actor = {
			system: {
				organization: "Horde",
				size: "small",
				tags: "horde, small, cautious, stealthy",
			},
			items: makeItems([]),
		};

		const data = await makeSheet(actor).getData();

		expect(data.stonetop.displayTags).toBe("cautious, stealthy");
	});

	it("derives the organization label for the header chip", async () => {
		const actor = {
			system: { organization: "horde" },
			items: makeItems([]),
		};

		const data = await makeSheet(actor).getData();

		expect(data.stonetop.organizationLabel).toBe("stonetop.monster.organizationHorde");
	});

	it("wraps recognised display tags with tooltips and resolves org/size tips", async () => {
		const actor = {
			system: { organization: "horde", size: "small", tags: "horde, small, cautious, grumpy" },
			items: makeItems([]),
		};

		const data = await makeSheet(actor).getData();
		const st = data.stonetop;

		// Known tag gets a tooltip span; the one-off flavor tag stays plain text.
		expect(st.displayTagsHtml).toContain('<span class="stonetop-monster-tag" data-tooltip=');
		expect(st.displayTagsHtml).toMatch(/>cautious<\/span>/);
		expect(st.displayTagsHtml).not.toMatch(/<span[^>]*>grumpy/);
		expect(st.displayTagsHtml).toContain("grumpy");
		// Organization and size resolve their own tooltips.
		expect(st.organizationTooltip).toMatch(/large groups of 6/);
		expect(st.sizeTooltip).toMatch(/human child/);
	});

	it("renders plain escaped tags and no tooltips when hover info is off", async () => {
		const originalGame = globalThis.game;
		globalThis.game = { ...originalGame, settings: { get: () => false } };
		try {
			const actor = {
				system: { organization: "horde", size: "small", tags: "cautious" },
				items: makeItems([]),
			};

			const data = await makeSheet(actor).getData();

			expect(data.stonetop.displayTagsHtml).toBe("cautious");
			expect(data.stonetop.organizationTooltip).toBeNull();
			expect(data.stonetop.sizeTooltip).toBeNull();
		} finally {
			globalThis.game = originalGame;
		}
	});

	it("keeps a single damage mode whose descriptor has commas as one mode", async () => {
		const actor = {
			system: {
				attributes: { damage: { value: "claws, bite, hug d10+4 (hand, close, messy, 1 piercing)" } },
			},
			items: makeItems([]),
		};

		const data = await makeSheet(actor).getData();

		expect(data.stonetop.damageModes).toEqual([
			{ text: "claws, bite, hug d10+4 (hand, close, messy, 1 piercing)", formula: "d10+4", rollMode: "" },
		]);
		expect(data.stonetop.multiDamage).toBe(false);
	});

	it("splits multiple damage modes, each carrying its own die", async () => {
		const actor = {
			system: {
				attributes: { damage: { value: "fingers d8 (close), maw d10+2 (hand, messy)" } },
			},
			items: makeItems([]),
		};

		const data = await makeSheet(actor).getData();

		expect(data.stonetop.damageModes).toEqual([
			{ text: "fingers d8 (close)", formula: "d8", rollMode: "" },
			{ text: "maw d10+2 (hand, messy)", formula: "d10+2", rollMode: "" },
		]);
		expect(data.stonetop.multiDamage).toBe(true);
	});

	it("flags a damage mode that notes disadvantage on its die", async () => {
		const actor = {
			system: {
				attributes: { damage: { value: "icy touch d6 w/disadvantage (hand, ignores armor)" } },
			},
			items: makeItems([]),
		};

		const data = await makeSheet(actor).getData();

		expect(data.stonetop.damageModes).toEqual([
			{ text: "icy touch d6 w/disadvantage (hand, ignores armor)", formula: "d6", rollMode: "dis" },
		]);
	});

	it("enriches the qualities rich-text field for display", async () => {
		const originalFoundry = globalThis.foundry;
		globalThis.foundry = {
			utils: originalFoundry.utils,   // getData also escapes codex text
			applications: {
				ux: {
					TextEditor: {
						enrichHTML: vi.fn(async value => `<p>${value}</p>`),
					},
				},
			},
		};
		const actor = {
			system: { qualities: "Climbs like a squirrel" },
			items: makeItems([]),
		};

		try {
			const data = await makeSheet(actor).getData();
			expect(data.stonetop.enrichedQualities).toBe("<p>Climbs like a squirrel</p>");
		} finally {
			globalThis.foundry = originalFoundry;
		}
	});

	it("flags hasQualities only when the field holds real content", async () => {
		const withText = await makeSheet({
			system: { qualities: "<p>Climbs like a squirrel</p>" },
			items: makeItems([]),
		}).getData();
		expect(withText.stonetop.hasQualities).toBe(true);

		for (const empty of ["", "<p></p>", "<p><br></p>", "<p>&nbsp;</p>"]) {
			const data = await makeSheet({
				system: { qualities: empty },
				items: makeItems([]),
			}).getData();
			expect(data.stonetop.hasQualities, `qualities=${JSON.stringify(empty)}`).toBe(false);
		}
	});

	it("falls back to the creature-type icon as the portrait when there is no custom art", async () => {
		const actor = {
			img: "icons/svg/mystery-man.svg",   // default placeholder, not real art
			system: { creatureType: "natural-beast" },
			items: makeItems([]),
		};

		const data = await makeSheet(actor).getData();

		expect(data.stonetop.creatureTypeLabel).toBe("Natural / Beast");
		expect(data.stonetop.hasPortrait).toBe(true);
		expect(data.stonetop.displayImg).toBe(
			"systems/stonetop/assets/icons/bestiary/natural-beast.svg");
	});

	it("prefers real portrait art over the creature-type icon", async () => {
		const actor = {
			img: "worlds/test/crinwin-art.webp",
			system: { creatureType: "natural-beast" },
			items: makeItems([]),
		};

		const data = await makeSheet(actor).getData();

		expect(data.stonetop.displayImg).toBe("worlds/test/crinwin-art.webp");
	});

	it("has no portrait when there is neither art nor a creature type", async () => {
		const actor = {
			img: "icons/svg/mystery-man.svg",
			system: {},
			items: makeItems([]),
		};

		const data = await makeSheet(actor).getData();

		expect(data.stonetop.hasPortrait).toBe(false);
		expect(data.stonetop.displayImg).toBeNull();
	});

	it("creates monsterMove items from the add move control", async () => {
		const actor = {
			system: {},
			items: makeItems([]),
			createEmbeddedDocuments: vi.fn(),
		};
		const sheet = makeSheet(actor);
		sheet._editMode = true;
		let clickHandler;
		const root = {
			addEventListener: (eventName, handler) => {
				if (eventName === "click") clickHandler = handler;
			},
			querySelector: () => null,
		};
		const target = {
			closest: selector => selector === ".stonetop-monster-add-move" ? target : null,
		};

		sheet.activateListeners([root]);
		await clickHandler({ target });

		expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [{
			name: "New Move",
			type: "monsterMove",
		}]);
	});

	it("does not create monsterMove items when edit mode is off", async () => {
		const actor = {
			system: {},
			items: makeItems([]),
			createEmbeddedDocuments: vi.fn(),
		};
		const sheet = makeSheet(actor);
		let clickHandler;
		const root = {
			addEventListener: (eventName, handler) => {
				if (eventName === "click") clickHandler = handler;
			},
			querySelector: () => null,
		};
		const target = {
			closest: selector => selector === ".stonetop-monster-add-move" ? target : null,
		};

		sheet.activateListeners([root]);
		await clickHandler({ target });

		expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it("resets HP and damage die to the organization defaults", async () => {
		const actor = {
			system: { organization: "solitary", attributes: {} },
			items: makeItems([]),
			update: vi.fn(),
		};
		const sheet = makeSheet(actor);

		await sheet._resetOrganizationDefaults();

		expect(actor.update).toHaveBeenCalledWith({
			"system.attributes.hp.value":           12,
			"system.attributes.hp.max":             12,
			"system.attributes.damage.rollFormula": "d10",
		});
	});

	it("ignores reset when the organization is unset", async () => {
		const actor = {
			system: { organization: "" },
			items: makeItems([]),
			update: vi.fn(),
		};
		const sheet = makeSheet(actor);

		await sheet._resetOrganizationDefaults();

		expect(actor.update).not.toHaveBeenCalled();
	});

	it("updates the qualities rich-text field", async () => {
		const actor = {
			system: {},
			items: makeItems([]),
			update: vi.fn(),
		};
		const sheet = makeSheet(actor);

		await sheet._updateRichTextField("qualities", "<p>Formatted</p>");

		expect(actor.update).toHaveBeenCalledWith({
			"system.qualities": "<p>Formatted</p>",
		});
	});

	it("refuses to update fields that are not rich-text fields", async () => {
		const actor = {
			system: {},
			items: makeItems([]),
			update: vi.fn(),
		};
		const sheet = makeSheet(actor);

		await sheet._updateRichTextField("concept", "<p>nope</p>");

		expect(actor.update).not.toHaveBeenCalled();
	});

	it("updates notes as a rich-text field (editable outside edit mode)", async () => {
		const actor = {
			system: {},
			items: makeItems([]),
			update: vi.fn(),
		};
		const sheet = makeSheet(actor);

		await sheet._updateRichTextField("notes", "<p>Spotted near the river.</p>");

		expect(actor.update).toHaveBeenCalledWith({
			"system.notes": "<p>Spotted near the river.</p>",
		});
	});

	it("keeps the window title element as a header spacer", () => {
		const title = { removed: false, remove() { this.removed = true; } };
		const idLink = { removed: false, remove() { this.removed = true; } };
		const header = {
			querySelector: selector => selector === ".window-title" ? title : null,
			querySelectorAll: selector => selector === ".document-id-link" ? [idLink] : [],
		};
		const sheet = makeSheet({
			system: {},
			items: makeItems([]),
		});
		sheet.element = [{
			querySelector: selector => selector === ".window-header" ? header : null,
		}];

		sheet._stripHeaderChrome();

		expect(idLink.removed).toBe(true);
		expect(title.removed).toBe(false);
	});

	// --- Armor-boost moves -------------------------------------------------

	it("tags armor-boost moves and reports no active boost when none is set", async () => {
		const actor = {
			system: { attributes: { armor: { value: 3 } } },
			flags: {},
			items: makeItems([
				{ id: "b1", type: "monsterMove", name: "Withdraw into its shell (Armor 5)", system: {} },
			]),
		};

		const data = await makeSheet(actor).getData();

		expect(data.monsterMoves[0].armorBoost).toBe(5);
		expect(data.monsterMoves[0].boostActive).toBe(false);
		expect(data.monsterMoves[0].boostTooltip).toBe("Click to set Armor to 5");
		expect(data.stonetop.armorBoost).toBeNull();
	});

	it("marks the active armor-boost move and exposes the header indicator", async () => {
		const actor = {
			system: { attributes: { armor: { value: 5 } } },
			flags: { stonetop: { armorBoost: { moveId: "b1", value: 5, baseValue: 3, label: "Withdraw into its shell" } } },
			items: makeItems([
				{ id: "b1", type: "monsterMove", name: "Withdraw into its shell (Armor 5)", system: {} },
				{ id: "n1", type: "monsterMove", name: "Burrow into soil", system: {} },
			]),
		};

		const data = await makeSheet(actor).getData();
		const [boostMove, plainMove] = data.monsterMoves;

		expect(boostMove.boostActive).toBe(true);
		expect(boostMove.boostTooltip).toBe("Click to revert Armor to normal");
		expect(plainMove.armorBoost).toBeNull();
		expect(plainMove.boostActive).toBe(false);
		expect(data.stonetop.armorBoost).toMatchObject({
			value: 5, baseValue: 3, label: "Withdraw into its shell",
		});
	});

	it("ignores a boost flag whose move no longer exists", async () => {
		const actor = {
			system: { attributes: { armor: { value: 5 } } },
			flags: { stonetop: { armorBoost: { moveId: "gone", value: 5, baseValue: 3, label: "X" } } },
			items: makeItems([
				{ id: "b1", type: "monsterMove", name: "Burrow into soil", system: {} },
			]),
		};

		const data = await makeSheet(actor).getData();

		expect(data.stonetop.armorBoost).toBeNull();
		expect(data.monsterMoves[0].boostActive).toBe(false);
	});

	it("toggles an armor boost on, recording the pre-boost armor as the base", async () => {
		const actor = {
			system: { attributes: { armor: { value: 3 } } },
			flags: {},
			items: makeItems([]),
			update: vi.fn(),
		};
		const sheet = makeSheet(actor);

		await sheet._toggleArmorBoost({ id: "m1", name: "Withdraw into its shell (Armor 5)" }, 5);

		expect(actor.update).toHaveBeenCalledWith({
			"system.attributes.armor.value": 5,
			"flags.stonetop.armorBoost": {
				moveId: "m1", value: 5, baseValue: 3, label: "Withdraw into its shell",
			},
		});
	});

	it("toggles the active armor boost off, restoring the base armor", async () => {
		const actor = {
			system: { attributes: { armor: { value: 5 } } },
			flags: { stonetop: { armorBoost: { moveId: "m1", value: 5, baseValue: 3, label: "Withdraw into its shell" } } },
			items: makeItems([]),
			update: vi.fn(),
		};
		const sheet = makeSheet(actor);

		await sheet._toggleArmorBoost({ id: "m1", name: "Withdraw into its shell (Armor 5)" }, 5);

		// The flag delete goes through deletionEntry; on v13+ (ForcedDeletion present
		// in the test env) that's the sentinel on the unchanged key path.
		expect(actor.update).toHaveBeenCalledWith({
			"system.attributes.armor.value": 3,
			"flags.stonetop.armorBoost": Symbol.for("ForcedDeletion"),
		});
	});

	it("switching to a different boost move keeps the original base armor", async () => {
		const actor = {
			system: { attributes: { armor: { value: 5 } } }, // already boosted by m1
			flags: { stonetop: { armorBoost: { moveId: "m1", value: 5, baseValue: 3, label: "Shell" } } },
			items: makeItems([]),
			update: vi.fn(),
		};
		const sheet = makeSheet(actor);

		await sheet._toggleArmorBoost({ id: "m2", name: "Hunker down (Armor 6)" }, 6);

		expect(actor.update).toHaveBeenCalledWith({
			"system.attributes.armor.value": 6,
			"flags.stonetop.armorBoost": {
				moveId: "m2", value: 6, baseValue: 3, label: "Hunker down",
			},
		});
	});

	it("clicking an armor-boost move name toggles the boost instead of rolling", async () => {
		const boostItem = { id: "b1", name: "Withdraw into its shell (Armor 5)", roll: vi.fn() };
		const actor = {
			system: { attributes: { armor: { value: 3 } } },
			flags: {},
			items: makeItems([boostItem]),
		};
		const sheet = makeSheet(actor);
		sheet._toggleArmorBoost = vi.fn();

		const handlers = [];
		const root = {
			addEventListener: (name, handler) => { if (name === "click") handlers.push(handler); },
			querySelector: () => null,
		};
		sheet.activateListeners([root]);

		const target = {
			closest: selector => selector === ".stonetop-monster-move-name" ? target
				: selector === "[data-item-id]" ? { dataset: { itemId: "b1" } } : null,
		};
		await handlers[0]({ target });

		expect(sheet._toggleArmorBoost).toHaveBeenCalledWith(boostItem, 5);
		expect(boostItem.roll).not.toHaveBeenCalled();
	});

	it("announces an applied armor boost in chat (base → boosted)", async () => {
		const created = [];
		const originalChat = globalThis.ChatMessage;
		globalThis.ChatMessage = { create: msg => created.push(msg), getSpeaker: () => ({ alias: "Shellback Drake" }) };
		try {
			const actor = {
				name: "Shellback Drake",
				system: { attributes: { armor: { value: 3 } } },
				flags: {},
				items: makeItems([]),
				update: vi.fn(),
			};
			await makeSheet(actor)._toggleArmorBoost({ id: "m1", name: "Withdraw into its shell (Armor 5)" }, 5);

			expect(created).toHaveLength(1);
			expect(created[0].content).toContain("Withdraw into its shell");
			expect(created[0].content).toMatch(/3 &rarr; 5/);
			expect(created[0].content).not.toContain("reverted");
		} finally {
			globalThis.ChatMessage = originalChat;
		}
	});

	it("announces reverting an armor boost in chat (boosted → base)", async () => {
		const created = [];
		const originalChat = globalThis.ChatMessage;
		globalThis.ChatMessage = { create: msg => created.push(msg), getSpeaker: () => ({}) };
		try {
			const actor = {
				name: "Shellback Drake",
				system: { attributes: { armor: { value: 5 } } },
				flags: { stonetop: { armorBoost: { moveId: "m1", value: 5, baseValue: 3, label: "Withdraw into its shell" } } },
				items: makeItems([]),
				update: vi.fn(),
			};
			await makeSheet(actor)._toggleArmorBoost({ id: "m1", name: "Withdraw into its shell (Armor 5)" }, 5);

			expect(created[0].content).toMatch(/5 &rarr; 3/);
			expect(created[0].content).toContain("reverted");
		} finally {
			globalThis.ChatMessage = originalChat;
		}
	});

	it("clicking a non-boost move name posts it to chat (rolls)", async () => {
		const plainItem = { id: "n1", name: "Burrow into soil", roll: vi.fn() };
		const actor = { system: {}, flags: {}, items: makeItems([plainItem]) };
		const sheet = makeSheet(actor);

		const handlers = [];
		const root = {
			addEventListener: (name, handler) => { if (name === "click") handlers.push(handler); },
			querySelector: () => null,
		};
		sheet.activateListeners([root]);

		const target = {
			closest: selector => selector === ".stonetop-monster-move-name" ? target
				: selector === "[data-item-id]" ? { dataset: { itemId: "n1" } } : null,
		};
		await handlers[0]({ target });

		expect(plainItem.roll).toHaveBeenCalled();
	});

	it("deleting the active boost move reverts its armor before removing it", async () => {
		const boostItem = { id: "b1", name: "Withdraw into its shell (Armor 5)", delete: vi.fn() };
		const actor = {
			system: { attributes: { armor: { value: 5 } } }, // currently boosted
			flags: { stonetop: { armorBoost: { moveId: "b1", value: 5, baseValue: 3, label: "Withdraw into its shell" } } },
			items: makeItems([boostItem]),
			update: vi.fn(),
		};
		const sheet = makeSheet(actor);
		sheet._editMode = true;

		const originalDialog = globalThis.Dialog;
		globalThis.Dialog = { confirm: vi.fn().mockResolvedValue(true) };
		try {
			const handlers = [];
			const root = {
				addEventListener: (name, handler) => { if (name === "click") handlers.push(handler); },
				querySelector: () => null,
			};
			sheet.activateListeners([root]);

			// The add/delete/edit handler is the second click listener (registered after isEditable).
			const target = {
				closest: selector => selector === ".stonetop-monster-delete-move" ? target
					: selector === "[data-item-id]" ? { dataset: { itemId: "b1" } } : null,
			};
			await handlers[1]({ target });

			expect(actor.update).toHaveBeenCalledWith({
				"system.attributes.armor.value": 3,
				"flags.stonetop.armorBoost": Symbol.for("ForcedDeletion"),
			});
			expect(boostItem.delete).toHaveBeenCalled();
		} finally {
			globalThis.Dialog = originalDialog;
		}
	});

	it("deleting a non-boost move leaves an active boost untouched", async () => {
		const plainItem = { id: "n1", name: "Burrow into soil", delete: vi.fn() };
		const actor = {
			system: { attributes: { armor: { value: 5 } } },
			flags: { stonetop: { armorBoost: { moveId: "b1", value: 5, baseValue: 3, label: "Shell" } } },
			items: makeItems([plainItem]),
			update: vi.fn(),
		};
		const sheet = makeSheet(actor);
		sheet._editMode = true;

		const originalDialog = globalThis.Dialog;
		globalThis.Dialog = { confirm: vi.fn().mockResolvedValue(true) };
		try {
			const handlers = [];
			const root = {
				addEventListener: (name, handler) => { if (name === "click") handlers.push(handler); },
				querySelector: () => null,
			};
			sheet.activateListeners([root]);

			const target = {
				closest: selector => selector === ".stonetop-monster-delete-move" ? target
					: selector === "[data-item-id]" ? { dataset: { itemId: "n1" } } : null,
			};
			await handlers[1]({ target });

			expect(actor.update).not.toHaveBeenCalled();
			expect(plainItem.delete).toHaveBeenCalled();
		} finally {
			globalThis.Dialog = originalDialog;
		}
	});

	it("hides the boost affordance on a read-only sheet (can't write the actor)", async () => {
		const actor = {
			system: { attributes: { armor: { value: 5 } } },
			flags: { stonetop: { armorBoost: { moveId: "b1", value: 5, baseValue: 3, label: "Shell" } } },
			items: makeItems([
				{ id: "b1", type: "monsterMove", name: "Withdraw into its shell (Armor 5)", system: {} },
			]),
		};

		const data = await makeSheet(actor, { editable: false }).getData();

		expect(data.stonetop.armorBoost).toBeNull();
		expect(data.monsterMoves[0].armorBoost).toBe(5);   // still parsed…
		expect(data.monsterMoves[0].showBoostIcon).toBe(false); // …but no toggle affordance
		expect(data.monsterMoves[0].boostActive).toBe(false);
		expect(data.monsterMoves[0].boostTooltip).toBeNull();
	});

	it("keeps an active boost revertable after its move is renamed to drop '(Armor N)'", async () => {
		const actor = {
			system: { attributes: { armor: { value: 5 } } },
			flags: { stonetop: { armorBoost: { moveId: "b1", value: 5, baseValue: 3, label: "Shell" } } },
			items: makeItems([
				// Name no longer parses as a boost, but the flag still points at it.
				{ id: "b1", type: "monsterMove", name: "Withdraw into its shell", system: {} },
			]),
		};

		const data = await makeSheet(actor).getData();
		const move = data.monsterMoves[0];

		expect(move.armorBoost).toBeNull();        // name no longer advertises a value
		expect(move.boostActive).toBe(true);       // …but it is still the live boost
		expect(move.showBoostIcon).toBe(true);     // so it keeps a shield + revert hint
		expect(move.boostTooltip).toBe("Click to revert Armor to normal");
		// Header label tracks the move's current (renamed) name, not the stale flag.
		expect(data.stonetop.armorBoost.label).toBe("Withdraw into its shell");
	});

	it("clicking the renamed active boost move reverts it instead of rolling", async () => {
		const boostItem = { id: "b1", name: "Withdraw into its shell", roll: vi.fn() };
		const actor = {
			system: { attributes: { armor: { value: 5 } } },
			flags: { stonetop: { armorBoost: { moveId: "b1", value: 5, baseValue: 3, label: "Shell" } } },
			items: makeItems([boostItem]),
		};
		const sheet = makeSheet(actor);
		sheet._toggleArmorBoost = vi.fn();

		const handlers = [];
		const root = {
			addEventListener: (name, handler) => { if (name === "click") handlers.push(handler); },
			querySelector: () => null,
		};
		sheet.activateListeners([root]);

		const target = {
			closest: selector => selector === ".stonetop-monster-move-name" ? target
				: selector === "[data-item-id]" ? { dataset: { itemId: "b1" } } : null,
		};
		await handlers[0]({ target });

		expect(sheet._toggleArmorBoost).toHaveBeenCalledWith(boostItem, null);
		expect(boostItem.roll).not.toHaveBeenCalled();
	});

	it("reports the current armor (not the original base) when switching boost moves", async () => {
		const created = [];
		const originalChat = globalThis.ChatMessage;
		globalThis.ChatMessage = { create: msg => created.push(msg), getSpeaker: () => ({}) };
		try {
			const actor = {
				system: { attributes: { armor: { value: 5 } } }, // already boosted to 5 by m1
				flags: { stonetop: { armorBoost: { moveId: "m1", value: 5, baseValue: 3, label: "Shell" } } },
				items: makeItems([]),
				update: vi.fn(),
			};
			await makeSheet(actor)._toggleArmorBoost({ id: "m2", name: "Hunker down (Armor 6)" }, 6);

			expect(created[0].content).toMatch(/5 &rarr; 6/); // current 5 → new 6, not 3 → 6
		} finally {
			globalThis.ChatMessage = originalChat;
		}
	});

});
