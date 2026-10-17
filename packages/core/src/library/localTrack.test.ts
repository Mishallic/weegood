import { describe, expect, it } from 'vitest';
import { NEUTRAL_VIBE } from '../domain/vibe';
import {
  createLocalTrack,
  fileExtension,
  inferTrackMetadata,
  isLocalTrack,
  isSupportedAudioFile,
} from './localTrack';

describe('inferTrackMetadata', () => {
  it('reads "Artist - Title"', () => {
    expect(inferTrackMetadata('Paper Lanterns - Midnight Rivers.mp3')).toEqual({
      title: 'Midnight Rivers',
      artistName: 'Paper Lanterns',
      trackNumber: null,
    });
  });

  it('reads a leading track number', () => {
    expect(inferTrackMetadata('03 - Komori Tapes - Blue Hour.flac')).toEqual({
      title: 'Blue Hour',
      artistName: 'Komori Tapes',
      trackNumber: 3,
    });
    expect(inferTrackMetadata('03. Blue Hour.wav')).toEqual({
      title: 'Blue Hour',
      artistName: null,
      trackNumber: 3,
    });
  });

  it('turns underscores into spaces and keeps unknown shapes as the title', () => {
    expect(inferTrackMetadata('my_song_demo.ogg').title).toBe('my song demo');
    expect(inferTrackMetadata('2019 Summer.mp3')).toEqual({
      title: '2019 Summer',
      artistName: null,
      trackNumber: null,
    });
    expect(inferTrackMetadata('noext').title).toBe('noext');
  });
});

describe('isSupportedAudioFile', () => {
  it('accepts by MIME type or by extension', () => {
    expect(isSupportedAudioFile({ name: 'x.bin', type: 'audio/mpeg' })).toBe(true);
    expect(isSupportedAudioFile({ name: 'x.FLAC', type: '' })).toBe(true);
    expect(isSupportedAudioFile({ name: 'notes.txt', type: 'text/plain' })).toBe(false);
    expect(fileExtension('a.b.c.mp3')).toBe('mp3');
  });
});

describe('createLocalTrack', () => {
  it('builds a track with a local source and a neutral vibe', () => {
    const track = createLocalTrack({
      id: 'local_1',
      fileName: 'Demo Take.wav',
      mimeType: 'audio/wav',
      sizeBytes: 1234,
      durationMs: 90_400.6,
      importedAt: 1,
    });
    expect(track.title).toBe('Demo Take');
    expect(track.artistName).toBe('Unknown artist');
    expect(track.durationMs).toBe(90_401);
    expect(track.vibe).toEqual(NEUTRAL_VIBE);
    expect(track.source).toEqual({
      kind: 'local',
      fileName: 'Demo Take.wav',
      mimeType: 'audio/wav',
      sizeBytes: 1234,
      importedAt: 1,
    });
    expect(isLocalTrack(track)).toBe(true);
  });
});
