import { Seasons } from "./Seasons.js";
import { EFFECT_LISTS, EFFECT_SET_TARGETS } from "./ImprovementEffect.js";
import { SteadingDefaults } from "./SteadingDefaults.js";

/**
 * One of an improvement's results — a stored `system.effects` entry — as its author edits it.
 *
 * ImprovementEffect is what a steading evaluates; this is the same stored shape seen from the other
 * side, with a `with`-method for each thing the editor changes. The raw entry is carried whole, so a
 * field the editor does not touch (a narrowed requirement, a step adjustment) survives every edit.
 */
const MECHANICS = ["change", "set", "listEntry", "advantage", "grantsMove", "adjustment"];
const AUTHORED  = ["nothing", "change", "list", "set"];

export class ImprovementResult {
	constructor(raw) {
		this._raw = raw ?? {};
	}

	static fromRaw(raw) { return new ImprovementResult(raw); }

	/** A new result under "When you meet the requirements". */
	static onCompletion() { return new ImprovementResult({ when: { kind: "completed" }, text: "" }); }

	/** A new result under "Henceforth", every season until the author says otherwise. */
	static henceforth() {
		return new ImprovementResult({ when: { kind: "turn", seasons: Seasons.all().map(s => s.key) }, text: "" });
	}

	get text()    { return this._raw.text ?? ""; }
	get phrase()  { return this._raw.when?.phrase ?? null; }
	get seasons() { return this._raw.when?.seasons ?? []; }
	get moment()  { return this._raw.when?.moment ?? null; }
	/** The words naming a moment this result's author made up; null for one of the book's. */
	get momentName() { return typeof this._raw.when?.momentName === "string" ? this._raw.when.momentName : null; }
	get isNamedMoment() { return this.momentName !== null; }
	get outcome() { return this._raw.outcome || null; }

	/**
	 * completed · turn · moment · standing — completed, but holding for as long as the improvement
	 * stands and stated under Henceforth. Known by its flag, which it carries from the moment it is
	 * chosen; the book's also carry their clause, but a new one has no words yet.
	 */
	get when() {
		const kind = this._raw.when?.kind ?? "completed";
		if (kind === "completed" && (this._raw.condition || this.phrase)) return "standing";
		return ["turn", "moment"].includes(kind) ? kind : "completed";
	}

	/** The card's split: a completion result is "when finished", with no clause of its own. */
	get isCompletion() { return this.when === "completed"; }

	/** nothing · change · list · set · advantage · move · adjustment */
	get does() {
		if (this._raw.change)     return "change";
		if (this._raw.listEntry)  return "list";
		if (this._raw.set)        return "set";
		if (this._raw.advantage)  return "advantage";
		if (this._raw.grantsMove) return "move";
		if (this._raw.adjustment) return "adjustment";
		return "nothing";
	}

	/** Whether the editor can change what the sheet does, or only keep it as stored. */
	get isMechanicEditable() { return AUTHORED.includes(this.does); }

	get rating()    { return this._raw.change?.target ?? this._raw.set?.target ?? null; }
	get amount()    { return this._raw.change?.amount ?? null; }
	get setValue()  { return this._raw.set?.value ?? null; }
	get list()      { return this._raw.listEntry?.list ?? null; }
	get entry()     { return this._raw.listEntry?.text ?? ""; }
	get grantsMove(){ return this._raw.grantsMove || null; }

	withText(text) { return this._with({ text }); }

	withDoes(kind) {
		if (!AUTHORED.includes(kind) || kind === this.does) return this;
		const raw = { ...this._raw };
		for (const key of MECHANICS) delete raw[key];
		if (kind === "change") raw.change    = { target: "fortunes", amount: 1 };
		if (kind === "list")   raw.listEntry = { list: EFFECT_LISTS[0], text: "" };
		if (kind === "set")    raw.set       = { target: "size", value: SteadingDefaults.rating("size").values[0] };
		return new ImprovementResult(raw);
	}

