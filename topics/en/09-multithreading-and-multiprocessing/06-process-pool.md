# Process Pool

Creating a `Process` for every task, as in the topic Multiprocessing, quickly becomes a problem: every process costs a fresh interpreter, nothing limits how many run at once, and results have to be sent back by hand. A **process pool** starts a fixed number of worker processes once, reuses them for all tasks, and returns results and exceptions to you. In Python it is `concurrent.futures.ProcessPoolExecutor`.

## What you'll learn

- Why a process pool beats creating processes by hand
- What `ProcessPoolExecutor` shares with `ThreadPoolExecutor`, and what is different
- How to run CPU-bound tasks with `submit()` and `map()`, and why `chunksize` matters
- How results and exceptions travel back from worker processes
- How to set up workers with `initializer` and what `BrokenProcessPool` means
- How to shut a pool down, cancel tasks and stop stuck workers
- When to use a process pool, a thread pool or `multiprocessing.Pool`

## Why a process pool?

Starting a process is roughly a hundred times more expensive than starting a thread (the topic Processes and Threads measures it). Creating one process per task has three problems:

- **Start-up cost for every task.** For thousands of short tasks, launching interpreters takes longer than the work.
- **No limit.** One process per image for 5,000 images means 5,000 interpreters competing for, say, 8 cores, and a lot of memory.
- **Manual plumbing.** `Process` discards return values and does not pass exceptions to the parent, so you need queues and exit-code checks.

A process pool solves all three. It starts a fixed number of **worker processes** (by default, one per CPU) and keeps them alive. Each task is **pickled**, sent to a free worker, executed there, and its result (or exception) is pickled and sent back into a `Future` in the main process.

```text
 main process                                  worker processes
+---------------------------+                 +----------------------+
| submit(fn, x) -> Future   |  pickled task   |  worker 1: fn(x)     |
|                           | --------------> |  worker 2: fn(y)     |
| future.result()  <--------+---------------- |  worker 3: idle      |
|                           | pickled result  |  ... (max_workers)   |
+---------------------------+                 +----------------------+
```

## `ProcessPoolExecutor` at a glance

`ProcessPoolExecutor`, like `ThreadPoolExecutor`, is a subclass of `concurrent.futures.Executor`. The interface is the same, so everything from the topic Thread Pool carries over:

| Method | What it does |
|---|---|
| `submit(fn, *args, **kwargs)` | Schedules one call and immediately returns a `Future` |
| `map(fn, *iterables, timeout=None, chunksize=1, buffersize=None)` | Calls `fn` for every item and yields the results **in input order** |
| `shutdown(wait=True, cancel_futures=False)` | Stops accepting tasks and releases the workers. A `with` block calls it for you |

The `Future` objects are the same too. The two methods you use most:

- `result(timeout=None)` waits for the task and returns its value, or **re-raises** the exception that happened in the worker;
- `exception(timeout=None)` waits and returns the exception object, or `None` if the task succeeded.

`done()`, `cancel()`, `as_completed()` and `wait()` work exactly as described in the topic Thread Pool.

The constructor parameters:

| Parameter | Meaning |
|---|---|
| `max_workers` | Number of worker processes. Default: `os.process_cpu_count()` (Python 3.13+; earlier `os.cpu_count()`). On Windows at most 61 |
| `mp_context` | A `multiprocessing` context that chooses the start method, e.g. `multiprocessing.get_context("spawn")` |
| `initializer`, `initargs` | A function (and its arguments) that runs once in every worker process when it starts |
| `max_tasks_per_child` | (Python 3.11+) Replace a worker after it has run this many tasks. Useful against memory leaks in third-party code |

> **Note:** In testing with Python 3.14.0 on macOS, a pool with `max_tasks_per_child` greater than 1 hung as soon as a worker had to be replaced. This is a CPython bug, not something in your code. If you need worker recycling, check it on your Python version, or use `multiprocessing.Pool(maxtasksperchild=...)`.

What is different from a thread pool:

- Tasks run in **other processes**, so the function, its arguments and its return value must be **picklable**.
- The code that creates the pool must be under `if __name__ == "__main__":`, for the same reason as with `Process` (the topic Multiprocessing explains the start methods).
- Workers do not share memory with the main process or with each other.
- Python 3.14 added `terminate_workers()` and `kill_workers()`: unlike threads, worker processes can be stopped from outside.

## CPU-bound work: threads vs. processes

Here is a CPU-bound function, run eight times sequentially, in a thread pool and in a process pool:

```python
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor


def sum_of_squares(n):
    return sum(i * i for i in range(n))


NUMBERS = [5_000_000] * 8


def run(executor_class):
    with executor_class(max_workers=8) as executor:
        return list(executor.map(sum_of_squares, NUMBERS))


if __name__ == "__main__":
    start = time.perf_counter()
    expected = [sum_of_squares(n) for n in NUMBERS]
    print(f"sequential:          {time.perf_counter() - start:.2f} s")

    for executor_class in (ThreadPoolExecutor, ProcessPoolExecutor):
        start = time.perf_counter()
        results = run(executor_class)
        elapsed = time.perf_counter() - start
        print(f"{executor_class.__name__:<20} {elapsed:.2f} s, same results: {results == expected}")
```

Output (timings vary; standard CPython with the GIL on a 10-core machine):

```text
sequential:          1.06 s
ThreadPoolExecutor   1.04 s, same results: True
ProcessPoolExecutor  0.33 s, same results: True
```

The thread pool gained nothing: under the GIL the eight threads took turns. The process pool ran the tasks on eight cores. It was about three times faster rather than eight times, because starting the workers and moving data between processes costs time too. Note that switching between the two kinds of pool required changing **one class name**: that is the point of the common `Executor` interface.

## Submitting tasks and reusing workers

`submit()` returns a `Future` at once. The pool keeps its workers and hands them task after task:

```python
import os
import time
from concurrent.futures import ProcessPoolExecutor


def square(n):
    time.sleep(0.1)  # pretend this is real work
    return n, n * n, os.getpid()


if __name__ == "__main__":
    print("main process PID:", os.getpid())
    with ProcessPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(square, n) for n in range(1, 7)]
        results = [f.result() for f in futures]

    for n, sq, pid in results:
        print(f"{n} squared is {sq:>2}, computed in PID {pid}")
    print("distinct worker PIDs:", len({pid for *_, pid in results}))
```

Output (the PIDs, and which worker gets which task, vary):

```text
main process PID: 58386
1 squared is  1, computed in PID 58388
2 squared is  4, computed in PID 58389
3 squared is  9, computed in PID 58388
4 squared is 16, computed in PID 58389
5 squared is 25, computed in PID 58388
6 squared is 36, computed in PID 58389
distinct worker PIDs: 2
```

Six tasks, but only two processes were ever started, and neither is the main process. The results come back in the order of the `futures` list, because `f.result()` was called on each future in turn. For results in completion order, use `as_completed()` (see Exercise 2).

## `map()` and `chunksize`

With a process pool, every task travels between processes: the arguments are pickled and sent to a worker, the result is pickled and sent back. For heavy tasks this overhead does not matter. For **tiny** tasks it dominates everything. That is what the `chunksize` argument of `map()` is for: it sends items to the workers in batches instead of one by one.

```python
import time
from concurrent.futures import ProcessPoolExecutor


def square(n):
    return n * n


if __name__ == "__main__":
    numbers = range(20_000)

    start = time.perf_counter()
    expected = [square(n) for n in numbers]
    print(f"sequential:      {time.perf_counter() - start:.3f} s")

    with ProcessPoolExecutor() as executor:
        for chunksize in (1, 1_000):
            start = time.perf_counter()
            results = list(executor.map(square, numbers, chunksize=chunksize))
            elapsed = time.perf_counter() - start
            print(f"chunksize={chunksize:<6} {elapsed:.3f} s, correct: {results == expected}")
```

Output (timings vary):

```text
sequential:      0.001 s
chunksize=1      1.244 s, correct: True
chunksize=1000   0.003 s, correct: True
```

