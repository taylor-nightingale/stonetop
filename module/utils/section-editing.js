/**
 * Mixin for actor sheets that expose per-section edit pencils alongside the
 * global header-wrench edit mode. A section is editable when the global wrench
 * (`_editMode`) is on OR that section's own pencil has been toggled.
 *
 * Extracted from StonetopCharacterSheet and StonetopSteadingSheet so the two
 * can't drift apart. Subclasses keep owning `_editMode`; this mixin only reads
 * it. Wire the delegated toggle handler from `activateListeners` via
 * `_wireSectionEditToggle(html, selector)`, and override the
 * `_onSectionEdit{Opened,Closed}` hooks for any per-sheet flourishes (e.g. the
 * steading's fade-out "done" check).
 *
 * @template {new (...args: any[]) => { _editMode: boolean, render: Function }} T
 * @param {T} Base
 */
export function withSectionEditing(Base) {
	return class extends Base {
		// Sections with their own pencil, tracked independently of `_editMode`.
		_editingSections = new Set();

		/** Whether a given section should render as editable right now. */
		isSectionEditable(section) {
			return this._editMode || this._editingSections.has(section);
		}

		/** True when the global wrench is on or any section pencil is open. */
		get hasActiveEdits() {
			return this._editMode || this._editingSections.size > 0;
		}

		/**
		 * Install the delegated click handler for per-section edit toggles.
		 * @param {JQuery}  html     the sheet's rendered jQuery element
		 * @param {string}  selector the toggle anchor selector (per sheet)
		 */
		_wireSectionEditToggle(html, selector) {
			html[0].addEventListener("click", ev => {
				const toggle = ev.target.closest(selector);
				if (!toggle) return;
				ev.stopPropagation();
				const section = toggle.dataset.section;
				if (this._editingSections.has(section)) {
					this._editingSections.delete(section);
					this._onSectionEditClosed(section);
				} else {
					this._editingSections.add(section);
					this._onSectionEditOpened(section);
				}
				this.render(false);
			}, true);
		}

		/** Hook: a section's pencil was just opened. */
		_onSectionEditOpened(section) {}

		/** Hook: a section's pencil was just closed. */
		_onSectionEditClosed(section) {}
	};
}
