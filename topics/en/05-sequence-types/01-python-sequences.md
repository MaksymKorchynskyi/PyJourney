# Python Sequences

A **sequence** is an ordered collection of items that you can access by position: `s[0]`, `s[1]`, and so on. Lists, tuples, strings, ranges and bytes are all sequences, so they share one set of operations: `len()`, `in`, indexing, slicing, `+`, `*`, `index()` and `count()`. Learn these once and you can use them with every sequence type.

## What you'll learn

- What makes a type a sequence, and which built-in sequence types exist
- The difference between mutable and immutable, and between flat and container sequences
- How a sequence differs from a general iterable
- The common sequence operations: `len`, `in`, `index`, `count`, slicing, `min`/`max`, `+` and `*`
- Why concatenation and repetition copy references, not nested objects
- How to build your own sequence type with `collections.abc.Sequence`

## What is a sequence?

A sequence is a **positionally ordered** collection. Every item has an integer index, starting at `0`. If a sequence `s` has `n` items, the first one is `s[0]` and the last one is `s[n - 1]`. Negative indices count from the end, so `s[-1]` is also the last item:

```python
cities = ["San Francisco", "New York", "Washington DC"]

print(cities[0])
print(cities[2])
print(cities[-1])

try:
    print(cities[3])
except IndexError as error:
    print("IndexError:", error)
```

Output:

```text
San Francisco
Washington DC
Washington DC
IndexError: list index out of range
```

Why does indexing start at 0? The index is an *offset* from the start: the first item is 0 steps away from the beginning. This also makes slicing arithmetic clean, as you will see below.

### Built-in sequence types

| Type | Mutable | Holds | Example |
|---|---|---|---|
| `list` | yes | references to any objects | `[1, "a", None]` |
| `tuple` | no | references to any objects | `(1, "a", None)` |
| `str` | no | Unicode characters | `"hello"` |
| `range` | no | integers, computed on demand | `range(0, 10, 2)` |
| `bytes` | no | integers 0–255 | `b"abc"` |
| `bytearray` | yes | integers 0–255 | `bytearray(b"abc")` |

The standard library adds more, such as `array.array` (compact arrays of numbers) and `collections.deque` (fast appends and pops at both ends).

**Mutable** sequences (`list`, `bytearray`) can be changed in place: you can assign to `s[i]`, append, or delete items. **Immutable** sequences (`tuple`, `str`, `range`, `bytes`) cannot be changed after creation. Every "modification" creates a new object.

### Homogeneous and heterogeneous sequences

A sequence is **homogeneous** if all its items have the same type, and **heterogeneous** if the types can differ. A `str` contains only characters and `bytes` contains only small integers, so they are homogeneous. A `list` or `tuple` can hold integers, strings and any other objects side by side.

The real difference is in memory layout:

- **Flat sequences** (`str`, `bytes`, `bytearray`, `array.array`) store the values themselves in one compact block of memory. They are homogeneous by design, and they are smaller and faster for large amounts of data.
- **Container sequences** (`list`, `tuple`, `collections.deque`) store **references** to separate objects. This is what makes them heterogeneous and flexible, but every item is a full Python object somewhere else in memory.

That is why a list of a million numbers takes much more memory than an `array.array` of the same numbers.

## Sequences vs. iterables

An **iterable** is anything you can loop over and get items from one by one. Every sequence is iterable, but not every iterable is a sequence:

- a `set` is iterable, but it has no order and no indices (`s[0]` fails);
- a `dict` keeps insertion order, but `d[0]` looks up the **key** `0`, not the first position, so it is a mapping, not a sequence;
- a generator produces values one at a time and has neither `len()` nor indexing.

The abstract base classes in `collections.abc` make this precise:

```python
from collections.abc import Iterable, MutableSequence, Sequence

for obj in [[1, 2], (1, 2), "ab", range(2), {1, 2}, {"a": 1}, (x for x in "ab")]:
    print(
        f"{type(obj).__name__:<9}",
        "Sequence" if isinstance(obj, Sequence) else "-",
        "MutableSequence" if isinstance(obj, MutableSequence) else "-",
        "Iterable" if isinstance(obj, Iterable) else "-",
    )
```

Output:

```text
list      Sequence MutableSequence Iterable
tuple     Sequence - Iterable
str       Sequence - Iterable
range     Sequence - Iterable
set       - - Iterable
dict      - - Iterable
generator - - Iterable
```

Iterables are the more general concept. When you write a function that only needs to loop over its input, accept any iterable. Require a sequence only when you need `len()`, indexing or slicing.

## Common sequence operations

The examples below use lists, but the same operations work on tuples, strings, ranges and bytes, except where noted.

### Counting items: `len()`

```python
cities = ["San Francisco", "New York", "Washington DC"]
print(len(cities))
print(len("hello"))
print(len(range(0, 100, 5)))
```

Output:

```text
3
5
20
```

`len()` is fast for every built-in sequence: the length is stored, not counted.

### Membership: `in` and `not in`

```python
cities = ["San Francisco", "New York", "Washington DC"]
print("New York" in cities)
print("New York" not in cities)
print("ell" in "hello")
```

Output:

```text
True
False
True
```

For lists and tuples, `in` compares items one by one with `==`, so it takes longer the longer the sequence is. For strings, `in` checks for a **substring**, not just a single character. If you test membership often in a large collection, a `set` is much faster.

### Finding a position: `index()`

`seq.index(e)` returns the index of the **first** occurrence of `e`. Optional arguments limit the search to `seq[i:j]`:

```python
numbers = [1, 4, 5, 3, 5, 7, 8, 5]

print(numbers.index(5))
print(numbers.index(5, 3))
print(numbers.index(5, 3, 5))
```

Output:

```text
2
4
4
```

- `index(5)` finds the first `5` at index 2.
- `index(5, 3)` starts searching at index 3 and finds the `5` at index 4.
- `index(5, 3, 5)` searches indices 3 and 4 (the end index is excluded).

If the item is missing, `index()` raises `ValueError`:

```python
numbers = [1, 4, 5, 3, 5, 7, 8, 5]

try:
    numbers.index(10)
except ValueError as error:
    print("ValueError:", error)
```

Output:

```text
ValueError: list.index(x): x not in list
```

Either check with `in` first or catch the exception. Strings also have `find()`, which returns `-1` instead of raising.

### Counting occurrences: `count()`

```python
numbers = [1, 4, 5, 3, 5, 7, 8, 5]
print(numbers.count(5))
print("banana".count("an"))
```

Output:

```text
3
2
```

### Slicing

`seq[i:j]` returns a new sequence with the items from index `i` up to, **but not including**, index `j`. An optional third value is the step: `seq[i:j:k]`.

```python
numbers = [1, 4, 5, 3, 5, 7, 8, 5]
print(numbers[2:6])
print(numbers[2:6:2])
print(numbers[:3])
print(numbers[-2:])
```

Output:

```text
[5, 3, 5, 7]
[5, 5]
[1, 4, 5]
[8, 5]
```

It helps to imagine the indices sitting **between** the items:

```text
  +---+---+---+---+---+---+---+---+
  | 1 | 4 | 5 | 3 | 5 | 7 | 8 | 5 |
  +---+---+---+---+---+---+---+---+
  0   1   2   3   4   5   6   7   8
 -8  -7  -6  -5  -4  -3  -2  -1
```

`numbers[2:6]` takes everything between mark 2 and mark 6. With this picture, `len(s[i:j])` is simply `j - i`, and `s[:k] + s[k:]` always equals `s`. The topic *Slicing in Depth* covers slices in detail.

### Smallest and largest: `min()` and `max()`

If the items can be compared with each other, `min()` and `max()` find the smallest and largest one:

```python
numbers = [1, 4, 5, 3, 5, 7, 8, 5]
print(min(numbers))
print(max(numbers))
print(min(["pear", "fig", "banana"], key=len))
print(max([], default=None))
```

Output:

```text
1
8
fig
None
```

`key=` chooses what to compare (here the length of each word). Without `default=`, calling `min()` or `max()` on an empty sequence raises `ValueError`. Mixing types that cannot be ordered, such as `[1, "a"]`, raises `TypeError`.

### Concatenation: `+`

`s1 + s2` creates a **new** sequence containing the items of both. The operands must be the same type: `[1] + (2,)` is a `TypeError`, and `range` does not support `+` at all.

```python
east = ["New York", "New Jersey"]
west = ["San Diego", "San Francisco"]

cities = east + west
print(cities)

west.append("Sacramento")
print(west)
print(cities)
```

