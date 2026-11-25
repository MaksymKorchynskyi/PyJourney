# Exception Handling

The topic *Exceptions* introduced the basic `try...except`. The full `try` statement can do more: it has an `else` clause for code that should run only on success, and a `finally` clause for cleanup that must run no matter what. This topic covers all four clauses, how to decide what goes into each one, and the handling habits that keep bugs visible instead of hiding them.

## What you'll learn

- The four clauses of the `try` statement (`try`, `except`, `else`, `finally`), their order and how they can be combined
- Exactly which clauses run when there is no exception, a handled one, or an unhandled one
- Why the `try` block should be short and how `else` helps with that
- Why returning `None` on failure is risky and what to do instead
- Why bare `except:` is dangerous and how to inspect the current exception
- How to handle several exceptions at once with exception groups and `except*` (Python 3.11+)

## The `try` statement and its clauses

Here is the complete shape of the statement:

```python
try:
    ...  # code that may raise an exception
except ExceptionType as ex:
    ...  # runs if the try block raised ExceptionType (or a subclass)
else:
    ...  # runs only if the try block finished without an exception
finally:
    ...  # always runs, last, whatever happened above
```

The clauses must appear **in this order**, and each has its own rules:

| Clause | How many | Rules |
|---|---|---|
| `try` | exactly 1 | Contains the code you want to protect. Keep it as short as possible, often a single statement. |
| `except` | 0 or more | Each handles one exception type (or a tuple of types). `as ex` is optional. Order them from the most specific type to the least specific. |
| `else` | 0 or 1 | Runs only if the `try` block raised nothing. Allowed only when there is at least one `except` clause. |
| `finally` | 0 or 1 | Always runs, whether an exception occurred or not. It must come last. |

A `try` statement needs at least one `except` or a `finally`. So these combinations are valid: `try/except`, `try/except/else`, `try/except/finally`, `try/except/else/finally` and `try/finally`.

> **Note:** Some tutorials show `finally` before `else`. That is a `SyntaxError`: `else` must come right after the last `except`, and `finally` always closes the statement.

## Which clauses run, and when

The easiest way to learn the rules is to watch them. Each clause of `parse()` prints a line:

```python
def parse(text):
    print(f"--- parse({text!r})")
    try:
        number = int(text)
        print("try: converted")
    except ValueError:
        print("except: not a number")
    else:
        print("else: got", number)
    finally:
        print("finally: done")


parse("42")
parse("abc")

try:
    parse(None)
except TypeError as e:
    print("caller caught:", e)
```

Output:

```text
--- parse('42')
try: converted
else: got 42
finally: done
--- parse('abc')
except: not a number
finally: done
--- parse(None)
finally: done
caller caught: int() argument must be a string, a bytes-like object or a real number, not 'NoneType'
```

Three scenarios are visible here:

| What happened in `try` | `except` | `else` | `finally` |
|---|---|---|---|
| no exception (`"42"`) | skipped | runs | runs |
| exception matched by an `except` (`"abc"`) | the matching clause runs | skipped | runs |
| exception not matched (`None` gives a `TypeError`) | skipped | skipped | runs, then the exception continues |

The third case shows something important: an exception that the function does not handle **propagates** to the caller. Python leaves the function, runs `finally` on the way out, and looks for a handler in the calling code. If no code on the whole call chain handles it, the program stops with a traceback.

## Keep the `try` block short, and use `else`

Everything inside `try` is "protected": an exception from any of its lines goes to the `except` clauses. If you put more code there than necessary, a handler may catch an exception it was never meant for and report the wrong problem:

```python
users = {1: {"name": "Olena"}, 2: {"nickname": "max"}}


def greet(user_id):
    try:
        user = users[user_id]
        print("Hello,", user["name"])
    except KeyError:
        print(f"User {user_id} not found")


greet(1)
greet(3)
greet(2)
```

Output:

```text
Hello, Olena
User 3 not found
User 2 not found
```

User 2 exists. The `KeyError` came from `user["name"]`, because that record has no `"name"` key, but the handler was written for a missing user. Moving the second line to `else` protects only the lookup:

```python
users = {1: {"name": "Olena"}, 2: {"nickname": "max"}}


def greet(user_id):
    try:
        user = users[user_id]
    except KeyError:
        print(f"User {user_id} not found")
    else:
        print("Hello,", user["name"])


greet(1)
greet(3)
greet(2)
```

Output:

```text
Hello, Olena
User 3 not found
Traceback (most recent call last):
  File "app.py", line 15, in <module>
    greet(2)
    ~~~~~^^^
  File "app.py", line 10, in greet
    print("Hello,", user["name"])
                    ~~~~^^^^^^^^
KeyError: 'name'
```

