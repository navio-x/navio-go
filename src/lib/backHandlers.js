/**
 * What the hardware back button closes before it navigates: every open
 * overlay (the More menu, a bottom sheet) registers a handler while it is
 * open, and back runs the most recently opened one instead of leaving the
 * page underneath.
 */
const stack = [];

/** Registers `handler` as the top back target; returns the function that removes it. */
export function pushBackHandler(handler) {
  stack.push(handler);
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}

/** Runs the top handler. False when nothing is open and back should navigate. */
export function handleBack() {
  const handler = stack[stack.length - 1];
  if (!handler) return false;
  handler();
  return true;
}
