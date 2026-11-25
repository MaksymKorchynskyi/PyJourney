# Regex Flags

Flags change *how* the regex engine interprets a pattern without changing the pattern itself: ignore letter case, let `^` and `$` work on every line, let `.` match newlines, allow comments inside the pattern, and more. Every function in the `re` module (`search`, `match`, `fullmatch`, `findall`, `finditer`, `sub`, `subn`, `split`, `compile`) accepts them.

## What you'll learn

- What regex flags are and how to pass and combine them
- The full list of flags with their short names and inline forms
- How `IGNORECASE`, `MULTILINE`, `DOTALL`, `VERBOSE` and `ASCII` change matching
- What `LOCALE`, `UNICODE`, `DEBUG` and `NOFLAG` are for
- How to write flags inside the pattern, globally `(?i)` or for one part `(?i:...)`
- The classic bug of passing flags positionally to `sub()` and `split()`

## What a flag is

Since Python 3.6, flags are members of the `re.RegexFlag` enumeration, which is an `IntFlag`. Each flag is a power of two, so several flags can be combined into one value with the bitwise OR operator `|`:

```python
import re

print(re.IGNORECASE, int(re.IGNORECASE))
print(re.IGNORECASE | re.MULTILINE)
print(type(re.IGNORECASE | re.MULTILINE))
```

Output:

```text
re.IGNORECASE 2
re.IGNORECASE|re.MULTILINE
<flag 'RegexFlag'>
```

There are three ways to apply flags:

1. Pass them to a function: `re.findall(pattern, s, flags=re.IGNORECASE)`.
2. Pass them once to `re.compile(pattern, flags)`. Every method of the compiled pattern then uses them.
3. Write them **inside** the pattern as inline flags: `r"(?i)pattern"`.

## All flags at a glance

| Flag | Short | Inline | Meaning |
|---|---|---|---|
| `re.IGNORECASE` | `re.I` | `(?i)` | Case-insensitive matching: `[a-z]` also matches upper-case letters. |
| `re.MULTILINE` | `re.M` | `(?m)` | `^` and `$` also match at the start and end of every line, not only of the whole string. |
| `re.DOTALL` | `re.S` | `(?s)` | `.` matches any character **including** a newline. |
| `re.VERBOSE` | `re.X` | `(?x)` | Whitespace in the pattern is ignored and `#` starts a comment, so a pattern can be laid out and documented. |
| `re.ASCII` | `re.A` | `(?a)` | `\w`, `\W`, `\b`, `\B`, `\d`, `\D`, `\s`, `\S` match ASCII characters only. Only meaningful for `str` patterns. |
| `re.UNICODE` | `re.U` | `(?u)` | Unicode matching. This is already the default for `str` patterns, so the flag is redundant and kept for compatibility. |
| `re.LOCALE` | `re.L` | `(?L)` | `\w`, `\W`, `\b`, `\B` and case-insensitive matching depend on the current locale. Only for `bytes` patterns, incompatible with `re.ASCII`, and discouraged. |
| `re.DEBUG` | none | none | Prints debug information about the compiled pattern. |
| `re.NOFLAG` | none | none | The value `0`, meaning "no flags" (Python 3.11+). |

## `re.IGNORECASE`

Without the flag, `[a-z]+` matches only lower-case letters, so `P` is skipped:

```python
import re

s = "Python is awesome"

print(re.findall(r"[a-z]+", s))
print(re.findall(r"[a-z]+", s, flags=re.IGNORECASE))
```

Output:

```text
['ython', 'is', 'awesome']
['Python', 'is', 'awesome']
```

With `re.IGNORECASE`, `[a-z]` matches `A`-`Z` as well. Case folding works for non-Latin alphabets too:

```python
import re

print(re.findall(r"київ", "Київ КИЇВ київ", flags=re.IGNORECASE))
```

Output:

```text
['Київ', 'КИЇВ', 'київ']
```

## `re.MULTILINE`

By default, `^` matches only at the start of the whole string and `$` only at its end (or just before a final newline). With `re.MULTILINE`, they match at the start and end of **every line**:

```python
import re

s = """Regex
Flags"""

print(re.findall(r"^\w+", s))
print(re.findall(r"^\w+", s, flags=re.MULTILINE))
```

Output:

```text
['Regex']
['Regex', 'Flags']
```

The same applies to `$`:

```python
import re

s = "one\ntwo\nthree"

print(re.findall(r"\w+$", s))
print(re.findall(r"\w+$", s, flags=re.MULTILINE))
```

Output:

```text
['three']
['one', 'two', 'three']
```

`\A` and `\Z` are **not** affected. They always mean the start and the very end of the whole string, which is useful when you need both kinds of anchors in one pattern.

## `re.DOTALL`

