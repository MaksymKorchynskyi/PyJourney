# Alternation

**Alternation** is the "OR" of regular expressions. The pipe character `|` separates alternatives, and the regex matches if *any* of them matches. It lets one pattern accept several different words or formats, but it has two traps you need to know about: `|` has the lowest precedence of all regex operators, and Python tries the alternatives strictly from left to right.

## What you'll learn

- How `X|Y` matches either `X` or `Y`
- Why `|` splits the *whole* pattern unless you limit it with a group
- How to restrict alternation to a part of a pattern with parentheses
- Why the order of alternatives matters (first match wins, not longest)
- When a character class is a better choice than alternation
- How to find out which alternative matched, and how to build an alternation from a list safely

## The `|` operator

The pipe operator `|` matches the expression on its left **or** the expression on its right. It works much like the `or` operator in Python:

```text
simple|complex
```

This pattern matches the literal text `simple` or the literal text `complex`:

```python
import re

s = "simple is better than complex"
matches = re.findall(r"simple|complex", s)
print(matches)
```

Output:

```text
['simple', 'complex']
```

You can chain as many alternatives as you like: `cat|dog|bird`. At every position in the string the engine tries the alternatives one by one, and the first that fits produces the match.

## Precedence: `|` splits everything

Alternation has the **lowest precedence** in a regex. Everything to the left of `|`, up to the start of the pattern (or the enclosing group), is one alternative, and everything to the right is the other. Concatenation binds more tightly.

So `^cat|dog$` does not mean "the whole string is `cat` or `dog`". It means "`cat` at the start **or** `dog` at the end":

```python
import re

print(re.findall(r"^cat|dog$", "cat and dog"))
print(re.findall(r"^cat|dog$", "dog and cat"))
print(re.findall(r"^(cat|dog)$", "dog"))
```

Output:

```text
['cat', 'dog']
[]
['dog']
```

Parentheses limit the alternation to the part inside them. In the last pattern the anchors apply to both alternatives.

### Example: matching a time in `hh:mm` format

A first attempt for times like `09:30` is two digits, a colon, and two digits:

```text
\d{2}:\d{2}
```

It also accepts nonsense such as `99:99`. Alternation lets you describe the valid ranges precisely.

Valid hours are `00` to `23`:

```text
[01]\d|2[0-3]
```

- `[01]\d` matches `00` to `19`: a `0` or `1` followed by any digit.
- `2[0-3]` matches `20`, `21`, `22` and `23`.

Valid minutes are `00` to `59`, which needs no alternation:

```text
[0-5]\d
```

Now join the two parts naively:

```python
import re

s = "09:30 30:61 22:30 25:99"
pattern = r"[01]\d|2[0-3]:[0-5]\d"

for match in re.finditer(pattern, s):
    print(match.group())
```

Output:

```text
09
22:30
```

The first result is only `09`. Because `|` has the lowest precedence, the engine reads the pattern as two alternatives:

```text
[01]\d              <- alternative 1: just the hour
2[0-3]:[0-5]\d      <- alternative 2: an hour from 20 to 23, a colon and minutes
```

To alternate only the hour, wrap that part in parentheses:

```python
import re

s = "09:30 30:61 22:30 25:99"
pattern = r"([01]\d|2[0-3]):[0-5]\d"

for match in re.finditer(pattern, s):
    print(match.group())
```

Output:

```text
09:30
22:30
```

Now the pattern says "(`[01]\d` or `2[0-3]`), then `:`, then `[0-5]\d`", and `30:61` and `25:99` are correctly rejected.

> **Note:** These parentheses also *capture*. With `finditer()` and `group()` this does not matter, but `re.findall()` returns the group instead of the whole match: `re.findall(r"([01]\d|2[0-3]):[0-5]\d", s)` gives `['09', '22']`. When you only need grouping, use a non-capturing group `(?:[01]\d|2[0-3])`, the subject of the next topic.

## Order matters: the first alternative wins

Python's `re` engine does **not** look for the longest alternative. At each position it tries the alternatives from left to right and takes the first one that lets the rest of the pattern succeed:

```python
import re

text = "I like JavaScript"

print(re.search(r"Java|JavaScript", text).group())
print(re.search(r"JavaScript|Java", text).group())
print(re.search(r"\b(Java|JavaScript)\b", text).group())
```

