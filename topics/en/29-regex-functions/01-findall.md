# findall()

`re.findall()` scans a string and collects **every** match of a pattern into a list. It is the quickest way to pull data out of text: all the numbers in a report, all the hashtags in a post, all the `key=value` pairs in a config line. Its one surprise is that the *shape* of the result depends on the capturing groups in your pattern, so that is the main thing to master here.

## What you'll learn

- The signature of `re.findall()` and how it scans a string
- Why matches never overlap, and how to get overlapping matches anyway
- How 0, 1 or several capturing groups change what the list contains
- How non-capturing groups `(?:...)` keep the full match in the result
- What happens with no matches and with patterns that can match an empty string
- When to choose `finditer()` instead of `findall()`

## The signature

```python
re.findall(pattern, string, flags=0)
```

- `pattern` is the regular expression, written as a raw string (`r'...'`) or a compiled `Pattern` object.
- `string` is the text to search.
- `flags` is an optional regex flag such as `re.IGNORECASE`, or several flags combined with `|`.

`findall()` always returns a **list**. The engine starts at position 0, tries to match, and if it succeeds, it records the match and continues **right after the end** of that match. If it fails, it moves one character forward and tries again. This continues to the end of the string.

```python
import re

s = "black, blue and brown"
matches = re.findall(r"bl\w+", s)

print(matches)
```

Output:

```text
['black', 'blue']
```

The pattern `bl\w+` means "the literal letters `bl`, followed by one or more word characters". `brown` starts with `br`, so it is not in the list.

### Matches do not overlap

Because scanning resumes *after* each match, a character can belong to only one match:

```python
import re

print(re.findall(r"\d\d", "12345"))  # ['12', '34']
print(re.findall(r"aa", "aaaa"))  # ['aa', 'aa']
```

`12` is consumed by the first match, so the engine never considers `23`. The final `5` has no partner and is skipped.

If you really need overlapping matches, put a capturing group inside a **lookahead**. A lookahead checks the text without consuming it, so the engine can try again from the very next character:

```python
import re

print(re.findall(r"(?=(\d\d))", "12345"))  # ['12', '23', '34', '45']
```

## The result depends on capturing groups

This is the most important rule of `findall()`:

| Capturing groups in the pattern | Each item in the list is |
|---|---|
| none | the text of the whole match (`str`) |
| exactly one | the text captured by that group (`str`) |
| two or more | a `tuple` with the text of every group |

The idea is that groups mark "the part I actually want". If you ask for parts, `findall()` gives you the parts and drops the rest.

### No groups: whole matches

That is the first example above: `bl\w+` has no parentheses, so you get whole words.

### One group: just that group

```python
import re

s = "black, blue and brown"
matches = re.findall(r"bl(\w+)", s)

print(matches)
```

Output:

```text
['ack', 'ue']
```

The engine still matches `black` and `blue` completely, but only the text of the group `(\w+)` lands in the list.

### Several groups: tuples

```python
import re

s = "black, blue and brown"
matches = re.findall(r"(bl(\w+))", s)

print(matches)
```

Output:

```text
[('black', 'ack'), ('blue', 'ue')]
```

Groups are numbered by their **opening** parenthesis from left to right. The outer group `(bl(\w+))` is group 1 and captures the whole word. The inner `(\w+)` is group 2. Each tuple lists the groups in that order.

Tuples are handy for extracting structured data. Two groups per match turn naturally into a dictionary:

```python
import re

line = "width=800 height=600 depth=12"
pairs = re.findall(r"(\w+)=(\d+)", line)

print(pairs)
print(dict(pairs))
```

Output:

```text
[('width', '800'), ('height', '600'), ('depth', '12')]
{'width': '800', 'height': '600', 'depth': '12'}
```

### Groups that did not take part in a match

If a group is optional and did not match, `findall()` puts an **empty string** in its place. (A `Match` object would give you `None` for the same group.)

```python
import re

print(re.findall(r"(\d+)(px)?", "10px 20 30px"))
```

Output:

```text
[('10', 'px'), ('20', ''), ('30', 'px')]
```

## Non-capturing groups keep the whole match

