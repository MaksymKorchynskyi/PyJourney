# Float

Python uses the `float` type for real numbers such as `3.14` or `1.5e-5`. Floats are fast and cover a huge range, but they are stored in **binary** with a fixed number of bits. Most decimal fractions, even simple ones like `0.1`, cannot be stored exactly. Knowing why explains results such as `0.1 + 0.1 + 0.1 != 0.3` and shows how to compare floats safely.

## What you'll learn

- How a float is stored: sign, exponent and fraction in 64 bits
- The precision and range limits of floats, and how to inspect them
- Why `0.1` is only approximated, and how to see the value that is really stored
- How `float()` creates floats from numbers, strings and custom objects
- The special values `inf`, `nan` and `-0.0`
- How to compare floats with `math.isclose()` and reduce rounding errors

## The float type

A float literal contains a decimal point or an exponent. Division with `/` always produces a float:

```python
print(type(3.14))
print(1.5e-5)      # scientific notation: 1.5 x 10**-5
print(2e3)
print(1_000.5)     # underscores for readability
print(.5, 5.)      # leading/trailing digits may be omitted
print(7 / 2)       # true division always returns a float
print(4 / 2)
```

Output:

```text
<class 'float'>
1.5e-05
2000.0
1000.5
0.5 5.0
3.5
2.0
```

CPython implements `float` with the C `double` type, which on virtually every platform is the **IEEE 754 double-precision** format, also called *binary64*. Unlike `int`, which grows as large as memory allows, a float value always occupies exactly **64 bits (8 bytes)**.

## How a float is stored

The 64 bits are split into three fields:

```text
  1 bit      11 bits             52 bits
+------+--------------+-----------------------------+
| sign |   exponent   |      fraction (mantissa)    |
+------+--------------+-----------------------------+

value = (-1)**sign  *  1.fraction (in binary)  *  2**(exponent - 1023)
```

- **Sign** (1 bit): `0` for positive, `1` for negative.
- **Exponent** (11 bits): a power of **two**, not ten. For ordinary ("normal") numbers it ranges from `-1022` to `1023`. Writing `1.5e-5` in your code is just decimal notation; Python converts it to the nearest binary value `m * 2**e`.
- **Fraction** (52 bits): the binary digits after the point. A leading `1.` is implied and not stored, so a float effectively has **53 significant bits**, which is about **15–17 significant decimal digits**.

*Significant digits* are the digits of a number without leading and trailing zeros: `0.25` has two, `0.125` has three, `12.25` has four. A float can hold about 15–17 of them; anything beyond that is rounded away.

The limits are available in `sys.float_info`:

```python
import sys

info = sys.float_info
print(info.max)
print(info.min)
print(info.epsilon)
print(info.mant_dig)
print(info.dig)
```

Output:

```text
1.7976931348623157e+308
2.2250738585072014e-308
2.220446049250313e-16
53
15
```

`max` is the largest finite float and `min` the smallest positive *normal* float (smaller "subnormal" values exist, with reduced precision). `epsilon` is the gap between `1.0` and the next float. `mant_dig` is the 53 bits of precision, and `dig` is the number of decimal digits that always survive a round trip (15).

### Which numbers are exact in binary?

A binary fraction is a sum of powers of two. Some decimal numbers can be written that way with a few bits:

```text
(1.25)10 = 1*2**0 + 0*2**-1 + 1*2**-2 = (1.01)2
```

Others cannot. `0.1` in binary is a repeating fraction, just like `1/3 = 0.333...` in decimal:

```text
(0.1)10 = (0.0001100110011001100110011...)2     "0011" repeats forever
```

A float must cut this infinite pattern at 53 significant bits and round it, so it stores a value that is very close to `0.1` but not equal to it. In general, a fraction is exact in binary only if its denominator (in lowest terms) is a power of two: `0.5`, `0.25`, `0.375` are exact; `0.1`, `0.2`, `0.3` are not.

`float.hex()` and `float.as_integer_ratio()` reveal the stored bits:

```python
print((1.25).hex())
print((0.1).hex())
print((0.1).as_integer_ratio())
print(2**55)
```

Output:

```text
0x1.4000000000000p+0
0x1.999999999999ap-4
(3602879701896397, 36028797018963968)
36028797018963968
```

`1.25` is a short, clean hexadecimal fraction. `0.1` shows the repeating pattern `999...` rounded up to `a` at the end, and it is really stored as the fraction `3602879701896397 / 2**55`.

