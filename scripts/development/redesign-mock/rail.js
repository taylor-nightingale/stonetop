/**
 * The rail: portrait, state, advancement, the ten basic moves and the ten expedition moves.
 *
 * Instinct and appearance are NOT here. They are by the name, in the masthead — see `band.js`.
 *
 * Read before changing anything here:
 *   NOTES.md D7        — what the rail carries, and that ALL of it stays editable. That is written
 *                        down as a regression risk rather than as new work: the first mock replaced
 *                        every stepper with a flat readout without noticing, and so did this one.
 *   NOTES.md D8        — which reference moves are here. Basic and expedition, each a group the
 *                        reader opens and shuts; follower moves are on the Followers tab, and the four
 *                        special ones each go to the thing they attach to.
 *   NOTES.md D9        — the conditional rows below, and the rule under them: a conditional move
 *                        appears when its condition is met, and not otherwise. What makes that safe
 *                        is the compendium — the sheet is not the only copy of a move.
 *   advancement.hbs    — XP's ceiling is DERIVED (6 + level × 2), so Level computes XP's max. They
 *                        are one mechanism, which is why they sit level and equal.
 *
 * What is NOT here, and must not drift in: the six stats. Rolling a move needs the stat AND the
 * move, so putting both in one scrolling column makes them mutually exclusive. That is the sheet's
 * one structural rule and it was learned the hard way.
 */
import { esc, panel, bar, moveRow, meter, resetBarSequence } from "./parts.js";

/* ── The toggle ──────────────────────────────────────────────────────────────
   A tab on the rail's inner edge, which rides the edge as the rail opens and shuts. Measured on the
   dnd5e sheet rather than remembered: its collapser is a 16×32 button with the outer corners
   rounded, `position: absolute` at the sidebar's inner edge, carried by `transition: left 0.45s`
   while the sidebar itself slides out under `transition: margin-left 0.45s`. The caret flips and
   the label changes; nothing else does.

   Two things the shipped Stonetop toggle does that this drops. It hides the rail outright rather
   than sliding it, so the rail appears and disappears with no relationship between the two states.
   And once folded it shows a strip of icons — a bolt and a d6 — standing in for what is behind the
   fold. A caret already says which way the thing will move, and it says it in one glyph that does
   not have to be decoded.

   The shipped label calls it "the moves rail". Under D7 it is not one any more — it carries the
   portrait, the vitals and advancement as well — so the words here are what the label should say.
   Changing the real one is an i18n edit with a handoff cost, not part of this. */

/* OUTSIDE `.rd-rail-layout`, and that is load-bearing rather than tidy. The layout is
   `overflow: hidden` — that clip is what lets a 240px rail slide out of a column narrowing to zero —
   and the tab rides the layout's right EDGE, so inside it the tab is the one thing the clip removes.
   It sat there and was invisible: present in the DOM, 14px wide, every pixel of it outside the box.
   Absolutely positioned against the wrapper instead, which takes it out of the grid's flow without
   giving it a cell. */
const toggle = () => `
<button type="button" class="rd-rail-toggle" data-rail-toggle
	aria-expanded="true" aria-controls="rd-rail"
	data-label-show="Expand the rail" data-label-hide="Collapse the rail"
	title="Collapse the rail" aria-label="Collapse the rail">
	<i class="fas fa-chevron-left rd-rail-caret" aria-hidden="true"></i>
</button>`;

/* ── Identity, and the three numbers that ride on it ─────────────────────────
   The shape the dnd5e sheet uses, measured rather than remembered: the portrait, and one badge
   straddling its bottom edge with two smaller ones flanking it, dropped half a step so the three
   read as an arc. There it is AC in a shield with the death saves either side. Here it is Level in
   the middle, with Armor and Damage.

   These are the three that are read at a glance and typed into rarely, which is what makes them
   badges and not bars. Every one keeps its control: armor a number, level a number, and damage a
   TEXT field, because a damage die is "d6" and not a quantity to step. The damage LABEL is the roll
   button — the shipped rule, and the one control in the cluster that does something besides edit.

   The frame is the book's, not a rounded box: the design system gives an art frame to "a single
   object you read or act on whole: a stat tile, a vital", and these are vitals. `.stonetop-resource-row`
   is on the cluster because that is the selector the shipped tile takes its height and padding from.

   There is one level, and it is this one. It used to be a readout on the portrait with a second,
   editable copy beside experience, which drew the number 5 twice in one column. */

