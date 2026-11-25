# patch()

Replacing a function with a mock by hand (`module.func = Mock()`) works, but you also have to remember to put the original back, or the mock leaks into other tests. `unittest.mock.patch()` does both steps for you: it **temporarily** replaces a target with a mock and **always restores** the original afterwards, even when the test fails.

## What you'll learn

- How to describe a target for `patch()` and why you patch **where a name is used**, not where it is defined
- The three ways to apply `patch()`: decorator, context manager, and manual `start()`/`stop()`
- How decorator order maps to the mock arguments
- Useful variants: `patch.object()`, `patch.dict()`, `new=`, `return_value=`, `side_effect=`, `autospec=True`
- How to fake files with `mock_open()`

## What patch() does

`patch(target)` looks up the object named by `target`, replaces it with a new `MagicMock`, and gives you that mock. When the patch ends, the original object is put back.

The **target** is a string in the form `'package.module.attribute'`:

```text
'total.read'                 # function read in module total
'shapes.circle.Circle'       # class Circle in module shapes.circle
'builtins.open'              # the built-in open()
'os.environ'                 # a dict in module os (use patch.dict for it)
```

Two rules for the target:

1. It must be **importable**. `patch()` imports everything before the last dot and then replaces the attribute after it.
2. Patch the name **where it is looked up** (used), not where it was originally defined. This rule causes more confusion than anything else, so it gets its own section below.

## The module under test

The examples use a module `total.py`:

```python
def read(filename):
    """Read a text file and return a list of numbers."""
    with open(filename) as f:
        lines = f.readlines()
        return [float(line.strip()) for line in lines]


def calculate_total(filename):
    """Return the sum of numbers in a text file."""
    numbers = read(filename)
    return sum(numbers)
```

- `read()` reads a text file, converts each line into a `float` and returns the list.
- `calculate_total()` calls `read()` and returns the sum.

For a file `numbers.txt` with the lines `1`, `2` and `3`:

```python
import total

print(total.read('numbers.txt'))
print(total.calculate_total('numbers.txt'))
```

Output:

```text
[1.0, 2.0, 3.0]
6.0
```

Note that the numbers are floats, because `read()` calls `float()`. To unit test `calculate_total()` without touching the disk, you replace `read()`.

## Without patch(): manual replacement

Here is `test_total_mock.py`, which swaps `read()` by hand:

```python
import unittest
from unittest.mock import MagicMock

import total


class TestTotal(unittest.TestCase):
    def test_calculate_total(self):
        total.read = MagicMock()
        total.read.return_value = [1, 2, 3]
        result = total.calculate_total('')
        self.assertEqual(result, 6)
```

```bash
python -m unittest test_total_mock.py -v
```

Output:

```text
test_calculate_total (test_total_mock.TestTotal.test_calculate_total) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

The test passes, but `total.read` stays a `MagicMock` for the rest of the test run. Any later test that needs the real `read()` gets the mock. `patch()` solves exactly this.

## 1) patch() as a decorator

`test_total_patch_decorator.py`:

```python
import unittest
from unittest.mock import patch

import total


class TestTotal(unittest.TestCase):
    @patch('total.read')
    def test_calculate_total(self, mock_read):
        mock_read.return_value = [1, 2, 3]
        result = total.calculate_total('')
        self.assertEqual(result, 6)
        mock_read.assert_called_once_with('')
```

How it works:

1. `@patch('total.read')` replaces `total.read` with a `MagicMock` just before the test method runs.
2. The mock is passed to the method as an **extra argument** after `self`. You can name it anything; `mock_<name>` is the usual convention.
3. Inside the method, `calculate_total()` calls the mock instead of the real `read()`, so the filename does not matter and no file is opened.
4. When the method returns (or raises), `patch()` restores the real `read()`.

```bash
python -m unittest test_total_patch_decorator -v
```

Output:

```text
test_calculate_total (test_total_patch_decorator.TestTotal.test_calculate_total) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

### Decorating a whole class

`@patch` can also decorate a `TestCase` class. It is then applied to **every method whose name starts with `test`**, and each of them receives the mock. Helper methods and `setUp()` are not patched.

