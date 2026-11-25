# Variable Scopes

A variable name is not visible everywhere in a program. Each name lives in a particular **scope**, and Python follows strict rules to decide which object a name refers to at a given point in the code. Knowing these rules explains `NameError`, the famous `UnboundLocalError`, and why a function cannot simply reassign a global variable.

## What you'll learn

- What a scope and a namespace are, and how they relate
- The built-in, global (module) and local scopes, and how they nest
- How Python looks up a name: the LEGB rule
- Why assigning to a name inside a function makes it local, and what `UnboundLocalError` means
- How and when to use the `global` keyword
- Which code blocks create a new scope and which do not

## Scopes and namespaces

An assignment such as `counter = 10` **binds** the name `counter` to an `int` object. That binding does not exist everywhere: it exists only in a certain region of the code. The region of source code where a name is visible is called the name's **scope**. Python decides scopes from the *structure of the source code* (where a name is assigned), not from the order in which functions are called. This is why Python's scopes are called **lexical** (or static) scopes.

Python stores bindings in **namespaces**. A namespace is essentially a mapping from names to objects, and many namespaces really are plain dictionaries you can inspect:

```text
 namespace of module app.py
+-----------+------------------------+
| name      | refers to              |
+-----------+------------------------+
| counter   | int object 10          |
| increment | function object        |
+-----------+------------------------+
```

Every scope has its own namespace, so the same name can exist in several namespaces at once and refer to different objects. Python needs rules to decide which one wins, and the rest of this topic is about those rules.

## The built-in scope

The **built-in scope** holds names that are available in every module without an import: `print`, `len`, `range`, `int`, `None`, `True`, `False`, exception classes such as `ValueError`, and many more. They all live in the `builtins` module:

```python
import builtins

print(builtins.print is print)
print(builtins.len("scope"))
print("ValueError" in dir(builtins))
```

Output:

```text
True
5
True
```

You never need to import `builtins` to use these names. Python consults it automatically as the last step of every lookup.

## The global (module) scope

The **global scope** is the scope of a module, which means a single `.py` file. Names assigned at the top level of a file (outside any function or class), including names created by `def`, `class` and `import`, are global to that module.

"Global" in Python does **not** mean "shared by the whole program". Every module has its own global namespace. The only scope that is truly visible from every module is the built-in scope.

When code at module level uses a name, Python first looks in the module's global namespace, then in the built-in namespace. In a file `app.py`:

```python
print("Hello")
```

Output:

```text
Hello
```

`print` is not defined in `app.py`, so Python does not find it in the global namespace and moves on to the built-in scope, where it succeeds. If a name is in neither namespace, Python raises `NameError`:

```python
print(counter)
```

Output:

```text
Traceback (most recent call last):
  File "app.py", line 1, in <module>
    print(counter)
          ^^^^^^^
NameError: name 'counter' is not defined
```

You can look at a module's global namespace with `globals()`. It returns the real dictionary that Python uses:

```python
counter = 10


def increment(value):
    return value + 1


print("counter" in globals())
print(globals()["counter"])
print(type(globals()["increment"]).__name__)
```

Output:

```text
True
10
function
```

## The local scope

Parameters of a function and names assigned inside its body belong to the function's **local scope**:

```python
def increment(counter, by=1):
    result = counter + by
    return result
```

Running a Python file happens in two phases:

1. **Compilation.** Python turns the source into bytecode. For each function it decides, once and for all, which names are local: every parameter and every name that is *assigned* anywhere in the function body (`=`, `+=`, `for` targets, `import`, `def`, `with ... as`, and so on). Here these are `counter`, `by` and `result`.
2. **Execution.** Statements run from top to bottom. The `def` statement creates a function object and binds the name `increment` in the global namespace. No local variables exist yet.

The compiler's decision is stored in the function's code object, so you can see it before the function is ever called:

```python
def increment(counter, by=1):
    result = counter + by
    return result


print(increment.__code__.co_varnames)
```

