# Abstract Factory

**Abstract Factory** is a creational design pattern for producing whole **families of related objects** without naming their concrete classes. You pick a family once, and every object you get afterwards is guaranteed to fit with the others. It is the tool for "these things must always match": UI widgets of one theme, furniture of one style, infrastructure services of one environment.

## What you'll learn

- How a family of products differs from a single product, and why mixing families is a real bug
- The roles of the pattern: Abstract Factory, Concrete Factory, Abstract Product, Concrete Product, Client
- A clean Python implementation with `abc.ABC` and type hints
- A practical example: swapping local and cloud infrastructure with one configuration value
- Why adding a new *variant* is cheap but adding a new *product type* is expensive
- How Abstract Factory relates to Factory Method, Builder, Prototype, Bridge and Facade

## Intent

Abstract Factory provides an interface with one creation method per product in a family (`create_chair()`, `create_sofa()`, ...). Each concrete factory implements that interface for one variant of the family. Client code receives a factory object and creates everything through it, so it depends neither on the concrete products nor on the concrete factory, and it cannot accidentally combine products from different variants.

## Problem

Imagine a furniture shop simulator. The code has:

1. A **family** of related products: `Chair`, `Sofa`, `CoffeeTable`.
2. Several **variants** of that family: `Modern`, `Victorian`, `ArtDeco`.

It helps to picture this as a matrix, where rows are product types and columns are variants:

| | Modern | Victorian | ArtDeco |
|---|---|---|---|
| **Chair** | `ModernChair` | `VictorianChair` | `ArtDecoChair` |
| **Sofa** | `ModernSofa` | `VictorianSofa` | `ArtDecoSofa` |
| **CoffeeTable** | `ModernCoffeeTable` | `VictorianCoffeeTable` | `ArtDecoCoffeeTable` |

Customers are very unhappy when a modern sofa arrives with Victorian chairs. Without a pattern, the choice of style is usually repeated wherever an item is created, and sooner or later two places disagree:

```python
class ModernChair:
    style = "modern"


class VictorianChair:
    style = "victorian"


class ModernSofa:
    style = "modern"


class VictorianSofa:
    style = "victorian"


def buy_chair(style: str):
    return ModernChair() if style == "modern" else VictorianChair()


def buy_sofa(style: str):
    # Written months later by someone else, with a different spelling.
    return ModernSofa() if style == "Modern" else VictorianSofa()


order = [buy_chair("modern"), buy_chair("modern"), buy_sofa("modern")]
print([item.style for item in order])
```

Output:

```text
['modern', 'modern', 'victorian']
```

There are two problems here. Nothing guarantees that items of one order match. And furniture vendors update their catalogues often: every new style means editing every `buy_*` function, which is exactly the core code you would rather leave alone.

## Solution

The pattern works in three steps:

1. **Declare an interface for each distinct product** of the family: `Chair`, `Sofa`, `CoffeeTable`. Every variant of a chair implements `Chair`, every variant of a sofa implements `Sofa`, and so on.
2. **Declare the Abstract Factory**: an interface with a creation method for every product in the family (`create_chair()`, `create_sofa()`, `create_coffee_table()`). These methods return the *abstract* product types.
3. **Create one concrete factory per variant.** `ModernFurnitureFactory` returns only modern items, `VictorianFurnitureFactory` only Victorian ones.

The client works only through the abstract interfaces. It asks the factory for a chair and gets "some `Chair`". It does not know whether the chair is modern or Victorian, and it does not need to: whatever variant it is, it matches the sofa that came from the *same factory object*.

Who decides which concrete factory to create? Usually the application does it **once, at start-up**, based on configuration or the environment, and then passes the factory object to the code that needs it.

## Real-world analogy

A car mechanic replacing a headlight and a bumper does not walk around the warehouse picking parts that look about right. They open the parts catalogue for the exact model and year of the car. The catalogue (the concrete factory) offers the same *kinds* of parts as every other catalogue: headlights, bumpers, mirrors. But all parts from one catalogue are guaranteed to fit the same car and each other. Switch to another car model and you open another catalogue, while the mechanic's procedure stays the same.

## Structure

