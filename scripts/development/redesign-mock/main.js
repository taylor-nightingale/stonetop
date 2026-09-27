/**
 * The redesign deck.
 *
 * Read the first deck's review before this one: its "as shipped" frames were hand-drawn too, and
 * they drifted — Outfit lost its semantic columns and its diamond-as-checkbox, Followers lost the
 * companion branch entirely. So THIS deck draws no baseline at all. Every frame here is the
 * proposal; compare it against the real sheet, which is one window away, rather than against a
 * drawing of the real sheet that might be wrong.
 *
 * What is real here: Foundry's own stylesheet at the app's own layer order, the system's CSS,
 * fonts and decor art, and Maelen's captured context. What is mine: redesign.css and the markup
 * below.
 */
import { CharacterSnapshot } from "./CharacterSnapshot.js";
import { panel, bar, moveRow, possessionRow, esc, track, sectionPanel, choiceRows, condensedBlocks, tickedLine,
	resetBarSequence } from "./parts.js";
import { WELL_VERSED, EXPEDITION_PHASES, MOVE_REPLACES, TERRIBLE_PURPOSE_INPUTS } from "./standIns.js";
import { band } from "./band.js";
import { rail } from "./rail.js";
import { slideHeight, slideOpen } from "./motion.js";

// Well Versed's topics as the pack would carry them once they are a choice group, and each
// expedition move's phase as the pack would carry it once it has the field — see standIns.js.
const S = (await CharacterSnapshot.load("../mockup/maelen.json"))
	.withMoveChoices(WELL_VERSED.slug, WELL_VERSED.description, WELL_VERSED.choices)
	.withExpeditionPhases(EXPEDITION_PHASES);

// A real Heavy, captured the same way, for the one list Maelen cannot show: possessions with options.
// Only its possessions are borrowed — see `withPossessionsOf`.
const HEAVY = await CharacterSnapshot.load("../mockup/heavy.json");

// A Lightbearer made in the dev world for the inserts: the playbook grants Invocations, and a Thrall was
// dropped on it the way a sheet drop adds one. Captured twice — the moment the Thrall arrived, and
// after its choices were made through the sheet. Only the inserts are borrowed, as with the Heavy.
// Each carries the two stand-ins the insert packs lack; see standIns.js.
const withInsertStandIns = snap => snap
	.withMoveReplacements(MOVE_REPLACES)
	.withEntryInputs(TERRIBLE_PURPOSE_INPUTS.group, TERRIBLE_PURPOSE_INPUTS.entries);
const THRALL_ARRIVED = withInsertStandIns(await CharacterSnapshot.load("../mockup/lightbearer-arrived.json"));
const THRALL_SETTLED = withInsertStandIns(await CharacterSnapshot.load("../mockup/lightbearer.json"));

/* ── Tabs ────────────────────────────────────────────────────────────────────
   The shipped strip, unchanged: a horizontal row of named tabs under the band.

   This deck drew a 44px vertical rail of icons instead, on the argument that a screen is wider than
   it is tall so width is the cheaper axis. It is not kept, for two reasons that both come from the
   sheet rather than from the argument. The strip is one of the few things on this sheet that is
   ALREADY art-framed — `tab-half-frame`, listed in the design system's enclosure audit — so
   replacing it threw away a drawn component to save 44px. And icons alone name seven tabs by
   guesswork: "Possessions" and "Outfit" are a gem and a shield, which is exactly the pair a reader
   has to learn rather than read.

   `.item` and the `active` class are the shipped contract; everything visual comes from the
   shipped stylesheet, so this markup is a copy of `character.hbs` and not a second design.

   An insert's tab goes straight after the Playbook's, not after Notes where the shipped sheet appends
   it: an insert is a fragment of a playbook, and Notes is the one tab that should always be last.
   Measured, the strip has room for one insert tab at 1180px and none at 760 — see NOTES.md. That is
   the strip's problem to solve, whatever holds the inserts, and a translation already has it. */

const TABS = [
	["playbook", "Playbook"],
	["moves", "Moves"],
	["possessions", "Possessions"],
	["inventory", "Outfit"],
	["arcana", "Arcana"],
	["followers", "Followers"],
	["notes", "Notes"],
];

const tabsFor = snap => [TABS[0], ...snap.inserts.map(i => [i.tabId, i.name]), ...TABS.slice(1)];

const tabstrip = (active, snap) => `
<nav class="sheet-tabs tabs" data-group="primary">
	${tabsFor(snap).map(([id, label]) => `<button type="button" class="item${id === active ? " active" : ""}"
		data-tab="${id}">${esc(label)}</button>`).join("")}
</nav>`;

/* ── Moves ───────────────────────────────────────────────────────────────────
   ONE list, one row, one layout, and two moments: the moves you have, which you read constantly, and
   choosing a new one, which happens once a level. Choosing is not another screen — it is this list
   with the rest of the playbook's moves in it, in the book's order, each with its take boxes.

   There is no summary strip. "9 taken · 25 offered · Level 5" counted rows the reader can see and
   printed a level with nothing saying why; what it was reaching for is whether a move is OWED, and
   that is stated in the Level Up move's own words, only while it is true. Level appears on this tab
   only where it is a reason — in a requirement — because the portrait already says it.

   The playbook's note ("You start with Well Versed…") is an instruction for choosing, so it rides the
   bar while choosing and not the rest of the time. */

const movesTab = (S, { choosing = false, open = new Set() } = {}) => {
	const cat = S.playbookCategory;
	const taken = cat.moves.filter(m => m.isTaken);
	const shown = choosing ? cat.moves : taken;
	const owed = S.owedMoves;

	return `<div class="rd-tab-body">
		${panel({
			bar: bar({
				title: cat.label,
				note: choosing ? cat.note : null,
				// The door is on the bar, as every section's is: Change, and Done while choosing.
				action: choosing
					? `<button type="button" class="rd-bar-action" data-door="moves" aria-expanded="true">Done</button>`
					: `<button type="button" class="rd-bar-action" data-door="moves" aria-expanded="false">Change</button>`,
			}),
			body: `${owed ? `<div class="rd-conditional rd-conditional--ready rd-owing">
					<p class="rd-owing-text"><strong>Level Up</strong> ${S.chooseMoveText}</p>
					${choosing ? "" : `<button type="button" class="rd-door-btn" data-door="moves"
						aria-expanded="false">Choose</button>`}
				</div>` : ""}
				<ol class="rd-rows">${shown.map(m => moveRow(m, {
					// Every answer here is the SURFACE's, hard-coded the way `basicMoves` hard-codes the
					// rail's, so no caller can ask for a different row.
					hover: true,
					chat: true,
					choosing,
					// Choosing is done on the words (D2), so every row is open while choosing: a move
					// cannot be weighed on its name, and Well Versed's topics are in its body.
					open: choosing || open.has(m.slug),
				})).join("")}</ol>`,
		})}
	</div>`;
};

/* ── Sections ──────────────────────────────────────────────────────────────
   D11: every choice on the sheet rests on what was chosen, and opens to everything on offer. The
   Playbook tab and an insert's tab are both made of these, because an insert is a fragment of a
   playbook (`inserts.md`) — moves, choices, sometimes an instinct — and the same shape is drawn the
   same way.

   What is inside a section is the SHIPPED sheet's markup, not this deck's: `choice-row.hbs` while
   choosing and `choice-group-condensed.hbs` at rest, and the playbook's own partials for background,
   instinct, origin and the introductions. What this deck adds is the panel around each section and
   its door. An earlier draft drew chips and bare radios of its own; they were not a proposal, only a
   failure to look.

   Choosing hides nothing on offer — every background's own picks, every invocation's words. A choice
   cannot be made on something the reader has to go and open first.

   There is no lock. The shipped tab has one toggle for the whole playbook and one per insert, which
   made changing an instinct at a level-up a matter of opening everything. Here each section has its
   own door, on its bar where Done goes, and what the reader opened is kept under the section's key.
   The door costs no height, and that was not where the height was going anyway — it was the single
   column, which put the background's paragraph above everything else. The shipped locked screen's
   two columns are what fit the tab on one screen, so they are kept.

   A section RESTS unless the reader opened it. Opening everything is an event rather than a standing
   state: gaining an insert opens its sections, as choosing a playbook would open the playbook's. A
   section with nothing chosen otherwise rests as its bar and its door — Maelen never answered her
   arcana questions, and that is not a reason for them to fill her tab for the rest of the campaign. */

const isOpen = section => STATE.choosing[section.key] ?? false;

const doorFor = section => section.isChosen ? "Change" : "Choose";

const description = htmlText => htmlText ? `<div class="stonetop-choice-description">${htmlText}</div>` : "";

/** One choice group as a section. */
const choicePanel = (section, { title = section.title, note = null } = {}) => {
	if (section.isProse) return sectionPanel({ key: section.key, title, restBody: description(section.leadHtml) });
	return sectionPanel({
		key: section.key, title, note, open: isOpen(section), door: doorFor(section),
		restBody: condensedBlocks(section.condensed, { omitTitle: title }),
		openBody: choiceRows(section, { omitTitle: title }),
	});
};

/* ── Playbook ────────────────────────────────────────────────────────────────
   The shipped locked screen's layout: the background in one column, instinct, appearance and origin
   in the other, and the playbook's own section and the introductions across both underneath. Two
   FIXED columns, each section assigned to one, rather than the shipped tab's flowed columns — a flow
   rebalances when a section opens, and a section jumping columns under the reader's pointer is the
   board's "nothing re-orders under a tick" failure. Measured at the deck's width: one column showed
   the background and the instinct; two show the whole tab. */

