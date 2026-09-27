/**
 * The pieces the whole proposal is built from.
 *
 * Every surface in the deck is one of these composed with another. That is the point of the
 * proposal: the sheet is flat today because a group header, a panel and a row are each drawn
 * differently on every tab. Here there is one of each, and a tab is a choice of which to use.
 *
 *   panel   — the box: a hairline around a list or a section.
 *   bar     — a panel's header: name on the left, counts and the way out on the right.
 *   moveRow — one uniform line with RESERVED columns, so every right edge lines up. The only
 *             move row there is: the rail and the moves tab both render this.
 *   possessionRow — the same skeleton with a possession in it, for the possessions tab.
 *   sectionPanel — a playbook's or an insert's section: what was chosen, and one door to the rest.
 *   choiceRows / condensedBlocks — what goes in one: the shipped `choice-row` and
 *             `choice-group-condensed` markup, being chosen or read back.
 *   track   — a row of pips: one unit of a resource, spent or not.
 *   takeBox — a move's □ while choosing: filled once it is taken, however many times.
 *   pickList  — what a move lets you mark (Well Versed's topics), as squares.
 *   meter   — a number that changes during play, as a bar you can still type into.
 *   preview — the hover card that lets a row stay one line.
 */

import { html, plain } from "./text.js";

export const esc = s => String(s ?? "")
	.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/**
 * A box: a hairline around a list or a section, with the bar as its boundary.
 *
 * There used to be a framed variant in the book's 9-slice panel art, for a context strip at the head
 * of a tab. It went with the last caller: the playbook's blurb is plain prose on the shipped sheet, and
 * the art is used in few enough places there that a box of it read as an invention.
 */
export const panel = ({ bar = "", body = "", klass = "" } = {}) =>
	`<section class="rd-panel ${klass}">${bar}${body}</section>`;

/**
 * How a bar wears into stone: which of the two textures, which stretch of it, and which way up.
 *
 * The textures ALTERNATE in the order a surface draws its bars, so neighbours differ — chosen from the
 * title instead, four plain bars came out in a row on the Playbook tab. The stretch and the flips come
 * from the title, so a bar keeps its look when the sheet redraws and two bars with one texture still
 * show different patches of it, turned different ways.
 *
 * The stretch is a percentage along the image, which keeps the bar's window inside it however wide
 * the bar is: the texture drawn at a bar's height is about 2,000px, and no bar is half that.
 */
export class BarGrain {
	constructor(heavy, position, flipX, flipY) {
		this.heavy = heavy;        // the heavier texture, rather than the subtle one
		this.position = position;  // 0–100, along the image
		this.flipX = flipX;
		this.flipY = flipY;
	}

	static of(title, index) {
		const h = [...String(title ?? "")].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
		return new BarGrain(index % 2 === 1, h % 101, Boolean(h & 0x10000), Boolean(h & 0x20000));
	}

	get classes() {
		return [this.heavy && "rd-bar--heavy", this.flipX && "rd-bar--flip-x", this.flipY && "rd-bar--flip-y"]
			.filter(Boolean).join(" ");
	}

	get style() { return `--rd-grain: ${this.position}%`; }
}

/* Where a bar falls in its surface's drawing order. Each surface — the rail, the band, the tab — resets
   it before drawing, so a bar's place depends only on what is above it in the same surface: switching
   tabs used to shift the rail's bars by however many the tab had drawn, and their textures changed. */
let barIndex = 0;
export const resetBarSequence = () => { barIndex = 0; };

/**
 * A panel's header bar. Ink ground, paper text — a boundary, not a caption.
 *
 * The bar wears into the stone texture towards its right end (redesign.css, `.rd-bar::before`), and
 * `BarGrain` picks which texture, which stretch of it, and which way up.
 *
 * `action` is the panel's one control, and it holds the right edge: the moves list's Done, where a
 * reader looks for the way out, or the caret that opens and shuts a rail group, where every row
 * keeps its own.
 */
const barHeader = grain => `<header class="rd-bar${grain.classes ? ` ${grain.classes}` : ""}" style="${grain.style}">`;

