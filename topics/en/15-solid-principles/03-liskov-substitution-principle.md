# Liskov Substitution Principle

The Liskov Substitution Principle (LSP) says that **an object of a subclass must be usable anywhere an object of its parent class is expected**, without the calling code noticing the difference or breaking. It is the "L" in SOLID. It is what makes polymorphism safe: if subclasses keep their parent's promises, code written against the parent works with every subclass, including ones written years later.

## What you'll learn

- What "substitutable" really means: same behaviour, not just same method names
- The contract a subclass must keep: signatures, preconditions, postconditions, invariants, exceptions
- How to spot an LSP violation (hint: `isinstance` checks in client code)
- How to refactor a violating hierarchy, with "before" and "after" code
- The classic Rectangle/Square trap and how to avoid it
- How type checkers such as mypy catch some violations for you

## The principle

Barbara Liskov introduced the idea in 1987, and with Jeannette Wing gave it a formal definition in 1994. In everyday words:

> If code works correctly with objects of type `Base`, it must keep working correctly when you give it an object of any subclass of `Base`, without knowing which subclass it got.

Two consequences follow:

1. "Is-a" in code is about **behaviour**, not about real-world categories. A penguin *is a* bird in biology, but if your `Bird` class promises `fly()`, a `Penguin` subclass is not a valid `Bird` in your program.
2. If client code has to ask "which subclass is this?" (with `isinstance()` or `type()`) before using an object, substitution has already failed.

## The contract a subclass must keep

A base class makes promises to its callers. A subclass may *extend* those promises, but never *break* them:

| Rule | In plain words | Typical violation |
|---|---|---|
| Compatible signature | Accept the same arguments, by position and by name | Renaming, removing or adding a required parameter |
| Preconditions cannot be strengthened | Accept at least everything the parent accepts | Parent accepts any amount; subclass rejects amounts over 1000 |
| Postconditions cannot be weakened | Return at least what the parent promises | Parent returns a list; subclass sometimes returns `None` |
| Invariants must be preserved | Keep the facts the parent guarantees | Changing width also changes height |
| No surprising exceptions | Do not raise errors the caller cannot expect | Inherited method raises `NotImplementedError` |

## Before: notifications that cannot be swapped

Here a `Notification` base class says that `notify()` takes a message and an email. `SMS` overrides it, but it really needs a phone number:

```python
from abc import ABC, abstractmethod


class Notification(ABC):
    @abstractmethod
    def notify(self, message, email):
        pass


class Email(Notification):
    def notify(self, message, email):
        print(f"Send {message} to {email}")


class SMS(Notification):
    def notify(self, message, phone):
        print(f"Send {message} to {phone}")


if __name__ == "__main__":
    notification = SMS()
    notification.notify("Hello", "john@test.com")
```

Output:

```text
Send Hello to john@test.com
```

Nothing stopped us from sending an SMS to an email address. The contract of `Notification.notify()` says "give me an email", and `SMS` cannot honour that contract; it only *looks* compatible because the parameter happens to be the second positional one. As soon as a caller uses the parameter name from the base class, `SMS` breaks:

```python
from abc import ABC, abstractmethod


class Notification(ABC):
    @abstractmethod
    def notify(self, message, email):
        pass


class Email(Notification):
    def notify(self, message, email):
        print(f"Send {message} to {email}")


class SMS(Notification):
    def notify(self, message, phone):
        print(f"Send {message} to {phone}")


for notification in (Email(), SMS()):
    try:
        notification.notify(message="Hello", email="john@test.com")
    except TypeError as error:
        print(f"{type(notification).__name__} failed: {error}")
```

Output:

```text
Send Hello to john@test.com
SMS failed: SMS.notify() got an unexpected keyword argument 'email'
```

Client code that must work with both now has to check the concrete type:

```python
from abc import ABC, abstractmethod


class Notification(ABC):
    @abstractmethod
    def notify(self, message, email):
        pass


class Email(Notification):
    def notify(self, message, email):
        print(f"Send {message} to {email}")


class SMS(Notification):
    def notify(self, message, phone):
        print(f"Send {message} to {phone}")


class Contact:
    def __init__(self, name, email, phone):
        self.name = name
        self.email = email
        self.phone = phone


class NotificationManager:
    def __init__(self, notification, contact):
        self.contact = contact
        self.notification = notification

    def send(self, message):
        if isinstance(self.notification, Email):
            self.notification.notify(message, self.contact.email)
        elif isinstance(self.notification, SMS):
            self.notification.notify(message, self.contact.phone)
        else:
            raise TypeError("The notification is not supported")


if __name__ == "__main__":
    contact = Contact("John Doe", "john@test.com", "(408)-888-9999")
    manager = NotificationManager(SMS(), contact)
    manager.send("Hello John")
```

