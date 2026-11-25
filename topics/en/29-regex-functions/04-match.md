# match()

`re.match()` checks whether a string **starts with** text that fits a pattern. It never looks further into the string for a match, which makes it fast and precise for questions like "does this line begin with a date?" or "is the first token a number?". It is also the function most often confused with `search()` and `fullmatch()`, so this topic pays close attention to the differences.

## What you'll learn

- The signature of `re.match()` and what it returns
- Why `match()` is anchored at the start but not at the end
- How `match()` differs from `search()` and `fullmatch()`
- Why `re.MULTILINE` does not make `match()` check every line
- How `Pattern.match(string, pos)` works, and why `^` behaves differently there
- How to use the match to split a string into a parsed prefix and the rest

## The signature

```python
re.match(pattern, string, flags=0)
```

- `pattern` is the regular expression. Besides a raw string, it can be a compiled `Pattern` object.
- `string` is the input string.
- `flags` is optional: one regex flag or several combined with `|`.

If the beginning of `string` matches `pattern`, the function returns a `Match` object. Otherwise it returns `None`.

## A first example

The following code checks whether a string starts with a digit:

```python
import re

s = "3 pieces cost 5 USD"
match = re.match(r"\d", s)

if match is not None:
    print(f"The string starts with a digit {match.group()}")
```

Output:

```text
The string starts with a digit 3
```

> **Note:** You may see this pattern written as `\d{1}`. The quantifier `{1}` means "exactly once", which is what a bare `\d` already means, so it only adds noise.

The string also contains `5`, but that does not matter: `match()` only looks at position 0. If the string started with a letter, the result would be `None` even though digits appear later:

```python
import re

print(re.match(r"\d", "Price: 5 USD"))
```

Output:

```text
None
```

## Anchored at the start, not at the end

`match()` requires the match to *begin* at the first character, but the match may end anywhere. Whatever follows is simply ignored:

```python
import re

m = re.match(r"\d+", "42 apples")
print(m)
print(m.group())
```

Output:

```text
<re.Match object; span=(0, 2), match='42'>
42
```

This is exactly what you want when parsing a prefix, and exactly what you do **not** want when validating a whole value. `re.match(r"\d+", "123abc")` succeeds too. To check that the entire string is a number, use `re.fullmatch(r"\d+", s)`.

## Using the match to parse the beginning of a string

Because the match starts at position 0, `m.end()` tells you where the parsed prefix stops. The rest of the string is `s[m.end():]`:

```python
import re

line = "2024-03-15 Server started on port 8080"
m = re.match(r"(\d{4})-(\d{2})-(\d{2})\s+", line)

if m:
    year, month, day = map(int, m.groups())
    message = line[m.end():]
    print(year, month, day)
    print(message)
```

Output:

```text
2024 3 15
Server started on port 8080
```

`\s+` at the end of the pattern consumes the spaces after the date, so the message starts cleanly.

> **Tip:** Since Python 3.8 the walrus operator lets you match and test in one line: `if m := re.match(pattern, line):`. The variable `m` is then available inside the `if` block.

## `match()` vs `search()` vs `fullmatch()`

The three functions accept the same arguments and return a `Match` or `None`. They differ only in where the match may start and end:

| Function | Match must start | Match must end | Question it answers |
|---|---|---|---|
| `re.match()` | at the start of the string | anywhere | "Does the string start with ...?" |
| `re.search()` | anywhere | anywhere | "Does the string contain ...?" |
| `re.fullmatch()` | at the start of the string | at the end of the string | "Is the string exactly ...?" |

```python
import re

s = "Python 3.14"

print(re.match(r"\d+", s))
print(re.search(r"\d+", s))
print(re.match(r"Python", s))
print(re.fullmatch(r"Python", s))
print(re.fullmatch(r"Python \d+\.\d+", s))
```

Output:

```text
None
<re.Match object; span=(7, 8), match='3'>
<re.Match object; span=(0, 6), match='Python'>
None
<re.Match object; span=(0, 11), match='Python 3.14'>
```

- `match(r"\d+", s)` fails, because the string starts with `P`, not a digit.
- `search(r"\d+", s)` scans forward and finds `3`.
- `match(r"Python", s)` succeeds on the prefix, while `fullmatch(r"Python", s)` fails because of the leftover `" 3.14"`.

`re.match(p, s)` behaves like `re.search(r"\A(?:" + p + ")", s)`: a search that is forced to begin at the start of the string.

## `match()` ignores line starts, even with `re.MULTILINE`

The `re.MULTILINE` flag makes `^` match at the start of **every line**. It does not change `match()`, which always tries only the start of the whole string:

```python
import re

text = "first line\nX marks the spot"

print(re.match(r"X", text, re.MULTILINE))
print(re.search(r"^X", text, re.MULTILINE))
```

Output:

```text
None
<re.Match object; span=(11, 12), match='X'>
```

To find something at the beginning of any line, use `search()` or `findall()` with `^` and `re.MULTILINE`.

## `Pattern.match()` and the `pos` argument

A compiled pattern has a `match()` method with optional `pos` and `endpos` arguments. With `pos`, the match must begin at that index instead of at 0:

```python
import re

number = re.compile(r"\d+")

print(number.match("ab12"))
print(number.match("ab12", 2))
```

Output:

```text
None
<re.Match object; span=(2, 4), match='12'>
```

There is one subtle trap. `pos` is **not** the same as slicing the string. The anchor `^` still means "the real beginning of the string", so a pattern that starts with `^` cannot match at `pos=2`:

```python
import re

anchored = re.compile(r"^\d+")

print(anchored.match("ab12", 2))
print(anchored.match("ab12"[2:]))
```

Output:

```text
None
<re.Match object; span=(0, 2), match='12'>
```

The slice `"ab12"[2:]` creates the new string `"12"`, where `^` is at position 0. With `pos=2` the string is still `"ab12"`, and position 2 is not its beginning.

## Common mistakes

- **Expecting `match()` to search the whole string.** `re.match(r"\d+", "Price: 5")` returns `None`. Use `search()` to find a pattern anywhere.
- **Using `match()` to validate input.** It accepts any string that merely *starts* with a valid value: `re.match(r"\d+", "123abc")` succeeds. Use `fullmatch()`.
- **Calling `.group()` on `None`.** Always check the result first, or use the walrus operator:

  ```python
  import re

  for s in ["42 apples", "apples"]:
      if m := re.match(r"\d+", s):
          print(s, "->", int(m.group()))
      else:
          print(s, "-> no leading number")
  ```

  Output:

  ```text
  42 apples -> 42
  apples -> no leading number
  ```

- **Expecting `re.MULTILINE` to make `match()` test every line.** It does not. Use `search()`/`findall()` with `^`.
- **Treating `pos` like a slice.** `^` still refers to the real start of the string.

## Summary

- `re.match(pattern, string, flags=0)` returns a `Match` if the pattern matches at the **start** of the string, and `None` otherwise.
- The match must start at position 0 but may end anywhere. The rest of the string is ignored.
- Use `match()` to test or parse a prefix, `search()` to find a pattern anywhere, and `fullmatch()` to validate the whole string.
- `m.end()` tells you where the parsed prefix ends, so `s[m.end():]` is the remainder.
- `re.MULTILINE` affects `^` and `$`, not `match()` itself.
- `Pattern.match(string, pos)` starts at `pos`, but `^` still means the real beginning of the string.

## Practice

### Exercise 1: Comment lines

Write `is_comment(line)` that returns `True` if a line of Python code is a comment: optional spaces or tabs, then `#`. Test it with `"# note"`, `"    # indented note"`, `"x = 1  # trailing"` and `""`.

### Exercise 2: HTTP request line

The first line of an HTTP request looks like `"GET /index.html HTTP/1.1"`. Use `re.match()` with named groups to extract the method (upper-case letters) and the path (non-space characters). Print them for `"GET /index.html HTTP/1.1"` and `"POST /api/users?id=7 HTTP/2"`, and print `invalid` for `"hello world"`.

### Exercise 3: Version prefixes

From the list below keep only the strings that **start** with a version like `v1.2` (a `v`, a number, a dot and a number) and collect `(major, minor)` integer tuples. Expected result: `[(1, 2), (10, 0), (3, 7)]`.

```python
items = ["v1.2 release", "v10.0.3 beta", "release v2.0", "v3", "v3.7-rc1"]
```

### Exercise 4: Predict the output

Predict what each line prints, then run the code and explain the results.

```python
import re

p = re.compile(r"\d+")
q = re.compile(r"^\d+")
s = "abc 42"

print(p.match(s))
print(p.match(s, 4))
print(q.match(s, 4))
print(q.search(s))
print(re.search(r"\d+", s))
```

## Solutions

### Exercise 1

```python
import re


def is_comment(line):
    return re.match(r"[ \t]*#", line) is not None


for line in ["# note", "    # indented note", "x = 1  # trailing", ""]:
    print(repr(line), is_comment(line))
```

Output:

```text
'# note' True
'    # indented note' True
'x = 1  # trailing' False
'' False
```

`[ \t]*` allows any amount of leading spaces or tabs, including none. The line with a trailing comment starts with `x`, so it is not a comment line.

### Exercise 2

```python
import re

REQUEST_LINE = re.compile(r"(?P<method>[A-Z]+) (?P<path>\S+)")

for line in ["GET /index.html HTTP/1.1", "POST /api/users?id=7 HTTP/2", "hello world"]:
    if m := REQUEST_LINE.match(line):
        print(m["method"], m["path"])
    else:
        print("invalid")
```

Output:

```text
GET /index.html
POST /api/users?id=7
invalid
```

`"hello world"` fails because `[A-Z]+` needs at least one upper-case letter at position 0.

### Exercise 3

```python
import re

items = ["v1.2 release", "v10.0.3 beta", "release v2.0", "v3", "v3.7-rc1"]

versions = []
for item in items:
    if m := re.match(r"v(\d+)\.(\d+)", item):
        versions.append((int(m[1]), int(m[2])))

print(versions)
```

Output:

```text
[(1, 2), (10, 0), (3, 7)]
```

`"release v2.0"` contains a version, but not at the start. `"v3"` has no `.minor` part.

### Exercise 4

Output:

```text
None
<re.Match object; span=(4, 6), match='42'>
None
None
<re.Match object; span=(4, 6), match='42'>
```

- `p.match(s)`: the string starts with `a`, so there is no match at position 0.
- `p.match(s, 4)`: the match must start at index 4, where `42` begins.
- `q.match(s, 4)`: `^` still means the real start of `"abc 42"`, and index 4 is not it.
- `q.search(s)`: `search()` may try every position, but `^` only matches at 0, where there is no digit.
- `re.search(r"\d+", s)`: without the anchor, the search finds `42`.

---

*Source: [pythontutorial.net — Python Regex match()](https://www.pythontutorial.net/python-regex/python-regex-match/). Adapted and expanded for PyJourney.*
