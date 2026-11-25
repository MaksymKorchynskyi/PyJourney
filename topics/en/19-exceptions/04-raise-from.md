# Raise From

When a handler turns one exception into another, Python links the two automatically, as the topic *Raise Exceptions* showed. But the traceback then says the second exception happened "during handling" of the first, as if by accident. The `raise ... from ...` statement states the relationship explicitly: the new exception was **caused** by the old one. With `from None` you can also hide the old exception when it would only confuse the reader.

## What you'll learn

- The syntax `raise NewError(...) from cause` and what it does to the exception object
- The difference between implicit chaining (`__context__`) and explicit chaining (`__cause__`)
- How each kind of chain is shown in a traceback
- How to suppress the chain with `raise ... from None`, and what really happens to the original exception
- When to translate an exception, and when to hide the cause
- How to inspect and walk a chain of exceptions in code

## The problem: an intentional change that looks like an accident

This `divide()` deliberately replaces `ZeroDivisionError` with a `ValueError` that explains the rule to the caller:

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        raise ValueError("b must not be zero")


divide(10, 0)
```

Output:

```text
Traceback (most recent call last):
  File "app.py", line 3, in divide
    return a / b
           ~~^~~
ZeroDivisionError: division by zero

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "app.py", line 8, in <module>
    divide(10, 0)
    ~~~~~~^^^^^^^
  File "app.py", line 5, in divide
    raise ValueError("b must not be zero")
ValueError: b must not be zero
```

The key sentence is "During handling of the above exception, another exception occurred". It means: while Python was handling the `ZeroDivisionError`, something else went wrong. That is how a bug inside a handler looks, and anyone reading this traceback will start looking for one. Here, though, there is no bug. The `ValueError` is the intended result.

## The `raise ... from` statement

The syntax is:

```python
raise NewException("message") from cause
```

`cause` is usually the exception you caught with `except ... as`. With it, the handler says "the new exception is a **consequence** of this one":

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError as ex:
        raise ValueError("b must not be zero") from ex


divide(10, 0)
```

Output:

```text
Traceback (most recent call last):
  File "app.py", line 3, in divide
    return a / b
           ~~^~~
ZeroDivisionError: division by zero

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "app.py", line 8, in <module>
    divide(10, 0)
    ~~~~~~^^^^^^^
  File "app.py", line 5, in divide
    raise ValueError("b must not be zero") from ex
ValueError: b must not be zero
```

The two tracebacks are the same, but the sentence between them now reads "The above exception was the direct cause of the following exception". The reader immediately knows that the `ValueError` is a deliberate translation, and still sees where the original problem happened.

Read a chained traceback from the bottom, as usual. The last exception is the one that reached you. The block above it is its cause, and in a longer chain each block is the cause of the one below it.

### What `from` does to the exception object

`raise ... from cause` stores the cause in the new exception's `__cause__` attribute. By default `__cause__` is `None`:

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError as ex:
        raise ValueError("b must not be zero") from ex


try:
    divide(10, 0)
except ValueError as ex:
    print("cause:", ex.__cause__)
    print("exception:", ex)
    print(repr(ex.__cause__))
    print(ValueError("fresh").__cause__)
