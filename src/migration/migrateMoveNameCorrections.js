// Names the pack once misspelt, by slug. `migrateMovePackData` never rewrites a name, so a GM's rename
// survives the refresh — which also leaves a misspelling on every character that already carries the
// move. Only the exact old spelling is corrected: a GM's own name, or a translated one, is left alone.
const CORRECTIONS = [
	{ slug: "deaths-door", from: "Deaths Door", to: "Death's Door" },
];

export async function migrateMoveNameCorrections(actor) {
	const updates = [...actor.items]
		.filter(i => i.type === "move")
		.flatMap(item => {
			const fix = CORRECTIONS.find(c => c.slug === item.system?.slug && c.from === item.name);
			return fix ? [{ _id: item._id, name: fix.to }] : [];
		});
	if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
}
