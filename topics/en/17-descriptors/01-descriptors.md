# Descriptors

A **descriptor** is an object that takes control of an attribute of *another* class: whenever that attribute is read, assigned or deleted, Python calls the descriptor's methods instead of simply touching a dictionary. Descriptors let you write a rule such as "must be a non-empty string" once and reuse it for any number of attributes and classes. They are also the machinery behind `property`, methods, `classmethod`, `staticmethod` and `__slots__`.

## What you'll learn

- Why validation written with properties does not scale, and how descriptors fix that
- What the descriptor protocol is: `__get__`, `__set__`, `__delete__` and `__set_name__`
- How to write a validating descriptor and reuse it in several classes
- Exactly which method Python calls, and with which arguments, when you read, assign or delete a managed attribute
- Where a descriptor should keep its values, and which bugs appear when it keeps them in the wrong place
- How to build a family of validators on top of one base class

## The problem: the same validation in every property

Suppose a `Person` must always have a non-empty first and last name. Plain attributes accept anything, so the usual first step is a property with a validating setter (see the topic Property):

```python
class Person:
    def __init__(self, first_name, last_name):
        self.first_name = first_name
        self.last_name = last_name

    @property
    def first_name(self):
        return self._first_name

    @first_name.setter
    def first_name(self, value):
        if not isinstance(value, str):
            raise TypeError("The first name must be a string")
        if len(value) == 0:
            raise ValueError("The first name cannot be empty")
        self._first_name = value

    @property
    def last_name(self):
        return self._last_name

    @last_name.setter
    def last_name(self, value):
        if not isinstance(value, str):
            raise TypeError("The last name must be a string")
        if len(value) == 0:
            raise ValueError("The last name cannot be empty")
        self._last_name = value


person = Person("John", "Doe")
print(person.first_name, person.last_name)

try:
    person.last_name = ""
except ValueError as error:
    print(error)
```

Output:

```text
John Doe
The last name cannot be empty
```

It works, but look at the cost: two attributes, four methods, and the same checks written twice. Add `middle_name`, `city` and `country`, or another class with a required `title`, and the copy-paste keeps growing. Moving the checks into a helper function removes some duplication, yet every attribute still needs its own getter and setter pair.

What we really want is to describe the rule "a required string" **once**, as an object, and then say "this attribute follows that rule". That object is a descriptor.

## A descriptor: the rule as a reusable object

A descriptor is an instance of a class that defines `__get__`, `__set__` and/or `__delete__`. It is placed in another class as a **class attribute**:

```python
class RequiredString:
    """A reusable rule: the attribute must be a non-empty string."""

    def __set_name__(self, owner, name):
        self.name = name  # remember which attribute this descriptor serves

    def __get__(self, instance, owner):
        if instance is None:  # accessed on the class: Person.first_name
            return self
        return instance.__dict__[self.name]

    def __set__(self, instance, value):
        if not isinstance(value, str):
            raise TypeError(f"{self.name} must be a string, not {type(value).__name__}")
        if not value:
            raise ValueError(f"{self.name} cannot be empty")
        instance.__dict__[self.name] = value


class Person:
    first_name = RequiredString()
    last_name = RequiredString()

    def __init__(self, first_name, last_name):
        self.first_name = first_name  # goes through RequiredString.__set__
        self.last_name = last_name


class Product:
    title = RequiredString()  # the same rule, reused in another class


person = Person("John", "Doe")
print(person.first_name, person.last_name)

for bad_value in ("", 42):
    try:
        person.first_name = bad_value
    except (TypeError, ValueError) as error:
        print(f"{type(error).__name__}: {error}")

try:
    Person("Jane", "")
except ValueError as error:
    print(f"ValueError: {error}")

book = Product()
try:
    book.title = None
except TypeError as error:
    print(f"TypeError: {error}")
```

Output:

```text
John Doe
ValueError: first_name cannot be empty
TypeError: first_name must be a string, not int
ValueError: last_name cannot be empty
TypeError: title must be a string, not NoneType
```

