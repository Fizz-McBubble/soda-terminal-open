import { afterEach, describe, expect, it, vi } from "vitest";
import * as mechanics from "../calculation/currentAgentMechanicContracts";
import { getCurrentAgentDecisionMechanicContract } from "../calculation/currentAgentDecisionMechanicContracts";
import {
  createPlanningExpressionDomainRuntime,
  evaluateUpstreamExpressionIr,
  extractUpstreamEffectValueIr,
  type UpstreamExpressionIR,
} from "../calculation/currentUpstreamExpressionIR";
import {
  absoluteDiscRetentionCatalog as catalog,
  absoluteDiscRetentionPolicy as policy,
} from "./absoluteDiscRetentionCatalog";
import type { Disc, Profile } from "./absoluteDiscRetentionContract";
import { resolveNamedInvestmentCalibration } from "./absoluteDiscRetentionInvestmentCalibration";
import { assessDisc } from "./absoluteDiscRetentionKernel";
import {
  scoreProfile,
  twoPieceApplicability,
} from "./absoluteDiscRetentionScoring";
import { reviewedHpRetentionEvidence } from "./reviewedHpRetentionEvidence";

afterEach(() => vi.restoreAllMocks());
const ids = [
  "agent-zhao:base-0:fnv1a-2a59",
  "agent-zhao:base-1:fnv1a-f244",
  "agent-lucia:base-0:fnv1a-782d",
];
const cases = ids.flatMap((id) => [4, 5, 6].map((slot) => ({ id, slot })));
const native = catalog.rules.rarities.S!;
function fixture(profile: Profile, slot: number, level = 0, hpHits = 0): Disc {
  const set = catalog.sets.find(
    (row) => twoPieceApplicability(row, profile) !== "incompatible",
  )!;
  return {
    id: "synthetic-hp-investment",
    setId: set.id,
    slot,
    rarity: "S",
    mainStat: "hp_percent",
    level,
    subStats: ["hp_flat", "atk_flat", "def_flat", "pen"].map((stat, index) => {
      const upgrades =
        index === 0 ? hpHits : index === 1 ? Math.floor(level / 3) - hpHits : 0;
      return { stat, upgrades, value: native.steps[stat]! * (1 + upgrades) };
    }),
  };
}
function score(disc: Disc, profile: Profile) {
  return scoreProfile(
    disc,
    profile,
    catalog.sets.find((row) => row.id === disc.setId),
    catalog.rules,
    policy,
  );
}

