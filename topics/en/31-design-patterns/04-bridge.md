# Bridge

**Bridge** is a structural design pattern that splits a large class, or a set of closely related classes, into two separate hierarchies: an **abstraction** and an **implementation**. The two are connected by a reference (the "bridge") and can then evolve independently. It is the standard cure for a class hierarchy that grows in two directions at once and multiplies into dozens of combination classes.

## What you'll learn

- How "extending in two dimensions" with inheritance leads to a class explosion
- What *abstraction* and *implementation* mean in this pattern (and what they do not mean)
- How to build a bridge in Python by replacing inheritance with composition
- A practical example: message types and delivery channels as two independent hierarchies
- How to switch the implementation at runtime
- How Bridge differs from Adapter and Strategy, and where it meets Abstract Factory and Builder

## Intent

Bridge separates *what* an object does at a high level from *how* the low-level work is carried out on a particular platform. The high-level side (the abstraction) holds a reference to an object of the low-level side (the implementation) and delegates to it. Each side gets its own class hierarchy, and any abstraction can work with any implementation.

## Problem

Say you have a `Shape` class with two subclasses, `Circle` and `Square`. Now you want colours, so you plan `Red` and `Blue` variants. Because there are already two shapes, you need four classes: `RedCircle`, `BlueCircle`, `RedSquare`, `BlueSquare`. Add a triangle and you need two more. Add green and you need three more. The count is the *product* of the dimensions:

```python
from itertools import product

shapes = ["Circle", "Square", "Triangle"]
colors = ["Red", "Blue", "Green"]

combined = [color + shape for shape, color in product(shapes, colors)]
print(len(combined), "subclasses:", ", ".join(combined))
print(len(shapes) + len(colors), "classes if the dimensions are kept separate")
```

Output:

```text
9 subclasses: RedCircle, BlueCircle, GreenCircle, RedSquare, BlueSquare, GreenSquare, RedTriangle, BlueTriangle, GreenTriangle
6 classes if the dimensions are kept separate
```

The root cause is that the shape classes are being extended in **two independent dimensions**, form and colour, using inheritance alone. Inheritance can only grow a hierarchy along one axis cleanly. Every additional axis multiplies the classes.

The same thing happens in real applications. A GUI (one dimension: a simple view for customers, a detailed one for administrators) that runs on several operating systems (another dimension: Windows, Linux, macOS) quickly turns into a tangle of conditionals or a grid of `CustomerWindowsView`, `AdminLinuxView`, and so on. Changing anything requires understanding the whole tangle.

## Solution

Bridge switches from inheritance to **composition**. Extract one of the dimensions into a separate class hierarchy, and let the original classes *refer to* an object of that hierarchy instead of containing all its state and behaviour.

For the shapes, extract colour into its own hierarchy, `Color` with `Red` and `Blue`. `Shape` gets a field that points to a colour object and delegates colour-related work to it. That reference is the bridge. From now on, a new colour does not touch the shape hierarchy, and a new shape does not touch the colour hierarchy: 3 + 3 classes instead of 3 × 3.

### Abstraction and implementation

The original description of the pattern (in the "Gang of Four" book) uses two words that sound more frightening than they are:

- **Abstraction** (sometimes called the *interface*) is the high-level control layer for something. It does not do the real work itself, it delegates to the implementation layer.
- **Implementation** (sometimes called the *platform*) is the layer that does the actual low-level work.

These are **not** the same as abstract classes or `Protocol`s in Python. They are roles. In a real application the abstraction might be the GUI and the implementation the operating system API that the GUI calls when the user clicks something. You can then extend the app in two independent directions: add GUIs (for customers, for admins) and add platforms (Windows, Linux, macOS). The GUI objects delegate to whichever platform object they were given, so the same GUI works everywhere, and supporting another OS means adding one class to the implementation hierarchy.

## Real-world analogy

Think of a car's controls and its engine. The driver's interface is a steering wheel, pedals and a gear selector. It is the same whether the car underneath runs on petrol, diesel or electricity, and the engine can be swapped for another type without redesigning the dashboard. Manufacturers also offer a "sport" interior with paddle shifters and a launch-control button. That is a refined abstraction: it adds controls, but it still drives whatever engine is fitted, through the same connection. Interiors and engines are developed by different teams, and any interior can be paired with any engine.

