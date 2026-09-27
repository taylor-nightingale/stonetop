/**
 * The band, rebuilt against the shipped partials rather than against the data.
 *
 * Almost everything here uses the SHIPPED class names, which means the shipped CSS draws it — the
 * stone frame on a stat tile, the bracket under a stat pair, the label chip punched into the frame's
 * top rule. That is deliberate and it is the whole method: anything that already exists is inherited
 * rather than redrawn, so the only visible differences from the real sheet are the ones this file
 * sets out to make.
 *
 * Read before changing anything here:
 *   actor-stats.hbs      — the abbreviation is the roll button and has to BE a <button>; core binds
 *                          only `click`, so a <span> is keyboard-dead and nothing says so.
 *   debility-bands.hbs   — one bracket per stat PAIR; the pairs are contiguous and cover all six.
 *   folded-ledger.hbs    — the collapsed density. Plain readouts, not tiles: "at line height there
 *                          is no size at which the woodcut frame is a frame rather than a smudge."
 *   character.hbs        — the fold, which runs no JavaScript on the real sheet: both densities are
 *                          always in the markup and one class picks between them.
 *
 * TWO DENSITIES, as shipped. `.sheet-top` folds; the masthead and the foot do not. What is different
 * here is what is left to fold, and it is a consequence of the rail rather than a new idea:
 *
 *   1. HP / Armor / Damage are the RAIL's — they are read from every tab, and in the band they cost
 *      every tab the same height. Out of `.sheet-top`, and out of the folded ledger, where they were
 *      209px of the line.
 *   2. The PICTURE is the rail's too. On the shipped sheet it is the band's right-hand column and the
 *      foot rides under it, which is why the band needs two wrappers and `display: contents` to
 *      dissolve them when it folds. With no picture there is no second column: the band is a plain
 *      flex column of masthead, numbers and foot, and folding is one `display: none`.
 *   3. The conditions ride with their STAT PAIRS on the folded line, where the vitals used to be.
 *      See `foldedLedger` below for why that is not decoration.
 *   4. The starting-stat array is offered as chips while it is still being assigned.
 */
import { esc, panel, bar, resetBarSequence } from "./parts.js";

/* ── Stat tiles ──────────────────────────────────────────────────────────────
   Shipped markup. The abbreviation is the control; the number is an editable field. Both, not one —
   the last deck kept the button and dropped the input, which made every stat read-only. */

const statTile = stat => `
	<div class="stonetop-stat" data-stat="${esc(stat.key)}">
		<button type="button" class="stonetop-stat-roll rollable" data-roll="${esc(stat.key)}"
			aria-label="Roll ${esc(stat.name)}" title="${esc(stat.description)}">${esc(stat.abbr)}</button>
		<input class="stonetop-stat-input" type="number" aria-label="${esc(stat.name)} score"
			value="${esc(stat.value)}" min="-3" max="3">
	</div>`;

/* ── Debility brackets ───────────────────────────────────────────────────────
   Shipped markup, shipped art. Each bracket spans the two stats it hinders, with the tick sitting in
   the gap in the middle of the rule and the name below it.

   The one addition: ticking a debility now marks the two tiles it hinders, which is the treatment
   the FOLDED ledger already gives them (`.is-hindered`) and the open band never did. Confirmation
   after the fact — the bracket is what tells you the mapping beforehand. */

const debilityBand = d => `
	<div class="stonetop-debility${d.active ? " is-active" : ""}">
		<label class="stonetop-debility-control" title="${esc(d.description)}">
			<span class="stonetop-debility-band">
				<span class="stonetop-debility-divider"></span>
				<input type="checkbox" class="stonetop-debility-check" data-condition data-slug="${esc(d.key)}"
					data-stats="${esc((d.stats ?? []).join(" "))}"${d.active ? " checked" : ""}>
			</span>
			<span class="stonetop-debility-label">${esc(d.name)}</span>
			<span class="stonetop-visually-hidden">${esc(d.description)}</span>
		</label>
	</div>`;

