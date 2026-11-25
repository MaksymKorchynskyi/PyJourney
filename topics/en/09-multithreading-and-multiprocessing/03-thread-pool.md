# Thread Pool

Creating a `Thread` by hand for every small job works for a handful of tasks, but it does not scale: threads cost time and memory to create, nothing limits how many you start, and results and exceptions are awkward to collect. A **thread pool** solves all three problems. In Python it is `concurrent.futures.ThreadPoolExecutor`.

## What you'll learn

- What a thread pool is and why it beats creating threads manually
- How to run tasks with `ThreadPoolExecutor.submit()` and `map()`
- What a `Future` is and how to get results, exceptions and status from it
- How to process results as they finish with `as_completed()` and `wait()`
- How exceptions, timeouts, shutdown and cancellation work in a pool
- How to choose the number of workers

## Why a thread pool?

With raw `threading.Thread` you start a new thread per task. That has three costs:

- **Creation overhead.** Every thread is created by the OS and destroyed afterwards. For thousands of short tasks, this overhead adds up.
- **No limit.** Starting 10,000 threads for 10,000 URLs can exhaust memory, hit OS limits, or overload the server you are calling.
- **Manual bookkeeping.** Threads discard return values and do not pass exceptions to the caller, so you must collect both yourself.

A thread pool creates a fixed number of **worker threads** (workers) and **reuses** them. You put tasks into a queue, idle workers take them one by one, and each submitted task gives you back a `Future` object that will hold its result or exception.

```text
 your code                   thread pool (max_workers=3)
                         +-------------------------------+
 submit(task) ---------> |  task queue: [t4][t5][t6] ... |
   returns a Future      |        |      |      |        |
                         |    worker_0 worker_1 worker_2 |
                         +--------|------|------|--------+
                                  v      v      v
                        each Future receives a result or an exception
```

## `ThreadPoolExecutor` at a glance

`ThreadPoolExecutor` lives in the `concurrent.futures` module. It is a subclass of the abstract `Executor` class, which defines three methods:

| Method | What it does |
|---|---|
| `submit(fn, *args, **kwargs)` | Schedules one call `fn(*args, **kwargs)` and immediately returns a `Future` |
| `map(fn, *iterables, timeout=None)` | Calls `fn` for every item and returns an iterator of results **in input order** |
| `shutdown(wait=True, cancel_futures=False)` | Stops accepting new tasks and frees the workers |

The most useful constructor parameters:

| Parameter | Meaning |
|---|---|
| `max_workers` | Maximum number of worker threads. Default: `min(32, os.process_cpu_count() + 4)` (Python 3.13+; earlier versions use `os.cpu_count()`) |
| `thread_name_prefix` | Prefix for worker names, e.g. `"worker"` gives `worker_0`, `worker_1`, ... |
| `initializer`, `initargs` | A function (and its arguments) that runs once in every worker thread when it starts |

Workers are created lazily, only when tasks arrive, up to `max_workers`.

You must release the pool's threads when you are done. The easiest way is a `with` block: leaving it calls `shutdown(wait=True)`, which **waits for all submitted tasks to finish**.

## `Future` objects

A `Future` represents the **eventual result** of a call that may not have finished yet. Its main methods:

| Method | What it does |
|---|---|
| `result(timeout=None)` | Waits for the call and returns its value, or **re-raises** its exception |
| `exception(timeout=None)` | Waits for the call and returns the exception object, or `None` |
| `done()` | `True` if the call finished or was cancelled |
| `running()` | `True` while a worker is executing it |
| `cancel()` | Tries to cancel. Works only if the call has not started yet |
| `cancelled()` | `True` if it was cancelled |
| `add_done_callback(fn)` | Calls `fn(future)` once the future is done |

```python
from concurrent.futures import ThreadPoolExecutor
from time import sleep


def slow_double(x):
    sleep(0.2)
    return x * 2


with ThreadPoolExecutor(max_workers=1) as executor:
    future = executor.submit(slow_double, 21)
    print(future)
    print("done?", future.done())
    print("result:", future.result())  # blocks until the result is ready
    print("done?", future.done())
    print(future)
```

