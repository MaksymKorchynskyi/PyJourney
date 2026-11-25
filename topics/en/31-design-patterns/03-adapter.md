# Adapter

**Adapter** (also known as **Wrapper**) is a structural design pattern that lets objects with incompatible interfaces work together. An adapter sits between your code and some class you cannot or should not change, and translates calls and data from one shape to the other. It is the pattern you reach for every time a third-party library, a legacy module or an external API "almost" fits.

## What you'll learn

- How to recognise an interface mismatch and why changing the other side is often impossible
- The roles of the pattern: Client, Client Interface, Service and Adapter
- Object adapters (composition) and class adapters (inheritance) in Python
- A practical XML-to-JSON adapter for a third-party analytics library
- Adapters that already live in the standard library: `functools.cmp_to_key` and `io.TextIOWrapper`
- Pitfalls such as leaking exceptions, business logic in adapters and `__getattr__` pass-through

## Intent

Adapter converts the interface of one object into another interface that a client expects. The client keeps talking to "its" interface. The adapter receives those calls, converts arguments and results as needed, and forwards the work to the wrapped object, which does not even know it is being adapted.

## Problem

Imagine a stock market monitoring app. It downloads quotes from several exchanges in **XML** and shows charts. You decide to add a clever third-party analytics library, and run into a catch: the library accepts data only in **JSON**.

```python
import json


class AnalyticsLibrary:
    """Third-party code: expects JSON, and we cannot change it."""

    def analyze(self, payload: str) -> str:
        quotes = json.loads(payload)
        return f"{len(quotes)} quotes analysed"


xml_feed = '<quotes><quote symbol="ACME" price="12.50"/></quotes>'
try:
    AnalyticsLibrary().analyze(xml_feed)
except json.JSONDecodeError as error:
    print("JSONDecodeError:", error)
```

Output:

```text
JSONDecodeError: Expecting value: line 1 column 1 (char 0)
```

What are the options?

- **Change the library to accept XML.** You may not have its source code at all. Even if you do, your patch would be lost on the next upgrade and might break other code that depends on the library.
- **Change the whole app to produce JSON.** That rewrites working code everywhere just to satisfy one consumer.
- **Convert at every call site.** That scatters the same conversion code around the app.

None of these is attractive. What you want is one small object that does the translation in one place.

## Solution

Create an **adapter**: a special object that converts the interface of one object so that another object can understand it. The adapter wraps one of the objects and hides the complexity of the conversion. The wrapped object is not aware of the adapter.

An adapter can convert data formats (XML to JSON, metres to feet, `Decimal` hryvnias to integer kopecks), and it can also bridge different method names and call sequences:

1. The adapter exposes an interface compatible with one of the existing objects (the client).
2. The client calls the adapter's methods through that interface as if it were a normal collaborator.
3. On each call, the adapter forwards the request to the second object (the service), in the format and order the service expects.

Sometimes you can even build a **two-way adapter** that converts calls in both directions.

For the stock app, you write an XML-to-JSON adapter for each class of the analytics library your code uses, and you let the app talk to the library only through these adapters.

## Real-world analogy

On a first trip from the US to Europe you discover that your laptop charger's plug does not fit the wall socket: the standards differ. You do not rewire the hotel or cut the plug off. You buy a small travel adapter with a US-style socket on one side and a European plug on the other. Neither the laptop nor the wall knows it is there, and each keeps its own "interface".

## Structure

There are two classic variants.

**Object adapter** uses composition: the adapter implements the client interface and *contains* the service object. It works in any language and is the usual choice in Python.

```text
+----------+        +---------------------------+
|  Client  |------->|       <<interface>>       |
+----------+  uses  |      ClientInterface      |
                    |---------------------------|
                    | + method(data)            |
                    +---------------------------+
                                  ^
                                  | implements
                    +---------------------------+         +-----------------------------+
                    |          Adapter          |  wraps  |           Service           |
                    |---------------------------|-------->|-----------------------------|
                    | - adaptee: Service        |         | + service_method(special)   |
                    | + method(data)            |         +-----------------------------+
                    +---------------------------+

method(data):
    special = convert_to_service_format(data)
    return self.adaptee.service_method(special)
```

