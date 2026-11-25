# Assert Methods

An assertion is the line of a test that actually checks something. `unittest.TestCase` provides dozens of `assert*` methods, each designed for one kind of check. Picking the right one matters: it decides whether a failing test tells you `False is not true` or `'kiwi' not found in ['apple', 'banana']`.

## What you'll learn

- Why `self.assert*()` methods are better than a bare `assert` statement
- The commonly used assert methods, grouped by what they check
- How the optional `msg` argument and the `longMessage` attribute shape failure messages
- How to check exceptions, warnings and log messages
- Which methods were added in Python 3.14 and which old aliases no longer exist

## Why assert methods instead of `assert`

Every assert method does the same basic thing: if the check fails, it raises `AssertionError`, and the runner reports the test as `FAIL`. A plain `assert` statement does that too, so why not use it?

- **Better messages.** `self.assertGreater(3, 5)` fails with `3 not greater than 5`. `assert 3 > 5` fails with just `AssertionError`.
- **Diffs for containers.** `assertEqual()` on two lists, dicts or long strings shows exactly where they differ.
- **They cannot be switched off.** Python removes `assert` statements when run with `-O`. Assert methods are ordinary method calls and always run.

> **Note:** Other test frameworks such as pytest rewrite plain `assert` statements to produce detailed messages. In `unittest`, use the methods.

## The most common assert methods

### Equality, identity, truth and membership

| Method | Passes if |
|---|---|
| `assertEqual(a, b)` | `a == b` |
| `assertNotEqual(a, b)` | `a != b` |
| `assertTrue(x)` | `bool(x)` is `True` |
| `assertFalse(x)` | `bool(x)` is `False` |
| `assertIs(a, b)` | `a is b` |
| `assertIsNot(a, b)` | `a is not b` |
| `assertIsNone(x)` | `x is None` |
| `assertIsNotNone(x)` | `x is not None` |
| `assertIn(a, b)` | `a in b` |
| `assertNotIn(a, b)` | `a not in b` |
| `assertIsInstance(a, b)` | `isinstance(a, b)` |
| `assertNotIsInstance(a, b)` | `not isinstance(a, b)` |

### Comparisons and special checks

| Method | Passes if |
|---|---|
| `assertGreater(a, b)` | `a > b` |
| `assertGreaterEqual(a, b)` | `a >= b` |
| `assertLess(a, b)` | `a < b` |
| `assertLessEqual(a, b)` | `a <= b` |
| `assertAlmostEqual(a, b)` | `round(a - b, 7) == 0` |
| `assertNotAlmostEqual(a, b)` | `round(a - b, 7) != 0` |
| `assertRegex(s, r)` | `re.search(r, s)` finds a match |
| `assertNotRegex(s, r)` | `re.search(r, s)` finds no match |
| `assertCountEqual(a, b)` | `a` and `b` contain the same elements, each the same number of times, in any order |

Here they are in action:

```python
import unittest


class TestOverview(unittest.TestCase):
    def test_equality_and_identity(self):
        self.assertEqual(2 + 2, 4)
        self.assertNotEqual("a", "b")
        self.assertIs(None, None)
        self.assertIsNot([], [])

    def test_truth_and_none(self):
        self.assertTrue([1])
        self.assertFalse("")
        self.assertIsNone({}.get("missing"))
        self.assertIsNotNone(0)

    def test_membership_and_type(self):
        self.assertIn(3, [1, 2, 3])
        self.assertNotIn("x", "python")
        self.assertIsInstance(True, int)
        self.assertNotIsInstance(1.0, int)

    def test_comparisons(self):
        self.assertGreater(5, 3)
        self.assertGreaterEqual(5, 5)
        self.assertLess(1, 2)
        self.assertLessEqual(2, 2)
        self.assertAlmostEqual(0.1 + 0.2, 0.3)
        self.assertRegex("order-1234", r"\d{4}")
        self.assertCountEqual([3, 1, 2, 1], [1, 1, 2, 3])
```

Output of `python3 -m unittest -v` (the file is `test_overview.py`, timing varies):

```text
test_comparisons (test_overview.TestOverview.test_comparisons) ... ok
test_equality_and_identity (test_overview.TestOverview.test_equality_and_identity) ... ok
test_membership_and_type (test_overview.TestOverview.test_membership_and_type) ... ok
test_truth_and_none (test_overview.TestOverview.test_truth_and_none) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

A few details worth noticing: `assertIsNot([], [])` passes because two list literals create two different objects. `assertIsNotNone(0)` passes because `0` is falsy but is not `None`. `assertIsInstance(True, int)` passes because `bool` is a subclass of `int`.

### What the failure messages look like

The real value of specific methods shows when they fail:

```python
import unittest


