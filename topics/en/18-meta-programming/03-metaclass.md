# Metaclass

A **metaclass** is a class whose instances are classes. Every class you write is created by a metaclass, normally `type`. By writing your own metaclass you can step into the moment a class is created and change it: add attributes, check rules, register the class somewhere. It is a powerful tool, but modern Python offers simpler alternatives for most of these jobs, so it pays to know both.

## What you'll learn

- How the `metaclass=` keyword chooses the metaclass of a class
- How to write a custom metaclass by subclassing `type` and overriding `__new__`
- When metaclass code runs, and why subclasses use the same metaclass
- How to pass keyword arguments to a metaclass
- The four metaclass hooks: `__prepare__`, `__new__`, `__init__` and `__call__`
- When to use a metaclass and when `__init_subclass__` or a class decorator is the better choice

## The default metaclass: `type`

When Python executes a `class` statement, it creates the class by calling its metaclass. If you do not choose one, the metaclass is `type`. These two definitions are equivalent:

```python
class Person:
    pass


class Person2(object, metaclass=type):
    pass


print(type(Person), type(Person2))
```

Output:

```text
<class 'type'> <class 'type'>
```

The `metaclass` keyword in the class header tells Python which class should build this class. Pass a subclass of `type` there, and that subclass decides how the class is created.

```text
metaclass  --creates-->  class  --creates-->  instance
  type                   Person               Person("John", 25)
  Human                  Person               Person("John", 25)
```

## Writing a custom metaclass

A metaclass is a class that inherits from `type`. The most common hook to override is `__new__`, which creates the class object. The metaclass below gives every class it builds an attribute `freedom = True`:

```python
class Human(type):
    def __new__(mcs, name, bases, class_dict):
        print(f"Human.__new__: building class {name!r}")
        class_ = super().__new__(mcs, name, bases, class_dict)
        class_.freedom = True
        return class_


class Person(object, metaclass=Human):
    def __init__(self, name, age):
        self.name = name
        self.age = age


print(type(Person))
print(Person.freedom)
print(list(Person.__dict__))

john = Person("John", 25)
print(john.freedom, type(john).__name__)
```

Output (Python 3.14):

```text
Human.__new__: building class 'Person'
<class '__main__.Human'>
True
['__module__', '__firstlineno__', '__init__', '__static_attributes__', '__dict__', '__weakref__', '__doc__', 'freedom']
True Person
```

The parameters of a metaclass's `__new__` are exactly the arguments of `type(name, bases, namespace)` from the previous topic:

| Parameter | Meaning | Value here |
|---|---|---|
| `mcs` | the metaclass itself (like `cls` in a regular `__new__`) | `Human` |
| `name` | the name of the class being created | `"Person"` |
| `bases` | tuple of base classes | `(object,)` |
| `class_dict` | the namespace filled by the class body | `{'__init__': ..., ...}` |

`super().__new__(mcs, name, bases, class_dict)` lets `type` build the real class object. Before returning it, `Human` adds `freedom`. Note the difference from the `__new__` method of an ordinary class: a metaclass's `__new__` returns a new **class**, not an instance.

> **Note:** The first parameter is often called `mcs`, `mcls` or `metacls` to stress that it is a metaclass. The name is only a convention.

### When the metaclass code runs

Look at the first line of the output above: `Human.__new__` ran **when the class was defined**, before any `Person` object existed. A metaclass works at class-creation time, once per class. Creating instances does not call the metaclass's `__new__` again.

### Subclasses inherit the metaclass

A class's metaclass is inherited by its subclasses, so the metaclass also builds every subclass:

```python
class Human(type):
    def __new__(mcs, name, bases, class_dict):
        print(f"Human.__new__: building class {name!r}")
        class_ = super().__new__(mcs, name, bases, class_dict)
        class_.freedom = True
        return class_


class Person(metaclass=Human):
    pass


class Student(Person):
    pass


print(type(Student).__name__)
print(Student.freedom, "freedom" in Student.__dict__)
```

Output:

```text
Human.__new__: building class 'Person'
Human.__new__: building class 'Student'
Human
True True
```

`Student` did not mention `Human`, yet `Human` built it and set `freedom` directly in its `__dict__`. This is the main thing a metaclass can do that a simple class decorator cannot: it reaches **the whole hierarchy** automatically.

## Passing arguments to a metaclass

Extra keyword arguments in the class header, besides `metaclass=`, are passed on to the metaclass. Here every keyword becomes a class attribute:

```python
class Human(type):
    def __new__(mcs, name, bases, class_dict, **kwargs):
        class_ = super().__new__(mcs, name, bases, class_dict)
        for key, value in kwargs.items():
            setattr(class_, key, value)
        return class_


class Person(object, metaclass=Human, country="USA", freedom=True):
    def __init__(self, name, age):
        self.name = name
        self.age = age


print(Person.country, Person.freedom)
print(list(Person.__dict__))
```

