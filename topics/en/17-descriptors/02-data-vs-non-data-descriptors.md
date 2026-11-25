# Data vs. Non-data Descriptors

Descriptors come in two kinds, and the difference is a single method: a descriptor that can intercept **assignment** or **deletion** is a *data descriptor*, one that only intercepts **reading** is a *non-data descriptor*. The kind decides who wins when the instance has its own value under the same name. This one rule explains why you can override a method on a single object but cannot hide a property, and how `functools.cached_property` works.

## What you'll learn

- The exact rule that makes a descriptor a data or a non-data descriptor, and how to check it
- The full order in which Python resolves `obj.attr`, and how assignment and deletion differ from reading
- Why an instance attribute can hide a method but not a property
- How a function becomes a bound method through `__get__`
- How a non-data descriptor can compute a value once and cache it, as `functools.cached_property` does
- The typical traps: "read-only" descriptors that are not, and assignments on the class

## Two kinds of descriptors

Recall from the topic Descriptors that a descriptor is a class attribute whose type defines `__get__`, `__set__` and/or `__delete__`. The classification looks only at the last two:

- A **data descriptor** defines `__set__` or `__delete__` (or both). Usually it also has `__get__`.
- A **non-data descriptor** defines `__get__` only.

`__set_name__` plays no role here. What matters is whether the **type** of the descriptor has the method, and `inspect.isdatadescriptor()` performs exactly this check:

```python
import inspect
from functools import cached_property


class OnlyGet:
    def __get__(self, instance, owner):
        return "value from __get__"


class GetSet:
    def __get__(self, instance, owner):
        return "value from __get__"

    def __set__(self, instance, value):
        pass


class GetDelete:
    def __get__(self, instance, owner):
        return "value from __get__"

    def __delete__(self, instance):
        pass


class Demo:
    only_get = OnlyGet()
    get_set = GetSet()
    get_delete = GetDelete()

    def method(self):
        pass

    @property
    def prop(self):
        return 42

    @cached_property
    def cached(self):
        return 42

    @classmethod
    def cmethod(cls):
        pass


for name in ("only_get", "get_set", "get_delete", "method", "prop", "cached", "cmethod"):
    raw = vars(Demo)[name]
    kind = "data" if inspect.isdatadescriptor(raw) else "non-data"
    print(f"{name:11} {type(raw).__name__:15} {kind}")
```

Output:

```text
only_get    OnlyGet         non-data
get_set     GetSet          data
get_delete  GetDelete       data
method      function        non-data
prop        property        data
cached      cached_property non-data
cmethod     classmethod     non-data
```

Two results deserve attention:

- `GetDelete` has no `__set__`, yet it is a data descriptor. Having `__delete__` is enough.
- `property` is a data descriptor even when you define only a getter: the `property` type always has `__set__` and `__delete__`, which raise `AttributeError` when the corresponding function is missing.

Functions, `classmethod`, `staticmethod` and `cached_property` are non-data descriptors.

## Non-data descriptors: the instance attribute wins

For a non-data descriptor Python first looks in the instance dictionary `obj.__dict__`. Only if the name is **not** there does it call the descriptor's `__get__`.

Here is a descriptor that counts the files in a folder every time the attribute is read. To make the output reproducible, the example creates a temporary folder with three files instead of counting the files in `/`:

```python
import os
import tempfile


class FileCount:
    """Non-data descriptor: it defines only __get__."""

    def __get__(self, instance, owner):
        if instance is None:
            return self
        print("FileCount.__get__ was called")
        return len(os.listdir(instance.path))


class Folder:
    count = FileCount()

    def __init__(self, path):
        self.path = path


with tempfile.TemporaryDirectory() as path:
    for name in ("a.txt", "b.txt", "c.txt"):
        open(os.path.join(path, name), "w").close()

    folder = Folder(path)
    print("file count:", folder.count)

    folder.__dict__["count"] = 100  # an instance attribute with the same name
    print("file count:", folder.count)

    folder.count = 200  # a normal assignment also lands in __dict__
    print("file count:", folder.count)

    del folder.count  # remove the instance attribute...
    print("file count:", folder.count)  # ...and the descriptor is back
```

