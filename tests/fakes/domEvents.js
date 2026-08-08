// Firing a native event at a rendered sheet, and letting the handler's promise chain drain.
//
// Shared because a sheet test's whole method is "dispatch the event the browser would, then assert
// the actor state" — a per-file copy of these two lines is how one test ends up firing a
// non-bubbling event, or asserting before an async handler has run, and quietly proving nothing.

/** Dispatch a bubbling, cancelable event — what a real user interaction looks like to a delegated listener. */
export const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));

/** Yield to the macrotask queue so an async handler's awaits have all resolved. */
export const settle = () => new Promise(r => setTimeout(r));
