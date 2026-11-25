# Customize & Extend Enum Classes

An enumeration is a class, so it can have methods, properties and special (dunder) methods just like any other class. This lets you put behaviour right next to the constants it belongs to: how a member is printed, how it compares, whether it counts as "true". You can also write a member-less base enum once and reuse its behaviour in many enums.

## What you'll learn

- How to add ordinary methods, properties and class methods to an enum
- How to change how members are printed with `__str__`
- How to make members equal to raw values with `__eq__`, and why you must also define `__hash__`
- How to make members sortable with `__lt__` and `@functools.total_ordering`, and why comparisons should return `NotImplemented`
- How to control truthiness with `__bool__`, and how to attach extra data to each member
- How to share behaviour through a member-less base enum, and when `IntEnum` or `StrEnum` already does the job

## Enums are classes: adding methods

Everything you define with `def` in an enum body is a method, not a member. Only plain values become members. Inside a method, `self` is a member:

```python
from enum import Enum


class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3

    @property
    def label(self):
        return self.name.title()

    def is_final(self):
        return self is not PaymentStatus.PENDING

    @classmethod
    def from_label(cls, text):
        return cls[text.strip().upper()]


print(PaymentStatus.PENDING.label)
print(PaymentStatus.PENDING.is_final(), PaymentStatus.REFUNDED.is_final())
print(PaymentStatus.from_label("  completed "))
print(list(PaymentStatus))
```

Output:

```text
Pending
False True
PaymentStatus.COMPLETED
[<PaymentStatus.PENDING: 1>, <PaymentStatus.COMPLETED: 2>, <PaymentStatus.REFUNDED: 3>]
```

- `label` is a property, so it reads like an attribute of every member.
- `is_final()` keeps the business rule "which statuses are final" inside the enum instead of scattering `if status in (...)` checks around the code.
- `from_label()` is a class method: it is called on the enum itself and returns a member.
- The enum still has exactly three members; the methods are not listed.

### A custom lookup with `_missing_`

`PaymentStatus(value)` looks a member up by value and raises `ValueError` if nothing matches. Before giving up, the enum calls the class method `_missing_(value)`. Override it to accept alternative spellings:

```python
from enum import Enum


class Status(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            for member in cls:
                if member.value == value.strip().lower():
                    return member
        return None


print(Status(" Active "))
print(Status("INACTIVE"))

try:
    Status("deleted")
except ValueError as error:
    print("ValueError:", error)
```

Output:

```text
Status.ACTIVE
Status.INACTIVE
ValueError: 'deleted' is not a valid Status
```

Returning `None` from `_missing_` means "still not found", and the usual `ValueError` is raised.

## Customizing `str()`: `__str__`

By default, printing a member shows the enum name and the member name:

```python
from enum import Enum


class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3


print(PaymentStatus.PENDING)
```

Output:

```text
PaymentStatus.PENDING
```

To show something else, override `__str__`. `print()`, `str()`, f-strings and `format()` all use it:

```python
from enum import Enum


class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3

    def __str__(self):
        return f"{self.name.lower()}({self.value})"


print(PaymentStatus.PENDING)
print(f"Status: {PaymentStatus.COMPLETED}")
print(repr(PaymentStatus.PENDING))
```

Output:

```text
pending(1)
Status: completed(2)
<PaymentStatus.PENDING: 1>
```

`repr()` is not affected. That is usually what you want: `str()` is for users, while `repr()` keeps showing the full, unambiguous form in debuggers, logs and lists of members. You can override `__repr__` too, but there is rarely a reason to.

## Comparing with raw values: `__eq__` and `__hash__`

A plain `Enum` member is never equal to its value, so this prints nothing:

```python
from enum import Enum


class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3


if PaymentStatus.PENDING == 1:
    print("The payment is pending.")
```

That is on purpose (see the topic Enumeration), but sometimes an enum must work with code that still passes plain integers around. You can then define `__eq__`:

```python
from enum import Enum


class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3

    def __eq__(self, other):
        if isinstance(other, int):
            return self.value == other
        if isinstance(other, PaymentStatus):
            return self is other
        return False


if PaymentStatus.PENDING == 1:
    print("The payment is pending.")

try:
    names = {PaymentStatus.PENDING: "waiting"}
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
The payment is pending.
TypeError: cannot use 'PaymentStatus' as a dict key (unhashable type: 'PaymentStatus')
```

