# Raise Exceptions

So far the exceptions in this section came from Python itself: a bad index, a division by zero. Your own code can signal problems the same way with the `raise` statement. Raising an exception is how a function says "I cannot do what you asked", and the caller decides whether and how to handle it.

## What you'll learn

- How to raise an exception with `raise`, and what you are allowed to raise
- How exception arguments end up in `args` and in the message
- Which built-in exception type fits common problems
- How to re-raise the current exception with a bare `raise`, for example after logging it
- What happens when a new exception is raised while another one is being handled
- How to attach extra context to an exception with `add_note()` (Python 3.11+)

## The `raise` statement

To raise an exception, write `raise` followed by an exception object:

```python
def set_age(age):
    if age < 0:
        raise ValueError(f"age must not be negative, got {age}")
    print("age set to", age)


set_age(30)
set_age(-5)
print("not reached")
```

Output:

```text
age set to 30
Traceback (most recent call last):
  File "app.py", line 8, in <module>
    set_age(-5)
    ~~~~~~~^^^^
  File "app.py", line 3, in set_age
    raise ValueError(f"age must not be negative, got {age}")
ValueError: age must not be negative, got -5
```

`raise` stops the function immediately, a bit like `return`, but instead of producing a value it starts an exception. The exception travels up the call stack until some `try...except` handles it (see the topic *Exception Handling*). Here nothing handled it, so the program stopped, and `print("not reached")` never ran.

### What you can raise

The object after `raise` must be an instance of `BaseException` or one of its subclasses. In practice it is almost always a subclass of `Exception`, directly or indirectly: `FileNotFoundError` inherits from `OSError`, which inherits from `Exception`, and it can be raised just as well. You can also write just the class name. `raise ValueError` is shorthand for `raise ValueError()`: Python creates the instance for you, without arguments. Anything else is an error in itself:

```python
for thing in [ValueError("bad value"), ValueError, "just a string"]:
    try:
        raise thing
    except Exception as e:
        print(type(e).__name__, "-", repr(e))
```

Output:

```text
ValueError - ValueError('bad value')
ValueError - ValueError()
TypeError - TypeError('exceptions must derive from BaseException')
```

Raising a string fails with a `TypeError`. (Very old Python 2 code raised strings. In Python 3 that is not allowed.) The topic *Custom Exceptions* shows how to define your own exception classes.

## Exception arguments

`BaseException.__init__()` accepts any number of positional arguments (`*args`). They are stored, as a tuple, in the `args` attribute:

```python
try:
    raise ValueError("The value error exception", "x", "y")
except ValueError as ex:
    print(ex.args)
    print(str(ex))
```

Output:

```text
('The value error exception', 'x', 'y')
('The value error exception', 'x', 'y')
```

The message you see in a traceback, `str(ex)`, depends on how many arguments there are:

```python
for exc in [ValueError(), ValueError("bad value"), ValueError("bad value", 42)]:
    print(repr(str(exc)))
```

Output:

```text
''
'bad value'
"('bad value', 42)"
```

With one argument the message is that argument, which is what you normally want. With several arguments the message is the whole tuple, which reads poorly. So pass **one clear message** and put the relevant data into it with an f-string. If callers need the data as separate values (a field name, a limit, an error code), give the exception proper attributes, as shown in *Custom Exceptions*.

## Choosing the exception type

Before inventing anything, check whether a built-in exception already describes the problem. Callers then handle it with the `except` clauses they already know.

| Situation | Exception to raise |
|---|---|
| Argument has the right type but an unacceptable value | `ValueError` |
| Argument has the wrong type | `TypeError` |
| A key or index is not found in your container-like object | `KeyError` or `IndexError` |
| A requested attribute does not exist (in `__getattr__`) | `AttributeError` |
| A method must be implemented by a subclass | `NotImplementedError` |
| The object is in the wrong state for this operation | `RuntimeError`, or better a custom exception |

A function that checks both the type and the value of an argument:

```python
def repeat(text, times):
    if not isinstance(times, int):
        raise TypeError(f"times must be an int, not {type(times).__name__}")
    if times < 0:
        raise ValueError(f"times must be >= 0, got {times}")
    return text * times


print(repeat("ab", 3))
for bad in [2.5, -1]:
    try:
        repeat("ab", bad)
    except (TypeError, ValueError) as e:
        print(type(e).__name__, "-", e)
```

Output:

```text
ababab
TypeError - times must be an int, not float
ValueError - times must be >= 0, got -1
```