class TestFailureMessages(unittest.TestCase):
    def test_true(self):
        self.assertTrue(3 > 5)

    def test_greater(self):
        self.assertGreater(3, 5)

    def test_in(self):
        self.assertIn("kiwi", ["apple", "banana"])

    def test_count_equal(self):
        self.assertCountEqual([1, 2, 2], [2, 1, 1])

    def test_regex(self):
        self.assertRegex("order-12", r"\d{4}")
```

The `AssertionError` lines from `python3 -m unittest test_failures` (tracebacks trimmed):

```text
AssertionError: Element counts were not equal:
First has 1, Second has 2:  1
First has 2, Second has 1:  2

AssertionError: 3 not greater than 5

AssertionError: 'kiwi' not found in ['apple', 'banana']

AssertionError: Regex didn't match: '\\d{4}' not found in 'order-12'

AssertionError: False is not true
```

`assertTrue(3 > 5)` only knows it received `False`. The comparison was evaluated before the call, so the values `3` and `5` are lost. Every other method received both values and can describe the problem.

## The `msg` argument and `longMessage`

Every assert method accepts an optional last argument, `msg`, with your own explanation. By default it is **appended** to the standard message after ` : `:

```python
import unittest


class TestMessage(unittest.TestCase):
    def test_default(self):
        stock = 3
        self.assertGreaterEqual(stock, 5, "not enough items in stock")


class TestShortMessage(unittest.TestCase):
    longMessage = False

    def test_short(self):
        stock = 3
        self.assertGreaterEqual(stock, 5, "not enough items in stock")
```

The two `AssertionError` lines from `python3 -m unittest test_msg`:

```text
AssertionError: 3 not greater than or equal to 5 : not enough items in stock
AssertionError: not enough items in stock
```

The class attribute `longMessage` (default `True`) controls this. Setting it to `False` makes `msg` **replace** the standard message, which usually loses useful information. Keep the default and use `msg` to add context the values alone do not give, such as which record or which input was being checked.

## Exceptions, warnings and logs

These methods check *behaviour* rather than values. All of them work as context managers:

| Method | Passes if the code inside the block... |
|---|---|
| `assertRaises(exc)` | raises `exc` (or a subclass) |
| `assertRaisesRegex(exc, r)` | raises `exc` and its message matches regex `r` |
| `assertWarns(warn)` | triggers warning category `warn` |
| `assertWarnsRegex(warn, r)` | triggers `warn` and its message matches `r` |
| `assertLogs(logger, level)` | logs at least one message on `logger` at `level` or higher |
| `assertNoLogs(logger, level)` | logs nothing on `logger` at `level` or higher (Python 3.10+) |

`assertRaises()`, `assertRaisesRegex()`, `assertWarns()` and `assertWarnsRegex()` also have a **callable form**: pass the function and its arguments separately, as in `self.assertRaises(ValueError, int, "abc")`. Do not call the function yourself (`self.assertRaises(ValueError, int("abc"))`), because then the exception is raised before `assertRaises()` even starts.

```python
import logging
import unittest
import warnings


def parse_port(text):
    port = int(text)
    if not 0 < port < 65536:
        raise ValueError(f"port out of range: {port}")
    return port


def old_api():
    warnings.warn("old_api() is deprecated", DeprecationWarning)
    return 42


def save(record):
    logging.getLogger("app.db").info("saved %s", record)


class TestSpecial(unittest.TestCase):
    def test_raises(self):
        # context-manager form
        with self.assertRaises(ValueError):
            parse_port("70000")
        # callable form: the function and its arguments are passed separately
        self.assertRaises(ValueError, parse_port, "abc")
        self.assertRaisesRegex(ValueError, r"out of range: 0", parse_port, "0")

    def test_warns(self):
        with self.assertWarns(DeprecationWarning):
            result = old_api()
        self.assertEqual(result, 42)

    def test_logs(self):
        with self.assertLogs("app.db", level="INFO") as cm:
            save("user-1")
        self.assertEqual(cm.output, ["INFO:app.db:saved user-1"])

    def test_no_logs(self):
        with self.assertNoLogs("app.db", level="WARNING"):
            save("user-2")
```

Output of `python3 -m unittest test_special -v`:

```text
test_logs (test_special.TestSpecial.test_logs) ... ok
test_no_logs (test_special.TestSpecial.test_no_logs) ... ok
test_raises (test_special.TestSpecial.test_raises) ... ok
test_warns (test_special.TestSpecial.test_warns) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.001s