The comparison works, but the members can no longer be dictionary keys or set elements. The reason is a general Python rule: **a class that defines `__eq__` but not `__hash__` gets `__hash__ = None`**, because Python cannot guess a hash that agrees with your new idea of equality. Enum members are used as keys all the time, so this breaks a lot of code.

A correct version also defines `__hash__`, and returns `NotImplemented` for types it does not understand:

```python
from enum import Enum


class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3

    def __eq__(self, other):
        if isinstance(other, PaymentStatus):
            return self is other
        if isinstance(other, int):
            return self.value == other
        return NotImplemented

    def __hash__(self):
        return hash(self.value)


print(PaymentStatus.PENDING == 1, 1 == PaymentStatus.PENDING)
print(PaymentStatus.PENDING == "pending", PaymentStatus.PENDING != 2)

names = {PaymentStatus.PENDING: "waiting", PaymentStatus.COMPLETED: "paid"}
print(names[PaymentStatus.PENDING])
print(len({1, PaymentStatus.PENDING}))
```

Output:

```text
True True
False True
waiting
1
```

- `__hash__` returns `hash(self.value)`. Objects that are equal must have equal hashes, and `PENDING == 1`, so `PENDING` must hash like `1`. That is why the set `{1, PaymentStatus.PENDING}` has one element.
- `NotImplemented` tells Python "I don't know how to compare with this type". Python then tries the other operand and finally falls back to identity, so `PENDING == "pending"` is simply `False`.

> **Note:** Making members equal to plain numbers gives up some of the safety that enums provide: a stray `2` now silently counts as `COMPLETED`. Consider converting raw values at the edges of the program with `PaymentStatus(value)` instead, or use `IntEnum` (shown below), which does all of this for you.

## Ordering: `__lt__` and `@total_ordering`

Plain enum members don't support `<`. If your members have a natural order (pending, then completed, then refunded), implement `__lt__` and let `functools.total_ordering` derive `<=`, `>` and `>=` from it and `__eq__`:

```python
from enum import Enum
from functools import total_ordering


@total_ordering
class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3

    def __eq__(self, other):
        if isinstance(other, PaymentStatus):
            return self is other
        if isinstance(other, int):
            return self.value == other
        return NotImplemented

    def __hash__(self):
        return hash(self.value)

    def __lt__(self, other):
        if isinstance(other, PaymentStatus):
            return self.value < other.value
        if isinstance(other, int):
            return self.value < other
        return NotImplemented


status = 1
if status < PaymentStatus.COMPLETED:
    print("The payment has not completed")

status = PaymentStatus.PENDING
if status >= PaymentStatus.COMPLETED:
    print("The payment is not pending")

print(sorted([PaymentStatus.REFUNDED, PaymentStatus.PENDING, PaymentStatus.COMPLETED]))
print(max(PaymentStatus))

try:
    PaymentStatus.PENDING < "abc"
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
The payment has not completed
[<PaymentStatus.PENDING: 1>, <PaymentStatus.COMPLETED: 2>, <PaymentStatus.REFUNDED: 3>]
PaymentStatus.REFUNDED
TypeError: '<' not supported between instances of 'PaymentStatus' and 'str'
```

`1 < PaymentStatus.COMPLETED` works even though the integer is on the left. `int` does not know how to compare itself with a `PaymentStatus`, so Python tries the reflected operation `PaymentStatus.COMPLETED > 1`, which `total_ordering` built from `__lt__` and `__eq__`.

### Why `NotImplemented` and not `False`

It may look harmless to return `False` for unknown types. With `total_ordering` it produces nonsense, because the derived `__gt__` is computed as "not less than and not equal":

```python
from enum import Enum
from functools import total_ordering


@total_ordering
class Level(Enum):
    LOW = 1
    HIGH = 2

    def __lt__(self, other):
        if isinstance(other, Level):
            return self.value < other.value
        return False  # bug: should be NotImplemented


print(Level.LOW < "abc")
print(Level.LOW > "abc")
```

Output:

```text
False
True
```

