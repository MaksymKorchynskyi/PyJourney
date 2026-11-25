# Character Set

A **character set** (also called a **character class**) is a regex element that stands for a whole group of characters: all digits, all "word" characters, all kinds of whitespace. Character sets are the basic building blocks of almost every pattern, so knowing exactly what each of them matches, and what it does not, saves you from many subtle bugs.

## What you'll learn

- What a character set is and why each one matches exactly **one** character
- How to use `\d`, `\w` and `\s` and their inverse sets `\D`, `\W` and `\S`
- How the dot `.` works and how `re.DOTALL` changes it
- How Unicode affects these sets in Python 3 and how `re.ASCII` restricts them
- How to match a literal dot

## What a character set is

A character set describes a group of characters, and it matches **exactly one character** from that group at a time. To match two digits you need two digit sets in a row (or a quantifier, covered later). Python's `re` module has several built-in shorthand sets:

| Set | Matches one... | Inverse set |
|---|---|---|
| `\d` | digit | `\D` |
| `\w` | word character: letter, digit or underscore | `\W` |
| `\s` | whitespace character | `\S` |
| `.` | character of any kind except a newline | (none) |

You can also build your own sets with square brackets, such as `[aeiou]` or `[0-9]`. That is the subject of the Sets & Ranges topic.

## `\d`: digits

`\d` matches a single digit. The example uses `finditer()` to list every digit in the string:

```python
import re

s = "Python 3.0 was released in 2008"

for match in re.finditer(r"\d", s):
    print(match.group())
```

Output:

```text
3
0
2
0
0
8
```

To match two digits in a row, put two sets next to each other:

```python
import re

s = "Python 3.0 was released in 2008"

for match in re.finditer(r"\d\d", s):
    print(match.group(), match.span())
```

Output:

```text
20 (27, 29)
08 (29, 31)
```

Two details are worth noticing:

- `3.0` does not match, because a dot sits between the two digits.
- `2008` gives `20` and `08`, but not `00`. Matches never overlap: after finding `20`, the engine continues the search right after it.

Four digits in a row work the same way:

```python
import re

s = "Python 3.0 was released in 2008"

for match in re.finditer(r"\d\d\d\d", s):
    print(match.group())
```

Output:

```text
2008
```

Writing `\d\d\d\d` quickly gets tedious. The Quantifiers topic shows the shorter `\d{4}`.

### `\d` and Unicode digits

In Python 3, patterns written as `str` work in **Unicode mode**. `\d` then matches any Unicode decimal digit, not only `0` to `9`. For example, Arabic-Indic digits also count:

```python
import re

text = "Price: ٣٤ or 34"

print(re.findall(r"\d", text))
print(re.findall(r"\d", text, flags=re.ASCII))
print(re.findall(r"[0-9]", text))
```

Output:

```text
['٣', '٤', '3', '4']
['3', '4']
['3', '4']
```

When you validate data that must contain only the ASCII digits `0` to `9` (card numbers, PIN codes, IDs passed to other systems), use `[0-9]` or the `re.ASCII` flag.

## `\w`: word characters

`\w` matches one **word character**: a letter, a digit or the underscore `_`.

```python
import re

s = "Python 3.0"

for match in re.finditer(r"\w", s):
    print(match.group())
```

Output:

```text
P
y
t
h
o
n
3
0
```

The space and the dot are not word characters, so they are skipped.

Many tutorials say that `\w` matches only ASCII letters. That is **not true** for `str` patterns in Python 3. In Unicode mode, `\w` accepts letters from any alphabet. The `re.ASCII` flag limits it to `[a-zA-Z0-9_]`:

```python
import re

print(re.findall(r"\w", "café_2 є"))
print(re.findall(r"\w", "café_2 є", re.ASCII))
```

Output:

```text
['c', 'a', 'f', 'é', '_', '2', 'є']
['c', 'a', 'f', '_', '2']
```

Cyrillic is handled just like Latin, so a Ukrainian word is made of word characters too:

```python
>>> import re
>>> re.findall(r"\w", "Київ!")
['К', 'и', 'ї', 'в']
```

What `\w` does **not** include matters as much: the hyphen, the dot, the typewriter apostrophe `'` and the typographic apostrophe `’` are not word characters. Ukrainian words with an apostrophe are therefore split in two, unless the text uses the modifier letter apostrophe `ʼ` (U+02BC), which Unicode classifies as a letter:

```python
>>> import re
>>> re.findall(r"\w", "a-b.c!d e'f")
['a', 'b', 'c', 'd', 'e', 'f']
>>> re.findall(r"\w", "п'ять")
['п', 'я', 'т', 'ь']
>>> re.findall(r"\w\w\w\w\w", "пʼять")
['пʼять']
```

## `\s`: whitespace

`\s` matches one whitespace character:

```python
import re

s = "Python 3.0"

for match in re.finditer(r"\s", s):
    print(match)
```

Output:

```text
<re.Match object; span=(6, 7), match=' '>
```

The set includes more than the space: the tab `\t`, the newline `\n`, the carriage return `\r`, the form feed `\f` and the vertical tab `\v`. In Unicode mode it also includes other Unicode spaces, such as the non-breaking space `\xa0` that often sneaks in from web pages and word processors:

```python
import re

text = "a b\tc\nd\re\x0bf\x0cg\xa0h"

print(re.findall(r"\s", text))
print(re.findall(r"\s", text, re.ASCII))
```

Output:

```text
[' ', '\t', '\n', '\r', '\x0b', '\x0c', '\xa0']
[' ', '\t', '\n', '\r', '\x0b', '\x0c']
```

`\s` is handy for normalising text. Here every whitespace character becomes an underscore:

```python
import re

print(re.sub(r"\s", "_", "one two\tthree\nfour"))
```

Output:

```text
one_two_three_four
```

## Inverse sets: `\D`, `\W`, `\S`

Each shorthand set has an inverse written with the same letter in upper case. The inverse matches one character that is **not** in the original set:

| Set | Inverse | The inverse matches one character that is... |
|---|---|---|
| `\d` | `\D` | not a digit |
| `\w` | `\W` | not a word character (space, punctuation, symbols) |
| `\s` | `\S` | not whitespace |

`\D` finds everything except digits in a phone number:

```python
import re

phone_no = "+1-(650)-513-0514"

for match in re.finditer(r"\D", phone_no):
    print(match.group())
```

Output:

```text
+
-
(
)
-
-
```

Combined with `re.sub()`, this removes all the formatting in one call. Every character that matches `\D` is replaced with an empty string:

```python
import re

phone_no = re.sub(r"\D", "", "+1-(650)-513-0514")
print(phone_no)
```

Output:

```text
16505130514
```

`\W` picks out spaces and punctuation, and `\S` everything except whitespace:

```python
import re

print(re.findall(r"\W", "Hi, Bob! It's 5:00."))
print(re.findall(r"\S", " a \t b\n"))
```

Output:

```text
[',', ' ', '!', ' ', "'", ' ', ':', '.']
['a', 'b']
```

> **Note:** A set and its inverse together cover every possible character. Every character is either a digit or not a digit. This is why `[\d\D]` or `[\s\S]` is sometimes used as "absolutely any character, including newline".

## The dot `.`

The dot matches **any single character except the newline** `\n`:

```python
import re

version = "Python\n4"

for match in re.finditer(r".", version):
    print(match.group())
```

Output:

```text
P
y
t
h
o
n
4
```

The newline is skipped. The dot stops at line breaks on purpose: patterns such as `.` repeated many times would otherwise run across several lines of a log or a file. When you do want the dot to match newlines too, pass the `re.DOTALL` flag (short form `re.S`):

```python
import re

version = "Python\n4"

print(re.findall(r".", version))
print(re.findall(r".", version, re.DOTALL))
```

Output:

```text
['P', 'y', 't', 'h', 'o', 'n', '4']
['P', 'y', 't', 'h', 'o', 'n', '\n', '4']
```

### Matching a literal dot

Because the dot is a metacharacter, `3.0` as a pattern means "3, any character, 0". To match a real dot, escape it with a backslash: `\.`.

```python
import re

text = "3.0 and 330 and 3a0"

print(re.findall(r"3.0", text))
print(re.findall(r"3\.0", text))
```

Output:

```text
['3.0', '330', '3a0']
['3.0']
```

The same rule applies to the other metacharacters: `\+`, `\*`, `\?`, `\(`, `\$` and so on.

## Unicode mode vs `re.ASCII`

