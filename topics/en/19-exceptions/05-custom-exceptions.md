# Custom Exceptions

Built-in exceptions describe general problems: a bad value, a missing key, a failed file operation. Problems specific to your program, such as insufficient funds, an unknown product or a temperature outside the supported range, deserve their own names. A custom exception class lets callers catch exactly *your* errors, and it can carry structured data about what went wrong.

## What you'll learn

- How to define a custom exception class, and why it should inherit from `Exception`
- How to add attributes, properties and a custom message without breaking `args` and `str()`
- How to build an exception hierarchy and catch errors at different levels
- When to also inherit from a built-in exception such as `ValueError` or `LookupError`
- Naming conventions and design guidelines
- Pitfalls: a broken `super().__init__()` call, exceptions that cannot be pickled, and too many exception classes

## Defining a custom exception

A custom exception is an ordinary class that inherits from `Exception` (directly or through one of its subclasses):

```python
class CustomException(Exception):
    """My custom exception class."""


try:
    raise CustomException("This is my custom exception")
except CustomException as ex:
    print(ex)
    print(repr(ex))
    print(ex.args)
```

Output:

```text
This is my custom exception
CustomException('This is my custom exception')
('This is my custom exception',)
```

The class body contains only a docstring. A docstring is a statement, so no `pass` is needed. Even this minimal class inherits everything from `Exception`: `args`, the message, the traceback, notes, chaining with `from`. Since it is a regular class, you can add whatever you need:

- attributes and properties with details about the error;
- methods, for example to format the error for a log or a user interface;
- your own `__str__` and `__repr__`;
- anything else a normal class can have.

Two conventions apply to almost every custom exception:

- **Inherit from `Exception`, not `BaseException`.** Generic handlers use `except Exception`, and they should catch your errors. `BaseException` is reserved for `SystemExit`, `KeyboardInterrupt` and other signals that are not program errors (see the topic *Exceptions*).
- **End the name with `Error`**, as recommended by PEP 8: `InsufficientFundsError`, `ProductNotFoundError`. (The name `CustomException` above follows the source tutorial. In real code, prefer the `Error` suffix.)

## Adding data to an exception

The main advantage of a custom exception is that it can carry the data a caller needs to react. Here `InsufficientFundsError` stores the balance and the requested amount, and computes the shortfall:

```python
class InsufficientFundsError(Exception):
    def __init__(self, balance, amount):
        super().__init__(f"cannot withdraw {amount}: balance is only {balance}")
        self.balance = balance
        self.amount = amount

    @property
    def shortfall(self):
        return self.amount - self.balance


def withdraw(balance, amount):
    if amount > balance:
        raise InsufficientFundsError(balance, amount)
    return balance - amount


print(withdraw(100, 30))
try:
    withdraw(100, 150)
except InsufficientFundsError as e:
    print(e)
    print("missing:", e.shortfall)
    print(e.args)
```

Output:

```text
70
cannot withdraw 150: balance is only 100
missing: 50
('cannot withdraw 150: balance is only 100',)
```

The `__init__` method calls `super().__init__()` with the finished message. That message becomes `args[0]`, so `str(e)`, `print(e)` and the last line of a traceback all show it. The caller does not have to parse that text: it reads `e.balance`, `e.amount` or `e.shortfall` directly.

> **Note:** If you call `super().__init__()` with **no** arguments, `args` becomes empty and the message disappears: `str(e)` is `''`, and the traceback shows only the class name. Always pass the message (or the original arguments) to the base class.

## Example: a temperature converter

Suppose a program works with liquid water at normal atmospheric pressure, so it accepts only temperatures from 32 °F (the freezing point) to 212 °F (the boiling point). Any other value is an error in this program's domain, so it gets its own exception, `FahrenheitError`.

> **Note:** The source tutorial calls 32 and 212 "the minimum and maximum values of a temperature in Fahrenheit". They are not: the Fahrenheit scale has no such limits (−40 °F is a perfectly real winter temperature). They are the limits *this program* chooses to accept.

### The `FahrenheitError` class

