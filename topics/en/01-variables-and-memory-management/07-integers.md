# Integers

Integers are whole numbers: negative numbers, zero and positive numbers such as `-3`, `0` and `42`. In Python every integer is an object of the class `int`, and, unlike in most languages, an `int` has no fixed size: it can grow as large as your memory allows. This topic explains how computers store integers in binary, how Python's arbitrary-precision integers differ from fixed-width ones, and what that costs in memory and speed.

## What you'll learn

- How integers are represented in binary and how many values `n` bits can hold
- How signed integers work (two's complement) and where ranges like `-128..127` come from
- How Python stores integers with a variable number of bits, and what limits still exist
- How to measure an integer's memory size with `sys.getsizeof()`
- Integer literals (`0b`, `0o`, `0x`, `1_000_000`) and conversions with `int()`
- Which operations return an `int` and which return a `float`

## The `int` class

All integers in Python are instances of `int`:

```python
counter = 10
print(type(counter))
print(isinstance(-3, int), isinstance(True, int))
```

Output:

```text
<class 'int'>
True True
```

`bool` is a subclass of `int`: `True` behaves like `1` and `False` like `0` in arithmetic.

## How computers store integers

Memory holds only bits, zeros and ones. To store an integer, the computer writes it in **base 2**. For example, 5 is:

```text
5 = 1 x 2**2 + 0 x 2**1 + 1 x 2**0
  = 1 x 4    + 0 x 2    + 1 x 1
  = 0b101                         (3 bits)
```

Python can show and parse binary for you:

```python
print(bin(5))
print(int("101", 2))
print((5).bit_length())
print(bin(255), (255).bit_length())
```

Output:

```text
0b101
5
3
0b11111111 8
```

`bit_length()` returns how many bits are needed to write the number (without the sign).

### Unsigned integers

With `n` bits you can write `2**n` different patterns. If all of them are used for non-negative numbers, `n` bits store the range `0 .. 2**n - 1`. For 8 bits that is `0 .. 255`: **256** different values, from `0b00000000` to `0b11111111`.

### Signed integers: two's complement

To store negative numbers, one bit is reserved for the sign. A naive scheme (sign bit + magnitude) would waste a pattern on "negative zero" and give the range `-127 .. 127`. Real hardware uses **two's complement**, where the highest bit has a *negative* weight. For 8 bits, the weights are `-128, 64, 32, 16, 8, 4, 2, 1`:

```text
0b01111111 =  64+32+16+8+4+2+1        =  127   (largest)
0b00000000 =                              0    (only one zero)
0b11111111 = -128+64+32+16+8+4+2+1     =  -1
0b10000000 = -128                      = -128  (smallest)
```

Because there is only one zero, the extra pattern goes to the negative side, and `n` bits hold `-2**(n-1) .. 2**(n-1) - 1`:

```python
for bits in (8, 16, 32, 64):
    low = -(2 ** (bits - 1))
    high = 2 ** (bits - 1) - 1
    print(f"{bits:>2} bits: {low:,} .. {high:,}")
```

Output:

```text
 8 bits: -128 .. 127
16 bits: -32,768 .. 32,767
32 bits: -2,147,483,648 .. 2,147,483,647
64 bits: -9,223,372,036,854,775,808 .. 9,223,372,036,854,775,807
```

You can see two's complement directly by converting an `int` to a fixed number of bytes. A value outside the range does not fit:

```python
print((127).to_bytes(1, "big", signed=True))
print((-1).to_bytes(1, "big", signed=True))
print((-128).to_bytes(1, "big", signed=True))
print(int.from_bytes(b"\xff", "big", signed=True))
print(int.from_bytes(b"\xff", "big", signed=False))
print((128).to_bytes(1, "big", signed=True))
```

Output:

```text
b'\x7f'
b'\xff'
b'\x80'
-1
255
Traceback (most recent call last):
  ...
OverflowError: int too big to convert
```

The same byte `0xff` means `-1` as a signed value and `255` as an unsigned one.

## How Python represents integers

Languages such as C, Java and C# use fixed-width integer types: a 32-bit `int`, a 64-bit `long`, and so on. Arithmetic that goes past the range **overflows** (wraps around or fails).

Python's `int` is different: it uses as many bits as the value needs. There is no overflow. The only limit is available memory:

```python
import sys

big = 2 ** 100
print(big)
print(big * big)
print(sys.maxsize)
print(sys.maxsize + 1)
```

Output:

```text
1267650600228229401496703205376
1606938044258990275541962092341162602522202993782792835301376
9223372036854775807
9223372036854775808
```

> **Note:** `sys.maxsize` is **not** the largest integer. It is the largest size a container (list, string) can have on this platform. As you can see, `sys.maxsize + 1` works fine.

Internally, CPython stores an integer as a small header plus an array of **digits** in base `2**30`, so each digit holds 30 bits:

```python
import sys

print(sys.int_info)
```

Output (64-bit build):

```text
sys.int_info(bits_per_digit=30, sizeof_digit=4, default_max_str_digits=4300, str_digits_check_threshold=640)
```

This flexibility has a price:

- every integer is a full object with a header, so even `0` takes many bytes;
- arithmetic on big numbers works digit by digit, so the larger the numbers, the slower `+`, `*` and especially `**` and `//` become. Numbers that fit in one machine word take fast paths.

## Getting the size of an integer

`sys.getsizeof()` returns the number of bytes an object occupies:

```python
from sys import getsizeof

for number in (0, 1, 100, 2**30 - 1, 2**30, 2**60, 2**64, 2**100, -100):
    print(f"{number:>32}: {getsizeof(number)} bytes")
```

Output (Python 3.14, 64-bit):

```text
                               0: 28 bytes
                               1: 28 bytes
                             100: 28 bytes
                      1073741823: 28 bytes
                      1073741824: 32 bytes
             1152921504606846976: 36 bytes
            18446744073709551616: 36 bytes
 1267650600228229401496703205376: 40 bytes
                            -100: 28 bytes
```

The pattern is: **24 bytes of object header + 4 bytes for each 30-bit digit**.

- `0`, `1`, `100` and everything up to `2**30 - 1` fit in one digit: 28 bytes.
- `2**30` needs 31 bits, so two digits: 32 bytes.
- `2**60` and `2**64` need three digits: 36 bytes.
- The sign is stored in the header, so `-100` is the same size as `100`.

> **Note:** Older tutorials show `getsizeof(0) == 24`. That was true up to Python 3.11, where zero was stored with no digits at all. Since Python 3.12 every integer, including `0`, has at least one digit, so the minimum is 28 bytes. Exact sizes are CPython implementation details.

## Integer literals and conversions

You can write integers in several bases and group digits with underscores:

```python
population = 41_000_000
mask = 0b1010
permissions = 0o755
color = 0xFF8800

print(population, mask, permissions, color)
print(hex(color), oct(permissions), bin(mask))
```

Output:

```text
41000000 10 493 16746496
0xff8800 0o755 0b1010
```

`int()` converts strings and floats:

```python
print(int("42"))
print(int("  -17  "))
print(int("ff", 16))
print(int("0b1010", 0))
print(int(3.99))
print(int(-3.99))
print(int("3.5"))
```

Output:

```text
42
-17
255
10
3
-3
Traceback (most recent call last):
  ...
ValueError: invalid literal for int() with base 10: '3.5'
```

- Surrounding whitespace is ignored.
- The second argument is the base; base `0` reads the prefix (`0b`, `0o`, `0x`) from the string.
- `int(float)` **truncates toward zero**: `3.99` becomes `3` and `-3.99` becomes `-3`. It does not round.
- A string with a decimal point is not a valid integer literal. Use `int(float("3.5"))` or `round(float("3.5"))` instead.

## Integer operations

Addition, subtraction, multiplication and exponentiation of integers return integers:

```python
a = 10
b = 20

c = a + b
print(c)
print(type(c))

c = a - b
print(c)
print(type(c))

c = a * b
print(c)
print(type(c))

c = a ** b
print(c)
print(type(c))
```

Output:

```text
30
<class 'int'>
-10
<class 'int'>
200
<class 'int'>
100000000000000000000
<class 'int'>
```

True division `/` **always** returns a `float`, even when the result is a whole number:

```python
a = 10
b = 5
c = a / b

print(c)
print(type(c))
```

Output:

```text
2.0
<class 'float'>
```

Other useful operations:

```python
print(7 / 2)
print(7 // 2)
print(7 % 2)
print(divmod(7, 2))
print(2 ** -1)
print(pow(2, 10, 1000))
print(abs(-42))
```

Output:

```text
3.5
3
1
(3, 1)
0.5
24
42
```

- `//` is floor division and `%` is the remainder (both have their own topics).
- `divmod(a, b)` returns both at once.
- A negative exponent gives a `float`: `2 ** -1` is `0.5`.
- `pow(base, exp, mod)` computes `(base ** exp) % mod` efficiently, without building the huge intermediate number.

## Limits that still exist

Python integers never overflow, but the moment they meet `float` or `str`, limits appear.

**Converting to `float`.** A `float` is 64 bits wide, with a maximum of about `1.8e308`, and it holds only 53 bits of precision:

```python
print((2 ** 53 + 1) / 1)
print(2 ** 53 + 1)
print(int((2 ** 53 + 1) / 1) == 2 ** 53 + 1)
```

Output:

```text
9007199254740992.0
9007199254740993
False
```

`/` converts to `float`, and `2**53 + 1` cannot be represented exactly, so one unit is lost. For integers that are too large for a `float` at all, `/` fails:

```python
print(10 ** 400 / 1)
```

Output:

```text
Traceback (most recent call last):
  ...
OverflowError: integer division result too large for a float
```

Use `//` when you need exact integer results: `10 ** 400 // 10 ** 398` is exactly `100`.

**Converting to `str`.** Turning an integer with more than 4300 decimal digits into a string raises `ValueError` by default. This limit was added in Python 3.11 (and in security releases of older versions) because converting a huge number to decimal takes quadratic time and could be abused for denial-of-service attacks:

```python
import sys

huge = 10 ** 5000
print(len(str(10 ** 4000)))

try:
    print(str(huge))
except ValueError as error:
    print("ValueError:", error)

sys.set_int_max_str_digits(6000)
print(len(str(huge)))
```

Output:

```text
4001
ValueError: Exceeds the limit (4300 digits) for integer string conversion; use sys.set_int_max_str_digits() to increase the limit
5001
```

Calculations with such numbers are not limited. Only the conversion to and from decimal text is.

## Common mistakes

- **Using `/` when you want an integer.** `10 / 5` is `2.0`, a `float`. Use `//` for integer division.
- **Expecting `int()` to round.** `int(2.7)` is `2`, and `int(-2.7)` is `-2`. Use `round()` to round.
- **Doing exact integer math through floats.** `int(2**64 / 3)` gives `6148914691236516864`, while the exact `2**64 // 3` is `6148914691236517205`. Keep big-number calculations in `int`.
- **Treating `sys.maxsize` as the maximum integer.** Python integers have no maximum.
- **Passing `"3.5"` to `int()`.** It raises `ValueError`. Convert with `float()` first.
- **Writing leading zeros.** `code = 012` is a `SyntaxError` in Python 3 ("leading zeros in decimal integer literals are not permitted"). Use `0o12` for octal or a string `"012"` for codes.

## Summary

- Python represents all whole numbers with the `int` class. `bool` is a subclass of `int`.
- Computers store integers in binary. `n` bits hold `2**n` values: `0 .. 2**n - 1` unsigned, or `-2**(n-1) .. 2**(n-1) - 1` in two's complement.
- Python's `int` has arbitrary precision: it grows as needed and never overflows. `sys.maxsize` is not a limit for integers.
- CPython stores an integer as a 24-byte header plus 4 bytes per 30-bit digit. Since Python 3.12 even `0` takes 28 bytes.
- `+`, `-`, `*` and `**` (with a non-negative exponent) on integers return integers. `/` always returns a `float`.
- Limits appear only at the borders: conversion to `float` (precision and range) and to `str` (4300 digits by default).

## Practice

### Exercise 1: Ranges of fixed-width integers

Write `int_range(bits, signed=True)` that returns a tuple `(smallest, largest)` for a fixed-width integer. Check `int_range(8)`, `int_range(8, signed=False)`, `int_range(16)` and `int_range(32, signed=False)`.

### Exercise 2: Predict `getsizeof()`

Using the rule "24 bytes + 4 bytes per 30-bit digit, at least one digit", write `predicted_size(n)` and compare it with `sys.getsizeof(n)` for `0`, `7`, `-7`, `2**30 - 1`, `2**30`, `10**20`, `-(2**90)` and `2**1000`. Hint: `abs(n).bit_length()` tells you how many bits the number needs.

### Exercise 3: A really big number

Compute `2 ** 1000`. How many decimal digits does it have, what is the sum of its digits, and how many bits does it need?

### Exercise 4: Simulate 8-bit overflow

In C, adding `1` to a signed 8-bit value `127` wraps around to `-128`. Write `to_int8(n)` that maps any Python integer to the value a signed 8-bit integer would hold (keep the lowest 8 bits and interpret them in two's complement). Check `0, 127, 128, 255, 256, -128, -129, 1000`, and verify each answer with `to_bytes()` / `from_bytes()`.

## Solutions

### Exercise 1

```python
def int_range(bits, signed=True):
    if signed:
        return -(2 ** (bits - 1)), 2 ** (bits - 1) - 1
    return 0, 2 ** bits - 1


print(int_range(8))
print(int_range(8, signed=False))
print(int_range(16))
print(int_range(32, signed=False))
```

Output:

```text
(-128, 127)
(0, 255)
(-32768, 32767)
(0, 4294967295)
```

### Exercise 2

```python
import sys


def predicted_size(n):
    digits = max(1, (abs(n).bit_length() + 29) // 30)   # round up to whole digits
    return 24 + 4 * digits


for n in (0, 7, -7, 2**30 - 1, 2**30, 10**20, -(2**90), 2**1000):
    actual = sys.getsizeof(n)
    print(f"{n.bit_length():>4} bits: predicted {predicted_size(n)}, actual {actual}")
```

Output (Python 3.14, 64-bit):

```text
   0 bits: predicted 28, actual 28
   3 bits: predicted 28, actual 28
   3 bits: predicted 28, actual 28
  30 bits: predicted 28, actual 28
  31 bits: predicted 32, actual 32
  67 bits: predicted 36, actual 36
  91 bits: predicted 40, actual 40
1001 bits: predicted 160, actual 160
```

`(bits + 29) // 30` is integer division rounded up: 31 bits need 2 digits, 1001 bits need 34 digits (`24 + 34 * 4 = 160`). `max(1, ...)` handles `0`, which has zero bits but still gets one digit.

### Exercise 3

```python
number = 2 ** 1000
text = str(number)

print(len(text))
print(sum(int(digit) for digit in text))
print(number.bit_length())
```

Output:

```text
302
1366
1001
```

The number has 302 decimal digits, well below the 4300-digit conversion limit, so `str()` works. `2 ** 1000` is a one followed by 1000 zeros in binary, so it needs 1001 bits.

### Exercise 4

```python
def to_int8(n):
    return (n + 128) % 256 - 128


def to_int8_bytes(n):
    return int.from_bytes((n % 256).to_bytes(1, "big"), "big", signed=True)


for n in (0, 127, 128, 255, 256, -128, -129, 1000):
    print(n, to_int8(n), to_int8(n) == to_int8_bytes(n))
```

Output:

```text
0 0 True
127 127 True
128 -128 True
255 -1 True
256 0 True
-128 -128 True
-129 127 True
1000 -24 True
```

`n % 256` keeps the lowest 8 bits as an unsigned value `0..255` (Python's `%` always returns a non-negative result for a positive divisor). Shifting by 128 before and after maps that range onto `-128..127`. The byte-based version reaches the same result by reinterpreting the byte as signed.

---

*Source: [pythontutorial.net — Python Integers](https://www.pythontutorial.net/advanced-python/python-integers/). Adapted and expanded for PyJourney.*