**Class adapter** uses inheritance: the adapter inherits from the service (and, if the target is a class, from it too), so it does not wrap anything. It needs multiple inheritance, which Python supports.

```text
+---------------------------+       +-----------------------------+
|     ClientInterface       |       |           Service           |
|---------------------------|       |-----------------------------|
| + method(data)            |       | + service_method(special)   |
+---------------------------+       +-----------------------------+
              ^                                   ^
              +-----------------+-----------------+
                                | inherits from both
                  +---------------------------+
                  |          Adapter          |
                  |---------------------------|
                  | + method(data):           |
                  |     self.service_method(  |
                  |         convert(data))    |
                  +---------------------------+
```

1. **Client** contains the existing business logic.
2. **Client Interface** describes the protocol other classes must follow to collaborate with the client.
3. **Service** is a useful class (often third-party or legacy) with an incompatible interface.
4. **Adapter** implements the client interface and translates each call into calls to the service.
5. As long as the client depends only on the client interface, you can add new adapters, or replace one when the service changes, without touching the client.

## Python implementation

The classic example: a round hole accepts round pegs, and we need to check whether *square* pegs fit. A square peg has a `width`, not a `radius`, so the hole cannot work with it directly. The adapter pretends to be a round peg whose radius is that of the smallest circle around the square, which is half of the square's diagonal: `width * sqrt(2) / 2`.

```python
import math
from typing import Protocol


class RoundPegLike(Protocol):
    """Client interface: anything with a radius."""

    @property
    def radius(self) -> float: ...


class RoundHole:
    """Client."""

    def __init__(self, radius: float) -> None:
        self.radius = radius

    def fits(self, peg: RoundPegLike) -> bool:
        return self.radius >= peg.radius


class RoundPeg:
    def __init__(self, radius: float) -> None:
        self.radius = radius


class SquarePeg:
    """Service: useful, but its interface does not match."""

    def __init__(self, width: float) -> None:
        self.width = width


class SquarePegAdapter:
    """Object adapter: wraps a SquarePeg and looks like a round peg."""

    def __init__(self, peg: SquarePeg) -> None:
        self._peg = peg

    @property
    def radius(self) -> float:
        # Radius of the smallest circle that holds the square: half the diagonal.
        return self._peg.width * math.sqrt(2) / 2


hole = RoundHole(5)
print("round peg r=5:", hole.fits(RoundPeg(5)))

small, large = SquarePeg(5), SquarePeg(10)
try:
    hole.fits(small)
except AttributeError as error:
    print("square peg directly:", error)

for peg in (small, large):
    adapter = SquarePegAdapter(peg)
    print(f"square peg w={peg.width} (r={adapter.radius:.2f}):", hole.fits(adapter))
```

Output:

```text
round peg r=5: True
square peg directly: 'SquarePeg' object has no attribute 'radius'
square peg w=5 (r=3.54): True
square peg w=10 (r=7.07): False
```

The `Protocol` describes the client interface structurally: `RoundPeg` and `SquarePegAdapter` never inherit from it, yet a type checker accepts both, because both have a `radius`. Neither `RoundHole` nor `SquarePeg` was changed.

### Class adapter

In Python a class adapter simply inherits from the service and adds the methods the client expects:

```python
# Continues the previous example
class SquarePegClassAdapter(SquarePeg):
    """Class adapter: it IS a SquarePeg and also behaves like a round peg."""

    @property
    def radius(self) -> float:
        return self.width * math.sqrt(2) / 2


peg = SquarePegClassAdapter(7)
print(f"w={peg.width}, r={peg.radius:.2f}, fits: {hole.fits(peg)}")
print(isinstance(peg, SquarePeg))
```

