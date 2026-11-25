# Parameterized Tests

Many tests check the same behaviour with different inputs: a price with and without tax, a valid and an invalid port number, a leap year and a common year. A **parameterized test** (also called a data-driven test) runs one test body against a table of cases. `unittest` has no special decorator for this, but its `subTest()` context manager provides what matters: every case is reported separately, and one failing case does not hide the others.

## What you'll learn

- What a parameterized test is and when it beats one method per case
- Why a plain `for` loop inside a test is not enough
- How `self.subTest()` isolates cases and reports every failure with its label
- How to label subtests with a message and keyword parameters, including nested subtests
- How subtests interact with errors, `skipTest()`, `setUp()`, `--failfast` and the test count
- What `pytest.mark.parametrize` offers as an alternative

## The function under test

`pricing.py` calculates a net price: subtract the discount, add the tax, round to cents.

```python
def calculate(price, tax=0, discount=0):
    return round((price - discount) * (1 + tax), 2)
```

A few calls, to know what to expect:

```python
from pricing import calculate

print(calculate(10))
print(calculate(10, tax=0.1))
print(calculate(10, discount=1))
print(calculate(10, tax=0.1, discount=1))
```

Output:

```text
10
11.0
9
9.9
```

`tax` is a fraction (`0.1` means 10%). Note that the results are sometimes `int` and sometimes `float`. That is fine for `assertEqual()`, because `11.0 == 11` is `True`.

To test `calculate()` properly you need at least four cases:

| Case | price | tax | discount | expected |
|---|---|---|---|---|
| No tax, no discount | 10 | 0 | 0 | 10 |
| Has tax, no discount | 10 | 0.1 | 0 | 11 |
| No tax, has discount | 10 | 0 | 1 | 9 |
| Has tax, has discount | 10 | 0.1 | 1 | 9.9 |

## Option 1: one test method per case

The most direct way is a separate method for every row of the table:

```python
import unittest

from pricing import calculate


class TestPricing(unittest.TestCase):
    def test_no_tax_no_discount(self):
        self.assertEqual(calculate(10), 10)

    def test_tax_no_discount(self):
        self.assertEqual(calculate(10, tax=0.1), 11)

    def test_no_tax_with_discount(self):
        self.assertEqual(calculate(10, discount=1), 9)

    def test_tax_and_discount(self):
        self.assertEqual(calculate(10, tax=0.1, discount=1), 9.9)
```

Output of `python -m unittest test_pricing_methods -v` (the time varies):

```text
test_no_tax_no_discount (test_pricing_methods.TestPricing.test_no_tax_no_discount) ... ok
test_no_tax_with_discount (test_pricing_methods.TestPricing.test_no_tax_with_discount) ... ok
test_tax_and_discount (test_pricing_methods.TestPricing.test_tax_and_discount) ... ok
test_tax_no_discount (test_pricing_methods.TestPricing.test_tax_no_discount) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

This is perfectly valid, and for a handful of cases with different meanings it is often the clearest choice. The cost appears when there are 10 or 50 rows: the methods differ only in their data, and adding a case means copying a method. A table of data plus one test body scales much better.

## Option 2: a plain loop (and why it falls short)

Put the cases into a data structure and loop over them in one test. To see how failures are reported, suppose two rows of the table were filled in carelessly: `Has tax, no discount` expects `10` instead of `11`, and `No tax, has discount` expects `10` instead of `9`.

```python
import unittest

from pricing import calculate


class TestPricing(unittest.TestCase):
    def test_calculate(self):
        items = (
            {'case': 'No tax, no discount', 'price': 10, 'tax': 0, 'discount': 0, 'net_price': 10},
            {'case': 'Has tax, no discount', 'price': 10, 'tax': 0.1, 'discount': 0, 'net_price': 10},
            {'case': 'No tax, has discount', 'price': 10, 'tax': 0, 'discount': 1, 'net_price': 10},
            {'case': 'Has tax, has discount', 'price': 10, 'tax': 0.1, 'discount': 1, 'net_price': 9.9},
        )

        for item in items:
            net_price = calculate(item['price'], item['tax'], item['discount'])
            self.assertEqual(net_price, item['net_price'])