describe("nine source-bound HP-main investment combinations", () => {
  it.each(cases)(
    "$id slot $slot has a positive secondary input without lowering global core policy",
    ({ id, slot }) => {
      const profile = catalog.profiles.find((row) => row.id === id)!;
      const disc = fixture(profile, slot);
      const before = JSON.stringify(disc);
      const use = score(disc, profile);
      expect(JSON.stringify(disc)).toBe(before);
      expect(use.investment).toMatchObject({
        calibrationId: `named-secondary-hp-investment-r1:${id}:S:${slot}:hp_percent`,
        qualified: true,
        minimumLines: 0,
        minimumCoreLines: 0,
        meaningfulStats: [],
        coreStats: [],
        requiredCoreStats: [],
        requiredSecondaryStats: ["hp_flat"],
        secondaryStats: ["hp_flat"],
        policyBlockers: [],
        progressFloor: 0,
        potentialTarget: 60,
      });
      expect(
        use.investment.calibrationSourceIds!.some((source) =>
          source.startsWith("miyoushe-"),
        ),
      ).toBe(true);
      expect(profile.coreStats).toEqual(["hp_percent"]);
      expect(profile.weights.hp_flat).toBeGreaterThan(0);
      expect(profile.weights.hp_flat).toBeLessThan(0.5);
      expect(policy.investment).toMatchObject({
        meaningfulWeightFrom: 0.5,
        minimumCoreLines: 1,
        leftSlotMinimumLines: 2,
        rightSlotMinimumLines: 1,
      });
      expect(use.functionalState).toBe("needs_build_context");
      const result = assessDisc(
        disc,
        {
          ...catalog,
          profiles: [profile],
          releasedAgentIds: [profile.agentId],
          coverageGaps: [],
          branchCoverageComplete: true,
        },
        policy,
      );
      expect(result.nextAction.kind).toBe("check_condition");
      expect(
        result.blockedBy.every((row) => row.kind === "conditional_use"),
      ).toBe(true);
    },
  );
  it.each(cases)(
    "$id slot $slot still rejects stalled progress, poor legal ceiling and absent HP input",
    ({ id, slot }) => {
      const profile = catalog.profiles.find((row) => row.id === id)!;
      for (const [level, hpHits, qualified] of [
        [3, 0, true],
        [6, 0, false],
        [6, 1, true],
        [9, 0, false],
        [9, 1, true],
        [12, 1, false],
        [12, 2, true],
      ] as const)
        expect(
          score(fixture(profile, slot, level, hpHits), profile).investment
            .qualified,
        ).toBe(qualified);
      const base = fixture(profile, slot);
      const absent = {
        ...base,
        subStats: base.subStats.map((line) =>
          line.stat === "hp_flat"
            ? { stat: "crit_rate", value: native.steps.crit_rate!, upgrades: 0 }
            : line,
        ),
      };
      expect(score(absent, profile).investment.qualified).toBe(false);
      expect(
        score(fixture(profile, slot, 15, 5), profile).investment.qualified,
      ).toBe(false);
    },
  );
  it("allows a legal three-line unlock without inventing an upgrade and preserves six prior Zhao left-slot calibrations", () => {
    for (const id of ids) {
      const profile = catalog.profiles.find((row) => row.id === id)!;
      const seed = fixture(profile, 4);
      expect(
        score({ ...seed, subStats: seed.subStats.slice(0, 3) }, profile)
          .investment.qualified,
      ).toBe(true);
      expect(score({ ...seed, level: 3 }, profile).investment.qualified).toBe(
        true,
      );
    }
    for (const id of ids.slice(0, 2))
      for (const slot of [1, 2, 3]) {
        const profile = catalog.profiles.find((row) => row.id === id)!;
        const main = ["hp_flat", "atk_flat", "def_flat"][slot - 1]!;
        const disc = {
          ...fixture(profile, slot),
          mainStat: main,
          subStats: ["hp_percent", "atk_percent", "crit_rate", "pen"].map(
            (stat) => ({
              stat,
              value: native.steps[stat]!,
              upgrades: 0,
            }),
          ),
        };
        expect(score(disc, profile).investment).toMatchObject({
          qualified: true,
          minimumLines: 1,
          minimumCoreLines: 1,
          requiredCoreStats: ["hp_percent"],
          requiredSecondaryStats: [],
        });
      }
  });
  it("rejects changed weights, sources, identity, rarity or main and stale upstream bindings", () => {
    const profile = catalog.profiles.find((row) => row.id === ids[0])!;
    const disc = fixture(profile, 4);
    for (const patch of [
      { id: "unknown" },
      { verified: false },
      { goal: "crit_damage" },
      { sourceIds: [...profile.sourceIds, "changed"] },
      { weights: { ...profile.weights, hp_flat: 0.49 } },
      { coreStats: ["hp_flat"] },
    ] satisfies Partial<Profile>[])
      expect(
        resolveNamedInvestmentCalibration(
          disc,
          { ...profile, ...patch },
          catalog.rules,
          policy,
        ),
      ).toBeNull();
    expect(
      resolveNamedInvestmentCalibration(
        { ...disc, rarity: "A" },
        profile,
        catalog.rules,
        policy,
      ),
    ).toBeNull();
    expect(
      resolveNamedInvestmentCalibration(
        { ...disc, mainStat: "atk_percent" },
        profile,
        catalog.rules,
        policy,
      ),
    ).toBeNull();
    const original = mechanics.getCurrentAgentEventContract(profile.agentId)!;
    vi.spyOn(mechanics, "getCurrentAgentEventContract").mockReturnValue({
      ...original,
      source: { ...original.source, commit: "0".repeat(40) },
    });
    expect(reviewedHpRetentionEvidence(profile.agentId)).toBeNull();
    expect(
      resolveNamedInvestmentCalibration(disc, profile, catalog.rules, policy),
    ).toBeNull();
  });
});

describe("the consumed Lucia source formula keeps buff cap separate from other HP effects", () => {
  const contract =
    getCurrentAgentDecisionMechanicContract("agent-lucia")!.effectContract;
  function amount(id: string, hp: number, active = true) {
    const effect = contract.effects.find((row) => row.effectId === id)!;
    const value = extractUpstreamEffectValueIr(
      effect.numericExpression.expressionIr as UpstreamExpressionIR,
    );
    expect(value.status).toBe("supported");
    if (value.status !== "supported")
      throw new Error("Unsupported source value");
    const result = evaluateUpstreamExpressionIr(
      value.value as UpstreamExpressionIR,
      createPlanningExpressionDomainRuntime({
        references: {
          "own.initial.hp": hp,
          "own.final.hp": hp,
          "char.special": 12,
          darkbreaker: active,
        },
      }),
    );
    expect(result.status).toBe("supported");
    return result.status === "supported" ? result.value : null;
  }
  it("consumes base12, the real initial-HP formula, cap and actual Darkbreaker state", () => {
    expect(
      contract.effects.find((row) => row.effectId === "exSpecial_sheerForce"),
    ).toMatchObject({
      locator: "Lucia.ts:213",
      applicationScope: "generic",
      recipients: ["team"],
    });
    expect(amount("exSpecial_sheerForce", 20000)).toBeCloseTo(752);
    expect(amount("exSpecial_sheerForce", 24000)).toBeCloseTo(900);
    expect(amount("exSpecial_sheerForce", 30000)).toBeCloseTo(900);
    expect(amount("exSpecial_sheerForce", 24000, false)).toBe(0);
  });
  it("does not zero Harmony HP damage when the team buff is already capped", () => {
    expect(amount("exSpecial_harmony_dmg_", 30000)).toBeCloseTo(21000);
    expect(
      (amount("exSpecial_harmony_dmg_", 30112) as number) -
        (amount("exSpecial_harmony_dmg_", 30000) as number),
    ).toBeCloseTo(78.4);
  });
});
