# Instance Variables

**Instance variables**, also called instance attributes, hold the data that belongs to one specific object. Two instances of the same class can store completely different values in them. This topic shows where Python keeps instance variables, how attribute lookup moves from the instance to its class, and what happens when an instance variable and a class variable share a name.

## What you'll learn

- The difference between class variables and instance variables
- Where instance variables live: each instance's own `__dict__`
- How Python looks up an attribute: first the instance, then the class
- How an instance variable shadows a class variable, and how `del` uncovers it again
- Why instance variables should be created in `__init__`
- How to inspect instance variables with `vars()`, `__dict__` and `__static_attributes__`

## Class variables and instance variables

Class variables are bound to the class and shared by all instances. Instance variables are bound to one particular instance. Start with a class that has only class variables:

```python
from pprint import pprint


class HtmlDocument:
    version = 5
    extension = "html"


pprint(HtmlDocument.__dict__)
print(HtmlDocument.extension)
print(HtmlDocument.version)
```

Output (Python 3.14):

```text
mappingproxy({'__dict__': <attribute '__dict__' of 'HtmlDocument' objects>,
              '__doc__': None,
              '__firstlineno__': 4,
              '__module__': '__main__',
              '__static_attributes__': (),
              '__weakref__': <attribute '__weakref__' of 'HtmlDocument' objects>,
              'extension': 'html',
              'version': 5})
html
5
```

The two class variables, `extension` and `version`, are stored in the class's `__dict__`. When you access them through the class, Python looks them up there.

## Each instance has its own `__dict__`

Now create an instance. It gets its own `__dict__`, separate from the class's one:

```python
class HtmlDocument:
    version = 5
    extension = "html"


home = HtmlDocument()
print(home.__dict__)
print(type(home.__dict__))
print(vars(home) is home.__dict__)
```

Output:

```text
{}
<class 'dict'>
True
```

- The instance's `__dict__` is **empty**: `home` has no instance variables yet.
- Unlike the class's read-only `mappingproxy`, an instance's `__dict__` is an ordinary, mutable `dict`.
- The built-in `vars(obj)` returns that same dictionary. It is the tidier way to look inside an object.

`home.__dict__` stores the instance variables of `home`, just as `HtmlDocument.__dict__` stores the class variables of `HtmlDocument`.

## How attribute lookup works

Even though `home.__dict__` is empty, reading class variables through the instance works:

```python
class HtmlDocument:
    version = 5
    extension = "html"


home = HtmlDocument()
print(home.extension)
print(home.version)
```

Output:

```text
html
5
```

When you read `home.version`, Python searches in this order:

```text
home.version
  1. home.__dict__           {}                     -> not here
  2. HtmlDocument.__dict__   {'version': 5, ...}    -> found: 5
  3. parent classes          (only if still not found)
  4. nothing found           -> AttributeError
```

The search **stops at the first match**. If the instance has its own variable with that name, the class is never consulted.

## Shadowing a class variable

Assigning through an instance always creates (or updates) an **instance** variable. It never touches the class:

```python
class HtmlDocument:
    version = 5
    extension = "html"


home = HtmlDocument()
about = HtmlDocument()

home.version = 6
print(home.__dict__)
print(home.version)
print(about.version)
print(HtmlDocument.version)
```

Output:

```text
{'version': 6}
6
5
5
```

`home.__dict__` now contains `version`, so the lookup stops at step 1 and returns `6`. The instance variable **shadows** (hides) the class variable for `home` only. `about` and the class still see `5`.

Deleting the instance variable uncovers the class variable again. Changes to the class are visible through every instance that does not shadow the name:

```python
class HtmlDocument:
    version = 5
    extension = "html"


home = HtmlDocument()
about = HtmlDocument()
home.version = 6

HtmlDocument.version = 7
print(home.version, about.version)

del home.version
print(home.version, about.version)

HtmlDocument.media_type = "text/html"
print(home.media_type)
```

Output:

```text
6 7
7 7
text/html
```

While `home` shadowed `version`, the class change to `7` was invisible through `home`. After `del home.version`, the lookup falls through to the class again. A class variable added later (`media_type`) is visible from existing instances too, because lookup happens at the moment of access.

## Initializing instance variables in `__init__`

In practice you create the instance variables that every object needs in `__init__`. Each call gets its own `self`, so each object gets its own values:

```python
class HtmlDocument:
    version = 5
    extension = "html"

    def __init__(self, name, contents):
        self.name = name
        self.contents = contents


blank = HtmlDocument("Blank", "")
about = HtmlDocument("About", "<h1>About us</h1>")

print(vars(blank))
print(vars(about))
print(about.name, about.extension)
```

