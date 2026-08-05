import {VitalsSourcesSnapshot} from "../../model/snapshot/character/VitalsSnapshot.js";

const _KEY = "stonetop.character.attributes.source";

const _format = (key, data = {}) => globalThis.game?.i18n?.format?.(`${_KEY}.${key}`, data) ?? key;

/**
 * Explains where max HP, the damage die and Armor came from. Nothing stamps a source when these
 * are written, so provenance is re-derived: max HP and damage are compared against the playbook
 * that granted them, Armor against what the checked gear adds up to. A value that matches its
 * source is reported as coming from it; anything else was typed in by hand.
 */
export class VitalsProvenance {
	// `playbook` is the playbook item's system data (null when the character has none).
	constructor(playbook, armorBreakdown) {
		this._playbook = playbook;
		this._armor    = armorBreakdown;
	}

	describeHp(maxHp) {
		const playbook = this._playbook;
		if (!playbook) return _format("hpNoPlaybook", {max: maxHp});
		if (playbook.hp === maxHp) return _format("hp", {max: maxHp, playbook: playbook.name});
		return _format("hpManual", {max: maxHp, playbook: playbook.name, playbookMax: playbook.hp});
	}

	describeDamage(die) {
		const playbook    = this._playbook;
		const playbookDie = playbook?.damage?.value ?? null;
		if (!die) {
			return playbookDie
				? _format("damageUnsetWithPlaybook", {playbook: playbook.name, playbookDie})
				: _format("damageUnset");
		}
		if (!playbookDie) return _format("damageNoPlaybook", {die});
		if (playbookDie === die) return _format("damage", {die, playbook: playbook.name});
		return _format("damageManual", {die, playbook: playbook.name, playbookDie});
	}

	describeArmor(armor) {
		const breakdown = this._armor;
		if (breakdown.isEmpty)
			return armor ? _format("armorManualOnly", {armor}) : _format("armorNone");

		const items = breakdown.contributions.map(c => c.isBase
			? _format("armorBaseItem", {name: c.name, amount: c.amount})
			: _format("armorModifierItem", {name: c.name, amount: this._signed(c.amount)}),
		).join(", ");

		return breakdown.value === armor
			? _format("armor", {value: breakdown.value, items})
			: _format("armorManual", {armor, value: breakdown.value, items});
	}

	build(maxHp, die, armor) {
		return new VitalsSourcesSnapshot(
			this.describeHp(maxHp),
			this.describeDamage(die),
			this.describeArmor(armor),
		);
	}

	_signed(amount) {
		return amount > 0 ? `+${amount}` : `${amount}`;
	}
}
