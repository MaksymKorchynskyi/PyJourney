# Skipping Tests

Not every test can or should run everywhere. A test may need Windows, a newer Python, an optional library, or an API key that only the CI server has. Instead of commenting such tests out, `unittest` lets you **skip** them: the test stays in the code, the report shows that it was skipped and why, and the run still counts as successful.

## What you'll learn

- Three ways to skip a test: `@unittest.skip()`, `self.skipTest()` and `raise unittest.SkipTest`
- How to skip a whole class or a whole module
- How to skip conditionally with `@unittest.skipIf()` and `@unittest.skipUnless()`
- When to decide at import time and when at run time
- How `@unittest.expectedFailure` marks a known bug, and what an "unexpected success" is
- How skipped tests look in the output and how they interact with `setUp()` and `tearDown()`

## Why skip instead of deleting or commenting out

A commented-out test is invisible: nobody sees it in the report, and it quietly rots. A skipped test:

- is still collected and listed, with a **reason** you wrote;
- shows up in the summary as `skipped=N`, so the team knows coverage is incomplete;
- starts running again automatically once its condition no longer applies (for example, after you install the missing library).

A skip never makes a run fail. `OK (skipped=1)` exits with status `0`.

## Three ways to skip a test

### The `@unittest.skip()` decorator

The decorator skips a test unconditionally. The argument is the reason shown in the report:

```python
import unittest


class TestDemo(unittest.TestCase):
    def test_case_1(self):
        self.assertEqual(1 + 1, 2)

    @unittest.skip("Work in progress")
    def test_case_2(self):
        self.assertEqual(2 * 2, 5)
```

Run (the file is `test_skipping.py`):

```bash
python3 -m unittest -v
```

Output (the time varies):

```text
test_case_1 (test_skipping.TestDemo.test_case_1) ... ok
test_case_2 (test_skipping.TestDemo.test_case_2) ... skipped 'Work in progress'

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=1)
```

`test_case_2` contains a wrong assertion, but its body never runs. Without `-v`, a skipped test is shown as `s`:

```text
.s
----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=1)
```

Note that "Ran 2 tests" includes the skipped one: it was collected and processed, just not executed.

### The `skipTest()` method

`self.skipTest(reason)` skips the current test **from inside**, at run time. Nothing after the call is executed:

```python
import unittest


class TestDemo(unittest.TestCase):
    def test_case_1(self):
        self.assertEqual(1 + 1, 2)

    def test_case_2(self):
        self.skipTest("Work in progress")
        self.assertEqual(2 * 2, 5)
```

Output of `python3 -m unittest -v`:

```text
test_case_1 (test_skipping.TestDemo.test_case_1) ... ok
test_case_2 (test_skipping.TestDemo.test_case_2) ... skipped 'Work in progress'

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=1)
```

Use it when the decision depends on something you only know while the test is running, such as whether a server answered or a file was found.

### Raising `unittest.SkipTest`

`skipTest()` works by raising the exception `unittest.SkipTest`. You can raise it yourself:

```python
import unittest


class TestDemo(unittest.TestCase):
    def test_case_1(self):
        self.assertEqual(1 + 1, 2)

    def test_case_2(self):
        raise unittest.SkipTest("Work in progress")
```

Output of `python3 -m unittest -v`:

```text
test_case_1 (test_skipping.TestDemo.test_case_1) ... ok
test_case_2 (test_skipping.TestDemo.test_case_2) ... skipped 'Work in progress'

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=1)
```

Inside a test method, `self.skipTest()` reads better. Raising `SkipTest` directly is useful where there is no `self`: in `setUpClass()`, in `setUpModule()`, at module level, or in a helper function shared by several test classes.

## Skipping a whole class

Put the decorator on the class, and every test in it is skipped:

```python
import unittest


@unittest.skip("Work in progress")
class TestDemo(unittest.TestCase):
    def test_case_1(self):
        self.assertEqual(1 + 1, 2)

    def test_case_2(self):
        self.assertIsNotNone([])
```

Output of `python3 -m unittest -v`:

```text
test_case_1 (test_skipping.TestDemo.test_case_1) ... skipped 'Work in progress'
test_case_2 (test_skipping.TestDemo.test_case_2) ... skipped 'Work in progress'

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=2)
```

To skip a class based on a runtime check, raise `SkipTest` in `setUpClass()`. The class-level setup is then reported as one skipped item, and none of the class's tests run:

```python
import os
import unittest


class TestApi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.token = os.environ.get("API_TOKEN")
        if cls.token is None:
            raise unittest.SkipTest("API_TOKEN is not set")

    def test_token_format(self):
        self.assertTrue(self.token.startswith("tok_"))

    def test_token_length(self):
        self.assertGreater(len(self.token), 4)
```

Output of `python3 -m unittest -v` without the variable:

```text
setUpClass (test_runtime.TestApi) ... skipped 'API_TOKEN is not set'

----------------------------------------------------------------------
Ran 0 tests in 0.000s

OK (skipped=1)
```

With the variable set (`API_TOKEN=tok_12345 python3 -m unittest -v` on macOS/Linux):

```text
test_token_format (test_runtime.TestApi.test_token_format) ... ok
test_token_length (test_runtime.TestApi.test_token_length) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

## Skipping a whole module

Raising `SkipTest` at the top level of a test module skips everything in it. This is the usual way to handle an optional dependency:

```python
import unittest

try:
    import yaml
except ImportError:
    raise unittest.SkipTest("PyYAML is not installed")


class TestYamlConfig(unittest.TestCase):
    def test_load_mapping(self):
        self.assertEqual(yaml.safe_load("port: 8080"), {"port": 8080})

    def test_load_list(self):
        self.assertEqual(yaml.safe_load("- a\n- b"), ["a", "b"])
```

Output of `python3 -m unittest -v` in an environment without PyYAML:

```text
test_yaml_config (unittest.loader.ModuleSkipped.test_yaml_config) ... skipped 'PyYAML is not installed'

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK (skipped=1)
```

The loader replaces the whole module with a single placeholder test called `ModuleSkipped`. With PyYAML installed, both tests run normally.

## Skipping with a condition

Often a test makes sense only in some environments. Two decorators take a condition and a reason:

```text
@unittest.skipIf(condition, reason)      # skip when the condition is true
@unittest.skipUnless(condition, reason)  # skip unless the condition is true
```

`skipUnless(c, r)` is the same as `skipIf(not c, r)`. Pick whichever reads more naturally: "skip if Windows", "skip unless numpy is installed".

```python
import importlib.util
import sys
import unittest

HAS_NUMPY = importlib.util.find_spec("numpy") is not None


class TestConditions(unittest.TestCase):
    @unittest.skipIf(sys.platform.startswith("win"), "Do not run on Windows")
    def test_posix_paths(self):
        self.assertEqual("/usr/bin".split("/"), ["", "usr", "bin"])

    @unittest.skipUnless(sys.platform.startswith("win"), "Requires Windows")
    def test_windows_drive(self):
        self.assertTrue("C:\\".endswith("\\"))

    @unittest.skipIf(sys.version_info < (3, 12), "Needs Python 3.12+")
    def test_batched(self):
        from itertools import batched
        self.assertEqual(list(batched("abcde", 2)), [("a", "b"), ("c", "d"), ("e",)])

    @unittest.skipUnless(HAS_NUMPY, "numpy is not installed")
    def test_numpy_sum(self):
        import numpy as np
        self.assertEqual(np.arange(4).sum(), 6)
```

Output of `python3 -m unittest -v` on macOS with Python 3.14 and without numpy:

```text
test_batched (test_conditions.TestConditions.test_batched) ... ok
test_numpy_sum (test_conditions.TestConditions.test_numpy_sum) ... skipped 'numpy is not installed'
test_posix_paths (test_conditions.TestConditions.test_posix_paths) ... ok
test_windows_drive (test_conditions.TestConditions.test_windows_drive) ... skipped 'Requires Windows'

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK (skipped=2)
```

On Windows, `test_posix_paths` would be skipped and `test_windows_drive` would run. With numpy installed, `test_numpy_sum` runs too.

Useful conditions:

- `sys.platform`: `"win32"`, `"darwin"` (macOS), `"linux"`. `sys.platform.startswith("win")` is a common Windows check.
- `sys.version_info`: compare it with a tuple, for example `sys.version_info >= (3, 12)`.
- `importlib.util.find_spec("name") is not None`: is a module installed, without importing it.
- `shutil.which("git") is not None`: is a command-line tool available.
- `os.environ.get("NAME")`: is an environment variable set.

> **Note:** The condition of `skipIf()`/`skipUnless()` is evaluated **once, when the module is imported** and the class body runs. It cannot see anything that happens later, for example a file created in `setUpClass()`. For decisions that depend on run-time state, call `self.skipTest()` inside the test or `setUp()`.

## Skipping inside a subtest

Called inside `with self.subTest(...)`, `skipTest()` skips only that subtest. The loop continues with the next value:

```python
import unittest


class TestSquares(unittest.TestCase):
    def test_square_roots(self):
        for n in (4, -1, 9):
            with self.subTest(n=n):
                if n < 0:
                    self.skipTest("negative numbers have no real square root")
                self.assertEqual((n ** 0.5) ** 2, n)
