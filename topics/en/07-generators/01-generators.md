# Generators

A **generator function** looks like an ordinary function, but instead of computing a result and returning once, it uses `yield` to hand out values one at a time, pausing between them. Calling it gives you a **generator**: a ready-made iterator. Generators are the shortest and most common way to write iterators in Python, and they let you process large or endless streams of data without loading everything into memory.

## What you'll learn

- How regular functions run to completion and how `yield` lets a function pause and resume
- The difference between a generator function and a generator object
- Why a generator is an iterator, and what happens when it is exhausted
- How to replace a whole iterator class with a few lines of generator code
- How `return` and `StopIteration` behave inside generators
- How to build infinite generators, generator pipelines and delegate with `yield from`

## Regular functions run to completion

A regular function follows the **run-to-completion** model. Once called, it executes from top to bottom (or until `return`), and only then does control go back to the caller:

```python
def greeting():
    print("Hi!")
    print("How are you?")
    print("Are you there?")


greeting()
```

Output:

```text
Hi!
How are you?
Are you there?
```

There is no way to stop such a function after the first `print()`, run some other code, and later continue from the second `print()`. When the function returns, its local variables are gone, and the next call starts from scratch.

## The `yield` statement

To pause a function midway and later resume it from the same point, use `yield`. A function whose body contains at least one `yield` is a **generator function**:

```python
def greeting():
    print("Hi!")
    yield 1
    print("How are you?")
    yield 2
    print("Are you there?")
    yield 3
```

Calling a generator function does **not** run its body. It only creates and returns a **generator object** (usually just called a *generator*):

```python
messenger = greeting()
print(type(messenger))
print("greeting() has not printed anything yet")
```

Output:

```text
<class 'generator'>
greeting() has not printed anything yet
```

The body starts running when you ask the generator for a value with `next()`. It runs until the first `yield`, hands out the value after `yield`, and **pauses** there:

```python
result = next(messenger)
print(result)
```

Output:

```text
Hi!
1
```

The next `next()` call resumes the function right after the `yield` where it stopped, with all local variables intact, and runs to the following `yield`:

```python
result = next(messenger)
print(result)

result = next(messenger)
print(result)
```

Output:

```text
How are you?
2
Are you there?
3
```

After the third `yield`, there is nothing left. The next call resumes the function, reaches the end of the body, and the generator raises `StopIteration`, exactly as an exhausted iterator should:

```python
try:
    next(messenger)
except StopIteration:
    print("StopIteration: the generator is exhausted")
```

Output:

```text
StopIteration: the generator is exhausted
```

### `yield` vs `return`

| | `return value` | `yield value` |
|---|---|---|
| Gives a value to the caller | yes, once | yes, once per `yield` |
| What happens to the function | it ends, local variables are discarded | it pauses, local variables and position are kept |
| What the next call does | starts the function from the top | resumes right after the `yield` |

A generator remembers its whole execution state between calls: local variables, the current line, even the position inside a loop. That is precisely the "state" you had to store in attributes by hand when writing an iterator class.

> **Note:** "Generator" is used for two things. The *generator function* is the `def` with `yield`. The *generator* (generator object) is what calling it returns. `greeting` is a function, `greeting()` is a generator.

## Generators are iterators

A generator object implements the iterator protocol automatically: it has `__next__()`, and its `__iter__()` returns itself. So everything you know about iterators applies:

```python
def countdown(n):
    while n > 0:
        yield n
        n -= 1


gen = countdown(3)
print(iter(gen) is gen)

for value in gen:
    print(value)

print(list(gen))           # already exhausted
print(list(countdown(3)))  # a new call creates a new generator
```

Output:

```text
True
3
2
1
[]
[3, 2, 1]
```

- A `for` loop drives the generator with `next()` and stops quietly at `StopIteration`.
- A generator can be consumed **once**. To iterate again, call the generator function again.
- Each call creates an independent generator with its own local variables, so several generators from the same function never interfere.

## From an iterator class to a generator function

Here is an iterator class that produces the squares of the integers `0` to `length - 1`:

```python
class Squares:
    def __init__(self, length):
        self.length = length
        self.current = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self.current >= self.length:
            raise StopIteration

        result = self.current ** 2
        self.current += 1
        return result


for s in Squares(5):
    print(s)
```

Output:

```text
0
1
4
9
16
```

It works, but most of the code is boilerplate: `__iter__()`, the state in attributes, the manual `StopIteration`. The same iterator as a generator function:

```python
def squares(length):
    for n in range(length):
        yield n ** 2


for s in squares(5):
    print(s)
```

Output:

```text
0
1
4
9
16
```

Python takes care of everything the class did by hand:

| Iterator class | Generator function |
|---|---|
| `__iter__()` returning `self` | provided automatically |
| `__next__()` | each `next()` runs the code up to the next `yield` |
| state in `self.current` | an ordinary local variable `n` |
| `raise StopIteration` | happens when the function ends |

> **Tip:** When a class must be **reusable** (an iterable, not an iterator), write its `__iter__()` method as a generator. Each loop then gets a fresh generator, as shown in the *Iterator vs Iterable* topic.

## Laziness: values are produced on demand

A generator computes each value only when it is asked for one. You can see the producer and the consumer taking turns:

```python
def produce(n):
    for i in range(n):
        print(f"  producing {i}")
        yield i


for value in produce(3):
    print(f"consuming {value}")
```

Output:

```text
  producing 0
consuming 0
  producing 1
consuming 1
  producing 2
consuming 2
```

That is why generators use very little memory. A list of a million numbers stores all of them, while a generator only stores its current state:

```python
import sys

numbers_list = [n * 2 for n in range(1_000_000)]


def doubled(limit):
    for n in range(limit):
        yield n * 2


numbers_gen = doubled(1_000_000)

print(sys.getsizeof(numbers_list))
print(sys.getsizeof(numbers_gen))
print(sum(numbers_list) == sum(numbers_gen))
```

Output (Python 3.14, 64-bit; the exact sizes depend on the Python version):

```text
8448728
208
True
```

The generator's size stays the same whether it will produce ten values or ten billion. The list is even bigger than the number shows: `getsizeof()` counts only the list's internal array of references, not the integer objects stored in it.

## Infinite generators

A generator does not have to end. A `while True` loop with a `yield` inside describes an endless sequence, and the consumer decides how many values to take:

```python
from itertools import islice


def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b


print(list(islice(fibonacci(), 10)))

below_100 = []
for number in fibonacci():
    if number >= 100:
        break
    below_100.append(number)
print(below_100)
```

Output:

```text
[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
[0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
```

The infinite loop is harmless because the generator pauses at every `yield`. Just never pass such a generator to `list()`, `sum()` or `sorted()`.

## Generator pipelines

Generators combine well: one generator can consume another. Each stage processes one item and passes it on, so the whole chain works on a single item at a time, however long the input is:

```python
log_lines = [
    "INFO user logged in",
    "ERROR disk full",
    "INFO file saved",
    "ERROR network down",
]


def errors(lines):
    for line in lines:
        if line.startswith("ERROR"):
            yield line


def messages(lines):
    for line in lines:
        yield line.split(" ", 1)[1]


for message in messages(errors(log_lines)):
    print(message)
```

Output:

```text
disk full
network down
```

With a real log file you would pass the open file object instead of `log_lines`: files are iterators over lines, so the pipeline reads the file line by line and never loads it whole.

## Delegating with `yield from`

`yield from iterable` yields every item of another iterable, one by one. It replaces a `for` loop whose only job is to re-yield items:

```python
def chain(*iterables):
    for iterable in iterables:
        yield from iterable   # same as: for item in iterable: yield item


print(list(chain([1, 2], "ab", range(3))))
```

Output:

```text
[1, 2, 'a', 'b', 0, 1, 2]
```

`yield from` is especially handy for recursive generators, where a generator delegates to a call of itself (see Exercise 4).

## `return` and `StopIteration` inside a generator