```python
import unittest
from unittest.mock import patch

import total


@patch('total.read', autospec=True)
class TestTotal(unittest.TestCase):
    def test_sum(self, mock_read):
        mock_read.return_value = [1, 2, 3]
        self.assertEqual(total.calculate_total('a.txt'), 6)

    def test_empty_file(self, mock_read):
        mock_read.return_value = []
        self.assertEqual(total.calculate_total('empty.txt'), 0)

    def test_wrong_call_is_caught(self, mock_read):
        with self.assertRaises(TypeError):
            total.read('a.txt', 'extra')
```

Output of `python -m unittest test_class_patch -v`:

```text
test_empty_file (test_class_patch.TestTotal.test_empty_file) ... ok
test_sum (test_class_patch.TestTotal.test_sum) ... ok
test_wrong_call_is_caught (test_class_patch.TestTotal.test_wrong_call_is_caught) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
```

`autospec=True` builds the mock from the real `read()`, so calling it with the wrong number of arguments raises `TypeError`, just like the real function would.

### Several patches: mind the order

Decorators are applied from the bottom up, so the **bottom** decorator provides the **first** mock argument:

```python
import os
import unittest
from unittest.mock import patch


class TestOrder(unittest.TestCase):
    @patch('os.getcwd')   # outermost decorator -> last mock argument
    @patch('os.listdir')  # innermost decorator -> first mock argument
    def test_order(self, mock_listdir, mock_getcwd):
        mock_getcwd.return_value = '/home/ann'
        mock_listdir.return_value = ['notes.txt']
        self.assertEqual(os.getcwd(), '/home/ann')
        self.assertEqual(os.listdir('.'), ['notes.txt'])
```

Output of `python -m unittest test_order -v`:

```text
test_order (test_order.TestOrder.test_order) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Read the argument list from the decorator closest to the `def` upwards.

## 2) patch() as a context manager

`test_total_patch_ctx_mgr.py`:

```python
import unittest
from unittest.mock import patch

import total


class TestTotal(unittest.TestCase):
    def test_calculate_total(self):
        with patch('total.read') as mock_read:
            mock_read.return_value = [1, 2, 3]
            result = total.calculate_total('')
        self.assertEqual(result, 6)
```

`with patch(...) as mock_read:` replaces `total.read` only **inside the `with` block**. The `as` clause gives you the mock. Use this form when only part of a test should see the replacement.

```bash
python -m unittest test_total_patch_ctx_mgr -v
```

Output:

```text
test_calculate_total (test_total_patch_ctx_mgr.TestTotal.test_calculate_total) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

You can see the replacement and the restoration directly:

```python
from unittest.mock import patch

import total

print(total.read)
with patch('total.read') as mock_read:
    print(total.read is mock_read)
    print(mock_read)
print(total.read)
```

Output (addresses vary):

```text
<function read at 0x103978040>
True
<MagicMock name='read' id='4353887600'>
<function read at 0x103978040>
```

## 3) patch() with manual start() and stop()

`patch()` returns a **patcher** object. `start()` applies the patch and returns the mock, `stop()` undoes it:

```python
import unittest
from unittest.mock import patch

import total


class TestTotal(unittest.TestCase):
    def test_calculate_total(self):
        # create a patcher and start patching
        patcher = patch('total.read')
        mock_read = patcher.start()

        mock_read.return_value = [1, 2, 3]
        result = total.calculate_total('')

        # stop patching
        patcher.stop()

        self.assertEqual(result, 6)
```

Output of `python -m unittest test_total_patch_manual_inline -v`:

```text
test_calculate_total (test_total_patch_manual_inline.TestTotal.test_calculate_total) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

This works, but if anything between `start()` and `stop()` raises, `stop()` is never reached and the patch leaks. The manual form is really meant for `setUp()`, combined with `addCleanup()`:

```python
import unittest
from unittest.mock import patch

import total


class TestTotal(unittest.TestCase):
    def setUp(self):
        patcher = patch('total.read')
        self.mock_read = patcher.start()
        # stop the patcher after the test, even if the test fails
        self.addCleanup(patcher.stop)

    def test_calculate_total(self):
        self.mock_read.return_value = [1, 2, 3]
        result = total.calculate_total('')
        self.assertEqual(result, 6)
