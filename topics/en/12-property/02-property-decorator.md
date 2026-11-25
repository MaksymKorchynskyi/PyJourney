# @property Decorator

The `@property` decorator is the everyday way to create properties in Python. It does exactly what `property()` does, but you write the getter, setter and deleter as methods with the **same name** as the property, so the class has no extra `get_...()` and `set_...()` methods and reads like plain attribute access.

## What you'll learn

- How decorator syntax works and why `property` can be used as a decorator
- How `@property` turns a method into a getter-only property
- How `@<name>.setter` adds a setter, and why the getter and the setter must have the same name
- Why `setter()`, `getter()` and `deleter()` return a new property instead of changing the old one
- The standard pattern for a validated attribute, and how a subclass can replace only the setter
- Where the property's docstring comes from

## The redundancy problem

The topic Property showed how to build a property with the `property()` class:

```python
property(fget=None, fset=None, fdel=None, doc=None)
```

Here is a `Person` class with a getter-only `age` property built that way:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self._age = age

    def get_age(self):
        return self._age

    age = property(fget=get_age)


john = Person("John", 25)
print(john.age)
print(john.get_age())
```

Output:

```text
25
25
```

It works, but the class now offers **two** ways to read the same value: the `age` property and the `get_age()` method. Nobody needs both, and every extra public name is something to document, test and keep stable.

The fix is to give the getter function the same name as the property:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self._age = age

    def age(self):
        return self._age

    age = property(fget=age)


john = Person("John", 25)
print(john.age)
print(type(Person.__dict__["age"]).__name__)
```

Output:

```text
25
property
```

The line `age = property(fget=age)` evaluates the right-hand side first. At that moment `age` still refers to the function, so the function is passed to `property()`. Then the name `age` is **rebound** to the new property object. The plain function is no longer reachable under its own name, only through the property (`Person.age.fget`).

## Decorators in one minute

A **decorator** is a callable that receives a function and returns something to use in its place. The `@` syntax is a shortcut for exactly the rebinding you just saw:

```python
@decorator
def func():
    ...
```

means the same as:

```python
def func():
    ...


func = decorator(func)
```

`property` takes a function as its first argument (`fget`) and returns a property object, so it fits this shape perfectly. Note that a decorator does not have to return a function. The property object it returns is not even callable:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self._age = age

    @property
    def age(self):
        return self._age


john = Person("John", 25)
print(john.age)
print(callable(Person.age))
```

Output:

```text
25
False
```

`@property` above `def age` is exactly `age = property(age)`, written more compactly. Now the class has a single public name, `age`, and it reads like an attribute.

## Adding a setter with `@<name>.setter`

A property object has three methods that build a **new** property from the current one:

| Method | What the new property gets | Used for |
|---|---|---|
| `prop.getter(func)` | `func` as `fget` | `obj.prop` |
| `prop.setter(func)` | `func` as `fset` | `obj.prop = value` |
| `prop.deleter(func)` | `func` as `fdel` | `del obj.prop` |

Everything else (the other two functions and the docstring) is copied from the original. Let's add a setter step by step. First, without decorator syntax:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self._age = age

    @property
    def age(self):
        return self._age

    def set_age(self, value):
        if value <= 0:
            raise ValueError("The age must be positive")
        self._age = value

    age = age.setter(set_age)


john = Person("John", 25)
john.age = 26
print(john.age)
```

Output:

```text
26
```

`age.setter(set_age)` takes the getter-only property, makes a copy with `fset=set_age`, and the assignment rebinds `age` to that copy. The original property is not modified, as a quick experiment shows:

```python
def get_age(self):
    return self._age


def set_age(self, value):
    self._age = value


read_only = property(get_age)
read_write = read_only.setter(set_age)

print(read_only is read_write)
print(read_only.fset)
print(read_write.fset.__name__)
print(read_write.fget is read_only.fget)
```

Output:

```text
False
None
set_age
True
```

