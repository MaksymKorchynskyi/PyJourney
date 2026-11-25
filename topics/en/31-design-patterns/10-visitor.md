# Visitor

**Visitor** is a behavioral design pattern that moves an operation out of the classes it works on and into a separate object, the *visitor*. Once the classes can "accept" a visitor, you can add new operations (export to XML, compute totals, validate, print) without editing them again. Compilers, linters and code formatters rely on it: Python's own `ast.NodeVisitor` is a visitor.

## What you'll learn

- Which problem Visitor solves: adding operations to a stable class hierarchy you do not want to touch
- The roles in the pattern: visitor, concrete visitor, element, concrete element and client
- What **double dispatch** is and why the elements need an `accept()` method
- How to implement Visitor in Python, including visitors that return values and visitors that collect state while walking a tree
- Pythonic alternatives: name-based dispatch, `functools.singledispatchmethod` and `match`
- How `ast.NodeVisitor` and `ast.NodeTransformer` apply the pattern in the standard library

## Intent

Visitor separates an **algorithm** from the **object structure** it runs on. Each operation becomes its own class with one method per element type (`visit_city()`, `visit_industry()`, ...). The elements stay focused on their own job and only need a tiny, generic hook, `accept(visitor)`, that hands themselves to the right method of the visitor.

## Problem

Imagine a team that builds an app around a huge graph of geographic data. Every node is an object: a city, an industrial zone, a sightseeing area, and so on, and each kind of node has its own class. Nodes are connected when a road links the real places.

One day you are asked to export the graph to XML. The obvious plan: add an `export_xml()` method to every node class and walk the graph calling it. Polymorphism would pick the right implementation for each node, and the calling code would not depend on the concrete classes.

The system architect says no, and he has good reasons:

- The node classes are in production. Editing all of them risks breaking something that works today.
- XML export has nothing to do with geodata. It would look alien inside classes whose job is geography.
- XML is just the beginning. Next month marketing will want JSON, then a CSV report, then something else, and each request would mean editing the same fragile classes again.

So you need to put a new operation **outside** the classes. The first idea is a separate exporter that inspects each node (a sketch, not runnable):

```python
class XMLExporter:
    def export_city(self, city: City) -> str: ...
    def export_industry(self, industry: Industry) -> str: ...
    def export_sightseeing(self, place: Sightseeing) -> str: ...


def export_graph(graph: Graph, exporter: XMLExporter) -> None:
    for node in graph.nodes:
        if isinstance(node, City):
            exporter.export_city(node)
        elif isinstance(node, Industry):
            exporter.export_industry(node)
        elif isinstance(node, Sightseeing):
            exporter.export_sightseeing(node)
        # ...and one more branch for every node class, in every operation
```

The ladder of `isinstance()` checks must be repeated for every new operation, it is easy to forget a branch, and nothing warns you when a new node class appears.

In Java or C#, the next idea would be **method overloading**: several methods named `export()` with different parameter types. It does not help even there, because overloads are chosen at compile time by the *declared* type of the variable. In a loop over `Node` objects the declared type is always `Node`, so the compiler always picks the `export(Node)` version. Python does not have overloading at all. A second `def` with the same name simply replaces the first one:

```python
from dataclasses import dataclass


@dataclass
class Circle:
    radius: float


@dataclass
class Rectangle:
    width: float
    height: float


class Exporter:
    def export(self, shape: Circle) -> str:
        return "circle"

    def export(self, shape: Rectangle) -> str:  # silently REPLACES the first one
        return "rectangle"


print(Exporter().export(Circle(1)))
```

Output:

```text
rectangle
```

Type hints do not affect which method runs. The class ends up with a single `export()`.

## Solution

Visitor puts the new behavior into a separate class, the **visitor**, with one method per element class. The element that "should have" performed the behavior is passed to that method as an argument, so the method can read all the data it needs.

The remaining question is how to call the right method without the `isinstance()` ladder. The trick: **let the element choose**. Every element knows its own class, so each one gets a small `accept()` method that calls the matching method on the visitor:

```text
City.accept(visitor)        ->  visitor.visit_city(self)
Industry.accept(visitor)    ->  visitor.visit_industry(self)
Sightseeing.accept(visitor) ->  visitor.visit_sightseeing(self)
```

The client then writes one loop that works with any visitor:

```text
for node in graph.nodes:
    node.accept(xml_exporter)
```

Yes, the node classes had to change after all. But the change is tiny, mechanical and made **once**. Every future operation (JSON export, statistics, validation) is a new visitor class, and the nodes are never touched again. If all visitors share a common interface, every node works with every visitor, present and future.

### Double dispatch

A normal method call `obj.method()` is **single dispatch**: Python picks the implementation based on the type of *one* object, `obj`. Visitor needs the choice to depend on *two* types: what kind of element it is (city, industry) and what kind of operation it is (XML export, statistics). The pattern gets this **double dispatch** from two ordinary single-dispatch calls in a row:

```text
client                      element: Circle                visitor: AreaVisitor
  |                               |                                |
  |  shape.accept(visitor)        |                                |
  |------------------------------>|  dispatch #1: Python picks     |
  |                               |  Circle.accept by type(shape)  |
  |                               |                                |
  |                               |  visitor.visit_circle(self)    |
  |                               |------------------------------->|  dispatch #2: Python picks
  |                               |                                |  AreaVisitor.visit_circle
  |                               |                                |  by type(visitor)
  |<------------------------------------ result ------------------|
```

1. `shape.accept(visitor)` is resolved by the type of the element. `Circle.accept` runs, and inside it the element "knows" it is a circle.
2. `visitor.visit_circle(self)` is resolved by the type of the visitor. `AreaVisitor.visit_circle` computes an area, `XMLExportVisitor.visit_circle` would produce XML.

Neither the client nor the visitor checks types, and no `isinstance()` appears anywhere.

## Real-world analogy