A generator ends when its body ends: by reaching the last line or by executing `return`. A value given to `return` does not appear among the yielded items. It is stored in the `value` attribute of the `StopIteration` exception, and a `for` loop ignores it:

```python
def first_words(text, limit):
    for count, word in enumerate(text.split()):
        if count == limit:
            return "limit reached"
        yield word


gen = first_words("one two three four", 2)
print(next(gen))
print(next(gen))
try:
    next(gen)
except StopIteration as stop:
    print("StopIteration.value:", stop.value)

print(list(first_words("one two three four", 2)))
```

Output:

```text
one
two
StopIteration.value: limit reached
['one', 'two']
```

Do **not** end a generator with `raise StopIteration`. Since Python 3.7 (PEP 479), a `StopIteration` escaping from a generator body is turned into a `RuntimeError`, because such an exception is almost always a bug that would otherwise silently cut iteration short:

```python
def broken():
    yield 1
    raise StopIteration   # wrong: use return


try:
    print(list(broken()))
except RuntimeError as error:
    print("RuntimeError:", error)
```

Output:

```text
RuntimeError: generator raised StopIteration
```

## Generator states

The `inspect` module can tell you where a generator is in its life cycle:

```python
import inspect


def two_steps():
    yield "first"
    yield "second"


gen = two_steps()
print(inspect.getgeneratorstate(gen))
next(gen)
print(inspect.getgeneratorstate(gen))
gen.close()   # finish the generator early
print(inspect.getgeneratorstate(gen))
print(next(gen, "nothing left"))
```

Output:

```text
GEN_CREATED
GEN_SUSPENDED
GEN_CLOSED
nothing left
```

- `GEN_CREATED`: created, the body has not started yet.
- `GEN_SUSPENDED`: paused at a `yield`.
- `GEN_RUNNING`: currently executing (you only see it from inside the generator).
- `GEN_CLOSED`: finished, either exhausted or closed with `close()`.

> **Note:** Generators also have `send()` and `throw()` methods, which pass a value or an exception *into* a paused generator. They turn generators into simple coroutines and are the historical foundation of `asyncio`. For ordinary iteration you only need `next()` and `for`.

## Common mistakes

- **Expecting the body to run when the function is called.** A function with `yield` anywhere in it is a generator function, so calling it does nothing visible until someone iterates:

  ```python
  def save_all(items):
      for item in items:
          print("saving", item)
          yield item


  save_all(["a", "b"])          # creates a generator, saves nothing
  print("after the call")
  for _ in save_all(["a", "b"]):
      pass
  ```

  Output:

  ```text
  after the call
  saving a
  saving b
  ```

- **Iterating an exhausted generator.** A second loop over the same generator sees nothing. Call the generator function again, or store the values in a list.

- **Treating a generator like a list.** `len(gen)` raises `TypeError: object of type 'generator' has no len()`, and `gen[0]` raises `TypeError: 'generator' object is not subscriptable`. Use `list(gen)` if you really need those operations.

- **Raising `StopIteration` to end a generator.** It becomes `RuntimeError`. Use `return`.

- **Calling `next()` unguarded inside a generator.** If the inner iterator is empty, its `StopIteration` leaks out of the generator body and also becomes `RuntimeError`. Use `next(it, default)` or catch `StopIteration` and `return`.

- **Expecting `return value` to produce an item.** The returned value is attached to `StopIteration` and is ignored by `for`, `list()` and friends. Use `yield` for every value you want the consumer to see.

## Summary

- A function containing `yield` is a **generator function**. Calling it returns a **generator object** without running the body.
- `next()` runs the body up to the next `yield`, returns the yielded value, and pauses. Local variables and position survive between calls.
- Generators are iterators: they work in `for` loops and with `next()`, and they are exhausted after one pass. Call the function again for a new generator.
- A generator function replaces an entire iterator class: no `__iter__()`, no `__next__()`, no manual `StopIteration`.
- Generators are lazy, use constant memory, can be infinite, and chain into pipelines.
- `yield from iterable` re-yields every item of another iterable.
- End a generator with `return`, never with `raise StopIteration` (which becomes `RuntimeError` since Python 3.7).

