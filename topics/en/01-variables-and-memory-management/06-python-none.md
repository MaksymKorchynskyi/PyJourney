# Python None

`None` is Python's way of saying "no value here". Functions return it when they have nothing to return, variables hold it before they get a real value, and optional parameters use it as a safe default. It looks trivial, but using it correctly (and comparing it correctly) prevents a whole family of bugs.

## What you'll learn

- What `None` is: the only instance of `NoneType`
- Why you should compare with `is None` / `is not None` and not with `==`
- How `None` differs from `0`, `False` and empty values, even though it is falsy
- How to use `None` as an initial value, a default parameter and a "no result" return value
- How `None` fixes the mutable default argument problem
- The typical errors that `None` causes, such as `'NoneType' object has no attribute ...`

## `None` and `NoneType`

`None` is a built-in constant and a keyword. Its type is `NoneType`:

```python
import types

print(type(None))
print(None == None)
print(None is None)
print(type(None)() is None)
print(types.NoneType is type(None))
```

Output:

```text
<class 'NoneType'>
True
True
True
True
```

`None` is a **singleton**: there is exactly one `None` object in a running interpreter. Even calling `NoneType()` does not create a new one, it returns the same `None`. Since Python 3.10 the type is available as `types.NoneType`, which is handy for `isinstance()` checks.

Because `None` is a keyword, you cannot rebind it:

```python
None = 1
```

Output:

```text
  File ".../example.py", line 1
    None = 1
    ^^^^
SyntaxError: cannot assign to None
```

## Compare with `is`, not `==`

PEP 8 says: comparisons to singletons like `None` should always be done with `is` or `is not`. There are two reasons.

First, `==` calls the object's `__eq__()` method, and a class can make it return anything:

```python
class Apple:
    def __eq__(self, other):
        return True


apple = Apple()
print(apple == None)
print(apple is None)
```

Output:

```text
True
False
```

`apple == None` claims the apple is `None`. `is` cannot be overridden, so `apple is None` always tells the truth. Second, `is` simply checks identity. Since there is only one `None`, "is this the `None` object?" is exactly the question you want to ask.

```python
result = None

if result is None:
    print("no result yet")

if result is not None:
    print("got a result")
```

Output:

```text
no result yet
```

## What `None` is not

`None` is not zero, not `False`, not an empty string and not an empty list. It is only equal to itself:

```python
print(None == 0)
print(None == False)
print(None == "")
print(None == [])
print(bool(None))
print(not None)
```

Output:

```text
False
False
False
False
False
True
```

Note the last two lines: `None` is **falsy**. In an `if` statement it behaves like `False`, but so do `0`, `""`, `[]` and `{}`. That is the source of a very common bug (see below).

Unlike in Python 2, you also cannot order `None` against other values:

```python
print(None < 1)
```

Output:

```text
Traceback (most recent call last):
  ...
TypeError: '<' not supported between instances of 'NoneType' and 'int'
```

## `if x is None` vs `if not x`

`if not x` asks "is `x` falsy?". `if x is None` asks "is `x` missing?". When `0`, `""` or an empty list are valid values, these are different questions:

```python
def find_index(items, target):
    for index, item in enumerate(items):
        if item == target:
            return index
    return None


position = find_index(["a", "b", "c"], "a")

if not position:
    print("not found (wrong!)")

if position is None:
    print("not found")
else:
    print("found at", position)
```

Output:

```text
not found (wrong!)
found at 0
```

The item was found at index `0`, and `0` is falsy, so `if not position` gives the wrong answer. Use `is None` whenever `None` means "no value" and other falsy values are legitimate.

## Using `None` as an initial value

When a variable has no meaningful value yet, start it with `None`, then check later whether it has been set:

```python
state = None

if state is None:
    state = "start"

print(state)
```

Output:

```text
start
```

This is clearer than inventing a fake value such as `""` or `-1`, which might later be confused with real data.

## Using `None` to fix the mutable default argument