```python
class FahrenheitError(Exception):
    min_f = 32
    max_f = 212

    def __init__(self, f, *args):
        super().__init__(f, *args)
        self.f = f

    def __str__(self):
        return f"{self.f} °F is out of the valid range {self.min_f}..{self.max_f} °F"


def fahrenheit_to_celsius(f: float) -> float:
    if f < FahrenheitError.min_f or f > FahrenheitError.max_f:
        raise FahrenheitError(f)
    return (f - 32) * 5 / 9


for f in [50, 212, 300]:
    try:
        print(f, "->", round(fahrenheit_to_celsius(f), 2))
    except FahrenheitError as e:
        print("error:", e)
        print("args:", e.args, "| repr:", repr(e), "| f:", e.f)
```

Output:

```text
50 -> 10.0
212 -> 100.0
error: 300 °F is out of the valid range 32..212 °F
args: (300,) | repr: FahrenheitError(300) | f: 300
```

How it works:

- `FahrenheitError` inherits from `Exception`.
- The class attributes `min_f` and `max_f` hold the accepted range. They live on the class, so the converter can read them as `FahrenheitError.min_f` without creating an exception.
- `__init__` accepts the invalid value `f` and any extra positional arguments, and passes **all** of them to the base class: `super().__init__(f, *args)`. It also stores `f` as an attribute.
- `__str__` builds a readable message from the stored data. Overriding `__str__` changes what `print(e)` and tracebacks show. `repr(e)` still comes from `args`.

> **Note:** The source tutorial writes `super().__init__(args)`, which passes the tuple `args` as **one** argument. With that call, `FahrenheitError(300).args` is `((),)` (a tuple containing an empty tuple), and `repr()` shows `FahrenheitError(())`. The value `300` never reaches `args`. Use `super().__init__(f, *args)`.

### The complete program

The main program reads a value, converts it to a number, and converts it to Celsius. Two different exceptions can occur, and each gets its own handler:

```python
class FahrenheitError(Exception):
    min_f = 32
    max_f = 212

    def __init__(self, f, *args):
        super().__init__(f, *args)
        self.f = f

    def __str__(self):
        return f"{self.f} °F is out of the valid range {self.min_f}..{self.max_f} °F"


def fahrenheit_to_celsius(f: float) -> float:
    if f < FahrenheitError.min_f or f > FahrenheitError.max_f:
        raise FahrenheitError(f)
    return (f - 32) * 5 / 9


if __name__ == "__main__":
    text = input("Enter a temperature in Fahrenheit: ")
    try:
        f = float(text)
    except ValueError as ex:
        print(ex)
    else:
        try:
            c = fahrenheit_to_celsius(f)
        except FahrenheitError as ex:
            print(ex)
        else:
            print(f"{f} Fahrenheit = {c:.4f} Celsius")
```

Three runs of the program, with the user's input after the prompt:

```text
Enter a temperature in Fahrenheit: 50
50.0 Fahrenheit = 10.0000 Celsius
```

```text
Enter a temperature in Fahrenheit: 300
300.0 °F is out of the valid range 32..212 °F
```

```text
Enter a temperature in Fahrenheit: hot
could not convert string to float: 'hot'
```

1. `input()` returns a string.
2. `float(text)` raises the built-in `ValueError` if the text is not a number. Its message is printed.
3. Only if the conversion succeeded (the `else` clause), `fahrenheit_to_celsius()` runs. A `FahrenheitError` is printed using its `__str__`. Otherwise the result is printed with four decimal places.

(The source tutorial calls `float()` on the value a second time inside the `else` clause. That is unnecessary, because `f` is already a `float` at that point.)

## Building an exception hierarchy

A library or a larger application usually defines one **base exception** and derives all its specific exceptions from it. Then callers can choose how precisely to catch:

```text
Exception
 +-- ShopError
      +-- ProductNotFoundError
      +-- OutOfStockError
```

```python
class ShopError(Exception):
    """Base class for all errors raised by the shop."""


class ProductNotFoundError(ShopError):
    def __init__(self, sku):
        super().__init__(f"product {sku!r} not found")
        self.sku = sku


class OutOfStockError(ShopError):
    def __init__(self, sku, requested, available):
        super().__init__(f"only {available} of {sku!r} left, requested {requested}")
        self.sku = sku
        self.requested = requested
        self.available = available


STOCK = {"apple": 5, "pear": 1}


def buy(sku, qty):
    if sku not in STOCK:
        raise ProductNotFoundError(sku)
    if STOCK[sku] < qty:
        raise OutOfStockError(sku, qty, STOCK[sku])
    STOCK[sku] -= qty
    return f"bought {qty} x {sku}"


for sku, qty in [("apple", 2), ("plum", 1), ("pear", 3)]:
    try:
        print(buy(sku, qty))
    except OutOfStockError as e:
        print(f"{e} -> offering {e.available} instead")
    except ShopError as e:
        print("shop error:", e)
```

