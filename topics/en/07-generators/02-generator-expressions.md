# Generator Expressions

A **generator expression** creates a generator in a single line. It looks exactly like a list comprehension, but uses parentheses instead of square brackets, and instead of building a whole list at once it produces values lazily, one at a time. It is the idiomatic way to feed data into functions like `sum()`, `max()`, `any()` and `str.join()`.

## What you'll learn

- How a generator expression relates to a generator function
- The full syntax: filters, conditional values, several `for` clauses
- How to pass a generator expression to a function, with or without extra parentheses
- The differences between generator expressions and list comprehensions: syntax, memory, reusability
- Which parts of a generator expression are evaluated immediately and which later
- How to choose between a list comprehension, a generator expression and a generator function

## From a generator function to a generator expression

Here is a generator function that yields the squares of the integers from `0` to `length - 1`:

```python
def squares(length):
    for n in range(length):
        yield n ** 2


for square in squares(5):
    print(square)
```

Output:

```text
0
1
4
9
16
```

When the whole body of a generator function is "loop over something and yield an expression", you can write the same thing as a **generator expression**:

```python
squares = (n ** 2 for n in range(5))
print(type(squares))

for square in squares:
    print(square)
```

Output:

```text
<class 'generator'>
0
1
4
9
16
```

The result is an ordinary generator object, exactly like the one returned by `squares(5)` in the first example. It is an iterator, it is lazy, and it can be consumed only once.

The general form is:

```text
(expression for item in iterable if condition)
```

which behaves like this generator function:

```python
def gen(iterable):
    for item in iterable:
        if condition:
            yield expression
```

## The full syntax

Generator expressions support everything that list comprehensions support.

**A filter** with `if` keeps only some items:

```python
multiples_of_3 = (n for n in range(10) if n % 3 == 0)
print(list(multiples_of_3))
```

Output:

```text
[0, 3, 6, 9]
```

**A conditional expression** chooses the produced value. Note that it goes *before* `for`, while a filter goes *after*:

```python
labels = ("even" if n % 2 == 0 else "odd" for n in range(4))
print(list(labels))
```

Output:

```text
['even', 'odd', 'even', 'odd']
```

**Several `for` clauses** work like nested loops, the leftmost being the outermost:

```python
pairs = ((letter, number) for letter in "ab" for number in (1, 2))
print(list(pairs))
```

Output:

```text
[('a', 1), ('a', 2), ('b', 1), ('b', 2)]
```

This is the same as:

```python
def pairs_gen():
    for letter in "ab":
        for number in (1, 2):
            yield letter, number


print(list(pairs_gen()))
```

Output:

```text
[('a', 1), ('a', 2), ('b', 1), ('b', 2)]
```

**Nested comprehensions** are allowed too. Here each item produced by the generator is itself a list, built by an inner list comprehension:

```python
table = ([row * col for col in range(1, 4)] for row in range(1, 4))

for line in table:
    print(line)
```

Output:

```text
[1, 2, 3]
[2, 4, 6]
[3, 6, 9]
```

> **Tip:** If a generator expression needs more than two `for` clauses or a complicated condition, rewrite it as a generator function. A readable five-line function is better than a clever one-liner.

## Passing a generator expression to a function

The most common use of a generator expression is as an argument to a function that consumes an iterable. When it is the **only** argument, you can drop its own parentheses, because the call's parentheses already surround it:

```python
words = ["generator", "yield", "lazy", "iterator"]

print(sum(len(word) for word in words))
print(max(len(word) for word in words))
print(", ".join(word.upper() for word in words if len(word) > 4))
print(dict((word, len(word)) for word in words))
```

Output:

```text
26
9
GENERATOR, YIELD, ITERATOR
{'generator': 9, 'yield': 5, 'lazy': 4, 'iterator': 8}
```

If the function takes other arguments as well, the generator expression **must** have its own parentheses:

```python
words = ["generator", "yield", "lazy", "iterator"]

print(sorted((len(word) for word in words), reverse=True))
```

Output:

```text
[9, 8, 5, 4]
```

Without the inner parentheses, `sorted(len(word) for word in words, reverse=True)` is a `SyntaxError: Generator expression must be parenthesized`.

### Short-circuiting with `any()` and `all()`

Because values are produced on demand, `any()` and `all()` can stop as soon as they know the answer. A list comprehension computes every value first:

```python
def is_big(n):
    print("  checking", n)
    return n > 10


numbers = [3, 15, 7, 20]

print("generator expression:")
print(any(is_big(n) for n in numbers))

print("list comprehension:")
print(any([is_big(n) for n in numbers]))
```

Output:

```text
generator expression:
  checking 3
  checking 15
True
list comprehension:
  checking 3
  checking 15
  checking 7
  checking 20
True
```

With the generator expression, `any()` stopped at `15`, the first big number. With the list, all four checks ran before `any()` even started. If `is_big()` were an expensive check (a network request, a database query), the difference would matter a lot.