By default, `.` matches any character except a newline `\n`. So `.+` stops at the end of each line:

```python
import re

s = """Regex
Flags"""

print(re.findall(r".+", s))
print(re.findall(r".+", s, flags=re.DOTALL))
```

Output:

```text
['Regex', 'Flags']
['Regex\nFlags']
```

With `re.DOTALL`, the dot crosses line breaks, and `.+` matches the whole text. This is exactly what you need to extract a block that spans several lines:

```python
import re

text = "header\nBEGIN\nline 1\nline 2\nEND\nfooter"

print(re.findall(r"BEGIN\n(.*?)\nEND", text))
print(re.findall(r"BEGIN\n(.*?)\nEND", text, flags=re.DOTALL))
```

Output:

```text
[]
['line 1\nline 2']
```

> **Tip:** `MULTILINE` and `DOTALL` are easy to mix up. `MULTILINE` changes the anchors `^` and `$`. `DOTALL` changes the dot `.`. They are independent and often used together.

## `re.VERBOSE`

Long patterns quickly become unreadable. `re.VERBOSE` lets you spread a pattern over several lines and add comments:

```python
import re

s = "Python 3"

pattern = r"""
    ^(\w+)   # one or more word characters at the start of the string
    \s*      # zero or more whitespace characters
    (\d+)$   # one or more digits at the end of the string
"""

print(re.findall(pattern, s, flags=re.VERBOSE))
```

Output:

```text
[('Python', '3')]
```

The rules in verbose mode:

- Whitespace in the pattern is ignored, **except** inside a character class `[...]` or when escaped with a backslash.
- `#` starts a comment that runs to the end of the line, except inside a character class or when escaped as `\#`.

Those rules are also its main trap. A literal space or `#` must be written explicitly:

```python
import re

s = "a b #12"

print(re.findall(r"a b", s, flags=re.VERBOSE))
print(re.findall(r"a\ b", s, flags=re.VERBOSE))
print(re.findall(r"a[ ]b", s, flags=re.VERBOSE))
print(re.findall(r"\#\d+", s, flags=re.VERBOSE))
```

Output:

```text
[]
['a b']
['a b']
['#12']
```

In the first call the space disappears, so the pattern becomes `ab`, which does not occur in the string. A real-world example with a phone number:

```python
import re

phone = re.compile(
    r"""
    \(? (\d{3}) \)?   # area code, optionally in parentheses
    [\s.-]?           # optional separator
    (\d{3})           # first three digits
    [\s.-]?           # optional separator
    (\d{4})           # last four digits
    """,
    re.VERBOSE,
)

for s in ["(212) 456-7890", "212.456.7890", "2124567890"]:
    print(phone.fullmatch(s).groups())
```

Output:

```text
('212', '456', '7890')
('212', '456', '7890')
('212', '456', '7890')
```

## `re.ASCII`

In Python 3, `str` patterns are Unicode-aware: `\w` matches letters of any alphabet, and `\d` matches digits of any script. `re.ASCII` restricts `\w`, `\W`, `\b`, `\B`, `\d`, `\D`, `\s` and `\S` to ASCII characters. The pattern below looks for two-character words:

```python
import re

s = "作法 is Pythonic in Japanese"

print(re.findall(r"\b\w{2}\b", s))
print(re.findall(r"\b\w{2}\b", s, flags=re.ASCII))
```

Output:

```text
['作法', 'is', 'in']
['is', 'in']
```

With `re.ASCII`, the Japanese word is no longer made of "word characters", so it is excluded. The flag matters for digits too: by default `\d` also matches, for example, Arabic-Indic digits, which `int()` accepts but a strict ID field might not:

```python
import re

s = "Total: ٣٤ and 34"

print(re.findall(r"\d+", s))
print(re.findall(r"\d+", s, flags=re.ASCII))
```

Output:

```text
['٣٤', '34']
['34']
```

> **Note:** `re.ASCII` is only meaningful for `str` patterns. `bytes` patterns are ASCII-only anyway, so the flag changes nothing there.

## `re.LOCALE` and `re.UNICODE`

`re.LOCALE` makes `\w`, `\b` and case-insensitive matching depend on the current locale. It works only with `bytes` patterns, cannot be combined with `re.ASCII`, and is discouraged because locales are unreliable. With a `str` pattern it raises an error:

```python
import re

try:
    re.compile(r"\w+", re.LOCALE)
except ValueError as e:
    print("ValueError:", e)
```

Output:

```text
ValueError: cannot use LOCALE flag with a str pattern
```

`re.UNICODE` (`re.U`) requests Unicode matching, which is already the default for `str` patterns. You will see it in old code and inside the `flags` value of compiled patterns, but you never need to pass it.

## `re.DEBUG`

