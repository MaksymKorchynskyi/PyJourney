# assertEqual()

`assertEqual()` is the workhorse of `unittest`: most tests end by comparing what the code returned with what it should have returned. It looks trivial, but it has a few features worth knowing, such as readable diffs for lists, dicts and strings, and a few traps, such as floats and objects that do not define equality.

## What you'll learn

- What exactly `assertEqual(first, second, msg=None)` checks
- How to read its failure messages, including the diffs for lists, dicts, sets and multi-line strings
- How `maxDiff` controls long diffs
- How to add context with the `msg` argument
- How `assertNotEqual()` works and when it is (and is not) useful
- Why floats and custom objects often break `assertEqual()`

## How `assertEqual()` works

```python
assertEqual(first, second, msg=None)
```

The test passes when `first == second` is true. Otherwise `assertEqual()` raises `AssertionError` and the test is reported as `FAIL`. The optional `msg` adds your own explanation to the failure message.

Here is a function in `main.py`:

```python
def add(a, b):
    return a + b
```

And its test in `test_main.py`. The second test is wrong on purpose, so you can see a failure:

```python
import unittest

from main import add


class TestMain(unittest.TestCase):
    def test_add(self):
        self.assertEqual(add(1, 2), 3)

    def test_add_strings(self):
        self.assertEqual(add("1", "2"), 3)
```

Run it:

```bash
python3 -m unittest test_main -v
```

Output (paths shortened, timing varies):

```text
test_add (test_main.TestMain.test_add) ... ok
test_add_strings (test_main.TestMain.test_add_strings) ... FAIL

======================================================================
FAIL: test_add_strings (test_main.TestMain.test_add_strings)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_main.py", line 11, in test_add_strings
    self.assertEqual(add("1", "2"), 3)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^
AssertionError: '12' != 3

----------------------------------------------------------------------
Ran 2 tests in 0.000s

FAILED (failures=1)
```

The message `'12' != 3` shows both values with `repr()`. That is why the quotes are there: you can immediately see that the result is the **string** `'12'`, not a number.

> **Tip:** The order of arguments does not change whether the test passes, but it does change how the message reads. The usual convention (and the one used in this section) is `assertEqual(actual, expected)`: the value your code produced first, the expected value second. Pick one order and stick to it.

### Equality means `==`, nothing more

`assertEqual()` uses the `==` operator, so it inherits all of its rules:

- `assertEqual(1, 1.0)` and `assertEqual(1, True)` **pass**, because `1 == 1.0 == True` in Python. `assertEqual()` does not compare types.
- `assertEqual([1, 2], (1, 2))` **fails**: a list is never equal to a tuple.
- `assertEqual({"a": 1, "b": 2}, {"b": 2, "a": 1})` **passes**: dicts compare by content, not by insertion order.
- `assertEqual(float("nan"), float("nan"))` **fails**, because NaN is not equal to anything, including itself.

If the type matters too, add a separate check such as `assertIs(type(result), int)` or `assertIsInstance()` (see the topic assertIsInstance()).

## Diffs for containers and strings

When both arguments have **exactly the same type** and it is `list`, `tuple`, `dict`, `set`, `frozenset` or `str`, `assertEqual()` hands the comparison to a specialised method (`assertListEqual()`, `assertDictEqual()`, `assertMultiLineEqual()` and so on). Those methods add a diff to the message. Here are five failing tests:

```python
import unittest


class TestDiffs(unittest.TestCase):
    def test_list(self):
        self.assertEqual([1, 2, 3, 4], [1, 2, 5, 4])

    def test_dict(self):
        user = {"name": "olena", "age": 30, "city": "Lviv"}
        self.assertEqual(user, {"name": "olena", "age": 31, "city": "Lviv"})

    def test_text(self):
        report = "total: 3\nfailed: 1\nskipped: 0\n"
        self.assertEqual(report, "total: 3\nfailed: 0\nskipped: 0\n")

    def test_set(self):
        self.assertEqual({"read", "write"}, {"read", "delete"})

    def test_different_types(self):
        self.assertEqual([1, 2], (1, 2))
```

The `AssertionError` parts of `python3 -m unittest test_diffs` (tracebacks trimmed, tests in alphabetical order):

