# 0013. An editorial visual identity, painted by taste

Date: 2026-10-19
Status: Accepted. Amends 0007 (web fonts).

## Context

The first interface was deliberately plain while the product found its shape. With real music
streaming and a recommendation model worth showing, the look needs to carry the product's point:
music chosen for you, explained, by something that knows you. It also has to stay fast and work
in light and dark without becoming two designs.

## Decision

- **Print, not dashboard.** Warm paper and ink rather than grey and neon: one vermilion accent for
  action and emphasis, an ultramarine foil for information, hairline rules, numbered sections like
  a tracklist on a sleeve. Dark mode is the same sheet printed in reverse, so tokens flip and the
  components stay.
- **Two typefaces, self-hosted.** Fraunces, a soft serif with character, for headlines, captions
  and the reasons behind each pick; Instrument Sans, a precise grotesk, for the interface. Both are
  open-licensed (SIL OFL 1.1) and bundled as Latin subsets from `scripts/fetch-fonts.mjs`, about
  130 KB in total, so no request goes to a font CDN. This amends ADR 0007's "system fonts only".
- **The interface is painted by taste.** A vibe vector maps deterministically to colour: valence
  sets the hue from ultramarine through magenta to vermilion, energy sets saturation and depth,
  danceability the spread, acousticness whether the wash is paper or ink. Tracks without artwork get
  typographic sleeves in their vibe's colours; heroes carry a blurred aura of the page's vibe; the
  onboarding background forms as the listener picks genres and moods.
- **The player is an inverted deck** across the bottom, ink on paper or paper on ink, with the one
  bright element being the play button.
- Motion is restrained and respects reduced-motion preferences. Paper grain is a static background,
  no blend modes, so scrolling stays cheap.

## Consequences

- A recognisable identity that is also informative: colour means something.
- Fonts add one-time downloads of about 140 KB, cached thereafter; the JavaScript budget is
  unchanged.
- Blurred auras cost GPU on weak devices; they are reduced on small screens and can be disabled per
  component if testing shows jank.
- Contrast is held at or above 4.5:1 for body text in both themes; the accent is only used for
  small text through its darker `--accent-text` variant.

## Alternatives considered

- Keep system fonts: faster by a few kilobytes, but no identity. The budget can afford this.
- A component library theme: would fight the editorial direction at every turn.
- Neon-on-black like every other player: the thing we are trying not to be.
