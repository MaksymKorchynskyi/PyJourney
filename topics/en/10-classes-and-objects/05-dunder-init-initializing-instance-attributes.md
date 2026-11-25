# __init__: Initializing Instance Attributes

`__init__` is the special method Python calls automatically right after it creates a new object. It is where you give every instance its starting attributes, so that each object begins its life complete and valid. Almost every class you write will have one.

## What you'll learn

- What `__init__` is and when Python calls it
- How object creation works in two steps: `__new__` creates, `__init__` initializes
- How to pass arguments to `__init__`, including default and keyword-only parameters
- How to validate arguments and prepare attributes inside `__init__`
- Why mutable default arguments are a trap and how to avoid it
- How `__init__` works with inheritance and `super().__init__()`

## What `__init__` is

`__init__` has two underscores on each side of its name. Such names are called **dunder** names ("double underscore"), so `__init__` is often read aloud as "dunder init". Dunder methods are **special methods**: you define them, but Python calls them for you in response to certain operations. Creating an object triggers `__init__`, calling `len(obj)` triggers `__len__`, `a + b` triggers `__add__`, and so on.

Here is a class with an `__init__` method:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


person = Person("John", 25)
print(f"I'm {person.name}. I'm {person.age} years old.")
```

Output:

```text
I'm John. I'm 25 years old.
```

The arguments you pass to the class, `Person("John", 25)`, are forwarded to `__init__` after `self`. Inside, `self.name = name` creates the attribute `name` on the new object and stores the argument in it. The parameter `name` and the attribute `self.name` are two different things that happen to share a name: the parameter disappears when `__init__` returns, the attribute stays with the object.

> **Note:** You don't call `__init__` yourself on an existing object. `person.__init__("Jane", 30)` would technically run, but re-initializing a live object is confusing and error-prone. The one place where an explicit call is normal is inside a subclass: `super().__init__(...)`, shown below.

## How an object is created: two steps

When you call `Person("John", 25)`, Python performs two steps:

1. **Create** the object. The special method `__new__` allocates a new, empty instance. Its namespace, `__dict__`, is empty at this point.
2. **Initialize** it. Python calls `__init__` on the new instance with your arguments, and `__init__` fills in the attributes.

You can watch both steps by overriding `__new__` just to print a message:

```python
class Person:
    def __new__(cls, *args):
        print(f"1. __new__ creates a {cls.__name__} object")
        return super().__new__(cls)

    def __init__(self, name, age):
        print(f"2. __init__ sets up {name!r}")
        print("   __dict__ before:", self.__dict__)
        self.name = name
        self.age = age
        print("   __dict__ after: ", self.__dict__)


person = Person("John", 25)
print("3. ready:", person.name)
```

Output:

```text
1. __new__ creates a Person object
2. __init__ sets up 'John'
   __dict__ before: {}
   __dict__ after:  {'name': 'John', 'age': 25}
3. ready: John
```

Because `__init__` receives an object that already exists, it does not create anything. Strictly speaking, `__new__` is the **constructor** and `__init__` is the **initializer**. In everyday speech many people still call `__init__` "the constructor", which is fine as long as you know the difference. You will rarely need to write `__new__` yourself. It is used for special cases such as subclassing immutable types.

One more consequence: `__init__` must return `None`. Its job is to modify `self`, not to produce a value:

```python
class Person:
    def __init__(self, name):
        self.name = name
        return self


Person("John")
```

Output:

```text
Traceback (most recent call last):
  ...
TypeError: __init__() should return None, not 'Person'
```

## Passing arguments

Every parameter of `__init__` after `self` must receive a value when you create an object. Forgetting one raises `TypeError`:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


Person("John")
```

Output:

```text
Traceback (most recent call last):
  ...
TypeError: Person.__init__() missing 1 required positional argument: 'age'
```

### Default values

Like any function, `__init__` can have parameters with default values. Callers may then omit them:

```python
class Person:
    def __init__(self, name, age=22):
        self.name = name
        self.age = age


person = Person("John")
print(f"I'm {person.name}. I'm {person.age} years old.")

other = Person("Jane", 30)
print(f"I'm {other.name}. I'm {other.age} years old.")
```

Output:

```text
I'm John. I'm 22 years old.
I'm Jane. I'm 30 years old.
```

### Keyword and keyword-only arguments

You can pass arguments by name, which makes calls with several values easier to read. A bare `*` in the signature turns the following parameters into **keyword-only** parameters, which callers must name explicitly:

```python
class Person:
    def __init__(self, name, *, age=22, city="Kyiv"):
        self.name = name
        self.age = age
        self.city = city


person = Person("Olena", city="Lviv")
print(person.name, person.age, person.city)

try:
    Person("Olena", 30)
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
Olena 22 Lviv
TypeError: Person.__init__() takes 2 positional arguments but 3 were given
```

Keyword-only parameters are useful for optional settings: nobody can accidentally pass a city where an age was expected.

### A class without `__init__`

If a class does not define `__init__`, it inherits the default one from `object`, which accepts no arguments:

```python
class Empty:
    pass


print(Empty())
Empty(1)
```

Output (the address varies):

