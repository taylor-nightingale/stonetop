import { loadAllSteadfasts } from "./applySteadfast.js";
import { editOnly, confirmedDelete } from "../../utils/sheetActions.js";
import { steadingChangeHandlers } from "./steadingChangeHandlers.js";
import { ChoiceGroupWiring } from "../../utils/ChoiceGroupWiring.js";
import { ChangeActionRouter } from "../../utils/ChangeActionRouter.js";
import { MOVE_ROW_ACTIONS, moveRowChangeHandlers } from "../moveRowHandlers.js";

export function createStonetopSteadingSheetClass(Base) {
	return class StonetopSteadingSheet extends Base {
		get _stonetopSteading() {
			return this.typedActor;
		}

		static DEFAULT_OPTIONS = {
			// The base supplies `stonetop sheet actor`; add the steading class.
			classes: ["steading"],
			position: { width: 1180, height: 760 },
			actions: {
				...MOVE_ROW_ACTIONS,

				// --- adds ---
				addResident:      editOnly(function () { return this._stonetopSteading.addResident(); }),
				addNeighbor:      editOnly(function () { return this._stonetopSteading.addNeighbor(); }),
				addPlace:         editOnly(function () { return this._stonetopSteading.addPlace(); }),
				addAssetItem:     editOnly(function () { return this._stonetopSteading.addAssetItem(); }),
				addAttributeItem: editOnly(function (ev, target) {
					return this._stonetopSteading.addAttributeItem(target.dataset.attr);
				}),

				// --- unlinks (drop the linked document, keep the row) ---
				unlinkResident: editOnly(function (ev, target) {
					return this._stonetopSteading.unlinkResident(target.dataset.id);
				}),
				unlinkNeighbor: editOnly(function (ev, target) {
					return this._stonetopSteading.unlinkNeighbor(target.dataset.id);
				}),
				unlinkPlace: editOnly(function (ev, target) {
					return this._stonetopSteading.unlinkPlace(parseInt(target.dataset.index));
				}),

				// --- deletes (click confirms, right-click skips) ---
				removeResident: confirmedDelete(function (target) {
					return this._stonetopSteading.removeResident(target.dataset.id);
				}),
				removeNeighbor: confirmedDelete(function (target) {
					return this._stonetopSteading.removeNeighbor(target.dataset.id);
				}),
				removeAssetItem: confirmedDelete(function (target) {
					return this._stonetopSteading.removeAssetItem(parseInt(target.dataset.index));
				}),
				removeAttributeItem: confirmedDelete(function (target) {
					return this._stonetopSteading.removeAttributeItem(target.dataset.attr, target.dataset.index);
				}),
				// Granting an improvement is drag-drop (_onDropItem); this revokes one.
				revokeImprovement: confirmedDelete(function (target) {
					return this._stonetopSteading.revokeImprovement(target.dataset.slug);
				}),
			},
		};

		// Core tab machinery end to end: tabGroups seeds from `initial`, the nav anchors carry
		// data-action="tab" (core's built-in action → changeTab), and context.tabs comes out of
		// super._prepareContext via _prepareTabs.
		static TABS = {
			primary: {
				tabs: [
					{ id: "overview" }, { id: "residents" }, { id: "neighbors" },
					{ id: "improvements" }, { id: "moves" }, { id: "seasons" }, { id: "notes" },
				],
				initial: "overview",
			},
		};

		static PARTS = {
			form: {
				// No `scrollable`: like the NPC card, scrolling lives on .window-content (which
				// persists across V2 re-renders), not on the part content that gets replaced.
				template: "systems/stonetop/templates/actor/steading.hbs",
			},
		};

		async _prepareContext(options) {
			// Independent of the snapshot, so it is started first and overlaps the base's build.
			const steadfasts = loadAllSteadfasts();
			const ctx = await super._prepareContext(options);
			// The steadfast picker at the top of the sheet: every steadfast + the one this steading uses.
			// The list is stashed so the name combobox's change handler can resolve a picked/typed name.
			ctx.availableSteadfasts = this._availableSteadfasts = await steadfasts;
			ctx.currentSteadfast    = this.actor.system.steadfast;
			return ctx;
		}

		// A steadfast or move dropped on the steading is handled by the typed steading (re-seed the
		// definition / join the homefront list); anything else embeds through core's default
		// pipeline. Core ActorSheetV2 wires the drop listeners itself — never wire `drop` manually
		// here, or every drop is handled twice.
		async _onDropItem(event, item) {
			if (!this.isEditable) return null;
			if (await this._stonetopSteading.applyDroppedItem(item)) return null;
			return super._onDropItem(event, item);
		}

		// Core routes every resolved drop through _onDropDocument (→ _onDropActor/_onDropItem/…). Any
		// document (actor, journal, item…) dropped onto a resident/neighbor/place row links there as a
		// bare UUID, rendered as a clickable content link; the row kind decides which typed list owns
		// it (a neighbor row carries the resident class too, so it is checked first). Off any linkable
		// row, the drop falls through to core's routing (steadfast/move handling, item embed, …).
		async _onDropDocument(event, document) {
			if (this.isEditable && document?.uuid) {
				const s = this._stonetopSteading;
				const neighborRow = event.target.closest?.(".steading-neighbor-row");
				if (neighborRow) return void await s.linkNeighbor(neighborRow.dataset.id, document.uuid);
				const residentRow = event.target.closest?.(".steading-resident-row");
				if (residentRow) return void await s.linkResident(residentRow.dataset.id, document.uuid);
				const placeRow = event.target.closest?.(".stonetop-places-row");
				if (placeRow) return void await s.linkPlace(Number(placeRow.dataset.index), document.uuid);
			}
			return super._onDropDocument(event, document);
		}

		// Root-delegated, one-time wiring — the V2 root persists across re-renders. Editability is
		// checked per event, not at wiring time, so a sheet that becomes editable later just works.
		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
			const root = this.element;

			// Every choice row on the sheet — improvement tracks, seasonal gains — through the one
			// shared description of how a choice row behaves.
			new ChoiceGroupWiring(this._stonetopSteading, { when: () => this.isEditable }).attach(root);

			// Every change control on the sheet — its own fields and the move rows it shares with
			// the character sheet — through one delegated router.
			new ChangeActionRouter({
				...moveRowChangeHandlers(this._stonetopSteading),
				...steadingChangeHandlers(this._stonetopSteading, {
					availableSteadfasts: () => this._availableSteadfasts ?? [],
				}),
			}, {
				when: () => this.isEditable,
				ignore: ChoiceGroupWiring.CHANGE_ACTIONS,
			}).attach(root);
		}
	};
}