Output:

```text
bought 2 x apple
shop error: product 'plum' not found
only 1 of 'pear' left, requested 3 -> offering 1 instead
```

- The specific handler for `OutOfStockError` uses the exception's data to react sensibly.
- The handler for the base class `ShopError` catches every other shop problem, including exception classes added to the shop in the future, while unrelated bugs (`TypeError`, `NameError`, ...) still surface.
- As always, the more specific `except` clause comes first.

Keep the hierarchy small. Create a separate exception class only when a caller will want to handle it differently. One base class plus a few specific subclasses is usually enough.

## Inheriting from built-in exceptions too

If your error is a special case of a built-in one, inherit from that built-in as well. Then code that only knows about the built-in exception still handles yours correctly. A product that is not found is a kind of lookup failure, and a temperature out of range is an invalid value:

```python
class ShopError(Exception):
    """Base class for all errors raised by the shop."""


class ProductNotFoundError(ShopError, LookupError):
    pass


class FahrenheitError(ValueError):
    pass


try:
    raise ProductNotFoundError("product 'plum' not found")
except LookupError as e:
    print("caught as LookupError:", repr(e))

try:
    raise FahrenheitError("300 °F is out of range")
except ValueError as e:
    print("caught as ValueError:", repr(e))

print([cls.__name__ for cls in ProductNotFoundError.__mro__])
```

Output:

```text
caught as LookupError: ProductNotFoundError("product 'plum' not found")
caught as ValueError: FahrenheitError('300 °F is out of range')
['ProductNotFoundError', 'ShopError', 'LookupError', 'Exception', 'BaseException', 'object']
```

Multiple inheritance works here because `ShopError` and `LookupError` both derive from `Exception`. One consequence to keep in mind: if `FahrenheitError` were a subclass of `ValueError` in the converter program above, an `except ValueError` clause written for `float()` would also catch it. Separate `try` blocks, or a specific clause placed before the general one, keep the two cases apart.

> **Tip:** Avoid deriving from `KeyError` just to signal "not found". `KeyError` formats its message with `repr()`, so a message like `product not found` is printed with quotes around it. `LookupError` is the better base for that.

## Keeping exceptions picklable

Exceptions are sometimes **pickled**: for example, when an exception raised in a worker process is sent back to the main process by `multiprocessing` or `concurrent.futures`. Python recreates an exception by calling its class with `args`. If `__init__` expects different arguments than the ones stored in `args`, recreating it fails:

```python
import pickle


class InsufficientFundsError(Exception):
    def __init__(self, balance, amount):
        super().__init__(f"cannot withdraw {amount}: balance is only {balance}")
        self.balance = balance
        self.amount = amount


error = InsufficientFundsError(100, 150)
data = pickle.dumps(error)
pickle.loads(data)
```

Output:

```text
Traceback (most recent call last):
  File "app.py", line 13, in <module>
    pickle.loads(data)
    ~~~~~~~~~~~~^^^^^^
TypeError: InsufficientFundsError.__init__() missing 1 required positional argument: 'amount'
```

`args` holds only the message, so unpickling calls `InsufficientFundsError("cannot withdraw ...")` and the second argument is missing. The fix is the pattern used by `FahrenheitError`: pass the **original arguments** to `super().__init__()` and build the message in `__str__`. Exercise 3 asks you to do exactly that. If your exceptions never leave the process, this does not matter. If they might, test a `pickle` round trip.

## Common mistakes

- **Inheriting from `BaseException`.** `except Exception` will not catch such an exception, so generic error handlers miss it, and it behaves like `KeyboardInterrupt`:

  ```python
  class ConfigError(BaseException):
      pass


  try:
      try:
          raise ConfigError("missing key")
      except Exception:
          print("handled")
  except BaseException as e:
      print("escaped except Exception:", repr(e))
  ```

  Output:

  ```text
  escaped except Exception: ConfigError('missing key')
  ```

