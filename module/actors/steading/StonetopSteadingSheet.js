import { SteadingDefaults } from "../../model/data/steading/SteadingDefaults.js";

function _nextPlaceKey(allPlaces) {
	const used = new Set(allPlaces.map(p => p.key));
	for (let i = 0; i < 26; i++) {
		const k = String.fromCharCode(65 + i);
		if (!used.has(k)) return k;
	}
	for (let i = 0; i < 26; i++) {
		for (let j = 0; j < 26; j++) {
			const k = String.fromCharCode(65 + i) + String.fromCharCode(65 + j);
			if (!used.has(k)) return k;
		}
	}
	return "?";
}

export function createStonetopSteadingSheetClass(Base) {
	return class StonetopSteadingSheet extends Base {
		constructor(...args) {
			super(...args);
			this._stonetopSteading = this.actor.typedActor;
		}

		static get defaultOptions() {
			return foundry.utils.mergeObject(super.defaultOptions, {
				classes: ["stonetop", "sheet", "actor", "steading"],
				width:   800,
				height:  900,
			});
		}

		get template() {
			return "modules/stonetop/templates/actor/steading.hbs";
		}

		async getData() {
			const ctx = await super.getData();
			ctx.stonetop = await this._stonetopSteading.buildSnapshot();
			return ctx;
		}

		activateListeners(html) {
			super.activateListeners(html);
			if (!this.isEditable) return;

			// Fortunes
			html.find(".stonetop-fortunes-radio").on("change", async ev => {
				await this._stonetopSteading.setFortunes(parseInt(ev.currentTarget.value));
			});

			// Surplus
			html.find(".stonetop-surplus-input").on("change", async ev => {
				await this._stonetopSteading.setSurplus(parseInt(ev.currentTarget.value) || 0);
			});

			// Attributes
			html.find(".stonetop-attr-radio").on("change", async ev => {
				const { attr } = ev.currentTarget.dataset;
				await this._stonetopSteading.setAttributeCurrent(attr, parseInt(ev.currentTarget.value));
			});

			// Debilities
			html.find(".stonetop-debility-check").on("change", async ev => {
				const { slug } = ev.currentTarget.dataset;
				await this._stonetopSteading.setDebility(slug, ev.currentTarget.checked);
			});

			// Notes
			html.find(".stonetop-notes").on("change", async ev => {
				await this._stonetopSteading.setNotes(ev.currentTarget.value);
			});

			// Content lists
			html.find(".stonetop-content-add").on("click", async ev => {
				const { type } = ev.currentTarget.dataset;
				const con = this._stonetopSteading.contentState;
				const list = [...(con[type] ?? []), ""];
				await this._stonetopSteading.setContent({ ...con, [type]: list });
			});
			html.find(".stonetop-content-remove").on("click", async ev => {
				const { type, index } = ev.currentTarget.dataset;
				const con  = this._stonetopSteading.contentState;
				const list = [...(con[type] ?? [])];
				list.splice(parseInt(index), 1);
				await this._stonetopSteading.setContent({ ...con, [type]: list });
			});
			html.find(".stonetop-content-item").on("change", async ev => {
				const { type, index } = ev.currentTarget.dataset;
				const con  = this._stonetopSteading.contentState;
				const list = [...(con[type] ?? [])];
				list[parseInt(index)] = ev.currentTarget.value;
				await this._stonetopSteading.setContent({ ...con, [type]: list });
			});

			// Coinage
			html.find(".stonetop-coinage-input").on("change", async ev => {
				const { index, field } = ev.currentTarget.dataset;
				const assets  = this._stonetopSteading.assetsState;
				const coinage = [...(assets.coinage ?? SteadingDefaults.assets.coinage)];
				coinage[parseInt(index)] = { ...coinage[parseInt(index)], [field]: parseInt(ev.currentTarget.value) || 0 };
				await this._stonetopSteading.setAssets({ ...assets, coinage });
			});

			// Residents
			html.find(".stonetop-resident-add").on("click", async () => {
				const list = [...this._stonetopSteading.residents, { id: _uid(), name: "", occupation: "", notes: "" }];
				await this._stonetopSteading.setResidents(list);
			});
			html.find(".stonetop-resident-remove").on("click", async ev => {
				const { id } = ev.currentTarget.dataset;
				await this._stonetopSteading.setResidents(this._stonetopSteading.residents.filter(r => r.id !== id));
			});
			html.find(".stonetop-resident-field").on("change", async ev => {
				const { id, field } = ev.currentTarget.dataset;
				const list = this._stonetopSteading.residents.map(r =>
					r.id === id ? { ...r, [field]: ev.currentTarget.value } : r
				);
				await this._stonetopSteading.setResidents(list);
			});

			// Neighbors — people
			html.find(".stonetop-neighbor-person-add").on("click", async () => {
				const nb = this._stonetopSteading.neighbors;
				const people = [...(nb.people ?? []), { id: _uid(), name: "", home: "", notes: "" }];
				await this._stonetopSteading.setNeighbors({ ...nb, people });
			});
			html.find(".stonetop-neighbor-person-remove").on("click", async ev => {
				const { id } = ev.currentTarget.dataset;
				const nb = this._stonetopSteading.neighbors;
				await this._stonetopSteading.setNeighbors({ ...nb, people: nb.people.filter(p => p.id !== id) });
			});
			html.find(".stonetop-neighbor-person-field").on("change", async ev => {
				const { id, field } = ev.currentTarget.dataset;
				const nb = this._stonetopSteading.neighbors;
				const people = nb.people.map(p => p.id === id ? { ...p, [field]: ev.currentTarget.value } : p);
				await this._stonetopSteading.setNeighbors({ ...nb, people });
			});

			// Neighbors — places
			html.find(".stonetop-neighbor-place-add").on("click", async () => {
				const nb = this._stonetopSteading.neighbors;
				const places = [...(nb.places ?? []), { id: _uid(), name: "", notes: "" }];
				await this._stonetopSteading.setNeighbors({ ...nb, places });
			});
			html.find(".stonetop-neighbor-place-remove").on("click", async ev => {
				const { id } = ev.currentTarget.dataset;
				const nb = this._stonetopSteading.neighbors;
				await this._stonetopSteading.setNeighbors({ ...nb, places: nb.places.filter(p => p.id !== id) });
			});
			html.find(".stonetop-neighbor-place-field").on("change", async ev => {
				const { id, field } = ev.currentTarget.dataset;
				const nb = this._stonetopSteading.neighbors;
				const places = nb.places.map(p => p.id === id ? { ...p, [field]: ev.currentTarget.value } : p);
				await this._stonetopSteading.setNeighbors({ ...nb, places });
			});

			// Extra attribute items (prosperity resources, defense fortifications)
			html.find(".stonetop-attr-extra-add").on("click", async ev => {
				const { attr } = ev.currentTarget.dataset;
				const items = [...(this._stonetopSteading.attributeState[attr]?.extra ?? []), ""];
				await this._stonetopSteading.setAttributeExtra(attr, items);
			});
			html.find(".stonetop-attr-extra-remove").on("click", async ev => {
				const { attr, index } = ev.currentTarget.dataset;
				const items = [...(this._stonetopSteading.attributeState[attr]?.extra ?? [])];
				items.splice(parseInt(index), 1);
				await this._stonetopSteading.setAttributeExtra(attr, items);
			});
			html.find(".stonetop-attr-extra").on("change", async ev => {
				const { attr, index } = ev.currentTarget.dataset;
				const items = [...(this._stonetopSteading.attributeState[attr]?.extra ?? [])];
				items[parseInt(index)] = ev.currentTarget.value;
				await this._stonetopSteading.setAttributeExtra(attr, items);
			});

			// Extra places of interest
			html.find(".stonetop-place-add").on("click", async () => {
				const key = _nextPlaceKey([
					...SteadingDefaults.placesOfInterest,
					...this._stonetopSteading.extraPlaces,
				]);
				await this._stonetopSteading.setExtraPlaces([
					...this._stonetopSteading.extraPlaces,
					{ key, title: "" },
				]);
			});
			html.find(".stonetop-place-remove").on("click", async ev => {
				const idx = parseInt(ev.currentTarget.dataset.index);
				const places = this._stonetopSteading.extraPlaces.filter((_, i) => i !== idx);
				await this._stonetopSteading.setExtraPlaces(places);
			});
			html.find(".stonetop-place-field").on("change", async ev => {
				const idx = parseInt(ev.currentTarget.dataset.index);
				const places = this._stonetopSteading.extraPlaces.map((p, i) =>
					i === idx ? { ...p, title: ev.currentTarget.value } : p
				);
				await this._stonetopSteading.setExtraPlaces(places);
			});

			// Improvements
			html.find(".stonetop-improvement-track").on("change", async ev => {
				const { optionSlug, idx } = ev.currentTarget.dataset;
				const groupSlug = ev.currentTarget.closest("[data-slug]")?.dataset.slug;
				if (!groupSlug) return;
				const count = ev.currentTarget.checked ? parseInt(idx) + 1 : parseInt(idx);
				await this._stonetopSteading.setImprovementTrack(groupSlug, optionSlug, count);
			});
		}
	};
}

function _uid() {
	return Math.random().toString(36).slice(2, 10);
}
