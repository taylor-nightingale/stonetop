export class TestInsertItemBuilder {
	_id           = "insert-item-1";
	_slug         = "revenant";
	_name         = "Revenant";
	_img          = null;
	_description  = "";
	_instinct     = null;
	_choices      = [];
	_choiceValues = {};

	withId(id)                  { this._id           = id;      return this; }
	withSlug(slug)              { this._slug         = slug;    return this; }
	withName(name)              { this._name         = name;    return this; }
	withImg(img)                { this._img          = img;     return this; }
	withDescription(desc)       { this._description  = desc;    return this; }
	withInstinct(def)           { this._instinct     = def;     return this; }
	withChoices(choices)        { this._choices      = choices; return this; }
	withChoiceValues(values)    { this._choiceValues = values;  return this; }

	build() {
		return {
			_id:    this._id,
			type:   "insert",
			name:   this._name,
			img:    this._img,
			system: {
				slug:         this._slug,
				description:  this._description,
				instinct:     this._instinct,
				choices:      this._choices,
				choiceValues: this._choiceValues,
			},
		};
	}
}
