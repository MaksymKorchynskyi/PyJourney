# Converting Float to Int

Turning a float such as `20.3` into an integer means deciding what to do with the fractional part: should `20.3` become `20` or `21`, and what about `-20.3`? Python offers several conversions, and they give **different answers for negative numbers**. Picking the wrong one is a classic source of off-by-one bugs.

## What you'll learn

- How `int()` and `math.trunc()` truncate towards zero
- How `math.floor()` rounds down and `math.ceil()` rounds up
- Why the choice matters for negative numbers
- How floor division `//` differs from `math.floor()` in its return type
- Which conversions fail (`inf`, `nan`, numeric strings) and how to handle them
- How floating-point error combined with truncation produces surprising results

## What gets lost in the conversion

An `int` has no fractional part, so converting a float such as `20.3` to an integer drops the `.3`. You decide only *which* neighbouring integer you get. If the float has no fractional part, nothing is lost at all. `float.is_integer()` tells you which case you have:

```python
price = 20.3
print(int(price))

whole = 20.0
print(whole.is_integer(), int(whole))
print(price.is_integer())
```

Output:

```text
20
True 20
False
```

Python provides four ways to pick the integer:

- **truncation**: `int(x)` or `math.trunc(x)`, drops the fractional part (towards zero);
- **floor**: `math.floor(x)`, the largest integer `<= x` (towards negative infinity);
- **ceiling**: `math.ceil(x)`, the smallest integer `>= x` (towards positive infinity);
- **rounding**: `round(x)`, the nearest integer (explained in detail in the Rounding topic).

## Truncation: math.trunc() and int()

`math.trunc(x)` returns the integer part of `x`. It simply ignores everything after the decimal point:

```python
from math import trunc

print(trunc(12.2))
print(trunc(12.5))
print(trunc(12.7))
print(trunc(-12.7))
```

Output:

```text
12
12
12
-12
```

The `int()` constructor does exactly the same with a float:

```python
print(int(12.2))
print(int(12.5))
print(int(12.7))
print(int(-12.7))
```

Output:

```text
12
12
12
-12
```

Truncation always moves **towards zero**: positive numbers go down, negative numbers go up. Note that even `12.7` becomes `12`. `int()` does not round.

## Floor: math.floor()

`math.floor(x)` returns the largest integer less than or equal to `x`. In other words, it always moves **down** the number line:

```python
from math import floor

print(floor(12.2))
print(floor(12.5))
print(floor(12.7))
print(type(floor(12.7)))
```

Output:

```text
12
12
12
<class 'int'>
```

For positive numbers, `floor()` and `trunc()` agree. For negative numbers they do not:

```python
from math import floor, trunc

print(floor(-12.7))
print(trunc(-12.7))
```

Output:

```text
-13
-12
```

On the number line, `floor()` goes left and `trunc()` goes towards zero:

```text
          floor(-12.7)       trunc(-12.7)
               |                  |
     ---------(-13)------x-------(-12)---------------- 0
                       -12.7
                  <- floor    trunc ->
```

## Ceiling: math.ceil()

`math.ceil(x)` returns the smallest integer greater than or equal to `x`. It always moves **up**:

```python
from math import ceil

print(ceil(12.2))
print(ceil(12.7))
print(ceil(12.0))
print(ceil(-12.7))
```

Output:

```text
13
13
12
-12
```

`ceil(12.0)` is `12`, because `12` already is an integer "greater than or equal to" the value. For `-12.7`, moving up means moving towards zero, so the result is `-12`.

```text
     0 ----------------(12)-------x-------(13)---------
                         |       12.7       |
                  floor(12.7) = 12     ceil(12.7) = 13
                  trunc(12.7) = 12
```

## All conversions side by side

```python
import math

print(f"{'x':>6} {'int':>5} {'floor':>6} {'ceil':>5} {'round':>6}")
for x in [12.2, 12.5, 12.7, -12.2, -12.5, -12.7]:
    print(f"{x:>6} {int(x):>5} {math.floor(x):>6} {math.ceil(x):>5} {round(x):>6}")
```

Output:

```text
     x   int  floor  ceil  round
  12.2    12     12    13     12
  12.5    12     12    13     12
  12.7    12     12    13     13
 -12.2   -12    -13   -12    -12
 -12.5   -12    -13   -12    -12
 -12.7   -12    -13   -12    -13
```

| Function | Direction | Typical use |
|---|---|---|
| `int(x)`, `math.trunc(x)` | towards zero | "just drop the fraction", e.g. whole seconds of a duration |
| `math.floor(x)` | towards negative infinity | buckets, grid cells, "how many full units fit" |
| `math.ceil(x)` | towards positive infinity | "how many containers are needed": pages, boxes, buses |
| `round(x)` | to the nearest integer (ties to even) | displaying or approximating a measured value |

