# Observer

**Observer** is a behavioral design pattern that lets one object announce events to any number of other objects that have subscribed to them, without knowing who they are. GUI buttons, logging handlers, Django signals, webhooks and "notify me when it's back in stock" buttons all follow this idea.

## What you'll learn

- Which problem Observer solves and why polling or hard-wired calls do not scale
- The roles in the pattern: publisher, subscriber and client
- How to implement Observer in Python with `typing.Protocol`, and with plain callables
- How to avoid memory leaks with weak references
- Where Observer already lives in the standard library (`logging`)
- The typical bugs: shared subscriber lists, unsubscribing during notification, failing subscribers

## Intent

Define a **one-to-many** dependency: when one object (the **publisher**, also called the *subject*) changes its state or something important happens to it, all objects that asked to be told about it (the **subscribers**, also called *observers* or *listeners*) are notified automatically.

The publisher only knows that its subscribers have some notification method. It does not know their classes, how many there are, or what they will do with the news.

## Problem

Imagine an online shop. When a sold-out product is restocked, several parts of the system must react:

- customers who clicked "notify me" should get an email;
- the search index should mark the product as available;
- analytics should record the restock.

The first, naive version wires everything directly into the inventory code (a sketch):

```python
class Inventory:
    def restock(self, product: str, quantity: int) -> None:
        ...  # update the stock
        # The inventory knows every consumer by name:
        email_service.send_back_in_stock(product)
        search_index.mark_available(product)
        analytics.track("restock", product)
```

Every new reaction ("also push a message to Telegram") means editing `Inventory`, a class that should only care about stock levels. Testing it requires all those services, and reusing it in another project drags them along.

The opposite approach is **polling**: each service asks the inventory every few seconds "is the keyboard back?". Most of these questions are wasted, and the reaction is delayed until the next poll.

So either the inventory knows too much, or everyone else wastes effort asking.

## Solution

Turn the inventory into a **publisher** with a small subscription mechanism:

1. a list of subscribers;
2. public methods to **subscribe** and **unsubscribe**;
3. a **notify** method that walks the list and calls one agreed-upon method (for example `update(event)`) on each subscriber.

Whenever something interesting happens, the publisher calls `notify()`. It talks to subscribers only through the common interface, so the email sender, the search index and analytics can be added, removed or replaced without touching the publisher. Subscribers can also join and leave **at runtime**.

To tell subscribers what happened, the publisher passes context: an event object, a few arguments, or itself, so the subscriber can read whatever it needs.

## Real-world analogy

Think of subscribing to a podcast. You do not open the podcast's website every morning to check for a new episode. You press "subscribe" once, and new episodes simply appear in your app. The podcast author does not know your name or which app you use, only that there is a list of subscribers to deliver to. When you lose interest, you unsubscribe and the episodes stop coming.

## Structure

```text
+-------------------------------+
| Publisher (e.g. Inventory)    |
|-------------------------------|
| - subscribers: list           |
|-------------------------------|      notify(event):
| + subscribe(subscriber)       |          for s in subscribers:
| + unsubscribe(subscriber)     |              s.update(event)
| + notify(event) -----------------+
| + restock(...)   # business   |  |
+-------------------------------+  |
                                   v
                 +-------------------------------+
                 | <<Protocol>> Subscriber       |
                 |-------------------------------|
                 | + update(event) -> None       |
                 +-------------------------------+
                       ^                  ^
                       : implements       :
           +-------------------+  +-------------------+
           | EmailNotifier     |  | SearchIndex       |
           | + update(event)   |  | + update(event)   |
           +-------------------+  +-------------------+

Client: creates the publisher and the subscribers, then calls subscribe().
```

1. **Publisher** holds the interesting state and the subscription list. When an event happens, it notifies everyone on the list.
2. **Subscriber** interface declares the notification method. Usually it is a single method such as `update()`.
3. **Concrete subscribers** react to notifications in their own way. They all follow the same interface, so the publisher is not coupled to their classes.
4. **Event data** travels as arguments of the notification method: an event object, plain values, or a reference to the publisher.
5. **Client** creates publishers and subscribers separately and connects them.

## Python implementation