```text
                      +----------------------------------+
     +--------------->|          <<interface>>           |
     |                |         AbstractFactory          |
     |                |----------------------------------|
     |                | + create_product_a(): ProductA   |
     |                | + create_product_b(): ProductB   |
     |                +----------------------------------+
     |                      ^                      ^
+---------+                 |      implements      |
| Client  |      +--------------------+  +--------------------+
+---------+      |  ConcreteFactory1  |  |  ConcreteFactory2  |
     |           |--------------------|  |--------------------|
     |           | -> ProductA1()     |  | -> ProductA2()     |
     |           | -> ProductB1()     |  | -> ProductB2()     |
     |           +--------------------+  +--------------------+
     |
     |  uses     +------------------------+      +------------------------+
     +---------->| <<interface>> ProductA |      | <<interface>> ProductB |
                 +------------------------+      +------------------------+
                     ^              ^                ^              ^
               +-----------+  +-----------+    +-----------+  +-----------+
               | ProductA1 |  | ProductA2 |    | ProductB1 |  | ProductB2 |
               +-----------+  +-----------+    +-----------+  +-----------+
                variant 1      variant 2        variant 1      variant 2
```

1. **Abstract Products** declare interfaces for the distinct but related products that make up a family.
2. **Concrete Products** implement the abstract products, grouped by variant. Each abstract product must be implemented in every variant.
3. **Abstract Factory** declares one creation method per abstract product.
4. **Concrete Factories** implement those methods for one variant and create only products of that variant.
5. **Client** works with factories and products only through the abstract interfaces. Although concrete factories instantiate concrete products, their methods are declared to return *abstract* products, so the client never couples to a variant.

## Python implementation

```python
from abc import ABC, abstractmethod


# Abstract products: one interface per product type.
class Chair(ABC):
    style: str

    @abstractmethod
    def sit_on(self) -> str: ...


class Sofa(ABC):
    style: str

    @abstractmethod
    def lie_on(self) -> str: ...

    def matches(self, chair: Chair) -> bool:
        # Products of one family can collaborate with each other.
        return self.style == chair.style


# Concrete products, grouped by variant.
class ModernChair(Chair):
    style = "modern"

    def sit_on(self) -> str:
        return "You sit on a minimalist chair with steel legs"


class ModernSofa(Sofa):
    style = "modern"

    def lie_on(self) -> str:
        return "You stretch out on a low grey modular sofa"


class VictorianChair(Chair):
    style = "victorian"

    def sit_on(self) -> str:
        return "You sit on a carved walnut chair with velvet padding"


class VictorianSofa(Sofa):
    style = "victorian"

    def lie_on(self) -> str:
        return "You sink into a tufted sofa with rolled arms"


# The abstract factory: one creation method per product type.
class FurnitureFactory(ABC):
    @abstractmethod
    def create_chair(self) -> Chair: ...

    @abstractmethod
    def create_sofa(self) -> Sofa: ...


# Concrete factories: one per variant.
class ModernFurnitureFactory(FurnitureFactory):
    def create_chair(self) -> Chair:
        return ModernChair()

    def create_sofa(self) -> Sofa:
        return ModernSofa()


class VictorianFurnitureFactory(FurnitureFactory):
    def create_chair(self) -> Chair:
        return VictorianChair()

    def create_sofa(self) -> Sofa:
        return VictorianSofa()


def furnish_living_room(factory: FurnitureFactory) -> None:
    # The client knows only the abstract factory and abstract products.
    chairs = [factory.create_chair() for _ in range(2)]
    sofa = factory.create_sofa()
    print(sofa.lie_on())
    print(chairs[0].sit_on())
    print("Set matches:", all(sofa.matches(chair) for chair in chairs))


for factory in (ModernFurnitureFactory(), VictorianFurnitureFactory()):
    print(f"--- {type(factory).__name__} ---")
    furnish_living_room(factory)
```

Output:

```text
--- ModernFurnitureFactory ---
You stretch out on a low grey modular sofa
You sit on a minimalist chair with steel legs
Set matches: True
--- VictorianFurnitureFactory ---
You sink into a tufted sofa with rolled arms
You sit on a carved walnut chair with velvet padding
Set matches: True
```

`furnish_living_room()` never mentions a concrete class. Give it another factory and the whole room changes style at once, consistently.

### A Pythonic variation: a family as data

When the factory methods only call constructors, a whole class per variant can feel heavy. In Python a family can simply be a record of classes:

```python
# Continues the previous example
from dataclasses import dataclass


@dataclass(frozen=True)
class FurnitureFamily:
    chair: type[Chair]
    sofa: type[Sofa]


FAMILIES = {
    "modern": FurnitureFamily(chair=ModernChair, sofa=ModernSofa),
    "victorian": FurnitureFamily(chair=VictorianChair, sofa=VictorianSofa),
}

family = FAMILIES["victorian"]
chair, sofa = family.chair(), family.sofa()
print(type(chair).__name__, type(sofa).__name__, sofa.matches(chair))
```

Output:

```text
VictorianChair VictorianSofa True
```

This keeps the key guarantee (one object hands out a matching set) with far less code. Prefer full factory classes when creating a product needs logic or configuration, as in the next example. A module can play the same role too: two modules with identical function names are two interchangeable "factories".

## A practical example: local vs cloud infrastructure

An online shop stores receipts and queues e-mail jobs. In production it uses cloud storage and a cloud queue. On a developer's laptop and in tests it should use in-memory versions. Mixing them, say a real cloud queue with in-memory storage, would send e-mails about receipts that were never saved. These services form a family, and the environment selects the variant.

```python
from abc import ABC, abstractmethod
from collections import deque


class Storage(ABC):
    @abstractmethod
    def save(self, key: str, data: str) -> str: ...


class TaskQueue(ABC):
    @abstractmethod
    def push(self, task: str) -> str: ...


class InfrastructureFactory(ABC):
    @abstractmethod
    def create_storage(self) -> Storage: ...

    @abstractmethod
    def create_queue(self) -> TaskQueue: ...


# Local family: everything in memory, ideal for development and tests.
class MemoryStorage(Storage):
    def __init__(self) -> None:
        self.files: dict[str, str] = {}

    def save(self, key: str, data: str) -> str:
        self.files[key] = data
        return f"memory://{key}"


class MemoryQueue(TaskQueue):
    def __init__(self) -> None:
        self.tasks: deque[str] = deque()

    def push(self, task: str) -> str:
        self.tasks.append(task)
        return f"queued locally ({len(self.tasks)} pending)"


class LocalFactory(InfrastructureFactory):
    def create_storage(self) -> Storage:
        return MemoryStorage()

    def create_queue(self) -> TaskQueue:
        return MemoryQueue()


# Cloud family: the same interfaces; network calls are simulated here.
class BucketStorage(Storage):
    def __init__(self, bucket: str) -> None:
        self.bucket = bucket

    def save(self, key: str, data: str) -> str:
        return f"https://{self.bucket}.storage.example.com/{key} ({len(data)} bytes)"


class CloudQueue(TaskQueue):
    def __init__(self, name: str) -> None:
        self.name = name

    def push(self, task: str) -> str:
        return f"sent to cloud queue '{self.name}'"


class CloudFactory(InfrastructureFactory):
    def __init__(self, region: str) -> None:
        self.region = region  # shared configuration for the whole family

    def create_storage(self) -> Storage:
        return BucketStorage(f"receipts-{self.region}")

    def create_queue(self) -> TaskQueue:
        return CloudQueue(f"emails-{self.region}")


class OrderService:
    """Client: depends only on the abstract factory and products."""

    def __init__(self, infra: InfrastructureFactory) -> None:
        self.storage = infra.create_storage()
        self.queue = infra.create_queue()

    def place_order(self, order_id: int, email: str) -> None:
        location = self.storage.save(f"receipt-{order_id}.txt", f"Order {order_id} paid")
        status = self.queue.push(f"email {email} about order {order_id}")
        print(f"order {order_id}: receipt at {location}; email {status}")


def make_infrastructure(config: dict[str, str]) -> InfrastructureFactory:
    # The only place that knows concrete factories: runs once at start-up.
    match config["env"]:
        case "local":
            return LocalFactory()
        case "cloud":
            return CloudFactory(region=config["region"])
        case other:
            raise ValueError(f"unknown environment: {other}")


for config in ({"env": "local"}, {"env": "cloud", "region": "eu-central"}):
    print(f"--- env={config['env']} ---")
    service = OrderService(make_infrastructure(config))
    service.place_order(1001, "olena@example.com")
    service.place_order(1002, "taras@example.com")
```

Output:

```text
--- env=local ---
order 1001: receipt at memory://receipt-1001.txt; email queued locally (1 pending)
order 1002: receipt at memory://receipt-1002.txt; email queued locally (2 pending)
--- env=cloud ---
order 1001: receipt at https://receipts-eu-central.storage.example.com/receipt-1001.txt (15 bytes); email sent to cloud queue 'emails-eu-central'
order 1002: receipt at https://receipts-eu-central.storage.example.com/receipt-1002.txt (15 bytes); email sent to cloud queue 'emails-eu-central'
```

