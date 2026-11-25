# type Class

In Python everything is an object, and that includes classes. A class is an object too, and the class of that object is `type`. Knowing this explains what the `class` statement really does, lets you build classes at runtime, and is the foundation for metaclasses.

## What you'll learn

- Why classes are ordinary objects and why their type is `type`
- The two ways to call `type`: `type(obj)` and `type(name, bases, namespace)`
- What Python does step by step when it executes a `class` statement
- How to create classes dynamically, with methods, class attributes and inheritance
- How `type` and `object` relate to each other at the top of the hierarchy
- Why `type` is called a metaclass

## Classes are objects

Take an ordinary class:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def greeting(self):
        return f"Hi, I am {self.name}. I am {self.age} years old."


print(type(Person))
print(isinstance(Person, type))

# a class is an ordinary object: it can be stored, passed and called
factory = Person
people = [factory("John", 25), factory("Olena", 31)]
print(people[1].greeting())
print(Person.__name__, factory is Person)
```

Output:

```text
<class 'type'>
True
Hi, I am Olena. I am 31 years old.
Person True
```

`Person` is an object of the class `type`, just as `42` is an object of the class `int`. Like any object, a class can be assigned to another name, stored in a list, passed to a function and inspected through its attributes (`__name__`, `__dict__`, `__bases__`). Calling it creates instances.

The same is true for built-in classes, and even for `type` itself:

```python
class Person:
    pass


print(type(42))
print(type("hello"))
print(type(Person()))
print(type(Person))
print(type(int))
print(type(type))
```

Output:

```text
<class 'int'>
<class 'str'>
<class '__main__.Person'>
<class 'type'>
<class 'type'>
<class 'type'>
```

```text
 object          its class        class of the class
 Person()  --->  Person    --->   type
 42        --->  int       --->   type
 Person    --->  type      --->   type   (type(type) is type)
```

## Two ways to call `type`

`type` behaves differently depending on the number of arguments:

| Call | Result |
|---|---|
| `type(obj)` | the class of `obj` |
| `type(name, bases, namespace)` | a **new class** |

The three-argument form is the "constructor" of classes:

- `name` is a string that becomes the class's `__name__`, for example `"Person"`.
- `bases` is a **tuple** of base classes, for example `(object,)` or `(Person,)`. An empty tuple `()` means "inherit from `object` only".
- `namespace` is a dictionary of class attributes and methods. Its items are copied into the class's `__dict__`.

Any other number of arguments is an error (see *Common mistakes*).

## What happens when Python runs a `class` statement

The `class` statement is a convenient way to call `type` with three arguments. When Python reaches it, it:

1. Evaluates the base classes and finds the **metaclass** to use. By default that is `type`.
2. Prepares a fresh **namespace**, normally an empty dictionary (the metaclass's `__prepare__` method creates it).
3. **Executes the class body** inside that namespace. The body was already compiled into bytecode along with the rest of the module, so this is just running code. Every `def` and every assignment in the body becomes a key in the namespace.
4. Calls `metaclass(name, bases, namespace)`, which is `type("Person", (object,), namespace)` by default, and binds the resulting class object to the name `Person`.

You can peek at step 3 by printing the namespace from inside the body:

```python
class Demo:
    x = 1

    def hello(self):
        return "hi"

    print(sorted(locals()))
```

Output (Python 3.14):

```text
['__firstlineno__', '__module__', '__qualname__', 'hello', 'x']
```

Besides your `x` and `hello`, Python itself put a few entries into the namespace: `__module__` (the module where the class was defined), `__qualname__` (the qualified name) and, since Python 3.13, `__firstlineno__` (the line where the class starts).

> **Note:** Some tutorials say Python "extracts the class body as a string" and executes it. That is not what happens. The body is compiled once, together with the module, and its code is executed when the `class` statement runs. The `exec()` demo below only *imitates* this with a string.

## Emulating the `class` statement

To see that the `class` statement is "just" a call to `type`, repeat its steps by hand. Here `exec()` plays the role of executing the class body:

```python
class_body = """
def __init__(self, name, age):
    self.name = name
    self.age = age

def greeting(self):
    return f'Hi, I am {self.name}. I am {self.age} years old.'
"""

# 1. a namespace for the class
class_dict = {}

# 2. run the body inside that namespace
exec(class_body, globals(), class_dict)
print(list(class_dict))

# 3. build the class object
Person = type("Person", (object,), class_dict)

print(type(Person))
print(isinstance(Person, type))
print(list(Person.__dict__))