`re.DEBUG` prints how the engine parsed and compiled the pattern. It is a tool for curious minds and for debugging very complex patterns:

```python
import re

re.compile(r"\d+", re.DEBUG)
```

Output (the exact format may differ between Python versions):

```text
MAX_REPEAT 1 MAXREPEAT
  IN
    CATEGORY CATEGORY_DIGIT

 0. INFO 4 0b0 1 MAXREPEAT (to 5)
 5: REPEAT_ONE 9 1 MAXREPEAT (to 15)
 9.   IN 4 (to 14)
11.     CATEGORY UNI_DIGIT
13.     FAILURE
14:   SUCCESS
15: SUCCESS
```

The first part is the parse tree: "repeat at least once, a character from the digit category". The second part is the compiled bytecode the engine runs.

## Combining flags

Use `|` to combine flags. The order does not matter:

```python
import re

log = """Error: disk full
ok: backup done
ERROR: network down"""

print(re.findall(r"^error.*$", log, flags=re.IGNORECASE | re.MULTILINE))
```

Output:

```text
['Error: disk full', 'ERROR: network down']
```

Do not use `+`. It happens to work for different flags, but adding the same flag twice produces a different flag altogether: `re.I + re.I` is `4`, which is `re.LOCALE`:

```python
import re

print(re.I | re.I)
print(re.I + re.I)
```

Output:

```text
re.IGNORECASE
4
```

`re.NOFLAG` (Python 3.11+) is a readable starting value when flags are built conditionally:

```python
import re


def find_word(word, text, ignore_case=False):
    flags = re.NOFLAG
    if ignore_case:
        flags |= re.IGNORECASE
    return re.findall(rf"\b{re.escape(word)}\b", text, flags=flags)


print(find_word("python", "Python and python"))
print(find_word("python", "Python and python", ignore_case=True))
```

Output:

```text
['python']
['Python', 'python']
```

## Inline flags

Flags can also be written inside the pattern. This is handy when the pattern is stored in a config file or passed to a function that does not accept flags.

**Global inline flags** apply to the whole pattern and must be at the very beginning. Several letters can be combined: `(?im)`.

```python
import re

log = "Error: a\nok\nERROR: b"
print(re.findall(r"(?im)^error.*$", log))
```

Output:

```text
['Error: a', 'ERROR: b']
```

Since Python 3.11, a global inline flag anywhere other than the start is an error:

```python
import re

try:
    re.compile(r"abc(?i)")
except re.error as e:
    print(type(e).__name__, "-", e)
```

Output:

```text
PatternError - global flags not at the start of the expression at position 3
```

**Scoped inline flags** (Python 3.6+) apply to one part of the pattern only. `(?i:...)` turns a flag on for the group, and `(?-i:...)` turns it off:

```python
import re

print(re.findall(r"(?i:error) ID-\d+", "ERROR ID-1 error id-2 Error ID-3"))
print(re.findall(r"(?i)hello (?-i:World)", "HELLO World hello world"))
```

Output:

```text
['ERROR ID-1', 'Error ID-3']
['HELLO World']
```

In the first pattern, only the word "error" ignores case, while `ID` must be upper-case. In the second, everything ignores case except `World`.

## Flags and compiled patterns

The flags are stored in the compiled pattern. Its `flags` attribute shows them, including the implicit `re.UNICODE` (value `32`) that every `str` pattern has:

```python
import re

p = re.compile(r"x", re.IGNORECASE)
print(p)
print(p.flags, re.RegexFlag(p.flags))
```

Output:

```text
re.compile('x', re.IGNORECASE)
34 re.IGNORECASE|re.UNICODE
```

You cannot add flags to an already compiled pattern:

```python
import re

p = re.compile(r"x")
try:
    re.search(p, "X", flags=re.IGNORECASE)
except ValueError as e:
    print("ValueError:", e)
```

Output:

```text
ValueError: cannot process flags argument with a compiled pattern
```

## Common mistakes

- **Passing flags positionally to `sub()`, `subn()` or `split()`.** Their fourth parameter is `count`/`maxsplit`, not `flags`. `re.sub(p, r, s, re.I)` means "at most 2 replacements, case-sensitive". Python 3.13+ emits a `DeprecationWarning`. Always write `flags=...`.
- **Combining flags with `+`.** Use `|`. `re.I + re.I` silently becomes `re.LOCALE`.
- **Putting a global inline flag in the middle.** `r"abc(?i)"` is an error since Python 3.11. Move it to the start, or use a scoped flag `(?i:...)`.
- **Forgetting that `VERBOSE` removes spaces.** Write a literal space as `\ ` or `[ ]`, and a literal `#` as `\#`.
- **Mixing up `MULTILINE` and `DOTALL`.** `MULTILINE` is about `^`/`$`, `DOTALL` is about `.`.
- **Thinking `re.ASCII` is for bytes.** It is for `str` patterns. `re.LOCALE` is the one that only works with bytes.

