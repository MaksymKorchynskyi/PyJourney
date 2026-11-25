# OR Operator

The `or` operator answers "is at least one of these true?". Like `and`, it short-circuits and returns one of its operands rather than a strict `True`/`False`. That makes `value or default` a popular idiom for fallback values, and it is also the source of one of the most common Python bugs.

## What you'll learn

- The truth table of `or`
- How short-circuit evaluation works for `or`
- Why `x or y` returns the first truthy operand
- How to set default values with `or`, and when that goes wrong
- How `or` mixes with `and` (precedence), and the `x == a or b` trap
- When to use `any()`, `min(..., default=...)` and `|` instead

## The or operator and its truth table

`or` is a logical operator. With two boolean operands it returns `True` if **at least one** of them is true, and `False` only when both are false:

| X | Y | X or Y |
|---|---|---|
| True | True | True |
| True | False | True |
| False | True | True |
| False | False | False |

```python
is_admin = False
is_editor = True
can_edit = is_admin or is_editor

print(can_edit)
```

Output:

```text
True
```

## Short-circuit evaluation

If the left operand is true, the result is already known to be true, so Python **does not evaluate the right operand**. This is short-circuit (or lazy) evaluation. The right operand runs only when the left one is falsy:

```python
def check(name, result):
    print(f"evaluating {name}")
    return result


print(check("left", True) or check("right", False))
print("---")
print(check("left", False) or check("right", False))
```

Output:

```text
evaluating left
True
---
evaluating left
evaluating right
False
```

## or returns one of its operands

Every object has a truth value, so `or` accepts any operands. The exact rule is:

> `x or y` returns `x` if `x` is truthy. Otherwise it evaluates `y` and returns `y`.

In other words, `x or y` is a compact form of:

```python
x, y = "", "default"

if x:
    result = x
else:
    result = y

print(repr(result))
print(repr(x or y))
```

Output:

```text
'default'
'default'
```

More examples, including a chain of several `or`s, which returns the **first truthy** operand or, if there is none, the **last** one:

```python
print(repr(0 or 5))
print(repr(3 or 5))
print(repr("" or "default"))
print(repr([] or None))
print(repr(3 or 1 / 0))
print(repr(None or 0 or "found" or "never"))
```

Output:

```text
5
3
'default'
None
3
'found'
```

`3 or 1 / 0` does not raise `ZeroDivisionError`, because the division is never evaluated.

## Setting a default value

Because `or` returns its first truthy operand, it is a short way to provide a fallback:

```python
value = ""
default = "N/A"

var_name = value or default
print(var_name)
```

Output:

```text
N/A
```

If `value` is falsy (`None`, `""`, `0`, `[]`, ...), `var_name` gets `default`.

A classic use is user input. `input()` returns an empty string when the user just presses Enter, and the empty string is falsy:

```python
lang = input("Enter your language: ") or "Python"
print(lang)
```

A sample run in a terminal, where the user presses Enter without typing anything:

```text
Enter your language:
Python
```

The same idea works for optional function parameters:

```python
def greet(name=None):
    name = name or "guest"
    return f"Hello, {name}!"


print(greet("Olena"))
print(greet())
print(greet(""))
```

Output:

```text
Hello, Olena!
Hello, guest!
Hello, guest!
```

### A fallback for empty collections

The built-in `min()` raises `ValueError` when it receives an empty iterable:

```python
def get_data(args=None):
    if args:
        return [1, 2, 3]
    return []


lowest = min(get_data(args=True))
print(lowest)

lowest = min(get_data())
print(lowest)
```

Output (the second call fails, last line of the traceback shown):

```text
1
ValueError: min() iterable argument is empty
```

`or` can replace an empty list with a list containing a default value. Since Python 3.4, `min()` and `max()` also accept a `default` keyword argument, which states the intent more directly:

```python
def get_data(args=None):
    if args:
        return [1, 2, 3]
    return []


lowest = min(get_data() or [0])
print(lowest)

lowest = min(get_data(), default=0)
print(lowest)

lowest = min(get_data(args=True), default=0)
print(lowest)
```

Output:

```text
0
0
1
```

