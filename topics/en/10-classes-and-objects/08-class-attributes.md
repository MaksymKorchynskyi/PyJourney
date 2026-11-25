# Class Attributes

A **class attribute** is defined once, in the class body, and shared by every instance of the class. The topics Class Variables and Instance Variables showed how class attributes are stored and looked up. This topic is about using them well: deciding what belongs on the class and what belongs on each object, reading class attributes correctly inside methods, and the three classic jobs class attributes do.

## What you'll learn

- How to tell whether data should be an instance attribute or a class attribute
- How Python finds an attribute when you read it through an instance or through the class
- Three typical uses: class constants, data shared by all instances, and default values
- The difference between `self.attr`, `ClassName.attr` and `type(self).attr` inside methods, and why it matters for subclasses
- How a registry of instances can leak memory, and how `weakref.WeakSet` fixes it
- How class attributes differ from static fields in Java or C#, and how to mark them with `ClassVar`

## Instance attributes or class attributes?

Here is a simple `Circle` class:

```python
class Circle:
    def __init__(self, radius):
        self.pi = 3.14159
        self.radius = radius

    def area(self):
        return self.pi * self.radius**2

    def circumference(self):
        return 2 * self.pi * self.radius


small = Circle(1)
big = Circle(10)
print(vars(small))
print(vars(big))
print(big.area(), big.circumference())

small.pi = 3  # nothing stops one circle from using a different pi
print(small.area(), Circle(1).area())
```

Output:

```text
{'pi': 3.14159, 'radius': 1}
{'pi': 3.14159, 'radius': 10}
314.159 62.8318
3 3.14159
```

Both `pi` and `radius` are **instance attributes**: `__init__` assigns them through `self`, so every circle stores its own copy. That makes sense for `radius`, which really differs from circle to circle. It makes no sense for `pi`:

- every circle carries a copy of the same number;
- one circle can end up with a different value of pi, which is clearly a bug.

Ask one question about each piece of data: **does it describe this particular object, or the class as a whole?** Data about the whole class belongs on the class. To make `pi` a class attribute, assign it in the class body, outside any method:

```python
class Circle:
    pi = 3.14159

    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return self.pi * self.radius**2

    def circumference(self):
        return 2 * self.pi * self.radius


c = Circle(10)
print(c.pi)
print(Circle.pi)
print(vars(c))
print(c.area(), c.circumference())
```

Output:

```text
3.14159
3.14159
{'radius': 10}
314.159 62.8318
```

Now `pi` exists once, on the class, and `vars(c)` shows that the instance stores only its radius. You can read a class attribute in two ways:

```text
instance.class_attribute      c.pi
ClassName.class_attribute     Circle.pi
```

The methods still say `self.pi`. That works because reading an attribute through an instance falls back to the class, as the next section recalls.

> **Tip:** In real code use `math.pi`. `3.14159` is only an example of a constant that belongs to a class.

## How Python finds the attribute

When you read an attribute **through an instance**, Python looks in the instance's own attributes first, then in its class, then in the parent classes. When you read it **through the class**, the instance is not involved at all: Python starts with the class itself and continues with its parents. If nothing is found, you get an `AttributeError`.

So an instance attribute with the same name **shadows** the class attribute for that one instance:

```python
class Test:
    x = 10

    def __init__(self):
        self.x = 20


test = Test()
print(test.x)  # 20
print(Test.x)  # 10
```

`Test` has two attributes called `x`: one on the class (`10`) and one on each instance (`20`). `test.x` finds the instance attribute first. `Test.x` asks the class directly. The topic Instance Variables walks through this lookup step by step.

## Reading class attributes inside methods

A method has three ways to reach a class attribute, and they give different answers once subclasses or instance attributes are involved:

```python
class Product:
    default_discount = 0

    def __init__(self, price):
        self.price = price

    def discounts(self):
        return (
            Product.default_discount,     # always the value on Product
            type(self).default_discount,  # the value on the object's class
            self.default_discount,        # the object first, then its class
        )


class SaleProduct(Product):
    default_discount = 0.1  # overrides the inherited value


item = SaleProduct(100)
print(item.discounts())

item.default_discount = 0.5  # an instance attribute shadows both classes
print(item.discounts())
```

Output:

```text
(0, 0.1, 0.1)
(0, 0.1, 0.5)
```