The validation logic now lives in one class. `Person` declares *what* its attributes are, and any other class (`Product` here) can use the same rule in one line. Validation also runs inside `__init__`, because `self.first_name = first_name` is an ordinary assignment that goes through the descriptor.

> **Note:** The original tutorial raises `ValueError` for both kinds of bad input. The Python convention is `TypeError` for a value of the wrong *type* and `ValueError` for a value of the right type but an unacceptable *content*, which is what this version does.

## The descriptor protocol

The **descriptor protocol** is the set of special methods Python looks for on an object found in a class:

| Method | When Python calls it | What it should do |
|---|---|---|
| `__get__(self, instance, owner)` | `obj.attr` (then `instance` is `obj`) or `Owner.attr` (then `instance` is `None`) | return the attribute value |
| `__set__(self, instance, value)` | `obj.attr = value` | validate and store the value |
| `__delete__(self, instance)` | `del obj.attr` | remove the value, or refuse |
| `__set_name__(self, owner, name)` | once, when the class that contains the descriptor is created | remember the owner class and the attribute name |

An object is a **descriptor** if its class defines at least one of `__get__`, `__set__` or `__delete__`. `__set_name__` is optional and does not by itself make an object a descriptor. It is a hook (available since Python 3.6) that tells the descriptor its own name, so you no longer have to repeat it as in `first_name = RequiredString("first_name")`, which you will still see in older code.

Descriptors come in two kinds:

- a **data descriptor** defines `__set__` and/or `__delete__` (usually together with `__get__`);
- a **non-data descriptor** defines only `__get__`.

The kind decides which wins when the instance's own `__dict__` has an entry with the same name. The next topic, Data vs. Non-data Descriptors, is devoted to that.

## How descriptors work: tracing the calls

Let us add `print()` calls to every method and watch what Python does. A `__repr__` on both classes keeps the output readable (and free of memory addresses):

```python
class RequiredString:
    def __set_name__(self, owner, name):
        print(f"__set_name__(owner={owner.__name__}, name={name!r})")
        self.name = name

    def __get__(self, instance, owner):
        print(f"__get__(instance={instance!r}, owner={owner.__name__})")
        if instance is None:
            return self
        return instance.__dict__[self.name]

    def __set__(self, instance, value):
        print(f"__set__(instance={instance!r}, value={value!r})")
        if not isinstance(value, str):
            raise TypeError(f"{self.name} must be a string")
        if not value:
            raise ValueError(f"{self.name} cannot be empty")
        instance.__dict__[self.name] = value

    def __repr__(self):
        return f"<RequiredString {self.name!r}>"


print("defining the class...")


class Person:
    first_name = RequiredString()
    last_name = RequiredString()

    def __repr__(self):
        return "<a Person>"


print("the class is ready")
person = Person()
person.first_name = "John"
print(person.first_name)
print(Person.first_name)
```

Output:

```text
defining the class...
__set_name__(owner=Person, name='first_name')
__set_name__(owner=Person, name='last_name')
the class is ready
__set__(instance=<a Person>, value='John')
__get__(instance=<a Person>, owner=Person)
John
__get__(instance=None, owner=Person)
<RequiredString 'first_name'>
```

### `__set_name__`: the descriptor learns its name

`__set_name__` ran twice **while the `class Person:` statement was executing**, before any `Person` object existed. Python executes the class body (creating two `RequiredString` objects), builds the class object, and then walks over the new class's namespace and calls `__set_name__` on every value that has it. Roughly:

```text
namespace = {"first_name": RequiredString(), "last_name": RequiredString(), ...}
Person = type("Person", (), namespace)          # create the class
for name, value in namespace.items():           # then notify the descriptors
    if hasattr(type(value), "__set_name__"):
        type(value).__set_name__(value, Person, name)
```

So `first_name = RequiredString()` inside the class body leads to the call `RequiredString.__set_name__(descriptor, Person, "first_name")`. The descriptor stores `name` so that `__get__` and `__set__` know which entry of the instance dictionary to use, and so that error messages can mention the attribute.

Both descriptors are ordinary **class attributes**. `vars(Person)` (the same as `Person.__dict__`) returns the raw objects without calling `__get__`:

```python
# Continues the previous example
print({key: value for key, value in vars(Person).items() if not key.startswith("__")})

person = Person()
print(person.__dict__)
person.first_name = "John"
person.last_name = "Doe"
print(person.__dict__)
```

Output:

```text
{'first_name': <RequiredString 'first_name'>, 'last_name': <RequiredString 'last_name'>}
{}
__set__(instance=<a Person>, value='John')
__set__(instance=<a Person>, value='Doe')
{'first_name': 'John', 'last_name': 'Doe'}
```

### `__set__`: assignment

`person.first_name = "John"` did not put anything into `person.__dict__` by itself. Python found a descriptor named `first_name` in the class, saw that it has `__set__`, and called `__set__(person, "John")`. The descriptor validated the value and stored it with `instance.__dict__[self.name] = value`.

The value ends up in the instance dictionary under **the same name** as the descriptor. You might expect that the next `person.first_name` would then find it there and skip the descriptor. It does not: a descriptor with `__set__` (a data descriptor) takes priority over the instance dictionary, so every read still goes through `__get__`. The exact lookup order is the subject of the next topic.

### `__get__`: reading

`person.first_name` called `__get__(person, Person)`: the instance and its class. `Person.first_name` called `__get__(None, Person)`: there is no instance when you read the attribute from the class. Returning the descriptor itself in that case is the standard convention. It makes introspection, `help()` and calls such as `Person.first_name.__set_name__(...)` work.

### What attribute access turns into

For a descriptor found in the class, attribute access is translated into method calls like this (the descriptor is searched along the MRO, so inherited descriptors work too):

```text
person.first_name           ->  type(person).__dict__["first_name"].__get__(person, type(person))
Person.first_name           ->  Person.__dict__["first_name"].__get__(None, Person)
person.first_name = "Ann"   ->  type(person).__dict__["first_name"].__set__(person, "Ann")
del person.first_name       ->  type(person).__dict__["first_name"].__delete__(person)
```

You can make these calls by hand to see that nothing magical is left:

```python
class RequiredString:
    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        return instance.__dict__[self.name]

    def __set__(self, instance, value):
        if not isinstance(value, str) or not value:
            raise ValueError(f"{self.name} must be a non-empty string")
        instance.__dict__[self.name] = value


class Person:
    first_name = RequiredString()


person = Person()
descriptor = vars(Person)["first_name"]  # the raw object stored in the class

descriptor.__set__(person, "Ann")            # what  person.first_name = "Ann"  does
print(descriptor.__get__(person, Person))    # what  person.first_name  does
print(descriptor.__get__(None, Person) is descriptor)  # what  Person.first_name  does
print(person.first_name)
```

Output:

```text
Ann
True
Ann
```

## Reading an attribute that was never set

Many tutorials (including the original source) write `__get__` as `return instance.__dict__[self.name] or None`. That has two problems:

- If the attribute was never assigned, the lookup raises **`KeyError`**. Python's attribute machinery expects **`AttributeError`** for a missing attribute: `hasattr()`, `getattr(obj, name, default)` and `__getattr__` all rely on it, and a `KeyError` slips through them.
- `or None` turns every *falsy* value into `None`. For strings that are never empty it is merely useless, but the same pattern in a numeric descriptor would turn a legitimate `0` into `None`.

```python
class RequiredString:
    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        return instance.__dict__[self.name] or None  # as in many tutorials

    def __set__(self, instance, value):
        if not isinstance(value, str) or not value:
            raise ValueError(f"{self.name} must be a non-empty string")
        instance.__dict__[self.name] = value


class User:
    nickname = RequiredString()


user = User()
try:
    print(getattr(user, "nickname", "anonymous"))
except KeyError as error:
    print("KeyError:", error)
```

Output:

```text
KeyError: 'nickname'
```

`getattr()` with a default should have returned `"anonymous"`, but it only catches `AttributeError`. The fix is to translate the `KeyError`. While we are at it, `__delete__` makes the attribute truly *required*: it cannot be removed once set:

```python
class RequiredString:
    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        try:
            return instance.__dict__[self.name]
        except KeyError:
            raise AttributeError(
                f"{owner.__name__!r} object has no attribute {self.name!r}"
            ) from None

    def __set__(self, instance, value):
        if not isinstance(value, str) or not value:
            raise ValueError(f"{self.name} must be a non-empty string")
        instance.__dict__[self.name] = value

    def __delete__(self, instance):
        raise AttributeError(f"{self.name} is required and cannot be deleted")


class User:
    nickname = RequiredString()


user = User()
print(getattr(user, "nickname", "anonymous"))
print(hasattr(user, "nickname"))
try:
    user.nickname
except AttributeError as error:
    print("AttributeError:", error)

user.nickname = "max"
try:
    del user.nickname
except AttributeError as error:
    print("AttributeError:", error)
print(user.nickname)
```

Output:

```text
anonymous
False
AttributeError: 'User' object has no attribute 'nickname'
AttributeError: nickname is required and cannot be deleted
max
```

`from None` hides the internal `KeyError` from the traceback, so the user sees a clean `AttributeError`.

> **Note:** If a descriptor defines `__set__` but not `__delete__`, then `del obj.attr` fails with `AttributeError: __delete__`. Python does **not** fall back to deleting the entry from the instance dictionary. Define `__delete__` explicitly if deletion should be allowed.

## A family of validators

Once you have one validating descriptor, a pattern appears: getting, storing and deleting are always the same, and only the check differs. Put the common part into an abstract base class and let subclasses implement just `validate()`. The official Python "Descriptor Guide" uses the same design:

```python
from abc import ABC, abstractmethod


class Validator(ABC):
    """Base descriptor: stores the value, delegates the checking to validate()."""

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner=None):
        if instance is None:
            return self
        try:
            return instance.__dict__[self.name]
        except KeyError:
            raise AttributeError(self.name) from None

    def __set__(self, instance, value):
        self.validate(value)
        instance.__dict__[self.name] = value

    @abstractmethod
    def validate(self, value):
        """Raise an exception if the value is not acceptable."""


class RequiredString(Validator):
    def validate(self, value):
        if not isinstance(value, str):
            raise TypeError(f"{self.name} must be a string")
        if not value.strip():
            raise ValueError(f"{self.name} cannot be empty")


class Number(Validator):
    def __init__(self, minvalue=None, maxvalue=None):
        self.minvalue = minvalue
        self.maxvalue = maxvalue

    def validate(self, value):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise TypeError(f"{self.name} must be a number")
        if self.minvalue is not None and value < self.minvalue:
            raise ValueError(f"{self.name} must be at least {self.minvalue}")
        if self.maxvalue is not None and value > self.maxvalue:
            raise ValueError(f"{self.name} must be at most {self.maxvalue}")


class OneOf(Validator):
    def __init__(self, *options):
        self.options = set(options)

    def validate(self, value):
        if value not in self.options:
            raise ValueError(f"{self.name} must be one of {sorted(self.options)}")


class Employee:
    name = RequiredString()
    age = Number(minvalue=18, maxvalue=70)
    department = OneOf("HR", "IT", "Sales")

    def __init__(self, name, age, department):
        self.name = name
        self.age = age
        self.department = department


olena = Employee("Olena", 31, "IT")
print(olena.name, olena.age, olena.department)

for args in [("   ", 30, "IT"), ("Max", 17, "IT"), ("Max", True, "IT"), ("Max", 40, "Legal")]:
    try:
        Employee(*args)
    except (TypeError, ValueError) as error:
        print(f"{args} -> {type(error).__name__}: {error}")
```

Output:

```text
Olena 31 IT
('   ', 30, 'IT') -> ValueError: name cannot be empty
('Max', 17, 'IT') -> ValueError: age must be at least 18
('Max', True, 'IT') -> TypeError: age must be a number
('Max', 40, 'Legal') -> ValueError: department must be one of ['HR', 'IT', 'Sales']
```

Things to notice:

- A descriptor can take **its own configuration** in `__init__` (`minvalue`, `maxvalue`, the allowed options). One descriptor *class* serves many attributes, each attribute gets its own descriptor *instance*.
- `Number` rejects `True` explicitly: `bool` is a subclass of `int`, so `isinstance(True, int)` is `True`, and an age of `True` would otherwise be accepted as `1`.
- `Employee` reads like a specification. This declarative style is exactly how ORMs (Django models, SQLAlchemy) and validation libraries describe fields.

## Where the descriptor keeps the value

There is **one** descriptor object per attribute, shared by all instances of the class. So the descriptor must not keep per-instance data in its own attributes. The usual options:

| Where | How | Notes |
|---|---|---|
| Instance `__dict__`, same name | `instance.__dict__[self.name] = value` | Simple and fast. Works only for data descriptors (a non-data descriptor would be shadowed) and only for classes that have a `__dict__`. |
| Instance attribute with another name | `setattr(instance, "_" + self.name, value)` | Works with `__slots__` if the private name is a slot. The value is visible as `obj._name`. |
| Dictionary inside the descriptor | `self.values[instance] = value` with `weakref.WeakKeyDictionary` | Leaves the instance untouched, but instances must be hashable and support weak references. A normal `dict` would keep every instance alive forever. |
| The descriptor's own attribute | `self.value = value` | **Wrong**: one value shared by all instances (see "Common mistakes"). |

The private-name variant works even for classes with `__slots__`, which have no instance `__dict__` at all:

```python
class RequiredString:
    def __set_name__(self, owner, name):
        self.name = name
        self.private_name = "_" + name  # where the value really lives

    def __get__(self, instance, owner):
        if instance is None:
            return self
        return getattr(instance, self.private_name)

    def __set__(self, instance, value):
        if not isinstance(value, str) or not value:
            raise ValueError(f"{self.name} must be a non-empty string")
        setattr(instance, self.private_name, value)


class Tag:
    __slots__ = ("_label",)  # no __dict__, only a slot for the real storage
    label = RequiredString()

    def __init__(self, label):
        self.label = label


tag = Tag("python")
print(tag.label, tag._label)
print(hasattr(tag, "__dict__"))
```

Output:

```text
python python
False
```

## Descriptors you already use

Descriptors are not an exotic feature, they are how Python implements several everyday tools. Each of these objects, as stored in the class, has a `__get__` method:

```python
class Demo:
    __slots__ = ("slot",)

    def method(self):
        pass

    @property
    def prop(self):
        return 42

    @classmethod
    def cmethod(cls):
        pass

    @staticmethod
    def smethod():
        pass


for name in ("slot", "method", "prop", "cmethod", "smethod"):
    raw = vars(Demo)[name]  # the object stored in the class, untouched
    print(f"{name:8} {type(raw).__name__:18} has __get__: {hasattr(type(raw), '__get__')}")
```

Output:

```text
slot     member_descriptor  has __get__: True
method   function           has __get__: True
prop     property           has __get__: True
cmethod  classmethod        has __get__: True
smethod  staticmethod       has __get__: True
```

- `property` is a data descriptor whose `__get__`, `__set__` and `__delete__` call the functions you gave it (Exercise 4 rebuilds it).
- Every plain function is a non-data descriptor: its `__get__` turns `obj.method` into a *bound method* with `obj` filled in as `self`.
- `classmethod` and `staticmethod` are descriptors whose `__get__` binds the class or nothing at all.
- Each name in `__slots__` becomes a `member_descriptor` that reads and writes a fixed slot in the object's memory (see the topic `__slots__`).

The next topic shows how the data/non-data distinction explains the behaviour of each of them.

## Common mistakes

