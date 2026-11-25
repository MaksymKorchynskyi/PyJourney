# assertTrue()

`assertTrue()` and `assertFalse()` are the most general assert methods: they accept any expression and check whether it is truthy or falsy. That generality is both their strength and their weakness. They fit predicates such as `is_valid()` or `str.isdigit()` perfectly, but they also make it easy to write tests that cannot fail.

## What you'll learn

- What `assertTrue(expr, msg=None)` and `assertFalse(expr, msg=None)` really check
- Why "truthy" is not the same as "is `True`"
- What their failure messages look like and why `msg` matters so much here
- When to use them and when a more specific method is better
- Four ways to write an `assertTrue()` test that always passes, and how to fix each one

## How `assertTrue()` works

```python
assertTrue(expr, msg=None)
```

The test passes when `expr` is **truthy**, in other words when `bool(expr)` is `True`. It does **not** check `expr is True`. All of these pass:

- `assertTrue(True)`
- `assertTrue(1)`, `assertTrue(0.0001)`
- `assertTrue([0])`, `assertTrue(" ")`, `assertTrue("False")`, because a non-empty list or string is truthy, whatever it contains

If you need the result to be exactly `True` (for example, because a function must return a `bool`), use `assertIs(result, True)`.

Here is a test that checks a string method:

```python
import unittest


class TestBool(unittest.TestCase):
    def test_is_digit(self):
        text = "123"
        self.assertTrue(text.isdigit())
```

`str.isdigit()` returns `True` when the string is not empty and all its characters are digits, so the test passes.

## `assertFalse()`

```python
assertFalse(expr, msg=None)
```

The opposite: the test passes when `expr` is **falsy**, that is `False`, `None`, `0`, `0.0`, an empty string or an empty container, or an object whose `__bool__()` returns `False` (or whose `__len__()` returns `0`).

The test class gets two more tests:

```python
import unittest


class TestBool(unittest.TestCase):
    def test_is_digit(self):
        text = "123"
        self.assertTrue(text.isdigit())

    def test_empty_string_is_digit(self):
        text = ""
        self.assertFalse(text.isdigit())

    def test_alpha_is_digit(self):
        text = "a00"
        self.assertFalse(text.isdigit())
```

Output of `python3 -m unittest -v` (the file is `test_bool.py`):

```text
test_alpha_is_digit (test_bool.TestBool.test_alpha_is_digit) ... ok
test_empty_string_is_digit (test_bool.TestBool.test_empty_string_is_digit) ... ok
test_is_digit (test_bool.TestBool.test_is_digit) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

The empty string is a useful edge case: `"".isdigit()` is `False`, because there is no digit in it.

## Failure messages and `msg`

On failure, the message is `repr(expr)` followed by `is not true` or `is not false`:

```python
import unittest


class TestMessages(unittest.TestCase):
    def test_predicate(self):
        text = "12a"
        self.assertTrue(text.isdigit())

    def test_predicate_with_msg(self):
        text = "12a"
        self.assertTrue(text.isdigit(), f"{text!r} should contain only digits")

    def test_value(self):
        items = []
        self.assertTrue(items)

    def test_false(self):
        flag = "0"
        self.assertFalse(flag)
