# Strategy/State

**Strategy** and **State** are two behavioral patterns with almost the same class diagram: an object delegates part of its work to a replaceable helper object. The difference is *who* replaces the helper and *why*. Strategy lets the client choose **how** a task is done. State lets an object change its own behavior as its **situation** changes, as if it switched to a different class.

## What you'll learn

- How Strategy removes long `if/elif` chains that select an algorithm
- The Pythonic form of Strategy: plain functions, `functools.partial` and a registry dict
- How State turns a status field with conditionals into a set of state classes
- When a simple `Enum` plus a transition table is enough instead of the State pattern
- How to tell Strategy and State apart and choose between them
- Typical mistakes with both patterns

## Strategy

### Intent

**Strategy** defines a family of interchangeable algorithms, puts each into its own object, and lets the code that uses them (the **context**) work with any of them through one common interface. The algorithm can be chosen and replaced at runtime without changing the context.

### Problem

An online shop calculates shipping costs. The first version only had a standard courier, then express delivery arrived, then pickup points, then a partner courier with a flat rate. The calculation grew into one function:

```python
def shipping_cost(order, method: str) -> float:
    if method == "standard":
        return 0.0 if order.subtotal >= 1000 else 70.0
    elif method == "express":
        return 150.0 + 20.0 * order.weight_kg
    elif method == "pickup":
        return 0.0
    # every new carrier adds one more branch here...
    raise ValueError(f"unknown shipping method: {method}")
```

Every new carrier or rule change edits the same function. A bug fix for express delivery risks breaking the standard one, tests for all methods live together, and two developers adding two carriers get merge conflicts in the same lines. Real formulas are longer than one line, so this function quickly becomes hundreds of lines long.

### Solution

Extract each variant of the algorithm into a separate **strategy** with the same interface, for example a `cost(order)` method. The original class becomes the **context**: it stores a reference to one strategy and calls it whenever it needs the result.

The context does not pick the strategy. The client (UI, configuration, tests) passes the desired strategy in, and can replace it later. Since the context talks to every strategy through the same interface, new algorithms can be added without touching the context or the other strategies.

### Real-world analogy

At a shop's checkout the cashier says: "450 hryvnias, please." You can pay with cash, a bank card or a phone. Each payment method works differently inside, but the cashier does not care which one you pick, as long as the purchase gets paid. The payment methods are strategies, the cashier is the context, and you, the client, choose the strategy depending on what is in your pocket.

### Structure

```text
 Client: picks a strategy and passes it to the context
    |
    v
+------------------------------+     +--------------------------+
| Context (Checkout)           |     | <<Protocol>>             |
|------------------------------|     | ShippingStrategy         |
| - shipping: ShippingStrategy o---->|--------------------------|
|------------------------------|     | + cost(order) -> float   |
| + total(order):              |     +--------------------------+
|     shipping.cost(order)     |         ^         ^         ^
+------------------------------+         :         :         :
                                  Standard   Express   PickupPoint
                                  Shipping   Shipping
```

1. **Context** keeps a reference to a strategy and talks to it only through the strategy interface.
2. **Strategy** interface declares the method the context calls to run the algorithm.
3. **Concrete strategies** implement different variants of the algorithm.
4. The context calls the strategy each time it needs the algorithm. It does not know which concrete strategy it holds.
5. **Client** creates a concrete strategy and hands it to the context. It can replace the strategy at runtime.

### Python implementation

```python
from dataclasses import dataclass
from typing import Protocol


@dataclass
class Order:
    subtotal: float
    weight_kg: float


class ShippingStrategy(Protocol):
    def cost(self, order: Order) -> float: ...


class StandardShipping:
    def cost(self, order: Order) -> float:
        return 0.0 if order.subtotal >= 1000 else 70.0


class ExpressShipping:
    def cost(self, order: Order) -> float:
        return 150.0 + 20.0 * order.weight_kg


class PickupPoint:
    def cost(self, order: Order) -> float:
        return 0.0


class Checkout:
    """Context: knows WHEN shipping is needed, not HOW it is calculated."""

    def __init__(self, shipping: ShippingStrategy) -> None:
        self.shipping = shipping  # can be replaced at any time

    def total(self, order: Order) -> float:
        return order.subtotal + self.shipping.cost(order)


order = Order(subtotal=850, weight_kg=2.5)
checkout = Checkout(StandardShipping())
print("standard:", checkout.total(order))

for strategy in (ExpressShipping(), PickupPoint()):
    checkout.shipping = strategy  # swap the algorithm at runtime
    print(f"{type(strategy).__name__}:", checkout.total(order))
```

