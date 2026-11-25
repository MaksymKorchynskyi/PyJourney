# Exceptions

When something goes wrong while a program runs (an index out of range, a division by zero, a missing file), Python **raises an exception**. An exception is an ordinary object that describes the error. If nobody handles it, the program stops and prints a traceback. If you handle it, the program can react and keep running. This topic explains what exceptions are, how their classes are organized, and how to catch them.

## What you'll learn

- What happens when an exception is raised and nobody handles it
- How to read a traceback
- That exceptions are objects, and what information they carry (`type`, `args`, message)
- How built-in exception classes form a hierarchy under `BaseException` and `Exception`
- How `except` matches an exception and all its subclasses
- Why you should catch exceptions as specifically as possible, from specific to general

## What happens when an error occurs

This code asks for the fourth element of a three-element list:

```python
colors = ["red", "green", "blue"]

print(colors[3])
print("This line never runs")
```

Output:

```text
Traceback (most recent call last):
  File "app.py", line 3, in <module>
    print(colors[3])
          ~~~~~~^^^
IndexError: list index out of range
```

The invalid index made Python **raise** an `IndexError`. Nothing handled it, so Python stopped the program and printed a **traceback**. The second `print()` never ran.

### Reading a traceback

Read a traceback from the bottom up:

- The **last line** is the most important: the exception type (`IndexError`) and its message (`list index out of range`).
- Above it are the **frames**: the chain of calls that led to the error, with the file, line number and function (`<module>` means top-level code). The most recent call is at the bottom, which is what "most recent call last" means.
- Since Python 3.11 the `~~~~~~^^^` markers point at the exact part of the line that failed. Since Python 3.13 tracebacks are also colored when printed to a terminal.

When the error happens inside a function, you see one frame per call:

```python
def division(a, b):
    return a / b


c = division(10, 0)
```

Output:

```text
Traceback (most recent call last):
  File "app.py", line 5, in <module>
    c = division(10, 0)
  File "app.py", line 2, in division
    return a / b
           ~~^~~
ZeroDivisionError: division by zero
```

Line 5 called `division()`, and inside it line 2 failed. The bottom frame shows where the exception was raised. The frames above it show how the program got there.

## Handling an exception with `try...except`

To handle an exception, put the risky code in a `try` block and the reaction in an `except` block:

```python
colors = ["red", "green", "blue"]

try:
    print(colors[3])
except IndexError as e:
    print(e)

print("Continue to run")
```

Output:

```text
list index out of range
Continue to run
```

Python runs the `try` block. When `colors[3]` raises `IndexError`, the rest of the `try` block is skipped and Python looks for a matching `except` clause. `except IndexError as e` matches, so the exception object is bound to the name `e` and the handler runs. After that the program simply continues.

> **Note:** Some tutorials show this example printing `<class 'IndexError'> - list index out of range`. `print(e)` prints only the message. To see the class, print `type(e)` as well, as in the next example.

## Exceptions are objects

The `e` in `except IndexError as e` is an instance of the class `IndexError`, and you can inspect it like any other object:

```python
colors = ["red", "green", "blue"]

try:
    print(colors[3])
except IndexError as e:
    print(type(e))
    print(type(e).__name__)
    print(e.args)
    print(str(e))
    print(repr(e))
```

Output:

```text
<class 'IndexError'>
IndexError
('list index out of range',)
list index out of range
IndexError('list index out of range')
```

- `type(e)` (or `e.__class__`) is the exception's class.
- `e.args` is the tuple of arguments the exception was created with. Usually it contains just the message.
- `str(e)` gives the message, `repr(e)` shows how the object could be recreated.

You can create exception objects yourself, just like any other objects. Creating one does not raise it. The `raise` statement does that (see the topic *Raise Exceptions*):

```python
error = ValueError("invalid age", -5)
print(type(error).__name__)
print(error.args)
print(isinstance(error, Exception))
```

Output:

```text
ValueError
('invalid age', -5)
True
```

## The exception hierarchy

All exception classes inherit from `BaseException`. Almost all of them, including every error you will normally handle, inherit from its subclass `Exception`. Here is an abridged view of the built-in hierarchy:

```text
BaseException
 +-- BaseExceptionGroup
 +-- GeneratorExit
 +-- KeyboardInterrupt
 +-- SystemExit
 +-- Exception
      +-- ArithmeticError
      |    +-- OverflowError
      |    +-- ZeroDivisionError
      +-- AssertionError
      +-- AttributeError
      +-- ExceptionGroup
      +-- ImportError
      |    +-- ModuleNotFoundError
      +-- LookupError
      |    +-- IndexError
      |    +-- KeyError
      +-- NameError
      |    +-- UnboundLocalError
      +-- OSError
      |    +-- FileNotFoundError
      |    +-- PermissionError
      |    +-- TimeoutError
      +-- RuntimeError
      |    +-- NotImplementedError
      |    +-- RecursionError
      +-- StopIteration
      +-- TypeError
      +-- ValueError
           +-- UnicodeError
```

The full tree is in the Python documentation ("Exception hierarchy" in the built-in exceptions page). You can also ask Python for the ancestors of any exception class:

```python
for cls in IndexError.__mro__:
    print(cls.__name__)
```

Output:

```text
IndexError
LookupError
Exception
BaseException
object
```

### Why `BaseException` and `Exception` are separate

The four direct children of `BaseException` are not program errors:

- `SystemExit` is raised by `sys.exit()` to end the program.
- `KeyboardInterrupt` is raised when the user presses Ctrl+C.
- `GeneratorExit` is used internally to close generators.
- `BaseExceptionGroup` is the base of exception groups (see below).

You almost never want to "handle" these by accident. Because they are outside `Exception`, the common handler `except Exception:` lets them pass, so Ctrl+C and `sys.exit()` keep working:

```python
print(issubclass(KeyboardInterrupt, Exception))
print(issubclass(KeyboardInterrupt, BaseException))
print(issubclass(SystemExit, Exception))
print(issubclass(ExceptionGroup, Exception))
```

Output:

```text
False
True
False
True
```

`ExceptionGroup` (Python 3.11+) bundles several exceptions into one, for example when several concurrent tasks fail at the same time. It is handled with the special `except*` syntax, covered in the next topic, *Exception Handling*.

### Common built-in exceptions

| Exception | Typical cause |
|---|---|
| `ValueError` | right type, wrong value: `int("abc")` |
| `TypeError` | wrong type: `"10" / 2`, calling a function with wrong arguments |
| `IndexError` | sequence index out of range: `[1, 2][5]` |
| `KeyError` | missing dictionary key: `{}["x"]` |
| `ZeroDivisionError` | division or modulo by zero |
| `AttributeError` | missing attribute or method: `None.upper()` |
| `NameError` | using a name that is not defined |
| `FileNotFoundError` | opening a file that does not exist |
| `ModuleNotFoundError` | importing a module that is not installed |

## Catching a whole family of exceptions

An `except` clause matches the class it names **and all its subclasses**. `IndexError` is a subclass of `LookupError`, which is a subclass of `Exception`, so all three handlers below catch it:

```python
colors = ["red", "green", "blue"]

try:
    print(colors[3])
except LookupError as e:
    print(e.__class__, "-", e)

try:
    print(colors[3])
except Exception as e:
    print(e.__class__, "-", e)

print("Continue to run")
```

Output:

```text
<class 'IndexError'> - list index out of range
<class 'IndexError'> - list index out of range
Continue to run
```

The exception is still an `IndexError`. Catching `LookupError` is useful when you want to treat a missing index and a missing dictionary key (`KeyError`) the same way.

## Catch as specifically as you can

A function that divides two numbers fails when `b` is zero:

```python
def division(a, b):
    try:
        return {"success": True, "message": "OK", "result": a / b}
    except ZeroDivisionError:
        return {"success": False, "message": "b cannot be zero", "result": None}


print(division(10, 2))
print(division(10, 0))
```

Output:

```text
{'success': True, 'message': 'OK', 'result': 5.0}
{'success': False, 'message': 'b cannot be zero', 'result': None}
```

The function returns a dictionary in both cases: `success` says whether the division worked, `message` explains the outcome, and `result` holds the quotient or `None`. (In the next topics you will see why raising an exception is often better than returning such a dictionary.)