const vitalBadge = ({ key, value, label, source = "", type = "number", rolls = false }) => `
	<div class="rd-cluster-item rd-cluster-item--${esc(key)}">
		<div class="stonetop-resource stonetop-resource--small">
			${rolls
				? `<button type="button" class="stonetop-resource__label stonetop-damage-roll rollable"
					data-roll="${esc(key)}" title="${esc(source)}">${esc(label)}</button>`
				: `<span class="stonetop-resource__label"${source ? ` title="${esc(source)}"` : ""}>${esc(label)}</span>`}
			<input class="stonetop-resource__input" type="${type}" value="${esc(value)}"
				aria-label="${esc(label)}"${type === "number" ? ' min="0"' : ""}>
		</div>
		${source ? `<span class="stonetop-visually-hidden">${esc(source)}</span>` : ""}
	</div>`;

const identity = S => `
<div class="rd-identity">
	<div class="rd-portrait-frame">
		<img class="rd-portrait" src="${esc(S.portrait)}" alt="${esc(S.name)}">
	</div>
	<div class="rd-cluster stonetop-resource-row">
		${vitalBadge({ key: "armor", value: S.armor, label: "Armor", source: S.armorSource })}
		${vitalBadge({ key: "level", value: S.level, label: "Level" })}
		${vitalBadge({ key: "damage", value: S.damage, label: "Damage", source: S.damageSource,
			type: "text", rolls: true })}
	</div>
</div>`;

/* ── Hit points ──────────────────────────────────────────────────────────────
   A bar, because this is the one number where "how bad is it" beats "how much is it" and a fraction
   makes the reader do the arithmetic. Both halves stay typed into: current changes many times a
   session, and the maximum is granted by the playbook but still set by hand — `Manually set to 18.
   Your playbook, The Seeker, grants 16.` is a normal thing for this value to say, and a sheet that
   cannot express disagreement with a source cannot express that.

   The provenance rides along as a sentence said to everyone, not a pointer-only tooltip. It is the
   answer to "why is my armor 1?", which is the question these numbers actually get asked. */

const hitPoints = S => `
${meter({
	label: "HP",
	value: S.hp.value, max: S.hp.max, pct: S.hp.pct,
	valueLabel: "Current hit points", maxLabel: "Maximum hit points", maxEditable: true,
	tone: S.hp.low ? "danger" : "life",
	describedBy: S.hpSource,
})}
${dyingMove(S)}`;

/* ── A route to a move ───────────────────────────────────────────────────────
   D9: End of Session wants a route rather than a row — reachable from experience, which it is how
   you gain, and taking no space until asked for. No trigger: the name already says when it happens,
   and "End of Session, when the session ends" is the row telling you what you just read. */

const route = move => move ? `
	<p class="rd-route">
		<button type="button" class="rd-goto" data-move="${esc(move.slug)}">${esc(move.name)}</button>
	</p>` : "";

/* ── A conditional move ──────────────────────────────────────────────────────
   D9: a move that is present only while its condition holds, drawn as the move itself — the same
   row the basic moves use, so a move that rolls rolls from here. A link was tried first and Death's
   Door is the case that retired it: the one thing a dying character has to do is ROLL it, and a link
   made that a trip to somewhere else. `tone` is the edge, which names the kind of threshold; `label`
   says what the move is FOR where its own trigger would say otherwise. */

const conditionalMove = (move, tone, { open = false, label = null } = {}) => move ? `
	<div class="rd-conditional rd-conditional--${tone}">
		${label ? `<p class="rd-conditional-label">${esc(label)}</p>` : ""}
		<ol class="rd-rows">${moveRow(move, { hover: true, open })}</ol>
	</div>` : "";

/* ── The move at zero hit points ─────────────────────────────────────────────
   D9: present only while a character is dying, absent the rest of the time, and it hangs off hit
   points because that is its condition — `vitals.md` says reaching zero is a distinct state with its
   own move attached rather than simply the bottom of a range.

   Which move is the character's. Death's Door, which rolls +nothing, so the die is on the name and the
   stat column is empty — unless they already died and refused: each insert gained that way brings a
   move made INSTEAD of it. Tethered disperses a Ghost until sunset, Undying rolls +CON, Dark Succor
   rolls +Favor. A Thrall at zero hit points is not glimpsing the Last Door, so the rail does not
   offer it. */

const dyingMove = S => S.isDying ? conditionalMove(S.dyingMove, "dire") : "";

/* ── Advancement ─────────────────────────────────────────────────────────────
   Experience as the second bar, and the asymmetry is not hit points' asymmetry. The value moves
   every session; the threshold is DERIVED from level — six plus twice it — and is never typed, so
   it is a readout beside the value rather than a second field competing with it.

   And unlike hit points it does not stop at its own maximum. Past the threshold the bar keeps
   filling and the threshold becomes a mark on it, because what is past the mark is the size of a
   decision: Burn Brightly triggers on having enough to level, so every 2 points above the line is
   another roll that can be pushed before the level is out of reach again. The note says the surplus
   in words; the count of burns it buys is NOT drawn, because that arithmetic quietly assumes
   spending down through the threshold, which is the player's call.

   Level is not here. It is in the cluster above with armor and damage, where it is read, and one
   value gets one editor.

   Worth remembering before dressing this as an achievement: experience is mostly gained by missing.
   Whatever presents it is presenting the record of a bad day. */