- **Passing `args` as one argument.** `super().__init__(args)` stores a tuple inside a tuple. Unpack it: `super().__init__(f, *args)`.
- **Calling `super().__init__()` without the message.** The exception then has an empty message, and tracebacks show only its class name.
- **An exception class for every function.** Too many classes make handling harder, not easier. Create a class when callers need to distinguish that error, and group related classes under one base.
- **Using a custom exception where a built-in one fits.** A function that receives a negative quantity can simply raise `ValueError`. Custom exceptions are for errors of your domain. When in doubt, inherit from the matching built-in so both kinds of handlers work.
- **Putting the data only into the message.** `raise ShopError(f"only {n} left")` forces callers to parse text. Store the values as attributes.

## Summary

- A custom exception is a class that inherits from `Exception` (or a subclass of it). A docstring is enough as the body.
- Name exception classes with an `Error` suffix, and never inherit from `BaseException` directly.
- Add attributes and properties for the data a caller needs, and pass the message (or the original arguments) to `super().__init__()` so that `args`, `str()` and tracebacks work.
- Override `__str__` to build the message from the stored data.
- Organize the exceptions of a module or application under one base class. Catch the specific classes where you can react, and the base class to handle "any error from this module".
- Inherit from a built-in exception too (`ValueError`, `LookupError`, ...) when your error is a special case of it.
- If exceptions may cross process boundaries, make sure `__init__` can be called with `args`, so they survive pickling.

## Practice

### Exercise 1: A validation error

Define `ValidationError` as a subclass of `ValueError` with the attributes `field` and `value`, and the message `"invalid <field>: <value!r>"`. Write `validate_user(data)` that raises it when `data["name"]` is empty, or when `data["age"]` is not between 0 and 150. Show that a caller can catch it with `except ValueError` and still read `e.field`.

### Exercise 2: A bank hierarchy

Create `BankError` as the base class, with three subclasses: `AccountNotFoundError` (also a `LookupError`, with an `account` attribute), `InsufficientFundsError` (with `balance`, `amount` and a `shortfall` property) and `AccountFrozenError`. Write `transfer(accounts, frozen, src, dst, amount)`, where `accounts` maps account names to balances and `frozen` is a set of names. Test four transfers: a valid one, one from an unknown account, one with too little money, and one from a frozen account. Handle `InsufficientFundsError` with a specific message that mentions the shortfall and everything else with `except BankError`.

### Exercise 3: Make it picklable

Rewrite `InsufficientFundsError` from the section "Keeping exceptions picklable" so that `super().__init__()` receives `balance` and `amount`, and the message is produced by `__str__`. Check that after `pickle.loads(pickle.dumps(error))` the copy has the same type, `args`, message and attributes.

### Exercise 4: HTTP errors by status code

Define `HTTPError(Exception)` with `status` and `url` attributes, and three subclasses: `ClientError` (4xx), `NotFoundError(ClientError)` (404) and `ServerError` (5xx). Write `error_for(status, url)` that **returns** (does not raise) an instance of the most specific class for the status code. Then raise the errors for `(404, "/missing")`, `(403, "/admin")` and `(503, "/api")` and handle them with three `except` clauses in the right order: `"page not found"`, `"fix the request"` and `"retry later"`.

## Solutions

### Exercise 1

```python
class ValidationError(ValueError):
    def __init__(self, field, value):
        super().__init__(f"invalid {field}: {value!r}")
        self.field = field
        self.value = value


def validate_user(data):
    if not data["name"]:
        raise ValidationError("name", data["name"])
    if not 0 <= data["age"] <= 150:
        raise ValidationError("age", data["age"])


for user in [{"name": "Olena", "age": 34}, {"name": "", "age": 20}, {"name": "Max", "age": 200}]:
    try:
        validate_user(user)
        print("ok:", user["name"])
    except ValueError as e:
        print(f"{e} (field={e.field})")
```

Output:

```text
ok: Olena
invalid name: '' (field=name)
invalid age: 200 (field=age)
```

### Exercise 2

