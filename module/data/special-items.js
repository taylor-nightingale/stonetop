// Special ("handout") items catalog for the Add Special Item picker. Text and
// Values are copied verbatim from the Moves & Gear handout's Special Items page.
// `slug` matches the corresponding inventory-items compendium entry so a picked
// item can be added to the character. Circles (○) are shown as literal text here
// (this is a reference list); the live inventory tab uses interactive trackers.
export const SPECIAL_ITEM_CATALOG = [
	{ category: "Weapons of War", items: [
		{ slug: "mace-or-flail", name: "Mace or flail, iron", traits: "close, forceful", value: "1" },
		{ slug: "battleaxe",     name: "Battleaxe, iron",     traits: "close, messy",     value: "1*" },
		{ slug: "short-sword",   name: "Short sword, iron",   traits: "hand, close",      value: "1*" },
		{ slug: "sword",         name: "Sword, iron",         traits: "close, +1 damage", value: "1*" },
		{ slug: "warhammer",     name: "Warhammer, iron",     traits: "close, 2 piercing", value: "1" },
		{ slug: "crossbow",      name: "Crossbow",      traits: "far, +1 damage, x piercing, reload, ○ low ammo, ○ all out", value: "1" },
		{ slug: "composite-bow", name: "Composite bow", traits: "far, +1 damage, x piercing, ○ low ammo, ○ all out",         value: "1" },
	] },
	{ category: "Armor", items: [
		{ slug: "cuirass-boiled-leather", name: "Cuirass, boiled leather",            traits: "1 armor",                  value: "1" },
		{ slug: "hauberk-iron",           name: "Hauberk/cuirass/scale, iron or bronze", traits: "2 armor, warm, cumbersome", value: "2" },
		{ slug: "vest-brigandine",        name: "Vest, brigandine, fancy",            traits: "2 armor, warm",            value: "3" },
	] },
	{ category: "Light Sources", items: [
		{ slug: "candle",           name: "Candle",           traits: "lasts ~1 hour, close, area", value: "0" },
		{ slug: "lantern",          name: "Lantern",          traits: "○○○○○ hours, close, area",   value: "0" },
		{ slug: "bullseye-lantern", name: "Bullseye lantern", traits: "○○○○○ hours, near",          value: "1" },
	] },
	{ category: "Tools & Trades", items: [
		{ slug: "metal-tools",             name: "Metal tools",                  traits: "drill, prybar, saw, tongs, etc.", value: "0" },
		{ slug: "glass-vial",              name: "Glass vial",                   traits: "fragile",                         value: "0" },
		{ slug: "block-and-tackle",        name: "Block & tackle",               traits: "",                                value: "0" },
		{ slug: "instrument",              name: "Instrument",                   traits: "harp, lute, fiddle, etc.",        value: "1" },
		{ slug: "mirror-hand-held",        name: "Mirror, hand-held, polished bronze", traits: "",                          value: "1" },
		{ slug: "common-trade-tools",      name: "Common trade tools",           traits: "for pottery, weaving, distilling, etc.; immobile",   value: "1" },
		{ slug: "uncommon-trade-tools",    name: "Uncommon trade tools",         traits: "for carpentry, chandlery, beekeeping, etc.; immobile", value: "2" },
		{ slug: "specialized-trade-tools", name: "Specialized trade tools",      traits: "for smithing, glassblowing, scribing, etc.; immobile", value: "3" },
	] },
	{ category: "Writing Implements", items: [
		{ slug: "slate-and-chalk",      name: "Slate and chalk",        traits: "",        value: "0" },
		{ slug: "wax-tablet-stylus",    name: "Wax tablet and stylus",  traits: "",        value: "0" },
		{ slug: "parchment-sheets",     name: "Parchment, a few sheets", traits: "fragile", value: "0" },
		{ slug: "fine-vellum-sheets",   name: "Fine vellum, a few sheets", traits: "fragile", value: "1" },
		{ slug: "ink-vial-quills",      name: "Ink, vial and quills",   traits: "",        value: "1" },
		{ slug: "empty-book-parchment", name: "Empty book, parchment",  traits: "fragile", value: "1" },
		{ slug: "empty-book-vellum",    name: "Empty book, fine vellum", traits: "fragile", value: "2" },
	] },
	{ category: "Transport", items: [
		{ slug: "wheelbarrow",    name: "Wheelbarrow",                       traits: "",                            value: "1" },
		{ slug: "cart-or-sleigh", name: "Cart or sleigh",                    traits: "requires donkey/mule/horse",  value: "2" },
		{ slug: "wagon",          name: "Wagon",                             traits: "requires mule/horse",         value: "3" },
		{ slug: "spare-parts",    name: "Spare parts for wagon/cart/sleigh", traits: "axles, wheels, etc.; ○○○ uses, immobile", value: "2" },
	] },
	{ category: "Exotic Stuff", items: [
		{ slug: "exotic-root",        name: "Bendis root",         traits: "burnt fumes repel perversions of nature; lasts ~1 hour, reach, area", value: "1" },
		{ slug: "bezoar",             name: "Bezoar",              traits: "swallow to cure any poison", value: "1" },
		{ slug: "naphtha",            name: "Naphtha",             traits: "burns hot & sticky; damage d8; ○○○ uses, thrown, area, dangerous, ignores armor", value: "1" },
		{ slug: "silver-alloy-dagger", name: "Silver-alloy dagger", traits: "hand", value: "2" },
	] },
	{ category: "Trade Goods", items: [
		{ slug: "salt",                 name: "Salt",                        traits: "a little box", value: "0" },
		{ slug: "purse-of-coppers",     name: "Purse of coppers",            traits: "~10 handfuls", value: "0" },
		{ slug: "handful-of-silvers",   name: "Handful of silvers",          traits: "",             value: "1" },
		{ slug: "barrel-whisky-common", name: "Barrel of whisky, common",    traits: "immobile",     value: "1" },
		{ slug: "barrel-whisky-fine",   name: "Barrel of whisky, fine",      traits: "immobile",     value: "2" },
		{ slug: "purse-of-silvers",     name: "Purse of silvers",            traits: "~10 handfuls", value: "2" },
		{ slug: "surplus-trade-goods",  name: "Surplus of various trade goods", traits: "immobile",  value: "2" },
	] },
	{ category: "Livestock & Other Beasts", items: [
		{ slug: "dog-follower", name: "Dog, follower", traits: "keen-nosed, pick 2 more",                       value: "1" },
		{ slug: "goat",         name: "Goat",          traits: "sure-footed, curious, hungry",                  value: "1" },
		{ slug: "sheep",        name: "Sheep",         traits: "timid, hardy, wooly",                           value: "1" },
		{ slug: "pig",          name: "Pig",           traits: "keen-nosed, stubborn, gluttonous, clever",      value: "1" },
		{ slug: "donkey",       name: "Donkey",        traits: "hardy, sure-footed, cautious, slow",            value: "2" },
		{ slug: "mule",         name: "Mule",          traits: "large, hardy, sure-footed, cautious, keen-nosed, sterile", value: "3" },
		{ slug: "horse",        name: "Horse",         traits: "large, powerful, keen-nosed, swift or hardy",   value: "3" },
	] },
	// Useful or Valuable Flora (Book II, p.458) — the named sample specimens. Not
	// from the Moves & Gear handout; these are gazetteer discoveries you can add
	// once harvested. The gathering rules + dice generator live in the Lore
	// compendium's "Useful or Valuable Flora" entry.
	{ category: "Flora & Herbs", items: [
		{ slug: "brightberry",        name: "Brightberry",        traits: "glowing berries; 3 uses, fragile; burn away within hours", value: "2" },
		{ slug: "sleeping-elksheart", name: "Sleeping Elksheart", traits: "paralytic spores; a poison, or 1d4 Surplus",               value: "2" },
		{ slug: "violet-lotus",       name: "Violet Lotus",       traits: "burnt petals → a Seek Insight question; perfume",          value: "1" },
		{ slug: "twisting-pine",      name: "Twisting Pine",      traits: "sap seals wounds (Recover); sealant or glaze",             value: "1" },
		{ slug: "vantas-blade",       name: "Vanta's Blade",      traits: "light-drinking dye/ink/paint; thought cursed",             value: "2" },
		{ slug: "hartwood",           name: "Hartwood",           traits: "ashes ward against possession",                            value: "0" },
		{ slug: "snowembers",         name: "Snowembers",         traits: "warm edible petals; 1d4+4 provisions",                     value: "0" },
	] },
];

