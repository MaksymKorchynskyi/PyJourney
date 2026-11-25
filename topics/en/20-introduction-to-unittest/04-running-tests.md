# Running Tests

As a project grows, so does its test suite, and running "all tests, every time" stops being convenient. This topic shows how to lay out a project so that `unittest` can find your tests, and how to run exactly the tests you need: everything, one module, one class, one method, or anything whose name matches a pattern.

## What you'll learn

- How to organise application code and test code in separate packages
- Why the `tests` folder needs an `__init__.py` and why it should not be called `test`
- How test discovery works and how to tune it with `-s`, `-p` and `-t`
- How to run a single module, class or method, by dotted name or by file path
- How to filter tests by name with `-k`
- Useful options: `-v`, `-f`, `-b`, `--locals`, `--durations`, and what the exit codes mean

## Organising the code

With two or three modules, keeping `test_*.py` files next to the code is fine. Real projects have packages, and mixing tests with application code gets messy. The usual layout keeps them in separate top-level folders:

```text
shapes-project/
├── shapes/
│   ├── __init__.py
│   ├── shape.py
│   ├── circle.py
│   └── square.py
└── tests/
    ├── __init__.py
    ├── test_circle.py
    └── test_square.py
```

`shapes/shape.py` defines an abstract base class:

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
            raise ValueError("The radius cannot be negative")
        self._radius = radius

    def area(self) -> float:
        return math.pi * self._radius ** 2
```

`shapes/square.py`:

```python
from .shape import Shape


class Square(Shape):
    def __init__(self, length: float) -> None:
        if length < 0:
            raise ValueError("The length cannot be negative")
        self._length = length

    def area(self) -> float:
        return self._length ** 2
```

The modules inside `shapes` import each other with **relative imports** (`from .shape import Shape`), because they are part of one package. Both `__init__.py` files can be empty.

`tests/test_circle.py` imports the code under test by its package name:

```python
import math
import unittest

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
```

`tests/test_square.py`:

```python
import unittest

from shapes.shape import Shape
from shapes.square import Square


class TestSquare(unittest.TestCase):
    def test_create_square_negative_length(self):
        with self.assertRaises(ValueError):
            Square(-1)

    def test_square_instance_of_shape(self):
        square = Square(10)
        self.assertIsInstance(square, Shape)

    def test_area(self):
        square = Square(10)
        self.assertEqual(square.area(), 100)
```

`assertIsInstance()` and `assertAlmostEqual()` are covered in detail in the "Assert Methods" section.

### Why `from shapes.circle import ...` works

All commands below are run **from the project root** (`shapes-project/`). `python -m` puts the current directory at the front of `sys.path`, the list of places Python searches for imports. That is why `import shapes` works inside the tests even though the tests live in another folder.

### Why `tests/__init__.py` matters

Discovery only descends into subfolders that are **regular packages**, that is, folders with an `__init__.py`. Without it, `python -m unittest` from the project root silently finds nothing:

```text
----------------------------------------------------------------------
Ran 0 tests in 0.000s

NO TESTS RAN
```

> **Note:** Since Python 3.11, `unittest` discovery no longer supports namespace packages (folders without `__init__.py`). Many older tutorials do not mention this.

### Why `tests`, not `test`

Python's standard library already contains a package called `test` (CPython's own regression tests). A local folder with the same name can collide with it. For example, if your `test/` folder lacks `__init__.py`, the standard `test` package wins, and `python -m unittest test.test_circle` fails with `ModuleNotFoundError: No module named 'test.test_circle'`. Call the folder `tests` and avoid the problem entirely.

## Running all tests

From the project root:

```bash
python3 -m unittest -v
```

Output (the time varies):

```text
test_area (tests.test_circle.TestCircle.test_area) ... ok
test_circle_instance_of_shape (tests.test_circle.TestCircle.test_circle_instance_of_shape) ... ok
test_create_circle_negative_radius (tests.test_circle.TestCircle.test_create_circle_negative_radius) ... ok
test_area (tests.test_square.TestSquare.test_area) ... ok
test_create_square_negative_length (tests.test_square.TestSquare.test_create_square_negative_length) ... ok
test_square_instance_of_shape (tests.test_square.TestSquare.test_square_instance_of_shape) ... ok

----------------------------------------------------------------------
Ran 6 tests in 0.000s

