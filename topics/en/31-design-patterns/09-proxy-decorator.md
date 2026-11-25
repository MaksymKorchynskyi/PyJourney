# Proxy/Decorator

**Proxy** and **Decorator** are two structural patterns built the same way: a wrapper object has the same interface as the object inside it and forwards calls to it, doing something extra along the way. They differ in purpose. A proxy **controls access** to an object (creates it lazily, caches its answers, checks permissions). A decorator **adds responsibilities** to an object, and decorators are designed to be stacked in any combination. Python also has the `@decorator` syntax, which is related to the Decorator pattern but is not the same thing.

## What you'll learn

- How a proxy adds lazy loading, caching and access control without changing the real object or its clients
- How to write a generic forwarding proxy with `__getattr__`, and where it breaks
- When a proxy should be a subclass of the service instead of a wrapper
- How the Decorator pattern replaces an explosion of subclasses with stackable wrappers
- Why the order of decorators matters
- How the Decorator *pattern* differs from Python's `@decorator` *syntax*, and how they relate
- How to tell Proxy and Decorator apart

## Proxy

### Intent

**Proxy** provides a substitute for another object (the **service**). The proxy has the same interface as the service, so clients cannot tell them apart, but it controls access to the service: it can do something before or after forwarding a request, or decide not to forward it at all.

### Problem

An online shop shows prices in hryvnias, and exchange rates come from a third-party API client. The client is slow: creating it opens a network connection, and every `get_rate()` call is an HTTP request. A product page with 30 prices makes 30 identical requests, and the connection is opened even for pages that show no prices.

You could add caching and lazy creation in every place that uses the client, but then the same code would be copied everywhere. You could add it to the client class itself, but the class belongs to a third-party library and you cannot change it.

### Solution

Create a **proxy** class with the same interface as the real client. The proxy keeps a reference to the service, and when a request arrives, it does its own work (creates the service on first use, looks in its cache) and then delegates to the real service only if needed.

Since the proxy follows the same interface, you can pass it to any code that expects the real client. Neither the client code nor the service know that a proxy sits between them.

### Real-world analogy

A bank card is a proxy for the money in your account. In a shop it works exactly like cash for paying: you "pay" with it. But the card adds control: it checks your PIN, it can block a suspicious purchase, and it gives the shop the money without anybody carrying a bag of banknotes. The shop does not care whether you paid with the card or with cash, both follow the same "payment" interface.

### Structure

```text
+--------+       +--------------------------------+
| Client |------>| <<Protocol>> RatesService      |
+--------+       |--------------------------------|
                 | + get_rate(base, quote)        |
                 +--------------------------------+
                        ^                  ^
                        :                  :
  +-------------------------+   +--------------------------------+
  | RemoteRatesClient       |   | CachingRatesProxy              |
  | (service)               |   |--------------------------------|
  |-------------------------|<----o _service: RemoteRatesClient  |
  | + get_rate(base, quote) |   | - _cache: dict                 |
  +-------------------------+   |--------------------------------|
                                | + get_rate(base, quote):       |
                                |     lazy init / cache / checks |
                                |     _service.get_rate(...)     |
                                +--------------------------------+
```

1. **Service interface** declares what the service can do. The proxy must follow it to be able to pose as the service.
2. **Service** contains the real business logic.
3. **Proxy** holds a reference to the service. It performs its own task (lazy initialization, caching, access control, logging) and passes the request on. Proxies often manage the whole lifecycle of their service.
4. **Client** works with both the service and the proxy through the same interface.

### Python implementation

```python
from typing import Protocol


class RatesService(Protocol):
    def get_rate(self, base: str, quote: str) -> float: ...


class RemoteRatesClient:
    """Third-party client: slow and expensive, and we cannot change its code."""

    def __init__(self) -> None:
        print("RemoteRatesClient: opening a connection to the API...")
        self.requests = 0

    def get_rate(self, base: str, quote: str) -> float:
        self.requests += 1
        print(f"RemoteRatesClient: HTTP request #{self.requests} for {base}/{quote}")
        return {("USD", "UAH"): 41.5, ("EUR", "UAH"): 48.2}[(base, quote)]


class CachingRatesProxy:
    """Same interface as the real client; adds lazy creation and caching."""

    def __init__(self) -> None:
        self._service: RemoteRatesClient | None = None
        self._cache: dict[tuple[str, str], float] = {}

    def _get_service(self) -> RemoteRatesClient:
        if self._service is None:  # virtual proxy: create on first real use
            self._service = RemoteRatesClient()
        return self._service

    def get_rate(self, base: str, quote: str) -> float:
        key = (base, quote)
        if key not in self._cache:  # caching proxy
            self._cache[key] = self._get_service().get_rate(base, quote)
        return self._cache[key]


def show_prices(rates: RatesService, prices_usd: list[float]) -> None:
    """Client code: works with anything that has get_rate()."""
    for price in prices_usd:
        print(f"  {price:>5} USD = {price * rates.get_rate('USD', 'UAH'):8.2f} UAH")


rates = CachingRatesProxy()
print("proxy created, no connection yet")
show_prices(rates, [10, 25, 99.9])
print("EUR/UAH:", rates.get_rate("EUR", "UAH"))
print("EUR/UAH:", rates.get_rate("EUR", "UAH"))
```

Output:

```text
proxy created, no connection yet
RemoteRatesClient: opening a connection to the API...
RemoteRatesClient: HTTP request #1 for USD/UAH
     10 USD =   415.00 UAH
     25 USD =  1037.50 UAH
   99.9 USD =  4145.85 UAH
RemoteRatesClient: HTTP request #2 for EUR/UAH
EUR/UAH: 48.2
EUR/UAH: 48.2
```

The proxy combines two classic roles. As a **virtual proxy** it postpones creating the expensive client until the first real request. As a **caching proxy** it answers repeated requests itself: three prices cost one HTTP request. `show_prices()` was written for the real client and works unchanged.

> **Note:** A real caching proxy also needs an **expiry policy**: exchange rates change, and a cache that never forgets serves stale data. Store a timestamp with each value, or use a time-aware cache.

### Plan B: a proxy as a subclass of the service

Sometimes there is no interface to extract: old client code checks the concrete class with `isinstance()`, and changing all of it is not an option. Then the proxy can **inherit** from the service class. It gets the whole interface for free, passes `isinstance()` checks, and calls the real implementation through `super()` instead of through a stored reference:

```python
# Continues the previous example
class CachedRatesClient(RemoteRatesClient):
    """Plan B: the proxy IS a RemoteRatesClient and inherits its interface."""

    def __init__(self) -> None:
        super().__init__()  # the connection opens right away: no lazy creation
        self._cache: dict[tuple[str, str], float] = {}

    def get_rate(self, base: str, quote: str) -> float:
        key = (base, quote)
        if key not in self._cache:
            self._cache[key] = super().get_rate(base, quote)
        return self._cache[key]


def legacy_report(client: RemoteRatesClient) -> None:
    """Old code that insists on the concrete class."""
    if not isinstance(client, RemoteRatesClient):
        raise TypeError("RemoteRatesClient required")
    show_prices(client, [10, 25])


try:
    legacy_report(CachingRatesProxy())
except TypeError as exc:
    print("TypeError:", exc)

legacy_report(CachedRatesClient())
```

Output:

```text
TypeError: RemoteRatesClient required
RemoteRatesClient: opening a connection to the API...
RemoteRatesClient: HTTP request #1 for USD/UAH
     10 USD =   415.00 UAH
     25 USD =  1037.50 UAH
```

The price of this shortcut: the proxy is now tied to one concrete class, it cannot wrap an object that already exists, and the expensive `__init__` of the service runs immediately, so a subclass proxy cannot be a lazy (virtual) proxy. Prefer composition when you can.

### Practical example: a protection proxy with `__getattr__`

Writing a forwarding method for every method of the service is tedious. Python's `__getattr__` is called only when normal attribute lookup fails, so a proxy can define the methods it wants to control and forward **everything else** automatically:

```python
from typing import Any


class BankAccount:
    def __init__(self, owner: str, balance: float) -> None:
        self.owner = owner
        self.balance = balance

    def deposit(self, amount: float) -> None:
        self.balance += amount

    def withdraw(self, amount: float) -> None:
        if amount > self.balance:
            raise ValueError("insufficient funds")
        self.balance -= amount


class ProtectedAccount:
    """Protection + logging proxy that forwards everything else automatically."""

    OWNER_ONLY = {"withdraw"}

    def __init__(self, account: BankAccount, user: str) -> None:
        self._account = account
        self._user = user

    def __getattr__(self, name: str) -> Any:
        # Called only for attributes NOT found on the proxy itself
        attr = getattr(self._account, name)
        if name in self.OWNER_ONLY and self._user != self._account.owner:
            raise PermissionError(f"{self._user} may not call {name}()")
        if callable(attr):
            def logged(*args: Any, **kwargs: Any) -> Any:
                print(f"[audit] {self._user} -> {name}{args}")
                return attr(*args, **kwargs)
            return logged
        return attr


account = BankAccount(owner="olena", balance=1000)
as_owner = ProtectedAccount(account, user="olena")
as_cashier = ProtectedAccount(account, user="cashier")

as_cashier.deposit(250)
as_owner.withdraw(400)
try:
    as_cashier.withdraw(100)
except PermissionError as exc:
    print("denied:", exc)
print("balance seen through the proxy:", as_cashier.balance)
```

Output:

```text
[audit] cashier -> deposit(250,)
[audit] olena -> withdraw(400,)
denied: cashier may not call withdraw()
balance seen through the proxy: 850
```

This **protection proxy** checks who calls what, and it also logs calls. The `BankAccount` class knows nothing about users or audit logs. Generic forwarding is convenient, but it has limits: implicit special-method calls such as `len(x)` or `x + y` bypass `__getattr__`, and `isinstance(as_owner, BankAccount)` is `False`. See "Common mistakes".

### Proxies in the standard library

```python
from functools import lru_cache
from types import MappingProxyType

# 1. A read-only protection proxy over a dict
settings = {"debug": False}
public_settings = MappingProxyType(settings)
print(public_settings["debug"])
try:
    public_settings["debug"] = True
except TypeError as exc:
    print("TypeError:", exc)
settings["debug"] = True          # the owner changes the real dict...
print(public_settings["debug"])   # ...and the proxy shows the live value


# 2. A caching proxy for a function
@lru_cache(maxsize=128)
def slow_square(n: int) -> int:
    print(f"computing {n}**2")
    return n * n


print(slow_square(12), slow_square(12))
print(slow_square.cache_info())
```