Output:

```text
{'name': 'Blank', 'contents': ''}
{'name': 'About', 'contents': '<h1>About us</h1>'}
About html
```

When creating an `HtmlDocument`, you must now pass the arguments `__init__` expects. Instance variables (`name`, `contents`) live in each object, and class variables (`version`, `extension`) stay in the class, shared.

### Why `__init__` is the right place

Python lets you add attributes to an object anywhere, at any time:

```python
class HtmlDocument:
    def __init__(self, name):
        self.name = name


blank = HtmlDocument("Blank")
blank.author = "Olena"
print(vars(blank))

about = HtmlDocument("About")
print(hasattr(about, "author"))
```

Output:

```text
{'name': 'Blank', 'author': 'Olena'}
False
```

This flexibility has a cost: now some documents have an `author` and some do not, and any code reading `doc.author` may crash. Creating every instance variable in `__init__` gives you:

- **Predictability.** Every instance has the same set of attributes from the start. If a value is not known yet, set it to `None`.
- **Readability.** A reader finds all of an object's data in one place.
- **Tool support.** Linters (for example pylint's `attribute-defined-outside-init`) and IDE autocompletion understand attributes defined in `__init__`.
- **Memory efficiency.** CPython lets instances that receive the same attributes in the same order share the key table of their `__dict__` (key-sharing dictionaries, PEP 412).

### Listing the attributes a class assigns

Since Python 3.13, every class records the names its methods assign through `self`. It is a handy way to see which instance variables a class *can* create, even ones set outside `__init__`:

```python
class HtmlDocument:
    def __init__(self, name, contents):
        self.name = name
        self.contents = contents

    def publish(self):
        self.published = True


print(HtmlDocument.__static_attributes__)
```

Output (Python 3.13+):

```text
('contents', 'name', 'published')
```

## Assignment vs. mutation: the shared list trap

Shadowing happens only on **assignment**. Mutating a mutable class variable through an instance does not create an instance variable. It changes the one object shared by everybody:

```python
class Team:
    members = []  # one list for the whole class

    def __init__(self, name):
        self.name = name

    def add(self, person):
        self.members.append(person)  # mutates Team.members


red = Team("Red")
blue = Team("Blue")
red.add("Olena")
print(blue.members)
print(vars(red))
```

Output:

```text
['Olena']
{'name': 'Red'}
```

`self.members` finds the class variable, and `append()` modifies it in place. `vars(red)` shows that no instance variable was created. The fix is to give each instance its own list in `__init__`:

```python
class Team:
    def __init__(self, name):
        self.name = name
        self.members = []

    def add(self, person):
        self.members.append(person)


red = Team("Red")
blue = Team("Blue")
red.add("Olena")
print(red.members, blue.members)
```

Output:

```text
['Olena'] []
```

> **Note:** A class can declare `__slots__ = ("x", "y")` to replace the per-instance `__dict__` with a fixed set of attribute slots. Such instances use less memory but cannot receive new attributes: assigning `p.z = 3` raises `AttributeError: 'Point' object has no attribute 'z' and no __dict__ for setting new attributes`. Slots are covered in a later topic.

## Common mistakes

- **Expecting assignment through an instance to change the class variable.** `home.version = 6` shadows the class variable for `home` only. Change shared values through the class: `HtmlDocument.version = 6`.

- **Keeping per-instance data in a mutable class variable.** Lists, dicts and sets defined in the class body are shared. Create them in `__init__`.

- **Creating attributes outside `__init__`.** An attribute set only in some method exists only after that method has run:

  ```python
  class User:
      def __init__(self, name):
          self.name = name

      def log_in(self):
          self.last_login = "2026-11-25"


  user = User("max")
  print(user.last_login)
  ```

  Output:

  ```text
  Traceback (most recent call last):
    ...
  AttributeError: 'User' object has no attribute 'last_login'
  ```

  Add `self.last_login = None` to `__init__` instead.

- **Typos create new attributes.** `doc.contnets = "..."` silently adds a misspelled attribute, and `doc.contents` keeps its old value.

- **Reading attributes through `obj.__dict__`.** It contains only instance variables. `home.__dict__["extension"]` raises `KeyError` even though `home.extension` works. Use normal dot notation or `getattr()` to read, and `vars()` only to inspect.

## Summary

- Instance variables belong to one object. Class variables belong to the class and are shared.
- Each instance stores its variables in its own `__dict__`, an ordinary mutable `dict`. `vars(obj)` returns it.
- Reading `obj.name` checks the instance's `__dict__` first, then the class (and its parents), and raises `AttributeError` if nothing is found.
- Assigning `obj.name = value` always creates or updates an instance variable. If the class has a variable with that name, the instance variable shadows it. `del obj.name` uncovers it again.
- Mutating a mutable class variable through `self` changes the shared object for everyone.
- Create every instance variable in `__init__`, using `None` for values that are not known yet.

## Practice

### Exercise 1: Predict the output

Write down what each `print()` shows, then run the code.

```python
class Config:
    debug = False
    level = 1


a = Config()
b = Config()
a.debug = True
Config.level = 2
print(a.debug, b.debug, Config.debug)
print(a.level, b.level)
print(vars(a), vars(b))
del a.debug
print(a.debug)
```

### Exercise 2: Where does it come from?

Write a function `where(obj, name)` that returns:

- `"instance"` if `name` is an instance variable of `obj`;
- `"class"` if it is not an instance variable but can be found on the object's class;
- `"missing"` otherwise.

Test it on an `HtmlDocument` with a class variable `extension`, an instance variable `name`, a shadowed `version`, and a name that does not exist.

### Exercise 3: Fix the inventory

Every warehouse below shows the products of all warehouses. Fix the class so that each warehouse has its own stock, then show that adding to one warehouse does not affect the other.

```python
class Warehouse:
    stock = {}

    def __init__(self, city):
        self.city = city

    def add(self, product, quantity):
        self.stock[product] = self.stock.get(product, 0) + quantity


kyiv = Warehouse("Kyiv")
lviv = Warehouse("Lviv")
kyiv.add("laptop", 5)
print(lviv.stock)
```

### Exercise 4: Compare two objects

Write a function `diff(a, b)` that compares the **instance variables** of two objects and returns a dictionary `{name: (value_in_a, value_in_b)}` for every name whose values differ. A name missing on one side should appear with `None` for that side. Test it with two `Person` objects that have `name`, `age` and `city`, where one of them also has an extra `email` attribute.

## Solutions

### Exercise 1

Output:

```text
True False False
2 2
{'debug': True} {}
False
```

- `a.debug = True` creates an instance variable on `a` only.
- `Config.level = 2` changes the class variable, and neither instance shadows `level`, so both see `2`.
- `vars()` shows that only `a` has an instance variable.
- After `del a.debug`, the lookup reaches the class again and finds `False`.

### Exercise 2

```python
class HtmlDocument:
    extension = "html"
    version = 5

    def __init__(self, name):
        self.name = name


def where(obj, name):
    if name in vars(obj):
        return "instance"
    if hasattr(type(obj), name):
        return "class"
    return "missing"


doc = HtmlDocument("About")
doc.version = 6

for attr in ["extension", "name", "version", "author"]:
    print(attr, "->", where(doc, attr))
```

Output:

```text
extension -> class
name -> instance
version -> instance
author -> missing
```

`version` exists in both places, and the function reports `"instance"`, matching the order in which Python itself looks it up.

### Exercise 3

```python
class Warehouse:
    def __init__(self, city):
        self.city = city
        self.stock = {}

    def add(self, product, quantity):
        self.stock[product] = self.stock.get(product, 0) + quantity


kyiv = Warehouse("Kyiv")
lviv = Warehouse("Lviv")
kyiv.add("laptop", 5)
kyiv.add("laptop", 2)
lviv.add("phone", 3)
print(kyiv.stock)
print(lviv.stock)
```

Output:

```text
{'laptop': 7}
{'phone': 3}
```

The original `stock = {}` was one dictionary shared through the class, and `self.stock[product] = ...` mutated it instead of creating an instance variable. Creating the dictionary in `__init__` gives every warehouse its own.

### Exercise 4

```python
class Person:
    def __init__(self, name, age, city):
        self.name = name
        self.age = age
        self.city = city


def diff(a, b):
    left, right = vars(a), vars(b)
    result = {}
    for name in sorted(left.keys() | right.keys()):
        value_a = left.get(name)
        value_b = right.get(name)
        if value_a != value_b:
            result[name] = (value_a, value_b)
    return result


first = Person("Olena", 30, "Kyiv")
second = Person("Olena", 31, "Lviv")
second.email = "olena@example.com"
print(diff(first, second))
```

Output:

```text
{'age': (30, 31), 'city': ('Kyiv', 'Lviv'), 'email': (None, 'olena@example.com')}
```

`vars()` gives each object's instance variables as a dictionary, and `|` on the two key views produces the union of all names. Sorting makes the output order predictable.

---

*Source: [pythontutorial.net — Python Instance Variables](https://www.pythontutorial.net/python-oop/python-instance-variables/). Adapted and expanded for PyJourney.*
