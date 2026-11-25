# split()

`re.split()` cuts a string into pieces wherever a regular expression matches. The built-in `str.split()` can only split on one fixed separator, but real data is messier: commas *or* semicolons, any amount of whitespace, "and" in any letter case. With a pattern as the separator, one call handles all of these.

## What you'll learn

- The signature of `re.split()` and why `maxsplit` and `flags` should be keyword arguments
- How to split on several different or variable-length separators
- How `maxsplit` limits the number of splits
- How capturing groups put the separators into the result, and how to avoid that
- Where empty strings in the result come from, and how to remove them
- How `re.split()` differs from `str.split()`

## The signature

```python
re.split(pattern, string, maxsplit=0, flags=0)
```

- `pattern` is a regular expression. Every match of it is treated as a separator.
- `string` is the text to split.
- `maxsplit` is the maximum number of splits. The default `0` means "split at every match".
- `flags` is one regex flag or several combined with `|`.

The function returns a **list of strings**: the pieces of text between the separators. If the pattern does not match at all, the list contains the whole string as its only element.

> **Note:** Since Python 3.13, passing `maxsplit` and `flags` positionally is deprecated and produces a `DeprecationWarning`. Write `maxsplit=2` and `flags=re.IGNORECASE`.

## Splitting on several separators

`str.split()` accepts only one literal separator. A character set lets `re.split()` accept any of several, in any amount:

```python
import re

print(re.split(r"[,;\s]+", "a, b;c  d"))
```

Output:

```text
['a', 'b', 'c', 'd']
```

`[,;\s]+` means "one or more characters, each of which is a comma, a semicolon or whitespace". So `", "`, `";"` and `"  "` all act as separators.

A common variant splits a sentence into words by treating every run of non-word characters as a separator:

```python
import re

s = "A! B. C D"
words = re.split(r"\W+", s)
print(words)
```

Output:

```text
['A', 'B', 'C', 'D']
```

`\W` is the opposite of `\w`: any character that is not a letter, digit or underscore. `\W+` matches `"! "`, `". "` and `" "`.

## Limiting the number of splits: `maxsplit`

```python
import re

s = "A! B. C D"
print(re.split(r"\W+", s, maxsplit=2))
```

Output:

```text
['A', 'B', 'C D']
```

After two splits, `split()` stops and returns the **rest of the string** unchanged as the last element. That is why the result has three items and the last one is `"C D"`.

`maxsplit` is an upper limit. If the string contains fewer separators, you simply get fewer pieces. A typical use is separating a "head" from the rest, for example a command from its arguments:

```python
import re

command, rest = re.split(r"\s+", "copy   file.txt   backup/", maxsplit=1)
print(command)
print(rest)
```

Output:

```text
copy
file.txt   backup/
```

## Capturing groups keep the separators

If the pattern contains **capturing groups**, the text of every group is inserted into the result between the pieces. This is useful when the separators carry information:

```python
import re

s = "A! B. C D"
print(re.split(r"(\W+)", s, maxsplit=2))
```

Output:

```text
['A', '! ', 'B', '. ', 'C D']
```

A practical example is tokenising a formula while keeping the operators:

```python
import re

print(re.split(r"\s*([+\-*/])\s*", "12 + 3*4 - 5"))
```

Output:

```text
['12', '+', '3', '*', '4', '-', '5']
```

The whitespace around operators is outside the group, so it is discarded, while the operator itself is kept.

### Several groups, and groups that did not match

With more than one group, the text of **each** group is inserted after each separator. A group that did not take part in the match contributes `None`:

```python
import re

print(re.split(r"(,)|(;)", "a,b;c"))
```

Output:

```text
['a', ',', None, 'b', None, ';', 'c']
```

### When you only need parentheses for grouping

Grouping alternatives with plain parentheses accidentally keeps the separators. Use a non-capturing group `(?:...)` instead:

```python
import re

s = "cats and dogs or birds"

print(re.split(r"\s+(and|or)\s+", s))
print(re.split(r"\s+(?:and|or)\s+", s))
```

Output:

```text
['cats', 'and', 'dogs', 'or', 'birds']
['cats', 'dogs', 'birds']
```

## Empty strings at the edges

If a separator matches **at the very start** of the string, the first element of the result is an empty string. The same happens at the end. This has nothing to do with capturing groups: there is simply no text before the first separator (or after the last one).

```python
import re

print(re.split(r"\W+", "...A! B. C D"))
print(re.split(r"\W+", "A! B. C D..."))
```

Output:

```text
['', 'A', 'B', 'C', 'D']
['A', 'B', 'C', 'D', '']
```

This keeps the result predictable: the pieces always alternate as "text, separator, text, ...". With a capturing group, you can see that structure directly:

```python
import re

print(re.split(r"(\W+)", "...words..."))
```

Output:

```text
['', '...', 'words', '...', '']
```

To drop empty strings, filter the list. `filter(None, ...)` keeps only truthy items:

```python
import re

parts = re.split(r"\W+", "...A! B. C D...")
print(parts)
print([p for p in parts if p])
print(list(filter(None, parts)))
```

Output:

```text
['', 'A', 'B', 'C', 'D', '']
['A', 'B', 'C', 'D']
['A', 'B', 'C', 'D']
```

## Splitting on an empty match

Since Python 3.7, a pattern that matches an empty string can be used as a separator. A lookahead matches the *position* before something without consuming it, which is perfect for splitting camelCase names:

```python
import re

print(re.split(r"(?=[A-Z])", "HelloWorldFoo"))
```

Output:

```text
['', 'Hello', 'World', 'Foo']
```

The first element is empty because there is an empty match right at position 0, before `H`. Similarly, a lookbehind can split text into sentences after the punctuation, keeping the punctuation with its sentence:

```python
import re

print(re.split(r"(?<=[.!?])\s+", "Hi there. How are you? Fine!"))
```

Output:

```text
['Hi there.', 'How are you?', 'Fine!']
```

## `re.split()` vs `str.split()`

The two behave differently with whitespace at the edges:

```python
import re

s = "  alpha   beta  "

print(s.split())
print(re.split(r"\s+", s))
```

Output:

```text
['alpha', 'beta']
['', 'alpha', 'beta', '']
```

`str.split()` **without arguments** has special logic: it ignores leading and trailing whitespace and never returns empty strings. `re.split()` has no such rule, so the edges produce `''`. If you just need to split on whitespace, `str.split()` is the simpler choice. Use `re.split()` when the separator is a real pattern.

## Using flags

```python
import re

print(re.split(r"\s+and\s+", "salt AND pepper and oil", flags=re.IGNORECASE))
```

Output:

```text
['salt', 'pepper', 'oil']
```

## Common mistakes

- **Passing `flags` in the `maxsplit` position.** `re.IGNORECASE` equals `2`, so the call below means "at most 2 splits, case-sensitive", and no split happens at all. Python 3.13+ warns about it:

  ```python
  import re

  print(re.split(r"x", "aXbXc", re.IGNORECASE))
  print(re.split(r"x", "aXbXc", flags=re.IGNORECASE))
  ```

  Output (`example.py` stands for the path of your script):

  ```text
  example.py:3: DeprecationWarning: 'maxsplit' is passed as positional argument
    print(re.split(r"x", "aXbXc", re.IGNORECASE))
  ['aXbXc']
  ['a', 'b', 'c']
  ```

- **Getting separators in the result unexpectedly.** Any capturing group puts its text into the list. Use `(?:...)` for grouping only.
- **Being surprised by empty strings.** Separators at the start or end, or a pattern like `[,;]` (without `+`) between two adjacent separators, produce `''`. Use `+` and filter the result.
- **Using `re.split()` for a simple fixed separator.** `"a,b,c".split(",")` is clearer and faster.
- **Expecting `maxsplit` to be the number of pieces.** It is the number of *splits*. `maxsplit=2` gives up to three pieces (more if the pattern has groups).

