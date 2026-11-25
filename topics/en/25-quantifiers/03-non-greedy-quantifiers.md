# Non-Greedy Quantifiers

A **non-greedy** (or **lazy**) quantifier is the opposite of a greedy one: it matches **as few** repetitions as possible and takes one more only when the rest of the pattern cannot match yet. You turn any quantifier into a lazy one by adding a question mark: `*?`, `+?`, `??`, `{n,m}?`. Lazy quantifiers are the quickest fix for patterns that "grab too much" between delimiters such as quotes, tags or comment markers.

## What you'll learn

- How to make any quantifier lazy
- How the engine expands a lazy quantifier step by step
- How greedy and lazy versions of every quantifier behave on the same input
- Why a lazy quantifier still returns the leftmost match, not the shortest one
- Why a lazy quantifier at the end of a pattern matches almost nothing
- When to choose a lazy quantifier and when a negated set is better

## Greedy and lazy quantifiers

| Greedy | Lazy | The lazy version matches the preceding element |
|---|---|---|
| `*` | `*?` | zero or more times, as few as possible |
| `+` | `+?` | one or more times, as few as possible |
| `?` | `??` | zero times or once, preferring zero |
| `{n}` | `{n}?` | exactly `n` times (no choice, so the same as greedy) |
| `{n,}` | `{n,}?` | at least `n` times, as few as possible |
| `{n,m}` | `{n,m}?` | from `n` to `m` times, as few as possible |

Both modes accept the same strings. The difference is which match the engine **tries first**: greedy starts with the most repetitions and retreats, lazy starts with the fewest and advances.

## The button example

In the Greedy Quantifiers topic, `".+"` matched from the first quote to the last one. Adding `?` makes `+` lazy, and each quoted value becomes a separate match:

```python
import re

s = '<button type="submit" class="btn">Send</button>'

for match in re.finditer(r'".+?"', s):
    print(match.group())
```

Output:

```text
"submit"
"btn"
```

## How lazy matching works

1. The engine finds the first `"` at index 13.
2. `.+?` must take at least one character, so it takes `s`.
3. The pattern now needs `"`, but the next character is `u`. Instead of failing, the engine lets `.+?` take **one more** character and checks again.
4. This repeats until `.+?` holds `submit` and the next character is `"`. The pattern completes: the match is `"submit"`.
5. `finditer()` continues after the match and finds `"btn"` in the same way.

```text
string:  <button type="submit" class="btn">Send</button>
try 1:                "s
try 2:                "su
try 3:                "sub
try 4:                "subm
try 5:                "submi
try 6:                "submit
```

After try 6 the next character is a quote, so the match is `"submit"`. The lazy quantifier stopped at the **first** closing quote, because that is the first point where the whole pattern succeeds.

## Every quantifier on the same input

`re.match()` on `"aaaa"` shows how much each version takes when nothing after it forces it to take more:

```python
import re

text = "aaaa"
patterns = [
    r"a*", r"a*?",
    r"a+", r"a+?",
    r"a?", r"a??",
    r"a{2}", r"a{2}?",
    r"a{2,}", r"a{2,}?",
    r"a{2,4}", r"a{2,4}?",
]

for pattern in patterns:
    print(f"{pattern:8}", repr(re.match(pattern, text).group()))
```

Output:

```text
a*       'aaaa'
a*?      ''
a+       'aaaa'
a+?      'a'
a?       'a'
a??      ''
a{2}     'aa'
a{2}?    'aa'
a{2,}    'aaaa'
a{2,}?   'aa'
a{2,4}   'aaaa'
a{2,4}?  'aa'
```

Each lazy version takes its **minimum**: zero for `*?` and `??`, one for `+?`, `n` for `{n,}?` and `{n,m}?`. `{n}?` is identical to `{n}`, because "exactly `n`" leaves no choice.

