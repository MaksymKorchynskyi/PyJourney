# __new__ Method

Calling a class, such as `Person("John")`, looks like a single step, but Python actually does two things: `__new__` **creates** the object and `__init__` **initializes** it. You rarely need to touch `__new__`, but it is the only hook that runs *before* the object exists. That makes it the right tool for subclassing immutable types like `int` and `str`, and for controlling which object a class call returns.

## What you'll learn

- How Python creates an object in two steps: `__new__` first, then `__init__`
- The signature of `__new__` and why it receives the class instead of an instance
- How to reproduce `Person("John")` by hand, and why `pickle` and `copy` skip `__init__`
- When Python calls `__init__` after `__new__`, and when it silently skips it
- Why subclasses of immutable types (`int`, `str`, `tuple`) need `__new__`
- Practical patterns (validated immutable values, cached instances) and when not to use `__new__`

## Two steps of object creation

Add a `print()` to both methods to see the order in which Python calls them:

```python
class Person:
    def __new__(cls, name):
        print(f"__new__ called: creating a {cls.__name__} object")
        obj = super().__new__(cls)
        print(f"__new__ returns the object, __dict__ = {obj.__dict__}")
        return obj

    def __init__(self, name):
        print(f"__init__ called: setting name to {name!r}")
        self.name = name


person = Person("John")
print(person.name)
```

Output:

```text
__new__ called: creating a Person object
__new__ returns the object, __dict__ = {}
__init__ called: setting name to 'John'
John
```

`__new__` receives the class (`cls`) and the arguments of the call. Its job is to create the object and **return** it. At that moment the object exists but has no attributes yet, so its `__dict__` is empty. Python then passes the same arguments to `__init__`, which fills in the attributes. `__init__` returns `None`. The caller receives the object that `__new__` returned.

```text
Person("John")
   |
   |  1. obj = Person.__new__(Person, "John")    create an empty object
   |  2. if isinstance(obj, Person):
   |         obj.__init__("John")                 fill in its attributes
   |  3. return obj
   v
person
```

Who runs this algorithm? A class can be called because its own type, `type`, defines `__call__`, and `type.__call__` performs exactly these steps. The next topics on `type` and metaclasses build on this.

## The signature of `__new__`

```python
object.__new__(cls, *args, **kwargs)
```

- `cls` is the class to instantiate. Python passes it automatically, just as it passes `self` to regular methods. There is no instance yet, so `__new__` cannot receive `self`.
- The other arguments are exactly the ones passed to the class call. The same arguments go to `__init__` later, which is why both methods usually have the same parameters.
- `__new__` is a **static method**. Python wraps it automatically when it creates the class, so you never write `@staticmethod` for it:

```python
class Person:
    def __new__(cls, name):
        return super().__new__(cls)

    def __init__(self, name):
        self.name = name


print(type(Person.__dict__["__new__"]))
print(type(Person.__dict__["__init__"]))
```

Output:

```text
<class 'staticmethod'>
<class 'function'>
```

To actually create the object, call the parent implementation: `super().__new__(cls)`. For an ordinary class this ends up in `object.__new__`, which allocates an empty instance of `cls`. Pass it **only** `cls`. `object.__new__` does not accept the other call arguments when you override `__new__` (see *Common mistakes*). Built-in immutable types are different: `int.__new__(cls, value)` and `str.__new__(cls, text)` need the value, because that is where the value is stored.

## Creating an object by hand

You can perform both steps yourself. This is a good way to see what each method contributes:

```python
class Person:
    def __init__(self, name):
        self.name = name


# what Person("John") does, step by step
person = object.__new__(Person)
print(type(person).__name__, person.__dict__)

person.__init__("John")
print(type(person).__name__, person.__dict__)
```

Output:

```text
Person {}
Person {'name': 'John'}
```

After `object.__new__(Person)` the object is already a `Person`, but it has no `name`. Only the call to `__init__` adds the attribute. When you call `__new__` directly, nothing calls `__init__` for you. Only the class call `Person(...)` runs both steps.

> **Note:** Some tutorials write `object.__new__(Person, "John")`. This happens to work only because `Person` overrides `__init__` but not `__new__`, and the extra argument is silently ignored. Pass the class alone.

### Where Python skips `__init__` on purpose