`LOW` is apparently greater than a string. Returning `NotImplemented` makes such comparisons raise `TypeError`, as they should.

## Truthiness: `__bool__`

By default every member is truthy, **even if its value is `0`, `""` or `None`**:

```python
from enum import Enum


class Light(Enum):
    OFF = 0
    ON = 1


print(bool(Light.OFF), bool(Light.ON))
```

Output:

```text
True True
```

You can change that with `__bool__`. Suppose `if status:` should mean "the money has arrived", which is true only for `COMPLETED`:

```python
from enum import Enum


class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3

    def __str__(self):
        return f"{self.name.lower()}({self.value})"

    def __bool__(self):
        return self is PaymentStatus.COMPLETED


for member in PaymentStatus:
    print(member, bool(member))
```

Output:

```text
pending(1) False
completed(2) True
refunded(3) False
```

Use this sparingly. A falsy member surprises anyone who writes `if status:` to mean "a status was given". A method with a clear name, like `is_paid()`, is often easier to read.

## Members with extra data

A member's value can be a tuple. If the enum defines `__init__`, each tuple is unpacked into its arguments, so every member gets its own attributes:

```python
from enum import Enum


class Plan(Enum):
    FREE = (0, 1)
    PRO = (10, 5)
    TEAM = (25, 50)

    def __init__(self, price, max_users):
        self.price = price
        self.max_users = max_users

    @property
    def price_per_user(self):
        return self.price / self.max_users


print(Plan.PRO.price, Plan.PRO.max_users, Plan.PRO.value)
print(Plan.TEAM.price_per_user)
print(Plan((10, 5)))
```

Output:

```text
10 5 (10, 5)
0.5
Plan.PRO
```

The value stays the whole tuple, so lookup by value needs the tuple too. `__init__` runs once per member, when the enum class is created.

## Extending enums with a member-less base class

As the topic Enumeration showed, an enum that has members cannot be subclassed:

```python
from enum import Enum


class Status(Enum):
    ACTIVE = 1


class ExtendedStatus(Status):
    DELETED = 2
```

Output:

```text
Traceback (most recent call last):
  ...
TypeError: <enum 'ExtendedStatus'> cannot extend <enum 'Status'>
```

This is not a real limitation. Put the shared behaviour into an enum **without members** and inherit from it as often as you like. Here is a base enum that orders members by value:

```python
from enum import Enum
from functools import total_ordering


@total_ordering
class OrderedEnum(Enum):
    def __lt__(self, other):
        if type(self) is type(other):
            return self.value < other.value
        return NotImplemented


class ApprovalStatus(OrderedEnum):
    PENDING = 1
    IN_PROGRESS = 2
    APPROVED = 3


class Priority(OrderedEnum):
    LOW = 1
    HIGH = 2


status = ApprovalStatus(2)
if status < ApprovalStatus.APPROVED:
    print("The request has not been approved.")

print(sorted([Priority.HIGH, Priority.LOW]))

try:
    ApprovalStatus.PENDING < Priority.HIGH
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
The request has not been approved.
[<Priority.LOW: 1>, <Priority.HIGH: 2>]
TypeError: '<' not supported between instances of 'ApprovalStatus' and 'Priority'
```

- `OrderedEnum` has no members, so `ApprovalStatus` and `Priority` can both extend it and both get `<`, `<=`, `>` and `>=`.
- The check `type(self) is type(other)` allows comparisons only **within one enum**. A looser `isinstance(other, OrderedEnum)` would happily compare an approval status with a priority, because both values are integers, which makes no sense.

## Ready-made alternatives: `IntEnum` and `StrEnum`

The standard library already provides enums whose members **are** integers or strings:

- `IntEnum`: members are `int` subclasses. They compare, sort and hash like integers.
- `StrEnum` (Python 3.11+): members are `str` subclasses. `str()` and f-strings give the plain value, which is handy for JSON, URLs and databases.

```python
from enum import IntEnum, StrEnum


class Priority(IntEnum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3


class Color(StrEnum):
    RED = "red"
    GREEN = "green"


print(Priority.HIGH > Priority.LOW, Priority.MEDIUM == 2)
print(sorted([3, Priority.LOW]), Priority.HIGH + 1)
print(f"{Color.RED}", Color.RED == "red", Color.RED.upper())
```

