import type { Meta, StoryObj } from '@storybook/web-components';
import { html } from 'lit';
import './router-element';
import './route-element';
import './router-link-element';
import './router-outlet-element';
import './router-config-element';
import { defaultRouteSourceLoader, RouteSourceLoader } from './route-source';

/** Serves a snippet of HTML from an in-memory blob URL. */
function htmlUrl(markup: string): string {
  return URL.createObjectURL(new Blob([markup], { type: 'text/html' }));
}

const ABOUT_URL = htmlUrl(`
  <h1>ℹ️ About</h1>
  <p>This content was fetched from <code>src</code> the first time the route matched.</p>
  <p>Navigate away and back: it is served from the route's cache, with no new request.</p>
`);
const SLOW_URL = htmlUrl(`
  <h1>🐢 Slow page</h1>
  <p>This route's <code>loader</code> waits 1.5 seconds, so the <code>data-loading</code> template shows first.</p>
`);
const MISSING_URL = new URL('./this-file-does-not-exist.html', document.baseURI).href;
const slowLoader: RouteSourceLoader = async (url, signal) => {
  await new Promise(resolve => setTimeout(resolve, 1500));

  return defaultRouteSourceLoader(url, signal);
};
const meta: Meta = {
  title: 'Router/Remote Content',
  component: 'tp-route',
  tags: ['autodocs'],
  decorators: [
    (story) => {
      let routerConfig = document.head.querySelector('tp-router-config');

      if (!routerConfig) {
        routerConfig = document.createElement('tp-router-config');
        document.head.appendChild(routerConfig);
      }

      routerConfig.setAttribute('history', 'memory');

      return html`${story()}`;
    },
  ],
};

export default meta;

type Story = StoryObj;

/**
 * Routes with a `src` attribute load their content when they first match.
 * `<template data-loading>` and `<template data-error>` children render while
 * loading and on failure; the outlet mirrors the state as `route-loading` /
 * `route-error` attributes, styled here.
 */
export const RemoteContent: Story = {
  render: () => html`
    <style>
      .remote-demo nav { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
      .remote-demo tp-router-link { padding: 0.5rem 1rem; border: 2px solid #ccc; border-radius: 4px; }
      .remote-demo tp-router-link[active] { border-color: #0066cc; color: #0066cc; font-weight: bold; }
      .remote-demo tp-router-outlet { display: block; padding: 1rem; border-left: 4px solid #ccc; }
      .remote-demo tp-router-outlet[route-loading] { border-color: #f0ad4e; }
      .remote-demo tp-router-outlet[route-error] { border-color: #d9534f; }
    </style>

    <div class="remote-demo">
      <nav>
        <tp-router-link to="/">Home</tp-router-link>
        <tp-router-link to="/about">About (src)</tp-router-link>
        <tp-router-link to="/slow">Slow (src)</tp-router-link>
        <tp-router-link to="/broken">Broken (src)</tp-router-link>
      </nav>

      <tp-router>
        <tp-route path="/">
          <template>
            <h1>🏠 Home</h1>
            <p>This route uses an inline template. The others load their HTML from a URL.</p>
          </template>
        </tp-route>

        <tp-route path="/about" src=${ABOUT_URL}></tp-route>

        <tp-route path="/slow" src=${SLOW_URL} .loader=${slowLoader}>
          <template data-loading><p>⏳ Loading…</p></template>
        </tp-route>

        <tp-route path="/broken" src=${MISSING_URL}>
          <template data-loading><p>⏳ Loading…</p></template>
          <template data-error><p>❌ Could not load this page. Navigate here again to retry.</p></template>
        </tp-route>

        <tp-router-outlet></tp-router-outlet>
      </tp-router>
    </div>
  `,
};
