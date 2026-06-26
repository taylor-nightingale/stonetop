// Open a singleton Application, or bring the already-open one to the front
// instead of stacking a duplicate. `id` is the Application's defaultOptions.id;
// `open` mints (and renders) a fresh instance when none is showing.
export function openOrFocus(id, open) {
	const existing = Object.values(ui.windows).find(w => w.id === id);
	if (existing?.rendered) return existing.bringToTop();
	return open();
}
