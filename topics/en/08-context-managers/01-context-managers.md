# Context Managers

A **context manager** is an object that prepares something before a block of code runs and reliably cleans it up afterwards, even if the block fails with an exception. You use it with the `with` statement. Files, locks, database transactions and temporary settings are all managed this way, and writing your own context managers lets you put setup and cleanup logic in one reusable place.

## What you'll learn

- Why manual cleanup with `close()` is fragile and how `try`/`finally` fixes it
- How the `with` statement works and what `as` binds
- The **context manager protocol**: `__enter__()` and `__exit__()`, and exactly when each is called
- How `__exit__()` receives exception details and how it can suppress an exception
- Typical uses: open–close, lock–release, start–stop, change–reset
- How to write context managers as classes and with `contextlib.contextmanager`

## Preparing the example files

The examples read two small text files. Create them once in your working folder:

```python
from pathlib import Path

Path("data.txt").write_text("100\n")   # a valid number
Path("bad.txt").write_text("'100'")    # a number in quotes: not valid for int()
```

## The problem: cleanup that does not happen

A program that reads a number from a file usually looks like this: open, read, convert, close.

```python
f = open("data.txt")
data = f.readlines()

# convert the number to an integer and display it
print(int(data[0]))

f.close()
```

Output:

```text
100
```

That works until the data is not what you expected. If the conversion raises an exception, the line with `f.close()` is never reached:

```python
f = open("bad.txt")
try:
    data = f.readlines()
    print(int(data[0]))
    f.close()
except ValueError as error:
    print("ValueError:", error)

print("Is the file closed?", f.closed)
```

Output:

```text
ValueError: invalid literal for int() with base 10: "'100'"
Is the file closed? False
```

The file stays open. In a short script the operating system cleans up when the program ends, but a long-running program (a web server, a data pipeline) that leaks a file handle on every error eventually hits the limit of open files. The same goes for network connections, locks and database transactions.

The classic fix is `finally`, whose block runs **no matter how** the `try` block ends:

```python
f = open("bad.txt")
try:
    data = f.readlines()
    # convert the number to an integer and display it
    print(int(data[0]))
except ValueError as error:
    print("ValueError:", error)
finally:
    f.close()

print("Is the file closed?", f.closed)
```

Output:

```text
ValueError: invalid literal for int() with base 10: "'100'"
Is the file closed? True
```

> **Note:** `open()` is called *before* `try`, on purpose. If it were inside `try` and the file did not exist, `f` would never be assigned, and `f.close()` in `finally` would fail with a `NameError` that hides the real `FileNotFoundError`.

This is correct, but it is verbose, and you have to remember the pattern every single time.

## The `with` statement

A context manager packs that `try`/`finally` logic into the object itself. File objects are context managers, so the code above becomes:

```python
with open("data.txt") as f:
    data = f.readlines()
    print(int(data[0]))

print("Is the file closed?", f.closed)
```

Output:

```text
100
Is the file closed? True
```

When the block ends, Python closes the file automatically. That also happens when the block is left because of an exception:

```python
try:
    with open("bad.txt") as f:
        print(int(f.read()))
except ValueError as error:
    print("ValueError:", error)

print("Is the file closed?", f.closed)
```

Output:

```text
ValueError: invalid literal for int() with base 10: "'100'"
Is the file closed? True
```

The general syntax is:

```text
with expression as target:
    body
```

1. `expression` is evaluated. Its result must be a context manager.
2. Python calls the manager's `__enter__()` method. Its **return value** is assigned to `target`. The `as target` part is optional.
3. The `body` runs.
4. When the body is left **for any reason** (it finished, an exception was raised, or `return`, `break` or `continue` jumped out), Python calls the manager's `__exit__()` method.

A `with` block does not create a new scope. The name `target` remains available after the block, as `f.closed` above shows, but the resource it refers to has been cleaned up.

## The context manager protocol

An object is a context manager if its class defines two methods:

| Method | Purpose |
|---|---|
| `__enter__(self)` | Set up the context. The value it returns is bound to the `as` target. |
| `__exit__(self, exc_type, exc_value, traceback)` | Clean up. It receives information about the exception, if there was one, and may suppress it. |

