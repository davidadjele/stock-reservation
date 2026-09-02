const assert = require("node:assert/strict");
const test = require("node:test");

const { withLock } = require("../dist/lock");

test("serialise les sections critiques du meme produit", async () => {
  const events = [];

  const first = withLock(1, async () => {
    events.push("first:start");
    await Promise.resolve();
    events.push("first:end");
  });
  const second = withLock(1, () => events.push("second"));

  await Promise.all([first, second]);

  assert.deepEqual(events, ["first:start", "first:end", "second"]);
});

test("libere la file apres une erreur", async () => {
  await assert.rejects(withLock(2, () => {
    throw new Error("boom");
  }), /boom/);

  await assert.doesNotReject(withLock(2, () => "ok"));
});