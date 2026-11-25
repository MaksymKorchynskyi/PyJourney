# Greedy Quantifiers

By default every quantifier in Python is **greedy**: it takes as many characters as it can, and gives some back only when the rest of the pattern cannot match otherwise. Most of the time this is exactly what you want (`\d+` should return the whole number), but between delimiters such as quotes or tags greediness produces matches that are much longer than expected. Knowing how the engine works step by step makes these surprises predictable.

## What you'll learn

- What "greedy" means for `*`, `+`, `?` and `{n,m}`
- How the regex engine matches greedily and what **backtracking** is
- Why `".+"` grabs too much, and three ways to fix it
- Why the leftmost match wins over the longest one
- When greediness is useful
- How possessive quantifiers and atomic groups (Python 3.11+) switch backtracking off, and why nested quantifiers can make a regex extremely slow

## The unexpected result

Suppose you have an HTML fragment for a button and want the attribute values in double quotes, `submit` and `btn`:

```python
s = '<button type="submit" class="btn">Send</button>'
```

A natural first attempt is the pattern `".+"`:

- `"` an opening quote;
- `.+` one or more of any character (except a newline);
- `"` a closing quote.

```python
import re

s = '<button type="submit" class="btn">Send</button>'

for match in re.finditer(r'".+"', s):
    print(match.group())
```

Output:

```text
"submit" class="btn"
```

Instead of two short matches there is one long one, from the first quote to the **last** quote in the string. The quantifier `+` is greedy, and the dot accepts quotes too, so nothing stops it at the first closing quote.

> **Note:** The pattern is written as a raw string in single quotes, `r'".+"'`, so that the double quotes inside need no escaping. Raw strings are a good habit for every pattern, even one without backslashes.

## How greedy matching works

Here is what the engine does, step by step:

1. It looks for the first `"`. The characters `<button type=` do not match, so the engine moves on until index 13, where it finds the first quote.
2. `.+` is greedy, so it takes every character it can: all the way to the end of the string.
3. The pattern now needs a `"`, but there are no characters left. This attempt fails.
4. The engine **backtracks**: `.+` gives back one character (`>`), and the engine checks whether a `"` comes next. It does not, so `.+` gives back another character, and so on.
5. Once `.+` has given back `">Send</button>`, the next character is the quote after `btn`. The final `"` of the pattern matches it, and the match runs from index 13 to 33.

```text
string:  <button type="submit" class="btn">Send</button>
step 1:               ^
step 2:               "submit" class="btn">Send</button>
step 5:               "submit" class="btn"
```

The key idea: a greedy quantifier first grabs as much as possible, and then retreats **one character at a time** until the rest of the pattern can match. It stops at the first success, which is the longest possible match from that starting point.

## Backtracking made visible

Groups make backtracking easy to see. Each pair of parentheses captures what its part of the pattern matched (the Groupings section covers groups in detail):

```python
import re

print(re.search(r"(\d+)(\d{2})", "12345").groups())
```

Output:

```text
('123', '45')
```

`\d+` first takes all five digits. Then `\d{2}` has nothing to match, so `\d+` gives back one digit (`5`), which is still not enough, then another (`4`). Now `\d{2}` matches `45` and the search succeeds. The greedy part keeps as much as it can: `123`.

## Leftmost first, then greedy

Greedy does **not** mean "the longest match in the whole string". The engine always takes the **leftmost** position where the pattern can match. Greediness only decides how long the match is from that position:

```python
>>> import re
>>> re.search(r"a+", "baaa caaaaa")
<re.Match object; span=(1, 4), match='aaa'>
```

`aaaaa` later in the string is longer, but `aaa` starts earlier, so it wins.

## Fixing the button example

There are three common ways to stop at the first closing quote.

**1. A lazy quantifier.** Adding `?` after the quantifier makes it take as **few** characters as possible (see the Non-Greedy Quantifiers topic):

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

