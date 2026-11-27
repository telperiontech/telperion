import '@angular/compiler';
import '@analogjs/vitest-angular/setup-snapshots';
import { getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';

// TestBed runs zoneless (Angular's default); specs wait for rendering with `fixture.whenStable()`
getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
