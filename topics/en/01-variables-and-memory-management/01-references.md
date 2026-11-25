# References

In Python a variable does not *contain* a value. It is a **name that refers to an object** living somewhere in memory. Once this clicks, a lot of "strange" behaviour stops being strange: why changing one list changes "another", why a function can modify your data, and when Python frees memory.

## What you'll learn

- What a variable really is and how it is bound to an object
- How to see an object's identity with `id()` and compare identities with `is`
- The difference between **rebinding** a name and **mutating** an object
- What reference counting is and how to observe it with `sys.getrefcount()`
- When an object is destroyed and its memory reclaimed
- Why function arguments behave the way they do

## Variables are names bound to objects

When you write an assignment, Python does two things:

1. It evaluates the right-hand side and gets (or creates) an **object** in memory. For example, an `int` object with the value `100`.
2. It **binds** the name on the left to that object.

```python
counter = 100
print(counter)  # 100
```

Reading `counter` means "follow the name to the object it refers to and use that object". The name itself has no type and stores no value. The **object** has a type (`int`), a value (`100`) and an identity.

```text
 name            object in memory
+---------+      +----------------+
| counter | ---> | int: 100       |
+---------+      +----------------+
```

> **Tip:** Think of variables as sticky notes attached to objects, not as boxes that hold values. One object can have many sticky notes.

## Object identity: `id()` and `is`

Every object has an **identity**: a number that is unique among all objects alive at the same time. The built-in `id()` function returns it. In CPython (the standard interpreter) the identity is the object's memory address.

```python
counter = 100
print(id(counter))       # output varies, e.g. 4378718288
print(hex(id(counter)))  # the same number in hex, e.g. 0x104fc8f50
```

The exact numbers differ on every run and every machine, so never hard-code them. What matters is **comparing** identities. Two names refer to the same object exactly when their `id()` values are equal, and the `is` operator checks precisely that:

```python
counter = 100
alias = counter

print(id(counter) == id(alias))
print(counter is alias)
```

Output:

```text
True
True
```

Assignment never copies an object. `alias = counter` just attaches a second name to the same object.

## Rebinding vs. mutating

This distinction is the key to understanding references.

**Mutating** changes the object itself. Every name that refers to that object sees the change:

```python
scores = [90, 85]
backup = scores

backup.append(70)

print(scores)
print(backup)
print(scores is backup)
```

Output:

```text
[90, 85, 70]
[90, 85, 70]
True
```

`backup` was never a copy. Both names point to one list, and `append()` modified that list.

**Rebinding** points a name to a *different* object. Other names are not affected:

```python
x = 10
y = x
y = y + 1

print(x, y)
print(x is y)
```

Output:

```text
10 11
False
```

Integers are immutable, so `y + 1` cannot change the object `10`. It creates a new object `11`, and the assignment rebinds `y` to it. `x` still refers to `10`.

```text
before:  x ──┐               after:  x ───> int: 10
             ├──> int: 10
         y ──┘                       y ───> int: 11
```

> **Note:** If you need an independent copy of a mutable object, create it explicitly: `scores.copy()`, `list(scores)`, `scores[:]`, or `copy.deepcopy(scores)` for nested structures.

## Reference counting

CPython keeps, for each object, a counter of how many references point to it. This is the **reference count**. References come from variables, from items inside containers (lists, dicts, …), from object attributes, from function arguments while a call is running, and so on.

- Binding a new name to the object, or storing it in a container, **increases** the count.
- Rebinding a name to another object, `del name`, removing the item from a container, or a function returning **decreases** it.
- When the count drops to **zero**, the object is unreachable and CPython destroys it immediately, freeing its memory.

### Observing the count with `sys.getrefcount()`

The standard library offers `sys.getrefcount(obj)`:

```python
import sys

numbers = [1, 2, 3]
print(sys.getrefcount(numbers))

ranks = numbers
print(sys.getrefcount(numbers))

ranks = None
print(sys.getrefcount(numbers))
```

Output (Python 3.14):

```text
2
3
2
```

The value is usually **one higher** than you expect. Passing the object to `getrefcount()` creates a temporary reference for the duration of the call. So `2` means "one real reference (`numbers`) plus the temporary one".

> **Note:** Exact reference counts are a CPython implementation detail. They can differ between Python versions (3.14 optimises away some temporary references), and other implementations such as PyPy do not use reference counting at all. Use `getrefcount()` to *explore* and *learn*, never in program logic.

### Immortal objects (Python 3.12+)

Some objects are used everywhere: `None`, `True`, `False`, small integers, and many built-in strings. Since Python 3.12 they are **immortal**. Their reference count is frozen, so they are never destroyed, which also makes them cheaper to share between threads.

```python
import sys

print(sys.getrefcount(None))
print(sys.getrefcount(100))
```

Output (Python 3.14, 64-bit):

```text
3221225472
3221225472
```

The huge constant is a marker for "immortal", not a real count. This is why counting references of small integers like `100` tells you nothing useful.

### Why not `ctypes.c_long.from_address()`?

Older tutorials read the reference count directly from memory with `ctypes.c_long.from_address(id(obj)).value`. Avoid it. It depends on CPython's internal object layout, and calling it after the object was destroyed reads freed memory. That is undefined behaviour: it may show `0`, garbage, or crash the interpreter. `sys.getrefcount()` is the supported tool.

## When objects are destroyed

You can watch the moment an object dies with `weakref.finalize`. It registers a callback that runs when the object is about to be destroyed, without keeping the object alive itself:

```python
import weakref


class Report:
    def __init__(self, title):
        self.title = title


report = Report("Q3 sales")
weakref.finalize(report, print, "Report object destroyed")

draft = report
print("Deleting the first name...")
del report
print("Object is still alive, 'draft' references it:", draft.title)

print("Rebinding the last name...")
draft = None
print("Done")
```

