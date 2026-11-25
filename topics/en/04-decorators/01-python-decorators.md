# Python Decorators

A **decorator** is a function that takes another function and returns a new function with extended behaviour, without changing the original function's code. Decorators let you add logging, timing, caching, access checks or formatting to many functions with a single line, and you meet them constantly in frameworks (`@app.route`, `@pytest.fixture`) and in the standard library (`@property`, `@functools.cache`).

## What you'll learn

- Why functions can be passed to and returned from other functions
- How to write a decorator with an inner `wrapper` function and `*args, **kwargs`
- What the `@decorator` syntax does and when the decoration happens
- Why decorated functions lose their name and docstring, and how `functools.wraps` fixes it
- How several decorators stack and in which order they run
- Typical real-world decorators: timing, logging, counting calls and registration

## Functions are objects

Decorators rely on one fact: in Python, functions are ordinary objects. You can assign them to variables, pass them as arguments, and return them from other functions:

```python
def shout(text):
    return text.upper() + "!"


def apply(fn, value):
    return fn(value)


yell = shout
print(yell("hello"))
print(apply(shout, "decorators"))
```

Output:

```text
HELLO!
DECORATORS!
```

Notice `yell = shout` without parentheses: this binds a second name to the same function object. `shout("hello")` with parentheses *calls* it. A function that takes or returns other functions is called a **higher-order function**. A decorator is a higher-order function that does both.

## A first decorator

Start with a function that calculates the price of an item including tax:

```python
def net_price(price, tax):
    """Calculate the price including tax.

    Arguments:
        price: the selling price
        tax: value added tax or sales tax, e.g. 0.05 for 5%
    """
    return price * (1 + tax)


print(net_price(100, 0.05))
```

Output:

```text
105.0
```

Now suppose every price must be shown in US dollars, so `105.0` becomes `$105.00`. You could edit `net_price`, but then it would return a string, and every other price function would need the same edit. A decorator adds the formatting from the outside.

A decorator is a function that **takes a function as an argument**:

```python
def currency(fn):
    pass
```

and **returns another function**, traditionally called `wrapper`:

```python
def currency(fn):
    def wrapper(*args, **kwargs):
        return fn(*args, **kwargs)

    return wrapper
```

`wrapper` accepts `*args` (any positional arguments) and `**kwargs` (any keyword arguments) and passes them on unchanged. This makes the decorator work for functions with any signature. At this point `wrapper` behaves exactly like `fn`. Now add the extra behaviour: call `fn`, take its result, and format it:

```python
def currency(fn):
    def wrapper(*args, **kwargs):
        result = fn(*args, **kwargs)
        return f"${result:.2f}"

    return wrapper


def net_price(price, tax):
    """Calculate the price including tax."""
    return price * (1 + tax)


net_price = currency(net_price)
print(net_price(100, 0.05))
print(net_price(100, 0.1))
```

Output:

```text
$105.00
$110.00
```

The format spec `:.2f` rounds to two decimals. Without it, `100 * 1.1` would show its floating-point artefact: `$110.00000000000001`.

`net_price = currency(net_price)` passes the original function to the decorator and rebinds the name `net_price` to the returned `wrapper`. From now on, calling `net_price(...)` calls `wrapper(...)`, which calls the original function through its free variable `fn`.

```text
net_price ---> wrapper(*args, **kwargs)
                  |
                  |  free variable fn
                  v
               original net_price(price, tax)
```

So a decorator is:

- a function that takes the original function as an argument and returns a new function;
- the new function (`wrapper`) usually accepts any combination of positional and keyword arguments;
- `wrapper` calls the original function with those arguments, does something before and/or after the call, and returns a result.

`wrapper` is a **closure**: it references `fn` from the enclosing scope of the decorator, and that reference survives after `currency()` has returned.

## The `@` syntax

Writing `net_price = currency(net_price)` after every definition is repetitive and easy to forget. Python offers a shorter form. These two snippets are equivalent:

```python
def fn():
    pass


fn = decorate(fn)
```

```python
@decorate
def fn():
    pass
```

(Both are fragments: `decorate` stands for any decorator.)

With the `@` syntax the decorator sits right above the definition, so the reader sees immediately that the function is modified:

```python
def currency(fn):
    def wrapper(*args, **kwargs):
        result = fn(*args, **kwargs)
        return f"${result:.2f}"

    return wrapper


@currency
def net_price(price, tax):
    """Calculate the price including tax."""
    return price * (1 + tax)


print(net_price(100, 0.05))
```

Output:

```text
$105.00
```

### When does the decoration happen?

The decorator runs **once, when the `def` statement executes**, usually at import time. The wrapper then runs on **every call**:

```python
def announce(fn):
    print(f"decorating {fn.__name__}")
    return fn


@announce
def hello():
    print("hello!")


print("before the first call")
hello()
hello()
```

Output:

```text
decorating hello
before the first call
hello!
hello!
```