Sometimes you need parentheses only for grouping, for example to apply alternation to part of a pattern. A plain group changes the result shape, which is a classic surprise:

```python
import re

s = "black, blue and brown"

print(re.findall(r"(bl|br)\w+", s))
print(re.findall(r"(?:bl|br)\w+", s))
```

Output:

```text
['bl', 'bl', 'br']
['black', 'blue', 'brown']
```

The first pattern has a capturing group, so `findall()` returns only `bl` or `br` for each match. The non-capturing group `(?:...)` groups the alternation without capturing anything, so the result goes back to whole matches.

> **Tip:** When you use `findall()`, ask yourself for every pair of parentheses: "Do I want this part in the result?" If not, write `(?:...)`.

## Using flags

The third argument accepts regex flags. With `re.IGNORECASE`, `bl` also matches `Bl` and `BL`:

```python
import re

s = "Black, blue and brown"
matches = re.findall(r"(bl(\w+))", s, re.IGNORECASE)

print(matches)
```

Output:

```text
[('Black', 'ack'), ('blue', 'ue')]
```

Combine several flags with `|`, for example `re.IGNORECASE | re.MULTILINE`. Unlike `re.sub()` and `re.split()`, `findall()` has no other optional parameters before `flags`, so passing flags as the third positional argument is safe here. Writing `flags=re.IGNORECASE` is still a good habit.

## No matches: an empty list, never `None`

When nothing matches, `findall()` returns `[]`. It never returns `None`, so you can test the result directly:

```python
import re

numbers = re.findall(r"\d+", "no digits here")
print(numbers)

if not numbers:
    print("Nothing found")
```

Output:

```text
[]
Nothing found
```

## Patterns that can match an empty string

A quantifier such as `*` or `?` allows a pattern to match **zero** characters. `findall()` then reports those empty matches too:

```python
import re

print(re.findall(r"\d*", "a1b22"))
print(re.findall(r"\d+", "a1b22"))
```

Output:

```text
['', '1', '', '22', '']
['1', '22']
```

With `\d*`, the engine finds an empty match before `a`, the match `1`, an empty match before `b`, the match `22`, and a final empty match at the very end of the string. In almost every real task you want `+` ("at least one") instead.

## Compiled patterns: `Pattern.findall()`

If you reuse a pattern, compile it once with `re.compile()`. The compiled object has its own `findall()` method that also accepts `pos` and `endpos` to limit the search to a slice of the string:

```python
import re

number = re.compile(r"\d+")
text = "10 20 30 40"

print(number.findall(text))
print(number.findall(text, 3, 8))
```

Output:

```text
['10', '20', '30', '40']
['20', '30']
```

The second call only looks at `text[3:8]`, which is `"20 30"`.

> **Note:** The module-level functions (`re.findall()`, `re.search()` and the others) cache recently compiled patterns, so compiling is not required for speed in small scripts. Compile when it makes the code clearer, when you need `pos`/`endpos`, or when one pattern is used in many places.

## `findall()` vs `finditer()`

Both functions find all non-overlapping matches. They differ in what they give you back:

| | `findall()` | `finditer()` |
|---|---|---|
| Returns | a `list` | an iterator |
| Items | strings or tuples of strings | `Match` objects |
| Effect of groups | changes the item type | none, you always get a full `Match` |
| Positions of matches | not available | `start()`, `end()`, `span()` |
| Memory | builds the whole list at once | produces one match at a time |

```python
import re

s = "black, blue and brown"

print(re.findall(r"bl(\w+)", s))
for m in re.finditer(r"bl(\w+)", s):
    print(m.group(0), m.group(1), m.span())
```

Output:

```text
['ack', 'ue']
black ack (0, 5)
blue ue (7, 11)
```

Choose `findall()` when you just need the matched text. Choose `finditer()` when you need positions, named groups, or when the input is very large.

## Common mistakes