Output:

```text
w=7, r=4.95, fits: True
True
```

If the target interface is itself a concrete class or an `ABC`, the class adapter inherits from both: `class Adapter(Target, Service)`. Compare the two variants:

| | Object adapter | Class adapter |
|---|---|---|
| Mechanism | Composition: holds a service object | Inheritance from the service class |
| Can adapt an object that already exists | Yes, wrap any instance you receive | No, you must create the adapter *instead of* the service |
| Works with subclasses of the service | Yes | Only with the class it inherits from |
| Can override service behaviour | No (only wrap it) | Yes |
| Exposes service methods to the client | Only what you forward | All of them, which can leak details |

Prefer the object adapter unless you have a specific reason to inherit.

### Adapters in the standard library

Python itself ships adapters. `functools.cmp_to_key()` adapts an old-style comparison function (returns negative, zero or positive) to the `key=` interface that `sorted()` expects. `io.TextIOWrapper` adapts a binary stream to the text-file interface:

```python
import io
from functools import cmp_to_key


def compare_versions(a: str, b: str) -> int:
    left = [int(part) for part in a.split(".")]
    right = [int(part) for part in b.split(".")]
    return (left > right) - (left < right)


versions = ["1.10.0", "1.2.3", "1.9.12"]
print(sorted(versions))
print(sorted(versions, key=cmp_to_key(compare_versions)))

raw = io.BytesIO("Київ\nЛьвів\n".encode("utf-8"))  # bytes only
text = io.TextIOWrapper(raw, encoding="utf-8")      # adapter: now it reads str
print([line.strip() for line in text])
```

Output:

```text
['1.10.0', '1.2.3', '1.9.12']
['1.2.3', '1.9.12', '1.10.0']
['Київ', 'Львів']
```

## A practical example: XML feed to a JSON analytics library

Back to the stock app from the *Problem* section. Our dashboard expects an object with `analyze_xml()`. The third-party library offers `analyze()` that takes JSON. The adapter speaks XML to our code and JSON to the library:

```python
import json
import xml.etree.ElementTree as ET
from typing import Protocol


class AnalyticsLibrary:
    """Third-party service: expects a JSON array of {"symbol", "price"} objects."""

    def analyze(self, payload: str) -> str:
        quotes = json.loads(payload)
        top = max(quotes, key=lambda quote: quote["price"])
        average = sum(quote["price"] for quote in quotes) / len(quotes)
        return f"{len(quotes)} quotes, average {average:.2f}, top {top['symbol']} at {top['price']:.2f}"


class StockAnalyzer(Protocol):
    """Client interface: what our dashboard expects."""

    def analyze_xml(self, xml_feed: str) -> str: ...


class XmlToJsonAnalyticsAdapter:
    """Adapter: XML on the outside, JSON on the inside."""

    def __init__(self, library: AnalyticsLibrary) -> None:
        self._library = library

    def analyze_xml(self, xml_feed: str) -> str:
        root = ET.fromstring(xml_feed)
        quotes = [
            {"symbol": node.get("symbol"), "price": float(node.get("price", "nan"))}
            for node in root.iter("quote")
        ]
        if not quotes:
            raise ValueError("feed contains no quotes")
        return self._library.analyze(json.dumps(quotes))


class Dashboard:
    """Client: knows nothing about JSON or the analytics library."""

    def __init__(self, analyzer: StockAnalyzer) -> None:
        self.analyzer = analyzer

    def refresh(self, xml_feed: str) -> None:
        print("Dashboard:", self.analyzer.analyze_xml(xml_feed))


feed = """
<quotes source="exchange-a">
    <quote symbol="ACME" price="12.50"/>
    <quote symbol="GLOBX" price="98.10"/>
    <quote symbol="INITECH" price="45.00"/>
</quotes>
"""

dashboard = Dashboard(XmlToJsonAnalyticsAdapter(AnalyticsLibrary()))
dashboard.refresh(feed)

try:
    dashboard.refresh("<quotes/>")
except ValueError as error:
    print("Error:", error)
```

