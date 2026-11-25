# Garbage Collection

Python frees memory for you, so you never call anything like `free()`. Most objects are destroyed by **reference counting** the moment nothing refers to them. Reference counting has one blind spot: objects that refer to each other in a cycle. The **garbage collector** exists to find and destroy those cycles, and the `gc` module lets you observe and control it.

## What you'll learn

- Why reference counting alone cannot free reference cycles
- How the cycle collector decides which objects are garbage
- How to use the `gc` module: `collect()`, `disable()`, `enable()`, `isenabled()`, `get_threshold()`, `is_tracked()`
- How to watch objects die safely with `weakref` instead of reading raw memory
- What generations are and why the collector uses them
- How to avoid cycles in the first place, and when (rarely) to switch the collector off

## Two mechanisms working together

CPython, the standard interpreter, manages memory with two cooperating mechanisms:

| Mechanism | What it handles | When it runs |
|---|---|---|
| Reference counting | Every object | Immediately, whenever a count drops to zero |
| Cycle garbage collector | Groups of objects that refer to each other | Periodically, or when you call `gc.collect()` |

Reference counting does almost all of the work. It is simple and predictable: as soon as the last reference to an object disappears, the object is destroyed (see the previous topic on references). The garbage collector is a backup that only deals with the case reference counting cannot handle.

> **Note:** In Python documentation "the garbage collector" usually means this *cycle* collector, not memory management in general. Other implementations, such as PyPy, use a completely different collector, so everything about timing below is CPython-specific.

## The problem: reference cycles

A **reference cycle** appears when objects refer to each other, directly or through a chain. The simplest cycle is an object that refers to itself:

```python
items = []
items.append(items)   # the list now contains itself

print(items)
print(items[0] is items)
```

Output:

```text
[[...]]
True
```

Python prints `[...]` to avoid infinite recursion when displaying the list.

A more realistic cycle comes from two objects that know about each other: a parent and a child, a node and its neighbour, a client and a server connection.

```text
before del:                          after del first, second:

first ---> +----------+                 +----------+
           | "first"  |                 | "first"  |  refcount 1
           +----------+                 +----------+
            |      ^                     |      ^
    partner |      | partner     partner |      | partner
            v      |                     v      |
           +----------+                 +----------+
second --> | "second" |                 | "second" |  refcount 1
           +----------+                 +----------+

                                        no name outside points to the pair
```

After the names are deleted, each object still has a reference count of 1, because the *other* object refers to it. The counts never reach zero, so reference counting never frees them, even though your program can no longer reach either object. Without a cycle collector this memory would leak.

You can see this with `weakref.finalize`, which prints a message when an object is destroyed:

```python
import gc
import weakref


class Node:
    def __init__(self, name):
        self.name = name
        self.partner = None


gc.disable()

first = Node("first")
second = Node("second")
first.partner = second
second.partner = first

weakref.finalize(first, print, "first destroyed")
weakref.finalize(second, print, "second destroyed")

print("deleting both names...")
del first, second
print("names are gone, but the objects are still alive")

print("running gc.collect()...")
gc.collect()
print("done")

gc.enable()
```

Output:

```text
deleting both names...
names are gone, but the objects are still alive
running gc.collect()...
first destroyed
second destroyed
done
```

`gc.disable()` switches off *automatic* collection so the example is predictable. Nothing is destroyed by `del`. Only `gc.collect()` finds the cycle and frees both objects. The order of the two "destroyed" lines is not guaranteed.

Compare this with an object that is not part of a cycle. Reference counting destroys it immediately, with no help from the collector:

```python
import weakref


class Node:
    def __init__(self, name):
        self.name = name


first = Node("first")
weakref.finalize(first, print, "first destroyed")
print("deleting...")
del first
print("done")
```

Output:

```text
deleting...
first destroyed
done
```

## Interacting with the collector: the `gc` module

The original version of this lesson uses the `A`/`B` classes below: creating an `A` automatically creates a `B` that points back to it. The steps are: disable automatic collection, create the cycle, drop the only outside reference, check that the objects survive, run the collector, and check that they are gone.

