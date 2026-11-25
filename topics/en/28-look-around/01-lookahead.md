# Lookahead

A **lookahead** checks what comes *after* the current position without making it part of the match. With it you can say "match `X`, but only if it is followed by `Y`" (or "only if it is **not** followed by `Y`"). Lookaheads are the tool behind password rules, "number followed by a unit" searches, overlapping matches and many clever substitutions.

## What you'll learn

- What a zero-width assertion is and how a lookahead differs from normal matching
- Positive lookahead `X(?=Y)` and negative lookahead `X(?!Y)`
- How several lookaheads are checked at the **same** position, and how to use that for password rules
- How backtracking can defeat a negative lookahead, and how to prevent it
- How to find overlapping matches by capturing inside a lookahead
- How to insert text at a position, for example thousands separators

## Zero-width assertions

Most parts of a pattern **consume** characters: `\d` matches a digit and moves the engine past it. Some parts only **assert** something about the current position and consume nothing. You already know a few: `^`, `$` and `\b`. They are called **zero-width assertions**.

A lookahead is a zero-width assertion that you write yourself. At the current position the engine tries to match the sub-pattern inside the lookahead. If that succeeds (or fails, for a negative lookahead), the engine goes back to the position where it started and continues with the rest of the pattern. The text it looked at is not included in the match.

Compare a normal pattern with a lookahead:

```python
import re

s = "1 Python is about 4 feet long"

print(re.findall(r"\d+\s*feet", s))
print(re.findall(r"\d+(?=\s*feet)", s))
```

Output:

```text
['4 feet']
['4']
```

Both patterns require `feet` after the number, but only the first one includes it in the match.

## Positive lookahead: `X(?=Y)`

The syntax is:

```text
X(?=Y)
```

It means: match `X`, but only if `Y` follows it immediately. To find the number of feet in the text above:

```text
\d+(?=\s*feet)
```

- `\d+` matches one or more digits.
- `(?=...)` is the lookahead.
- `\s*` inside it allows zero or more whitespace characters.
- `feet` is the literal text that must follow.

```python
import re

s = "1 Python is about 4 feet long"
pattern = r"\d+(?=\s*feet)"

for match in re.finditer(pattern, s):
    print(match.group())
```

Output:

```text
4
```

The number `1` is not followed by `feet`, so it is skipped.

Another everyday example is the user part of an e-mail address: word characters followed by `@`.

```python
import re

text = "Write to olena@example.com or max@test.org"
print(re.findall(r"\w+(?=@)", text))
```

Output:

```text
['olena', 'max']
```

Unlike lookbehind (next topic), a lookahead may contain a pattern of **any length**: `\s*`, `.*` and other variable-width quantifiers are fine inside `(?=...)`.

## Negative lookahead: `X(?!Y)`

```text
X(?!Y)
```

This matches `X` only if `Y` does **not** follow it. To match the `1` but not the `4` in the same sentence:

```python
import re

s = "1 Python is about 4 feet long"
pattern = r"\d+(?!\s*feet)"

for match in re.finditer(pattern, s):
    print(match.group())
```

Output:

```text
1
```

A negative lookahead at the *start* of a token works as a filter on how the token begins. This pattern finds words that do not start with `un`:

```python
import re

print(re.findall(r"\b(?!un)\w+\b", "undo redo unify apply"))
```

Output:

```text
['redo', 'apply']
```

### The backtracking trap

The negative lookahead `\d+(?!\s*feet)` looks correct, but it has a subtle bug that shows up with numbers of two or more digits:

```python
import re

text = "The pole is 14 feet long, the rope 3 metres"
print(re.findall(r"\d+(?!\s*feet)", text))
```

Output:

```text
['1', '3']
```

Where did `1` come from? At `14` the engine first matches `\d+` as `14`. It is followed by ` feet`, so the negative lookahead fails. The engine does not give up: it **backtracks** and lets `\d+` match only `1`. Now the next text is `4 feet`, which does not match `\s*feet`, so the lookahead succeeds and `1` is reported.

The fix is to forbid stopping in the middle of a number. Either add a second lookahead `(?!\d)` or put the digit into the forbidden text:

```python
import re

text = "The pole is 14 feet long, the rope 3 metres"

print(re.findall(r"\d+(?!\d)(?!\s*feet)", text))
print(re.findall(r"\d+(?![\d\s]*feet)", text))
```