```

Output of `python -m unittest test_total_patch_manual -v`:

```text
test_calculate_total (test_total_patch_manual.TestTotal.test_calculate_total) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Every test in the class now gets a fresh mock in `self.mock_read`, and cleanups run even when a test fails or `setUp()` itself fails later on.

| Form | Scope of the patch | Typical use |
|---|---|---|
| `@patch(...)` on a method | The whole test method | The most common choice |
| `@patch(...)` on a class | Every `test*` method | All tests need the same patch |
| `with patch(...)` | The `with` block | Only part of a test, or outside tests |
| `start()` / `stop()` | Until `stop()` | In `setUp()` with `addCleanup()` |

## Where to patch: the most common trap

Consider two modules:

```python
# rates.py
def get_rate(currency):
    raise RuntimeError("calls a real exchange-rate service")
```

```python
# checkout.py
from rates import get_rate


def to_eur(amount_usd):
    return round(amount_usd * get_rate("EUR"), 2)
```

`from rates import get_rate` creates a **second name**, `checkout.get_rate`, bound to the same function object. Patching replaces a name in **one** namespace only:

```text
before patching:
  rates.get_rate     ──┐
                       ├──> function get_rate
  checkout.get_rate  ──┘

after patch('rates.get_rate'):
  rates.get_rate     ───> MagicMock
  checkout.get_rate  ───> function get_rate   <- to_eur() still uses this one
```

```python
import unittest
from unittest.mock import patch

import checkout


class TestToEur(unittest.TestCase):
    @patch('rates.get_rate')  # wrong: where get_rate is defined
    def test_wrong_target(self, mock_get_rate):
        mock_get_rate.return_value = 0.9
        self.assertEqual(checkout.to_eur(100), 90.0)

    @patch('checkout.get_rate')  # right: where get_rate is looked up
    def test_right_target(self, mock_get_rate):
        mock_get_rate.return_value = 0.9
        self.assertEqual(checkout.to_eur(100), 90.0)
        mock_get_rate.assert_called_once_with("EUR")
```

Output (paths trimmed):

```text
test_right_target (test_checkout.TestToEur.test_right_target) ... ok
test_wrong_target (test_checkout.TestToEur.test_wrong_target) ... ERROR

======================================================================
ERROR: test_wrong_target (test_checkout.TestToEur.test_wrong_target)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../unittest/mock.py", line 1432, in patched
    return func(*newargs, **newkeywargs)
  File "test_checkout.py", line 11, in test_wrong_target
    self.assertEqual(checkout.to_eur(100), 90.0)
                     ~~~~~~~~~~~~~~~^^^^^
  File "checkout.py", line 5, in to_eur
    return round(amount_usd * get_rate("EUR"), 2)
                              ~~~~~~~~^^^^^^^
  File "rates.py", line 2, in get_rate
    raise RuntimeError("calls a real exchange-rate service")
RuntimeError: calls a real exchange-rate service

----------------------------------------------------------------------
Ran 2 tests in 0.001s

FAILED (errors=1)
```

The rule of thumb:

- The code does `from rates import get_rate` → patch `'checkout.get_rate'` (the importing module).
- The code does `import rates` and calls `rates.get_rate(...)` → patch `'rates.get_rate'`, because the lookup goes through the `rates` module object at call time.

## Configuring the mock in the patch() call

`patch()` passes extra keyword arguments to the mock it creates, and it has a few options of its own:

```python
import os
from unittest.mock import patch

import total

# patch.object: the target is an object plus an attribute name
with patch.object(total, 'read', return_value=[10, 20]) as mock_read:
    print(total.calculate_total('any.txt'))
    print(mock_read.call_args)

# new=...: replace with a specific object, no mock is passed in
with patch('total.read', new=lambda filename: [1.5, 2.5]):
    print(total.calculate_total('any.txt'))

# patch.dict: temporarily change a dictionary such as os.environ
with patch.dict(os.environ, {'APP_MODE': 'test'}):
    print(os.environ['APP_MODE'])
print('APP_MODE' in os.environ)
```

Output:

```text
30
call('any.txt')
4.0
test
False
```