This function appends a color to a list:

```python
def append(color, colors=[]):
    colors.append(color)
    return colors


colors = ["red", "green"]
append("blue", colors)
print(colors)

hsl = append("hue")
print(hsl)

rgb = append("red")
print(rgb)

print(hsl is rgb)
print(append.__defaults__)
```

Output:

```text
['red', 'green', 'blue']
['hue']
['hue', 'red']
True
(['hue', 'red'],)
```

Passing your own list works. But the two calls that rely on the default **share one list**, and `rgb` unexpectedly contains `'hue'`.

Why? Default values are evaluated **once**, when the `def` statement runs, and stored in the function object (`append.__defaults__`). Every call that omits `colors` gets the same list object, and `colors.append()` mutates it. The list keeps growing between calls.

The standard fix is to use `None` as the default and create a fresh list inside the function:

```python
def append(color, colors=None):
    if colors is None:
        colors = []

    colors.append(color)
    return colors


hsl = append("hue")
print(hsl)

rgb = append("red")
print(rgb)
```

Output:

```text
['hue']
['red']
```

`None` is immutable, so sharing it between calls is harmless. The new list is created on every call that needs one.

> **Tip:** Apply this pattern to every mutable default: lists, dicts, sets and your own mutable objects. Immutable defaults such as `0`, `""`, `None` or a tuple are safe.

## `None` as a return value

A function without a `return` statement, or with a bare `return`, returns `None`:

```python
def say(something):
    print(something)


def stop_early(value):
    if value < 0:
        return
    return value * 2


result = say("Hello")
print(result)
print(stop_early(-1))
print(stop_early(5))
```

Output:

```text
Hello
None
None
10
```

`say()` prints `Hello` but returns nothing, so `result` is `None`. `stop_early(-1)` reaches the bare `return`.

`None` is also the usual way to report "no result" from a lookup. Many standard functions do this: `dict.get()` returns `None` for a missing key, `re.match()` returns `None` when the pattern does not match. Type hints express this with `X | None` (or `Optional[X]` in older code):

```python
def find_user(users, user_id: int) -> str | None:
    return users.get(user_id)


users = {1: "Olena", 2: "Taras"}
print(find_user(users, 1))
print(find_user(users, 3))

name = find_user(users, 3)
if name is not None:
    print(name.upper())
else:
    print("no such user")
```

Output:

```text
Olena
None
no such user
```

The caller must check for `None` before using the result. Calling `name.upper()` on `None` would crash.

## Methods that return `None`

Methods that modify an object in place, such as `list.sort()`, `list.append()` and `dict.update()`, return `None`. Assigning their result is a classic mistake:

```python
numbers = [3, 1, 2]
numbers = numbers.sort()
print(numbers)
numbers.append(4)
```

Output:

```text
None
Traceback (most recent call last):
  ...
AttributeError: 'NoneType' object has no attribute 'append'
```

The list was sorted, but then the name `numbers` was rebound to the `None` returned by `sort()`. Write `numbers.sort()` on its own line, or `numbers = sorted(numbers)` if you want a new list.

## Common mistakes

- **Comparing with `== None`.** A custom `__eq__` can lie. Write `is None` / `is not None`.
- **Using `if not x` when `0`, `""` or `[]` are valid values.** They are falsy too. Write `if x is None`.
- **Using a mutable default argument.** `def f(items=[])` shares one list between calls. Use `items=None` and create the list inside.
- **Assigning the result of an in-place method.** `items = items.sort()` makes `items` `None`.
- **Forgetting `return`.** A function that computes a value but never returns it gives back `None`, and the error (`'NoneType' object has no attribute ...` or `unsupported operand type(s) ... 'NoneType'`) shows up later, far from the real cause.
- **Sorting or comparing data that contains `None`.** `sorted([3, None, 1])` raises `TypeError`. Filter out `None` or use a `key` function.

## Summary

