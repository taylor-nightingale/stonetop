import { capitalizeFirst, parseInstinct } from "../utils/strings.js";

// ── Appearance ────────────────────────────────────────────────────────────────

/** One selectable option within an appearance line. */
export class AppearanceOptionSnapshot {
	constructor(value, selected) {
		this.value    = value;
		this.selected = selected;
	}
}

/** One line of appearance options (e.g. "tall and broad / lean and wiry / slight"). */
export class AppearanceLineSnapshot {
	constructor(lineIdx, options) {
		this.lineIdx = lineIdx;
		this.options = options;
	}
}

/** The full appearance section on PlaybookSnapshot. */
export class AppearanceSection {
	constructor(options) {
		this.options = options;
	}
	get summary() {
		const selected = this.options
			.map(line => line.options.find(o => o.selected)?.value)
			.filter(Boolean);
		if (selected.length === 0) return "";
		return capitalizeFirst(selected.join(" · "));
	}
}

// ── Instinct ──────────────────────────────────────────────────────────────────

/**
 * One instinct option.
 * @property {string} word
 * @property {string} description
 * @property {string} value  - composite "word — description" used as the saved value
 * @property {boolean} selected
 */
export class InstinctOptionSnapshot {
	constructor(b) {
		this.word        = b._word;
		this.description = b._description;
		this.value       = b._value;
		this.selected    = b._selected;
	}
	get tooltip() {
		const d = this.description ?? "";
		return d ? "Instinct " + d.charAt(0).toLowerCase() + d.slice(1) : "";
	}
}

