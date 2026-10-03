// Scenario inputs shared by the Roxy compiler and runtime tests.
// Keep expected source scalars and damage oracles in the individual tests.
export function roxyPreparedState(energy: number) {
  return {
    energy,
    energyCapacity: 120,
    windEnergy: 3,
    groundEyes: 0,
    energyConsumptionAccumulator: 0,
  }
}

export function roxyTapConditions() {
  return {
    directDamageContacts: true,
    createdEyes: 3,
    simultaneousHammerEyeContacts: 3,
    hammerBeforeEyeExpiry: true,
    eyeBlastContacts: 3,
    giantWindstormContactSeconds: 1,
    constantDamageState: true,
  }
}

export function roxyHeldConditions() {
  return {
    ...roxyTapConditions(),
    uninterruptedWhirlwind: true,
    fullWhirlwindContact: true,
    releaseWithoutJoystickMovement: true,
  }
}
