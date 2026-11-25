# Open–closed principle

The Open–Closed Principle (OCP) says that software entities should be **open for extension but closed for modification**: you should be able to add new behaviour by *adding* new code, not by *editing* code that already works. It is the "O" in SOLID, and it is the reason plugins, strategies and abstract base classes exist.

## What you'll learn

- What "open for extension, closed for modification" means in practice
- How to recognise code that has to be edited every time a new variant appears
- How to refactor it with an abstract base class (`abc.ABC`), with "before" and "after" code
- How to do the same with `typing.Protocol` and with plain functions in a registry
- Which part of the code is "closed" and which is "open"
- The trade-offs: when an abstraction pays off and when it is premature

## The idea

The principle sounds contradictory: how can code be both open and closed? The two words refer to different things:

- **Open for extension**: the *behaviour* of the system can grow. You can support a new file format, a new payment method or a new shape.
- **Closed for modification**: the *source code* that already works (and is tested, reviewed and deployed) does not have to be edited to make that happen.

Why care? Every edit to working code is a chance to break it. If supporting a tenth export format means editing the same function for the tenth time, each edit risks breaking the nine formats that already work, and every test for that function has to be re-run and maybe rewritten. If instead you add a new class or function next to the old ones, the old code is untouched and the risk is contained.

> **Note:** The term comes from Bertrand Meyer (1988), who meant extension through inheritance. Robert C. Martin later reframed it around abstractions and polymorphism, which is the version used in SOLID and in this lesson.

## Before: a class that must be edited for every format

```python
class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"


class PersonStorage:
    def save_to_database(self, person):
        print(f"Save {person} to database")

    def save_to_json(self, person):
        print(f"Save {person} to a JSON file")


if __name__ == "__main__":
    person = Person("John Doe")
    storage = PersonStorage()
    storage.save_to_database(person)
```

Output:

```text
Save Person(name='John Doe') to database
```

`PersonStorage` has one method per format. To support XML you must open `PersonStorage` and add `save_to_xml()`. Worse, every caller has to know which method to call, so the choice of format leaks into the rest of the program. The class is open for *modification*, not for extension.

The same problem often appears as an `if`/`elif` chain:

```python
def save(person, fmt):
    if fmt == "database":
        print(f"Save {person} to database")
    elif fmt == "json":
        print(f"Save {person} to a JSON file")
    else:
        raise ValueError(f"Unknown format: {fmt!r}")


save("John Doe", "json")
```

Output:

```text
Save John Doe to a JSON file
```

Each new format adds another branch to the same function. Chains of `if isinstance(...)` or `match` statements over types have the same weakness: they are a single place that must be edited for every new variant.

## After: depend on an abstraction

The fix is to find what all variants have in common, which here is "save a person somewhere", and turn it into an **abstraction**. Code that needs to save people then depends only on that abstraction.

First, define an abstract base class with an abstract `save()` method:

```python
from abc import ABC, abstractmethod


class PersonStorage(ABC):
    @abstractmethod
    def save(self, person):
        """Persist one person."""
```

Second, implement each format as its own subclass:

```python
class PersonDB(PersonStorage):
    def save(self, person):
        print(f"Save {person} to database")


class PersonJSON(PersonStorage):
    def save(self, person):
        print(f"Save {person} to a JSON file")
```

Third, when XML support is needed, **add** a class. Nothing existing is edited:

```python
class PersonXML(PersonStorage):
    def save(self, person):
        print(f"Save {person} to an XML file")
```

Put it all together, with a client function `save_all()` that works with any storage:

```python
from abc import ABC, abstractmethod


class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"


class PersonStorage(ABC):
    @abstractmethod
    def save(self, person):
        """Persist one person."""


class PersonDB(PersonStorage):
    def save(self, person):
        print(f"Save {person} to database")


class PersonJSON(PersonStorage):
    def save(self, person):
        print(f"Save {person} to a JSON file")


class PersonXML(PersonStorage):
    def save(self, person):
        print(f"Save {person} to an XML file")


def save_all(people, storage: PersonStorage):
    for person in people:
        storage.save(person)


if __name__ == "__main__":
    people = [Person("John Doe"), Person("Jane Doe")]
    save_all(people, PersonXML())
    save_all(people[:1], PersonDB())
```

