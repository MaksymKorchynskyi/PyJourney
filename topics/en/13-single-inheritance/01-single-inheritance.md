# Single Inheritance

**Inheritance** lets a new class reuse the attributes and methods of an existing class and then add or change only what is different. With **single inheritance**, a class has exactly one direct parent. It is the most common form of inheritance and the foundation for overriding methods, `super()` and abstract classes.

## What you'll learn

- How to define a subclass that reuses code from a parent class
- The vocabulary: parent / base / superclass, child / derived / subclass, and the IS-A relationship
- How Python finds an attribute by walking up the class chain
- The difference between `type()`, `isinstance()` and `issubclass()`
- Why every class ultimately inherits from `object`
- When inheritance is the right tool and when composition fits better

## The problem: duplicated code

Here is a simple `Person` class:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hi, it's {self.name}"
```

Now you need an `Employee`. An employee also has a name and greets people in exactly the same way, but additionally has a job title. Written from scratch, it repeats half of `Person`:

```python
class Employee:
    def __init__(self, name, job_title):
        self.name = name
        self.job_title = job_title

    def greet(self):
        return f"Hi, it's {self.name}"
```

The two `greet()` methods are identical. If you later change the greeting, you must remember to change it in both places, and sooner or later they will drift apart. Inheritance removes this duplication.

## Defining a subclass

To inherit from a class, put the parent's name in parentheses after the new class name:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hi, it's {self.name}"


class Employee(Person):
    def __init__(self, name, job_title):
        self.name = name
        self.job_title = job_title


employee = Employee("John", "Python Developer")
print(employee.greet())
print(employee.job_title)
```

Output:

```text
Hi, it's John
Python Developer
```

`Employee` does not define `greet()`, yet `employee.greet()` works: the method is **inherited** from `Person`. `Employee` only adds what is new, the `job_title` attribute.

This is **single inheritance** because `Employee` has one direct parent, `Person`. Python also supports multiple inheritance (a class with several parents), which is covered in a later section.

> **Note:** `Employee.__init__` still repeats `self.name = name` from `Person.__init__`. The `super()` topic shows how to call the parent's `__init__` instead of copying it.

### A subclass can be empty

If a subclass adds nothing yet, it still gets everything from the parent, including `__init__`:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hi, it's {self.name}"


class Customer(Person):
    pass


customer = Customer("Olena")
print(customer.greet())
```

Output:

```text
Hi, it's Olena
```

### A subclass can add new methods

Methods defined in the child exist only in the child. The parent knows nothing about its subclasses:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hi, it's {self.name}"


class Employee(Person):
    def __init__(self, name, job_title):
        self.name = name
        self.job_title = job_title

    def describe(self):
        return f"{self.name} works as a {self.job_title}"


print(Employee("John", "tester").describe())

person = Person("Jane")
print(hasattr(person, "describe"))
```

Output:

```text
John works as a tester
False
```

## How Python finds an inherited attribute

When you write `employee.greet`, Python searches in a fixed order and stops at the first match:

1. the instance itself (its `__dict__`);
2. the instance's class, `Employee`;
3. the parent class, `Person`;
4. the parent's parent, and so on, up to `object`.

```text
employee.greet
    |
    v
instance __dict__  -> {'name': 'John', 'job_title': '...'}   no 'greet'
    |
    v
Employee           -> __init__                                no 'greet'
    |
    v
Person             -> __init__, greet                         found
```

You can inspect this chain yourself. `__bases__` holds the direct parents, and `__mro__` (method resolution order) holds the full search order:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hi, it's {self.name}"


class Employee(Person):
    def __init__(self, name, job_title):
        self.name = name
        self.job_title = job_title


print(Employee.__bases__)
print(Employee.__mro__)
print("greet" in Employee.__dict__)
print("greet" in Person.__dict__)
print(Employee.greet is Person.greet)
```

Output:

```text
(<class '__main__.Person'>,)
(<class '__main__.Employee'>, <class '__main__.Person'>, <class 'object'>)
False
True
True
```

The method is **not copied** into the child. `Employee.greet` is literally the same function object as `Person.greet`; Python just finds it one level higher. A useful consequence: the lookup happens every time, so a change to the parent is visible in all children immediately.

```python
class Person:
    species = "human"


class Employee(Person):
    pass


print(Employee.species)
Person.species = "Homo sapiens"
print(Employee.species)
```

Output:

```text
human
Homo sapiens
```

## Inheritance terminology

Different books and languages use different words for the same thing. All of these are correct:

| `Person` is the ... | `Employee` is the ... |
|---|---|
| parent class | child class |
| base class | derived class |
| superclass | subclass |

You can also say that `Employee` **inherits from**, **derives from**, **extends** or **subclasses** `Person`.

The relationship is called **IS-A**: an employee *is a* person. This is the test for whether inheritance makes sense at all. If the sentence "a `Child` is a `Parent`" sounds wrong, inheritance is probably the wrong tool (see the section on composition below).

## `type()` vs `isinstance()`

`type(obj)` returns the exact class an object was created from:

```python
class Person:
    def __init__(self, name):
        self.name = name


