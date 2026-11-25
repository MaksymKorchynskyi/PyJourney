# __str__

When you `print()` an object of your own class, Python shows something like `<__main__.Person object at 0x...>`, which is useless to a reader. The special method `__str__` lets a class decide how its instances look as text, so `print()`, `str()` and f-strings produce something meaningful.

## What you'll learn

- What the default text form of an object looks like and where it comes from
- How to implement `__str__` and what it should return
- Which built-in operations call `__str__`: `str()`, `print()`, f-strings, `format()` and `%s`
- Why lists and dicts ignore your `__str__` when they are printed
- The rules a correct `__str__` must follow, and the errors you get when you break them
- How to write a `__str__` that also works for subclasses

## The default string representation

Start with a plain class that has three instance attributes:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age


person = Person("John", "Doe", 25)
print(person)
```

Output (the address varies on every run):

```text
<__main__.Person object at 0x1026cd160>
```

The class does not say how to turn itself into text, so Python uses the generic version inherited from `object`. It contains the module (`__main__`), the class name and the object's memory address. That is enough to tell two objects apart while debugging, but it says nothing about the person.

## Implementing `__str__`

`__str__` is an instance method with no parameters besides `self`. It must **return** a string:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __str__(self):
        return f"Person({self.first_name},{self.last_name},{self.age})"


person = Person("John", "Doe", 25)
print(person)
```

Output:

```text
Person(John,Doe,25)
```

This works, but the text looks like a constructor call, and that style is the convention for `__repr__` (the next topic). `__str__` is meant for **end users**: it should read naturally, like something you would show in a UI, a report or a log message.

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __str__(self):
        return f"{self.first_name} {self.last_name}, {self.age} years old"


person = Person("John", "Doe", 25)
print(person)
```

Output:

```text
John Doe, 25 years old
```

> **Tip:** Ask yourself: "If a user saw this object on screen, what would they expect to read?" That is your `__str__`.

## Who calls `__str__`

You almost never call `person.__str__()` directly. Built-in operations call it for you. `str` is a built-in type, and `str(obj)` asks the object's class for its `__str__` method. Every other operation below goes through the same mechanism:

| Operation | What happens |
|---|---|
| `str(person)` | calls `__str__` |
| `print(person)` | converts every positional argument with `str()` |
| `f"{person}"` | calls `format(person, "")`, which falls back to `str(person)` |
| `"{}".format(person)` | same as the f-string |
| `"%s" % person` | calls `str(person)` |

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __str__(self):
        return f"{self.first_name} {self.last_name}, {self.age} years old"


person = Person("John", "Doe", 25)

print(str(person))
print(person)
print(f"Customer: {person}")
print("Customer: {}".format(person))
print("Customer: %s" % person)
print(person, "has logged in")
```

Output:

```text
John Doe, 25 years old
John Doe, 25 years old
Customer: John Doe, 25 years old
Customer: John Doe, 25 years old
Customer: John Doe, 25 years old
John Doe, 25 years old has logged in
```

## Containers do not use `__str__`

A common surprise: put the object into a list or a dict and print the container.

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __str__(self):
        return f"{self.first_name} {self.last_name}, {self.age} years old"


person = Person("John", "Doe", 25)
print([person])
print({"owner": person})
```

Output (the address varies):

```text
[<__main__.Person object at 0x100ac1160>]
{'owner': <__main__.Person object at 0x100ac1160>}
```

`str()` of a list builds its text from the **`repr()`** of each element, not from `str()`. That is deliberate: `["1", 1]` must not look like `[1, 1]`. To control this output you implement `__repr__`, which is covered in the next topic. If you only need a readable list right now, convert the items yourself:

```python
people = ["John Doe, 25 years old", "Jane Roe, 31 years old"]
print(", ".join(people))  # John Doe, 25 years old, Jane Roe, 31 years old
```

## Rules for a correct `__str__`

### It must return a `str`

Returning anything else raises `TypeError` when `str()` is called:

```python
class Score:
    def __init__(self, points):
        self.points = points

    def __str__(self):
        return self.points  # an int, not a str


