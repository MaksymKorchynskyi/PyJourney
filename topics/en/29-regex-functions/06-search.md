# search()

`re.search()` scans a string from left to right and returns the **first** place where a pattern matches. It is the most general of the single-match functions: the match may start anywhere and end anywhere. Use it to answer "does this text contain ...?" and to pull out the first occurrence of something, together with its groups and position.

## What you'll learn

- The signature of `re.search()` and what it returns
- How to read the matched text, groups and position from the `Match` object
- How nested groups are numbered and how `groups()` returns them
- How `search()` differs from `match()` and `fullmatch()`
- Why the regex engine returns the *leftmost* match, not the longest one
- How `Pattern.search(string, pos)` lets you continue a search

## The signature

```python
re.search(pattern, string, flags=0)
```

- `pattern` is the regular expression (a raw string or a compiled `Pattern`).
- `string` is the text to search.
- `flags` is optional: one regex flag or several combined with `|`.

`search()` tries the pattern at position 0, then 1, then 2, and so on, and stops at the first position where the pattern matches. It returns a `Match` object, or `None` if no position works.

## Finding the first match

The following example finds the first number in a string:

```python
import re

s = "Python 3 was released on Dec 3, 2008"
match = re.search(r"\d+", s)

print(match)
```

Output:

```text
<re.Match object; span=(7, 8), match='3'>
```

`\d+` matches one or more digits. Printing the `Match` object shows its span and the matched text. To get just the text, call `group()`, and always handle the `None` case:

```python
import re

s = "Python 3 was released on Dec 3, 2008"
match = re.search(r"\d+", s)

if match is not None:
    print(match.group())
else:
    print("No match found")
```

Output:

```text
3
```

Only the first number, `3`, is returned, even though the string contains three numbers. To get all of them, use `findall()` or `finditer()`.

## Reading the `Match` object

| Member | Meaning |
|---|---|
| `m.group()` / `m.group(0)` / `m[0]` | the whole match |
| `m.group(n)` / `m[n]` | group `n` |
| `m.group(1, 2)` | several groups as a tuple |
| `m.groups()` | all groups as a tuple |
| `m.groupdict()` | named groups as a dict |
| `m.start()`, `m.end()`, `m.span()` | position of the match |

### Nested groups

This example finds the first word that ends with `thon`:

```python
import re

s = "CPython, IronPython, or Cython"
match = re.search(r"\b((\w+)thon)\b", s)

if match is not None:
    print(match.groups())
    print(match.group(0), "|", match.group(1), "|", match.group(2))
    print(match.span())
```

Output:

```text
('CPython', 'CPy')
CPython | CPython | CPy
(0, 7)
```

The pattern has two capturing groups. Groups are numbered by their **opening** parenthesis, from left to right:

- group 1 `((\w+)thon)` captures the whole word,
- group 2 `(\w+)` captures the part before `thon`.

`groups()` returns all of them as a tuple. Group 0 is always the whole match, which here equals group 1 because the `\b` anchors match empty positions.

### Named groups

Names make the code easier to read than numbers:

```python
import re

s = "Contact: Olena Petrenko <olena@example.com>, phone 555-0199"
m = re.search(r"<(?P<user>[\w.]+)@(?P<domain>[\w.]+)>", s)

if m:
    print(m["user"], m["domain"])
    print(m.groupdict())
```

Output:

```text
olena example.com
{'user': 'olena', 'domain': 'example.com'}
```

## Using flags

By default, matching is case-sensitive. The pattern `\bpython\b` skips `Python` and finds the lower-case word:

```python
import re

s = "Python or python"
print(re.search(r"\bpython\b", s))
print(re.search(r"\bpython\b", s, flags=re.IGNORECASE))
```

Output:

```text
<re.Match object; span=(10, 16), match='python'>
<re.Match object; span=(0, 6), match='Python'>
```

With `re.IGNORECASE`, the first word already matches, so `search()` returns `Python` at position 0.

## `search()` vs `match()` vs `fullmatch()`

All three return a `Match` or `None`. The difference is where the match may start and end:

| Function | Match must start | Match must end | Question |
|---|---|---|---|
| `re.search()` | anywhere | anywhere | "Does the string contain ...?" |
| `re.match()` | at the start of the string | anywhere | "Does the string start with ...?" |
| `re.fullmatch()` | at the start of the string | at the end of the string | "Is the string exactly ...?" |

```python
import re

for s in ["42", "42 apples", "apples 42"]:
    print(
        f"{s!r:12}",
        "search:", bool(re.search(r"\d+", s)),
        "match:", bool(re.match(r"\d+", s)),
        "fullmatch:", bool(re.fullmatch(r"\d+", s)),
    )
```

Output:

```text
'42'         search: True match: True fullmatch: True
'42 apples'  search: True match: True fullmatch: False
'apples 42'  search: True match: False fullmatch: False
```

You can express the other two through `search()` with anchors: `match(p, s)` behaves like `search(r"\A(?:p)", s)`, and `fullmatch(p, s)` like `search(r"\A(?:p)\Z", s)`. The dedicated functions are clearer and avoid mistakes with `^`, `$` and alternation.

## Leftmost wins, not longest

`search()` returns the match that **starts first**, even if a longer one exists later:

```python
import re

print(re.search(r"\d+", "abc 12 3456"))
```

Output:

```text
<re.Match object; span=(4, 6), match='12'>
```

At the same starting position, alternatives are tried **in the order you wrote them**, and the first one that works is accepted:

```python
import re

print(re.search(r"cat|category", "category"))
print(re.search(r"category|cat", "category"))
```

Output:

```text
<re.Match object; span=(0, 3), match='cat'>
<re.Match object; span=(0, 8), match='category'>
```

When one alternative is a prefix of another, put the longer one first, or add a word boundary: `\b(?:cat|category)\b`.

## Continuing a search: `Pattern.search(string, pos)`

A compiled pattern's `search()` accepts `pos` and `endpos`. Passing the end of the previous match as `pos` lets you walk through a string match by match. This is essentially what `finditer()` does for you:

```python
import re

number = re.compile(r"\d+")
text = "a1 b22 c333"

pos = 0
while m := number.search(text, pos):
    print(m[0], m.span())
    pos = m.end()
```

Output:

```text
1 (1, 2)
22 (4, 6)
333 (8, 11)
```

> **Note:** With `pos`, the anchor `^` still means "the real beginning of the string", not "position `pos`". This differs from slicing the string first.

## `search()` or the `in` operator?

To check whether a string contains a **fixed** substring, the `in` operator is simpler and faster: `"error" in line`. Use `search()` when you need a pattern (digits, word boundaries, alternatives), case-insensitivity, or the position and groups of the match.

## Common mistakes

- **Calling `.group()` without checking for `None`.** If nothing matches, `re.search(...).group()` raises `AttributeError: 'NoneType' object has no attribute 'group'`. Test the result first, for example with `if m := re.search(...):`.
- **Expecting all matches.** `search()` stops at the first one. Use `findall()` or `finditer()` for all of them.
- **Expecting the longest match.** The leftmost match wins, and among alternatives the first written one wins.
- **Forgetting the raw string.** `"\bword\b"` contains two backspace characters, not word boundaries, so the search silently fails. Write `r"\bword\b"`.
- **Building a pattern from user input without escaping.** `re.search("1+1", s)` means "one or more `1`, then `1`". Use `re.search(re.escape("1+1"), s)` to search for the literal text.

## Summary

- `re.search(pattern, string, flags=0)` returns a `Match` for the first location where the pattern matches, or `None`.
- The match can start and end anywhere in the string.
- Use `group()`, `groups()`, `groupdict()` and `span()` on the result. Groups are numbered by their opening parenthesis.
- `match()` restricts the start, `fullmatch()` restricts both ends, and `search()` restricts nothing.
- The engine returns the leftmost match, and tries alternatives in the written order.
- `Pattern.search(string, pos)` continues searching from a given position.

## Practice

### Exercise 1: The first year

Write `first_year(text)` that returns the first four-digit year between 1900 and 2099 as an `int`, or `None` if there is none. Test it with `"Founded in 1998, renamed in 2015"`, `"Room 12345, built 2003"` and `"no years here"`.

### Exercise 2: Version numbers

Use `search()` with named groups to extract the version from `"Python 3.14.0 (main, Oct  7 2025)"` and print `major`, `minor` and `micro` as integers.

### Exercise 3: Words ending with a suffix

Write `first_word_ending_with(text, suffix)` that returns the first whole word ending with `suffix`, or `None`. The suffix may contain special characters, so escape it. Test with `("CPython, IronPython, or Cython", "thon")`, `("We use C++ and g++", "++")` and `("nothing", "xyz")`.

### Exercise 4: Your own `findall()`

Without using `findall()` or `finditer()`, write `all_numbers(text)` that returns a list of all numbers in the text. Use a compiled pattern and its `search()` method with `pos`. Test with `"7 days, 24 hours, 1440 minutes"`.

## Solutions

### Exercise 1

```python
import re


def first_year(text):
    m = re.search(r"\b(?:19|20)\d{2}\b", text)
    return int(m[0]) if m else None


print(first_year("Founded in 1998, renamed in 2015"))
print(first_year("Room 12345, built 2003"))
print(first_year("no years here"))
```

Output:

```text
1998
2003
None
```

The word boundaries prevent a match inside `12345`. The non-capturing group `(?:19|20)` restricts the century.

### Exercise 2

```python
import re

banner = "Python 3.14.0 (main, Oct  7 2025)"
m = re.search(r"(?P<major>\d+)\.(?P<minor>\d+)\.(?P<micro>\d+)", banner)

if m:
    version = {name: int(value) for name, value in m.groupdict().items()}
    print(version)
```

Output:

```text
{'major': 3, 'minor': 14, 'micro': 0}
```

### Exercise 3

```python
import re


def first_word_ending_with(text, suffix):
    m = re.search(r"\w*" + re.escape(suffix) + r"(?!\w)", text)
    return m[0] if m else None


print(first_word_ending_with("CPython, IronPython, or Cython", "thon"))
print(first_word_ending_with("We use C++ and g++", "++"))
print(first_word_ending_with("nothing", "xyz"))
```

Output:

```text
CPython
C++
None
```

`re.escape("++")` gives `\+\+`, so the plus signs are matched literally. A trailing `\b` would not work after a non-word character like `+`, so the negative lookahead `(?!\w)` is used instead: it means "not followed by a word character".

### Exercise 4

```python
import re


def all_numbers(text):
    number = re.compile(r"\d+")
    result = []
    pos = 0
    while (m := number.search(text, pos)) is not None:
        result.append(m[0])
        pos = m.end()
    return result


print(all_numbers("7 days, 24 hours, 1440 minutes"))
```

Output:

```text
['7', '24', '1440']
```

Each search starts where the previous match ended, so matches never overlap. Because `\d+` cannot match an empty string, `pos` always moves forward and the loop terminates.

---

*Source: [pythontutorial.net — Python Regex search()](https://www.pythontutorial.net/python-regex/python-regex-search/). Adapted and expanded for PyJourney.*
