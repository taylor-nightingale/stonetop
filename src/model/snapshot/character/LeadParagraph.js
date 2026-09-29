/**
 * A text's first paragraph, and the paragraphs after it — raw markdown, split at the first blank
 * line. An entry whose blank answers its opening sentence (a Terrible Purpose's "Name the person or
 * persons you refuse to let go of.") draws the lead, the blank, then the rest.
 */
export class LeadParagraph {
	constructor(lead, rest) {
		this.lead = lead;
		this.rest = rest;
	}

	/** @param {string|null|undefined} text */
	static of(text) {
		const source = text ?? "";
		const brk = /[ \t]*\n[ \t]*\n\s*/.exec(source);
		return brk
			? new LeadParagraph(source.slice(0, brk.index), source.slice(brk.index + brk[0].length))
			: new LeadParagraph(source, "");
	}
}
