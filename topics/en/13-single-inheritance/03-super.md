# super()

When a child class overrides a method, it often still needs the parent's version: the parent's `__init__` sets up attributes, the parent's `get_pay()` already does half of the calculation. The built-in `super()` lets a method **delegate** to the parent class instead of copying its code.

## What you'll learn

- How to call the parent's `__init__()` with `super().__init__()`
- How to extend any parent method with `super().method()`
- What `super()` actually returns and why `self` does not need to be passed
- How `super()` calls chain through several levels of inheritance
- The difference between `super()`, `super(Class, self)` and `Parent.method(self)`
- Typical mistakes: forgetting the call, passing `self` twice, missing `return`, infinite recursion

## The problem: duplicated parent code

Here is an `Employee` whose pay is the base pay plus a bonus:

```python
class Employee:
    def __init__(self, name, base_pay, bonus):
        self.name = name
        self.base_pay = base_pay
        self.bonus = bonus

    def get_pay(self):
        return self.base_pay + self.bonus
```

A sales employee additionally gets a sales incentive. A first attempt overrides both methods and copies the parent's code:

```python
class SalesEmployee(Employee):
    def __init__(self, name, base_pay, bonus, sales_incentive):
        self.name = name
        self.base_pay = base_pay
        self.bonus = bonus
        self.sales_incentive = sales_incentive

    def get_pay(self):
        return self.base_pay + self.bonus + self.sales_incentive
```

It works, but three lines of `__init__` and the whole pay formula are duplicated. If `Employee` later gets a new attribute (say, `hire_date`) or a new pay rule, `SalesEmployee` will silently be out of date.

## `super().__init__()`

Instead of repeating the parent's initialisation, call it:

```python
class Employee:
    def __init__(self, name, base_pay, bonus):
        self.name = name
        self.base_pay = base_pay
        self.bonus = bonus

    def get_pay(self):
        return self.base_pay + self.bonus


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, bonus, sales_incentive):
        super().__init__(name, base_pay, bonus)
        self.sales_incentive = sales_incentive


john = SalesEmployee("John", 5000, 1000, 2000)
print(vars(john))
```

Output:

```text
{'name': 'John', 'base_pay': 5000, 'bonus': 1000, 'sales_incentive': 2000}
```

When you create a `SalesEmployee`, Python runs `SalesEmployee.__init__`. Its first line runs `Employee.__init__` **on the same object**, which sets `name`, `base_pay` and `bonus`. Then the child adds its own `sales_incentive`. Each class is responsible only for its own attributes.

## Delegating to other parent methods

`super()` is not limited to `__init__`. Any overridden method can call the parent's version and build on its result:

```python
class Employee:
    def __init__(self, name, base_pay, bonus):
        self.name = name
        self.base_pay = base_pay
        self.bonus = bonus

    def get_pay(self):
        return self.base_pay + self.bonus


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, bonus, sales_incentive):
        super().__init__(name, base_pay, bonus)
        self.sales_incentive = sales_incentive

    def get_pay(self):
        return super().get_pay() + self.sales_incentive


if __name__ == "__main__":
    sales_employee = SalesEmployee("John", 5000, 1000, 2000)
    print(sales_employee.get_pay())
```

Output:

```text
8000
```

`super().get_pay()` runs `Employee.get_pay()`, which returns `5000 + 1000 = 6000`, and the child adds `2000`. Now the base formula lives in exactly one place. If the company changes how bonuses work, only `Employee.get_pay()` changes, and sales employees pick it up automatically.

This is the difference between **replacing** a method (a plain override) and **extending** it (an override that calls `super()`).

The same technique works for special methods, for example to extend the parent's text representation:

```python
class Employee:
    def __init__(self, name, base_pay):
        self.name = name
        self.base_pay = base_pay

    def __str__(self):
        return f"{self.name}, base pay {self.base_pay}"


class SalesEmployee(Employee):
    def __init__(self, name, base_pay, sales_incentive):
        super().__init__(name, base_pay)
        self.sales_incentive = sales_incentive

    def __str__(self):
        return f"{super().__str__()}, incentive {self.sales_incentive}"


print(SalesEmployee("John", 5000, 2000))
```

Output:

```text
John, base pay 5000, incentive 2000
```

## What `super()` really returns

It is common to hear that "`super()` returns the parent class". That is a simplification. `super()` returns a special **proxy object**. When you look up an attribute on it, the proxy skips the current class and searches the classes that come **after** it in the method resolution order (`__mro__`). Whatever it finds is bound to the *current* `self`:

```python
class Employee:
    def get_pay(self):
        return 6000


class SalesEmployee(Employee):
    def get_pay(self):
        print(super())
        print(type(super()))
        print(super().get_pay)
        return super().get_pay() + 2000


print(SalesEmployee().get_pay())
```

Output (the memory address varies):

```text
<super: <class 'SalesEmployee'>, <SalesEmployee object>>
<class 'super'>
<bound method Employee.get_pay of <__main__.SalesEmployee object at 0x104809160>>
8000
```

