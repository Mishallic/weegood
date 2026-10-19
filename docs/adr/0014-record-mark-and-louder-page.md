# 0014. A record for a mark, and a louder page

Date: 2026-10-19
Status: Accepted. Amends 0013.

## Context

The first editorial pass (ADR 0013) was tasteful but read as safe: a quiet sidebar on the same
paper as the page, uniform sleeves in every row, section numbers you had to look for. The brand
block was broken outright: the tagline was tucked under the wordmark with a negative margin and
overlapped it, and the mark itself was the favicon shrunk to 22 pixels. The feedback was blunt and
right.

## Decision

- **The wordmark is the mark.** "weegood" set in Fraunces italic, with the two o's drawn as
  records. They turn while music plays, so the logo tells you the state of the player from across
  the room. No tagline sits against it; "The listening room" moves to the foot of the rail. The
  favicon is a single record on vermilion.
- **Three panels.** The navigation rail is printed in ink, the page in paper, the player deck in
  ink again. Light and dark modes keep the composition and swap which is which.
- **Ghost numerals.** Section numbers become large outlined folio figures behind each title, like
  a magazine's running heads, instead of small digits in front.
- **Lead stories.** The first sleeve in every row is twice as wide, with display-size type and the
  reason set as a standfirst. A row reads as a spread, not a conveyor belt.
- **Risograph misregistration.** Sleeves and genre tiles are square-cut and lift off a solid offset
  shadow in vermilion or ink on hover, the way a print's second colour slips. Chosen options in
  onboarding do the same.
- **The record turns.** The now-playing artwork in the deck is a disc with a spindle and grooves,
  and spins while playing.
- **The home page is a poster.** The greeting is set at up to 108 px, roman first word, italic
  second, vermilion full stop. The vibe sentence carries a highlighter swash under the vibe words
  and says "forming" until there are five listens, rather than claiming the listener "reads
  balanced".
- **Chips are stickers.** Small caps, square corners, a coloured dot for genres.

## Consequences

- The page has a point of view. The tokens, fonts and painted-by-taste colour from ADR 0013 are
  untouched; this is composition and detail, about 2 KB more CSS.
- Outlined numerals rely on `-webkit-text-stroke`, supported by every current browser; where it is
  missing they are invisible rather than broken.
- Every spin obeys the reduced-motion rule.
- The ink rail shrinks the paper area, so the aura behind the poster header was enlarged to keep
  colour present on the home page.

## Alternatives considered

- A separate pictorial logo: one more thing to learn, when a wordmark with records already carries
  the idea.
- Making everything louder: bigger type everywhere is just a different kind of uniform. This pass
  picks a few places to be loud and leaves the rest quiet.
