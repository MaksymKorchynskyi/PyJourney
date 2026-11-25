# Python Class Decorators

So far every decorator has been a function. But anything **callable** can act as a decorator, including an instance of a class that defines `__call__`. Writing decorators as classes is handy when the decorator has configuration or state that you want to keep in clearly named attributes. This topic shows both forms of class-based decorators, a pitfall with methods, and the other meaning of "class decorator": a decorator applied **to** a class.

## What you'll learn

- What makes an object callable and why that is enough to be a decorator
- How to turn a decorator factory into a class: arguments in `__init__`, decoration in `__call__`
- How to write a class decorator without arguments that stores state between calls
- Why instance-based decorators break on methods and how `__get__` fixes it
- How decorators that take a **class** (like `@dataclass`) work
- When to choose a function or a class for a decorator

## Starting point: a function-based decorator factory

The `star` factory prints a line of `*` characters before and after calling the decorated function, and prints the result in between:

```python
from functools import wraps


def star(n):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            print(n * "*")
            result = fn(*args, **kwargs)
            print(result)
            print(n * "*")
            return result

        return wrapper

    return decorate


@star(5)
def add(a, b):
    return a + b


add(10, 20)
```

Output:

```text
*****
30
*****
```

Look at what `star(5)` returns: a callable (`decorate`) that takes the function `fn` and still has access to the factory's argument `n`. Nothing requires that callable to be a function.

## Callable objects

An instance of a class is **callable** when the class defines the special method `__call__`. Calling the instance, `obj(...)`, runs `obj.__call__(...)`:

```python
class Greeter:
    def __init__(self, greeting):
        self.greeting = greeting

    def __call__(self, name):
        return f"{self.greeting}, {name}!"


hello = Greeter("Hello")
print(hello("Olena"))
print(callable(hello))
```

Output:

```text
Hello, Olena!
True
```

A decorator is just "a callable that takes a function and returns a callable", so a callable instance can play that role.

## A class decorator with arguments

Let's rewrite `star` as a class. The decorator arguments go to `__init__`, and `__call__` receives the function and returns the wrapper:

```python
from functools import wraps


class Star:
    def __init__(self, n):
        self.n = n

    def __call__(self, fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            print(self.n * "*")
            result = fn(*args, **kwargs)
            print(result)
            print(self.n * "*")
            return result

        return wrapper


@Star(5)
def add(a, b):
    return a + b


add(10, 20)
print(add.__name__)
```

Output:

```text
*****
30
*****
add
```

Step by step, `@Star(5)` means `add = Star(5)(add)`:

1. `Star(5)` creates an instance and `__init__` stores `n = 5`. This plays the role of the factory call.
2. Python calls that instance with the function: `instance(add)`, which runs `__call__(add)`. This is the actual decoration.
3. `__call__` returns `wrapper`, and the name `add` is rebound to it. The wrapper reaches `n` through `self`, which it captures in a closure.

```text
function factory              class
-----------------------       ---------------------------
star(n)                  <->  Star.__init__(self, n)
  decorate(fn)           <->  Star.__call__(self, fn)
    wrapper(*args, ...)  <->    wrapper(*args, ...)
```

The settings now live in a named attribute (`self.n`) instead of a closure variable, and you can add helper methods or subclass the decorator to change its behaviour.

## A class decorator without arguments

There is a second way to use a class. If you write `@CountCalls` **without** parentheses, Python calls `CountCalls(fn)`, so the **constructor** receives the function, and the instance itself replaces the function. Every later call goes to `__call__`:

```python
import functools


class CountCalls:
    def __init__(self, fn):
        functools.update_wrapper(self, fn)
        self.fn = fn
        self.calls = 0

    def __call__(self, *args, **kwargs):
        self.calls += 1
        return self.fn(*args, **kwargs)


@CountCalls
def ping():
    """Answer with pong."""
    return "pong"


ping()
ping()
print(ping())
print(ping.calls)
print(ping.__name__, "-", ping.__doc__)
```

Output:

```text
pong
3
ping - Answer with pong.
```

- `__init__(self, fn)` runs once, at decoration time. It stores the function and creates the state (`calls = 0`).
- `__call__(self, *args, **kwargs)` runs on every call. It updates the state and calls the original function.
- `functools.update_wrapper(self, fn)` is the non-decorator form of `@wraps`. It copies `__name__`, `__doc__` and the other metadata onto the instance and sets `__wrapped__`.

This is the main advantage of the class form: the state (`calls`) is a plain, visible attribute. A function-based decorator would need `nonlocal` or an attribute on the wrapper function.

Compare the two forms side by side:

| | `@Star(5)` (with arguments) | `@CountCalls` (without arguments) |
|---|---|---|
| `__init__` receives | the decorator arguments | the decorated function |
| `__call__` receives | the decorated function | the call arguments |
| `__call__` runs | once, at decoration | on every call |
| The name is bound to | the `wrapper` function | the class instance |

## Pitfall: instance decorators on methods

`CountCalls` works for plain functions but breaks when it decorates a method:

```python
import functools


class CountCalls:
    def __init__(self, fn):
        functools.update_wrapper(self, fn)
        self.fn = fn
        self.calls = 0

    def __call__(self, *args, **kwargs):
        self.calls += 1
        return self.fn(*args, **kwargs)


class Greeter:
    @CountCalls
    def greet(self, name):
        return f"Hello, {name}"


g = Greeter()
try:
    print(g.greet("Olena"))
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
TypeError: Greeter.greet() missing 1 required positional argument: 'name'
```

Normal functions are **descriptors**: when you access `g.greet`, a function's `__get__` method produces a *bound method* that inserts `g` as `self`. A `CountCalls` instance has no `__get__`, so `g.greet` returns the instance unchanged, `self` is never passed, and `"Olena"` ends up in the `self` parameter. A wrapper *function* (as in `Star`) does not have this problem, because it is a function and gets bound like any other method.

The fix is to implement `__get__` and bind the instance yourself with `types.MethodType`:

```python
import functools
import types


class CountCalls:
    def __init__(self, fn):
        functools.update_wrapper(self, fn)
        self.fn = fn
        self.calls = 0

    def __call__(self, *args, **kwargs):
        self.calls += 1
        return self.fn(*args, **kwargs)

    def __get__(self, instance, owner=None):
        if instance is None:
            return self
        return types.MethodType(self, instance)


class Greeter:
    @CountCalls
    def greet(self, name):
        return f"Hello, {name}"


g = Greeter()
print(g.greet("Olena"))
print(g.greet("Max"))
print(Greeter.greet.calls)
```

Output:

```text
Hello, Olena
Hello, Max
2
```

`types.MethodType(self, instance)` creates a bound method whose call becomes `self(instance, *args)`, so the `Greeter` instance arrives as the first argument. Accessing the attribute on the class (`Greeter.greet`) returns the decorator itself, which is how you can read `calls`. Note that the counter is shared by all `Greeter` instances, because there is one decorator object per decorated method.

## The other meaning: decorators applied to classes

In Python's official terminology, a **class decorator** usually means a decorator placed **above a `class` statement** (PEP 3129). It works exactly like a function decorator: `@register` above `class CsvExporter` means `CsvExporter = register(CsvExporter)`. The decorator receives the class object and returns a class, typically the same one, modified or recorded somewhere:

```python
exporters = {}


def register(cls):
    exporters[cls.__name__.lower()] = cls
    return cls


def add_describe(cls):
    def describe(self):
        return f"{cls.__name__} writes {self.extension} files"

    cls.describe = describe
    return cls


@register
@add_describe
class CsvExporter:
    extension = "csv"


@register
@add_describe
class JsonExporter:
    extension = "json"


print(list(exporters))
print(exporters["jsonexporter"]().describe())
```

Output:

```text
['csvexporter', 'jsonexporter']
JsonExporter writes json files
```

The standard library is full of such decorators: `@dataclasses.dataclass` generates `__init__`, `__repr__` and `__eq__`, `@functools.total_ordering` fills in comparison methods, and `@enum.unique` checks that enum values do not repeat.

So "class decorator" can mean either *a class used as a decorator* (most of this topic) or *a decorator for a class* (this section). Check the context when you meet the term.

## Function or class?

- Use a **function** for simple, stateless decorators. It is shorter and works on methods out of the box.
- Use a **class** when the decorator has several settings, keeps state you want to inspect (`ping.calls`), needs extra methods (for example `reset()`), or should be extended through inheritance.
- If a class-based decorator replaces the function with an instance, remember `functools.update_wrapper` and, if it may decorate methods, `__get__`.

## Common mistakes

- **Mixing up the two forms.** With `@Star(5)`, `__init__` gets the settings and `__call__` gets the function. With `@CountCalls`, `__init__` gets the function and `__call__` gets the call arguments. Using one structure with the other syntax gives confusing `TypeError`s.
- **Forgetting the parentheses for a class with arguments.** `@Star` passes the function as `n`, so `add` becomes a `Star` instance whose `__call__` expects a function, and `add(10, 20)` fails with a `TypeError`.
- **Losing metadata.** Use `@wraps(fn)` on wrapper functions and `functools.update_wrapper(self, fn)` when the instance itself replaces the function.
- **Decorating methods with an instance-based decorator without `__get__`.** `self` is never passed, and the call fails or silently receives the wrong arguments.
- **Expecting a friendly `repr`.** `print(ping)` for a `CountCalls`-decorated function shows `<__main__.CountCalls object at 0x...>`. Define `__repr__` if that matters.

