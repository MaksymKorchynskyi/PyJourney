# Template Method

**Template Method** is a behavioral design pattern that fixes the *skeleton* of an algorithm in a base class and lets subclasses fill in or adjust individual steps without changing the order of those steps. It is one of the most common patterns in frameworks: `unittest.TestCase`, `collections.abc` and `threading.Thread` all rely on it.

## What you'll learn

- How Template Method removes duplicated algorithms from sibling classes
- The three kinds of steps: abstract steps, default steps and hooks
- How to build a template method with `abc.ABC` and protect it with `typing.final`
- Where the standard library uses the pattern (`collections.abc.Mapping`, `unittest`)
- How Template Method relates to Strategy and when composition is a better choice
- Pitfalls: calling steps from `__init__`, overriding the skeleton, breaking the base contract

## Intent

Define the overall structure of an algorithm in one method of a base class (the **template method**). The template method calls a series of **steps**. Subclasses override some of the steps to provide their own behavior, but the sequence itself stays in the base class and cannot be changed by them.

## Problem

A company imports sales data from partners. The first partner sent CSV files, so you wrote `CsvImporter`. Then a second partner arrived with JSON, and you wrote `JsonImporter` by copying the first class and changing the parsing part. Later came XML.

All three classes do the same thing:

1. parse the input into records;
2. drop invalid records (negative or zero amounts);
3. save the records;
4. print a summary.

Only step 1 differs between formats. Steps 2–4 are copied three times. When the business decided that zero amounts are also invalid, someone fixed the check in `CsvImporter` and forgot `JsonImporter`. Now the two importers disagree on the same data.

There is a second problem. The code that runs the importers is full of `if isinstance(importer, CsvImporter): ... elif ...`, because the classes share no common interface.

## Solution

Split the algorithm into steps, turn every step into a method, and call these methods in order from a single **template method** in a base class. The steps come in three kinds:

- **Abstract steps** must be implemented by every subclass (parsing is different for every format).
- **Default steps** have a reasonable implementation in the base class that subclasses *may* override (validation, saving, reporting).
- **Hooks** are optional steps with an empty body, placed before or after important steps. The algorithm works even if nobody overrides them. They are extension points for special cases.

Each format becomes a small subclass that implements `parse()` and, if needed, a hook. The duplicated steps live in one place, and the client code calls `importer.run(raw)` on any importer without type checks.

## Real-world analogy

A pizzeria chain uses one standard procedure in every restaurant: prepare the dough, spread the sauce, add toppings, bake, slice. The procedure is fixed by the head office (the template method). Each pizza on the menu decides what goes on top (an abstract step). Baking time has a default that a thin-crust pizza may change (a default step). And a customer may ask for extra cheese before baking (a hook): if nobody asks, the step simply does nothing.

## Structure

```text
+----------------------------------------+
| AbstractClass (SalesImporter)          |
|----------------------------------------|
| + run(raw)        <- template method   |
|     parse(raw)                         |
|     is_valid(sale)                     |
|     before_save(sales)                 |
|     save(sales)                        |
|     report(...)                        |
|----------------------------------------|
| + parse(raw)        {abstract}         |
| + is_valid(sale)    default            |
| + before_save(...)  hook (empty)       |
| + save(...)         default            |
| + report(...)       default            |
+----------------------------------------+
           ^                     ^
           | inherits            | inherits
+---------------------+  +-------------------------+
| CsvImporter         |  | JsonImporter            |
|---------------------|  |-------------------------|
| + parse(raw)        |  | + parse(raw)            |
+---------------------+  | + before_save(sales)    |
                         +-------------------------+
```

1. **Abstract class** declares the template method and the steps it calls. Steps may be abstract or have a default implementation.
2. **Concrete classes** implement the abstract steps and may override default steps and hooks. They must not override the template method itself.

## Python implementation

