import { describe, expect, it } from 'vitest';
import { PaintRenderingContext2D } from '../paint.type';
import { PlexusPaintlet } from './plexus.paintlet';

interface Recording {
  dots: [number, number][];
  lines: number;
}

/** Records dot centers (from `arc`) and stroked lines. */
function recordingContext(recording: Recording): PaintRenderingContext2D {
  return {
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc(x: number, y: number) {
      recording.dots.push([x, y]);
    },
    fill() {},
    stroke() {
      recording.lines++;
    },
  } as unknown as PaintRenderingContext2D;
}

function properties(values: Record<string, string | number>): StylePropertyMapReadOnly {
  return { get: (name: string) => (name in values ? String(values[name]) : undefined) } as unknown as StylePropertyMapReadOnly;
}

function render(values: Record<string, string | number>, width = 400, height = 300): Recording {
  const recording: Recording = { dots: [], lines: 0 };
  new PlexusPaintlet().paint(recordingContext(recording), { width, height }, properties(values));

  return recording;
}

describe('PlexusPaintlet', () => {
  it('places one dot per `density` px²', () => {
    expect(render({ '--tp-plexus-density': 10000 }).dots).toHaveLength(12);
    expect(render({ '--tp-plexus-density': 5000 }).dots).toHaveLength(24);
  });

  it('loops seamlessly: frame 100 matches frame 0', () => {
    const start = render({ '--tp-plexus-frame': 0 }).dots;
    const end = render({ '--tp-plexus-frame': 100 }).dots;

    end.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(start[i][0], 6);
      expect(y).toBeCloseTo(start[i][1], 6);
    });
  });

  it('moves dots between frames', () => {
    const start = render({ '--tp-plexus-frame': 0 }).dots;
    const later = render({ '--tp-plexus-frame': 13 }).dots;

    expect(later).not.toEqual(start);
  });

  it('keeps dots inside the element at every frame', () => {
    for (let frame = 0; frame <= 100; frame += 2.5) {
      for (const [x, y] of render({ '--tp-plexus-frame': frame, '--tp-plexus-dot-size': 6 }).dots) {
        expect(x).toBeGreaterThanOrEqual(3);
        expect(x).toBeLessThanOrEqual(397);
        expect(y).toBeGreaterThanOrEqual(3);
        expect(y).toBeLessThanOrEqual(297);
      }
    }
  });

  it('draws no lines when proximity is 0', () => {
    expect(render({ '--tp-plexus-proximity': 0 }).lines).toBe(0);
    expect(render({ '--tp-plexus-proximity': 500 }).lines).toBe((12 * 11) / 2);
  });

  it('caps the number of dots', () => {
    expect(render({ '--tp-plexus-density': 1 }).dots.length).toBeLessThanOrEqual(400);
  });
});
