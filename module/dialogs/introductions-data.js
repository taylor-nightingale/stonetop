// ── Character Introductions: per-playbook prompt/question data ──────────────────
// The authored prompts and question sets for the guided Character Introductions
// (Book I, "Getting Started"). Shared between IntroductionsDialog.js — which walks
// the table through them round by round — and the Chronicle compiler
// (utils/chronicle-core.js), which resolves a stored question index back to its
// text. Keep this the single source so the dialog and the recorded journal agree.
//
//   step3  — the round-3 narration prompt (HTML), themed per playbook.
//   step4  — the four "answer one, naming an NPC" questions for rounds 4 & 5.
//   step6  — the four "ask your fellow PCs" questions for rounds 6 & 7.

export const INTRO_PLAYBOOK_DATA = {
	"the-blessed": {
		step3: `describe your <strong>sacred pouch</strong> and its remarkable trait. Then, tell us about <strong>Danu's shrine</strong> in Stonetop and how she is worshipped.`,
		step4: [
			"Who is your closest kin?",
			"Whose heart &amp; soul is entwined with yours?",
			"Who taught you the secret ways?",
			"Who is beloved by the goddess, your charge to nurture, guide, protect, or heal?",
		],
		step6: [
			"Which one of you do the spirits whisper of?",
			"Which one of you has joined me in a sacred rite?",
			"Which one of you has made a blood-oath with me?",
			"Which one of you doubts the power of Danu?",
		],
	},
	"the-fox": {
		step3: `tell us your <strong>tall tales</strong>. Feel free to embellish and exaggerate to the other players, but always answer the GM truthfully.`,
		step4: [
			"Who is your closest kin?",
			"Who holds the reins to your heart?",
			"Whose respect means the world to you?",
			"To whom do you owe a debt that cannot be repaid?",
		],
		step6: [
			"Which one of you joined me in my latest hijinx?",
			"Which one of you brings your problems to me?",
			"Which one of you saved my bacon, mor'n once?",
			"Which one of you trusts me not one bit?",
		],
	},
	"the-heavy": {
		step3: `tell us about your <strong>history of violence</strong>, and what keeps you up at night.`,
		step4: [
			"Who is your closest kin?",
			"Who is your lover, spouse, or betrothed?",
			"Who most needs or deserves your protection?",
			"Whose forgiveness do you strive to earn?",
		],
		step6: [
			"Which one of you once dragged me home, bleeding and unconscious?",
			"Which one of you can I trust to always have my back?",
			"Which one of you has stayed my hand?",
			"Which one of you has traded blows with me?",
		],
	},
	"the-judge": {
		step3: `describe <strong>the Chronicle</strong>. Then, tell us about <strong>Aratis and her shrine</strong>, and what she demands of her true disciples.`,
		step4: [
			"Who is your closest kin?",
			"Who is your lover, spouse, or betrothed?",
			"Who is your apprentice?",
			"Who is the wisest of the town elders?",
		],
		step6: [
			"Which one of you is a true disciple of Aratis?",
			"Which one of you is my closest confidant?",
			"Which one of you has stood beside me in battle against unnatural chaos?",
			"Against which of you have I passed judgement?",
		],
	},
	"the-lightbearer": {
		step3: `<strong>praise the day!</strong> Tell us of <strong>Helior</strong>, his worship and his shrine. Tell us, too, of the prior Lightbearer and how you gained your powers.`,
		step4: [
			"Who is your closest kin?",
			"Who fans the flames of your heart?",
			"Whose kindness and generosity warm your soul?",
			"Who needs Helior's light, badly?",
		],
		step6: [
			"Which one of you is an old and dear friend?",
			"Which one of you shares my faith?",
			"Which one of you scoffs at mercy and hope?",
			"Which one of you will need my guidance soon?",
		],
	},
	"the-marshal": {
		step3: `tell us <strong>the town's war stories</strong>, plus the answers to the questions you chose.`,
		step4: [
			"Who is your closest kin?",
			"Who is your lover, spouse, or betrothed?",
			"Who is your lieutenant?",
			"Whose kin is dead because of your decisions?",
		],
		step6: [
			"Which one of you is or was part of my crew?",
			"Which one of you have I promised to keep safe?",
			"Which one of you do I still have doubts about?",
			"Which one of you ignored my orders and got someone killed?",
		],
	},
	"the-ranger": {
		step3: `tell us <strong>what you're worried about</strong> (see "Something wicked this way comes" on your playbook).`,
		step4: [
			"Who is your closest kin?",
			"To whom do you always return home?",
			"Who would be lost without you?",
			"Who has much to learn from you?",
		],
		step6: [
			"Which one of you fears the wider world?",
			"Which one of you has shown me great beauty?",
			"Which one of you have I caught sometimes staring out at the horizon?",
			"Which one of you lacked the stomach to put something out of its misery?",
		],
	},
	"the-seeker": {
		step3: `describe your <strong>major arcana</strong>. Tell us your answers to the questions you chose. Then, tell us about your <strong>minor arcana</strong>, too.`,
		step4: [
			"Who is your closest kin?",
			"Who is your spouse, lover, or betrothed?",
			"Whom do you trust, even more than yourself?",
			"Whom do you secretly watch over, and why?",
		],
		step6: [
			"Which one of you led me to a key discovery?",
			"Which one of you has been at my side the entire way?",
			"Which one of you most fears the path I tread?",
			"Which one of you is keeping secrets from me?",
		],
	},
	"the-would-be-hero": {
		step3: `tell us of your <strong>fear &amp; anger</strong>, and of the last time they caused you trouble.`,
		step4: [
			"Whose heart do you hope to win?",
			"Who is counting on you?",
			"Who quietly understands the path you are on?",
			"Who do you intend to prove wrong?",
		],
		step6: [
			"Which one of you is my closest, truest friend?",
			"Which one of you believes in me, despite it all?",
			"Which one of you has promised to teach me?",
			"Which one of you have I hurt, through what I have done or what I've failed to do?",
		],
	},
};

/** The four round-4/5 "answer one, naming an NPC" questions, or null if unknown. */
export function step4Questions(slug) {
	return INTRO_PLAYBOOK_DATA[slug]?.step4 ?? null;
}

/** The four round-6/7 "ask your fellow PCs" questions, or null if unknown. */
export function step6Questions(slug) {
	return INTRO_PLAYBOOK_DATA[slug]?.step6 ?? null;
}