Output:

```text
standard: 920.0
ExpressShipping: 1050.0
PickupPoint: 850.0
```

The strategy is a plain public attribute. Java-style code would add `set_strategy()` or a property, but in Python you only need a property if assigning a strategy must also do something extra (validation, logging). The strategies do not inherit from `ShippingStrategy`: the `Protocol` describes the required shape, and a type checker verifies that each class matches it.

### Strategy as a plain function

When a strategy is a single operation without state, a class with one method is just a function wearing a costume. Python functions are first-class objects, so you can pass them around exactly like strategy objects:

```python
from collections.abc import Callable
from dataclasses import dataclass
from functools import partial


@dataclass
class Order:
    subtotal: float
    weight_kg: float


ShippingFn = Callable[[Order], float]


def standard(order: Order) -> float:
    return 0.0 if order.subtotal >= 1000 else 70.0


def express(order: Order) -> float:
    return 150.0 + 20.0 * order.weight_kg


def flat_rate(order: Order, *, price: float) -> float:
    return price


SHIPPING: dict[str, ShippingFn] = {
    "standard": standard,
    "express": express,
    "pickup": lambda order: 0.0,
    "courier": partial(flat_rate, price=120.0),  # a configured strategy
}


def checkout_total(order: Order, shipping: ShippingFn) -> float:
    return order.subtotal + shipping(order)


order = Order(subtotal=850, weight_kg=2.5)
for name, strategy in SHIPPING.items():
    print(f"{name:>8}: {checkout_total(order, strategy)}")
```

Output:

```text
standard: 920.0
 express: 1050.0
  pickup: 850.0
 courier: 970.0
```

Three Pythonic tools appear here:

- **`Callable[[Order], float]`** is the strategy interface. Any function, lambda, bound method or object with `__call__` fits.
- **`functools.partial`** (or a closure) turns a general function into a configured strategy, like a constructor argument would for a class.
- **A registry dict** replaces the `if/elif` chain from the problem: picking a strategy by name is a dictionary lookup, and adding a carrier means adding one entry.

You use function strategies all the time. The `key` argument of `sorted()`, `min()` and `max()` is a strategy that tells the algorithm how to compare elements:

```python
words = ["banana", "Cherry", "apple", "fig"]

print(sorted(words))                   # default: by code points, "C" < "a"
print(sorted(words, key=str.lower))    # case-insensitive
print(sorted(words, key=len))          # by length (stable for ties)
print(max(words, key=lambda w: w.count("a")))
```

Output:

```text
['Cherry', 'apple', 'banana', 'fig']
['apple', 'banana', 'Cherry', 'fig']
['fig', 'apple', 'banana', 'Cherry']
banana
```

**Function or class?** Use a function when the strategy is one stateless operation. Use a class when the strategy has several related methods or attributes, keeps configuration or internal state, or needs a readable `repr` and a name in logs.

### Practical example: report export formats

A report can be exported as CSV, JSON or a Markdown table. Each format needs two things: the text and a file extension. That makes a class a better fit than a bare function. The format is chosen at runtime, for example from a command-line flag:

```python
import csv
import io
import json
from typing import Protocol

Row = dict[str, object]


class ExportFormat(Protocol):
    extension: str

    def render(self, rows: list[Row]) -> str: ...


class CsvFormat:
    extension = "csv"

    def render(self, rows: list[Row]) -> str:
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
        return buffer.getvalue()


class JsonFormat:
    extension = "json"

    def __init__(self, indent: int | None = None) -> None:
        self.indent = indent  # strategies may carry their own settings

    def render(self, rows: list[Row]) -> str:
        return json.dumps(rows, indent=self.indent, ensure_ascii=False) + "\n"


class MarkdownFormat:
    extension = "md"

    def render(self, rows: list[Row]) -> str:
        headers = list(rows[0])
        lines = ["| " + " | ".join(headers) + " |",
                 "|" + "---|" * len(headers)]
        for row in rows:
            lines.append("| " + " | ".join(str(row[h]) for h in headers) + " |")
        return "\n".join(lines) + "\n"


FORMATS: dict[str, ExportFormat] = {
    "csv": CsvFormat(),
    "json": JsonFormat(),
    "md": MarkdownFormat(),
}


class ReportExporter:
    def __init__(self, fmt: ExportFormat) -> None:
        self.fmt = fmt

    def export(self, name: str, rows: list[Row]) -> tuple[str, str]:
        if not rows:
            raise ValueError("nothing to export")
        return f"{name}.{self.fmt.extension}", self.fmt.render(rows)


sales = [{"city": "Kyiv", "orders": 120}, {"city": "Lviv", "orders": 75}]

for choice in ("csv", "json", "md"):  # e.g. a value from a CLI flag or config
    filename, content = ReportExporter(FORMATS[choice]).export("sales", sales)
    print(f"--- {filename}")
    print(content, end="")
```

