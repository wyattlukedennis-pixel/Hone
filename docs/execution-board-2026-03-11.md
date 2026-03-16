# Hone Execution Board (Week Of March 11, 2026)

This board is intentionally narrow. It focuses on the core loop:

1. Open app
2. Record today
3. Save clip
4. See proof of progress

## Weekly Target

By end of week, a user should be able to:

- reliably record and save without clip loss
- open calendar history
- compare two days (or Day 1 vs Today) in a smooth flow

## Top 10 Tickets (Priority Order)

1. **HON-090** - Add clip save state machine and retry queue  
   Why now: reliability is the product trust layer.

2. **HON-091** - Simplify Practice home to one dominant action  
   Why now: removes cognitive noise and strengthens habit loop.

3. **HON-033** - Connect mobile upload + save flow  
   Why now: must be fully stable before progress moments matter.

4. **HON-093** - Build calendar history view  
   Why now: calendar is the primary memory surface and BeReal-inspired anchor.

5. **HON-094** - Open day detail from calendar  
   Why now: calendar only works if each day is explorable.

6. **HON-040** - Implement comparison pair selection logic  
   Why now: deterministic pairing enables credible comparisons.

7. **HON-095** - Enable tap-two-days compare  
   Why now: makes progress discovery interactive and memorable.

8. **HON-096** - Promote Day 1 vs Today as primary proof moment  
   Why now: this is the emotional payoff and signature behavior.

9. **HON-073** - Add mobile smoke tests for main loop  
   Why now: prevents regressions in auth -> record -> save -> compare.

10. **HON-074** - Performance pass on startup/record/playback  
    Why now: removes stutter/friction that kills daily ritual feel.

## Daily Sequence (Suggested)

### Day 1

- HON-090 (state machine + retry queue skeleton)
- HON-091 (Practice simplification pass)

### Day 2

- HON-033 hardening and QA pass
- start HON-093 (calendar shell)

### Day 3

- finish HON-093
- HON-094 day detail playback

### Day 4

- HON-040 comparison logic
- HON-095 tap-two-days compare flow

### Day 5

- HON-096 Day 1 vs Today prominence pass
- HON-073 smoke tests
- HON-074 performance polish

## Cutline If Week Slips

Do not compromise on these 6:

1. HON-090
2. HON-091
3. HON-033
4. HON-093
5. HON-094
6. HON-095

If needed, move HON-073/HON-074 to early next week, but keep manual verification for core loop before shipping.

## Definition Of Done For This Week

- No known clip-loss path.
- Practice screen has one obvious primary action.
- Calendar interaction is stable on device.
- User can compare two selected days.
- Day 1 vs Today is reachable in <= 2 taps from Progress.
- Core loop can be run end-to-end without visual or playback failure.
