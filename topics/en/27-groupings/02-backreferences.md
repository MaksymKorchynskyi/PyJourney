# Backreferences

A **backreference** lets a pattern refer back to the text that an earlier capturing group has already matched. It answers questions that an ordinary pattern cannot express, such as "is this word repeated?" or "does the closing quote match the opening one?". The same idea works in replacement strings, where you can rearrange captured pieces with `re.sub()`.

## What you'll learn

- How `\1`, `\2`, ... reuse a captured group inside a pattern
- How to write named backreferences with `(?P=name)`
- How to use groups in replacement strings: `\1`, `\g<1>`, `\g<name>` and `\g<0>`
- Why `\g<N>` exists and why it only works in replacement strings
- Typical uses: duplicate words, matching quotes, doubled letters, reordering text
- The pitfalls: raw strings, missing word boundaries, groups that did not match

## How a backreference works

Inside a pattern, `\N` (where `N` is a group number from 1 to 99) matches **exactly the same text** that group `N` captured earlier in the current match. It repeats the captured *text*, not the sub-pattern.

```python
import re

text = "11 12 77 90"

print(re.findall(r"\d\d", text))
print([m.group() for m in re.finditer(r"(\d)\1", text)])
```

Output:

```text
['11', '12', '77', '90']
['11', '77']
```

`\d\d` accepts any two digits. In `(\d)\1` the first digit is captured, and `\1` then demands that the next character is the **same** digit, so `12` and `90` are rejected.

A few rules:

- The group must be defined **before** the backreference and must already be closed. `\1(a)` raises `re.PatternError: invalid group reference 1`, and `(a\1)` raises `cannot refer to an open group`.
- `\0` and three-digit sequences such as `\101` are octal character escapes, not backreferences. Use `group(0)` or `\g<0>` (in replacements) for the whole match.
- A backreference to a group that did not take part in the match **fails** in Python. For example, `(a)?b\1` does not match `"b"`.

## Removing a duplicated word

Take a sentence with an accidental repetition:

```text
Python Python is awesome
```

Build the pattern step by step:

1. `\w+\s+` matches a word and the whitespace after it.
2. `(\w+)\s+` captures only the word.
3. `(\w+)\s+\1` requires the same word to follow the whitespace.

Now replace every match with just the first group. In the replacement string `\1` means "the text of group 1":

```python
import re

pattern = r"(\w+)\s+\1"

print(re.sub(pattern, r"\1", "Python Python is awesome"))
print(re.sub(pattern, r"\1", "This is it"))
```

Output:

```text
Python is awesome
This it
```

The first result is correct, but the second sentence is broken: `is` disappeared even though nothing was repeated. The engine captured the `is` at the end of `This`, then found `is` again after the space. A backreference compares characters, not words. Word boundaries fix it:

```python
import re

pattern = r"\b(\w+)\s+\1\b"

print(re.sub(pattern, r"\1", "Python Python is awesome"))
print(re.sub(pattern, r"\1", "This is it"))
print(re.sub(pattern, r"\1", "The the cat sat sat down", flags=re.IGNORECASE))
```

Output:

```text
Python is awesome
This is it
The cat sat down
```

The leading `\b` stops the group from starting inside a word, and the trailing `\b` stops `\1` from matching only the beginning of a longer word (as in `the theory`). With `re.IGNORECASE` the backreference also ignores case, so `The the` counts as a repetition.

## Named backreferences: `(?P=name)`

If the group has a name, refer to it by name with `(?P=name)`. This reads better than a number and survives adding new groups to the pattern:

```python
import re

pattern = r"\b(?P<word>\w+)\s+(?P=word)\b"
match = re.search(pattern, "I think think so")

print(match.group())
print(match.group("word"))
```

Output:

```text
think think
think
```

## Backreferences in replacement strings

In the replacement argument of `re.sub()` you can insert the text of any group:

| Syntax | Meaning |
|---|---|
| `\1` ... `\99` | text of group 1 ... 99 |
| `\g<1>` | text of group 1, written unambiguously |
| `\g<name>` | text of the named group `name` |
| `\g<0>` | the whole match |

