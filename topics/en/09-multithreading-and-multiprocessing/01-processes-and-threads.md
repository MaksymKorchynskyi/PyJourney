# Processes and Threads

Before you write concurrent Python code, you need a clear picture of what the operating system actually runs: **processes** and **threads**. This topic explains both, how they share (or do not share) memory, how a CPU runs many of them "at once", and which one to choose for which kind of work.

## What you'll learn

- How a Python program turns into a running process
- What a process and a thread are, and how they relate to each other
- The difference between concurrency and parallelism, and how the OS scheduler creates both
- How to tell I/O-bound work from CPU-bound work
- What the GIL is, how free-threaded CPython changes the picture, and why it matters for choosing threads or processes
- The practical differences between processes and threads

## From a program to a process

Take a tiny program saved as `app.py`:

```python
x = 10
y = 20
z = x + y
```

A CPU cannot execute Python source directly. It only runs **machine code**. When you run `python app.py`, this is what happens:

1. The operating system (OS) loads the Python interpreter (CPython, itself a program written in C and compiled to machine code) into memory and starts it.
2. CPython **compiles** your source code into **bytecode**: compact, low-level instructions for a virtual machine. Bytecode is not machine code.
3. CPython's evaluation loop reads the bytecode instructions one by one and performs them. The CPU executes the interpreter's machine code, and the interpreter executes your bytecode.

You can look at the bytecode with the `dis` module:

```python
import dis

dis.dis("z = x + y")
```

Output (Python 3.14; the exact instructions change between versions):

```text
  0           RESUME                   0

  1           LOAD_NAME                0 (x)
              LOAD_NAME                1 (y)
              BINARY_OP                0 (+)
              STORE_NAME               2 (z)
              LOAD_CONST               0 (None)
              RETURN_VALUE
```

> **Note:** Older tutorials say that CPython "compiles Python to machine code". That is not how standard CPython works. It compiles to bytecode and interprets it. Python 3.13+ ships an experimental JIT compiler, but it is off by default and does not change this basic model.

## Processes and threads

**A process is an instance of a program that is running.** The OS gives every process:

- its own private **memory** (address space), which other processes cannot read or write directly;
- its own resources: open files, network connections, environment variables;
- a unique number, the **process ID (PID)**;
- at least one thread.

**A thread is a unit of execution inside a process.** It is the thing the OS actually puts on a CPU core. Each thread has its own instruction pointer ("where am I in the code") and its own call stack, but all threads of one process **share** the process memory: global variables, objects on the heap, open files.

```text
+------------------- process (PID 4120) -------------------+
|  shared memory: globals, objects, open files            |
|                                                          |
|   +-------------+   +-------------+   +-------------+    |
|   | main thread |   |  thread 2   |   |  thread 3   |    |
|   | own stack   |   | own stack   |   | own stack   |    |
|   +-------------+   +-------------+   +-------------+    |
+----------------------------------------------------------+
```

A handy analogy: a **program** is like a class, and **processes** are like its instances. If you start the same program three times, you have one program but three processes, each with its own memory and PID.

So far all your programs have had **one process with one thread**, the **main thread**. That is why the two words are often used loosely. In general:

- a program can start one or more processes, and each process can have one or more threads;
- a program that uses several processes uses **multiprocessing**;
- a program that uses several threads within one process uses **multithreading**.

You can ask Python where your code is running:

```python
import os
import threading

print("Process ID (PID):", os.getpid())
print("Parent PID:", os.getppid())
print("Current thread:", threading.current_thread().name)
print("Threads in this process:", threading.active_count())
```

Output (the PIDs vary on every run):

```text
Process ID (PID): 34149
Parent PID: 34144
Current thread: MainThread
Threads in this process: 1
```

The parent PID belongs to the program that started Python, usually your shell.

### Threads share memory, processes do not

This is the most important practical difference. In the example below, a thread and a child process both append to the global list `shared`:

```python
import multiprocessing
import threading

shared = []


def add_item(source):
    shared.append(source)
    print(f"inside the {source}: {shared}")


if __name__ == "__main__":
    t = threading.Thread(target=add_item, args=("thread",))
    t.start()
    t.join()
    print("main after the thread: ", shared)

    p = multiprocessing.Process(target=add_item, args=("process",))
    p.start()
    p.join()
    print("main after the process:", shared)
```

Output (macOS and Windows, Python 3.14):

