# __hash__

Dictionaries and sets find items almost instantly because they look them up by a **hash**: an integer computed from the object. The special method `__hash__` computes that integer for your class. It must work together with `__eq__`, and getting the pair wrong leads to some of the most confusing bugs in Python: duplicates in a set, or a dict key that is "there" but can never be found.

## What you'll learn

- What `hash()` returns and which objects are hashable
- How the default hash of a custom object works
- How dicts and sets use `__hash__` and `__eq__` together
- The hash/equality contract and why defining `__eq__` sets `__hash__` to `None`
- How to implement `__hash__` correctly from the same fields as `__eq__`
- Why a hash must never change while the object is in a set or dict, and how read-only properties and frozen dataclasses help

## The `hash()` function

`hash(obj)` returns an integer. Internally it calls `type(obj).__hash__(obj)`:

```python
print(hash(42))
print(hash((1, 2)))
print(hash(1) == hash(1.0) == hash(True))

try:
    hash([1, 2])
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
42
-3550055125485641917
True
TypeError: unhashable type: 'list'
```

Immutable built-in types (`int`, `float`, `str`, `bytes`, `tuple` of hashable items, `frozenset`) are **hashable**. Mutable containers (`list`, `dict`, `set`) are not, because their contents, and therefore their hash, could change.

> **Note:** The hash of `str` and `bytes` is **randomized** per process (hash randomization protects web servers against crafted-collision attacks). `hash("abc")` gives a different number on every run. Never store hashes in files or databases, and never rely on their exact values.

## The default hash of your objects

A class that defines neither `__eq__` nor `__hash__` inherits both from `object`:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


p1 = Person("John", 22)
p2 = Person("Jane", 22)

print(hash(p1))
print(hash(p2))
print(hash(p1) == p1.__hash__())
```

Output (the numbers vary on every run):

```text
271196438
271192269
True
```

The default hash is derived from the object's identity (`id()`), and the default `__eq__` compares identity. The two defaults agree with each other: an object is equal only to itself, and it always has the same hash. So plain objects can be used as dict keys and set members, where each object counts as unique.

## How dicts and sets use `__hash__` and `__eq__`

A dict or set is a hash table. Looking up a key takes two steps:

```text
lookup(key)
 1. h = hash(key)               -> pick a slot in the table from h
 2. for each entry in that slot area with the same stored hash h:
        if entry is key or entry == key: found
 3. otherwise: not found
```

`__hash__` narrows the search to a few candidates, and `__eq__` makes the final decision. You can watch it happen:

```python
class Key:
    def __init__(self, value):
        self.value = value

    def __hash__(self):
        print(f"  __hash__ of Key({self.value})")
        return hash(self.value)

    def __eq__(self, other):
        print(f"  __eq__: Key({self.value}) vs Key({other.value})")
        return isinstance(other, Key) and self.value == other.value


print("insert:")
table = {Key(1): "one"}
print("lookup:")
print(table[Key(1)])
```

Output:

```text
insert:
  __hash__ of Key(1)
lookup:
  __hash__ of Key(1)
  __eq__: Key(1) vs Key(1)
one
```

The lookup key is a different object, so Python first matched the hash and then confirmed equality with `__eq__`.

## The contract: equal objects must have equal hashes

From the algorithm above follows the one rule every hashable class must obey:

> If `a == b`, then `hash(a) == hash(b)`.

If equal objects had different hashes, the lookup would search in the wrong slot and never even call `__eq__`. The reverse is **not** required: different objects may share a hash (a *collision*). Collisions only slow lookups down a little, because `__eq__` sorts them out:

```python
print(hash(-1) == hash(-2))  # True: a collision in CPython
print(-1 == -2)              # False: still different keys

prices = {1: "int", 1.0: "float", True: "bool"}
print(prices)
```

Output:

```text
True
False
{1: 'bool'}
```

`1 == 1.0 == True` and their hashes are equal too, so the dict treats them as **one key**. The first key object (`1`) stays, and the value is overwritten twice.

## Defining `__eq__` removes the default hash

Now give `Person` value-based equality:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        return isinstance(other, Person) and self.age == other.age


print(Person.__hash__)

try:
    hash(Person("John", 22))
except TypeError as error:
    print("TypeError:", error)

try:
    members = {Person("John", 22), Person("Jane", 22)}
except TypeError as error:
    print("TypeError:", error)
```

