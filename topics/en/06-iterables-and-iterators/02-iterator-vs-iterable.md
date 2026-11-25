# Iterator vs Iterable

An **iterable** is something you can loop over, such as a list, a string or a file. An **iterator** is the object that does the actual walking and remembers the current position. The two words sound alike, but mixing up the roles leads to classes that can be looped over only once and to functions that silently return empty results.

## What you'll learn

- The precise difference between an iterable and an iterator
- How a list and its `list_iterator` share the work
- Why an object that is its own iterator can be traversed only once
- How to split a class into an iterable and a separate iterator class
- A shorter way to write `__iter__()`, and how to check both roles with `collections.abc`
- Why the difference matters when a function needs to go over its data twice

## Two roles

**Iterator.** An object that implements the iterator protocol:

- `__next__()` returns the next item, or raises `StopIteration` when there are no more items;
- `__iter__()` returns the iterator itself.

An iterator holds the **state** of one traversal. After it has returned everything, it is exhausted and stays useless.

**Iterable.** An object you can pass to `iter()` or loop over with `for`. In the usual case it implements `__iter__()`, and that method returns a **new** iterator every time it is called. (Python also accepts older-style objects that only implement `__getitem__()` with integer indexes. That fallback is covered in the next topic, *iter() Function*.)

A helpful picture: an iterable is a **book**, and an iterator is a **bookmark**. You can put several bookmarks into the same book, each at a different page, and removing a bookmark does nothing to the book.

| | Iterable | Iterator |
|---|---|---|
| Required methods | `__iter__()` (or `__getitem__()`) | `__iter__()` **and** `__next__()` |
| `__iter__()` returns | a new iterator | `self` |
| Can be traversed | many times | once |
| Keeps a position | no | yes |
| Examples | `list`, `str`, `dict`, `range` | `iter([1, 2])`, `map(...)`, `enumerate(...)`, files |

Because an iterator's `__iter__()` returns `self`, **every iterator is also an iterable**. You can put an iterator in a `for` loop. The opposite is not true: a list is iterable but is not an iterator.

## A list and its iterator

A list is iterable: its `__iter__()` method creates a `list_iterator`.

```python
numbers = [1, 2, 3]

number_iterator = numbers.__iter__()
print(type(number_iterator))
```

Output:

```text
<class 'list_iterator'>
```

In normal code you call the built-in `iter()` instead of the dunder method. Then you advance the iterator with `next()`:

```python
numbers = [1, 2, 3]
number_iterator = iter(numbers)

print(next(number_iterator))
print(next(number_iterator))
print(next(number_iterator))

try:
    next(number_iterator)
except StopIteration:
    print("StopIteration: the iterator is exhausted")

print(numbers)  # the list itself is untouched
```

Output:

```text
1
2
3
StopIteration: the iterator is exhausted
[1, 2, 3]
```

The **list** is created once. An **iterator** is created each time you need to traverse the list, and each iterator keeps its own position:

```python
numbers = [1, 2, 3]

first = iter(numbers)
second = iter(numbers)

print(next(first), next(first))
print(next(second))
print(first is second)
print(iter(first) is first)  # an iterator returns itself
```

Output:

```text
1 2
1
False
True
```

This separation is what makes nested loops over the same list work. The outer and the inner loop each get an independent iterator:

```python
letters = ["a", "b"]

for x in letters:
    for y in letters:
        print(x + y)
```

Output:

```text
aa
ab
ba
bb
```

## When one object plays both roles

The following `Colors` class is an iterator: its `__iter__()` returns `self`, and `__next__()` returns the next color. Since it has `__iter__()`, it is also an iterable.

```python
class Colors:
    def __init__(self):
        self.rgb = ["red", "green", "blue"]
        self._index = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self._index >= len(self.rgb):
            raise StopIteration

        # return the next color
        color = self.rgb[self._index]
        self._index += 1
        return color


colors = Colors()

for color in colors:
    print(color)
```

Output:

```text
red
green
blue
```

It works once. The data (`rgb`) and the position (`_index`) live in the same object, so after the first loop the position is at the end and nothing resets it:

```python
for color in colors:
    print("second loop:", color)   # never runs

try:
    next(colors)
except StopIteration:
    print("colors is exhausted")
```

Output:

```text
colors is exhausted
```

Nested loops are even more surprising. Both loops share one position, so the inner loop eats the items the outer loop was supposed to get:

```python
colors = Colors()

for a in colors:
    for b in colors:
        print(a, b)
```

Output:

```text
red green
red blue
```

To loop again, you would have to create a whole new `Colors` object, including its data. For a large collection that is wasteful, and for data that comes from a file or a network it may be impossible.

