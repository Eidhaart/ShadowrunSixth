import test from "node:test";
import assert from "node:assert/strict";
import { emptyRuleset, setActiveRules } from "../src/lib/house/rules";
import { useRunners } from "../src/lib/store/characters";
import { BUILDS, fromBuild, fromPremade, PREMADES } from "../src/lib/sr6/premades";
import { budget } from "../src/lib/sr6/derive";

test("Forge finish checks the stored draft and applies starting currency caps", () => {
  const state = useRunners.getState();
  const draft = state.startDraft(fromBuild(BUILDS[0]));
  try {
    state.patchDraft((c) => { c.priorities.magic = c.priorities.skills; });
    assert.equal(state.finishDraft(), null);
    assert.equal(useRunners.getState().draft?.id, draft.id);
    assert.equal(useRunners.getState().runners[draft.id], undefined);

    state.startDraft(draft);
    setActiveRules({ ...emptyRuleset(), mech: { startKarma: 60 } });
    assert.ok(budget(draft).karma.left > 5);
    assert.ok(budget(draft).nuyen.left > 5000);
    const finished = state.finishDraft();
    assert.equal(finished?.karmaEarned, 5);
    assert.equal(finished?.nuyen, 5000);
    assert.equal(useRunners.getState().draft, null);
  } finally {
    setActiveRules(null);
    state.discardDraft();
    state.remove(draft.id);
  }
});

test("premade completion and subsequent Forge edits preserve play balances", () => {
  const state = useRunners.getState();
  const draft = state.startDraft(fromPremade(PREMADES[0]));
  try {
    assert.equal(state.finishDraft()?.stage, "complete");
    state.update(draft.id, (c) => { c.nuyen = 22000; c.karmaEarned = 12; c.karmaSpent = 2; });
    state.startDraft(useRunners.getState().runners[draft.id]);
    state.patchDraft((c) => { c.alias = "Edited"; });
    const finished = state.finishDraft();
    assert.deepEqual([finished?.alias, finished?.nuyen, finished?.karmaEarned, finished?.karmaSpent], ["Edited", 22000, 12, 2]);
  } finally {
    state.discardDraft();
    state.remove(draft.id);
  }
});