## The value that is really stored

When you print a float, Python shows the **shortest** decimal string that converts back to exactly the same float (Python 3.1+). That is why `0.1` prints as `0.1`, even though the stored value is slightly different. To see more digits, format with a fixed precision. To see the stored value **exactly**, convert it to `Decimal`:

```python
from decimal import Decimal

x = 0.1
print(x)
print(repr(x))
print(format(x, ".20f"))
print(Decimal(x))
```

Output:

```text
0.1
0.1
0.10000000000000000555
0.1000000000000000055511151231257827021181583404541015625
```

Note that the stored value has a **finite** number of decimal digits. Every binary fraction can be written exactly in decimal (because 2 divides 10); it is only the other direction that fails. The error comes from rounding `0.1` to the nearest binary fraction, not from an infinite expansion of the stored value.

## Creating floats with float()

The `float()` constructor converts numbers and strings to floats:

```python
print(float(0.1))
print(float("1.25"))
print(float("  -1e3 \n"))
print(float("1_000.5"))
print(float(7))
print(float())
print(float("inf"), float("-Infinity"), float("nan"))
```

Output:

```text
0.1
1.25
-1000.0
1000.5
7.0
0.0
inf -inf nan
```

Strings may contain surrounding whitespace, an exponent, underscores between digits, and the special names `inf`, `infinity` and `nan` in any letter case. Without an argument, `float()` returns `0.0`. A string that is not a number raises `ValueError`:

```python
print(float("abc"))
```

Output (last line of the traceback):

```text
ValueError: could not convert string to float: 'abc'
```

For other objects, `float(obj)` calls `obj.__float__()`. If the class has no `__float__()`, Python falls back to `__index__()` (Python 3.8+), the method that integer-like objects implement:

```python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    def __float__(self):
        return float(self.celsius)


class Port:
    def __init__(self, number):
        self.number = number

    def __index__(self):
        return self.number


print(float(Temperature(21.5)))
print(float(Port(8080)))
```

Output:

```text
21.5
8080.0
```

Python 3.14 adds the class method `float.from_number()`. It works like `float()` but accepts only numbers, never strings, which is useful when a string would indicate a bug:

```python
print(float.from_number(3))
print(float.from_number(2.5))

try:
    float.from_number("1.5")
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
3.0
2.5
TypeError: must be real number, not str
```

## Special values: inf, nan and -0.0

IEEE 754 defines a few special values, and Python supports them all:

```python
import math

inf = float("inf")
nan = float("nan")

print(inf + 1, -inf * 2, inf - inf)
print(1e308 * 10)
print(nan == nan, nan != nan)
print(math.isnan(nan), math.isinf(inf), math.isfinite(1.5))
print(-0.0 == 0.0, math.copysign(1, -0.0))
```

Output:

```text
inf -inf nan
inf
False True
True True True
True -1.0
```

- `inf` is larger than every finite number. Multiplication that overflows produces `inf` (`1e308 * 10`).
- `nan` ("not a number") is the result of undefined operations such as `inf - inf`. It is **not equal to anything, including itself**, so test it with `math.isnan()`, never with `==`.
- `-0.0` exists and equals `0.0`, but keeps its sign (visible through `math.copysign()`).

Some operations raise `OverflowError` instead of returning `inf`. Exponentiation is one of them:

```python
print(10.0 ** 400)
```

Output (last line of the traceback):

```text
OverflowError: (34, 'Result too large')
```

Converting an integer that is too large for a float (`float(2**1024)`) also raises `OverflowError`. And integers above `2**53` lose precision when converted, because the 53 bits are not enough:

```python
big = 2**53 + 1
print(big)
print(float(big))
print(float(big) == 2**53)
```

Output:

```text
9007199254740993
9007199254740992.0
True
```

## Equality testing

Because many values are approximations, arithmetic can produce results that differ from the "obvious" answer in the last bits:

```python
x = 0.1 + 0.1 + 0.1
y = 0.3

print(x == y)
print(x, y)
print(format(x, ".20f"))
print(format(y, ".20f"))
```

Output:

```text
False
0.30000000000000004 0.3
0.30000000000000004441
0.29999999999999998890
```

Each `0.1` is slightly above one tenth, and the additions round again. The result lands on a different float than the one nearest to `0.3`.

### Rounding before comparing (fragile)

One workaround is to round both sides to a fixed number of decimal places:

```python
x = 0.1 + 0.1 + 0.1
y = 0.3
print(round(x, 3) == round(y, 3))

a = 1.0049999999
b = 1.0050000001
print(round(a, 2), round(b, 2), round(a, 2) == round(b, 2))
```

Output:

```text
True
1.0 1.01 False
```

The second case shows why it is fragile: two numbers that differ by only `0.0000000002` fall on different sides of a rounding boundary and compare as unequal.

### math.isclose(): the reliable way

[PEP 485](https://peps.python.org/pep-0485/) (Python 3.5) added `math.isclose()`, which checks whether two numbers are close **relative to their size**:

```text
math.isclose(a, b, *, rel_tol=1e-09, abs_tol=0.0)

True if  abs(a - b) <= max(rel_tol * max(abs(a), abs(b)), abs_tol)
```

`rel_tol` is the allowed relative difference (by default `1e-09`, about nine matching significant digits), and `abs_tol` is a minimum absolute tolerance. Both are keyword-only arguments.

```python
from math import isclose

x = 0.1 + 0.1 + 0.1
y = 0.3

print(isclose(x, y))
print(isclose(1.0049999999, 1.0050000001))
print(isclose(1000.0, 1000.1))
print(isclose(1000.0, 1000.1, rel_tol=1e-3))
```

Output:

```text
True
True
False
True
```

There is one important trap. A **relative** tolerance is useless when one side is zero, since "nine digits of zero" is still zero. When you compare against `0.0`, pass an `abs_tol`:

```python
from math import isclose

tiny = 0.1 + 0.2 - 0.3
print(tiny)
print(isclose(tiny, 0.0))
print(isclose(tiny, 0.0, abs_tol=1e-9))
```

Output:

```text
5.551115123125783e-17
False
True
```

## Reducing accumulated errors

Rounding errors add up when you combine many floats. Python offers several tools:

```python
import math
from fractions import Fraction

total = 0.0
for _ in range(10):
    total += 0.1
print(total)

print(sum([0.1] * 10))          # compensated summation since Python 3.12
print(math.fsum([0.1] * 10))    # correctly rounded sum

print(Fraction(1, 10) * 3 == Fraction(3, 10))
print(Fraction("0.1") + Fraction("0.2"))
```

Output:

```text
0.9999999999999999
1.0
1.0
True
3/10
```

- A plain loop with `+=` accumulates an error at every step.
- Since **Python 3.12**, the built-in `sum()` uses compensated (Neumaier) summation for floats, which keeps most of the lost precision. On older versions `sum([0.1] * 10)` also gives `0.9999999999999999`.
- `math.fsum()` returns the correctly rounded sum on every version.
- `fractions.Fraction` stores exact rational numbers. Create it from a string or two integers, not from a float.
- For money and other decimal quantities, use integers (cents) or `decimal.Decimal` (see the Decimal topic).

## Common mistakes

- **Comparing computed floats with `==`.** Use `math.isclose()`, and add `abs_tol` when one side may be zero.
- **Using floats for money.** `0.1 + 0.2` is `0.30000000000000004`. Store amounts in cents (`int`) or use `Decimal`.
- **Testing for `nan` with `==`.** `x == float("nan")` is always `False`. Use `math.isnan(x)`.
- **Believing `print()` shows the exact value.** It shows the shortest string that round-trips. Use `Decimal(x)` or `format(x, ".20f")` to look closer.
- **Converting large integers to float.** Above `2**53`, not every integer has a float representation, so `float(2**53 + 1)` silently becomes `2**53`. Keep large integers as `int`.
- **Assuming the exponent is decimal.** `1.5e-5` is only how you *write* the number; inside, it is stored as a binary fraction times a power of two.

## Summary

- `float` is a 64-bit IEEE 754 binary floating-point number: 1 sign bit, 11 exponent bits (a power of two) and 52 fraction bits plus an implicit leading 1.
- That gives 53 significant bits, about 15–17 significant decimal digits, and a range up to about `1.8e308` (`sys.float_info`).
- Only fractions with a power-of-two denominator are exact. `0.1`, `0.2` and `0.3` are stored approximately.
- `print()` shows the shortest round-tripping string. `Decimal(x)` shows the exact stored value.
- `float()` accepts numbers, numeric strings, `"inf"`/`"nan"` and objects with `__float__()` or `__index__()`. `float.from_number()` (3.14+) accepts numbers only.
- `nan` is not equal to itself. Use `math.isnan()`, `math.isinf()` and `math.isfinite()`.
- Compare floats with `math.isclose()`. Use `math.fsum()`, `Fraction`, `Decimal` or integers when accuracy matters.

## Practice

### Exercise 1: Exact or not?

Predict whether each line prints `True` or `False`, then run the code. For each result, explain which numbers are exact in binary.

```python
print(0.1 + 0.2 == 0.3)
print(0.5 + 0.25 == 0.75)
print(1e16 + 1 == 1e16)
print(float("nan") == float("nan"))
print(0.1 * 3 == 0.3 * 1)
print(2.0 ** 0.5 * 2.0 ** 0.5 == 2.0)
```

### Exercise 2: Where integers stop being exact

Write a loop that finds the smallest `k` for which `float(2**k) + 1 == float(2**k)`, that is, the point where adding one to a float no longer changes it. Print `k` and `2**k`. Relate the answer to `sys.float_info.mant_dig`.

### Exercise 3: Adding up prices

Ten items cost `0.10` each. Compute the total three ways: with a `for` loop and `+=`, with `math.fsum()`, and with integer cents. Print each result and whether it equals one dollar.

### Exercise 4: Write your own isclose()

Implement `is_close(a, b, rel_tol=1e-9, abs_tol=0.0)` using the formula from PEP 485, without importing `math` inside it. Then check that it agrees with `math.isclose()` for these pairs: `(0.1 + 0.2, 0.3)`, `(1000.0, 1000.1)`, `(1000.0, 1000.1)` with `rel_tol=1e-3`, `(1e-12, 0.0)`, and `(1e-12, 0.0)` with `abs_tol=1e-9`.

## Solutions

### Exercise 1

Output:

```text
False
True
True
False
False
False
```

- `0.1`, `0.2` and `0.3` are approximations, and the rounding errors do not cancel.
- `0.5`, `0.25` and `0.75` are sums of powers of two, so they are exact and the sum is exact.
- Near `1e16` the gap between neighbouring floats is `2.0`, so adding `1` rounds back to `1e16`.
- `nan` is never equal to anything.
- `0.1 * 3` is `0.30000000000000004`, while `0.3 * 1` is the float nearest to `0.3`.
- `2.0 ** 0.5` is a rounded value of the square root, and squaring it gives `2.0000000000000004`.

### Exercise 2

```python
k = 0
while float(2**k) + 1 != float(2**k):
    k += 1

print(k)
print(2**k)
print(float(2**k) + 1)
```

Output:

```text
53
9007199254740992
9007199254740992.0
```

A float has 53 significant bits (`sys.float_info.mant_dig`). Above `2**53`, the gap between neighbouring floats is `2`, so `+ 1` falls exactly halfway and is rounded back (ties go to the even neighbour).

### Exercise 3

```python
import math

prices = [0.10] * 10

total = 0.0
for price in prices:
    total += price
print(total, total == 1.0)

print(math.fsum(prices), math.fsum(prices) == 1.0)

cents = [10] * 10
total_cents = sum(cents)
print(total_cents, f"{total_cents // 100}.{total_cents % 100:02}")
```

Output:

```text
0.9999999999999999 False
1.0 True
100 1.00
```

The loop accumulates error. `math.fsum()` rounds only once, at the end. Integer cents avoid floating-point error completely; you convert to dollars only for display.

### Exercise 4

```python
import math


def is_close(a, b, rel_tol=1e-9, abs_tol=0.0):
    return abs(a - b) <= max(rel_tol * max(abs(a), abs(b)), abs_tol)


pairs = [
    (0.1 + 0.2, 0.3, {}),
    (1000.0, 1000.1, {}),
    (1000.0, 1000.1, {"rel_tol": 1e-3}),
    (1e-12, 0.0, {}),
    (1e-12, 0.0, {"abs_tol": 1e-9}),
]
for a, b, options in pairs:
    mine = is_close(a, b, **options)
    print(mine, mine == math.isclose(a, b, **options))
```

Output:

```text
True True
False True
True True
False True
True True
```

The first column is the result of `is_close()`, the second confirms it matches `math.isclose()`. The real `math.isclose()` additionally validates that tolerances are non-negative and handles `inf` and `nan` specially.

---

*Source: [pythontutorial.net — An Essential Guide to Python float Type By Examples](https://www.pythontutorial.net/advanced-python/python-float/). Adapted and expanded for PyJourney.*