Output:

```text
Send Hello John to (408)-888-9999
```

This `isinstance` chain is the tell-tale sign of an LSP violation. It also breaks the Open–Closed Principle: adding a `Push` notification means editing `send()`.

## After: a contract every subclass can keep

The problem is that the base class's contract contains a detail (the email) that only one subclass needs. Move that detail out of the shared method and into each subclass's constructor:

```python
from abc import ABC, abstractmethod


class Notification(ABC):
    @abstractmethod
    def notify(self, message):
        """Deliver the message to this notification's recipient."""


class Email(Notification):
    def __init__(self, email):
        self.email = email

    def notify(self, message):
        print(f'Send "{message}" to {self.email}')


class SMS(Notification):
    def __init__(self, phone):
        self.phone = phone

    def notify(self, message):
        print(f'Send "{message}" to {self.phone}')


class Contact:
    def __init__(self, name, email, phone):
        self.name = name
        self.email = email
        self.phone = phone


class NotificationManager:
    def __init__(self, notification):
        self.notification = notification

    def send(self, message):
        self.notification.notify(message)


if __name__ == "__main__":
    contact = Contact("John Doe", "john@test.com", "(408)-888-9999")

    sms_notification = SMS(contact.phone)
    email_notification = Email(contact.email)

    manager = NotificationManager(sms_notification)
    manager.send("Hello John")

    manager.notification = email_notification
    manager.send("Hi John")
```

Output:

```text
Send "Hello John" to (408)-888-9999
Send "Hi John" to john@test.com
```

Now every `Notification` honours the same contract: "call `notify(message)` and the message is delivered". `NotificationManager` does not know or care which subclass it holds, and a new `Push` class would work without any change to it.

## The classic trap: Rectangle and Square

Mathematically, every square is a rectangle, so inheriting `Square` from `Rectangle` looks natural:

```python
class Rectangle:
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def set_width(self, width):
        self.width = width

    def set_height(self, height):
        self.height = height

    def area(self):
        return self.width * self.height


class Square(Rectangle):
    def __init__(self, side):
        super().__init__(side, side)

    def set_width(self, width):
        self.width = self.height = width

    def set_height(self, height):
        self.width = self.height = height


def stretch(rect):
    """Make the rectangle 5 wide and 4 high, then return its area."""
    rect.set_width(5)
    rect.set_height(4)
    return rect.area()


print(stretch(Rectangle(2, 3)))
print(stretch(Square(2)))
```

Output:

```text
20
16
```

`Rectangle` implicitly promises that width and height change **independently**. `Square` has to break that promise to stay square, so `stretch()` silently computes the wrong answer. No exception, no warning: the worst kind of bug.

The fix is to stop pretending they share mutable behaviour. Both are shapes with an area, so make *that* the shared contract, and make the objects immutable:

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass


class Shape(ABC):
    @abstractmethod
    def area(self) -> float:
        """Return the area."""


@dataclass(frozen=True)
class Rectangle(Shape):
    width: float
    height: float

    def area(self):
        return self.width * self.height


@dataclass(frozen=True)
class Square(Shape):
    side: float

    def area(self):
        return self.side ** 2


def total_area(shapes: list[Shape]) -> float:
    return sum(shape.area() for shape in shapes)


print(total_area([Rectangle(5, 4), Square(2)]))
```

Output:

```text
24
```

Any `Shape` can be substituted in `total_area()`, because the only promise is "I can report my area", and both classes keep it.

> **Tip:** Python's own `collections.abc` is designed with LSP in mind. The read-only `Sequence` is the base, and `MutableSequence` *extends* it. So `tuple` is a `Sequence` but not a `MutableSequence`, and nobody can call `append()` on something that only promised to be readable.

```python
from collections.abc import MutableSequence, Sequence

