# __del__

`__del__` is a special method that Python calls when an object is about to be destroyed. It looks like a natural place for cleanup code, such as closing files or connections, but *when* it runs is not up to you, and errors inside it are silently swallowed. Knowing how `__del__` really works mostly teaches you when **not** to use it, and what to use instead.

## What you'll learn

- What `__del__` is and why it is a *finalizer*, not a destructor
- When CPython calls `__del__`, and why the `del` statement does not call it directly
- How reference cycles delay `__del__` until the garbage collector runs
- What happens to exceptions raised inside `__del__`
- Other pitfalls: interpreter shutdown, resurrection, inheritance
- The reliable alternatives: context managers, `try/finally` and `weakref.finalize`

## What `__del__` is

Python manages memory automatically. When an object is no longer reachable, it is destroyed and its memory is reused. If the object's class defines `__del__(self)`, Python calls it **just before** the object is destroyed:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __del__(self):
        print(f"__del__ was called for {self.name}")


person = Person("John Doe", 23)
person = None
print("after person = None")
```

Output:

```text
__del__ was called for John Doe
after person = None
```

`__del__` is often called a **finalizer**. It is not a destructor in the C++ sense: it does not destroy anything and does not free memory. The interpreter destroys the object; `__del__` is only a hook that runs right before that.

## When CPython calls `__del__`

CPython (the standard interpreter) counts references to every object. As soon as the count drops to zero, the object is destroyed **immediately**, and `__del__` runs at that moment. A reference disappears when you rebind a name, delete it with `del`, remove the object from a container, or when a function returns and its local variables go away.

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __del__(self):
        print(f"__del__ was called for {self.name}")


person = Person("Jane Doe", 31)
del person
print("after del person")

person = Person("Max Payne", 40)
alias = person
del person
print("after del person (alias still exists)")
alias = None
print("end")
```

Output:

```text
__del__ was called for Jane Doe
after del person
after del person (alias still exists)
__del__ was called for Max Payne
end
```

The second object survived `del person` because `alias` still referred to it. `__del__` ran only when the **last** reference disappeared.

> **Note:** Immediate finalization is a CPython detail. Other implementations, such as PyPy, use a different garbage collector and may call `__del__` much later, or not at all before the program exits. Portable code must not depend on the timing.

### `del` is not `__del__`

The names are confusing, so it is worth stating plainly:

- The `del name` **statement** removes a name (or a container item, or an attribute). It decreases the reference count by one and does nothing else.
- The `__del__` **method** is called by the interpreter when the object is actually destroyed.

Calling `__del__()` yourself does not destroy anything either. It is just a method call:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def __del__(self):
        print(f"__del__ was called for {self.name}")


person = Person("John")
person.__del__()
print("still alive:", person.name)
del person
print("end")
```

Output:

```text
__del__ was called for John
still alive: John
__del__ was called for John
end
```

The method ran twice: once from the manual call, once when the object was really destroyed. Never call `__del__` directly.

## Reference cycles delay `__del__`

Reference counting cannot free objects that refer to each other. If `a` refers to `b` and `b` refers to `a`, their counts never reach zero, even when no variable points to them. Such cycles are found later by the **cyclic garbage collector** (the `gc` module), which runs periodically:

```python
import gc


class Node:
    def __init__(self, name):
        self.name = name
        self.other = None

    def __del__(self):
        print(f"__del__: {self.name}")


a = Node("a")
b = Node("b")
a.other = b
b.other = a  # a reference cycle

del a, b
print("names deleted, nothing printed yet")
gc.collect()
print("after gc.collect()")
```

Output (the order of the two `__del__` lines is not guaranteed):

```text
names deleted, nothing printed yet
__del__: a
__del__: b
after gc.collect()
```

Here `gc.collect()` forces a collection to make the effect visible. In a real program you don't know when the collector will run, so `__del__` of objects in cycles runs at an unpredictable moment.

> **Note:** Before Python 3.4, objects with `__del__` that were part of a cycle were never collected; they were moved to the `gc.garbage` list and leaked. Since Python 3.4 (PEP 442) such cycles are collected normally, and `__del__` is called at most once per object.

## Exceptions in `__del__` are ignored

`__del__` can run at almost any point of the program, so there is no sensible place to propagate an exception to. Python therefore **does not raise** exceptions from `__del__`. It prints a warning to `stderr` and continues:

```python
class Broken:
    def __del__(self):
        print("cleaning up...")
        raise RuntimeError("cleanup failed")


obj = Broken()
del obj
print("the program keeps running")
```

Output in a terminal (Python 3.14; the address and the path vary, and older versions start the warning with `Exception ignored in:`):

```text
cleaning up...
Exception ignored while calling deallocator <function Broken.__del__ at 0x10301fc10>:
Traceback (most recent call last):
  File "/home/user/broken.py", line 4, in __del__
    raise RuntimeError("cleanup failed")
