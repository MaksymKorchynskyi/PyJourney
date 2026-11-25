# Threading Lock

Threads share memory, which is what makes them convenient and also dangerous. When two threads update the same data at the same time, updates can silently get lost. This bug is called a **race condition**. A `threading.Lock` lets only one thread at a time into the code that touches shared data, which prevents it.

## What you'll learn

- What a race condition is and why read-modify-write code is vulnerable
- Why the GIL does not make your code thread-safe
- How to use `threading.Lock` with `acquire()`/`release()` and, better, with `with`
- How to build a thread-safe class
- What deadlocks are, why `Lock` is not reentrant, and when to use `RLock`
- Which other synchronization tools exist (`Semaphore`, `Event`, `queue.Queue`, ...)

## What is a race condition

A **race condition** happens when the result of a program depends on the timing of threads that access shared data without coordination, and at least one of them writes. The typical victim is a **read-modify-write** sequence:

1. read the current value;
2. compute a new value from it;
3. write the new value back.

If another thread changes the value between steps 1 and 3, the first thread overwrites that change with a value computed from stale data. One update is lost.

```text
counter = 0

thread t1                    thread t2
read counter    -> 0
                             read counter    -> 0
compute 0 + 10  -> 10
                             compute 0 + 20  -> 20
write counter = 10
                             write counter = 20     (t1's +10 is lost)

final value: 20, expected: 30
```

Whichever thread writes last "wins the race", and the result depends on luck.

## A race condition example

The `sleep(0.1)` below simulates some work between reading and writing. It widens the gap between the steps so the race happens every time:

```python
from threading import Thread
from time import sleep

counter = 0


def increase(by):
    global counter

    local_counter = counter  # 1. read
    local_counter += by      # 2. modify

    sleep(0.1)               # simulate some work: other threads run now

    counter = local_counter  # 3. write
    print(f"counter={counter}")


# create threads
t1 = Thread(target=increase, args=(10,))
t2 = Thread(target=increase, args=(20,))

# start the threads
t1.start()
t2.start()

# wait for the threads to complete
t1.join()
t2.join()

print(f"The final counter is {counter}")
```

Output (usually; if `t2` happens to write first, you get `counter=20`, `counter=10` and a final value of `10`):

```text
counter=10
counter=20
The final counter is 20
```

Both threads read `0` before either of them wrote. `t1` wrote `10`, then `t2` overwrote it with `20`. The correct total, `30`, never appears.

### "But `counter += 1` is one line"

One line of Python is not one indivisible step. `dis` shows that `counter += 1` is a read, an addition and a write:

```python
import dis

counter = 0


def increment():
    global counter
    counter += 1


dis.dis(increment)
```

Output (Python 3.14; other versions differ slightly):

```text
  6           RESUME                   0

  8           LOAD_GLOBAL              0 (counter)
              LOAD_SMALL_INT           1
              BINARY_OP               13 (+=)
              STORE_GLOBAL             0 (counter)
              LOAD_CONST               1 (None)
              RETURN_VALUE
```

A thread switch between `LOAD_GLOBAL` and `STORE_GLOBAL` loses an update.

### The GIL does not protect you

The GIL lets only one thread execute bytecode at a time, but it can pass from one thread to another **between** bytecode instructions, right in the middle of your read-modify-write. In current CPython the switch happens only at certain points (for example, function calls and loop iterations), so a race may stay hidden for a long time and then appear when the code or the Python version changes. The program below loses updates because a function call sits between the read and the write. `sys.setswitchinterval()` makes thread switches much more frequent so the bug shows up reliably:

```python
import sys
from threading import Thread

sys.setswitchinterval(1e-6)  # switch threads very often to expose the race

counter = 0


def plus_one(value):
    return value + 1


def increment_many(times):
    global counter
    for _ in range(times):
        counter = plus_one(counter)  # read, call a function, write


threads = [Thread(target=increment_many, args=(500_000,)) for _ in range(4)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"expected 2000000, got {counter}")
```

Output (the number varies from run to run):

```text
expected 2000000, got 1007692
```

About half of the increments were lost. With the default switch interval (5 ms) the same program is usually correct, and only occasionally wrong. That is the worst kind of bug: one that passes your tests. On the free-threaded build of CPython (no GIL), threads truly run in parallel and unprotected updates go wrong even more easily.

