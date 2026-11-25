# Metaclass Example

This topic puts metaclasses to work on a realistic task. Classes that mostly hold data need a lot of repetitive code: properties, `__init__`, `__repr__`, `__eq__`, `__hash__`. Here you will build a `Data` metaclass that generates all of it from a simple list of field names. Then you will compare the result with `@dataclass`, the standard-library tool that solves the same problem.

## What you'll learn

- Why "data" classes need so much boilerplate code
- How a metaclass can generate properties and special methods from a list of field names
- How to build methods with closures and attach them to a class with `setattr()`
- How to apply a metaclass through a class decorator, and the trap hidden in copying `__dict__`
- Pitfalls of generated code: hashing mutable objects, silent argument errors, late binding in loops
- How `@dataclass` gives you the same features with one line

## The problem: boilerplate in data classes

Here is a `Person` class written by hand, with two properties and the usual special methods:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        self._name = value

    @property
    def age(self):
        return self._age

    @age.setter
    def age(self, value):
        self._age = value

    def __eq__(self, other):
        return self.name == other.name and self.age == other.age

    def __hash__(self):
        return hash((self.name, self.age))

    def __repr__(self):
        return f"Person(name={self.name!r}, age={self.age!r})"


p = Person("John Doe", 25)
print(p)
print(p == Person("John Doe", 25))
```

Output:

```text
Person(name='John Doe', age=25)
True
```

For two fields, that is already about 30 lines. A typical data class needs:

- a property for every field;
- an `__init__` that sets every field;
- a `__repr__` for a readable representation (`print()` uses `__str__`, which falls back to `__repr__` when it is not defined);
- an `__eq__` that compares objects by their field values;
- a `__hash__`, so that objects can be dictionary keys or set elements.

Every new class repeats the same pattern with different field names. The goal is to write only this and get everything else generated:

```python
class Person(metaclass=Data):
    props = ["name", "age"]
```

A metaclass is a natural fit: it runs once for every class it creates and can add methods to that class.

## Step 1: The metaclass skeleton

```python
class Data(type):
    def __new__(mcs, name, bases, class_dict):
        class_obj = super().__new__(mcs, name, bases, class_dict)
        return class_obj
```

`Data.__new__` receives the class name, the bases and the namespace filled by the class body, and lets `type` build the class. Like any `__new__`, it is a static method that Python wraps automatically, so no `@staticmethod` is needed. Remember that it creates the **class** `Person`, not a `Person` instance.

Each of the following steps adds two things: a helper static method that receives the new class object and builds something for it, and one line in `__new__` that attaches the result to the class.

## Step 2: Properties

First, a small helper class. A `Prop` object knows the name of the "private" attribute (for example `_name`) and offers three methods that read, write and delete that attribute on any object:

```python
class Prop:
    def __init__(self, attr):
        self._attr = attr

    def get(self, obj):
        return getattr(obj, self._attr)

    def set(self, obj, value):
        setattr(obj, self._attr, value)

    def delete(self, obj):
        delattr(obj, self._attr)
```

Next, a static method of `Data` that creates one property per field and puts it on the class. In `__new__`, call it right after the class is built:

```python
    # inside class Data:
    def __new__(mcs, name, bases, class_dict):
        class_obj = super().__new__(mcs, name, bases, class_dict)

        # create properties
        mcs.define_property(class_obj)

        return class_obj

    @staticmethod
    def define_property(class_obj):
        for prop in class_obj.props:
            accessor = Prop(f"_{prop}")
            prop_obj = property(
                fget=accessor.get,
                fset=accessor.set,
                fdel=accessor.delete,
            )
            setattr(class_obj, prop, prop_obj)
```

How it works:

- For the field `"name"`, `accessor` is `Prop("_name")`. `accessor.get` is a **bound method**: when the property later calls `fget(obj)`, that becomes `accessor.get(obj)`, which returns `getattr(obj, "_name")`.
- `property(fget=..., fset=..., fdel=...)` is exactly what the `@property` and `@name.setter` decorators build behind the scenes.
- `setattr(class_obj, "name", prop_obj)` attaches the property to the class, as if you had written it in the class body.
- The value is stored under `_name`, not `name`. If the setter wrote to `obj.name`, it would call itself again and recurse forever.
- `mcs.define_property(...)` instead of `Data.define_property(...)` lets a subclass of `Data` override the helper.

With only this step in place, the properties already work:

```python
class Person(metaclass=Data):
    props = ["name", "age"]