```python
import csv
import io
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import final


@dataclass
class Sale:
    item: str
    amount: float


class SalesImporter(ABC):
    """Abstract class: defines the skeleton of the import algorithm."""

    @final
    def run(self, raw: str) -> float:
        """The template method. Subclasses must not override it."""
        sales = self.parse(raw)                                # 1. abstract step
        valid = [sale for sale in sales if self.is_valid(sale)]  # 2. default step
        self.before_save(valid)                                # 3. hook
        total = self.save(valid)                               # 4. default step
        self.report(len(sales), valid, total)                  # 5. default step
        return total

    @abstractmethod
    def parse(self, raw: str) -> list[Sale]:
        """Turn raw text into Sale objects."""

    def is_valid(self, sale: Sale) -> bool:
        return sale.amount > 0

    def before_save(self, sales: list[Sale]) -> None:
        """Hook: does nothing unless a subclass needs it."""

    def save(self, sales: list[Sale]) -> float:
        return sum(sale.amount for sale in sales)  # a real app would write to a DB

    def report(self, read: int, saved: list[Sale], total: float) -> None:
        names = [sale.item for sale in saved]
        print(f"{type(self).__name__}: read {read}, saved {names}, total {total:.2f}")


class CsvImporter(SalesImporter):
    def parse(self, raw: str) -> list[Sale]:
        reader = csv.DictReader(io.StringIO(raw))
        return [Sale(row["item"], float(row["amount"])) for row in reader]


class JsonImporter(SalesImporter):
    def parse(self, raw: str) -> list[Sale]:
        return [Sale(d["item"], float(d["amount"])) for d in json.loads(raw)]

    def before_save(self, sales: list[Sale]) -> None:  # plugs into the hook
        for sale in sales:
            sale.item = sale.item.strip().lower()


csv_data = "item,amount\nkeyboard,1200\nmouse,-5\ncable,150\n"
json_data = '[{"item": " Monitor ", "amount": 7300}, {"item": "Hub", "amount": 0}]'

CsvImporter().run(csv_data)
JsonImporter().run(json_data)
```

Output:

```text
CsvImporter: read 3, saved ['keyboard', 'cable'], total 1350.00
JsonImporter: read 2, saved ['monitor'], total 7300.00
```

Points to notice:

- `CsvImporter` contains **only** what is specific to CSV. Validation, saving and reporting are written once.
- `JsonImporter` uses the `before_save()` hook to clean up item names. `CsvImporter` ignores the hook, and the algorithm still works.
- `@abstractmethod` makes `parse()` mandatory: Python refuses to create an importer that forgot it (see "Common mistakes").
- The base class calls `self.parse(...)`, but the method that runs belongs to the subclass. This inversion is sometimes called the **Hollywood principle**: "don't call us, we'll call you". The base class is in control and calls your code at the right moments.

> **Note:** Python has no `final` keyword. `typing.final` (Python 3.8+) marks the template method as "do not override", but only **static type checkers** such as mypy and pyright enforce it. At runtime a subclass can still override `run()`. Name the template method clearly, document it, and run a type checker in CI.

## Practical example: `collections.abc` and `unittest`

The standard library is full of template methods. The abstract base classes in `collections.abc` are a great example. `Mapping` declares three abstract steps (`__getitem__`, `__iter__`, `__len__`) and provides many ready-made methods (`get`, `keys`, `items`, `values`, `__contains__`, `__eq__`) that are **template methods built on those three steps**. Implement the steps and you get a full read-only dictionary interface for free:

```python
from collections.abc import Iterator, Mapping


class CaseInsensitiveDict(Mapping[str, object]):
    """Read-only mapping whose keys ignore letter case."""

    def __init__(self, data: dict[str, object]) -> None:
        self._data = {key.lower(): value for key, value in data.items()}

    # The three primitive operations that Mapping requires:
    def __getitem__(self, key: str) -> object:
        return self._data[key.lower()]

    def __iter__(self) -> Iterator[str]:
        return iter(self._data)

    def __len__(self) -> int:
        return len(self._data)


headers = CaseInsensitiveDict({"Content-Type": "text/html", "X-Request-ID": 42})

# Everything below is inherited from Mapping and built on the three methods above
print(headers["content-type"])
print("CONTENT-TYPE" in headers)          # __contains__
print(headers.get("x-missing", "n/a"))    # get
print(list(headers.items()))              # items
print(headers == {"content-type": "text/html", "x-request-id": 42})  # __eq__
print(sorted(name for name in dir(Mapping) if not name.startswith("_")))
```

Output:

```text
text/html
True
n/a
[('content-type', 'text/html'), ('x-request-id', 42)]
True
['get', 'items', 'keys', 'values']
```

`Mapping.get()` is a template method: it tries `self[key]` and returns the default on `KeyError`. It does not know how your mapping stores data, it only relies on your `__getitem__`. The same idea powers `Sequence`, `MutableMapping`, `Set` and the other ABCs.

`unittest.TestCase` is another template method. Its `run()` calls `setUp()`, then the test method, then `tearDown()`. `setUp` and `tearDown` are hooks with empty default bodies:

```python
import unittest


class TemplateDemo(unittest.TestCase):
    def setUp(self) -> None:          # hook: before each test
        print("setUp")
        self.items = [3, 1, 2]

    def tearDown(self) -> None:       # hook: after each test
        print("tearDown")

    def test_sorted(self) -> None:    # the step you supply
        print("test_sorted")
        self.assertEqual(sorted(self.items), [1, 2, 3])


suite = unittest.defaultTestLoader.loadTestsFromTestCase(TemplateDemo)
result = unittest.TestResult()
suite.run(result)
print("ran:", result.testsRun, "failures:", len(result.failures))
```

Output:

```text
setUp
test_sorted
tearDown
ran: 1 failures: 0
```

Other examples: `threading.Thread.start()` calls your overridden `run()`, `socketserver.BaseRequestHandler` calls `setup()`, `handle()` and `finish()`, and `html.parser.HTMLParser` calls `handle_starttag()`, `handle_data()` and similar hooks while it parses.

## When to use it

- You want clients to extend **particular steps** of an algorithm, but not the whole algorithm or its order.
- Several classes contain almost identical algorithms that differ in a few details. When the algorithm changes, you would have to modify all of them.
- You are building a framework or a base class and want to give users clear extension points (abstract steps and hooks) while keeping control of the overall flow.

If the variable parts must change at runtime, or if one object needs a combination of variants, prefer Strategy: composition is more flexible than inheritance.

## How to implement it

1. Analyze the algorithm and split it into steps. Decide which steps are common to all variants and which are always different.
2. Create an abstract base class (`abc.ABC`). Write the template method that calls the steps in order. Mark it with `@typing.final` to document that it must not be overridden.
3. Declare the steps that differ as `@abstractmethod`. Give the others a default implementation.
4. Add hooks with empty bodies at the points where subclasses might need to intervene (typically before and after important steps). Do not add hooks "just in case": each one is a promise you will have to keep.
5. For every variant of the algorithm, create a subclass that implements all abstract steps and overrides default steps or hooks only where needed.

## Pros and cons

**Pros:**

- Clients override only the parts of a large algorithm they care about, so changes in other parts affect them less.
- Duplicated code moves into one base class.
- The base class keeps control of the order of operations, which protects invariants (for example, "validation always runs before saving").

**Cons:**

- The skeleton limits clients: a subclass cannot easily reorder steps or skip one the base class requires.
- A subclass that suppresses a default step (for example, by making `is_valid()` always return `True`) can violate the *Liskov Substitution Principle*: it no longer behaves like the base class promised.
- The more steps and hooks there are, the harder the template method is to understand and maintain. Readers have to jump between the base class and subclasses (the "yo-yo problem").
- Behavior is fixed per class. You cannot switch a step for one object at runtime without creating another subclass.

