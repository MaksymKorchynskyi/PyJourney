# Test Coverage

Passing tests tell you that the code they run works. They say nothing about the code they **never run**. **Test coverage** (also called code coverage) measures which lines, and optionally which branches, your test suite actually executes. It is the quickest way to find untested code. In Python the standard tool for it is the third-party package `coverage` (coverage.py).

## What you'll learn

- What test coverage measures and how the percentage is calculated
- How to collect coverage data with `coverage run -m unittest`
- How to read `coverage report -m`, including the `Missing` column, and how to create an HTML report with `coverage html`
- The difference between line coverage and **branch coverage**
- How to configure coverage in `pyproject.toml`, exclude code, and fail a build below a threshold
- Why 100% coverage does not mean the tests are good

## What coverage measures

In its simplest form, coverage is the share of statements executed by at least one test:

```text
line coverage = statements executed by the tests / total statements
```

- **Low coverage** (say 5–40%) is a clear signal: large parts of the code are never exercised, so bugs there will not be caught.
- **High coverage** is necessary but not sufficient. A test that calls a function without checking the result still "covers" every line it runs. Coverage tells you what was **executed**, not what was **verified**.

So use coverage as a flashlight that shows dark corners, not as a grade for test quality.

## Installing coverage.py

`coverage` is not part of the standard library. Install it into your project's virtual environment:

```bash
python -m pip install coverage
```

This gives you a `coverage` command. `python -m coverage ...` does exactly the same thing and is handy when the `coverage` script is not on your `PATH`.

## The example project

The examples use this layout (the project folder is called `python-unit-testing`):

```text
python-unit-testing
├── shapes
│   ├── circle.py
│   ├── shape.py
│   └── square.py
└── test
    ├── __init__.py
    ├── test_circle.py
    └── test_square.py
```

`shapes/shape.py`:

```python
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self) -> float:
        pass
```

`shapes/circle.py`:

```python
import math
from .shape import Shape


class Circle(Shape):
    def __init__(self, radius: float) -> None:
        if radius < 0:
            raise ValueError('The radius cannot be negative')

        self._radius = radius

    def area(self) -> float:
        return math.pi * math.pow(self._radius, 2)
```

`shapes/square.py`:

```python
import math
from .shape import Shape


class Square(Shape):
    def __init__(self, length: float) -> None:
        if length < 0:
            raise ValueError('The length cannot be negative')
        self._length = length

    def area(self) -> float:
        return math.pow(self._length, 2)
```

`test/test_circle.py`:

```python
import unittest
import math

from shapes.circle import Circle
from shapes.shape import Shape


class TestCircle(unittest.TestCase):
    def test_circle_instance_of_shape(self):
        circle = Circle(10)
        self.assertIsInstance(circle, Shape)

    def test_create_circle_negative_radius(self):
        with self.assertRaises(ValueError):
            circle = Circle(-1)

    def test_area(self):
        circle = Circle(2.5)
        self.assertAlmostEqual(circle.area(), math.pi * 2.5*2.5)
```

`test/test_square.py`:

```python
import unittest

from shapes.square import Square
from shapes.shape import Shape


class TestSquare(unittest.TestCase):

    def test_create_square_negative_length(self):
        with self.assertRaises(ValueError):
            square = Square(-1)

    def test_square_instance_of_shape(self):
        square = Square(10)
        self.assertIsInstance(square, Shape)

    def test_area(self):
        square = Square(10)
        area = square.area()
        self.assertEqual(area, 100)
```

`test/__init__.py` is empty. It makes `test` a package, so `python -m unittest` discovers the tests when you run it from the project folder. `shapes` has no `__init__.py` and still imports fine as a namespace package, although adding an empty `__init__.py` is the more common style.

## Step 1: collect coverage data

Run the test suite **under coverage** from the project folder:

```bash
coverage run -m unittest
```

Output (the time varies):

```text
......
----------------------------------------------------------------------
Ran 6 tests in 0.000s

OK
```

`coverage run` starts Python with measurement switched on, so everything after `run` is exactly what you would normally run: `-m unittest` means "run the `unittest` module", which discovers and runs all tests. The tests behave as usual. In addition, coverage writes the measured data to a file named `.coverage` in the current folder.