Output:

```text
('counter', 'by', 'result')
```

**Each call creates a fresh local namespace.** During `increment(10, 2)` the local names are bound to `10`, `2` and `12`. When the call returns, that namespace is thrown away. Calling `increment(100, 3)` later starts with a brand-new namespace where the names are bound to `100`, `3` and `103`. Calls never share local variables, which is also what makes recursion work.

```python
def increment(counter, by=1):
    result = counter + by
    print(locals())
    return result


increment(10, 2)
increment(100, 3)

try:
    print(result)
except NameError as error:
    print("NameError:", error)
```

Output:

```text
{'counter': 10, 'by': 2, 'result': 12}
{'counter': 100, 'by': 3, 'result': 103}
NameError: name 'result' is not defined
```

`locals()` shows the current local namespace. Outside the function, `result` does not exist at all.

> **Note:** Since Python 3.13, `locals()` inside a function returns an independent snapshot every time you call it. Changing that dictionary never changes the real local variables. Treat it as a read-only debugging aid.

## Name lookup: the LEGB rule

Scopes are nested. A function's local scope sits inside the module's global scope, and the global scope sits inside the built-in scope. A function defined inside another function adds one more level, the **enclosing** scope (the topic on `nonlocal` covers it in detail).

```text
+---------------------------------------------------+
| B  Built-in   print, len, range, None, ...        |
|   +-------------------------------------------+   |
|   | G  Global   names at the top of app.py    |   |
|   |   +-----------------------------------+   |   |
|   |   | E  Enclosing   outer function     |   |   |
|   |   |   +---------------------------+   |   |   |
|   |   |   | L  Local   inner function |   |   |   |
|   |   |   +---------------------------+   |   |   |
|   |   +-----------------------------------+   |   |
|   +-------------------------------------------+   |
+---------------------------------------------------+
```

When you **read** a name, Python searches from the inside out and stops at the first match:

1. **L**ocal: the current function.
2. **E**nclosing: the local scopes of any outer functions, innermost first.
3. **G**lobal: the module.
4. **B**uilt-in: the `builtins` module.

If no scope has the name, you get `NameError`.

```python
counter = 10


def current():
    print(counter)


current()
```

Output:

```text
10
```

`counter` is not local to `current()`, so Python finds it in the global scope.

The first match wins, so a name in an inner scope **shadows** (hides) the same name in outer scopes. That includes built-ins: define a global named `len`, and the built-in `len` becomes invisible in that module.

## Assignment makes a name local

Reading a global from a function works without any special syntax. **Assigning** to it is different:

```python
counter = 10


def reset():
    counter = 0
    print(counter)


reset()
print(counter)
```

Output:

```text
0
10
```

Because `reset()` assigns to `counter`, the compiler marks `counter` as local to `reset()`. The assignment creates a new local variable that shadows the global one, and the global `counter` stays `10`.

### `UnboundLocalError`

The rule "assigned anywhere means local everywhere in the function" produces one of the most common Python errors:

```python
counter = 10


def increment():
    counter = counter + 1
    return counter


increment()
```

Output:

```text
Traceback (most recent call last):
  File "app.py", line 9, in <module>
    increment()
    ~~~~~~~~~^^
  File "app.py", line 5, in increment
    counter = counter + 1
              ^^^^^^^
UnboundLocalError: cannot access local variable 'counter' where it is not associated with a value
```

Python does **not** read the global `counter` on the right-hand side. The compiler already decided that `counter` is local in the whole body of `increment()`, and at that moment the local variable has no value yet. `counter += 1` fails the same way. The position of the assignment does not matter: even an assignment on the last line of the function makes the name local from the first line.

## The `global` keyword

To **rebind** a global name from inside a function, declare it with `global`:

```python
counter = 10


def reset():
    global counter
    counter = 0
    print(counter)


reset()
print(counter)
```

Output:

```text
0
0
```

`global counter` tells the compiler: "inside this function, `counter` refers to the module-level name". Now the assignment changes the global binding.

A few rules about `global`:

- You need it only to **assign** (rebind) a global name. Reading a global needs no declaration.
- It can create a global that did not exist before the call:

  ```python
  def setup():
      global config
      config = {"debug": True}


  setup()
  print(config)
  ```

  Output:

  ```text
  {'debug': True}
  ```

- The declaration must come before any use of the name in that function. Otherwise the code does not even compile:

  ```python
  counter = 0


  def reset():
      counter = 1
      global counter
  ```

  Output:

  ```text
    File "app.py", line 6
      global counter
      ^^^^^^^^^^^^^^
  SyntaxError: name 'counter' is assigned to before global declaration
  ```

- Mutating a global object does **not** require `global`, because no name is rebound:

  ```python
  events = []


  def log(event):
      events.append(event)


  log("start")
  log("stop")
  print(events)
  ```

  Output:

  ```text
  ['start', 'stop']
  ```

### Why to avoid global state

`global` works, but functions that read and rewrite global variables are hard to test and reason about: their result depends on hidden state, and any other function can change that state. Prefer passing values in as arguments and returning results:

```python
def increment(counter, by=1):
    return counter + by


counter = 10
counter = increment(counter)
print(counter)
```

Output:

```text
11
```

Reserve `global` for rare cases such as module-level caches or configuration that is set once. When you need state that survives between calls, a class or a closure is usually a cleaner tool.

## Blocks do not create scopes

In C, Java or JavaScript (`let`), braces create a new scope. In Python only **modules, functions (including lambdas), classes and comprehensions** create scopes. The bodies of `if`, `for`, `while`, `with` and `try` do not, so names assigned inside them belong to the surrounding scope:

```python
for i in range(3):
    pass
print(i)

if True:
    status = "ready"
print(status)

squares = [n * n for n in range(3)]
try:
    print(n)
except NameError as error:
    print("NameError:", error)
```

Output:

```text
2
ready
NameError: name 'n' is not defined
```

- The loop variable `i` is still available after the loop and keeps its last value.
- `status` was created inside an `if` block but is an ordinary module-level variable.
- The comprehension variable `n` does not leak, because comprehensions have their own scope. (Python 3.12 made comprehensions faster by inlining them, but kept this behaviour.)

One special case: the name in `except SomeError as error:` is deleted when the `except` block ends, so you cannot use `error` after the block. Copy it to another variable if you need it later.

## Common mistakes

- **Expecting `+=` to update a global.** `total += 1` inside a function assigns to `total`, so `total` becomes local and the line raises `UnboundLocalError`. Either declare `global total` or, better, pass the value in and return the new one.
- **Thinking `global` is needed to read a variable.** It is needed only to rebind. Adding `global` everywhere "just in case" makes code harder to follow.
- **Shadowing built-ins.** Using `list`, `dict`, `str`, `sum`, `max`, `id` or `input` as variable names hides the built-in for the rest of the scope:

  ```python
  list = [1, 2, 3]
  try:
      print(list("abc"))
  except TypeError as error:
      print("TypeError:", error)

  del list
  print(list("abc"))
  ```

  Output:

  ```text
  TypeError: 'list' object is not callable
  ['a', 'b', 'c']
  ```

  `del list` removes the global name, so the lookup reaches the built-in scope again. Better still, choose names like `items` or `numbers` in the first place.

- **Expecting methods to see class-level names directly.** A class body has its own namespace, but it is *not* an enclosing scope for the methods defined in it:

  ```python
  class Config:
      retries = 3

      def show(self):
          return retries


  try:
      Config().show()
  except NameError as error:
      print("NameError:", error)
  ```

  Output:

  ```text
  NameError: name 'retries' is not defined
  ```

  Use `self.retries` or `Config.retries` instead.

