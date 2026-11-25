# __repr__

Every object has two text forms: a friendly one for users (`str()`) and a precise one for developers (`repr()`). The special method `__repr__` controls the developer form. That is the text you see in the REPL, inside printed lists and dicts, in debuggers and in error messages, so a good `__repr__` makes debugging much faster.

## What you'll learn

- What `repr()` returns by default and how to customize it with `__repr__`
- The convention that a repr should look like Python code that recreates the object
- Why you should format values with `!r` inside `__repr__`
- How `str()` falls back to `__repr__`, but not the other way around
- Where Python uses `repr()` automatically
- How to choose between `__str__` and `__repr__`, and when to let `dataclasses` write `__repr__` for you

## The default repr

The built-in function `repr()` asks an object for its "official" string representation. Without any customization you get the generic text inherited from `object`:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age


person = Person("John", "Doe", 25)
print(repr(person))
```

Output (the address varies on every run):

```text
<__main__.Person object at 0x1044712b0>
```

It tells you the class and the memory address, but not the data. When a list of 50 such objects appears in a log, you cannot tell them apart.

## Implementing `__repr__`

`__repr__(self)` must return a `str`. When you call `repr(obj)`, Python calls `type(obj).__repr__(obj)`:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __repr__(self):
        return f'Person("{self.first_name}","{self.last_name}",{self.age})'


person = Person("John", "Doe", 25)
print(repr(person))
print(person)
print([person])
```

Output:

```text
Person("John","Doe",25)
Person("John","Doe",25)
[Person("John","Doe",25)]
```

Three things happened:

- `repr(person)` used the new method.
- `print(person)` also used it, because the class has no `__str__` (see the fallback rules below).
- The list shows its items with `repr()`, so the list output became readable too.

## The convention: a repr that recreates the object

The Python documentation recommends that, if at all possible, `__repr__` returns text that looks like a valid Python expression which would create an object with the same value. Then a developer who reads the repr knows exactly what the object contains and can even paste it into the REPL.

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __repr__(self):
        return f'Person("{self.first_name}","{self.last_name}",{self.age})'


person = Person("John", "Doe", 25)
clone = eval(repr(person))

print(clone)
print(clone is person)
```

Output:

```text
Person("John","Doe",25)
False
```

`eval()` built a **new** object with the same data. It is not the original `person` object. Note also that `clone == person` would be `False` at this point: the class has no `__eq__`, so `==` compares identity. That changes once you implement `__eq__` in the next topic.

> **Note:** The `eval(repr(obj))` round trip is a debugging convention, not a serialization format. Never call `eval()` on text that came from users, files or the network. Use `json`, `pickle` (only for trusted data) or a real format for storage.

## Quote values with `!r`

The hand-written quotes in the previous `__repr__` break as soon as a value contains a quote character:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __repr__(self):
        return f'Person("{self.first_name}","{self.last_name}",{self.age})'


person = Person('Shaquille "Shaq"', "O'Neal", 52)
print(repr(person))

try:
    eval(repr(person))
except SyntaxError as error:
    print("SyntaxError:", error.msg)
```

Output:

```text
Person("Shaquille "Shaq"","O'Neal",52)
SyntaxError: invalid syntax. Is this intended to be part of the string?
```

The fix is to let Python quote each value. The `!r` conversion in an f-string calls `repr()` on the value, and the repr of a string is always a correctly escaped string literal. Numbers, `None`, lists and your own objects are handled correctly too:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __repr__(self):
        return f"Person({self.first_name!r}, {self.last_name!r}, {self.age!r})"


person = Person('Shaquille "Shaq"', "O'Neal", 52)
print(repr(person))

clone = eval(repr(person))
print(clone.first_name, clone.last_name)
```

Output:

```text
Person('Shaquille "Shaq"', "O'Neal", 52)
Shaquille "Shaq" O'Neal
```

> **Tip:** Inside `__repr__`, write `{self.attr!r}` for every attribute by default. You will rarely need anything else.

## `str` vs `repr` on built-in types

Built-in types show the difference clearly. `str()` is for people, `repr()` is unambiguous:

```python
import datetime

text = "hello"
print(str(text))
print(repr(text))

day = datetime.date(2026, 11, 25)
print(str(day))
print(repr(day))
print([text, day])
```

Output:

```text
hello
'hello'
2026-11-25
datetime.date(2026, 11, 25)
['hello', datetime.date(2026, 11, 25)]
```

The repr of a string includes quotes, so you can see whether `1` is the number `1` or the string `'1'`. The repr of a date shows the exact type and constructor call.

## How `str()` and `repr()` fall back

The default `object.__str__` simply calls `repr(self)`. So `__repr__` serves as a fallback for `str()`, but `__str__` is **never** used as a fallback for `repr()`:

| The class defines | `str(obj)` / `print(obj)` uses | `repr(obj)` / containers use |
|---|---|---|
| nothing | default `<... object at 0x...>` | default `<... object at 0x...>` |
| only `__repr__` | `__repr__` | `__repr__` |
| only `__str__` | `__str__` | default `<... object at 0x...>` |
| both | `__str__` | `__repr__` |

Here is the "only `__str__`" row in action:

```python
class OnlyStr:
    def __str__(self):
        return "readable text"


