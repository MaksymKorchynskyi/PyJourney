# Readonly Property

A **read-only property** has a getter but no setter: code can read `obj.x`, but `obj.x = ...` raises an error. Read-only properties are the natural way to expose values that must not be reassigned from outside, such as an ID, and values that are **computed** from other attributes, such as the area of a circle.

## What you'll learn

- How to make a property read-only and what happens when someone tries to change it
- Why "read-only" in Python is a convention, not real protection
- What computed properties are and when to use a property instead of a method
- How to cache an expensive computed property and reset the cache when its inputs change
- How `functools.cached_property` works and how it differs from a read-only property

## A property with only a getter

If you define a property with `@property` and never add `@<name>.setter`, the property has no `fset`. Reading works, assigning and deleting fail:

```python
class Order:
    def __init__(self, order_id, total):
        self._order_id = order_id
        self.total = total

    @property
    def order_id(self):
        return self._order_id


order = Order("A-1001", 250)
print(order.order_id)

order.total = 300  # an ordinary attribute can change
print(order.total)

try:
    order.order_id = "B-2002"
except AttributeError as error:
    print("AttributeError:", error)

try:
    del order.order_id
except AttributeError as error:
    print("AttributeError:", error)
```

Output:

```text
A-1001
300
AttributeError: property 'order_id' of 'Order' object has no setter
AttributeError: property 'order_id' of 'Order' object has no deleter
```

Python 3.10 and older print the shorter `can't set attribute` and `can't delete attribute`.

Note that `__init__` assigns `self._order_id`, not `self.order_id`. A read-only property has no setter even for the class itself, so the initial value goes straight into the underlying attribute. This is the one place where writing to `_order_id` directly is correct.

> **Tip:** Make an attribute read-only when changing it after creation would make the object inconsistent: an order ID, a creation timestamp, a user's login. Values that may legitimately change should stay ordinary attributes or get a validating setter.

## Read-only is a convention, not a lock

The property blocks the public name, but the data still lives in an ordinary instance attribute. Nothing stops code from writing to it:

```python
class Order:
    def __init__(self, order_id):
        self._order_id = order_id

    @property
    def order_id(self):
        return self._order_id


order = Order("A-1001")
order._order_id = "HACKED"
print(order.order_id)
```

Output:

```text
HACKED
```

Python has no truly private attributes. The leading underscore says "internal, don't touch", and a read-only property says "this is not meant to be assigned". Together they prevent **accidents** and document intent, but they don't stop someone who deliberately reaches inside. That is the usual Python attitude: protect users from mistakes, not from themselves.

> **Note:** If a whole object should be immutable, look at `@dataclass(frozen=True)` or `typing.NamedTuple`. They block assignment to every field, which is simpler than writing a read-only property for each one.

## Computed properties

A property does not have to return a stored value. It can **compute** the value from other attributes each time it is read. Here is a circle with an `area()` method:

```python
import math


class Circle:
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return math.pi * self.radius ** 2


c = Circle(10)
print(c.area())
```

Output:

```text
314.1592653589793
```

It works, but the area is a characteristic of the circle, just like its radius, so it reads more naturally as an attribute. Decorate the method with `@property`:

```python
import math


class Circle:
    def __init__(self, radius):
        self.radius = radius

    @property
    def area(self):
        return math.pi * self.radius ** 2


c = Circle(10)
print(c.area)

c.radius = 1
print(c.area)

try:
    c.area = 100
except AttributeError as error:
    print("AttributeError:", error)
```

Output:

```text
314.1592653589793
3.141592653589793
AttributeError: property 'area' of 'Circle' object has no setter
```

`area` is a **computed** (or *calculated*) property. Because it is recalculated from `radius` on every read, it is always up to date: there is no stored area that could get out of sync. It is also naturally read-only, because "set the area to 100" has no obvious meaning.

### Property or method?

Both `c.area` and `c.area()` are valid designs. A common rule of thumb:

| Use a property when... | Use a method when... |
|---|---|
| the value is a characteristic of the object (a noun: `area`, `full_name`, `is_empty`) | the call performs an action (a verb: `save()`, `send()`, `resize()`) |
| it is cheap to compute | it is slow, does I/O or may fail for external reasons |
| it needs no arguments | it needs arguments |
| reading it has no side effects | it changes state |

Code that reads `obj.area` expects an instant, harmless attribute access. Hiding a database query or a long calculation behind a property surprises the reader.

## Caching a computed property

A computed property recalculates its value on every read. For `math.pi * r ** 2` this costs nothing. But if the calculation is expensive, such as parsing a big file or aggregating thousands of records, repeating it on every access is wasteful. The fix is **caching**:

1. Store the computed value in a private attribute (the cache) the first time it is needed.
2. Return the stored value on later reads.
3. Reset the cache whenever an input of the computation changes.

Step 3 is the hard part. If `radius` were an ordinary attribute, the class would never notice that it changed. So `radius` becomes a property too, and its setter resets the cache. The `print()` inside `area` is there only to show when the computation really runs:

```python
import math


class Circle:
    def __init__(self, radius):
        self.radius = radius

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        if value < 0:
            raise ValueError("The radius cannot be negative")
        self._radius = value
        self._area = None  # reset the cache

    @property
    def area(self):
        if self._area is None:
            print("computing the area...")
            self._area = math.pi * self._radius ** 2
        return self._area


c = Circle(10)
print(c.area)
print(c.area)

c.radius = 2
print(c.area)

try:
    c.radius = -1
except ValueError as error:
    print("ValueError:", error)
print(c.radius)
```

Output:

```text
computing the area...
314.1592653589793
314.1592653589793
computing the area...
12.566370614359172
ValueError: The radius cannot be negative
2
```

How it works:

- `__init__` assigns `self.radius`, so the setter runs, validates the value and creates the empty cache `_area = None`.
- The first read of `area` sees an empty cache, computes the value and stores it. The second read returns the stored value without computing.
- Assigning a new radius resets the cache, so the next read computes the area again.
- An invalid radius is rejected before anything is changed, so the old radius and the cached area stay valid.

> **Note:** `None` works as the "not computed yet" marker here because a real area is never `None`. If `None` could be a valid result, use a dedicated marker object instead, for example `_MISSING = object()`, and check `if self._area is _MISSING`.

## `functools.cached_property`

The standard library has a ready-made decorator for "compute once, then remember": `functools.cached_property` (Python 3.8+). On the first read it calls your method and stores the result in the instance's `__dict__` **under the same name**. Later reads find the value in `__dict__` and never call the method again:

```python
from functools import cached_property


class Dataset:
    def __init__(self, values):
        self.values = list(values)

    @cached_property
    def mean(self):
        print("computing the mean...")
        return sum(self.values) / len(self.values)


data = Dataset([3, 5, 10])
print(data.mean)
print(data.mean)
print(data.__dict__)

data.values.append(100)
print(data.mean)  # stale: the cache knows nothing about the change

del data.mean     # drop the cached value
print(data.mean)

data.mean = 0     # assignment is allowed
print(data.mean)
```

Output:

```text
computing the mean...
6.0
6.0
{'values': [3, 5, 10], 'mean': 6.0}
6.0
computing the mean...
29.5
0
```

Important differences from a read-only property:

- **It is not read-only.** `cached_property` is a *non-data descriptor* (it has no `__set__`), so the value in the instance `__dict__` wins, and assigning simply overwrites the cache.
- **It never refreshes itself.** When the inputs change, the cached value becomes stale until you `del` it. It suits values that depend on data that does not change after creation.
- **It needs an instance `__dict__`.** Classes that use `__slots__` without `__dict__` raise `TypeError` on the first read.

