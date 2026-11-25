# Lookbehind

A **lookbehind** is the mirror image of a lookahead: it checks what comes *before* the current position without making it part of the match. It lets you say "match `X`, but only if `Y` comes right before it" (or "only if `Y` does **not** come before it"). In Python's `re` module lookbehind has one important restriction: the pattern inside it must have a **fixed width**.

## What you'll learn

- Positive lookbehind `(?<=Y)X` and negative lookbehind `(?<!Y)X`
- Why a negative lookbehind often needs `\b` to avoid partial matches
- Why Python's `re` requires a fixed-width lookbehind and what counts as fixed width
- Workarounds for variable-width cases: several lookbehinds, a capturing group, or the third-party `regex` module
- How to combine lookbehind and lookahead to match text between markers or a position between characters
- How lookbehind behaves with `re.match()` and the `pos` argument

## Positive lookbehind: `(?<=Y)X`

The syntax is:

```text
(?<=Y)X
```

It matches `X` only if `Y` comes immediately before it. Like a lookahead, it is a zero-width assertion: `Y` is checked but not included in the match.

Suppose you want the price `500` from the string below, but not the quantity `1`:

```text
1 phone costs $500
```

The pattern is:

```text
(?<=\$)\d+
```

- `(?<=\$)` succeeds only at a position that has a `$` right before it. The dollar sign is a special character in regex (the end-of-string anchor), so it is escaped as `\$`.
- `\d+` matches one or more digits.

```python
import re

s = "1 phone costs $500"
pattern = r"(?<=\$)\d+"

for match in re.finditer(pattern, s):
    print(match.group())
```

Output:

```text
500
```

The match is `500`, not `$500`. Compare it with a plain pattern, which has to include the dollar sign:

```python
import re

s = "1 phone costs $500"

print(re.findall(r"\$\d+", s))
print(re.findall(r"(?<=\$)\d+", s))
```

Output:

```text
['$500']
['500']
```

A similar everyday example is hashtags without the `#`:

```python
import re

print(re.findall(r"(?<=#)\w+", "Learn #python and #regex with python"))
```

Output:

```text
['python', 'regex']
```

## Negative lookbehind: `(?<!Y)X`

```text
(?<!Y)X
```

This matches `X` only if `Y` does **not** come right before it. To match the numbers that do not have a `$` sign before them:

```python
import re

s = "1 phone costs $500"
pattern = r"\b(?<!\$)\d+\b"

for match in re.finditer(pattern, s):
    print(match.group())
```

Output:

```text
1
```

- `\b` is a word boundary.
- `(?<!\$)` succeeds only where the previous character is not `$`.
- `\d+` matches the digits, and the final `\b` makes sure the number ends at a word boundary.

### Why the `\b` is needed

Without the word boundaries the result is surprising:

```python
import re

s = "1 phone costs $500"
print(re.findall(r"(?<!\$)\d+", s))
```

Output:

```text
['1', '00']
```

At the `5` the lookbehind sees `$` and fails. But the engine simply moves on to the next position, the first `0`. The character before it is `5`, not `$`, so the lookbehind succeeds and `00` is reported. The leading `\b` stops a match from starting in the middle of a number: between `5` and `0` there is no word boundary. This is the same kind of trap as the backtracking problem with negative lookahead. Another fix is to forbid a digit before the match too: `(?<![\d$])\d+`.

## The fixed-width restriction

To check a lookbehind, the engine steps **back** a fixed number of characters from the current position and tries to match the sub-pattern there. For that reason, Python's `re` module only accepts lookbehind patterns whose length is known in advance:

| Allowed (fixed width) | Not allowed (variable width) |
|---|---|
| `(?<=\$)` | `(?<=\$\s*)` |
| `(?<=\d{3})` | `(?<=\d+)` |
| `(?<=USD \|EUR )` (both 4 characters) | `(?<=\$\|USD )` (1 vs 4 characters) |
| `(?<=[A-Z]\.)` | `(?<=\$\s?)` |

Anything with `*`, `+`, `?`, `{m,n}` (with `m` different from `n`) or alternatives of different lengths is rejected when the pattern is compiled:

```python
import re

patterns = [r"(?<=USD |EUR )\d+", r"(?<=\$\s*)\d+", r"(?<=\$|USD )\d+", r"(?<=\d+)x"]

for pattern in patterns:
    try:
        re.compile(pattern)
        print(f"{pattern:20} OK")
    except re.PatternError as error:
        print(f"{pattern:20} {error}")
```