## Structure

```text
+------------------------------+  bridge  +------------------------------+
|         Abstraction          |<>------->|        <<interface>>         |
|------------------------------|          |        Implementation        |
| - impl: Implementation       |          |------------------------------|
| + feature1()                 |          | + method1()                  |
| + feature2()                 |          | + method2()                  |
+------------------------------+          | + method3()                  |
               ^                          +------------------------------+
               | inherits                        ^                ^
+------------------------------+                 |   implements   |
|      RefinedAbstraction      |   +--------------------+ +--------------------+
|------------------------------|   | ConcreteImplA      | | ConcreteImplB      |
| + feature3()                 |   | (platform A code)  | | (platform B code)  |
+------------------------------+   +--------------------+ +--------------------+

feature1():
    self.impl.method1()        # high-level logic built on low-level primitives
    self.impl.method2()

Client:
    abstraction = RefinedAbstraction(ConcreteImplA())   # the client links the two
```

1. **Abstraction** provides the high-level control logic. It relies on the implementation object for the actual low-level work.
2. **Implementation** declares the interface common to all concrete implementations. The abstraction communicates with an implementation only through these methods. The two interfaces do not have to match: usually the implementation offers *primitive* operations, and the abstraction builds *higher-level* operations on top of them.
3. **Concrete Implementations** contain platform-specific code.
4. **Refined Abstractions** provide variants of the control logic. Like their parent, they work with any implementation through the implementation interface.
5. **Client** usually works only with the abstraction, but it is the client's job to link the abstraction with an implementation object.

## Python implementation

Remote controls (abstraction) and devices (implementation). Every remote works with every device through the general device interface, so remotes and devices can be developed separately.

```python
from abc import ABC, abstractmethod


class Device(ABC):
    """Implementation: primitive operations that every device supports."""

    def __init__(self) -> None:
        self.enabled = False
        self.channel = 1
        self._volume = 30

    @property
    def volume(self) -> int:
        return self._volume

    @volume.setter
    def volume(self, percent: int) -> None:
        self._volume = max(0, min(100, percent))  # the device guards its own range

    @abstractmethod
    def status(self) -> str: ...


class Tv(Device):
    def status(self) -> str:
        power = "on" if self.enabled else "off"
        return f"TV {power}, channel {self.channel}, volume {self.volume}%"


class Radio(Device):
    def status(self) -> str:
        power = "on" if self.enabled else "off"
        frequency = 87.5 + (self.channel - 1) * 0.5
        return f"Radio {power}, {frequency:.1f} FM, volume {self.volume}%"


class RemoteControl:
    """Abstraction: high-level controls that delegate to a Device."""

    def __init__(self, device: Device) -> None:
        self.device = device  # the bridge

    def toggle_power(self) -> None:
        self.device.enabled = not self.device.enabled

    def volume_up(self) -> None:
        self.device.volume += 10

    def volume_down(self) -> None:
        self.device.volume -= 10

    def channel_up(self) -> None:
        self.device.channel += 1

    def channel_down(self) -> None:
        self.device.channel = max(1, self.device.channel - 1)


class AdvancedRemoteControl(RemoteControl):
    """Refined abstraction: new features, still only via the Device interface."""

    def mute(self) -> None:
        self.device.volume = 0

    def jump_to(self, channel: int) -> None:
        self.device.channel = channel


def evening(remote: RemoteControl) -> None:
    # The client works with any remote and any device.
    remote.toggle_power()
    remote.channel_up()
    remote.channel_up()
    remote.volume_up()
    print(remote.device.status())


evening(RemoteControl(Tv()))
evening(RemoteControl(Radio()))

advanced = AdvancedRemoteControl(Radio())
evening(advanced)
advanced.mute()
advanced.jump_to(42)
print(advanced.device.status())
```

Output:

```text
TV on, channel 3, volume 40%
Radio on, 88.5 FM, volume 40%
Radio on, 88.5 FM, volume 40%
Radio on, 108.0 FM, volume 0%
```

Two remotes and two devices give four working combinations with four classes. A third device (say a projector) would work with both remotes immediately, and a third remote would work with all devices.