/* The shipped section headings' own instructions (`stonetop.character.selection.*` in en.json — the
   deck has no i18n). They are the heading's grey aside on the real sheet; here they ride the bar while
   the section is open, as the Moves tab's note does. */
const CHOOSE_ONE = "(Choose 1)";
const APPEARANCE_NOTE = "Choose 1 on each line, or make something up:";
const ORIGIN_NOTE = "Stonetop is your home, or close enough, but where are you (or your family) from originally? Pick 1 and a name to match (or make up something similar).";

/**
 * The instinct, which the masthead reads and this edits — `instinct-section.hbs`. One value, one
 * editor: at rest the computed label with its tick, open the write-in box and the options.
 *
 * An insert's instinct replaces the playbook's, and the playbook's is kept rather than cleared — give
 * the insert up and it is back. So while an insert's is in force this section says so, and where.
 * That sentence is the one thing here the shipped section does not have.
 */
const instinctPanel = (section, { setAsideBy = null } = {}) => sectionPanel({
	key: section.key, title: "Instinct", note: CHOOSE_ONE, open: isOpen(section), door: doorFor(section),
	restBody: section.isChosen ? `${tickedLine(esc(section.label), { klass: setAsideBy ? "is-set-aside" : "" })}
		${setAsideBy ? `<p class="stonetop-section-note rd-set-aside">Set aside while
			<button type="button" class="rd-goto" data-goto="${esc(setAsideBy.tabId)}">the ${esc(setAsideBy.name)}'s</button>
			is in force.</p>` : ""}` : "",
	openBody: `<input type="text" class="stonetop-instinct-custom" aria-label="Custom instinct"
			data-instinct-custom="${esc(section.key)}" value="${esc(section.label)}" placeholder="Write your own instinct…">
		${choiceRows(section.choices, { klass: "stonetop-instinct-options" })}`,
});

/**
 * The background, as `tab-playbook.hbs` draws it: the option's card with its track, its words, and its
 * own picks under them. At rest, the one chosen, its picks read back. Choosing, all three, EACH with
 * its own picks — which arcanum an Antiquarian starts with is part of what the background is, and not
 * something to find out by picking it.
 *
 * One departure in structure, not in look: the shipped card is a <label> with the picks inside it,
 * which nests labels. Here the header is the label, so the radio still takes a click on the name.
 */
const backgroundCard = (option, { choosing }) => `
	<div class="stonetop-item${option.selected ? " is-checked" : ""}">
		<${choosing ? "label" : "div"} class="stonetop-item-header">
			${choosing ? `<input type="radio" class="stonetop-item-check" name="rd-background"
				data-background="${esc(option.slug)}"${option.selected ? " checked" : ""}>` : ""}
			<strong class="stonetop-item-name">${option.labelHtml}</strong>
			${option.resource ? track(option.resource, option.label) : ""}
		</${choosing ? "label" : "div"}>
		${option.descriptionHtml ? `<div class="stonetop-item-description">${option.descriptionHtml}</div>` : ""}
		${option.choices ? `<div class="stonetop-bg-choices">${choosing
			? choiceRows(option.choices)
			: condensedBlocks(option.choices.condensed)}</div>` : ""}
	</div>`;

const backgroundPanel = section => sectionPanel({
	key: section.key, title: "Background", note: CHOOSE_ONE, open: isOpen(section), door: doorFor(section),
	restBody: section.chosen ? backgroundCard(section.chosen, { choosing: false }) : "",
	openBody: section.options.map(option => backgroundCard(option, { choosing: true })).join(""),
});

/**
 * Where the family came from, and a name to match — `tab-playbook.hbs`'s regions, each with its names
 * as a comma-separated run of buttons that name the character. Gordin's Delve prints no names and the
 * book says to borrow one, so it says that rather than showing an empty line (NOTES: an empty list is
 * an instruction, not a failure to load).
 *
 * At rest the region is a ticked line like the instinct and appearance beside it. The shipped locked
 * tab keeps the region's <strong> — it only drops the radio — which left origin the one bold answer in
 * its column; bold stays where it labels a region beside its radio.
 */
const originPanel = section => sectionPanel({
	key: section.key, title: "Origin & name", note: ORIGIN_NOTE, open: isOpen(section), door: doorFor(section),
	restBody: section.chosen ? tickedLine(esc(section.chosen.region)) : "",
	openBody: section.regions.map(r => `<div class="stonetop-origin-option${r.selected ? " selected" : ""}">
		<label class="stonetop-origin-region"><input type="radio" class="stonetop-item-check" name="rd-origin"
			data-origin="${esc(r.region)}"${r.selected ? " checked" : ""}> <strong>${esc(r.region)}</strong></label>
		<div class="stonetop-origin-names">${r.hasNames
			? r.names.map(n => `<button type="button" class="stonetop-origin-name" data-name="${esc(n)}">${esc(n)}</button>`).join(", ")
			: `<span class="stonetop-section-note">No names of its own — borrow one from another list.</span>`}</div>
	</div>`).join(""),
});

/**
 * The playbook's own section. A group with nothing to choose heads the groups after it — the Seeker's
 * "Collection" over Major Arcanum and Minor Arcana (see LoreSection); a group with no heading before it
 * is a section of its own.
 */
const lorePanel = lore => {
	if (!lore.heading) return choicePanel(lore.groups[0]);
	const lead = description(lore.leadHtml);
	if (lore.isProse) return sectionPanel({ key: lore.key, title: lore.title, restBody: lead });
	return sectionPanel({
		key: lore.key, title: lore.title, open: isOpen(lore), door: doorFor(lore),
		restBody: lore.isChosen ? `${lead}${lore.groups.map(g => condensedBlocks(g.condensed)).join("")}` : "",
		openBody: `${lead}${lore.groups.map(g => choiceRows(g)).join("")}`,
	});
};

/* `introductions-section.hbs`'s eight steps, the same for every playbook — mirroring
   `stonetop.sheet.playbook.introductions` in en.json. The third turn and the two sets of questions are
   the playbook's. */
const INTRO = {
	preamble: "Wait here for everyone else. When everyone's ready, take turns introducing your characters. When <strong><em>someone reveals something and you want to know more</em></strong>, ask them about it. When <strong><em>someone asks you a question</em></strong>, answer it truthfully.",
	step1: "On your first turn, <strong>introduce yourself</strong> by name, pronouns, background, origin, and appearance.",
	step2: "On your second turn, <strong>describe your special possessions</strong> and how you contribute to the village (beyond working the fields).",
	step4: "On your next turn, <strong>answer one of the following</strong>, naming one or more NPCs who live in Stonetop.",
	step5: "Go around again. Answer another question from 4, or pass. When everyone has passed, go on.",
	step6: "On your next turn, <strong>ask your fellow PCs one of these</strong>. When others ask you, answer as you like.",
	step7: "Go around again. Ask another question from 6, or pass. When everyone has passed, go on.",
	step8: "Add your home to the steading playbook. When everyone is done, let spring break forth!",
};

const introStep = (n, body) => `<div class="stonetop-intro-step"><span class="stonetop-intro-step-num">${n}</span>${body}</div>`;

/**
 * A procedure for the whole table — the book says to settle nothing until the group is ready — so it
 * is opened, not chosen. At rest it is the shipped locked view: the answers, and only those.
 */
const introductionsPanel = intro => sectionPanel({
	key: intro.key, title: "Introductions", open: STATE.choosing[intro.key] ?? false,
	door: intro.hasAnswers ? "Change" : "Open",
	restBody: `${condensedBlocks(intro.npc.condensed)}${condensedBlocks(intro.pc.condensed)}`,
	openBody: `<p class="stonetop-introductions-preamble">${INTRO.preamble}</p>
		${introStep(1, `<p>${INTRO.step1}</p>`)}
		${introStep(2, `<p>${INTRO.step2}</p>`)}
		${introStep(3, `<p>${intro.step3Html}</p>`)}
		${introStep(4, `<div class="stonetop-intro-questions"><p>${INTRO.step4}</p>${choiceRows(intro.npc)}</div>`)}
		${introStep(5, `<p>${INTRO.step5}</p>`)}
		${introStep(6, `<div class="stonetop-intro-questions"><p>${INTRO.step6}</p>${choiceRows(intro.pc)}</div>`)}
		${introStep(7, `<p>${INTRO.step7}</p>`)}
		${introStep(8, `<p>${INTRO.step8}</p>`)}`,
});

/** Two columns that keep their sections: a section never moves to the other one. */
const columns = (left, right) => `<div class="rd-columns">
	<div class="rd-column">${left}</div>
	<div class="rd-column">${right}</div>
</div>`;

const playbookTab = snap => {
	const p = snap.playbookSections;
	return `<div class="rd-tab-body">
		${p.blurbHtml ? `<div class="stonetop-playbook-intro"><p class="stonetop-playbook-description">${p.blurbHtml}</p></div>` : ""}
		${columns(backgroundPanel(p.background), `
			${instinctPanel(p.instinct, { setAsideBy: snap.instinctInsert })}
			${choicePanel(p.appearance, { title: "Appearance", note: APPEARANCE_NOTE })}
			${originPanel(p.origin)}`)}
		${p.lore.map(lorePanel).join("")}
		${p.introductions ? introductionsPanel(p.introductions) : ""}
	</div>`;
};

