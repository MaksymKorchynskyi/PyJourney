# Capturing Groups

Parentheses in a regular expression do two jobs: they **group** part of a pattern, and they **capture** the text that this part matched so you can read it afterwards. Capturing groups turn a regex from a yes/no test into a tool that pulls structured data (ids, dates, names, numbers) out of text.

## What you'll learn

- How to create a capturing group with `(...)` and read it with `group()`, indexing and `groups()`
- How groups are numbered, including nested groups
- How to name groups with `(?P<name>...)` and read them as a dictionary with `groupdict()`
- What you get from optional groups that did not take part, and from repeated groups
- How groups change the result of `re.findall()`
- Why `lastindex` is not the number of groups

## A match without groups

Suppose a website shows the news item with id `100` at the path `news/100`. This pattern matches it:

```text
\w+/\d+
```

- `\w+` matches one or more word characters (letters, digits and `_`).
- `/` matches a literal forward slash.
- `\d+` matches one or more digits.

The pattern is not limited to `news`: it also matches `posts/7`, `todos/42` and so on.

```python
import re

path = "news/100"

for match in re.finditer(r"\w+/\d+", path):
    print(match)
```

Output:

```text
<re.Match object; span=(0, 8), match='news/100'>
```

The match tells you *that* the text fits the pattern, but you still have to cut the id out by hand. That is exactly what groups are for.

> **Note:** Write every pattern as a raw string, `r"..."`. In a normal string, `"\d"` is an invalid escape sequence, and since Python 3.12 it triggers a `SyntaxWarning`. Worse, some escapes are valid string escapes with a different meaning: `"\b"` is a backspace character, not a word boundary. A raw string passes the backslash to the regex engine unchanged.

## Creating a capturing group

To capture part of a match, wrap that part of the pattern in parentheses:

```text
\w+/(\d+)
```

The parentheses do not change *what* is matched. They only tell the engine to remember the text matched by `\d+`, so you can ask for it later.

```python
import re

match = re.search(r"\w+/(\d+)", "news/100")

print(match)
print(match.group(0))
print(match.group(1))
```

Output:

```text
<re.Match object; span=(0, 8), match='news/100'>
news/100
100
```

- `group(0)` (or just `group()`) is the **whole match**.
- `group(1)` is the text captured by the **first** group, `group(2)` by the second, and so on.

To capture the resource name too, add a second group:

```python
import re

match = re.search(r"(\w+)/(\d+)", "news/100")

print(match.group())        # same as group(0)
print(match.group(1))
print(match.group(2))
print(match.group(1, 2))    # several groups at once -> a tuple
print(match[1], match[2])   # indexing is a shortcut for group()
print(match.groups())       # all groups as a tuple

resource, news_id = match.groups()
print(resource, int(news_id) + 1)
```

Output:

```text
news/100
news
100
('news', '100')
news 100
('news', '100')
news 101
```

Captured values are always **strings** (or `None`, as you will see below). Convert them yourself with `int()`, `float()` and so on before doing arithmetic.

### The `Match` API at a glance

| Expression | Result |
|---|---|
| `m.group()` / `m.group(0)` / `m[0]` | the whole match |
| `m.group(n)` / `m[n]` | text of group `n` |
| `m.group(a, b)` | tuple with groups `a` and `b` |
| `m.groups(default=None)` | tuple of all groups (`1..N`) |
| `m.groupdict(default=None)` | dict of all **named** groups |
| `m.start(n)`, `m.end(n)`, `m.span(n)` | where group `n` matched in the string |
| `m.re.groups` | how many groups the pattern defines |
| `m.lastindex`, `m.lastgroup` | index / name of the last group that matched |

## How groups are numbered

Groups are numbered by their **opening parenthesis**, counting from left to right, starting at 1. Nested groups therefore get numbers too:

```text
((\d{4})-(\d{2}))-(\d{2})
12       3        4
```

