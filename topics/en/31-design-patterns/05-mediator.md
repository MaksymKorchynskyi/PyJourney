# Mediator

**Mediator** (also known as *Intermediary* or *Controller*) is a behavioral design pattern that tames a tangle of objects that all call each other. It forbids direct communication between those objects and makes them cooperate only through one special object, the mediator. Dialog windows, chat rooms, air traffic control and message buses all follow this idea.

## What you'll learn

- Which problem Mediator solves and why a web of direct links between objects is hard to change and to reuse
- The roles in the pattern: components, the mediator interface and the concrete mediator
- How to implement Mediator in Python, from the classic structure to a realistic dialog form
- How the same idea looks as a chat room and as an event bus, and where the line with Observer runs
- How Mediator differs from Facade and Observer
- The typical bugs: unlinked components, feedback loops, silent typos in event names and the "God object" mediator

## Intent

Reduce chaotic dependencies between objects. Instead of every object holding references to the others and calling them directly, each object (a **component**) only reports what happened to it to a **mediator**. The mediator knows how the components are supposed to work together and decides who should react.

Components stay unaware of each other. The sender does not know who will handle its notification, and the receiver does not know who triggered it.

## Problem

Take a dialog for creating and editing a customer profile. It is made of form controls: text fields, checkboxes, buttons. Some controls affect others:

- ticking "I have a dog" reveals a hidden field for the dog's name;
- the "Submit" button must check all visible fields before the data is saved;
- typing into a field might hide an old error message.

The straightforward implementation puts this logic into the controls themselves:

```python
class DogCheckbox:
    def __init__(self) -> None:
        self.checked = False
        self.dog_name_field: "TextField | None" = None  # knows a concrete neighbour

    def toggle(self) -> None:
        self.checked = not self.checked
        if self.dog_name_field is not None:
            self.dog_name_field.visible = self.checked  # pokes another widget directly


class TextField:
    def __init__(self, label: str) -> None:
        self.label = label
        self.value = ""
        self.visible = True


class SubmitButton:
    def __init__(self, fields: list[TextField]) -> None:
        self.fields = fields  # knows every field of this particular form

    def click(self) -> None:
        empty = [f.label for f in self.fields if f.visible and not f.value]
        print("missing:", empty if empty else "nothing, saving")


name = TextField("name")
dog_name = TextField("dog name")
dog_name.visible = False
has_dog = DogCheckbox()
has_dog.dog_name_field = dog_name
submit = SubmitButton([name, dog_name])

name.value = "Olena"
has_dog.toggle()
submit.click()
```

Output:

```text
missing: ['dog name']
```

It works, but look at the dependencies. `DogCheckbox` holds a reference to a specific text field, and `SubmitButton` holds a list of the fields of this particular form. You cannot reuse that checkbox in another form, because it insists on showing a dog's name field. You cannot reuse the button either, because it validates a profile. In the end you can use either all of these classes together or none of them.

As the application grows, every new rule adds another link between controls. With `n` components, the number of possible direct links grows like `n * (n - 1) / 2`, so ten controls can have up to 45 of them:

```text
 Direct links: everyone knows everyone      Mediator: a star with one centre

   [Checkbox]------[DogName]                    [Checkbox]     [DogName]
      |    \        /    |                            \         /
      |     [Submit]     |                             [Dialog]
      |    /        \    |                            /   |    \
   [Name]----------[Email]                     [Submit] [Name] [Email]
```

## Solution

Stop all direct communication between the components you want to make independent. A component that has something to say calls a **notification method on the mediator**, and the mediator redirects the call to the right components. Each component now depends on one object, not on a dozen colleagues.

In the profile example the **dialog itself** is the natural mediator. It already creates and knows all its controls, so making it responsible for their cooperation adds no new dependencies.

The biggest change happens inside the controls. The submit button no longer validates anything: its only job is to tell the dialog "I was clicked". The dialog then performs the validation itself or asks the fields to do it. The checkbox does not show any field: it reports "I was toggled", and the dialog decides what that means *in this dialog*.

You can loosen the coupling even more by extracting a common **mediator interface** with that notification method. Then the button works with *any* dialog that implements the interface, and the same button class can appear in a profile form, a login form and a settings window.

The complex web of relations ends up in one place, the mediator. The fewer dependencies a class has, the easier it is to change, extend and reuse it.

## Real-world analogy

Pilots approaching or leaving an airport do not negotiate with each other about who lands first. They talk only to the air traffic controller in the tower. Without the tower, every pilot would have to track every aircraft nearby and agree on priorities with a committee of strangers, which would end badly.

Note that the tower does not fly the planes and does not control the whole flight. It only enforces the rules in the busy area around the airport, where there are too many participants for each of them to coordinate with the others. A good mediator is the same: it coordinates, it does not do everybody's work.

## Structure