Notice three things:

- `OrderService` is identical in both environments. Only `make_infrastructure()` knows the concrete classes, and it runs once.
- A concrete factory can carry **shared configuration** (`region`), so every product of the family is configured consistently.
- Tests get a whole consistent fake environment by passing `LocalFactory()`, and can inspect `service.storage.files` afterwards.

## When to use it

- **Your code must work with several families of related products, and must not depend on their concrete classes.** The classes may be unknown in advance, or you want room to add more variants later. As long as all creation goes through the factory interface, a product that does not match the others cannot appear.
- **A class has accumulated several factory methods that blur its main responsibility.** Extract them into a separate factory object. Each class should be responsible for one thing.
- **The choice of variant is a deployment decision** (operating system, theme, environment, database vendor, region) that should be made once and then respected everywhere.

## How to implement it

1. Map out the matrix of product types (rows) versus variants (columns).
2. Declare an abstract product interface for each product type, and make every concrete product implement its interface.
3. Declare the abstract factory with one creation method per abstract product, each returning the abstract type.
4. Implement one concrete factory class per variant.
5. Write initialization code that picks a concrete factory from configuration or the environment. Pass that factory object to every class that creates products.
6. Find all direct calls to product constructors in the client code and replace them with calls to the matching creation method on the factory.

## Pros and cons

| Pros | Cons |
|---|---|
| Products from one factory are guaranteed to be compatible. | Many new interfaces and classes: one per product per variant. |
| Client code is decoupled from concrete products and factories. | Adding a new *product type* means changing the abstract factory and **every** concrete factory. |
| *Single Responsibility Principle*: product creation lives in one place. | Overkill when there is only one product type or only one variant. |
| *Open/Closed Principle*: new variants are added without touching client code. | The indirection makes it harder to see which classes are actually used. |

## Relations with other patterns

- Many designs start with **Factory Method** and evolve towards **Abstract Factory**, **Prototype** or **Builder** as they need more flexibility.
- Abstract Factory classes are often a set of **factory methods**. They can also be built from **Prototypes**: the factory stores sample objects and clones them instead of instantiating classes.
- **Builder** constructs one complex object step by step. Abstract Factory creates *families* of objects and returns each product immediately.
- Abstract Factory can replace **Facade** when all you want is to hide how subsystem objects are created.
- With **Bridge**: when some abstractions work only with particular implementations, an abstract factory can encapsulate those pairings and hide them from the client.
- Concrete factories are often **Singletons**: an application usually needs only one factory per variant. In Python that is typically just one module-level instance.

## Common mistakes

- **Mixing products from different factories.** The guarantee holds only if all products of a set come from the *same factory object*. Pass the factory around, not loose products created elsewhere.
- **Choosing the factory deep inside business logic.** Writing `ModernFurnitureFactory()` in the middle of a method brings back the coupling the pattern was supposed to remove. Pick the factory once, at the edge of the application, and inject it.
- **One generic `create(kind: str)` method instead of one method per product.** It looks shorter, but it loses type information (every result is "some object"), hides typos until runtime, and quietly turns the pattern back into an `if/elif` ladder.
- **Using it when there is only one product type.** Then you do not have a family. A factory method or a plain callable is enough.
- **Underestimating new product types.** Adding a column (variant) is cheap. Adding a row (product type) touches every factory. Thanks to `@abstractmethod`, Python at least refuses to instantiate a factory you forgot to update, as Exercise 3 shows.

## Summary

- Abstract Factory creates *families* of related products through one interface with a method per product type.
- Each concrete factory corresponds to one variant and returns only products of that variant, so products always match.
- The client depends only on the abstract factory and the abstract products. The concrete factory is chosen once, usually at start-up.
- In Python, model products and factories with `ABC` (or `Protocol`). For simple cases, a frozen dataclass or a module holding the classes of one family works as a lightweight factory.
- A concrete factory is a good place for configuration shared by the whole family.
- Variants are cheap to add, product types are expensive. Choose the pattern when variants change more often than product types.

## Practice

### Exercise 1: UI themes

Create abstract products `Button` (`render(label: str) -> str`) and `Checkbox` (`render(label: str, checked: bool) -> str`) and an abstract factory `ThemeFactory`.

