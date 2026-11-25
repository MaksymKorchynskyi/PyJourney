# Python is operator

Python has two different ways to ask whether two things are "the same". The `==` operator asks whether two objects have **equal values**. The `is` operator asks whether two names refer to **the very same object**. Mixing them up leads to code that works in a quick test and then fails in production.

## What you'll learn

- What object identity is and how `is` checks it
- The difference between `is` (identity) and `==` (equality)
- Why `a = 100; b = 100; a is b` may be `True` and why you must not rely on it
- How `is not` works and how it differs from `is (not ...)`
- When `is` is the right tool: `None`, sentinel objects, exact types
- Edge cases: custom `__eq__`, `NaN`, and the `SyntaxWarning` for literals

## Identity: the `is` operator

Every object has an identity, which `id()` returns. `a is b` is `True` exactly when `a` and `b` refer to the same object, which is the same as `id(a) == id(b)` while both objects are alive.

```python
a = 100
b = a
print(a is b)
```

Output:

```text
True
```

`b = a` does not copy anything. It binds a second name to the object that `a` refers to, so both names point to one `int` object.

Two objects created separately are different objects, even when their contents are equal:

```python
ranks = [1, 2, 3]
rates = [1, 2, 3]

print(ranks == rates)
print(ranks is rates)
```

Output:

```text
True
False
```

```text
ranks ---> list [1, 2, 3]     (object #1)
rates ---> list [1, 2, 3]     (object #2: equal value, different identity)
```

Each list display `[...]` creates a new list. Lists are mutable, so Python must never share them behind your back: if `rates` and `ranks` were one object, appending to one would change the other.

## `is` vs `==`

| | `a is b` | `a == b` |
|---|---|---|
| Question | Are they the same object? | Do they have equal values? |
| Implemented by | The interpreter (compares identities) | The object's `__eq__()` method |
| Can a class change it? | No | Yes |
| Speed | Always a single, constant-time check | Can be slow (e.g. comparing two long lists) |

If `a is b` is `True`, then `a == b` is normally `True` as well. The reverse does not hold: equal objects are often different objects.

Because `==` calls `__eq__()`, a class can make it return anything. `is` cannot be overridden:

```python
class AlwaysEqual:
    def __eq__(self, other):
        return True


thing = AlwaysEqual()
print(thing == 42)
print(thing == None)
print(thing is None)
```

Output:

```text
True
True
False
```

This is the main reason to compare with `None` using `is` (more in the next topic).

## Small integers and other cached objects

Here is a surprising result from the original lesson:

```python
a = 100
b = 100
print(a is b)

x = int("256")
y = int("256")
print(x is y)

x = int("257")
y = int("257")
print(x is y)
print(x == y)
```

Output:

```text
True
True
False
True
```

The two `100` objects are not linked in any way by your code. They happen to be one object because CPython keeps a cache of small integers from `-5` to `256`. Every time a small integer is needed, the cached object is reused. `257` is outside the cache, so two integers computed at runtime are separate objects.

It gets even less predictable. In a script, both of these lines are compiled together, and the compiler stores the constant `1000` only once:

```python
a = 1000
b = 1000
print(a is b)
```

Output (when run as a script):

```text
True
```

Typed line by line in the interactive interpreter, each line is compiled separately:

```python
>>> a = 1000
>>> b = 1000
>>> a is b
False
```

Strings behave similarly: short identifier-like literals are often **interned** (shared), but strings built at runtime usually are not:

```python
first = "hello"
second = "".join(["hel", "lo"])

print(first == second)
print(first is second)
```

Output:

```text
True
False
```

> **Note:** Integer caching, constant sharing and string interning are CPython optimisations. They differ between versions, between the REPL and scripts, and between implementations. Never use `is` to compare numbers or strings. Use `==`.

Since Python 3.8 the compiler warns you when you use `is` with a literal:

```python
count = 5
print(count is 5)
```

Output:

```text
.../example.py:2: SyntaxWarning: "is" with 'int' literal. Did you mean "=="?
  print(count is 5)
True
```

The result is `True` here only because of the small-integer cache. The warning is printed when the code is compiled (on standard error), before the program even runs.

## The `is not` operator

`is not` is a single operator, the negation of `is`. It returns `True` when the two names refer to different objects:

```python
ranks = [1, 2, 3]
rates = [1, 2, 3]

print(ranks is not rates)
print(not ranks is rates)
print(ranks is (not rates))
```

Output:

```text
True
True
False
```

- `ranks is not rates` is the idiomatic form.
- `not ranks is rates` gives the same result, because `is` binds more tightly than `not`, but it reads worse. PEP 8 recommends `is not`.
- `ranks is (not rates)` is something else entirely: `not rates` evaluates to `False` (the list is not empty), and `ranks is False` is `False`.

## Identity versus equality for `NaN`

The floating-point "not a number" value is not equal even to itself. Containers, however, check identity **before** equality when comparing items:

```python
nan = float("nan")

print(nan == nan)
print(nan is nan)
print([nan] == [nan])
print(nan in [nan])
```

Output:

```text
False
True
True
True
```

`list.__eq__` and `in` treat an item as matching when it `is` the target object, even if `==` would say otherwise. This identity shortcut is a deliberate optimisation used throughout the built-in containers.

## When to use `is`

Use `is` and `is not` only when identity is really the question:

- **Comparing with `None`:** `if result is None:`. `None` is a singleton, and `is` cannot be fooled by a custom `__eq__`.
- **Sentinel objects:** a unique marker such as `_MISSING = object()` that means "no value was passed". Only `is` can tell it apart from every other value, including `None`.
- **Checking for an exact type:** `type(x) is int` (when you deliberately want to exclude subclasses; otherwise use `isinstance`).
- **Detecting aliasing:** `if source is target:` to check that two names do not share a mutable object before modifying one of them.
- **Other singletons:** `...` (`Ellipsis`) and `NotImplemented`.

For `True` and `False`, write `if flag:` instead of `if flag is True:`. Both booleans are singletons, so `is` works, but plain truthiness is more idiomatic.

## Common mistakes

- **Comparing numbers or strings with `is`.** It may work for small values and short strings, then fail for others. Always use `==` for values.
- **Using `==` to check for `None`.** A custom `__eq__` can return `True` for `obj == None`. Write `obj is None`.
- **Writing `a is (not b)` or `not a is b`.** Use the single operator `a is not b`.
- **Expecting `is` to compare contents.** `[1, 2] is [1, 2]` is `False`: two separate lists.
- **Ignoring `SyntaxWarning: "is" with ... literal`.** It almost always points to a real bug.

## Summary

- `a is b` checks identity: do both names refer to one object? It cannot be overridden.
- `a == b` checks equality by calling `__eq__()`. Equal objects are often different objects.
- `is not` is the negation of `is`. Prefer it to `not a is b`.
- Small integers (`-5` to `256`), shared constants and interned strings may make `is` return `True` for equal values. This is an implementation detail: never rely on it.
- Use `is` for `None`, sentinels, exact type checks and aliasing checks. Use `==` for everything else.

## Practice

### Exercise 1: Identity or equality?

Predict every printed line, then run the code.

```python
a = [1, 2]
b = a
c = [1, 2]
d = a[:]

print(a is b, a == b)
print(a is c, a == c)
print(a is d, a == d)
print(a is not c)
print(type(a) is list)
```

### Exercise 2: A sentinel default

Write `get_setting(settings, key, default=...)` that works like `dict.get()` with one difference: if the key is missing **and no default was passed**, it raises `KeyError`. Passing `default=None` explicitly must still return `None`. Hint: create a unique sentinel with `object()` and compare with `is`.

### Exercise 3: Count distinct objects

Write `count_distinct(items)` that returns how many **different objects** (not different values) a list contains. Test it with `row = [0, 0]` and `grid = [row, row, [0, 0]]`: the answer must be `2`, even though all three rows are equal. Then change `grid[0][0]` and print `grid` to see the consequence.

### Exercise 4: Fix the role check

This function sometimes rejects real admins. Run it, read the warning, explain the bug and fix it.

```python
def is_admin(role):
    return role is "admin"


print(is_admin("admin"))
print(is_admin("".join(["ad", "min"])))
```

## Solutions

### Exercise 1

Output:

```text
True True
False True
False True
True
True
```

- `b` is another name for the same list.
- `c` is a separate list with equal contents.
- `a[:]` creates a shallow copy: a new list with equal contents.
- `a is not c` is `True` because they are different objects.
- `type(a)` returns the `list` class itself, and there is only one `list` class.

### Exercise 2

```python
_MISSING = object()   # a unique object that no caller can pass by accident


def get_setting(settings, key, default=_MISSING):
    if key in settings:
        return settings[key]
    if default is _MISSING:
        raise KeyError(key)
    return default


config = {"debug": False, "timeout": None}
print(get_setting(config, "debug"))
print(get_setting(config, "timeout"))
print(get_setting(config, "retries", None))

try:
    get_setting(config, "retries")
except KeyError as error:
    print("KeyError:", error)
```

Output:

```text
False
None
None
KeyError: 'retries'
```

`None` cannot serve as the "nothing passed" marker here, because `None` is a perfectly valid default. `object()` creates a brand-new object that is equal only to itself, and `is` checks for exactly that object.

### Exercise 3

```python
def count_distinct(items):
    seen_ids = set()
    for item in items:
        seen_ids.add(id(item))   # safe: every item is alive inside the list
    return len(seen_ids)


row = [0, 0]
grid = [row, row, [0, 0]]

print(count_distinct(grid))
print(grid[0] == grid[2])
grid[0][0] = 5
print(grid)
```

Output:

```text
2
True
[[5, 0], [5, 0], [0, 0]]
```

The first two rows are the same object, so changing `grid[0]` also changes `grid[1]`. Comparing `id()` values is safe here because all items are kept alive by the list during the whole call.

### Exercise 4

The original prints a warning and two different answers for equal strings:

```text
.../example.py:2: SyntaxWarning: "is" with 'str' literal. Did you mean "=="?
  return role is "admin"
True
False
```

The literal `"admin"` and the string built by `join()` are equal but are different objects, so `is` returns `False`. Compare values with `==`:

```python
def is_admin(role):
    return role == "admin"


print(is_admin("admin"))
print(is_admin("".join(["ad", "min"])))
```

Output:

```text
True
True
```

---

*Source: [pythontutorial.net — Python is operator](https://www.pythontutorial.net/advanced-python/python-is-operator/). Adapted and expanded for PyJourney.*