Since `setter()` takes a function and returns a replacement object, it can be used as a decorator too. The idiomatic version gives the setter **the same name** as the property:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    @property
    def age(self):
        return self._age

    @age.setter
    def age(self, value):
        if value <= 0:
            raise ValueError("The age must be positive")
        self._age = value


john = Person("John", 25)
john.age += 1
print(john.age)

try:
    john.age = -5
except ValueError as error:
    print("ValueError:", error)

try:
    Person("Baby", 0)
except ValueError as error:
    print("ValueError:", error)
```

Output:

```text
26
ValueError: The age must be positive
ValueError: The age must be positive
```

Here is the order of events for `@age.setter`:

1. Python evaluates the decorator expression `age.setter`. At this point `age` is still the getter-only property.
2. It creates the new function, which is also called `age`.
3. It calls `age.setter(<the new function>)`, which returns a property with both a getter and a setter.
4. It binds the result to the name of the function, `age`, replacing the getter-only property.

Notice also that `__init__` now says `self.age = age` instead of `self._age = age`. The assignment goes through the setter, so the validation protects new objects as well. That is why `Person("Baby", 0)` fails.

## Why the names must match

A tempting intermediate step is to keep the old name for the setter:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self._age = age

    @property
    def age(self):
        return self._age

    @age.setter
    def set_age(self, value):
        if value <= 0:
            raise ValueError("The age must be positive")
        self._age = value


john = Person("John", 25)
print(type(Person.set_age).__name__)

john.set_age = 30
print(john.age)

try:
    john.age = 31
except AttributeError as error:
    print("AttributeError:", error)
```

Output:

```text
property
30
AttributeError: property 'age' of 'Person' object has no setter
```

Step 4 above binds the result to the name of the **decorated function**. Here that name is `set_age`, so the class ends up with two properties:

- `age`: the original getter-only property, untouched;
- `set_age`: a new property with the getter *and* the setter.

`john.age = 31` fails, while the odd-looking `john.set_age = 30` works. Always give the getter, the setter and the deleter the same name as the property.

## The standard pattern

Putting it together, a validated attribute usually looks like this:

```python
class MyClass:
    def __init__(self, value):
        self.prop = value          # goes through the setter

    @property
    def prop(self):
        return self._prop          # the real data lives in _prop

    @prop.setter
    def prop(self, value):
        # validate or convert value here
        self._prop = value


obj = MyClass(10)
print(obj.prop, obj.__dict__)
```

Output:

```text
10 {'_prop': 10}
```

- `prop` is the public name. It lives in the class as a property object.
- `_prop` is the storage. It lives in each instance. The single leading underscore marks it as internal.

> **Note:** You will also see the storage written with two underscores, `self.__prop`. That triggers *name mangling* (see the topic Private Attributes): Python stores it as `_MyClass__prop`. It works, but it makes the attribute awkward to reach from subclasses and debugging tools. One underscore is the common choice.

Here is a class with two validated properties:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    @property
    def age(self):
        return self._age

    @age.setter
    def age(self, value):
        if value <= 0:
            raise ValueError("The age must be positive")
        self._age = value

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        if value.strip() == "":
            raise ValueError("The name cannot be empty")
        self._name = value


john = Person("John", 25)
print(john.name, john.age)
print(john.__dict__)

for bad in [("   ", 30), ("Jane", -1)]:
    try:
        Person(*bad)
    except ValueError as error:
        print("ValueError:", error)
```

Output:

```text
John 25
{'_name': 'John', '_age': 25}
ValueError: The name cannot be empty
ValueError: The age must be positive
```

A deleter is added the same way, with `@age.deleter`. The topic Delete Property covers it.

## The docstring of a property

The docstring of the **getter** becomes the docstring of the property. `setter()` and `deleter()` copy it to the new property, so documenting the getter is enough. Tools like `help()` and IDEs show it:

```python
class Person:
    def __init__(self, age):
        self.age = age

    @property
    def age(self):
        """Age of the person in full years."""
        return self._age

    @age.setter
    def age(self, value):
        """This docstring is ignored."""
        self._age = value