export const bar = ({ title, note = null, count = null, action = "" } = {}) => `
	${barHeader(BarGrain.of(title, barIndex++))}
		<span class="rd-bar-title">${esc(title)}</span>
		${note ? `<span class="rd-bar-note">${esc(note)}</span>` : ""}
		<span class="rd-bar-meta">
			${count ? `<span class="rd-count">${esc(count)}</span>` : ""}
			${action}
		</span>
	</header>`;

/**
 * A resource track — the shipped one.
 *
 * A row of identical pip buttons, each stating which pip it is and whether it is filled: without
 * that a screen reader reads N nameless controls and no state. A circle means one unit of a
 * resource, which is why this is not the square a move's own acquisition box uses.
 */
export const track = (resource, name) => {
	const max = resource?.max ?? 0;
	if (!max) return "";
	return `<span class="stonetop-item-resources">${
		Array.from({ length: max }, (_, i) => {
			const checked = i < (resource.current ?? 0);
			return `<button type="button" class="stonetop-item-resource-check${checked ? " is-checked" : ""}"
				aria-pressed="${checked}" aria-label="${esc(name)}, ${i + 1} of ${max}" data-index="${i}"></button>`;
		}).join("")}</span>`;
};

/**
 * A move row: one control per job, and each job's control is the size of the job.
 *
 * Measured against dnd5e rather than argued from taste. That sheet has NO die button anywhere — 96
 * rollable elements on one character, and essentially all of them are names: skill names, saving
 * throws, ability labels, item names, activity names. Three things teach a player that a name rolls:
 * a column literally headed ROLL with the modifier under it, a card on hover, and the fact that
 * every name on the sheet does it.
 *
 * Stonetop cannot lean on the third. Nine of ten basic moves roll and roughly one playbook move in
 * six, so "names roll" is not a rule a player can learn — which is why the die stays. What changes
 * is that it is no longer a 16px target of its own: the DIE AND THE NAME ARE ONE BUTTON. The die
 * says what pressing it does; the name is the part you actually hit. A move that does not roll has
 * no die and no roll control, and nothing about its name suggests otherwise.
 *
 * The caret moves to the right cluster, which is where dnd5e keeps `toggleExpand`. Rolling happens
 * constantly and reading happens occasionally, so the wide target at the front belongs to the roll.
 *
 * Two ways to the same move's words, neither competing: hover the name for the card, press the caret
 * to open the text in place.
 *
 * No chat bubble in the rail. It cost 20px of the only column with anything long in it, and three of
 * the ten names wrapped for it — while the roll control beside it already posts its result. dnd5e's
 * rows have no such control at all. The moves tab has the width and passes `chat`.
 *
 * ONE ROW, FOUR WIDTHS. This is the only move row on the sheet; the moves tab used to have a second
 * one of its own and the two drifted into different faces, different roll affordances and different
 * ways of saying "0/2". What varies is not the component but how much room it is standing in, and
 * the row asks that itself — `container-type: inline-size` in redesign.css, so nothing about the
 * surface is written into the markup. Measured, the four are: the rail at 12.7rem, the two-up
 * catalogue at 27.9rem, the narrow window at 44.6rem and the full list at 55.9rem.
 *
 * THE TRACK TAKES THE HIGHEST LINE THAT FITS IT, and that is the only thing the width changes. The
 * visual identity does not move: the track is always a run of `--control-pip` circles, always right
 * aligned to the row's edge, always landing on the same vertical line as the stat. Where it sits is
 * arithmetic, not taste — the rail's row has 190px and Defend needs 205.8 of it (die+name 63.6, stat
 * 34, four pips 73, caret 16, three gaps 19.2), so inline is not on offer there. On the moves tab the
 * worst case in the whole pack — longest name, a 20-character title and a twelve-pip track — comes to
 * 577px of 881, so it never has to move.
 *
 * Hence `.rd-mrow-sub`, which holds the trigger and the track. It is the row's SECOND LINE where the
 * track has to join it, and `display: contents` where it does not, which lets the track out into the
 * header's own grid without the markup changing shape. See redesign.css.
 *
 * The rail's worst case is fixed forever, which is what makes this safe to design against: the ten
 * basic moves are the same for every character, and exactly one of them (Defend, four pips, no title)
 * carries a track at all.
 *
 * `takes`, `chat` and `requirement` are OFF here and stated by the surface. The rail hard-codes what
 * it wants and so does the moves tab, so no caller can hand a frame a different row.
 *
 * `choosing` is the moves tab while a move is being picked, and it adds exactly two things: one box
 * per row, which is what taking a move IS, and a third line saying what the move asks of the choice —
 * its requirement, and how many times it can be taken. At rest there is neither. Being in the list
 * says a move is taken; a box on every row would say it again, and a box on some rows made those rows
 * look like a different kind of thing.
 *
 * How many times a move HAS been taken is nice to know, not needed in play, so it is small and only
 * there when it says something: "×2" after the name, from the second take. Once is what being in the
 * list means.
 *
 * A move with picks finishes its second line with the ones marked. Well Versed's trigger ends "one of
 * your topics", so the topics complete the sentence rather than sitting on a line of their own; the
 * gloss retires when the row opens, and they go with it, because the open body has them as marks.
 */