Output:

```text
True True
[<Priority.LOW: 1>, 3] 4
red True RED
```

Pick the right tool: if all you need is "members behave like their int or str values", `IntEnum`/`StrEnum` replace the hand-written `__eq__`, `__hash__` and `__lt__` from this topic. The price is type safety: an `IntEnum` member equals *any* integer with the same value, including members of unrelated `IntEnum` classes, and it supports arithmetic that may make no sense (`Priority.HIGH + 1`). Write custom methods when you need precise control over what may be compared with what.

## Common mistakes

- **Defining `__eq__` without `__hash__`.** The members become unhashable and can no longer be dict keys or set elements. Add `__hash__`, consistent with `__eq__`.
- **Returning `False` instead of `NotImplemented`** from `__eq__`/`__lt__` for unknown types. With `@total_ordering` this produces wrong answers like `Level.LOW > "abc"` being `True`.
- **Comparing members of different enums** because the base class check uses `isinstance(other, Base)`. Use `type(self) is type(other)`.
- **Trying to extend an enum that has members.** Put the shared methods into a member-less base enum instead.
- **Adding a constant to the enum body by accident.** Every plain value assigned in the body becomes a member (or an alias, if the value repeats). A "helper" like `DEFAULT = 1` silently becomes an alias of the member with value `1`. Use `enum.nonmember(1)` (Python 3.11+) or define the constant outside the enum.
- **Surprising truthiness.** A custom `__bool__` that makes some members falsy breaks `if status:` checks that only mean "not `None`". Prefer `if status is not None:` and named methods.

## Summary

- Enums are classes: add methods, properties and class methods; only plain values become members.
- Override `__str__` to change what `print()` and f-strings show; `repr()` keeps the full form.
- `_missing_` lets `Enum(value)` accept alternative inputs before raising `ValueError`.
- If you define `__eq__`, also define `__hash__` (consistent with it), or members become unhashable.
- Implement `__lt__` with `@total_ordering` to make members sortable, and return `NotImplemented` for types you don't support.
- `__bool__` controls truthiness; by default every member is truthy.
- With tuple values and `__init__`, each member can carry several attributes.
- Share behaviour through a member-less base enum; use `IntEnum`/`StrEnum` when members should simply act as ints or strings.

## Practice

### Exercise 1: Weekdays with behaviour

Define an enum `Weekday` with members `MON` to `SUN` (values `1` to `7`). Add:

- a property `is_weekend` that is `True` for `SAT` and `SUN`;
- a method `next()` that returns the following day, with `SUN.next()` returning `MON`.

Print `is_weekend` for `FRI` and `SAT`, and the results of `FRI.next()` and `SUN.next()`.

### Exercise 2: A coffee menu

Define an enum `Coffee` whose members carry a price and a size in millilitres: `ESPRESSO = (45, 30)`, `LATTE = (70, 300)`, `CAPPUCCINO = (65, 250)`. Give it:

- an `__init__` that stores `price` and `ml`;
- a property `price_per_100ml` rounded to 2 decimals;
- a `__str__` that returns, for example, `Latte (300 ml)`.

Print each coffee with `print()` and its price per 100 ml, then print the cheapest coffee per millilitre using `min()` with a `key`.

### Exercise 3: A reusable ordered base

Write a member-less base enum `OrderedEnum` with `@total_ordering` and an `__lt__` that compares members of the same enum by value and returns `NotImplemented` otherwise. Use it for two enums: `Severity` (`INFO = 1`, `WARNING = 2`, `ERROR = 3`) and `Size` (`S = 1`, `M = 2`, `L = 3`). Show that:

- `Severity.ERROR >= Severity.WARNING` is `True`;
- `max()` and `sorted()` work for `Size`;
- `Severity.INFO < Size.L` raises `TypeError`.

### Exercise 4: Find and fix the bugs

This enum is supposed to compare with integers and to be sortable. Run it, explain both problems, and fix the class so that the dictionary works and comparing with a string raises `TypeError`.