- **Storing the value on the descriptor.** The descriptor is created once per class, so its attributes are shared by every instance:

  ```python
  class Positive:
      def __get__(self, instance, owner):
          return self.value

      def __set__(self, instance, value):
          if value <= 0:
              raise ValueError("must be positive")
          self.value = value  # BUG: stored on the descriptor, shared by all instances


  class Account:
      balance = Positive()


  first = Account()
  second = Account()
  first.balance = 100
  second.balance = 5
  print(first.balance, second.balance)
  ```

  Output:

  ```text
  5 5
  ```

  Store per-instance data in the instance, keyed by the attribute name:

  ```python
  class Positive:
      def __set_name__(self, owner, name):
          self.name = name

      def __get__(self, instance, owner):
          if instance is None:
              return self
          return instance.__dict__[self.name]

      def __set__(self, instance, value):
          if value <= 0:
              raise ValueError(f"{self.name} must be positive")
          instance.__dict__[self.name] = value  # each instance keeps its own value


  class Account:
      balance = Positive()


  first = Account()
  second = Account()
  first.balance = 100
  second.balance = 5
  print(first.balance, second.balance)
  ```

  Output:

  ```text
  100 5
  ```

- **Putting the descriptor on the instance.** The protocol only works for descriptors found in the **class** (or its bases). A descriptor stored in an instance attribute is just a value:

  ```python
  class Upper:
      """Returns the stored text in upper case."""

      def __get__(self, instance, owner):
          if instance is None:
              return self
          return instance._text.upper()


  class Banner:
      title = Upper()  # a class attribute: works

      def __init__(self, text):
          self._text = text
          self.subtitle = Upper()  # BUG: an instance attribute is just a value


  banner = Banner("sale")
  print(banner.title)
  print(type(banner.subtitle).__name__)
  ```

  Output:

  ```text
  SALE
  Upper
  ```

- **Forgetting `if instance is None: return self`.** Then reading the attribute on the class (`City.name`, `help(City)`, documentation tools) crashes with a confusing error:

  ```python
  class Name:
      def __set_name__(self, owner, name):
          self.name = name

      def __get__(self, instance, owner):
          return instance.__dict__[self.name]  # BUG: no check for instance is None

      def __set__(self, instance, value):
          instance.__dict__[self.name] = value


  class City:
      name = Name()


  try:
      City.name
  except AttributeError as error:
      print("AttributeError:", error)
  ```

  Output:

  ```text
  AttributeError: 'NoneType' object has no attribute '__dict__'
  ```

- **Raising `KeyError` (or returning `None`) for an unset attribute.** Raise `AttributeError`, so that `hasattr()` and `getattr(obj, name, default)` behave correctly.
- **Adding a descriptor after the class was created.** `__set_name__` is called automatically only while the `class` statement runs. A descriptor attached later never learns its name:

  ```python
  class RequiredString:
      def __set_name__(self, owner, name):
          self.name = name

      def __get__(self, instance, owner):
          if instance is None:
              return self
          return instance.__dict__[self.name]

      def __set__(self, instance, value):
          if not isinstance(value, str) or not value:
              raise ValueError(f"{self.name} must be a non-empty string")
          instance.__dict__[self.name] = value


  class Person:
      pass


  Person.nickname = RequiredString()  # added AFTER the class was created
  person = Person()
  try:
      person.nickname = "max"
  except AttributeError as error:
      print("AttributeError:", error)

  Person.nickname.__set_name__(Person, "nickname")  # do Python's job by hand
  person.nickname = "max"
  print(person.nickname)
  ```

  Output:

  ```text
  AttributeError: 'RequiredString' object has no attribute 'name'
  max
  ```

- **Using `instance.__dict__` in a class with `__slots__`.** Such instances have no `__dict__`. Store the value under a private slot name with `setattr()` instead.

## Summary

- A descriptor is an object whose class defines `__get__`, `__set__` and/or `__delete__`. It works when it is a **class attribute** of another class.
- `__set_name__(owner, name)` is called once, when the owner class is created, so the descriptor can learn its attribute name.
- `obj.attr` calls `__get__(obj, type(obj))`, `Owner.attr` calls `__get__(None, Owner)`, `obj.attr = v` calls `__set__(obj, v)`, and `del obj.attr` calls `__delete__(obj)`.
- Return `self` from `__get__` when `instance` is `None`, and raise `AttributeError` (not `KeyError`) when a value is missing.
- One descriptor object serves all instances, so per-instance values belong in the instance (its `__dict__` or a private attribute), never in the descriptor.
- A validator base class with an abstract `validate()` turns field rules into reusable, configurable descriptors.
- `property`, functions (methods), `classmethod`, `staticmethod` and `__slots__` are all built on descriptors.