Output:

```text
(?<=USD |EUR )\d+    OK
(?<=\$\s*)\d+        look-behind requires fixed-width pattern
(?<=\$|USD )\d+      look-behind requires fixed-width pattern
(?<=\d+)x            look-behind requires fixed-width pattern
```

`re.PatternError` is the name used since Python 3.13. In older versions catch `re.error`, which still works as an alias.

> **Note:** Lookahead has no such restriction. `(?=\s*feet)` is fine, while `(?<=\$\s*)` is not.

## Working around the restriction

### Several lookbehinds

Alternatives of different lengths are not allowed *inside* one lookbehind, but you can write several lookbehinds and alternate between *them*. Each one has a fixed width on its own:

```python
import re

text = "Total: $40, USD 15, EUR 9"
print(re.findall(r"(?:(?<=\$)|(?<=USD ))\d+", text))
```

Output:

```text
['40', '15']
```

### A capturing group instead of a lookbehind

Often you do not need a lookbehind at all. Match the prefix normally and capture only the part you want:

```python
import re

text = "Total: $40, USD 15, EUR 9, $ 7"
print(re.findall(r"(?:\$|USD)\s*(\d+)", text))
```

Output:

```text
['40', '15', '7']
```

The prefix is now part of the whole match, but `findall()` returns only the group. This handles any amount of whitespace, which a lookbehind in `re` cannot. The difference matters for `re.sub()` and for overlapping matches: a lookbehind does not consume the prefix, while a group does.

### The third-party `regex` module

