# __eq__

By default, two objects of your class are equal only if they are the very same object. The special method `__eq__` lets you define what "equal" means for your class, for example "same name and same age", and the `==` operator, the `in` operator and many list methods will follow your rule.

## What you'll learn

- What `==` does for custom objects by default, and how it differs from `is`
- How to implement `__eq__` and how `!=` is derived from it
- Why `__eq__` should return `NotImplemented` for unknown types instead of `False` or crashing
- How Python tries the *reflected* comparison on the right-hand operand
- Which built-in operations rely on `==` (`in`, `count()`, `index()`, `remove()`)
- Why defining `__eq__` makes objects unhashable

## Equality by default is identity

Here is a class without `__eq__` and two objects with identical data:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age


john = Person("John", "Doe", 25)
jane = Person("Jane", "Doe", 25)
john2 = john

print(john is jane)
print(john == jane)
print(john == john2)
print(john != jane)
```

Output:

```text
False
False
True
True
```

`john` and `jane` are two separate objects, so `is` returns `False`. Without your own `__eq__`, the `==` operator does the same: the method inherited from `object` considers two objects equal only when they are the same object. `john == john2` is `True` because both names refer to one object.

> **Note:** `is` asks "are these the same object?", and `==` asks "do these have equal values?". For your own classes, `==` means the same as `is` until you implement `__eq__`.

## Implementing `__eq__`

When Python evaluates `a == b`, it calls `a.__eq__(b)`. The method receives the other object and returns the result of the comparison. As a first example, consider two people equal if they have the same age:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __eq__(self, other):
        return self.age == other.age


john = Person("John", "Doe", 25)
jane = Person("Jane", "Doe", 25)
mary = Person("Mary", "Doe", 27)

print(john == jane)
print(john == mary)
print(john != mary)
```

Output:

```text
True
False
True
```

Notice that `!=` works too, although only `__eq__` is defined. In Python 3 the default `__ne__` calls `__eq__` and inverts the result, so you almost never need to write `__ne__` yourself.

"Equal if the ages match" is only a teaching example. Real equality should compare all the attributes that define the object's value. A neat way is to compare tuples:

```python
def __eq__(self, other):
    return (self.first_name, self.last_name, self.age) == (
        other.first_name,
        other.last_name,
        other.age,
    )
```

## Comparing with other types

The simple version above crashes as soon as the other operand is not a `Person`:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __eq__(self, other):
        return self.age == other.age


john = Person("John", "Doe", 25)

try:
    print(john == 20)
except AttributeError as error:
    print("AttributeError:", error)
```

Output:

```text
AttributeError: 'int' object has no attribute 'age'
```

`==` should never crash. Comparing a person with a number is a legitimate question, and the answer is simply "not equal". A first fix is to check the type with `isinstance()`:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __eq__(self, other):
        if isinstance(other, Person):
            return self.age == other.age

        return False


john = Person("John", "Doe", 25)
jane = Person("Jane", "Doe", 25)
mary = Person("Mary", "Doe", 27)

print(john == jane)
print(john == mary)
print(john == 20)
```

Output:

```text
True
False
False
```

This works, but there is an even better answer than `False`.

## Return `NotImplemented` for unknown types

`NotImplemented` is a special built-in constant. Returning it from `__eq__` means "I don't know how to compare myself with this object". Python then gives the **other** operand a chance: it calls the reflected method `other.__eq__(self)`. Only if both sides return `NotImplemented` does `==` fall back to an identity check, which gives `False` for different objects.

Why does this matter? Imagine another class that *does* know how to compare itself with a `Person`:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return False  # closes the door for the other operand
        return (self.name, self.age) == (other.name, other.age)


class Badge:
    def __init__(self, owner_name):
        self.owner_name = owner_name

    def __eq__(self, other):
        if isinstance(other, Person):
            return self.owner_name == other.name
        return NotImplemented


ann = Person("Ann", 30)
badge = Badge("Ann")
print(badge == ann)
print(ann == badge)
```

Output:

```text
True
False
```

Equality became **asymmetric**: `badge == ann` but not `ann == badge`. `Person.__eq__` answered `False` without letting `Badge` speak. Change one line to return `NotImplemented`:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)


class Badge:
    def __init__(self, owner_name):
        self.owner_name = owner_name

    def __eq__(self, other):
        if isinstance(other, Person):
            return self.owner_name == other.name
        return NotImplemented


ann = Person("Ann", 30)
badge = Badge("Ann")
print(badge == ann)
print(ann == badge)
print(ann == 20)
print(ann != 20)
print(ann == Person("Ann", 30))
```

Output:

```text
True
True
False
True
True
```

Now both directions agree, and comparing with an unrelated type such as `int` still gives `False`, because both sides return `NotImplemented` and Python falls back to identity.

