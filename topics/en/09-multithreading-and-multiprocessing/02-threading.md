# Threading

The `threading` module lets one Python process run several **threads**, so that while one task waits (for a server, a disk or a timer) another can make progress. Used well, it turns a program that waits for things one after another into one that waits for them all at once.

## What you'll learn

- Why a single-threaded program wastes time on I/O waits
- How to create, start and wait for threads with `threading.Thread`, `start()` and `join()`
- How to pass arguments to a thread, name it and get results back from it
- What happens to exceptions raised inside threads, and what daemon threads are
- How to stop a thread cleanly with `threading.Event`
- When threads speed a program up and when they do not

## A single-threaded program

Start with a function that pretends to wait for a server for half a second:

```python
from time import perf_counter, sleep


def task():
    print("Starting a task...")
    sleep(0.5)  # pretend to wait for a server
    print("done")


start_time = perf_counter()

task()
task()

end_time = perf_counter()
print(f"It took {end_time - start_time:0.2f} second(s) to complete.")
```

Output (timing varies slightly):

```text
Starting a task...
done
Starting a task...
done
It took 1.01 second(s) to complete.
```

`perf_counter()` returns a high-resolution clock value, so the difference between two calls measures elapsed time. Two calls of half a second each take about one second. Ten calls would take five.

```text
main thread: [task 1: wait 0.5 s][task 2: wait 0.5 s]   -> ~1.0 s
```

While `sleep()` runs, the CPU does nothing for this program. The program has one process with a single thread, the **main thread**, so it is a **single-threaded** program, and the main thread cannot start the second task until the first one is finished.

## Creating threads with `threading.Thread`

To run the two tasks concurrently, create a `Thread` object for each one:

```python
from threading import Thread
from time import perf_counter, sleep


def task():
    print("Starting a task...")
    sleep(0.5)
    print("done")


start_time = perf_counter()

# create two new threads
t1 = Thread(target=task)
t2 = Thread(target=task)

# start the threads
t1.start()
t2.start()

# wait for the threads to complete
t1.join()
t2.join()

end_time = perf_counter()
print(f"It took {end_time - start_time:0.2f} second(s) to complete.")
```

Output (timing varies slightly):

```text
Starting a task...
Starting a task...
done
done
It took 0.50 second(s) to complete.
```

The steps are always the same:

1. **Create** the thread: `Thread(target=task)`. `target` is the function to run. Pass the function itself, **without parentheses**.
2. **Start** it: `t1.start()`. Python creates an OS thread and calls `task()` in it. `start()` returns immediately, so the main thread continues with the next line.
3. **Wait** for it: `t1.join()` blocks the calling thread until `t1` has finished. Without `join()` the main thread would print the timing before the tasks are done.

While it runs, this program has three threads: the main thread and two child threads. Both sleeps overlap, so the total time is about one sleep:

```text
main thread: start t1, start t2, join ............ join -> print
thread t1:            [wait 0.5 s]
thread t2:              [wait 0.5 s]                       -> ~0.5 s
```

The most useful `Thread` parameters are:

| Parameter | Meaning |
|---|---|
| `target` | The function to run in the new thread |
| `args` | A **tuple** of positional arguments for `target` |
| `kwargs` | A dict of keyword arguments for `target` |
| `name` | A readable name (default: `Thread-N (function_name)`) |
| `daemon` | If `True`, the thread does not keep the program alive (see below) |

## Passing arguments to threads

`args` must be a tuple. For a single argument, do not forget the trailing comma: `args=(n,)`.

```python
from threading import Thread
from time import perf_counter, sleep


def task(task_id):
    print(f"Starting the task {task_id}...")
    sleep(0.5)
    print(f"The task {task_id} completed")


start_time = perf_counter()

# create and start 10 threads
threads = []
for n in range(1, 11):
    t = Thread(target=task, args=(n,))
    threads.append(t)
    t.start()

# wait for the threads to complete
for t in threads:
    t.join()

end_time = perf_counter()
print(f"It took {end_time - start_time:0.2f} second(s) to complete.")
```

Output (the completion order changes on every run):

```text
Starting the task 1...
Starting the task 2...
Starting the task 3...
Starting the task 4...
Starting the task 5...
Starting the task 6...
Starting the task 7...
Starting the task 8...
Starting the task 9...
Starting the task 10...
The task 6 completed
The task 4 completed
The task 8 completed
The task 7 completed
The task 9 completed
The task 10 completed
The task 5 completed
The task 2 completed
The task 1 completed
The task 3 completed
It took 0.51 second(s) to complete.
```

Ten half-second tasks finish in about half a second. Notice two things:

- The `threads` list keeps a reference to every thread so you can `join()` them all later.
- The tasks finish in an **unpredictable order**. The OS scheduler decides which thread runs when. Never write code that depends on threads finishing in the order you started them.

> **Tip:** Do not call `join()` inside the loop that starts the threads. `t.start(); t.join()` waits for each thread before starting the next one, which makes the program sequential again. Start everything first, then join everything.

The parameter is called `task_id` here, not `id` as in some tutorials, because `id` would shadow the built-in `id()` function.

### Keyword arguments, names and thread state

```python
import threading
import time


def greet(name, delay, punctuation="!"):
    time.sleep(delay)
    current = threading.current_thread()
    print(f"[{current.name}] Hello, {name}{punctuation}")


t1 = threading.Thread(target=greet, args=("Olena", 0.1))
t2 = threading.Thread(
    target=greet,
    args=("Max",),
    kwargs={"delay": 0.2, "punctuation": "?"},
    name="greeter-max",
)

print(t1.name, t2.name)
print("alive before start:", t1.is_alive())

t1.start()
t2.start()
print("alive after start:", t1.is_alive())

t1.join()
t2.join()
print("alive after join:", t1.is_alive())
print("main thread:", threading.current_thread().name)
```

Output:

```text
Thread-1 (greet) greeter-max
alive before start: False
alive after start: True
[Thread-1 (greet)] Hello, Olena!
[greeter-max] Hello, Max?
alive after join: False
main thread: MainThread
```

- `threading.current_thread()` returns the `Thread` object of the code that is running right now.
- Since Python 3.10 the default name includes the target function: `Thread-1 (greet)`. Custom names make logs and tracebacks much easier to read.
- `is_alive()` is `True` only between `start()` and the moment the target function returns.

## Getting results back from a thread

A thread **discards the return value** of its target function. A common pattern is to give each thread its own slot in a shared list (or a key in a dict) to write into:

```python
import threading
import time


def fetch_size(url, results, index):
    time.sleep(0.2)            # simulate a network request
    results[index] = len(url)  # each thread writes only to its own slot


urls = ["https://python.org", "https://pypi.org", "https://docs.python.org"]
results = [None] * len(urls)

threads = [
    threading.Thread(target=fetch_size, args=(url, results, i))
    for i, url in enumerate(urls)
]
for t in threads:
    t.start()
for t in threads:
    t.join()

print(results)
```

Output:

```text
[18, 16, 23]
```

This is safe because no two threads write to the same slot, and the main thread reads the list only after `join()`. When several threads update the **same** value, you need a lock (covered in the Threading Lock topic).

> **Note:** For "run a function, get its result" the `concurrent.futures.ThreadPoolExecutor` from the next topic is usually simpler: it returns results and re-raises exceptions for you.

### Subclassing `Thread`

You can also subclass `Thread` and override `run()`. `start()` calls `run()` in the new thread, and the object can store the result as an attribute:

```python
import threading
import time


class Downloader(threading.Thread):
    def __init__(self, url):
        super().__init__(name=f"dl-{url}")
        self.url = url
        self.size = None

    def run(self):
        # run() is executed in the new thread after start()
        time.sleep(0.1)
        self.size = len(self.url) * 100


workers = [Downloader(url) for url in ("a.com", "bb.com")]
for w in workers:
    w.start()
for w in workers:
    w.join()

for w in workers:
    print(w.name, w.size)
```

Output:

```text
dl-a.com 500
dl-bb.com 600
```

Always call `super().__init__()` in the subclass constructor, otherwise `start()` raises `RuntimeError: thread.__init__() not called`.

## Exceptions in threads

An exception that escapes the target function **ends only that thread**. It does not reach the thread that calls `join()`. By default Python prints the traceback to stderr and carries on:

```python
import threading


def parse(text):
    print("parsing", text)
    return int(text)


t = threading.Thread(target=parse, args=("abc",))
t.start()
t.join()
print("main thread keeps running")
```

Output (traceback shortened):

```text
parsing abc
Exception in thread Thread-1 (parse):
Traceback (most recent call last):
  ...
  File "app.py", line 6, in parse
    return int(text)
ValueError: invalid literal for int() with base 10: 'abc'
main thread keeps running
```

Errors like this are easy to miss. You can install your own handler with `threading.excepthook` (Python 3.8+), for example to log errors in one consistent format:

```python
import threading


def parse(text):
    return int(text)


def report_error(args):
    # args has exc_type, exc_value, exc_traceback and thread
    print(f"{args.thread.name} failed: {args.exc_type.__name__}: {args.exc_value}")


threading.excepthook = report_error

t = threading.Thread(target=parse, args=("abc",), name="parser")
t.start()
t.join()
print("main thread keeps running")
```

