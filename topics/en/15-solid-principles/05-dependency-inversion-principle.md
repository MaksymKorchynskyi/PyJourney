# Dependency Inversion Principle

The Dependency Inversion Principle (DIP) says that **high-level code should not depend on low-level details; both should depend on abstractions**. It is the "D" in SOLID. In practice it means that your business logic talks to an interface such as "a currency converter" instead of a specific vendor's API, so you can swap the vendor, or replace it with a fake in tests, without touching the logic.

## What you'll learn

- The two rules of DIP and what "high-level" and "low-level" mean
- What exactly gets "inverted"
- How to refactor a class that creates its own dependencies, with "before" and "after" code
- How dependency injection (passing dependencies in) puts DIP into practice
- How to express the abstraction with `abc.ABC`, `typing.Protocol` or a plain callable
- How DIP makes code testable, and when an abstraction is not worth it

## The principle

Robert C. Martin states DIP as two rules:

1. **High-level modules should not depend on low-level modules. Both should depend on abstractions.**
2. **Abstractions should not depend on details. Details should depend on abstractions.**

A **high-level module** contains the policy: what your application does and why ("convert the price for the checkout page"). A **low-level module** contains the mechanics: how something is done ("send an HTTP request to the FX provider and parse its JSON"). Policy is what makes your program valuable, and it should not have to change when a mechanical detail changes.

### What gets inverted

Without DIP, source-code dependencies follow the flow of control: the high-level code calls the low-level code, so it imports it and depends on it.

```text
before:   App  ──────────────> FXConverter ──────> FX provider API
          (high level)          (low level)

after:    App  ──────────────> CurrencyConverter   (abstraction, owned by the App side)
                                   ^           ^
                                   |           |
                             FXConverter   AlphaConverter   (details)
```

After the change, control still flows from `App` to `FXConverter` at runtime, but the **source-code dependency** of `FXConverter` now points *up* towards the abstraction. That reversal of the arrow is the "inversion". The abstraction is shaped by what the high-level code needs, and low-level classes adapt to it, not the other way round.

## Before: a high-level class that builds its own dependency

```python
class FXConverter:
    def convert(self, from_currency, to_currency, amount):
        print(f"{amount} {from_currency} = {amount * 1.2} {to_currency}")
        return amount * 1.2


class App:
    def start(self):
        converter = FXConverter()
        converter.convert("EUR", "USD", 100)


if __name__ == "__main__":
    app = App()
    app.start()
```

Output:

```text
100 EUR = 120.0 USD
```

Imagine `FXConverter` calls a third-party FX service (the rate `1.2` is hard-coded only to keep the example offline). `App` is the high-level module, yet it is welded to this one provider:

- If the provider changes its API, `App` may break.
- Switching to another provider means editing `App`.
- You cannot test `App` without calling the real service: slow, flaky, maybe costly.
- `App` cannot be reused in a context where the FX service is unavailable.

The root cause is the line `converter = FXConverter()`. A class that *creates* its collaborators is tied to their concrete types.

## After: depend on an abstraction and inject it

First, define the abstraction: what does `App` need? "Something that converts an amount between currencies."

```python
from abc import ABC, abstractmethod


class CurrencyConverter(ABC):
    @abstractmethod
    def convert(self, from_currency: str, to_currency: str, amount: float) -> float:
        """Return the amount converted to to_currency."""
```

Second, make each provider implement it. Then let `App` **receive** a converter instead of creating one. Passing dependencies in from outside is called **dependency injection**, and passing them through `__init__` is *constructor injection*:

```python
from abc import ABC, abstractmethod


class CurrencyConverter(ABC):
    @abstractmethod
    def convert(self, from_currency: str, to_currency: str, amount: float) -> float:
        """Return the amount converted to to_currency."""


class FXConverter(CurrencyConverter):
    def convert(self, from_currency, to_currency, amount):
        print("Converting currency using FX API")
        rate = 1.2  # in real code: ask the FX API
        return round(amount * rate, 2)


class AlphaConverter(CurrencyConverter):
    def convert(self, from_currency, to_currency, amount):
        print("Converting currency using Alpha API")
        rate = 1.15  # in real code: ask the Alpha API
        return round(amount * rate, 2)


class App:
    def __init__(self, converter: CurrencyConverter):
        self.converter = converter

    def start(self):
        result = self.converter.convert("EUR", "USD", 100)
        print(f"100 EUR = {result} USD")
        return result


if __name__ == "__main__":
    App(FXConverter()).start()
    App(AlphaConverter()).start()
```