Output:

```text
Java
JavaScript
JavaScript
```

- With `Java|JavaScript` the shorter alternative matches first and the engine stops there.
- Put longer alternatives first, **or**
- add something after the alternation that forces the engine to reconsider. In the third pattern `Java` is followed by `S`, so the closing `\b` fails, the engine backtracks and tries `JavaScript`.

## Alternation or character class?

When every alternative is a single character, a character class is shorter, clearer and faster:

| Goal | Alternation | Better |
|---|---|---|
| one vowel | `a\|e\|i\|o\|u` | `[aeiou]` |
| `gray` or `grey` | `gr(a\|e)y` | `gr[ae]y` |
| optional `u` | `col(o\|ou)r` | `colou?r` |
| different words | `cat\|dog` | `cat\|dog` (alternation is the right tool) |

Do not mix the two up: inside square brackets `|` is an ordinary character. `[cat|dog]` is a class of the single characters `c`, `a`, `t`, `|`, `d`, `o` and `g`:

```python
import re

print(re.findall(r"[cat|dog]", "a|b"))
```

Output:

```text
['a', '|']
```

## Which alternative matched?

If you give each alternative its own named group, `match.lastgroup` tells you which one matched. This is the core of many small tokenizers:

```python
import re

token = re.compile(r"(?P<number>\d+)|(?P<word>[a-z]+)|(?P<space>\s+)")

for match in token.finditer("route 66 to rome"):
    if match.lastgroup != "space":
        print(match.lastgroup, repr(match.group()))
```

Output:

```text
word 'route'
number '66'
word 'to'
word 'rome'
```

Only one alternative can match at a time, so exactly one group has a value and `lastgroup` is its name.

## Building an alternation from a list

When the alternatives come from data, two things go wrong easily:

1. Special characters in the words (`+`, `.`, `?`, `(`...) are treated as regex syntax. Escape each word with `re.escape()`.
2. A short word that is a prefix of a longer one wins (`C` before `C++`). Sort by length, longest first.

```python
import re

languages = ["C", "C++", "C#", "Python"]
text = "I use C++, C# and C. Python too."

naive = "|".join(languages)
print(re.findall(naive, text))

safe = "|".join(re.escape(w) for w in sorted(languages, key=len, reverse=True))
print(safe)
print(re.findall(safe, text))
```

Output:

```text
['C', 'C', 'C', 'Python']
Python|C\+\+|C\#|C
['C++', 'C#', 'C', 'Python']
```

The naive version does not even raise an error: since Python 3.11, `C++` is valid syntax (`C+` followed by a possessive `+`), so the mistake passes silently and every `C...` matches as plain `C`.

## Readable alternation with `re.VERBOSE`

Long alternations quickly become hard to read. With the `re.VERBOSE` flag, whitespace in the pattern is ignored and `#` starts a comment, so you can lay the pattern out on several lines:

```python
import re

TIME = re.compile(r"""
    \b
    ([01]\d | 2[0-3])   # hours 00-23
    :
    [0-5]\d             # minutes 00-59
    \b
""", re.VERBOSE)

for match in TIME.finditer("09:30 30:61 22:30 25:99 123:456 00:00"):
    print(match.group())
```

Output:

```text
09:30
22:30
00:00
```

The `\b` anchors also stop the pattern from finding `23:45` inside `123:456`.

## Common mistakes

- **Forgetting that `|` splits the whole pattern.** `^cat|dog$` and `[01]\d|2[0-3]:[0-5]\d` do not mean what they look like. Wrap the alternation in a group.
- **Putting a short alternative before a longer one with the same prefix.** `Java|JavaScript` never matches the full `JavaScript` on its own. Order longest first or add a boundary after the group.
- **Writing `|` inside a character class.** `[a|b]` also matches a literal `|`. Write `[ab]` or `a|b`.
- **Getting only the group from `findall()`.** Grouping an alternation with `(...)` makes `findall()` return the group. Use `(?:...)` when you do not need the captured value.
- **Building alternations from raw user data.** Without `re.escape()`, characters such as `+`, `.` or `(` change the meaning of the pattern or raise `re.PatternError`.
- **Leaving an empty alternative.** A trailing `|` (as in `a|`) adds an alternative that matches the empty string, so the pattern matches everywhere: `re.findall(r"a|", "abc")` returns `['a', '', '', '']`.

