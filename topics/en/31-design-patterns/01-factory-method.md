# Factory Method

**Factory Method** is a creational design pattern. A base class defines *when* and *why* an object is needed, and leaves the decision of *which class* to instantiate to its subclasses. It is the simplest way to stop business logic from being welded to concrete classes, and it shows up everywhere from GUI frameworks to Python's own `__iter__`.

## What you'll learn

- Which problem Factory Method solves and how to recognise it in real code
- The four roles of the pattern: Creator, Concrete Creator, Product and Concrete Product
- How to implement it idiomatically in Python with `abc.ABC` and type hints
- Lighter Pythonic variants: a class attribute or an injected callable instead of a subclass
- When the pattern pays off, when it is overkill, and how it relates to other patterns
- The classic trap of calling a factory method from `__init__`

## Intent

Factory Method declares a method in a base class that returns new objects, and lets subclasses override that method to change the class of the objects being created. The rest of the base class works only with the abstract result, so it never needs to know which concrete class it got. The pattern is also known as **Virtual Constructor**: the "constructor call" is dispatched polymorphically, like any other method.

## Problem

Imagine the first version of a logistics application. It only supports road freight, so most of the code works directly with a `Truck` class:

```python
class Truck:
    def deliver(self, cargo: str) -> str:
        return f"Truck delivers {cargo} by road"


class Logistics:
    def plan_delivery(self, cargo: str) -> str:
        transport = Truck()  # hard-wired concrete class
        return transport.deliver(cargo)


print(Logistics().plan_delivery("10 t of coffee"))
```

Output:

```text
Truck delivers 10 t of coffee by road
```

The app becomes popular, and sea freight companies start asking for support. Adding a `Ship` class is easy. The hard part is everything that calls `Truck()` directly. The usual "quick fix" is a parameter and a conditional:

```python
class Truck:
    def deliver(self, cargo: str) -> str:
        return f"Truck delivers {cargo} by road"


class Ship:
    def deliver(self, cargo: str) -> str:
        return f"Ship delivers {cargo} by sea"


class Logistics:
    def plan_delivery(self, cargo: str, kind: str) -> str:
        if kind == "road":
            transport = Truck()
        elif kind == "sea":
            transport = Ship()
        else:
            raise ValueError(f"unknown transport: {kind}")
        return transport.deliver(cargo)


print(Logistics().plan_delivery("10 t of coffee", "sea"))
```

Output:

```text
Ship delivers 10 t of coffee by sea
```

It works, but it does not scale. Every new transport (planes, trains, drones) means editing `plan_delivery` again, and the same `if/elif` ladder tends to be copied into every method that creates transport. The class that is supposed to plan deliveries now also has to know every vehicle type that exists.

## Solution

Factory Method suggests moving object construction into a dedicated method, the **factory method**, and calling that method instead of calling a constructor directly. The objects it returns are called **products**.

At first glance this only moves one line of code. The gain comes from what it enables: a subclass can **override** the factory method and return a different product. The base class keeps all the shared logic, and each subclass changes just one decision.

There is one requirement. All products must share a common interface (a base class or a protocol), and the base class code must use products only through that interface. A `Truck` and a `Ship` both have `deliver()`. Each implements it differently, but `plan_delivery()` does not care which one it gets.

## Real-world analogy

Think of a coffee chain. Head office writes one service routine for every branch: take the order, prepare the drink, put a lid on it, hand it over, take the payment. One step, "prepare the drink", is left to each branch. A branch in Rome brews it in an espresso machine, a branch in Istanbul uses a cezve. Customers go through exactly the same routine everywhere. Only the single step that produces the drink differs, and head office never has to rewrite the routine when a new kind of branch opens.

## Structure

```text
+-------------------------------+            +---------------------------+
|           Creator             |  creates   |       <<interface>>       |
|-------------------------------|----------->|          Product          |
| + some_operation()            |            |---------------------------|
| + factory_method(): Product   |            | + operation()             |
|          {abstract}           |            +---------------------------+
+-------------------------------+                 ^                 ^
          ^               ^                       |  implements     |
          |  inherits     |                       |                 |
+------------------+ +------------------+ +------------------+ +------------------+
| ConcreteCreatorA | | ConcreteCreatorB | | ConcreteProductA | | ConcreteProductB |
|------------------| |------------------| |------------------| |------------------|
| factory_method() | | factory_method() | | operation()      | | operation()      |
|  -> ProductA()   | |  -> ProductB()   | +------------------+ +------------------+
+------------------+ +------------------+

some_operation():
    product = self.factory_method()   # which class? the subclass decides
    return product.operation()        # used only through the Product interface
```