`pickle` and `copy` create objects exactly this way. They call `cls.__new__(cls)` and then restore the saved attributes directly into `__dict__`, without running `__init__`:

```python
import pickle


class Account:
    def __init__(self, owner):
        print(f"__init__ runs for {owner}")
        self.owner = owner


original = Account("Olena")
data = pickle.dumps(original)

print("Unpickling...")
restored = pickle.loads(data)
print(restored.owner, restored is original)
```

Output:

```text
__init__ runs for Olena
Unpickling...
Olena False
```

The restored object has the right attributes, but `__init__` never ran a second time. If your `__init__` has important side effects (registering the object somewhere, opening a file), they will not happen for unpickled or copied objects.

## When `__init__` runs and when it does not

After `__new__` returns, Python checks the result:

- if it is an instance of `cls` (or of a subclass), Python calls its `__init__` with the same arguments;
- otherwise Python **skips** `__init__`, and the caller simply receives whatever `__new__` returned.

```python
class Weird:
    def __new__(cls):
        return "I am a string, not a Weird"

    def __init__(self):
        print("__init__ called")


w = Weird()
print(w, type(w))
```

Output:

```text
I am a string, not a Weird <class 'str'>
```

`__init__` was never called, and `Weird()` did not even produce a `Weird`. This is legal, but surprising for anyone who reads the code, so return an object of another type only when you have a very good reason.

The most common way to hit this rule by accident is to forget `return`:

```python
class Person:
    def __new__(cls, name):
        obj = super().__new__(cls)
        # forgot: return obj

    def __init__(self, name):
        print("__init__ called")
        self.name = name


person = Person("John")
print(person)
```

Output:

```text
None
```

A function without `return` returns `None`. `None` is not a `Person`, so `__init__` is skipped and `person` ends up as `None`, with no error at all.

## Subclassing immutable types

This is the main practical use of `__new__`. Here is an `int` subclass that stores the square of its argument:

```python
class SquareNumber(int):
    def __new__(cls, value):
        return super().__new__(cls, value ** 2)


x = SquareNumber(3)
print(x)
print(type(x).__name__)
print(isinstance(x, int))
print(x + 1, type(x + 1).__name__)
```

Output:

```text
9
SquareNumber
True
10 int
```

`x` is a `SquareNumber` and also an `int`, so it works everywhere an integer is expected.

Why can't `__init__` do this? `int`, `float`, `str`, `tuple`, `bytes` and `frozenset` are **immutable**. Their value is fixed when the object is created, which happens inside `__new__`. By the time `__init__` runs, the object `3` already exists and can never change. Trying anyway fails:

```python
class SquareNumber(int):
    def __init__(self, value):
        super().__init__(value ** 2)


x = SquareNumber(3)
```

Output:

```text
Traceback (most recent call last):
  File "app.py", line 6, in <module>
    x = SquareNumber(3)
  File "app.py", line 3, in __init__
    super().__init__(value ** 2)
    ~~~~~~~~~~~~~~~~^^^^^^^^^^^^
TypeError: object.__init__() takes exactly one argument (the instance to initialize)
```

`int` has no `__init__` of its own, so `super().__init__` reaches `object.__init__`, which accepts no extra arguments. And even without the error there would be nothing to change: assigning to `self` inside `__init__` only rebinds a local name.

```python
class SquareNumber(int):
    def __init__(self, value):
        self = value ** 2  # only rebinds the local name


x = SquareNumber(3)
print(x)
```

Output:

```text
3
```

A more realistic example is a string type that normalizes and validates its value once, when it is created:

```python
class Tag(str):
    def __new__(cls, text):
        normalized = text.strip().lower().replace(" ", "-")
        if not normalized:
            raise ValueError("a tag cannot be empty")
        return super().__new__(cls, normalized)


tag = Tag("  Python Basics ")
print(repr(tag))
print(tag.upper())
print(tag == "python-basics")
print({tag: 1}["python-basics"])
```

Output:

```text
'python-basics'
PYTHON-BASICS
True
1
```

Every `Tag` is guaranteed to be clean, and it still behaves like a normal `str`: it has all the string methods, compares equal to plain strings and works as a dictionary key.

> **Tip:** Operations on a subclass of a built-in type usually return the *base* type. Above, `x + 1` is a plain `int`, not a `SquareNumber`, and `tag.upper()` is a plain `str`. If you need to keep the subclass, override the relevant methods.

