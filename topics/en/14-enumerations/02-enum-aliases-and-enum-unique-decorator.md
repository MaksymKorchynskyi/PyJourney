# Enum aliases & @enum.unique Decorator

Two names in an enum can share the same value. Python does not create two members in that case: the second name becomes an **alias** of the first. Aliases are handy for mapping several spellings onto one meaning, but an accidental alias is a silent bug. The `@enum.unique` decorator lets you forbid them.

## What you'll learn

- What an enum alias is and which member is the "real" (canonical) one
- How aliases behave in value lookups, name lookups, iteration and `__members__`
- How to find all aliases of an enum
- A practical use of aliases: unifying status codes from different systems
- How to forbid aliases with `@enum.unique` or `@enum.verify(UNIQUE)` (Python 3.11+)
- Why values such as `1`, `1.0` and `True` can create aliases you did not intend

## What an alias is

Member values do not have to be unique. When a later name gets a value that an earlier member already has, that name becomes an alias:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    CRIMSON = 1
    SALMON = 1
    GREEN = 2
    BLUE = 3


print(Color.RED is Color.CRIMSON)
print(Color.RED is Color.SALMON)
print(Color.CRIMSON)
print(Color.CRIMSON.name)
```

Output:

```text
True
True
Color.RED
RED
```

`RED` is the **canonical member** (the first name defined with the value `1`), and `CRIMSON` and `SALMON` are just other names for the very same object. That is why `Color.CRIMSON` prints as `Color.RED` and its `.name` is `"RED"`: there is no separate `CRIMSON` object.

```text
names                 members
RED     ----+
CRIMSON ----+---->  <Color.RED: 1>
SALMON  ----+
GREEN   --------->  <Color.GREEN: 2>
BLUE    --------->  <Color.BLUE: 3>
```

## How aliases behave

### Lookups return the canonical member

Looking up by value always returns the canonical member. Looking up by an alias name also works and returns the same object:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    CRIMSON = 1
    SALMON = 1
    GREEN = 2
    BLUE = 3


print(Color(1))
print(Color["SALMON"])
print(Color["SALMON"] is Color.RED)
```

Output:

```text
Color.RED
Color.RED
True
```

### Iteration skips aliases

Iterating over an enum (and `len()`) counts only canonical members:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    CRIMSON = 1
    SALMON = 1
    GREEN = 2
    BLUE = 3


for color in Color:
    print(color)

print(len(Color))
```

Output:

```text
Color.RED
Color.GREEN
Color.BLUE
3
```

### `__members__` includes aliases

To see every name, including aliases, use the `__members__` attribute. It is a read-only mapping (a `mappingproxy`) from names to members, in definition order:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    CRIMSON = 1
    SALMON = 1
    GREEN = 2
    BLUE = 3


for name, member in Color.__members__.items():
    print(name, "->", repr(member))
```

Output:

```text
RED -> <Color.RED: 1>
CRIMSON -> <Color.RED: 1>
SALMON -> <Color.RED: 1>
GREEN -> <Color.GREEN: 2>
BLUE -> <Color.BLUE: 3>
```

`CRIMSON` and `SALMON` map to the same object as `RED`.

> **Tip:** `pprint(Color.__members__)` also works, but `pprint` sorts dictionary keys alphabetically by default, so the definition order is lost in its output.

### Finding the aliases

An alias is a name whose member has a *different* `.name`. That gives a one-line way to list all aliases:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    CRIMSON = 1
    SALMON = 1
    GREEN = 2
    BLUE = 3


aliases = [name for name, member in Color.__members__.items() if name != member.name]
print(aliases)
```

Output:

```text
['CRIMSON', 'SALMON']
```

## When aliases are useful

Suppose your program talks to two external systems, and each uses its own codes for the same three states of a request:

| System 1 | System 2 | Meaning |
|---|---|---|
| `REQUESTING` | `PENDING` | The request is in progress |
| `OK` | `FULFILLED` | The request completed successfully |
| `NOT_OK` | `REJECTED` | The request failed |

You want one set of statuses inside your own code and a simple way to translate both systems' codes into it:

| Your system | System 1 | System 2 |
|---|---|---|
| `IN_PROGRESS` | `REQUESTING` | `PENDING` |
| `SUCCESS` | `OK` | `FULFILLED` |
| `ERROR` | `NOT_OK` | `REJECTED` |

Aliases do exactly this. Put your own name first, so it becomes the canonical member, and list the external codes after it with the same value:

```python
from enum import Enum