```text
                     +--------------------------------+
                     | <<Protocol>> Mediator          |
                     |--------------------------------|
                     | + notify(sender, event)        |
                     +--------------------------------+
                          ^                    ^
               implements :                    | every component holds a
                          :                    | reference typed as Mediator
+-------------------------------+   +-------------------------------+
| ConcreteMediator              |   | Component (base)              |
|-------------------------------|   |-------------------------------|
| - component_a                 |   | # mediator: Mediator          |
| - component_b                 |   +-------------------------------+
| - component_c                 |       ^           ^           ^
|-------------------------------|       |           |           |
| + notify(sender, event):      |  +---------+ +---------+ +---------+
|     if sender is a: b.do_x()  |  | CompA   | | CompB   | | CompC   |
|     if sender is c: a.do_y()  |  +---------+ +---------+ +---------+
+-------------------------------+
        | knows the concrete components and calls their methods
        +--------------------------> CompA, CompB, CompC
```

1. **Components** are classes with some business logic. Each one holds a reference to a mediator, typed as the **mediator interface**, so it does not know the mediator's concrete class. Link a component to a different mediator, and it works in a different program.
2. The **mediator interface** declares how components talk to the mediator. Usually that is a single notification method. Components may pass any context with it, including themselves, as long as the receiving component does not become coupled to the sender's class.
3. A **concrete mediator** encapsulates the relations between components. It usually keeps references to all the components it manages and sometimes even creates and destroys them.
4. Components must not know about other components. When something important happens in or to a component, it only notifies the mediator. The mediator can identify the sender, which is often enough to decide whom to trigger next. For a component, the rest of the system is a black box.

## Python implementation

### The structure in its pure form

This version follows the classic conceptual example: two components, a mediator that reacts to some of their events, and a client that triggers operations.

```python
from abc import ABC, abstractmethod


class Mediator(ABC):
    """The interface components use to report what happened to them."""

    @abstractmethod
    def notify(self, sender: object, event: str) -> None: ...


class BaseComponent:
    """Stores a reference to the mediator and nothing else."""

    def __init__(self, mediator: Mediator | None = None) -> None:
        self.mediator = mediator


# Concrete components do their own work and report to the mediator.
# They know neither each other nor the concrete mediator class.
class Component1(BaseComponent):
    def do_a(self) -> None:
        print("Component 1 does A.")
        self.mediator.notify(self, "A")

    def do_b(self) -> None:
        print("Component 1 does B.")
        self.mediator.notify(self, "B")


class Component2(BaseComponent):
    def do_c(self) -> None:
        print("Component 2 does C.")
        self.mediator.notify(self, "C")

    def do_d(self) -> None:
        print("Component 2 does D.")
        self.mediator.notify(self, "D")


class ConcreteMediator(Mediator):
    """All the "who reacts to what" rules live here."""

    def __init__(self, component1: Component1, component2: Component2) -> None:
        self._component1 = component1
        self._component2 = component2
        component1.mediator = self  # link the components back to the mediator
        component2.mediator = self

    def notify(self, sender: object, event: str) -> None:
        if event == "A":
            print("Mediator reacts on A and triggers following operations:")
            self._component2.do_c()
        elif event == "D":
            print("Mediator reacts on D and triggers following operations:")
            self._component1.do_b()
            self._component2.do_c()
        # "B" and "C" are reported too, but no rule reacts to them


c1 = Component1()
c2 = Component2()
mediator = ConcreteMediator(c1, c2)

print("Client triggers operation A.")
c1.do_a()
print()
print("Client triggers operation D.")
c2.do_d()
```

Output:

```text
Client triggers operation A.
Component 1 does A.
Mediator reacts on A and triggers following operations:
Component 2 does C.

Client triggers operation D.
Component 2 does D.
Mediator reacts on D and triggers following operations:
Component 1 does B.
Component 2 does C.
```

How the second scenario unfolds: the client calls `c2.do_d()`. Component 2 does its work and reports `"D"`. The mediator's rule for `"D"` says "now B, then C", so it calls `c1.do_b()` and `c2.do_c()`. Each of those reports its own event (`"B"`, `"C"`), but the mediator has no rule for them, so the chain stops. Neither component imported, named or called the other.

A few details differ from the version often found in tutorials, on purpose:

- **`@abstractmethod` on `notify()`.** A class that merely inherits from `ABC` is not abstract by itself. Without the decorator, a mediator subclass that forgot to implement `notify()` would be created without complaint and would silently swallow every event:

  ```python
  from abc import ABC, abstractmethod


  class LooseMediator(ABC):  # as in many tutorials: no @abstractmethod
      def notify(self, sender: object, event: str) -> None:
          pass


  class StrictMediator(ABC):
      @abstractmethod
      def notify(self, sender: object, event: str) -> None: ...


  class ForgotNotify(LooseMediator):
      pass


  class AlsoForgotNotify(StrictMediator):
      pass


  print(ForgotNotify().notify(None, "A"))  # silently does nothing
  try:
      AlsoForgotNotify()
  except TypeError as exc:
      print("TypeError:", exc)
  ```

  Output:

  ```text
  None
  TypeError: Can't instantiate abstract class AlsoForgotNotify without an implementation for abstract method 'notify'
  ```

