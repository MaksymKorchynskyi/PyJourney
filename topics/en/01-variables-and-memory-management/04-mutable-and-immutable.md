# Mutable and Immutable

Every Python object has an identity, a type and a value. For some objects the value can change after creation: they are **mutable**. For others it never changes: they are **immutable**, and every "change" actually produces a new object. Knowing which is which explains aliasing bugs, why lists cannot be dictionary keys, and why `+=` sometimes changes "another" variable.

## What you'll learn

- What mutable and immutable mean, and which built-in types belong to each group
- How to see the difference with `id()` and `is`
- Why aliasing is harmless for immutable objects and dangerous for mutable ones
- How `+=` behaves differently for lists and tuples
- Why an immutable tuple can still contain changing data
- Why only hashable (usually immutable) objects can be dictionary keys and set elements, and how to make your own immutable classes

## Mutable vs immutable objects

An object's **internal state** is the data it holds: the digits of a number, the characters of a string, the items of a list.

- An object is **immutable** if its state cannot change after it is created.
- An object is **mutable** if it offers ways to change its state in place.

| Immutable | Mutable |
|---|---|
| `int`, `float`, `complex`, `bool` | `list` |
| `str`, `bytes` | `dict` |
| `tuple`, `frozenset` | `set` |
| `range`, `None` | `bytearray` |

Instances of your own classes are mutable by default (you can assign new attribute values), but you can design them to be immutable, as shown at the end of this topic.

## Immutable example: integers and strings

When you assign a number, Python creates (or reuses) an `int` object and binds the name to it. `id()` shows the object's identity, and `hex()` shows the same number in hexadecimal:

```python
counter = 100
print(id(counter))
print(hex(id(counter)))
```

Output (varies between runs and machines):

```text
4359224352
0x103d47c20
```

Now "change" the counter. Keep a second reference to the original object so you can compare:

```python
counter = 100
before = counter      # a second reference to the original object

counter = 200
print(counter)
print(before)
print(counter is before)
```

Output:

```text
200
100
False
```

It looks as if the value of `counter` changed, but the integer object `100` was never modified. Python created (here: reused) an object `200` and **rebound** the name `counter` to it. The object `100` is untouched, as `before` proves.

```text
before the assignment:          after counter = 200:

counter --+                     counter ---> int 200
          +--> int 100
before ---+                     before  ---> int 100
```

Strings behave the same way. Every string method returns a **new** string, and item assignment is not allowed:

```python
name = "python"
upper_name = name.upper()

print(name)
print(upper_name)

name[0] = "P"
```

Output:

```text
python
PYTHON
Traceback (most recent call last):
  ...
TypeError: 'str' object does not support item assignment
```

## Mutable example: lists, dicts and sets

A list can be changed in place. The object stays the same, only its contents change:

```python
ratings = [1, 2, 3]
before = ratings      # a second reference to the same list

ratings.append(4)
ratings[0] = 10
del ratings[1]

print(ratings)
print(before)
print(ratings is before)
```

Output:

```text
[10, 3, 4]
[10, 3, 4]
True
```

`append()`, item assignment and `del` all modify the existing list, so the name never has to be rebound and `before` sees every change. Dictionaries and sets work the same way:

```python
settings = {"theme": "dark"}
settings["font"] = "mono"
settings.pop("theme")
print(settings)

tags = {"python"}
tags.add("memory")
print(sorted(tags))
```

Output:

```text
{'font': 'mono'}
['memory', 'python']
```

> **Note:** A useful rule of thumb: methods that mutate an object in place usually return `None` (`list.append()`, `list.sort()`, `dict.update()`), while operations on immutable objects return a new object (`str.upper()`, `tuple + tuple`).

## Why the difference matters: aliasing

When two names refer to the same object, they are **aliases**. With immutable objects aliasing is harmless: nobody can change the shared object, so "changing" one name just rebinds it. With mutable objects every in-place change is visible through every alias. That is exactly what happened with `before` in the list example above.

This is also why immutable objects are safe to share between functions, threads and data structures without copying, while mutable ones must be copied (`list.copy()`, `dict.copy()`, `copy.deepcopy()`) when you need independent data.

## `+=`: in place or a new object?

Augmented assignment looks the same for every type, but it does different things:

- for **mutable** types that support it (`list`, `set`, `dict` with `|=`), `x += y` modifies the object in place;
- for **immutable** types (`int`, `str`, `tuple`), it creates a new object and rebinds the name.

```python
nums = [1, 2]
alias = nums
nums += [3]          # list: modifies the same object
print(alias)
print(nums is alias)

nums = nums + [4]    # creates a new list and rebinds nums
print(alias)
print(nums is alias)

point = (1, 2)
alias_point = point
point += (3,)        # tuple: always creates a new object
print(alias_point)
print(point)
print(point is alias_point)
```