OK
```

`assertLogs()` temporarily attaches its own handler, so you do not need to configure logging. `cm.output` is a list of strings in the form `LEVEL:logger:message`, and `cm.records` holds the full `LogRecord` objects.

## Type-specific equality methods

`assertEqual()` looks at the types of its arguments. When both are the same built-in container type, it automatically delegates to a specialised method that produces a readable diff:

| Method | Used by `assertEqual()` for |
|---|---|
| `assertMultiLineEqual(a, b)` | `str` |
| `assertListEqual(a, b)` | `list` |
| `assertTupleEqual(a, b)` | `tuple` |
| `assertDictEqual(a, b)` | `dict` |
| `assertSetEqual(a, b)` | `set` / `frozenset` |
| `assertSequenceEqual(a, b)` | any sequences (call it directly) |

You rarely call these yourself. Just use `assertEqual()`. The next topic shows the diffs they produce.

## New in Python 3.14

Python 3.14 added eight methods for checks that previously needed `assertTrue()`:

| Method | Passes if |
|---|---|
| `assertHasAttr(obj, name)` / `assertNotHasAttr(obj, name)` | `hasattr(obj, name)` is true / false |
| `assertIsSubclass(cls, superclass)` / `assertNotIsSubclass(...)` | `issubclass(cls, superclass)` is true / false |
| `assertStartsWith(s, prefix)` / `assertNotStartsWith(s, prefix)` | `s.startswith(prefix)` is true / false |
| `assertEndsWith(s, suffix)` / `assertNotEndsWith(s, suffix)` | `s.endswith(suffix)` is true / false |

```python
import unittest


class Animal:
    sound = "..."


class Dog(Animal):
    pass


class TestNewIn314(unittest.TestCase):
    def test_new_methods(self):
        self.assertHasAttr(Dog(), "sound")
        self.assertNotHasAttr(Dog(), "wings")
        self.assertIsSubclass(Dog, Animal)
        self.assertNotIsSubclass(Animal, Dog)
        self.assertStartsWith("report.csv", "report")
        self.assertEndsWith("report.csv", ".csv")
        self.assertNotEndsWith("report.csv", ".txt")

    def test_failure_message(self):
        self.assertEndsWith("report.txt", ".csv")
```

Running `python3 -m unittest test_new314` on Python 3.14 reports one failure (`test_new_methods` passes):

```text
AssertionError: 'report.txt' doesn't end with '.csv'
```

On older versions these methods do not exist. Use `assertTrue(hasattr(...))`, `assertTrue(issubclass(...))` or `assertTrue(s.endswith(...))` there.

## Common mistakes

- **Using `assertTrue()` for everything.** `assertTrue(a == b)`, `assertTrue(x in items)` and `assertTrue(n > 0)` all fail with the useless `False is not true`. Use `assertEqual()`, `assertIn()` and `assertGreater()`.
- **Using removed aliases.** Old names such as `assertEquals`, `assertNotEquals`, `assert_`, `failUnless`, `assertRegexpMatches` and `assertDictContainsSubset` were **removed in Python 3.12**. Calling one now raises an error:

  ```text
  AttributeError: 'T' object has no attribute 'assertEquals'. Did you mean: 'assertEqual'?
  ```

- **Calling the function inside `assertRaises()`.** `self.assertRaises(ValueError, parse_port("abc"))` raises `ValueError` before the assertion runs, so the test ends with `ERROR`. Pass the callable and arguments separately, or use the `with` form.
- **Expecting `assertCountEqual()` to check order.** It deliberately ignores order. Use `assertEqual()` when order matters.
- **Setting `longMessage = False` without a reason.** Your `msg` then *replaces* the values in the failure message.

## Summary

- Assert methods raise `AssertionError` with informative messages, show diffs for containers, and are not removed by `python -O`.
- Pick the most specific method: `assertEqual`, `assertIs`, `assertIsNone`, `assertIn`, `assertIsInstance`, `assertGreater`, `assertRegex`, `assertCountEqual`, and so on. Each has a negative twin.
- Every method takes an optional `msg`. With the default `longMessage = True`, it is appended to the standard message.
- `assertRaises`, `assertWarns`, `assertLogs` and `assertNoLogs` (plus `...Regex` variants) check exceptions, warnings and logging, usually as context managers.
- `assertEqual()` automatically uses type-specific methods for `str`, `list`, `tuple`, `dict` and `set`.
- Python 3.14 added `assertHasAttr`, `assertIsSubclass`, `assertStartsWith`, `assertEndsWith` and their negations. Old aliases like `assertEquals` were removed in 3.12.

## Practice

### Exercise 1: Choose the method

For each check, name the most specific assert method, then write one test that performs all six checks on these values: `result = {}.get("missing")`, `user = {"name": "olena", "email": "olena@example.com"}`, `items = [2, 3, 1]`, `elapsed = 0.12`, `version = "3.14.0"`, `data = [1, 2]`.

1. `result` is `None`.
2. `user` has the key `"email"`.
3. `items` contains the same elements as `[3, 1, 2]`, in any order.
4. `elapsed` is less than `0.5`.
5. `version` has the form `number.number.number`.
6. `data` is a `dict` or a `list`.

### Exercise 2: From vague to specific

These tests fail, but every failure says only `False is not true`. Rewrite them with specific assert methods and compare the new messages.

```python
import unittest


