# Floor Division

The `//` operator divides two numbers and rounds the result **down** to a whole number. It is the natural tool whenever you need "how many whole times does this fit": list indexes, pages, buckets, digits. Its behaviour with negative numbers differs from C, Java and JavaScript, so it pays to know exactly what "down" means.

## What you'll learn

- How `//` differs from true division `/` and how it pairs with `%`
- What the floor of a number is, especially for negative numbers
- Why `-10 // 3` is `-4` and not `-3`, and how floor division differs from truncation
- What type `//` returns for `int`, `float`, `bool`, `Fraction` and `Decimal` operands
- Why `a // b` is safer than `math.floor(a / b)`
- Everyday uses: middle index, digits, pages, buckets, rounding down to a multiple

## Two kinds of division

Python has two division operators:

- `/` is **true division**. It always returns a `float`, with the fractional part.
- `//` is **floor division**. It returns only the whole part of the quotient, rounded down.

The remainder that is left over comes from the modulo operator `%`:

```python
print(101 / 4)
print(101 // 4)
print(101 % 4)
print(4 * (101 // 4) + 101 % 4 == 101)
```

Output:

```text
25.25
25
1
True
```

In school terms: 101 divided by 4 is 25 with remainder 1. The number being divided (`101`) is the **dividend** (or numerator), and the number you divide by (`4`) is the **divisor** (or denominator). In Python, `//` and `%` always satisfy this identity for any dividend `N` and non-zero divisor `D`:

```text
N == D * (N // D) + (N % D)

101 == 4 * (101 // 4) + (101 % 4)
101 == 4 * 25         + 1
```

`//` is sometimes called "div" and `%` "mod". This topic focuses on `//`. The topic Modulo covers `%` in detail.

## The floor of a number

To understand `//`, you first need the **floor** of a real number: the largest integer that is less than or equal to it. Picture the number line: the floor is the nearest integer on the **left** (or the number itself, if it is already whole).

```python
from math import floor

print(floor(3.4), floor(3.9), floor(3))
print(floor(-3.4), floor(-3.9), floor(-3))
```

Output:

```text
3 3 3
-4 -4 -3
```

For positive numbers the floor simply drops the fractional part. For negative numbers it does **not**: `-3.4` lies between `-4` and `-3`, and the integer to its left is `-4`.

```text
   floor(-3.4)          floor(3.4)
       |                    |
  ----(-4)--x--(-3)----0----(3)--x--(4)----
          -3.4                  3.4
```

Floor division is defined through the floor of the exact quotient:

```text
N // D == floor(N / D)      (with N / D taken as the exact mathematical value)
```

## Floor division with negative numbers

As long as the quotient is positive, `//` gives the result you would expect from school. With mixed signs, remember that the result is rounded **down**, towards negative infinity:

```python
a = 10
b = 3
print(a // b)

a = -10
b = -3
print(a // b)

a = 10
b = -3
print(a // b)

a = -10
b = 3
print(a // b)
```

Output:

```text
3
3
-4
-4
```

| a | b | a / b | a // b |
|---|---|---|---|
| 10 | 3 | 3.333... | 3 |
| -10 | -3 | 3.333... | 3 |
| 10 | -3 | -3.333... | -4 |
| -10 | 3 | -3.333... | -4 |

### Floor division is not truncation

**Truncation** drops the fractional part, which moves the value **towards zero**. Floor division moves it **down**. The two agree whenever the exact quotient is zero or positive (or already whole), and differ by one when it is negative and not whole:

```python
import math

for a, b in [(10, 3), (-10, -3), (10, -3), (-10, 3)]:
    print(f"{a:>3} / {b:>2} = {a / b:>7.4f}   "
          f"// -> {a // b:>2}   trunc -> {math.trunc(a / b):>2}")
```

Output:

```text
 10 /  3 =  3.3333   // ->  3   trunc ->  3
-10 / -3 =  3.3333   // ->  3   trunc ->  3
 10 / -3 = -3.3333   // -> -4   trunc -> -3
-10 /  3 = -3.3333   // -> -4   trunc -> -3
```

C, C++, Java and C# truncate integer division (and JavaScript code usually emulates it with `Math.trunc(a / b)`), so in those languages `-10 / 3` is `-3`. Python chose floor semantics on purpose: together with `%` it guarantees that `n % d` is never negative for a positive `d`, which makes wrap-around arithmetic (clock hours, circular indexes) work without special cases. Keep this in mind when porting algorithms between languages.

### Precedence

`//` has the same precedence as `*`, `/` and `%`, and operators of that group are evaluated left to right. The unary minus binds **tighter**, so `-7 // 2` means `(-7) // 2`:

```python
print(-7 // 2)      # (-7) // 2
print(-(7 // 2))    # minus applied after the division
print(100 // 10 // 3)
print(2 + 7 // 2 * 3)
```

Output:

```text
-4
-3
3
11
```

`100 // 10 // 3` is `(100 // 10) // 3 = 10 // 3 = 3`, and `2 + 7 // 2 * 3` is `2 + (3 * 3) = 11`.

## The result type

`//` rounds the **value** down, but it does not always return an `int`. The type follows the usual numeric rules:

```python
from decimal import Decimal
from fractions import Fraction

print(7 // 2, type(7 // 2))
print(7.0 // 2, type(7.0 // 2))
print(7 // 2.5)
print(-7.5 // 2)
print(True // 1)
print(10**30 // 7)
print(Fraction(7, 2) // 1, type(Fraction(7, 2) // 1))
print(Decimal("-7") // Decimal("2"))
```

Output:

```text
3 <class 'int'>
3.0 <class 'float'>
2.0
-4.0
1
142857142857142857142857142857
3 <class 'int'>
-3
```

- Two integers give an `int`, and the result is **exact** no matter how large the numbers are.
- If either operand is a `float`, the result is a whole-valued `float` such as `3.0`. Use `math.floor(x)` if you need an `int`.
- `bool` is a subclass of `int`, so `True // 1` is `1`.
- `Fraction // Fraction` returns an `int`.
- `Decimal` is the exception to the floor rule: `Decimal("-7") // Decimal("2")` **truncates** to `-3`. The topic Decimal explains why.

## `//`, `%` and `divmod()`

`//` and `%` are two halves of one operation. When you need both, the built-in `divmod()` returns them as a tuple:

```python
print(divmod(101, 4))
print(divmod(-101, 4))

q, r = divmod(-101, 4)
print(4 * q + r)
```

Output:

```text
(25, 1)
(-26, 3)
-101
```

With a negative dividend the quotient is rounded down to `-26`, so the remainder must be positive (`3`) to keep the identity true. See the topic Modulo for the sign rules of `%`.

## `//` versus `math.floor(a / b)`

You can also compute the floor of a quotient with `math.floor()`. For small integers both approaches give the same result, including negative numbers:

```python
from math import floor

a = 10
b = 3
print(a // b)
print(floor(a / b))

a = 10
b = -3
print(a // b)
print(floor(a / b))
```

Output:

```text
3
3
-4
-4
```

They are **not** equivalent in general, though. `math.floor()` takes a single number, so `floor(a / b)` first performs true division, which produces a `float` and rounds the quotient to the nearest float. Only then does it take the floor. That intermediate rounding causes two problems:

```python
import math

big = 10**17 + 1
print(big // 3)
print(math.floor(big / 3))

print(1 // 0.1)
print(1 / 0.1)
print(math.floor(1 / 0.1))
```

Output:

```text
33333333333333333
33333333333333332
9.0
10.0
10
```

- **Large integers.** A float has only 53 significant bits (about 15–17 decimal digits), so `big / 3` cannot hold the exact quotient, and the last digit is wrong. `big // 3` works with exact integers.
- **Floats with inexact values.** The float `0.1` is really slightly *larger* than one tenth (see the topic Float). The exact quotient `1 / 0.1000000000000000055...` is `9.99999999999999944...`, so its floor is `9`. True division rounds that quotient to `10.0`, and `math.floor()` then sees a whole number. `//` follows the exact values of its operands, which is consistent with `%`: `1 % 0.1` is `0.09999999999999995`.

Rule of thumb: for integers, always use `//`. Use `math.floor()` when you need to floor a single value, or when you need an `int` result from a float.

## Edge cases: zero and infinity

Floor division by zero raises an exception, for integers and floats alike:

```python
print(5 // 0.0)
```

Output (last line of the traceback, Python 3.14):

```text
ZeroDivisionError: division by zero
```

Infinities follow the IEEE 754 rules and can produce surprising results:

```python
inf = float("inf")
print(inf // 1)
print(1 // inf)
print(-1 // inf)
```

Output:

```text
nan
0.0
-1.0
```

`-1 // inf` is `-1.0`: the quotient is a negative number just below zero, and the floor of any number between `-1` and `0` is `-1`. `inf // 1` has no meaningful whole-number answer, so it is `nan`.

## Practical examples

### The middle of a list and binary search

An index must be an `int`, so the middle position is `len(items) // 2`. Binary search computes the midpoint the same way:

```python
def binary_search(items, target):
    lo, hi = 0, len(items) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if items[mid] == target:
            return mid
        if items[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1


scores = [12, 25, 31, 47, 58, 63, 79, 85]
print(scores[len(scores) // 2])
print(binary_search(scores, 63))
print(binary_search(scores, 50))
```

Output:

```text
58
5
-1
```

Python integers never overflow, so `(lo + hi) // 2` is safe. In C or Java the sum can overflow, which is why you see `lo + (hi - lo) / 2` there.

### Peeling off digits

`n // 10` removes the last decimal digit, and `n % 10` returns it:

```python
n = 2026
digits = []
while n > 0:
    digits.append(n % 10)
    n //= 10
print(digits)
print(sum(digits))
```

Output:

```text
[6, 2, 0, 2]
10
```

`n //= 10` is the augmented assignment form: it computes `n // 10` and rebinds `n` to the result.

### Which page is an item on?

With zero-based indexes, the page number of an item is the index floor-divided by the page size:

```python
PER_PAGE = 10

for index in [0, 9, 10, 25, 99]:
    print(f"item {index:>2} -> page {index // PER_PAGE}")
```

Output:

```text
item  0 -> page 0
item  9 -> page 0
item 10 -> page 1
item 25 -> page 2
item 99 -> page 9
```

The opposite question, "how many pages do I need?", requires rounding **up**. The topic Converting Float to Int shows the integer-only trick `-(-items // per_page)`.

### Rounding down to a multiple

`x // step * step` rounds `x` down to the nearest multiple of `step`. This is how you group values into buckets:

```python
for age in [7, 19, 30, 45, 99]:
    start = age // 10 * 10
    print(f"{age} -> {start}-{start + 9}")

for temp in [12.5, 3.0, -0.5, -7.2]:
    print(temp, "->", temp // 5 * 5)
```

Output:

```text
7 -> 0-9
19 -> 10-19
30 -> 30-39
45 -> 40-49
99 -> 90-99
12.5 -> 10.0
3.0 -> 0.0
-0.5 -> -5.0
-7.2 -> -10.0
```

Thanks to floor semantics, negative values land in the correct bucket: `-0.5` belongs to `[-5, 0)`, not to `[0, 5)`. With truncation, every bucket around zero would be twice as wide.

### Supporting `//` in your own classes

`a // b` calls `a.__floordiv__(b)`. If that returns `NotImplemented`, Python tries `b.__rfloordiv__(a)`. `a //= b` calls `__ifloordiv__()` if it exists and otherwise falls back to `__floordiv__()`:

```python
class Money:
    def __init__(self, cents):
        self.cents = cents

    def __floordiv__(self, other):
        if isinstance(other, int):
            return Money(self.cents // other)    # split into equal parts
        if isinstance(other, Money):
            return self.cents // other.cents     # how many times it fits
        return NotImplemented

    def __repr__(self):
        return f"Money({self.cents})"


budget = Money(1000)
print(budget // 3)
print(budget // Money(300))

budget //= 4          # falls back to __floordiv__ and rebinds the name
print(budget)
```

Output:

```text
Money(333)
3
Money(250)
```

## Common mistakes

- **Expecting truncation.** Code ported from C, Java or JavaScript assumes `-7 / 2` is `-3`. In Python `-7 // 2` is `-4`. If you really need truncation for integers, see Exercise 3.
- **Expecting `//` to return an `int`.** `7.0 // 2` is `3.0`. Wrap it in `int()` or use `math.floor()` when an `int` is required.
- **Using `/` for indexes.** True division always returns a float, and lists reject float indexes:

  ```python
  scores = [12, 25, 31, 47, 58]
  print(scores[len(scores) / 2])
  ```

  Output (last line of the traceback):

  ```text
  TypeError: list indices must be integers or slices, not float
  ```

- **Using `math.floor(a / b)` or `int(a / b)` with large integers.** The float in the middle loses digits. `a // b` is exact.
- **Forgetting precedence.** `-a // b` floors the negative number. If you mean "floor, then negate", write `-(a // b)`.
- **Floor-dividing inexact floats.** `1 // 0.1` is `9.0`, not `10.0`. Work with integers (for example cents) or `Decimal` when exact decimal results matter.

## Summary

- `/` is true division and always returns a float. `//` is floor division: it rounds the quotient down, towards negative infinity.
- `N == D * (N // D) + (N % D)` always holds, and `divmod(N, D)` returns `(N // D, N % D)`.
- For a non-negative quotient `//` equals truncation. For a negative quotient it is one less: `-10 // 3` is `-4`.
- Two `int` operands give an exact `int`. Any `float` operand gives a whole-valued `float`. `Decimal` truncates instead of flooring.
- `a // b` is exact for integers of any size, while `math.floor(a / b)` goes through a float and can be wrong.
- Unary minus binds tighter than `//`: `-7 // 2 == (-7) // 2`.
- Typical uses: middle index, digit extraction, page numbers, bucketing with `x // step * step`.