export const moveRow = (move, { hover = false, open = false, chat = false, choosing = false } = {}) => {
	const id = `rd-body-${esc(move.slug)}`;
	const rolls = move.rollsDice;
	const name = rolls
		? `<button type="button" class="rollable move-rollable rd-roll-name"
				data-roll="${esc(move.rollStat)}" data-move-slug="${esc(move.slug)}"
				aria-label="Roll ${esc(move.name)}" title="Roll ${esc(move.name)}">
				<i class="fas fa-dice-d6 rd-roll-die" aria-hidden="true"></i>
				<span class="rd-move-name">${esc(move.name)}</span>
			</button>`
		: `<span class="rd-move-name rd-move-name--static">${esc(move.name)}</span>`;
	const marked = move.markedPicks;
	return listRow({
		slug: move.slug, open, bodyId: id,
		lead: choosing ? takeBox(move) : "",
		name: `${name}${timesTaken(move)}`,
		roll: `<span class="rd-cell--roll">${move.rollLabel
			? `<span class="rd-stat">${esc(move.rollLabel)}</span>`
			// The dash means DOES NOT ROLL, so it cannot also stand for "rolls, adds nothing". That
			// cell is left empty instead: the die on the name already says the move rolls.
			: rolls ? "" : `<span class="rd-nil">—</span>`}</span>`,
		controls: `${disclosure({ slug: move.slug, label: `Show the text of ${move.name}`, open, id })}
			${chat ? `<button type="button" class="stonetop-move-chat rd-caret"
				aria-label="Send ${esc(move.name)} to chat" title="Send ${esc(move.name)} to chat">
				<i class="fas fa-comment" aria-hidden="true"></i>
			</button>` : ""}`,
		sub: `${move.gloss || marked.length ? `<span class="stonetop-move-gloss"${open ? " hidden" : ""}>${esc(move.gloss)}${
			marked.length ? `${move.gloss ? ": " : ""}<span class="rd-picked">${
				marked.map(p => p.label).join(" · ")}</span>` : ""}</span>` : ""}
			${resourceCell(move)}`,
		line3: choosing ? choosingLine(move) : "",
		body: `<div class="stonetop-item-description">${move.descriptionHtml}</div>
			${pickList(move, { live: true })}`,
		card: hover ? preview(move) : "",
	});
};

/**
 * A special possession's row: the move row's skeleton with a possession in it.
 *
 * Same name, same second line, same circles on the same right edge, same box and third line while
 * choosing — so the two tabs read as one sheet. What it leaves out is what a possession does not
 * have: no roll (none rolls), so no die, no stat and no dash holding a column open; no chat, which
 * the shipped possessions tab never had; and no hover card, because the row already shows everything
 * a card would.
 *
 * The second line is the difference that matters. A move's is a one-line label for text you can
 * open; a possession's description IS its content — the gear list — so it is its own element and it
 * wraps.
 *
 * NOTHING COLLAPSES. A possession with options — Weapons of war's five weapons — shows every one of
 * them as a box under its description, always, in the row itself rather than in the shaded body an
 * opened move uses: that shading says "you opened this", which is untrue of something never shut. So
 * there is no caret, no body, and no summary of the picks on the second line, because the ticked
 * boxes are right under it.
 */
