# NumPy

NumPy (**Num**erical **Py**thon) is the foundation of scientific computing in Python. Its core is the `ndarray`, a fast N-dimensional array of same-typed values, plus hundreds of functions that work on whole arrays at once. pandas, scikit-learn, SciPy, Matplotlib, PyTorch and many other libraries either build on NumPy or speak its language, so learning it pays off everywhere in data work.

## What you'll learn

- Why NumPy arrays are faster and smaller than Python lists, and what vectorization means
- How to create arrays (`array`, `zeros`, `ones`, `full`, `arange`, `linspace`, `eye`, random generators) and read their `shape`, `ndim`, `size` and `dtype`
- How to reshape arrays and index them with slices, boolean masks and integer arrays, and when you get a view or a copy
- How element-wise math, universal functions and broadcasting replace Python loops
- How to aggregate along an `axis`, sort, filter, stack, split and do basic linear algebra
- How to deal with missing values (`nan`) and how to save and load arrays

## Why NumPy?

A Python list stores **pointers** to separate Python objects, which can be of any type. Each `int` in a list is a full object with its own header, and every operation goes through the interpreter one element at a time. A NumPy array stores raw values of **one type**, packed side by side in one block of memory:

```text
Python list [1, 2, 3]                    NumPy array np.array([1, 2, 3])
+-----+-----+-----+                      +--------+--------+--------+
|  *  |  *  |  *  |   pointers           |   1    |   2    |   3    |   raw int64 values,
+--|--+--|--+--|--+                      +--------+--------+--------+   8 bytes each,
   v     v     v                                                         side by side
 int 1  int 2  int 3  separate objects
```

This layout lets NumPy run operations in optimized compiled loops over the whole array. Writing `a * b` instead of a Python `for` loop is called **vectorization**. It makes code both shorter and much faster:

```python
import sys
import time

import numpy as np

n = 1_000_000
numbers = list(range(n))
arr = np.arange(n)

start = time.perf_counter()
squares_list = [x * x for x in numbers]
list_time = time.perf_counter() - start

start = time.perf_counter()
squares_arr = arr * arr
numpy_time = time.perf_counter() - start

print(f"list comprehension: {list_time * 1000:6.1f} ms")
print(f"NumPy:              {numpy_time * 1000:6.1f} ms")

list_bytes = sys.getsizeof(numbers) + sum(sys.getsizeof(x) for x in numbers)
print(f"list memory:  ~{list_bytes / 1e6:.0f} MB")
print(f"array memory: ~{arr.nbytes / 1e6:.0f} MB")
```

Output (timings vary between machines and runs):

```text
list comprehension:   12.9 ms
NumPy:                 1.2 ms
list memory:  ~36 MB
array memory: ~8 MB
```

The price for this speed is a few restrictions: all elements share one data type, the total size of an array is fixed after creation, and multi-dimensional arrays must be rectangular (every row has the same length).

NumPy is a third-party package. Install it into a virtual environment and import it under the conventional alias `np`:

```bash
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install numpy
```

```python
import numpy as np

print(np.__version__)  # output varies, e.g. 2.5.5
```

All examples in this lesson were run with NumPy 2.5 on Python 3.14.

## The ndarray and its attributes

The main object is `np.ndarray` ("N-dimensional array"). Each dimension is called an **axis**. A 2D array has axis 0 (rows, going down) and axis 1 (columns, going across):

```python
import numpy as np

a = np.array([[1, 2, 3, 4],
              [5, 6, 7, 8],
              [9, 10, 11, 12]])

print(a)
print("ndim: ", a.ndim)    # number of axes
print("shape:", a.shape)   # length along each axis
print("size: ", a.size)    # total number of elements
print("dtype:", a.dtype)   # type of every element
print("itemsize:", a.itemsize, "bytes")
print("nbytes:  ", a.nbytes, "bytes")
```

Output:

```text
[[ 1  2  3  4]
 [ 5  6  7  8]
 [ 9 10 11 12]]
ndim:  2
shape: (3, 4)
size:  12
dtype: int64
itemsize: 8 bytes
nbytes:   96 bytes
```

```text
              axis 1 (columns) ---->
            +----+----+----+----+
  axis 0    |  1 |  2 |  3 |  4 |
  (rows)    +----+----+----+----+
    |       |  5 |  6 |  7 |  8 |
    v       +----+----+----+----+
            |  9 | 10 | 11 | 12 |
            +----+----+----+----+
  shape = (3, 4): 3 elements along axis 0, 4 along axis 1
```

The `shape` tuple always has `ndim` items, and `size` is the product of the shape. A 1D array of 5 numbers has shape `(5,)` (a one-element tuple), and a single number wrapped in an array has shape `()`.

> **Note:** NumPy operations return NumPy scalar types, not plain Python numbers. `print(a.sum())` shows `78`, but in the REPL `a.sum()` displays as `np.int64(78)`. That is the same value with its NumPy type visible (NumPy 2 changed the display). Use `int(x)`, `float(x)` or `x.item()` when you need a plain Python number, for example for JSON.

## Creating arrays

From Python data, or with helper functions that fill a new array:

```python
import numpy as np

print(np.array([1, 2, 3]))         # from a list
print(np.array([[1, 2], [3, 4]]))  # nested lists -> 2D
print(np.zeros(3))                 # float zeros
print(np.ones((2, 3), dtype=int))  # shape is a tuple
print(np.full((2, 2), 7))          # any fill value
print(np.arange(5))                # like range(), but returns an array
print(np.arange(2, 10, 3))         # start, stop (excluded), step
print(np.linspace(0, 1, 5))        # 5 evenly spaced points, both ends included
print(np.eye(3))                   # identity matrix
```

Output:

```text
[1 2 3]
[[1 2]
 [3 4]]
[0. 0. 0.]
[[1 1 1]
 [1 1 1]]
[[7 7]
 [7 7]]
[0 1 2 3 4]
[2 5 8]
[0.   0.25 0.5  0.75 1.  ]
[[1. 0. 0.]
 [0. 1. 0.]
 [0. 0. 1.]]
```

More helpers worth knowing:

- `np.zeros_like(a)`, `np.ones_like(a)`, `np.full_like(a, v)` create an array with the same shape and dtype as `a`.
- `np.empty(shape)` allocates memory without initializing it, so it contains garbage. It is slightly faster, but only use it when you fill every element yourself.
- `np.identity(n)` is the same as `np.eye(n)`, and `np.eye(n, k=1)` puts ones on a shifted diagonal.

> **Tip:** Prefer `linspace` over `arange` with a float step. Because of floating-point rounding, the number of elements `arange` produces is hard to predict: `np.arange(1, 1.3, 0.1)` gives `[1. 1.1 1.2 1.3]`, four elements, even though `1.3` is the "excluded" stop. `np.linspace(1, 1.2, 3)` says exactly how many points you get.

### Random numbers

Create a **random number generator** with `np.random.default_rng()` and call its methods. Pass a **seed** to get the same "random" numbers on every run, which makes experiments and tests reproducible:

```python
import numpy as np

rng = np.random.default_rng(seed=42)

print(rng.random(3))                                   # floats in [0, 1)
print(rng.integers(1, 7, size=5))                      # dice rolls: 1..6, high is excluded
print(rng.normal(loc=170, scale=10, size=3).round(1))  # normal distribution
print(rng.choice(["red", "green", "blue"], size=4))    # random picks
print(rng.permutation(5))                              # shuffled 0..4
```

Output:

```text
[0.77395605 0.43887844 0.85859792]
[1 5 2 1 4]
[171.3 166.8 169.8]
['blue' 'blue' 'green' 'green']
[1 0 2 4 3]
```

Each call advances the generator, so the next call gives new numbers. Shapes work like everywhere else: `rng.random((2, 3))` returns a 2×3 array.

> **Note:** Old code uses `np.random.seed(0)` and `np.random.rand()`. That legacy API shares one global state across the whole program. New code should create its own `Generator` with `default_rng()`.

## Data types (`dtype`)

Every array has one `dtype`. NumPy infers it from the data, and **upcasts** mixed input to a type that can hold everything:

```python
import numpy as np

ints = np.array([1, 2, 3])
floats = np.array([1.0, 2.5])
mixed = np.array([1, 2.5, 3])           # ints are upcast to float
flags = np.array([True, False])
words = np.array(["NumPy", "is", "fun"])

for arr in (ints, floats, mixed, flags, words):
    print(arr, arr.dtype)
```

Output:

```text
[1 2 3] int64
[1.  2.5] float64
[1.  2.5 3. ] float64
[ True False] bool
['NumPy' 'is' 'fun'] <U5
```

`<U5` means "Unicode strings of up to 5 characters". Common dtypes:

| dtype | Meaning |
|---|---|
| `bool` | `True` / `False` |
| `int8`, `int16`, `int32`, `int64` | signed integers of 1, 2, 4, 8 bytes |
| `uint8` | unsigned 0..255 (pixels in images) |
| `float32`, `float64` | floating-point numbers (`float64` is the default) |
| `complex128` | complex numbers |
| `<U…` | fixed-length Unicode strings |

Choose a dtype on creation with `dtype=`, or convert with `astype()`, which always returns a new array:

```python
import numpy as np

prices = np.array([19.99, 5.5, 3.0])
print(prices.astype(int))                 # truncates toward zero
print(prices.astype(np.float32).dtype)
print(np.array([1, 0, 2]).astype(bool))

small = np.array([120, 125], dtype=np.int8)
print(small + 10)                         # int8 holds only -128..127: it wraps around
print(np.array([7, 8]) / 2)               # true division always gives floats
print(np.array([7, 8]) // 2)              # floor division keeps ints
```

Output:

```text
[19  5  3]
float32
[ True False  True]
[-126 -121]
[3.5 4. ]
[3 4]
```

Integer overflow is **silent** for arrays: `int8` values wrap around instead of growing like Python `int`. Keep the default `int64` unless memory really matters.

## Reshaping

`reshape()` gives the same data a new shape. The total number of elements must stay the same. One dimension can be `-1`, meaning "compute it for me":

```python
import numpy as np

a = np.arange(12)
print(a.reshape(3, 4))
print(a.reshape(2, -1))           # -1 becomes 6
print(a.reshape(2, 3, 2).shape)   # 3D works the same way

try:
    a.reshape(5, 2)
except ValueError as exc:
    print("ValueError:", exc)
```

Output:

```text
[[ 0  1  2  3]
 [ 4  5  6  7]
 [ 8  9 10 11]]
[[ 0  1  2  3  4  5]
 [ 6  7  8  9 10 11]]
(2, 3, 2)
ValueError: cannot reshape array of size 12 into shape (5,2)
```

Elements are read and written in **row-major ("C") order**: the last index changes fastest, so the array is filled row by row.

### Flattening: `ravel()` vs `flatten()`

Both turn any array into 1D. `ravel()` returns a **view** whenever possible (no copying, changes affect the original), `flatten()` always returns a **copy**:

```python
import numpy as np

m = np.arange(6).reshape(2, 3)
flat_view = m.ravel()
flat_copy = m.flatten()

flat_view[0] = 100   # changes m
flat_copy[1] = 200   # does not change m
print(m)
```

Output:

```text
[[100   1   2]
 [  3   4   5]]
```

### Adding and removing axes: `np.newaxis`

