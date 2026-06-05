export class TestPlaybookItemBuilder {
	_slug               = "the-blessed";
	_name               = "The Blessed";
	_img                = null;
	_description        = "";
	_statsNote          = "";
	_backgrounds        = [];
	_instinct           = null;
	_appearance         = null;
	_origin             = [];
	_lore               = [];
	_specialPossessions = null;

	withSlug(slug)               { this._slug               = slug; return this; }
	withName(name)               { this._name               = name; return this; }
	withImg(img)                 { this._img                = img;  return this; }
	withDescription(d)           { this._description        = d;    return this; }
	withStatsNote(n)             { this._statsNote          = n;    return this; }
	withBackgrounds(b)           { this._backgrounds        = b;    return this; }
	withInstinct(i)              { this._instinct           = i;    return this; }
	withAppearance(a)            { this._appearance         = a;    return this; }
	withOrigin(o)                { this._origin             = o;    return this; }
	withLore(l)                  { this._lore               = l;    return this; }
	withSpecialPossessions(sp)   { this._specialPossessions = sp;   return this; }

	_buildSystem() {
		return {
			slug:               this._slug,
			description:        this._description,
			statsNote:          this._statsNote,
			backgrounds:        this._backgrounds,
			instinct:           this._instinct,
			appearance:         this._appearance,
			origin:             this._origin,
			lore:               this._lore,
			specialPossessions: this._specialPossessions,
			actorType:          null,
			hp:                 0,
			damage:             { value: null },
			startingMovesNote:  "",
			introductions:      [],
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
