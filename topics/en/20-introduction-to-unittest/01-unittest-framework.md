# Unittest Framework

A **unit test** is a small automated check that one piece of your code does what it promises. Python ships a full testing framework in the standard library, the `unittest` module, so you can start writing tests without installing anything. Tests catch bugs early, guard against regressions when you change code, and document how your functions are supposed to behave.

## What you'll learn

- What a unit test is and how it differs from an integration test
- The xUnit vocabulary that `unittest` is built on: test case, fixture, assertion, suite, runner
- How to write a test class with `unittest.TestCase` and test methods
- How to run tests with `unittest.main()` and with `python -m unittest`, and how to read the output
- The difference between a **failure** (`F`) and an **error** (`E`)
- How to test that code raises the right exception with `assertRaises()` and `subTest()`

## What is a unit test

A unit test is an automated test that:

- checks a small piece of code, a **unit**, such as one function or one method;
- runs **fast**, in milliseconds, so you can run hundreds of them after every change;
- runs **in isolation**: it does not depend on other tests, on the order they run in, or on the network, a real database or files left behind by someone else.

The idea is to verify each building block of a program on its own. If every block works, a failure elsewhere is easier to pin down. This is different from an **integration test**, which checks that several parts work *together* (for example, your code plus a real database).

Unit tests pay off in three ways:

- **They find bugs** while the code is still fresh in your head.
- **They make refactoring safe.** You can restructure code and immediately see whether its behaviour changed.
- **They push you towards better design.** Code that is hard to test (huge functions, hidden global state) is usually hard to maintain too.

## xUnit terminology

`unittest` follows the **xUnit** design that started with Smalltalk's SUnit and Java's JUnit. The same words appear in testing tools for most languages:

| Term | Meaning in `unittest` |
|---|---|
| System under test | The function, class or method you are testing |
| Test case | A class that inherits from `unittest.TestCase`. Each of its `test*` methods is one test |
| Test fixture | Preparation before a test and cleanup after it, for example `setUp()` and `tearDown()` |
| Assertion | A method such as `assertEqual()` that checks a result and fails the test if it is wrong |
| Test suite | A collection of tests that run together |
| Test runner | The program that runs the suite and reports the results |

Fixtures, the many assertion methods, and the ways to run a suite each get their own topic later in this section.

## Your first test

Suppose `square.py` contains a class with an `area()` method:

```python
class Square:
    def __init__(self, length):
        self.length = length

    def area(self):
        return self.length * self.length
```

The tests live in a separate file, `test_square.py`, in the same folder:

```python
import unittest

from square import Square


class TestSquare(unittest.TestCase):
    def test_area(self):
        square = Square(10)
        area = square.area()
        self.assertEqual(area, 100)


if __name__ == "__main__":
    unittest.main()
```

What each piece does:

- `class TestSquare(unittest.TestCase)` creates a **test case**. Inheriting from `TestCase` gives you the assertion methods and lets the runner find the class.
- Every method whose name **starts with `test`** is a separate test. Other methods are ordinary helpers and are not run as tests.
- `test_area()` follows the common **Arrange, Act, Assert** pattern: create the object (`Square(10)`), call the code under test (`area()`), then check the result (`assertEqual(area, 100)`).
- `assertEqual(area, 100)` passes if `area == 100`. Otherwise it raises `AssertionError` with a message showing both values, and the test is reported as failed.
- `unittest.main()` collects the tests in this module, runs them and prints a report. The `if __name__ == "__main__":` guard makes it run only when the file is executed directly, not when it is imported.

## Running tests

### Running the file directly

From the folder that contains both files:

```bash
python3 test_square.py
```

Output (the time on the `Ran` line varies from run to run):

```text
.
----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Each character on the first line is one test: `.` means it passed. On Windows the command is usually `python` or `py` instead of `python3`.

For a line per test, pass `verbosity=2`:

```python
if __name__ == "__main__":
    unittest.main(verbosity=2)
```

Output:

```text
test_area (__main__.TestSquare.test_area) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