Output:

```text
parser failed: ValueError: invalid literal for int() with base 10: 'abc'
main thread keeps running
```

If the caller needs to *react* to the error, catch it inside the thread and store it (see Exercise 4), or use a thread pool, whose `Future.result()` re-raises the exception in the caller.

## Daemon threads

Normally Python waits for all non-daemon threads to finish before the program exits. A **daemon thread** (`daemon=True`) does not keep the program alive. When the main thread ends, daemon threads are stopped abruptly:

```python
import threading
import time


def heartbeat():
    while True:
        print("still alive")
        time.sleep(0.1)


t = threading.Thread(target=heartbeat, daemon=True)
t.start()

time.sleep(0.25)
print("main thread finished")
# The program exits here and the daemon thread is stopped abruptly.
```

Output (the number of lines may vary):

```text
still alive
still alive
still alive
main thread finished
```

Without `daemon=True` this program would never exit. Use daemon threads only for background helpers whose work may be lost at any moment. They get no chance to close files or finish writes.

## Stopping a thread cleanly

Python has no way to kill a thread from outside. A thread must **stop itself** when asked. The standard tool for this is `threading.Event`, a thread-safe flag:

```python
import threading
import time

stop_event = threading.Event()


def monitor(stop):
    checks = 0
    while not stop.is_set():
        checks += 1
        print(f"check #{checks}")
        stop.wait(0.1)  # sleeps 0.1 s, but wakes up at once when stop is set
    print("monitor: clean shutdown")


t = threading.Thread(target=monitor, args=(stop_event,))
t.start()

time.sleep(0.35)
stop_event.set()  # ask the thread to stop
t.join()
print("main: done")
```

Output (the number of checks may vary):

```text
check #1
check #2
check #3
check #4
monitor: clean shutdown
main: done
```

- `event.set()` raises the flag, `event.is_set()` checks it, `event.clear()` lowers it again.
- `event.wait(timeout)` blocks until the flag is set or the timeout expires. Using it instead of `time.sleep()` makes the thread react to a stop request immediately.
- `t.join(timeout=...)` waits at most the given number of seconds. Afterwards, check `t.is_alive()` to see whether the thread actually finished.

## When to use threading

There are two broad kinds of work (see the Processes and Threads topic):

- **I/O-bound** tasks spend most of their time waiting: network requests, database queries, reading and writing files.
- **CPU-bound** tasks spend most of their time computing.

In standard CPython, threads help with **I/O-bound** work. A waiting thread releases the GIL (Global Interpreter Lock), so other threads can run. For **CPU-bound** pure-Python code, threads take turns holding the GIL and give no speed-up:

```python
from threading import Thread
from time import perf_counter


def countdown(n):
    while n > 0:
        n -= 1


N = 10_000_000

start = perf_counter()
countdown(N)
countdown(N)
print(f"sequential: {perf_counter() - start:.2f} s")

start = perf_counter()
threads = [Thread(target=countdown, args=(N,)) for _ in range(2)]
for t in threads:
    t.start()
for t in threads:
    t.join()
print(f"2 threads:  {perf_counter() - start:.2f} s")
```

Output (timings vary; standard CPython with the GIL):

```text
sequential: 0.19 s
2 threads:  0.19 s
```

For CPU-bound work, use `multiprocessing` or `ProcessPoolExecutor` (later in this section). On the free-threaded build of CPython (optional since 3.13, officially supported since 3.14) the GIL is gone and the threaded version above really does run on two cores.

## A practical example: replacing text in many files

Suppose you need to replace a substring in many text files. The example below creates ten temporary files, so it runs anywhere, then processes them once sequentially and once with one thread per file:

```python
import tempfile
from pathlib import Path
from threading import Thread
from time import perf_counter


def replace(filename, substr, new_substr):
    print(f"Processing the file {filename.name}")
    content = filename.read_text()
    content = content.replace(substr, new_substr)
    filename.write_text(content)


def create_files(folder, count=10):
    filenames = []
    for i in range(1, count + 1):
        path = folder / f"test{i}.txt"
        path.write_text("user_ids,order_ids\n" * 10_000)
        filenames.append(path)
    return filenames


def run_sequential(filenames):
    for filename in filenames:
        replace(filename, "ids", "id")


def run_threaded(filenames):
    threads = [
        Thread(target=replace, args=(filename, "id", "ids"))
        for filename in filenames
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        filenames = create_files(Path(tmp))

        start = perf_counter()
        run_sequential(filenames)  # "ids" -> "id"
        print(f"Sequential: {perf_counter() - start:0.4f} s")
        print(filenames[0].read_text().splitlines()[0])

        start = perf_counter()
        run_threaded(filenames)    # "id" -> "ids" (back again)
        print(f"Threaded:   {perf_counter() - start:0.4f} s")
        print(filenames[0].read_text().splitlines()[0])
```

