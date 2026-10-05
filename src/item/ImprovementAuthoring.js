import { ImprovementRequirements, SectionRule } from "../model/data/steading/ImprovementRequirements.js";
import { ImprovementResult } from "../model/data/steading/ImprovementResult.js";
import { ImprovementWording } from "../model/data/steading/ImprovementWording.js";
import { ImprovementExample } from "./ImprovementExample.js";

/**
 * An `improvement` item as its author edits it. The improvement sheet reads the DOM and calls one
 * method here; nothing else writes the item's rows, requirement or results.
 *
 * Words a choice generates are rewritten when the choice changes, as long as they are still the
 * generated words. Words the author wrote are theirs, and a choice never overwrites them.
 */
export class ImprovementAuthoring {
	constructor(item, wording = new ImprovementWording()) {
		this._item    = item;
		this._wording = wording;
	}

	get requirements() {
		return ImprovementRequirements.fromStored(this._item.system?.choices, this._item.system?.requires, this._wording, this._item.name);
	}

	get results() {
		return (this._item.system?.effects ?? []).map(ImprovementResult.fromRaw);
	}

	get wording() { return this._wording; }

	rename(name) { return this._item.update({ name }); }

	/**
	 * A brand-new improvement in the world starts as the example, under a slug of its own — random,
	 * not name-derived, so a rename cannot collide. A copy or an import already has its content, and
	 * one on an actor or in a pack is not being authored. The example's name replaces only the name
	 * core made up, never one the author typed.
	 */
	onPreCreate(data, example = new ImprovementExample()) {
		const item = this._item;
		if (item.parent || item.pack || item.system?.slug || item.system?.choices?.list?.length) return;
		const changes = { system: example.system(`custom-improvement-${foundry.utils.randomID(8)}`) };
		const madeUp  = item.constructor.defaultName?.({ type: item.type });
		if (example.name && data?.name === madeUp) changes.name = example.name;
		item.updateSource(changes);
	}

	// ── Rows ──────────────────────────────────────────────────────────────────────────────────────
	//
	// The card groups its rows: a section is its heading over its requirements, and a line of text
	// stands alone. Requirements are added to a section and move within it; a section moves whole.

	addHeading()                     { return this._writeRequirements(this.requirements.withHeadingAdded()); }
	addLine()                        { return this._writeRequirements(this.requirements.withLineAdded()); }
	addRequirementTo(leadIndex)      { return this._writeRequirements(this.requirements.withRequirementAddedTo(leadIndex)); }
	removeRow(index)                 { return this._writeRequirements(this.requirements.withRowRemoved(index)); }
	removeSection(leadIndex)         { return this._writeRequirements(this.requirements.withSectionRemoved(leadIndex)); }
	removeHeading(leadIndex)         { return this._writeRequirements(this.requirements.withHeadingRemoved(leadIndex)); }
	moveBlock(blockIndex, delta)     { return this._writeRequirements(this.requirements.withBlockMoved(blockIndex, delta)); }
	moveRequirement(index, delta)    { return this._writeRequirements(this.requirements.withRequirementMoved(index, delta)); }
	setRowText(index, text)          { return this._writeRequirements(this.requirements.withRowText(index, text)); }

	stepBoxes(index, delta) {
		const reqs = this.requirements;
		return this._writeRequirements(reqs.withRowBoxes(index, reqs.rows[index].boxes + delta));
	}

	/** The rule of the section the row at `leadIndex` heads. */
	setSectionRule(leadIndex, kind, count = null) {
		return this._writeRequirements(this.requirements.withSectionRule(leadIndex, new SectionRule(kind, count)));
	}

	useGeneratedHeading(leadIndex) {
		const reqs    = this.requirements;
		const section = reqs.sections.find(s => s.lead === leadIndex);
		const words   = section ? this._wording.heading(section.rule, section.isFirst) : null;
		return words === null ? undefined : this._writeRequirements(reqs.withRowText(leadIndex, words));
	}

	// ── Results ───────────────────────────────────────────────────────────────────────────────────

	/** A result not yet written, for "completion" or "henceforth" — what the adder edits until Add. */
	static draftFor(half) {
		return half === "henceforth" ? ImprovementResult.henceforth() : ImprovementResult.onCompletion();
	}

	/** Write a drafted result at the end of the results. */
	addResult(draft) {
		return this._writeResults([...this.results, draft]);
	}

	removeResult(index) {
		return this._writeResults(this.results.filter((_, i) => i !== index));
	}

	/** Step past the next result in the SAME half — the card lists them by half. */
	moveResult(index, delta) {
		const results = [...this.results];
		const half    = results[index]?.isCompletion;
		let other = index + delta;
		while (other >= 0 && other < results.length && results[other].isCompletion !== half) other += delta;
		if (other < 0 || other >= results.length) return undefined;
		[results[index], results[other]] = [results[other], results[index]];
		return this._writeResults(results);
	}

	setResultText(index, text) {
		return this._writeResults(this._resultsWith(index, r => r.withText(text)));
	}

	useGeneratedResultWords(index) {
		const words = this._wording.result(this.results[index]);
		return words === null ? undefined : this.setResultText(index, words);
	}

	/**
	 * A change to one result's choices — an ImprovementResult `with…` — written with its words
	 * following the choice while they are still the generated ones (ImprovementWording.follow).
	 */
	changeResult(index, change) {
		return this._writeResults(this._resultsWith(index, before => this._wording.follow(before, change(before))));
	}

	// ── Writing ───────────────────────────────────────────────────────────────────────────────────

	_resultsWith(index, change) {
		return this.results.map((r, i) => (i === index ? change(r) : r));
	}

	_writeResults(results) {
		return this._item.update({ "system.effects": results.map(r => r.toRaw()) });
	}

	/**
	 * `requires` is an ObjectField, which Foundry merges: a write that drops a key (`all` → `any`/`of`)
	 * would keep it. So a change of shape clears the field first.
	 */
	async _writeRequirements(next) {
		const requires = next.toRequires();
		const stored   = this._item.system?.requires;
		const dropsKey = stored && typeof stored === "object" && Object.keys(stored).some(key => !(key in requires));
		if (dropsKey) await this._item.update({ "system.requires": null });
		await this._item.update({ "system.choices": next.toChoices(), "system.requires": requires });
	}
}
