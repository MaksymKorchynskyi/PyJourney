# Mocks

A unit test should check one piece of code in isolation. Real code, though, talks to clocks, sensors, databases and web APIs whose answers are slow, random or unavailable on a test machine. A **mock** is a stand-in object that pretends to be such a dependency: you decide what it returns, and afterwards you can ask it how it was used. Python ships everything you need in the standard library module `unittest.mock`.

## What you'll learn

- What test doubles are and where mocks fit among them
- How `Mock` creates attributes and methods on the fly, and how to set `return_value`
- How `MagicMock` differs from `Mock` (magic methods such as `__len__` and `__getitem__`)
- How to inspect and assert calls: `call_count`, `call_args`, `assert_called_once_with()` and friends
- How to use `side_effect` to raise exceptions or return a sequence of values
- How `spec` and `create_autospec()` stop a mock from hiding bugs

## Test doubles in a nutshell

"Test double" is the general name for any object that replaces a real dependency in a test (like a stunt double in a film). People usually distinguish several kinds:

| Kind | What it does | Example |
|---|---|---|
| Dummy | Fills a parameter, never really used | `None` passed as an unused logger |
| Stub | Returns canned answers | A sensor that always reports 25 degrees |
| Fake | A working but simplified implementation | An in-memory dict instead of a database |
| Spy | Records how it was called | A list that collects sent e-mails |
| Mock | Returns canned answers **and** lets you verify calls | `unittest.mock.Mock` |

In everyday Python the word "mock" is used loosely, because a `Mock` object can play all of these roles. This topic focuses on the `Mock` class itself. Stubs and `patch()` get their own topics.

## Creating a mock

```python
from unittest.mock import Mock

# create a new mock object
mock = Mock()

# configure what mock.api() returns
mock.api.return_value = {
    'id': 1,
    'message': 'hello'
}

# call the "api" method
print(mock.api())
```

Output:

```text
{'id': 1, 'message': 'hello'}
```

Step by step:

1. `Mock()` creates an object that accepts **any** attribute access and **any** call.
2. `mock.api` did not exist, so the mock created a **child mock** for it on the spot.
3. `return_value` sets what the child returns when it is called.
4. `mock.api()` calls the child mock, which returns the configured dictionary.

There are now two mock objects: `mock` and `mock.api`. Printing them shows that:

```python
from unittest.mock import Mock

mock = Mock()
print(mock)

mock.api.return_value = {'id': 1, 'message': 'hello'}
print(mock.api)
print(mock.api())

print(mock.api is mock.api)   # the same child mock every time
print(mock.anything.you.like)  # attributes are created on demand
print(mock.api(42) is mock.api.return_value)
```

Output (the `id` values vary from run to run):

```text
<Mock id='4351054848'>
<Mock name='mock.api' id='4355051200'>
{'id': 1, 'message': 'hello'}
True
<Mock name='mock.anything.you.like' id='4355052544'>
True
```

Key facts:

- Accessing an attribute that does not exist creates a new child mock and remembers it, so `mock.api` always returns the **same** object.
- A mock ignores the arguments you call it with when deciding what to return. `mock.api(42)` returns the same `return_value` as `mock.api()`.
- This dynamic behaviour is what makes `Mock` so flexible: it can stand in for a module, a class, an instance or a function.

If you never set `return_value`, calling a mock returns yet another mock:

```python
from unittest.mock import Mock

db = Mock()
result = db.query("SELECT 1")
print(result)
print(result is db.query.return_value)
```

Output (the `id` varies):

```text
<Mock name='mock.query()' id='4304736608'>
True
```

The name `mock.query()` tells you exactly where the object came from, which is handy when an assertion fails.

## Mock vs. MagicMock

`unittest.mock` has two main classes:

- `Mock`: supports ordinary attributes and calls.
- `MagicMock`: a subclass of `Mock` that also preconfigures **magic (dunder) methods** such as `__len__`, `__iter__`, `__getitem__`, `__contains__`, `__enter__`/`__exit__` and many more.