Output:

```text
Converting currency using FX API
100 EUR = 120.0 USD
Converting currency using Alpha API
100 EUR = 115.0 USD
```

`App` no longer mentions any provider. It depends only on `CurrencyConverter`. Supporting a third provider means writing one new class; `App` does not change (which is the Open–Closed Principle at work).

> **Note:** `round(..., 2)` is there for a reason: `100 * 1.15` is `114.99999999999999` in binary floating point. Real money code should use `decimal.Decimal`.

### The payoff: testing with a fake

Because `App` accepts any `CurrencyConverter`, a test can hand it a fake that is fast, deterministic and records how it was called. Continuing the previous example:

```python
class FixedRateConverter(CurrencyConverter):
    def __init__(self, rate):
        self.rate = rate
        self.calls = []

    def convert(self, from_currency, to_currency, amount):
        self.calls.append((from_currency, to_currency, amount))
        return amount * self.rate


fake = FixedRateConverter(2)
result = App(fake).start()
assert result == 200
print(fake.calls)
```

Output:

```text
100 EUR = 200 USD
[('EUR', 'USD', 100)]
```

No network, no API key, no randomness. This is the most immediate, practical benefit of DIP.

## The abstraction as a `Protocol`

The abstraction does not have to be a base class. With `typing.Protocol`, the high-level module declares what it needs, and the low-level classes do not even have to import it. That makes the "details depend on abstractions" rule very light:

```python
from typing import Protocol


class CurrencyConverter(Protocol):
    def convert(self, from_currency: str, to_currency: str, amount: float) -> float: ...


class App:
    def __init__(self, converter: CurrencyConverter):
        self.converter = converter

    def start(self):
        result = self.converter.convert("EUR", "USD", 100)
        print(f"100 EUR = {result} USD")
        return result


# Lives in another module and knows nothing about App or the protocol
class BankConverter:
    def convert(self, from_currency, to_currency, amount):
        return round(amount * 1.1, 2)


App(BankConverter()).start()
```

Output:

```text
100 EUR = 110.0 USD
```

## Simpler still: inject a function

When the dependency is a single operation, a callable is enough. Python functions are objects, so you can pass them in like any other dependency:

```python
from collections.abc import Callable


def price_in_usd(amount_eur: float, get_rate: Callable[[str, str], float]) -> float:
    return round(amount_eur * get_rate("EUR", "USD"), 2)


def fixed_rate(from_currency, to_currency):
    return 1.1


print(price_in_usd(50, fixed_rate))
print(price_in_usd(50, lambda src, dst: 2.0))
```

Output:

```text
55.0
100.0
```

## Where concrete classes are chosen: the composition root

If nobody creates concrete objects, who does? The answer is: **one place at the edge of the program**, usually `main()` or the application's start-up code. It is called the *composition root*. It is the only code that knows which concrete classes are used, and it wires them together:

```python
from abc import ABC, abstractmethod


class CurrencyConverter(ABC):
    @abstractmethod
    def convert(self, from_currency: str, to_currency: str, amount: float) -> float:
        """Return the amount converted to to_currency."""


class AlphaConverter(CurrencyConverter):
    def convert(self, from_currency, to_currency, amount):
        return round(amount * 1.15, 2)


class App:
    def __init__(self, converter: CurrencyConverter):
        self.converter = converter

    def start(self):
        print(f"100 EUR = {self.converter.convert('EUR', 'USD', 100)} USD")


def main():
    converter = AlphaConverter()  # the only line that names a concrete provider
    app = App(converter)
    app.start()


if __name__ == "__main__":
    main()
```

Output:

```text
100 EUR = 115.0 USD
```

Changing the provider for the whole application is now a one-line change in `main()`, and nothing else has to know.

