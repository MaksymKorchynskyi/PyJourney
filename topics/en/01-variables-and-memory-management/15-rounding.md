# Rounding

Rounding replaces a number with a simpler one that is close to it: `89` rounded to the nearest ten is `90`, and `3.14159` rounded to two decimals is `3.14`. Python's built-in `round()` does this, but it follows two rules that surprise many people: ties go to the **even** neighbour (`round(2.5)` is `2`), and it rounds the **exact binary value** of a float (`round(2.675, 2)` is `2.67`). Once you know why, you can pick the right tool for each job.

## What you'll learn

- How `round(number, ndigits)` works and what type it returns
- What positive, zero and negative `ndigits` mean
- Why ties are rounded to the even neighbour, and why that reduces bias
- Why some floats seem to round "wrong", and how to see what is really stored
- How to round half away from zero correctly, and why `int(x + 0.5)` is fragile
- When to round, and how rounding for display differs from rounding in calculations

## The round() function

```text
round(number, ndigits=None)
```

`round()` returns `number` rounded to the **closest multiple of `10 ** -ndigits`**. With `ndigits=2` that is the closest multiple of `0.01`, with `ndigits=0` the closest multiple of `1`, and with `ndigits=-1` the closest multiple of `10`. If `ndigits` is omitted or `None`, the result is the nearest integer:

```python
print(round(1.25))
print(round(1.25, None))
print(round(1.25, 0))
print(round(3.14159, 2))
print(round(-2.7))
```

Output:

```text
1
1
1.0
3.14
-3
```

Note the difference between the first and third lines. Both round to a whole number, but the type differs.

### The return type

- Without `ndigits` (or with `None`), `round()` returns an `int`.
- With `ndigits`, even `0`, it returns the **same type** as `number`: a `float` for a float, an `int` for an int, a `Decimal` for a `Decimal`, a `Fraction` for a `Fraction`.

```python
from decimal import Decimal
from fractions import Fraction

print(type(round(2.7)), type(round(2.7, 0)), type(round(2.7, 1)))
print(round(1234, 2), type(round(1234, 2)))
print(round(Decimal("2.675"), 2))
print(round(Fraction(7, 3), 2))
print(round(Fraction(7, 3)))
```

Output:

```text
<class 'int'> <class 'float'> <class 'float'>
1234 <class 'int'>
2.68
233/100
2
```

Behind the scenes `round(x, n)` calls `type(x).__round__(x, n)`. That is how `Decimal` and `Fraction` round exactly in their own representation, and how your own classes can support `round()`. A type without `__round__()` is rejected:

```python
print(round("2.5"))
```

Output (last line of the traceback):

```text
TypeError: type str doesn't define __round__ method
```

### Negative ndigits

A negative `ndigits` rounds to tens, hundreds, thousands and so on:

```python
print(round(15.5, -1))
print(round(1234, -2))
print(round(1_234_567, -3))
print(round(1250, -2))
print(round(1350, -2))
```

Output:

```text
20.0
1200
1235000
1200
1400
```

With `ndigits=-1`, `15.5` lies between the multiples of ten `10` and `20`, and it is closer to `20`. The result is `20.0`, a float, because the input was a float. The last two lines are ties, exactly halfway between two hundreds, which leads to the next rule.

## Ties: round half to even

When a number is exactly halfway between two candidates, there is no "closest" one. Python then picks the candidate whose last digit is **even**. This is called **round half to even**, or **banker's rounding**:

```python
for x in [0.5, 1.5, 2.5, 3.5, 4.5, -0.5, -1.5, -2.5]:
    print(f"round({x}) = {round(x)}")
```

Output:

```text
round(0.5) = 0
round(1.5) = 2
round(2.5) = 2
round(3.5) = 4
round(4.5) = 4
round(-0.5) = 0
round(-1.5) = -2
round(-2.5) = -2
```

Only exact ties are affected. `2.51` still rounds to `3`, and `2.49` to `2`. The same rule applies at any position: `round(1250, -2)` is `1200` because the hundreds digit `2` is even, and `round(1350, -2)` is `1400` because `4` is even.

### Why ties go to even