Output:

```text
[1, 2, 3]
True
[1, 2, 3]
False
(1, 2)
(1, 2, 3)
False
```

Note that `nums += [3]` and `nums = nums + [3]` are **not** equivalent for lists: the first one mutates the shared list, the second builds a new one.

## Immutable is not "frozen all the way down"

A tuple is immutable: you cannot add, remove or replace its items. But a tuple stores **references**, and the objects it refers to may themselves be mutable:

```python
low = [1, 2, 3]
high = [4, 5]

rankings = (low, high)

high.append(6)
print(rankings)

rankings[1].append(7)
print(rankings)
print(high)
```

Output:

```text
([1, 2, 3], [4, 5, 6])
([1, 2, 3], [4, 5, 6, 7])
[4, 5, 6, 7]
```

The tuple still holds the same two list objects, so it is unchanged from its own point of view. The lists inside it changed. What you cannot do is replace an item:

```python
low = [1, 2, 3]
high = [4, 5]
rankings = (low, high)

rankings[1] = [9, 9]
```

Output:

```text
Traceback (most recent call last):
  ...
TypeError: 'tuple' object does not support item assignment
```

```text
rankings (tuple, fixed) --> slot 0 ---> list [1, 2, 3]      <- the list can change
                            slot 1 ---> list [4, 5, 6, 7]   <- the list can change
           the slots themselves can never point elsewhere
```

### The `+=` trap with a tuple of lists

Combine the two previous ideas and you get one of Python's most famous puzzles:

```python
pair = ([1, 2], [3])

try:
    pair[0] += [99]
except TypeError as error:
    print("TypeError:", error)

print(pair)
```

Output:

```text
TypeError: 'tuple' object does not support item assignment
([1, 2, 99], [3])
```

The operation **both fails and succeeds**. `pair[0] += [99]` runs in two steps: first `list.__iadd__` extends the list in place (this works), then Python tries to store the result back with `pair[0] = ...` (this fails, because tuples do not support item assignment). Use `pair[0].append(99)` or `pair[0].extend([99])` instead.

## Hashability: why lists cannot be dictionary keys

Dictionaries and sets find items by their **hash**, a number computed from the value. If a key's value could change after it was stored, its hash would change too, and the dictionary could no longer find it. That is why dict keys and set elements must be **hashable**, and built-in mutable types are not:

```python
locations = {(50.45, 30.52): "Kyiv", (49.84, 24.03): "Lviv"}
print(locations[(49.84, 24.03)])

visited = {[50.45, 30.52]: "Kyiv"}
```

Output (Python 3.14):

```text
Lviv
Traceback (most recent call last):
  ...
TypeError: cannot use 'list' as a dict key (unhashable type: 'list')
```

Older versions print just `TypeError: unhashable type: 'list'`. A tuple is hashable only if everything inside it is hashable, so the `rankings` tuple of lists from above cannot be a key either:

```python
low = [1, 2, 3]
high = [4, 5]
rankings = (low, high)
print(hash(rankings))
```

Output:

```text
Traceback (most recent call last):
  ...
TypeError: unhashable type: 'list'
```

When you need a set of sets, use `frozenset`, the immutable version of `set`:

```python
groups = {frozenset({"ann", "bob"}), frozenset({"bob", "ann"}), frozenset({"eve"})}
print(len(groups))
print(frozenset({"ann", "bob"}) in groups)
```

Output:

```text
2
True
```

## Making your own immutable objects

The easiest way to create an immutable class is a frozen dataclass. Instead of changing an object, you create a new one:

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Point:
    x: int
    y: int


p = Point(1, 2)
moved = Point(p.x + 10, p.y)
print(p, moved)
print({p, Point(1, 2)})

p.x = 5
```

Output:

```text
Point(x=1, y=2) Point(x=11, y=2)
{Point(x=1, y=2)}
Traceback (most recent call last):
  ...