A good message says what was expected and what was actually received. "times must be >= 0, got -1" can be fixed without opening the source code, while "invalid input" cannot.

> **Tip:** Validate arguments at the start of a function and raise early ("guard clauses"). The rest of the function can then assume valid data, and the traceback points straight at the call with the bad argument.

## Re-raising the current exception

Sometimes you want to react to an exception without really handling it: log it, roll back a half-finished change, and then let it continue to the caller. A bare `raise` inside an `except` block does exactly that. It re-raises the exception currently being handled:

```python
def division(a, b):
    try:
        return a / b
    except ZeroDivisionError as ex:
        print("Logging exception:", ex)
        raise


division(1, 0)
```

Output:

```text
Logging exception: division by zero
Traceback (most recent call last):
  File "app.py", line 9, in <module>
    division(1, 0)
    ~~~~~~~~^^^^^^
  File "app.py", line 3, in division
    return a / b
           ~~^~~
ZeroDivisionError: division by zero
```

You see both the log line and the original exception, with its original traceback that points at `return a / b`, the line where the problem happened.

A bare `raise` is also how you handle *some* cases and pass on the rest:

```python
def parse_port(text):
    try:
        return int(text)
    except ValueError:
        if text.strip() == "":
            return 8080
        raise


print(parse_port("5000"))
print(parse_port("  "))
print(parse_port("http"))
```

Output:

```text
5000
8080
Traceback (most recent call last):
  File "app.py", line 12, in <module>
    print(parse_port("http"))
          ~~~~~~~~~~^^^^^^^^
  File "app.py", line 3, in parse_port
    return int(text)
ValueError: invalid literal for int() with base 10: 'http'
```

An empty string has a sensible default, so that case is handled. Any other invalid text is a real error, and it goes back to the caller unchanged.

### `raise` vs. `raise ex`

`raise ex` also re-raises the same exception object, but it adds the `raise ex` line itself to the traceback:

```python
def division(a, b):
    try:
        return a / b
    except ZeroDivisionError as ex:
        print("Logging exception:", ex)
        raise ex


division(1, 0)
```

Output:

```text
Logging exception: division by zero
Traceback (most recent call last):
  File "app.py", line 9, in <module>
    division(1, 0)
    ~~~~~~~~^^^^^^
  File "app.py", line 6, in division
    raise ex
  File "app.py", line 3, in division
    return a / b
           ~~^~~
ZeroDivisionError: division by zero
```

The information is still there, but the traceback is noisier, and you need a name for the exception. Prefer the bare `raise` for re-raising. A bare `raise` with no exception being handled is an error: `RuntimeError: No active exception to reraise`.

## Raising a different exception while handling one

Often a low-level exception should become a different, more meaningful one for the caller. Here `ZeroDivisionError` is turned into `ValueError`:

```python
def division(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        raise ValueError("b must not be zero")


division(1, 0)
```

Output:

```text
Traceback (most recent call last):
  File "app.py", line 3, in division
    return a / b
           ~~^~~
ZeroDivisionError: division by zero

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "app.py", line 8, in <module>
    division(1, 0)
    ~~~~~~~~^^^^^^
  File "app.py", line 5, in division
    raise ValueError("b must not be zero")
ValueError: b must not be zero
```

Python prints **two** tracebacks. First the `ZeroDivisionError`, which was being handled, and then the `ValueError`, which was raised in the handler. Python remembers the original automatically: whenever an exception is raised inside an `except` (or `finally`) block, the exception being handled is stored in the new exception's `__context__` attribute. This is called **implicit exception chaining**:

```python
def division(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        raise ValueError("b must not be zero")


try:
    division(1, 0)
except ValueError as e:
    print(repr(e))
    print(repr(e.__context__))
```

Output:

```text
ValueError('b must not be zero')
ZeroDivisionError('division by zero')
```

Implicit chaining is especially useful when the second exception is an **accident**, a bug in the handler itself. The traceback then shows both the original problem and the bug:

```python
default_config = {"debug": False}

try:
    config = open("settings.ini").read()
except FileNotFoundError:
    config = defualt_config
```

Output:

```text
Traceback (most recent call last):
  File "app.py", line 4, in <module>
    config = open("settings.ini").read()
             ~~~~^^^^^^^^^^^^^^^^
FileNotFoundError: [Errno 2] No such file or directory: 'settings.ini'

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "app.py", line 6, in <module>
    config = defualt_config
             ^^^^^^^^^^^^^^
NameError: name 'defualt_config' is not defined. Did you mean: 'default_config'?
```