Output (timings vary; the order of the threaded lines may vary too):

```text
Processing the file test1.txt
Processing the file test2.txt
Processing the file test3.txt
Processing the file test4.txt
Processing the file test5.txt
Processing the file test6.txt
Processing the file test7.txt
Processing the file test8.txt
Processing the file test9.txt
Processing the file test10.txt
Sequential: 0.0052 s
user_id,order_id
Processing the file test1.txt
Processing the file test2.txt
Processing the file test3.txt
Processing the file test4.txt
Processing the file test5.txt
Processing the file test6.txt
Processing the file test7.txt
Processing the file test8.txt
Processing the file test9.txt
Processing the file test10.txt
Threaded:   0.0047 s
user_ids,order_ids
```

The threaded version gives the same result, but here it is hardly faster. Small local files are served from the OS cache in microseconds, so there is almost no waiting to overlap, and `str.replace()` is CPU work that holds the GIL. Threads pay off when each operation involves real waiting: network drives, slow disks, HTTP requests, databases. Always **measure** before assuming threads make something faster.

> **Note:** `print()` from several threads can interleave. Each call usually prints a whole line, but the order is not guaranteed, and in rare cases parts of two lines can mix. For serious programs use the `logging` module, which is thread-safe.

## Common mistakes

- **Calling the function instead of passing it.** `Thread(target=task())` runs `task()` immediately in the main thread and passes its return value (`None`) as the target. Write `Thread(target=task)`.
- **Passing a non-tuple as `args`.** `args=(5)` is just the integer `5`, and the thread fails with `TypeError: ... argument after * must be an iterable, not int`. Write `args=(5,)`.
- **Joining inside the start loop.** This runs the threads one after another. Start all threads first, then join them.
- **Calling `run()` instead of `start()`.** `t.run()` executes the target in the *current* thread, with no concurrency at all.
- **Starting a thread twice.** A `Thread` object can be started only once. A second `start()` raises `RuntimeError: threads can only be started once`. Create a new object instead.
- **Expecting the target's return value or exceptions in the caller.** Both are lost unless you store them yourself (or use a thread pool).
- **Using threads for CPU-bound work** in standard CPython. Use processes instead.
- **Trying to kill a thread.** There is no supported way. Design threads to check an `Event` and stop themselves.

## Summary

- Use `threading.Thread(target=func, args=(...), kwargs={...})` to create a thread, `start()` to run it and `join()` to wait for it.
- `args` must be a tuple: `args=(value,)` for a single argument.
- Start all threads first, then join them all. The completion order is not predictable.
- Threads discard return values, and their exceptions do not reach `join()`. Store results yourself, set `threading.excepthook`, or use a thread pool.
- Daemon threads are stopped abruptly when the program exits. Use them only for disposable background work.
- Threads cannot be killed. Stop them cooperatively with `threading.Event`.
- In standard CPython, threads speed up I/O-bound work, not CPU-bound work. Measure to confirm a real speed-up.

## Practice

### Exercise 1: Fix the threads

This program should run both tasks concurrently and finish in about 0.2 seconds. It contains three bugs. Find and fix them.

```python
from threading import Thread
from time import perf_counter, sleep


def task(n):
    sleep(0.2)
    print(f"task {n} done")


start = perf_counter()
first = Thread(target=task(1))
second = Thread(target=task, args=(2))
threads = [first, second]
for t in threads:
    t.start()
    t.join()
print(f"It took {perf_counter() - start:.1f} s")
```

### Exercise 2: Concurrent "downloads"

Write `download(url)` that simulates a request with `time.sleep(0.3)` and stores `len(url) * 1000` (the pretend page size) in a global dict `sizes` under the key `url`. Download the five URLs below in five threads, print every URL with its size in the original order, and print the total time. It should be about 0.3 seconds, not 1.5.

```python
urls = [
    "https://example.com/a",
    "https://example.com/bb",
    "https://example.com/ccc",
    "https://example.com/dddd",
    "https://example.com/eeeee",
]
```

### Exercise 3: Wait with a timeout, then cancel

Write `long_job(cancel)` that performs 10 steps of `time.sleep(0.05)` and, before each step, checks a `threading.Event` called `cancel`. If the event is set, it prints on which step it stopped and returns. In the main thread, start the job, wait for it at most 0.2 seconds with `join(timeout=...)`, and if it is still running, set the event, join again and print whether the worker is still alive.