## Generator expressions vs list comprehensions

```python
square_list = [n ** 2 for n in range(5)]
square_generator = (n ** 2 for n in range(5))

print(square_list)
print(type(square_generator).__name__)
```

Output:

```text
[0, 1, 4, 9, 16]
generator
```

### Syntax

A list comprehension uses square brackets `[]`. A generator expression uses parentheses `()`. Everything inside is the same.

### Eager vs lazy, and memory

A list comprehension is **eager**: it computes all elements right away and stores the complete list in memory. A generator expression is **lazy**: it stores only its current state and computes the next element when asked. Its memory use does not depend on how many elements it will produce:

```python
import sys

big_list = [n ** 2 for n in range(1_000_000)]
big_gen = (n ** 2 for n in range(1_000_000))

print(sys.getsizeof(big_list))
print(sys.getsizeof(big_gen))
```

Output (Python 3.14, 64-bit; the exact numbers vary between versions):

```text
8448728
208
```

The list's size grows with the number of elements, and `getsizeof()` does not even count the integer objects it refers to. The generator stays at a couple of hundred bytes.

### Reusable iterable vs one-shot iterator

A list comprehension returns a list, which is an **iterable**: you can loop over it as many times as you like. A generator expression returns a generator, which is an **iterator**: after one complete pass it is exhausted.

```python
square_list = [n ** 2 for n in range(5)]
square_generator = (n ** 2 for n in range(5))

print(sum(square_list), sum(square_list))
print(sum(square_generator), sum(square_generator))
```

Output:

```text
30 30
30 0
```

The second `sum()` over the generator found no values left.

### Sequence features

A list supports `len()`, indexing, slicing, `reversed()`, sorting in place and being printed in full. A generator supports only iteration. `len()` on it raises `TypeError: object of type 'generator' has no len()`, and printing it shows only a description such as `<generator object <genexpr> at 0x...>` (the address varies).

| | List comprehension `[...]` | Generator expression `(...)` |
|---|---|---|
| Result | `list` | generator (an iterator) |
| Evaluation | eager, all at once | lazy, one item per request |
| Memory | grows with the number of items | small and constant |
| Can be iterated | many times | once |
| `len()`, indexing, slicing | yes | no |
| Works with infinite input | no | yes |
| Best for | data you will reuse or inspect | data you consume once |

> **Note:** Python also has set comprehensions `{...}` and dict comprehensions `{k: v ...}`, but there is **no tuple comprehension**. `(x for x in data)` is always a generator. To get a tuple, write `tuple(x for x in data)`.

## When are the parts evaluated?

A generator expression evaluates the iterable of its **first** `for` clause **immediately**, when the expression is created. Everything else (the output expression, the conditions, any further `for` clauses) runs **lazily**, during iteration. This has a few visible consequences.

Rebinding a name after creating the generator does not change which object it iterates over, because that object was already captured:

```python
numbers = [1, 2, 3]
gen = (n * 10 for n in numbers)
numbers = [7, 8, 9]   # rebinding the name: gen still holds the old list
print(list(gen))
```

Output:

```text
[10, 20, 30]
```

But *mutating* that same list before iterating is visible, since the generator reads the list only when asked for items:

```python
numbers = [1, 2, 3]
gen = (n * 10 for n in numbers)
numbers.append(4)
print(list(gen))
```

Output:

```text
[10, 20, 30, 40]
```

Other variables used in the expression are looked up when each value is produced, so their **current** value is used:

```python
factor = 10
gen = (n * factor for n in range(3))
factor = 100
print(list(gen))
```

Output:

```text
[0, 100, 200]
```

The same rule decides when errors appear. A non-iterable in the first `for` fails at once, while an error in the expression appears only when that item is produced:

```python
try:
    gen = (x for x in 5)
except TypeError as error:
    print("at creation:", error)

gen = (1 / n for n in [1, 0])     # created without problems
print(next(gen))
try:
    next(gen)
except ZeroDivisionError as error:
    print("during iteration:", error)
```

Output:

```text
at creation: 'int' object is not iterable
1.0
during iteration: division by zero
```

Finally, like comprehensions in Python 3, a generator expression has its own scope: its loop variable does not leak into the surrounding code.

## Choosing the right tool

- Use a **list comprehension** when you need the results more than once, need `len()` or indexing, want to sort or print them, or the data is small.
- Use a **generator expression** when you pass the values straight into a consuming function (`sum`, `max`, `min`, `any`, `all`, `"".join`, `set`, `dict`), when the data is large or infinite, or when you build a lazy pipeline.
- Use a **generator function** when the logic does not fit into one readable expression: several statements, `try`/`except`, state kept across items, or `return` with a value.

## Common mistakes

- **Expecting a tuple.** Parentheses around a comprehension make a generator, not a tuple. Use `tuple(...)`.

- **Printing a generator to see its values.** `print(gen)` shows `<generator object <genexpr> at 0x...>`. Use `print(list(gen))` for debugging, keeping in mind that this consumes the generator.

