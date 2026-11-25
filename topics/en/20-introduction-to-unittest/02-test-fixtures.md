# Test Fixtures

Most tests need some preparation: an object in a known state, a temporary folder, a database connection. A **test fixture** is that preparation plus the cleanup afterwards. `unittest` lets you write it once, in special methods that run automatically around your tests, so every test starts from a clean, predictable state and leaves nothing behind.

## What you'll learn

- What a test fixture is and why fixtures keep tests independent
- How `setUp()` and `tearDown()` run around **every** test method
- How `setUpClass()`/`tearDownClass()` and `setUpModule()`/`tearDownModule()` share expensive setup
- The exact order in which all fixture methods run, including when a test fails
- How `addCleanup()` and `enterContext()` make cleanup reliable even when setup fails halfway
- The typos and design mistakes that silently break fixtures

## What a test fixture is

In the `unittest` documentation, a test fixture is "the preparation needed to perform one or more tests, and any associated cleanup actions". In practice it is code that runs **before** a test (create objects, files, connections) and **after** it (delete files, close connections, undo changes).

Fixtures solve two problems:

- **Duplication.** Without them, every test repeats the same setup lines.
- **Isolation.** A fixture that is rebuilt for each test guarantees that one test cannot leak state into the next.

`unittest` offers fixtures at three levels:

| Level | Before | After | Runs |
|---|---|---|---|
| Method | `setUp(self)` | `tearDown(self)` | around **each** test method |
| Class | `setUpClass(cls)` | `tearDownClass(cls)` | once per test class |
| Module | `setUpModule()` | `tearDownModule()` | once per test module |

The method-level hooks are ordinary methods, the class-level ones must be **class methods**, and the module-level ones are plain **functions** in the test file. The names are fixed, including the capital `U` in `setUp`.

## The order of execution

This test module, `test_my_module.py`, defines all six hooks and prints a line from each:

```python
import unittest


def setUpModule():
    print("Running setUpModule")


def tearDownModule():
    print("Running tearDownModule")


class TestMyModule(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("Running setUpClass")

    @classmethod
    def tearDownClass(cls):
        print("Running tearDownClass")

    def setUp(self):
        print("Running setUp")

    def tearDown(self):
        print("Running tearDown")

    def test_case_1(self):
        print("Running test_case_1")
        self.assertEqual(5 + 5, 10)

    def test_case_2(self):
        print("Running test_case_2")
        self.assertEqual(1 + 1, 2)
```

Run it in a terminal:

```bash
python3 -m unittest -v
```

Output (timing varies):

```text
Running setUpModule
Running setUpClass
test_case_1 (test_my_module.TestMyModule.test_case_1) ... Running setUp
Running test_case_1
Running tearDown
ok
test_case_2 (test_my_module.TestMyModule.test_case_2) ... Running setUp
Running test_case_2
Running tearDown
ok
Running tearDownClass
Running tearDownModule

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

The runner prints `test_case_1 (...) ...` *before* starting the test and `ok` *after* it, so the lines printed by the fixtures land in between. As a picture:

```text
setUpModule
  setUpClass
    setUp -> test_case_1 -> tearDown
    setUp -> test_case_2 -> tearDown
  tearDownClass
tearDownModule
```

> **Note:** The runner writes its report to *stderr*, while `print()` writes to *stdout*. In a terminal they interleave as shown. If you redirect the output to a file or a pipe, stdout is buffered and the `Running ...` lines may come out in a different place. To hide the output of passing tests, run with `-b` (buffer). In a terminal, Python 3.14 also colours `ok`, `FAIL` and `OK`.

## Method-level fixtures: `setUp()` and `tearDown()`

### Removing duplication

Here is a small bank account class in `bank_account.py`:

```python
class InsufficientFunds(Exception):
    pass