Now the real problem, a broken user record, is visible instead of being disguised as "not found". Code in `else` runs only after a successful `try`, but its exceptions are **not** handled by the `except` clauses of the same statement.

## `finally`: cleanup that always runs

Use `finally` for actions that must happen whether the work succeeded or failed: closing a file or a network connection, releasing a lock, restoring a setting. Here the second `write()` fails, nothing handles the error, and the file is still closed:

```python
f = open("report.txt", "w")
try:
    f.write("total: ")
    f.write(100)
finally:
    f.close()
    print("file closed:", f.closed)
```

Output:

```text
file closed: True
Traceback (most recent call last):
  File "app.py", line 4, in <module>
    f.write(100)
    ~~~~~~~^^^^^
TypeError: write() argument must be str, not int
```

`finally` ran first, and then the `TypeError` continued on its way and stopped the program. `finally` does not handle an exception. It only guarantees that its code runs.

`finally` also runs when the `try` block leaves early with `return`, `break` or `continue`:

```python
def fetch():
    try:
        print("fetching")
        return "data"
    finally:
        print("cleanup")


print(fetch())
```

Output:

```text
fetching
cleanup
data
```

The return value is computed first, then `finally` runs, and only then does the function actually return.

> **Tip:** For files, locks and connections, a `with` statement is usually better than a hand-written `try...finally`. `with open("report.txt", "w") as f:` closes the file automatically, even if an exception occurs. See the section on context managers.

## Returning `None` vs. raising an exception

A tempting way to "handle" an error is to return a special value. This `divide()` returns `None` when `b` is zero:

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        return None


result = divide(10, 0)
if result is not None:
    print("result:", result)
else:
    print("Invalid inputs")
```

Output:

```text
Invalid inputs
```

Every caller now has to remember to check for `None`, and to check it correctly. A caller who writes the shorter `if result:` gets a bug, because a perfectly valid result of `0.0` is falsy too:

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        return None


for a, b in [(10, 0), (0, 10)]:
    result = divide(a, b)
    if result:
        print("result:", result)
    else:
        print("Invalid inputs")
```

Output:

```text
Invalid inputs
Invalid inputs
```

`divide(0, 10)` is a correct division with the answer `0.0`, yet it was reported as invalid. A better design is to signal the problem with an **exception**. The caller cannot accidentally ignore it, and the normal return value is always a real number:

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        raise ValueError("The second argument (b) must not be zero")


for a, b in [(10, 0), (0, 10)]:
    try:
        result = divide(a, b)
    except ValueError as e:
        print(e)
    else:
        print("result:", result)
```

Output:

```text
The second argument (b) must not be zero
result: 0.0
```

The `raise` statement creates and raises a new exception. It is the subject of the next topic, *Raise Exceptions*, and the topic *Raise From* shows how to link the new `ValueError` to the original `ZeroDivisionError`.

Often the simplest choice is not to catch the exception at all: if `divide()` cannot do anything useful about a zero divisor, letting the `ZeroDivisionError` propagate is perfectly fine. Handle an exception where you can actually do something about it.

## The order of `except` clauses

As the topic *Exceptions* explained, Python runs the **first** `except` clause that matches, and a clause matches the named class and all its subclasses. With `IndexError`, `LookupError` and `Exception` (each a subclass of the next), the correct order is `IndexError`, then `LookupError`, then `Exception`:

```python
colors = ["red", "green", "blue"]

try:
    print(colors[3])
except IndexError as e:
    print(type(e), "Index error")
except LookupError as e:
    print(type(e), "Lookup error")
```

Output:

```text
<class 'IndexError'> Index error
```

Swap the two clauses and the message becomes misleading. The exception is still an `IndexError`, but the `LookupError` clause grabs it first, and the `IndexError` clause can never run:

```python
colors = ["red", "green", "blue"]

try:
    print(colors[3])
except LookupError as e:
    print(type(e), "Lookup error")
except IndexError as e:
    print(type(e), "Index error")
```

Output:

```text
<class 'IndexError'> Lookup error
```

### Grouping exceptions

When several exception types need the same handling, list them in one clause as a tuple instead of repeating the same code:

```python
def to_number(value):
    try:
        return float(value)
    except (TypeError, ValueError) as ex:
        print("cannot convert:", ex)


to_number("3.5x")
to_number([1, 2])
```

Output:

```text
cannot convert: could not convert string to float: '3.5x'
cannot convert: float() argument must be a string or a real number, not 'list'
```

Since Python 3.14 the parentheses may be omitted when there is no `as` part (PEP 758):

```python
try:
    float("abc")