A tracing class makes the order of calls visible. The examples below reuse it:

```python
class Tracer:
    def __init__(self, name):
        self.name = name
        print(f"{self.name}: __init__()")

    def __enter__(self):
        print(f"{self.name}: __enter__()")
        return f"resource of {self.name}"

    def __exit__(self, exc_type, exc_value, traceback):
        print(f"{self.name}: __exit__({exc_type}, {exc_value!r})")
        return False


with Tracer("demo") as value:
    print("inside the block, value =", repr(value))
print("after the block")
```

Output:

```text
demo: __init__()
demo: __enter__()
inside the block, value = 'resource of demo'
demo: __exit__(None, None)
after the block
```

Notice that `value` is the string returned by `__enter__()`, not the `Tracer` object. The `as` target always gets whatever `__enter__()` returns. Many context managers return `self` (file objects do), which is why `with open(...) as f` gives you the file.

Now the same with an exception inside the block:

```python
try:
    with Tracer("failing") as value:
        print("inside the block")
        raise KeyError("missing")
        print("never printed")
except KeyError as error:
    print("caught outside:", repr(error))
```

Output:

```text
failing: __init__()
failing: __enter__()
inside the block
failing: __exit__(<class 'KeyError'>, KeyError('missing'))
caught outside: KeyError('missing')
```

`__exit__()` ran first, and then the exception continued on its way to the `except` outside.

### What `with` does, step by step

The `with` statement is roughly equivalent to the following code (simplified from the language reference):

```text
manager = expression
target = manager.__enter__()
try:
    body
except BaseException as exc:
    if not manager.__exit__(type(exc), exc, exc.__traceback__):
        raise                      # __exit__ returned a false value: re-raise
else:
    manager.__exit__(None, None, None)
```

Three details follow from it:

- `__exit__()` is called **whenever the body is left**, normally or because of an exception, but it is **not** called if `__enter__()` itself raises, because the body never started.
- Without an exception, `__exit__()` gets `None, None, None`.
- With an exception, it gets the exception class, the exception object and its traceback.

### The return value of `__exit__()`

- If `__exit__()` returns a **true** value, the exception is **suppressed**: it disappears, and execution continues after the `with` statement.
- If it returns a **false** value, the exception propagates. `None` counts as false, so a method that has no `return` statement never suppresses anything.

Do not re-raise the exception inside `__exit__()` yourself. Return `False` (or nothing) and Python re-raises it for you.

Here is a context manager that suppresses only the exception types it was given:

```python
class Ignore:
    def __init__(self, *exception_types):
        self.exception_types = exception_types

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return exc_type is not None and issubclass(exc_type, self.exception_types)


with Ignore(ZeroDivisionError):
    print("before")
    1 / 0
    print("skipped")
print("after")

try:
    with Ignore(ZeroDivisionError):
        int("abc")
except ValueError as error:
    print("not ignored:", error)
```

Output:

```text
before
after
not ignored: invalid literal for int() with base 10: 'abc'
```

The rest of the body after the exception (`print("skipped")`) is still skipped: suppressing an exception does not resume the block. The standard library provides the same tool as `contextlib.suppress`.

## Where context managers are used

Whenever an action needs a matching "undo" action, a context manager guarantees that the second one happens.

### 1. Open – close

Files, network sockets, database connections, temporary directories: anything that must be released after use.

### 2. Lock – release

A `threading.Lock` is a context manager. `with lock:` acquires it and always releases it, even if the protected code fails, which prevents deadlocks:

```python
import threading

lock = threading.Lock()

with lock:
    print("locked inside:", lock.locked())
print("locked after:", lock.locked())
```

Output:

```text
locked inside: True
locked after: False
```

### 3. Start – stop

Measuring time, starting and stopping a service, opening and committing a transaction. A `Timer` example follows below.

### 4. Change – reset

Temporarily change some state, work with it, then restore the previous state. For example, an application may have a default database connection, and some code needs to work with another one for a while:

```python
settings = {"database": "main"}


class UseDatabase:
    def __init__(self, name):
        self.name = name

    def __enter__(self):
        self.previous = settings["database"]   # remember the old value
        settings["database"] = self.name       # change it
        return self.name

    def __exit__(self, exc_type, exc_value, traceback):
        settings["database"] = self.previous   # always restore it
        return False


print(settings["database"])
with UseDatabase("reports"):
    print(settings["database"])
print(settings["database"])
```

Output:

```text
main
reports
main
```

The standard library uses the same idea. `decimal.localcontext()` changes the precision of decimal arithmetic only inside the block:

```python
from decimal import Decimal, localcontext

with localcontext() as ctx:
    ctx.prec = 5
    print(Decimal(1) / Decimal(7))

print(Decimal(1) / Decimal(7))
```

Output:

```text
0.14286
0.1428571428571428571428571429
```

## Implementing the protocol: a `File` class

The following class is a simplified version of what `open()` gives you. It opens a file in `__enter__()` and closes it in `__exit__()`:

```python
class File:
    def __init__(self, filename, mode):
        self.filename = filename
        self.mode = mode
        self._file = None

    def __enter__(self):
        print(f"Opening the file {self.filename}.")
        self._file = open(self.filename, self.mode)
        return self._file

    def __exit__(self, exc_type, exc_value, exc_traceback):
        print(f"Closing the file {self.filename}.")
        if not self._file.closed:
            self._file.close()

        return False


with File("data.txt", "r") as f:
    print(int(next(f)))
```

Output:

```text
Opening the file data.txt.
100
Closing the file data.txt.
```

How it works:

- `__init__()` only stores the file name and mode. Nothing is opened yet.
- `__enter__()` opens the file and returns the file object, so `f` is the real file, not the `File` instance.
- `__exit__()` closes the file if it is still open and returns `False`, so any exception from the block propagates.
- `next(f)` reads the first line, since a file object is an iterator over its lines.

## Start – stop: a `Timer` class

`Timer` starts a clock in `__enter__()` and stops it in `__exit__()`. `__enter__()` returns `self`, so the code after the block can read the measured time from the `as` target:

```python
from time import perf_counter


class Timer:
    def __init__(self):
        self.elapsed = 0

    def __enter__(self):
        self.start = perf_counter()
        return self

    def __exit__(self, exc_type, exc_value, exc_traceback):
        self.stop = perf_counter()
        self.elapsed = self.stop - self.start
        return False


def fibonacci(n):
    f1 = 1
    f2 = 1
    for _ in range(n - 1):
        f1, f2 = f2, f1 + f2

    return f1


with Timer() as timer:
    for _ in range(1000):
        fibonacci(1000)

print(f"{timer.elapsed:.4f} seconds")
```

Output (the time varies by machine and run):

```text
0.0193 seconds
```

`__exit__()` does not return the elapsed time: its return value only decides whether an exception is suppressed. The result is stored in the `elapsed` attribute instead. `perf_counter()` is the right clock for measuring durations because it has the highest available resolution and never jumps backwards.

## The shortcut: `contextlib.contextmanager`

Writing a class with two dunder methods is the most explicit approach. For simple cases, the `@contextmanager` decorator from `contextlib` turns a **generator function** into a context manager:

- the code **before** `yield` runs as `__enter__()`;
- the **yielded value** is bound to the `as` target;
- the code **after** `yield` runs as `__exit__()`.

```python
from contextlib import contextmanager

settings = {"database": "main"}


@contextmanager
def use_database(name):
    previous = settings["database"]
    settings["database"] = name
    try:
        yield name
    finally:
        settings["database"] = previous


with use_database("reports") as db:
    print("inside:", db, settings["database"])
print("after:", settings["database"])

try:
    with use_database("archive"):
        raise RuntimeError("query failed")
except RuntimeError as error:
    print("error:", error)
print("after the error:", settings["database"])
```

Output:

```text
inside: reports reports
after: main
error: query failed
after the error: main
```

If the block raises, the exception is re-raised **inside the generator, at the `yield`**. That is why the cleanup sits in `finally`: without it, an exception would skip the restoring line. To suppress an exception, catch it around the `yield` with `except` instead of letting it propagate.

> **Note:** A generator-based context manager must yield **exactly once**. Yielding a second time causes `RuntimeError: generator didn't stop`.

## More tools from `contextlib`