- **Reusing an exhausted generator expression.** Computing two statistics from the same generator gives wrong results for the second one:

  ```python
  prices = (float(p) for p in ["4.5", "10", "2.5"])
  print(max(prices))
  print(sum(prices))   # nothing left: 0
  ```

  Output:

  ```text
  10.0
  0
  ```

  Build a list once (`prices = [float(p) for p in ...]`) if you need several passes.

- **Dropping the parentheses when the function has other arguments.** `sorted(x for x in data, key=abs)` is a `SyntaxError`. Write `sorted((x for x in data), key=abs)`, or simply `sorted(data, key=abs)`.

- **Forgetting late evaluation.** Variables in the expression are read when the values are produced. If you change them between creating and consuming the generator, the new values are used.

- **Using a generator in nested loops.** `for a in gen: for b in gen: ...` shares one iterator between both loops (see *Iterator vs Iterable*). Use a list for data you loop over more than once.

## Summary

- A generator expression `(expr for item in iterable if cond)` is a compact way to create a generator.
- It supports filters, conditional expressions, several `for` clauses and nested comprehensions, just like a list comprehension.
- As the sole argument of a call, it needs no extra parentheses: `sum(x * x for x in data)`.
- List comprehensions are eager and return a reusable list. Generator expressions are lazy, use constant memory, and return a one-shot iterator.
- The first `for` clause's iterable is evaluated immediately; everything else is evaluated during iteration.
- Prefer generator expressions for data consumed once (especially with `sum`, `any`, `all`, `join`), list comprehensions for data you reuse, and generator functions for complex logic.

## Practice

### Exercise 1: Rewrite as a generator expression

Rewrite this generator function as a single generator expression, then use it to print the sum of the squares of the even numbers from `1` to `10`. Pass it to `sum()` without extra parentheses.

```python
def even_squares(numbers):
    for n in numbers:
        if n % 2 == 0:
            yield n * n
```

### Exercise 2: Predict the output

Write down what this code prints before running it.

```python
data = [1, 2, 3]
gen = (x + offset for x in data)
offset = 10
data.append(4)
data = [100]

print(next(gen))
print(list(gen))
print(list(gen))
```

### Exercise 3: Text statistics

For `text = "Python generators are Lazy and Python lists are Eager"`, use generator expressions (passed directly to built-in functions, no lists) to compute:

1. the length of the longest word;
2. how many words start with a capital letter;
3. whether any word is longer than 9 characters;
4. a string of the first letters of all words, for example `"PgaLaPlaE"`.

### Exercise 4: A lazy pipeline

The list below stands in for the lines of a large configuration file. Using only generator expressions chained together, compute the sum of all the numbers, skipping empty lines and comment lines that start with `#` (after stripping whitespace).

```python
lines = ["# limits", "10", "  25  ", "", "# more", "7", "   "]
```

## Solutions

### Exercise 1

```python
numbers = range(1, 11)
print(sum(n * n for n in numbers if n % 2 == 0))
```

Output:

```text
220
```

The filter `if n % 2 == 0` keeps `2, 4, 6, 8, 10`, and `4 + 16 + 36 + 64 + 100 = 220`.

### Exercise 2

Output:

```text
11
[12, 13, 14]
[]
```

- The list object `[1, 2, 3]` was captured when `gen` was created. Rebinding `data` to `[100]` later does not affect `gen`.
- `data.append(4)` mutated that captured list *before* `data` was rebound, so the generator sees `1, 2, 3, 4`.
- `offset` is read during iteration, when it is already `10`. (Had iteration started before `offset = 10`, you would get a `NameError`.)
- The second `list(gen)` is empty because the generator is exhausted.

### Exercise 3

```python
text = "Python generators are Lazy and Python lists are Eager"
words = text.split()

print(max(len(word) for word in words))
print(sum(1 for word in words if word[0].isupper()))
print(any(len(word) > 9 for word in words))
print("".join(word[0] for word in words))
```

Output:

```text
10
4
True
PgaLaPlaE
```

`sum(1 for ... if ...)` is a common idiom for counting items that match a condition without building a list. Here `words` is a list because it is used four times. Each generator expression over it is created fresh, so nothing is exhausted.

### Exercise 4

```python
lines = ["# limits", "10", "  25  ", "", "# more", "7", "   "]

stripped = (line.strip() for line in lines)
meaningful = (line for line in stripped if line and not line.startswith("#"))
total = sum(int(line) for line in meaningful)

print(total)
```

Output:

```text
42
```

Each stage is a generator expression over the previous one, so nothing is computed until `sum()` starts pulling values. Then every line flows through all three stages before the next line is read. With a real file you would write `stripped = (line.strip() for line in file)` and the program would use the same small amount of memory for a file of any size.

---

*Source: [pythontutorial.net — Python Generator Expressions](https://www.pythontutorial.net/advanced-python/python-generator-expressions/). Adapted and expanded for PyJourney.*
