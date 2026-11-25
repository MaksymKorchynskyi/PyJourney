# Enum auto

Often the exact values of enum members don't matter. They only have to be different from each other. Instead of numbering members by hand, you can write `auto()` and let the enum choose the values. This removes noise and a whole class of copy-paste bugs, and the value generator can be customised when the default numbers are not what you need.

## What you'll learn

- Why `auto()` is useful and what values it produces by default
- How `auto()` behaves after explicitly assigned values, and what changed in Python 3.13
- What `auto()` generates in `IntEnum`, `StrEnum` and `Flag`
- How `auto()` works internally through `_generate_next_value_`, and what its parameters mean
- How to override `_generate_next_value_` and share it through a member-less base enum
- When **not** to use `auto()`

## Why `auto()`?

Here is an enum with hand-written values:

```python
from enum import Enum


class State(Enum):
    PENDING = 1
    FULFILLED = 2
    REJECTED = 3
```

The numbers carry no meaning. They exist only because every member needs *some* value. Writing them by hand is busywork, and a copy-paste mistake such as two members with the value `2` silently creates an alias (see the topic Enum Aliases & @enum.unique Decorator).

The `enum` module provides `auto` (since Python 3.6). Writing `auto()` instead of a value tells the enum to generate one:

```python
from enum import Enum, auto


class State(Enum):
    PENDING = auto()
    FULFILLED = auto()
    REJECTED = auto()

    def __str__(self):
        return f"{self.name}({self.value})"


for state in State:
    print(state.name, state.value)

print(State.FULFILLED)
print(type(State.PENDING.value))
```

Output:

```text
PENDING 1
FULFILLED 2
REJECTED 3
FULFILLED(2)
<class 'int'>
```

`auto` is a class, and `auto()` creates a placeholder object. While the enum class is being created, every placeholder is replaced by a real value, so `State.PENDING.value` is an ordinary `int`, not an `auto` object.

## What values `auto()` produces

### Plain `Enum`: integers starting at 1

In a plain `Enum`, `auto()` produces `1`, `2`, `3`, ... Numbering starts at `1`, not `0`, on purpose: `0` is falsy, and using it as a value would invite confusing checks like `if state.value:`. (Members themselves are always truthy, whatever their value; see the topic Customize & Extend Enum Classes.)

### After explicit values: the largest value plus one

You can mix `auto()` with explicit values. Since Python 3.13, `auto()` returns **the largest value used so far, plus one**:

```python
from enum import Enum, auto


class Level(Enum):
    LOW = 10
    MEDIUM = auto()
    LEGACY = 5
    HIGH = auto()


print(list(Level))
```

Output:

```text
[<Level.LOW: 10>, <Level.MEDIUM: 11>, <Level.LEGACY: 5>, <Level.HIGH: 12>]
```

`HIGH` gets `12` (the largest value, `11`, plus one), not `6`. Before Python 3.13, `auto()` used the *last* value plus one, which would give `6` here; Python 3.12 warned about the upcoming change. If your enum mixes the two styles, don't rely on the exact numbers across versions.

The default generator can only increment numbers. After a non-numeric value, `auto()` fails:

```python
from enum import Enum, auto


class Mode(Enum):
    READ = "r"
    WRITE = auto()
```

Output:

```text
Traceback (most recent call last):
  ...
TypeError: unable to increment 'r'
```

### Explicit values can collide with generated ones

`auto()` doesn't reserve numbers for later. An explicit value equal to a generated one creates an alias:

```python
from enum import Enum, auto, unique


class Color(Enum):
    RED = auto()
    GREEN = auto()
    BLUE = 1


print(list(Color))
print(Color.BLUE)

try:
    @unique
    class StrictColor(Enum):
        RED = auto()
        GREEN = auto()
        BLUE = 1
except ValueError as error:
    print("ValueError:", error)
```

Output:

```text
[<Color.RED: 1>, <Color.GREEN: 2>]
Color.RED
ValueError: duplicate values found in <enum 'StrictColor'>: BLUE -> RED
```

`@unique` catches such mistakes. Better still, use either `auto()` everywhere or explicit values everywhere.

## `auto()` in other enum types

Each enum type has its own idea of a sensible next value:

| Enum type | Values from `auto()` |
|---|---|
| `Enum`, `IntEnum` | `1`, `2`, `3`, ... |
| `StrEnum` (3.11+) | the member name in lower case |
| `Flag`, `IntFlag` | powers of two: `1`, `2`, `4`, `8`, ... |