The name in parentheses is the full test id: module, class and method. When a file is run directly, its module name is `__main__`.

> **Note:** Since Python 3.11 the verbose line shows the full id (`TestSquare.test_area`). Older Python versions and many older tutorials show only `(test_square.TestSquare)`.

### Running with `python -m unittest`

You do not need the `unittest.main()` block at all. The `unittest` module has a command-line interface:

```bash
python3 -m unittest
python3 -m unittest -v
```

Output of the second command:

```text
test_area (test_square.TestSquare.test_area) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

With no arguments, `python -m unittest` performs **test discovery** in the current directory:

- it imports every file whose name matches `test*.py` (so `test_square.py` is found, `square_test.py` is not);
- inside those modules it collects **every subclass of `TestCase`**, whatever the class is called;
- in each class it runs the methods whose names start with `test`.

`-v` (verbose) gives the same per-test lines as `verbosity=2`. The `-m` flag tells Python to run a library module as a script, here the `unittest` module. The next topics show more ways to choose which tests run.

> **Tip:** `python -m unittest` is the more common way to run tests in real projects. It runs all test files at once, so the `if __name__ == "__main__":` block becomes optional.

## Reading the results: failures and errors

Let's add two broken tests to see what problems look like. One has a wrong expectation, the other calls `Square` with a string:

```python
import unittest

from square import Square


class TestSquare(unittest.TestCase):
    def test_area(self):
        square = Square(10)
        self.assertEqual(square.area(), 100)

    def test_area_of_unit_square(self):
        # the expected value is wrong on purpose
        self.assertEqual(Square(1).area(), 2)

    def test_area_with_text(self):
        self.assertEqual(Square("3").area(), 9)
```

Run:

```bash
python3 -m unittest
```

Output (paths shortened):

```text
.FE
======================================================================
ERROR: test_area_with_text (test_square.TestSquare.test_area_with_text)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_square.py", line 16, in test_area_with_text
    self.assertEqual(Square("3").area(), 9)
                     ~~~~~~~~~~~~~~~~^^
  File ".../square.py", line 6, in area
    return self.length * self.length
           ~~~~~~~~~~~~^~~~~~~~~~~~~
TypeError: can't multiply sequence by non-int of type 'str'

======================================================================
FAIL: test_area_of_unit_square (test_square.TestSquare.test_area_of_unit_square)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_square.py", line 13, in test_area_of_unit_square
    self.assertEqual(Square(1).area(), 2)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^
AssertionError: 1 != 2

----------------------------------------------------------------------
Ran 3 tests in 0.001s

FAILED (failures=1, errors=1)
```

The status line `.FE` has three different symbols:

| Symbol | Verbose word | Meaning |
|---|---|---|
| `.` | `ok` | The test passed |
| `F` | `FAIL` | An assertion failed: the code ran, but the result was wrong |
| `E` | `ERROR` | The test raised an unexpected exception (not `AssertionError`) |
| `s` | `skipped` | The test was skipped (covered in a later topic) |

The distinction is useful when debugging. A **failure** says "the answer is wrong". An **error** usually says "the code (or the test itself) crashed". When any test fails or errors, the command exits with status `1`, which CI systems treat as a failed build. A fully green run exits with `0`.

Notice that the tests are reported in **alphabetical order** of method names, not in the order they appear in the file. Tests must not depend on each other's order.

## Testing expected exceptions

Good code rejects bad input loudly. Suppose `Square` should accept only numbers. A non-number should raise `TypeError`. The test is written with `assertRaises()` used as a context manager:

```python
import unittest

from square import Square


class TestSquare(unittest.TestCase):
    def test_area(self):
        square = Square(10)
        area = square.area()
        self.assertEqual(area, 100)

    def test_length_with_wrong_type(self):
        with self.assertRaises(TypeError):
            Square("10")
```

The test passes only if the code inside the `with` block raises `TypeError` (or a subclass of it). The current `Square` accepts anything, so the test fails:

```bash
python3 -m unittest -v
```

Output:

```text
test_area (test_square.TestSquare.test_area) ... ok
test_length_with_wrong_type (test_square.TestSquare.test_length_with_wrong_type) ... FAIL