/* ── An insert ───────────────────────────────────────────────────────────────
   D12: a tab each, and the WHOLE insert on it, moves included. The book prints an insert as one card
   — Undying says "mark a consequence (see reverse)" — and an arcanum card already carries its own
   moves on this sheet, with the Moves tab leaving them out. Consequences are spent from inside the
   insert's moves, so the two are read together or not at all.

   The shipped tab's header — icon, name, how it arrived, and Remove — then its moves, its instinct and
   each of its sections, drawn as the Playbook tab's are. An insert gained by dying arrives at the worst
   moment with nothing chosen, so it arrives OPEN: its moves because they are new, everything else
   because there is nothing yet to rest on. Gaining one is a small creation.

   Remove stays: Undying's 6- trades a Revenant for a Ghost, and a purpose fulfilled passes you through
   the Last Door. The lock does not: D11. */

const insertHeader = insert => `<div class="stonetop-insert-header">
	${insert.img ? `<img class="stonetop-insert-icon" src="${esc(insert.img)}" alt="${esc(insert.name)}">` : ""}
	<div class="stonetop-insert-heading">
		<h3 class="stonetop-insert-name">${esc(insert.name)}</h3>
		${insert.descriptionHtml ? `<div class="stonetop-insert-description">${insert.descriptionHtml}</div>` : ""}
	</div>
	<div class="stonetop-insert-actions">
		<button type="button" class="stonetop-insert-remove" data-remove-insert="${esc(insert.slug)}"
			title="Remove" aria-label="Remove">
			<img src="/systems/stonetop/assets/ui/controls/delete-icon.png" alt="Remove">
		</button>
	</div>
</div>`;

/**
 * The insert's sections in the pack's order, split into the Playbook tab's two fixed columns: the
 * first half down the left, the rest down the right. Split by count, not by height — a split by
 * height would move a section across when one opens.
 */
const insertSections = insert => {
	const panels = [
		...(insert.instinct ? [instinctPanel(insert.instinct)] : []),
		...insert.sections.map(section => choicePanel(section, { title: section.title ?? insert.name })),
	];
	const half = Math.ceil(panels.length / 2);
	return panels.length > 1
		? columns(panels.slice(0, half).join(""), panels.slice(half).join(""))
		: panels.join("");
};

const insertTab = (snap, tabId) => {
	const insert = snap.insertByTab(tabId);
	return `<div class="rd-tab-body">
		${insertHeader(insert)}
		${insert.moves.length ? panel({
			bar: bar({ title: `${insert.name} moves` }),
			body: `<ol class="rd-rows">${insert.moves.map(m => moveRow(m, {
				hover: true, chat: true, open: STATE.open.has(m.slug) })).join("")}</ol>`,
		}) : ""}
		${insertSections(insert)}
	</div>`;
};

/* ── Possessions ─────────────────────────────────────────────────────────────
   The moves tab's shape, with a possession in each row: what you have at rest, and choosing as the
   same list with the rest of the playbook's offer in it. The budget is the playbook's own sentence
   ("Pick 2, in addition to your scribe's tools"), said only while something is still to pick — the
   Picked / Granted / Offered strip counted rows the reader could see, as the moves tab's did. */

const possessionsTab = (S, { choosing = false } = {}) => {
	const list = S.possessions;
	const shown = choosing ? list.items : list.items.filter(p => p.isTaken);
	const owed = list.owed;
	return `<div class="rd-tab-body">
		${panel({
			bar: bar({
				title: "Special Possessions",
				note: choosing ? list.note : null,
				action: choosing
					? `<button type="button" class="rd-bar-action" data-door="possessions" aria-expanded="true">Done</button>`
					: `<button type="button" class="rd-bar-action" data-door="possessions" aria-expanded="false">Change</button>`,
			}),
			body: `${owed ? `<div class="rd-conditional rd-conditional--ready rd-owing">
					<p class="rd-owing-text">${choosing ? "" : `${esc(list.note)} · `}${owed} still to pick</p>
					${choosing ? "" : `<button type="button" class="rd-door-btn" data-door="possessions"
						aria-expanded="false">Choose</button>`}
				</div>` : ""}
				<ol class="rd-rows">${shown.map(p => possessionRow(p, { choosing })).join("")}</ol>`,
		})}
	</div>`;
};

/* ── Followers ───────────────────────────────────────────────────────────────
   D8: the two follower moves go with the followers, ONCE — the book reprints them wherever followers
   are recorded because paper cannot link, and a character with four followers does not need four
   copies of Order Followers. At the top of the tab, since ordering a follower means reading that
   follower's tags anyway, and this is where they are.

   Only while there is someone to order. With no followers they are two rows about nobody, and the
   compendium still has them for a player who wants to read ahead.

   The moves tab's row, with the moves tab's width, so it takes the moves tab's options. Neither move
   rolls: Order Followers is how the moves a follower triggers get rolled, not a roll of its own. */

const followersTab = S => `<div class="rd-tab-body">
	${S.hasFollowers ? panel({
		bar: bar({ title: "Follower Moves" }),
		body: `<ol class="rd-rows">${S.followerMoves.map(m => moveRow(m, { hover: true, chat: true })).join("")}</ol>`,
	}) : ""}
	<p class="mk-undrawn">The follower cards are not drawn in this deck — only the moves that sit above
		them.</p>
</div>`;

/* ── Frames ──────────────────────────────────────────────────────────────── */

// The class list is load-bearing. Most of the system's stylesheet is scoped `.stonetop.sheet.character`
// — 600+ rules, including every stat frame, every bracket and the cap on the playbook crest — so a
// root missing `sheet character` inherits almost none of it and the shipped components draw wrong.
// `application` stays off: that one lays a window out absolutely, and a deck is a document.
// `.sheet-wrapper` is not decoration either: the shipped fold is written against it
// (`.sheet-wrapper.top-collapsed .sheet-top { display: none }`, and the ledger's `:not()` handoff),
// so putting it here means the deck folds on the shipped rules rather than on a second copy of them.
// It has to be a DESCENDANT of the root — those selectors are two elements, not one.
// `character-main` earns its place the same way: it is what makes the band and the tab strip keep
// their natural height while the body below them grows.
const sheet = ({ tab, body, snapshot = S, folded = false }) => `
<div class="rd stonetop sheet character actor themed theme-light rd-sheet">
	<div class="sheet-wrapper rd-wrapper${folded ? " top-collapsed" : ""}">
		${rail(snapshot)}
		<div class="rd-main character-main">
			${band(snapshot)}
			${tabstrip(tab, snapshot)}
			${body}
		</div>
	</div>
</div>`;

/* ── One sheet, not thirteen ──────────────────────────────────────────────────
   The deck used to draw thirteen full sheets, one per state. That was right when nothing was live: a
   still was the only way to show a folded band. It is not right now — the fold, the rail, the
   disclosure, the hover card and the ailments editor all work — and thirteen renderings of one band
   is thirteen chances for one of them to drift. They did: "The rail, at rest" and "The band, folded"
   ended up identical, because a frame's fold state was whatever it had last been left in.

   So: ONE sheet. Anything reachable by using it has no frame — you press the thing. What is left is
   state the sheet cannot be argued into, and that is a CONTROL rather than a copy: experience at a
   threshold, hit points at zero, a level-up owing a move, the window at a laptop's height. The notes that
   sat under each frame are keyed to those controls, so the argument arrives with the state. */

const STATE = {
	tab: "moves", xp: 7, hp: 13, owing: 0, possessionsOf: "maelen", followers: "maelen", inserts: "none",
	window: "wide",
	// Each list chooses on its own: choosing a move says nothing about possessions.
	choosing: { moves: false, possessions: false },
	// What the sheet would have saved and re-rendered from: take counts by slug, and pick marks in
	// the order they were made. Possessions are kept per list, so ticking Maelen's Distillery does not
	// tick the Heavy's.
	takes: {}, picks: [], open: new Set(),
	possessionEdits: { maelen: { taken: {}, picks: [] }, heavy: { taken: {}, picks: [] } },
	// The playbook's and the inserts' sections, in the order the edits were made: what was ticked,
	// written in, or picked, each addressed by the section's key.
	marks: [], answers: [], instincts: [], background: null, origin: null, name: null, removed: [],
};

/* A take made while the level-up is owing pays it down, and clearing one owes it back — the real
   sheet recounts `chosenMoveCount`, and this is that count's difference from the capture. */
const takesSinceCapture = st => Object.entries(st.takes).reduce((sum, [slug, n]) =>
	sum + n - (S.playbookCategory.moves.find(m => m.slug === slug)?.timesTaken ?? 0), 0);

const snapshotFor = st => {
	let snap = S;
	if (st.xp !== 7) snap = snap.withVitals({ xp: { value: st.xp } });
	if (st.hp !== 13) snap = snap.withVitals({ hp: { value: st.hp } });
	for (const [slug, n] of Object.entries(st.takes)) snap = snap.withTimesTaken(slug, n);
	for (const [slug, pick, marked] of st.picks) snap = snap.withPickMarked(slug, pick, marked);
	if (st.owing) snap = snap.withLevelUpOwing(Math.max(0, st.owing - takesSinceCapture(st)));
	if (st.possessionsOf === "heavy") snap = snap.withPossessionsOf(HEAVY);
	if (st.followers === "none") snap = snap.withFollowers([]);
	if (st.inserts !== "none") snap = snap.withInsertsOf(st.inserts === "arrived" ? THRALL_ARRIVED : THRALL_SETTLED);
	for (const slug of st.removed) snap = snap.withoutInsert(slug);
	if (st.background) snap = snap.withBackground(st.background);
	if (st.origin) snap = snap.withOrigin(st.origin);
	if (st.name) snap = snap.withName(st.name);
	for (const [key, item, marked] of st.marks) snap = snap.withMarked(key, item, marked);
	for (const [key, item, value] of st.answers) snap = snap.withAnswer(key, item, value);
	for (const [key, text] of st.instincts) snap = snap.withInstinctWritten(key, text);
	const edits = st.possessionEdits[st.possessionsOf];
	for (const [slug, taken] of Object.entries(edits.taken)) snap = snap.withPossessionTaken(slug, taken);
	for (const [slug, option, marked] of edits.picks) snap = snap.withPossessionPick(slug, option, marked);
	return snap;
};

