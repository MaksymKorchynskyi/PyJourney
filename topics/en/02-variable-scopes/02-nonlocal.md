# nonlocal

Python lets you define a function inside another function. The inner function can read the outer function's variables, but to **reassign** them it needs the `nonlocal` keyword. This topic explains the enclosing (nonlocal) scope, how name lookup works across nested functions, and how `nonlocal` differs from `global`.

## What you'll learn

- What nested functions are and why they are useful
- What the enclosing (nonlocal) scope is and where it sits in the LEGB rule
- How an inner function reads variables of the outer function
- How to rebind an outer function's variable with `nonlocal`
- The rules and errors around `nonlocal`, and how it compares to `global`

## Nested functions

A function defined inside another function is a **nested** (or inner) function:

```python
def outer():
    print("outer function")

    def inner():
        print("inner function")

    inner()


outer()
```

Output:

```text
outer function
inner function
```

The `def inner():` statement runs every time `outer()` is called. It creates a new function object and binds it to the **local** name `inner` inside `outer`. Outside `outer`, the name `inner` does not exist.

Why nest functions at all?

- **Encapsulation.** A helper that only makes sense inside one function does not clutter the module's global namespace.
- **Access to the outer function's data.** The inner function can use the outer function's parameters and variables without passing them around.
- **Closures and decorators.** An outer function can *return* its inner function together with the data it uses. The next topics build on exactly this.

## The enclosing (nonlocal) scope

Every function has its own local scope. A nested function also sees the local scope of the function that contains it. From the inner function's point of view, that scope is neither local (it belongs to another function) nor global (it is not module level). Python calls it the **enclosing** scope, and the variables in it are often called **nonlocal** variables.

```python
def outer():
    message = "outer function"
    print(message)

    def inner():
        print(message)

    inner()


outer()
```

Output:

```text
outer function
outer function
```

`inner` has no local variable called `message`, so Python looks in the enclosing scope (the scope of `outer`) and finds it there.

This is the **E** in the LEGB rule. When a name is read, Python searches:

```text
L  Local       the function that is running (inner)
E  Enclosing   outer functions, innermost first (outer)
G  Global      the module
B  Built-in    print, len, None, ...
```

If the enclosing scopes do not have the name, the search simply continues to the global scope:

```python
message = "global scope"


def outer():

    def inner():
        print(message)

    inner()


outer()
```

Output:

```text
global scope
```

Neither `inner` nor `outer` defines `message`, so Python ends up in the global scope.

With several levels of nesting, the **closest** enclosing function that defines the name wins:

```python
def level1():
    name = "level1"

    def level2():
        name = "level2"

        def level3():
            print(name)

        level3()

    level2()


level1()
```

Output:

```text
level2
```

## Assigning in an inner function creates a local variable

Reading an outer variable is free. Assigning to it is a different story, and the rule is the same as for globals: if a function assigns to a name anywhere in its body, that name is **local** to the function.

```python
def outer():
    message = "outer scope"

    def inner():
        message = "inner scope"
        print("inner:", message)

    inner()
    print("outer:", message)


outer()
```

Output:

```text
inner: inner scope
outer: outer scope
```

`inner` created its own local `message`, which shadows the outer one. The outer variable was never changed.

A read-and-write operation such as `+=` fails, because the name is local but has no value yet:

```python
def outer():
    count = 0

    def inner():
        count += 1

    inner()


outer()
```

Output:

```text
Traceback (most recent call last):
  File "app.py", line 10, in <module>
    outer()
    ~~~~~^^
  File "app.py", line 7, in outer
    inner()
    ~~~~~^^
  File "app.py", line 5, in inner
    count += 1
    ^^^^^
UnboundLocalError: cannot access local variable 'count' where it is not associated with a value
```

## The `nonlocal` keyword

To rebind a variable of an enclosing function, declare it `nonlocal` inside the inner function:

```python
def outer():
    message = "outer scope"
    print(message)

    def inner():
        nonlocal message
        message = "inner scope"
        print(message)

    inner()

    print(message)


outer()
```

Output:

```text
outer scope
inner scope
inner scope
```

`nonlocal message` tells the compiler: "`message` in this function is the variable of the nearest enclosing function that has a variable with this name". After `inner()` runs, `outer` sees the new value.

The same fix makes the counter from the previous section work:

```python
def outer():
    count = 0

    def inner():
        nonlocal count
        count += 1

    inner()
    inner()
    inner()
    print(count)


outer()
```

Output:

```text
3
```

### How Python resolves a `nonlocal` name

- Python searches the **enclosing function scopes** from the nearest outward and binds to the first one that defines the name.
- It **never** looks in the global scope (or in the built-in scope).
- The decision is made at **compile time**. If no enclosing function defines the name, the whole file fails to compile and nothing runs.

```python
message = "outer scope"


def outer():
    print(message)

    def inner():
        nonlocal message
        message = "inner scope"
        print(message)

    inner()

    print(message)


outer()
```

Output:

```text
  File "app.py", line 8
    nonlocal message
    ^^^^^^^^^^^^^^^^
SyntaxError: no binding for nonlocal 'message' found
```

`outer` only *reads* the global `message`. It does not have its own variable with that name, and `nonlocal` does not consider the global scope, so there is nothing to bind to. Notice that not even the first `print()` ran: a `SyntaxError` stops the program before execution starts. If you really meant the module-level variable, use `global message` instead.

### Other rules

- `nonlocal` cannot **create** a variable. Unlike `global`, the name must already be assigned in an enclosing function.
- `nonlocal` is not allowed at module level (`SyntaxError: nonlocal declaration not allowed at module level`), and a function that is not nested has no enclosing function to refer to.
- A name cannot be both a parameter of the inner function and `nonlocal` (`SyntaxError: name 'x' is parameter and nonlocal`).
- The declaration must come before the name is used in the function, just like `global`.
- You can list several names at once: `nonlocal total, count`.

### Mutation does not need `nonlocal`

`nonlocal` is about **rebinding names**. If the outer variable refers to a mutable object, the inner function can change that object without any declaration, because the name itself is not reassigned:

```python
def outer():
    log = []

    def inner(event):
        log.append(event)

    inner("start")
    inner("stop")
    print(log)


outer()
```

Output:

```text
['start', 'stop']
```

`log.append(...)` reads the name `log` (found in the enclosing scope) and mutates the list. `log = log + [event]` would be an assignment, and that *would* require `nonlocal log`.

## A practical example: state that survives between calls

`nonlocal` becomes really useful when the outer function **returns** the inner function. The inner function keeps access to the outer variables even after the outer function has finished (this is a *closure*, covered in the next section), and `nonlocal` lets it update them:

```python
def make_counter(start=0):
    count = start

    def increment():
        nonlocal count
        count += 1
        return count

    return increment


counter = make_counter()
print(counter())
print(counter())

other = make_counter(100)
print(other())
print(counter())
```

Output:

```text
1
2
101
3
```

Each call to `make_counter()` creates a new `count` variable, so `counter` and `other` keep independent state. Nothing is stored in globals.

## `nonlocal` vs. `global`

| | `global name` | `nonlocal name` |
|---|---|---|
| Refers to | the module-level variable | the nearest enclosing function's variable |
| Where it can be used | any function | only in a nested function |
| Can create a new variable | yes | no, the name must already exist |
| Looks at the global scope | yes, only there | never |
| Error if the target is missing | no error (created on assignment) | `SyntaxError` at compile time |

## Common mistakes

- **Forgetting `nonlocal` before `+=`, `-=` or `=`.** The inner function silently gets its own local variable (with `=`), or crashes with `UnboundLocalError` (with `+=`).
- **Using `nonlocal` for a module-level variable.** `nonlocal` skips the global scope, so you get `SyntaxError: no binding for nonlocal ... found`. Use `global` for module-level names.
- **Adding `nonlocal` just to call a method.** `items.append(x)` or `data["key"] = value` mutate an object and need no declaration. Only assignments to the bare name need it.
- **Expecting `nonlocal` to create a variable.** Assign the variable in the outer function first, even if only to `None` or `0`.
- **Overusing nested state.** Several inner functions sharing many `nonlocal` variables quickly become hard to follow. When the state grows, a small class is usually clearer.

