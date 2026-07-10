import { enrichRichTextTree } from "../../utils/enrichRichText.js";
import { confirmDelete } from "../../utils/confirmDelete.js";
import { applySteadfast, loadSteadfast, loadAllSteadfasts, matchSteadfastByName } from "./applySteadfast.js";

export function createStonetopSteadingSheetClass(Base) {
	return class StonetopSteadingSheet extends Base {
		constructor(...args) {
			super(...args);
			this._stonetopSteading = this.actor.typedActor;
		}

		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["stonetop", "sheet", "actor", "steading"],
				width:   1180,
				height:  760,
				scrollY: [".window-content"],
				tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "overview" }],
				submitOnChange: true,
			});
		}

		get template() {
			return "systems/stonetop/templates/actor/steading.hbs";
		}

		// A steadfast dropped on a steading isn't embedded as an owned item — it re-seeds the steading's
		// definition (the same as picking one from the sheet's dropdown). Anything else drops as normal.
		async _onDropItem(event, data) {
			const item = await Item.implementation.fromDropData(data);
			if (item?.type === "steadfast") {
				if (this.isEditable) await applySteadfast(this.actor, item);
				return;
			}
			return super._onDropItem(event, data);
		}

		async getData() {
			const ctx = await super.getData();
			ctx.stonetop = await this._stonetopSteading.buildSnapshot();
			await enrichRichTextTree(ctx.stonetop, this.actor?.getRollData?.() ?? {});
			// The steadfast picker at the top of the sheet: every steadfast + the one this steading uses.
			// The list is stashed so the name combobox's change handler can resolve a picked/typed name.
			ctx.availableSteadfasts = this._availableSteadfasts = await loadAllSteadfasts();
			ctx.currentSteadfast    = this.actor.system.steadfast;
			return ctx;
		}

		activateListeners(html) {
			super.activateListeners(html);
			if (!this.isEditable) return;

			// Destructive deletes route through the shared confirm gate: left-click asks first
			// (showing the row's `data-name`), right-click skips — same convention as the character sheet.
			const withConfirm = (selector, run) => {
				html.find(selector)
					.on("click", async ev => {
						if (await confirmDelete(ev.currentTarget.dataset.name)) await run(ev);
					})
					.on("contextmenu", async ev => {
						ev.preventDefault();
						await run(ev);
					});
			};

			// Name combobox — typing/picking a value that matches a steadfast name applies it (re-seeds the
			// definition fields and adopts its name; runtime state like residents/debilities is preserved).
			// Any other value is just the steading's own name. Dropping a steadfast routes through the same
			// applySteadfast (see _onDropItem).
			html.find(".steading-steadfast-input").on("change", async ev => {
				const value = ev.currentTarget.value.trim();
				const match = matchSteadfastByName(value, this._availableSteadfasts ?? []);
				if (match) {
					const steadfast = await loadSteadfast(match.slug);
					if (steadfast) await applySteadfast(this.actor, steadfast);
				} else if (value && value !== this.actor.name) {
					await this.actor.update({ name: value });
				}
			});

			// Roll mode
			html.find("[name=stonetop-roll-mode]").on("change", ev => {
				this._stonetopSteading.setRollMode(ev.currentTarget.value);
			});

			// Fortunes
			html.find(".steading-box-input[name='stonetop-fortunes']").on("change", async ev => {
				await this._stonetopSteading.setFortunes(parseInt(ev.currentTarget.value));
			});

			// Surplus
			html.find(".steading-surplus-input").on("change", async ev => {
				await this._stonetopSteading.setSurplus(parseInt(ev.currentTarget.value) || 0);
			});

			// Attributes (size, population, prosperity, defenses). Ratings store an actual number; size
			// stores its tier string.
			html.find(".steading-box-input[data-attr]").on("change", async ev => {
				const { attr } = ev.currentTarget.dataset;
				const raw = ev.currentTarget.value;
				await this._stonetopSteading.attributes.setValue(attr, attr === "size" ? raw : parseInt(raw));
			});
			html.find(".stonetop-attr-extra-add").on("click", async ev => {
				await this._stonetopSteading.attributes.addNewItemToAttribute(ev.currentTarget.dataset.attr);
			});
			withConfirm(".stonetop-attr-extra-remove", async ev => {
				const { attr, index } = ev.currentTarget.dataset;
				await this._stonetopSteading.attributes.removeItemFromAttribute(attr, index);
			});
			html.find(".stonetop-attr-extra").on("change", async ev => {
				const { attr, index } = ev.currentTarget.dataset;
				await this._stonetopSteading.attributes.updateItemOnAttribute(attr, index, ev.currentTarget.value);
			});

			// Debilities
			html.find(".steading-circle-input").on("change", async ev => {
				await this._stonetopSteading.debilities.setDebility(ev.currentTarget.dataset.slug, ev.currentTarget.checked);
			});

			// Notes
			html.find(".stonetop-notes").on("change", async ev => {
				await this._stonetopSteading.setNotes(ev.currentTarget.value);
			});


			// Content (free-text textarea per category)
			html.find(".stonetop-content-textarea").on("change", async ev => {
				await this._stonetopSteading.content.updateText(ev.currentTarget.dataset.type, ev.currentTarget.value);
			});

			// Asset items
			html.find(".stonetop-asset-item-add").on("click", async () => {
				await this._stonetopSteading.assets.addItem();
			});
			withConfirm(".stonetop-asset-item-remove", async ev => {
				await this._stonetopSteading.assets.removeItem(parseInt(ev.currentTarget.dataset.index));
			});
			html.find(".stonetop-asset-item").on("change", async ev => {
				await this._stonetopSteading.assets.updateItem(parseInt(ev.currentTarget.dataset.index), ev.currentTarget.value);
			});

			// Coinage
			html.find(".stonetop-coinage-purses").on("change", async ev => {
				await this._stonetopSteading.assets.updatePurses(ev.currentTarget.dataset.title, parseInt(ev.currentTarget.value) || 0);
			});
			html.find(".stonetop-coinage-handfuls").on("change", async ev => {
				await this._stonetopSteading.assets.updateHandfuls(ev.currentTarget.dataset.title, parseInt(ev.currentTarget.value) || 0);
			});
			html.find(".stonetop-coinage-coins").on("change", async ev => {
				await this._stonetopSteading.assets.updateCoins(ev.currentTarget.dataset.title, parseInt(ev.currentTarget.value) || 0);
			});

			// Residents
			html.find(".stonetop-resident-add").on("click", async () => {
				await this._stonetopSteading.residents.add();
			});
			withConfirm(".stonetop-resident-remove", async ev => {
				await this._stonetopSteading.residents.remove(ev.currentTarget.dataset.id);
			});
			html.find(".stonetop-resident-name").on("change", async ev => {
				await this._stonetopSteading.residents.updateName(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});
			html.find(".stonetop-resident-occupation").on("change", async ev => {
				await this._stonetopSteading.residents.updateOccupation(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});
			html.find(".stonetop-resident-traits").on("change", async ev => {
				await this._stonetopSteading.residents.updateTraits(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});


			// NPC traits source textarea
			html.find(".steading-npc-traits-source").on("change", async ev => {
				const traits = ev.currentTarget.value.split("\n").map(t => t.trim()).filter(Boolean);
				await this._actor.update({"system.residents.traits": traits});
			});

			// Neighbors — people
			html.find(".stonetop-neighbor-person-add").on("click", async () => {
				await this._stonetopSteading.neighborPeople.add();
			});
			withConfirm(".stonetop-neighbor-person-remove", async ev => {
				await this._stonetopSteading.neighborPeople.remove(ev.currentTarget.dataset.id);
			});
			html.find(".stonetop-neighbor-person-name").on("change", async ev => {
				await this._stonetopSteading.neighborPeople.updateName(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});
			html.find(".stonetop-neighbor-person-occupation").on("change", async ev => {
				await this._stonetopSteading.neighborPeople.updateOccupation(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});
			html.find(".stonetop-neighbor-person-traits").on("change", async ev => {
				await this._stonetopSteading.neighborPeople.updateTraits(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});
			html.find(".stonetop-neighbor-person-home").on("change", async ev => {
				await this._stonetopSteading.neighborPeople.updateHome(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});

			// Neighbors — places
			html.find(".stonetop-neighbor-place-note").on("change", async ev => {
				await this._stonetopSteading.neighborPlaces.updateNote(ev.currentTarget.dataset.id, ev.currentTarget.value);
			});

			// Places of Interest
			html.find(".stonetop-place-add").on("click", async () => {
				await this._stonetopSteading.placesOfInterest.addBlankPlace();
			});
			html.find(".stonetop-place-field").on("change", async ev => {
				await this._stonetopSteading.placesOfInterest.setPlaceValue(parseInt(ev.currentTarget.dataset.index), ev.currentTarget.value);
			});

			// Improvements
			html[0].addEventListener("change", async ev => {
				const el = ev.target.closest(".stonetop-cg-track");
				if (!el || el.dataset.cgContext !== "improvement") return;
				const { cgGroup, cgOption, cgIndex } = el.dataset;
				const count = el.checked ? parseInt(cgIndex) + 1 : parseInt(cgIndex);
				await this._stonetopSteading.improvements.setTrack(cgGroup, cgOption, count);
			}, true);

			// Homefront moves go through the standard embedded-move flow: the acquisition checkbox
			// toggles the owned move, the resource pips/input track its per-move resource state. Roll
			// clicks (.rollable) are handled by the inherited StonetopActorSheet listener.
			html.find(".stonetop-move-check").on("change", async ev => {
				const { moveSlug } = ev.currentTarget.dataset;
				if (ev.currentTarget.checked) await this._stonetopSteading.moves.incrementMove(moveSlug);
				else                          await this._stonetopSteading.moves.decrementMove(moveSlug);
			});
			html[0].addEventListener("click", async ev => {
				const btn = ev.target.closest(".stonetop-item-resource-check");
				if (!btn || btn.dataset.moveSlug === undefined) return;
				ev.stopPropagation();
				ev.stopImmediatePropagation();
				const isChecked = btn.classList.contains("is-checked");
				const current = isChecked ? Number(btn.dataset.index) : Number(btn.dataset.index) + 1;
				await this._stonetopSteading.moves.setMoveResourceCurrent(btn.dataset.moveSlug, current);
			}, true);
			html[0].addEventListener("change", async ev => {
				const el = ev.target.closest(".stonetop-resource-input");
				if (!el || el.dataset.moveSlug === undefined) return;
				await this._stonetopSteading.moves.setMoveResourceText(el.dataset.moveSlug, el.value);
			}, true);
		}
	};
}