> **Note:** Before Python 3.12, `cached_property` used an internal lock so that the method ran only once even with many threads. The lock was removed in 3.12; in threaded code the method may now run more than once for the same object, so add your own lock if that matters.

Choosing between the three tools:

| Tool | Computed | Can be assigned | Refreshes when inputs change |
|---|---|---|---|
| `@property` (getter only) | on every read | no | always up to date |
| `@property` with a manual cache | once, until reset | no | if your setters reset the cache |
| `@cached_property` | once | yes | only after `del obj.name` |

## Common mistakes

- **Assigning a read-only property in `__init__`.** `self.order_id = order_id` goes through the property, which has no setter:

  ```python
  class Order:
      def __init__(self, order_id):
          self.order_id = order_id

      @property
      def order_id(self):
          return self._order_id


  try:
      Order("A-1001")
  except AttributeError as error:
      print("AttributeError:", error)
  ```

  Output:

  ```text
  AttributeError: property 'order_id' of 'Order' object has no setter
  ```

  Assign the underlying attribute (`self._order_id = order_id`) instead.

- **Caching without resetting.** If an input of the computation is an ordinary attribute, changes to it don't reset the cache, and the property returns a stale value:

  ```python
  import math


  class Circle:
      def __init__(self, radius):
          self.radius = radius  # plain attribute, no setter
          self._area = None

      @property
      def area(self):
          if self._area is None:
              self._area = math.pi * self.radius ** 2
          return self._area


  c = Circle(10)
  print(round(c.area, 2))
  c.radius = 1
  print(round(c.area, 2))  # still the area of radius 10
  ```

  Output:

  ```text
  314.16
  314.16
  ```

  Every input of a cached value must go through code that resets the cache.

- **Treating read-only as security.** The underscored attribute can still be changed. Read-only properties prevent accidents, not deliberate changes.
- **Putting slow or side-effecting code in a property.** Use a method with a verb in its name instead.
- **Expecting `cached_property` to be read-only or to update itself.** It can be overwritten and must be reset manually with `del`.
- **Caching cheap values.** A cache adds state and a chance of stale data. Cache only when the computation is really expensive.

## Summary

- A property without a setter is read-only: assigning raises `AttributeError: property '...' of '...' object has no setter`, and `del` fails the same way.
- Initialise the underlying attribute (`self._x`) directly in `__init__`, because the property has no setter.
- Read-only is a convention: the underscored attribute can still be changed on purpose.
- A computed property derives its value from other attributes on every read, so it is always consistent with them.
- Use properties for cheap, argument-free characteristics; use methods for actions and expensive work.
- To cache an expensive computed property, store the result in a private attribute and reset it in the setters of every input.
- `functools.cached_property` computes the value once and stores it in the instance `__dict__`; it is assignable, never refreshes itself, and is reset with `del`.

## Practice

### Exercise 1: Rectangle

Write a `Rectangle` class with ordinary attributes `width` and `height` and two read-only computed properties: `area` and `perimeter`. Show that both update after `width` changes, and that `r.area = 10` raises `AttributeError`.

### Exercise 2: A bank account

Write a `BankAccount` class with:

- a read-only `number` (set once in `__init__`);
- a read-only `balance` that starts at `0`;
- methods `deposit(amount)` and `withdraw(amount)` that change the balance. Both reject amounts that are not positive with `ValueError("Amount must be positive")`, and `withdraw` raises `ValueError("Insufficient funds")` if the balance would go below zero.

Show that the balance changes only through the methods and that `account.balance = 1_000_000` fails.

### Exercise 3: A lazy word count

Write a `Document` class with a `text` property (getter and setter) and a read-only `word_count` property that is computed lazily and cached. Count how many times the words are actually counted in an attribute `computations`. Reading `word_count` twice must count once; assigning a new `text` must reset the cache.

### Exercise 4: Predict the output

Predict every line, then run the code.