p = Person()
p.name = "John Doe"
print(p.name)
print(p.__dict__)
print([key for key in Person.__dict__ if not key.startswith("__")])

try:
    print(p.age)
except AttributeError as error:
    print("Error:", error)
```

Output:

```text
John Doe
{'_name': 'John Doe'}
['props', 'name', 'age']
Error: 'Person' object has no attribute '_age'
```

`age` was never set, so reading it fails. An `__init__` that requires every field fixes that.

## Step 3: `__init__`

The `init` helper does not run anything itself. It **builds** a function and returns it, and `__new__` installs that function as the class's `__init__`:

```python
        # in Data.__new__, after define_property:
        # define __init__
        setattr(class_obj, "__init__", mcs.init(class_obj))
```

```python
    # inside class Data:
    @staticmethod
    def init(class_obj):
        props = class_obj.props
        name = class_obj.__name__

        def _init(self, *args, **kwargs):
            if len(args) > len(props):
                raise TypeError(f"{name}() takes {len(props)} values, got {len(args)}")
            values = dict(zip(props, args))
            for key, value in kwargs.items():
                if key not in props:
                    raise TypeError(f"{name}() got an unexpected argument {key!r}")
                if key in values:
                    raise TypeError(f"{name}() got multiple values for {key!r}")
                values[key] = value
            missing = [prop for prop in props if prop not in values]
            if missing:
                raise TypeError(f"{name}() is missing values for {missing}")
            for key, value in values.items():
                setattr(self, key, value)

        return _init
```

`_init` is a **closure**: it remembers `props` and `name` from the call to `init()`. Every class created by `Data` gets its own `_init` with its own field list.

The function accepts values by position, by keyword or both, like a normal `__init__`: positional values are matched with the fields in order, then keyword values are added. It rejects unknown names, duplicates and missing fields. `setattr(self, key, value)` goes through the property from step 2, so the value ends up in `_name`, `_age` and so on.

```python
p = Person("John Doe", age=25)
print(p.__dict__)

try:
    Person("John Doe", agee=25)
except TypeError as error:
    print("Error:", error)
```

Output:

```text
{'_name': 'John Doe', '_age': 25}
Error: Person() got an unexpected argument 'agee'
```

> **Note:** The original tutorial's `__init__` simply looped over the known fields and ignored everything else. With it, a typo like `Person("John Doe", nme="x")` raised no error at all. The object was created without `_age`, and the problem surfaced only later as `AttributeError: 'Person' object has no attribute '_age'`. Generated code should fail as early and as clearly as hand-written code.

## Step 4: `__repr__`

```python
        # in Data.__new__, after __init__:
        # define __repr__
        setattr(class_obj, "__repr__", mcs.repr(class_obj))
```

```python
    # inside class Data:
    @staticmethod
    def repr(class_obj):
        def _repr(self):
            pairs = (f"{prop}={getattr(self, prop)!r}" for prop in class_obj.props)
            return f"{class_obj.__name__}({', '.join(pairs)})"

        return _repr
```

```python
p = Person("John Doe", age=25)
print(p)
print([p])
```

Output:

```text
Person(name='John Doe', age=25)
[Person(name='John Doe', age=25)]
```

The `!r` conversion formats each value with `repr()`, so strings appear in quotes and the result looks like the call that creates the object. Without `!r` you would get `Person(name=John Doe, age=25)`, which is ambiguous: is `John Doe` one value or two? A `__repr__` is used for both `print(p)` and containers such as `[p]`, so one method covers both cases.

## Step 5: `__eq__` and `__hash__`

```python
        # in Data.__new__, after __repr__:
        # define __eq__ and __hash__
        setattr(class_obj, "__eq__", mcs.eq(class_obj))
        setattr(class_obj, "__hash__", mcs.hash(class_obj))