```python
from unittest.mock import Mock, MagicMock

plain = Mock()
magic = MagicMock()

print(len(magic))
print(list(magic))
print(5 in magic)
print(magic[0])

magic.__len__.return_value = 3
magic.__getitem__.side_effect = lambda index: index * 10
print(len(magic), magic[4])

try:
    len(plain)
except TypeError as error:
    print("TypeError:", error)
```

Output (the `id` varies):

```text
0
[]
False
<MagicMock name='mock.__getitem__()' id='4352137200'>
3 40
TypeError: object of type 'Mock' has no len()
```

`MagicMock` gives sensible defaults (`len()` is `0`, iteration is empty, `in` is `False`), and you can configure each magic method like any other child mock. A plain `Mock` raises `TypeError`, because Python looks up magic methods on the **type**, not on the instance, so `Mock` cannot invent them on demand.

> **Tip:** Use `MagicMock` when the code under test uses the object with `len()`, `for`, `[]`, `with` and similar syntax. `patch()` creates a `MagicMock` by default for exactly this reason.

## Inspecting calls

A mock records every call made to it. This lets a test verify **interactions**: not only what the code returned, but also what it asked its dependencies to do.

```python
from unittest.mock import Mock, call

mailer = Mock()

mailer.send("ann@example.com", subject="Hi")
mailer.send("bob@example.com", subject="Report")

print(mailer.send.called)
print(mailer.send.call_count)
print(mailer.send.call_args)
print(mailer.send.call_args.args, mailer.send.call_args.kwargs)
print(mailer.send.call_args_list)
print(mailer.mock_calls)

# assertion helpers raise AssertionError when the check fails
mailer.send.assert_called_with("bob@example.com", subject="Report")
mailer.send.assert_any_call("ann@example.com", subject="Hi")
mailer.send.assert_has_calls([
    call("ann@example.com", subject="Hi"),
    call("bob@example.com", subject="Report"),
])
mailer.close.assert_not_called()

try:
    mailer.send.assert_called_once()
except AssertionError as error:
    print("AssertionError:", error)
```

Output (Python 3.14):

```text
True
2
call('bob@example.com', subject='Report')
('bob@example.com',) {'subject': 'Report'}
[call('ann@example.com', subject='Hi'),
 call('bob@example.com', subject='Report')]
[call.send('ann@example.com', subject='Hi'),
 call.send('bob@example.com', subject='Report')]
AssertionError: Expected 'send' to have been called once. Called 2 times.
Calls: [call('ann@example.com', subject='Hi'),
 call('bob@example.com', subject='Report')].
```

The most useful tools:

| Attribute / method | Meaning |
|---|---|
| `called`, `call_count` | Was it called, and how many times |
| `call_args` | Arguments of the **last** call (`.args`, `.kwargs`) |
| `call_args_list` | All calls to this mock, in order |
| `mock_calls` | All calls to the mock **and its children** |
| `assert_called()`, `assert_called_once()` | Called at least once / exactly once |
| `assert_called_with(...)` | The **last** call had these arguments |
| `assert_called_once_with(...)` | Exactly one call, with these arguments |
| `assert_any_call(...)` | At least one call had these arguments |
| `assert_has_calls([...])` | These calls happened in this order |
| `assert_not_called()` | Never called |
| `reset_mock()` | Forget all recorded calls |

> **Note:** `assert_called_with()` checks only the **last** call. If the code calls the mock several times and you care about all of them, use `assert_has_calls()` or compare `call_args_list`.

## side_effect: errors, sequences and functions

`return_value` always returns the same thing. `side_effect` gives you more control. It can be:

```python
from unittest.mock import Mock

# 1) an exception: the mock raises it when called
fetch = Mock(side_effect=ConnectionError("server is down"))
try:
    fetch()
except ConnectionError as error:
    print("raised:", error)

# 2) an iterable: each call returns the next item
dice = Mock(side_effect=[6, 1, ValueError("dice fell off the table")])
print(dice(), dice())
try:
    dice()
except ValueError as error:
    print("raised:", error)

# 3) a function: called with the same arguments, its result is returned
square = Mock(side_effect=lambda x: x * x)
print(square(7))
print(square.call_args)
```

Output:

```text
raised: server is down
6 1
raised: dice fell off the table
49
call(7)
```