	withRating(target) {
		if (this._raw.change) return this._with({ change: { ...this._raw.change, target } });
		if (this._raw.set && EFFECT_SET_TARGETS.includes(target)) {
			const values = SteadingDefaults.rating(target).values;
			return this._with({ set: { target, value: values ? values[0] : 0 } });
		}
		return this;
	}

	withAmount(amount) {
		return this._raw.change && Number.isInteger(amount) ? this._with({ change: { ...this._raw.change, amount } }) : this;
	}

	withSetValue(value) { return this._raw.set ? this._with({ set: { ...this._raw.set, value } }) : this; }
	withList(list)      { return this._raw.listEntry ? this._with({ listEntry: { ...this._raw.listEntry, list } }) : this; }
	withEntry(text)     { return this._raw.listEntry ? this._with({ listEntry: { ...this._raw.listEntry, text } }) : this; }

	withWhen(kind) {
		const phrase = this.phrase ? { phrase: this.phrase } : {};
		const raw = { ...this._raw };
		delete raw.condition;
		if (kind === "turn")     raw.when = { kind, seasons: this.seasons.length ? this.seasons : Seasons.all().map(s => s.key), ...phrase };
		// Which moment is chosen after its seasons, from the moments improvements already use in them.
		else if (kind === "moment") raw.when = { kind, seasons: [...this.seasons], ...(this.moment ? { moment: this.moment } : {}), ...phrase };
		else if (kind === "standing") { raw.when = { kind: "completed", phrase: this.phrase ?? "" }; raw.condition = true; }
		else raw.when = { kind: "completed" };
		return new ImprovementResult(raw);
	}

	withSeasons(seasons) { return this._withWhenField({ seasons: [...seasons] }); }
	/** A moment results already use: the book's, by key alone; another author's, with its name. */
	withMoment(moment, name = null) {
		const when = { ...(this._raw.when ?? { kind: "moment" }), moment };
		if (name === null) delete when.momentName; else when.momentName = name;
		return this._with({ when });
	}

	/** A moment of this result's own, under a slug of its own — the words are its author's. */
	withNewMoment() { return this.withMoment(`custom-moment-${foundry.utils.randomID(8)}`, ""); }

	withMomentName(name) { return this.isNamedMoment ? this._withWhenField({ momentName: name }) : this; }

	/**
	 * The moment as its author typed it. A name matching a moment results already use links to that
	 * moment's slug — the name is only how it was found, never what is stored as the link. Any other
	 * name is this result's own moment: renamed in place if it already has one no other improvement
	 * uses, so this improvement's other results at it stay linked; made fresh otherwise, so a moment
	 * another improvement shares is never renamed out from under it.
	 *
	 * @param known [{key, label, name, shared}] — label as the author sees it; name null for the
	 *              book's; shared when another improvement fires at it
	 */
	withMomentNamed(text, known = []) {
		const typed = String(text ?? "").trim();
		if (!typed) {
			const when = { ...(this._raw.when ?? { kind: "moment" }) };
			delete when.moment;
			delete when.momentName;
			return this._with({ when });
		}
		const match = known.find(m => m.label.trim().toLowerCase() === typed.toLowerCase());
		if (match) return this.withMoment(match.key, match.name);
		const current = known.find(m => m.key === this.moment);
		if (this.isNamedMoment && !current?.shared) return this.withMomentName(typed);
		return this.withNewMoment().withMomentName(typed);
	}
	withPhrase(phrase)   { return this._withWhenField({ phrase }); }

	withOutcome(label) {
		const raw = { ...this._raw };
		if (label) raw.outcome = label; else delete raw.outcome;
		return new ImprovementResult(raw);
	}

	toRaw() { return this._raw; }

	_with(fields) { return new ImprovementResult({ ...this._raw, ...fields }); }

	_withWhenField(fields) { return this._with({ when: { ...(this._raw.when ?? { kind: "completed" }), ...fields } }); }
}