print(Person.age.__doc__)
print(Person.age.fget.__name__, Person.age.fset.__name__)
```

Output:

```text
Age of the person in full years.
age age
```

Since Python 3.13 a property also has a `__name__` attribute (`Person.age.__name__` is `'age'`).

## Overriding a setter in a subclass

Because `setter()` returns a copy, a subclass can take the parent's property, replace only one function, and leave the parent untouched. Refer to the parent's property through the parent class:

```python
class Account:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    @property
    def balance(self):
        """Current balance."""
        return self._balance

    @balance.setter
    def balance(self, value):
        if value < 0:
            raise ValueError("The balance cannot be negative")
        self._balance = value


class SavingsAccount(Account):
    MINIMUM = 100

    @Account.balance.setter
    def balance(self, value):
        if value < self.MINIMUM:
            raise ValueError(f"A savings account needs at least {self.MINIMUM}")
        Account.balance.fset(self, value)  # reuse the parent's setter


regular = Account("Ann", 50)
regular.balance = 0
print(regular.balance)

savings = SavingsAccount("Bob", 500)
try:
    savings.balance = 50
except ValueError as error:
    print("ValueError:", error)
print(savings.balance)

print(Account.balance is SavingsAccount.balance)
print(Account.balance.fget is SavingsAccount.balance.fget)
```

Output:

```text
0
ValueError: A savings account needs at least 100
500
False
True
```

- `@Account.balance.setter` copies the parent's property, keeps its getter and docstring, and installs the new setter. The result is stored in `SavingsAccount` only.
- `Account.balance.fset(self, value)` calls the parent's setter function directly, so its checks and the storing logic are not duplicated.
- `Account.__init__` assigns `self.balance`, and for a `SavingsAccount` instance this goes through the **subclass** property, so the minimum is checked on creation too.

## Common mistakes

- **Giving the setter a different name.** `@age.setter` on `def set_age` creates a new property `set_age` and leaves `age` read-only. Use the property's name for every decorated method.
- **Defining the setter before the getter.** `@age.setter` needs an existing property named `age`. If it comes first, the class fails with `NameError: name 'age' is not defined`.
- **Calling the property like a method.** `john.age()` first reads the property, which returns an `int`, and then calls the `int`: `TypeError: 'int' object is not callable`.
- **Forgetting `@property`.** Without it, `john.age` is a bound method, and `print(john.age)` shows `<bound method Person.age of ...>` instead of the value.
- **Storing the value under the property's own name.** `self.age = value` inside the `age` setter calls the setter again and ends in `RecursionError` (see the topic Property). Store it in `self._age`.
- **Bypassing the setter in `__init__`.** `self._age = age` in `__init__` lets invalid values in through the constructor. Assign `self.age = age`.

## Summary

- `@decorator` above `def f` is shorthand for `f = decorator(f)`; `@property` is shorthand for `name = property(name)`.
- `@property` turns a method into the getter of a property with the same name, so the class has no redundant `get_...()` method.
- `@name.setter` and `@name.deleter` add a setter and a deleter. The decorated methods must have the same name as the property.
- `getter()`, `setter()` and `deleter()` return a **new** property; the original is never changed.
- Store the data in an underscored attribute (`_age`) and assign through the property in `__init__`, so validation covers object creation.
- The getter's docstring becomes the property's docstring.
- A subclass can replace one part of an inherited property with `@Parent.name.setter`.

## Practice

### Exercise 1: From `property()` to decorators

Rewrite this class with `@property` and `@price.setter`. Keep the behaviour, and make sure the class no longer has `get_price` or `set_price` attributes.

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    def get_price(self):
        return self._price

    def set_price(self, value):
        if value < 0:
            raise ValueError("The price cannot be negative")
        self._price = value

    price = property(get_price, set_price)
```

### Exercise 2: A normalised email

