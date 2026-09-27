/**
 * The sections a playbook and an insert are made of, asked about rather than inspected.
 *
 * An insert is a fragment of a playbook (`docs/features/inserts.md`): moves, choices, sometimes an
 * instinct. So both are drawn from these classes, and every section answers the questions the tabs
 * are drawn from — what was chosen, what is on offer, and whether anything has been chosen at all.
 * D11: a section rests on what was chosen, and opens to everything on offer.
 *
 * Everything here reads the choice groups in the shape `buildChoiceGroup` hands the sheet. The one
 * shape it adds is the key, which says where a section lives: a door is kept under it and an edit is
 * made at it, so the two cannot disagree about which section they mean.
 */
import { html, plain, rehydrate } from "./text.js";
import { condenseChoiceGroup } from "../../../src/model/snapshot/character/ChoiceGroupReview.js";

/** Where a section lives: "playbook/instinct", "playbook/lore/arcana-major", "insert-thrall/marks". */
export class SectionKey {
	constructor(owner, part, sub = null) {
		this.owner = owner;  // "playbook", or an insert's tab
		this.part = part;
		this.sub = sub;      // a background's slug, a lore group's, or which set of introductions
	}

	static playbook(part, sub = null) { return new SectionKey("playbook", part, sub); }
	static insert(tabId, part) { return new SectionKey(tabId, part); }

	static parse(text) {
		const [owner, part, sub = null] = String(text).split("/");
		return new SectionKey(owner, part, sub);
	}

	get isPlaybook() { return this.owner === "playbook"; }
	get isInstinct() { return this.part === "instinct"; }

	toString() { return [this.owner, this.part, this.sub].filter(Boolean).join("/"); }
}

/**
 * One thing a section offers.
 *
 *   option — one word of a pick row: an appearance, an instinct
 *   entry  — a line with a box: a consequence, an invocation, a history of violence
 *   answer — a question with a blank and no box: where did you acquire it?
 *   prose  — words between the others, with neither
 *
 * An introduction question is an entry with an answer as well — a box and a blank.
 */
export class ChoiceItem {
	constructor(slug, kind, labelHtml, { labelText = "", detailHtml = "", nameHtml = "", noteHtml = "",
		titleHtml = "", titleNoteHtml = "", marked = false, exclusive = false, rowKey = null, answer = null,
		checkCount = 0, inputType = null } = {}) {
		this.slug = slug;
		this.kind = kind;
		this.labelHtml = labelHtml;
		this.labelText = labelText;    // the words alone, for a control's accessible name
		this.titleHtml = titleHtml;    // an entry's own title, which the shipped row prints above it
		this.titleNoteHtml = titleNoteHtml;
		this.checkCount = checkCount;  // how many boxes the book prints beside it
		this.inputType = inputType;    // "inline" or "rich" where there is a blank
		this.detailHtml = detailHtml;  // an option's description: an instinct's sentence
		this.nameHtml = nameHtml;      // an entry's own name, where the book prints one: an invocation's
		this.noteHtml = noteHtml;      // beside that name: "(ongoing)"
		this.marked = marked;
		this.exclusive = exclusive;    // an option of a radio row, where picking one clears the others
		this.rowKey = rowKey;          // which row an option is on, so a radio clears only its own line
		this.answer = answer;          // null when there is no blank to write in
	}

	static fromOption(option, row) {
		return new ChoiceItem(option.slug, "option", html(option.text), {
			labelText: plain(option.text),
			detailHtml: html(option.description), marked: Boolean(option.checked),
			exclusive: Boolean(row.radio), rowKey: row.rowKey ?? null,
		});
	}

	static fromEntry(row) {
		const c = row.content ?? {};
		return new ChoiceItem(row.slug, row.track ? "entry" : row.input ? "answer" : "prose", html(c.text), {
			labelText: plain(c.text),
			nameHtml: html(c.subtitle), noteHtml: html(c.subtitleNote),
			titleHtml: html(c.title), titleNoteHtml: html(c.titleNote),
			marked: (row.track?.checks ?? []).some(Boolean),
			checkCount: row.track?.checks?.length ?? 0,
			answer: row.input ? row.input.value ?? "" : null,
			inputType: row.input ? row.input.type ?? "inline" : null,
		});
	}