export class InstinctOptionSnapshotBuilder {
	withWord(v)        { this._word        = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withValue(v)       { this._value       = v; return this; }
	withSelected(v)    { this._selected    = v; return this; }
	build()            { return new InstinctOptionSnapshot(this); }
}

/** The instinct section on PlaybookSnapshot. */
export class InstinctSection {
	constructor(selected, options) {
		this.selected = selected;
		this.options  = options;
	}
	get selectedOption() { return this.options.find(o => o.selected) ?? null; }
	get hasSelection()   { return !!this.selected || !!this.selectedOption; }
	// When the saved value isn't one of the playbook's suggestions, it's a
	// custom "Word — Description" instinct; expose its halves for the editor.
	get isCustom()           { return !!this.selected && !this.options.some(o => o.value === this.selected); }
	get customWord()         { return this.isCustom ? parseInstinct(this.selected).word : ""; }
	get customDescription()  { return this.isCustom ? parseInstinct(this.selected).description : ""; }
}

// ── Origin ────────────────────────────────────────────────────────────────────

/** One origin region option. */
export class OriginOptionSnapshot {
	constructor(region, names, selected, description = "") {
		this.region      = region;
		this.names       = names; // { name: string, checked: boolean }[]
		this.selected    = selected;
		this.description = description;
	}
}

/** The origin section on PlaybookSnapshot. */
export class OriginSection {
	constructor(selected, options) {
		this.selected = selected;
		this.options  = options;
	}
	get selectedOption() { return this.options.find(o => o.selected) ?? null; }
}

// ── Background ────────────────────────────────────────────────────────────────

/** One choice within a background's optional choice list. */
export class BackgroundChoiceOptionSnapshot {
	constructor(slug, label, checked) {
		this.slug    = slug;
		this.label   = label;
		this.checked = checked;
	}
}

/**
 * The choices sub-object on a BackgroundOptionSnapshot.
 * @property {string} label
 * @property {number[]} count
 * @property {string} countLabel
 * @property {BackgroundChoiceOptionSnapshot[]} options
 * @property {Object.<string,boolean>} saved
 */
export class BackgroundChoicesSnapshot {
	constructor(b) {
		this.label      = b._label;
		this.count      = b._count;
		this.countLabel = b._countLabel;
		this.options    = b._options;
		this.saved      = b._saved;
	}
}

export class BackgroundChoicesSnapshotBuilder {
	withLabel(v)      { this._label      = v; return this; }
	withCount(v)      { this._count      = v; return this; }
	withCountLabel(v) { this._countLabel = v; return this; }
	withOptions(v)    { this._options    = v; return this; }
	withSaved(v)      { this._saved      = v; return this; }
	build()           { return new BackgroundChoicesSnapshot(this); }
}

/**
 * One background option on PlaybookSnapshot.background.
 * @property {string} slug
 * @property {string} label
 * @property {string} description
 * @property {boolean} selected
 * @property {string[]} moves - move slugs granted by this background
 * @property {BackgroundChoicesSnapshot|null} choices
 */
export class BackgroundOptionSnapshot {
	constructor(b) {
		this.slug        = b._slug;
		this.label       = b._label;
		this.description = b._description;
		this.selected    = b._selected;
		this.moves       = b._moves;
		this.choices     = b._choices;
		this.setupTexts  = b._setupTexts;
		this.setupResources = b._setupResources;
		// Level-gated markable actions (Beast-Bonded), or null when the background
		// has none. { allowed, markedCount, options: [{slug, label, checked, disabled}] }.
		this.markableActions = b._markableActions ?? null;
	}
}

export class BackgroundOptionSnapshotBuilder {
	withSlug(v)        { this._slug        = v; return this; }
	withLabel(v)       { this._label       = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withSelected(v)    { this._selected    = v; return this; }
	withMoves(v)       { this._moves       = v; return this; }
	withChoices(v)     { this._choices     = v; return this; }
	withSetupTexts(v)  { this._setupTexts  = v; return this; }
	withSetupResources(v) { this._setupResources = v; return this; }
	withMarkableActions(v) { this._markableActions = v; return this; }
	build()            { return new BackgroundOptionSnapshot(this); }
}

/** The background section on PlaybookSnapshot. */
export class BackgroundSection {
	constructor(selected, options) {
		this.selected = selected;
		this.options  = options;
	}
}

// ── Lore ──────────────────────────────────────────────────────────────────────

export class LoreOptionSnapshot {
	constructor(b) {
		this.slug        = b._slug;
		this.description = b._description;
		this.readonlyDescription = _stripLeadingEllipsis(b._description);
		this.type        = b._type ?? "checkbox";
		this.max         = this.type === "text" ? 0 : (b._max ?? 1);
		this.count       = this.type === "text" ? 0 : (b._count ?? 0);
		this.checks      = this.type === "text" ? [] : Array.from({ length: this.max }, (_, i) => i < this.count);
		this.textValue   = this.type === "text" ? (b._textValue ?? "") : null;
		this.requires    = b._requires ?? null;
		// Seeker Minor Arcana: per-question card picker ({ role, options, selectedSlug, selectedName, muted }).
		this.arcanaPicker = b._arcanaPicker ?? null;
		// A text option counts as answered only if it holds a real value — blank or a
		// "to be written" placeholder is treated as unanswered (hidden in read-only).
		this.hasAnswer   = this.type === "text" ? _hasRealLoreAnswer(this.textValue) : this.count > 0;
	}
}

// Text answers matching one of these (case-insensitive, ignoring trailing
// punctuation) are treated as unanswered placeholders, not real answers.
const PLACEHOLDER_LORE_ANSWERS = new Set(["to be written"]);

function _hasRealLoreAnswer(value) {
	const t = String(value ?? "").trim().toLowerCase().replace(/[.\s]+$/, "");
	return t !== "" && !PLACEHOLDER_LORE_ANSWERS.has(t);
}

export class LoreOptionSnapshotBuilder {
	withSlug(v)        { this._slug        = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withType(v)        { this._type        = v; return this; }
	withMax(v)         { this._max         = v; return this; }
	withCount(v)       { this._count       = v; return this; }
	withTextValue(v)   { this._textValue   = v; return this; }
	withRequires(v)    { this._requires    = v; return this; }
	withArcanaPicker(v) { this._arcanaPicker = v; return this; }
	build()            { return new LoreOptionSnapshot(this); }
}

export class LoreEntrySnapshot {
	constructor(b) {
		this.slug        = b._slug;
		this.title       = b._title;
		this.description = b._description;
		this.options     = b._options;
		this.columnBreak = b._columnBreak ?? false;
		// In read-only, a `readonlyMerge` continuation (e.g. the Marshal/Ranger
		// "Answer at least 3…" follow-up questions) flows into the preceding column
		// with its title hidden, so the answers sit directly under the choice they
		// relate to instead of stranding a lopsided, half-empty second column.
		this.readonlyMerge = b._readonlyMerge ?? false;
		this.subheader   = b._subheader ?? false;
		// Seeker Major Arcanum: { slug, name, img } of the chosen arcanum, shown below the heading.
		this.arcanaImage = b._arcanaImage ?? null;
		this.selectedCount = this.options.reduce((sum, o) => sum + (o.type === "text" ? (o.hasAnswer ? 1 : 0) : o.count), 0);
		this.requiredCount = _pickCountFromDescription(this.description);
		this.isAnswered = this.requiredCount <= 0 ? this.hasSelection : this.selectedCount >= this.requiredCount;
		this.readonlyDescription = _stripChoosePrompt(this.description);
		this.readonlyMarker = _readonlyMarkerForEntry(this);
		// Explicit `continuation` wins; fall back to the title/`alas` heuristic for
		// un-annotated lore (e.g. PDF-imported data and post-death inserts).
		this.isContinuation = b._continuation ?? _isContinuationLoreEntry(this);
	}
	get hasSelection() {
		return this.options.some(o => o.hasAnswer);
	}
	// Whether this entry starts a new column in read-only. A `readonlyMerge` entry
	// keeps the edit-mode column break (so the long question list sits beside the
	// choice while filling it in) but collapses back into one column read-only.
	get readonlyColumnBreak() {
		return this.columnBreak && !this.readonlyMerge;
	}
	// True when any option has an assigned arcana card (Seeker Minor Arcana), so the
	// read-only entry still renders to show the assignment even with no written note.
	get hasArcanaSelection() {
		return this.options.some(o => !!o.arcanaPicker?.selectedSlug);
	}
	// Whether this entry should render in read-only: it was answered, or it's an
	// always-show structural entry (subheader column / chosen arcana image).
	get showInReadonly() {
		return this.hasSelection || this.hasArcanaSelection || !!this.arcanaImage || this.subheader;
	}
}

export class LoreEntrySnapshotBuilder {
	withSlug(v)        { this._slug        = v; return this; }
	withTitle(v)       { this._title       = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withOptions(v)     { this._options     = v; return this; }
	withColumnBreak(v) { this._columnBreak = v; return this; }
	withReadonlyMerge(v) { this._readonlyMerge = v; return this; }
	withContinuation(v) { this._continuation = v; return this; }
	withSubheader(v)   { this._subheader   = v; return this; }
	withArcanaImage(v) { this._arcanaImage = v; return this; }
	build()            { return new LoreEntrySnapshot(this); }
}

export class LoreSection {
	constructor(entries) {
		this.entries = entries;
		// Read once per entry inside the lore-section render loop, so precompute to keep it O(1).
		this.hasColumnBreak = entries.some(e => e.columnBreak);
		// Read-only counterpart: ignores breaks that merge away (see readonlyColumnBreak),
		// so a section whose only break is a merged one renders as a single full-width column.
		this.hasReadonlyColumnBreak = entries.some(e => e.readonlyColumnBreak);
	}