class Employee(Person):
    def __init__(self, name, job_title):
        self.name = name
        self.job_title = job_title


person = Person("Jane")
print(type(person))

employee = Employee("John", "Python Developer")
print(type(employee))
```

Output:

```text
<class '__main__.Person'>
<class '__main__.Employee'>
```

`isinstance(obj, cls)` answers a different question: "can `obj` be used as a `cls`?" It returns `True` for instances of `cls` **and of all its subclasses**:

```python
class Person:
    def __init__(self, name):
        self.name = name


class Employee(Person):
    def __init__(self, name, job_title):
        self.name = name
        self.job_title = job_title


person = Person("Jane")
employee = Employee("John", "Python Developer")

print(isinstance(person, Person))
print(isinstance(employee, Person))
print(isinstance(employee, Employee))
print(isinstance(person, Employee))
```

Output:

```text
True
True
True
False
```

- `person` is an instance of `Person`.
- `employee` is an instance of `Employee` **and** of `Person`, because every employee is a person.
- `person` is **not** an `Employee`: a parent is not an instance of its child.

`type()` ignores inheritance completely, and this is a classic trap:

```python
class Person:
    pass


class Employee(Person):
    pass


employee = Employee()
print(type(employee) == Person)
print(type(employee) is Employee)
print(isinstance(employee, Person))
```

Output:

```text
False
True
True
```

So prefer `isinstance()` for type checks. It respects inheritance, which means subclasses can be used anywhere the parent is expected. Use `type(obj) is SomeClass` only when you really need the exact class.

`isinstance()` also accepts a tuple of classes and returns `True` if any of them matches:

```python
value = True
print(isinstance(value, (int, float)))
print(isinstance(value, int))
print(type(value))
```

Output:

```text
True
True
<class 'bool'>
```

`True` is an `int` because the built-in `bool` is a subclass of `int`. Inheritance is everywhere in Python, even among the built-in types.

## `issubclass()`

`issubclass(child, parent)` works on **classes**, not instances. It checks the whole chain, not only direct parents:

```python
class Person:
    pass


class Employee(Person):
    pass


class SalesEmployee(Employee):
    pass


print(issubclass(Employee, Person))
print(issubclass(SalesEmployee, Employee))
print(issubclass(SalesEmployee, Person))
print(issubclass(Person, Employee))
print(issubclass(Person, Person))
```

Output:

```text
True
True
True
False
True
```

Note the last line: every class counts as a subclass of itself.

`SalesEmployee` inherits from `Employee`, which inherits from `Person`. This is still single inheritance: each class has one direct parent, even though the chain has several levels.

```text
object
  ^
  |
Person
  ^
  |
Employee
  ^
  |
SalesEmployee
```

## Every class inherits from `object`

A class without an explicit parent implicitly inherits from the built-in `object`:

```python
class Person:
    def __init__(self, name):
        self.name = name


print(Person.__bases__)
print(issubclass(Person, object))
print(isinstance(42, object))
```

Output:

```text
(<class 'object'>,)
True
True
```

That is why even an "empty" class already has `__init__`, `__repr__`, `__eq__`, `__str__` and other special methods: they come from `object`. For example, printing a `Person` without a custom `__repr__` uses `object.__repr__`:

```python
class Person:
    def __init__(self, name):
        self.name = name


print(Person("Jane"))  # output varies, e.g. <__main__.Person object at 0x104735160>
```

> **Note:** In Python 2 you had to write `class Person(object):` to get a "new-style" class. In Python 3 all classes are new-style, so `class Person:` and `class Person(object):` are exactly the same. Modern code omits `(object)`.

## Inheritance vs composition

Inheritance is a strong coupling: the child gets *everything* from the parent, including methods that may not make sense for it. Use it when the IS-A test passes and the child really is a specialised version of the parent.

When an object merely **has** or **uses** another object (a HAS-A relationship), store that object as an attribute instead. This is called **composition**:

```python
class Address:
    def __init__(self, city):
        self.city = city


class Employee:
    def __init__(self, name, address):
        self.name = name
        self.address = address  # Employee HAS-A Address