======================================================================
FAIL: test_length_with_wrong_type (test_square.TestSquare.test_length_with_wrong_type)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_square.py", line 13, in test_length_with_wrong_type
    with self.assertRaises(TypeError):
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^
AssertionError: TypeError not raised

----------------------------------------------------------------------
Ran 2 tests in 0.000s

FAILED (failures=1)
```

Writing the test first and watching it fail is the heart of **test-driven development** (TDD): a failing test proves that it really checks something. Now make it pass by validating the argument in `square.py`:

```python
class Square:
    def __init__(self, length):
        if isinstance(length, bool) or not isinstance(length, (int, float)):
            raise TypeError("Length must be an int or float")
        self.length = length

    def area(self):
        return self.length * self.length
```

`isinstance()` also accepts subclasses of `int` and `float`, which is usually what you want. `bool` is excluded explicitly because `True` and `False` are technically integers, and `Square(True)` makes no sense.

Output of `python3 -m unittest -v`:

```text
test_area (test_square.TestSquare.test_area) ... ok
test_length_with_wrong_type (test_square.TestSquare.test_length_with_wrong_type) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

### Checking several bad values with `subTest()`

A square cannot have a zero or negative side, so `Square(0)` and `Square(-1)` should raise `ValueError`. To check several inputs in one test, loop over them and wrap each check in `self.subTest()`:

```python
    def test_length_with_zero_or_negative(self):
        for length in (0, -1, -2.5):
            with self.subTest(length=length):
                with self.assertRaises(ValueError):
                    Square(length)
```

This method goes into the `TestSquare` class. `subTest()` makes each value a separate sub-check: if one value fails, the loop continues, and the report shows exactly which value broke. Suppose the first implementation forgets about zero:

```python
        if length < 0:
            raise ValueError("Length must be positive")
```

Output of `python3 -m unittest -v`:

```text
test_area (test_square.TestSquare.test_area) ... ok
test_length_with_wrong_type (test_square.TestSquare.test_length_with_wrong_type) ... ok
test_length_with_zero_or_negative (test_square.TestSquare.test_length_with_zero_or_negative) ...
  test_length_with_zero_or_negative (test_square.TestSquare.test_length_with_zero_or_negative) (length=0) ... FAIL

======================================================================
FAIL: test_length_with_zero_or_negative (test_square.TestSquare.test_length_with_zero_or_negative) (length=0)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_square.py", line 19, in test_length_with_zero_or_negative
    with self.assertRaises(ValueError):
         ~~~~~~~~~~~~~~~~~^^^^^^^^^^^^
AssertionError: ValueError not raised

----------------------------------------------------------------------
Ran 3 tests in 0.000s

FAILED (failures=1)
```

The `(length=0)` suffix points straight at the bug. The final version of `square.py`:

```python
class Square:
    def __init__(self, length):
        if isinstance(length, bool) or not isinstance(length, (int, float)):
            raise TypeError("Length must be an int or float")
        if length <= 0:
            raise ValueError("Length must be positive")
        self.length = length

    def area(self):
        return self.length * self.length
```

Output:

```text
test_area (test_square.TestSquare.test_area) ... ok
test_length_with_wrong_type (test_square.TestSquare.test_length_with_wrong_type) ... ok
test_length_with_zero_or_negative (test_square.TestSquare.test_length_with_zero_or_negative) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

### Checking the exception message

`assertRaises()` only checks the exception *type*. To check the message too, either keep the context manager object with `as` and inspect its `exception` attribute, or use `assertRaisesRegex()`, which searches the message with a regular expression:

```python
import unittest

from square import Square


class TestSquareErrors(unittest.TestCase):
    def test_wrong_type_message(self):
        with self.assertRaises(TypeError) as cm:
            Square("10")
        self.assertEqual(str(cm.exception), "Length must be an int or float")

    def test_negative_message(self):
        with self.assertRaisesRegex(ValueError, "must be positive"):
            Square(-5)
