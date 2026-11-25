# assertAlmostEqual()

Floating-point numbers are stored in binary and are almost never exact: `0.1 + 0.2` is `0.30000000000000004`. A test that compares floats with `assertEqual()` therefore fails for correct code. `assertAlmostEqual()` compares two numbers with a tolerance, so tiny rounding errors do not matter but real mistakes still do.

## What you'll learn

- Why `assertEqual()` is unreliable for floats
- Exactly how `assertAlmostEqual()` decides, step by step
- What `places` really means and why it misbehaves for very small and very large numbers
- How to use `delta` for an explicit tolerance, including for timestamps
- How `assertNotAlmostEqual()` works
- How to get a relative tolerance with `math.isclose()`

## Why floats need a tolerance

Here is a function in `circle.py`:

```python
import math


def area(radius: float) -> float:
    return math.pi * math.pow(radius, 2)
```

Computing the same value in two mathematically equivalent ways can give results that differ in the last digit:

```python
import unittest
from math import pi

from circle import area


class TestCircleExact(unittest.TestCase):
    def test_area_exact(self):
        self.assertEqual(area(1.1), pi * 1.21)

    def test_area_almost(self):
        self.assertAlmostEqual(area(1.1), pi * 1.21)
```

Output of `python3 -m unittest test_circle2 -v` (paths shortened):

```text
test_area_almost (test_circle2.TestCircleExact.test_area_almost) ... ok
test_area_exact (test_circle2.TestCircleExact.test_area_exact) ... FAIL

======================================================================
FAIL: test_area_exact (test_circle2.TestCircleExact.test_area_exact)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_circle2.py", line 9, in test_area_exact
    self.assertEqual(area(1.1), pi * 1.21)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 3.8013271108436504 != 3.8013271108436495

----------------------------------------------------------------------
Ran 2 tests in 0.000s

FAILED (failures=1)
```

The two numbers differ by less than `0.000000000000001`. The code is correct, and the exact comparison is the problem.

## How `assertAlmostEqual()` decides

```python
assertAlmostEqual(first, second, places=None, msg=None, delta=None)
```

The method works in this order:

1. If `first == second`, the test passes immediately.
2. If both `places` and `delta` are given, it raises `TypeError`.
3. It computes `diff = abs(first - second)`.
4. With `delta`: the test passes if `diff <= delta`.
5. Otherwise it uses `places` (7 when not given): the test passes if `round(diff, places) == 0`.

Without `delta`, the check is equivalent to this sketch:

```python
def almost_equal(first, second, places=7):
    if first == second:
        return True
    return round(abs(first - second), places) == 0


print(almost_equal(0.1 + 0.2, 0.3))
print(round(0.00000004, 7), round(0.00000006, 7))
print(almost_equal(0.3, 0.30000004), almost_equal(0.3, 0.30000006))
```

Output:

```text
True
0.0 1e-07
True False
```

A difference rounds to zero at 7 places when it is smaller than about `0.00000005` (5 × 10⁻⁸). So with the defaults, "almost equal" means "the difference is below roughly half of the seventh decimal place".

> **Note:** You may see the rule written as `round(first - second, 7) == 0`. The real implementation takes `abs()` of the difference first and has the `first == second` shortcut, but for ordinary numbers the result is the same.

### The basic example

The test for `area()` from `circle.py`:

```python
import unittest
from math import pi

from circle import area


class TestCircle(unittest.TestCase):
    def test_area(self):
        self.assertAlmostEqual(area(0), 0)
        self.assertAlmostEqual(area(1), pi)
        self.assertAlmostEqual(area(0.1), pi * 0.1 * 0.1)
```

Output of `python3 -m unittest test_circle -v`:

```text
test_area (test_circle.TestCircle.test_area) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

## `places` counts decimal places, not significant digits

`places` is the number of digits **after the decimal point**, regardless of how big or small the numbers are. That works well for values around 1 and badly for very small or very large values:

```python
import unittest


class TestPlaces(unittest.TestCase):
    def test_pi_to_two_places(self):
        self.assertAlmostEqual(3.14159, 3.14, places=2)

    def test_not_close_enough(self):
        self.assertAlmostEqual(3.146, 3.14, places=2)

    def test_tiny_numbers(self):
        self.assertAlmostEqual(1e-8, 2e-8)

    def test_large_numbers(self):
        self.assertAlmostEqual(1_000_000.0, 1_000_000.1)