- With `chunksize=1` (the default), 20,000 separate round trips between processes made the pool about a thousand times **slower** than a plain loop. The first run also pays for starting the workers, but that is only tens of milliseconds.
- With `chunksize=1000`, the same work needed only 20 round trips.
- Even then, the sequential loop wins: squaring a number is far too cheap to be worth sending anywhere.

Rules of thumb:

- Use a process pool only when each task does a meaningful amount of work (milliseconds or more).
- When you `map()` over many small items, pass a `chunksize`. Something like `len(items) // (4 * workers)` is a reasonable start.
- `chunksize` only affects `ProcessPoolExecutor`. A thread pool ignores it.
- `buffersize` (Python 3.14+) limits how many tasks are submitted ahead of the results you have consumed, which matters for huge or endless input iterables.

## Exceptions from worker processes

An exception raised in a worker is pickled, sent back and stored in the future. `result()` re-raises it in the main process, and `exception()` returns it:

```python
from concurrent.futures import ProcessPoolExecutor


def parse_price(text):
    return float(text)


if __name__ == "__main__":
    with ProcessPoolExecutor() as executor:
        good = executor.submit(parse_price, "19.99")
        bad = executor.submit(parse_price, "free")

        print(good.result())
        print(repr(bad.exception()))
        bad.result()
```

Output (paths shortened):

```text
19.99
ValueError("could not convert string to float: 'free'")
concurrent.futures.process._RemoteTraceback:
"""
Traceback (most recent call last):
  File ".../concurrent/futures/process.py", line 254, in _process_worker
    r = call_item.fn(*call_item.args, **call_item.kwargs)
  File "/path/to/app.py", line 5, in parse_price
    return float(text)
ValueError: could not convert string to float: 'free'
"""

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/path/to/app.py", line 15, in <module>
    bad.result()
    ~~~~~~~~~~^^
  ...
ValueError: could not convert string to float: 'free'
```

A traceback cannot be pickled, so the worker converts it to text and attaches it as the **cause** of the exception (`_RemoteTraceback`). That is why you see two tracebacks: the upper one shows where the error happened inside the worker, the lower one shows where `result()` re-raised it in the main process. Catch the exception as usual with `try`/`except ValueError`.

## Everything crosses a process boundary

### Functions, arguments and results must be picklable

The pool sends the function **by name** and its arguments and result **by value**. Lambdas and functions defined inside other functions have no importable name, and some objects, such as generators, open files and locks, cannot be pickled at all:

```python
from concurrent.futures import ProcessPoolExecutor


def make_counter(n):
    return (i for i in range(n))  # a generator cannot be pickled


if __name__ == "__main__":
    with ProcessPoolExecutor() as executor:
        for future in (
            executor.submit(lambda x: x * 2, 21),
            executor.submit(make_counter, 3),
        ):
            try:
                print(future.result())
            except Exception as exc:
                print(f"{type(exc).__name__}: {exc}")
```

Output (the address varies):

```text
PicklingError: Can't pickle <function <lambda> at 0x102f68510>: it's not found as __main__.<lambda>
TypeError: cannot pickle 'generator' object
```

The lambda could not be sent to a worker. `make_counter()` did run, but its result could not be sent back. In both cases the error arrives through the future, just like an exception raised by the task. Return plain data such as numbers, strings, lists, dicts and tuples, and use `functools.partial` instead of a lambda when you need to fix some arguments.

Pickling also costs time. Passing a list of a million items to each of 100 tasks copies it 100 times. Send each task only the slice of data it needs, or load the data once per worker with an initializer.

### Per-worker setup with `initializer`

Worker processes do not share globals with the main process, but each worker can have **its own** globals. An `initializer` runs once in every worker process when it starts, which is the right place for expensive setup: loading a model, opening a database connection, reading a lookup table:

```python
import os
from concurrent.futures import ProcessPoolExecutor

vocabulary = None  # every worker process gets its own copy of this global


def load_vocabulary(words):
    global vocabulary
    vocabulary = set(words)  # imagine a slow step, such as reading a big file
    print(f"worker {os.getpid()}: vocabulary loaded")


def check(word):
    return word, word in vocabulary


if __name__ == "__main__":
    words = ["apple", "banana", "cherry", "plum"]
    with ProcessPoolExecutor(
        max_workers=2, initializer=load_vocabulary, initargs=(words,)
    ) as executor:
        for word, known in executor.map(check, ["apple", "kiwi", "plum", "fig"]):
            print(f"{word}: {'known' if known else 'unknown'}")

    print("vocabulary in the main process:", vocabulary)
```

Output (the PIDs and the order of the first two lines vary):

```text
worker 58817: vocabulary loaded
worker 58818: vocabulary loaded
apple: known
kiwi: unknown
plum: known
fig: unknown
vocabulary in the main process: None
```

The vocabulary was loaded once per worker, not once per task. The main process's global stays `None`, because the assignment happened in other processes. If the initializer raises an exception, the pool becomes broken (see the next section).

## When a worker dies: `BrokenProcessPool`

An ordinary exception in a task is harmless for the pool. But if a worker process **dies** (it crashes in C code, the OS kills it for using too much memory, or it calls `os._exit()`), the pool cannot know which state it left behind. It marks itself as **broken**: every pending future fails with `BrokenProcessPool`, and no new tasks are accepted.

```python
import os
import time
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool


def crash():
    os._exit(1)  # the worker process dies at once, like after a segfault


def slow_square(n):
    time.sleep(0.2)
    return n * n


if __name__ == "__main__":
    with ProcessPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(slow_square, n) for n in range(3)]
        futures.append(executor.submit(crash))

        for future in futures:
            try:
                print("result:", future.result())
            except BrokenProcessPool as exc:
                print("BrokenProcessPool:", exc)

        try:
            executor.submit(slow_square, 10)
        except BrokenProcessPool as exc:
            print("cannot submit:", exc)
```

Output (exactly which tasks still finish may vary):

```text
result: 0
result: 1
BrokenProcessPool: A process in the process pool was terminated abruptly while the future was running or pending.
BrokenProcessPool: A process in the process pool was terminated abruptly while the future was running or pending.
cannot submit: A child process terminated abruptly, the process pool is not usable anymore
```

`slow_square(2)` did nothing wrong, but it was still unfinished when the other worker died, so it failed too. A broken pool cannot be repaired: create a new one. If crashes are expected (for example, in a buggy C library), run the risky work in a separate pool and be ready to retry.

## Shutting down, cancelling and stopping workers

`shutdown()` works as in a thread pool. `shutdown(wait=True)`, or leaving a `with` block, waits for all submitted tasks, and `cancel_futures=True` cancels the tasks that have not started yet:

```python
import time
from concurrent.futures import ProcessPoolExecutor


def job(n):
    time.sleep(0.3)
    return n


if __name__ == "__main__":
    executor = ProcessPoolExecutor(max_workers=2)
    futures = [executor.submit(job, n) for n in range(8)]
    time.sleep(0.1)
    executor.shutdown(wait=True, cancel_futures=True)
    print([f.cancelled() for f in futures])
```

Output:

```text
[False, False, False, True, True, True, True, True]
```

Two workers, yet **three** tasks were not cancelled. A process pool moves one extra task into an internal queue ahead of time, so the workers never wait for data. A task in that queue counts as running and can no longer be cancelled. With `max_workers=N`, expect up to `N + 1` tasks to run even after cancelling.

Running tasks always finish before `shutdown(wait=True)` returns, which is a problem when a task hangs. Since Python 3.14, a process pool can stop its workers from outside:

- `executor.terminate_workers()` sends SIGTERM to every worker (`Process.terminate()`) and shuts the pool down;
- `executor.kill_workers()` does the same with SIGKILL.

The futures of the tasks that were running then fail with `BrokenProcessPool`. Exercise 3 uses this to enforce a deadline. A thread pool has no equivalent, because threads cannot be stopped from outside.

## A practical example: creating thumbnails

The topic Multiprocessing created thumbnails with one `Process` per image. With a pool the code becomes shorter and scales to any number of files. It uses Pillow (`pip install Pillow` in a virtual environment) and the five large test images from that topic:

```python
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image, ImageFilter

filenames = [
    "images/1.jpg",
    "images/2.jpg",
    "images/3.jpg",
    "images/4.jpg",
    "images/5.jpg",
]


def create_thumbnail(filename, size=(50, 50), thumb_dir="thumbs"):
    with Image.open(filename) as img:
        blurred = img.filter(ImageFilter.GaussianBlur())
    blurred.thumbnail(size)
    blurred.save(Path(thumb_dir) / Path(filename).name)
    return f"{filename} was processed..."  # return, do not print


def main():
    Path("thumbs").mkdir(exist_ok=True)
    start = time.perf_counter()

    with ProcessPoolExecutor() as executor:
        for message in executor.map(create_thumbnail, filenames):
            print(message)

    finish = time.perf_counter()
    print(f"It took {finish - start:.2f} second(s) to finish")


if __name__ == "__main__":
    main()
```

Output (timing varies):

```text
images/1.jpg was processed...
images/2.jpg was processed...
images/3.jpg was processed...
images/4.jpg was processed...
images/5.jpg was processed...
It took 0.35 second(s) to finish
```

How it works:

1. `ProcessPoolExecutor()` starts up to `os.process_cpu_count()` workers. With 50,000 images there would still be only that many processes.
2. `executor.map(create_thumbnail, filenames)` sends one file name to each task and calls `create_thumbnail(filename)` in a worker. The other parameters keep their default values.
3. The worker **returns** a message, and the main process prints it. Results arrive in input order, so the output is always 1 to 5, unlike the `Process` version.
4. The `for` loop **consumes** the results. If any image fails, for example because the file does not exist, the exception is re-raised right here instead of disappearing (see Common mistakes).

## `multiprocessing.Pool`

The `multiprocessing` module has its own, older pool class. You will meet it in existing code:

```python
import multiprocessing


def square(n):
    return n * n


def add(a, b):
    return a + b


if __name__ == "__main__":
    with multiprocessing.Pool(processes=4) as pool:
        print(pool.map(square, range(10)))
        print(pool.starmap(add, [(1, 2), (3, 4)]))
        print(sorted(pool.imap_unordered(square, range(5))))
```

Output:

```text
[0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
[3, 7]
[0, 1, 4, 9, 16]
```

It offers a few extras, such as `starmap()` for argument tuples, the lazy `imap()` / `imap_unordered()` and `maxtasksperchild`. One trap: leaving a `with multiprocessing.Pool()` block calls `terminate()`, **not** a graceful shutdown. Unfinished asynchronous work is killed:

```python
import multiprocessing
import time


def slow_square(n):
    time.sleep(0.5)
    print("finished", n)
    return n * n


if __name__ == "__main__":
    with multiprocessing.Pool(processes=2) as pool:
        async_result = pool.map_async(slow_square, [1, 2])
    print("left the with block")
    print("ready:", async_result.ready())
```

Output:

```text
left the with block
ready: False
```

`"finished"` was never printed: the workers were terminated in the middle of the work. Call `async_result.get()` inside the block, or `pool.close()` and `pool.join()` before leaving it. For new code, `ProcessPoolExecutor` is usually the better choice: it waits for tasks on exit, re-raises exceptions through futures, and shares its interface with `ThreadPoolExecutor`.

## Choosing an executor

| Situation | Use |
|---|---|
| I/O-bound work (network, disk, databases) | `ThreadPoolExecutor` or `asyncio` |
| CPU-bound pure-Python work | `ProcessPoolExecutor` |
| CPU-bound work inside a C library that releases the GIL (`hashlib`, `zlib`, NumPy) | Often `ThreadPoolExecutor` is enough, and it has no start-up or pickling cost (see Exercise 4) |
| Many tiny tasks | A plain loop, or a process pool with a large `chunksize` |
| CPU-bound work, experimental | `InterpreterPoolExecutor` (Python 3.14+): workers are threads, each running its own interpreter with its own GIL in one process. Not every extension module supports it yet |

## Common mistakes

