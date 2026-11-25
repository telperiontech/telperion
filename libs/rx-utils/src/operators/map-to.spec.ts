import { lastValueFrom, of, Subject, throwError, toArray } from 'rxjs';
import { mapTo } from './map-to';

describe('mapTo', () => {
  it('replaces every value with the constant', async () => {
    await expect(lastValueFrom(of(1, 2, 3).pipe(mapTo('x'), toArray()))).resolves.toEqual(['x', 'x', 'x']);
  });

  it('emits the same reference each time', async () => {
    const constant = { flag: true };
    const [first, second] = await lastValueFrom(of(1, 2).pipe(mapTo(constant), toArray()));

    expect(first).toBe(constant);
    expect(second).toBe(constant);
  });

  it('passes errors through', async () => {
    const error = new Error('boom');

    await expect(lastValueFrom(throwError(() => error).pipe(mapTo(1)))).rejects.toBe(error);
  });

  it('emits only when the source emits', () => {
    const source = new Subject<number>();
    const next = jest.fn();

    source.pipe(mapTo('x')).subscribe(next);
    expect(next).not.toHaveBeenCalled();

    source.next(1);
    expect(next).toHaveBeenCalledWith('x');
  });
});
