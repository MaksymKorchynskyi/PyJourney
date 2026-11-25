# iter() Function

The built-in `iter()` function is the entry point to iteration: every `for` loop starts by calling it. It has two forms. `iter(obj)` gets an iterator from an object, and `iter(callable, sentinel)` turns a plain function into an iterator that stops at a chosen value. Knowing both explains why some objects are iterable without an `__iter__()` method and gives you a neat tool for reading data in chunks.

## What you'll learn

- How `iter(obj)` chooses between `__iter__()` and the older `__getitem__()` sequence protocol
- How the sequence protocol walks an object by indexes `0, 1, 2, …`
- What happens when a class has both methods
- How `iter(callable, sentinel)` works and where it is useful
- How to test reliably whether an object is iterable

## The first form: `iter(obj)`

```text
iter(obj)
```

`iter()` returns an iterator for `obj`. The argument can be an iterable that implements `__iter__()`, or a *sequence* that implements `__getitem__()`. Python decides like this:

```text
iter(obj)
  |
  +-- does the type of obj define __iter__()?
  |      yes -> call it. The result must be an iterator,
  |             otherwise: TypeError: iter() returned non-iterator ...
  |
  +-- no: does it define __getitem__()?
  |      yes -> return a sequence iterator that calls
  |             obj[0], obj[1], obj[2], ... until IndexError
  |
  +-- no: TypeError: '...' object is not iterable
```

A `for` loop, `list()`, `tuple()`, unpacking and many other tools go through exactly the same steps, because they all call `iter()` internally.

### No protocol at all: `TypeError`

A class with neither method is not iterable:

```python
class Counter:
    def __init__(self):
        self.current = 0


counter = Counter()

try:
    iterator = iter(counter)
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
TypeError: 'Counter' object is not iterable
```

## The sequence protocol: `__getitem__()`

Before Python had the iterator protocol, a `for` loop worked by indexing: it called `obj[0]`, `obj[1]`, `obj[2]`, … until the object raised `IndexError`. `iter()` still supports this for backward compatibility. If a class has no `__iter__()` but has `__getitem__()`, `iter()` creates a generic iterator that does this indexing for you.

The following class shows which indexes Python asks for:

```python
class Probe:
    def __getitem__(self, index):
        print("asked for index", index)
        if index >= 3:
            raise IndexError(index)
        return index * 10


print(list(Probe()))
```

Output:

```text
asked for index 0
asked for index 1
asked for index 2
asked for index 3
[0, 10, 20]
```

`IndexError` is the end signal here, playing the role that `StopIteration` plays in the iterator protocol. The simplest way to get it right is to delegate to a list, which raises `IndexError` past its end:

```python
class Weekdays:
    def __init__(self):
        self._names = ["Mon", "Tue", "Wed", "Thu", "Fri"]

    def __getitem__(self, index):
        return self._names[index]


week = Weekdays()
print(type(iter(week)))

for day in week:
    if day.startswith("T"):
        print(day)

print(list(week))
print(*week)
print("Wed" in week)
```

Output:

```text
<class 'iterator'>
Tue
Thu
['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
Mon Tue Wed Thu Fri
True
```

The generic iterator's type is simply called `iterator`. Unpacking with `*` works, and even the `in` operator works: without `__contains__()`, Python falls back to iterating and comparing each item.

### A `__getitem__()` that never ends

The `__getitem__()` method should respect the index it receives. This version ignores it and just counts calls:

```python
class Counter:
    def __init__(self):
        self.current = 0

    def __getitem__(self, index):
        if isinstance(index, int):
            self.current += 1
            return self.current


counter = Counter()
iterator = iter(counter)
print(type(iterator))

for _ in range(3):
    print(next(iterator))
```

Output:

```text
<class 'iterator'>
1
2
3
```

Taking three values with `next()` works, but this "sequence" never raises `IndexError`, so `for n in counter:` or `list(counter)` would run forever. Also note that `counter[100]` returns `4` and `counter["a"]` returns `None`. A real sequence should return the item **at** the given index and raise `IndexError` (for a bad position) or `TypeError` (for a bad index type).

