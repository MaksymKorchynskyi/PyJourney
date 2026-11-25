# Python Decorator with Arguments

Some decorators need configuration: how many times to repeat a call, which role is required, how many retries to allow. You pass these settings as arguments, as in `@repeat(3)`. This topic shows how such decorators work: they are **decorator factories**, functions that build and return a decorator.

## What you'll learn

- Why a hard-coded value inside a decorator is a problem
- What a decorator factory is and how `@repeat(3)` is evaluated
- How the three nested layers (factory, decorator, wrapper) share data through closures
- How to write practical parameterised decorators such as access checks
- How to make a decorator that works both with and without arguments
- The typical mistakes with parentheses and how to recognise them

## The problem: a hard-coded setting

Here is a function that prints a message:

```python
def say(message):
    """Print the message.

    Arguments:
        message: the message to show
    """
    print(message)
```

Suppose every call of `say()` must print the message five times. A regular decorator can do that:

```python
from functools import wraps


def repeat(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        result = None
        for _ in range(5):
            result = fn(*args, **kwargs)
        return result

    return wrapper


@repeat
def say(message):
    """Print the message."""
    print(message)


say("Hello")
```

Output:

```text
Hello
Hello
Hello
Hello
Hello
```

It works, but the number `5` is baked into the decorator. If one function must run five times and another ten times, you would need two nearly identical decorators. What you really want is to pass the number when decorating:

```python
@repeat(5)
def say(message):
    ...
```

## How `@repeat(5)` is evaluated

The expression after `@` can be any expression that produces a decorator. Python evaluates it **first**, and then applies the result to the function. So

```python
@repeat(5)
def say(message):
    ...
```

means exactly:

```python
def say(message):
    ...


say = repeat(5)(say)
```

(Both are fragments that assume a `repeat` factory, defined below.)

`repeat(5)` is an ordinary function call. It must **return a decorator**: a function that takes `say` and returns a wrapper. A function that returns a decorator is called a **decorator factory**. Strictly speaking, the new `repeat` is not a decorator itself. It *produces* one.

## Writing a decorator factory

Wrap the old decorator in one more function that receives the arguments:

```python
from functools import wraps


def repeat(times):
    """Call the decorated function `times` times."""

    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            result = None
            for _ in range(times):
                result = fn(*args, **kwargs)
            return result

        return wrapper

    return decorate


@repeat(3)
def say(message):
    """Print the message."""
    print(message)


say("Hello")
```

Output:

```text
Hello
Hello
Hello
```

There are now three layers, each with its own job:

```text
repeat(times)                  factory: receives the decorator's arguments
  |
  +-- decorate(fn)             decorator: receives the function to wrap
        |
        +-- wrapper(*args, **kwargs)   runs on every call of say()
```

- `repeat(3)` runs once, at definition time, and returns `decorate`. The value `3` is captured in a closure.
- `decorate(say)` runs immediately afterwards and returns `wrapper`. Now `fn` is captured too.
- `wrapper(...)` runs on every call. It reads both `times` and `fn` from its enclosing scopes.

You can see the captured values in the wrapper's free variables:

```python
from functools import wraps


def repeat(times):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            result = None
            for _ in range(times):
                result = fn(*args, **kwargs)
            return result

        return wrapper

    return decorate


@repeat(3)
def say(message):
    print(message)


print(say.__name__)
print(say.__code__.co_freevars)
print(say.__closure__[1].cell_contents)
```

Output:

```text
say
('fn', 'times')
3
```

The cells in `__closure__` follow the order of `co_freevars`, so index `1` is the cell for `times`.

Because each call of `repeat(...)` creates a new closure, different functions can use different settings:

```python
from functools import wraps


def repeat(times):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            result = None
            for _ in range(times):
                result = fn(*args, **kwargs)
            return result

        return wrapper

    return decorate


@repeat(2)
def beep():
    print("beep")


@repeat(4)
def dot():
    print(".", end="")


beep()
dot()
print()
```

Output:

```text
beep
beep
....
```

> **Note:** `result = None` before the loop matters. Without it, `@repeat(0)` would never assign `result`, and `return result` would raise `UnboundLocalError`.

## A practical example: access control

Decorator arguments are often used for rules that differ from function to function. This decorator checks that the user passed as the first argument has a given role:

```python
from functools import wraps


def require_role(role):
    def decorate(fn):
        @wraps(fn)
        def wrapper(user, *args, **kwargs):
            if role not in user["roles"]:
                raise PermissionError(f"{user['name']} needs role {role!r}")
            return fn(user, *args, **kwargs)

        return wrapper

    return decorate


@require_role("admin")
def delete_note(user, note_id):
    return f"note {note_id} deleted by {user['name']}"


@require_role("editor")
def edit_note(user, note_id, text):
    return f"note {note_id} now says {text!r}"


admin = {"name": "Olena", "roles": {"admin", "editor"}}
guest = {"name": "Max", "roles": {"viewer"}}

print(delete_note(admin, 42))
print(edit_note(admin, 7, text="Hi"))
try:
    delete_note(guest, 42)
except PermissionError as error:
    print("PermissionError:", error)
```

Output:

```text
note 42 deleted by Olena
note 7 now says 'Hi'
PermissionError: Max needs role 'admin'
```

Web frameworks use the same pattern: `@app.route("/notes", methods=["GET"])` is a decorator factory call.

You have already used decorator factories from the standard library: `@functools.wraps(fn)` and `@functools.lru_cache(maxsize=128)` both take arguments and return the actual decorator.

## Decorators with optional arguments

Sometimes you want both `@repeat` (use a default) and `@repeat(times=3)` to work. The trick is to check whether the decorator received a function as its first argument:

```python
from functools import wraps


def repeat(fn=None, *, times=2):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            result = None
            for _ in range(times):
                result = fn(*args, **kwargs)
            return result

        return wrapper

    if fn is None:
        # used as @repeat(times=...): return the decorator
        return decorate
    # used as @repeat: decorate the function right away
    return decorate(fn)


@repeat
def ping():
    print("ping")


@repeat(times=3)
def pong():
    print("pong")


ping()
pong()
```

Output:

```text
ping
ping
pong
pong
pong
```

The `*` makes `times` a **keyword-only** argument. That is essential: if `times` were positional, `@repeat(3)` would pass `3` as `fn`, and the check `fn is None` could not tell a number from a function.

## Common mistakes

- **Forgetting the parentheses.** With a factory, `@repeat` (without `(3)`) passes the function itself as `times`. Python does not complain at definition time, and the bug shows up later in a confusing way:

  ```python
  from functools import wraps


  def repeat(times):
      def decorate(fn):
          @wraps(fn)
          def wrapper(*args, **kwargs):
              result = None
              for _ in range(times):
                  result = fn(*args, **kwargs)
              return result

          return wrapper

      return decorate


  @repeat
  def say(message):
      print(message)


  result = say("Hello")
  print(say.__name__)
  print(result.__name__)
  ```

  Output:

  ```text
  decorate
  wrapper
  ```

  `say` is now the inner `decorate` function. Calling it prints nothing: it "decorates" the string `"Hello"` and returns a wrapper.

- **Adding parentheses but no arguments.** `@repeat()` calls the factory without its required argument and fails with `TypeError: repeat() missing 1 required positional argument: 'times'`.
- **Mixing up the layers.** Arguments of the decorator (`times`) belong to the outermost function, the decorated function (`fn`) to the middle one, and the call arguments (`*args, **kwargs`) to the innermost one. Putting `fn` in the outer function is the most common slip.
- **Forgetting to return a layer.** Each of the two outer functions must `return` the next one (`return wrapper`, `return decorate`). Missing either one turns the decorated name into `None`.
- **Not initialising the result.** A loop that might run zero times leaves `result` unassigned. Initialise it before the loop.

## Summary

- A decorator with arguments is really a **decorator factory**: a function that takes the arguments and returns a decorator.
- `@factory(args)` above `def f` means `f = factory(args)(f)`.
- A parameterised decorator has three layers: factory (receives the arguments), decorator (receives the function), wrapper (runs on every call).
- Closures carry both the arguments and the function into the wrapper, and each factory call creates an independent closure.
- Keep using `functools.wraps(fn)` in the innermost layer.
- To support both `@deco` and `@deco(option=...)`, accept `fn=None` plus keyword-only options and check which form was used.

## Practice

### Exercise 1: Round the result

Write a decorator factory `round_result(digits)` that rounds the number returned by the decorated function to `digits` decimal places. Decorate `average(*numbers)` with `@round_result(2)` and print `average(1, 2, 2)` and `average.__name__`.

### Exercise 2: Retry on failure

Write `retry(attempts, exceptions=(Exception,))`. The wrapper calls the function up to `attempts` times. If a call raises one of `exceptions`, print `attempt N failed: <error>` and try again. If the last attempt also fails, re-raise its exception. Test it with a function that fails twice and succeeds on the third call, and with one that always fails.

### Exercise 3: Optional arguments

Write a decorator `exclaim` that adds exclamation marks to the string returned by a function. It must work in both forms: `@exclaim` adds one `"!"`, and `@exclaim(count=3)` adds three. Make `count` keyword-only.

## Solutions

### Exercise 1

```python
from functools import wraps


def round_result(digits):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            return round(fn(*args, **kwargs), digits)

        return wrapper

    return decorate


@round_result(2)
def average(*numbers):
    return sum(numbers) / len(numbers)


print(average(1, 2, 2))
print(average.__name__)
```

Output:

```text
1.67
average
```

### Exercise 2

```python
from functools import wraps


def retry(attempts, exceptions=(Exception,)):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            for attempt in range(1, attempts + 1):
                try:
                    return fn(*args, **kwargs)
                except exceptions as error:
                    print(f"attempt {attempt} failed: {error}")
                    if attempt == attempts:
                        raise

        return wrapper

    return decorate


calls = 0


@retry(3, exceptions=(ConnectionError,))
def fetch():
    global calls
    calls += 1
    if calls < 3:
        raise ConnectionError("server busy")
    return "data"


@retry(2)
def broken():
    raise ValueError("bad input")


print(fetch())
try:
    broken()
except ValueError as error:
    print("gave up:", error)
```

Output:

```text
attempt 1 failed: server busy
attempt 2 failed: server busy
data
attempt 1 failed: bad input
attempt 2 failed: bad input
gave up: bad input
```

The bare `raise` re-raises the exception currently being handled, with its original traceback. `global calls` is used here only to simulate a flaky server.

### Exercise 3

```python
from functools import wraps


def exclaim(fn=None, *, count=1):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            return fn(*args, **kwargs) + "!" * count

        return wrapper

    if fn is None:
        return decorate
    return decorate(fn)


@exclaim
def hello(name):
    return f"Hello, {name}"


@exclaim(count=3)
def warn(text):
    return text.upper()


print(hello("Max"))
print(warn("careful"))
print(warn.__name__)
```

Output:

```text
Hello, Max!
CAREFUL!!!
warn
```

---

*Source: [pythontutorial.net — Python Decorator with Arguments](https://www.pythontutorial.net/advanced-python/python-decorator-arguments/). Adapted and expanded for PyJourney.*