OK
```

Running `python3 -m unittest` with no test names is a shortcut for `python3 -m unittest discover`. Both commands produce the same result. Discovery:

1. starts in the current directory;
2. recursively walks into every subfolder that is a package;
3. imports every module whose file name matches `test*.py`;
4. collects every `TestCase` subclass and its `test*` methods.

Because `tests` is a package, the test ids start with `tests.` (`tests.test_circle.TestCircle.test_area`).

### Tuning discovery: `-s`, `-p`, `-t`

The `discover` subcommand accepts three options:

| Option | Meaning | Default |
|---|---|---|
| `-s`, `--start-directory` | Folder to start searching in | `.` |
| `-p`, `--pattern` | File-name pattern for test modules | `test*.py` |
| `-t`, `--top-level-directory` | Project root used to build module names | the start directory |

For example, to run only test files whose names start with `test_c` inside `tests`:

```bash
python3 -m unittest discover -s tests -p "test_c*.py" -v
```

Output:

```text
test_area (test_circle.TestCircle.test_area) ... ok
test_circle_instance_of_shape (test_circle.TestCircle.test_circle_instance_of_shape) ... ok
test_create_circle_negative_radius (test_circle.TestCircle.test_create_circle_negative_radius) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

Notice the ids are now `test_circle...`, without `tests.`: with `-s tests` and no `-t`, the `tests` folder itself is treated as the top level. Add `-t .` to keep the full package names (`tests.test_circle...`). Quote the pattern so that your shell does not expand `*` itself.

## Running a single module

Pass the module's dotted name:

```bash
python3 -m unittest tests.test_circle -v
```

Output:

```text
test_area (tests.test_circle.TestCircle.test_area) ... ok
test_circle_instance_of_shape (tests.test_circle.TestCircle.test_circle_instance_of_shape) ... ok
test_create_circle_negative_radius (tests.test_circle.TestCircle.test_create_circle_negative_radius) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

A file path works too, which is handy with shell tab-completion: `python3 -m unittest tests/test_circle.py -v` gives exactly the same output. `unittest` converts the path to the module name `tests.test_circle`. The file must be importable from the current directory.

## Running a single class

Add the class name:

```bash
python3 -m unittest tests.test_square.TestSquare -v
```

Output:

```text
test_area (tests.test_square.TestSquare.test_area) ... ok
test_create_square_negative_length (tests.test_square.TestSquare.test_create_square_negative_length) ... ok
test_square_instance_of_shape (tests.test_square.TestSquare.test_square_instance_of_shape) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

## Running a single test method

Add the method name:

```bash
python3 -m unittest tests.test_circle.TestCircle.test_area -v
```

Output:

```text
test_area (tests.test_circle.TestCircle.test_area) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

The general form is `package.module.Class.method`. You can list several names in one command, and they run in the given order:

```bash
python3 -m unittest tests.test_circle.TestCircle.test_area tests.test_square.TestSquare.test_area -v
```

Output:

```text
test_area (tests.test_circle.TestCircle.test_area) ... ok
test_area (tests.test_square.TestSquare.test_area) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

## Filtering by name with `-k`

`-k` (Python 3.7+) runs only the tests whose **full id** contains the given substring. The full id includes the module and class, so you can filter by any part of it:

```bash
python3 -m unittest -k negative -v
```

Output:

```text
test_create_circle_negative_radius (tests.test_circle.TestCircle.test_create_circle_negative_radius) ... ok
test_create_square_negative_length (tests.test_square.TestSquare.test_create_square_negative_length) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

More ways to use it:

- `-k TestSquare` runs all three tests of that class, because the class name is part of the id.
- A pattern containing `*` is matched as a shell-style wildcard against the whole id: `-k "*instance*"` runs the two `..._instance_of_shape` tests.
- Repeat the option to combine patterns: `-k area -k negative` runs tests that match **either** one.
- Matching is case-sensitive.

## Other useful options

| Option | What it does |
|---|---|
| `-v` / `-q` | More / less output |
| `-f`, `--failfast` | Stop at the first failure or error |
| `-b`, `--buffer` | Capture `print()` output and show it only for failing tests |
| `-c`, `--catch` | On Ctrl-C, finish the current test and print the results so far |
| `--locals` | Show local variables in tracebacks |
| `--durations N` | Python 3.12+: list the N slowest tests (`0` for all) |

`--failfast` and `--locals` are especially handy while debugging. Suppose `Circle.area()` has a bug: it returns `math.pi * self._radius * 2`. Then:

```bash
python3 -m unittest --locals tests.test_circle.TestCircle.test_area
```

Output (path shortened, the memory address varies):

```text
F
======================================================================
FAIL: test_area (tests.test_circle.TestCircle.test_area)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../tests/test_circle.py", line 19, in test_area
    self.assertAlmostEqual(circle.area(), math.pi * 2.5 * 2.5)
    ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    circle = <shapes.circle.Circle object at 0x102f65fd0>
    self = <tests.test_circle.TestCircle testMethod=test_area>