Output:

```text
Dashboard: 3 quotes, average 51.87, top GLOBX at 98.10
Error: feed contains no quotes
```

The adapter does only translation and the checks that translation needs (an empty feed cannot be converted into a meaningful request). If the analytics vendor changes its API, or you switch vendors, you write a new adapter. `Dashboard` stays as it is.

> **Note:** `xml.etree.ElementTree` is not hardened against maliciously crafted XML. For data from untrusted sources, use the third-party `defusedxml` package, which offers the same API.

## When to use it

- **You want to use an existing class, but its interface does not match the rest of your code.** The adapter becomes a translation layer between your code and a legacy class, a third-party class or any class with an awkward interface.
- **You want to reuse several existing subclasses that lack some common functionality, and you cannot add it to their superclass.** Instead of subclassing each one and duplicating the missing code, put that code in one adapter and wrap the objects in it. For this to work, the wrapped classes need a common interface, and the adapter's field should be typed with that interface. (This use is very close to the Decorator pattern.)
- **You want to isolate your code from a dependency that may change.** Talking to a library only through your own interface and an adapter means a vendor change touches a single class.

## How to implement it

1. Make sure you have at least two classes with incompatible interfaces: a useful *service* class you cannot change (third-party, legacy, or with many dependants), and one or more *client* classes that would benefit from it.
2. Declare the client interface: describe how clients want to talk to the service. In Python a `typing.Protocol` is ideal, because existing classes satisfy it without inheriting from it.
3. Create the adapter class that follows the client interface. Leave the methods empty for now.
4. Add a field to the adapter that stores the service object. Usually it is passed to `__init__`. Occasionally it is more convenient to pass it with each call.
5. Implement the client interface methods one by one. Each should delegate the real work to the service and handle only the conversion of interfaces and data formats, including converting results and exceptions back.
6. Make clients use the adapter only through the client interface. Then you can change or extend adapters without touching client code.

## Pros and cons

| Pros | Cons |
|---|---|
| *Single Responsibility Principle*: conversion code is separated from business logic. | More classes and interfaces, so overall complexity grows. |
| *Open/Closed Principle*: new adapters are added without changing client code. | Sometimes it is simpler to change the service class to match the rest of your code, if you own it. |
| Lets you use third-party and legacy code without modifying it. | An extra call layer: slightly more indirection when debugging. |
| Isolates your code from changes in the service's API. | A careless adapter can leak the service's types or exceptions into the client. |

## Relations with other patterns

- **Bridge** is usually designed up front, so that parts of an application can evolve independently. **Adapter** is usually applied to an existing app to make otherwise incompatible classes work together.
- **Adapter** provides a *different* interface to an existing object. **Decorator** keeps the interface the same or extends it, and supports recursive composition (decorators wrapping decorators), which adapters do not.
- With **Adapter** you access an existing object through a different interface. With **Proxy** the interface stays the same. With **Decorator** you access the object through an enhanced interface.
- **Facade** defines a new, simpler interface for a whole subsystem. **Adapter** makes an existing interface usable, and usually wraps a single object.
- **Bridge**, **State**, **Strategy** and, to some extent, **Adapter** have very similar structures: they all delegate work to another object through composition. They solve different problems, though, and the pattern name tells other developers *which* problem you are solving.

## Common mistakes

- **Putting business logic into the adapter.** An adapter that also applies discounts or decides who may see what is no longer an adapter, and that logic becomes hard to find. Keep it to translation.
- **Leaking the service's details.** If the adapter returns the library's own objects or lets its exceptions escape, the client is coupled to the library after all. Convert results into your own types and wrap foreign exceptions in your own.
- **Relying on `__getattr__` to forward "everything else".** It is handy, but it hides which methods the adapter really supports, defeats type checkers, and does **not** work for special methods, because Python looks those up on the class, not the instance:

  ```python
  class ListAdapter:
      def __init__(self, items: list[int]) -> None:
          self._items = items

      def __getattr__(self, name: str):
          return getattr(self._items, name)  # forwards ordinary attributes only


  adapter = ListAdapter([3, 1, 2])
  print(adapter.count(1))
  try:
      len(adapter)
  except TypeError as error:
      print("TypeError:", error)
  ```

  Output:

  ```text
  1
  TypeError: object of type 'ListAdapter' has no len()
  ```