> **Tip:** The standard pattern is:
> `if not isinstance(other, MyClass): return NotImplemented`, then compare the attributes.

## How Python evaluates `a == b`

You can watch the protocol by printing inside `__eq__`:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        print(f"__eq__ called: {self.name} vs {other!r}")
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)


ann = Person("Ann", 30)
print(ann == "Ann")
print("Ann" == ann)
```

Output:

```text
__eq__ called: Ann vs 'Ann'
False
__eq__ called: Ann vs 'Ann'
False
```

In the second comparison the left operand is a `str`. `str.__eq__` does not know `Person`, so it returns `NotImplemented`, and Python calls the reflected `ann.__eq__("Ann")`. The full algorithm:

```text
a == b
 1. result = a.__eq__(b)        (if type(b) is a subclass of type(a) that
                                 overrides __eq__, b.__eq__(a) is tried first)
 2. if result is NotImplemented: result = b.__eq__(a)
 3. if still NotImplemented:     result = (a is b)
```

`!=` follows the same steps with `__ne__`, whose default implementation inverts `__eq__`.

## Where `==` is used for you

Many operations compare elements with `==`, so they start using your `__eq__` automatically: the `in` operator on lists and tuples, `list.count()`, `list.index()` and `list.remove()`.

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)

    def __repr__(self):
        return f"Person({self.name!r}, {self.age!r})"


team = [Person("Ann", 30), Person("Bob", 25), Person("Ann", 30)]

print(Person("Bob", 25) in team)
print(team.count(Person("Ann", 30)))
print(team.index(Person("Bob", 25)))
team.remove(Person("Ann", 30))
print(team)
```

Output:

```text
True
2
1
[Person('Bob', 25), Person('Ann', 30)]
```

`remove()` deletes only the **first** equal element. Without `__eq__`, all of these calls would search for the identical object and find nothing.

## Defining `__eq__` makes objects unhashable

There is a side effect you must know about. When a class defines `__eq__` but not `__hash__`, Python sets `__hash__` to `None`, and the objects can no longer be set members or dict keys:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)


print(Person.__hash__)

try:
    {Person("Ann", 30)}
except TypeError as error:
    print("TypeError:", error)
```

Output (Python 3.14; older versions print only `unhashable type: 'Person'`):

```text
None
TypeError: cannot use 'Person' as a set element (unhashable type: 'Person')
```

This is a safety measure: equal objects must have equal hashes, and the default identity-based hash would break that rule. The next topic, `__hash__`, shows how to fix it correctly.

## Rules for a good `__eq__`

- **Reflexive:** `a == a` is `True`.
- **Symmetric:** if `a == b`, then `b == a`. Returning `NotImplemented` instead of `False` helps keep this rule.
- **Transitive:** if `a == b` and `b == c`, then `a == c`.
- **Consistent with `__hash__`:** if `a == b`, then `hash(a) == hash(b)`.
- **Never raises** for unexpected types.
- **Returns a `bool`** (or `NotImplemented`). Libraries such as NumPy return other things on purpose, but your classes normally shouldn't.

`isinstance(other, Person)` accepts subclasses too. If a subclass adds attributes that matter for equality, use a stricter check such as `type(other) is type(self)`, otherwise a `Person` may be "equal" to an `Employee` with the same name and age.

## Let `dataclasses` write it for you

`@dataclass` generates an `__eq__` that compares all fields in order and returns `NotImplemented` for objects of a different class:

```python
from dataclasses import dataclass


@dataclass
class Point:
    x: int
    y: int


print(Point(1, 2) == Point(1, 2))
print(Point(1, 2) == Point(2, 1))
print(Point(1, 2) == (1, 2))
```

Output:

```text
True
False
False
```

## Common mistakes

- **Accessing attributes of `other` without a type check.** `john == 20` crashes with `AttributeError`. Check `isinstance()` first.
- **Returning `False` instead of `NotImplemented`.** It blocks the reflected comparison and can make equality asymmetric.
- **Comparing too little.** "Equal if the ages match" makes two different people equal. Compare every attribute that defines the value.
- **Using `is` to compare values.** `a is b` checks identity. Use `==` for values and keep `is` for `None` and other singletons.
- **Forgetting about hashing.** After adding `__eq__`, objects can't be put into sets or used as dict keys until you define `__hash__`.
- **Comparing floats exactly.** `0.1 + 0.2 == 0.3` is `False`. For float attributes consider `math.isclose()`.

## Summary

- Without `__eq__`, `==` on custom objects means identity, the same as `is`.
- `a == b` calls `a.__eq__(b)`. If that returns `NotImplemented`, Python tries `b.__eq__(a)`, and finally falls back to `a is b`.
- `!=` uses the default `__ne__`, which inverts `__eq__`.
- Check the type with `isinstance()` and return `NotImplemented` for unknown types.
- Compare all the attributes that define the value, conveniently as tuples.
- `in`, `count()`, `index()` and `remove()` use `__eq__`.
- Defining `__eq__` sets `__hash__` to `None`; implement `__hash__` too if objects must be hashable.

## Practice

### Exercise 1: Equal money

Write a `Money` class with `amount` and `currency`. Two `Money` objects are equal when both the amount and the currency match. Comparing with any other type must return `NotImplemented`. Check `==` and `!=` between `Money` objects and `Money(10, "USD") == 10`.

### Exercise 2: Predict the output

Predict every line, including the lines printed by the methods, before running the code:

```python
class A:
    def __eq__(self, other):
        print("A.__eq__")
        return NotImplemented


