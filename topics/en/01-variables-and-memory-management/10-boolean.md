# Boolean

Python's `bool` type has just two values, `True` and `False`. Yet *every* object in Python can act as a boolean in an `if` or `while` condition. Knowing how Python decides whether an object counts as true or false is what makes idioms like `if items:` work, and it also explains several classic bugs.

## What you'll learn

- Why `bool` is a subclass of `int`, and what that means in practice
- Why `True` and `False` are singletons, and how to compare boolean values
- Which objects are *falsy* and which are *truthy*
- How `bool()` decides: `__bool__()`, then `__len__()`, otherwise `True`
- How to give your own classes a meaningful truth value
- When `if value:` is the right check and when you need `is None`

## The bool type

Python represents boolean values with the built-in class `bool`. It is a **subclass of `int`**, so every boolean is also an integer:

```python
print(issubclass(bool, int))
print(isinstance(True, bool), isinstance(False, bool))
print(isinstance(True, int))
print(type(True))
```

Output:

```text
True
True True
True
<class 'bool'>
```

A few facts about the type:

- `bool` has exactly two instances, `True` and `False`. They are **singletons**: every `True` in your program is the very same object, and so is every `False`. Any expression that produces a boolean (`5 > 3`, `bool(x)`, `isinstance(...)`) returns one of these two objects.
- `True` and `False` are keywords, so you cannot rebind them. `True = 0` is a `SyntaxError: cannot assign to True`.
- `bool` cannot be subclassed. `class MyBool(bool): ...` raises `TypeError: type 'bool' is not an acceptable base type`. This guarantees that the two singletons stay the only booleans.
- Since Python 3.12 both objects are immortal, so their reference count never changes (see the References topic).

## Booleans are integers

Because `bool` inherits from `int`, `True` behaves like `1` and `False` like `0` in arithmetic:

```python
print(int(True))
print(int(False))

print(True + True)
print(True * 10)
print(sum([True, False, True]))

scores = [72, 45, 90, 58, 100]
passed = sum(score >= 60 for score in scores)
print(passed)
```

Output:

```text
1
0
2
10
2
3
```

The last example is a common idiom: each comparison yields `True` or `False`, and `sum()` counts the `True` values. Arithmetic on booleans returns a plain `int` (`type(True + True)` is `int`).

Equal does not mean identical, though. `True == 1` is `True`, but `True` and `1` are different objects. And because they are equal *and* have the same hash, they collide as dictionary keys:

```python
x = 1
print(True == x)
print(True is x)

data = {1: "one", True: "yes"}
print(data)
```

Output:

```text
True
False
{1: 'yes'}
```

The dictionary kept the first key (`1`) and overwrote its value with `"yes"`, because Python considers `1` and `True` to be the same key. The same happens in sets: `{1, True}` has one element.

## Comparing boolean values

Since `True` and `False` are singletons, `==` and `is` give the same answer when both sides really are booleans:

```python
a = True
b = True

print(a == b)
print(a is b)

a = False
b = False

print(a == b)
print(a is b)

print(bool(42) is True)
print((5 > 3) is True)
```

Output:

```text
True
True
True
True
True
True
```

In everyday code, however, you rarely compare with `True` or `False` at all. PEP 8, the Python style guide, recommends testing the value directly:

```python
is_ready = True

# Good
if is_ready:
    ...

# Avoid
if is_ready == True:
    ...

# Worse
if is_ready is True:
    ...
```

The direct form is shorter, reads like English, and works with any truthy value. Use `is True` only in the rare case when you must distinguish the actual `True` object from other truthy values, for example a parameter that accepts either `True` or a string.

## Truthiness: every object has a boolean value

The constructor `bool(obj)` accepts **any** object and returns `True` or `False`. The result is called the object's *truth value*. Objects whose truth value is `False` are called **falsy**, and all the others are **truthy**.

These objects are falsy:

- `None` and `False`
- zero of any numeric type: `0`, `0.0`, `0j`, `Decimal(0)`, `Fraction(0)`
- empty sequences: `""`, `[]`, `()`, `range(0)`, `b""`
- empty mappings and sets: `{}`, `set()`, `frozenset()`
- instances of classes whose `__bool__()` returns `False` or whose `__len__()` returns `0`

Everything else is truthy, including some values that *look* false:

```python
from decimal import Decimal
from fractions import Fraction

falsy = [None, False, 0, 0.0, 0j, Decimal(0), Fraction(0),
         "", [], (), range(0), b"", {}, set(), frozenset()]
print(all(bool(value) is False for value in falsy))

truthy = ["0", "False", " ", [0], [[]], (None,), -1, 0.001, float("nan")]
for value in truthy:
    print(f"{value!r:>10} -> {bool(value)}")
```

Output:

```text
True
       '0' -> True
   'False' -> True
       ' ' -> True
       [0] -> True
      [[]] -> True
   (None,) -> True
        -1 -> True
     0.001 -> True
       nan -> True
```

Notice `"0"` and `"False"` (non-empty strings), `[0]` (a list with one element), and `float("nan")` (not equal to zero).

Python applies `bool()` implicitly in many places: `if` and `while` conditions, the operators `and`, `or` and `not`, and functions such as `any()`, `all()` and `filter(None, ...)`:

```python
values = [3, 0, "", "text", None, [1]]

print([value for value in values if value])
print(list(filter(None, values)))
print(any(values), all(values))
```

Output:

```text
[3, 'text', [1]]
[3, 'text', [1]]
True False
```

## How bool() works under the hood

Every class defines, directly or by inheritance, how its instances turn into a boolean. `bool(obj)` follows this algorithm:

```text
bool(obj)
   |
   v
does type(obj) define __bool__()? --yes--> return obj.__bool__()   (must return a bool)
   | no
   v
does type(obj) define __len__()?  --yes--> return obj.__len__() != 0
   | no
   v
return True
```

### The `__bool__()` method

If the object's class defines `__bool__()`, Python calls it and uses the result. The `int` class implements it in C, but its logic is equivalent to:

```python
def __bool__(self):
    return self != 0
```

So `bool(200)` effectively runs `(200).__bool__()`, which returns `200 != 0`, that is `True`. And `bool(0)` returns `0 != 0`, that is `False`:

```python
print((200).__bool__())
print((0).__bool__())
print(bool(200), bool(0))
```

Output:

```text
True
False
True False
```

> **Note:** The parentheses in `(200).__bool__()` are required. Without them, `200.__bool__()` is a `SyntaxError` because Python reads `200.` as the start of a float literal.

### The `__len__()` method

If there is no `__bool__()`, Python falls back to `__len__()`: a length of `0` means `False`, any other length means `True`. That is why an empty list is falsy and a list with at least one element is truthy, even if that element is itself falsy (`[0]`, `[[]]`).

### Neither method: always `True`

Instances of a class that defines neither method are always truthy. A plain object has no notion of "empty" or "zero", so Python treats it as "something exists".

### Giving your own classes a truth value

Define `__bool__()` when truthiness depends on some condition, and `__len__()` when your object is a container:

```python
class Account:
    def __init__(self, balance):
        self.balance = balance

    def __bool__(self):
        return self.balance > 0


class Playlist:
    def __init__(self, songs):
        self.songs = list(songs)

    def __len__(self):
        return len(self.songs)


class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y


print(bool(Account(100)), bool(Account(0)))
print(bool(Playlist(["Intro", "Outro"])), bool(Playlist([])))
print(bool(Point(0, 0)))
```

Output:

```text
True False
True False
True
```

`Point(0, 0)` is truthy even though both coordinates are zero, because `Point` defines neither method.

Python checks what these methods return. `__bool__()` must return an actual `bool` (returning `1` is not enough), and `__len__()` must return a non-negative integer:

```python
class Broken:
    def __bool__(self):
        return 1


print(bool(Broken()))
```

Output (last line of the traceback):

```text
TypeError: __bool__ should return bool, returned int
```