```

Output:

```text
cause: division by zero
exception: b must not be zero
ZeroDivisionError('division by zero')
None
```

`ex.__cause__` is the original exception object, so the caller can inspect it: its type, its message, its own attributes.

Roughly, `raise NewError("msg") from cause` does this:

```python
exc = NewError("msg")
exc.__cause__ = cause
exc.__suppress_context__ = True
raise exc
```

Two details are worth knowing:

- The attributes belong to the exception **instance**. (Some tutorials write `ex = ExceptionType` and then set `ex.__cause__`, which would modify the class itself. That is not what happens.)
- Setting `__cause__` also sets `__suppress_context__` to `True`. That flag tells Python not to print the implicit `__context__` chain, because the explicit cause replaces it. (Assigning `__cause__` by hand sets the flag automatically too.)

`cause` can be an exception instance, an exception class (Python then creates an instance of it, without arguments) or `None`. Anything else raises `TypeError: exception causes must derive from BaseException`. `raise ... from` also works outside an `except` block, for example `raise RuntimeError("upload failed") from TimeoutError("no response")`, although in practice it is almost always used inside a handler.

## Implicit vs. explicit chaining

Python keeps track of two different links between exceptions:

| Attribute | Set by | Meaning | Traceback sentence |
|---|---|---|---|
| `__context__` | Python, automatically, when an exception is raised inside `except` or `finally` | "this exception was being handled when the new one appeared" | During handling of the above exception, another exception occurred: |
| `__cause__` | `raise ... from cause` | "this exception is the direct cause of the new one" | The above exception was the direct cause of the following exception: |

`__context__` is set **even when** you use `from`. Python always records what was being handled. `from ex` simply adds the explicit link, and since the cause and the context are the same object here, the traceback shows it only once.

When it prints a traceback, Python follows this rule for each exception in the chain:

1. If `__cause__` is not `None`, print the cause with the "direct cause" sentence.
2. Otherwise, if `__context__` is not `None` and `__suppress_context__` is `False`, print the context with the "during handling" sentence.
3. Otherwise, the chain ends here.

## Hiding the cause with `raise ... from None`

Sometimes the original exception is an internal detail that would only distract the reader. `raise ... from None` suppresses it:

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        raise ValueError("b must not be zero") from None


try:
    divide(10, 0)
except ValueError as ex:
    print("cause:", ex.__cause__)
    print("exception:", ex)
```

Output:

```text
cause: None
exception: b must not be zero
```

Without the `try` around the call, the traceback contains only the `ValueError`:

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        raise ValueError("b must not be zero") from None


divide(10, 0)
```

Output:

```text
Traceback (most recent call last):
  File "app.py", line 8, in <module>
    divide(10, 0)
    ~~~~~~^^^^^^^
  File "app.py", line 5, in divide
    raise ValueError("b must not be zero") from None
ValueError: b must not be zero
```

> **Note:** `from None` hides the original exception, but it does **not** delete it. `__cause__` is `None` and `__suppress_context__` is `True`, yet `__context__` still refers to the `ZeroDivisionError`. Debugging tools can still reach it.

All three variants side by side:

```python
def convert(kind):
    try:
        1 / 0
    except ZeroDivisionError as ex:
        if kind == "plain":
            raise ValueError("bad input")
        if kind == "from ex":
            raise ValueError("bad input") from ex
        raise ValueError("bad input") from None


for kind in ["plain", "from ex", "from None"]:
    try:
        convert(kind)
    except ValueError as e:
        print(f"{kind:9} cause={e.__cause__!r:34} "
              f"context={e.__context__!r} suppress={e.__suppress_context__}")
```

Output:

```text
plain     cause=None                               context=ZeroDivisionError('division by zero') suppress=False
from ex   cause=ZeroDivisionError('division by zero') context=ZeroDivisionError('division by zero') suppress=True
from None cause=None                               context=ZeroDivisionError('division by zero') suppress=True
```

## When to use each form

**`raise ... from ex`: translate and keep the cause.** This is the right choice in most cases where you convert an exception. A typical example is a function that hides *how* it works behind an exception that describes *what* went wrong at its own level:

```python
import json


def load_config(text):
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"config is not valid JSON (line {e.lineno}, column {e.colno})") from e


print(load_config('{"debug": true}'))

try:
    load_config('{"debug": true,}')
except ValueError as e:
    print(e)
    print("cause:", type(e.__cause__).__name__, "-", e.__cause__)
```

Output:

```text
{'debug': True}
config is not valid JSON (line 1, column 15)
cause: JSONDecodeError - Illegal trailing comma before end of object: line 1 column 15 (char 14)
```

The caller handles one documented exception type (`ValueError`) and does not need to know that the function uses the `json` module. Whoever debugs it still gets the exact parser error through `__cause__` and in the traceback.

**`raise ... from None`: the original adds nothing.** Use it when the original exception is an implementation detail that would only mislead. A classic case is `__getattr__` implemented with a dictionary lookup. The caller asked for an *attribute*, so a `KeyError` from inside your class would be confusing:

```python
class Settings:
    def __init__(self, **values):
        self._values = values

    def __getattr__(self, name):
        try:
            return self._values[name]
        except KeyError:
            raise AttributeError(f"no setting named {name!r}") from None


settings = Settings(debug=True)
print(settings.debug)
print(getattr(settings, "verbose", "default"))
print(hasattr(settings, "verbose"))
settings.verbose
```

Output:

```text
True
default
False
Traceback (most recent call last):
  File "app.py", line 16, in <module>
    settings.verbose
  File "app.py", line 9, in __getattr__
    raise AttributeError(f"no setting named {name!r}") from None