Output:

```text
--- sales.csv
city,orders
Kyiv,120
Lviv,75
--- sales.json
[{"city": "Kyiv", "orders": 120}, {"city": "Lviv", "orders": 75}]
--- sales.md
| city | orders |
|---|---|
| Kyiv | 120 |
| Lviv | 75 |
```

`ReportExporter` contains the shared logic (validation, file naming), while each format knows only how to render rows. Adding XML export means one new class and one dictionary entry.

### When to use Strategy

- You need different variants of an algorithm inside one object and want to switch between them at runtime.
- You have many similar classes that differ only in how they perform one behavior. Extract the behavior into strategies and merge the classes.
- You want to isolate the details of an algorithm (its code, data and dependencies) from the business logic that uses it.
- A class has a big conditional that selects one variant of the same algorithm.

### How to implement Strategy

1. Find the algorithm in the context that changes often or hides behind a large conditional.
2. Declare the strategy interface: a `Protocol`, an ABC, or simply a `Callable` type.
3. Move each variant of the algorithm into its own class or function that follows the interface.
4. Give the context an attribute that stores a strategy. The context must use it only through the interface. If strategies need data from the context, pass it as arguments.
5. Let the client choose the strategy and pass it to the context. A registry dict is a convenient place to map names to strategies.

### Pros and cons of Strategy

**Pros:**

- Algorithms can be swapped at runtime.
- Implementation details of an algorithm are isolated from the code that uses it.
- Composition replaces inheritance: no need for a subclass per variant.
- *Open/Closed Principle*: new strategies do not require changes to the context.

**Cons:**

- With two stable algorithms, extra classes and interfaces only add noise.
- Clients must understand the differences between strategies to pick the right one.
- In Python, plain functions often do the job with less code. A class hierarchy for one-line strategies is over-engineering.

### Relations with other patterns

- **Bridge, State, Strategy** (and partly **Adapter**) have similar structures based on composition. They differ in the problem they solve, and the pattern's name tells other developers which problem that is.
- **Command vs Strategy.** Both can parameterize an object with an action. A Command turns an operation into an object that can be queued, logged, undone or sent elsewhere. A Strategy describes different ways of doing the *same* thing.
- **Decorator vs Strategy.** A Decorator changes the "skin" of an object by wrapping it. A Strategy changes its "guts" by replacing an internal algorithm.
- **Template Method vs Strategy.** Template Method is based on inheritance and varies steps of an algorithm in subclasses, so the choice is fixed per class. Strategy is based on composition and works per object, so it can change at runtime.
- **State** can be seen as an extension of Strategy, as the next part shows.

## State

### Intent

**State** lets an object change its behavior when its internal state changes. From the outside it looks as if the object changed its class.

### Problem

The State pattern is closely related to a **finite-state machine**: at any moment an object is in one of a finite number of states, it behaves differently in each, and only certain **transitions** between states are allowed.

Take an order in a shop. It can be `new`, `paid`, `shipped` or `cancelled`, and the meaning of each action depends on the status:

- `pay()` turns a new order into a paid one, but makes no sense for a paid, shipped or cancelled order;
- `ship()` is allowed only for a paid order;
- `cancel()` works for new and paid orders, and a paid one must also be refunded.

The usual first implementation keeps a status string and checks it in every method:

```python
class Order:
    def __init__(self) -> None:
        self.status = "new"

    def pay(self) -> None:
        if self.status == "new":
            self.status = "paid"
        elif self.status == "paid":
            print("already paid")
        elif self.status in ("shipped", "cancelled"):
            print(f"cannot pay a {self.status} order")

    def ship(self) -> None:
        if self.status == "paid":
            self.status = "shipped"
        elif self.status == "new":
            print("pay first")
        else:
            print(f"cannot ship a {self.status} order")

    def cancel(self) -> None:
        if self.status == "new":
            self.status = "cancelled"
        elif self.status == "paid":
            print("refunding...")
            self.status = "cancelled"
        else:
            print(f"cannot cancel a {self.status} order")
```

Each method has a conditional over all states. Add a `returned` status and you must edit every method, and nothing tells you which one you forgot. As the project grows, it is hard to see which transitions are allowed, because the rules are scattered across many branches.

### Solution

Create a class for each possible state and move all state-specific behavior into it. The original object, the **context**, keeps a reference to the current state object and delegates state-dependent work to it.

To switch states, the context replaces its state object with another one. States may know about each other and trigger transitions themselves: `New.pay()` moves the order into `Paid`. This is the key difference from Strategy, where strategies almost never know about each other.

### Real-world analogy

A vending machine has the same buttons all day, but pressing "dispense" means different things. With no coins inserted, the button does nothing except show "insert coins". After enough money is inserted, the same button gives you a drink and switches the machine back to waiting. When the machine is empty, every button shows "out of stock". The buttons are the context's methods, and the machine's current situation decides what they do.

### Structure

```text
+----------------------------------+      +------------------------------+
| Context (Order)                  |      | State (OrderState)           |
|----------------------------------|      |------------------------------|
| - _state: OrderState  o---------------->| + pay(order)                 |
|----------------------------------|      | + ship(order)                |
| + pay()    -> _state.pay(self)   |      | + cancel(order)              |
| + ship()   -> _state.ship(self)  |      +------------------------------+
| + cancel() -> _state.cancel(self)|         ^       ^       ^        ^
| + transition_to(state)           |         |       |       |        |
+----------------------------------+        New    Paid   Shipped  Cancelled
               ^                              |       |
               |   order.transition_to(Paid())|       |
               +------------------------------+-------+
                 concrete states trigger transitions
```

1. **Context** stores a reference to the current state and delegates state-specific work to it. It offers a way to switch the state (`transition_to()`).
2. **State** interface declares the state-specific methods. They should make sense for every state, so that no state has methods that are never called.
3. **Concrete states** implement those methods. Common behavior can live in a base class to avoid duplication.
4. States receive the context (as a method argument or a stored back-reference), read data from it and trigger transitions. Both the context and the states can switch the state.

### Python implementation

The base class rejects every action by default, so each concrete state overrides only what is allowed in it. The context is passed to each state method as an argument instead of being stored inside the state. That keeps states free of back-references, and stateless states could even be shared between orders.

```python
from __future__ import annotations  # forward references (not needed on 3.14+)


class OrderState:
    """Base state: by default every action is rejected."""

    name = "?"

    def pay(self, order: Order) -> None:
        print(f"  cannot pay: order is {self.name}")

    def ship(self, order: Order) -> None:
        print(f"  cannot ship: order is {self.name}")

    def cancel(self, order: Order) -> None:
        print(f"  cannot cancel: order is {self.name}")


class New(OrderState):
    name = "new"

    def pay(self, order: Order) -> None:
        order.transition_to(Paid())

    def cancel(self, order: Order) -> None:
        order.transition_to(Cancelled())


class Paid(OrderState):
    name = "paid"

    def ship(self, order: Order) -> None:
        order.transition_to(Shipped())

    def cancel(self, order: Order) -> None:
        print("  refunding the payment")
        order.transition_to(Cancelled())


class Shipped(OrderState):
    name = "shipped"


class Cancelled(OrderState):
    name = "cancelled"


class Order:
    """Context: delegates every state-dependent action to its state object."""

    def __init__(self, number: int) -> None:
        self.number = number
        self._state: OrderState = New()

    @property
    def status(self) -> str:
        return self._state.name

    def transition_to(self, state: OrderState) -> None:
        print(f"  order #{self.number}: {self._state.name} -> {state.name}")
        self._state = state

    def pay(self) -> None:
        self._state.pay(self)

    def ship(self) -> None:
        self._state.ship(self)

    def cancel(self) -> None:
        self._state.cancel(self)


order = Order(1)
for action in ("ship", "pay", "pay", "ship", "cancel"):
    print(f"{action}():")
    getattr(order, action)()
print("final status:", order.status)

second = Order(2)
print("pay() + cancel():")
second.pay()
second.cancel()
```