Notice `round(12.5)` is `12`, not `13`: Python rounds ties to the nearest *even* integer. The Rounding topic explains why.

## Floor division and the return type

The floor division operator `//` rounds down like `math.floor()`, but it **keeps the float type** when an operand is a float. `math.floor()`, `math.ceil()` and `math.trunc()` always return an `int`:

```python
import math

print(12.7 // 1)          # floor division keeps the float type
print(math.floor(12.7))   # math.floor returns an int
print(int(-7 / 2))        # true division, then truncation
print(-7 // 2)            # floor division
```

Output:

```text
12.0
12
-3
-4
```

The last two lines are a common trap when porting code from C or Java, where integer division truncates. In Python, `//` floors.

### Ceiling division without floats

A frequent task is "how many pages do 101 items need, 10 per page?" `math.ceil(items / per_page)` works, but goes through a float. With integers only, you can negate twice around floor division:

```python
import math

items, per_page = 101, 10
print(math.ceil(items / per_page))
print(-(-items // per_page))   # ceiling division with integers only
```

Output:

```text
11
11
```

`-items // per_page` floors the negative number, which is the same as taking the ceiling of the positive one. The integer version stays exact even for numbers larger than `2**53`, where floats lose precision (see Exercise 2).

## Values that cannot be converted

`inf` and `nan` have no integer equivalent, so the conversion raises an exception. `math.floor()`, `math.ceil()` and `math.trunc()` behave the same way:

```python
for text in ["inf", "nan"]:
    try:
        int(float(text))
    except (OverflowError, ValueError) as error:
        print(type(error).__name__, "-", error)
```

Output:

```text
OverflowError - cannot convert float infinity to integer
ValueError - cannot convert float NaN to integer
```

`int()` accepts a string only if it contains an integer literal. For a string with a decimal point, convert to `float` first:

```python
print(int(float("12.5")))

print(int("12.5"))
```

Output (the second call fails, last line of the traceback shown):

```text
12
ValueError: invalid literal for int() with base 10: '12.5'
```

Large floats convert **exactly**, which reveals the value the float really stores:

```python
print(int(1e20))
print(int(1e23))
```

Output:

```text
100000000000000000000
99999999999999991611392
```

`1e23` cannot be stored exactly as a float, and `int()` shows the nearest representable value.

## Beyond float: other number types

The `math` functions work with any type that implements the matching special method: `math.trunc()` calls `__trunc__()`, `math.floor()` calls `__floor__()`, and `math.ceil()` calls `__ceil__()`. `Fraction` and `Decimal` implement all of them, so you get exact results without going through `float`:

```python
import math
from decimal import Decimal
from fractions import Fraction

print(math.floor(Fraction(-7, 2)))
print(math.ceil(Decimal("2.1")))
print(math.trunc(Decimal("-2.9")))
print(int(Fraction(-7, 2)))
```

Output:

```text
-4
3
-2
-3
```

For your own classes, `int(obj)` calls `__int__()` and falls back to `__index__()`:

```python
class Money:
    def __init__(self, amount):
        self.amount = amount

    def __int__(self):
        return int(self.amount)


print(int(Money(19.99)))
```

Output:

```text
19
```

> **Note:** Older Python versions also let `int()` fall back to `__trunc__()`. That was deprecated in Python 3.11 and removed in Python 3.14. Implement `__int__()` or `__index__()` instead.

## Common mistakes

- **Using `int()` where you need `floor()`.** For negative numbers `int(-0.5)` is `0`, but `math.floor(-0.5)` is `-1`. This breaks bucketing and grid calculations (see Exercise 3).
- **Expecting `int()` to round.** `int(12.7)` is `12`. Use `round()` if you want the nearest integer.
- **Truncating a result that carries floating-point error.** A value that "should" be whole may be slightly below it, and truncation cuts off almost a whole unit:

  ```python
  percent = 0.29 * 100
  print(percent)
  print(int(percent))     # truncation cuts off almost a whole unit
  print(round(percent))   # round to nearest instead
  ```

  Output:

  ```text
  28.999999999999996
  28
  29
  ```

- **Expecting `x // 1` to return an `int`.** With a float operand it returns a float such as `12.0`. Use `math.floor(x)`.
- **Calling `int()` on a decimal string.** `int("12.5")` raises `ValueError`. Use `int(float(text))`, or `Decimal(text)` for exact values.
- **Forgetting `inf` and `nan`.** Data from files and calculations may contain them. Check with `math.isfinite(x)` before converting.

