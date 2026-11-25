# Fibonacci Sequence

The Fibonacci numbers `1, 1, 2, 3, 5, 8, 13, ...` are a classic programming example. They show why naive recursion can be catastrophically slow, how caching fixes it, and, in this topic, how to build your own **sequence type**: a class whose objects support `len()`, indexing, `for` loops, `in` and slicing just like a list or a tuple.

## What you'll learn

- What the Fibonacci sequence is and which indexing conventions exist
- Why the naive recursive function makes an exponential number of calls
- How `functools.lru_cache` and `functools.cache` remove the repeated work, and where recursion still hits its limit
- Which two methods turn a class into an immutable sequence, and what Python gives you for free once they exist
- How to support negative indexes, slicing and proper error handling in `__getitem__`

## The Fibonacci sequence

In the Fibonacci sequence every number is the sum of the two numbers before it:

```text
1, 1, 2, 3, 5, 8, 13, 21, 34, 55, ...
```

Written as a formula with positions counted from 1:

```text
f(1) = 1
f(2) = 1
f(n) = f(n-1) + f(n-2)    for n > 2
```

Many sources, including most mathematics texts today, start the sequence with `0` instead: `0, 1, 1, 2, 3, 5, ...` with `F(0) = 0` and `F(1) = 1`. Both conventions describe the same numbers, shifted by one position. This topic follows the source and starts with `1, 1`, but it counts positions **from 0**, like Python indexes: the item at index `0` is `1`, at index `1` is `1`, at index `2` is `2`, and so on.

The sequence is named after Leonardo of Pisa, known as Fibonacci, who was born around 1170. He did not discover it: in his book *Liber Abaci* (1202) he used it in a puzzle about breeding rabbits and so introduced it to European mathematics. Indian scholars such as Pingala, Virahanka and Hemachandra had described the same numbers centuries earlier while studying the rhythms of poetry.

## A recursive function

The definition translates directly into a recursive function:

```python
def fib(n):
    if n < 2:
        return 1
    return fib(n - 2) + fib(n - 1)


print([fib(n) for n in range(10)])
```

Output:

```text
[1, 1, 2, 3, 5, 8, 13, 21, 34, 55]
```

The **base case** `n < 2` returns `1` for indexes `0` and `1`. For every larger `n`, the function calls itself for the two previous indexes and adds the results: `fib(n) = fib(n - 2) + fib(n - 1)`.

### Why the naive version is slow

Add a `print()` to see every call that `fib(5)` makes:

```python
def fib(n):
    print(f"Calculate the Fibonacci of {n}")
    if n < 2:
        return 1
    return fib(n - 2) + fib(n - 1)


fib(5)
```

Output:

```text
Calculate the Fibonacci of 5
Calculate the Fibonacci of 3
Calculate the Fibonacci of 1
Calculate the Fibonacci of 2
Calculate the Fibonacci of 0
Calculate the Fibonacci of 1
Calculate the Fibonacci of 4
Calculate the Fibonacci of 2
Calculate the Fibonacci of 0
Calculate the Fibonacci of 1
Calculate the Fibonacci of 3
Calculate the Fibonacci of 1
Calculate the Fibonacci of 2
Calculate the Fibonacci of 0
Calculate the Fibonacci of 1
```

`fib(3)` is computed twice and `fib(2)` three times. The calls form a tree in which the same subtrees appear again and again:

```text
                 fib(4)
               /        \
          fib(2)          fib(3)
          /    \          /    \
      fib(0)  fib(1)  fib(1)  fib(2)
                              /    \
                          fib(0)  fib(1)
```

The number of calls grows as fast as the Fibonacci numbers themselves, by a factor of about 1.6 per step:

```python
calls = 0


def fib(n):
    global calls
    calls += 1
    if n < 2:
        return 1
    return fib(n - 2) + fib(n - 1)


for n in [5, 10, 20, 25]:
    calls = 0
    fib(n)
    print(f"fib({n}) needed {calls:,} calls")
```

Output:

```text
fib(5) needed 15 calls
fib(10) needed 177 calls
fib(20) needed 21,891 calls
fib(25) needed 242,785 calls
```

At this rate, `fib(50)` would need tens of billions of calls. That is **exponential time**.

### Caching results with lru_cache

The function always returns the same result for the same argument, so there is no reason to compute a value twice. The decorator `functools.lru_cache` stores the result of each call in a dictionary keyed by the arguments. The next call with the same argument returns the stored value immediately:

```python
from functools import lru_cache


@lru_cache
def fib(n):
    print(f"Calculate the Fibonacci of {n}")
    if n < 2:
        return 1
    return fib(n - 2) + fib(n - 1)


print(fib(6))
print(fib(6))
print(fib.cache_info())
```

Output:

```text
Calculate the Fibonacci of 6
Calculate the Fibonacci of 4
Calculate the Fibonacci of 2
Calculate the Fibonacci of 0
Calculate the Fibonacci of 1
Calculate the Fibonacci of 3
Calculate the Fibonacci of 5
13
13
CacheInfo(hits=5, misses=7, maxsize=128, currsize=7)
```

Each value from `0` to `6` is now computed exactly once (7 "misses"). Every other request is answered from the cache (5 "hits"), including the second `fib(6)`, which prints nothing. Storing results of a pure function like this is called **memoization**, and it turns the exponential algorithm into a linear one.

- `@lru_cache` without parentheses works since Python 3.8. By default it keeps the **128** most recently used results (*LRU* means "least recently used" entries are dropped first). `@lru_cache(maxsize=None)` or `@lru_cache(2**16)` change the limit.
- `@functools.cache` (Python 3.9+) is a shorter name for `@lru_cache(maxsize=None)`: an unbounded cache.
- The arguments must be hashable, because they become dictionary keys.

### The recursion limit

Caching removes the repeated work, but not the recursion itself. Every call that has not returned yet occupies a stack frame, and Python limits the depth (`sys.getrecursionlimit()` is `1000` by default):

```python
from functools import cache


@cache
def fib(n):
    if n < 2:
        return 1
    return fib(n - 2) + fib(n - 1)


print(fib(100))
print(len(str(fib(1000))))

fib.cache_clear()
try:
    fib(3000)
except RecursionError as error:
    print("RecursionError:", error)
```

Output:

```text
573147844013817084101
209
RecursionError: maximum recursion depth exceeded
```

With an empty cache, `fib(3000)` first calls `fib(2998)`, which calls `fib(2996)`, and so on: about 1500 nested calls, more than the limit allows. (Because `fib(n - 2)` is called first, the depth is roughly `n / 2`, so on Python 3.14 the limit is reached at about `n = 2000`.) Values that are already cached return immediately, so computing them in increasing order avoids deep recursion. Usually, though, a plain loop is the better tool:

```python
def fib(n):
    a, b = 1, 1
    for _ in range(n):
        a, b = b, a + b
    return a


print([fib(n) for n in range(10)])
print(len(str(fib(10_000))))
```

Output:

```text
[1, 1, 2, 3, 5, 8, 13, 21, 34, 55]
2090
```

The loop keeps only the last two numbers, needs no recursion and no cache, and handles large indexes easily. Python integers grow as needed, so `fib(10_000)` is exact. (Converting an integer with more than 4300 digits to a string raises `ValueError` by default, as the topic Integers explains.)

## A custom sequence type

The built-in sequences such as `list`, `tuple` and `range` share one protocol. A class becomes an **immutable sequence** when it implements two special methods:

- `__len__(self)` returns the number of items, which makes `len(obj)` work. Strictly speaking, iteration and indexing work without it, but a sequence should have a length.
- `__getitem__(self, index)` returns the item at a given index and **raises `IndexError`** when the index is out of range. It may also accept a `slice` object to support slicing (see the topic Slicing in Depth).

`range` is a good model: it does not store its numbers, it computes each one on request. A `Fibonacci` sequence can do the same.

### The first version

Save this class in a file named `fibonacci.py`:

```python
# fibonacci.py
from functools import lru_cache


class Fibonacci:
    def __init__(self, n):
        self.n = n

    def __len__(self):
        return self.n

    def __getitem__(self, index):
        if isinstance(index, int):
            if index < 0 or index > self.n - 1:
                raise IndexError

            return Fibonacci.fib(index)

    @staticmethod
    @lru_cache(2**16)
    def fib(n):
        if n < 2:
            return 1
        return Fibonacci.fib(n - 2) + Fibonacci.fib(n - 1)
```

- `__init__()` stores `n`, the length of the sequence. No numbers are computed yet.
- `__len__()` returns that length.
- `__getitem__()` checks that the index is an integer in the range `0 ... n - 1`, raises `IndexError` otherwise, and computes the number with `fib()`.
- `fib()` is a **static method**: it needs neither the instance nor the class, it just belongs to `Fibonacci` logically. It is cached with `lru_cache`, so the cache is shared by all `Fibonacci` objects. The decorator order matters: `@staticmethod` must be the outer (top) decorator, so that it wraps the already cached function.