RuntimeError: cleanup failed
the program keeps running
```

The calling code cannot catch this exception with `try/except`, and the program has no way to learn that cleanup failed. If the cleanup was important (flushing data, releasing a lock), the failure goes unnoticed.

## More pitfalls

- **Interpreter shutdown.** The documentation does not guarantee that `__del__` is called for objects that still exist when the interpreter exits. CPython 3.14 usually does call it for module-level objects, but during shutdown other modules and globals may already be torn down, so code in `__del__` that uses them can fail.
- **Resurrection.** `__del__` can store `self` somewhere (for example in a global list), creating a new reference. The object then survives. Python calls `__del__` at most once per object, so it won't run again when the resurrected object finally dies.
- **Inheritance.** If a base class defines `__del__`, a subclass that overrides it must call `super().__del__()` explicitly, or the base cleanup never runs. `object` itself has no `__del__`, so only call it when a base class really defines one.
- **Objects referenced by the dying object.** After `__del__` returns and the object is destroyed, the objects it referred to lose one reference each. They are destroyed too only if nothing else refers to them.

## Better alternatives

### Context managers and `try/finally`

When a resource must be released at a known moment, release it explicitly. A **context manager** (an object with `__enter__` and `__exit__`) used in a `with` statement guarantees that cleanup runs when the block ends, even if an exception occurs:

```python
class LogFile:
    def __init__(self, path):
        self.path = path
        self.closed = False
        print(f"open {self.path}")

    def write(self, text):
        if self.closed:
            raise ValueError("write to a closed log")
        print(f"write {text!r}")

    def close(self):
        if not self.closed:
            self.closed = True
            print(f"close {self.path}")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()
        return False


with LogFile("app.log") as log:
    log.write("started")
    log.write("finished")
print("after the with block, closed =", log.closed)

try:
    with LogFile("error.log") as log:
        log.write("about to fail")
        raise RuntimeError("boom")
except RuntimeError as error:
    print("caught:", error)
```

Output:

```text
open app.log
write 'started'
write 'finished'
close app.log
after the with block, closed = True
open error.log
write 'about to fail'
close error.log
caught: boom
```

`__exit__` returns `False`, so the exception is not suppressed: the log is closed first, then the exception reaches the caller. Without a context manager, the same guarantee comes from `try: ... finally: log.close()`. Built-in resources such as files, locks and sockets are already context managers.

### `weakref.finalize` as a safety net

Sometimes you want an explicit `close()` **and** a fallback for when the user forgets to call it. `weakref.finalize(obj, func, *args)` registers `func(*args)` to run when `obj` is destroyed. Unlike `__del__`, the finalizer runs at most once, can also be called early by hand, and by default also runs at interpreter exit:

```python
import weakref


class TempDir:
    def __init__(self, name):
        self.name = name
        print(f"create {name}")
        self._finalizer = weakref.finalize(self, TempDir._remove, name)

    @staticmethod
    def _remove(name):
        print(f"remove {name}")

    def cleanup(self):
        self._finalizer()


first = TempDir("tmp1")
first.cleanup()
first.cleanup()  # the second call does nothing

second = TempDir("tmp2")
del second

third = TempDir("tmp3")
print("end of script")
```

Output:

```text
create tmp1
remove tmp1
create tmp2
remove tmp2
create tmp3
end of script
remove tmp3
```

> **Tip:** The callback and its arguments must not refer to the object itself (for example, don't pass a bound method like `self.cleanup`). Otherwise the finalizer keeps the object alive and it is never destroyed. That is why `_remove` is a static method that receives only `name`.

## Common mistakes

- **Using `__del__` to release important resources.** Its timing is unpredictable (cycles, other Python implementations, shutdown), and its errors are invisible. Use `with`, `try/finally` or an explicit `close()`.
- **Expecting `del obj` to call `__del__`.** `del` removes one reference. `__del__` runs only when the last reference is gone.
- **Calling `obj.__del__()` manually.** It runs the cleanup but doesn't destroy the object, so the cleanup will run a second time later.
- **Raising or relying on exceptions in `__del__`.** They are printed to `stderr` and ignored.
- **Using globals or other modules inside `__del__`.** At interpreter shutdown they may already be gone.
- **Forgetting `super().__del__()`** when the base class has its own finalizer.

## Summary

- `__del__` is a finalizer: Python calls it right before an object is destroyed. It does not destroy the object itself.
- In CPython an object is destroyed as soon as its reference count reaches zero, so `__del__` usually runs immediately after the last reference disappears.
- The `del` statement only removes a name or reference; it is not a call to `__del__`.
- Objects in reference cycles are destroyed only when the cyclic garbage collector runs.
- Exceptions inside `__del__` are printed to `stderr` and ignored; the program can't catch them.
- `__del__` is not guaranteed to run at interpreter exit and is called at most once per object.
- Prefer context managers, `try/finally` and `weakref.finalize` for cleanup. In practice you will rarely need `__del__`.

## Practice

### Exercise 1: Predict the order

Predict the full output before running the code:

```python
class Token:
    def __init__(self, name):
        self.name = name

    def __del__(self):
        print(f"del {self.name}")