// Footnote shown under the list (Weapons of War piercing rule).
export const SPECIAL_ITEM_FOOTNOTE = "* Value 2 to get 1 piercing or (maybe) 2 piercing. \"x piercing\" = the steading's current Prosperity.";

// Relative Value reference from the Moves & Gear handout — what each Value is
// "generally worth." Shown on hover over an item's Value. ("Exchange rates are
// anything but standard, but...")
export const RELATIVE_VALUE = {
	0: ["A purse of copper coins", "A single silver coin", "A favor", "A few days of unskilled labor", "A common, mundane item"],
	1: ["A handful of silver coins", "A season (or so) of unskilled labor", "A few days of skilled labor", "A unit of trade goods (grain, salt, pelts, etc.)", "A bit of finery (embroidered cloak, silk scarf, silver comb, etc.)"],
	2: ["A purse of silver coins", "A single gold coin", "A Surplus", "A year (or so) of unskilled labor", "A season (or so) of skilled labor", "A cartload of common trade goods", "An item of luxury or status (gold ring, silver torc, gemstone, etc.)"],
	3: ["A handful of gold coins", "A year (or so) of skilled labor", "A good, trained horse or mule", "A precious item (ruby ring, gold torc, etc.)"],
	4: ["A purse of gold coins", "A dozen or so good horses", "A \"priceless\" item (huge flawless gemstone, gold statuette, bejeweled scepter, etc.)"],
};

// HTML tooltip describing what an item's Value is generally worth. Empty string
// when the Value isn't a recognised 0-4 (the "*" piercing marker is ignored).
export function relativeValueTooltip(valueStr) {
	const n = parseInt(valueStr, 10);
	const worth = RELATIVE_VALUE[n];
	if (!worth) return "";
	const items = worth.map(w => `<li>${w}</li>`).join("");
	return `<strong>A Value ${n} item is generally worth:</strong><ul class="stonetop-rel-value">${items}</ul>`;
}