john = Person("John", 25)
print(john.greeting())
```

Output:

```text
['__init__', 'greeting']
<class 'type'>
True
['__init__', 'greeting', '__module__', '__dict__', '__weakref__', '__doc__']
Hi, I am John. I am 25 years old.
```

How it works:

- `exec(class_body, globals(), class_dict)` runs the two `def` statements. Because `class_dict` is passed as the *local* namespace, the new functions land there, not in the module's globals.
- `type("Person", (object,), class_dict)` turns that dictionary into a real class. `type` copies the functions into the class's `__dict__` and adds a few standard entries: `__module__`, `__doc__`, and the `__dict__` and `__weakref__` descriptors that give instances their attribute dictionary and weak-reference support.
- The result is a normal class that works exactly like one written with `class`.

> **Tip:** `exec()` is used here only to make the steps visible. Real code never needs it to build a class: you can pass ordinary functions to `type()` directly, as the next section shows. Running strings as code is also a security risk if any part of the string comes from users.

## Creating classes with `type()` directly

Define the methods as normal functions (each still takes `self`), then pass them in the namespace:

```python
def init(self, name):
    self.name = name


def greeting(self):
    return f"Hi, I am {self.name}."


Person = type("Person", (), {
    "species": "human",
    "__init__": init,
    "greeting": greeting,
})

Employee = type("Employee", (Person,), {
    "greeting": lambda self: Person.greeting(self) + " I work here.",
})

olena = Employee("Olena")
print(olena.greeting())
print(olena.species)
print(Employee.__mro__)
print(Person.__bases__)
```

Output:

```text
Hi, I am Olena. I work here.
human
(<class '__main__.Employee'>, <class '__main__.Person'>, <class 'object'>)
(<class 'object'>,)
```

- `"species": "human"` becomes a class attribute, shared by all instances.
- `Employee` inherits from `Person` because `(Person,)` is its `bases` tuple. It overrides `greeting` and inherits `__init__` and `species`.
- `()` as `bases` gave `Person` the base `object`, exactly like `class Person:`.

When is this useful? Whenever the *shape* of a class is known only at runtime: generating classes from a configuration file or a database schema, building many similar test or exception classes in a loop, or writing class factories such as `collections.namedtuple`. Most everyday code is clearer with the `class` statement.

A class built with `type()` differs from a `class` statement in one small detail: entries that the compiler adds, such as `__firstlineno__` and `__static_attributes__` (Python 3.13+), are missing, because there was no source code:

```python
class Person:
    pass


Person2 = type("Person", (), {})
print(sorted(Person.__dict__))
print(sorted(Person2.__dict__))
print(Person.__module__, Person2.__module__)
```

Output (Python 3.14):

```text
['__dict__', '__doc__', '__firstlineno__', '__module__', '__static_attributes__', '__weakref__']
['__dict__', '__doc__', '__module__', '__weakref__']
__main__ __main__
```

## `type` and `object` at the top of the hierarchy

Two built-in classes hold the whole system together:

- `object` is the **base class** of every class. `type` inherits from it too.
- `type` is the **class of every class**, including `object` and itself.

```python
print(isinstance(type, type))
print(isinstance(object, type))
print(issubclass(type, object))
print(type.__bases__)
print(object.__bases__)
```

Output:

```text
True
True
True
(<class 'object'>,)
()
```

```text
          "is an instance of"            "inherits from"

   object ----------> type          type ----------> object
   Person ----------> type          Person --------> object
   type   ----------> type          object --------> (nothing)
```

This looks circular, and it is: the interpreter sets up `type` and `object` specially at startup so that each can refer to the other.

## Why `type` is called a metaclass

A **metaclass** is a class whose instances are classes. Ordinary classes create objects. `type` creates classes, so `type` is a metaclass. In fact it is *the* default metaclass that Python uses for every `class` statement.

Because `type` is a class, you can inherit from it and override its methods (such as `__new__`). That gives you a custom metaclass that can change how classes are built. The next topic covers exactly that.

## Common mistakes

- **Checking types with `type(x) == SomeClass`.** It ignores inheritance. Prefer `isinstance()` unless you really need an exact match:

  ```python
  print(type(True) == int)
  print(isinstance(True, int))
  ```

  Output:

  ```text
  False
  True
  ```

- **Passing a class instead of a tuple as `bases`.** Even a single base must be wrapped in a tuple:

  ```python
  Person = type("Person", object, {})
  ```

  Output:

  ```text
  Traceback (most recent call last):
    File "app.py", line 1, in <module>
      Person = type("Person", object, {})
  TypeError: type.__new__() argument 2 must be tuple, not type
  ```

  Write `(object,)`, with the trailing comma, or simply `()`.

- **Calling `type` with two arguments.** Only one or three arguments are allowed:

  ```python
  Person = type("Person", (object,))
  ```

  Output:

  ```text
  Traceback (most recent call last):
    File "app.py", line 1, in <module>
      Person = type("Person", (object,))
  TypeError: type() takes 1 or 3 arguments
  ```

- **Thinking the `name` argument creates a variable.** `type()` only sets `__name__`. The variable is whatever you assign the result to, so keep them the same to avoid confusion:

  ```python
  Foo = type("Bar", (), {})
  print(Foo.__name__)
  print(Foo)
  ```

  Output:

  ```text
  Bar
  <class '__main__.Bar'>
  ```

- **Using `exec()` to build classes in real code.** Pass functions to `type()` instead.

## Summary

- Classes are objects. Every class, including `int`, `str` and your own, is an instance of `type`, and `type(type)` is `type`.
- `type(obj)` returns the class of an object. `type(name, bases, namespace)` creates a new class.
- The `class` statement prepares a namespace, executes the body in it and then calls `type(name, bases, namespace)`.
- The class body is compiled code, not a string. `exec()` can only imitate it.
- `bases` must be a tuple. An empty tuple means "inherit from `object`".
- `object` is the base of every class, `type` is the class of every class, and `type` itself inherits from `object`.
- Because `type` creates classes, it is a metaclass: the default one.

## Practice

### Exercise 1: Predict the output

Write down what each line prints, then run the code to check.

```python
class Animal:
    pass


