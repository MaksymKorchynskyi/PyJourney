# asyncio

`asyncio` is the standard-library framework for writing **concurrent** code with the `async`/`await` syntax. A single thread runs an **event loop** that juggles many tasks: while one task waits for the network, a database or a timer, the loop runs another. This is why one Python process can handle thousands of slow I/O operations at once, and why web frameworks, database drivers and bots are built on top of it.

## What you'll learn

- What an event loop is, and when `asyncio` beats threads or processes (I/O-bound vs CPU-bound work)
- How to write coroutines with `async def` and `await`, and start them with `asyncio.run()`
- How Tasks make coroutines run concurrently, and how to wait for many of them with `gather()`, `TaskGroup` and `as_completed()`
- How to apply timeouts, cancel tasks and handle `CancelledError` correctly
- How to avoid blocking the loop, and how to push blocking code to a thread with `asyncio.to_thread()`
- How to coordinate tasks with `Lock`, `Semaphore` and `Queue`, and how async iterators and async context managers work

## Concurrency with an event loop

Most programs spend a lot of time **waiting**: for an HTTP response, a database row, a file, a message from a socket. A normal (synchronous) program waits doing nothing. During that time the CPU could be doing useful work for another request.

`asyncio` uses **cooperative multitasking**. Every coroutine runs until it reaches an `await` on something that is not ready yet. At that point it voluntarily gives control back to the **event loop**, which picks another task that is ready to continue.

```text
            +-----------------------------------------+
            |               event loop                |
            |  1. take a task that is ready to run    |
            |  2. run it until its next `await`       |
            |  3. remember what the task waits for    |
            |  4. repeat                              |
            +-----------------------------------------+
                   |             |             |
                Task A        Task B        Task C
```

Only one task runs at any given moment. The speed-up comes from **overlapping the waiting**, not from running Python code in parallel:

```text
sequential (await one after another)     concurrent (Tasks)
A: |== wait 1s ==|                       A: |== wait 1s ==|
B:               |==== wait 2s ====|     B: |==== wait 2s ====|
total: ~3s                               total: ~2s
```

### asyncio vs threads vs processes

Python has three main tools for doing several things at once. They solve different problems:

| | `asyncio` | `threading` | `multiprocessing` |
|---|---|---|---|
| Unit of work | coroutine / Task | OS thread | OS process |
| Who switches | your code, at each `await` | the OS, at any moment | the OS |
| Python code runs in parallel | no (one thread) | no, because of the GIL (except free-threaded builds, 3.13+) | yes |
| Cost of one unit | tiny: thousands of tasks are fine | moderate | high |
| Best for | many I/O waits (network, sockets, async DB drivers) | I/O with blocking libraries | CPU-bound work |
| Main danger | blocking the event loop | data races on shared state | data must be pickled between processes |

Rule of thumb:

- **I/O-bound** work (the program mostly waits) fits `asyncio` best, or threads if the library you use is blocking.
- **CPU-bound** work (the program mostly computes: image processing, number crunching) needs processes. `asyncio` cannot speed it up, because only one coroutine runs at a time.

Because switches happen only at `await`, async code has fewer surprises than threaded code: between two `await`s nobody can interrupt you.

## Coroutines: `async def` and `await`

A function defined with `async def` is a **coroutine function**. Calling it does **not** run its body. It returns a **coroutine object**, a paused computation that someone has to drive.

```python
import asyncio


async def greet():
    print("greet() is running")
    return "hi"


coro = greet()        # nothing is printed: the body has not started
print(type(coro))
print(asyncio.iscoroutine(coro))
coro.close()          # we never ran it, so close it to avoid a warning

print(asyncio.run(greet()))
```

Output:

```text
<class 'coroutine'>
True
greet() is running
hi
```

`asyncio.run(coro)` is the entry point of an async program. It creates a new event loop, runs the coroutine until it finishes, returns its result, and closes the loop. Call it **once**, at the top level, usually as `asyncio.run(main())`.

```python
import asyncio


async def main():
    print("hello")
    await asyncio.sleep(1)  # pause this coroutine for 1 second
    print("world")


asyncio.run(main())
```

Output:

```text
hello
world
```

### What `await` does

`await something` means: "run `something` and give me its result; if it has to wait, let the event loop do other work meanwhile". You can only use `await` inside an `async def` function, and only on **awaitable** objects. There are three kinds of awaitables:

- **coroutines**: what an `async def` function returns;
- **Tasks**: coroutines scheduled to run on the loop (next section);
- **Futures**: low-level objects that represent a result that will be available later. Application code rarely creates them directly.

Awaiting a coroutine runs it **to completion before moving on**. So a chain of `await`s is still sequential:

```python
import asyncio
import time


async def fetch(name, delay):
    print(f"start {name}")
    await asyncio.sleep(delay)  # pretend we wait for the network
    print(f"done  {name}")
    return f"{name}-data"


async def main():
    start = time.perf_counter()
    a = await fetch("A", 1)
    b = await fetch("B", 2)
    print(a, b)
    print(f"took {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Output (timings are approximate):

```text
start A
done  A
start B
done  B
A-data B-data
took 3.0s
```

Nothing ran concurrently: `B` started only after `A` finished. To overlap them you need Tasks.

> **Tip:** `python -m asyncio` starts a REPL where you can use `await` at the top level, for example `await asyncio.sleep(1, result="hello")`. It is handy for experiments.

## Tasks: running coroutines concurrently

`asyncio.create_task(coro)` wraps a coroutine in a **Task** and schedules it on the running event loop. The task starts as soon as the current coroutine gives control back to the loop (at its next `await`), and then runs **concurrently** with everything else.

```python
import asyncio
import time


async def fetch(name, delay):
    print(f"start {name}")
    await asyncio.sleep(delay)
    print(f"done  {name}")
    return f"{name}-data"


async def main():
    start = time.perf_counter()
    task_a = asyncio.create_task(fetch("A", 1))
    task_b = asyncio.create_task(fetch("B", 2))
    print("tasks created")

    a = await task_a  # main() pauses here, and both tasks get to run
    b = await task_b
    print(a, b)
    print(f"took {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Output (timings are approximate):

```text
tasks created
start A
start B
done  A
done  B
A-data B-data
took 2.0s
```

Notice the order. `"tasks created"` comes first: creating a task does not run it immediately. The tasks start when `main()` hits `await task_a`. Both then wait at the same time, so the total time is the longest delay (2 s), not the sum (3 s).

A Task is a handle you can inspect and control:

```python
import asyncio


async def compute(x):
    await asyncio.sleep(0.1)
    return x * 2


async def main():
    task = asyncio.create_task(compute(21), name="doubler")
    print(task.get_name(), task.done())
    result = await task
    print(result, task.done(), task.result())


asyncio.run(main())
```

Output:

```text
doubler False
42 True 42
```

Useful methods: `done()`, `result()`, `exception()`, `cancel()`, `cancelled()`, `get_name()` and `add_done_callback()`.

> **Note:** `create_task()` requires a running event loop. Calling it outside a coroutine raises `RuntimeError: no running event loop`.

## Waiting for many tasks: `gather()`

`asyncio.gather(*aws)` runs several awaitables concurrently and returns a list of their results. Coroutines passed to it are wrapped in Tasks automatically. The results come back **in the order you passed the awaitables**, not in the order they finished.

```python
import asyncio
import time


async def fetch(name, delay):
    await asyncio.sleep(delay)
    return f"{name}-data"


async def main():
    start = time.perf_counter()
    results = await asyncio.gather(
        fetch("slow", 2),
        fetch("fast", 1),
        fetch("medium", 1.5),
    )
    print(results)

    names = ["x", "y", "z"]
    more = await asyncio.gather(*(fetch(name, 0.5) for name in names))
    print(more)
    print(f"took {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Output (timings are approximate):

```text
['slow-data', 'fast-data', 'medium-data']
['x-data', 'y-data', 'z-data']
took 2.5s
```

### Errors in `gather()`

By default (`return_exceptions=False`), the **first** exception is propagated to whoever awaits `gather()`. The other awaitables are **not cancelled**: they keep running in the background.

```python
import asyncio


async def fetch(name, delay, fail=False):
    await asyncio.sleep(delay)
    if fail:
        raise ConnectionError(f"{name} is unreachable")
    print(f"{name} finished")
    return f"{name}-data"


async def main():
    try:
        await asyncio.gather(
            fetch("a", 0.1),
            fetch("b", 0.2, fail=True),
            fetch("c", 0.5),
        )
    except ConnectionError as exc:
        print("caught:", exc)

    await asyncio.sleep(0.5)  # "c" is still running, give it time to finish


asyncio.run(main())
```

Output:

```text
a finished
caught: b is unreachable
c finished
```

With `return_exceptions=True`, exceptions are treated like results and placed in the result list. Nothing is raised, so you can process successes and failures together:

```python
import asyncio


async def fetch(name, delay, fail=False):
    await asyncio.sleep(delay)
    if fail:
        raise ConnectionError(f"{name} is unreachable")
    return f"{name}-data"


async def main():
    results = await asyncio.gather(
        fetch("a", 0.1),
        fetch("b", 0.2, fail=True),
        fetch("c", 0.3),
        return_exceptions=True,
    )
    for result in results:
        if isinstance(result, Exception):
            print("error:", repr(result))
        else:
            print("ok:   ", result)


asyncio.run(main())
```

Output:

```text
ok:    a-data
error: ConnectionError('b is unreachable')
ok:    c-data
```

## `TaskGroup`: the modern default (Python 3.11+)

`asyncio.TaskGroup` is an **asynchronous context manager** that owns a group of tasks. You create tasks with `tg.create_task()`, and leaving the `async with` block waits for all of them. This is called **structured concurrency**: tasks cannot outlive the block that started them.

```python
import asyncio
import time


async def fetch(name, delay):
    await asyncio.sleep(delay)
    return f"{name}-data"


async def main():
    start = time.perf_counter()
    async with asyncio.TaskGroup() as tg:
        task_a = tg.create_task(fetch("A", 1))
        task_b = tg.create_task(fetch("B", 2))
        print("tasks scheduled")
    # the block exits only after every task in the group is done
    print(task_a.result(), task_b.result())
    print(f"took {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Output (timings are approximate):

```text
tasks scheduled
A-data B-data
took 2.0s
```

The real advantage shows up when something fails. As soon as one task raises an exception (other than `CancelledError`), the group **cancels all the other tasks**, waits for them, and raises an `ExceptionGroup` with every error that happened. Handle it with `except*` (Python 3.11+):

```python
import asyncio


async def fetch(name, delay, fail=False):
    try:
        await asyncio.sleep(delay)
        if fail:
            raise ConnectionError(f"{name} is unreachable")
        print(f"{name} finished")
        return f"{name}-data"
    except asyncio.CancelledError:
        print(f"{name} was cancelled")
        raise


async def main():
    try:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(fetch("a", 0.1))
            tg.create_task(fetch("b", 0.2, fail=True))
            tg.create_task(fetch("c", 1.0))
    except* ConnectionError as group:
        for exc in group.exceptions:
            print("failed:", exc)


asyncio.run(main())
```

Output:

```text
a finished
c was cancelled
failed: b is unreachable
```

If you catch the group with a plain `except ExceptionGroup as eg`, `repr(eg)` looks like `ExceptionGroup('unhandled errors in a TaskGroup', [ConnectionError('b is unreachable')])`.

| | `gather()` | `TaskGroup` |
|---|---|---|
| Available since | always | Python 3.11 |
| On the first error | raises it, other tasks keep running | cancels the other tasks, raises `ExceptionGroup` |
| Errors as values | yes, with `return_exceptions=True` | no |
| Results | list, in input order | `task.result()` of each task |
| Leftover tasks after an error | possible | impossible |

Prefer `TaskGroup` for new code. Reach for `gather(..., return_exceptions=True)` when you want "best effort" behaviour: run everything, then look at which calls failed.

> **Note:** Python 3.15 adds `TaskGroup.cancel()`, which ends the whole group early without raising an error, for example once the group has already found what it was looking for.

## Results as they arrive: `as_completed()`

Sometimes you want to handle each result **as soon as it is ready**, for example to show progress. `asyncio.as_completed()` gives you the awaitables in completion order. Since Python 3.13 you can iterate over it with `async for`, and it yields the **original tasks**:

```python
import asyncio
import time


async def fetch(name, delay):
    await asyncio.sleep(delay)
    return name


async def main():
    start = time.perf_counter()
    tasks = [
        asyncio.create_task(fetch("slow", 3)),
        asyncio.create_task(fetch("fast", 1)),
        asyncio.create_task(fetch("medium", 2)),
    ]
    async for task in asyncio.as_completed(tasks):  # Python 3.13+
        name = await task  # the task is already done, so this returns at once
        print(f"{name:<6} ready after {time.perf_counter() - start:.0f}s")


asyncio.run(main())
```

Output (timings are approximate):

```text
fast   ready after 1s
medium ready after 2s
slow   ready after 3s
```

On older versions use a plain `for` loop. Each iteration then yields a **new** coroutine that you must await to get the next result:

```python
# inside main(), Python 3.12 and older
for next_done in asyncio.as_completed(tasks):
    name = await next_done
```

`as_completed()` also accepts `timeout=`. If not everything is done in time, it raises `TimeoutError`, but it does **not** cancel the remaining tasks.

## Timeouts

Never wait forever for something that may hang. `asyncio` offers two tools.

### `asyncio.timeout()` (Python 3.11+)

`asyncio.timeout(delay)` is an async context manager. If the code inside takes longer than `delay` seconds, the current task is cancelled, and the cancellation is turned into a `TimeoutError` when the block exits. So you catch `TimeoutError` **outside** the `async with`:

```python
import asyncio


async def slow_operation():
    await asyncio.sleep(10)
    return "finished"


async def main():
    try:
        async with asyncio.timeout(1):
            result = await slow_operation()
            print(result)
    except TimeoutError:
        print("gave up after 1 second")

    print("the program continues")


asyncio.run(main())
```

Output:

```text
gave up after 1 second
the program continues
```

The limit applies to the **whole block**, however many `await`s it contains. Pass `None` for "no limit for now" and change the deadline later with `cm.reschedule(new_deadline)`. `cm.expired()` tells you whether the deadline was hit. Use `asyncio.timeout_at(when)` to give an absolute deadline in terms of `loop.time()`.

### `asyncio.wait_for()`

`asyncio.wait_for(aw, timeout)` limits a **single** awaitable. On timeout it cancels the awaitable and raises `TimeoutError`:

```python
import asyncio


async def slow_operation():
    await asyncio.sleep(10)
    return "finished"


async def main():
    try:
        await asyncio.wait_for(slow_operation(), timeout=0.5)
    except TimeoutError:
        print("timed out")

    result = await asyncio.wait_for(asyncio.sleep(0.1, result="quick"), timeout=0.5)
    print(result)


asyncio.run(main())
```

Output:

```text
timed out
quick
```

> **Note:** Since Python 3.11, `asyncio.TimeoutError` is just an alias of the built-in `TimeoutError`. On 3.10 and older, catch `asyncio.TimeoutError`.

## Cancellation

`task.cancel()` asks a task to stop. The task is not killed instantly: `asyncio.CancelledError` is raised **inside** the coroutine at the `await` where it is currently suspended. This gives the coroutine a chance to clean up with `try`/`finally`.

```python
import asyncio


async def worker():
    print("worker: started")
    try:
        while True:
            await asyncio.sleep(0.5)
            print("worker: tick")
    except asyncio.CancelledError:
        print("worker: cancelled, cleaning up")
        raise  # always re-raise after cleanup
    finally:
        print("worker: finally block runs")


async def main():
    task = asyncio.create_task(worker())
    await asyncio.sleep(1.2)

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        print("main: the worker is cancelled")
    print("cancelled():", task.cancelled())


asyncio.run(main())
```

Output:

```text
worker: started
worker: tick
worker: tick
worker: cancelled, cleaning up
worker: finally block runs
main: the worker is cancelled
cancelled(): True
```

Rules worth remembering:

- `CancelledError` inherits from `BaseException`, not `Exception` (since Python 3.8). So `except Exception:` does not catch it by accident, which is exactly what you want.
- If you catch `CancelledError` to clean up, **re-raise it**. `TaskGroup` and `asyncio.timeout()` use cancellation internally and break if a coroutine swallows it.
- Prefer `try`/`finally` (or `async with`) for cleanup. It runs on success, on error and on cancellation.
- Cancelling a task that awaits another task or future cancels that one too: cancellation travels down the chain.
- `asyncio.shield(aw)` protects an inner operation from being cancelled together with its caller. Use it rarely, for operations that must finish, such as writing a final record.

## Never block the event loop

The event loop can switch tasks only at an `await`. A regular blocking call such as `time.sleep()`, `requests.get()` or a long computation keeps the single thread busy, and **every** task stops until it returns.

```python
import asyncio
import time


async def blocking_job(n):
    time.sleep(1)  # blocks the whole event loop
    return n


async def friendly_job(n):
    await asyncio.sleep(1)  # suspends only this coroutine
    return n


async def run_three(label, job):
    start = time.perf_counter()
    await asyncio.gather(job(1), job(2), job(3))
    print(f"{label}: {time.perf_counter() - start:.1f}s")


async def main():
    await run_three("time.sleep   ", blocking_job)
    await run_three("asyncio.sleep", friendly_job)


asyncio.run(main())
```

Output (timings are approximate):

```text
time.sleep   : 3.0s
asyncio.sleep: 1.0s
```

The three `blocking_job` coroutines ran one after another, even though they were "concurrent". Inside async code:

- wait with `await asyncio.sleep()`, never `time.sleep()`;
- use async libraries for I/O (for example `aiohttp` or `httpx` instead of `requests`, async database drivers);
- if you have a long pure-Python loop, call `await asyncio.sleep(0)` from time to time. It yields to the loop without actually waiting;
- run `asyncio.run(main(), debug=True)` during development: debug mode logs every step that blocks the loop for more than 100 ms.

## Running blocking code: `asyncio.to_thread()`

Sometimes you must call blocking code: a library without async support, file system work, a legacy SDK. `asyncio.to_thread(func, *args, **kwargs)` runs the function in a separate thread and gives you a coroutine to await. The event loop stays free in the meantime.

```python
import asyncio
import time


def blocking_read(path):
    # an ordinary blocking function: slow disk, legacy library, ...
    time.sleep(1)
    return f"contents of {path}"


async def main():
    start = time.perf_counter()
    results = await asyncio.gather(
        asyncio.to_thread(blocking_read, "a.txt"),
        asyncio.to_thread(blocking_read, "b.txt"),
        asyncio.sleep(1, result="timer done"),
    )
    print(results)
    print(f"took {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Output (timings are approximate):

```text
['contents of a.txt', 'contents of b.txt', 'timer done']
took 1.0s
```

Because of the GIL, threads help with **I/O-bound** blocking code. For **CPU-bound** functions use a process pool through `loop.run_in_executor()`:

```python
import asyncio
from concurrent.futures import ProcessPoolExecutor


def count_primes(limit):
    count = 0
    for n in range(2, limit):
        if all(n % d for d in range(2, int(n ** 0.5) + 1)):
            count += 1
    return count


async def main():
    loop = asyncio.get_running_loop()
    with ProcessPoolExecutor() as pool:
        results = await asyncio.gather(
            *(loop.run_in_executor(pool, count_primes, limit)
              for limit in (10_000, 20_000, 30_000))
        )
    print(results)


if __name__ == "__main__":
    asyncio.run(main())
```

Output:

```text
[1229, 2262, 3245]
```

## Synchronization: `Lock` and `Semaphore`

Coroutines run in one thread, so a single statement like `counter += 1` is never interrupted. A **race condition** appears only when a coroutine reads shared state, `await`s, and then acts on what it read: during the `await`, another task may have changed that state.

### `asyncio.Lock`

```python
import asyncio


class Account:
    def __init__(self, balance):
        self.balance = balance
        self.lock = asyncio.Lock()

    async def withdraw_unsafe(self, amount):
        if self.balance >= amount:
            await asyncio.sleep(0.1)  # e.g. a call to a payment service
            self.balance -= amount
            return True
        return False

    async def withdraw_safe(self, amount):
        async with self.lock:  # only one task at a time gets inside
            return await self.withdraw_unsafe(amount)


async def main():
    account = Account(100)
    results = await asyncio.gather(account.withdraw_unsafe(80), account.withdraw_unsafe(80))
    print("unsafe:", results, account.balance)

    account = Account(100)
    results = await asyncio.gather(account.withdraw_safe(80), account.withdraw_safe(80))
    print("safe:  ", results, account.balance)


asyncio.run(main())
```

Output:

```text
unsafe: [True, True] -60
safe:   [True, False] 20
```

Without the lock, both tasks checked the balance (100) before either of them subtracted, so the account went negative. With the lock, the check and the update form one indivisible step.

> **Note:** `asyncio.Lock` is **not** thread-safe. It coordinates tasks inside one event loop. For threads use `threading.Lock`.

### `asyncio.Semaphore`: limiting concurrency

A semaphore is a counter of free slots. `async with sem:` takes a slot or waits until one is free. This is the standard way to say "at most N requests at the same time", for example to respect an API rate limit or not to open 10,000 connections at once.

```python
import asyncio
import time


async def download(sem, n, start):
    async with sem:
        print(f"[{time.perf_counter() - start:.0f}s] start job {n}")
        await asyncio.sleep(1)
        return n * 10


async def main():
    sem = asyncio.Semaphore(2)  # at most 2 jobs at once
    start = time.perf_counter()
    results = await asyncio.gather(*(download(sem, n, start) for n in range(6)))
    print(results)
    print(f"took {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Output (timings are approximate):

```text
[0s] start job 0
[0s] start job 1
[1s] start job 2
[1s] start job 3
[2s] start job 4
[2s] start job 5
[0, 10, 20, 30, 40, 50]
took 3.0s
```

Six one-second jobs with two slots take about three seconds. Other primitives in the same family: `asyncio.Event` (one task signals, many wait), `asyncio.Condition`, `asyncio.Barrier` (3.11+) and `asyncio.BoundedSemaphore` (raises an error if released more times than acquired).

## Producer/consumer with `asyncio.Queue`

`asyncio.Queue` passes items between tasks. **Producers** `await queue.put(item)`, **consumers** `await queue.get()`. With `maxsize`, `put()` waits while the queue is full, which automatically slows down a producer that is faster than the consumers (this is called **backpressure**).

```python
import asyncio


async def producer(queue, count):
    for i in range(count):
        await queue.put(f"item-{i}")  # waits while the queue is full
        print(f"produced item-{i}")


async def consumer(name, queue, done):
    while True:
        item = await queue.get()  # waits while the queue is empty
        try:
            await asyncio.sleep(0.3)  # process the item
            done.append(f"{name}:{item}")
        finally:
            queue.task_done()  # report that this item is processed


async def main():
    queue = asyncio.Queue(maxsize=2)
    done = []
    workers = [asyncio.create_task(consumer(f"w{i}", queue, done)) for i in range(2)]

    await producer(queue, 5)
    await queue.join()  # wait until task_done() was called for every item

    for worker in workers:  # the consumers loop forever, so stop them
        worker.cancel()
    await asyncio.gather(*workers, return_exceptions=True)
    print(done)


asyncio.run(main())
```

Output:

```text
produced item-0
produced item-1
produced item-2
produced item-3
produced item-4
['w0:item-0', 'w1:item-1', 'w0:item-2', 'w1:item-3', 'w0:item-4']
```

The flow: `queue.join()` returns when every item that was `put()` has been matched by a `task_done()` call. After that the workers are idle, so `main()` cancels them.

Since Python 3.13 there is a cleaner way to stop consumers: `queue.shutdown()`. After it is called, `put()` raises `asyncio.QueueShutDown` immediately, and `get()` raises it once the queue is empty. Consumers can then leave their loop on their own:

```python
import asyncio


async def consumer(name, queue):
    while True:
        try:
            item = await queue.get()
        except asyncio.QueueShutDown:  # no more items will ever come
            print(f"{name}: exiting")
            return
        await asyncio.sleep(0.1)
        print(f"{name} handled {item}")
        queue.task_done()


async def main():
    queue = asyncio.Queue()
    async with asyncio.TaskGroup() as tg:
        tg.create_task(consumer("w0", queue))
        tg.create_task(consumer("w1", queue))
        for i in range(3):
            await queue.put(i)
        queue.shutdown()  # Python 3.13+


asyncio.run(main())
```

Output:

```text
w0 handled 0
w1 handled 1
w1: exiting
w0 handled 2
w0: exiting
```

`w1` exits before `w0` finishes item `2`: when `w1` asks for its next item, the queue is already empty and shut down, so `get()` raises at once. The `TaskGroup` waits until both consumers return.

`asyncio` also has `PriorityQueue` (smallest item first) and `LifoQueue` (last in, first out).

## Async iteration and async context managers

Regular `for` and `with` call synchronous methods. When producing the next item or entering/leaving a block needs I/O, you use their async versions.

### Async generators and `async for`

An `async def` function that contains `yield` is an **asynchronous generator**. Iterate over it with `async for`, which awaits each next item. Async comprehensions work as well:

```python
import asyncio


async def ticker(count, interval):
    for i in range(count):
        await asyncio.sleep(interval)  # e.g. wait for the next message
        yield i


async def main():
    async for value in ticker(3, 0.2):
        print("tick", value)

    squares = [v * v async for v in ticker(4, 0.1)]
    print(squares)


asyncio.run(main())
```

Output:

```text
tick 0
tick 1
tick 2
[0, 1, 4, 9]
```

Real-world uses: reading a stream line by line, paginating through an API, consuming messages from a broker.

A class becomes an **asynchronous iterator** when it implements `__aiter__()` (a normal method returning the iterator) and `async def __anext__()`, which raises `StopAsyncIteration` at the end:

```python
import asyncio


class Countdown:
    def __init__(self, start):
        self.current = start

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self.current <= 0:
            raise StopAsyncIteration
        await asyncio.sleep(0.1)
        self.current -= 1
        return self.current + 1


async def main():
    async for n in Countdown(3):
        print(n)


asyncio.run(main())
```

Output:

```text
3
2
1
```

### Async context managers and `async with`

An **asynchronous context manager** defines `async def __aenter__()` and `async def __aexit__()`. Use it when setting up or tearing down a resource involves waiting: opening a connection, acquiring a lock, starting a transaction. The `contextlib.asynccontextmanager` decorator builds one from an async generator, just like `contextmanager` does for synchronous code.

```python
import asyncio
from contextlib import asynccontextmanager


class Connection:
    def __init__(self, host):
        self.host = host

    async def __aenter__(self):
        await asyncio.sleep(0.1)  # pretend to connect
        print(f"connected to {self.host}")
        return self

    async def __aexit__(self, exc_type, exc, tb):
        await asyncio.sleep(0.1)  # pretend to close gracefully
        print(f"disconnected from {self.host}")
        return False  # do not suppress exceptions

    async def query(self, sql):
        await asyncio.sleep(0.1)
        return f"result of {sql!r}"


@asynccontextmanager
async def transaction(conn):
    print("BEGIN")
    try:
        yield conn
    except Exception:
        print("ROLLBACK")
        raise
    else:
        print("COMMIT")


async def main():
    async with Connection("db.local") as conn:
        async with transaction(conn):
            print(await conn.query("SELECT 1"))


asyncio.run(main())
```

Output:

```text
connected to db.local
BEGIN
result of 'SELECT 1'
COMMIT
disconnected from db.local
```

You have already used async context managers in this lesson: `asyncio.TaskGroup()`, `asyncio.timeout()`, `asyncio.Lock()` and `asyncio.Semaphore()`.

## Common mistakes

- **Forgetting `await`.** Calling a coroutine function only creates a coroutine object. Your code receives that object instead of the result, and Python warns that the coroutine was never awaited:

  ```python
  import asyncio


  async def get_price():
      await asyncio.sleep(0.1)
      return 42


  async def main():
      price = get_price()  # forgot await
      print(type(price).__name__)


  asyncio.run(main())
  ```

  Output (the warning is printed to stderr; the path and line number differ between systems):

  ```text
  coroutine
  .../asyncio/events.py:94: RuntimeWarning: coroutine 'get_price' was never awaited
    self._context.run(self._callback, *self._args)
  RuntimeWarning: Enable tracemalloc to get the object allocation traceback
  ```

  The fix is `price = await get_price()`.

- **Blocking the loop.** `time.sleep()`, `requests.get()`, heavy computations or synchronous database drivers inside a coroutine freeze every other task. Use `await asyncio.sleep()`, async libraries, `asyncio.to_thread()` for blocking I/O, and a process pool for CPU-heavy work.

- **Losing fire-and-forget tasks.** The event loop keeps only a **weak reference** to a task. If you call `asyncio.create_task(job())` and do not keep the result, the task may be garbage collected before it finishes. Keep a strong reference, or better, use a `TaskGroup`:

  ```python
  import asyncio

  background_tasks = set()


  async def job(n):
      await asyncio.sleep(0.1)
      print("job", n, "done")


  async def main():
      for n in range(3):
          task = asyncio.create_task(job(n))
          background_tasks.add(task)  # a strong reference keeps the task alive
          task.add_done_callback(background_tasks.discard)  # remove it when done
      await asyncio.sleep(0.2)
      print("still referenced:", len(background_tasks))


  asyncio.run(main())
  ```

  Output:

  ```text
  job 0 done
  job 1 done
  job 2 done
  still referenced: 0
  ```

  Such tasks are never awaited, so their exceptions are only logged ("Task exception was never retrieved"). A `TaskGroup` avoids both problems.

- **Swallowing `CancelledError`.** `except asyncio.CancelledError: pass` (or a bare `except:`) makes a task impossible to cancel and breaks timeouts and task groups. Clean up, then `raise`.

- **Calling `asyncio.run()` inside a running loop.** It raises `RuntimeError: asyncio.run() cannot be called from a running event loop`. Inside async code just `await` the coroutine. In Jupyter, which already runs a loop, write `await main()` in a cell.

- **Expecting `gather()` to cancel siblings on error.** It does not. Use `TaskGroup` if one failure should stop the rest.

- **Using `asyncio` for CPU-bound work.** Coroutines share one thread, so pure computation gets no speed-up. Use `multiprocessing` or `ProcessPoolExecutor`.

## Summary

- `asyncio` gives you concurrency in a single thread: an event loop runs one task at a time and switches at every `await`. It shines for I/O-bound work. CPU-bound work needs processes.
- `async def` defines a coroutine function. Calling it creates a coroutine object that does nothing until it is awaited or scheduled. `asyncio.run(main())` is the program's entry point.
- `await` runs an awaitable to completion, so consecutive awaits are sequential. `asyncio.create_task()` schedules coroutines to run concurrently.
- Use `TaskGroup` (3.11+) to run a group of tasks safely, `gather()` to collect results in order (with `return_exceptions=True` for "errors as values"), and `as_completed()` to handle results as they arrive.
- Protect waits with `asyncio.timeout()` (3.11+) or `wait_for()`. Both raise `TimeoutError`.
- Cancellation raises `CancelledError` inside the task. Clean up with `try`/`finally` and re-raise.
- Never block the loop: use `asyncio.sleep()`, async libraries and `asyncio.to_thread()`.
- `Lock` protects read-await-write sequences, `Semaphore` limits concurrency, `Queue` connects producers and consumers. `async for` and `async with` are the async versions of iteration and context managers.

## Practice

### Exercise 1: Predict the order and the time

Without running the code, write down what it prints and roughly how long it takes. Then run it and explain the result.

```python
import asyncio
import time


async def step(name, delay):
    await asyncio.sleep(delay)
    print(name)


async def main():
    start = time.perf_counter()
    task = asyncio.create_task(step("A", 1.5))
    await step("B", 1)
    await step("C", 1)
    await task
    print(f"{time.perf_counter() - start:.0f}s")


asyncio.run(main())
```

### Exercise 2: Health check with partial failures

Write `async def ping(host)` that "checks" a host by sleeping for `0.1 * len(host)` seconds and returns `"ok"`, but raises `ConnectionError(f"{host} is down")` if the host name contains `"bad"`. Then write `async def check_all(hosts)` that pings all hosts **concurrently** and returns a dict `{host: "ok" or "error: <message>"}`. One failing host must not stop the others. Test it with `["api", "bad-db", "cache", "bad-queue"]`.

### Exercise 3: Polite downloader

You must "download" 6 files. File `n` takes `n * 0.3` seconds (simulate it with `asyncio.sleep`). Requirements:

- at most 2 downloads run at the same time;
- each download has a 1-second timeout; a file that takes longer is reported as `"timeout"`;
- use a `TaskGroup`, and return a list of `(n, status)` tuples in file order.

### Exercise 4: Squaring pipeline

Build a producer/consumer pipeline with `asyncio.Queue(maxsize=3)`:

- a producer puts the numbers 1 to 10 into the queue;
- three workers take numbers, "work" for 0.1 s, and add the square to a shared list;
- when all numbers are processed, the workers stop cleanly and the program prints the sorted squares and their sum.

## Solutions

### Exercise 1

Output (timings are approximate):

```text
B
A
C
2s
```

`create_task()` schedules `A` to finish 1.5 s after the start. `main()` then awaits `B` (finishes at 1 s) and `C` (started at 1 s, finishes at 2 s). `A` ran concurrently with them and finished at 1.5 s, between `B` and `C`. When `main()` reaches `await task`, `A` is already done, so the total is about 2 s instead of 3.5 s.

### Exercise 2

```python
import asyncio


async def ping(host):
    await asyncio.sleep(0.1 * len(host))
    if "bad" in host:
        raise ConnectionError(f"{host} is down")
    return "ok"


async def check_all(hosts):
    results = await asyncio.gather(*(ping(h) for h in hosts), return_exceptions=True)
    report = {}
    for host, result in zip(hosts, results):
        if isinstance(result, Exception):
            report[host] = f"error: {result}"
        else:
            report[host] = result
    return report


report = asyncio.run(check_all(["api", "bad-db", "cache", "bad-queue"]))
for host, status in report.items():
    print(f"{host:<10} {status}")
```

Output:

```text
api        ok
bad-db     error: bad-db is down
cache      ok
bad-queue  error: bad-queue is down
```

`gather()` keeps the input order, so `zip(hosts, results)` pairs every host with its own result. `return_exceptions=True` makes failures ordinary values instead of stopping everything.

### Exercise 3

```python
import asyncio
import time


async def download(n, sem):
    async with sem:  # wait for a free slot
        try:
            async with asyncio.timeout(1):
                await asyncio.sleep(n * 0.3)  # the "download"
            return n, "ok"
        except TimeoutError:
            return n, "timeout"


async def main():
    sem = asyncio.Semaphore(2)
    start = time.perf_counter()
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(download(n, sem)) for n in range(1, 7)]
    results = [task.result() for task in tasks]
    print(results)
    print(f"took {time.perf_counter() - start:.1f}s")


asyncio.run(main())
```

Output (timings are approximate):

```text
[(1, 'ok'), (2, 'ok'), (3, 'ok'), (4, 'timeout'), (5, 'timeout'), (6, 'timeout')]
took 2.6s
```

Timeline: files 1 and 2 start at once; file 3 takes the slot freed at 0.3 s, file 4 the one freed at 0.6 s, and so on. The last file starts at 1.6 s and times out at 2.6 s. The timeout lives **inside** the semaphore block, so it measures only the download itself, not the time spent waiting for a slot. Each `download()` catches its own `TimeoutError`, so no task fails and the `TaskGroup` never cancels anything.

### Exercise 4

```python
import asyncio


async def producer(queue):
    for n in range(1, 11):
        await queue.put(n)


async def worker(queue, squares):
    while True:
        n = await queue.get()
        try:
            await asyncio.sleep(0.1)  # pretend to work
            squares.append(n * n)
        finally:
            queue.task_done()


async def main():
    queue = asyncio.Queue(maxsize=3)
    squares = []
    workers = [asyncio.create_task(worker(queue, squares)) for _ in range(3)]

    await producer(queue)
    await queue.join()  # every number has been processed

    for w in workers:
        w.cancel()
    await asyncio.gather(*workers, return_exceptions=True)

    print(sorted(squares))
    print("sum:", sum(squares))


asyncio.run(main())
```

Output:

```text
[1, 4, 9, 16, 25, 36, 49, 64, 81, 100]
sum: 385
```

On Python 3.13+ you can replace the cancel step with `queue.shutdown()` after the producer finishes, and let the workers exit when `get()` raises `asyncio.QueueShutDown`, as shown in the lesson.

---

*Sources: [Python docs — asyncio: Asynchronous I/O](https://docs.python.org/3/library/asyncio.html), [Python docs — Coroutines and Tasks](https://docs.python.org/3/library/asyncio-task.html). Adapted and expanded for PyJourney.*
