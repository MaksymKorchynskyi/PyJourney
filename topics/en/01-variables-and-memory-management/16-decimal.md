# Decimal

Binary floats cannot store most decimal fractions exactly, which is why `0.1 + 0.1 + 0.1` is not `0.3`. The standard `decimal` module offers the `Decimal` type: a floating-point number stored in **base 10**, with precision and rounding that you control. It is the right tool for money, prices, tax calculations and any other domain where numbers are written in decimal and must behave the way they do on paper.

## What you'll learn

- Why `Decimal("0.1")` is exact while the float `0.1` is not, and where `Decimal` is still inexact
- How to create `Decimal` values correctly, and why not from a float
- How a `Decimal` stores sign, digits and exponent, and why `Decimal("2.50")` keeps its trailing zero
- How the context controls precision, rounding and error signals, globally and locally
- How to round money with `quantize()` and the eight rounding modes
- How `Decimal` arithmetic differs from `int` and `float`: `//`, `%`, mixing types and `math` functions

## The problem with binary floats

```python
x = 0.1
y = 0.1
z = 0.1

s = x + y + z

print(s)
print(s == 0.3)
```

Output:

```text
0.30000000000000004
False
```

The float `0.1` is really the binary fraction closest to one tenth, which is slightly larger (the topic Float explains the details). The tiny errors add up. With `Decimal` created from strings, the same calculation is exact:

```python
from decimal import Decimal

x = Decimal("0.1")
y = Decimal("0.1")
z = Decimal("0.1")

s = x + y + z

print(s)
print(s == Decimal("0.3"))
print(repr(s - Decimal("0.3")))
```

Output:

```text
0.3
True
Decimal('0.0')
```

A `Decimal` stores decimal digits, so `0.1` is exactly one tenth, and adding, subtracting and multiplying such numbers gives the results you learned at school.

### Exact, but not infinitely precise

`Decimal` is exact for numbers that can be written with a **finite** number of decimal digits that fit in the current precision. One third cannot, so it is rounded, by default to 28 significant digits:

```python
from decimal import Decimal

third = Decimal(1) / Decimal(3)
print(third)
print(third * 3)
```

Output:

```text
0.3333333333333333333333333333
0.9999999999999999999999999999
```

`Decimal` removes the binary-versus-decimal mismatch, not rounding as such. For exact arithmetic with arbitrary fractions such as `1/3`, use `fractions.Fraction`.

## Creating Decimal values

```text
Decimal(value="0", context=None)
```

`value` can be a string, an integer, a tuple, a float or another `Decimal`. The **string** form is the one you will use most:

```python
from decimal import Decimal

print(Decimal("3.14"))
print(Decimal("  -0.001\n"))     # surrounding whitespace is ignored
print(Decimal("1_000.50"))       # underscores between digits
print(Decimal("2.5e-3"))
print(Decimal(42))
print(Decimal())
print(Decimal("Infinity"), Decimal("-inf"), Decimal("NaN"))
```

Output:

```text
3.14
-0.001
1000.50
0.0025
42
0
Infinity -Infinity NaN
```

### Do not create a Decimal from a float

`Decimal(0.1)` is allowed, but it converts the float **exactly**, including its binary error:

```python
from decimal import Decimal

print(Decimal(0.1))
print(Decimal("0.1"))
print(Decimal(str(0.1)))
print(Decimal(0.5))        # 0.5 is exact in binary
```

Output:

```text
0.1000000000000000055511151231257827021181583404541015625
0.1
0.1
0.5
```

By the time Python calls `Decimal(0.1)`, the literal `0.1` has already become a binary float, and the information "one tenth" is gone. Create decimals from strings, ints or tuples. If you receive a float from somewhere else, `Decimal(str(x))` gives you the short decimal form that Python prints for it.

### From a tuple