## Separating the iterable from the iterator

The fix is to do what `list` does: keep the **data** in one class and the **position** in another.

First, the collection. It only stores data:

```python
class Colors:
    def __init__(self):
        self.rgb = ["red", "green", "blue"]

    def __len__(self):
        return len(self.rgb)
```

Second, the iterator. It stores a reference to the collection and its own index:

```python
class ColorIterator:
    def __init__(self, colors):
        self._colors = colors
        self._index = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self._index >= len(self._colors):
            raise StopIteration

        # return the next color
        color = self._colors.rgb[self._index]
        self._index += 1
        return color
```

How it works:

- `__init__()` receives the `Colors` object to walk over and starts at index `0`.
- `__iter__()` returns the iterator itself, as the protocol requires.
- `__next__()` returns the next color from the `Colors` object, or raises `StopIteration` at the end.

You can already use it by creating the iterator by hand:

```python
colors = Colors()
color_iterator = ColorIterator(colors)

for color in color_iterator:
    print(color)
```

Output:

```text
red
green
blue
```

To loop again, you create a new `ColorIterator`. That works, but the caller has to know that `ColorIterator` exists and remember to create it every time. The last step automates this: `Colors` gets an `__iter__()` method that returns a **fresh** `ColorIterator` on every call.

```python
class Colors:
    def __init__(self):
        self.rgb = ["red", "green", "blue"]

    def __len__(self):
        return len(self.rgb)

    def __iter__(self):
        return ColorIterator(self)
```

Now `Colors` behaves like a real collection:

```python
colors = Colors()

for color in colors:
    print(color)

print(list(colors))   # a second traversal works

for a in colors:      # nested loops work too
    for b in colors:
        if a < b:
            print(a, b)
```

Output:

```text
red
green
blue
['red', 'green', 'blue']
green red
blue red
blue green
```

Each `for` loop (and each `list()` call) calls `iter(colors)`, which calls `colors.__iter__()` and receives a brand-new iterator starting at index `0`.

Since `ColorIterator` exists only to serve `Colors`, you can nest it inside the class. This is purely a matter of organisation: it keeps the helper out of the module namespace, and the behaviour is the same.

```python
class Colors:
    def __init__(self):
        self.rgb = ["red", "green", "blue"]

    def __len__(self):
        return len(self.rgb)

    def __iter__(self):
        return self.ColorIterator(self)

    class ColorIterator:
        def __init__(self, colors):
            self._colors = colors
            self._index = 0

        def __iter__(self):
            return self

        def __next__(self):
            if self._index >= len(self._colors):
                raise StopIteration

            # return the next color
            color = self._colors.rgb[self._index]
            self._index += 1
            return color


colors = Colors()
print(list(colors))
print(list(colors))
print(type(iter(colors)).__qualname__)
```

Output:

```text
['red', 'green', 'blue']
['red', 'green', 'blue']
Colors.ColorIterator
```

## Shorter ways to write `__iter__()`

Writing a full iterator class is the clearest way to see how iteration works, but in everyday code there are two shortcuts.

If the data already lives in a built-in collection, **delegate** to that collection's iterator:

```python
class Colors:
    def __init__(self):
        self.rgb = ["red", "green", "blue"]

    def __iter__(self):
        return iter(self.rgb)   # a new list_iterator on every call


colors = Colors()
print(list(colors), list(colors))
```

Output:

```text
['red', 'green', 'blue'] ['red', 'green', 'blue']
```

If you need custom logic, write `__iter__()` as a **generator** with `yield`. Every call to `__iter__()` then creates a new generator object, which is an iterator with its own position. Generators are explained in the *Generators* section.

```python
class Colors:
    def __init__(self):
        self.rgb = ["red", "green", "blue"]

    def __iter__(self):
        for color in self.rgb:
            yield color.upper()


colors = Colors()
print(list(colors), list(colors))
```

Output:

```text
['RED', 'GREEN', 'BLUE'] ['RED', 'GREEN', 'BLUE']
```

## Checking the roles with `collections.abc`

`collections.abc` provides the abstract classes `Iterable` and `Iterator`. `isinstance()` checks the methods an object has, so your classes do not need to inherit from them:

```python
from collections.abc import Iterable, Iterator

for obj in ([1, 2], iter([1, 2]), "abc", range(3), enumerate("ab"), {"a": 1}, 42):
    print(f"{type(obj).__name__:14} iterable={isinstance(obj, Iterable)!s:5} "
          f"iterator={isinstance(obj, Iterator)}")
```

Output:

```text
list           iterable=True  iterator=False
list_iterator  iterable=True  iterator=True
str            iterable=True  iterator=False
range          iterable=True  iterator=False
enumerate      iterable=True  iterator=True
dict           iterable=True  iterator=False
int            iterable=False iterator=False
```

Note that `range` is iterable but is **not** an iterator. It is a lazy *sequence*: you can loop over the same `range` object many times. `enumerate`, on the other hand, is a one-shot iterator.

> **Note:** `isinstance(obj, Iterable)` only looks for `__iter__()`. It returns `False` for objects that are iterable through the older `__getitem__()` protocol. The only fully reliable test is to call `iter(obj)` and catch `TypeError`, as the next topic shows.

## Why the difference matters

A function that needs to go over its input **twice** works with iterables but breaks with iterators, and it breaks quietly:

```python
def percentages(values):
    total = sum(values)                              # first pass
    return [round(100 * v / total) for v in values]  # second pass


print(percentages([1, 1, 2]))
print(percentages(iter([1, 1, 2])))
```

Output:

```text
[25, 25, 50]
[]
```

With the iterator, `sum()` consumed every value, so the list comprehension found nothing. A robust version makes its own copy first:

```python
def percentages(values):
    values = list(values)   # works for any iterable, including one-shot iterators
    total = sum(values)
    return [round(100 * v / total) for v in values]


print(percentages(iter([1, 1, 2])))
print(percentages(n for n in (3, 1)))
```

Output:

```text
[25, 25, 50]
[75, 25]
```

## Common mistakes

- **Making a collection its own iterator.** If `__iter__()` returns `self` and the index is stored on the collection, the object can be traversed only once and nested loops break. Return a new iterator from `__iter__()` instead.

- **Returning the same iterator every time.** Creating the iterator once in `__init__()` and returning it from `__iter__()` has the same problem: all loops share one position.

- **Returning a list from `__iter__()`.** `__iter__()` must return an *iterator*, not just an iterable:

  ```python
  class Team:
      def __init__(self):
          self.members = ["Ann", "Bob"]

      def __iter__(self):
          return self.members   # wrong: a list is not an iterator


  try:
      for member in Team():
          print(member)
  except TypeError as error:
      print("TypeError:", error)
  ```

  Output:

  ```text
  TypeError: iter() returned non-iterator of type 'list'
  ```

  Write `return iter(self.members)` instead.

- **Leaving `__iter__()` out of the iterator class.** A `for` loop over the collection still works, but the iterator itself cannot be used where an iterable is expected, so `for x in iter(collection)` or `zip(iter(collection))` fails with `TypeError: '...' object is not iterable`.

- **Passing an iterator to code that iterates twice.** Generators, `map()`, `filter()`, `zip()` and file objects are one-shot. Convert them with `list()` when you need several passes.

## Summary

- An **iterable** can produce iterators: its `__iter__()` returns a new iterator each time. Lists, strings, dicts, sets and `range` are iterables.
- An **iterator** produces values: `__next__()` returns the next item, and `__iter__()` returns `self`. It can be consumed only once.
- Every iterator is an iterable, but most iterables are not iterators.
- A collection that is its own iterator can be looped over only once. Split it into a collection class and an iterator class, and return a new iterator from the collection's `__iter__()`.
- In practice, `__iter__()` often just returns `iter(self.some_list)` or is written as a generator with `yield`.
- `collections.abc.Iterable` and `collections.abc.Iterator` let you check the two roles with `isinstance()`.

## Practice

### Exercise 1: Iterable or iterator?

For each object, decide whether it is an iterable, an iterator, or neither. Then check your answers with `collections.abc`.

`[1, 2]`, `iter([1, 2])`, `"hi"`, `range(3)`, `iter(range(3))`, `zip("ab", "cd")`, `{"a": 1}`, `{"a": 1}.items()`, `3.14`

### Exercise 2: Make the playlist reusable

The `Playlist` below can be played only once. Rewrite it with a separate `PlaylistIterator` class so that the same playlist can be looped over any number of times, including in nested loops.

```python
class Playlist:
    def __init__(self, *songs):
        self.songs = list(songs)
        self.position = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self.position >= len(self.songs):
            raise StopIteration
        song = self.songs[self.position]
        self.position += 1
        return song


playlist = Playlist("Intro", "Verse", "Outro")
print(list(playlist))
print(list(playlist))
```

### Exercise 3: Statistics in two passes

Write `above_average(values)` that returns the list of values that are strictly greater than the average of all values. It must give the same result for a list, a `map` object and a generator expression. Test it with `[2, 4, 6, 8]`, `map(int, "2468")` and `(n * 2 for n in range(1, 5))`.