```python
from enum import Flag, IntEnum, StrEnum, auto


class Priority(IntEnum):
    LOW = auto()
    HIGH = auto()


class Color(StrEnum):
    RED = auto()
    DARK_BLUE = auto()


class Permission(Flag):
    READ = auto()
    WRITE = auto()
    EXECUTE = auto()


print(list(Priority))
print(list(Color), Color.DARK_BLUE == "dark_blue")
print(list(Permission))

read_write = Permission.READ | Permission.WRITE
print(read_write, read_write.value)
print(Permission.READ in read_write, Permission.EXECUTE in read_write)
```

Output:

```text
[<Priority.LOW: 1>, <Priority.HIGH: 2>]
[<Color.RED: 'red'>, <Color.DARK_BLUE: 'dark_blue'>] True
[<Permission.READ: 1>, <Permission.WRITE: 2>, <Permission.EXECUTE: 4>]
Permission.READ|WRITE 3
True False
```

- In a `StrEnum` the values are strings, so lower-case names are a natural default, and they are readable in JSON or a database.
- A `Flag` member stands for one bit, so the values must be powers of two. Members can be combined with `|`, and `in` checks whether a combination contains a flag. `auto()` saves you from computing `1`, `2`, `4`, `8`, ... by hand.

## How `auto()` works: `_generate_next_value_`

When the enum class body runs and meets `auto()`, the enum calls a special static method to compute the value:

```python
_generate_next_value_(name, start, count, last_values)
```

- `name`: the name of the member being defined, such as `"PENDING"`;
- `start`: the start value for the sequence; `1` unless set otherwise (the functional API accepts `start=`, for example `Enum("State", "A B", start=0)`);
- `count`: how many members have been defined so far, **including aliases**;
- `last_values`: the list of all values assigned so far, in definition order, including explicit ones and duplicates.

Whatever it returns becomes the member's value. You can watch the arguments by overriding the method:

```python
from enum import Enum, auto


class State(Enum):
    @staticmethod
    def _generate_next_value_(name, start, count, last_values):
        print(f"name={name!r} start={start} count={count} last_values={last_values}")
        return name.lower()

    PENDING = auto()
    FULFILLED = auto()
    CANCELLED = 99
    REJECTED = auto()


print(list(State))
```

Output:

```text
name='PENDING' start=1 count=0 last_values=[]
name='FULFILLED' start=1 count=1 last_values=['pending']
name='REJECTED' start=1 count=3 last_values=['pending', 'fulfilled', 99]
[<State.PENDING: 'pending'>, <State.FULFILLED: 'fulfilled'>, <State.CANCELLED: 99>, <State.REJECTED: 'rejected'>]
```

The method is called only for `auto()`; `CANCELLED = 99` is assigned directly, but it still shows up in `count` and `last_values` for the members after it.

## Overriding `_generate_next_value_`

Overriding the method changes what `auto()` produces for the whole enum. A common choice is to derive the value from the member name:

```python
from enum import Enum, auto


class State(Enum):
    @staticmethod
    def _generate_next_value_(name, start, count, last_values):
        return name.lower()

    PENDING = auto()
    FULFILLED = auto()
    REJECTED = auto()


for state in State:
    print(state.name, state.value)

print(State("fulfilled"))
```

Output:

```text
PENDING pending
FULFILLED fulfilled
REJECTED rejected
State.FULFILLED
```