/* ── Burn Brightly ────────────────────────────────────────────────────────────
   D9: present once experience reaches the level threshold, and under experience because that is its
   condition AND what it spends. Its own box, apart from the Level Up offer: they share a threshold
   and nothing else. Levelling is done at home, once; burning is done after any roll, anywhere, as
   often as the surplus lasts.

   Under Level Up, on its own neutral edge, and labelled as the other choice. Straight under "ready to
   level", on the same accent edge, it was taken for the level-up itself — its text opens "When you
   have enough XP to Level Up".

   OPEN when it appears. The whole rule is one sentence — spend 2 XP after a roll for +1 — and that
   sentence is what says this is not levelling. The reader can shut it like any other row. */

const burnBrightly = S => S.readyToLevel
	? conditionalMove(S.specialMove("burn-brightly"), "spend", { open: true, label: "Or spend it now" })
	: "";

const advancement = S => `
<div class="rd-adv">
	${meter({
		label: "XP",
		value: S.xp.value, max: S.xp.max, scale: S.xp.scale, pct: S.xp.pct,
		thresholdPct: S.xp.thresholdPct,
		valueLabel: "Experience",
		tone: S.readyToLevel ? "full" : "",
		note: S.readyToLevel ? (S.xp.over ? `ready to level · ${S.xp.over} spare` : "ready to level") : null,
		valueText: S.xp.over
			? `${S.xp.value}, which is ${S.xp.over} past the ${S.xp.max} a level costs`
			: null,
	})}
	${levelUp(S)}
	${burnBrightly(S)}
	${route(S.specialMove("end-of-session"))}
</div>`;

/* ── The level-up offer ──────────────────────────────────────────────────────
   Nothing at all until the threshold — the precedent D9 leans on is the shipped strip, which
   renders nothing unless it has triggered or left something outstanding, which is most of the time.
   (The real gate is `LevelUpSnapshot#isOffered`; the capture only exercises the ready half.)

   While it is only READY it says, first and plainly, that this is done at home: enough experience is
   half the trigger, the other half is "a quiet stretch of time at home", and a player mid-expedition
   with a full bar is exactly who would otherwise press it. In the book's trigger alone, faint at the
   end of a long line, nobody read it. The trigger stays under it as the fine print. A reminder, not a
   lock — the button still works away from home. And it is gone once the level is taken: a move still
   owed is the rest of a level-up that already happened.

   The other half of the shipped gate is a level taken with a move still to choose. By then the
   trigger has been met, so it is not repeated, and the offer is a route to the moves tab opened for
   choosing — the one step of Level Up done somewhere else, which is the shipped strip's "Moves →". */

const levelUp = S => {
	if (!S.readyToLevel && !S.owedMoves) return "";
	return `
	<div class="rd-conditional rd-conditional--ready">
		<button type="button" class="rd-levelup" aria-expanded="false">
			<i class="fas fa-chevron-right" aria-hidden="true"></i>
			<span class="rd-levelup-title">Level Up</span>
			<span class="rd-levelup-badge">${S.owedMoves ? `${S.owedMoves} owed` : "ready"}</span>
		</button>
		${S.owedMoves ? `<p class="rd-route">
			<button type="button" class="rd-goto" data-choose>Choose a new move</button></p>`
			: `<p class="rd-levelup-home"><i class="fas fa-house" aria-hidden="true"></i> Only at home, in a quiet stretch of time</p>
			${S.levelUpTrigger ? `<p class="rd-route rd-route-when">when you ${esc(S.levelUpTrigger)}</p>` : ""}`}
	</div>`;
};

/* ── The basic moves ─────────────────────────────────────────────────────────
   All ten, one line each, permanently in view. D8: they trigger constantly, nine of the ten roll,
   and they are the reason a persistent column exists at all.

   Why one line is safe here and is NOT safe for a playbook move: these never change, everyone has
   them, and after a few sessions a name is enough to find one and the trigger is enough to confirm
   it. Abbreviated, a basic move is a reminder of something already known. A playbook move
   abbreviated is a first encounter with half the sentence missing.

   No count on the bar. Nobody chooses these and nothing about holding one is a state to record, so
   there is no budget to report — a count here would be reporting the number ten.

   No tick, for the same reason, and the shipped rail already says so: a box that can never be
   unticked asserts a state that does not exist while costing a column of the rail's width.

   The track stays, and it is INLINE with the die and the chat bubble, carrying its own title when
   it has one — which is where `move-item.hbs` already puts it. Defend holds 0/4 and the shipped rail
   passes `alwaysShowResource` for exactly that. This deck first hid the column outright, then moved
   the pips to a line of their own; both were wrong, and a track you cannot see is a track you forget
   to spend.

   The row itself is `move-item.hbs` with `disclosure=true` — the shape the steading's rail uses. See
   `moveRow` in parts.js for the three requirements it answers.

   `hover: true`, stated HERE and not passed in. `moveRow` is the generic and takes the option; the
   rail is a concrete caller and owns the answer for its own rows, so there is no way for two frames
   to get two different rails. It used to be a parameter threaded down from the frame list, and the
   result was exactly what that invites: one frame drew ten preview cards and the other eleven drew
   none, from the same function, and nothing said which was the design. */

