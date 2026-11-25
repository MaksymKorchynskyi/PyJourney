# Property

A **property** looks like an ordinary attribute from the outside (`john.age = 19`, `print(john.age)`), but behind the scenes every read and write goes through methods you control. Properties let you add validation or computation to an attribute later, without changing a single line of the code that already uses your class.

## What you'll learn

- Why direct attribute assignment can let invalid data in
- How getter and setter methods solve this, and why they break existing code
- How the built-in `property()` class turns a getter and a setter into an attribute
- Where the property object lives and where the real data is stored
- Why a property in the class takes precedence over the instance's `__dict__`
- What happens when a property has no setter or deleter, and how to document it

## The problem: unchecked attributes

Here is a simple class with two public attributes:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


john = Person("John", 18)
john.age = 19
print(john.age)

john.age = -1  # technically valid, semantically wrong
print(john.age)
```

Output:

```text
19
-1
```

Python happily stores `-1`, because an attribute is just a name bound to a value. To keep the data valid you could check before every assignment:

```python
age = -1
if age <= 0:
    raise ValueError("The age must be positive")
else:
    john.age = age
```

But then the same check is repeated in every place that assigns an age. Sooner or later someone forgets it.

## Getters and setters

The classic object-oriented solution is to hide the data and give access only through two methods:

- a **getter** returns the value of an attribute;
- a **setter** validates a new value and stores it.

By convention they are named `get_<attribute>()` and `set_<attribute>()`, and the data moves to an attribute with a leading underscore, `_age`. The underscore means "internal, don't touch from outside". Python does not enforce it; it is a convention.

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.set_age(age)

    def set_age(self, age):
        if age <= 0:
            raise ValueError("The age must be positive")
        self._age = age

    def get_age(self):
        return self._age


john = Person("John", 18)
try:
    john.set_age(-19)
except ValueError as error:
    print("ValueError:", error)
print(john.get_age())
```

Output:

```text
ValueError: The age must be positive
18
```

`__init__` also calls the setter, so even a new object can't start with an invalid age.

### The catch: backward compatibility

Suppose the first version of `Person` (with a public `age`) has been in use for a while, and other code reads and writes `john.age` everywhere. After switching to getters and setters, that code breaks, and one part of it breaks **silently**:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.set_age(age)

    def set_age(self, age):
        if age <= 0:
            raise ValueError("The age must be positive")
        self._age = age

    def get_age(self):
        return self._age


john = Person("John", 18)
try:
    print(john.age)  # old client code
except AttributeError as error:
    print("AttributeError:", error)

john.age = -1        # old client code: silently creates a new attribute
print(john.get_age(), john.__dict__)
```

Output:

```text
AttributeError: 'Person' object has no attribute 'age'
18 {'name': 'John', '_age': 18, 'age': -1}
```

Reading fails loudly, but writing creates a brand-new, unvalidated `age` attribute next to `_age`. Every caller would have to be rewritten. This is exactly the problem `property()` solves.

## The `property()` class

`property` is a built-in class. Calling it creates a **property object** that bundles up to three functions and a docstring:

```python
property(fget=None, fset=None, fdel=None, doc=None)
```

- `fget`: the function that gets the attribute value (the getter);
- `fset`: the function that sets the value (the setter);
- `fdel`: the function that deletes the attribute (the deleter, covered in a later topic);
- `doc`: the docstring of the property.

Assign the property object to a **class attribute** with the name the users should see:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def get_age(self):
        return self._age

    def set_age(self, age):
        if age <= 0:
            raise ValueError("The age must be positive")
        self._age = age

    age = property(fget=get_age, fset=set_age)


def celebrate_birthday(person):
    person.age += 1


john = Person("John", 18)
celebrate_birthday(john)
print(john.age)

try:
    john.age = -1
except ValueError as error:
    print("ValueError:", error)
print(john.age)
```

Output:

```text
19
ValueError: The age must be positive
19
```

The old style of code, `person.age += 1` and `john.age = -1`, works unchanged, but now every write goes through `set_age()` and every read goes through `get_age()`. Even `self.age = age` inside `__init__` uses the setter, so validation also covers object creation.

> **Tip:** This is why Python programmers don't write getters and setters "just in case". Start with plain public attributes. If you later need validation or computation, turn the attribute into a property, and nobody using the class has to change anything.

## Where the property and the data live

`age` is a **class** attribute that holds the property object:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def get_age(self):
        return self._age

    def set_age(self, age):
        if age <= 0:
            raise ValueError("The age must be positive")
        self._age = age

    age = property(fget=get_age, fset=set_age)


john = Person("John", 18)
print(Person.age)
print(john.__dict__)
```

Output (the address varies):

```text
<property object at 0x100af07c0>
{'name': 'John', '_age': 18}
```

The instance dictionary `john.__dict__` contains `name` and `_age`, the real data, but no `age`. The class dictionary `Person.__dict__` contains the property and both methods. Printed with `pprint`, which sorts the keys, it looks like this:

```python
from pprint import pprint