```python
from enum import Enum
from functools import total_ordering


@total_ordering
class Grade(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3

    def __eq__(self, other):
        if isinstance(other, int):
            return self.value == other
        return self is other

    def __lt__(self, other):
        if isinstance(other, Grade):
            return self.value < other.value
        if isinstance(other, int):
            return self.value < other
        return False


print(Grade.MEDIUM == 2)
print(Grade.HIGH >= "A")
try:
    colors = {Grade.LOW: "red", Grade.HIGH: "green"}
except TypeError as error:
    print("TypeError:", error)
```

## Solutions

### Exercise 1

```python
from enum import Enum


class Weekday(Enum):
    MON = 1
    TUE = 2
    WED = 3
    THU = 4
    FRI = 5
    SAT = 6
    SUN = 7

    @property
    def is_weekend(self):
        return self in (Weekday.SAT, Weekday.SUN)

    def next(self):
        return Weekday(self.value % 7 + 1)


print(Weekday.FRI.is_weekend, Weekday.SAT.is_weekend)
print(Weekday.FRI.next(), Weekday.SUN.next())
```

Output:

```text
False True
Weekday.SAT Weekday.MON
```

`self.value % 7 + 1` maps `1..6` to `2..7` and `7` back to `1`, and `Weekday(...)` turns the number into a member.

### Exercise 2

```python
from enum import Enum


class Coffee(Enum):
    ESPRESSO = (45, 30)
    LATTE = (70, 300)
    CAPPUCCINO = (65, 250)

    def __init__(self, price, ml):
        self.price = price
        self.ml = ml

    @property
    def price_per_100ml(self):
        return round(self.price / self.ml * 100, 2)

    def __str__(self):
        return f"{self.name.title()} ({self.ml} ml)"


for coffee in Coffee:
    print(coffee, coffee.price_per_100ml)

print("Best value:", min(Coffee, key=lambda c: c.price / c.ml))
```

Output:

```text
Espresso (30 ml) 150.0
Latte (300 ml) 23.33
Cappuccino (250 ml) 26.0
Best value: Latte (300 ml)
```

### Exercise 3

```python
from enum import Enum
from functools import total_ordering


@total_ordering
class OrderedEnum(Enum):
    def __lt__(self, other):
        if type(self) is type(other):
            return self.value < other.value
        return NotImplemented


class Severity(OrderedEnum):
    INFO = 1
    WARNING = 2
    ERROR = 3


class Size(OrderedEnum):
    S = 1
    M = 2
    L = 3


print(Severity.ERROR >= Severity.WARNING)
print(max(Size), sorted([Size.L, Size.S, Size.M]))

try:
    Severity.INFO < Size.L
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
True
Size.L [<Size.S: 1>, <Size.M: 2>, <Size.L: 3>]
TypeError: '<' not supported between instances of 'Severity' and 'Size'
```

### Exercise 4

Running the original code prints:

```text
True
True
TypeError: cannot use 'Grade' as a dict key (unhashable type: 'Grade')
```

- `Grade.HIGH >= "A"` is `True`: `total_ordering` computes `>=` as "not less than", and `__lt__` returns `False` for the string instead of `NotImplemented`.
- The dictionary fails because the class defines `__eq__` without `__hash__`, so Python set `__hash__` to `None`.

The fixed class:

```python
from enum import Enum
from functools import total_ordering


@total_ordering
class Grade(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3

    def __eq__(self, other):
        if isinstance(other, Grade):
            return self is other
        if isinstance(other, int):
            return self.value == other
        return NotImplemented

    def __hash__(self):
        return hash(self.value)

    def __lt__(self, other):
        if isinstance(other, Grade):
            return self.value < other.value
        if isinstance(other, int):
            return self.value < other
        return NotImplemented


print(Grade.MEDIUM == 2)
try:
    Grade.HIGH >= "A"
except TypeError as error:
    print("TypeError:", error)

colors = {Grade.LOW: "red", Grade.HIGH: "green"}
print(colors[Grade.HIGH], sorted(Grade, reverse=True))
```

Output:

```text
True
TypeError: '>=' not supported between instances of 'Grade' and 'str'
green [<Grade.HIGH: 3>, <Grade.MEDIUM: 2>, <Grade.LOW: 1>]
```

---

*Source: [pythontutorial.net — Customizing and Extending Python Enum Class](https://www.pythontutorial.net/python-oop/python-enum-class/). Adapted and expanded for PyJourney.*