const railRow = move => moveRow(move, { hover: true });

/* ── A group that opens and shuts ────────────────────────────────────────────
   The bar is the control: a caret at its right edge, where every row keeps its own, and the whole bar
   is its target. What the reader chose is kept across a re-render the way the band's fold is — as a
   property of the sheet in front of them, not of the character. Shutting a group is "I know these"
   or "not now", and neither is a fact about Maelen.

   A shut group costs its bar and nothing else — 27px, measured — so the rail can carry a second list
   without it costing the first one room. */

const shutter = ({ id, name, open }) => `
	<button type="button" class="rd-group-toggle" data-group-toggle aria-expanded="${open}" aria-controls="${id}"
		data-label-show="Show the ${esc(name)}" data-label-hide="Hide the ${esc(name)}"
		aria-label="${open ? "Hide" : "Show"} the ${esc(name)}" title="${open ? "Hide" : "Show"} the ${esc(name)}">
		<i class="fas fa-chevron-right rd-group-caret" aria-hidden="true"></i>
	</button>`;

const moveGroup = ({ klass, id, title, open, body }) => panel({
	klass: `rd-group ${klass}${open ? "" : " is-shut"}`,
	// No column heading. The die in front of a rolling move's name says what the heading was there to
	// say, and a word over a 34px column in a 240px rail is a word spent twice.
	bar: bar({ title, action: shutter({ id, name: title.toLowerCase(), open }) }),
	body: `<div class="rd-group-body" id="${id}"${open ? "" : " hidden"}>${body}</div>`,
});

const basicMoves = S => moveGroup({
	klass: "rd-basic", id: "rd-group-basic", title: "Basic Moves", open: true,
	body: `<ol class="rd-rows">${S.basicMoves.map(railRow).join("")}</ol>`,
});

/* ── The expedition moves ────────────────────────────────────────────────────
   D8: on the road they fire as often as the basic moves do — camp every night, recover, forage, have
   what you need whenever the fiction asks — and three of the ten roll, so they need the same row. The
   Outfit tab is where Have What You Need gets USED, and the rail is the only thing still in view from
   there.

   Shut by default. Between expeditions they are ten rows of noise, and a group shut is a heading that
   still says they exist.

   Split by phase, because `reference-moves.md` says they are not one set: setting out is a checklist
   worked once, the road is where the rest fire, and getting home is the end of one. ONE list with the
   phase headings inside it, not three lists, and that is load-bearing: the columns are the list's, so
   three lists would size three roll columns of different widths and give Return Triumphant, alone
   and not rolling, no die inset to line up with the rows above it.

   A move no phase names has no heading and comes last; see `CharacterSnapshot#expeditionPhases`. */

const PHASE_LABELS = { "setting-out": "Setting out", "on-the-road": "On the road", "getting-home": "Getting home" };

const phaseRows = phase => `${phase.key
	? `<li class="rd-phase"><h4 class="rd-phase-title">${esc(PHASE_LABELS[phase.key])}</h4></li>` : ""}
	${phase.moves.map(railRow).join("")}`;

const expeditionMoves = S => {
	const phases = S.expeditionPhases;
	if (!phases.length) return "";
	return moveGroup({
		klass: "rd-expedition", id: "rd-group-expedition", title: "Expedition Moves", open: false,
		body: `<ol class="rd-rows">${phases.map(phaseRows).join("")}</ol>`,
	});
};

/**
 * The rail: what this person looks like, what state they are in, what they are becoming, and the
 * verbs they reach for while doing it. Who they ARE is by the name, in the masthead.
 *
 * Takes the snapshot and nothing else. Every frame in the deck renders the same rail, because there
 * is no argument with which to ask for a different one.
 */
export const rail = S => {
	// The rail numbers its own bars, so what another surface draws cannot change its textures.
	resetBarSequence();
	return `
${toggle()}
<div class="rd-rail-layout">
	<aside class="rd-rail" id="rd-rail">
		${identity(S)}
		${hitPoints(S)}
		${advancement(S)}
		${basicMoves(S)}
		${expeditionMoves(S)}
	</aside>
</div>`;
};
