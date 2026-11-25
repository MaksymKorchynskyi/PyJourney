# sub()

`re.sub()` is the search-and-replace tool of the `re` module. It finds every match of a pattern and builds a **new string** in which those matches are replaced. The replacement can be fixed text, text that reuses parts of the match through backreferences, or the result of a function you write. This makes `sub()` the go-to function for cleaning data, reformatting dates, masking secrets and converting between text formats.

## What you'll learn

- The signature of `re.sub()` and why `count` and `flags` should be passed by keyword
- How "leftmost, non-overlapping" replacement works
- How to reuse captured text with `\1`, `\g<1>`, `\g<name>` and `\g<0>`
- How to compute replacements with a function
- Which escape sequences are special in the replacement string
- How `re.subn()` reports the number of replacements

## The signature

```python
re.sub(pattern, repl, string, count=0, flags=0)
```

- `pattern` is the regular expression (a raw string or a compiled `Pattern`).
- `repl` is the replacement: a string, or a function that receives a `Match` object and returns a string.
- `string` is the input text.
- `count` is the maximum number of replacements. The default `0` means "replace all matches".
- `flags` is one regex flag or several combined with `|`.

`sub()` returns a new string. Strings in Python are immutable, so the original is never changed. If the pattern does not match at all, you get back a string equal to the original.

> **Note:** Since Python 3.13, passing `count` and `flags` as positional arguments is deprecated and produces a `DeprecationWarning`. In a future version they will become keyword-only. Always write `count=...` and `flags=...`. The section on common mistakes shows the bug this rule prevents.

## Removing characters: a plain phone number

The following example turns `(212)-456-7890` into `2124567890`:

```python
import re

phone_no = "(212)-456-7890"
result = re.sub(r"\D", "", phone_no)

print(result)
```

Output:

```text
2124567890
```

`\D` matches any single character that is **not** a digit. Replacing each such character with the empty string `""` deletes it.

## Leftmost, non-overlapping matches

`sub()` scans from left to right. After a match is replaced, scanning continues *after* that match, so matches never overlap and the replaced text is never scanned again:

```python
import re

print(repr(re.sub(r"00", "", "00000")))
print(repr(re.sub(r"00", "", "000000")))
```

Output:

```text
'0'
''
```

In `"00000"` (five zeros), the first two zeros are a match, then the next two, and the fifth zero is left alone because it has no partner. In `"000000"` (six zeros), three matches consume everything and the result is an empty string.

## Limiting replacements with `count`

```python
import re

print(re.sub(r"\s+", "-", "a b  c   d", count=2))
```

Output:

```text
a-b-c   d
```

Only the first two runs of whitespace were replaced. The rest of the string is copied unchanged.

## Backreferences: reusing the matched text

Inside `repl`, you can refer to the text captured by the pattern's groups:

| In `repl` | Inserts |
|---|---|
| `\1` ... `\99` | the text of group 1 ... 99 |
| `\g<1>` | the text of group 1 (unambiguous form) |
| `\g<name>` | the text of the named group `name` |
| `\g<0>` | the whole match |

### Markdown bold to HTML

The pattern below finds text surrounded by asterisks, as in Markdown `*bold*` syntax, and wraps it in `<b>...</b>` tags:

```python
import re

s = "Make the World a *Better Place*"
html = re.sub(r"\*(.*?)\*", r"<b>\1</b>", s)

print(html)
```

Output:

```text
Make the World a <b>Better Place</b>
```

- `\*` is a literal asterisk (escaped, because `*` is a quantifier).
- `(.*?)` captures the text between the asterisks as group 1. The `?` makes the quantifier **lazy**, so it stops at the *nearest* closing asterisk.
- In the replacement, `\1` puts the captured text back between the tags.

The lazy quantifier matters as soon as there is more than one bold fragment:

```python
import re

s = "a *b* and *c*"

print(re.sub(r"\*(.*)\*", r"<b>\1</b>", s))
print(re.sub(r"\*(.*?)\*", r"<b>\1</b>", s))
```

Output:

```text
a <b>b* and *c</b>
a <b>b</b> and <b>c</b>
```

The greedy `.*` runs to the **last** asterisk and swallows ` and ` into one big group.

### Named groups: reformatting dates

Named groups make the replacement self-documenting. The example converts ISO dates `YYYY-MM-DD` to the European format `DD.MM.YYYY`:

```python
import re

text = "Released 2024-03-15, patched 2024-04-01."
pattern = r"(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})"

print(re.sub(pattern, r"\g<day>.\g<month>.\g<year>", text))
```

Output:

```text
Released 15.03.2024, patched 01.04.2024.
```

### `\g<0>` and the `\g<1>0` vs `\10` ambiguity

`\g<0>` inserts the whole match, which is handy for wrapping matches:

```python
import re

print(re.sub(r"\d+", r"[\g<0>]", "Room 101, floor 3"))
```

Output:

```text
Room [101], floor [3]
```

If a group reference must be followed by a digit, use the `\g<...>` form. `\10` means "group 10", not "group 1 followed by 0":

```python
import re

print(re.sub(r"(\d)", r"\g<1>0", "1 2 3"))

try:
    re.sub(r"(\d)", r"\10", "1 2 3")
except re.error as e:
    print("Error:", e)
```

Output:

```text
10 20 30
Error: invalid group reference 10 at position 1
```

## A function as the replacement

When the replacement depends on the matched value, pass a **function** as `repl`. `sub()` calls it once for every match, passing the `Match` object, and inserts whatever string it returns.

For example, square the number inside each list item:

```python
import re


def square(match):
    num = int(match.group())
    return str(num * num)


items = ["A1", "A2", "A3", "B12"]
pattern = r"\d+"
new_items = [re.sub(pattern, square, s) for s in items]

print(new_items)
```

Output:

```text
['A1', 'A4', 'A9', 'B144']
```

How it works:

1. `\d+` matches one or more digits in each string.
2. For every match, `sub()` calls `square()` with the `Match` object.
3. `square()` converts the matched text to `int`, squares it, and returns the result as a `str`. Returning anything other than a string raises `TypeError`.

Functions are ideal for lookups. Here a small template engine fills `{name}` placeholders from a dictionary and leaves unknown placeholders untouched:

```python
import re

template = "Hello, {name}! Your order {order_id} ships on {date}. {unknown}"
values = {"name": "Olena", "order_id": "A-17", "date": "Monday"}

result = re.sub(r"\{(\w+)\}", lambda m: values.get(m[1], m[0]), template)
print(result)
```

Output:

```text
Hello, Olena! Your order A-17 ships on Monday. {unknown}
```

`m[1]` is the placeholder name. If it is missing from the dictionary, `values.get()` falls back to `m[0]`, the original `{unknown}` text.

## Escapes in the replacement string

A replacement **string** is not copied literally. Backslash sequences in it are processed:

- `\n`, `\t` and the other standard escapes become the corresponding characters.
- `\1`, `\g<name>` and the like are backreferences.
- An unknown escape of an ASCII letter, such as `\d`, is an error.

```python
import re

print(re.sub(r";\s*", r"\n", "one; two; three"))

try:
    re.sub(r"x", r"\d", "x")
except re.error as e:
    print(type(e).__name__, "-", e)
```

Output:

```text
one
two
three
PatternError - bad escape \d at position 0
```

Since Python 3.13, the exception class is named `re.PatternError`. The old name `re.error` still works as an alias, so `except re.error` is fine in code that must also run on older versions.

If the replacement must contain backslashes literally, for example a Windows path, double them (`r"C:\\new"`) or, simpler, use a function: its return value is inserted **as is**, without any escape processing:

```python
import re

print(re.sub(r"DIR", lambda m: r"C:\new\docs", "Saved to DIR"))
```

Output:

```text
Saved to C:\new\docs
```

## `re.subn()`: replace and count

`re.subn()` takes the same arguments as `sub()` but returns a tuple `(new_string, number_of_replacements)`:

```python
import re

text, n = re.subn(r"\s+", " ", "too    many \t\t spaces   here")
print(repr(text))
print(n)
```

Output:

```text
'too many spaces here'
3
```

## Empty matches

A pattern that can match the empty string also produces replacements at empty positions. Since Python 3.7, an empty match right after a non-empty one is replaced too:

```python
import re

print(re.sub(r"x*", "-", "abxd"))
```

Output:

```text
-a-b--d-
```

Reading it from left to right: an empty match before `a`, before `b`, the match `x`, an empty match right after it (before `d`) and a final empty match at the end. Use `x+` if you only want to replace real occurrences.

## When not to use `sub()`

For a **fixed** piece of text, `str.replace()` is simpler and faster: `"a-b-c".replace("-", "+")`. Reach for `re.sub()` when you need patterns, case-insensitivity, backreferences or a replacement function.

If you build a pattern from user input, escape it with `re.escape()` so that characters like `.` or `+` are matched literally:

```python
import re

word = "C++"
text = "I like C++ and c++."

print(re.sub(re.escape(word), "Python", text, flags=re.IGNORECASE))
```

Output:

```text
I like Python and Python.
```

## Common mistakes

- **Passing `flags` in the `count` position.** `re.IGNORECASE` is the integer `2`, so the call below means "replace at most 2 matches, case-sensitively". Python 3.13+ warns about it:

  ```python
  import re

  text = "Cat cat CAT cat cat"
  print(re.sub(r"cat", "dog", text, re.IGNORECASE))
  print(re.sub(r"cat", "dog", text, flags=re.IGNORECASE))
  ```

  Output (`example.py` stands for the path of your script):

  ```text
  example.py:4: DeprecationWarning: 'count' is passed as positional argument
    print(re.sub(r"cat", "dog", text, re.IGNORECASE))
  Cat dog CAT dog cat
  dog dog dog dog dog
  ```