| Tool | What it does |
|---|---|
| `suppress(*exceptions)` | Ignores the listed exceptions inside the block. |
| `redirect_stdout(file)` | Temporarily sends `print()` output to another file-like object. |
| `closing(obj)` | Calls `obj.close()` at the end, for objects that have `close()` but are not context managers. |
| `chdir(path)` | Temporarily changes the current working directory (Python 3.11+). |
| `ExitStack()` | Manages a number of context managers that is only known at run time. |

```python
import io
import os
from contextlib import redirect_stdout, suppress

with suppress(FileNotFoundError):
    os.remove("no-such-file.txt")   # the error is silently ignored
print("still running")

buffer = io.StringIO()
with redirect_stdout(buffer):
    print("this goes into the buffer")
print("captured:", repr(buffer.getvalue()))
```

Output:

```text
still running
captured: 'this goes into the buffer\n'
```

## Several context managers in one `with`

You can list several managers, separated by commas. They are entered from left to right and exited in **reverse** order, like nested `with` statements. Here it is with the `Tracer` class from above:

```python
with Tracer("A") as a, Tracer("B") as b:
    print("body")
```

Output:

```text
A: __init__()
A: __enter__()
B: __init__()
B: __enter__()
body
B: __exit__(None, None)
A: __exit__(None, None)
```

Since Python 3.10, a long list can be wrapped in parentheses and split over several lines:

```python
with (
    open("data.txt") as source,
    open("copy.txt", "w") as target,
):
    target.write(source.read())

with open("copy.txt") as f:
    print(f.read().strip())
```

Output:

```text
100
```

## Common mistakes

- **Using the class instead of an instance.** `with Timer:` passes the class itself, which is not a context manager: `TypeError: 'type' object does not support the context manager protocol (missed __exit__ method)`. Write `with Timer():`.

- **Forgetting `return self` in `__enter__()`.** Then the `as` target is `None`, and the first attribute access fails with `AttributeError: 'NoneType' object has no attribute ...`.

- **Returning `True` from `__exit__()` by accident.** It silently swallows *every* exception in the block, including real bugs. Return a true value only for exceptions you deliberately want to suppress.

- **No `try`/`finally` around `yield` in a `@contextmanager` function.** If the block raises, the code after `yield` never runs, and the cleanup is skipped.

- **Using the resource after the block.** The name still exists, but the resource is closed:

  ```python
  with open("data.txt") as f:
      pass

  try:
      f.read()
  except ValueError as error:
      print("ValueError:", error)
  ```

  Output:

  ```text
  ValueError: I/O operation on closed file.
  ```

- **Putting `open()` inside `try` and closing in `finally`.** If `open()` fails, `f` does not exist and `finally` raises `NameError`. Use `with`, or call `open()` before `try`.

## Summary

- A context manager sets up a context in `__enter__()` and cleans it up in `__exit__()`. The `with` statement guarantees that `__exit__()` runs whenever the block is left, even because of an exception.
- The `as` target receives the return value of `__enter__()`, not necessarily the manager itself.
- `__exit__(exc_type, exc_value, traceback)` gets `None` three times on success, or the exception details on failure. A true return value suppresses the exception; `False` or `None` lets it propagate.
- If `__enter__()` raises, the body and `__exit__()` do not run.
- Typical patterns: open–close, lock–release, start–stop, change–reset.
- `@contextlib.contextmanager` turns a generator with a single `yield` into a context manager. Put the cleanup in `finally`.
- Several managers can share one `with`. They exit in reverse order.

## Practice

### Exercise 1: Predict the output

Write down the exact output, then run the code to check.

```python
class Guard:
    def __enter__(self):
        print("enter")
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        print("exit:", exc_type.__name__ if exc_type else None)
        return exc_type is ValueError


with Guard():
    print("step 1")
    raise ValueError("bad value")
    print("step 2")
print("after first block")

try:
    with Guard():
        raise TypeError("bad type")
except TypeError:
    print("TypeError escaped")
```

### Exercise 2: A temporary attribute

Write a class-based context manager `TemporaryAttribute(obj, name, value)` that sets `obj.name = value` for the duration of the block and afterwards restores the old value. If the attribute did not exist before, it must be deleted afterwards. Restoring must also happen if the block raises an exception.