```text
AssertionError: {'name': 'olena', 'age': 30, 'city': 'Lviv'} != {'name': 'olena', 'age': 31, 'city': 'Lviv'}
- {'age': 30, 'city': 'Lviv', 'name': 'olena'}
?          ^

+ {'age': 31, 'city': 'Lviv', 'name': 'olena'}
?          ^

AssertionError: [1, 2] != (1, 2)

AssertionError: Lists differ: [1, 2, 3, 4] != [1, 2, 5, 4]

First differing element 2:
3
5

- [1, 2, 3, 4]
?        ^

+ [1, 2, 5, 4]
?        ^

AssertionError: Items in the first set but not the second:
'write'
Items in the second set but not the first:
'delete'

AssertionError: 'total: 3\nfailed: 1\nskipped: 0\n' != 'total: 3\nfailed: 0\nskipped: 0\n'
  total: 3
- failed: 1
?         ^
+ failed: 0
?         ^
  skipped: 0
```

How to read these diffs:

- Lines starting with `-` come from the **first** argument, lines starting with `+` from the **second**. Lines starting with two spaces are the same in both.
- A `?` line puts a `^` under the characters that differ (or `+` under extra ones).
- For lists and tuples, `First differing element 2:` gives the index, followed by the two values at that index.
- In the dict diff the keys are **sorted** (`age`, `city`, `name`). The diff is built with `pprint`, which sorts dict keys, so do not be surprised that the order differs from your code.
- For sets, you get the items missing on each side instead of a diff.
- `[1, 2]` and `(1, 2)` have different types, so there is no specialised method and no diff, just `!=`.

> **Note:** The specialised method is chosen only when `type(first) is type(second)`. A subclass of `list` compared with a plain `list`, for example, falls back to the simple `first != second` message.

### Long values and `maxDiff`

Long values are shortened in the first line of the message (`[181 chars]` below), and a diff longer than `maxDiff` characters (default `640`, that is 80 × 8) is replaced with a hint:

```python
import unittest


class TestLong(unittest.TestCase):
    def test_numbers(self):
        expected = list(range(100))
        actual = list(range(100))
        actual[50] = -1
        self.assertEqual(actual, expected)
```

The `AssertionError` part of the output:

```text
AssertionError: Lists differ: [0, 1[181 chars] 49, -1, 51, 52, 53, 54, 55, 56, 57, 58, 59, 6[153 chars], 99] != [0, 1[181 chars] 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 6[153 chars], 99]

First differing element 50:
-1
50

Diff is 697 characters long. Set self.maxDiff to None to see it.
```

`First differing element 50` already locates the problem here. When you need the full diff, set the class attribute `maxDiff = None` (no limit) or a bigger number:

```python
class TestLongFullDiff(TestLong):
    maxDiff = None
```

This class inherits `test_numbers` and now prints the full diff: one line per element, with the difference marked by `-  -1,` and `+  50,`. `maxDiff` can also be set on a single test with `self.maxDiff = None`.

## Adding context with `msg`

The values alone do not always explain *which* case failed, especially in a loop. The `msg` argument is appended after ` : ` (the details of `longMessage` are in the topic Assert Methods):

```python
import unittest


def apply_discount(price, percent):
    return price - price * percent // 100


class TestDiscount(unittest.TestCase):
    def test_discounts(self):
        cases = [(200, 10, 180), (99, 50, 49.5), (100, 0, 100)]
        for price, percent, expected in cases:
            self.assertEqual(
                apply_discount(price, percent),
                expected,
                f"price={price}, percent={percent}",
            )
```

The `AssertionError` line of `python3 -m unittest test_msg`:

```text
AssertionError: 50 != 49.5 : price=99, percent=50
```

Without the message you would see only `50 != 49.5` and have to work out which input produced it. (The bug is the floor division `//`, which drops the fractional part.)

> **Tip:** In a loop, `with self.subTest(price=price, percent=percent):` is even better than `msg`: the loop continues after a failure, and each failing case is reported separately (see the topic Unittest Framework).

## `assertNotEqual()`

```python
assertNotEqual(first, second, msg=None)
```

The opposite check: the test passes when `first != second` is true. When the values are equal, the message is `first == second`:

```python
import unittest


def new_session_id(previous):
    return previous  # bug: should generate a new id


class TestSession(unittest.TestCase):
    def test_new_id_differs(self):
        old = "a1b2"
        self.assertNotEqual(new_session_id(old), old)
```

The `AssertionError` line of `python3 -m unittest test_ne`:

```text
AssertionError: 'a1b2' == 'a1b2'
```

`assertNotEqual()` is a weak check on its own: it says what the result is *not*, so almost any wrong value passes it. Use it when "different" really is the requirement (a new ID, a changed password hash, a shuffled list), and prefer `assertEqual()` with the exact expected value whenever you know it.

### The float example

You will often see this test:

```python
import unittest

from main import add


class TestMain(unittest.TestCase):
    def test_add(self):
        self.assertEqual(add(1, 2), 3)

    def test_add_floats(self):
        self.assertNotEqual(add(0.2, 0.1), 0.3)
```

Output of `python3 -m unittest test_main -v`:

```text
test_add (test_main.TestMain.test_add) ... ok
test_add_floats (test_main.TestMain.test_add_floats) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

It passes because `0.2 + 0.1` is `0.30000000000000004` in binary floating point. This demonstrates the rounding error nicely, but it is not a useful test of `add()`: it would also pass if `add()` returned `0` or `42.0`. To check float results, use `assertAlmostEqual()`, covered in the next topic.

## Common mistakes

- **Comparing floats with `assertEqual()`.** `self.assertEqual(0.1 * 3, 0.3)` fails with `0.30000000000000004 != 0.3`. Use `assertAlmostEqual()`.
- **Comparing objects that do not define `__eq__`.** By default, two instances of your class are equal only if they are the *same* object:

  ```python
  import unittest


  class Point:
      def __init__(self, x, y):
          self.x = x
          self.y = y


  class TestPoint(unittest.TestCase):
      def test_equal_points(self):
          self.assertEqual(Point(1, 2), Point(1, 2))
  ```

  This fails with a message like the one below (the addresses vary from run to run):

  ```text
  AssertionError: <test_point.Point object at 0x1053ca3c0> != <test_point.Point object at 0x1053ee210>
  ```

  Define `__eq__`, or turn the class into a `@dataclass`, which generates both `__eq__` and a readable `__repr__`. With `@dataclass` the same kind of failure reads `Point(x=1, y=2) != Point(x=1, y=3)`.
- **Expecting `assertEqual()` to check the type.** `assertEqual(result, 1)` passes for `1`, `1.0` and `True`. Add `assertIsInstance()` or `assertIs(type(result), int)` when the type is part of the contract.
- **Comparing lists when the order does not matter.** `assertEqual([3, 1, 2], [1, 2, 3])` fails. If the order really is irrelevant, use `assertCountEqual()`.
- **Swapping the argument order from test to test.** The diff marks the first argument with `-` and the second with `+`. If the order changes randomly, every failure has to be decoded from scratch.
- **Using the old alias `assertEquals()`.** It was removed in Python 3.12 and now raises `AttributeError`.

## Summary

- `assertEqual(first, second, msg=None)` passes when `first == second`. It follows the rules of `==`, so `1`, `1.0` and `True` are all equal.
- Failure messages show both values with `repr()`, which makes type mix-ups such as `'12' != 3` visible.
- For two lists, tuples, dicts, sets or strings of the same type, the message contains a diff: `-` lines come from the first argument, `+` lines from the second.
- Diffs longer than `maxDiff` (640 characters) are hidden. Set `maxDiff = None` to see them all.
- `msg` is appended after ` : ` and should say which case was being checked.
- `assertNotEqual()` passes when `first != second`. It is a weak check, so use it only when "different" is the actual requirement.
- Do not compare floats with `assertEqual()`, and give your classes an `__eq__` (or use `@dataclass`) before comparing their instances.

## Practice

### Exercise 1: Test `initials()`

`names.py` contains:

```python
def initials(full_name):
    return "".join(part[0].upper() for part in full_name.split())
```

Write `test_names.py` with four tests: `"olena kovalenko"` gives `"OK"`, `"  taras   shevchenko "` gives `"TS"`, an empty string gives an empty string, and (with `assertNotEqual()`) the result for `"ada lovelace"` is not the lower-case `"al"`.

### Exercise 2: Predict the result

Which of these checks pass and which fail? Write your answers down, then run them in one test using `subTest()` and compare.

1. `assertEqual(1, 1.0)`
2. `assertEqual(True, 1)`
3. `assertEqual([1, 2], (1, 2))`
4. `assertEqual({"a": 1, "b": 2}, {"b": 2, "a": 1})`
5. `assertEqual("abc", "abc ")`
6. `assertEqual(0.1 * 3, 0.3)`
7. `assertEqual([3, 1, 2], [1, 2, 3])`

### Exercise 3: Make `Money` comparable

`money.py` contains:

```python
class Money:
    def __init__(self, amount, currency):
        self.amount = amount
        self.currency = currency

    def __add__(self, other):
        return Money(self.amount + other.amount, self.currency)
```

This test fails even though the addition is correct:

```python
import unittest

from money import Money


