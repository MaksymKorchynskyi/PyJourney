# Abstract Classes

An **abstract class** is a class that exists only to be inherited from: you cannot create objects from it directly. It acts as a blueprint that says "every subclass must provide these methods", and Python enforces that rule when a subclass is instantiated. Abstract classes are how you design a family of related classes that share code and an interface.

## What you'll learn

- What abstract classes and abstract methods are and why they are useful
- How to define them with the `abc` module: `ABC` and `@abstractmethod`
- What Python does when you instantiate an abstract class or an incomplete subclass
- How to build a small payroll program on top of an abstract base class
- Abstract methods with a default implementation, abstract properties, and how to inspect abstractness
- When an abstract class is the right tool and what the alternatives are

## The idea: a blueprint with mandatory parts

Imagine a payroll program for a company with two kinds of employees:

- **full-time** employees get a fixed monthly salary;
- **hourly** employees are paid for the hours they worked.

Both kinds have a first name, a last name and a full name, and both must be able to report their salary. But there is no such thing as a "generic" employee whose salary could be calculated: the calculation depends on the kind. So:

- the shared parts (names, `full_name`) belong in a common base class `Employee`;
- `get_salary()` must exist in every employee, but `Employee` itself cannot implement it;
- creating a plain `Employee` object makes no sense and should be forbidden.

That is exactly what an abstract class with an **abstract method** (a method declared without a usable implementation, which subclasses must override) expresses.

## Defining an abstract class

Abstract classes are not a keyword in Python. They are provided by the standard library module `abc` ("abstract base classes"):

- inherit from `abc.ABC` to make a class abstract-capable;
- mark methods that subclasses must implement with the `@abstractmethod` decorator.

```python
from abc import ABC, abstractmethod


class Employee(ABC):
    def __init__(self, first_name, last_name):
        self.first_name = first_name
        self.last_name = last_name

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @abstractmethod
    def get_salary(self):
        pass


employee = Employee("John", "Doe")
```

Output:

```text
Traceback (most recent call last):
  ...
TypeError: Can't instantiate abstract class Employee without an implementation for abstract method 'get_salary'
```

`Employee` mixes concrete parts (`__init__`, the `full_name` property) with one abstract method. As long as at least one abstract method is not implemented, the class cannot be instantiated.

> **Note:** The error text changed in Python 3.12. Older versions say `Can't instantiate abstract class Employee with abstract method get_salary`.

The body of an abstract method is usually just `pass`, `...` or a docstring. It is never executed through normal calls, because no object of the abstract class can exist.

## Implementing the subclasses

A subclass becomes **concrete** (instantiable) once it overrides every abstract method:

```python
from abc import ABC, abstractmethod


class Employee(ABC):
    def __init__(self, first_name, last_name):
        self.first_name = first_name
        self.last_name = last_name

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @abstractmethod
    def get_salary(self):
        pass


class FulltimeEmployee(Employee):
    def __init__(self, first_name, last_name, salary):
        super().__init__(first_name, last_name)
        self.salary = salary

    def get_salary(self):
        return self.salary


class HourlyEmployee(Employee):
    def __init__(self, first_name, last_name, worked_hours, rate):
        super().__init__(first_name, last_name)
        self.worked_hours = worked_hours
        self.rate = rate

    def get_salary(self):
        return self.worked_hours * self.rate


john = FulltimeEmployee("John", "Doe", 6000)
jenifer = HourlyEmployee("Jenifer", "Smith", 200, 50)
print(john.full_name, john.get_salary())
print(jenifer.full_name, jenifer.get_salary())
print(isinstance(jenifer, Employee))
```

Output:

```text
John Doe 6000
Jenifer Smith 10000
True
```

- `FulltimeEmployee` stores a fixed salary and returns it.
- `HourlyEmployee` stores the hours and the hourly rate and multiplies them.
- Both reuse `__init__` and `full_name` from `Employee` via inheritance and `super()`.

### A subclass that forgets a method