## Step 2: show the report

```bash
coverage report
```

Output:

```text
Name                  Stmts   Miss  Cover
-----------------------------------------
shapes/circle.py          9      0   100%
shapes/shape.py           5      1    80%
shapes/square.py          9      0   100%
test/__init__.py          0      0   100%
test/test_circle.py      14      0   100%
test/test_square.py      14      0   100%
-----------------------------------------
TOTAL                    51      1    98%
```

(On Windows the paths are shown with `\`.)

The columns:

| Column | Meaning |
|---|---|
| `Stmts` | Executable statements in the file |
| `Miss` | Statements that never ran |
| `Cover` | `(Stmts - Miss) / Stmts` as a percentage |

Something is missed in `shape.py`. Add `-m` (`--show-missing`) to see **which** lines:

```bash
coverage report -m
```

Output:

```text
Name                  Stmts   Miss  Cover   Missing
---------------------------------------------------
shapes/circle.py          9      0   100%
shapes/shape.py           5      1    80%   7
shapes/square.py          9      0   100%
test/__init__.py          0      0   100%
test/test_circle.py      14      0   100%
test/test_square.py      14      0   100%
---------------------------------------------------
TOTAL                    51      1    98%
```

Line 7 of `shape.py` is the `pass` inside the abstract method. That body never runs: `Circle` and `Square` override `area()`, and an abstract class cannot be instantiated. The report is correct, but the "missing" line is not worth testing.

The idiomatic body for an abstract method is `...` instead of `pass`:

```python
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self) -> float:
        ...
```

Since version 7.10, coverage.py excludes `...`-only bodies by default. Its built-in pattern matches the `def` line together with a body that is just `...`, so the whole method (decorator, `def` line and body) drops out of the count. So after this change and a new `coverage run -m unittest`, `coverage report -m` shows:

```text
Name                  Stmts   Miss  Cover   Missing
---------------------------------------------------
shapes/circle.py          9      0   100%
shapes/shape.py           2      0   100%
shapes/square.py          9      0   100%
test/__init__.py          0      0   100%
test/test_circle.py      14      0   100%
test/test_square.py      14      0   100%
---------------------------------------------------
TOTAL                    48      0   100%
```

> **Note:** Exact statement counts depend on the coverage.py and Python versions. The original tutorial, made with older versions, showed `shape.py` with 4 statements at 100% even with `pass`. The output in this topic comes from coverage.py 7.17 on Python 3.14.

## Step 3: the HTML report

The terminal report shows line numbers. The HTML report shows your **source code** with every line coloured: green for executed, red for missed, and (with branch coverage) yellow for partially executed lines.

```bash
coverage html
```

Output:

```text
Wrote HTML report to htmlcov/index.html
```

Open `htmlcov/index.html` in a browser. The index lists all files with their percentages, and clicking a file shows its annotated source. The `htmlcov` folder and the `.coverage` data file are generated artefacts, so add both to `.gitignore`.

## Finding untested code

Now add a `perimeter()` method to `Circle` without writing a test for it:

```python
import math
from .shape import Shape


class Circle(Shape):
    def __init__(self, radius: float) -> None:
        if radius < 0:
            raise ValueError('The radius cannot be negative')

        self._radius = radius

    def area(self) -> float:
        return math.pi * math.pow(self._radius, 2)

    def perimeter(self) -> float:
        return 2 * math.pi * self._radius