```

The test lines and `AssertionError` lines of `python3 -m unittest test_places -v`:

```text
test_large_numbers (test_places.TestPlaces.test_large_numbers) ... FAIL
test_not_close_enough (test_places.TestPlaces.test_not_close_enough) ... FAIL
test_pi_to_two_places (test_places.TestPlaces.test_pi_to_two_places) ... ok
test_tiny_numbers (test_places.TestPlaces.test_tiny_numbers) ... ok

AssertionError: 1000000.0 != 1000000.1 within 7 places (0.09999999997671694 difference)
AssertionError: 3.146 != 3.14 within 2 places (0.005999999999999783 difference)
```

- `3.14159` and `3.14` differ by `0.00159`, which rounds to `0.0` at 2 places: pass.
- `3.146` and `3.14` differ by `0.006`, which rounds to `0.01`: fail. The message shows the values, the precision and the actual difference.
- `1e-8` and `2e-8` **pass**, although one is twice as big as the other. Their difference is far below the seventh decimal place.
- `1_000_000.0` and `1_000_000.1` **fail**, although they differ by only 0.00001 %.

When your numbers are not "around 1", either choose `delta` explicitly or use a relative tolerance (see below).

## `delta`: an explicit tolerance

With `delta`, you state the largest allowed difference directly. The boundary is inclusive: `diff <= delta` passes.

```python
import unittest
from datetime import datetime, timedelta


def read_voltage():
    return 5.08  # pretend this comes from a sensor


def create_order():
    return {"id": 1, "created_at": datetime.now()}


class TestDelta(unittest.TestCase):
    def test_voltage_within_tolerance(self):
        self.assertAlmostEqual(read_voltage(), 5.0, delta=0.1)

    def test_voltage_strict(self):
        self.assertAlmostEqual(read_voltage(), 5.0, delta=0.05)

    def test_created_now(self):
        order = create_order()
        self.assertAlmostEqual(
            order["created_at"], datetime.now(), delta=timedelta(seconds=1)
        )

    def test_both_places_and_delta(self):
        self.assertAlmostEqual(read_voltage(), 5.0, places=1, delta=0.1)
```

The test lines, the last line of each traceback and the summary of `python3 -m unittest test_delta -v`:

```text
test_both_places_and_delta (test_delta.TestDelta.test_both_places_and_delta) ... ERROR
test_created_now (test_delta.TestDelta.test_created_now) ... ok
test_voltage_strict (test_delta.TestDelta.test_voltage_strict) ... FAIL
test_voltage_within_tolerance (test_delta.TestDelta.test_voltage_within_tolerance) ... ok

TypeError: specify delta or places not both
AssertionError: 5.08 != 5.0 within 0.05 delta (0.08000000000000007 difference)

FAILED (failures=1, errors=1)
```

Things to notice:

- `delta` expresses the requirement in the units of the problem ("within 0.1 V"), which is usually clearer than a number of decimal places.
- `delta` works with any values that support subtraction, `abs()` and `<=`. `datetime` minus `datetime` gives a `timedelta`, so `delta=timedelta(seconds=1)` is a neat way to test "created just now", where an exact comparison is impossible.
- Passing both `places` and `delta` is a programming error in the test. It raises `TypeError`, so the test ends with `ERROR`, not `FAIL`.

## Edge cases

| Call | Result | Why |
|---|---|---|
| `assertAlmostEqual(math.inf, math.inf)` | pass | equal values pass immediately |
| `assertAlmostEqual(math.nan, math.nan)` | FAIL | NaN is not equal to anything; the difference is `nan` |
| `assertAlmostEqual("a", "a")` | pass | equal values pass, whatever their type |
| `assertAlmostEqual("a", "b")` | ERROR (`TypeError`) | strings cannot be subtracted |
| `assertAlmostEqual(Decimal(1) / 3, Decimal("0.33333333"))` | pass | `Decimal` and `Fraction` work too |
| `assertAlmostEqual(Decimal("0.3"), 0.3)` | ERROR (`TypeError`) | `Decimal` and `float` cannot be subtracted |
| `assertAlmostEqual(dt1, dt2)` with two `datetime` objects | ERROR (`TypeError`) | a `timedelta` cannot be rounded, so use `delta` |

To check that a value *is* NaN, use `self.assertTrue(math.isnan(value))`.

## `assertNotAlmostEqual()`

```python
assertNotAlmostEqual(first, second, places=None, msg=None, delta=None)
```

The opposite check. It fails when the values are equal or their difference rounds to zero at `places`. With `delta`, it passes only if the difference is **strictly greater** than `delta`.

```python
import unittest


