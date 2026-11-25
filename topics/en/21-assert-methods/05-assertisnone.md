# assertIsNone()

`None` is Python's way of saying "no value": `dict.get()` returns it for a missing key, `re.match()` when nothing matches, and a search function when it finds nothing. `assertIsNone()` checks that a result is exactly `None`, and `assertIsNotNone()` checks that there *is* a result.

## What you'll learn

- What `assertIsNone(obj, msg=None)` and `assertIsNotNone(obj, msg=None)` check
- What their failure messages look like, with and without `msg`
- Why `assertFalse()` and `assertEqual(x, None)` are worse choices
- How `assertIsNotNone()` works as a guard before you use a result
- The typical mistakes with these two methods

## How `assertIsNone()` works

```python
assertIsNone(obj, msg=None)
```

The test passes when `obj is None`. The check uses **identity** (`is`), not equality: there is exactly one `None` object in a Python program, so `is None` is the precise and idiomatic way to test for it.

Here is a test file with one passing and two failing tests. The third one adds a custom message:

```python
import unittest


class TestNone(unittest.TestCase):
    def test_variable_none(self):
        message = None
        self.assertIsNone(message)

    def test_variable_not_none(self):
        message = "Hello"
        self.assertIsNone(message)

    def test_variable_not_none_with_msg(self):
        message = "Hello"
        self.assertIsNone(
            message,
            f'The message is "{message}" so it is not None.',
        )
```

Output of `python3 -m unittest -v` (the file is `test_none.py`, paths shortened):

```text
test_variable_none (test_none.TestNone.test_variable_none) ... ok
test_variable_not_none (test_none.TestNone.test_variable_not_none) ... FAIL
test_variable_not_none_with_msg (test_none.TestNone.test_variable_not_none_with_msg) ... FAIL

======================================================================
FAIL: test_variable_not_none (test_none.TestNone.test_variable_not_none)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_none.py", line 11, in test_variable_not_none
    self.assertIsNone(message)
    ~~~~~~~~~~~~~~~~~^^^^^^^^^
AssertionError: 'Hello' is not None

======================================================================
FAIL: test_variable_not_none_with_msg (test_none.TestNone.test_variable_not_none_with_msg)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_none.py", line 15, in test_variable_not_none_with_msg
    self.assertIsNone(
    ~~~~~~~~~~~~~~~~~^
        message,
        ^^^^^^^^
        f'The message is "{message}" so it is not None.',
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    )
    ^
AssertionError: 'Hello' is not None : The message is "Hello" so it is not None.

----------------------------------------------------------------------
Ran 3 tests in 0.000s

FAILED (failures=2)
```

The standard message `'Hello' is not None` already shows the unexpected value. The custom `msg` is appended after ` : `. Here it only repeats the value, so in a real test use `msg` for information the value does not carry, such as *which* input produced it.

## Why not `assertFalse()`?

`None` is falsy, so `assertFalse(result)` passes when `result` is `None`. But it also passes for `0`, `""`, `[]`, `{}` and `False`. When one of those is a valid result, `assertFalse()` cannot tell "no value" from "a valid falsy value", and a bug slips through:

```python
import unittest

DISCOUNTS = {"WELCOME": 10, "STAFF": 0}


def get_discount(code):
    return DISCOUNTS.get(code, 0)  # bug: an unknown code looks like a 0 % discount


class TestDiscount(unittest.TestCase):
    def test_unknown_code_falsy(self):
        self.assertFalse(get_discount("UNKNOWN"))

    def test_unknown_code_is_none(self):
        self.assertIsNone(get_discount("UNKNOWN"))

    def test_staff_code(self):
        self.assertEqual(get_discount("STAFF"), 0)
```

Output of `python3 -m unittest test_discount -v` (paths shortened):

```text
test_staff_code (test_discount.TestDiscount.test_staff_code) ... ok
test_unknown_code_falsy (test_discount.TestDiscount.test_unknown_code_falsy) ... ok
test_unknown_code_is_none (test_discount.TestDiscount.test_unknown_code_is_none) ... FAIL

======================================================================
FAIL: test_unknown_code_is_none (test_discount.TestDiscount.test_unknown_code_is_none)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_discount.py", line 15, in test_unknown_code_is_none
    self.assertIsNone(get_discount("UNKNOWN"))
    ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0 is not None

----------------------------------------------------------------------
Ran 3 tests in 0.000s

FAILED (failures=1)
```

The `assertFalse()` test happily passes, because `0` is falsy. Only `assertIsNone()` notices that an unknown code now looks exactly like the valid code `"STAFF"`.

## Why not `assertEqual(x, None)`?

`assertEqual(x, None)` uses `==`, and a class can define `__eq__` however it likes. An object that claims to be equal to everything, such as `unittest.mock.ANY`, passes `assertEqual(ANY, None)`, while `assertIsNone(ANY)` correctly fails with `<ANY> is not None`. Such objects are rare, but `assertIsNone()` also states your intent more clearly, and it matches the `is None` style recommended by PEP 8.