- **Losing precision during conversion.** Converting money with `float` or rounding in the wrong place produces off-by-one-kopeck bugs. Use `Decimal` and convert explicitly (see Exercise 2).
- **Adapting code you own.** If you control both sides, it is usually better to fix the interface itself than to add a permanent translation layer.
- **Choosing a class adapter when you receive ready-made objects.** A class adapter cannot wrap an instance that already exists. Use an object adapter.

## Summary

- Adapter lets a client work with a service whose interface does not match, by putting a translating object between them.
- The client depends only on its own interface. The adapter implements it and delegates to the wrapped service.
- An object adapter (composition) is the default in Python. A class adapter (inheritance) can override service behaviour but cannot wrap existing instances.
- `typing.Protocol` is a natural way to describe the client interface without forcing anyone to inherit from it.
- The standard library is full of adapters: `functools.cmp_to_key`, `io.TextIOWrapper` and others.
- Keep adapters thin: convert arguments, results and exceptions, and nothing more.

## Practice

### Exercise 1: Fahrenheit sensor

A legacy driver class `FahrenheitSensor` has a method `read_fahrenheit() -> float`. Your thermostat code works with the protocol `TemperatureSensor`, which has `celsius() -> float`, and prints `"Room: 21.5 °C"`. Write `FahrenheitToCelsiusAdapter` and show it working with sensors reading `98.6` and `70.7` °F. Round to one decimal place.

### Exercise 2: Payment gateway

Your shop expects a gateway with `pay(amount: Decimal, order_id: str) -> PaymentResult`, where `PaymentResult` is a dataclass with `ok: bool` and `reference: str`. The payment provider's SDK, which you cannot change, looks like this:

```python
class LegacyPayClient:
    """Third-party SDK: amounts are integers in minor units (kopecks)."""

    LIMIT = 1_000_000  # 10,000.00 UAH

    def make_charge(self, cents: int, currency: str, meta: dict[str, str]) -> dict[str, str]:
        if cents > self.LIMIT:
            return {"status": "declined", "id": ""}
        return {"status": "succeeded", "id": f"ch_{meta['order']}_{cents}"}
```

Write `LegacyPayAdapter` that converts `Decimal` hryvnias to integer kopecks without floating-point errors, always sends `"UAH"`, and maps the returned dictionary to `PaymentResult`. Test it with `Decimal("19.99")` and `Decimal("15000")`.

### Exercise 3: Your own `cmp_to_key`

Implement `my_cmp_to_key(cmp)` that adapts a comparison function to the `key=` interface. It should return a class whose instances wrap a value and implement `__lt__` (enough for `sorted()`) by calling `cmp`. Check that it sorts `["1.10.0", "1.2.3", "1.9.12", "1.2.10"]` the same way as `functools.cmp_to_key`.

## Solutions

### Exercise 1

```python
from typing import Protocol


class TemperatureSensor(Protocol):
    def celsius(self) -> float: ...


class FahrenheitSensor:
    """Legacy driver: cannot be changed."""

    def __init__(self, value: float) -> None:
        self._value = value

    def read_fahrenheit(self) -> float:
        return self._value


class FahrenheitToCelsiusAdapter:
    def __init__(self, sensor: FahrenheitSensor) -> None:
        self._sensor = sensor

    def celsius(self) -> float:
        return round((self._sensor.read_fahrenheit() - 32) * 5 / 9, 1)


def show(sensor: TemperatureSensor) -> None:
    print(f"Room: {sensor.celsius()} °C")


for reading in (98.6, 70.7):
    show(FahrenheitToCelsiusAdapter(FahrenheitSensor(reading)))
```

