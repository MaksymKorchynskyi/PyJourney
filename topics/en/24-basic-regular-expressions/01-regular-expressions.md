# Regular Expressions

A **regular expression** (regex, regexp) is a short pattern that describes a whole family of strings: "one digit", "four digits in a row", "a word that ends in `ython`". Python runs such patterns through the built-in `re` module. One line with a regex can search, validate, extract or replace text where plain string methods would need a loop and a pile of `if` statements.

## What you'll learn

- What a regular expression is and how the `re` module runs it
- How to compile a pattern into a `Pattern` object, and when compiling is worth it
- How `search()`, `match()`, `fullmatch()`, `findall()` and `finditer()` differ
- How to read a `Match` object with `group()`, `start()`, `end()` and `span()`
- Why every pattern should be written as a raw string `r"..."`

## What a regular expression is

A regex is written as an ordinary Python string, but its content is a program in a separate mini-language. Most characters simply match themselves: the pattern `cat` matches the three characters `c`, `a`, `t` in that order. Some characters and sequences have a special meaning. They are called **metacharacters**. For example, `\d` means "any single digit":

```python
r"\d"
```

The `re` module is the bridge between the two languages. It takes the pattern, compiles it into an internal matching engine, and runs that engine against your text.

Typical jobs for regular expressions:

- **validating** input: is this a postal code, a time, a phone number?
- **extracting** data: all numbers, dates or e-mail addresses from a log;
- **replacing** and cleaning text: remove everything except digits from a phone number;
- **splitting** a string by separators that are more complex than a single character.

> **Note:** Do not reach for a regex when a string method is enough. `"py" in text`, `text.startswith("http")` and `text.split(",")` are simpler, faster and easier to read for such simple checks.

## Compiling a pattern with `re.compile()`

Working with a regex takes three steps: import `re`, compile the pattern into a `Pattern` object, and call one of its methods.

```python
import re

pattern = re.compile(r"\d")
s = "Python 3.10 was released on October 04, 2021"

print(pattern.findall(s))
```

Output:

```text
['3', '1', '0', '0', '4', '2', '0', '2', '1']
```

`findall()` scans the string from left to right and collects every match. Each `\d` matches exactly **one** character, so the result is a list of single digits. The dot, the spaces and the letters are skipped because they are not digits.

A `Pattern` object remembers the source text of the pattern:

```python
import re

pattern = re.compile(r"\d")

print(type(pattern))
print(pattern)
print(pattern.pattern)
```

Output:

```text
<class 're.Pattern'>
re.compile('\\d')
\d
```

The `repr` shows the pattern as an ordinary string literal, so the backslash appears doubled (`'\\d'`). The pattern itself is just two characters: a backslash and `d`, as `print(pattern.pattern)` shows.

The most important `Pattern` methods:

| Method | What it does | Returns |
|---|---|---|
| `search(string)` | Finds the first match anywhere in the string | `Match` or `None` |
| `match(string)` | Tries to match only at the very beginning of the string | `Match` or `None` |
| `fullmatch(string)` | Succeeds only if the whole string fits the pattern | `Match` or `None` |
| `findall(string)` | Finds all non-overlapping matches | list of strings |
| `finditer(string)` | Finds all non-overlapping matches, one at a time | iterator of `Match` objects |
| `sub(repl, string)` | Replaces every match with `repl` | new string |
| `split(string)` | Splits the string at every match | list of strings |

## Module-level functions and the pattern cache

Every method above has a twin function in the `re` module that takes the pattern as its first argument: `re.search(pattern, string)`, `re.findall(pattern, string)` and so on. You do not have to compile anything yourself:

```python
import re

s = "Python 3.10 was released on October 04, 2021."
print(re.findall(r"\d", s))
```

Output:

```text
['3', '1', '0', '0', '4', '2', '0', '2', '1']
```

