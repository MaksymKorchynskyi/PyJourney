# Interface Segregation Principle

The Interface Segregation Principle (ISP) says that **clients should not be forced to depend on methods they do not use**. Instead of one large "fat" interface, define several small ones, each describing one role. It is the "I" in SOLID, and it keeps classes from having to fake abilities they do not have.

## What you'll learn

- What an "interface" means in Python, which has no `interface` keyword
- What ISP says and why "small" does not mean "one method"
- How a fat interface forces classes to implement methods they cannot support
- How to split it into role interfaces with `abc.ABC`, with "before" and "after" code
- How to express small interfaces with `typing.Protocol`, and how the standard library does it
- The trade-offs between too-fat and too-fragmented interfaces

## Interfaces in Python

An **interface** is the set of methods an object promises to provide, without saying how they work. When you press the power button on a TV remote, you rely on the interface "this button turns the TV on", not on the electronics inside.

Many languages have an `interface` keyword. Python does not. It relies on **duck typing**: "if it walks like a duck and quacks like a duck, treat it as a duck". A function simply calls the methods it needs, and any object that has them works, whatever its class.

When you want to make an interface explicit, Python gives you two tools:

- **Abstract base classes** (`abc.ABC` with `@abstractmethod`): classes inherit from the interface, and Python refuses to instantiate a class that has not implemented every abstract method.
- **Protocols** (`typing.Protocol`, Python 3.8+): the interface is described structurally, any class with matching methods satisfies it without inheriting, and a static type checker verifies it.

ISP applies to both.

## The principle

Robert C. Martin formulated ISP while consulting for Xerox in the 1990s. Their printer software had one big `Job` class used by almost every task, so a stapling job knew about all the methods of a print job, and even a small change meant a long rebuild and redeploy of everything. His advice: *"Make fine-grained interfaces that are client-specific. Clients should not be forced to implement interfaces they do not use."*

Two points are easy to miss:

- **"Small" means cohesive, not "one method".** A `Connection` interface with both `connect()` and `disconnect()` is fine: the two methods belong together, and an interface with only one of them would be incomplete. The same goes for `__enter__()` and `__exit__()` in a context manager.
- **Interfaces are designed from the client's point of view.** Ask "what does *this caller* need?", not "what can this object do?". Such client-shaped interfaces are often called **role interfaces**.

## Before: a fat interface

Define a `Vehicle` interface with two abstract methods:

```python
from abc import ABC, abstractmethod


class Vehicle(ABC):
    @abstractmethod
    def go(self):
        """Move on the ground."""

    @abstractmethod
    def fly(self):
        """Move through the air."""


class Aircraft(Vehicle):
    def go(self):
        print("Taxiing")

    def fly(self):
        print("Flying")


class Car(Vehicle):
    def go(self):
        print("Going")

    def fly(self):
        raise NotImplementedError("A car cannot fly")


car = Car()
car.go()
try:
    car.fly()
except NotImplementedError as error:
    print(f"Error: {error}")
```

Output:

```text
Going
Error: A car cannot fly
```

`Car` is forced to implement `fly()` only because the interface demands it, and the best it can do is fail. Three problems follow:

1. **The interface lies.** Anything typed as `Vehicle` claims it can fly, so callers cannot trust the type.
2. **Errors move to runtime.** A mistake that the type system could have caught becomes an exception in production. (This is also a Liskov Substitution violation: `Car` is not a full substitute for `Vehicle`.)
3. **Needless coupling.** Code that only drives cars still depends on `Vehicle`, so a change to the flying part of the interface affects it too.

## After: role interfaces

Split the fat interface into smaller ones that match real roles. Here every flying thing can also move on the ground, so `Flyable` extends `Movable`:

```python
from abc import ABC, abstractmethod


class Movable(ABC):
    @abstractmethod
    def go(self):
        """Move on the ground."""


class Flyable(Movable):
    @abstractmethod
    def fly(self):
        """Move through the air."""


class Aircraft(Flyable):
    def go(self):
        print("Taxiing")

    def fly(self):
        print("Flying")


class Car(Movable):
    def go(self):
        print("Going")


def drive_all(things: list[Movable]):
    for thing in things:
        thing.go()


def take_off(things: list[Flyable]):
    for thing in things:
        thing.fly()


drive_all([Car(), Aircraft()])
take_off([Aircraft()])
print(hasattr(Car(), "fly"))
```

Output:

```text
Going
Taxiing
Flying
False
```

`Car` implements only what it can actually do. `drive_all()` depends only on `Movable`, and `take_off()` only on `Flyable`. A car cannot be passed to `take_off()` by mistake: a type checker reports it before the program runs.

```text
before:                         after:

     Vehicle                        Movable
   + go()                         + go()
   + fly()                           ^       ^
    ^       ^                        |       |
    |       |                       Car   Flyable
 Aircraft  Car (fly raises!)              + fly()
                                             ^
                                             |
                                          Aircraft
```

### Independent roles and multiple inheritance

Making `Flyable` a child of `Movable` is a design decision. It is right only if *every* flying thing can also go on the ground. A drone or a bird might not. When roles are independent, keep the interfaces independent and let a class combine as many as it needs:

```python
from abc import ABC, abstractmethod


class Drivable(ABC):
    @abstractmethod
    def go(self):
        """Move on the ground."""


class Flyable(ABC):
    @abstractmethod
    def fly(self):
        """Move through the air."""


class Car(Drivable):
    def go(self):
        print("Car: going")


class Drone(Flyable):
    def fly(self):
        print("Drone: flying")


class FlyingCar(Drivable, Flyable):
    def go(self):
        print("FlyingCar: going")

    def fly(self):
        print("FlyingCar: flying")


for thing in (Car(), Drone(), FlyingCar()):
    roles = [cls.__name__ for cls in (Drivable, Flyable) if isinstance(thing, cls)]
    print(type(thing).__name__, roles)
```

Output:

```text
Car ['Drivable']
Drone ['Flyable']
FlyingCar ['Drivable', 'Flyable']
```

## Small interfaces with `typing.Protocol`

With protocols, segregated interfaces cost almost nothing: a class does not have to list them, it just has to have the methods. Each function declares exactly the role it needs:

```python
from typing import Protocol


class Printer(Protocol):
    def print_document(self, text: str) -> None: ...


class Scanner(Protocol):
    def scan(self) -> str: ...


class SimplePrinter:
    def print_document(self, text):
        print(f"[printer] {text}")


class MultiFunctionDevice:
    def print_document(self, text):
        print(f"[mfd] {text}")

    def scan(self):
        return "scanned page"


def print_report(printer: Printer, lines: list[str]) -> None:
    for line in lines:
        printer.print_document(line)


def archive(scanner: Scanner) -> None:
    print(f"archived: {scanner.scan()}")


print_report(SimplePrinter(), ["Q3 report"])
print_report(MultiFunctionDevice(), ["Q4 report"])
archive(MultiFunctionDevice())
```

Output:

```text
[printer] Q3 report
[mfd] Q4 report
archived: scanned page
```

`SimplePrinter` never had to pretend it can scan. If there were one big `OfficeDevice` protocol with `print_document()`, `scan()` and `fax()`, `print_report()` could not accept a simple printer at all.

### Checking protocols at runtime

By default protocols exist only for type checkers. Decorating one with `@runtime_checkable` lets you use it with `isinstance()`, but that check only looks for an attribute with the right **name**. It does not inspect signatures or even whether the attribute is callable:

```python
from typing import Protocol, runtime_checkable


@runtime_checkable
class Flyable(Protocol):
    def fly(self) -> None: ...


class Duck:
    def fly(self):
        print("Duck flaps its wings")


class Car:
    def go(self):
        print("Going")


class Liar:
    fly = "not a method at all"


for obj in (Duck(), Car(), Liar()):
    print(type(obj).__name__, isinstance(obj, Flyable))
```