```python
import gc
import sys
import weakref


class A:
    def __init__(self):
        self.b = B(self)


class B:
    def __init__(self, a):
        self.a = a


gc.disable()  # stop automatic collection for this experiment

a = A()
a_ref = weakref.ref(a)    # weak references do not keep objects alive
b_ref = weakref.ref(a.b)

print("refs to A:", sys.getrefcount(a) - 1)
print("refs to B:", sys.getrefcount(a.b) - 1)

a = None
print("A alive?", a_ref() is not None)
print("B alive?", b_ref() is not None)

found = gc.collect()
print("unreachable objects found:", found)
print("A alive?", a_ref() is not None)
print("B alive?", b_ref() is not None)

gc.enable()
```

Output (Python 3.14):

```text
refs to A: 2
refs to B: 1
A alive? True
B alive? True
unreachable objects found: 2
A alive? False
B alive? False
```

What happens step by step:

1. The `A` instance has two references: the variable `a` and the attribute `B.a`. The `B` instance has one: the attribute `A.b`. (We subtract 1 from `sys.getrefcount()` to ignore its temporary reference.)
2. `a = None` removes the only reference from outside the cycle. Both counts are still above zero, so both objects survive.
3. `gc.collect()` detects that the pair is unreachable, destroys it, and returns how many unreachable objects it found. The exact number is a version detail: older versions also count each instance's `__dict__`, so you may see a larger number there.

A **weak reference** (`weakref.ref(obj)`) lets you refer to an object without increasing its reference count. Calling the weak reference returns the object while it is alive, and `None` after it has been destroyed. That makes it the right tool for asking "does this object still exist?".

> **Note:** Instances of your own classes support weak references. Built-in `list`, `dict`, `int`, `str` and `tuple` do not: `weakref.ref([])` raises `TypeError: cannot create weak reference to 'list' object`.

### Why not `ctypes` and `gc.get_objects()`?

Older tutorials check the same thing with two helpers: one reads the reference count directly from memory with `ctypes.c_long.from_address(id(obj)).value`, the other loops over `gc.get_objects()` looking for a matching `id()`. Both are unreliable:

- After the object is destroyed, `from_address()` reads **freed memory**. Seeing `0` there is luck. It can just as well show garbage or crash the interpreter.
- `id()` values are reused. A new object can be allocated at the same address, so "an object with this `id` exists" does not prove that it is *your* object.
- `gc.get_objects()` lists only objects the collector tracks. An `int` or `str` never appears there, even while alive.

Use `weakref.ref()` or `weakref.finalize()` for existence checks and `sys.getrefcount()` for counts.

## How the collector finds garbage

The collector only looks at **container objects**: objects that can hold references to other objects, such as lists, dicts, sets and instances of your classes. Atomic objects like numbers and strings cannot form cycles, so the collector does not track them. `gc.is_tracked()` shows the difference:

```python
import gc


class Point:
    pass


print(gc.is_tracked(42))
print(gc.is_tracked("hello"))
print(gc.is_tracked(3.14))
print(gc.is_tracked([]))
print(gc.is_tracked(Point()))
```

Output:

```text
False
False
False
True
True
```

> **Note:** Some containers, such as tuples that hold only atomic values, may be untracked as an optimisation. Exactly which objects are tracked differs between Python versions.

A simplified version of the algorithm:

1. For every tracked object, copy its reference count into a temporary counter.
2. For every reference *from one tracked object to another*, subtract 1 from the target's counter.
3. An object whose counter is still above zero is referenced from **outside** the group (by a variable, a module, the call stack, and so on). It is reachable, and so is everything it refers to.
4. All remaining objects are unreachable garbage. The collector runs their finalizers, clears their references to break the cycle, and reference counting then frees them.

Applied to the `A`/`B` example after `a = None`:

```text
                 refcount   minus internal refs   result
A instance          1        1 - 1 (from B.a) = 0   unreachable
B instance          1        1 - 1 (from A.b) = 0   unreachable
```