Output:

```text
ship():
  cannot ship: order is new
pay():
  order #1: new -> paid
pay():
  cannot pay: order is paid
ship():
  order #1: paid -> shipped
cancel():
  cannot cancel: order is shipped
final status: shipped
pay() + cancel():
  order #2: new -> paid
  refunding the payment
  order #2: paid -> cancelled
```

Compare it with the conditional version: `Order` has no `if` at all. Everything about the `paid` status lives in `Paid`, so adding a `Returned` state means writing one class and adding a transition into it from `Shipped`.

> **Note:** `from __future__ import annotations` lets annotations mention `Order` before the class is defined. Since Python 3.14 annotations are evaluated lazily, so the import is unnecessary there, but it keeps the code working on 3.10–3.13.

### Practical example: a document review workflow

A publishing platform has documents in `Draft`, `Moderation` and `Published` states, and what a user may do depends on both the state and the user's role. Here the states raise `PermissionError` for forbidden actions, and the abstract methods force every new state to decide how it handles `edit()` and `publish()`:

```python
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass(frozen=True)
class User:
    name: str
    is_admin: bool = False


class DocumentState(ABC):
    @abstractmethod
    def edit(self, doc: Document, user: User, text: str) -> None: ...

    @abstractmethod
    def publish(self, doc: Document, user: User) -> None: ...

    def reject(self, doc: Document, user: User, reason: str) -> None:
        raise PermissionError(f"cannot reject a document in {type(self).__name__}")


class Draft(DocumentState):
    def edit(self, doc: Document, user: User, text: str) -> None:
        if user != doc.author:
            raise PermissionError("only the author edits a draft")
        doc.text = text

    def publish(self, doc: Document, user: User) -> None:
        doc.change_state(Moderation())  # the author sends it for review


class Moderation(DocumentState):
    def edit(self, doc: Document, user: User, text: str) -> None:
        raise PermissionError("the document is under review")

    def publish(self, doc: Document, user: User) -> None:
        if not user.is_admin:
            raise PermissionError("only an admin can publish")
        doc.change_state(Published())

    def reject(self, doc: Document, user: User, reason: str) -> None:
        doc.history.append(f"rejected: {reason}")
        doc.change_state(Draft())


class Published(DocumentState):
    def edit(self, doc: Document, user: User, text: str) -> None:
        raise PermissionError("published documents are read-only")

    def publish(self, doc: Document, user: User) -> None:
        pass  # already public: nothing to do


@dataclass
class Document:
    author: User
    text: str = ""
    state: DocumentState = field(default_factory=Draft)
    history: list[str] = field(default_factory=list)

    def change_state(self, state: DocumentState) -> None:
        self.history.append(f"{type(self.state).__name__} -> {type(state).__name__}")
        self.state = state

    def edit(self, user: User, text: str) -> None:
        self.state.edit(self, user, text)

    def publish(self, user: User) -> None:
        self.state.publish(self, user)

    def reject(self, user: User, reason: str) -> None:
        self.state.reject(self, user, reason)


olena = User("olena")
admin = User("admin", is_admin=True)

doc = Document(author=olena)
doc.edit(olena, "Design patterns, part 1")
doc.publish(olena)                       # Draft -> Moderation

for attempt in (lambda: doc.edit(olena, "typo fix"), lambda: doc.publish(olena)):
    try:
        attempt()
    except PermissionError as exc:
        print("denied:", exc)

doc.reject(admin, "add examples")        # Moderation -> Draft
doc.edit(olena, "Design patterns, part 1 (with examples)")
doc.publish(olena)                       # Draft -> Moderation
doc.publish(admin)                       # Moderation -> Published
doc.publish(admin)                       # no-op

print(type(doc.state).__name__, "|", doc.text)
print(*doc.history, sep="\n")
```

Output:

```text
denied: the document is under review
denied: only an admin can publish
Published | Design patterns, part 1 (with examples)
Draft -> Moderation
rejected: add examples
Moderation -> Draft
Draft -> Moderation
Moderation -> Published
```