A tuple describes a decimal number in three parts: the **sign** (`0` for positive, `1` for negative), a tuple of **digits**, and an integer **exponent** (a power of ten). For example, `3.14` is `314 * 10**-2`:

```python
from decimal import Decimal

x = Decimal((0, (3, 1, 4), -2))
print(x)
print(Decimal((1, (1, 2, 5), -1)))
print(Decimal("12.50").as_tuple())
```

Output:

```text
3.14
-12.5
DecimalTuple(sign=0, digits=(1, 2, 5, 0), exponent=-2)
```

`as_tuple()` goes the other way. This sign-digits-exponent triple is exactly how a `Decimal` is stored internally.

### Invalid input

A string that is not a valid number raises `decimal.InvalidOperation` (a subclass of `ArithmeticError`), not `ValueError`:

```python
from decimal import Decimal, InvalidOperation

try:
    Decimal("12,50")
except InvalidOperation as error:
    print("InvalidOperation:", error)
```

Output:

```text
InvalidOperation: [<class 'decimal.ConversionSyntax'>]
```

### Decimal.from_number() (Python 3.14+)

Python 3.14 adds the class method `Decimal.from_number()`. It accepts `int`, `float` and `Decimal` values but rejects strings, which helps when a string would indicate a bug:

```python
from decimal import Decimal

print(Decimal.from_number(42))
print(Decimal.from_number(0.25))

try:
    Decimal.from_number("1.5")
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
42
0.25
TypeError: conversion from str to Decimal is not supported
```

## Trailing zeros are significant

Because a `Decimal` stores digits and an exponent, `Decimal("1.30")` and `Decimal("1.3")` are **equal** but not identical: the first remembers two decimal places. Arithmetic keeps track of them in a natural way:

```python
from decimal import Decimal

a = Decimal("1.30")
b = Decimal("1.20")
print(a + b)
print(Decimal("2.5") * Decimal("2.50"))
print(a == Decimal("1.3"))
print(repr(Decimal("2.50").normalize()))
print(repr(Decimal("100").normalize()))
```

Output:

```text
2.50
6.250
True
Decimal('2.5')
Decimal('1E+2')
```

- Addition keeps the larger number of decimal places: `1.30 + 1.20 = 2.50`, as you would write it on an invoice.
- Multiplication adds the decimal places: `2.5 * 2.50` has three.
- `normalize()` strips trailing zeros. Beware: for whole numbers this can produce exponent notation, as in `1E+2`.

## The context: precision, rounding and signals

Every arithmetic operation on `Decimal` values runs under a **context**, an object that decides:

- `prec`: the number of **significant digits** in results (default `28`);
- `rounding`: how results are rounded to that precision (default `ROUND_HALF_EVEN`);
- `traps` and `flags`: which exceptional conditions raise an exception, and which have occurred;
- `Emin` and `Emax`: the exponent range.

`decimal.getcontext()` returns the current context. Each thread has its own current context, so a change made in one thread does not affect the others:

```python
import decimal

ctx = decimal.getcontext()

print(ctx.prec)
print(ctx.rounding)
print(ctx)
```

Output:

```text
28
ROUND_HALF_EVEN
Context(prec=28, rounding=ROUND_HALF_EVEN, Emin=-999999, Emax=999999, capitals=1, clamp=0, flags=[], traps=[InvalidOperation, DivisionByZero, Overflow])
```

The rounding modes are module constants such as `decimal.ROUND_HALF_UP`. Their values are plain strings like `'ROUND_HALF_UP'`.

### Precision

The precision applies to the results of **arithmetic**, not to the constructor. A `Decimal` built from a string keeps all its digits:

```python
import decimal
from decimal import Decimal

decimal.getcontext().prec = 2

pi = Decimal("3.14159")
radius = 1

print(pi)

area = pi * radius * radius
print(area)
print(+pi)                          # unary plus applies the context
print(Decimal("123456") * 1)        # precision counts significant digits
```

Output:

```text
3.14159
3.1
3.1
1.2E+5
```

`prec` counts **significant digits, not decimal places**. With `prec=2`, `123456 * 1` becomes `1.2E+5`. For "two decimal places", use `quantize()`, shown below. The default precision of 28 digits is plenty for most money calculations, and you can raise it far higher when you need to.

### Rounding

`round(d, n)` on a `Decimal` uses the rounding mode of the current context. By default it is round half to even (see the topic Rounding):

```python
from decimal import Decimal

x = Decimal("2.25")
y = Decimal("3.35")

print(round(x, 1))
print(round(y, 1))
```

Output:

```text
2.2
3.4
```

Unlike the floats `2.25` and `3.35`, these decimals are exact ties. `2.25` goes to the even `2.2`, and `3.35` goes to the even `3.4`. Changing the context rounding changes the result:

```python
import decimal
from decimal import Decimal

ctx = decimal.getcontext()
ctx.rounding = decimal.ROUND_HALF_UP

x = Decimal("2.25")
y = Decimal("3.35")

print(round(x, 1))
print(round(y, 1))
```

Output:

```text
2.3
3.4
```

### Local contexts

Assigning to `getcontext()` changes the context for **all** code running in the current thread, including libraries you call. Usually you want a change only for one block of code. `decimal.localcontext()` creates a copy of the current context, makes it active inside a `with` block, and restores the original afterwards:

```python
import decimal
from decimal import Decimal

x = Decimal("2.25")
y = Decimal("3.35")

with decimal.localcontext() as ctx:
    print("Local context:")
    ctx.rounding = decimal.ROUND_HALF_UP
    print(round(x, 1))
    print(round(y, 1))

print("Global context:")
print(round(x, 1))
print(round(y, 1))
```

Output:

```text
Local context:
2.3
3.4
Global context:
2.2
3.4
```

Since Python 3.11, `localcontext()` also accepts the settings as keyword arguments:

```python
from decimal import Decimal, getcontext, localcontext

with localcontext(prec=50):
    print(Decimal(2).sqrt())

print(Decimal(2).sqrt())
print(getcontext().prec)
```

Output:

```text
1.4142135623730950488016887242096980785696718753769
1.414213562373095048801688724
28
```

### Rounding modes

The `decimal` module defines eight rounding modes. The table below rounds a few values to one decimal place with each of them:

```python
import decimal
from decimal import Decimal

modes = [
    "ROUND_UP", "ROUND_DOWN", "ROUND_CEILING", "ROUND_FLOOR",
    "ROUND_HALF_UP", "ROUND_HALF_DOWN", "ROUND_HALF_EVEN", "ROUND_05UP",
]
values = [Decimal(v) for v in ["2.25", "2.35", "2.31", "-2.25", "2.01"]]
step = Decimal("0.1")

print(f"{'mode':<16}" + "".join(f"{str(v):>7}" for v in values))
for mode in modes:
    rounding = getattr(decimal, mode)
    row = [v.quantize(step, rounding=rounding) for v in values]
    print(f"{mode:<16}" + "".join(f"{str(r):>7}" for r in row))
```

Output:

```text
mode               2.25   2.35   2.31  -2.25   2.01
ROUND_UP            2.3    2.4    2.4   -2.3    2.1
ROUND_DOWN          2.2    2.3    2.3   -2.2    2.0
ROUND_CEILING       2.3    2.4    2.4   -2.2    2.1
ROUND_FLOOR         2.2    2.3    2.3   -2.3    2.0
ROUND_HALF_UP       2.3    2.4    2.3   -2.3    2.0
ROUND_HALF_DOWN     2.2    2.3    2.3   -2.2    2.0
ROUND_HALF_EVEN     2.2    2.4    2.3   -2.2    2.0
ROUND_05UP          2.2    2.3    2.3   -2.2    2.1
```