## Summary

- A nested function is a function defined inside another function. It is created anew each time the outer function runs.
- The scope of an outer function is the **enclosing** (nonlocal) scope of the inner function: the **E** in LEGB.
- Inner functions can read outer variables without any declaration. The nearest enclosing definition wins.
- Assigning to a name in the inner function makes it local, unless the name is declared `nonlocal`.
- `nonlocal name` rebinds the variable in the nearest enclosing function. It never looks at globals, cannot create variables, and errors are reported at compile time.
- Mutating an outer object (for example `list.append`) does not need `nonlocal`.
- Together with returning the inner function, `nonlocal` lets you keep private state between calls without globals.

## Practice

### Exercise 1: Predict the output

What does this program print? Answer first, then run it.

```python
x = "global"


def a():
    x = "a"

    def b():
        x = "b"

        def c():
            nonlocal x
            x = "c"

        c()
        print("in b:", x)

    b()
    print("in a:", x)


a()
print("global:", x)
```

### Exercise 2: Fix the click counter

`track_clicks()` should print `Clicks: 3`, but it raises `UnboundLocalError`. Fix it with a one-line change.

```python
def track_clicks():
    clicks = 0

    def click():
        clicks += 1

    click()
    click()
    click()
    print("Clicks:", clicks)


track_clicks()
```

### Exercise 3: Running average

Write `make_averager()`, which returns a function `add(value)`. Each call adds a number and returns the average of all numbers added so far. Store only a running `total` and `count`, not a list.

```python
avg = make_averager()
print(avg(10))  # 10.0
print(avg(20))  # 15.0
print(avg(60))  # 30.0
```

### Exercise 4: A tiny bank account

Write `make_account(balance)` that returns **three** functions: `deposit(amount)`, `withdraw(amount)` and `get_balance()`. All three must share the same balance. `withdraw` must raise `ValueError("insufficient funds")` when the amount is larger than the balance. Demonstrate a deposit, a withdrawal, and a failed withdrawal.

## Solutions

### Exercise 1

Output:

```text
in b: c
in a: a
global: global
```

`nonlocal x` in `c` binds to the **nearest** enclosing function that defines `x`, which is `b`. So only `b`'s variable changes. `a`'s `x` and the global `x` are untouched.

### Exercise 2

Add `nonlocal clicks` to the inner function:

```python
def track_clicks():
    clicks = 0

    def click():
        nonlocal clicks
        clicks += 1

    click()
    click()
    click()
    print("Clicks:", clicks)


track_clicks()
```

Output:

```text
Clicks: 3
```

### Exercise 3

```python
def make_averager():
    total = 0
    count = 0

    def add(value):
        nonlocal total, count
        total += value
        count += 1
        return total / count

    return add


avg = make_averager()
print(avg(10))
print(avg(20))
print(avg(60))
```

Output:

```text
10.0
15.0
30.0
```

Both `total` and `count` are rebound with `+=`, so both must be declared `nonlocal`.

### Exercise 4

```python
def make_account(balance):
    def deposit(amount):
        nonlocal balance
        balance += amount
        return balance

    def withdraw(amount):
        nonlocal balance
        if amount > balance:
            raise ValueError("insufficient funds")
        balance -= amount
        return balance

    def get_balance():
        return balance

    return deposit, withdraw, get_balance


deposit, withdraw, get_balance = make_account(100)
print(deposit(50))
print(withdraw(30))
try:
    withdraw(500)
except ValueError as error:
    print("Error:", error)
print(get_balance())
```

Output:

```text
150
120
Error: insufficient funds
120
```

The parameter `balance` of `make_account` is a local variable of the outer function, so the inner functions can refer to it with `nonlocal`. `get_balance` only reads it, so it needs no declaration.

---

*Source: [pythontutorial.net — Python nonlocal](https://www.pythontutorial.net/advanced-python/python-nonlocal/). Adapted and expanded for PyJourney.*