If a subclass does not implement all abstract methods, it is still abstract, and the error appears **when you try to create an object**, not when the class is defined:

```python
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self):
        ...

    @abstractmethod
    def perimeter(self):
        ...


class Square(Shape):
    def __init__(self, side):
        self.side = side

    def area(self):
        return self.side**2


print("class Square defined fine")
Square(3)
```

Output:

```text
class Square defined fine
Traceback (most recent call last):
  ...
TypeError: Can't instantiate abstract class Square without an implementation for abstract method 'perimeter'
```

This is the main benefit of abstract classes: forgetting a required method is caught as soon as someone tries to use the incomplete class, with a message that names the missing method. Without `@abstractmethod`, the mistake would surface much later as an `AttributeError` deep inside some other code.

## The payroll program

The `Payroll` class collects employees and prints a report. It relies only on the **interface** defined by `Employee` (the `full_name` property and the `get_salary()` method), so it does not need to know which kind of employee it is dealing with:

```python
from abc import ABC, abstractmethod


class Employee(ABC):
    def __init__(self, first_name, last_name):
        self.first_name = first_name
        self.last_name = last_name

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @abstractmethod
    def get_salary(self):
        pass


class FulltimeEmployee(Employee):
    def __init__(self, first_name, last_name, salary):
        super().__init__(first_name, last_name)
        self.salary = salary

    def get_salary(self):
        return self.salary


class HourlyEmployee(Employee):
    def __init__(self, first_name, last_name, worked_hours, rate):
        super().__init__(first_name, last_name)
        self.worked_hours = worked_hours
        self.rate = rate

    def get_salary(self):
        return self.worked_hours * self.rate


class Payroll:
    def __init__(self):
        self.employee_list = []

    def add(self, employee):
        self.employee_list.append(employee)

    def print_report(self):
        for e in self.employee_list:
            print(f"{e.full_name:<16} ${e.get_salary()}")


if __name__ == "__main__":
    payroll = Payroll()

    payroll.add(FulltimeEmployee("John", "Doe", 6000))
    payroll.add(FulltimeEmployee("Jane", "Doe", 6500))
    payroll.add(HourlyEmployee("Jenifer", "Smith", 200, 50))
    payroll.add(HourlyEmployee("David", "Wilson", 150, 100))
    payroll.add(HourlyEmployee("Kevin", "Miller", 100, 150))

    payroll.print_report()
```

Output:

```text
John Doe         $6000
Jane Doe         $6500
Jenifer Smith    $10000
David Wilson     $15000
Kevin Miller     $15000
```

`{e.full_name:<16}` left-aligns the name in a 16-character column so the salaries line up.

If the company later introduces commissioned employees, you add one more subclass of `Employee` with its own `get_salary()`. `Payroll` stays unchanged, and the abstract method guarantees that the new class cannot "forget" to calculate a salary.

In a real project each class would usually live in its own module and be imported:

```text
payroll_app/
    employee.py           # Employee (abstract)
    fulltimeemployee.py   # FulltimeEmployee
    hourlyemployee.py     # HourlyEmployee
    payroll.py            # Payroll
    app.py                # creates employees and prints the report
```

## More features of abstract classes

### Abstract methods can have an implementation

`@abstractmethod` forces subclasses to override a method, but the abstract method itself may contain useful code. Subclasses can call it through `super()`:

```python
from abc import ABC, abstractmethod


class Report(ABC):
    @abstractmethod
    def render(self):
        return "=== REPORT ==="


class SalesReport(Report):
    def render(self):
        header = super().render()
        return f"{header}\nsales: 42"


print(SalesReport().render())
```

Output:

```text
=== REPORT ===
sales: 42
```

### Abstract properties

To require a property, stack `@property` on top of `@abstractmethod` (in this order: `@abstractmethod` must be the innermost decorator):

```python
from abc import ABC, abstractmethod


class Animal(ABC):
    @property
    @abstractmethod
    def sound(self):
        ...

    def speak(self):
        return f"{type(self).__name__} says {self.sound}"


class Dog(Animal):
    @property
    def sound(self):
        return "woof"


class Fish(Animal):
    pass


print(Dog().speak())
Fish()
```

