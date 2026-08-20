import { FoundryMoveRepository } from "./repositories/FoundryMoveRepository.js";
import { ChangeActionRouter } from "../../utils/ChangeActionRouter.js";
import { ChoiceGroupWiring } from "../../utils/ChoiceGroupWiring.js";
import { editOnly } from "../../utils/sheetActions.js";
import { ScrollAnchoring } from "../../utils/ScrollAnchoring.js";
import { TabViewFlags } from "../../utils/TabViewFlags.js";
import { AddInventoryItemDialog } from "./AddInventoryItemDialog.js";
import { InventoryOwner } from "./InventoryOwner.js";
import { itemsOfType } from "../actorItems.js";
import { characterChangeHandlers } from "./characterChangeHandlers.js";
import { PIP_ACTIONS, DELETE_ACTIONS, OUTFIT_ACTIONS } from "./characterSheetActions.js";
import { MOVE_ROW_ACTIONS, moveRowChangeHandlers } from "../moveRowHandlers.js";
import { TAG_CHIP_ACTIONS, tagChipChangeHandlers } from "../tagChips.js";

export function createStonetopCharacterSheetClass(Base) {
	return class StonetopCharacterSheet extends Base {
		_moveRepository = new FoundryMoveRepository();
		_addInventoryItemDialog = new AddInventoryItemDialog();
		// Which follower inventory catalogs are expanded — sheet-instance state that survives
		// re-render, so only the open follower renders the (large) outfit catalog.
		_openFollowerInventories = new Set();
		// Every view-state toggle on the sheet: the moves tab's "selected only" filter, the playbook
		// lock, one lock per insert tab. Held here because the controls they decorate are re-rendered
		// constantly — ticking a move would otherwise drop the filter mid-review.
		_viewFlags = new TabViewFlags(["hideUnselectedMoves", "playbookLocked"]);
		_scrollAnchoring = new ScrollAnchoring();

		get _stonetopCharacter() {
			return this.typedActor;
		}

		static DEFAULT_OPTIONS = {
			// The base supplies `stonetop sheet actor themed theme-light`.
			classes: ["pbta", "character"],
			position: { width: 1160, height: 900 },
			actions: {
				// --- view-state toggles (no actor writes, so no editability gate) ---
				toggleTop(ev, target) {
					target.closest(".sheet-wrapper")?.classList.toggle("top-collapsed");
				},
				toggleMovesOverlay(ev, target) {
					target.closest(".stonetop-sheet-layout")?.classList.toggle("moves-open");
				},
				// One toggle for every tab's view state: the button names its flag, and whether the
				// tab is re-rendered or just decorated is the flag's business (see TabViewFlags).
				toggleTabView(ev, target) {
					if (this._viewFlags.toggleFrom(target)) this.render();
				},
				async openBasicMove(ev, target) {
					// Once a move opens, dismiss the overlay so it doesn't cover the move sheet.
					target.closest(".stonetop-sheet-layout")?.classList.remove("moves-open");
					const { compendiumId } = target.dataset;
					if (!compendiumId) return;
					const doc = await this._moveRepository.getReferencedMoveDocument(compendiumId);
					doc?.sheet.render(true);
				},
				// A rule reference that names a move by slug (the Outfit heading, for one) opens that
				// move's sheet. Not edit-gated: opening a sheet writes nothing.
				async openMoveBySlug(ev, target) {
					const doc = await this._moveRepository.getMoveDocumentBySlug(target.dataset.moveSlug);
					doc?.sheet.render(true);
				},
				toggleFollowerInventory(ev, target) {
					const slug = target.dataset.slug;
					if (this._openFollowerInventories.has(slug)) this._openFollowerInventories.delete(slug);
					else this._openFollowerInventories.add(slug);
					this.render();
				},

				// --- one-call domain actions ---
				selectOriginName: editOnly(function (ev, target) {
					return this._stonetopCharacter.origin.selectName(target.textContent.trim());
				}),
				flipArcanum: editOnly(function (ev, target) {
					// A flip swaps the whole card body, and when the two sides grant different gear it
					// writes twice — so the tab is rebuilt (more than once) around a card that just
					// changed height. Pin the card across the whole action, or it drops to the top.
					const slug = target.dataset.slug;
					return this._scrollAnchoring.hold(target.closest(".stonetop-arcanum-card"),
						`.stonetop-arcanum-card[data-slug="${slug}"]`, ".sheet-body",
						() => this._stonetopCharacter.toggleArcanumFlip(slug, target.dataset.flipped === "true"));
				}),
				addFollower: editOnly(function () {
					return this._stonetopCharacter.addCustomFollower();
				}),
				addFollowerMember: editOnly(function (ev, target) {
					return this._stonetopCharacter.addFollowerMember(target.dataset.slug);
				}),
				removeFollowerMember: editOnly(function (ev, target) {
					return this._stonetopCharacter.removeFollowerMember(
						target.dataset.slug, Number(target.dataset.index));
				}),
				addInventoryItem: editOnly(function (ev, target) {
					return this._onAddInventoryItem(target);
				}),

				...MOVE_ROW_ACTIONS,
				...TAG_CHIP_ACTIONS,
				...PIP_ACTIONS,
				...OUTFIT_ACTIONS,
				...DELETE_ACTIONS,
			},
		};

		static PARTS = {
			form: {
				template: "systems/stonetop/templates/actor/character.hbs",
				scrollable: [".sheet-body", ".stonetop-moves-sidebar"],
			},
		};

		// Core tab machinery: tabGroups seeds from `initial`, nav anchors carry data-action="tab",
		// context.tabs comes out of super._prepareContext via _prepareTabs.
		static TABS = {
			primary: {
				tabs: [
					{ id: "playbook" }, { id: "moves" }, { id: "possessions" }, { id: "inventory" },
					{ id: "arcana" }, { id: "followers" }, { id: "notes" },
				],
				initial: "playbook",
				labelPrefix: "stonetop.sheet.tabs",
			},
		};

		// The fixed tabs plus one tab per owned insert item — static TABS can't express those, but
		// core's _prepareTabs routes through this hook, so the dynamic tabs ride the core pipeline.
		_getTabsConfig(group) {
			const config = super._getTabsConfig(group);
			if (group !== "primary" || !config) return config;
			const insertTabs = itemsOfType(this.actor, "insert")
				.filter(i => i.system?.slug)
				.map(i => ({ id: `insert-${i.system.slug}`, label: i.name }));
			return { ...config, tabs: [...config.tabs, ...insertTabs] };
		}

		async _prepareContext(options) {
			// Which inventories are open has to be known before the snapshot is built, since only
			// the open follower's (large) outfit catalog is rendered.
			this._stonetopCharacter.setOpenFollowerInventories(this._openFollowerInventories);
			// Independent of the snapshot, so it is started first and overlaps the base's build.
			const playbooks = this._stonetopCharacter.listPlaybooks();
			const context = await super._prepareContext(options);
			context.viewFlags           = this._viewFlags.toContext();
			context.availablePlaybooks  = await playbooks;
			return context;
		}

		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
			this._buildChangeRouter().attach(this.element);
			// Every choice row on the sheet, through the one shared description of how one behaves.
			new ChoiceGroupWiring(this._stonetopCharacter, { when: () => this.isEditable })
				.attach(this.element);
		}

		// The @Blank enricher renders write-in blanks empty, so their stored values are seeded here
		// on every render (the part content was just replaced).
		_onRender(context, options) {
			super._onRender(context, options);
			// Held, not consumed: a two-write action renders more than once (see ScrollAnchoring).
			this._scrollAnchoring.applyTo(this.element);
			const cards = this.element.querySelectorAll(".stonetop-arcanum-card");
			if (!cards.length) return;
			const blanksBySlug = this._stonetopCharacter.getAllArcanumBlanks();
			for (const card of cards) {
				const blanks = blanksBySlug.get(card.dataset.slug) ?? {};
				for (const input of card.querySelectorAll("input.stonetop-arcanum-blank"))
					input.value = blanks[input.dataset.blankKey] ?? "";
			}
		}

		_buildChangeRouter() {
			const handlers = {
				...moveRowChangeHandlers(this._stonetopCharacter),
				...tagChipChangeHandlers(this),
				...characterChangeHandlers(this._stonetopCharacter),
			};
			return new ChangeActionRouter(handlers, {
				when: () => this.isEditable,
				ignore: ChoiceGroupWiring.CHANGE_ACTIONS,
			});
		}

		// Tag chips on a follower card, group member, or companion — StonetopCharacter routes on
		// which of the three the wrap describes.
		toggleTag(wrap, value) {
			return this._stonetopCharacter.toggleFollowerTag(wrap.slug, wrap.field, wrap.memberIndex, value);
		}

		// Core ActorSheetV2 ships the whole drop pipeline (never wire `drop` manually here) —
		// same-sheet drops keep core's sort behavior, everything else routes through the typed
		// character (playbooks replace, followers/moves absorb, owned arcana skip, rest embeds).
		async _onDropItem(event, item) {
			if (!this.isEditable) return null;
			if (this.actor.uuid === item.parent?.uuid) return super._onDropItem(event, item);
			await this._stonetopCharacter.applyDroppedItems([item.toObject()]);
			return null;
		}

		// A dropped NPC becomes a follower.
		async _onDropActor(event, actor) {
			if (!this.isEditable || actor?.type !== "npc") return null;
			await this._stonetopCharacter.addFollowerFromActor(actor);
			return null;
		}

		async _onAddInventoryItem(target) {
			const isRegular = target.dataset.column === "regular";
			const item = await this._addInventoryItemDialog.show({ isRegular });
			if (!item) return;
			await this._stonetopCharacter.addCustomInventoryItemFor(InventoryOwner.fromElement(target), item);
		}
	};
}
