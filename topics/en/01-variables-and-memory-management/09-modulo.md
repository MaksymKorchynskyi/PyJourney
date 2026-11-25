# Modulo

The modulo operator `%` gives you what is left over after division. It looks trivial, but Python defines it in a specific way that differs from C, Java and JavaScript when negative numbers are involved. That definition is what makes `%` so handy for wrapping around clocks, calendars and list indexes.

## What you'll learn

- The identity that ties `%` to floor division `//`
- Why `-16 % 5` is `4` in Python, and how the sign of the result is chosen
- How to get the quotient and the remainder at once with `divmod()`
- How `%` behaves with floats, and when to use `math.fmod()` instead
- Practical patterns: even/odd checks, wrap-around arithmetic, unit conversion, "every N-th item"

## The modulo operator and its defining identity

Python uses the percent sign `%` as the modulo operator. For any numbers `N` (the dividend) and `D` (the divisor, not zero), Python guarantees this identity:

```text
N == D * (N // D) + (N % D)
```

Here `//` is floor division: it divides and rounds the result **down** (towards negative infinity). The modulo is defined as "whatever is left after floor division", so the two operators always work as a pair.

When both numbers are positive, this is the ordinary school remainder:

```python
a = 16
b = 5

m = a % b
f = a // b

print(f"{a} % {b} = {m}")
print(f"{a} // {b} = {f}")
print(b * (a // b) + a % b == a)
```

Output:

```text
16 % 5 = 1
16 // 5 = 3
True
```

The identity is easy to check by hand:

```text
16 = 5 * (16 // 5) + (16 % 5)
16 = 5 * 3         + 1
```

## Negative numbers: the sign follows the divisor

With negative numbers, "remainder" becomes ambiguous, and different languages make different choices. Python sticks to the identity above:

```python
a = -16
b = 5

m = a % b
f = a // b

print(f"{a} % {b} = {m}")
print(f"{a} // {b} = {f}")
print(b * (a // b) + a % b == a)
```

Output:

```text
-16 % 5 = 4
-16 // 5 = -4
True
```

`-16 / 5` is `-3.2`. Floor division rounds it **down** to `-4` (not up to `-3`). To get back to `-16` from `5 * -4 = -20`, you have to add `4`. So the remainder is `4`:

```text
-16 = 5 * (-16 // 5) + (-16 % 5)
-16 = 5 * (-4)       + 4
```

On a number line, `%` measures the distance from the multiple of `D` just **below** `N` (for a positive `D`):

```text
  -20        -16        -15        -10
   |----------x----------|----------|
   5 * (-4)   N
   <-- 4 --->
```

Here are all four sign combinations:

```python
for n, d in [(16, 5), (-16, 5), (16, -5), (-16, -5)]:
    print(f"{n:>3} // {d:>2} = {n // d:>2}    {n:>3} % {d:>2} = {n % d:>2}")
```

Output:

```text
 16 //  5 =  3     16 %  5 =  1
-16 //  5 = -4    -16 %  5 =  4
 16 // -5 = -4     16 % -5 = -4
-16 // -5 =  3    -16 % -5 = -1
```

The rule to remember: **the result of `N % D` is either zero or has the same sign as `D`**, and its absolute value is smaller than `abs(D)`. With a positive divisor you always get a value in the range `0 ... D-1`, no matter how negative `N` is. That is exactly what you want for indexes and clock arithmetic.

### Why Python differs from C, Java and JavaScript

C, Java, C# and JavaScript truncate the quotient towards zero, so in those languages `-16 % 5` is `-1` (the sign follows the dividend). Python chose floor semantics because the result is more useful: `x % 24` is a valid hour and `i % len(items)` is a valid index even when `x` or `i` is negative.

If you need the C-style result (for example, when porting an algorithm), use `math.fmod()`. It always returns a float whose sign follows the dividend:

```python
import math

print(-16 % 5)
print(math.fmod(-16, 5))
print(math.fmod(16, -5))
```

Output:

```text
4
-1.0
1.0
```

## divmod(): quotient and remainder in one call

You often need both `N // D` and `N % D`. The built-in `divmod()` returns them as a tuple `(quotient, remainder)` and follows the same identity:

```python
print(divmod(16, 5))
print(divmod(-16, 5))

minutes, seconds = divmod(150, 60)
print(minutes, seconds)
```

Output:

```text
(3, 1)
(-4, 4)
2 30
```

Tuple unpacking makes `divmod()` very readable: "150 seconds is 2 minutes and 30 seconds".

## Modulo with floats

`%` also works with floats and obeys the same sign rule:

```python
print(7.5 % 2)
print(-7.5 % 2)
print(divmod(7.5, 2))
print(0.3 % 0.1)
```

Output:

```text
1.5
0.5
(3.0, 1.5)
0.09999999999999998
```

