import { unusedEntrySlug } from "../../../utils/choiceGroupEdit.js";
import { warn } from "../../../utils/logger.js";

/**
 * What an improvement requires, as its author edits it: its rows, in the book's layout, and the rule
 * of each section.
 *
 * The book writes a rule as a heading line over the requirements it governs — "Requires 2 of the
 * following:" then three boxes, "And then:" then one — so a section is a run of requirement rows and
 * the line of text just above it is that run's heading. The improvement is finished when every
 * section is. That layout is already in every improvement's rows; this reads the sections out of the
 * rows and the stored `requires`, and writes `requires` back from them. Nothing else is stored.
 *
 * Immutable: every edit returns a new value, written whole.
 */

/** What one section asks for. `count` only for "some". */
export class SectionRule {
	static KINDS = ["all", "some", "none", "or"];

	constructor(kind = "all", count = null) {
		this.kind  = SectionRule.KINDS.includes(kind) ? kind : "all";
		this.count = this.kind === "some" ? (Number.isInteger(count) && count >= 1 ? count : 1) : null;
	}

	static all() { return new SectionRule("all"); }
}

/** One stored choice row: a line of text, or a requirement with boxes. */
export class ImprovementRow {
	/**
	 * @param raw  the stored row, carried whole so fields this does not edit survive
	 * @param rule the rule of the section this row leads, if it leads one — held here, never stored
	 */
	constructor(raw, rule = null) {
		this._raw = raw;
		this.rule = rule;
	}

	static line(text = "") {
		return new ImprovementRow({ type: "entry", content: { title: null, text }, track: null });
	}

	static requirement(slug, text = "") {
		return new ImprovementRow({ type: "entry", slug, content: { title: null, text }, track: { max: 1 } });
	}

	get slug()          { return this._raw.slug ?? null; }
	get text()          { return this._raw.content?.text ?? ""; }
	get boxes()         { return this._raw.track?.max ?? 0; }
	get isRequirement() { return Boolean(this._raw.track); }

	withText(text) {
		return new ImprovementRow({ ...this._raw, content: { ...this._raw.content, text } }, this.rule);
	}

	withBoxes(boxes) {
		const max = Number.isInteger(boxes) && boxes >= 1 ? boxes : 1;
		return new ImprovementRow({ ...this._raw, track: { ...this._raw.track, max } }, this.rule);
	}

	withRule(rule) { return new ImprovementRow(this._raw, rule); }

	toRaw() { return this._raw; }
}

export class ImprovementRequirements {
	/**
	 * @param group   the stored choice group, minus nothing — its slug and any other field survive
	 * @param rows    ImprovementRow[]
	 * @param wording what a heading's rule writes (`heading(rule, isFirst)` → words or null)
	 */
	constructor(group, rows, wording) {
		this._group   = group;
		this._rows    = rows;
		this._wording = wording;
	}

	/**
	 * Every writer the system has — the pack, the editor, the migration — stores sections of the rows,
	 * and tests hold each to it. A rule made outside the system is read as far as it can be: a section
	 * it cannot place is read as "all of these", and the improvement is named in a warning, since
	 * editing it will rewrite that rule.
	 *
	 * @param name the improvement's, for that warning
	 */
	static fromStored(choices, requires, wording, name = "") {
		const group = choices ?? { slug: null, list: [] };
		const rows  = (group.list ?? []).map(raw => new ImprovementRow(raw));
		const plain = new ImprovementRequirements(group, rows, wording);
		const { rules, placed } = rulesFrom(plain.sections.map(s => s.slugs), requires);
		if (!placed) warn(`Improvement "${name}": its requirement is not sections of its rows; editing it rewrites the sections it could not read as "all of these".`);
		const led = [...rows];
		plain.sections.forEach((s, i) => { led[s.lead] = led[s.lead].withRule(rules[i]); });
		return new ImprovementRequirements(group, led, wording);
	}

	get rows() { return this._rows; }

	/** A line of text directly over a requirement heads that requirement's section. */
	isHeading(row) {
		const i = this._rows.indexOf(row);
		return i >= 0 && !row.isRequirement && Boolean(this._rows[i + 1]?.isRequirement);
	}