print(issubclass(tuple, Sequence))
print(issubclass(tuple, MutableSequence))
print(issubclass(list, Sequence))
print(issubclass(list, MutableSequence))
```

Output:

```text
True
False
True
True
```

## Letting a type checker help

Python does not enforce LSP at runtime. Static type checkers can catch the signature part of it. Here `Cat.feed()` accepts *less* than `Animal.feed()` (only fish instead of any food), which strengthens a precondition:

```python
class Food: ...


class Fish(Food): ...


class Animal:
    def feed(self, food: Food) -> None:
        print("Eating")


class Cat(Animal):
    def feed(self, food: Fish) -> None:  # accepts LESS than the parent
        print("Eating fish")
```

Running mypy on this file (saved as `lsp_check.py`):

```bash
mypy lsp_check.py
```

Output:

```text
lsp_check.py:13: error: Argument 1 of "feed" is incompatible with supertype "Animal"; supertype defines the argument type as "Food"  [override]
lsp_check.py:13: note: This violates the Liskov substitution principle
lsp_check.py:13: note: See https://mypy.readthedocs.io/en/stable/common_issues.html#incompatible-overrides
Found 1 error in 1 file (checked 1 source file)
```

The rule for types is: parameters of an override may be **wider** (accept more), and return types may be **narrower** (promise more), never the other way round. Type checkers cannot see behavioural violations such as the `Square` setters, though. Those need careful design and tests.

## Trade-offs

- **LSP pushes you away from inheritance.** Often the honest fix is "these two classes should not be parent and child". Composition, or a smaller shared interface, is frequently better than a deep hierarchy.
- **Real-world categories mislead.** "A square is a rectangle" and "a penguin is a bird" are true in the world but can be false in your code. Model behaviour, not taxonomy.
- **Contracts must be written down.** You cannot keep a promise nobody stated. Docstrings and type hints on base-class methods are what make LSP checkable.
- **Some violations are accepted on purpose.** The standard library has a few documented ones (for example, some file-like objects raise `io.UnsupportedOperation` for `seek()`). That works only because the base contract explicitly allows it (`seekable()` tells you in advance). If you need an "optional" operation, make it explicit in the contract.

## Common mistakes

- **Overriding a method only to raise `NotImplementedError`** (a `Penguin.fly()` that refuses to fly). If a subclass cannot do what the parent promises, it should not inherit that promise.
- **Changing the signature in an override**: renaming parameters, adding required ones, or removing ones the parent has. Callers that use keyword arguments break.
- **Returning a different kind of value**, for example `None` instead of an empty list, or a `str` where the parent returns an `int`.
- **Adding extra validation in a subclass** that rejects inputs the parent accepts.
- **Fixing violations with `isinstance()` in client code.** That hides the design problem and forces every caller to know every subclass.
- **Inheriting just to reuse code.** If you only want the implementation and not the "is-a" contract, use composition.

## Summary

- LSP: a subclass must be usable anywhere its parent is expected, without the caller noticing.
- "Is-a" in code means "keeps the same behavioural contract", not "belongs to the same real-world category".
- A subclass may accept more and promise more, but never accept less or promise less.
- `isinstance` checks in client code, `NotImplementedError` in overrides, and changed signatures are the warning signs.
- Move subclass-specific details (like an email or a phone) out of shared methods, for example into `__init__`.
- Mutable `Square(Rectangle)` is the classic violation; immutable objects and a smaller shared interface avoid it.
- mypy and pyright catch signature-level violations; behavioural ones need design and tests.

## Practice

### Exercise 1: Birds that cannot fly

Explain why this hierarchy violates LSP. Then redesign it so that `release_all()` can only receive birds that really fly, while `Penguin` is still a `Bird`. Use `abc.ABC`.

```python
class Bird:
    def fly(self):
        return f"{type(self).__name__} flies"


class Sparrow(Bird):
    pass


class Penguin(Bird):
    def fly(self):
        raise NotImplementedError("Penguins can't fly")


def release_all(birds):
    for bird in birds:
        print(bird.fly())


release_all([Sparrow(), Penguin()])
```

### Exercise 2: A "faster" repository

Predict what this code prints. Which rule of the contract does `FastUserRepository` break? Fix the subclass so that `count_in()` works with both classes without any change.

```python
class UserRepository:
    def __init__(self, users):
        self.users = users  # {name: city}

    def find_by_city(self, city):
        """Return a list of names (empty if nobody lives there)."""
        return [name for name, c in self.users.items() if c == city]


class FastUserRepository(UserRepository):
    def find_by_city(self, city):
        result = super().find_by_city(city)
        return result or None  # "optimisation": None instead of []