> **Tip:** Some frameworks provide dependency injection containers that wire objects automatically (FastAPI's `Depends` is a well-known Python example). For most Python programs, explicit wiring in a composition root is simpler and perfectly sufficient.

## DIP, dependency injection and inversion of control

These terms are related but not the same:

| Term | What it is |
|---|---|
| Dependency Inversion Principle | A *design rule*: depend on abstractions, and let the abstraction be owned by the high-level side |
| Dependency injection | A *technique*: give an object its dependencies from outside (via `__init__`, method arguments or attributes) instead of letting it create them |
| Inversion of control | A broader *idea*: a framework calls your code rather than your code calling it (callbacks, event handlers, plugins) |

You can inject a concrete class without any abstraction (that helps testing but is not full DIP), and you can follow DIP without any framework.

## Trade-offs

- **Indirection.** When reading `App`, you cannot see which converter runs. You have to find the composition root. This is the price of flexibility.
- **Not every dependency needs inverting.** Depend directly on things that are **stable**: the language, the standard library (`json`, `pathlib`, `dataclasses`), your own pure helper functions. Invert dependencies on things that are **volatile or hard to control in tests**: external APIs, databases, the file system, the network, the current time, randomness.
- **Leaky abstractions.** An abstraction that mirrors one vendor (`convert_via_fx(api_key, fx_symbol_code)`) does not really decouple anything. Design it from the needs of the high-level code.
- **Default arguments as a compromise.** `def __init__(self, converter=None)` with a fallback to a real converter is convenient for callers, but it brings back an import of the concrete class into the high-level module. It is a reasonable trade-off in small programs, less so in libraries.

## Common mistakes

- **An ABC without `@abstractmethod`.** `class CurrencyConverter(ABC)` whose `convert()` just does `pass` can be instantiated, and a subclass that forgets `convert()` silently returns `None`. Always mark the required methods abstract.
- **Creating dependencies inside the class** (`self.converter = FXConverter()` in `__init__`). That hides a hard dependency behind an abstract-looking attribute.
- **Importing the concrete class into high-level code "just for the type hint"**. Annotate with the abstraction.
- **Global singletons and service locators** (`converter = registry.get("converter")` deep inside business logic). Dependencies become invisible, and tests must patch global state.
- **Abstracting everything.** An interface for `json.dumps` or for a pure function adds ceremony without making anything easier to change or test.

## Summary

- DIP: high-level policy and low-level details both depend on an abstraction; the abstraction is shaped by the high-level needs.
- The "inversion" is that the low-level module's source-code dependency points up to the abstraction.
- Dependency injection (passing collaborators into `__init__` or a function) is the usual way to apply DIP in Python.
- The abstraction can be an `abc.ABC`, a `typing.Protocol` or simply a callable.
- Choose concrete classes in one place at the edge of the program, the composition root.
- The biggest everyday benefit is testability: fakes replace slow or unpredictable dependencies.
- Invert dependencies on volatile things (APIs, databases, time, randomness), not on stable ones.

## Practice

### Exercise 1: Inject the clock

`Greeter.greet()` cannot be tested reliably because its result depends on the current time. Refactor it so that the time source is injected as a callable that returns a `datetime`, with `datetime.now` as the default. Show the three possible greetings by injecting fixed times for 9:00, 14:00 and 21:00.

```python
from datetime import datetime


class Greeter:
    def greet(self, name):
        hour = datetime.now().hour
        if hour < 12:
            part = "morning"
        elif hour < 18:
            part = "afternoon"
        else:
            part = "evening"
        return f"Good {part}, {name}!"


print(Greeter().greet("Olena"))  # output depends on when you run it
```

### Exercise 2: A testable order service

`OrderService` creates an SMTP sender itself, so every test would try to send a real email. Refactor it to depend on a `MessageSender` protocol with a `send(to, text)` method. Implement `ConsoleSender` (prints) and `RecordingSender` (stores messages in a list, for tests), and use `RecordingSender` with an `assert` to check that the right message was sent.

```python
class SmtpEmailSender:
    def send(self, to, text):
        print(f"SMTP -> {to}: {text}")


class OrderService:
    def __init__(self):
        self.sender = SmtpEmailSender()

    def place_order(self, customer_email, item):
        # ... save the order ...
        self.sender.send(customer_email, f"Your order for {item} is confirmed")


OrderService().place_order("olena@example.com", "keyboard")
```

### Exercise 3: Swappable storage

Write a `TodoService` with `add(title)` and `titles()` that depends on an abstract `TodoRepository` (`load() -> list[str]`, `save(todos)`). Implement `InMemoryTodoRepository` and `JsonFileTodoRepository(path)`. Show that the same service works with both, and that a second service created on the same JSON file sees the saved data. Use `tempfile.TemporaryDirectory()` so that nothing is left on disk.

## Solutions

### Exercise 1

```python
from collections.abc import Callable
from datetime import datetime


class Greeter:
    def __init__(self, clock: Callable[[], datetime] = datetime.now):
        self.clock = clock

    def greet(self, name):
        hour = self.clock().hour
        if hour < 12:
            part = "morning"
        elif hour < 18:
            part = "afternoon"
        else:
            part = "evening"
        return f"Good {part}, {name}!"


def fixed_clock(hour):
    return lambda: datetime(2025, 1, 1, hour)


for hour in (9, 14, 21):
    print(Greeter(clock=fixed_clock(hour)).greet("Olena"))
```

Output:

```text
Good morning, Olena!
Good afternoon, Olena!
Good evening, Olena!
```

Production code still calls `Greeter()` and gets the real clock. Tests inject a fixed one.

### Exercise 2

```python
from typing import Protocol


class MessageSender(Protocol):
    def send(self, to: str, text: str) -> None: ...


class OrderService:
    def __init__(self, sender: MessageSender):
        self.sender = sender

    def place_order(self, customer_email, item):
        # ... save the order ...
        self.sender.send(customer_email, f"Your order for {item} is confirmed")


class ConsoleSender:
    def send(self, to, text):
        print(f"[console] {to}: {text}")


class RecordingSender:
    def __init__(self):
        self.sent = []

    def send(self, to, text):
        self.sent.append((to, text))


OrderService(ConsoleSender()).place_order("olena@example.com", "keyboard")

recorder = RecordingSender()
OrderService(recorder).place_order("taras@example.com", "mouse")
assert recorder.sent == [("taras@example.com", "Your order for mouse is confirmed")]
print("test passed:", recorder.sent)
```

Output:

```text
[console] olena@example.com: Your order for keyboard is confirmed
test passed: [('taras@example.com', 'Your order for mouse is confirmed')]
```

A real `SmtpEmailSender` would be passed in only in the composition root.

### Exercise 3

```python
import json
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path


class TodoRepository(ABC):
    @abstractmethod
    def load(self) -> list[str]:
        """Return all saved titles."""

    @abstractmethod
    def save(self, todos: list[str]) -> None:
        """Replace the saved titles."""


class InMemoryTodoRepository(TodoRepository):
    def __init__(self):
        self._todos = []

    def load(self):
        return list(self._todos)

    def save(self, todos):
        self._todos = list(todos)


class JsonFileTodoRepository(TodoRepository):
    def __init__(self, path):
        self.path = Path(path)

    def load(self):
        if not self.path.exists():
            return []
        return json.loads(self.path.read_text(encoding="utf-8"))

    def save(self, todos):
        self.path.write_text(json.dumps(todos), encoding="utf-8")


class TodoService:
    def __init__(self, repo: TodoRepository):
        self.repo = repo

    def add(self, title):
        todos = self.repo.load()
        todos.append(title)
        self.repo.save(todos)

    def titles(self):
        return self.repo.load()


memory_service = TodoService(InMemoryTodoRepository())
memory_service.add("Learn DIP")
print(memory_service.titles())

with tempfile.TemporaryDirectory() as folder:
    path = Path(folder) / "todos.json"
    file_service = TodoService(JsonFileTodoRepository(path))
    file_service.add("Write tests")
    file_service.add("Refactor")
    print(file_service.titles())
    print(path.read_text(encoding="utf-8"))
    print(TodoService(JsonFileTodoRepository(path)).titles())
```

Output:

```text
['Learn DIP']
['Write tests', 'Refactor']
["Write tests", "Refactor"]
['Write tests', 'Refactor']
```

`TodoService` was written once and never mentions memory or files. The last line proves the data really went to disk: a brand-new service reading the same file sees it.

---

*Source: [pythontutorial.net — Python Dependency Inversion Principle](https://www.pythontutorial.net/python-oop/python-dependency-inversion-principle/). Adapted and expanded for PyJourney.*