Output:

```text
Save Person(name='John Doe') to an XML file
Save Person(name='Jane Doe') to an XML file
Save Person(name='John Doe') to database
```

Now look at which parts are which:

- **Closed**: `PersonStorage` and `save_all()`. They never change when a format is added.
- **Open**: the set of `PersonStorage` subclasses. Anyone can add one, even in a different module or package.

```text
              save_all(people, storage)
                         |
                         v
                  PersonStorage (ABC)        <- stable abstraction
                  + save(person)
          ┌──────────┬───┴───────┬──────────┐
          v          v           v          v
      PersonDB   PersonJSON  PersonXML   (your new class)
```

### What `abc.ABC` buys you

The abstract base class does more than document the interface. A subclass that forgets to implement `save()` cannot even be created, so the mistake shows up immediately instead of deep inside `save_all()`:

```python
from abc import ABC, abstractmethod


class PersonStorage(ABC):
    @abstractmethod
    def save(self, person):
        """Persist one person."""


class PersonCSV(PersonStorage):
    def save_person(self, person):  # typo: wrong method name
        print(f"Save {person} to a CSV file")


try:
    PersonCSV()
except TypeError as error:
    print(error)
```

Output:

```text
Can't instantiate abstract class PersonCSV without an implementation for abstract method 'save'
```

> **Note:** This protection only works for methods decorated with `@abstractmethod`. A class that inherits from `ABC` but has no abstract methods can be instantiated like any other class.

## Alternative: `typing.Protocol`

An ABC requires every implementation to *inherit* from it. Sometimes that is impossible or unwanted, for example when the class comes from a third-party library. A `Protocol` (Python 3.8+) describes the required methods **structurally**: any class that has a matching `save()` method fits, with no inheritance at all. This is static duck typing, checked by tools like mypy or pyright.

```python
from typing import Protocol


class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"


class PersonStorage(Protocol):
    def save(self, person: Person) -> None: ...


class PersonDB:  # no base class needed
    def save(self, person: Person) -> None:
        print(f"Save {person} to database")


class PersonYAML:
    def save(self, person: Person) -> None:
        print(f"Save {person} to a YAML file")


def save_all(people: list[Person], storage: PersonStorage) -> None:
    for person in people:
        storage.save(person)


people = [Person("John Doe")]
save_all(people, PersonDB())
save_all(people, PersonYAML())
```

Output:

```text
Save Person(name='John Doe') to database
Save Person(name='John Doe') to a YAML file
```

| | `abc.ABC` | `typing.Protocol` |
|---|---|---|
| Implementations must inherit | Yes | No |
| Missing method detected | At runtime, when you create the object | By a type checker, before running |
| Can share code with implementations | Yes (concrete methods in the base) | Rarely used for that |
| Works with classes you cannot edit | No | Yes |

## Alternative: functions and a registry

In Python a behaviour does not have to be a class. When each variant is a single operation, plain functions are often the simplest extension point. Here is the `if`/`elif` "before" version for exporting a record:

```python
import json


def export(data, fmt):
    if fmt == "json":
        return json.dumps(data)
    elif fmt == "csv":
        return ",".join(str(value) for value in data.values())
    raise ValueError(f"Unknown format: {fmt!r}")


print(export({"name": "John Doe", "age": 42}, "csv"))
```

Output:

```text
John Doe,42
```

And the "after" version, where each format registers itself in a dictionary:

```python
import json

EXPORTERS = {}


def exporter(name):
    """Decorator that registers an export function under a name."""
    def decorator(func):
        EXPORTERS[name] = func
        return func
    return decorator


@exporter("json")
def to_json(data):
    return json.dumps(data)


@exporter("csv")
def to_csv(data):
    return ",".join(str(value) for value in data.values())


def export(data, fmt):
    try:
        func = EXPORTERS[fmt]
    except KeyError:
        raise ValueError(f"Unknown format: {fmt!r}") from None
    return func(data)


row = {"name": "John Doe", "age": 42}
print(export(row, "json"))
print(export(row, "csv"))


# Extension: a new format, export() is not touched
@exporter("kv")
def to_key_value(data):
    return "; ".join(f"{key}={value}" for key, value in data.items())


print(export(row, "kv"))
print(sorted(EXPORTERS))
```