/* Four tabs are drawn, the top of a fifth, and a tab for each insert. The rest are named honestly
   rather than faked: a mockup showing an empty Arcana tab is claiming something about Arcana. */
const TAB_BODIES = {
	moves: st => movesTab(snapshotFor(st), { choosing: st.choosing.moves, open: st.open }),
	possessions: st => possessionsTab(snapshotFor(st), { choosing: st.choosing.possessions }),
	playbook: st => playbookTab(snapshotFor(st)),
	followers: st => followersTab(snapshotFor(st)),
};

const notDrawn = id => `<div class="rd-tab-body"><p class="mk-undrawn">
	The <b>${esc(id)}</b> tab is not drawn in this deck. The band, the rail and the row are what is being
	proposed; this tab would be built from the same panel, bar and row as the three that are.</p></div>`;

const bodyFor = st => {
	// The tab numbers its own bars, so switching tabs cannot change the rail's or the band's textures.
	resetBarSequence();
	if (snapshotFor(st).insertByTab(st.tab)) return insertTab(snapshotFor(st), st.tab);
	return (TAB_BODIES[st.tab] ?? (() => notDrawn(st.tab)))(st);
};

const CONTROLS = [
	{ key: "xp", label: "Experience", options: [
		{ v: 7, label: "7 / 16" }, { v: 16, label: "at the threshold" }, { v: 21, label: "past it" } ] },
	{ key: "hp", label: "Hit points", options: [
		{ v: 13, label: "13 / 18" }, { v: 0, label: "Death's Door" } ] },
	{ key: "owing", label: "Level up", options: [
		{ v: 0, label: "nothing owed" }, { v: 1, label: "owes a move" } ] },
	{ key: "possessionsOf", label: "Possessions", options: [
		{ v: "maelen", label: "Maelen's" }, { v: "heavy", label: "a Heavy's" } ] },
	{ key: "followers", label: "Followers", options: [
		{ v: "maelen", label: "Maelen's four" }, { v: "none", label: "none" } ] },
	{ key: "inserts", label: "Inserts", options: [
		{ v: "none", label: "none" }, { v: "arrived", label: "Thrall, just arrived" },
		{ v: "settled", label: "Thrall, settled" } ] },
	{ key: "window", label: "Window", options: [
		{ v: "wide", label: "1180 × 720" },
		{ v: "laptop", label: "600px laptop" },
		{ v: "narrow", label: "760px narrow" } ] },
];

/* The frame captions, rehomed: a note appears when the state it argues for is the one on screen. */
const NOTES = {
	always: `<b>The band</b> is 190px open and 95px folded, against 229 + 44 shipped — the picture and
		the three vitals are in the rail, visible from every tab instead of costing every tab the same
		height. <b>Press Stats</b> to fold it: both densities are in the markup and one class picks, so
		folding reveals rather than moves. The conditions ride their stat PAIRS on the folded line,
		because <code>stats-and-conditions.md</code> says which stats a condition hinders "has to be
		knowable before it is marked" — and the shipped folded line cannot answer that.`,
	rail: `<b>The rail carries two move groups</b>: the ten basic moves, open, and the ten expedition
		moves, <b>shut</b> — press the bar to open them. On the road they fire as often as the basic
		ones, and three of them roll, so they get the same row; between expeditions a shut group costs
		one bar. Split into <b>setting out, on the road, getting home</b>, from a stand-in: the packs
		do not say which phase a move is for yet.`,
	"xp:16": `Sixteen of sixteen. Three things appear that were absent a point ago: the ready note,
		the <b>Level Up</b> offer under the bar, and <b>Burn Brightly</b> under that. They are two boxes
		because they share a threshold and nothing else. Levelling is <em>at home</em>, and the offer
		opens by saying so before the move's own trigger. Burning is after any roll, anywhere, so it sits
		on a neutral edge under <b>Or spend it now</b>.`,
	"xp:21": `Experience does not stop at the threshold. Burn Brightly triggers on <em>having enough to
		Level Up</em>, so every 2 points above the line is another roll that can be pushed. The track
		rescales and <b>the threshold becomes a mark on it</b> rather than its end.`,
	"hp:0": `Zero hit points is not the bottom of a range, it is a state with its own move attached — so
		Death's Door is here, and only here, as a row that <b>rolls</b>: rolling it is the one thing a
		dying character has to do. What makes a row that appears only at the worst moment safe is the
		compendium: the sheet is not the only copy.`,
	"window:laptop": `Clipped to <b>600px</b> — roughly a 1366×768 laptop once the browser has taken its
		share. Pinned chrome is 190 + 44 open and 95 + 44 folded, against 229 + 44 today.`,
	"window:narrow": `At <b>760px</b> the rail stops being a column and becomes a <b>drawer</b>: shut by
		default, and it slides <em>over</em> the content rather than squeezing it. Below about 900px
		there is not enough width for both — the shipped sheet does the same thing at the same point.
		<b>Press the tab on its edge</b> to bring it out. What makes this safe is the band: the six
		stats are pinned there, so putting the rail away never takes the stat half of a roll with it.
		Driven by a <b>container query</b> on the frame, not the browser window, so the sheet answers to
		the space it is actually in — which is what a Foundry window gives it.`,
	"owing:1": `A level taken with a move still to choose — the shipped strip's other half, which Maelen
		cannot reach on her own: she holds more moves than level 5 gives. The rail says it once, with a
		route; the moves tab says it in the <b>Level Up move's own words</b>, and that is the only place
		the tab mentions levelling. Take a move and it is paid down.`,
	"choosing:moves": `<b>Choosing</b> is the same list with the playbook's other moves in it, in the book's
		order — not a catalogue beside the list — and <b>every row is open</b>, because a move is chosen on
		its words. Every row has <b>one □</b>: taking a move is ticking it.
		The third line says what a move asks of the choice — its requirement, how many times it can be
		taken, and <b>Take again</b> between the first take and the limit. A requirement not met is
		<b>marked, never enforced</b>. Take Well Versed again and it opens, so the topics are marked when
		the move is taken.`,
	"tab:possessions": `The moves tab's row with a possession in it — <b>one skeleton, two contents</b>,
		so the tabs cannot drift into two faces. No roll, die, chat or card: nothing here rolls, and the
		row already says what a card would. The second line <b>wraps</b>, because a possession's
		description is its gear list, not a label for text somewhere else.`,
	"possessionsOf:heavy": `<b>A real Heavy's list</b>, captured from the world the way Maelen was: two
		of six picked, and Weapons of war's "choose up to 3 (now or later)" with Sword and Crossbow
		taken. Only the possessions are borrowed — the band and rail are still Maelen's. Its five
		weapons are always on show, so the third is one tick away.`,
	"choosing:possessions": `Choosing possessions is choosing moves: one □ a row, the playbook's own
		sentence in the bar. A possession the playbook hands over is <b>locked, and says what granted
		it</b> — the shipped sheet's rule, read rather than decided here.`,
	"tab:playbook": `The shipped locked screen's <b>two columns</b>, each section resting on what was
		chosen with <b>its door on its bar</b> — Change, or Choose where nothing is. No counts: how many
		to choose is the book's own instruction, on the bar while choosing. <b>Choosing hides nothing</b>
		— Change the background and every background shows its own arcana. Opening everything is what
		gaining a playbook or an insert does; otherwise a section with nothing chosen is its bar alone,
		which is why Maelen's unanswered <b>Collection</b> costs one line.`,
	"inserts:arrived": `<b>A Thrall, the moment it arrives</b> — borrowed with the Invocations from a
		Lightbearer captured in the dev world. Its tab sits after Playbook. Arriving is a small creation at
		the worst moment, so <b>everything on it is open</b>: the moves because they are new, the rest
		because nothing has been chosen.`,
	"inserts:settled": `<b>The Thrall, settled</b>: an instinct, a master named, an impulse, a purpose, one
		consequence, one mark, and a point of Favor. Its instinct is in force now — the masthead shows it,
		and the Playbook tab says Maelen's own is set aside.`,
	"tab:insert": `<b>The whole insert on its tab, moves included</b> (D12). The book prints it as one
		card, and an arcanum card already carries its own moves; consequences are spent from inside the
		moves, so they are read together. The same sections and doors as the Playbook tab, in two columns
		in the pack's order.`,
	"dying:insert": `Dying with a death insert: the rail draws <b>its</b> zero-hit-point move where Death's
		Door would be — Dark Succor for a Thrall, rolled +Favor. A character already dead does not
		glimpse the Last Door again. Which move replaces it is a stand-in until the packs say so.`,
	"tab:followers": `<b>The follower moves, once</b>, above the followers they are about — not once
		per follower, as paper has to print them. Ordering a follower means reading their tags, and
		their tags are here.`,
	"followers:none": `With <b>no followers</b> the two moves are gone: they are about followers and
		nothing else. The compendium still has them.`,
};

