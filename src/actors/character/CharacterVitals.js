import {ValueMax, VitalsSnapshotBuilder} from "../../model/snapshot/character/CharacterSnapshot.js";
import {ArmorBreakdown} from "../../model/data/character/ArmorBreakdown.js";
import {VitalsProvenance} from "./VitalsProvenance.js";
import {Advancement} from "../../model/data/character/Advancement.js";

function toInt(v) {
	const n = parseInt(v);
	return isNaN(n) ? 0 : n;
}

export class CharacterVitals {
	constructor(actor) {
		this._actor = actor;
	}

	get level() {
		return this._actor.system?.attributes?.level ?? 1;
	}

	get xp() {
		return this._actor.system?.attributes?.xp?.value ?? 0;
	}

	/** Level Up's arithmetic for where this character stands — what it costs, whether the move has
	 *  triggered, what the track reads afterwards. One object, so no caller recomputes 6 + level × 2. */
	get advancement() {
		return new Advancement(this.level, this.xp);
	}

	/**
	 * Level Up's first two steps, as ONE write: the XP is spent and the level is gained together, so
	 * nothing can leave a character who paid and did not advance.
	 *
	 * Advances whatever the track reads — a table that levels someone early is levelling someone
	 * early, not making a mistake for the sheet to refuse. The subtraction floors at 0 and anything
	 * over the cost carries into the next level, which is what the move says to do with it.
	 */
	async advance() {
		const advancement = this.advancement;
		await this._actor.update({
			"system.attributes.xp.value": advancement.xpAfter,
			"system.attributes.level":    advancement.level + 1,
		});
		return advancement;
	}

	// `playbook` (its system data) and `armorBreakdown` are the sources the stored values are
	// measured against for the provenance tooltips; the character supplies both.
	async buildVitalsSnapshot(playbook = null, armorBreakdown = ArmorBreakdown.empty()) {
		const attrs    = this._actor.system?.attributes ?? {};
		const level    = attrs.level ?? 1;
		const hpMax    = attrs.hp?.max ?? 0;
		const dieVal   = attrs.damage?.value ?? null;
		const damage   = dieVal ? { value: dieVal } : null;
		const armor    = attrs.armor ?? 0;
		return new VitalsSnapshotBuilder()
			.withHp(new ValueMax(attrs.hp?.value ?? 0, hpMax))
			.withDamage(damage)
			.withArmor(armor)
			.withLevel(level)
			.withXp(new ValueMax(attrs.xp?.value ?? 0, new Advancement(level, 0).cost))
			.withSources(new VitalsProvenance(playbook, armorBreakdown).build(hpMax, dieVal, armor))
			.build();
	}

	async updateVitalsFromPlaybook(stonetopPlaybook) {
		await Promise.all([
			this._setDamage(stonetopPlaybook.damage),
			this.setMaxHP(stonetopPlaybook.hp),
			this.setHP(stonetopPlaybook.hp),
		]);
	}

	async setHP(hp) {
		await this._actor.update({ "system.attributes.hp.value": Math.max(0, toInt(hp)) });
	}

	async setXP(xp) {
		await this._actor.update({ "system.attributes.xp.value": Math.max(0, toInt(xp)) });
	}

	/** Mark 1 XP (the book's tick mark). The track has no ceiling: Level Up triggers at XP
	 *  "equal to (or greater than)" 6 + level × 2 and SUBTRACTS that amount (p. 81), so excess
	 *  accumulates and carries over — and feeds Burn Brightly. Returns whether a mark landed
	 *  (always true; boolean is the contract the chat toggle checks). */
	async markXp() {
		const current = this._actor.system?.attributes?.xp?.value ?? 0;
		await this._actor.update({ "system.attributes.xp.value": current + 1 });
		return true;
	}

	/** Remove 1 XP tick (undoing an auto-mark). Returns whether a tick was removed —
	 *  false when the track is already empty. */
	async unmarkXp() {
		const current = this._actor.system?.attributes?.xp?.value ?? 0;
		if (current <= 0) return false;
		await this._actor.update({ "system.attributes.xp.value": current - 1 });
		return true;
	}

	async setLevel(level) {
		await this._actor.update({ "system.attributes.level": Math.max(1, toInt(level)) });
	}

	async setMaxHP(hpMax) {
		await this._actor.update({ "system.attributes.hp.max": Math.max(0, toInt(hpMax)) });
	}

	async setArmor(armor) {
		await this._actor.update({ "system.attributes.armor": Math.max(0, toInt(armor)) });
	}

	async setDamage(die) {
		await this._setDamage(die ? { value: String(die).trim() } : null);
	}

	async _setDamage(damage) {
		await this._actor.update({ "system.attributes.damage.value": damage?.value ?? null });
	}
}
