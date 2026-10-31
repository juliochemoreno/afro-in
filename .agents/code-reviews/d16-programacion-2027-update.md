# Code review — D16 programación 2027 update

- Effort: high (native review run inline, 8 angles) + HOPLA checklist pass (no project `review-checklist.md`)
- Counts: kept 1 (fixed), dropped 1

## Kept

severity: medium
confidence: 85
source: native
file: src/content/tour2027/santa-marta.md (+ .en, .fr)
line: 27
issue: Jan 15 listed Dj Acid Burrito at 8:00 pm after Fafoman at 9:00 pm
detail: The 8 PM came from the poster; the team text lists him last and gives no time. Out-of-order schedule with conflicting sources.
suggestion: Drop the time until the team confirms it.
outcome: fixed — time removed in the 3 languages; open question for Julio in the PR.

## Dropped (low confidence)

- src/content/tour2027/santa-marta.md:1 — El Morro hero is 1280 px wide, may look soft on large screens (confidence 60; Gemini upscale prompt is in the plan)