Output:

```text
Dog says woof
Traceback (most recent call last):
  ...
TypeError: Can't instantiate abstract class Fish without an implementation for abstract method 'sound'
```

The same stacking works with `@classmethod` and `@staticmethod`: put `@abstractmethod` directly above the `def`.

### Inspecting abstractness

Python records the names of unimplemented abstract methods in the `__abstractmethods__` attribute of the class, and `inspect.isabstract()` tells you whether a class can be instantiated:

```python
import inspect
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self):
        ...

    @abstractmethod
    def perimeter(self):
        ...


class Square(Shape):
    def area(self):
        return 9


print(sorted(Shape.__abstractmethods__))
print(sorted(Square.__abstractmethods__))
print(inspect.isabstract(Shape), inspect.isabstract(Square))
print(type(Shape))
```

Output:

```text
['area', 'perimeter']
['perimeter']
True True
<class 'abc.ABCMeta'>
```

The last line shows how this works under the hood: `ABC` is just a convenience class whose metaclass is `abc.ABCMeta`. Writing `class Shape(metaclass=ABCMeta):` is equivalent to `class Shape(ABC):`. It is `ABCMeta` that collects the abstract methods and blocks instantiation.

## When to use abstract classes

Use an abstract base class when:

- several **closely related** classes share code (like `full_name` and `__init__` in the payroll example) **and** a common interface;
- you want Python to enforce that every subclass implements certain methods;
- other code (like `Payroll`) should work with "any employee" without caring about the concrete type.

Alternatives exist. Python also supports **duck typing**: any object with a `get_salary()` method would work in `Payroll` even without a common base class. For type checkers, `typing.Protocol` describes an interface without inheritance. And the standard library ships many ready-made abstract base classes in `collections.abc` (`Iterable`, `Mapping`, `Sequence`, ...) that you can inherit from to get the required methods checked and some methods implemented for free.

## Common mistakes

- **Forgetting to inherit from `ABC`.** `@abstractmethod` is only enforced by the `ABCMeta` metaclass. In a plain class it does nothing:

  ```python
  from abc import abstractmethod


  class Employee:  # no ABC!
      @abstractmethod
      def get_salary(self):
          pass


  employee = Employee()
  print(employee.get_salary())
  ```

  Output:

  ```text
  None
  ```

- **Thinking that inheriting from `ABC` is enough.** A class that inherits from `ABC` but has no abstract methods can be instantiated normally. Abstractness comes from the abstract methods.
- **Misspelling the overriding method.** `def get_salery(self)` in a subclass leaves `get_salary` abstract, and creating the object raises `TypeError`. The good news: the error message names the missing method.
- **Wrong decorator order for abstract properties.** Write `@property` first and `@abstractmethod` second (closest to `def`). The other order raises `AttributeError` when the class is defined.
- **Using an abstract class where a simple function would do.** If there is only one implementation and no shared code, a base class adds ceremony without benefit.

## Summary

- An abstract class cannot be instantiated; it serves as a blueprint for subclasses.
- Define it by inheriting from `abc.ABC` and marking required methods with `@abstractmethod`.
- A subclass becomes concrete only when it overrides every abstract method; otherwise instantiating it raises `TypeError` that names the missing methods.
- Abstract classes can contain normal methods, properties and `__init__`, which subclasses reuse.
- Abstract methods may have a body that subclasses call through `super()`; abstract properties use `@property` above `@abstractmethod`.
- `@abstractmethod` only works in classes whose metaclass is `ABCMeta` (that is, subclasses of `ABC`).
- Use abstract classes for families of closely related classes that share code and an interface.

## Practice

### Exercise 1: Shapes with a contract

Create an abstract class `Shape` with abstract methods `area()` and `perimeter()` and a concrete method `describe()` that returns `"<ClassName>: area=<area>, perimeter=<perimeter>"`. Implement `Rectangle(width, height)` and `Circle(radius)`; round the circle's values to 2 decimal places. Print `describe()` for `Rectangle(3, 4)` and `Circle(1)`, then show that `Shape()` cannot be created (catch the `TypeError` and print it).