Output (the address varies):

```text
<Future at 0x10529d010 state=running>
done? False
result: 42
done? True
<Future at 0x10529d010 state=finished returned int>
```

`submit()` returned immediately with a running future. `result()` blocked the main thread for about 0.2 seconds until the value was ready.

## A sequential baseline

Here is a task that simulates I/O with a half-second sleep, called twice in a row:

```python
from time import perf_counter, sleep


def task(task_id):
    print(f"Starting the task {task_id}...")
    sleep(0.5)
    return f"Done with task {task_id}"


start = perf_counter()

print(task(1))
print(task(2))

finish = perf_counter()
print(f"It took {finish - start:.2f} second(s) to finish.")
```

Output (timing varies slightly):

```text
Starting the task 1...
Done with task 1
Starting the task 2...
Done with task 2
It took 1.01 second(s) to finish.
```

Unlike a plain `Thread` target, this `task()` **returns** a value. A pool lets us keep that convenient style.

## Running tasks with `submit()`

```python
from concurrent.futures import ThreadPoolExecutor
from time import perf_counter, sleep


def task(task_id):
    print(f"Starting the task {task_id}...")
    sleep(0.5)
    return f"Done with task {task_id}"


start = perf_counter()

with ThreadPoolExecutor() as executor:
    f1 = executor.submit(task, 1)
    f2 = executor.submit(task, 2)

    print(f1.result())
    print(f2.result())

finish = perf_counter()
print(f"It took {finish - start:.2f} second(s) to finish.")
```

Output (timing varies slightly):

```text
Starting the task 1...
Starting the task 2...
Done with task 1
Done with task 2
It took 0.51 second(s) to finish.
```

How it works:

1. `with ThreadPoolExecutor() as executor:` creates the pool and guarantees that it is shut down at the end of the block.
2. `executor.submit(task, 1)` schedules `task(1)` and returns a `Future` right away. Arguments come after the function, **not** as a call: `submit(task, 1)`, not `submit(task(1))`.
3. `f1.result()` waits for `task(1)` to finish and returns its value. Both tasks were already running, so the waits overlapped and the whole program took about half a second.

## Running tasks with `map()`

`executor.map(fn, iterable)` is the concurrent version of the built-in `map()`:

```python
from concurrent.futures import ThreadPoolExecutor
from time import perf_counter, sleep


def task(task_id):
    print(f"Starting the task {task_id}...")
    sleep(0.5)
    return f"Done with task {task_id}"


start = perf_counter()

with ThreadPoolExecutor() as executor:
    results = executor.map(task, [1, 2])
    for result in results:
        print(result)

finish = perf_counter()
print(f"It took {finish - start:.2f} second(s) to finish.")
```

Output (timing varies slightly):

```text
Starting the task 1...
Starting the task 2...
Done with task 1
Done with task 2
It took 0.51 second(s) to finish.
```

Things to know about `map()`:

- All tasks are submitted immediately, but the returned **iterator** yields results **in input order**. If the first task is the slowest, you wait for it even though later results are ready.
- If a task raised an exception, it is re-raised **when the iterator reaches that result**.
- `timeout=` is counted from the call to `map()`. If the next result is not ready by then, the iteration raises `TimeoutError`.
- Several iterables work like the built-in `map()`: `executor.map(pow, [2, 3], [10, 2])` computes `pow(2, 10)` and `pow(3, 2)`.
- Python 3.14 added `buffersize=`. It limits how many tasks are submitted ahead of the results you have consumed, which helps with very long or infinite input iterables.

### Workers are reused

A pool with two workers runs six tasks on the same two threads:

```python
import threading
from concurrent.futures import ThreadPoolExecutor
from time import sleep


def task(task_id):
    sleep(0.1)
    return f"task {task_id} ran in {threading.current_thread().name}"


with ThreadPoolExecutor(max_workers=2, thread_name_prefix="worker") as executor:
    for line in executor.map(task, range(1, 7)):
        print(line)
```

