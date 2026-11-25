# Tuple vs. List

Tuples and lists are both sequences that can hold any objects, and they share indexing, slicing, `len()`, `in`, `index()` and `count()`. The key difference is that a **list is mutable** and a **tuple is immutable**. That single difference affects memory use, speed, whether the object can be a dictionary key, and how you should use each type in your code.

## What you'll learn

- What "immutable" really means for a tuple, including tuples that contain mutable objects
- Why a tuple uses less memory than a list, and what list over-allocation is
- Why "copying" a tuple is almost free, and how to measure speed fairly with `timeit`
- Why tuples can be dictionary keys and set members, but lists cannot
- How `+=` behaves differently on lists and tuples
- How to choose between a tuple and a list

## A list is mutable, a tuple is immutable

You can change a list after creating it:

```python
fruits = ["apple", "orange", "banana"]
fruits[0] = "strawberry"
fruits.append("kiwi")

print(fruits)
```

Output:

```text
['strawberry', 'orange', 'banana', 'kiwi']
```

A tuple cannot be changed. Item assignment fails, and tuples simply have no methods such as `append()`, `remove()` or `sort()`:

```python
fruits = ("apple", "orange", "banana")

try:
    fruits[0] = "strawberry"
except TypeError as error:
    print("TypeError:", error)

try:
    fruits.append("kiwi")
except AttributeError as error:
    print("AttributeError:", error)
```

Output:

```text
TypeError: 'tuple' object does not support item assignment
AttributeError: 'tuple' object has no attribute 'append'
```

Tuples have only two methods: `count()` and `index()`.

### Rebinding is not mutation

You can still assign a **new** tuple to the same variable. That does not change the old tuple. It creates another object and rebinds the name:

```python
fruits = ("apple", "orange", "banana")
print(hex(id(fruits)))

fruits = ("strawberry", "orange", "banana")
print(hex(id(fruits)))
```

Output (the addresses vary, but they are always different):

```text
0x1047a2f80
0x1047a3040
```

The same applies to `+=`. On a list, `+=` extends the existing object in place. On a tuple, it builds a new tuple and rebinds the name:

```python
numbers_list = [1, 2]
alias_list = numbers_list
numbers_list += [3]
print(alias_list, numbers_list is alias_list)

numbers_tuple = (1, 2)
alias_tuple = numbers_tuple
numbers_tuple += (3,)
print(alias_tuple, numbers_tuple is alias_tuple)
```

Output:

```text
[1, 2, 3] True
(1, 2) False
```

### Immutability is shallow

A tuple stores references. "Immutable" means those references can never be replaced, but the objects they point to can still be mutable:

```python
order = ("Olena", ["coffee"])
order[1].append("croissant")
print(order)
```

Output:

```text
('Olena', ['coffee', 'croissant'])
```

The tuple still holds the same list. It is the list that changed. So a tuple is only "fully" immutable when all its items are immutable too.

### Creating tuples

The comma makes a tuple, not the parentheses. This matters for one-element tuples:

```python
print(type((1)))
print(type((1,)))
print(type(()))

point = 3, 4
x, y = point
print(point, x, y)
```

Output:

```text
<class 'int'>
<class 'tuple'>
<class 'tuple'>
(3, 4) 3 4
```

`(1)` is just the number `1` in parentheses. `point = 3, 4` **packs** two values into a tuple, and `x, y = point` **unpacks** it.

## A tuple uses less memory

`sys.getsizeof()` returns the size of the object itself in bytes (not counting the items it references):

```python
from sys import getsizeof

fruits = ["apple", "orange", "banana"]
print(f"The size of the list is {getsizeof(fruits)} bytes.")

fruits = ("apple", "orange", "banana")
print(f"The size of the tuple is {getsizeof(fruits)} bytes.")
```

Output (Python 3.14, 64-bit; the exact numbers differ between versions):

```text
The size of the list is 88 bytes.
The size of the tuple is 72 bytes.
```

There are two reasons:

1. **Structure.** A tuple stores its item references directly inside the object. A list keeps them in a separate array and also has to remember how much space it has allocated.
2. **Over-allocation.** Because a list can grow, CPython reserves extra slots when it resizes. Then most `append()` calls do not need to reallocate memory, which makes appending fast on average. A tuple has a fixed length, so it gets exactly the space it needs.

You can watch over-allocation as a list grows:

```python
from sys import getsizeof

items = []
last = None
for i in range(20):
    size = getsizeof(items)
    if size != last:
        print(f"len={len(items):2} size={size}")
        last = size
    items.append(i)
```