The last line is the surprise. `0.3` and `0.1` cannot be stored exactly in binary, and the stored value of `0.3` is a tiny bit *less* than three times the stored `0.1`. So `0.3 // 0.1` is `2.0`, and almost a whole `0.1` is left over. The Float topic explains why this happens. The practical lesson: avoid testing float divisibility with `x % y == 0`. Work with integers (for example, cents instead of dollars) or use `decimal.Decimal`.

## Practical examples

### Checking whether a number is even or odd

A number is even when dividing it by 2 leaves nothing:

```python
def is_even(num):
    return num % 2 == 0


def is_odd(num):
    return num % 2 != 0


for n in [4, 7, 0, -3, -8]:
    print(n, is_even(n), is_odd(n), n % 2)
```

Output:

```text
4 True False 0
7 False True 1
0 True False 0
-3 False True 1
-8 True False 0
```

Note that `-3 % 2` is `1` in Python, so even `num % 2 == 1` works for negative numbers. In C or Java it would be `-1`. Writing `!= 0` is the habit that is safe in every language.

### Wrapping around: calendars, clocks, circular lists

Whenever values "wrap around" after a fixed size, `%` keeps them in range. Thanks to the sign rule, going backwards works too:

```python
DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

today = 4  # Fri
print(DAYS[(today + 10) % 7])   # 10 days later
print(DAYS[(today - 12) % 7])   # 12 days earlier

hour = 22
print((hour + 5) % 24)   # 5 hours later
print((2 - 5) % 24)      # 5 hours before 02:00
```

Output:

```text
Mon
Sun
3
21
```

`(4 - 12) % 7` is `-8 % 7`, which is `6` in Python, a valid index. In a language with C-style remainders you would get `-1` and need an extra correction.

### Converting between units

To split a number of seconds into days, hours, minutes and seconds, you can combine division and modulo. This version uses `math.floor()` with true division:

```python
from math import floor


def get_time(total_seconds):
    return {
        "days": floor(total_seconds / 60 / 60 / 24),
        "hours": floor(total_seconds / 60 / 60) % 24,
        "minutes": floor(total_seconds / 60) % 60,
        "seconds": total_seconds % 60,
    }


print(get_time(93750))
```

Output:

```text
{'days': 1, 'hours': 2, 'minutes': 2, 'seconds': 30}
```

It works, but it goes through floats for no reason. A chain of `divmod()` calls stays in exact integer arithmetic and reads better: each step peels off one unit.

```python
def get_time(total_seconds):
    minutes, seconds = divmod(total_seconds, 60)
    hours, minutes = divmod(minutes, 60)
    days, hours = divmod(hours, 24)
    return {"days": days, "hours": hours, "minutes": minutes, "seconds": seconds}


print(get_time(93750))
```

Output:

```text
{'days': 1, 'hours': 2, 'minutes': 2, 'seconds': 30}
```

Why prefer `//` over `floor(a / b)`? True division produces a float, and floats hold only about 15–17 significant digits. For large integers, information is lost:

```python
import math

big = 10**17 + 1
print(math.floor(big / 1))
print(big // 1)
```

Output:

```text
100000000000000000
100000000000000001
```

### Every N-th item, last digits, divisibility

`i % n == 0` is true for every n-th value, which is handy for progress messages or batching. With `10` and `100` as divisors, `%` extracts the last digits of a number:

```python
for i in range(1, 11):
    if i % 4 == 0:
        print(f"processed {i} items")

number = 2026
print(number % 10)     # last digit
print(number % 100)    # last two digits
print(number % 7 == 0) # divisible by 7?
```

Output:

```text
processed 4 items
processed 8 items
6
26
False
```

## Common mistakes

- **Expecting C/Java/JavaScript results for negative numbers.** In Python `-7 % 3` is `2`, not `-1`. Use `math.fmod(-7, 3)` if you really need the truncated version.
- **Forgetting operator precedence.** `%` has the same precedence as `*`, `/` and `//`, so it binds tighter than `+` and `-`:

  ```python
  index, size = 4, 5
  print(index + 1 % size)    # 4 + (1 % 5) -> 5, out of range!
  print((index + 1) % size)  # 0, wraps around
  ```

  Output:

  ```text
  5
  0
  ```

- **Modulo by zero.** Like division, `x % 0` raises an exception:

  ```python
  print(10 % 0)
  ```

  Output (last line of the traceback, Python 3.14):

  ```text
  ZeroDivisionError: division by zero
  ```

- **Testing float divisibility with `%`.** `0.3 % 0.1` is `0.09999999999999998`, not `0.0`. Use integers or `Decimal` for exact arithmetic.
- **Confusing `%` on strings with modulo.** When the left operand is a string, `%` means old-style string formatting, not remainder:

  ```python
  count = 5
  print("%d files" % count)   # string formatting, not modulo
  print(f"{count} files")     # modern equivalent
  ```

  Output:

  ```text
  5 files
  5 files
  ```

