# Word Boundary

The **word boundary** `\b` is an anchor that matches the position where a word starts or ends. It is the standard way to find **whole words**: `cat` as a word, but not the `cat` inside `category` or `concat`. Like the other anchors, it matches a position and consumes no characters.

## What you'll learn

- Which positions in a string count as word boundaries
- How to use `\b` to match whole words, or only the start or the end of a word
- What the non-boundary `\B` matches
- How digits, underscores, hyphens, apostrophes and non-Latin letters affect boundaries
- Why `\b` fails around words like `C++`, and how to work around it
- How to build a whole-word pattern from user input with `re.escape()`

## What a word boundary is

A word boundary is defined through word characters (`\w`: letters, digits and the underscore). A position is a boundary when the character on **one** side of it is a word character and the character on the **other** side is not, either because it is a non-word character (`\W`) or because that side is the edge of the string. In practice there are three cases:

1. **Before the first character** of the string, if that character is a word character.
2. **Between two characters**, if one of them is a word character and the other is not. The order does not matter: word then non-word, or non-word then word.
3. **After the last character** of the string, if that character is a word character.

The string `"PYTHON 3!"` has four boundaries:

```text
  | P | Y | T | H | O | N |   | 3 | ! |
  0   1   2   3   4   5   6   7   8   9
  ^                       ^   ^   ^
```

- position 0: before `P` (case 1);
- position 6: between `N` and the space (case 2, word then non-word);
- position 7: between the space and `3` (case 2, non-word then word);
- position 8: between `3` and `!` (case 2).

Position 9, the end of the string, is not a boundary, because the last character `!` is not a word character. You can let Python list the positions:

```python
import re

s = "PYTHON 3!"

print([m.start() for m in re.finditer(r"\b", s)])
```

Output:

```text
[0, 6, 7, 8]
```

## Matching whole words

Without boundaries, the pattern `Python` also matches inside `CPython`:

```python
import re

s = "CPython is the implementation of Python in C"

for match in re.finditer(r"Python", s):
    print(match)
```

Output:

```text
<re.Match object; span=(1, 7), match='Python'>
<re.Match object; span=(33, 39), match='Python'>
```

Wrapping the word in `\b` on both sides keeps only the standalone word. Inside `CPython` there is no boundary between `C` and `P`, because both are word characters:

```python
import re

s = "CPython is the implementation of Python in C"

for match in re.finditer(r"\bPython\b", s):
    print(match)
```

Output:

```text
<re.Match object; span=(33, 39), match='Python'>
```

The general recipe for a whole word is `r"\bword\b"`.

## Only the start or only the end of a word

You can use just one boundary. `\bcat` means "a word that **starts** with `cat`", and `cat\b` means "a word that **ends** with `cat`":

```python
import re

text = "cat, cats, cat_food, cat-food, concat"

print(re.findall(r"\bcat\b", text))
print(re.findall(r"\bcat", text))
print(re.findall(r"cat\b", text))
```

Output:

```text
['cat', 'cat']
['cat', 'cat', 'cat', 'cat']
['cat', 'cat', 'cat']
```

Go through the words one by one:

| Word | `\bcat\b` | `\bcat` | `cat\b` | Why |
|---|---|---|---|---|
| `cat` | yes | yes | yes | boundaries on both sides |
| `cats` | no | yes | no | `s` is a word character, no boundary after `cat` |
| `cat_food` | no | yes | no | `_` is a word character too |
| `cat-food` | yes | yes | yes | `-` is not a word character, so there is a boundary |
| `concat` | no | no | yes | `n` before `cat` is a word character |

## `\B`: not a word boundary

`\B` is the inverse of `\b`: it matches every position that is **not** a word boundary, that is, between two word characters or between two non-word characters.

```python
import re

s = "CPython is the implementation of Python in C"

for match in re.finditer(r"\BPython", s):
    print(match)
```

Output:

```text
<re.Match object; span=(1, 7), match='Python'>
```