	/** [{lead, heading, rowIndexes, slugs, rule, isFirst}], in order. */
	get sections() {
		const out = [];
		this._rows.forEach((row, i) => {
			if (!row.isRequirement) return;
			if (this._rows[i - 1]?.isRequirement) { out.at(-1).rowIndexes.push(i); out.at(-1).slugs.push(row.slug); return; }
			const heading = i > 0 && !this._rows[i - 1].isRequirement ? i - 1 : null;
			const lead = heading ?? i;
			out.push({ lead, heading, rowIndexes: [i], slugs: [row.slug], rule: this._rows[lead].rule ?? SectionRule.all(), isFirst: out.length === 0 });
		});
		return out;
	}

	/**
	 * The rows as the card groups them, in order: a section — its heading over its requirements — or
	 * a line of text standing alone. `rowIndexes` are the block's rows; a section's `lead` is the row
	 * its rule hangs on.
	 */
	get blocks() {
		const sections = this.sections;
		const out = [];
		for (let i = 0; i < this._rows.length; i++) {
			const section = sections.find(s => s.lead === i);
			if (section) {
				const rowIndexes = section.heading === null ? [...section.rowIndexes] : [section.heading, ...section.rowIndexes];
				out.push({ kind: "section", lead: section.lead, rowIndexes });
				i = rowIndexes.at(-1);
				continue;
			}
			out.push({ kind: "line", rowIndexes: [i] });
		}
		return out;
	}

	/** A requirement at the end of the section the row at `leadIndex` leads. */
	withRequirementAddedTo(leadIndex) {
		const section = this.sections.find(s => s.lead === leadIndex);
		if (!section) return this;
		const rows = [...this._rows];
		rows.splice(section.rowIndexes.at(-1) + 1, 0, ImprovementRow.requirement(unusedEntrySlug(this._rawList())));
		return this._withRows(rows);
	}

	/** A section gone whole: its heading and every requirement under it. */
	withSectionRemoved(leadIndex) {
		const block = this.blocks.find(b => b.kind === "section" && b.lead === leadIndex);
		if (!block) return this;
		return this._withRows(this._rows.filter((_, i) => !block.rowIndexes.includes(i)));
	}

	/**
	 * A heading gone: its requirements join the section above. A first section has nothing above it
	 * to join — a section never stands without its heading — so it goes whole.
	 */
	withHeadingRemoved(leadIndex) {
		const sections = this.sections;
		const at = sections.findIndex(s => s.lead === leadIndex);
		const section = sections[at];
		if (!section || section.heading === null) return this;
		const above = sections[at - 1];
		if (!above) return this.withSectionRemoved(leadIndex);
		const moving = section.rowIndexes.map(i => this._rows[i]);
		const rows = this._rows.filter((_, i) => i !== section.heading && !section.rowIndexes.includes(i));
		const after = rows.indexOf(this._rows[above.rowIndexes.at(-1)]);
		rows.splice(after + 1, 0, ...moving);
		return this._withRows(rows);
	}

	/** A block — a section whole, or a line — past its neighbouring block. */
	withBlockMoved(blockIndex, delta) {
		const blocks = this.blocks;
		const other  = blockIndex + delta;
		if (other < 0 || other >= blocks.length) return this;
		const order = blocks.map((_, i) => i);
		[order[blockIndex], order[other]] = [order[other], order[blockIndex]];
		return this._withRows(order.flatMap(i => blocks[i].rowIndexes.map(r => this._rows[r])));
	}

	/** A requirement past its neighbour in the SAME section; never out of it. */
	withRequirementMoved(index, delta) {
		const section = this.sections.find(s => s.rowIndexes.includes(index));
		if (!section || !section.rowIndexes.includes(index + delta)) return this;
		return this._withRowMoved(index, delta);
	}

	withLineAdded() {
		return this._withRows([...this._rows, ImprovementRow.line()]);
	}

	/** A new section: its heading, worded for where it lands, over one requirement. */
	withHeadingAdded() {
		const rule    = SectionRule.all();
		const isFirst = this.sections.length === 0;
		const heading = ImprovementRow.line(this._wording.heading(rule, isFirst) ?? "").withRule(rule);
		return this._withRows([...this._rows, heading, ImprovementRow.requirement(unusedEntrySlug(this._rawList()))]);
	}

	/** Set the rule of the section led by the row at `leadIndex`. */
	withSectionRule(leadIndex, rule) {
		const rows = [...this._rows];
		rows[leadIndex] = rows[leadIndex].withRule(rule);
		return this._withRows(rows);
	}

