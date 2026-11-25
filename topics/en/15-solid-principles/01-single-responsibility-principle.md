# Single Responsibility Principle

The Single Responsibility Principle (SRP) says that a class, module or function should have **one reason to change**. It is the "S" in SOLID, and it is the principle that most directly decides how you cut a program into pieces. Code that follows it is easier to read, test and change without breaking something unrelated.

## What you'll learn

- What SOLID is and what each of its five letters stands for
- What "one responsibility" really means (hint: not "one method")
- How to spot a class or function that has more than one reason to change
- How to refactor a violating class step by step, with "before" and "after" code
- How to keep a convenient API after splitting (the facade idea) and what it costs
- When applying SRP goes too far

## SOLID at a glance

SOLID is a set of five object-oriented design principles collected by Robert C. Martin ("Uncle Bob") around 2000. The acronym itself was coined a few years later by Michael Feathers.

| Letter | Principle | Short version |
|---|---|---|
| S | Single Responsibility | One reason to change |
| O | Open–Closed | Add behaviour without editing existing code |
| L | Liskov Substitution | A subclass must work wherever its parent works |
| I | Interface Segregation | Small, focused interfaces |
| D | Dependency Inversion | Depend on abstractions, not on concrete details |

The principles are guidelines, not laws. They all aim at the same goal: code where a change in one place does not ripple through the rest of the system.

## What "one responsibility" means

A common misreading is "a class should do only one thing" or "have only one method". That is not the point. A `Person` class can have ten methods and still have a single responsibility.

The useful question is: **who or what would force this code to change?** Robert Martin later rephrased the principle as *"a module should be responsible to one, and only one, actor"*. An *actor* is a group of people or a source of requirements: the accounting department, the designers of a printed report, the database administrators, an external API you integrate with.

If two different actors can independently ask you to change the same class, that class has two responsibilities. Sooner or later, a change requested by one actor will break something the other actor relies on.

SRP is closely related to **cohesion**: everything inside a unit should belong together and change together. High cohesion inside a unit and few dependencies between units is what makes code easy to change.

## Before: a class with two jobs

Here is a small `Person` class that also knows how to save itself:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"

    def save(self):
        # Pretend this talks to a real database
        print(f"Save {self} to the database")


if __name__ == "__main__":
    p = Person("John Doe")
    p.save()
```

Output:

```text
Save Person(name='John Doe') to the database
```

The class has two jobs:

1. **Represent a person**: hold the name and other personal data, and maybe validate it.
2. **Persist a person**: know about the database, the connection, the SQL, the table layout.

These two jobs change for different reasons. A new rule such as "a name must not be empty" belongs to the first job. A move from PostgreSQL to a JSON file or a REST API belongs to the second. With both jobs in one class, every storage change means editing `Person`, retesting `Person`, and possibly breaking code that only cares about names.

> **Note:** Some tutorials write `save()` as a `@classmethod` that receives a person (`Person.save(p)`). The problem is the same: storage logic lives inside the class that describes the data.

## After: one class per responsibility

Move the storage code into its own class:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"


class PersonDB:
    def save(self, person):
        print(f"Save {person} to the database")


if __name__ == "__main__":
    p = Person("John Doe")

    db = PersonDB()
    db.save(p)
```

Output:

```text
Save Person(name='John Doe') to the database
```

Now:

- `Person` is responsible for the person's data. It does not know that databases exist.
- `PersonDB` is responsible for storing people. It is the only place that changes when storage changes.

If you later need to save people to a file, you write a new class (say, `PersonFile`) and leave `Person` alone. You can also test `Person` without any database at all.

The rule of thumb is: **put together the things that change for the same reason, and separate the things that change for different reasons.**

## A more realistic example

Real violations are rarely as obvious as `Person.save()`. They grow one method at a time. Here is an invoice that calculates, formats and serialises itself:

```python
import json


class Invoice:
    def __init__(self, customer, items):
        self.customer = customer
        self.items = items  # list of (description, price, quantity)

    def total(self):
        return sum(price * quantity for _, price, quantity in self.items)

    def to_text(self):
        lines = [f"Invoice for {self.customer}"]
        for description, price, quantity in self.items:
            lines.append(f"  {description:<10}{quantity:>3} x {price:>6.2f}")
        lines.append(f"  {'TOTAL':<10}{self.total():>12.2f}")
        return "\n".join(lines)

    def to_json(self):
        return json.dumps({"customer": self.customer, "items": self.items})


invoice = Invoice("Olena", [("Keyboard", 49.90, 1), ("Cable", 5.00, 3)])
print(invoice.to_text())
print(invoice.to_json())
```

Output:

```text
Invoice for Olena
  Keyboard    1 x  49.90
  Cable       3 x   5.00
  TOTAL            64.90
{"customer": "Olena", "items": [["Keyboard", 49.9, 1], ["Cable", 5.0, 3]]}
```

Three different actors can request changes here:

- **Accounting**: "add VAT to the total" changes `total()`.
- **Whoever designs the printed invoice**: "align the columns differently" changes `to_text()`.
- **Whoever owns storage or integrations**: "store items as objects, not arrays" changes `to_json()`.

The refactored version gives each actor its own class:

```python
import json
from dataclasses import asdict, dataclass, field


@dataclass
class LineItem:
    description: str
    price: float
    quantity: int


@dataclass
class Invoice:
    """Business data and business rules only."""
    customer: str
    items: list[LineItem] = field(default_factory=list)

    def total(self):
        return sum(item.price * item.quantity for item in self.items)


class InvoiceTextFormatter:
    """Knows how an invoice looks on paper."""

    def format(self, invoice):
        lines = [f"Invoice for {invoice.customer}"]
        for item in invoice.items:
            lines.append(
                f"  {item.description:<10}{item.quantity:>3} x {item.price:>6.2f}"
            )
        lines.append(f"  {'TOTAL':<10}{invoice.total():>12.2f}")
        return "\n".join(lines)


class InvoiceJsonSerializer:
    """Knows how an invoice is stored."""

    def dumps(self, invoice):
        return json.dumps(asdict(invoice))


invoice = Invoice(
    "Olena",
    [LineItem("Keyboard", 49.90, 1), LineItem("Cable", 5.00, 3)],
)
print(InvoiceTextFormatter().format(invoice))
print(InvoiceJsonSerializer().dumps(invoice))
```

Output:

```text
Invoice for Olena
  Keyboard    1 x  49.90
  Cable       3 x   5.00
  TOTAL            64.90
{"customer": "Olena", "items": [{"description": "Keyboard", "price": 49.9, "quantity": 1}, {"description": "Cable", "price": 5.0, "quantity": 3}]}
```

Notice that `total()` stayed in `Invoice`. Calculating the total is a business rule about invoices, so it belongs with the invoice data. SRP is not about stripping classes down to bare data; it is about not mixing *unrelated* reasons to change.

> **Tip:** Real money code should use `decimal.Decimal` instead of `float` to avoid rounding errors. Floats are used here only to keep the example short.

## SRP for functions

The principle applies to functions too. This function parses input, does the arithmetic and prints the result:

```python
def print_expense_report(csv_text):
    total = 0.0
    for line in csv_text.strip().splitlines():
        category, amount = line.split(",")
        total += float(amount)
    print(f"Total expenses: {total:.2f}")


print_expense_report("food,12.50\ntaxi,7.25\nbooks,30")
```

Output:

```text
Total expenses: 49.75
```

It works, but you cannot test the parsing without capturing `print()` output, and you cannot reuse the formatting for a different data source. Split it into small functions, each with one reason to change:

```python
def parse_amounts(csv_text):
    """Parsing: changes when the input format changes."""
    amounts = []
    for line in csv_text.strip().splitlines():
        _category, amount = line.split(",")
        amounts.append(float(amount))
    return amounts


def format_total(total):
    """Presentation: changes when the report layout changes."""
    return f"Total expenses: {total:.2f}"


def print_expense_report(csv_text):
    """Coordination only: glue the small pieces together."""
    print(format_total(sum(parse_amounts(csv_text))))


print_expense_report("food,12.50\ntaxi,7.25\nbooks,30")
print(parse_amounts("a,1\nb,2.5"))
print(format_total(0))
```

Output:

```text
Total expenses: 49.75
[1.0, 2.5]
Total expenses: 0.00
```

`parse_amounts()` and `format_total()` are pure functions: they take input and return output, with no side effects. That makes them trivial to test. The top-level function only coordinates.

> **Tip:** In Python, a responsibility does not have to be a class. A module-level function is often the simplest home for a single job.

## Keeping a convenient API: the facade

After splitting, callers have to work with several objects instead of one. A **facade** hides this behind a single entry point. One simple way is to let `Person` delegate to `PersonDB`:

```python
class PersonDB:
    def save(self, person):
        print(f"Save {person} to the database")


class Person:
    def __init__(self, name):
        self.name = name
        self.db = PersonDB()

    def __repr__(self):
        return f"Person(name={self.name!r})"

    def save(self):
        self.db.save(self)


if __name__ == "__main__":
    p = Person("John Doe")
    p.save()
```

Output:

```text
Save Person(name='John Doe') to the database
```

