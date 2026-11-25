# Dynamic Typing

In Python a type belongs to the **object**, not to the variable. A name can refer to a string now and to a number a moment later, and Python checks whether an operation makes sense only when that operation actually runs. This is called **dynamic typing**, and it explains both why Python code is short and flexible and why some bugs only show up at runtime.

## What you'll learn

- The difference between static and dynamic typing: where the type "lives"
- How rebinding a name to an object of another type works
- How to inspect types with `type()` and `isinstance()`
- Why Python is dynamically *and* strongly typed
- What duck typing is and why it follows from dynamic typing
- What type hints do (and do not do) at runtime

## Static typing: the type belongs to the variable

In statically typed languages such as Java, C# or C++, you declare a variable together with its type:

```java
String message = "Hello";
message = 100;   // compile error: incompatible types: int cannot be converted to String
```

Here the **variable** `message` has the type `String`. The compiler remembers it, and any attempt to store something else in that variable is rejected before the program even runs.

## Dynamic typing: the type belongs to the object

In Python you never declare a variable's type:

```python
message = "Hello"
print(type(message))

message = 100
print(type(message))
```

Output:

```text
<class 'str'>
<class 'int'>
```

`message` is just a name. The first assignment binds it to a `str` object, and the second rebinds it to a brand-new `int` object. `type(message)` does not report the type of the *variable* (it has none). It reports the type of the object the name refers to **right now**.

```text
after message = "Hello":          after message = 100:

message ---> +-------------+      message ---> +-------------+
             | str "Hello" |                   | int 100     |
             +-------------+                   +-------------+

                                               +-------------+
                                               | str "Hello" |  no references:
                                               +-------------+  destroyed
```

Nothing is converted. The string object never becomes a number. It simply loses its reference, and if no other name refers to it, it is destroyed. Another name that still refers to the string keeps it alive and unchanged:

```python
message = "Hello"
greeting = message
message = 100

print(message, type(message))
print(greeting, type(greeting))
print(message is greeting)
```

Output:

```text
100 <class 'int'>
Hello <class 'str'>
False
```

## Inspecting types: `type()` and `isinstance()`

`type(obj)` returns the exact class of an object. `isinstance(obj, cls)` asks a more useful question: "is this object an instance of `cls` **or of a subclass** of it?"

```python
value = True

print(type(value))
print(type(value) is int)
print(isinstance(value, int))
print(isinstance(3.5, (int, float)))
print(isinstance(3.5, int | float))
```

Output:

```text
<class 'bool'>
False
True
True
True
```

- `bool` is a subclass of `int`, so `True` is an `int` according to `isinstance()`, but its exact type is `bool`.
- `isinstance()` accepts a tuple of classes, and since Python 3.10 also a union written with `|`.

> **Tip:** Prefer `isinstance()` when you need to branch on a type. It respects inheritance, so subclasses of a type are handled correctly. Use `type(x) is SomeClass` only when you really need the exact class.

## Dynamic is not the same as weak

Two separate questions are often mixed up:

- **Static vs dynamic:** *when* are types checked? At compile time, or while the program runs?
- **Strong vs weak:** does the language silently convert values between unrelated types?

Python is **dynamic and strong**. It does not check types in advance, but it also refuses to guess what you meant when types do not fit:

```python
print("1" + 1)
```

Output:

```text
Traceback (most recent call last):
  ...
TypeError: can only concatenate str (not "int") to str
```

JavaScript, which is dynamic and *weak*, evaluates the same expression to the string `"11"`. In Python you convert explicitly and decide yourself what the result should be:

```python
print(int("1") + 1)
print("1" + str(1))
print(1 + 2.5)
print(True + 1)
print("3" * 2)
```

Output:

```text
2
11
3.5
2
33
```

The last three lines are not weak typing. They are operations that the types explicitly define: numbers of different kinds can be combined (`int` + `float` gives a `float`), `bool` is a subclass of `int`, and `str * int` is defined as repetition.

## Type errors appear at runtime