1. **Product** declares the interface shared by everything the creator can produce.
2. **Concrete Products** are different implementations of that interface.
3. **Creator** declares the factory method, with the *Product* interface as its return type. It may be abstract (every subclass must override it) or return a sensible default product. Despite the name, creating products is usually **not** the creator's main job. It contains real business logic (`some_operation`) that happens to need a product.
4. **Concrete Creators** override the factory method to return a specific product. The method does not have to create a new object every time. It may return one from a cache or a pool.

## Python implementation

Here is the logistics application rebuilt with the pattern. `Transport` is the product, `Logistics` is the creator, and each subclass of `Logistics` picks one transport.

```python
from abc import ABC, abstractmethod


class Transport(ABC):
    """Product: the interface every kind of transport follows."""

    @abstractmethod
    def deliver(self, cargo: str, distance_km: int) -> str: ...


class Truck(Transport):
    def deliver(self, cargo: str, distance_km: int) -> str:
        return f"Truck drives {cargo} {distance_km} km by road ({distance_km / 80:.1f} h)"


class Ship(Transport):
    def deliver(self, cargo: str, distance_km: int) -> str:
        return f"Ship carries {cargo} {distance_km} km by sea ({distance_km / 30:.1f} h)"


class Logistics(ABC):
    """Creator: owns the business logic and declares the factory method."""

    @abstractmethod
    def create_transport(self) -> Transport:
        """Factory method: subclasses decide which Transport to build."""

    def plan_delivery(self, cargo: str, distance_km: int) -> str:
        transport = self.create_transport()  # no concrete class is named here
        report = transport.deliver(cargo, distance_km)
        return f"[{type(self).__name__}] {report}"


class RoadLogistics(Logistics):
    def create_transport(self) -> Transport:
        return Truck()


class SeaLogistics(Logistics):
    def create_transport(self) -> Transport:
        return Ship()


def run_company(logistics: Logistics) -> None:
    # The client knows only the Logistics interface.
    print(logistics.plan_delivery("10 t of coffee", 1200))


run_company(RoadLogistics())
run_company(SeaLogistics())
```

Output:

```text
[RoadLogistics] Truck drives 10 t of coffee 1200 km by road (15.0 h)
[SeaLogistics] Ship carries 10 t of coffee 1200 km by sea (40.0 h)
```

`plan_delivery()` is written once and works with any transport. The return type of `create_transport()` is the abstract `Transport`, so neither the creator nor the client depends on `Truck` or `Ship`.

Adding air freight now means writing new classes and touching nothing that already exists:

```python
# Continues the previous example
class Plane(Transport):
    def deliver(self, cargo: str, distance_km: int) -> str:
        return f"Plane flies {cargo} {distance_km} km by air ({distance_km / 800:.1f} h)"


class AirLogistics(Logistics):
    def create_transport(self) -> Transport:
        return Plane()


run_company(AirLogistics())
```

Output:

```text
[AirLogistics] Plane flies 10 t of coffee 1200 km by air (1.5 h)
```

Because `Logistics` uses `@abstractmethod`, it cannot be instantiated by mistake. Python stops you at construction time instead of failing later with a confusing `None` product:

```python
# Continues the previous example
try:
    Logistics()
except TypeError as error:
    print(error)
```

Output:

```text
Can't instantiate abstract class Logistics without an implementation for abstract method 'create_transport'
```

> **Tip:** Since Python 3.12 you can decorate overriding methods with `@typing.override`. It does nothing at runtime, but a type checker will report a typo such as `create_transprot` that would otherwise silently add a new method instead of overriding the factory method.

### Pythonic variations

Classes are ordinary objects in Python, so you do not always need a subclass per product. Two lighter forms are very common:

```python
from collections.abc import Callable
from typing import Protocol


class Transport(Protocol):
    def deliver(self, cargo: str) -> str: ...


class Truck:
    def deliver(self, cargo: str) -> str:
        return f"Truck delivers {cargo}"


class Drone:
    def deliver(self, cargo: str) -> str:
        return f"Drone delivers {cargo}"


# Variant 1: the "factory method" is a class attribute that stores a class.
class Logistics:
    transport_class: type[Transport] = Truck

    def plan_delivery(self, cargo: str) -> str:
        return self.transport_class().deliver(cargo)


class DroneLogistics(Logistics):
    transport_class = Drone


# Variant 2: inject any zero-argument callable that builds a product.
class Dispatcher:
    def __init__(self, make_transport: Callable[[], Transport] = Truck) -> None:
        self._make_transport = make_transport

    def dispatch(self, cargo: str) -> str:
        return self._make_transport().deliver(cargo)


print(Logistics().plan_delivery("letters"))
print(DroneLogistics().plan_delivery("pizza"))
print(Dispatcher().dispatch("furniture"))
print(Dispatcher(Drone).dispatch("medicine"))
```

Output:

```text
Truck delivers letters
Drone delivers pizza
Truck delivers furniture
Drone delivers medicine
```

- **Variant 1** is still Factory Method: subclasses change the product by overriding one class attribute instead of a whole method. Use it when creating the product needs no extra logic.
- **Variant 2** replaces inheritance with composition (dependency injection). It is often the most Pythonic choice when the product is the *only* thing that varies. Choose the full pattern when subclasses also customise other behaviour, or when you are designing extension points for a framework.

> **Note:** Alternative constructors such as `dict.fromkeys()`, `int.from_bytes()` or `datetime.fromisoformat()` are often called "factory methods" too. They are named `@classmethod` constructors that build an instance *of the same class* from different input. That is a useful idiom, but it is not the GoF Factory Method, whose point is letting subclasses choose a *different product class*.

## A practical example: report exporters

A reporting module validates data, builds a file name and adds a header. Only the formatting differs between CSV and JSON. The creator keeps the shared logic, and the factory method supplies the formatter.

```python
import csv
import io
import json
from abc import ABC, abstractmethod

type Row = dict[str, str | int | float]


class Formatter(ABC):
    """Product."""

    @abstractmethod
    def render(self, rows: list[Row]) -> str: ...


class CsvFormatter(Formatter):
    def render(self, rows: list[Row]) -> str:
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
        return buffer.getvalue().rstrip("\n")


class JsonFormatter(Formatter):
    def render(self, rows: list[Row]) -> str:
        return json.dumps(rows, ensure_ascii=False)


class ReportExporter(ABC):
    """Creator: validation, the file name and the header live here, once."""

    extension = "txt"

    def export(self, title: str, rows: list[Row]) -> str:
        if not rows:
            raise ValueError("nothing to export")
        formatter = self.create_formatter()
        filename = f"{title.lower().replace(' ', '_')}.{self.extension}"
        return f"# {filename} ({len(rows)} rows)\n{formatter.render(rows)}"

    @abstractmethod
    def create_formatter(self) -> Formatter: ...


class CsvExporter(ReportExporter):
    extension = "csv"

    def create_formatter(self) -> Formatter:
        return CsvFormatter()


class JsonExporter(ReportExporter):
    extension = "json"

    def create_formatter(self) -> Formatter:
        return JsonFormatter()


# The application picks a concrete creator from configuration.
EXPORTERS: dict[str, type[ReportExporter]] = {"csv": CsvExporter, "json": JsonExporter}


def export_report(fmt: str, title: str, rows: list[Row]) -> str:
    try:
        exporter_class = EXPORTERS[fmt]
    except KeyError:
        raise ValueError(f"unknown format {fmt!r}, choose from {sorted(EXPORTERS)}") from None
    return exporter_class().export(title, rows)


sales: list[Row] = [
    {"city": "Kyiv", "orders": 120, "revenue": 5400.5},
    {"city": "Lviv", "orders": 75, "revenue": 3100.0},
]

print(export_report("csv", "Sales Q3", sales))
print()
print(export_report("json", "Sales Q3", sales))
print()
try:
    export_report("xml", "Sales Q3", sales)
except ValueError as error:
    print("Error:", error)
```

