import { rich, hasText } from "../RichText.js";
import { plainText } from "../../../utils/plainText.js";

const SEPARATOR = " · ";

/**
 * What a character looks like, as one line under the instinct (D7): every chosen appearance
 * option, and anything written in, joined. `plain` is the same words for the tooltip that carries
 * the whole line once the masthead cuts it to "…".
 */
export class AppearanceLine {
	constructor(text) {
		this.text    = rich(text);
		this.plain   = plainText(this.text.render());
		this.isEmpty = !hasText(this.text);
	}

	/** @param {ChoiceGroup|null} group the playbook's appearance group */
	static from(group) {
		const lines = (group?.condensed ?? []).flatMap(block => block.lines)
			.filter(line => line.form === "row" && hasText(line.text));
		return new AppearanceLine(lines.map(line => rich(line.text).raw.trim()).join(SEPARATOR));
	}
}