## Practice

### Exercise 1: Predict the output

Without running the code, write down the exact output. Pay attention to the order of the lines.

```python
def numbers():
    print("start")
    yield 1
    print("middle")
    yield 2
    print("end")


gen = numbers()
print("created")
for n in gen:
    print("got", n)
print("done")
```

### Exercise 2: Chunks

Write a generator function `chunked(iterable, size)` that yields lists of `size` consecutive items. The last list may be shorter. For example, `chunked(range(7), 3)` yields `[0, 1, 2]`, `[3, 4, 5]`, `[6]`. It must work with any iterable, including another generator, and must not yield an empty list at the end.

### Exercise 3: A data pipeline

Given these lines of CSV text:

```python
rows = ["name,score", "Ann,91", "Bob,58", "Cid,77", "Dan,49"]
```

write three small generators and chain them:

- `parse(lines)`: skips the header and yields `(name, score)` tuples with `score` as `int`;
- `passed(records, threshold)`: yields only the records with `score >= threshold`;
- `names(records)`: yields just the names.

Print the names of everyone who scored at least 60.

### Exercise 4: Recursive flatten with `yield from`

Write a generator `flatten(items)` that yields all the non-list values from arbitrarily nested lists, left to right. `list(flatten([1, [2, [3, [4]], 5], [], [[6]]]))` must return `[1, 2, 3, 4, 5, 6]`. Use recursion and `yield from`.

## Solutions

### Exercise 1

Output:

```text
created
start
got 1
middle
got 2
end
done
```

Creating the generator prints nothing. The first `next()` (made by the `for` loop) runs the body up to `yield 1`, so `start` comes before `got 1`. The last `next()` runs from `yield 2` to the end of the body: `end` is printed, then `StopIteration` ends the loop, and `done` follows.

### Exercise 2

```python
def chunked(iterable, size):
    chunk = []
    for item in iterable:
        chunk.append(item)
        if len(chunk) == size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


print(list(chunked(range(7), 3)))
print(list(chunked("abcd", 2)))
print(list(chunked([], 3)))

squares = (n * n for n in range(5))
for part in chunked(squares, 2):
    print(part)
```

Output:

```text
[[0, 1, 2], [3, 4, 5], [6]]
[['a', 'b'], ['c', 'd']]
[]
[0, 1]
[4, 9]
[16]
```

`chunk = []` creates a **new** list after each yield. Calling `chunk.clear()` instead would empty the list the consumer just received. Since Python 3.12 the standard library has `itertools.batched(iterable, n)`, which does the same but yields tuples.

### Exercise 3

```python
rows = ["name,score", "Ann,91", "Bob,58", "Cid,77", "Dan,49"]


def parse(lines):
    lines = iter(lines)
    next(lines, None)              # skip the header (safe even if empty)
    for line in lines:
        name, score = line.split(",")
        yield name, int(score)


def passed(records, threshold):
    for name, score in records:
        if score >= threshold:
            yield name, score


def names(records):
    for name, _ in records:
        yield name


for name in names(passed(parse(rows), 60)):
    print(name)
```

Output:

```text
Ann
Cid
```

`parse()` skips the header with `next(lines, None)`. The default value matters: a bare `next(lines)` on an empty input would let `StopIteration` escape and turn into `RuntimeError`.

### Exercise 4

```python
def flatten(items):
    for item in items:
        if isinstance(item, list):
            yield from flatten(item)
        else:
            yield item


print(list(flatten([1, [2, [3, [4]], 5], [], [[6]]])))
print(list(flatten([])))
```

Output:

```text
[1, 2, 3, 4, 5, 6]
[]
```

For each nested list, `yield from flatten(item)` creates a sub-generator and passes all its values straight to the consumer. Without `yield from` you would write `for value in flatten(item): yield value`.

---

*Source: [pythontutorial.net — Python Generators](https://www.pythontutorial.net/advanced-python/python-generators/). Adapted and expanded for PyJourney.*