Output:

```text
Deleting the first name...
Object is still alive, 'draft' references it: Q3 sales
Rebinding the last name...
Report object destroyed
Done
```

Two important lessons:

- `del report` **removes a name**, not the object. The object survives as long as any reference remains.
- The object is destroyed **right after** its last reference disappears. In this case that was the line `draft = None`.

Reference counting cannot free objects that reference each other in a cycle (for example, two objects pointing at each other). Python's **garbage collector** handles those cases, as the next topic explains.

## References and function arguments

Python passes arguments **by object reference** (sometimes called "call by sharing"). The parameter becomes a new name bound to the *same* object the caller passed in:

```python
def add_bonus(salaries, bonus):
    for i in range(len(salaries)):
        salaries[i] += bonus


def rename(name):
    name = name.upper()


team = [1000, 1200]
add_bonus(team, 100)
print(team)

person = "olena"
rename(person)
print(person)
```

Output:

```text
[1100, 1300]
olena
```

- `add_bonus` **mutates** the list it received, so the caller sees the change.
- `rename` only **rebinds** its local name `name` to a new string. The caller's `person` still refers to the original string. Strings are immutable anyway, so there was nothing to mutate.

## Common mistakes

- **Expecting assignment to copy.** `b = a` never copies a list, dict or set. Use `a.copy()` (shallow) or `copy.deepcopy(a)` (nested) when you need an independent object.
- **Building nested lists with `*`.** `[row] * 3` creates three references to the *same* inner list:

  ```python
  row = [0, 0, 0]
  grid = [row] * 3
  grid[0][0] = 1
  print(grid)

  grid = [[0, 0, 0] for _ in range(3)]
  grid[0][0] = 1
  print(grid)
  ```

  Output:

  ```text
  [[1, 0, 0], [1, 0, 0], [1, 0, 0]]
  [[1, 0, 0], [0, 0, 0], [0, 0, 0]]
  ```

- **Thinking `del` deletes the object.** It only deletes a name (or a container slot). The object lives on while other references exist.
- **Relying on exact reference counts or `id()` values** in program logic. Both are implementation details that change between runs and versions.
- **Using `ctypes` to read reference counts.** This reads memory that may already be freed. Use `sys.getrefcount()` for experiments.

## Summary

- A variable is a name bound to an object. The object holds the type and the value.
- `id(obj)` returns the object's identity (its memory address in CPython), and `a is b` checks whether two names refer to the same object.
- Assignment binds names. It never copies objects.
- Mutating an object is visible through every reference to it. Rebinding a name affects only that name.
- CPython counts references to every object and destroys an object as soon as its count reaches zero. `sys.getrefcount()` shows the count plus one temporary reference.
- Since Python 3.12, `None`, booleans, small ints and other common objects are immortal.
- `del` removes a name, not an object.
- Function arguments are passed by object reference, so functions can mutate the objects you give them.

## Practice

### Exercise 1: Predict the output

Without running the code, write down what it prints. Then run it and explain any surprise.

```python
a = [1, 2]
b = a
a = a + [3]
b.append(4)
print(a)
print(b)
print(a is b)
```

### Exercise 2: A function without side effects

`add_bonus()` above modifies the caller's list. Write `with_bonus(salaries, bonus)` that returns a **new** list with the bonus applied and leaves the original list untouched. Prove it with `is`.

### Exercise 3: Count the references

Run the code below and explain each printed number. Subtract 1 to ignore `getrefcount()`'s temporary reference.

```python
import sys

data = {"user": "max"}
print(sys.getrefcount(data) - 1)

copies = [data, data]
print(sys.getrefcount(data) - 1)

copies.pop()
print(sys.getrefcount(data) - 1)

del copies
print(sys.getrefcount(data) - 1)
```

### Exercise 4: Catch the moment of destruction

Create a `Cart` object, store it both in a variable `cart` and inside a list `carts`, and register a `weakref.finalize` callback that prints `"cart destroyed"`. Then delete the variable, clear the list, and print `"end"`. Before running it, predict where `"cart destroyed"` appears.

## Solutions

### Exercise 1

Output:

```text
[1, 2, 3]
[1, 2, 4]
False
```

`a + [3]` builds a **new** list, and the assignment rebinds `a` to it. `b` still refers to the original list, and `append(4)` mutates that original. After the rebinding the two names point to different objects, so `a is b` is `False`.

### Exercise 2

```python
def with_bonus(salaries, bonus):
    return [salary + bonus for salary in salaries]


team = [1000, 1200]
raised = with_bonus(team, 100)
print(team)
print(raised)
print(team is raised)
```

Output:

```text
[1000, 1200]
[1100, 1300]
False
```

### Exercise 3

Output:

```text
1
3
2
1
```

- `1`: only the name `data` refers to the dict.
- `3`: `data` plus two slots in the `copies` list.
- `2`: `pop()` removed one list slot.
- `1`: `del copies` destroyed the list, which released its remaining reference.

### Exercise 4

```python
import weakref


class Cart:
    pass


cart = Cart()
weakref.finalize(cart, print, "cart destroyed")

carts = [cart]
print("del cart")
del cart
print("carts.clear()")
carts.clear()
print("end")
```

Output:

```text
del cart
carts.clear()
cart destroyed
end
```

After `del cart` the list still holds a reference, so nothing is destroyed. `carts.clear()` removes the last reference, and the object is destroyed immediately, before `"end"` is printed.

---

*Source: [pythontutorial.net — Python References](https://www.pythontutorial.net/advanced-python/python-references/). Adapted and expanded for PyJourney.*