Output:

```text
False
TypeError: 'mappingproxy' object does not support item assignment
True
computing 12**2
144 144
CacheInfo(hits=1, misses=1, maxsize=128, currsize=1)
```

`types.MappingProxyType` is exactly what its name says: a protection proxy that gives read-only access to a dict the owner can still change. Python itself uses it for class `__dict__`. `functools.lru_cache` wraps a function in a caching proxy. Also worth knowing: `weakref.proxy()` (a proxy that does not keep its target alive) and `multiprocessing.managers` (remote proxies to objects in another process).

### Kinds of proxies

| Kind | What it does | Example |
|---|---|---|
| Virtual proxy | Creates a heavy object only when it is first needed | `CachingRatesProxy._get_service()`, lazy images |
| Caching proxy | Remembers results of repeated requests | `functools.lru_cache`, an HTTP cache |
| Protection proxy | Checks permissions before forwarding | `ProtectedAccount`, `MappingProxyType` |
| Remote proxy | Represents an object that lives in another process or machine | RPC clients, `multiprocessing` managers |
| Logging proxy | Records every request to the service | the audit part of `ProtectedAccount` |
| Smart reference | Tracks who uses the service and frees it when nobody does | reference-counted connections, `weakref.proxy` |

> **Tip:** How to recognize a proxy in existing code: it has the same methods as some other object, and each of them, after some extra work (or a decision not to), ends up calling the same method on that object, or on `super()` if the proxy is a subclass of the service.

### When to use Proxy

- **Lazy initialization:** a heavyweight object is needed only sometimes, and creating it at startup wastes resources.
- **Access control:** only certain clients may use the service or some of its methods.
- **Remote service:** the real object lives on another server, and the proxy hides the network details.
- **Logging or auditing** of requests to the service.
- **Caching** of results for repeated requests, especially large or expensive ones.
- **Lifecycle management:** release the service when no client uses it anymore.

### How to implement Proxy

1. If there is no service interface, describe one (a `Protocol` works without touching the service class). If that is impossible, make the proxy a subclass of the service so that it inherits the interface (see "Plan B" above).
2. Create the proxy class with a field that refers to the service. Usually the proxy creates the service itself and manages its lifecycle; sometimes the client passes the service in.
3. Implement the proxy methods: do the proxy's own work, then delegate to the service.
4. Consider a factory function that decides whether the client gets a proxy or the real service (for example, based on configuration).
5. Consider lazy initialization of the service.

### Pros and cons of Proxy

**Pros:**

- You control the service without clients knowing about it.
- You can manage the lifecycle of the service even when clients do not care about it.
- The proxy works even when the service is not ready yet or temporarily unavailable (it can answer from a cache).
- *Open/Closed Principle*: new proxies can be added without changing the service or the clients.

**Cons:**

- More classes and an extra level of indirection.
- The response may be delayed (the first request through a lazy proxy, permission checks).
- A transparent proxy can hide important behavior: stale caches or swallowed calls are hard to notice.

### Relations with other patterns

- **Adapter, Proxy, Decorator.** An Adapter gives an object a *different* interface. A Proxy keeps *the same* interface. A Decorator keeps the same or provides an *extended* interface.
- **Facade vs Proxy.** Both stand in front of a complex entity and may initialize it themselves. A Facade offers a new, simpler interface, while a Proxy has the same interface as its service, which makes them interchangeable.
- **Decorator vs Proxy.** Same structure, different intent: see the section "Proxy vs Decorator" below.

## Decorator

### Intent

**Decorator** (also known as **Wrapper**) attaches new behavior to an object by placing it inside a wrapper object that has the same interface. Wrappers can wrap other wrappers, so behaviors are combined by stacking them, at runtime.

### Problem

You store user settings through a `DataSource` with `write()` and `read()`. Different deployments want different extras:

- compress the data to save space;
- encode it as Base64 so it can live in a text-only place (JSON, environment variables);
- log every write in debug builds;
- encrypt it in production.

The inheritance approach starts innocently with `CompressedDataSource` and `Base64DataSource`. Then someone needs both, so `CompressedBase64DataSource` appears. Add logging and encryption, and every combination needs its own class: with four independent features that is up to 15 subclasses, and the order of the features matters too. This is called a **combinatorial explosion** of subclasses. Besides, inheritance is static: you cannot add compression to an existing object at runtime, only create a different object of a different class.

Python's multiple inheritance softens the pain but does not cure it. With mixins, `class CompressedBase64Source(CompressionMixin, Base64Mixin, FileDataSource)` is a one-liner, yet every combination (and every order) must still be declared as a class in advance, before the program knows what the configuration will ask for.

### Solution

Use **composition** instead of inheritance. A *wrapper* holds a reference to another object with the same interface, forwards requests to it, and adds its own behavior before or after forwarding. Because the wrapper also follows that interface, it can wrap not only the basic object but other wrappers too.

Keep the basic behavior (storing bytes) in a simple **concrete component**, and turn every optional feature into a **decorator**. The client builds exactly the combination it needs:

```text
CompressionDecorator( Base64Decorator( MemoryDataSource() ) )
```

The outermost decorator is what the client works with. Since all layers share the interface, the rest of the code does not care whether it talks to a plain data source or to a stack of five decorators.