Output (Python 3.14; older versions print only `unhashable type: 'Person'` in both cases):

```text
None
TypeError: unhashable type: 'Person'
TypeError: cannot use 'Person' as a set element (unhashable type: 'Person')
```

When a class defines `__eq__` without `__hash__`, Python sets `__hash__ = None` in the class. That is deliberate: the inherited identity-based hash would give two equal people different hashes and silently break the contract. Python prefers a loud `TypeError` to a silent bug.

## Implementing `__hash__`

`__hash__(self)` must return an integer, and it must be built from **the same data that `__eq__` compares**. The simplest correct way is to hash a tuple of those fields:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        return isinstance(other, Person) and self.age == other.age

    def __hash__(self):
        return hash(self.age)


p1 = Person("John", 22)
p2 = Person("Jane", 22)
p3 = Person("Mary", 30)

print(hash(p1), hash(p2), hash(p3))
members = {p1, p2, p3}
print(len(members))
print([p.name for p in members])
```

Output:

```text
22 22 30
2
['John', 'Mary']
```

Here `__eq__` compares only `age`, so `__hash__` hashes only `age`. John and Jane are "equal", so the set keeps just the first one. In real code equality usually involves several fields, and the hash uses the same tuple:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)

    def __hash__(self):
        return hash((self.name, self.age))

    def __repr__(self):
        return f"Person({self.name!r}, {self.age!r})"


people = [Person("Ann", 30), Person("Bob", 25), Person("Ann", 30)]
print(len(set(people)))

roles = {Person("Ann", 30): "admin"}
print(roles[Person("Ann", 30)])
print(Person("Bob", 25) in roles)
```

Output:

```text
2
admin
False
```

> **Tip:** Hashing a *subset* of the fields that `__eq__` compares is also correct (equal objects still agree on that subset), it just causes more collisions. Hashing a field that `__eq__` ignores is **wrong**.

## What happens when the contract is broken

Suppose someone "fixes" the `TypeError` by returning an identity-based hash:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)

    def __hash__(self):
        return id(self)  # wrong: equal objects get different hashes


a = Person("Ann", 30)
b = Person("Ann", 30)
print(a == b)
print(hash(a) == hash(b))
print(len({a, b}))
print(b in {a})
```

Output:

```text
True
False
2
False
```

`a` and `b` are equal, yet the set keeps both, and `b in {a}` is `False`. No error is raised; the data is just quietly wrong.

## The hash must not change

A dict or set stores each key's hash at the moment of insertion. If the object later changes a field that the hash depends on, it is now filed under the wrong hash:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)

    def __hash__(self):
        return hash((self.name, self.age))


ann = Person("Ann", 30)
visitors = {ann}
print(ann in visitors)

ann.age = 31  # mutate the key after it was stored
print(ann in visitors)
print(Person("Ann", 30) in visitors)
print(list(visitors)[0] is ann)
```

Output:

```text
True
False
False
True
```

The object is physically inside the set, but neither the object itself nor an "Ann, 30" can find it anymore. This is why only objects whose hashed data never changes should be hashable.

### Make the hashed fields read-only

One way is to store the data in "private" attributes and expose them through read-only properties (properties are covered in detail in the next section of the course):

```python
class Person:
    def __init__(self, name, age):
        self._name = name
        self._age = age

    @property
    def name(self):
        return self._name

    @property
    def age(self):
        return self._age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)

    def __hash__(self):
        return hash((self.name, self.age))


ann = Person("Ann", 30)
try:
    ann.age = 31
except AttributeError as error:
    print("AttributeError:", error)

print(ann in {Person("Ann", 30)})
```

Output:

```text
AttributeError: property 'age' of 'Person' object has no setter
True
```

This is a convention, not a lock: code can still assign `ann._age`. The underscore says "don't touch".

### Or use a frozen dataclass

`@dataclass(frozen=True)` generates `__eq__` and a matching `__hash__` from all fields, and forbids assignment after creation:

```python
from dataclasses import dataclass, FrozenInstanceError


@dataclass(frozen=True)
class Point:
    x: int
    y: int


p = Point(1, 2)
print(hash(p) == hash(Point(1, 2)))
print(len({p, Point(1, 2), Point(2, 1)}))

try:
    p.x = 10
except FrozenInstanceError as error:
    print("FrozenInstanceError:", error)


@dataclass
class MutablePoint:
    x: int
    y: int


print(MutablePoint.__hash__)
```

Output:

```text
True
2
FrozenInstanceError: cannot assign to field 'x'
None
```

A regular `@dataclass` generates `__eq__` and therefore, by the same rule, sets `__hash__` to `None`.

## Unhashable on purpose, and inheritance

Mutable "value" objects, such as a bank account whose balance changes, should usually **not** be hashable. Say so explicitly with `__hash__ = None`. The same rule also applies to inheritance: a subclass that overrides `__eq__` loses its inherited hash, unless it restores it explicitly:

```python
import collections.abc


class Base:
    pass


class Child(Base):
    def __eq__(self, other):
        return NotImplemented


class FixedChild(Base):
    def __eq__(self, other):
        return NotImplemented

    __hash__ = Base.__hash__


class Account:
    __hash__ = None  # explicitly unhashable


print(Child.__hash__)
print(FixedChild.__hash__ is object.__hash__)
print(isinstance(Account(), collections.abc.Hashable))

try:
    hash(Account())
except TypeError as error:
    print("TypeError:", error)
```

Output:

```text
None
True
False
TypeError: unhashable type: 'Account'
```

## Common mistakes

- **Defining `__eq__` and forgetting `__hash__`.** The objects become unhashable and fail in sets and as dict keys.
- **Hashing different fields than `__eq__` compares.** If the hash uses a field that equality ignores, equal objects get different hashes, and sets keep "duplicates".
- **Returning `id(self)` or a random number from `__hash__`.** That silences the `TypeError` but breaks the contract.
- **Mutating an object while it is a key or a set member.** It becomes unreachable. Hash only data that never changes.
- **Relying on hash values.** String hashes change between runs, and integer hashes have quirks (`hash(-1) == -2`). Compare objects, not hashes.
- **Thinking equal hashes mean equal objects.** Collisions are normal; equality is always confirmed with `__eq__`.

## Summary

- `hash(obj)` calls `__hash__` and returns an integer used by dicts and sets to find items fast.
- By default `__hash__` is derived from the object's identity, and `__eq__` compares identity, so each object is a unique key.
- Lookups use the hash to find candidates and `__eq__` to confirm a match.
- Contract: if `a == b`, then `hash(a) == hash(b)`. Collisions are allowed.
- Defining `__eq__` without `__hash__` sets `__hash__` to `None`, making objects unhashable.
- Implement `__hash__` as `hash((field1, field2, ...))` over the fields that `__eq__` compares.
- The hashed data must not change while the object is in a set or dict: use read-only properties or `@dataclass(frozen=True)`.
- Use `__hash__ = None` to mark mutable value classes as unhashable.

## Practice

### Exercise 1: Unique clicks

Write a `Point` class with `x` and `y` that is equal by coordinates and hashable. Use it to count unique points in `[Point(0, 0), Point(3, 4), Point(0, 0), Point(3, 4), Point(1, 1)]` with a set, and as keys in a dict `{Point(0, 0): "origin", Point(3, 4): "target"}`. Look up `Point(3, 4)` and, with `.get()`, a missing `Point(9, 9)`.

### Exercise 2: Find the broken contract

Two products with the same SKU are equal, yet the set keeps both. Explain why and fix the class with a one-line change.

```python
class Product:
    def __init__(self, sku, name):
        self.sku = sku
        self.name = name

    def __eq__(self, other):
        if not isinstance(other, Product):
            return NotImplemented
        return self.sku == other.sku

    def __hash__(self):
        return hash((self.sku, self.name))


a = Product("A-1", "Pen")
b = Product("A-1", "Pen (blue)")
print(a == b)
print(len({a, b}))
```