### Exercise 4: Your own range

Write an iterable class `MyRange(start, stop, step=1)` with a separate iterator class. It should support `len()`, be reusable, and give independent iterators. Then explain the difference between these two lines:

```python
r = MyRange(0, 6)
print(list(zip(r, r)))

it = iter(r)
print(list(zip(it, it)))
```

## Solutions

### Exercise 1

```python
from collections.abc import Iterable, Iterator

objects = [[1, 2], iter([1, 2]), "hi", range(3), iter(range(3)),
           zip("ab", "cd"), {"a": 1}, {"a": 1}.items(), 3.14]

for obj in objects:
    if isinstance(obj, Iterator):
        role = "iterator"
    elif isinstance(obj, Iterable):
        role = "iterable"
    else:
        role = "neither"
    print(f"{type(obj).__name__:15} {role}")
```

Output:

```text
list            iterable
list_iterator   iterator
str             iterable
range           iterable
range_iterator  iterator
zip             iterator
dict            iterable
dict_items      iterable
float           neither
```

Here "iterator" also implies "iterable". `dict.items()` returns a *view*: a live, reusable iterable, not a one-shot iterator.

### Exercise 2

```python
class PlaylistIterator:
    def __init__(self, playlist):
        self._playlist = playlist
        self._position = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self._position >= len(self._playlist.songs):
            raise StopIteration
        song = self._playlist.songs[self._position]
        self._position += 1
        return song


class Playlist:
    def __init__(self, *songs):
        self.songs = list(songs)

    def __iter__(self):
        return PlaylistIterator(self)


playlist = Playlist("Intro", "Verse", "Outro")
print(list(playlist))
print(list(playlist))

for first in playlist:
    for second in playlist:
        if first != second:
            print(first, "->", second)
```

Output:

```text
['Intro', 'Verse', 'Outro']
['Intro', 'Verse', 'Outro']
Intro -> Verse
Intro -> Outro
Verse -> Intro
Verse -> Outro
Outro -> Intro
Outro -> Verse
```

The position moved from `Playlist` to `PlaylistIterator`, so every loop starts from the beginning.

### Exercise 3

```python
def above_average(values):
    values = list(values)  # one pass to store, then as many passes as needed
    if not values:
        return []
    average = sum(values) / len(values)
    return [v for v in values if v > average]


print(above_average([2, 4, 6, 8]))
print(above_average(map(int, "2468")))
print(above_average(n * 2 for n in range(1, 5)))
print(above_average([]))
```

Output:

```text
[6, 8]
[6, 8]
[6, 8]
[]
```

Without `list(values)`, the `map` and generator versions would return `[]`, and `len()` would fail on them with `TypeError`.

### Exercise 4

```python
class MyRangeIterator:
    def __init__(self, start, stop, step):
        self._current = start
        self._stop = stop
        self._step = step

    def __iter__(self):
        return self

    def __next__(self):
        if self._current >= self._stop:
            raise StopIteration
        value = self._current
        self._current += self._step
        return value


class MyRange:
    def __init__(self, start, stop, step=1):
        if step <= 0:
            raise ValueError("step must be positive")
        self.start, self.stop, self.step = start, stop, step

    def __len__(self):
        return max(0, (self.stop - self.start + self.step - 1) // self.step)

    def __iter__(self):
        return MyRangeIterator(self.start, self.stop, self.step)


r = MyRange(0, 6)
print(len(r), list(r), list(r))
print(len(MyRange(1, 10, 3)), list(MyRange(1, 10, 3)))
print(len(MyRange(5, 1)), list(MyRange(5, 1)))

print(list(zip(r, r)))

it = iter(r)
print(list(zip(it, it)))
```

Output:

```text
6 [0, 1, 2, 3, 4, 5] [0, 1, 2, 3, 4, 5]
3 [1, 4, 7]
0 []
[(0, 0), (1, 1), (2, 2), (3, 3), (4, 4), (5, 5)]
[(0, 1), (2, 3), (4, 5)]
```

`zip(r, r)` calls `iter()` on the iterable twice and gets **two independent** iterators, so both columns go 0, 1, 2, … in step. `zip(it, it)` receives the **same** iterator twice (`iter(it)` returns `it` itself), so each tuple takes two consecutive values from one shared position. This trick is a well-known way to group items in pairs. To keep the example short, this `MyRange` only supports positive steps.

---

*Source: [pythontutorial.net — Python Iterator vs Iterable](https://www.pythontutorial.net/advanced-python/python-iterator-vs-iterable/). Adapted and expanded for PyJourney.*