- An **exception** (class or instance) is raised. This is the easiest way to test error handling: "what does my code do when the network fails?"
- An **iterable** produces one item per call. If an item is an exception, it is raised instead of returned. When the iterable runs out, the next call raises `StopIteration`.
- A **function** receives the call's arguments, and its result becomes the return value. Use it when the answer depends on the input.

If both are set, `side_effect` wins:

```python
from unittest.mock import Mock

dice = Mock(side_effect=[1, 2])
dice(); dice()
try:
    dice()
except StopIteration:
    print("StopIteration: the side_effect list is exhausted")

m = Mock(return_value=1, side_effect=lambda: 2)
print(m())
```

Output:

```text
StopIteration: the side_effect list is exhausted
2
```

(The only exception: if the `side_effect` function returns the special value `unittest.mock.DEFAULT`, the mock falls back to `return_value`.)

## Restricting a mock with spec and autospec

A mock's flexibility is also its biggest weakness. It happily accepts misspelled method names and wrong arguments, so a test can pass while the real code would crash. A **specification** limits the mock to what the real object actually has:

```python
from unittest.mock import Mock, create_autospec


class PaymentGateway:
    def charge(self, amount, currency="USD"):
        ...


loose = Mock()
print(loose.chrage(100))  # typo, but no error!

strict = Mock(spec=PaymentGateway)
try:
    strict.chrage(100)
except AttributeError as error:
    print("AttributeError:", error)

print(strict.charge(100, "EUR", "extra"))  # spec does not check arguments

auto = create_autospec(PaymentGateway, instance=True)
auto.charge(100, currency="EUR")
try:
    auto.charge(100, "EUR", "extra")
except TypeError as error:
    print("TypeError:", error)
print(isinstance(strict, PaymentGateway), isinstance(auto, PaymentGateway))
```

Output (the `id` values vary):

```text
<Mock name='mock.chrage()' id='4315713888'>
AttributeError: Mock object has no attribute 'chrage'
<Mock name='mock.charge()' id='4315714896'>
TypeError: too many positional arguments
True True
```

- `Mock(spec=SomeClass)` allows only attributes that exist on `SomeClass`, and makes the mock pass `isinstance()` checks. It does **not** check call signatures.
- `create_autospec(SomeClass, instance=True)` goes further: every method checks its arguments against the real signature, exactly as the real method would.
- `spec_set=SomeClass` additionally forbids **setting** attributes that do not exist.

> **Tip:** Prefer `spec`/`autospec` whenever the real class is available. It keeps your mocks honest when the real API changes.

## Example: testing an odometer alert

Suppose you have a module `odometer.py`:

```python
from random import randint


def speed():
    return randint(40, 120)


def alert():
    s = speed()
    if s < 60 or s > 100:
        return True
    return False
```

- `speed()` returns the current speed of a vehicle. Here it is a random number from 40 to 120. In real life it would read a hardware sensor.
- `alert()` returns `True` when the speed is **below 60** or **above 100** km/h, and `False` otherwise. It gets the speed by calling `speed()`.

Testing `alert()` directly is hard, because `speed()` returns a different value each time. A test that sometimes passes and sometimes fails is worse than no test. The fix is to replace `speed` with a mock whose return value you control.

### A first test

Create `test_odometer.py` next to `odometer.py`:

```python
import unittest
from unittest.mock import Mock

import odometer


class TestOdometer(unittest.TestCase):
    def test_alert_normal(self):
        odometer.speed = Mock()
        odometer.speed.return_value = 70
        self.assertFalse(odometer.alert())
```

How it works:

1. `odometer.speed = Mock()` replaces the module attribute `speed` with a mock.
2. `return_value = 70` makes every call to `speed()` return 70.
3. `alert()` looks up the global name `speed` in its module when it runs, so it finds and calls the mock instead of the real function.

Run the test:

```bash
python -m unittest test_odometer.py -v
```

Output:

```text
test_alert_normal (test_odometer.TestOdometer.test_alert_normal) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

### The hidden problem: the mock leaks

The test above never puts the real `speed()` back. The replacement stays in place for the rest of the test run and silently affects every test that runs later. Add a second test that checks the real function:

```python
import unittest
from unittest.mock import Mock

import odometer