class Dog(Animal):
    pass


rex = Dog()
print(type(rex).__name__)
print(type(Dog).__name__)
print(type(type(rex)) is type)
print(isinstance(rex, Animal), type(rex) is Animal)
```

### Exercise 2: Count values by type

Write a function `count_types(values)` that returns a dictionary mapping a type name to the number of values of that type. For `[1, "a", 2.5, 3, "b", None, True]` it should return `{'int': 2, 'str': 2, 'float': 1, 'NoneType': 1, 'bool': 1}`.

### Exercise 3: Classes without the `class` keyword

Using only `type()` and plain functions, create:

- `Rectangle` with a class attribute `sides = 4`, an `__init__(width, height)`, an `area()` method and a `__repr__` that shows the class name and both sizes, for example `Rectangle(3, 5)`;
- `Square`, a subclass of `Rectangle`, created as `Square(4)`.

Print a rectangle, a square, their areas, and check that a square is an instance of `Rectangle`.

### Exercise 4: A record class factory

Write a function `make_record(name, fields)` that builds and returns a new class with `type()`. The class must store the field names in a class attribute `fields` (as a tuple), accept one positional value per field in `__init__` and raise `TypeError` when the number of values is wrong, and have a `__repr__` like `Book(title='Dune', year=1965)`.

## Solutions

### Exercise 1

Output:

```text
Dog
type
True
True False
```

`type(rex)` is `Dog`, and the type of the class `Dog` is `type`. `isinstance()` takes inheritance into account, while `type(rex) is Animal` checks the exact class only.

### Exercise 2

```python
def count_types(values):
    counts = {}
    for value in values:
        name = type(value).__name__
        counts[name] = counts.get(name, 0) + 1
    return counts


print(count_types([1, "a", 2.5, 3, "b", None, True]))
```

Output:

```text
{'int': 2, 'str': 2, 'float': 1, 'NoneType': 1, 'bool': 1}
```

Here the exact type is exactly what we want, so `type()` is the right tool. `True` is counted as `bool`, not `int`.

### Exercise 3

```python
def __init__(self, width, height):
    self.width = width
    self.height = height


def area(self):
    return self.width * self.height


def __repr__(self):
    return f"{type(self).__name__}({self.width}, {self.height})"


Rectangle = type("Rectangle", (), {
    "sides": 4,
    "__init__": __init__,
    "area": area,
    "__repr__": __repr__,
})

Square = type("Square", (Rectangle,), {
    "__init__": lambda self, side: Rectangle.__init__(self, side, side),
})

r = Rectangle(3, 5)
s = Square(4)
print(r, r.area(), Rectangle.sides)
print(s, s.area(), isinstance(s, Rectangle))
print(type(Square).__name__)
```

Output:

```text
Rectangle(3, 5) 15 4
Square(4, 4) 16 True
type
```

`__repr__` uses `type(self).__name__`, so the subclass prints its own name without overriding the method.

### Exercise 4

```python
def make_record(name, fields):
    def __init__(self, *values):
        if len(values) != len(fields):
            raise TypeError(f"{name}() expects {len(fields)} values, got {len(values)}")
        for field, value in zip(fields, values):
            setattr(self, field, value)

    def __repr__(self):
        args = ", ".join(f"{field}={getattr(self, field)!r}" for field in fields)
        return f"{name}({args})"

    return type(name, (), {
        "fields": tuple(fields),
        "__init__": __init__,
        "__repr__": __repr__,
    })


Book = make_record("Book", ["title", "year"])
book = Book("Dune", 1965)
print(book)
print(book.title, Book.fields)

try:
    Book("Dune")
except TypeError as error:
    print("Error:", error)
```

Output:

```text
Book(title='Dune', year=1965)
Dune ('title', 'year')
Error: Book() expects 2 values, got 1
```

The inner functions are closures: they remember `name` and `fields` from the call to `make_record()`, so every generated class gets its own copy of them.

---

*Source: [pythontutorial.net — Python type Class](https://www.pythontutorial.net/python-oop/python-type-class/). Adapted and expanded for PyJourney.*