```text
inside the thread: ['thread']
main after the thread:  ['thread']
inside the process: ['process']
main after the process: ['thread']
```

- The thread changed the **same** list the main thread sees.
- The child process got its **own copy** of the program's memory. It changed its copy, and the parent never saw that change.

> **Note:** What the child sees *at start* depends on the start method. With `spawn` (the default on macOS and Windows) and `forkserver` (the default on Linux since Python 3.14) the child imports your module again, so it starts with an empty list. With `fork` (the Linux default before 3.14) the child starts with a copy of the parent's memory and prints `['thread', 'process']`. In every case the parent's list stays unchanged. The `if __name__ == "__main__":` guard is required so the child, when it re-imports the module, does not start processes itself.

## How a CPU runs many things "at once"

### One core: taking turns

A single CPU core executes one thread at a time. To run many programs "simultaneously", the OS uses a component called the **scheduler**. It gives each ready thread a short **time slice** (typically a few milliseconds), then pauses it, saves its state and switches to another thread. This is a **context switch**. Switching happens so often that everything appears to run at the same time.

```text
one core:  [A][B][C][A][B][C][A][B] ...   -> time
           tasks take turns: concurrency, but no parallelism
```

### Many cores: really at the same time

Modern CPUs have several **cores** (2, 4, 8, 10 or more). Each core can run its own thread at the same instant. With *N* cores, up to *N* threads truly run in parallel (a bit more on CPUs with simultaneous multithreading, such as Intel Hyper-Threading).

```text
core 1:  [A][A][A][A][A] ...
core 2:  [B][B][B][B][B] ...   -> A and B really run in parallel
```

This gives two related but different ideas:

- **Concurrency**: several tasks are *in progress* during the same period. They may take turns on one core.
- **Parallelism**: several tasks *execute at the same instant* on different cores.

Python can report how many logical CPUs it may use:

```python
import os

print(os.cpu_count())          # logical CPUs in the machine, e.g. 10
print(os.process_cpu_count())  # CPUs this process may use (Python 3.13+), e.g. 10
```

## CPU-bound vs. I/O-bound tasks

Whether concurrency helps depends on what your code spends its time on.

- **I/O-bound** tasks mostly **wait**: for a network response, a database query, a disk read or write, a user. The CPU sits idle during the wait. Examples: downloading web pages, calling APIs, querying a database, reading many files.
- **CPU-bound** tasks mostly **compute**. The CPU is busy all the time. Examples: matrix multiplication, searching for prime numbers, resizing images, compressing or encoding video, hashing passwords.

```text
I/O-bound:  [cpu]......wait......[cpu]......wait......[cpu]
CPU-bound:  [cpu][cpu][cpu][cpu][cpu][cpu][cpu][cpu][cpu]
```

For I/O-bound work, the trick is to **do something useful while waiting**: start the next download while the first one waits. Threads (or `asyncio`) do this cheaply. For CPU-bound work there is no waiting to overlap. The only way to go faster is to use **more cores at the same time**.

## The GIL: why Python threads do not run in parallel

Standard CPython has a **Global Interpreter Lock (GIL)**. It is a lock inside the interpreter that allows **only one thread at a time to execute Python bytecode** in a process. It keeps CPython's internals (such as reference counts) consistent without fine-grained locking everywhere.

Consequences:

- **CPU-bound Python code does not get faster with threads.** Two threads that both compute take turns holding the GIL, so they use about one core in total.
- **I/O-bound code does get faster with threads.** A thread releases the GIL while it waits for I/O or sleeps (`time.sleep()`, socket reads, file reads), so other threads can run in the meantime.
- Many C extensions release the GIL during heavy work (for example, `hashlib` on large inputs, `zlib`, NumPy operations). Threads can speed those up too.
- The interpreter asks the running thread to release the GIL periodically, every 5 ms by default (`sys.getswitchinterval()`), so threads still take fair turns.
- **Each process has its own interpreter and its own GIL.** That is why multiprocessing gives real parallelism for CPU-bound Python code.

### Free-threaded CPython (PEP 703)

Since **Python 3.13** there is an optional **free-threaded** build of CPython that runs without the GIL (often installed as `python3.13t` / `python3.14t`). In 3.13 it was experimental. In **3.14** it is officially supported (PEP 779), but it is still a separate, optional build, not the default one. On it, threads can run Python code on several cores in parallel. Single-threaded code runs somewhat slower, and some C extensions are not yet compatible (importing one may turn the GIL back on).

