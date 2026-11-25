# Multiprocessing

Threads cannot speed up CPU-heavy Python code in standard CPython, because the GIL lets only one thread run Python bytecode at a time. The `multiprocessing` module gets around this by running work in **separate processes**. Each process has its own interpreter and its own GIL, so several of them can really compute in parallel on different CPU cores.

## What you'll learn

- When multiprocessing speeds a program up, and when it does not
- How to run functions in parallel with `multiprocessing.Process`, `start()` and `join()`
- Why code that starts processes needs `if __name__ == "__main__":`, and what start methods are
- How to pass arguments to a process, and why its return value is lost
- How to send results back with a `Queue` and share a number with `Value`
- How to read exit codes, react to crashes and stop a process that hangs
- A practical example: creating image thumbnails in parallel with Pillow

## When multiprocessing helps

Programs spend their time on two kinds of work (the topic Processes and Threads explains them in detail):

- **I/O-bound** tasks mostly *wait*: for files, databases, network responses. Threads or `asyncio` speed them up cheaply, because a waiting thread releases the GIL.
- **CPU-bound** tasks mostly *compute*: number crunching, image resizing, video encoding, compression. Here there is no waiting to overlap. The only way to finish sooner is to use **more cores at the same time**.

With the GIL, two threads that both compute just take turns. Two **processes** do not share a GIL, so on a machine with two or more cores they really run at the same instant. That is what multiprocessing means: two or more processors working on different parts of a program simultaneously.

The price is overhead. Starting a process takes milliseconds rather than microseconds, processes do not share memory, and every argument and result has to be copied between them. Multiprocessing pays off when each piece of work is big enough to outweigh that cost.

> **Note:** The `multiprocessing` API deliberately mirrors `threading`. If you know `Thread(target=..., args=...)`, `start()` and `join()` from the topic Threading, you already know most of `Process`.

## A CPU-bound task, run sequentially

The function below does nothing useful, but it keeps one CPU core busy: it increments a counter 100 million times.

```python
import time


def task():
    result = 0
    for _ in range(10**8):
        result += 1
    return result


if __name__ == "__main__":
    start = time.perf_counter()
    task()
    task()
    finish = time.perf_counter()

    print(f"It took {finish - start:.2f} second(s) to finish")
```

Output (timings vary by machine and Python version):

```text
It took 1.88 second(s) to finish
```

The two calls run one after the other, so the total is about twice the time of one call. Only one core does any work.

## Running work in processes: `Process`, `start()`, `join()`

Here is the same work split across two processes:

```python
import multiprocessing
import time


def task():
    result = 0
    for _ in range(10**8):
        result += 1
    return result


if __name__ == "__main__":
    start = time.perf_counter()

    p1 = multiprocessing.Process(target=task)
    p2 = multiprocessing.Process(target=task)

    p1.start()
    p2.start()

    p1.join()
    p2.join()

    finish = time.perf_counter()
    print(f"It took {finish - start:.2f} second(s) to finish")
```

Output (timings vary):

```text
It took 1.06 second(s) to finish
```

How it works:

1. `multiprocessing.Process(target=task)` creates a `Process` object. It describes the work but does not start anything yet. Pass the function itself, `target=task`, not its result `target=task()`.
2. `p1.start()` asks the operating system for a new process and runs `task()` in it. `start()` returns immediately, so the main process can start `p2` right away. Now both tasks compute in parallel on two cores.
3. `p1.join()` blocks the main process until `p1` finishes, and `p2.join()` does the same for `p2`. Without `join()` the main process would print the time before the work is done.

The program ran about 1.8 times faster, not exactly 2 times. Each process had to be launched, which means starting a fresh Python interpreter and importing the module. For a one-second task that overhead is small. For a task of a few milliseconds it would be larger than the work itself.

```text
sequential:  main  [ task ][ task ]                -> about 2 x T

parallel:    main  start start ......... join join
             p1          [ task ]
             p2          [ task ]                  -> about T + start-up cost
```

## Why `if __name__ == "__main__":` is required

Every example above puts the process-starting code under `if __name__ == "__main__":`. With `multiprocessing` this is not just good style, it is required. The reason is how a child process is created. The way to create it is called the **start method**, and there are three:

| Start method | How the child starts | Default on |
|---|---|---|
| `spawn` | Launches a fresh Python interpreter, which **imports your main module again** and then calls the target | Windows, macOS (since Python 3.8) |
| `forkserver` | A small server process, started once, forks a new child on each request. Your main module is imported in the child too | Linux and other POSIX systems (since Python 3.14) |
| `fork` | Copies the parent process with `os.fork()`. Nothing is re-imported, the child continues from a copy of the parent's memory | Linux before Python 3.14. Not safe when the parent has threads |

You can watch `spawn` re-import the module:

```python
import multiprocessing
import os

print(f"module loaded: __name__={__name__!r}, PID={os.getpid()}")


def work():
    print(f"work() runs in PID {os.getpid()}")


if __name__ == "__main__":
    print("start method:", multiprocessing.get_start_method())
    p = multiprocessing.Process(target=work)
    p.start()
    p.join()
    print("main is done")
```

Output on macOS or Windows (the PIDs vary):

```text
module loaded: __name__='__main__', PID=55194
start method: spawn
module loaded: __name__='__mp_main__', PID=55196
work() runs in PID 55196
main is done
```

The top-level `print()` ran **twice**: once in the parent and once in the child. In the child, the module is imported under the name `__mp_main__`, so the `if` block is skipped there. Without the guard, the child would reach `p.start()` while importing and try to start a process of its own. Python stops that with a `RuntimeError` in the child:

```text
RuntimeError:
        An attempt has been made to start a new process before the
        current process has finished its bootstrapping phase.
        ...
```

The target function never runs. Keep all top-level code that starts processes, or does other work, inside the guard, and keep only imports, constants and function or class definitions outside it.

You can inspect or choose the start method explicitly:

```python
import multiprocessing

print(multiprocessing.get_all_start_methods())  # on macOS: ['spawn', 'fork', 'forkserver']
ctx = multiprocessing.get_context("spawn")       # a context that always uses spawn
print(ctx.get_start_method())                    # spawn
```

`ctx.Process(...)`, `ctx.Queue()` and so on create objects that use that start method. `multiprocessing.set_start_method("spawn")` changes the default for the whole program, but it may be called only once, inside the `__main__` guard. Writing code that works with `spawn` is the safest choice, because it then works on every platform.

## Passing arguments

`Process` accepts the same arguments as `Thread`: `target`, `args` (a tuple of positional arguments), `kwargs` (a dict of keyword arguments) and `name`:

```python
import multiprocessing
import os


def greet(name, greeting="Hello"):
    me = multiprocessing.current_process()
    print(f"{greeting}, {name}! (from {me.name}, PID {os.getpid()})")


if __name__ == "__main__":
    p1 = multiprocessing.Process(target=greet, args=("Olena",))
    p2 = multiprocessing.Process(
        target=greet, args=("Max",), kwargs={"greeting": "Hi"}, name="greeter"
    )
    p1.start()
    p1.join()
    p2.start()
    p2.join()
```

Output (the PIDs vary):

```text
Hello, Olena! (from Process-1, PID 55295)
Hi, Max! (from greeter, PID 55296)
```

- `args=("Olena",)` needs the trailing comma. `("Olena")` is just a string in parentheses, not a tuple.
- Processes get default names `Process-1`, `Process-2`, ... unless you pass `name=`. Inside a process, `multiprocessing.current_process()` returns its own `Process` object.

### Everything is copied with pickle

The child does not share memory with the parent, so the target and its arguments must be **sent** to it. With `spawn` and `forkserver`, `multiprocessing` serializes them with `pickle`. Two consequences:

- Arguments must be picklable. Numbers, strings, lists, dicts, tuples and instances of ordinary classes are fine. Open files, sockets, locks from `threading` and generators are not.
- The target must be a function the child can **import by name**: defined at the top level of a module. Lambdas and functions nested inside other functions do not work:

```python
import multiprocessing

if __name__ == "__main__":
    p = multiprocessing.Process(target=lambda: print("hi"))
    p.start()
    p.join()
```

Output (Python 3.14 on macOS; the address varies):

```text
Traceback (most recent call last):
  ...
_pickle.PicklingError: Can't pickle <function <lambda> at 0x10076b110>: it's not found as __main__.<lambda>
when serializing dict item '_target'
when serializing multiprocessing.context.Process state
when serializing multiprocessing.context.Process object
```

The error is raised by `p.start()` in the parent. Each child also works on its **copy** of the arguments, so changing a list it received never changes the parent's list.

## Inspecting a process: `pid`, `is_alive()`, `exitcode`