Picture an experienced insurance agent walking through a neighborhood and visiting every building. The agent is the visitor, and his offer depends on who occupies the building:

- a residential building gets medical insurance;
- a bank gets theft insurance;
- a coffee shop gets fire and flood insurance.

The buildings do not change to make this possible. They simply "accept" the visit and say what they are. Tomorrow a tax inspector or a fire-safety inspector can walk the same street and do a completely different job, again without changing a single building.

## Structure

```text
                         +--------------------------------------+
                         | <<abstract>> ShapeVisitor[T]         |
          +------------->|--------------------------------------|
          |              | + visit_dot(dot) -> T                |
          |              | + visit_circle(circle) -> T          |
          |              | + visit_rectangle(rect) -> T         |
          |              | + visit_compound_shape(group) -> T   |
          |              +--------------------------------------+
          |                      ^                     ^
          |                      :                     :
          |           +--------------------+  +--------------------+
          |           | XMLExportVisitor   |  | AreaVisitor        |
          |           | (all visit_* ...)  |  | (all visit_* ...)  |
          |           +--------------------+  +--------------------+
+--------+|
| Client |+---------->+--------------------------------------+
+--------+            | <<abstract>> Shape                   |
                      |--------------------------------------|
                      | + accept(visitor) -> T               |
                      +--------------------------------------+
                         ^            ^            ^
                         :            :            :
            +--------------+  +--------------+  +-------------------------+
            | Dot          |  | Circle       |  | CompoundShape           |
            | accept(v):   |  | accept(v):   |  | accept(v):              |
            |  v.visit_dot |  |  v.visit_    |  |  v.visit_compound_shape |
            |   (self)     |  |  circle(self)|  |   (self)                |
            +--------------+  +--------------+  +-------------------------+
```

1. **Visitor** declares a set of visiting methods, one for each concrete element class. In languages with overloading they may share a name; in Python they need distinct names such as `visit_circle()`.
2. **Concrete visitors** implement one operation in several versions, one per element class.
3. **Element** declares `accept(visitor)`, typed with the visitor interface.
4. **Concrete elements** implement `accept()` by calling the visiting method that matches **their own** class. Even if a base element class already implements `accept()`, each subclass must override it, otherwise the visitor will treat the subclass as its parent (see "Common mistakes").
5. **Client** usually holds a collection or a complex structure, such as a Composite tree. It works with elements through the abstract interface and does not know their concrete classes.

## Python implementation

The example below adds operations to a small hierarchy of shapes. There are two visitors: one exports shapes to XML, the other computes their area. Here `accept()` **returns** whatever the visitor returns, which is the most convenient style in Python: the XML visitor produces strings, the area visitor produces floats.

```python
from __future__ import annotations

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


class Shape(ABC):
    """Element interface: every shape can accept a visitor."""

    @abstractmethod
    def accept[T](self, visitor: ShapeVisitor[T]) -> T: ...


@dataclass
class Dot(Shape):
    id: int
    x: float
    y: float

    def accept[T](self, visitor: ShapeVisitor[T]) -> T:
        return visitor.visit_dot(self)  # "I am a Dot"


@dataclass
class Circle(Shape):
    id: int
    x: float
    y: float
    radius: float

    def accept[T](self, visitor: ShapeVisitor[T]) -> T:
        return visitor.visit_circle(self)

    def diameter(self) -> float:  # exists only in Circle, not in Shape
        return 2 * self.radius


@dataclass
class Rectangle(Shape):
    id: int
    x: float
    y: float
    width: float
    height: float

    def accept[T](self, visitor: ShapeVisitor[T]) -> T:
        return visitor.visit_rectangle(self)


@dataclass
class CompoundShape(Shape):
    id: int
    children: list[Shape] = field(default_factory=list)

    def accept[T](self, visitor: ShapeVisitor[T]) -> T:
        return visitor.visit_compound_shape(self)


class ShapeVisitor[T](ABC):
    """Visitor interface: one visiting method per concrete element class."""

    @abstractmethod
    def visit_dot(self, dot: Dot) -> T: ...

    @abstractmethod
    def visit_circle(self, circle: Circle) -> T: ...

    @abstractmethod
    def visit_rectangle(self, rect: Rectangle) -> T: ...

    @abstractmethod
    def visit_compound_shape(self, compound: CompoundShape) -> T: ...


class XMLExportVisitor(ShapeVisitor[str]):
    def visit_dot(self, dot: Dot) -> str:
        return f'<dot id="{dot.id}" x="{dot.x}" y="{dot.y}"/>'

    def visit_circle(self, circle: Circle) -> str:
        # The visitor knows the concrete class, so it may call Circle-only methods
        return (f'<circle id="{circle.id}" x="{circle.x}" y="{circle.y}" '
                f'diameter="{circle.diameter()}"/>')

    def visit_rectangle(self, rect: Rectangle) -> str:
        return (f'<rectangle id="{rect.id}" x="{rect.x}" y="{rect.y}" '
                f'width="{rect.width}" height="{rect.height}"/>')

    def visit_compound_shape(self, compound: CompoundShape) -> str:
        inner = "\n".join(child.accept(self) for child in compound.children)
        inner = "\n".join("  " + line for line in inner.splitlines())
        return f'<compound id="{compound.id}">\n{inner}\n</compound>'


class AreaVisitor(ShapeVisitor[float]):
    def visit_dot(self, dot: Dot) -> float:
        return 0.0

    def visit_circle(self, circle: Circle) -> float:
        return math.pi * circle.radius ** 2

    def visit_rectangle(self, rect: Rectangle) -> float:
        return rect.width * rect.height

    def visit_compound_shape(self, compound: CompoundShape) -> float:
        return sum(child.accept(self) for child in compound.children)


def run_on_all[T](shapes: list[Shape], visitor: ShapeVisitor[T]) -> list[T]:
    """Client code: knows only Shape and ShapeVisitor, no concrete classes."""
    return [shape.accept(visitor) for shape in shapes]


drawing: list[Shape] = [
    Dot(1, 10, 20),
    CompoundShape(2, [Circle(3, 5, 5, 1.5), Rectangle(4, 0, 0, 4, 2.5)]),
]

for xml in run_on_all(drawing, XMLExportVisitor()):
    print(xml)
areas = run_on_all(drawing, AreaVisitor())
print([round(area, 2) for area in areas])
```