### Real-world analogy

Think of a smartphone. You put it in a protective case, add a screen protector, and maybe stick a card holder on the back. Each layer adds something (protection from falls, from scratches, a place for cards) while the phone keeps working the same way: you still make calls and tap the screen. The layers are not part of the phone, and you can add or remove any of them whenever you like.

### Structure

```text
                +------------------------------+
  Client ------>| <<Protocol>> DataSource      |<--------------+
                |------------------------------|               |
                | + write(data)                |               | wraps any
                | + read() -> bytes            |               | DataSource
                +------------------------------+               |
                      ^                   ^                    |
                      :                   :                    |
  +----------------------+   +--------------------------------+|
  | MemoryDataSource     |   | DataSourceDecorator            ||
  | (concrete component) |   |--------------------------------||
  |----------------------|   | - _wrappee: DataSource  o-------+
  | + write(data)        |   | + write(data) -> _wrappee      |
  | + read()             |   | + read()      -> _wrappee      |
  +----------------------+   +--------------------------------+
                                  ^                    ^
                                  |                    |
                  +----------------------+   +-------------------+
                  | CompressionDecorator |   | Base64Decorator   |
                  | + write / read       |   | + write / read    |
                  +----------------------+   +-------------------+
```

1. **Component** declares the common interface for wrappers and wrapped objects.
2. **Concrete component** defines the basic behavior that decorators can change.
3. **Base decorator** stores a reference to a wrapped object, typed as the component interface, so it can hold both concrete components and other decorators. By default it delegates every operation to the wrapped object.
4. **Concrete decorators** add behavior before or after calling the base decorator's method (which forwards to the wrapped object).
5. **Client** wraps components in as many layers as needed, working with all of them through the component interface.

### Python implementation

```python
import base64
import zlib
from typing import Protocol


class DataSource(Protocol):
    def write(self, data: bytes) -> None: ...
    def read(self) -> bytes: ...


class MemoryDataSource:
    """Concrete component: stores bytes as they are (a file or DB in real life)."""

    def __init__(self) -> None:
        self.stored = b""

    def write(self, data: bytes) -> None:
        self.stored = data

    def read(self) -> bytes:
        return self.stored


class DataSourceDecorator:
    """Base decorator: same interface, delegates everything to the wrappee."""

    def __init__(self, wrappee: DataSource) -> None:
        self._wrappee = wrappee

    def write(self, data: bytes) -> None:
        self._wrappee.write(data)

    def read(self) -> bytes:
        return self._wrappee.read()


class CompressionDecorator(DataSourceDecorator):
    def write(self, data: bytes) -> None:
        super().write(zlib.compress(data))

    def read(self) -> bytes:
        return zlib.decompress(super().read())


class Base64Decorator(DataSourceDecorator):
    """Makes binary data safe for text-only storage (JSON, e-mail, env vars)."""

    def write(self, data: bytes) -> None:
        super().write(base64.b64encode(data))

    def read(self) -> bytes:
        return base64.b64decode(super().read())


payload = b"salary;" * 20  # 140 very repetitive bytes


def store(label: str, source: DataSource, disk: MemoryDataSource) -> None:
    source.write(payload)
    print(f"{label:<26} {len(disk.stored):>3} bytes, "
          f"text-safe={disk.stored.isascii()}, round-trip={source.read() == payload}")


disk = MemoryDataSource()
store("disk", disk, disk)

disk = MemoryDataSource()
store("Compression(Base64(disk))", CompressionDecorator(Base64Decorator(disk)), disk)
print("  stored:", disk.stored.decode())

disk = MemoryDataSource()
store("Base64(Compression(disk))", Base64Decorator(CompressionDecorator(disk)), disk)
```

Output:

```text
disk                       140 bytes, text-safe=True, round-trip=True
Compression(Base64(disk))   24 bytes, text-safe=True, round-trip=True
  stored: eJwrTsxJLKq0Lh4MFABWYzeN
Base64(Compression(disk))   41 bytes, text-safe=False, round-trip=True
```

How a write travels through `CompressionDecorator(Base64Decorator(disk))`: the outer decorator compresses the data and passes it inward, the Base64 decorator encodes the compressed bytes, and the disk stores ASCII text. Reading goes the opposite way: decode, then decompress.

The last line shows that **order matters**. With the layers swapped, Base64 runs first and compression second, so the disk receives compressed binary data. The round trip still works, but the stored value is no longer text-safe and is almost twice as large. The decorators are independent, but their combination is a design decision the client must make consciously.

In a real application the stack is usually assembled in one place, from configuration, and the code that uses the data source never learns what is inside. Note the order of the `if` statements: the layer that must be **closest to the storage** is wrapped **first**, and the outermost layer is the one that transforms the data first on `write()`:

```python
# Continues the previous example
class SettingsStore:
    """Client code: knows nothing about compression or encoding."""

    def __init__(self, source: DataSource) -> None:
        self._source = source

    def save(self, text: str) -> None:
        self._source.write(text.encode("utf-8"))

    def load(self) -> str:
        return self._source.read().decode("utf-8")


def build_source(disk: DataSource, *, compress: bool, text_safe: bool) -> DataSource:
    """Assemble the stack from configuration, starting with the innermost layer."""
    source = disk
    if text_safe:
        source = Base64Decorator(source)       # must sit right above the storage
    if compress:
        source = CompressionDecorator(source)  # outermost: runs first on write
    return source


for config in ({"compress": False, "text_safe": False},
               {"compress": True, "text_safe": True}):
    disk = MemoryDataSource()
    settings = SettingsStore(build_source(disk, **config))
    settings.save("theme=dark;lang=uk;" * 3)
    print(config)
    print("  stored:", disk.stored)
    print("  loaded:", settings.load())
```

