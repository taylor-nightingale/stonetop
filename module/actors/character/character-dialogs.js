const l = key => game.i18n.localize(key);

export async function setupStartingMoves(actor, allBackgrounds, background, pickCount) {
	const playbookName = actor.system?.playbook?.name;
	if (!playbookName) return;

	const pack = game.packs.get("stonetop.playbook-moves");
	if (!pack) return;

	await pack.getIndex({ fields: ["system.playbook", "system.isStartingMove", "system.requires", "system.minLevel"] });
	const playbookEntries = pack.index.filter(e => e.system?.playbook === playbookName);

	const ownedNames = new Set(actor.items.filter(i => i.type === "move").map(i => i.name));
	const backgroundMoveNames = new Set(background?.moves ?? []);

	const autoEntries = playbookEntries.filter(e =>
		(e.system?.isStartingMove || backgroundMoveNames.has(e.name)) && !ownedNames.has(e.name)
	);

	if (autoEntries.length) {
		const docs = await Promise.all(autoEntries.map(e => pack.getDocument(e._id)));
		await actor.createEmbeddedDocuments("Item", docs.map(d => d.toObject()));
		for (const e of autoEntries) ownedNames.add(e.name);
	}

	if (!pickCount) return;

	const backgroundMovePool = new Set(allBackgrounds.flatMap(b => b.moves ?? []));
	const eligibleEntries = playbookEntries.filter(e =>
		!e.system?.isStartingMove &&
		!e.system?.requires &&
		(!e.system?.minLevel || e.system.minLevel <= 1) &&
		!ownedNames.has(e.name) &&
		!backgroundMovePool.has(e.name)
	);

	if (!eligibleEntries.length) return;

	const eligibleDocs = await Promise.all(eligibleEntries.map(e => pack.getDocument(e._id)));
	openMoveSelectionDialog(actor, eligibleDocs, pickCount);
}

export function openMoveSelectionDialog(actor, moves, count) {
	const options = moves.map(m =>
		`<label class="selection-option move-option">
			<input type="checkbox" name="pick" value="${m.id}">
			<div class="selection-option-body">
				<strong>${m.name}</strong>
				<p>${m.system.description ?? ""}</p>
			</div>
		</label>`
	).join("");

	new Dialog({
		title: game.i18n.format("stonetop.character.moves.pickTitle", { count }),
		content: `
			<p class="move-pick-instruction">
				${game.i18n.format("stonetop.character.moves.pickInstruction", { count })}
			</p>
			<div class="selection-options">${options}</div>`,
		buttons: {
			add: {
				label: l("stonetop.character.selection.select"),
				callback: async dlg => {
					const ids = [...dlg.find("input[name=pick]:checked")].map(el => el.value);
					if (!ids.length) return;
					const docs = moves.filter(m => ids.includes(m.id));
					await actor.createEmbeddedDocuments("Item", docs.map(d => d.toObject()));
				},
			},
			close: { label: l("stonetop.character.selection.cancel") },
		},
		default: "close",
		render: dlg => {
			dlg.find("input[name=pick]").on("change", () => {
				const checked = dlg.find("input[name=pick]:checked").length;
				dlg.find("input[name=pick]:not(:checked)").prop("disabled", checked >= count);
			});
		},
	}).render(true);
}