> **Note:** Single operations on built-in containers, such as `list.append()` or `dict[key] = value`, are thread-safe in CPython, both with the GIL and in free-threaded builds (an implementation detail rather than a language guarantee). Sequences of operations ("check, then act", "read, then write") are not. Protect those with a lock.

## Using a lock

A **lock** (also called a **mutex**, short for *mutual exclusion*) is a synchronization primitive that gives one thread exclusive access to a shared resource. It has two states:

- **unlocked**: the next thread that calls `acquire()` takes it and continues;
- **locked**: any other thread that calls `acquire()` **blocks** and waits until the owner calls `release()`.

The code between acquiring and releasing is called the **critical section**. Only one thread at a time can be inside it.

```python
from threading import Lock

lock = Lock()  # a new lock starts unlocked
```

### `acquire()` and `release()`

The basic API pairs `acquire()` with `release()`. Put `release()` in a `finally` block: if the critical section raises an exception and the lock is never released, every other thread waiting for it hangs forever.

```python
from threading import Lock, Thread
from time import sleep

counter = 0


def increase(by, lock):
    global counter

    lock.acquire()
    try:
        local_counter = counter
        local_counter += by

        sleep(0.1)

        counter = local_counter
        print(f"counter={counter}")
    finally:
        lock.release()  # runs even if the code above raises


lock = Lock()

# create threads
t1 = Thread(target=increase, args=(10, lock))
t2 = Thread(target=increase, args=(20, lock))

# start the threads
t1.start()
t2.start()

# wait for the threads to complete
t1.join()
t2.join()

print(f"The final counter is {counter}")
```

Output (the first line may be `counter=20` if `t2` gets the lock first; the final value is always 30):

```text
counter=10
counter=30
The final counter is 30
```

Both threads receive **the same** `Lock` object. That is essential: a lock protects data only if every thread that touches the data uses the same lock.

### The `with` statement (recommended)

A lock is a context manager. `with lock:` acquires it on entry and releases it on exit, even when an exception occurs. This is shorter and safer than calling `acquire()` and `release()` yourself:

```python
from threading import Lock, Thread
from time import perf_counter, sleep

counter = 0


def increase(by, lock):
    global counter

    with lock:
        local_counter = counter
        local_counter += by

        sleep(0.1)

        counter = local_counter
        print(f"counter={counter}")


lock = Lock()
start = perf_counter()

threads = [Thread(target=increase, args=(by, lock)) for by in (10, 20)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"The final counter is {counter}")
print(f"It took {perf_counter() - start:.1f} s")
```

Output (the order of the first two lines may vary, the final value is always 30):

```text
counter=10
counter=30
The final counter is 30
It took 0.2 s
```

Notice the price: the program now takes 0.2 seconds instead of 0.1, because the threads run the critical section **one after another**. Keep critical sections short. Do slow work (network calls, sleeping, heavy computation) **outside** the lock and lock only the actual update.

### More about `acquire()`

`acquire()` can also try without waiting, or wait for a limited time. It returns `True` if it got the lock:

```python
from threading import Lock

lock = Lock()
print("locked?", lock.locked())

print("acquired:", lock.acquire())
print("locked?", lock.locked())

# a second attempt does not wait: blocking=False returns False at once
print("acquired again (non-blocking):", lock.acquire(blocking=False))

# or waits at most 0.1 s
print("acquired again (timeout 0.1 s):", lock.acquire(timeout=0.1))

lock.release()
print("locked?", lock.locked())

try:
    lock.release()
except RuntimeError as exc:
    print("RuntimeError:", exc)
```

Output:

```text
locked? False
acquired: True
locked? True
acquired again (non-blocking): False
acquired again (timeout 0.1 s): False
locked? False
RuntimeError: release unlocked lock
```

When you use `blocking=False` or `timeout=`, always check the return value, and call `release()` only if you actually acquired the lock.

## A thread-safe `Counter` class

The cleanest design is to keep the lock **together with the data it protects**, inside a class. Callers cannot forget to lock, because they never touch the data directly:

```python
from threading import Lock, Thread
from time import sleep


class Counter:
    def __init__(self):
        self.value = 0
        self.lock = Lock()

    def increase(self, by):
        with self.lock:
            current_value = self.value
            current_value += by

            sleep(0.1)

            self.value = current_value
            print(f"counter={self.value}")


def main():
    counter = Counter()

    # create threads
    t1 = Thread(target=counter.increase, args=(10,))
    t2 = Thread(target=counter.increase, args=(20,))

    # start the threads
    t1.start()
    t2.start()

    # wait for the threads to complete
    t1.join()
    t2.join()

    print(f"The final counter is {counter.value}")


if __name__ == "__main__":
    main()
```