## Relations with other patterns

- **Factory Method** is a specialization of Template Method: a template method may call a factory method as one of its steps, letting subclasses decide which object to create.
- **Template Method vs Strategy.** Template Method is based on **inheritance**: you change parts of an algorithm by subclassing, and the choice is made per class, statically. Strategy is based on **composition**: you pass objects or functions that implement the varying parts, and the choice is made per object, even at runtime. Exercise 3 below turns the importer into a composition-based version.
- **Hooks and Observer.** A hook that only notifies other code ("after save") can grow into an Observer-style event if many independent reactions are needed.

## Common mistakes

- **Forgetting (or misspelling) an abstract step.** This is exactly what `@abstractmethod` protects you from: the error appears when the object is created, not deep inside the algorithm.

  ```python
  from abc import ABC, abstractmethod


  class Importer(ABC):
      def run(self, raw: str) -> None:
          print(self.parse(raw))

      @abstractmethod
      def parse(self, raw: str) -> list[str]: ...


  class BrokenImporter(Importer):
      def prase(self, raw: str) -> list[str]:  # typo: the step is not implemented
          return raw.split(",")


  try:
      BrokenImporter()
  except TypeError as exc:
      print(exc)
  ```

  Output:

  ```text
  Can't instantiate abstract class BrokenImporter without an implementation for abstract method 'parse'
  ```

  Without `ABC` and `@abstractmethod` this class would be created happily and fail only when `run()` is called.

- **Calling the template method from `__init__`.** The base constructor runs before the subclass has set its own attributes, so overridden steps see a half-built object:

  ```python
  class Report:
      def __init__(self) -> None:
          self.render()  # template method called from the constructor

      def render(self) -> None:
          print(f"== {self.title()} ==")

      def title(self) -> str:
          return "Report"


  class SalesReport(Report):
      def __init__(self, region: str) -> None:
          super().__init__()  # render() runs here, before self.region exists
          self.region = region

      def title(self) -> str:
          return f"Sales: {self.region}"


  try:
      SalesReport("west")
  except AttributeError as exc:
      print("AttributeError:", exc)
  ```

  Output:

  ```text
  AttributeError: 'SalesReport' object has no attribute 'region'
  ```

  Keep constructors simple and let the client call the template method explicitly.

- **Overriding the template method itself.** A subclass that rewrites `run()` breaks the guarantees of the skeleton (for example, it may skip validation). Override steps, not the skeleton, and use `@final` so that type checkers catch it.
- **Replacing a default step instead of extending it.** `def is_valid(self, sale): return sale.item != ""` silently drops the base check `amount > 0`. If you want to add a rule, combine it: `return super().is_valid(sale) and sale.item != ""`.
- **Hooks that must be called in a special way.** A hook should be safe to ignore. If a subclass *must* call `super().before_save()` for things to work, the hook is really a mandatory step in disguise.
- **Too many tiny steps.** A template method with fifteen hooks is hard to follow. Keep the number of extension points small, and switch to composition when subclasses start combining unrelated variations.

## Summary

- A template method defines the fixed order of steps of an algorithm in a base class. Subclasses customize individual steps.
- Steps are abstract (must override), default (may override) or hooks (empty, optional).
- In Python, use `abc.ABC` with `@abstractmethod` for mandatory steps and `typing.final` to document the template method. `final` is enforced only by type checkers.
- The base class calls subclass code, not the other way around ("don't call us, we'll call you").
- `collections.abc`, `unittest.TestCase`, `threading.Thread` and `socketserver` are all built on Template Method.
- Template Method uses inheritance and works per class. Strategy uses composition and works per object. Choose Strategy when steps must vary at runtime or combine freely.
- Do not call template methods from `__init__`, and do not let subclasses quietly disable steps the base class relies on.

## Practice

### Exercise 1: Report generator