```

```python
    # inside class Data:
    @staticmethod
    def eq(class_obj):
        def _eq(self, other):
            if not isinstance(other, class_obj):
                return NotImplemented
            self_values = [getattr(self, prop) for prop in class_obj.props]
            other_values = [getattr(other, prop) for prop in class_obj.props]
            return self_values == other_values

        return _eq

    @staticmethod
    def hash(class_obj):
        def _hash(self):
            return hash(tuple(getattr(self, prop) for prop in class_obj.props))

        return _hash
```

Design decisions:

- Two objects are equal when all their field values are equal.
- For an object of another type, `_eq` returns `NotImplemented`, not `False`. This tells Python "I don't know how to compare with that", so Python can try the other object's `__eq__` before falling back to an identity comparison. The original tutorial returned `False` here, which blocks that mechanism.
- Both sides are read using `class_obj.props`. The original read `other.props`, which breaks if `other` is a subclass with a different field list.
- `_hash` hashes a tuple of the same values that `_eq` compares. The rule for hashing is: **equal objects must have equal hashes**. Using the same fields in both methods guarantees it.

## Put it all together

```python
class Prop:
    def __init__(self, attr):
        self._attr = attr

    def get(self, obj):
        return getattr(obj, self._attr)

    def set(self, obj, value):
        setattr(obj, self._attr, value)

    def delete(self, obj):
        delattr(obj, self._attr)


class Data(type):
    def __new__(mcs, name, bases, class_dict):
        class_obj = super().__new__(mcs, name, bases, class_dict)

        # create properties
        mcs.define_property(class_obj)

        # define __init__
        setattr(class_obj, "__init__", mcs.init(class_obj))

        # define __repr__
        setattr(class_obj, "__repr__", mcs.repr(class_obj))

        # define __eq__ and __hash__
        setattr(class_obj, "__eq__", mcs.eq(class_obj))
        setattr(class_obj, "__hash__", mcs.hash(class_obj))

        return class_obj

    @staticmethod
    def define_property(class_obj):
        for prop in class_obj.props:
            accessor = Prop(f"_{prop}")
            prop_obj = property(
                fget=accessor.get,
                fset=accessor.set,
                fdel=accessor.delete,
            )
            setattr(class_obj, prop, prop_obj)

    @staticmethod
    def init(class_obj):
        props = class_obj.props
        name = class_obj.__name__

        def _init(self, *args, **kwargs):
            if len(args) > len(props):
                raise TypeError(f"{name}() takes {len(props)} values, got {len(args)}")
            values = dict(zip(props, args))
            for key, value in kwargs.items():
                if key not in props:
                    raise TypeError(f"{name}() got an unexpected argument {key!r}")
                if key in values:
                    raise TypeError(f"{name}() got multiple values for {key!r}")
                values[key] = value
            missing = [prop for prop in props if prop not in values]
            if missing:
                raise TypeError(f"{name}() is missing values for {missing}")
            for key, value in values.items():
                setattr(self, key, value)

        return _init

    @staticmethod
    def repr(class_obj):
        def _repr(self):
            pairs = (f"{prop}={getattr(self, prop)!r}" for prop in class_obj.props)
            return f"{class_obj.__name__}({', '.join(pairs)})"

        return _repr

    @staticmethod
    def eq(class_obj):
        def _eq(self, other):
            if not isinstance(other, class_obj):
                return NotImplemented
            self_values = [getattr(self, prop) for prop in class_obj.props]
            other_values = [getattr(other, prop) for prop in class_obj.props]
            return self_values == other_values

        return _eq

    @staticmethod
    def hash(class_obj):
        def _hash(self):
            return hash(tuple(getattr(self, prop) for prop in class_obj.props))

        return _hash


class Person(metaclass=Data):
    props = ["name", "age"]


if __name__ == "__main__":
    print(list(Person.__dict__))

    p1 = Person("John Doe", age=25)
    p2 = Person("Jane Doe", age=25)
    print(p1, p2)
    print(p1.__dict__)

    print(p1 == p2)
    p2.name = "John Doe"
    print(p1 == p2)
    print(len({p1, p2}))

    try:
        Person("John Doe", 25, nme="x")
    except TypeError as error:
        print("Error:", error)