- **Adding a group "just for grouping".** `(bl|br)\w+` returns `['bl', 'bl', 'br']`, not the words. Use `(?:bl|br)\w+`.
- **Forgetting the raw string.** In a normal string `'\b'` is the *backspace* character, not a word boundary, so the pattern silently matches nothing:

  ```python
  import re

  print(re.findall("\bcat\b", "cat"))  # []
  print(re.findall(r"\bcat\b", "cat"))  # ['cat']
  ```

  Other sequences such as `"\d"` happen to work but trigger a `SyntaxWarning` since Python 3.12. Always write patterns as raw strings.
- **Expecting `None` when nothing matches.** `findall()` returns an empty list. Code like `if result is None:` never runs.
- **Using `*` where `+` is meant.** Patterns that can match an empty string fill the list with `''` items.
- **Expecting overlapping matches.** `findall()` never reuses characters. Use a lookahead with a group, as shown above.
- **Forgetting the tuple shape.** With two or more groups, each item is a tuple. Unpack it (`for key, value in pairs:`) instead of treating it as a string.

## Summary

- `re.findall(pattern, string, flags=0)` returns a list of all non-overlapping matches, scanning from left to right.
- No groups: a list of whole matches. One group: a list of that group's text. Several groups: a list of tuples.
- Optional groups that did not match appear as `''` in the result.
- Non-capturing groups `(?:...)` group without changing the result shape.
- No matches give `[]`, never `None`.
- Patterns that can match an empty string produce empty items. Prefer `+` over `*` when you need real content.
- Use `finditer()` when you need positions or `Match` objects, and `Pattern.findall(string, pos, endpos)` to search part of a string.

## Practice

### Exercise 1: Extract hashtags

Given `post = "Loving #Python and #regex! #100DaysOfCode"`, use one `findall()` call to get the hashtag names **without** the `#` sign: `['Python', 'regex', '100DaysOfCode']`.

### Exercise 2: Prices to a dictionary

Turn `"apple=1.25, pear=0.8, kiwi=2"` into the dictionary `{'apple': 1.25, 'pear': 0.8, 'kiwi': 2.0}`. Use a pattern with two groups and convert the prices to `float`.

### Exercise 3: Count a word

Count how many times the **word** "the" appears in the text below, ignoring case. "There" and "other" must not be counted.

```python
text = "The cat saw the dog. There was the other cat. THE END."
```

### Exercise 4: Overlapping occurrences

`re.findall(r"ana", "bananarama")` returns one match, but "ana" actually occurs twice (starting at index 1 and at index 3). Write a pattern that finds **both** occurrences and print their count. Then modify it to print the start index of each occurrence.

## Solutions

### Exercise 1

```python
import re

post = "Loving #Python and #regex! #100DaysOfCode"
tags = re.findall(r"#(\w+)", post)
print(tags)
```

Output:

```text
['Python', 'regex', '100DaysOfCode']
```

The `#` must be in the match so that only hashtags are found, but it stays outside the group, so it is not part of the result.

### Exercise 2

```python
import re

data = "apple=1.25, pear=0.8, kiwi=2"
prices = {name: float(price) for name, price in re.findall(r"(\w+)=([\d.]+)", data)}
print(prices)
```

Output:

```text
{'apple': 1.25, 'pear': 0.8, 'kiwi': 2.0}
```

### Exercise 3

```python
import re

text = "The cat saw the dog. There was the other cat. THE END."
count = len(re.findall(r"\bthe\b", text, flags=re.IGNORECASE))
print(count)
```

Output:

```text
4
```

The word boundaries `\b` stop the pattern from matching inside "There" and "other". The flag makes "The" and "THE" count too.

### Exercise 4

```python
import re

s = "bananarama"

print(re.findall(r"ana", s))
print(len(re.findall(r"(?=ana)", s)))

starts = [m.start() for m in re.finditer(r"(?=ana)", s)]
print(starts)
```

Output:

```text
['ana']
2
[1, 3]
```

The lookahead `(?=ana)` matches an *empty* string at every position where "ana" begins, and it consumes nothing, so the second occurrence is not skipped. `findall()` returns `['', '']` for it, which is fine for counting. To get the positions, switch to `finditer()` and use `start()`.

---

*Source: [pythontutorial.net — Python Regex findall()](https://www.pythontutorial.net/python-regex/python-regex-findall/). Adapted and expanded for PyJourney.*