```python
class BankError(Exception):
    """Base class for banking errors."""


class AccountNotFoundError(BankError, LookupError):
    def __init__(self, account):
        super().__init__(f"account {account!r} does not exist")
        self.account = account


class InsufficientFundsError(BankError):
    def __init__(self, balance, amount):
        super().__init__(f"cannot transfer {amount}: balance is {balance}")
        self.balance = balance
        self.amount = amount

    @property
    def shortfall(self):
        return self.amount - self.balance


class AccountFrozenError(BankError):
    pass


def transfer(accounts, frozen, src, dst, amount):
    for name in (src, dst):
        if name not in accounts:
            raise AccountNotFoundError(name)
    if src in frozen:
        raise AccountFrozenError(f"account {src!r} is frozen")
    if accounts[src] < amount:
        raise InsufficientFundsError(accounts[src], amount)
    accounts[src] -= amount
    accounts[dst] += amount


accounts = {"olena": 100, "max": 20, "ivan": 500}
frozen = {"ivan"}
for src, dst, amount in [("olena", "max", 30), ("anna", "max", 5),
                         ("max", "olena", 80), ("ivan", "olena", 10)]:
    try:
        transfer(accounts, frozen, src, dst, amount)
        print(f"{src} -> {dst}: {amount} ok")
    except InsufficientFundsError as e:
        print(f"{src} -> {dst}: {e} (short by {e.shortfall})")
    except BankError as e:
        print(f"{src} -> {dst}: {type(e).__name__}: {e}")
print(accounts)
```

Output:

```text
olena -> max: 30 ok
anna -> max: AccountNotFoundError: account 'anna' does not exist
max -> olena: cannot transfer 80: balance is 50 (short by 30)
ivan -> olena: AccountFrozenError: account 'ivan' is frozen
{'olena': 70, 'max': 50, 'ivan': 500}
```

All checks happen before any money moves, so a failed transfer leaves the balances unchanged.

### Exercise 3

```python
import pickle


class InsufficientFundsError(Exception):
    def __init__(self, balance, amount):
        super().__init__(balance, amount)
        self.balance = balance
        self.amount = amount

    def __str__(self):
        return f"cannot withdraw {self.amount}: balance is only {self.balance}"


error = InsufficientFundsError(100, 150)
copy = pickle.loads(pickle.dumps(error))

print(type(copy).__name__, copy.args)
print(copy)
print(copy.balance, copy.amount)
print(str(copy) == str(error))
```

Output:

```text
InsufficientFundsError (100, 150)
cannot withdraw 150: balance is only 100
100 150
True
```

Now `args` is `(100, 150)`, so unpickling calls `InsufficientFundsError(100, 150)`, which matches the signature of `__init__`. A side benefit: `repr(error)` is `InsufficientFundsError(100, 150)`, which shows the real data.

### Exercise 4

```python
class HTTPError(Exception):
    def __init__(self, status, url):
        super().__init__(f"{status} error for {url}")
        self.status = status
        self.url = url


class ClientError(HTTPError):
    """4xx: the request was wrong."""


class NotFoundError(ClientError):
    """404: the resource does not exist."""


class ServerError(HTTPError):
    """5xx: the server failed."""


def error_for(status, url):
    if status == 404:
        cls = NotFoundError
    elif 400 <= status < 500:
        cls = ClientError
    elif 500 <= status < 600:
        cls = ServerError
    else:
        cls = HTTPError
    return cls(status, url)


for status, url in [(404, "/missing"), (403, "/admin"), (503, "/api")]:
    try:
        raise error_for(status, url)
    except NotFoundError as e:
        print(e, "-> page not found")
    except ClientError as e:
        print(e, "-> fix the request")
    except ServerError as e:
        print(e, "-> retry later")
```

Output:

```text
404 error for /missing -> page not found
403 error for /admin -> fix the request
503 error for /api -> retry later
```

`NotFoundError` must come before `ClientError`, because it is a subclass of it. In the opposite order, a 404 would be reported as "fix the request". A factory function that *returns* the exception keeps the `raise` visible at the place where the error happens.

---

*Source: [pythontutorial.net — Python Custom Exception](https://www.pythontutorial.net/python-oop/python-custom-exception/). Adapted and expanded for PyJourney.*