Because nothing is checked in advance, a function with a type problem is perfectly valid until the problematic line runs with unsuitable data:

```python
def total_length(items):
    return sum(len(item) for item in items)


print(total_length(["ab", "cde"]))
print(total_length(["ab", 5]))
```

Output:

```text
5
Traceback (most recent call last):
  ...
    return sum(len(item) for item in items)
               ~~~^^^^^^
TypeError: object of type 'int' has no len()
```

The first call works and prints `5`. The second fails only when `len(5)` is reached. In a large program such an error can hide in a rarely used branch for months. That is why Python projects rely on tests and, increasingly, on type hints with a static checker.

## Duck typing

"If it walks like a duck and quacks like a duck, it is a duck." Python code usually does not ask *what type* an object is. It just uses the operations it needs, and any object that supports them works:

```python
def describe_size(thing):
    return f"{type(thing).__name__} of length {len(thing)}"


class Playlist:
    def __init__(self, songs):
        self.songs = songs

    def __len__(self):
        return len(self.songs)


print(describe_size("hello"))
print(describe_size([1, 2, 3]))
print(describe_size({"a": 1}))
print(describe_size(Playlist(["Intro", "Outro"])))
```

Output:

```text
str of length 5
list of length 3
dict of length 1
Playlist of length 2
```

`describe_size()` never checks the type of its argument. It only needs `len()` to work, so strings, lists, dicts, and even our own `Playlist` class (which defines `__len__`) are all accepted. This flexibility is the main benefit of dynamic typing.

## Type hints: optional and not enforced

You can annotate functions (since Python 3.5) and variables (since Python 3.6) with **type hints**:

```python
def greet(name: str) -> str:
    return "Hello, " + name


print(greet("Olena"))
print(greet.__annotations__)

age: int = 30
age = "thirty"   # no error at runtime
print(age)
```

Output:

```text
Hello, Olena
{'name': <class 'str'>, 'return': <class 'str'>}
thirty
```

The interpreter stores the hints, but it **does not enforce them**: assigning a string to `age` works without any complaint. Hints are used by editors and by static type checkers such as mypy or Pyright, which read the code without running it. Save the example above as `hints.py` and check it (mypy is a third-party tool: `pip install mypy`):

```bash
mypy hints.py
```

Output:

```text
hints.py:9: error: Incompatible types in assignment (expression has type "str", variable has type "int")  [assignment]
Found 1 error in 1 file (checked 1 source file)
```

Type hints give you many benefits of static typing (early error detection, better autocompletion, self-documenting code) while Python itself stays dynamic.

## Trade-offs

| Dynamic typing gives you | Dynamic typing costs you |
|---|---|
| Short code without type declarations | Type errors surface only at runtime |
| Duck typing: one function works with many types | A name's type can be unclear when reading code |
| Fast prototyping and interactive experiments | You need tests (and optionally type hints) to stay safe |

## Common mistakes

- **Forgetting that `input()` returns a string.** `age = input("Age: ")` followed by `age + 1` raises `TypeError: can only concatenate str (not "int") to str`. Convert first: `int(input("Age: "))`.
- **Reusing one name for different kinds of data.** `data = "1,2,3"`, then `data = data.split(",")`, then `data = [int(x) for x in data]` is legal, but a reader must track which type `data` has on each line. Use separate names: `raw`, `parts`, `numbers`.
- **Shadowing built-in names.** Any name can be rebound, including built-ins:

  ```python
  list = [1, 2, 3]
  letters = list("abc")
  ```

  Output:

  ```text
  Traceback (most recent call last):
    ...
  TypeError: 'list' object is not callable
  ```

  Avoid names such as `list`, `dict`, `str`, `id`, `type`, `input`, `sum`.
- **Checking types with `type(x) == int`.** It rejects subclasses and is rarely what you want. Use `isinstance(x, int)`, and remember that `isinstance(True, int)` is `True`.
- **Believing type hints are checked at runtime.** They are not. Run a type checker such as mypy to get the benefit.

