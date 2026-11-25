# Non-capturing Groups

Parentheses in a regex both **group** and **capture**. Often you need only the grouping, for example to apply a quantifier to several characters or to limit an alternation, and the capture just gets in the way. A **non-capturing group** `(?:...)` groups without capturing, which keeps group numbers clean and stops functions such as `findall()` and `split()` from returning things you did not ask for.

## What you'll learn

- The syntax of a non-capturing group, `(?:X)`, and how it differs from `(X)`
- The real reasons to use it: quantifiers, alternation, `findall()`, `split()` and stable group numbers
- How to mix capturing, named and non-capturing groups in one pattern
- How to apply flags to part of a pattern with `(?i:...)`
- The family of `(?...)` constructs and where each one is covered

## Two kinds of groups

Regular expressions have two kinds of groups:

- **capturing groups** `(X)`: group `X` and remember the text it matched, so you can read it with `group()` or reuse it with a backreference;
- **non-capturing groups** `(?:X)`: group `X` but remember nothing.

The `?:` right after the opening parenthesis is what turns capturing off. To the engine both groups match exactly the same text. The only difference is whether a numbered slot is created in the `Match` object.

## A first example

This pattern captures the major and minor parts of a Python version:

```python
import re

s = "Python 3.10"
match = re.search(r"(\d+)\.(\d+)", s)

# show the whole match
print(match.group())

# show the groups
for group in match.groups():
    print(group)
```

Output:

```text
3.10
3
10
```

The pattern has two capturing groups, one before the literal `.` (escaped as `\.`) and one after it. If you do not need the major version, make the first group non-capturing:

```python
import re

s = "Python 3.10"
match = re.search(r"(?:\d+)\.(\d+)", s)

print(match.group())
print(match.groups())
```

Output:

```text
3.10
('10',)
```

The whole match is unchanged, but now there is only one group, and the minor version is group 1.

In this particular case the parentheses are not needed at all, because `\d+` is a single unit already. `r"\d+\.(\d+)"` behaves exactly the same:

```python
import re

match = re.search(r"\d+\.(\d+)", "Python 3.10")
print(match.group(), match.groups())
```

Output:

```text
3.10 ('10',)
```

So when *do* you need a non-capturing group? Whenever you need parentheses for **structure** but not for **extraction**.

## Why use non-capturing groups

### 1. To apply a quantifier to more than one character

A quantifier applies to the single item right before it. `ab+` means "`a`, then one or more `b`". To repeat the sequence `ab`, group it:

```python
import re

print(re.fullmatch(r"ab+", "ababab"))
print(re.fullmatch(r"(?:ab)+", "ababab"))
```

Output:

```text
None
<re.Match object; span=(0, 6), match='ababab'>
```

### 2. To limit an alternation

`|` splits the whole pattern unless it is inside a group (see the topic on alternation). A non-capturing group limits the alternatives without adding a group:

```python
import re

css = "width: 100px; margin: 2em; height: 50%; z: 3"

print(re.findall(r"\d+(px|em|%)", css))
print(re.findall(r"\d+(?:px|em|%)", css))
```

Output:

```text
['px', 'em', '%']
['100px', '2em', '50%']
```

### 3. To get whole matches from `findall()`

As the second example shows, `re.findall()` returns the captured groups whenever the pattern has any. A group added only for structure silently changes the result. The classic case is an IPv4 address:

```python
import re

log = "from 192.168.1.10 to 10.0.0.255"

print(re.findall(r"(\d{1,3}\.){3}\d{1,3}", log))
print(re.findall(r"(?:\d{1,3}\.){3}\d{1,3}", log))
```

Output:

```text
['1.', '0.']
['192.168.1.10', '10.0.0.255']
```

With a capturing group `findall()` returns only the last repetition of the group (`'1.'` and `'0.'`). With `(?:...)` it returns the full addresses.

### 4. To keep separators out of `re.split()`

If the separator pattern of `re.split()` contains capturing groups, the captured separators are inserted into the result list:

```python
import re

print(re.split(r"(,|;)", "a,b;c"))
print(re.split(r"(?:,|;)", "a,b;c"))
```

Output:

```text
['a', ',', 'b', ';', 'c']
['a', 'b', 'c']
```

Sometimes keeping separators is exactly what you want. When it is not, use `(?:...)` (or a character class, `[,;]`, for single characters).

### 5. To keep group numbers meaningful

Every capturing group gets a number, so structural groups push the interesting ones further along. Mixing named groups for the data with non-capturing groups for the structure keeps patterns readable:

```python
import re

pattern = r"(?:(?P<scheme>https?)://)?(?P<host>[\w.-]+)"

for url in ["https://example.com/path", "example.com/path"]:
    match = re.search(pattern, url)
    print(match.groups(), match.groupdict())
```

Output:

```text
('https', 'example.com') {'scheme': 'https', 'host': 'example.com'}
(None, 'example.com') {'scheme': None, 'host': 'example.com'}
```

The optional part `scheme://` needs a group for the `?`, but only the scheme itself is data. The pattern has exactly two groups, both named.

### What about speed and memory?

A non-capturing group saves the engine from recording where the group started and ended, so it can be slightly faster. In practice the difference is small (a few percent on typical patterns) and is rarely a good reason on its own. Choose `(?:...)` mainly because it says what you mean: "group, don't capture".

## Flags for part of a pattern: `(?i:...)`

The `?:` syntax can carry inline flags that apply only inside the group. `(?i:...)` makes just that part case-insensitive:

```python
import re

text = "HELLO world HELLO WORLD hello world"
print(re.findall(r"(?i:hello) world", text))
```

Output:

```text
['HELLO world', 'hello world']
```

`hello` may have any case, but `world` must be lowercase. The most useful letters here are `i` (ignore case), `m` (multiline), `s` (dot matches newline) and `x` (verbose), and a minus sign turns a flag off inside the group: in `(?i)HELLO (?-i:world)` everything is case-insensitive except `world`.

## The `(?...)` family

`(?:...)` is one member of a family of constructs that start with `(?`. Only the named group creates a numbered group:

| Syntax | Meaning | Captures? |
|---|---|---|
| `(?:...)` | non-capturing group | no |
| `(?P<name>...)` | named capturing group | yes |
| `(?P=name)` | backreference to a named group | no |
| `(?i:...)` | group with inline flags | no |
| `(?=...)`, `(?!...)` | lookahead, negative lookahead | no |
| `(?<=...)`, `(?<!...)` | lookbehind, negative lookbehind | no |
| `(?>...)` | atomic group (Python 3.11+) | no |
| `(?#...)` | comment, ignored | no |

Lookahead and lookbehind are the subject of the next topics.

## Common mistakes

- **Using capturing groups "just to group" and then calling `findall()` or `split()`.** You get groups or separators instead of what you expected. Use `(?:...)`.
- **Expecting a non-capturing group to be accessible.** `(?:\d+)` has no number. `re.search(r"(?:\d+)", "42").group(1)` raises `IndexError: no such group`.
- **Writing `(:?...)` instead of `(?:...)`.** `(:?\d+)` is a *capturing* group that starts with an optional colon. The `?` must come first.
- **Adding parentheses where none are needed.** `(?:\d+)\.(\d+)` and `\d+\.(\d+)` are identical. Group only when a quantifier, an alternation or a flag needs it.
- **Choosing `(?:...)` only for speed.** The speed-up is minor. Clarity and correct results from `findall()` and `split()` are the real benefits.

## Summary

- `(X)` groups and captures, `(?:X)` only groups. Both match the same text.
- Non-capturing groups do not get a number and do not appear in `groups()`, `groupdict()`, `findall()` or `split()` results.
- Use them to apply a quantifier to a sequence (`(?:ab)+`) and to limit an alternation (`\d+(?:px|em)`).
- Prefer `(?:...)` for structure and (named) capturing groups for data. This keeps group numbers meaningful.
- `(?i:...)` and similar forms apply flags to only part of a pattern.
- Any performance gain is small. The main benefit is clarity.

## Practice

### Exercise 1: Fix the IP finder

This code should print the full IP addresses, but it does not. Fix it by changing only the pattern.

```python
import re

log = "Blocked 203.0.113.5, allowed 198.51.100.23 and 192.0.2.1"
print(re.findall(r"(\d{1,3}\.){3}\d{1,3}", log))
```

### Exercise 2: Laughter detector

Find every "laugh" in `"Haha, that was funny. hahaha! ha"`: a whole word made of one or more `ha` syllables in any case. The expected result is `['Haha', 'hahaha', 'ha']`. Note that `that` must not count.

### Exercise 3: Version numbers

Write `parse_version(text)` that returns a tuple of integers `(major, minor, patch)` from strings such as `"Python 3.12.1"` and `"Python 3.10"`. The patch number is optional: use `0` when it is missing. Use exactly three groups.

### Exercise 4: Split a shopping list

Split `"apples, pears; plums and cherries"` into `['apples', 'pears', 'plums', 'cherries']` with one `re.split()` call. The separators are a comma, a semicolon or the word `and`, with any surrounding spaces.

## Solutions

### Exercise 1

```python
import re

log = "Blocked 203.0.113.5, allowed 198.51.100.23 and 192.0.2.1"
print(re.findall(r"(?:\d{1,3}\.){3}\d{1,3}", log))
```

Output:

```text
['203.0.113.5', '198.51.100.23', '192.0.2.1']
```

The original printed `['113.', '100.', '2.']`: the last repetition of the capturing group for each address.

### Exercise 2

```python
import re

text = "Haha, that was funny. hahaha! ha"

print(re.findall(r"(?:ha)+", text, flags=re.IGNORECASE))
print(re.findall(r"\b(?:ha)+\b", text, flags=re.IGNORECASE))
```

Output:

```text
['Haha', 'ha', 'hahaha', 'ha']
['Haha', 'hahaha', 'ha']
```

Without word boundaries the `ha` inside `that` is found too. With a capturing group `(ha)+`, `findall()` would return `['ha', 'ha', 'ha']`, the last syllable of each laugh.

### Exercise 3

```python
import re


def parse_version(text):
    match = re.search(r"(\d+)\.(\d+)(?:\.(\d+))?", text)
    if match is None:
        return None
    return tuple(int(part) for part in match.groups(default="0"))


print(parse_version("Python 3.12.1"))
print(parse_version("Python 3.10"))
print(parse_version("no version here"))
```

Output:

```text
(3, 12, 1)
(3, 10, 0)
None
```

The optional `.patch` part needs a group for the `?`, but the dot is not data, so the outer group is non-capturing and only the number inside it is captured. `groups(default="0")` fills in the missing patch.

### Exercise 4

```python
import re

items = re.split(r"\s*(?:,|;|\band\b)\s*", "apples, pears; plums and cherries")
print(items)
```

Output:

```text
['apples', 'pears', 'plums', 'cherries']
```

With a capturing group `(,|;|\band\b)`, the separators `','`, `';'` and `'and'` would appear in the list between the items.

---

*Source: [pythontutorial.net — Python Regex Non-capturing Group](https://www.pythontutorial.net/python-regex/python-regex-non-capturing-group/). Adapted and expanded for PyJourney.*