class B:
    def __eq__(self, other):
        print("B.__eq__")
        return True


a, b = A(), B()
print(a == b)
print(b == a)
print(a == A())
```

### Exercise 3: Case-insensitive e-mail

Write an `Email` class whose objects compare equal ignoring letter case. An `Email` must also be comparable with a plain string, in **both** directions: `Email("Ann@Example.com") == "ann@example.com"` and `"ann@example.com" == Email("Ann@Example.com")` must both be `True`. Comparing with other types gives `False`.

### Exercise 4: Remove duplicates

A barcode scanner produced a list of `Product(sku, name)` objects with duplicates. Products are equal when their `sku` matches; the name may differ. Remove duplicates while keeping the first occurrence and the original order, then count how many times `"A-1"` was scanned. Products are unhashable, so you can't use a `set`.

## Solutions

### Exercise 1

```python
class Money:
    def __init__(self, amount, currency):
        self.amount = amount
        self.currency = currency

    def __eq__(self, other):
        if not isinstance(other, Money):
            return NotImplemented
        return (self.amount, self.currency) == (other.amount, other.currency)


print(Money(10, "USD") == Money(10, "USD"))
print(Money(10, "USD") == Money(10, "EUR"))
print(Money(10, "USD") != Money(5, "USD"))
print(Money(10, "USD") == 10)
```

Output:

```text
True
False
True
False
```

### Exercise 2

Output:

```text
A.__eq__
B.__eq__
True
B.__eq__
True
A.__eq__
A.__eq__
False
```

- `a == b`: `A.__eq__` returns `NotImplemented`, so Python calls the reflected `b.__eq__(a)`, which returns `True`.
- `b == a`: `B.__eq__` answers immediately, so `A.__eq__` is never called.
- `a == A()`: both operands are `A`, both calls return `NotImplemented`, and Python falls back to identity. They are different objects, so the result is `False`.

### Exercise 3

```python
class Email:
    def __init__(self, address):
        self.address = address

    def __eq__(self, other):
        if isinstance(other, Email):
            other = other.address
        if not isinstance(other, str):
            return NotImplemented
        return self.address.lower() == other.lower()


print(Email("Ann@Example.com") == Email("ann@example.COM"))
print(Email("Ann@Example.com") == "ann@example.com")
print("ann@example.com" == Email("Ann@Example.com"))
print(Email("ann@example.com") == Email("bob@example.com"))
print(Email("ann@example.com") == 42)
```

Output:

```text
True
True
True
False
False
```

The third line works thanks to reflection: `str.__eq__` returns `NotImplemented` for an `Email`, so Python calls `Email.__eq__` with the operands swapped. For full Unicode case-insensitivity, `casefold()` is even more thorough than `lower()`.

### Exercise 4

```python
class Product:
    def __init__(self, sku, name):
        self.sku = sku
        self.name = name

    def __eq__(self, other):
        if not isinstance(other, Product):
            return NotImplemented
        return self.sku == other.sku

    def __repr__(self):
        return f"Product({self.sku!r}, {self.name!r})"


scanned = [
    Product("A-1", "Pen"),
    Product("B-7", "Notebook"),
    Product("A-1", "Pen (blue)"),
    Product("C-3", "Eraser"),
    Product("B-7", "Notebook"),
]

unique = []
for product in scanned:
    if product not in unique:
        unique.append(product)

print(unique)
print(scanned.count(Product("A-1", "")))
```

Output:

```text
[Product('A-1', 'Pen'), Product('B-7', 'Notebook'), Product('C-3', 'Eraser')]
2
```

`not in` and `count()` both call `__eq__`. This loop is O(n²); once you add `__hash__` (next topic), a set or dict can do the same in linear time.

---

*Source: [pythontutorial.net — Python __eq__](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__eq__/). Adapted and expanded for PyJourney.*
