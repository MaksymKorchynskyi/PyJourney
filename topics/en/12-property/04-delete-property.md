# Delete Property

A property can control not only reading and writing but also **deletion**. When code runs `del obj.prop`, Python calls the property's **deleter**. You decide what "delete" means: remove the stored value, reset it to a default, clear a cache, close a resource, or forbid deletion altogether.

## What you'll learn

- What `del obj.attr` does for an ordinary attribute and for a property
- How to add a deleter with `@<name>.deleter` (or `property(fdel=...)`)
- What an object looks like after its property was deleted, and how to report it clearly
- Useful things a deleter can do besides deleting: resetting to a default, clearing a cache
- Why `del obj.prop` affects one instance, while `del Class.prop` removes the property itself
- What happens when a property has no deleter

## `del` on an ordinary attribute

For an ordinary attribute, `del obj.attr` removes the entry from the instance's `__dict__`. After that, reading the attribute fails:

```python
class Point:
    def __init__(self, x):
        self.x = x


p = Point(5)
del p.x
print(p.__dict__)

try:
    print(p.x)
except AttributeError as error:
    print("AttributeError:", error)
```

Output:

```text
{}
AttributeError: 'Point' object has no attribute 'x'
```

Any code can do this to any ordinary attribute, and the class has no say in it. A property changes that: deletion goes through a function you write, or it is not allowed at all.

## Adding a deleter

The deleter is the third function of a property, next to the getter and the setter. With decorators it is added by `@<name>.deleter`, which works exactly like `@<name>.setter` (see the topic @property Decorator):

```python
class Person:
    def __init__(self, name):
        self.name = name

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        if value.strip() == "":
            raise ValueError("The name cannot be empty")
        self._name = value

    @name.deleter
    def name(self):
        del self._name


person = Person("John")
print(person.__dict__)

del person.name  # calls the deleter
print(person.__dict__)
```

Output:

```text
{'_name': 'John'}
{}
```

`del person.name` did not remove anything from the class. Python found the property `name` in the class, saw that it has a deleter, and called it. The deleter then deleted the **instance** attribute `_name`, which held the actual data.

Without decorators, the same property is built by passing the deleter as `fdel`:

```python
class Person:
    def __init__(self, name):
        self._name = name

    def get_name(self):
        return self._name

    def del_name(self):
        del self._name

    name = property(get_name, fdel=del_name)


person = Person("John")
del person.name
print(person.__dict__)
print(Person.name.fdel.__name__)
```

Output:

```text
{}
del_name
```

### The property stays in the class

The class dictionary still contains exactly one entry for `name`, the property object. The deleter, the getter and the setter all live inside it:

```python
from pprint import pprint


class Person:
    def __init__(self, name):
        self.name = name

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        self._name = value

    @name.deleter
    def name(self):
        del self._name


pprint(Person.__dict__)
print(Person.name.fget.__name__, Person.name.fset.__name__, Person.name.fdel.__name__)
```

Output (Python 3.14; the addresses vary):

```text
mappingproxy({'__dict__': <attribute '__dict__' of 'Person' objects>,
              '__doc__': None,
              '__firstlineno__': 4,
              '__init__': <function Person.__init__ at 0x1051c5170>,
              '__module__': '__main__',
              '__static_attributes__': ('_name', 'name'),
              '__weakref__': <attribute '__weakref__' of 'Person' objects>,
              'name': <property object at 0x105144770>})
name name name
```

Because the property is untouched, the object can get a new value after a deletion. The setter simply creates `_name` again.

## Life after deletion

After `del person.name`, the getter runs into a missing `_name`:

```python
class Person:
    def __init__(self, name):
        self.name = name

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        if value.strip() == "":
            raise ValueError("The name cannot be empty")
        self._name = value

    @name.deleter
    def name(self):
        del self._name


person = Person("John")
del person.name

try:
    print(person.name)
except AttributeError as error:
    print("AttributeError:", error)

print(hasattr(person, "name"))

try:
    del person.name
except AttributeError as error:
    print("AttributeError:", error)

person.name = "Jane"
print(person.name)
```

Output:

```text
AttributeError: 'Person' object has no attribute '_name'
False
AttributeError: 'Person' object has no attribute '_name'
Jane
```

Several things are going on here:

- Reading the deleted property raises `AttributeError`. This is the right exception type: it makes `hasattr()` and `getattr(obj, name, default)` work correctly.
- The message, however, mentions `_name`, an internal detail that the user of the class never wrote.
- Deleting twice fails too, because the deleter tries to delete `_name` again.
- Assigning a new value works, because the setter creates `_name` again.

To give a clearer message, catch the internal error in the getter and raise your own `AttributeError`:

```python
class Person:
    def __init__(self, name):
        self.name = name

    @property
    def name(self):
        try:
            return self._name
        except AttributeError:
            raise AttributeError("The name has been deleted") from None

    @name.setter
    def name(self, value):
        self._name = value

    @name.deleter
    def name(self):
        del self._name


person = Person("John")
del person.name

try:
    print(person.name)
except AttributeError as error:
    print("AttributeError:", error)
print(getattr(person, "name", "<no name>"))
```