Output:

```text
['New York', 'New Jersey', 'San Diego', 'San Francisco']
['San Diego', 'San Francisco', 'Sacramento']
['New York', 'New Jersey', 'San Diego', 'San Francisco']
```

`cities` is a separate list, so appending to `west` afterwards does not affect it.

### Repetition: `*`

`s * n` creates a new sequence with the items of `s` repeated `n` times:

```python
print("ha" * 3)
print([0] * 5)
print((1, 2) * 2)
print("ha" * 0)
```

Output:

```text
hahaha
[0, 0, 0, 0, 0]
(1, 2, 1, 2)

```

The last line is empty: repeating zero (or a negative number of) times gives an empty sequence.

## Concatenation and repetition copy references

A new list made by `+` or `*` is new only at the top level. For a container sequence, the new list holds **references to the same item objects**. That is harmless for immutable items such as strings and numbers, but surprising for mutable items such as nested lists:

```python
city = [["San Francisco", 900_000]]
cities = city + city

print(cities)
print(cities[0] is cities[1])

city[0][1] = 1_000_000
print(cities)
```

Output:

```text
[['San Francisco', 900000], ['San Francisco', 900000]]
True
[['San Francisco', 1000000], ['San Francisco', 1000000]]
```

`city` contains one inner list. `city + city` builds a new outer list with **two references to that same inner list**. Changing the inner list through `city[0]` is therefore visible in both positions of `cities`.

```text
city   ----> [ * ]
               |
               v
             ['San Francisco', 1000000]
               ^          ^
               |          |
cities ----> [ *    ,     * ]
```

The same happens with repetition, which is a classic bug when building grids:

```python
grid = [[0] * 3] * 3
grid[0][0] = 1
print(grid)

grid = [[0] * 3 for _ in range(3)]
grid[0][0] = 1
print(grid)
```

Output:

```text
[[1, 0, 0], [1, 0, 0], [1, 0, 0]]
[[1, 0, 0], [0, 0, 0], [0, 0, 0]]
```

The list comprehension evaluates `[0] * 3` three times and creates three independent rows.

## Writing your own sequence

A class becomes a sequence when it implements two methods: `__len__` and `__getitem__`. If you inherit from `collections.abc.Sequence`, you get `in`, iteration, `reversed()`, `index()` and `count()` for free:

```python
from collections.abc import Sequence


class Countdown(Sequence):
    def __init__(self, start):
        self.start = start

    def __len__(self):
        return self.start

    def __getitem__(self, index):
        if isinstance(index, slice):
            return [self[i] for i in range(*index.indices(len(self)))]
        if index < 0:
            index += len(self)
        if not 0 <= index < len(self):
            raise IndexError("Countdown index out of range")
        return self.start - index


c = Countdown(5)
print(list(c))
print(len(c), c[0], c[-1])
print(3 in c, c.index(2), c.count(4))
print(list(reversed(c)))
print(c[1:4])
```

Output:

```text
[5, 4, 3, 2, 1]
5 5 1
True 3 1
[1, 2, 3, 4, 5]
[4, 3, 2]
```

`slice.indices(len(self))` turns a slice with missing or negative values into concrete `start, stop, step` numbers that `range()` accepts. Raising `IndexError` for out-of-range indices is essential: the default iteration stops exactly when `__getitem__` raises it.

## Common mistakes

- **Off-by-one with the last index.** The last item is `s[len(s) - 1]` or simply `s[-1]`. `s[len(s)]` raises `IndexError`.
- **Calling `index()` without handling a missing item.** It raises `ValueError`. Check with `in` first or use `try`/`except`.
- **Treating dicts and sets as sequences.** Neither supports positional indexing. Convert with `list(...)` if you really need positions.
- **Building nested lists with `*` or `+`.** `[[0] * 3] * 3` gives three references to one row. Use a list comprehension.
- **Using `in` on a big list inside a loop.** Each check scans the list. Convert it to a `set` once if you only need membership tests.
- **Concatenating in a loop.** `result = result + [item]` creates a new list every time, so the total work grows quadratically. Use `append()`, or `"".join(parts)` for strings.

## Summary