Because the link is just an attribute, the implementation can also be replaced **at runtime**:

```python
# Continues the previous example
advanced.device = Tv()  # point the same remote at another device
advanced.toggle_power()
advanced.jump_to(7)
for _ in range(10):
    advanced.volume_up()  # the TV clamps the volume at 100
print(advanced.device.status())
```

Output:

```text
TV on, channel 7, volume 100%
```

> **Note:** Runtime switching is optional. The main point of Bridge is the *structural* split into two independent hierarchies. That is also why it is so often confused with Strategy, which is all about swapping behaviour at runtime. A pattern is not only a class layout: it also tells readers which problem you are solving.

## A practical example: notifications over different channels

A service sends several kinds of notifications: plain notices, urgent alerts and reminders. Each must be deliverable by e-mail, SMS or a team chat. With inheritance alone that is 3 × 3 = 9 classes, and every new channel adds three more. With Bridge, the *kind* of notification (what to say and how to phrase it) is the abstraction, and the *channel* (how to deliver it, including its limits) is the implementation.

```python
from abc import ABC, abstractmethod


class MessageSender(ABC):
    """Implementation: how a message physically travels."""

    @abstractmethod
    def deliver(self, to: str, subject: str, body: str) -> str: ...


class EmailSender(MessageSender):
    def deliver(self, to: str, subject: str, body: str) -> str:
        return f"email to {to} | Subject: {subject} | {body}"


class SmsSender(MessageSender):
    LIMIT = 40  # the channel knows its own constraints

    def deliver(self, to: str, subject: str, body: str) -> str:
        text = f"{subject}: {body}"
        if len(text) > self.LIMIT:
            text = text[: self.LIMIT - 3] + "..."
        return f"sms to {to} | {text}"


class ChatSender(MessageSender):
    def __init__(self, channel: str) -> None:
        self.channel = channel

    def deliver(self, to: str, subject: str, body: str) -> str:
        return f"chat #{self.channel} | @{to} *{subject}* {body}"


class Notification:
    """Abstraction: decides what to say, delegates delivery."""

    def __init__(self, sender: MessageSender) -> None:
        self.sender = sender

    def notify(self, to: str, message: str) -> str:
        return self.sender.deliver(to, "Notice", message)


class UrgentNotification(Notification):
    def notify(self, to: str, message: str) -> str:
        return self.sender.deliver(to, "URGENT", message.upper() + "!")


class ReminderNotification(Notification):
    def __init__(self, sender: MessageSender, when: str) -> None:
        super().__init__(sender)
        self.when = when

    def notify(self, to: str, message: str) -> str:
        return self.sender.deliver(to, f"Reminder for {self.when}", message)


for sender in (EmailSender(), SmsSender(), ChatSender("ops")):
    print(Notification(sender).notify("olena", "Invoice 42 is ready"))
    print(UrgentNotification(sender).notify("olena", "Disk is 95% full"))
    print(ReminderNotification(sender, "Fri 10:00").notify("taras", "Team retro in room 3"))
```

Output:

```text
email to olena | Subject: Notice | Invoice 42 is ready
email to olena | Subject: URGENT | DISK IS 95% FULL!
email to taras | Subject: Reminder for Fri 10:00 | Team retro in room 3
sms to olena | Notice: Invoice 42 is ready
sms to olena | URGENT: DISK IS 95% FULL!
sms to taras | Reminder for Fri 10:00: Team retro in...
chat #ops | @olena *Notice* Invoice 42 is ready
chat #ops | @olena *URGENT* DISK IS 95% FULL!
chat #ops | @taras *Reminder for Fri 10:00* Team retro in room 3
```

Nine combinations, six classes. Look at the division of responsibilities:

- Notification classes decide the **wording**: subject line, upper case, reminder time. They know nothing about SMS limits or chat syntax.
- Sender classes decide the **delivery**: format, length limits, channel names. They know nothing about urgency or reminders.

Adding push notifications means one new `MessageSender` subclass, and all three kinds of notification support it immediately.

## When to use it