## Summary

- Flags are `re.RegexFlag` members (an `IntFlag`). Combine them with `|`, never with `+`.
- Pass them as `flags=...`, to `re.compile()`, or inline in the pattern.
- `IGNORECASE` ignores letter case. `MULTILINE` makes `^`/`$` work per line. `DOTALL` lets `.` match newlines. `VERBOSE` allows whitespace and comments.
- `ASCII` restricts `\w`, `\d`, `\s` and `\b` to ASCII in `str` patterns. `LOCALE` is bytes-only and discouraged. `UNICODE` is the default.
- `DEBUG` prints the parsed and compiled pattern. `NOFLAG` (3.11+) is the "no flags" value.
- Global inline flags such as `(?im)` must start the pattern. Scoped flags `(?i:...)` and `(?-i:...)` affect only their group.

## Practice

### Exercise 1: Warning lines

From the log below, extract every **whole line** that starts with `warn` or `warning` in any letter case. Use one `findall()` call with two flags. Expected: `['WARN: low memory', 'Warning: disk 91%']`.

```python
log = """INFO: started
WARN: low memory
info: warnings are suppressed
Warning: disk 91%"""
```

### Exercise 2: Multi-line block

Extract the SQL text between `-- begin` and `-- end` (without the marker lines) from the string below, using `re.search()` and the right flag.

```python
script = """-- begin
SELECT name
FROM users
WHERE active = 1;
-- end"""
```

### Exercise 3: A readable date pattern

Rewrite `r"(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])"` with `re.VERBOSE`, one commented line per part. Verify that both versions give the same result for `"Dates: 2024-03-15, 2024-13-01, 2023-12-31"`.

### Exercise 4: Scoped flags

Write one pattern, **without** a `flags` argument, that finds product codes like `sku-123`: the prefix `sku` in any case, followed by `-` and exactly three digits. The digits must be ASCII only, even though the input contains other digits. Test with `"SKU-123, sku-45, Sku-999, sku-١٢٣"`, expecting `['SKU-123', 'Sku-999']`.

## Solutions

### Exercise 1

```python
import re

log = """INFO: started
WARN: low memory
info: warnings are suppressed
Warning: disk 91%"""

print(re.findall(r"^warn(?:ing)?\b.*$", log, flags=re.IGNORECASE | re.MULTILINE))
```

Output:

```text
['WARN: low memory', 'Warning: disk 91%']
```

`MULTILINE` lets `^` and `$` match each line, and `IGNORECASE` accepts any case. Because of `^`, the word "warnings" in the middle of the `info` line does not count. The `\b` after `warn(?:ing)?` would also reject a line that starts with a longer word such as "Warnings" or "Warned".

### Exercise 2

```python
import re

script = """-- begin
SELECT name
FROM users
WHERE active = 1;
-- end"""

m = re.search(r"-- begin\n(.*?)\n-- end", script, flags=re.DOTALL)
print(m[1])
```

Output:

```text
SELECT name
FROM users
WHERE active = 1;
```

Without `re.DOTALL`, `.*?` cannot cross the newlines and `search()` returns `None`.

### Exercise 3

```python
import re

compact = re.compile(r"(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])")

verbose = re.compile(
    r"""
    (\d{4})                  # year: four digits
    -
    (0[1-9]|1[0-2])          # month: 01-12
    -
    (0[1-9]|[12]\d|3[01])    # day: 01-31
    """,
    re.VERBOSE,
)

text = "Dates: 2024-03-15, 2024-13-01, 2023-12-31"
print(compact.findall(text))
print(verbose.findall(text))
print(compact.findall(text) == verbose.findall(text))
```

Output:

```text
[('2024', '03', '15'), ('2023', '12', '31')]
[('2024', '03', '15'), ('2023', '12', '31')]
True
```

`2024-13-01` is rejected by both, because `13` is not a valid month.

### Exercise 4

```python
import re

text = "SKU-123, sku-45, Sku-999, sku-١٢٣"
print(re.findall(r"(?i:sku)-(?a:\d{3})\b", text))
```

Output:

```text
['SKU-123', 'Sku-999']
```

`(?i:sku)` makes only the prefix case-insensitive. `(?a:\d{3})` makes `\d` ASCII-only inside that group, so the Arabic-Indic digits in `sku-١٢٣` do not count. `sku-45` has only two digits.

---

*Source: [pythontutorial.net — Python Regex Flags](https://www.pythontutorial.net/python-regex/python-regex-flags/). Adapted and expanded for PyJourney.*