```python
import re

text = "Deadline: 2024-10-07, review: 2024-11-15"

print(re.sub(r"(\d{4})-(\d{2})-(\d{2})", r"\3.\2.\1", text))
print(re.sub(r"(?P<y>\d{4})-(?P<m>\d{2})-(?P<d>\d{2})", r"\g<d>.\g<m>.\g<y>", text))
print(re.sub(r"\d+", r"[\g<0>]", "5 apples and 12 pears"))
```

Output:

```text
Deadline: 07.10.2024, review: 15.11.2024
Deadline: 07.10.2024, review: 15.11.2024
[5] apples and [12] pears
```

> **Note:** The `\g<...>` forms work **only in replacement strings**. Inside a pattern, `\g<1>` raises `re.PatternError: bad escape \g`. In a pattern, use `\1` or `(?P=name)`.

### Why `\g<1>` exists

Suppose you want to append a `0` to every number. `\10` looks like "group 1, then `0`", but Python reads it as "group 10":

```python
import re

try:
    re.sub(r"(\d+)", r"\10", "price 5")
except re.PatternError as error:
    print("error:", error)

print(re.sub(r"(\d+)", r"\g<1>0", "price 5"))
```

Output:

```text
error: invalid group reference 10 at position 1
price 50
```

`\g<1>0` removes the ambiguity: the group number ends at `>`.

### Groups that did not match

In a replacement string, a group that did not take part in the match is replaced with an empty string (since Python 3.5; older versions raised an error):

```python
import re

print(re.sub(r"(\d+)(px)?", r"\1:\2;", "10px 7"))
```

Output:

```text
10:px; 7:;
```

When the replacement needs real logic (arithmetic, lookups, conditions), pass a function instead of a string. It receives each `Match` object and returns the replacement text:

```python
import re

print(re.sub(r"\d+", lambda m: str(int(m.group()) * 2), "3 apples, 10 pears"))
```

Output:

```text
6 apples, 20 pears
```

## More examples

### Text inside matching quotes

The goal is to extract text enclosed in either double quotes or single quotes, but not text that opens with one kind of quote and closes with the other. A first attempt uses a character class on both sides:

```python
import re

s = '"Python\'s awesome". She said'
pattern = r'[\'"].*?[\'"]'

match = re.search(pattern, s)
print(match.group())
```

Output:

```text
"Python'
```

The match opens with `"` and stops at the apostrophe in `Python's`, because the closing class accepts *either* quote. A backreference forces the closing quote to be the same character as the opening one:

```python
import re

s = '"Python\'s awesome". She said'
pattern = r'([\'"])(.*?)\1'

match = re.search(pattern, s)
print(match.group())
print(match.group(2))
```

Output:

```text
"Python's awesome"
Python's awesome
```

Group 1 captures the opening quote, `(.*?)` lazily captures the content, and `\1` accepts only the quote that group 1 captured. A regex still cannot tell an apostrophe from a closing single quote, so `'it's ok'` would stop after `'it'`. For real quoted formats (CSV, JSON, source code) use a proper parser.

### Words with a doubled letter

`(\w)\1` finds two identical characters in a row. To find whole words that contain such a pair, surround it with `\w*` and word boundaries:

```python
import re

words = ["apple", "orange", "strawberry", "kiwi", "coffee"]
pattern = r"\b\w*(\w)\1\w*\b"

print([w for w in words if re.search(pattern, w)])
```

Output:

```text
['apple', 'strawberry', 'coffee']
```

When each item is already a single word, `re.search(r"(\w)\1", w)` is enough. The longer pattern matters when you search a sentence, where you want the whole word as the match.

## Common mistakes

- **Writing the replacement as a normal string.** In `'\1'` Python turns `\1` into the control character with code 1 before `re` ever sees it:

  ```python
  import re

  print(repr(re.sub(r"(\w+)", "\1", "hello")))
  print(repr(re.sub(r"(\w+)", r"\1", "hello")))
  ```

  Output:

  ```text
  '\x01'
  'hello'
  ```