- **Assuming "global" means program-wide.** A global variable belongs to one module. Another module reaches it through the module object, for example `settings.debug` after `import settings`.

## Summary

- A scope is the region of code where a name is visible. Bindings are stored in namespaces, one per scope.
- Python has built-in, global (module), enclosing and local scopes, and looks names up in LEGB order: the first match wins.
- The built-in scope is available everywhere. The global scope covers a single module. A local scope exists only while a function call runs, and every call gets a new one.
- Assigning to a name anywhere in a function makes it local for the entire function, which is the cause of `UnboundLocalError`.
- `global name` lets a function rebind a module-level name. Reading globals and mutating global objects do not need it.
- Only modules, functions, classes and comprehensions create scopes. `if`, `for`, `while`, `with` and `try` blocks do not.
- Prefer arguments and return values over global state, and do not shadow built-in names.

## Practice

### Exercise 1: Predict the output

Without running the code, write down what it prints. Then run it and check.

```python
x = "global"


def first():
    x = "local"
    return x


def second():
    return x


def third():
    global x
    x = "changed"
    return x


print(first(), x)
print(second())
print(third(), x)
print(second())
```

### Exercise 2: Fix the running total

The code below raises `UnboundLocalError`. Fix it in two ways: (a) with the `global` keyword, and (b) without any global state, by making `add()` take the current total and return the new one.

```python
total = 0


def add(amount):
    total += amount
    return total


add(5)
add(10)
print(total)
```

### Exercise 3: Scope detective

Write a function `where_is(name)` that returns `"global"` if `name` is defined in the current module, `"built-in"` if it is a built-in name, and `"not found"` otherwise. Check globals first, so that the result follows the LEGB order. Test it with `"limit"` (a global you define), `"len"`, `"where_is"` and `"magic"`.

### Exercise 4: The disappearing `sum`

This script fails on its last line. Explain why, then fix it without using `del`.

```python
sum = 0
for price in [10, 20, 30]:
    sum += price
print(sum)

numbers = [1, 2, 3]
print(sum(numbers))
```

## Solutions

### Exercise 1

Output:

```text
local global
global
changed changed
changed
```

`first()` creates its own local `x`, so the global is untouched. `second()` only reads `x` and finds the global. `third()` declares `x` as global and rebinds it, so both the return value and the module-level `x` are `"changed"`, and the final `second()` call sees the new value.

### Exercise 2

(a) With `global`:

```python
total = 0


def add(amount):
    global total
    total += amount
    return total


add(5)
add(10)
print(total)
```

Output:

```text
15
```

(b) Without global state:

```python
def add(total, amount):
    return total + amount


total = 0
total = add(total, 5)
total = add(total, 10)
print(total)
```

Output:

```text
15
```

Version (b) is easier to test: `add(0, 5)` always returns `5`, no matter what happened before.

### Exercise 3

```python
import builtins

limit = 100


def where_is(name):
    if name in globals():
        return "global"
    if hasattr(builtins, name):
        return "built-in"
    return "not found"


print(where_is("limit"))
print(where_is("len"))
print(where_is("where_is"))
print(where_is("magic"))
```

Output:

```text
global
built-in
global
not found
```

`where_is` itself is a global name, because `def` at module level binds it in the global namespace.

### Exercise 4

The first line binds the global name `sum` to an `int`. From then on, the lookup for `sum` stops in the global scope and never reaches the built-in `sum()` function, so `sum(numbers)` tries to call the integer `60` and raises `TypeError: 'int' object is not callable`. Fix it by choosing a name that does not shadow a built-in:

```python
total = 0
for price in [10, 20, 30]:
    total += price
print(total)

numbers = [1, 2, 3]
print(sum(numbers))
```

Output:

```text
60
6
```

---

*Source: [pythontutorial.net — Python Variable Scopes](https://www.pythontutorial.net/advanced-python/python-variable-scopes/). Adapted and expanded for PyJourney.*