Output:

```text
<dot id="1" x="10" y="20"/>
<compound id="2">
  <circle id="3" x="5" y="5" diameter="3.0"/>
  <rectangle id="4" x="0" y="0" width="4" height="2.5"/>
</compound>
[0.0, 17.07]
```

Things worth noticing:

- `run_on_all()` is the client. It works with **every** visitor through the base `ShapeVisitor` interface, and the same loop runs the XML export and the area calculation.
- Adding a third operation (say, a bounding-box calculator) means writing one new class. No shape class changes.
- Each `accept()` is a one-liner that names its own class: `Circle.accept` calls `visit_circle`. That line is the whole first dispatch.
- `visit_circle()` calls `circle.diameter()`, a method that does not exist in the `Shape` interface. A visitor may use the full API of each concrete class, because each visiting method knows exactly which class it received.
- `CompoundShape` does not walk its children itself. The visitor decides how to combine them: XML nests them with indentation, the area visitor sums them.

> **Note:** `def accept[T](...)` and `class ShapeVisitor[T](ABC)` use the generic syntax added in Python 3.12. `T` is a type variable: an `XMLExportVisitor` is a `ShapeVisitor[str]`, so a type checker knows that `shape.accept(XMLExportVisitor())` returns `str`. For Python 3.10 and 3.11, write `T = TypeVar("T")` and `class ShapeVisitor(ABC, Generic[T])`. The `from __future__ import annotations` line lets `Shape` mention `ShapeVisitor` before that class is defined.

### Who walks the structure?

With a tree of objects someone must decide the order in which elements are visited. There are three common choices:

- **The visitor** walks the children, as `visit_compound_shape()` does above. This is the most flexible option: each visitor can choose pre-order, post-order, or skip a subtree entirely.
- **The elements** walk their children inside `accept()` (call `visitor.visit_x(self)` and then `child.accept(visitor)` for each child). Every visitor then gets the same traversal for free, but cannot change it.
- **A separate iterator** yields the elements, and the client calls `accept()` on each one. This is the Visitor + Iterator combination.

`ast.NodeVisitor` (shown later) uses a hybrid: a default `generic_visit()` walks the children, and any visiting method can replace that walk.

## Practical example: an expression tree

Trees of expressions are the classic home of Visitor: interpreters, compilers, query builders and template engines all store code as a tree of nodes and run many independent operations over it. Here the tree has three node types, and three visitors evaluate it, print it, and collect its variable names.

The base visitor is not abstract. It provides **default methods that just walk the tree**, so a visitor that cares about only one kind of node overrides only one method:

```python
from __future__ import annotations

import operator
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


class Expr(ABC):
    @abstractmethod
    def accept(self, visitor: ExprVisitor) -> Any: ...


@dataclass(frozen=True)
class Number(Expr):
    value: float

    def accept(self, visitor: ExprVisitor) -> Any:
        return visitor.visit_number(self)


@dataclass(frozen=True)
class Variable(Expr):
    name: str

    def accept(self, visitor: ExprVisitor) -> Any:
        return visitor.visit_variable(self)


@dataclass(frozen=True)
class BinaryOp(Expr):
    op: str  # "+", "-", "*" or "/"
    left: Expr
    right: Expr

    def accept(self, visitor: ExprVisitor) -> Any:
        return visitor.visit_binary_op(self)


class ExprVisitor:
    """Base visitor: by default it only walks the tree and returns None."""

    def visit_number(self, node: Number) -> Any:
        return None

    def visit_variable(self, node: Variable) -> Any:
        return None

    def visit_binary_op(self, node: BinaryOp) -> Any:
        node.left.accept(self)
        node.right.accept(self)
        return None


class Printer(ExprVisitor):
    def visit_number(self, node: Number) -> str:
        return f"{node.value:g}"

    def visit_variable(self, node: Variable) -> str:
        return node.name

    def visit_binary_op(self, node: BinaryOp) -> str:
        return f"({node.left.accept(self)} {node.op} {node.right.accept(self)})"


class Evaluator(ExprVisitor):
    OPS = {"+": operator.add, "-": operator.sub,
           "*": operator.mul, "/": operator.truediv}

    def __init__(self, env: dict[str, float]) -> None:
        self.env = env

    def visit_number(self, node: Number) -> float:
        return node.value

    def visit_variable(self, node: Variable) -> float:
        if node.name not in self.env:
            raise NameError(f"variable {node.name!r} is not defined")
        return self.env[node.name]

    def visit_binary_op(self, node: BinaryOp) -> float:
        left = node.left.accept(self)
        right = node.right.accept(self)
        return self.OPS[node.op](left, right)


class VariableCollector(ExprVisitor):
    """Cares only about variables; the base class walks everything else."""

    def __init__(self) -> None:
        self.names: list[str] = []

    def visit_variable(self, node: Variable) -> None:
        if node.name not in self.names:
            self.names.append(node.name)


# price * (1 + tax) - discount * price
expr = BinaryOp(
    "-",
    BinaryOp("*", Variable("price"), BinaryOp("+", Number(1), Variable("tax"))),
    BinaryOp("*", Variable("discount"), Variable("price")),
)

print(expr.accept(Printer()))
print(expr.accept(Evaluator({"price": 200, "tax": 0.2, "discount": 0.1})))

collector = VariableCollector()
expr.accept(collector)
print(collector.names)

try:
    expr.accept(Evaluator({"price": 200}))
except NameError as exc:
    print("NameError:", exc)
```

Output:

```text
((price * (1 + tax)) - (discount * price))
220.0
['price', 'tax', 'discount']
NameError: variable 'tax' is not defined
```

Design decisions in this version:

- **Nodes are pure data.** `Number`, `Variable` and `BinaryOp` are frozen dataclasses with a one-line `accept()`. Evaluation, printing and analysis live elsewhere, so the node classes stay small and stable.
- **Values flow up, state accumulates.** `Printer` and `Evaluator` *return* results and build them bottom-up. `VariableCollector` returns nothing and *accumulates* state in `self.names` while it travels. Both styles are legitimate. Collecting information across a whole structure is one of the pattern's strengths.
- **Partial visitors.** `VariableCollector` implements only `visit_variable()`. This matches a typical use case: a behavior that makes sense only for some classes of a hierarchy. The default methods of `ExprVisitor` keep the walk going through all other nodes.
- **Dependencies are injected into the visitor.** `Evaluator` receives the variable values in its constructor. The same tree can be evaluated with different environments, and the nodes know nothing about environments.

> **Tip:** A default base visitor trades safety for convenience. If you later add a `FunctionCall` node and forget to handle it in `Evaluator`, the default method quietly returns `None` instead of failing. When an operation **must** cover every node type, make the visitor methods abstract (as in `ShapeVisitor`) so Python refuses to create an incomplete visitor.

## Pythonic alternatives to `accept()`

The classic pattern exists because languages like Java dispatch methods only on the receiver's type. Python is more flexible, and there are three common ways to get the same effect, often **without touching the element classes at all**. This matters when the classes come from a library you cannot change.

### Name-based dispatch with `getattr()`

A visitor can build the method name from the class name and look it up itself. This is exactly how `ast.NodeVisitor` works:

```python
import math
from dataclasses import dataclass
from typing import Any


@dataclass
class Circle:  # plain data classes: no accept() anywhere
    radius: float


@dataclass
class Rectangle:
    width: float
    height: float


@dataclass
class Group:
    children: list


class NodeVisitor:
    """Picks visit_<ClassName> by name, the way ast.NodeVisitor does."""

    def visit(self, node: Any) -> Any:
        method = getattr(self, f"visit_{type(node).__name__}", self.generic_visit)
        return method(node)

    def generic_visit(self, node: Any) -> Any:
        raise TypeError(f"{type(self).__name__} cannot handle {type(node).__name__}")


class AreaCalculator(NodeVisitor):
    def visit_Circle(self, node: Circle) -> float:
        return math.pi * node.radius ** 2

    def visit_Rectangle(self, node: Rectangle) -> float:
        return node.width * node.height

    def visit_Group(self, node: Group) -> float:
        return sum(self.visit(child) for child in node.children)


scene = Group([Circle(1), Rectangle(2, 3), Group([Rectangle(1, 1)])])
print(round(AreaCalculator().visit(scene), 2))

try:
    AreaCalculator().visit("triangle")
except TypeError as exc:
    print("TypeError:", exc)
```

Output:

```text
10.14
TypeError: AreaCalculator cannot handle str
```

The elements need no `accept()`, and a visitor implements only the methods it needs. The price: the lookup is by **name**, not by type. A subclass with a different name (`class Square(Rectangle)`) is not routed to `visit_Rectangle` and falls into `generic_visit()`, and a typo such as `visit_Cirle` is silently never called.

### `functools.singledispatchmethod`

`functools.singledispatch` turns a function into a **generic function** that picks an implementation by the type of its first argument. `singledispatchmethod` does the same for methods, dispatching on the first argument after `self`. Implementations are registered by type annotation, and the lookup follows the class hierarchy (the MRO), so subclasses are handled correctly:

```python
import math
from dataclasses import dataclass
from functools import singledispatchmethod


@dataclass
class Circle:
    radius: float


@dataclass
class Rectangle:
    width: float
    height: float


class Square(Rectangle):  # a subclass that nobody registered
    def __init__(self, side: float) -> None:
        super().__init__(side, side)


@dataclass
class Group:
    children: list


class AreaCalculator:
    def __init__(self) -> None:
        self.visited = 0  # a visitor may keep state between calls

    @singledispatchmethod
    def area(self, shape: object) -> float:
        raise TypeError(f"unsupported shape: {type(shape).__name__}")

    @area.register
    def _(self, shape: Circle) -> float:
        self.visited += 1
        return math.pi * shape.radius ** 2

    @area.register
    def _(self, shape: Rectangle) -> float:
        self.visited += 1
        return shape.width * shape.height

    @area.register
    def _(self, shape: Group) -> float:
        return sum(self.area(child) for child in shape.children)


calc = AreaCalculator()
print(round(calc.area(Group([Circle(1), Rectangle(2, 3), Square(2)])), 2))
print("shapes visited:", calc.visited)
try:
    calc.area(42)
except TypeError as exc:
    print("TypeError:", exc)
```

Output:

```text
13.14
shapes visited: 3
TypeError: unsupported shape: int
```

`Square(2)` was handled by the `Rectangle` implementation because `Square` inherits from it. The undecorated method is the fallback for every unregistered type, so it is the natural place to raise an error.

For free functions, use `singledispatch`. It works with any type, including built-ins, and since Python 3.11 `register` also understands union annotations:

```python
from functools import singledispatch


@singledispatch
def to_text(value: object) -> str:
    return repr(value)  # fallback for every unregistered type


@to_text.register
def _(value: int | float) -> str:  # union types: Python 3.11+
    return f"number {value}"


@to_text.register
def _(value: list) -> str:
    return "[" + ", ".join(to_text(item) for item in value) + "]"


print(to_text([1, 2.5, "a", [True]]))
print(to_text.dispatch(bool) is to_text.dispatch(int))
```

Output:

```text
[number 1, number 2.5, 'a', [number True]]
True
```

Notice `number True`: `bool` is a subclass of `int`, so `True` goes to the `int` implementation. Following inheritance is usually what you want, but register `bool` separately if it needs different treatment.

