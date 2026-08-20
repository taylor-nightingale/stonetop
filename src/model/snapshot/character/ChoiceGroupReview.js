import { hasText, rich } from "../RichText.js";

// Picked words from one row of inline options read as fragments of a single description, so they
// are joined onto one line rather than listed.
const INLINE_SEPARATOR = " · ";

/** One reviewed line: what was chosen, the aside that qualifies it (an invocation's "(ongoing)"),
 *  and the text that belongs under it (a pick's description, a tracked entry's body). */
export class ReviewLine {
	constructor(text, detail = null, note = null) {
		this.text   = text;
		this.detail = detail;
		this.note   = note;
	}
}

/** A group's prose and the choices it introduces. Title and lead are the group's own words — the
 *  entry title and body the editor renders above those same rows — so the condensed view keeps the
 *  question a line is answering, not just the answer. */
export class ReviewBlock {
	constructor(title, titleNote, lead, lines) {
		this.title     = title;
		this.titleNote = titleNote;
		this.lead      = lead;
		this.lines     = lines;
	}
}

/**
 * A choice group with everything nobody chose taken out: prose that still introduces something,
 * and one line per ticked box, filled-in answer or picked option.
 *
 * Pure and group-shaped — it knows nothing about playbooks, inserts or arcana, so any surface that
 * renders a ChoiceGroup can render this instead (see ChoiceGroup#condensed).
 */
export function condenseChoiceGroup(group) {
	return new Condenser(group).run();
}

// The walk is stateful (prose is held until something under it is chosen, and consecutive inline
// pick rows merge into one line), so it lives in an object rather than a chain of parameters.
class Condenser {
	#blocks  = [];
	#pending = [];   // prose seen since the last line: {title, lead}
	#head    = null; // the prose this block opened with
	#lines   = [];
	#inline  = [];   // picked words from a run of inline rows, still being collected

	constructor(group) {
		this.rows = group?.list ?? [];
	}

	run() {
		for (const row of this.rows) {
			if (isProse(row)) this.#onProse(row);
			else if (row.type === "choice") this.#onPick(row);
			else this.#onEntry(row);
		}
		this.#closeBlock();
		return this.#blocks;
	}

	#onProse(row) {
		this.#closeBlock();
		this.#pending.push({
			title:     textOrNull(row.content?.title),
			titleNote: textOrNull(row.content?.titleNote),
			lead:      textOrNull(row.content?.text),
		});
	}

	#onPick(row) {
		const picked = row.options.filter(isPicked);
		if (!picked.length) return;
		if (row.inline) {
			this.#inline.push(...picked.map(optionText).filter(t => t.length));
			return;
		}
		this.#closeInline();
		for (const option of picked)
			this.#addLine(new ReviewLine(rich(optionText(option)),
				hasText(option.description) ? option.description : null));
	}

	#onEntry(row) {
		const label = labelOf(row.content ?? {});
		if (row.input && hasText(row.input.value)) {
			// A write-in is its own block: the row's own words are the question, the answer is the line.
			this.#closeBlock();
			this.#pending.push({ title: null, titleNote: null, lead: label.text });
			this.#addLine(new ReviewLine(rich(row.input.value)));
			this.#closeBlock();
			return;
		}
		if (!(row.track?.checks ?? []).some(Boolean)) return;
		this.#closeInline();
		this.#addLine(new ReviewLine(label.text ?? rich(""), label.body, label.note));
	}

	// Prose only earns its place once something under it is reviewed: the nearest prose opens this
	// block, anything above it stands alone (a group heading over a question that got skipped).
	#addLine(line) {
		if (!this.#lines.length) {
			this.#head = this.#pending.pop() ?? null;
			for (const orphan of this.#pending) this.#blocks.push(blockOf(orphan, []));
			this.#pending = [];
		}
		this.#lines.push(line);
	}

	#closeInline() {
		if (!this.#inline.length) return;
		const joined = this.#inline.join(INLINE_SEPARATOR);
		this.#inline = [];
		this.#addLine(new ReviewLine(rich(joined)));
	}

	#closeBlock() {
		this.#closeInline();
		if (this.#lines.length) this.#blocks.push(blockOf(this.#head, this.#lines));
		this.#head  = null;
		this.#lines = [];
	}
}

function blockOf(head, lines) {
	return new ReviewBlock(head?.title ?? null, head?.titleNote ?? null, head?.lead ?? null, lines);
}

// Prose: a row that asks or explains rather than recording anything — nothing to tick, write in,
// or grant.
function isProse(row) {
	return row.type === "entry" && !row.track && !row.input && !row.followers && !row.moves
		&& (hasText(row.content?.title) || hasText(row.content?.text));
}

function textOrNull(value) {
	return hasText(value) ? value : null;
}

// What names an entry row: its title, else the subtitle the editor renders as the row's sub-heading
// (an invocation's name lives there, with `title` null), else the body text itself. Whichever names
// it brings its own note along, and the body text drops underneath — a condensed invocation has to
// read "Blinding Light (ongoing)", not open with its rules paragraph.
function labelOf(content) {
	if (hasText(content.title))
		return { text: content.title, note: textOrNull(content.titleNote), body: textOrNull(content.text) };
	if (hasText(content.subtitle))
		return { text: content.subtitle, note: textOrNull(content.subtitleNote), body: textOrNull(content.text) };
	return { text: textOrNull(content.text), note: null, body: null };
}

// Count-mode options carry a checks array instead of a single flag.
function isPicked(option) {
	return option.checked || (option.checks ?? []).some(Boolean);
}

// A fill-in option's answer IS its text; a plain option's is its label.
function optionText(option) {
	return option.type === "input" ? (option.fillValue ?? "").trim() : rich(option.text).raw.trim();
}
