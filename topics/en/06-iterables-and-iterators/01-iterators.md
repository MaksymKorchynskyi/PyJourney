# Iterators

An **iterator** is an object that hands out values one at a time, on request, and remembers how far it has got. Every `for` loop, every comprehension and functions such as `sum()`, `zip()` and `list()` rely on iterators, so understanding them explains how iteration in Python really works.

## What you'll learn

- What the **iterator protocol** is: the `__iter__()` and `__next__()` methods
- How the built-in `next()` function and the `StopIteration` exception work together
- What a `for` loop does behind the scenes
- How to write your own iterator class
- Why an iterator is **exhausted** after one pass and cannot be restarted
- Where iterators appear in the standard library and how to handle infinite ones

## What is an iterator?

An iterator is any object that implements two special methods. Together they are called the **iterator protocol**:

| Method | What it must do |
|---|---|
| `__iter__()` | Return the iterator itself (`return self`). |
| `__next__()` | Return the next item. When there are no items left, raise `StopIteration`. |

You rarely call these methods directly. The built-in function `iter(obj)` calls `obj.__iter__()`, and `next(it)` calls `it.__next__()`.

A list is not an iterator, but you can ask it for one:

```python
colors = ["red", "green", "blue"]

it = iter(colors)
print(next(it))
print(next(it))
print(next(it))

try:
    next(it)
except StopIteration:
    print("StopIteration: no items left")
```

Output:

```text
red
green
blue
StopIteration: no items left
```

The iterator keeps its own position. Each `next()` call moves it one step forward, and there is no way to step back.

Why design iteration this way?

- **One interface for everything.** Lists, strings, dictionaries, files, database cursors and your own classes can all be used in a `for` loop, because the loop only needs `iter()` and `next()`.
- **Laziness.** An iterator produces a value only when it is asked for one. It does not need to keep all values in memory, and it can even represent an endless stream.
- **A clear end signal.** `StopIteration` is not an error in the usual sense. It is how an iterator says "I'm done", and loops treat it as a normal end.

### `next()` with a default value

`next()` accepts an optional second argument. If the iterator is exhausted, `next()` returns that default instead of raising `StopIteration`:

```python
it = iter([1])
print(next(it, "empty"))
print(next(it, "empty"))
```

Output:

```text
1
empty
```

This is handy when you need "the first item, if there is one" without writing `try`/`except`.

## What a `for` loop really does

This loop:

```python
for number in [10, 20, 30]:
    print(number)
```

is roughly equivalent to the following code:

```python
numbers = [10, 20, 30]

iterator = iter(numbers)            # 1. get an iterator
while True:
    try:
        number = next(iterator)     # 2. ask for the next item
    except StopIteration:           # 3. the iterator is exhausted
        break                       #    so the loop ends quietly
    print(number)                   # 4. run the loop body
```

Both versions print:

```text
10
20
30
```

The `for` loop catches `StopIteration` for you. That is why you never see this exception when looping over a list.

## Writing a custom iterator

A **square number** is an integer multiplied by itself: the square of 3 is 9. The following `Square` class is an iterator that produces the squares of 1, 2, …, `length`:

```python
class Square:
    def __init__(self, length):
        self.length = length    # how many squares to produce
        self.current = 0        # the last integer used

    def __iter__(self):
        return self

    def __next__(self):
        if self.current >= self.length:
            raise StopIteration

        self.current += 1
        return self.current ** 2
```

How it works:

- `__init__()` stores the **state** of the iteration. `length` says how many values to produce, and `current` remembers the last integer that was squared.
- `__iter__()` returns `self`, so the object can be used wherever an iterator is expected, including a `for` loop.
- `__next__()` first checks whether all `length` values have already been produced. If so, it raises `StopIteration`. Otherwise it advances `current` and returns its square.

Use it in a `for` loop:

```python
square = Square(5)

for sq in square:
    print(sq)
```

Output:

```text
1
4
9
16
25
```

Or drive it by hand with `next()`:

```python
square = Square(2)
print(next(square))
print(next(square))
print(next(square, "no more squares"))
```

Output:

```text
1
4
no more squares
```

Because `Square` follows the protocol, every tool that consumes iterators works with it:

```python
print(sum(Square(4)))
print(max(Square(4)))
print(list(zip("abc", Square(3))))

first, second, third = Square(3)
print(first, second, third)
```

Output:

```text
30
16
[('a', 1), ('b', 4), ('c', 9)]
1 4 9
```

## Exhausted iterators cannot be restarted