## Practice

### Exercise 1: Trace the calls

Without running the code, write down everything it prints. Then run it and compare.

```python
class Traced:
    def __set_name__(self, owner, name):
        print(f"set_name {name}")
        self.name = name

    def __get__(self, instance, owner):
        print(f"get {self.name} (instance is None: {instance is None})")
        if instance is None:
            return self
        return instance.__dict__.get(self.name, "?")

    def __set__(self, instance, value):
        print(f"set {self.name} = {value!r}")
        instance.__dict__[self.name] = value


print("start")


class Point:
    x = Traced()
    y = Traced()

    def __init__(self, x):
        self.x = x


p = Point(3)
print(p.x + 1)
print(p.y)
print(type(Point.x).__name__)
```

### Exercise 2: Positive numbers

Write a descriptor `PositiveNumber` that accepts only `int` or `float` values greater than zero. Wrong types must raise `TypeError`, non-positive numbers `ValueError`, and both messages must name the attribute. `bool` values must be rejected. Use it for `price` and `quantity` in a class `Product(title, price, quantity)` with a read-only property `total`. Show that invalid assignments leave the old values untouched.

### Exercise 3: Typed attributes with defaults

Write a descriptor `Typed(kind, default=...)`:

- assigning a value that is not an instance of `kind` raises `TypeError`;
- reading an attribute that was never set returns `default`, or raises `AttributeError` if no default was given;
- `del obj.attr` removes the stored value, so the default becomes visible again; deleting an unset attribute raises `AttributeError`.

Use it in a class `Config` with `host = Typed(str)`, `port = Typed(int, default=8080)` and `debug = Typed(bool, default=False)`. Note that `None` must be a valid default, so you need a different way to mark "no default".

### Exercise 4: Build your own property

Write a class `MyProperty` that works like a simplified built-in `property`: it accepts `fget`, `fset` and `fdel` functions, can be used as a decorator, and has a `setter()` method so that `@radius.setter` works. Missing functions must raise `AttributeError` with a clear message. Test it on a class `Circle` with a validated `radius` and a read-only `diameter`.

## Solutions

### Exercise 1

Output:

```text
start
set_name x
set_name y
set x = 3
get x (instance is None: False)
4
get y (instance is None: False)
?
get x (instance is None: True)
Traced
```

- Both `set_name` lines appear while the `class Point:` statement runs, before any object exists.
- `Point(3)` runs `__init__`, and `self.x = x` goes through `__set__`.
- `p.y` was never set, so `__get__` finds no `"y"` key in the instance dictionary, and `.get(self.name, "?")` returns the fallback.
- `Point.x` calls `__get__` with `instance=None`, which returns the descriptor itself, so its type is `Traced`.

### Exercise 2

```python
class PositiveNumber:
    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        try:
            return instance.__dict__[self.name]
        except KeyError:
            raise AttributeError(self.name) from None

    def __set__(self, instance, value):
        # bool is a subclass of int, but True is not a sensible price
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise TypeError(f"{self.name} must be a number, not {type(value).__name__}")
        if value <= 0:
            raise ValueError(f"{self.name} must be positive, got {value}")
        instance.__dict__[self.name] = value


class Product:
    price = PositiveNumber()
    quantity = PositiveNumber()

    def __init__(self, title, price, quantity):
        self.title = title
        self.price = price
        self.quantity = quantity

    @property
    def total(self):
        return self.price * self.quantity


laptop = Product("Laptop", 999.5, 2)
print(laptop.total)

for field, value in [("price", 0), ("quantity", -3), ("price", "10"), ("quantity", True)]:
    try:
        setattr(laptop, field, value)
    except (TypeError, ValueError) as error:
        print(f"{type(error).__name__}: {error}")

print(laptop.price, laptop.quantity)
```

Output:

```text
1999.0
ValueError: price must be positive, got 0
ValueError: quantity must be positive, got -3
TypeError: price must be a number, not str
TypeError: quantity must be a number, not bool
999.5 2
```