```

Collect the data again and show the report:

```bash
coverage run -m unittest
coverage report -m
```

Output (the test output is the same as before and omitted):

```text
Name                  Stmts   Miss  Cover   Missing
---------------------------------------------------
shapes/circle.py         11      1    91%   16
shapes/shape.py           2      0   100%
shapes/square.py          9      0   100%
test/__init__.py          0      0   100%
test/test_circle.py      14      0   100%
test/test_square.py      14      0   100%
---------------------------------------------------
TOTAL                    50      1    98%
```

`circle.py` now has 11 statements. The tests execute 10 of them, so its coverage is 10 / 11, about 91%. Line 16 is the body of `perimeter()`. The `def perimeter` line itself (line 15) counts as executed, because it runs when the class is created at import time. Only the body runs when the method is called.

## Measuring only your own code

By default coverage measures every file it sees executing, apart from the standard library and installed packages. That is why the test files appear in the report and push the total up: test code almost always runs completely. Use `--source` to restrict measurement to your package:

```bash
coverage run --source=shapes -m unittest
coverage report -m
```

Output (the test output is omitted):

```text
Name               Stmts   Miss  Cover   Missing
------------------------------------------------
shapes/circle.py      11      1    91%   16
shapes/shape.py        2      0   100%
shapes/square.py       9      0   100%
------------------------------------------------
TOTAL                 22      1    95%
```

The total dropped from 98% to 95%, which is a more honest number.

## Branch coverage

Line coverage has a blind spot. Consider `pricing.py`:

```python
def final_price(price, is_member):
    if is_member:
        price = price * 0.9
    return round(price, 2)
```

and a test that only checks members:

```python
import unittest

from pricing import final_price


class TestFinalPrice(unittest.TestCase):
    def test_member_gets_discount(self):
        self.assertEqual(final_price(100, is_member=True), 90.0)
```

```bash
coverage run --source=pricing -m unittest
coverage report -m
```

Output (the test output is omitted):

```text
Name         Stmts   Miss  Cover   Missing
------------------------------------------
pricing.py       4      0   100%
------------------------------------------
TOTAL            4      0   100%
```

Every line ran, yet the "non-member" path (the `if` being false and jumping straight to `return`) was never tested. **Branch coverage** tracks each possible jump. Turn it on with `--branch`:

```bash
coverage run --branch --source=pricing -m unittest
coverage report -m
```

Output (the test output is omitted):

```text
Name         Stmts   Miss Branch BrPart  Cover   Missing
--------------------------------------------------------
pricing.py       4      0      2      1    83%   2->4
--------------------------------------------------------
TOTAL            4      0      2      1    83%
```

- `Branch`: the number of possible branch destinations (the `if` on line 2 can go to line 3 or to line 4).
- `BrPart`: lines with a **partial** branch, where only some destinations were taken.
- `2->4` in `Missing`: the jump from line 2 to line 4 (condition false) never happened.
- `Cover` now counts statements and branches together: (4 + 1) / (4 + 2) = 5 / 6, about 83%.

Branch coverage is stricter and more useful. It is a good idea to switch it on for every project.

## Configuring coverage

Typing the options every time is tedious. coverage.py reads its settings from `pyproject.toml` (or `.coveragerc`, `setup.cfg`, `tox.ini`):

```toml
[tool.coverage.run]
source = ["shapes"]
branch = true

[tool.coverage.report]
show_missing = true
fail_under = 100
```

Now a plain `coverage run -m unittest` measures only `shapes` with branch coverage, and `coverage report` shows missing lines. `fail_under` makes `coverage report` exit with status `2` when the total is below the threshold, which fails a CI build:

```bash
coverage run -m unittest
coverage report
echo "exit code: $?"
```

Output (the test output is omitted):

```text
Name               Stmts   Miss Branch BrPart  Cover   Missing
--------------------------------------------------------------
shapes/circle.py      11      1      2      0    92%   16
shapes/shape.py        2      0      0      0   100%
shapes/square.py       9      0      2      0   100%
--------------------------------------------------------------
TOTAL                 22      1      4      0    96%
Coverage failure: total of 96 is less than fail-under=100
exit code: 2
```

`circle.py` is at 92% now: (10 + 2) / (11 + 2), because its two branches (`radius < 0` true and false) are both covered.

### Excluding code on purpose

Some code is not worth testing or cannot run in tests: a debugging helper, a placeholder that raises `NotImplementedError`, a script entry point. Take `tools.py`:

```python
def double(x):
    return x * 2


def debug_dump(shape):  # pragma: no cover
    print(vars(shape))


def later():
    raise NotImplementedError


if __name__ == '__main__':
    print(double(21))
```

and a test that only checks `double()`:

```python
import unittest

from tools import double


class TestTools(unittest.TestCase):
    def test_double(self):
        self.assertEqual(double(21), 42)