/* ── The starting array ──────────────────────────────────────────────────────
   PROPOSED, and standing in for data that does not exist: there is no structured starting-stat field
   anywhere, only the translated sentence in `statsNote`. See NOTES.md → Mock issues, not real bugs.

   Advisory, never a gate: it says what the playbook offered and what is still unplaced. It does not
   stop you typing whatever you like, and it retires itself once everything is assigned. */

const startingArray = snapshot => {
	const offered = snapshot.startingStats;
	if (!offered.length) return "";
	const left = snapshot.unassignedStartingStats;
	if (!left.length) return "";
	// Duplicates matter: +1,+1 means placing one must leave the other showing, so the chips are
	// struck by multiset position rather than by value.
	const struck = [...left];
	return `<p class="rd-array" aria-label="Scores still to assign">
		<span class="rd-array-label">Assign</span>
		${offered.map(v => {
			const i = struck.indexOf(v);
			const used = i === -1;
			if (!used) struck.splice(i, 1);
			return `<span class="rd-array-chip${used ? " is-used" : ""}">${v >= 0 ? "+" : ""}${v}</span>`;
		}).join("")}
	</p>`;
};

/* ── Who this is ─────────────────────────────────────────────────────────────
   Instinct beside the name, with appearance under it.

   IN THE MASTHEAD, which is the part of the band that does not fold — so instinct is on screen at
   both densities and never has to be drawn twice. That is the whole reason it is here rather than on
   the folded line: one value, one editor, and now also one copy. This sheet has been bitten by the
   alternative, and the fix notes why — "two radios sharing a name are one group with one checked
   member, so the copy you could not see was the one the browser kept."

   Beside the name rather than under it. With the picture gone the masthead is the full width of the
   band and the name asks for about 200px of it, so a line that used to be a blank right half is
   where this now sits — which is the same trade the shipped band makes for the picture, spent on
   something that is read every session instead.

   Instinct is the line, appearance the subtext: `less weight than instinct; the same permanence` is
   the book's own pricing of the pair. Both are READOUTS — the editor is the playbook surface, or the
   insert that carries it, since an insert's instinct replaces the playbook's. The name is a route to
   wherever that is. `playbook-and-creation.md` is firm that instinct can change at ANY time it feels
   right, not only at level-up, so the route is not a rare path. */

const who = S => {
	const instinct = S.instinct;
	if (instinct.isEmpty && !S.appearance) return "";
	return `
		<div class="rd-who">
			<span class="rd-who-label">Instinct</span>
			${instinct.isEmpty ? "" : `
			<p class="rd-instinct">
				<button type="button" class="rd-goto" data-goto="${esc(instinct.tab)}"
					aria-label="Instinct: ${esc(instinct.label)} (change it on ${esc(instinct.source)})"
					title="${esc(instinct.label)} — change it on ${esc(instinct.source)}">${esc(instinct.label)}</button>
			</p>`}
			${S.appearance ? `<p class="rd-appearance" title="${esc(S.appearanceText)}">${S.appearance}</p>` : ""}
		</div>`;
};

/* ── Masthead ───────────────────────────────────────────────────────────────
   Crest, name, playbook, and who this person is. One line of identity at both densities.

   The crest is capped to the name's line box so the image takes its height from the words beside it
   rather than setting the band's. The playbook's name is IN the h1 — "Maelen, The Seeker" is one
   sentence, and a category reads with a name rather than in a row beside it. It is also a value
   rather than a label: `playbook-and-creation.md` records that one of the nine crosses a word off
   its own title when a particular move is taken. */

const masthead = S => `
	<header class="sheet-header rd-masthead">
		<div class="rd-masthead-id">
			<img class="profile-img stonetop-header-playbook-icon" src="${esc(S.playbookCrest)}"
				alt="" title="${esc(S.playbookName)}">
			<h1 class="charname">
				<input type="text" value="${esc(S.name)}" aria-label="Name">
				<span class="stonetop-charname-playbook">${esc(S.playbookName)}</span>
			</h1>
		</div>
		${who(S)}
	</header>`;