```python
import re

match = re.search(r"((\d{4})-(\d{2}))-(\d{2})", "Released on 2024-10-07.")

for index in range(match.re.groups + 1):
    print(index, match.group(index), match.span(index))
```

Output:

```text
0 2024-10-07 (12, 22)
1 2024-10 (12, 19)
2 2024 (12, 16)
3 10 (17, 19)
4 07 (20, 22)
```

Group 1 is the outer group (`year-month`); groups 2 and 3 live inside it. `span(n)` returns the `(start, end)` positions of the group in the original string.

### Why not loop with `lastindex`?

You may see code that loops over `range(match.lastindex + 1)`. It looks like it covers all groups, but `lastindex` is the index of the **last group that finished matching**, not the number of groups, and it is `None` when no group matched:

```python
import re

nested = re.search(r"((\w+)/(\d+))", "news/100")
print(nested.groups())
print(nested.lastindex)     # the outer group closed last
print(nested.re.groups)     # number of groups in the pattern

plain = re.search(r"\w+/\d+", "news/100")
print(plain.lastindex)
```

Output:

```text
('news/100', 'news', '100')
1
3
None
```

With the nested pattern the loop would print only groups 0 and 1, and with no groups at all `None + 1` raises a `TypeError`. Use `match.re.groups` (the group count) or simply iterate over `match.groups()`.

## Named groups: `(?P<name>...)`

Numbers are fine for one or two groups, but `match.group(3)` says nothing about *what* group 3 is, and adding a new group shifts all the numbers after it. A **named group** gives a group a meaningful name:

```text
(?P<name>rule)
```

- The parentheses create the group.
- `?P<name>` assigns the name. The name must be a valid Python identifier and unique within the pattern.
- `rule` is the sub-pattern to capture.

```python
import re

pattern = r"(?P<resource>\w+)/(?P<id>\d+)"
match = re.search(pattern, "news/100")

print(match.group("resource"))
print(match["id"])
print(match.group(2))        # named groups still have numbers
print(match.groupdict())
```

Output:

```text
news
100
100
{'resource': 'news', 'id': '100'}
```

`groupdict()` returns a dictionary whose keys are the group names and whose values are the captured strings. Unnamed groups are not included in it, but every group, named or not, still has a number.

A longer example parses dated paths. `fullmatch()` requires the **whole** string to match, which is what you usually want when validating a path:

```python
import re

pattern = r"(?P<resource>\w+)/(?P<year>\d{4})/(?P<month>\d{1,2})/(?P<day>\d{1,2})"

for path in ["news/2021/12/31", "posts/2024/3/7", "news/2021/12"]:
    match = re.fullmatch(pattern, path)
    if match:
        print(match.groupdict())
    else:
        print(path, "-> no match")
```

Output:

```text
{'resource': 'news', 'year': '2021', 'month': '12', 'day': '31'}
{'resource': 'posts', 'year': '2024', 'month': '3', 'day': '7'}
news/2021/12 -> no match
```

The compiled pattern knows its names too: `re.compile(pattern).groupindex` is a mapping from each name to its group number, for example `{'resource': 1, 'id': 2}` for the first pattern above.

> **Note:** Python spells named groups `(?P<name>...)`. The shorter `(?<name>...)` used by JavaScript, .NET and PCRE is **not** supported by the `re` module and raises `re.PatternError: unknown extension ?<n` (the exception class was called `re.error` before Python 3.13, and that name still works as an alias).

## Groups that did not take part

A group followed by `?` is optional. If it does not participate in the match, its value is `None`:

```python
import re

pattern = r"(\w+)/(\d+)(/edit)?"

print(re.fullmatch(pattern, "news/100/edit").groups())
print(re.fullmatch(pattern, "news/100").groups())
print(re.fullmatch(pattern, "news/100").groups(default=""))
```

Output:

```text
('news', '100', '/edit')
('news', '100', None)
('news', '100', '')
```

