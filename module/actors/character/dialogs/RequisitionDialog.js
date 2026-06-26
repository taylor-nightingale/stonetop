import { FrontOnOpen } from "../../../utils/front-on-open.js";
import { rollStat, sign } from "../../../utils/roll-engine.js";
import { StonetopSteading } from "../../steading/StonetopSteading.js";

/**
 * The player-facing Requisition move. Lists the linked steading's on-hand assets
 * and lets the character roll +Fortunes and "take" one for an expedition. Taking
 * an asset adds it to the character's items list and marks it out (unchecked, with
 * a "taken by" note) on the steading's Assets list. Returning it is done from the
 * steading sheet by clicking the greyed-out asset.
 */
export class RequisitionDialog extends Application {
	/**
	 * @param {object} stonetopCharacter - StonetopCharacter wrapper (for inventory writes)
	 * @param {Actor}  characterActor     - The character Actor document (for name/id)
	 * @param {Actor}  steadingActor       - The linked steading Actor document
	 * @param {Function} [onChange]        - Called after a successful take, to refresh sheets
	 */
	constructor(stonetopCharacter, characterActor, steadingActor, onChange, options = {}) {
		super(options);
		this._character = stonetopCharacter;
		this._characterActor = characterActor;
		this._steadingActor = steadingActor;
		this._steading = new StonetopSteading(steadingActor);
		this._onChange = onChange;
		this._frontOnOpen = new FrontOnOpen(this);
	}

	static get defaultOptions() {
		return foundry.utils.mergeObject(super.defaultOptions, {
			id: "stonetop-requisition",
			title: "Requisition",
			template: "systems/stonetop/templates/dialogs/requisition-picker.hbs",
			width: 540,
			height: "auto",
			resizable: true,
			classes: ["stonetop", "stonetop-requisition"],
		});
	}

	async _render(force, options) {
		await super._render(force, options);
		this._frontOnOpen.apply();
	}

	async close(options = {}) {
		this._frontOnOpen.stop();
		return super.close(options);
	}

	getData() {
		const assets = this._steading._flags.assets ?? [];
		return {
			steadingName: this._steadingActor.name,
			fortunes: sign(this._steading.getStatValue("fortunes")),
			assets: this._steading.getAvailableAssets(),
			takenAssets: assets
				.filter(asset => asset.name && asset.takenBy)
				.map(asset => ({ name: asset.name, takenByName: asset.takenBy?.name ?? "someone" })),
		};
	}

	activateListeners(html) {
		super.activateListeners(html);
		this._frontOnOpen.start();
		const root = html[0];

		root.querySelector(".stonetop-requisition-roll-btn")?.addEventListener("click", () => {
			const rollMode = this._steadingActor.getFlag("stonetop", "rollMode") ?? "normal";
			rollStat("fortunes", this._steadingActor, {
				moveName: "Requisition",
				statValue: this._steading.getStatValue("fortunes"),
				rollMode,
			});
		});

		root.querySelectorAll(".stonetop-requisition-take").forEach(btn => {
			btn.addEventListener("click", async () => {
				if (btn.disabled) return;
				btn.disabled = true;
				const index = parseInt(btn.dataset.index);
				const name = this._steading._flags.assets?.[index]?.name;
				if (!name) return;

				// Add to the character's items list first; this only needs ownership
				// of the character, which the player always has.
				await this._character.addCustomInventoryItem(name, 1);

				// Then mark it out on the steading. Requires permission to edit the
				// steading actor; if missing, keep the item and warn.
				try {
					await this._steading.setAssetTaken(index, {
						name: this._characterActor.name,
						id: this._characterActor.id,
					});
					ui.notifications.info(`${name} requisitioned from ${this._steadingActor.name}.`);
				} catch (err) {
					console.warn("Stonetop | Could not mark asset taken on steading:", err);
					ui.notifications.warn(
						`${name} added to your items, but you lack permission to update ${this._steadingActor.name}'s assets.`
					);
				}

				this._onChange?.();
				this.render(false);
			});
		});

		root.querySelector(".stonetop-requisition-close")?.addEventListener("click", () => this.close());
	}
}
