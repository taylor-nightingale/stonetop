import { NewInventoryItem } from "./NewInventoryItem.js";
import { ResourceController } from "./ResourceController.js";
import { Tags } from "../../model/data/Tags.js";
import { toOutfitItemSnapshot } from "../../model/snapshot/character/outfitSections.js";

/**
 * The item the outfit adder is writing, before it is added: what its fields say. Immutable — each
 * `with…` answers a new draft. It previews as the row it will make, built from the same snapshot the
 * inventory draws, and becomes a NewInventoryItem once it has a name.
 */
export class OutfitItemDraft {
	constructor({ isRegular = true, name = "", weight = 1, uses = 0, usesWord = "", tags = [], note = "" } = {}) {
		this.isRegular = isRegular;
		this.name      = name;
		this.weight    = weight;
		this.uses      = uses;
		this.usesWord  = usesWord;
		this.tags      = [...tags];
		this.note      = note;
	}

	/** A fresh draft for the regular (◇) or small (□) column. */
	static for(isRegular) {
		return new OutfitItemDraft({ isRegular });
	}

	withName(name)         { return this.#with({ name }); }
	withWeight(weight)     { return this.#with({ weight: Math.max(1, Math.trunc(Number(weight)) || 1) }); }
	withUses(uses)         { return this.#with({ uses: Math.max(0, Math.trunc(Number(uses)) || 0) }); }
	withUsesWord(usesWord) { return this.#with({ usesWord }); }
	withNote(note)         { return this.#with({ note }); }
	withTagToggled(token)  { return this.#with({ tags: Tags.gear(this.tags).toggle(token).toRaw() }); }

	/** The chip picker's Selection: the draft's tags, with the book's glossary on offer. */
	get tagPicker() {
		return Tags.gear(this.tags).picker;
	}

	/** The row it will make — unchecked, its track empty, as a catalog item previews. */
	get preview() {
		const item = this.#item();
		const gear = { slug: "outfit-draft", name: item.name, weight: item.weight, tags: item.tags, note: item.note };
		return toOutfitItemSnapshot(gear, false, ResourceController.build(item.resource, 0));
	}

	/** @returns {NewInventoryItem|null} null until it has a name */
	toNewItem() {
		return this.name.trim() ? this.#item() : null;
	}

	#item() {
		const extras = { uses: this.uses, usesWord: this.usesWord.trim(), tags: this.tags, note: this.note.trim() || null };
		const name = this.name.trim();
		return this.isRegular ? NewInventoryItem.regular(name, this.weight, extras) : NewInventoryItem.small(name, extras);
	}

	#with(change) {
		return new OutfitItemDraft({ ...this, ...change });
	}
}
