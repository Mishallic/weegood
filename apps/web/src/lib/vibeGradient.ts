import { clamp01, type VibeVector } from '@weegood/core';

/**
 * The interface is painted by taste (ADR 0013). A vibe vector becomes colour deterministically:
 * valence picks the hue along a path from ultramarine through magenta to vermilion, energy sets
 * saturation and depth, danceability widens the spread between the two main colours, and
 * acousticness decides whether the third wash is warm paper or deep ink.
 */
export interface VibeColor {
  h: number;
  s: number;
  l: number;
}

export function vibeColors(vibe: VibeVector): [VibeColor, VibeColor, VibeColor] {
  const valence = clamp01(vibe.valence);
  const energy = clamp01(vibe.energy);
  const dance = clamp01(vibe.danceability);
  const acoustic = clamp01(vibe.acousticness);

  const hue = (236 + valence * 142) % 360;
  const sat = Math.round(42 + energy * 46);
  const light = Math.round(40 + (1 - energy) * 16);
  const spread = 28 + dance * 54;

  const primary: VibeColor = { h: Math.round(hue), s: sat, l: light };
  const secondary: VibeColor = {
    h: Math.round((hue + spread) % 360),
    s: Math.max(30, sat - 8),
    l: Math.min(70, light + 14),
  };
  const wash: VibeColor =
    acoustic >= 0.5
      ? { h: 38, s: Math.round(20 + acoustic * 30), l: 72 }
      : { h: Math.round((hue + 300) % 360), s: Math.round(20 + (1 - acoustic) * 30), l: 36 };
  return [primary, secondary, wash];
}

function css(color: VibeColor, alpha = 1): string {
  return alpha >= 1
    ? `hsl(${color.h} ${color.s}% ${color.l}%)`
    : `hsl(${color.h} ${color.s}% ${color.l}% / ${alpha})`;
}

/** A two-tone sleeve for tracks without artwork. */
export function coverGradient(vibe: VibeVector): string {
  const [primary, secondary] = vibeColors(vibe);
  return `linear-gradient(145deg, ${css(primary)} 0%, ${css(secondary)} 100%)`;
}

/** Soft colour fields for heroes and backdrops; meant to sit behind content, blurred. */
export function vibeGradient(vibe: VibeVector): string {
  const [primary, secondary, wash] = vibeColors(vibe);
  return [
    `radial-gradient(60% 90% at 18% 30%, ${css(primary)} 0%, transparent 70%)`,
    `radial-gradient(55% 80% at 82% 18%, ${css(secondary)} 0%, transparent 70%)`,
    `radial-gradient(50% 70% at 60% 95%, ${css(wash, 0.9)} 0%, transparent 70%)`,
  ].join(', ');
}