## Summary

- In Python, variables have no type. Objects do, and a name can be rebound to an object of any type.
- `type(obj)` returns the exact class of the object a name refers to; `isinstance(obj, cls)` also accepts subclasses.
- Rebinding never converts an object. It points the name at a different object.
- Python is dynamically typed (types are checked at runtime) and strongly typed (no silent conversions between unrelated types).
- Duck typing means relying on what an object can do rather than on its declared type.
- Type hints document intent and power static checkers, but the interpreter does not enforce them.

## Practice

### Exercise 1: Follow the type

Predict each printed line before running the code.

```python
x = 42
print(type(x).__name__)

x = x / 2
print(type(x).__name__, x)

x = str(x)
print(type(x).__name__, x)

x = x.split(".")
print(type(x).__name__, x)

x = len(x) > 1
print(type(x).__name__, x)
```

### Exercise 2: Fix the order total

The code below crashes. Explain the error, fix it so that it prints `7.5`, and predict what `quantity * 2` would print and why that is dangerous.

```python
quantity = "3"      # came from a web form, so it is a string
price = 2.5

total = quantity * price
print(total)
```

### Exercise 3: Describe a value

Write `describe(value)` that returns `"boolean"`, `"integer"`, `"float"`, `"string"`, `"sequence"` (for lists and tuples) or `"other"`. Test it with `True`, `7`, `2.5`, `"hi"`, `[1]`, `(1, 2)` and `None`. Make sure `describe(True)` returns `"boolean"`, not `"integer"`.

### Exercise 4: Duck-typed total size

Write `total_size(items)` that adds up `len(item)` for every item that supports `len()` and counts the items that do not. Return a tuple `(total, skipped)`. Do not check types with `isinstance()`: just try `len()` and handle the failure. For `["abc", [1, 2], 10, {"k": "v"}, None]` the result must be `(6, 2)`.

## Solutions

### Exercise 1

Output:

```text
int
float 21.0
str 21.0
list ['21', '0']
bool True
```

The name `x` is rebound five times. `/` always returns a `float`, `str()` creates a new string, `split()` returns a list, and a comparison returns a `bool`.

### Exercise 2

The original code fails with:

```text
TypeError: can't multiply sequence by non-int of type 'float'
```

`quantity` is a string, and Python will not silently turn it into a number. Fixed version:

```python
quantity = "3"
price = 2.5

print(quantity * 2)          # str * int repeats the string

total = int(quantity) * price
print(total)
```

Output:

```text
33
7.5
```

`"3" * 2` does not raise an error: it repeats the string and gives `"33"`. This is dangerous because a missing conversion produces a wrong result instead of a crash.

### Exercise 3

```python
def describe(value):
    if isinstance(value, bool):          # must come before int
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "float"
    if isinstance(value, str):
        return "string"
    if isinstance(value, (list, tuple)):
        return "sequence"
    return "other"


for item in [True, 7, 2.5, "hi", [1], (1, 2), None]:
    print(repr(item), "->", describe(item))
```

Output:

```text
True -> boolean
7 -> integer
2.5 -> float
'hi' -> string
[1] -> sequence
(1, 2) -> sequence
None -> other
```

`bool` is a subclass of `int`, so `isinstance(True, int)` is `True`. The `bool` check must come first.

### Exercise 4

```python
def total_size(items):
    total = 0
    skipped = 0
    for item in items:
        try:
            total += len(item)
        except TypeError:
            skipped += 1
    return total, skipped


print(total_size(["abc", [1, 2], 10, {"k": "v"}, None]))
print(total_size([]))
```

Output:

```text
(6, 2)
(0, 0)
```

This style is called EAFP ("easier to ask forgiveness than permission"): try the operation and handle the exception. It works with any object that defines `__len__`, including classes that do not exist yet.

---

*Source: [pythontutorial.net — Dynamic Typing in Python](https://www.pythontutorial.net/advanced-python/dynamic-typing-in-python/). Adapted and expanded for PyJourney.*
