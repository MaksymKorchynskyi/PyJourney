# assertIsInstance()

Sometimes the *type* of a result is part of the contract: a parser must return an `int`, a factory must return a `Circle`, a loader must return something dict-like. `assertIsInstance()` checks exactly that, and its negative twin `assertNotIsInstance()` checks the opposite.

## What you'll learn

- What `assertIsInstance(obj, cls, msg=None)` checks and how it relates to `isinstance()`
- Why instances of subclasses pass, and why `object` always passes
- How to allow several types with a tuple or a `X | Y` union
- How `assertNotIsInstance()` works (and why `assertIsNotInstance()` does not exist)
- How to check an *exact* type, an abstract base class or a protocol
- What cannot be passed as the second argument

## How `assertIsInstance()` works

```python
assertIsInstance(obj, cls, msg=None)
```

The test passes when `isinstance(obj, cls)` is true:

- `obj` is the object to check.
- `cls` is a class, a tuple of classes, or (since Python 3.10) a union such as `int | float`.
- `msg` is an optional explanation added to the failure message.

Because it uses `isinstance()`, the check follows inheritance: an instance of a subclass is also an instance of every base class.

## Example: shapes

`shape.py` defines a base class and a subclass:

```python
class Shape:
    pass


class Square(Shape):
    pass
```

`test_shape.py` checks a `Square` against its own class, its base class and `object`. The last test uses `assertNotIsInstance()`, described below:

```python
import unittest

from shape import Shape, Square


class TestShape(unittest.TestCase):
    def setUp(self):
        self.square = Square()

    def test_is_instance(self):
        self.assertIsInstance(self.square, Square)

    def test_is_instance_of_parent_class(self):
        self.assertIsInstance(self.square, Shape)

    def test_is_instance_of_object(self):
        self.assertIsInstance(self.square, object)

    def test_is_not_instance(self):
        shape = Shape()
        self.assertNotIsInstance(shape, Square)
```

Output of `python3 -m unittest -v`:

```text
test_is_instance (test_shape.TestShape.test_is_instance) ... ok
test_is_instance_of_object (test_shape.TestShape.test_is_instance_of_object) ... ok
test_is_instance_of_parent_class (test_shape.TestShape.test_is_instance_of_parent_class) ... ok
test_is_not_instance (test_shape.TestShape.test_is_not_instance) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

- A `Square` is a `Square`, and because `Square` inherits from `Shape`, it is also a `Shape`.
- Every class inherits from `object`, so `assertIsInstance(anything, object)` **always** passes. It shows how inheritance works, but as a real test it checks nothing.
- A plain `Shape` is not a `Square`: inheritance goes only one way.

### What a failure looks like

The message names the object and the expected class. For your own classes without a `__repr__`, the object appears as `<module.Class object at 0x...>`:

```python
import unittest

from shape import Shape, Square


class TestShapeFail(unittest.TestCase):
    def test_shape_is_not_a_square(self):
        self.assertIsInstance(Shape(), Square)
```

The `AssertionError` line of `python3 -m unittest test_shape_fail` (the address varies):

```text
AssertionError: <shape.Shape object at 0x1011163c0> is not an instance of <class 'shape.Square'>
```

With built-in values the message is more informative, because their `repr()` shows the value. Here a parser forgot to convert its result:

```python
import unittest


def parse_quantity(text):
    return text.strip()  # bug: forgot int()


class TestParseQuantity(unittest.TestCase):
    def test_returns_int(self):
        self.assertIsInstance(parse_quantity(" 42 "), int)

    def test_returns_number(self):
        self.assertIsInstance(parse_quantity(" 42 "), (int, float))

    def test_returns_number_union(self):
        self.assertIsInstance(parse_quantity(" 42 "), int | float)
```

The `AssertionError` lines of `python3 -m unittest test_parse` (Python 3.14):

```text
AssertionError: '42' is not an instance of <class 'int'>
AssertionError: '42' is not an instance of any of (<class 'int'>, <class 'float'>)
AssertionError: '42' is not an instance of int | float
```

The quotes around `'42'` reveal the bug immediately: the function returned a string.

## Several allowed types

The second and third tests above show the two ways to accept more than one type:

- a **tuple**: `assertIsInstance(value, (int, float))`;
- a **union** (Python 3.10+): `assertIsInstance(value, int | float)`. A union with `None` reads naturally for optional results: `assertIsInstance(result, dict | None)`.

Both mean "an instance of at least one of these".

## `assertNotIsInstance()`

```python
assertNotIsInstance(obj, cls, msg=None)
```

The test passes when `isinstance(obj, cls)` is false. On failure, the message names the class that matched:

```python
import unittest