Here is the shop scenario. `typing.Protocol` describes the subscriber interface *structurally*: any object with a matching `update()` method fits, no inheritance required. The event is a small frozen dataclass, so subscribers cannot accidentally modify it.

```python
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class StockEvent:
    product: str
    quantity: int


class Subscriber(Protocol):
    def update(self, event: StockEvent) -> None: ...


class Inventory:
    """Publisher: owns the state and tells subscribers when it changes."""

    def __init__(self) -> None:
        self._stock: dict[str, int] = {}
        self._subscribers: list[Subscriber] = []

    def subscribe(self, subscriber: Subscriber) -> None:
        if subscriber not in self._subscribers:
            self._subscribers.append(subscriber)

    def unsubscribe(self, subscriber: Subscriber) -> None:
        self._subscribers.remove(subscriber)

    def notify(self, event: StockEvent) -> None:
        for subscriber in list(self._subscribers):  # iterate over a copy
            subscriber.update(event)

    def restock(self, product: str, quantity: int) -> None:
        was_empty = self._stock.get(product, 0) == 0
        self._stock[product] = self._stock.get(product, 0) + quantity
        print(f"Inventory: {product} -> {self._stock[product]} pcs")
        if was_empty:  # only "back in stock" is interesting
            self.notify(StockEvent(product, self._stock[product]))


class EmailNotifier:
    def __init__(self, waiting: dict[str, list[str]]) -> None:
        self.waiting = waiting

    def update(self, event: StockEvent) -> None:
        for email in self.waiting.get(event.product, []):
            print(f"  Email to {email}: '{event.product}' is back in stock")


class SearchIndex:
    def update(self, event: StockEvent) -> None:
        print(f"  SearchIndex: mark '{event.product}' as available")


class Analytics:
    def __init__(self) -> None:
        self.restocks = 0

    def update(self, event: StockEvent) -> None:
        self.restocks += 1
        print(f"  Analytics: restock #{self.restocks} recorded")


inventory = Inventory()
emails = EmailNotifier({"keyboard": ["ann@example.com", "bob@example.com"]})
index = SearchIndex()
analytics = Analytics()

for subscriber in (emails, index, analytics):
    inventory.subscribe(subscriber)

inventory.restock("keyboard", 5)
inventory.restock("keyboard", 3)  # already in stock: no event

inventory.unsubscribe(emails)
inventory.restock("mouse", 10)
```

Output:

```text
Inventory: keyboard -> 5 pcs
  Email to ann@example.com: 'keyboard' is back in stock
  Email to bob@example.com: 'keyboard' is back in stock
  SearchIndex: mark 'keyboard' as available
  Analytics: restock #1 recorded
Inventory: keyboard -> 8 pcs
Inventory: mouse -> 10 pcs
  SearchIndex: mark 'mouse' as available
  Analytics: restock #2 recorded
```

Things worth noticing:

- `Inventory` never imports or names `EmailNotifier`, `SearchIndex` or `Analytics`. Adding a fourth subscriber requires no change to it.
- The publisher decides **when** an event is worth sending (only when the product was sold out). Subscribers decide **what** to do.
- `notify()` loops over `list(self._subscribers)`, a copy. A subscriber may unsubscribe while it is being notified, and changing a list while iterating over it skips elements (see "Common mistakes").
- The subscriber list lives in `__init__`, so every publisher has its own list.

> **Note:** If you prefer explicit inheritance, declare `class Subscriber(ABC)` with an `@abstractmethod def update(...)`. An ABC refuses to instantiate subclasses that forgot to implement `update()`. A `Protocol` is checked by type checkers (mypy, pyright) instead, and lets you plug in classes you do not own.

## Practical example: an event emitter with callables

In Python a subscriber does not have to be an object with an `update()` method. Any **callable** works: a function, a lambda, a bound method. A common Pythonic form is an *event emitter* that keeps handlers per event name and returns an "unsubscribe" function:

```python
from collections import defaultdict
from collections.abc import Callable
from typing import Any

Handler = Callable[..., None]


class EventEmitter:
    def __init__(self) -> None:
        self._handlers: defaultdict[str, list[Handler]] = defaultdict(list)

    def on(self, event: str, handler: Handler) -> Callable[[], None]:
        """Subscribe and return a function that cancels the subscription."""
        self._handlers[event].append(handler)

        def unsubscribe() -> None:
            self._handlers[event].remove(handler)

        return unsubscribe

    def emit(self, event: str, **data: Any) -> int:
        handlers = list(self._handlers.get(event, ()))
        for handler in handlers:
            handler(**data)
        return len(handlers)


class Editor:
    def __init__(self) -> None:
        self.events = EventEmitter()  # composition instead of inheritance
        self.filename: str | None = None

    def open(self, filename: str) -> None:
        self.filename = filename
        self.events.emit("open", filename=filename)

    def save(self) -> None:
        self.events.emit("save", filename=self.filename)


audit_log: list[str] = []
editor = Editor()

editor.events.on("open", lambda filename: audit_log.append(f"opened {filename}"))
stop_alerts = editor.events.on(
    "save", lambda filename: print(f"ALERT: {filename} was changed")
)

editor.open("report.txt")
editor.save()
stop_alerts()            # unsubscribe
print(editor.events.emit("save", filename="report.txt"))  # nobody listens
print(audit_log)
```

Output:

```text
ALERT: report.txt was changed
0
['opened report.txt']
```

Design decisions in this version:

- **Composition.** `Editor` does not inherit from a publisher base class. It *has* an `EventEmitter`. This matters when the class already has a parent, and it keeps subscription code in one reusable place.
- **Named events.** Subscribers choose the events they care about (`"open"`, `"save"`), so nobody receives notifications they would ignore.
- **Unsubscribe handle.** Returning a closure from `on()` means the caller does not have to keep the original lambda around to remove it later.
- `emit()` uses `.get()`, so emitting an event nobody subscribed to does not create empty entries in the `defaultdict`.

### Avoiding memory leaks with weak references

A publisher's list holds **strong references** to subscribers. As long as the publisher lives, its subscribers live too, even if the rest of the program forgot about them. This is called the *lapsed listener* problem: a closed window that never unsubscribed keeps receiving events and occupying memory.

`weakref.WeakSet` stores references that do not keep objects alive. When the last normal reference disappears, the subscriber silently drops out of the set:

```python
import weakref


class Publisher:
    def __init__(self) -> None:
        self._subscribers: weakref.WeakSet = weakref.WeakSet()

    def subscribe(self, subscriber) -> None:
        self._subscribers.add(subscriber)

    def notify(self, message: str) -> None:
        for subscriber in list(self._subscribers):
            subscriber.update(message)


class Screen:
    def __init__(self, name: str) -> None:
        self.name = name

    def update(self, message: str) -> None:
        print(f"{self.name} shows: {message}")


news = Publisher()
main_screen = Screen("main")
popup = Screen("popup")
news.subscribe(main_screen)
news.subscribe(popup)
print(len(news._subscribers))

del popup  # the popup window is closed, nobody else refers to it
print(len(news._subscribers))
news.notify("hello")
```

Output:

```text
2
1
main shows: hello
```

> **Note:** In CPython the object disappears as soon as its reference count drops to zero, so the second `len()` is `1` right away. Other implementations (PyPy) may remove it later, after a garbage collection. A `WeakSet` also has no defined order. For bound-method callbacks use `weakref.WeakMethod`, because a plain `weakref.ref(obj.method)` dies immediately: the bound method object is temporary.

### Observer in the standard library: `logging`

You already use Observer whenever you configure `logging`. A logger is a publisher, handlers are subscribers, and `addHandler()` / `removeHandler()` are the subscription methods. Each handler decides on its own what to do with a record:

```python
import logging
import sys

logger = logging.getLogger("shop")      # the publisher
logger.setLevel(logging.INFO)
logger.propagate = False

console = logging.StreamHandler(sys.stdout)                 # subscriber 1
console.setFormatter(logging.Formatter("console: %(message)s"))
errors_only = logging.StreamHandler(sys.stdout)             # subscriber 2
errors_only.setLevel(logging.ERROR)
errors_only.setFormatter(logging.Formatter("pager: %(levelname)s %(message)s"))

logger.addHandler(console)
logger.addHandler(errors_only)

logger.info("order 42 created")
logger.error("payment for order 42 failed")
logger.removeHandler(console)
logger.error("database is down")
```

Output:

```text
console: order 42 created
console: payment for order 42 failed
pager: ERROR payment for order 42 failed
pager: ERROR database is down
```

Other examples in the ecosystem: `tkinter` event bindings, Django signals, the `blinker` library, Qt signals and slots, and `asyncio` future callbacks (`add_done_callback`).

## When to use it

- A change in one object must trigger reactions in other objects, and **the set of those objects is not known in advance** or changes while the program runs.
- You build a reusable component (a button, a downloader, a model) and want users to "hook in" their own code without subclassing it.
- Some objects need to watch another one only **temporarily** or under specific conditions, and must be able to stop watching.
- You want to replace polling ("has it changed yet?") with push notifications.

Do not use it when there is exactly one, fixed receiver. A direct method call is simpler and easier to follow.

## How to implement it

1. Split the logic into the core (the future publisher) and the reactions (future subscribers).
2. Declare the subscriber interface: a `Protocol` or ABC with one notification method, or simply a `Callable` type alias.
3. Decide what data the notification carries: an immutable event object, keyword arguments, or the publisher itself.
4. Put the subscriber list and `subscribe()` / `unsubscribe()` / `notify()` either in a base class or, more flexibly, in a separate helper object the publisher owns (composition).
5. Call `notify()` from the publisher's business methods whenever something subscribers care about happens. Iterate over a copy of the list.
6. Implement concrete subscribers.
7. In the client, create subscribers and register them with the publishers. Decide who unsubscribes them, or use weak references.

## Pros and cons

**Pros:**

- *Open/Closed Principle*: new subscribers can be added without changing the publisher.
- Loose coupling: the publisher depends only on a tiny interface.
- Relations between objects are created and removed at runtime.
- One event can drive many independent reactions, each in its own class or function.

**Cons:**

- Notification order is an implementation detail. Code that relies on "A is notified before B" is fragile.
- The flow of control is hidden: reading `inventory.restock()` does not tell you what will happen. Debugging cascades of events can be hard.
- Forgotten subscriptions cause memory leaks and "ghost" reactions.
- An exception in one subscriber can stop the notification of the others unless you handle it.
- Subscribers that modify the publisher inside `update()` can cause infinite notification loops.

## Relations with other patterns

- **Chain of Responsibility, Command, Mediator and Observer** all connect senders and receivers in different ways. Chain of Responsibility passes a request along a chain until someone handles it. Command creates a one-way link from a sender to a receiver. Mediator removes direct links and forces components to talk through a central object. Observer lets receivers subscribe and unsubscribe dynamically.
- **Mediator vs Observer.** The goal of Mediator is to remove mutual dependencies between a set of components. The goal of Observer is to set up dynamic one-way connections. A popular way to implement a Mediator is to make it a publisher that components subscribe to, and then the two look alike. A Mediator can also be built without any subscriptions, and a system where every component is a publisher has no central mediator at all.
- **Observer with Strategy or Command.** A subscriber callback is often a strategy-like function or a command object that the publisher runs on each event.

## Common mistakes

- **A subscriber list stored as a class attribute.** A mutable default on the class is shared by all instances, so subscribing to one publisher subscribes to all of them:

  ```python
  class Publisher:
      _observers: list = []  # BUG: one list shared by every instance

      def attach(self, observer) -> None:
          self._observers.append(observer)


  orders = Publisher()
  payments = Publisher()
  orders.attach("order-logger")
  print(payments._observers)
  ```

  Output:

  ```text
  ['order-logger']
  ```

  Create the list in `__init__` (`self._observers = []`).

- **Changing the list while notifying.** If a subscriber unsubscribes inside `update()`, a loop over the live list skips the next subscriber:

  ```python
  class OneShot:
      def __init__(self, name: str, publisher: "Publisher") -> None:
          self.name = name
          self.publisher = publisher

      def update(self) -> None:
          print(f"{self.name} got the event and unsubscribes")
          self.publisher.subscribers.remove(self)


  class Publisher:
      def __init__(self) -> None:
          self.subscribers: list[OneShot] = []

      def notify(self) -> None:
          for subscriber in self.subscribers:  # BUG: the list changes while we loop
              subscriber.update()


  pub = Publisher()
  pub.subscribers += [OneShot("A", pub), OneShot("B", pub), OneShot("C", pub)]
  pub.notify()
  print("left:", [s.name for s in pub.subscribers])
  ```

  Output:

  ```text
  A got the event and unsubscribes
  C got the event and unsubscribes
  left: ['B']
  ```

  `B` was never notified. Iterate over a copy: `for subscriber in list(self.subscribers):`.