- **`Mediator | None = None`.** When the default is `None`, the type hint must allow `None`. `mediator: Mediator = None` lies to type checkers.
- **A plain attribute instead of a property.** A getter and setter that only read and write `self._mediator` add nothing. Start with a plain attribute, and turn it into a property later if you ever need validation: the calling code will not change.
- **Order of definitions.** The components are defined before `ConcreteMediator`, so its annotations refer to names that already exist. The original example defines them later and therefore needs `from __future__ import annotations`. Since Python 3.14, annotations are evaluated lazily (PEP 649), and such forward references no longer fail even without that import.

### A realistic example: an authentication dialog

Now a closer-to-life case: a dialog that switches between "Log in" and "Register". A checkbox switches the mode, which shows one group of text fields and hides the other. The OK button either checks the credentials or creates an account, depending on the mode. Typing into any field clears the previous error.

The controls are generic: `Button`, `Textbox` and `Checkbox` know nothing about logins, e-mails or each other. All the rules live in `AuthenticationDialog`, which creates the controls and passes itself to them as their mediator:

```python
from typing import Protocol


class Mediator(Protocol):
    def notify(self, sender: "Component", event: str) -> None: ...


class Component:
    """A UI element. Its only channel to the outside world is the mediator."""

    def __init__(self, name: str, dialog: Mediator) -> None:
        self.name = name
        self.dialog = dialog
        self.visible = True

    def click(self) -> None:
        self.dialog.notify(self, "click")


class Button(Component):
    pass


class Textbox(Component):
    def __init__(self, name: str, dialog: Mediator) -> None:
        super().__init__(name, dialog)
        self.text = ""

    def enter(self, text: str) -> None:
        self.text = text
        self.dialog.notify(self, "keypress")


class Checkbox(Component):
    def __init__(self, name: str, dialog: Mediator) -> None:
        super().__init__(name, dialog)
        self.checked = False

    def check(self) -> None:
        self.checked = not self.checked
        self.dialog.notify(self, "check")


class AuthenticationDialog:
    """Concrete mediator: creates the elements and owns every rule between them."""

    def __init__(self, users: dict[str, str]) -> None:
        self.users = users
        self.title = ""
        self.error = ""
        self.logged_in: str | None = None
        # Each component receives the mediator (self) in its constructor.
        self.login_or_register = Checkbox("login_or_register", self)
        self.login_username = Textbox("login_username", self)
        self.login_password = Textbox("login_password", self)
        self.reg_username = Textbox("reg_username", self)
        self.reg_password = Textbox("reg_password", self)
        self.reg_email = Textbox("reg_email", self)
        self.ok = Button("ok", self)
        self.login_or_register.check()  # start in "Log in" mode

    def notify(self, sender: Component, event: str) -> None:
        match (sender.name, event):
            case ("login_or_register", "check"):
                self._switch_mode(login=self.login_or_register.checked)
            case ("ok", "click"):
                self._submit()
            case (_, "keypress"):
                self.error = ""  # typing hides the previous error message

    def _switch_mode(self, login: bool) -> None:
        self.title = "Log in" if login else "Register"
        self.error = ""
        for box in (self.login_username, self.login_password):
            box.visible = login
        for box in (self.reg_username, self.reg_password, self.reg_email):
            box.visible = not login

    def _submit(self) -> None:
        if self.login_or_register.checked:
            name, password = self.login_username.text, self.login_password.text
            if self.users.get(name) == password:
                self.logged_in = name
            else:
                self.error = "Wrong username or password"
        else:
            name = self.reg_username.text
            if "@" not in self.reg_email.text:
                self.error = "Invalid e-mail"
            else:
                self.users[name] = self.reg_password.text
                self.logged_in = name

    def render(self) -> None:
        visible = [c.name for c in vars(self).values()
                   if isinstance(c, Textbox) and c.visible]
        print(f"[{self.title}] fields={visible} error={self.error!r} user={self.logged_in}")


dialog = AuthenticationDialog(users={"olena": "s3cret"})
dialog.render()

dialog.login_username.enter("olena")
dialog.login_password.enter("wrong")
dialog.ok.click()
dialog.render()

dialog.login_or_register.check()        # switch to registration
dialog.render()
dialog.reg_username.enter("max")
dialog.reg_password.enter("qwerty")
dialog.reg_email.enter("max-at-example.com")
dialog.ok.click()
dialog.render()
dialog.reg_email.enter("max@example.com")
dialog.render()
dialog.ok.click()
dialog.render()
```

Output:

```text
[Log in] fields=['login_username', 'login_password'] error='' user=None
[Log in] fields=['login_username', 'login_password'] error='Wrong username or password' user=None
[Register] fields=['reg_username', 'reg_password', 'reg_email'] error='' user=None
[Register] fields=['reg_username', 'reg_password', 'reg_email'] error='Invalid e-mail' user=None
[Register] fields=['reg_username', 'reg_password', 'reg_email'] error='' user=None
[Register] fields=['reg_username', 'reg_password', 'reg_email'] error='' user=max
```