When an iterator has returned all its items, it is **exhausted**. From then on:

- every `next()` call raises `StopIteration` again;
- a `for` loop over it runs **zero times**, silently;
- functions like `list()` or `sum()` see an empty sequence.

Using the `Square` class from above:

```python
square = Square(3)

print(list(square))
print(list(square))

for sq in square:
    print("this line never runs")

try:
    next(square)
except StopIteration:
    print("square is exhausted")
```

Output:

```text
[1, 4, 9]
[]
square is exhausted
```

The iterator protocol has no "rewind" or "reset" method. An iterator only knows how to move forward. To go through the values again, create a **new** iterator: `Square(3)` again, or `iter(colors)` again.

> **Note:** A list can be looped over many times because each `for` loop calls `iter()` on the list and gets a fresh iterator. How to give your own classes this behaviour is the subject of the next topic, *Iterator vs Iterable*.

## Iterators in the standard library

Many built-ins return iterators rather than lists. They compute their results lazily and can be consumed only once:

| Built-in | Produces |
|---|---|
| `map(func, iterable)` | `func(item)` for each item |
| `filter(func, iterable)` | the items for which `func(item)` is truthy |
| `zip(a, b, ...)` | tuples of items taken in parallel |
| `enumerate(iterable)` | `(index, item)` pairs |
| `reversed(sequence)` | the items in reverse order |
| `open(path)` | the lines of a file |

```python
doubled = map(lambda n: n * 2, [1, 2, 3])

print(type(doubled))
print(iter(doubled) is doubled)   # an iterator returns itself
print(next(doubled))
print(list(doubled))
print(list(doubled))
```

Output:

```text
<class 'map'>
True
2
[4, 6]
[]
```

The first `next()` took `2`, `list()` collected what was left, and the second `list()` got nothing.

> **Note:** In Python 3, `reduce()` is not a built-in. It lives in the `functools` module: `from functools import reduce`. It accepts any iterable, including an iterator.

## Infinite iterators

Nothing forces an iterator to end. An iterator that never raises `StopIteration` represents an endless stream, and that is perfectly fine as long as you only take as many items as you need. The `itertools` module has several ready-made ones, for example `count()`:

```python
from itertools import count, islice

evens = count(start=0, step=2)    # 0, 2, 4, 6, ... forever

print(list(islice(evens, 5)))     # take only the first five
print(next(evens))                # the iterator remembers its position
```

Output:

```text
[0, 2, 4, 6, 8]
10
```

`islice(iterator, n)` stops after `n` items, so it is safe to use with infinite iterators.

> **Tip:** Never call `list()`, `sum()`, `sorted()` or `max()` on an infinite iterator. They try to read *all* items, so the program hangs (and `list()` keeps eating memory until it runs out).

## Is it an iterator?

The `collections.abc.Iterator` abstract class lets you check whether an object follows the protocol. It recognises any class that defines both `__iter__()` and `__next__()`, even if the class does not inherit from it (`Square` is the class defined earlier):

```python
from collections.abc import Iterator

print(isinstance([1, 2, 3], Iterator))
print(isinstance(iter([1, 2, 3]), Iterator))
print(isinstance(Square(3), Iterator))
```

Output:

```text
False
True
True
```

A list is not an iterator: it has no `__next__()`. Calling `next()` on it fails with `TypeError: 'list' object is not an iterator`.

## Common mistakes

- **Reusing an exhausted iterator.** The second pass does not raise an error, it just sees nothing, which makes the bug easy to miss:

  ```python
  prices = map(int, ["120", "75", "300"])

  print(sum(prices))
  try:
      print(max(prices))
  except ValueError as error:
      print("ValueError:", error)
  ```

  Output:

  ```text
  495
  ValueError: max() iterable argument is empty
  ```

  If you need the values more than once, store them in a list first: `prices = list(map(...))`.

- **Forgetting `__iter__()`.** A class with only `__next__()` is not an iterator, and a `for` loop rejects it with `TypeError: '...' object is not iterable`. Always add `def __iter__(self): return self`.

- **Returning `None` instead of raising `StopIteration`.** If `__next__()` simply falls off the end, it returns `None` forever and the loop never stops. Signal the end with `raise StopIteration`.

- **Expecting sequence features from an iterator.** Iterators have no length and no indexes: `len(map(...))` raises `TypeError: object of type 'map' has no len()`, and `it[0]` fails too. Convert to a list if you need them.