```

Output (Python 3.14):

```text
['__module__', '__firstlineno__', 'props', '__static_attributes__', '__dict__', '__weakref__', '__doc__', 'name', 'age', '__init__', '__repr__', '__eq__', '__hash__']
Person(name='John Doe', age=25) Person(name='Jane Doe', age=25)
{'_name': 'John Doe', '_age': 25}
False
True
1
Error: Person() got an unexpected argument 'nme'
```

The class body contained only `props`, yet `Person.__dict__` now holds two properties and four special methods. After `p2.name = "John Doe"` the two objects are equal and have the same hash, so the set keeps only one of them.

## Applying the metaclass with a decorator

Writing `metaclass=Data` in every class header is a bit noisy. The original tutorial suggested a decorator that rebuilds the class with `Data`. Continuing the program above:

```python
def data(cls):
    return Data(cls.__name__, cls.__bases__, dict(cls.__dict__))


@data
class Employee:
    props = ["name", "job_title"]


e = Employee(name="John Doe", job_title="Python Developer")
print(e)
print(type(Employee).__name__)

try:
    print(e.__dict__)
except TypeError as error:
    print("Error:", error)
```

Output:

```text
Employee(name='John Doe', job_title='Python Developer')
Data
Error: descriptor '__dict__' for 'Employee' objects doesn't apply to a 'Employee' object
```

The class works at first sight, but `e.__dict__` (and `vars(e)`) is broken. The reason: `cls.__dict__` of the *original* class contains two descriptors, `__dict__` and `__weakref__`, that belong to that original class. Copying them into the new class means that `e.__dict__` uses a descriptor that only accepts instances of the **old** `Employee`. The fix is to drop those two entries before rebuilding:

```python
def data(cls):
    namespace = dict(cls.__dict__)
    # these two descriptors belong to the original class: drop them
    namespace.pop("__dict__", None)
    namespace.pop("__weakref__", None)
    return Data(cls.__name__, cls.__bases__, namespace)


@data
class Employee:
    props = ["name", "job_title"]


e = Employee(name="John Doe", job_title="Python Developer")
print(e)
print(e.__dict__)


class Manager(Employee):
    pass


print(type(Manager).__name__, Manager("Olena", "CTO"))
```

Output:

```text
Employee(name='John Doe', job_title='Python Developer')
{'_name': 'John Doe', '_job_title': 'Python Developer'}
Data Manager(name='Olena', job_title='CTO')
```

Two more things to know about this decorator:

- The class is built **twice**: first by `type` (the ordinary `class` statement), then again by `Data`. The first class object is thrown away.
- The returned class is an instance of `Data`, so its subclasses (like `Manager`) also go through `Data`. Here the decorator and the `metaclass=` keyword give the same result.

## The standard solution: `@dataclass`

Since Python 3.7 the standard library has `dataclasses` (PEP 557). It covers everything the `Data` metaclass does, and more, using a class decorator and type annotations:

```python
from dataclasses import dataclass


@dataclass
class Person:
    name: str
    age: int


p1 = Person("John Doe", age=25)
p2 = Person("John Doe", 25)
print(p1)
print(p1 == p2)
print(Person.__hash__)

try:
    Person("John Doe")
except TypeError as error:
    print("Error:", error)


@dataclass(frozen=True)
class Point:
    x: int
    y: int