The storage *logic* still lives in `PersonDB`, so switching databases does not touch `Person`'s code. But look at the trade-off: `Person` now creates a `PersonDB` itself. Every `Person` is hard-wired to that one storage, you cannot create a `Person` in a test without also creating a `PersonDB`, and changing storage to a file still means editing `Person.__init__`. The coupling we removed has partly come back.

A cleaner facade sits *next to* the classes it coordinates and receives the storage from outside:

```python
class PersonDB:
    def save(self, person):
        print(f"Save {person} to the database")


class PersonFile:
    def save(self, person):
        print(f"Save {person} to a file")


class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"


class PersonService:
    """A facade for the rest of the application."""

    def __init__(self, storage):
        self.storage = storage

    def register(self, name):
        person = Person(name)
        self.storage.save(person)
        return person


service = PersonService(PersonDB())
service.register("John Doe")

service = PersonService(PersonFile())
service.register("Jane Doe")
```

Output:

```text
Save Person(name='John Doe') to the database
Save Person(name='Jane Doe') to a file
```

`Person` knows nothing about storage, `PersonDB` and `PersonFile` know nothing about registration, and `PersonService` only coordinates. Passing the storage in from outside is called **dependency injection**. It is the core idea of the Dependency Inversion Principle, the "D" in SOLID.

## How to spot a violation

- You need the word **"and"** to describe the class: "it stores users *and* sends emails *and* builds reports".
- The name is vague: `Manager`, `Helper`, `Utils`, `Processor`, `Handler` with no clear subject.
- Groups of methods use **disjoint sets of attributes**. If half the methods touch `self.items` and the other half touch `self.connection`, you are looking at two classes.
- The imports at the top of the module come from unrelated worlds: `sqlite3`, `smtplib`, `json`, `tkinter`.
- Unrelated change requests keep landing in the **same file**, and merge conflicts happen there often.
- Testing a simple calculation requires mocking a database, network or file system.

## Trade-offs: when SRP goes too far

SRP has costs, and splitting is not always a win.

- **More pieces, more indirection.** Every extra class is another name to learn and another file to open. Ten one-line classes can be harder to follow than one cohesive 50-line class.
- **Splitting the wrong way is worse than not splitting.** If two pieces always change together, separating them only means every change touches two places (sometimes called *shotgun surgery*).
- **Responsibilities are a judgment call.** "Format a report" can be one responsibility in a small script and three (layout, localisation, export) in a large product. Split when a second reason to change actually appears or is clearly coming, not "just in case".

A good default: start simple, notice when a class begins to change for two different reasons, and split it then.

## Common mistakes

- **Reading SRP as "one method per class".** A class can have many methods that all serve one purpose. The test is the number of reasons to change, not the number of methods.
- **Moving logic to a facade that creates its own dependencies.** `self.db = PersonDB()` inside `Person` reintroduces the coupling you tried to remove. Prefer passing dependencies in.
- **Creating "god classes".** A `UserManager` that validates, stores, emails, logs and renders users is the classic violation. It grows until nobody dares to touch it.
- **Over-splitting.** Creating `NameValidator`, `NameNormalizer` and `NameStorage` for a 20-line script adds structure without adding value.
- **Mixing I/O into logic.** A function that both computes something and prints or writes it cannot be reused or tested easily. Return values from logic and do I/O at the edges.

## Summary

- SOLID is a set of five design principles; SRP is the "S".
- SRP: a class, module or function should have one reason to change, that is, it should answer to one actor.
- "One responsibility" does not mean "one method". It means high cohesion: things that change together stay together.
- Separate business data and rules from presentation, persistence and other infrastructure.
- Small pure functions are a natural way to apply SRP in Python.
- A facade restores a convenient API after splitting; let it receive its dependencies instead of creating them.
- Do not over-split: split when a real second reason to change appears.

## Practice

### Exercise 1: Find the reasons to change

List every reason this class might change and who would ask for it. Then split the class so that each piece has one reason to change, and show that it produces the same output.

```python
class Order:
    def __init__(self, customer, amounts):
        self.customer = customer
        self.amounts = amounts

    def total(self):
        return sum(self.amounts)

    def total_with_discount(self):
        total = self.total()
        return total * 0.9 if total > 100 else total

    def email_text(self):
        return f"Dear {self.customer}, you owe {self.total_with_discount():.2f} UAH."

    def to_csv_row(self):
        return f"{self.customer},{self.total():.2f}"


order = Order("Taras", [80, 40])
print(order.email_text())
print(order.to_csv_row())
```

Output:

```text
Dear Taras, you owe 108.00 UAH.
Taras,120.00
```

### Exercise 2: Split a function

Refactor `summarize_orders()` into three single-purpose functions, `parse_orders(text)`, `active_orders(orders)` and `format_order(order)`, plus a short `summarize_orders()` that composes them. Prove that the new version returns exactly the same string as the old one.

