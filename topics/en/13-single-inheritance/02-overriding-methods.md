# Overriding Methods

A subclass inherits every method of its parent, but an inherited method does not always fit. **Method overriding** means defining a method in the child class with the same name as a method in the parent, so that the child's version is used instead. It is how subclasses specialise behaviour while keeping the same interface.

## What you'll learn

- How to override a parent method in a subclass
- How Python decides which version of a method to run
- Why a parent method that calls `self.something()` automatically uses the child's override
- How to override class attributes instead of whole methods
- How to keep overrides compatible with the parent and mark them with `@typing.override` (Python 3.12+)
- Pitfalls: typos, changed signatures and name-mangled `__private` methods

## The problem: an inherited method that does not fit

Start with an `Employee` whose pay is simply the base pay:

```python
class Employee:
    def __init__(self, name, base_pay):
        self.name = name
        self.base_pay = base_pay

    def get_pay(self):
        return self.base_pay


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, sales_incentive):
        self.name = name
        self.base_pay = base_pay
        self.sales_incentive = sales_incentive


john = SalesEmployee("John", 5000, 1500)
print(john.get_pay())
```

Output:

```text
5000
```

`SalesEmployee` has no `get_pay()` of its own, so Python runs the inherited `Employee.get_pay()`, which ignores the sales incentive. The result is wrong for a sales employee.

## Overriding a method

To fix it, define `get_pay()` again in the subclass:

```python
class Employee:
    def __init__(self, name, base_pay):
        self.name = name
        self.base_pay = base_pay

    def get_pay(self):
        return self.base_pay


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, sales_incentive):
        self.name = name
        self.base_pay = base_pay
        self.sales_incentive = sales_incentive

    def get_pay(self):
        return self.base_pay + self.sales_incentive


if __name__ == "__main__":
    john = SalesEmployee("John", 5000, 1500)
    print(john.get_pay())

    jane = Employee("Jane", 5000)
    print(jane.get_pay())
```

Output:

```text
6500
5000
```

`SalesEmployee.get_pay()` **overrides** `Employee.get_pay()`. Each object runs the version that belongs to its own class:

- `john` is a `SalesEmployee`, so `john.get_pay()` runs `SalesEmployee.get_pay()`.
- `jane` is a plain `Employee`, so `jane.get_pay()` runs `Employee.get_pay()`. The parent class is not affected by the override at all.

> **Note:** `__init__` is a method too, and `SalesEmployee.__init__` already overrides `Employee.__init__` in this example. Overriding works the same way for every method, including special ("dunder") methods.

## How Python chooses the method

An override is not a special feature. It is a direct result of how attribute lookup works: Python searches the object's class first, then its parents, and takes the **first** match.

```text
john.get_pay()                      jane.get_pay()
    |                                   |
    v                                   v
SalesEmployee: get_pay  <- found    Employee: get_pay  <- found
    |
Employee: get_pay   (never reached)
```

The search always starts at `type(obj)`, the class the object was created from, no matter where the call is written. This is the key to the next section.

## Overriding and polymorphism

Because every employee has a `get_pay()` method, code that works with employees does not need to know which kind it got:

```python
class Employee:
    def __init__(self, name, base_pay):
        self.name = name
        self.base_pay = base_pay

    def get_pay(self):
        return self.base_pay


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, sales_incentive):
        self.name = name
        self.base_pay = base_pay
        self.sales_incentive = sales_incentive

    def get_pay(self):
        return self.base_pay + self.sales_incentive


def total_payroll(employees):
    return sum(employee.get_pay() for employee in employees)


staff = [
    Employee("Jane", 5000),
    SalesEmployee("John", 5000, 1500),
    Employee("Ostap", 4200),
]
print(total_payroll(staff))
```

Output:

```text
15700
```

`total_payroll()` calls the same method name on every object, and each object answers in its own way. This is called **polymorphism**. Adding a new employee type later (say, `Contractor` with its own `get_pay()`) does not require any change in `total_payroll()`.

## A parent method can call the child's override

Overriding becomes really powerful when a method of the **parent** calls another method through `self`. Here is a `Parser` that extracts an email and a phone number from text:

```python
import re


class Parser:
    def __init__(self, text):
        self.text = text

    def email(self):
        match = re.search(r"[a-z0-9.+_-]+@[a-z0-9.+_-]+\.[a-z]+", self.text)
        if match:
            return match.group(0)
        return None

    def phone(self):
        match = re.search(r"\d{3}-\d{3}-\d{4}", self.text)
        if match:
            return match.group(0)
        return None

    def parse(self):
        return {
            "email": self.email(),
            "phone": self.phone(),
        }


s = "Contact us via 408-205-5663 or email@test.com"
parser = Parser(s)
print(parser.parse())
```