- **Forgetting the raw string in `repl`.** In a normal string, `"\1"` is the character with code 1, not a backreference:

  ```python
  import re

  print(repr(re.sub(r"(\w+)", "<\1>", "hi")))
  print(repr(re.sub(r"(\w+)", r"<\1>", "hi")))
  ```

  Output:

  ```text
  '<\x01>'
  '<hi>'
  ```

- **Using a greedy `.*` between delimiters.** `\*(.*)\*` spans from the first to the last asterisk. Use `.*?` or a negated set like `[^*]*`.
- **Expecting `sub()` to change the string in place.** It returns a new string. Assign the result: `s = re.sub(...)`.
- **Returning a non-string from a replacement function.** Convert numbers with `str()`.
- **Writing `\10` when you mean "group 1, then 0".** Use `\g<1>0`.

## Summary

- `re.sub(pattern, repl, string, count=0, flags=0)` returns a new string with matches replaced. If nothing matches, the text is returned unchanged.
- Pass `count` and `flags` as keyword arguments. Positional use is deprecated since Python 3.13 and easily confuses a flag with a count.
- Matches are found left to right and never overlap.
- In the replacement string, `\1`, `\g<1>`, `\g<name>` and `\g<0>` insert captured text, and standard escapes like `\n` are processed.
- A function as `repl` receives each `Match` and returns the replacement string, inserted as is.
- `re.subn()` returns `(new_string, count)`.
- Use `str.replace()` for fixed text and `re.escape()` when the pattern comes from user input.

## Practice

### Exercise 1: Normalise whitespace

Write `normalize(text)` that replaces every run of whitespace (spaces, tabs, newlines) with a single space and removes whitespace at both ends. `normalize("  Hello,\t\tworld!\n  How   are you? ")` must return `"Hello, world! How are you?"`.

### Exercise 2: US dates to ISO

Convert every date in `MM/DD/YYYY` format to `YYYY-MM-DD` using named groups and a replacement string. Test with `"Due 03/15/2024, paid 04/01/2024."`.

### Exercise 3: Censor words

Write `censor(text, banned)` that replaces each banned word with asterisks of the same length, ignoring case and matching whole words only. `censor("Darn it, DARN this darned heck!", ["darn", "heck"])` must return `"**** it, **** this darned ****!"`. Use a function as the replacement.

### Exercise 4: camelCase to snake_case

Write `to_snake(name)` that converts `"getHttpResponseCode"` to `"get_http_response_code"`. Then use `re.subn()` to also report how many underscores were inserted.

## Solutions

### Exercise 1

```python
import re


def normalize(text):
    return re.sub(r"\s+", " ", text).strip()


print(repr(normalize("  Hello,\t\tworld!\n  How   are you? ")))
```

Output:

```text
'Hello, world! How are you?'
```

`\s+` turns every whitespace run, including the ones at the edges, into a single space, and `strip()` removes those edge spaces.

### Exercise 2

```python
import re

text = "Due 03/15/2024, paid 04/01/2024."
pattern = r"(?P<month>\d{2})/(?P<day>\d{2})/(?P<year>\d{4})"

print(re.sub(pattern, r"\g<year>-\g<month>-\g<day>", text))
```

Output:

```text
Due 2024-03-15, paid 2024-04-01.
```

### Exercise 3

```python
import re


def censor(text, banned):
    pattern = r"\b(?:" + "|".join(map(re.escape, banned)) + r")\b"
    return re.sub(pattern, lambda m: "*" * len(m[0]), text, flags=re.IGNORECASE)


print(censor("Darn it, DARN this darned heck!", ["darn", "heck"]))
```

Output:

```text
**** it, **** this darned ****!
```

The word boundaries `\b` keep `darned` intact. `re.escape()` protects the pattern in case a banned word contains special characters. The lambda returns as many asterisks as the matched word has characters.

### Exercise 4

```python
import re


def to_snake(name):
    return re.subn(r"(?<!^)(?=[A-Z])", "_", name)


snake, inserted = to_snake("getHttpResponseCode")
print(snake.lower())
print(inserted)
```

Output:

```text
get_http_response_code
3
```

The pattern matches an **empty** position that is followed by an upper-case letter (lookahead) and is not the very beginning of the string (negative lookbehind). Inserting `_` at each such position and then lower-casing gives snake_case. `subn()` counts the three insertions.

---

*Source: [pythontutorial.net — Python Regex sub()](https://www.pythontutorial.net/python-regex/python-regex-sub/). Adapted and expanded for PyJourney.*