### Structural pattern matching

Since Python 3.10, `match` can branch on the class of an object and unpack its attributes in one step. For a small, closed set of classes, one function with a `match` statement is often the shortest way to write an operation:

```python
import math
from dataclasses import dataclass
from typing import assert_never


@dataclass
class Circle:
    radius: float


@dataclass
class Rectangle:
    width: float
    height: float


@dataclass
class Group:
    children: list["Shape"]


type Shape = Circle | Rectangle | Group  # Python 3.12+ type alias


def area(shape: Shape) -> float:
    match shape:
        case Circle(radius=r):
            return math.pi * r ** 2
        case Rectangle(width=w, height=h):
            return w * h
        case Group(children=children):
            return sum(area(child) for child in children)
        case _:
            assert_never(shape)  # a type checker reports any missing case here


def describe(shape: Shape) -> str:
    match shape:
        case Circle(radius=r) if r > 10:
            return "big circle"
        case Circle():
            return "circle"
        case Rectangle(width=w, height=h) if w == h:
            return f"square {w}x{h}"
        case Rectangle():
            return "rectangle"
        case Group(children=[]):
            return "empty group"
        case Group(children=children):
            return f"group of {len(children)}"
        case _:
            assert_never(shape)


scene = Group([Circle(1), Rectangle(2, 3), Group([])])
print(round(area(scene), 2))
print([describe(s) for s in (Circle(20), Rectangle(2, 2), *scene.children)])
try:
    area("triangle")
except AssertionError as exc:
    print("AssertionError:", exc)
```

Output:

```text
9.14
['big circle', 'square 2x2', 'circle', 'rectangle', 'empty group']
AssertionError: Expected code to be unreachable, but got: 'triangle'
```

`case Circle(radius=r)` matches instances of `Circle` (and its subclasses) and binds `r`. Patterns can also look inside the data (`children=[]`) and add guards (`if w == h`), something the classic visitor cannot do. `typing.assert_never()` (Python 3.11+) is a safety net: at runtime it raises `AssertionError`, and a type checker such as mypy or pyright reports an error if a member of the `Shape` union is not handled before it.

### Which one to choose?

| | Classic `accept()` | Name-based `getattr()` | `singledispatchmethod` | `match` |
|---|---|---|---|---|
| Element classes must change | Yes, once | No | No | No |
| Works for classes you cannot edit | No | Yes | Yes (even built-ins) | Yes |
| Subclasses dispatch to the parent's handler | Only if they override `accept()` | No (by name) | Yes (MRO) | Yes |
| Missing handler detected | At instantiation, with an abstract visitor | No (falls into `generic_visit`) | No (falls into the fallback) | By a type checker with `assert_never` |
| Can match on data, not only type | No | No | No | Yes |
| Typical use | Large stable hierarchies, typed code | Tree walkers (`ast`) | Extensible operations on many types | Small closed sets of classes |

The idea is the same in all four: **an operation over many types is kept in one place, apart from the types themselves**. The classic form is the one you will see in books and in code ported from Java, C# or C++. In Python code, `singledispatch` and `match` are frequently the more natural choice.

## Visitor in the standard library: `ast`

The `ast` module parses Python source into a tree of node objects (`ast.FunctionDef`, `ast.Import`, `ast.Call`, ...). `ast.NodeVisitor` is a visitor for this tree, and it uses the name-based dispatch shown above: `visit(node)` calls `visit_<ClassName>(node)` if it exists, otherwise `generic_visit(node)`, which visits all the children. Linters, formatters and refactoring tools are built this way.

```python
import ast

source = '''
import json
from pathlib import Path


def load(path):
    """Read a JSON file."""
    return json.loads(Path(path).read_text())


def save(path, data):
    def encode(obj):
        return json.dumps(obj, indent=2)
    Path(path).write_text(encode(data))
'''


class CodeReport(ast.NodeVisitor):
    def __init__(self) -> None:
        self.imports: list[str] = []
        self.functions: list[str] = []

    def visit_Import(self, node: ast.Import) -> None:
        self.imports += [alias.name for alias in node.names]

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        self.imports += [f"{node.module}.{alias.name}" for alias in node.names]

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        documented = ast.get_docstring(node) is not None
        self.functions.append(f"{node.name} (line {node.lineno}, docstring: {documented})")
        self.generic_visit(node)  # keep walking: nested functions live inside


report = CodeReport()
report.visit(ast.parse(source))
print(report.imports)
print(*report.functions, sep="\n")
```

Output:

```text
['json', 'pathlib.Path']
load (line 6, docstring: True)
save (line 11, docstring: False)
encode (line 12, docstring: False)
```

`CodeReport` is a stateful visitor: it collects facts while the tree is walked. It implements only three of the more than a hundred node types, and `generic_visit()` takes care of the rest. The call `self.generic_visit(node)` inside `visit_FunctionDef()` is what lets the visitor reach `encode`, the function nested inside `save`.

`ast.NodeTransformer` is a visitor that **returns new nodes**: whatever a `visit_*` method returns replaces the original node in the tree (returning `None` deletes it). This is how code-rewriting tools work:

```python
import ast


class PrintToLog(ast.NodeTransformer):
    """Rewrites every print(...) call into log.info(...)."""

    def visit_Call(self, node: ast.Call) -> ast.Call:
        self.generic_visit(node)  # transform the arguments first
        if isinstance(node.func, ast.Name) and node.func.id == "print":
            node.func = ast.Attribute(
                value=ast.Name(id="log", ctx=ast.Load()), attr="info", ctx=ast.Load()
            )
        return node  # the returned node replaces the original one


code = """
print("start")
if debug:
    print("details:", len(items))
"""
tree = PrintToLog().visit(ast.parse(code))
print(ast.unparse(tree))
```

Output:

```text
log.info('start')
if debug:
    log.info('details:', len(items))
```