Output:

```text
# sales_q3.csv (2 rows)
city,orders,revenue
Kyiv,120,5400.5
Lviv,75,3100.0

# sales_q3.json (2 rows)
[{"city": "Kyiv", "orders": 120, "revenue": 5400.5}, {"city": "Lviv", "orders": 75, "revenue": 3100.0}]

Error: unknown format 'xml', choose from ['csv', 'json']
```

The `type Row = ...` statement is a type alias (Python 3.12+). On older versions write `Row = dict[str, str | int | float]`.

Now imagine `ReportExporter` lives in a library you cannot edit. A user who needs Markdown output extends it from the outside, and every rule in `export()` (validation, file name, header) keeps working:

```python
# Continues the previous example
class MarkdownFormatter(Formatter):
    def render(self, rows: list[Row]) -> str:
        headers = list(rows[0])
        lines = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
        for row in rows:
            lines.append("| " + " | ".join(str(row[h]) for h in headers) + " |")
        return "\n".join(lines)


class MarkdownExporter(ReportExporter):
    extension = "md"

    def create_formatter(self) -> Formatter:
        return MarkdownFormatter()


EXPORTERS["md"] = MarkdownExporter
print(export_report("md", "Sales Q3", sales))
```

Output:

```text
# sales_q3.md (2 rows)
| city | orders | revenue |
|---|---|---|
| Kyiv | 120 | 5400.5 |
| Lviv | 75 | 3100.0 |
```

This is exactly how many frameworks expose extension points: the framework calls a factory method, and you override it to plug in your own component.

## When to use it

- **You do not know in advance which exact classes your code will work with**, or you expect the list to grow. The construction code is separated from the code that uses the product, so new products are added without touching existing logic.
- **You build a library or framework and want users to replace internal components.** Subclassing a component is not enough: the framework also needs a way to *use* the subclass. A factory method is that hook. A UI framework that creates buttons through `create_button()` lets a user return a `RoundButton` instead of the default square one.
- **You want to reuse existing objects instead of creating new ones**, for example database connections or other expensive resources. `__init__` always initialises a fresh object, so it cannot hand out an existing one. A regular method can: it looks in a cache or a pool first and creates a new object only when needed. (Technically `__new__` could return a cached instance, but that surprises readers, and `__init__` then runs again on the reused object.)

## How to implement it

1. Make all products follow one interface: an `ABC` with abstract methods, or a `typing.Protocol` if you prefer structural typing. Include only methods that make sense for every product.
2. Add a factory method to the creator class. Annotate its return type with the product interface.
3. Find every place in the creator that calls a product constructor directly. Replace each call with `self.factory_method()` and move the construction code into the factory method.
4. Create a concrete creator subclass for each product type and override the factory method in it.
5. If there are many product variants and a subclass for each would be excessive, let the factory method accept a parameter that selects the product inside one subclass.
6. If the base factory method is empty after all this, make it abstract with `@abstractmethod`. If something remains, keep it as the default behaviour.

## Pros and cons

| Pros | Cons |
|---|---|
| The creator is not tightly coupled to concrete product classes. | You may need many new subclasses: one creator per product. |
| *Single Responsibility Principle*: product creation lives in one place. | It is overkill when only the product varies; passing a class or a callable is simpler. |
| *Open/Closed Principle*: new products are added without changing existing client code. | Readers must follow an extra level of indirection to see what is actually created. |
| A natural extension point for libraries and frameworks. | Works best when there is already a creator hierarchy to hang it on. |

## Relations with other patterns

- Many designs start with **Factory Method** (simple, customised through subclasses) and grow towards **Abstract Factory**, **Prototype** or **Builder** (more flexible, more complex).
- **Abstract Factory** classes are often built from a set of factory methods, one per product.
- **Iterator**: a collection's factory method can return an iterator that matches the collection. Python's `__iter__` is exactly that: every iterable decides which iterator class to return.
- **Prototype** creates objects by cloning and does not rely on inheritance, but needs the clone to be initialised. Factory Method relies on inheritance and needs no such step.
- Factory Method is a special case of **Template Method**: `plan_delivery()` above is a small template whose single customisable step is the factory method. A factory method is also often one step inside a bigger template method.