```text
<__main__.Empty object at 0x1031f5160>
Traceback (most recent call last):
  ...
TypeError: Empty() takes no arguments
```

## Validating and preparing attributes

`__init__` is the gatekeeper of your class. If it refuses to finish for bad input, no invalid object can ever exist. Raise an exception for arguments you cannot accept, and normalize the ones you can:

```python
class User:
    def __init__(self, username, email):
        username = username.strip()
        if not username:
            raise ValueError("username must not be empty")
        if "@" not in email:
            raise ValueError(f"invalid email: {email!r}")

        self.username = username
        self.email = email.lower()
        self.is_active = True  # every new user starts as active


user = User("  olena ", "Olena@Example.com")
print(user.username, user.email, user.is_active)

for args in [("", "a@b.c"), ("max", "max.example.com")]:
    try:
        User(*args)
    except ValueError as error:
        print("ValueError:", error)
```

Output:

```text
olena olena@example.com True
ValueError: username must not be empty
ValueError: invalid email: 'max.example.com'
```

Note three kinds of attributes here:

- attributes copied from arguments after cleaning (`username`, `email`);
- attributes with a fixed starting value that are not parameters at all (`is_active`);
- no attribute is created when validation fails, because the exception stops `__init__` and the half-built object is thrown away.

> **Tip:** Be careful with attributes *calculated* from other attributes, such as `self.area = width * height`. The value is computed once and goes stale if `width` changes later. Prefer a method (`def area(self)`) or a property for values that depend on other attributes.

## The mutable default argument trap

Default values are evaluated **once**, when the `def` statement runs, not on every call. If the default is a mutable object such as a list, every instance that relies on the default shares the **same** list:

```python
class Student:
    def __init__(self, name, grades=[]):
        self.name = name
        self.grades = grades


anna = Student("Anna")
bohdan = Student("Bohdan")
anna.grades.append(95)
print(bohdan.grades)
print(anna.grades is bohdan.grades)
```

Output:

```text
[95]
True
```

Bohdan "received" Anna's grade. The fix is to use `None` as the default and create a new list inside `__init__`. Copying a list passed by the caller (`list(grades)`) also protects the object from outside changes to that list:

```python
class Student:
    def __init__(self, name, grades=None):
        self.name = name
        self.grades = [] if grades is None else list(grades)


anna = Student("Anna")
bohdan = Student("Bohdan")
anna.grades.append(95)
print(anna.grades, bohdan.grades)

initial = [80, 90]
chris = Student("Chris", initial)
initial.append(10)
print(chris.grades)
```

Output:

```text
[95] []
[80, 90]
```

## `__init__` and inheritance

A subclass that does not define `__init__` simply inherits the parent's one. A subclass that **does** define `__init__` replaces the parent's version completely. Python does not call the parent's `__init__` automatically, so you have to call it yourself with `super().__init__(...)`:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


class Employee(Person):
    def __init__(self, name, age, job_title):
        super().__init__(name, age)  # let Person set up name and age
        self.job_title = job_title


employee = Employee("John", 25, "Python Developer")
print(employee.name, employee.age, employee.job_title)
```

Output:

```text
John 25 Python Developer
```

Without the `super().__init__(name, age)` line, `employee.name` would raise `AttributeError: 'Employee' object has no attribute 'name'`.

### Letting a dataclass write `__init__`

For classes that mostly store data, the standard library can write `__init__` for you. The `@dataclass` decorator generates `__init__`, `__repr__` and `__eq__` from annotated class attributes:

```python
from dataclasses import dataclass, field


@dataclass
class Person:
    name: str
    age: int = 22
    tags: list[str] = field(default_factory=list)