class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def set_age(self, age):
        if age <= 0:
            raise ValueError("The age must be positive")
        self._age = age

    def get_age(self):
        return self._age

    age = property(fget=get_age, fset=set_age)


pprint(Person.__dict__)
```

Output (Python 3.14; the addresses vary):

```text
mappingproxy({'__dict__': <attribute '__dict__' of 'Person' objects>,
              '__doc__': None,
              '__firstlineno__': 4,
              '__init__': <function Person.__init__ at 0x100b77270>,
              '__module__': '__main__',
              '__static_attributes__': ('_age', 'age', 'name'),
              '__weakref__': <attribute '__weakref__' of 'Person' objects>,
              'age': <property object at 0x100af07c0>,
              'get_age': <function Person.get_age at 0x100bdba00>,
              'set_age': <function Person.set_age at 0x100bdb950>})
```

`__firstlineno__` and `__static_attributes__` are new in Python 3.13; older versions don't show them.

## How Python finds `john.age`

A common explanation says that Python first looks in `john.__dict__` and, only if the name is not there, in the class. That is true for ordinary class attributes, but **not** for properties. A property is a *data descriptor* (an object that defines both `__get__` and `__set__`), and data descriptors in the class take precedence over the instance dictionary:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def get_age(self):
        print("get_age() called")
        return self._age

    def set_age(self, age):
        print(f"set_age({age}) called")
        if age <= 0:
            raise ValueError("The age must be positive")
        self._age = age

    age = property(fget=get_age, fset=set_age)

    species = "human"


john = Person("John", 18)
john.__dict__["age"] = 999          # sneak a value into the instance dict
john.__dict__["species"] = "robot"

print(john.age)       # the property still wins
print(john.species)   # a plain class attribute loses to the instance dict
print(john.__dict__)
```

Output:

```text
set_age(18) called
get_age() called
18
robot
{'name': 'John', '_age': 18, 'age': 999, 'species': 'robot'}
```

The lookup order for `obj.attr` is:

```text
1. a data descriptor named attr in type(obj) or its bases  (e.g. a property)
2. attr in obj.__dict__                                    (instance data)
3. a non-data descriptor or plain attr in the class       (methods, constants)
4. otherwise: AttributeError (or __getattr__, if defined)
```

That precedence is what makes properties reliable: nothing stored in the instance can bypass them.

## Properties without a setter or deleter

Each of the three functions is optional. If `fset` is missing, assigning raises `AttributeError`; if `fdel` is missing, `del` does:

```python
class Person:
    def __init__(self, age):
        self._age = age

    def get_age(self):
        return self._age

    age = property(get_age)


p = Person(5)
print(p.age)

try:
    p.age = 6
except AttributeError as error:
    print("AttributeError:", error)

try:
    del p.age
except AttributeError as error:
    print("AttributeError:", error)
```

Output (Python 3.11+; older versions say `can't set attribute` and `can't delete attribute`):

```text
5
AttributeError: property 'age' of 'Person' object has no setter
AttributeError: property 'age' of 'Person' object has no deleter
```

A property with only a getter is a **read-only** property. Read-only and deletable properties each have their own topic later in this section.

## Documenting a property

If you pass `doc`, it becomes the property's docstring. Otherwise the property copies the docstring of the getter. `help(Person)` shows it, and so do IDEs:

```python
class Person:
    def __init__(self, age):
        self.age = age

    def get_age(self):
        """Age of the person in full years."""
        return self._age

    def set_age(self, age):
        self._age = age

    age = property(get_age, set_age)
    nickname = property(lambda self: "Johnny", doc="A friendly name.")


print(Person.age.__doc__)
print(Person.nickname.__doc__)
print(Person.age.fget.__name__, Person.age.fset.__name__, Person.age.fdel)
```

Output:

```text
Age of the person in full years.
A friendly name.
get_age set_age None
```

The `fget`, `fset` and `fdel` attributes give you the original functions back.

## Common mistakes

- **Using the property's own name inside the getter or setter.** `self.age = age` inside `set_age` calls `set_age` again, forever:

  ```python
  class Person:
      def __init__(self, age):
          self.age = age

      def get_age(self):
          return self.age  # bug: reads the property itself

      def set_age(self, age):
          self.age = age  # bug: assigns to the property itself

      age = property(get_age, set_age)


  try:
      Person(30)
  except RecursionError as error:
      print("RecursionError:", error)
  ```

  Output:

  ```text
  RecursionError: maximum recursion depth exceeded
  ```

  Store the data under a different name, usually with a leading underscore (`self._age`).

- **Creating the property on the instance.** `self.age = property(...)` inside `__init__` just stores a property object in an instance attribute; reading `p.age` returns `<property object at 0x...>`. Properties work only as **class** attributes.
- **Bypassing validation in `__init__`.** Writing `self._age = age` in `__init__` skips the setter. Assign through the property (`self.age = age`) so new objects are validated too.
- **Making getters slow or surprising.** Code that reads `obj.age` expects a quick, side-effect-free attribute access. Heavy work belongs in a method with a verb in its name.
- **Writing Java-style getters and setters by default.** In Python, start with public attributes and switch to a property only when you need it.