| Mode | Rule |
|---|---|
| `ROUND_UP` | away from zero |
| `ROUND_DOWN` | towards zero (truncation) |
| `ROUND_CEILING` | towards positive infinity |
| `ROUND_FLOOR` | towards negative infinity |
| `ROUND_HALF_UP` | to nearest, ties away from zero |
| `ROUND_HALF_DOWN` | to nearest, ties towards zero |
| `ROUND_HALF_EVEN` | to nearest, ties to the even digit (default) |
| `ROUND_05UP` | towards zero, unless the last digit would be 0 or 5, then away from zero |

The names are easy to misread. `ROUND_UP` means away from zero, not towards positive infinity (that is `ROUND_CEILING`), and `ROUND_HALF_UP` rounds `-2.25` to `-2.3`. Note also that this rounding setting belongs to `Decimal` only. The built-in `round()` for floats always rounds half to even, whatever the decimal context says.

## Rounding money with quantize()

`d.quantize(exp)` rounds `d` so that it has the same exponent as `exp`. `Decimal("0.01")` means "two decimal places", which is how money is usually rounded:

```python
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")

price = Decimal("19.99")
tax_rate = Decimal("0.075")

tax = price * tax_rate
print(tax)
print(tax.quantize(CENT))
print(Decimal("7.325").quantize(CENT))
print(Decimal("7.325").quantize(CENT, rounding=ROUND_HALF_UP))
print(Decimal("5").quantize(CENT))
```

Output:

```text
1.49925
1.50
7.32
7.33
5.00
```

- Multiplication keeps every digit (`1.49925`). You decide when and how to round.
- Without `rounding=`, `quantize()` uses the context mode (half to even, so `7.325 -> 7.32`). Many tax and accounting rules require `ROUND_HALF_UP`; pass it explicitly.
- `quantize()` also **adds** decimal places: `5` becomes `5.00`, ready for display.

If the result would need more digits than the precision allows, `quantize()` raises `InvalidOperation` instead of silently losing digits.

## Signals: when something goes wrong

Exceptional conditions in decimal arithmetic are called **signals**. Each one sets a **flag** in the context, and if the signal is **trapped**, it also raises an exception. By default `InvalidOperation`, `DivisionByZero` and `Overflow` are trapped:

```python
from decimal import Decimal

print(Decimal(1) / Decimal(0))
```

Output (last line of the traceback):

```text
decimal.DivisionByZero: [<class 'decimal.DivisionByZero'>]
```

Other signals only set a flag. `Inexact` means a result had to be rounded. You can inspect the flag, or trap it to forbid rounding completely:

```python
from decimal import Decimal, Inexact, localcontext

with localcontext() as ctx:
    print(Decimal(1) / Decimal(8), ctx.flags[Inexact])
    print(Decimal(1) / Decimal(3), ctx.flags[Inexact])

with localcontext() as ctx:
    ctx.traps[Inexact] = True
    try:
        Decimal(10) / Decimal(3)
    except Inexact:
        print("the result had to be rounded")
```

Output:

```text
0.125 False
0.3333333333333333333333333333 True
the result had to be rounded
```

The `FloatOperation` signal catches accidental mixing of floats and decimals. It is not trapped by default; when you trap it, `Decimal(0.1)` and ordering comparisons with floats raise an exception:

```python
from decimal import Decimal, FloatOperation, localcontext

print(Decimal("0.1") < 0.2)          # allowed by default, exact comparison

with localcontext() as ctx:
    ctx.traps[FloatOperation] = True
    try:
        Decimal(0.1)
    except FloatOperation:
        print("FloatOperation: Decimal(0.1)")
    try:
        Decimal("0.1") < 0.2
    except FloatOperation:
        print("FloatOperation: Decimal < float")
```

Output:

```text
True
FloatOperation: Decimal(0.1)
FloatOperation: Decimal < float
```

Turning on this trap in financial code is a cheap way to find every place where a float sneaks in.