> **Note:** Since Python 3.14, using the special value `NotImplemented` in a boolean context (`bool(NotImplemented)`, `if NotImplemented:`) raises `TypeError`. Before that it only issued a `DeprecationWarning`.

## Using truthiness in practice

Suppose a function returns a list of users, an empty list, or `None` when the source is unavailable:

```python
def get_list(source):
    if source == "db":
        return ["alice", "bob"]
    if source == "cache":
        return []
    return None


for source in ["db", "cache", "unknown"]:
    my_list = get_list(source)
    if my_list is not None and len(my_list) > 0:
        for element in my_list:
            print(element)
    else:
        print("List is None or empty")
```

Output:

```text
alice
bob
List is None or empty
List is None or empty
```

Both `None` and `[]` are falsy, so the condition can be written much more simply, and the behaviour stays the same:

```python
def get_list(source):
    if source == "db":
        return ["alice", "bob"]
    if source == "cache":
        return []
    return None


for source in ["db", "cache", "unknown"]:
    my_list = get_list(source)
    if my_list:
        for element in my_list:
            print(element)
    else:
        print("List is None or empty")
```

Output:

```text
alice
bob
List is None or empty
List is None or empty
```

`if my_list:` is idiomatic Python, but remember what it means: "neither `None` nor empty". When `None` and "empty" mean different things in your program, test them separately:

```python
def get_list(source):
    if source == "db":
        return ["alice", "bob"]
    if source == "cache":
        return []
    return None


for source in ["db", "cache", "unknown"]:
    my_list = get_list(source)
    if my_list is None:
        print(f"{source}: not available")
    elif not my_list:
        print(f"{source}: no users yet")
    else:
        print(f"{source}: {', '.join(my_list)}")
```

Output:

```text
db: alice, bob
cache: no users yet
unknown: not available
```

## Common mistakes

- **Comparing with `True` or `False`.** `if flag == True:` and `if flag is True:` are noisier than `if flag:` and can behave differently for non-bool values. Write `if flag:` and `if not flag:`.
- **Treating `0` or `""` as "missing".** Truthiness lumps all falsy values together. If `0` is a valid value, test for `None` explicitly:

  ```python
  def set_volume(level=None):
      if not level:          # bug: 0 is a valid level
          level = 50
      return level


  def set_volume_fixed(level=None):
      if level is None:
          level = 50
      return level


  print(set_volume(0), set_volume_fixed(0))
  ```

  Output:

  ```text
  50 0
  ```

- **Converting text with `bool()`.** Any non-empty string is truthy, so `bool("False")` and `bool("0")` are both `True`. Parse strings explicitly (see Exercise 4):

  ```python
  answer = "False"
  print(bool(answer))
  print(bool("0"))
  ```

  Output:

  ```text
  True
  True
  ```

- **Using `~` to negate a boolean.** `~` is bitwise inversion of the underlying integer, so `~True` is `-2`, which is truthy. It has been deprecated since Python 3.12 and is scheduled for removal in 3.16. Use `not`:

  ```python
  is_ready = True
  print(~is_ready)      # DeprecationWarning since 3.12, prints -2
  print(not is_ready)   # False
  ```

  Output (the `DeprecationWarning` itself goes to stderr):

  ```text
  -2
  False
  ```

- **Mixing `True` and `1` as dictionary keys or set items.** They are equal and hash the same, so they collapse into one entry.
- **Returning a non-bool from `__bool__()`.** Python raises `TypeError`. Return `self.something > 0`, not `self.something`.

## Summary

- `bool` is a subclass of `int`. `True` behaves like `1` and `False` like `0`, which makes `sum(condition for x in items)` a handy counter.
- `True` and `False` are the only two `bool` instances (singletons). `bool` cannot be subclassed.
- Every object has a truth value. Falsy: `None`, `False`, numeric zeros, empty sequences, collections and mappings, and objects whose `__bool__()`/`__len__()` say so. Everything else is truthy.
- `bool(obj)` calls `__bool__()`, falls back to `__len__()`, and returns `True` if neither exists.
- Prefer `if value:` over comparisons with `True`/`False`, but use `is None` when `0`, `""` or `[]` are valid values.
- `__bool__()` must return a real `bool`. Since Python 3.14, `NotImplemented` cannot be used as a boolean.