The rule you probably learned at school, "halves always round up", has a hidden **bias**: every tie moves the value up, so when you round many numbers, the total drifts upward. Round half to even sends half of the ties up and half down, so the errors cancel out on average. That is why it is the default rounding mode of the IEEE 754 floating-point standard and of the `decimal` module, and why it is used in statistics and accounting.

```python
import math


def half_up(x):        # ties always go up; fine for positive numbers
    return math.floor(x + 0.5)


values = [1.5, 2.5, 3.5]
print(sum(values) / len(values))
print(sum(round(v) for v in values) / len(values))
print(sum(half_up(v) for v in values) / len(values))

values = [i + 0.5 for i in range(10)]    # 0.5, 1.5, ..., 9.5
print(sum(values))
print(sum(round(v) for v in values))
print(sum(half_up(v) for v in values))
```

Output:

```text
2.5
2.6666666666666665
3.0
50.0
50
55
```

| Number | Half to even | Half up |
|---|---|---|
| 1.5 | 2 | 2 |
| 2.5 | 2 | 3 |
| 3.5 | 4 | 4 |
| **Average** (exact: 2.5) | 2.666... | 3.0 |

The true average of `1.5`, `2.5` and `3.5` is `2.5`. Rounding half up gives `3.0`, off by `0.5`. Half to even gives `2.67`, much closer. With the ten values `0.5 ... 9.5`, half to even preserves the exact total of `50`, while half up overshoots by `5`.

## Floats that seem to round wrong

Look at these results:

```python
print(round(1.25, 1))
print(round(1.35, 1))
print(round(1.15, 1))
print(round(2.675, 2))
```

Output:

```text
1.2
1.4
1.1
2.67
```

`1.25 -> 1.2` is the half-to-even rule. But `1.35 -> 1.4` is **not** a tie broken towards even, and `1.15 -> 1.1` and `2.675 -> 2.67` look like plain mistakes. The explanation is that most decimal fractions cannot be stored exactly as binary floats (see the topic Float). `round()` works with the value that is **really stored**, and `Decimal(x)` shows it:

```python
from decimal import Decimal

for x in [1.25, 1.35, 1.15, 2.675]:
    print(f"{x:<6} is stored as {Decimal(x)}")
```

Output:

```text
1.25   is stored as 1.25
1.35   is stored as 1.350000000000000088817841970012523233890533447265625
1.15   is stored as 1.149999999999999911182158029987476766109466552734375
2.675  is stored as 2.67499999999999982236431605997495353221893310546875
```

- `1.25` is a sum of powers of two, so it is stored exactly. It is a real tie, and half to even gives `1.2`.
- `1.35` is stored slightly **above** the midpoint, so it rounds up. No tie is involved.
- `1.15` and `2.675` are stored slightly **below** the midpoint, so they round down.

`round()` is not broken here. It gives the correctly rounded result for the number the computer actually has. When you need decimal rounding that matches pen and paper, work with `Decimal` values created from strings (see the topic Decimal).

## Rounding for display

Often you round only to *show* a number. Format specifications such as `:.2f` round in exactly the same way as `round()` (half to even, applied to the stored value), but return a string with a fixed number of decimals:

```python
price = 2.675
print(round(price, 2))
print(f"{price:.2f}")
print(f"{2.5:.0f} {3.5:.0f}")

total = 3.0
print(round(total, 2))
print(f"{total:.2f}")
print(f"{1234567.891:,.2f}")
```

Output:

```text
2.67
2.67
2 4
3.0
3.00
1,234,567.89
```

`round(3.0, 2)` returns the float `3.0`, and a float does not remember how many decimals you wanted. For output, use formatting: it keeps trailing zeros and can add thousands separators.

### Round at the end, not in the middle

Every rounding step throws information away. If you round intermediate results, the errors pile up:

```python
price = 1 / 3
print(round(price, 2) * 3)      # round first, then compute
print(round(price * 3, 2))      # compute, then round once
```

Output:

```text
0.99
1.0
```

Keep full precision during a calculation and round once, when you store or show the final result.

## Special values

With `ndigits`, infinities and NaN pass through unchanged. Without `ndigits`, `round()` must produce an `int`, which is impossible:

```python
print(round(float("inf"), 2), round(float("nan"), 2))
print(round(float("inf")))
```

Output (the last call fails, last line of the traceback shown):

```text
inf nan
OverflowError: cannot convert float infinity to integer
```

