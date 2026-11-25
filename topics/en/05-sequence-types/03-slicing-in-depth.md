# Slicing in Depth

The topic Python Sequences introduced the basic slice `s[i:j]`. This topic looks underneath it: how Python interprets `start`, `stop` and `step` (including negative and out-of-range values), what a `slice` object is, how to *assign* to and *delete* slices of a list, and what is copied and what is shared. These details explain many one-line idioms such as `s[::-1]`, `s[:] = ...` and `del s[::2]`.

## What you'll learn

- How `start`, `stop` and `step` are interpreted, including defaults, negative values and out-of-range bounds
- How negative steps work, and why `s[3:-1:-1]` is empty
- What a `slice` object is, how to name and reuse slices, and what `__getitem__` receives
- How `slice.indices()` turns any slice into concrete `range()` arguments
- How to replace, insert and delete items with slice assignment and `del`
- That slicing makes shallow copies, and what to use for iterators and zero-copy views

## Extracting and assigning

For every sequence, slicing **extracts** a part of it. For mutable sequences such as lists, you can also **assign** to a slice and replace that part:

```python
colors = ["red", "green", "blue", "orange"]

# extract data
print(colors[1:3])

# assign data
colors[1:3] = ["pink", "black"]
print(colors)
```

Output:

```text
['green', 'blue']
['red', 'pink', 'black', 'orange']
```

Immutable sequences such as strings, tuples and bytes support extraction only:

```python
topic = "Python Slicing"

# extract data
print(topic[0:6])
print(topic[7:])
```

Output:

```text
Python
Slicing
```

Assigning to a slice of an immutable sequence fails:

```python
topic = "Python Slicing"
topic[0:6] = "Java"
```

Output (last line of the traceback):

```text
TypeError: 'str' object does not support item assignment
```

To "change" a string, build a new one: `"Java" + topic[6:]`.

## Start and stop

`seq[start:stop]` selects every item whose index `n` satisfies:

```text
start <= n < stop
```

The item at `stop` is **not** included. The easiest way to reason about it is to picture the indices sitting **between** the items, like marks on a ruler. A slice takes everything between two marks:

```text
         +-------+---------+--------+----------+
         | "red" | "green" | "blue" | "orange" |
         +-------+---------+--------+----------+
positive 0       1         2        3          4
negative -4      -3        -2       -1
```

`colors[1:3]` is everything between mark `1` and mark `3`: `"green"` and `"blue"`.

### Defaults and out-of-range bounds

Both bounds are optional: `start` defaults to the beginning and `stop` to the end. Bounds that lie outside the sequence are **clamped** to it, so slicing never raises `IndexError`:

```python
colors = ["red", "green", "blue", "orange"]

print(colors[0:100])
print(colors[10:])
print(colors[-100:2])
print(colors[3:1])
```

Output:

```text
['red', 'green', 'blue', 'orange']
[]
['red', 'green']
[]
```

- `stop=100` is past the end, so Python uses `len(colors)`.
- `start=10` is also clamped to `len(colors)`, which leaves nothing to select.
- `start=-100` is clamped to the beginning.
- When `start` is at or after `stop` (with a positive step), the result is simply empty.

This forgiving behaviour is convenient (`s[:3]` works even if `s` is shorter than three items), but it also hides bugs: a typo in an index produces an empty or short result instead of an error. Indexing a single item, `colors[10]`, does raise `IndexError`.

### Negative bounds

A negative bound counts from the end: Python adds `len(seq)` to it. With four items, `-4` means `0` and `-2` means `2`. You can mix negative and positive bounds:

```python
colors = ["red", "green", "blue", "orange"]

print(colors[-4:-2])
print(colors[-2:4])
print(colors[-2:])
print(colors[:-1])
```

Output:

```text
['red', 'green']
['blue', 'orange']
['blue', 'orange']
['red', 'green', 'blue']
```

`s[-n:]` ("the last `n` items") and `s[:-n]` ("everything except the last `n`") are the most common idioms.

### Two useful invariants

Because `stop` is excluded, slices fit together without gaps or overlaps:

```python
letters = "abcdefgh"

print(all(letters[:k] + letters[k:] == letters for k in range(len(letters) + 1)))
print(len(letters[2:5]), 5 - 2)
```

Output:

```text
True
3 3
```

`s[:k] + s[k:]` always rebuilds `s`, and for bounds inside the sequence `len(s[i:j])` is simply `j - i`. This is the main reason Python uses zero-based indexes with an exclusive end.

## The step

An optional third value, the **step**, selects every `step`-th item. It defaults to `1`:

```python
colors = ["red", "green", "blue", "orange"]

print(colors[0:4:2])
print(colors[::2])
print(colors[1::2])

digits = list(range(10))
print(digits[1:8:3])
```

Output:

```text
['red', 'blue']
['red', 'blue']
['green', 'orange']
[1, 4, 7]
```

`s[::2]` takes items at even positions and `s[1::2]` items at odd positions. `digits[1:8:3]` starts at index `1` and adds `3` while the index stays below `8`: `1, 4, 7`.

A step of zero would never make progress, so it is rejected:

```python
colors = ["red", "green", "blue", "orange"]
print(colors[::0])
```

Output (last line of the traceback):

```text
ValueError: slice step cannot be zero
```

### Negative steps

A negative step walks **backwards**. Now `start` should be the larger index, and the defaults flip: an omitted `start` means "the last item", and an omitted `stop` means "past the first item":

```python
colors = ["red", "green", "blue", "orange"]

print(colors[::-1])
print(colors[3:0:-1])
print(colors[::-2])
print("stressed"[::-1])
```

Output:

```text
['orange', 'blue', 'green', 'red']
['orange', 'blue', 'green']
['orange', 'green']
desserts
```

`colors[3:0:-1]` goes from index `3` down to, but not including, index `0`, so `"red"` is missing. How do you write a stop that includes index `0`? Not with `-1`:

```python
colors = ["red", "green", "blue", "orange"]

print(colors[3:-1:-1])      # -1 means "the last item", not "before the start"
print(colors[3:None:-1])    # None means "go all the way"
print(colors[-1:-5:-1])
```

Output:

```text
[]
['orange', 'blue', 'green', 'red']
['orange', 'blue', 'green', 'red']
```

`-1` is converted to `3` (the last index), so `colors[3:-1:-1]` means "from 3 down to 3, exclusive", which is empty. Use `None` (or leave the stop out) to go all the way to the beginning, or use a negative stop that is before the first item, such as `-len(colors) - 1`.

> **Tip:** `s[::-1]` builds a reversed copy. If you only need to loop backwards, `reversed(s)` is cheaper: it returns an iterator and copies nothing.

## The slice object

The colon syntax is shorthand for a `slice` object. `seq[start:stop:step]` is the same as `seq[slice(start, stop, step)]`:

```python
s = slice(1, 3)

print(type(s))
print(s.start, s.stop, s.step)
print(slice(3))
```

Output:

```text
<class 'slice'>
1 3 None
slice(None, 3, None)
```

Omitted parts are stored as `None`. With one argument, `slice(3)` sets only `stop`, just like `range(3)`. A slice object can be passed in square brackets wherever a slice is allowed:

```python
colors = ["red", "green", "blue", "orange"]
s = slice(1, 3)

print(colors[s])
print("abcdef"[s])
```

Output:

```text
['green', 'blue']
bc
```

### What `__getitem__` receives

When you write `obj[...]`, Python calls `obj.__getitem__(key)`. The key is an integer for indexing, a `slice` object for slicing, and a tuple when there are commas:

```python
class Probe:
    def __getitem__(self, key):
        return key


p = Probe()
print(p[2])
print(p[1:3])
print(p[::2])
print(p[:])
print(p[1:5, ::-1])
```

Output:

```text
2
slice(1, 3, None)
slice(None, None, 2)
slice(None, None, None)
(slice(1, 5, None), slice(None, None, -1))
```