- **You want to divide and organise a monolithic class that has several variants of some functionality**, for example a class that can work with various database servers. The larger such a class grows, the harder it is to understand, and a change to one variant can break the others. Bridge splits it into hierarchies you can change independently.
- **You need to extend a class in several orthogonal (independent) dimensions.** Extract a separate hierarchy for each dimension, and let the original class delegate the related work to objects of those hierarchies.
- **You need to switch implementations at runtime.** Optional, but easy: the abstraction just gets a new object in its implementation field.

Typical real-world cases: cross-platform applications, support for several database engines or file systems, and code that talks to several providers of the same kind of API (cloud platforms, payment providers, social networks).

## How to implement it

1. Identify the orthogonal dimensions in your classes: abstraction/platform, domain/infrastructure, front end/back end, interface/implementation.
2. Decide which operations the client needs and define them in the base abstraction class.
3. Determine the operations available on all platforms. Declare the ones the abstraction needs in the general implementation interface (an `ABC` or a `Protocol`).
4. Create concrete implementation classes for every platform, all following the implementation interface.
5. Add a field of the implementation type to the abstraction class. The abstraction delegates most of its work to the object in that field.
6. If there are several variants of high-level logic, create refined abstractions by subclassing the base abstraction.
7. The client passes an implementation object to the abstraction's constructor to link them. After that, it works only with the abstraction.

## Pros and cons

| Pros | Cons |
|---|---|
| Platform-independent classes and applications. | Applying it to a highly cohesive class just adds indirection and complexity. |
| The client works with high-level abstractions and is not exposed to platform details. | You must design the implementation interface carefully: it has to serve every abstraction. |
| *Open/Closed Principle*: new abstractions and implementations are added independently. | The extra layer of delegation makes the code a little harder to follow. |
| *Single Responsibility Principle*: high-level logic lives in the abstraction, platform details in the implementation. | Best designed up front; retrofitting it into a tangled hierarchy takes effort. |

## Relations with other patterns

- **Bridge** is usually designed up front, so that parts of an application can be developed independently. **Adapter** is usually added to an existing app to make incompatible classes cooperate.
- **Bridge**, **State**, **Strategy** and, to some degree, **Adapter** have very similar structures: all are based on composition and delegation. They solve different problems, and the name of the pattern communicates which one.
- **Abstract Factory** pairs well with Bridge when some abstractions can work only with specific implementations. The factory encapsulates the valid pairings and hides them from the client.
- **Builder** can be combined with Bridge: the director plays the role of the abstraction, and the different builders act as implementations.

## Common mistakes

- **The implementation interface simply mirrors the abstraction.** If `Device` had `toggle_power()`, `mute()` and `jump_to()`, every device would reimplement the remote's logic. Give the implementation *primitives* (enabled flag, volume, channel) and build higher-level operations in the abstraction.
- **The abstraction checks which implementation it has.** Code such as `if isinstance(self.device, Radio): ...` in the remote ties the two hierarchies back together. If an abstraction needs something, add it to the implementation interface.
- **Creating the implementation inside the abstraction.** `self.device = Tv()` in `RemoteControl.__init__` hard-wires one combination. Let the client pass the implementation in.
- **Using Bridge for a single dimension.** If a class varies in only one way, plain inheritance or a Strategy-style callable is enough. Bridge pays off when there are two independent axes of change.
- **Pretending the dimensions are independent when they are not.** If only some pairs are valid, enforce that explicitly, for example with an Abstract Factory, instead of letting invalid combinations fail at runtime.

## Summary

- Bridge splits one hierarchy that varies in two dimensions into two hierarchies connected by composition.
- The abstraction holds the high-level logic and delegates low-level work to an implementation object through a common interface.
- "Abstraction" and "implementation" are roles, not Python abstract classes. Typical pairs: GUI/OS, domain/infrastructure, message type/delivery channel.
- Classes grow as a sum (M + N) instead of a product (M × N), and each side can be extended without touching the other.
- The implementation can be swapped at runtime by assigning a new object, but the essence of the pattern is the structural split.
- Bridge looks like Strategy and Adapter on a diagram; the difference is the intent.

## Practice

### Exercise 1: Shapes and colours

Implement the example from the *Problem* section. `Color` is the implementation with a method `fill() -> str` (`Red` returns `"red"`, `Blue` returns `"blue"`). `Shape` is the abstraction with `draw() -> str`. `Circle(color, radius)` draws `"circle r=2 filled with red"`, and `Square(color, side)` draws `"square 3x3 filled with blue"`. Then add `Green` **without changing any shape class**, and print every shape/colour combination.

