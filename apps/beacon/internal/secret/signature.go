package secret

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
)

// Sign is a webhook signature header value, GitHub's scheme:
// "sha256=" + hex(HMAC-SHA256(key, body)).
func Sign(key, body []byte) string {
	m := hmac.New(sha256.New, key)
	m.Write(body)
	return "sha256=" + hex.EncodeToString(m.Sum(nil))
}

// Verify checks a signature header value in constant time.
func Verify(key, body []byte, header string) bool {
	return len(key) > 0 && hmac.Equal([]byte(Sign(key, body)), []byte(header))
}

// TokenEqual compares a presented bearer token with the expected one in
// constant time (through their SHA-256, so lengths do not leak).
func TokenEqual(presented, expected string) bool {
	a, b := sha256.Sum256([]byte(presented)), sha256.Sum256([]byte(expected))
	return expected != "" && subtle.ConstantTimeCompare(a[:], b[:]) == 1
}