- **Not consuming the results of `map()`.** Exceptions are stored in futures. If nobody reads them, failures vanish silently. This version never reads the results, and one file does not exist:

  ```python
  from concurrent.futures import ProcessPoolExecutor
  from pathlib import Path

  from PIL import Image, ImageFilter

  filenames = ["images/1.jpg", "images/missing.jpg", "images/3.jpg"]


  def create_thumbnail(filename, size=(50, 50), thumb_dir="thumbs"):
      with Image.open(filename) as img:
          blurred = img.filter(ImageFilter.GaussianBlur())
      blurred.thumbnail(size)
      blurred.save(Path(thumb_dir) / Path(filename).name)
      print(f"{filename} was processed...")


  if __name__ == "__main__":
      Path("thumbs").mkdir(exist_ok=True)
      with ProcessPoolExecutor() as executor:
          executor.map(create_thumbnail, filenames)  # results are never read
      print("Done, no errors reported")
  ```

  Output (the order of the first two lines may vary):

  ```text
  images/1.jpg was processed...
  images/3.jpg was processed...
  Done, no errors reported
  ```

  The `FileNotFoundError` for `missing.jpg` was raised, stored and never seen. Always iterate over the results of `map()` or call `result()` on every future.
- **Forgetting `if __name__ == "__main__":`.** Workers started with `spawn` or `forkserver` import your main module. Unguarded pool creation fails.
- **Submitting lambdas, nested functions or unpicklable objects.** Define worker functions at the top level of a module, and return plain data.
- **Using a process pool for tiny tasks without `chunksize`.** The per-task overhead can make the program hundreds of times slower than a loop.
- **Sending big data with every task.** Each argument is pickled and copied. Split the data, or load it once per worker with `initializer`.
- **Using a process pool for I/O-bound work.** Waiting does not need extra cores. Threads are cheaper.
- **Expecting workers to change the main process's globals.** Each worker has its own memory. Return results instead.
- **Expecting `result(timeout=...)` or `cancel()` to stop a running task.** A timeout only stops waiting, and running tasks cannot be cancelled. Since Python 3.14, `terminate_workers()` stops them by force.
- **Leaving a `with multiprocessing.Pool()` block before the work is done.** Its exit calls `terminate()` and kills unfinished tasks.

## Summary

- A process pool keeps a fixed set of reusable worker processes. `concurrent.futures.ProcessPoolExecutor` provides one with the same `submit()` / `map()` / `shutdown()` interface as `ThreadPoolExecutor`.
- Use it for CPU-bound Python code: each worker has its own interpreter and GIL, so tasks run on several cores. The default number of workers is `os.process_cpu_count()`.
- Functions must be defined at module level, arguments and results must be picklable, and the pool must be created under `if __name__ == "__main__":`.
- Every task costs a round trip between processes. Make tasks big enough, and pass `chunksize` to `map()` for many small items.
- Exceptions from workers are re-raised by `result()` together with the worker's traceback. Always consume results.
- `initializer` runs once per worker and is the place for expensive per-process setup.
- If a worker process dies, the pool becomes broken (`BrokenProcessPool`) and must be replaced.
- Since Python 3.14, `terminate_workers()` and `kill_workers()` can stop stuck workers.

## Practice

### Exercise 1: Primes in parallel

Write `is_prime(n)` that checks odd divisors up to `math.isqrt(n)`. Check the numbers below with `ProcessPoolExecutor.map()`, print each number with the result in the original order, and compare the time with a sequential list comprehension. Verify that both give the same results.

```python
NUMBERS = [
    112272535095293,
    112582705942171,
    112272535095293,
    115280095190773,
    115797848077099,
    1099726899285419,
]
```

### Exercise 2: Progress with `as_completed()`

The Collatz rule turns `n` into `n // 2` if it is even and into `3 * n + 1` if it is odd, until `n` reaches 1. Find the starting number below 300,000 with the longest chain (the most steps). Split the range `[1, 300000)` into 8 chunks, submit one task per chunk that returns `(steps, number)` for the best number in its chunk, and use `as_completed()` to print `chunk k/8 done: [lo, hi)` as each chunk finishes. Then print the overall winner and the total time.

### Exercise 3: A deadline for a batch