What to notice:

- **One communication channel.** A component only ever calls `self.dialog.notify(self, event)`. `Textbox.enter()` does not know that typing should clear an error. That rule belongs to this dialog, and another dialog might do something else on `"keypress"`, or nothing.
- **The mediator creates its components** and hands itself to each constructor. This is a common way to establish the link. It also means the mediator can be notified *during its own `__init__`*: the call `self.login_or_register.check()` already goes through `notify()`, which is why the components are created before it.
- **`match` on `(sender.name, event)`** (Python 3.10+) keeps the dispatch flat and readable. Matching on a name works well for UI elements that have IDs anyway. Alternatively, compare identities: `if sender is self.ok and event == "click"`, as in the exercise solutions below.
- The `Mediator` protocol makes the controls reusable: any object with a matching `notify()` method can host them. No inheritance from a dialog base class is required.

## Practical example: a chat room

A chat is the textbook mediator. Users never hold references to each other. They send everything to the room, and the room decides who receives what: everybody, one person via `@name`, or nobody, if the sender is muted.

```python
from typing import Protocol


class Room(Protocol):
    def send(self, sender: "User", text: str) -> None: ...


class User:
    """Component: can talk and listen, but holds no references to other users."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.room: Room | None = None

    def say(self, text: str) -> None:
        if self.room is None:
            raise RuntimeError(f"{self.name} has not joined a room")
        self.room.send(self, text)

    def receive(self, author: str, text: str) -> None:
        print(f"  {self.name:<6} <- {author}: {text}")


class ChatRoom:
    """Mediator: delivery rules (broadcast, @private, mute) live only here."""

    def __init__(self) -> None:
        self._members: dict[str, User] = {}
        self._muted: set[str] = set()

    def join(self, user: User) -> None:
        self._broadcast("system", f"{user.name} joined")
        self._members[user.name] = user
        user.room = self

    def mute(self, name: str) -> None:
        self._muted.add(name)

    def send(self, sender: User, text: str) -> None:
        if sender.name in self._muted:
            sender.receive("system", "you are muted")
        elif text.startswith("@"):
            target, _, body = text[1:].partition(" ")
            if target in self._members:
                self._members[target].receive(sender.name, f"(private) {body}")
            else:
                sender.receive("system", f"no user named {target!r}")
        else:
            self._broadcast(sender.name, text, skip=sender.name)

    def _broadcast(self, author: str, text: str, skip: str = "") -> None:
        for name, member in self._members.items():
            if name != skip:
                member.receive(author, text)


room = ChatRoom()
olena, max_, ira = User("olena"), User("max"), User("ira")
for user in (olena, max_, ira):
    room.join(user)

print("olena says hi:")
olena.say("hi all")
print("max whispers:")
max_.say("@ira lunch?")
max_.say("@bob are you here?")
print("ira is muted:")
room.mute("ira")
ira.say("SPAM SPAM SPAM")
```

Output:

```text
  olena  <- system: max joined
  olena  <- system: ira joined
  max    <- system: ira joined
olena says hi:
  max    <- olena: hi all
  ira    <- olena: hi all
max whispers:
  ira    <- max: (private) lunch?
  max    <- system: no user named 'bob'
ira is muted:
  ira    <- system: you are muted
```

All delivery rules (broadcast, private messages, unknown recipients, muting) live in `ChatRoom`. To add a "slow mode", a profanity filter or message history, you change the room, not the users. To give users completely different rules, you write another room class, and `User` stays as it is. Exercise 3 does exactly that.

The room also manages membership: `join()` links the user to the mediator by setting `user.room`. Before joining, a user has no mediator, and `say()` raises a clear error instead of failing with `AttributeError` on `None`.

### Mediator built on Observer: an event bus

A popular way to implement a mediator is to make it a **publisher** that components subscribe to. Components never call each other. They publish events to the bus and subscribe to the events they care about:

```python
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class OrderPlaced:
    order_id: int
    item: str
    total: float


@dataclass(frozen=True)
class PaymentFailed:
    order_id: int
    item: str


class EventBus:
    """Mediator as a publisher: components subscribe to event types."""

    def __init__(self) -> None:
        self._handlers: defaultdict[type, list[Callable]] = defaultdict(list)

    def subscribe(self, event_type: type, handler: Callable) -> None:
        self._handlers[event_type].append(handler)

    def publish(self, event: object) -> None:
        for handler in list(self._handlers[type(event)]):
            handler(event)


class Inventory:
    def __init__(self, bus: EventBus) -> None:
        bus.subscribe(OrderPlaced, self.reserve)
        bus.subscribe(PaymentFailed, self.release)

    def reserve(self, event: OrderPlaced) -> None:
        print(f"Inventory: reserved {event.item} for order {event.order_id}")

    def release(self, event: PaymentFailed) -> None:
        print(f"Inventory: released {event.item}")


class Billing:
    def __init__(self, bus: EventBus, balance: float) -> None:
        self.bus = bus
        self.balance = balance
        bus.subscribe(OrderPlaced, self.charge)

    def charge(self, event: OrderPlaced) -> None:
        if event.total > self.balance:
            print(f"Billing: order {event.order_id} declined")
            self.bus.publish(PaymentFailed(event.order_id, event.item))
        else:
            self.balance -= event.total
            print(f"Billing: charged {event.total}, balance {self.balance}")


bus = EventBus()
Inventory(bus)
Billing(bus, balance=100)

bus.publish(OrderPlaced(1, "keyboard", 60))
bus.publish(OrderPlaced(2, "monitor", 250))
```