class BankAccount:
    def __init__(self, balance: float) -> None:
        if balance < 0:
            raise ValueError("Balance cannot be negative")
        self._balance = balance

    @property
    def balance(self) -> float:
        return self._balance

    def deposit(self, amount: float) -> None:
        if amount <= 0:
            raise ValueError("The amount must be positive")
        self._balance += amount

    def withdraw(self, amount: float) -> None:
        if amount <= 0:
            raise ValueError("The withdrawal amount must be positive")
        if amount > self._balance:
            raise InsufficientFunds("Insufficient funds for withdrawal")
        self._balance -= amount
```

A first version of the tests creates the same account in every test:

```python
import unittest

from bank_account import BankAccount


class TestBankAccount(unittest.TestCase):
    def test_deposit(self):
        account = BankAccount(100)
        account.deposit(100)
        self.assertEqual(account.balance, 200)

    def test_withdraw(self):
        account = BankAccount(100)
        account.withdraw(50)
        self.assertEqual(account.balance, 50)
```

With two tests the repetition is tolerable. With twenty, changing the starting balance means editing twenty places. Move the common setup into `setUp()` and store the object on `self`:

```python
import unittest

from bank_account import BankAccount, InsufficientFunds


class TestBankAccount(unittest.TestCase):
    def setUp(self):
        self.account = BankAccount(100)

    def test_deposit(self):
        self.account.deposit(100)
        self.assertEqual(self.account.balance, 200)

    def test_withdraw(self):
        self.account.withdraw(50)
        self.assertEqual(self.account.balance, 50)

    def test_withdraw_too_much(self):
        with self.assertRaises(InsufficientFunds):
            self.account.withdraw(150)
        self.assertEqual(self.account.balance, 100)
```

Output of `python3 -m unittest -v`:

```text
test_deposit (test_bank_account.TestBankAccount.test_deposit) ... ok
test_withdraw (test_bank_account.TestBankAccount.test_withdraw) ... ok
test_withdraw_too_much (test_bank_account.TestBankAccount.test_withdraw_too_much) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

`test_deposit()` raises the balance to 200, yet `test_withdraw()` and `test_withdraw_too_much()` still see 100. For each test the runner effectively does this:

```text
setUp()  ->  test_deposit()            account starts at 100
setUp()  ->  test_withdraw()           a brand-new account, again 100
setUp()  ->  test_withdraw_too_much()  a brand-new account, again 100
```

### Every test gets a fresh instance

Isolation goes further than re-running `setUp()`. `unittest` creates a **separate instance of the test class for every test method**, so attributes set in one test never reach another:

```python
import unittest


class TestFreshInstance(unittest.TestCase):
    def setUp(self):
        self.items = []

    def test_first(self):
        self.items.append("first")
        self.assertEqual(self.items, ["first"])

    def test_second(self):
        self.items.append("second")
        self.assertEqual(self.items, ["second"])
```

Output of `python3 -m unittest test_fresh -v`:

```text
test_first (test_fresh.TestFreshInstance.test_first) ... ok
test_second (test_fresh.TestFreshInstance.test_second) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Both tests pass because each one gets its own empty list. The section "Common mistakes" shows what happens when the list is a class attribute instead.

### `tearDown()` for real resources

`tearDown()` runs after each test, **whether the test passed, failed or raised an error**, as long as `setUp()` itself finished successfully. Use it to release things that the garbage collector cannot clean up for you: files, folders, network connections, changed environment variables.

```python
from pathlib import Path


def save_report(folder, name, lines):
    path = Path(folder) / name
    path.write_text("\n".join(lines), encoding="utf-8")
    return path
```

The tests write into a temporary directory that is deleted after each test:

```python
import tempfile
import unittest
from pathlib import Path

from reports import save_report


