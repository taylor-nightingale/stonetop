export class TestSpecialPossessionBuilder {
	_slug        = "test-possession";
	_label       = "Test Possession";
	_description = null;
	_resource    = null;
	_usesBonus   = null;
	_moveBonuses = [];
	_outfitItems = [];
	_choices     = null;

	withSlug(slug)        { this._slug        = slug;  return this; }
	withLabel(label)      { this._label       = label; return this; }
	withDescription(desc) { this._description = desc;  return this; }

	withResource(max, title = "Stock") {
		this._resource = { max, title, labels: [] };
		return this;
	}

	withUsesBonus(evenLevelBonus) {
		this._usesBonus = evenLevelBonus;
		return this;
	}

	withMoveBonus(moveSlug, perInstance) {
		this._moveBonuses.push({ moveSlug, perInstance });
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
		const opt = {
			slug:        this._slug,
			label:       this._label,
			description: this._description,
		};
		if (this._resource)           opt.resource    = this._resource;
		if (this._outfitItems.length) opt.outfitItems = this._outfitItems;
		if (this._choices)            opt.choices     = this._choices;
		if (this._usesBonus != null || this._moveBonuses.length) {
			opt.usesBonus = {
				evenLevelBonus: this._usesBonus ?? 0,
				moveBonus:      this._moveBonuses,
			};
		}
		return opt;
	}
}

export class TestSpecialPossessionsBuilder {
	_pickNote    = null;
	_pickCount   = 2;
	_preselected = [];
	_options     = [];

	withPickNote(note)   { this._pickNote  = note; return this; }
	withPickCount(n)     { this._pickCount = n;    return this; }
	addPreselected(slug) { this._preselected.push(slug); return this; }
	addOption(builder)   { this._options.push(builder.build()); return this; }

	build() {
		return {
			pickNote:    this._pickNote,
			pickCount:   this._pickCount,
			preselected: this._preselected,
			options:     this._options,
		};
	}
}
