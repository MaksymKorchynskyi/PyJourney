# Multiple Inheritance

A class in Python can inherit from **more than one** parent class. This is called multiple inheritance. It lets you combine independent pieces of behaviour, but it also raises a question that single inheritance never has to answer: if two parents define the same method, which one wins? Python answers it with the **method resolution order (MRO)**, and understanding the MRO is the key to using multiple inheritance and `super()` correctly.

## What you'll learn

- How to declare a class with several parents and what it inherits
- What the method resolution order is and how to inspect it with `__mro__`
- How Python builds the MRO (C3 linearization) and why it solves the "diamond problem"
- Why `super()` means "the next class in the MRO", not "my parent"
- How to write `__init__` methods that cooperate across several parents
- How to use mixins, the most practical form of multiple inheritance

## Declaring multiple parents

List the parent classes, separated by commas, in the parentheses after the class name:

```python
class ChildClass(ParentClass1, ParentClass2, ParentClass3):
    pass
```

Here is a simple example. A `Car` can go, a `Flyable` thing can fly, and a `FlyingCar` can do both:

```python
class Car:
    def go(self):
        print("Going")


class Flyable:
    def fly(self):
        print("Flying")


class FlyingCar(Flyable, Car):
    pass


fc = FlyingCar()
fc.go()
fc.fly()
print(isinstance(fc, Car), isinstance(fc, Flyable))
print(FlyingCar.__bases__)
```

Output:

```text
Going
Flying
True True
(<class '__main__.Flyable'>, <class '__main__.Car'>)
```

`FlyingCar` inherits every method of both parents, and its instances are instances of both. `__bases__` holds the direct parents in the order you listed them, and that order matters, as the next section shows.

## Method resolution order (MRO)

When you call a method on an object, Python searches a list of classes and uses the first one that defines it. That list is the **method resolution order**. Every class stores it in the `__mro__` attribute (the `mro()` method returns the same thing as a list).

Let both parents define `start()`:

```python
class Car:
    def start(self):
        print("Start the Car")

    def go(self):
        print("Going")


class Flyable:
    def start(self):
        print("Start the Flyable object")

    def fly(self):
        print("Flying")


class FlyingCar(Flyable, Car):
    def start(self):
        super().start()


car = FlyingCar()
car.start()
print(FlyingCar.__mro__)
print([cls.__name__ for cls in FlyingCar.mro()])
```

Output:

```text
Start the Flyable object
(<class '__main__.FlyingCar'>, <class '__main__.Flyable'>, <class '__main__.Car'>, <class 'object'>)
['FlyingCar', 'Flyable', 'Car', 'object']
```

The MRO is `FlyingCar → Flyable → Car → object`. `Car` and `Flyable` inherit from `object` implicitly, so `object` is always last. `super().start()` inside `FlyingCar` looks for `start` in the classes **after** `FlyingCar` in this list, finds it in `Flyable` first, and calls `Flyable.start()`. `Car.start()` is never reached.

Swap the parents, and the MRO swaps with them:

```python
class Car:
    def start(self):
        print("Start the Car")


class Flyable:
    def start(self):
        print("Start the Flyable object")


class FlyingCar(Car, Flyable):
    def start(self):
        super().start()


car = FlyingCar()
car.start()
print([cls.__name__ for cls in FlyingCar.__mro__])
```

Output:

```text
Start the Car
['FlyingCar', 'Car', 'Flyable', 'object']
```

> **Tip:** Read the base-class list left to right as a priority list: when parents disagree, the leftmost one wins.

## The diamond problem and C3 linearization

Things get interesting when two parents share a common ancestor. This shape is called a **diamond**:

```text
        A
       / \
      B   C
       \ /
        D
```

```python
class A:
    def hello(self):
        print("A.hello")


class B(A):
    def hello(self):
        print("B.hello")
        super().hello()


class C(A):
    def hello(self):
        print("C.hello")
        super().hello()


class D(B, C):
    def hello(self):
        print("D.hello")
        super().hello()


D().hello()
print([cls.__name__ for cls in D.__mro__])
```

Output:

```text
D.hello
B.hello
C.hello
A.hello
['D', 'B', 'C', 'A', 'object']
```

Two things stand out:

1. `A.hello()` runs **once**, even though `A` is reachable through both `B` and `C`.
2. `super().hello()` inside `B` called `C.hello()`, not `A.hello()`. `B` does not even know that `C` exists!

Python builds the MRO with an algorithm called **C3 linearization** (used since Python 2.3). It guarantees that:

- a class always comes **before its parents**;
- the parents of a class keep the **left-to-right order** in which they were listed;
- every class appears **exactly once**;
- the result is **consistent with the MRO of every parent**.

For `D(B, C)`, C3 merges the parents' MROs and the list of parents, each time taking the first head that does not appear in the tail of another list:

```text
L[B] = B, A, object
L[C] = C, A, object
L[D] = D + merge([B, A, object], [C, A, object], [B, C])
     = D, B        (B is a head and is not in any tail)
     = D, B, C     (A is in the tail of [C, A, object], skip it; take C)
     = D, B, C, A, object
```

A naive depth-first search would give `D, B, A, C`, which visits `A` before `C`. Then `C.hello()`, which is supposed to override `A.hello()`, would be skipped. C3 avoids that.

### When no consistent order exists

If the rules cannot all be satisfied, Python refuses to create the class:

```python
class A:
    pass


class B(A):
    pass


try:
    class X(A, B):
        pass
except TypeError as error:
    print(error)
```

Output:

```text
Cannot create a consistent method resolution order (MRO) for bases A, B
```

`X(A, B)` asks for `A` before `B`, but `B` is a subclass of `A`, so `B` must come before `A`. The fix is to list the more specific class first, `X(B, A)`, or simply `X(B)`.

## `super()` means "next in the MRO"

The diamond example shows the most important fact about `super()`:

> `super()` does **not** call the parent class. It calls the **next class in the MRO of the object's actual type**.

Inside `B.hello()`, `super()` depends on what `self` is. For a `B` object the MRO is `B, A, object`, so `super()` leads to `A`. For a `D` object the MRO is `D, B, C, A, object`, so the same line leads to `C`. This is what allows several classes to **cooperate**: if each one does its own work and then calls `super()`, every class in the MRO runs exactly once.

The flip side: one class that forgets to call `super()` breaks the chain for everyone after it.

```python
class A:
    def hello(self):
        print("A.hello")


class B(A):
    def hello(self):
        print("B.hello")  # no super().hello() here


class C(A):
    def hello(self):
        print("C.hello")
        super().hello()


class D(B, C):
    def hello(self):
        print("D.hello")
        super().hello()


D().hello()
```

Output:

```text
D.hello
B.hello
```

`C.hello()` and `A.hello()` silently never run.

## Multiple inheritance and `__init__`

Constructors are where multiple inheritance usually hurts, because parents often need **different arguments**:

```python
class Car:
    def __init__(self, door, wheel):
        print("Car.__init__")
        self.door = door
        self.wheel = wheel


class Flyable:
    def __init__(self, wing):
        print("Flyable.__init__")
        self.wing = wing


class FlyingCar(Flyable, Car):
    def __init__(self, door, wheel, wing):
        super().__init__(wing=wing)  # calls Flyable.__init__ only
        self.door = door             # duplicates Car's logic by hand
        self.wheel = wheel


fc = FlyingCar(2, 4, 2)
print(vars(fc))
```

Output:

```text
Flyable.__init__
{'wing': 2, 'door': 2, 'wheel': 4}
```

The object ends up with the right attributes, but `Car.__init__` never ran. `FlyingCar` copied `Car`'s logic instead, so any validation or extra setup added to `Car.__init__` later will silently be missing from `FlyingCar`. There are two proper solutions.

### Option 1: call each parent explicitly

```python
class Car:
    def __init__(self, door, wheel):
        print("Car.__init__")
        self.door = door
        self.wheel = wheel


class Flyable:
    def __init__(self, wing):
        print("Flyable.__init__")
        self.wing = wing


class FlyingCar(Flyable, Car):
    def __init__(self, door, wheel, wing):
        Flyable.__init__(self, wing)
        Car.__init__(self, door, wheel)


fc = FlyingCar(2, 4, 2)
print(vars(fc))
```

Output:

```text
Flyable.__init__
Car.__init__
{'wing': 2, 'door': 2, 'wheel': 4}
```

