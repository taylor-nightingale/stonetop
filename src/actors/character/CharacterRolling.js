import { DebilitySnapshotBuilder } from "../../model/snapshot/character/CharacterSnapshot.js";
import { buildRollContent } from "../../utils/rollDisplay.js";

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

	getRollableStats() {
		return this._stats.getRollableStats();
	}

	resolveBonus(rollStat) {
		const stats = this._stats.getStats();
		return rollStat in stats ? stats.get(rollStat) : null;
	}

	applyRollMode(rollStat, rollMode) {
		return this.applyDebilityRollMode(rollStat, { rollMode }).rollMode;
	}

	async rollStat(stat) {
		if (stat === "damage") {
			const die = this._actor.system?.attributes?.damage?.value;
			if (!die) return;
			const roll = await new Roll(`1${die}`).evaluate();
			await roll.toMessage({
				speaker: ChatMessage.getSpeaker({ actor: this._actor }),
				flavor: game.i18n.localize("stonetop.character.attributes.damage"),
			});
			return;
		}

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
		const resultKey   = total >= 10 ? "success" : total >= 7 ? "partial" : "failure";
		const resultLabel = game.i18n.localize(
			resultKey === "success" ? "stonetop.rollResults.strongHit" :
			resultKey === "partial"  ? "stonetop.rollResults.weakHit"  :
			                          "stonetop.rollResults.miss"
		);
		const speaker = ChatMessage.getSpeaker({ actor: this._actor });
		await ChatMessage.create({
			speaker,
			content: buildRollContent(roll, {
				name:     `${stat.toUpperCase()} — ${resultLabel}`,
				rollMode: mode,
				bonus:    statValue,
				statKey:  stat,
				resultKey,
			}),
			rolls: [roll],
		});
	}
}