const notesFor = st => ["always", "rail", `xp:${st.xp}`,
	st.hp === 0 && st.inserts !== "none" ? "dying:insert" : `hp:${st.hp}`, `owing:${st.owing}`,
	`possessionsOf:${st.possessionsOf}`, `followers:${st.followers}`, `inserts:${st.inserts}`,
	st.choosing[st.tab] ? `choosing:${st.tab}` : "",
	`window:${st.window}`, st.tab.startsWith("insert-") ? "tab:insert" : `tab:${st.tab}`]
	.filter(k => NOTES[k]).map(k => `<p class="mk-note">${NOTES[k]}</p>`).join("");

const controlStrip = st => `
<div class="mk-controls">
	${CONTROLS.map(c => `<div class="mk-control">
		<span class="mk-control-label">${esc(c.label)}</span>
		${c.options.map(o => `<button type="button" class="mk-opt${String(st[c.key]) === String(o.v) ? " is-on" : ""}"
			data-control="${esc(c.key)}" data-value="${esc(o.v)}">${esc(o.label)}</button>`).join("")}
	</div>`).join("")}
</div>`;

const deckEl = document.getElementById("deck");

/* The fold is a property of the live DOM rather than of `STATE`, because it is reached by pressing
   Stats — which is the point of it being live. A re-render would silently open a folded band, so the
   class is carried across. */
const render = () => {
	const wasFolded = deckEl.querySelector(".rd-wrapper")?.classList.contains("top-collapsed");
	// The rail's groups, for the fold's reason: the reader opened or shut them, and a re-render
	// would silently put them back.
	const groupsOpen = [...deckEl.querySelectorAll("[data-group-toggle]")]
		.map(btn => [btn.getAttribute("aria-controls"), btn.getAttribute("aria-expanded") === "true"]);
	// And the list's scroll, for the same reason: taking a move on the twentieth row saves and
	// re-renders, and the real sheet restores its scroll across that (core does) — so must this.
	const scrolled = { tab: deckEl.querySelector(".sheet-tabs .item.active")?.dataset.tab,
		top: deckEl.querySelector(".rd-tab-body")?.scrollTop ?? 0 };
	deckEl.innerHTML = `
<header class="mk-head">
	<h1>Stonetop — the carded sheet</h1>
	<p>Maelen, 5th-level Seeker. Foundry's own stylesheet, the system's CSS, fonts and decor art, and the
	same captured context the first deck uses.</p>
	<p class="mk-warn">One sheet, live. Every state reachable by using it — folding the band, opening a
	move, hovering a row, editing ailments, changing tab — is reached that way. The controls below are
	only for states the sheet cannot be argued into.</p>
	${controlStrip(STATE)}
</header>
<div class="mk-deck">
	<div class="mk-stage mk-stage--${STATE.window}">
		${sheet({ tab: STATE.tab, body: bodyFor(STATE), snapshot: snapshotFor(STATE) })}
	</div>
	<aside class="mk-notes">${notesFor(STATE)}</aside>
</div>`;
	if (wasFolded) deckEl.querySelector(".rd-wrapper")?.classList.add("top-collapsed");
	for (const [id, open] of groupsOpen) {
		const btn = deckEl.querySelector(`[data-group-toggle][aria-controls="${id}"]`);
		if (btn) setGroupOpen(btn, open);
	}
	const body = deckEl.querySelector(".rd-tab-body");
	if (body && scrolled.tab === STATE.tab) body.scrollTop = scrolled.top;
	// A drawer's resting state is shut. The rail is a column at full width and a drawer below about
	// 900px, and the difference is not only how it is drawn — a column is furniture you read past, a
	// drawer is something you open. It should not open itself.
	if (STATE.window === "narrow") deckEl.querySelector(".rd-sheet")?.classList.add("is-rail-collapsed");
	wire(deckEl);
};

document.addEventListener("click", e => {
	const opt = e.target.closest("[data-control]");
	if (opt) {
		const raw = opt.dataset.value;
		// Booleans, numbers and names all arrive as strings from the attribute.
		STATE[opt.dataset.control] = raw === "true" ? true : raw === "false" ? false
			: /^-?\d+$/.test(raw) ? Number(raw) : raw;
		if (opt.dataset.control === "inserts") arriveInserts(raw);
		render();
		return;
	}
	// The tab strip is live now, which is what retires three of the old frames.
	const tab = e.target.closest(".sheet-tabs .item");
	if (tab) { STATE.tab = tab.dataset.tab; render(); }
});


/* ── Inserts arriving ────────────────────────────────────────────────────────
   A control, because the Thrall's two states are two captures. Edits made to one capture's insert do
   not carry to the other, and what was given up comes back.

   The Thrall ARRIVES OPEN: its moves are new, and how much of a move needs showing is a property of
   the reader's relationship to it (D2), which for a move granted a moment ago is none. The real sheet
   does this by seeding the reader's open rows when the insert lands; here the control does it. And the
   sheet goes to the insert's tab, since that is where the next thing to do is. */

const arriveInserts = value => {
	const ownedByInsert = ([key]) => !String(key).startsWith("insert-");
	STATE.marks = STATE.marks.filter(ownedByInsert);
	STATE.answers = STATE.answers.filter(ownedByInsert);
	STATE.instincts = STATE.instincts.filter(ownedByInsert);
	STATE.removed = [];
	for (const key of Object.keys(STATE.choosing)) if (key.startsWith("insert-")) delete STATE.choosing[key];
	// Settled is later: the reader has read them by now, and shut what they know. Arriving opens
	// the insert's sections too — there is nothing on them yet to rest on.
	const arriving = THRALL_ARRIVED.insertByTab("insert-thrall");
	STATE.open = value === "arrived" ? new Set(arriving.moves.map(m => m.slug)) : new Set();
	if (value === "arrived") {
		for (const key of [arriving.instinct?.key, ...arriving.sections.map(s => s.key)].filter(Boolean)) {
			STATE.choosing[key] = true;
		}
		STATE.tab = "insert-thrall";
	} else if (STATE.tab.startsWith("insert-") && value === "none") {
		STATE.tab = "playbook";
	}
};

/* ── Opening at a door ───────────────────────────────────────────────────────
   A door redraws the sheet, so the panel that grows is a new element: its height is read before the
   redraw and the new panel, found again by its door, slides from there to its own. The list's scroll
   is put back after the new panel is pinned — restored before, it was clamped to the shorter page a
   closing panel leaves and the list jumped up. */

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const panelBefore = door => ({
	height: door.closest(".rd-panel")?.offsetHeight ?? null,
	scroll: deckEl.querySelector(".rd-tab-body")?.scrollTop ?? 0,
});

const slideDoorPanel = (selector, before) => {
	const el = deckEl.querySelector(selector)?.closest(".rd-panel");
	if (!el || before.height == null) return;
	slideHeight(el, before.height, el.offsetHeight, { reduced: reducedMotion() });
	const list = deckEl.querySelector(".rd-tab-body");
	if (list) list.scrollTop = before.scroll;
};

/* ── A section's door, and what is chosen inside it ──────────────────────────
   D11. The door on the bar opens a section and Done shuts it, and what the reader said is kept under
   the section's key. Every open section got that way through its door, an arrival or a route, so a
   pick made inside one needs nothing more to stay open. */

document.addEventListener("click", e => {
	const door = e.target.closest("[data-section-door]");
	if (door) {
		const key = door.dataset.sectionDoor;
		const before = panelBefore(door);
		STATE.choosing[key] = door.getAttribute("aria-expanded") !== "true";
		STATE.open = openRows();
		render();
		slideDoorPanel(`[data-section-door="${CSS.escape(key)}"]`, before);
		return;
	}
	// The instinct readout, and the "set aside" note, both route here: to the tab that edits the
	// instinct, with that section open. The playbook's route is also the level-up review's, which asks
	// about appearance in the same breath, so appearance opens with it.
	const goto = e.target.closest("[data-goto]");
	if (goto) {
		const tab = goto.dataset.goto;
		STATE.tab = tab;
		STATE.choosing[`${tab}/instinct`] = true;
		if (tab === "playbook") STATE.choosing["playbook/appearance"] = true;
		render();
		return;
	}
	const name = e.target.closest("[data-name]");
	if (name) { STATE.name = name.dataset.name; render(); return; }
	const remove = e.target.closest("[data-remove-insert]");
	if (remove) {
		STATE.removed.push(remove.dataset.removeInsert);
		STATE.tab = "playbook";
		render();
	}
});

document.addEventListener("change", e => {
	const mark = e.target.closest("[data-mark]");
	const answer = e.target.closest("[data-answer]");
	const instinct = e.target.closest("[data-instinct-custom]");
	const background = e.target.closest("[data-background]");
	const origin = e.target.closest("[data-origin]");
	if (!mark && !answer && !instinct && !background && !origin) return;
	if (mark) STATE.marks.push([mark.dataset.mark, mark.dataset.item, mark.checked]);
	if (answer) STATE.answers.push([answer.dataset.answer, answer.dataset.item, answer.value]);
	if (instinct) STATE.instincts.push([instinct.dataset.instinctCustom, instinct.value.trim()]);
	if (background) STATE.background = background.dataset.background;
	if (origin) STATE.origin = origin.dataset.origin;
	STATE.open = openRows();
	render();
});

/* ── The rail's toggle ───────────────────────────────────────────────────────
   Live, because a still cannot show it. Inline the rail is `display: none` and the column shrinks
   to the fold strip; below 900px the shipped one becomes a drawer that already slides. Both labels
   ride on the button so the accessible name says what pressing it will do, not what state it is
   in. */

document.addEventListener("click", e => {
	const btn = e.target.closest("[data-rail-toggle]");
	if (!btn) return;
	const collapsed = btn.closest(".rd-sheet").classList.toggle("is-rail-collapsed");
	const label = collapsed ? btn.dataset.labelShow : btn.dataset.labelHide;
	btn.setAttribute("aria-expanded", String(!collapsed));
	btn.setAttribute("aria-label", label);
	btn.title = label;
});