class TestMoney(unittest.TestCase):
    def test_add(self):
        self.assertEqual(Money(10, "UAH") + Money(5, "UAH"), Money(15, "UAH"))
```

Explain why. Then change `Money` so that the test passes and failure messages become readable, and add a test that checks that `Money(10, "UAH")` is not equal to `Money(10, "EUR")`.

## Solutions

### Exercise 1

```python
import unittest

from names import initials


class TestInitials(unittest.TestCase):
    def test_two_words(self):
        self.assertEqual(initials("olena kovalenko"), "OK")

    def test_extra_spaces(self):
        self.assertEqual(initials("  taras   shevchenko "), "TS")

    def test_empty_string(self):
        self.assertEqual(initials(""), "")

    def test_result_is_upper_case(self):
        self.assertNotEqual(initials("ada lovelace"), "al")
```

Output of `python3 -m unittest test_names -v`:

```text
test_empty_string (test_names.TestInitials.test_empty_string) ... ok
test_extra_spaces (test_names.TestInitials.test_extra_spaces) ... ok
test_result_is_upper_case (test_names.TestInitials.test_result_is_upper_case) ... ok
test_two_words (test_names.TestInitials.test_two_words) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

`split()` without arguments splits on any run of whitespace and ignores leading and trailing spaces, so the extra spaces do not create empty parts. Note that the last test is weaker than `assertEqual(initials("ada lovelace"), "AL")`, which pins down the exact result.

### Exercise 2

Checks 1, 2 and 4 pass. Checks 3, 5, 6 and 7 fail.

```python
import unittest


class TestPredict(unittest.TestCase):
    def test_pairs(self):
        pairs = [
            (1, 1.0),
            (True, 1),
            ([1, 2], (1, 2)),
            ({"a": 1, "b": 2}, {"b": 2, "a": 1}),
            ("abc", "abc "),
            (0.1 * 3, 0.3),
            ([3, 1, 2], [1, 2, 3]),
        ]
        for number, (first, second) in enumerate(pairs, start=1):
            with self.subTest(number=number):
                self.assertEqual(first, second)
```

The `FAIL` headers and `AssertionError` parts of `python3 -m unittest test_predict` (tracebacks trimmed):

```text
FAIL: test_pairs (test_predict.TestPredict.test_pairs) (number=3)
AssertionError: [1, 2] != (1, 2)

FAIL: test_pairs (test_predict.TestPredict.test_pairs) (number=5)
AssertionError: 'abc' != 'abc '
- abc
+ abc 
?    +

FAIL: test_pairs (test_predict.TestPredict.test_pairs) (number=6)
AssertionError: 0.30000000000000004 != 0.3

FAIL: test_pairs (test_predict.TestPredict.test_pairs) (number=7)
AssertionError: Lists differ: [3, 1, 2] != [1, 2, 3]

First differing element 0:
3
1

- [3, 1, 2]
+ [1, 2, 3]
```

- 1 and 2: `==` treats `1`, `1.0` and `True` as equal.
- 3: a list and a tuple are never equal.
- 4: dict equality ignores insertion order.
- 5: the trailing space matters. The diff's `?` line marks it with `+`.
- 6: floating-point rounding error.
- 7: list equality depends on order.

### Exercise 3

`Money` does not define `__eq__`, so `==` falls back to identity: two different `Money` objects are never equal, whatever their contents. The failure message only shows `<money.Money object at 0x...>` because there is no `__repr__` either.

A frozen dataclass fixes both problems. `money.py`:

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Money:
    amount: int
    currency: str

    def __add__(self, other):
        return Money(self.amount + other.amount, self.currency)
```

`test_money.py`:

```python
import unittest

from money import Money


class TestMoney(unittest.TestCase):
    def test_add(self):
        self.assertEqual(Money(10, "UAH") + Money(5, "UAH"), Money(15, "UAH"))

    def test_currency_matters(self):
        self.assertNotEqual(Money(10, "UAH"), Money(10, "EUR"))
```

Output of `python3 -m unittest test_money -v`:

```text
test_add (test_money.TestMoney.test_add) ... ok
test_currency_matters (test_money.TestMoney.test_currency_matters) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

If the sum were wrong (say, the expected value were `Money(16, "UAH")`), the failure would now read `Money(amount=15, currency='UAH') != Money(amount=16, currency='UAH')`. `frozen=True` is optional, but it suits a value object: money amounts should not change after creation.

---

*Source: [pythontutorial.net — Python assertEqual()](https://www.pythontutorial.net/python-unit-testing/python-assertequal/). Adapted and expanded for PyJourney.*
