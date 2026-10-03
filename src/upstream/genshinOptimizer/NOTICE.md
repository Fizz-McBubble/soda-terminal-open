# Third-party notice — frzyc/genshin-optimizer

This directory contains a deliberately cropped, verbatim reuse of
`libs/game-opt/solver/src/common.ts` from:

- Repository: https://github.com/frzyc/genshin-optimizer
- Locked commit: `9617fb58334cfe84e26252041fb9510c34057f62`
- Copyright: Copyright (c) 2020-present frzyc
- License: MIT

The retained `buildCount` primitive is executed by Soda Terminal's upstream
technical slice to bound Cartesian candidate combinations. The formula slice
also retains the dependency-free Pando arithmetic primitive from
`libs/pando/engine/src/node/formula.ts` and the ZZZ formula damage-dimension
guard from `libs/zzz/formula/src/formulaMeta.ts`. No upstream React, Nx, MUI,
browser Worker, generated game database, or player data is vendored here. The
original MIT license requires this notice and the copyright and permission
statement to remain with substantial copied portions.

## Reviewed 3.2 damage arithmetic

`calculation/sharpDamageCore.ts` adapts standard/sharp base, defense and laceration
arithmetic from `libs/zzz/formula/src/data/common/{dmg,prep}.ts` and
`data/char/util.ts` and the shared base-stat defaults in `src/util.ts` at commit `3456cd0f6f5bea10e168074502460dac2fcd6df4`.
The local source identity retains file SHA-256 references. This arithmetic
does not promote catalog, action duration, or trigger evidence to Formal.
The same MIT copyright and permission statement below applies.

`gameDataPacks/general-event-mapping.v1.ts` and the Planning event adapters
contain minimal normalized event mappings adapted from
`frzyc/genshin-optimizer` commit
`eabba1f092b282cccb3f028b7253a1db3dac5208`. Each adopted event retains the
original source file SHA-256 references. Billy and Nekomata direct events, the
first Manato Sheer event, and Piper's 100% single-owner physical anomaly
settlement are consumed only after independent arithmetic revalidation;
adjacent mappings and mixed anomaly ownership remain Candidate or blocked
until separately reviewed. The same MIT terms below apply.

`zzzWEngineKnightsExtolmentCompat.ts` normalizes the level-60 static fields,
P1-P5 values and two independent 25-second trigger stacks from the same locked
commit's `KnightsExtolment.json`. It is a local deterministic adapter; no
upstream runtime, website result, generated database or account fact is used.

## MIT License

## Out-of-combat panel R1

`gameDataPacks/panel/currentPanelData.ts` contains minimal normalized Billy,
Nekomata, Manato and Piper anchors plus their named W-Engine paths from the locked
commit's `libs/zzz/stats/Data`.
`calculation/outOfCombatPanel.ts` independently applies the documented level,
promotion, core and W-Engine formulas; no generated upstream database is
vendored.

Copyright (c) 2020-present frzyc

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