```python
from functools import cached_property


class Profile:
    def __init__(self, first, last):
        self.first = first
        self.last = last

    @property
    def full_name(self):
        return f"{self.first} {self.last}"

    @cached_property
    def initials(self):
        return self.first[0] + self.last[0]


p = Profile("Ada", "Lovelace")
print(p.full_name, p.initials)

p.first = "Grace"
print(p.full_name, p.initials)

p.initials = "??"
print(p.initials)

try:
    p.full_name = "Alan Turing"
except AttributeError as error:
    print("AttributeError:", error)

del p.initials
print(p.initials)
```

## Solutions

### Exercise 1

```python
class Rectangle:
    def __init__(self, width, height):
        self.width = width
        self.height = height

    @property
    def area(self):
        return self.width * self.height

    @property
    def perimeter(self):
        return 2 * (self.width + self.height)


r = Rectangle(3, 4)
print(r.area, r.perimeter)

r.width = 10
print(r.area, r.perimeter)

try:
    r.area = 10
except AttributeError as error:
    print("AttributeError:", error)
```

Output:

```text
12 14
40 28
AttributeError: property 'area' of 'Rectangle' object has no setter
```

### Exercise 2

```python
class BankAccount:
    def __init__(self, number):
        self._number = number
        self._balance = 0

    @property
    def number(self):
        return self._number

    @property
    def balance(self):
        return self._balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("Amount must be positive")
        self._balance += amount

    def withdraw(self, amount):
        if amount <= 0:
            raise ValueError("Amount must be positive")
        if amount > self._balance:
            raise ValueError("Insufficient funds")
        self._balance -= amount


account = BankAccount("UA-001")
account.deposit(500)
account.withdraw(200)
print(account.number, account.balance)

for action in (lambda: account.withdraw(1000),
               lambda: account.deposit(-5)):
    try:
        action()
    except ValueError as error:
        print("ValueError:", error)

try:
    account.balance = 1_000_000
except AttributeError as error:
    print("AttributeError:", error)
print(account.balance)
```

Output:

```text
UA-001 300
ValueError: Insufficient funds
ValueError: Amount must be positive
AttributeError: property 'balance' of 'BankAccount' object has no setter
300
```

The balance is read-only for the users of the class, but the class's own methods change `_balance`. This keeps every change behind the checks in `deposit()` and `withdraw()`.

### Exercise 3

```python
class Document:
    def __init__(self, text):
        self.computations = 0
        self.text = text

    @property
    def text(self):
        return self._text

    @text.setter
    def text(self, value):
        self._text = value
        self._word_count = None  # reset the cache

    @property
    def word_count(self):
        if self._word_count is None:
            self.computations += 1
            self._word_count = len(self._text.split())
        return self._word_count


doc = Document("Readonly properties are simple")
print(doc.word_count, doc.word_count, doc.computations)

doc.text = "Now the text is a bit longer than before"
print(doc.word_count, doc.word_count, doc.computations)

try:
    doc.word_count = 0
except AttributeError as error:
    print("AttributeError:", error)
```

Output:

```text
4 4 1
9 9 2
AttributeError: property 'word_count' of 'Document' object has no setter
```

`computations` is set before `self.text`, so it already exists when the setter runs. Each text is counted exactly once, no matter how often `word_count` is read.

### Exercise 4

Output:

```text
Ada Lovelace AL
Grace Lovelace AL
??
AttributeError: property 'full_name' of 'Profile' object has no setter
GL
```

- `full_name` is a plain computed property, so it reflects the new `first` immediately.
- `initials` was cached on the first read and does not notice the change, so it still says `AL`.
- `cached_property` can be assigned, so `p.initials = "??"` simply replaces the cached value.
- `full_name` has no setter, so assignment fails.
- `del p.initials` removes the cached value, and the next read computes `GL` from the current names.

---

*Source: [pythontutorial.net — Python Readonly Property](https://www.pythontutorial.net/python-oop/python-readonly-property/). Adapted and expanded for PyJourney.*
