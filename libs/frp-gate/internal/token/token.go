// Package token creates random secrets and the hashes stored in place of them.
package token

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/hex"
	"strings"
)

// Prefixes make a leaked secret easy to recognise and tell apart.
const (
	ClientPrefix   = "fg_"
	InstancePrefix = "fgi_"
)

var encoding = base32.StdEncoding.WithPadding(base32.NoPadding)

// New returns prefix + 32 random bytes in lowercase base32 (52 characters).
func New(prefix string) string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("token: crypto/rand failed: " + err.Error())
	}
	return prefix + strings.ToLower(encoding.EncodeToString(b))
}

// Hash returns the hex SHA-256 of a secret. Secrets are 256-bit random values,
// so a fast hash is enough: there is nothing to brute-force.
func Hash(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

// Equal compares a secret against a stored hash in constant time.
func Equal(secret, hash string) bool {
	return subtle.ConstantTimeCompare([]byte(Hash(secret)), []byte(hash)) == 1
}