Output:

```text
{'email': 'email@test.com', 'phone': '408-205-5663'}
```

- `email()` finds an email address.
- `phone()` finds a phone number in the format `nnn-nnn-nnnn`, where `n` is a digit, for example `408-205-5663`.
- `parse()` calls both and returns a dictionary.

Now you need to support international numbers in the format `+c-nnn-nnn-nnnn`, such as `+1-650-453-3456`, where `c` is a country code of 1 to 3 digits. The email logic and `parse()` stay the same, so you create a subclass and override only `phone()`:

```python
import re


class Parser:
    def __init__(self, text):
        self.text = text

    def email(self):
        match = re.search(r"[a-z0-9.+_-]+@[a-z0-9.+_-]+\.[a-z]+", self.text)
        if match:
            return match.group(0)
        return None

    def phone(self):
        match = re.search(r"\d{3}-\d{3}-\d{4}", self.text)
        if match:
            return match.group(0)
        return None

    def parse(self):
        return {
            "email": self.email(),
            "phone": self.phone(),
        }


class IntlParser(Parser):
    def phone(self):
        match = re.search(r"\+\d{1,3}-\d{3}-\d{3}-\d{4}", self.text)
        if match:
            return match.group(0)
        return None


if __name__ == "__main__":
    s2 = "Contact me via +1-650-453-3456 or email@test.co.uk"

    print(Parser(s2).parse())
    print(IntlParser(s2).parse())
```

Output:

```text
{'email': 'email@test.co.uk', 'phone': '650-453-3456'}
{'email': 'email@test.co.uk', 'phone': '+1-650-453-3456'}
```

`IntlParser` does not define `parse()`, so `IntlParser(s2).parse()` runs the **parent's** `parse()`. Inside it, `self` is the `IntlParser` object, and `self.phone()` starts its lookup at `type(self)`, which is `IntlParser`. So the parent's code ends up calling the child's `phone()`.

Notice also what the base `Parser` does with the international text: it finds only `650-453-3456` and silently drops the `+1-` prefix. The override exists precisely to fix this.

```text
IntlParser(s2).parse()
        |
        v
Parser.parse(self)          self is an IntlParser
   |-- self.email()  ->  Parser.email       (not overridden)
   '-- self.phone()  ->  IntlParser.phone   (override wins)
```

This pattern (a parent method that defines the overall algorithm and calls "hook" methods that subclasses override) is known as the **Template Method** pattern.

## Overriding attributes

Sometimes the only thing that differs between the parent and child is a piece of data, not logic. Here, only the regular expression changes. Instead of overriding the whole `phone()` method, move the pattern into a **class attribute** and override just that:

```python
import re


class Parser:
    phone_pattern = r"\d{3}-\d{3}-\d{4}"

    def __init__(self, text):
        self.text = text

    def email(self):
        match = re.search(r"[a-z0-9.+_-]+@[a-z0-9.+_-]+\.[a-z]+", self.text)
        if match:
            return match.group(0)
        return None

    def phone(self):
        match = re.search(self.phone_pattern, self.text)
        if match:
            return match.group(0)
        return None

    def parse(self):
        return {
            "email": self.email(),
            "phone": self.phone(),
        }


class IntlParser(Parser):
    phone_pattern = r"\+\d{1,3}-\d{3}-\d{3}-\d{4}"


if __name__ == "__main__":
    s = "Contact us via 408-205-5663 or email@test.com"
    print(Parser(s).parse())

    s2 = "Contact me via +1-650-453-3456 or email@test.co.uk"
    print(IntlParser(s2).parse())
```

Output:

```text
{'email': 'email@test.com', 'phone': '408-205-5663'}
{'email': 'email@test.co.uk', 'phone': '+1-650-453-3456'}
```

`phone()` reads `self.phone_pattern`. Attribute lookup follows the same rules as method lookup (instance, then class, then parents), so for an `IntlParser` object it finds `IntlParser.phone_pattern` first. The subclass is now a single line, and there is no duplicated method body.

> **Tip:** Write `self.phone_pattern`, not `Parser.phone_pattern`, inside the parent's methods. Hard-coding the class name bypasses the lookup and makes the attribute impossible to override.

## Overriding methods inherited from `object`

Every class inherits methods such as `__str__`, `__repr__` and `__eq__` from `object`. Overriding them is how you customise printing, comparison and other built-in behaviour:

```python
class Employee:
    def __init__(self, name, base_pay):
        self.name = name
        self.base_pay = base_pay

    def __str__(self):
        return f"{self.name} ({self.base_pay})"


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, sales_incentive):
        self.name = name
        self.base_pay = base_pay
        self.sales_incentive = sales_incentive

    def __str__(self):
        return f"{self.name} ({self.base_pay} + {self.sales_incentive})"


print(Employee("Jane", 5000))
print(SalesEmployee("John", 5000, 1500))
```

Output:

```text
Jane (5000)
John (5000 + 1500)
```

## Replacing vs extending

An override **replaces** the parent's method completely. The parent's version does not run unless you call it explicitly. In the examples above `SalesEmployee.get_pay()` recomputes `self.base_pay` itself, which duplicates the parent's logic.

Often you want to **extend** the parent's behaviour instead: run the parent's version and add something to its result. Python lets you call the parent method through `super()`:

```python
class Employee:
    def __init__(self, name, base_pay):
        self.name = name
        self.base_pay = base_pay

    def get_pay(self):
        return self.base_pay


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, sales_incentive):
        self.name = name
        self.base_pay = base_pay
        self.sales_incentive = sales_incentive

    def get_pay(self):
        return super().get_pay() + self.sales_incentive


print(SalesEmployee("John", 5000, 1500).get_pay())
```

Output:

```text
6500
```

The next topic covers `super()` in detail.

## Keeping overrides compatible

Code like `total_payroll()` relies on every employee having a `get_pay()` that can be called **the same way**. If an override changes the signature, that code breaks:

```python
class Employee:
    def __init__(self, base_pay):
        self.base_pay = base_pay

    def get_pay(self):
        return self.base_pay


class Contractor(Employee):
    def get_pay(self, hours):  # different signature
        return hours * 50


for worker in [Employee(5000), Contractor(0)]:
    print(worker.get_pay())
```

Output:

```text
5000
Traceback (most recent call last):
  ...
TypeError: Contractor.get_pay() missing 1 required positional argument: 'hours'
```

An object of a subclass should work everywhere an object of the parent works. (This rule is known as the Liskov Substitution Principle, covered in the SOLID section.) Keep the same parameters in overrides. If the child needs extra data, pass it to `__init__` and store it as an attribute, or add an *optional* parameter with a default value.

### Marking overrides with `@override` (Python 3.12+)

A typo in an overriding method's name does not cause any error: Python simply creates a new, unrelated method, and the parent's version keeps running. Since Python 3.12 you can document your intent with `typing.override`:

```python
from typing import override


class Employee:
    def get_pay(self) -> int:
        return 5000


class SalesEmployee(Employee):
    @override
    def get_pay(self) -> int:
        return 6500


print(SalesEmployee().get_pay())
print(SalesEmployee.get_pay.__override__)
```

Output:

```text
6500
True
```

At runtime the decorator only sets the `__override__` attribute and changes nothing else. The check is done by a static type checker (mypy, pyright): if a method marked with `@override` has no matching method in a parent, it reports an error. For example, with the typo `get_payy` mypy prints:

```text
error: Method "get_payy" is marked as an override, but no base method was found with this name  [misc]
```

For Python 3.11 and older, the same decorator is available as `typing_extensions.override`.

## Common mistakes

- **A typo in the method name.** `def get_payy(self)` does not override anything. The parent's `get_pay()` still runs and no error is raised. Use `@override` and a type checker to catch this.
- **Changing the signature of the override.** Callers that use the parent's interface will fail with `TypeError`. Keep the parameters compatible.
- **Hard-coding the class name in the parent.** `re.search(Parser.phone_pattern, ...)` ignores the subclass's attribute. Use `self.phone_pattern` (or `type(self).phone_pattern`).
- **Changing the parent's attribute instead of overriding it.** Writing `Parser.phone_pattern = ...` somewhere in the code changes the pattern for *every* parser, including all subclasses that do not override it. Define the new value in the subclass body instead.
- **Trying to override a `__private` method.** Names that start with two underscores are mangled per class, so the child's `__phone` and the parent's `__phone` are two different attributes:

  ```python
  class Parser:
      def parse(self):
          return self.__phone()  # becomes self._Parser__phone()

      def __phone(self):
          return "base phone"


  class IntlParser(Parser):
      def __phone(self):  # becomes _IntlParser__phone, a different name
          return "international phone"


  print(IntlParser().parse())
  ```

  Output:

  ```text
  base phone
  ```

  Use a single underscore (`_phone`) for methods that subclasses are meant to override.

## Summary

- Overriding means defining a method in a subclass with the same name as a method in the parent; the subclass's version is used for its instances.
- Python finds methods by searching `type(obj)` first, then its parents, and uses the first match. The parent class itself is unaffected.
- A parent method that calls `self.method()` uses the child's override, which lets the parent define an algorithm and the children customise steps of it.
- Class attributes can be overridden the same way; overriding data is often simpler than overriding a whole method.
- An override replaces the parent's method; use `super()` to run the parent's version as well.
- Keep the signature of an override compatible with the parent, and mark overrides with `@typing.override` (3.12+) so type checkers catch typos.
- Methods named `__like_this` are name-mangled and cannot be overridden in the usual way.