Now suppose someone "simplifies" the handler to `except Exception`:

```python
def division(a, b):
    try:
        return {"success": True, "message": "OK", "result": a / b}
    except Exception:
        return {"success": False, "message": "b cannot be zero", "result": None}


print(division(10, 0))
print(division("10", "2"))
```

Output:

```text
{'success': False, 'message': 'b cannot be zero', 'result': None}
{'success': False, 'message': 'b cannot be zero', 'result': None}
```

The second call failed with a `TypeError` (you cannot divide strings), but the broad handler caught it and reported a **wrong reason**. Broad handlers hide bugs. The fix is to handle each expected exception separately, **from the most specific to the most general**:

```python
def division(a, b):
    try:
        return {"success": True, "message": "OK", "result": a / b}
    except TypeError:
        return {"success": False, "message": "Both a & b must be numbers", "result": None}
    except ZeroDivisionError:
        return {"success": False, "message": "b cannot be zero", "result": None}
    except Exception as e:
        return {"success": False, "message": str(e), "result": None}


print(division(10, 4))
print(division("10", "2"))
print(division(10, 0))
```

Output:

```text
{'success': True, 'message': 'OK', 'result': 2.5}
{'success': False, 'message': 'Both a & b must be numbers', 'result': None}
{'success': False, 'message': 'b cannot be zero', 'result': None}
```

Python checks the `except` clauses from top to bottom and runs the **first** one that matches. A general clause such as `except Exception` must therefore come last, otherwise it would catch everything before the specific clauses get a chance.

When several exceptions need the same reaction, list them in one clause as a tuple:

```python
def division(a, b):
    try:
        return {"success": True, "message": "OK", "result": a / b}
    except (TypeError, ZeroDivisionError) as e:
        return {"success": False, "message": str(e), "result": None}


print(division(10, 0))
print(division("10", "2"))
```

Output:

```text
{'success': False, 'message': 'division by zero', 'result': None}
{'success': False, 'message': "unsupported operand type(s) for /: 'str' and 'str'", 'result': None}
```

> **Note:** The original tutorial wrote `except (TypeError, ZeroDivisionError, Exception)`. Adding `Exception` to the tuple makes the other two entries pointless, because `Exception` already matches both of them, and it brings back the "hide every bug" problem.

## Two styles: LBYL and EAFP

There are two ways to deal with a situation that might fail:

```python
prices = {"apple": 1.2, "pear": 0.9}

# LBYL: "look before you leap"
if "plum" in prices:
    print(prices["plum"])
else:
    print("no price for plum")

# EAFP: "easier to ask forgiveness than permission"
try:
    print(prices["plum"])
except KeyError:
    print("no price for plum")
```

Output:

```text
no price for plum
no price for plum
```

Python code often prefers EAFP: just try the operation and handle the exception. It avoids checking twice, and it is the only reliable option when the situation can change between the check and the action (for example, a file deleted by another program right after you checked that it exists). For simple cases like this one, `prices.get("plum")` is even shorter.

## Common mistakes

- **Catching `Exception` (or everything) when you expect one specific error.** It silently swallows unrelated bugs, like the `TypeError` above that was reported as "b cannot be zero".
- **Putting a general `except` before a specific one.** The specific clause becomes unreachable, because Python runs the first matching clause.
- **Catching `BaseException` or using a bare `except:`.** This also catches `KeyboardInterrupt` and `SystemExit`, so the program may ignore Ctrl+C or refuse to exit.
- **Reading a traceback from the top.** Start at the last line: it names the exception and the message. The frames above show how you got there.
- **Printing only `e` and losing the type.** `print(e)` shows the message only. When you log an error, include `type(e).__name__` too, or use `repr(e)`.

## Summary

- An exception is an object that describes an error. When an exception is raised and not handled, the program stops and prints a traceback.
- Read tracebacks from the bottom: exception type and message first, then the chain of calls that led to it.
- `try...except` handles an exception, and the program continues after the `try` statement.
- Every exception class inherits from `BaseException`. Program errors inherit from `Exception`, while `SystemExit`, `KeyboardInterrupt` and `GeneratorExit` do not.
- An `except` clause catches the named class and all its subclasses.
- Catch exceptions as specifically as possible, order `except` clauses from specific to general, and group exceptions that need the same handling in a tuple.