Output (which worker gets which task may vary):

```text
task 1 ran in worker_0
task 2 ran in worker_1
task 3 ran in worker_0
task 4 ran in worker_1
task 5 ran in worker_0
task 6 ran in worker_1
```

With `max_workers=2`, at most two tasks run at the same time, and six tasks take about 0.3 seconds. This is how a pool **limits concurrency**, for example to stay polite to a web server.

## Getting results as they finish: `as_completed()`

`as_completed(futures)` yields futures **in the order they finish**, not the order you submitted them. A dict that maps each future back to its input is the usual way to know which result is which:

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import perf_counter, sleep


def fetch(seconds):
    sleep(seconds)
    return f"{seconds} s of work"


jobs = {"slow": 0.3, "fast": 0.1, "medium": 0.2}
start = perf_counter()

with ThreadPoolExecutor() as executor:
    # map each future back to the job name
    future_to_name = {executor.submit(fetch, sec): name for name, sec in jobs.items()}

    for future in as_completed(future_to_name):
        name = future_to_name[future]
        print(f"{name:<7} {future.result()}, finished at {perf_counter() - start:.1f} s")
```

Output (timings vary slightly):

```text
fast    0.1 s of work, finished at 0.1 s
medium  0.2 s of work, finished at 0.2 s
slow    0.3 s of work, finished at 0.3 s
```

Each result is handled as soon as it is ready. With `map()` you would get `slow` first, after 0.3 seconds, and only then the other two.

For finer control there is `wait(futures, timeout=None, return_when=...)`. It returns two sets, `(done, not_done)`. `return_when` can be `ALL_COMPLETED` (default), `FIRST_COMPLETED` or `FIRST_EXCEPTION`:

```python
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from time import sleep


def job(seconds):
    sleep(seconds)
    return seconds


with ThreadPoolExecutor() as executor:
    futures = [executor.submit(job, s) for s in (0.3, 0.1, 0.2)]
    done, not_done = wait(futures, return_when=FIRST_COMPLETED)
    print("first finished:", [f.result() for f in done])
    print("still running:", len(not_done))
```

Output:

```text
first finished: [0.1]
still running: 2
```

## Handling exceptions

An exception inside a task does not crash the worker and is not printed. It is stored in the future. `result()` re-raises it in the calling thread, and `exception()` returns it without raising:

```python
from concurrent.futures import ThreadPoolExecutor


def parse_price(text):
    return float(text)


with ThreadPoolExecutor() as executor:
    good = executor.submit(parse_price, "19.99")
    bad = executor.submit(parse_price, "free")

    print(good.result())
    print(repr(bad.exception()))  # the exception object, not raised

    try:
        bad.result()               # re-raises the exception here
    except ValueError as exc:
        print("caught:", exc)
```

Output:

```text
19.99
ValueError("could not convert string to float: 'free'")
caught: could not convert string to float: 'free'
```

With `map()`, the exception appears while you iterate, and the remaining results are lost for that loop:

```python
from concurrent.futures import ThreadPoolExecutor


def parse_price(text):
    return float(text)


with ThreadPoolExecutor() as executor:
    results = executor.map(parse_price, ["1.5", "2.5", "free", "4.0"])
    try:
        for value in results:
            print(value)
    except ValueError as exc:
        print("stopped:", exc)
```

Output:

```text
1.5
2.5
stopped: could not convert string to float: 'free'
```

If you need every result, including failures, use `submit()` and check each future (see Exercise 2).

## Shutting down and cancelling

`shutdown(wait=True)` (or leaving the `with` block) waits until every submitted task has finished. Since Python 3.9, `cancel_futures=True` cancels the tasks that have **not started yet**. Running tasks always run to completion, because a thread cannot be stopped from outside.

```python
from concurrent.futures import ThreadPoolExecutor
from time import sleep


def job(n):
    sleep(0.1)
    return n