Output:

```text
{"name": "John Doe", "age": 42}
John Doe,42
name=John Doe; age=42
['csv', 'json', 'kv']
```

`export()` is closed: it only looks things up. The registry is open: any module can add a format by decorating a function. This pattern is common in real frameworks, for example URL routing in Flask (`@app.route(...)`) or command registration in CLI libraries.

## Trade-offs

OCP is valuable, but it is not free.

- **You must guess the axis of change.** An abstraction protects you only against the kind of change it was designed for. `PersonStorage` makes adding *formats* easy, but adding a new *operation* such as `load()` now means editing every storage class. No design is closed against every possible change.
- **Abstractions add indirection.** A reader of `save_all()` cannot see which `save()` runs without finding where the storage object was created.
- **Premature abstraction is a real cost.** If there is only one format and no sign of a second one, an ABC with a single subclass is just ceremony. A common rule of thumb is to write the simple version first and extract the abstraction when the second or third variant actually arrives.
- **"Closed" is not "frozen".** Fixing a bug in `save_all()` is fine. OCP is about not having to edit stable code *to add features*.

## Common mistakes

- **Growing an `if`/`elif` or `isinstance` chain** every time a new type or flag appears. This is the most common OCP violation.
- **Forgetting `@abstractmethod`.** Without it the base class gives no protection, and a subclass that misspells the method name silently inherits a do-nothing method.
- **Special-casing a subclass inside the base class**, for example `if isinstance(self, PersonXML): ...` in `PersonStorage`. The base class should not know its subclasses.
- **Creating abstractions for imaginary future needs.** An interface with one implementation and no second one in sight makes code harder to read without making it easier to extend.
- **Leaking the concrete choice everywhere.** If every caller constructs `PersonXML()` itself, switching formats still means editing many files. Create the concrete object in one place and pass the abstraction around.

## Summary

- OCP: add new behaviour by adding new code, not by editing working code.
- "Closed" refers to stable client code and abstractions; "open" refers to the set of implementations.
- `if`/`elif` and `isinstance` chains over variants are the classic warning sign.
- `abc.ABC` with `@abstractmethod` defines an extension point and fails fast when an implementation is incomplete.
- `typing.Protocol` defines the same contract structurally, without inheritance.
- A dictionary of functions with a registering decorator is a lightweight, very Pythonic way to apply OCP.
- Every abstraction is closed against one kind of change only, so introduce it when a real second variant appears.

## Practice

### Exercise 1: Shapes without `if`

The function below must be edited for every new shape, and it silently ignores shapes it does not know. Refactor it with an abstract `Shape` class so that `total_area()` never changes, then add a `Triangle(base, height)` without touching `total_area()`.

```python
import math


def total_area(shapes):
    total = 0.0
    for shape in shapes:
        if shape["kind"] == "rectangle":
            total += shape["width"] * shape["height"]
        elif shape["kind"] == "circle":
            total += math.pi * shape["radius"] ** 2
    return total


shapes = [
    {"kind": "rectangle", "width": 2, "height": 3},
    {"kind": "circle", "radius": 1},
    {"kind": "triangle", "base": 4, "height": 5},
]
print(round(total_area(shapes), 2))
```

Output:

```text
9.14
```

The triangle (area 10) was silently skipped. The correct total is `19.14`.

### Exercise 2: Pluggable discounts with a `Protocol`

Define a `Discount` protocol with `apply(amount: float) -> float` and a function `checkout(amount, discount)` that returns the discounted amount rounded to 2 decimal places. Implement `NoDiscount`, `PercentOff(percent)` and `FixedOff(value)` (the price must never go below zero). Then, without changing `checkout()`, add `Combined(*discounts)` that applies several discounts one after another.