export const possessionRow = (p, { choosing = false } = {}) => listRow({
	slug: p.slug,
	lead: choosing ? takeBox(p, { kind: "possession", locked: p.isLocked }) : "",
	name: `<span class="rd-move-name rd-move-name--static">${p.nameHtml}</span>`,
	controls: p.isRemovable ? `<button type="button" class="rd-caret rd-remove"
		aria-label="Remove ${esc(p.name)}" title="Remove ${esc(p.name)}">
		<i class="fas fa-trash" aria-hidden="true"></i>
	</button>` : "",
	sub: `<span class="rd-mrow-desc">${p.descriptionHtml}</span>
		${resourceCell(p)}`,
	// The shipped sheet names what granted a possession it locks; while choosing, that is the answer
	// to "why can I not untick this". The options follow it, as lines of the row.
	line3: `${choosing && p.isGranted && p.grantedBy ? `<span class="rd-choosing-line">${esc(p.grantedBy)}</span>` : ""}
		${pickList(p, { live: true, kind: "possession" })}`,
});

/**
 * The skeleton every list row is built on — the header's cells in the list's columns, the body, the
 * card. Moves and possessions each fill it with their own contents; neither draws the skeleton
 * itself, because two row functions each drawing their own is exactly how the old rows drifted into
 * two faces.
 *
 * The box's cell is drawn only when there is a box. The list's column is `auto`, so it takes no width
 * at all where none is drawn — at rest, and in the rail. A row with nothing to open has no body.
 */
const listRow = ({ slug, open = false, bodyId = "", lead = "", name, roll = "", controls = "", sub = "",
	line3 = "", body = "", card = "" }) => `
	<li class="rd-row rd-mrow${open ? " is-expanded" : ""}" data-slug="${esc(slug)}">
		<div class="stonetop-item-header">
			${lead ? `<span class="rd-mrow-mark">${lead}</span>` : ""}
			<span class="rd-mrow-name">${name}</span>
			${roll}
			<span class="stonetop-item-controls">${controls}</span>
			<span class="rd-mrow-sub">${sub}</span>
			${line3}
		</div>
		${body ? `<div class="stonetop-move-body rd-row-body" id="${bodyId}"${open ? "" : " hidden"}>${body}</div>` : ""}
		${card}
	</li>`;

/** The caret that opens a row's body in place. `label` says what is behind it. */
const disclosure = ({ slug, label, open, id }) => `<button type="button" class="stonetop-move-disclosure rd-caret"
	data-expand="${esc(slug)}" aria-expanded="${open}" aria-controls="${id}"
	aria-label="${esc(label)}" title="${esc(label)}">
	<i class="fas fa-chevron-right stonetop-move-caret" aria-hidden="true"></i>
</button>`;

/** A resource's title and its circles, on whichever line the row's width gives them. */
const resourceCell = item => item.resource ? `<span class="stonetop-item-resources">${
	item.resource.title ? `<span class="stonetop-arcanum-resource-title">${esc(item.resource.title)}</span>` : ""
}${track(item.resource, item.name)}</span>` : "";

/**
 * Whether a move is taken, as the one □ a row has while choosing. The square is the design system's
 * mark for *taken*: "a square is something you decided; a circle is a state you are in or spend".
 * `.stonetop-item-check` is the sheet's own square, so this and the real sheet's are one mark.
 *
 * ONE box however many times the book allows, which is where this departs from the shipped
 * `repeatChecks` — three boxes on Improved Stat and one on everything else made three rows of 25 look
 * like another kind of row. So the box means "you have it", clearing it clears every take, and taking
 * a move again is the choosing line's job.
 *
 * `kind` names what the box takes, so a move's handler and a possession's cannot answer each other's
 * boxes; `locked` is the shipped sheet's disabled box on a possession the playbook hands over.
 */