## Summary

- Any callable can be a decorator. An instance is callable when its class defines `__call__`.
- For a decorator with arguments (`@Star(5)`), store the arguments in `__init__` and return a wrapper from `__call__(self, fn)`.
- For a decorator without arguments (`@CountCalls`), receive the function in `__init__` and run the wrapping logic in `__call__(self, *args, **kwargs)`. State lives in instance attributes.
- Use `functools.update_wrapper(self, fn)` to copy the name and docstring onto the instance.
- An instance that replaces a method needs `__get__` (with `types.MethodType`) to receive `self`.
- A decorator placed above a `class` statement receives the class and returns a class, as `@dataclass` does.

## Practice

### Exercise 1: `Repeat` as a class

Rewrite the `repeat(times)` decorator factory from the previous topic as a class `Repeat`, used as `@Repeat(3)`. Keep the function's name with `functools.wraps`. Test it on a `say(message)` function and print `say.__name__`.

### Exercise 2: Call counter with a reset

Write a class decorator `CallCounter` (used without arguments) that counts calls in `self.calls` and provides a `reset()` method. Use `functools.update_wrapper`. Call a decorated function three times, print the count, reset it, call once more, and print the count again.

### Exercise 3: A decorator for classes

Write a function `auto_repr(cls)` that adds a `__repr__` method to a class. The method must show the class name and all instance attributes, like `Point(x=1, y=2)`. Apply it to a `Point` class with `x` and `y` and to a `User` class with `name` and `email`.

### Exercise 4: Make it work on methods

The `Star` class above returns a wrapper *function*, so it works on methods without any extra code. Prove it: decorate a method `Cart.total(self)` with `@Star(3)` and call it. Then explain in one sentence why `CountCalls` needed `__get__` but `Star` does not.

## Solutions

### Exercise 1

```python
from functools import wraps


class Repeat:
    def __init__(self, times):
        self.times = times

    def __call__(self, fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            result = None
            for _ in range(self.times):
                result = fn(*args, **kwargs)
            return result

        return wrapper


@Repeat(3)
def say(message):
    print(message)


say("Hi")
print(say.__name__)
```

Output:

```text
Hi
Hi
Hi
say
```

### Exercise 2

```python
import functools


class CallCounter:
    def __init__(self, fn):
        functools.update_wrapper(self, fn)
        self.fn = fn
        self.calls = 0

    def __call__(self, *args, **kwargs):
        self.calls += 1
        return self.fn(*args, **kwargs)

    def reset(self):
        self.calls = 0


@CallCounter
def square(x):
    return x * x


square(2)
square(3)
square(4)
print(square.calls)

square.reset()
print(square(5))
print(square.calls)
```

Output:

```text
3
25
1
```

### Exercise 3

```python
def auto_repr(cls):
    def __repr__(self):
        fields = ", ".join(f"{key}={value!r}" for key, value in vars(self).items())
        return f"{type(self).__name__}({fields})"

    cls.__repr__ = __repr__
    return cls


@auto_repr
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y


@auto_repr
class User:
    def __init__(self, name, email):
        self.name = name
        self.email = email


print(Point(1, 2))
print(User("Olena", "olena@example.com"))
```

Output:

```text
Point(x=1, y=2)
User(name='Olena', email='olena@example.com')
```

`vars(self)` returns the instance's attribute dictionary in the order the attributes were assigned. `type(self).__name__` keeps the right name for subclasses too.

### Exercise 4

```python
from functools import wraps


class Star:
    def __init__(self, n):
        self.n = n

    def __call__(self, fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            print(self.n * "*")
            result = fn(*args, **kwargs)
            print(result)
            print(self.n * "*")
            return result

        return wrapper


class Cart:
    def __init__(self, prices):
        self.prices = prices

    @Star(3)
    def total(self):
        return sum(self.prices)


Cart([10, 15, 5]).total()
```

Output:

```text
***
30
***
```

`Star.__call__` returns an ordinary function, and functions are descriptors that bind `self` automatically, while `CountCalls` puts a class instance in place of the method, and instances without `__get__` are not bound.

---

*Source: [pythontutorial.net — Python Class Decorators](https://www.pythontutorial.net/advanced-python/python-class-decorators/). Adapted and expanded for PyJourney.*
