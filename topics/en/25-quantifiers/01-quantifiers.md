# Quantifiers

A **quantifier** says how many times the element in front of it may repeat: "one or more digits", "an optional `u`", "exactly four digits". Without quantifiers you would have to write `\d\d\d\d` for a year and could not express "a number of any length" at all. With them, short patterns describe numbers, words, dates and phone numbers of variable length.

## What you'll learn

- The quantifiers `*`, `+`, `?`, `{n}`, `{n,}`, `{,m}` and `{n,m}`
- Which part of the pattern a quantifier applies to, and how to repeat a sequence
- Why `*` can produce empty matches
- How to combine quantifiers with anchors and word boundaries for precise matches
- The rules and errors around curly braces
- That quantifiers are greedy by default

## Quantifiers at a glance

| Quantifier | Matches the preceding element | Same as |
|---|---|---|
| `*` | zero or more times | `{0,}` |
| `+` | one or more times | `{1,}` |
| `?` | zero times or once (optional) | `{0,1}` |
| `{n}` | exactly `n` times | |
| `{n,}` | at least `n` times | |
| `{,m}` | from zero to `m` times | `{0,m}` |
| `{n,m}` | from `n` to `m` times (inclusive) | |

## What a quantifier applies to

A quantifier repeats only the **single element right before it**. That element can be:

- one literal character: `a+`;
- an escape such as `\d+` or `\w*`;
- the dot: `.+`;
- a set in square brackets: `[aeiou]+` (see the Sets & Ranges topic);
- a group in parentheses: `(?:ha)+` (see the Groupings section).

So `ha+` means "`h`, then one or more `a`", not "one or more `ha`". To repeat a sequence of characters, wrap it in a group:

```python
import re

text = "haaa hahaha"

print(re.findall(r"ha+", text))
print(re.findall(r"(?:ha)+", text))
```

Output:

```text
['haaa', 'ha', 'ha', 'ha']
['ha', 'hahaha']
```

`(?:...)` is a **non-capturing group**. It only groups. A plain `(...)` would capture, and then `findall()` would return the captured part instead of the whole match. The Groupings section explains the difference.

## `*`: zero or more times

`*` lets the preceding element appear any number of times, including not at all. `\w*Python` means "zero or more word characters, followed by `Python`":

```python
import re

s = """CPython, IronPython, and JPython
       are major Python's implementation"""

for match in re.finditer(r"\w*Python", s):
    print(match)
```

Output:

```text
<re.Match object; span=(0, 7), match='CPython'>
<re.Match object; span=(9, 19), match='IronPython'>
<re.Match object; span=(25, 32), match='JPython'>
<re.Match object; span=(50, 56), match='Python'>
```

`\w*` takes `C`, `Iron` and `J` in the first three words, and nothing at all before the standalone `Python`. Zero repetitions are a perfectly valid match.

That "zero is fine" rule has a side effect. A pattern made only of `x*` matches **everywhere**, even where there is nothing to match, producing empty strings:

```python
import re

print(re.findall(r"\d*", "a12b"))
print(re.findall(r"\d+", "a12b"))
```

Output:

```text
['', '12', '', '']
['12']
```

At `a` the engine finds "zero digits", which is an empty match. Then it finds `12`, then zero digits at `b`, and finally zero digits at the end of the string. If at least one character is required, use `+`.

## `+`: one or more times

`+` requires at least one occurrence. `\d+` matches a whole number of any length:

```python
import re

s = "Python 3.10 was released in 2021"

for match in re.finditer(r"\d+", s):
    print(match)
```

Output:

```text
<re.Match object; span=(7, 8), match='3'>
<re.Match object; span=(9, 11), match='10'>
<re.Match object; span=(28, 32), match='2021'>
```

`findall()` returns strings. Convert them when you need numbers:

```python
>>> import re
>>> [int(n) for n in re.findall(r"\d+", "Python 3.10 was released in 2021")]
[3, 10, 2021]
```

## `?`: optional

`?` makes the preceding element optional: it may appear once or not at all. The classic example is British and American spelling:

```python
import re

s = "What color / colour do you like?"

for match in re.finditer(r"colou?r", s):
    print(match)
```

Output:

```text
<re.Match object; span=(5, 10), match='color'>
<re.Match object; span=(13, 19), match='colour'>
```

`u?` matches zero or one `u`, so both spellings fit. In the same way, `https?` matches both `http` and `https`.

> **Note:** The question mark has other jobs too. Right after another quantifier it makes that quantifier lazy (`+?`, `*?`, see the Non-Greedy Quantifiers topic), and right after an opening parenthesis it starts a special group, such as `(?:...)`.

## `{n}`: exactly `n` times

`{n}` repeats the preceding element exactly `n` times. Here is a time in the `hh:mm` format:

```python
import re

s = "It was 11:05 AM"

for match in re.finditer(r"\d{2}:\d{2}", s):
    print(match)
```

Output:

```text
<re.Match object; span=(7, 12), match='11:05'>
```

"Exactly two" refers only to this part of the match. It does not forbid more digits around it. Without boundaries, `\d{2}:\d{2}` happily finds `11:05` inside `111:055`:

```python
import re

text = "It was 111:055 and 11:05"

print(re.findall(r"\d{2}:\d{2}", text))
print(re.findall(r"\b\d{2}:\d{2}\b", text))
```

Output:

```text
['11:05', '11:05']
['11:05']
```

The first `11:05` comes from inside `111:055`. Word boundaries (or anchors) make the count really "exactly".

## `{n,}`: at least `n` times

`{n,}` sets only a lower limit. The pattern below matches dates in the `d-m-yyyy` or `dd-mm-yyyy` format, where day and month have one or more digits:

```python
import re

s = "5-5-2021 or 05-05-2021 or 5/5/2021"

for match in re.finditer(r"\d{1,}-\d{1,}-\d{4}", s):
    print(match)
```

Output:

```text
<re.Match object; span=(0, 8), match='5-5-2021'>
<re.Match object; span=(12, 22), match='05-05-2021'>
```

`5/5/2021` uses slashes, so it does not match. Note that `\d{1,}` is just a longer way to write `\d+`.

## `{n,m}`: from `n` to `m` times

`{n,m}` sets both limits, inclusive. A day or month has one or two digits, so `\d{1,2}` describes it more precisely than `\d{1,}`:

```python
import re

s = "5-5-2021 or 05-05-2021 or 5/5/2021"

for match in re.finditer(r"\d{1,2}-\d{1,2}-\d{4}", s):
    print(match)
```

Output:

```text
<re.Match object; span=(0, 8), match='5-5-2021'>
<re.Match object; span=(12, 22), match='05-05-2021'>
```

Two warnings about this pattern:

- Without boundaries it matches parts of longer strings: in `"123-45-20210"` it finds `23-45-2021`. Use `\b...\b` or `fullmatch()`.
- Quantifiers count characters, they do not check values. `45-99-2021` fits the pattern although there is no month 99. Check values in Python with `int()`, or use sets and alternation for strict ranges.

The lower limit can be omitted: `{,m}` means "from zero to `m` times". Like `*`, it allows empty matches:

```python
>>> import re
>>> re.findall(r"\d{,2}", "12345")
['12', '34', '5', '']
```

## Rules for curly braces

- **No spaces inside the braces.** `\d{1, 3}` is not a quantifier. Python treats the braces as literal text and searches for the characters `{1, 3}`:

  ```python
  import re

  print(re.findall(r"\d{1, 3}", "1{1, 3} 123"))
  ```

  Output:

  ```text
  ['1{1, 3}']
  ```

- **Braces that do not form a valid quantifier are literal.** `re.findall(r"x{a}", "x{a}")` returns `['x{a}']`.
- **`n` must not be greater than `m`.** Otherwise compiling fails.
- **A quantifier needs something to repeat.** A quantifier at the very start of a pattern, or two quantifiers in a row, is an error:

```python
import re

for pattern in [r"*abc", r"a**", r"a{3,1}"]:
    try:
        re.compile(pattern)
    except re.error as e:
        print(f"{pattern!r}: {type(e).__name__}: {e}")
```

Output:

```text
'*abc': PatternError: nothing to repeat at position 0
'a**': PatternError: multiple repeat at position 2
'a{3,1}': PatternError: min repeat greater than max repeat at position 2
```

Since Python 3.13 the exception class is called `re.PatternError`. The old name `re.error` remains as an alias, so `except re.error` keeps working in all versions.

Some combinations of two symbols are legal because they mean something else: `a*?` is a lazy quantifier, and `a*+` is a possessive quantifier (Python 3.11+, see the Greedy Quantifiers topic).

## Combining quantifiers with anchors and boundaries

Quantifiers describe **how many**, anchors and boundaries describe **where**. Together they make precise patterns. Here is a Ukrainian mobile number in the format `+380 67 123 45 67`:

```python
>>> import re
>>> re.fullmatch(r"\+380 \d{2} \d{3} \d{2} \d{2}", "+380 67 123 45 67")
<re.Match object; span=(0, 17), match='+380 67 123 45 67'>
```

The plus sign is escaped as `\+`, because a bare `+` is a quantifier. A pattern that starts with `+` would not even compile.

Word boundaries keep a length limit from cutting long words into pieces:

```python
import re

print(re.findall(r"\w{3,5}", "programming"))
print(re.findall(r"\b\w{3,5}\b", "I am in the garden with my cat and a puppy"))
print(re.findall(r"\b\w{3,5}\b", "Я в саду з котом і цуценям, разом гуляємо"))
```

Output:

```text
['progr', 'ammin']
['the', 'with', 'cat', 'and', 'puppy']
['саду', 'котом', 'разом']
```

Without boundaries, `programming` is chopped into five-letter pieces. With boundaries, only whole words of three to five letters remain. Because `\w` is Unicode-aware, the same pattern works for the Ukrainian sentence.