```

Output of `python3 -m unittest test_subtests -v`:

```text
test_square_roots (test_subtests.TestSquares.test_square_roots) ...
  test_square_roots (test_subtests.TestSquares.test_square_roots) (n=-1) ... skipped 'negative numbers have no real square root'

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK (skipped=1)
```

The values `4` and `9` were still checked. Only the `n=-1` subtest was skipped.

## Skips and fixtures

When a test is skipped matters for its fixtures:

```python
import unittest


class TestSetupSkip(unittest.TestCase):
    def setUp(self):
        print("setUp")

    def tearDown(self):
        print("tearDown")

    @unittest.skip("decorated")
    def test_decorated(self):
        print("body 1")

    def test_runtime(self):
        print("body 2")
        self.skipTest("at runtime")
        print("never printed")
```

Output of `python3 -m unittest test_setup_skip -v` in a terminal:

```text
test_decorated (test_setup_skip.TestSetupSkip.test_decorated) ... skipped 'decorated'
test_runtime (test_setup_skip.TestSetupSkip.test_runtime) ... setUp
body 2
skipped 'at runtime'
tearDown

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=2)
```

- A test skipped by a **decorator** is never started: no `setUp()`, no `tearDown()`.
- A test skipped by **`skipTest()`** has already run `setUp()`, so `tearDown()` (and any cleanups) still run afterwards. Resources are released properly.

## Expected failures

Sometimes you know about a bug but cannot fix it yet. Instead of skipping the test, mark it with `@unittest.expectedFailure`. The test **runs**, and a failure is reported as `expected failure`, not as an error:

```python
import unittest


def average(numbers):
    return sum(numbers) / len(numbers)


class TestAverage(unittest.TestCase):
    def test_average(self):
        self.assertEqual(average([2, 4, 6]), 4)

    @unittest.expectedFailure
    def test_average_of_empty_list(self):
        # known bug: should return 0 instead of raising ZeroDivisionError
        self.assertEqual(average([]), 0)
```

Output of `python3 -m unittest -v`:

```text
test_average (test_expected.TestAverage.test_average) ... ok
test_average_of_empty_list (test_expected.TestAverage.test_average_of_empty_list) ... expected failure

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (expected failures=1)
```

In the short format the symbol is `x`. The advantage over `skip` is that the test keeps watching the bug. Once someone fixes `average()`, the test passes, and that **unexpected success** makes the run fail, reminding you to remove the decorator:

```python
import unittest


def average(numbers):
    if not numbers:
        return 0
    return sum(numbers) / len(numbers)


class TestAverage(unittest.TestCase):
    @unittest.expectedFailure
    def test_average_of_empty_list(self):
        self.assertEqual(average([]), 0)
```

Output of `python3 -m unittest test_unexpected -v` (exit status `1`):

```text
test_average_of_empty_list (test_unexpected.TestAverage.test_average_of_empty_list) ... unexpected success

======================================================================
UNEXPECTED SUCCESS: test_average_of_empty_list (test_unexpected.TestAverage.test_average_of_empty_list)
----------------------------------------------------------------------
Ran 1 test in 0.000s

FAILED (unexpected successes=1)
```

## Common mistakes

- **Using `return` instead of `skipTest()`.** An early `return` makes the test pass without checking anything, and the report lies:

  ```python
  import shutil
  import unittest


  class TestGit(unittest.TestCase):
      def test_git_version_bad(self):
          if shutil.which("nonexistent-tool") is None:
              return
          self.fail("unreachable here")

      def test_git_version_good(self):
          if shutil.which("nonexistent-tool") is None:
              self.skipTest("nonexistent-tool is not installed")
          self.fail("unreachable here")
  ```

  Output of `python3 -m unittest test_early_return -v` (summary lines omitted):

  ```text
  test_git_version_bad (test_early_return.TestGit.test_git_version_bad) ... ok
  test_git_version_good (test_early_return.TestGit.test_git_version_good) ... skipped 'nonexistent-tool is not installed'
  ```

- **Skipping without a reason.** Bare `@unittest.skip` is accepted, but the report then shows `skipped ''`, and nobody remembers why. Always say why, and ideally when the skip can be removed.
- **Expecting `skipIf()` to see run-time state.** Its condition is evaluated at import time. Use `self.skipTest()` for anything decided later.
- **Forgetting about skipped tests.** A test skipped "for now" can stay skipped for years. Review `skipped=N` in reports, and prefer `expectedFailure` for known bugs, because it alerts you when the bug is fixed.
- **Skipping to hide a flaky or failing test.** A skip should describe an *environment* limitation, not cover up a real failure. Fix the test or the code instead.

## Summary

- Skipped tests stay in the code and in the report (`s`, `skipped 'reason'`, `OK (skipped=N)`), and do not fail the run.
- Skip unconditionally with `@unittest.skip(reason)`. Skip at run time with `self.skipTest(reason)` or `raise unittest.SkipTest(reason)`.
- Decorate a class to skip all its tests. Raise `SkipTest` in `setUpClass()` or at module level to skip a class or a module based on a check.
- `@unittest.skipIf(cond, reason)` skips when `cond` is true, `@unittest.skipUnless(cond, reason)` when it is false. Conditions are evaluated at import time.
- Decorator-skipped tests do not run `setUp()`/`tearDown()`. Tests skipped with `skipTest()` still get their `tearDown()` and cleanups.
- `@unittest.expectedFailure` runs a test that is known to fail. An unexpected success makes the run fail, so you notice when the bug is fixed.

## Practice

### Exercise 1: Opt-in slow tests

Write `test_reports.py` with two tests: a quick one, and a slow one (simulate it with `time.sleep(1)`) that runs only when the environment variable `RUN_SLOW` equals `"1"`. Show the output with and without the variable.

### Exercise 2: Predict the summary

Without running it, predict the short output (`python3 -m unittest test_summary`) and the summary line for this module:

```python
import unittest