a = Token("A")
b = Token("B")
box = [a, b]
print(1)
del a
print(2)
box.pop()
print(3)
b = None
print(4)
box.clear()
print(5)
```

### Exercise 2: From `__del__` to a context manager

This class closes its connection in `__del__`, so you can't be sure when the connection closes. Rewrite it with a `close()` method and context manager support, so that the connection closes at the end of a `with` block, even when an exception occurs inside it.

```python
class Connection:
    def __init__(self, host):
        self.host = host
        self.is_open = True
        print(f"connect to {host}")

    def query(self, sql):
        return f"result of {sql!r}"

    def __del__(self):
        print(f"disconnect from {self.host}")
```

### Exercise 3: A tree without cycles

In a tree, each child often stores a reference to its parent, and the parent stores its children. That creates cycles, so `__del__` runs only when the garbage collector gets around to it. Write a `TreeNode(name, parent=None)` class where the parent link is a **weak reference** (`weakref.ref`), expose it through a `parent` property, and show that deleting the last name of the root immediately finalizes both the root and its child.

### Exercise 4: Session with a safety net

Write a `Session(session_id)` class that prints `session <id> closed` exactly once: either when `close()` is called (any number of times), or when the object is destroyed without being closed, or at interpreter exit. Add a read-only `closed` property. Use `weakref.finalize`, not `__del__`.

## Solutions

### Exercise 1

Output:

```text
1
2
3
del B
4
del A
5
```

- `del a`: the list still holds `A`, so nothing is destroyed.
- `box.pop()` removes `B` from the list, but the name `b` still refers to it.
- `b = None` drops the last reference to `B`, so `del B` appears before `4`.
- `box.clear()` drops the last reference to `A`, so `del A` appears before `5`.

### Exercise 2

```python
class Connection:
    def __init__(self, host):
        self.host = host
        self.is_open = True
        print(f"connect to {host}")

    def query(self, sql):
        if not self.is_open:
            raise RuntimeError("connection is closed")
        return f"result of {sql!r}"

    def close(self):
        if self.is_open:
            self.is_open = False
            print(f"disconnect from {self.host}")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()
        return False


with Connection("db.local") as conn:
    print(conn.query("SELECT 1"))

try:
    with Connection("db.local") as conn:
        conn.query("SELECT 2")
        raise ValueError("bad data")
except ValueError as error:
    print("error:", error)
print("is_open:", conn.is_open)
```

Output:

```text
connect to db.local
result of 'SELECT 1'
disconnect from db.local
connect to db.local
disconnect from db.local
error: bad data
is_open: False
```

`close()` is idempotent (calling it twice is harmless), and `__exit__` guarantees that it runs when the block ends, whether normally or through an exception.

### Exercise 3

```python
import weakref


class TreeNode:
    def __init__(self, name, parent=None):
        self.name = name
        self.children = []
        self._parent = weakref.ref(parent) if parent is not None else None
        if parent is not None:
            parent.children.append(self)

    @property
    def parent(self):
        return self._parent() if self._parent is not None else None

    def __del__(self):
        print(f"__del__: {self.name}")


root = TreeNode("root")
leaf = TreeNode("leaf", parent=root)
print(leaf.parent.name)
del leaf
print("leaf name deleted")
del root
print("root name deleted")
```

Output:

```text
root
leaf name deleted
__del__: root
__del__: leaf
root name deleted
```

After `del leaf`, the root's `children` list still holds the leaf, so it survives. The leaf refers to the root only weakly, so `del root` drops the root's last strong reference. The root is finalized immediately, its `children` list goes away, and the leaf follows, all before `"root name deleted"` is printed. Calling the weak reference (`self._parent()`) returns the parent, or `None` if it no longer exists.

### Exercise 4

```python
import weakref


def report_closed(session_id):
    print(f"session {session_id} closed")


class Session:
    def __init__(self, session_id):
        self.session_id = session_id
        self._finalizer = weakref.finalize(self, report_closed, session_id)

    def close(self):
        self._finalizer()

    @property
    def closed(self):
        return not self._finalizer.alive


s1 = Session(1)
s1.close()
s1.close()
print("s1 closed:", s1.closed)

s2 = Session(2)
print("s2 closed:", s2.closed)
del s2
print("after del s2")

s3 = Session(3)
print("end of script")
```

Output:

```text
session 1 closed
s1 closed: True
s2 closed: False
session 2 closed
after del s2
end of script
session 3 closed
```

A finalizer runs at most once, and its `alive` attribute becomes `False` after that. `s2` is finalized when it is destroyed, and `s3`, which is still alive at the end, is finalized at interpreter exit.

---

*Source: [pythontutorial.net — Python __del__](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__del__/). Adapted and expanded for PyJourney.*