class TestOdometer(unittest.TestCase):
    def test_alert_normal(self):
        odometer.speed = Mock()
        odometer.speed.return_value = 70
        self.assertFalse(odometer.alert())

    def test_real_speed_varies(self):
        speeds = {odometer.speed() for _ in range(100)}
        self.assertGreater(len(speeds), 1)
```

Output (absolute paths trimmed):

```text
test_alert_normal (test_odometer.TestOdometer.test_alert_normal) ... ok
test_real_speed_varies (test_odometer.TestOdometer.test_real_speed_varies) ... FAIL

======================================================================
FAIL: test_real_speed_varies (test_odometer.TestOdometer.test_real_speed_varies)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "test_odometer.py", line 15, in test_real_speed_varies
    self.assertGreater(len(speeds), 1)
    ~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^
AssertionError: 1 not greater than 1

----------------------------------------------------------------------
Ran 2 tests in 0.001s

FAILED (failures=1)
```

`unittest` runs test methods in alphabetical order, so `test_alert_normal` ran first and left the mock behind. `test_real_speed_varies` then called the mock 100 times and got 70 every time. Tests must not depend on each other like this.

### Covering all cases safely

Restore the original function after **every** test. `addCleanup()` runs even when the test fails:

```python
import unittest
from unittest.mock import Mock

import odometer


class TestAlert(unittest.TestCase):
    def setUp(self):
        # restore the real speed() after every test, even a failing one
        self.addCleanup(setattr, odometer, "speed", odometer.speed)
        odometer.speed = Mock()

    def test_alert_normal(self):
        odometer.speed.return_value = 70
        self.assertFalse(odometer.alert())
        odometer.speed.assert_called_once_with()

    def test_alert_at_limits(self):
        for limit in (60, 100):
            odometer.speed.return_value = limit
            self.assertFalse(odometer.alert())

    def test_alert_overspeed(self):
        odometer.speed.return_value = 101
        self.assertTrue(odometer.alert())

    def test_alert_underspeed(self):
        odometer.speed.return_value = 59
        self.assertTrue(odometer.alert())


class TestSpeed(unittest.TestCase):
    def test_real_speed_varies(self):
        speeds = {odometer.speed() for _ in range(100)}
        self.assertGreater(len(speeds), 1)
```

Run the tests:

```bash
python -m unittest test_odometer.py -v
```

Output:

```text
test_alert_at_limits (test_odometer.TestAlert.test_alert_at_limits) ... ok
test_alert_normal (test_odometer.TestAlert.test_alert_normal) ... ok
test_alert_overspeed (test_odometer.TestAlert.test_alert_overspeed) ... ok
test_alert_underspeed (test_odometer.TestAlert.test_alert_underspeed) ... ok
test_real_speed_varies (test_odometer.TestSpeed.test_real_speed_varies) ... ok

----------------------------------------------------------------------
Ran 5 tests in 0.000s

