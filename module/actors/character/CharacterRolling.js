import { DebilitySnapshotBuilder } from "../../model/snapshot/character/CharacterSnapshot.js";

const _DEBILITY_DEFS = [
	{ key: "weakened",  name: "Weakened",  stats: ["str", "dex"] },
	{ key: "dazed",     name: "Dazed",     stats: ["int", "wis"] },
	{ key: "miserable", name: "Miserable", stats: ["con", "cha"] },
];

export class CharacterRolling {
	constructor(actor, stats) {
		this._actor = actor;
		this._stats = stats;
	}

	get rollMode() {
		return this._actor.getFlag("stonetop", "rollMode") ?? "normal";
	}

	async setRollMode(mode) {
		await this._actor.setFlag("stonetop", "rollMode", mode);
	}

	buildDebilitiesSnapshot() {
		const opts = this._actor.system?.attributes?.debilities?.options ?? {};
		return _DEBILITY_DEFS.map(({ key, name, stats }) =>
			new DebilitySnapshotBuilder()
				.withKey(key)
				.withName(name)
				.withActive(!!(opts[key]?.value))
				.withStats(stats)
				.build()
		);
	}

	applyDebilityRollMode(stat, options) {
		const debilityOptions = this._actor.system?.attributes?.debilities?.options ?? {};
		const hasActiveDebility = Object.values(debilityOptions).some(
			opt => opt.value && Array.isArray(opt.stat) && opt.stat.includes(stat)
		);
		if (!hasActiveDebility) return options;
		if (options.rollMode === "adv") return { ...options, rollMode: "def" };
		if (options.rollMode === "dis") return options;
		return { ...options, rollMode: "dis" };
	}

	async onRoll(event) {
		const itemId = event.currentTarget.closest(".item")?.dataset.itemId;
		if (!itemId) return false;
		const item = this._actor.items.get(itemId);
		const stat = item?.system?.rollType ?? null;
		if (!stat) return false;

		const isDescription = event.currentTarget.getAttribute("data-show") === "description";
		const descriptionOnly = isDescription || (item.type === "npcMove" && !item.system.rollFormula);
		const options = {};
		if (!game.settings.get("stonetop", "hideRollMode")) {
			options.rollMode = this.rollMode;
		}
		await item.roll({ ...this.applyDebilityRollMode(stat, options), descriptionOnly });
		return true;
	}

	async rollStat(stat) {
		const statValue = this._stats.getStats().get(stat) ?? 0;
		const options = {};
		if (!game.settings.get("stonetop", "hideRollMode")) {
			options.rollMode = this.rollMode;
		}
		const rollOptions = this.applyDebilityRollMode(stat, options);
		const mode = rollOptions.rollMode;
		const formula =
			mode === "adv" ? `{2d6,2d6}kh + ${statValue}` :
			mode === "dis" ? `{2d6,2d6}kl + ${statValue}` :
			                 `2d6 + ${statValue}`;
		const roll = await new Roll(formula).evaluate();
		const total = roll.total;
		const resultLabel = game.i18n.localize(
			total >= 10 ? "stonetop.rollResults.strongHit" :
			total >= 7  ? "stonetop.rollResults.weakHit"  :
			              "stonetop.rollResults.miss"
		);
		await roll.toMessage({
			speaker: ChatMessage.getSpeaker({ actor: this._actor }),
			flavor: `${stat.toUpperCase()} — ${resultLabel}`,
		});
	}
}