class ResponseStatus(Enum):
    # in progress
    IN_PROGRESS = 1
    REQUESTING = 1
    PENDING = 1

    # success
    SUCCESS = 2
    OK = 2
    FULFILLED = 2

    # error
    ERROR = 3
    NOT_OK = 3
    REJECTED = 3


for code in ["OK", "FULFILLED", "REJECTED"]:
    status = ResponseStatus[code]
    if status is ResponseStatus.SUCCESS:
        print(f"{code}: the request completed successfully")
    else:
        print(f"{code}: {status.name}")
```

Output:

```text
OK: the request completed successfully
FULFILLED: the request completed successfully
REJECTED: ERROR
```

`ResponseStatus["OK"]` and `ResponseStatus["FULFILLED"]` both return the canonical `ResponseStatus.SUCCESS`, so the rest of your code only ever deals with three members, no matter which system the code came from. Iterating over `ResponseStatus` also yields just your three statuses.

## Forbidding aliases with `@enum.unique`

Usually every member is supposed to have its own value. A copy-paste mistake can then create an alias without any warning:

```python
from enum import Enum


class Day(Enum):
    MON = "Monday"
    TUE = "Monday"  # copy-paste bug
    WED = "Wednesday"
    THU = "Thursday"
    FRI = "Friday"
    SAT = "Saturday"
    SUN = "Sunday"


print(len(Day))
print(Day.TUE)
```

Output:

```text
6
Day.MON
```

The enum silently has only six members, and `Day.TUE` is Monday. The bug may surface much later, far away from its cause.

To make Python check this for you, decorate the enum with `@enum.unique`. If any alias exists, the class definition itself raises `ValueError`:

```python
import enum
from enum import Enum


@enum.unique
class Day(Enum):
    MON = "Monday"
    TUE = "Monday"
    WED = "Wednesday"
    THU = "Thursday"
    FRI = "Friday"
    SAT = "Saturday"
    SUN = "Sunday"
```

Output:

```text
Traceback (most recent call last):
  ...
ValueError: duplicate values found in <enum 'Day'>: TUE -> MON
```

The message lists every alias and the member it points to, for example `CRIMSON -> RED, SALMON -> RED` when there are several. Because the error happens when the module is imported, the mistake cannot reach production unnoticed. You can also import the decorator directly: `from enum import Enum, unique` and write `@unique`.

### `@verify(UNIQUE)` (Python 3.11+)

Python 3.11 added a more general decorator, `enum.verify`, which can run several checks. `UNIQUE` is one of them:

```python
from enum import Enum, verify, UNIQUE


@verify(UNIQUE)
class Color(Enum):
    RED = 1
    CRIMSON = 1
    GREEN = 2
```

Output:

```text
Traceback (most recent call last):
  ...
ValueError: aliases found in <enum 'Color'>: CRIMSON -> RED
```

Both decorators do the same job for uniqueness. `@unique` works on all Python 3 versions; `@verify` is useful when you also want other checks (such as `CONTINUOUS` for integer values without gaps).

## Values that are equal create aliases too

Python decides whether a value is "the same" with `==` (and hashing), not by type. Since `1 == 1.0 == True`, these all collide:

```python
from enum import Enum


class Number(Enum):
    ONE = 1
    UNO = 1.0
    YES = True