Output:

```text
Duck True
Car False
Liar True
```

### The standard library already does this

`collections.abc` is a good example of segregated interfaces. Instead of one big "container" interface, there are tiny ones: `Sized` (`__len__`), `Iterable` (`__iter__`), `Container` (`__contains__`). `Collection` is simply all three combined. A class that only defines `__len__` is `Sized` and nothing more:

```python
from collections.abc import Collection, Iterable, Sized


class Playlist:
    def __init__(self, *songs):
        self.songs = list(songs)

    def __len__(self):
        return len(self.songs)


playlist = Playlist("Intro", "Outro")
print(isinstance(playlist, Sized))
print(isinstance(playlist, Iterable))
print(isinstance(playlist, Collection))
print(isinstance([1, 2], Collection))
print(len(playlist))
```

Output:

```text
True
False
False
True
2
```

Built-in functions follow the same idea: `len()` needs only `Sized`, and a `for` loop needs only `Iterable`. Neither forces your class to implement anything it does not need.

## Trade-offs

- **Too fat** leads to fake implementations (`pass`, `raise NotImplementedError`), lying types and needless coupling.
- **Too fragmented** is also a problem. Twenty single-method interfaces that are always used together just make the code harder to navigate. Keep together methods that always go together.
- **Duck typing softens the problem.** Without type hints, a Python function never "depends" on methods it does not call. ISP matters most when you write ABCs that others must implement and when you use a type checker.
- **Hierarchy vs. combination.** Deriving `Flyable` from `Movable` is convenient but asserts that every flyer can drive. Independent interfaces combined via multiple inheritance (or several protocols) are more flexible but more verbose.

## Common mistakes

- **Implementing unused methods as no-ops or exceptions** just to satisfy a base class. If you see `raise NotImplementedError("X cannot do Y")` in a concrete class, the interface is probably too fat.
- **Reading ISP as "one method per interface".** Cohesive methods such as `connect()`/`disconnect()` or `__enter__()`/`__exit__()` belong in the same interface.
- **Designing interfaces from the implementation's side.** "Everything my `Database` class can do" is not a good interface; "what the report generator needs to read" is.
- **Trusting `@runtime_checkable` too much.** `isinstance()` with a protocol checks names only, not signatures or behaviour.
- **Forcing a hierarchy on independent roles.** Make one interface extend another only when every implementation of the child really supports the parent's methods.

## Summary

- An interface is the set of methods an object promises. In Python it is expressed with duck typing, ABCs or protocols.
- ISP: no client should be forced to depend on, or implement, methods it does not use.
- Small means cohesive: group methods that belong together, separate ones that do not.
- Design interfaces from the client's point of view (role interfaces).
- Methods that only `raise NotImplementedError` in a concrete class are the main warning sign.
- A class can implement several small interfaces through multiple inheritance or by matching several protocols.
- `collections.abc` (`Sized`, `Iterable`, `Container`, `Collection`) shows ISP in the standard library.

## Practice

### Exercise 1: Robots do not eat

Refactor this fat interface so that `Robot` does not have to implement `eat()`. Write `run_shift(workers)` that calls `work()` on everyone, and `lunch_break(eaters)` that calls `eat()` only on those that can eat. Use `abc.ABC`.

```python
from abc import ABC, abstractmethod


class Worker(ABC):
    @abstractmethod
    def work(self): ...

    @abstractmethod
    def eat(self): ...


class Human(Worker):
    def work(self):
        print("Human works")

    def eat(self):
        print("Human eats")


class Robot(Worker):
    def work(self):
        print("Robot works")

    def eat(self):
        raise NotImplementedError("Robots do not eat")
```

### Exercise 2: A function that needs only `read()`

