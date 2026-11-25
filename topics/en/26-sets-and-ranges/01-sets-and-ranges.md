# Sets & Ranges

The built-in character sets `\d`, `\w` and `\s` cover common groups of characters, but very often you need your own group: "a vowel", "a hexadecimal digit", "anything except a quote". Square brackets let you build exactly that. A set such as `[aeiou]`, `[0-9a-f]` or `[^"]` matches **one character** from the group you describe, and it is one of the most frequently used tools in regular expressions.

## What you'll learn

- How `[...]` builds a custom set that matches exactly one character
- How ranges such as `a-z` and `0-9` work, and why they are based on code points
- How to mix ranges, single characters and shorthand sets like `\d` and `\s` in one set
- How to negate a set with `[^...]`, and how this caret differs from the `^` anchor
- Which characters are special inside brackets and how to match them literally
- Why `[а-я]` misses Ukrainian letters and how to write a correct set for them

## Sets: one of several characters

Characters listed inside square brackets form a **set**. The set matches any **one** of them. `[cs]` means "either `c` or `s`", so the pattern `licen[cs]e` finds both the British and the American spelling:

```python
import re

s = 'A licence or license'

for match in re.finditer(r'licen[cs]e', s):
    print(match.group())
```

Output:

```text
licence
license
```

The pattern reads as: `licen`, then one character that is `c` or `s`, then `e`.

A set always stands for **exactly one character**, no matter how many characters are listed in it:

```python
import re

print(re.findall(r"gr[ae]y", "gray grey graey"))
```

Output:

```text
['gray', 'grey']
```

`graey` does not match: after `gr` the set consumes one character (`a`), and the pattern then needs `y`, not `e`. To allow several characters from a set, add a quantifier: `[ae]+`, `[0-9]{4}` (see the topic Quantifiers).

Inside a set, order and repetition do not matter: `[cs]`, `[sc]` and `[ccs]` are the same set.

### Metacharacters lose their power inside a set

Most characters that are special in a pattern are ordinary inside brackets. `.`, `*`, `+`, `?`, `$`, `(`, `)` and `|` all match themselves:

```python
import re

print(re.findall(r"[.?!]", "Hi! How are you? Fine."))
```

Output:

```text
['!', '?', '.']
```

Here `[.?!]` means "a dot, a question mark or an exclamation mark". There is no need to write `[\.\?!]`, although the escapes would not hurt. Only four characters keep a special meaning inside a set: `]`, `\`, `^` and `-` (see "Special characters inside a set" below).

## Ranges

Listing every letter from `a` to `z` would be tedious. A hyphen between two characters creates a **range**:

| Set | Matches one... |
|---|---|
| `[0-9]` | ASCII digit |
| `[a-z]` | lowercase Latin letter |
| `[A-Z]` | uppercase Latin letter |
| `[a-zA-Z]` | Latin letter of either case (two ranges in one set) |
| `[0-9a-fA-F]` | hexadecimal digit (three ranges) |
| `[a-z0-9_]` | lowercase letter, digit or underscore (ranges plus a single character) |

```python
import re

text = "Room B12, floor 3, code x9-Z"

print(re.findall(r"[0-9]", text))
print(re.findall(r"[A-Z]", text))
print(re.findall(r"[0-9]+", text))
print(re.findall(r"[a-zA-Z0-9]+", text))
```

Output:

```text
['1', '2', '3', '9']
['R', 'B', 'Z']
['12', '3', '9']
['Room', 'B12', 'floor', '3', 'code', 'x9', 'Z']
```

### Ranges are code point ranges

A range does not know about "letters" or "digits". `x-y` simply means "every character whose Unicode code point lies between `x` and `y`". For `0-9`, `a-z` and `A-Z` this gives the expected result, but a range between different groups can contain surprises. Between `Z` (90) and `a` (97) there are six punctuation characters:

```text
code point:  65 ... 90  91  92  93  94  95  96  97 ... 122
character:    A ...  Z   [   \   ]   ^   _   `   a ...   z
```

So `[A-z]` is **not** "any Latin letter":

```python
import re

print(re.findall(r"[A-z]", "Az_^["))
```

Output:

```text
['A', 'z', '_', '^', '[']
```

Always write `[A-Za-z]` instead.

A range must go from the smaller code point to the larger one. A reversed range is a syntax error:

```python
import re

try:
    re.compile(r"[z-a]")
except re.PatternError as error:
    print(error)
```

Output:

```text
bad character range z-a at position 1
```

(`re.PatternError` is the Python 3.13+ name of the exception. The old name `re.error` still works as an alias.)

### Ranges are about characters, not numbers