def apply_inflation(price, rate):
    return price * (1 + rate)


class TestInflation(unittest.TestCase):
    def test_price_changes_noticeably(self):
        self.assertNotAlmostEqual(apply_inflation(100.0, 0.05), 100.0, delta=1)

    def test_tiny_rate(self):
        self.assertNotAlmostEqual(apply_inflation(100.0, 1e-12), 100.0)
```

Output of `python3 -m unittest test_inflation -v` (traceback trimmed):

```text
test_price_changes_noticeably (test_inflation.TestInflation.test_price_changes_noticeably) ... ok
test_tiny_rate (test_inflation.TestInflation.test_tiny_rate) ... FAIL

======================================================================
FAIL: test_tiny_rate (test_inflation.TestInflation.test_tiny_rate)
----------------------------------------------------------------------
AssertionError: 100.00000000010002 == 100.0 within 7 places

----------------------------------------------------------------------
Ran 2 tests in 0.000s

FAILED (failures=1)
```

A 5 % increase changes the price by 5, which is more than `delta=1`. A rate of `1e-12` changes it by `0.0000000001`, which is "almost equal" at 7 places.

## Relative tolerance with `math.isclose()`

`places` and `delta` are both **absolute** tolerances. When the magnitude of your values varies (micro-amperes in one test, millions of dollars in another), a **relative** tolerance is a better fit: "equal up to one part in a billion". `unittest` has no assert method for it, but `math.isclose()` does the comparison:

```python
import math
import unittest


class TestRelative(unittest.TestCase):
    def test_large_values(self):
        actual = 1_000_000.0000001
        self.assertTrue(
            math.isclose(actual, 1_000_000.0, rel_tol=1e-9),
            f"{actual!r} is not close to 1000000.0",
        )
```

Output of `python3 -m unittest test_isclose -v`:

```text
test_large_values (test_isclose.TestRelative.test_large_values) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

The `msg` matters here: without it, a failure would say only `False is not true`. Exercise 4 turns this into a reusable assert method.

## Common mistakes

- **Comparing floats with `assertEqual()`.** It works by luck for some values and fails for others. Use `assertAlmostEqual()` for any computed float.
- **Treating `places` as significant digits.** With the default `places=7`, `1e-8` and `2e-8` are "almost equal", while `1_000_000.0` and `1_000_000.1` are not. Use `delta` or `math.isclose()` for values far from 1.
- **Passing `msg` as the third positional argument.** The third parameter is `places`, not `msg`:

  ```python
  self.assertAlmostEqual(0.5, 0.25, "ratio is wrong")
  ```

  This ends with `ERROR` and `TypeError: 'str' object cannot be interpreted as an integer`. Write `msg="ratio is wrong"` as a keyword argument.
- **Passing both `places` and `delta`.** That raises `TypeError` (`ERROR`). Choose one.
- **Using floats for money.** Prices and balances should be `Decimal` or integer cents, compared exactly with `assertEqual()`. A tolerance only hides rounding bugs there.
- **Expecting NaN to be almost equal to NaN.** It never is. Check with `math.isnan()`.

## Summary

- Use `assertAlmostEqual()` instead of `assertEqual()` whenever the values are computed floats.
- Equal values pass immediately. Otherwise the method takes `abs(first - second)` and passes if it rounds to `0` at `places` decimal places (default 7, so roughly a difference below `5e-8`).
- `places` counts digits after the decimal point, not significant digits, so it is too loose for tiny numbers and too strict for huge ones.
- `delta` sets an explicit absolute tolerance (`diff <= delta`) and also works with `datetime`/`timedelta`, `Decimal` and `Fraction`.
- `places` and `delta` cannot be combined: that raises `TypeError`.
- `assertNotAlmostEqual()` passes only when the difference is large enough (`> delta`, or non-zero after rounding).
- For a relative tolerance, use `math.isclose()` with a helpful `msg`, or wrap it in your own assert method.

