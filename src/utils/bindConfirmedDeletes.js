import { bindAll } from "./bindAll.js";
import { confirmDelete } from "./confirmDelete.js";

/**
 * Wire the shared destructive-delete convention onto every match of `selector`: left-click asks
 * first via confirmDelete (showing the control's `data-name`), right-click skips the confirmation.
 * Same per-render binding rules as bindAll. `app` is the sheet the question opens over.
 */
export function bindConfirmedDeletes(root, selector, run, app) {
	bindAll(root, selector, "click", async ev => {
		// A native event's currentTarget is nulled once dispatch ends, and confirmDelete awaits a
		// dialog — so capture the element now and hand `run` a stand-in event that still carries it,
		// or the handler's `ev.currentTarget.dataset.*` read comes back empty after the await.
		const el = ev.currentTarget;
		if (await confirmDelete(el.dataset.name, app)) await run({ currentTarget: el });
	});
	bindAll(root, selector, "contextmenu", async ev => {
		ev.preventDefault();
		await run(ev);
	});
}
