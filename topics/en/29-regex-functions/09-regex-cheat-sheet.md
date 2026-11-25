# Regex Cheat Sheet

This page collects everything the regular expression topics teach into compact tables you can scan while writing a pattern: character classes, sets, anchors, quantifiers, groups, look-around, the `re` functions, the `Match` object and flags. Each table links the syntax to its meaning in Python 3, including the details that many cheat sheets get wrong. The topics themselves explain the "why" in depth.

## What you'll learn

- The whole regex syntax of Python's `re` module, organised into short reference tables
- Which `re` function to use for which task, and what each one returns
- The most useful `Match` methods, replacement escapes and flags
- The pitfalls behind the most common regex bugs
- How the pieces work together in complete, tested examples

## Writing patterns in Python

Always write patterns as **raw strings** (`r"..."`). In a normal string Python processes backslash escapes first, so `"\b"` becomes a backspace character before the regex engine ever sees it:

```python
import re

print(len("\b"), len(r"\b"))
print(re.findall("\bcat\b", "cat concat"))
print(re.findall(r"\bcat\b", "cat concat"))

user_input = "1+1=2?"
print(re.escape(user_input))
print(re.findall(re.escape(user_input), "Is 1+1=2? Yes, 1+1=2?"))
```

Output:

```text
1 2
[]
['cat']
1\+1=2\?
['1+1=2?', '1+1=2?']
```

The **metacharacters** are `. ^ $ * + ? { } [ ] \ | ( )`. Escape them with a backslash (`\.`, `\$`, `\(`) to match them literally, or pass text that comes from users or files through `re.escape()`.

## Character classes

Each class matches **exactly one** character. See the topic Character Set.

| Pattern | Matches one... | Opposite |
|---|---|---|
| `.` | character except a newline (any character with `re.DOTALL`) | |
| `\d` | decimal digit | `\D` |
| `\w` | word character: letter, digit or `_` | `\W` |
| `\s` | whitespace: space, `\t`, `\n`, `\r`, `\f`, `\v` and Unicode spaces | `\S` |
| `\.` `\\` `\$` | literal dot, backslash, dollar sign (any metacharacter) | |
| `\n` `\t` | newline, tab | |

In Python 3, `str` patterns are **Unicode-aware**: `\w` matches `é`, `ї` and `Ж`, and `\d` matches digits from other scripts such as `٣`. With `re.ASCII` the classes shrink to `\d` = `[0-9]`, `\w` = `[a-zA-Z0-9_]` and `\s` = `[ \t\n\r\f\v]`.

## Sets and ranges

A set in square brackets also matches **one** character. See the topic Sets & Ranges.

