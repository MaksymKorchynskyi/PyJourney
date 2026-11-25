# Class

A **class** is the blueprint from which objects are created. It describes what data every object of that kind holds and what it can do. This topic looks at what an object is made of, how to define a class and create instances, how to inspect an object's identity and type, and why a class is itself an object.

## What you'll learn

- What an object consists of: state (attributes) and behaviour (methods)
- How to define a class and name it according to Python conventions
- How to create instances and read what `print()` shows for them
- How to check an object's identity with `id()` and its class with `isinstance()` and `type()`
- Why a class is also an object, an instance of `type`, and what you can do with that

## Objects: state and behaviour

An object is a container that holds **data** and **functionality** together.

- The data describes the object at a particular moment, so it is called the object's **state**. Python models state with **attributes**.
- The functionality describes what the object can do, its **behaviour**. Python models behaviour with functions. A function attached to an object is called a **method**.

A list is a familiar example. Its items are its state, and methods such as `append()` are its behaviour. Calling a method can change the state:

```python
cart = ["apple", "bread"]
print(cart)
cart.append("milk")
print(cart)
```

Output:

```text
['apple', 'bread']
['apple', 'bread', 'milk']
```

Before you can create your own kind of object, you define a **class**. From one class you can create as many objects as you need. Objects created from a class are called **instances** of that class.

## Defining a class

Write the `class` keyword, the class name and a colon. Everything indented below belongs to the class body:

```python
class Person:
    pass
```

The body cannot be empty, so `pass` stands in as a placeholder until you add real code. A docstring also counts as a body, and it is the better choice because it documents the class:

```python
class SalesEmployee:
    """An employee who earns a commission on sales."""


print(SalesEmployee.__doc__)
```

Output:

```text
An employee who earns a commission on sales.
```

### Naming classes

PEP 8, Python's style guide, says that class names use **CapWords** (also called PascalCase or CamelCase): every word starts with a capital letter and there are no underscores.

| Good | Avoid |
|---|---|
| `Person` | `person` |
| `SalesEmployee` | `sales_employee`, `Sales_Employee` |
| `HttpRequest` | `httprequest` |

Python does not enforce this, but following it lets readers tell classes (`Person`) apart from functions and variables (`person`, `get_person`) at a glance. Built-in types such as `int`, `str` and `list` are the historical exception.

### The class body runs once

The class body is ordinary code. Python executes it **once**, when it reaches the `class` statement, and every name assigned in the body becomes an attribute of the class:

```python
print("before the class")


class Greeter:
    print("running the class body")
    greeting = "Hello"


print("after the class")
print(Greeter.greeting)
```

Output:

```text
before the class
running the class body
after the class
Hello
```

Defining a class does not create any instances. It only creates the class itself.

## Creating instances

To create an instance, call the class with parentheses, just like a function:

```python
class Person:
    pass


person = Person()
print(person)
```

Output (the address varies from run to run):

```text
<__main__.Person object at 0x102ec92b0>
```

This default text has three parts:

- `__main__` is the **module** where the class was defined. When you run a file directly, its module name is `__main__`. If the class lived in `people.py` and was imported, you would see `people.Person`.
- `Person` is the class name.
- `0x102ec92b0` is where the object lives in memory (in CPython).

The default text is not very informative. You can replace it by defining the special method `__repr__`, which later topics cover in detail:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return f"Person(name={self.name!r})"


print(Person("John"))
```

Output:

```text
Person(name='John')
```

### Every call creates a new object

Two calls give two separate objects, even if they look the same. By default `==` on your own classes compares identity, so two different instances are not equal:

```python
class Person:
    pass


a = Person()
b = Person()
print(a is b)
print(a == b)
```

Output:

```text
False
False
```

You can teach a class what "equal" means by defining `__eq__`. Until you do, every instance is equal only to itself.

## Object identity: `id()`

Every object has an identity, returned by the built-in `id()` function. In CPython it is the object's memory address, the same number you saw in the default printout. `hex()` converts it into the familiar `0x...` form:

```python
class Person:
    pass