- `None` is the single instance of `NoneType` and means "no value".
- Compare with `is None` and `is not None`: it is reliable and idiomatic.
- `None` is not equal to `0`, `False`, `""` or `[]`, but it is falsy, so `if x is None` and `if not x` are different checks.
- Use `None` as a placeholder initial value, as a "no result" return value, and as the default for optional parameters, especially instead of mutable defaults.
- Functions without `return` (or with a bare `return`) return `None`, and so do in-place methods like `list.sort()`.
- `None` cannot be ordered against numbers or strings: `None < 1` raises `TypeError`.

## Practice

### Exercise 1: Predict the output

Write down what each line prints, then check.

```python
print(None == 0)
print(None is None)
print(bool(None), bool(0), bool(""))
print(None == False, not None)
print(print("hi"))
print([].append(1))
```

### Exercise 2: The shared shopping cart

Two customers end up with the same cart. Run the code, explain why, and fix `add_item()` so that each call without a cart starts with an empty one, while passing an existing cart still works.

```python
def add_item(item, cart=[]):
    cart.append(item)
    return cart


first_customer = add_item("apple")
second_customer = add_item("bread")
print(first_customer)
print(second_customer)
```

### Exercise 3: Average with missing readings

A sensor returns readings where `None` means "no data": `[10, None, 0, 20, None]`. Write `average(values)` that ignores `None` but keeps `0` (the answer is `10.0`). If there are no real readings, return `None`. Also explain why filtering with `if value` gives `15.0`.

### Exercise 4: Sort with `None` last

`sorted([3, None, 1, None, 2])` raises `TypeError`. Write a key function `none_last(value)` so that `sorted(scores, key=none_last)` returns `[1, 2, 3, None, None]`.

## Solutions

### Exercise 1

Output:

```text
False
True
False False False
False True
hi
None
None
```

`None` equals only itself, but it is falsy like `0` and `""`. `print()` returns `None` (after printing `hi`), and `list.append()` also returns `None`.

### Exercise 2

The original prints the same list twice:

```text
['apple', 'bread']
['apple', 'bread']
```

The default list is created once, when `def` runs, and both calls append to it. Fixed version:

```python
def add_item(item, cart=None):
    if cart is None:
        cart = []
    cart.append(item)
    return cart


first_customer = add_item("apple")
second_customer = add_item("bread")
print(first_customer)
print(second_customer)

shared = ["milk"]
add_item("eggs", shared)
print(shared)
```

Output:

```text
['apple']
['bread']
['milk', 'eggs']
```

### Exercise 3

```python
def average(values):
    numbers = [value for value in values if value is not None]
    if not numbers:
        return None
    return sum(numbers) / len(numbers)


def average_wrong(values):
    numbers = [value for value in values if value]   # drops 0 as well!
    return sum(numbers) / len(numbers)


readings = [10, None, 0, 20, None]
print(average(readings))
print(average_wrong(readings))
print(average([None, None]))
print(average([]))
```

Output:

```text
10.0
15.0
None
None
```

`if value` throws away every falsy value, including the valid reading `0`, so the wrong version averages only `10` and `20`. Here `if not numbers` is fine, because an empty list really means "no readings".

### Exercise 4

```python
def none_last(value):
    return (value is None, value)


scores = [3, None, 1, None, 2]

try:
    print(sorted(scores))
except TypeError as error:
    print("TypeError:", error)

print(sorted(scores, key=none_last))
```

Output:

```text
TypeError: '<' not supported between instances of 'NoneType' and 'int'
[1, 2, 3, None, None]
```

Each value is sorted by the tuple `(is it None?, value)`. Numbers get `(False, n)` and come first because `False < True`. Two `None` keys are `(True, None)` and `(True, None)`: tuples compare item by item and stop at the first difference, and since these tuples are equal, `None` is never compared with `<`.

---

*Source: [pythontutorial.net — Python None](https://www.pythontutorial.net/advanced-python/python-none/). Adapted and expanded for PyJourney.*