Under the hood `re.findall(p, s)` does roughly `re.compile(p).findall(s)`. To avoid compiling the same pattern again and again, the module keeps recently compiled patterns in an internal **cache**. The second call with the same pattern string takes the ready `Pattern` object from the cache.

So which style should you use?

- **Module functions** (`re.search(...)`) are perfect for a pattern used once or occasionally. The code is shorter.
- **`re.compile()`** pays off when the same pattern is used many times (in a loop or in a function that is called often), when you want to give the pattern a meaningful name, or when you want to set flags once. A compiled pattern also lets you limit the search region with the `pos` and `endpos` arguments.

The performance difference is usually small thanks to the cache. The main reason to compile is readability:

```python
import re

YEAR = re.compile(r"\d{4}")


def find_years(lines):
    return [YEAR.findall(line) for line in lines]


print(find_years(["Python 1991", "No year here", "3.0 in 2008, 3.10 in 2021"]))
```

Output:

```text
[['1991'], [], ['2008', '2021']]
```

Here `\d{4}` means "exactly four digits in a row". This is a **quantifier**, covered in detail in the Quantifiers topic.

**Flags** change how a pattern behaves. They are passed to `re.compile()` or to any module function. For example, `re.IGNORECASE` (short form `re.I`) makes matching case-insensitive:

```python
import re

pattern = re.compile(r"python", re.IGNORECASE)
print(pattern.findall("Python, PYTHON and python"))
```

Output:

```text
['Python', 'PYTHON', 'python']
```

## `search()`: the first match anywhere

`search()` tries the pattern at position 0, then at position 1, and so on, and stops at the **first** position where the pattern matches. It returns a `Match` object, or `None` if the pattern matches nowhere.

```python
import re

s = "Python 3.10 was released on October 04, 2021."

match = re.search(r"\d{2}", s)
print(type(match))
print(match)

print(re.search(r"\d{5}", s))
```

Output:

```text
<class 're.Match'>
<re.Match object; span=(9, 11), match='10'>
None
```

The first digit in the string is `3` (index 7), but it is followed by a dot, so two digits in a row do not fit there. The first place where they do is `10` at indexes 9 and 10. The string has no run of five digits, so the second search returns `None`.

Because the result may be `None`, always check it before using it. The walrus operator `:=` (Python 3.8+) keeps such checks short. A `Match` object is always truthy, so `if match:` is enough:

```python
import re

text = "Call me at 555-0199"

if match := re.search(r"\d\d\d", text):
    print("Found:", match.group())
else:
    print("No digits")
```

Output:

```text
Found: 555
```

## The `Match` object

A `Match` object describes one successful match:

| Method | Returns |
|---|---|
| `group()` | The matched text (the same as `group(0)` or `m[0]`) |
| `start()` | The index where the match starts |
| `end()` | The index just **after** the last matched character |
| `span()` | The tuple `(start(), end())` |

```python
import re

s = "Python 3.10 was released on October 04, 2021."
result = re.search(r"\d", s)

print("Matched string:", result.group())
print("Starting position:", result.start())
print("Ending position:", result.end())
print("Positions:", result.span())
print("Slice:", s[result.start():result.end()])
print("Shortcut:", result[0])
```

Output:

```text
Matched string: 3
Starting position: 7
Ending position: 8
Positions: (7, 8)
Slice: 3
Shortcut: 3
```

`end()` is **exclusive**, exactly like the end index of a slice. That is why `s[m.start():m.end()]` always equals `m.group()`. `group()` without arguments returns the whole match. With capturing groups (see the Groupings topic) you can also ask for parts of the match by number or name.

## `match()`: only at the beginning

`match()` checks the pattern **only at position 0**. If the string does not start with a match, the result is `None`, even if the pattern appears later in the string.

```python
import re

names = [
    "Python",
    "CPython is an implementation of Python written in C",
    "Jython is a Java implementation of Python",
    "IronPython is Python on .NET framework",
]

for name in names:
    print(re.match(r"\wython", name))
```