Output (Python 3.14):

```text
USA True
['__module__', '__firstlineno__', '__init__', '__static_attributes__', '__dict__', '__weakref__', '__doc__', 'country', 'freedom']
```

Two details matter here:

- `Human.__new__` **consumes** the keywords and does not forward them to `type.__new__`. If you forward them, `type.__new__` passes them to the `__init_subclass__` hook of the base class, and `object.__init_subclass__` accepts no keywords (see *Common mistakes*).
- The loop variable is called `key`, not `name`. Reusing `name` would silently overwrite the class name parameter inside the method.

## The four metaclass hooks

`__new__` is only one of the methods a metaclass can override. This tracer shows all four in the order Python calls them:

```python
class Tracer(type):
    @classmethod
    def __prepare__(mcs, name, bases, **kwargs):
        print(f"1. __prepare__: namespace for {name}")
        return {}

    def __new__(mcs, name, bases, namespace, **kwargs):
        own = [key for key in namespace if not key.startswith("__")]
        print(f"2. __new__: creating class {name} with {own}")
        return super().__new__(mcs, name, bases, namespace)

    def __init__(cls, name, bases, namespace, **kwargs):
        print(f"3. __init__: class {name} is ready")
        super().__init__(name, bases, namespace)

    def __call__(cls, *args, **kwargs):
        print(f"4. __call__: creating an instance of {cls.__name__}")
        return super().__call__(*args, **kwargs)


print("Defining the class...")


class Point(metaclass=Tracer):
    dimensions = 2

    def __init__(self, x, y):
        self.x = x
        self.y = y


print("Creating an instance...")
p = Point(1, 2)
print(p.x, p.y)
```

Output:

```text
Defining the class...
1. __prepare__: namespace for Point
2. __new__: creating class Point with ['dimensions']
3. __init__: class Point is ready
Creating an instance...
4. __call__: creating an instance of Point
1 2
```

| Hook | When it runs | What it is for |
|---|---|---|
| `__prepare__(mcs, name, bases, **kw)` | before the class body runs | returns the mapping used as the class namespace (must be a `classmethod`) |
| `__new__(mcs, name, bases, ns, **kw)` | after the body has run | creates and returns the class object; can change `ns` first |
| `__init__(cls, name, bases, ns, **kw)` | right after `__new__` | finishes setting up the already-created class |
| `__call__(cls, *args, **kw)` | every time the **class is called** | runs `cls.__new__` and `cls.__init__` to create an instance |

The last row connects this topic to the `__new__` method topic: calling a class runs `type.__call__`, and that is where the two-step "`__new__`, then `__init__`" process lives. A metaclass that overrides `__call__` controls how *instances* are created, for example to cache them.

`__prepare__` is rarely needed nowadays. Since Python 3.6 the class namespace is an ordinary dictionary that keeps the definition order, which was the classic reason to override it.

## A practical example: a plugin registry

Frameworks often need a list of all subclasses of some base class, for example all exporters or all database models. A metaclass can record every class it builds:

```python
class PluginMeta(type):
    registry = {}

    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)
        if bases:  # skip the base class itself
            mcs.registry[name.lower()] = cls
        return cls


class Plugin(metaclass=PluginMeta):
    pass


class CsvExporter(Plugin):
    pass


class JsonExporter(Plugin):
    pass


print(PluginMeta.registry)
exporter = PluginMeta.registry["jsonexporter"]()
print(type(exporter).__name__)
```

Output:

```text
{'csvexporter': <class '__main__.CsvExporter'>, 'jsonexporter': <class '__main__.JsonExporter'>}
JsonExporter
```

Simply defining a subclass is enough to register it. There is no list to keep up to date by hand.

## Simpler alternatives

Most things people once did with metaclasses now have lighter tools.

### `__init_subclass__` (Python 3.6+)

A base class can define `__init_subclass__`. Python calls it every time a subclass is created, without any metaclass. The registry above becomes:

```python
class Plugin:
    registry = {}

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        Plugin.registry[cls.__name__.lower()] = cls


class CsvExporter(Plugin):
    pass


class JsonExporter(Plugin):
    pass


print(Plugin.registry)
print(type(CsvExporter))
```

Output:

```text
{'csvexporter': <class '__main__.CsvExporter'>, 'jsonexporter': <class '__main__.JsonExporter'>}
<class 'type'>
```

Same behaviour, but the classes keep the ordinary metaclass `type`, so they combine freely with other classes. `__init_subclass__` can also accept keyword arguments from the class header (Exercise 4 shows how).

### Class decorators

To change **one** class after it is created, a class decorator is enough:

```python
def free(cls):
    cls.freedom = True
    return cls


@free
class Person:
    pass


class Student(Person):
    pass


print(Person.freedom, type(Person).__name__)
print(Student.freedom, "freedom" in Student.__dict__)
```

Output:

```text
True type
True False
```

The decorator ran for `Person` only. `Student` merely *inherits* the attribute, and the decorator would not run for it. Use a decorator when the change is local and a metaclass (or `__init_subclass__`) when it must apply to every subclass.

### Metaclasses you already use

The standard library uses metaclasses so that you don't have to write them yourself:

```python
import abc
import enum

print(type(abc.ABC))
print(type(enum.Enum))
print(issubclass(abc.ABCMeta, type), issubclass(enum.EnumType, type))
```

Output:

```text
<class 'abc.ABCMeta'>
<class 'enum.EnumType'>
True True
```

Abstract base classes and enumerations get their special behaviour from these metaclasses.

## When to use metaclasses

Tim Peters, the author of the Zen of Python, put it this way:

> Metaclasses are deeper magic than 99% of users should ever worry about. If you wonder whether you need them, you don't (the people who actually need them know with certainty that they need them, and don't need an explanation about why).

A practical order of preference:

1. A regular class, function or `@dataclass`.
2. A class decorator, if one class needs adjusting.
3. `__init_subclass__`, if every subclass of a base must be checked or registered.
4. A metaclass, if you need something only a metaclass can do: control the class namespace (`__prepare__`), change how instances are created for a whole hierarchy (`__call__`), or customize the behaviour of the class object itself. This usually happens inside frameworks and libraries such as ORMs.

## Common mistakes

- **Forwarding custom keywords to `type.__new__`.** They end up in `__init_subclass__`, which does not accept them:

  ```python
  class Human(type):
      def __new__(mcs, name, bases, class_dict, **kwargs):
          return super().__new__(mcs, name, bases, class_dict, **kwargs)


  class Person(metaclass=Human, country="USA"):
      pass
  ```

  Output:

  ```text
  Traceback (most recent call last):
    File "app.py", line 6, in <module>
      class Person(metaclass=Human, country="USA"):
          pass
    File "app.py", line 3, in __new__
      return super().__new__(mcs, name, bases, class_dict, **kwargs)
             ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  TypeError: Person.__init_subclass__() takes no keyword arguments
  ```

- **Forgetting to return the class from `__new__`.** The class statement then binds the name to `None`:

  ```python
  class Human(type):
      def __new__(mcs, name, bases, class_dict):
          class_ = super().__new__(mcs, name, bases, class_dict)
          class_.freedom = True
          # forgot: return class_


  class Person(metaclass=Human):
      pass


  print(Person)
  ```

  Output:

  ```text
  None
  ```

- **Mixing classes with unrelated metaclasses.** A class can have only one metaclass, and it must be compatible with the metaclasses of all bases:

  ```python
  class MetaA(type):
      pass


  class MetaB(type):
      pass


  class A(metaclass=MetaA):
      pass


  class B(metaclass=MetaB):
      pass


  class C(A, B):
      pass
  ```

  Output:

  ```text
  Traceback (most recent call last):
    File "app.py", line 17, in <module>
      class C(A, B):
          pass
  TypeError: metaclass conflict: the metaclass of a derived class must be a (non-strict) subclass of the metaclasses of all its bases
  ```

  The fix is a metaclass that inherits from both (`class MetaAB(MetaA, MetaB): pass`). This kind of conflict is a strong reason to prefer `__init_subclass__`, which leaves the metaclass as plain `type`.

- **Confusing the two `__new__` methods.** A metaclass's `__new__` creates a *class* and runs once per class definition. A class's own `__new__` creates *instances* and runs on every call.
- **Reaching for a metaclass first.** If a decorator or `__init_subclass__` solves the problem, the code will be shorter and easier to combine with other classes.

## Summary

- A metaclass is the class of a class. The default metaclass is `type`, and `class Person:` means `class Person(object, metaclass=type):`.
- A custom metaclass inherits from `type`. Its `__new__(mcs, name, bases, namespace)` creates the class object and must return it.
- Metaclass code runs when a class is **defined**, once per class, and the metaclass is inherited by all subclasses.
- Extra keywords in the class header (`class A(metaclass=M, key=value)`) reach the metaclass hooks. Do not forward them to `type.__new__`.
- The hooks run in this order: `__prepare__`, `__new__`, `__init__` at definition time, then `__call__` each time the class is called.
- `__init_subclass__` and class decorators cover most former metaclass use cases with less risk.
- Metaclasses power `abc.ABC` and `enum.Enum`. Write your own only when simpler tools cannot do the job.

## Practice

### Exercise 1: Predict the output

Without running the code, write down what it prints and in which order.