## Common mistakes

- **Calling the factory method from the base `__init__`.** The subclass override runs *before* the subclass has finished its own initialisation:

  ```python
  class Exporter:
      def __init__(self) -> None:
          self.formatter = self.create_formatter()  # called too early

      def create_formatter(self) -> str:
          return "plain"


  class PrettyExporter(Exporter):
      def __init__(self, indent: int) -> None:
          super().__init__()
          self.indent = indent

      def create_formatter(self) -> str:
          return f"pretty(indent={self.indent})"  # self.indent is not set yet


  try:
      PrettyExporter(indent=4)
  except AttributeError as error:
      print("AttributeError:", error)
  ```

  Output:

  ```text
  AttributeError: 'PrettyExporter' object has no attribute 'indent'
  ```

  Call the factory method lazily, when the product is actually needed (as `plan_delivery()` does), or set the subclass attributes *before* calling `super().__init__()`.

- **Calling a big `if/elif` the "factory method".** A single function that picks a class from a string is a *simple factory*. It is a fine first step, but every new product still means editing it. The pattern's power comes from overriding.
- **Leaking concrete types.** If the base class or the client annotates the product as `Truck` or calls truck-only methods, swapping in a `Ship` breaks it. Program against the product interface.
- **Building a creator hierarchy nobody needs.** If the only difference between subclasses is the product class, a class attribute or an injected callable (see *Pythonic variations*) does the same job with less code.
- **Forgetting `@abstractmethod`.** Without it, the base creator can be instantiated, its factory method silently returns `None`, and the error appears far away as `'NoneType' object has no attribute 'deliver'`.

## Summary

- Factory Method replaces direct constructor calls with a call to an overridable method that returns a product.
- The creator contains real business logic and uses products only through their common interface.
- Subclasses change *what* is created; the base class decides *when* and *how* it is used.
- In Python, define the product with `ABC` or `Protocol` and mark the factory method with `@abstractmethod` when there is no sensible default.
- If only the product varies, a class attribute or an injected callable is often the more Pythonic solution.
- A factory method may return cached or pooled objects, which a constructor cannot do cleanly.
- Do not call the factory method from the base `__init__` when subclasses depend on their own state.

## Practice

### Exercise 1: Notification channels

Create a product interface `Channel` with a method `send(to: str, text: str) -> str`.

- `EmailChannel.send()` returns `"EMAIL to <to>: <text>"`.
- `SmsChannel.send()` returns `"SMS to <to>: <text>"`, but if the text is longer than 20 characters it keeps the first 17 characters and appends `"..."`.

Then write a creator `Notifier` with an abstract factory method `create_channel()` and a method `notify(users: list[str], text: str) -> list[str]` that creates **one** channel and sends the text to every user. Add `EmailNotifier` and `SmsNotifier`, and print the results for two users.

### Exercise 2: A default product and a framework extension

A UI "framework" has a `Dialog` class whose `render()` method creates a button through `create_button()` and returns `f"Dialog [{button.draw()}]"`. By default `create_button()` returns a `SquareButton`, whose `draw()` returns `"[ OK ]"`.

Without changing `Dialog`, add a `RoundButton` (`draw()` returns `"( OK )"`) and a `RoundDialog` that uses it. Print the output of both dialogs.

### Exercise 3: A factory method that reuses objects

Start from this code:

```python
class Connection:
    opened = 0

    def __init__(self, dsn: str) -> None:
        Connection.opened += 1
        self.dsn = dsn
        self.number = Connection.opened


class Database:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def create_connection(self) -> Connection:
        return Connection(self.dsn)

    def query(self, sql: str) -> str:
        connection = self.create_connection()
        return f"{sql} -> connection #{connection.number}"
```

Every `query()` opens a new connection. Write a subclass `PooledDatabase` that overrides **only** `create_connection()` so that all `PooledDatabase` objects with the same DSN share one connection. Run three queries with `Database` and three with `PooledDatabase` and print `Connection.opened` after each group.

## Solutions

### Exercise 1

