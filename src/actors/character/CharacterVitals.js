import {ValueMax, VitalsSnapshotBuilder} from "../../model/snapshot/character/CharacterSnapshot.js";

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

	async buildVitalsSnapshot() {
		const attrs    = this._actor.system?.attributes ?? {};
		const level    = attrs.level ?? 1;
		const hpMax    = attrs.hp?.max ?? 0;
		const dieVal   = attrs.damage?.value ?? null;
		const damage   = dieVal ? { value: dieVal } : null;
		return new VitalsSnapshotBuilder()
			.withHp(new ValueMax(attrs.hp?.value ?? 0, hpMax))
			.withDamage(damage)
			.withArmor(attrs.armor ?? 0)
			.withLevel(level)
			.withXp(new ValueMax(attrs.xp?.value ?? 0, 6 + level * 2))
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

	/** Mark 1 XP (the book's tick mark), clamped to the track (6 + level × 2). Returns whether a
	 *  mark landed — false when the track is already full. */
	async markXp() {
		const attrs = this._actor.system?.attributes ?? {};
		const max = 6 + (attrs.level ?? 1) * 2;
		const current = attrs.xp?.value ?? 0;
		if (current >= max) return false;
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