This is simple and readable when the parents are unrelated. It breaks down in a diamond: if both parents share a base, the base's `__init__` runs twice:

```python
class Vehicle:
    def __init__(self):
        print("Vehicle.__init__")
        self.registered = True


class Car(Vehicle):
    def __init__(self, door, wheel):
        Vehicle.__init__(self)
        print("Car.__init__")
        self.door = door
        self.wheel = wheel


class Flyable(Vehicle):
    def __init__(self, wing):
        Vehicle.__init__(self)
        print("Flyable.__init__")
        self.wing = wing


class FlyingCar(Flyable, Car):
    def __init__(self, door, wheel, wing):
        Flyable.__init__(self, wing)
        Car.__init__(self, door, wheel)


fc = FlyingCar(2, 4, 2)
print(vars(fc))
```

Output:

```text
Vehicle.__init__
Flyable.__init__
Vehicle.__init__
Car.__init__
{'registered': True, 'wing': 2, 'door': 2, 'wheel': 4}
```

Here it is harmless, but if `Vehicle.__init__` registered the vehicle in a database or opened a connection, it would now do it twice.

### Option 2: cooperative `__init__` with keyword arguments

The robust pattern is to make every `__init__` in the hierarchy **cooperative**:

1. Accept your own parameters **by keyword** and everything else as `**kwargs`.
2. Pass the remaining `**kwargs` on with `super().__init__(**kwargs)`.
3. Let `object.__init__()` at the end of the chain receive nothing (it accepts no extra arguments).

```python
class Vehicle:
    def __init__(self, **kwargs):
        print("Vehicle.__init__")
        super().__init__(**kwargs)
        self.registered = True


class Car(Vehicle):
    def __init__(self, *, door, wheel, **kwargs):
        print("Car.__init__")
        super().__init__(**kwargs)
        self.door = door
        self.wheel = wheel


class Flyable(Vehicle):
    def __init__(self, *, wing, **kwargs):
        print("Flyable.__init__")
        super().__init__(**kwargs)
        self.wing = wing


class FlyingCar(Flyable, Car):
    def __init__(self, *, door, wheel, wing):
        super().__init__(door=door, wheel=wheel, wing=wing)


fc = FlyingCar(door=2, wheel=4, wing=2)
print(vars(fc))
print([cls.__name__ for cls in FlyingCar.__mro__])
print(vars(Car(door=4, wheel=4)))
```

Output:

```text
Flyable.__init__
Car.__init__
Vehicle.__init__
{'registered': True, 'door': 2, 'wheel': 4, 'wing': 2}
['FlyingCar', 'Flyable', 'Car', 'Vehicle', 'object']
Car.__init__
Vehicle.__init__
{'registered': True, 'door': 4, 'wheel': 4}
```