def count_in(repo, city):
    return len(repo.find_by_city(city))


users = {"Olena": "Kyiv", "Taras": "Lviv"}
print(count_in(UserRepository(users), "Odesa"))
print(count_in(FastUserRepository(users), "Odesa"))
```

### Exercise 3: A contract test

A `KeyValueStore` promises three things: after `set(key, value)`, `get(key)` returns exactly `value`; `get()` of a missing key returns `None`; and a second `set()` with the same key overwrites the old value. Write a function `check_store(store)` that returns `True` only if an object keeps all three promises. Implement `DictStore`, a subclass `LoggingStore` that prints every `set()` call, and a subclass `UpperStore` that stores values in upper case. Run `check_store()` on all three.

## Solutions

### Exercise 1

`Bird` promises that every bird can `fly()`. `Penguin` breaks that promise by raising an exception, so `release_all()` crashes as soon as it meets a penguin. The fix is to promise only what all birds can do, and put flying in a separate, more specific class:

```python
from abc import ABC, abstractmethod


class Bird(ABC):
    @abstractmethod
    def move(self):
        """Every bird can move somehow."""


class FlyingBird(Bird):
    def move(self):
        return self.fly()

    def fly(self):
        return f"{type(self).__name__} flies"


class Sparrow(FlyingBird):
    pass


class Penguin(Bird):
    def move(self):
        return "Penguin swims"


def release_all(birds: list[FlyingBird]):
    for bird in birds:
        print(bird.fly())


def move_all(birds: list[Bird]):
    for bird in birds:
        print(bird.move())


release_all([Sparrow()])
move_all([Sparrow(), Penguin()])
```

Output:

```text
Sparrow flies
Sparrow flies
Penguin swims
```

Every `FlyingBird` can be passed to `release_all()`, and every `Bird` can be passed to `move_all()`. No subclass refuses an inherited operation.

### Exercise 2

The first call prints `0`, and the second one crashes:

```text
0
Traceback (most recent call last):
  ...
TypeError: object of type 'NoneType' has no len()
```

The base class promises "a list, possibly empty". The subclass **weakens that postcondition** by sometimes returning `None`. The fix is to keep the promise:

```python
class UserRepository:
    def __init__(self, users):
        self.users = users  # {name: city}

    def find_by_city(self, city):
        """Return a list of names (empty if nobody lives there)."""
        return [name for name, c in self.users.items() if c == city]


class FastUserRepository(UserRepository):
    def find_by_city(self, city):
        return super().find_by_city(city)  # always a list, as promised


def count_in(repo, city):
    return len(repo.find_by_city(city))


users = {"Olena": "Kyiv", "Taras": "Lviv"}
print(count_in(UserRepository(users), "Odesa"))
print(count_in(FastUserRepository(users), "Odesa"))
print(count_in(FastUserRepository(users), "Kyiv"))
```

Output:

```text
0
0
1
```

### Exercise 3

```python
class DictStore:
    def __init__(self):
        self._data = {}

    def set(self, key, value):
        self._data[key] = value

    def get(self, key):
        return self._data.get(key)


class LoggingStore(DictStore):
    def set(self, key, value):
        print(f"  log: set {key!r}")
        super().set(key, value)


class UpperStore(DictStore):
    def set(self, key, value):
        super().set(key, value.upper())


def check_store(store):
    store.set("lang", "python")
    if store.get("lang") != "python":
        return False
    if store.get("missing") is not None:
        return False
    store.set("lang", "rust")
    return store.get("lang") == "rust"


for cls in (DictStore, LoggingStore, UpperStore):
    print(f"{cls.__name__}:")
    print(f"  substitutable: {check_store(cls())}")
```

Output:

```text
DictStore:
  substitutable: True
LoggingStore:
  log: set 'lang'
  log: set 'lang'
  substitutable: True
UpperStore:
  substitutable: False
```

`LoggingStore` adds behaviour (logging) but keeps every promise, so it is a valid substitute. `UpperStore` changes the stored value, so code that relies on `get()` returning what was `set()` would break. Running the same contract test against every implementation is a practical way to enforce LSP in a real project.

---

*Source: [pythontutorial.net — Python Liskov Substitution Principle](https://www.pythontutorial.net/python-oop/python-liskov-substitution-principle/). Adapted and expanded for PyJourney.*
