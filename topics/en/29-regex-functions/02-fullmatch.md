# fullmatch()

`re.fullmatch()` answers a yes-or-no question: does the **entire** string match the pattern? This makes it the natural tool for validating input such as postcodes, usernames, times or email addresses, where a partial match is not good enough.

## What you'll learn

- The signature of `re.fullmatch()` and what it returns
- How to build a simple validator, and a validator function that raises `ValueError`
- How `fullmatch()` differs from `match()` and `search()`
- Why `^...$` is not a perfect replacement for `fullmatch()`
- How alternation behaves when the whole string must match
- How to check only part of a string with `Pattern.fullmatch(string, pos, endpos)`

## The signature

```python
re.fullmatch(pattern, string, flags=0)
```

- `pattern` is the regular expression (a raw string or a compiled `Pattern`).
- `string` is the text to check.
- `flags` is optional and defaults to `0` (no flags). It accepts one flag or several combined with `|`.

The function returns a `Match` object if the pattern matches the string **from the first character to the last**. Otherwise it returns `None`.

```python
import re

print(re.fullmatch(r"\d{4}", "2024"))
print(re.fullmatch(r"\d{4}", "2024a"))
print(re.fullmatch(r"\d{4}", "12024"))
```

Output:

```text
<re.Match object; span=(0, 4), match='2024'>
None
None
```

`"2024a"` and `"12024"` both *contain* four digits, but neither string *is* four digits, so `fullmatch()` rejects both.

A `Match` object is always truthy and `None` is falsy, so you can use the result directly in an `if`. Writing `is not None` makes the intent explicit, and both styles are common.

## Validating an email address

The following example checks that a string looks like an email address:

```python
import re

email = "no-reply@pythontutorial.net"
pattern = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
match = re.fullmatch(pattern, email)

if match is not None:
    print(f'The email "{match.group()}" is valid')
else:
    print(f'The email "{email}" is not valid')
```

Output:

```text
The email "no-reply@pythontutorial.net" is valid
```

How the pattern is built:

| Part | Meaning |
|---|---|
| `[A-Za-z0-9._%+-]+` | the local part: letters, digits and `. _ % + -`, at least one |
| `@` | a literal at sign |
| `[A-Za-z0-9.-]+` | the domain name: letters, digits, dots and hyphens |
| `\.` | a literal dot (escaped, because `.` alone means "any character") |
| `[A-Za-z]{2,}` | the top-level domain: at least two letters |

> **Note:** This pattern is a practical simplification. The official email grammar (RFC 5322) is far more permissive and complex. For real sign-up forms, use a simple check like this one and then confirm the address by sending an email to it.

### A bug worth knowing: `|` inside a character class

Many tutorials, including the original source of this lesson, write the last part as `[A-Z|a-z]{2,}`. Inside square brackets `|` is **not** alternation. It is just a literal pipe character that becomes part of the set. As a result, that pattern accepts a nonsense domain:

```python
import re

buggy = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}"
fixed = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"

print(re.fullmatch(buggy, "user@example.c|m"))
print(re.fullmatch(fixed, "user@example.c|m"))
```

Output:

```text
<re.Match object; span=(0, 16), match='user@example.c|m'>
None
```

Inside a set, list ranges side by side: `[A-Za-z]`.

### A validator function

Validation logic usually lives in a function. A predicate that returns `bool` is the most flexible form:

```python
import re

EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def is_email(s: str) -> bool:
    return EMAIL_PATTERN.fullmatch(s) is not None


print(is_email("no-reply@pythontutorial.net"))
print(is_email("no-reply@pythontutorial"))
```

Output:

```text
True
False
```

Sometimes invalid input should stop the program flow instead. Then the function raises `ValueError`, and the caller decides what to do:

```python
import re

EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def validate_email(s: str) -> str:
    if EMAIL_PATTERN.fullmatch(s) is None:
        raise ValueError(f"{s!r} is not a valid email address")
    return s


if __name__ == "__main__":
    for candidate in ["no-reply@pythontutorial.net", "no-reply@pythontutorial"]:
        try:
            print("Valid:", validate_email(candidate))
        except ValueError as e:
            print("Error:", e)
```

Output:

```text
Valid: no-reply@pythontutorial.net
Error: 'no-reply@pythontutorial' is not a valid email address
```

The pattern is compiled once at module level, so every call reuses it. Returning the validated value (instead of `True`) lets the caller write `address = validate_email(raw)`.

## `fullmatch()` vs `match()` vs `search()`

All three return a `Match` object or `None`. They differ in **where** the match is allowed to start and end:

| Function | Match must start | Match must end | Typical use |
|---|---|---|---|
| `re.match()` | at the start of the string | anywhere | "Does the string start with ...?" |
| `re.search()` | anywhere | anywhere | "Does the string contain ...?" |
| `re.fullmatch()` | at the start of the string | at the end of the string | "Is the string exactly ...?" |

### `fullmatch()` vs `match()`

```python
import re

s = "Python 3"
pattern = r"Python"

match = re.fullmatch(pattern, s)
if match is not None:
    print("fullmatch:", match.group())

match = re.match(pattern, s)
if match is not None:
    print("match:", match.group())
```

Output:

```text
match: Python
```

`match()` is happy because the string *starts* with `Python`. `fullmatch()` returns `None` because `" 3"` is left over after the match.

### `fullmatch()` vs `search()`

```python
import re

s = "Python 3"
pattern = r"\d"

match = re.fullmatch(pattern, s)
if match is not None:
    print("fullmatch:", match.group())

match = re.search(pattern, s)
if match is not None:
    print("search:", match.group())
```

Output:

```text
search: 3
```

`search()` scans the whole string and finds the digit `3` at the end. `fullmatch()` fails because the whole string `"Python 3"` is not a single digit.

## Why not just write `^...$`?

Before Python 3.4 added `fullmatch()`, people anchored the pattern by hand: `re.match(r"^\d+$", s)`. That *almost* works, but `$` has a quirk: it matches at the end of the string **and also just before a final newline**:

```python
import re

user_input = "123\n"

print(re.match(r"^\d+$", user_input))
print(re.fullmatch(r"\d+", user_input))
```

Output:

```text
<re.Match object; span=(0, 3), match='123'>
None
```

The `^...$` version accepts `"123\n"`, which is usually a bug in validation code. `fullmatch()` really requires the match to end at the last character. The equivalent anchored pattern is `\A(?:...)\Z`, where `\A` means "start of string" and `\Z` means "very end of string". (Python 3.14 also accepts `\z` as a synonym for `\Z`.)

## Alternation and `fullmatch()`

The regex engine tries alternatives from left to right and accepts the first one that works. With `match()` the short alternative can win too early:

```python
import re

print(re.match(r"cat|category", "category"))
print(re.fullmatch(r"cat|category", "category"))
```

Output:

```text
<re.Match object; span=(0, 3), match='cat'>
<re.Match object; span=(0, 8), match='category'>
```

`match()` stops after `cat` because it does not care what follows. `fullmatch()` sees that `cat` leaves characters unmatched, backtracks, and tries the next alternative, `category`, which covers the whole string.

`fullmatch()` also applies to the alternation **as a whole**. With hand-written anchors, `^cat|dog$` means "`^cat` or `dog$`", which is a common mistake. `re.fullmatch(r"cat|dog", s)` means "exactly `cat` or exactly `dog`".

## Flags

Flags work as with every other `re` function:

```python
import re

print(re.fullmatch(r"[a-z]+", "Hello"))
print(re.fullmatch(r"[a-z]+", "Hello", flags=re.IGNORECASE))
```

Output:

```text
None
<re.Match object; span=(0, 5), match='Hello'>
```

## Checking part of a string: `Pattern.fullmatch()`

A compiled pattern's `fullmatch()` method takes optional `pos` and `endpos` arguments. The pattern must then cover exactly the slice `string[pos:endpos]`:

```python
import re

number = re.compile(r"\d+")
record = "ID: 12345;"

print(number.fullmatch(record))
print(number.fullmatch(record, 4, 9))
```

Output:

```text
None
<re.Match object; span=(4, 9), match='12345'>
```

## Common mistakes

- **Using `match()` for validation.** `re.match(r"\d+", "123abc")` succeeds because only the beginning is checked. Use `fullmatch()`.
- **Relying on `^...$`.** `$` also matches before a trailing newline, so `"123\n"` slips through. Use `fullmatch()` or `\A...\Z`.
- **Writing `|` inside a character class.** `[A-Z|a-z]` also matches the `|` character. Write `[A-Za-z]`.
- **Calling `.group()` without checking for `None`.**

  ```python
  import re

  try:
      re.fullmatch(r"\d+", "abc").group()
  except AttributeError as e:
      print(e)
  ```

  Output:

  ```text
  'NoneType' object has no attribute 'group'
  ```

- **Forgetting that `\w` and `\d` are Unicode-aware.** `re.fullmatch(r"\w+", "Олег")` succeeds. If a field must contain only ASCII letters and digits, use explicit sets such as `[A-Za-z0-9_]` or pass `flags=re.ASCII`.

## Summary