This decorator also shows that a decorator may return the original function unchanged. That is useful for **registration**, where you only want to record the function somewhere:

```python
commands = {}


def command(fn):
    commands[fn.__name__] = fn
    return fn


@command
def start():
    return "starting"


@command
def stop():
    return "stopping"


print(list(commands))
print(commands["stop"]())
```

Output:

```text
['start', 'stop']
stopping
```

## Keeping the function's identity: `functools.wraps`

Decoration replaces the function with `wrapper`, and that has a side effect: the original name, docstring and signature are lost.

```python
import inspect


def currency(fn):
    def wrapper(*args, **kwargs):
        result = fn(*args, **kwargs)
        return f"${result:.2f}"

    return wrapper


@currency
def net_price(price, tax):
    """Calculate the price including tax."""
    return price * (1 + tax)


print(net_price.__name__)
print(net_price.__doc__)
print(inspect.signature(net_price))
help(net_price)
```

Output:

```text
wrapper
None
(*args, **kwargs)
Help on function wrapper in module __main__:

wrapper(*args, **kwargs)
```

Debuggers, logs, documentation tools, `help()` and testing frameworks all see `wrapper` instead of `net_price`. The fix is the `wraps` decorator from the standard `functools` module. Apply it to the wrapper and pass it the original function:

```python
import inspect
from functools import wraps


def currency(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        result = fn(*args, **kwargs)
        return f"${result:.2f}"

    return wrapper


@currency
def net_price(price, tax):
    """Calculate the price including tax.

    Arguments:
        price: the selling price
        tax: value added tax or sales tax
    """
    return price * (1 + tax)


help(net_price)
print(net_price.__name__)
print(inspect.signature(net_price))
print(net_price.__wrapped__(100, 0.05))
```

Output:

```text
Help on function net_price in module __main__:

net_price(price, tax)
    Calculate the price including tax.

    Arguments:
        price: the selling price
        tax: value added tax or sales tax

net_price
(price, tax)
105.0
```

`@wraps(fn)` copies `__name__`, `__qualname__`, `__doc__`, `__module__` and `__dict__` (plus a few other attributes) from `fn` to `wrapper`, and stores the original function in `wrapper.__wrapped__`. `inspect.signature()` follows `__wrapped__` to report the real signature, and you can call `__wrapped__` to bypass the decorator, which is handy in tests.

> **Tip:** Use `@wraps(fn)` in every decorator you write. It costs one line and saves a lot of confusion later.

Notice that `wraps(fn)` is itself a decorator that takes an argument. The next topic explains how such decorators are built.

## Stacking decorators

You can apply several decorators to one function. They are applied **from the bottom up** (the one closest to `def` first), so the top decorator ends up as the outermost layer:

```python
from functools import wraps


def stars(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        return "**" + fn(*args, **kwargs) + "**"

    return wrapper


def brackets(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        return "[" + fn(*args, **kwargs) + "]"

    return wrapper


@stars
@brackets
def greet(name):
    return f"Hello, {name}"


print(greet("Olena"))
```

Output:

```text
**[Hello, Olena]**
```

The stack is equivalent to `greet = stars(brackets(greet))`. When `greet("Olena")` runs, the outer `stars` wrapper is entered first, it calls the `brackets` wrapper, which calls the original function. The results then travel back outwards: brackets are added first, stars last. Swap the decorators and you get `[**Hello, Olena**]`.

## Practical decorators

### Timing a function

```python
import time
from functools import wraps


def timer(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            elapsed = time.perf_counter() - start
            print(f"{fn.__name__} took {elapsed:.4f} s")

    return wrapper


@timer
def slow_sum(n):
    return sum(range(n))


print(slow_sum(1_000_000))
```

Output (the time varies):

```text
slow_sum took 0.0061 s
499999500000
```

The `try`/`finally` makes sure the time is reported even if the function raises an exception. The timing line comes first because `print(slow_sum(...))` can print only after the call, wrapper included, has finished.

### Counting calls

A function is an object, so a wrapper can keep data in its own attributes:

```python
from functools import wraps


def count_calls(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        wrapper.calls += 1
        return fn(*args, **kwargs)

    wrapper.calls = 0
    return wrapper


@count_calls
def ping():
    return "pong"


ping()
ping()
ping()
print(ping.calls)
```

Output:

```text
3
```

### Decorators in the standard library

You will often use ready-made decorators:

- `@property`, `@staticmethod`, `@classmethod` change how methods work in a class.
- `@functools.cache` and `@functools.lru_cache` remember results of expensive calls.
- `@dataclasses.dataclass` generates `__init__`, `__repr__` and `__eq__` for a class.
- `@contextlib.contextmanager` turns a generator into a context manager.

## Common mistakes