dataclasses.FrozenInstanceError: cannot assign to field 'x'
```

A frozen dataclass is also hashable, so equal points collapse into one set element. `collections.namedtuple` and `typing.NamedTuple` are other ways to build small immutable records.

## Common mistakes

- **Calling a string method and ignoring the result.** `name.upper()` alone does nothing useful. Write `name = name.upper()`.
- **Assigning the result of an in-place method.** `items = items.sort()` sets `items` to `None`. Use `items.sort()` or `items = sorted(items)`.
- **Assuming a tuple's contents can never change.** A tuple of lists can change through the lists. Only a tuple of immutable objects is truly constant.
- **Treating `a += b` and `a = a + b` as the same for lists.** The first mutates the shared list, the second creates a new one.
- **Using a list as a dict key or set element.** Convert it to a tuple (`tuple(coords)`), or a set to a `frozenset`.
- **Comparing a saved `id()` with a later one after the original object is gone.** A destroyed object's id can be reused by a new object. Keep a reference (as `before` above) and use `is`.

## Summary

- Immutable objects (`int`, `float`, `bool`, `str`, `bytes`, `tuple`, `frozenset`, `None`) never change after creation. Every "modification" creates a new object.
- Mutable objects (`list`, `dict`, `set`, `bytearray`, most class instances) can be changed in place, and every alias sees the change.
- Rebinding a name is not the same as mutating an object. Use `is` (or `id()`) to tell which one happened.
- `+=` mutates lists in place but creates new objects for immutable types.
- Immutability is shallow: a tuple's slots are fixed, but the objects in them may be mutable.
- Dict keys and set elements must be hashable. Built-in immutable types are hashable when their contents are.
- Frozen dataclasses and named tuples let you build your own immutable types.

## Practice

### Exercise 1: Same object or a new one?

For each block, predict whether the final `is` check prints `True` (the object was changed in place) or `False` (the name was rebound to a new object).

```python
a = "hello"
original_a = a
a += " world"
print(a is original_a)

b = [1, 2]
original_b = b
b += [3]
print(b is original_b)

c = {"x": 1}
original_c = c
c["y"] = 2
print(c is original_c)

d = (1, 2)
original_d = d
d = d + (3,)
print(d is original_d)

e = {1, 2}
original_e = e
e |= {3}
print(e is original_e)
```

### Exercise 2: Explain the puzzle

Without running it, predict the output of the code below. Then run it and explain, step by step, why the exception is raised *and* the list still changes.

```python
pair = ([1, 2], [3])

try:
    pair[0] += [99]
except TypeError as error:
    print("TypeError:", error)

print(pair)
```

### Exercise 3: Unique points

You receive points as lists: `[[1, 2], [3, 4], [1, 2], [0, 0], [3, 4]]`. Write `unique_points(points)` that returns a **set** of unique points. Print how many there are and the sorted result. Why can't the set contain the lists directly?

### Exercise 4: Immutable money

Create a frozen dataclass `Money` with fields `amount: int` and `currency: str`, and a method `add(other)` that returns a **new** `Money` (raise `ValueError` if the currencies differ). Show that:

- `add()` does not change the original object;
- assigning `price.amount = 0` raises `FrozenInstanceError`;
- two equal `Money` objects count as one element in a set.

## Solutions

### Exercise 1

Output:

```text
False
True
True
False
True
```

- `str` is immutable: `+=` built a new string.
- `list +=` extends the same list in place.
- Assigning a dict key mutates the dict.
- `d + (3,)` always creates a new tuple.
- `set |=` updates the same set in place.

### Exercise 2

Output:

```text
TypeError: 'tuple' object does not support item assignment
([1, 2, 99], [3])
```

`pair[0] += [99]` is roughly `pair[0] = pair[0].__iadd__([99])`:

1. `pair[0]` gets the first list.
2. `list.__iadd__([99])` extends that list **in place**, so it becomes `[1, 2, 99]`.
3. Python then tries `pair[0] = <the same list>`. Tuples do not support item assignment, so `TypeError` is raised, but step 2 has already happened.

### Exercise 3

```python
def unique_points(points):
    return {tuple(point) for point in points}


raw = [[1, 2], [3, 4], [1, 2], [0, 0], [3, 4]]
unique = unique_points(raw)
print(len(unique))
print(sorted(unique))
```

Output:

```text
3
[(0, 0), (1, 2), (3, 4)]
```

Lists are mutable and therefore unhashable, so `{[1, 2]}` raises `TypeError`. Tuples of numbers are hashable, and equal tuples collapse into one element.

### Exercise 4

```python
from dataclasses import FrozenInstanceError, dataclass


@dataclass(frozen=True)
class Money:
    amount: int
    currency: str

    def add(self, other):
        if other.currency != self.currency:
            raise ValueError("currencies differ")
        return Money(self.amount + other.amount, self.currency)


price = Money(100, "UAH")
total = price.add(Money(50, "UAH"))
print(price)
print(total)

try:
    price.amount = 0
except FrozenInstanceError as error:
    print("FrozenInstanceError:", error)

wallet = {price, Money(100, "UAH"), total}
print(len(wallet))
```

Output:

```text
Money(amount=100, currency='UAH')
Money(amount=150, currency='UAH')
FrozenInstanceError: cannot assign to field 'amount'
2
```

`price` and `Money(100, "UAH")` are equal and have the same hash, so the set keeps only one of them, plus `total`.

---

*Source: [pythontutorial.net — Python Mutable and Immutable](https://www.pythontutorial.net/advanced-python/python-mutable-and-immutable/). Adapted and expanded for PyJourney.*