- **Forgetting word boundaries.** `(\w+)\s+\1` also matches across word parts (`This is` becomes `This`). Use `\b(\w+)\s+\1\b`.
- **Using `\g<1>` inside a pattern.** It only works in replacement strings. In patterns write `\1` or `(?P=name)`.
- **Expecting `\1` to repeat the sub-pattern.** `(\d)\1` matches `77`, not `12`. To repeat a *pattern*, use a quantifier: `\d{2}` or `(\d){2}`.
- **Using `findall()` and getting only the group.** `re.findall(r"\b\w*(\w)\1\w*\b", text)` returns the doubled letters, not the words. Use `finditer()` and `group()`, or wrap the whole word in its own group.
- **Writing `\10` when you mean "group 1, then 0".** Use `\g<1>0`.

## Summary

- `\N` in a pattern matches the exact text that group `N` captured earlier in the same match.
- `(?P=name)` is the named form of a backreference inside a pattern.
- In replacement strings use `\N`, `\g<N>`, `\g<name>`, and `\g<0>` for the whole match. `\g<...>` is not valid inside a pattern.
- Always use raw strings for both the pattern and the replacement.
- Add `\b` around backreferenced words, otherwise matches can start or end inside words.
- With `re.IGNORECASE`, backreferences ignore case too.
- A backreference to a group that did not match fails in the pattern, but becomes an empty string in a replacement.

## Practice

### Exercise 1: Doubled letters in a sentence

Print every word that contains two identical letters in a row in:

```text
The committee will meet at noon to discuss the book
```

### Exercise 2: Collapse repeated words

Write `dedupe(text)` that collapses any number of consecutive repetitions of a word, ignoring case, and keeps the first spelling. `"This is is is a test test. Go go now"` must become `"This is a test. Go now"`.

### Exercise 3: US dates to ISO

Convert dates written as `MM/DD/YYYY` to `YYYY-MM-DD` with named groups and `\g<name>` in the replacement. Test with `"Due 12/31/2024 and 01/05/2025"`.

### Exercise 4: Properly closed tags

From the string below, extract `(tag, content)` pairs only for tags whose closing tag matches the opening one. The expected result is `[('b', 'bold'), ('code', 'x')]`.

```text
<b>bold</b> <i>italic</b> <code>x</code>
```

## Solutions

### Exercise 1

```python
import re

text = "The committee will meet at noon to discuss the book"
words = [m.group() for m in re.finditer(r"\b\w*(\w)\1\w*\b", text)]
print(words)
```

Output:

```text
['committee', 'will', 'meet', 'noon', 'discuss', 'book']
```

`findall()` would return only group 1 (the doubled letter), so the solution takes `group()` from each match.

### Exercise 2

```python
import re


def dedupe(text):
    return re.sub(r"\b(\w+)(\s+\1\b)+", r"\1", text, flags=re.IGNORECASE)


print(dedupe("This is is is a test test. Go go now"))
print(dedupe("This is it"))
```

Output:

```text
This is a test. Go now
This is it
```

`(\s+\1\b)+` swallows one or more repetitions in a single match, so three copies of `is` collapse at once. The replacement `\1` keeps the first spelling (`Go`, not `go`).

### Exercise 3

```python
import re

text = "Due 12/31/2024 and 01/05/2025"
pattern = r"(?P<month>\d{2})/(?P<day>\d{2})/(?P<year>\d{4})"

print(re.sub(pattern, r"\g<year>-\g<month>-\g<day>", text))
```

Output:

```text
Due 2024-12-31 and 2025-01-05
```

### Exercise 4

```python
import re

text = "<b>bold</b> <i>italic</b> <code>x</code>"
print(re.findall(r"<(\w+)>(.*?)</\1>", text))
```

Output:

```text
[('b', 'bold'), ('code', 'x')]
```

For `<i>` the engine looks for a closing `</i>` that never appears, so that attempt fails and the search moves on. This works for simple, flat markup only. Real HTML needs an HTML parser such as `html.parser`.

---

*Source: [pythontutorial.net — Python Regex Backreferences](https://www.pythontutorial.net/python-regex/python-regex-backreferences/). Adapted and expanded for PyJourney.*