/* ── The folded ledger: the band's collapsed density ─────────────────────────
   The same numbers at line height, and the conditions with them.

   Shipped, this line is the six stats then HP / Armor / Damage, and the three conditions are a strip
   under the name. Both halves of that change here, and only the second one is a design decision:

   The vitals are the RAIL's now, which frees 209px of this line — measured on the real sheet at
   1180px, where the line ran 767px of 902 and now runs 590.

   The conditions move onto it, each on the PAIR it hinders. That is what the freed width buys, and
   the reason is an invariant rather than a preference: `stats-and-conditions.md` says which stats a
   condition hinders "has to be knowable BEFORE it is marked, because marking one is frequently a
   choice between them, and the cost of that choice depends entirely on which of a character's
   numbers it touches." Folded, the shipped sheet cannot answer that — the strip under the name lists
   three words with no stats attached, and the red numbers on this line only say which one you
   already took. Drawn on the pair, the mapping is there before anything is marked, which is the only
   time the question is being asked.

   What makes it drawable at all is a property of the rules, not of the layout: the three pairs are
   contiguous in the canonical order and cover all six exactly once. `StatPairView` is that grouping,
   and it comes from the snapshot rather than from this file.

   Plain readouts, not tiles — the shipped rule, and its reason: "at line height there is no size at
   which the woodcut frame is a frame rather than a smudge." The abbreviation is still the roll
   button, because a stat you cannot roll from the line makes the fold cost the thing it was for.

   The tick is a real control here, exactly as the shipped strip's is: a condition is marked during
   play, which is when this density is the one on screen. It is the shipped MASTHEAD device down to
   the class — a painted circle with the input behind it — rather than the band's bracket tick, which
   is the input itself framed in the bracket art and has no bracket to sit in on a line. Wearing the
   shipped class is what makes it fill when checked and take a focus ring; restyling a circle here
   would have been a fourth drawing of a mark the sheet already has three of.

   Both ticks carry `data-condition`, which is what the deck's handler finds them by. A shared CLASS
   would have been the obvious hook and is the wrong one: the two densities deliberately wear
   different shipped classes, and hanging behaviour off either would tie the handler to a styling
   decision.

   A marked condition says what it IS, on a line of its own that exists only while there is one. Two
   reasons it is not inline: there is not room for it — 100px of slack against a sentence that wants
   300 — and `stats-and-conditions.md` prices the sentence as the part a player acts on, so it should
   not be the thing that gets clipped. A band that grows on the rare occasion it has to is the same
   trade the shipped masthead makes, and for the same reason. Only the first sentence: the clause
   naming the rolls is already on this line as the two numbers gone red. */

const foldedStat = (stat, condition) => `
		<li class="stonetop-folded-stat${condition.active ? " is-hindered" : ""}" data-stat="${esc(stat.key)}">
			<button type="button" class="stonetop-folded-abbr rollable" data-roll="${esc(stat.key)}"
				aria-label="Roll ${esc(stat.name)}" title="${esc(stat.description)}">${esc(stat.abbr)}</button>
			<span class="stonetop-folded-value">${esc(stat.value)}</span>
			<span class="stonetop-folded-sr">${condition.active ? esc(condition.name) : ""}</span>
		</li>`;

const foldedPair = pair => {
	const c = pair.condition;
	return `
	<li class="rd-pair${c.active ? " is-active" : ""}">
		<ul class="rd-pair-stats stonetop-unmarked">${pair.stats.map(s => foldedStat(s, c)).join("")}</ul>
		<label class="rd-cond" title="${esc(c.description)}">
			<input type="checkbox" class="stonetop-masthead-debility-check" data-condition data-slug="${esc(c.key)}"
				data-stats="${esc(c.stats.join(" "))}"${c.active ? " checked" : ""}>
			<span class="stonetop-masthead-debility-circle" aria-hidden="true"></span>
			<span class="rd-cond-name">${esc(c.name)}</span>
			<span class="stonetop-visually-hidden">${esc(c.description)}</span>
		</label>
	</li>`;
};

const foldedLedger = S => `
	<div class="stonetop-folded-ledger rd-ledger" aria-label="Stats and conditions">
		<ul class="rd-pairs stonetop-unmarked">${S.statPairs.map(foldedPair).join("")}</ul>
	</div>`;

