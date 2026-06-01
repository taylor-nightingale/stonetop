export class TestChoiceRowBuilder {
	_type;
	_slug        = null;
	_track       = null;
	_title       = null;
	_text        = null;
	_placeholder = null;
	_options     = [];
	_pickCount   = 1;
	_inlineDisplay = false;

	static heading()  { return new TestChoiceRowBuilder().withType("heading"); }
	static follower() { return new TestChoiceRowBuilder().withType("follower"); }
	static pick()     { return new TestChoiceRowBuilder().withType("pick"); }
	static input()    { return new TestChoiceRowBuilder().withType("input"); }

	withType(type)               { this._type          = type;        return this; }
	withSlug(slug)               { this._slug          = slug;        return this; }
	withTitle(title)             { this._title         = title;       return this; }
	withText(text)               { this._text          = text;        return this; }
	withTrack(max)               { this._track         = { max };     return this; }
	withPlaceholder(placeholder) { this._placeholder   = placeholder; return this; }
	withPickCount(n)             { this._pickCount      = n;          return this; }
	withInlineDisplay(inline)    { this._inlineDisplay  = inline;     return this; }
	withOptions(...options)      { this._options        = options.flat(); return this; }

	build() {
		if (this._type === "heading") return {
			type:        "heading",
			slug:        this._slug,
			title:       this._title,
			description: this._text,
			track:       this._track,
		};
		if (this._type === "follower") return {
			type:          "follower",
			slug:          this._slug,
			title:         this._title ?? "",
			inlineDisplay: this._inlineDisplay,
			track:         this._track ?? { max: 1 },
		};
		if (this._type === "input") return {
			type:        "input",
			slug:        this._slug,
			text:        this._text,
			placeholder: this._placeholder,
		};
		if (this._type === "pick") return {
			type:      "pick",
			pickCount: this._pickCount,
			options:   this._options,
		};
	}
}
