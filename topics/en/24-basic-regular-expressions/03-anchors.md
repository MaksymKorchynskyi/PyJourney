# Anchors

**Anchors** are regex elements that match a **position** in the string rather than a character. They pin a pattern to the beginning or the end of the text (or of each line), which turns "the pattern occurs somewhere" into "the string starts with it", "ends with it" or "consists of it". Without anchors, input validation with regular expressions is almost always broken.

## What you'll learn

- What it means that an anchor matches a position, not a character
- How `^` and `$` match at the start and the end of a string
- How to combine them to check a whole string, and why `$` can let a trailing newline through
- How `re.MULTILINE` makes `^` and `$` work on every line
- How `\A` and `\Z` always mean the start and the end of the whole string
- How to match a literal `$` or `^`

## Positions, not characters

Think of a string as characters with **gaps** between them. A string of length 5 has 6 positions, from 0 (before the first character) to 5 (after the last one):

```text
  | 1 | 2 | : | 2 | 0 |
  0   1   2   3   4   5
  ^                   $
```

The anchor `^` matches at position 0, and `$` matches at position 5. An anchor is **zero-width**: it checks where the engine is but consumes no characters. A match of an anchor alone is therefore an empty string:

```python
>>> import re
>>> [m.span() for m in re.finditer(r"^", "abc")]
[(0, 0)]
>>> [m.span() for m in re.finditer(r"$", "abc")]
[(3, 3)]
```

## `^`: the start of the string

The pattern `\d\d` finds both pairs of digits in a time string:

```python
import re

time = "12:20"

for match in re.finditer(r"\d\d", time):
    print(match.group())
```

Output:

```text
12
20
```

With the caret in front, the two digits must stand at the very beginning, so only one match is left:

```python
import re

time = "12:20"

for match in re.finditer(r"^\d\d", time):
    print(match.group())
```

Output:

```text
12
```

## `$`: the end of the string

The dollar sign works the same way at the other end. `\d\d$` means "two digits followed by the end of the string":

```python
import re

time = "12:20"

for match in re.finditer(r"\d\d$", time):
    print(match.group())
```

Output:

```text
20
```

## Combining `^` and `$`: the whole string

With both anchors, the pattern must cover everything from the start to the end. This is how you check that a string *is* a time, not just that it *contains* one:

```python
import re

time = "12:20"

for match in re.finditer(r"^\d\d:\d\d$", time):
    print(match.group())
```

Output:

```text
12:20
```

Let's test it on a few more inputs:

```python
import re

pattern = r"^\d\d:\d\d$"

for text in ["12:20", "30:99", "at 12:20", "12:205"]:
    print(f"{text!r:10}", re.search(pattern, text) is not None)
```

Output:

```text
'12:20'    True
'30:99'    True
'at 12:20' False
'12:205'   False
```

The anchors correctly reject extra text before or after the time. But `30:99` passes, because the pattern only checks the **shape** "two digits, colon, two digits", not the values. In the 24-hour format a valid time runs from `00:00` to `23:59`: hours `00` to `23`, minutes `00` to `59`.

As a preview, here is a pattern that checks the ranges too. It uses sets such as `[01]` and `[0-5]` (see the Sets & Ranges topic) and the alternation `|` inside a group (see the Groupings topic): "`0` or `1` followed by any digit, **or** `2` followed by `0` to `3`".

```python
import re

pattern = r"^([01]\d|2[0-3]):[0-5]\d$"

for t in ["00:00", "09:45", "23:59", "24:00", "30:99", "7:05"]:
    print(t, bool(re.search(pattern, t)))
```

Output:

```text
00:00 True
09:45 True
23:59 True
24:00 False
30:99 False
7:05 False
```

## The trailing newline trap: `$` vs `\Z`

`$` has one surprising rule: it matches at the end of the string **and also just before a newline at the very end**. This is convenient when you process lines read from a file, which usually end in `\n`. For validation, however, it means that a string with a stray newline passes the check:

```python
import re

text = "12:20\n"

print(re.search(r"^\d\d:\d\d$", text))
print(re.search(r"\A\d\d:\d\d\Z", text))
print(re.fullmatch(r"\d\d:\d\d", text))
```

Output:

```text
<re.Match object; span=(0, 5), match='12:20'>
None
None
```

