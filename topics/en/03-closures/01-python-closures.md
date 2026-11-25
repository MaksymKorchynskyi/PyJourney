# Python Closures

A **closure** is a function that remembers variables from the scope where it was defined, even after that scope has finished running. Closures power function factories, callbacks and decorators, and they explain one of Python's classic surprises: lambdas created in a loop that all return the same result.

## What you'll learn

- What free variables are and what turns a nested function into a closure
- How a closure keeps outer variables alive after the outer function returns
- What cell objects are and how to inspect them with `__closure__` and `__code__.co_freevars`
- Why every call of the outer function creates a new, independent closure
- Why closures capture variables, not values (late binding), and how to fix the loop pitfall
- When to use a closure and when a class is the better tool

## Nested functions and free variables

A function defined inside another function can use the variables of the outer function:

```python
def say():
    greeting = "Hello"

    def display():
        print(greeting)

    display()


say()
```

Output:

```text
Hello
```

Inside `display`, the name `greeting` is not a local variable (nothing assigns to it there) and not a global one. It belongs to the enclosing scope of `say`. A variable that a function uses but that is defined in an enclosing function scope is called a **free variable** of that function.

When you look at `display`, you are really looking at two things:

- the code of the function `display`;
- the free variable `greeting`, which refers to `"Hello"`.

This combination of a function and the free variables it carries with it is a **closure**. By definition, **a closure is a nested function that references one or more variables from its enclosing scope**.

> **Note:** A nested function that does not use any variables of the outer function is not a closure. Its `__closure__` attribute is `None`.

## Returning the inner function

Closures become interesting when the outer function **returns** the inner function instead of calling it:

```python
def say():
    greeting = "Hello"

    def display():
        print(greeting)

    return display


fn = say()
fn()
```

Output:

```text
Hello
```

Look at the order of events:

1. `say()` runs, creates the local variable `greeting` and the function `display`, and returns `display`.
2. `say()` finishes. Its local scope is gone.
3. `fn()` runs and still prints `"Hello"`.

If local variables disappeared together with the function call, `fn` would have nothing to print. The closure keeps `greeting` alive: `fn` is the function `display` plus a reference to the variable it needs.

## Cells: how a variable outlives its scope

A variable used by an inner function lives in two scopes at the same time: in the scope of `say` and in the closure. To make both refer to the same thing, Python stores such variables in an intermediate object called a **cell**. Both the outer function and the closure go through the cell to reach the value:

```text
greeting in say() -------+
                         +---> cell ---> str object 'Hello'
fn.__closure__[0] -------+
```

When `say()` returns, its local namespace is discarded, but the cell is still referenced by the closure, so the cell and the string it points to survive. Reading `greeting` inside the closure takes a "double hop": closure to cell, cell to object.

You can see the cells through the function's `__closure__` attribute, which is a tuple with one cell per free variable:

```python
def say():
    greeting = "Hello"

    def display():
        print(greeting)

    return display


fn = say()
print(fn.__closure__)
print(fn.__closure__[0].cell_contents)
```

Output (the addresses vary from run to run):

```text
(<cell at 0x101128880: str object at 0x101104b40>,)
Hello
```

`cell_contents` returns the object the cell currently refers to.

The names of the free variables are stored in the code object. The inner function lists them in `co_freevars`, and the outer function lists the variables it shares with inner functions in `co_cellvars`:

```python
def say():
    greeting = "Hello"

    def display():
        print(greeting)

    return display


fn = say()
print(fn.__code__.co_freevars)
print(say.__code__.co_cellvars)
```

Output:

```text
('greeting',)
('greeting',)
```

You can also check that the outer function and the closure see exactly the same object:

```python
def say():
    greeting = "Hello"
    print(hex(id(greeting)))

    def display():
        print(hex(id(greeting)))
        print(greeting)

    return display


fn = say()
fn()
```

Output (the addresses vary, but the two numbers are always equal):

```text
0x104b74b40
0x104b74b40
Hello
```

Based on this mechanism, you can think of a closure as **a function plus an extended scope that contains its free variables**.

## Every call creates a new closure

Each call of a function creates a new local scope. If the function builds a closure, each call also produces a **new** closure with its **own** cells:

```python
def multiplier(x):
    def multiply(y):
        return x * y

    return multiply


m1 = multiplier(1)
m2 = multiplier(2)
m3 = multiplier(3)

print(m1(10))
print(m2(10))
print(m3(10))
print(m1 is m2)
print(m2.__closure__[0].cell_contents)
```

Output:

```text
10
20
30
False
2
```

`multiplier` is a **function factory**: it manufactures specialised functions. `m1`, `m2` and `m3` share the same code, but each has its own cell for `x`.

Closures created in the **same** call, on the other hand, share cells. That is how several inner functions can work with one piece of state:

```python
def make_counter():
    count = 0

    def increment():
        nonlocal count
        count += 1
        return count

    def current():
        return count

    return increment, current


increment, current = make_counter()
increment()
increment()
print(current())
print(increment.__closure__[0] is current.__closure__[0])
```

Output:

```text
2
True
```

`increment` rebinds `count`, so it needs `nonlocal` (see the previous topic). `current` only reads it.

## Closures capture variables, not values

A closure does not copy the value of a free variable when the closure is created. It keeps a reference to the **variable** (the cell) and reads its value at the moment the closure is **called**. This is called **late binding**:

```python
def make_greeter():
    greeting = "Hello"

    def greet(name):
        return f"{greeting}, {name}!"

    greeting = "Hi"
    return greet


print(make_greeter()("Olena"))
```

Output:

```text
Hi, Olena!
```

`greet` was defined while `greeting` was `"Hello"`, but by the time it runs, the variable refers to `"Hi"`.

## The loop pitfall

Late binding is behind a famous surprise. Suppose you want to build the three multipliers in a loop:

```python
def make_multipliers():
    multipliers = []
    for x in range(1, 4):
        multipliers.append(lambda y: x * y)
    return multipliers


m1, m2, m3 = make_multipliers()

print(m1(10))
print(m2(10))
print(m3(10))
```

Output:

```text
30
30
30
```

The loop does not create a new variable on each iteration. There is only **one** variable `x` in `make_multipliers`, and all three lambdas share its cell. When they are called, the loop has finished and `x` is `3`:

```python
def make_multipliers():
    multipliers = []
    for x in range(1, 4):
        multipliers.append(lambda y: x * y)
    return multipliers


m1, m2, m3 = make_multipliers()
print(m1.__code__.co_freevars)
print(m1.__closure__[0] is m3.__closure__[0])
print(m1.__closure__[0].cell_contents)
```

Output:

```text
('x',)
True
3
```

> **Note:** If you write the same loop at module level, the lambdas are not even closures: `x` is a global variable, and each lambda looks it up in the global scope when called. The result is the same `30 30 30`, for the same reason: the value is read late.

There are three common fixes. Each one makes sure every function gets its own value of `x` **at creation time**.

**Fix 1: a factory function.** Every call of `multiplier(x)` creates a new scope and a new cell:

```python
def multiplier(x):
    def multiply(y):
        return x * y

    return multiply


multipliers = []
for x in range(1, 4):
    multipliers.append(multiplier(x))

m1, m2, m3 = multipliers

print(m1(10))
print(m2(10))
print(m3(10))
```

Output:

```text
10
20
30
```

**Fix 2: a default argument.** Default values are evaluated once, when the function is defined, so the current value of `x` is stored with each lambda:

```python
multipliers = [lambda y, x=x: x * y for x in range(1, 4)]
print([m(10) for m in multipliers])
```

Output:

```text
[10, 20, 30]
```

This is short, but it adds a parameter `x` that callers could accidentally override (`m(10, 5)`).

**Fix 3: `functools.partial`.** It freezes some arguments of an existing function:

```python
import operator
from functools import partial

multipliers = [partial(operator.mul, x) for x in range(1, 4)]
print([m(10) for m in multipliers])
```

Output:

```text
[10, 20, 30]
```

## Practical uses of closures

- **Function factories.** Create configured functions such as `multiplier(3)` or the logger below.
- **Callbacks.** Event handlers and `key=` functions often need some extra data. A closure carries that data without global variables.
- **Private state.** A counter or cache hidden inside a closure cannot be changed from outside except through the functions you return.
- **Decorators.** A decorator returns a closure that wraps the original function. This is the subject of the next topic.

```python
def make_logger(level):
    def log(message):
        print(f"[{level}] {message}")

    return log


info = make_logger("INFO")
error = make_logger("ERROR")

info("Server started")
error("Disk is full")
```

Output:

```text
[INFO] Server started
[ERROR] Disk is full
```

### Closure or class?

A closure is a lightweight object with one method. The same multiplier can be written as a class with `__call__`:

```python
class Multiplier:
    def __init__(self, x):
        self.x = x

    def __call__(self, y):
        return self.x * y


triple = Multiplier(3)
print(triple(10))
print(triple.x)
```

Output:

```text
30
3
```

Use a closure for small, focused behaviour with little state. Switch to a class when you need several operations, state that should be visible (`triple.x`), a readable `repr`, or inheritance.

## Common mistakes