`get_data() or [0]`: the empty list is falsy, so `or` evaluates and returns `[0]`, and `min([0])` is `0`.

## The pitfall: valid values that are falsy

`value or default` replaces **every** falsy value, not only `None`. When `0`, `""`, `False` or an empty list are legitimate values, `or` silently throws them away:

```python
settings = {"retries": 0, "name": ""}

retries = settings.get("retries") or 3
print(retries)  # wrong: the user explicitly asked for 0 retries

retries = settings.get("retries")
if retries is None:
    retries = 3
print(retries)

print(settings.get("retries", 3))
print(settings.get("timeout", 30))
```

Output:

```text
3
0
0
30
```

Rules of thumb:

- Use `value or default` when **all** falsy values should mean "not provided" (typical for names and other text).
- Use `default if value is None else value` (or an explicit `if value is None:`) when `0`, `""` or `False` are valid.
- For dictionaries, `d.get(key, default)` applies the default only when the key is **missing**.

## Precedence: mixing or with and

`and` binds tighter than `or`, so `a or b and c` means `a or (b and c)`:

```python
is_admin, is_owner, is_locked = True, False, True

print(is_admin or is_owner and not is_locked)
print(is_admin or (is_owner and not is_locked))
print((is_admin or is_owner) and not is_locked)
```

Output:

```text
True
True
False
```

The first two lines are the same expression. The third one groups differently and gives a different answer. When you combine `and` and `or`, write the parentheses explicitly, even when they match the default precedence.

## The `x == a or b` trap

A very common beginner bug is to write a comparison against several values the way you would say it aloud:

```python
color = "green"

print(repr(color == "red" or "blue"))

if color == "red" or "blue":
    print("this always runs!")

print(color == "red" or color == "blue")
print(color in ("red", "blue"))
```

Output:

```text
'blue'
this always runs!
False
False
```

Python reads `color == "red" or "blue"` as `(color == "red") or "blue"`. The comparison is `False`, so `or` returns `"blue"`, a non-empty and therefore truthy string. The condition is always true. Either repeat the comparison for each value or, better, use the membership operator `in`.

## any(): or for many values

`any(iterable)` returns `True` if at least one item is truthy. It is the readable form of a long `or` chain, and with a generator expression it stops at the first truthy item:

```python
def is_negative(n):
    print(f"checking {n}")
    return n < 0


print(any(is_negative(n) for n in [3, -1, 2]))
print(any([]))
print(any(["", 0, None]))
```

Output:

```text
checking 3
checking -1
True
False
False
```

Unlike `or`, `any()` always returns a real `bool`. For an empty iterable it returns `False`.

## or versus |

The `|` operator looks similar but is a different tool. It never short-circuits and its meaning depends on the operand types:

```python
print(True | False)
print(6 | 3)                     # bitwise: 110 | 011 = 111
print({1, 2} | {2, 3})           # set union
print({"a": 1} | {"b": 2})       # dict merge (Python 3.9+)
print(int | None)                # type union (Python 3.10+)
```

Output:

```text
True
7
{1, 2, 3}
{'a': 1, 'b': 2}
int | None
```

Like `&`, `|` binds tighter than comparisons, so `x > 0 | x < -5` does not mean what it looks like. For logic, use `or`.

## Common mistakes

- **Writing `x == a or b`.** It is always truthy when `b` is truthy. Use `x in (a, b)` or `x == a or x == b`.
- **Using `or` for defaults when falsy values are valid.**

  ```python
  def connect(timeout=None):
      timeout = timeout or 30
      return f"timeout={timeout}"


  print(connect(5))
  print(connect(0))   # 0 means "no waiting", but it became 30
  ```

  Output:

  ```text
  timeout=5
  timeout=30
  ```

  Fix: `timeout = 30 if timeout is None else timeout`.

- **Expecting a bool.** `name or "guest"` returns a string. That is usually the point, but remember it when you store or compare the result. Wrap it in `bool()` or use `any()` if you need `True`/`False`.
- **Mixing `and` and `or` without parentheses.** `a or b and c` is `a or (b and c)`. Make the grouping explicit.
- **Using `|` instead of `or`.** `|` evaluates both sides and has a different precedence.
- **Writing `min(data or [0])` when you mean `min(data, default=0)`.** Both work, but the `default` argument says exactly what you mean.