Each `__init__` runs exactly once, in MRO order. `Flyable` takes `wing` and passes `door` and `wheel` along; `super()` inside `Flyable` leads to `Car` (the next class in `FlyingCar`'s MRO), which takes `door` and `wheel`; `Vehicle` receives nothing extra. The same `Car` class still works on its own, as the last line shows.

> **Note:** `FlyingCar.__init__` here only forwards its arguments, so it could be deleted entirely. It is kept to show the call explicitly.

## Mixins

The most common and least risky use of multiple inheritance is the **mixin**: a small class that adds one well-defined capability and is not meant to be instantiated on its own. A mixin usually has no `__init__` and no state of its own.

```python
import json


class ToDictMixin:
    """Adds to_dict(): public instance attributes as a dict."""

    def to_dict(self):
        return {k: v for k, v in vars(self).items() if not k.startswith("_")}


class JsonMixin:
    """Adds to_json(). Expects the class to also provide to_dict()."""

    def to_json(self):
        return json.dumps(self.to_dict())


class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age
        self._password_hash = "x9f3..."


class Employee(JsonMixin, ToDictMixin, Person):
    def __init__(self, name, age, salary):
        super().__init__(name, age)
        self.salary = salary


emp = Employee("Olena", 30, 5000)
print(emp.to_dict())
print(emp.to_json())
print([cls.__name__ for cls in Employee.__mro__])
```

Output:

```text
{'name': 'Olena', 'age': 30, 'salary': 5000}
{"name": "Olena", "age": 30, "salary": 5000}
['Employee', 'JsonMixin', 'ToDictMixin', 'Person', 'object']
```

Conventions that keep mixins manageable:

- Name them with a `Mixin` suffix so readers know they are not standalone classes.
- List mixins **first** and the main base class **last**, so mixin methods take priority and the "real" parent sits at the end of the MRO.
- Keep each mixin focused on one capability, and document anything it expects from the host class (like `JsonMixin` expecting `to_dict()`).

The standard library uses this pattern too, for example `socketserver.ThreadingMixIn`, which turns any socket server into one that handles each request in a separate thread.

## When to avoid multiple inheritance

- **Deep or wide hierarchies** quickly become hard to reason about: to know which method runs, you have to compute the MRO in your head.
- **Parents with state** (their own `__init__` and attributes) can clash: two parents that both use `self.name` for different things will overwrite each other.
- **"Has-a" relationships** are better modelled with composition. A `FlyingCar` that *has* an `Engine` and *has* `Wings` objects is often clearer than one that *is* both a `Car` and a `Plane`.

A good rule of thumb: use multiple inheritance for **mixins** and for implementing several small **interfaces** (abstract base classes), and prefer composition for everything else.

## Common mistakes

- **Thinking `super()` calls "the parent".** It calls the next class in the MRO of the actual object, which may be a sibling class you never mentioned.
- **Breaking the `super()` chain.** In a cooperative hierarchy, one method that does not call `super()` prevents all later classes from running.
- **Copying a parent's `__init__` logic** instead of calling it (as in the first `FlyingCar.__init__` above). Changes to the parent are then silently lost.
- **Mixing explicit `Parent.__init__(self)` calls and `super()` in the same diamond.** Some initialisers run twice, others not at all.
- **Passing positional arguments through a cooperative chain.** Positions get shifted from class to class; use keyword arguments.
- **Listing a class before its own subclass** (`class X(A, B)` where `B` inherits from `A`). Python raises `TypeError` because no consistent MRO exists.

## Summary

- `class C(A, B)` inherits from both `A` and `B`; instances are instances of both.
- The MRO (`C.__mro__`, `C.mro()`) is the ordered list of classes Python searches for attributes and methods.
- The MRO is computed with C3 linearization: children before parents, left-to-right order of bases, each class once, consistent with the parents' MROs.
- In a diamond, the shared base appears once, at the end; impossible orders raise `TypeError`.
- `super()` delegates to the next class in the MRO of the object's actual type, which enables cooperative methods.
- Cooperative `__init__` methods take their own arguments by keyword and pass `**kwargs` to `super().__init__()`.
- Mixins are small, stateless classes that add one capability; list them before the main base class.

## Practice

### Exercise 1: Predict the chain

Without running it, predict the three lines this program prints. Explain why `Left`'s `super()` gives different results in the first two lines.

```python
class Base:
    def who(self):
        return ["Base"]


class Left(Base):
    def who(self):
        return ["Left"] + super().who()


class Right(Base):
    def who(self):
        return ["Right"] + super().who()


class Bottom(Left, Right):
    def who(self):
        return ["Bottom"] + super().who()


print(Bottom().who())
print(Left().who())
print([cls.__name__ for cls in Bottom.__mro__])
```

### Exercise 2: A cooperative constructor

Create `Person` (takes `name`), `Employee(Person)` (adds `salary`) and `Student(Person)` (adds `school`). Then create `WorkingStudent(Employee, Student)` **without** its own `__init__`, so that `WorkingStudent(name="Taras", salary=800, school="KPI")` sets all three attributes and every `__init__` runs exactly once. `Student(name="Olena", school="KNU")` must still work on its own. What happens if you forget `school`?

### Exercise 3: Two mixins

Write `ReprMixin`, whose `__repr__` returns `ClassName(attr=value, ...)` built from the instance's attributes, and `EqualityMixin`, whose `__eq__` treats two objects as equal when they have the same type and the same attributes. Apply both to a `Point(x, y)` and a `Product(title, price)` class without writing `__repr__` or `__eq__` in them.

### Exercise 4: Fix the MRO

This class definition fails. Explain why, and fix it so that `App().log("started")` uses `FileLogger.log()`.

```python
class Logger:
    def log(self, message):
        print(f"[log] {message}")


class FileLogger(Logger):
    def log(self, message):
        print(f"[file] {message}")


class App(Logger, FileLogger):
    pass
```

## Solutions

### Exercise 1

Output:

```text
['Bottom', 'Left', 'Right', 'Base']
['Left', 'Base']
['Bottom', 'Left', 'Right', 'Base', 'object']
```

For a `Bottom` object the MRO is `Bottom, Left, Right, Base, object`, so `super()` inside `Left.who()` leads to `Right`. For a plain `Left` object the MRO is `Left, Base, object`, so the same `super()` leads straight to `Base`. `super()` follows the MRO of the actual object, not the class where the code is written.

### Exercise 2

```python
class Person:
    def __init__(self, *, name, **kwargs):
        super().__init__(**kwargs)
        self.name = name


class Employee(Person):
    def __init__(self, *, salary, **kwargs):
        super().__init__(**kwargs)
        self.salary = salary


class Student(Person):
    def __init__(self, *, school, **kwargs):
        super().__init__(**kwargs)
        self.school = school


class WorkingStudent(Employee, Student):
    pass


ws = WorkingStudent(name="Taras", salary=800, school="KPI")
print(vars(ws))
print([cls.__name__ for cls in WorkingStudent.__mro__])
print(vars(Student(name="Olena", school="KNU")))
try:
    WorkingStudent(name="Ivan", salary=900)
except TypeError as error:
    print(error)
```

Output:

```text
{'name': 'Taras', 'school': 'KPI', 'salary': 800}
['WorkingStudent', 'Employee', 'Student', 'Person', 'object']
{'name': 'Olena', 'school': 'KNU'}
Student.__init__() missing 1 required keyword-only argument: 'school'
```

`Employee` takes `salary` and passes the rest on, `Student` takes `school`, and `Person` takes `name` and calls `object.__init__()` with nothing left. Keyword-only parameters (after `*`) make a forgotten argument fail loudly, with a message that names exactly which class needed it.

### Exercise 3

```python
class ReprMixin:
    def __repr__(self):
        fields = ", ".join(f"{key}={value!r}" for key, value in vars(self).items())
        return f"{type(self).__name__}({fields})"


class EqualityMixin:
    def __eq__(self, other):
        if type(other) is not type(self):
            return NotImplemented
        return vars(self) == vars(other)


class Point(ReprMixin, EqualityMixin):
    def __init__(self, x, y):
        self.x = x
        self.y = y


class Product(ReprMixin, EqualityMixin):
    def __init__(self, title, price):
        self.title = title
        self.price = price


print(Point(1, 2))
print(Point(1, 2) == Point(1, 2), Point(1, 2) == Point(2, 1))
print(Product("Pen", 9.5))
print(Product("Pen", 9.5) == Point(1, 2))
```

Output:

```text
Point(x=1, y=2)
True False
Product(title='Pen', price=9.5)
False
```

Returning `NotImplemented` for a different type lets Python try the other operand and finally fall back to identity, which gives `False`. Note that a class defining `__eq__` without `__hash__` gets `__hash__ = None`, so these objects are unhashable. That is the correct default for mutable objects.

### Exercise 4

`App(Logger, FileLogger)` asks for `Logger` before `FileLogger`, but `FileLogger` is a subclass of `Logger` and must come before it. No order satisfies both, so Python raises `TypeError`. Since `FileLogger` already includes everything `Logger` has, inherit from it alone:

```python
class Logger:
    def log(self, message):
        print(f"[log] {message}")


class FileLogger(Logger):
    def log(self, message):
        print(f"[file] {message}")


try:
    class App(Logger, FileLogger):
        pass
except TypeError as error:
    print(error)


class App(FileLogger):
    pass


App().log("started")
print([cls.__name__ for cls in App.__mro__])
```

Output:

```text
Cannot create a consistent method resolution order (MRO) for bases Logger, FileLogger
[file] started
['App', 'FileLogger', 'Logger', 'object']
```

`class App(FileLogger, Logger)` would also work, but listing `Logger` adds nothing.

---

*Source: [pythontutorial.net — Python Multiple Inheritance](https://www.pythontutorial.net/python-oop/python-multiple-inheritance/). Adapted and expanded for PyJourney.*
