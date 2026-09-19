export class TestPlaybookItemBuilder {
	_slug               = "the-blessed";
	_name               = "The Blessed";
	_img                = null;
	_description        = "";
	_statsNote          = "";
	_backgrounds        = [];
	_instinct           = null;
	_appearance         = null;
	_choices            = [];
	_choiceValues       = {};
	_origin             = [];
	_specialPossessions = null;
	_introductions      = null;
	_startingMoves      = [];

	withSlug(slug)               { this._slug               = slug; return this; }
	withName(name)               { this._name               = name; return this; }
	withImg(img)                 { this._img                = img;  return this; }
	withDescription(d)           { this._description        = d;    return this; }
	withStatsNote(n)             { this._statsNote          = n;    return this; }
	withBackgrounds(b)           { this._backgrounds        = b;    return this; }
	withInstinct(def)            { this._instinct           = def;  return this; }
	withAppearance(list)         { this._appearance         = list; return this; }
	withChoices(c)               { this._choices            = c;    return this; }
	withChoiceValues(v)          { this._choiceValues       = v;    return this; }
	withOrigin(o)                { this._origin             = o;    return this; }
	withSpecialPossessions(sp)   { this._specialPossessions = sp;   return this; }
	withIntroductions(intro)     { this._introductions      = intro; return this; }
	// The subset of the playbook's moves seeded acquired at character creation — the ones a level
	// never bought.
	withStartingMoves(slugs)     { this._startingMoves      = slugs; return this; }

	_buildSystem() {
		return {
			slug:               this._slug,
			description:        this._description,
			statsNote:          this._statsNote,
			backgrounds:        this._backgrounds,
			instinct:           this._instinct,
			appearance:         this._appearance,
			choices:            this._choices,
			choiceValues:       this._choiceValues,
			origin:             this._origin,
			specialPossessions: this._specialPossessions,
			hp:                 0,
			damage:             { value: null },
			startingMovesNote:  "",
			startingMoves:      this._startingMoves,
			introductions:      this._introductions,
		};
	}

	build() {
		return {
			_id:    "playbook-item",
			type:   "playbook",
			name:   this._name,
			img:    this._img,
			system: this._buildSystem(),
		};
	}

	buildData() {
		return { ...this._buildSystem(), name: this._name, img: this._img };
	}
}