Built-in sequences do not accept tuples of slices, but libraries such as NumPy use them for multi-dimensional slicing (`matrix[1:3, ::2]`). To support slicing in your own sequence class, check `isinstance(key, slice)` in `__getitem__`. The topics Python Sequences and Fibonacci Sequence show complete examples.

### Naming slices

Slice objects let you give names to fixed positions, which makes code that parses fixed-width text much easier to read:

```python
line = "2026-11-25 ORD-1042   149.90"
#       0123456789012345678901234567

DATE = slice(0, 10)
ORDER = slice(11, 19)
AMOUNT = slice(19, None)

print(line[DATE])
print(line[ORDER])
print(float(line[AMOUNT]))
```

Output:

```text
2026-11-25
ORD-1042
149.9
```

`line[AMOUNT]` is far clearer than `line[19:]`, and when the format changes you update the positions in one place.

Since Python 3.12, slice objects are **hashable**, so they can be dictionary keys or set members:

```python
cache = {slice(0, 10): "first page"}      # slices are hashable since 3.12
print(cache[slice(0, 10)])
```

Output:

```text
first page
```

## slice.indices(): normalizing a slice

A slice object by itself does not know the length of the sequence, so its `start` and `stop` can be `None`, negative or out of range. The method `indices(length)` resolves all of that for a sequence of the given length and returns a tuple `(start, stop, step)` of concrete integers, ready to pass to `range()`:

```python
colors = ["red", "green", "blue", "orange"]

s = slice(0, 4, 2)
t = s.indices(len(colors))
print(t)

for index in range(*t):
    print(colors[index])
```

Output:

```text
(0, 4, 2)
red
blue
```

`range(*t)` unpacks the tuple into `range(0, 4, 2)`, which produces exactly the indices the slice selects. The method applies the defaults, the negative-index conversion and the clamping described above:

```python
length = 4
print(slice(None, None, -1).indices(length))
print(slice(-100, 100).indices(length))
print(slice(-3, None, 2).indices(length))
print(list(range(*slice(None, None, -1).indices(length))))
```

Output:

```text
(3, -1, -1)
(0, 4, 1)
(1, 4, 2)
[3, 2, 1, 0]
```

Watch the first line: the normalized stop is `-1`. For `range()` that is a real number meaning "stop before reaching -1", so `range(3, -1, -1)` produces `3, 2, 1, 0`. If you fed `(3, -1, -1)` back into a slice, `-1` would mean "the last item" and you would get an empty result. The output of `indices()` is meant for `range()`, not for slicing again.

## Assigning to slices

For lists and other mutable sequences, slice assignment replaces the selected part with the items of any iterable. With a simple slice (no step), the new part **can have a different length**, so the list grows or shrinks:

```python
nums = [1, 2, 3, 4, 5]

nums[1:2] = [20, 30, 40]     # replace one item with three
print(nums)

nums[1:4] = []               # replace three items with nothing
print(nums)

nums[2:2] = [7, 8]           # empty slice: pure insertion
print(nums)

nums[:0] = [0]               # prepend
nums[len(nums):] = [99]      # append
print(nums)
```

Output:

```text
[1, 20, 30, 40, 3, 4, 5]
[1, 3, 4, 5]
[1, 3, 7, 8, 4, 5]
[0, 1, 3, 7, 8, 4, 5, 99]
```

An empty slice such as `nums[2:2]` selects nothing, so assigning to it inserts items at that position without removing anything.

The right-hand side is iterated, which matters for strings:

```python
letters = ["a", "b", "c"]
letters[0:1] = "xyz"         # any iterable works, a string gives characters
print(letters)

letters[0:3] = ["xyz"]       # wrap it in a list to insert one item
print(letters)
```

Output:

```text
['x', 'y', 'z', 'b', 'c']
['xyz', 'b', 'c']
```

Assigning a non-iterable, such as `nums[0:1] = 5`, raises `TypeError: must assign iterable to extended slice`.

### Extended slices need the same length

When the slice has a step (an **extended slice**), the selected positions are scattered, so Python cannot insert or remove items. The right-hand side must have exactly as many items as the slice selects:

```python
nums = [1, 2, 3, 4, 5, 6]
nums[::2] = [0, 0, 0]
print(nums)

nums[::2] = [9, 9]
```

Output (the second assignment fails, last line of the traceback shown):

```text
[0, 2, 0, 4, 0, 6]
ValueError: attempt to assign sequence of size 2 to extended slice of size 3
```

### Replacing the whole content in place

`s[:] = ...` replaces **everything** inside the existing list. The object stays the same, so every other reference to it sees the new content. A plain assignment only rebinds a name (see the topic References in the section on variables):

```python
scores = [70, 85, 90]
alias = scores

scores[:] = [100, 100]       # mutates the existing list
print(alias, alias is scores)

scores = [50]                # rebinds the name only
print(alias, alias is scores)
```

Output:

```text
[100, 100] True
[100, 100] False
```

This matters when a list is shared, for example when a function must update the caller's list, or when an object hands out a reference to its internal list.

## Deleting slices

`del` works with slices too, including extended ones:

```python
nums = list(range(10))

del nums[1:3]
print(nums)

del nums[::2]
print(nums)

del nums[:]
print(nums)
```

Output:

```text
[0, 3, 4, 5, 6, 7, 8, 9]
[3, 5, 7, 9]
[]
```

`del nums[:]` empties the list in place, exactly like `nums.clear()`.

## Slices are shallow copies

Slicing a list creates a **new list**, but the items themselves are not copied. Both lists refer to the same item objects:

```python
matrix = [[1, 2], [3, 4]]
copy = matrix[:]

print(copy == matrix, copy is matrix)

copy.append([5, 6])        # the outer lists are independent
copy[0][0] = 100           # but the inner lists are shared
print(matrix)
print(copy)
```

Output:

```text
True False
[[100, 2], [3, 4]]
[[100, 2], [3, 4], [5, 6]]
```

`matrix[:]` (or `list(matrix)`, or `matrix.copy()`) is a **shallow copy**. For nested mutable data, use `copy.deepcopy()`.

The type of the result follows the sequence: slicing a string gives a string, a tuple gives a tuple, and a `range` gives a new `range` without building any list. For immutable sequences CPython even skips the copy when you slice everything, since nobody can tell the difference:

```python
word = "python"
point = (1, 2, 3)
print(word[:] is word, point[:] is point)

print(range(0, 20)[::3])
print(range(10)[::-1])
print(b"hello"[1:3])
```

Output:

```text
True True
range(0, 20, 3)
range(9, -1, -1)
b'el'
```

> **Note:** `word[:] is word` being `True` is a CPython optimization, not a language guarantee. Never rely on it.

### Zero-copy slices with memoryview

Copying is usually fine, but for large binary data it costs time and memory. A `memoryview` over a `bytes`-like object can be sliced **without copying**: the result is a window into the original buffer. Writing through a view of a mutable buffer changes the original:

```python
data = bytearray(b"hello world")
view = memoryview(data)[6:]     # no copy: a window into data
view[0] = ord("W")
print(data)

part = data[6:]                 # an ordinary slice is a copy
part[0] = ord("w")
print(data, part)
```

Output:

```text
bytearray(b'hello World')
bytearray(b'hello World') bytearray(b'world')
```

## What can be sliced

Slicing works with every built-in sequence: `list`, `tuple`, `str`, `range`, `bytes`, `bytearray`, `memoryview` and `array.array`. It does not work with:

- **sets and dicts**, which have no positions. Since slices became hashable in Python 3.12, `d[0:2]` on a dict raises `KeyError: slice(0, 2, None)` (it looks for that key) rather than `TypeError`;
- **`collections.deque`**, which supports indexing but not slicing;
- **iterators and generators**, which have no indexes at all.

For the last two, `itertools.islice()` produces the selected items lazily, one by one:

```python
from collections import deque
from itertools import islice

squares = (n * n for n in range(10))
print(list(islice(squares, 2, 6)))

queue = deque([1, 2, 3, 4])
print(list(islice(queue, 1, 3)))
print(queue[1:3])
```

