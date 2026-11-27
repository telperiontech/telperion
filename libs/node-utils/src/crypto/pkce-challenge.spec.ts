import { pkceChallenge } from './pkce-challenge';
import { randomToken } from './random-token';

describe('pkceChallenge', () => {
  it('matches the S256 example of RFC 7636 (Appendix B)', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('returns 43 base64url characters without padding', () => {
    expect(pkceChallenge(randomToken())).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