## How Decimal arithmetic differs

### Mixing with other numeric types

`Decimal` works together with `int`, but arithmetic with `float` raises `TypeError`. Python refuses to guess which precision you meant:

```python
from decimal import Decimal

price = Decimal("1.50")
print(price * 3)
print(price + 1)
print(price + 1.5)
```

Output (the last line fails, last line of the traceback shown):

```text
4.50
2.50
TypeError: unsupported operand type(s) for +: 'decimal.Decimal' and 'float'
```

Comparisons with floats are allowed and **exact**, which means they compare against the float's true binary value:

```python
from decimal import Decimal

print(Decimal("0.1") == 0.1)
print(Decimal("0.5") == 0.5)
```

Output:

```text
False
True
```

### `//` and `%` truncate

For integers, `//` rounds down and `%` takes the sign of the divisor (see the topics Floor Division and Modulo). `Decimal` follows the General Decimal Arithmetic Specification instead: `//` returns the integer part of the quotient, **truncated towards zero**, and `%` takes the sign of the **dividend**. The identity `x == y * (x // y) + x % y` still holds:

```python
from decimal import Decimal

x, y = Decimal(-7), Decimal(4)
print(x // y, x % y, divmod(x, y))
print(-7 // 4, -7 % 4, divmod(-7, 4))
print(y * (x // y) + x % y == x)
```

Output:

```text
-1 -3 (Decimal('-1'), Decimal('-3'))
-2 1 (-2, 1)
True
```

With positive operands the results are the same as for integers. With negative ones, do not swap `int` and `Decimal` without checking.

### Mathematical functions

Functions from the `math` module convert a `Decimal` to `float` first, so the result is a float with float precision. `Decimal` has its own methods for the most common functions, computed at the context precision:

```python
import math
from decimal import Decimal

two = Decimal(2)
print(math.sqrt(two), type(math.sqrt(two)))
print(two.sqrt())
print(Decimal(1).exp())
print(Decimal(1000).log10())
print(two ** 10, two ** Decimal("0.5"))
```

Output:

```text
1.4142135623730951 <class 'float'>
1.414213562373095048801688724
2.718281828459045235360287471
3
1024 1.414213562373095048801688724
```

Available methods include `sqrt()`, `exp()`, `ln()`, `log10()` and the `**` operator. There are no trigonometric functions. For those, either accept float precision or use a third-party library such as `mpmath`.

## When to use Decimal

| Need | Good choice |
|---|---|
| Money, prices, taxes, invoices | `Decimal`, or integer cents |
| Decimal input that must round-trip exactly (`"19.99"`) | `Decimal` |
| Configurable precision or rounding rules | `Decimal` |
| Exact fractions like `1/3` | `fractions.Fraction` |
| Science, graphics, large data, speed | `float` |

`Decimal` is implemented in C (since Python 3.3) and is fast for what it does, but it is still noticeably slower than hardware floats. Use it where decimal exactness matters, not everywhere.

## Common mistakes

- **Creating a Decimal from a float.** `Decimal(0.1)` is `0.1000000000000000055...`. Pass a string: `Decimal("0.1")`.
- **Treating `prec` as decimal places.** `prec` counts significant digits. Use `quantize(Decimal("0.01"))` for two decimal places.
- **Changing the global context in shared code.** `getcontext().rounding = ...` affects everything else in the thread. Use `localcontext()`.
- **Mixing `Decimal` and `float` in arithmetic.** It raises `TypeError`. Convert inputs to `Decimal` at the boundary of your program, and trap `FloatOperation` to find leaks.
- **Using `math` functions.** `math.sqrt(Decimal(2))` returns a float. Use `Decimal(2).sqrt()`.
- **Expecting integer semantics from `//` and `%`.** With negative numbers, `Decimal` truncates towards zero.
- **Misreading rounding mode names.** `ROUND_UP` is "away from zero", and `ROUND_HALF_UP` rounds ties away from zero, also for negative numbers.
- **Catching `ValueError` for bad input.** `Decimal("abc")` raises `decimal.InvalidOperation`.

