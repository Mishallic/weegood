# 0009. Questionnaire for new users, persisted profile for returning users

Date: 2026-10-17
Status: Accepted

## Context

Recommendations need a starting point. We can ask (a questionnaire) or infer (from what the
device already knows about the user). On a first visit there is nothing to infer, and on a return
visit a questionnaire is an insult. The product brief also commits to privacy, so whatever we
store must be on-device and explained.

## Decision

- First visit: a four-step questionnaire under a minute long. Pick genres (3 to 5), pick moods
  (2 to 4), pick a few artists we show based on those choices, pick a main listening context.
  The answers seed the taste profile through `createProfileFromOnboarding`.
- The profile is persisted on-device (IndexedDB). On a return visit its presence is the signal
  that the user is known, and the app opens on the home feed. This is the "cookie" path, without
  a cookie: nothing is sent anywhere, and we tell the user so on the first screen.
- Users can always re-run onboarding or reset the profile from settings.
- Implicit signals (plays, skips, likes, follows) keep refining the profile after onboarding.

## Consequences

- Zero-friction return visits; honest first visit.
- If a browser clears site data the profile is gone. Export and import exists for that; sync
  (M3) solves it properly.
- Importing listening history from other services is the natural way to shorten onboarding later
  and is parked in the roadmap.

## Alternatives considered

- Third-party cookies or fingerprinting to infer taste: a privacy violation and increasingly
  blocked by browsers.
- Account-first: friction before value, and we have no backend.
- Skip onboarding and learn only from listening: the first hour of recommendations would be
  random, which is exactly when testers form an opinion.