Output:

```text
<re.Match object; span=(0, 6), match='Python'>
None
<re.Match object; span=(0, 6), match='Jython'>
None
```

`\w` matches one **word character**: a letter, a digit or an underscore. It does not match "any character". So `\wython` means "one word character followed by the literal text `ython`".

- `"Python"` and `"Jython ..."` start with such a sequence, so they match.
- `"CPython ..."` starts with `C`, which `\w` accepts, but then comes `Python`, not `ython`. `match()` does not try any other position, so the result is `None`, even though `Python` appears later in the string. `re.search()` would find it.
- `"IronPython ..."` fails for the same reason.

In Python 3, `\w` understands Unicode, so it also accepts Cyrillic, Greek and accented letters:

```python
>>> import re
>>> re.match(r"\w", "Ґанок")
<re.Match object; span=(0, 1), match='Ґ'>
```

> **Note:** `match()` anchors the pattern only at the start, not at the end. `re.match(r"\d", "1abc")` succeeds and matches `'1'`. If the whole string must fit, use `fullmatch()`.

## `fullmatch()`: the whole string

`fullmatch()` succeeds only when the pattern covers the string from the first character to the last. That makes it the natural tool for **validation**:

```python
import re

print(re.fullmatch(r"\d{4}", "2021"))
print(re.fullmatch(r"\d{4}", "Python 3.10 released in 2021"))
print(re.fullmatch(r"\d{4}", "20215"))
```

Output:

```text
<re.Match object; span=(0, 4), match='2021'>
None
None
```

`2021` inside a longer sentence is not enough, and five digits are too many.

Here are the three functions side by side on the same pattern:

```python
import re

for text in ["2021", "2021 year", "year 2021"]:
    print(
        f"{text!r:12}",
        re.match(r"\d{4}", text) is not None,
        re.search(r"\d{4}", text) is not None,
        re.fullmatch(r"\d{4}", text) is not None,
    )
```

Output:

```text
'2021'       True True True
'2021 year'  True True False
'year 2021'  False True False
```

The columns are `match()`, `search()` and `fullmatch()`: `search()` is the most permissive, `fullmatch()` the strictest.

## `findall()` vs `finditer()`

Both find **all** non-overlapping matches, scanning from left to right. The difference is in what you get back:

```python
import re

s = "Room 42, floor 7"

print(re.findall(r"\d", s))

for match in re.finditer(r"\d", s):
    print(match.group(), match.span())
```

Output:

```text
['4', '2', '7']
4 (5, 6)
2 (6, 7)
7 (15, 16)
```

- `findall()` builds a complete **list of strings** at once. It is convenient when you only need the text.
- `finditer()` returns an **iterator of `Match` objects** that are produced one by one. Use it when you need positions, or when the text is large and you do not want all matches in memory at once.

> **Note:** If a pattern contains capturing groups (parentheses), `findall()` returns the text of the groups instead of the whole match. The Groupings topic explains this.

## Replacing and splitting: `sub()` and `split()`

Two more functions appear in almost every regex-heavy program. They are covered in depth in the regex functions section, but they are too useful to skip here:

```python
import re

print(re.sub(r"\d", "#", "PIN: 1234"))
print(re.split(r"\d", "a1b2c3d"))
```

Output:

```text
PIN: ####
['a', 'b', 'c', 'd']
```

`sub()` replaces every match and returns a new string (strings are immutable). `split()` cuts the string at every match.

## Regular expressions and raw strings

A pattern passes through **two** interpreters, and both treat the backslash `\` as special:

1. **Python** reads the string literal first. In a normal string, `\n` becomes a newline, `\t` a tab, `\b` a backspace character, and `\\` a single backslash.
2. The **regex engine** then reads the resulting characters. For it, `\d` means a digit, `\b` a word boundary, and `\\` a literal backslash.

A **raw string** (prefix `r` or `R`) switches off step 1: every backslash stays in the string as is. The regex engine then receives exactly what you typed.

### Problem 1: Python silently changes your pattern

```python
import re