class TestSummary(unittest.TestCase):
    @unittest.skip("not ready")
    def test_a(self):
        self.assertEqual(1, 2)

    @unittest.skipIf(True, "condition is true")
    def test_b(self):
        pass

    @unittest.skipUnless(True, "condition is true")
    def test_c(self):
        pass

    @unittest.expectedFailure
    def test_d(self):
        self.assertEqual(1, 2)

    def test_e(self):
        self.skipTest("decided at runtime")
```

### Exercise 3: Platform-specific tests

`endings.py` contains:

```python
import os


def line_ending():
    return os.linesep
```

On Windows, `os.linesep` is `"\r\n"`, elsewhere it is `"\n"`. Write two tests: one that checks `"\r\n"` and runs only on Windows, and one that checks `"\n"` and runs everywhere except Windows.

## Solutions

### Exercise 1

```python
import os
import time
import unittest

RUN_SLOW = os.environ.get("RUN_SLOW") == "1"


class TestReports(unittest.TestCase):
    def test_quick(self):
        self.assertEqual(sum(range(10)), 45)

    @unittest.skipUnless(RUN_SLOW, "set RUN_SLOW=1 to run slow tests")
    def test_full_year_report(self):
        time.sleep(1)  # pretend this is a slow computation
        self.assertEqual(sum(range(1_000_000)), 499_999_500_000)
```

Output of `python3 -m unittest -v`:

```text
test_full_year_report (test_reports.TestReports.test_full_year_report) ... skipped 'set RUN_SLOW=1 to run slow tests'
test_quick (test_reports.TestReports.test_quick) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=1)
```

Output of `RUN_SLOW=1 python3 -m unittest -v` (on Windows PowerShell: `$env:RUN_SLOW = "1"` first). The time is about one second and varies:

```text
test_full_year_report (test_reports.TestReports.test_full_year_report) ... ok
test_quick (test_reports.TestReports.test_quick) ... ok

----------------------------------------------------------------------
Ran 2 tests in 1.014s

OK
```

`RUN_SLOW` is computed once at import time, which is fine here because the environment does not change during the run.

### Exercise 2

```text
ss.xs
----------------------------------------------------------------------
Ran 5 tests in 0.000s

OK (skipped=3, expected failures=1)
```

- `test_a`: `s`, skipped by the decorator. The wrong assertion never runs.
- `test_b`: `s`, the condition is `True`, so `skipIf` skips.
- `test_c`: `.`, the condition is `True`, so `skipUnless` does **not** skip, and the empty test passes.
- `test_d`: `x`, it fails as expected.
- `test_e`: `s`, skipped at run time.

The exit status is `0`: skips and expected failures do not fail a run.

### Exercise 3

```python
import sys
import unittest

from endings import line_ending

IS_WINDOWS = sys.platform == "win32"


class TestLineEnding(unittest.TestCase):
    @unittest.skipUnless(IS_WINDOWS, "Windows-only behaviour")
    def test_windows_uses_crlf(self):
        self.assertEqual(line_ending(), "\r\n")

    @unittest.skipIf(IS_WINDOWS, "POSIX-only behaviour")
    def test_posix_uses_lf(self):
        self.assertEqual(line_ending(), "\n")
```

Output of `python3 -m unittest -v` on macOS or Linux:

```text
test_posix_uses_lf (test_endings.TestLineEnding.test_posix_uses_lf) ... ok
test_windows_uses_crlf (test_endings.TestLineEnding.test_windows_uses_crlf) ... skipped 'Windows-only behaviour'

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK (skipped=1)
```

On Windows the roles swap: `test_windows_uses_crlf` runs and `test_posix_uses_lf` is skipped with `'POSIX-only behaviour'`.

---

*Source: [pythontutorial.net — Python unittest Skip Test](https://www.pythontutorial.net/python-unit-testing/python-unittest-skip-test/). Adapted and expanded for PyJourney.*