`[1-31]` does **not** mean "a number from 1 to 31". It is the range `1-3` plus the single character `1`, so it matches one character: `1`, `2` or `3`:

```python
import re

print(re.findall(r"[1-31]", "0 1 2 3 10 31 4"))
```

Output:

```text
['1', '2', '3', '1', '3', '1']
```

Numeric ranges have to be built digit by digit. For example, minutes `00` to `59` are `[0-5][0-9]`: the first digit from `0` to `5`, the second from `0` to `9`. Ranges whose digits depend on each other, such as hours `00` to `23`, also need alternation, which the topic Alternation covers.

### Ranges and Unicode: the Ukrainian alphabet

In Python 3, string patterns work with Unicode, so ranges of any script are allowed. But the code point rule matters here too. The range `а-я` covers U+0430 to U+044F, which is the basic block of Cyrillic letters. The Ukrainian letters `є`, `і`, `ї` and `ґ` lie **outside** it:

```text
U+0430 а ... U+044F я      the range а-я
U+0454 є   U+0456 і   U+0457 ї   U+0491 ґ   outside the range
```

As a result, `[а-яА-Я]+` cuts Ukrainian words into pieces:

```python
import re

text = "Київ, Львів, Запоріжжя"

print(re.findall(r"[а-яА-Я]+", text))
```

Output:

```text
['Ки', 'в', 'Льв', 'в', 'Запор', 'жжя']
```

A correct set lists the Ukrainian alphabet explicitly. `а-щ` covers `а` to `щ`, then `ь`, `ю`, `я` and the four special letters are added one by one. The apostrophe (both `'` and `ʼ`) belongs to Ukrainian words too:

```python
import re

text = "Київ, Львів, Запоріжжя, м'ята, пʼять"
uk_word = r"[а-щьюяґєіїА-ЩЬЮЯҐЄІЇ'ʼ]+"

print(re.findall(uk_word, text))
```

Output:

```text
['Київ', 'Львів', 'Запоріжжя', "м'ята", 'пʼять']
```

This set also excludes Cyrillic letters that are not in the Ukrainian alphabet (such as `ы` and `ё`), which is useful for validation.

When you need "a letter of any alphabet" rather than a specific alphabet, use the trick `[^\W\d_]`: "not a non-word character, not a digit, not an underscore", which leaves exactly the letters:

```python
import re

print(re.findall(r"[^\W\d_]+", "Київ_2024 café 42 naïve"))
```

Output:

```text
['Київ', 'café', 'naïve']
```

## Shorthand sets inside a set

The shorthand sets `\d`, `\w`, `\s` and their inverses can be placed inside brackets and combined with other characters and ranges:

| Set | Matches one... |
|---|---|
| `[\d\s]` | digit or whitespace character |
| `[\d_]` | digit or underscore |
| `[\w.-]` | word character, dot or hyphen |
| `[\s,;]` | whitespace character, comma or semicolon |

```python
import re

print(re.findall(r"[\d\s]", "a1 b2\tc"))
print(re.findall(r"[\d_]", "a_1-b2"))
print(re.findall(r"[\w.-]+", "Files: report-v2.pdf, data_2024.csv"))
```

Output:

```text
['1', ' ', '2', '\t']
['_', '1', '2']
['Files', 'report-v2.pdf', 'data_2024.csv']
```

The shorthand sets keep their Unicode meaning inside brackets (see the topic Character Set): `[\d_]` also accepts Arabic-Indic digits, while `[0-9_]` does not.

## Negated sets: `[^...]`

A caret **right after the opening bracket** negates the set: `[^...]` matches one character that is **not** listed. The source example finds the letters of `Python` that are not vowels:

```python
import re

for match in re.finditer(r'[^aeiou]', 'Python'):
    print(match.group())
```

Output:

```text
P
y
t
h
n
```

"Not a vowel" is not the same as "a consonant". A negated set matches **everything** else: uppercase vowels, digits, spaces, punctuation and even the newline:

```python
import re

print(re.findall(r"[^aeiou]", "Hello World!"))
print(re.findall(r"[^a]", "a\nb"))
```

Output:

```text
['H', 'l', 'l', ' ', 'W', 'r', 'l', 'd', '!']
['\n', 'b']
```

The newline behaviour differs from the dot. `.` never matches `\n` without `re.DOTALL`, but `[^"]` does, because a newline is "not a quote". That is usually what you want for a quoted string that spans lines:

```python
import re

text = 'a "multi\nline" b'

print(re.findall(r'"[^"]*"', text))
print(re.findall(r'".*"', text))
```

Output:

```text
['"multi\nline"']
[]
```