Now use the class from another script in the same folder:

```python
from fibonacci import Fibonacci

fibonacci = Fibonacci(10)

# access elements via indices
print("Accessing Fibonacci sequence using []:")
print(fibonacci[0])
print(fibonacci[1])
print(fibonacci[2])

print("Accessing Fibonacci sequence using for loop:")
# using for loop
for f in fibonacci:
    print(f)
```

Output:

```text
Accessing Fibonacci sequence using []:
1
1
2
Accessing Fibonacci sequence using for loop:
1
1
2
3
5
8
13
21
34
55
```

### Why the for loop works

The class has no `__iter__()` method, and yet the `for` loop works. When an object has no `__iter__()`, `iter()` falls back to the **sequence protocol**: it creates an iterator that calls `__getitem__(0)`, `__getitem__(1)`, `__getitem__(2)`, ... and stops as soon as `IndexError` is raised. Everything built on iteration works the same way:

```python
from fibonacci import Fibonacci

fibonacci = Fibonacci(10)

print(len(fibonacci))
print(list(fibonacci))
print(21 in fibonacci, 4 in fibonacci)
print(sum(fibonacci), max(fibonacci))
print(list(reversed(fibonacci)))
first, second, *rest = fibonacci
print(first, second, len(rest))
print(type(iter(fibonacci)).__name__)
```

Output:

```text
10
[1, 1, 2, 3, 5, 8, 13, 21, 34, 55]
True False
143 55
[55, 34, 21, 13, 8, 5, 3, 2, 1, 1]
1 1 8
iterator
```

- `list()`, `sum()`, `max()` and unpacking iterate over the object.
- `in` also falls back to iteration when there is no `__contains__()`: it compares items one by one.
- `reversed()` needs both `__len__()` and `__getitem__()`: it starts at index `len(obj) - 1` and counts down.

This is why raising **`IndexError`** (and not, say, `ValueError`) is essential. It is the signal that ends the iteration. A `__getitem__()` that never raises would make `for` loops run forever, and one that raises another exception makes them crash.

### Weak spots of the first version

The first version only handles non-negative integers. Everything else misbehaves quietly:

```python
from fibonacci import Fibonacci

fibonacci = Fibonacci(10)

print(fibonacci[1:5])
print(fibonacci["one"])
try:
    fibonacci[-1]
except IndexError:
    print("IndexError for -1")
```

Output:

```text
None
None
IndexError for -1
```

- A slice or a string is not an `int`, so the `if` is skipped and the method falls off the end, returning `None` instead of raising an error.
- Negative indexes are rejected, although every built-in sequence accepts them.
- `raise IndexError` without a message makes debugging harder.

## Adding slicing, negative indexes and type checks

When you write `fibonacci[1:5]`, Python passes a `slice` object to `__getitem__()`. Its method `indices(length)` converts the slice, with all its defaults, negative values and out-of-range bounds, into concrete `(start, stop, step)` values for `range()`. Replace the contents of `fibonacci.py` with this improved version:

```python
# fibonacci.py
import operator
from functools import cache


class Fibonacci:
    def __init__(self, n):
        if n < 0:
            raise ValueError("length must not be negative")
        self.n = n

    def __len__(self):
        return self.n

    def __getitem__(self, index):
        if isinstance(index, slice):
            indices = index.indices(self.n)
            return [Fibonacci.fib(k) for k in range(*indices)]

        index = operator.index(index)   # TypeError for str, float, ...
        if index < 0:
            index += self.n
        if not 0 <= index < self.n:
            raise IndexError("Fibonacci index out of range")
        return Fibonacci.fib(index)

    def __repr__(self):
        return f"Fibonacci({self.n})"

    @staticmethod
    @cache
    def fib(n):
        if n < 2:
            return 1
        return Fibonacci.fib(n - 2) + Fibonacci.fib(n - 1)
```

```python
from fibonacci import Fibonacci

fibonacci = Fibonacci(10)
print(fibonacci)
print(fibonacci[1:5])
print(fibonacci[-1], fibonacci[-2])
print(fibonacci[::3])
print(fibonacci[-3:])
print(fibonacci[:-5:-1])

for key in ["one", 2.0, 10]:
    try:
        fibonacci[key]
    except (TypeError, IndexError) as error:
        print(f"{type(error).__name__}: {error}")
```