Output:

```text
FileCount.__get__ was called
file count: 3
file count: 100
file count: 200
FileCount.__get__ was called
file count: 3
```

What happened, step by step:

1. `folder.count`: the instance dictionary has no `count`, so `FileCount.__get__` runs and counts the files.
2. After `folder.__dict__["count"] = 100` the instance has its own `count`. Python finds it first and never calls `__get__`.
3. `folder.count = 200` is an ordinary assignment. `FileCount` has no `__set__`, so nothing intercepts it, and the value is written to `folder.__dict__`. A non-data descriptor cannot validate or block assignments.
4. `del folder.count` deletes the instance attribute (again, nothing intercepts it), and the descriptor becomes visible again.

> **Note:** The original example omits the `if instance is None: return self` check. Without it, reading `Folder.count` on the class calls `__get__(None, Folder)` and fails with `AttributeError: 'NoneType' object has no attribute 'path'`.

## Data descriptors: the descriptor wins

For a data descriptor the order is reversed: the descriptor is consulted **before** the instance dictionary, both for reading and for writing. An entry with the same name in `obj.__dict__` is simply ignored:

```python
class Coordinate:
    """Data descriptor: it defines __get__ and __set__."""

    def __set_name__(self, owner, name):
        self.name = name
        self.storage = "_" + name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        print(f"Coordinate.__get__ for {self.name}")
        return getattr(instance, self.storage, 0.0)

    def __set__(self, instance, value):
        print(f"Coordinate.__set__ for {self.name} = {value!r}")
        setattr(instance, self.storage, float(value))


class Point:
    x = Coordinate()
    y = Coordinate()


p = Point()
p.x = 10
print(p.x)

p.__dict__["x"] = 999  # try to sneak a value past the descriptor
print(p.x)             # the descriptor still answers
print(p.__dict__)

try:
    del p.x  # Coordinate has no __delete__
except AttributeError as error:
    print("AttributeError:", error)
```

Output:

```text
Coordinate.__set__ for x = 10
Coordinate.__get__ for x
10.0
Coordinate.__get__ for x
10.0
{'_x': 10.0, 'x': 999}
AttributeError: __delete__
```

- `p.x = 10` went to `__set__`, which converted the value to `float` and stored it under `_x`.
- The entry `"x": 999` sits in the instance dictionary, but `p.x` still calls `__get__`: data descriptors take priority. This is the guarantee that makes validation reliable, because no instance attribute can bypass it.
- `del p.x` fails: the descriptor intercepts deletion too, and since it has no `__delete__`, Python refuses instead of quietly deleting something from the instance dictionary.

> **Note:** The original tutorial describes this as "Python looks in the data descriptor first, and if it doesn't find the attribute, it looks in the instance dictionary". That is not how it works. If the data descriptor has a `__get__`, its result is final, whatever it returns. The instance dictionary is consulted only when the data descriptor has **no** `__get__` at all (a rare descriptor with only `__set__`), and in that case the descriptor object itself is returned when the dictionary has no entry either.

## The complete lookup order

Reading `obj.attr` is handled by `object.__getattribute__`. Putting both rules together:

```text
obj.attr
 0. search "attr" in type(obj) and its bases (the MRO)   -> class attribute, if any
 1. it is a data descriptor (with __get__)               -> return its __get__(obj, type(obj))
 2. "attr" is in obj.__dict__                            -> return that value
 3. it is a non-data descriptor                          -> return its __get__(obj, type(obj))
 4. it is a plain class attribute                        -> return it as is
 5. nothing found                                        -> AttributeError (then __getattr__, if defined)
```

Writing and deleting are simpler, because only data descriptors take part:

```text
obj.attr = value
 1. a data descriptor in type(obj) or its bases?
      it has __set__         -> descriptor.__set__(obj, value)
      it has no __set__      -> AttributeError: __set__
 2. otherwise (non-data descriptor, plain class attribute or nothing)
                             -> obj.__dict__["attr"] = value

del obj.attr
 1. a data descriptor in type(obj) or its bases?
      it has __delete__      -> descriptor.__delete__(obj)
      it has no __delete__   -> AttributeError: __delete__
 2. otherwise                -> remove "attr" from obj.__dict__ (AttributeError if missing)
```

This is the same order the topic Property showed for properties. You can model it in a few lines of Python and compare the result with the real `getattr()`:

```python
_NOT_FOUND = object()


def lookup(obj, name):
    """A simplified pure-Python model of object.__getattribute__."""
    cls_attr = _NOT_FOUND
    for klass in type(obj).__mro__:  # 0. search the class and its bases
        if name in vars(klass):
            cls_attr = vars(klass)[name]
            break

    kind = type(cls_attr)
    is_data = hasattr(kind, "__set__") or hasattr(kind, "__delete__")
    if cls_attr is not _NOT_FOUND and is_data and hasattr(kind, "__get__"):
        return kind.__get__(cls_attr, obj, type(obj))  # 1. data descriptor

    instance_dict = getattr(obj, "__dict__", {})
    if name in instance_dict:
        return instance_dict[name]  # 2. instance attribute

    if cls_attr is not _NOT_FOUND:
        if hasattr(kind, "__get__"):
            return kind.__get__(cls_attr, obj, type(obj))  # 3. non-data descriptor
        return cls_attr  # 4. plain class attribute

    raise AttributeError(name)  # 5. nothing found


class Demo:
    species = "class attribute"

    @property
    def prop(self):
        return "from the property"

    def method(self):
        return "from the method"


d = Demo()
d.__dict__.update(species="instance", prop="instance", method="instance")

for name in ("species", "prop", "method"):
    print(f"{name:8} getattr: {getattr(d, name)!r:21} lookup: {lookup(d, name)!r}")

del d.__dict__["method"]
print(lookup(d, "method")())
```

Output:

```text
species  getattr: 'instance'            lookup: 'instance'
prop     getattr: 'from the property'   lookup: 'from the property'
method   getattr: 'instance'            lookup: 'instance'
from the method
```

Notice the details the model reproduces:

- The descriptor is looked up on the **type** (`type(obj).__mro__`), never in the instance dictionary. A descriptor object stored on an instance is just a value.
- `__get__` is called on the type of the descriptor (`kind.__get__(cls_attr, ...)`), just like special methods.
- The real implementation is written in C and also caches type lookups, but the order of the steps is the same.

## Functions are non-data descriptors: how methods get `self`

Every function defined in a class body is stored in the class as a plain function. It becomes a method only when it is read through an instance, and that is the job of the function's `__get__`:

```python
class Greeter:
    def __init__(self, name):
        self.name = name

    def hello(self):
        return f"Hello from {self.name}"


g = Greeter("Olena")
function = vars(Greeter)["hello"]  # the plain function stored in the class
print(type(function).__name__)

bound = function.__get__(g, Greeter)  # exactly what g.hello does
print(type(bound).__name__, bound.__self__ is g, bound.__func__ is function)
print(bound())

print(Greeter.hello is function)  # through the class: __get__(None, Greeter) returns the function
print(g.hello is g.hello)         # every access builds a NEW bound method object
print(g.hello == g.hello)         # ...but they compare equal

g.hello = lambda: "patched on this instance"  # functions are non-data descriptors
print(g.hello())
print(Greeter("Max").hello())
del g.hello
print(g.hello())
```

Output:

```text
function
method True True
Hello from Olena
True
False
True
patched on this instance
Hello from Max
Hello from Olena
```

- `function.__get__(g, Greeter)` returns a **bound method**: an object that remembers the function (`__func__`) and the instance (`__self__`) and calls `function(g, ...)` when invoked. This is where `self` comes from.
- Read through the class, the function's `__get__` returns the function itself, so `Greeter.hello(g)` needs the instance passed explicitly.
- A new bound method is created on every attribute access. Two of them are equal but not identical, which is why `is` is the wrong way to compare methods.
- Because functions are **non-data** descriptors, an instance attribute with the same name takes priority. That is what makes per-instance monkeypatching (for example in tests) possible. `del g.hello` removes the instance attribute and the class method is visible again.