**2. A negated set.** `[^"]` means "any character except a quote" (see the Sets & Ranges topic). The quantifier can then never run past a closing quote, so there is nothing to backtrack:

```python
import re

s = '<button type="submit" class="btn">Send</button>'

for match in re.finditer(r'"[^"]+"', s):
    print(match.group())
```

Output:

```text
"submit"
"btn"
```

This version says precisely what is allowed between the quotes. It is usually the most robust and the fastest option.

**3. A proper parser.** For real HTML, use a parser such as the standard `html.parser` module or the third-party BeautifulSoup. HTML has nesting, comments, escaped quotes and many other details that regular expressions handle poorly.

## When greedy is exactly what you want

Greediness is the default because it is often the right behaviour:

- `\d+` returns `2021`, not `2`.
- `.*/` takes everything up to the **last** slash, which is the directory part of a path. Replacing it with an empty string leaves the file name.
- `.*\.` takes everything up to the last dot, which leaves the file extension.

```python
import re

path = "/home/olena/notes.txt"

print(re.search(r".*/", path).group())
print(re.sub(r".*/", "", path))
print(re.sub(r".*\.", "", "archive.tar.gz"))
```

Output:

```text
/home/olena/
notes.txt
gz
```

Also remember that the dot does not match a newline (unless you use `re.DOTALL`). A greedy `.+` therefore never runs past the end of a line:

```python
>>> import re
>>> re.findall(r'".+"', 'say "hi"\nand "bye"')
['"hi"', '"bye"']
```

## Possessive quantifiers and atomic groups (Python 3.11+)

Since Python 3.11, `re` supports **possessive quantifiers**: `*+`, `++`, `?+` and `{n,m}+`. They are greedy, but they **never give anything back**. Once they have taken characters, backtracking into them is not allowed:

```python
import re

print(re.search(r"\d+5", "12345"))
print(re.search(r"\d++5", "12345"))
```

Output:

```text
<re.Match object; span=(0, 5), match='12345'>
None
```

The greedy `\d+` takes all digits, then gives back `5` so that the literal `5` can match. The possessive `\d++` also takes all digits, including the `5`, and refuses to give any back, so the pattern fails.

An **atomic group** `(?>...)` does the same for a whole group: once the group has matched, the engine never re-enters it to try other options. `(?>\d+)5` behaves like `\d++5`.

Why use them? They make a pattern fail **fast** when backtracking cannot help. In `"[^"]++"`, for example, giving back non-quote characters can never produce a quote, so forbidding backtracking loses nothing and saves work.

## Catastrophic backtracking

Backtracking has a dark side. When quantifiers are **nested** over the same characters, the number of ways to split the input can grow exponentially. The classic example is `(a+)+b` on a string of `a` characters without a `b`: the engine tries every possible way of dividing the `a`s between the inner and the outer `+` before it gives up.

```python
import re
import time

pattern = re.compile(r"(a+)+b")

for n in [16, 18, 20, 22]:
    start = time.perf_counter()
    pattern.search("a" * n)
    print(n, f"{time.perf_counter() - start:.3f} s")
```

Output (timings vary by machine, the growth rate does not):

```text
16 0.003 s
18 0.013 s
20 0.044 s
22 0.170 s
```

Every two extra characters make the search about four times slower. At 40 characters it would take hours. This is a real security problem known as **ReDoS** (regular expression denial of service) when such a pattern runs on user input.

The fixes:

- Remove the nesting: `(a+)+b` means the same as `a+b`, which fails instantly.
- Use a possessive quantifier or an atomic group: `(?:a++)+b` or `(?>a+)+b` also fail instantly.
- Prefer precise sets like `[^"]+` to vague ones like `.+` between delimiters.

## Common mistakes