- **Changing a list while iterating over it.** A list iterator walks by index, so removing items shifts the rest and some are skipped:

  ```python
  numbers = [1, 2, 2, 3]
  for n in numbers:
      if n == 2:
          numbers.remove(n)
  print(numbers)

  numbers = [1, 2, 2, 3]
  numbers = [n for n in numbers if n != 2]
  print(numbers)
  ```

  Output:

  ```text
  [1, 2, 3]
  [1, 3]
  ```

  Build a new list (or loop over a copy, `numbers[:]`) instead.

## Summary

- An iterator implements the **iterator protocol**: `__iter__()` returns `self`, and `__next__()` returns the next item or raises `StopIteration`.
- `iter(obj)` gets an iterator from an object, and `next(it)` advances it. `next(it, default)` returns `default` instead of raising at the end.
- A `for` loop calls `iter()` once, then `next()` repeatedly, and stops quietly on `StopIteration`.
- Iterators are lazy: they produce values on demand and can even be infinite.
- An iterator can be consumed only once. When it is exhausted, it stays exhausted. Create a new one to iterate again.
- `map()`, `filter()`, `zip()`, `enumerate()`, `reversed()` and file objects all return iterators.

## Practice

### Exercise 1: Predict the output

Without running the code, write down what it prints. Then check your answer.

```python
it = iter([1, 2, 3, 4, 5])
print(next(it))

for x in it:
    if x == 3:
        break

print(list(it))
print(next(it, "done"))
```

### Exercise 2: A `for` loop without `for`

Write a function `for_each(iterable, action)` that calls `action(item)` for every item of `iterable`. Do not use a `for` statement or a comprehension: use `iter()`, `next()` and `StopIteration`. Test it with `for_each("abc", print)` and with `for_each(Square(3), print)`.

### Exercise 3: Countdown

Write an iterator class `Countdown` so that `Countdown(3)` produces `3`, `2`, `1` and then stops. Show that `list(Countdown(3))` returns `[3, 2, 1]`, and that converting the same `Countdown` object to a list a second time gives `[]`.

### Exercise 4: An endless cycle

Write an iterator class `Cycle` that repeats the items of a list forever: `Cycle(["red", "green"])` produces `red, green, red, green, ...`. If the list is empty, the iterator should stop immediately. Use `itertools.islice` to print the first 5 items, and show that `list(Cycle([]))` returns `[]`.

## Solutions

### Exercise 1

Output:

```text
1
[4, 5]
done
```

`next(it)` takes `1`. The `for` loop continues **the same iterator** from `2`: it takes `2`, then `3`, and breaks. The iterator is now positioned before `4`, so `list(it)` collects `[4, 5]`. After that the iterator is exhausted and `next(it, "done")` returns the default.

### Exercise 2

```python
class Square:
    def __init__(self, length):
        self.length = length
        self.current = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self.current >= self.length:
            raise StopIteration
        self.current += 1
        return self.current ** 2


def for_each(iterable, action):
    iterator = iter(iterable)
    while True:
        try:
            item = next(iterator)
        except StopIteration:
            return
        action(item)


for_each("abc", print)
for_each(Square(3), print)
```

Output:

```text
a
b
c
1
4
9
```

Keep the `try` block small. Only `next()` belongs inside it. If `action(item)` were inside the `try` and raised its own `StopIteration`, the function would end silently and hide the bug.

### Exercise 3

```python
class Countdown:
    def __init__(self, start):
        self.current = start

    def __iter__(self):
        return self

    def __next__(self):
        if self.current <= 0:
            raise StopIteration
        value = self.current
        self.current -= 1
        return value


countdown = Countdown(3)
print(list(countdown))
print(list(countdown))
```

Output:

```text
[3, 2, 1]
[]
```

### Exercise 4

```python
from itertools import islice


class Cycle:
    def __init__(self, items):
        self.items = list(items)
        self.index = 0

    def __iter__(self):
        return self

    def __next__(self):
        if not self.items:
            raise StopIteration
        item = self.items[self.index]
        self.index = (self.index + 1) % len(self.items)
        return item


print(list(islice(Cycle(["red", "green"]), 5)))
print(list(Cycle([])))
```

Output:

```text
['red', 'green', 'red', 'green', 'red']
[]
```

The `% len(self.items)` wraps the index back to `0` after the last item. `list(items)` makes a private copy, so later changes to the caller's list do not affect the cycle. The standard library offers the same behaviour as `itertools.cycle()`.

---

*Source: [pythontutorial.net — Python Iterators](https://www.pythontutorial.net/advanced-python/python-iterators/). Adapted and expanded for PyJourney.*