except TypeError, ValueError:
    print("cannot convert")
```

Output:

```text
cannot convert
```

With `as`, the parentheses are still required. Code that must run on Python 3.13 or older needs them in every case.

## Bare `except:` and catching everything

An `except` without any exception type is a **bare** handler:

```python
try:
    ...
except:
    ...
```

It is equivalent to `except BaseException:`, so it catches *everything*, including `SystemExit` (raised by `sys.exit()`) and `KeyboardInterrupt` (Ctrl+C). That can make a program impossible to stop:

```python
import sys

for attempt in range(3):
    try:
        print("attempt", attempt)
        sys.exit("stop now")
    except:
        print("swallowed:", repr(sys.exception()))

print("still running")
```

Output:

```text
attempt 0
swallowed: SystemExit('stop now')
attempt 1
swallowed: SystemExit('stop now')
attempt 2
swallowed: SystemExit('stop now')
still running
```

The program asked to exit three times and ignored itself each time. A bare handler also hides every bug in the `try` block, from typos (`NameError`) to wrong types (`TypeError`). If you really need to catch all *program errors*, for example at the top level of a long-running loop that must log a failure and continue, use `except Exception:`, which lets `SystemExit` and `KeyboardInterrupt` through:

```python
import sys

for attempt in range(3):
    try:
        print("attempt", attempt)
        sys.exit("stop now")
    except Exception:
        print("not reached")

print("still running")
```

Output:

```text
attempt 0
stop now
```

`sys.exit("stop now")` prints its message to standard error and ends the program with exit status 1.

> **Tip:** If you don't know which exceptions a piece of code raises, don't guess with a broad handler. Let the code fail, read the traceback, and then handle the specific exception you saw.

## Inspecting the current exception

Inside an `except` block, the usual way to get the exception is `as ex`. When you don't have a name for it (in a bare handler, or in a helper function called from the handler), the `sys` module can tell you which exception is being handled.

`sys.exc_info()` returns a tuple of three values:

- `type`: the exception class, a subclass of `BaseException`;
- `value`: the exception instance;
- `traceback`: a traceback object with the call stack at the point where the exception was raised.

Since Python 3.11 there is also `sys.exception()`, which returns just the instance. The other two values are available from it as `type(exc)` and `exc.__traceback__`, so `sys.exception()` is the modern choice.

```python
import sys

try:
    "20" / 2
except:
    print(sys.exc_info())
    exc = sys.exception()
    print(repr(exc))
    print(type(exc).__name__, exc.__traceback__.tb_lineno)
```

Output (the address of the traceback object varies):

```text
(<class 'TypeError'>, TypeError("unsupported operand type(s) for /: 'str' and 'int'"), <traceback object at 0x1031d2b40>)
TypeError("unsupported operand type(s) for /: 'str' and 'int'")
TypeError 4
```

The output tells you the exception type, so you can replace the bare handler with a specific one:

```python
try:
    "20" / 2
except TypeError as e:
    print(e)
```

Output:

```text
unsupported operand type(s) for /: 'str' and 'int'
```

Outside of any `except` block, `sys.exception()` returns `None` and `sys.exc_info()` returns `(None, None, None)`.

To print the full traceback **without** stopping the program, use the `traceback` module:

```python
import traceback

try:
    "20" / 2
except TypeError:
    traceback.print_exc()

print("program continues")
```

Output:

```text
Traceback (most recent call last):
  File "app.py", line 4, in <module>
    "20" / 2
    ~~~~~^~~
TypeError: unsupported operand type(s) for /: 'str' and 'int'
program continues
```

`traceback.format_exc()` returns the same text as a string. In real applications, `logging.exception("message")` inside an `except` block writes the message together with the traceback to the log.

## Exception groups and `except*` (Python 3.11+)

Sometimes several independent errors happen together: you validate a form and find three invalid fields, or several concurrent tasks fail (as with `asyncio.TaskGroup`). Python 3.11 added `ExceptionGroup`, an exception that carries a list of other exceptions, and the `except*` clause to handle the parts of a group:

```python
def validate(user):
    errors = []
    if not user.get("name"):
        errors.append(ValueError("name is required"))
    if not isinstance(user.get("age"), int):
        errors.append(TypeError("age must be an int"))
    if user.get("email", "").count("@") != 1:
        errors.append(ValueError("email is invalid"))
    if errors:
        raise ExceptionGroup("invalid user", errors)