```

Run it:

```bash
python -m unittest test_pricing -v
```

Output (path shortened, the time varies):

```text
test_calculate (test_pricing.TestPricing.test_calculate) ... FAIL

======================================================================
FAIL: test_calculate (test_pricing.TestPricing.test_calculate)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_pricing.py", line 17, in test_calculate
    self.assertEqual(net_price, item['net_price'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 11.0 != 10

----------------------------------------------------------------------
Ran 1 test in 0.000s

FAILED (failures=1)
```

Two problems are visible:

1. **The test stops at the first failure.** A failed assertion raises `AssertionError`, which ends the whole method. The third case is also wrong, but it never ran, so you will only find out after fixing the second one.
2. **The report does not say which case failed.** `11.0 != 10` is all you get. With 50 rows you would have to guess or add print statements.

## Option 3: `subTest()`

Wrap the body of the loop in `with self.subTest(...)`. Everything else stays the same:

```python
import unittest

from pricing import calculate


class TestPricing(unittest.TestCase):
    def test_calculate(self):
        items = (
            {'case': 'No tax, no discount', 'price': 10, 'tax': 0, 'discount': 0, 'net_price': 10},
            {'case': 'Has tax, no discount', 'price': 10, 'tax': 0.1, 'discount': 0, 'net_price': 10},
            {'case': 'No tax, has discount', 'price': 10, 'tax': 0, 'discount': 1, 'net_price': 10},
            {'case': 'Has tax, has discount', 'price': 10, 'tax': 0.1, 'discount': 1, 'net_price': 9.9},
        )

        for item in items:
            with self.subTest(item['case']):
                net_price = calculate(item['price'], item['tax'], item['discount'])
                self.assertEqual(net_price, item['net_price'])
```

Output of `python -m unittest test_pricing -v` (Python 3.14, path shortened, the time varies):

```text
test_calculate (test_pricing.TestPricing.test_calculate) ...
  test_calculate (test_pricing.TestPricing.test_calculate) [Has tax, no discount] ... FAIL
  test_calculate (test_pricing.TestPricing.test_calculate) [No tax, has discount] ... FAIL

======================================================================
FAIL: test_calculate (test_pricing.TestPricing.test_calculate) [Has tax, no discount]
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_pricing.py", line 18, in test_calculate
    self.assertEqual(net_price, item['net_price'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 11.0 != 10

======================================================================
FAIL: test_calculate (test_pricing.TestPricing.test_calculate) [No tax, has discount]
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_pricing.py", line 18, in test_calculate
    self.assertEqual(net_price, item['net_price'])
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 9 != 10

----------------------------------------------------------------------
Ran 1 test in 0.001s

FAILED (failures=2)
```

Both problems are solved:

- **Every case runs.** When an assertion fails inside the `with` block, `subTest()` records the failure and swallows the exception. Execution continues after the block, so the loop moves on to the next case.
- **Every failure is labelled.** The text in square brackets is the message you passed to `subTest()`, so you know at once which rows are wrong.

Also notice the counters: `Ran 1 test`, but `failures=2`. Unittest counts **test methods** in "Ran", while failures are counted **per subtest**. Without `-v` the progress line shows one letter per failing subtest, here `FF`. Passing subtests are not listed separately: if all of them pass, the test shows a single `ok`.

After correcting the two expectations (`11` and `9`), the same test passes:

```text
test_calculate (test_pricing.TestPricing.test_calculate) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

### How it works

`subTest()` is a method of `TestCase` that returns a context manager:

```text
self.subTest(msg=..., **params)
```

Both arguments are optional. While the block runs, the context manager remembers the label. If the block raises, the exception is reported as a failure (for `AssertionError`) or an error (for anything else) of **that subtest**, and the test method itself continues after the `with` statement. When the method finishes, the test as a whole is marked as failed if any of its subtests failed.

## Labelling subtests

### Keyword parameters

Instead of a free-text message, pass the case's data as keyword arguments. They appear in round brackets in the report. A list of tuples is often lighter than a list of dicts:

```python
import unittest

from pricing import calculate


class TestPricing(unittest.TestCase):
    def test_calculate(self):
        cases = [
            # price, tax, discount, expected
            (10, 0, 0, 10),
            (10, 0.1, 0, 10),
            (10, 0, 1, 9),
            (10, 0.1, 1, 9.9),
        ]
        for price, tax, discount, expected in cases:
            with self.subTest(price=price, tax=tax, discount=discount):
                self.assertEqual(calculate(price, tax, discount), expected)
```

The second row is wrong again on purpose. Output of `python -m unittest test_pricing` (path shortened, the time varies):

```text
F
======================================================================
FAIL: test_calculate (test_pricing.TestPricing.test_calculate) (price=10, tax=0.1, discount=0)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_pricing.py", line 17, in test_calculate
    self.assertEqual(calculate(price, tax, discount), expected)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 11.0 != 10

----------------------------------------------------------------------
Ran 1 test in 0.000s

FAILED (failures=1)
```

The label shows the exact inputs, so you can reproduce the case in a REPL right away: `calculate(10, 0.1, 0)`.

### Message and parameters together, nesting, no label

You can combine both forms, and you can nest subtests. The labels are merged:

| Call | Label in the report |
|---|---|
| `self.subTest("Has tax")` | `[Has tax]` |
| `self.subTest(n=3)` | `(n=3)` |
| `self.subTest("checking parity", n=3)` | `[checking parity] (n=3)` |
| `self.subTest(value=20)` inside `self.subTest(low=0, high=10)` | `(value=20, low=0, high=10)` |
| `self.subTest()` | `(<subtest>)` |

Nesting is handy for a grid of cases: an outer loop over configurations, an inner loop over inputs (see Exercise 4). A subtest with no label is legal but nearly useless: with several failures, `(<subtest>)` does not tell you which case broke.

## How subtests behave

The next test module mixes the situations you will meet in practice: failing subtests, an unexpected exception and a skipped subtest.

```python
import unittest


class TestBehaviour(unittest.TestCase):
    def test_even(self):
        for n in [2, 3, 4, 5]:
            with self.subTest("checking parity", n=n):
                self.assertEqual(n % 2, 0)

    def test_parse(self):
        for value in ["10", "x", None]:
            with self.subTest(value=value):
                if value is None:
                    self.skipTest("no value")
                self.assertGreater(int(value), 0)
```

Output of `python -m unittest test_behaviour -v` (path shortened, the time varies):

```text
test_even (test_behaviour.TestBehaviour.test_even) ...
  test_even (test_behaviour.TestBehaviour.test_even) [checking parity] (n=3) ... FAIL
  test_even (test_behaviour.TestBehaviour.test_even) [checking parity] (n=5) ... FAIL
test_parse (test_behaviour.TestBehaviour.test_parse) ...
  test_parse (test_behaviour.TestBehaviour.test_parse) (value='x') ... ERROR
  test_parse (test_behaviour.TestBehaviour.test_parse) (value=None) ... skipped 'no value'

======================================================================
ERROR: test_parse (test_behaviour.TestBehaviour.test_parse) (value='x')
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_behaviour.py", line 15, in test_parse
    self.assertGreater(int(value), 0)
                       ~~~^^^^^^^
ValueError: invalid literal for int() with base 10: 'x'

======================================================================
FAIL: test_even (test_behaviour.TestBehaviour.test_even) [checking parity] (n=3)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_behaviour.py", line 8, in test_even
    self.assertEqual(n % 2, 0)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^
AssertionError: 1 != 0

======================================================================
FAIL: test_even (test_behaviour.TestBehaviour.test_even) [checking parity] (n=5)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_behaviour.py", line 8, in test_even
    self.assertEqual(n % 2, 0)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^
AssertionError: 1 != 0

----------------------------------------------------------------------
Ran 2 tests in 0.002s

FAILED (failures=2, errors=1, skipped=1)
```

What this shows:

- **Failures and errors are both isolated.** The `ValueError` from `int("x")` is reported as an `ERROR` of the subtest `(value='x')`, and the loop still reaches `None`.
- **`skipTest()` inside a subtest skips only that subtest**, as described in the topic Skipping Tests.
- **Passing subtests are silent.** `n=2`, `n=4` and `value='10'` passed and are not listed.

A few more rules are worth knowing:

- **`setUp()` and `tearDown()` run once per test method, not once per subtest.** All subtests of a method share the same fixture, so a subtest that changes `self.something` affects the next one. Exercise 3 shows this trap.
- **`--failfast` (`-f`) stops at the first failing subtest.** With `python -m unittest -f test_behaviour`, only the `n=3` failure is reported, `n=5` is not checked, and `test_parse` does not run at all (`Ran 1 test`).
- **Only code inside the `with` block is protected.** An assertion placed in the loop but outside `subTest()` still ends the whole method on failure.

## Alternative: `pytest.mark.parametrize`

If your project uses the third-party test runner **pytest** (`python -m pip install pytest`), it has parameterization built in. Each row becomes a separate test with its own ID:

```python
import pytest

from pricing import calculate


@pytest.mark.parametrize(
    ("price", "tax", "discount", "expected"),
    [
        (10, 0, 0, 10),
        (10, 0.1, 0, 11),
        (10, 0, 1, 9),
        (10, 0.1, 1, 9.9),
    ],
)
def test_calculate(price, tax, discount, expected):
    assert calculate(price, tax, discount) == expected
```

Output of `pytest -v test_pricing_pytest.py` (header lines omitted, the time varies):

```text
test_pricing_pytest.py::test_calculate[10-0-0-10] PASSED                 [ 25%]
test_pricing_pytest.py::test_calculate[10-0.1-0-11] PASSED               [ 50%]
test_pricing_pytest.py::test_calculate[10-0-1-9] PASSED                  [ 75%]
test_pricing_pytest.py::test_calculate[10-0.1-1-9.9] PASSED              [100%]

============================== 4 passed in 0.01s ===============================
```

With the standard library alone, `subTest()` is the tool. For `unittest`-style classes there is also the third-party package `parameterized`, which generates one test method per row with a decorator.

## Common mistakes

- **Looping without `subTest()`.** The first failing case hides all the others, and the report does not say which case it was.
- **Asserting outside the `with` block.** Only failures inside `subTest()` are isolated:

  ```python
  for n in [1, 2, 3]:
      result = n * 2
      self.assertGreater(result, 0)  # not protected: a failure here stops the loop
      with self.subTest(n=n):
          self.assertEqual(result % 2, 0)  # protected
  ```

- **Giving no label.** `self.subTest()` without arguments reports `(<subtest>)`. Always pass the inputs (`n=n`) or a short message.
- **Expecting a fresh fixture per subtest.** `setUp()` runs once for the whole method. Create per-case state inside the `with` block.
- **Comparing raw floats with `assertEqual()`.** `calculate()` rounds its result, so exact comparison works. Without rounding, `10 * (1 + 0.07)` is `10.700000000000001`, and `assertEqual(..., 10.7)` fails. Use `assertAlmostEqual()` for unrounded floats.
- **Reading "Ran 1 test" as "one case was checked".** The counter shows test methods. Use `-v` to see which subtests failed or were skipped.

## Summary

- A parameterized test runs one test body over a table of cases. It removes duplication when cases differ only in their data.
- A plain loop stops at the first failure and does not identify the failing case.
- `with self.subTest(msg, **params):` isolates each iteration: failures and errors are recorded per subtest, and the loop continues.
- The message appears in `[...]`, keyword parameters in `(...)`. Nested subtests merge their parameters.
- "Ran N tests" counts methods, while failures, errors and skips are counted per subtest.
- `setUp()`/`tearDown()` run once per method, `skipTest()` skips one subtest, and `--failfast` stops at the first failing subtest.
- pytest's `@pytest.mark.parametrize` turns every row into a separate test, which is the main alternative outside the standard library.

## Practice

### Exercise 1: Leap years in one test

`leap.py` contains:

```python
def is_leap(year):
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)
```

Write a single test method that checks the years `2024`, `2023`, `1900`, `2000` and `2100` against the expected results, using `subTest()` with a keyword parameter. Use `assertIs()` so that only real `True`/`False` values pass.

### Exercise 2: Let the subtests find the bugs

`ports.py` should accept only plain ASCII digit strings with a value from 1 to 65535:

```python
def parse_port(text):
    port = int(text)
    if not 1 <= port <= 65535:
        raise ValueError(f"port out of range: {port}")
    return port
```

Write tests with `subTest()`: one method for the valid inputs `"1"`, `"80"`, `"65535"`, and one that checks that `""`, `"http"`, `"0"`, `"65536"`, `"-1"`, `" 80"`, `"+80"` and `"8_0"` all raise `ValueError`. Run them, read which subtests fail, and then fix `parse_port()`.

### Exercise 3: The shared fixture trap

Explain why two of the three subtests fail, and fix the test so that every subtest checks a fresh, empty cart:

```python
import unittest


class TestCart(unittest.TestCase):
    def setUp(self):
        self.cart = []

    def test_add_one_item(self):
        for item in ["apple", "pear", "plum"]:
            with self.subTest(item=item):
                self.cart.append(item)
                self.assertEqual(len(self.cart), 1)
```

### Exercise 4: A grid with nested subtests

`clamp.py` contains:

```python
def clamp(value, low, high):
    return max(low, min(value, high))
```

Write a test that loops over the ranges `(0, 10)` and `(-5, 5)` in an outer `subTest(low=..., high=...)` and over the values `-20`, `0`, `3`, `20` in an inner `subTest(value=...)`. Check that the result always lies within `[low, high]` and equals `value` when `value` is already in range. Then replace the body with the buggy `return min(low, max(value, high))` and look at the labels of the failing subtests.

## Solutions

### Exercise 1

```python
import unittest

from leap import is_leap


class TestIsLeap(unittest.TestCase):
    def test_is_leap(self):
        cases = {
            2024: True,
            2023: False,
            1900: False,
            2000: True,
            2100: False,
        }
        for year, expected in cases.items():
            with self.subTest(year=year):
                self.assertIs(is_leap(year), expected)
```

Output of `python -m unittest test_leap -v` (the time varies):

```text
test_is_leap (test_leap.TestIsLeap.test_is_leap) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

A dict maps each input to its expected result, which keeps the table readable. `1900` and `2100` are the interesting rows: divisible by 4 and by 100, but not by 400.

### Exercise 2

```python
import unittest

from ports import parse_port


class TestParsePort(unittest.TestCase):
    def test_valid(self):
        for text, expected in [("1", 1), ("80", 80), ("65535", 65535)]:
            with self.subTest(text=text):
                self.assertEqual(parse_port(text), expected)

    def test_invalid(self):
        for text in ["", "http", "0", "65536", "-1", " 80", "+80", "8_0"]:
            with self.subTest(text=text):
                with self.assertRaises(ValueError):
                    parse_port(text)
```

Output of `python -m unittest test_ports` with the original `parse_port()` (path shortened, the time varies):

```text
FFF.
======================================================================
FAIL: test_invalid (test_ports.TestParsePort.test_invalid) (text=' 80')
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_ports.py", line 15, in test_invalid
    with self.assertRaises(ValueError):
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
AssertionError: ValueError not raised

======================================================================
FAIL: test_invalid (test_ports.TestParsePort.test_invalid) (text='+80')
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_ports.py", line 15, in test_invalid
    with self.assertRaises(ValueError):
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
AssertionError: ValueError not raised

======================================================================
FAIL: test_invalid (test_ports.TestParsePort.test_invalid) (text='8_0')
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_ports.py", line 15, in test_invalid
    with self.assertRaises(ValueError):
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
AssertionError: ValueError not raised

----------------------------------------------------------------------
Ran 2 tests in 0.001s

FAILED (failures=3)
```

All three bugs show up in one run. `int()` is more lenient than the specification: it strips surrounding whitespace, accepts a sign and allows underscores between digits (`int("8_0")` is `80`). The fix checks the text before converting it:

```python
def parse_port(text):
    if not (text.isascii() and text.isdigit()):
        raise ValueError(f"not a plain number: {text!r}")
    port = int(text)
    if not 1 <= port <= 65535:
        raise ValueError(f"port out of range: {port}")
    return port
```

`isascii()` is needed because `isdigit()` alone also accepts digits from other scripts, such as Arabic-Indic `"٨٠"`. Now `python -m unittest test_ports -v` prints:

```text
test_invalid (test_ports.TestParsePort.test_invalid) ... ok
test_valid (test_ports.TestParsePort.test_valid) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

### Exercise 3

`setUp()` runs once for `test_add_one_item`, not once per subtest, so all three subtests share one list. After `"apple"` the cart has 1 item (pass), after `"pear"` it has 2 and after `"plum"` 3. Output of the original test (path shortened, the time varies):

```text
FF
======================================================================
FAIL: test_add_one_item (test_cart.TestCart.test_add_one_item) (item='pear')
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_cart.py", line 12, in test_add_one_item
    self.assertEqual(len(self.cart), 1)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^
AssertionError: 2 != 1

======================================================================
FAIL: test_add_one_item (test_cart.TestCart.test_add_one_item) (item='plum')
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_cart.py", line 12, in test_add_one_item
    self.assertEqual(len(self.cart), 1)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^
AssertionError: 3 != 1

----------------------------------------------------------------------
Ran 1 test in 0.000s

FAILED (failures=2)
```

The fix creates the state inside the subtest:

```python
import unittest


class TestCart(unittest.TestCase):
    def test_add_one_item(self):
        for item in ["apple", "pear", "plum"]:
            with self.subTest(item=item):
                cart = []  # fresh state for every subtest
                cart.append(item)
                self.assertEqual(len(cart), 1)
```

Output of `python -m unittest test_cart -v` (the time varies):

```text
test_add_one_item (test_cart.TestCart.test_add_one_item) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

If the setup is expensive or complex, move it into a helper method (for example `self.make_cart()`) and call it at the start of each subtest.

### Exercise 4

```python
import unittest

from clamp import clamp


class TestClamp(unittest.TestCase):
    def test_result_is_inside_range(self):
        for low, high in [(0, 10), (-5, 5)]:
            with self.subTest(low=low, high=high):
                for value in [-20, 0, 3, 20]:
                    with self.subTest(value=value):
                        result = clamp(value, low, high)
                        self.assertTrue(low <= result <= high)
                        if low <= value <= high:
                            self.assertEqual(result, value)
```

With the correct `clamp()`, `python -m unittest test_clamp -v` prints `test_result_is_inside_range (...) ... ok`. With the buggy `min(low, max(value, high))` it prints (path shortened, the time varies):

```text
FFF
======================================================================
FAIL: test_result_is_inside_range (test_clamp.TestClamp.test_result_is_inside_range) (value=3, low=0, high=10)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_clamp.py", line 15, in test_result_is_inside_range
    self.assertEqual(result, value)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
AssertionError: 0 != 3

======================================================================
FAIL: test_result_is_inside_range (test_clamp.TestClamp.test_result_is_inside_range) (value=0, low=-5, high=5)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_clamp.py", line 15, in test_result_is_inside_range
    self.assertEqual(result, value)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
AssertionError: -5 != 0

======================================================================
FAIL: test_result_is_inside_range (test_clamp.TestClamp.test_result_is_inside_range) (value=3, low=-5, high=5)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_clamp.py", line 15, in test_result_is_inside_range
    self.assertEqual(result, value)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^
AssertionError: -5 != 3

----------------------------------------------------------------------
Ran 1 test in 0.001s

FAILED (failures=3)
```

Each label combines the inner parameter with the outer ones, for example `(value=3, low=0, high=10)`, so every failing point of the grid is identified exactly. The buggy version always returns `low`. That is why the "inside the range" check never fails, and only the "equals `value`" check catches the bug: a good reminder that one property alone rarely proves a function correct.

---

*Source: [pythontutorial.net — Python unittest subtest](https://www.pythontutorial.net/python-unit-testing/python-unittest-subtest/). Adapted and expanded for PyJourney.*