/* ── The rail's move groups ──────────────────────────────────────────────────
   Open and shut in place — the body's `hidden` and the button's state, with no re-render, so opening
   the expedition moves cannot scroll the rail out from under the reader. */

/* What says a group is open or shut — its caret, its label, its class — apart from its body, which a
   click slides and a redraw simply sets. */
const markGroupOpen = (btn, open) => {
	btn.closest(".rd-group")?.classList.toggle("is-shut", !open);
	const label = open ? btn.dataset.labelHide : btn.dataset.labelShow;
	btn.setAttribute("aria-expanded", String(open));
	btn.setAttribute("aria-label", label);
	btn.title = label;
};

const setGroupOpen = (btn, open) => {
	const body = document.getElementById(btn.getAttribute("aria-controls"));
	if (body) body.hidden = !open;
	markGroupOpen(btn, open);
};

/* The caret and the label say "shut" at once; the body slides away before it is hidden. */
document.addEventListener("click", e => {
	const btn = e.target.closest("[data-group-toggle]");
	if (!btn) return;
	const opening = btn.getAttribute("aria-expanded") !== "true";
	const body = document.getElementById(btn.getAttribute("aria-controls"));
	markGroupOpen(btn, opening);
	if (body) slideOpen(body, opening, { reduced: reducedMotion(),
		stillOpen: () => btn.getAttribute("aria-expanded") === "true" });
});

/* ── The door, and the way in from the rail ──────────────────────────────────
   Choosing is not another screen, it is this list with the rest of the rows in it. Three buttons
   reach it — Change on the list's bar, the owing line's Choose, and the rail's route — and Done,
   where Change was, leaves it. */

const setChoosing = (list, choosing) => {
	STATE.choosing[list] = choosing;
	STATE.open = new Set();
	render();
};

document.addEventListener("click", e => {
	const door = e.target.closest("[data-door]");
	if (door) {
		const before = panelBefore(door);
		setChoosing(door.dataset.door, !STATE.choosing[door.dataset.door]);
		slideDoorPanel(`[data-door="${CSS.escape(door.dataset.door)}"]`, before);
		return;
	}
	if (e.target.closest("[data-choose]")) { STATE.tab = "moves"; setChoosing("moves", true); }
});

/* ── Taking a move, and marking what it lets you mark ────────────────────────
   What the real sheet saves and re-renders from. The rows a reader has opened stay open across that
   re-render, and taking a move that has something to mark OPENS it: the choice is made at the moment
   of taking, in place, rather than on some later visit that nothing prompts.

   The box is "you have it", so ticking it is the first take and clearing it clears them all; Take
   again is every take after the first. */

const openRows = () => new Set([...document.querySelectorAll(".rd-tab-body .rd-mrow.is-expanded")]
	.map(li => li.dataset.slug));

const setTimesTaken = (slug, count) => {
	const move = snapshotFor(STATE).playbookCategory.moves.find(m => m.slug === slug);
	STATE.takes[slug] = count;
	STATE.open = openRows();
	if (count > move.timesTaken && move.picks.length) STATE.open.add(slug);
	render();
};

document.addEventListener("click", e => {
	const again = e.target.closest("[data-take-again]");
	if (!again) return;
	const slug = again.dataset.takeAgain;
	setTimesTaken(slug, snapshotFor(STATE).playbookCategory.moves.find(m => m.slug === slug).timesTaken + 1);
});

document.addEventListener("change", e => {
	const take = e.target.closest("[data-take]");
	if (take) {
		setTimesTaken(take.dataset.take, take.checked ? 1 : 0);
		return;
	}
	const pick = e.target.closest("[data-pick]");
	if (pick) {
		STATE.picks.push([pick.dataset.pick, pick.dataset.pickSlug, pick.checked]);
		STATE.open = openRows();
		render();
		return;
	}
	// A possession's box and its options, into the list on screen. Nothing on a possession opens or
	// shuts — its options are always shown — so there is no open state to carry.
	const edits = STATE.possessionEdits[STATE.possessionsOf];
	const ownTake = e.target.closest("[data-take-possession]");
	if (ownTake) {
		edits.taken[ownTake.dataset.takePossession] = ownTake.checked;
		render();
		return;
	}
	const option = e.target.closest("[data-pick-possession]");
	if (option) {
		edits.picks.push([option.dataset.pickPossession, option.dataset.pickSlug, option.checked]);
		render();
	}
});

/* ── The two behaviours a still cannot show ─────────────────────────────────
   The disclosure and the hover card are the proposal's load-bearing pair, so both are live. */

document.addEventListener("click", e => {
	const btn = e.target.closest("[data-expand]");
	if (!btn) return;
	const li = btn.closest(".rd-row");
	const open = li.classList.toggle("is-expanded");
	for (const b of li.querySelectorAll("[data-expand]")) b.setAttribute("aria-expanded", String(open));
	const reduced = reducedMotion();
	slideOpen(li.querySelector(".rd-row-body"), open, { reduced,
		stillOpen: () => li.classList.contains("is-expanded") });
	// The gloss goes the other way on the same curve, so the header gives up its line as the text
	// takes up its own.
	const gloss = li.querySelector(".stonetop-move-gloss");
	if (gloss) slideOpen(gloss, !open, { reduced, stillOpen: () => !li.classList.contains("is-expanded") });
});

/* The card has to be placed by script.
   The rail scrolls, so a card positioned beside a row is clipped by the scroller and never seen;
   `position: fixed` takes it out of that, and fixed means someone has to say where. Pointer AND
   focus, because a card only a mouse can reach is the objection §1 raises in the first place.

   §1 records hover as CONSIDERED AND REJECTED as a density device, and that stands: it is not what
   pays for a one-line row here. Every rail row keeps its caret, the disclosure opens the text in
   flow, and that is the guaranteed path for touch and keyboard alike. The card is a second, faster
   route for a pointer already on the row — additional, never load-bearing. Worth re-reading §1
   against this rather than assuming the distinction holds.

   SC 1.4.13 asks for dismissible, hoverable and persistent. Dismissible is below; hoverable and
   persistent come from the card itself, which is scrollable and stays while the pointer is on the
   row. */
document.addEventListener("keydown", e => {
	if (e.key !== "Escape") return;
	// Dismissible: blur takes the focus-visible path down, and the pointer path is left alone
	// because moving the pointer is itself the dismissal.
	document.activeElement?.closest?.(".rd-mrow") && document.activeElement.blur();
});

/* Every move row, not just the rail's. The tab body is a scroller too — 468px of window over 751px
   of moves — so a card positioned inside it is clipped by exactly the same mechanism that hid the
   rail's, and it needs the same treatment. This used to be scoped to `.rd-rail` because the rail was
   the only surface rendering `moveRow`; now that the moves tab renders it as well, the scope is the
   row itself. */
const placePreviews = root => {
	const place = row => {
		const card = row.querySelector(".rd-preview");
		if (!card) return;
		const b = row.getBoundingClientRect();
		const width = 20 * parseFloat(getComputedStyle(document.documentElement).fontSize);
		const height = Math.min(card.scrollHeight || 260, 0.6 * window.innerHeight);

		// Beside the row, then under it. Beside is the better read — the row stays visible and
		// nothing it is in is covered — but it only works while the row leaves a card's width
		// spare, which a 203px rail row does and an 894px moves-tab row does not. Sent left, that
		// row put its card straight over the rail: 320px of reading matter on top of the ten moves
		// and the portrait, from hovering something 900px away.
		//
		// So a row too wide for either side gets the card UNDER it, at its own left edge — the
		// plain tooltip position, which costs only the rows below and is what the card's own
		// `absolute` fallback always did. Flipped above when there is no room below.
		const fitsRight = b.right + 8 + width < window.innerWidth;
		const fitsLeft = b.left - 8 - width > 0;
		const below = b.bottom + 6 + height < window.innerHeight;
		const [x, y] = fitsRight ? [b.right + 8, b.top]
			: fitsLeft ? [b.left - 8 - width, b.top]
			: [b.left, below ? b.bottom + 6 : b.top - 6 - height];

		const clamp = (v, max) => Math.round(Math.max(8, Math.min(v, max - 8)));
		card.style.setProperty("--rd-preview-x", `${clamp(x, window.innerWidth - width)}px`);
		card.style.setProperty("--rd-preview-y", `${clamp(y, window.innerHeight - height)}px`);
	};
	for (const row of root.querySelectorAll(".rd-mrow")) {
		row.addEventListener("pointerenter", () => place(row));
		row.addEventListener("focusin", () => place(row));
	}
};

/* Ticking a debility marks the two stats it hinders — the confirmation half of requirement 3. The
   mapping itself is carried by the bracket above, which is readable before anything is ticked; this
   only shows the consequence once there is one. */
/* ── Ailments: three rows, and editing ──────────────────────────────────────
   The region gets the band's spare right column and no more. The first three ailments always show;
   past that the list stops and the bar says how many more, rather than growing: this is pinned
   chrome, and a band that gets taller as a character gets hurt spends height on every tab forever.
   The count is the door to the rest, so nothing is hidden without a way to it.

   A fixed three, not a measured fit. Fitting to the stats column's height let the "… more" line take
   a row of its own, and each ailment past the third pushed another out — five showed one. Three rows
   and the bar fit that column at every width, since each row is one line that clips.

   `problematic-wounds.md` says the practical ceiling is a handful — a character carries one or two
   permanent injuries before retiring or adapting becomes the question — so the count is a backstop
   for the rare case, not the normal reading. */