`round(float("nan"))` raises `ValueError: cannot convert float NaN to integer` in the same way.

## Rounding half away from zero

Sometimes a specification, a tax rule or a user expects school rounding: ties move **away from zero** (`2.5 -> 3`, `-2.5 -> -3`). Python has no built-in function for this. A common trick is to add `0.5` and truncate with `int()`:

```python
print(int(1.2 + 0.5))
print(int(1.5 + 0.5))
print(int(-1.2 + 0.5))
print(int(-1.5 + 0.5))
```

Output:

```text
1
2
0
-1
```

It works for positive numbers but not for negative ones: `-1.2` should give `-1`, and `-1.5` should give `-2`. Because `int()` truncates towards zero, negative numbers need `0.5` **subtracted**:

```python
print(int(-1.2 - 0.5))
print(int(-1.5 - 0.5))
```

Output:

```text
-1
-2
```

`math.copysign(x, y)` returns the magnitude of `x` with the sign of `y`, so `copysign(0.5, x)` is `0.5` for positive `x` and `-0.5` for negative `x`. That gives a version without an `if`:

```python
from math import copysign


def round_half_away(x):
    return int(x + copysign(0.5, x))


for x in [1.2, 1.5, 2.5, -1.2, -1.5, -2.5]:
    print(x, round_half_away(x), round(x))
```

Output:

```text
1.2 1 1
1.5 2 2
2.5 3 2
-1.2 -1 -1
-1.5 -2 -2
-2.5 -3 -2
```

The third column shows the built-in `round()` for comparison: the two differ only on the ties `2.5` and `-2.5`.

### Why adding 0.5 is fragile

`x + 0.5` is itself a floating-point operation, and its result is rounded. For some inputs that hidden rounding changes the answer:

```python
from math import copysign


def round_half_away(x):
    return int(x + copysign(0.5, x))


x = 0.49999999999999994      # the largest float below 0.5
print(x + 0.5)
print(round_half_away(x))
print(round(x))

y = 4503599627370497.0       # 2**52 + 1, already a whole number
print(round_half_away(y))
print(round(y))
```

Output:

```text
1.0
1
0
4503599627370498
4503599627370497
```

`0.49999999999999994 + 0.5` is not representable and rounds to `1.0`, so a number below one half becomes `1`. Above `2**52`, floats are spaced one apart, so adding `0.5` creates a tie that rounds to an even neighbour, and a whole number changes. The built-in `round()` handles both correctly.

### A reliable version with decimal

The `decimal` module implements the rounding modes exactly. Its `ROUND_HALF_UP` mode means "nearest, ties **away from zero**" (despite the name, `-2.5` becomes `-3`). `Decimal.quantize()` rounds to the exponent of its argument, so `Decimal("0.01")` means "two decimal places":

```python
from decimal import Decimal, ROUND_HALF_UP


def round_half_away(x, ndigits=0):
    quantum = Decimal(10) ** -ndigits          # 1, 0.1, 0.01, ...
    rounded = Decimal(repr(x)).quantize(quantum, rounding=ROUND_HALF_UP)
    return int(rounded) if ndigits == 0 else float(rounded)


for x in [2.5, -2.5, 0.5, 0.49999999999999994, 4503599627370497.0]:
    print(x, "->", round_half_away(x))

print(round_half_away(2.675, 2), round(2.675, 2))
print(round_half_away(1.25, 1), round(1.25, 1))
```

Output:

```text
2.5 -> 3
-2.5 -> -3
0.5 -> 1
0.49999999999999994 -> 0
4503599627370497.0 -> 4503599627370497
2.68 2.67
1.3 1.2
```

`Decimal(repr(x))` builds the decimal from the float's shortest string, `"2.675"`, rather than from its exact binary value `2.67499999...`. So this function rounds the number *as written*, which is usually what a person expects. Use `Decimal(x)` instead if you want to round the exact stored value. For money, the best option is to avoid floats altogether and keep amounts as `Decimal` from the start.

## Choosing a rounding tool

