import { FoundryMoveRepository } from "./repositories/FoundryMoveRepository.js";
import { ChangeActionRouter } from "../../utils/ChangeActionRouter.js";
import { ChoiceGroupWiring } from "../../utils/ChoiceGroupWiring.js";
import { editOnly } from "../../utils/sheetActions.js";
import { SheetRail, RAIL_ACTIONS } from "../../utils/SheetRail.js";
import { TopBandState, TOP_BAND_ACTIONS } from "../../utils/TopBand.js";
import { ScrollAnchoring } from "../../utils/ScrollAnchoring.js";
import { TabViewFlags } from "../../utils/TabViewFlags.js";
import { OutfitItemAdder, AdderPlace } from "./OutfitItemAdder.js";
import { InventoryOwner } from "./InventoryOwner.js";
import { itemsOfType } from "../actorItems.js";
import { characterChangeHandlers } from "./characterChangeHandlers.js";
import { PIP_ACTIONS, DELETE_ACTIONS, OUTFIT_ACTIONS, ADVANCEMENT_ACTIONS } from "./characterSheetActions.js";
import { MOVE_ROW_ACTIONS, moveRowChangeHandlers } from "../moveRowHandlers.js";
import { TAG_CHIP_ACTIONS, tagChipChangeHandlers } from "../tagChips.js";
import { TAG_DEFINITION_ACTIONS } from "../tagDefinitions.js";
import { toggleSlidingDisclosure, toggleSwappingDisclosure } from "../../utils/Disclosure.js";
import { MovePreviews } from "../../utils/MovePreviewPlacement.js";
import { AilmentEditor } from "./AilmentEditor.js";
import { BandFootWatch } from "../../utils/BandFootFit.js";
import { ArrivalRegions } from "./ArrivalRegions.js";
import { PendingTab } from "../../utils/PendingTab.js";
import { openSections } from "../../utils/openSections.js";

// The adder's preview row alone, redrawn as its fields change — the same partial the sheet draws it with.
const OUTFIT_ADDER_PREVIEW = "systems/stonetop/templates/actor/partials/outfit-item-adder-preview.hbs";

