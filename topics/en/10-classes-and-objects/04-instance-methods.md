# Instance Methods

An **instance method** is a function defined in a class that works with one particular object. You call it with dot notation, `obj.method()`, and it can read and change that object's state. This topic looks under the hood: how a plain function inside a class becomes a **bound method** when you access it through an instance, why Python passes the instance as the first argument, and why that argument is called `self`.

## What you'll learn

- The difference between a function defined in a class and a bound method
- Why calling a method through an instance passes the instance automatically
- Why `obj.method()` is equivalent to `Class.method(obj)`
- What `self` is and why its name is only a convention
- How methods read and change an object's state and call each other
- What a bound method object contains and how to store it as a callback

## A function inside a class is just a function

Start with a class that contains a function without any parameters:

```python
class Request:
    def send():
        print("Sent")


Request.send()
print(Request.send)
print(type(Request.send))
```

Output (the address varies):

```text
Sent
<function Request.send at 0x1002efd70>
<class 'function'>
```

When you access `send` **through the class**, you get an ordinary function object, an instance of the `function` class. Calling it works exactly like calling any other function.

> **Note:** Python 2 had a special "unbound method" type for this case. In Python 3 it is gone: a function accessed through its class is just a function.

## Accessing it through an instance gives a bound method

Now create an instance and look at the same name through it:

```python
class Request:
    def send():
        print("Sent")


http_request = Request()
print(http_request.send)
print(type(http_request.send))
print(type(Request.send) is type(http_request.send))
```

Output (the address varies):

```text
<bound method Request.send of <__main__.Request object at 0x1002d5160>>
<class 'method'>
False
```

`http_request.send` is no longer a function. It is a **bound method**, an object of the `method` class that ties the function `send` to the instance `http_request`. The two have different types, so the comparison prints `False`.

What does "bound" mean in practice? Try calling it:

```python
class Request:
    def send():
        print("Sent")


http_request = Request()
http_request.send()
```

Output:

```text
Traceback (most recent call last):
  ...
TypeError: Request.send() takes 0 positional arguments but 1 was given
```

We passed nothing, yet Python complains that `send()` received one argument. A bound method always passes the object it is bound to as the **first argument** of the function, and `send()` has no parameter to receive it.

## Catching the hidden argument

To see what Python passes, let the function accept any number of positional arguments with `*args`:

```python
class Request:
    def send(*args):
        print("Sent", args)


http_request = Request()
Request.send()
print(hex(id(http_request)))
http_request.send()
```

Output (the addresses vary, but the last two always match):

```text
Sent ()
0x1002d52b0
Sent (<__main__.Request object at 0x1002d52b0>,)
```

Called through the class, `send()` receives no arguments. Called through the instance, it receives exactly one: an object at the same address as `http_request`. Comparing addresses by eye is tedious, so here is the same check with `is`:

```python
class Request:
    def send(*args):
        return args


http_request = Request()
received = http_request.send()
print(len(received))
print(received[0] is http_request)
```

Output:

```text
1
True
```

The first argument **is** the object you called the method on.

## `obj.method()` is `Class.method(obj)`

This leads to the key rule. The method call

```python
http_request.send()
```

is equivalent to the function call

```python
Request.send(http_request)
```

Since the first parameter always receives the instance, every instance method declares a parameter for it. By convention it is named `self`:

```python
class Request:
    def __init__(self, url):
        self.url = url

    def send(self):
        print(f"Sending request to {self.url}")


http_request = Request("https://example.com")
http_request.send()
Request.send(http_request)
```

Output:

```text
Sending request to https://example.com
Sending request to https://example.com
```

Both lines do the same thing. In everyday code you always write the first form, but knowing the second explains every "missing/extra positional argument" error you will meet with methods.

The same rule holds for built-in types. `str.upper` is a function on the `str` class, so you can pass it anywhere a one-argument function is expected:

```python
print("kyiv".upper())
print(str.upper("kyiv"))
print(list(map(str.upper, ["kyiv", "lviv"])))
```

Output:

```text
KYIV
KYIV
['KYIV', 'LVIV']
```

### About `self`

- `self` is an ordinary parameter, not a keyword. `def send(this):` would work too, but PEP 8 says to always use `self`, and every Python reader expects it.
- If you know Java, C# or JavaScript, `self` plays the role of `this`. The difference is that Python makes it **explicit**: you declare it in the signature and must write `self.url` to reach an attribute. A bare `url` inside a method means a local or global variable, never the object's attribute.