const AILMENTS_SHOWN = 3;

/* ── The band's foot: beside the stats, or under them ────────────────────────
   Beside them when the line fits in the column the ailments share, which saves the band a row; under
   the whole band when it does not, rather than running left over the conditions' labels, which is
   what it did at any sheet under about 1080px with the rail open.

   Measured, because what the line needs is its words, which translate, and what it gets depends on whether the rail is a column — so no one width is the answer.
   It is measured OPEN whatever state the band is in, because the question is about the open layout
   and folded there is no stats column to be beside. That means briefly unfolding it, with motion off,
   inside one task: nothing paints in between, and no transition starts either way.

   The ledger is left out of the count — it is not on the line while the band is open. On the real
   sheet this has to run again when the window is resized, which a Foundry window does without a
   re-render; a ResizeObserver on the band is the shape of that. */

const fitBandFoot = root => {
	const wrapper = root.querySelector(".rd-wrapper");
	const band = wrapper?.querySelector(".rd-band");
	const foot = band?.querySelector(".rd-band-foot");
	if (!foot) return;

	const folded = wrapper.classList.contains("top-collapsed");
	wrapper.classList.add("rd-no-motion");
	wrapper.classList.remove("top-collapsed");
	band.classList.remove("is-foot-under");

	const items = [...foot.children].filter(el => el.offsetWidth > 0);
	const gap = parseFloat(getComputedStyle(foot).columnGap) || 0;
	const needs = items.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0)
		+ gap * Math.max(0, items.length - 1);
	band.classList.toggle("is-foot-under", needs > foot.getBoundingClientRect().width + 0.5);

	if (folded) wrapper.classList.add("top-collapsed");
	void wrapper.offsetHeight;
	wrapper.classList.remove("rd-no-motion");
};

const showFirstAilments = root => {
	const region = root.querySelector(".rd-ailments");
	const list = region?.querySelector(".rd-ailment-list");
	const more = region?.querySelector(".rd-ailments-more");
	if (!list || !more) return;

	const rows = [...list.children];
	rows.forEach((row, i) => { row.hidden = i >= AILMENTS_SHOWN; });
	const hiddenCount = Math.max(0, rows.length - AILMENTS_SHOWN);
	more.hidden = hiddenCount === 0;
	more.textContent = `+${hiddenCount} more`;
	more.setAttribute("aria-label", `Show ${hiddenCount} more ailments`);
};

/* ONE EDITOR, reached three ways — the row you want to change, the + on the bar, or the count of
   the rest beside it. A wound is authored in play (D10's argument for items, and the same moment: something has
   just happened), so adding one cannot be a trip to a directory.

   A panel rather than inline fields. The region shows three rows and may be hiding more, so an inline
   editor would be editing inside the thing that is hiding the row you want — and it is the only
   surface here that has to show EVERY ailment. MOCK: nothing is stored.
   The three states are `problematic-wounds.md`'s: active, stabilized, permanent. */

const STATES = ["active", "stabilized", "permanent"];

const openAilmentEditor = (region, focusRow = null) => {
	region.querySelector(".rd-ailment-editor")?.remove();
	const list = region.querySelector(".rd-ailment-list");
	const wounds = [...list.querySelectorAll(".rd-ailment--wound")];

	const panel = document.createElement("div");
	panel.className = "rd-ailment-editor";
	panel.innerHTML = `
		<p class="rd-ailment-editor-head">Ailments
			<button type="button" class="rd-ailment-close" aria-label="Close">×</button></p>
		<ul class="rd-ailment-editor-list"></ul>
		<button type="button" class="rd-ailment-add">+ add a wound</button>
		<p class="rd-ailment-editor-note">Debilities are marked on the brackets, not here.</p>`;

	const ul = panel.querySelector(".rd-ailment-editor-list");
	const addRow = (name, state) => {
		const li = document.createElement("li");
		li.innerHTML = `
			<input type="text" class="rd-ailment-edit-name" value="${name.replace(/"/g, "&quot;")}"
				aria-label="Ailment name" placeholder="what happened">
			<button type="button" class="rd-ailment-state" data-state="${state}">${state}</button>
			<button type="button" class="rd-ailment-remove" aria-label="Remove">×</button>`;
		ul.append(li);
		return li;
	};
	for (const w of wounds) {
		addRow(w.querySelector(".rd-ailment-name").textContent, w.dataset.state || "active");
	}
	// On the BODY and `position: fixed`, placed by script — not inside the region it edits. The region
	// is a `panel`, and a panel is `overflow: hidden`, so an absolutely-positioned editor inside one is
	// clipped by the box it belongs to: it opened 359px tall and showed about 40 of them. Exactly the
	// trap the rail's hover card hit, and the same answer — out of the clipping context entirely, and
	// fixed means someone has to say where.
	document.body.append(panel);
	const place = () => {
		const b = region.getBoundingClientRect();
		const w = panel.offsetWidth, h = panel.offsetHeight;
		const left = Math.max(8, Math.min(b.right - w, window.innerWidth - w - 8));
		// Under the region, or above it when there is no room below.
		const below = b.bottom + 6;
		panel.style.left = `${Math.round(left)}px`;
		panel.style.top = `${Math.round(below + h < window.innerHeight ? below : Math.max(8, b.top - h - 6))}px`;
	};
	place();
	addEventListener("scroll", place, { passive: true, capture: true });
	addEventListener("resize", place, { passive: true });
	const stopPlacing = () => {
		removeEventListener("scroll", place, { capture: true });
		removeEventListener("resize", place);
	};

	const commit = () => {
		for (const w of wounds) w.remove();
		for (const li of ul.children) {
			const name = li.querySelector(".rd-ailment-edit-name").value.trim();
			if (!name) continue;
			const state = li.querySelector(".rd-ailment-state").dataset.state;
			const row = document.createElement("li");
			row.className = "rd-ailment rd-ailment--wound";
			row.dataset.state = state;
			row.innerHTML = `<span class="rd-ailment-name"></span><span class="rd-ailment-note"></span>`;
			row.querySelector(".rd-ailment-name").textContent = name;
			row.querySelector(".rd-ailment-note").textContent = state === "active" ? "" : state;
			list.append(row);
		}
		region.querySelector(".rd-ailments-empty").hidden = list.children.length > 0;
		showFirstAilments(region.closest(".rd-sheet"));
	};

	panel.addEventListener("click", e => {
		const state = e.target.closest(".rd-ailment-state");
		if (state) {
			const next = STATES[(STATES.indexOf(state.dataset.state) + 1) % STATES.length];
			state.dataset.state = next;
			state.textContent = next;
			return;
		}
		if (e.target.closest(".rd-ailment-remove")) { e.target.closest("li").remove(); return; }
		if (e.target.closest(".rd-ailment-add")) { addRow("", "active").querySelector("input").focus(); return; }
		if (e.target.closest(".rd-ailment-close")) { commit(); stopPlacing(); panel.remove(); }
	});
	panel.addEventListener("input", commit);
	panel.addEventListener("rd-dismiss", () => { commit(); stopPlacing(); panel.remove(); });
	panel.addEventListener("keydown", e => {
		if (e.key === "Escape") { commit(); stopPlacing(); panel.remove(); }
	});

	(focusRow ? panel.querySelectorAll(".rd-ailment-edit-name")[wounds.indexOf(focusRow)] : null)?.focus();
};

document.addEventListener("click", e => {
	const region = e.target.closest(".rd-ailments");
	if (!region) {
		// Outside it: commit and close. A popout that only its own × can dismiss is a trap, and the
		// editor writes through on every keystroke anyway, so there is nothing to lose by leaving.
		if (!e.target.closest(".rd-ailment-editor")) {
			document.querySelector(".rd-ailment-editor")?.dispatchEvent(new CustomEvent("rd-dismiss"));
		}
		return;
	}
	if (e.target.closest(".rd-ailments-more, .rd-ailments-edit")) { openAilmentEditor(region); return; }
	const row = e.target.closest(".rd-ailment--wound");
	if (row) openAilmentEditor(region, row);
});

const syncHindered = root => {
	for (const el of root.querySelectorAll(".stonetop-stat, .stonetop-folded-stat, .rd-pair")) {
		el.classList.remove("is-hindered", "is-active");
	}
	const marked = new Map();
	for (const box of root.querySelectorAll("[data-condition]")) {
		if (box.checked) marked.set(box.dataset.slug, box.dataset.stats ?? "");
	}
	for (const [slug, stats] of marked) {
		root.querySelector(`.rd-pair:has([data-condition][data-slug="${slug}"])`)?.classList.add("is-active");
		for (const key of stats.split(" ").filter(Boolean)) {
			for (const el of root.querySelectorAll(`[data-stat="${key}"]`)) el.classList.add("is-hindered");
		}
	}
	// The marked debilities, as READOUTS in the ailments region. Rebuilt rather than re-rendered,
	// because the band is the one region a reader is certainly looking at when they mark one.
	//
	// Only the debility rows are touched: the wound rows are left exactly as they are, because they are
	// not derived from anything here. Insert before the first wound so the two kinds stay grouped.
	const list = root.querySelector(".rd-ailment-list");
	if (list) {
		for (const row of list.querySelectorAll(".rd-ailment--debility")) row.remove();
		const firstWound = list.querySelector(".rd-ailment--wound");
		for (const b of root.querySelectorAll(".rd-cond [data-condition]")) {
			if (!b.checked) continue;
			const label = b.closest(".rd-cond");
			const full = label.querySelector(".stonetop-visually-hidden").textContent;
			const end = full.indexOf(". ");
			const li = document.createElement("li");
			li.className = "rd-ailment rd-ailment--debility";
			li.innerHTML = `<span class="rd-ailment-name"></span><span class="rd-ailment-note"></span>`;
			li.querySelector(".rd-ailment-name").textContent = label.querySelector(".rd-cond-name").textContent;
			li.querySelector(".rd-ailment-note").textContent = end === -1 ? full : full.slice(0, end + 1);
			list.insertBefore(li, firstWound);
		}
		const empty = root.querySelector(".rd-ailments-empty");
		if (empty) empty.hidden = list.children.length > 0;
		showFirstAilments(root);
	}
};