```

The `AssertionError` lines of `python3 -m unittest test_messages` (in alphabetical order of the tests):

```text
AssertionError: '0' is not false
AssertionError: False is not true
AssertionError: False is not true : '12a' should contain only digits
AssertionError: [] is not true
```

- When you pass a **value** (`items`, `flag`), the message shows it. Note the surprise in the first line: the string `"0"` is truthy, because it is not empty.
- When you pass the **result of a call or comparison**, `assertTrue()` receives only `False`. The input (`"12a"`) is lost, so the message `False is not true` says nothing useful.

That is why `msg` matters more for `assertTrue()` than for any other method. With a message, the failure explains itself: `'12a' should contain only digits`.

## When to use `assertTrue()` and when not

`assertTrue()` and `assertFalse()` are the right choice when the code under test is a **predicate**, a function whose whole job is to answer yes or no: `is_valid_email()`, `user.is_active()`, `path.exists()`, `str.isdigit()`. There is nothing more specific to compare.

When the check is really a comparison, a specific method shows both values on failure:

| Instead of | Use | Failure message |
|---|---|---|
| `assertTrue(a == b)` | `assertEqual(a, b)` | `2 != 3` |
| `assertTrue(a > b)` | `assertGreater(a, b)` | `2 not greater than 3` |
| `assertTrue(x in items)` | `assertIn(x, items)` | `'kiwi' not found in ['apple']` |
| `assertTrue(x is None)` | `assertIsNone(x)` | `'Hello' is not None` |
| `assertTrue(isinstance(x, int))` | `assertIsInstance(x, int)` | `'42' is not an instance of <class 'int'>` |
| `assertTrue(result is True)` | `assertIs(result, True)` | `'False' is not True` |

The topic Assert Methods lists the rest.

## Tests that always pass

A test that cannot fail is worse than no test: it gives false confidence. With `assertTrue()` it is surprisingly easy to write one. Each test below checks something that is obviously false, and yet all of them pass:

```python
import unittest


def add(a, b):
    return a + b


class TestAlwaysPass(unittest.TestCase):
    def test_missing_parentheses(self):
        text = "abc"
        self.assertTrue(text.isdigit)

    def test_generator(self):
        numbers = [-1, -2, -3]
        self.assertTrue(n > 0 for n in numbers)

    def test_second_argument(self):
        self.assertTrue(add(2, 2), 5)

    def test_string_false(self):
        setting = "False"
        self.assertTrue(setting)
```

Output of `python3 -m unittest test_always_pass -v`:

```text
test_generator (test_always_pass.TestAlwaysPass.test_generator) ... ok
test_missing_parentheses (test_always_pass.TestAlwaysPass.test_missing_parentheses) ... ok
test_second_argument (test_always_pass.TestAlwaysPass.test_second_argument) ... ok
test_string_false (test_always_pass.TestAlwaysPass.test_string_false) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

What went wrong:

- **`text.isdigit` without parentheses** is the method object itself, and any function or method is truthy. The method is never called.
- **`n > 0 for n in numbers`** creates a generator object, and a generator object is always truthy, even when it would produce only `False` values. The comparisons never run. Use `all(...)` or `any(...)`.
- **`assertTrue(add(2, 2), 5)`**: the second argument of `assertTrue()` is `msg`, not an expected value. `4` is truthy, so the test passes, and `5` would only have been printed as the message. Use `assertEqual()` for comparisons.
- **`"False"`** is a non-empty string, so it is truthy. Values read from configuration files, environment variables or forms are often strings like this.

The fixed versions:

```python
import unittest


def add(a, b):
    return a + b


class TestFixed(unittest.TestCase):
    def test_missing_parentheses(self):
        text = "abc"
        self.assertTrue(text.isdigit())

    def test_generator(self):
        numbers = [-1, -2, -3]
        self.assertTrue(all(n > 0 for n in numbers))

    def test_second_argument(self):
        self.assertEqual(add(2, 2), 5)

    def test_string_false(self):
        setting = "False"
        self.assertIs(setting, True)
```

Now all four fail, as they should. The `AssertionError` lines of `python3 -m unittest test_fixed`:

```text
AssertionError: False is not true
AssertionError: False is not true
AssertionError: 4 != 5
AssertionError: 'False' is not True
```

> **Tip:** `assertTrue(all(...))` works, but on failure it does not say *which* item failed. A loop with `subTest()` and a specific assertion, such as `assertGreater(n, 0)`, reports every failing item separately (see the topic Unittest Framework).

> **Tip:** When you write a new test, make it fail once on purpose (for example, by changing the expected value) to check that it can fail at all.

## Common mistakes

- **Using `assertTrue()` for comparisons.** `assertTrue(a == b)` fails with `False is not true`. Use `assertEqual()`, `assertIn()`, `assertGreater()` and similar methods.
- **Passing an expected value as the second argument.** `assertTrue(result, 5)` treats `5` as the message. It does not compare anything.
- **Forgetting to call a method.** `assertTrue(user.is_active)` checks the method object, which is always truthy. Write `user.is_active()`.
- **Passing a generator expression.** `assertTrue(x > 0 for x in values)` always passes. Wrap it in `all()` or `any()`.
- **Expecting `assertTrue()` to check for `True`.** It checks truthiness. For an exact `True` or `False`, use `assertIs(result, True)` / `assertIs(result, False)`.
- **Leaving out `msg` when asserting a predicate.** `False is not true` tells you nothing. Say which input was being checked.