Output:

```text
{'compress': False, 'text_safe': False}
  stored: b'theme=dark;lang=uk;theme=dark;lang=uk;theme=dark;lang=uk;'
  loaded: theme=dark;lang=uk;theme=dark;lang=uk;theme=dark;lang=uk;
{'compress': True, 'text_safe': True}
  stored: b'eJwryUjNTbVNSSzKts5JzEu3Lc22LiFKCAB0dxV2'
  loaded: theme=dark;lang=uk;theme=dark;lang=uk;theme=dark;lang=uk;
```

`SettingsStore` is written once and works with a bare storage or with any stack of decorators, because all of them follow the `DataSource` interface.

> **Tip:** How to recognize a decorator in existing code: its constructor accepts an object of the same interface that the class itself implements. `CompressionDecorator(wrappee: DataSource)` is itself a `DataSource`, and `io.TextIOWrapper(buffer)` is itself a stream.

### Practical example: retry and logging layers

Network code is a classic place for decorators: retries, logging, timing, rate limiting and caching are all independent concerns that you want to combine differently in production, in tests and in debugging:

```python
from typing import Protocol


class Fetcher(Protocol):
    def fetch(self, url: str) -> str: ...


class FlakyFetcher:
    """Concrete component: a 'network' that fails a given number of times."""

    def __init__(self, failures: int) -> None:
        self.failures_left = failures

    def fetch(self, url: str) -> str:
        if self.failures_left > 0:
            self.failures_left -= 1
            raise ConnectionError("network glitch")
        return f"<html>{url}</html>"


class FetcherDecorator:
    def __init__(self, inner: Fetcher) -> None:
        self._inner = inner

    def fetch(self, url: str) -> str:
        return self._inner.fetch(url)


class Retry(FetcherDecorator):
    def __init__(self, inner: Fetcher, attempts: int = 3) -> None:
        super().__init__(inner)
        self.attempts = attempts

    def fetch(self, url: str) -> str:
        for attempt in range(1, self.attempts + 1):
            try:
                return super().fetch(url)
            except ConnectionError as exc:
                print(f"  Retry: attempt {attempt} failed ({exc})")
        raise ConnectionError(f"gave up after {self.attempts} attempts")


class Logging(FetcherDecorator):
    def fetch(self, url: str) -> str:
        print(f"  Logging: GET {url}")
        try:
            result = super().fetch(url)
        except ConnectionError:
            print("  Logging: failed")
            raise
        print(f"  Logging: got {len(result)} chars")
        return result


print("Logging(Retry(...)): one log entry for the whole operation")
Logging(Retry(FlakyFetcher(failures=2))).fetch("/news")

print("Retry(Logging(...)): every attempt is logged")
Retry(Logging(FlakyFetcher(failures=2))).fetch("/news")
```

Output:

```text
Logging(Retry(...)): one log entry for the whole operation
  Logging: GET /news
  Retry: attempt 1 failed (network glitch)
  Retry: attempt 2 failed (network glitch)
  Logging: got 18 chars
Retry(Logging(...)): every attempt is logged
  Logging: GET /news
  Logging: failed
  Retry: attempt 1 failed (network glitch)
  Logging: GET /news
  Logging: failed
  Retry: attempt 2 failed (network glitch)
  Logging: GET /news
  Logging: got 18 chars
```

The same two decorators give two different behaviors depending on the order. Outer logging describes the operation as the caller sees it. Inner logging records every network attempt. Neither `Retry` nor `Logging` knows about the other, and `FlakyFetcher` knows about neither.

### Decorator in the standard library: I/O streams

Python's I/O system is a decorator stack. `io.TextIOWrapper` turns text into bytes, `gzip.GzipFile` compresses bytes, and both accept another file-like object to wrap:

```python
import gzip
import io

buffer = io.BytesIO()  # the concrete component: raw bytes in memory

# TextIOWrapper(str -> bytes) wraps GzipFile(compression) wraps BytesIO
with io.TextIOWrapper(gzip.GzipFile(fileobj=buffer, mode="wb"), encoding="utf-8") as f:
    f.write("Привіт, PyJourney!\n" * 50)

print("compressed size:", len(buffer.getvalue()), "bytes")

buffer.seek(0)
with io.TextIOWrapper(gzip.GzipFile(fileobj=buffer, mode="rb"), encoding="utf-8") as f:
    lines = f.readlines()
print(len(lines), "lines, first:", lines[0].strip())
```

Output:

```text
compressed size: 64 bytes
50 lines, first: Привіт, PyJourney!
```

Every layer is a file-like object, so the code that writes lines does not know whether it writes to a plain file, to memory, or through compression. `open()` itself returns such a stack: a `TextIOWrapper` around a `BufferedReader` around a `FileIO`.

### When to use Decorator

- You need to add behavior to individual objects at runtime without breaking the code that uses them.
- The behaviors are independent layers that must be combined in different ways.
- Extending through inheritance is impractical (too many combinations) or impossible (the class is closed for modification or comes from a library).