- A sequence is an ordered collection whose items are accessed by integer position, starting at `0`. Negative indices count from the end.
- Built-in sequences: `list`, `tuple`, `str`, `range`, `bytes`, `bytearray`. Lists and bytearrays are mutable, the others are immutable.
- Flat sequences store values compactly. Container sequences store references to objects of any type.
- Every sequence is iterable, but sets, dicts and generators are iterables that are not sequences.
- Shared operations: `len()`, `in`, `index()`, `count()`, slicing, `min()`/`max()`, `+` and `*`.
- `+` and `*` build a new outer sequence but reuse references to the same items, which matters for nested mutable objects.
- Implement `__len__` and `__getitem__` (ideally by inheriting `collections.abc.Sequence`) to create your own sequence type.

## Practice

### Exercise 1: Explore a tuple

Given `temps = (12, 15, 15, 9, 21, 15, 18)`, print: the number of readings, the first and last readings, the minimum and maximum, how many times `15` occurs, the index of the first `15`, and the index of the first `15` at or after position `3`.

### Exercise 2: Find all positions

Write `find_all(seq, item)` that returns a list of **all** indices where `item` occurs in `seq`. Use `seq.index(item, start)` in a loop and stop when it raises `ValueError`. It must work for lists, tuples and strings (for strings, `item` is a single character).

### Exercise 3: Predict the output

Write down what the code prints, then run it and explain each line.

```python
row = ["-", "-"]
board = [row] * 2
board[0][0] = "X"
print(board)

pair = ("a", ["b"])
copy = pair + pair
pair[1].append("c")
print(copy)
print(len(copy), copy.count("a"))
```

### Exercise 4: A sequence of squares

Create a class `Squares(n)` that inherits from `collections.abc.Sequence` and represents the squares `0, 1, 4, ..., (n - 1) ** 2` without storing them. Support negative indices and raise `IndexError` when out of range. Show `len()`, indexing, `in`, `index()` and iteration.

## Solutions

### Exercise 1

```python
temps = (12, 15, 15, 9, 21, 15, 18)

print(len(temps))
print(temps[0], temps[-1])
print(min(temps), max(temps))
print(temps.count(15))
print(temps.index(15))
print(temps.index(15, 3))
```

Output:

```text
7
12 18
9 21
3
1
5
```

### Exercise 2

```python
def find_all(seq, item):
    positions = []
    start = 0
    while True:
        try:
            position = seq.index(item, start)
        except ValueError:
            return positions
        positions.append(position)
        start = position + 1


print(find_all([1, 4, 5, 3, 5, 7, 8, 5], 5))
print(find_all(("a", "b", "a"), "a"))
print(find_all("mississippi", "s"))
print(find_all([1, 2, 3], 9))
```

Output:

```text
[2, 4, 7]
[0, 2]
[2, 3, 5, 6]
[]
```

Starting the next search at `position + 1` guarantees progress, so the loop always ends.

### Exercise 3

Output:

```text
[['X', '-'], ['X', '-']]
('a', ['b', 'c'], 'a', ['b', 'c'])
4 2
```

- `[row] * 2` holds two references to the same `row` list, so the change shows up twice.
- `pair + pair` is a new tuple, but both copies of position 1 refer to the same inner list. Tuples are immutable, yet the list inside them is not, so `append("c")` is visible through `copy`.
- `copy` has four items, two of which are `"a"`.

### Exercise 4

```python
from collections.abc import Sequence


class Squares(Sequence):
    def __init__(self, n):
        self.n = n

    def __len__(self):
        return self.n

    def __getitem__(self, index):
        if isinstance(index, slice):
            return [self[i] for i in range(*index.indices(len(self)))]
        if index < 0:
            index += self.n
        if not 0 <= index < self.n:
            raise IndexError("Squares index out of range")
        return index * index


squares = Squares(6)
print(len(squares))
print(squares[2], squares[-1])
print(16 in squares, 15 in squares)
print(squares.index(9))
print(list(squares))
print(squares[::2])
```

Output:

```text
6
4 25
True False
3
[0, 1, 4, 9, 16, 25]
[0, 4, 16]
```

The values are computed on demand in `__getitem__`, just like `range` computes its numbers instead of storing them.

---

*Source: [pythontutorial.net — Python Sequences](https://www.pythontutorial.net/advanced-python/python-sequences/). Adapted and expanded for PyJourney.*