## Setting attributes in `__new__`

`__new__` holds the new object before returning it, so it can also set attributes:

```python
class Person:
    def __new__(cls, first_name, last_name):
        # create a new object
        obj = super().__new__(cls)

        # initialize attributes
        obj.first_name = first_name
        obj.last_name = last_name

        # add one more attribute
        obj.full_name = f"{first_name} {last_name}"
        return obj


person = Person("John", "Doe")
print(person.full_name)
print(person.__dict__)
```

Output:

```text
John Doe
{'first_name': 'John', 'last_name': 'Doe', 'full_name': 'John Doe'}
```

This works, and some tutorials conclude that once you override `__new__` you no longer need `__init__`. In practice, prefer the opposite rule: put ordinary attribute setup in `__init__` and use `__new__` only for what `__init__` **cannot** do. Readers, IDEs and subclasses all expect initialization in `__init__`. For a class like this `Person`, `__new__` adds nothing but surprise.

## Controlling how many objects exist

Because `__new__` decides which object to return, it can return an object that **already exists**. This is how a singleton (a class with only one instance) is often written. There is a trap, though:

```python
class Config:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            print("Creating the only Config object")
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        print("__init__ called")
        self.debug = False


first = Config()
first.debug = True

second = Config()
print(first is second)
print(first.debug)
```

Output:

```text
Creating the only Config object
__init__ called
__init__ called
True
False
```

There really is only one object, but `__init__` ran on **every** call, because each time `__new__` returned an instance of `Config`. The second call quietly reset `debug` to `False`. One fix is to do the one-time setup inside `__new__`, at the moment the object is created, and to drop `__init__`:

```python
class Config:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            print("Creating the only Config object")
            instance = super().__new__(cls)
            instance.debug = False  # one-time setup lives here
            cls._instance = instance
        return cls._instance


first = Config()
first.debug = True

second = Config()
print(first is second)
print(second.debug)
```

Output:

```text
Creating the only Config object
True
True
```

> **Note:** In real projects a singleton class is rarely needed. A module is imported only once, so an object created at module level (`config = Config()`) is already "the only one". Use `__new__` for this when the class itself must enforce it.

## `__new__` vs `__init__` at a glance

| | `__new__` | `__init__` |
|---|---|---|
| First parameter | `cls`, the class | `self`, the new object |
| Kind of method | static (added automatically) | regular instance method |
| Job | create and return the object | set up an object that already exists |
| Return value | the object (normally an instance of `cls`) | must be `None` |
| When it runs | first, on every class call | after `__new__`, only if it returned an instance of `cls` |
| Typical use | immutable subclasses, caching, singletons | almost everything else |

## Common mistakes

- **Forgetting `return` in `__new__`.** The class call then returns `None`, `__init__` is skipped, and there is no error message to warn you.
- **Passing the call arguments to `object.__new__`.** When you override `__new__`, call `super().__new__(cls)` with the class only:

  ```python
  class Person:
      def __new__(cls, name):
          return super().__new__(cls, name)

      def __init__(self, name):
          self.name = name


  person = Person("John")
  ```

  Output:

  ```text
  Traceback (most recent call last):
    File "app.py", line 9, in <module>
      person = Person("John")
    File "app.py", line 3, in __new__
      return super().__new__(cls, name)
             ~~~~~~~~~~~~~~~^^^^^^^^^^^
  TypeError: object.__new__() takes exactly one argument (the type to instantiate)
  ```

- **Trying to change an immutable value in `__init__`.** For subclasses of `int`, `str`, `tuple` and friends, the value must be set in `__new__`.
- **Expecting `__init__` to run once for cached objects.** If `__new__` returns an existing instance of the class, `__init__` runs on it again and can overwrite its state.
- **Using `__new__` for ordinary setup.** It works, but it makes the class harder to read and to subclass. Keep `__init__` for that.
- **Relying on `__init__` side effects for copies.** `pickle.loads()`, `copy.copy()` and `copy.deepcopy()` create objects without calling `__init__`.

## Summary