`"[^"]*"` ("a quote, any number of non-quotes, a quote") is the classic pattern for text between delimiters. The topic Greedy Quantifiers explains why it is more precise than `".*"` and `".*?"`.

### `[^0-9]` and `\D` are not always the same

The source says that `[^0-9]` is the same as `\D`. That is true only for ASCII text. In Unicode mode `\D` excludes **all** Unicode digits, while `[^0-9]` excludes only the ten ASCII digits:

```python
import re

text = "٣4"  # Arabic-Indic three, then ASCII four

print(re.findall(r"[^0-9]", text))
print(re.findall(r"\D", text))
print(re.findall(r"\D", text, re.ASCII))
```

Output:

```text
['٣']
[]
['٣']
```

### The caret inside and outside brackets

The caret has two unrelated jobs:

- **Outside** brackets, `^` is an anchor: "the beginning of the string" (or of a line with `re.MULTILINE`). See the topic Anchors.
- **Right after `[`**, it negates the set.
- **Anywhere else inside brackets**, it is an ordinary character: `[a^b]` matches `a`, `^` or `b`.

Both meanings can appear in one pattern. `^[^#]` means "at the start of a line, a character that is not `#`". Here it keeps the lines of a config file that are not comments:

```python
import re

config = """# comment
host = example.com
#port = 80
user = admin"""

print(re.findall(r"^[^#].*", config, re.MULTILINE))
```

Output:

```text
['host = example.com', 'user = admin']
```

## Special characters inside a set

Only four characters need care inside brackets:

| Character | Meaning inside `[...]` | How to match it literally |
|---|---|---|
| `]` | closes the set | `\]`, or put it first: `[]a]` |
| `\` | starts an escape | `\\` |
| `^` | negation, if first | put it anywhere but first, or `\^` |
| `-` | range, between two characters | put it first or last, or `\-` |

```python
import re

print(re.findall(r"[-+*/]", "3+4-2*5/1"))
print(re.findall(r"[\[\]]", "a[1] b[2]"))
print(re.findall(r"[]a]", "a]b"))
print(re.findall(r"[\^a]", "^a"))
```

Output:

```text
['+', '-', '*', '/']
['[', ']', '[', ']']
['a', ']']
['^', 'a']
```

In `[-+*/]` the hyphen is first, so it is a literal hyphen, not a range. Escaping (`\]`, `\-`) works everywhere and is the most readable choice. The "put it first" tricks are worth recognising when you read other people's patterns.

A hyphen between a shorthand set and another character is an error, because a range needs two single characters at its ends:

```python
import re

try:
    re.compile(r"[\w-.]")
except re.PatternError as error:
    print(error)