- `return_value=...` and `side_effect=...` configure the mock right away, which saves a line inside the test.
- `patch.object(obj, 'name')` patches an attribute of an object you already have. No import string, so no risk of a typo in the path.
- `new=obj` uses your own replacement object. When `new` is given, the decorator does **not** pass an extra argument to the test.
- `patch.dict(d, values)` adds or changes keys for the duration and then restores the dictionary exactly, removing keys that were added. Pass `clear=True` to start from an empty dict.
- `autospec=True` creates a mock with the same signature as the real object (see the class-decorator example above).

## Faking files with mock_open()

To test `read()` itself without a real file, patch the built-in `open()` with `mock_open()`:

```python
import unittest
from unittest.mock import mock_open, patch

import total


class TestRead(unittest.TestCase):
    def test_read(self):
        fake_file = mock_open(read_data='1\n2.5\n-3\n')
        with patch('builtins.open', fake_file):
            numbers = total.read('data.txt')
        self.assertEqual(numbers, [1.0, 2.5, -3.0])
        fake_file.assert_called_once_with('data.txt')
```

Output of `python -m unittest test_read -v`:

```text
test_read (test_read.TestRead.test_read) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.001s

OK
```

`mock_open()` builds a mock that behaves like `open()`: it works as a context manager and supports `read()`, `readline()`, `readlines()` and iteration over `read_data`. Built-ins live in the `builtins` module, hence the target `'builtins.open'`.

## Common mistakes

- **Patching where the object is defined** instead of where it is used. See the `rates`/`checkout` example. If the patch "does nothing", check how the code under test imports the name.
- **Mixing up the argument order** with stacked decorators. The bottom decorator gives the first argument.
- **Calling `start()` without a guaranteed `stop()`.** Use `addCleanup(patcher.stop)`, or `patch.stopall()` in a cleanup.
- **Misspelling the target.** `patch()` raises an error instead of creating a new attribute, which is good:

  ```python
  from unittest.mock import patch

  import total

  try:
      with patch('total.reed'):
          pass
  except AttributeError as error:
      print('AttributeError:', error)
  ```

  Output (path shortened):

  ```text
  AttributeError: <module 'total' from '.../total.py'> does not have the attribute 'reed'
  ```

  Pass `create=True` only if you really need to add an attribute that does not exist.
- **Patching attributes of built-in types.** Types written in C, such as `datetime.date`, do not allow setting attributes:

  ```python
  from unittest.mock import patch

  try:
      with patch('datetime.date.today'):
          pass
  except TypeError as error:
      print('TypeError:', error)
  ```

  Output:

  ```text
  TypeError: cannot set 'today' attribute of immutable type 'datetime.date'
  ```

  Patch the name `date` in **your** module instead (see Exercise 3), or pass the current date into the function as a parameter.
- **Asserting on the result inside a too-short `with` block.** Code after the block runs against the real object again. Keep the calls that need the mock inside the block.

## Summary

- `patch()` temporarily replaces a target with a `MagicMock` and always restores the original.
- The target is an importable dotted string such as `'package.module.name'`.
- Patch the name where the code under test **looks it up**: for `from x import y` in module `m`, patch `'m.y'`.
- Apply it as a method or class decorator (the mock comes in as an argument), as a context manager (`with ... as mock`), or with `start()`/`stop()` plus `addCleanup()`.
- With stacked decorators, the bottom one supplies the first mock argument.
- `return_value=`, `side_effect=`, `autospec=True`, `new=`, `patch.object()`, `patch.dict()` and `mock_open()` cover most real-world needs.

## Practice

### Exercise 1: A missing file

Using `@patch` with `side_effect`, write a test that checks that `total.calculate_total('missing.txt')` lets a `FileNotFoundError` from `read()` propagate. Also check that `read()` was called with `'missing.txt'`.

### Exercise 2: Retries without waiting

Module `downloader.py` retries a failing call with a pause:

```python
from time import sleep


def download(fetch, attempts=3, delay=2):
    for attempt in range(1, attempts + 1):
        try:
            return fetch()
        except ConnectionError:
            if attempt == attempts:
                raise
            sleep(delay)
```

Write tests that run instantly (no real `sleep`):