`classmethod` and `staticmethod` work the same way: their `__get__` returns a method bound to the class, or the plain function. Exercise 4 rebuilds both.

## Why a property cannot be hidden

A property is a data descriptor, even without a setter. So an assignment cannot create an instance attribute that would hide it, and an entry planted directly in `__dict__` is ignored:

```python
class Account:
    def __init__(self, balance):
        self._balance = balance

    @property
    def balance(self):  # no setter
        return self._balance


acc = Account(100)
try:
    acc.balance = 0
except AttributeError as error:
    print("AttributeError:", error)

acc.__dict__["balance"] = 0
print(acc.balance)
print(hasattr(property, "__set__"), hasattr(property, "__delete__"))
```

Output:

```text
AttributeError: property 'balance' of 'Account' object has no setter
100
True True
```

The comparison in one table:

| | Data descriptor | Non-data descriptor |
|---|---|---|
| Defines | `__set__` and/or `__delete__` (plus `__get__`) | only `__get__` |
| `obj.attr` when `obj.__dict__` has the same name | the descriptor's `__get__` | the instance value |
| `obj.attr = value` | the descriptor's `__set__` | written to `obj.__dict__` |
| `del obj.attr` | the descriptor's `__delete__` | removed from `obj.__dict__` |
| Typical uses | validation, computed attributes, read-only fields, `property`, `__slots__` members | methods, `classmethod`, `staticmethod`, caching (`cached_property`) |

## Using the non-data rule on purpose: compute once, then cache

The fact that an instance attribute hides a non-data descriptor is not only a trap, it is also a tool. A non-data descriptor can compute an expensive value on the first access and store it in the instance dictionary **under its own name**. From then on, Python finds the value in `__dict__` and does not even call the descriptor:

```python
class lazy:
    """Non-data descriptor: computes the value once, then gets out of the way."""

    def __init__(self, func):
        self.func = func

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        value = self.func(instance)
        instance.__dict__[self.name] = value  # from now on the instance attribute wins
        return value


class Report:
    def __init__(self, rows):
        self.rows = rows

    @lazy
    def total(self):
        print("computing total...")
        return sum(self.rows)


report = Report([10, 20, 30])
print(report.total)
print(report.total)  # read straight from report.__dict__, no computation
print(report.__dict__)

report.rows.append(40)
print(report.total)  # stale: the cache does not know that rows changed
del report.total     # drop the cached value
print(report.total)  # computed again
```

Output:

```text
computing total...
60
60
{'rows': [10, 20, 30], 'total': 60}
60
computing total...
100
```

After the first access the descriptor costs nothing: the second read is an ordinary dictionary lookup. The price is **staleness**: the cached value does not follow changes in `rows` until you delete it. If `lazy` had a `__set__`, it would become a data descriptor, `__get__` would run on every access, and the cache in `__dict__` would never be used.

The standard library ships this exact tool as `functools.cached_property` (Python 3.8+):

```python
from functools import cached_property


class Report:
    def __init__(self, rows):
        self.rows = rows

    @cached_property
    def total(self):
        print("computing total...")
        return sum(self.rows)


report = Report([10, 20, 30])
print(report.total, report.total)
report.total = 0  # no __set__: the assignment simply replaces the cached value
print(report.total)
del report.total
print(report.total)
```

Output:

```text
computing total...
60 60
0
computing total...
60
```

> **Note:** `cached_property` needs a writable instance `__dict__`, so it does not work in classes with `__slots__` (unless `"__dict__"` is one of the slots). Before Python 3.12 it also used an internal lock, one per property and shared by *all* instances, which could make unrelated threads wait for each other. The lock was removed in 3.12, so in multithreaded code two threads may now compute the same value concurrently.

## Common mistakes