print(list(Number))
print(Number.YES)
```

Output:

```text
[<Number.ONE: 1>]
Number.ONE
```

`UNO` and `YES` are aliases of `ONE`, so the enum has a single member. Be careful when mixing numbers and booleans as values, and use `@unique` to catch such surprises.

## Common mistakes

- **Expecting an alias to be a separate member.** `Color.CRIMSON` *is* `Color.RED`; its `.name` is `"RED"`, and it does not appear when iterating.
- **Defining the alias before the "main" name.** The first name with a value becomes canonical. In the status example, if `OK = 2` came before `SUCCESS = 2`, members would print as `ResponseStatus.OK`.
- **Looking for aliases in `list(Enum)`.** Iteration skips aliases. Use `Enum.__members__`.
- **Accidental duplicates from copy-paste.** Use `@unique` (or `@verify(UNIQUE)`) on every enum whose values are supposed to be distinct.
- **Mixing `1`, `1.0` and `True` as values.** They compare equal and collapse into one member.
- **Typing `__member__` instead of `__members__`.** The attribute name is plural; the singular raises `AttributeError`.

## Summary

- If two names in an enum have equal values, the first one is the canonical member and the later ones are aliases of it.
- An alias is the same object as its canonical member: same `.name`, same `.value`, `is` returns `True`.
- `Enum(value)` returns the canonical member; `Enum[alias_name]` returns it too.
- Iteration and `len()` ignore aliases; `__members__` includes them.
- Aliases are useful for mapping several external codes onto one internal name.
- `@enum.unique` (all versions) and `@enum.verify(UNIQUE)` (3.11+) raise `ValueError` at class creation if any alias exists.
- Values are compared with `==`, so `1`, `1.0` and `True` all produce the same member.

## Practice

### Exercise 1: Yes or no

Define an enum `Answer` with canonical members `YES = 1` and `NO = 0`, and aliases `Y`, `TRUE` for yes and `N`, `FALSE` for no. Write a function `parse_answer(text)` that converts user input like `"y"`, `"True"`, `" no "` to a member (strip spaces and use upper case to look it up by name). Print the result for `["y", "True", " no ", "YES", "n"]`.

### Exercise 2: List aliases by member

Write a function `alias_map(enum_cls)` that returns a dictionary mapping each canonical member's name to a list of its alias names (an empty list if it has none). Test it on the `ResponseStatus` enum from this topic.

### Exercise 3: Which classes fail?

Without running the code, decide which of the three class definitions raise `ValueError`, and what the others print. Then run it.

```python
from enum import Enum, unique


@unique
class A(Enum):
    LOW = 1
    MID = 2
    HIGH = 3


try:
    @unique
    class B(Enum):
        ON = 1
        ENABLED = True
except ValueError as error:
    print("B:", error)


class C(Enum):
    SMALL = "s"
    TINY = "s"
    LARGE = "l"


print(len(A), len(C))
print(C.TINY)
```

## Solutions

### Exercise 1

```python
from enum import Enum


class Answer(Enum):
    YES = 1
    Y = 1
    TRUE = 1
    NO = 0
    N = 0
    FALSE = 0


def parse_answer(text):
    return Answer[text.strip().upper()]


for text in ["y", "True", " no ", "YES", "n"]:
    print(repr(text), "->", parse_answer(text))
```

Output:

```text
'y' -> Answer.YES
'True' -> Answer.YES
' no ' -> Answer.NO
'YES' -> Answer.YES
'n' -> Answer.NO
```

Every spelling resolves to one of only two members, so the rest of the program needs to handle just `Answer.YES` and `Answer.NO`.

### Exercise 2

```python
from enum import Enum


class ResponseStatus(Enum):
    IN_PROGRESS = 1
    REQUESTING = 1
    PENDING = 1
    SUCCESS = 2
    OK = 2
    FULFILLED = 2
    ERROR = 3
    NOT_OK = 3
    REJECTED = 3


def alias_map(enum_cls):
    result = {member.name: [] for member in enum_cls}
    for name, member in enum_cls.__members__.items():
        if name != member.name:
            result[member.name].append(name)
    return result


print(alias_map(ResponseStatus))
```

Output:

```text
{'IN_PROGRESS': ['REQUESTING', 'PENDING'], 'SUCCESS': ['OK', 'FULFILLED'], 'ERROR': ['NOT_OK', 'REJECTED']}
```

Iterating over the enum gives the canonical members (the keys); `__members__` gives every name, and the names that differ from their member's `.name` are aliases.

### Exercise 3

Output:

```text
B: duplicate values found in <enum 'B'>: ENABLED -> ON
3 2
C.SMALL
```

- `A` has three distinct values, so `@unique` is happy.
- In `B`, `True == 1`, so `ENABLED` is an alias of `ON`, and `@unique` raises `ValueError`.
- `C` has an alias (`TINY` for `SMALL`) but no `@unique`, so it is created with only two members, and `C.TINY` is `C.SMALL`.

---

*Source: [pythontutorial.net — Python Enum Aliases & @enum.unique](https://www.pythontutorial.net/python-oop/python-enum-unique/). Adapted and expanded for PyJourney.*