person = Person()
print(person)
print(id(person))
print(hex(id(person)))
```

Output (the numbers vary from run to run):

```text
<__main__.Person object at 0x102ec92b0>
4344025776
0x102ec92b0
```

The identity is unique **only among objects that exist at the same time**. After an object is destroyed, its `id()` may be reused by a new object. Use identities for comparisons (`a is b`), never as stored keys or hard-coded values.

## Checking the class: `isinstance()` and `type()`

`isinstance(obj, cls)` returns `True` if `obj` is an instance of `cls` **or of any subclass of it**. `type(obj)` returns the object's exact class:

```python
class Person:
    pass


class Employee(Person):
    pass


worker = Employee()
print(isinstance(worker, Employee))
print(isinstance(worker, Person))
print(type(worker))
print(type(worker) is Person)
print(isinstance(42, (int, float)))
```

Output:

```text
True
True
<class '__main__.Employee'>
False
True
```

An `Employee` *is a* `Person`, so `isinstance()` says `True`, while the exact-type check `type(worker) is Person` says `False`. The last line shows that `isinstance()` also accepts a tuple of classes and returns `True` if any of them matches.

> **Tip:** Prefer `isinstance()` for type checks. It respects inheritance, so subclasses work wherever their parent class works. Use `type(obj) is Cls` only when you really need to exclude subclasses.

## A class is also an object

Everything in Python is an object, and classes are no exception. When Python runs a `class` statement, it creates a **class object** and binds it to the class name. Like any object, it has attributes:

```python
class Person:
    pass


print(Person.__name__)
print(Person.__module__)
print(type(Person))
print(isinstance(Person, type))
```

Output:

```text
Person
__main__
<class 'type'>
True
```

The type of a class is `type`. In other words, `Person` is an **instance of `type`**, just as `person` is an instance of `Person`. And the behaviour of a class object is to create new instances when you call it.

```text
person  --instance of-->  Person  --instance of-->  type
```

### Classes are first-class values

Because a class is an ordinary object, you can bind it to another name, pass it to a function, return it, or store it in a container:

```python
class Cat:
    pass


class Dog:
    pass


def make(animal_class):
    return animal_class()


Pet = Dog
print(Pet.__name__)
print(type(make(Cat)).__name__)

registry = {"cat": Cat, "dog": Dog}
print(type(registry["dog"]()).__name__)
```

Output:

```text
Dog
Cat
Dog
```

This is how factories and plugin registries work: code chooses a class at run time and then calls it.

### Creating a class with `type()`

Since classes are instances of `type`, you can also create one by calling `type(name, bases, namespace)` directly. The `class` statement is the readable way to do the same thing:

```python
Point = type("Point", (), {"x": 0, "y": 0})

