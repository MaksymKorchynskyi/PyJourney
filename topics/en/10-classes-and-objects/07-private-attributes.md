# Private Attributes

**Encapsulation** means that an object is responsible for its own state, and outside code changes that state only through the object's methods. Many languages enforce this with `private` fields. Python does not: every attribute can be reached from outside. Instead, Python offers two naming conventions, a single leading underscore and a double leading underscore. This topic explains both, what they really do, and when to use each.

## What you'll learn

- What encapsulation and information hiding are and why they matter
- How unrestricted access to an attribute can put an object into an invalid state
- What a single leading underscore (`_attr`) means
- How name mangling with a double leading underscore (`__attr`) works, step by step
- What name mangling is really for: avoiding name clashes in subclasses
- How a read-only property exposes internal state safely

## Encapsulation and information hiding

Encapsulation is one of the four core ideas of object-oriented programming, along with abstraction, inheritance and polymorphism. It means **bundling data together with the methods that work on that data** in a single unit, the object. A class is the natural example: it packs attributes and methods together and offers access to its data through methods.

Closely related is **information hiding**: keeping the internal state out of reach of outside code. If outsiders can only change the state through methods, the class can check every change and guarantee that the object is always in a valid state. Rules like "a counter is never negative" are called the object's **invariants**, and encapsulation is how a class protects them.

## An example: a counter

```python
class Counter:
    def __init__(self):
        self.current = 0

    def increment(self):
        self.current += 1

    def value(self):
        return self.current

    def reset(self):
        self.current = 0


counter = Counter()
counter.increment()
counter.increment()
counter.increment()
print(counter.value())
```

Output:

```text
3
```

The class has one attribute, `current`, which starts at zero, and three methods:

- `increment()` increases `current` by one;
- `value()` returns the current count;
- `reset()` sets `current` back to zero.

It works, but nothing stops outside code from bypassing the methods and writing any value it likes:

```python
class Counter:
    def __init__(self):
        self.current = 0

    def increment(self):
        self.current += 1

    def value(self):
        return self.current

    def reset(self):
        self.current = 0


counter = Counter()
counter.increment()
counter.increment()
counter.current = -999
print(counter.value())
```

Output:

```text
-999
```

A counter that went up twice now reports `-999`. The invariant "never negative" is broken, and the `Counter` class had no chance to prevent it. How do you keep outside code away from `current`?

## Python has no truly private attributes

In Java or C#, a `private` field is accessible only from methods of its own class, and the compiler enforces that. Python has no such keyword. **Every attribute is technically accessible from outside.**

This is a deliberate design choice, often summed up as "we are all consenting adults here". Python trusts programmers to respect clearly marked boundaries rather than building walls. The boundaries are marked with naming conventions.

## Single underscore: "internal, don't touch"

By convention, a name that starts with **one underscore** is internal to the class:

```text
_attribute
```

It tells other programmers: this is an implementation detail, not part of the public interface. Do not use it from outside, and do not be surprised if it changes or disappears in a future version. Here is the counter with `current` marked as internal:

```python
class Counter:
    def __init__(self):
        self._current = 0

    def increment(self):
        self._current += 1

    def value(self):
        return self._current

    def reset(self):
        self._current = 0


counter = Counter()
counter.increment()
print(counter.value())
print(counter._current)  # works, but you are breaking the convention
```

Output:

```text
1
1
```

Python itself does nothing to stop the access. The convention works because people and tools respect it:

- linters such as pylint warn about `protected-access` when code touches `_name` of another object;
- IDEs hide underscore names from autocompletion or show them last;
- at module level, `from module import *` skips names that start with an underscore.

## Double underscore: name mangling

If an attribute name starts with **two underscores** (and does not end with two underscores), Python automatically renames it inside the class:

```text
__attribute   becomes   _ClassName__attribute
```

This renaming is called **name mangling**. Note that it is the *class name* that gets inserted, not the word "class". Here is the counter with a double-underscore attribute:

```python
class Counter:
    def __init__(self):
        self.__current = 0

    def increment(self):
        self.__current += 1

    def value(self):
        return self.__current

    def reset(self):
        self.__current = 0


counter = Counter()
counter.increment()
print(counter.value())
print(vars(counter))
print(counter._Counter__current)
```

Output:

```text
1
{'_Counter__current': 1}
1
```

Inside the class you write `self.__current`, and Python quietly turns it into `self._Counter__current`. That is the only name the object actually has, as `vars()` shows. Accessing the original name from outside fails:

```python
class Counter:
    def __init__(self):
        self.__current = 0


counter = Counter()
print(counter.__current)
```

Output:

```text
Traceback (most recent call last):
  ...
AttributeError: 'Counter' object has no attribute '__current'
```

But the mangled name is still reachable, as `counter._Counter__current` showed above. Name mangling makes accidental access harder, but it is **not** a security feature.

### The exact rules