	get hasEntries() {
		return this.entries.length > 0;
	}

	get hasSelection() {
		return this.entries.some(e => e.hasSelection);
	}

	// Whether the read-only lore section should render at all — true if any entry is
	// shown in read-only (answered, or an always-show structural entry).
	get hasReadonlyContent() {
		return this.entries.some(e => e.showInReadonly);
	}
}

// ── Playbook ──────────────────────────────────────────────────────────────────

function _stripLeadingEllipsis(description = "") {
	return String(description)
		.replace(/^(\s*(?:<p[^>]*>\s*)?)(?:\.{3}|&hellip;|\u2026)\s*/i, "$1")
		.trim();
}

function _stripChoosePrompt(description = "") {
	return String(description)
		.replace(/<p>\s*<em>\s*\((?:choose|pick)[^)]*\)\s*<\/em>\s*<\/p>/gi, "")
		.replace(/\s*<em>\s*\((?:choose|pick)[^)]*\)\s*<\/em>/gi, "")
		// Drop "Answer at least N …" instruction paragraphs (e.g. under the Seeker's
		// Major Arcanum) — they're prompts for filling in, not content to display.
		.replace(/<p>\s*answer at least \d+[^<]*<\/p>/gi, "")
		.trim();
}

function _pickCountFromDescription(description = "") {
	const text = String(description)
		.replace(/<[^>]*>/g, " ")
		.replace(/&ndash;/g, "-")
		.replace(/&mdash;/g, "-")
		.replace(/\s+/g, " ");
	const match = text.match(/\b(?:choose|pick)\s+(\d+)/i);
	return match ? Number(match[1]) : 0;
}

export function loreMarkerForText(title, description) {
	const text = `${title ?? ""} ${description ?? ""}`;
	if (/\balas\b/i.test(text)) return "-";
	if (/\bplus side\b/i.test(text)) return "+";
	return "spiral";
}

function _readonlyMarkerForEntry(entry) {
	return loreMarkerForText(entry.title, entry.description);
}

function _isContinuationLoreEntry(entry) {
	const text = `${entry.title ?? ""} ${entry.description ?? ""}`;
	return /\balas\b/i.test(text) || _isContinuationLoreTitle(entry.title);
}

function _isContinuationLoreTitle(title = "") {
	const text = String(title).toLowerCase();
	return [
		"and you ended up",
		"but all you've got left",
		"but folks are less keen",
		"what keeps you up at night",
		"offerings to danu",
		"he is worshipped through",
		"in stonetop's pavilion of the gods",
		"your predecessor",
		"you came into your powers",
		"answer at least",
		"of her true disciples",
		"what makes you burn",
		"when did your fear or anger",
	].some(pattern => text.includes(pattern));
}

/**
 * @property {string} slug
 * @property {string} name
 * @property {string|null} img
 * @property {string|null} description
 * @property {string|null} statsNote
 * @property {LoreSection} lore
 * @property {BackgroundSection} background
 * @property {InstinctSection} instinct
 * @property {AppearanceSection} appearance
 * @property {OriginSection} origin
 */
export class PlaybookSnapshot {
	constructor(b) {
		this.slug        = b._slug;
		this.name        = b._name;
		this.img         = b._img;
		this.description = b._description;
		this.statsNote   = b._statsNote;
		this.lore        = b._lore;
		this.background  = b._background;
		this.instinct    = b._instinct;
		this.appearance  = b._appearance;
		this.origin      = b._origin;
	}
}

export class PlaybookSnapshotBuilder {
	withSlug(v)        { this._slug        = v; return this; }
	withName(v)        { this._name        = v; return this; }
	withImg(v)         { this._img         = v; return this; }
	withDescription(v) { this._description = v; return this; }
	withStatsNote(v)   { this._statsNote   = v; return this; }
	withLore(v)        { this._lore        = v; return this; }
	withBackground(v)  { this._background  = v; return this; }
	withInstinct(v)    { this._instinct    = v; return this; }
	withAppearance(v)  { this._appearance  = v; return this; }
	withOrigin(v)      { this._origin      = v; return this; }
	build()            { return new PlaybookSnapshot(this); }
}
