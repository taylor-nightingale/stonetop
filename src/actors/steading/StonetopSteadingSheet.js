import { enrichRichTextTree } from "../../utils/enrichRichText.js";
import { bindAll } from "../../utils/bindAll.js";
import { bindConfirmedDeletes } from "../../utils/bindConfirmedDeletes.js";
import { loadAllSteadfasts } from "./applySteadfast.js";
import { ChoiceTarget } from "../character/ChoiceTarget.js";

// View adapter only: every handler reads values off the event and calls ONE named method on the
// typed steading (or a composed part of it) — parsing, matching, and routing decisions live there.
export function createStonetopSteadingSheetClass(Base) {
	return class StonetopSteadingSheet extends Base {
		constructor(...args) {
			super(...args);
			this._stonetopSteading = this.actor.typedActor;
		}

		static DEFAULT_OPTIONS = {
			// The base supplies `stonetop sheet actor themed theme-light`; add the steading class.
			classes: ["steading"],
			position: { width: 1180, height: 760 },
			actions: {
				// Not edit-gated: posting a move's text to chat mutates nothing.
				moveToChat(ev, target) {
					return this._stonetopSteading.moves.sendToChat(target.dataset.moveSlug);
				},
			},
		};

		// Core tab machinery end to end: tabGroups seeds from `initial`, the nav anchors carry
		// data-action="tab" (core's built-in action → changeTab), and context.tabs comes out of
		// super._prepareContext via _prepareTabs.
		static TABS = {
			primary: {
				tabs: [
					{ id: "overview" }, { id: "residents" }, { id: "neighbors" },
					{ id: "improvements" }, { id: "moves" }, { id: "notes" },
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
			const ctx = await super._prepareContext(options);
			ctx.actor    = this.actor;
			ctx.editable = this.isEditable;
			// Who's looking, not what the steading is — so it belongs here rather than in the
			// snapshot. Gates the first-session section, which is GM-facing prep, not player-facing.
			// Hides only: the steading document itself syncs to every observer either way.
			ctx.isGM = !!globalThis.game?.user?.isGM;
			ctx.stonetop = await this._stonetopSteading.buildSnapshot({ isGM: ctx.isGM });
			await enrichRichTextTree(ctx.stonetop, this.actor?.getRollData?.() ?? {});
			// The steadfast picker at the top of the sheet: every steadfast + the one this steading uses.
			// The list is stashed so the name combobox's change handler can resolve a picked/typed name.
			ctx.availableSteadfasts = this._availableSteadfasts = await loadAllSteadfasts();
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
				if (neighborRow) return void await s.neighborPeople.linkDocument(neighborRow.dataset.id, document.uuid);
				const residentRow = event.target.closest?.(".steading-resident-row");
				if (residentRow) return void await s.residents.linkDocument(residentRow.dataset.id, document.uuid);
				const placeRow = event.target.closest?.(".stonetop-places-row");
				if (placeRow) return void await s.placesOfInterest.linkDocument(Number(placeRow.dataset.index), document.uuid);
			}
			return super._onDropDocument(event, document);
		}

		// Root-delegated, one-time wiring — the V2 root persists across re-renders. Editability is
		// checked per event, not at wiring time, so a sheet that becomes editable later just works.
		async _onFirstRender(context, options) {
			await super._onFirstRender(context, options);
			const root = this.element;

			// Improvements — the tracks are checkbox groups; capture so the group's own toggle logic
			// doesn't swallow the change first.
			root.addEventListener("change", async ev => {
				if (!this.isEditable) return;
				const el = ev.target.closest(".stonetop-cg-track");
				if (!el || el.dataset.cgContext !== "improvement") return;
				const { cgGroup, cgOption, cgIndex } = el.dataset;
				await this._stonetopSteading.improvements.toggleTrack(cgGroup, cgOption, cgIndex, el.checked);
			}, true);

			// Choice-group picks (the seasonal gains). Capture for the same reason as the tracks
			// above; a radio row arrives already checked and clears its siblings through the target.
			// Guarded on the context: an embedded move's picks live in that ITEM's pickValues, so
			// routing them to the steading's store would write somewhere nothing reads back.
			root.addEventListener("change", async ev => {
				if (!this.isEditable) return;
				const el = ev.target.closest(".stonetop-cg-pick");
				if (!el || el.dataset.cgContext !== "steading") return;
				await this._stonetopSteading.choices.setPickFor(ChoiceTarget.fromElement(el), el.checked);
			}, true);

			// Homefront move resource pips (click) + free-text resource (change). Roll clicks
			// (.rollable) are handled by the base's delegated rollable listener.
			root.addEventListener("click", async ev => {
				if (!this.isEditable) return;
				const btn = ev.target.closest(".stonetop-item-resource-check");
				if (!btn || btn.dataset.moveSlug === undefined) return;
				ev.stopPropagation();
				ev.stopImmediatePropagation();
				await this._stonetopSteading.moves.toggleResourcePip(
					btn.dataset.moveSlug, btn.dataset.index, btn.classList.contains("is-checked"));
			}, true);
			root.addEventListener("change", async ev => {
				if (!this.isEditable) return;
				const el = ev.target.closest(".stonetop-resource-input");
				if (!el || el.dataset.moveSlug === undefined) return;
				await this._stonetopSteading.moves.setMoveResourceText(el.dataset.moveSlug, el.value);
			}, true);
		}

		// Direct bindings to the current controls — re-run per render (part content is replaced).
		_onRender(context, options) {
			super._onRender(context, options);
			if (!this.isEditable) return;
			const root = this.element;
			const s    = this._stonetopSteading;

			// Name combobox / steadfast picker — the typed steading decides whether a value applies a
			// steadfast or just renames. Dropping a steadfast routes through the same apply (_onDropItem).
			bindAll(root, ".steading-steadfast-input", "change", async ev => {
				await s.renameOrApplySteadfast(ev.currentTarget.value, this._availableSteadfasts ?? []);
			});

			// Roll mode
			bindAll(root, "[name=stonetop-roll-mode]", "change", ev => s.setRollMode(ev.currentTarget.value));

			// Fortunes / Surplus
			bindAll(root, ".steading-box-input[name='stonetop-fortunes']", "change", async ev => {
				await s.setFortunes(parseInt(ev.currentTarget.value));
			});
			bindAll(root, ".steading-surplus-input", "change", async ev => {
				await s.setSurplus(parseInt(ev.currentTarget.value) || 0);
			});

			// Attributes (size, population, prosperity, defenses). Ratings store an actual number; size
			// stores its tier string.
			bindAll(root, ".steading-box-input[data-attr]", "change", async ev => {
				const { attr } = ev.currentTarget.dataset;
				const raw = ev.currentTarget.value;
				await s.attributes.setValue(attr, attr === "size" ? raw : parseInt(raw));
			});
			bindAll(root, ".stonetop-attr-extra-add", "click", async ev => {
				await s.attributes.addNewItemToAttribute(ev.currentTarget.dataset.attr);
			});
			bindConfirmedDeletes(root, ".stonetop-attr-extra-remove", async ev => {
				const { attr, index } = ev.currentTarget.dataset;
				await s.attributes.removeItemFromAttribute(attr, index);
			});
			bindAll(root, ".stonetop-attr-extra", "change", async ev => {
				const { attr, index } = ev.currentTarget.dataset;
				await s.attributes.updateItemOnAttribute(attr, index, ev.currentTarget.value);
			});

			// Debilities
			bindAll(root, ".steading-circle-input", "change", async ev => {
				await s.debilities.setDebility(ev.currentTarget.dataset.slug, ev.currentTarget.checked);
			});

			// Let Spring Break Forth (first session)
			bindAll(root, ".steading-spring-hopeful", "change", async ev => {
				await s.firstSession.setHopeful(ev.currentTarget.value);
			});
			bindAll(root, ".steading-spring-hook", "change", async ev => {
				await s.firstSession.setHook(ev.currentTarget.value);
			});
			bindAll(root, ".steading-spring-excites-answer", "change", async ev => {
				await s.firstSession.setExcites(ev.currentTarget.dataset.actorId, ev.currentTarget.value);
			});
			bindAll(root, ".steading-spring-done", "click", async () => s.firstSession.markDone());
			bindAll(root, ".steading-spring-reopen", "click", async () => s.firstSession.reopen());

			// Notes
			bindAll(root, ".stonetop-notes", "change", async ev => s.setNotes(ev.currentTarget.value));

			// Content (free-text textarea per category)
			bindAll(root, ".stonetop-content-textarea", "change", async ev => {
				await s.content.updateText(ev.currentTarget.dataset.type, ev.currentTarget.value);
			});

			// Asset items
			bindAll(root, ".stonetop-asset-item-add", "click", async () => { await s.assets.addItem(); });
			bindConfirmedDeletes(root, ".stonetop-asset-item-remove", async ev => {
				await s.assets.removeItem(parseInt(ev.currentTarget.dataset.index));
			});
			bindAll(root, ".stonetop-asset-item", "change", async ev => {
				await s.assets.updateItem(parseInt(ev.currentTarget.dataset.index), ev.currentTarget.value);
			});

			// Coinage
			bindAll(root, ".stonetop-coinage-purses", "change", async ev => {
				await s.assets.updatePurses(ev.currentTarget.dataset.title, parseInt(ev.currentTarget.value) || 0);
			});
			bindAll(root, ".stonetop-coinage-handfuls", "change", async ev => {
				await s.assets.updateHandfuls(ev.currentTarget.dataset.title, parseInt(ev.currentTarget.value) || 0);
			});
			bindAll(root, ".stonetop-coinage-coins", "change", async ev => {
				await s.assets.updateCoins(ev.currentTarget.dataset.title, parseInt(ev.currentTarget.value) || 0);
			});

			// Residents
			bindAll(root, ".stonetop-resident-add", "click", async () => { await s.residents.add(); });
			bindConfirmedDeletes(root, ".stonetop-resident-remove", async ev => {
				await s.residents.remove(ev.currentTarget.dataset.id);
			});
			bindAll(root, ".stonetop-resident-name", "change", async ev => {
				await s.residents.updateName(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});
			bindAll(root, ".stonetop-resident-occupation", "change", async ev => {
				await s.residents.updateOccupation(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});
			bindAll(root, ".stonetop-resident-traits", "change", async ev => {
				await s.residents.updateTraits(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});
			bindAll(root, ".stonetop-resident-unlink", "click", async ev => {
				await s.residents.unlinkDocument(ev.currentTarget.dataset.id);
			});

			// Resident traits source textarea — Residents owns the one-per-line parse.
			bindAll(root, ".steading-npc-traits-source", "change", async ev => {
				await s.residents.updateTraitsSource(ev.currentTarget.value);
			});

			// Neighbors — people
			bindAll(root, ".stonetop-neighbor-person-add", "click", async () => { await s.neighborPeople.add(); });
			bindConfirmedDeletes(root, ".stonetop-neighbor-person-remove", async ev => {
				await s.neighborPeople.remove(ev.currentTarget.dataset.id);
			});
			bindAll(root, ".stonetop-neighbor-person-name", "change", async ev => {
				await s.neighborPeople.updateName(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});
			bindAll(root, ".stonetop-neighbor-person-occupation", "change", async ev => {
				await s.neighborPeople.updateOccupation(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});
			bindAll(root, ".stonetop-neighbor-person-traits", "change", async ev => {
				await s.neighborPeople.updateTraits(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});
			bindAll(root, ".stonetop-neighbor-person-home", "change", async ev => {
				await s.neighborPeople.updateHome(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});
			bindAll(root, ".stonetop-neighbor-person-unlink", "click", async ev => {
				await s.neighborPeople.unlinkDocument(ev.currentTarget.dataset.id);
			});

			// Neighbors — places
			bindAll(root, ".stonetop-neighbor-place-note", "change", async ev => {
				await s.neighborPlaces.updateNote(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});

			// Places of Interest
			bindAll(root, ".stonetop-place-add", "click", async () => { await s.placesOfInterest.addBlankPlace(); });
			bindAll(root, ".stonetop-place-field", "change", async ev => {
				await s.placesOfInterest.setPlaceValue(parseInt(ev.currentTarget.dataset.index), ev.currentTarget.value);
			});
			bindAll(root, ".stonetop-place-unlink", "click", async ev => {
				await s.placesOfInterest.unlinkDocument(parseInt(ev.currentTarget.dataset.index));
			});

			// Improvements — revoke (× / right-click); granting is drag-drop via _onDropItem. Track pips
			// are wired once (delegated) in _onFirstRender.
			bindConfirmedDeletes(root, ".steading-improvement-remove", async ev => {
				await s.improvements.revoke(ev.currentTarget.dataset.slug);
			});

			// The acquisition checkbox toggles the owned move. Resource pips/text are wired once
			// (delegated) in _onFirstRender.
			bindAll(root, ".stonetop-move-check", "change", async ev => {
				const { categoryKey, moveSlug } = ev.currentTarget.dataset;
				if (ev.currentTarget.checked) await s.moves.incrementMove(categoryKey, moveSlug);
				else                          await s.moves.decrementMove(categoryKey, moveSlug);
			});
		}
	};
}
