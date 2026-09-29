import { rich, hasText } from "../RichText.js";
import { plainText } from "../../../utils/plainText.js";

/**
 * One section of the Playbook tab (D11), as its door sees it: its key, and the word on its door —
 * Change once something is chosen, Choose before, Open for what is read rather than chosen, and no
 * door where there is nothing to choose. What is inside is the playbook snapshot's own data.
 */
export class PlaybookSection {
	constructor(key, door) {
		this.key        = key;
		this.door       = door;
		this.hasDoor    = door !== null;
		// Whether there is anything to rest on: what was chosen or answered, or a section of words
		// alone. One nobody has answered rests as its bar.
		this.rests      = door === null || door === "change";
	}

	static choice(key, isChosen) {
		return new PlaybookSection(key, isChosen ? "change" : "choose");
	}

	/** The introductions: a procedure for the whole table, opened rather than chosen. */
	static reading(key, hasAnswers) {
		return new PlaybookSection(key, hasAnswers ? "change" : "open");
	}

	static prose(key) {
		return new PlaybookSection(key, null);
	}

}

/**
 * A section of the playbook's own story — a history of violence, a sacred pouch, a major arcanum.
 *
 * The packs carry these as a run of choice groups, and a section is where the book prints one
 * heading: a group with nothing to choose heads the groups after it (the Seeker's "Collection" over
 * Major and Minor Arcana); otherwise a group whose first line is titled starts a section, and an
 * untitled group carries on the one before it (the Lightbearer's "Praise the day" runs across five).
 *
 * The title is read where the book puts it — the lead group's first line — and moves to the bar. When
 * that line is the lead group's own heading row (`titleIsLeadRow`), the rows leave it out rather
 * than print it twice.
 */
export class LoreSection {
	constructor(heading, groups) {
		const lead = heading ?? groups[0];
		this.heading        = heading;
		this.groups         = groups;
		this.key            = `lore-${lead.slug}`;
		this.title          = titleOf(lead);
		this.note           = leadRowNote(lead);
		this.titleIsLeadRow = !heading && Boolean(leadRowTitle(lead));
		this.section        = groups.some(g => g.offersChoice)
			? PlaybookSection.choice(this.key, groups.some(g => g.hasChosen))
			: PlaybookSection.prose(this.key);
	}

	/** @param {ChoiceGroup[]} groups the playbook's lore groups, in the pack's order */
	static fromGroups(groups) {
		const out = [];
		for (const group of groups) {
			const current = out.at(-1);
			if (!group.offersChoice) out.push({ heading: group, groups: [] });
			else if (current && (current.heading || !titleOf(group))) current.groups.push(group);
			else out.push({ heading: null, groups: [group] });
		}
		return out.map(({ heading, groups }) => new LoreSection(heading, groups));
	}
}

// The group's first line's title, as plain words for a bar; else its own title.
function titleOf(group) {
	return leadRowTitle(group) ?? plainOf(group.title);
}

/** The title on a group's first line, where the book prints a section's name — plain words, or null. */
export function leadRowTitle(group) {
	return plainOf(leadRow(group)?.content?.title);
}

/** The note the book prints beside that title. */
export function leadRowNote(group) {
	return plainOf(leadRow(group)?.content?.titleNote);
}

const leadRow = group => (group.list?.[0]?.type === "entry" ? group.list[0] : null);
const plainOf = value => (hasText(value) ? plainText(rich(value).render()) : null);

/**
 * Every section of the Playbook tab, keyed and with its door: the background, the instinct, the
 * appearance and the origin; the playbook's own story (LoreSection); the introductions.
 */
export class PlaybookSections {
	constructor(playbook) {
		this.background    = PlaybookSection.choice("background", Boolean(playbook.background?.selected));
		this.instinct      = PlaybookSection.choice("instinct", hasText(playbook.instinctSelected));
		this.appearance    = PlaybookSection.choice("appearance", Boolean(playbook.appearanceGroup?.hasChosen));
		this.origin        = PlaybookSection.choice("origin", Boolean(playbook.origin?.selected));
		this.lore          = LoreSection.fromGroups(playbook.loreGroups ?? []);
		this.introductions = playbook.introductions
			? PlaybookSection.reading("introductions", playbook.introductions.hasAnswers)
			: null;
		this.keys = [this.background, this.instinct, this.appearance, this.origin,
			...this.lore.map(l => l.section), this.introductions].filter(s => s?.hasDoor).map(s => s.key);
	}

	/** @param {PlaybookSnapshot|null} playbook */
	static from(playbook) {
		return playbook ? new PlaybookSections(playbook) : null;
	}
}