The [`regex`](https://pypi.org/project/regex/) package is a drop-in replacement for `re` with extra features, including variable-width lookbehind. It is not part of the standard library, so install it in a virtual environment:

```bash
python -m pip install regex
```

```python
import regex

print(regex.findall(r"(?<=\$\s*)\d+", "costs $ 500 or $20"))
```

Output:

```text
['500', '20']
```

> **Note:** Some other regex engines support `\K` ("forget what was matched so far") as an alternative to lookbehind. Python's `re` does not.

## Combining lookbehind and lookahead

Lookbehind and lookahead can surround a pattern so that only the "middle" part is matched. This extracts the text inside square brackets without the brackets:

```python
import re

print(re.findall(r"(?<=\[)[^\]]+(?=\])", "Error [E42] in [main.py]"))
```

Output:

```text
['E42', 'main.py']
```

A lookbehind and a lookahead with nothing between them match a **position** between two characters. With `re.sub()` that inserts text there. This converts camelCase to snake_case by inserting `_` wherever a lowercase letter or digit is followed by an uppercase letter:

```python
import re

for name in ["parseHttpResponse", "userId", "html5Parser", "simple"]:
    snake = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", name).lower()
    print(name, "->", snake)
```

Output:

```text
parseHttpResponse -> parse_http_response
userId -> user_id
html5Parser -> html5_parser
simple -> simple
```

## Lookbehind and the starting position

A lookbehind can see characters that come before the position where the search starts:

```python
import re

pattern = re.compile(r"(?<=\$)\d+")
text = "$500"

print(pattern.match(text))
print(pattern.search(text))
print(pattern.match(text, 1))
print(pattern.match(text[1:]))
```

Output:

```text
None
<re.Match object; span=(1, 4), match='500'>
<re.Match object; span=(1, 4), match='500'>
None
```

- `match()` tries only position 0. Nothing is before position 0, so a pattern that **starts** with a positive lookbehind never matches with `re.match()`. Use `search()`.
- `pattern.match(text, 1)` starts at index 1 but still sees the whole string, so the lookbehind finds the `$` at index 0.
- Slicing (`text[1:]`) creates a new string without the `$`, so there is nothing for the lookbehind to see.

## Common mistakes

- **Using a variable-width pattern.** `(?<=\$\s*)`, `(?<=\d+)` and `(?<=\$|USD )` raise `re.PatternError: look-behind requires fixed-width pattern`. Use several lookbehinds, a capturing group or the `regex` module.
- **Getting partial numbers from a negative lookbehind.** `(?<!\$)\d+` returns `00` from `$500`. Add `\b` or forbid digits as well: `(?<![\d$])\d+`.
- **Confusing the syntax.** Lookbehind is `(?<=...)` / `(?<!...)`, with `<`. `(?=...)` / `(?!...)` is lookahead. A lookbehind is written *before* the part it guards.
- **Forgetting to escape special characters.** `(?<=$)` means "after the end of the string" and never matches before a digit. Write `(?<=\$)`.
- **Using `re.match()` with a pattern that starts with a lookbehind.** It can never succeed at position 0. Use `re.search()` or `re.finditer()`.

## Summary

- `(?<=Y)X` matches `X` only if `Y` comes right before it. `(?<!Y)X` matches `X` only if `Y` does not come before it.
- Lookbehind is zero-width: the text it checks is not part of the match.
- A negative lookbehind before a quantified pattern can match in the middle of a token. Guard it with `\b` or a wider character class.
- In Python's `re` the lookbehind pattern must have a fixed width. Alternatives are allowed only if they all have the same length.
- Workarounds: several lookbehinds joined with `|`, a capturing group for the part you need, or the third-party `regex` module, which supports variable-width lookbehind.
- Lookbehind plus lookahead can extract text between markers or match a position between characters for `re.sub()`.
- A lookbehind can see text before the `pos` argument, but `re.match()` at position 0 has nothing behind it.

## Practice

### Exercise 1: Prices in dollars

From `"Coffee $3.50, tea $2, cake 4.00"` extract the prices that follow a `$` sign, without the sign. Prices may have an optional decimal part with two digits. The expected result is `['3.50', '2']`.

### Exercise 2: Positive numbers only

From `"-5, 10, -20, 30"` extract the numbers that are **not** negative. The expected result is `['10', '30']`. Try `(?<!-)\d+` first and explain why it returns three items.

### Exercise 3: camelCase to snake_case

Write `to_snake(name)` that turns `"getUserName"` into `"get_user_name"`, `"maxValue2Go"` into `"max_value2_go"` and leaves `"plain"` unchanged. Use only lookarounds in the pattern, so that `re.sub()` inserts underscores without removing any characters.

### Exercise 4: Two kinds of currency prefix

From `"Paid $40, then USD 15, then EUR 9"` extract the amounts that follow either `$` or `USD ` (with exactly one space). The expected result is `['40', '15']`. Explain why `(?<=\$|USD )\d+` cannot be used, then solve the task with lookbehinds.

## Solutions

### Exercise 1

```python
import re

text = "Coffee $3.50, tea $2, cake 4.00"
print(re.findall(r"(?<=\$)\d+(?:\.\d{2})?", text))
```

Output:

```text
['3.50', '2']
```

The non-capturing group makes the decimal part optional without changing what `findall()` returns.

### Exercise 2

```python
import re

text = "-5, 10, -20, 30"

print(re.findall(r"(?<!-)\d+", text))
print(re.findall(r"(?<![-\d])\d+", text))
```

Output:

```text
['10', '0', '30']
['10', '30']
```

In `-20` the lookbehind blocks a match starting at `2`, but at `0` the previous character is `2`, not `-`, so `0` matches. Forbidding a digit before the match as well (`[-\d]`) means a number can only be matched from its first digit. `\b(?<!-)\d+` works too.

### Exercise 3

```python
import re


def to_snake(name):
    return re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", name).lower()


for name in ["getUserName", "maxValue2Go", "plain"]:
    print(to_snake(name))
```

Output:

```text
get_user_name
max_value2_go
plain
```

The pattern matches only empty positions between a lowercase letter or digit and an uppercase letter, so `re.sub()` inserts `_` there and keeps every original character.

### Exercise 4

```python
import re

text = "Paid $40, then USD 15, then EUR 9"

try:
    re.compile(r"(?<=\$|USD )\d+")
except re.PatternError as error:
    print("error:", error)

print(re.findall(r"(?:(?<=\$)|(?<=USD ))\d+", text))
```

Output:

```text
error: look-behind requires fixed-width pattern
['40', '15']
```

`\$` is one character wide and `USD ` is four, so the single lookbehind has no fixed width. Two separate lookbehinds, each with its own fixed width, joined by `|` inside a non-capturing group, express the same condition.

---

*Source: [pythontutorial.net — Python Regex Lookbehind](https://www.pythontutorial.net/python-regex/python-regex-lookbehind/). Adapted and expanded for PyJourney.*