Now only the `Python` **inside** another word matches. In `"PYTHON 3!"` the non-boundary positions are the remaining ones:

```python
>>> import re
>>> [m.start() for m in re.finditer(r"\B", "PYTHON 3!")]
[1, 2, 3, 4, 5, 9]
```

Positions 1 to 5 lie between two letters, and position 9 lies after `!`, a non-word character.

> **Note:** Since Python 3.14, `\B` also matches an empty string, as in other regex engines: `re.findall(r"\B", "")` returns `['']`. Earlier versions returned `[]`.

## Raw strings are mandatory here

In a normal Python string, `"\b"` is the **backspace** character (code 8), not a word boundary. The pattern then silently looks for backspace characters and finds nothing, without any error:

```python
>>> import re
>>> re.findall("\bcat\b", "a cat")
[]
>>> re.findall(r"\bcat\b", "a cat")
['cat']
```

Always write word boundary patterns as raw strings.

## Word boundaries and Unicode

In Python 3, `\w` understands Unicode, and `\b` is defined through `\w`. So boundaries work for Cyrillic, Greek or accented words exactly as for English:

```python
import re

text = "кіт, котик, кітті, кіт-воркіт"

print(re.findall(r"\bкіт\b", text))
print(re.findall(r"\bкіт", text))
print(re.findall(r"\bпривіт\b", "Привіт, привіт! привітання", re.IGNORECASE))
```

Output:

```text
['кіт', 'кіт']
['кіт', 'кіт', 'кіт']
['Привіт', 'привіт']
```

The `re.ASCII` flag switches this off: Cyrillic letters are then non-word characters, no boundaries appear around them, and the same pattern finds nothing:

```python
>>> import re
>>> re.findall(r"\bпривіт\b", "Привіт, привіт!", re.IGNORECASE | re.ASCII)
[]
```

### The apostrophe problem

The usual apostrophe `'` is not a word character, so it creates boundaries **inside** words such as the Ukrainian `сім'я` ("family") or the English `don't`:

```python
import re

text = "сім'я і я"

print([m.start() for m in re.finditer(r"\b", "сім'я")])
print(re.findall(r"\bя\b", text))
```

Output:

```text
[0, 3, 4, 5]
['я', 'я']
```

The search for the standalone word `я` ("I") also finds the last letter of `сім'я`. If apostrophes matter in your text, either normalise them to the modifier letter apostrophe `ʼ` (U+02BC), which counts as a letter, or describe the edges of the word explicitly with lookarounds such as `(?<![\w'])я(?![\w'])` (see the Look-around topic).

## When `\b` does not help: words with symbols

A boundary exists only next to a word character. If the word you are looking for **starts or ends with a non-word character**, `\b` on that side requires a word character right after it, which is usually not what you want:

```python
import re

text = "I like C++ and C#"

print(re.findall(r"\bC\+\+\b", text))
print(re.findall(r"\bC\+\+", text))
```

Output:

```text
[]
['C++']
```

Between the final `+` and the following space there is no boundary, because both characters are non-word characters. Keep `\b` only on the side that ends in a word character (here, before `C`). For full control, use lookarounds (see the Look-around topic).

## Building patterns from user input

To search for a whole word that comes from a variable, combine the raw and f-string prefixes (`rf"..."`) and pass the word through `re.escape()`. Otherwise characters such as `.` in the word act as metacharacters:

```python
import re

text = "Python 3.5 and 3x5 and 3.5."
word = "3.5"

print(re.findall(rf"\b{word}\b", text))
print(re.findall(rf"\b{re.escape(word)}\b", text))
```

Output:

```text
['3.5', '3x5', '3.5']
['3.5', '3.5']
```

> **Tip:** In an `rf` string, curly braces belong to the f-string. If the pattern also needs a quantifier such as `\d{4}`, double the braces: `rf"\b{prefix}\d{{4}}\b"`.

## Common mistakes