executor = ThreadPoolExecutor(max_workers=2)
futures = [executor.submit(job, n) for n in range(6)]
executor.shutdown(wait=True, cancel_futures=True)

print([f.cancelled() for f in futures])
print([f.result() for f in futures if not f.cancelled()])
```

Output:

```text
[False, False, True, True, True, True]
[0, 1]
```

The two workers were already running jobs 0 and 1. Jobs 2 to 5 were still in the queue, so they were cancelled. After `shutdown()`, calling `submit()` raises `RuntimeError`.

## A practical example: downloading images

The program below downloads several images in parallel and saves them to a folder. To keep it runnable offline, `fake_urlopen()` stands in for the network: it waits 0.3 seconds and returns some bytes.

```python
import os
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from pathlib import Path

URLS = [
    "https://example.com/images/python_bivittatus.jpg",
    "https://example.com/images/python_regius.jpg",
    "https://example.com/images/carpet_python.jpg",
    "https://example.com/images/rock_python.jpg",
    "https://example.com/images/wilpattu_python.jpg",
]


def fake_urlopen(url):
    """Stand-in for a real download: waits like a network call, returns bytes."""
    time.sleep(0.3)
    return f"<image data from {url}>".encode()


def download_image(url, folder):
    image_data = fake_urlopen(url)
    if not image_data:
        raise ValueError(f"could not download the image from {url}")

    path = folder / os.path.basename(url)
    path.write_bytes(image_data)
    return f"{path.name} was downloaded ({len(image_data)} bytes)"


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        download = partial(download_image, folder=Path(tmp))
        start = time.perf_counter()

        with ThreadPoolExecutor(max_workers=5) as executor:
            for message in executor.map(download, URLS):
                print(message)

        finish = time.perf_counter()
        print(f"It took {finish - start:.2f} second(s) to finish.")
```

Output (timing varies slightly):

```text
python_bivittatus.jpg was downloaded (66 bytes)
python_regius.jpg was downloaded (62 bytes)
carpet_python.jpg was downloaded (62 bytes)
rock_python.jpg was downloaded (60 bytes)
wilpattu_python.jpg was downloaded (64 bytes)
It took 0.31 second(s) to finish.
```

Five "downloads" of 0.3 seconds each took about 0.3 seconds in total. Notes on the design:

- `functools.partial(download_image, folder=...)` fixes the `folder` argument, so `map()` only has to supply the URL.
- The worker **returns** a message instead of printing it. The main thread prints, so the output is not interleaved and stays in input order.
- The loop over `executor.map(...)` **consumes the results**. That is what makes an exception from any download show up. Calling `executor.map(download, URLS)` without reading the results would hide all errors (see Common mistakes).

To download for real, replace `fake_urlopen` with a function based on `urllib.request` (it needs network access):

```python
from urllib.request import urlopen


def real_urlopen(url):
    with urlopen(url, timeout=10) as response:
        return response.read()
