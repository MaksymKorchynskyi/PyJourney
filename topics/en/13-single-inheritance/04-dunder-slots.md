# __slots__

By default every Python object keeps its attributes in a per-instance dictionary, which is flexible but costs memory. Declaring `__slots__` in a class tells Python that its instances have a **fixed set of attributes**, so it can store them in a compact, array-like layout instead. This matters when a program creates many small objects, and it interacts with inheritance in ways that are easy to get wrong.

## What you'll learn

- Where instance attributes normally live (`__dict__`) and what that costs
- How `__slots__` changes the storage and what you gain and lose
- Why you can still add *class* attributes to a slotted class, but not instance attributes
- How `__slots__` behaves in every combination of base class and subclass
- How to measure the memory savings and when slots are worth using
- Extras: `__weakref__`, `__dict__` in slots, `@dataclass(slots=True)`

## Default storage: the instance `__dict__`

Here is an ordinary class:

```python
class Point2D:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Point2D({self.x},{self.y})"


point = Point2D(0, 0)
print(point.__dict__)

point.z = 5  # any new attribute can be added at runtime
print(point.__dict__)
```

Output:

```text
{'x': 0, 'y': 0}
{'x': 0, 'y': 0, 'z': 5}
```

Each instance carries its own dictionary that maps attribute names to values. A dictionary can grow, so you can attach any attribute to any object at any time. The price is memory: a dictionary is a hash table with spare room for future keys, and every single instance pays for it.

If a class has a small, fixed set of attributes and you create thousands or millions of its objects (points, pixels, records from a file), this overhead adds up.

## Declaring `__slots__`

Assign `__slots__` in the class body: an iterable (usually a tuple) of the attribute names the instances are allowed to have:

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Point2D({self.x},{self.y})"


point = Point2D(0, 0)
print(point)
print(point.__slots__)
print(hasattr(point, "__dict__"))
```

Output:

```text
Point2D(0,0)
('x', 'y')
False
```

Instances of this class have **no `__dict__`** at all. Accessing it fails:

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


point = Point2D(0, 0)
print(point.__dict__)
```

Output:

```text
Traceback (most recent call last):
  ...
AttributeError: 'Point2D' object has no attribute '__dict__'. Did you mean: '__dir__'?
```