Four jobs keep a core busy for different times:

```python
jobs = {"report": 0.2, "backup": 0.4, "stats": 5.0, "cleanup": 0.3}
```

Run them in a process pool with 4 workers. After 1 second, print the result of every job that finished, and `"<name>: missed the deadline"` for the others. Make sure the program really ends after about 1 second rather than 5. Requires Python 3.14+.

### Exercise 4: Threads or processes? Measure it

Compare a sequential loop, `ThreadPoolExecutor(max_workers=8)` and `ProcessPoolExecutor(max_workers=8)` for two CPU-bound functions, each called for 8 inputs:

- `hash_password(password)`, which returns the first 12 hex digits of `hashlib.pbkdf2_hmac("sha256", password.encode(), b"salt", 300_000)`;
- `python_loop(seed)`, which adds up `(i * len(seed)) % 7` for `i` in `range(3_000_000)` in a plain Python loop.

Check that all three approaches give the same results, and explain the timings.

## Solutions

### Exercise 1

```python
import math
import time
from concurrent.futures import ProcessPoolExecutor

NUMBERS = [
    112272535095293,
    112582705942171,
    112272535095293,
    115280095190773,
    115797848077099,
    1099726899285419,
]


def is_prime(n):
    if n < 2:
        return False
    if n % 2 == 0:
        return n == 2
    for divisor in range(3, math.isqrt(n) + 1, 2):
        if n % divisor == 0:
            return False
    return True


if __name__ == "__main__":
    start = time.perf_counter()
    expected = [is_prime(n) for n in NUMBERS]
    print(f"sequential: {time.perf_counter() - start:.2f} s")

    start = time.perf_counter()
    with ProcessPoolExecutor() as executor:
        results = list(executor.map(is_prime, NUMBERS))
    print(f"pool:       {time.perf_counter() - start:.2f} s")

    for n, prime in zip(NUMBERS, results):
        print(f"{n} is prime: {prime}")
    print("same as sequential:", results == expected)
```

Output (timings vary):

```text
sequential: 0.41 s
pool:       0.17 s
112272535095293 is prime: True
112582705942171 is prime: True
112272535095293 is prime: True
115280095190773 is prime: True
115797848077099 is prime: True
1099726899285419 is prime: False
same as sequential: True
```

Each check takes tens of milliseconds, which is plenty of work per task, so the default `chunksize=1` is fine. The pool cannot be faster than its slowest single task plus the start-up of the workers, which is why six tasks on ten cores give about 2.4 times, not six times, the speed.

### Exercise 2

```python
import time
from concurrent.futures import ProcessPoolExecutor, as_completed

LIMIT = 300_000
CHUNKS = 8


def collatz_steps(n):
    steps = 0
    while n != 1:
        n = n // 2 if n % 2 == 0 else 3 * n + 1
        steps += 1
    return steps


def longest_in_range(start, stop):
    """Return (steps, number) for the longest chain that starts in [start, stop)."""
    return max((collatz_steps(n), n) for n in range(start, stop))


if __name__ == "__main__":
    size = -(-(LIMIT - 1) // CHUNKS)  # ceiling division
    bounds = [(s, min(s + size, LIMIT)) for s in range(1, LIMIT, size)]

    start = time.perf_counter()
    with ProcessPoolExecutor() as executor:
        future_to_bounds = {
            executor.submit(longest_in_range, lo, hi): (lo, hi) for lo, hi in bounds
        }
        best = (0, 1)
        for done_count, future in enumerate(as_completed(future_to_bounds), 1):
            lo, hi = future_to_bounds[future]
            best = max(best, future.result())
            print(f"chunk {done_count}/{len(bounds)} done: [{lo}, {hi})")

    steps, number = best
    print(f"longest chain below {LIMIT}: {number} ({steps} steps)")
    print(f"took {time.perf_counter() - start:.2f} s")
```

Output (the order of the chunks and the time vary):

