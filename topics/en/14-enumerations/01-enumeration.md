# Enumeration

An **enumeration** (enum) is a fixed set of named constants that belong together: the days of the week, the colours of a traffic light, the statuses of an order. Python's `enum` module lets you define such a set as a class, so instead of passing around "magic" numbers and strings, your code uses readable, type-safe names like `Color.RED` or `OrderStatus.SHIPPED`.

## What you'll learn

- Why enums are better than plain constants, numbers and strings
- How to define an enum by subclassing `Enum`, and what members, names and values are
- How members compare (`is`, `==`) and why a member is not equal to its value
- How to get a member by attribute, by name and by value, and what happens when it does not exist
- How to iterate over an enum, check membership, and use members as dictionary keys
- Why enums are immutable and cannot be extended once they have members

## Why enums?

Consider code that stores a status as a number:

```python
status = 2

if status == 2:
    print("shipped")
```

Output:

```text
shipped
```

What does `2` mean? You have to search the code or the documentation to find out, and nothing stops someone from writing `status = 7` or comparing with the wrong number. Using strings (`"shipped"`) is a bit more readable, but a typo like `"shiped"` silently becomes a bug.

An enum gives every allowed value a name, groups the names in one place, and makes invalid values impossible to create by accident.

## Defining an enumeration

Import `Enum` from the `enum` module and create a subclass of it. Every class attribute you assign becomes a **member**:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


print(Color.RED)
print(repr(Color.RED))
print(Color.RED.name)
print(Color.RED.value)
```

Output:

```text
Color.RED
<Color.RED: 1>
RED
1
```

- `Color` is the enumeration.
- `RED`, `GREEN` and `BLUE` are its **members**.
- Each member has a **name** (`"RED"`) and a **value** (`1`).
- `str()` and `print()` show `Color.RED`; `repr()` also shows the value.

Members are constants, so by convention their names are written in `UPPER_CASE`. Values can be of any type: integers, strings, tuples. Often the exact value does not matter at all; it only has to be different for each member.

> **Note:** Although `Color` is written with the `class` keyword, it does not behave like an ordinary class. Its attributes are turned into instances of `Color` itself, and you never call `Color()` to create new objects. This magic is done by the enum's metaclass, `EnumType` (called `EnumMeta` before Python 3.11).

## Members are instances of their enum

Each member is an object whose type is the enumeration it belongs to:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


print(type(Color.RED))
print(isinstance(Color.RED, Color))
```

Output:

```text
<enum 'Color'>
True
```

This means a function can check `isinstance(value, Color)` and be sure it got one of the three valid colours, not an arbitrary number.

## Comparing members

Each member exists exactly once (it is a singleton), so both `is` and `==` work for comparing members. A member is **not** equal to its value:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


print(Color.RED is Color.RED)
print(Color.RED is Color.BLUE)
print(Color.RED == Color.RED)
print(Color.RED == 1)
print(Color.RED.value == 1)
```

Output:

```text
True
False
True
False
True
```

`Color.RED == 1` is `False` on purpose: an enum is a separate type, and `1` could mean anything. If you need to compare with a raw value, convert explicitly: compare `.value`, or convert the raw value into a member with `Color(1)`.

Plain `Enum` members also do not support ordering:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


print(Color.RED < Color.GREEN)
```

Output:

```text
Traceback (most recent call last):
  ...
TypeError: '<' not supported between instances of 'Color' and 'Color'
```

Colours have no natural order. When your members do have one, you can add ordering yourself or use `IntEnum`; the topic on customising enums shows how.

## Accessing members by name and by value

There are three ways to get a member:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


print(Color.RED)         # attribute access: the name is written in code
print(Color["RED"])      # by name: the name is a string, e.g. from a config file
print(Color(1))          # by value: e.g. a number stored in a database
print(Color["RED"] is Color(1))
```

Output:

```text
Color.RED
Color.RED
Color.RED
True
```

- `Color["RED"]` works because the enum class supports the square-bracket lookup (it implements `__getitem__`).
- `Color(1)` looks like creating an object, but it does not create anything: it **looks up** the existing member whose value is `1`.

Both lookups fail loudly for unknown input:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


try:
    Color["PINK"]
except KeyError as error:
    print("KeyError:", error)

try:
    Color(5)
except ValueError as error:
    print("ValueError:", error)
```

Output:

```text
KeyError: 'PINK'
ValueError: 5 is not a valid Color
```

This is a feature: invalid data is rejected at the boundary of your program instead of travelling further as a meaningless number.

## Iterating and membership

An enum is iterable. Members come out in definition order:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


for color in Color:
    print(color.name, color.value)

print(list(Color))
print(len(Color))
```

Output:

```text
RED 1
GREEN 2
BLUE 3
[<Color.RED: 1>, <Color.GREEN: 2>, <Color.BLUE: 3>]
3
```

The `in` operator checks whether something belongs to the enum:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


print(Color.RED in Color)
print(1 in Color)
print(7 in Color)
print("RED" in Color)
print("RED" in Color.__members__)
```