tc = unittest.TestCase()  # an instance just for experiments

try:
    tc.assertNotIsInstance(True, (str, int))
except AssertionError as error:
    print(error)
```

Output:

```text
True is an instance of <class 'int'>
```

> **Note:** The method is called `assertNotIsInstance()`, with `Not` right after `assert`. Some tutorials call it `assertIsNotInstance()`, which does not exist. Calling it ends the test with `ERROR` and `AttributeError: ... has no attribute 'assertIsNotInstance'. Did you mean: 'assertIsInstance'?`.

## Checking an exact type

`isinstance()` accepts subclasses, and that includes a surprise: `bool` is a subclass of `int`, so `assertIsInstance(True, int)` passes. When a subclass must **not** be accepted, compare the type itself with `assertIs()`, or exclude the subclass with `assertNotIsInstance()`:

```python
import unittest


def count_errors(lines):
    return any("ERROR" in line for line in lines)  # bug: any() instead of sum()


class TestCountErrors(unittest.TestCase):
    def test_isinstance_is_fooled(self):
        self.assertIsInstance(count_errors(["ERROR x", "ok"]), int)

    def test_exact_type(self):
        self.assertIs(type(count_errors(["ERROR x", "ok"])), int)

    def test_not_bool(self):
        self.assertNotIsInstance(count_errors(["ERROR x", "ok"]), bool)
```

The test lines and `AssertionError` lines of `python3 -m unittest test_exact -v`:

```text
test_exact_type (test_exact.TestCountErrors.test_exact_type) ... FAIL
test_isinstance_is_fooled (test_exact.TestCountErrors.test_isinstance_is_fooled) ... ok
test_not_bool (test_exact.TestCountErrors.test_not_bool) ... FAIL

AssertionError: <class 'bool'> is not <class 'int'>
AssertionError: True is an instance of <class 'bool'>
```

`count_errors()` returns `True` instead of a number, and `assertIsInstance(..., int)` does not notice. Of course, `assertEqual(count_errors(...), 1)` would not notice either (`True == 1`), which is exactly why a type check is sometimes needed.

## Abstract base classes and protocols

Often you do not care about the concrete class, only about what the object can do. `isinstance()` works with the abstract base classes from `collections.abc` and with protocols marked `@runtime_checkable`:

```python
import unittest
from collections.abc import Mapping, Sequence
from typing import Protocol, runtime_checkable


@runtime_checkable
class SupportsClose(Protocol):
    def close(self): ...


class Connection:
    def close(self):
        print("closed")


def load_settings():
    return {"debug": False, "workers": 4}


def recent_ids():
    return (101, 102, 103)


class TestAbstractTypes(unittest.TestCase):
    def test_settings_is_a_mapping(self):
        self.assertIsInstance(load_settings(), Mapping)

    def test_ids_are_a_sequence(self):
        self.assertIsInstance(recent_ids(), Sequence)

    def test_connection_can_be_closed(self):
        self.assertIsInstance(Connection(), SupportsClose)
```

Output of `python3 -m unittest test_abc -v`:

```text
test_connection_can_be_closed (test_abc.TestAbstractTypes.test_connection_can_be_closed) ... ok
test_ids_are_a_sequence (test_abc.TestAbstractTypes.test_ids_are_a_sequence) ... ok
test_settings_is_a_mapping (test_abc.TestAbstractTypes.test_settings_is_a_mapping) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

These tests keep passing if `recent_ids()` later returns a list instead of a tuple, which is usually what you want. Note that a runtime protocol check only verifies that the methods **exist**, not their signatures. Also, `str` is a `Sequence` too, so `assertIsInstance("abc", Sequence)` passes.

## What the second argument cannot be

`isinstance()` rejects some values as its second argument. Then `assertIsInstance()` does not fail, it crashes with `TypeError`, and the test ends with `ERROR`:

```python
import unittest


class TestWrongArguments(unittest.TestCase):
    def test_generic(self):
        self.assertIsInstance(["a", "b"], list[str])

    def test_swapped(self):
        self.assertIsInstance(list, ["a", "b"])
```

The last line of each traceback from `python3 -m unittest test_wrong_args`:

```text
TypeError: isinstance() argument 2 cannot be a parameterized generic
TypeError: isinstance() arg 2 must be a type, a tuple of types, or a union
```

- Type hints like `list[str]` or `dict[str, int]` cannot be checked at runtime. Check the container with `assertIsInstance(tags, list)` and then each element in a loop.
- The object comes **first**, the type **second**.

## Common mistakes

- **Writing `assertIsNotInstance()`.** The correct name is `assertNotIsInstance()`.
- **Forgetting that `bool` is an `int`.** `assertIsInstance(True, int)` passes. Use `assertIs(type(x), int)` or add `assertNotIsInstance(x, bool)`.
- **Checking a class instead of an instance.** `assertIsInstance(Square, Shape)` fails with `<class 'shape.Square'> is not an instance of <class 'shape.Shape'>`, because the class `Square` is an instance of `type`, not of `Shape`. To check inheritance between classes, use `assertIsSubclass(Square, Shape)` (Python 3.14+) or `assertTrue(issubclass(Square, Shape))`.
- **Passing a parameterised generic** such as `list[int]`. It raises `TypeError`.
- **Testing only the type.** `assertIsInstance(total, int)` passes for every wrong integer. A type check complements value checks like `assertEqual()`; it does not replace them.
- **Writing `assertIsInstance(x, object)`.** It always passes.

## Summary

- `assertIsInstance(obj, cls, msg=None)` passes when `isinstance(obj, cls)` is true, so instances of subclasses pass too.
- `cls` can be a class, a tuple of classes, or a union like `int | float`. Every object is an instance of `object`.
- `assertNotIsInstance(obj, cls, msg=None)` is the opposite check. There is no `assertIsNotInstance()`.
- Failure messages show the object's `repr()`, so give your classes a readable `__repr__`.
- For an exact type, use `assertIs(type(obj), SomeClass)`. Remember that `bool` is a subclass of `int`.
- Abstract base classes (`Mapping`, `Sequence`, `Iterable`) and `@runtime_checkable` protocols let you test capabilities instead of concrete classes.
- Parameterised generics such as `list[str]` cannot be used. For classes, use `assertIsSubclass()` instead.

## Practice

### Exercise 1: A shape factory

`shapes.py` contains:

```python
import math


class Shape:
    def area(self):
        raise NotImplementedError


class Circle(Shape):
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return math.pi * self.radius**2


class Square(Shape):
    def __init__(self, side):
        self.side = side

    def area(self):
        return self.side**2


def make_shape(kind, size):
    if kind == "circle":
        return Circle(size)
    if kind == "square":
        return Square(size)
    raise ValueError(f"unknown shape: {kind}")
```

Write tests that check that `make_shape("circle", 1)` returns a `Circle`, which is also a `Shape` and not a `Square`; that `make_shape("square", 2)` returns a `Square` with area `4`; and that an unknown kind raises `ValueError`.

### Exercise 2: `int`, not `bool`

`values.py` contains:

```python
def parse_value(text):
    lowered = text.lower()
    if lowered in ("true", "false"):
        return lowered == "true"
    if text.isdigit():
        return int(text)
    return text
```

Write tests that check the **exact** result type for `"42"` (`int`), `"true"` and `"False"` (`bool`) and `"hello"` (`str`) in one `subTest()` loop. Add a test that `parse_value("1")` is not a `bool`, and a test of the values themselves. Why would `assertIsInstance(parse_value("true"), int)` be a useless check here?

### Exercise 3: Fix the broken tests

`shape.py` contains the `Shape` and `Square` classes from the topic and this function:

```python
def get_tags():
    return ["python", "testing"]
```

Predict what each test below reports (`FAIL` or `ERROR`, and why), then fix all three so that they pass and still check what their names say.

```python
import unittest

from shape import Shape, Square, get_tags


class TestBroken(unittest.TestCase):
    def test_tags(self):
        self.assertIsInstance(get_tags(), list[str])

    def test_square_class(self):
        self.assertIsInstance(Square, Shape)

    def test_not_a_dict(self):
        self.assertIsNotInstance(get_tags(), dict)
```