## Methods work with the object's state

The real job of an instance method is to read and update the state of its object. Through `self` a method can also call other methods of the same object:

```python
class ShoppingCart:
    def __init__(self):
        self.items = []

    def add(self, name, price, quantity=1):
        self.items.append((name, price, quantity))

    def total(self):
        return sum(price * quantity for _, price, quantity in self.items)

    def summary(self):
        return f"{len(self.items)} item(s), total {self.total():.2f}"


cart = ShoppingCart()
cart.add("Book", 12.5)
cart.add("Pen", 1.25, quantity=4)
print(cart.total())
print(cart.summary())

other = ShoppingCart()
print(other.summary())
```

Output:

```text
17.5
2 item(s), total 17.50
0 item(s), total 0.00
```

- `add()` changes the state of the cart it is called on.
- `summary()` calls `self.total()`, another method of the same object.
- `other` has its own `items` list, so the methods of `other` see an empty cart. One class, many independent objects, and `self` is how each method call knows which object it is working on.

## Bound method objects up close

A bound method keeps two references: the function (`__func__`) and the object (`__self__`). Calling the bound method just calls `__func__(__self__, ...)`:

```python
class Request:
    def __init__(self, url):
        self.url = url

    def send(self):
        return f"Sending request to {self.url}"


http_request = Request("https://example.com")
method = http_request.send

print(method.__self__ is http_request)
print(method.__func__ is Request.send)
print(method.__func__(method.__self__))
```

Output:

```text
True
True
Sending request to https://example.com
```

Every attribute access creates a **new** bound method object, so two accesses are equal but not identical:

```python
class Request:
    def send(self):
        pass


http_request = Request()
print(http_request.send is http_request.send)
print(http_request.send == http_request.send)
```

Output:

```text
False
True
```

### Storing a bound method as a callback

Because a bound method remembers its object, you can store it in a variable (no parentheses!) and call it later. This is how button handlers, timers and other callbacks usually work:

```python
class Counter:
    def __init__(self):
        self.value = 0

    def increment(self):
        self.value += 1


counter = Counter()
click = counter.increment  # store the bound method, do not call it yet
for _ in range(3):
    click()
print(counter.value)
```

Output:

```text
3
```

> **Note:** For the curious: functions are *descriptors*. When you access `http_request.send`, Python finds the function `send` in the class and calls its `__get__()` method with the instance, and that call builds the bound method. The topic on descriptors explains this mechanism in detail.

## Common mistakes

- **Forgetting `self` in the definition.** The call `obj.method()` passes the instance, and a method without a parameter for it fails with `TypeError: ... takes 0 positional arguments but 1 was given`.

- **Calling an instance method through the class without an instance.**

  ```python
  class Request:
      def send(self):
          print("Sent", self)


  Request.send()
  ```

  Output:

  ```text
  Traceback (most recent call last):
    ...
  TypeError: Request.send() missing 1 required positional argument: 'self'
  ```

  Create an instance first, or pass one explicitly: `Request.send(Request())`.

- **Forgetting `self.` inside the method.** A bare name is looked up as a local or global variable. Since Python 3.12 the error message even suggests the fix:

  ```python
  class Request:
      def __init__(self, url):
          self.url = url

      def send(self):
          print(f"Sending request to {url}")


  Request("https://example.com").send()
  ```

  Output:

  ```text
  Traceback (most recent call last):
    ...
  NameError: name 'url' is not defined. Did you mean: 'self.url'?
  ```

- **Forgetting the parentheses in a condition.** A bound method object is always truthy, so this check never does what it seems to:

  ```python
  class Cart:
      def __init__(self):
          self.items = []

      def is_empty(self):
          return not self.items


  cart = Cart()
  cart.items.append("book")
  if cart.is_empty:  # bug: should be cart.is_empty()
      print("Cart is empty")
  ```

  Output:

  ```text
  Cart is empty
  ```

- **Giving an attribute the same name as a method.** `self.total = 0` in `__init__` stores an instance attribute that hides the method `total()`. Calling `cart.total()` then fails with `TypeError: 'int' object is not callable`. Use distinct names such as `self._total` and `total()`.