### Exercise 4: A thread that returns results

Create a `ResultThread` subclass of `Thread` whose `join()` **returns** the target function's result, or **re-raises** the exception the target raised. Test it with a function that returns `7 * 7` after a short sleep and with a function that raises `ValueError("bad input")`.

## Solutions

### Exercise 1

The bugs:

1. `target=task(1)` calls `task(1)` in the main thread right away. The thread gets `target=None` and does nothing.
2. `args=(2)` is the integer `2`, not a tuple. The second thread fails with a `TypeError`.
3. `join()` inside the start loop makes the threads run one after another.

```python
from threading import Thread
from time import perf_counter, sleep


def task(n):
    sleep(0.2)
    print(f"task {n} done")


start = perf_counter()
first = Thread(target=task, args=(1,))
second = Thread(target=task, args=(2,))
threads = [first, second]
for t in threads:
    t.start()
for t in threads:
    t.join()
print(f"It took {perf_counter() - start:.1f} s")
```

Output (the order of the first two lines may vary):

```text
task 2 done
task 1 done
It took 0.2 s
```

### Exercise 2

```python
import threading
import time

sizes = {}


def download(url):
    time.sleep(0.3)                 # simulate network latency
    sizes[url] = len(url) * 1000    # pretend this is the page size


urls = [
    "https://example.com/a",
    "https://example.com/bb",
    "https://example.com/ccc",
    "https://example.com/dddd",
    "https://example.com/eeeee",
]

start = time.perf_counter()
threads = [threading.Thread(target=download, args=(url,)) for url in urls]
for t in threads:
    t.start()
for t in threads:
    t.join()
elapsed = time.perf_counter() - start

for url in urls:
    print(url, sizes[url])
print(f"Downloaded {len(sizes)} pages in {elapsed:.2f} s")
```

Output (the time varies slightly):

```text
https://example.com/a 21000
https://example.com/bb 22000
https://example.com/ccc 23000
https://example.com/dddd 24000
https://example.com/eeeee 25000
Downloaded 5 pages in 0.31 s
```

Every thread writes a different key, and the main thread reads `sizes` only after all `join()` calls, so no lock is needed. Iterating over `urls` instead of `sizes` keeps the original order, whatever order the threads finished in.

### Exercise 3

```python
import threading
import time


def long_job(cancel):
    for step in range(1, 11):
        if cancel.is_set():
            print(f"job: cancelled before step {step}")
            return
        time.sleep(0.05)  # one small piece of work
    print("job: finished all steps")


cancel = threading.Event()
worker = threading.Thread(target=long_job, args=(cancel,))
worker.start()

worker.join(timeout=0.2)
if worker.is_alive():
    print("main: still running after 0.2 s, cancelling")
    cancel.set()
    worker.join()

print("main: worker alive?", worker.is_alive())
```

Output (the step number may vary by one):

```text
main: still running after 0.2 s, cancelling
job: cancelled before step 5
main: worker alive? False
```

`join(timeout=0.2)` returns after 0.2 seconds even though the job needs about 0.5. Only `is_alive()` tells you whether the thread really finished. The job notices the event at its next check and returns, so the second `join()` is short.

### Exercise 4

```python
import threading
import time


class ResultThread(threading.Thread):
    def __init__(self, target, args=(), kwargs=None):
        super().__init__()
        self._func = target
        self._func_args = args
        self._func_kwargs = kwargs or {}
        self.result = None
        self.error = None

    def run(self):
        try:
            self.result = self._func(*self._func_args, **self._func_kwargs)
        except Exception as exc:
            self.error = exc

    def join(self, timeout=None):
        super().join(timeout)
        if self.error is not None:
            raise self.error
        return self.result


def slow_square(x):
    time.sleep(0.1)
    return x * x


def broken():
    raise ValueError("bad input")


t1 = ResultThread(target=slow_square, args=(7,))
t2 = ResultThread(target=broken)
t1.start()
t2.start()

print("result:", t1.join())
try:
    t2.join()
except ValueError as exc:
    print("caught in main thread:", exc)
```

Output:

```text
result: 49
caught in main thread: bad input
```

The attributes are named `_func`, `_func_args` and `_func_kwargs` on purpose. `Thread` already uses `_target`, `_args` and `_kwargs` internally, and reusing those names would clash with its own logic. The exception is caught inside `run()`, where it happens, and re-raised later in the thread that calls `join()`.

---

*Source: [pythontutorial.net — Python Threading](https://www.pythontutorial.net/advanced-python/python-threading/). Adapted and expanded for PyJourney.*
