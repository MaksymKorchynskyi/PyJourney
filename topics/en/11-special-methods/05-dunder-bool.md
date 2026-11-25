# __bool__

Every Python object can be used in a condition: `if cart:`, `while queue:`, `x or default`. Python decides whether an object counts as "true" or "false" through its **truth value**. The special method `__bool__`, together with its fallback `__len__`, lets your own classes take part in this in a natural way.

## What you'll learn

- Where Python evaluates truth values: `if`, `while`, `and`, `or`, `not`, `bool()` and more
- Why objects of a custom class are truthy by default
- How to implement `__bool__` and what it must return
- How `__len__` is used as a fallback when `__bool__` is missing
- How `and` and `or` use truth values but return operands
- Why `if obj:` and `if obj is not None:` are different questions

## Truth value testing

Python asks an object for its truth value whenever it needs a yes/no answer:

- `if obj:`, `elif obj:` and `while obj:`
- `not obj`, `a and b`, `a or b`
- the conditional expression `x if obj else y`
- `bool(obj)`, `any()`, `all()`, `filter(None, items)` and `assert obj`

Built-in types already have sensible rules. Zero numbers (`0`, `0.0`), empty containers (`""`, `[]`, `{}`, `set()`), `None` and `False` are **falsy**. Everything else is **truthy**.

## Custom objects are truthy by default

A class that defines neither `__bool__` nor `__len__` produces objects that are always true:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


person = Person("John", 25)
print(bool(person))
if person:
    print("person is truthy")
```

Output:

```text
True
person is truthy
```

This default is what makes the common pattern `if user:` work for "a user object exists" versus `None`.

## Implementing `__bool__`

`__bool__(self)` must return exactly `True` or `False`. Python calls it whenever it needs the truth value of your object. As an example, consider a person "truthy" only when their age is between 18 and 65:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __bool__(self):
        if self.age < 18 or self.age > 65:
            return False
        return True


person = Person("Jane", 16)
print(bool(person))
print(bool(Person("Ann", 40)))
```

Output:

```text
False
True
```

The `if/else` can be shortened to a single expression that already produces a `bool`:

```python
def __bool__(self):
    return 18 <= self.age <= 65
```

> **Note:** This example shows the mechanics, but the meaning is questionable: a 16-year-old person is not "false". When the condition is a business rule, an explicit method such as `person.is_working_age()` is easier to read. Reserve `__bool__` for classes where "empty", "zero" or "nothing" is the obvious meaning.

### `__bool__` must return a real `bool`

Returning `1`, `0` or any other value raises `TypeError`. This often happens by accident with `or`, which returns one of its operands:

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __bool__(self):
        return self.x or self.y  # returns a number, not a bool


try:
    if Point(3, 0):
        print("non-zero")
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
TypeError: __bool__ should return bool, returned int
```

Write `return self.x != 0 or self.y != 0`, or wrap the expression in `bool(...)`.

## The `__len__` fallback

If a class has no `__bool__`, Python looks for `__len__`. An object whose length is `0` is falsy, any other length is truthy. This is exactly how lists, strings and dicts behave, so container-like classes get the right truth value for free:

```python
class Payroll:
    def __init__(self, length):
        self.length = length

    def __len__(self):
        print("len was called...")
        return self.length


payroll = Payroll(0)
print(bool(payroll))

payroll.length = 10
print(bool(payroll))
```

Output:

```text
len was called...
False
len was called...
True
```

The printed messages prove that `bool()` called `__len__`. `__len__` must return a non-negative integer; a negative value raises `ValueError` and a non-integer raises `TypeError`.

The full lookup order is:

```text
bool(obj)
 1. type(obj) has __bool__?  -> its result (must be True or False)
 2. type(obj) has __len__?   -> True if len(obj) != 0, else False
 3. neither                  -> True
```

### `__bool__` wins over `__len__`

When both methods exist, Python only calls `__bool__`:

```python
class Report:
    def __init__(self, rows):
        self.rows = rows

    def __len__(self):
        print("__len__ called")
        return len(self.rows)

    def __bool__(self):
        print("__bool__ called")
        return True  # a report exists even if it has no rows


report = Report([])
print(len(report))
print(bool(report))
```

Output:

```text
__len__ called
0
__bool__ called
True
```

## `and`, `or` and `not` with custom objects

`not` always returns a `bool`. But `and` and `or` use the truth value only to decide **which operand to return**, and they return that operand itself:

- `a or b` returns `a` if `a` is truthy, otherwise `b`.
- `a and b` returns `a` if `a` is falsy, otherwise `b`.

```python
class Wallet:
    def __init__(self, amount):
        self.amount = amount

    def __bool__(self):
        return self.amount > 0

    def __repr__(self):
        return f"Wallet({self.amount})"


empty = Wallet(0)
full = Wallet(50)

print(empty or full)
print(full and empty)
print(not empty)
print(any([empty, full]))
print(all([empty, full]))
print(list(filter(None, [empty, full, Wallet(5)])))
```

Output:

```text
Wallet(50)
Wallet(0)
True
True
False
[Wallet(50), Wallet(5)]
```

`filter(None, items)` keeps only the truthy items, so it uses `__bool__` too.

## `if obj:` is not `if obj is not None:`

Once a class has `__bool__` or `__len__`, an existing object can be falsy. Code that uses `if obj:` to mean "did I get an object?" then breaks silently:

```python
class Team:
    def __init__(self, name, members):
        self.name = name
        self.members = members

    def __len__(self):
        return len(self.members)


teams = {"red": Team("red", ["Ann", "Bob"]), "blue": Team("blue", [])}


def find_team(name):
    return teams.get(name)


for name in ["red", "blue", "green"]:
    team = find_team(name)
    if team:
        print(f"{name}: found")
    else:
        print(f"{name}: no such team")