## Summary

- Public attributes accept any value; validation needs a controlled entry point.
- Getter and setter methods add validation but change how the class is used, which breaks existing code.
- `property(fget, fset, fdel, doc)` creates a property object; assigned to a class attribute, it turns attribute reads, writes and deletions into calls of your functions.
- The property lives in the class; the actual data usually lives in the instance under another name, such as `_age`.
- A property is a data descriptor, so it takes precedence over the instance `__dict__`.
- Without `fset` or `fdel`, assignment or deletion raises `AttributeError`.
- The property's docstring comes from `doc` or from the getter.

## Practice

### Exercise 1: A name that can't be blank

Using `property()` (not the decorator), give `Person` a `name` property. The setter must strip surrounding whitespace and raise `ValueError("The name cannot be empty")` if nothing is left. Add the docstring `"The person's name."`. Show that `Person("  Ann  ").name` is `'Ann'` and that assigning `"   "` fails without changing the name.

### Exercise 2: Celsius and Fahrenheit

Write a `Temperature` class that stores only `celsius` as a plain attribute. Add a `fahrenheit` property, built with `property()`, whose getter converts from Celsius (`c * 9 / 5 + 32`) and whose setter converts back and updates `celsius`. Show that `__dict__` contains only `celsius`.

### Exercise 3: Predict the output

Predict every line, then run the code:

```python
class Box:
    def get_size(self):
        print("getter")
        return 1

    def set_size(self, value):
        print(f"setter({value})")

    size = property(get_size, set_size)
    color = "red"


box = Box()
box.size = 5
box.color = "blue"
box.__dict__["size"] = 100
print(box.size)
print(box.color)
print(Box.color)
print(box.__dict__)
```

### Exercise 4: Upgrade without breaking clients

Version 1 of `Product(name, price)` stored `price` as a public attribute, and client code does things like `item.price *= 1.1`. Write version 2 that, using `property()`, rejects non-numbers with `TypeError`, rejects negative prices with `ValueError`, and rounds stored prices to 2 decimals, while the client code keeps working unchanged.

## Solutions

### Exercise 1

```python
class Person:
    def __init__(self, name):
        self.name = name

    def get_name(self):
        return self._name

    def set_name(self, value):
        value = value.strip()
        if not value:
            raise ValueError("The name cannot be empty")
        self._name = value

    name = property(get_name, set_name, doc="The person's name.")


ann = Person("  Ann  ")
print(repr(ann.name))

try:
    ann.name = "   "
except ValueError as error:
    print("ValueError:", error)
print(repr(ann.name))
print(Person.name.__doc__)
```

Output:

```text
'Ann'
ValueError: The name cannot be empty
'Ann'
The person's name.
```

The setter raises before it assigns, so a failed assignment leaves the old value in place.

### Exercise 2

```python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    def get_fahrenheit(self):
        return self.celsius * 9 / 5 + 32

    def set_fahrenheit(self, value):
        self.celsius = (value - 32) * 5 / 9

    fahrenheit = property(get_fahrenheit, set_fahrenheit)


t = Temperature(25)
print(t.fahrenheit)

t.fahrenheit = 212
print(t.celsius)

t.celsius = -40
print(t.fahrenheit)
print(t.__dict__)
```

Output:

```text
77.0
100.0
-40.0
{'celsius': -40}
```

`fahrenheit` stores nothing of its own. It is computed from `celsius` on every read, so the two values can never get out of sync.

### Exercise 3

Output:

```text
setter(5)
getter
1
blue
red
{'color': 'blue', 'size': 100}
```

- `box.size = 5` calls the setter, which prints and stores nothing.
- `box.color = "blue"` creates an instance attribute that hides the class attribute `color`.
- `box.size` still calls the getter: the property is a data descriptor, so it beats the `size` key in `box.__dict__`.
- `Box.color` is still `"red"`; only the instance has its own `color`.

### Exercise 4

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    def get_price(self):
        return self._price

    def set_price(self, value):
        if not isinstance(value, (int, float)):
            raise TypeError("The price must be a number")
        if value < 0:
            raise ValueError("The price cannot be negative")
        self._price = round(value, 2)

    price = property(get_price, set_price)


# client code written for the old version stays unchanged
item = Product("Tea", 85)
item.price *= 1.1
print(item.name, item.price)

for bad in (-5, "free"):
    try:
        item.price = bad
    except (TypeError, ValueError) as error:
        print(type(error).__name__ + ":", error)
print(item.price)
```

Output:

```text
Tea 93.5
ValueError: The price cannot be negative
TypeError: The price must be a number
93.5
```

`item.price *= 1.1` reads through the getter, multiplies, and writes the result back through the setter, which rounds `93.50000000000001` to `93.5`.

---

*Source: [pythontutorial.net — Python Property](https://www.pythontutorial.net/python-oop/python-properties/). Adapted and expanded for PyJourney.*