## Summary

- `Decimal` stores numbers in base 10, so values like `0.1` are exact, and arithmetic on them behaves as on paper.
- Create decimals from strings, ints or tuples. `Decimal(float)` copies the float's binary error.
- A `Decimal` is a sign, a tuple of digits and an exponent. Trailing zeros are kept: `Decimal("1.30") + Decimal("1.20")` is `2.50`.
- The context sets precision (significant digits, default 28), rounding (default `ROUND_HALF_EVEN`) and which signals raise exceptions.
- Use `localcontext()` for temporary changes, and `quantize()` with an explicit rounding mode to round money.
- `Decimal` does not mix with `float` in arithmetic. `//` and `%` truncate towards zero. `math` functions return floats.
- `Decimal` is exact for finite decimal fractions only. `1/3` is still rounded. Use `Fraction` for exact rationals.

## Practice

### Exercise 1: Predict the output

Write down what each line prints, then run the code and explain each result.

```python
from decimal import Decimal

print(Decimal(0.5) == Decimal("0.5"))
print(Decimal(0.1) == Decimal("0.1"))
print(Decimal("1.10") + Decimal("2.20"))
print(Decimal("1.10") + Decimal("2.20") == Decimal("3.3"))
print(Decimal(-9) // Decimal(4), Decimal(-9) % Decimal(4))
print(round(Decimal("0.125"), 2))
```

### Exercise 2: An invoice

Prices arrive as strings. Compute an invoice for these items with `Decimal`:

```python
items = [("Notebook", "2.35", 3), ("Pen", "0.99", 7), ("Backpack", "24.90", 1)]
```

Print each line (`name`, quantity, price, line total), then the subtotal, 20% VAT rounded to cents with `ROUND_HALF_UP`, and the total. Finally, compute the subtotal with floats and compare.

### Exercise 3: Validate a price

Write `parse_price(text)` that returns a `Decimal` with exactly two decimal places, or raises `ValueError` with a helpful message if the text is not a number, is not finite (`NaN`, `Infinity`), is not positive, or has more than two decimal places. Test it with `"19.99"`, `"5"`, `"0.5"`, `" 7.10 "`, `"1e2"`, `"1.999"`, `"abc"`, `"NaN"` and `"-3"`.

### Exercise 4: Split a bill

Write `split(total, n)` that splits a `Decimal` amount into `n` parts, each a whole number of cents, so that the parts add up **exactly** to `total` and differ from each other by at most one cent. `split(Decimal("100.00"), 3)` should return `33.34`, `33.33` and `33.33`. Raise `ValueError` if `total` contains fractions of a cent.

## Solutions

### Exercise 1

Output:

```text
True
False
3.30
True
-2 -1
0.12
```

- `0.5` is exact in binary, so `Decimal(0.5)` is exactly `0.5`.
- The float `0.1` is not exact, and `Decimal(0.1)` preserves its error.
- Addition keeps two decimal places: `3.30`.
- Trailing zeros do not affect equality: `3.30 == 3.3`.
- `-9 / 4` is `-2.25`. `Decimal` truncates towards zero, giving `-2`, and the remainder `-1` has the sign of the dividend: `4 * (-2) + (-1) == -9`.
- `0.125` is an exact tie as a `Decimal`, and half to even gives `0.12`.

### Exercise 2