print({Point(1, 2), Point(1, 2)})
```

Output:

```text
Person(name='John Doe', age=25)
True
None
Error: Person.__init__() missing 1 required positional argument: 'age'
{Point(x=1, y=2)}
```

Notice `Person.__hash__` is `None`: a regular (mutable) dataclass is deliberately **unhashable**, for the reason explained in *Common mistakes*. A `frozen=True` dataclass cannot be changed after creation, so it gets a safe `__hash__`.

| Feature | `Data` metaclass | `@dataclass` |
|---|---|---|
| Field list | `props = [...]` | type annotations |
| `__init__` with real signature, defaults | no (generic `*args, **kwargs`) | yes |
| `__repr__`, `__eq__` | yes | yes |
| `__hash__` | always, even for mutable objects | only when it is safe (`frozen=True`) or requested |
| Ordering (`<`, `>`), `__slots__`, keyword-only fields | no | yes (`order=True`, `slots=True`, `kw_only=True`) |
| Works with IDEs and type checkers | poorly | fully |

In real projects use `@dataclass` (or a library such as attrs or Pydantic). The `Data` metaclass is valuable as an exercise: it shows exactly what such tools generate for you.

## Common mistakes

- **Making mutable objects hashable.** `Data` gives every class a `__hash__` based on field values, but the fields can change. If an object changes while it sits in a set or serves as a dictionary key, it is stored under its *old* hash and can no longer be found. Continuing the full program:

  ```python
  team = {Person("John Doe", 25)}
  member = next(iter(team))
  member.age = 26

  print(member in team)
  print(Person("John Doe", 26) in team)
  ```

  Output:

  ```text
  False
  False
  ```

  The object is in the set, yet the set cannot find it. Either make such objects immutable (like `frozen=True` dataclasses) or leave them unhashable.

- **Silently ignoring bad arguments.** Generated `__init__` methods should reject unknown, duplicate and missing fields, as in step 3. Otherwise typos turn into confusing errors far from their cause.
- **Copying `cls.__dict__` blindly when rebuilding a class.** Remove `__dict__` and `__weakref__` first, as the fixed `data` decorator does.
- **Returning `False` instead of `NotImplemented` from `__eq__`.** For an unsupported type, return `NotImplemented` and let Python try the other operand.
- **Creating functions in a loop that use the loop variable.** Closures look up variables when they are *called*, not when they are created, so every function sees the last value:

  ```python
  class Box:
      pass


  box = Box()
  box._name, box._age = "Olena", 31

  getters = {}
  for field in ["name", "age"]:
      getters[field] = lambda obj: getattr(obj, f"_{field}")

  print(getters["name"](box))
  print(getters["age"](box))
  ```

  Output:

  ```text
  31
  31
  ```

  Both getters read `_age`. That is why `define_property` creates a separate `Prop` object for each field, and why helper functions that receive the field as a parameter are the safe way to build per-field functions.

## Summary

- Data-holding classes need the same boilerplate again and again: properties, `__init__`, `__repr__`, `__eq__`, `__hash__`.
- A metaclass can generate that code once per class, at class-creation time, from a declarative field list such as `props = ["name", "age"]`.
- Helper "builder" functions return closures, and `setattr(class_obj, "__init__", ...)` attaches them to the class.
- Generated methods should behave like good hand-written ones: strict argument checks, `!r` in `__repr__`, `NotImplemented` in `__eq__`, the same fields in `__eq__` and `__hash__`.
- A class decorator can apply a metaclass, but it must drop the `__dict__` and `__weakref__` descriptors when it copies the namespace.
- Hashable objects should be immutable. Changing a hashed object breaks sets and dictionaries.
- In real code, use `@dataclass`, which provides all of this and more.

## Practice

### Exercise 1: Automatic `__repr__`

Write a metaclass `AutoRepr` that gives every class it creates a `__repr__` based on a class attribute `fields`, a tuple of attribute names. Use it for a class `City` with fields `name` and `population`, so that `print(City("Kyiv", 2_950_000))` prints `City(name='Kyiv', population=2950000)`.

### Exercise 2: The dataclass way

Define a class `Book` with the fields `title`, `author` and `year` as a frozen dataclass. Show that two books created with the same values (one with positional, one with keyword arguments) are equal, that a set keeps only one of them, and that changing `year` raises `dataclasses.FrozenInstanceError`.

### Exercise 3: Type-checked properties

Write a metaclass `Typed` that reads a class attribute `fields`, a dictionary such as `{"name": str, "age": int}`, and creates a property for each field. The setter must raise `TypeError` when the value has the wrong type, for example `age must be int, got str`. Store values in `_name`, `_age` and so on. Make sure each property checks its *own* type (remember the late-binding trap).

### Exercise 4: Immutable value objects

Write a metaclass `Frozen` that reads a tuple `fields` and generates:

- `__init__(*args)` that requires exactly one value per field;
- `__setattr__` that always raises `AttributeError("<Name> objects are read-only")`;
- `__eq__`, `__hash__` and `__repr__` based on the field values.

Test it with `class Money(metaclass=Frozen): fields = ("amount", "currency")`. Hint: inside `__init__` you need a way to set attributes that bypasses your own `__setattr__`.

## Solutions

### Exercise 1

```python
class AutoRepr(type):
    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)

        def __repr__(self):
            pairs = ", ".join(f"{field}={getattr(self, field)!r}" for field in self.fields)
            return f"{type(self).__name__}({pairs})"

        cls.__repr__ = __repr__
        return cls