text = "a cat and a category"

print(re.findall("\bcat\b", text))
print(re.findall(r"\bcat\b", text))
print(len("\bcat\b"), len(r"\bcat\b"))
```

Output:

```text
[]
['cat']
5 7
```

In the normal string, Python turns `\b` into the backspace character (code 8). The regex engine then looks for "backspace, c, a, t, backspace" and finds nothing. In the raw string, `\b` stays as two characters, and the engine reads it as a **word boundary**, so only the standalone word `cat` matches, not the `cat` inside `category`. Note that no error or warning is shown: the bug is silent.

### Problem 2: unknown escapes trigger a warning

`\d` is not an escape sequence Python knows, so in a normal string the backslash survives and the pattern happens to work. But such code is deprecated: since Python 3.12 the compiler shows a `SyntaxWarning` (earlier versions used a hidden `DeprecationWarning`), and a future version will make it an error.

```python
import re

print(re.findall("\d", "a1b2"))
```

Output (Python 3.14, the file path is shortened):

```text
.../example.py:3: SyntaxWarning: "\d" is an invalid escape sequence. Such sequences will not work in the future. Did you mean "\\d"? A raw string is also an option.
  print(re.findall("\d", "a1b2"))
['1', '2']
```

### Problem 3: matching a literal backslash

To match one backslash, the regex engine needs `\\`. In a normal string literal each of those two backslashes must be doubled again, so you end up writing four:

```python
import re

s = r"\section"
print(s, len(s))

pattern_plain = "\\\\section"
pattern_raw = r"\\section"
print(pattern_plain == pattern_raw)

print(re.findall(pattern_raw, s))
```

Output:

```text
\section 8
True
['\\section']
```

Both literals produce the same 9-character pattern `\\section`, but the raw version is much easier to read. The found string is the 8-character `\section`. The list shows it as `'\\section'` only because a list prints the `repr` of its items, and `repr` doubles backslashes.

| To match | Regex pattern | Normal string literal | Raw string literal |
|---|---|---|---|
| a digit | `\d` | `"\\d"` | `r"\d"` |
| a word boundary | `\b` | `"\\b"` | `r"\b"` |
| one backslash | `\\` | `"\\\\"` | `r"\\"` |

A few details about raw strings:

- Escapes such as `\n` and `\t` still work inside a raw pattern, because the regex engine understands them itself. `re.findall(r"\t", "a\tb")` returns `['\t']`.
- A raw string cannot end with an odd number of backslashes: `r"\"` is a `SyntaxError`. Patterns practically never need that.
- `r` only changes how the literal is read. The result is an ordinary `str`.

> **Tip:** Make `r"..."` a habit for every pattern, even for patterns without backslashes. Patterns tend to grow, and a raw string never hurts.

## Common mistakes

- **Calling `.group()` on `None`.** When nothing matches, `search()`, `match()` and `fullmatch()` return `None`:

  ```python
  import re

  match = re.search(r"\d", "no digits here")
  print(match.group())  # AttributeError: 'NoneType' object has no attribute 'group'
  ```

  Check the result first: `if match := re.search(...):`.

- **Using `match()` when you mean `search()`.** `re.match(r"Python", "CPython")` is `None`, because `match()` looks only at the start of the string.
- **Validating with `search()` or `match()`.** `re.search(r"\d{4}", "year 2021!")` succeeds even though the string is not a year. Use `fullmatch()` for "the whole string must look like this".
- **Forgetting the `r` prefix.** `"\b"` silently becomes a backspace character, and `"\d"` triggers a `SyntaxWarning`.
- **Treating `end()` as the index of the last character.** It points one position **past** the match, like a slice end.
- **Using a regex for a simple substring test.** `"error" in line` is clearer and faster than `re.search(r"error", line)`.