## Practice

### Exercise 1: Truthy or falsy?

Predict whether each value is truthy or falsy, then check with a loop that prints `repr(value)` and `bool(value)`:

```text
0, "0", [], [[]], None, 0.0, -1, " ", {}, float("nan"), range(0), (0,)
```

### Exercise 2: Count with booleans

Given `scores = [72, 45, 90, 58, 100, 60, 33]`, count how many students passed (score of 60 or more) using `sum()` over boolean values, without an explicit counter or `if`. Print the count and the pass rate as a percentage.

### Exercise 3: A cart that knows when it is empty

Write a `Cart` class with an `add(item)` method so that `if not cart:` prints `"Cart is empty"` for a new cart, and `if cart:` is true after adding items. Do not define `__bool__()`.

### Exercise 4: Parse booleans from text

Write `parse_bool(text)` that converts user input to a boolean. It should ignore case and surrounding spaces, return `True` for `"true"`, `"yes"`, `"y"`, `"on"`, `"1"`, return `False` for `"false"`, `"no"`, `"n"`, `"off"`, `"0"` and an empty string, and raise `ValueError` for anything else.

## Solutions

### Exercise 1

```python
values = [0, "0", [], [[]], None, 0.0, -1, " ", {}, float("nan"), range(0), (0,)]
for value in values:
    print(f"{value!r:>12} -> {bool(value)}")
```

Output:

```text
           0 -> False
         '0' -> True
          [] -> False
        [[]] -> True
        None -> False
         0.0 -> False
          -1 -> True
         ' ' -> True
          {} -> False
         nan -> True
 range(0, 0) -> False
        (0,) -> True
```

The tricky ones: `"0"` and `" "` are non-empty strings; `[[]]` and `(0,)` contain one element each; `nan` is not equal to zero; `range(0)` has length 0.

### Exercise 2

```python
scores = [72, 45, 90, 58, 100, 60, 33]

passed = sum(score >= 60 for score in scores)
print(f"passed: {passed} of {len(scores)}")
print(f"pass rate: {passed / len(scores):.0%}")
```

Output:

```text
passed: 4 of 7
pass rate: 57%
```

Each `score >= 60` is `True` (1) or `False` (0), so the sum is the number of passing scores. The `:.0%` format multiplies by 100 and adds a percent sign.

### Exercise 3

```python
class Cart:
    def __init__(self):
        self.items = []

    def add(self, item):
        self.items.append(item)

    def __len__(self):
        return len(self.items)


cart = Cart()
if not cart:
    print("Cart is empty")

cart.add("book")
cart.add("pen")
if cart:
    print(f"Cart has {len(cart)} items")
```

Output:

```text
Cart is empty
Cart has 2 items
```

Without `__bool__()`, Python uses `__len__()`, so an empty cart is falsy. As a bonus, `len(cart)` now works too.

### Exercise 4

```python
TRUE_WORDS = {"true", "yes", "y", "on", "1"}
FALSE_WORDS = {"false", "no", "n", "off", "0", ""}


def parse_bool(text):
    word = text.strip().lower()
    if word in TRUE_WORDS:
        return True
    if word in FALSE_WORDS:
        return False
    raise ValueError(f"not a boolean: {text!r}")


for text in ["Yes", " false ", "0", "ON", ""]:
    print(repr(text), parse_bool(text))

try:
    parse_bool("maybe")
except ValueError as error:
    print(error)
```

Output:

```text
'Yes' True
' false ' False
'0' False
'ON' True
'' False
not a boolean: 'maybe'
```

Raising an error for unknown input is safer than guessing: a typo such as `"ture"` is reported instead of silently becoming `False`.

---

*Source: [pythontutorial.net — How Python bool() Constructor Works Under the Hood](https://www.pythontutorial.net/advanced-python/python-bool/). Adapted and expanded for PyJourney.*