Name-based values are stable (they don't change when you reorder members) and self-explanatory in logs and stored data.

Two rules apply:

1. **Define it before the first `auto()`.** The enum needs the generator at the moment `auto()` is evaluated. Defining it later is an error:

   ```python
   from enum import Enum, auto


   class State(Enum):
       PENDING = auto()

       @staticmethod
       def _generate_next_value_(name, start, count, last_values):
           return name.lower()

       FULFILLED = auto()
   ```

   Output:

   ```text
   Traceback (most recent call last):
     ...
   TypeError: _generate_next_value_ must be defined before members
   ```

2. **Decorate it with `@staticmethod`.** It receives no `self` or `cls`. Older tutorials define it as a plain function inside the class, which also works, but `@staticmethod` is the documented form and makes the intent clear.

### Sharing a generator through a base enum

A member-less base enum can hold the generator, and every enum that extends it inherits the behaviour (the same technique as in the topic Customize & Extend Enum Classes):

```python
from enum import Enum, auto


class NameEnum(Enum):
    @staticmethod
    def _generate_next_value_(name, start, count, last_values):
        return name.lower()


class State(NameEnum):
    PENDING = auto()
    FULFILLED = auto()


class Role(NameEnum):
    ADMIN = auto()
    GUEST = auto()


print(list(State))
print(list(Role))
```

Output:

```text
[<State.PENDING: 'pending'>, <State.FULFILLED: 'fulfilled'>]
[<Role.ADMIN: 'admin'>, <Role.GUEST: 'guest'>]
```

## When not to use `auto()`

`auto()` is ideal when the values are an internal detail. Be careful when they leave your program, for example when they are saved to a database, written to a file or sent through an API. Numeric `auto()` values depend on the **order** of members, so adding a member in the middle silently renumbers everything after it:

```python
from enum import Enum, auto


class StateV1(Enum):
    PENDING = auto()
    FULFILLED = auto()
    REJECTED = auto()


class StateV2(Enum):  # a new state was added in the middle
    PENDING = auto()
    IN_REVIEW = auto()
    FULFILLED = auto()
    REJECTED = auto()


saved = StateV1.FULFILLED.value  # stored by the old version
print(saved, StateV2(saved))
```

Output:

```text
2 StateV2.IN_REVIEW
```

A record saved as "fulfilled" is now read back as "in review". For values that are stored or exchanged, write explicit values, or generate them from the names (`StrEnum` or a custom `_generate_next_value_`), which don't depend on the order. Also skip `auto()` when the values mean something by themselves, such as HTTP status codes (`OK = 200`, `NOT_FOUND = 404`).

## Common mistakes

- **Forgetting the parentheses.** `A = auto` assigns the `auto` class itself as the value. A second `B = auto` then becomes an alias of `A`:

  ```python
  from enum import Enum, auto


  class Broken(Enum):
      A = auto
      B = auto


  print(list(Broken))
  ```

  Output:

  ```text
  [<Broken.A: <class 'enum.auto'>>]
  ```

- **Defining `_generate_next_value_` after members that use `auto()`.** It raises `TypeError`. Put it at the top of the class body, or in a base enum.
- **Generating duplicate values.** A custom generator must return a different value for every member. For example, returning `name.split("_")[0]` turns `GET_USER` and `GET_ORDER` into the same value `"GET"`, so the second member silently becomes an alias of the first.
- **Storing numeric `auto()` values outside the program.** Reordering or inserting members changes them. Use explicit or name-based values for persisted data.
- **Mixing `auto()` with non-numeric values in a plain `Enum`.** The default generator can't increment a string and raises `TypeError: unable to increment ...`.
- **Expecting `auto()` to start at 0.** It starts at `1` (or at `start` in the functional API).
- **Calling `self.name` like a method.** A `__str__` written as `f"{self.name(self.value)}"` fails as soon as a member is printed: `self.name` is a string, so calling it raises `TypeError: 'str' object is not callable`. Write `f"{self.name}({self.value})"`.

## Summary

- `auto()` lets the enum generate member values when only their distinctness matters.
- In `Enum` and `IntEnum`, values are `1`, `2`, `3`, ...; in `StrEnum`, lower-case names; in `Flag`, powers of two.
- Since Python 3.13, after explicit values `auto()` returns the largest value so far plus one; it raises `TypeError` if that value can't be incremented.
- An explicit value equal to a generated one creates an alias; `@unique` catches it.
- `auto()` calls `_generate_next_value_(name, start, count, last_values)`; its return value becomes the member's value.
- Override it as a `@staticmethod` before the first `auto()`, or inherit it from a member-less base enum.
- Don't use numeric `auto()` values for data that is stored or exchanged: they change when members are reordered.

## Practice

### Exercise 1: Predict the values

Without running the code, write down what it prints. Then run it.

```python
from enum import Enum, auto


class Level(Enum):
    LOW = auto()
    MEDIUM = auto()
    HIGH = 10
    CRITICAL = auto()
    MINIMAL = 1


print(list(Level))
print(Level.MINIMAL)
print(len(Level.__members__))
```

### Exercise 2: Event names in kebab-case

Define an enum `Event` with members `USER_CREATED`, `USER_DELETED` and `ORDER_PAID`, all set with `auto()`. Override `_generate_next_value_` so that the values are the names in lower case with `_` replaced by `-` (for example `"user-created"`). Print all values and look up a member with `Event("order-paid")`.

### Exercise 3: Numbers with gaps

Write a member-less base enum `StepEnum` whose `_generate_next_value_` returns `10`, `20`, `30`, ... (use `count`). Use it for an enum `Stage` with `DRAFT`, `REVIEW` and `PUBLISHED`, and print its members. The idea is to leave gaps for future stages. Then write a second version of `Stage` with an extra member `SPELLCHECK = 15` between `DRAFT` and `REVIEW`, print its members sorted by value, and check: did the values of the existing stages stay the same? Explain the result.

### Exercise 4: File permissions

Define a `Flag` called `Permission` with members `READ`, `WRITE` and `EXECUTE` using `auto()`. Write a function `describe(perms)` that returns a string like `"rw-"`: one character per permission (`r`, `w`, `x`) or `-` if it is missing. Print the result for `READ`, `READ | WRITE`, and all three combined, together with each combination's integer value.

## Solutions

### Exercise 1

Output:

```text
[<Level.LOW: 1>, <Level.MEDIUM: 2>, <Level.HIGH: 10>, <Level.CRITICAL: 11>]
Level.LOW
5
```

- `LOW` and `MEDIUM` get `1` and `2`.
- `CRITICAL` comes after the explicit `10`, so it gets the largest value plus one, `11`.
- `MINIMAL = 1` repeats the value of `LOW`, so it is an alias: `Level.MINIMAL` is `Level.LOW`, and the enum has four members.
- `__members__` contains all five names, including the alias.

### Exercise 2

```python
from enum import Enum, auto


class Event(Enum):
    @staticmethod
    def _generate_next_value_(name, start, count, last_values):
        return name.lower().replace("_", "-")

    USER_CREATED = auto()
    USER_DELETED = auto()
    ORDER_PAID = auto()


print([event.value for event in Event])
print(Event("order-paid"))
```

Output:

```text
['user-created', 'user-deleted', 'order-paid']
Event.ORDER_PAID
```

### Exercise 3

```python
from enum import Enum, auto


class StepEnum(Enum):
    @staticmethod
    def _generate_next_value_(name, start, count, last_values):
        return (count + 1) * 10


class Stage(StepEnum):
    DRAFT = auto()
    REVIEW = auto()
    PUBLISHED = auto()


print(list(Stage))


class Stage(StepEnum):  # version 2: a stage inserted between DRAFT and REVIEW
    DRAFT = auto()
    SPELLCHECK = 15
    REVIEW = auto()
    PUBLISHED = auto()


print(sorted(Stage, key=lambda stage: stage.value))
```

Output:

```text
[<Stage.DRAFT: 10>, <Stage.REVIEW: 20>, <Stage.PUBLISHED: 30>]
[<Stage.DRAFT: 10>, <Stage.SPELLCHECK: 15>, <Stage.REVIEW: 30>, <Stage.PUBLISHED: 40>]
```

The values **did** change: `REVIEW` went from `20` to `30`. `count` includes the new explicit member `SPELLCHECK`, so every later `auto()` shifts by one step. Gaps only help if the generator does not depend on the position, which is why stored values should be explicit. A version that really keeps the old numbers writes them out:

```python
from enum import Enum


class Stage(Enum):
    DRAFT = 10
    SPELLCHECK = 15
    REVIEW = 20
    PUBLISHED = 30


print(sorted(Stage, key=lambda stage: stage.value))
```

Output:

```text
[<Stage.DRAFT: 10>, <Stage.SPELLCHECK: 15>, <Stage.REVIEW: 20>, <Stage.PUBLISHED: 30>]
```

### Exercise 4

```python
from enum import Flag, auto


class Permission(Flag):
    READ = auto()
    WRITE = auto()
    EXECUTE = auto()


def describe(perms):
    letters = {Permission.READ: "r", Permission.WRITE: "w", Permission.EXECUTE: "x"}
    return "".join(char if flag in perms else "-" for flag, char in letters.items())


for perms in (Permission.READ,
              Permission.READ | Permission.WRITE,
              Permission.READ | Permission.WRITE | Permission.EXECUTE):
    print(describe(perms), perms.value)
```

Output:

```text
r-- 1
rw- 3
rwx 7
```

Because `auto()` gives each flag its own bit (`1`, `2`, `4`), every combination has a unique integer value, the same idea as Unix file permissions.

---

*Source: [pythontutorial.net — Python enum auto](https://www.pythontutorial.net/python-oop/python-enum-auto/). Adapted and expanded for PyJourney.*