Output:

```text
Fibonacci(10)
[1, 2, 3, 5]
55 34
[1, 3, 13, 55]
[21, 34, 55]
[55, 34, 21, 13]
TypeError: 'str' object cannot be interpreted as an integer
TypeError: 'float' object cannot be interpreted as an integer
IndexError: Fibonacci index out of range
```

What changed:

- **Slices** go through `index.indices(self.n)` and `range()`, so every slicing form works, including negative steps. The result is a list, because a part of the sequence (for example items `1` to `4`) is not itself a `Fibonacci(n)` object.
- **`operator.index()`** accepts integers and integer-like objects (anything with `__index__()`, including `bool`), and raises a clear `TypeError` for strings, floats and other types. That is exactly how lists treat their indexes.
- **Negative indexes** are converted by adding the length, like in built-in sequences.
- `IndexError` has a message, `__init__()` validates its argument, and `__repr__()` makes the object readable when printed.

To also get `index()`, `count()` and `isinstance(obj, Sequence)` support for free, inherit from `collections.abc.Sequence`, as shown in the topic Python Sequences and in Exercise 4 below.

## Common mistakes

- **Naive recursion without caching.** The plain recursive `fib()` makes an exponential number of calls. Add `@cache`/`@lru_cache` or use a loop.
- **Assuming caching fixes deep recursion.** A cold cache still needs about `n / 2` nested calls. For large `n`, compute iteratively.
- **Mixing up the indexing conventions.** `0, 1, 1, 2, ...` and `1, 1, 2, 3, ...` are shifted by one. State which one your code uses.
- **Raising the wrong exception in `__getitem__()`.** Iteration stops only on `IndexError`. Any other exception propagates, and never raising makes loops infinite.
- **Returning `None` for unsupported keys.** A missing `else` branch silently returns `None`. Raise `TypeError` instead, for example with `operator.index()`.
- **Putting `@lru_cache` above `@staticmethod`.** `@staticmethod` must be the outermost decorator.
- **Forgetting that an unbounded cache keeps everything.** `@cache` never forgets a result. Use `@lru_cache(maxsize=...)` if the set of possible arguments is huge.

## Summary

- Each Fibonacci number is the sum of the two before it. This topic uses `1, 1, 2, 3, ...` with positions counted from 0.
- The naive recursive function recomputes the same values over and over and needs an exponential number of calls.
- `@lru_cache` and `@cache` memoize results, so each value is computed once. Deep recursion can still hit the recursion limit, and a loop avoids it.
- A class with `__len__()` and `__getitem__()` that raises `IndexError` is an immutable sequence. `for`, `in`, `list()`, `sum()`, `reversed()` and unpacking then work automatically.
- `__getitem__()` receives a `slice` object for slicing. `slice.indices(len(self))` plus `range()` handles every slice form.
- Use `operator.index()` to accept integer-like indexes and reject everything else, and convert negative indexes by adding the length.

## Practice

### Exercise 1: Count the calls

Using the naive recursive `fib()` with a call counter, check for every `n` from `0` to `20` that the number of calls equals `2 * fib(n) - 1`. Print whether the formula holds and how many calls `fib(20)` needs. Then explain why the formula is true.

### Exercise 2: An endless generator

Write a generator function `fibonacci()` that yields `1, 1, 2, 3, 5, ...` forever. Use `itertools.islice()` to print the first 10 numbers and the numbers at indexes `20` to `24`. Then find the index of the first Fibonacci number with at least 100 digits and print its first ten digits.

### Exercise 3: No recursion at all

Rewrite the `Fibonacci` sequence class so that it never recurses: keep a class-level list `_values = [1, 1]` that grows on demand when a larger index is requested. Support negative indexes and slices. Show that `Fibonacci(5000)[-1]` works (print its number of digits), print the first ten items, and show that the list is shared by all instances.

### Exercise 4: A real Sequence

Using the improved `fibonacci.py`, create `FibonacciSequence(Fibonacci, Sequence)` that also inherits from `collections.abc.Sequence`. Show that the original class is not recognized as a `Sequence` but the new one is, and use the inherited `index()`, `count()` and `reversed()`. Finally, override `__contains__()` so that `value in seq` stops as soon as the numbers become larger than `value`, and check it on `FibonacciSequence(10**6)`.

## Solutions

### Exercise 1