| Tool | Rule | Returns |
|---|---|---|
| `round(x)` | nearest, ties to even | `int` |
| `round(x, n)` | nearest multiple of `10 ** -n`, ties to even | same type as `x` |
| `math.floor(x)` | down, towards negative infinity | `int` |
| `math.ceil(x)` | up, towards positive infinity | `int` |
| `math.trunc(x)`, `int(x)` | towards zero | `int` |
| `f"{x:.2f}"` | nearest, ties to even | `str` |
| `Decimal.quantize(q, rounding=...)` | any of the `decimal` rounding modes | `Decimal` |

`floor`, `ceil` and `trunc` are covered in the topic Converting Float to Int, and the `decimal` rounding modes in the topic Decimal.

## Common mistakes

- **Expecting `round(2.5)` to be `3`.** Python rounds ties to even, so it is `2`. Use `Decimal` with `ROUND_HALF_UP` if you need school rounding.
- **Expecting `round(2.675, 2)` to be `2.68`.** The float is stored as `2.67499999...`. Use `Decimal("2.675")` for exact decimal values.
- **Confusing `round(x)` with `round(x, 0)`.** The first returns an `int`, the second a `float` (for a float input).
- **Using `round()` to format output.** `round(3.0, 2)` is `3.0`, not `3.00`. Use `f"{x:.2f}"`.
- **Rounding intermediate results.** Rounding at every step accumulates error. Round once at the end.
- **Using `int(x + 0.5)`.** It is wrong for negative numbers and fails on edge cases even for positive ones.
- **Comparing rounded floats for equality.** Two values that differ by a hair can round differently. Compare floats with `math.isclose()` (see the topic Float).

## Summary