p = Point()
print(Point.__name__, p.x, p.y)
print(type(Point))
```

Output:

```text
Point 0 0
<class 'type'>
```

You will rarely need this in everyday code, but it shows that there is nothing magical about classes: they are objects produced by `type`.

## Common mistakes

- **Forgetting the parentheses.** `person = Person` does not create an instance. It just gives the class a second name:

  ```python
  class Person:
      pass


  person = Person
  print(person)
  print(person is Person)
  ```

  Output:

  ```text
  <class '__main__.Person'>
  True
  ```

- **Leaving the class body empty.** A `class` line followed by nothing indented is a syntax error. Use `pass`, `...` or a docstring:

  ```text
  IndentationError: expected an indented block after class definition on line 1
  ```

- **Naming classes like functions.** `class sales_employee:` works, but it breaks the convention every Python developer relies on to recognize classes.

- **Expecting `==` to compare attributes.** Two separately created instances with identical data are *not* equal unless the class defines `__eq__`.

- **Checking types with `type(obj) == Cls`.** This rejects subclasses. Use `isinstance(obj, Cls)` instead.

- **Relying on `id()` values or addresses.** They change between runs and can be reused once an object is gone.

## Summary

- An object bundles state (attributes) and behaviour (methods). A class is the blueprint, and the objects created from it are its instances.
- Define a class with `class Name:` and name it in CapWords. Use `pass` or a docstring for an empty body.
- The class body runs once, at definition time. Creating instances happens later, by calling the class: `Name()`.
- Each call creates a new, distinct object. By default, `==` between instances compares identity.
- `id()` returns an object's identity (its address in CPython). It is unique only among living objects.
- `isinstance()` checks the class and respects inheritance. `type()` returns the exact class.
- A class is itself an object, an instance of `type`, so it can be passed around, stored and created dynamically.

## Practice

### Exercise 1: Two cars

Define a class `Car` whose body is only a docstring. Create two instances and print:

1. whether they are the same object;
2. whether both are instances of `Car`;
3. the class's docstring.

### Exercise 2: Describe any class

Write a function `describe_class(cls)` that returns a string in this format:

```text
<name> from module <module>, an instance of <metaclass name>
```

Call it with your own class `Car` and with the built-in class `int`. What does the result for `int` tell you?

### Exercise 3: A shape factory

Define three empty classes `Circle`, `Square` and `Triangle`. Store them in a dictionary under the keys `"circle"`, `"square"` and `"triangle"`. Write a function `create(kind)` that returns a new instance of the matching class or raises `ValueError` with a helpful message for an unknown kind. Create shapes from the list `["circle", "square"]`, print their class names, and then show what happens for `"hexagon"`.

### Exercise 4: Predict the output

Write down what each line prints before running the code.

```python
class Animal:
    pass


class Dog(Animal):
    pass


rex = Dog()
print(isinstance(rex, Animal))
print(type(rex) is Animal)
print(isinstance(Dog, type))
print(isinstance(rex, type))
print(type(Dog) is type(Animal))
```

## Solutions

### Exercise 1

```python
class Car:
    """A car that can be driven around."""


first = Car()
second = Car()
print(first is second)
print(isinstance(first, Car) and isinstance(second, Car))
print(Car.__doc__)
```

Output:

```text
False
True
A car that can be driven around.
```

### Exercise 2

```python
class Car:
    """A car that can be driven around."""


def describe_class(cls):
    return f"{cls.__name__} from module {cls.__module__}, an instance of {type(cls).__name__}"


print(describe_class(Car))
print(describe_class(int))
```

Output:

```text
Car from module __main__, an instance of type
int from module builtins, an instance of type
```

Built-in types are classes too. `int` lives in the `builtins` module and, like your own classes, is an instance of `type`.

### Exercise 3

```python
class Circle:
    pass


class Square:
    pass


class Triangle:
    pass


SHAPES = {"circle": Circle, "square": Square, "triangle": Triangle}


def create(kind):
    try:
        shape_class = SHAPES[kind]
    except KeyError:
        raise ValueError(f"unknown shape: {kind!r}") from None
    return shape_class()


for kind in ["circle", "square"]:
    print(type(create(kind)).__name__)

try:
    create("hexagon")
except ValueError as error:
    print("Error:", error)
```

Output:

```text
Circle
Square
Error: unknown shape: 'hexagon'
```

The dictionary stores **class objects**, not instances. `shape_class()` calls the selected class to create a fresh instance each time. `from None` hides the internal `KeyError` from the traceback, because the `ValueError` already explains the problem.

### Exercise 4

Output:

```text
True
False
True
False
True
```

- `isinstance(rex, Animal)`: a `Dog` is an `Animal` through inheritance.
- `type(rex) is Animal`: the exact type is `Dog`, not `Animal`.
- `isinstance(Dog, type)`: every class is an instance of `type`.
- `isinstance(rex, type)`: `rex` is an ordinary object, not a class.
- `type(Dog) is type(Animal)`: both classes are instances of the same `type`.

---

*Source: [pythontutorial.net — Python Class](https://www.pythontutorial.net/python-oop/python-class/). Adapted and expanded for PyJourney.*