Output:

```text
True
True
False
False
True
```

- A member is always in its own enum.
- Since **Python 3.12**, `in` also accepts raw values: `1 in Color` is `True` because some member has the value `1`. Before 3.12, checking a non-member raised `TypeError`.
- Names are not values, so `"RED" in Color` is `False`. To check names, use the `__members__` mapping, which maps every name to its member.

## Members are hashable

Members can be used as dictionary keys and set elements:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


rgb = {
    Color.RED: "#ff0000",
    Color.GREEN: "#00ff00",
    Color.BLUE: "#0000ff",
}

print(rgb[Color.GREEN])
print(rgb[Color(3)])

warm = {Color.RED}
print(Color.RED in warm, Color.BLUE in warm)
```

Output:

```text
#00ff00
#0000ff
True False
```

## Enums are immutable

Once an enum is defined, its set of members and their values are fixed. Every attempt to change them fails:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


try:
    Color["YELLOW"] = 4
except TypeError as error:
    print("TypeError:", error)

try:
    Color.RED = 100
except AttributeError as error:
    print("AttributeError:", error)

try:
    Color.RED.value = 100
except AttributeError as error:
    print("AttributeError:", error)
```

Output:

```text
TypeError: 'EnumType' object does not support item assignment
AttributeError: cannot reassign member 'RED'
AttributeError: <enum 'Enum'> cannot set attribute 'value'
```

This guarantee is the point of an enum: code anywhere in the program can rely on `Color.RED` always meaning the same thing.

> **Note:** `Color.YELLOW = 4` does *not* raise an error, but it does not create a member either. It just attaches an ordinary class attribute with the integer `4`, and `list(Color)` still has three members. Do not do this.

## Enums with members cannot be subclassed

You can inherit from an enum only if it has **no members**. An empty enum can serve as a base that provides shared methods:

```python
from enum import Enum


class Color(Enum):
    pass


class RGB(Color):
    RED = 1
    GREEN = 2
    BLUE = 3


print(list(RGB))
```

Output:

```text
[<RGB.RED: 1>, <RGB.GREEN: 2>, <RGB.BLUE: 3>]
```

Trying to extend an enum that already has members fails:

```python
from enum import Enum


class RGB(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


class RGBA(RGB):
    ALPHA = 4
```

Output:

```text
Traceback (most recent call last):
  ...
TypeError: <enum 'RGBA'> cannot extend <enum 'RGB'>
```

The reason is the IS-A rule from inheritance: if `RGBA` were a subclass of `RGB`, then `RGBA.ALPHA` would be an `RGB` member too, and `RGB` would suddenly have a fourth member that its own definition never mentioned. That would break the promise that an enum is a fixed set. The next topics show how to share behaviour between enums with member-less base classes.

## A practical example: parsing a response

Enums are especially useful at the boundary where external data (JSON, a database, user input) enters your program. Suppose an API returns a JSON document with a status:

```python
import json
from enum import Enum


class ResponseStatus(Enum):
    PENDING = "pending"
    FULFILLED = "fulfilled"
    REJECTED = "rejected"


response = """{
    "status": "fulfilled"
}"""

data = json.loads(response)
status = ResponseStatus(data["status"])

print(status)
print(status is ResponseStatus.FULFILLED)
```

Output:

```text
ResponseStatus.FULFILLED
True
```

`ResponseStatus(data["status"])` converts the string into a member. From then on the program works with `ResponseStatus.FULFILLED` instead of the string `"fulfilled"`.

If the API sends a status that the enum does not know, the conversion raises `ValueError`. Handle it where the data comes in:

```python
import json
from enum import Enum


class ResponseStatus(Enum):
    PENDING = "pending"
    FULFILLED = "fulfilled"
    REJECTED = "rejected"


response = """{
    "status": "ok"
}"""

data = json.loads(response)

try:
    if ResponseStatus(data["status"]) is ResponseStatus.FULFILLED:
        print("The request completed successfully")
except ValueError as error:
    print(error)
```

Output:

```text
'ok' is not a valid ResponseStatus
```

### A shortcut: the functional API

For quick enums you can also call `Enum` like a function. Values are numbered from `1`:

```python
from enum import Enum

Shape = Enum("Shape", ["CIRCLE", "SQUARE", "TRIANGLE"])
print(list(Shape))
```

Output:

```text
[<Shape.CIRCLE: 1>, <Shape.SQUARE: 2>, <Shape.TRIANGLE: 3>]
```

The class syntax is more common, because it also lets you add methods and docstrings.

## Common mistakes