```

`coverage run --source=tools -m unittest` and `coverage report -m` give:

```text
Name       Stmts   Miss  Cover   Missing
----------------------------------------
tools.py       6      2    67%   10, 14
----------------------------------------
TOTAL          6      2    67%
```

`debug_dump()` is not in the count at all: a `# pragma: no cover` comment on a line that starts a block (`def`, `class`, `if`) excludes the whole block. Lines 10 and 14 are still reported. For recurring patterns like these, add regular expressions to the configuration instead of sprinkling comments:

```toml
[tool.coverage.report]
exclude_also = [
    'if __name__ == .__main__.:',
    'raise NotImplementedError',
]
```

Exclusions are applied when the report is built, so `coverage report -m` alone (no new run needed) now shows:

```text
Name       Stmts   Miss  Cover   Missing
----------------------------------------
tools.py       3      0   100%
----------------------------------------
TOTAL          3      0   100%
```

`exclude_also` adds to the built-in exclusions (the pragma comment, `...`-only lines and `if TYPE_CHECKING:` blocks) instead of replacing them. Use exclusions sparingly: every excluded line is a line nobody checks.

### Other useful commands

| Command | What it does |
|---|---|
| `coverage erase` | Delete the collected data (`.coverage`) |
| `coverage report --skip-covered` | Hide files that are at 100% |
| `coverage html` | Write the annotated HTML report to `htmlcov/` |
| `coverage xml` / `coverage json` | Machine-readable reports for CI services |
| `coverage run -m unittest test.test_circle` | Measure a single test module |

## Coverage is not quality

Here is a deliberately bad test for a buggy `pricing.py`:

```python
def final_price(price, is_member):
    if is_member:
        price = price * 0.09  # bug: should be 0.9
    return round(price, 2)
```

```python
import unittest

from pricing import final_price


class TestFinalPrice(unittest.TestCase):
    def test_runs(self):
        final_price(100, is_member=True)
        final_price(100, is_member=False)
```

Output of `coverage run --branch --source=pricing -m unittest` followed by `coverage report -m` (the time varies):

```text
.
----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
Name         Stmts   Miss Branch BrPart  Cover   Missing
--------------------------------------------------------
pricing.py       4      0      2      0   100%
--------------------------------------------------------
TOTAL            4      0      2      0   100%
```

100% line **and** branch coverage, a green test run, and a bug that charges members 9% of the price. The test has no assertions, so it verifies nothing. Coverage shows what to test next, but only assertions check that the code is right.

## Common mistakes

- **Running `coverage report` without `coverage run` first** (or after changing the code without re-running). The report always describes the last collected data.
- **Running the tests with `python -m unittest` and expecting coverage data.** Only `coverage run -m unittest` measures anything.
- **Counting test files in the total.** Without `--source` (or `source = [...]` in the config), test modules inflate the percentage. Measure the code under test.
- **Chasing 100% at any cost.** Tests written only to touch lines (no assertions, mocks of everything) raise the number and lower the value of the suite. Aim for meaningful tests of important behaviour, and let coverage point at what is left.
- **Ignoring branch coverage.** Line coverage misses untested `if`/`else` paths. Enable `branch = true`.
- **Committing `.coverage` and `htmlcov/`.** They are generated files and belong in `.gitignore`.

## Summary

- Test coverage measures which statements (and branches) the tests execute. It finds untested code but does not prove the tests are good.
- Install `coverage` (third-party), run the tests with `coverage run -m unittest`, then view the results with `coverage report -m`. The `Missing` column lists unexecuted lines.
- `coverage html` writes an annotated, coloured report to `htmlcov/index.html`.
- Use `--source=<package>` to measure only your code, and `--branch` to catch untested `if`/`else` paths (shown as `line->line` in `Missing`).
- Put settings in `pyproject.toml` under `[tool.coverage.run]` and `[tool.coverage.report]`. `fail_under` turns a coverage drop into a failing build.
- Exclude untestable code with `# pragma: no cover` or `exclude_also`, but sparingly.

## Practice

### Exercise 1: Back to 100%

In the shapes project, `perimeter()` is untested. Add a `test_perimeter` method to `TestCircle` and verify with `coverage run --source=shapes -m unittest` and `coverage report -m` that every file is at 100% again.

### Exercise 2: Close the branch gap

