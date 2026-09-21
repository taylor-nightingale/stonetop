import {VitalsSourcesSnapshot, VitalsNotesSnapshot} from "../../model/snapshot/character/VitalsSnapshot.js";

const _KEY = "stonetop.character.attributes.source";

const _format = (key, data = {}) => globalThis.game?.i18n?.format?.(`${_KEY}.${key}`, data) ?? key;

const _NOTE_KEY = "stonetop.character.attributes.note";

const _note = (key) => globalThis.game?.i18n?.format?.(`${_NOTE_KEY}.${key}`) ?? key;

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

	/* ── The same provenance, short enough to print ──────────────────────────────────
	   The `describe*` sentences above are hover text, and a hover is pointer-only and invisible to
	   assistive tech — so the sheet never actually said where any of these numbers came from. The
	   notes below say it out loud beside the value, the way a steading rating states its band.

	   ONE WORD, or close to it. These ride under a tile that can be as narrow as a third of the rail,
	   so anything longer wraps to three lines and makes the row taller than the frames in it — which
	   is what a playbook's NAME did here ("The Would-be Hero", under a 53px Damage tile). The name is
	   also the one thing a reader does not need told: it is printed at the top of the Playbook tab,
	   and HP and Damage both saying it said nothing twice. Which SOURCE it came from is the fact.

	   The sentence — with the name, the numbers and what the playbook grants — is what the hover
	   carries, and that has not changed. */

	noteForHp(maxHp) {
		const playbook = this._playbook;
		if (playbook && playbook.hp === maxHp) return _note("fromPlaybook");
		return _note("byHand");
	}

	noteForDamage(die) {
		if (!die) return _note("damageUnset");
		const playbook = this._playbook;
		if (playbook && playbook.damage?.value === die) return _note("fromPlaybook");
		return _note("byHand");
	}

	noteForArmor(armor) {
		const breakdown = this._armor;
		if (breakdown.isEmpty) return armor ? _note("byHand") : _note("armorNone");
		if (breakdown.value !== armor) return _note("byHand");
		// The gear itself, named — "leather, shield" answers "why is my armour 2?" in three words.
		return breakdown.contributions.map(c => c.name).join(", ");
	}

	buildNotes(maxHp, die, armor) {
		return new VitalsNotesSnapshot(
			this.noteForHp(maxHp),
			this.noteForDamage(die),
			this.noteForArmor(armor),
		);
	}

	_signed(amount) {
		return amount > 0 ? `+${amount}` : `${amount}`;
	}
}