The wording "During handling of the above exception, another exception occurred" fits an accident like this typo. In the `division()` example, however, the `ValueError` was intentional, and the message makes it look like a bug. The next topic, *Raise From*, shows how to say "this exception was **caused** by that one" with `raise ... from ...`.

## Adding context with `add_note()` (Python 3.11+)

Sometimes the exception type and message are right, but the reader of the traceback would benefit from extra context: which file, which line of input, which user. Since Python 3.11 every exception has an `add_note()` method. Notes are stored in the `__notes__` list and printed below the message:

```python
def load_settings(lines):
    settings = {}
    for number, line in enumerate(lines, start=1):
        try:
            key, value = line.split("=")
        except ValueError as e:
            e.add_note(f"while parsing line {number}: {line!r}")
            raise
        settings[key.strip()] = value.strip()
    return settings


print(load_settings(["host = localhost", "port = 8080"]))
load_settings(["host = localhost", "port 8080"])
```

Output:

```text
{'host': 'localhost', 'port': '8080'}
Traceback (most recent call last):
  File "app.py", line 14, in <module>
    load_settings(["host = localhost", "port 8080"])
    ~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "app.py", line 5, in load_settings
    key, value = line.split("=")
    ^^^^^^^^^^
ValueError: not enough values to unpack (expected 2, got 1)
while parsing line 2: 'port 8080'
```

The caller still gets the original `ValueError`, so any existing `except ValueError` keeps working, and the traceback now says exactly which line of input was broken.

## Common mistakes

- **`raise NotImplemented` instead of `raise NotImplementedError`.** `NotImplemented` is a special value returned by operator methods such as `__eq__`, not an exception. Raising it fails with `TypeError: exceptions must derive from BaseException`.
- **Raising a plain `Exception`.** `raise Exception("bad age")` forces callers to write `except Exception`, which also catches every unrelated bug. Raise the most specific type that fits, built-in or custom.
- **Vague messages.** `raise ValueError("invalid")` tells nothing. Include what was expected and what was received.
- **Several arguments instead of one message.** `ValueError("bad value", 42)` prints as `('bad value', 42)`. Format one string instead.
- **Using `assert` to validate input.** Assertions are removed when Python runs with the `-O` option, so the check silently disappears:

  ```python
  def set_age(age):
      assert age >= 0, "age must not be negative"
      print("age set to", age)


  set_age(-5)
  ```

  ```bash
  python3 -O app.py
  ```

  Output:

  ```text
  age set to -5
  ```

  Use `assert` for internal sanity checks while developing, and `if ...: raise ValueError(...)` for checking data from outside.

- **`raise ex` instead of `raise`.** It works, but adds noise to the traceback. A bare `raise` re-raises the current exception cleanly.
- **Turning one exception into another without `from`.** The traceback then claims the new exception happened "during handling" of the old one, as if by accident. Use `raise NewError(...) from ex` (see *Raise From*).

## Summary

- `raise SomeError("message")` raises an exception. The function stops, and the exception propagates to the callers until it is handled.
- You can raise only instances or subclasses of `BaseException`, in practice of `Exception`. `raise ValueError` is shorthand for `raise ValueError()`.
- The arguments of an exception are stored in `args`. With one argument, `str(e)` is that argument, so pass one clear message.
- Prefer a fitting built-in type such as `ValueError` or `TypeError`, and write messages that state the expected and the actual value.
- A bare `raise` inside `except` re-raises the current exception with its original traceback. Use it to log and re-raise, or to handle only some cases.
- Raising a new exception inside a handler chains the old one implicitly: it is stored in `__context__`, and the traceback says "During handling of the above exception...".
- `add_note()` (3.11+) adds context to an exception without changing its type.

## Practice

### Exercise 1: Validate a withdrawal

Write `withdraw(balance, amount)` that returns the new balance. Raise `TypeError` if `amount` is not an `int` or `float`, `ValueError` if `amount` is not positive, and `ValueError` with a message like `"insufficient funds: balance 100, requested 150"` if `amount` is larger than `balance`. Test it with `50`, `"50"`, `-10` and `150` against a balance of `100`, printing the exception type and message for each failure.

### Exercise 2: Predict the messages

Predict what this code prints, then run it. One of the four lines will probably surprise you.

```python
for exc in [KeyError("id"), ValueError(), ValueError("a", "b"), OSError(2, "No such file")]:
    print(type(exc).__name__, exc.args, repr(str(exc)))
```