For `pricing.py` (the correct version with `0.9`) and the single member test, run branch coverage and find the missing branch. Add a test that covers it and show that branch coverage reaches 100%.

### Exercise 3: A coverage gate

Create a `pyproject.toml` for the shapes project that measures only `shapes`, enables branch coverage, shows missing lines and fails below 100%. Show the exit code of `coverage report` before and after adding the perimeter test from Exercise 1.

## Solutions

### Exercise 1

`test/test_circle.py`:

```python
import unittest
import math

from shapes.circle import Circle
from shapes.shape import Shape


class TestCircle(unittest.TestCase):
    def test_circle_instance_of_shape(self):
        circle = Circle(10)
        self.assertIsInstance(circle, Shape)

    def test_create_circle_negative_radius(self):
        with self.assertRaises(ValueError):
            Circle(-1)

    def test_area(self):
        circle = Circle(2.5)
        self.assertAlmostEqual(circle.area(), math.pi * 2.5 * 2.5)

    def test_perimeter(self):
        circle = Circle(2.5)
        self.assertAlmostEqual(circle.perimeter(), 2 * math.pi * 2.5)
```

```bash
coverage run --source=shapes -m unittest
coverage report -m
```

Output (the time varies):

```text
.......
----------------------------------------------------------------------
Ran 7 tests in 0.000s

OK
Name               Stmts   Miss  Cover   Missing
------------------------------------------------
shapes/circle.py      11      0   100%
shapes/shape.py        2      0   100%
shapes/square.py       9      0   100%
------------------------------------------------
TOTAL                 22      0   100%
```

`assertAlmostEqual()` is the right check for floating-point results such as `2 * math.pi * 2.5`.

### Exercise 2

`coverage run --branch --source=pricing -m unittest` with only the member test reports `2->4` as missing: the `if is_member:` condition was never false. Add a non-member test:

```python
import unittest

from pricing import final_price


class TestFinalPrice(unittest.TestCase):
    def test_member_gets_discount(self):
        self.assertEqual(final_price(100, is_member=True), 90.0)

    def test_non_member_pays_full_price(self):
        self.assertEqual(final_price(100, is_member=False), 100)
```

```bash
coverage run --branch --source=pricing -m unittest -v
coverage report -m
```

Output (the time varies):

```text
test_member_gets_discount (test_pricing.TestFinalPrice.test_member_gets_discount) ... ok
test_non_member_pays_full_price (test_pricing.TestFinalPrice.test_non_member_pays_full_price) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
Name         Stmts   Miss Branch BrPart  Cover   Missing
--------------------------------------------------------
pricing.py       4      0      2      0   100%
--------------------------------------------------------
TOTAL            4      0      2      0   100%
```

### Exercise 3

`pyproject.toml` in the project folder:

```toml
[tool.coverage.run]
source = ["shapes"]
branch = true

[tool.coverage.report]
show_missing = true
fail_under = 100
```

Before the perimeter test:

```bash
coverage run -m unittest
coverage report
echo "exit code: $?"
```

```text
Name               Stmts   Miss Branch BrPart  Cover   Missing
--------------------------------------------------------------
shapes/circle.py      11      1      2      0    92%   16
shapes/shape.py        2      0      0      0   100%
shapes/square.py       9      0      2      0   100%
--------------------------------------------------------------
TOTAL                 22      1      4      0    96%
Coverage failure: total of 96 is less than fail-under=100
exit code: 2
```

After adding `test_perimeter` and running the same three commands:

```text
Name               Stmts   Miss Branch BrPart  Cover   Missing
--------------------------------------------------------------
shapes/circle.py      11      0      2      0   100%
shapes/shape.py        2      0      0      0   100%
shapes/square.py       9      0      2      0   100%
--------------------------------------------------------------
TOTAL                 22      0      4      0   100%
exit code: 0
```

A CI pipeline that runs these commands fails as soon as someone adds code without tests. In real projects a slightly lower gate (for example 90%) is often more practical than 100%.

---

*Source: [pythontutorial.net — Python unittest Coverage](https://www.pythontutorial.net/python-unit-testing/python-unittest-coverage/). Adapted and expanded for PyJourney.*