/* ── Ailments: what is wrong with you right now ──────────────────────────────
   The band's right column, which is empty while the band is open — the six tiles ask for 452 of
   870px and the foot below needs about 300. It measured 454×94, and the stats column beside it sets
   the band's height, so about five lines here cost nothing at all. Three rows and the bar fit it at
   every width, so `showFirstAilments` shows the first three, always, and the rest are a count on the bar.

   THE SAME PANEL AND BAR AS EVERY OTHER GROUP. The first pass invented a label punched into a rule
   for this one region, which is the exact failure the deck exists to argue against — "the sheet is
   flat today because a group header, a panel and a row are each drawn differently on every tab".
   A list of like things is a `panel` with a `bar`; the bar carries the name and what is past the
   third row, the way dnd5e's list headers carry SCHOOL · TIME · RANGE rather than spending a row on
   them. No count beside three rows a reader can already count.

   ONE REGION FOR TWO THINGS, and the rules put them together rather than this file: Recover triggers
   on *"take time to catch your breath and tend to what ails you"* and its very next line reads *"when
   you tend to a debility OR a problematic wound"*. Two tiers of the same question — what is wrong
   with you — and the move that answers it answers both at once.

   DEBILITIES ARE READOUTS HERE. No tick, no second control. The bracket under the stat pair is where
   a debility is marked and the only place it is marked; this says what the marked one IS. That is
   the instinct pattern this band already runs on — one value, one editor, the readout where it is
   read and the control where it is set. And only the MARKED ones: all three are named under the
   brackets already, so listing the two you do not have is the duplication that made the first
   attempt read badly.

   ONE LINE PER AILMENT, the note clipped rather than wrapped. A wrapping sentence made rows 17px or
   34px unpredictably, so the region held three entries instead of four and which it was depended on
   how long a condition's description happened to be. The full sentence is a hover and the editor;
   the line is the reminder.

   Wounds carry their STATE where a move row carries its roll — the same reserved right column, so
   the right edges line up down the list. There is no effect to print for a wound
   (`problematic-wounds.md`: nothing about one is mechanical), and how far along it is happens to be
   the thing that changes what a player does next. */

/**
 * MOCK DATA. There is no field for wounds anywhere — no schema, no snapshot, no migration — and this
 * is a mockup, so these are invented entries standing in for a list that would be authored in play.
 * Same status as the starting-stat chips above: an affordance drawn so it can be looked at, not a
 * feature with data behind it. `bad knee` is the book's own example (Creepy Cave); the rest are not
 * quoted from anywhere and must not be treated as book content.
 */
const MOCK_WOUNDS = [
	{ name: "broken arm", state: "stabilized" },
	{ name: "bad knee", state: "permanent" },
];

const ailmentRow = ({ name, note, kind, state }) => `
		<li class="rd-ailment rd-ailment--${kind}"${state ? ` data-state="${esc(state)}"` : ""}>
			<span class="rd-ailment-name">${esc(name)}</span>
			<span class="rd-ailment-note" title="${esc(note)}">${esc(note)}</span>
		</li>`;

const ailments = S => {
	const rows = [
		...S.activeConditions.map(c =>
			ailmentRow({ name: c.name, note: c.summary, kind: "debility" })),
		...MOCK_WOUNDS.map(w =>
			ailmentRow({ name: w.name, note: w.state, kind: "wound", state: w.state })),
	];
	return panel({
		klass: "rd-ailments",
		bar: bar({ title: "Ailments", action: `
			<button type="button" class="rd-bar-action rd-ailments-more" hidden></button>
			<button type="button" class="rd-bar-action rd-ailments-edit" aria-label="Edit ailments" title="Edit ailments"><i
				class="fas fa-plus" aria-hidden="true"></i></button>` }),
		body: `
		<ul class="rd-ailment-list stonetop-unmarked">${rows.join("")}</ul>
		<p class="rd-ailments-empty"${rows.length ? " hidden" : ""}>nothing ails you</p>`,
	});
};

/* ── The band's foot ─────────────────────────────────────────────────────────
   The line the band folds TO, the roll mode, and the control that folds it — in that order, in flow.

   The mode is rendered ONCE for the whole sheet and ends this line at both densities, so it never
   moves between them and there is no second copy to keep in step. The shipped band puts it here for
   exactly that reason, and nothing about losing the picture changes it. */