### Exercise 3: Self-registering plugins

Write a base class `Storage` that keeps a class-level dictionary `registry`. Every subclass must register itself automatically under a key given in the class statement, like `class JsonStorage(Storage, key="json")`. Add a function `create_storage(key)` that returns an instance of the right class and raises `ValueError` for an unknown key. Adding a new storage must not require editing `Storage` or `create_storage()`.

> **Hint:** `__init_subclass__(cls, **kwargs)` is a class method that Python calls automatically on the parent class every time a subclass is created. Keyword arguments from the `class` line are passed to it.

## Solutions

### Exercise 1

```python
import math
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self) -> float:
        """Return the area of the shape."""


class Rectangle(Shape):
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def area(self):
        return self.width * self.height


class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return math.pi * self.radius ** 2


def total_area(shapes):
    return sum(shape.area() for shape in shapes)


# The extension: a new class, total_area() is untouched
class Triangle(Shape):
    def __init__(self, base, height):
        self.base = base
        self.height = height

    def area(self):
        return self.base * self.height / 2


shapes = [Rectangle(2, 3), Circle(1), Triangle(4, 5)]
print(round(total_area(shapes), 2))
```

Output:

```text
19.14
```

An unknown shape can no longer be skipped by accident: every `Shape` must implement `area()`, or it cannot be instantiated.

### Exercise 2

```python
from typing import Protocol


class Discount(Protocol):
    def apply(self, amount: float) -> float: ...


def checkout(amount: float, discount: Discount) -> float:
    return round(discount.apply(amount), 2)


class NoDiscount:
    def apply(self, amount):
        return amount


class PercentOff:
    def __init__(self, percent):
        self.percent = percent

    def apply(self, amount):
        return amount * (1 - self.percent / 100)


class FixedOff:
    def __init__(self, value):
        self.value = value

    def apply(self, amount):
        return max(amount - self.value, 0.0)


# The extension: checkout() is not modified
class Combined:
    def __init__(self, *discounts):
        self.discounts = discounts

    def apply(self, amount):
        for discount in self.discounts:
            amount = discount.apply(amount)
        return amount


print(checkout(200, NoDiscount()))
print(checkout(200, PercentOff(15)))
print(checkout(30, FixedOff(50)))
print(checkout(200, Combined(PercentOff(10), FixedOff(20))))
```

Output:

```text
200
170.0
0.0
160.0
```

`Combined` is itself a `Discount`, so it plugs into `checkout()` like any other. Objects that combine other objects of the same interface are called the *Composite* pattern.

### Exercise 3

```python
class Storage:
    registry = {}

    def __init_subclass__(cls, *, key, **kwargs):
        super().__init_subclass__(**kwargs)
        Storage.registry[key] = cls

    def save(self, data):
        raise NotImplementedError


class JsonStorage(Storage, key="json"):
    def save(self, data):
        print(f"JSON <- {data}")


class CsvStorage(Storage, key="csv"):
    def save(self, data):
        print(f"CSV <- {data}")


def create_storage(key):
    try:
        cls = Storage.registry[key]
    except KeyError:
        raise ValueError(f"Unknown storage: {key!r}") from None
    return cls()


# The extension: just a new subclass
class MemoryStorage(Storage, key="memory"):
    def __init__(self):
        self.items = []

    def save(self, data):
        self.items.append(data)
        print(f"memory now holds {len(self.items)} item(s)")


print(sorted(Storage.registry))
create_storage("json").save({"id": 1})
create_storage("memory").save({"id": 2})
try:
    create_storage("xml")
except ValueError as error:
    print(error)
```

Output:

```text
['csv', 'json', 'memory']
JSON <- {'id': 1}
memory now holds 1 item(s)
Unknown storage: 'xml'
```

Each subclass registers itself the moment its `class` statement runs, so `create_storage()` stays closed while the set of storages stays open.

---

*Source: [pythontutorial.net — Python Open-Closed Principle](https://www.pythontutorial.net/python-oop/python-open-closed-principle/). Adapted and expanded for PyJourney.*