obj = OnlyStr()
print(str(obj))
print(repr(obj))
print([obj])
```

Output (the address varies):

```text
readable text
<__main__.OnlyStr object at 0x1044712b0>
[<__main__.OnlyStr object at 0x1044712b0>]
```

This is why, if you implement only one of the two methods, it should usually be `__repr__`.

With both methods, each one serves its own audience:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __repr__(self):
        return f"Person({self.first_name!r}, {self.last_name!r}, {self.age!r})"

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.age})"


person = Person("John", "Doe", 25)
print(person)        # uses str()
print(repr(person))  # uses repr()
print([person])      # the list uses repr() for its items
```

Output:

```text
John Doe (25)
Person('John', 'Doe', 25)
[Person('John', 'Doe', 25)]
```

## Where Python uses `repr()` automatically

- **The interactive interpreter (REPL)** echoes the repr of every expression you evaluate:

  ```python
  >>> import datetime
  >>> day = datetime.date(2026, 11, 25)
  >>> day
  datetime.date(2026, 11, 25)
  >>> print(day)
  2026-11-25
  >>> "hello"
  'hello'
  ```

- **Containers**: `list`, `tuple`, `dict`, `set` show their items with `repr()`.
- **f-strings**: `f"{obj!r}"` calls `repr()`, and the self-documenting form `f"{obj=}"` (Python 3.8+) shows the expression and its repr.
- **Debuggers, `pdb` and IDE variable views** display reprs.
- **`%r`** in `%`-formatting and in `logging` messages.

```python
class Money:
    def __init__(self, amount, currency):
        self.amount = amount
        self.currency = currency

    def __repr__(self):
        return f"Money({self.amount!r}, {self.currency!r})"


price = Money(9.5, "EUR")
print(f"{price!r}")
print(f"{price=}")
print("Debug: %r" % price)
```

Output:

```text
Money(9.5, 'EUR')
price=Money(9.5, 'EUR')
Debug: Money(9.5, 'EUR')
```

## When the object cannot be recreated

Some objects cannot be rebuilt from a simple expression: open files, network connections, locks. For those the convention is a description in **angle brackets**, so nobody mistakes it for code:

```python
class Connection:
    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.is_open = True

    def __repr__(self):
        state = "open" if self.is_open else "closed"
        return f"<{type(self).__name__} {self.host}:{self.port} ({state})>"


conn = Connection("db.example.com", 5432)
print(repr(conn))
conn.is_open = False
print([conn])
```

Output:

```text
<Connection db.example.com:5432 (open)>
[<Connection db.example.com:5432 (closed)>]
```

The default `<__main__.Person object at 0x...>` follows the same convention. Notice also `type(self).__name__`: subclasses of `Connection` will automatically show their own class name.

## Let `dataclasses` write it for you

For classes that mainly hold data, the `@dataclass` decorator generates a `__repr__` that follows all the conventions above:

```python
from dataclasses import dataclass


@dataclass
class Point:
    x: int
    y: int


p = Point(1, 2)
print(p)
print(eval(repr(p)) == p)
```

Output:

```text
Point(x=1, y=2)
True
```

`dataclass` also generates `__eq__`, which is why the round trip compares equal here.

## Edge case: objects that refer to each other

If two objects include each other in their repr, `repr()` never ends:

```python
import reprlib


class Player:
    def __init__(self, name):
        self.name = name
        self.partner = None

    def __repr__(self):
        return f"Player({self.name!r}, partner={self.partner!r})"


class SafePlayer(Player):
    @reprlib.recursive_repr()
    def __repr__(self):
        return f"SafePlayer({self.name!r}, partner={self.partner!r})"


a, b = Player("Ann"), Player("Bob")
a.partner, b.partner = b, a
try:
    print(repr(a))
except RecursionError as error:
    print("RecursionError:", error)

c, d = SafePlayer("Cat"), SafePlayer("Dan")
c.partner, d.partner = d, c
print(repr(c))
```

Output:

```text
RecursionError: maximum recursion depth exceeded
SafePlayer('Cat', partner=SafePlayer('Dan', partner=...))
```

The `reprlib.recursive_repr()` decorator detects the cycle and prints `...` instead of recursing again. Built-in containers already do this on their own: a list that contains itself prints as `[[...]]`.

## Common mistakes