`groups()` and `groupdict()` accept a `default` argument that replaces `None` for groups that did not match. Keep the difference in mind: `None` means "this group did not take part", while `''` means "it took part and matched an empty string" (for example `(\d*)` against no digits).

## Repeated groups keep only the last repetition

When a quantifier is applied to a group, the group is matched several times, but only the **last** repetition is remembered:

```python
import re

match = re.search(r"(\d+-)+", "10-20-30-")
print(match.group(0))
print(match.group(1))

match = re.search(r"((\d+-)+)", "10-20-30-")
print(match.group(1))
```

Output:

```text
10-20-30-
30-
10-20-30-
```

To capture the whole repeated part, put an extra group *around* the repetition, as in the second pattern. To get every piece separately, use `re.findall()` or `re.finditer()` with a simpler pattern.

## Groups change what `findall()` returns

`re.findall()` changes its result depending on how many groups the pattern has:

- no groups: a list of whole matches;
- one group: a list of that group's text;
- several groups: a list of tuples, one tuple per match.

```python
import re

text = "news/100, posts/7, todos/42"

print(re.findall(r"\w+/\d+", text))
print(re.findall(r"\w+/(\d+)", text))
print(re.findall(r"(\w+)/(\d+)", text))
```

Output:

```text
['news/100', 'posts/7', 'todos/42']
['100', '7', '42']
[('news', '100'), ('posts', '7'), ('todos', '42')]
```

When you need both the whole match and named groups, `re.finditer()` is often clearer. It yields full `Match` objects:

```python
import re

text = "news/100, posts/7, todos/42"
pattern = r"(?P<resource>\w+)/(?P<id>\d+)"

for match in re.finditer(pattern, text):
    print(match.group(), match.groupdict(), match.span("id"))

ids = {m["resource"]: int(m["id"]) for m in re.finditer(pattern, text)}
print(ids)
```

Output:

```text
news/100 {'resource': 'news', 'id': '100'} (5, 8)
posts/7 {'resource': 'posts', 'id': '7'} (16, 17)
todos/42 {'resource': 'todos', 'id': '42'} (25, 27)
{'news': 100, 'posts': 7, 'todos': 42}
```

Captured groups can also be reused inside the same pattern and in replacement strings. That is the subject of the next topic, backreferences.

## Common mistakes

- **Calling `.group()` on `None`.** `re.search()`, `re.match()` and `re.fullmatch()` return `None` when nothing matches, so `re.search(r"\d+", "no digits").group()` raises `AttributeError: 'NoneType' object has no attribute 'group'`. Check the result first:

  ```python
  import re

  if (match := re.search(r"(\d+)", "order #512")):
      print(match.group(1))
  else:
      print("no number")
  ```

  Output:

  ```text
  512
  ```

- **Forgetting the raw string.** `"\bcat\b"` contains two backspace characters, so it silently finds nothing:

  ```python
  import re

  print(re.findall("\bcat\b", "cat"))
  print(re.findall(r"\bcat\b", "cat"))
  ```

  Output:

  ```text
  []
  ['cat']
  ```

- **Treating `lastindex` as the group count.** It is the index of the last group that matched, and it can be `None`. Use `match.re.groups`.
- **Expecting numbers instead of strings.** `match.group(1) + 1` raises `TypeError` because the group is `'100'`, not `100`. Convert explicitly.
- **Being surprised by `findall()`.** Adding a group "just for grouping" makes `findall()` return the group instead of the whole match. Use a non-capturing group `(?:...)` for pure grouping (see the topic on non-capturing groups).
- **Expecting a repeated group to hold every repetition.** `(\d+-)+` remembers only the last `\d+-`.
- **Using `(?<name>...)`.** Python requires the `P`: `(?P<name>...)`.

## Summary

