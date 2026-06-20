import { Possession } from "../../src/model/data/character/Possession.js";

export class TestPossessionBuilder {
	_slug        = "test-possession";
	_label       = "Test Possession";
	_description = "";
	_resource    = null;
	_scaling     = null;
	_outfitItems = [];
	_choices     = null;

	withSlug(slug)        { this._slug        = slug;  return this; }
	withLabel(label)      { this._label       = label; return this; }
	withDescription(desc) { this._description = desc;  return this; }

	withResource(max, title = "Stock") {
		this._resource = { max, title, labels: [] };
		return this;
	}

	withScaling(perEvenLevel) {
		if (!this._scaling) this._scaling = { perEvenLevel, perMove: [] };
		else this._scaling.perEvenLevel = perEvenLevel;
		return this;
	}

	withMoveBonus(moveSlug, amount) {
		if (!this._scaling) this._scaling = { perEvenLevel: 0, perMove: [] };
		this._scaling.perMove.push({ moveSlug, amount });
		return this;
	}

	withOutfitItems(...items) {
		this._outfitItems = items.flat();
		return this;
	}

	withChoices(choiceGroup) {
		this._choices = choiceGroup;
		return this;
	}

	build() {
		return new Possession({
			slug:        this._slug,
			description: this._description,
			resource:    this._resource,
			outfitItems: this._outfitItems,
			choices:     this._choices,
			scaling:     this._scaling,
		}, this._label);
	}
}