```python
def summarize_orders(text):
    result = []
    for line in text.strip().splitlines():
        item, qty, price = line.split(";")
        qty = int(qty)
        if qty == 0:
            continue
        price = float(price)
        result.append(f"{item}: {qty} x {price:.2f} = {qty * price:.2f}")
    return "\n".join(result)


data = """
apple;3;0.5
pear;0;0.8
melon;1;2.75
"""
print(summarize_orders(data))
```

Output:

```text
apple: 3 x 0.50 = 1.50
melon: 1 x 2.75 = 2.75
```

### Exercise 3: Add a format without touching the data class

Move the CSV formatting out of `Report` into a `CsvReportFormatter` class. Then add a `MarkdownReportFormatter` that renders a one-row Markdown table, **without** changing `Report` again.

```python
class Report:
    def __init__(self, title, scores):
        self.title = title
        self.scores = scores

    def average(self):
        return sum(self.scores) / len(self.scores)

    def to_csv(self):
        return f"title,average\n{self.title},{self.average():.1f}"


print(Report("Week 1", [4, 5, 3]).to_csv())
```

Output:

```text
title,average
Week 1,4.0
```

## Solutions

### Exercise 1

Reasons to change:

- **The order data** (customer, amounts, how the total is summed): the core domain.
- **The discount rule** ("10% off above 100"): marketing or sales.
- **The email wording**: customer support or communications.
- **The CSV layout**: accounting or whoever imports the file.

```python
class Order:
    def __init__(self, customer, amounts):
        self.customer = customer
        self.amounts = amounts

    def total(self):
        return sum(self.amounts)


class DiscountPolicy:
    def apply(self, total):
        return total * 0.9 if total > 100 else total


class OrderEmailComposer:
    def compose(self, order, amount_due):
        return f"Dear {order.customer}, you owe {amount_due:.2f} UAH."


class OrderCsvExporter:
    def to_row(self, order):
        return f"{order.customer},{order.total():.2f}"


order = Order("Taras", [80, 40])
due = DiscountPolicy().apply(order.total())
print(OrderEmailComposer().compose(order, due))
print(OrderCsvExporter().to_row(order))
```

Output:

```text
Dear Taras, you owe 108.00 UAH.
Taras,120.00
```

`OrderEmailComposer` receives the amount due instead of computing it, so a new discount rule never touches the email code.

### Exercise 2

```python
def summarize_orders_old(text):
    result = []
    for line in text.strip().splitlines():
        item, qty, price = line.split(";")
        qty = int(qty)
        if qty == 0:
            continue
        price = float(price)
        result.append(f"{item}: {qty} x {price:.2f} = {qty * price:.2f}")
    return "\n".join(result)


def parse_orders(text):
    orders = []
    for line in text.strip().splitlines():
        item, qty, price = line.split(";")
        orders.append((item, int(qty), float(price)))
    return orders


def active_orders(orders):
    return [order for order in orders if order[1] > 0]


def format_order(order):
    item, qty, price = order
    return f"{item}: {qty} x {price:.2f} = {qty * price:.2f}"


def summarize_orders(text):
    return "\n".join(format_order(o) for o in active_orders(parse_orders(text)))


data = """
apple;3;0.5
pear;0;0.8
melon;1;2.75
"""
print(summarize_orders(data))
print(summarize_orders(data) == summarize_orders_old(data))
print(active_orders([("x", 0, 1.0), ("y", 2, 1.0)]))
```

Output:

```text
apple: 3 x 0.50 = 1.50
melon: 1 x 2.75 = 2.75
True
[('y', 2, 1.0)]
```

Each small function can now be tested on its own, as the last line shows for `active_orders()`.

### Exercise 3

```python
class Report:
    def __init__(self, title, scores):
        self.title = title
        self.scores = scores

    def average(self):
        return sum(self.scores) / len(self.scores)


class CsvReportFormatter:
    def format(self, report):
        return f"title,average\n{report.title},{report.average():.1f}"


class MarkdownReportFormatter:
    def format(self, report):
        return (
            "| title | average |\n"
            "|---|---|\n"
            f"| {report.title} | {report.average():.1f} |"
        )


report = Report("Week 1", [4, 5, 3])
print(CsvReportFormatter().format(report))
print(MarkdownReportFormatter().format(report))
```

Output:

```text
title,average
Week 1,4.0
| title | average |
|---|---|
| Week 1 | 4.0 |
```

Adding the Markdown format required a new class only. `Report` stayed untouched, which is exactly what the next principle, Open–Closed, is about.

---

*Source: [pythontutorial.net — Python Single Responsibility Principle](https://www.pythontutorial.net/python-oop/python-single-responsibility-principle/). Adapted and expanded for PyJourney.*