### Exercise 2: Untangle the documents

Refactor this code into a bridge. Documents (`Invoice`, `Receipt`) should be the abstraction. Renderers (`HtmlRenderer`, `TextRenderer`) should be the implementation, offering the primitives `heading(text)` and `line(label, value)`. Then add a `MarkdownRenderer` and show that both documents support it without changes.

```python
class HtmlInvoice:
    def render(self, number: int, total: float) -> str:
        return f"<h1>Invoice {number}</h1><p>Total: {total:.2f}</p>"


class TextInvoice:
    def render(self, number: int, total: float) -> str:
        return f"INVOICE {number}\nTotal: {total:.2f}"


class HtmlReceipt:
    def render(self, number: int, total: float) -> str:
        return f"<h1>Receipt {number}</h1><p>Paid: {total:.2f}</p><p>Thank you!</p>"


class TextReceipt:
    def render(self, number: int, total: float) -> str:
        return f"RECEIPT {number}\nPaid: {total:.2f}\nThank you!"
```

### Exercise 3: Repositories over storage backends

Build a `UserRepository` (abstraction) that stores users through a `StorageBackend` (implementation) with three primitives: `put(key, value)`, `get(key)` and `keys()`. Values are strings, so the repository serialises users to JSON itself. Provide two backends: `MemoryBackend` (a dict) and `SqliteBackend` (an in-memory `sqlite3` database with a key-value table). The repository needs `add(user_id, name, email)` and `find_by_domain(domain) -> list[str]` built only on the primitives. Run the same scenario on both backends.

## Solutions

### Exercise 1

```python
from abc import ABC, abstractmethod


class Color(ABC):
    @abstractmethod
    def fill(self) -> str: ...


class Red(Color):
    def fill(self) -> str:
        return "red"


class Blue(Color):
    def fill(self) -> str:
        return "blue"


class Shape(ABC):
    def __init__(self, color: Color) -> None:
        self.color = color

    @abstractmethod
    def draw(self) -> str: ...


class Circle(Shape):
    def __init__(self, color: Color, radius: float) -> None:
        super().__init__(color)
        self.radius = radius

    def draw(self) -> str:
        return f"circle r={self.radius} filled with {self.color.fill()}"


class Square(Shape):
    def __init__(self, color: Color, side: float) -> None:
        super().__init__(color)
        self.side = side

    def draw(self) -> str:
        return f"square {self.side}x{self.side} filled with {self.color.fill()}"


# Added later: no shape class was touched.
class Green(Color):
    def fill(self) -> str:
        return "green"


for color in (Red(), Blue(), Green()):
    print(Circle(color, radius=2).draw())
    print(Square(color, side=3).draw())
```

Output:

```text
circle r=2 filled with red
square 3x3 filled with red
circle r=2 filled with blue
square 3x3 filled with blue
circle r=2 filled with green
square 3x3 filled with green
```

### Exercise 2

```python
from abc import ABC, abstractmethod


class Renderer(ABC):
    """Implementation: low-level formatting primitives."""

    @abstractmethod
    def heading(self, text: str) -> str: ...

    @abstractmethod
    def line(self, label: str, value: str) -> str: ...

    def join(self, parts: list[str]) -> str:
        return "\n".join(parts)


class HtmlRenderer(Renderer):
    def heading(self, text: str) -> str:
        return f"<h1>{text}</h1>"

    def line(self, label: str, value: str) -> str:
        return f"<p>{label}{': ' if value else ''}{value}</p>"

    def join(self, parts: list[str]) -> str:
        return "".join(parts)


class TextRenderer(Renderer):
    def heading(self, text: str) -> str:
        return text.upper()

    def line(self, label: str, value: str) -> str:
        return f"{label}: {value}" if value else label


class Document(ABC):
    """Abstraction: decides the content, delegates the formatting."""

    def __init__(self, renderer: Renderer) -> None:
        self.renderer = renderer

    @abstractmethod
    def render(self, number: int, total: float) -> str: ...


class Invoice(Document):
    def render(self, number: int, total: float) -> str:
        r = self.renderer
        return r.join([r.heading(f"Invoice {number}"), r.line("Total", f"{total:.2f}")])


class Receipt(Document):
    def render(self, number: int, total: float) -> str:
        r = self.renderer
        return r.join([
            r.heading(f"Receipt {number}"),
            r.line("Paid", f"{total:.2f}"),
            r.line("Thank you!", ""),
        ])


class MarkdownRenderer(Renderer):  # new platform: one class, every document supports it
    def heading(self, text: str) -> str:
        return f"## {text}"

    def line(self, label: str, value: str) -> str:
        return f"- **{label}** {value}".rstrip()


for renderer in (HtmlRenderer(), TextRenderer(), MarkdownRenderer()):
    for document in (Invoice(renderer), Receipt(renderer)):
        print(document.render(17, 249.5))
    print()
```