Output:

```text
AttributeError: The name has been deleted
<no name>
```

`from None` hides the original `_name` error from the traceback, so the user sees only the message that makes sense to them.

## Deleting as "reset"

"Delete" doesn't have to mean "remove". A common, practical use of a deleter is to **reset** a value to its default. Think of a setting that the user may override, and `del` restores the default:

```python
class Settings:
    DEFAULT_THEME = "light"

    def __init__(self):
        self._theme = None  # None means "not set by the user"

    @property
    def theme(self):
        if self._theme is None:
            return self.DEFAULT_THEME
        return self._theme

    @theme.setter
    def theme(self, value):
        if value not in ("light", "dark"):
            raise ValueError(f"Unknown theme: {value!r}")
        self._theme = value

    @theme.deleter
    def theme(self):
        self._theme = None


settings = Settings()
print(settings.theme)

settings.theme = "dark"
print(settings.theme)

del settings.theme
print(settings.theme)

del settings.theme  # resetting twice is harmless
print(settings.theme, settings.__dict__)
```

Output:

```text
light
dark
light
light {'_theme': None}
```

Here the deleter never deletes anything. It clears the user's choice, and the getter falls back to the default. Because it only assigns `None`, deleting twice is safe, which is often more convenient than raising an error.

Another frequent use is clearing a cache: `del report.total` can mean "forget the cached value and compute it again on the next read", just like `del obj.attr` does for `functools.cached_property` (see the topic Readonly Property). You will build such a property in the exercises.

## Deleting from the instance vs. from the class

The deleter runs only when you delete the attribute through an **instance**. It affects that instance's data and nothing else:

```python
class Person:
    def __init__(self, name):
        self.name = name

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        if value.strip() == "":
            raise ValueError("The name cannot be empty")
        self._name = value

    @name.deleter
    def name(self):
        del self._name


john = Person("John")
jane = Person("Jane")

del john.name
print(john.__dict__, jane.__dict__)

del Person.name  # removes the property itself from the class
print("name" in Person.__dict__)

jane.name = ""   # no property any more: no validation
print(jane.__dict__)
```

Output:

```text
{} {'_name': 'Jane'}
False
{'_name': 'Jane', 'name': ''}
```

- `del john.name` called the deleter for `john` only. `jane` still has her name.
- `del Person.name` is an ordinary deletion of a **class attribute**. The deleter is *not* called; the whole property object disappears from the class.
- After that, `jane.name = ""` creates a plain instance attribute: no setter, no validation. You almost never want this, so don't delete properties from classes.

## Properties without a deleter

If a property has no deleter, `del` fails, even when the property has a setter:

```python
class Account:
    def __init__(self, owner):
        self.owner = owner

    @property
    def owner(self):
        return self._owner

    @owner.setter
    def owner(self, value):
        self._owner = value


account = Account("Ann")
try:
    del account.owner
except AttributeError as error:
    print("AttributeError:", error)
print(account.owner)
```

Output (Python 3.11+; older versions say `can't delete attribute`):

```text
AttributeError: property 'owner' of 'Account' object has no deleter
Ann
```

This is a useful default. An ordinary attribute can be deleted by anyone, which can leave an object half-broken. A property makes deletion **opt-in**: it is possible only if the class author wrote a deleter, so add one only when deleting has a clear meaning for your class.

## Common mistakes

- **Deleting the property itself inside the deleter.** `del self.name` inside the `name` deleter calls the same deleter again, forever:

  ```python
  class Person:
      def __init__(self, name):
          self._name = name

      @property
      def name(self):
          return self._name

      @name.deleter
      def name(self):
          del self.name  # bug: should be del self._name


  try:
      del Person("John").name
  except RecursionError as error:
      print("RecursionError:", error)
  ```

  Output:

  ```text
  RecursionError: maximum recursion depth exceeded
  ```

  Delete the underlying attribute: `del self._name`.

- **Giving the deleter a different name.** As with setters, `@name.deleter` must decorate a method called `name`. Otherwise a second property appears under the other name, and `name` still has no deleter.
- **Leaking internal names in errors.** After a deletion the getter fails with `... has no attribute '_name'`. If users may read a deleted property, raise your own `AttributeError` with a clear message.
- **Raising the wrong exception for a missing value.** If the getter raises `KeyError` or `ValueError` instead of `AttributeError`, `hasattr()` and `getattr(obj, name, default)` stop working and raise that error instead.
- **Deleting the property from the class.** `del Person.name` removes the property for every instance and silently turns validated assignments into plain ones.
- **Adding a deleter "just in case".** Without a deleter, deletion is forbidden, which is usually what you want.

## Summary

- `del obj.prop` on a property calls its deleter (`fdel`); without a deleter it raises `AttributeError: property '...' of '...' object has no deleter`.
- Add a deleter with `@prop.deleter` on a method named like the property, or with `property(fget, fset, fdel)`.
- The deleter usually deletes or resets the underlying attribute (`_name`); the property object stays in the class, so the setter can store a new value later.
- After deletion, make the getter raise a clear `AttributeError`, which keeps `hasattr()` and `getattr()` working.
- A deleter can reset a value to a default or clear a cache instead of removing anything.
- `del instance.prop` affects one instance; `del Class.prop` removes the whole property and its validation.