- The **light** theme renders a button as `[ Save ]` and a checkbox as `[x] Remember me` or `[ ] Remember me`.
- The **dark** theme renders a button as `<< Save >>` and a checkbox as `(*) Remember me` or `( ) Remember me`.

Write a client function `render_login_form(factory)` that prints one button and two checkboxes (one checked, one not), and call it with both factories.

### Exercise 2: Document renderers

A report must be produced as HTML or as Markdown. The family consists of `Heading`, `Paragraph` and `BulletList` (each with `render(...) -> str`). Implement `HtmlFactory` and `MarkdownFactory`, and a client `render_document(factory, title, intro, items)` that returns the full document as a string. The client must not contain a single `if` about the format.

### Exercise 3: A new product type

Extend your solution to Exercise 1 with a third product, `TextField` (`render(placeholder: str) -> str`): light renders `[____ email ____]`, dark renders `{.... email ....}`.

First add only the abstract method `create_text_field()` to `ThemeFactory` and implement it in the light factory. Try to create the dark factory and print the error. Then finish the dark theme and render a form with all three widgets.

## Solutions

### Exercise 1

```python
from abc import ABC, abstractmethod


class Button(ABC):
    @abstractmethod
    def render(self, label: str) -> str: ...


class Checkbox(ABC):
    @abstractmethod
    def render(self, label: str, checked: bool) -> str: ...


class ThemeFactory(ABC):
    @abstractmethod
    def create_button(self) -> Button: ...

    @abstractmethod
    def create_checkbox(self) -> Checkbox: ...


class LightButton(Button):
    def render(self, label: str) -> str:
        return f"[ {label} ]"


class LightCheckbox(Checkbox):
    def render(self, label: str, checked: bool) -> str:
        return f"[{'x' if checked else ' '}] {label}"


class DarkButton(Button):
    def render(self, label: str) -> str:
        return f"<< {label} >>"


class DarkCheckbox(Checkbox):
    def render(self, label: str, checked: bool) -> str:
        return f"({'*' if checked else ' '}) {label}"


class LightThemeFactory(ThemeFactory):
    def create_button(self) -> Button:
        return LightButton()

    def create_checkbox(self) -> Checkbox:
        return LightCheckbox()


class DarkThemeFactory(ThemeFactory):
    def create_button(self) -> Button:
        return DarkButton()

    def create_checkbox(self) -> Checkbox:
        return DarkCheckbox()


def render_login_form(factory: ThemeFactory) -> None:
    checkbox = factory.create_checkbox()
    print(checkbox.render("Remember me", checked=True))
    print(checkbox.render("Subscribe to news", checked=False))
    print(factory.create_button().render("Log in"))


for theme in (LightThemeFactory(), DarkThemeFactory()):
    print(f"--- {type(theme).__name__} ---")
    render_login_form(theme)
```

Output:

```text
--- LightThemeFactory ---
[x] Remember me
[ ] Subscribe to news
[ Log in ]
--- DarkThemeFactory ---
(*) Remember me
( ) Subscribe to news
<< Log in >>
```

### Exercise 2

```python
from abc import ABC, abstractmethod


class Heading(ABC):
    @abstractmethod
    def render(self, text: str) -> str: ...


class Paragraph(ABC):
    @abstractmethod
    def render(self, text: str) -> str: ...


class BulletList(ABC):
    @abstractmethod
    def render(self, items: list[str]) -> str: ...


class DocumentFactory(ABC):
    @abstractmethod
    def create_heading(self) -> Heading: ...

    @abstractmethod
    def create_paragraph(self) -> Paragraph: ...

    @abstractmethod
    def create_list(self) -> BulletList: ...


class HtmlHeading(Heading):
    def render(self, text: str) -> str:
        return f"<h1>{text}</h1>"


class HtmlParagraph(Paragraph):
    def render(self, text: str) -> str:
        return f"<p>{text}</p>"


class HtmlList(BulletList):
    def render(self, items: list[str]) -> str:
        lines = "".join(f"<li>{item}</li>" for item in items)
        return f"<ul>{lines}</ul>"


class MarkdownHeading(Heading):
    def render(self, text: str) -> str:
        return f"# {text}"


class MarkdownParagraph(Paragraph):
    def render(self, text: str) -> str:
        return text


class MarkdownList(BulletList):
    def render(self, items: list[str]) -> str:
        return "\n".join(f"- {item}" for item in items)


class HtmlFactory(DocumentFactory):
    def create_heading(self) -> Heading:
        return HtmlHeading()

    def create_paragraph(self) -> Paragraph:
        return HtmlParagraph()

    def create_list(self) -> BulletList:
        return HtmlList()


class MarkdownFactory(DocumentFactory):
    def create_heading(self) -> Heading:
        return MarkdownHeading()

    def create_paragraph(self) -> Paragraph:
        return MarkdownParagraph()

    def create_list(self) -> BulletList:
        return MarkdownList()


def render_document(factory: DocumentFactory, title: str, intro: str, items: list[str]) -> str:
    parts = [
        factory.create_heading().render(title),
        factory.create_paragraph().render(intro),
        factory.create_list().render(items),
    ]
    return "\n".join(parts)


items = ["Revenue up 12%", "Two new stores", "Churn down to 3%"]
for factory in (HtmlFactory(), MarkdownFactory()):
    print(render_document(factory, "Q3 report", "Highlights of the quarter:", items))
    print()
```