Output:

```text
Inventory: reserved keyboard for order 1
Billing: charged 60, balance 40
Inventory: reserved monitor for order 2
Billing: order 2 declined
Inventory: released monitor
```

`Inventory` and `Billing` know only the bus and the event classes. Billing does not call `inventory.release()`. It announces `PaymentFailed`, and whoever cares reacts.

This version shows why Mediator and Observer are easy to confuse. Compare it with the dialog:

- In `AuthenticationDialog` the **mediator owns the rules**: it alone knows that the OK button means "log in or register". That is Mediator in its classic form, and it has no subscriptions at all.
- In `EventBus` the bus only routes messages, and the rules ("on `PaymentFailed`, release the item") are spread across the subscribers. The more logic moves out of the centre, the more the design becomes a plain Observer.

Both are legitimate. A central mediator is easier to read: all interactions are in one place. A bus is easier to extend: a new reaction is just one more subscriber. See the topic Observer for subscriptions, unsubscribing and weak references.

### Where you meet Mediator

- **GUI code.** This is the most common use of the pattern in Python. A window or dialog class (in tkinter, Qt or any other toolkit) creates the widgets, connects their callbacks to its own methods and coordinates them.
- **MVC.** The *Controller* in Model-View-Controller often plays the mediator between the view and the model: the view reports user actions, the controller decides how the model changes and what the view shows.
- **Message brokers and buses** (RabbitMQ, Kafka, an in-process event bus) act as mediators between services that never call each other directly.
- **Orchestrators.** A workflow or "saga" orchestrator that tells the payment, warehouse and delivery services what to do next is a mediator at the architecture level.

## When to use it

- Some classes are **hard to change** because they are tightly coupled to many other classes. The mediator pulls all those relationships into one class, so a change in one component no longer ripples through the others.
- You **cannot reuse a component** in another program because it depends on too many other components. After the refactoring, a component only needs some mediator to talk to, so you can give it a new one in the new context.
- You create **many component subclasses** only to make the same basic component behave differently in different contexts ("a checkbox that shows the dog field", "a checkbox that enables the email field"). With a mediator, the collaboration rules move into mediator classes, and the components stay generic.

Do not use it for two or three objects with one simple interaction. A direct call is easier to follow than a notification routed through a central object.

## How to implement it

1. Find a group of tightly coupled classes that would benefit from being independent (easier maintenance, simpler reuse).
2. Declare the mediator interface: a `Protocol` or an abstract class. In most cases a single method such as `notify(sender, event)` is enough. This interface is what lets you reuse components with other mediators.
3. Implement the concrete mediator. Consider keeping references to all its components, so any rule can reach any component.
4. Optionally, make the mediator responsible for creating and destroying its components. Then it starts to resemble a factory or a facade.
5. Give every component a reference to the mediator. Usually it is passed to the component's constructor.
6. Change the components so that they call the mediator's notification method instead of methods of other components. Move the code that used to call other components into the mediator, and run it when the corresponding notification arrives.

## Pros and cons

**Pros:**

- *Single Responsibility Principle*: communication between components is extracted into one place, where it is easier to understand and maintain.
- *Open/Closed Principle*: you can introduce new mediators, that is new ways for the components to collaborate, without changing the components.
- Coupling between components drops sharply: each depends on one interface instead of many classes.
- Individual components become reusable in other contexts.

**Cons:**

- Over time a mediator can grow into a **God object** that knows and controls everything. Its size is the price of the components' simplicity.
- The flow of control becomes indirect. To see what a click does, you read the mediator, not the button.
- The mediator is a central point that everything depends on: a bug in it affects every interaction.

## Relations with other patterns