Output (Python 3.14, 64-bit):

```text
len= 0 size=56
len= 1 size=88
len= 5 size=120
len= 9 size=184
len=17 size=248
```

The size jumps in steps: after the first `append()`, the list has room for 4 items, then 8, then 16, and so on. Each slot is an 8-byte reference.

The saving is small for one object but adds up when you keep millions of small records in memory.

## Copying a tuple is (almost) free

Copying a list must create a new list, because the copy and the original must be able to change independently:

```python
fruit_list = ["apple", "orange", "banana"]
fruit_list2 = list(fruit_list)

print(fruit_list2 == fruit_list)
print(fruit_list2 is fruit_list)
```

Output:

```text
True
False
```

A tuple can never change, so there is no reason to duplicate it. `tuple(t)`, `t[:]` and `copy.copy(t)` simply return the same object:

```python
import copy

fruit_tuple = ("apple", "orange", "banana")

print(tuple(fruit_tuple) is fruit_tuple)
print(fruit_tuple[:] is fruit_tuple)
print(copy.copy(fruit_tuple) is fruit_tuple)
```

Output:

```text
True
True
True
```

> **Note:** This reuse is a CPython optimisation, not a language guarantee. Never write code that depends on `is` returning `True` here.

### Measuring it fairly

A fair benchmark should time only the copy, so build the original object once in `setup`:

```python
from timeit import timeit

times = 1_000_000

t_list = timeit("list(data)", setup="data = ['apple', 'orange', 'banana']", number=times)
t_tuple = timeit("tuple(data)", setup="data = ('apple', 'orange', 'banana')", number=times)

print(f"copy a list  {times:,} times: {t_list:.3f} s")
print(f"copy a tuple {times:,} times: {t_tuple:.3f} s")
print(f"difference: {(t_tuple - t_list) / t_list:.0%}")
```

Output (timings vary between machines and runs):

```text
copy a list  1,000,000 times: 0.028 s
copy a tuple 1,000,000 times: 0.007 s
difference: -76%
```

A tuple "copy" only returns an existing object, while a list copy allocates memory and copies references. Creating the objects shows a similar gap for another reason: a tuple literal made only of constants, such as `("apple", "orange", "banana")`, is built once when the code is compiled and stored as a constant, while a list literal is built anew every time it runs.

These are nanoseconds per operation. Choose between tuples and lists for what they **mean**, and treat the speed difference as a bonus.

## Tuples can be dictionary keys

Dictionary keys and set members must be **hashable**: their hash must never change. A tuple of hashable items is hashable, a list never is:

```python
visits = {(50.45, 30.52): "Kyiv", (49.84, 24.03): "Lviv"}
print(visits[(49.84, 24.03)])

try:
    bad = {[50.45, 30.52]: "Kyiv"}
except TypeError as error:
    print("TypeError:", error)

try:
    hash(("Kyiv", [50.45, 30.52]))
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
Lviv
TypeError: cannot use 'list' as a dict key (unhashable type: 'list')
TypeError: unhashable type: 'list'
```

The last example shows the shallow immutability again: a tuple that contains a list is not hashable.

## When to use which

| | `list` | `tuple` |
|---|---|---|
| Mutable | yes | no |
| Typical meaning | a collection of similar items whose number can change | a fixed group of values, a record where position has meaning |
| Example | `["apple", "orange"]`, rows read from a file | `(x, y)`, `(name, age)`, `(r, g, b)` |
| Methods | many: `append`, `extend`, `insert`, `remove`, `pop`, `sort`, ... | only `count` and `index` |
| Hashable (dict key, set member) | no | yes, if all items are hashable |
| Memory | larger, over-allocates | smaller, exact |

Rules of thumb:

- Use a **list** when you will add, remove, sort or replace items.
- Use a **tuple** for data that should not change: coordinates, RGB colours, database rows, multiple return values (`return low, high`), and dictionary keys.
- A tuple also documents intent: whoever reads the code knows the data is not supposed to be modified.
- For records with many fields, consider `collections.namedtuple` or `typing.NamedTuple`, which add field names to a tuple, or a dataclass.

## Common mistakes

- **Forgetting the comma in a one-item tuple.** `(1)` is an `int`. Write `(1,)` or `1,`.
- **Believing a tuple's contents can never change.** A tuple holding a list can still see that list change. Only the references are fixed.
- **Using `+=` on a list inside a tuple.** It raises an error *and* still changes the list:

  ```python
  t = (1, [2])
  try:
      t[1] += [3]
  except TypeError as error:
      print("TypeError:", error)
  print(t)
  ```

  Output:

  ```text
  TypeError: 'tuple' object does not support item assignment
  (1, [2, 3])
  ```

  `t[1] += [3]` first extends the list in place (that succeeds) and then tries to store the result back into `t[1]` (that fails). Call `t[1].extend([3])` instead.