	get name() { return plain(this.nameHtml); }
	get hasName() { return Boolean(this.nameHtml); }
	get hasBox() { return this.kind === "option" || this.kind === "entry"; }
	get hasAnswer() { return this.answer !== null; }
	get isAnswered() { return Boolean(String(this.answer ?? "").trim()); }
	get isOffered() { return this.kind !== "prose"; }

	/** Ticked, or written in — an introduction question is answered by naming someone. */
	get isChosen() { return this.marked || this.isAnswered; }
}

/** One row of words to pick from — an appearance line, an instinct's options — kept as one row. */
export class PickRow {
	constructor(row) {
		this.inline = Boolean(row.inline);
		this.radio = Boolean(row.radio);
		this.rowKey = row.rowKey ?? null;
		this.options = (row.options ?? []).map(o => ChoiceItem.fromOption(o, row));
	}
}

/**
 * One choice group, as a section.
 *
 * The book prints a group's name and its instruction as the group's first line, and the packs carry
 * that line as the group's leading entry — "Consequences" / "When you first take this insert, choose
 * 1." So the leading entries with nothing to tick or fill are the section's heading: the first one's
 * title names it and their text is the instruction. Nothing is renamed; it is read where it is.
 */
export class ChoiceSection {
	#group;

	constructor(group, key) {
		this.key = key;
		this.slug = group?.slug ?? null;
		const rows = group?.list ?? [];
		const firstOffered = rows.findIndex(r => r.type !== "entry" || r.track || r.input);
		const lead = firstOffered === -1 ? rows : rows.slice(0, firstOffered);
		this.title = plain(lead[0]?.content?.title) || plain(group?.title) || null;
		this.leadHtml = lead.map(r => html(r.content?.text)).filter(Boolean).join("<br><br>");
		this.items = rows.slice(lead.length).flatMap(r => r.type === "entry"
			? [ChoiceItem.fromEntry(r)]
			: (r.options ?? []).map(o => ChoiceItem.fromOption(o, r)));
		this.#group = group;
	}