- **Chain of Responsibility, Command, Mediator and Observer** connect senders and receivers in different ways. Chain of Responsibility passes a request along a dynamic chain of receivers until one of them handles it. Command creates a one-way link from a sender to a receiver. Mediator removes direct links and makes components communicate through a mediator object. Observer lets receivers subscribe to and unsubscribe from requests dynamically.
- **Facade vs Mediator.** Both organize work with many tightly coupled classes. A Facade gives a *simpler interface* to a subsystem and adds no new behavior. The subsystem does not know the facade exists, and its objects still talk to each other directly. A Mediator *centralizes communication*: components know the mediator and do not communicate directly at all.
- **Mediator vs Observer.** The goal of Mediator is to eliminate mutual dependencies among a set of components, which then depend on one mediator object. The goal of Observer is to set up dynamic one-way connections in which some objects follow others. A popular implementation of Mediator relies on Observer: the mediator is a publisher, and the components subscribe to its events (the event bus above). Then the two look very much alike. However, you can also link all components permanently to the same mediator without any subscriptions (the dialog above), and that is still Mediator. And a program where every component is a publisher has no central mediator at all, only a distributed set of observers.
- **Mediator and Factory/Facade.** A mediator that creates and destroys its components takes on part of a factory's job, and from the outside it may look like a facade.

## Common mistakes

- **A component that is not linked to a mediator.** If the mediator is attached after construction (as in the conceptual example), it is easy to forget, and the first event fails far from the real cause:

  ```python
  class Button:
      def __init__(self, mediator=None) -> None:
          self.mediator = mediator

      def click(self) -> None:
          self.mediator.notify(self, "click")


  button = Button()  # nobody linked it to a dialog
  try:
      button.click()
  except AttributeError as exc:
      print("AttributeError:", exc)
  ```

  Output:

  ```text
  AttributeError: 'NoneType' object has no attribute 'notify'
  ```

  Prefer passing the mediator to the constructor as a required argument, or raise a clear error when it is missing (as `User.say()` does in the chat example).

- **Feedback loops.** The mediator reacts to an event by changing a component, the component reports the change, the mediator reacts again, and so on:

  ```python
  class Field:
      def __init__(self, name: str, mediator: "SyncMediator") -> None:
          self.name = name
          self.mediator = mediator
          self.value = 0

      def set(self, value: int) -> None:
          self.value = value
          self.mediator.notify(self, "changed")


  class SyncMediator:
      """Keeps two fields equal. BUG: reacts to the changes it makes itself."""

      def __init__(self) -> None:
          self.a = Field("a", self)
          self.b = Field("b", self)

      def notify(self, sender: Field, event: str) -> None:
          other = self.b if sender is self.a else self.a
          other.set(sender.value)  # this triggers notify() again, and again...


  m = SyncMediator()
  try:
      m.a.set(5)
  except RecursionError:
      print("RecursionError")
  ```

  Output:

  ```text
  RecursionError
  ```

  Break the cycle: notify only about **real** changes, or give components a way to update their state without notifying (for example a `set_silently()` method or a `notify=False` flag). Here the first option is enough: add `if value == self.value: return` at the top of `Field.set()`. The mediator's second call then finds the value already equal and stops, and `m.a.set(5)` leaves both fields at `5`.

- **Typos in string event names.** `notify(self, "clik")` matches no rule, and nothing happens. No error, no warning. Use an `Enum` (`StrEnum` since Python 3.11) for event names, and make the mediator reject unknown events:

  ```python
  from enum import StrEnum


  class Event(StrEnum):
      CLICK = "click"
      CHECK = "check"


  class Dialog:
      def notify(self, sender: object, event: Event) -> None:
          match event:
              case Event.CLICK:
                  print("submitting the form")
              case Event.CHECK:
                  print("switching the mode")
              case _:
                  raise ValueError(f"unknown event {event!r} from {sender!r}")


  dialog = Dialog()
  dialog.notify("ok-button", Event.CLICK)
  try:
      dialog.notify("ok-button", "clik")  # a typo no longer disappears silently
  except ValueError as exc:
      print("ValueError:", exc)
  try:
      Event.CLIK
  except AttributeError as exc:
      print("AttributeError:", exc)
  ```

  Output:

  ```text
  submitting the form
  ValueError: unknown event 'clik' from 'ok-button'
  AttributeError: type object 'Event' has no attribute 'CLIK'
  ```

- **A God-object mediator.** The mediator should *coordinate*, not do the components' work. If it validates e-mails, formats prices and talks to the database, move that logic back into components or services, and keep in the mediator only "when X happens, ask Y to do Z". When one mediator becomes huge, split it: one mediator per dialog or per use case, not one per application.
- **Components that still talk to each other.** If a button keeps one "small" direct call to a text field, the coupling is back, and the mediator no longer describes all interactions. Every interaction between components goes through the mediator.
- **Components that depend on the concrete mediator.** A button that calls `self.dialog.validate_profile()` works only inside a profile dialog. Components should use nothing but the mediator interface (`notify()`), otherwise they cannot be reused.

## Summary

- Mediator replaces a web of direct links between objects with a star: components talk only to the mediator, and the mediator decides who reacts.
- Components keep a reference typed as the mediator interface, usually with a single `notify(sender, event)` method. They know neither each other nor the concrete mediator.
- The concrete mediator holds the collaboration rules and often creates and owns its components, as a dialog owns its widgets.
- New mediators give the same components new ways to collaborate (Open/Closed Principle) and make the components reusable.
- A mediator can be built on Observer (an event bus), but a mediator without any subscriptions is still a mediator. Facade, unlike Mediator, only simplifies access and leaves the subsystem's internal links intact.
- Watch out for unlinked components, feedback loops and string-typo events, and keep the mediator from growing into a God object.