You can check which build you are running:

```python
import sys
import sysconfig

print("Python:", sys.version.split()[0])
print("Free-threaded build:", bool(sysconfig.get_config_var("Py_GIL_DISABLED")))
print("GIL enabled right now:", sys._is_gil_enabled())
```

Output (standard python.org build of 3.14):

```text
Python: 3.14.0
Free-threaded build: False
GIL enabled right now: True
```

`sys._is_gil_enabled()` exists since Python 3.13. The leading underscore marks it as CPython-specific.

### Rule of thumb

| Kind of work | Standard CPython (with GIL) | Free-threaded CPython |
|---|---|---|
| I/O-bound | threads (or `asyncio`) | threads (or `asyncio`) |
| CPU-bound, pure Python | processes | threads or processes |
| CPU-bound inside a C library that releases the GIL | threads often work | threads |

## Main differences between processes and threads

| Criterion | Process | Thread |
|---|---|---|
| Memory | Own address space, not shared by default | Shares the memory of its process |
| Memory footprint | Large: a whole interpreter per process | Small: mostly its own stack |
| Start-up time | Slow (milliseconds) | Fast (tens of microseconds) |
| Communication | Pipes, queues, shared memory; data is copied (pickled) | Read and write the same objects directly; needs locks |
| Isolation | A crash in one process does not affect others | A crash in native code kills the whole process |
| Stopping from outside | Can be terminated (`terminate()`, `kill()`) | Cannot be killed; must stop cooperatively |
| Parallel Python code (with GIL) | Yes, each process has its own GIL | No, one thread at a time |
| Best suited for | CPU-bound work | I/O-bound work |

The start-up difference is easy to measure:

```python
import multiprocessing
import threading
import time


def do_nothing():
    pass


def measure(worker_class, count=20):
    start = time.perf_counter()
    workers = [worker_class(target=do_nothing) for _ in range(count)]
    for w in workers:
        w.start()
    for w in workers:
        w.join()
    return time.perf_counter() - start


if __name__ == "__main__":
    print(f"20 threads:   {measure(threading.Thread):.4f} s")
    print(f"20 processes: {measure(multiprocessing.Process):.4f} s")
```

Output (timings vary by machine and run):

```text
20 threads:   0.0007 s
20 processes: 0.1535 s
```

Starting a process with `spawn` means launching a new interpreter and importing your module again, which is roughly a hundred times more expensive than starting a thread. That is why both are usually reused through **pools** (covered later in this section).

## Common mistakes

- **Expecting threads to speed up CPU-bound Python code.** With the GIL, only one thread runs bytecode at a time. Use processes, or a free-threaded build.
- **Expecting processes to share global variables.** A child process works on its own copy. Pass data explicitly (arguments, queues, return values through a pool).
- **Forgetting `if __name__ == "__main__":`** around code that starts processes. With `spawn` and `forkserver` the child re-imports your module, and unguarded code would try to start processes again (Python raises a `RuntimeError` to stop this).
- **Confusing concurrency with parallelism.** Threads under the GIL give concurrency (overlapping waits), not parallel computation.
- **Starting far more processes than cores** for CPU-bound work. Extra processes only add switching and memory overhead. Use about `os.process_cpu_count()` workers.
- **Assuming start methods behave the same everywhere.** Code that "worked" with `fork` on Linux may break with `spawn` on macOS and Windows. Write code that works with `spawn`.

## Summary

- A process is a running instance of a program with its own memory and PID. A thread is a unit of execution inside a process.
- Every process has at least one thread (the main thread). Threads of one process share its memory, processes do not share memory by default.
- CPython compiles source code to bytecode and interprets it.
- The OS scheduler switches threads on each core every few milliseconds (concurrency). Several cores run threads truly at the same time (parallelism).
- I/O-bound work mostly waits, CPU-bound work mostly computes.
- The GIL lets only one thread run Python bytecode at a time, so in standard CPython use threads for I/O-bound work and processes for CPU-bound work.
- Free-threaded CPython (optional since 3.13, officially supported since 3.14) removes the GIL and lets threads run Python code in parallel.
- Processes are heavier and slower to start but isolated. Threads are cheap but share everything, so they need synchronization.

## Practice

### Exercise 1: I/O-bound or CPU-bound?