AttributeError: no setting named 'verbose'
```

Raising `AttributeError` (and not `KeyError`) also makes `getattr()` with a default and `hasattr()` work correctly, because both expect `AttributeError`.

**No `from` at all** is fine when the second exception really is unrelated to the first, and of course when it is an accident. Then the implicit "during handling" chain is the honest description.

> **Tip:** If you are unsure, use `from ex`. Showing too much information is rarely harmful, but hiding the root cause of a production failure can cost hours.

## Printing a chain yourself

`traceback.print_exception(exc)` prints an exception with its whole chain, exactly as Python would. Pass `chain=False` to print only the exception itself. `traceback.format_exception(exc)` returns the same text as a list of strings (join them to get one string), which is handy for logging:

```python
import traceback


def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError as ex:
        raise ValueError("b must not be zero") from ex


try:
    divide(10, 0)
except ValueError as e:
    text = "".join(traceback.format_exception(e))
    print("ZeroDivisionError" in text, "direct cause" in text)
    print(text.splitlines()[-1])
    traceback.print_exception(e, chain=False)
```

Output:

```text
True True
ValueError: b must not be zero
Traceback (most recent call last):
  File "app.py", line 12, in <module>
    divide(10, 0)
    ~~~~~~^^^^^^^
  File "app.py", line 8, in divide
    raise ValueError("b must not be zero") from ex
ValueError: b must not be zero
```

## Common mistakes

- **Translating without `from`.** The traceback then says "During handling of the above exception, another exception occurred", which makes a deliberate translation look like a bug in the handler. Add `from ex`.
- **Forgetting `as ex`.** `except ZeroDivisionError:` followed by `raise ValueError(...) from ex` fails with a `NameError`, because there is no name `ex`. And if an earlier `ex` exists in the same scope, the cause will silently be the wrong exception.
- **Using `from None` by habit.** It throws away the most useful debugging information: the root cause. Use it only when the original exception is a pure implementation detail.
- **Believing `from None` deletes the original.** It only hides it. The original is still in `__context__`.
- **Reading a chained traceback from the top.** The top block is the oldest exception, the root cause. The exception that actually reached your code is at the very bottom.
- **Losing details in the new message.** `raise ValueError("invalid config") from e` keeps the cause, but the caller who only prints the message learns nothing. Put the important facts (line, field, value) into the new message as well.

## Summary

- `raise NewError(...) from cause` raises `NewError` and records `cause` in its `__cause__` attribute (by default `None`).
- With `from`, the traceback connects the two exceptions with "The above exception was the direct cause of the following exception". Without it, the sentence is "During handling of the above exception, another exception occurred".
- `__context__` is set automatically whenever an exception is raised during handling. `__cause__` is set only by `from`. Setting a cause also sets `__suppress_context__ = True`.
- `raise ... from None` hides the original exception from the traceback, but it stays available in `__context__`.
- Use `from ex` when translating low-level exceptions into meaningful ones, `from None` when the original is a confusing implementation detail, and no `from` when the new exception is unrelated.
- `traceback.print_exception()` and `traceback.format_exception()` print or format an exception with its whole chain.

## Practice

### Exercise 1: Translate configuration errors

Write `get_port(env)` that reads `env["PORT"]` from a dictionary and returns it as an `int`. A missing key must become `ValueError("PORT is not set")`, and a non-numeric value must become `ValueError("PORT must be an integer, got 'abc'")` (with the actual value). In both cases keep the original exception as the cause. Test it with `{"PORT": "8080"}`, `{}` and `{"PORT": "abc"}`, printing the message and `repr()` of the cause for each failure.

### Exercise 2: Predict the chain

Predict what this program prints for each `mode`, then run it.

```python
def step(mode):
    try:
        {}["user"]
    except KeyError as e:
        if mode == 1:
            raise LookupError("user missing")
        if mode == 2:
            raise LookupError("user missing") from e
        if mode == 3:
            raise LookupError("user missing") from None
        raise LookupError("user missing") from TimeoutError("db timeout")


for mode in [1, 2, 3, 4]:
    try:
        step(mode)
    except LookupError as err:
        cause = type(err.__cause__).__name__
        context = type(err.__context__).__name__
        print(mode, cause, context, err.__suppress_context__)