## Practice

### Exercise 1: Test `average()`

`stats.py` contains:

```python
def average(numbers):
    return sum(numbers) / len(numbers)
```

Write three tests: the average of `[0.1, 0.2, 0.3]` is `0.2`, the average of `[1, 2, 3, 4]` is exactly `2.5`, and the average of `[19.99, 5.01, 7.5]` is `10.83` when compared to two decimal places. Choose the right assert method for each one.

### Exercise 2: Pass, FAIL or ERROR?

Predict the result of each call, then check your answers with a script.

1. `assertAlmostEqual(0.1 + 0.2, 0.3)`
2. `assertAlmostEqual(1e-9, 5e-9)`
3. `assertAlmostEqual(100.0, 100.01, places=1)`
4. `assertAlmostEqual(100.0, 100.01, delta=0.001)`
5. `assertAlmostEqual(10, 10.4, places=0)`
6. `assertAlmostEqual(1.0, 1.1, places=1, delta=0.5)`
7. `assertAlmostEqual(float("nan"), float("nan"))`
8. `assertNotAlmostEqual(1.0, 1.00000001)`

### Exercise 3: Token expiry

`tokens.py` contains:

```python
from datetime import datetime, timedelta


def make_token(ttl_seconds):
    return {
        "value": "abc123",
        "expires_at": datetime.now() + timedelta(seconds=ttl_seconds),
    }
```

Write tests that check that `make_token(3600)` expires about one hour from now and `make_token(0)` expires about now. Allow one second of difference.

### Exercise 4: A relative-tolerance assert method

Write a mixin class `RelativeCloseMixin` with a method `assertRelativelyClose(first, second, rel_tol=1e-9, msg=None)` built on `math.isclose()`. On failure it should call `self.fail()` with a message like `1e-08 != 2e-08 within rel_tol=1e-09`, followed by ` : <msg>` when `msg` is given. Test it: `1_000_000.0` and `1_000_000.0000001` must be close, `1e-8` and `2e-8` must not be (use `assertRaises(AssertionError)` and check the message), and `101.0` and `100.0` must be close with `rel_tol=0.02`.

## Solutions

### Exercise 1

```python
import unittest

from stats import average


class TestAverage(unittest.TestCase):
    def test_floats(self):
        self.assertAlmostEqual(average([0.1, 0.2, 0.3]), 0.2)

    def test_integers(self):
        self.assertEqual(average([1, 2, 3, 4]), 2.5)

    def test_two_decimal_places(self):
        self.assertAlmostEqual(average([19.99, 5.01, 7.5]), 10.83, places=2)
```

Output of `python3 -m unittest test_stats -v`:

```text
test_floats (test_stats.TestAverage.test_floats) ... ok
test_integers (test_stats.TestAverage.test_integers) ... ok
test_two_decimal_places (test_stats.TestAverage.test_two_decimal_places) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

`average([0.1, 0.2, 0.3])` is actually `0.19999999999999998`, so `assertEqual()` would fail there. `10 / 4` is exactly `2.5` (it is representable in binary), so `assertEqual()` is fine for the second test. The third average is `10.833333333333334`, and the difference `0.0033...` rounds to `0.0` at 2 places.

### Exercise 2

```python
import unittest

tc = unittest.TestCase()  # an instance just for experiments

checks = [
    (1, tc.assertAlmostEqual, (0.1 + 0.2, 0.3), {}),
    (2, tc.assertAlmostEqual, (1e-9, 5e-9), {}),
    (3, tc.assertAlmostEqual, (100.0, 100.01), {"places": 1}),
    (4, tc.assertAlmostEqual, (100.0, 100.01), {"delta": 0.001}),
    (5, tc.assertAlmostEqual, (10, 10.4), {"places": 0}),
    (6, tc.assertAlmostEqual, (1.0, 1.1), {"places": 1, "delta": 0.5}),
    (7, tc.assertAlmostEqual, (float("nan"), float("nan")), {}),
    (8, tc.assertNotAlmostEqual, (1.0, 1.00000001), {}),
]

for number, method, args, kwargs in checks:
    try:
        method(*args, **kwargs)
        print(number, "pass")
    except AssertionError as error:
        print(number, "FAIL:", error)
    except TypeError as error:
        print(number, "ERROR:", error)
