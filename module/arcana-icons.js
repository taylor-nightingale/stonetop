/**
 * Authoritative registry of the Major Arcana, each mapped to its card-art icon. The game
 * defines a fixed set of Major Arcana, so membership in this map IS the taxonomy (use
 * {@link isMajorArcana}); Minor Arcana are everything else and have no card art. Keep this
 * the single source of truth — don't re-derive "is major" from `majorArcanaImg() !== null`.
 */
export const MAJOR_ARCANA_ICONS = {
	"azure-hand":                 "icon-arcana-azurehand.webp",
	"blackwood-fetishes":         "icon-arcana-blackwoodfetishes.webp",
	"blood-quenched-sword":       "icon-arcana-bloodsword.webp",
	"demonhide-cloak":            "icon-arcana-demonhide.webp",
	"hectumel-codex":             "icon-arcana-hectumelcodex.webp",
	"hungering-maw-of-hlad":      "icon-arcana-hungrymaw.webp",
	"ineffable-words":            "icon-arcana-ineffalewords.webp",
	"mindgem":                    "icon-arcana-mindgem.webp",
	"norubas-ice-sphere":         "icon-arcana-icesphere.webp",
	"red-scepter":                "icon-arcana-redscepter.webp",
	"redwood-effigy":             "icon-arcana-redwoodeffigy.webp",
	"ring-of-daagon":             "icon-arcana-ringofdaagon.webp",
	"rune-laden-scales":          "icon-arcana-scales.webp",
	"shield-of-the-wisent-witch": "icon-arcana-wisentshield.webp",
	"staff-of-the-lidless-orb":   "icon-arcana-lidlessorb.webp",
	"storm-markings":             "icon-arcana-stormmarkings.webp",
	"twisted-spear":              "icon-arcana-twistedspear.webp",
	"whispering-rocks":           "icon-arcana-whisperingrocks.webp",
};

export function majorArcanaImg(slug) {
	const file = MAJOR_ARCANA_ICONS[slug];
	return file ? `systems/stonetop/assets/icons/arcana/${file}` : null;
}

export function isMajorArcana(slug) {
	return Object.prototype.hasOwnProperty.call(MAJOR_ARCANA_ICONS, slug);
}