	withRowRemoved(index) {
		return this._withRows(this._rows.filter((_, i) => i !== index));
	}

	_withRowMoved(index, delta) {
		const other = index + delta;
		if (other < 0 || other >= this._rows.length) return this;
		const rows = [...this._rows];
		[rows[index], rows[other]] = [rows[other], rows[index]];
		return this._withRows(rows);
	}

	withRowText(index, text)   { return this._withRow(index, row => row.withText(text)); }
	withRowBoxes(index, boxes) { return this._withRow(index, row => row.withBoxes(boxes)); }

	toRequires() {
		const perSection = [];
		for (const section of this.sections) {
			const { kind, count } = section.rule;
			if (kind === "none") { perSection.push([]); continue; }
			if (kind === "some") { perSection.push([{ any: count, of: [...section.slugs] }]); continue; }
			if (kind === "or" && perSection.length) {
				const before = perSection.at(-1);
				const prev   = before.length === 1 ? before[0] : { all: before };
				perSection[perSection.length - 1] = [{ any: 1, of: [prev, { all: [...section.slugs] }] }];
				perSection.push([]);
				continue;
			}
			perSection.push([...section.slugs]);
		}
		const terms = perSection.flat();
		return terms.length === 1 && typeof terms[0] === "object" ? terms[0] : { all: terms };
	}

	toChoices() {
		return { ...this._group, list: this._rawList() };
	}

	_rawList() { return this._rows.map(row => row.toRaw()); }

	_withRow(index, change) {
		const rows = [...this._rows];
		rows[index] = change(rows[index]);
		return this._withRows(rows);
	}

	/**
	 * The new rows, with every heading still in its generated words reworded for where it now stands
	 * and what its rule now is. A heading in the author's own words is theirs, and is left alone.
	 */
	_withRows(rows) {
		const next = new ImprovementRequirements(this._group, rows, this._wording);
		const was  = new Map(this.sections.filter(s => s.heading !== null).map(s => [this._rows[s.heading], s]));
		const reworded = [...rows];
		for (const section of next.sections) {
			if (section.heading === null) continue;
			const row    = rows[section.heading];
			const before = was.get(row) ?? was.get(this._rows.find(r => r.toRaw() === row.toRaw()));
			const said   = before ? this._wording.heading(before.rule, before.isFirst) : null;
			const says   = this._wording.heading(section.rule, section.isFirst);
			if (said !== null && says !== null && row.text === said && said !== says) reworded[section.heading] = row.withText(says);
		}
		return new ImprovementRequirements(this._group, reworded, this._wording);
	}
}

/**
 * The rule of each section, read from the stored requirement, and whether every section — and every
 * term — was placed. A section that cannot be is read as "all of these".
 */
function rulesFrom(sections, requires) {
	const terms = requires == null ? []
		: typeof requires === "string" ? [requires]
		: Array.isArray(requires) ? requires
		: Array.isArray(requires.all) ? requires.all
		: Array.isArray(requires.of) ? [requires]
		: [];
	const named = JSON.stringify(requires ?? null);
	const same  = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
	const rules = [];
	let placed = true;
	let p = 0;
	for (let s = 0; s < sections.length; s++) {
		const slugs = sections[s];
		const term  = terms[p];
		if (term && typeof term === "object" && Array.isArray(term.of) && term.of.every(t => typeof t === "string") && same(term.of, slugs)) {
			rules.push(new SectionRule("some", Number.isInteger(term.any) ? term.any : 1)); p++; continue;
		}
		if (same(terms.slice(p, p + slugs.length), slugs)) {
			rules.push(SectionRule.all()); p += slugs.length; continue;
		}
		// "Requires either this: … Or all of these: …" — this section, OR the one after it.
		const next = sections[s + 1];
		if (next && term && typeof term === "object" && term.any === 1 && term.of?.length === 2
			&& JSON.stringify(term.of[0]) === JSON.stringify(slugs.length === 1 ? slugs[0] : { all: slugs })
			&& same(term.of[1]?.all ?? [], next)) {
			rules.push(SectionRule.all(), new SectionRule("or")); p++; s++; continue;
		}
		if (slugs.every(slug => !named.includes(`"${slug}"`))) { rules.push(new SectionRule("none")); continue; }
		rules.push(SectionRule.all());
		placed = false;
	}
	return { rules, placed: placed && p === terms.length };
}