```

Output:

```text
bad character range \w-. at position 1
```

Write `[\w.-]` or `[\w\-.]` instead.

> **Note:** Python reserves some character combinations inside sets for possible future features (nested sets and set operations). A literal `[` inside a set, and the doubled characters `&&`, `||`, `~~` and `--`, trigger a `FutureWarning` such as `Possible nested set at position 1`. Escape them (`[\[a]`) to stay safe. For the same reason, POSIX classes like `[[:digit:]]` from other regex engines do **not** work in Python: they warn and then match something quite different from digits. Use `\d` or `[0-9]`.

## Sets and `re.IGNORECASE`

With the `re.IGNORECASE` flag (short form `re.I`), ranges ignore case as well, so `[a-z]` also matches uppercase letters:

```python
import re

print(re.findall(r"[a-z]+", "Hello WORLD"))
print(re.findall(r"[a-z]+", "Hello WORLD", re.IGNORECASE))
```

Output:

```text
['ello']
['Hello', 'WORLD']
```

The topic Regex Flags covers this and the other flags in detail.

## Common mistakes

- **Writing `[A-z]` for "any Latin letter".** It also matches `[`, `\`, `]`, `^`, `_` and `` ` ``. Use `[A-Za-z]`.
- **Treating ranges as numbers.** `[1-31]` is the set `{1, 2, 3}`, and `[0-255]` is `{0, 1, 2, 5}`. Build numeric ranges digit by digit.
- **Using `[а-я]` for Ukrainian text.** It misses `є`, `і`, `ї` and `ґ`. List the alphabet explicitly or use `[^\W\d_]` for any letter.
- **Putting words inside brackets.** `[cat|dog]` is the set of the single characters `c`, `a`, `t`, `|`, `d`, `o`, `g`, so `[cat|dog]+` happily matches `"cat|dog"` and the `co` in `"cow"`. To match whole words, use alternation: `cat|dog`.
- **Forgetting that a negated set matches newlines and punctuation.** `[^aeiou]` is "any character except these five", not "a consonant".
- **Placing `-` in the middle by accident.** `[\w-.]` is an error, and `[a-z-0]` is hard to read. Put a literal hyphen first or last, or escape it.
- **Expecting `[^abc]` to mean "not the string abc".** A set is always one character. `[^abc]` is one character other than `a`, `b` and `c`.

## Summary

- `[...]` matches exactly one character from the listed group. Add a quantifier to match several.
- `x-y` inside brackets is a range of code points. Several ranges, single characters and shorthand sets can be combined: `[a-zA-Z0-9_]`, `[\d\s]`, `[\w.-]`.
- Most metacharacters are literal inside a set. Only `]`, `\`, `^` and `-` need care.
- `[^...]` matches any one character not in the set, including newlines and punctuation. The caret negates only right after `[`.
- `[^0-9]` and `\D` differ for non-ASCII digits.
- `[а-я]` does not cover four Ukrainian letters. For Ukrainian words list the alphabet explicitly (with the apostrophes), and for letters of any alphabet use `[^\W\d_]`.

## Practice

### Exercise 1: Hex colours

Find every valid six-digit hex colour in this text. Hex digits may be upper- or lowercase. `#fff` (three digits), `#12345G` (not hex) and `#1234567` (seven digits) must not match.

```python
text = "color: #1A2b3C; bg: #fff; bad: #12345G; ok: #00ff00; long: #1234567"
```

### Exercise 2: Ukrainian words

Extract all words from the text below. First try `[а-яА-Я]+` and look at what goes wrong, then write a set that returns whole Ukrainian words, including the ones with an apostrophe.

```python
text = "Їжак і ґава п'ють чай у Євпаторії"
```

### Exercise 3: A safe file name

Replace every character that is not a letter, a digit, a dot, a hyphen or an underscore with `_`. `"my report (final) v2.pdf"` should become `"my_report__final__v2.pdf"`.

### Exercise 4: Predict the sets

Predict the output of each line before running the code:

```python
import re

print(re.findall(r"[1-31]", "0 1 2 3 10 31 4"))
print(re.findall(r"[A-z]", "Az_^["))
print(re.findall(r"[^a]", "a\nb"))
print(re.findall(r"[.+]", "1.5+2"))
print(re.findall(r"[a-]", "a-b"))
```

## Solutions

### Exercise 1

```python
import re

text = "color: #1A2b3C; bg: #fff; bad: #12345G; ok: #00ff00; long: #1234567"

print(re.findall(r"#[0-9a-fA-F]{6}\b", text))
```

Output:

```text
['#1A2b3C', '#00ff00']
```

`[0-9a-fA-F]` is one hex digit, and `{6}` requires exactly six of them. The word boundary `\b` rejects `#1234567`: after six digits the next character is `7`, a word character, so there is no boundary there. `#12345G` fails because `G` is not in the set.

### Exercise 2

```python
import re

text = "Їжак і ґава п'ють чай у Євпаторії"

print(re.findall(r"[а-яА-Я]+", text))
print(re.findall(r"[а-щьюяґєіїА-ЩЬЮЯҐЄІЇ'ʼ]+", text))
```

Output:

```text
['жак', 'ава', 'п', 'ють', 'чай', 'у', 'впатор']
['Їжак', 'і', 'ґава', "п'ють", 'чай', 'у', 'Євпаторії']
```

The basic range loses every letter that lies outside it (in both cases), and the apostrophe splits a word in two. The full set lists the Ukrainian letters outside `а-я` and both apostrophe characters.

### Exercise 3

```python
import re

print(re.sub(r"[^\w.-]", "_", "my report (final) v2.pdf"))
```

Output:

```text
my_report__final__v2.pdf
```

The negated set `[^\w.-]` matches one character that is not a word character, not a dot and not a hyphen. The hyphen is last, so it is literal. Each space and each bracket is replaced separately, which is why there are two underscores in a row. Use `[^\w.-]+` to collapse such runs into one `_`.

### Exercise 4

Output:

```text
['1', '2', '3', '1', '3', '1']
['A', 'z', '_', '^', '[']
['\n', 'b']
['.', '+']
['a', '-']
```

- `[1-31]` is the set `{1, 2, 3}`. It finds single digits, including the `1` in `10` and both digits of `31`.
- `[A-z]` contains the punctuation between `Z` and `a`, so `_`, `^` and `[` match.
- `[^a]` matches the newline too.
- `.` and `+` are literal inside a set.
- A hyphen at the end of a set is literal.

---

*Source: [pythontutorial.net — Python Regex Sets & Ranges](https://www.pythontutorial.net/python-regex/python-regex-sets-ranges/). Adapted and expanded for PyJourney.*