## Quantifiers are greedy

By default every quantifier takes **as many** repetitions as possible while the rest of the pattern can still match. That is why `\d+` on `"2021"` returns `2021`, not `2`. Usually this is what you want, but sometimes it grabs too much. The next two topics, Greedy Quantifiers and Non-Greedy Quantifiers, explain how this works and how to change it.

## Common mistakes

- **Forgetting that a quantifier repeats only one element.** `ha+` does not repeat `ha`. Use `(?:ha)+`.
- **Using `*` when at least one character is required.** `\d*` produces empty matches. Use `\d+`.
- **Putting spaces inside braces.** `{1, 3}` is literal text, not a quantifier.
- **Forgetting boundaries or anchors.** `\d{4}` finds `1234` inside `ID 123456`. Use `\b\d{4}\b` or `fullmatch()`.
- **Forgetting to escape `+`, `*` or `?` when you mean the character.** `r"+380"` raises `PatternError: nothing to repeat`. Write `r"\+380"`.
- **Expecting quantifiers to check values.** `\d{1,2}` accepts `99` as a month.

## Summary

- A quantifier repeats the single element right before it: a character, a class, a set or a group.
- `*` means zero or more, `+` one or more, `?` zero or one.
- `{n}` means exactly `n`, `{n,}` at least `n`, `{,m}` at most `m`, and `{n,m}` between `n` and `m`.
- `*`, `?` and `{,m}` allow zero repetitions, so patterns made only of them can produce empty matches.
- No spaces inside braces. Invalid braces are treated as literal text.
- Combine quantifiers with `\b`, anchors or `fullmatch()` so that "exactly `n`" really means exactly `n`.
- Quantifiers are greedy by default.

## Practice

### Exercise 1: Sum the numbers

Extract all whole numbers from `"Order 66 shipped 3 items for 1250 UAH"` and print the list and their sum.

### Exercise 2: Web links

Find all links that start with `http://` or `https://` in `"See http://a.com and https://b.org/x or ftp://c.net"`. The link continues until the next whitespace character. The `ftp` link must not match.

### Exercise 3: Phone validator

Write `is_ua_phone(text)` that accepts only numbers in the format `+380 67 123 45 67` (a plus, `380`, then groups of 2, 3, 2 and 2 digits separated by single spaces). Test it with `"+380 67 123 45 67"`, `"+380 67 1234 5 67"`, `"380 67 123 45 67"` and `"+380 67 123 45 678"`.

### Exercise 4: Short words

Find all words of three to five letters in `"I am in the garden with my cat and a puppy"` and in `"Я в саду з котом і цуценям, разом гуляємо"`. Then explain what goes wrong if you remove the word boundaries.

## Solutions

### Exercise 1

```python
import re

text = "Order 66 shipped 3 items for 1250 UAH"

numbers = re.findall(r"\d+", text)
print(numbers)
print(sum(int(n) for n in numbers))
```

Output:

```text
['66', '3', '1250']
1319
```

### Exercise 2

```python
import re

text = "See http://a.com and https://b.org/x or ftp://c.net"

print(re.findall(r"https?://\S+", text))
```

Output:

```text
['http://a.com', 'https://b.org/x']
```

`s?` makes the `s` optional, and `\S+` takes one or more non-whitespace characters. Be aware that `\S+` would also take punctuation that follows a link, such as a comma. Real URL matching needs a stricter pattern.

### Exercise 3

```python
import re


def is_ua_phone(text):
    return re.fullmatch(r"\+380 \d{2} \d{3} \d{2} \d{2}", text) is not None


for candidate in ["+380 67 123 45 67", "+380 67 1234 5 67", "380 67 123 45 67", "+380 67 123 45 678"]:
    print(f"{candidate!r:22} {is_ua_phone(candidate)}")
```

Output:

```text
'+380 67 123 45 67'    True
'+380 67 1234 5 67'    False
'380 67 123 45 67'     False
'+380 67 123 45 678'   False
```

### Exercise 4

```python
import re

english = "I am in the garden with my cat and a puppy"
ukrainian = "Я в саду з котом і цуценям, разом гуляємо"

print(re.findall(r"\b\w{3,5}\b", english))
print(re.findall(r"\b\w{3,5}\b", ukrainian))
print(re.findall(r"\w{3,5}", ukrainian))
```

Output:

```text
['the', 'with', 'cat', 'and', 'puppy']
['саду', 'котом', 'разом']
['саду', 'котом', 'цуцен', 'разом', 'гуляє']
```

Without boundaries, the engine takes the first five letters of the longer words `цуценям` and `гуляємо` and returns those pieces. The remaining `ям` and `мо` are too short to match on their own.

---

*Source: [pythontutorial.net — Python Regex Quantifiers](https://www.pythontutorial.net/python-regex/python-regex-quantifiers/). Adapted and expanded for PyJourney.*