Three things follow from this:

- You **do not pass `self`** to the parent method. `super().get_pay` is already a bound method of the current object, exactly like `self.get_pay`.
- Inside the parent's method, `self` is still the child object. If the parent's method calls `self.something()`, overrides in the child are still used.
- With zero arguments, `super()` figures out "the current class" and "the current object" by itself. Python provides them through a hidden `__class__` variable and the method's first parameter. That is why the short form works only inside a method defined in a class body.

```text
SalesEmployee.__mro__ = (SalesEmployee, Employee, object)
                              ^             ^
         super() inside       |             |
         SalesEmployee starts +-- skips --> searches from here
```

With single inheritance "the next class in the MRO" is simply the parent, so in practice `super()` means "the parent's version of this method". With multiple inheritance the next class may be a sibling class, which is why `super()` is also the foundation of cooperative multiple inheritance (covered in a later section).

## Chains of `super()` calls

In a chain of classes, each `__init__` calls the one directly above it. The calls nest, so the deepest parent finishes first:

```python
class Person:
    def __init__(self, name):
        print("Person.__init__")
        self.name = name


class Employee(Person):
    def __init__(self, name, job_title):
        print("Employee.__init__ starts")
        super().__init__(name)
        self.job_title = job_title
        print("Employee.__init__ ends")


class Manager(Employee):
    def __init__(self, name, job_title, team_size):
        print("Manager.__init__ starts")
        super().__init__(name, job_title)
        self.team_size = team_size
        print("Manager.__init__ ends")


boss = Manager("Iryna", "Head of QA", 7)
print(vars(boss))
```

Output:

```text
Manager.__init__ starts
Employee.__init__ starts
Person.__init__
Employee.__init__ ends
Manager.__init__ ends
{'name': 'Iryna', 'job_title': 'Head of QA', 'team_size': 7}
```

`Manager` does not need to know that `Person` exists. It talks only to its direct parent, and every class passes on the arguments that its own parent needs.

### Where to put the `super()` call

There is no syntax rule, but the order matters. Usually call `super().__init__()` **first**: the parent sets up the object, and then the child adds to it or adjusts it. If you assign an attribute before calling the parent, the parent may overwrite it:

```python
class Employee:
    def __init__(self, name):
        self.name = name
        self.currency = "USD"


class LocalEmployee(Employee):
    def __init__(self, name):
        self.currency = "UAH"
        super().__init__(name)  # overwrites currency


print(LocalEmployee("Olena").currency)
```

Output:

```text
USD
```

Moving `self.currency = "UAH"` below the `super().__init__(name)` line fixes it. In other methods, put the `super()` call wherever the logic needs it: before your code to post-process the parent's result, after your code to pre-process the arguments.

## `super()` vs `super(Class, self)` vs `Parent.method(self)`

There are three ways to reach the parent's method:

```python
class Employee:
    def get_pay(self):
        return 6000


class SalesEmployee(Employee):
    def get_pay(self):
        a = super().get_pay()                      # modern form
        b = super(SalesEmployee, self).get_pay()   # explicit form
        c = Employee.get_pay(self)                 # direct call on the class
        return a, b, c


print(SalesEmployee().get_pay())
```

Output:

```text
(6000, 6000, 6000)
```

- `super()` (Python 3+) is the form to use. It is short and does not repeat the class name, so renaming the class or its parent does not break it.
- `super(SalesEmployee, self)` is the old Python 2 spelling. You will still see it in legacy code; with the arguments written out it can also be used outside a method body, but that is rarely needed.
- `Employee.get_pay(self)` calls a plain function on the class, so you must pass `self` yourself. It hard-codes the parent name and bypasses the MRO, which breaks cooperative multiple inheritance. Avoid it unless you deliberately want one specific class's implementation.

## Common mistakes

- **Forgetting to call `super().__init__()`.** The child's `__init__` replaces the parent's, so the parent's attributes are never created and inherited methods fail with `AttributeError`.
- **Passing `self` explicitly.** `super()` already binds `self`, so passing it again shifts all arguments by one:

  ```python
  class Employee:
      def __init__(self, name, base_pay, bonus):
          self.name = name
          self.base_pay = base_pay
          self.bonus = bonus


  class SalesEmployee(Employee):
      def __init__(self, name, base_pay, bonus, sales_incentive):
          super().__init__(self, name, base_pay, bonus)  # wrong: extra self
          self.sales_incentive = sales_incentive


  SalesEmployee("John", 5000, 1000, 2000)
  ```

  Output:

  ```text
  Traceback (most recent call last):
    ...
  TypeError: Employee.__init__() takes 4 positional arguments but 5 were given
  ```

