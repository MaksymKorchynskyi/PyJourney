# finditer()

`re.finditer()` finds every match of a pattern, just like `findall()`, but instead of a list of strings it gives you an **iterator of `Match` objects**. Each `Match` knows not only *what* matched, but also *where* it matched and what every group captured. Whenever you need positions, named groups, or want to process a huge text one match at a time, `finditer()` is the right tool.

## What you'll learn

- The signature of `re.finditer()` and what the iterator yields
- How to read text, positions and groups from each `Match` object
- Why the result is a one-shot, lazy iterator and what that means in practice
- How `finditer()` differs from `findall()`, especially with capturing groups
- How to build a small tokenizer with named groups and `Match.lastgroup`
- How to search part of a string with `Pattern.finditer(string, pos, endpos)`

## The signature

```python
re.finditer(pattern, string, flags=0)
```

- `pattern` is the regular expression (a raw string or a compiled `Pattern`).
- `string` is the text to search.
- `flags` is optional and defaults to `0`. It accepts one regex flag or several combined with `|`.

The function returns an **iterator**. Each step of the iteration produces the next non-overlapping match as a `Match` object, scanning the string from left to right. If there are no matches, the iterator is simply empty: it never returns `None`, so a `for` loop over it just runs zero times.

## A first example: all vowels

```python
import re

s = "Readability counts."
pattern = r"[aeiou]"

for match in re.finditer(pattern, s):
    print(match)
```

Output:

```text
<re.Match object; span=(1, 2), match='e'>
<re.Match object; span=(2, 3), match='a'>
<re.Match object; span=(4, 5), match='a'>
<re.Match object; span=(6, 7), match='i'>
<re.Match object; span=(8, 9), match='i'>
<re.Match object; span=(13, 14), match='o'>
<re.Match object; span=(14, 15), match='u'>
```

Printing a `Match` object shows its `span`, a `(start, end)` pair of indices, and the matched text. The end index is exclusive, just like in slicing: `s[1:2]` is `'e'`.

## What a `Match` object gives you

The real value of `finditer()` is the `Match` object. These are the members you will use most:

| Member | Returns |
|---|---|
| `m.group()` or `m.group(0)` or `m[0]` | the whole matched text |
| `m.group(n)` or `m[n]` | the text of group `n` (`None` if it did not take part) |
| `m.group("name")` or `m["name"]` | the text of a named group |
| `m.groups()` | a tuple with all groups |
| `m.groupdict()` | a dict of all named groups |
| `m.start()`, `m.end()`, `m.span()` | positions of the whole match |
| `m.start(n)`, `m.end(n)`, `m.span(n)` | positions of group `n` |

Here is a practical example. It extracts ISO dates from a log with named groups and reports where each date was found:

```python
import re

log = "Deploy 2024-03-15 ok; rollback 2024-03-17; deploy 2024-04-01 ok"
pattern = r"(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})"

for m in re.finditer(pattern, log):
    print(m[0], "at", m.span(), "->", m.groupdict())
```

Output:

```text
2024-03-15 at (7, 17) -> {'year': '2024', 'month': '03', 'day': '15'}
2024-03-17 at (31, 41) -> {'year': '2024', 'month': '03', 'day': '17'}
2024-04-01 at (50, 60) -> {'year': '2024', 'month': '04', 'day': '01'}
```

`findall()` with three groups would give you only `('2024', '03', '15')` tuples: no positions and no group names.

## A lazy, one-shot iterator

`finditer()` does not search the whole string up front. It finds the next match only when the loop asks for it. This has three consequences.

**1. You can stop early.** If you only need the first few matches, break out of the loop and the rest of the string is never scanned. For just the first match, `re.search()` is simpler, but `next()` with a default also works:

```python
import re

first = next(re.finditer(r"\d+", "no numbers"), None)
print(first)
```

Output:

```text
None
```

**2. It can be consumed only once.** After a full loop the iterator is exhausted, and a second loop prints nothing:

```python
import re

matches = re.finditer(r"\d+", "10 apples, 20 pears")

print([m[0] for m in matches])
print([m[0] for m in matches])
```

Output:

```text
['10', '20']
[]
```

If you need the matches several times, store them in a list: `matches = list(re.finditer(...))`.

**3. It has no length and no readable printout.** `len()` does not work on an iterator, and printing it shows only its type and address:

```python
import re

matches = re.finditer(r"\d+", "10 apples, 20 pears")
print(matches)  # output varies, e.g. <callable_iterator object at 0x102f953c0>

try:
    print(len(matches))
except TypeError as e:
    print(e)
```

Output (the address varies from run to run):

```text
<callable_iterator object at 0x102f953c0>
object of type 'callable_iterator' has no len()
```

To count matches, use `len(re.findall(...))` or `sum(1 for _ in re.finditer(...))`.

## `finditer()` vs `findall()`

Both find all non-overlapping matches from left to right. The difference is in what you get:

| | `findall()` | `finditer()` |
|---|---|---|
| Returns | a `list` | an iterator |
| Each item | `str`, or a `tuple` of `str` when there are 2+ groups | always a `Match` object |
| With one group | only that group's text | the full match **and** the group |
| Unmatched optional group | `''` | `None` |
| Positions | no | yes |
| Memory | all results at once | one match at a time |

The effect of groups is the most important difference. With `findall()`, adding a group changes the result type. With `finditer()`, nothing changes: you always receive a full `Match` and pick the parts you want.

```python
import re

s = "width=800 height=600"
pattern = r"(\w+)=(\d+)"

print(re.findall(pattern, s))

for m in re.finditer(pattern, s):
    print(m[0], "|", m[1], "|", m[2], "|", m.span())
```

Output:

```text
[('width', '800'), ('height', '600')]
width=800 | width | 800 | (0, 9)
height=600 | height | 600 | (10, 20)
```

**Rule of thumb:** use `findall()` when you only need the text, and `finditer()` when you need anything else.

## Using positions

Positions let you annotate the original text. For example, you can draw markers under every match:

```python
import re

text = "Call 555-1234 or 555-9876 today"
markers = [" "] * len(text)

for m in re.finditer(r"\d{3}-\d{4}", text):
    for i in range(m.start(), m.end()):
        markers[i] = "^"

print(text)
print("".join(markers).rstrip())
```

Output:

```text
Call 555-1234 or 555-9876 today
     ^^^^^^^^    ^^^^^^^^
```

## Example: a tiny tokenizer

A classic use of `finditer()` is splitting source code or a formula into **tokens**. Each kind of token gets a named group, all groups are joined with `|`, and `m.lastgroup` tells you which alternative matched:

```python
import re

TOKEN_SPEC = [
    ("NUMBER", r"\d+(?:\.\d+)?"),
    ("NAME", r"[A-Za-z_]\w*"),
    ("OP", r"[+\-*/=()]"),
    ("SKIP", r"\s+"),
    ("MISMATCH", r"."),
]
TOKEN_RE = re.compile("|".join(f"(?P<{name}>{regex})" for name, regex in TOKEN_SPEC))


def tokenize(code):
    for m in TOKEN_RE.finditer(code):
        kind = m.lastgroup
        if kind == "SKIP":
            continue
        if kind == "MISMATCH":
            raise SyntaxError(f"Unexpected {m[0]!r} at position {m.start()}")
        yield kind, m[0]


print(list(tokenize("price = 2.5 * (qty + 10)")))

try:
    list(tokenize("x = 3 $ 4"))
except SyntaxError as e:
    print(e)
```

Output:

```text
[('NAME', 'price'), ('OP', '='), ('NUMBER', '2.5'), ('OP', '*'), ('OP', '('), ('NAME', 'qty'), ('OP', '+'), ('NUMBER', '10'), ('OP', ')')]
Unexpected '$' at position 6
```

How it works:

- Alternatives are tried left to right, so `NUMBER` wins over `MISMATCH` for digits, and `MISMATCH` (any single character) catches everything else.
- `m.lastgroup` is the name of the last group that matched, which here is exactly the token kind.
- Because `tokenize()` is a generator over a lazy iterator, it can process large inputs without building big lists.

## Searching part of a string: `Pattern.finditer()`

A compiled pattern has its own `finditer()` that accepts optional `pos` and `endpos`. Positions in the resulting `Match` objects are still counted from the start of the **whole** string:

```python
import re

word = re.compile(r"\w+")
text = "one two three four"

for m in word.finditer(text, 4, 13):
    print(m[0], m.span())
```

Output:

```text
two (4, 7)
three (8, 13)
```

## Empty matches

If a pattern can match an empty string, `finditer()` yields those empty matches too. Their span has the same start and end:

```python
import re

for m in re.finditer(r"\d*", "a1"):
    print(m.span(), repr(m[0]))
```

Output:

```text
(0, 0) ''
(1, 2) '1'
(2, 2) ''
```

Use `+` instead of `*` when you want only real content.

## Common mistakes

- **Looping over the same iterator twice.** The second loop sees nothing. Convert to a list if you need the matches again.
- **Calling `len()` or printing the iterator.** An iterator has no length and does not show its contents. Use `list()`, or count with `sum(1 for _ in ...)`.
- **Asking for a group that does not exist.** `m.group(1)` on a pattern without groups raises `IndexError: no such group`.
- **Forgetting that unmatched groups are `None`.** With `findall()` an optional group that did not match is `''`, but `m.group(n)` returns `None`. Check before calling string methods on it.
- **Using `finditer()` just to collect strings.** `[m[0] for m in re.finditer(p, s)]` is the same as `re.findall(p, s)` for a pattern without groups. Pick the simpler one.

## Summary

- `re.finditer(pattern, string, flags=0)` returns a lazy iterator of `Match` objects for all non-overlapping matches.
- No matches means an empty iterator, never `None`.
- Each `Match` provides the matched text, all groups (by number or name) and their positions.
- Unlike `findall()`, groups do not change what you get: you always receive a complete `Match`.
- The iterator can be consumed only once and has no `len()`.
- Named groups plus `m.lastgroup` make `finditer()` a simple tokenizer.
- `Pattern.finditer(string, pos, endpos)` searches a slice, but reports positions relative to the whole string.

## Practice

### Exercise 1: Numbers and their positions

For the string `"Order 66 shipped 3 boxes, 120 kg total"`, print every whole number together with its start and end index, one per line, like `66 6 8`.

### Exercise 2: Capitalised words

Write `capitalised(text)` that returns a list of `(word, start)` tuples for every word that starts with an upper-case ASCII letter. Test it with `"Alice met Bob in Paris last May"`.

### Exercise 3: Records to dictionaries

Turn the string below into a list of dictionaries `[{'user': 'ann', 'age': 31}, ...]` with `age` converted to `int`. Use named groups and `groupdict()`.

```python
data = "user=ann age=31; user=bob age=27; user=eve age=45"
```

### Exercise 4: Highlight without `sub()`

Write `highlight(text, pattern)` that wraps every match in square brackets, using only `finditer()`, positions and slicing (no `re.sub()`). For example, `highlight("Call 555-1234 or 555-9876", r"\d{3}-\d{4}")` must return `"Call [555-1234] or [555-9876]"`.

## Solutions

### Exercise 1

```python
import re

text = "Order 66 shipped 3 boxes, 120 kg total"
for m in re.finditer(r"\d+", text):
    print(m[0], m.start(), m.end())
```

Output:

```text
66 6 8
3 17 18
120 26 29
```

### Exercise 2

```python
import re


def capitalised(text):
    return [(m[0], m.start()) for m in re.finditer(r"\b[A-Z]\w*", text)]


print(capitalised("Alice met Bob in Paris last May"))
```

Output:

```text
[('Alice', 0), ('Bob', 10), ('Paris', 17), ('May', 28)]
```

### Exercise 3

```python
import re

data = "user=ann age=31; user=bob age=27; user=eve age=45"
pattern = r"user=(?P<user>\w+) age=(?P<age>\d+)"

records = []
for m in re.finditer(pattern, data):
    record = m.groupdict()
    record["age"] = int(record["age"])
    records.append(record)

print(records)
```

Output:

```text
[{'user': 'ann', 'age': 31}, {'user': 'bob', 'age': 27}, {'user': 'eve', 'age': 45}]
```

### Exercise 4

```python
import re


def highlight(text, pattern):
    parts = []
    last_end = 0
    for m in re.finditer(pattern, text):
        parts.append(text[last_end:m.start()])
        parts.append(f"[{m[0]}]")
        last_end = m.end()
    parts.append(text[last_end:])
    return "".join(parts)


print(highlight("Call 555-1234 or 555-9876", r"\d{3}-\d{4}"))
print(highlight("no phone numbers here", r"\d{3}-\d{4}"))
```

Output:

```text
Call [555-1234] or [555-9876]
no phone numbers here
```

The function copies the text between matches unchanged and wraps each match. This is essentially what `re.sub()` does internally, and it is useful when the replacement depends on surrounding text or positions.

---

*Source: [pythontutorial.net — Python Regex finditer()](https://www.pythontutorial.net/python-regex/python-regex-finditer/). Adapted and expanded for PyJourney.*