export function createStonetopCharacterSheetClass(Base) {
	return class StonetopCharacterSheet extends Base {
		_moveRepository = new FoundryMoveRepository();
		_outfitAdder = new OutfitItemAdder();
		// Which follower inventory catalogs are expanded — sheet-instance state that survives
		// re-render, so only the open follower renders the (large) outfit catalog.
		_openFollowerInventories = new Set();
		// Every view-state toggle on the sheet: the moves tab's "selected only" filter, one lock per
		// insert tab, the Level Up checklist. Held here because the controls they decorate are
		// re-rendered constantly — ticking a move would otherwise drop the filter mid-review.
		_viewFlags = new TabViewFlags(["levelUpOpen"]);
		// What arrived since this sheet last drew it — a playbook just chosen, an insert just gained —
		// and so which of its sections open (D11, D12).
		_arrivals = new ArrivalRegions();
		// The insert tab a drop on THIS sheet is about to create, to switch to once it exists.
		_pendingTab = new PendingTab();
		_scrollAnchoring = new ScrollAnchoring();
		// Whether this reader has the wound editor open; every save re-renders, and it comes back open.
		_ailmentEditor = new AilmentEditor();
		// Whether the band's foot fits beside the stats, carried across renders and re-asked on resize.
		_bandFoot = new BandFootWatch();

		/**
		 * Whether this reader has folded the top band to its ledger line. Here rather than on the
		 * shared base: the band is the character's alone — the steading folds its header to a line
		 * through its own markup, with no class for anything to remember.
		 */
		get topBandState() {
			return this._topBandState ??= new TopBandState();
		}

		get _stonetopCharacter() {
			return this.typedActor;
		}

		static DEFAULT_OPTIONS = {
			// The base supplies `stonetop sheet actor`.
			classes: ["pbta", "character"],
			position: { width: 1160, height: 900 },
			actions: {
				// --- view-state toggles (no actor writes, so no editability gate) ---
				...TOP_BAND_ACTIONS,
				...RAIL_ACTIONS,
				// One toggle for the sheet's view state: the button names its flag (see TabViewFlags).
				toggleTabView(ev, target) {
					if (this._viewFlags.toggleFrom(target)) this.render();
				},
				// A rule reference that names a move by slug (the Outfit heading, for one) opens that
				// move's sheet. Not edit-gated: opening a sheet writes nothing.
				async openMoveBySlug(ev, target) {
					const doc = await this._moveRepository.getMoveDocumentBySlug(target.dataset.moveSlug);
					doc?.sheet.render(true);
				},
				// Where a Level Up step is answered. The move chooser, the Invocations group and the
				// Instinct and Appearance editors all already exist on tabs of their own, so the strip
				// points at them rather than growing a second copy of any of them. Writes nothing.
				// A route that names sections (`data-open-sections`) opens them where it lands: the
				// masthead's instinct opens the instinct, the level-up review opens it and appearance.
				goToTab(ev, target) {
					this.changeTab(target.dataset.tab, "primary");
					openSections(this.element, (target.dataset.openSections ?? "").split(" ").filter(Boolean), this.openDisclosures);
				},
				// The wound editor, opened from the Ailments bar or a wound's own row. Writes nothing.
				openAilments(ev, target) {
					this._ailmentEditor.open(target.dataset.woundId ?? null);
					this.render();
				},
				closeAilments() {
					return this._closeAilments();
				},
				// A rail group, or a move row's text, sliding open or shut. Reading writes nothing.
				toggleSliding: toggleSlidingDisclosure,
				// A section's door: what it says at rest traded for everything on offer, at once.
				toggleSection: toggleSwappingDisclosure,
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
				addWound: editOnly(function () {
					this._ailmentEditor.focusNewest();
					return this._stonetopCharacter.addWound();
				}),
				// A move taken again, from its choosing line: one more take, up to the book's limit.
				takeMoveAgain: editOnly(function (ev, target) {
					return this._stonetopCharacter.incrementMove(target.dataset.categoryKey, target.dataset.moveSlug);
				}),
				advanceWoundState: editOnly(function (ev, target) {
					return this._stonetopCharacter.advanceWoundState(target.dataset.woundId);
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
				// "+ add item" opens the adder under it; nothing is written until Add.
				addInventoryItem: editOnly(function (ev, target) {
					this._outfitAdder.open(AdderPlace.fromButton(target));
					this.render();
				}),
				outfitDraftAdd: editOnly(function () {
					return this._addOutfitDraft();
				}),
				closeOutfitAdder() {
					return this._closeOutfitAdder();
				},

				...MOVE_ROW_ACTIONS,
				...TAG_CHIP_ACTIONS,
				...TAG_DEFINITION_ACTIONS,
				...PIP_ACTIONS,
				...ADVANCEMENT_ACTIONS,
				...OUTFIT_ACTIONS,
				...DELETE_ACTIONS,
			},
		};

		static PARTS = {
			form: {
				template: "systems/stonetop/templates/actor/character.hbs",
				scrollable: [".sheet-body", ".stonetop-rail"],
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
			// Straight after the Playbook's (D12): an insert is a fragment of a playbook, and Notes is the
			// one tab that should always be last.
			const [playbook, ...rest] = config.tabs;
			return { ...config, tabs: [playbook, ...insertTabs, ...rest] };
		}

		async _prepareContext(options) {
			// Which inventories are open has to be known before the snapshot is built, since only
			// the open follower's (large) outfit catalog is rendered.
			this._stonetopCharacter.setOpenFollowerInventories(this._openFollowerInventories);
			// Independent of the snapshot, so it is started first and overlaps the base's build.
			const playbooks = this._stonetopCharacter.listPlaybooks();
			const context = await super._prepareContext(options);
			context.viewFlags           = this._viewFlags.toContext();
			for (const id of this._arrivals.regionsFor(context.stonetop, context.sheetIdPrefix)) this.openDisclosures.open(id);
			context.ailmentsOpen        = this._ailmentEditor.isOpen;
			context.outfitAdder         = this._outfitAdder.view();
			context.availablePlaybooks  = await playbooks;
			return context;
		}

		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
			this._buildChangeRouter().attach(this.element);
			// Every choice row on the sheet, through the one shared description of how one behaves.
			new ChoiceGroupWiring(this._stonetopCharacter, { when: () => this.isEditable })
				.attach(this.element);
			this._ailmentEditor.attach(this.element, () => this._closeAilments());
			this._outfitAdder.attach(this.element, {
				onClose:       () => this._closeOutfitAdder(),
				onAdd:         () => this.isEditable && this._addOutfitDraft(),
				renderPreview: view => foundry.applications.handlebars.renderTemplate(OUTFIT_ADDER_PREVIEW, view),
			});
			const view = this.element.ownerDocument?.defaultView ?? globalThis;
			new MovePreviews({ viewport: () => ({ width: view.innerWidth, height: view.innerHeight }) }).attach(this.element);
		}

		// The band's fold is a class on the part root, and the part root is rebuilt on every render —
		// so without this, ticking a pip or another player's edit arriving over the socket unfolded
		// the band the reader had just put away.
		restoreViewState(root) {
			super.restoreViewState(root);
			this.topBandState.restore(root);
			this._bandFoot.restore(root);
		}

		// The @Blank enricher renders write-in blanks empty, so their stored values are seeded here
		// on every render (the part content was just replaced).
		_onRender(context, options) {
			super._onRender(context, options);
			// Held, not consumed: a two-write action renders more than once (see ScrollAnchoring).
			this._scrollAnchoring.applyTo(this.element);
			this._ailmentEditor.applyFocus(this.element);
			this._outfitAdder.applyFocus(this.element);
			this._ailmentEditor.applyReveal(this.element);
			this._outfitAdder.applyReveal(this.element);
			this._bandFoot.watch(this.element);
			this._pendingTab.applyTo(this.element, id => this.changeTab(id, "primary"));
			const cards = this.element.querySelectorAll(".stonetop-arcanum-card");
			if (!cards.length) return;
			const blanksBySlug = this._stonetopCharacter.getAllArcanumBlanks();
			for (const card of cards) {
				const blanks = blanksBySlug.get(card.dataset.slug) ?? {};
				for (const input of card.querySelectorAll("input.stonetop-arcanum-blank"))
					input.value = blanks[input.dataset.blankKey] ?? "";
			}
		}

		// Shutting the editor on a line left empty leaves no wound behind.
		async _closeAilments() {
			this._ailmentEditor.close();
			if (this.isEditable) await this._stonetopCharacter.removeUnnamedWounds();
			this.render();
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
			if (wrap.field === OutfitItemAdder.TAG_FIELD) {
				this._outfitAdder.update(draft => draft.withTagToggled(value));
				this._outfitAdder.focusOn(".stonetop-tag-add");
				return this.render();
			}
			return this._stonetopCharacter.toggleFollowerTag(wrap.slug, wrap.field, wrap.memberIndex, value);
		}

		// Core ActorSheetV2 ships the whole drop pipeline (never wire `drop` manually here) —
		// same-sheet drops keep core's sort behavior, everything else routes through the typed
		// character (playbooks replace, followers/moves absorb, owned arcana skip, rest embeds).
		async _onDropItem(event, item) {
			if (!this.isEditable) return null;
			if (this.actor.uuid === item.parent?.uuid) return super._onDropItem(event, item);
			if (item.type === "insert" && item.system?.slug) this._pendingTab.set(`insert-${item.system.slug}`);
			await this._stonetopCharacter.applyDroppedItems([item.toObject()]);
			return null;
		}

		// A dropped NPC becomes a follower.
		async _onDropActor(event, actor) {
			if (!this.isEditable || actor?.type !== "npc") return null;
			await this._stonetopCharacter.addFollowerFromActor(actor);
			return null;
		}

		// The adder's draft, added where its button was. A draft with no name is not an item yet.
		async _addOutfitDraft() {
			const item = this._outfitAdder.draft?.toNewItem();
			if (!item) {
				this._outfitAdder.focusOn(OutfitItemAdder.NAME);
				return this.render();
			}
			const { owner } = this._outfitAdder.place;
			this._outfitAdder.close();
			await this._stonetopCharacter.addCustomInventoryItemFor(owner, item);
			this.render();
		}

		_closeOutfitAdder() {
			this._outfitAdder.close();
			this.render();
		}
	};
}