Output (the last line fails, last line of the traceback shown):

```text
[4, 9, 16, 25]
[2, 3]
TypeError: sequence index must be integer, not 'slice'
```

`islice()` does not support negative values, because an iterator does not know where its end is.

## Common mistakes

- **Expecting an error for out-of-range slices.** `s[10:20]` on a short list is just `[]`. Check lengths explicitly when the data must be complete.
- **Forgetting that `stop` is excluded.** `s[2:5]` has three items: indexes 2, 3 and 4.
- **Using `-1` as the stop of a backward slice.** `s[3:-1:-1]` is empty. Use `s[3::-1]` or `s[3:None:-1]`.
- **Assigning a string to a slice.** `items[0:1] = "abc"` inserts three characters. Use `items[0:1] = ["abc"]`.
- **Changing the length through an extended slice.** `s[::2] = ...` needs exactly as many items as the slice selects.
- **Thinking a slice is a view.** A list slice is a copy: changing it does not change the original list (NumPy arrays and `memoryview` behave differently).
- **Thinking a slice is a deep copy.** Nested mutable items are shared between the original and the slice.
- **Feeding `slice.indices()` back into a slice.** Its result is for `range()`. A stop of `-1` there means "before index 0".

## Summary

- `s[start:stop:step]` selects indexes from `start` up to but not including `stop`, moving by `step`. All three parts are optional.
- Negative bounds count from the end. Out-of-range bounds are clamped, so slicing never raises `IndexError`.
- A negative step walks backwards and flips the defaults. `s[::-1]` is a reversed copy, and `None` (not `-1`) means "go to the beginning".
- The colon syntax creates a `slice` object. Named slices make fixed-width parsing readable, and `__getitem__` receives the slice object.
- `slice.indices(length)` returns concrete `(start, stop, step)` values for `range()`.
- Mutable sequences support slice assignment and `del`. Simple slices can change the length; extended slices cannot. `s[:] = ...` replaces the content in place.
- Slicing returns a shallow copy of the same type. Use `itertools.islice()` for iterators and `memoryview` for zero-copy views of binary data.

## Practice

### Exercise 1: Predict the output

Write down what each line prints, then run the code and explain the results.

```python
s = "Python"
print(s[1:4])
print(s[-3:])
print(s[:-3])
print(s[::2])
print(s[::-2])
print(s[4:1:-1])
print(s[4:-10:-1])
print(repr(s[10:20]))
```

### Exercise 2: Split into chunks

Write `chunks(seq, size)` that splits any sequence into consecutive pieces of `size` items (the last one may be shorter) and returns them as a list. The pieces must have the same type as the input: lists for a list, strings for a string, ranges for a range. Raise `ValueError` if `size` is less than 1. Test it with a list of 7 numbers, the string `"abcdefgh"`, `range(10)` and an empty list, and compare the string result with `itertools.batched()` (Python 3.12+).

### Exercise 3: A fixed-width report

Parse this report with named slice objects into a list of dictionaries with the keys `id` (string), `name` (string without padding), `qty` (int) and `price` (float). Skip the header line, print every row and the total value of all items.

```python
report = """\
ID   NAME        QTY  PRICE
001  Notebook      3   2.35
002  Pen          10   0.99
003  Backpack      1  24.90"""
```

### Exercise 4: In-place edits

Write three functions that modify a list **in place** using only slice assignment or `del` with slices:

- `reverse_middle(items)` reverses all items except the first and the last;
- `drop_every(items, k)` deletes every `k`-th item (the `k`-th, `2k`-th, ...);
- `insert_after(items, index, new_items)` inserts the items of `new_items` right after position `index`.

Apply them one after another to `[1, 2, 3, 4, 5, 6, 7, 8]` (with `k=3`, then `index=0` and `["a", "b"]`) and prove that the list object is still the same one.

## Solutions

### Exercise 1

Output:

```text
yth
hon
Pyt
Pto
nhy
oht
ohtyP
''
```