- **Letting one failing subscriber break everyone.** An exception propagates out of `notify()` and the remaining subscribers are skipped. Decide on a policy: catch and log, or collect errors and re-raise them together:

  ```python
  def notify(subscribers, event: str) -> None:
      for subscriber in list(subscribers):
          try:
              subscriber(event)
          except Exception as exc:  # one broken subscriber must not stop the rest
              print(f"subscriber {subscriber.__name__} failed: {exc!r}")


  def broken(event: str) -> None:
      raise ValueError("boom")


  def healthy(event: str) -> None:
      print(f"healthy got {event!r}")


  notify([broken, healthy], "saved")
  ```

  Output:

  ```text
  subscriber broken failed: ValueError('boom')
  healthy got 'saved'
  ```

- **Reaching into the publisher's private state.** A subscriber that reads `subject._state` is coupled to the publisher's internals. Pass an event object or expose a public read-only property.
- **Notification loops.** A subscriber that changes the publisher inside `update()` triggers another notification, which triggers another change... Notify only on real changes (compare old and new values) and avoid writing back to the publisher from handlers.
- **Forgetting to unsubscribe.** Long-lived publishers keep short-lived subscribers alive. Unsubscribe explicitly (for example in a `close()` method or a `with` block) or use weak references.

## Summary

- Observer sets up a one-to-many link: a publisher notifies all of its current subscribers when something happens.
- The publisher knows only the subscriber interface, which keeps it closed for modification and open for new reactions.
- In Python a subscriber can be an object with an `update()` method (`Protocol` or ABC) or any callable.
- Keep the subscriber list per instance, iterate over a copy, and decide how to handle subscriber exceptions.
- Weak references (`weakref.WeakSet`, `weakref.WeakMethod`) prevent subscribers from being kept alive by the publisher.
- `logging` loggers and handlers are a ready-made Observer in the standard library.
- Do not depend on notification order, and beware of hidden control flow and notification loops.

## Practice

### Exercise 1: Thermometer

Write a `Thermometer` publisher with a `temperature` property. Setting the property notifies subscribers **only if the value actually changed**, and passes both the old and the new value. Write two subscribers: `Display` prints every new value, and `Alarm(limit)` prints a warning only when the temperature *crosses* the limit upwards (not on every value above it). Feed the values `25, 25, 31, 32, 29`.

### Exercise 2: One-time subscriptions

Extend the `EventEmitter` from the practical example with a method `once(event, handler)`. The handler must run on the first matching `emit()` and then unsubscribe automatically. Make sure the returned function can still cancel the subscription before the event fires, and that calling the unsubscribe function twice does not raise.

### Exercise 3: Reporting all failures

Write a `Publisher` whose subscribers are plain callables. `notify(event)` must call **every** subscriber even if some of them raise. At the end, if anything failed, raise an `ExceptionGroup` (Python 3.11+) with all collected exceptions, each annotated with a note naming the subscriber. Handle the group with `except*` so that network errors and other errors are processed separately.

## Solutions

### Exercise 1

```python
from typing import Protocol


class TemperatureListener(Protocol):
    def on_temperature(self, old: float | None, new: float) -> None: ...


class Thermometer:
    def __init__(self) -> None:
        self._temperature: float | None = None
        self._listeners: list[TemperatureListener] = []

    def subscribe(self, listener: TemperatureListener) -> None:
        self._listeners.append(listener)

    def unsubscribe(self, listener: TemperatureListener) -> None:
        self._listeners.remove(listener)

    @property
    def temperature(self) -> float | None:
        return self._temperature

    @temperature.setter
    def temperature(self, value: float) -> None:
        if value == self._temperature:
            return  # nothing changed, nobody is bothered
        old, self._temperature = self._temperature, value
        for listener in list(self._listeners):
            listener.on_temperature(old, value)


class Display:
    def on_temperature(self, old: float | None, new: float) -> None:
        print(f"Display: {new:.1f} °C")


class Alarm:
    def __init__(self, limit: float) -> None:
        self.limit = limit

    def on_temperature(self, old: float | None, new: float) -> None:
        if new > self.limit and (old is None or old <= self.limit):
            print(f"Alarm: above {self.limit} °C!")


sensor = Thermometer()
sensor.subscribe(Display())
sensor.subscribe(Alarm(limit=30))

for value in (25, 25, 31, 32, 29):
    sensor.temperature = value
```