## Summary

- `assertTrue(expr, msg=None)` passes when `bool(expr)` is `True`, and `assertFalse(expr, msg=None)` passes when it is `False`.
- Truthy is not the same as `True`: `1`, `[0]` and `"False"` all pass `assertTrue()`. Use `assertIs(x, True)` for an exact check.
- Failure messages are `<repr> is not true` / `<repr> is not false`. For a predicate this is just `False is not true`, so always add a `msg`.
- Use these methods for predicates. For comparisons, membership, `None` and types, more specific methods give much better messages.
- Watch out for tests that always pass: a missing `()`, a generator expression, an expected value passed as `msg`, a non-empty string.

## Practice

### Exercise 1: Test a predicate

`text_utils.py` contains:

```python
def is_palindrome(text):
    letters = [char.lower() for char in text if char.isalnum()]
    return letters == letters[::-1]
```

Write two tests with `subTest()` loops: one checks that `"level"`, `"Racecar"`, `"A man, a plan, a canal: Panama"` and `""` are palindromes, the other that `"python"`, `"ab"` and `"level up"` are not. Each assertion must have a `msg` naming the input.

### Exercise 2: Find the broken tests

`parity.py` contains:

```python
def is_even(n):
    return n % 2 == 0
```

Without running them, predict which of these tests pass and which fail, and explain why none of them checks what it claims to. Then rewrite them. Note that the list `[2, 4, 7]` contains a wrong value on purpose: the rewritten `test_all_even` must report it.

```python
import unittest

from parity import is_even


class TestIsEven(unittest.TestCase):
    def test_all_even(self):
        self.assertTrue(is_even(n) for n in [2, 4, 7])

    def test_four_is_even(self):
        self.assertTrue(is_even, 4)

    def test_three_is_odd(self):
        self.assertTrue(is_even(3), False)
```

### Exercise 3: A real `bool`, please

`permissions.py` contains:

```python
def can_edit(user):
    return user.get("is_admin") or user.get("roles")
```

The function must return exactly `True` or `False` (the result is sent to a front end as JSON), and only admins and users with the role `"editor"` may edit. Write tests for four users: `{"is_admin": True}`, `{"roles": ["editor"]}`, `{"roles": ["viewer"]}` and `{}`. Choose assertions that would catch a non-`bool` result. Explain which bugs tests based on `assertTrue()` / `assertFalse()` would miss, then fix the function.

## Solutions

### Exercise 1

```python
import unittest

from text_utils import is_palindrome


class TestIsPalindrome(unittest.TestCase):
    def test_palindromes(self):
        for text in ["level", "Racecar", "A man, a plan, a canal: Panama", ""]:
            with self.subTest(text=text):
                self.assertTrue(is_palindrome(text), f"{text!r} is a palindrome")

    def test_not_palindromes(self):
        for text in ["python", "ab", "level up"]:
            with self.subTest(text=text):
                self.assertFalse(is_palindrome(text), f"{text!r} is not a palindrome")
```

Output of `python3 -m unittest test_text_utils -v`:

```text
test_not_palindromes (test_text_utils.TestIsPalindrome.test_not_palindromes) ... ok
test_palindromes (test_text_utils.TestIsPalindrome.test_palindromes) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

The empty string counts as a palindrome here (an empty list equals its reverse). Whether that is the desired behaviour is a design decision, and the test documents it.

### Exercise 2

Prediction: `test_all_even` and `test_four_is_even` pass, `test_three_is_odd` fails. Output of `python3 -m unittest test_parity -v` (paths shortened):

```text
test_all_even (test_parity.TestIsEven.test_all_even) ... ok
test_four_is_even (test_parity.TestIsEven.test_four_is_even) ... ok
test_three_is_odd (test_parity.TestIsEven.test_three_is_odd) ... FAIL