## Summary

- `X|Y` matches `X` or `Y`. Any number of alternatives can be chained.
- `|` has the lowest precedence: it splits the whole pattern (or the whole enclosing group) into alternatives.
- Use parentheses to limit the alternation to part of a pattern: `([01]\d|2[0-3]):[0-5]\d`.
- Alternatives are tried left to right, and the first one that leads to an overall match wins, not the longest one.
- For single characters prefer a character class: `[ae]` instead of `a|e`.
- Named groups plus `match.lastgroup` tell you which alternative matched.
- Build alternations from data with `re.escape()` and sort the words longest first.

## Practice

### Exercise 1: Image files

Write `image_extension(filename)` that returns the lowercase extension (`"png"`, `"jpg"`, `"jpeg"` or `"gif"`) if the file name **ends** with one of these extensions in any letter case, and `None` otherwise. Test it with `"cat.PNG"`, `"notes.txt"`, `"photo.jpeg"` and `"anim.gif.bak"`.

### Exercise 2: Validate dates

Write a pattern for `fullmatch()` that accepts dates in `YYYY-MM-DD` format where the month is `01` to `12` and the day is `01` to `31` (you do not need to check the number of days in each month). Test it on `"2024-02-29"`, `"2024-13-01"`, `"2024-00-10"`, `"2024-12-31"` and `"2024-12-32"`.

### Exercise 3: Predict the output

Predict what each line prints, then check your answer.

```python
import re

text = "one two"
print(re.findall(r"one|one two|two", text))
print(re.findall(r"one two|one|two", text))
```

### Exercise 4: Whole words from a list

Write `find_words(words, text)` that finds whole-word occurrences of any of the given words. It must work for `find_words(["cat", "category", "dog"], "A category of cat and dog food")` and return `['category', 'cat', 'dog']`.

## Solutions

### Exercise 1

```python
import re


def image_extension(filename):
    match = re.search(r"\.(png|jpe?g|gif)$", filename, flags=re.IGNORECASE)
    return match.group(1).lower() if match else None


for name in ["cat.PNG", "notes.txt", "photo.jpeg", "anim.gif.bak"]:
    print(name, image_extension(name))
```

Output:

```text
cat.PNG png
notes.txt None
photo.jpeg jpeg
anim.gif.bak None
```

`jpe?g` covers both `jpg` and `jpeg` in one alternative. The `$` after the group applies to every alternative because the group limits the alternation.

### Exercise 2

```python
import re

DATE = re.compile(r"\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])")

for value in ["2024-02-29", "2024-13-01", "2024-00-10", "2024-12-31", "2024-12-32"]:
    print(value, bool(DATE.fullmatch(value)))
```

Output:

```text
2024-02-29 True
2024-13-01 False
2024-00-10 False
2024-12-31 True
2024-12-32 False
```

- Month: `0[1-9]` gives `01` to `09`, `1[0-2]` gives `10` to `12`.
- Day: `0[1-9]` gives `01` to `09`, `[12]\d` gives `10` to `29`, `3[01]` gives `30` and `31`.

### Exercise 3

Output:

```text
['one', 'two']
['one two']
```

In the first pattern `one` comes first and succeeds at position 0, so `one two` is never tried. The search then continues after `one` and finds `two`. In the second pattern the longer alternative is tried first and consumes the whole text.

### Exercise 4

```python
import re


def find_words(words, text):
    ordered = sorted(words, key=len, reverse=True)
    alternatives = "|".join(re.escape(word) for word in ordered)
    return [m.group() for m in re.finditer(rf"\b({alternatives})\b", text)]


print(find_words(["cat", "category", "dog"], "A category of cat and dog food"))
print(find_words(["cat"], "concatenate the cat"))
```

Output:

```text
['category', 'cat', 'dog']
['cat']
```

`\b` on both sides makes sure only whole words match (the `cat` inside `concatenate` is skipped), and sorting by length makes the pattern correct even without the boundaries. `rf"..."` is a raw f-string: the backslashes stay untouched and `{alternatives}` is substituted.

---

*Source: [pythontutorial.net — Python Regex Alternation](https://www.pythontutorial.net/python-regex/python-regex-alternation/). Adapted and expanded for PyJourney.*