- **Expecting a `__get__`-only descriptor to protect an attribute.** Without `__set__`, assignments go straight into the instance dictionary and silently hide the descriptor:

  ```python
  class Constant:
      """Meant to be read-only, but it defines only __get__."""

      def __init__(self, value):
          self.value = value

      def __get__(self, instance, owner):
          return self.value


  class Circle:
      PI = Constant(3.14159)


  circle = Circle()
  circle.PI = 3  # silently creates an instance attribute
  print(circle.PI, Circle.PI)
  ```

  Output:

  ```text
  3 3.14159
  ```

  Add a `__set__` that refuses the assignment. That turns it into a data descriptor:

  ```python
  class Constant:
      def __init__(self, value):
          self.value = value  # one value for all instances is intended here

      def __set_name__(self, owner, name):
          self.name = name

      def __get__(self, instance, owner):
          return self.value

      def __set__(self, instance, value):  # makes it a data descriptor
          raise AttributeError(f"{self.name} is read-only")


  class Circle:
      PI = Constant(3.14159)


  circle = Circle()
  try:
      circle.PI = 3
  except AttributeError as error:
      print("AttributeError:", error)
  print(circle.PI)
  ```

  Output:

  ```text
  AttributeError: PI is read-only
  3.14159
  ```

- **Assigning to the class instead of an instance.** `__set__` is called only for instance assignments. `Point.x = 5` does not validate anything: it **replaces** the descriptor in the class, for every instance at once:

  ```python
  class Coordinate:
      def __set_name__(self, owner, name):
          self.storage = "_" + name

      def __get__(self, instance, owner):
          if instance is None:
              return self
          return getattr(instance, self.storage, 0.0)

      def __set__(self, instance, value):
          setattr(instance, self.storage, float(value))


  class Point:
      x = Coordinate()


  a = Point()
  a.x = "1.5"
  print(a.x)

  Point.x = 5  # on the CLASS: no __set__ call, the descriptor is simply replaced
  b = Point()
  b.x = "1.5"  # now a plain instance attribute: no conversion
  print(repr(b.x), repr(a.x), type(vars(Point)["x"]).__name__)
  ```

  Output:

  ```text
  1.5
  '1.5' 5 int
  ```

  `a` still has its value in `_x`, but nothing reads it anymore: `a.x` now finds the plain class attribute `5`. (Intercepting assignments on the class itself requires a descriptor on the *metaclass*.)

- **Making a caching descriptor a data descriptor.** If a "lazy" descriptor also defines `__set__` (for example, to allow resetting), the value it stores in `__dict__` is never found, and the expensive function runs on every access.
- **Thinking `__get__` is what makes a data descriptor.** Only `__set__` and `__delete__` count. A descriptor with `__get__` and `__delete__` is a data descriptor, and since it has no `__set__`, every assignment to that attribute fails with `AttributeError: __set__`.
- **Using `is` to compare bound methods.** `obj.method is obj.method` is `False`, because each access creates a new bound method. Use `==`.
- **Forgetting `if instance is None: return self`.** Reading the attribute on the class then passes `None` into your logic.

## Summary

- A data descriptor defines `__set__` and/or `__delete__`. A non-data descriptor defines only `__get__`. `__set_name__` does not affect the kind, and `inspect.isdatadescriptor()` checks it.
- Lookup order for `obj.attr`: data descriptor, then the instance `__dict__`, then non-data descriptor or plain class attribute, then `AttributeError` / `__getattr__`.
- Assignment and deletion go to the data descriptor's `__set__` / `__delete__` if there is one; otherwise they work directly on the instance `__dict__`. A non-data descriptor cannot block them.
- `property` and `__slots__` members are data descriptors, so instance attributes cannot hide them.
- Functions, `classmethod` and `staticmethod` are non-data descriptors. A function's `__get__` creates the bound method that supplies `self`, and an instance attribute can override a method on one object.
- Storing a computed value in `__dict__` under the descriptor's own name turns a non-data descriptor into a cache, which is how `functools.cached_property` works.
- Assigning to the class attribute replaces the descriptor instead of calling `__set__`.

