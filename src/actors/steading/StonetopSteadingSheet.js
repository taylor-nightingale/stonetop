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

		async getData() {
			const ctx = await super.getData();
			ctx.stonetop = await this._stonetopSteading.buildSnapshot();
			return ctx;
		}

		activateListeners(html) {
			super.activateListeners(html);
			if (!this.isEditable) return;

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

			// Attributes (size, population, prosperity, defenses)
			html.find(".steading-box-input[data-attr]").on("change", async ev => {
				const { attr } = ev.currentTarget.dataset;
				await this._stonetopSteading.attributes.setCurrent(attr, parseInt(ev.currentTarget.value));
			});
			html.find(".stonetop-attr-extra-add").on("click", async ev => {
				await this._stonetopSteading.attributes.addNewItemToAttribute(ev.currentTarget.dataset.attr);
			});
			html.find(".stonetop-attr-extra-remove").on("click", async ev => {
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
			html.find(".stonetop-asset-item-remove").on("click", async ev => {
				await this._stonetopSteading.assets.removeItem(parseInt(ev.currentTarget.dataset.index));
			});
			html.find(".stonetop-asset-item").on("change", async ev => {
				await this._stonetopSteading.assets.updateItem(parseInt(ev.currentTarget.dataset.index), ev.currentTarget.value);
			});

			// Coinage
			html.find(".stonetop-coinage-input").on("change", async ev => {
				const { index, field } = ev.currentTarget.dataset;
				await this._stonetopSteading.assets.updateCoinageEntry(parseInt(index), field, parseInt(ev.currentTarget.value) || 0);
			});

			// Residents
			html.find(".stonetop-resident-add").on("click", async () => {
				await this._stonetopSteading.residents.add();
			});
			html.find(".stonetop-resident-remove").on("click", async ev => {
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
				await this._actor.update({"system.residentTraits": traits});
			});

			// Neighbors — people
			html.find(".stonetop-neighbor-person-add").on("click", async () => {
				await this._stonetopSteading.neighborPeople.add();
			});
			html.find(".stonetop-neighbor-person-remove").on("click", async ev => {
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
		}
	};
}