The lazy `??` only changes the preference, not which strings fit. `colou??r` still matches both `color` and `colour`: it first tries without the `u`, and when the next character turns out to be `u` rather than `r`, it backtracks and takes the `u`.

## Lazy does not mean "shortest match"

The engine still picks the **leftmost** starting position first. Laziness only decides how far the match extends from there:

```python
>>> import re
>>> re.search(r"a.*?b", "a a b")
<re.Match object; span=(0, 5), match='a a b'>
```

The shorter `a b` starts at index 2, but a match starting at index 0 exists, so it wins.

A lazy quantifier also keeps expanding **past** a delimiter when the rest of the pattern requires it:

```python
import re

text = "<a> <b>end"

print(re.search(r"<.+?>end", text))
print(re.search(r"<[^>]+>end", text))
```

Output:

```text
<re.Match object; span=(0, 10), match='<a> <b>end'>
<re.Match object; span=(4, 10), match='<b>end'>
```

The lazy `.+?` would prefer to stop at the first `>`, but `end` does not follow it, so it expands through `> <b` until `>end` fits. The negated set `[^>]+` cannot cross a `>`, so the match from index 0 fails and the engine finds `<b>end` instead. Laziness is a **preference**, not a boundary.

## Lazy quantifiers at the end of a pattern

When nothing follows a lazy quantifier, nothing forces it to grow, so it stays at its minimum:

```python
import re

print(re.search(r"\d+?", "12345").group())
print(repr(re.search(r"\d*?", "12345").group()))
print(re.search(r"\d+?$", "12345").group())
```

Output:

```text
1
''
12345
```

`\d+?` takes one digit, and `\d*?` takes none. A lazy quantifier is only useful when something after it, such as a closing delimiter, an anchor or a word boundary, decides where the match ends. With `$` after it, `\d+?` has to expand to the end.

## Multi-line blocks: lazy plus `re.DOTALL`

Lazy quantifiers are ideal when the closing delimiter is **several characters** long, such as `*/` in C-style comments. If a block can span lines, remember that the dot does not match a newline without `re.DOTALL`:

```python
import re

code = """x = 1  /* first
comment */ y = 2 /* second */"""

print(re.findall(r"/\*.*?\*/", code))
print(re.findall(r"/\*.*?\*/", code, re.DOTALL))
```

Output:

```text
['/* second */']
['/* first\ncomment */', '/* second */']
```

`/\*` and `\*/` escape the asterisks, which are quantifiers otherwise. Without `re.DOTALL`, the first comment is missed because it contains a newline. A greedy `.*` with `re.DOTALL` would be worse: it would match from the first `/*` to the last `*/`, swallowing `y = 2` as well.

## Lazy quantifier or negated set?

Both solve the "too much" problem, but they are not equivalent:

- **Negated set** (`"[^"]*"`, `<[^>]+>`): use it when the closing delimiter is a **single character**. It describes exactly what is allowed inside, never crosses the delimiter, and needs no backtracking, so it is the most precise and usually the fastest option.
- **Lazy quantifier** (`/\*.*?\*/`, `\*\*.+?\*\*`, `<b>.*?</b>`): use it when the closing delimiter is **a sequence of characters**. A set cannot express "anything except the sequence `*/`".
- **Neither handles nesting.** `\(.*?\)` on `"f(a, g(b)) and h(c)"` returns `'(a, g(b)'`, which stops at the first `)`. Balanced brackets need a real parser (or the third-party `regex` module, which supports recursive patterns).

```python
>>> import re
>>> re.findall(r"\(.*?\)", "f(a, g(b)) and h(c)")
['(a, g(b)', '(c)']
```

## Common mistakes