## Practice

### Exercise 1: Who wins?

Without running the code, predict the output of both loops. Then run it and explain every line.

```python
class A:
    def __get__(self, instance, owner):
        return "A.__get__"


class B:
    def __get__(self, instance, owner):
        return "B.__get__"

    def __set__(self, instance, value):
        instance.__dict__["b_storage"] = value


class C:
    def __get__(self, instance, owner):
        return "C.__get__"

    def __delete__(self, instance):
        print("C.__delete__")


class D:
    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        return "D.__get__"


class Box:
    a = A()
    b = B()
    c = C()
    d = D()


box = Box()
for name in "abcd":
    box.__dict__[name] = "instance value"
    print(name, getattr(box, name))

for name in "abcd":
    try:
        setattr(box, name, 1)
        print(f"box.{name} = 1 -> ok")
    except AttributeError as error:
        print(f"box.{name} = 1 -> AttributeError: {error}")
```

### Exercise 2: A cache that knows when to forget

A class `Dataset` has a list `values` and two expensive results, `total` and `mean`, implemented with `functools.cached_property` (`mean` uses `total`). The problem: after `data.values = [...]` the cached results are stale. Write a data descriptor `Field(*invalidates)` for `values` that stores a copy of the list and, on every assignment, removes the listed cached results from the instance so they are recomputed on the next access. Show that each result is computed once per assignment.

### Exercise 3: Write-once attributes

Write a data descriptor `WriteOnce`: the attribute can be assigned exactly once (not necessarily in `__init__`), any later assignment raises `AttributeError`, reading before the first assignment raises `AttributeError` with a clear message, and deleting is forbidden. Use it for `Order.order_id`, which is set after the order is saved.

### Exercise 4: Your own `classmethod` and `staticmethod`

Implement two non-data descriptors, `my_classmethod` and `my_staticmethod`, that behave like the built-ins: the first binds the **class** as the first argument, no matter whether it is accessed through the class or through an instance (use `types.MethodType`); the second returns the plain function. Test them in a class `Temperature` with a static `to_celsius(fahrenheit)` and an alternative constructor `from_fahrenheit(cls, fahrenheit)`, and show that a subclass gets instances of itself.

## Solutions

### Exercise 1

Output:

```text
a instance value
b B.__get__
c C.__get__
d instance value
box.a = 1 -> ok
box.b = 1 -> ok
box.c = 1 -> AttributeError: __set__
box.d = 1 -> ok
```

- `a` and `d` are non-data descriptors (only `__get__`; `__set_name__` does not count), so the instance value wins.
- `b` is a data descriptor (`__set__`), so `__get__` wins over the instance dictionary.
- `c` is also a data descriptor, because it has `__delete__`, even without `__set__`.
- Assignments: `box.a = 1` and `box.d = 1` simply write to `box.__dict__`. `box.b = 1` is handled by `B.__set__`. `box.c = 1` is intercepted by the data descriptor `C`, which has no `__set__`, so Python raises `AttributeError: __set__`.

### Exercise 2

```python
from functools import cached_property


class Field:
    """Data descriptor that drops cached values when the field changes."""

    def __init__(self, *invalidates):
        self.invalidates = invalidates

    def __set_name__(self, owner, name):
        self.storage = "_" + name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        return getattr(instance, self.storage)

    def __set__(self, instance, value):
        setattr(instance, self.storage, list(value))
        for name in self.invalidates:
            instance.__dict__.pop(name, None)  # forget the cached result, if any


class Dataset:
    values = Field("total", "mean")

    def __init__(self, values):
        self.values = values

    @cached_property
    def total(self):
        print("  computing total")
        return sum(self.values)

    @cached_property
    def mean(self):
        print("  computing mean")
        return self.total / len(self.values)


data = Dataset([1, 2, 3, 4])
print(data.mean, data.mean)
data.values = [10, 20]
print(data.mean, data.total)
```

Output:

```text
  computing mean
  computing total
2.5 2.5
  computing mean
  computing total
15.0 30
```