export const takeBox = (item, { kind = null, locked = false } = {}) =>
	`<input type="checkbox" class="stonetop-item-check rd-take" data-take${kind ? `-${kind}` : ""}="${esc(item.slug)}"
		aria-label="${esc(item.name)}: taken"${item.isTaken ? " checked" : ""}${locked ? " disabled" : ""}>`;

/** "×2" after the name, from the second take. Said in words, because "times 2" is not a sentence. */
const timesTaken = move => move.timesTaken > 1
	? `<span class="rd-times"><span aria-hidden="true">×${move.timesTaken}</span><span
		class="stonetop-visually-hidden">, taken ${move.timesTaken} times</span></span>`
	: "";

/**
 * What a move asks of the choice, on the row's third line while choosing: its requirement, how many
 * times it can be taken, and — between the first take and the limit — the way to take it again. One
 * line, not a line each: they are all the same kind of fact, and the count is already by the name.
 */
const choosingLine = move => {
	const parts = [];
	if (move.requirement) parts.push(`<span class="rd-req${move.requirementMet ? "" : " rd-req--unmet"}">Requires: ${
		esc(move.requirement)}${move.requirementMet ? "" : " (not met)"}</span>`);
	if (move.isRepeatable) parts.push(`<span class="rd-limit">Up to ${move.maxTakes} times</span>`);
	if (move.isTaken && move.timesTaken < move.maxTakes) parts.push(`<button type="button"
		class="rd-goto rd-take-again" data-take-again="${esc(move.slug)}"
		aria-label="Take ${esc(move.name)} again">Take again</button>`);
	return parts.length
		? `<span class="rd-choosing-line">${parts.join(`<span class="rd-sep" aria-hidden="true"> · </span>`)}</span>`
		: "";
};

/**
 * What a move lets you mark, as marks — the book's box beside each of Well Versed's topics.
 *
 * `live` in the row's body, where they are the controls, and not in the hover card: a card that only
 * a pointer on the row can see must not hold the only way to change anything, and a checkbox inside
 * a hover card is a control nobody can reach.
 *
 * A pick-1 row (Symbol of authority) is radios, so picking one clears the other. `kind` does for a
 * pick what it does for a take box.
 */
export const pickList = (item, { live = false, kind = null } = {}) => item.picks.length ? `
	<ul class="rd-movepicks">${item.picks.map(p => `<li class="rd-movepick${p.marked ? " is-marked" : ""}">${live
		? `<label><input type="${p.exclusive ? "radio" : "checkbox"}" class="stonetop-cg-track"${
			p.exclusive ? ` name="${esc(item.slug)}-picks"` : ""} data-pick${kind ? `-${kind}` : ""}="${esc(item.slug)}"
			data-pick-slug="${esc(p.slug)}"${p.marked ? " checked" : ""}> <span>${p.label}${pickDetail(p)}</span></label>`
		: `<span class="rd-movepick-box" aria-hidden="true"></span> <span>${p.label}${pickDetail(p)}</span>`}</li>`).join("")}
	</ul>` : "";

const pickDetail = p => p.detail ? ` <span class="rd-movepick-detail">${p.detail}</span>` : "";

/**
 * A playbook's or an insert's section — D11.
 *
 * It rests on what was chosen, and its door opens everything on offer in place. The door is on the
 * bar, where Done appears while it is open — the place the rail's groups keep their one control — so
 * a section costs its bar and its lines and nothing more. `key` is the section's address: the door is
 * kept under it, so opening one section opens nothing else.
 *
 * No count. "1 of 6" on a pick-one list read as five picks still owed. How many to choose is the
 * book's instruction — `note`, the shipped heading's "(Choose 1)" — on the bar while choosing; what
 * was chosen is the body at rest.
 *
 * `door` is the door's words ("Change", "Choose"), or null where there is nothing to choose. What goes
 * INSIDE is not this deck's: `choiceRows` and `condensedBlocks` below are the shipped partials' markup.
 */
