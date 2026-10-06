/**
 * Serializes async operations sharing a key, so a load-modify-save cycle on
 * the same record (one conversation) never overlaps another for that same
 * key. Without this, two concurrent calls — e.g. sending a message while
 * one arrives on the same conversation, or an ack and an incoming message
 * landing close together — can both load the conversation before either
 * has saved; whichever saves second silently overwrites the first's write
 * (a "lost update"), dropping a message from local storage even though it
 * was sent/received successfully over the wire. See messages.js and
 * groupMessages.js.
 */
export function createKeyedMutex() {
  const tails = new Map();
  return function withLock(key, fn) {
    const prev = tails.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    // Only the stored tail swallows rejections, so one failed op doesn't
    // wedge the queue for this key — the caller's own promise still rejects.
    tails.set(key, run.then(() => {}, () => {}));
    return run;
  };
}