Output:

```text
['3']
['3']
```

> **Tip:** Whenever a negative lookahead follows a quantifier (`\d+`, `\w+`, `.*`), ask yourself what happens if the quantifier gives back characters. A `\b` or an extra `(?!\d)` / `(?!\w)` usually closes the gap.

## Several lookaheads at one position

You can put several lookaheads in a row:

```text
X(?=Y)(?=Z)
```

The engine finds `X`, then checks `Y` **at the position right after `X`**, then goes back and checks `Z` **at that same position**. Lookaheads do not consume anything, so `Z` is *not* tested after `Y`. Both conditions must hold at once, which works like a logical AND.

You can see this with a tiny example. If `Z` were checked after `Y`, the second search would succeed, because `d` follows `abc`:

```python
import re

print(re.search(r"x(?=abc)(?=a)", "xabcd"))
print(re.search(r"x(?=abc)(?=d)", "xabcd"))
```

Output:

```text
<re.Match object; span=(0, 1), match='x'>
None
```

### Password rules

Stacking lookaheads at the start of a pattern is the classic way to check several independent rules. Each lookahead starts at position 0 and scans forward with `.*`:

```python
import re

PASSWORD = re.compile(r"(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}")

for pw in ["secret", "secret123", "Secret123", "SECRET123", "Sec123"]:
    print(f"{pw!r:12} {bool(PASSWORD.fullmatch(pw))}")
```

Output:

```text
'secret'     False
'secret123'  False
'Secret123'  True
'SECRET123'  False
'Sec123'     False
```

- `(?=.*[a-z])` means "somewhere ahead there is a lowercase letter".
- `(?=.*[A-Z])` means "somewhere ahead there is an uppercase letter".
- `(?=.*\d)` means "somewhere ahead there is a digit".
- `.{8,}` is the only part that consumes text: at least 8 characters.
- `fullmatch()` makes the whole string go through all the checks.

The `.*` is essential. Without it, `(?=\d)` would require the **first** character to be a digit.

## Lookahead before or after the token

Where you put the lookahead changes its meaning:

- `X(?=Y)`: after `X`, check what **follows** it.
- `(?=Y)X`: before `X`, check what `X` itself **starts with** or contains.

For example, `\b(?=\w*\d)\w+\b` finds words that contain at least one digit. The lookahead looks into the word before `\w+` consumes it:

```python
import re

print(re.findall(r"\b(?=\w*\d)\w+\b", "room 101, floor B2, exit"))
```

Output:

```text
['101', 'B2']
```

## Overlapping matches

`findall()` and `finditer()` never return overlapping matches: after a match, the search continues where the match ended. A lookahead consumes nothing, so a match made only of a lookahead is empty and the engine moves forward one character at a time. Put a capturing group inside the lookahead, and you get every overlapping occurrence:

```python
import re

print(re.findall(r"\d\d", "12345"))
print(re.findall(r"(?=(\d\d))", "12345"))
```

Output:

```text
['12', '34']
['12', '23', '34', '45']
```

Groups inside a lookahead are captured normally, even though the lookahead itself matches nothing.

## Inserting at a position: thousands separators

Because a lookahead (and `\B`) matches a *position*, `re.sub()` can insert text without replacing any characters:

```python
import re

print(re.sub(r"\B(?=(?:\d{3})+(?!\d))", ",", "Total: 1234567 and 999"))
```

Output:

```text
Total: 1,234,567 and 999
```

Read the pattern as "a position inside a word (`\B`), followed by one or more groups of three digits (`(?:\d{3})+`) and then no more digits (`(?!\d)`)". Those are exactly the places where a comma belongs. It is a nice demonstration, but it breaks decimals (`1234.5678` becomes `1,234.5,678`). For real numbers use string formatting: `f"{1234567:,}"` gives `'1,234,567'`.

## Common mistakes