### How to implement Decorator

1. Make sure the domain can be seen as a basic component with optional layers on top of it.
2. Identify the methods common to the component and the layers, and declare them in a component interface (`Protocol` or ABC).
3. Create the concrete component with the basic behavior.
4. Create a base decorator that stores the wrapped object (typed as the interface) and forwards every method to it.
5. Create concrete decorators that extend the base decorator and add behavior before or after calling `super()`.
6. Let the client assemble the stack. A small factory function can build typical stacks from configuration.

### Pros and cons of Decorator

**Pros:**

- Behavior can be extended without new subclasses.
- Responsibilities can be added to or removed from an object at runtime.
- Several behaviors are combined by wrapping an object in several decorators.
- *Single Responsibility Principle*: a monolithic class with many variants of behavior splits into small focused classes.

**Cons:**

- Removing a specific wrapper from the middle of a stack is awkward.
- Behavior can depend on the order of decorators, and writing order-independent decorators is hard.
- The code that builds the stack (`A(B(C(D(x))))`) can be hard to read.
- Many small objects with the same interface make debugging and stack traces longer.

### Relations with other patterns

- **Adapter vs Decorator.** An Adapter changes the interface of an object. A Decorator keeps or extends it, and supports recursive composition, which an Adapter does not.
- **Chain of Responsibility vs Decorator.** Both pass a request through a chain of objects. Chain of Responsibility handlers may stop the request at any point and act independently. Decorators extend the behavior while keeping it consistent with the interface, and they always pass the request on.
- **Composite vs Decorator.** Both rely on recursive composition. A Decorator has exactly one child and adds responsibilities. A Composite has many children and aggregates their results. A decorator can wrap a single node of a composite tree.
- **Prototype** helps when you need to clone complex stacks of decorators instead of building them again.
- **Strategy vs Decorator.** A Decorator changes the "skin" of an object. A Strategy changes its "guts".

## The Decorator pattern vs Python's `@decorator` syntax

The words are the same, the ideas overlap, but they are not identical.

**What `@decorator` actually is.** It is syntax that applies a callable to a function or class right after it is defined (the Decorators section, starting with the topic Python Decorators, covers it in depth):

```text
@retry(attempts=3)              is exactly the same as      def fetch(url): ...
def fetch(url): ...                                         fetch = retry(attempts=3)(fetch)
```

Whatever the decorator returns replaces the original name. Here is a function decorator that adds retries:

```python
import functools


def retry(attempts: int):
    def decorator(func):
        @functools.wraps(func)  # keep the name, docstring and __wrapped__
        def wrapper(*args, **kwargs):
            for attempt in range(1, attempts + 1):
                try:
                    return func(*args, **kwargs)
                except ConnectionError as exc:
                    print(f"  attempt {attempt} failed ({exc})")
            raise ConnectionError(f"gave up after {attempts} attempts")
        return wrapper
    return decorator


failures = iter([True, True, False])


@retry(attempts=3)          # the same as: fetch = retry(attempts=3)(fetch)
def fetch(url: str) -> str:
    """Download a page."""
    if next(failures):
        raise ConnectionError("network glitch")
    return f"<html>{url}</html>"


print(fetch("/news"))
print(fetch.__name__, "|", fetch.__doc__)
print(fetch.__wrapped__.__name__, fetch.__wrapped__ is fetch)
```

Output:

```text
  attempt 1 failed (network glitch)
  attempt 2 failed (network glitch)
<html>/news</html>
fetch | Download a page.
fetch False
```

**How they relate.** A function decorator like `retry` *is* the Decorator pattern applied to a single callable. The "interface" is the call signature: `wrapper` accepts the same arguments and returns the same kind of result, it delegates to the wrapped function, it adds behavior around the call, and decorators can be stacked. `functools.wraps` is the finishing touch that makes the wrapper look like the original (same `__name__`, `__doc__`, plus a `__wrapped__` link to it).

**How they differ.**

| | Decorator pattern | `@decorator` syntax |
|---|---|---|
| What is wrapped | An object with an interface, often several methods | A function, a method or a class |
| When | At runtime, whenever the client decides, per object | Usually once, when the `def`/`class` statement runs; it affects every call |
| Who composes | The client code that builds the object | The author of the function |
| Mechanism | A wrapper class that holds a reference | Any callable that takes a function or class and returns something |
| Keeps the interface? | Always, by definition | Not necessarily |

The last row is important: many things written with `@` are not the Decorator pattern at all.

- `@functools.lru_cache` wraps a function and keeps its interface, but its purpose is caching, so it is closer to a **caching proxy**.
- `@dataclass` does not wrap anything. It adds methods to the class and returns **the same class**: this is metaprogramming.
- `@app.route("/")` in Flask registers the function in a routing table and returns it unchanged: a **registry**.
- `@property` and `@classmethod` turn a function into a **descriptor**.

And the other way round, you can apply the pattern without the `@` syntax. A function decorator is an ordinary callable, so you can decorate **one object at runtime**, which is what the pattern is about:

```python
import functools


def log_calls(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        print(f"-> {func.__name__}{args}")
        return func(*args, **kwargs)
    return wrapper


class Calculator:
    def add(self, a: int, b: int) -> int:
        return a + b


calc = Calculator()
calc.add = log_calls(calc.add)   # decorate ONE object at runtime, no @ needed
print(calc.add(2, 3))
print(Calculator().add(2, 3))    # other instances are unaffected
```

Output:

```text
-> add(2, 3)
5
5
```

**Rule of thumb:** use a function decorator (`@`) when a behavior should apply to *every* call of a function, decided by its author. Use the Decorator pattern (wrapper classes) when the *client* must assemble behaviors per object at runtime, or when the interface has several methods that must all be wrapped consistently.

## Proxy vs Decorator

The two patterns can have literally the same code: a class that holds a reference to an object with the same interface and forwards calls. The difference is the **intent** and **who is in charge**.

| Question | Proxy | Decorator |
|---|---|---|
| Purpose | Control access to the service | Add responsibilities to an object |
| Who creates the wrapped object? | Often the proxy itself (lazily) or setup code hidden from the client | Always the client, which composes the stack |
| Does the client know about the wrapper? | Usually not: the proxy is transparent | Yes: the client builds it deliberately |
| How many layers? | Usually one | Several by design: stacking is the point |
| Interface | Exactly the same as the service | The same, sometimes extended |
| Typical tasks | Lazy loading, caching, permissions, remote access, smart references | Compression, encryption, formatting, retries, metrics in any combination |

How to decide:

- If the wrapper exists to **guard or manage** the real object (whether it is created, who may call it, whether a call is needed at all), it is a Proxy.
- If the wrapper exists to **add a feature** that the client may combine with other features, it is a Decorator.
- A caching wrapper can be either. If the application quietly hands every client a cached service, it is a caching proxy. If the client deliberately builds `Logging(Cache(Retry(fetcher)))`, the cache is one decorator among others.

## Common mistakes

- **Expecting `__getattr__` to forward special methods.** Python looks up special methods such as `__len__`, `__iter__` and `__add__` on the **type**, not on the instance, so implicit calls (`len(x)`, `for`, `+`) skip `__getattr__`:

  ```python
  class ListProxy:
      def __init__(self, target: list) -> None:
          self._target = target

      def __getattr__(self, name: str):
          return getattr(self._target, name)


  proxy = ListProxy([1, 2, 2, 3])
  print(proxy.count(2))            # normal methods are forwarded
  print(proxy.__len__())           # explicit attribute lookup works too
  try:
      print(len(proxy))            # but len() looks up __len__ on the TYPE
  except TypeError as exc:
      print("TypeError:", exc)
  ```

  Output:

  ```text
  2
  4
  TypeError: object of type 'ListProxy' has no len()
  ```

  Define the special methods you need explicitly on the proxy class (`def __len__(self): return len(self._target)`).

- **Infinite recursion in `__getattr__`.** When an object is created without `__init__` (by `copy`, `pickle`), `self._target` does not exist yet, so reading it calls `__getattr__` again, and again:

  ```python
  import copy


  class Proxy:
      def __init__(self, target: object) -> None:
          self._target = target

      def __getattr__(self, name: str):
          return getattr(self._target, name)  # BUG: self._target may not exist yet


  try:
      copy.copy(Proxy([1, 2]))
  except RecursionError:
      print("RecursionError")


  class SafeProxy(Proxy):
      def __getattr__(self, name: str):
          if name.startswith("__") or name == "_target":
              raise AttributeError(name)  # do not forward special/internal lookups
          return getattr(self._target, name)


  clone = copy.copy(SafeProxy([1, 2]))
  print(clone.count(1))
  ```

  Output:

  ```text
  RecursionError
  1
  ```

- **Client code that checks concrete classes.** `isinstance(source, MemoryDataSource)` is `False` for a decorated or proxied object. Depend on the interface (`Protocol`, duck typing), not on the concrete class.
- **A base decorator that forgets a method.** If `DataSourceDecorator` forwarded only `write()`, every decorated object would lose `read()`. The base decorator must forward the **whole** interface.
- **Forgetting `functools.wraps`.** Without it the wrapper is called `wrapper`, has no docstring, and tools that rely on `__name__`, `__doc__` or `__wrapped__` (logging, documentation, `inspect.signature`) see the wrong function.
- **Ignoring the order of decorators.** `Compression(Base64(x))` and `Base64(Compression(x))` store different data. Document the intended order, or build stacks in one factory function.
- **A proxy that silently changes semantics.** A cache without expiry returns stale data, and a lazy proxy may raise a connection error at a surprising moment. Make such behavior explicit in names and documentation.

## Summary

- A proxy has the same interface as its service and controls access to it: lazy creation, caching, permissions, remote calls, logging.
- When no interface can be extracted, a proxy can subclass the service, at the cost of laziness and of the freedom to wrap existing objects.
- `__getattr__` makes generic forwarding easy, but special methods bypass it, and careless use can recurse forever.
- A decorator wraps an object with the same interface to add a responsibility. Decorators stack, and the client chooses the combination at runtime.
- The order of decorators is part of the behavior.
- The standard library is full of both: `MappingProxyType`, `lru_cache` and `weakref.proxy` are proxies, and the `io`/`gzip` streams form decorator stacks.
- Python's `@decorator` syntax means "replace this function with the result of calling the decorator on it". A wrapping function decorator is the Decorator pattern applied to one callable, but many `@` decorators (`@dataclass`, `@property`, route registration) are not the pattern at all.
- Proxy and Decorator may share code. Proxy is about **control** and is usually invisible to the client. Decorator is about **adding features** and is composed by the client.