- **Forgetting the parentheses.** `super.__init__(...)` (without `()` after `super`) calls a method of the `super` type itself and fails with a confusing `TypeError`. Always write `super().`.
- **Forgetting `return`.** `def get_pay(self): super().get_pay() + self.sales_incentive` computes the sum and throws it away, so the method returns `None`.
- **Calling `self.method()` instead of `super().method()` inside the override.** `self.get_pay()` inside `get_pay()` calls the same override again, which leads to `RecursionError: maximum recursion depth exceeded`.
- **Using zero-argument `super()` outside a method.** In a plain function, a `@staticmethod` or a nested function inside a method, there is no "current class and object", and the call fails with `RuntimeError: super(): no arguments`.

## Summary

- `super()` lets an overriding method delegate to the parent's implementation instead of duplicating it.
- `super().__init__(...)` initialises the parent's part of the object; the child then sets only its own attributes.
- `super().method()` extends a parent method: call it, then build on the result.
- `super()` returns a proxy that searches the classes after the current one in the MRO and binds the result to the current `self`, so never pass `self` yourself.
- In a multi-level chain, each class calls only its direct parent; the calls nest down to the top of the hierarchy.
- Call `super().__init__()` early so the parent does not overwrite what the child sets.
- Prefer zero-argument `super()` over `super(Class, self)` and `Parent.method(self)`.

## Practice

### Exercise 1: Refactor with `super()`

Rewrite `Car.__init__` so it does not repeat the code of `Vehicle.__init__`. Create `Car("Skoda", "Octavia", 5)` and print `vars()` of it.

```python
class Vehicle:
    def __init__(self, brand, model):
        self.brand = brand
        self.model = model
        self.mileage = 0


class Car(Vehicle):
    def __init__(self, brand, model, seats):
        self.brand = brand
        self.model = model
        self.mileage = 0
        self.seats = seats
```

### Exercise 2: Layered formatting

Create three classes:

- `Message(text)` with a method `render()` that returns the text;
- `SignedMessage(text, author)`, a subclass of `Message`, whose `render()` returns the parent's result followed by `" -- <author>"`;
- `UrgentMessage(text, author)`, a subclass of `SignedMessage`, whose `render()` returns `"URGENT: "` followed by the parent's result.

Every `render()` override must use `super()`, and `UrgentMessage` must not define `__init__`. Print `render()` for `UrgentMessage("Server is down", "Ops")`.

### Exercise 3: Find the bugs

This code has three bugs related to `super()`. Find and fix them so that it prints `7500`.

```python
class Account:
    def __init__(self, owner, balance):
        self.owner = owner
        self.balance = balance

    def total(self):
        return self.balance


class SavingsAccount(Account):
    def __init__(self, owner, balance, interest):
        super().__init__(self, owner, balance)
        self.interest = interest

    def total(self):
        super().total() + self.interest


class PremiumAccount(SavingsAccount):
    def total(self):
        return self.total() + 500


print(PremiumAccount("Max", 6000, 1000).total())
```

## Solutions

### Exercise 1

```python
class Vehicle:
    def __init__(self, brand, model):
        self.brand = brand
        self.model = model
        self.mileage = 0


class Car(Vehicle):
    def __init__(self, brand, model, seats):
        super().__init__(brand, model)
        self.seats = seats


print(vars(Car("Skoda", "Octavia", 5)))
```

Output:

```text
{'brand': 'Skoda', 'model': 'Octavia', 'mileage': 0, 'seats': 5}
```

### Exercise 2

```python
class Message:
    def __init__(self, text):
        self.text = text

    def render(self):
        return self.text


class SignedMessage(Message):
    def __init__(self, text, author):
        super().__init__(text)
        self.author = author

    def render(self):
        return f"{super().render()} -- {self.author}"


class UrgentMessage(SignedMessage):
    def render(self):
        return f"URGENT: {super().render()}"


print(UrgentMessage("Server is down", "Ops").render())
```

Output:

```text
URGENT: Server is down -- Ops
```

`UrgentMessage` inherits `__init__` from `SignedMessage`, which in turn calls `Message.__init__`. Each `render()` wraps the result of the one above it.

### Exercise 3

The bugs:

1. `super().__init__(self, owner, balance)` passes `self` twice. Remove the explicit `self`.
2. `SavingsAccount.total()` has no `return`, so it returns `None`.
3. `PremiumAccount.total()` calls `self.total()`, which is itself, and recurses forever. It must call `super().total()`.

```python
class Account:
    def __init__(self, owner, balance):
        self.owner = owner
        self.balance = balance

    def total(self):
        return self.balance


class SavingsAccount(Account):
    def __init__(self, owner, balance, interest):
        super().__init__(owner, balance)
        self.interest = interest

    def total(self):
        return super().total() + self.interest


class PremiumAccount(SavingsAccount):
    def total(self):
        return super().total() + 500


print(PremiumAccount("Max", 6000, 1000).total())
```

Output:

```text
7500
```

---

*Source: [pythontutorial.net — Python super()](https://www.pythontutorial.net/python-oop/python-super/). Adapted and expanded for PyJourney.*