- A class call runs two steps: `__new__(cls, ...)` creates the object, then `__init__(self, ...)` initializes it.
- `__new__` is a static method that receives the class. Python adds the `staticmethod` wrapper automatically.
- Create the object with `super().__new__(cls)` and always `return` it.
- `__init__` runs only if `__new__` returned an instance of the class. Otherwise it is skipped.
- Immutable built-in types get their value in `__new__`, so subclasses of `int`, `str` or `tuple` must customize `__new__`, not `__init__`.
- `__new__` can return an existing object (caching, singletons), but then `__init__` runs again on every call.
- `pickle` and `copy` create objects through `__new__` and skip `__init__`.
- For everyday classes, `__init__` is enough. Reach for `__new__` only when `__init__` cannot do the job.

## Practice

### Exercise 1: Predict the output

Without running the code, write down what it prints. Then run it and check.

```python
class Box:
    def __new__(cls, value):
        print("new", value)
        if value < 0:
            return None
        return super().__new__(cls)

    def __init__(self, value):
        print("init", value)
        self.value = value


a = Box(5)
b = Box(-1)
print(type(a).__name__, b)
```

### Exercise 2: Positive integers only

Write a class `PositiveInt` that inherits from `int`. Creating it with a value that is zero or negative must raise `ValueError` with a helpful message. It should accept anything `int()` accepts, so `PositiveInt("7")` is valid.

### Exercise 3: An immutable point

Write a class `Point` that inherits from `tuple` and is created as `Point(3, 4)`. Add read-only properties `x` and `y` and a `__repr__` that returns `Point(x=3, y=4)`. Check that a point compares equal to the tuple `(3, 4)`, can be unpacked with `x, y = p`, and that `p.x = 10` raises `AttributeError`.

### Exercise 4: One object per color

Write a class `Color` so that `Color("red")` and `Color("RED")` return **the same object**, while `Color("blue")` returns a different one. Store the lowercase name in `name` and count the objects actually created in a class attribute `created`. Make sure repeated calls do not reset any state.

## Solutions

### Exercise 1

Output:

```text
new 5
init 5
new -1
Box None
```

`Box(5)` returns a new `Box`, so `__init__` runs. For `Box(-1)`, `__new__` returns `None`. That is not a `Box`, so `__init__` is skipped and `b` is `None`.

### Exercise 2

```python
class PositiveInt(int):
    def __new__(cls, value):
        number = super().__new__(cls, value)
        if number <= 0:
            raise ValueError(f"expected a positive integer, got {number}")
        return number


print(PositiveInt(42))
print(PositiveInt("7") + 1)
print(isinstance(PositiveInt(3), int))

try:
    PositiveInt(0)
except ValueError as error:
    print("Error:", error)
```

Output:

```text
42
8
True
Error: expected a positive integer, got 0
```

`int.__new__` does the conversion (including from strings), and the check runs on the finished number before it is returned.

### Exercise 3

```python
class Point(tuple):
    def __new__(cls, x, y):
        return super().__new__(cls, (x, y))

    @property
    def x(self):
        return self[0]

    @property
    def y(self):
        return self[1]

    def __repr__(self):
        return f"Point(x={self.x}, y={self.y})"


p = Point(3, 4)
print(p)
print(p.x, p.y)
print(p == (3, 4))
x, y = p
print(x + y)

try:
    p.x = 10
except AttributeError as error:
    print("Error:", error)
```

Output:

```text
Point(x=3, y=4)
3 4
True
7
Error: property 'x' of 'Point' object has no setter
```

`tuple.__new__` expects one iterable, so `__new__` packs `x` and `y` into `(x, y)`. The standard library offers the same idea ready-made: `collections.namedtuple` and `typing.NamedTuple`.

### Exercise 4

```python
class Color:
    _cache = {}
    created = 0

    def __new__(cls, name):
        key = name.lower()
        if key not in cls._cache:
            obj = super().__new__(cls)
            obj.name = key
            cls._cache[key] = obj
            cls.created += 1
        return cls._cache[key]

    def __repr__(self):
        return f"Color({self.name!r})"


red1 = Color("red")
red2 = Color("RED")
blue = Color("blue")

print(red1, red2, blue)
print(red1 is red2)
print(Color.created)
```

Output:

```text
Color('red') Color('red') Color('blue')
True
2
```

The attributes are set only when a new object is created, and the class has no `__init__`, so repeated calls cannot overwrite anything.

---

*Source: [pythontutorial.net — Python `__new__`](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__new__/) (archived copy). Adapted and expanded for PyJourney.*