- Parentheses `(...)` create a capturing group. They do not change what is matched, they only remember a part of it.
- `group(0)` is the whole match, `group(n)` or `match[n]` is group `n`, and `groups()` returns all groups as a tuple.
- Groups are numbered by their opening parenthesis from left to right, including nested groups. `match.re.groups` is the count.
- `(?P<name>...)` creates a named group. Read it with `group("name")`, `match["name"]` or all at once with `groupdict()`.
- A group that did not participate is `None`. Use `groups(default=...)` or `groupdict(default=...)` to replace it.
- A group under a quantifier keeps only its last repetition.
- With groups, `findall()` returns the groups (strings or tuples) instead of whole matches. `finditer()` gives you full `Match` objects.

## Practice

### Exercise 1: Parse a log line

Write a pattern with named groups `date`, `time`, `level` and `message` that parses lines like:

```text
2024-05-17 12:30:01 ERROR Disk full on /dev/sda1
```

Print the `groupdict()` of the match.

### Exercise 2: Settings string to dictionary

Turn `"name=Olena; age=31; city=Lviv"` into the dictionary `{'name': 'Olena', 'age': '31', 'city': 'Lviv'}` with a single `re.findall()` call and two groups.

### Exercise 3: Paths to dates

Write `parse_news_path(path)` that returns a `datetime.date` for paths like `"news/2021/12/31"` (the month and day may have one or two digits) and `None` for anything that does not match the whole format. Test it with `"news/2021/12/31"`, `"news/2024/3/7"` and `"news/2024/03"`.

### Exercise 4: Predict the output

Without running the code, predict what it prints. Then run it and explain the third tuple.

```python
import re

print(re.findall(r"(\d+)(px|em)?", "10px 2em 7"))
```

## Solutions

### Exercise 1

```python
import re

line = "2024-05-17 12:30:01 ERROR Disk full on /dev/sda1"
pattern = (
    r"(?P<date>\d{4}-\d{2}-\d{2}) "
    r"(?P<time>\d{2}:\d{2}:\d{2}) "
    r"(?P<level>[A-Z]+) "
    r"(?P<message>.*)"
)

match = re.fullmatch(pattern, line)
print(match.groupdict())
```

Output:

```text
{'date': '2024-05-17', 'time': '12:30:01', 'level': 'ERROR', 'message': 'Disk full on /dev/sda1'}
```

Adjacent raw strings are joined into one pattern, which keeps a long regex readable.

### Exercise 2

```python
import re

settings = "name=Olena; age=31; city=Lviv"
pairs = re.findall(r"(\w+)=([^;]+)", settings)
print(pairs)
print(dict(pairs))
```

Output:

```text
[('name', 'Olena'), ('age', '31'), ('city', 'Lviv')]
{'name': 'Olena', 'age': '31', 'city': 'Lviv'}
```

With two groups `findall()` returns a list of `(key, value)` tuples, which is exactly what `dict()` accepts.

### Exercise 3

```python
import re
from datetime import date

PATTERN = re.compile(r"news/(?P<year>\d{4})/(?P<month>\d{1,2})/(?P<day>\d{1,2})")


def parse_news_path(path):
    match = PATTERN.fullmatch(path)
    if match is None:
        return None
    parts = {name: int(value) for name, value in match.groupdict().items()}
    return date(**parts)


print(parse_news_path("news/2021/12/31"))
print(parse_news_path("news/2024/3/7"))
print(parse_news_path("news/2024/03"))
```

Output:

```text
2021-12-31
2024-03-07
None
```

The group names match the parameter names of `date(year, month, day)`, so the converted dictionary can be unpacked straight into the constructor.

### Exercise 4

Output:

```text
[('10', 'px'), ('2', 'em'), ('7', '')]
```

The pattern has two groups, so every match becomes a tuple. For `7` the optional group `(px|em)?` did not take part. `Match.groups()` would show `None` for it, but `findall()` always uses an empty string for groups that did not match.

---

*Source: [pythontutorial.net — Python Regex Capturing Group](https://www.pythontutorial.net/python-regex/python-regex-capturing-group/). Adapted and expanded for PyJourney.*