```

Always set a `timeout` for network calls in a pool. A request that hangs forever blocks its worker forever.

## Choosing `max_workers`

- For **I/O-bound** work, the right number depends on the other side: how many connections a server or database accepts, rate limits, your bandwidth. The default `min(32, CPUs + 4)` is a reasonable start. Going much higher rarely helps and can get you throttled.
- For **CPU-bound** pure-Python work, a thread pool does not help in standard CPython because of the GIL. Use `ProcessPoolExecutor` (covered later in this section), or a free-threaded CPython build (optional since 3.13, officially supported since 3.14).
- A pool does not make shared data safe. If tasks modify the same object, protect it with a `Lock` (next topic) or, better, return values and combine them in the main thread.

## Common mistakes

- **Ignoring the results of `map()`.** Exceptions are stored in the futures, so if nobody reads the results, errors vanish silently:

  ```python
  from concurrent.futures import ThreadPoolExecutor


  def save(name):
      if name == "b":
          raise OSError("disk full")
      print("saved", name)


  with ThreadPoolExecutor() as executor:
      executor.map(save, ["a", "b", "c"])  # results are never read

  print("finished, and no error was reported")
  ```

  Output (the order of the first two lines may vary):

  ```text
  saved a
  saved c
  finished, and no error was reported
  ```

  Always iterate over the results of `map()` or call `result()` on every future.
- **Calling `result()` right after each `submit()`.** `executor.submit(task, n).result()` in a loop waits for each task before submitting the next one, so nothing runs concurrently. Submit everything first, then collect.
- **Writing `submit(task(1))`.** This calls `task(1)` in the current thread and submits its return value. Write `submit(task, 1)`.
- **Expecting `result(timeout=...)` to stop the task.** A timeout only stops *waiting*. The task keeps running, and leaving the `with` block still waits for it.
- **Waiting inside a task for another task of the same pool.** If all workers wait for tasks that are still queued, nobody is free to run them, and the program deadlocks.
- **Using a thread pool for CPU-bound Python code** in standard CPython. Use a process pool.
- **Forgetting to shut the pool down** when you do not use `with`. Call `executor.shutdown()` yourself, ideally in a `finally` block.

## Summary

- A thread pool keeps a fixed set of reusable worker threads and a queue of tasks. Use `concurrent.futures.ThreadPoolExecutor`.
- `submit(fn, *args)` schedules one call and returns a `Future`. `map(fn, iterable)` schedules many and yields results in input order.
- A `Future` holds the eventual result: `result()` returns it or re-raises the exception, `exception()` returns the exception, `done()` and `cancel()` report and control the state.
- `as_completed()` yields futures in completion order, `wait()` waits for all, the first, or the first failing one.
- Use the executor in a `with` block. On exit it waits for all tasks. `shutdown(cancel_futures=True)` drops tasks that have not started.
- `max_workers` limits concurrency. The default is `min(32, os.process_cpu_count() + 4)`.
- Thread pools suit I/O-bound work. Always consume results so exceptions are not lost.

## Practice

### Exercise 1: From a loop to `map()`

The function below checks a page's status. Check the five URLs concurrently with `executor.map()`, print each URL with its status in the original order, and print the total time (about 0.2 seconds instead of 1).

```python
from time import sleep


def check_status(url):
    sleep(0.2)  # simulate an HTTP request
    return url, 200


urls = [f"https://example.com/page{i}" for i in range(1, 6)]
```

### Exercise 2: Collect successes and failures

Write `to_int(text)` that sleeps 0.05 seconds and returns `int(text)`. Convert `["10", "x", "25", "3.5", "-4"]` with `submit()` and `as_completed()`. Collect the successful conversions in a dict `ok` (`text -> number`) and the failures in a dict `errors` (`text -> exception class name`). Print both dicts sorted by key.

### Exercise 3: Timeouts

Three services respond after 0.05, 0.1 and 0.5 seconds. Call them in a pool and wait for each result with `result(timeout=0.2)`. Print `"<name>: OK"` for answers and `"<name>: timed out"` for timeouts. Then print when the program left the `with` block, and explain the time.

```python
services = {"auth": 0.05, "billing": 0.1, "reports": 0.5}
```

### Exercise 4: One connection per worker

Opening a database connection is expensive, so each worker should open exactly one and reuse it. Use `ThreadPoolExecutor(max_workers=3, initializer=...)` and `threading.local()` to give every worker thread its own fake connection (a string containing the thread's name). Run 9 queries (each sleeps 0.1 seconds and reports which connection it used) and show that only 3 connections were opened.

## Solutions

### Exercise 1

```python
from concurrent.futures import ThreadPoolExecutor
from time import perf_counter, sleep


def check_status(url):
    sleep(0.2)  # simulate an HTTP request
    return url, 200


urls = [f"https://example.com/page{i}" for i in range(1, 6)]

start = perf_counter()
with ThreadPoolExecutor(max_workers=5) as executor:
    for url, status in executor.map(check_status, urls):
        print(url, status)