## Summary

- `%` is the modulo operator. It always satisfies `N == D * (N // D) + (N % D)`.
- For positive operands, `%` is the ordinary remainder.
- The result of `N % D` is zero or has the sign of the divisor `D`. With a positive `D`, it is always in `0 ... D-1`.
- This differs from C, Java and JavaScript. `math.fmod()` gives the C-style result.
- `divmod(N, D)` returns `(N // D, N % D)` in one call and is ideal for unit conversions.
- `%` works with floats, but floating-point representation can produce surprising remainders.
- Typical uses: even/odd checks, wrap-around indexes and clocks, "every N-th item", extracting last digits.

## Practice

### Exercise 1: Predict the output

Without running the code, write down what each line prints. Then check your answers.

```python
print(17 % 5)
print(-17 % 5)
print(17 % -5)
print(-17 % -5)
print(divmod(-17, 5))
print(7.5 % 2)
```

### Exercise 2: Leap years

Write `is_leap_year(year)` that returns `True` for leap years in the Gregorian calendar: a year is a leap year if it is divisible by 4, except years divisible by 100, which are leap years only if they are also divisible by 400. Test it with 2024, 2025, 1900 and 2000, then compare your function with `calendar.isleap()` for every year from 1 to 2999.

### Exercise 3: Human-readable duration

Write `format_duration(total_seconds)` that returns a string such as `"1d 02:02:30"` (days, then hours, minutes and seconds padded to two digits). Use `divmod()` only, without floats. Test it with `93750`, `59` and `86400`.

### Exercise 4: Rotate a list

Write `rotate(items, k)` that returns a new list rotated `k` steps to the right: `rotate([1, 2, 3, 4, 5], 2)` gives `[4, 5, 1, 2, 3]`. It must also work when `k` is larger than the list length, when `k` is negative (rotate left), and for an empty list.

## Solutions

### Exercise 1

Output:

```text
2
3
-3
-2
(-4, 3)
1.5
```

- `17 % 5` is the ordinary remainder: `17 = 5 * 3 + 2`.
- `-17 // 5` is `-4` (rounded down from `-3.4`), and `-17 = 5 * (-4) + 3`.
- `17 // -5` is `-4`, and `17 = -5 * (-4) + (-3)`. The result takes the sign of the divisor.
- `-17 // -5` is `3`, and `-17 = -5 * 3 + (-2)`.
- `divmod(-17, 5)` combines the second line's quotient and remainder.
- `7.5 = 2 * 3 + 1.5`.

### Exercise 2

```python
def is_leap_year(year):
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


for year in [2024, 2025, 1900, 2000]:
    print(year, is_leap_year(year))

import calendar
print(all(is_leap_year(y) == calendar.isleap(y) for y in range(1, 3000)))
```

Output:

```text
2024 True
2025 False
1900 False
2000 True
True
```

### Exercise 3

```python
def format_duration(total_seconds):
    minutes, seconds = divmod(total_seconds, 60)
    hours, minutes = divmod(minutes, 60)
    days, hours = divmod(hours, 24)
    return f"{days}d {hours:02}:{minutes:02}:{seconds:02}"


print(format_duration(93750))
print(format_duration(59))
print(format_duration(86400))
```

Output:

```text
1d 02:02:30
0d 00:00:59
1d 00:00:00
```

The format spec `:02` pads a number with zeros to a width of two characters.

### Exercise 4

```python
def rotate(items, k):
    if not items:
        return []
    k %= len(items)
    return items[-k:] + items[:-k]


print(rotate([1, 2, 3, 4, 5], 2))
print(rotate([1, 2, 3, 4, 5], 7))
print(rotate([1, 2, 3, 4, 5], -1))
print(rotate([1, 2, 3, 4, 5], 0))
print(rotate([], 3))
```

Output:

```text
[4, 5, 1, 2, 3]
[4, 5, 1, 2, 3]
[2, 3, 4, 5, 1]
[1, 2, 3, 4, 5]
[]
```

`k %= len(items)` reduces any `k` to the range `0 ... len(items) - 1`: rotating a 5-item list by 7 is the same as rotating by 2, and rotating by `-1` becomes rotating right by `4`, which equals one step to the left. When `k` becomes `0`, `items[-0:]` is the whole list and `items[:-0]` is empty, so the result is an unchanged copy. The empty-list check is needed because `k % 0` would raise `ZeroDivisionError`.

---

*Source: [pythontutorial.net — Python Modulo Operator (%)](https://www.pythontutorial.net/advanced-python/python-modulo/). Adapted and expanded for PyJourney.*