- `s[1:4]` takes indexes 1, 2 and 3.
- `s[-3:]` is the last three characters, and `s[:-3]` everything before them.
- `s[::2]` takes indexes 0, 2 and 4: `P`, `t`, `o`.
- `s[::-2]` starts at the last index (5) and takes 5, 3, 1: `n`, `h`, `y`.
- `s[4:1:-1]` goes from 4 down to 2: `o`, `h`, `t`.
- `-10` is before the beginning, so it is clamped, and the slice runs from 4 down to 0 inclusive.
- `s[10:20]` is completely out of range, so it is an empty string, not an error.

### Exercise 2

```python
from itertools import batched


def chunks(seq, size):
    if size < 1:
        raise ValueError("size must be at least 1")
    return [seq[i:i + size] for i in range(0, len(seq), size)]


print(chunks([1, 2, 3, 4, 5, 6, 7], 3))
print(chunks("abcdefgh", 3))
print(chunks(range(10), 4))
print(chunks([], 3))
print(list(batched("abcdefgh", 3)))
```

Output:

```text
[[1, 2, 3], [4, 5, 6], [7]]
['abc', 'def', 'gh']
[range(0, 4), range(4, 8), range(8, 10)]
[]
[('a', 'b', 'c'), ('d', 'e', 'f'), ('g', 'h')]
```

`range(0, len(seq), size)` yields the start of every chunk. The last slice `seq[6:9]` reaches past the end and is clamped, so no special case is needed for a short final chunk. Because slicing keeps the type, strings stay strings and ranges stay ranges. `itertools.batched()` works with any iterable but always produces tuples.

### Exercise 3

```python
report = """\
ID   NAME        QTY  PRICE
001  Notebook      3   2.35
002  Pen          10   0.99
003  Backpack      1  24.90"""

ID = slice(0, 3)
NAME = slice(5, 17)
QTY = slice(17, 21)
PRICE = slice(21, None)

rows = []
for line in report.splitlines()[1:]:
    rows.append({
        "id": line[ID],
        "name": line[NAME].strip(),
        "qty": int(line[QTY]),
        "price": float(line[PRICE]),
    })

for row in rows:
    print(row)
print(sum(row["qty"] * row["price"] for row in rows))
```

Output:

```text
{'id': '001', 'name': 'Notebook', 'qty': 3, 'price': 2.35}
{'id': '002', 'name': 'Pen', 'qty': 10, 'price': 0.99}
{'id': '003', 'name': 'Backpack', 'qty': 1, 'price': 24.9}
41.85
```

`int()` and `float()` ignore the surrounding spaces, so only the name needs `.strip()`. `report.splitlines()[1:]` is itself a slice that skips the header. For real money, convert prices with `Decimal` instead of `float` (see the topic Decimal).

### Exercise 4

```python
def reverse_middle(items):
    items[1:-1] = items[-2:0:-1]


def drop_every(items, k):
    del items[k - 1::k]


def insert_after(items, index, new_items):
    items[index + 1:index + 1] = new_items


data = [1, 2, 3, 4, 5, 6, 7, 8]
original_id = id(data)

reverse_middle(data)
print(data)

drop_every(data, 3)
print(data)

insert_after(data, 0, ["a", "b"])
print(data)

print(id(data) == original_id)
```

Output:

```text
[1, 7, 6, 5, 4, 3, 2, 8]
[1, 7, 5, 4, 2, 8]
[1, 'a', 'b', 7, 5, 4, 2, 8]
True
```

- `items[-2:0:-1]` walks backwards from the second-to-last item down to index 1 (the stop `0` is excluded), and assigning it to `items[1:-1]` writes the reversed middle back.
- `items[k - 1::k]` selects positions `k - 1, 2k - 1, ...`, which are the `k`-th, `2k`-th, ... items when counting from one.
- `items[index + 1:index + 1]` is an empty slice, so assigning to it inserts without removing anything.

All three operations mutate the list, so `id(data)` never changes.

---

*Source: [pythontutorial.net — Python Slicing](https://www.pythontutorial.net/advanced-python/python-slicing/). Adapted and expanded for PyJourney.*