- **Putting a lazy quantifier at the end of the pattern.** `\d+?` returns one digit and `.*?` returns an empty string. Something must follow the lazy part.
- **Expecting the shortest match in the string.** The leftmost match wins, and a lazy quantifier expands as far as the rest of the pattern needs.
- **Forgetting `re.DOTALL` for blocks that span lines.** `.*?` stops at a newline like any other dot.
- **Using lazy quantifiers for nested structures.** Brackets inside brackets break the pattern. Use a parser.
- **Choosing `.*?` where `[^x]*` would do.** The negated set is clearer about intent, cannot accidentally cross the delimiter, and is faster on long inputs.

## Summary

- Add `?` to any quantifier to make it lazy: `*?`, `+?`, `??`, `{n,}?`, `{n,m}?`.
- A lazy quantifier starts with the minimum number of repetitions and adds one at a time until the rest of the pattern matches.
- `{n}?` is the same as `{n}`.
- The leftmost match still wins. Laziness affects only the length of the match from that position.
- A lazy quantifier at the end of a pattern matches its minimum, so put a delimiter, anchor or boundary after it.
- For single-character delimiters prefer a negated set like `[^"]*`. For multi-character delimiters use `.*?`, with `re.DOTALL` if the block can span lines.

## Practice

### Exercise 1: All the tags

Extract every tag from `"<p>Hi</p><br><b>x</b>"` with a lazy quantifier. The result should be `['<p>', '</p>', '<br>', '<b>', '</b>']`.

### Exercise 2: Bold text in Markdown

Extract the text between double asterisks in `"This is **bold** and **also bold**"`. Return only the inner text, without the asterisks. Use a capturing group `(...)` around the lazy part: when a pattern has one group, `findall()` returns what the group matched.

### Exercise 3: Predict the numbers

Predict the result of each line, then run the code:

```python
import re

text = "2024 year"

print(re.search(r"\d+", text).group())
print(re.search(r"\d+?", text).group())
print(re.search(r"\d+?\b", text).group())
print(repr(re.search(r"\d*?", text).group()))
```

### Exercise 4: Log labels

Extract the labels in square brackets from `"[INFO] [db] connected [ok]"`. Solve it twice: with a lazy quantifier and with a negated set.

## Solutions

### Exercise 1

```python
import re

print(re.findall(r"<.+?>", "<p>Hi</p><br><b>x</b>"))
```

Output:

```text
['<p>', '</p>', '<br>', '<b>', '</b>']
```

A greedy `<.+>` would return the whole string as one match. `<[^>]+>` gives the same result as the lazy version.

### Exercise 2

```python
import re

text = "This is **bold** and **also bold**"

print(re.findall(r"\*\*(.+?)\*\*", text))
print(re.findall(r"\*\*.+?\*\*", text))
```

Output:

```text
['bold', 'also bold']
['**bold**', '**also bold**']
```

With the group, `findall()` returns only the inner text. Without it, it returns whole matches. A greedy `.+` would produce a single match from the first `**` to the last one.

### Exercise 3

Output:

```text
2024
2
2024
''
```

- The greedy `\d+` takes all four digits.
- The lazy `\d+?` stops after the minimum of one digit, because nothing follows it in the pattern.
- With `\b` after it, `\d+?` has to expand until a word boundary, which comes after `2024`.
- The lazy `\d*?` is satisfied with zero digits, so the match is empty.

### Exercise 4

```python
import re

log = "[INFO] [db] connected [ok]"

print(re.findall(r"\[.*?\]", log))
print(re.findall(r"\[[^\]]*\]", log))
```

Output:

```text
['[INFO]', '[db]', '[ok]']
['[INFO]', '[db]', '[ok]']
```

Square brackets are metacharacters, so the literal ones are escaped as `\[` and `\]`. In the second pattern, `[^\]]*` is a negated set: "any characters except a closing bracket". A greedy `\[.*\]` would return the whole string as one match.

---

*Source: [pythontutorial.net — Python Regex Non-greedy Quantifiers](https://www.pythontutorial.net/python-regex/python-regex-non-greedy/). Adapted and expanded for PyJourney.*
