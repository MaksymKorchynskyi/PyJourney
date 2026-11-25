# Python Object-oriented Programming

Object-oriented programming (OOP) organizes a program around **objects**: units that bundle data together with the functions that work on that data. Python is object-oriented to its core, because every value you touch is an object. This topic is a guided tour of the main OOP tools in Python. Each of them gets its own detailed topic later in this section.

## What you'll learn

- What objects, classes and instances are, and what "everything is an object" means
- How to define a class, create instances and initialize their attributes with `__init__`
- How instance methods, class methods and static methods differ
- How class attributes are shared by all instances
- How inheritance and `super()` let one class reuse and extend another
- How overriding a method gives you polymorphism

## Objects: state and behaviour

An object has two sides:

- **State**: the data it holds right now (a number's value, a list's items, a user's name).
- **Behaviour**: what it can do, expressed as **methods** (functions attached to the object).

You have been using objects all along. Integers, strings and even functions are objects with a type and methods:

```python
count = 42
words = "hello world"

print(type(count))
print(count.bit_length())
print(type(words))
print(words.title())
print(type(len))
```

Output:

```text
<class 'int'>
6
<class 'str'>
Hello World
<class 'builtin_function_or_method'>
```

The value `42` is the state of the `count` object, and `bit_length()` is one of its behaviours. Its type, `int`, is a **class**: a description of what state and behaviour all integers share.

A class is like a blueprint, and the objects built from it are its **instances**. One `int` class, millions of integer instances.

```text
            class Person            <- the blueprint
          /        |        \
   instance     instance     instance
  "John", 25   "Jane", 22   "Olena", 31
```

### Why OOP?

When a program grows, keeping data and the code that changes it in separate places becomes hard to follow. OOP keeps them together and gives you four classic ideas to work with:

| Idea | Meaning in Python |
|---|---|
| Encapsulation | An object bundles its data with the methods that work on it and controls how that data changes. |
| Abstraction | Users of a class call simple methods and do not need to know how they work inside. |
| Inheritance | A new class can reuse an existing class and add or change behaviour. |
| Polymorphism | Different classes can answer the same method call in their own way. |

## Defining a class and creating objects

Use the `class` keyword, a name and a colon. The body is indented. `pass` is a placeholder for an empty body:

```python
class Person:
    pass


person = Person()
print(type(person))
print(isinstance(person, Person))
```

Output:

```text
<class '__main__.Person'>
True
```

You create an instance by **calling** the class like a function: `Person()`. Classes are callable, and every call produces a brand-new, independent object:

```python
class Person:
    pass


first = Person()
second = Person()
print(first is second)
```

Output:

```text
False
```

## Instance attributes

Python is dynamic: you can attach an attribute to an object at any moment with dot notation. But an attribute added this way exists only on *that one* object:

```python
class Person:
    pass


person = Person()
person.name = "John"
print(person.name)

other = Person()
print(hasattr(other, "name"))
```

Output:

```text
John
False
```

Adding attributes by hand is fragile: it is easy to forget one, and nothing guarantees that every `Person` has a `name`. The standard solution is the special method `__init__`. Python calls it automatically right after it creates a new instance, so it is the place to set up the attributes every instance should have:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


person = Person("John", 25)
print(person.name)
print(person.age)
```

Output:

```text
John
25
```

What happens on `Person("John", 25)`:

1. Python creates a new, empty `Person` object.
2. It calls `__init__(new_object, "John", 25)`. The new object arrives as the first parameter, `self`.
3. `self.name = name` stores the value as an attribute **on that object**.
4. The finished object is returned and bound to `person`.

## Instance methods

A function defined inside a class is a **method**. An instance method receives the instance as its first parameter, `self`, so it can read and change that instance's state:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def greet(self):
        return f"Hi, it's {self.name}."


person = Person("John", 25)
print(person.greet())
```

Output:

```text
Hi, it's John.
```

You call a method with dot notation. You do not pass `self` yourself: `person.greet()` is translated into `Person.greet(person)`, so the object before the dot becomes `self`.

## Class attributes

An attribute assigned directly in the class body belongs to the **class** and is shared by all instances. Use it for constants and for data about the class as a whole, such as how many instances were created:

```python
class Person:
    counter = 0

    def __init__(self, name, age):
        self.name = name
        self.age = age
        Person.counter += 1

    def greet(self):
        return f"Hi, it's {self.name}."


p1 = Person("John", 25)
p2 = Person("Jane", 22)
print(Person.counter)
print(p1.counter)
```

Output:

```text
2
2
```

You can read a class attribute through the class (`Person.counter`) or through any instance (`p1.counter`). If the instance has no attribute with that name, Python looks it up on the class.

> **Note:** To *change* a class attribute, assign through the class: `Person.counter += 1`. Writing `self.counter += 1` would create a separate instance attribute on that one object and leave the shared counter untouched (see "Common mistakes").

## Class methods

A **class method** works with the class rather than with one instance. Mark it with the `@classmethod` decorator. Python passes the class itself as the first argument, which by convention is named `cls`. The most common use is an **alternative constructor**, a different way to create instances:

```python
class Person:
    counter = 0

    def __init__(self, name, age):
        self.name = name
        self.age = age
        Person.counter += 1

    @classmethod
    def create_anonymous(cls):
        return cls("Anonymous", 22)


anonymous = Person.create_anonymous()
print(anonymous.name)
print(Person.counter)
```

Output:

```text
Anonymous
1
```

Notice `cls("Anonymous", 22)` rather than `Person("Anonymous", 22)`. When a subclass calls the method, `cls` is that subclass, so the factory builds the right type. Hard-coding `Person` would always produce a plain `Person`.

## Static methods

A **static method** receives neither the instance nor the class automatically. It is a plain function placed inside a class because it logically belongs there. Mark it with `@staticmethod`:

```python
class TemperatureConverter:
    @staticmethod
    def celsius_to_fahrenheit(c):
        return 9 * c / 5 + 32

    @staticmethod
    def fahrenheit_to_celsius(f):
        return 5 * (f - 32) / 9


f = TemperatureConverter.celsius_to_fahrenheit(30)
print(f)
print(TemperatureConverter.fahrenheit_to_celsius(86))
```

Output:

```text
86.0
30.0
```

The result is `86.0`, not `86`: the `/` operator always returns a `float` in Python 3, even when the division is exact.

### The three kinds of methods side by side

| | Instance method | Class method | Static method |
|---|---|---|---|
| Decorator | none | `@classmethod` | `@staticmethod` |
| First parameter (passed automatically) | the instance, `self` | the class, `cls` | nothing |
| Can use instance state | yes | no | no |
| Can use class state | yes, via `self` or `type(self)` | yes, via `cls` | only by naming the class explicitly |
| Typical use | behaviour of one object | alternative constructors, class-wide operations | utility functions related to the class |

## Inheritance

A class can **inherit** from another class. The child class (subclass) automatically gets all attributes and methods of the parent class (base class) and can add new ones or replace existing ones.

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def greet(self):
        return f"Hi, it's {self.name}."


class Employee(Person):
    def __init__(self, name, age, job_title):
        super().__init__(name, age)
        self.job_title = job_title

    def greet(self):
        return super().greet() + f" I'm a {self.job_title}."


employee = Employee("John", 25, "Python Developer")
print(employee.greet())
print(employee.age)
print(isinstance(employee, Person))
print(issubclass(Employee, Person))
```

Output:

```text
Hi, it's John. I'm a Python Developer.
25
True
True
```

Key points:

- `class Employee(Person)` declares the parent in parentheses.
- `super().__init__(name, age)` runs the parent's initializer, so `name` and `age` are set up exactly as in `Person`. The child then adds its own `job_title`.
- Defining `greet()` again in `Employee` **overrides** the parent's version. Inside it, `super().greet()` still calls the original, so the child *extends* the behaviour instead of rewriting it.
- An `Employee` **is a** `Person`: `isinstance()` confirms it, and it has `age` without defining it.

## Polymorphism

Because every `Person` has a `greet()` method, code can work with a mix of persons and employees without checking their exact types. Each object answers in its own way:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def greet(self):
        return f"Hi, it's {self.name}."


class Employee(Person):
    def __init__(self, name, age, job_title):
        super().__init__(name, age)
        self.job_title = job_title

    def greet(self):
        return super().greet() + f" I'm a {self.job_title}."


people = [Person("Jane", 22), Employee("John", 25, "Python Developer")]
for someone in people:
    print(someone.greet())
```

Output:

```text
Hi, it's Jane.
Hi, it's John. I'm a Python Developer.
```

The loop calls the same method name, and Python picks the right implementation based on each object's class. This is polymorphism, and it is the reason inheritance and overriding are so useful.

## Common mistakes

- **Forgetting `self` in a method definition.** Python always passes the instance, so a method without a parameter for it fails when called:

  ```python
  class Person:
      def greet():
          return "Hi!"


  Person().greet()
  ```

  Output:

  ```text
  Traceback (most recent call last):
    ...
  TypeError: Person.greet() takes 0 positional arguments but 1 was given
  ```

- **Forgetting the parentheses.** `person.greet` (without `()`) does not call the method. It gives you a bound method object, and printing it shows something like `<bound method Person.greet of <__main__.Person object at 0x...>>`.

- **Hard-coding the class name in a class method.** It silently breaks subclasses:

  ```python
  class Person:
      def __init__(self, name, age):
          self.name = name
          self.age = age

      @classmethod
      def create_anonymous(cls):
          return Person("Anonymous", 22)  # bug: ignores cls


  class Employee(Person):
      pass


  print(type(Employee.create_anonymous()).__name__)
  ```

  Output:

  ```text
  Person
  ```

  With `return cls("Anonymous", 22)` the result would be an `Employee`.

- **Not calling `super().__init__()` in a subclass.** If the child defines its own `__init__` and skips the parent's, the parent's attributes are never created, and using them raises `AttributeError`.

- **Updating a shared counter through `self`.** `self.counter += 1` reads the class attribute, adds 1 and stores the result as a *new instance attribute*. The class attribute never changes:

  ```python
  class Person:
      counter = 0

      def __init__(self):
          self.counter += 1


  a = Person()
  b = Person()
  print(Person.counter, a.counter, b.counter)
  ```

  Output:

  ```text
  0 1 1
  ```

## Summary

- Everything in Python is an object with state (data) and behaviour (methods). A class describes them, and instances are the objects created from it.
- Define a class with `class Name:` and create instances by calling it: `Name(...)`.
- `__init__` runs automatically after an instance is created and sets up its attributes through `self`.
- Instance methods receive the instance as `self`. Class methods (`@classmethod`) receive the class as `cls`. Static methods (`@staticmethod`) receive nothing automatically.
- Class attributes live on the class and are shared by all instances. Change them through the class name.
- A subclass inherits from its parent, can override methods, and can call the parent's version with `super()`.
- Polymorphism means one method call works on objects of different classes, each responding in its own way.

## Practice

### Exercise 1: A Book class

Define a class `Book` whose `__init__` takes `title` and `author`. Add a method `describe()` that returns a string like `'Dune' by Frank Herbert`. Create two books and print their descriptions.

### Exercise 2: Counting and an alternative constructor

Extend `Book` with:

- a class attribute `total` that counts how many books have been created;
- a class method `from_string(text)` that accepts `"Title;Author"` and returns a new book (use `cls`).

Create one book normally and one with `from_string("Kobzar;Taras Shevchenko")`, then print both descriptions and `Book.total`.

### Exercise 3: An EBook subclass

Create `EBook(Book)` that also takes `size_mb`. Override `describe()` so that it reuses the parent's text via `super()` and appends the size, e.g. `'Dune' by Frank Herbert [2.5 MB]`. Put a `Book` and an `EBook` into a list and print `describe()` for each in a loop. Also check that `EBook.from_string()` returns an `EBook` when called on the subclass (pass the size as an extra argument with a default value).

### Exercise 4: Fix the counter

This class is supposed to count created sessions, but it prints `0`. Explain why and fix it.

```python
class Session:
    count = 0

    def __init__(self, user):
        self.user = user
        self.count += 1


Session("max")
Session("olena")
print(Session.count)
```

## Solutions

### Exercise 1

```python
class Book:
    def __init__(self, title, author):
        self.title = title
        self.author = author

    def describe(self):
        return f"'{self.title}' by {self.author}"


dune = Book("Dune", "Frank Herbert")
hobbit = Book("The Hobbit", "J. R. R. Tolkien")
print(dune.describe())
print(hobbit.describe())
```

Output:

```text
'Dune' by Frank Herbert
'The Hobbit' by J. R. R. Tolkien
```

### Exercise 2

```python
class Book:
    total = 0

    def __init__(self, title, author):
        self.title = title
        self.author = author
        Book.total += 1

    def describe(self):
        return f"'{self.title}' by {self.author}"

    @classmethod
    def from_string(cls, text):
        title, author = text.split(";")
        return cls(title, author)


dune = Book("Dune", "Frank Herbert")
kobzar = Book.from_string("Kobzar;Taras Shevchenko")
print(dune.describe())
print(kobzar.describe())
print(Book.total)
```

Output:

```text
'Dune' by Frank Herbert
'Kobzar' by Taras Shevchenko
2
```

`from_string()` only parses the text and then delegates to `cls(...)`, so `__init__` still runs and the counter still increases.

### Exercise 3

```python
class Book:
    total = 0

    def __init__(self, title, author):
        self.title = title
        self.author = author
        Book.total += 1

    def describe(self):
        return f"'{self.title}' by {self.author}"

    @classmethod
    def from_string(cls, text, *args):
        title, author = text.split(";")
        return cls(title, author, *args)


class EBook(Book):
    def __init__(self, title, author, size_mb=1.0):
        super().__init__(title, author)
        self.size_mb = size_mb

    def describe(self):
        return super().describe() + f" [{self.size_mb} MB]"


library = [Book("The Hobbit", "J. R. R. Tolkien"), EBook("Dune", "Frank Herbert", 2.5)]
for book in library:
    print(book.describe())

ebook = EBook.from_string("Kobzar;Taras Shevchenko", 0.8)
print(type(ebook).__name__, "-", ebook.describe())
print(Book.total)
```

Output:

```text
'The Hobbit' by J. R. R. Tolkien
'Dune' by Frank Herbert [2.5 MB]
EBook - 'Kobzar' by Taras Shevchenko [0.8 MB]
3
```

Because `from_string()` uses `cls`, calling it on `EBook` creates an `EBook`. The extra `*args` are forwarded to the subclass's `__init__`.

### Exercise 4

`self.count += 1` means `self.count = self.count + 1`. Reading `self.count` finds the class attribute (`0`), but the assignment creates a new **instance** attribute `count` on that one session. `Session.count` stays `0`. Assign through the class instead:

```python
class Session:
    count = 0

    def __init__(self, user):
        self.user = user
        Session.count += 1


Session("max")
Session("olena")
print(Session.count)
```

Output:

```text
2
```

---

*Source: [pythontutorial.net — Python Object-oriented Programming](https://www.pythontutorial.net/python-oop/python-object-oriented-programming/). Adapted and expanded for PyJourney.*