```

Output:

```text
1 pass
2 pass
3 pass
4 FAIL: 100.0 != 100.01 within 0.001 delta (0.010000000000005116 difference)
5 pass
6 ERROR: specify delta or places not both
7 FAIL: nan != nan within 7 places (nan difference)
8 FAIL: 1.0 == 1.00000001 within 7 places
```

`unittest.TestCase()` can be created without a test method name, which is handy for trying out assert methods in a script or the REPL.

- 2: the difference `4e-9` is far below the seventh decimal place.
- 3: `round(0.01, 1)` is `0.0`.
- 5: `places=0` means "equal after rounding to a whole number", and `round(0.4)` is `0`.
- 8: the difference `1e-8` rounds to zero, so the values *are* almost equal and `assertNotAlmostEqual()` fails.

### Exercise 3

```python
import unittest
from datetime import datetime, timedelta

from tokens import make_token


class TestMakeToken(unittest.TestCase):
    def test_expires_in_one_hour(self):
        token = make_token(3600)
        expected = datetime.now() + timedelta(hours=1)
        self.assertAlmostEqual(
            token["expires_at"], expected, delta=timedelta(seconds=1)
        )

    def test_zero_ttl_expires_now(self):
        token = make_token(0)
        self.assertAlmostEqual(
            token["expires_at"], datetime.now(), delta=timedelta(seconds=1)
        )
```

Output of `python3 -m unittest test_tokens -v`:

```text
test_expires_in_one_hour (test_tokens.TestMakeToken.test_expires_in_one_hour) ... ok
test_zero_ttl_expires_now (test_tokens.TestMakeToken.test_zero_ttl_expires_now) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

The two `datetime.now()` calls (one inside `make_token()`, one in the test) happen microseconds apart, so an exact comparison would fail. One second is a generous tolerance that still catches real bugs, such as a TTL in minutes instead of seconds.

### Exercise 4

```python
import math
import unittest


class RelativeCloseMixin:
    def assertRelativelyClose(self, first, second, rel_tol=1e-9, msg=None):
        if math.isclose(first, second, rel_tol=rel_tol):
            return
        standard_msg = f"{first!r} != {second!r} within rel_tol={rel_tol!r}"
        if msg is not None:
            standard_msg = f"{standard_msg} : {msg}"
        self.fail(standard_msg)


class TestRelative(RelativeCloseMixin, unittest.TestCase):
    def test_large_numbers_are_close(self):
        self.assertRelativelyClose(1_000_000.0, 1_000_000.0000001)

    def test_tiny_numbers_are_not_close(self):
        with self.assertRaises(AssertionError) as cm:
            self.assertRelativelyClose(1e-8, 2e-8)
        self.assertEqual(str(cm.exception), "1e-08 != 2e-08 within rel_tol=1e-09")

    def test_custom_tolerance(self):
        self.assertRelativelyClose(101.0, 100.0, rel_tol=0.02)

    def test_msg(self):
        with self.assertRaises(AssertionError) as cm:
            self.assertRelativelyClose(1.0, 2.0, msg="speed")
        self.assertEqual(str(cm.exception), "1.0 != 2.0 within rel_tol=1e-09 : speed")
```

Output of `python3 -m unittest test_relative -v`:

```text
test_custom_tolerance (test_relative.TestRelative.test_custom_tolerance) ... ok
test_large_numbers_are_close (test_relative.TestRelative.test_large_numbers_are_close) ... ok
test_msg (test_relative.TestRelative.test_msg) ... ok
test_tiny_numbers_are_not_close (test_relative.TestRelative.test_tiny_numbers_are_not_close) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

`self.fail()` raises `AssertionError` (strictly, `self.failureException`), so the runner reports a failing custom assertion as `FAIL`, just like a built-in one. Testing that an assertion fails with `assertRaises(AssertionError)` is a common way to test your own assert helpers. The mixin comes **before** `unittest.TestCase` in the base list and has no `__init__`, so it does not interfere with the test case machinery.

---

*Source: [pythontutorial.net — Python assertAlmostEqual()](https://www.pythontutorial.net/python-unit-testing/python-assertalmostequal/). Adapted and expanded for PyJourney.*