The same `publish()` call means "send for review" in `Draft`, "publish if you are an admin" in `Moderation` and "do nothing" in `Published`. The web layer simply calls `doc.publish(current_user)` and turns `PermissionError` into an HTTP 403 response.

### Lightweight alternative: `Enum` and a transition table

If states differ only in **which transitions are allowed**, and not in behavior, separate classes are overkill. An `Enum` and a dictionary of transitions describe the whole machine in one place:

```python
from enum import StrEnum


class Status(StrEnum):
    NEW = "new"
    PAID = "paid"
    SHIPPED = "shipped"
    CANCELLED = "cancelled"


TRANSITIONS: dict[tuple[Status, str], Status] = {
    (Status.NEW, "pay"): Status.PAID,
    (Status.NEW, "cancel"): Status.CANCELLED,
    (Status.PAID, "ship"): Status.SHIPPED,
    (Status.PAID, "cancel"): Status.CANCELLED,
}


class Order:
    def __init__(self) -> None:
        self.status = Status.NEW

    def fire(self, action: str) -> None:
        try:
            self.status = TRANSITIONS[self.status, action]
        except KeyError:
            print(f"cannot {action}: order is {self.status}")


order = Order()
for action in ("ship", "pay", "ship", "cancel"):
    order.fire(action)
print(order.status)
```

Output:

```text
cannot ship: order is new
cannot cancel: order is shipped
shipped
```

The table is easy to read, test and even load from configuration. Its limit shows up with the refund: "cancelling a paid order also refunds the money" is *behavior*, and a pure table cannot express it without extra callbacks. When each state brings its own logic, move to the State pattern. (`StrEnum` exists since Python 3.11.)

### When to use State

- An object behaves differently depending on its current state, there are many states, and state-specific code changes often.
- A class is full of large conditionals that switch behavior based on the values of its fields.
- A condition-based state machine has a lot of duplicated code across similar states and transitions. State classes can share it through a base class.

### How to implement State

1. Choose the context class: an existing class with state-dependent code, or a new one.
2. Declare the state interface with the methods whose behavior depends on the state. You do not have to mirror every method of the context.
3. Create a class for every state and move the corresponding branches of the context's conditionals into it.
4. Decide how states access the context: as a method argument (simple, no reference cycles) or as a back-reference stored in the state. If a state needs private details of the context, add a small public method to the context rather than reaching into private attributes.
5. Give the context a reference to the current state and a method to replace it.
6. Replace the conditionals in the context with calls to the state object.
7. Trigger transitions from the states (or from the context) by passing in a new state object. Whoever creates the new state depends on its concrete class.

### Pros and cons of State

**Pros:**

- *Single Responsibility Principle*: the code of each state lives in its own class.
- *Open/Closed Principle*: new states can be added without changing existing states or the context.
- The context loses its bulky state-machine conditionals.
- Allowed transitions are visible in one place per state.

**Cons:**

- For a machine with two or three states that rarely changes, the pattern is overkill. An `Enum` with a table or even a `bool` is enough.
- Transitions are spread across state classes, so the overall graph is harder to see than in a table.
- States that know each other are coupled to each other's classes.

### Relations with other patterns

- **Bridge, State, Strategy** (and partly **Adapter**) share a composition-based structure but solve different problems.
- **State as an extension of Strategy.** Both change the context's behavior by delegating to helper objects. Strategies are independent and unaware of each other. States may know each other and switch the context from one state to another on their own.
- **Flyweight.** Stateless state objects can be shared between many contexts, like the module-level instances in the turnstile solution below.

## Strategy vs State

| Question | Strategy | State |
|---|---|---|
| What does the helper object represent? | *How* to perform one task (an algorithm) | *What situation* the object is in |
| Who chooses or replaces it? | The client, from outside | Usually the states themselves, as a reaction to the context's own methods |
| Do the helpers know each other? | No, they are independent | Yes, a state creates the next state |
| How often does it change? | Rarely: chosen once per configuration or call | Constantly, as part of normal behavior |
| How many methods does the interface have? | Usually one | Usually several: every state-dependent operation |
| Does the helper need the context? | Rarely, gets data as arguments | Often, to read data and switch states |
| Lightweight Python form | A function and a registry dict | An `Enum` and a transition table |

How to choose:

- Ask **"who decides to switch?"** If the caller decides ("export as JSON", "ship by express"), it is Strategy. If the object switches itself as a result of its own operations ("after `pay()` the order is paid"), it is State.
- Ask **"is the switch part of the object's lifecycle?"** States form a graph with allowed and forbidden transitions. Strategies form a menu of equal choices.
- The code can look identical. The pattern name documents the intent: `checkout.shipping = ExpressShipping()` tells the reader "configuration", while `order.transition_to(Paid())` tells "lifecycle".
- They combine well: a state object can use a strategy, and a context can have both (a `Paid` state with a pluggable refund strategy).

## Common mistakes

- **Strategies that are not really interchangeable.** All strategies must return the same kind of result. A classic slip is returning an iterator from one strategy and a list from another:

  ```python
  def ascending(data: list[int]) -> list[int]:
      return sorted(data)


  def descending(data: list[int]) -> list[int]:
      return reversed(sorted(data))  # BUG: returns an iterator, not a list


  for strategy in (ascending, descending):
      result = strategy([3, 1, 2])
      try:
          print(strategy.__name__, "->", result[0])
      except TypeError as exc:
          print(strategy.__name__, "->", exc)
  ```

  Output:

  ```text
  ascending -> 1
  descending -> 'list_reverseiterator' object is not subscriptable
  ```

  Use `sorted(data, reverse=True)`. A type checker would also catch this mismatch with the `-> list[int]` annotation.

- **The context inspects its strategy.** `if isinstance(self.strategy, ExpressShipping): ...` inside the context brings back the conditional the pattern was supposed to remove. If the context needs something extra, add it to the strategy interface.
- **A class hierarchy for one-line strategies.** In Python, a function, a lambda or `functools.partial` is often enough.
- **Sharing a state object that holds per-context data.** Sharing state instances between contexts is fine only when states are stateless. A state that stores, say, a retry counter must be created per context.
- **Duplicated transition logic.** If both the context and the states decide where to go next, the rules drift apart. Pick one place for transitions.
- **The State pattern for a trivial machine.** Two states that never change are a `bool`. A few states with no state-specific behavior are an `Enum` and a dict.
- **Forgetting a method in a new state.** With a plain base class the new state silently inherits a default. Use `@abstractmethod` for operations that every state must decide on explicitly.

## Summary

- Strategy extracts interchangeable algorithms behind one interface. The client chooses the algorithm, and the context just uses it.
- In Python a strategy is often just a function. `Callable` types, `functools.partial` and a registry dict replace class hierarchies and `if/elif` chains.
- State moves state-dependent behavior into state classes. The context delegates to the current state, and states trigger transitions.
- A plain `Enum` with a transition table is enough when states differ only in allowed transitions.
- Both patterns use composition and look alike. Strategy is about *how* to do a task and is chosen from outside. State is about *what* the object can do now and changes from inside.
- Do not apply either pattern to two stable variants: a simple condition is clearer.

## Practice

### Exercise 1: Discount strategies

A `Cart` holds a list of prices and a discount strategy, a function that receives the prices and returns the amount to subtract. Implement `no_discount`, a factory `percent_off(percent)`, a factory `fixed_off(amount, minimum=0)` that applies only when the cart total reaches `minimum`, and `three_for_two`, which makes the cheapest item of every three free. Print the total of the cart `[300, 120, 80, 500]` with each strategy.

### Exercise 2: Turnstile

Model a metro turnstile with the State pattern. It has two states, `Locked` and `Unlocked`, and two events, `coin()` and `push()`:

- `Locked` + `coin` → count the payment and unlock;
- `Locked` + `push` → print an alarm;
- `Unlocked` + `push` → count a passenger and lock;
- `Unlocked` + `coin` → return the coin.

The states hold no data, so make one shared instance of each. Run the events `push, coin, coin, push, push` and print the counters.

### Exercise 3: Strategy or State?

For each case, decide which pattern fits better and explain why in one or two sentences:

1. An image editor lets the user choose the resize algorithm: nearest neighbour, bilinear or bicubic.
2. A network connection behaves differently when it is `Connecting`, `Open` or `Closed`: `send()` queues data, sends it, or raises an error.
3. An HTTP client can be configured with a retry policy: no retries, a fixed delay, or exponential backoff.
4. A game character is `Normal`, `Poisoned` or `Invisible`. Effects expire after a few turns, and the character's movement and damage depend on the effect.