```text
chunk 1/8 done: [1, 37501)
chunk 2/8 done: [150001, 187501)
chunk 3/8 done: [37501, 75001)
chunk 4/8 done: [75001, 112501)
chunk 5/8 done: [112501, 150001)
chunk 6/8 done: [187501, 225001)
chunk 7/8 done: [225001, 262501)
chunk 8/8 done: [262501, 300000)
longest chain below 300000: 230631 (442 steps)
took 0.34 s
```

The sequential search takes about 1.3 seconds on the same machine. Tuples compare element by element, so `max()` over `(steps, number)` pairs picks the longest chain. The dictionary `future_to_bounds` tells you which chunk each finished future belongs to.

### Exercise 3

```python
import time
from concurrent.futures import ProcessPoolExecutor, wait


def busy(seconds):
    """Keep one core busy for about `seconds` seconds."""
    end = time.perf_counter() + seconds
    while time.perf_counter() < end:
        pass
    return f"{seconds} s of work"


jobs = {"report": 0.2, "backup": 0.4, "stats": 5.0, "cleanup": 0.3}

if __name__ == "__main__":
    start = time.perf_counter()
    executor = ProcessPoolExecutor(max_workers=4)
    future_to_name = {executor.submit(busy, sec): name for name, sec in jobs.items()}

    done, not_done = wait(future_to_name, timeout=1)

    for future, name in future_to_name.items():
        if future in done:
            print(f"{name}: {future.result()}")
        else:
            print(f"{name}: missed the deadline")

    executor.terminate_workers()  # Python 3.14+: stop the stuck worker
    print(f"total: {time.perf_counter() - start:.1f} s")
```

Output (the time varies slightly):

```text
report: 0.2 s of work
backup: 0.4 s of work
stats: missed the deadline
cleanup: 0.3 s of work
total: 1.0 s
```

`wait(..., timeout=1)` returns after one second with the sets of finished and unfinished futures. A `with` block is deliberately not used: leaving it would wait the full 5 seconds for `stats`. Without `terminate_workers()` the script would still print `total: 1.0 s`, but the interpreter would then wait for the running worker at exit, and the program would end after about 5 seconds. `terminate_workers()` stops the worker, and the `stats` future fails with `BrokenProcessPool`.

### Exercise 4

```python
import hashlib
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

PASSWORDS = [f"password{i}" for i in range(8)]


def hash_password(password):
    # C code inside hashlib does the heavy lifting
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), b"salt", 300_000)
    return digest.hex()[:12]


def python_loop(seed):
    # pure Python: the interpreter does the heavy lifting
    total = 0
    for i in range(3_000_000):
        total += (i * len(seed)) % 7
    return total


def measure(label, func, executor_class=None):
    start = time.perf_counter()
    if executor_class is None:
        results = [func(p) for p in PASSWORDS]
    else:
        with executor_class(max_workers=8) as executor:
            results = list(executor.map(func, PASSWORDS))
    print(f"{label:<28} {time.perf_counter() - start:.2f} s")
    return results


if __name__ == "__main__":
    for func in (hash_password, python_loop):
        print(f"--- {func.__name__}")
        expected = measure("sequential", func)
        assert measure("ThreadPoolExecutor", func, ThreadPoolExecutor) == expected
        assert measure("ProcessPoolExecutor", func, ProcessPoolExecutor) == expected
```

Output (timings vary; standard CPython with the GIL):

```text
--- hash_password
sequential                   0.35 s
ThreadPoolExecutor           0.08 s
ProcessPoolExecutor          0.16 s
--- python_loop
sequential                   0.59 s
ThreadPoolExecutor           0.57 s
ProcessPoolExecutor          0.20 s
```

- `pbkdf2_hmac()` runs in C and **releases the GIL** while it computes, so eight threads really run on eight cores. Threads even beat processes here: they start in microseconds and need no pickling.
- `python_loop()` executes Python bytecode, which needs the GIL. The threads took turns, and only the process pool gave a real speed-up.
- Both tasks are CPU-bound, yet the best tool differs. When in doubt, measure.

---

*Source: [pythontutorial.net — Python ProcessPoolExecutor](https://www.pythontutorial.net/python-concurrency/python-processpoolexecutor/). Adapted and expanded for PyJourney.*
