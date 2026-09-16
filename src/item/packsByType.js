// The compendium that ships each slug-bearing item type. The legacy `npc` item type has no pack of
// its own — a world-only catalog is the whole of it.
//
// Read by anything that has to get from an item back to the pack document it came from:
// ItemSlugCatalog (which slugs are taken) and PackProvenance (which compendium document an embedded
// copy is a copy OF).
export const PACK_BY_TYPE = {
	move:        "stonetop.moves",
	arcanum:     "stonetop.arcana",
	playbook:    "stonetop.playbooks",
	insert:      "stonetop.inserts",
	improvement: "stonetop.steading-improvements",
	steadfast:   "stonetop.steadfasts",
	follower:    "stonetop.followers",
	outfitItem:  "stonetop.outfit-items",
	possession:  "stonetop.possessions",
};