A 1D array of shape `(3,)` is neither a row nor a column. Index with `np.newaxis` (an alias of `None`) to insert an axis of length 1. This matters a lot for broadcasting, as you will see later:

```python
import numpy as np

v = np.array([1, 2, 3])
print(v.shape)
print(v[np.newaxis, :].shape)           # row vector
print(v[:, np.newaxis].shape)           # column vector
print(v[:, None].shape)                 # None works the same
print(np.expand_dims(v, axis=0).shape)  # function form
print(np.zeros((1, 3, 1)).squeeze().shape)  # remove all axes of length 1
print(np.arange(6).reshape(2, 3).T.shape)   # .T transposes (swaps the axes)
```

Output:

```text
(3,)
(1, 3)
(3, 1)
(3, 1)
(1, 3)
(3,)
(3, 2)
```

## Indexing and slicing

### One dimension

1D arrays index and slice like lists: `a[i]`, `a[start:stop:step]`, negative indices count from the end.

```python
import numpy as np

a = np.arange(10) ** 2
print(a)
print(a[2], a[-1])
print(a[2:5])
print(a[::3])
print(a[::-1])

a[:3] = 0        # assign one value to a whole slice
print(a)
```

Output:

```text
[ 0  1  4  9 16 25 36 49 64 81]
4 81
[ 4  9 16]
[ 0  9 36 81]
[81 64 49 36 25 16  9  4  1  0]
[ 0  0  0  9 16 25 36 49 64 81]
```

### Two dimensions

Give one index or slice **per axis**, separated by commas, inside one pair of brackets. A missing trailing index means "everything along that axis":

```python
import numpy as np

m = np.array([[1, 2, 3, 4],
              [5, 6, 7, 8],
              [9, 10, 11, 12]])

print(m[1, 3])       # row 1, column 3
print(m[1])          # the whole row 1 (same as m[1, :])
print(m[:, 2])       # the whole column 2
print(m[:2, 1:3])    # rows 0-1, columns 1-2
print(m[::2, ::3])   # every 2nd row, every 3rd column
print(m[-1, -2:])    # last row, last two columns
```

Output:

```text
8
[5 6 7 8]
[ 3  7 11]
[[2 3]
 [6 7]]
[[ 1  4]
 [ 9 12]]
[11 12]
```

```text
m[:2, 1:3]            col 0   col 1   col 2   col 3
               row 0     1   [  2       3  ]    4
               row 1     5   [  6       7  ]    8
               row 2     9     10      11      12
```

`m[1][3]` also works, but it first builds the row `m[1]` and then indexes it. `m[1, 3]` is one step, clearer and faster. Note also that `m[:, 2]` returns a 1D array; use `m[:, 2:3]` if you want to keep it as a `(3, 1)` column.

### Boolean masks

A comparison on an array gives a **boolean array** of the same shape. Use it as an index to keep only the elements where the mask is `True`:

```python
import numpy as np

scores = np.array([72, 45, 90, 38, 66, 85])

passed = scores >= 50
print(passed)
print(scores[passed])
print(scores[(scores >= 50) & (scores < 80)])   # and
print(scores[(scores < 40) | (scores > 85)])    # or
print(scores[~passed])                          # not
print(passed.sum(), "passed;", f"{passed.mean():.0%} of the class")

scores[scores < 50] = 50   # assignment through a mask changes the array
print(scores)
```

Output:

```text
[ True False  True False  True  True]
[72 90 66 85]
[72 66]
[90 38]
[45 38]
4 passed; 67% of the class
[72 50 90 50 66 85]
```

Rules for combining conditions:

- use `&`, `|` and `~`, **not** `and`, `or`, `not`. The keywords try to turn the whole array into one `True`/`False` and raise `ValueError`;
- wrap every comparison in **parentheses**: `&` binds tighter than `<`, so `scores >= 50 & scores < 80` is parsed as `scores >= (50 & scores) < 80` and fails;
- `True` counts as 1, so `mask.sum()` counts matches and `mask.mean()` gives the fraction.

On a 2D array a mask of the same shape returns the selected elements as a **1D** array. `np.nonzero(mask)` returns their indices instead, one array per axis.

### Fancy indexing (integer arrays)

Indexing with a **list or array of integers** picks elements in any order, with repeats allowed. The result takes the shape of the index array:

```python
import numpy as np

a = np.array([10, 20, 30, 40, 50])
print(a[[0, 2, 4]])
print(a[[4, 4, 0]])
print(a[np.array([[0, 1], [3, 4]])])

m = np.arange(12).reshape(3, 4)
print(m[[0, 2]])                   # rows 0 and 2
print(m[:, [3, 0]])                # columns 3 and 0, in this order
print(m[[0, 1, 2], [3, 2, 1]])     # pairs: (0, 3), (1, 2), (2, 1)
print(m[np.ix_([0, 2], [1, 3])])   # rows {0, 2} x columns {1, 3}
```

Output:

```text
[10 30 50]
[50 50 10]
[[10 20]
 [40 50]]
[[ 0  1  2  3]
 [ 8  9 10 11]]
[[ 3  0]
 [ 7  4]
 [11  8]]
[3 6 9]
[[ 1  3]
 [ 9 11]]
```

Two index arrays are **paired element by element**, not combined as "these rows and these columns". For the rectangular "rows × columns" selection use `np.ix_()`.

One trap: with repeated indices, `+=` adds only once, because `a[idx] += 1` means "read, add, write back". Use `np.add.at()` to accumulate:

```python
import numpy as np

counts = np.zeros(4, dtype=int)
counts[[0, 1, 1, 3]] += 1
print(counts)

counts = np.zeros(4, dtype=int)
np.add.at(counts, [0, 1, 1, 3], 1)
print(counts)
```

Output:

```text
[1 1 0 1]
[1 2 0 1]
```

## Views vs copies

Slicing a Python list copies the elements. Slicing a NumPy array does **not**: it creates a **view**, a new array object that looks at the same memory. This avoids copying big data, but changes through the view are visible in the original.

```python
import numpy as np

a = np.arange(6)
view = a[1:4]             # basic slicing -> view
view[0] = 100
print(a)
print(view.base is a, np.shares_memory(a, view))

picked = a[[1, 2, 3]]     # fancy indexing -> copy
picked[0] = -1
print(a)
print(np.shares_memory(a, picked))

safe = a[1:4].copy()      # an explicit, independent copy
safe[:] = 0
print(a)
```

Output:

```text
[  0 100   2   3   4   5]
True True
[  0 100   2   3   4   5]
False
[  0 100   2   3   4   5]
```

| Operation | Result |
|---|---|
| basic slicing: `a[1:4]`, `m[:, 0]`, `m[::2]` | view |
| `reshape()`, `.T`, `ravel()` (when the memory layout allows) | view |
| fancy indexing `a[[0, 2]]`, boolean indexing `a[a > 0]` | copy |
| `flatten()`, `copy()`, `np.array(a)`, `astype()` | copy |
| arithmetic: `a + 1`, `np.sqrt(a)` | new array |

Two more details:

- **Assignment** through fancy or boolean indexing, such as `a[a < 0] = 0`, does modify `a`. The copy only appears when you *read* `a[mask]` into a new name.
- A small view keeps the **whole** original array alive in memory. If you need a small part of a huge temporary array, take `big[:100].copy()` so the big one can be freed.

## Element-wise arithmetic and universal functions

Arithmetic operators work **element by element** on arrays of the same shape and return a new array:

```python
import numpy as np

a = np.array([1, 2, 3, 4])
b = np.array([10, 20, 30, 40])

print(a + b)
print(b - a)
print(a * b)       # element-wise, NOT a matrix product
print(b / a)
print(b // 3, b % 3)
print(a ** 2)
print(a > 2)
print(a == np.array([1, 0, 3, 0]))
```

Output:

```text
[11 22 33 44]
[ 9 18 27 36]
[ 10  40  90 160]
[10. 10. 10. 10.]
[ 3  6 10 13] [1 2 0 1]
[ 1  4  9 16]
[False False  True  True]
[ True False  True False]
```

**Universal functions** (ufuncs) are NumPy functions that apply an operation to every element in compiled code: `np.sqrt`, `np.exp`, `np.log`, `np.sin`, `np.abs`, `np.maximum` and many more. The operators above are ufuncs too: `a + b` calls `np.add(a, b)`.

```python
import numpy as np

x = np.array([1.0, 4.0, 9.0])
print(np.sqrt(x))
print(np.exp([0, 1]))
print(np.log10([1, 10, 1000]))
print(np.round(np.sin(np.pi / np.array([2, 6])), 3))
print(np.abs([-3, 4, -5]))
print(np.maximum([1, 5, 3], [4, 2, 6]))   # pairwise maximum of two arrays
```

Output:

```text
[1. 2. 3.]
[1.         2.71828183]
[0. 1. 3.]
[1.  0.5]
[3 4 5]
[4 5 6]
```

Use the `np.` versions, not the `math` module: `math.sqrt(x)` works only on single numbers and raises `TypeError` for an array.

**In-place operators** (`+=`, `*=` and so on) modify the existing array instead of creating a new one. They cannot change its dtype:

```python
import numpy as np

a = np.array([1, 2, 3])
a *= 10
print(a)

try:
    a += 0.5   # the result would be float, but a is an int64 array
except TypeError as exc:
    print(type(exc).__name__, exc)
```

Output:

```text
[10 20 30]
UFuncTypeError Cannot cast ufunc 'add' output from dtype('float64') to dtype('int64') with casting rule 'same_kind'
```

Division by zero does not raise an exception either. It produces `inf` or `nan` and prints a `RuntimeWarning`:

```python
import numpy as np

with np.errstate(divide="ignore", invalid="ignore"):  # silence the warnings here
    print(np.array([1.0, -1.0, 0.0]) / 0)
```

Output:

```text
[ inf -inf  nan]
```

## Broadcasting

**Broadcasting** is how NumPy combines arrays of **different shapes**. The simplest case is an array and a scalar: `a * 2` multiplies every element. The general rules, applied to two shapes:

1. Line the shapes up **from the right** (the last axes are compared first).
2. If one shape is shorter, pad it with 1s **on the left**.
3. Two sizes along an axis are compatible if they are **equal** or one of them is **1**.
4. An axis of size 1 is **stretched** to match the other size. The data is not copied; NumPy just reuses the same values.

If any pair of sizes is incompatible, you get `ValueError: operands could not be broadcast together`.

```text
Example 1: matrix (3, 4) + row (4,)

   m:     3 x 4
   row:       4   ->  1 x 4   ->  stretched to 3 x 4
   result: 3 x 4

   [[ 0  1  2  3]     [[10 20 30 40]     [[10 21 32 43]
    [ 4  5  6  7]  +   [10 20 30 40]  =   [14 25 36 47]
    [ 8  9 10 11]]     [10 20 30 40]]     [18 29 40 51]]
                        (the same row reused for every row)

Example 2: column (3, 1) + row (4,)

   col:   3 x 1   ->  stretched to 3 x 4
   row:       4   ->  1 x 4  ->  stretched to 3 x 4
   result: 3 x 4  (every combination of a column value and a row value)

Example 3: matrix (3, 4) + vector (3,)

   m:     3 x 4
   v:         3   ->  compare 4 with 3: not equal, neither is 1  ->  ValueError
```

The same examples in code:

```python
import numpy as np

m = np.arange(12).reshape(3, 4)
row = np.array([10, 20, 30, 40])
col = np.array([[100], [200], [300]])

print(m + row)    # (3, 4) + (4,)   -> (3, 4)
print(m + col)    # (3, 4) + (3, 1) -> (3, 4)

a = np.array([1, 2, 3])
b = np.array([10, 20, 30, 40])
print(a[:, np.newaxis] * b)   # (3, 1) * (4,) -> (3, 4): a multiplication table

v = np.array([1, 2, 3])
try:
    m + v
except ValueError as exc:
    print("ValueError:", exc)
print(m + v[:, np.newaxis])   # turn v into a (3, 1) column, and it works
```

Output:

```text
[[10 21 32 43]
 [14 25 36 47]
 [18 29 40 51]]
[[100 101 102 103]
 [204 205 206 207]
 [308 309 310 311]]
[[ 10  20  30  40]
 [ 20  40  60  80]
 [ 30  60  90 120]]
ValueError: operands could not be broadcast together with shapes (3,4) (3,) 
[[ 1  2  3  4]
 [ 6  7  8  9]
 [11 12 13 14]]
```

A typical real use: center every column of a table around zero by subtracting the column means. `data.mean(axis=0)` has shape `(columns,)`, which broadcasts across all rows:

```python
import numpy as np

data = np.array([[1.0, 200.0],
                 [3.0, 400.0],
                 [5.0, 600.0]])

centered = data - data.mean(axis=0)   # (3, 2) - (2,)
print(centered)
```

Output:

```text
[[  -2. -200.]
 [   0.    0.]
 [   2.  200.]]
```

## Aggregations and the `axis` argument

Aggregation functions reduce many values to one: `sum`, `mean`, `min`, `max`, `std`, `var`, `prod`, `median` and others. Without `axis` they use the whole array. With `axis=k` they work **along** axis `k`, and that axis disappears from the result's shape:

```text
                     along axis 1 (across each row) --->    sum(axis=1)
               +---+---+---+---+
    axis 0     | 5 | 3 | 8 | 2 |   --->  18
    (down      | 7 | 1 | 4 | 6 |   --->  18
    each       | 3 | 9 | 2 | 5 |   --->  19
    column)    +---+---+---+---+
       |        15  13  14  13     <---  sum(axis=0)
       v
    shape (3, 4):  sum(axis=0) -> shape (4,),  sum(axis=1) -> shape (3,)
```

```python
import numpy as np

sales = np.array([[5, 3, 8, 2],
                  [7, 1, 4, 6],
                  [3, 9, 2, 5]])   # 3 shops x 4 days

print(sales.sum())
print(sales.sum(axis=0))          # per day (collapses the shops)
print(sales.sum(axis=1))          # per shop (collapses the days)
print(sales.mean(axis=1).round(2))
print(sales.max(axis=0), sales.min())
print(sales.argmax(axis=1))       # index of the best day of each shop
print(sales.std().round(3))
print(sales.cumsum(axis=1))       # running totals along each row
print(sales.sum(axis=1, keepdims=True).shape)
```

Output:

```text
55
[15 13 14 13]
[18 18 19]
[4.5  4.5  4.75]
[7 9 8 6] 1
[2 0 1]
2.431
[[ 5  8 16 18]
 [ 7  8 12 18]
 [ 3 12 14 19]]
(3, 1)
```

Notes:

- `argmax`/`argmin` return **positions**, not values. Without `axis` they return a position in the flattened array. Convert it to `(row, column)` with `np.unravel_index()`:

  ```python
  import numpy as np

  sales = np.array([[5, 3, 8, 2],
                    [7, 1, 4, 6],
                    [3, 9, 2, 5]])
  flat = sales.argmax()
  row, col = np.unravel_index(flat, sales.shape)
  print(flat, row, col)  # 9 2 1
  ```

- `keepdims=True` keeps the reduced axis with length 1. The result then broadcasts back against the original, for example to compute each shop's share of its own total: `sales / sales.sum(axis=1, keepdims=True)`.
- `std()` computes the population standard deviation by default. Pass `ddof=1` for the sample standard deviation, as most statistics textbooks define it.
- Boolean aggregations: `(sales > 8).any()` checks if at least one element is `True`, `(sales > 0).all()` checks if every element is.

## Sorting, `unique`, `where` and `clip`

```python
import numpy as np

a = np.array([3, 1, 4, 1, 5, 9, 2, 6])
print(np.sort(a))          # a sorted copy
print(np.sort(a)[::-1])    # descending order
print(np.argsort(a))       # the indices that would sort a

names = np.array(["Olena", "Ivan", "Maksym"])
ages = np.array([31, 25, 40])
print(names[np.argsort(ages)])   # sort one array by another

m = np.array([[3, 1, 2],
              [9, 7, 8]])
print(np.sort(m))          # sorts each row (axis=-1 by default)

a.sort()                   # the method sorts in place and returns None
print(a)
```

Output:

```text
[1 1 2 3 4 5 6 9]
[9 6 5 4 3 2 1 1]
[1 3 6 0 2 4 7 5]
['Ivan' 'Olena' 'Maksym']
[[1 2 3]
 [7 8 9]]
[1 1 2 3 4 5 6 9]
```

`np.unique()` returns the sorted distinct values and, optionally, how often each appears:

```python
import numpy as np

colors = np.array(["red", "blue", "red", "green", "blue", "red"])
values, counts = np.unique(colors, return_counts=True)
print(values)
print(counts)
print("most common:", values[counts.argmax()])
```

Output:

```text
['blue' 'green' 'red']
[2 1 3]
most common: red
```

`np.where(condition, x, y)` is a vectorized `x if condition else y`. With only the condition it returns the indices where it is `True`. `np.clip()` limits values to a range:

```python
import numpy as np

temps = np.array([-5, 3, 12, -1, 25])
print(np.where(temps < 0, "frost", "ok"))
print(np.where(temps < 0, 0, temps))   # replace negatives with 0
print(np.where(temps < 0))             # indices, one array per axis
print(np.clip(temps, 0, 20))           # below 0 -> 0, above 20 -> 20
```

Output:

```text
['frost' 'ok' 'ok' 'frost' 'ok']
[ 0  3 12  0 25]
(array([0, 3]),)
[ 0  3 12  0 20]
```

## Stacking and splitting

```python
import numpy as np

a = np.array([[1, 2], [3, 4]])
b = np.array([[5, 6], [7, 8]])

print(np.concatenate([a, b]))          # along axis 0 by default
print(np.concatenate([a, b], axis=1))
print(np.vstack([a, b]).shape, np.hstack([a, b]).shape)

x = np.array([1, 2, 3])
y = np.array([4, 5, 6])
print(np.vstack([x, y]))               # 1D arrays become rows
print(np.column_stack([x, y]))         # 1D arrays become columns
print(np.stack([x, y], axis=1).shape)  # stack adds a NEW axis
```

Output:

```text
[[1 2]
 [3 4]
 [5 6]
 [7 8]]
[[1 2 5 6]
 [3 4 7 8]]
(4, 2) (2, 4)
[[1 2 3]
 [4 5 6]]
[[1 4]
 [2 5]
 [3 6]]
(3, 2)
```

- `concatenate(arrays, axis=k)` joins along an **existing** axis. All other axes must match.
- `vstack` stacks vertically (rows), `hstack` horizontally (columns).
- `np.stack` creates a **new** axis: two arrays of shape `(3,)` become `(2, 3)` or `(3, 2)`.

Splitting is the reverse:

```python
import numpy as np

data = np.arange(10)
print(np.split(data, 2))          # 2 equal parts
print(np.split(data, [3, 7]))     # cut before index 3 and before index 7
print(np.array_split(data, 3))    # parts may differ in size

m = np.arange(12).reshape(3, 4)
left, right = np.hsplit(m, 2)     # split the columns in two
print(right)
```

Output:

```text
[array([0, 1, 2, 3, 4]), array([5, 6, 7, 8, 9])]
[array([0, 1, 2]), array([3, 4, 5, 6]), array([7, 8, 9])]
[array([0, 1, 2, 3]), array([4, 5, 6]), array([7, 8, 9])]
[[ 2  3]
 [ 6  7]
 [10 11]]
```

`np.split(data, 3)` would raise `ValueError` because 10 elements cannot be divided into 3 equal parts. Use `array_split` in that case. `np.vsplit` splits along the rows.

## Basic linear algebra

`*` is element-wise. The **matrix product** is the `@` operator (or `np.dot()`, `np.matmul()`):

```python
import numpy as np

A = np.array([[1, 2],
              [3, 4]])
B = np.array([[5, 6],
              [7, 8]])

print(A * B)          # element-wise
print(A @ B)          # matrix product: rows of A times columns of B
print(np.dot(A, B))   # the same
print(A.T)            # transpose
print(A @ np.array([1, 1]))            # matrix times vector
print(np.dot([1, 2, 3], [4, 5, 6]))    # dot product of two vectors
```

Output:

```text
[[ 5 12]
 [21 32]]
[[19 22]
 [43 50]]
[[19 22]
 [43 50]]
[[1 3]
 [2 4]]
[3 7]
32
```

The `np.linalg` module contains the classic algorithms: `inv` (inverse), `det` (determinant), `solve` (systems of linear equations), `eig`, `svd`, `norm` and more. Let us solve this system:

```text
2x +  y =  5
 x - 3y = -1
```

```python
import numpy as np

A = np.array([[2, 1],
              [1, -3]])
b = np.array([5, -1])

x = np.linalg.solve(A, b)
print(x)
print(np.allclose(A @ x, b))   # check: A @ x is (almost) b

A_inv = np.linalg.inv(A)
print(A_inv)
print(A_inv @ b)               # the same answer, but less efficient
print(np.linalg.det(A))
print(np.allclose(A @ A_inv, np.eye(2)))
```

Output:

```text
[2. 1.]
True
[[ 0.42857143  0.14285714]
 [ 0.14285714 -0.28571429]]
[2. 1.]
-7.000000000000001
True
```

So `x = 2`, `y = 1`. Two lessons from this example:

- Prefer `np.linalg.solve(A, b)` over `inv(A) @ b`. It is faster and numerically more accurate.
- Floating-point results carry tiny rounding errors (`-7.000000000000001`). Compare floats with `np.allclose()` or `np.isclose()`, never with `==`.

A singular matrix (determinant 0) has no inverse, and `inv`/`solve` raise `np.linalg.LinAlgError: Singular matrix`.

## Missing values: `nan`

Real data has gaps. NumPy marks a missing float value with `np.nan` ("not a number"). `nan` spreads through calculations: almost any operation with it returns `nan`.

```python
import numpy as np

readings = np.array([21.5, np.nan, 23.0, 22.5, np.nan])

print(readings.mean())                 # one nan spoils the result
print(np.nanmean(readings))            # nan-aware versions skip gaps
print(np.nanmax(readings), np.nansum(readings))
print(np.isnan(readings))
print(np.isnan(readings).sum(), "missing")
print(readings[~np.isnan(readings)])   # drop the gaps
print(np.nan == np.nan)                # nan is not equal even to itself
print(np.where(np.isnan(readings), np.nanmean(readings), readings))
print(np.nan_to_num(readings, nan=0.0))
```

Output:

```text
nan
22.333333333333332
23.0 67.0
[False  True False False  True]
2 missing
[21.5 23.  22.5]
False
[21.5        22.33333333 23.         22.5        22.33333333]
[21.5  0.  23.  22.5  0. ]
```

Things to remember:

- Test for `nan` with `np.isnan()`. `x == np.nan` is **always** `False`.
- `np.nanmean`, `np.nansum`, `np.nanmin`, `np.nanmax`, `np.nanstd`, `np.nanmedian` ignore missing values and accept `axis` like their normal versions.
- `nan` is a float. An integer array cannot hold it: `int_array[0] = np.nan` raises `ValueError: cannot convert float NaN to integer`. Convert to float first.

## Saving and loading arrays

For NumPy's own binary format, use `np.save` / `np.load` (`.npy`, one array) and `np.savez` (`.npz`, several named arrays). These files keep the exact dtype and shape, and they are compact and fast. For text files that people or other programs read, use `np.savetxt` / `np.loadtxt`:

```python
import numpy as np

data = np.arange(6).reshape(2, 3)

np.save("data.npy", data)
loaded = np.load("data.npy")
print(loaded.dtype, loaded.shape)

np.savez("bundle.npz", x=data, y=data * 10)
with np.load("bundle.npz") as bundle:
    print(bundle["y"])

np.savetxt("data.csv", data, delimiter=",", fmt="%d", header="a,b,c")
print(open("data.csv").read())
print(np.loadtxt("data.csv", delimiter=",", dtype=int))
```

Output:

```text
int64 (2, 3)
[[ 0 10 20]
 [30 40 50]]
# a,b,c
0,1,2
3,4,5

[[0 1 2]
 [3 4 5]]
```

`loadtxt` skips lines starting with `#`, so the header written by `savetxt` does not get in the way. For CSV files with mixed column types or missing cells, pandas (`pd.read_csv`) or `np.genfromtxt` are better tools.

## Common mistakes

- **Passing elements as separate arguments.** `np.array(1, 2, 3)` raises `TypeError`. Pass one sequence: `np.array([1, 2, 3])`.

- **Using `and`/`or`/`if` with arrays.** An array has no single truth value:

  ```python
  import numpy as np

  a = np.array([1, 5, 10])
  try:
      if a > 2:
          print("big")
  except ValueError as exc:
      print(exc)
  print((a > 2).any(), (a > 2).all())
  ```

  Output:

  ```text
  The truth value of an array with more than one element is ambiguous. Use a.any() or a.all()
  True False
  ```

  Inside masks use `&`, `|`, `~` and parentheses: `a[(a > 2) & (a < 8)]`.

- **Expecting a slice to be a copy.** `part = a[:3]` is a view: `part[0] = 99` changes `a`. Call `.copy()` when you need independence.

- **Accidental broadcasting between `(n,)` and `(n, 1)`.** Subtracting a column from a 1D array silently builds an `n × n` matrix instead of raising an error:

  ```python
  import numpy as np

  y_true = np.array([[1.0], [2.0], [3.0]])   # shape (3, 1)
  y_pred = np.array([1.5, 2.0, 2.5])         # shape (3,)
  error = y_true - y_pred
  print(error.shape)                          # (3, 3), not (3,)!
  print((y_true.ravel() - y_pred).shape)      # (3,)
  ```

  Output:

  ```text
  (3, 3)
  (3,)
  ```

  Check `.shape` whenever a result looks too big.

- **Silent dtype effects.** Assigning `2.9` into an `int` array stores `2`. `int8` overflows wrap around. `a += 0.5` on an int array raises `UFuncTypeError`. Choose float arrays for measurements.

- **Comparing with `nan` using `==`.** It is always `False`. Use `np.isnan()`.

- **Growing an array in a loop.** `np.append()` and `np.concatenate()` copy the whole array every time, so a loop of `n` appends costs about `n²` operations. Collect values in a Python list and call `np.array(values)` once, or preallocate with `np.zeros(n)` and fill it.

- **Writing Python loops over elements.** `for i in range(len(a)): out[i] = a[i] * 2` throws away NumPy's speed. Look for the vectorized version: `out = a * 2`.

- **Mixing `math` and NumPy.** `math.sqrt(arr)` fails for arrays. Use `np.sqrt(arr)`.

## Summary

- NumPy's `ndarray` stores same-typed values in one memory block, which makes vectorized operations much faster and more compact than Python lists.
- Create arrays with `np.array`, `zeros`, `ones`, `full`, `arange`, `linspace`, `eye`, and random data with `np.random.default_rng(seed)`. Inspect them with `shape`, `ndim`, `size` and `dtype`.
- `reshape` (with `-1`), `ravel`/`flatten`, `.T` and `np.newaxis` change how the same data is arranged.
- Index with one entry per axis (`m[row, col]`), slices, boolean masks (`a[a > 0]`, combined with `&`, `|`, `~`) and integer arrays. Basic slices are **views**, fancy and boolean indexing give **copies**.
- Arithmetic and ufuncs work element by element. Broadcasting aligns shapes from the right and stretches axes of size 1.
- Aggregations take `axis`, and the chosen axis disappears from the result. `keepdims=True` keeps it for broadcasting back.
- `sort`, `argsort`, `unique`, `where`, `clip`, `concatenate`/`vstack`/`hstack`/`split` and `@`/`np.linalg.solve` cover most everyday tasks.
- `nan` marks missing floats: detect it with `np.isnan` and aggregate with `np.nanmean` and friends. Save arrays with `np.save`/`np.load` or `savetxt`/`loadtxt`.

## Practice

### Exercise 1: Slicing practice

Create a 4×5 array with the numbers 1 to 20 (use `arange` and `reshape`). Print:

1. the element in the third row and fourth column;
2. the last column;
3. the 2×3 block made of rows 1–2 and columns 1–3 (0-based);
4. the sum of each row;
5. all even numbers greater than 10.

### Exercise 2: Class results

Generate scores for 5 students and 3 subjects with `rng = np.random.default_rng(12)` and `scores = rng.integers(30, 101, size=(5, 3))`. Compute:

1. each student's average (rounded to 1 decimal);
2. the best score in each subject;
3. the index of the student with the highest average;
4. how many students failed (score below 50) each subject;
5. a "curved" version of the table: add 5 points to every score, but never above 100.

### Exercise 3: Standardize the columns

A table has the height (cm) and weight (kg) of four people:

```python
import numpy as np

data = np.array([[170.0, 65.0],
                 [180.0, 80.0],
                 [160.0, 55.0],
                 [175.0, 72.0]])
```

Compute the **z-score** of each value within its column: `(value - column mean) / column std`. Do it without loops, using broadcasting. Print the result rounded to 2 decimals, then check with `np.allclose` that every column of the result has mean 0 and standard deviation 1.

### Exercise 4: Fill the gaps

A sensor log has 3 sensors (columns) and 5 time points (rows). Some readings are missing:

```python
import numpy as np

log = np.array([[20.0, 30.0, np.nan],
                [21.0, np.nan, 41.0],
                [np.nan, 32.0, 42.0],
                [23.0, 33.0, np.nan],
                [24.0, np.nan, 44.0]])
```

1. Count the missing values in each column.
2. Replace every `nan` with the mean of the **available** values of its own column. Do not change the original array.
3. Print the filled table and the column that has the highest average after filling.

## Solutions

### Exercise 1

```python
import numpy as np

a = np.arange(1, 21).reshape(4, 5)
print(a)
print(a[2, 3])
print(a[:, -1])
print(a[1:3, 1:4])
print(a.sum(axis=1))
print(a[(a % 2 == 0) & (a > 10)])
```

Output:

```text
[[ 1  2  3  4  5]
 [ 6  7  8  9 10]
 [11 12 13 14 15]
 [16 17 18 19 20]]
14
[ 5 10 15 20]
[[ 7  8  9]
 [12 13 14]]
[15 40 65 90]
[12 14 16 18 20]
```

"Third row, fourth column" is `a[2, 3]` because indices start at 0. Each condition in the mask has its own parentheses.

### Exercise 2

```python
import numpy as np

rng = np.random.default_rng(12)
scores = rng.integers(30, 101, size=(5, 3))
print(scores)

averages = scores.mean(axis=1)
print("averages:", averages.round(1))
print("best per subject:", scores.max(axis=0))
print("best student:", averages.argmax())
print("fails per subject:", (scores < 50).sum(axis=0))
print(np.clip(scores + 5, None, 100))
```

Output:

```text
[[73 47 99]
 [97 34 43]
 [44 42 71]
 [54 64 46]
 [97 77 77]]
averages: [73.  58.  52.3 54.7 83.7]
best per subject: [97 77 99]
best student: 4
fails per subject: [1 3 2]
[[ 78  52 100]
 [100  39  48]
 [ 49  47  76]
 [ 59  69  51]
 [100  82  82]]
```

`axis=1` collapses the subjects (one value per student), `axis=0` collapses the students (one value per subject). `scores < 50` is a boolean table, and summing it down the columns counts the `True` values. `np.clip(x, None, 100)` sets only an upper limit.

### Exercise 3

```python
import numpy as np

data = np.array([[170.0, 65.0],
                 [180.0, 80.0],
                 [160.0, 55.0],
                 [175.0, 72.0]])

z = (data - data.mean(axis=0)) / data.std(axis=0)
print(z.round(2))
print(np.allclose(z.mean(axis=0), 0))
print(np.allclose(z.std(axis=0), 1))
```

Output:

```text
[[-0.17 -0.33]
 [ 1.18  1.31]
 [-1.52 -1.41]
 [ 0.51  0.44]]
True
True
```

`data.mean(axis=0)` and `data.std(axis=0)` both have shape `(2,)`. They broadcast against the `(4, 2)` table, so every row is adjusted with the statistics of its own columns. The means come out as tiny numbers like `1e-16` rather than exact zeros, which is why the check uses `np.allclose`.

### Exercise 4

```python
import numpy as np

log = np.array([[20.0, 30.0, np.nan],
                [21.0, np.nan, 41.0],
                [np.nan, 32.0, 42.0],
                [23.0, 33.0, np.nan],
                [24.0, np.nan, 44.0]])

missing = np.isnan(log)
print("missing per column:", missing.sum(axis=0))

col_means = np.nanmean(log, axis=0)      # shape (3,)
filled = np.where(missing, col_means, log)
print(filled.round(2))

best = filled.mean(axis=0).argmax()
print("highest average: column", best, "=", filled.mean(axis=0)[best].round(2))
print("original still has gaps:", np.isnan(log).any())
```

Output:

```text
missing per column: [1 2 2]
[[20.   30.   42.33]
 [21.   31.67 41.  ]
 [22.   32.   42.  ]
 [23.   33.   42.33]
 [24.   31.67 44.  ]]
highest average: column 2 = 42.33
original still has gaps: True
```

`np.where(missing, col_means, log)` broadcasts `col_means` of shape `(3,)` across all 5 rows: wherever the mask is `True`, the column mean is taken, otherwise the original reading. `np.where` always builds a new array, so `log` is untouched.

---

*Sources: [NumPy docs — NumPy: the absolute basics for beginners](https://numpy.org/doc/stable/user/absolute_beginners.html), [NumPy docs — NumPy quickstart](https://numpy.org/doc/stable/user/quickstart.html). Adapted and expanded for PyJourney.*