## Summary

- Converting a float to an int drops the fractional part. If `x.is_integer()` is `True`, nothing is lost.
- `int(x)` and `math.trunc(x)` truncate towards zero.
- `math.floor(x)` goes down (towards negative infinity), `math.ceil(x)` goes up (towards positive infinity).
- For positive numbers `floor` and `trunc` agree. For negative numbers they differ by one.
- `math.floor/ceil/trunc` return `int`. `x // 1` returns a float when `x` is a float.
- `-(-a // b)` is exact ceiling division for integers.
- `inf` raises `OverflowError`, `nan` raises `ValueError`, and `int("12.5")` raises `ValueError`.

## Practice

### Exercise 1: Fill in the table

Predict `int(x)`, `math.floor(x)` and `math.ceil(x)` for `x` in `3.99`, `-3.99`, `3.0` and `-0.5`. Then print the values in a loop to check.

### Exercise 2: Pages needed

Write `pages_needed(items, per_page)` that returns how many pages are needed to show `items` items, using only integer arithmetic. Check it against `math.ceil(items / 10)` for `0`, `1`, `10`, `11` and `101` items with 10 per page. Then compare both approaches for `10**20 + 1` items with one item per page.

### Exercise 3: Grid cells

A map is divided into cells 10 units wide: cell `0` covers `[0, 10)`, cell `-1` covers `[-10, 0)`, and so on. Write two functions that compute the cell index of a coordinate `x`, one with `int()` and one with `math.floor()`, and compare them for `25.0`, `5.0`, `-5.0` and `-15.0`. Which one is correct?

### Exercise 4: Prices in cents

A web form sends prices as text, for example `"19.99"`. A colleague wrote `int(float(price_text) * 100)` to get cents. Test it with `"19.99"`, `"0.29"`, `"4.35"` and `"10"`, explain the wrong results, and write a fixed `to_cents(price_text)`.

## Solutions

### Exercise 1

```python
import math

for x in [3.99, -3.99, 3.0, -0.5]:
    print(x, int(x), math.floor(x), math.ceil(x))
```

Output:

```text
3.99 3 3 4
-3.99 -3 -4 -3
3.0 3 3 3
-0.5 0 -1 0
```

`3.0` is already whole, so all three agree. For negative values, `int()` goes up to the integer closer to zero, while `floor()` goes down.

### Exercise 2

```python
import math


def pages_needed(items, per_page):
    return -(-items // per_page)


for items in [0, 1, 10, 11, 101]:
    print(items, pages_needed(items, 10), math.ceil(items / 10))

huge = 10**20 + 1
print(pages_needed(huge, 1) == huge, math.ceil(huge / 1) == huge)
```

Output:

```text
0 0 0
1 1 1
10 1 1
11 2 2
101 11 11
True False
```

For ordinary sizes both approaches agree. For `10**20 + 1`, the division `huge / 1` produces a float, which cannot represent the trailing `+ 1`, so `math.ceil()` returns the wrong number. Integer floor division is exact for any size.

### Exercise 3

```python
import math

CELL_SIZE = 10


def cell_int(x):
    return int(x / CELL_SIZE)


def cell_floor(x):
    return math.floor(x / CELL_SIZE)


for x in [25.0, 5.0, -5.0, -15.0]:
    print(f"{x:>6}: int -> {cell_int(x):>2}, floor -> {cell_floor(x):>2}")
```

Output:

```text
  25.0: int ->  2, floor ->  2
   5.0: int ->  0, floor ->  0
  -5.0: int ->  0, floor -> -1
 -15.0: int -> -1, floor -> -2
```

`math.floor()` is correct. With `int()`, both `5.0` and `-5.0` land in cell `0`, so cell `0` would be 20 units wide (`(-10, 10)`), and every negative cell is shifted by one.

### Exercise 4

```python
def to_cents_naive(price_text):
    return int(float(price_text) * 100)


def to_cents(price_text):
    return round(float(price_text) * 100)


for text in ["19.99", "0.29", "4.35", "10"]:
    print(text, to_cents_naive(text), to_cents(text))
```

Output:

```text
19.99 1998 1999
0.29 28 29
4.35 434 435
10 1000 1000
```

`19.99 * 100` is `1998.9999999999998` as a float, and `int()` truncates it to `1998`. `round()` picks the nearest integer, which is the intended cent value. For financial code, `Decimal(price_text) * 100` avoids binary floats completely (see the Decimal topic).

---

*Source: [pythontutorial.net — How To Convert a Float to an Int in Python](https://www.pythontutorial.net/advanced-python/python-float-to-int/). Adapted and expanded for PyJourney.*