## Solutions

### Exercise 1

```python
import unittest

from shapes import Circle, Shape, Square, make_shape


class TestMakeShape(unittest.TestCase):
    def test_circle(self):
        shape = make_shape("circle", 1)
        self.assertIsInstance(shape, Circle)
        self.assertIsInstance(shape, Shape)
        self.assertNotIsInstance(shape, Square)

    def test_square(self):
        shape = make_shape("square", 2)
        self.assertIsInstance(shape, Square)
        self.assertEqual(shape.area(), 4)

    def test_unknown_kind(self):
        with self.assertRaises(ValueError):
            make_shape("triangle", 3)
```

Output of `python3 -m unittest test_shapes -v`:

```text
test_circle (test_shapes.TestMakeShape.test_circle) ... ok
test_square (test_shapes.TestMakeShape.test_square) ... ok
test_unknown_kind (test_shapes.TestMakeShape.test_unknown_kind) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

`test_square` combines a type check with a value check: the type alone would not tell you whether the side was stored correctly.

### Exercise 2

```python
import unittest

from values import parse_value


class TestParseValue(unittest.TestCase):
    def test_types(self):
        cases = [("42", int), ("true", bool), ("False", bool), ("hello", str)]
        for text, expected_type in cases:
            with self.subTest(text=text):
                self.assertIs(type(parse_value(text)), expected_type)

    def test_number_is_not_bool(self):
        self.assertNotIsInstance(parse_value("1"), bool)

    def test_values(self):
        self.assertEqual(parse_value("42"), 42)
        self.assertIs(parse_value("TRUE"), True)
        self.assertIs(parse_value("false"), False)
        self.assertEqual(parse_value("hello"), "hello")
```

Output of `python3 -m unittest test_values -v`:

```text
test_number_is_not_bool (test_values.TestParseValue.test_number_is_not_bool) ... ok
test_types (test_values.TestParseValue.test_types) ... ok
test_values (test_values.TestParseValue.test_values) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

`assertIsInstance(parse_value("true"), int)` would pass, because `True` is an instance of `int`. It could not distinguish the correct result `True` from a buggy result `1`. That is why the loop compares `type(...)` with `assertIs()`. In `test_values`, `assertIs(..., True)` is used for the same reason: `assertEqual(1, True)` would pass.

### Exercise 3

Running the broken tests gives `EFE`:

```text
ERROR: test_not_a_dict (test_broken.TestBroken.test_not_a_dict)
AttributeError: 'TestBroken' object has no attribute 'assertIsNotInstance'. Did you mean: 'assertIsInstance'?
ERROR: test_tags (test_broken.TestBroken.test_tags)
TypeError: isinstance() argument 2 cannot be a parameterized generic
FAIL: test_square_class (test_broken.TestBroken.test_square_class)
AssertionError: <class 'shape.Square'> is not an instance of <class 'shape.Shape'>
```

- `test_not_a_dict`: the method name is wrong, so the test crashes before checking anything.
- `test_tags`: `list[str]` is a type hint, not something `isinstance()` can check.
- `test_square_class`: `Square` is a class, an instance of `type`. It *inherits* from `Shape`, but it is not an *instance* of `Shape`.

The fixed version:

```python
import unittest

from shape import Shape, Square, get_tags


class TestFixed(unittest.TestCase):
    def test_tags(self):
        tags = get_tags()
        self.assertIsInstance(tags, list)
        for tag in tags:
            with self.subTest(tag=tag):
                self.assertIsInstance(tag, str)

    def test_square_class(self):
        self.assertIsSubclass(Square, Shape)

    def test_not_a_dict(self):
        self.assertNotIsInstance(get_tags(), dict)
```

Output of `python3 -m unittest test_fixed -v`:

```text
test_not_a_dict (test_fixed.TestFixed.test_not_a_dict) ... ok
test_square_class (test_fixed.TestFixed.test_square_class) ... ok
test_tags (test_fixed.TestFixed.test_tags) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

`assertIsSubclass()` was added in Python 3.14. On older versions, write `self.assertTrue(issubclass(Square, Shape))`.

---

*Source: [pythontutorial.net — Python assertIsInstance()](https://www.pythontutorial.net/python-unit-testing/python-assertisinstance/). Adapted and expanded for PyJourney.*