`ast.unparse()` (Python 3.9+) turns the tree back into source code. If you want to `compile()` a transformed tree, call `ast.fix_missing_locations(tree)` first, because the new nodes have no line numbers.

> **Note:** Old tutorials define `visit_Num` or `visit_Str`. Since Python 3.8 all literals are `ast.Constant` nodes, so write `visit_Constant`. The old `ast.Num`, `ast.Str` and similar classes were removed in Python 3.14.

## When to use it

- You need to run an operation over **all elements of a complex structure** (an object tree, a graph, a document, a syntax tree) whose elements have different classes.
- The element classes are **stable**, but new operations keep coming. You want to add them without editing the elements every time.
- You want to keep auxiliary behavior (export, reporting, validation) **out of the business classes**, so those classes stay focused on their main job.
- A behavior makes sense **only for some classes** of the hierarchy. A visitor can implement only the relevant methods and leave the others empty or default.

Do not use Visitor when the set of element classes changes often: every new element class means updating every visitor. And if you have one or two operations, plain methods on the classes are simpler.

## How to implement it

1. Declare the visitor interface with one visiting method per concrete element class (`visit_dot()`, `visit_circle()`, ...). Make them abstract if every visitor must handle every element.
2. Declare the element interface. In an existing hierarchy, add an abstract `accept(visitor)` method to the base class.
3. Implement `accept()` in **every** concrete element class. It only calls the visiting method that matches the element's own class and passes `self`.
4. Elements work with visitors only through the visitor interface. Visitors, on the other hand, know all concrete element classes, because those are the parameter types of the visiting methods.
5. For each new behavior, create a concrete visitor class and implement the visiting methods. If a visitor needs data the elements keep private, either expose it through public read-only properties or rethink the split. Python has no truly private members, but reading `_attributes` from outside couples the visitor to implementation details.
6. Decide who traverses composite structures: the visitor, the elements, or an iterator.
7. In the client, create visitors and pass them to elements through `accept()`.

## Pros and cons

**Pros:**

- *Open/Closed Principle*: a new operation over objects of different classes is a new visitor class. The classes themselves do not change.
- *Single Responsibility Principle*: all versions of one operation live together in one class instead of being spread across the hierarchy.
- A visitor can **accumulate information** while it walks a structure: counts, totals, names found, errors.
- A visitor can call class-specific methods on each element, because each visiting method knows the concrete class it received.

**Cons:**

- Adding or removing an element class means updating **every** visitor.
- Visitors may lack access to the private data of elements, which tempts developers to weaken encapsulation.
- The double-dispatch round trip (`accept()` calling back into the visitor) is hard to follow for newcomers and adds boilerplate in every element class.
- A visitor ties the operation to the shape of the hierarchy. Large changes to the hierarchy ripple through all visitors.

This trade-off is known as the **expression problem**. With ordinary methods on classes, adding a new *type* is easy (one new class) and adding a new *operation* is hard (edit every class). Visitor flips it: adding an operation is easy, and adding a type is hard. Choose based on which of the two will change more often.

## Relations with other patterns

- **Visitor and Command.** A visitor can be seen as a powerful version of Command: it is an object that carries an operation, but it can execute that operation over objects of many different classes.
- **Visitor and Composite.** Visitor is a natural way to run an operation over an entire Composite tree, as `CompoundShape` and the expression tree show above.
- **Visitor and Iterator.** An Iterator can walk a complex data structure while a Visitor performs an operation on each element, even when the elements have different classes.
- **Visitor vs Strategy.** A strategy replaces *one* algorithm inside a context object. A visitor carries *one operation with a variant for each element class* and is applied across many objects.

## Common mistakes

- **Inheriting `accept()` in a subclass.** A subclass that does not override `accept()` reuses the parent's version, so the visitor receives it through the parent's method and treats it as the parent:

  ```python
  import math
  from dataclasses import dataclass


  @dataclass
  class Circle:
      radius: float

      def accept(self, visitor):
          return visitor.visit_circle(self)


  @dataclass
  class Ring(Circle):  # BUG: inherits Circle.accept
      inner_radius: float = 0.0


  class AreaVisitor:
      def visit_circle(self, circle: Circle) -> float:
          return math.pi * circle.radius ** 2

      def visit_ring(self, ring: Ring) -> float:
          return math.pi * (ring.radius ** 2 - ring.inner_radius ** 2)


  ring = Ring(radius=2, inner_radius=1)
  print(round(ring.accept(AreaVisitor()), 2))  # computed as a full circle


  class FixedRing(Ring):
      def accept(self, visitor):
          return visitor.visit_ring(self)  # every concrete element picks its own method


  print(round(FixedRing(radius=2, inner_radius=1).accept(AreaVisitor()), 2))
  ```

  Output:

  ```text
  12.57
  9.42
  ```

  No error, just a wrong answer: the hole in the ring was ignored. Override `accept()` in every concrete element class.

- **Calling the wrong visiting method in `accept()`.** Copy-pasting `accept()` from `Circle` into `Rectangle` and forgetting to change `visit_circle` to `visit_rectangle` sends rectangles to the circle code. Each `accept()` should name its own class, and a quick test per element class catches this.

- **Adding an element class and forgetting the visitors.** With an abstract visitor interface Python catches it, as soon as you add the new abstract method:

  ```python
  from abc import ABC, abstractmethod


  class ShapeVisitor(ABC):
      @abstractmethod
      def visit_circle(self, circle) -> float: ...

      @abstractmethod
      def visit_triangle(self, triangle) -> float: ...  # added with the new Triangle class


  class AreaVisitor(ShapeVisitor):  # written before Triangle existed
      def visit_circle(self, circle) -> float:
          return 3.14 * circle.radius ** 2


  try:
      AreaVisitor()
  except TypeError as exc:
      print("TypeError:", exc)
  ```

  Output:

  ```text
  TypeError: Can't instantiate abstract class AreaVisitor without an implementation for abstract method 'visit_triangle'
  ```

  With a base visitor that has default methods, or with name-based dispatch, the same omission passes silently. Choose deliberately.