AssertionError: 15.707963267948966 != 19.634954084936208 within 7 places (3.9269908169872423 difference)

----------------------------------------------------------------------
Ran 1 test in 0.000s

FAILED (failures=1)
```

### Exit codes

The exit status tells scripts and CI systems what happened:

| Exit code | Meaning |
|---|---|
| `0` | All selected tests passed (skips and expected failures are fine) |
| `1` | At least one failure, error or unexpected success |
| `5` | No tests were found or run (Python 3.12+) |

In a shell you can see it with `echo $?` right after the command (PowerShell: `$LASTEXITCODE`).

## Common mistakes

- **Running from the wrong folder.** Inside `tests/`, `python3 -m unittest` puts `tests/` on `sys.path`, not the project root, so `shapes` cannot be imported:

  ```text
  ImportError: Failed to import test module: test_circle
  ...
  ModuleNotFoundError: No module named 'shapes'
  ```

  Always run the tests from the project root.

- **Running a test file as a script.** `python3 tests/test_circle.py` puts `tests/` (the script's folder) on `sys.path` and fails the same way. It also runs no tests unless the file calls `unittest.main()`. Prefer `python3 -m unittest tests/test_circle.py`.
- **Forgetting `tests/__init__.py`.** Discovery from the project root then reports `NO TESTS RAN`.
- **Naming the folder `test`.** It can be shadowed by the standard library's `test` package. Use `tests`.
- **Test files that do not match the pattern.** `circle_test.py` is ignored by default. Either rename it to `test_circle.py` or pass `-p "*_test.py"`.
- **Typos in dotted names.** A wrong name does not silently run nothing. It shows up as an `ERROR` with an `ImportError` or `AttributeError` from `unittest.loader._FailedTest`, often with a "Did you mean" hint.

## Summary

- Keep application code (`shapes/`) and tests (`tests/`) in separate packages, both with `__init__.py`, and run everything from the project root.
- `python -m unittest` (same as `discover`) finds `test*.py` modules in packages under the current directory. Tune it with `-s`, `-p` and `-t`.
- Run a module, class or method by dotted name: `tests.test_circle`, `tests.test_circle.TestCircle`, `tests.test_circle.TestCircle.test_area`. File paths such as `tests/test_circle.py` work too.
- `-k pattern` filters tests by a substring or wildcard of their full id.
- `-v`, `-f`, `-b`, `--locals` and `--durations` adjust output and speed up debugging.
- Exit codes: `0` success, `1` failures or errors, `5` no tests ran.

## Practice

### Exercise 1: Pick the right command

For the `shapes-project` above, write the command that:

1. runs only the tests of the `TestSquare` class;
2. runs only the tests whose names contain `instance`;
3. runs both `test_area` methods (from `TestCircle` and `TestSquare`) and nothing else, without using `-k`.

Use verbose output in all three.

### Exercise 2: "No module named 'shapes'"

A teammate opens a terminal, runs `cd tests` and then `python3 -m unittest`, and gets `ModuleNotFoundError: No module named 'shapes'` for both test modules. The tests pass for everyone else. Explain what goes wrong and give the fix.

### Exercise 3: A new shape with a non-standard file name

Add `shapes/rectangle.py` with a `Rectangle(width, height)` class that inherits from `Shape`, rejects negative sides with `ValueError` and implements `area()`. Put its tests in `tests/rectangle_test.py` (three tests: instance of `Shape`, area, negative side).

1. How many tests does `python3 -m unittest` run now, and why?
2. Write a `discover` command that runs only the rectangle tests and keeps full `tests.` ids.
3. What is the simplest change so that plain `python3 -m unittest` runs all nine tests?

## Solutions

### Exercise 1

1. A dotted name down to the class:

   ```bash
   python3 -m unittest tests.test_square.TestSquare -v
   ```

   (`python3 -m unittest -k TestSquare -v` also works.) Output:

   ```text
   test_area (tests.test_square.TestSquare.test_area) ... ok
   test_create_square_negative_length (tests.test_square.TestSquare.test_create_square_negative_length) ... ok
   test_square_instance_of_shape (tests.test_square.TestSquare.test_square_instance_of_shape) ... ok

   ----------------------------------------------------------------------
   Ran 3 tests in 0.000s

   OK
   ```

2. A `-k` filter:

   ```bash
   python3 -m unittest -k instance -v
   ```

   Output:

   ```text
   test_circle_instance_of_shape (tests.test_circle.TestCircle.test_circle_instance_of_shape) ... ok
   test_square_instance_of_shape (tests.test_square.TestSquare.test_square_instance_of_shape) ... ok

   ----------------------------------------------------------------------
   Ran 2 tests in 0.000s

   OK
   ```

3. Two dotted names in one command:

   ```bash
   python3 -m unittest tests.test_circle.TestCircle.test_area tests.test_square.TestSquare.test_area -v
   ```

   Output:

   ```text
   test_area (tests.test_circle.TestCircle.test_area) ... ok
   test_area (tests.test_square.TestSquare.test_area) ... ok

   ----------------------------------------------------------------------
   Ran 2 tests in 0.000s

   OK
   ```

### Exercise 2

`python -m` puts the **current directory** at the front of `sys.path`. Inside `tests/`, that is `tests/` itself, so Python looks for `tests/shapes/`, which does not exist. The `shapes` package is visible only from the project root. Partial output of the failing run (paths shortened):

```text
ERROR: test_circle (unittest.loader._FailedTest.test_circle)
----------------------------------------------------------------------
ImportError: Failed to import test module: test_circle
Traceback (most recent call last):
  ...
  File ".../tests/test_circle.py", line 4, in <module>
    from shapes.circle import Circle