/* The two ticks for one condition. The bracket in the open band and the circle on the folded line are
   the same fact, and the shipped sheet has both for the same reason — a condition is marked during
   play, and whichever density is on screen has to be able to do it. There it is one change action and
   a re-render; here nothing re-renders, so they are pushed into step by hand. */
const syncConditionChecks = (root, source) => {
	for (const box of root.querySelectorAll(`[data-condition][data-slug="${source.dataset.slug}"]`)) {
		box.checked = source.checked;
	}
};

/* Everything that has to be attached to ELEMENTS rather than to the document, re-run after every
   render. The delegated handlers — the fold, the tab strip, the controls, the ailments editor, the
   rail toggle, the disclosure — are bound once on `document` and survive a re-render untouched; these
   cannot be, because one places a card from its row's own box, one seeds state the markup does not
   carry, and one decides where the band's foot goes from the widths it was just rendered at. */
function wire(root) {
	placePreviews(root);
	for (const sheet of root.querySelectorAll(".rd-sheet")) {
		fitBandFoot(sheet);
		syncHindered(sheet);
		sheet.addEventListener("change", e => {
			if (!e.target.matches("[data-condition]")) return;
			syncConditionChecks(sheet, e.target);
			syncHindered(sheet);
		});
	}
}

render();

/* ── The fold ────────────────────────────────────────────────────────────────
   One class, and the shipped stylesheet does the rest: `.sheet-top` goes, and the ledger line that
   was standing down comes in. Both densities are in the markup at every width, so this REVEALS
   rather than moves — the stats are beside the moves either way, which is the sheet's one structural
   rule and the reason a fold is safe to offer at all.

   The label says what pressing it will DO, not what state the band is in, so the accessible name is
   useful at the moment someone is deciding whether to press it. */

/* The fold, with both ends of the motion pinned in pixels.
 *
 * Done in script rather than CSS, and the reason is measured rather than stylistic. Transitioning to
 * and from `auto` — even with `interpolate-size` — makes the browser re-derive the natural size every
 * frame, and the band's own grid track is `auto` too, sized from content while the item inside it is
 * the thing being animated. The two disagree and get reconciled across several frames: sampled at
 * 50ms, `.sheet-top` reached zero while the foot beside it was still sliding two frames later, and
 * the tab body's top stalled at 291px for a frame before jumping to 278. Frame timing was never the
 * problem — 8.3ms a frame, nothing dropped. Two things easing on different schedules is what read as
 * choppy.
 *
 * So: measure the natural size, set it explicitly, force a reflow, then animate to zero. Both
 * endpoints are definite numbers, the grid track has a definite width to follow every frame, and the
 * inline styles are cleared at the end so the stylesheet owns the resting state again.
 */

/* BOTH halves of the band fold, on one curve. The ailments panel used to be `display: none` under
   `.top-collapsed`, which meant it vanished on the frame the class landed while the numbers beside it
   eased away over 400ms — one half popping and the other sliding is half of what read as choppy.
   They are the same fold and they move together. */
const foldingParts = wrapper => [
	wrapper.querySelector(".rd-band > .sheet-top"),
	wrapper.querySelector(".rd-band > .rd-ailments"),
].filter(Boolean);

/* And the part that moves the OTHER way. Folding is a handoff, not a disappearance — the ledger line
   is the same numbers at the other density and it arrives as they leave. It used to arrive all at
   once, on the frame the class landed: the foot went from 33px to 69px instantly while everything
   else eased over 400ms, which took the band to 221px before it started coming down. Everything in
   the band is now on one curve, in whichever direction it is going. */
const revealingPart = wrapper => wrapper.querySelector(".rd-band .rd-ledger");

/* The ledger is `display: none` while the band is open, so it can only be measured with the class on
   — which is the opposite of everything else here. Same cache-miss story after a re-render. */
const measureLedger = (wrapper, ledger) => {
	const wasFolded = wrapper.classList.contains("top-collapsed");
	ledger.style.transition = "none";
	if (!wasFolded) wrapper.classList.add("top-collapsed");
	ledger.style.height = "auto";
	const size = { w: ledger.offsetWidth, h: ledger.offsetHeight };
	if (!wasFolded) wrapper.classList.remove("top-collapsed");
	ledger.style.height = "";
	void ledger.offsetHeight;
	ledger.style.transition = "";
	NATURAL.set(ledger, size);
	return size;
};

/* The open size of each folding part, remembered from when the band was actually open.
 *
 * Measuring on demand meant stripping `.top-collapsed`, forcing `height: auto` and reading back —
 * and that perturbs the very layout it is measuring: the band jumped to 223px on the first frame of
 * a fold from a resting 190 before easing down, a 33px jolt in the wrong direction. Reading the live
 * boxes while the band is open costs nothing and cannot be wrong, so the sizes are captured on the
 * way down and reused on the way back up.
 */
const NATURAL = new WeakMap();

const rememberOpenSize = el => {
	NATURAL.set(el, { w: el.offsetWidth, h: el.offsetHeight });
	return NATURAL.get(el);
};

/* The fallback, for when the cache has nothing to say.
 *
 * It misses exactly once per element: a control change re-renders the sheet, so the folded band that
 * comes back is made of NEW elements while the remembered sizes are keyed to the old ones. Without
 * this, the first press of Stats after changing a control expanded the band to zero — it stayed shut
 * and looked like the toggle had broken.
 *
 * Measuring means briefly standing the band up with transitions off. That is the thing the cache
 * exists to avoid doing on every fold, but doing it once on a miss is correct and invisible. */
const measureOpenSize = (wrapper, el) => {
	const wasFolded = wrapper.classList.contains("top-collapsed");
	el.style.transition = "none";
	if (wasFolded) wrapper.classList.remove("top-collapsed");
	el.style.width = "auto";
	el.style.height = "auto";
	const size = { w: el.offsetWidth, h: el.offsetHeight };
	if (wasFolded) wrapper.classList.add("top-collapsed");
	el.style.width = "";
	el.style.height = "";
	void el.offsetHeight;
	el.style.transition = "";
	NATURAL.set(el, size);
	return size;
};

document.addEventListener("click", e => {
	const btn = e.target.closest("[data-top-toggle]");
	if (!btn) return;
	const wrapper = btn.closest(".sheet-wrapper");
	const parts = foldingParts(wrapper);
	const ledger = revealingPart(wrapper);
	const folding = !wrapper.classList.contains("top-collapsed");

	const label = folding ? "Show the stats" : "Fold the stats away";
	btn.setAttribute("aria-expanded", String(!folding));
	btn.setAttribute("aria-label", label);
	btn.title = label;

	if (!parts.length) { wrapper.classList.toggle("top-collapsed", folding); return; }

	// Folding: the band is open right now, so its parts can simply be read. Expanding: use what was
	// read on the way down. Either way nothing is measured against a layout that has already moved.
	const sizes = parts.map(el => (folding ? rememberOpenSize(el) : NATURAL.get(el) ?? measureOpenSize(wrapper, el)));

	parts.forEach((el, i) => {
		const from = folding ? sizes[i] : { w: 0, h: 0 };
		el.style.transition = "none";
		el.style.width = `${from.w}px`;
		el.style.height = `${from.h}px`;
	});
	void parts[0].offsetHeight;
	parts.forEach(el => { el.style.transition = ""; });

	// The ledger has to be measured with the class ON — it is `display: none` while the band is open,
	// so there is nothing to read until then. Pinned at zero first so it grows from nothing rather
	// than appearing at full height and shrinking.
	if (ledger) {
		ledger.style.transition = "none";
		ledger.style.height = folding ? "0px" : `${(NATURAL.get(ledger) ?? measureLedger(wrapper, ledger)).h}px`;
	}

	wrapper.classList.toggle("top-collapsed", folding);

	if (ledger) {
		if (folding) {
			ledger.style.height = "auto";
			rememberOpenSize(ledger);
			ledger.style.height = "0px";
		}
		void ledger.offsetHeight;
		ledger.style.transition = "";
		ledger.style.height = folding ? `${(NATURAL.get(ledger) ?? { h: 0 }).h}px` : "0px";
		ledger.addEventListener("transitionend", function settle(ev) {
			if (ev.target !== ledger || ev.propertyName !== "height") return;
			ledger.removeEventListener("transitionend", settle);
			ledger.style.height = "";
		});
	}

	parts.forEach((el, i) => {
		const to = folding ? { w: 0, h: 0 } : sizes[i];
		el.style.width = `${to.w}px`;
		el.style.height = `${to.h}px`;
		// Hand the resting state back to the stylesheet, so an open band is `auto` again and reflows
		// with its own content rather than staying pinned to whatever it measured once.
		el.addEventListener("transitionend", function settle(ev) {
			if (ev.target !== el || ev.propertyName !== "height") return;
			el.removeEventListener("transitionend", settle);
			el.style.width = "";
			el.style.height = "";
		});
	});
});