| Expression | Looks at | Use it when |
|---|---|---|
| `self.attr` | the instance, then its class, then the parents | you want the most specific value, and allow a subclass or a single object to override it. This is the usual choice for **reading** |
| `type(self).attr` | the object's actual class, then the parents, ignoring the instance | you want the class-level value even if the instance shadows it |
| `ClassName.attr` | exactly that class, then its parents | you mean one specific, shared value that subclasses must not replace, such as a global counter |

For **writing**, never use `self.attr = ...` or `self.attr += 1`: that creates an instance attribute and leaves the class attribute unchanged (see Common mistakes). Assign through a class. Which class depends on what you want to count:

```python
class Shape:
    created = 0

    def __init__(self):
        Shape.created += 1        # one counter for all shapes
        type(self).made += 1      # a separate counter for each class


class Square(Shape):
    made = 0


class Triangle(Shape):
    made = 0


Square()
Square()
Triangle()
print(Shape.created, Square.made, Triangle.made)
```

Output:

```text
3 2 1
```

`Shape.created` always updates the one counter on `Shape`. `type(self).made` updates the counter of whichever class was instantiated. Here each subclass defines its own `made`, and `Shape` itself is meant to be used only through its subclasses.

## Use 1: class constants

A value that is the same for every instance and never changes is a natural class attribute. Keeping it on the class gives it a name, a single place to change it, and a clear owner:

```text
class Circle:            class HttpClient:            class Password:
    pi = 3.14159             TIMEOUT = 10                 MIN_LENGTH = 12
                             RETRIES = 3
```

Python has no real constants. By convention, names in `UPPER_CASE` mean "do not change this". Type checkers such as mypy and pyright can enforce it if you annotate the attribute with `typing.Final`, but at run time nothing stops an assignment:

```python
from typing import Final


class Circle:
    PI: Final = 3.14159  # a constant: type checkers forbid reassigning it


Circle.PI = 3  # mypy/pyright report an error here, but Python runs it
print(Circle.PI)
```

Output:

```text
3
```

## Use 2: data shared by all instances

Sometimes the class has to know about all its instances or about something they have in common. The following version of `Circle` keeps a list of every circle ever created:

```python
class Circle:
    circle_list = []
    pi = 3.14159

    def __init__(self, radius):
        self.radius = radius
        # add the instance to the circle list
        self.circle_list.append(self)

    def area(self):
        return self.pi * self.radius**2

    def circumference(self):
        return 2 * self.pi * self.radius


c1 = Circle(10)
c2 = Circle(20)

print(len(Circle.circle_list))  # 2
print([c.radius for c in Circle.circle_list])
print(vars(c1))
```

Output:

```text
2
[10, 20]
{'radius': 10}
```

`self.circle_list.append(self)` does not create an instance attribute, because it does not *assign* to `self.circle_list`. It finds the class's list and **mutates** it. Writing `Circle.circle_list.append(self)` does the same and makes it obvious to the reader that the list is shared.

### A registry keeps objects alive

A list holds **strong references** (see the topic References). As long as a circle is in `circle_list`, it can never be destroyed, even when the rest of the program has forgotten it. In a long-running program such a registry slowly eats memory. If the registry should only track objects that are still in use, store **weak references** in a `weakref.WeakSet`:

```python
import weakref


class Circle:
    circle_list = []  # strong references: keeps every circle alive

    def __init__(self, radius):
        self.radius = radius
        Circle.circle_list.append(self)


class TrackedCircle:
    alive = weakref.WeakSet()  # weak references: does not keep circles alive

    def __init__(self, radius):
        self.radius = radius
        TrackedCircle.alive.add(self)


c1, c2 = Circle(10), Circle(20)
t1, t2 = TrackedCircle(10), TrackedCircle(20)
del c2, t2

print("list:   ", [c.radius for c in Circle.circle_list])
print("WeakSet:", [t.radius for t in TrackedCircle.alive])
```

Output (CPython):

```text
list:    [10, 20]
WeakSet: [10]
```

After `del c2`, the second circle is still reachable through the list. After `del t2`, nothing else referred to that object, so it was destroyed and disappeared from the `WeakSet` automatically.

### Handing out unique IDs

Another classic shared value is a counter that gives every new object a unique number:

```python
class Ticket:
    _next_id = 1  # the id the next ticket will get

    def __init__(self, title):
        self.id = Ticket._next_id
        Ticket._next_id += 1
        self.title = title


tickets = [Ticket("Login fails"), Ticket("Typo on home page"), Ticket("Slow search")]
for t in tickets:
    print(t.id, t.title)
print("next id:", Ticket._next_id)
```

Output:

```text
1 Login fails
2 Typo on home page
3 Slow search
next id: 4
```

The `id` is stored on each instance (it is that ticket's data), while the counter lives on the class (it is data about all tickets). The leading underscore marks `_next_id` as internal, as described in the topic Private Attributes. This simple counter is not thread-safe: if several threads create tickets at once, protect the increment with a lock (see the topic Threading Lock).

## Use 3: default values

A class attribute can supply a default value that every instance starts with. Here every product gets the default discount when it is created:

```python
class Product:
    default_discount = 0

    def __init__(self, price):
        self.price = price
        self.discount = Product.default_discount

    def set_discount(self, discount):
        self.discount = discount

    def net_price(self):
        return self.price * (1 - self.discount)


p1 = Product(100)
print(p1.net_price())

p2 = Product(200)
p2.set_discount(0.05)
print(p2.net_price())
```

Output:

```text
100
190.0
```

The second result is `190.0`, not `190`: `1 - 0.05` is a `float`, so the product is a `float` too. The first stays an `int` because `1 - 0` is the integer `1`.

There is a second way to use a class attribute as a default: do not copy it in `__init__` at all, and let the attribute lookup **fall back** to the class until an instance sets its own value:

```python
class Product:
    discount = 0  # the default for every product without its own discount

    def __init__(self, price):
        self.price = price

    def net_price(self):
        return self.price * (1 - self.discount)


book = Product(100)
lamp = Product(200)
lamp.discount = 0.05  # lamp gets its own value

print(vars(book), vars(lamp))
print(book.net_price(), lamp.net_price())

Product.discount = 0.2  # a store-wide sale
print(book.net_price(), lamp.net_price())
```

Output:

```text
{'price': 100} {'price': 200, 'discount': 0.05}
100 190.0
80.0 190.0
```

The two styles behave differently when the class attribute changes later:

- **Fallback** (this example): every product that has no discount of its own follows the class value, including products created before the change. The store-wide sale applied to `book` at once.
- **Copy in `__init__`** (the previous example): each product keeps the value it got at creation. Changing the default affects only products created afterwards:

```python
class Product:
    default_discount = 0

    def __init__(self, price):
        self.price = price
        self.discount = self.default_discount  # copied once, at creation


book = Product(100)
Product.default_discount = 0.2
pen = Product(10)
print(book.discount, pen.discount)
```

Output:

```text
0 0.2
```

Choose the behaviour you need. Either way, class-level defaults are safe only for **immutable** values: numbers, strings, tuples, `None`. A mutable default such as a list is one object shared by every instance, which is the trap described in the topic Instance Variables.

## Class attributes vs. static fields in Java and C#

Class attributes resemble `static` fields in Java or C#, but they are not the same thing:

- **Assigning through an instance does not change the class attribute.** In Java, `obj.count = 5` writes the static field. In Python, `obj.count = 5` creates an instance attribute that shadows it.
- **Subclasses can override them.** A subclass that assigns the same name gets its own attribute. Code that reads `self.attr` then sees the subclass's value, as `SaleProduct` showed.
- **They are ordinary objects created at run time.** The class body runs once, when the `class` statement executes. You can add, change or delete class attributes later, and there is no compiler to check their types.

The fact that the class body runs **once** has a consequence that surprises many people:

```python
import time
from datetime import datetime


class Order:
    created_at = datetime.now()  # evaluated ONCE, when the class is defined

    def __init__(self, item):
        self.item = item


first = Order("book")
time.sleep(1.1)
second = Order("lamp")
print(first.created_at == second.created_at)
```

Output:

```text
True
```

Both orders report the moment the class was defined, not the moment they were created. Values that must be computed per object, like a timestamp, belong in `__init__`: `self.created_at = datetime.now()`.

## Type hints: `ClassVar`

In a normal class, an annotated name in the class body with a value is still a class attribute. But some tools treat annotations as declarations of **instance** fields. The most important one is `@dataclass` (mentioned in the topic `__init__`: Initializing Instance Attributes), which turns every annotated name into a constructor parameter. To declare a real class attribute there, annotate it with `typing.ClassVar`:

```python
from dataclasses import dataclass
from typing import ClassVar


@dataclass
class Circle:
    radius: float
    pi: ClassVar[float] = 3.14159  # a class attribute, not a field

    def area(self):
        return self.pi * self.radius**2


@dataclass
class BrokenCircle:
    radius: float = 1.0
    pi: float = 3.14159  # oops: this becomes a per-instance field


print(Circle(2), Circle(2).area())
print(BrokenCircle(2))
print(BrokenCircle(2, 3))
```

Output:

```text
Circle(radius=2) 12.56636
BrokenCircle(radius=2, pi=3.14159)
BrokenCircle(radius=2, pi=3)
```

With `ClassVar`, `pi` is not a field: it is not in `__init__` and not in the `repr`. Without it, `pi` became an ordinary field that every caller can override. Names in the class body **without** an annotation are never fields, so `pi = 3.14159` would also work in a dataclass. `ClassVar` makes the intent explicit, for both readers and type checkers.

## Common mistakes

- **Updating a shared value through `self`.** `self.count += 1` reads the class attribute but stores the result as a new instance attribute, so the class attribute never changes (the topic Python Object-oriented Programming shows it step by step). Write `ClassName.count += 1` or `type(self).count += 1`.
- **Hard-coding the class name where a subclass should be able to override.** `self.discount = Product.default_discount` ignores a subclass's `default_discount`. Read through `self` (see Exercise 3).
- **Storing per-instance data in a mutable class attribute.** A list or dict in the class body is shared by all instances. Create it in `__init__`.
- **Letting a registry keep every object alive.** A class-level list of instances is a memory leak in a long-running program. Use `weakref.WeakSet` or remove objects explicitly.
- **Computing per-object values in the class body.** `created_at = datetime.now()` in the class body runs once. Put it in `__init__`.
- **Expecting constants to be protected.** `UPPER_CASE` and `Final` are conventions checked by tools, not by Python at run time.
- **Forgetting `ClassVar` in a dataclass.** An annotated class attribute becomes a constructor field.

## Summary

- A class attribute is defined in the class body, outside any method, and is shared by all instances. Instance attributes, assigned through `self`, belong to one object.
- Put data on the class when it describes the class as a whole: constants, data about all instances, defaults.
- Read class attributes through the class (`Circle.pi`) or an instance (`c.pi`). Reading through an instance checks the instance first, then the class and its parents.
- Inside methods, `self.attr` respects subclasses and instance overrides, `type(self).attr` respects subclasses only, and `ClassName.attr` always means that one class.
- Assign to class attributes through a class, never through `self`.
- A class-level default can be copied in `__init__` (fixed at creation) or used as a lookup fallback (follows later changes). Use only immutable defaults.
- Registries of instances hold strong references. Use `weakref.WeakSet` when the registry must not keep objects alive.
- The class body runs once. In dataclasses and type hints, mark class attributes with `ClassVar`.

## Practice

### Exercise 1: Predict the output

Write down the four lines this program prints, then run it to check.

```python
class Animal:
    sound = "..."
    legs = 4

    def describe(self):
        return f"{type(self).__name__}: {self.sound}, {self.legs} legs (base: {Animal.sound})"


class Bird(Animal):
    sound = "tweet"
    legs = 2


class Dog(Animal):
    sound = "woof"


rex = Dog()
tweety = Bird()
tweety.legs = 1
print(rex.describe())
print(tweety.describe())
Animal.legs = 3
Animal.sound = "?"
print(rex.describe())
print(Bird().describe())
```

### Exercise 2: Invoice numbers

Create a class `Invoice` with a class constant `PREFIX = "INV"`, a class attribute `_next_number = 1001` and a counter `issued = 0`. Every new invoice stores its `amount` and gets a `number` such as `"INV-1001"`, and the counters are updated. Then create a subclass `CreditNote` with `PREFIX = "CN"` that **shares the same number sequence** with invoices but uses its own prefix. Create invoices of 250 and 99, a credit note of -99 and an invoice of 40, and print their numbers and amounts, the number of documents issued and the next number.

### Exercise 3: Fix the clearance discount

Clearance items should cost half price, but the program prints full prices. Find the bug and fix it. Then give one clearance item, a cable for 10, a special discount of 0.75 that applies to that object only.

```python
class Product:
    default_discount = 0

    def __init__(self, name, price):
        self.name = name
        self.price = price
        self.discount = Product.default_discount

    def net_price(self):
        return self.price * (1 - self.discount)


class ClearanceItem(Product):
    default_discount = 0.5


for item in [Product("lamp", 80), ClearanceItem("old phone", 120)]:
    print(item.name, item.net_price())
```

### Exercise 4: Limit open connections

Write a class `Connection` with a class constant `MAX_OPEN = 2` and a class attribute `_open`, a `weakref.WeakSet` of open connections. `Connection(name)` raises `RuntimeError` if `MAX_OPEN` connections are already open. `close()` removes the connection from the set. Write a function `show_open()` that prints the sorted names of open connections. Demonstrate: open `a` and `b`, fail to open `c`, close `a`, open `c`, then delete `b` without closing it and open `d`.

## Solutions

### Exercise 1

Output:

```text
Dog: woof, 4 legs (base: ...)
Bird: tweet, 1 legs (base: ...)
Dog: woof, 3 legs (base: ?)
Bird: tweet, 2 legs (base: ?)
```

- `Dog` overrides `sound` but inherits `legs` from `Animal`, so `rex` shows `4` and later `3`, after `Animal.legs` changed.
- `tweety.legs = 1` creates an instance attribute that shadows `Bird.legs` for `tweety` only. A new `Bird()` still has 2 legs, and the change of `Animal.legs` does not affect birds, because `Bird` defines its own `legs`.
- `Animal.sound` in `describe()` always reads the attribute on `Animal`, so it shows `...` before the change and `?` after it.

### Exercise 2

```python
class Invoice:
    PREFIX = "INV"
    _next_number = 1001  # shared by invoices and credit notes
    issued = 0

    def __init__(self, amount):
        self.amount = amount
        self.number = f"{self.PREFIX}-{Invoice._next_number}"
        Invoice._next_number += 1
        Invoice.issued += 1


class CreditNote(Invoice):
    PREFIX = "CN"


documents = [Invoice(250), Invoice(99), CreditNote(-99), Invoice(40)]
for doc in documents:
    print(doc.number, doc.amount)
print("issued:", Invoice.issued, "next number:", Invoice._next_number)
print("CreditNote has its own _next_number:", "_next_number" in vars(CreditNote))
```

Output:

```text
INV-1001 250
INV-1002 99
CN-1003 -99
INV-1004 40
issued: 4 next number: 1005
CreditNote has its own _next_number: False
```

`self.PREFIX` picks the subclass's prefix, which is exactly what should differ. `Invoice._next_number` names the class explicitly, so a credit note increments the shared counter. With `type(self)._next_number += 1`, the first credit note would have created a separate `_next_number` on `CreditNote`, and the two sequences would collide.

### Exercise 3

The bug is `Product.default_discount` in `__init__`: it always reads the value from `Product` (`0`) and ignores the override in `ClearanceItem`. Reading through `self` finds the most specific value:

```python
class Product:
    default_discount = 0

    def __init__(self, name, price):
        self.name = name
        self.price = price
        self.discount = self.default_discount  # respects subclasses

    def net_price(self):
        return self.price * (1 - self.discount)


class ClearanceItem(Product):
    default_discount = 0.5


lamp = Product("lamp", 80)
phone = ClearanceItem("old phone", 120)
cable = ClearanceItem("cable", 10)
cable.discount = 0.75  # a special offer for one item

for item in [lamp, phone, cable]:
    print(item.name, item.net_price())
```

Output:

```text
lamp 80
old phone 60.0
cable 2.5
```

`type(self).default_discount` would work just as well here. The special offer is an instance attribute, so it affects only `cable`.

### Exercise 4

```python
import weakref


class Connection:
    MAX_OPEN = 2
    _open = weakref.WeakSet()  # open connections, without keeping them alive

    def __init__(self, name):
        if len(Connection._open) >= Connection.MAX_OPEN:
            raise RuntimeError(f"cannot open {name!r}: limit of {Connection.MAX_OPEN} reached")
        self.name = name
        Connection._open.add(self)

    def close(self):
        Connection._open.discard(self)


def show_open():
    print("open:", sorted(c.name for c in Connection._open))


a = Connection("a")
b = Connection("b")
show_open()

try:
    c = Connection("c")
except RuntimeError as error:
    print(error)

a.close()
c = Connection("c")
show_open()

del b  # forgotten without close(): the WeakSet drops it
d = Connection("d")
show_open()
```

Output (CPython):

```text
open: ['a', 'b']
cannot open 'c': limit of 2 reached
open: ['b', 'c']
open: ['c', 'd']
```

`discard()` (unlike `remove()`) does nothing if the connection is not in the set, so calling `close()` twice is safe. After `del b` nothing refers to that connection any more, so CPython destroys it at once and the `WeakSet` forgets it. With a plain `set`, `b` would stay "open" forever and block new connections.

---

*Source: [pythontutorial.net — Python Class Attributes](https://www.pythontutorial.net/python-oop/python-class-attributes/). Adapted and expanded for PyJourney.*