### Exercise 3: `ignore()` with a generator

Using `@contextmanager`, write `ignore(*exception_types)` that suppresses only the given exception types and lets all others through. Show that `with ignore(KeyError): {}["x"]` is silent and that a `ZeroDivisionError` inside `with ignore(KeyError):` still propagates.

### Exercise 4: All or nothing

Write a context manager `Transaction(items)` for a list. Inside the block, the code works on a **copy** of the list (returned by `__enter__()`). If the block finishes without an exception, the changes are written back to the original list. If an exception occurs, the original list stays unchanged and the exception propagates.

## Solutions

### Exercise 1

Output:

```text
enter
step 1
exit: ValueError
after first block
enter
exit: TypeError
TypeError escaped
```

The `ValueError` is suppressed because `__exit__()` returns `True` for it, so `"after first block"` is printed, but `"step 2"` is not: suppressing an exception never resumes the block. For `TypeError`, `__exit__()` returns `False`, so the exception propagates to the outer `try`.

### Exercise 2

```python
class TemporaryAttribute:
    _missing = object()   # a unique marker for "the attribute did not exist"

    def __init__(self, obj, name, value):
        self.obj = obj
        self.name = name
        self.value = value

    def __enter__(self):
        self.old_value = getattr(self.obj, self.name, self._missing)
        setattr(self.obj, self.name, self.value)
        return self.obj

    def __exit__(self, exc_type, exc_value, traceback):
        if self.old_value is self._missing:
            delattr(self.obj, self.name)
        else:
            setattr(self.obj, self.name, self.old_value)
        return False


class Config:
    debug = False


config = Config()

with TemporaryAttribute(config, "debug", True):
    print("inside:", config.debug)
print("after:", config.debug)

with TemporaryAttribute(config, "level", 3):
    print("inside:", config.level)
print("has level after:", hasattr(config, "level"))

try:
    with TemporaryAttribute(config, "debug", True):
        raise RuntimeError("boom")
except RuntimeError:
    print("after error:", config.debug)
```

Output:

```text
inside: True
after: False
inside: 3
has level after: False
after error: False
```

`_missing = object()` creates a sentinel that cannot be confused with any real value. Using `None` as the marker would break for attributes whose real value is `None`. In the first block, `setattr()` creates an *instance* attribute that hides the class attribute `Config.debug`. When the old value is restored, the instance attribute stays, holding the original value `False`.

### Exercise 3

```python
from contextlib import contextmanager


@contextmanager
def ignore(*exception_types):
    try:
        yield
    except exception_types:
        pass


with ignore(KeyError):
    {}["x"]
print("KeyError was ignored")

try:
    with ignore(KeyError):
        1 / 0
except ZeroDivisionError as error:
    print("propagated:", error)
```

Output:

```text
KeyError was ignored
propagated: division by zero
```

The exception from the block is re-raised at the `yield`. `except exception_types` accepts a tuple of classes, so the listed exceptions are caught (and thereby suppressed), while all others leave the generator and reach the caller.

### Exercise 4

```python
class Transaction:
    def __init__(self, items):
        self.items = items

    def __enter__(self):
        self.working_copy = list(self.items)
        return self.working_copy

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type is None:
            self.items[:] = self.working_copy   # commit: replace contents in place
        return False                            # never suppress errors


cart = ["apple"]

with Transaction(cart) as items:
    items.append("pear")
    items.append("plum")
print(cart)

try:
    with Transaction(cart) as items:
        items.append("melon")
        raise ValueError("payment declined")
except ValueError as error:
    print("rolled back:", error)
print(cart)
```

Output:

```text
['apple', 'pear', 'plum']
rolled back: payment declined
['apple', 'pear', 'plum']
```

`self.items[:] = ...` replaces the *contents* of the original list, so every reference to `cart` sees the committed result. Writing `self.items = self.working_copy` would only rebind the attribute and leave `cart` unchanged.

---

*Source: [pythontutorial.net — Python Context Managers](https://www.pythontutorial.net/advanced-python/python-context-managers/). Adapted and expanded for PyJourney.*