The value is stored only after both checks pass, so a failed assignment never corrupts the object. `setattr(laptop, "price", 0)` is exactly the same as `laptop.price = 0`, so it also goes through the descriptor.

### Exercise 3

```python
_MISSING = object()  # a unique marker: "no default was given"


class Typed:
    def __init__(self, kind, default=_MISSING):
        self.kind = kind
        self.default = default

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        if self.name in instance.__dict__:
            return instance.__dict__[self.name]
        if self.default is not _MISSING:
            return self.default
        raise AttributeError(f"{self.name} is not set")

    def __set__(self, instance, value):
        if not isinstance(value, self.kind):
            raise TypeError(
                f"{self.name} must be {self.kind.__name__}, not {type(value).__name__}"
            )
        instance.__dict__[self.name] = value

    def __delete__(self, instance):
        try:
            del instance.__dict__[self.name]
        except KeyError:
            raise AttributeError(f"{self.name} is not set") from None


class Config:
    host = Typed(str)
    port = Typed(int, default=8080)
    debug = Typed(bool, default=False)


config = Config()
print(config.port, config.debug)
try:
    config.host
except AttributeError as error:
    print("AttributeError:", error)

config.host = "localhost"
config.port = 9000
print(config.host, config.port)

try:
    config.port = "9000"
except TypeError as error:
    print("TypeError:", error)

del config.port
print(config.port)
try:
    del config.port
except AttributeError as error:
    print("AttributeError:", error)
```

Output:

```text
8080 False
AttributeError: host is not set
localhost 9000
TypeError: port must be int, not str
8080
AttributeError: port is not set
```

A private sentinel object `_MISSING` distinguishes "no default" from "the default is `None`". The default lives on the descriptor, which is fine: it is the same for all instances and is never modified. Keep in mind that `isinstance(True, int)` is `True`, so `config.port = True` would pass; add an explicit `bool` check if that matters.

### Exercise 4

```python
class MyProperty:
    """A simplified pure-Python version of the built-in property."""

    def __init__(self, fget=None, fset=None, fdel=None):
        self.fget = fget
        self.fset = fset
        self.fdel = fdel

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner=None):
        if instance is None:
            return self
        if self.fget is None:
            raise AttributeError(f"property {self.name!r} has no getter")
        return self.fget(instance)

    def __set__(self, instance, value):
        if self.fset is None:
            raise AttributeError(f"property {self.name!r} has no setter")
        self.fset(instance, value)

    def __delete__(self, instance):
        if self.fdel is None:
            raise AttributeError(f"property {self.name!r} has no deleter")
        self.fdel(instance)

    def setter(self, fset):
        # return a NEW descriptor, just like the built-in property does
        return type(self)(self.fget, fset, self.fdel)


class Circle:
    def __init__(self, radius):
        self.radius = radius

    @MyProperty
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        if value < 0:
            raise ValueError("radius cannot be negative")
        self._radius = value

    @MyProperty
    def diameter(self):
        return self.radius * 2


circle = Circle(5)
print(circle.radius, circle.diameter)
circle.radius = 7
print(circle.diameter)

try:
    circle.radius = -1
except ValueError as error:
    print("ValueError:", error)

try:
    circle.diameter = 20
except AttributeError as error:
    print("AttributeError:", error)

print(type(Circle.radius).__name__)
```

Output:

```text
5 10
14
ValueError: radius cannot be negative
AttributeError: property 'diameter' has no setter
MyProperty
```

`@MyProperty` above `def radius` is `radius = MyProperty(radius)`. `@radius.setter` calls the `setter()` method of that object, which returns a new descriptor holding both functions, and that new object replaces `radius` in the class body. `diameter` has no setter, yet `MyProperty` still defines `__set__`, so it is a data descriptor: the assignment reaches `__set__` and is refused, instead of silently creating an instance attribute. The built-in `property` behaves the same way.

---

*Source: [pythontutorial.net — Python Descriptors](https://www.pythontutorial.net/python-oop/python-descriptors/). Adapted and expanded for PyJourney.*