## Summary

- A regular expression is a pattern in a small separate language. Python runs it through the `re` module.
- `re.compile()` returns a reusable `Pattern` object. Module functions such as `re.search()` compile and cache patterns for you.
- `search()` finds the first match anywhere, `match()` only at the start, and `fullmatch()` only if the whole string fits.
- `findall()` returns a list of strings, and `finditer()` yields `Match` objects with positions.
- A `Match` object exposes `group()`, `start()`, `end()` (exclusive) and `span()`. A failed match returns `None`.
- `\w` means a word character (letter, digit or underscore), and in Python 3 it includes Unicode letters.
- Always write patterns as raw strings: Python then leaves the backslashes alone and the regex engine gets exactly what you typed.

## Practice

### Exercise 1: match, search or fullmatch?

Predict which lines print a `Match` object and which print `None`. Then run the code and check.

```python
import re

print(re.match(r"\d\d", "42 apples"))
print(re.match(r"\d\d", "apples: 42"))
print(re.search(r"\d\d", "apples: 42"))
print(re.fullmatch(r"\d\d", "42 apples"))
print(re.fullmatch(r"\d\d", "42"))
```

### Exercise 2: Digits and their positions

For the string `"Order 7 of 15 shipped"`, print every digit together with its index in the form `digit 7 at index 6`. Use `finditer()`.

### Exercise 3: PIN validator

Write a function `is_pin(text)` that returns `True` only if `text` consists of exactly four digits. Test it with `"1234"`, `"12345"`, `"12a4"`, `" 1234"` and `"1234\n"`.

### Exercise 4: Count the backslashes

Count the backslashes in the Windows path `r"C:\Users\olena\Documents\notes.txt"` with `re.findall()`. Write the pattern twice, once as a raw string and once as a normal string literal, and show that both are the same pattern.

## Solutions

### Exercise 1

Output:

```text
<re.Match object; span=(0, 2), match='42'>
None
<re.Match object; span=(8, 10), match='42'>
None
<re.Match object; span=(0, 2), match='42'>
```

- `match()` succeeds on `"42 apples"` because the string starts with two digits. It does not care about the rest.
- `match()` fails on `"apples: 42"` because the digits are not at position 0. `search()` finds them at index 8.
- `fullmatch()` fails on `"42 apples"` because of the extra text, and succeeds on `"42"`.

### Exercise 2

```python
import re

s = "Order 7 of 15 shipped"

for match in re.finditer(r"\d", s):
    print(f"digit {match.group()} at index {match.start()}")
```

Output:

```text
digit 7 at index 6
digit 1 at index 11
digit 5 at index 12
```

### Exercise 3

```python
import re


def is_pin(text):
    return re.fullmatch(r"\d\d\d\d", text) is not None


for candidate in ["1234", "12345", "12a4", " 1234", "1234\n"]:
    print(repr(candidate), is_pin(candidate))
```

Output:

```text
'1234' True
'12345' False
'12a4' False
' 1234' False
'1234\n' False
```

`fullmatch()` rejects anything extra, including a leading space or a trailing newline. `re.search()` would accept `"12345"` and `" 1234"`, and `re.match()` would accept `"12345"`.

### Exercise 4

```python
import re

path = r"C:\Users\olena\Documents\notes.txt"

raw_pattern = r"\\"
plain_pattern = "\\\\"

print(raw_pattern == plain_pattern)
print(len(raw_pattern))
print(len(re.findall(raw_pattern, path)))
```

Output:

```text
True
2
4
```

Both literals give the same two-character pattern `\\`, which the regex engine reads as "one literal backslash". The path contains four of them.

---

*Source: [pythontutorial.net — Python Regular Expressions](https://www.pythontutorial.net/python-regex/python-regular-expressions/). Adapted and expanded for PyJourney.*