`\A` and `\Z` are the strict anchors: `\A` matches only at the start of the string, and `\Z` only at its absolute end. `re.fullmatch()` has the same strict behaviour, and it is usually the clearest choice for validation.

Because of the same rule, `$` can even match twice in one string:

```python
>>> import re
>>> [m.span() for m in re.finditer(r"$", "abc\n")]
[(3, 3), (4, 4)]
```

> **Note:** In Perl, Java and many other regex engines, `\Z` behaves like Python's `$` and lets a final newline through, while `\z` (lower case) is the strict end. Since **Python 3.14**, `re` also accepts `\z` as an alias for `\Z`, so the strict anchor is spelled the same way in all of them. In older Python versions, use `\Z`.

## Multiline mode: `re.MULTILINE`

By default `^` and `$` refer to the whole string, even if it contains many lines. The `re.MULTILINE` flag (short form `re.M`) makes them match at the start and the end of **every line**:

```python
import re

log = """ERROR 1 disk full
INFO 2 started
ERROR 3 timeout"""

print(re.findall(r"^ERROR", log))
print(re.findall(r"^ERROR", log, re.MULTILINE))
```

Output:

```text
['ERROR']
['ERROR', 'ERROR']
```

Without the flag, only the `ERROR` at the very start of the text qualifies. With it, every line start counts. `$` changes in the same way:

```python
import re

text = "a1\nb2\nc3"

print(re.findall(r"\d$", text))
print(re.findall(r"\d$", text, re.MULTILINE))
print(re.findall(r"\A\w", text, re.MULTILINE))
```

Output:

```text
['3']
['1', '2', '3']
['a']
```

`\A` ignores `re.MULTILINE`: it always means the start of the whole string. The same is true for `\Z`.

| Anchor | Default | With `re.MULTILINE` |
|---|---|---|
| `^` | start of the string | start of the string and right after every `\n` |
| `$` | end of the string, or before a final `\n` | end of the string and right before every `\n` |
| `\A` | start of the string | start of the string (unchanged) |
| `\Z` | end of the string | end of the string (unchanged) |

## Zero-width in practice: inserting text at positions

Since an anchor matches an empty position, replacing it **inserts** text without removing anything. This one-liner quotes every line of a message, as e-mail clients do:

```python
import re

text = "first line\nsecond line\nthird line"

print(re.sub(r"^", "> ", text, flags=re.MULTILINE))
```

Output:

```text
> first line
> second line
> third line
```

Note `flags=re.MULTILINE` passed **by keyword**. The fourth positional argument of `re.sub()` is `count`, not `flags` (see Common mistakes).

## Anchors vs `match()` and `fullmatch()`

The functions from the previous topics are closely related to anchors:

- `re.match(p, s)` behaves like `re.search(r"\A(?:" + p + ")", s)`: the match must start at position 0.
- `re.fullmatch(p, s)` behaves like `re.search(r"\A(?:" + p + r")\Z", s)`: the match must cover the whole string.

For checking a whole string, `fullmatch()` is the most readable option. Anchors are indispensable in the other cases: inside `findall()`, `finditer()` and `sub()`, for line-by-line processing with `re.MULTILINE`, and when only one end of the string matters.

## Matching a literal `$` or `^`

To match the characters themselves, escape them: `\$` and `\^`. An unescaped `$` in the middle of a pattern means "end of string", so nothing can follow it and the pattern never matches:

```python
import re

prices = "Total: $45, tax $5"

print(re.findall(r"\$\d\d", prices))
print(re.findall(r"$\d\d", prices))
```

Output:

```text
['$45']
[]
```

Inside square brackets the caret has a different job: `[^0-9]` means "any character except a digit". The Sets & Ranges topic covers it.

## Common mistakes

- **Validating without anchors.** `re.search(r"\d\d:\d\d", "abc12:20xyz")` succeeds. Anchor the pattern or use `fullmatch()`.
- **Trusting `$` for strict validation.** `^\d\d:\d\d$` accepts `"12:20\n"`. Use `\A...\Z` or `fullmatch()`.
- **Forgetting `re.MULTILINE`.** Without it, `^` and `$` look only at the start and end of the whole text, not of each line.
- **Passing flags positionally to `re.sub()` or `re.split()`.** Their fourth positional parameter is `count` / `maxsplit`. `re.MULTILINE` is just the number 8, so it silently becomes "replace at most 8 times", and the flag is not applied. Since Python 3.13 this also triggers a `DeprecationWarning`:

  ```python
  import re

  text = "first line\nsecond line\nthird line"

  print(re.sub(r"^", "> ", text, re.MULTILINE))
  ```

  Output (the file path is shortened):

  ```text
  .../example.py:5: DeprecationWarning: 'count' is passed as positional argument
    print(re.sub(r"^", "> ", text, re.MULTILINE))
  > first line
  second line
  third line
  ```

  Always write `flags=re.MULTILINE`.