## Practice

### Exercise 1: Control tower

Model an airport with one runway. Write a `Plane(callsign, tower)` component with methods `request_landing()`, `vacate_runway()` and `receive(message)`, and a `Tower` mediator. If the runway is free, the tower clears the plane to land. If it is busy, the tower tells the plane to hold and puts it in a queue, reporting its position. When the plane on the runway vacates it, the tower clears the next plane in the queue. A plane that is not on the runway must not be able to "vacate" it. Planes must not know about each other.

### Exercise 2: Untangle the profile form

Rewrite the code from the "Problem" section with a mediator. Create generic components `TextField`, `Checkbox` (with `toggle()`) and `Button` (with `click()`) that know only a `Mediator` protocol, and a `ProfileDialog` mediator with the fields "name" and "dog name", the checkbox "I have a dog" and a "Submit" button. Ticking the checkbox shows the dog name field, unticking it hides the field **and clears its value**. Submit lists the empty visible fields or reports saving. Then prove that the components are reusable: build a second mediator, `NewsletterDialog`, with a checkbox and a button that prints whether the user subscribed, using the same component classes without changing them.

### Exercise 3: A moderated room

Using the `User` class from the chat example unchanged, write a new mediator `ModeratedRoom(banned, max_strikes=2)`. It broadcasts messages to everyone except the author, but replaces banned words with `***` (case-insensitive, ignoring trailing punctuation such as `!` or `?`). Each message with a banned word is a strike: on the first strikes the author receives a warning, and when the author reaches `max_strikes`, they are muted and everyone in the room is told so. Muted users get a "you are muted" reply instead of having their messages delivered.

## Solutions

### Exercise 1

```python
from collections import deque
from typing import Protocol


class ControlTower(Protocol):
    def notify(self, sender: "Plane", event: str) -> None: ...


class Plane:
    def __init__(self, callsign: str, tower: ControlTower) -> None:
        self.callsign = callsign
        self.tower = tower

    def request_landing(self) -> None:
        print(f"{self.callsign}: requesting landing")
        self.tower.notify(self, "landing_request")

    def vacate_runway(self) -> None:
        print(f"{self.callsign}: runway vacated")
        self.tower.notify(self, "runway_vacated")

    def receive(self, message: str) -> None:
        print(f"  tower -> {self.callsign}: {message}")


class Tower:
    """Mediator: the only object that knows about the runway and the queue."""

    def __init__(self) -> None:
        self.on_runway: Plane | None = None
        self.waiting: deque[Plane] = deque()

    def notify(self, sender: Plane, event: str) -> None:
        match event:
            case "landing_request":
                if self.on_runway is None:
                    self._clear(sender)
                else:
                    self.waiting.append(sender)
                    sender.receive(f"hold, you are number {len(self.waiting)}")
            case "runway_vacated" if sender is self.on_runway:
                self.on_runway = None
                if self.waiting:
                    self._clear(self.waiting.popleft())
            case _:
                raise ValueError(f"unexpected {event!r} from {sender.callsign}")

    def _clear(self, plane: Plane) -> None:
        self.on_runway = plane
        plane.receive("cleared to land")


tower = Tower()
ps101, lo282, w61001 = (Plane(c, tower) for c in ("PS101", "LO282", "W61001"))

ps101.request_landing()
lo282.request_landing()
w61001.request_landing()
ps101.vacate_runway()
lo282.vacate_runway()

try:
    ps101.vacate_runway()  # PS101 is not on the runway anymore
except ValueError as exc:
    print("ValueError:", exc)
```

Output:

```text
PS101: requesting landing
  tower -> PS101: cleared to land
LO282: requesting landing
  tower -> LO282: hold, you are number 1
W61001: requesting landing
  tower -> W61001: hold, you are number 2
PS101: runway vacated
  tower -> LO282: cleared to land
LO282: runway vacated
  tower -> W61001: cleared to land
PS101: runway vacated
ValueError: unexpected 'runway_vacated' from PS101
```

The queue and the runway state exist only in `Tower`. A plane only reports events and receives instructions. The guard `case "runway_vacated" if sender is self.on_runway` makes the tower reject a report that does not fit its state, so a confused plane cannot free the runway for someone else.

### Exercise 2

