package token

import (
	"strings"
	"testing"
)

func TestNewIsPrefixedAndUnique(t *testing.T) {
	a, b := New(ClientPrefix), New(ClientPrefix)
	if !strings.HasPrefix(a, ClientPrefix) || len(a) != len(ClientPrefix)+52 {
		t.Fatalf("unexpected token %q", a)
	}
	if a == b {
		t.Fatal("two tokens are equal")
	}
}

func TestEqual(t *testing.T) {
	s := New(ClientPrefix)
	if !Equal(s, Hash(s)) {
		t.Fatal("token does not match its own hash")
	}
	if Equal(s+"x", Hash(s)) || Equal("", Hash(s)) {
		t.Fatal("wrong token matched")
	}
}