| Pattern | Matches one... |
|---|---|
| `[abc]` | `a`, `b` or `c` |
| `[a-z]` | character in the range `a` to `z` (by code point) |
| `[a-zA-Z0-9_]` | character from several ranges and single characters |
| `[^abc]` | character that is **not** `a`, `b` or `c` (including `\n`) |
| `[\d\s]` | digit or whitespace (classes are allowed inside sets) |
| `[.?!*]` | literal `.`, `?`, `!` or `*` (most metacharacters are literal inside a set) |
| `[-a]`, `[a-]`, `[a\-z]` | literal hyphen (first, last or escaped) |
| `[\]\\^]` | literal `]`, `\` or `^` (escape them) |
| `[^\W\d_]` | letter of any alphabet |

The caret negates only directly after `[`. `^[abc]` is a different thing: an anchor followed by a set.

## Anchors and boundaries

Anchors match **positions** and consume no characters. See the topics Anchors and Word Boundary.

| Pattern | Matches at | Notes |
|---|---|---|
| `^` | the start of the string | every line start with `re.MULTILINE` |
| `$` | the end of the string, **or just before a final `\n`** | every line end with `re.MULTILINE` |
| `\A` | the very start of the string | not affected by `re.MULTILINE` |
| `\Z` | the very end of the string | `\z` is an alias since Python 3.14 |
| `\b` | a word boundary: `\w` on one side, `\W` or the string edge on the other | |
| `\B` | any position that is not a word boundary | |

For whole-string validation prefer `re.fullmatch()` to `^...$`.

## Quantifiers

A quantifier repeats the single element before it: a character, a class, a set or a group. See the topics Quantifiers, Greedy Quantifiers and Non-Greedy Quantifiers.

| Greedy | Lazy | Possessive (3.11+) | Repetitions |
|---|---|---|---|
| `*` | `*?` | `*+` | 0 or more |
| `+` | `+?` | `++` | 1 or more |
| `?` | `??` | `?+` | 0 or 1 |
| `{n}` | `{n}?` | `{n}+` | exactly `n` |
| `{n,}` | `{n,}?` | `{n,}+` | at least `n` |
| `{,m}` | `{,m}?` | `{,m}+` | 0 to `m` |
| `{n,m}` | `{n,m}?` | `{n,m}+` | `n` to `m` |

- **Greedy** (default) takes as much as possible and gives back characters while the rest of the pattern fails.
- **Lazy** takes as little as possible and adds characters while the rest of the pattern fails.
- **Possessive** takes as much as possible and never gives back.
- No spaces inside braces: `{2,3}`, not `{2, 3}`.
- To repeat a sequence, group it: `(?:ab)+`, not `ab+`.

## Groups and backreferences

See the topics Capturing Groups, Non-capturing Groups and Backreferences.

| Pattern | Meaning |
|---|---|
| `(X)` | capturing group, numbered by its opening parenthesis from 1 |
| `(?P<name>X)` | named capturing group |
| `(?:X)` | group without capturing (for quantifiers and alternation) |
| `(?>X)` | atomic group: never backtracks into `X` (3.11+) |
| `(?i:X)`, `(?-i:X)` | turn a flag on or off only inside `X` |

Backreferences are written differently in a pattern and in a replacement string:

| Where | By number | By name | Whole match |
|---|---|---|---|
| inside the pattern | `\1` | `(?P=name)` | (not available) |
| in the `repl` of `sub()` | `\1` or `\g<1>` | `\g<name>` | `\g<0>` |

`\g<...>` is valid **only** in replacement strings. In a pattern it raises `re.PatternError: bad escape \g`.

## Alternation

See the topic Alternation.

| Pattern | Meaning |
|---|---|
| `X\|Y` | `X` or `Y` |
| `^(?:cat\|dog)$` | the whole string is `cat` or `dog` |
| `^cat\|dog$` | `cat` at the start **or** `dog` at the end (`\|` has the lowest precedence) |
| `gr[ae]y` | prefer a set over `gr(?:a\|e)y` for single characters |

Alternatives are tried left to right, and the first one that leads to an overall match wins, not the longest one. Spaces around `|` are literal: `cat | dog` means `"cat "` or `" dog"`.

## Look-around

Look-around assertions check the text around a position without consuming it. See the topics Lookahead and Lookbehind.

| Pattern | Matches `X` only if... |
|---|---|
| `X(?=Y)` | `Y` follows (positive lookahead) |
| `X(?!Y)` | `Y` does not follow (negative lookahead) |
| `(?<=Y)X` | `Y` precedes (positive lookbehind) |
| `(?<!Y)X` | `Y` does not precede (negative lookbehind) |

- The text matched by `Y` is not part of the match.
- In `re`, a lookbehind must have a **fixed width**: `(?<=\d+)` raises `look-behind requires fixed-width pattern`.
- Several lookaheads at one position act like AND: `(?=.*\d)(?=.*[A-Z])`.

## Functions of the `re` module

| Function | Returns | Use it to |
|---|---|---|
| `re.search(p, s)` | first `Match` anywhere, or `None` | find whether and where the pattern occurs |
| `re.match(p, s)` | `Match` at the start of `s`, or `None` | parse a prefix |
| `re.fullmatch(p, s)` | `Match` if all of `s` fits, or `None` | validate input |
| `re.findall(p, s)` | list of strings or tuples (`[]` if none, never `None`) | collect all matches |
| `re.finditer(p, s)` | iterator of `Match` objects | all matches with positions and groups |
| `re.sub(p, repl, s, count=0)` | new string | replace (`repl` can be a function) |
| `re.subn(p, repl, s, count=0)` | `(new_string, number_of_replacements)` | replace and count |
| `re.split(p, s, maxsplit=0)` | list of strings | split on a pattern |
| `re.compile(p, flags)` | `Pattern` object with the same methods | reuse a pattern, search with `pos`/`endpos` |
| `re.escape(text)` | string with metacharacters escaped | insert literal text into a pattern |

The shape of a `findall()` result depends on the groups: no groups gives whole matches, one group gives that group's text, several groups give tuples. `split()` with a capturing group keeps the separators in the result. Pass `count`, `maxsplit` and `flags` **by keyword**: passing them positionally is deprecated since Python 3.13.

One input, every function:

```python
import re

text = "Order 66 shipped on 2024-05-17, order 7 pending"

print(re.search(r"\d+", text))
print(re.match(r"\d+", text))
print(re.fullmatch(r"[\w\s,-]+", text) is not None)
print(re.findall(r"\d+", text))
print([m.span() for m in re.finditer(r"\d+", text)])
print(re.sub(r"\d", "#", text, count=2))
print(re.subn(r"\d", "#", text))
print(re.split(r",\s*", text))
```

Output:

```text
<re.Match object; span=(6, 8), match='66'>
None
True
['66', '2024', '05', '17', '7']
[(6, 8), (20, 24), (25, 27), (28, 30), (38, 39)]
Order ## shipped on 2024-05-17, order 7 pending
('Order ## shipped on ####-##-##, order # pending', 11)
['Order 66 shipped on 2024-05-17', 'order 7 pending']
```

## The `Match` object

| Expression | Gives |
|---|---|
| `m.group()`, `m.group(0)`, `m[0]` | the whole match |
| `m.group(1)`, `m[1]`, `m["name"]` | one group (`None` if it did not take part) |
| `m.group(1, 2)` | a tuple of several groups |
| `m.groups()` | a tuple of all groups |
| `m.groupdict()` | a dict of all named groups |
| `m.start()`, `m.end()`, `m.span()` | positions of the match (`end` is exclusive); pass a group to get its positions |
| `m.lastgroup` | the name of the last matched group (handy for tokenizers) |

A failed search returns `None`, so check before using the result:

```python
import re

m = re.search(r"(?P<year>\d{4})-(?P<month>\d\d)-(?P<day>\d\d)", "Released on 2024-05-17.")

if m:
    print(m.group())
    print(m.group(1), m["month"], m.group("day"))
    print(m.groups())
    print(m.groupdict())
    print(m.start(), m.end(), m.span("month"))
```

Output:

```text
2024-05-17
2024 05 17
('2024', '05', '17')
{'year': '2024', 'month': '05', 'day': '17'}
12 22 (17, 19)
```

## Flags

See the topic Regex Flags for every detail.

| Flag | Short | Inline | Effect |
|---|---|---|---|
| `re.IGNORECASE` | `re.I` | `(?i)` | ignore letter case |
| `re.MULTILINE` | `re.M` | `(?m)` | `^` and `$` match at every line |
| `re.DOTALL` | `re.S` | `(?s)` | `.` also matches `\n` |
| `re.VERBOSE` | `re.X` | `(?x)` | ignore whitespace in the pattern, allow `#` comments |
| `re.ASCII` | `re.A` | `(?a)` | `\w`, `\d`, `\s`, `\b` and their opposites match ASCII only (for `str` patterns) |
| `re.LOCALE` | `re.L` | `(?L)` | locale-dependent matching, `bytes` patterns only, discouraged |
| `re.UNICODE` | `re.U` | `(?u)` | Unicode matching, already the default for `str` |
| `re.DEBUG` | | | print the parsed pattern |
| `re.NOFLAG` | | | the value `0`, "no flags" (3.11+) |

- Combine flags with `|`: `re.I | re.M`.
- Global inline flags such as `(?im)` must be at the very start of the pattern. Elsewhere they raise `global flags not at the start of the expression`.
- Scoped flags `(?i:...)` apply only inside their group.

## Putting it together

### A log parser with `re.VERBOSE` and named groups

```python
import re

LOG_LINE = re.compile(r"""
    (?P<date>\d{4}-\d\d-\d\d)  # 2024-05-17
    \s+
    (?P<level>[A-Z]+)          # INFO, ERROR, ...
    \s+
    \[(?P<module>\w+)\]        # [db]
    \s+
    (?P<message>.+)            # the rest of the line
""", re.VERBOSE)

log = """2024-05-17 INFO [web] Server started
garbage line
2024-05-17 ERROR [db] Connection lost"""

for line in log.splitlines():
    m = LOG_LINE.fullmatch(line)
    if m:
        print(m.groupdict())
```

Output:

```text
{'date': '2024-05-17', 'level': 'INFO', 'module': 'web', 'message': 'Server started'}
{'date': '2024-05-17', 'level': 'ERROR', 'module': 'db', 'message': 'Connection lost'}
```

### Password rules with lookaheads

At least 8 non-space characters, with a lowercase letter, an uppercase letter and a digit somewhere:

```python
import re

STRONG = re.compile(r"(?=.*[a-z])(?=.*[A-Z])(?=.*\d)\S{8,}")

for password in ["secret", "Secret123", "secret123", "Secret 123"]:
    print(password, bool(STRONG.fullmatch(password)))
```

Output:

```text
secret False
Secret123 True
secret123 False
Secret 123 False
```

### Reformatting dates with `sub()` and backreferences

```python
import re

text = "Due 17.05.2024, paid 03.06.2024, ref 117.05.20245"

print(re.sub(r"\b(\d\d)\.(\d\d)\.(\d{4})\b", r"\3-\2-\1", text))
```

Output:

```text
Due 2024-05-17, paid 2024-06-03, ref 117.05.20245
```

The word boundaries `\b` keep the pattern from matching inside the longer number `117.05.20245`.

## Common mistakes

- **Forgetting the `r` prefix.** `"\bword\b"` contains backspace characters and silently matches nothing.
- **Unescaped metacharacters.** `3.14` also matches `3x14`. Write `3\.14`, or use `re.escape()` for literal text.
- **`^[abc]` instead of `[^abc]`.** The first is "a, b or c at the start", the second is "one character other than a, b, c".
- **Ranges as numbers.** `[1-31]` is the set of the characters `1`, `2`, `3`.
- **Spaces around `|`.** `cat | dog` contains literal spaces.
- **`\g<1>` in a pattern.** Inside a pattern use `\1` or `(?P=name)`. `\g<...>` belongs to replacement strings.
- **Expecting `findall()` to return `None`.** It returns `[]`. Only `search()`, `match()` and `fullmatch()` return `None`.
- **Groups changing `findall()` results.** Adding a group changes the output from whole matches to group texts. Use `(?:...)` or `finditer()`.
- **`^...$` for validation.** `$` also matches before a trailing newline. Use `fullmatch()`.
- **Greedy `.*` between delimiters.** `".*"` runs to the last quote. Use `"[^"]*"` or `".*?"`.
- **Variable-width lookbehind.** `(?<=\d+)` is an error in `re`. Use a fixed width or a group.
- **Positional `count`/`flags`.** `re.sub(p, r, s, re.I)` passes `re.I` as `count`. Always write `flags=re.I`.

## Summary

- Write patterns as raw strings and escape metacharacters, or use `re.escape()` for literal text.
- Classes (`\d`, `\w`, `\s`, `.`) and sets (`[...]`, `[^...]`) match one character. In Python 3 the classes are Unicode-aware.
- Anchors (`^`, `$`, `\A`, `\Z`, `\b`, `\B`) and look-around (`(?=)`, `(?!)`, `(?<=)`, `(?<!)`) match positions.
- Quantifiers are greedy by default, lazy with `?` and possessive with `+` (3.11+).
- `(X)` captures, `(?P<name>X)` names, `(?:X)` only groups. Backreferences are `\1`/`(?P=name)` in patterns and `\1`/`\g<name>`/`\g<0>` in replacements.
- `search()` finds, `match()` checks the start, `fullmatch()` validates, `findall()`/`finditer()` collect, `sub()` replaces, `split()` splits.
- Flags: `I`, `M`, `S`, `X`, `A`. Combine with `|`, pass by keyword, inline at the start or scoped with `(?i:...)`.

## Practice

### Exercise 1: Fix the broken patterns

Each line below has a bug. Run it, explain what goes wrong and fix it:

```python
import re

print(re.findall(r"^[0-9]", "a1b2"))
print(re.fullmatch(r"cat | dog", "dog"))
try:
    re.findall(r"(\w)\g<1>", "bookkeeper")
except re.PatternError as error:
    print("PatternError:", error)
```

1. The first line should return all characters that are **not** digits.
2. The second should accept the string `"dog"`.
3. The third should find the doubled letters in `"bookkeeper"`: `oo`, `kk`, `ee`.

### Exercise 2: Pick the right tool

Write one call for each task and choose the most suitable function:

1. Does `"write to admin@example.com"` contain an `@`?
2. Is `"23:59"` a valid 24-hour time `HH:MM`? Check that `"24:00"` is rejected.
3. List all hashtags (`#` followed by word characters) in `"Learning #Python and #regex_101 today #"`.
4. Split `"red, green;blue ;  white"` on commas and semicolons, ignoring spaces around them.

### Exercise 3: Weather report

Turn the report below into the dict `{'Kyiv': 3, 'Lviv': -1, 'Odesa': 7}`. Use named groups and `finditer()`. Cities may be written in any alphabet, and the entry without a number must be skipped.

```python
report = "Kyiv: +3°C, Lviv: -1°C, Odesa: +7°C, Rivne: n/a"
```

### Exercise 4: Prices in hryvnias

In `"Total: 1250 UAH, discount 50 UAH, code UAH100, 99 USD"`:

1. Find the numbers that are followed by ` UAH`, without including ` UAH` in the result.
2. Replace every `<number> UAH` with `₴<number>`. `UAH100` and `99 USD` must stay unchanged.

## Solutions

### Exercise 1

Output of the broken code:

```text
[]
None
PatternError: bad escape \g at position 4
```

```python
import re

print(re.findall(r"[^0-9]", "a1b2"))
print(re.fullmatch(r"cat|dog", "dog"))
print(re.findall(r"(\w)\1", "bookkeeper"))
print([m.group() for m in re.finditer(r"(\w)\1", "bookkeeper")])
```

Output:

```text
['a', 'b']
<re.Match object; span=(0, 3), match='dog'>
['o', 'k', 'e']
['oo', 'kk', 'ee']
```

1. `^[0-9]` means "a digit at the start of the string". The negation caret belongs **inside** the brackets: `[^0-9]`.
2. The spaces around `|` are part of the alternatives, so the pattern accepts only `"cat "` or `" dog"`.
3. `\g<1>` is replacement syntax. In a pattern the backreference is `\1`. Because the pattern has a group, `findall()` returns only the group's text, so use `finditer()` to get the whole doubled letters.

### Exercise 2

```python
import re

print(bool(re.search(r"@", "write to admin@example.com")))
print(bool(re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", "23:59")))
print(bool(re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", "24:00")))
print(re.findall(r"#\w+", "Learning #Python and #regex_101 today #"))
print(re.split(r"\s*[,;]\s*", "red, green;blue ;  white"))
```

Output:

```text
True
True
False
['#Python', '#regex_101']
['red', 'green', 'blue', 'white']
```

- "Does it contain" is a job for `search()`. For a single fixed character, `"@" in text` would be even simpler.
- Validation of the whole string is a job for `fullmatch()`. Hours need alternation, because the second digit depends on the first.
- `findall()` without groups returns whole matches. The lone `#` at the end is skipped, because `\w+` needs at least one character.
- The `\s*` on both sides of the set swallows the spaces around each separator.

### Exercise 3

```python
import re

report = "Kyiv: +3°C, Lviv: -1°C, Odesa: +7°C, Rivne: n/a"

pattern = re.compile(r"(?P<city>[^\W\d_]+):\s*(?P<temp>[+-]?\d+)°C")
temps = {m["city"]: int(m["temp"]) for m in pattern.finditer(report)}

print(temps)
```

Output:

```text
{'Kyiv': 3, 'Lviv': -1, 'Odesa': 7}
```

`[^\W\d_]+` matches letters of any alphabet, so `Київ` would work as well. `[+-]?` makes the sign optional, and `int()` accepts both `+3` and `-1`. `Rivne: n/a` has no digits, so the pattern simply does not match there.

### Exercise 4

```python
import re

prices = "Total: 1250 UAH, discount 50 UAH, code UAH100, 99 USD"

print(re.findall(r"\b\d+(?= UAH\b)", prices))
print(re.sub(r"\b(\d+) UAH\b", r"₴\1", prices))
```

Output:

```text
['1250', '50']
Total: ₴1250, discount ₴50, code UAH100, 99 USD
```

The lookahead `(?= UAH\b)` checks the currency without consuming it, so only the digits are returned. In the replacement, the group `(\d+)` keeps the number and `\1` puts it back after the hryvnia sign. `UAH100` does not match because no number precedes `UAH` there.

---

*Source: [pythontutorial.net — Python Regex Cheat Sheet](https://www.pythontutorial.net/python-regex/python-regex-cheat-sheet/). Adapted and expanded for PyJourney.*