Write a `User` class with an `email` property. The setter must strip surrounding whitespace, convert the address to lower case, and raise `ValueError("Invalid email")` if the result does not contain exactly one `@`. Use the property in `__init__`. Show that `User("  Ann@Example.COM ").email` is `'ann@example.com'` and that `"ann.example.com"` is rejected.

### Exercise 3: Predict the output

Predict every line, then run the code and explain the result.

```python
class Thermostat:
    def __init__(self):
        self._target = 20

    @property
    def target(self):
        return self._target

    snapshot = target

    @target.setter
    def target(self, value):
        self._target = max(10, min(value, 30))


t = Thermostat()
t.target = 50
print(t.target)
print(t.snapshot)
print(Thermostat.snapshot is Thermostat.target)
print(Thermostat.snapshot.fset)
try:
    t.snapshot = 15
except AttributeError as error:
    print("AttributeError:", error)
```

### Exercise 4: A stricter subclass

Using the `Person` class with the validated `age` property from this topic, write a subclass `Adult` whose `age` setter also rejects ages under 18 with `ValueError("An adult must be at least 18")`. Reuse the parent's getter and call the parent's setter instead of storing `_age` yourself. Show that `Person` itself still accepts `10`.

## Solutions

### Exercise 1

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    @property
    def price(self):
        return self._price

    @price.setter
    def price(self, value):
        if value < 0:
            raise ValueError("The price cannot be negative")
        self._price = value


tea = Product("Tea", 85)
tea.price = 90
print(tea.price)

try:
    tea.price = -1
except ValueError as error:
    print("ValueError:", error)

print(hasattr(Product, "get_price"), hasattr(Product, "set_price"))
```

Output:

```text
90
ValueError: The price cannot be negative
False False
```

### Exercise 2

```python
class User:
    def __init__(self, email):
        self.email = email

    @property
    def email(self):
        return self._email

    @email.setter
    def email(self, value):
        value = value.strip().lower()
        if value.count("@") != 1:
            raise ValueError("Invalid email")
        self._email = value


ann = User("  Ann@Example.COM ")
print(repr(ann.email))

try:
    ann.email = "ann.example.com"
except ValueError as error:
    print("ValueError:", error)
print(ann.email)
```

Output:

```text
'ann@example.com'
ValueError: Invalid email
ann@example.com
```

The setter normalises the value before it validates and stores it, so every way of setting the email, including the constructor, produces the same clean form.

### Exercise 3

Output:

```text
30
30
False
None
AttributeError: property 'snapshot' of 'Thermostat' object has no setter
```

- `snapshot = target` binds a second class attribute to the **getter-only** property that `target` referred to at that moment.
- `@target.setter` creates a *new* property and rebinds `target` to it. The object referenced by `snapshot` is not changed, so `snapshot` stays read-only and has no `fset`.
- `t.target = 50` goes through the setter, which clamps the value to `30`. Both properties use the same getter, so both read `30`.

### Exercise 4

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    @property
    def age(self):
        return self._age

    @age.setter
    def age(self, value):
        if value <= 0:
            raise ValueError("The age must be positive")
        self._age = value


class Adult(Person):
    @Person.age.setter
    def age(self, value):
        if value < 18:
            raise ValueError("An adult must be at least 18")
        Person.age.fset(self, value)


anna = Adult("Anna", 30)
anna.age += 1
print(anna.age)

for age in (16, -3):
    try:
        Adult("Kid", age)
    except ValueError as error:
        print("ValueError:", error)

print(Person("Tim", 10).age)
```

Output:

```text
31
ValueError: An adult must be at least 18
ValueError: An adult must be at least 18
10
```

`-3` is rejected by the subclass check before the parent's check runs. `Person.age` is a different property object from `Adult.age`, so `Person` keeps its original rules.

---

*Source: [pythontutorial.net — Python Property Decorator](https://www.pythontutorial.net/python-oop/python-property-decorator/). Adapted and expanded for PyJourney.*
