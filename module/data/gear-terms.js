export const GEAR_TERMS = {
	// Range tags
	hand:            "Tight quarters; up close and personal.",
	close:           "Melee range, 1–2 steps away.",
	reach:           "3–4 steps away.",
	near:            "Up to 30 or so steps away.",
	far:             "Quite the distance; up to 100 steps, maybe more.",
	// Gear tags
	area:            "Affects everything in an area.",
	awkward:         "Unwieldy, requires space, gets stuck.",
	crude:           "Prone to break, wear out, or stop working.",
	cumbersome:      "You're noisy, slow, hot, and quick to tire while carrying it, even without a heavy load (and if you have a heavy load, it's worse).",
	dangerous:       "Causes trouble and collateral damage if you aren't careful (and maybe if you are).",
	forceful:        "Can knock someone around, maybe even off their feet.",
	fragile:         "Easy to break/ruin; pack it carefully.",
	grabby:          "Can grapple or restrain targets.",
	immobile:        "You can't carry it on your person; you need a beast or vehicle to transport it.",
	messy:           "Does particularly destructive damage, ripping people and things apart.",
	reload:          "After it's used, it takes time/effort to reset.",
	slow:            "Takes minutes or more to use; unlikely to be useful in a fight.",
	thrown:          "You can Let Fly with it (at near range).",
	warm:            "Keeps you warm in cold weather, but uncomfortable and exhausting (and possibly dangerous) in hot weather.",
	// Parameterized tags — matched by pattern in gear-term-tooltips.js
	armor:           "When you take damage, subtract this value. Doesn't stack with other armor values (but +1 armor does stack).",
	piercing:        "When you deal damage, ignore this many points of the target's armor.",
	damage:          "Increases the damage you deal with this weapon.",
	uses:            "Mark a use each time you expend it; it's gone/useless when all uses are marked.",
	hours:           "It lasts about an hour for each mark; mark to track time used.",
	// Status/ammo tags
	"low ammo":      "The weapon's ammunition is running low.",
	"all out":       "The weapon has no ammunition remaining.",
	"ignores armor": "The damage completely bypasses the target's armor.",
};

// Appended to the piercing tooltip in steading/character contexts: "x piercing"
// on the village's gear scales with the steading's current Prosperity. A monster
// that lists "x piercing" doesn't draw from Prosperity, so this clause is omitted
// on the bestiary sheet.
export const PIERCING_STEADING_NOTE = " 'x piercing' = the steading's current Prosperity.";