A `Process` object reports the state of its process:

```python
import multiprocessing
import time


def work(seconds):
    time.sleep(seconds)


if __name__ == "__main__":
    p = multiprocessing.Process(target=work, args=(0.5,), name="sleeper")
    print("before start:", p.name, p.pid, p.is_alive(), p.exitcode)

    p.start()
    print("running:     ", p.name, p.pid, p.is_alive(), p.exitcode)

    p.join()
    print("after join:  ", p.name, p.pid, p.is_alive(), p.exitcode)
```

Output (the PID varies):

```text
before start: sleeper None False None
running:      sleeper 55304 True None
after join:   sleeper 55304 False 0
```

| Member | Meaning |
|---|---|
| `pid` | The OS process ID, `None` before `start()` |
| `is_alive()` | `True` from `start()` until the process ends |
| `exitcode` | `None` while running. `0` for success, a positive number for an error, `-N` if killed by signal `N` (POSIX) |
| `join(timeout=None)` | Wait for the process to end, at most `timeout` seconds if given |
| `daemon` | Set to `True` before `start()` and the child is terminated automatically when the parent exits |
| `terminate()` / `kill()` | Stop the process with SIGTERM / SIGKILL (on Windows both call `TerminateProcess()`) |
| `close()` | Release the resources of a finished `Process` object |

## Return values are lost: sending results back

Look at `task()` from the first example again: it returns `result`, but nobody ever sees that value. The target runs in another process, and `Process` simply throws its return value away. There is no `p.result`:

```python
import multiprocessing


def task():
    return 42


if __name__ == "__main__":
    p = multiprocessing.Process(target=task)
    p.start()
    p.join()
    print(p.exitcode)
    print(hasattr(p, "result"))
```

Output:

```text
0
False
```

To get data back, the child must **send** it through a channel that connects processes. The most common one is `multiprocessing.Queue`, a process-safe FIFO queue. Here four processes count the primes in four ranges and put their answers in a queue:

```python
import multiprocessing


def count_primes(start, stop, results):
    count = 0
    for n in range(max(start, 2), stop):
        if all(n % d for d in range(2, int(n**0.5) + 1)):
            count += 1
    results.put((start, stop, count))  # send the result to the parent


if __name__ == "__main__":
    ranges = [(0, 25_000), (25_000, 50_000), (50_000, 75_000), (75_000, 100_000)]
    results = multiprocessing.Queue()

    processes = [
        multiprocessing.Process(target=count_primes, args=(start, stop, results))
        for start, stop in ranges
    ]
    for p in processes:
        p.start()

    # read one message per process BEFORE joining
    partial = [results.get() for _ in processes]

    for p in processes:
        p.join()

    for start, stop, count in sorted(partial):
        print(f"[{start:>6}, {stop:>6}): {count} primes")
    print("total:", sum(count for _, _, count in partial))
```

Output:

```text
[     0,  25000): 2762 primes
[ 25000,  50000): 2371 primes
[ 50000,  75000): 2260 primes
[ 75000, 100000): 2199 primes
total: 9592
```

Details that matter:

- The queue is passed to each child **as an argument**. A queue created as a global variable would be a different, unconnected queue in every child started with `spawn`.
- `results.get()` blocks until a message arrives. The messages come in the order the processes **finish**, which varies, so each message carries its range and the list is sorted afterwards.
- Call `get()` **before** `join()`. Before exiting, a child waits until everything it put into a queue has been pushed into the underlying pipe. If the data is bigger than the pipe's buffer, that only happens when the parent reads it, so joining first can deadlock.

Other ways to communicate:

- `multiprocessing.Pipe()` returns two connected endpoints for a two-way conversation between exactly two processes.
- `multiprocessing.Value` and `multiprocessing.Array` place numbers in **shared memory** that several processes can read and write directly.
- `multiprocessing.Manager()` starts a server process that hosts shared lists, dicts and other objects. It is flexible, but every access is a message to that server, so it is slow.

### Shared memory needs a lock

A `Value` is shared, so the classic race condition from the topic Threading Lock is back. `counter.value += 1` is a read, an addition and a write, and other processes can interfere in between:

```python
import multiprocessing


def add_unsafe(counter, times):
    for _ in range(times):
        counter.value += 1  # read, add, write: three separate steps


def add_safe(counter, times):
    for _ in range(times):
        with counter.get_lock():  # one process at a time
            counter.value += 1


def run(worker):
    counter = multiprocessing.Value("i", 0)  # a C int in shared memory
    processes = [
        multiprocessing.Process(target=worker, args=(counter, 10_000))
        for _ in range(4)
    ]
    for p in processes:
        p.start()
    for p in processes:
        p.join()
    return counter.value


if __name__ == "__main__":
    print("without the lock:", run(add_unsafe))
    print("with the lock:   ", run(add_safe))
```

Output (the first number varies from run to run):

```text
without the lock: 11972
with the lock:    40000
```

`"i"` is a type code from the `array` module: a signed C `int`. `get_lock()` returns the lock that comes with every `Value`. `multiprocessing.Lock` works like `threading.Lock` too. In practice, prefer designs where each process computes its own part and **returns** it, as in the queue example. Shared state is slower and easier to get wrong.

## Errors, exit codes and stopping a process

An exception inside a child **does not reach the parent**. The child prints the traceback to its own standard error and exits with code `1`. A child can also choose its exit code with `sys.exit(n)`, and a process that hangs can be stopped from outside, which is impossible with threads:

```python
import multiprocessing
import sys
import time


def ok():
    pass


def fails():
    raise ValueError("bad input")


def exits():
    sys.exit(3)


def hangs():
    time.sleep(60)


if __name__ == "__main__":
    processes = [
        multiprocessing.Process(target=func, name=func.__name__)
        for func in (ok, fails, exits, hangs)
    ]
    for p in processes:
        p.start()

    for p in processes[:3]:
        p.join()

    stuck = processes[3]
    stuck.join(timeout=0.5)  # wait at most 0.5 s
    if stuck.is_alive():
        stuck.terminate()    # send SIGTERM (TerminateProcess on Windows)
        stuck.join()

    for p in processes:
        print(f"{p.name:<6} exitcode={p.exitcode}")
```

Output (traceback shortened):

```text
Process fails:
Traceback (most recent call last):
  ...
ValueError: bad input
ok     exitcode=0
fails  exitcode=1
exits  exitcode=3
hangs  exitcode=-15
```

- `fails` printed its traceback, but the parent carried on. The only trace the parent gets is `exitcode=1`. Check exit codes, or catch exceptions inside the child and send an error message through the queue.
- `join(timeout=0.5)` returns after half a second even though the process is still running. Afterwards `is_alive()` tells you what happened.
- `terminate()` ended the process with signal 15 (SIGTERM), hence `-15`. On Windows there are no signals, but `multiprocessing` reports a terminated process as `-15` there too.
- A terminated process gets no chance to clean up: `finally` blocks and `with` exits do not run, and a queue or lock it was using may be left broken. Use `terminate()` for emergencies, and stop processes cooperatively (for example, with a `multiprocessing.Event`) when you can.

## Subclassing `Process`

Like `Thread`, `Process` can be subclassed. Override `run()`, the method that `start()` calls in the child:

```python
import multiprocessing


class Squarer(multiprocessing.Process):
    def __init__(self, number):
        super().__init__(name=f"squarer-{number}")
        self.number = number

    def run(self):
        print(f"{self.name}: {self.number} squared is {self.number**2}")


if __name__ == "__main__":
    workers = [Squarer(n) for n in (3, 4)]
    for w in workers:
        w.start()
    for w in workers:
        w.join()
```

Output (the order of the lines may vary):

```text
squarer-3: 3 squared is 9
squarer-4: 4 squared is 16
```

Always call `super().__init__()`. With `spawn`, the whole object is pickled and sent to the child, so its attributes must be picklable. Anything `run()` assigns to `self` changes only the child's copy of the object (see Exercise 4).

## A practical example: creating thumbnails

Image processing is a classic CPU-bound job. The next program makes small, blurred thumbnails of large photos with **Pillow**, the most popular imaging library for Python. Install it in a virtual environment first:

```bash
python -m venv .venv
source .venv/bin/activate   # on Windows: .venv\Scripts\activate
pip install Pillow
```

The program expects five JPEG files in an `images` folder. If you have no photos at hand, this script creates five large test images full of random noise:

```python
from pathlib import Path

from PIL import Image

folder = Path("images")
folder.mkdir(exist_ok=True)

for i in range(1, 6):
    # three channels of random noise make a large, "busy" 12-megapixel photo
    channels = [Image.effect_noise((4000, 3000), 40 + 10 * i) for _ in range(3)]
    Image.merge("RGB", channels).save(folder / f"{i}.jpg", quality=90)
    print(f"created images/{i}.jpg")
```