## Practice

### Exercise 1: Lazy images

A `RealImage` loads its file from disk in the constructor, which is slow. A gallery creates many images, but the user looks at only a few. Write a virtual proxy `LazyImage` with the same interface (`filename` attribute and `display() -> str`) that creates the `RealImage` only on the first `display()` call and reuses it afterwards. Create a gallery of three lazy images and display one of them twice.

### Exercise 2: Text formatting decorators

Create a component `PlainText(content)` with `render() -> str`, a base `TextDecorator`, and three decorators: `Bold` (wraps the text in `**`), `Italic` (wraps it in `*`) and `Stripped` (removes surrounding whitespace). Render `"  design patterns  "` with several combinations and show that `Bold(Stripped(x))` and `Stripped(Bold(x))` give different results.

### Exercise 3: A call-counting decorator

Write a function decorator `count_calls` that counts calls in an attribute `calls` of the wrapper and preserves the wrapped function's name and docstring. Apply it with `@` to a function `greet(name)`. Then, **without** changing the `Repository` class, apply it at runtime to the `find` method of one `Repository` instance, call it three times, and show that the class itself was not modified.

## Solutions

### Exercise 1

```python
from typing import Protocol


class Image(Protocol):
    filename: str

    def display(self) -> str: ...


class RealImage:
    def __init__(self, filename: str) -> None:
        self.filename = filename
        print(f"loading {filename} from disk...")  # expensive

    def display(self) -> str:
        return f"[pixels of {self.filename}]"


class LazyImage:
    """Virtual proxy: cheap to create, loads the real image on first display()."""

    def __init__(self, filename: str) -> None:
        self.filename = filename
        self._real: RealImage | None = None

    def display(self) -> str:
        if self._real is None:
            self._real = RealImage(self.filename)
        return self._real.display()


gallery: list[Image] = [LazyImage(f"photo{i}.jpg") for i in range(1, 4)]
print("gallery ready:", [image.filename for image in gallery])
print(gallery[1].display())
print(gallery[1].display())   # already loaded
```

Output:

```text
gallery ready: ['photo1.jpg', 'photo2.jpg', 'photo3.jpg']
loading photo2.jpg from disk...
[pixels of photo2.jpg]
[pixels of photo2.jpg]
```

Only the image that was actually displayed was loaded, and only once. The gallery code is typed against the `Image` protocol and would accept a `RealImage` just as well.

### Exercise 2

```python
from typing import Protocol


class Text(Protocol):
    def render(self) -> str: ...


class PlainText:
    def __init__(self, content: str) -> None:
        self.content = content

    def render(self) -> str:
        return self.content


class TextDecorator:
    def __init__(self, inner: Text) -> None:
        self._inner = inner

    def render(self) -> str:
        return self._inner.render()


class Bold(TextDecorator):
    def render(self) -> str:
        return f"**{super().render()}**"


class Italic(TextDecorator):
    def render(self) -> str:
        return f"*{super().render()}*"


class Stripped(TextDecorator):
    def render(self) -> str:
        return super().render().strip()


raw = PlainText("  design patterns  ")
print(repr(Bold(raw).render()))
print(repr(Bold(Stripped(raw)).render()))
print(repr(Italic(Bold(Stripped(raw))).render()))
print(repr(Stripped(Bold(raw)).render()))   # order matters
```

Output:

```text
'**  design patterns  **'
'**design patterns**'
'***design patterns***'
'**  design patterns  **'
```

In `Stripped(Bold(raw))` the spaces are already *inside* the asterisks when `Stripped` runs, so there is nothing to strip at the edges. Three small classes give any combination without a single "BoldItalicStripped" subclass.

### Exercise 3

```python
import functools


def count_calls(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        wrapper.calls += 1
        return func(*args, **kwargs)
    wrapper.calls = 0
    return wrapper


@count_calls
def greet(name: str) -> str:
    """Return a greeting."""
    return f"Hello, {name}!"


print(greet("Olena"), greet("Max"))
print(greet.__name__, greet.__doc__, greet.calls)


class Repository:
    def find(self, key: int) -> str:
        return f"record {key}"


repo = Repository()
repo.find = count_calls(repo.find)   # runtime decoration of one object
for key in (1, 2, 3):
    repo.find(key)
print(repo.find.calls, hasattr(Repository.find, "calls"))
```

Output:

```text
Hello, Olena! Hello, Max!
greet Return a greeting. 2
3 False
```

With `@` the decoration happens once, when `greet` is defined, and applies to every call. The second part is the Decorator pattern in its purest form: one existing object gets extra behavior at runtime, while the `Repository` class and its other instances stay untouched (`hasattr(Repository.find, "calls")` is `False`).

---

*Sources: [Refactoring.Guru — Proxy](https://refactoring.guru/design-patterns/proxy), [Refactoring.Guru — Proxy in Python](https://refactoring.guru/design-patterns/proxy/python/example), [Refactoring.Guru — Decorator](https://refactoring.guru/design-patterns/decorator), [Refactoring.Guru — Decorator in Python](https://refactoring.guru/design-patterns/decorator/python/example). Adapted and expanded for PyJourney.*