```

Output:

```text
red: found
blue: no such team
green: no such team
```

The `blue` team exists but has no members, so it is falsy and is reported as missing. When `None` means "not found", test for it explicitly with `is None` or `is not None`. Exercise 4 fixes this code.

> **Tip:** Some libraries refuse to guess. A NumPy array with several elements raises `ValueError: The truth value of an array with more than one element is ambiguous` when used in `if`. That is a deliberate design choice: you must say `arr.any()` or `arr.all()`.

## Common mistakes

- **Returning a non-`bool` from `__bool__`.** `return self.count` or `return self.x or self.y` raises `TypeError`. Return a comparison or wrap the value in `bool()`.
- **Using `__bool__` for business rules.** `if person:` meaning "is of working age" surprises readers. Use a named method or property.
- **Testing for `None` with truthiness.** Empty but existing objects are falsy. Write `if result is None:`.
- **Forgetting that `__len__` also controls truthiness.** Adding `__len__` to a class changes how its objects behave in every `if`.
- **Returning a negative number from `__len__`.** `bool()` and `len()` raise `ValueError`.
- **Expecting `and` / `or` to return `True` or `False`.** They return one of the operands.

## Summary

- Every object has a truth value, used by `if`, `while`, `not`, `and`, `or`, `bool()`, `any()`, `all()` and `filter(None, ...)`.
- Objects of a custom class are truthy unless the class says otherwise.
- `__bool__` must return exactly `True` or `False`; any other type raises `TypeError`.
- Without `__bool__`, Python uses `__len__`: length `0` means falsy.
- If both exist, `__bool__` takes precedence. If neither exists, the object is truthy.
- `and` and `or` return operands, not `bool` values; `not` always returns a `bool`.
- Use `is None` to check for a missing object, not truthiness.

## Practice

### Exercise 1: An empty playlist

Write a `Playlist` class that stores a list of songs and implements only `__len__`. Write a function `play(playlist)` that prints `Playing N songs` for a non-empty playlist and `Playlist is empty` otherwise, using `if playlist:`.

### Exercise 2: The zero vector

Write a `Vector` class with `x` and `y`. A vector is falsy only when both components are zero (`0` or `0.0`). Add a `__repr__`, print each vector from `[Vector(0, 0), Vector(3, 0), Vector(0, -2), Vector(0.0, 0.0)]` with its truth value, and then keep only the non-zero vectors with `filter(None, ...)`.

### Exercise 3: Predict the output

Using the `Wallet` class from this lesson, predict every line:

```python
class Wallet:
    def __init__(self, amount):
        self.amount = amount

    def __bool__(self):
        return self.amount > 0

    def __repr__(self):
        return f"Wallet({self.amount})"


a, b, c = Wallet(0), Wallet(10), Wallet(-5)
print(a or b)
print(a or c)
print(b and c)
print(not c)
print(b and "paid")
print([w for w in (a, b, c) if w])
```

### Exercise 4: Fix the missing team

Rewrite the loop from the section "`if obj:` is not `if obj is not None:`" so that it prints three different messages: `red: found, 2 members`, `blue: found, but it has no members` and `green: no such team`.

## Solutions

### Exercise 1

```python
class Playlist:
    def __init__(self, songs=None):
        self.songs = list(songs or [])

    def __len__(self):
        return len(self.songs)


def play(playlist):
    if playlist:
        print(f"Playing {len(playlist)} songs")
    else:
        print("Playlist is empty")


play(Playlist())
play(Playlist(["Song A", "Song B", "Song C"]))
```

Output:

```text
Playlist is empty
Playing 3 songs
```

`songs=None` together with `list(songs or [])` avoids the shared mutable default argument and also copies the caller's list.

### Exercise 2

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __bool__(self):
        return self.x != 0 or self.y != 0

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"


vectors = [Vector(0, 0), Vector(3, 0), Vector(0, -2), Vector(0.0, 0.0)]
for v in vectors:
    print(v, bool(v))
print(list(filter(None, vectors)))
```

Output:

```text
Vector(0, 0) False
Vector(3, 0) True
Vector(0, -2) True
Vector(0.0, 0.0) False
[Vector(3, 0), Vector(0, -2)]
```

Both comparisons return `bool`, so `or` returns a `bool` too. `0.0 != 0` is `False`, so the float zero vector is also falsy.

### Exercise 3

Output:

```text
Wallet(10)
Wallet(-5)
Wallet(-5)
True
paid
[Wallet(10)]
```

- `a or b`: `a` is falsy, so `or` returns `b`.
- `a or c`: `a` is falsy, so `or` returns `c` even though `c` is falsy too.
- `b and c`: `b` is truthy, so `and` returns `c`.
- `not c`: the amount `-5` is not greater than 0, so `c` is falsy and `not c` is `True`.
- `b and "paid"`: `b` is truthy, so the result is the string `"paid"`.
- The comprehension keeps only truthy wallets.

### Exercise 4

```python
class Team:
    def __init__(self, name, members):
        self.name = name
        self.members = members

    def __len__(self):
        return len(self.members)


teams = {"red": Team("red", ["Ann", "Bob"]), "blue": Team("blue", [])}


def find_team(name):
    return teams.get(name)


for name in ["red", "blue", "green"]:
    team = find_team(name)
    if team is None:
        print(f"{name}: no such team")
    elif not team:
        print(f"{name}: found, but it has no members")
    else:
        print(f"{name}: found, {len(team)} members")
```

Output:

```text
red: found, 2 members
blue: found, but it has no members
green: no such team
```

The identity check `is None` answers "was a team found?", and only then truthiness answers "does it have members?".

---

*Source: [pythontutorial.net — Python __bool__](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__bool__/). Adapted and expanded for PyJourney.*