ModuleNotFoundError: No module named 'shapes'
```

Fix: go back to the project root (`cd ..`) and run `python3 -m unittest` there. Do not "fix" it by adding `sys.path` hacks to the tests.

### Exercise 3

`shapes/rectangle.py`:

```python
from .shape import Shape


class Rectangle(Shape):
    def __init__(self, width: float, height: float) -> None:
        if width < 0 or height < 0:
            raise ValueError("The sides cannot be negative")
        self._width = width
        self._height = height

    def area(self) -> float:
        return self._width * self._height
```

`tests/rectangle_test.py`:

```python
import unittest

from shapes.rectangle import Rectangle
from shapes.shape import Shape


class TestRectangle(unittest.TestCase):
    def test_rectangle_instance_of_shape(self):
        self.assertIsInstance(Rectangle(2, 3), Shape)

    def test_area(self):
        self.assertEqual(Rectangle(2, 3).area(), 6)

    def test_negative_side(self):
        with self.assertRaises(ValueError):
            Rectangle(-2, 3)
```

1. Still **6**. `rectangle_test.py` does not match the default pattern `test*.py`, so discovery never imports it.
2. Change the pattern and keep the project root as the top level:

   ```bash
   python3 -m unittest discover -s tests -t . -p "*_test.py" -v
   ```

   Output:

   ```text
   test_area (tests.rectangle_test.TestRectangle.test_area) ... ok
   test_negative_side (tests.rectangle_test.TestRectangle.test_negative_side) ... ok
   test_rectangle_instance_of_shape (tests.rectangle_test.TestRectangle.test_rectangle_instance_of_shape) ... ok

   ----------------------------------------------------------------------
   Ran 3 tests in 0.000s

   OK
   ```

3. Rename the file to `tests/test_rectangle.py`, following the project's convention. Output of `python3 -m unittest -v`:

   ```text
   test_area (tests.test_circle.TestCircle.test_area) ... ok
   test_circle_instance_of_shape (tests.test_circle.TestCircle.test_circle_instance_of_shape) ... ok
   test_create_circle_negative_radius (tests.test_circle.TestCircle.test_create_circle_negative_radius) ... ok
   test_area (tests.test_rectangle.TestRectangle.test_area) ... ok
   test_negative_side (tests.test_rectangle.TestRectangle.test_negative_side) ... ok
   test_rectangle_instance_of_shape (tests.test_rectangle.TestRectangle.test_rectangle_instance_of_shape) ... ok
   test_area (tests.test_square.TestSquare.test_area) ... ok
   test_create_square_negative_length (tests.test_square.TestSquare.test_create_square_negative_length) ... ok
   test_square_instance_of_shape (tests.test_square.TestSquare.test_square_instance_of_shape) ... ok

   ----------------------------------------------------------------------
   Ran 9 tests in 0.000s

   OK
   ```

---

*Source: [pythontutorial.net — How to Run Unit Tests in Python](https://www.pythontutorial.net/python-unit-testing/python-run-unittest/). Adapted and expanded for PyJourney.*