```python
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")
VAT_RATE = Decimal("0.20")

items = [("Notebook", "2.35", 3), ("Pen", "0.99", 7), ("Backpack", "24.90", 1)]

subtotal = Decimal("0.00")
for name, price, qty in items:
    line = Decimal(price) * qty
    subtotal += line
    print(f"{name:<10} {qty:>2} x {price:>6} = {line:>7}")

vat = (subtotal * VAT_RATE).quantize(CENT, rounding=ROUND_HALF_UP)
total = subtotal + vat
print(f"{'Subtotal':<24} {subtotal:>7}")
print(f"{'VAT 20%':<24} {vat:>7}")
print(f"{'Total':<24} {total:>7}")

float_subtotal = sum(float(price) * qty for _, price, qty in items)
print(float_subtotal)
```

Output:

```text
Notebook    3 x   2.35 =    7.05
Pen         7 x   0.99 =    6.93
Backpack    1 x  24.90 =   24.90
Subtotal                   38.88
VAT 20%                     7.78
Total                      46.66
38.879999999999995
```

The decimal subtotal is exactly `38.88`. VAT is `7.776`, which `quantize()` rounds to `7.78`. The float subtotal is already off before any rounding, and in a real system such small errors end up as one-cent differences between invoices and payments.

### Exercise 3

```python
from decimal import Decimal, InvalidOperation

CENT = Decimal("0.01")


def parse_price(text):
    try:
        price = Decimal(text)
    except InvalidOperation:
        raise ValueError(f"not a number: {text!r}") from None
    if not price.is_finite():
        raise ValueError(f"not a finite number: {text!r}")
    if price <= 0:
        raise ValueError(f"price must be positive: {text!r}")
    if price.as_tuple().exponent < -2:
        raise ValueError(f"more than two decimal places: {text!r}")
    return price.quantize(CENT)


for text in ["19.99", "5", "0.5", " 7.10 ", "1e2", "1.999", "abc", "NaN", "-3"]:
    try:
        print(f"{text!r:>9} -> {parse_price(text)!r}")
    except ValueError as error:
        print(f"{text!r:>9} -> ValueError: {error}")
```

Output:

```text
  '19.99' -> Decimal('19.99')
      '5' -> Decimal('5.00')
    '0.5' -> Decimal('0.50')
 ' 7.10 ' -> Decimal('7.10')
    '1e2' -> Decimal('100.00')
  '1.999' -> ValueError: more than two decimal places: '1.999'
    'abc' -> ValueError: not a number: 'abc'
    'NaN' -> ValueError: not a finite number: 'NaN'
     '-3' -> ValueError: price must be positive: '-3'
```

The exponent of `as_tuple()` tells how many decimal places the input had: `-3` for `1.999`. The finiteness check must come before `price <= 0`, because comparing `NaN` with `<=` raises `InvalidOperation`. `from None` hides the internal decimal exception from the traceback, so callers see only the clear `ValueError`.

### Exercise 4

```python
from decimal import Decimal


def split(total, n):
    cents = int(total * 100)
    if cents != total * 100:
        raise ValueError("total must be a whole number of cents")
    share, extra = divmod(cents, n)
    return [Decimal(share + (i < extra)).scaleb(-2) for i in range(n)]


for total, n in [(Decimal("100.00"), 3), (Decimal("0.05"), 2), (Decimal("10"), 4)]:
    parts = split(total, n)
    print(total, n, parts, sum(parts) == total)
```

Output:

```text
100.00 3 [Decimal('33.34'), Decimal('33.33'), Decimal('33.33')] True
0.05 2 [Decimal('0.03'), Decimal('0.02')] True
10 4 [Decimal('2.50'), Decimal('2.50'), Decimal('2.50'), Decimal('2.50')] True
```

Working in integer cents turns the problem into `divmod()`: every person gets `share` cents, and the first `extra` people get one more cent. `i < extra` is a boolean, which counts as `1` or `0`. `scaleb(-2)` divides by 100 by shifting the exponent, so `250` becomes `2.50` with both decimal places kept.

---

*Source: [pythontutorial.net — Python Decimal](https://www.pythontutorial.net/advanced-python/python-decimal/). Adapted and expanded for PyJourney.*