- **Hand-writing quotes.** `f'Person("{self.name}")'` breaks for names with quotes and turns `None` into `"None"`. Use `{self.name!r}`.
- **Implementing only `__str__`.** Lists, the REPL and debuggers will still show `<... object at 0x...>`. If you write only one method, write `__repr__`.
- **Making `__repr__` friendly instead of precise.** `John Doe` is a good `__str__` but a poor repr: it hides the type and the exact values.
- **Hard-coding the class name.** Use `type(self).__name__`, so subclasses show their own name.
- **Returning a non-string or printing.** `__repr__` must return a `str`; otherwise you get `TypeError: __repr__ returned non-string`.
- **Treating `eval(repr(obj))` as storage.** It is a convention for readability, and `eval()` on untrusted input is a security hole.

## Summary

- `repr(obj)` calls `__repr__`, which returns the developer-oriented, unambiguous text of an object.
- By convention a repr looks like a constructor call that would recreate an equal object; if that is impossible, use `<...>` with useful details.
- Format attributes with `!r` inside `__repr__` to get correct quoting.
- The default `__str__` falls back to `__repr__`, but `repr()` never falls back to `__str__`.
- The REPL, containers, `!r`, `f"{x=}"`, debuggers and `%r` all use `repr()`.
- `__str__` is for users, `__repr__` is for developers; implement `__repr__` first.
- `@dataclass` generates a good `__repr__` automatically, and `reprlib.recursive_repr()` protects against cycles.

## Practice

### Exercise 1: A round-trip `Point`

Write a `Point` class with `x` and `y`. Its `__repr__` must produce text such as `Point(3, -1.5)`. Show that `eval(repr(p))` creates a different object with the same coordinates.

### Exercise 2: Fix the broken repr

This class produces a repr that is not valid Python and changes `None` into a string. Run it, find both problems, and fix the method.

```python
class Book:
    def __init__(self, title, author):
        self.title = title
        self.author = author

    def __repr__(self):
        return f'Book("{self.title}", "{self.author}")'


books = [Book('The "Best" Book', "Anonymous"), Book("Untitled", None)]
print(books)
```

### Exercise 3: Predict the output

Predict every line before running the code:

```python
class Money:
    def __init__(self, amount, currency):
        self.amount = amount
        self.currency = currency

    def __repr__(self):
        return f"Money({self.amount!r}, {self.currency!r})"

    def __str__(self):
        return f"{self.amount:.2f} {self.currency}"


price = Money(9.5, "EUR")
print(price)
print(str(price))
print([price])
print(f"{price!r}")
print(f"{price=}")
print(f"Total: {price}")
```

### Exercise 4: One `__repr__` for a whole hierarchy

Write a base class `Shape` with a single `__repr__` that works for any subclass: it must show the subclass name and all instance attributes as keyword arguments. `Circle(2)` must print as `Circle(radius=2)` and `Rect(3, 4.5)` as `Rect(width=3, height=4.5)`. Hint: `vars(self)` returns the instance's attribute dictionary.

## Solutions

### Exercise 1

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Point({self.x!r}, {self.y!r})"


p = Point(3, -1.5)
text = repr(p)
print(text)

clone = eval(text)
print(clone)
print(clone is p)
print((clone.x, clone.y) == (p.x, p.y))
```

Output:

```text
Point(3, -1.5)
Point(3, -1.5)
False
True
```

### Exercise 2

The original prints:

```text
[Book("The "Best" Book", "Anonymous"), Book("Untitled", "None")]
```

Problem 1: the quotes inside the title end the string literal early, so the text is not valid Python. Problem 2: `None` is wrapped in quotes and turns into the string `"None"`. Both disappear with `!r`:

```python
class Book:
    def __init__(self, title, author):
        self.title = title
        self.author = author

    def __repr__(self):
        return f"Book({self.title!r}, {self.author!r})"


books = [Book('The "Best" Book', "Anonymous"), Book("Untitled", None)]
print(books)
print(eval(repr(books[0])).title)
```

Output:

```text
[Book('The "Best" Book', 'Anonymous'), Book('Untitled', None)]
The "Best" Book
```

### Exercise 3

Output:

```text
9.50 EUR
9.50 EUR
[Money(9.5, 'EUR')]
Money(9.5, 'EUR')
price=Money(9.5, 'EUR')
Total: 9.50 EUR
```

`print()`, `str()` and a plain `{price}` use `__str__`. The list, `!r` and the `=` specifier use `__repr__`.

### Exercise 4

```python
class Shape:
    def __repr__(self):
        args = ", ".join(f"{name}={value!r}" for name, value in vars(self).items())
        return f"{type(self).__name__}({args})"


class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius


class Rect(Shape):
    def __init__(self, width, height):
        self.width = width
        self.height = height


shapes = [Circle(2), Rect(3, 4.5)]
print(shapes)
print(eval(repr(shapes[1])).height)
```

Output:

```text
[Circle(radius=2), Rect(width=3, height=4.5)]
4.5
```

`vars(self)` keeps the order in which `__init__` created the attributes, and `type(self).__name__` picks the name of the actual subclass. The keyword form `Rect(width=3, height=4.5)` is still valid Python, so the round trip works.

---

*Source: [pythontutorial.net — Python __repr__](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__repr__/). Adapted and expanded for PyJourney.*
