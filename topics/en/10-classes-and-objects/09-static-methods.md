# Static Methods

A **static method** is a function that lives inside a class but receives neither the instance nor the class automatically. It cannot see an object's state unless you pass the object in, yet it is grouped with the class because it logically belongs there. The topic Python Object-oriented Programming introduced `@staticmethod` in a few lines. This topic explains how it works, how it differs from instance and class methods, and when a static method is the right tool.

## What you'll learn

- How to define a static method with `@staticmethod` and call it through the class or an instance
- What `@staticmethod` actually does: it switches off the automatic first argument
- How static methods compare with instance methods and class methods
- Why a static method must name the class to reach other members, and when that makes a class method the better choice
- Typical uses: helper functions for a class and groups of related utilities
- When a plain function in a module is better than a static method

## Defining and calling a static method

Put the `@staticmethod` decorator above a function defined in a class. The function has no `self` or `cls` parameter, only the arguments it really needs:

```text
class ClassName:
    @staticmethod
    def static_method_name(param_list):
        ...
```

Call it through the class, `ClassName.static_method_name(...)`. Calling it through an instance works too, and passes exactly the same arguments:

```python
class TemperatureConverter:
    @staticmethod
    def celsius_to_fahrenheit(c):
        return 9 * c / 5 + 32


print(TemperatureConverter.celsius_to_fahrenheit(35))  # through the class

converter = TemperatureConverter()
print(converter.celsius_to_fahrenheit(100))  # through an instance: works too
```

Output:

```text
95.0
212.0
```

The results are `float`s because `/` always returns a `float`. Calling through the class is the usual style: it shows the reader that no object is involved.

## What `@staticmethod` really does

The topic Instance Methods showed that a function accessed **through an instance** becomes a **bound method**, and the instance is passed as the first argument. `@staticmethod` switches that off. Compare a plain function with a static method:

```python
class Demo:
    def plain(x):
        return x

    @staticmethod
    def static(x):
        return x


d = Demo()
print(Demo.plain(5), Demo.static(5), d.static(5))
print(Demo.static)
print(d.static)
print(d.plain)
print(type(Demo.__dict__["plain"]))
print(type(Demo.__dict__["static"]))

try:
    d.plain(5)
except TypeError as error:
    print("TypeError:", error)
```

Output (the addresses vary):

```text
5 5 5
<function Demo.static at 0x100a09170>
<function Demo.static at 0x100a09170>
<bound method Demo.plain of <__main__.Demo object at 0x1009d9160>>
<class 'function'>
<class 'staticmethod'>
TypeError: Demo.plain() takes 1 positional argument but 2 were given
```

- Through the class, both work, because a function accessed through its class is just a function.
- Through the instance, `d.plain` is a bound method: `d.plain(5)` becomes `Demo.plain(d, 5)`, one argument too many.
- `d.static` is the **plain function** itself, the same object as `Demo.static`. No instance is inserted, so `d.static(5)` is simply `static(5)`.
- The class `__dict__` stores a `staticmethod` object that wraps the function. When the attribute is looked up, that wrapper hands back the original function instead of binding it. This mechanism is called a **descriptor**, and a later section of the course covers it in detail.

Since Python 3.10, a `staticmethod` object is itself callable, so a static method can even be used inside the class body, for example to compute a class attribute:

```python
class Config:
    @staticmethod
    def normalize(name):
        return name.strip().lower()

    DEFAULT_ENV = normalize("  Production ")  # Python 3.10+


print(Config.DEFAULT_ENV)
print(Config.normalize("  Staging"))
```

Output:

```text
production
staging
```

In the class body, `normalize` is still the raw `staticmethod` object, not yet an attribute of the finished class. Before Python 3.10 this call failed with `TypeError: 'staticmethod' object is not callable`.

## Instance, class and static methods

Python has three kinds of methods. The difference is what gets passed automatically as the first argument:

| | Instance method | Class method | Static method |
|---|---|---|---|
| Decorator | none | `@classmethod` | `@staticmethod` |
| Receives automatically | the instance (`self`) | the class (`cls`) | nothing |
| Can use the object's state | yes | no | only if the object is passed in |
| Can use the class's state | yes, through `self` or `type(self)` | yes, through `cls` | only by naming the class explicitly |
| Respects subclasses | yes | yes, `cls` is the subclass | no, a hard-coded class name stays fixed |
| Typical use | behaviour of one object | alternative constructors, class-wide operations | helpers and utilities related to the class |

Here is a `Date` class that uses all three:

```python
class Date:
    def __init__(self, year, month, day):
        if not self.is_valid(year, month, day):
            raise ValueError(f"invalid date: {year}-{month}-{day}")
        self.year = year
        self.month = month
        self.day = day

    # instance method: works with one date
    def iso(self):
        return f"{self.year:04d}-{self.month:02d}-{self.day:02d}"

    # class method: an alternative constructor
    @classmethod
    def from_string(cls, text):
        year, month, day = map(int, text.split("-"))
        return cls(year, month, day)

    # static methods: helpers that need neither a date nor the class
    @staticmethod
    def is_leap_year(year):
        return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)

    @staticmethod
    def is_valid(year, month, day):
        days_in_month = [31, 29 if Date.is_leap_year(year) else 28, 31, 30,
                         31, 30, 31, 31, 30, 31, 30, 31]
        return 1 <= month <= 12 and 1 <= day <= days_in_month[month - 1]


d = Date.from_string("2024-02-29")
print(d.iso())
print(Date.is_leap_year(2024), Date.is_leap_year(1900), Date.is_leap_year(2000))
print(Date.is_valid(2023, 2, 29))

try:
    Date.from_string("2023-02-29")
except ValueError as error:
    print("ValueError:", error)
```

Output:

```text
2024-02-29
True False True
False
ValueError: invalid date: 2023-2-29
```

- `iso()` needs the year, month and day of **one** date, so it is an instance method.
- `from_string()` must **create** an object. It receives `cls` and calls `cls(...)`, so a subclass of `Date` would get an instance of the subclass.
- `is_leap_year()` and `is_valid()` work only with the numbers they are given. They need neither a date nor the class, and they are useful **before** any date exists: you can validate user input with `Date.is_valid(...)` without creating an object. So they are static methods.
- `__init__` calls `self.is_valid(...)`: a static method can be called through `self` like any other method. Inside the static method `is_valid()`, however, there is no `self` or `cls`, so it has to name the class to call its sibling: `Date.is_leap_year(year)`.

### Static methods do not know which class called them

That last point has a consequence. A static method that names its class explicitly always uses **that** class, even when it is called through a subclass. A class method receives the actual class as `cls`, and an instance method finds the right class through `self`:

```python
class Shape:
    @staticmethod
    def name():
        return "shape"

    @staticmethod
    def describe_static():
        return f"I am a {Shape.name()}"  # the class is hard-coded

    @classmethod
    def describe_class(cls):
        return f"I am a {cls.name()}"  # cls is whatever class it was called on

    def describe_instance(self):
        return f"I am a {self.name()}"  # self finds the subclass's version


class Square(Shape):
    @staticmethod
    def name():
        return "square"


print(Square.describe_static())
print(Square.describe_class())
print(Square().describe_instance())
```

Output:

```text
I am a shape
I am a square
I am a square
```

`Square` overrides the static method `name()`, and both `describe_class()` and `describe_instance()` pick up the override. `describe_static()` cannot: it was written to call `Shape.name()`. Rule of thumb: **if a method needs the class, even just to call another method of it or to create an instance, make it a class method.** Use a static method only when the function needs nothing from the class at all.

## When to use static methods

### Helpers that belong to a class

A function that serves one class, but does not need its state, fits well as a static method. It is easy to find, it can be called without creating an object, and a subclass can override it if instance methods call it through `self`:

```python
class Password:
    def __init__(self, text):
        problems = self.problems(text)
        if problems:
            raise ValueError("weak password: " + ", ".join(problems))
        self._text = text

    @staticmethod
    def problems(text):
        found = []
        if len(text) < 8:
            found.append("shorter than 8 characters")
        if not any(ch.isupper() for ch in text):
            found.append("no uppercase letter")
        if not any(ch.isdigit() for ch in text):
            found.append("no digit")
        return found


# check a form field before creating anything
print(Password.problems("hello"))
print(Password.problems("Correct horse 9"))

try:
    Password("hello")
except ValueError as error:
    print(error)
```

Output:

```text
['shorter than 8 characters', 'no uppercase letter', 'no digit']
[]
weak password: shorter than 8 characters, no uppercase letter, no digit
```

The standard library does the same. `str.maketrans()` is a static method of `str`: it builds a translation table and does not need any particular string:

```python
table = str.maketrans("abc", "xyz")
print("aabbcc".translate(table))         # xxyyzz
print(type(str.__dict__["maketrans"]))   # <class 'staticmethod'>
```

### A group of related utilities

Static methods can also gather related functions under one name. Here is a temperature converter with conversions between Celsius, Fahrenheit and Kelvin, plus a formatting helper:

```python
class TemperatureConverter:
    KELVIN = "K"
    FAHRENHEIT = "F"
    CELSIUS = "C"

    @staticmethod
    def celsius_to_fahrenheit(c):
        return 9 * c / 5 + 32

    @staticmethod
    def fahrenheit_to_celsius(f):
        return 5 * (f - 32) / 9

    @staticmethod
    def celsius_to_kelvin(c):
        return c + 273.15

    @staticmethod
    def kelvin_to_celsius(k):
        return k - 273.15

    @staticmethod
    def fahrenheit_to_kelvin(f):
        return 5 * (f + 459.67) / 9

    @staticmethod
    def kelvin_to_fahrenheit(k):
        return 9 * k / 5 - 459.67

    @staticmethod
    def format(value, unit):
        symbol = ""
        if unit == TemperatureConverter.FAHRENHEIT:
            symbol = "°F"
        elif unit == TemperatureConverter.CELSIUS:
            symbol = "°C"
        elif unit == TemperatureConverter.KELVIN:
            symbol = " K"  # kelvins are written without a degree sign

        return f"{round(value, 2)}{symbol}"


f = TemperatureConverter.celsius_to_fahrenheit(35)
print(TemperatureConverter.format(f, TemperatureConverter.FAHRENHEIT))

k = TemperatureConverter.celsius_to_kelvin(-40)
print(TemperatureConverter.format(k, TemperatureConverter.KELVIN))

c = TemperatureConverter.kelvin_to_celsius(300)
print(c)
print(TemperatureConverter.format(c, TemperatureConverter.CELSIUS))
```

Output:

```text
95.0°F
233.15 K
26.850000000000023
26.85°C
```

Notes on this class:

- The unit names are class constants, so callers write `TemperatureConverter.FAHRENHEIT` instead of a bare `"F"` that is easy to mistype.
- `format()` reads those constants by naming the class, because a static method has no `self` or `cls`.
- `300 - 273.15` is `26.850000000000023`, not `26.85`: most decimal fractions cannot be stored exactly in binary floating point. `format()` rounds to two decimals for display.
- Kelvin is an absolute scale, so it is written as `233.15 K` without a degree sign.
- A method named `format` does not hide the built-in `format()`. It is an attribute of the class, reached only as `TemperatureConverter.format`.

### ...or just a module?

In Java or C#, every function must live in a class, so "utility classes" full of static methods are common. Python does not have that rule. A **module** is already a namespace for related functions, and often a simpler one:

```python
# temperature.py: a module is a natural namespace for related functions
def celsius_to_fahrenheit(c):
    return 9 * c / 5 + 32


def fahrenheit_to_celsius(f):
    return 5 * (f - 32) / 9
```

Another file uses it like this:

```python
import temperature

print(temperature.celsius_to_fahrenheit(35))  # 95.0
print(temperature.fahrenheit_to_celsius(95))  # 35.0
```

A class that is never instantiated and contains only static methods is usually better written as a module. Prefer a static method when the function is closely tied to a class that has instances and state: it validates or prepares data for that class, it is used by its methods, or subclasses should be able to override it.

## Common mistakes

- **Forgetting `@staticmethod`.** Without it, the function works through the class but fails through an instance, because the instance is passed as an extra argument: `TypeError: Demo.plain() takes 1 positional argument but 2 were given`.
- **Adding `self` out of habit.** A static method receives nothing automatically, so `self` swallows a real argument:

  ```python
  class Greeter:
      @staticmethod
      def greet(self, name):  # self added out of habit
          return f"Hello, {name}!"


  print(Greeter().greet("Olena"))
  ```

  Output:

  ```text
  Traceback (most recent call last):
    ...
  TypeError: Greeter.greet() missing 1 required positional argument: 'name'
  ```

- **Calling a sibling static method without the class name.** The class body is not an enclosing scope for the functions defined in it, so a bare name is looked up among locals and globals:

  ```python
  class TemperatureConverter:
      @staticmethod
      def celsius_to_kelvin(c):
          return c + 273.15

      @staticmethod
      def fahrenheit_to_kelvin(f):
          c = 5 * (f - 32) / 9
          return celsius_to_kelvin(c)  # bug: the class body is not a scope for methods


  print(TemperatureConverter.fahrenheit_to_kelvin(32))
  ```

  Output:

  ```text
  Traceback (most recent call last):
    ...
  NameError: name 'celsius_to_kelvin' is not defined
  ```

  Write `TemperatureConverter.celsius_to_kelvin(c)`, or turn the method into a class method and use `cls.celsius_to_kelvin(c)`.