## `assertIsNotNone()`

```python
assertIsNotNone(obj, msg=None)
```

The test passes when `obj is not None`. Note what this means:

- `assertIsNotNone(0)`, `assertIsNotNone("")` and `assertIsNotNone([])` all **pass**. It is not a truthiness check.
- On failure, the message is just `unexpectedly None`. There is no value to show, so a `msg` saying what was expected is especially useful.

### A guard before using the result

Many functions return either an object or `None`. If a test uses the result directly and it is `None`, the test crashes with `AttributeError` or `TypeError`, which is reported as `ERROR` and hides the real problem. Checking with `assertIsNotNone()` first turns the crash into a clear `FAIL`:

```python
import re
import unittest


def parse_version(text):
    return re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)", text)


class TestParseVersion(unittest.TestCase):
    def test_without_guard(self):
        match = parse_version("version 3.14")
        self.assertEqual(match.group(1), "3")

    def test_with_guard(self):
        match = parse_version("version 3.14")
        self.assertIsNotNone(match, "pattern did not match 'version 3.14'")
        self.assertEqual(match.group(1), "3")

    def test_valid_version(self):
        match = parse_version("v3.14.0")
        self.assertIsNotNone(match)
        self.assertEqual(match.groups(), ("3", "14", "0"))
```

Output of `python3 -m unittest test_version -v` (paths shortened):

```text
test_valid_version (test_version.TestParseVersion.test_valid_version) ... ok
test_with_guard (test_version.TestParseVersion.test_with_guard) ... FAIL
test_without_guard (test_version.TestParseVersion.test_without_guard) ... ERROR

======================================================================
ERROR: test_without_guard (test_version.TestParseVersion.test_without_guard)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_version.py", line 12, in test_without_guard
    self.assertEqual(match.group(1), "3")
                     ^^^^^^^^^^^
AttributeError: 'NoneType' object has no attribute 'group'

======================================================================
FAIL: test_with_guard (test_version.TestParseVersion.test_with_guard)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_version.py", line 16, in test_with_guard
    self.assertIsNotNone(match, "pattern did not match 'version 3.14'")
    ~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: unexpectedly None : pattern did not match 'version 3.14'

----------------------------------------------------------------------
Ran 3 tests in 0.000s

FAILED (failures=1, errors=1)
```

Both tests find the same problem, but the second one says what went wrong in terms of the test, not in terms of a missing attribute.

`test_valid_version` shows the usual pattern: `assertIsNotNone()` first, then a **specific** check of the value. `assertIsNotNone()` on its own is weak: it passes for any value at all, including wrong ones.

## Common mistakes

- **Using `assertFalse()` to check for `None`.** It also passes for `0`, `""`, `[]` and `False`, as the discount example shows.
- **Writing `assertTrue(result is None)`.** It works, but a failure says only `False is not true`. `assertIsNone(result)` shows the actual value.
- **Forgetting to call the function.** `self.assertIsNotNone(get_user)` passes, because the function object itself is not `None`. Write `get_user()`.
- **Relying on `assertIsNotNone()` alone.** "Not `None`" says almost nothing about correctness. Follow it with `assertEqual()` or another specific assertion.
- **Forgetting `return` in the code under test.** A function that ends without `return` returns `None`. Tests that compare the result with `assertEqual()` catch this (the message reads `None != 120`), but a test that only uses `assertFalse()` or `assertIsNone()` for "nothing found" may pass by accident. Test both the "found" and the "not found" cases.

## Summary

- `assertIsNone(obj, msg=None)` passes when `obj is None`. On failure it shows the value: `'Hello' is not None`.
- `assertIsNotNone(obj, msg=None)` passes when `obj is not None`. On failure it says only `unexpectedly None`, so add a `msg`.
- Both check identity with `None`, not truthiness: `0`, `""` and `[]` are *not* `None`.
- Prefer `assertIsNone()` over `assertFalse()`, which cannot tell `None` from other falsy values, and over `assertEqual(x, None)`, which depends on `__eq__`.
- Use `assertIsNotNone()` as a guard before using an optional result, then check the value itself.

## Practice

### Exercise 1: Test `find_user()`

`users.py` contains:

```python
def find_user(users, user_id):
    for user in users:
        if user["id"] == user_id:
            return user
    return None
```

Write tests for three cases: an existing user (check that the result is not `None` and has the right name), a missing ID, and an empty list.

### Exercise 2: The test that lies

`search.py` contains a buggy function, and its tests pass:

```python
def find_index(items, target):
    for index, item in enumerate(items):
        if item == target:
            return index
    return 0
```

```python
import unittest

from search import find_index


class TestFindIndex(unittest.TestCase):
    def test_found(self):
        self.assertEqual(find_index(["a", "b", "c"], "b"), 1)

    def test_not_found(self):
        self.assertFalse(find_index(["a", "b", "c"], "z"))
```