### Sequential version

```python
import time
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
        # the expensive part: blur the full-size image
        blurred = img.filter(ImageFilter.GaussianBlur())
    blurred.thumbnail(size)  # shrink in place, keeping the aspect ratio
    blurred.save(Path(thumb_dir) / Path(filename).name)
    print(f"{filename} was processed...")


if __name__ == "__main__":
    Path("thumbs").mkdir(exist_ok=True)
    start = time.perf_counter()

    for filename in filenames:
        create_thumbnail(filename)

    finish = time.perf_counter()
    print(f"It took {finish - start:.2f} second(s) to finish")
```

Output (timings vary):

```text
images/1.jpg was processed...
images/2.jpg was processed...
images/3.jpg was processed...
images/4.jpg was processed...
images/5.jpg was processed...
It took 1.00 second(s) to finish
```

For each file, `create_thumbnail()` opens the image, applies a Gaussian blur to the full-size picture, shrinks the result with `thumbnail()` (which keeps the aspect ratio, so a 4000 x 3000 photo becomes 50 x 38) and saves it to the `thumbs` folder under the same file name. The `with` block closes the file, and `mkdir(exist_ok=True)` creates the output folder if it does not exist yet. Without it, `save()` would fail with `FileNotFoundError`.

### Parallel version

Now each image gets its own process:

```python
import multiprocessing
import time
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
        # the expensive part: blur the full-size image
        blurred = img.filter(ImageFilter.GaussianBlur())
    blurred.thumbnail(size)  # shrink in place, keeping the aspect ratio
    blurred.save(Path(thumb_dir) / Path(filename).name)
    print(f"{filename} was processed...")


def main():
    Path("thumbs").mkdir(exist_ok=True)
    start = time.perf_counter()

    # create one process per image
    processes = [
        multiprocessing.Process(target=create_thumbnail, args=(filename,))
        for filename in filenames
    ]

    # start the processes
    for process in processes:
        process.start()

    # wait for them to finish
    for process in processes:
        process.join()

    finish = time.perf_counter()
    print(f"It took {finish - start:.2f} second(s) to finish")


if __name__ == "__main__":
    main()
```

Output (the order of the lines and the timing vary):

```text
images/2.jpg was processed...
images/1.jpg was processed...
images/3.jpg was processed...
images/5.jpg was processed...
images/4.jpg was processed...
It took 0.34 second(s) to finish
```

The five images were processed at the same time on five cores, about three times faster. The lines now appear in the order the processes **finish**, which is different on every run.

One process per item is fine for five files, but not for five thousand: you would launch thousands of interpreters at once and overload the machine. The right tool for many items is a **process pool**, which keeps a fixed number of worker processes (usually one per core) and feeds them tasks. It also returns results and exceptions to the parent for you. The next topic, Process Pool, covers it.

## How many processes?

For CPU-bound work, more processes than cores do not help: they just take turns on the same cores and add memory and switching overhead. A good default is the number of CPUs your process may use:

```python
import os

print(os.process_cpu_count())  # e.g. 10 (Python 3.13+; use os.cpu_count() before)
```

## Common mistakes

- **Forgetting `if __name__ == "__main__":`.** With `spawn` and `forkserver` the child imports your module. Unguarded code that starts processes fails in the child with `RuntimeError`, and the work is never done.
- **Expecting the target's return value.** `Process` discards it. Send results through a `Queue` or a `Pipe`, or use a process pool.
- **Writing `args=(x)` instead of `args=(x,)`.** Without the comma there is no tuple. `Process` converts `args` to a tuple, so an integer raises `TypeError: 'int' object is not iterable`, and a string is split into single characters.
- **Calling the target yourself: `Process(target=task())`.** This runs `task()` in the parent and passes its result as the target.
- **Using lambdas, nested functions or unpicklable arguments.** With `spawn` the target is found by name and the arguments are pickled. Define targets at the top level of a module.
- **Running `multiprocessing` code in an interactive session.** A function typed into the REPL (or, on some setups, a Jupyter cell) cannot be imported by a spawned child, which fails with an error like `AttributeError: module '__main__' has no attribute 'work'`. Put the code in a `.py` file.
- **Expecting changes to globals to reach the parent.** Each process has its own memory. A child that appends to a global list changes only its copy.
- **Joining before draining a queue.** A child that has put a lot of data into a queue cannot exit until the parent reads it, so `join()` waits forever. Call `get()` first, then `join()`.
- **Using processes for tiny or I/O-bound tasks.** Start-up and pickling costs can make the program slower than the sequential version. Use threads or `asyncio` for waiting, processes for heavy computing.
- **Starting one process per item for a long list.** Use a pool with about `os.process_cpu_count()` workers.