Write an abstract `ReportGenerator` with a template method `render(title, rows) -> str`, where `rows` is a list of `(name, value)` pairs. The template method builds the result from `header(title)` (abstract), one `format_row(name, value)` call per row (abstract), and `footer(rows)` (a hook that returns an empty string by default and is skipped when empty). Implement `PlainTextReport` and `MarkdownReport`. Only the Markdown report has a footer with the total.

### Exercise 2: Game AI

A strategy game runs the same turn for every computer player: collect resources, build structures, build units, attack. Implement `GameAI.turn()` as a template method. `collect_resources()` and `attack()` have default implementations (`attack()` sends warriors if an enemy is visible and scouts otherwise). `build_structures()`, `build_units()`, `send_scouts()` and `send_warriors()` are abstract. Write `OrcsAI` (collects 150 resources, builds barracks for 100, trains a grunt for 50) and `MonstersAI` (never collects or builds anything). Run one turn of each.

### Exercise 3: From inheritance to composition

Rewrite the sales importer without inheritance. Create a single `Importer` dataclass that receives a `parse` function and an optional `normalize` function (the replacement of the hook). The skeleton (parse, validate, normalize, total, report) stays inside `Importer.run()`. Reproduce the output of the CSV and JSON importers. Then think: what did you gain, and what did you lose?

## Solutions

### Exercise 1

```python
from abc import ABC, abstractmethod
from typing import final

Row = tuple[str, float]


class ReportGenerator(ABC):
    @final
    def render(self, title: str, rows: list[Row]) -> str:
        parts = [self.header(title)]
        parts += [self.format_row(name, value) for name, value in rows]
        footer = self.footer(rows)          # hook: may return ""
        if footer:
            parts.append(footer)
        return "\n".join(parts)

    @abstractmethod
    def header(self, title: str) -> str: ...

    @abstractmethod
    def format_row(self, name: str, value: float) -> str: ...

    def footer(self, rows: list[Row]) -> str:
        return ""


class PlainTextReport(ReportGenerator):
    def header(self, title: str) -> str:
        return f"{title.upper()}\n{'=' * len(title)}"

    def format_row(self, name: str, value: float) -> str:
        return f"{name:<10}{value:>8.2f}"


class MarkdownReport(ReportGenerator):
    def header(self, title: str) -> str:
        return f"## {title}\n\n| Name | Value |\n|---|---:|"

    def format_row(self, name: str, value: float) -> str:
        return f"| {name} | {value:.2f} |"

    def footer(self, rows: list[Row]) -> str:
        return f"| **Total** | **{sum(v for _, v in rows):.2f}** |"


data = [("Kyiv", 1200.5), ("Lviv", 830.0)]
print(PlainTextReport().render("Sales", data))
print()
print(MarkdownReport().render("Sales", data))
```

Output:

```text
SALES
=====
Kyiv       1200.50
Lviv        830.00

## Sales

| Name | Value |
|---|---:|
| Kyiv | 1200.50 |
| Lviv | 830.00 |
| **Total** | **2030.50** |
```

### Exercise 2