> **Note:** For new classes, prefer `__iter__()`. The `__getitem__()` fallback is mainly useful for classes that really are sequences, where indexing is the natural operation anyway.

## When both methods exist, `__iter__()` wins

If a class defines both methods, `iter()` uses `__iter__()` and never touches `__getitem__()` for iteration. Indexing with `[]` still calls `__getitem__()`:

```python
class Letters:
    def __init__(self, text):
        self.text = text

    def __getitem__(self, index):
        print(f"__getitem__({index}) called")
        return self.text[index]

    def __iter__(self):
        print("__iter__() called")
        return iter(self.text)


letters = Letters("abc")
print(list(letters))
print(letters[1])
```

Output:

```text
__iter__() called
['a', 'b', 'c']
__getitem__(1) called
b
```

The same rule applies when `__iter__()` returns a custom iterator class, for example a nested one:

```python
class Counter:
    def __init__(self):
        self.current = 0

    def __getitem__(self, index):
        if isinstance(index, int):
            self.current += 1
            return self.current

    def __iter__(self):
        return self.CounterIterator(self)

    class CounterIterator:
        def __init__(self, counter):
            self._counter = counter

        def __iter__(self):
            return self

        def __next__(self):
            self._counter.current += 1
            return self._counter.current


counter = Counter()
iterator = iter(counter)
print(type(iterator))

for _ in range(3):
    print(next(iterator))
```

Output:

```text
<class '__main__.Counter.CounterIterator'>
1
2
3
```

The type is `Counter.CounterIterator`, not the generic `iterator`, which proves that `iter()` called `__iter__()`.

> **Tip:** To make a class explicitly **non-iterable** even though it has `__getitem__()` (for example, a mapping-like class indexed by strings), set `__iter__ = None` in the class body. Then `iter()` raises `TypeError` instead of trying indexes `0, 1, 2, …`.

## The second form: `iter(callable, sentinel)`

```text
iter(callable, sentinel)
```

With two arguments, `iter()` builds a **callable iterator**:

- every `next()` call calls `callable()` **with no arguments**;
- if the result equals `sentinel` (compared with `==`), the iterator raises `StopIteration` and the sentinel itself is **not** returned;
- otherwise the result is returned.

A *sentinel* is a special value that marks the end of the data, like an empty string at the end of a file.

To see how it works, start with a function that returns a closure. Each call of the closure returns the next integer:

```python
def counter():
    count = 0

    def increase():
        nonlocal count
        count += 1
        return count

    return increase


cnt = counter()

while True:
    current = cnt()
    print(current)
    if current == 3:
        break
```

Output:

```text
1
2
3
```

The loop logic (call, compare, stop) can be packed into a reusable iterator class:

```python
class CallUntil:
    def __init__(self, fn, sentinel):
        self.fn = fn
        self.sentinel = sentinel

    def __iter__(self):
        return self

    def __next__(self):
        current = self.fn()
        if current == self.sentinel:
            raise StopIteration

        return current


cnt = counter()
for count in CallUntil(cnt, 4):
    print(count)
```

Output:

```text
1
2
3
```

`CallUntil` calls `fn()` on each `next()` and stops when the result equals the sentinel. This is exactly what the two-argument form of `iter()` already does, so you do not need to write the class at all:

```python
cnt = counter()
iterator = iter(cnt, 4)
print(type(iterator))

for count in iterator:
    print(count)
```

Output:

```text
<class 'callable_iterator'>
1
2
3
```

The value `4` was produced by `cnt()`, matched the sentinel, and ended the loop without being printed.

### Practical uses

**Reading a file in fixed-size chunks.** `read(size)` returns an empty string at the end of the file, which makes `""` a natural sentinel. The callable must take no arguments, so wrap `read(4)` in `functools.partial` (or a `lambda`). `io.StringIO` is used here as an in-memory file, so the example runs without creating files:

```python
import io
from functools import partial

stream = io.StringIO("abcdefghij")

for chunk in iter(partial(stream.read, 4), ""):
    print(chunk)
```

Output:

```text
abcd
efgh
ij
```

With a real file the pattern is the same: `with open(path, "rb") as f: for block in iter(partial(f.read, 65536), b""): ...`. For binary files the sentinel must be `b""`.