- **Comparing a member with its raw value.** `Color.RED == 1` is always `False` for a plain `Enum`. Convert first: `Color(value) is Color.RED`, or compare `member.value`.
- **A stray trailing comma.** `RED = 1,` makes the value the tuple `(1,)`, not `1`, so `Color(1)` raises `ValueError`.
- **Using `.value` everywhere.** If most of your code works with `status.value`, you have lost the benefits of the enum. Convert raw values to members at the edges of the program and use members inside it.
- **Not handling unknown values.** `Color(x)` and `Color[name]` raise `ValueError` and `KeyError` for unknown input. When the input comes from outside, catch these errors.
- **Expecting `"RED" in Color` to check names.** It checks values (Python 3.12+). Use `"RED" in Color.__members__` for names.
- **Trying to extend an enum that has members.** Put shared methods in a member-less base enum instead.

## Summary

- An enumeration is a fixed set of named constants; define one by subclassing `enum.Enum`.
- Each member has a `.name` and a `.value` and is an instance of its enum.
- Members are singletons: compare them with `is` or `==`. A member never equals its raw value, and plain members cannot be ordered with `<`.
- Get members by attribute (`Color.RED`), by name (`Color["RED"]`) or by value (`Color(1)`); unknown input raises `KeyError` or `ValueError`.
- Enums are iterable in definition order, support `len()`, and since Python 3.12 `in` also accepts raw values.
- Members are hashable, so they work as dictionary keys and set elements.
- Enums are immutable: no new members, no reassigned members, no changed values.
- An enum can be subclassed only if it has no members.

## Practice

### Exercise 1: Weekdays

Define an enum `Weekday` with members `MON` to `SUN` and values `1` to `7`. Then:

1. print the name and value of every member in one loop;
2. print the member with value `3`;
3. print the member named `"SUN"`;
4. print how many members the enum has.

### Exercise 2: Traffic light

Define an enum `Light` with members `RED`, `GREEN`, `YELLOW` (use string values `"red"`, `"green"`, `"yellow"`). Write a function `next_light(light)` that returns the next light in the cycle `RED -> GREEN -> YELLOW -> RED`, using a dictionary with members as keys. Starting from `Light.RED`, print five consecutive lights.

### Exercise 3: Validating input

You receive a list of order statuses as strings from an external system:

```python
raw = ["new", "paid", "shipped", "lost", "paid", "NEW"]
```

Define an enum `OrderStatus` with values `"new"`, `"paid"` and `"shipped"`. Write a function `count_statuses(raw)` that returns a dictionary mapping each `OrderStatus` member to how many times it occurs, plus a separate count of invalid strings. Strings that do not match a value exactly are invalid. Print the result.

### Exercise 4: Predict the output

Without running it, predict what the code prints.

```python
from enum import Enum


class Size(Enum):
    S = "small"
    M = "medium"
    L = "large"


print(Size("medium"))
print(Size["L"].value)
print(Size.S == "small")
print("small" in Size)
print(Size.M in Size)
print([size.name for size in Size])
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


for day in Weekday:
    print(day.name, day.value)

print(Weekday(3))
print(Weekday["SUN"])
print(len(Weekday))
```

Output:

```text
MON 1
TUE 2
WED 3
THU 4
FRI 5
SAT 6
SUN 7
Weekday.WED
Weekday.SUN
7
```

### Exercise 2

```python
from enum import Enum


class Light(Enum):
    RED = "red"
    GREEN = "green"
    YELLOW = "yellow"


NEXT = {
    Light.RED: Light.GREEN,
    Light.GREEN: Light.YELLOW,
    Light.YELLOW: Light.RED,
}


def next_light(light):
    return NEXT[light]


light = Light.RED
for _ in range(5):
    print(light.name)
    light = next_light(light)
```

Output:

```text
RED
GREEN
YELLOW
RED
GREEN
```

### Exercise 3

```python
from enum import Enum


class OrderStatus(Enum):
    NEW = "new"
    PAID = "paid"
    SHIPPED = "shipped"


def count_statuses(raw):
    counts = {status: 0 for status in OrderStatus}
    invalid = 0
    for text in raw:
        try:
            counts[OrderStatus(text)] += 1
        except ValueError:
            invalid += 1
    return counts, invalid


raw = ["new", "paid", "shipped", "lost", "paid", "NEW"]
counts, invalid = count_statuses(raw)
for status, count in counts.items():
    print(status.name, count)
print("invalid", invalid)
```

Output:

```text
NEW 1
PAID 2
SHIPPED 1
invalid 2
```

`"lost"` is not a known status, and `"NEW"` does not match `"new"` because value lookup is case-sensitive. Both raise `ValueError` and are counted as invalid.

### Exercise 4

Output:

```text
Size.M
large
False
True
True
['S', 'M', 'L']
```

- `Size("medium")` looks up the member by value.
- `Size["L"]` looks up by name; its value is `"large"`.
- A member is never equal to its raw value.
- `"small" in Size` checks values (Python 3.12+), and `"small"` is the value of `Size.S`.
- A member is always in its enum.
- Iteration yields members in definition order.

---

*Source: [pythontutorial.net — Python Enumeration](https://www.pythontutorial.net/python-oop/python-enumeration/). Adapted and expanded for PyJourney.*