```python
from typing import Protocol


class Mediator(Protocol):
    def notify(self, sender: object, event: str) -> None: ...


# Generic components: none of them knows any other component.
class TextField:
    def __init__(self, label: str, dialog: Mediator) -> None:
        self.label = label
        self.dialog = dialog
        self.value = ""
        self.visible = True


class Checkbox:
    def __init__(self, label: str, dialog: Mediator) -> None:
        self.label = label
        self.dialog = dialog
        self.checked = False

    def toggle(self) -> None:
        self.checked = not self.checked
        self.dialog.notify(self, "toggle")


class Button:
    def __init__(self, label: str, dialog: Mediator) -> None:
        self.label = label
        self.dialog = dialog

    def click(self) -> None:
        self.dialog.notify(self, "click")


class ProfileDialog:
    def __init__(self) -> None:
        self.name = TextField("name", self)
        self.dog_name = TextField("dog name", self)
        self.dog_name.visible = False
        self.has_dog = Checkbox("I have a dog", self)
        self.submit = Button("Submit", self)

    def notify(self, sender: object, event: str) -> None:
        if sender is self.has_dog and event == "toggle":
            self.dog_name.visible = self.has_dog.checked
            if not self.dog_name.visible:
                self.dog_name.value = ""  # a hidden field must not keep stale data
        elif sender is self.submit and event == "click":
            fields = (self.name, self.dog_name)
            missing = [f.label for f in fields if f.visible and not f.value]
            print("missing:", missing if missing else "nothing, saving")


class NewsletterDialog:
    """A different form reusing the very same Checkbox and Button classes."""

    def __init__(self) -> None:
        self.subscribe = Checkbox("Send me news", self)
        self.send = Button("Send", self)

    def notify(self, sender: object, event: str) -> None:
        if sender is self.send:
            print("subscribed" if self.subscribe.checked else "not subscribed")


profile = ProfileDialog()
profile.name.value = "Olena"
profile.submit.click()
profile.has_dog.toggle()
profile.submit.click()
profile.dog_name.value = "Rex"
profile.submit.click()

newsletter = NewsletterDialog()
newsletter.send.click()
newsletter.subscribe.toggle()
newsletter.send.click()
```

Output:

```text
missing: nothing, saving
missing: ['dog name']
missing: nothing, saving
not subscribed
subscribed
```

`Checkbox` and `Button` are used by two different dialogs with completely different rules, and their classes were not touched. That is the reuse the coupled version made impossible. Clearing the dog's name when the field is hidden is a rule of this form, so it lives in the mediator, not in `Checkbox` or `TextField`.

### Exercise 3

```python
from typing import Protocol


class Room(Protocol):
    def send(self, sender: "User", text: str) -> None: ...


class User:
    """Exactly the same component as in the ChatRoom example."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.room: Room | None = None

    def say(self, text: str) -> None:
        if self.room is None:
            raise RuntimeError(f"{self.name} has not joined a room")
        self.room.send(self, text)

    def receive(self, author: str, text: str) -> None:
        print(f"  {self.name:<6} <- {author}: {text}")


class ModeratedRoom:
    """A new mediator: new collaboration rules, no change to User."""

    def __init__(self, banned: set[str], max_strikes: int = 2) -> None:
        self.banned = {word.lower() for word in banned}
        self.max_strikes = max_strikes
        self._members: dict[str, User] = {}
        self._strikes: dict[str, int] = {}
        self._muted: set[str] = set()

    def join(self, user: User) -> None:
        self._members[user.name] = user
        user.room = self

    def send(self, sender: User, text: str) -> None:
        if sender.name in self._muted:
            sender.receive("moderator", "you are muted")
            return
        words = text.split()
        clean = " ".join(
            "***" if w.strip(".,!?").lower() in self.banned else w for w in words
        )
        if clean != " ".join(words):
            self._strike(sender)
        if sender.name not in self._muted:
            self._broadcast(sender.name, clean, skip=sender.name)

    def _strike(self, user: User) -> None:
        self._strikes[user.name] = self._strikes.get(user.name, 0) + 1
        if self._strikes[user.name] >= self.max_strikes:
            self._muted.add(user.name)
            self._broadcast("moderator", f"{user.name} is muted")
        else:
            user.receive("moderator", "warning: watch your language")

    def _broadcast(self, author: str, text: str, skip: str = "") -> None:
        for name, member in self._members.items():
            if name != skip:
                member.receive(author, text)


room = ModeratedRoom(banned={"darn", "heck"})
olena, max_ = User("olena"), User("max")
room.join(olena)
room.join(max_)

max_.say("hello there")
max_.say("what the Heck!")
max_.say("darn it")
max_.say("sorry")
```

Output:

```text
  olena  <- max: hello there
  max    <- moderator: warning: watch your language
  olena  <- max: what the ***
  olena  <- moderator: max is muted
  max    <- moderator: max is muted
  max    <- moderator: you are muted
```

`User` is the same class as in the practical example, and it does not care whether it is in a `ChatRoom` or a `ModeratedRoom`: it only calls `room.send()`. The whole moderation policy (word list, strikes, muting, announcements) is a new mediator. The message that triggers the mute is not delivered at all, because the room checks the muted set again after counting the strike.

---

*Sources: [Refactoring.Guru — Mediator](https://refactoring.guru/design-patterns/mediator), [Refactoring.Guru — Mediator in Python](https://refactoring.guru/design-patterns/mediator/python/example). Adapted and expanded for PyJourney.*