### Exercise 3: The lost ticket

Predict the four printed values, then explain them. Finally, change the class so that the bug becomes impossible.

```python
class Ticket:
    def __init__(self, code):
        self.code = code

    def __eq__(self, other):
        if not isinstance(other, Ticket):
            return NotImplemented
        return self.code == other.code

    def __hash__(self):
        return hash(self.code)


ticket = Ticket("A1")
used = {ticket}
ticket.code = "B2"

print(ticket in used)
print(Ticket("A1") in used)
print(Ticket("B2") in used)
print(len(used))
```

### Exercise 4: Counting visits with a frozen dataclass

Define a frozen dataclass `Coordinate(lat, lon)` and use it as a dict key to count how many times each place appears in this route: Kyiv `(50.45, 30.52)` three times, Lviv `(49.84, 24.03)` once, Odesa `(46.48, 30.73)` once. Print each coordinate with its count in the order of first visit.

## Solutions

### Exercise 1

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __eq__(self, other):
        if not isinstance(other, Point):
            return NotImplemented
        return (self.x, self.y) == (other.x, other.y)

    def __hash__(self):
        return hash((self.x, self.y))


clicks = [Point(0, 0), Point(3, 4), Point(0, 0), Point(3, 4), Point(1, 1)]
print(len(set(clicks)))

labels = {Point(0, 0): "origin", Point(3, 4): "target"}
print(labels[Point(3, 4)])
print(labels.get(Point(9, 9), "unknown"))
```

Output:

```text
3
target
unknown
```

### Exercise 2

The hash includes `name`, but `__eq__` ignores it. `a` and `b` are equal, yet their hashes differ, so the set never compares them and keeps both (the program prints `True` and `2`). The hash must use only fields that `__eq__` compares:

```python
class Product:
    def __init__(self, sku, name):
        self.sku = sku
        self.name = name

    def __eq__(self, other):
        if not isinstance(other, Product):
            return NotImplemented
        return self.sku == other.sku

    def __hash__(self):
        return hash(self.sku)


a = Product("A-1", "Pen")
b = Product("A-1", "Pen (blue)")
print(a == b)
print(len({a, b}))
```

Output:

```text
True
1
```

### Exercise 3

Output of the original code:

```text
False
False
False
1
```

- `ticket in used`: the set looks under `hash("B2")`, but the ticket was filed under `hash("A1")`.
- `Ticket("A1") in used`: the hash matches the stored one, but `__eq__` compares `"A1"` with the ticket's current code `"B2"` and returns `False`.
- `Ticket("B2") in used`: wrong slot again, because the stored hash is still `hash("A1")`.
- `len(used)`: the ticket is still in the set; it just can't be found.

Make the code read-only so the hashed data can't change:

```python
class Ticket:
    def __init__(self, code):
        self._code = code

    @property
    def code(self):
        return self._code

    def __eq__(self, other):
        if not isinstance(other, Ticket):
            return NotImplemented
        return self.code == other.code

    def __hash__(self):
        return hash(self.code)


ticket = Ticket("A1")
used = {ticket}

try:
    ticket.code = "B2"
except AttributeError as error:
    print("AttributeError:", error)

print(Ticket("A1") in used)
```

Output:

```text
AttributeError: property 'code' of 'Ticket' object has no setter
True
```

### Exercise 4

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Coordinate:
    lat: float
    lon: float


visits = {}
route = [
    Coordinate(50.45, 30.52),
    Coordinate(49.84, 24.03),
    Coordinate(50.45, 30.52),
    Coordinate(46.48, 30.73),
    Coordinate(50.45, 30.52),
]
for place in route:
    visits[place] = visits.get(place, 0) + 1

for place, count in visits.items():
    print(place, count)
```

Output:

```text
Coordinate(lat=50.45, lon=30.52) 3
Coordinate(lat=49.84, lon=24.03) 1
Coordinate(lat=46.48, lon=30.73) 1
```

Dicts keep insertion order, so the places appear in the order of their first visit. `collections.Counter(route)` would give the same counts in one line.

---

*Source: [pythontutorial.net — Python __hash__](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__hash__/). Adapted and expanded for PyJourney.*