- **Converting back and forth for speed.** Turning a list into a tuple "to make it faster" costs a full copy and rarely pays off. Choose the type that fits the data.
- **Benchmarking unfairly.** Comparing `list([...])` with `tuple((...))` mostly measures how the literals are built, not copying. Put the original object in `setup`.

## Summary

- A list is mutable, a tuple is immutable. Assigning a new tuple to a variable rebinds the name and leaves the old tuple unchanged.
- Tuple immutability is shallow: the references are fixed, but mutable objects inside can still change.
- Tuples take less memory: no separate array and no over-allocation. Lists over-allocate so that `append()` is fast on average.
- Copying a tuple with `tuple(t)` or `t[:]` returns the same object in CPython, so it is practically free. Copying a list creates a new list.
- Tuples of hashable items can be dictionary keys and set members, lists cannot.
- Choose by meaning: a list for a changeable collection, a tuple for a fixed record or values that must not change.

## Practice

### Exercise 1: Predict `+=`

Without running it, predict the output. Then explain the difference.

```python
a = [1, 2]
b = a
a += [3]

c = (1, 2)
d = c
c += (3,)

print(a, b, a is b)
print(c, d, c is d)
```

### Exercise 2: Count visits by location

You receive GPS points as lists: `[[50.45, 30.52], [49.84, 24.03], [50.45, 30.52]]`. Count how many times each point occurs using a dictionary with the points as keys. Print the dictionary.

### Exercise 3: Size per item

Using `sys.getsizeof()`, compare a list and a tuple built from `range(1000)`. Print both sizes and the number of bytes per item for each (size divided by `1000`, rounded to two decimals). Then explain where the list's extra bytes come from.

### Exercise 4: Fix the record

A shopping order is stored as `order = ("Olena", ["coffee"])`. The code `order[1] += ["tea"]` crashes, but the order still ends up containing `"tea"`. Explain why, and rewrite the update so it works without an exception.

## Solutions

### Exercise 1

Output:

```text
[1, 2, 3] [1, 2, 3] True
(1, 2, 3) (1, 2) False
```

For a list, `+=` calls `extend()` on the existing object, so `a` and `b` still refer to the same, now longer, list. For a tuple, `+=` creates a new tuple `(1, 2, 3)` and rebinds `c`, while `d` keeps the original `(1, 2)`.

### Exercise 2

```python
points = [[50.45, 30.52], [49.84, 24.03], [50.45, 30.52]]

counts = {}
for point in points:
    key = tuple(point)
    counts[key] = counts.get(key, 0) + 1

print(counts)
```

Output:

```text
{(50.45, 30.52): 2, (49.84, 24.03): 1}
```

Lists cannot be dictionary keys, so each point is converted to a tuple first. `collections.Counter(tuple(p) for p in points)` gives the same result in one line.

### Exercise 3

```python
from sys import getsizeof

as_list = list(range(1000))
as_tuple = tuple(range(1000))

print(getsizeof(as_list), round(getsizeof(as_list) / 1000, 2))
print(getsizeof(as_tuple), round(getsizeof(as_tuple) / 1000, 2))
```

Output (Python 3.14, 64-bit):

```text
8056 8.06
8048 8.05
```

Both store one 8-byte reference per item, so the per-item cost is almost the same. The difference is the object header: a list has a separate array and keeps track of its allocated capacity. Here `list(range(1000))` knows the final length in advance, so it does not over-allocate. A list built with 1000 `append()` calls is larger (8856 bytes on Python 3.14), because of the spare slots reserved while it grew.

### Exercise 4

`order[1] += ["tea"]` is executed as two steps: the list `order[1]` is extended in place (this works), and then the result is assigned back to `order[1]` (this fails, because tuples do not support item assignment). Mutate the list directly instead, without any assignment to the tuple:

```python
order = ("Olena", ["coffee"])
order[1].append("tea")
print(order)
```

Output:

```text
('Olena', ['coffee', 'tea'])
```

If the order should be fully immutable, store the items as a tuple and build a new order instead: `order = (order[0], order[1] + ("tea",))`.

---

*Source: [pythontutorial.net — Python Tuple vs. List](https://www.pythontutorial.net/advanced-python/python-tuple-vs-list/). Adapted and expanded for PyJourney.*