If `a` still referred to the `A` instance, its count would be 2, the counter would end at 1, and both objects would be kept: `A` because something outside refers to it, `B` because `A` refers to it.

## Generations: when the collector runs

Scanning every container on each run would be slow in big programs. CPython relies on an observation: **most objects die young**. Temporary lists, dicts and instances usually disappear within a few lines of code, while objects that survive a while (configuration, caches, module-level data) tend to live for the whole program.

So objects are grouped into **generations**:

- New container objects start in the youngest generation.
- Automatic collection starts when the number of allocations minus deallocations since the last run exceeds a threshold. It scans the young generation often.
- Objects that survive a collection move to an older generation, which is scanned less often.
- `gc.collect()` with no arguments runs a **full** collection of all generations.

```python
import gc

print(gc.isenabled())
print(gc.get_threshold())
print(gc.get_count())
```

Output (Python 3.14.0; the numbers vary by version and program):

```text
True
(2000, 10, 0)
(359, 0, 0)
```

`get_threshold()` returns the thresholds that trigger a collection, and `get_count()` returns the current counters. You can change the thresholds with `gc.set_threshold()`, but the defaults suit almost every program.

> **Note:** The details of the generational scheme are an implementation detail that changes between releases. Python 3.13 and earlier use three generations. Python 3.14.0 shipped an incremental collector with a different threshold meaning, and 3.14.5 went back to the 3.13 behaviour. Never write code that depends on *when* a collection happens.

## Finalizers and cycles: `__del__`