- `re.fullmatch(pattern, string, flags=0)` returns a `Match` object only if the pattern matches the entire string, and `None` otherwise.
- It is the right tool for validation: postcodes, usernames, times, colour codes, IDs.
- `match()` anchors only the start, `search()` anchors nothing, `fullmatch()` anchors both ends.
- `^...$` is not equivalent: `$` also matches before a trailing newline.
- With `fullmatch()`, the engine backtracks through alternatives until one covers the whole string.
- Inside `[...]`, `|` is a literal character, not "or".
- `Pattern.fullmatch(string, pos, endpos)` checks a slice of the string.

## Practice

### Exercise 1: 24-hour time

Write `is_time(s)` that returns `True` for valid times in `HH:MM` 24-hour format (`00:00` to `23:59`) and `False` otherwise. Test it with `"09:30"`, `"23:59"`, `"24:00"`, `"7:05"`, `"12:60"` and `"12:30\n"`.

### Exercise 2: Username rules

A username must be 3 to 16 characters long, contain only ASCII letters, digits and underscores, and start with a letter. Write `is_username(s)` and test it with `"max_99"`, `"9lives"`, `"ab"`, `"Олег"` and `"a" * 17`.

### Exercise 3: Hex colours

Write `is_hex_color(s)` that accepts CSS hex colours in the short form `#RGB` and the long form `#RRGGBB`, with upper- or lower-case hex digits. `"#fff"`, `"#1A2b3C"` are valid. `"#ffff"`, `"fff"`, `"#12345g"` are not.

### Exercise 4: Predict the results

Without running it, predict which of the three functions finds a match for each string. Then run the code to check.

```python
import re

pattern = r"\d+"
for s in ["2024", "2024 year", "year 2024", "year"]:
    results = [
        name
        for name, func in [("match", re.match), ("search", re.search), ("fullmatch", re.fullmatch)]
        if func(pattern, s)
    ]
    print(f"{s!r:12} {results}")
```

## Solutions

### Exercise 1

```python
import re

TIME = re.compile(r"([01]\d|2[0-3]):[0-5]\d")


def is_time(s):
    return TIME.fullmatch(s) is not None


for s in ["09:30", "23:59", "24:00", "7:05", "12:60", "12:30\n"]:
    print(repr(s), is_time(s))
```

Output:

```text
'09:30' True
'23:59' True
'24:00' False
'7:05' False
'12:60' False
'12:30\n' False
```

The hour is either `0` or `1` followed by any digit (`00`–`19`), or `2` followed by `0`–`3` (`20`–`23`). The minutes start with `0`–`5`. Thanks to `fullmatch()`, the trailing newline in the last test is rejected.

### Exercise 2

```python
import re

USERNAME = re.compile(r"[A-Za-z][A-Za-z0-9_]{2,15}")


def is_username(s):
    return USERNAME.fullmatch(s) is not None


for s in ["max_99", "9lives", "ab", "Олег", "a" * 17]:
    print(repr(s), is_username(s))
```

Output:

```text
'max_99' True
'9lives' False
'ab' False
'Олег' False
'aaaaaaaaaaaaaaaaa' False
```

One leading letter plus 2 to 15 more characters gives a total length of 3 to 16. Explicit ASCII sets reject `"Олег"`, which `\w` would accept.

### Exercise 3

```python
import re

HEX_COLOR = re.compile(r"#(?:[0-9a-fA-F]{3}){1,2}")


def is_hex_color(s):
    return HEX_COLOR.fullmatch(s) is not None


for s in ["#fff", "#1A2b3C", "#ffff", "fff", "#12345g"]:
    print(repr(s), is_hex_color(s))
```

Output:

```text
'#fff' True
'#1A2b3C' True
'#ffff' False
'fff' False
'#12345g' False
```

`(?:[0-9a-fA-F]{3}){1,2}` means "three hex digits, once or twice", which allows exactly 3 or 6 digits. A four-digit value cannot be split that way, so `"#ffff"` is rejected.

### Exercise 4

```python
import re

pattern = r"\d+"
for s in ["2024", "2024 year", "year 2024", "year"]:
    results = [
        name
        for name, func in [("match", re.match), ("search", re.search), ("fullmatch", re.fullmatch)]
        if func(pattern, s)
    ]
    print(f"{s!r:12} {results}")
```

Output:

```text
'2024'       ['match', 'search', 'fullmatch']
'2024 year'  ['match', 'search']
'year 2024'  ['search']
'year'       []
```

- `"2024"`: the digits are the whole string, so all three succeed.
- `"2024 year"`: it starts with digits (`match`, `search`), but there is text after them (`fullmatch` fails).
- `"year 2024"`: the digits are not at the start, so only `search` finds them.
- `"year"`: there are no digits at all.

---

*Source: [pythontutorial.net — Python Regex fullmatch()](https://www.pythontutorial.net/python-regex/python-regex-fullmatch/). Adapted and expanded for PyJourney.*