class TestVague(unittest.TestCase):
    def setUp(self):
        self.order = {"id": 7, "total": 90, "tags": ["new", "gift"]}

    def test_total(self):
        self.assertTrue(self.order["total"] == 100)

    def test_tag(self):
        self.assertTrue("urgent" in self.order["tags"])

    def test_big_order(self):
        self.assertTrue(self.order["total"] > 100)
```

### Exercise 3: Test logging

`bank.py` contains:

```python
import logging

logger = logging.getLogger("bank")


def withdraw(balance, amount):
    if amount > balance:
        logger.warning("insufficient funds: balance=%s, amount=%s", balance, amount)
        return balance
    return balance - amount
```

Write two tests: one checks that `withdraw(50, 80)` returns `50` and logs exactly one warning with the expected text on the `"bank"` logger, the other checks that `withdraw(100, 30)` returns `70` and logs no warnings.

## Solutions

### Exercise 1

1. `assertIsNone`, 2. `assertIn`, 3. `assertCountEqual`, 4. `assertLess`, 5. `assertRegex`, 6. `assertIsInstance` with a tuple of types.

```python
import unittest


class TestChoose(unittest.TestCase):
    def test_checks(self):
        result = {}.get("missing")
        user = {"name": "olena", "email": "olena@example.com"}
        items = [2, 3, 1]
        elapsed = 0.12
        version = "3.14.0"
        data = [1, 2]

        self.assertIsNone(result)
        self.assertIn("email", user)
        self.assertCountEqual(items, [3, 1, 2])
        self.assertLess(elapsed, 0.5)
        self.assertRegex(version, r"^\d+\.\d+\.\d+$")
        self.assertIsInstance(data, (dict, list))
```

Output of `python3 -m unittest -v`:

```text
test_checks (test_choose.TestChoose.test_checks) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

`assertIn("email", user)` checks dictionary **keys**, exactly like the `in` operator. The anchors `^` and `$` in the regex make sure the whole string has the expected form, not just part of it.

### Exercise 2

```python
import unittest


class TestSpecific(unittest.TestCase):
    def setUp(self):
        self.order = {"id": 7, "total": 90, "tags": ["new", "gift"]}

    def test_total(self):
        self.assertEqual(self.order["total"], 100)

    def test_tag(self):
        self.assertIn("urgent", self.order["tags"])

    def test_big_order(self):
        self.assertGreater(self.order["total"], 100)
```

The `AssertionError` lines from `python3 -m unittest test_specific` (in alphabetical order of the tests):

```text
AssertionError: 90 not greater than 100
AssertionError: 'urgent' not found in ['new', 'gift']
AssertionError: 90 != 100
```

Each message now shows the actual value, so you can often see the bug without opening a debugger.

### Exercise 3

```python
import unittest

from bank import withdraw


class TestWithdrawLogging(unittest.TestCase):
    def test_warns_when_balance_too_low(self):
        with self.assertLogs("bank", level="WARNING") as cm:
            new_balance = withdraw(50, 80)
        self.assertEqual(new_balance, 50)
        self.assertEqual(
            cm.output,
            ["WARNING:bank:insufficient funds: balance=50, amount=80"],
        )

    def test_no_warning_for_normal_withdrawal(self):
        with self.assertNoLogs("bank", level="WARNING"):
            new_balance = withdraw(100, 30)
        self.assertEqual(new_balance, 70)
```

Output of `python3 -m unittest test_bank -v`:

```text
test_no_warning_for_normal_withdrawal (test_bank.TestWithdrawLogging.test_no_warning_for_normal_withdrawal) ... ok
test_warns_when_balance_too_low (test_bank.TestWithdrawLogging.test_warns_when_balance_too_low) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Comparing the whole `cm.output` list checks both the text and that exactly one message was logged.

---

*Source: [pythontutorial.net — Python unittest Assert Methods](https://www.pythontutorial.net/python-unit-testing/python-unittest-assert/). Adapted and expanded for PyJourney.*