## Summary

- A function defined in a class is a plain function when accessed through the class (`Request.send`).
- Accessed through an instance, it becomes a bound method (`http_request.send`) that remembers the instance.
- Calling a bound method passes the instance as the first argument: `obj.method(x)` is the same as `Class.method(obj, x)`.
- The first parameter of an instance method is named `self` by convention. Inside the method, reach attributes and other methods through `self.`.
- Instance methods read and change the state of the specific object they are called on.
- A bound method has `__self__` (the object) and `__func__` (the function). Each access creates a new bound method, which you can store and call later as a callback.

## Practice

### Exercise 1: A bank account

Write a class `BankAccount` with:

- `__init__(self, owner, balance=0)`;
- `deposit(amount)` that adds money and returns the new balance;
- `withdraw(amount)` that subtracts money and returns the new balance, but raises `ValueError("insufficient funds")` if the balance is too low.

Create an account for `"Olena"`, deposit 100, withdraw 30, then try to withdraw 500 and print the error message. Finally print the balance.

### Exercise 2: Two ways to call

Using your `BankAccount`, show that `account.deposit(50)` and `BankAccount.deposit(account, 50)` have the same effect. Then print whether `account.deposit.__self__` is `account` and whether `account.deposit.__func__` is `BankAccount.deposit`.

### Exercise 3: Command dispatcher

Write a class `Light` with an attribute `is_on` (initially `False`) and the methods `turn_on()`, `turn_off()` and `toggle()`, each printing the new state. Store the **bound methods** of one light in a dictionary `{"on": ..., "off": ..., "toggle": ...}` and run the commands `["on", "toggle", "toggle", "off"]` by looking them up in the dictionary.

### Exercise 4: Method chaining

Write a class `TextBuilder` with the methods `add(text)` and `newline()`, both returning `self`, and `build()` that returns the collected text as one string. Build this text with a single chained expression and print it:

```text
Hello, world!
Bye.
```

## Solutions

### Exercise 1

```python
class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount
        return self.balance

    def withdraw(self, amount):
        if amount > self.balance:
            raise ValueError("insufficient funds")
        self.balance -= amount
        return self.balance


account = BankAccount("Olena")
print(account.deposit(100))
print(account.withdraw(30))
try:
    account.withdraw(500)
except ValueError as error:
    print("Error:", error)
print(account.owner, account.balance)
```

Output:

```text
100
70
Error: insufficient funds
Olena 70
```

The failed withdrawal raises before changing anything, so the balance stays consistent.

### Exercise 2

```python
class BankAccount:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount
        return self.balance


account = BankAccount("Olena")
print(account.deposit(50))
print(BankAccount.deposit(account, 50))
print(account.deposit.__self__ is account)
print(account.deposit.__func__ is BankAccount.deposit)
```

Output:

```text
50
100
True
True
```

Both calls ran the same function with the same object as `self`, so each added 50 to the same balance.

### Exercise 3

```python
class Light:
    def __init__(self):
        self.is_on = False

    def turn_on(self):
        self.is_on = True
        self.report()

    def turn_off(self):
        self.is_on = False
        self.report()

    def toggle(self):
        self.is_on = not self.is_on
        self.report()

    def report(self):
        print("Light is", "ON" if self.is_on else "OFF")


light = Light()
commands = {"on": light.turn_on, "off": light.turn_off, "toggle": light.toggle}

for name in ["on", "toggle", "toggle", "off"]:
    commands[name]()
```

Output:

```text
Light is ON
Light is OFF
Light is ON
Light is OFF
```

Each value in `commands` is a bound method that remembers `light`, so `commands[name]()` needs no arguments.

### Exercise 4

```python
class TextBuilder:
    def __init__(self):
        self.parts = []

    def add(self, text):
        self.parts.append(text)
        return self

    def newline(self):
        self.parts.append("\n")
        return self

    def build(self):
        return "".join(self.parts)


text = TextBuilder().add("Hello, ").add("world!").newline().add("Bye.").build()
print(text)
```

Output:

```text
Hello, world!
Bye.
```

Because `add()` and `newline()` return the same object they were called on, the next method in the chain is called on that object too.

---

*Source: [pythontutorial.net — Python Methods](https://www.pythontutorial.net/python-oop/python-methods/). Adapted and expanded for PyJourney.*