## Practice

### Exercise 1: Shapes

Create a class `Shape` with a method `area()` that returns `0` and a method `describe()` that returns `"<ClassName> with area <area>"` (use `type(self).__name__` and `self.area()`). Create subclasses `Rectangle(width, height)` and `Circle(radius)` that override only `area()`. For the circle, round the area to 2 decimal places with `round(..., 2)` and use `math.pi`. Print `describe()` for `Shape()`, `Rectangle(3, 4)` and `Circle(1)`.

### Exercise 2: Greeters

Create a class `Greeter` with a class attribute `greeting = "Hello"` and a method `greet(name)` that returns `"<greeting>, <name>!"`. Create a subclass `SpanishGreeter` that changes the greeting to `"Hola"` **without** overriding `greet()`. Show that both classes work, and that `Greeter` still says `"Hello"`.

### Exercise 3: Predict the output

Without running the code, write down what it prints. Explain each line.

```python
class Report:
    def render(self):
        return f"[{self.header()}] {self.body()}"

    def header(self):
        return "REPORT"

    def body(self):
        return "empty"


class SalesReport(Report):
    def body(self):
        return "sales: 42"


class AnnualSalesReport(SalesReport):
    def header(self):
        return "ANNUAL"


print(Report().render())
print(SalesReport().render())
print(AnnualSalesReport().render())
```

### Exercise 4: Discount pricing

Create a class `Product(name, price)` with a method `final_price()` that returns the price, and a method `label()` that returns `"<name>: <final_price> UAH"`. Create a subclass `DiscountedProduct(name, price, percent)` that overrides only `final_price()` to apply the discount, rounding to 2 decimal places. Use `super().final_price()` inside the override so the base price logic is not duplicated. Print the labels of `Product("Book", 400)` and `DiscountedProduct("Lamp", 1250, 15)`.

## Solutions

### Exercise 1

```python
import math


class Shape:
    def area(self):
        return 0

    def describe(self):
        return f"{type(self).__name__} with area {self.area()}"


class Rectangle(Shape):
    def __init__(self, width, height):
        self.width = width
        self.height = height

    def area(self):
        return self.width * self.height


class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return round(math.pi * self.radius**2, 2)


for shape in [Shape(), Rectangle(3, 4), Circle(1)]:
    print(shape.describe())
```

Output:

```text
Shape with area 0
Rectangle with area 12
Circle with area 3.14
```

`describe()` is written once in `Shape`, yet it reports the right area for each subclass because `self.area()` is looked up on the actual object's class.

### Exercise 2

```python
class Greeter:
    greeting = "Hello"

    def greet(self, name):
        return f"{self.greeting}, {name}!"


class SpanishGreeter(Greeter):
    greeting = "Hola"


print(Greeter().greet("Taras"))
print(SpanishGreeter().greet("Taras"))
print(Greeter.greeting)
```

Output:

```text
Hello, Taras!
Hola, Taras!
Hello
```

### Exercise 3

Output:

```text
[REPORT] empty
[REPORT] sales: 42
[ANNUAL] sales: 42
```

- `Report().render()` uses only `Report`'s methods.
- `SalesReport` overrides `body()` but inherits `header()` and `render()`, so the header stays `REPORT`.
- `AnnualSalesReport` overrides `header()` and inherits `body()` from `SalesReport`. The lookup for `body` goes `AnnualSalesReport -> SalesReport`, where it is found.

In every case `render()` is the single method from `Report`; only the hooks it calls differ.

### Exercise 4

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    def final_price(self):
        return self.price

    def label(self):
        return f"{self.name}: {self.final_price()} UAH"


class DiscountedProduct(Product):
    def __init__(self, name, price, percent):
        self.name = name
        self.price = price
        self.percent = percent

    def final_price(self):
        return round(super().final_price() * (1 - self.percent / 100), 2)


print(Product("Book", 400).label())
print(DiscountedProduct("Lamp", 1250, 15).label())
```

Output:

```text
Book: 400 UAH
Lamp: 1062.5 UAH
```

`label()` from `Product` calls `self.final_price()`, which runs the override for the discounted product. The override reuses the parent's `final_price()` through `super()` instead of reading `self.price` directly.

---

*Source: [pythontutorial.net — Python Overriding Method](https://www.pythontutorial.net/python-oop/python-overriding-method/). Adapted and expanded for PyJourney.*