	/** Every row, heading included, as the shipped `choice-row` partial draws them while choosing. */
	get rows() {
		return (this.#group?.list ?? []).map(r => r.type === "entry" ? ChoiceItem.fromEntry(r) : new PickRow(r));
	}

	/**
	 * What was chosen, as the sheet reads it back when the section rests: the SHIPPED condenser's
	 * blocks (`condenseChoiceGroup`), not a copy of its rules. One line per thing chosen, in the shape
	 * the editor drew it, with the prose that asked the question kept above it.
	 */
	get condensed() { return condenseChoiceGroup(rehydrate(this.#group)); }

	get offered() { return this.items.filter(i => i.isOffered); }
	get chosen() { return this.offered.filter(i => i.isChosen); }
	get isChosen() { return this.chosen.length > 0; }

	/** Nothing to choose — the Seeker's "Collection" is a heading and a paragraph. */
	get isProse() { return !this.offered.length; }
}

/**
 * The playbook's own section — a history of violence, a sacred pouch, a major arcanum's story.
 *
 * A group with nothing to choose is the heading of the groups after it. The Seeker's "Collection" is
 * the book's heading over its Major Arcanum and Minor Arcana; the pack stores it as a group holding a
 * title and one sentence, and drawn as a section of its own it was a box with nothing to tick. So it
 * heads the groups that follow it, up to the next such group. A group with no heading before it is
 * a section of its own.
 */
export class LoreSection {
	constructor(heading, groups) {
		this.heading = heading;  // the ChoiceSection with nothing to choose, or null
		this.groups = groups;
	}

	static fromGroups(sections) {
		return sections.reduce((out, section) => {
			const open = out.at(-1);
			if (section.isProse) out.push(new LoreSection(section, []));
			else if (open?.heading) open.groups.push(section);
			else out.push(new LoreSection(null, [section]));
			return out;
		}, []);
	}

	get #lead() { return this.heading ?? this.groups[0]; }

	get key() { return this.#lead.key; }
	get title() { return this.#lead.title; }
	get leadHtml() { return this.heading?.leadHtml ?? ""; }

	get offered() { return this.groups.flatMap(g => g.offered); }
	get chosen() { return this.groups.flatMap(g => g.chosen); }
	get isChosen() { return this.chosen.length > 0; }
	get isProse() { return !this.offered.length; }
}

/**
 * The one instinct a playbook or an insert offers. `label` is the computed one the sheet already
 * shows — the picked option's name and description, or what was written in. A pick and a write-in
 * are mutually exclusive, so a label with nothing picked was written in.
 */
export class InstinctSection {
	constructor(group, selectedLabel, key) {
		this.key = key;
		this.choices = new ChoiceSection(group, key);
		this.label = selectedLabel ?? "";
	}

	get options() { return this.choices.offered; }
	get isChosen() { return Boolean(this.label); }
	get isWrittenIn() { return this.isChosen && !this.choices.isChosen; }
}

/** One region a family can have come from, and the names the book prints for it. */
export class OriginRegion {
	constructor(raw) {
		this.region = raw.region;
		this.names = raw.names ?? [];
		this.selected = Boolean(raw.selected);
	}

	/** Gordin's Delve prints none and says to borrow one — an instruction, not a gap. */
	get hasNames() { return this.names.length > 0; }
}

export class OriginSection {
	constructor(raw, key) {
		this.key = key;
		this.regions = (raw?.options ?? []).map(o => new OriginRegion(o));
	}

	get chosen() { return this.regions.find(r => r.selected) ?? null; }
	get isChosen() { return Boolean(this.chosen); }
}

/** One background, with the picks and the track that come with it. */
export class BackgroundOption {
	constructor(raw) {
		this.slug = raw.slug;
		this.labelHtml = html(raw.label);
		this.label = plain(raw.label);
		this.descriptionHtml = html(raw.description);
		this.selected = Boolean(raw.selected);
		this.resource = raw.resource ?? null;  // the Destined's omens, spent in play
		this.choices = raw.choices
			? new ChoiceSection(raw.choices, SectionKey.playbook("background", raw.slug).toString())
			: null;
	}
}

export class BackgroundSection {
	constructor(raw, key) {
		this.key = key;
		this.options = (raw?.options ?? []).map(o => new BackgroundOption(o));
	}

	get chosen() { return this.options.find(o => o.selected) ?? null; }
	get isChosen() { return Boolean(this.chosen); }
}

/**
 * The procedure run with the whole table. The eight steps are the sheet's own words, the same for
 * every playbook, apart from the third turn and the two sets of questions, which are the playbook's.
 * What is worth keeping once it is over is who got named, so the answers are collected.
 */
export class IntroductionsSection {
	constructor(raw, key) {
		this.key = key;
		this.step3Html = html(raw?.step3);
		this.npc = new ChoiceSection(raw?.npcGroup, SectionKey.playbook("introductions", "npc").toString());
		this.pc = new ChoiceSection(raw?.pcGroup, SectionKey.playbook("introductions", "pc").toString());
	}

	get answered() { return [...this.npc.chosen, ...this.pc.chosen]; }
	get hasAnswers() { return this.answered.length > 0; }
}

/** The playbook, section by section, in the order the book prints them. */
export class PlaybookSections {
	constructor(raw) { this.raw = raw ?? {}; }

	get blurbHtml() { return html(this.raw.description); }

	get background() {
		return new BackgroundSection(this.raw.background, SectionKey.playbook("background").toString());
	}

	get instinct() {
		return new InstinctSection(this.raw.instinctGroup, this.raw.instinctSelected,
			SectionKey.playbook("instinct").toString());
	}

	get appearance() { return new ChoiceSection(this.raw.appearanceGroup, SectionKey.playbook("appearance").toString()); }
	get origin() { return new OriginSection(this.raw.origin, SectionKey.playbook("origin").toString()); }

	/** The playbook's own section, grouped under the headings the book prints — see LoreSection. */
	get lore() {
		return LoreSection.fromGroups((this.raw.loreGroups ?? [])
			.map(g => new ChoiceSection(g, SectionKey.playbook("lore", g.slug).toString())));
	}

	get introductions() {
		return this.raw.introductions
			? new IntroductionsSection(this.raw.introductions, SectionKey.playbook("introductions").toString())
			: null;
	}
}

/**
 * One insert: the whole card, moves included. D12 — its moves are read with its purpose and its
 * ledger, the way the book prints them on one card and the way an arcanum card already carries its own.
 *
 * `toMove` builds a move row's view, passed in so this module never has to know what one is.
 */
export class InsertView {
	#toMove;

	constructor(raw, toMove) {
		this.raw = raw;
		this.slug = raw.slug;
		this.name = raw.name;
		this.#toMove = toMove;
	}

	/** The insert's icon, as a path the page can load — the shipped header draws it beside the name. */
	get img() { return this.raw.img ? `/${String(this.raw.img).replace(/^\//, "")}` : null; }

	/** The shipped sheet's tab id for it, `insert-<slug>`. */
	get tabId() { return `insert-${this.slug}`; }
	get descriptionHtml() { return html(this.raw.description); }
	get moves() { return (this.raw.moves ?? []).map(m => this.#toMove(m, this.tabId, this.name)); }

	get instinct() {
		return this.raw.instinctGroup
			? new InstinctSection(this.raw.instinctGroup, this.raw.instinctSelected,
				SectionKey.insert(this.tabId, "instinct").toString())
			: null;
	}

	/** The instinct this insert has chosen, picked or written in; empty until it has one. */
	get instinctLabel() { return this.raw.instinctSelected ?? ""; }

	/** Whether this insert's instinct is the one in force — it replaces the playbook's once chosen. */
	get carriesInstinct() { return Boolean(this.instinctLabel); }

	get sections() {
		return (this.raw.choices ?? []).map(g => new ChoiceSection(g, SectionKey.insert(this.tabId, g.slug).toString()));
	}
}

/**
 * A group with one thing ticked or cleared, as a new group. An entry's box, or an option — and a radio
 * row keeps one, so picking a word clears the others on that line and no other.
 */
export function markInGroup(group, itemSlug, marked) {
	return {
		...group,
		list: (group?.list ?? []).map(row => {
			if (row.type === "choice") {
				if (!(row.options ?? []).some(o => o.slug === itemSlug)) return row;
				return { ...row, options: row.options.map(o => o.slug === itemSlug ? { ...o, checked: marked }
					: row.radio && marked ? { ...o, checked: false } : o) };
			}
			return row.slug === itemSlug && row.track
				? { ...row, track: { ...row.track, checks: row.track.checks.map(() => marked) } }
				: row;
		}),
	};
}

/** A group with one question's blank filled in, as a new group. */
export function answerInGroup(group, itemSlug, value) {
	return {
		...group,
		list: (group?.list ?? []).map(row => row.slug === itemSlug && row.input
			? { ...row, input: { ...row.input, value } }
			: row),
	};
}

/**
 * The instinct label for a group's picked option, or null when none is picked. Mirrors
 * `InstinctController.computeSelected` — the deck cannot run the system's controller, and the label
 * has to follow a pick made here the way it follows one made on the real sheet.
 */
export function instinctLabelOf(group) {
	const checked = (group?.list?.[0]?.options ?? []).find(o => o.checked);
	if (!checked) return null;
	const text = plain(checked.text);
	const description = plain(checked.description);
	return description ? `${text} — ${description}` : text;
}
