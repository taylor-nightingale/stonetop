const l = key => game.i18n.localize(key);

export function openBackgroundDialog(actor, backgrounds) {
	const currentSlug = actor.getFlag("stonetop", "background") ?? "";
	const options = backgrounds.map(b =>
		`<label class="selection-option${b.slug === currentSlug ? " selected" : ""}">
			<input type="radio" name="pick" value="${b.slug}"${b.slug === currentSlug ? " checked" : ""}>
			<div class="selection-option-body">
				<strong>${b.label}</strong>
				${b.description}
			</div>
		</label>`
	).join("");
	openPickerDialog(l("stonetop.character.selection.background.dialogTitle"), options, async dlg => {
		const slug = dlg.find("input[name=pick]:checked").val();
		if (slug) await actor.setFlag("stonetop", "background", slug);
	});
}

export function openInstinctDialog(actor, instincts) {
	const current = actor.getFlag("stonetop", "instinct") ?? "";
	const options = instincts.map(({ word, description }) => {
		const value = `${word} — ${description}`;
		return `<label class="selection-option${current === value ? " selected" : ""}">
			<input type="radio" name="pick" value="${value}"${current === value ? " checked" : ""}>
			<div class="selection-option-body">
				<strong>${word}</strong>
				<p>${description}</p>
			</div>
		</label>`;
	}).join("");

	new Dialog({
		title: l("stonetop.character.selection.instinct.dialogTitle"),
		content: `
			<input type="text" name="instinct-custom" class="instinct-custom-input"
			       value="${current}" placeholder="${l("stonetop.character.selection.instinct.customPlaceholder")}">
			<hr>
			<div class="selection-options">${options}</div>`,
		buttons: {
			add: { label: l("stonetop.character.selection.select"), callback: async dlg => {
				const val = dlg.find("input[name=instinct-custom]").val().trim();
				if (val) await actor.setFlag("stonetop", "instinct", val);
			}},
			cancel: { label: l("stonetop.character.selection.cancel") },
		},
		default: "add",
		render: dlg => {
			wireOptionClicks(dlg);
			dlg.find("input[name=pick]").on("change", ev => {
				dlg.find("input[name=instinct-custom]").val(ev.currentTarget.value);
			});
		},
	}).render(true);
}

export function openAppearanceDialog(actor, appearance) {
	const saved = actor.getFlag("stonetop", "appearance") ?? {};
	const lines = appearance.map((opts, i) => {
		const radios = opts.map(v =>
			`<label class="appearance-radio">
				<input type="radio" name="line-${i}" value="${v}"${saved[i] === v ? " checked" : ""}>
				${v}
			</label>`
		).join("");
		return `<div class="appearance-row">
			<span class="appearance-row-num">${i + 1}</span>
			<div class="appearance-line">${radios}</div>
		</div>`;
	}).join("");
	new Dialog({
		title: l("stonetop.character.selection.appearance.dialogTitle"),
		content: `<p class="appearance-instruction">${l("stonetop.character.selection.appearance.instruction")}</p><div class="appearance-picker">${lines}</div>`,
		buttons: {
			add: { label: l("stonetop.character.selection.select"), callback: async dlg => {
				const result = {};
				appearance.forEach((_, i) => {
					const val = dlg.find(`input[name=line-${i}]:checked`).val();
					if (val) result[i] = val;
				});
				await actor.setFlag("stonetop", "appearance", result);
			}},
			cancel: { label: l("stonetop.character.selection.cancel") },
		},
		default: "add",
	}).render(true);
}

export function openOriginDialog(actor, origins) {
	const currentRegion = actor.getFlag("stonetop", "origin") ?? "";
	const namesLabel = l("stonetop.character.selection.origin.namesLabel");
	const options = origins.map(({ region, names }) =>
		`<div class="origin-option${region === currentRegion ? " selected" : ""}" data-region="${region}">
			<label class="origin-region">
				<input type="radio" name="pick" value="${region}"${region === currentRegion ? " checked" : ""}>
				<strong>${region}</strong>
			</label>
			<div class="origin-names-section">
				<span class="origin-names-label">${namesLabel}</span>
				<div class="origin-names-list">
					${names.map(n => `<button type="button" class="origin-name">${n}</button>`).join("")}
				</div>
			</div>
		</div>`
	).join("");

	new Dialog({
		title: l("stonetop.character.selection.origin.dialogTitle"),
		content: `<div class="origin-picker">${options}</div>`,
		buttons: {
			add: { label: l("stonetop.character.selection.select"), callback: async dlg => {
				const region = dlg.find("input[name=pick]:checked").val();
				const name   = dlg.find(".origin-name.selected-name").text().trim();
				if (!region) return;
				await actor.setFlag("stonetop", "origin", region);
				if (name) await actor.update({ name });
			}},
			cancel: { label: l("stonetop.character.selection.cancel") },
		},
		default: "add",
		render: dlg => {
			dlg.find(".origin-option").on("click", ev => {
				const row = ev.currentTarget.closest(".origin-option");
				dlg.find(".origin-option").removeClass("selected");
				row.classList.add("selected");
				row.querySelector("input[type=radio]").checked = true;
			});
			dlg.find(".origin-name").on("click", ev => {
				ev.stopPropagation();
				const btn = ev.currentTarget;
				const row = btn.closest(".origin-option");
				dlg.find(".origin-option").removeClass("selected");
				row.classList.add("selected");
				row.querySelector("input[type=radio]").checked = true;
				dlg.find(".origin-name").removeClass("selected-name");
				btn.classList.add("selected-name");
			});
		},
	}).render(true);
}

export function openPickerDialog(title, optionsHtml, onAdd) {
	new Dialog({
		title,
		content: `<div class="selection-options">${optionsHtml}</div>`,
		buttons: {
			add: { label: l("stonetop.character.selection.select"), callback: onAdd },
			cancel: { label: l("stonetop.character.selection.cancel") },
		},
		default: "add",
		render: dlg => wireOptionClicks(dlg),
	}).render(true);
}

export function wireOptionClicks(dlg) {
	dlg.find(".selection-option").on("click", ev => {
		if (window.getSelection().toString()) return;
		const opt = ev.currentTarget.closest(".selection-option");
		dlg.find(".selection-option").removeClass("selected");
		opt.classList.add("selected");
		const radio = opt.querySelector("input[type=radio]");
		radio.checked = true;
		radio.dispatchEvent(new Event("change", { bubbles: true }));
	});
}