```python
calls = 0


def fib(n):
    global calls
    calls += 1
    if n < 2:
        return 1
    return fib(n - 2) + fib(n - 1)


results = []
for n in range(21):
    calls = 0
    value = fib(n)
    results.append(calls == 2 * value - 1)

print(all(results))
calls = 0
print(fib(20), calls)
```

Output:

```text
True
10946 21891
```

Let `c(n)` be the number of calls. For `n < 2` there is one call, and `2 * 1 - 1 = 1`. For larger `n`, one call spawns the calls of `fib(n - 2)` and `fib(n - 1)`: `c(n) = 1 + c(n - 2) + c(n - 1)`. If the formula holds for the smaller values, then `c(n) = 1 + (2 * fib(n - 2) - 1) + (2 * fib(n - 1) - 1) = 2 * fib(n) - 1`. So the number of calls grows exactly as fast as the Fibonacci numbers themselves.

### Exercise 2

```python
from itertools import islice


def fibonacci():
    a, b = 1, 1
    while True:
        yield a
        a, b = b, a + b


print(list(islice(fibonacci(), 10)))
print(list(islice(fibonacci(), 20, 25)))

for index, value in enumerate(fibonacci()):
    if len(str(value)) >= 100:
        print(index, str(value)[:10] + "...")
        break
```

Output:

```text
[1, 1, 2, 3, 5, 8, 13, 21, 34, 55]
[10946, 17711, 28657, 46368, 75025]
475 1344719667...
```

A generator produces values only when asked, so an infinite sequence costs nothing until you consume it. `islice()` takes a finite part of it, since an endless generator cannot be sliced with `[]`. The `for` loop with `break` stops at the first match. In the `0, 1, 1, 2, ...` convention the same number has index `476`.

### Exercise 3

```python
import operator


class Fibonacci:
    _values = [1, 1]            # shared by all instances, grows on demand

    def __init__(self, n):
        self.n = n

    def __len__(self):
        return self.n

    def __getitem__(self, index):
        if isinstance(index, slice):
            return [self._value(k) for k in range(*index.indices(self.n))]
        index = operator.index(index)
        if index < 0:
            index += self.n
        if not 0 <= index < self.n:
            raise IndexError("Fibonacci index out of range")
        return self._value(index)

    @classmethod
    def _value(cls, k):
        values = cls._values
        while len(values) <= k:
            values.append(values[-1] + values[-2])
        return values[k]


big = Fibonacci(5000)
print(len(str(big[-1])))
print(big[:10])
print(Fibonacci(20)[-1], len(Fibonacci._values))
```

Output:

```text
1045
[1, 1, 2, 3, 5, 8, 13, 21, 34, 55]
6765 5000
```

`_value()` extends the list with a loop until it contains index `k`, so there is no recursion and each number is computed once. The list is a class attribute: after `big[-1]` it already holds 5000 values, and `Fibonacci(20)[-1]` simply reads one of them. Note that the list keeps growing to the largest index ever requested, which costs memory.

### Exercise 4

```python
from collections.abc import Sequence

from fibonacci import Fibonacci


class FibonacciSequence(Fibonacci, Sequence):
    def __contains__(self, value):
        a, b = 1, 1
        for _ in range(self.n):
            if a >= value:            # the values never decrease
                return a == value
            a, b = b, a + b
        return False


print(isinstance(Fibonacci(10), Sequence))

seq = FibonacciSequence(10)
print(isinstance(seq, Sequence))
print(seq.index(21), seq.count(1))
print(list(reversed(seq))[:3])
print(21 in seq, 4 in seq)

huge = FibonacciSequence(10**6)
print(4 in huge, 10**20 in huge, 12200160415121876738 in huge)
```

Output:

```text
False
True
7 2
[55, 34, 21]
True False
False False True
```

`collections.abc.Sequence` does not recognize classes automatically just because they have `__len__()` and `__getitem__()`, so the original class is not a `Sequence`. Inheriting from it adds the mixin methods `index()`, `count()`, `__iter__()`, `__reversed__()` and `__contains__()`, all built on `__getitem__()` and `__len__()`. The inherited `__contains__()` would scan item by item through `__getitem__()`, up to a million items. The override uses the fact that the sequence never decreases: it generates the numbers with a loop and stops at the first one that is not smaller than `value`, after fewer than 100 steps for these values.

---

*Source: [pythontutorial.net — Python Fibonacci Sequence](https://www.pythontutorial.net/advanced-python/python-fibonacci-sequence/). Adapted and expanded for PyJourney.*