OK
```

What changed:

- `setUp()` installs a fresh mock before every test, and `addCleanup()` puts the real `speed` back afterwards. Note that `odometer.speed` in the `addCleanup()` call is evaluated **before** the mock is installed, so the saved value is the real function.
- The boundary values `60` and `100` are tested explicitly. They are the most likely place for an off-by-one bug (`<` vs `<=`).
- `assert_called_once_with()` also verifies the interaction: `alert()` must ask for the speed exactly once.

> **Note:** Replacing and restoring attributes by hand is exactly what `unittest.mock.patch()` automates. The next topic shows how to write the same tests with one decorator.

## When to use mocks

Mocks are most useful for dependencies that are:

- **Unpredictable:** random numbers, the current time, time zones.
- **Slow or external:** network calls, databases, file systems, system calls.
- **Hard to trigger:** a disk-full error, a timeout, a 500 response from a server.
- **Not built yet:** a component another team is still writing.

The benefits are:

- Tests run fast, because nothing real is touched.
- Tests are isolated from external systems, so a broken Wi-Fi does not break the test suite.
- Unpredictable results become predictable and repeatable.

Do not mock everything, though. Mock the **boundaries** of your code (I/O, network, time), not the simple pure functions and data classes inside it. A test that mocks every collaborator ends up checking that the code calls what it calls, and it breaks on every harmless refactoring.

## Common mistakes

- **Forgetting to restore a replaced attribute.** Assigning `module.func = Mock()` without restoring it leaks into later tests. Use `addCleanup()` or, better, `patch()`.
- **Trusting typos.** Without a spec, a misspelled method name silently returns a new mock, and so does a misspelled attribute:

  ```python
  from unittest.mock import Mock

  m = Mock()
  print(bool(m.caled))  # a typo creates a new (truthy) child mock

  try:
      m.assert_called_onse()
  except AttributeError as error:
      print("AttributeError:", error)
  ```

  Output:

  ```text
  True
  AttributeError: 'assert_called_onse' is not a valid assertion. Use a spec for the mock if 'assert_called_onse' is meant to be an attribute.
  ```

  `self.assertTrue(m.caled)` would always pass. Mock protects you against misspelled `assert_*` names (and, since Python 3.12, against forms such as `called_once_with` without the `assert_` prefix), but not against other typos. Use `spec` or `create_autospec()`.
- **Using `assert_called_with()` to mean "was called with these arguments at some point".** It only checks the last call. Use `assert_any_call()` for that.
- **Confusing the mock with its return value.** `mock.api` is the function, `mock.api()` (or `mock.api.return_value`) is what it returns. Setting `mock.api.json.return_value` when the code calls `mock.api().json()` configures the wrong object.
- **Using `Mock` where magic methods are needed.** `len()`, iteration and `with` fail on a plain `Mock`. Use `MagicMock`.
- **Over-mocking.** If a test needs ten mocks, the design may have too many dependencies, or you may be mocking things that are cheap and safe to use for real.

## Summary

- A mock is a test double that returns what you configure and records how it was used. Python provides it in `unittest.mock`.
- `Mock` creates child mocks for any attribute on first access. `return_value` sets what a call returns.
- `MagicMock` also supports magic methods (`len()`, iteration, `[]`, `with`).
- Check interactions with `call_count`, `call_args`, `call_args_list` and the `assert_called*` / `assert_any_call()` / `assert_has_calls()` helpers.
- `side_effect` raises exceptions, returns a sequence of values, or computes the result with a function. It takes priority over `return_value`.
- `spec` restricts attributes, and `create_autospec()` also checks call signatures. Both catch bugs that a plain mock hides.
- Always undo a replacement after the test. `addCleanup()` works, and `patch()` does it for you.

## Practice

### Exercise 1: Configure a mock

Create a `Mock` named `weather` so that `weather.today()` returns `{"temp": 21}` and `weather.forecast(days=3)` returns `[20, 22, 19]`. Call both methods and print the results. Then verify that `forecast` was called exactly once with `days=3`, and print `weather.mock_calls`.

### Exercise 2: Unreliable sensor

Write `average_reading(read, attempts)` that calls `read()` `attempts` times, skips readings that raise `OSError`, and returns the average of the successful readings (or `None` if all of them failed). Test it with a mock whose `side_effect` is `[20, OSError("glitch"), 22]`, and with a mock that always raises `OSError`. Print the results and the mocks' `call_count`.

### Exercise 3: A repository mock

Given the module `greeting.py`:

```python
class UserRepository:
    def get(self, user_id):
        raise NotImplementedError("talks to a real database")


def greet_user(repo, user_id):
    user = repo.get(user_id)
    if user is None:
        return "Unknown user"
    return f"Hello, {user['name']}!"
```

Write `test_greeting.py` with two tests (known user and unknown user). Use `Mock(spec=UserRepository)`, and check both the returned text and that `get()` was called once with the right id.

### Exercise 4: The bug a plain mock hides

`remind()` below has a bug: it forgets to pass the message.

```python
class Notifier:
    def notify(self, user, message):
        ...


def remind(notifier, user):
    notifier.notify(user)
```

Write two tests for `remind()`: one with a plain `Mock()` and one with `create_autospec(Notifier, instance=True)`. Both should call `remind(notifier, "ann")` and then `notifier.notify.assert_called_once()`. Run them, explain the results, then fix `remind()` and run again.

## Solutions

### Exercise 1

```python
from unittest.mock import Mock

