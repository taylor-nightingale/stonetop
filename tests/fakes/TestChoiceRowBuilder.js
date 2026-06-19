import { migrateChoiceRow } from "../../src/migration/migrateChoices.js";

export class TestChoiceRowBuilder {
	_type;
	_slug          = null;
	_track         = null;
	_title         = null;
	_contentTitle  = null;
	_contentText   = null;
	_note          = null;
	_placeholder   = null;
	_input         = null;
	_options       = [];
	_pickCount     = 1;
	_inlineDisplay = false;
	_followers     = [];
	_outfitItems   = null;

	static entry()    { return new TestChoiceRowBuilder().withType("entry"); }
	static heading()  { return new TestChoiceRowBuilder().withType("heading"); }
	static follower() { return new TestChoiceRowBuilder().withType("follower"); }
	static pick()     { return new TestChoiceRowBuilder().withType("pick"); }

	withType(type)               { this._type          = type;           return this; }
	withSlug(slug)               { this._slug          = slug;           return this; }
	withTitle(title)             { this._title         = title;          return this; }
	withContentTitle(title)      { this._contentTitle  = title;          return this; }
	withContentText(text)        { this._contentText   = text;           return this; }
	withNote(note)               { this._note          = note;           return this; }
	withTrack(max)               { this._track         = { max };        return this; }
	withPlaceholder(placeholder) { this._placeholder   = placeholder;    return this; }
	withInput(placeholder)       { this._input         = { placeholder }; return this; }
	withPickCount(n)             { this._pickCount      = n;             return this; }
	withInlineDisplay(inline)    { this._inlineDisplay  = inline;        return this; }
	withOptions(...options)      { this._options        = options.flat(); return this; }
	withFollowers(...slugs)      { this._followers      = slugs.flat();  return this; }
	withOutfitItems(items)       { this._outfitItems    = items;         return this; }

	build() {
		const row = this._buildRaw();
		return row.type === "pick" ? row : migrateChoiceRow(row);
	}

	_buildRaw() {
		if (this._type === "entry") return {
			type:          "entry",
			slug:          this._slug,
			content:       { title: this._contentTitle, text: this._contentText },
			note:          this._note,
			track:         this._track,
			input:         this._input,
			...(this._followers.length   ? { followers: this._followers }     : {}),
			...(this._outfitItems        ? { outfitItems: this._outfitItems } : {}),
			...(this._inlineDisplay      ? { inlineDisplay: this._inlineDisplay } : {}),
		};
		if (this._type === "heading") return {
			type:    "heading",
			slug:    this._slug,
			content: { title: this._contentTitle, text: this._contentText },
			note:    this._note,
			track:   this._track,
			input:   this._input,
		};
		if (this._type === "follower") return {
			type:          "follower",
			slug:          this._slug,
			title:         this._title ?? "",
			inlineDisplay: this._inlineDisplay,
			track:         this._track ?? { max: 1 },
		};
		if (this._type === "pick") return {
			type:      "pick",
			pickCount: this._pickCount,
			options:   this._options,
		};
	}
}