employee = Employee("John", Address("Kyiv"))
print(employee.address.city)
```

Output:

```text
Kyiv
```

An employee is not an address, so `class Employee(Address)` would be wrong even though it would "reuse" the `city` attribute.

## Common mistakes

- **Checking types with `type(...) ==`.** `type(employee) == Person` is `False` even though every employee is a person. Use `isinstance(employee, Person)`.
- **Forgetting to set the parent's attributes in the child's `__init__`.** Defining `__init__` in a subclass *replaces* the parent's `__init__`; Python does not run both automatically. Inherited methods then fail:

  ```python
  class Person:
      def __init__(self, name):
          self.name = name

      def greet(self):
          return f"Hi, it's {self.name}"


  class Employee(Person):
      def __init__(self, job_title):
          self.job_title = job_title  # self.name is never set


  Employee("Developer").greet()
  ```

  Output:

  ```text
  Traceback (most recent call last):
    ...
  AttributeError: 'Employee' object has no attribute 'name'
  ```

  Set every attribute the parent's methods need, or better, call the parent's `__init__` with `super().__init__(...)`.

- **Passing an instance to `issubclass()`.** It expects classes: `issubclass(employee, Person)` raises `TypeError: issubclass() arg 1 must be a class`. For instances use `isinstance()`.
- **Inheriting just to reuse code.** If "a `Child` is a `Parent`" is false, prefer composition. Inheriting `Employee` from `Address` or a `Stack` from `list` exposes methods that do not belong to the new class.
- **Expecting the parent to know about child methods.** A method defined only in `Employee` does not exist on `Person` instances.

## Summary

- Inheritance lets a class reuse the attributes and methods of another class: `class Child(Parent):`.
- With single inheritance a class has exactly one direct parent, but the chain can have many levels.
- The parent is also called the base class or superclass; the child is the derived class or subclass. The relationship is IS-A.
- Python looks up attributes on the instance, then its class, then each parent up to `object`. `Cls.__mro__` shows that order.
- `type()` returns the exact class; `isinstance()` also accepts subclasses and is the preferred check.
- `issubclass()` compares classes and checks the whole chain; a class is a subclass of itself.
- Every class implicitly inherits from `object`.
- Use inheritance for IS-A relationships and composition for HAS-A relationships.

## Practice

### Exercise 1: Predict the checks

Without running the code, write down what each line prints. Then run it and compare.

```python
class Animal:
    pass


class Dog(Animal):
    pass


class Puppy(Dog):
    pass


rex = Dog()
print(isinstance(rex, Animal))
print(isinstance(rex, Puppy))
print(type(rex) is Animal)
print(issubclass(Puppy, Animal))
print(issubclass(Animal, Dog))
print(issubclass(Puppy, object))
```

### Exercise 2: Vehicles

Create a class `Vehicle` with an attribute `brand` and a method `describe()` that returns `"Vehicle: <brand>"`. Create a subclass `Truck` whose `__init__` takes `brand` and `capacity` (in tons) and that adds a method `load_info()` returning `"<brand> can carry <capacity> t"`. Create a truck and call both methods on it.

### Exercise 3: Show the chain

Write a function `chain(cls)` that returns the names of a class and all its ancestors joined with `" -> "`, for example `"SalesEmployee -> Employee -> Person -> object"`. Use `__bases__` (assume single inheritance) and a loop, not `__mro__`.

### Exercise 4: Fix the bug

The code below crashes. Find out why, and fix `Manager.__init__` without changing `Person`.

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hi, it's {self.name}"


class Manager(Person):
    def __init__(self, name, team_size):
        self.team_size = team_size


boss = Manager("Iryna", 5)
print(boss.greet())
```

## Solutions

### Exercise 1

Output:

```text
True
False
False
True
False
True
```

- `rex` is a `Dog`, and every dog is an `Animal`, so the first check is `True`.
- `rex` was created from `Dog`, not `Puppy`. A parent instance is not an instance of a child class.
- `type(rex)` is exactly `Dog`, so comparing it with `Animal` gives `False`.
- `Puppy -> Dog -> Animal`, so `Puppy` is a subclass of `Animal`, but not the other way round.
- Every class is a subclass of `object`.

### Exercise 2

```python
class Vehicle:
    def __init__(self, brand):
        self.brand = brand

    def describe(self):
        return f"Vehicle: {self.brand}"


class Truck(Vehicle):
    def __init__(self, brand, capacity):
        self.brand = brand
        self.capacity = capacity

    def load_info(self):
        return f"{self.brand} can carry {self.capacity} t"


truck = Truck("Volvo", 20)
print(truck.describe())
print(truck.load_info())
print(isinstance(truck, Vehicle))
```

Output:

```text
Vehicle: Volvo
Volvo can carry 20 t
True
```

### Exercise 3

```python
class Person:
    pass


class Employee(Person):
    pass


class SalesEmployee(Employee):
    pass


def chain(cls):
    names = []
    while True:
        names.append(cls.__name__)
        if not cls.__bases__:  # only object has no parents
            break
        cls = cls.__bases__[0]
    return " -> ".join(names)


print(chain(SalesEmployee))
print(chain(Person))
print(chain(object))
```

Output:

```text
SalesEmployee -> Employee -> Person -> object
Person -> object
object
```

`object.__bases__` is an empty tuple, which is how the loop knows it reached the top.

### Exercise 4

`Manager.__init__` replaces `Person.__init__`, so `self.name` is never set and `greet()` raises `AttributeError: 'Manager' object has no attribute 'name'`. Set the attribute in the child (or, as the `super()` topic shows, call the parent's `__init__`):

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hi, it's {self.name}"


class Manager(Person):
    def __init__(self, name, team_size):
        self.name = name
        self.team_size = team_size


boss = Manager("Iryna", 5)
print(boss.greet())
print(boss.team_size)
```

Output:

```text
Hi, it's Iryna
5
```

---

*Source: [pythontutorial.net — Python Inheritance](https://www.pythontutorial.net/python-oop/python-inheritance/). Adapted and expanded for PyJourney.*