## Practice

### Exercise 1: Which handler runs?

Predict the output, then run the code to check.

```python
def check(value):
    data = {"a": 1}
    try:
        if value == 1:
            return data["b"]
        if value == 2:
            return int("x")
        return 10 / 0
    except LookupError:
        return "lookup problem"
    except ArithmeticError:
        return "math problem"
    except Exception as e:
        return f"other problem: {type(e).__name__}"


for v in (1, 2, 3):
    print(v, check(v))
```

### Exercise 2: A safe conversion

Write a function `safe_int(text, default=0)` that converts `text` to an `int` and returns `default` when the conversion fails. It must handle both invalid strings (like `"abc"` or `"4.5"`) and `None`. Catch only the exceptions that can really occur.

### Exercise 3: Where does it belong?

Write a function `exception_path(exc)` that accepts an exception class **or** an exception instance and returns its ancestors as a string, stopping at `BaseException`. For example, `exception_path(KeyError)` returns `"KeyError -> LookupError -> Exception -> BaseException"`. Test it with `ModuleNotFoundError`, `KeyboardInterrupt` and the exception you get when opening a file that does not exist.

### Exercise 4: Average with error reporting

In the style of the `division()` function, write `average(values)` that returns a dictionary with `success`, `message` and `result`. Report `"no values"` for an empty list and `"all values must be numbers"` when the list contains something that is not a number.

## Solutions

### Exercise 1

Output:

```text
1 lookup problem
2 other problem: ValueError
3 math problem
```

`data["b"]` raises `KeyError`, a subclass of `LookupError`. `int("x")` raises `ValueError`, which matches neither of the first two clauses and falls through to `Exception`. `10 / 0` raises `ZeroDivisionError`, a subclass of `ArithmeticError`.

### Exercise 2

```python
def safe_int(text, default=0):
    try:
        return int(text)
    except (ValueError, TypeError):
        return default


for value in ["42", " 7 ", "4.5", "abc", None]:
    print(repr(value), "->", safe_int(value))
print(safe_int("oops", default=-1))
```

Output:

```text
'42' -> 42
' 7 ' -> 7
'4.5' -> 0
'abc' -> 0
None -> 0
-1
```

`int()` raises `ValueError` for strings that are not whole numbers (it tolerates surrounding spaces) and `TypeError` for `None`.

### Exercise 3

```python
def exception_path(exc):
    cls = exc if isinstance(exc, type) else type(exc)
    names = []
    for klass in cls.__mro__:
        names.append(klass.__name__)
        if klass is BaseException:
            break
    return " -> ".join(names)


print(exception_path(KeyError))
print(exception_path(ModuleNotFoundError))
print(exception_path(KeyboardInterrupt))

try:
    open("missing.txt")
except OSError as error:
    print(exception_path(error))
```

Output:

```text
KeyError -> LookupError -> Exception -> BaseException
ModuleNotFoundError -> ImportError -> Exception -> BaseException
KeyboardInterrupt -> BaseException
FileNotFoundError -> OSError -> Exception -> BaseException
```

`isinstance(exc, type)` tells a class from an instance. Note that `except OSError` caught a `FileNotFoundError`, a subclass.

### Exercise 4

```python
def average(values):
    try:
        result = sum(values) / len(values)
    except ZeroDivisionError:
        return {"success": False, "message": "no values", "result": None}
    except TypeError:
        return {"success": False, "message": "all values must be numbers", "result": None}
    return {"success": True, "message": "OK", "result": result}


print(average([4, 5, 9]))
print(average([]))
print(average([1, "2", 3]))
```

Output:

```text
{'success': True, 'message': 'OK', 'result': 6.0}
{'success': False, 'message': 'no values', 'result': None}
{'success': False, 'message': 'all values must be numbers', 'result': None}
```

For an empty list `sum()` returns `0` and `len()` returns `0`, so the division raises `ZeroDivisionError`. Adding a string to a number inside `sum()` raises `TypeError`.

---

*Source: [pythontutorial.net — Python Exceptions](https://www.pythontutorial.net/python-oop/python-exceptions/). Adapted and expanded for PyJourney.*