| Set | Default (Unicode) mode | With `re.ASCII` |
|---|---|---|
| `\d` | any Unicode decimal digit | `[0-9]` |
| `\w` | letters of any alphabet, digits, `_` | `[a-zA-Z0-9_]` |
| `\s` | all Unicode whitespace | `[ \t\n\r\f\v]` |

The inverse sets follow automatically, and so does the word boundary `\b`, which is defined through `\w`. Patterns written as `bytes` (`rb"\w"`) are always ASCII-only.

## Common mistakes

- **Forgetting to escape the dot.** `r"\d.\d"` happily matches `"3x0"` and `"3 0"`. Write `r"\d\.\d"` for a real dot.
- **Assuming `\w` means `[a-zA-Z0-9_]`.** In Python 3 it also matches `é`, `ї`, `ß` and other letters. Use `re.ASCII` or an explicit set when you need ASCII only.
- **Expecting `\w` to cover hyphens and apostrophes.** `"well-known"` and `"п'ять"` each split into two parts.
- **Assuming `\d` means `0` to `9`.** It also accepts digits from other scripts. For strict validation, use `[0-9]` or `re.ASCII`.
- **Expecting `.` to match a newline.** It does not, unless you pass `re.DOTALL`.
- **Thinking one set matches several characters.** `\d` is exactly one character. `"42"` needs `\d\d` or a quantifier such as `\d+`.

## Summary

- A character set matches exactly one character from a group.
- `\d` matches a digit, `\w` a word character (letter, digit or `_`), `\s` a whitespace character.
- `\D`, `\W` and `\S` are their inverses: they match any character not in the original set.
- `.` matches any character except a newline. With `re.DOTALL` it matches newlines too.
- A literal dot needs escaping: `\.`.
- In Python 3, `str` patterns are Unicode-aware: `\w` accepts Cyrillic and accented letters, and `\d` accepts digits from other scripts. `re.ASCII` limits the sets to ASCII.

## Practice

### Exercise 1: Clean a phone number

Turn `"+38 (067) 123-45-67"` into `"380671234567"` with a single `re.sub()` call.

### Exercise 2: Whitespace statistics

For `text = "Line one\n\tLine two  end\n"`, count the whitespace characters with `\s` and the non-whitespace characters with `\S`. Check that the two counts add up to `len(text)`.

### Exercise 3: Version numbers

In the string `"Python 2.7, 3.9 and 3x0"`, find every "digit, dot, digit" sequence. Run the search with `r"\d.\d"` and with `r"\d\.\d"`, and explain the difference.

### Exercise 4: Unicode vs ASCII

For the string `"naïve café — Київ"`, count the word characters with and without `re.ASCII`. Print the characters that `re.ASCII` keeps.

## Solutions

### Exercise 1

```python
import re

print(re.sub(r"\D", "", "+38 (067) 123-45-67"))
```

Output:

```text
380671234567
```

### Exercise 2

```python
import re

text = "Line one\n\tLine two  end\n"

spaces = len(re.findall(r"\s", text))
others = len(re.findall(r"\S", text))

print(spaces, others)
print(spaces + others == len(text))
```

Output:

```text
7 17
True
```

There are four spaces, two newlines and one tab. Every character is either whitespace or not, so the sum always equals the length of the string.

### Exercise 3

```python
import re

s = "Python 2.7, 3.9 and 3x0"

print(re.findall(r"\d.\d", s))
print(re.findall(r"\d\.\d", s))
```

Output:

```text
['2.7', '3.9', '3x0']
['2.7', '3.9']
```

The unescaped dot accepts any character, so `3x0` slips through. The escaped `\.` accepts only a real dot.

### Exercise 4

```python
import re

text = "naïve café — Київ"

unicode_chars = re.findall(r"\w", text)
ascii_chars = re.findall(r"\w", text, re.ASCII)

print(len(unicode_chars), len(ascii_chars))
print(ascii_chars)
```

Output:

```text
13 7
['n', 'a', 'v', 'e', 'c', 'a', 'f']
```

In Unicode mode all 13 letters count, including `ï`, `é` and the four Cyrillic letters. With `re.ASCII` only the 7 plain Latin letters remain.

---

*Source: [pythontutorial.net — Python Regex Character Set](https://www.pythontutorial.net/python-regex/python-regex-character-set/). Adapted and expanded for PyJourney.*
