# @telperion/ts-utils

[![npm version](https://badge.fury.io/js/%40telperion%2Fts-utils.svg)](https://badge.fury.io/js/%40telperion%2Fts-utils)
[![Build Status](https://github.com/telperiontech/telperion/actions/workflows/ts-utils.publish.yml/badge.svg)](https://github.com/telperiontech/telperion/actions/workflows/ts-utils.publish.yml)
[![npm downloads](https://img.shields.io/npm/dm/@telperion/ts-utils.svg)](https://www.npmjs.com/package/@telperion/ts-utils)

Decorators and helpers for TypeScript classes, built on top of [@telperion/js-utils](https://www.npmjs.com/package/@telperion/js-utils).

Full reference: [open-source.telperion.tr/ts-utils](https://open-source.telperion.tr/ts-utils)

> Formerly published as `@thalesrc/ts-utils`.

## Installation

```bash
npm install @telperion/ts-utils
```

## Features

- **FifoPromise**: Method decorator that queues calls to an async method and runs them one at a time, first in first out, with optional delay, shared queues and timeout

## Usage

```typescript
import { FifoPromise } from '@telperion/ts-utils/fifo-promise';

class Api {
  @FifoPromise({ delay: 100, timeout: 5000 })
  async save(data: Data) {
    await fetch('/save', { method: 'POST', body: JSON.stringify(data) });
  }
}

const api = new Api();

api.save(a);
api.save(b); // starts 100ms after the first save settles
```

Pass the same `group` object to several decorated methods to serialize them through one queue. A call that runs longer than `timeout` is rejected with a `TimeoutError`.

## Development

```bash
nx build ts-utils   # build the library
nx test ts-utils    # run the unit tests
```

## License

MIT