## Summary

- `x or y` is true if at least one operand is true.
- `or` short-circuits: if `x` is truthy, `y` is never evaluated.
- `x or y` returns `x` if it is truthy, otherwise `y`. A chain returns the first truthy operand or the last one.
- `value or default` is a concise fallback, but it replaces **all** falsy values. Use `is None` checks or `dict.get(key, default)` when `0`, `""` or `False` are valid.
- `and` binds tighter than `or`. Use parentheses when mixing them.
- `x == a or b` is a bug. Use `x in (a, b)`.
- `any()` is `or` over a collection and always returns a `bool`. `min()`/`max()` have a `default` argument for empty input.

## Practice

### Exercise 1: Predict the output

Write down what each line prints, then run the code to check.

```python
print(repr(0 or 1))
print(repr(1 or 0))
print(repr("" or "default"))
print(repr([] or {}))
print(repr(None or 0 or ""))
print(repr(0 or 2 or 3))
print(repr("a" or 1 / 0))
print(repr(False or None))
```

### Exercise 2: Fix the weekend check

This function has a bug. Explain what `is_weekend("Mon")` returns and why, then fix the function.

```python
def is_weekend(day):
    return day == "Sat" or "Sun"


print(is_weekend("Sat"), is_weekend("Mon"))
```

### Exercise 3: The first value that is not None

A program reads a setting from three places in order: a command-line value, an environment value and a built-in default. Any of the first two may be `None` (not set). `0` is a valid value. Write `get_setting(cli_value, env_value, default)` that returns the first value that is not `None`. Then compare `get_setting(0, 5, 10)` with the `or` chain `0 or 5 or 10` and explain the difference.

### Exercise 4: Display name

Write `display_name(user)` for a dictionary that may contain the keys `"nickname"` and `"full_name"`. Return the nickname, or the full name if the nickname is missing or empty, or `"Anonymous"` if both are missing or empty. Use a single expression with `or`. Explain why `or` is the right choice here, unlike in Exercise 3.

## Solutions

### Exercise 1

Output:

```text
1
1
'default'
{}
''
2
'a'
None
```

`or` returns the first truthy operand (`1`, `1`, `'default'`, `2`, `'a'`). When every operand is falsy, it returns the last one (`{}`, `''`, `None`). `1 / 0` is never evaluated.

### Exercise 2

`is_weekend("Mon")` returns `'Sun'`. The expression is `(day == "Sat") or "Sun"`: the comparison is `False`, so `or` returns the non-empty string `"Sun"`, which is truthy. The function "says yes" for every day.

```python
def is_weekend(day):
    return day in ("Sat", "Sun")


print(is_weekend("Sat"), is_weekend("Sun"), is_weekend("Mon"))
```

Output:

```text
True True False
```

### Exercise 3

```python
def first_not_none(*values):
    for value in values:
        if value is not None:
            return value
    return None


def get_setting(cli_value, env_value, default):
    return first_not_none(cli_value, env_value, default)


print(get_setting(None, "8080", "80"))
print(get_setting(None, None, 10))
print(get_setting(0, 5, 10))
print(0 or 5 or 10)   # the `or` chain skips the valid 0
```

Output:

```text
8080
10
0
5
```

The `or` chain skips the command-line value `0` because it is falsy and falls through to `5`. The `is not None` check treats `0` as a real value.

### Exercise 4

```python
def display_name(user):
    return user.get("nickname") or user.get("full_name") or "Anonymous"


print(display_name({"nickname": "max", "full_name": "Maksym K."}))
print(display_name({"nickname": "", "full_name": "Maksym K."}))
print(display_name({"full_name": ""}))
print(display_name({}))
```

Output:

```text
max
Maksym K.
Anonymous
Anonymous
```

Here an empty string is *not* a meaningful name, so skipping every falsy value (`None` from a missing key and `""`) is exactly the desired behaviour.

---

*Source: [pythontutorial.net — How to Use the Python or Operator More Effectively](https://www.pythontutorial.net/advanced-python/python-or/). Adapted and expanded for PyJourney.*
