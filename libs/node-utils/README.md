# @telperion/node-utils
Utility functions for Node.js development

[![npm](https://img.shields.io/npm/v/@telperion/node-utils.svg)](https://www.npmjs.com/package/@telperion/node-utils)
[![npm](https://img.shields.io/npm/dm/@telperion/node-utils.svg)](https://www.npmjs.com/package/@telperion/node-utils)
[![codecov](https://codecov.io/gh/telperiontech/telperion/graph/badge.svg?token=dz46LY3onk&flag=node-utils)](https://app.codecov.io/gh/telperiontech/telperion/tree/main?flags%5B0%5D=node-utils)
[![npm](https://img.shields.io/npm/l/@telperion/node-utils.svg)](https://github.com/telperiontech/telperion/blob/main/LICENSE)

> Formerly published as `@thalesrc/node-utils`. Replace the dependency and imports: the API is the same.

## Installation
* npm: `npm install @telperion/node-utils --save`
* yarn: `yarn add @telperion/node-utils`
* pnpm: `pnpm i -S @telperion/node-utils`

## Entry points

| Import path | Contents | Extra requirements |
| --- | --- | --- |
| `@telperion/node-utils` | `ensureDirectory`, `AesGcmCipher`, `sha256`, `randomToken`, `pkceChallenge`, `safeEqual` | |
| `@telperion/node-utils/ensure-directory` | `ensureDirectory` | |
| `@telperion/node-utils/crypto` | `AesGcmCipher`, `sha256`, `randomToken`, `pkceChallenge`, `safeEqual` | |
| `@telperion/node-utils/testing/typeorm` | `MemoryRepository` | `typeorm` 0.3 or 1.x (optional peer dependency) |

The root entry point does not include `testing/typeorm`, so projects without TypeORM are not affected.

## File System

### Ensure Directory
Creates a directory (and its parents) unless it exists

```typescript
import { ensureDirectory } from '@telperion/node-utils';

await ensureDirectory('dist/assets/icons');
```

Also available on the command line:

```bash
npx nu ensure-dir dist/assets/icons
```

## Crypto

### AES-GCM Cipher
Encrypts strings with AES-256-GCM, e.g. secrets stored at rest (refresh tokens, API keys), so a database dump alone does not reveal them.

Output format: `v1.<iv>.<tag>.<ciphertext>`, each part base64url (12-byte random IV, 16-byte auth tag). The format is stable: values encrypted by any version decrypt with later versions.

```typescript
import { AesGcmCipher } from '@telperion/node-utils/crypto';

// Key: 32 bytes as base64url, e.g. from `AesGcmCipher.generateKey().toString('base64url')`
const cipher = new AesGcmCipher(AesGcmCipher.keyFromBase64Url(process.env.TOKEN_ENCRYPTION_KEY!));

const stored = cipher.encrypt(refreshToken);
const token = cipher.decrypt(stored);
```

**Key rotation**: pass several keys. `encrypt` uses the first one, `decrypt` tries each in order, so values encrypted with the old key keep working.

```typescript
const cipher = new AesGcmCipher([newKey, oldKey]);
```

**Associated data**: bind a value to context, such as the row it belongs to, without storing that context in the value. Decrypting needs the same associated data, so a value copied to another row fails to decrypt.

```typescript
const stored = cipher.encrypt(refreshToken, user.id);

cipher.decrypt(stored, user.id);
```

**Errors**: `decrypt` throws `AesGcmCipher.DecryptionError` when it can't return the plain text. Its `reason` is `'format'` (not a `v1.` value) or `'authentication'` (wrong key, other associated data, or altered). Invalid keys throw a `RangeError`.

```typescript
try {
  cipher.decrypt(value);
} catch (error) {
  if (error instanceof AesGcmCipher.DecryptionError && error.reason === 'authentication') {
    // wrong key or tampered value
  }
}
```

### SHA-256
Hashes text (as UTF-8) or bytes with SHA-256. Returns the 32-byte `Buffer`, or a string when you pass an encoding: `'hex'`, `'base64'` or `'base64url'` (no padding).

Typical use: store only the hash of an opaque token (refresh token, session id, authorization code) and look tokens up by hashing what the client sends. This is for high-entropy tokens, not passwords: hash passwords with a slow function such as scrypt or argon2.

```typescript
import { sha256 } from '@telperion/node-utils/crypto';

sha256('abc'); // <Buffer ba 78 16 bf ...> (32 bytes)
sha256('abc', 'hex'); // 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

await tokens.save({ hash: sha256(refreshToken, 'hex'), userId });
await tokens.findOneBy({ hash: sha256(presentedToken, 'hex') });
```

### Random Token
Creates an unguessable token from cryptographically secure random bytes, as base64url without padding. Use it for refresh tokens, session cookies, authorization codes, OAuth/OIDC `state` and `nonce`, and PKCE code verifiers.

The default of 32 bytes gives 256 bits of entropy (43 characters). The byte count must be a positive integer, otherwise it throws a `RangeError`.

```typescript
import { randomToken } from '@telperion/node-utils/crypto';

randomToken(); // 32 bytes, 43 characters
randomToken(48); // 48 bytes, 64 characters
```

### PKCE Challenge
Derives the PKCE `S256` code challenge from a code verifier (RFC 7636): the base64url SHA-256 of the verifier. The verifier must be 43 to 128 characters from `A-Z a-z 0-9 - . _ ~`, which `randomToken(32)` to `randomToken(96)` produce; `pkceChallenge` does not validate it.

```typescript
import { pkceChallenge, randomToken, safeEqual } from '@telperion/node-utils/crypto';

// Client
const verifier = randomToken();
const challenge = pkceChallenge(verifier); // send with code_challenge_method=S256

// Authorization server, on the token request
const valid = safeEqual(pkceChallenge(body.code_verifier), code.challenge);
```

### Safe Equal
Compares two secrets (strings as UTF-8, or bytes) in constant time without revealing their lengths. Both values are hashed with SHA-256 first and the digests are compared with `timingSafeEqual`, so a length mismatch doesn't return early. Use it for client secrets, PKCE checks, API keys and signatures.

```typescript
import { safeEqual } from '@telperion/node-utils/crypto';

if (!safeEqual(presentedSecret, client.clientSecret)) {
  throw new UnauthorizedException();
}
```

## Testing

### TypeORM Memory Repository
Just enough of a TypeORM `Repository` for unit tests, keeping rows in an array. Requires `typeorm` (0.3 or 1.x) in your project.

```typescript
import { IsNull, MoreThan } from 'typeorm';
import { MemoryRepository } from '@telperion/node-utils/testing/typeorm';

const users = new MemoryRepository<User>({
  name: 'User', // used in EntityNotFoundError messages
  createDateColumn: 'createdAt', // filled on insert, like @CreateDateColumn()
  updateDateColumn: 'updatedAt', // set on save and update, like @UpdateDateColumn()
});
const service = new UserService(users.asRepository());

await users.save([
  users.create({ email: 'a@example.com', age: 30, deletedAt: null }),
  users.create({ email: 'b@example.com', age: 20, deletedAt: new Date() }),
]);

await users.findBy({ deletedAt: IsNull(), age: MoreThan(25) });
expect(users.rows).toHaveLength(2);
```

Options: `primaryKey` (default `'id'`), `generateId` (default `randomUUID`), `name`, `createDateColumn`, `updateDateColumn` (no date columns are set unless configured).

Methods: `create`, `save` (one entity or an array), `find`, `findBy`, `findOne`, `findOneBy`, `findOneOrFail`, `findOneByOrFail` (throw TypeORM's `EntityNotFoundError`), `findAndCount`, `count`, `countBy`, `exists`, `existsBy`, `update`, `delete` (criteria may be `where` conditions or primary key values), `remove`, `clear`.

Queries:
- `where` as an object, or an array of objects (OR)
- operators: `IsNull`, `Not`, `Equal`, `In`, `Any`, `LessThan`, `LessThanOrEqual`, `MoreThan`, `MoreThanOrEqual`, `Between`, `Like`, `ILike`, `And`, `Or`
- `Like` is case-sensitive (as in PostgreSQL), `ILike` is not; comparisons with `NULL` columns are false, as in SQL
- `order` with several keys, `ASC`/`DESC`/`1`/`-1` and `{ direction, nulls }` (nulls last ascending, first descending by default)
- `skip` and `take`

Anything else throws `MemoryRepository.UnsupportedQueryError` with a clear message: `Raw()`, array and JSON operators, relations in `where` or `order`, and `null`/`undefined` as a condition value (use `IsNull()`, as TypeORM 1.x requires by default). `update` and `delete` reject empty criteria, like TypeORM.

Rows are the entity objects themselves: `save` stores and fills in the object it receives (as TypeORM does), and finds return the stored objects.

## License

[MIT](./LICENSE)