The function is supposed to return `None` when the target is missing. Explain why the tests do not catch the bug, rewrite them so that they fail for this version (also add a test for a target at index `0`), and then fix the function.

### Exercise 3: Validate dates

`dates.py` contains:

```python
import re


def parse_date(text):
    match = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text)
    if match is None:
        return None
    return tuple(int(part) for part in match.groups())
```

Write two tests using `subTest()` loops. The first checks that `"2026-11-25"` and `"1991-08-24"` are accepted: the result is not `None` (with a `msg` naming the input) and equals the expected tuple of integers. The second checks that `"25.11.2026"`, `"2026-1-5"`, `""` and `"2026-11-25 "` are rejected.

## Solutions

### Exercise 1

```python
import unittest

from users import find_user

USERS = [{"id": 1, "name": "olena"}, {"id": 2, "name": "taras"}]


class TestFindUser(unittest.TestCase):
    def test_existing_user(self):
        user = find_user(USERS, 2)
        self.assertIsNotNone(user)
        self.assertEqual(user["name"], "taras")

    def test_missing_user(self):
        self.assertIsNone(find_user(USERS, 99))

    def test_empty_list(self):
        self.assertIsNone(find_user([], 1))
```

Output of `python3 -m unittest test_users -v`:

```text
test_empty_list (test_users.TestFindUser.test_empty_list) ... ok
test_existing_user (test_users.TestFindUser.test_existing_user) ... ok
test_missing_user (test_users.TestFindUser.test_missing_user) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

### Exercise 2

The buggy function returns `0` for a missing target, and `0` is falsy, so `assertFalse()` passes. Worse, `0` is also a valid index, so the caller cannot tell "not found" from "found at the start".

The rewritten tests:

```python
import unittest

from search import find_index


class TestFindIndex(unittest.TestCase):
    def test_found(self):
        self.assertEqual(find_index(["a", "b", "c"], "b"), 1)

    def test_found_at_start(self):
        self.assertEqual(find_index(["a", "b", "c"], "a"), 0)

    def test_not_found(self):
        self.assertIsNone(find_index(["a", "b", "c"], "z"))
```

With the buggy function, `python3 -m unittest test_search_fixed -v` reports (paths shortened):

```text
test_found (test_search_fixed.TestFindIndex.test_found) ... ok
test_found_at_start (test_search_fixed.TestFindIndex.test_found_at_start) ... ok
test_not_found (test_search_fixed.TestFindIndex.test_not_found) ... FAIL

======================================================================
FAIL: test_not_found (test_search_fixed.TestFindIndex.test_not_found)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_search_fixed.py", line 14, in test_not_found
    self.assertIsNone(find_index(["a", "b", "c"], "z"))
    ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
AssertionError: 0 is not None

----------------------------------------------------------------------
Ran 3 tests in 0.000s

FAILED (failures=1)
```

The fix is to replace `return 0` with `return None`:

```python
def find_index(items, target):
    for index, item in enumerate(items):
        if item == target:
            return index
    return None
```

Output of the same command after the fix:

```text
test_found (test_search_fixed.TestFindIndex.test_found) ... ok
test_found_at_start (test_search_fixed.TestFindIndex.test_found_at_start) ... ok
test_not_found (test_search_fixed.TestFindIndex.test_not_found) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

### Exercise 3

```python
import unittest

from dates import parse_date


class TestParseDate(unittest.TestCase):
    def test_valid_dates(self):
        cases = {"2026-11-25": (2026, 11, 25), "1991-08-24": (1991, 8, 24)}
        for text, expected in cases.items():
            with self.subTest(text=text):
                result = parse_date(text)
                self.assertIsNotNone(result, f"{text!r} should be accepted")
                self.assertEqual(result, expected)

    def test_invalid_dates(self):
        for text in ["25.11.2026", "2026-1-5", "", "2026-11-25 "]:
            with self.subTest(text=text):
                self.assertIsNone(parse_date(text))
```

Output of `python3 -m unittest test_dates -v`:

```text
test_invalid_dates (test_dates.TestParseDate.test_invalid_dates) ... ok
test_valid_dates (test_dates.TestParseDate.test_valid_dates) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

To see why the `msg` helps, imagine a bug in the pattern (say, `/` instead of `-`). The failures then read:

```text
FAIL: test_valid_dates (test_dates.TestParseDate.test_valid_dates) (text='2026-11-25')
AssertionError: unexpectedly None : '2026-11-25' should be accepted
FAIL: test_valid_dates (test_dates.TestParseDate.test_valid_dates) (text='1991-08-24')
AssertionError: unexpectedly None : '1991-08-24' should be accepted
```

`re.fullmatch()` requires the **whole** string to match, which is why the trailing space in `"2026-11-25 "` is rejected. With `re.match()` it would be accepted.

---

*Source: [pythontutorial.net — Python assertIsNone()](https://www.pythontutorial.net/python-unit-testing/python-assertisnone/). Adapted and expanded for PyJourney.*
