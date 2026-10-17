import { vibe } from '@weegood/core';
import { describe, expect, it } from 'vitest';
import { midiToHz, planVibeLoop } from './plan';

describe('planVibeLoop', () => {
  it('is deterministic for a track id', () => {
    const track = { id: 'x', vibe: vibe({ energy: 0.7 }) };
    expect(planVibeLoop(track)).toEqual(planVibeLoop(track));
  });

  it('derives tempo and key from the vibe', () => {
    const slowSad = planVibeLoop({ id: 'a', vibe: vibe({ tempo: 0, valence: 0.2 }) });
    const fastHappy = planVibeLoop({ id: 'b', vibe: vibe({ tempo: 1, valence: 0.9 }) });
    expect(slowSad.bpm).toBe(60);
    expect(slowSad.major).toBe(false);
    expect(fastHappy.bpm).toBe(180);
    expect(fastHappy.major).toBe(true);
    expect(fastHappy.loopSeconds).toBeCloseTo((4 * 4 * 60) / 180);
  });

  it('adds drums only when the vibe calls for them', () => {
    const calm = planVibeLoop({ id: 'c', vibe: vibe({ energy: 0.1, danceability: 0.1 }) });
    const club = planVibeLoop({ id: 'd', vibe: vibe({ energy: 0.9, danceability: 0.9 }) });
    expect(calm.kicks).toHaveLength(0);
    expect(calm.hats).toHaveLength(0);
    expect(calm.snares).toHaveLength(0);
    expect(club.kicks).toHaveLength(16);
    expect(club.hats).toHaveLength(64);
    expect(club.snares).toHaveLength(8);
  });

  it('keeps every event inside the loop', () => {
    const plan = planVibeLoop({ id: 'e', vibe: vibe({ energy: 0.8, instrumentalness: 0.9 }) });
    const events = [...plan.pad, ...plan.bass, ...plan.lead, ...plan.kicks, ...plan.hats];
    for (const event of events) {
      expect(event.time).toBeGreaterThanOrEqual(0);
      expect(event.time).toBeLessThan(plan.loopSeconds);
    }
    expect(plan.pad).toHaveLength(12);
  });

  it('converts midi to frequency', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(57)).toBeCloseTo(220);
  });
});