/* Short on this line and nowhere else. The line sits beside the stats in the band's narrower column,
   and spelled out it needed 336px where a 1000px sheet with the rail open gives it 258 — so it ran
   left over the conditions' labels. "Adv" and "Disadv" bring it to 239. The words are drawn short
   and SAID in full: the short form is aria-hidden and the full word rides beside it, clipped, so the
   radio's accessible name is still "Advantage". The stat-pick dialog stacks its options and has the
   room, so it keeps the full words. */
const ROLL_MODES = [
	{ key: "advantage", word: "Advantage", short: "Adv" },
	{ key: "normal", word: "Normal", short: null },
	{ key: "disadvantage", word: "Disadvantage", short: "Disadv" },
];

const rollModeLabel = ({ word, short }) => short
	? `<span class="stonetop-rollmode-label"><span aria-hidden="true">${esc(short)}</span><span
		class="rd-sr">${esc(word)}</span></span>`
	: `<span class="stonetop-rollmode-label">${esc(word)}</span>`;

const rollMode = (current, rule) => `
	<fieldset class="stonetop-rollmode stonetop-rollmode--inline">
		<legend class="rd-sr">Roll mode</legend>
		${ROLL_MODES.map(mode => `
		<label class="stonetop-rollmode-option${mode.key === current ? " is-checked" : ""}"${
			mode.short ? ` title="${esc(mode.word)}"` : ""}>
			<input type="radio" class="stonetop-rollmode-input" name="rd-roll-mode"${mode.key === current ? " checked" : ""}>
			<span class="stonetop-rollmode-mark" aria-hidden="true"></span>
			${rollModeLabel(mode)}
		</label>`).join("")}
		${ruleButton(rule)}
	</fieldset>`;

/* D9: Advantage/Disadvantage is not invoked, it explains what this control does — so it sits on the
   control, as the last item of its row. The advice button's look, because a `?` at the end of a row
   already means "how does this work" on this sheet, but NOT its class or its action: that one opens
   the book's advice articles, and this opens the move. Same look, different action, and the name
   says which. */
const ruleButton = move => move ? `
		<button type="button" class="stonetop-icon-btn rd-rule-btn" data-move="${esc(move.slug)}"
			aria-label="${esc(move.name)}: the rule" title="${esc(move.name)}: the rule">
			<i class="fas fa-circle-question" aria-hidden="true"></i>
		</button>` : "";

/**
 * The band: identity, the six stats, the three conditions, and the line it folds to.
 *
 * No portrait and no vitals — both are in the rail, where they are visible from every tab instead of
 * costing every tab the same height. What is left is a plain flex column, which is why there are no
 * `band-main` / `band-aside` wrappers here: those exist on the shipped sheet to stand the picture
 * beside the numbers, and dissolve with `display: contents` when it folds. With no picture, folding
 * is `.sheet-top { display: none }` and nothing else.
 */
export const band = S => {
	// The band numbers its own bars, so what another surface draws cannot change its textures.
	resetBarSequence();
	return `
<div class="stonetop-band rd-band">
	${masthead(S)}
	<section class="sheet-top">
		<div class="stonetop-stats-column">
			<h3 class="stonetop-move-group-title rd-stats-heading">Stats
				<span class="stonetop-section-note">${esc(S.statsNote)}</span></h3>
			<div class="stonetop-stats-row">${S.stats.map(statTile).join("")}</div>
			<div class="stonetop-debilities">${S.debilities.map(debilityBand).join("")}</div>
			${startingArray(S)}
		</div>
	</section>
	${ailments(S)}
	<div class="stonetop-band-foot rd-band-foot">
		${foldedLedger(S)}
		${rollMode(S.rollMode, S.specialMove("advantage-disadvantage"))}
		<button type="button" class="stonetop-top-toggle" data-top-toggle aria-expanded="true"
			aria-label="Fold the stats away" title="Fold the stats away">
			<i class="fas fa-chevron-up stonetop-top-caret" aria-hidden="true"></i>
			<span class="stonetop-top-toggle-label">Stats</span>
		</button>
	</div>
</div>`;
};