**Consuming a queue until a stop marker.** This is a common pattern in worker threads, where `None` tells the worker to stop:

```python
from queue import Queue

jobs = Queue()
for job in ["resize", "compress", "upload", None]:
    jobs.put(job)

for job in iter(jobs.get, None):
    print("processing", job)
print("worker stopped")
```

Output:

```text
processing resize
processing compress
processing upload
worker stopped
```

Once the sentinel has been seen, the callable iterator is exhausted for good: further `next()` calls raise `StopIteration` without calling the function again.

## Testing whether an object is iterable

You could check for `__iter__()` and `__getitem__()` yourself, but the simplest and most reliable test is to ask `iter()` and see whether it complains:

```python
def is_iterable(obj):
    try:
        iter(obj)
    except TypeError:
        return False
    else:
        return True


print(is_iterable([1, 2, 3]))
print(is_iterable("Python iter"))
print(is_iterable(100))
```

Output:

```text
True
True
False
```

`iter()` raises `TypeError` when an object supports neither protocol. Unlike `isinstance(obj, collections.abc.Iterable)`, this test also recognises classes that are iterable only through `__getitem__()`, such as the `Weekdays` class from above:

```python
from collections.abc import Iterable

print(is_iterable(Weekdays()))
print(isinstance(Weekdays(), Iterable))
```

Output:

```text
True
False
```

Calling `iter()` on an iterable does not consume anything. It only creates an iterator, which is then thrown away. One caveat: if a class's `__iter__()` itself raises `TypeError` because of a bug, `is_iterable()` reports `False` for it.

> **Tip:** In everyday code you rarely need `is_iterable()`. The usual Python style is to simply loop over the argument and let a `TypeError` surface if the caller passed something wrong. The check is useful when a function must accept "a single value or a collection of values".

## Common mistakes

- **Passing a callable that needs arguments.** In `iter(callable, sentinel)` the callable is called with **no** arguments. `iter(stream.read, "")` is legal, but `read()` without a size reads everything at once, so you get one huge chunk. Use `partial(stream.read, 4)` or `lambda: stream.read(4)`.

- **Using a sentinel of the wrong type.** A binary stream returns `b""` at the end, which is not equal to `""`. The loop never stops:

  ```python
  import io
  from functools import partial
  from itertools import islice

  data = io.BytesIO(b"abcdef")
  chunks = iter(partial(data.read, 4), "")   # wrong: should be b""
  print(list(islice(chunks, 5)))             # islice protects us from an endless loop
  ```

  Output:

  ```text
  [b'abcd', b'ef', b'', b'', b'']
  ```

- **Passing a non-callable as the first of two arguments.** `iter([1, 2], 3)` raises `TypeError: iter(v, w): v must be callable`. The two-argument form is not "iterate over this list until 3".

- **Writing a `__getitem__()` that never raises `IndexError`.** The sequence fallback relies on `IndexError` to stop. Without it, `for` loops and `list()` never end.

- **Testing iterability with `hasattr(obj, "__iter__")` or `isinstance(obj, Iterable)` only.** Both miss `__getitem__()`-only sequences. Use `iter()` inside `try`/`except TypeError`.

- **Shadowing built-ins.** Naming a parameter `object`, `iter`, `list` or `str` hides the built-in for the rest of the function. Use names like `obj` or `items`.

## Summary

- `iter(obj)` returns an iterator for `obj`. It calls `__iter__()` if it exists, otherwise falls back to `__getitem__()`, otherwise raises `TypeError`.
- The `__getitem__()` fallback calls `obj[0]`, `obj[1]`, … and stops at `IndexError`. Its iterator's type is the generic `iterator`.
- If both methods exist, `__iter__()` is always used for iteration.
- `iter()` checks that `__iter__()` returns a real iterator.
- `iter(callable, sentinel)` calls `callable()` on each step and stops (without returning it) when the result equals `sentinel`. It is ideal for chunked reads and queues.
- `try: iter(obj) except TypeError` is the most reliable way to test whether an object is iterable.

## Practice

### Exercise 1: Which objects are iterable?