Output:

```text
Room: 37.0 °C
Room: 21.5 °C
```

### Exercise 2

```python
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Protocol


@dataclass(frozen=True)
class PaymentResult:
    ok: bool
    reference: str


class PaymentGateway(Protocol):
    def pay(self, amount: Decimal, order_id: str) -> PaymentResult: ...


class LegacyPayClient:
    """Third-party SDK: amounts are integers in minor units (kopecks)."""

    LIMIT = 1_000_000  # 10,000.00 UAH

    def make_charge(self, cents: int, currency: str, meta: dict[str, str]) -> dict[str, str]:
        if cents > self.LIMIT:
            return {"status": "declined", "id": ""}
        return {"status": "succeeded", "id": f"ch_{meta['order']}_{cents}"}


class LegacyPayAdapter:
    def __init__(self, client: LegacyPayClient) -> None:
        self._client = client

    def pay(self, amount: Decimal, order_id: str) -> PaymentResult:
        kopecks = int((amount * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        response = self._client.make_charge(kopecks, "UAH", {"order": order_id})
        return PaymentResult(ok=response["status"] == "succeeded", reference=response["id"])


def checkout(gateway: PaymentGateway, amount: Decimal, order_id: str) -> None:
    result = gateway.pay(amount, order_id)
    print(f"{order_id}: {amount} UAH ->", result)


gateway = LegacyPayAdapter(LegacyPayClient())
checkout(gateway, Decimal("19.99"), "A-17")
checkout(gateway, Decimal("15000"), "A-18")
print(int(19.99 * 100), "<- what float would give")
```

Output:

```text
A-17: 19.99 UAH -> PaymentResult(ok=True, reference='ch_A-17_1999')
A-18: 15000 UAH -> PaymentResult(ok=False, reference='')
1998 <- what float would give
```

The last line shows why the conversion uses `Decimal`: as a float, `19.99 * 100` is `1998.9999999999998`, and `int()` truncates it to `1998`, one kopeck short. `Decimal` keeps the exact value, and `quantize()` rounds it explicitly.

### Exercise 3

```python
from collections.abc import Callable
from functools import cmp_to_key
from typing import Any


def my_cmp_to_key(cmp: Callable[[Any, Any], int]) -> type:
    class Key:
        __slots__ = ("value",)

        def __init__(self, value: Any) -> None:
            self.value = value

        def __lt__(self, other: "Key") -> bool:
            return cmp(self.value, other.value) < 0

        def __eq__(self, other: object) -> bool:
            return isinstance(other, Key) and cmp(self.value, other.value) == 0

    return Key


def compare_versions(a: str, b: str) -> int:
    left = [int(part) for part in a.split(".")]
    right = [int(part) for part in b.split(".")]
    return (left > right) - (left < right)


versions = ["1.10.0", "1.2.3", "1.9.12", "1.2.10"]
mine = sorted(versions, key=my_cmp_to_key(compare_versions))
standard = sorted(versions, key=cmp_to_key(compare_versions))
print(mine)
print(mine == standard)
```

Output:

```text
['1.2.3', '1.2.10', '1.9.12', '1.10.0']
True
```

`sorted()` only needs `<` between keys, so `__lt__` is enough for sorting. The returned class *is* the adapter: it wraps each value and translates the "less than" question into a call to the old-style comparison function. The real `functools.cmp_to_key` also defines `__gt__`, `__le__` and `__ge__`, so its keys work with `min()`, `max()` and other comparisons as well.

---

*Sources: [Refactoring.Guru — Adapter](https://refactoring.guru/design-patterns/adapter), [Refactoring.Guru — Adapter in Python](https://refactoring.guru/design-patterns/adapter/python/example). Adapted and expanded for PyJourney.*