(The "Did you mean" hint is just Python's guess at a typo; ignore it here.) For the same reason, `vars(point)` raises `TypeError: vars() argument must have __dict__ attribute`.

### No new instance attributes

Without a dictionary there is nowhere to put an attribute that is not listed in `__slots__`:

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


point = Point2D(0, 0)
point.z = 0
```

Output:

```text
Traceback (most recent call last):
  ...
AttributeError: 'Point2D' object has no attribute 'z' and no __dict__ for setting new attributes
```

> **Note:** The wording of this message has improved over time. Python 3.14 says "... and no __dict__ for setting new attributes"; older versions only say `'Point2D' object has no attribute 'z'`.

This restriction is also a small safety net: a typo such as `self.nmae = name` in a slotted class fails immediately instead of silently creating a new attribute.

A slot that was declared but never assigned simply has no value yet. Reading it raises `AttributeError: 'Point2D' object has no attribute 'x'`, just like a missing normal attribute.

## How slots work: descriptors on the class

`__slots__` applies to **instances**, not to the class itself. For each name in `__slots__`, Python creates a special descriptor on the class (a `member_descriptor`) that knows where in the instance's fixed memory layout that value is stored. The class still has its own `__dict__`, so you can add class attributes:

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


Point2D.color = "black"  # a class attribute: allowed
print({k: v for k, v in Point2D.__dict__.items() if not k.startswith("__")})
print(type(Point2D.x))

point = Point2D(0, 0)
print(point.color)
```

Output:

```text
{'x': <member 'x' of 'Point2D' objects>, 'y': <member 'y' of 'Point2D' objects>, 'color': 'black'}
<class 'member_descriptor'>
black
```

The instance can *read* `color`, because attribute lookup falls back to the class. But it cannot *assign* its own `color`: there is no slot for it and no instance dictionary.

```python
class Point2D:
    __slots__ = ("x", "y")


Point2D.color = "black"
point = Point2D()
point.color = "red"
```

Output:

```text
Traceback (most recent call last):
  ...
AttributeError: 'Point2D' object attribute 'color' is read-only
```

## How much memory do slots save?

You can measure the memory of many objects with the standard `tracemalloc` module:

```python
import tracemalloc


class PointDict:
    def __init__(self, x, y):
        self.x = x
        self.y = y


class PointSlots:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


def measure(cls, n=100_000):
    tracemalloc.start()
    points = [cls(0, 0) for _ in range(n)]
    current, _ = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    return current / n


print(f"with __dict__:  {measure(PointDict):.0f} bytes per point")
print(f"with __slots__: {measure(PointSlots):.0f} bytes per point")
```

Output (Python 3.14, 64-bit; numbers vary by version and platform):

```text
with __dict__:  96 bytes per point
with __slots__: 56 bytes per point
```

The numbers include the 8-byte pointer each object occupies in the list. Even so, the slotted version needs about 40% less memory.

Older articles often report much bigger differences. Since Python 3.11–3.12, CPython stores the attributes of ordinary objects in a compact inline layout and creates the real dictionary only when something asks for `__dict__`, so the gap has become smaller. Slots still win, and they also make attribute access slightly faster, but the gain only matters when you have **many** instances.

## `__slots__` and single inheritance

`__slots__` is declared per class, and a subclass does not inherit the "no `__dict__`" property automatically. There are four combinations.

### Base class has slots, subclass does not

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __repr__(self):
        return f"Point2D({self.x},{self.y})"


class Point3D(Point2D):
    def __init__(self, x, y, z):
        super().__init__(x, y)
        self.z = z


if __name__ == "__main__":
    point = Point3D(10, 20, 30)
    print(point.__dict__)
    point.color = "red"
    print(point.__dict__)
```

Output:

```text
{'z': 30}
{'z': 30, 'color': 'red'}
```

`Point3D` does not declare `__slots__`, so its instances get a `__dict__` again. `x` and `y` still live in the inherited slots, while `z` (and anything else) goes into the dictionary. Most of the memory benefit is lost.

### Both classes have slots

To keep the compact layout, the subclass must declare `__slots__` too, listing **only the new attributes**:

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


class Point3D(Point2D):
    __slots__ = ("z",)

    def __init__(self, x, y, z):
        super().__init__(x, y)
        self.z = z


point = Point3D(10, 20, 30)
print(point.x, point.y, point.z)
print(hasattr(point, "__dict__"))
```

Output:

```text
10 20 30
False
```

Now all three attributes are stored in slots and there is no instance dictionary. Note the trailing comma in `("z",)`: without it, `("z")` is just the string `"z"`. (A single string happens to work too, since `__slots__ = "z"` declares one slot named `z`, but the tuple form is clearer.)

Do not repeat the parent's names. `__slots__ = ("x", "y", "z")` in `Point3D` creates a second, hidden copy of `x` and `y`, which wastes memory (on Python 3.14: 72 bytes per object instead of 56), and the Python documentation warns that the parent's slots become inaccessible and the program's meaning is undefined.

### Base class has no slots, subclass does

```python
class Shape:
    pass


class Point2D(Shape):
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


if __name__ == "__main__":
    # both slots and a dict are used to store instance attributes
    point = Point2D(10, 10)
    print(point.__slots__)
    print(point.__dict__)

    # attributes can still be added at runtime
    point.color = "black"
    print(point.__dict__)
```

Output:

```text
('x', 'y')
{}
{'color': 'black'}
```

`Shape` has no `__slots__`, so its instances (and those of every subclass) have a `__dict__`. `Point2D` stores `x` and `y` in slots, but the dictionary is still there, initially empty, ready for `color`. Slots in the subclass alone do not remove the dictionary.

### Neither class has slots

This is the default behaviour: every instance has a `__dict__`.

### Summary of the combinations

| Base `__slots__` | Subclass `__slots__` | Instances have `__dict__`? |
|---|---|---|
| yes | yes (new names only) | no |
| yes | no | yes |
| no | yes | yes |
| no | no | yes |

The rule: an instance has no `__dict__` only if **every** class in its inheritance chain (except `object`) defines `__slots__`.

## Extras

### Re-enabling `__dict__` or weak references

Slotted instances cannot be weakly referenced by default, because the slot for the weak-reference list is also gone:

```python
import weakref


class Point2D:
    __slots__ = ("x", "y")


weakref.ref(Point2D())
```

Output:

```text
Traceback (most recent call last):
  ...
TypeError: cannot create weak reference to 'Point2D' object
```

Add the special names `"__weakref__"` and/or `"__dict__"` to `__slots__` if you need these features back:

```python
import weakref


class Node:
    __slots__ = ("value", "__weakref__")

    def __init__(self, value):
        self.value = value


class Flexible:
    __slots__ = ("x", "__dict__")


node = Node(1)
ref = weakref.ref(node)
print(ref() is node)

item = Flexible()
item.x = 1
item.extra = 2
print(item.__dict__)
```

Output:

```text
True
{'extra': 2}
```

### No class-level defaults for slots

A name cannot be both a slot and a class attribute, so you cannot provide defaults this way:

```python
class Config:
    __slots__ = ("debug",)
    debug = False
```

Output:

```text
Traceback (most recent call last):
  ...
ValueError: 'debug' in __slots__ conflicts with class variable
```

Set defaults in `__init__` instead (`def __init__(self, debug=False): self.debug = debug`).

### Slots with dataclasses (Python 3.10+)

`@dataclass(slots=True)` generates the `__slots__` for you, and it handles default values correctly:

```python
from dataclasses import dataclass


@dataclass(slots=True)
class Point:
    x: int
    y: int = 0


p = Point(3)
print(p)
print(Point.__slots__)
print(hasattr(p, "__dict__"))
```

Output:

```text
Point(x=3, y=0)
('x', 'y')
False
```

### Multiple inheritance

A class cannot inherit from two classes that both have non-empty `__slots__`: Python cannot merge two fixed memory layouts and raises `TypeError: multiple bases have instance lay-out conflict`. This is one more reason to use slots only in simple, mostly single-inheritance hierarchies.

## When to use `__slots__`

Use slots when:

- you create **a large number** of instances (tens of thousands or more);
- the set of attributes is fixed and known in advance;
- you control the whole class hierarchy.

Do not use slots by default for every class. They take away flexibility (no ad-hoc attributes, no `__dict__`-based tools such as `vars()`, extra care with inheritance) and give a noticeable benefit only at scale.

## Common mistakes

- **Adding `__slots__` only to the subclass.** If the base class has no slots, instances still get a `__dict__`, and memory is not saved.
- **Forgetting `__slots__` in a subclass.** A subclass without its own `__slots__` brings the `__dict__` back.
- **Repeating the parent's slot names in the subclass.** List only the new attributes.
- **Writing `("z")` instead of `("z",)`.** Without the comma it is a string, not a tuple. It happens to declare one slot named `z`, but `__slots__ = ("x" "y")` silently becomes the single slot `xy`.
- **Giving defaults with class attributes.** `debug = False` next to `__slots__ = ("debug",)` raises `ValueError`. Set defaults in `__init__` or use `@dataclass(slots=True)`.
- **Using slots as an access-control or validation mechanism.** Slots exist to save memory. A subclass without slots can add any attribute again. Use properties or validation in `__init__` to guard data.

## Summary

- Normally each instance stores its attributes in its own `__dict__`, which allows adding attributes at runtime but costs memory.
- `__slots__ = ("a", "b")` gives instances a fixed set of attributes stored compactly, with no `__dict__`.
- Slotted instances reject unknown attributes with `AttributeError`, which also catches typos.
- `__slots__` affects instances only; class attributes can still be added, but instances cannot assign to them.
- To keep the benefit in a subclass, declare `__slots__` there too, listing only new attributes. Every class in the chain must have slots for the `__dict__` to disappear.
- Add `"__weakref__"` or `"__dict__"` to `__slots__` to restore those features; use `@dataclass(slots=True)` for an easy, default-friendly version.
- The memory saving is real but moderate on modern Python; use slots for large numbers of simple objects.

## Practice

### Exercise 1: A strict product

Create a class `Product` with slots `name` and `price`. Then:

1. create `Product("Pen", 25)` and print both attributes;
2. try to set `product.discount = 10` and print the error message;
3. write a version of `__init__` with a typo (`self.prise = price`) in a class `BrokenProduct`, and show that creating it fails.

### Exercise 2: Who has a `__dict__`?

Without running the code, predict the four printed values. Then run it.

```python
class A:
    __slots__ = ("a",)


class B(A):
    pass


class C:
    pass


class D(C):
    __slots__ = ("d",)


class E(A):
    __slots__ = ("e",)


for cls in (B, D, E, A):
    print(cls.__name__, hasattr(cls(), "__dict__"))
```

### Exercise 3: A 3D point that stays compact

Starting from the slotted `Point2D(x, y)` below, write `Point3D(x, y, z)` so that:

- it reuses `Point2D.__init__` via `super()`;
- its instances have **no** `__dict__`;
- `repr()` shows `Point3D(1, 2, 3)`.

Prove that `point.color = "red"` fails.

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y
```

## Solutions

### Exercise 1

```python
class Product:
    __slots__ = ("name", "price")

    def __init__(self, name, price):
        self.name = name
        self.price = price


class BrokenProduct:
    __slots__ = ("name", "price")

    def __init__(self, name, price):
        self.name = name
        self.prise = price  # typo


product = Product("Pen", 25)
print(product.name, product.price)

try:
    product.discount = 10
except AttributeError as error:
    print(error)

try:
    BrokenProduct("Pen", 25)
except AttributeError as error:
    print(error)
```

Output:

```text
Pen 25
'Product' object has no attribute 'discount' and no __dict__ for setting new attributes
'BrokenProduct' object has no attribute 'prise' and no __dict__ for setting new attributes
```

### Exercise 2

Output:

```text
B True
D True
E False
A False
```

- `B` adds no `__slots__`, so it brings back the `__dict__`.
- `D` has slots, but its parent `C` does not, so the `__dict__` remains.
- `E` and its parent `A` both define slots, so there is no `__dict__`.
- `A` defines slots and inherits only from `object`.

### Exercise 3

```python
class Point2D:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


class Point3D(Point2D):
    __slots__ = ("z",)

    def __init__(self, x, y, z):
        super().__init__(x, y)
        self.z = z

    def __repr__(self):
        return f"Point3D({self.x}, {self.y}, {self.z})"


point = Point3D(1, 2, 3)
print(repr(point))
print(hasattr(point, "__dict__"))

try:
    point.color = "red"
except AttributeError as error:
    print(error)
```

Output:

```text
Point3D(1, 2, 3)
False
'Point3D' object has no attribute 'color' and no __dict__ for setting new attributes
```

---

*Source: [pythontutorial.net — Python `__slots__` (Wayback Machine archived copy)](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__slots__/). Adapted and expanded for PyJourney.*