Output (the first line may be `counter=20`; the final value is always 30):

```text
counter=10
counter=30
The final counter is 30
```

`target=counter.increase` passes a **bound method**, so each thread calls `increase()` on the same `Counter` object and uses its single lock.

## Deadlocks

A **deadlock** is a situation where threads wait for each other forever. Locks make two kinds of deadlock possible.

### `Lock` is not reentrant: use `RLock` for nested locking

A plain `Lock` does not remember who owns it. If the thread that holds it calls `acquire()` again, it waits for itself forever. This happens easily when one locked method calls another locked method of the same object. `threading.RLock` (a *reentrant* lock) can be acquired several times by the thread that owns it. It is released when that thread has called `release()` the same number of times.

```python
import threading


class Inventory:
    def __init__(self, lock):
        self._lock = lock
        self._items = {}

    def add(self, name, qty):
        with self._lock:
            self._items[name] = self._items.get(name, 0) + qty

    def add_many(self, pairs):
        with self._lock:          # takes the lock ...
            for name, qty in pairs:
                self.add(name, qty)  # ... and add() takes it again

    def snapshot(self):
        with self._lock:
            return dict(self._items)


inv = Inventory(threading.RLock())
inv.add_many([("apple", 3), ("pear", 2)])
print(inv.snapshot())

# The same code with a plain Lock would block forever inside add().
# Here we only check that a plain Lock cannot be acquired twice:
plain = threading.Lock()
plain.acquire()
print("second acquire by the same thread:", plain.acquire(timeout=0.2))
plain.release()
```

Output:

```text
{'apple': 3, 'pear': 2}
second acquire by the same thread: False
```

### Taking several locks in different orders

If thread 1 holds lock A and waits for B, while thread 2 holds B and waits for A, neither can continue. The demo below uses a timeout so that it ends instead of hanging, and a `Barrier` so that both threads keep their first lock until both have tried:

```python
import threading
import time

lock_a = threading.Lock()
lock_b = threading.Lock()
both_tried = threading.Barrier(2)


def worker(name, first, second):
    with first:
        time.sleep(0.1)  # let the other thread take its first lock
        # a real program would wait here forever; we give up after 0.5 s
        got_both = second.acquire(timeout=0.5)
        if got_both:
            second.release()
        both_tried.wait()  # keep holding `first` until both threads have tried
    print(f"{name}: {'got both locks' if got_both else 'gave up, deadlock'}")


t1 = threading.Thread(target=worker, args=("t1", lock_a, lock_b))
t2 = threading.Thread(target=worker, args=("t2", lock_b, lock_a))  # opposite order!
t1.start()
t2.start()
t1.join()
t2.join()
```

Output (the order of the lines may vary):

```text
t2: gave up, deadlock
t1: gave up, deadlock
```

The standard cure is a **fixed lock order**: every thread that needs both locks takes them in the same order.

```python
import threading
import time

lock_a = threading.Lock()
lock_b = threading.Lock()


def worker(name):
    with lock_a:      # every thread takes lock_a first ...
        time.sleep(0.1)
        with lock_b:  # ... and lock_b second
            print(f"{name}: got both locks")


threads = [threading.Thread(target=worker, args=(name,)) for name in ("t1", "t2")]
for t in threads:
    t.start()
for t in threads:
    t.join()
```

Output:

```text
t1: got both locks
t2: got both locks
```

Even better: design the code so that a thread never needs more than one lock at a time.

## Other synchronization tools

The `threading` and `queue` modules offer more than `Lock`:

| Tool | Use it when |
|---|---|
| `RLock` | The same thread may need to acquire the lock again (nested calls) |
| `Semaphore(n)` / `BoundedSemaphore(n)` | At most *n* threads may use a resource at once (e.g. 3 connections) |
| `Event` | One thread signals "something happened" (e.g. "stop") to others |
| `Condition` | Threads wait until some state changes, with a lock attached |
| `Barrier(n)` | *n* threads must all reach a point before any continues |
| `queue.Queue` | Threads pass work or results to each other safely |

Often the best way to avoid locks is to **not share mutable state at all**. Let threads send data through a `queue.Queue`, which does all the locking internally:

```python
import queue
import threading

tasks = queue.Queue()
results = queue.Queue()


def worker():
    while True:
        n = tasks.get()
        if n is None:  # sentinel: no more work
            break
        results.put(n * n)


threads = [threading.Thread(target=worker) for _ in range(3)]
for t in threads:
    t.start()

for n in range(1, 6):
    tasks.put(n)
for _ in threads:
    tasks.put(None)  # one sentinel per worker

for t in threads:
    t.join()

print(sorted(results.get() for _ in range(results.qsize())))
```

Output:

```text
[1, 4, 9, 16, 25]
```

## Common mistakes

- **Creating the lock inside the function.** `lock = Lock()` inside the thread's function gives every thread its *own* lock, which protects nothing. Create one lock and share it (a module-level variable or an attribute of the object being protected). See Exercise 1.
- **`acquire()` without `try`/`finally`.** An exception in the critical section leaves the lock locked forever. Use `with lock:`.
- **Locking only the writes.** A "check, then act" sequence (`if balance >= amount: balance -= amount`) must hold the lock for **both** the check and the update. Otherwise two threads can pass the check before either updates.
- **Holding a lock during slow work.** Sleeping, network calls or heavy computation inside a critical section serializes your threads. Lock only the shared-state update.
- **Calling a locking method from another locking method with a plain `Lock`.** The thread deadlocks with itself. Restructure the code, or use `RLock`.
- **Acquiring several locks in inconsistent order.** This can deadlock. Always use one global order.
- **Assuming the GIL makes code thread-safe.** It does not protect multi-step operations, and free-threaded builds have no GIL at all.
- **Testing once and concluding there is no race.** Races depend on timing. Correctness must come from the design, not from a lucky test run.

## Summary

- A race condition occurs when threads access shared data without coordination and the result depends on timing. Read-modify-write sequences are the classic case.
- Even `counter += 1` is several bytecode instructions. The GIL does not make it atomic.
- `threading.Lock` (a mutex) lets only one thread at a time into a critical section. `acquire()` blocks until the lock is free, `release()` frees it.
- Prefer `with lock:`. It always releases the lock, even after an exception.
- All threads must share **the same** lock object. Keeping the lock inside the class that owns the data is the cleanest design.
- Keep critical sections short, because code inside them runs one thread at a time.
- `Lock` is not reentrant. Use `RLock` for nested locking, and acquire multiple locks in a fixed order to avoid deadlocks.
- Consider `queue.Queue`, `Semaphore`, `Event` and other primitives, or avoid shared mutable state entirely.

## Practice

### Exercise 1: Spot the bug

This code uses a lock and still loses updates. Explain why and fix it.

```python
import sys
from threading import Lock, Thread

sys.setswitchinterval(1e-6)  # make thread switches frequent

total = 0


def plus_one(value):
    return value + 1


def add_many(times):
    global total
    lock = Lock()
    for _ in range(times):
        with lock:
            total = plus_one(total)


threads = [Thread(target=add_many, args=(500_000,)) for _ in range(4)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"expected 2000000, got {total}")
```

### Exercise 2: A thread-safe bank account

Write a `BankAccount` class with `deposit(amount)`, `withdraw(amount)` and a read-only `balance` property. `withdraw()` must return `False` and leave the balance unchanged if there is not enough money, and `True` otherwise. Inside `withdraw()`, call `time.sleep(0.01)` between the check and the update to simulate a slow system. Start with a balance of 100, let 10 threads each try to withdraw 30, and print how many withdrawals succeeded and the final balance. The balance must never go negative.

### Exercise 3: Limit concurrency with a semaphore

Simulate 6 downloads of 0.1 seconds each in 6 threads, but allow at most 2 downloads at the same time with `threading.Semaphore`. Track how many downloads are active at once (protect that counter with a `Lock`) and print the maximum, along with the total time.

### Exercise 4: Load only once

Five threads call `get_config()` at the same time. The function should call the slow `load_config()` only on the first call and cache the result. The version below calls it five times. Fix it with a lock so that `load_config()` runs exactly once, and keep later calls fast (they should not need the lock once the config is loaded).

```python
import threading
import time

_config = None
load_count = 0


def load_config():
    global load_count
    load_count += 1
    time.sleep(0.1)  # reading a file, parsing...
    return {"debug": False}


def get_config():
    global _config
    if _config is None:
        _config = load_config()
    return _config


threads = [threading.Thread(target=get_config) for _ in range(5)]
for t in threads:
    t.start()
for t in threads:
    t.join()
print("load_config() calls:", load_count)
```