- **Using `.+` or `.*` between delimiters.** `".+"`, `<.+>` and `\(.*\)` run to the **last** delimiter on the line. Use a negated set (`"[^"]*"`) or a lazy quantifier (`".*?"`).
- **Thinking greedy means "the longest match in the string".** The leftmost match always wins. Greediness only affects its length.
- **Parsing HTML or XML with regular expressions.** Use `html.parser`, `xml.etree.ElementTree` or another parser.
- **Nesting quantifiers over the same characters.** `(a+)+`, `(\w*)*` and `(.*)*` can trigger catastrophic backtracking.
- **Using a possessive quantifier where backtracking is needed.** `\d++5` never matches, because `\d++` has already swallowed the `5`.

## Summary

- All quantifiers are greedy by default: they take as much as possible.
- If the rest of the pattern fails, a greedy quantifier gives back characters one at a time. This is called backtracking.
- The engine picks the leftmost match first. Greediness then makes it as long as possible from there.
- Between delimiters, greedy `.+` runs to the last delimiter. Fix it with a negated set `[^"]+` (most precise) or a lazy quantifier `.+?`.
- Greediness is useful for whole numbers, paths and other "up to the last X" tasks.
- Possessive quantifiers (`++`, `*+`, ...) and atomic groups `(?>...)` (Python 3.11+) are greedy and never give back.
- Nested quantifiers such as `(a+)+` can cause exponential backtracking (ReDoS).

## Practice

### Exercise 1: Predict the tag

Predict what `re.search(r"<.+>", "<b>bold</b> text").group()` returns. Then change the pattern with a negated set so that it matches only the first tag, `<b>`.

### Exercise 2: File extension

Use a greedy pattern and `re.sub()` to get the extension of `"archive.tar.gz"`, `"photo.jpeg"` and `"README"`. What happens to the file name without a dot?

### Exercise 3: Quoted strings, including empty ones

From `'say "hi", "" and "bye"'`, extract all quoted strings, including the empty `""`. First try `r'"[^"]+"'` and explain the strange result, then fix the pattern.

### Exercise 4: Who gets the digits?

Predict the groups for each pattern applied to `"2024"`, then run the code:

```python
import re

for pattern in [r"(\d+)(\d+)", r"(\d*)(\d+)", r"(\d+)(\d*)"]:
    print(pattern, re.search(pattern, "2024").groups())
```

## Solutions

### Exercise 1

```python
import re

text = "<b>bold</b> text"

print(re.search(r"<.+>", text).group())
print(re.search(r"<[^>]+>", text).group())
```

Output:

```text
<b>bold</b>
<b>
```

`.+` runs to the end of the string and backtracks to the **last** `>`. `[^>]+` cannot cross a `>`, so it stops at the first one.

### Exercise 2

```python
import re

for name in ["archive.tar.gz", "photo.jpeg", "README"]:
    print(re.sub(r".*\.", "", name))
```

Output:

```text
gz
jpeg
README
```

The greedy `.*` takes everything up to the **last** dot, so only `gz` remains for `archive.tar.gz`. A name without a dot has no match at all, and `re.sub()` returns it unchanged. In real code, `pathlib.Path(name).suffix` is the clearer tool.

### Exercise 3

```python
import re

text = 'say "hi", "" and "bye"'

print(re.findall(r'"[^"]+"', text))
print(re.findall(r'"[^"]*"', text))
```

Output:

```text
['"hi"', '" and "']
['"hi"', '""', '"bye"']
```

With `+`, the empty string `""` cannot match, because at least one non-quote character is required. The engine then tries the **second** quote of `""` as an opening quote, takes ` and ` as the content, and closes at the opening quote of `"bye"`. Allowing zero characters with `*` fixes it.

### Exercise 4

Output:

```text
(\d+)(\d+) ('202', '4')
(\d*)(\d+) ('202', '4')
(\d+)(\d*) ('2024', '')
```

The first quantifier is greedy and keeps as much as it can. In the first two patterns, the second group needs at least one digit, so the first group gives back exactly one. In the third pattern, the second group is satisfied with zero digits, so the first group keeps all four.

---

*Source: [pythontutorial.net — Python Regex Greedy](https://www.pythontutorial.net/python-regex/python-regex-greedy/). Adapted and expanded for PyJourney.*