- **Forgetting `generic_visit()` in a tree visitor.** In `ast.NodeVisitor`, defining `visit_FunctionDef()` *replaces* the default walk for that node. Without a call to `self.generic_visit(node)`, nothing inside the function is visited:

  ```python
  import ast


  class FunctionNames(ast.NodeVisitor):
      def __init__(self) -> None:
          self.names: list[str] = []

      def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
          self.names.append(node.name)  # BUG: no self.generic_visit(node)


  finder = FunctionNames()
  finder.visit(ast.parse("def outer():\n    def inner():\n        pass\n"))
  print(finder.names)
  ```

  Output:

  ```text
  ['outer']
  ```

  `inner` is missing. Call `self.generic_visit(node)` whenever the children should still be visited.

- **Reusing a stateful visitor.** A visitor that collects data (like `VariableCollector` or `CodeReport`) keeps it after the walk. Running it over a second structure mixes the results of both. Create a fresh visitor per run, or reset its state at the start of a public `run()` method.
- **Using Visitor for a hierarchy that keeps changing.** If new element classes appear every week, each one forces changes to all visitors. Ordinary polymorphic methods fit better in that case.
- **Replacing double dispatch with an `isinstance()` ladder** inside the visitor. That brings back exactly the problem the pattern solves. If you do not want `accept()`, use `singledispatch` or `match`, which keep the dispatch in one declarative place.

## Summary