try:
    validate({"name": "", "age": "42", "email": "max"})
except* ValueError as group:
    for e in group.exceptions:
        print("value problem:", e)
except* TypeError as group:
    for e in group.exceptions:
        print("type problem:", e)
```

Output:

```text
value problem: name is required
value problem: email is invalid
type problem: age must be an int
```

`except*` works differently from `except`:

- **Several** `except*` clauses can run for one group. Each one receives a new `ExceptionGroup` containing only the matching exceptions, available in its `.exceptions` attribute.
- Exceptions that no clause matches are **re-raised** as a group after the handlers run.
- If the `try` block raises an ordinary exception, `except*` wraps it in a group, so `group.exceptions` is still a tuple.
- `except` and `except*` cannot be mixed in the same `try` statement.

Here the `KeyError` has no handler, so it escapes in a new, smaller group:

```python
try:
    raise ExceptionGroup("batch failed", [ValueError("bad value"), KeyError("id")])
except* ValueError as group:
    print("handled:", group.exceptions)
```

Output:

```text
handled: (ValueError('bad value'),)
  + Exception Group Traceback (most recent call last):
  |   File "app.py", line 2, in <module>
  |     raise ExceptionGroup("batch failed", [ValueError("bad value"), KeyError("id")])
  | ExceptionGroup: batch failed (1 sub-exception)
  +-+---------------- 1 ----------------
    | KeyError: 'id'
    +------------------------------------
```

## Common mistakes

- **Too much code in `try`.** A handler written for one line catches the same exception type from every other line too, and reports the wrong cause. Protect only the operation that can fail, and move the rest to `else`.
- **Putting `else` after `finally`.** The order is fixed: `try`, `except`, `else`, `finally`. Anything else is a `SyntaxError`.
- **Using the exception name after the `except` block.** Python deletes the `as` name when the handler ends (this breaks a reference cycle between the exception and its traceback):

  ```python
  try:
      1 / 0
  except ZeroDivisionError as e:
      pass

  print(e)
  ```

  Output:

  ```text
  Traceback (most recent call last):
    File "app.py", line 6, in <module>
      print(e)
            ^
  NameError: name 'e' is not defined
  ```

  If you need the exception later, assign it to another name inside the handler: `error = e`.

- **`return` inside `finally`.** It overrides the value from `try` and silently discards any exception in flight. Python 3.14 warns about it (PEP 765):

  ```python
  def risky():
      try:
          return 1 / 0
      finally:
          return "finally wins"


  print(risky())
  ```

  Output:

  ```text
  app.py:5: SyntaxWarning: 'return' in a 'finally' block
    return "finally wins"
  finally wins
  ```

  The `ZeroDivisionError` vanished without a trace. `break` and `continue` inside `finally` have the same effect and get the same warning.

- **Bare `except:` or `except BaseException:`.** They catch `SystemExit` and `KeyboardInterrupt` and hide all bugs. Use specific types, or `except Exception:` at the top level.
- **Swallowing errors with `except: pass`.** The program continues in a broken state, and nobody knows why. At least log the exception.
- **Returning `None` (or `-1`, or `False`) to signal failure.** Callers forget to check, or check with `if result:` and mistake valid falsy results for errors. Raise an exception instead.

## Summary

- The `try` statement has up to four clauses in a fixed order: `try`, `except` (any number), `else` and `finally` (at most one each). It needs at least one `except` or a `finally`, and `else` requires an `except`.
- `except` runs when a matching exception occurs, `else` runs when no exception occurred, and `finally` always runs, even after `return`, `break` or `continue`.
- An unhandled exception propagates to the caller, and `finally` runs on the way out.
- Keep `try` short. Code that should run only on success belongs in `else`.
- Order `except` clauses from specific to general, and group exceptions with the same handling in a tuple (since Python 3.14, without parentheses when there is no `as`).
- Avoid bare `except:`. It equals `except BaseException:` and catches `SystemExit` and `KeyboardInterrupt`.
- `sys.exception()` (3.11+) and `sys.exc_info()` return the exception being handled, and `traceback.print_exc()` prints its traceback.
- `ExceptionGroup` bundles several exceptions, and `except*` handles each type in the group separately.

## Practice

### Exercise 1: Trace the clauses

Predict the output of the following program, then run it to check.

```python
def load(key):
    data = {"a": "1", "b": "two"}
    try:
        value = int(data[key])
    except KeyError:
        print(key, "-> missing")
        return "missing"
    else:
        print(key, "-> value", value)
        return value
    finally:
        print(key, "-> finally")