Output:

```text
<h1>Invoice 17</h1><p>Total: 249.50</p>
<h1>Receipt 17</h1><p>Paid: 249.50</p><p>Thank you!</p>

INVOICE 17
Total: 249.50
RECEIPT 17
Paid: 249.50
Thank you!

## Invoice 17
- **Total** 249.50
## Receipt 17
- **Paid** 249.50
- **Thank you!**
```

The HTML and text output are exactly what the four original classes produced. Four combination classes became 2 + 2 classes, and the third renderer cost one class instead of two.

### Exercise 3

```python
import json
import sqlite3
from abc import ABC, abstractmethod


class StorageBackend(ABC):
    """Implementation: primitive key-value operations."""

    @abstractmethod
    def put(self, key: str, value: str) -> None: ...

    @abstractmethod
    def get(self, key: str) -> str | None: ...

    @abstractmethod
    def keys(self) -> list[str]: ...


class MemoryBackend(StorageBackend):
    def __init__(self) -> None:
        self._data: dict[str, str] = {}

    def put(self, key: str, value: str) -> None:
        self._data[key] = value

    def get(self, key: str) -> str | None:
        return self._data.get(key)

    def keys(self) -> list[str]:
        return sorted(self._data)


class SqliteBackend(StorageBackend):
    def __init__(self) -> None:
        self._db = sqlite3.connect(":memory:")
        self._db.execute("CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT)")

    def put(self, key: str, value: str) -> None:
        with self._db:
            self._db.execute("INSERT OR REPLACE INTO kv VALUES (?, ?)", (key, value))

    def get(self, key: str) -> str | None:
        row = self._db.execute("SELECT value FROM kv WHERE key = ?", (key,)).fetchone()
        return row[0] if row else None

    def keys(self) -> list[str]:
        return [key for (key,) in self._db.execute("SELECT key FROM kv ORDER BY key")]


class UserRepository:
    """Abstraction: domain operations built on storage primitives."""

    def __init__(self, backend: StorageBackend) -> None:
        self.backend = backend

    def add(self, user_id: int, name: str, email: str) -> None:
        self.backend.put(f"user:{user_id}", json.dumps({"name": name, "email": email}))

    def find_by_domain(self, domain: str) -> list[str]:
        found = []
        for key in self.backend.keys():
            raw = self.backend.get(key)
            if raw is None:
                continue
            user = json.loads(raw)
            if user["email"].endswith("@" + domain):
                found.append(user["name"])
        return found


for backend in (MemoryBackend(), SqliteBackend()):
    repo = UserRepository(backend)
    repo.add(1, "Olena", "olena@example.com")
    repo.add(2, "Taras", "taras@test.org")
    repo.add(3, "Iryna", "iryna@example.com")
    print(f"{type(backend).__name__}: {repo.find_by_domain('example.com')}")
```

Output:

```text
MemoryBackend: ['Olena', 'Iryna']
SqliteBackend: ['Olena', 'Iryna']
```

`UserRepository` contains the domain logic once. Supporting another storage engine (files, Redis, a cloud key-value store) means writing one more backend with three methods. Adding another repository (for orders, say) reuses every backend that already exists.

---

*Sources: [Refactoring.Guru — Bridge](https://refactoring.guru/design-patterns/bridge), [Refactoring.Guru — Bridge in Python](https://refactoring.guru/design-patterns/bridge/python/example). Adapted and expanded for PyJourney.*