### Exercise 2: Notifications

Create an abstract class `Notifier` with:

- an abstract method `send(message)`;
- a concrete method `notify_all(messages)` that calls `self.send()` for each message and returns how many were sent.

Implement `EmailNotifier(address)`, whose `send()` prints `"Email to <address>: <message>"`, and `SmsNotifier(phone)`, whose `send()` prints `"SMS to <phone>: <message>"`. Call `notify_all()` on both with two messages and print the returned counts.

### Exercise 3: Abstract property

Create an abstract class `Account` with an abstract property `fee_percent` and a concrete method `fee(amount)` that returns `amount * fee_percent / 100`. Implement `BasicAccount` (fee 2%) and `PremiumAccount` (fee 0.5%). Print the fee for `1000` on both accounts. Then define `class BrokenAccount(Account): pass` and show which error you get when creating it.

## Solutions

### Exercise 1

```python
import math
from abc import ABC, abstractmethod


class Shape(ABC):
    @abstractmethod
    def area(self):
        ...

    @abstractmethod
    def perimeter(self):
        ...

    def describe(self):
        return f"{type(self).__name__}: area={self.area()}, perimeter={self.perimeter()}"


class Rectangle(Shape):
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def area(self):
        return self.width * self.height

    def perimeter(self):
        return 2 * (self.width + self.height)


class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return round(math.pi * self.radius**2, 2)

    def perimeter(self):
        return round(2 * math.pi * self.radius, 2)


print(Rectangle(3, 4).describe())
print(Circle(1).describe())

try:
    Shape()
except TypeError as error:
    print(error)
```

Output:

```text
Rectangle: area=12, perimeter=14
Circle: area=3.14, perimeter=6.28
Can't instantiate abstract class Shape without an implementation for abstract methods 'area', 'perimeter'
```

### Exercise 2

```python
from abc import ABC, abstractmethod


class Notifier(ABC):
    @abstractmethod
    def send(self, message):
        ...

    def notify_all(self, messages):
        for message in messages:
            self.send(message)
        return len(messages)


class EmailNotifier(Notifier):
    def __init__(self, address):
        self.address = address

    def send(self, message):
        print(f"Email to {self.address}: {message}")


class SmsNotifier(Notifier):
    def __init__(self, phone):
        self.phone = phone

    def send(self, message):
        print(f"SMS to {self.phone}: {message}")


messages = ["Build passed", "Deploy started"]
for notifier in [EmailNotifier("dev@example.com"), SmsNotifier("+380501234567")]:
    sent = notifier.notify_all(messages)
    print("sent:", sent)
```

Output:

```text
Email to dev@example.com: Build passed
Email to dev@example.com: Deploy started
sent: 2
SMS to +380501234567: Build passed
SMS to +380501234567: Deploy started
sent: 2
```

`notify_all()` is written once in the abstract class and works for every notifier, because each subclass is guaranteed to have `send()`.

### Exercise 3

```python
from abc import ABC, abstractmethod


class Account(ABC):
    @property
    @abstractmethod
    def fee_percent(self):
        ...

    def fee(self, amount):
        return amount * self.fee_percent / 100


class BasicAccount(Account):
    @property
    def fee_percent(self):
        return 2


class PremiumAccount(Account):
    @property
    def fee_percent(self):
        return 0.5


class BrokenAccount(Account):
    pass


print(BasicAccount().fee(1000))
print(PremiumAccount().fee(1000))

try:
    BrokenAccount()
except TypeError as error:
    print(error)
```

Output:

```text
20.0
5.0
Can't instantiate abstract class BrokenAccount without an implementation for abstract method 'fee_percent'
```

---

*Source: [pythontutorial.net — Python Abstract Classes](https://www.pythontutorial.net/python-oop/python-abstract-class/). Adapted and expanded for PyJourney.*