Output:

```text
<h1>Q3 report</h1>
<p>Highlights of the quarter:</p>
<ul><li>Revenue up 12%</li><li>Two new stores</li><li>Churn down to 3%</li></ul>

# Q3 report
Highlights of the quarter:
- Revenue up 12%
- Two new stores
- Churn down to 3%
```

### Exercise 3

```python
from abc import ABC, abstractmethod


class Button(ABC):
    @abstractmethod
    def render(self, label: str) -> str: ...


class Checkbox(ABC):
    @abstractmethod
    def render(self, label: str, checked: bool) -> str: ...


class TextField(ABC):
    @abstractmethod
    def render(self, placeholder: str) -> str: ...


class ThemeFactory(ABC):
    @abstractmethod
    def create_button(self) -> Button: ...

    @abstractmethod
    def create_checkbox(self) -> Checkbox: ...

    @abstractmethod
    def create_text_field(self) -> TextField: ...  # the new product type


class LightButton(Button):
    def render(self, label: str) -> str:
        return f"[ {label} ]"


class LightCheckbox(Checkbox):
    def render(self, label: str, checked: bool) -> str:
        return f"[{'x' if checked else ' '}] {label}"


class LightTextField(TextField):
    def render(self, placeholder: str) -> str:
        return f"[____ {placeholder} ____]"


class DarkButton(Button):
    def render(self, label: str) -> str:
        return f"<< {label} >>"


class DarkCheckbox(Checkbox):
    def render(self, label: str, checked: bool) -> str:
        return f"({'*' if checked else ' '}) {label}"


class LightThemeFactory(ThemeFactory):
    def create_button(self) -> Button:
        return LightButton()

    def create_checkbox(self) -> Checkbox:
        return LightCheckbox()

    def create_text_field(self) -> TextField:
        return LightTextField()


class DarkThemeFactory(ThemeFactory):  # not updated yet
    def create_button(self) -> Button:
        return DarkButton()

    def create_checkbox(self) -> Checkbox:
        return DarkCheckbox()


try:
    DarkThemeFactory()
except TypeError as error:
    print("TypeError:", error)


# Step 2: finish the dark family.
class DarkTextField(TextField):
    def render(self, placeholder: str) -> str:
        return f"{{.... {placeholder} ....}}"


class CompleteDarkThemeFactory(DarkThemeFactory):
    def create_text_field(self) -> TextField:
        return DarkTextField()


for theme in (LightThemeFactory(), CompleteDarkThemeFactory()):
    print(theme.create_text_field().render("email"))
    print(theme.create_checkbox().render("Remember me", checked=True))
    print(theme.create_button().render("Sign up"))
```

Output:

```text
TypeError: Can't instantiate abstract class DarkThemeFactory without an implementation for abstract method 'create_text_field'
[____ email ____]
[x] Remember me
[ Sign up ]
{.... email ....}
(*) Remember me
<< Sign up >>
```

In real code you would simply add the method to `DarkThemeFactory` itself; the subclass here only keeps both steps visible in one script. The lesson: one new product type forced a change in **every** factory, while a new theme (variant) would not have touched any existing class. The doubled braces in `f"{{.... {placeholder} ....}}"` produce literal `{` and `}` in an f-string.

---

*Sources: [Refactoring.Guru — Abstract Factory](https://refactoring.guru/design-patterns/abstract-factory), [Refactoring.Guru — Abstract Factory in Python](https://refactoring.guru/design-patterns/abstract-factory/python/example). Adapted and expanded for PyJourney.*