## Summary

- `re.split(pattern, string, maxsplit=0, flags=0)` returns a list of the pieces between matches of the pattern.
- A character set with `+`, such as `[,;\s]+`, handles several and repeated separators at once.
- `maxsplit` limits the number of splits. The rest of the string becomes the last element. Pass it by keyword.
- Capturing groups insert the separator text into the result, and unmatched groups insert `None`. Use `(?:...)` to avoid this.
- A separator at the start or end produces an empty string. Filter with `[p for p in parts if p]`.
- Lookarounds let you split at positions without removing any characters.
- `str.split()` without arguments ignores edge whitespace. `re.split()` does not.

## Practice

### Exercise 1: Clean tag list

A user typed tags as `" python, regex;  tips ,,  tutorial ;"`. Split the string on commas, semicolons and whitespace, and return a list without empty strings: `['python', 'regex', 'tips', 'tutorial']`.

### Exercise 2: Sentences

Split `"Regex is powerful. Is it hard? Not really! Practice helps."` into sentences, keeping the punctuation mark at the end of each sentence.

### Exercise 3: Formula tokens

Write `tokenize(expr)` that splits an arithmetic expression into numbers, operators and parentheses, ignoring spaces. `tokenize("(12 + 3) * 4-5")` must return `['(', '12', '+', '3', ')', '*', '4', '-', '5']`.

### Exercise 4: Settings to a dictionary

Turn `"host = localhost; port=8080 ;debug= true;"` into `{'host': 'localhost', 'port': '8080', 'debug': 'true'}`. Split into entries first, then split each entry into a key and a value with `maxsplit=1`.

## Solutions

### Exercise 1

```python
import re

raw = " python, regex;  tips ,,  tutorial ;"
tags = [t for t in re.split(r"[,;\s]+", raw) if t]
print(tags)
```

Output:

```text
['python', 'regex', 'tips', 'tutorial']
```

The separators at both ends produce empty strings, which the comprehension removes.

### Exercise 2

```python
import re

text = "Regex is powerful. Is it hard? Not really! Practice helps."
print(re.split(r"(?<=[.!?])\s+", text))
```

Output:

```text
['Regex is powerful.', 'Is it hard?', 'Not really!', 'Practice helps.']
```

The lookbehind `(?<=[.!?])` requires a punctuation mark before the whitespace but does not consume it, so the mark stays in its sentence. The final `.` has no whitespace after it, so no empty string appears at the end.

### Exercise 3

```python
import re


def tokenize(expr):
    parts = re.split(r"\s*([-+*/()])\s*", expr)
    return [p for p in parts if p]


print(tokenize("(12 + 3) * 4-5"))
```

Output:

```text
['(', '12', '+', '3', ')', '*', '4', '-', '5']
```

The capturing group keeps the operators and parentheses. Adjacent separators such as `)` followed by `*` produce empty strings between them, which are filtered out. Inside the set, `-` is placed first so it is a literal minus, not a range.

### Exercise 4

```python
import re

raw = "host = localhost; port=8080 ;debug= true;"

settings = {}
for entry in re.split(r"\s*;\s*", raw):
    if not entry:
        continue
    key, value = re.split(r"\s*=\s*", entry, maxsplit=1)
    settings[key.strip()] = value.strip()

print(settings)
```

Output:

```text
{'host': 'localhost', 'port': '8080', 'debug': 'true'}
```

`maxsplit=1` guarantees exactly two pieces per entry, even if a value itself contained `=`.

---

*Source: [pythontutorial.net — Python Regex split()](https://www.pythontutorial.net/python-regex/python-regex-split/). Adapted and expanded for PyJourney.*