## Summary

- `multiprocessing` runs code in separate processes, each with its own interpreter and GIL, so CPU-bound Python code can run in parallel on several cores.
- Create a process with `Process(target=func, args=(...))`, run it with `start()` and wait for it with `join()`.
- With the `spawn` start method (Windows, macOS) and `forkserver` (Linux since 3.14) the child re-imports the main module, so code that starts processes must be under `if __name__ == "__main__":`.
- The target and its arguments are pickled and copied into the child: use top-level functions and picklable data.
- `Process` discards return values. Send results back through a `Queue` (read it before `join()`) or a `Pipe`, and protect shared `Value` objects with their lock.
- An exception in a child does not reach the parent. Check `exitcode`: `0` is success, a positive number is an error, a negative number is a signal.
- Unlike threads, processes can be stopped from outside with `terminate()` or `kill()`, at the cost of skipping their cleanup.
- Process start-up is expensive. For many tasks, use a process pool with about one worker per core.

## Practice

### Exercise 1: Fix the program

The program below should compute the sums of squares of the numbers below 10, 100 and 1000 in three processes and print them. It has three bugs. Find and fix them, using a `Queue` to get the results back. Print the results sorted by `n`.

```python
import multiprocessing


def sum_of_squares(n):
    return sum(i * i for i in range(n))


processes = []
for n in (10, 100, 1000):
    p = multiprocessing.Process(target=sum_of_squares, args=(n))
    p.start()
    processes.append(p)

for p in processes:
    p.join()
    print(p.result)
```

### Exercise 2: Split the work

Write `parallel_sum(n, workers)` that computes `sum(i * i for i in range(n))` by splitting `range(n)` into `workers` contiguous chunks, computing each chunk in its own process and adding up the partial sums received through a `Queue`. For `n = 30_000_000` and `workers = os.process_cpu_count()`, measure the sequential and the parallel time and check that the result equals both the sequential sum and the formula `(n - 1) * n * (2 * n - 1) // 6`.

### Exercise 3: A watchdog

Write `run_with_timeout(func, timeout)` that runs `func` in a separate process and waits at most `timeout` seconds. If the process is still running after that, terminate it. Return `"<name>: finished (exitcode N)"` or `"<name>: timed out (exitcode N)"`. Test it with a `quick_job()` that sleeps 0.2 seconds and an `endless_job()` that loops forever, using a timeout of 1 second.

### Exercise 4: The missing result

Run this program. It prints `None`. Explain why, then fix it so that the parent can read the result of each `PrimeCounter` after `join()`. Use a `multiprocessing.Value`. Test with limits 100, 1000 and 10000, running the three counters in parallel.

```python
import multiprocessing


class PrimeCounter(multiprocessing.Process):
    def __init__(self, limit):
        super().__init__()
        self.limit = limit
        self.result = None

    def run(self):
        self.result = sum(
            1
            for n in range(2, self.limit)
            if all(n % d for d in range(2, int(n**0.5) + 1))
        )


if __name__ == "__main__":
    counter = PrimeCounter(10_000)
    counter.start()
    counter.join()
    print(counter.result)
```

## Solutions

### Exercise 1

The bugs:

1. There is no `if __name__ == "__main__":` guard, so every spawned child would try to start processes again.
2. `args=(n)` is an integer, not a tuple. `Process` raises `TypeError: 'int' object is not iterable`.
3. `p.result` does not exist: the return value of the target is lost.

```python
import multiprocessing


def sum_of_squares(n, results):
    results.put((n, sum(i * i for i in range(n))))


if __name__ == "__main__":
    results = multiprocessing.Queue()
    processes = []
    for n in (10, 100, 1000):
        p = multiprocessing.Process(target=sum_of_squares, args=(n, results))
        p.start()
        processes.append(p)

    answers = dict(results.get() for _ in processes)

    for p in processes:
        p.join()

    for n in sorted(answers):
        print(f"sum of squares below {n}: {answers[n]}")
```

Output:

```text
sum of squares below 10: 285
sum of squares below 100: 328350
sum of squares below 1000: 332833500
```

Each child sends a pair `(n, result)`, so the parent knows which answer is which, whatever order they arrive in. `dict()` turns the pairs into a dictionary.

### Exercise 2

```python
import multiprocessing
import os
import time

N = 30_000_000


def partial_sum(start, stop, results):
    results.put(sum(i * i for i in range(start, stop)))


def parallel_sum(n, workers):
    step = -(-n // workers)  # ceiling division: chunk size
    results = multiprocessing.Queue()
    processes = [
        multiprocessing.Process(
            target=partial_sum, args=(start, min(start + step, n), results)
        )
        for start in range(0, n, step)
    ]
    for p in processes:
        p.start()
    total = sum(results.get() for _ in processes)
    for p in processes:
        p.join()
    return total


if __name__ == "__main__":
    workers = os.process_cpu_count() or 1

    start = time.perf_counter()
    expected = sum(i * i for i in range(N))
    print(f"sequential: {time.perf_counter() - start:.2f} s")

    start = time.perf_counter()
    total = parallel_sum(N, workers)
    print(f"{workers} processes: {time.perf_counter() - start:.2f} s")

    print("same result:", total == expected)
    print("formula agrees:", total == (N - 1) * N * (2 * N - 1) // 6)
```

Output (timings and the number of processes depend on the machine):

```text
sequential: 0.94 s
10 processes: 0.24 s
same result: True
formula agrees: True
```

`-(-n // workers)` rounds the division up, so the chunks cover the whole range even when `n` is not divisible by `workers`. `min(start + step, n)` keeps the last chunk from going past `n`. The order in which partial sums arrive does not matter for addition. The speed-up is smaller than the number of cores because of process start-up and because not all cores are equally fast.

### Exercise 3

```python
import multiprocessing
import time


def quick_job():
    time.sleep(0.2)


def endless_job():
    while True:  # a bug: this loop never ends
        pass


def run_with_timeout(func, timeout):
    process = multiprocessing.Process(target=func)
    process.start()
    process.join(timeout)
    if process.is_alive():
        process.terminate()
        process.join()
        return f"{func.__name__}: timed out (exitcode {process.exitcode})"
    return f"{func.__name__}: finished (exitcode {process.exitcode})"


if __name__ == "__main__":
    start = time.perf_counter()
    print(run_with_timeout(quick_job, timeout=1))
    print(run_with_timeout(endless_job, timeout=1))
    print(f"total time: {time.perf_counter() - start:.1f} s")
```

Output (the time varies slightly):

```text
quick_job: finished (exitcode 0)
endless_job: timed out (exitcode -15)
total time: 1.2 s
```

`join(timeout)` stops waiting after the timeout, and `is_alive()` shows whether the process actually finished. The `join()` after `terminate()` waits until the OS has really ended the process, so `exitcode` is set. A thread stuck in `while True` could not be stopped like this.

### Exercise 4

`run()` executes in the child process, on the child's **copy** of the `PrimeCounter` object. Assigning `self.result` there changes only that copy. The parent's object was never touched, so it still holds `None`. The fix is to keep the result in shared memory, created in `__init__` (which runs in the parent) and written in `run()`:

```python
import multiprocessing


class PrimeCounter(multiprocessing.Process):
    def __init__(self, limit):
        super().__init__()
        self.limit = limit
        self.result = multiprocessing.Value("q", -1)  # shared 64-bit integer

    def run(self):
        self.result.value = sum(
            1
            for n in range(2, self.limit)
            if all(n % d for d in range(2, int(n**0.5) + 1))
        )


if __name__ == "__main__":
    counters = [PrimeCounter(limit) for limit in (100, 1_000, 10_000)]
    for c in counters:
        c.start()
    for c in counters:
        c.join()
    for c in counters:
        print(f"primes below {c.limit}: {c.result.value}")
```

Output:

```text
primes below 100: 25
primes below 1000: 168
primes below 10000: 1229
```

`"q"` is the type code of a signed 64-bit integer. The `Value` object is handed to the child when the process starts, and both processes then see the same piece of memory. Only one process writes to each `Value`, so no lock is needed. `-1` marks "not computed yet".

---

*Source: [pythontutorial.net — Python Multiprocessing](https://www.pythontutorial.net/advanced-python/python-multiprocessing/). Adapted and expanded for PyJourney.*