Classify each task and say whether, in standard CPython, you would speed it up with threads or with processes:

1. Downloading 200 product pages from an online shop.
2. Counting word frequencies in a large text that is already loaded into memory.
3. Reading 50 small JSON files from a slow network drive.
4. Rendering 30 frames of a fractal image with nested Python loops.
5. Sending 1,000 emails through an SMTP server.
6. Checking which numbers below 10,000,000 are prime.

### Exercise 2: Predict the output

Without running the code, write down both printed lines. Then run it to check.

```python
import multiprocessing
import threading

settings = {"mode": "default"}


def change_mode(new_mode):
    settings["mode"] = new_mode


if __name__ == "__main__":
    t = threading.Thread(target=change_mode, args=("thread",))
    t.start()
    t.join()
    print(settings["mode"])

    p = multiprocessing.Process(target=change_mode, args=("process",))
    p.start()
    p.join()
    print(settings["mode"])
```

### Exercise 3: Who runs where?

Write a program that:

1. starts three threads, each adding `os.getpid()` to a global set, and then prints how many distinct PIDs the threads saw and whether that PID equals the main process PID;
2. starts one child process, passes it the parent's PID as an argument, and prints from the child whether its own PID differs from the parent's and whether `os.getppid()` equals the parent's PID.

### Exercise 4: Feel the GIL

Write an `io_task()` that sleeps for 0.2 seconds and a `cpu_task()` that adds up the numbers from 0 to 5,000,000 in a Python loop. Run each task 4 times sequentially and then in 4 threads, and print the timings. Explain the result.

## Solutions

### Exercise 1

1. I/O-bound (network). Threads.
2. CPU-bound (the data is already in memory, only computation is left). Processes.
3. I/O-bound (slow drive). Threads.
4. CPU-bound. Processes.
5. I/O-bound (network round trips). Threads.
6. CPU-bound. Processes.

On a free-threaded build, threads would also speed up 2, 4 and 6.

### Exercise 2

Output:

```text
thread
thread
```

The thread runs inside the same process, so it modifies the same `settings` dictionary. The child process modifies its own copy, so the parent still sees `"thread"`.

### Exercise 3

```python
import multiprocessing
import os
import threading

seen_pids = set()


def record_pid():
    seen_pids.add(os.getpid())


def check_parent(parent_pid):
    print("child PID differs from parent PID:", os.getpid() != parent_pid)
    print("child's parent is our main process:", os.getppid() == parent_pid)


if __name__ == "__main__":
    threads = [threading.Thread(target=record_pid) for _ in range(3)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    print("distinct PIDs seen by threads:", len(seen_pids))
    print("equal to the main PID:", seen_pids == {os.getpid()})

    p = multiprocessing.Process(target=check_parent, args=(os.getpid(),))
    p.start()
    p.join()
```

Output:

```text
distinct PIDs seen by threads: 1
equal to the main PID: True
child PID differs from parent PID: True
child's parent is our main process: True
```

All threads live inside the main process, so they report one PID. The child is a separate process with its own PID, and its parent is the process that started it.

### Exercise 4

```python
import threading
import time


def io_task():
    time.sleep(0.2)  # waiting: the GIL is released


def cpu_task():
    total = 0
    for i in range(5_000_000):  # computing: the GIL is held
        total += i


def sequential(task, times=4):
    start = time.perf_counter()
    for _ in range(times):
        task()
    return time.perf_counter() - start


def threaded(task, times=4):
    start = time.perf_counter()
    threads = [threading.Thread(target=task) for _ in range(times)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return time.perf_counter() - start


if __name__ == "__main__":
    for task in (io_task, cpu_task):
        print(f"{task.__name__}: sequential {sequential(task):.2f} s, "
              f"4 threads {threaded(task):.2f} s")
```

Output (timings vary; standard CPython with the GIL):

```text
io_task: sequential 0.81 s, 4 threads 0.21 s
cpu_task: sequential 0.30 s, 4 threads 0.28 s
```

The four sleeps overlap, so the threaded I/O version takes about as long as one sleep. The CPU-bound version gains nothing: the threads take turns holding the GIL and together still use about one core. On a free-threaded build the CPU-bound threaded time would drop as well.

---

*Source: [pythontutorial.net — Differences between Processes and Threads](https://www.pythontutorial.net/advanced-python/differences-between-processes-and-threads/). Adapted and expanded for PyJourney.*