- **Using a static method as a factory.** `return Money(...)` inside a static method always creates the base class, even when called as `Euro.from_string(...)`. Factories should be class methods that call `cls(...)` (see Exercise 3).
- **Hard-coding the class where subclasses should be respected.** If a static method needs to name its own class, it probably wants to be a class method.
- **Making something static that needs the object.** If you find yourself passing `self`-like data into a static method from every caller, it should be an instance method.
- **Writing a trailing comma after a constant.** `KELVIN = "K",` creates the tuple `('K',)`, so `unit == TemperatureConverter.KELVIN` is never true for `"K"`. The comma, not the parentheses, makes a tuple.
- **Building a class out of static methods only.** If the class has no instances and no state, a module is simpler.

## Summary

- A static method is defined with `@staticmethod` and receives neither `self` nor `cls`. It behaves like a plain function stored in the class's namespace.
- Call it through the class (`ClassName.method()`), or through an instance or `self`, with exactly the same arguments.
- `@staticmethod` wraps the function in a `staticmethod` object that prevents binding. Since Python 3.10 that object is also directly callable.
- Instance methods work with one object, class methods with the class (`cls`), static methods with only their arguments.
- A static method can reach the class only by naming it, which ignores subclasses. If you need the class, use a class method.
- Use static methods for helpers that belong to a class and for small groups of related utilities. For standalone utilities, a module is often better.

## Practice

### Exercise 1: Validate before creating

Create a class `User` with a static method `is_valid_email(email)` that returns `True` when the address contains exactly one `@`, the part before it is not empty, and the part after it contains a dot but neither starts nor ends with one. `User(name, email)` must raise `ValueError` for an invalid address. Print the result of `is_valid_email()` for `"olena@example.com"`, `"olena.example.com"`, `"@example.com"`, `"a@b"`, `"a@b@c.com"` and `"max@site."` without creating any users, then create one valid user and try to create one with `"max@localhost"`.

### Exercise 2: Convert anything to anything

Add a static method `convert(value, from_unit, to_unit)` to a `TemperatureConverter` that has the four conversions between Celsius and the other two scales (`celsius_to_fahrenheit`, `fahrenheit_to_celsius`, `celsius_to_kelvin`, `kelvin_to_celsius`). Units are `"C"`, `"F"` and `"K"`. Convert in two steps through Celsius, reusing the existing methods, and round the result to two decimals. An unknown unit raises `ValueError`. Test with 100 C to F, 32 F to K, 0 K to C, -40 F to C and 20 C to C.

### Exercise 3: Fix the factory

`Euro.from_string("12.50")` should return a `Euro`, but it returns a plain `Money`. Fix the class. Keep the string parsing in a static helper `parse_cents(text)` that returns the amount in cents, and make the factory work for every subclass.

```python
class Money:
    def __init__(self, cents):
        self.cents = cents

    def show(self):
        return f"{self.cents // 100}.{self.cents % 100:02d}"

    @staticmethod
    def from_string(text):
        units, cents = text.split(".")
        return Money(int(units) * 100 + int(cents))


class Euro(Money):
    def show(self):
        return "EUR " + super().show()


price = Euro.from_string("12.50")
print(type(price).__name__, price.show())
```

### Exercise 4: Predict the output

Write down the four lines this program prints, then run it. Which single change makes `SalesReport.title()` return `"SALES!"`?

```python
class Report:
    @staticmethod
    def header():
        return "REPORT"

    @staticmethod
    def title():
        return Report.header() + "!"

    def render(self):
        return self.header() + " / " + self.title()


class SalesReport(Report):
    @staticmethod
    def header():
        return "SALES"


r = SalesReport()
print(r.render())
print(SalesReport.title())
print(r.header is SalesReport.header)
print(Report.header())
```

## Solutions

### Exercise 1

```python
class User:
    def __init__(self, name, email):
        if not self.is_valid_email(email):
            raise ValueError(f"invalid email: {email!r}")
        self.name = name
        self.email = email

    @staticmethod
    def is_valid_email(email):
        if email.count("@") != 1:
            return False
        local, domain = email.split("@")
        return (
            local != ""
            and "." in domain
            and not domain.startswith(".")
            and not domain.endswith(".")
        )


for address in ["olena@example.com", "olena.example.com", "@example.com",
                "a@b", "a@b@c.com", "max@site."]:
    print(f"{address:<18} {User.is_valid_email(address)}")

user = User("Olena", "olena@example.com")
print(user.name, user.email)

try:
    User("Max", "max@localhost")
except ValueError as error:
    print("ValueError:", error)
```

Output:

```text
olena@example.com  True
olena.example.com  False
@example.com       False
a@b                False
a@b@c.com          False
max@site.          False
Olena olena@example.com
ValueError: invalid email: 'max@localhost'
```