```

### Exercise 3: Walk the chain

Write `explain(exc)` that returns a list of strings `"Type: message"` for every exception in the chain that Python would display, starting with `exc` itself and moving towards the root cause. Follow Python's rule: go to `__cause__` if it is set, otherwise to `__context__` unless `__suppress_context__` is `True`. Test it with a three-level chain: `read_file()` raises `FileNotFoundError`, `load_user()` turns it into `LookupError` with `from`, and `show_profile()` turns that into `RuntimeError` with `from`.

### Exercise 4: Attribute-style access

Write a class `Record` that wraps a dictionary, so `Record({"name": "Olena"}).name` returns `"Olena"`. A missing key must raise `AttributeError("Record has no field 'age'")` with the `KeyError` hidden. Show that `getattr(record, "age", None)` returns `None`, and that the exception's `__cause__` is `None` while its `__context__` is a `KeyError`.

## Solutions

### Exercise 1

```python
def get_port(env):
    try:
        raw = env["PORT"]
    except KeyError as e:
        raise ValueError("PORT is not set") from e
    try:
        return int(raw)
    except ValueError as e:
        raise ValueError(f"PORT must be an integer, got {raw!r}") from e


print(get_port({"PORT": "8080"}))
for env in [{}, {"PORT": "abc"}]:
    try:
        get_port(env)
    except ValueError as e:
        print(e, "| cause:", repr(e.__cause__))
```

Output:

```text
8080
PORT is not set | cause: KeyError('PORT')
PORT must be an integer, got 'abc' | cause: ValueError("invalid literal for int() with base 10: 'abc'")
```

Two separate `try` blocks keep each handler focused on one operation, as recommended in *Exception Handling*. Translating a `ValueError` into another `ValueError` is fine: the new one has a message that makes sense to the caller.

### Exercise 2

Output:

```text
1 NoneType KeyError False
2 KeyError KeyError True
3 NoneType KeyError True
4 TimeoutError KeyError True
```

- Mode 1: implicit chaining only. No cause, the context is the `KeyError`, nothing is suppressed.
- Mode 2: the explicit cause and the context are the same `KeyError`.
- Mode 3: `from None` leaves no cause and suppresses the context, but the context is still recorded.
- Mode 4: the cause can be any exception, here a new `TimeoutError`. The context is still the `KeyError` that was being handled, but it is suppressed, so the traceback would show only the `TimeoutError` as the cause.

### Exercise 3

```python
def explain(exc):
    steps = []
    while exc is not None:
        steps.append(f"{type(exc).__name__}: {exc}")
        if exc.__cause__ is not None:
            exc = exc.__cause__
        elif not exc.__suppress_context__:
            exc = exc.__context__
        else:
            exc = None
    return steps


def read_file(path):
    raise FileNotFoundError(f"no such file: {path}")


def load_user(user_id):
    try:
        read_file(f"users/{user_id}.json")
    except FileNotFoundError as e:
        raise LookupError(f"user {user_id} not found") from e


def show_profile(user_id):
    try:
        load_user(user_id)
    except LookupError as e:
        raise RuntimeError("cannot show profile") from e


try:
    show_profile(42)
except RuntimeError as e:
    for line in explain(e):
        print(line)
```

Output:

```text
RuntimeError: cannot show profile
LookupError: user 42 not found
FileNotFoundError: no such file: users/42.json
```

`FileNotFoundError` has no cause and no context, so the loop stops there. Python's traceback shows the same three exceptions in the opposite order, with the root cause at the top.

### Exercise 4

```python
class Record:
    def __init__(self, data):
        self._data = data

    def __getattr__(self, name):
        try:
            return self._data[name]
        except KeyError:
            raise AttributeError(f"Record has no field {name!r}") from None


record = Record({"name": "Olena"})
print(record.name)
print(getattr(record, "age", None))

try:
    record.age
except AttributeError as e:
    print(e)
    print(e.__cause__, repr(e.__context__), e.__suppress_context__)
```

Output:

```text
Olena
None
Record has no field 'age'
None KeyError('age') True
```

`__getattr__` is called only for attributes that normal lookup cannot find, so `record._data` still works normally inside the method.

---

*Source: [pythontutorial.net — Python raise from](https://www.pythontutorial.net/python-oop/python-raise-from/). Adapted and expanded for PyJourney.*