try:
    print(Score(42))
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
TypeError: __str__ returned non-string (type int)
```

The fix is `return str(self.points)` or, better, a descriptive f-string such as `f"{self.points} points"`.

### It must not print

A very common beginner bug is printing inside `__str__` instead of returning. The method then returns `None`, and the caller fails:

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    def __str__(self):
        print(f"{self.name}: {self.price} UAH")  # prints, returns None


try:
    print(Product("Tea", 85))
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
Tea: 85 UAH
TypeError: __str__ returned non-string (type NoneType)
```

The text appears once as a side effect, and then the real `print()` call crashes.

### It must not convert `self` to `str`

Inside `__str__`, the expressions `str(self)`, `f"{self}"` and `print(self)` call `__str__` again, which calls it again, and so on:

```python
class Node:
    def __str__(self):
        return f"Node: {self}"  # calls __str__ again


try:
    str(Node())
except RecursionError as error:
    print("RecursionError:", error)
```

Output:

```text
RecursionError: maximum recursion depth exceeded
```

Build the string from the object's **attributes** instead.

### Keep it fast and safe

`print()` calls and log statements happen in many places, sometimes while handling an error. A `__str__` that runs a database query, mutates the object or can raise an exception makes debugging much harder. Keep it a cheap, read-only formatting of data the object already has.

## Special methods are looked up on the class

Python looks up special methods on the object's **type**, not on the instance. Attaching a function to a single object does not change how `str()` sees it:

```python
class Person:
    pass


person = Person()
person.__str__ = lambda: "instance-level text"

print(person.__str__())  # a normal attribute call works
print(str(person))       # str() ignores the instance attribute
```

Output (the address varies):

```text
instance-level text
<__main__.Person object at 0x104bc1160>
```

Always define `__str__` inside the class body.

## `__str__` and inheritance

Subclasses inherit `__str__` like any other method. If you hard-code the class name in the text, every subclass will show the wrong name. Use `type(self).__name__` to get the name of the actual class:

```python
class Animal:
    def __init__(self, name):
        self.name = name

    def __str__(self):
        return f"{type(self).__name__} named {self.name}"


class Dog(Animal):
    pass


class Cat(Animal):
    pass


print(Animal("Generic"))
print(Dog("Rex"))
print(Cat("Tom"))
```

Output:

```text
Animal named Generic
Dog named Rex
Cat named Tom
```

## Edge case: format specs in f-strings

`__str__` gives you the plain text. A **format spec** after a colon, like `:>30`, is handled by a different special method, `__format__`. The default `object.__format__` refuses any non-empty spec:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __str__(self):
        return f"{self.first_name} {self.last_name}, {self.age} years old"


person = Person("John", "Doe", 25)

try:
    print(f"[{person:>30}]")
except TypeError as error:
    print("TypeError:", error)

print(f"[{person!s:>30}]")
```

Output:

```text
TypeError: unsupported format string passed to Person.__format__
[        John Doe, 25 years old]
```

The `!s` conversion first turns the object into a string with `str()`, and only then applies `>30` to that string. Writing `str(person)` inside the braces does the same.

## Common mistakes

- **Printing instead of returning.** `__str__` must `return` the text. If it prints, it returns `None` and you get `TypeError: __str__ returned non-string (type NoneType)`.
- **Returning a non-string.** `return self.age` fails. Wrap it: `return f"{self.age}"`.
- **Calling `str(self)` or using `f"{self}"` inside `__str__`.** This causes infinite recursion and a `RecursionError`.
- **Expecting `print(my_list)` to use `__str__`.** Containers show their items with `repr()`. Implement `__repr__` too, or join the `str()` of the items yourself.
- **Using a format spec directly on the object.** `f"{obj:>10}"` raises `TypeError` unless the class implements `__format__`. Use `f"{obj!s:>10}"`.
- **Putting `__str__` on an instance.** `obj.__str__ = ...` is ignored by `str()` and `print()`. Define it in the class.

## Summary

- Without `__str__`, an object prints as `<module.ClassName object at 0x...>`.
- `__str__(self)` returns a human-friendly `str` describing the object.
- `str()`, `print()`, f-strings, `str.format()` and `%s` all go through `__str__`.
- Lists, dicts and other containers display their items with `repr()`, not `str()`.
- `__str__` must return a `str`, must not print, and must not call `str(self)`.
- Special methods are looked up on the class, so define `__str__` in the class body.
- Use `type(self).__name__` so the text stays correct in subclasses.

## Practice

### Exercise 1: A readable book

Write a `Book` class with `title`, `author` and `year` attributes. `print(Book("Kobzar", "Taras Shevchenko", 1840))` must print:

```text
"Kobzar" by Taras Shevchenko (1840)
```

Then use the book inside an f-string: `f"Now reading: {book}"`.

### Exercise 2: Fix the broken `__str__`

This code prints the text once and then crashes. Explain why and fix it so that `print(Product("Tea", 85))` prints `Tea: 85 UAH` exactly once.

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    def __str__(self):
        print(f"{self.name}: {self.price} UAH")


print(Product("Tea", 85))
```