class City(metaclass=AutoRepr):
    fields = ("name", "population")

    def __init__(self, name, population):
        self.name = name
        self.population = population


print(City("Kyiv", 2_950_000))
print([City("Lviv", 717_000)])
```

Output:

```text
City(name='Kyiv', population=2950000)
[City(name='Lviv', population=717000)]
```

### Exercise 2

```python
from dataclasses import FrozenInstanceError, dataclass


@dataclass(frozen=True)
class Book:
    title: str
    author: str
    year: int


b1 = Book("Dune", "Frank Herbert", 1965)
b2 = Book(title="Dune", author="Frank Herbert", year=1965)
print(b1)
print(b1 == b2, len({b1, b2}))

try:
    b1.year = 2000
except FrozenInstanceError as error:
    print("Error:", error)
```

Output:

```text
Book(title='Dune', author='Frank Herbert', year=1965)
True 1
Error: cannot assign to field 'year'
```

A five-line class definition replaces the whole `Data` metaclass, and because the objects are frozen, hashing them is safe.

### Exercise 3

```python
class Typed(type):
    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)
        for field, expected in cls.fields.items():
            setattr(cls, field, mcs.make_property(field, expected))
        return cls

    @staticmethod
    def make_property(field, expected):
        attr = f"_{field}"

        def getter(self):
            return getattr(self, attr)

        def setter(self, value):
            if not isinstance(value, expected):
                raise TypeError(
                    f"{field} must be {expected.__name__}, got {type(value).__name__}"
                )
            setattr(self, attr, value)

        return property(getter, setter)


class Person(metaclass=Typed):
    fields = {"name": str, "age": int}

    def __init__(self, name, age):
        self.name = name
        self.age = age


p = Person("Olena", 31)
print(p.name, p.age)

try:
    p.age = "thirty"
except TypeError as error:
    print("Error:", error)

try:
    Person(42, 31)
except TypeError as error:
    print("Error:", error)
```

Output:

```text
Olena 31
Error: age must be int, got str
Error: name must be str, got int
```

`make_property()` is a separate function, so each call creates fresh `field`, `expected` and `attr` variables for its closures. Defining `getter` and `setter` directly inside the `for` loop would make every property use the last field.

### Exercise 4

```python
class Frozen(type):
    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)
        fields = cls.fields

        def values(self):
            return tuple(getattr(self, field) for field in fields)

        def __init__(self, *args):
            if len(args) != len(fields):
                raise TypeError(f"{name}() expects {len(fields)} values, got {len(args)}")
            for field, value in zip(fields, args):
                object.__setattr__(self, field, value)

        def __setattr__(self, key, value):
            raise AttributeError(f"{name} objects are read-only")

        def __eq__(self, other):
            if not isinstance(other, cls):
                return NotImplemented
            return values(self) == values(other)

        def __hash__(self):
            return hash(values(self))

        def __repr__(self):
            pairs = ", ".join(f"{f}={v!r}" for f, v in zip(fields, values(self)))
            return f"{name}({pairs})"

        for method in (__init__, __setattr__, __eq__, __hash__, __repr__):
            setattr(cls, method.__name__, method)
        return cls


class Money(metaclass=Frozen):
    fields = ("amount", "currency")


price = Money(10, "UAH")
print(price)
print(price == Money(10, "UAH"))
print(len({price, Money(10, "UAH"), Money(5, "EUR")}))

try:
    price.amount = 0
except AttributeError as error:
    print("Error:", error)
```

Output:

```text
Money(amount=10, currency='UAH')
True
2
Error: Money objects are read-only
```

`object.__setattr__(self, field, value)` calls the base implementation directly and skips the blocking `__setattr__`. This is the same trick that frozen dataclasses use. To block `del price.amount` as well, add a `__delattr__` that raises in the same way.

---

*Source: [pythontutorial.net — Python Metaclass Example](https://www.pythontutorial.net/python-oop/python-metaclass-example/). Adapted and expanded for PyJourney.*