======================================================================
FAIL: test_three_is_odd (test_parity.TestIsEven.test_three_is_odd)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_parity.py", line 14, in test_three_is_odd
    self.assertTrue(is_even(3), False)
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : False

----------------------------------------------------------------------
Ran 3 tests in 0.000s

FAILED (failures=1)
```

- `test_all_even` passes a generator object, which is always truthy. `is_even()` is never even called.
- `test_four_is_even` passes the function `is_even` itself (truthy) and `4` as the message. `is_even(4)` is never called.
- `test_three_is_odd` was meant as "`is_even(3)` equals `False`", but the second argument is a message. `is_even(3)` is `False`, so the test fails, and the message `: False` is just the printed `msg`. The code is right, and the test is wrong.

The rewritten tests:

```python
import unittest

from parity import is_even


class TestIsEven(unittest.TestCase):
    def test_all_even(self):
        for n in [2, 4, 7]:
            with self.subTest(n=n):
                self.assertTrue(is_even(n), f"{n} should be even")

    def test_four_is_even(self):
        self.assertTrue(is_even(4))

    def test_three_is_odd(self):
        self.assertFalse(is_even(3))
```

Output of `python3 -m unittest test_parity_fixed -v` (paths shortened):

```text
test_all_even (test_parity_fixed.TestIsEven.test_all_even) ...
  test_all_even (test_parity_fixed.TestIsEven.test_all_even) (n=7) ... FAIL
test_four_is_even (test_parity_fixed.TestIsEven.test_four_is_even) ... ok
test_three_is_odd (test_parity_fixed.TestIsEven.test_three_is_odd) ... ok

======================================================================
FAIL: test_all_even (test_parity_fixed.TestIsEven.test_all_even) (n=7)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_parity_fixed.py", line 10, in test_all_even
    self.assertTrue(is_even(n), f"{n} should be even")
    ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: False is not true : 7 should be even

----------------------------------------------------------------------
Ran 3 tests in 0.000s

FAILED (failures=1)
```

The test now really calls `is_even()` for every number and points straight at the bad value. Remove `7` from the list (or move it to an "odd numbers" test) and everything passes.

### Exercise 3

```python
import unittest

from permissions import can_edit


class TestCanEdit(unittest.TestCase):
    def test_admin(self):
        self.assertIs(can_edit({"is_admin": True}), True)

    def test_editor(self):
        self.assertIs(can_edit({"roles": ["editor"]}), True)

    def test_viewer(self):
        self.assertIs(can_edit({"roles": ["viewer"]}), False)

    def test_no_roles(self):
        self.assertIs(can_edit({}), False)
```

With the original function, `python3 -m unittest test_permissions -v` reports three failures. The test lines and `AssertionError` lines:

```text
test_admin (test_permissions.TestCanEdit.test_admin) ... ok
test_editor (test_permissions.TestCanEdit.test_editor) ... FAIL
test_no_roles (test_permissions.TestCanEdit.test_no_roles) ... FAIL
test_viewer (test_permissions.TestCanEdit.test_viewer) ... FAIL

AssertionError: ['editor'] is not True
AssertionError: None is not False
AssertionError: ['viewer'] is not False
```

Tests written with `assertTrue()` / `assertFalse()` would catch only the viewer bug (`['viewer'] is not false`). They would accept `['editor']` as "true" and `None` as "false", so the wrong return types would reach the front end unnoticed.

The fixed function:

```python
def can_edit(user):
    return bool(user.get("is_admin")) or "editor" in user.get("roles", [])
```

Output of the same command after the fix:

```text
test_admin (test_permissions.TestCanEdit.test_admin) ... ok
test_editor (test_permissions.TestCanEdit.test_editor) ... ok
test_no_roles (test_permissions.TestCanEdit.test_no_roles) ... ok
test_viewer (test_permissions.TestCanEdit.test_viewer) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

Both operands of `or` are now real booleans, so the result is always `True` or `False`.

---

*Source: [pythontutorial.net — Python assertTrue()](https://www.pythontutorial.net/python-unit-testing/python-asserttrue/). Adapted and expanded for PyJourney.*