```python
from abc import ABC, abstractmethod


class GameAI(ABC):
    def __init__(self, name: str, enemy_visible: bool) -> None:
        self.name = name
        self.enemy_visible = enemy_visible
        self.resources = 0

    def turn(self) -> None:
        """Template method: the order of steps is the same for every race."""
        print(f"--- {self.name}")
        self.collect_resources()
        self.build_structures()
        self.build_units()
        self.attack()

    def collect_resources(self) -> None:  # default step
        self.resources += 150
        print(f"collected resources, now {self.resources}")

    @abstractmethod
    def build_structures(self) -> None: ...

    @abstractmethod
    def build_units(self) -> None: ...

    def attack(self) -> None:  # default step built on two abstract ones
        if self.enemy_visible:
            self.send_warriors()
        else:
            self.send_scouts()

    @abstractmethod
    def send_scouts(self) -> None: ...

    @abstractmethod
    def send_warriors(self) -> None: ...


class OrcsAI(GameAI):
    def build_structures(self) -> None:
        if self.resources >= 100:
            self.resources -= 100
            print("built barracks")

    def build_units(self) -> None:
        if self.resources >= 50:
            self.resources -= 50
            print("trained a grunt")
        else:
            print("not enough resources for units")

    def send_scouts(self) -> None:
        print("orc scouts explore the map")

    def send_warriors(self) -> None:
        print("orc warriors charge!")


class MonstersAI(GameAI):
    def collect_resources(self) -> None:  # monsters skip this step
        pass

    def build_structures(self) -> None:
        pass

    def build_units(self) -> None:
        pass

    def send_scouts(self) -> None:
        print("monsters wander around")

    def send_warriors(self) -> None:
        print("monsters attack the nearest unit")


for ai in (OrcsAI("Orcs", enemy_visible=False), MonstersAI("Monsters", enemy_visible=True)):
    ai.turn()
```

Output:

```text
--- Orcs
collected resources, now 150
built barracks
trained a grunt
orc scouts explore the map
--- Monsters
monsters attack the nearest unit
```

`attack()` is a default step that itself works like a small template method: it decides *when* to call `send_scouts()` or `send_warriors()`, and subclasses decide *how*. `MonstersAI` overrides a default step with an empty body. That is legitimate here, because "collecting nothing" is a valid behavior for this race, but this is also exactly the kind of override that can break expectations elsewhere.

### Exercise 3

```python
import csv
import io
import json
from collections.abc import Callable
from dataclasses import dataclass


@dataclass
class Sale:
    item: str
    amount: float


Parser = Callable[[str], list[Sale]]
Normalizer = Callable[[Sale], None]


def parse_csv(raw: str) -> list[Sale]:
    return [Sale(r["item"], float(r["amount"])) for r in csv.DictReader(io.StringIO(raw))]


def parse_json(raw: str) -> list[Sale]:
    return [Sale(d["item"], float(d["amount"])) for d in json.loads(raw)]


def lowercase_item(sale: Sale) -> None:
    sale.item = sale.item.strip().lower()


@dataclass
class Importer:
    """The same skeleton, but the steps are injected instead of inherited."""

    name: str
    parse: Parser
    normalize: Normalizer | None = None   # plays the role of the hook

    def run(self, raw: str) -> float:
        sales = self.parse(raw)
        valid = [sale for sale in sales if sale.amount > 0]
        if self.normalize is not None:
            for sale in valid:
                self.normalize(sale)
        total = sum(sale.amount for sale in valid)
        print(f"{self.name}: read {len(sales)}, saved {[s.item for s in valid]}, total {total:.2f}")
        return total


csv_data = "item,amount\nkeyboard,1200\nmouse,-5\ncable,150\n"
json_data = '[{"item": " Monitor ", "amount": 7300}, {"item": "Hub", "amount": 0}]'

Importer("csv", parse_csv).run(csv_data)
Importer("json", parse_json, normalize=lowercase_item).run(json_data)
```

Output:

```text
csv: read 3, saved ['keyboard', 'cable'], total 1350.00
json: read 2, saved ['monitor'], total 7300.00
```

**Gained:** no class hierarchy; parsers and normalizers can be combined freely (CSV with normalization needs no new class) and swapped at runtime; each function is trivial to test on its own. **Lost:** the "contract" is less visible. An ABC with `@abstractmethod` documents and enforces which steps exist, while here a wrong function signature is caught only by a type checker or at runtime. With many related steps that share data, a base class often reads better. This is the classic trade-off between Template Method (inheritance) and Strategy (composition).

---

*Sources: [Refactoring.Guru — Template Method](https://refactoring.guru/design-patterns/template-method), [Refactoring.Guru — Template Method in Python](https://refactoring.guru/design-patterns/template-method/python/example). Adapted and expanded for PyJourney.*