## Solutions

### Exercise 1

Every call of `add_many()` creates its **own** `Lock`, so each thread locks a different object and nobody ever waits for anybody. Running the buggy version prints something like:

```text
expected 2000000, got 1691914
```

The fix is a single lock shared by all threads:

```python
import sys
from threading import Lock, Thread

sys.setswitchinterval(1e-6)  # make thread switches frequent

total = 0
total_lock = Lock()  # one lock, shared by all threads


def plus_one(value):
    return value + 1


def add_many(times):
    global total
    for _ in range(times):
        with total_lock:
            total = plus_one(total)


threads = [Thread(target=add_many, args=(500_000,)) for _ in range(4)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(f"expected 2000000, got {total}")
```

Output:

```text
expected 2000000, got 2000000
```

### Exercise 2

```python
import threading
import time


class BankAccount:
    def __init__(self, balance):
        self._balance = balance
        self._lock = threading.Lock()

    def deposit(self, amount):
        with self._lock:
            self._balance += amount

    def withdraw(self, amount):
        with self._lock:  # check and update must happen under the same lock
            if self._balance < amount:
                return False
            time.sleep(0.01)  # simulate a slow bank system
            self._balance -= amount
            return True

    @property
    def balance(self):
        with self._lock:
            return self._balance


account = BankAccount(100)
results = []


def try_withdraw():
    results.append(account.withdraw(30))


threads = [threading.Thread(target=try_withdraw) for _ in range(10)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print("successful withdrawals:", results.count(True))
print("refused withdrawals:", results.count(False))
print("final balance:", account.balance)
```

Output:

```text
successful withdrawals: 3
refused withdrawals: 7
final balance: 10
```

Without the lock, several threads could pass the `self._balance < amount` check during the `sleep()` before any of them subtracts, and the balance would go negative. Here the sleep is inside the critical section on purpose, because it stands for part of the update itself. `results.append()` is a single thread-safe operation, so `results` needs no lock.

### Exercise 3

```python
import threading
import time

slots = threading.Semaphore(2)  # at most 2 downloads at a time
stats_lock = threading.Lock()
active = 0
max_active = 0


def download(n):
    global active, max_active
    with slots:
        with stats_lock:
            active += 1
            max_active = max(max_active, active)
        time.sleep(0.1)  # simulate the download
        with stats_lock:
            active -= 1


start = time.perf_counter()
threads = [threading.Thread(target=download, args=(n,)) for n in range(6)]
for t in threads:
    t.start()
for t in threads:
    t.join()

print("max concurrent downloads:", max_active)
print(f"took {time.perf_counter() - start:.1f} s")
```

Output (the time varies slightly):

```text
max concurrent downloads: 2
took 0.3 s
```

A `Semaphore(2)` has two "permits". Each `with slots:` takes one, and a third thread waits until a permit is returned. Six downloads in pairs take 3 × 0.1 seconds. Note that the sleep is outside `stats_lock`, so the lock is held only for the tiny counter updates.

### Exercise 4

```python
import threading
import time

_config = None
_config_lock = threading.Lock()
load_count = 0


def load_config():
    global load_count
    load_count += 1
    time.sleep(0.1)  # reading a file, parsing...
    return {"debug": False}


def get_config():
    global _config
    if _config is None:              # fast path, no lock once loaded
        with _config_lock:
            if _config is None:      # check again: another thread may have loaded it
                _config = load_config()
    return _config


threads = [threading.Thread(target=get_config) for _ in range(5)]
for t in threads:
    t.start()
for t in threads:
    t.join()
print("load_config() calls:", load_count)
print(get_config())
```

Output:

```text
load_config() calls: 1
{'debug': False}
```

This pattern is called **double-checked locking**. The first check skips the lock once the config exists. The second check, inside the lock, is essential: several threads may pass the first check at the same moment, and only the first one to get the lock should load the config. The others find `_config` already set when they get the lock. Since `load_config()` is only ever called while holding `_config_lock`, its `load_count += 1` is protected too.

---

*Source: [pythontutorial.net — Python Threading Lock](https://www.pythontutorial.net/advanced-python/python-threading-lock/). Adapted and expanded for PyJourney.*