### Exercise 3: Retry, then give up

Write `retry(func, attempts)` that calls `func()` and returns its result. If the call raises `ConnectionError`, print `"attempt N failed: <message>"` and try again. When the last attempt fails, re-raise that last exception unchanged. Other exception types must not be retried at all. Test it with a function that fails twice and then succeeds, and with one that always fails.

### Exercise 4: Point at the bad row

Write `parse_people(rows)` that turns rows like `"Olena,34"` into tuples `("Olena", 34)`. If a row cannot be parsed, add a note `"row N: <row>"` to the exception and re-raise it. Test it with `["Olena,34", "Max,abc"]` in a `try` block that prints the exception type, the message and `e.__notes__`.

## Solutions

### Exercise 1

```python
def withdraw(balance, amount):
    if not isinstance(amount, (int, float)):
        raise TypeError(f"amount must be a number, not {type(amount).__name__}")
    if amount <= 0:
        raise ValueError(f"amount must be positive, got {amount}")
    if amount > balance:
        raise ValueError(f"insufficient funds: balance {balance}, requested {amount}")
    return balance - amount


for amount in [50, "50", -10, 150]:
    try:
        print("new balance:", withdraw(100, amount))
    except (TypeError, ValueError) as e:
        print(f"{type(e).__name__}: {e}")
```

Output:

```text
new balance: 50
TypeError: amount must be a number, not str
ValueError: amount must be positive, got -10
ValueError: insufficient funds: balance 100, requested 150
```

The type check comes first: comparing `"50" <= 0` would itself raise a `TypeError` with a much less helpful message.

### Exercise 2

Output:

```text
KeyError ('id',) "'id'"
ValueError () ''
ValueError ('a', 'b') "('a', 'b')"
FileNotFoundError (2, 'No such file') '[Errno 2] No such file'
```

- `KeyError` shows its key with quotes (`'id'`), because its `str()` uses the `repr()` of the key. That way an empty-string key is still visible in a traceback.
- `ValueError()` has no arguments, so its message is empty.
- With two arguments, the message is the tuple.
- `OSError(2, ...)` became a `FileNotFoundError`: `OSError` looks at the error number (`2` is `ENOENT`, "no such file or directory") and creates the matching subclass. Its message has the form `[Errno N] text`.

### Exercise 3

```python
def retry(func, attempts):
    for attempt in range(1, attempts + 1):
        try:
            return func()
        except ConnectionError as e:
            print(f"attempt {attempt} failed: {e}")
            if attempt == attempts:
                raise


def make_flaky(failures):
    calls = 0

    def fetch():
        nonlocal calls
        calls += 1
        if calls <= failures:
            raise ConnectionError(f"timeout #{calls}")
        return "payload"

    return fetch


print(retry(make_flaky(2), attempts=3))

try:
    retry(make_flaky(5), attempts=3)
except ConnectionError as e:
    print("gave up:", repr(e))
```

Output:

```text
attempt 1 failed: timeout #1
attempt 2 failed: timeout #2
payload
attempt 1 failed: timeout #1
attempt 2 failed: timeout #2
attempt 3 failed: timeout #3
gave up: ConnectionError('timeout #3')
```

The bare `raise` re-raises the third `ConnectionError` itself, so the caller sees the real last failure. A `ValueError` from `func()` is not caught by `except ConnectionError` and goes straight to the caller on the first attempt.

### Exercise 4

```python
def parse_people(rows):
    people = []
    for number, row in enumerate(rows, start=1):
        try:
            name, age = row.split(",")
            people.append((name, int(age)))
        except ValueError as e:
            e.add_note(f"row {number}: {row}")
            raise
    return people


print(parse_people(["Olena,34", "Max,28"]))

try:
    parse_people(["Olena,34", "Max,abc"])
except ValueError as e:
    print(type(e).__name__, "-", e)
    print(e.__notes__)
```

Output:

```text
[('Olena', 34), ('Max', 28)]
ValueError - invalid literal for int() with base 10: 'abc'
['row 2: Max,abc']
```

Both possible failures, a row without a comma (unpacking) and a non-numeric age (`int()`), raise `ValueError`, so one handler covers them. The note does not change `str(e)`. It is shown in the traceback and kept in `e.__notes__`.

---

*Source: [pythontutorial.net — Python Raise Exceptions](https://www.pythontutorial.net/python-oop/python-raise-exception/). Adapted and expanded for PyJourney.*