- `fetch` fails twice and then returns `'data'`: `download()` returns `'data'`, `fetch` is called 3 times, and `sleep(2)` is called twice.
- `fetch` always fails: `download()` raises `ConnectionError` after 3 attempts and 2 pauses.

Which target must you patch, and why?

### Exercise 3: Freeze today's date

Module `calendar_utils.py`:

```python
from datetime import date


def days_until_new_year():
    today = date.today()
    return (date(today.year + 1, 1, 1) - today).days
```

Test that the function returns `2` on 30 December 2024 and `365` on 1 January 2025. Remember that `patch('datetime.date.today')` does not work, and that the function also calls `date(...)` to create a new date.

## Solutions

### Exercise 1

```python
import unittest
from unittest.mock import patch

import total


class TestTotalErrors(unittest.TestCase):
    @patch('total.read', side_effect=FileNotFoundError('no such file'))
    def test_missing_file(self, mock_read):
        with self.assertRaises(FileNotFoundError):
            total.calculate_total('missing.txt')
        mock_read.assert_called_once_with('missing.txt')
```

Output of `python -m unittest test_total_missing -v`:

```text
test_missing_file (test_total_missing.TestTotalErrors.test_missing_file) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

### Exercise 2

`downloader.py` does `from time import sleep`, so `download()` looks up the name `sleep` in the `downloader` module. The target is therefore `'downloader.sleep'`, not `'time.sleep'`.

```python
import unittest
from unittest.mock import Mock, call, patch

from downloader import download


@patch('downloader.sleep')
class TestDownload(unittest.TestCase):
    def test_succeeds_after_retries(self, mock_sleep):
        fetch = Mock(side_effect=[ConnectionError, ConnectionError, 'data'])
        self.assertEqual(download(fetch), 'data')
        self.assertEqual(fetch.call_count, 3)
        mock_sleep.assert_has_calls([call(2), call(2)])

    def test_gives_up(self, mock_sleep):
        fetch = Mock(side_effect=ConnectionError)
        with self.assertRaises(ConnectionError):
            download(fetch, attempts=3)
        self.assertEqual(fetch.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
```

Output of `python -m unittest test_downloader -v`:

```text
test_gives_up (test_downloader.TestDownload.test_gives_up) ... ok
test_succeeds_after_retries (test_downloader.TestDownload.test_succeeds_after_retries) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.001s

OK
```

Without the patch the two tests would sleep for 8 seconds in total. With it they finish in about a millisecond (timings vary).

### Exercise 3

Patch the name `date` inside `calendar_utils`. The mock's `today()` returns a fixed real date, and its `side_effect` forwards constructor calls such as `date(2025, 1, 1)` to the real class:

```python
import unittest
from datetime import date
from unittest.mock import patch

import calendar_utils


class TestDaysUntilNewYear(unittest.TestCase):
    @patch('calendar_utils.date')
    def test_december_30(self, mock_date):
        mock_date.today.return_value = date(2024, 12, 30)
        # calls like date(2025, 1, 1) must still build real dates
        mock_date.side_effect = lambda *args, **kwargs: date(*args, **kwargs)
        self.assertEqual(calendar_utils.days_until_new_year(), 2)

    @patch('calendar_utils.date')
    def test_january_1(self, mock_date):
        mock_date.today.return_value = date(2025, 1, 1)
        mock_date.side_effect = lambda *args, **kwargs: date(*args, **kwargs)
        self.assertEqual(calendar_utils.days_until_new_year(), 365)
```

Output of `python -m unittest test_calendar_utils -v`:

```text
test_december_30 (test_calendar_utils.TestDaysUntilNewYear.test_december_30) ... ok
test_january_1 (test_calendar_utils.TestDaysUntilNewYear.test_january_1) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.001s

OK
```

Without the `side_effect`, `date(today.year + 1, 1, 1)` would return a `MagicMock`, and the subtraction would not produce a real number of days. An often simpler design is `days_until_new_year(today=None)`, where the test passes the date directly and nothing needs patching.

---

*Source: [pythontutorial.net — Python patch](https://www.pythontutorial.net/python-unit-testing/python-patch/). Adapted and expanded for PyJourney.*