```python
from abc import ABC, abstractmethod


class Channel(ABC):
    @abstractmethod
    def send(self, to: str, text: str) -> str: ...


class EmailChannel(Channel):
    def send(self, to: str, text: str) -> str:
        return f"EMAIL to {to}: {text}"


class SmsChannel(Channel):
    LIMIT = 20

    def send(self, to: str, text: str) -> str:
        if len(text) > self.LIMIT:
            text = text[: self.LIMIT - 3] + "..."
        return f"SMS to {to}: {text}"


class Notifier(ABC):
    @abstractmethod
    def create_channel(self) -> Channel: ...

    def notify(self, users: list[str], text: str) -> list[str]:
        channel = self.create_channel()  # one channel for the whole batch
        return [channel.send(user, text) for user in users]


class EmailNotifier(Notifier):
    def create_channel(self) -> Channel:
        return EmailChannel()


class SmsNotifier(Notifier):
    def create_channel(self) -> Channel:
        return SmsChannel()


users = ["olena", "taras"]
message = "Your order has been shipped"
for notifier in (EmailNotifier(), SmsNotifier()):
    for line in notifier.notify(users, message):
        print(line)
```

Output:

```text
EMAIL to olena: Your order has been shipped
EMAIL to taras: Your order has been shipped
SMS to olena: Your order has be...
SMS to taras: Your order has be...
```

### Exercise 2

```python
class SquareButton:
    def draw(self) -> str:
        return "[ OK ]"


class Dialog:
    """Framework class: not modified by the user."""

    def create_button(self) -> SquareButton:
        return SquareButton()  # default product

    def render(self) -> str:
        button = self.create_button()
        return f"Dialog [{button.draw()}]"


# User code: extends the framework from the outside.
class RoundButton(SquareButton):
    def draw(self) -> str:
        return "( OK )"


class RoundDialog(Dialog):
    def create_button(self) -> SquareButton:
        return RoundButton()


print(Dialog().render())
print(RoundDialog().render())
```

Output:

```text
Dialog [[ OK ]]
Dialog [( OK )]
```

The base factory method is not abstract here: it returns a sensible default, and subclasses override it only when they need something else. `RoundButton` inherits from `SquareButton` so it fits the declared return type. In a larger framework you would declare a `Button` interface instead.

### Exercise 3

```python
class Connection:
    opened = 0

    def __init__(self, dsn: str) -> None:
        Connection.opened += 1
        self.dsn = dsn
        self.number = Connection.opened


class Database:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def create_connection(self) -> Connection:
        return Connection(self.dsn)

    def query(self, sql: str) -> str:
        connection = self.create_connection()
        return f"{sql} -> connection #{connection.number}"


class PooledDatabase(Database):
    _pool: dict[str, Connection] = {}  # shared by all instances

    def create_connection(self) -> Connection:
        if self.dsn not in self._pool:
            self._pool[self.dsn] = super().create_connection()
        return self._pool[self.dsn]


plain = Database("sqlite:///shop.db")
for sql in ("SELECT 1", "SELECT 2", "SELECT 3"):
    print(plain.query(sql))
print("opened:", Connection.opened)

pooled_a = PooledDatabase("sqlite:///shop.db")
pooled_b = PooledDatabase("sqlite:///shop.db")
for db, sql in ((pooled_a, "SELECT 4"), (pooled_b, "SELECT 5"), (pooled_a, "SELECT 6")):
    print(db.query(sql))
print("opened:", Connection.opened)
print(pooled_a.create_connection() is pooled_b.create_connection())
```

Output:

```text
SELECT 1 -> connection #1
SELECT 2 -> connection #2
SELECT 3 -> connection #3
opened: 3
SELECT 4 -> connection #4
SELECT 5 -> connection #4
SELECT 6 -> connection #4
opened: 4
True
```

`query()` did not change at all. Only the factory method decides whether a call produces a new object or reuses an existing one. A real pool would also limit the number of connections and track which ones are free, but the principle is the same.

---

*Sources: [Refactoring.Guru — Factory Method](https://refactoring.guru/design-patterns/factory-method), [Refactoring.Guru — Factory Method in Python](https://refactoring.guru/design-patterns/factory-method/python/example). Adapted and expanded for PyJourney.*