Output:

```text
Display: 25.0 °C
Display: 31.0 °C
Alarm: above 30 °C!
Display: 32.0 °C
Display: 29.0 °C
```

The second `25` produces no output because the setter returns early. Passing the old value lets `Alarm` detect the *crossing* instead of firing on both `31` and `32`.

### Exercise 2

```python
from collections import defaultdict
from collections.abc import Callable
from typing import Any

Handler = Callable[..., None]


class EventEmitter:
    def __init__(self) -> None:
        self._handlers: defaultdict[str, list[Handler]] = defaultdict(list)

    def on(self, event: str, handler: Handler) -> Callable[[], None]:
        self._handlers[event].append(handler)

        def unsubscribe() -> None:
            if handler in self._handlers[event]:
                self._handlers[event].remove(handler)

        return unsubscribe

    def once(self, event: str, handler: Handler) -> Callable[[], None]:
        def wrapper(**data: Any) -> None:
            unsubscribe()  # remove first, so a re-entrant emit cannot call it twice
            handler(**data)

        unsubscribe = self.on(event, wrapper)
        return unsubscribe

    def emit(self, event: str, **data: Any) -> int:
        handlers = list(self._handlers.get(event, ()))  # copy: handlers may unsubscribe
        for handler in handlers:
            handler(**data)
        return len(handlers)


app = EventEmitter()
app.on("login", lambda user: print(f"audit: {user} logged in"))
app.once("login", lambda user: print(f"welcome tour for {user}"))

print(app.emit("login", user="olena"))
print(app.emit("login", user="olena"))
```

Output:

```text
audit: olena logged in
welcome tour for olena
2
audit: olena logged in
1
```

`once()` subscribes a wrapper, not the handler itself, and the wrapper removes itself before calling the handler. This only works because `emit()` iterates over a copy of the list. The `if handler in ...` check makes the unsubscribe function safe to call more than once.

### Exercise 3

```python
from collections.abc import Callable

Subscriber = Callable[[str], None]


class Publisher:
    def __init__(self) -> None:
        self._subscribers: list[Subscriber] = []

    def subscribe(self, subscriber: Subscriber) -> None:
        self._subscribers.append(subscriber)

    def notify(self, event: str) -> None:
        errors: list[Exception] = []
        for subscriber in list(self._subscribers):
            try:
                subscriber(event)
            except Exception as exc:
                exc.add_note(f"raised by subscriber {subscriber.__name__}")
                errors.append(exc)
        if errors:
            raise ExceptionGroup(f"{len(errors)} subscriber(s) failed", errors)


def mailer(event: str) -> None:
    raise ConnectionError("SMTP server unavailable")


def cache(event: str) -> None:
    print(f"cache: invalidated after {event!r}")


def stats(event: str) -> None:
    raise KeyError(event)


pub = Publisher()
for subscriber in (mailer, cache, stats):
    pub.subscribe(subscriber)

try:
    pub.notify("price_changed")
except* ConnectionError as group:
    for exc in group.exceptions:
        print("network problem:", exc, exc.__notes__)
except* KeyError as group:
    for exc in group.exceptions:
        print("bug:", repr(exc), exc.__notes__)
```

Output:

```text
cache: invalidated after 'price_changed'
network problem: SMTP server unavailable ['raised by subscriber mailer']
bug: KeyError('price_changed') ['raised by subscriber stats']
```

`cache` runs even though `mailer` failed before it. `add_note()` (Python 3.11+) attaches context without changing the exception type, and `except*` splits the group by type so each kind of failure gets its own handling.

---

*Sources: [Refactoring.Guru — Observer](https://refactoring.guru/design-patterns/observer), [Refactoring.Guru — Observer in Python](https://refactoring.guru/design-patterns/observer/python/example). Adapted and expanded for PyJourney.*