print(Person("John"))
print(Person("Jane", 30, ["admin"]))
```

Output:

```text
Person(name='John', age=22, tags=[])
Person(name='Jane', age=30, tags=['admin'])
```

`field(default_factory=list)` creates a new list for every instance, so dataclasses solve the mutable default problem for you. Dataclasses get their own topic later. Until then, writing `__init__` by hand is the best way to understand what they automate.

## Common mistakes

- **Misspelling the name.** `__int__`, `_init_` or `__init` are ordinary methods that Python never calls automatically. The class then falls back to `object.__init__`:

  ```python
  class Person:
      def __int__(self, name, age):  # typo: should be __init__
          self.name = name
          self.age = age


  Person("John", 25)
  ```

  Output:

  ```text
  Traceback (most recent call last):
    ...
  TypeError: Person() takes no arguments
  ```

- **Forgetting `self.`** `name = name` inside `__init__` only reassigns the local parameter. The object gets no attribute, and the error appears later, far from the cause.

- **Returning a value.** `__init__` must return `None`. Returning anything else raises `TypeError`.

- **Using a mutable default** such as `[]` or `{}`. All instances share one object. Use `None` and create a fresh object inside `__init__`.

- **Not calling `super().__init__()` in a subclass** that defines its own `__init__`. The parent's attributes are never created.

- **Doing heavy work in `__init__`.** Reading files or calling a network service in `__init__` makes objects slow and hard to test. Keep `__init__` simple and move such work into a class method that prepares the data and then calls the class.

## Summary

- `__init__` is a special (dunder) method that Python calls automatically right after a new object is created.
- Object creation has two steps: `__new__` creates an empty instance, then `__init__` initializes its attributes. `__init__` is an initializer and must return `None`.
- Arguments passed to the class are forwarded to `__init__`. Missing required arguments raise `TypeError`. Parameters may have defaults or be keyword-only.
- Use `__init__` to validate input (raise an exception to refuse bad data) and to set every attribute an instance needs.
- Never use a mutable object as a default value. Use `None` and create the object inside `__init__`.
- A subclass with its own `__init__` must call `super().__init__(...)` to run the parent's initialization.

## Practice

### Exercise 1: Rectangles and squares

Write a class `Rectangle` whose `__init__` takes `width` and an optional `height`. If `height` is omitted, the rectangle is a square, so `height` equals `width`. Add a method `area()`. Print the area of `Rectangle(3, 4)` and of `Rectangle(5)`.

### Exercise 2: A validated product

Write a class `Product` with `__init__(self, name, price, quantity=0)`:

- `name` is stripped of surrounding spaces and must not be empty;
- `price` must be greater than zero;
- `quantity` must not be negative.

Raise `ValueError` with a clear message for each problem. Create one valid product and print its attributes, then try `Product("  ", 10)`, `Product("Pen", 0)` and `Product("Pen", 2, -1)` and print each error message.

### Exercise 3: Fix the playlist

Find and fix **two** problems in this class. The first one is visible in the output. The second one appears when a caller passes their own list and keeps changing it afterwards.

```python
class Playlist:
    def __init__(self, title, songs=[]):
        self.title = title
        self.songs = songs

    def add(self, song):
        self.songs.append(song)


rock = Playlist("Rock")
jazz = Playlist("Jazz")
rock.add("Bohemian Rhapsody")
print(jazz.songs)
```

### Exercise 4: Employees and managers

Write a class `Employee` with `__init__(self, name, salary)`. Then write `Manager(Employee)` whose `__init__` takes `name`, `salary` and an optional list of `reports` (other employees). It must reuse the parent's initialization with `super()`. Add a method `team_size()` to `Manager`. Create two employees and a manager who manages both, and print the manager's name, salary and team size.

## Solutions

### Exercise 1

```python
class Rectangle:
    def __init__(self, width, height=None):
        self.width = width
        self.height = width if height is None else height

    def area(self):
        return self.width * self.height


print(Rectangle(3, 4).area())
print(Rectangle(5).area())
```

Output:

```text
12
25
```

`None` works as a "not given" marker. A default like `height=width` is impossible, because defaults cannot refer to other parameters.

### Exercise 2

```python
class Product:
    def __init__(self, name, price, quantity=0):
        name = name.strip()
        if not name:
            raise ValueError("name must not be empty")
        if price <= 0:
            raise ValueError(f"price must be positive, got {price}")
        if quantity < 0:
            raise ValueError(f"quantity must not be negative, got {quantity}")

        self.name = name
        self.price = price
        self.quantity = quantity


pen = Product("  Pen ", 2.5, 10)
print(pen.name, pen.price, pen.quantity)

for args in [("  ", 10), ("Pen", 0), ("Pen", 2, -1)]:
    try:
        Product(*args)
    except ValueError as error:
        print("ValueError:", error)
```

Output:

```text
Pen 2.5 10
ValueError: name must not be empty
ValueError: price must be positive, got 0
ValueError: quantity must not be negative, got -1
```

### Exercise 3

The code prints `['Bohemian Rhapsody']`, because the default list is created once and shared by `rock` and `jazz`. The second problem: `self.songs = songs` stores the caller's own list, so any later change the caller makes to that list also changes the playlist. Both are fixed by a `None` default and a copy:

```python
class Playlist:
    def __init__(self, title, songs=None):
        self.title = title
        self.songs = [] if songs is None else list(songs)

    def add(self, song):
        self.songs.append(song)


rock = Playlist("Rock")
jazz = Playlist("Jazz")
rock.add("Bohemian Rhapsody")
print(jazz.songs)

favourites = ["Imagine"]
mix = Playlist("Mix", favourites)
favourites.append("Yesterday")
print(mix.songs)
```

Output:

```text
[]
['Imagine']
```

### Exercise 4

```python
class Employee:
    def __init__(self, name, salary):
        self.name = name
        self.salary = salary


class Manager(Employee):
    def __init__(self, name, salary, reports=None):
        super().__init__(name, salary)
        self.reports = [] if reports is None else list(reports)

    def team_size(self):
        return len(self.reports)


dev = Employee("Taras", 3000)
qa = Employee("Iryna", 2800)
lead = Manager("Olena", 4500, [dev, qa])
print(lead.name, lead.salary, lead.team_size())
```

Output:

```text
Olena 4500 2
```

`super().__init__(name, salary)` sets `name` and `salary` exactly as `Employee` does, and `Manager` only adds what is new. The `reports` parameter uses the `None` pattern from the previous exercise.

---

*Source: [pythontutorial.net — Python __init__](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__init__/). Adapted and expanded for PyJourney.*