class TestSaveReport(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.folder = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_creates_file(self):
        path = save_report(self.folder, "sales.txt", ["jan", "feb"])
        self.assertTrue(path.exists())

    def test_writes_lines(self):
        path = save_report(self.folder, "sales.txt", ["jan", "feb"])
        self.assertEqual(path.read_text(encoding="utf-8"), "jan\nfeb")
```

Output of `python3 -m unittest -v`:

```text
test_creates_file (test_reports.TestSaveReport.test_creates_file) ... ok
test_writes_lines (test_reports.TestSaveReport.test_writes_lines) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.001s

OK
```

> **Tip:** You do not need `tearDown()` for plain in-memory objects. Writing `self.account = None` in `tearDown()` achieves nothing useful: the test instance is discarded after the run, and the garbage collector reclaims the account. Keep `tearDown()` for external resources.

## Cleanups: `addCleanup()` and `enterContext()`

`tearDown()` has a weak spot: it is **not called if `setUp()` raises**. If `setUp()` opened two resources and failed on the third, the first two leak. The fix is to register each cleanup right after creating the resource with `self.addCleanup(function, *args, **kwargs)`. Registered cleanups:

- run after `tearDown()`, or after a failed `setUp()`;
- run in **reverse order** of registration (last in, first out), like nested `with` blocks;
- run even if the test fails or an earlier cleanup raises.

```python
import unittest


class TestCleanupOrder(unittest.TestCase):
    def setUp(self):
        print("open resource A")
        self.addCleanup(print, "close resource A")
        print("open resource B")
        self.addCleanup(print, "close resource B")
        raise RuntimeError("resource C is unavailable")

    def tearDown(self):
        print("tearDown")

    def test_something(self):
        print("test body")
```

Output of `python3 -m unittest test_cleanup_order -v` (path shortened):

```text
test_something (test_cleanup_order.TestCleanupOrder.test_something) ... open resource A
open resource B
ERROR
close resource B
close resource A

======================================================================
ERROR: test_something (test_cleanup_order.TestCleanupOrder.test_something)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_cleanup_order.py", line 10, in setUp
    raise RuntimeError("resource C is unavailable")
RuntimeError: resource C is unavailable

----------------------------------------------------------------------
Ran 1 test in 0.000s

FAILED (errors=1)
```

Neither `test body` nor `tearDown` was printed, but both registered cleanups ran, B before A.

Many resources are context managers (`with` objects). Since **Python 3.11**, `self.enterContext(cm)` enters a context manager, returns what its `__enter__()` returns, and registers its exit as a cleanup. The temporary-directory fixture shrinks to one line, with no `tearDown()` at all:

```python
import tempfile
import unittest
from pathlib import Path

from reports import save_report


class TestSaveReport(unittest.TestCase):
    def setUp(self):
        # Python 3.11+: enter the context manager now, exit it after the test
        self.folder = Path(self.enterContext(tempfile.TemporaryDirectory()))

    def test_creates_file(self):
        path = save_report(self.folder, "sales.txt", ["jan", "feb"])
        self.assertTrue(path.exists())

    def test_writes_lines(self):
        path = save_report(self.folder, "sales.txt", ["jan", "feb"])
        self.assertEqual(path.read_text(encoding="utf-8"), "jan\nfeb")
```

Output of `python3 -m unittest test_reports_cleanup -v`:

```text
test_creates_file (test_reports_cleanup.TestSaveReport.test_creates_file) ... ok
test_writes_lines (test_reports_cleanup.TestSaveReport.test_writes_lines) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.001s

OK
```

The same idea exists for the other levels: `addClassCleanup()` and `enterClassContext()` for class fixtures, `unittest.addModuleCleanup()` and `unittest.enterModuleContext()` for module fixtures (the `enter...Context` variants since Python 3.11).

## Class-level fixtures: `setUpClass()` and `tearDownClass()`

Some setup is too slow to repeat for every test: starting a server, loading a large data file, opening a database. `setUpClass()` runs **once before all tests of the class**, and `tearDownClass()` runs once after them. Both receive the class (`cls`), so they must be decorated with `@classmethod`, and whatever they store becomes a **class attribute** shared by all tests.

Shared state is dangerous, because one test could change it and break the next. A common pattern combines both levels: the expensive resource lives at class level, and `setUp()`/`tearDown()` reset the cheap per-test state.

```python
import sqlite3
import unittest


class TestUsersTable(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # one connection and one table for all tests in the class
        cls.conn = sqlite3.connect(":memory:")
        cls.conn.execute("CREATE TABLE users (name TEXT UNIQUE)")

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        self.conn.execute("INSERT INTO users VALUES ('olena')")

    def tearDown(self):
        # undo everything the test changed, so the next test starts clean
        self.conn.rollback()

    def test_count(self):
        (count,) = self.conn.execute("SELECT COUNT(*) FROM users").fetchone()
        self.assertEqual(count, 1)

    def test_duplicate_name(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute("INSERT INTO users VALUES ('olena')")

    def test_add_second_user(self):
        self.conn.execute("INSERT INTO users VALUES ('taras')")
        (count,) = self.conn.execute("SELECT COUNT(*) FROM users").fetchone()
        self.assertEqual(count, 2)
```

Output of `python3 -m unittest -v`:

```text
test_add_second_user (test_users.TestUsersTable.test_add_second_user) ... ok
test_count (test_users.TestUsersTable.test_count) ... ok
test_duplicate_name (test_users.TestUsersTable.test_duplicate_name) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.002s

OK
```

`test_add_second_user` runs first (alphabetical order) and leaves two rows behind, yet `test_count` still sees exactly one. The `rollback()` in `tearDown()` undid the uncommitted inserts. Through `self.conn` each test reads the shared class attribute.

If `setUpClass()` raises, none of the tests in the class run, and the report shows a single error named `setUpClass (module.ClassName)`. `tearDownClass()` is then skipped too, so register class-level cleanups with `cls.addClassCleanup()` if partial setup is possible.

## Module-level fixtures: `setUpModule()` and `tearDownModule()`

`setUpModule()` and `tearDownModule()` are plain functions defined at the top level of a test module. They run once, before the first test of the module and after the last one, across **all** test classes in that file:

```python
import unittest


def setUpModule():
    print("Running setUpModule")


def tearDownModule():
    print("Running tearDownModule")


class TestMyModule(unittest.TestCase):
    def test_case_1(self):
        self.assertEqual(5 + 5, 10)

    def test_case_2(self):
        self.assertEqual(1 + 1, 2)
```

Output of `python3 -m unittest -v` in a terminal:

```text
Running setUpModule
test_case_1 (test_my_module.TestMyModule.test_case_1) ... ok
test_case_2 (test_my_module.TestMyModule.test_case_2) ... ok
Running tearDownModule

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Typical uses are global configuration that many classes need, such as setting an environment variable or starting one shared test server. Use them sparingly. The wider a fixture's scope, the more tests depend on it, and the harder it is to run one test on its own.

## Common mistakes

- **Wrong capitalisation.** `def setup(self)` or `def teardown(self)` is just an ordinary method that nobody calls. The tests then crash with confusing errors:

  ```text
  AttributeError: 'TestCounter' object has no attribute 'counter'
  ```

  The names are `setUp`, `tearDown`, `setUpClass`, `tearDownClass`, `setUpModule`, `tearDownModule`.

- **Forgetting `@classmethod`.** Without it, `setUpClass(cls)` cannot be called on the class, no test in the class runs, and you get:

  ```text
  ERROR: setUpClass (test_noclassmethod.TestNoClassmethod)
  ----------------------------------------------------------------------
  TypeError: TestNoClassmethod.setUpClass() missing 1 required positional argument: 'cls'
  ```

- **Mutable class attributes as fixtures.** A list defined in the class body is shared by every test:

  ```python
  import unittest


  class TestSharedList(unittest.TestCase):
      items = []

      def test_first(self):
          self.items.append("first")
          self.assertEqual(self.items, ["first"])

      def test_second(self):
          self.items.append("second")
          self.assertEqual(self.items, ["second"])
  ```

  `test_second` fails with `Lists differ: ['first', 'second'] != ['second']`. Worse, the result depends on test order. Create mutable state in `setUp()` instead.

- **Forgetting `super().setUp()`.** When your test class inherits from a base test class that has its own `setUp()`, call `super().setUp()` (and `super().tearDown()`), or the base setup silently never runs.
- **Relying on `tearDown()` after a partial `setUp()`.** If `setUp()` can fail midway, use `addCleanup()` or `enterContext()` right after acquiring each resource.
- **Putting slow work in `setUp()`.** Opening a database connection 500 times makes the suite slow. Move it to `setUpClass()` and reset only the cheap state per test.

## Summary

- A test fixture is the setup a test needs plus the cleanup afterwards.
- `setUp()`/`tearDown()` run around **each** test. Every test also gets a new instance of the test class, which keeps tests isolated.
- `setUpClass()`/`tearDownClass()` (class methods) run once per class. `setUpModule()`/`tearDownModule()` (functions) run once per module.
- Order: module setup, class setup, then `setUp` -> test -> `tearDown` for each test, then class teardown, then module teardown.
- `tearDown()` runs even when the test fails, but not when `setUp()` raises.
- `addCleanup()` registers cleanups that always run, in reverse order. `enterContext()` (3.11+) does it for context managers in one call.
- Share only expensive, effectively read-only resources at class or module level, and reset per-test state in `setUp()`/`tearDown()`.

## Practice

### Exercise 1: Predict the order

Without running it, write down the order in which the lines are printed when you run `python3 -m unittest -v` in a terminal. Does `tearDown` run after the failing test?

```python
import unittest


class TestOrder(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("setUpClass")

    @classmethod
    def tearDownClass(cls):
        print("tearDownClass")

    def setUp(self):
        print("setUp")

    def tearDown(self):
        print("tearDown")

    def test_b(self):
        print("test_b")

    def test_a(self):
        print("test_a")
        self.assertEqual(1, 2)
```

### Exercise 2: Remove the duplication

`cart.py` contains:

```python
class ShoppingCart:
    def __init__(self):
        self._items = []

    def add(self, name, price):
        self._items.append((name, price))

    def total(self):
        return sum(price for _, price in self._items)

    def count(self):
        return len(self._items)
```

Rewrite these tests using `setUp()`. Then explain why adding a bag in `test_add_more` does not change the result of `test_count`.

```python
import unittest

from cart import ShoppingCart


class TestShoppingCart(unittest.TestCase):
    def test_total(self):
        cart = ShoppingCart()
        cart.add("book", 12)
        cart.add("pen", 3)
        self.assertEqual(cart.total(), 15)

    def test_count(self):
        cart = ShoppingCart()
        cart.add("book", 12)
        cart.add("pen", 3)
        self.assertEqual(cart.count(), 2)

    def test_add_more(self):
        cart = ShoppingCart()
        cart.add("book", 12)
        cart.add("pen", 3)
        cart.add("bag", 25)
        self.assertEqual(cart.total(), 40)
```

### Exercise 3: A temporary-folder fixture

`lines.py` contains:

```python
def count_lines(path):
    with open(path, encoding="utf-8") as f:
        return sum(1 for _ in f)
```

Write `test_lines.py` with a fixture that creates a fresh temporary directory for each test and is guaranteed to delete it, even if a test fails. Add a helper method `write(name, text)` that creates a file in that folder, and test three cases: a file with three lines, a file whose last line has no trailing newline, and an empty file.

### Exercise 4: Find the bug

Both tests below end with `ERROR`. Explain why and fix the class with a one-word change.

```python
import unittest


class Counter:
    def __init__(self):
        self.value = 0

    def increment(self):
        self.value += 1


class TestCounter(unittest.TestCase):
    def setup(self):
        self.counter = Counter()

    def test_starts_at_zero(self):
        self.assertEqual(self.counter.value, 0)

    def test_increment(self):
        self.counter.increment()
        self.assertEqual(self.counter.value, 1)
```

## Solutions

### Exercise 1

Output (path shortened, timing varies):

```text
setUpClass
test_a (test_order.TestOrder.test_a) ... setUp
test_a
FAIL
tearDown
test_b (test_order.TestOrder.test_b) ... setUp
test_b
tearDown
ok
tearDownClass

======================================================================
FAIL: test_a (test_order.TestOrder.test_a)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_order.py", line 24, in test_a
    self.assertEqual(1, 2)
    ~~~~~~~~~~~~~~~~^^^^^^
AssertionError: 1 != 2

----------------------------------------------------------------------
Ran 2 tests in 0.001s

FAILED (failures=1)
```

- `test_a` runs before `test_b`, although it is defined later, because tests run in alphabetical order.
- `tearDown` **does** run after the failing test. `FAIL` is printed before it because a failure is reported the moment it happens, while `ok` is reported only after the whole test, including `tearDown()`, has finished.
- `setUpClass` and `tearDownClass` run exactly once.

### Exercise 2

```python
import unittest

from cart import ShoppingCart


class TestShoppingCart(unittest.TestCase):
    def setUp(self):
        self.cart = ShoppingCart()
        self.cart.add("book", 12)
        self.cart.add("pen", 3)

    def test_total(self):
        self.assertEqual(self.cart.total(), 15)

    def test_count(self):
        self.assertEqual(self.cart.count(), 2)

    def test_add_more(self):
        self.cart.add("bag", 25)
        self.assertEqual(self.cart.total(), 40)
```

Output of `python3 -m unittest -v`:

```text
test_add_more (test_cart.TestShoppingCart.test_add_more) ... ok
test_count (test_cart.TestShoppingCart.test_count) ... ok
test_total (test_cart.TestShoppingCart.test_total) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

`test_add_more` runs first and adds a third item, but only to *its own* cart. Before `test_count`, `setUp()` runs again on a new test instance and builds a brand-new cart with two items.

### Exercise 3

```python
import tempfile
import unittest
from pathlib import Path

from lines import count_lines


class TestCountLines(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.folder = Path(tmp.name)

    def write(self, name, text):
        path = self.folder / name
        path.write_text(text, encoding="utf-8")
        return path

    def test_three_lines(self):
        path = self.write("a.txt", "one\ntwo\nthree\n")
        self.assertEqual(count_lines(path), 3)

    def test_last_line_without_newline(self):
        path = self.write("b.txt", "one\ntwo")
        self.assertEqual(count_lines(path), 2)

    def test_empty_file(self):
        path = self.write("c.txt", "")
        self.assertEqual(count_lines(path), 0)
```

Output of `python3 -m unittest -v`:

```text
test_empty_file (test_lines.TestCountLines.test_empty_file) ... ok
test_last_line_without_newline (test_lines.TestCountLines.test_last_line_without_newline) ... ok
test_three_lines (test_lines.TestCountLines.test_three_lines) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
```

`addCleanup(tmp.cleanup)` is registered immediately after the directory is created, so the folder is removed after every test, passed or failed. `write()` has no `test` prefix, so the runner treats it as a helper. On Python 3.11+ the first three lines of `setUp()` can be replaced with `self.folder = Path(self.enterContext(tempfile.TemporaryDirectory()))`.

### Exercise 4

The method is called `setup`, not `setUp`. `unittest` only calls a method with the exact name `setUp`, so `self.counter` is never created, and both tests raise `AttributeError: 'TestCounter' object has no attribute 'counter'`. Fix the name:

```python
class TestCounter(unittest.TestCase):
    def setUp(self):
        self.counter = Counter()

    def test_starts_at_zero(self):
        self.assertEqual(self.counter.value, 0)

    def test_increment(self):
        self.counter.increment()
        self.assertEqual(self.counter.value, 1)
```

Output of `python3 -m unittest -v`:

```text
test_increment (test_counter.TestCounter.test_increment) ... ok
test_starts_at_zero (test_counter.TestCounter.test_starts_at_zero) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

---

*Source: [pythontutorial.net — Python Test Fixtures](https://www.pythontutorial.net/python-unit-testing/python-test-fixtures/). Adapted and expanded for PyJourney.*