Both kinds of descriptors work together here. `cached_property` is a non-data descriptor, so its cached value lives in `__dict__` under the property's name and hides the descriptor. `Field` is a data descriptor, so every assignment to `values` reaches its `__set__`, which removes those cached entries with `pop(name, None)` (no error if a result was never computed). Storing `list(value)` also protects the cache from someone mutating the original list passed in.

### Exercise 3

```python
class WriteOnce:
    """Data descriptor: the first assignment wins, later ones are refused."""

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        try:
            return instance.__dict__[self.name]
        except KeyError:
            raise AttributeError(f"{self.name} has not been set yet") from None

    def __set__(self, instance, value):
        if self.name in instance.__dict__:
            raise AttributeError(f"{self.name} is already set and cannot be changed")
        instance.__dict__[self.name] = value

    def __delete__(self, instance):
        raise AttributeError(f"{self.name} cannot be deleted")


class Order:
    order_id = WriteOnce()

    def __init__(self, items):
        self.items = items


order = Order(["book"])
try:
    print(order.order_id)
except AttributeError as error:
    print("AttributeError:", error)

order.order_id = 1001  # assigned later, e.g. after saving to a database
print(order.order_id)

try:
    order.order_id = 2002
except AttributeError as error:
    print("AttributeError:", error)

try:
    del order.order_id
except AttributeError as error:
    print("AttributeError:", error)

print(order.order_id, Order(["pen"]).__dict__)
```

Output:

```text
AttributeError: order_id has not been set yet
1001
AttributeError: order_id is already set and cannot be changed
AttributeError: order_id cannot be deleted
1001 {'items': ['pen']}
```

The descriptor must be a **data** descriptor: a `__get__`-only version could not stop the second assignment. Storing the value in `__dict__` under the same name is safe because the data descriptor always wins, and the presence of that key is exactly the "already set" flag. A new `Order` has no `order_id` key, so every instance gets its own single write.

### Exercise 4

```python
import types


class my_classmethod:
    """Non-data descriptor: binds the CLASS, whether accessed via the class or an instance."""

    def __init__(self, func):
        self.func = func

    def __get__(self, instance, owner=None):
        if owner is None:
            owner = type(instance)
        return types.MethodType(self.func, owner)


class my_staticmethod:
    """Non-data descriptor: binds nothing and returns the plain function."""

    def __init__(self, func):
        self.func = func

    def __get__(self, instance, owner=None):
        return self.func


class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    @my_staticmethod
    def to_celsius(fahrenheit):
        return round((fahrenheit - 32) * 5 / 9, 1)

    @my_classmethod
    def from_fahrenheit(cls, fahrenheit):
        return cls(cls.to_celsius(fahrenheit))

    def __repr__(self):
        return f"{type(self).__name__}({self.celsius})"


class LabTemperature(Temperature):
    pass


print(Temperature.from_fahrenheit(212))
print(LabTemperature.from_fahrenheit(98.6))  # cls is the subclass
print(Temperature(0).from_fahrenheit(32))    # via an instance: still the class
print(Temperature.to_celsius(50), Temperature(0).to_celsius(50))  # no self, no cls
print(Temperature.from_fahrenheit.__self__)
```

Output:

```text
Temperature(100.0)
LabTemperature(37.0)
Temperature(0.0)
10.0 10.0
<class '__main__.Temperature'>
```

`types.MethodType(func, obj)` creates the same kind of bound method that a function's `__get__` creates, but here the bound object is the class (`owner`), not the instance. Because `owner` is the class through which the attribute was looked up, `LabTemperature.from_fahrenheit` receives `LabTemperature` and builds a `LabTemperature`. `my_staticmethod.__get__` ignores both arguments, so neither `self` nor `cls` is ever inserted. Both are non-data descriptors, exactly like the built-ins.

---

*Source: [pythontutorial.net — Python Data Descriptors](https://www.pythontutorial.net/python-oop/python-data-descriptors/). Adapted and expanded for PyJourney.*