export const sectionPanel = ({ key, title, note = null, open = false, restBody = "", openBody = "", door = null }) =>
	panel({
		klass: `rd-section${open ? " is-choosing" : ""}`,
		bar: bar({
			title: title ?? "",
			note: open ? note : null,
			action: open
				? `<button type="button" class="rd-bar-action" data-section-door="${esc(key)}" aria-expanded="true">Done</button>`
				: door ? `<button type="button" class="rd-bar-action" data-section-door="${esc(key)}" aria-expanded="false">${
					esc(door)}</button>` : "",
		}),
		body: `<div class="rd-section-body">${open ? openBody : restBody}</div>`,
	});

const sectionNote = noteHtml => noteHtml ? ` <span class="stonetop-section-note">${noteHtml}</span>` : "";
const subHeading = (nameHtml, noteHtml) =>
	`<h4 class="stonetop-move-group-sub-heading">${nameHtml}${sectionNote(noteHtml)}</h4>`;
const entryTitle = (titleHtml, noteHtml) =>
	`<p class="stonetop-choice-entry-title">${titleHtml}${sectionNote(noteHtml)}</p>`;

/* `choice-row.hbs`'s "track-checks": one box per check the book prints, each saying which it is. */
const trackChecks = (key, item) => Array.from({ length: item.checkCount }, (_, i) => `<input type="checkbox"
	class="stonetop-cg-track" data-mark="${esc(key)}" data-item="${esc(item.slug)}"
	aria-label="Track ${i + 1} of ${item.checkCount}"${item.marked ? " checked" : ""}>`).join("");

/* `choice-row.hbs`'s "pick-input": the system's square, radio or not. The name is the section AND the
   line, because appearance is four pick-one lines in one section. */
const pickInput = (key, row, item) => `<input type="${row.radio ? "radio" : "checkbox"}"
	class="stonetop-item-check stonetop-cg-pick"${row.radio ? ` name="${esc(key)}:${esc(row.rowKey)}"` : ""}
	aria-label="${esc(item.labelText)}" data-mark="${esc(key)}" data-item="${esc(item.slug)}"${item.marked ? " checked" : ""}>`;

/* The blank, as the shipped row draws it: single-line to start and growing as the answer wraps. */
const blank = (key, item) => `<div class="stonetop-choice-option stonetop-choice-option--text">
	<textarea${item.inputType === "rich" ? "" : ' rows="1"'} class="stonetop-cg-text stonetop-choice-input ${item.inputType === "rich"
		? "stonetop-choice-input--rich" : "stonetop-choice-input--inline stonetop-grow-field"}"
		aria-label="Choice text" data-answer="${esc(key)}" data-item="${esc(item.slug)}">${esc(item.answer ?? "")}</textarea>
</div>`;

const entryRow = (key, item, omitTitle) => {
	const title = item.titleHtml && plain(item.titleHtml) !== omitTitle ? entryTitle(item.titleHtml, item.titleNoteHtml) : "";
	let body;
	if (item.checkCount && item.hasName) body = `<div class="stonetop-choice-track stonetop-column">
		<div class="stonetop-choice-header-wrapper">
			<span class="stonetop-choice-track-checks">${trackChecks(key, item)}</span>
			${subHeading(item.nameHtml, item.noteHtml)}
		</div>
		<span class="stonetop-choice-track-desc">${item.labelHtml}</span>
	</div>`;
	else if (item.checkCount) body = `<div class="stonetop-choice-track stonetop-row">
		<div class="stonetop-choice-track-checks">${trackChecks(key, item)}</div>
		<span class="stonetop-choice-track-desc stonetop-choice-track-desc-row">${item.labelHtml}</span>
	</div>`;
	else body = `${item.hasName ? subHeading(item.nameHtml, item.noteHtml) : ""}${item.labelHtml
		? `<div class="stonetop-choice-description">${item.labelHtml}</div>` : ""}`;
	return `${title}${body}${item.hasAnswer ? blank(key, item) : ""}`;
};