Predict which of these objects `is_iterable()` accepts, then check: `42`, `"42"`, `[4, 2]`, `{4: 2}`, `None`, `3.5`, `range(0)`, and an instance of the `Weekdays` class from above.

### Exercise 2: Chunked reading

Using `io.StringIO("The quick brown fox")` and the two-argument form of `iter()`, collect the text into a list of chunks of 5 characters. Then do the same for `io.BytesIO(b"The quick brown fox")`.

### Exercise 3: A sequence without `__iter__()`

Write a class `Squares` whose instances behave like the read-only sequence of squares `0, 1, 4, …, (n-1)**2`. Implement only `__len__()` and `__getitem__()` (raise `IndexError` for indexes outside `0 … n-1`). Show that `for`, `list()`, the `in` operator and `reversed()` all work, and that `isinstance(Squares(3), Iterable)` is still `False`.

### Exercise 4: Flatten

Write `flatten(items)` that returns a flat list from arbitrarily nested iterables, for example `flatten([1, [2, (3, 4)], "ab", [[5]], {6}])` returns `[1, 2, 3, 4, 'ab', 5, 6]`. Use `is_iterable()`, but treat strings as single values (otherwise each one-letter string would be iterable forever).

## Solutions

### Exercise 1

```python
class Weekdays:
    def __init__(self):
        self._names = ["Mon", "Tue", "Wed", "Thu", "Fri"]

    def __getitem__(self, index):
        return self._names[index]

    def __repr__(self):
        return "Weekdays()"


def is_iterable(obj):
    try:
        iter(obj)
    except TypeError:
        return False
    return True


for value in [42, "42", [4, 2], {4: 2}, None, 3.5, range(0), Weekdays()]:
    print(f"{value!r:12} {is_iterable(value)}")
```

Output:

```text
42           False
'42'         True
[4, 2]       True
{4: 2}       True
None         False
3.5          False
range(0, 0)  True
Weekdays()   True
```

`range(0)` is empty, but empty is not the same as non-iterable. A dictionary iterates over its keys.

### Exercise 2

```python
import io
from functools import partial

text = io.StringIO("The quick brown fox")
print(list(iter(partial(text.read, 5), "")))

data = io.BytesIO(b"The quick brown fox")
print(list(iter(partial(data.read, 5), b"")))
```

Output:

```text
['The q', 'uick ', 'brown', ' fox']
[b'The q', b'uick ', b'brown', b' fox']
```

The sentinel must match the type that `read()` returns at the end: `""` for text, `b""` for bytes.

### Exercise 3

```python
from collections.abc import Iterable


class Squares:
    def __init__(self, n):
        self.n = n

    def __len__(self):
        return self.n

    def __getitem__(self, index):
        if not 0 <= index < self.n:
            raise IndexError("Squares index out of range")
        return index ** 2


squares = Squares(5)

total = 0
for value in squares:
    total += value
print(total)

print(list(squares))
print(9 in squares, 10 in squares)
print(list(reversed(squares)))
print(isinstance(squares, Iterable))
```

Output:

```text
30
[0, 1, 4, 9, 16]
True False
[16, 9, 4, 1, 0]
False
```

`reversed()` uses `__len__()` to find the last index and then calls `__getitem__()` with `n-1, n-2, …, 0`. Because this class does not support negative indexes, `squares[-1]` raises `IndexError`. Supporting them (and slices) is left out to keep the example focused.

### Exercise 4

```python
def is_iterable(obj):
    try:
        iter(obj)
    except TypeError:
        return False
    return True


def flatten(items):
    result = []
    for item in items:
        if is_iterable(item) and not isinstance(item, (str, bytes)):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result


print(flatten([1, [2, (3, 4)], "ab", [[5]], {6}]))
print(flatten([]))
print(flatten(["x", ["y", ["z"]]]))
```

Output:

```text
[1, 2, 3, 4, 'ab', 5, 6]
[]
['x', 'y', 'z']
```

Without the `str` check, `"ab"` would be split into `"a"` and `"b"`, and then each one-character string would be iterated again, producing itself, until Python raised `RecursionError`.

---

*Source: [pythontutorial.net — Python iter()](https://www.pythontutorial.net/advanced-python/python-iter/). Adapted and expanded for PyJourney.*