The check needs only the string, so it is static, and the loop uses it without creating a single `User`. `__init__` calls it through `self`, which would let a subclass with stricter rules override it. Real email validation is far more complicated. In practice, check the basic shape and then send a confirmation email.

### Exercise 2

```python
class TemperatureConverter:
    @staticmethod
    def celsius_to_fahrenheit(c):
        return 9 * c / 5 + 32

    @staticmethod
    def fahrenheit_to_celsius(f):
        return 5 * (f - 32) / 9

    @staticmethod
    def celsius_to_kelvin(c):
        return c + 273.15

    @staticmethod
    def kelvin_to_celsius(k):
        return k - 273.15

    @staticmethod
    def convert(value, from_unit, to_unit):
        tc = TemperatureConverter  # a short alias for the class

        # step 1: from any unit to Celsius
        if from_unit == "C":
            celsius = value
        elif from_unit == "F":
            celsius = tc.fahrenheit_to_celsius(value)
        elif from_unit == "K":
            celsius = tc.kelvin_to_celsius(value)
        else:
            raise ValueError(f"unknown unit: {from_unit!r}")

        # step 2: from Celsius to the target unit
        if to_unit == "C":
            result = celsius
        elif to_unit == "F":
            result = tc.celsius_to_fahrenheit(celsius)
        elif to_unit == "K":
            result = tc.celsius_to_kelvin(celsius)
        else:
            raise ValueError(f"unknown unit: {to_unit!r}")

        return round(result, 2)


print(TemperatureConverter.convert(100, "C", "F"))
print(TemperatureConverter.convert(32, "F", "K"))
print(TemperatureConverter.convert(0, "K", "C"))
print(TemperatureConverter.convert(-40, "F", "C"))
print(TemperatureConverter.convert(20, "C", "C"))

try:
    TemperatureConverter.convert(10, "C", "X")
except ValueError as error:
    print("ValueError:", error)
```

Output:

```text
212.0
273.15
-273.15
-40.0
20
ValueError: unknown unit: 'X'
```

Going through Celsius means two conversions per scale instead of one for every pair, and a new scale needs only two new methods. The last result is `20`, not `20.0`, because no conversion happened and `round(20, 2)` keeps the integer. Since `convert()` must name the class to call its siblings, a subclass could not replace, say, `celsius_to_kelvin()` for it. If that matters, make `convert()` a class method and call `cls.celsius_to_kelvin(...)`.

### Exercise 3

```python
class Money:
    def __init__(self, cents):
        self.cents = cents

    def show(self):
        return f"{self.cents // 100}.{self.cents % 100:02d}"

    @staticmethod
    def parse_cents(text):
        """Turn '12.50' into 1250. A pure helper: needs no class and no object."""
        units, cents = text.split(".")
        return int(units) * 100 + int(cents)

    @classmethod
    def from_string(cls, text):
        return cls(cls.parse_cents(text))  # cls is Euro when called as Euro.from_string


class Euro(Money):
    def show(self):
        return "EUR " + super().show()


price = Euro.from_string("12.50")
print(type(price).__name__, price.show())
print(Money.from_string("3.05").show())
print(Money.parse_cents("7.99"))
```

Output:

```text
Euro EUR 12.50
3.05
799
```

The original factory was static and hard-coded `Money(...)`, so it could not know that it was called through `Euro`. As a class method it receives `cls`, which is `Euro` in the first call and `Money` in the second. The parsing step needs nothing from the class, so it stays static.

### Exercise 4

Output:

```text
SALES / REPORT!
REPORT!
True
REPORT
```

- `render()` calls `self.header()`, which finds `SalesReport.header`, so the first part is `SALES`. It then calls `self.title()`, which is the inherited static `title()`, and that calls `Report.header()` by name, so it gives `REPORT!`.
- `SalesReport.title()` is the same inherited static method, so it also returns `REPORT!`.
- Through an instance or through the class, a static method is the same plain function object, so `r.header is SalesReport.header` is `True`.
- `Report.header()` is not affected by the subclass at all.

To make `title()` respect subclasses, turn it into a class method:

```python
class Report:
    @staticmethod
    def header():
        return "REPORT"

    @classmethod
    def title(cls):
        return cls.header() + "!"

    def render(self):
        return self.header() + " / " + self.title()


class SalesReport(Report):
    @staticmethod
    def header():
        return "SALES"


print(SalesReport().render())
print(SalesReport.title())
```

Output:

```text
SALES / SALES!
SALES!
```

---

*Source: [pythontutorial.net — Python Static Methods](https://www.pythontutorial.net/python-oop/python-static-methods/). Adapted and expanded for PyJourney.*