```python
class Loud(type):
    def __new__(mcs, name, bases, namespace):
        print("creating class", name)
        return super().__new__(mcs, name, bases, namespace)


print("start")


class Base(metaclass=Loud):
    pass


class Child(Base):
    pass


print("instances")
a = Base()
b = Child()
print(type(Child).__name__, type(b).__name__)
```

### Exercise 2: A final class

Write a metaclass `Final`. A class created with `metaclass=Final` must work normally, but any attempt to inherit from it must raise `TypeError("cannot inherit from final class <Name>")` at the moment the subclass is defined.

### Exercise 3: Documentation required

Write a metaclass `RequireDocs` that refuses to create a class (raises `TypeError`) if the class has no docstring, or if any public method (a callable whose name does not start with `_`) defined in the class body has no docstring. Test it with one fully documented class and two broken ones.

### Exercise 4: A registry without a metaclass

Rewrite the plugin registry using `__init_subclass__` so that each subclass chooses its key in the class header: `class CsvExporter(Exporter, key="csv")`. Store the classes in `Exporter.registry`, raise `ValueError` for a duplicate key, and write a function `export(fmt, rows)` that picks the exporter by key. Implement a CSV and a JSON exporter.

## Solutions

### Exercise 1

Output:

```text
start
creating class Base
creating class Child
instances
Loud Child
```

The metaclass runs while the classes are being *defined*, so both "creating class" lines appear before `"instances"`. `Child` inherits the metaclass `Loud` from `Base`. Creating instances does not call `Loud.__new__` at all.

### Exercise 2

```python
class Final(type):
    def __new__(mcs, name, bases, namespace):
        for base in bases:
            if isinstance(base, Final):
                raise TypeError(f"cannot inherit from final class {base.__name__}")
        return super().__new__(mcs, name, bases, namespace)


class Settings(metaclass=Final):
    debug = False


print(Settings.debug)

try:
    class MySettings(Settings):
        pass
except TypeError as error:
    print("Error:", error)
```

Output:

```text
False
Error: cannot inherit from final class Settings
```

`isinstance(base, Final)` asks "was this base class built by `Final`?". `Settings` was, so a subclass of it is rejected. For static type checkers the standard library offers the `typing.final` decorator, which documents the same intent without any runtime check.

### Exercise 3

```python
class RequireDocs(type):
    def __new__(mcs, name, bases, namespace):
        if not namespace.get("__doc__"):
            raise TypeError(f"class {name} has no docstring")
        for attr, value in namespace.items():
            if callable(value) and not attr.startswith("_") and not value.__doc__:
                raise TypeError(f"method {name}.{attr}() has no docstring")
        return super().__new__(mcs, name, bases, namespace)


class Invoice(metaclass=RequireDocs):
    """An invoice for one customer."""

    def total(self):
        """Return the total amount."""
        return 0


print("Invoice created")

try:
    class Receipt(metaclass=RequireDocs):
        """A payment receipt."""

        def print_copy(self):
            pass
except TypeError as error:
    print("Error:", error)

try:
    class Note(metaclass=RequireDocs):
        pass
except TypeError as error:
    print("Error:", error)
```

Output:

```text
Invoice created
Error: method Receipt.print_copy() has no docstring
Error: class Note has no docstring
```

A docstring in the class body is stored in the namespace under the key `__doc__`, so the metaclass can check it before the class even exists.

### Exercise 4

```python
import json


class Exporter:
    registry = {}

    def __init_subclass__(cls, /, key, **kwargs):
        super().__init_subclass__(**kwargs)
        if key in Exporter.registry:
            raise ValueError(f"duplicate exporter key: {key!r}")
        Exporter.registry[key] = cls


class CsvExporter(Exporter, key="csv"):
    def export(self, rows):
        return "\n".join(",".join(map(str, row)) for row in rows)


class JsonExporter(Exporter, key="json"):
    def export(self, rows):
        return json.dumps(rows)


def export(fmt, rows):
    return Exporter.registry[fmt]().export(rows)


print(sorted(Exporter.registry))
print(export("csv", [[1, 2], [3, 4]]))
print(export("json", [[1, 2], [3, 4]]))

try:
    class AnotherCsv(Exporter, key="csv"):
        pass
except ValueError as error:
    print("Error:", error)
```

Output:

```text
['csv', 'json']
1,2
3,4
[[1, 2], [3, 4]]
Error: duplicate exporter key: 'csv'
```

`__init_subclass__` is implicitly a class method, so `cls` is the new subclass. The `key` keyword from the class header arrives as a normal parameter, and the remaining keywords are passed up the chain with `super().__init_subclass__(**kwargs)`.

---

*Source: [pythontutorial.net — Python Metaclass](https://www.pythontutorial.net/python-oop/python-metaclass/). Adapted and expanded for PyJourney.*