- **Expecting the lookahead text in the result.** `\d+(?=\s*feet)` returns `4`, not `4 feet`. If you need both parts, use a normal pattern with groups.
- **Falling into the backtracking trap.** `\d+(?!%)` on `15%` returns `1`. Add `(?!\d)` or use `[\d%]` inside the lookahead.
- **Thinking stacked lookaheads are sequential.** In `X(?=Y)(?=Z)` both `Y` and `Z` are tested at the same position.
- **Forgetting `.*` in "contains" checks.** `(?=\d)` tests only the next character. To test "somewhere ahead" write `(?=.*\d)`.
- **Validating with `^...$` and `re.match()`.** `$` also matches before a trailing newline, so `re.match(r"^(?=.*\d).{8,}$", "abcdefg1\n")` succeeds. `re.fullmatch()` (or `\Z`) does not accept the extra `"\n"`.

## Summary

- A lookahead is a zero-width assertion: it checks the text ahead and consumes nothing.
- `X(?=Y)` matches `X` only if `Y` follows. `X(?!Y)` matches `X` only if `Y` does not follow.
- The text inside a lookahead is not part of the match, but groups inside it are captured.
- A lookahead may contain variable-length patterns such as `.*` and `\s*`.
- Several lookaheads in a row are all checked at the same position, like an AND. That is the basis of password validation.
- A quantifier before a negative lookahead can backtrack to a shorter match. Guard against it with `(?!\d)`, `\b` or a wider character class.
- Capturing inside a lookahead gives overlapping matches, and a pure lookahead in `re.sub()` inserts text at a position.

## Practice

### Exercise 1: Amounts in dollars

From `"Paid 120 USD, 75 EUR and 30USD"` extract the amounts that are followed by `USD` (with or without a space). The expected result is `['120', '30']`.

### Exercise 2: Numbers that are not percentages

From `"Growth 15% on 200 units, 7% tax"` extract the numbers that are **not** followed by `%`. The expected result is `['200']`. First try the naive pattern `\d+(?!%)` and explain what goes wrong.

### Exercise 3: Strong password

Write `is_strong(password)` that returns `True` only if the password has at least 8 characters, at least one uppercase letter, at least one digit, at least one of the characters `!@#$%`, and no whitespace. Test it on `"Passw0rd!"`, `"passw0rd!"`, `"Password!"`, `"Passw0rd"`, `"Pass w0rd!"` and `"P0!a"`.

### Exercise 4: Overlapping occurrences

`"banana".count("ana")` returns `1`, because `str.count()` does not count overlapping occurrences. Use a lookahead to count all occurrences of `ana` in `"banana"`, including overlapping ones, and print their start positions.

## Solutions

### Exercise 1

```python
import re

text = "Paid 120 USD, 75 EUR and 30USD"
print(re.findall(r"\d+(?=\s*USD)", text))
```

Output:

```text
['120', '30']
```

### Exercise 2

```python
import re

text = "Growth 15% on 200 units, 7% tax"

print(re.findall(r"\d+(?!%)", text))
print(re.findall(r"\d+(?![\d%])", text))
```

Output:

```text
['1', '200']
['200']
```

The naive pattern backtracks inside `15%`: `15` is followed by `%`, so the engine tries `1`, which is followed by `5`, not `%`, and the match succeeds. Forbidding a digit in the lookahead as well (`[\d%]`) means the number can only end where the digits end.

### Exercise 3

```python
import re

STRONG = re.compile(r"(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%])(?!.*\s).{8,}")


def is_strong(password):
    return STRONG.fullmatch(password) is not None


for pw in ["Passw0rd!", "passw0rd!", "Password!", "Passw0rd", "Pass w0rd!", "P0!a"]:
    print(f"{pw!r:13} {is_strong(pw)}")
```

Output:

```text
'Passw0rd!'   True
'passw0rd!'   False
'Password!'   False
'Passw0rd'    False
'Pass w0rd!'  False
'P0!a'        False
```

Three positive lookaheads require the character kinds, and the negative lookahead `(?!.*\s)` rejects any whitespace. All four are checked at position 0. Only `.{8,}` consumes text, and `fullmatch()` makes it cover the whole password.

### Exercise 4

```python
import re

text = "banana"
matches = list(re.finditer(r"(?=ana)", text))

print(text.count("ana"))
print(len(matches))
print([m.start() for m in matches])
```

Output:

```text
1
2
[1, 3]
```

Each match is an empty string at a position where `ana` starts. Because nothing is consumed, the search can find the second `ana` that shares its first `a` with the end of the first one.

---

*Source: [pythontutorial.net — Python Regex Lookahead](https://www.pythontutorial.net/python-regex/python-regex-lookahead/). Adapted and expanded for PyJourney.*