- `round(x)` returns the nearest `int`. `round(x, n)` returns the nearest multiple of `10 ** -n` with the same type as `x`.
- `n` can be negative: `round(1234, -2)` is `1200`.
- Exact ties go to the even neighbour (banker's rounding), which keeps sums and averages unbiased.
- Floats are rounded by their exact binary value, so `round(2.675, 2)` is `2.67`. Inspect the stored value with `Decimal(x)`.
- Format specs like `:.2f` round the same way and are the right tool for display.
- Round once, at the end of a calculation.
- For ties away from zero, use `Decimal.quantize()` with `ROUND_HALF_UP`. Avoid `int(x + 0.5)`.

## Practice

### Exercise 1: Predict the output

Write down what each line prints, then run the code and explain each result.

```python
print(round(0.5))
print(round(1.5))
print(round(-2.5))
print(round(7.0))
print(round(7.0, 0))
print(round(2.675, 2))
print(round(0.125, 2))
print(round(1250, -2))
print(round(1251, -2))
```

### Exercise 2: Percentages that add up to 100

A poll got the votes `[1, 1, 1]`. Rounding each share separately gives `33%`, `33%` and `33%`, which adds up to `99%`. For `[1, 2, 2, 2]` it gives `101%`. Write `round_percentages(counts)` that returns whole percentages that always add up to exactly `100`, using the **largest remainder method**: round every share down, then give the missing points, one each, to the shares with the largest fractional parts (on equal remainders, to the earlier position). Use only integer arithmetic. Compare your result with naive rounding for `[1, 1, 1]`, `[1, 2, 2, 2]` and `[2, 3, 5]`.

### Exercise 3: Cash rounding

In some countries cash totals are rounded to the nearest `0.05`. A colleague wrote `round(amount / 0.05) * 0.05`. Test it with `0.16`, `0.33`, `1.38`, `2.12` and `9.99`, explain the strange output, and write a `cash_round(amount)` that returns clean values such as `0.15`.

### Exercise 4: Half away from zero without decimal

Write `round_half_away(x)` that rounds a float to the nearest integer with ties away from zero, using only `math.floor()` and float arithmetic, so that it is correct for `0.49999999999999994`, `-0.49999999999999994` and `4503599627370497.0` too. Check it against a reference built with `Decimal(x).quantize(Decimal(1), rounding=ROUND_HALF_UP)` on those values, on all halves from `-100` to `100`, and on 100,000 random floats.

Hint: work with `abs(x)`. For a non-negative float `m`, the subtraction `m - math.floor(m)` is always exact.

## Solutions

### Exercise 1

Output:

```text
0
2
-2
7
7.0
2.67
0.12
1200
1300
```

- `0.5`, `1.5` and `-2.5` are exact ties, so they go to the even neighbour: `0`, `2`, `-2`.
- `round(7.0)` returns an `int`, while `round(7.0, 0)` returns a `float`.
- `2.675` is stored slightly below the midpoint, so it rounds down.
- `0.125` is exact in binary (one eighth), so it is a real tie, and the even neighbour is `0.12`.
- `1250` is a tie between `1200` and `1300`, and `2` is even. `1251` is past the midpoint, so it rounds up.

### Exercise 2

```python
def round_percentages(counts):
    total = sum(counts)
    result = []
    leftovers = []
    for i, count in enumerate(counts):
        whole, rest = divmod(count * 100, total)
        result.append(whole)
        leftovers.append((-rest, i))    # largest remainder first, then by position
    missing = 100 - sum(result)
    for _, i in sorted(leftovers)[:missing]:
        result[i] += 1
    return result


for counts in [[1, 1, 1], [1, 2, 2, 2], [2, 3, 5]]:
    naive = [round(c * 100 / sum(counts)) for c in counts]
    fixed = round_percentages(counts)
    print(counts, naive, sum(naive), fixed, sum(fixed))
```

Output:

```text
[1, 1, 1] [33, 33, 33] 99 [34, 33, 33] 100
[1, 2, 2, 2] [14, 29, 29, 29] 101 [14, 29, 29, 28] 100
[2, 3, 5] [20, 30, 50] 100 [20, 30, 50] 100
```

`divmod(count * 100, total)` gives the rounded-down percentage and the remainder in exact integers, with no floats involved. Rounding down loses less than one point per item, so at most `len(counts) - 1` points are missing, and they go to the items that were closest to the next whole percent. Storing `-rest` makes an ascending sort put the largest remainders first and break ties by position.

### Exercise 3

```python
def cash_round_naive(amount):
    return round(amount / 0.05) * 0.05


def cash_round(amount):
    return round(amount * 20) / 20


for amount in [0.16, 0.33, 1.38, 2.12, 9.99]:
    print(amount, cash_round_naive(amount), cash_round(amount))
```

Output:

```text
0.16 0.15000000000000002 0.15
0.33 0.35000000000000003 0.35
1.38 1.4000000000000001 1.4
2.12 2.1 2.1
9.99 10.0 10.0
```

The naive version computes the right count of nickels (`round(0.16 / 0.05)` is `3`), but then multiplies by `0.05`, which is not exact in binary, so `3 * 0.05` lands next to `0.15` instead of on it. Dividing the integer count by `20` is a single correctly rounded operation, so the result is the float nearest to the exact multiple and prints cleanly. For real money, keep amounts in integer cents or `Decimal`.

### Exercise 4

```python
import math
import random
from decimal import Decimal, ROUND_HALF_UP


def round_half_away(x):
    m = abs(x)
    n = math.floor(m)
    if m - n >= 0.5:      # m - n is exact for a non-negative float m
        n += 1
    return n if x >= 0 else -n


def reference(x):
    return int(Decimal(x).quantize(Decimal(1), rounding=ROUND_HALF_UP))


tricky = [2.5, -2.5, 0.5, -0.5, 1.2, -1.7,
          0.49999999999999994, -0.49999999999999994, 4503599627370497.0]
for x in tricky:
    print(x, round_half_away(x), reference(x))

random.seed(1)
samples = [random.uniform(-1000, 1000) for _ in range(100_000)]
samples += [k / 2 for k in range(-200, 201)]    # many exact ties
print(all(round_half_away(x) == reference(x) for x in samples))
```

Output:

```text
2.5 3 3
-2.5 -3 -3
0.5 1 1
-0.5 -1 -1
1.2 1 1
-1.7 -2 -2
0.49999999999999994 0 0
-0.49999999999999994 0 0
4503599627370497.0 4503599627370497 4503599627370497
True
```

Nothing is added to `x`, so no hidden rounding can push it across the midpoint. The fractional part `m - n` of a non-negative float is computed exactly, and comparing it with `0.5` decides the result. Working with `abs(x)` matters: for `x = -0.49999999999999994`, `math.floor(x)` is `-1`, and `x - (-1)` is not exact. It rounds to `0.5` and would produce `-1` instead of `0`.

---

*Source: [pythontutorial.net — Python Rounding](https://www.pythontutorial.net/advanced-python/python-rounding/). Adapted and expanded for PyJourney.*