- Visitor moves an operation into a separate class with one method per element class, so new operations can be added without editing the elements.
- Elements implement a one-line `accept(visitor)` that calls the visiting method for their own class. Together with the call on the visitor, this gives double dispatch: the code that runs depends on both the element type and the visitor type.
- Python has no method overloading, and type hints do not influence which method runs. That is why the classic pattern names visiting methods explicitly (`visit_circle`).
- Visitors can return values (`accept()` returns the visitor's result) or accumulate state while walking a structure such as a Composite tree.
- Pythonic alternatives keep the idea but drop `accept()`: name-based dispatch (`ast.NodeVisitor`), `functools.singledispatch` / `singledispatchmethod`, and `match`.
- `ast.NodeVisitor` and `ast.NodeTransformer` are the standard library's visitors. Remember `generic_visit()` to keep walking the tree.
- Visitor makes new operations cheap and new element classes expensive. Use it when the hierarchy is stable and the operations keep growing.

## Practice

### Exercise 1: Insurance agent

Model the real-world analogy. Create the elements `ResidentialBuilding(address, residents)`, `Bank(name, vault_millions)` and `CoffeeShop(name, seats)` with `accept()` methods, an abstract `BuildingVisitor`, and two visitors:

- `InsuranceAgent` returns an offer: medical insurance for residential buildings (mention the number of residents), theft insurance for banks, fire and flood insurance for coffee shops;
- `PremiumCalculator` returns a monthly price: 15 UAH per resident, 1000 UAH per million in the vault, and 500 UAH plus 20 UAH per seat for a coffee shop.

Walk a street of three buildings and print the offer and the price for each one. The loop must not use `isinstance()`.

### Exercise 2: Disk usage without `accept()`

The classes `File(name, size)` and `Directory(name, children)` come from a library you cannot modify, so they have no `accept()`. Using `functools.singledispatchmethod`, write:

- `DiskUsage` with a method `size(node)` that returns the size in bytes: a file returns its own size, a directory returns the sum of its children;
- `TreePrinter` with a method `show(node, depth=0)` that collects an indented tree into a list `lines`, four spaces per level. Directories end with `/` and show their total size (reuse `DiskUsage`).

Unknown node types must raise `TypeError`. Test it with a project folder that contains a file, a subfolder with two files, and an empty folder.

### Exercise 3: A code audit with `ast.NodeVisitor`

Write `FunctionAudit(ast.NodeVisitor)` that, for every function in a piece of source code, records:

- its name;
- the number of parameters (positional-only, regular, keyword-only, plus `*args` and `**kwargs` if present);
- whether it has a docstring;
- the number of `if`, `for`, `while` and `try` statements **in that function's own body**. Branches inside a nested function belong to the nested function, not to the outer one.

Methods, nested functions and `async def` functions must all be included. Print one line per function and mark the functions without a docstring.

## Solutions

### Exercise 1

```python
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


class Building(ABC):
    @abstractmethod
    def accept(self, visitor: BuildingVisitor) -> str: ...


@dataclass
class ResidentialBuilding(Building):
    address: str
    residents: int

    def accept(self, visitor: BuildingVisitor) -> str:
        return visitor.visit_residential(self)


@dataclass
class Bank(Building):
    name: str
    vault_millions: float

    def accept(self, visitor: BuildingVisitor) -> str:
        return visitor.visit_bank(self)


@dataclass
class CoffeeShop(Building):
    name: str
    seats: int

    def accept(self, visitor: BuildingVisitor) -> str:
        return visitor.visit_coffee_shop(self)


class BuildingVisitor(ABC):
    @abstractmethod
    def visit_residential(self, building: ResidentialBuilding) -> str: ...

    @abstractmethod
    def visit_bank(self, bank: Bank) -> str: ...

    @abstractmethod
    def visit_coffee_shop(self, shop: CoffeeShop) -> str: ...


class InsuranceAgent(BuildingVisitor):
    def visit_residential(self, building: ResidentialBuilding) -> str:
        return f"{building.address}: medical insurance for {building.residents} residents"

    def visit_bank(self, bank: Bank) -> str:
        return f"{bank.name}: theft insurance"

    def visit_coffee_shop(self, shop: CoffeeShop) -> str:
        return f"{shop.name}: fire and flood insurance"


class PremiumCalculator(BuildingVisitor):
    def visit_residential(self, building: ResidentialBuilding) -> str:
        return f"{building.residents * 15} UAH"

    def visit_bank(self, bank: Bank) -> str:
        return f"{bank.vault_millions * 1000:.0f} UAH"

    def visit_coffee_shop(self, shop: CoffeeShop) -> str:
        return f"{500 + shop.seats * 20} UAH"


street: list[Building] = [
    ResidentialBuilding("Shevchenka St 5", residents=40),
    Bank("City Bank", vault_millions=2.5),
    CoffeeShop("Corner Coffee", seats=24),
]

agent, calculator = InsuranceAgent(), PremiumCalculator()
for building in street:
    print(f"{building.accept(agent)} -> {building.accept(calculator)} per month")
```

Output:

```text
Shevchenka St 5: medical insurance for 40 residents -> 600 UAH per month
City Bank: theft insurance -> 2500 UAH per month
Corner Coffee: fire and flood insurance -> 980 UAH per month
```

The loop calls `building.accept(...)` and never checks a type: each building routes the visitor to the right method itself. `PremiumCalculator` was added without changing a single building class, which is exactly what the pattern promises.

### Exercise 2

```python
from dataclasses import dataclass, field
from functools import singledispatchmethod


# "Library" classes: we are not allowed to change them, and they have no accept()
@dataclass
class File:
    name: str
    size: int


@dataclass
class Directory:
    name: str
    children: list = field(default_factory=list)


class DiskUsage:
    @singledispatchmethod
    def size(self, node: object) -> int:
        raise TypeError(f"unknown node: {type(node).__name__}")

    @size.register
    def _(self, node: File) -> int:
        return node.size

    @size.register
    def _(self, node: Directory) -> int:
        return sum(self.size(child) for child in node.children)


class TreePrinter:
    def __init__(self) -> None:
        self.usage = DiskUsage()
        self.lines: list[str] = []

    @singledispatchmethod
    def show(self, node: object, depth: int = 0) -> None:
        raise TypeError(f"unknown node: {type(node).__name__}")

    @show.register
    def _(self, node: File, depth: int = 0) -> None:
        self.lines.append(f"{'    ' * depth}{node.name} ({node.size} B)")

    @show.register
    def _(self, node: Directory, depth: int = 0) -> None:
        self.lines.append(f"{'    ' * depth}{node.name}/ ({self.usage.size(node)} B)")
        for child in node.children:
            self.show(child, depth + 1)


project = Directory("project", [
    File("README.md", 1200),
    Directory("src", [File("main.py", 3400), File("utils.py", 800)]),
    Directory("empty"),
])

print(DiskUsage().size(project))
printer = TreePrinter()
printer.show(project)
print("\n".join(printer.lines))

try:
    DiskUsage().size("notes.txt")
except TypeError as exc:
    print("TypeError:", exc)
```

Output:

```text
5400
project/ (5400 B)
    README.md (1200 B)
    src/ (4200 B)
        main.py (3400 B)
        utils.py (800 B)
    empty/ (0 B)
TypeError: unknown node: str
```

`singledispatchmethod` dispatches on the first argument after `self`, so the extra `depth` parameter is fine. It must be passed after the node, and the node itself must be passed positionally. The library classes were not touched. `TreePrinter` combines two visitors: it walks the tree itself and asks `DiskUsage` for directory totals.

### Exercise 3

```python
import ast
from dataclasses import dataclass


@dataclass
class FunctionInfo:
    name: str
    params: int
    documented: bool
    branches: int = 0


class FunctionAudit(ast.NodeVisitor):
    def __init__(self) -> None:
        self.report: list[FunctionInfo] = []
        self._stack: list[FunctionInfo] = []  # functions we are currently inside

    def visit_FunctionDef(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> None:
        args = node.args
        params = len(args.posonlyargs) + len(args.args) + len(args.kwonlyargs)
        params += (args.vararg is not None) + (args.kwarg is not None)
        info = FunctionInfo(node.name, params, ast.get_docstring(node) is not None)
        self.report.append(info)
        self._stack.append(info)
        self.generic_visit(node)  # visit the body (and nested functions)
        self._stack.pop()

    visit_AsyncFunctionDef = visit_FunctionDef  # same handling for async def

    def _branch(self, node: ast.AST) -> None:
        if self._stack:  # count only the innermost function
            self._stack[-1].branches += 1
        self.generic_visit(node)

    visit_If = visit_For = visit_While = visit_Try = _branch


source = '''
class Shop:
    def checkout(self, cart, *, coupon=None):
        """Pay for the cart."""
        for item in cart:
            if item.price < 0:
                raise ValueError(item)
        if coupon:
            def apply(total):
                return total * 0.9 if total > 100 else total
        try:
            pay(cart)
        except PaymentError:
            retry(cart)


async def fetch(url, *args, **kwargs):
    while True:
        pass
'''

audit = FunctionAudit()
audit.visit(ast.parse(source))
for info in audit.report:
    flag = "" if info.documented else "  <- missing docstring"
    print(f"{info.name}: params={info.params}, branches={info.branches}{flag}")
```

Output:

```text
checkout: params=3, branches=4
apply: params=1, branches=0  <- missing docstring
fetch: params=3, branches=1  <- missing docstring
```

The stack of "functions we are inside" is the visitor's state. Entering a function pushes its record, `generic_visit()` walks the body, and leaving pops it, so a branch is always credited to the innermost function. `checkout` has four branches (`for`, the `if` inside it, `if coupon` and `try`). `self` counts as a parameter. `apply` has none, because `x if cond else y` is a conditional *expression* (`ast.IfExp`), not an `if` statement. Assigning one method to several names (`visit_If = visit_For = ...`) is a compact way to give several node types the same handling. In Python 3.11+ you could also add `visit_TryStar` for `try` / `except*` blocks.

---

*Sources: [Refactoring.Guru — Visitor](https://refactoring.guru/design-patterns/visitor), [Refactoring.Guru — Visitor in Python](https://refactoring.guru/design-patterns/visitor/python/example). Adapted and expanded for PyJourney.*