```

Output of `python3 -m unittest test_messages -v` (the file is `test_messages.py`):

```text
test_negative_message (test_messages.TestSquareErrors.test_negative_message) ... ok
test_wrong_type_message (test_messages.TestSquareErrors.test_wrong_type_message) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Note that `self.assertEqual(...)` on `cm.exception` is placed **after** the `with` block. Any line inside the block after the raising call would never run.

## Common mistakes

- **Forgetting the `test` prefix.** A method called `check_area()` or `area_test()` is silently ignored. No warning, no failure. Always name test methods `test_...`.
- **Naming the file so discovery cannot see it.** `python -m unittest` looks for `test*.py` by default. A file called `square_tests.py` is never imported, and if no tests are found at all, Python 3.12+ prints `NO TESTS RAN` and exits with status `5`.
- **Putting several calls in one `assertRaises()` block.** The block ends at the first exception, so later lines never run:

  ```python
  def test_length_with_zero_or_negative(self):
      with self.assertRaises(ValueError):
          Square(0)
          Square(-1)
  ```

  With the buggy `if length < 0` check, `Square(0)` does not raise, `Square(-1)` does, and the test **passes** even though zero is accepted. Use one block per call, or a `subTest()` loop.
- **Using a bare `assert` statement.** It works inside a test, but on failure it prints just `AssertionError`, without the values. It is also removed completely when Python runs with `-O`. `self.assertEqual(area, 5)` reports `4 != 5`.
- **Making tests depend on each other.** Each test method runs on a fresh instance of the test class, and the order is alphabetical, not the order in the file. Never let one test rely on state left by another.
- **Naming your own file `unittest.py`.** It shadows the standard module, and `import unittest` imports your file instead.

## Summary

- A unit test checks one small piece of code automatically, quickly and in isolation.
- Create a test case by subclassing `unittest.TestCase`. Each method whose name starts with `test` is one test.
- Use assertion methods such as `assertEqual()` instead of bare `assert`, because they produce informative messages.
- Run tests with `python -m unittest` (discovers `test*.py` files) or with `unittest.main()` inside the test file. Add `-v` or `verbosity=2` to see one line per test.
- `.` is a pass, `F` a failed assertion, `E` an unexpected exception. The exit status is `0` only when everything passes.
- Use `with self.assertRaises(SomeError):` to test expected exceptions. Use `as cm` or `assertRaisesRegex()` to check the message.
- Use `self.subTest()` to check many inputs in one test and see exactly which one failed.

## Practice

### Exercise 1: Test a rectangle

Create `rectangle.py` with a class `Rectangle(width, height)` that has `area()` and `perimeter()` methods. Write `test_rectangle.py` with one test per method, and make it runnable with `python3 test_rectangle.py` showing one line per test.

### Exercise 2: Where did my tests go?

A folder contains only this file, `rectangle_checks.py`:

```python
import unittest


class RectangleChecks(unittest.TestCase):
    def area_test(self):
        self.assertEqual(3 * 4, 12)

    def testPerimeter(self):
        self.assertEqual(2 * (3 + 4), 14)

    def test_diagonal(self):
        self.assertEqual((3**2 + 4**2) ** 0.5, 5.0)
```

1. Predict what `python3 -m unittest -v` prints in that folder.
2. Predict what `python3 -m unittest rectangle_checks -v` prints.
3. Rename what needs renaming so that all three checks run with plain `python3 -m unittest -v`.

### Exercise 3: Test input validation

Here is a function in `ages.py`:

```python
def parse_age(text):
    if not text.strip().isdigit():
        raise ValueError(f"not a number: {text!r}")
    age = int(text)
    if age > 150:
        raise ValueError(f"unrealistic age: {age}")
    return age
```

Write `test_ages.py` that checks:

- valid inputs such as `"42"`, `" 7 "` and `"0"`;
- that `""`, `"abc"`, `"-5"` and `"4.5"` all raise `ValueError`, using a `subTest()` loop;
- that `parse_age("200")` raises `ValueError` with exactly the message `unrealistic age: 200`.