A class can define `__del__()`, which runs just before an instance is destroyed. Before Python 3.4, objects with `__del__` inside a cycle could not be collected and ended up in the `gc.garbage` list. Since Python 3.4 ([PEP 442](https://peps.python.org/pep-0442/)) the collector handles them correctly:

```python
import gc


class Connection:
    def __init__(self, name):
        self.name = name
        self.peer = None

    def __del__(self):
        print(f"__del__ called for {self.name}")


gc.disable()

client = Connection("client")
server = Connection("server")
client.peer, server.peer = server, client

del client, server
print("collecting...")
gc.collect()
print("gc.garbage:", gc.garbage)

gc.enable()
```

Output:

```text
collecting...
__del__ called for client
__del__ called for server
gc.garbage: []
```

Two warnings still apply:

- Inside a cycle, the order in which `__del__` methods run is not defined. A finalizer must not rely on the other objects in the cycle still being usable.
- If an object is in a cycle, its `__del__` runs only when the collector gets to it, which may be much later than you expect. Do not use `__del__` to close files or connections. Use `with` statements (context managers) for resources.

## Avoiding cycles with weak references

The best cycle is the one you never create. A common source of cycles is a back-reference: a child that points to its parent, an employee that points to their department. Make the back-reference **weak**, and reference counting alone can clean everything up:

```python
import gc
import weakref


class TreeNode:
    def __init__(self, value, parent=None):
        self.value = value
        self.children = []
        # a weak reference to the parent does not keep the parent alive
        self._parent = weakref.ref(parent) if parent is not None else None
        if parent is not None:
            parent.children.append(self)

    @property
    def parent(self):
        return self._parent() if self._parent is not None else None


gc.disable()  # prove that reference counting alone is enough

root = TreeNode("root")
child = TreeNode("child", parent=root)
weakref.finalize(root, print, "root destroyed")
weakref.finalize(child, print, "child destroyed")

print(child.parent.value)
del root, child
print("after del")

gc.enable()
```

Output:

```text
root
root destroyed
child destroyed
after del
```

Even with the collector switched off, both objects are destroyed immediately inside `del`. The parent holds strong references to its children, and children hold only weak references back.

> **Tip:** Python itself breaks one common cycle for you. The name in `except SomeError as error:` is deleted at the end of the `except` block, because the exception's traceback refers to the current frame, and the frame refers to `error`.

```python
try:
    1 / 0
except ZeroDivisionError as error:
    print("caught:", error)

print(error)
```

Output:

```text
caught: division by zero
Traceback (most recent call last):
  ...
NameError: name 'error' is not defined. Did you mean: 'OSError'?
```

If you need the exception later, assign it to another name inside the block.

## Disabling and tuning the collector

`gc.disable()` turns off **automatic** cycle collection only. Reference counting keeps working, and `gc.collect()` still works when you call it yourself. `gc.enable()` turns automatic collection back on, and `gc.isenabled()` reports the current state.

Legitimate reasons to touch the collector are rare:

- **Benchmarks.** `timeit` already turns the collector off while timing so that a random collection does not distort the measurement.
- **Latency-critical sections.** A program may pause automatic collection during a short burst of work and run `gc.collect()` at a convenient moment.
- **Forking servers.** Calling `gc.freeze()` just before `os.fork()` moves all current objects into a permanent generation, so child processes do not touch them during collections and memory pages stay shared.

If you disable the collector, always re-enable it, even when an exception occurs: use `try`/`finally`. And remember that with the collector off, every cycle your program creates becomes a memory leak.

### Inspecting what the collector found

For debugging you can ask the collector to keep unreachable objects instead of freeing them:

```python
import gc


class Node:
    pass


gc.disable()
gc.set_debug(gc.DEBUG_SAVEALL)  # keep unreachable objects in gc.garbage

a = Node()
b = Node()
a.other = b
b.other = a
del a, b

gc.collect()
print([type(obj).__name__ for obj in gc.garbage])

gc.set_debug(0)
gc.garbage.clear()
gc.enable()
```

Output:

```text
['Node', 'Node']
```

This shows which types form cycles in your program. `gc.get_referrers(obj)` is another debugging helper: it returns the objects that refer to `obj`.

## Common mistakes

- **Calling `gc.collect()` everywhere "to free memory".** Objects without cycles are already freed by reference counting. A full collection scans every tracked object and is relatively expensive. Call it only when you have a reason.
- **Disabling the collector and forgetting to re-enable it.** Every cycle created afterwards leaks. Wrap the code in `try`/`finally`.
- **Relying on `__del__` to release resources.** In a cycle it runs late and in an undefined order, and on other implementations the timing is different again. Use `with`.
- **Checking existence with `id()` or reading memory with `ctypes`.** Ids are reused, and freed memory can contain anything. Use `weakref`.
- **Expecting the process memory to shrink right after a collection.** Freed memory often goes back to Python's own allocator for reuse, not to the operating system, so tools like Task Manager may not show a drop.
- **Creating back-references without thinking.** Parent pointers, callbacks that capture `self`, and caches that store objects referring to the cache all create cycles. Use `weakref.ref`, `weakref.WeakValueDictionary` or `weakref.WeakSet` where a back-reference should not own the object.

## Summary

- CPython frees most objects by reference counting, immediately after their last reference disappears.
- Objects that refer to each other in a cycle keep each other's counts above zero, so reference counting alone would leak them.
- The cycle garbage collector tracks container objects, finds groups that are unreachable from outside, and frees them.
- `gc.collect()` runs a full collection; `gc.disable()`/`gc.enable()` control only automatic collection.
- Collection is generational because most objects die young. The exact scheme is an implementation detail that changes between versions.
- Use `weakref.ref` and `weakref.finalize` to observe objects without keeping them alive, and weak back-references to avoid cycles.
- Since Python 3.4, objects with `__del__` in cycles are collected, but finalizer order is undefined. Use `with` for resources.
- Leave the collector enabled unless you have a measured reason to change it.

## Practice

### Exercise 1: Predict the output

Without running the code, write down the order of the printed lines. Then run it and check.

```python
import gc
import weakref


class Box:
    pass


gc.disable()

box = Box()
box.myself = box          # the object refers to itself
weakref.finalize(box, print, "box destroyed")

print("step 1")
del box
print("step 2")
gc.collect()
print("step 3")

gc.enable()
```

### Exercise 2: Break the cycle with a weak reference

A `Department` keeps a list of its employees, and each `Employee` keeps a reference to its department. With strong references in both directions, this is a cycle. Write the two classes so that `Employee.department` is a property backed by a weak reference. Then prove, with the collector disabled, that `del` on the last name of a department destroys it immediately, and that `employee.department` returns `None` afterwards.

### Exercise 3: Run a function without the collector

Write `run_without_gc(func, *args, **kwargs)` that calls `func` with automatic collection disabled and returns its result. Requirements:

- the previous state is restored even if `func` raises an exception;
- if the collector was already disabled before the call, it stays disabled afterwards.

### Exercise 4: Which objects are reachable?

Three nodes form a ring: `a -> b -> c -> a`. The only outside reference is a variable `entry` that points to `b`. Predict what `gc.collect()` destroys in each step, then verify with `weakref.finalize`:

1. after `del a, b, c` (only `entry` remains);
2. after `del entry`.

## Solutions

### Exercise 1

Output:

```text
step 1
step 2
box destroyed
step 3
```

`box.myself = box` gives the object a reference to itself, so after `del box` its count is still 1 and it survives. Automatic collection is disabled, so only the explicit `gc.collect()` finds the cycle and destroys the object.

### Exercise 2

```python
import gc
import weakref


class Department:
    def __init__(self, name):
        self.name = name
        self.employees = []


class Employee:
    def __init__(self, name, department):
        self.name = name
        self._department = weakref.ref(department)
        department.employees.append(self)

    @property
    def department(self):
        return self._department()


gc.disable()

it = Department("IT")
olena = Employee("Olena", it)
weakref.finalize(it, print, "department destroyed")

print(olena.department.name)
del it
print("after del it")
print(olena.department)

gc.enable()
```

Output:

```text
IT
department destroyed
after del it
None
```

The department is destroyed inside `del it`, without any collection, because the only reference from the employee is weak. The employee itself stays alive because `olena` still refers to it.

### Exercise 3

```python
import gc


def run_without_gc(func, *args, **kwargs):
    was_enabled = gc.isenabled()
    gc.disable()
    try:
        return func(*args, **kwargs)
    finally:
        if was_enabled:
            gc.enable()


def work():
    return gc.isenabled()


def broken():
    raise ValueError("boom")


print(run_without_gc(work))
print(gc.isenabled())

try:
    run_without_gc(broken)
except ValueError as error:
    print("error:", error)
print(gc.isenabled())

gc.disable()
run_without_gc(work)
print(gc.isenabled())
gc.enable()
```

Output:

```text
False
True
error: boom
True
False
```

The `finally` block runs whether `func` returns normally or raises, so the collector is always restored. Saving `was_enabled` first prevents the function from turning the collector on when the caller had deliberately turned it off.

### Exercise 4

```python
import gc
import weakref


class Node:
    def __init__(self, name):
        self.name = name
        self.next = None


gc.disable()

a, b, c = Node("a"), Node("b"), Node("c")
a.next, b.next, c.next = b, c, a          # a -> b -> c -> a
weakref.finalize(a, print, "a destroyed")
weakref.finalize(b, print, "b destroyed")
weakref.finalize(c, print, "c destroyed")

entry = b
del a, b, c
print("collect #1")
gc.collect()

del entry
print("collect #2")
gc.collect()
print("end")

gc.enable()
```

Output (the order of the three "destroyed" lines may differ):

```text
collect #1
collect #2
b destroyed
c destroyed
a destroyed
end
```

1. The first collection destroys nothing. `entry` is an outside reference to `b`, so `b` is reachable, `c` is reachable through `b.next`, and `a` through `c.next`.
2. After `del entry` nothing outside points into the ring. Every node's count is 1 and comes only from inside the ring, so the whole ring is unreachable and the second collection destroys all three nodes.

---

*Source: [pythontutorial.net — Python Garbage Collection](https://www.pythontutorial.net/advanced-python/python-garbage-collection/). Adapted and expanded for PyJourney.*