const pickRowMarkup = (key, row) => `<div class="stonetop-choice-row${row.inline ? " stonetop-choice-row--inline" : ""}">${
	row.options.map(item => item.detailHtml
		? `<label class="stonetop-item${item.marked ? " is-checked" : ""}">
			<div class="stonetop-item-header">${pickInput(key, row, item)}<strong class="stonetop-item-name">${item.labelHtml}</strong></div>
			<div class="stonetop-item-description">${item.detailHtml}</div>
		</label>`
		: `<label class="stonetop-choice-option-label${item.marked ? " is-checked" : ""}">${pickInput(key, row, item)} ${
			item.labelHtml}</label>`).join("")}</div>`;

/**
 * A section while choosing: `choice-row.hbs`, row by row, for everything on offer — nothing hidden
 * behind a caret, because a choice cannot be made on words the reader has to go and open.
 *
 * Each control carries its section's key and its item's slug in place of the shipped `data-cg-*`
 * wiring, so one handler in the deck serves every section. `omitTitle` is the bar's title, which the
 * group's own heading entry would otherwise print a second time; `klass` is the shipped wrapper's
 * extra class where it has one (`stonetop-instinct-options`).
 */
export const choiceRows = (section, { omitTitle = null, klass = "" } = {}) =>
	`<div class="stonetop-choice-entry${klass ? ` ${klass}` : ""}">${section.rows.map(row => row.options
		? pickRowMarkup(section.key, row)
		: entryRow(section.key, row, omitTitle)).join("")}</div>`;

const tick = `<span class="stonetop-choice-tick" aria-hidden="true">✓</span>`;

/**
 * One ticked line — the locked view's "row" shape: the tick where the box was, then the words. Shared
 * with the sections that are not choice groups (the instinct's computed label, the origin's region),
 * so they rest in the same shape as their neighbours rather than in a look of their own.
 */
export const tickedLine = (textHtml, { klass = "" } = {}) => `<div class="stonetop-choice-track stonetop-row${klass
	? ` ${klass}` : ""}">
		<div class="stonetop-choice-track-checks">${tick}</div>
		<span class="stonetop-choice-track-desc stonetop-choice-track-desc-row">${textHtml}</span>
	</div>`;

const condensedLine = line => {
	if (line.form === "section") return `<div class="stonetop-choice-track stonetop-column">
		<div class="stonetop-choice-header-wrapper">
			<span class="stonetop-choice-track-checks">${tick}</span>
			${subHeading(html(line.text), html(line.note))}
		</div>
		<span class="stonetop-choice-track-desc">${html(line.detail)}</span>
	</div>`;
	if (line.form === "card") return `<div class="stonetop-item is-checked">
		<div class="stonetop-item-header">${tick}<strong class="stonetop-item-name">${html(line.text)}</strong></div>
		<div class="stonetop-item-description">${html(line.detail)}</div>
	</div>`;
	// A move granted by a row renders as the move row on the real sheet. None of the deck's sections
	// grant one, so it is left out rather than drawn as something else.
	if (line.form === "moves") return "";
	return tickedLine(`${html(line.text)}${sectionNote(html(line.note))}`);
};

/**
 * A section at rest: `choice-group-condensed.hbs`, drawn from the shipped condenser's blocks. The shape
 * the editor gave each line, with the tick where its box was — resting changes what shows, never how
 * it is styled. `omitTitle` as for `choiceRows`.
 */
export const condensedBlocks = (blocks, { omitTitle = null } = {}) => blocks.map(block => `${
	block.title && plain(block.title) !== omitTitle ? entryTitle(html(block.title), html(block.titleNote)) : ""}${
	block.lead ? `<div class="stonetop-choice-description">${html(block.lead)}</div>` : ""}${
	block.lines.map(condensedLine).join("")}`).join("");

/**
 * The hover card.
 *
 * This is what pays for a one-line row: the rules text is reachable without being printed 25 times
 * down the page. It can never be the ONLY path — Foundry's tooltips bind pointer events only, and
 * focusing a row does not open dnd5e's either (measured) — so the row keeps its disclosure and this
 * is the fast version of the same content.
 */