## Practice

### Exercise 1: An optional phone number

Write a `Contact` class with a `name` (plain attribute) and an optional `phone` property:

- `Contact("Ann")` has no phone, and `contact.phone` returns `None`;
- the setter removes spaces and raises `ValueError("Phone must contain 10 digits")` unless exactly 10 digits remain;
- `del contact.phone` removes the number, so `contact.phone` returns `None` again. Deleting a missing number must not fail.

### Exercise 2: A cache you can clear

Write a `Report` class that receives a list of numbers `rows`. Add a read-only property `total` that computes `sum(rows)` on the first read, prints `"summing..."` when it really computes, and caches the result. Add a deleter that clears the cache, so the next read computes again. Show that after `report.rows.append(...)` the old total is returned until you run `del report.total`.

### Exercise 3: Predict the output

Predict every line, then run the code.

```python
class Box:
    def __init__(self, label):
        self.label = label

    @property
    def label(self):
        return self._label

    @label.setter
    def label(self, value):
        self._label = value.upper()

    @label.deleter
    def label(self):
        print("deleting", self._label)
        del self._label


box = Box("fragile")
print(box.label)
del box.label
print(hasattr(box, "label"), box.__dict__)
box.label = "glass"
print(box.label)
print(type(Box.__dict__["label"]).__name__)
```

### Exercise 4: Closing a lazy connection

A fake connection class is given:

```python
class Connection:
    def __init__(self, url):
        self.url = url
        print(f"open {url}")

    def close(self):
        print(f"close {self.url}")
```

Write a `Client(url)` class with a `connection` property:

- the connection is opened lazily, on the first read, and later reads return the same object;
- `del client.connection` closes the connection, and the next read opens a new one;
- deleting when no connection is open does nothing.

## Solutions

### Exercise 1

```python
class Contact:
    def __init__(self, name, phone=None):
        self.name = name
        self._phone = None
        if phone is not None:
            self.phone = phone

    @property
    def phone(self):
        return self._phone

    @phone.setter
    def phone(self, value):
        digits = value.replace(" ", "")
        if len(digits) != 10 or not digits.isdigit():
            raise ValueError("Phone must contain 10 digits")
        self._phone = digits

    @phone.deleter
    def phone(self):
        self._phone = None


ann = Contact("Ann")
print(ann.phone)

ann.phone = "067 123 45 67"
print(ann.phone)

try:
    ann.phone = "12-34"
except ValueError as error:
    print("ValueError:", error)

del ann.phone
del ann.phone  # deleting a missing number is fine
print(ann.phone)
```

Output:

```text
None
0671234567
ValueError: Phone must contain 10 digits
None
```

Setting `_phone = None` instead of deleting it keeps the getter simple and makes the deleter safe to call any number of times.

### Exercise 2

```python
class Report:
    def __init__(self, rows):
        self.rows = rows
        self._total = None

    @property
    def total(self):
        if self._total is None:
            print("summing...")
            self._total = sum(self.rows)
        return self._total

    @total.deleter
    def total(self):
        self._total = None


report = Report([10, 20, 30])
print(report.total)
print(report.total)

report.rows.append(40)
print(report.total)  # stale value

del report.total
print(report.total)

try:
    report.total = 0
except AttributeError as error:
    print("AttributeError:", error)
```

Output:

```text
summing...
60
60
60
summing...
100
AttributeError: property 'total' of 'Report' object has no setter
```

The property has a getter and a deleter but no setter: users can read the total and ask for it to be recomputed, but they cannot assign a fake total.

### Exercise 3

Output:

```text
FRAGILE
deleting FRAGILE
False {}
GLASS
property
```

- The setter stores labels in upper case, so `box.label` is `"FRAGILE"`.
- `del box.label` calls the deleter, which prints and deletes `_label`.
- The getter now raises `AttributeError`, so `hasattr()` returns `False`, and the instance dictionary is empty.
- The property still lives in the class, so assigning `"glass"` goes through the setter again.

### Exercise 4

```python
class Connection:
    def __init__(self, url):
        self.url = url
        print(f"open {url}")

    def close(self):
        print(f"close {self.url}")


class Client:
    def __init__(self, url):
        self._url = url
        self._connection = None

    @property
    def connection(self):
        if self._connection is None:
            self._connection = Connection(self._url)
        return self._connection

    @connection.deleter
    def connection(self):
        if self._connection is not None:
            self._connection.close()
            self._connection = None


client = Client("db://localhost")
print("client created")

first = client.connection
print(first is client.connection)

del client.connection
del client.connection  # nothing is open: no-op

second = client.connection
print(first is second)
```

Output:

```text
client created
open db://localhost
True
close db://localhost
open db://localhost
False
```

No connection is opened until the first read. The deleter releases the resource and resets the cache, so the next read opens a fresh connection.

---

*Source: [pythontutorial.net — How to Delete a Property from an Object in Python](https://www.pythontutorial.net/python-oop/python-delete-property/). Adapted and expanded for PyJourney.*