Write a `Readable` protocol with a single method `read() -> str`, and a function `word_count(source: Readable) -> int`. Show that it works with `io.StringIO` from the standard library and with your own class `Note`, neither of which inherits from `Readable`.

### Exercise 3: Readers and writers

Split this repository interface into `Reader` (`get`, `all`) and `Writer` (`add`) ABCs. Implement `InMemoryRepository` that supports both, and `ReadOnlySnapshot` that supports only reading (it receives its data in `__init__`). Write `report(reader)` that prints all items sorted, and show that it accepts both classes. Finally, show with `isinstance()` that a snapshot is not a `Writer`.

```python
from abc import ABC, abstractmethod


class Repository(ABC):
    @abstractmethod
    def get(self, key): ...

    @abstractmethod
    def all(self): ...

    @abstractmethod
    def add(self, key, value): ...
```

## Solutions

### Exercise 1

```python
from abc import ABC, abstractmethod


class Workable(ABC):
    @abstractmethod
    def work(self): ...


class Eatable(ABC):
    @abstractmethod
    def eat(self): ...


class Human(Workable, Eatable):
    def work(self):
        print("Human works")

    def eat(self):
        print("Human eats")


class Robot(Workable):
    def work(self):
        print("Robot works")


def run_shift(workers: list[Workable]):
    for worker in workers:
        worker.work()


def lunch_break(eaters: list[Eatable]):
    for eater in eaters:
        eater.eat()


staff = [Human(), Robot()]
run_shift(staff)
lunch_break([member for member in staff if isinstance(member, Eatable)])
```

Output:

```text
Human works
Robot works
Human eats
```

The interfaces are independent (`Eatable` does not extend `Workable`), because not everything that eats has to work.

### Exercise 2

```python
import io
from typing import Protocol


class Readable(Protocol):
    def read(self) -> str: ...


def word_count(source: Readable) -> int:
    return len(source.read().split())


class Note:
    def __init__(self, text):
        self.text = text

    def read(self):
        return self.text


print(word_count(io.StringIO("Small interfaces are easy to satisfy")))
print(word_count(Note("Hello PyJourney")))
```

Output:

```text
6
2
```

Because `word_count()` asks only for `read()`, it works with files, `StringIO`, network streams and your own classes. If it had demanded a full "file" interface with `seek()`, `write()` and `close()`, `Note` would have had to fake all of them.

### Exercise 3

```python
from abc import ABC, abstractmethod


class Reader(ABC):
    @abstractmethod
    def get(self, key): ...

    @abstractmethod
    def all(self): ...


class Writer(ABC):
    @abstractmethod
    def add(self, key, value): ...


class InMemoryRepository(Reader, Writer):
    def __init__(self):
        self._items = {}

    def get(self, key):
        return self._items.get(key)

    def all(self):
        return list(self._items.values())

    def add(self, key, value):
        self._items[key] = value


class ReadOnlySnapshot(Reader):
    def __init__(self, items):
        self._items = dict(items)

    def get(self, key):
        return self._items.get(key)

    def all(self):
        return list(self._items.values())


def report(reader: Reader):
    for item in sorted(reader.all()):
        print(f"- {item}")


repo = InMemoryRepository()
repo.add(1, "pear")
repo.add(2, "apple")
report(repo)

snapshot = ReadOnlySnapshot({1: "melon", 2: "kiwi"})
report(snapshot)
print(isinstance(snapshot, Reader), isinstance(snapshot, Writer))
```

Output:

```text
- apple
- pear
- kiwi
- melon
True False
```

`report()` depends only on `Reader`, so it works with both classes, and `ReadOnlySnapshot` never has to pretend it can `add()`.

---

*Source: [pythontutorial.net — Python Interface Segregation Principle](https://www.pythontutorial.net/python-oop/python-interface-segregation-principle/). Adapted and expanded for PyJourney.*