print(f"It took {perf_counter() - start:.2f} s")
```

Output (timing varies slightly):

```text
https://example.com/page1 200
https://example.com/page2 200
https://example.com/page3 200
https://example.com/page4 200
https://example.com/page5 200
It took 0.21 s
```

### Exercise 2

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import sleep


def to_int(text):
    sleep(0.05)
    return int(text)


inputs = ["10", "x", "25", "3.5", "-4"]
ok = {}
errors = {}

with ThreadPoolExecutor() as executor:
    future_to_text = {executor.submit(to_int, text): text for text in inputs}
    for future in as_completed(future_to_text):
        text = future_to_text[future]
        error = future.exception()
        if error is None:
            ok[text] = future.result()
        else:
            errors[text] = type(error).__name__

print("ok:", dict(sorted(ok.items())))
print("errors:", dict(sorted(errors.items())))
```

Output:

```text
ok: {'-4': -4, '10': 10, '25': 25}
errors: {'3.5': 'ValueError', 'x': 'ValueError'}
```

`future.exception()` lets you check for an error without a `try` block. Only the main thread writes to `ok` and `errors`, so no lock is needed. Sorting makes the output independent of the completion order. Note that `"-4"` sorts before `"10"` because the keys are strings.

### Exercise 3

```python
from concurrent.futures import ThreadPoolExecutor
from time import perf_counter, sleep


def call_service(name, delay):
    sleep(delay)
    return f"{name}: OK"


services = {"auth": 0.05, "billing": 0.1, "reports": 0.5}

start = perf_counter()
with ThreadPoolExecutor() as executor:
    futures = {
        name: executor.submit(call_service, name, delay)
        for name, delay in services.items()
    }
    for name, future in futures.items():
        try:
            print(future.result(timeout=0.2))
        except TimeoutError:
            print(f"{name}: timed out at {perf_counter() - start:.1f} s")

print(f"Left the with block at {perf_counter() - start:.1f} s")
```

Output (timings vary slightly):

```text
auth: OK
billing: OK
reports: timed out at 0.3 s
Left the with block at 0.5 s
```

- The timeout counts from the moment `result()` is called, not from `submit()`. The `reports` wait started at about 0.1 seconds, so it timed out at about 0.3.
- The timeout did not stop the task. Leaving the `with` block waited until `reports` finished at 0.5 seconds.
- Since Python 3.11, `concurrent.futures.TimeoutError` is the built-in `TimeoutError`, so you can catch it directly.

### Exercise 4

```python
import threading
from concurrent.futures import ThreadPoolExecutor
from time import sleep

local = threading.local()  # every thread sees its own attributes
opened = []


def open_connection():
    # runs once in each worker thread, before its first task
    local.conn = f"connection<{threading.current_thread().name}>"
    opened.append(local.conn)


def query(n):
    sleep(0.1)  # simulate a database query
    return f"query {n} used {local.conn}"


with ThreadPoolExecutor(
    max_workers=3, thread_name_prefix="db", initializer=open_connection
) as executor:
    results = list(executor.map(query, range(1, 10)))

for line in results:
    print(line)
print("connections opened:", sorted(opened))
```

Output (which query uses which connection may vary):

```text
query 1 used connection<db_0>
query 2 used connection<db_1>
query 3 used connection<db_2>
query 4 used connection<db_0>
query 5 used connection<db_1>
query 6 used connection<db_2>
query 7 used connection<db_2>
query 8 used connection<db_0>
query 9 used connection<db_1>
connections opened: ['connection<db_0>', 'connection<db_1>', 'connection<db_2>']
```

`threading.local()` creates an object whose attributes are separate for every thread: `local.conn` set in `db_0` is invisible in `db_1`. The initializer runs once per worker, so 9 queries share 3 connections. `list.append()` is a single, thread-safe operation, which is why `opened` needs no lock here.

---

*Source: [pythontutorial.net — Python ThreadPoolExecutor](https://www.pythontutorial.net/advanced-python/python-threadpoolexecutor/). Adapted and expanded for PyJourney.*