### Exercise 3: Aligned temperatures

Write a `Temperature` class that stores degrees Celsius. Its `__str__` must show one decimal place and the unit `C`, for example `21.5 C`. Then print the readings `21.456`, `-3` and `100` right-aligned in a column 8 characters wide, each wrapped in square brackets.

### Exercise 4: A multi-line receipt

Write a `Cart` class with an `add(name, price)` method. Its `__str__` must return `Cart is empty` for an empty cart. Otherwise it returns a receipt: one line per item (name left-aligned in 10 characters, price right-aligned in 8 characters with 2 decimals), a separator line of 18 dashes, and a `Total` line in the same format.

## Solutions

### Exercise 1

```python
class Book:
    def __init__(self, title, author, year):
        self.title = title
        self.author = author
        self.year = year

    def __str__(self):
        return f'"{self.title}" by {self.author} ({self.year})'


book = Book("Kobzar", "Taras Shevchenko", 1840)
print(book)
print(f"Now reading: {book}")
```

Output:

```text
"Kobzar" by Taras Shevchenko (1840)
Now reading: "Kobzar" by Taras Shevchenko (1840)
```

### Exercise 2

`__str__` printed the text and then implicitly returned `None`. `print()` called `str()` on the object, received `None` instead of a string and raised `TypeError: __str__ returned non-string (type NoneType)`. The fix is to return the string:

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    def __str__(self):
        return f"{self.name}: {self.price} UAH"


print(Product("Tea", 85))
```

Output:

```text
Tea: 85 UAH
```

### Exercise 3

```python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    def __str__(self):
        return f"{self.celsius:.1f} C"


readings = [Temperature(21.456), Temperature(-3), Temperature(100)]
for t in readings:
    print(f"[{t!s:>8}]")
```

Output:

```text
[  21.5 C]
[  -3.0 C]
[ 100.0 C]
```

`!s` converts each object to a string first, so the `>8` alignment applies to that string. Without `!s`, `f"{t:>8}"` would raise `TypeError`.

### Exercise 4

```python
class Cart:
    def __init__(self):
        self.items = []

    def add(self, name, price):
        self.items.append((name, price))

    def __str__(self):
        if not self.items:
            return "Cart is empty"
        lines = [f"{name:<10}{price:>8.2f}" for name, price in self.items]
        total = sum(price for _, price in self.items)
        lines.append("-" * 18)
        lines.append(f"{'Total':<10}{total:>8.2f}")
        return "\n".join(lines)


cart = Cart()
print(cart)
cart.add("Coffee", 4.5)
cart.add("Croissant", 2.25)
cart.add("Juice", 3)
print(cart)
```

Output:

```text
Cart is empty
Coffee        4.50
Croissant     2.25
Juice         3.00
------------------
Total         9.75
```

`__str__` may return several lines. Build them in a list and join them with `"\n"` instead of printing line by line.

---

*Source: [pythontutorial.net — Python __str__](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__str__/). Adapted and expanded for PyJourney.*