- **Creating closures in a loop and expecting each to remember the current value.** All of them share the loop variable and see its final value. Use a factory function, a default argument or `functools.partial`.
- **Thinking a closure stores a copy.** It stores a reference to the variable. If the outer function changes the variable later, the closure sees the new value.
- **Rebinding a free variable without `nonlocal`.** `count += 1` inside the closure raises `UnboundLocalError`. Declare `nonlocal count`.
- **Calling the inner function instead of returning it.** `return display()` returns the result of the call (here `None`), not the function. Return `display` without parentheses.
- **Keeping large objects alive by accident.** A closure keeps every free variable alive for as long as the closure exists. Do not capture a huge list if you only need its length.

## Summary

- A free variable is a variable that a function uses but that is defined in an enclosing function.
- A closure is a nested function together with the free variables it references. It keeps them alive after the outer function returns.
- Python stores shared variables in cell objects. `fn.__closure__` holds the cells, `cell.cell_contents` shows the value, and `__code__.co_freevars` lists the names.
- Every call of the outer function creates a new closure with its own cells. Functions created in the same call share cells.
- Closures capture variables, not values: the value is read when the closure runs (late binding).
- Closures created in a loop share the loop variable. Fix it with a factory function, a default argument or `functools.partial`.
- Closures are the foundation of function factories, callbacks and decorators.

## Practice

### Exercise 1: Power factory

Write `make_power(n)` that returns a function raising its argument to the power `n`. Create `square` and `cube` and print `square(4)`, `cube(2)`, and the free variables of `cube`.

### Exercise 2: Fix the button handlers

The code below should print `Clicked Save`, `Clicked Open`, `Clicked Exit`, but it prints `Clicked Exit` three times. Explain why, then fix it in two different ways.

```python
def build_handlers(labels):
    handlers = []
    for label in labels:
        handlers.append(lambda: print("Clicked", label))
    return handlers


for handler in build_handlers(["Save", "Open", "Exit"]):
    handler()
```

### Exercise 3: Inspect a closure

Write `describe(fn)` that returns a dictionary mapping the names of `fn`'s free variables to their current values, or an empty dictionary if `fn` is not a closure. Test it on `make_power(3)` from Exercise 1, on `make_logger("INFO")`, and on `len`.

### Exercise 4: A caching closure

Write `make_cached(func)` that returns a new function. The new function calls `func(n)` only the first time it sees a given `n` and stores the result in a dictionary hidden in the closure. Repeated calls must return the stored result. Use a slow `square(n)` that prints `"computing n"` to show when the real work happens.

## Solutions

### Exercise 1

```python
def make_power(n):
    def power(x):
        return x ** n

    return power


square = make_power(2)
cube = make_power(3)

print(square(4))
print(cube(2))
print(cube.__code__.co_freevars)
print(cube.__closure__[0].cell_contents)
```

Output:

```text
16
8
('n',)
3
```

### Exercise 2

All lambdas share one variable `label`, and they read it only when called. By then the loop has finished and `label` is `"Exit"`.

Fix with a default argument:

```python
def build_handlers(labels):
    handlers = []
    for label in labels:
        handlers.append(lambda label=label: print("Clicked", label))
    return handlers


for handler in build_handlers(["Save", "Open", "Exit"]):
    handler()
```

Fix with a factory function:

```python
def make_handler(label):
    def handler():
        print("Clicked", label)

    return handler


def build_handlers(labels):
    return [make_handler(label) for label in labels]


for handler in build_handlers(["Save", "Open", "Exit"]):
    handler()
```

Output of both versions:

```text
Clicked Save
Clicked Open
Clicked Exit
```

### Exercise 3

```python
def describe(fn):
    code = getattr(fn, "__code__", None)
    if code is None or fn.__closure__ is None:
        return {}
    return {
        name: cell.cell_contents
        for name, cell in zip(code.co_freevars, fn.__closure__)
    }


def make_power(n):
    def power(x):
        return x ** n

    return power


def make_logger(level):
    def log(message):
        print(f"[{level}] {message}")

    return log


print(describe(make_power(3)))
print(describe(make_logger("INFO")))
print(describe(len))
```

Output:

```text
{'n': 3}
{'level': 'INFO'}
{}
```

Built-in functions such as `len` have no `__code__` attribute, so `getattr(..., None)` protects against an `AttributeError`.

### Exercise 4

```python
def make_cached(func):
    cache = {}

    def cached(n):
        if n not in cache:
            cache[n] = func(n)
        return cache[n]

    return cached


def square(n):
    print("computing", n)
    return n * n


fast_square = make_cached(square)
print(fast_square(4))
print(fast_square(4))
print(fast_square(5))
print(fast_square(4))
```

Output:

```text
computing 4
16
16
computing 5
25
16
```

`cache` is mutated (`cache[n] = ...`), not rebound, so no `nonlocal` is needed. This "function that wraps another function" pattern is exactly what a decorator is.

---

*Source: [pythontutorial.net — Python Closures](https://www.pythontutorial.net/advanced-python/python-closures/). Adapted and expanded for PyJourney.*