- Mangling applies to every identifier of the form `__name` written **inside a class body**, including method names and attributes of other objects (`other.__secret`), not only `self.__attr`.
- Names that also **end** with two underscores, such as `__init__` or `__len__`, are special methods and are never mangled.
- Leading underscores of the class name are stripped: in `class _Vault`, `__code` becomes `_Vault__code`.
- Mangling is done by the compiler on the source text. Strings are not mangled, so `getattr(self, "__code")` inside the class looks for a literal `"__code"` and does not find the mangled attribute.

### A trap: assigning from outside

Because mangling happens only inside the class body, assigning `obj.__name` from outside creates a **new, unrelated** attribute:

```python
class Counter:
    def __init__(self):
        self.__current = 0

    def value(self):
        return self.__current


counter = Counter()
counter.__current = 100  # outside the class: no mangling
print(counter.value())
print(vars(counter))
```

Output:

```text
0
{'_Counter__current': 0, '__current': 100}
```

The assignment "worked" without any error, but the counter did not change. The object now has two attributes with confusingly similar names.

## What name mangling is really for

The main purpose of name mangling is not hiding data from users. It is **avoiding accidental name clashes between a class and its subclasses**. Consider a base class that uses an internal `_id`, and a subclass whose author, not knowing that, uses `_id` for something else:

```python
class Base:
    def __init__(self):
        self._id = 1

    def base_id(self):
        return self._id


class Child(Base):
    def __init__(self):
        super().__init__()
        self._id = "child-42"  # meant as Child's own id


item = Child()
print(item.base_id())
```

Output:

```text
child-42
```

Both classes store their value under the same name on the same object, so the child silently overwrote the parent's data. With double underscores, each class gets its own mangled name and both values coexist:

```python
class Base:
    def __init__(self):
        self.__id = 1

    def base_id(self):
        return self.__id


class Child(Base):
    def __init__(self):
        super().__init__()
        self.__id = "child-42"

    def child_id(self):
        return self.__id


item = Child()
print(item.base_id(), item.child_id())
print(vars(item))
```

Output:

```text
1 child-42
{'_Base__id': 1, '_Child__id': 'child-42'}
```

PEP 8 gives a simple guideline: use a single leading underscore for non-public attributes, and reach for double underscores only when a class is designed to be subclassed and some attributes must not clash with names chosen by subclasses.

## Exposing internal state safely: a read-only property

A common need is "outsiders may **read** the value but not **write** it". The Pythonic tool for this is a **property**. It lets a method be accessed like an attribute. A property without a setter is read-only:

```python
class Counter:
    def __init__(self):
        self._current = 0

    def increment(self):
        self._current += 1

    def reset(self):
        self._current = 0

    @property
    def value(self):
        return self._current


counter = Counter()
counter.increment()
counter.increment()
print(counter.value)

try:
    counter.value = -999
except AttributeError as error:
    print("AttributeError:", error)
```

Output:

```text
2
AttributeError: property 'value' of 'Counter' object has no setter
```

Outside code reads `counter.value` like an attribute, but the only way to change the count is through `increment()` and `reset()`. The internal `_current` is still technically reachable, but the public interface now clearly says how the object is meant to be used. Properties, including setters with validation, get a full topic later.

## Common mistakes

- **Treating underscores as security.** Anyone can read `obj._secret` or `obj._ClassName__secret`. Never rely on naming conventions to protect passwords, tokens or other sensitive data.

- **Assigning `obj.__name` from outside the class.** It creates a separate attribute and leaves the real (mangled) one untouched, without any error.

- **Using double underscores by default.** Mangled names make subclassing and debugging harder. A subclass cannot reach the parent's `__attr` through `self.__attr`, because inside the subclass that name is mangled with the *subclass* name:

  ```python
  class Counter:
      def __init__(self):
          self.__current = 0


  class LoudCounter(Counter):
      def shout(self):
          return f"COUNT: {self.__current}"


  LoudCounter().shout()
  ```

  Output:

  ```text
  Traceback (most recent call last):
    ...
  AttributeError: 'LoudCounter' object has no attribute '_LoudCounter__current'. Did you mean: '_Counter__current'?
  ```

  The hint in the message shows the two mangled names side by side. If subclasses are supposed to use the attribute, a single underscore is the right choice.

- **Relying on `_internal` names of third-party objects.** They are not part of the library's public interface and may change in any release.

- **Confusing `__name` with `__name__`.** A leading double underscore triggers mangling. Leading *and* trailing double underscores mark special (dunder) names reserved for Python. Do not invent your own `__name__`-style names.

## Summary

- Encapsulation bundles data with the methods that work on it and lets the class protect its state. Information hiding keeps internals away from outside code.
- Python has no enforced private attributes. Every attribute can be reached from outside.
- A single leading underscore (`_attr`) is a convention meaning "internal, not part of the public interface".
- A double leading underscore (`__attr`) inside a class body is renamed to `_ClassName__attr` (name mangling). It is still accessible under that name.
- Name mangling exists mainly to prevent accidental name clashes between a class and its subclasses. It is not a security feature.
- Prefer a single underscore. Use a read-only property to let outsiders read internal state without changing it.

