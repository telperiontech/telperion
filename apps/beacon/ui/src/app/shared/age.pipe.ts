import { Pipe, PipeTransform } from '@angular/core';

/** How long ago `since` was, relative to `now` (ms): "5 min", "3 h", "2 d". */
@Pipe({ name: 'age' })
export class AgePipe implements PipeTransform {
  private static readonly UNITS: [number, string][] = [
    [86_400_000, 'd'],
    [3_600_000, 'h'],
    [60_000, 'min'],
  ];

  transform(since: string | undefined, now: number): string {
    if (!since) return '';
    const ms = Math.max(0, now - Date.parse(since));
    const unit = AgePipe.UNITS.find(([size]) => ms >= size);

    return unit ? `${Math.floor(ms / unit[0])} ${unit[1]}` : 'now';
  }
}
