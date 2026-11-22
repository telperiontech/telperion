#!/bin/bash
# Prints an frp TOML config with secret values masked.
#
#   mask-config.sh [FILE]      (reads stdin without FILE)
#
# Only the printed copy is altered; the file is never modified. Masked:
#   - the value of any key whose last dotted segment contains token, password,
#     passwd, secret or key (case-insensitive): top-level and table keys,
#     dotted keys (metadatas.token), keys inside inline tables, multi-line
#     arrays and multi-line strings, and commented-out lines;
#   - the key in an frp-gate plugin path: "/frps/<key>" -> "/frps/***".
# Values made only of {{ .Envs.NAME }} placeholders stay readable: they hold
# no secret themselves.
#
# Written for BusyBox awk (the image's awk): no gawk extensions.
set -e

awk '
function is_secret_key(key,   k, n, parts) {
    k = tolower(key)
    gsub(/["\047 \t]/, "", k)
    n = split(k, parts, ".")
    return (n > 0 && parts[n] ~ /token|password|passwd|secret|key/)
}

# A TOML key: bare or quoted segments joined by dots ("A comment = x" is not one).
function valid_key(key,   seg) {
    seg = "([A-Za-z0-9_-]+|\"[^\"]*\"|\047[^\047]*\047)"
    return (trim(key) ~ ("^" seg "([ \t]*\\.[ \t]*" seg ")*$"))
}

function trim(s) {
    sub(/^[ \t]+/, "", s)
    sub(/[ \t]+$/, "", s)
    return s
}

# A quoted string that consists only of {{ ... }} placeholders.
function only_placeholders(v,   s) {
    v = trim(v)
    if (v !~ /\{\{/) return 0
    if (v ~ /^".*"$/ || v ~ /^\047.*\047$/) s = substr(v, 2, length(v) - 2)
    else return 0
    gsub(/\{\{[^}]*\}\}/, "", s)
    return (s ~ /^[ \t]*$/)
}

# Replaces the key part of "/frps/<key>" plugin paths unless it is a placeholder.
function mask_plugin_path(line,   out, rest, seg, key) {
    out = ""
    rest = line
    while (match(rest, /\/frps\/[^"\047]*/)) {
        seg = substr(rest, RSTART, RLENGTH)
        key = substr(seg, 7)
        out = out substr(rest, 1, RSTART - 1)
        if (key != "" && !only_placeholders("\"" key "\"")) seg = "/frps/***"
        out = out seg
        rest = substr(rest, RSTART + RLENGTH)
    }
    return out rest
}

# Scans from position i of line (a value start) to the end of that value.
# Sets VAL_END (index of the first character after the value), and
# SKIP_DEPTH / SKIP_TRIPLE when the value continues on the next lines.
function value_end(line, i,   n, c, q, depth, t) {
    n = length(line)
    q = ""
    depth = 0
    t = substr(line, i, 3)
    if (t == "\"\"\"" || t == "\047\047\047") {
        if (index(substr(line, i + 3), t) == 0) {
            SKIP_TRIPLE = t
            VAL_END = n + 1
            return
        }
    }
    for (; i <= n; i++) {
        c = substr(line, i, 1)
        if (q != "") {
            if (q == "\"" && c == "\\") { i++; continue }
            if (c == q) q = ""
            continue
        }
        if (c == "\"" || c == "\047") { q = c; continue }
        if (c == "[" || c == "{") { depth++; continue }
        if (c == "]" || c == "}") {
            if (depth == 0) break
            depth--
            continue
        }
        if (depth == 0 && (c == "," || c == "#")) break
    }
    if (depth > 0) SKIP_DEPTH = depth
    VAL_END = i
}

# Tracks brackets on a swallowed continuation line of a masked value.
function skip_line(line,   n, i, c, q) {
    if (SKIP_TRIPLE != "") {
        if (index(line, SKIP_TRIPLE) > 0) SKIP_TRIPLE = ""
        return
    }
    n = length(line)
    q = ""
    for (i = 1; i <= n && SKIP_DEPTH > 0; i++) {
        c = substr(line, i, 1)
        if (q != "") {
            if (q == "\"" && c == "\\") { i++; continue }
            if (c == q) q = ""
            continue
        }
        if (c == "\"" || c == "\047") q = c
        else if (c == "#") break
        else if (c == "[" || c == "{") SKIP_DEPTH++
        else if (c == "]" || c == "}") SKIP_DEPTH--
    }
}

# Masks secret values on one line. Keys are recognised at the start of the
# line, after "{" and after "," inside an inline table.
function mask_line(line,   out, n, i, c, q, stack, expect_key, j, cj, kq, key, val) {
    out = ""
    n = length(line)
    q = ""
    stack = ""
    expect_key = 1
    for (i = 1; i <= n; i++) {
        c = substr(line, i, 1)
        if (q != "") {
            out = out c
            if (q == "\"" && c == "\\" && i < n) { i++; out = out substr(line, i, 1); continue }
            if (c == q) q = ""
            continue
        }
        if (expect_key && c != " " && c != "\t") {
            expect_key = 0
            # Look for "key =" from here; keys hold no brackets, commas or #.
            kq = ""
            for (j = i; j <= n; j++) {
                cj = substr(line, j, 1)
                if (kq != "") { if (cj == kq) kq = ""; continue }
                if (cj == "\"" || cj == "\047") { kq = cj; continue }
                if (cj == "=" || cj ~ /[][{},#]/) break
            }
            if (j <= n && substr(line, j, 1) == "=" && valid_key(substr(line, i, j - i))) {
                key = substr(line, i, j - i)
                out = out key "="
                i = j + 1
                while (i <= n && substr(line, i, 1) ~ /[ \t]/) { out = out substr(line, i, 1); i++ }
                if (is_secret_key(key)) {
                    value_end(line, i)
                    val = substr(line, i, VAL_END - i)
                    if (SKIP_DEPTH == 0 && SKIP_TRIPLE == "" && only_placeholders(val)) {
                        out = out val
                    } else {
                        out = out "\"***\""
                        if (match(val, /[ \t]+$/)) out = out substr(val, RSTART)
                    }
                    if (SKIP_DEPTH > 0 || SKIP_TRIPLE != "") return out
                    i = VAL_END - 1
                    continue
                }
                i--
                continue
            }
        }
        if (c == "\"" || c == "\047") { q = c; out = out c; continue }
        if (c == "#") return out substr(line, i)
        out = out c
        if (c == "{") { stack = stack "{"; expect_key = 1 }
        else if (c == "[") stack = stack "["
        else if (c == "]" || c == "}") stack = substr(stack, 1, length(stack) - 1)
        else if (c == "," && substr(stack, length(stack)) == "{") expect_key = 1
    }
    return out
}

BEGIN { SKIP_DEPTH = 0; SKIP_TRIPLE = "" }

{
    sub(/\r$/, "")
    if (SKIP_DEPTH > 0 || SKIP_TRIPLE != "") { skip_line($0); next }
    line = $0
    prefix = ""
    # Commented-out lines are masked too ("# token = ..." would still leak).
    if (match(line, /^[ \t]*#+[ \t]*/)) {
        prefix = substr(line, 1, RLENGTH)
        line = substr(line, RLENGTH + 1)
    }
    masked = mask_line(line)
    if (prefix != "") { SKIP_DEPTH = 0; SKIP_TRIPLE = "" }
    print mask_plugin_path(prefix masked)
}
' "$@"