## Practice

### Exercise 1: A protected bank account

Write a class `BankAccount` that stores its balance in `_balance` (starting at 0). Add:

- `deposit(amount)`, which raises `ValueError` if `amount` is not positive;
- `withdraw(amount)`, which raises `ValueError` if `amount` is not positive or exceeds the balance;
- a read-only property `balance`.

Deposit 100, withdraw 40 and print the balance. Then show that `account.balance = 1_000_000` fails and that `account.withdraw(500)` is rejected.

### Exercise 2: Predict the output

Write down what each line prints, then run the code.

```python
class Safe:
    def __init__(self):
        self.__code = 1234

    def code(self):
        return self.__code


safe = Safe()
safe.__code = 0
print(safe.code())
print(safe.__code)
print(safe._Safe__code)
print(sorted(vars(safe)))
```

### Exercise 3: Find the mangled name

The class below has a leading underscore in its own name. Without looking at the solution, predict the name under which `__code` is stored. Then verify it with `vars()`, read the value through the mangled name, and explain what `reveal()` returns.

```python
class _Vault:
    def __init__(self):
        self.__code = 1234

    def reveal(self):
        return getattr(self, "__code", "not found")


vault = _Vault()
```

### Exercise 4: Fix the clash

`Widget` and its subclass `Button` both store something under the name `_state`, and the program crashes. Explain why, then fix it with name mangling so that both classes keep their own state. After the fix, the program should print `widget is running` and `pressed: True`.

```python
class Widget:
    def __init__(self):
        self._state = "idle"

    def start(self):
        self._state = "running"

    def status(self):
        return f"widget is {self._state}"


class Button(Widget):
    def __init__(self, label):
        super().__init__()
        self.label = label
        self._state = {"pressed": False}

    def press(self):
        self._state["pressed"] = True

    def is_pressed(self):
        return self._state["pressed"]


button = Button("OK")
button.start()
button.press()
print(button.status())
print("pressed:", button.is_pressed())
```

## Solutions

### Exercise 1

```python
class BankAccount:
    def __init__(self):
        self._balance = 0

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("deposit must be positive")
        self._balance += amount

    def withdraw(self, amount):
        if amount <= 0:
            raise ValueError("withdrawal must be positive")
        if amount > self._balance:
            raise ValueError("insufficient funds")
        self._balance -= amount

    @property
    def balance(self):
        return self._balance


account = BankAccount()
account.deposit(100)
account.withdraw(40)
print(account.balance)

try:
    account.balance = 1_000_000
except AttributeError as error:
    print("AttributeError:", error)

try:
    account.withdraw(500)
except ValueError as error:
    print("ValueError:", error)

print(account.balance)
```

Output:

```text
60
AttributeError: property 'balance' of 'BankAccount' object has no setter
ValueError: insufficient funds
60
```

### Exercise 2

Output:

```text
1234
0
1234
['_Safe__code', '__code']
```

`safe.__code = 0` runs outside the class, so it is not mangled and creates a new attribute literally named `__code`. The method `code()` reads the mangled `_Safe__code`, which still holds `1234`.

### Exercise 3

```python
class _Vault:
    def __init__(self):
        self.__code = 1234

    def reveal(self):
        return getattr(self, "__code", "not found")


vault = _Vault()
print(vars(vault))
print(vault._Vault__code)
print(vault.reveal())
```

Output:

```text
{'_Vault__code': 1234}
1234
not found
```

The leading underscore of the class name is stripped, so the mangled name is `_Vault__code`, not `__Vault__code`. `reveal()` returns `"not found"` because the string `"__code"` is not mangled: `getattr()` looks for an attribute literally named `__code`, and there is none.

### Exercise 4

Both classes store their data in the same attribute of the same object. `Button.__init__` replaces the widget's `"idle"` with a dictionary, then `start()` replaces the dictionary with the string `"running"`, and `press()` fails with `TypeError: 'str' object does not support item assignment`. With double underscores each class gets its own mangled attribute:

```python
class Widget:
    def __init__(self):
        self.__state = "idle"

    def start(self):
        self.__state = "running"

    def status(self):
        return f"widget is {self.__state}"


class Button(Widget):
    def __init__(self, label):
        super().__init__()
        self.label = label
        self.__state = {"pressed": False}

    def press(self):
        self.__state["pressed"] = True

    def is_pressed(self):
        return self.__state["pressed"]


button = Button("OK")
button.start()
button.press()
print(button.status())
print("pressed:", button.is_pressed())
print(vars(button))
```

Output:

```text
widget is running
pressed: True
{'_Widget__state': 'running', 'label': 'OK', '_Button__state': {'pressed': True}}
```

---

*Source: [pythontutorial.net — Python Private Attributes](https://www.pythontutorial.net/python-oop/python-private-attributes/). Adapted and expanded for PyJourney.*