## Solutions

### Exercise 1

`rectangle.py`:

```python
class Rectangle:
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def area(self):
        return self.width * self.height

    def perimeter(self):
        return 2 * (self.width + self.height)
```

`test_rectangle.py`:

```python
import unittest

from rectangle import Rectangle


class TestRectangle(unittest.TestCase):
    def test_area(self):
        rectangle = Rectangle(3, 4)
        self.assertEqual(rectangle.area(), 12)

    def test_perimeter(self):
        rectangle = Rectangle(3, 4)
        self.assertEqual(rectangle.perimeter(), 14)


if __name__ == "__main__":
    unittest.main(verbosity=2)
```

Output of `python3 test_rectangle.py` (timing varies):

```text
test_area (__main__.TestRectangle.test_area) ... ok
test_perimeter (__main__.TestRectangle.test_perimeter) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

### Exercise 2

1. Discovery imports only files matching `test*.py`, and `rectangle_checks.py` does not match, so nothing runs:

   ```text
   ----------------------------------------------------------------------
   Ran 0 tests in 0.000s

   NO TESTS RAN
   ```

   The exit status is `5`.

2. Naming the module explicitly bypasses the file-name pattern. Now the method-name rule applies: `testPerimeter` and `test_diagonal` start with `test`, `area_test` does not:

   ```text
   testPerimeter (rectangle_checks.RectangleChecks.testPerimeter) ... ok
   test_diagonal (rectangle_checks.RectangleChecks.test_diagonal) ... ok

   ----------------------------------------------------------------------
   Ran 2 tests in 0.000s

   OK
   ```

   The class name `RectangleChecks` is fine: any `TestCase` subclass is collected.

3. Rename the file to `test_rectangle_checks.py` and the methods to `test_...`:

   ```python
   import unittest


   class RectangleChecks(unittest.TestCase):
       def test_area(self):
           self.assertEqual(3 * 4, 12)

       def test_perimeter(self):
           self.assertEqual(2 * (3 + 4), 14)

       def test_diagonal(self):
           self.assertEqual((3**2 + 4**2) ** 0.5, 5.0)
   ```

   Output of `python3 -m unittest -v`:

   ```text
   test_area (test_rectangle_checks.RectangleChecks.test_area) ... ok
   test_diagonal (test_rectangle_checks.RectangleChecks.test_diagonal) ... ok
   test_perimeter (test_rectangle_checks.RectangleChecks.test_perimeter) ... ok

   ----------------------------------------------------------------------
   Ran 3 tests in 0.000s

   OK
   ```

### Exercise 3

```python
import unittest

from ages import parse_age


class TestParseAge(unittest.TestCase):
    def test_valid_ages(self):
        self.assertEqual(parse_age("42"), 42)
        self.assertEqual(parse_age(" 7 "), 7)
        self.assertEqual(parse_age("0"), 0)

    def test_not_a_number(self):
        for text in ("", "abc", "-5", "4.5"):
            with self.subTest(text=text):
                with self.assertRaises(ValueError):
                    parse_age(text)

    def test_unrealistic_age_message(self):
        with self.assertRaises(ValueError) as cm:
            parse_age("200")
        self.assertEqual(str(cm.exception), "unrealistic age: 200")
```

Output of `python3 -m unittest -v`:

```text
test_not_a_number (test_ages.TestParseAge.test_not_a_number) ... ok
test_unrealistic_age_message (test_ages.TestParseAge.test_unrealistic_age_message) ... ok
test_valid_ages (test_ages.TestParseAge.test_valid_ages) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

To convince yourself the tests are useful, break `parse_age()` on purpose (for example, change `150` to `250`) and run them again: `test_unrealistic_age_message` should fail.

---

*Source: [pythontutorial.net — Python unittest](https://www.pythontutorial.net/python-unit-testing/python-unittest/). Adapted and expanded for PyJourney.*