## Practice

### Exercise 1: Predict the output

Write down what each line prints, then run the code and explain every result.

```python
print(17 // 5)
print(-17 // 5)
print(17 // -5)
print(-(17 // 5))
print(17.0 // 5)
print(-1 // 10)
print(7 // 2 * 2 + 7 % 2)
```

### Exercise 2: Reverse a number

Write `reverse_number(n)` that reverses the decimal digits of a non-negative integer using only `//` and `%` (or `divmod()`), without converting to a string. `reverse_number(2026)` should return `6202`. Test it with `2026`, `1200`, `7` and `0`.

### Exercise 3: C-style division

Write `trunc_div(a, b)` that divides two integers and rounds the quotient **towards zero**, as C and Java do, using only integer operations. Check that it matches `int(a / b)` for all `a` from `-50` to `50` and all non-zero `b` from `-7` to `7`. Then compare `trunc_div(-big, 3)` with `int(-big / 3)` for `big = 10**20 + 1`.

### Exercise 4: Time slots

A calendar shows the day in 15-minute slots. Write `slot_start(minute_of_day, slot=15)` that takes the number of minutes since midnight (`0` to `1439`) and returns the start of its slot as `"HH:MM"`. For example, minute `754` (12:34) belongs to the slot `"12:30"`. Test it with `0`, `14`, `15`, `754` and `1439`, and with `slot=60` for minute `754`.

## Solutions

### Exercise 1

Output:

```text
3
-4
-4
-3
3.0
-1
7
```

- `17 / 5` is `3.4`, and its floor is `3`.
- `-17 / 5` is `-3.4`, rounded down to `-4`.
- `17 / -5` is also `-3.4`, so the result is `-4` as well.
- The parentheses compute `17 // 5 = 3` first, then negate it.
- A float operand gives a float result: `3.0`.
- `-1 / 10` is `-0.1`, and the integer just below it is `-1`.
- `7 // 2 * 2 + 7 % 2` is `3 * 2 + 1`, which rebuilds `7`. This is the identity `D * (N // D) + N % D == N`.

### Exercise 2

```python
def reverse_number(n):
    result = 0
    while n > 0:
        n, digit = divmod(n, 10)
        result = result * 10 + digit
    return result


for n in [2026, 1200, 7, 0]:
    print(n, "->", reverse_number(n))
```

Output:

```text
2026 -> 6202
1200 -> 21
7 -> 7
0 -> 0
```

Each step takes the last digit off `n` and appends it to `result`. Trailing zeros of `1200` become leading zeros of the reversed number, which an integer does not keep, so the result is `21`.

### Exercise 3

```python
def trunc_div(a, b):
    q = abs(a) // abs(b)
    return q if (a < 0) == (b < 0) else -q


ok = all(
    trunc_div(a, b) == int(a / b)
    for a in range(-50, 51)
    for b in range(-7, 8)
    if b != 0
)
print(ok)

print(trunc_div(-7, 2), -7 // 2)

big = 10**20 + 1
print(trunc_div(-big, 3))
print(int(-big / 3))
```

Output:

```text
True
-3 -4
-33333333333333333333
-33333333333333331968
```

Dividing the absolute values gives a non-negative quotient, where floor and truncation agree. The sign is then restored: the result is negative only when exactly one operand is negative. `int(a / b)` gives the same answers for small numbers, but for `10**20 + 1` the float in the middle has lost the last digits, while `trunc_div()` stays exact.

### Exercise 4

```python
def slot_start(minute_of_day, slot=15):
    start = minute_of_day // slot * slot
    hours, minutes = divmod(start, 60)
    return f"{hours:02}:{minutes:02}"


for minute in [0, 14, 15, 754, 1439]:
    print(minute, "->", slot_start(minute))
print(slot_start(754, slot=60))
```

Output:

```text
0 -> 00:00
14 -> 00:00
15 -> 00:15
754 -> 12:30
1439 -> 23:45
12:00
```

`minute_of_day // slot * slot` rounds the minute down to a multiple of the slot length (`754 -> 750`), and `divmod(750, 60)` splits it into `12` hours and `30` minutes.

---

*Source: [pythontutorial.net — Python Floor Division](https://www.pythontutorial.net/advanced-python/python-floor-division/). Adapted and expanded for PyJourney.*