export const preview = move => `
	<div class="rd-preview" role="presentation">
		<p class="rd-preview-title">${esc(move.name)}
			${move.rollsDice ? `<span class="rd-preview-roll">2d6${
				move.rollLabel ? ` ${esc(move.rollLabel)}` : ""}</span>` : ""}</p>
		<div class="rd-preview-text">${move.descriptionHtml}</div>
		${pickList(move)}
		${move.tiers.length ? `<dl class="rd-tiers">${move.tiers.map(t =>
			`<dt>${esc(t.label)}</dt><dd>${t.value}</dd>`).join("")}</dl>` : ""}
		<p class="rd-preview-foot">${esc(move.categoryLabel)}</p>
	</div>`;

/**
 * A number that changes during play, drawn as a bar.
 *
 * The shape is the one measured on the dnd5e sheet: the name on a small line ABOVE, and the value
 * inside the bar with the fill behind it. Two lines rather than three, and the number sits on the
 * thing that qualifies it instead of beside it.
 *
 * Two departures, both deliberate:
 *
 *   The fields stay real fields. dnd5e hides the input behind the rendered text and swaps it in on
 *   click, which leaves the value keyboard-unreachable until it is clicked. Here the inputs are the
 *   text — chrome stripped, sitting on the bar — so they are reachable, and D7's "all of it stays
 *   editable" holds for the keyboard too.
 *
 *   `role="meter"` carries the numbers for assistive tech, because the fill is colour and colour is
 *   never the only carrier of anything on this sheet.
 *
 * `thresholdPct` marks a point INSIDE the run, for a track that does not stop where it is satisfied:
 * experience keeps accruing past the cost of a level, and what is past the mark is what Burn
 * Brightly can spend. Everything right of the mark takes the accent, because that is the part a
 * player is deciding about. Hit points pass none, and read as they always did.
 *
 * `maxEditable` is the difference between the two that use this. Maximum hit points are granted by
 * the playbook and still typed in; experience's threshold is derived from level and is never set by
 * hand, so it is a readout beside the value rather than a second field competing with it.
 */
export const meter = ({ label, value, max, pct, valueLabel, maxLabel = "", maxEditable = false,
	tone = "", note = null, describedBy = null, thresholdPct = null, scale = null,
	valueText = null }) => {
	// A threshold at the end of the run is just the end of the run; there is nothing to mark.
	const past = thresholdPct !== null && thresholdPct < 100;
	return `
	<div class="rd-meter${tone ? ` rd-meter--${tone}` : ""}">
		<span class="rd-meter-label">${esc(label)}</span>
		<div class="rd-meter-bar" role="meter" aria-label="${esc(label)}"
			aria-valuemin="0" aria-valuenow="${esc(value)}" aria-valuemax="${esc(scale ?? max)}"
			${valueText ? `aria-valuetext="${esc(valueText)}"` : ""}
			style="--rd-fill:${pct}%${past ? `;--rd-threshold:${thresholdPct}%` : ""}">
			<span class="rd-meter-fill" aria-hidden="true"></span>
			${past ? `<span class="rd-meter-over" aria-hidden="true"></span>
			<span class="rd-meter-tick" aria-hidden="true"></span>` : ""}
			<span class="rd-meter-fields">
				<input class="rd-meter-input" type="number" min="0" value="${esc(value)}"
					aria-label="${esc(valueLabel)}">
				<span class="rd-meter-sep" aria-hidden="true">/</span>
				${maxEditable
					? `<input class="rd-meter-input rd-meter-input--max" type="number" min="0" value="${esc(max)}"
						aria-label="${esc(maxLabel)}">`
					: `<span class="rd-meter-max">${esc(max)}</span>`}
			</span>
		</div>
		${note ? `<span class="rd-meter-note">${esc(note)}</span>` : ""}
		${describedBy ? `<span class="stonetop-visually-hidden">${esc(describedBy)}</span>` : ""}
	</div>`;
};