weather = Mock()
weather.today.return_value = {"temp": 21}
weather.forecast.return_value = [20, 22, 19]

print(weather.today())
print(weather.forecast(days=3))

weather.forecast.assert_called_once_with(days=3)
print(weather.mock_calls)
```

Output:

```text
{'temp': 21}
[20, 22, 19]
[call.today(), call.forecast(days=3)]
```

`mock_calls` on the parent lists the calls to all its children, in order.

### Exercise 2

```python
from unittest.mock import Mock


def average_reading(read, attempts):
    readings = []
    for _ in range(attempts):
        try:
            readings.append(read())
        except OSError:
            continue
    if not readings:
        return None
    return sum(readings) / len(readings)


read = Mock(side_effect=[20, OSError("glitch"), 22])
print(average_reading(read, 3))
print(read.call_count)

always_broken = Mock(side_effect=OSError("sensor offline"))
print(average_reading(always_broken, 2))
print(always_broken.call_count)
```

Output:

```text
21.0
3
None
2
```

A list `side_effect` mixes normal values and exceptions. A single exception `side_effect` raises on every call.

### Exercise 3

```python
import unittest
from unittest.mock import Mock

from greeting import UserRepository, greet_user


class TestGreetUser(unittest.TestCase):
    def setUp(self):
        self.repo = Mock(spec=UserRepository)

    def test_known_user(self):
        self.repo.get.return_value = {"name": "Olena"}
        self.assertEqual(greet_user(self.repo, 7), "Hello, Olena!")
        self.repo.get.assert_called_once_with(7)

    def test_unknown_user(self):
        self.repo.get.return_value = None
        self.assertEqual(greet_user(self.repo, 99), "Unknown user")
        self.repo.get.assert_called_once_with(99)
```

```bash
python -m unittest test_greeting -v
```

Output:

```text
test_known_user (test_greeting.TestGreetUser.test_known_user) ... ok
test_unknown_user (test_greeting.TestGreetUser.test_unknown_user) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

The repository is passed in as an argument, so there is nothing to replace and nothing to restore. Designing code to receive its dependencies (dependency injection) makes it much easier to test.

### Exercise 4

```python
import unittest
from unittest.mock import Mock, create_autospec

from reminders import Notifier, remind


class TestRemind(unittest.TestCase):
    def test_with_plain_mock(self):
        notifier = Mock()
        remind(notifier, "ann")
        notifier.notify.assert_called_once()

    def test_with_autospec(self):
        notifier = create_autospec(Notifier, instance=True)
        remind(notifier, "ann")
        notifier.notify.assert_called_once()
```

```bash
python -m unittest test_reminders -v
```

Output with the buggy `remind()` (paths and `unittest.mock` internals trimmed):

```text
test_with_autospec (test_reminders.TestRemind.test_with_autospec) ... ERROR
test_with_plain_mock (test_reminders.TestRemind.test_with_plain_mock) ... ok

======================================================================
ERROR: test_with_autospec (test_reminders.TestRemind.test_with_autospec)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "test_reminders.py", line 15, in test_with_autospec
    remind(notifier, "ann")
    ~~~~~~^^^^^^^^^^^^^^^^^
  File "reminders.py", line 7, in remind
    notifier.notify(user)
    ~~~~~~~~~~~~~~~^^^^^^
  ...
TypeError: missing a required argument: 'message'

----------------------------------------------------------------------
Ran 2 tests in 0.002s

FAILED (errors=1)
```

The plain mock accepts any arguments, so its test passes and hides the bug. The autospec mock checks the call against the real signature of `Notifier.notify` and raises the same `TypeError` the real object would. After the fix:

```python
class Notifier:
    def notify(self, user, message):
        ...


def remind(notifier, user):
    notifier.notify(user, "Don't forget your appointment")
```

Output:

```text
test_with_autospec (test_reminders.TestRemind.test_with_autospec) ... ok
test_with_plain_mock (test_reminders.TestRemind.test_with_plain_mock) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.001s

OK
```

---

*Source: [pythontutorial.net — Python unittest Mock](https://www.pythontutorial.net/python-unit-testing/python-unittest-mock/). Adapted and expanded for PyJourney.*