- **Forgetting to escape `$` in prices.** `r"$\d\d"` can never match. Write `r"\$\d\d"`.
- **Reading `^` inside `[...]` as an anchor.** In `[^abc]` it means negation, not "start of string".

## Summary

- Anchors match positions, not characters. They are zero-width and consume nothing.
- `^` matches at the start of the string, `$` at the end.
- `^...$` together check that the pattern covers the whole string, but `$` also matches before a final newline.
- `\A` and `\Z` always mean the absolute start and end of the string. Python 3.14 also accepts `\z` as an alias for `\Z`.
- `re.MULTILINE` makes `^` and `$` match at the start and end of every line. `\A` and `\Z` are not affected.
- For whole-string validation, `re.fullmatch()` is usually the clearest tool.
- Pass flags to `re.sub()` and `re.split()` by keyword, and escape `$` and `^` when you need the literal characters.

## Practice

### Exercise 1: Year validator

Write `is_year(text)` that returns `True` only for exactly four digits, using the anchors `\A` and `\Z` with `re.search()`. Test it with `"2024"`, `"2024\n"`, `"12024"` and `"year 2024"`.

### Exercise 2: Comments in a config file

Count how many lines of the text below **start** with `#`, and how many lines **end** with `:`.

```python
config = """# database settings
database:
  host: localhost
# cache settings
cache:
  enabled: yes"""
```

### Exercise 3: A real time validator

The pattern `^\d\d:\d\d$` accepts `30:99`. Write `is_valid_time(text)` that first checks the shape with `re.fullmatch()` and then checks the values with `int()`: hours `0` to `23`, minutes `0` to `59`. Test it with `"00:00"`, `"23:59"`, `"24:00"`, `"12:60"`, `"7:05"` and `"12:30\n"`.

### Exercise 4: Quote a reply

Add `"> "` to the beginning of every line of `"Hi Olena,\nthanks for the update.\nSee you!"` with one `re.sub()` call.

## Solutions

### Exercise 1

```python
import re


def is_year(text):
    return re.search(r"\A\d\d\d\d\Z", text) is not None


for candidate in ["2024", "2024\n", "12024", "year 2024"]:
    print(repr(candidate), is_year(candidate))
```

Output:

```text
'2024' True
'2024\n' False
'12024' False
'year 2024' False
```

With `^...$` instead, `"2024\n"` would be accepted.

### Exercise 2

```python
import re

config = """# database settings
database:
  host: localhost
# cache settings
cache:
  enabled: yes"""

comments = re.findall(r"^#", config, re.MULTILINE)
sections = re.findall(r":$", config, re.MULTILINE)

print(len(comments), len(sections))
```

Output:

```text
2 2
```

Without `re.MULTILINE`, the counts would be `1` (only the first line is checked) and `0` (the text ends with `yes`, not `:`).

### Exercise 3

```python
import re


def is_valid_time(text):
    if not re.fullmatch(r"\d\d:\d\d", text):
        return False
    hours, minutes = int(text[:2]), int(text[3:])
    return hours <= 23 and minutes <= 59


for candidate in ["00:00", "23:59", "24:00", "12:60", "7:05", "12:30\n"]:
    print(repr(candidate), is_valid_time(candidate))
```

Output:

```text
'00:00' True
'23:59' True
'24:00' False
'12:60' False
'7:05' False
'12:30\n' False
```

Splitting the job between a regex (the shape) and ordinary Python (the ranges) often gives code that is easier to read than one huge pattern.

### Exercise 4

```python
import re

reply = "Hi Olena,\nthanks for the update.\nSee you!"

print(re.sub(r"^", "> ", reply, flags=re.MULTILINE))
```

Output:

```text
> Hi Olena,
> thanks for the update.
> See you!
```

---

*Source: [pythontutorial.net — Python Regex Anchors](https://www.pythontutorial.net/python-regex/python-regex-anchors/). Adapted and expanded for PyJourney.*
