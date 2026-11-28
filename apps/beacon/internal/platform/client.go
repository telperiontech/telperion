// Package platform is the HTTP client every adapter uses: conditional requests
// (ETag / If-None-Match, so unchanged answers cost little and GitHub does not
// count them), a rate-limit budget per host read from X-RateLimit-* headers,
// bounded bodies, and errors that never contain credentials.
package platform

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// ErrNotModified: a conditional request found nothing new since the last
// successful one. The poll succeeded and has no observations.
var ErrNotModified = errors.New("not modified")

// StatusError is a non-2xx answer.
type StatusError struct {
	Code   int
	URL    string      // without query
	Body   string      // the start of the body, for the log
	Header http.Header // e.g. WWW-Authenticate of a 401
}

func (e *StatusError) Error() string {
	return fmt.Sprintf("GET %s: %d %s", e.URL, e.Code, strings.TrimSpace(e.Body))
}

// IsStatus reports whether err is a StatusError with one of the codes.
func IsStatus(err error, codes ...int) bool {
	var se *StatusError
	if !errors.As(err, &se) {
		return false
	}
	for _, c := range codes {
		if se.Code == c {
			return true
		}
	}
	return false
}

// maxBody caps a response that is read whole; streamed bodies (npm
// packuments) are decoded as they arrive.
const maxBody = 64 << 20

// Client is safe for concurrent use.
type Client struct {
	HTTP      *http.Client
	UserAgent string

	mu      sync.Mutex
	etags   map[string]string // URL → ETag of the last successful answer
	budgets map[string]*Budget
}

// New returns a client with a timeout per request.
func New(userAgent string, timeout time.Duration) *Client {
	return &Client{
		HTTP:      &http.Client{Timeout: timeout},
		UserAgent: userAgent,
		etags:     map[string]string{},
		budgets:   map[string]*Budget{},
	}
}

// Request is one GET (or other method) through the client.
type Request struct {
	Method      string // default GET
	URL         string
	Header      http.Header
	Body        io.Reader
	Conditional bool // send If-None-Match with the last ETag; 304 → ErrNotModified
	// ETagKey scopes the remembered ETag (default: the URL). Callers that share
	// a URL but read different things from it (two packages, one workflow) use
	// their own key, or the second would see "not modified" without ever
	// having read the answer.
	ETagKey string
}

func (r Request) etagKey() string {
	if r.ETagKey != "" {
		return r.ETagKey
	}
	return r.URL
}

// Do sends r and hands a 2xx body to read. The ETag is remembered only when
// read succeeds, so a failed parse is retried in full next time.
func (c *Client) Do(ctx context.Context, r Request, read func(resp *http.Response) error) error {
	method := r.Method
	if method == "" {
		method = http.MethodGet
	}
	req, err := http.NewRequestWithContext(ctx, method, r.URL, r.Body)
	if err != nil {
		return err
	}
	for k, vs := range r.Header {
		req.Header[k] = vs
	}
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", c.UserAgent)
	}
	etag := ""
	if r.Conditional {
		etag = c.etag(r.etagKey())
		if etag != "" {
			req.Header.Set("If-None-Match", etag)
		}
	}
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return redact(err)
	}
	defer resp.Body.Close()
	c.Budget(req.URL.Host).update(resp.Header)

	switch {
	case resp.StatusCode == http.StatusNotModified && etag != "":
		return ErrNotModified
	case resp.StatusCode < 200 || resp.StatusCode > 299:
		snippet, _ := io.ReadAll(io.LimitReader(resp.Body, 300))
		return &StatusError{Code: resp.StatusCode, URL: stripQuery(r.URL), Body: string(snippet), Header: resp.Header}
	}
	resp.Body = struct {
		io.Reader
		io.Closer
	}{io.LimitReader(resp.Body, maxBody), resp.Body}
	if err := read(resp); err != nil {
		return fmt.Errorf("%s: %w", stripQuery(r.URL), err)
	}
	if r.Conditional {
		c.setETag(r.etagKey(), resp.Header.Get("ETag"))
	}
	return nil
}

// JSON sends r and decodes a 2xx JSON body into out.
func (c *Client) JSON(ctx context.Context, r Request, out any) error {
	if r.Header == nil {
		r.Header = http.Header{}
	}
	if r.Header.Get("Accept") == "" {
		r.Header.Set("Accept", "application/json")
	}
	return c.Do(ctx, r, func(resp *http.Response) error { return json.NewDecoder(resp.Body).Decode(out) })
}

// Budget returns the rate-limit budget of a host.
func (c *Client) Budget(host string) *Budget {
	c.mu.Lock()
	defer c.mu.Unlock()
	b := c.budgets[host]
	if b == nil {
		b = &Budget{}
		c.budgets[host] = b
	}
	return b
}

func (c *Client) etag(u string) string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.etags[u]
}

func (c *Client) setETag(u, etag string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if etag == "" {
		delete(c.etags, u)
		return
	}
	c.etags[u] = etag
}

func stripQuery(u string) string {
	if p, err := url.Parse(u); err == nil {
		p.RawQuery, p.User = "", nil
		return p.String()
	}
	return "(unparsable URL)"
}

// redact drops the URL (which may carry a query) from a transport error.
func redact(err error) error {
	var ue *url.Error
	if errors.As(err, &ue) {
		return fmt.Errorf("%s %s: %w", ue.Op, stripQuery(ue.URL), ue.Err)
	}
	return err
}