## Solutions

### Exercise 1

```python
from collections.abc import Callable

Discount = Callable[[list[float]], float]  # returns the amount to subtract


def no_discount(prices: list[float]) -> float:
    return 0.0


def percent_off(percent: float) -> Discount:
    def discount(prices: list[float]) -> float:
        return round(sum(prices) * percent / 100, 2)
    return discount


def fixed_off(amount: float, minimum: float = 0.0) -> Discount:
    def discount(prices: list[float]) -> float:
        total = sum(prices)
        return min(amount, total) if total >= minimum else 0.0
    return discount


def three_for_two(prices: list[float]) -> float:
    """Every third item (the cheapest ones first) is free."""
    ordered = sorted(prices)
    free_items = len(prices) // 3
    return sum(ordered[:free_items])


class Cart:
    def __init__(self, prices: list[float], discount: Discount = no_discount) -> None:
        self.prices = prices
        self.discount = discount

    def total(self) -> float:
        return sum(self.prices) - self.discount(self.prices)


cart = Cart([300.0, 120.0, 80.0, 500.0])
for name, strategy in [
    ("none", no_discount),
    ("10%", percent_off(10)),
    ("-150 from 900", fixed_off(150, minimum=900)),
    ("3 for 2", three_for_two),
]:
    cart.discount = strategy
    print(f"{name:>14}: {cart.total():.2f}")
```

Output:

```text
          none: 1000.00
           10%: 900.00
 -150 from 900: 850.00
       3 for 2: 920.00
```

`percent_off` and `fixed_off` are factories: they return a configured strategy (a closure). `Cart` works with any function of the right shape and never checks which one it got.

### Exercise 2

```python
from __future__ import annotations

from abc import ABC, abstractmethod


class TurnstileState(ABC):
    @abstractmethod
    def coin(self, gate: Turnstile) -> None: ...

    @abstractmethod
    def push(self, gate: Turnstile) -> None: ...


class Locked(TurnstileState):
    def coin(self, gate: Turnstile) -> None:
        gate.paid += 1
        print("coin accepted, unlocking")
        gate.state = UNLOCKED

    def push(self, gate: Turnstile) -> None:
        print("ALARM: pay first")


class Unlocked(TurnstileState):
    def coin(self, gate: Turnstile) -> None:
        print("already unlocked, coin returned")

    def push(self, gate: Turnstile) -> None:
        gate.passed += 1
        print("welcome, locking behind you")
        gate.state = LOCKED


# The states hold no data of their own, so one instance of each can be shared
LOCKED, UNLOCKED = Locked(), Unlocked()


class Turnstile:
    def __init__(self) -> None:
        self.state: TurnstileState = LOCKED
        self.paid = 0
        self.passed = 0

    def coin(self) -> None:
        self.state.coin(self)

    def push(self) -> None:
        self.state.push(self)


gate = Turnstile()
for event in ("push", "coin", "coin", "push", "push"):
    getattr(gate, event)()
print(f"paid={gate.paid}, passed={gate.passed}, state={type(gate.state).__name__}")
```

Output:

```text
ALARM: pay first
coin accepted, unlocking
already unlocked, coin returned
welcome, locking behind you
ALARM: pay first
paid=1, passed=1, state=Locked
```

All data (counters) lives in the context, so the two state objects can safely serve any number of turnstiles.

### Exercise 3

1. **Strategy.** The user picks one of several equivalent algorithms for the same task. The algorithms do not switch between each other.
2. **State.** The connection moves between states as a result of its own operations (connect, close, errors), and `send()` must behave differently in each.
3. **Strategy.** The retry policy is chosen by configuration and stays the same. The policies are interchangeable and independent.
4. **State.** The character's effect changes over time because of game events and expires by itself after some turns, and the effect decides how movement and damage work. The current effect can still use strategies inside (for example, a damage formula).

---

*Sources: [Refactoring.Guru — Strategy](https://refactoring.guru/design-patterns/strategy), [Refactoring.Guru — Strategy in Python](https://refactoring.guru/design-patterns/strategy/python/example), [Refactoring.Guru — State](https://refactoring.guru/design-patterns/state), [Refactoring.Guru — State in Python](https://refactoring.guru/design-patterns/state/python/example). Adapted and expanded for PyJourney.*
