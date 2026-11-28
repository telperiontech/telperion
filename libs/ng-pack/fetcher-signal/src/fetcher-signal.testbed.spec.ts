import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { fetcherSignal } from './fetcher-signal';

interface Overview {
  packages: number;
}

/** Waits past fetcherSignal's 10 ms option debounce. */
const settle = () => new Promise(resolve => setTimeout(resolve, 20));

describe('fetcherSignal', () => {
  let http: HttpTestingController;
  let injector: Injector;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    injector = TestBed.inject(Injector);
  });

  afterEach(() => http.verify());

  it('requests once and exposes the response', async () => {
    const overview = fetcherSignal<Overview | null>({ url: '/api/overview', fallback: null }, injector);
    await settle();

    http.expectOne('/api/overview').flush({ packages: 3 });
    expect(overview()).toEqual({ packages: 3 });
    expect(overview.loading()).toBe(false);
  });

  it('re-runs the request on reload()', async () => {
    const overview = fetcherSignal<Overview | null>({ url: '/api/overview', fallback: null }, injector);
    await settle();
    http.expectOne('/api/overview').flush({ packages: 1 });

    const reloaded = overview.reload();
    http.expectOne('/api/overview').flush({ packages: 2 });
    await reloaded;

    expect(overview()).toEqual({ packages: 2 });
  });

  it('re-runs the request on every reloadOn emission', async () => {
    const changes = new Subject<string[]>();
    const overview = fetcherSignal<Overview | null>({ url: '/api/overview', fallback: null, reloadOn: changes }, injector);
    await settle();
    http.expectOne('/api/overview').flush({ packages: 1 });

    changes.next(['js-utils']);
    http.expectOne('/api/overview').flush({ packages: 2 });
    expect(overview()).toEqual({ packages: 2 });

    changes.next(['ng-pack']);
    http.expectOne('/api/overview').flush({ packages: 3 });
    expect(overview()).toEqual({ packages: 3 });
  });

  it('keeps reload() working next to reloadOn', async () => {
    const overview = fetcherSignal<Overview | null>({ url: '/api/overview', fallback: null, reloadOn: new Subject() }, injector);
    await settle();
    http.expectOne('/api/overview').flush({ packages: 1 });

    const reloaded = overview.reload();
    http.expectOne('/api/overview').flush({ packages: 2 });
    await reloaded;

    expect(overview()).toEqual({ packages: 2 });
  });
});