for key in ["a", "c", "b"]:
    try:
        print("returned:", load(key))
    except ValueError as e:
        print("caller:", e)
```

### Exercise 2: Fix the misleading handler

The function below should return the length of the first word of `words[index]`, or `"no such item"` if the index does not exist. Call it with `["hello world", ""]` and indexes `0`, `5` and `1`: one of the answers is wrong. Rewrite the function so that only the list lookup is protected, and an empty string produces `"empty item"`.

```python
def first_word_length(words, index):
    try:
        item = words[index]
        return len(item.split()[0])
    except IndexError:
        return "no such item"
```

### Exercise 3: A loop that always counts

Write `process(items)` that loops over a list of strings. For each item it converts the item to `int` and prints `100 / number`. When the item is not a number, it prints `"<item>: not a number"`, and for zero it prints `"<item>: zero"`. Use `continue` in both error handlers. Count **every** processed item, including the failed ones, in a `finally` clause, and print the count at the end. Test it with `["4", "x", "0", "8"]`.

### Exercise 4: Collect all problems

Write `check_order(order)` for a dictionary with `"qty"` and `"price"` keys. It collects problems in a list and raises an `ExceptionGroup("invalid order", problems)` if there are any. A missing key gives a `KeyError(key)`. A `"qty"` that is not a positive `int` gives a `ValueError`. A negative `"price"` gives a `ValueError` too. Handle the group with two `except*` clauses: one prints `"missing: ..."` for each `KeyError`, the other prints `"bad value: ..."` for each `ValueError`. Test with `{"qty": 0}` and with `{"qty": 2, "price": 9.5}`.

## Solutions

### Exercise 1

Output:

```text
a -> value 1
a -> finally
returned: 1
c -> missing
c -> finally
returned: missing
b -> finally
caller: invalid literal for int() with base 10: 'two'
```

For `"a"` the `try` succeeds, so `else` runs and returns `1`, and `finally` runs before the function actually returns. For `"c"` the `KeyError` is handled. For `"b"`, `int("two")` raises a `ValueError` that `load()` does not handle: neither `except` nor `else` runs, `finally` runs, and the exception propagates to the caller's handler.

### Exercise 2

The original returns `"no such item"` for index `1`: the item exists, but `"".split()` is an empty list, and `[0]` on it raises an `IndexError` that the handler mistakes for a missing item.

```python
def first_word_length(words, index):
    try:
        item = words[index]
    except IndexError:
        return "no such item"
    else:
        parts = item.split()
        if not parts:
            return "empty item"
        return len(parts[0])


words = ["hello world", ""]
for index in [0, 5, 1]:
    print(index, first_word_length(words, index))
```

Output:

```text
0 5
5 no such item
1 empty item
```

### Exercise 3

```python
def process(items):
    count = 0
    for item in items:
        try:
            number = int(item)
            result = 100 / number
        except ValueError:
            print(f"{item}: not a number")
            continue
        except ZeroDivisionError:
            print(f"{item}: zero")
            continue
        else:
            print(f"{item}: {result}")
        finally:
            count += 1
    print("processed:", count)


process(["4", "x", "0", "8"])
```

Output:

```text
4: 25.0
x: not a number
0: zero
8: 12.5
processed: 4
```

`continue` leaves the current iteration, but `finally` still runs first, so the failed items are counted too.

### Exercise 4

```python
def check_order(order):
    problems = []
    for key in ("qty", "price"):
        if key not in order:
            problems.append(KeyError(key))
    qty = order.get("qty")
    if qty is not None and (not isinstance(qty, int) or qty <= 0):
        problems.append(ValueError(f"qty must be a positive int, got {qty!r}"))
    price = order.get("price")
    if price is not None and price < 0:
        problems.append(ValueError(f"price must not be negative, got {price!r}"))
    if problems:
        raise ExceptionGroup("invalid order", problems)


for order in [{"qty": 0}, {"qty": 2, "price": 9.5}]:
    print("checking", order)
    try:
        check_order(order)
    except* KeyError as group:
        for e in group.exceptions:
            print("  missing:", e)
    except* ValueError as group:
        for e in group.exceptions:
            print("  bad value:", e)
```

Output:

```text
checking {'qty': 0}
  missing: 'price'
  bad value: qty must be a positive int, got 0
checking {'qty': 2, 'price': 9.5}
```

The first order has two problems of different types, so both `except*` clauses run. The second order is valid: `check_order()` raises nothing, and no handler runs.

---

*Source: [pythontutorial.net — Python Exception Handling](https://www.pythontutorial.net/python-oop/python-exception-handling/). Adapted and expanded for PyJourney.*
