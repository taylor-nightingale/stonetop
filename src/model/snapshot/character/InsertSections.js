import { hasText } from "../RichText.js";
import { PlaybookSection, leadRowTitle, leadRowNote } from "./PlaybookSections.js";

/**
 * One section of an insert's tab: its instinct, or one of its choice groups, with its door.
 * `title` is null for the instinct, whose heading is the sheet's own word.
 */
export class InsertSectionEntry {
	constructor(kind, section, { title = null, note = null, group = null, titleIsLeadRow = false } = {}) {
		this.kind           = kind;
		this.section        = section;
		this.title          = title;
		this.note           = note;
		this.group          = group;
		this.titleIsLeadRow = titleIsLeadRow;
	}
}

/**
 * An insert's sections (D12), drawn as the Playbook tab's are: the instinct where it has one, then
 * each choice group in the pack's order, split across the same two fixed columns by COUNT — split by
 * height, a section opening would move another across. A lone section runs the tab's width.
 *
 * A group titles its section from its first line, where the book prints the name; one that carries
 * no heading (Invocations) is headed by the insert's name. A Terrible Purpose is chosen like the
 * rest, and rests on the purpose chosen, in full: its words are how an Unliving character heals. Keys
 * are the insert's, so a route never lands on another tab's section.
 */
export class InsertSections {
	constructor(insert) {
		const prefix = `insert-${insert.slug}`;
		const entries = [];
		if (insert.instinctGroup)
			entries.push(new InsertSectionEntry("instinct",
				PlaybookSection.choice(`${prefix}-instinct`, hasText(insert.instinctSelected))));
		for (const group of insert.choices ?? []) {
			const key = `${prefix}-${group.slug}`;
			const title = leadRowTitle(group);
			entries.push(new InsertSectionEntry("group", sectionFor(key, group), {
				title: title ?? insert.name, note: leadRowNote(group), group, titleIsLeadRow: Boolean(title),
			}));
		}
		const half = Math.ceil(entries.length / 2);
		this.split = entries.length > 1;
		this.left  = this.split ? entries.slice(0, half) : entries;
		this.right = this.split ? entries.slice(half) : [];
		this.keys  = entries.map(e => e.section).filter(s => s.hasDoor).map(s => s.key);
	}

	/** @param {InsertSnapshot} insert */
	static from(insert) {
		return new InsertSections(insert);
	}
}

function sectionFor(key, group) {
	if (!group.offersChoice) return PlaybookSection.prose(key);
	return PlaybookSection.choice(key, group.hasChosen);
}