- **Forgetting to return the result.** If `wrapper` calls `fn(*args, **kwargs)` but does not `return` it, every decorated function silently returns `None`.
- **Forgetting to return the wrapper.** A decorator without `return wrapper` returns `None`, so the decorated name becomes `None` and calling it raises `TypeError: 'NoneType' object is not callable`.
- **Calling the function instead of passing it.** `currency(net_price())` passes the *result* of a call, not the function. Decorators receive the function object itself.
- **Hard-coding the signature.** `def wrapper(price, tax):` works for one function only. Use `*args, **kwargs` so the decorator works everywhere, including methods, where `self` simply arrives as the first positional argument.
- **Skipping `functools.wraps`.** Without it, every decorated function is named `wrapper`, has no docstring, and shows the wrong signature.
- **Writing `@currency()` with parentheses.** That calls `currency()` with no arguments first and fails. Parentheses are only for decorators that take arguments (next topic).

## Summary

- Functions are objects: they can be passed to and returned from other functions.
- A decorator takes a function and returns a new function (usually a closure named `wrapper`) that adds behaviour before and/or after calling the original.
- `@decorator` above a `def` is shorthand for `fn = decorator(fn)`. It runs once, when the function is defined.
- Use `*args, **kwargs` in the wrapper and return the original function's result.
- `@functools.wraps(fn)` preserves the name, docstring and signature, and exposes the original as `__wrapped__`.
- Stacked decorators are applied bottom-up, and the top one becomes the outermost layer.
- Common uses: formatting, timing, logging, counting, caching, registration and access control.

## Practice

### Exercise 1: Uppercase results

Write a decorator `uppercase` that converts the string returned by the decorated function to upper case. Use `functools.wraps`. Decorate `greet(name)`, which returns `f"Hello, {name}"`, and print `greet("max")` and `greet.__name__`.

### Exercise 2: Log every call

Write a decorator `log_calls` that prints the function name with its arguments before the call and the returned value after it. For `add(2, b=3)` it should print:

```text
calling add(2, b=3)
add returned 5
```

Hint: build the argument list from `repr(arg)` for positional arguments and `f"{key}={value!r}"` for keyword arguments.

### Exercise 3: Only positive numbers

Write a decorator `positive_args` that raises `ValueError("all arguments must be positive")` if any positional argument is a number less than or equal to zero, and otherwise calls the function. Decorate `area(width, height)` and demonstrate both a successful call and a rejected one.

### Exercise 4: Predict the stacking order

Without running it, predict the output. Then run it and explain the order of the lines.

```python
def first(fn):
    print("decorating with first")

    def wrapper():
        print("first: before")
        fn()
        print("first: after")

    return wrapper


def second(fn):
    print("decorating with second")

    def wrapper():
        print("second: before")
        fn()
        print("second: after")

    return wrapper


@first
@second
def task():
    print("task runs")


print("--- calling ---")
task()
```

## Solutions

### Exercise 1

```python
from functools import wraps


def uppercase(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        return fn(*args, **kwargs).upper()

    return wrapper


@uppercase
def greet(name):
    return f"Hello, {name}"


print(greet("max"))
print(greet.__name__)
```

Output:

```text
HELLO, MAX
greet
```

### Exercise 2

```python
from functools import wraps


def log_calls(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        parts = [repr(arg) for arg in args]
        parts += [f"{key}={value!r}" for key, value in kwargs.items()]
        print(f"calling {fn.__name__}({', '.join(parts)})")
        result = fn(*args, **kwargs)
        print(f"{fn.__name__} returned {result!r}")
        return result

    return wrapper


@log_calls
def add(a, b):
    return a + b


@log_calls
def greet(name, punctuation="!"):
    return f"Hi, {name}{punctuation}"


add(2, b=3)
greet("Olena")
```

Output:

```text
calling add(2, b=3)
add returned 5
calling greet('Olena')
greet returned 'Hi, Olena!'
```

`repr()` puts quotes around strings, which makes the log unambiguous.

### Exercise 3

```python
from functools import wraps


def positive_args(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        for arg in args:
            if isinstance(arg, (int, float)) and arg <= 0:
                raise ValueError("all arguments must be positive")
        return fn(*args, **kwargs)

    return wrapper


@positive_args
def area(width, height):
    return width * height


print(area(3, 4))
try:
    area(3, -4)
except ValueError as error:
    print("ValueError:", error)
```

Output:

```text
12
ValueError: all arguments must be positive
```

### Exercise 4

Output:

```text
decorating with second
decorating with first
--- calling ---
first: before
second: before
task runs
second: after
first: after
```

Decoration happens at definition time and goes bottom-up: `second` wraps `task` first, then `first` wraps the result, which is `task = first(second(task))`. At call time the outermost wrapper (`first`) runs first, calls the `second` wrapper, which calls the original `task`. The "after" lines appear in reverse order as each call returns.

---

*Source: [pythontutorial.net — Python Decorators](https://www.pythontutorial.net/advanced-python/python-decorators/). Adapted and expanded for PyJourney.*