- **Writing `"\b"` without the `r` prefix.** It becomes a backspace character, and the pattern silently matches nothing.
- **Expecting `\b` around symbols.** `r"\bC\+\+\b"`, `r"\b\.NET\b"` and `r"\b\$5\b"` fail because the edges of these "words" are not word characters.
- **Forgetting that digits and `_` are word characters.** `\bcat\b` does not match in `cat_food`, and `\b42\b` does not match in `x42`.
- **Forgetting that `-` and `'` are not word characters.** `\bcat\b` does match in `cat-food`, and `\bя\b` matches inside `сім'я`.
- **Using `re.ASCII` on non-English text.** Boundaries around Cyrillic or accented letters disappear.
- **Inserting user input without `re.escape()`.** A dot or a plus in the word changes the meaning of the pattern.

## Summary

- `\b` matches a position where a word character meets a non-word character or the edge of the string.
- `r"\bword\b"` matches `word` only as a whole word. `\bword` matches words that start with it, and `word\b` words that end with it.
- `\B` matches every position that is not a word boundary, such as the inside of a word.
- Digits and `_` are word characters. Spaces, punctuation, `-` and `'` are not.
- In Python 3, `\b` is Unicode-aware and works with Cyrillic and other alphabets. `re.ASCII` turns that off.
- `\b` needs a word character on one side, so it does not work at the edges of tokens like `C++`.
- Always use raw strings, and escape user input with `re.escape()`.

## Practice

### Exercise 1: Find the boundaries

Write down the positions of all word boundaries in `"Hi, Bob!"`. Then check your answer with `finditer()`.

### Exercise 2: Count a whole word

Count how many times the word `the` occurs in `"The theme of the story: there is the end"`, ignoring case. `theme` and `there` must not count.

### Exercise 3: Replace a whole word

Replace the word `cat` with `dog` in `"cat category concat cat."` without touching `category` and `concat`.

### Exercise 4: A reusable word counter

Write `count_word(text, word)` that counts whole-word, case-insensitive occurrences of `word`, safely escaping it. Test it with:

- `count_word("Кіт спить. Котик не кіт, а кіт-воркіт — кіт!", "кіт")`
- `count_word("Python 3.5 and 3x5 and 3.5.", "3.5")`

## Solutions

### Exercise 1

```python
import re

s = "Hi, Bob!"

print([m.start() for m in re.finditer(r"\b", s)])
```

Output:

```text
[0, 2, 4, 7]
```

Position 0 is before `H`, 2 is between `i` and `,`, 4 is between the space and `B`, and 7 is between `b` and `!`. The end of the string (position 8) is not a boundary because `!` is not a word character.

### Exercise 2

```python
import re

text = "The theme of the story: there is the end"

print(len(re.findall(r"\bthe\b", text, re.IGNORECASE)))
```

Output:

```text
3
```

### Exercise 3

```python
import re

print(re.sub(r"\bcat\b", "dog", "cat category concat cat."))
```

Output:

```text
dog category concat dog.
```

### Exercise 4

```python
import re


def count_word(text, word):
    pattern = rf"\b{re.escape(word)}\b"
    return len(re.findall(pattern, text, re.IGNORECASE))


print(count_word("Кіт спить. Котик не кіт, а кіт-воркіт — кіт!", "кіт"))
print(count_word("Python 3.5 and 3x5 and 3.5.", "3.5"))
```

Output:

```text
4
2
```

In the first text, `Кіт`, `кіт`, the `кіт` before the hyphen and the final `кіт` count. `Котик` is a different word, and the `кіт` at the end of `воркіт` follows the letter `р`, so there is no boundary in front of it. In the second text, `re.escape()` turns the dot into `\.`, so `3x5` no longer matches.

---

*Source: [pythontutorial.net — Python Regex Word Boundary](https://www.pythontutorial.net/python-regex/python-regex-word-boundary/). Adapted and expanded for PyJourney.*
