# AND Operator

The `and` operator combines conditions: "this **and** that must hold". In Python it does more than produce `True` or `False`. It stops evaluating as soon as the answer is known (short-circuiting) and returns one of its operands, not necessarily a boolean. Both properties matter for writing safe conditions and for reading other people's code.

## What you'll learn

- The truth table of `and`
- What short-circuit evaluation is and how to use it as a guard
- Why `x and y` returns `x` or `y` rather than `True`/`False`
- How `and` interacts with `or`, `not` and comparisons (precedence)
- The difference between `and` and the bitwise `&`
- When `all()` is a better fit than a long chain of `and`

## The and operator and its truth table

`and` is a logical operator. Most often you use it with two boolean expressions, and it returns `True` only when **both** are true:

| X | Y | X and Y |
|---|---|---|
| True | True | True |
| True | False | False |
| False | True | False |
| False | False | False |

The table shows two things worth remembering:

- If `X` is `False`, the result is `False` whatever `Y` is.
- If `X` is `True`, the result is simply whatever `Y` is.

```python
timeout = False
pending_job = True
execute_next = timeout and pending_job

print(execute_next)
```

Output:

```text
False
```

`timeout` is `False`, so the whole expression is `False`.

## Short-circuit evaluation

Because a false left operand already decides the result, Python **does not evaluate the right operand** in that case. This is called *short-circuit evaluation*.

Here is code that fails:

```python
a = 10
b = 0
c = a / b
print(c)
```

Output (last line of the traceback):

```text
ZeroDivisionError: division by zero
```

Put the division behind `and`, and the error disappears:

```python
a = 10
b = 0
c = b and a / b
print(c)
```

Output:

```text
0
```

`b` is `0`, which is falsy. Python knows the result already, so `a / b` is never computed. If `b` is non-zero, the right side runs normally:

```python
a = 10
b = 5
c = b and a / b
print(c)
```

Output:

```text
2.0
```

You can watch short-circuiting happen with a helper that announces each evaluation:

```python
def check(name, result):
    print(f"evaluating {name}")
    return result


print(check("left", False) and check("right", True))
print("---")
print(check("left", True) and check("right", True))
```

Output:

```text
evaluating left
False
---
evaluating left
evaluating right
True
```

### Using `and` as a guard

Short-circuiting lets the left operand protect the right one. The left side checks that the right side is safe to evaluate:

```python
class User:
    def __init__(self, name, is_active):
        self.name = name
        self.is_active = is_active


def greet(user):
    if user is not None and user.is_active:
        print(f"Welcome back, {user.name}!")
    else:
        print("Please sign in.")


greet(User("Olena", True))
greet(User("Taras", False))
greet(None)

items = []
if items and items[0] == "urgent":
    print("handle urgent item first")
print("no crash on an empty list")
```

Output:

```text
Welcome back, Olena!
Please sign in.
Please sign in.
no crash on an empty list
```

For `None`, `user.is_active` is never evaluated, so there is no `AttributeError`. For an empty list, `items[0]` is never evaluated, so there is no `IndexError`. **The order of operands matters**: the guard must come first.

## and returns one of its operands

`and` works with any objects, not just booleans, because every object has a truth value. The precise rule is:

> `x and y` returns `x` if `x` is falsy. Otherwise it evaluates `y` and returns `y`.

So the result is always one of the operands themselves:

```python
print(repr(0 and 5))
print(repr(3 and 5))
print(repr("" and "hi"))
print(repr([1] and "hi"))
print(repr(None and 1))
print(repr(1 and 2 and 3))
print(repr(1 and 0 and 3))
```

Output:

```text
0
5
''
'hi'
None
3
0
```

With several operands, `a and b and c` returns the **first falsy** operand, or the **last** operand if all are truthy.

The expression `c = b and a / b` is therefore equivalent to this `if` statement:

```python
a, b = 10, 0

c = b and a / b

if b:
    d = a / b
else:
    d = b

print(c, d)
```

Output:

```text
0 0
```

When the result goes into an `if` or `while`, none of this matters: Python only looks at its truth value, and the truth value of `x and y` is exactly `bool(x) and bool(y)`. It matters when you store or return the result, as the next example shows.

## Example: computing an average

Here is a function that returns the average of its arguments, or `0` when there are none:

```python
def avg(*numbers):
    total = sum(numbers)
    n = len(numbers)
    if n > 0:
        return total / n
    return 0


if __name__ == "__main__":
    print(avg(1, 2, 3))
    print(avg())
```

Output:

```text
2.0
0
```

The `if` block can be shortened with `and`. When `n` is `0`, the expression returns `n` (that is `0`) without dividing. Otherwise it returns `total / n`:

```python
def avg(*numbers):
    total = sum(numbers)
    n = len(numbers)
    return n and total / n


print(avg(1, 2, 3))
print(avg())
print(type(avg(1, 2, 3)).__name__, type(avg()).__name__)
```

Output:

```text
2.0
0
float int
```

It works, but notice the last line: the function returns a `float` in one case and an `int` in the other. Many readers also have to stop and think about what `n and total / n` means. A conditional expression is just as short, more explicit, and lets you choose the type of the fallback value:

```python
def avg(*numbers):
    n = len(numbers)
    return sum(numbers) / n if n else 0.0


print(avg(1, 2, 3))
print(avg())
```

Output:

```text
2.0
0.0
```

> **Tip:** Use the value-returning behaviour of `and` when it makes code clearer, for example `text and text[0]`. If you have to explain the trick in a comment, an `if` or a conditional expression is usually the better choice.

## Precedence: not, and, or

The logical operators have different priorities: `not` binds tightest, then `and`, then `or`. All comparison operators (`<`, `==`, `in`, `is`, ...) bind tighter than any of them.

```python
print(True or False and False)    # and first: True or (False and False)
print((True or False) and False)

x = 5
print(not x > 3 and x < 10)       # (not (x > 3)) and (x < 10)
print(x > 0 and x < 10)
print(0 < x < 10)                 # chained comparison, same meaning
```

Output:

```text
True
False
False
True
True
```

When you mix `and` and `or`, add parentheses even if they are not strictly needed. Readers should not have to remember the precedence table.

A chained comparison such as `0 < x < 10` means `0 < x and x < 10`, except that `x` is evaluated only once. It short-circuits as well.

## and versus the bitwise &

`&` is the **bitwise** AND operator. It is a different tool:

- It always evaluates both operands (no short-circuiting).
- On integers it combines bits; on `bool` values it returns a `bool`.
- It binds **tighter** than comparisons, which leads to surprising results.

```python
print(True & False)
print(6 & 3)       # bitwise: 110 & 011 = 010

x = 5
print(x > 0 and x < 3)
print(x > 0 & x < 3)       # parsed as x > (0 & x) < 3
print((x > 0) & (x < 3))
```

Output:

```text
False
2
False
True
False
```

The fourth line is wrong in a subtle way: `0 & x` is computed first, giving `0`, and the result is the chained comparison `x > 0 < 3`. And `&` gives up short-circuiting:

```python
def check(name, result):
    print(f"evaluating {name}")
    return result


print(check("left", False) & check("right", True))
```

Output:

```text
evaluating left
evaluating right
False
```

Use `and` for logic. You will meet `&` with booleans mainly in NumPy and pandas, where `and` cannot work element by element. There you must always parenthesise the comparisons: `(a > 0) & (a < 3)`.

## all(): and for many conditions

When you have many conditions or a collection of values, `all()` reads better than a long `and` chain. `all(iterable)` returns `True` if every item is truthy. With a generator expression it short-circuits too, stopping at the first falsy item:

```python
order = {"paid": True, "items": 3, "address": ""}

ready = all([
    order["paid"],
    order["items"] > 0,
    order["address"],
])
print(ready)


def positive(n):
    print(f"checking {n}")
    return n > 0


print(all(positive(n) for n in [3, -1, 2]))
print(all([]))
```

Output:

```text
False
checking 3
checking -1
False
True
```

Two details: a *list* inside `all([...])` is built completely before `all()` starts, so all of its items are evaluated; only a generator is lazy. And `all()` of an empty iterable is `True`, because no item is falsy.

## Common mistakes

- **Putting the guard second.** The left operand is evaluated first, so a check that protects the right side must be on the left:

  ```python
  items = []
  if items[0] == "urgent" and items:
      print("urgent")
  ```

  Output (last line of the traceback):

  ```text
  IndexError: list index out of range
  ```

  Write `if items and items[0] == "urgent":` instead.

- **Expecting `and` to return a bool.** When you store or print the result, you get one of the operands:

  ```python
  name = None
  display = name and name.upper()
  print(f"Hello, {display}!")
  ```

  Output:

  ```text
  Hello, None!
  ```

  Use `bool(x and y)` if you need a real boolean, or handle the fallback explicitly.

- **Using `&` instead of `and` with comparisons.** `x > 0 & x < 3` does not mean what it looks like, and `&` never short-circuits.
- **Hiding side effects behind `and`.** `is_valid and save()` silently skips `save()` when `is_valid` is falsy. An explicit `if is_valid: save()` says what you mean.
- **Mixed return types.** `n and total / n` returns `0` (an `int`) in one case and a `float` in the other. Prefer a conditional expression when the type matters.

## Summary

- `x and y` is true only when both operands are true.
- `and` short-circuits: if `x` is falsy, `y` is never evaluated. Use this to guard risky operations, and put the guard first.
- `x and y` returns `x` if `x` is falsy, otherwise `y`. A chain returns the first falsy operand or the last one.
- In `if`/`while` conditions only the truth value matters. When you store the result, remember that it may not be a `bool`.
- Precedence: comparisons, then `not`, then `and`, then `or`. Use parentheses when mixing them.
- `&` is bitwise AND: no short-circuiting and higher precedence than comparisons.
- `all()` is the readable version of a long `and` chain, and it short-circuits with generators.

## Practice

### Exercise 1: Predict the output

Without running the code, write down what each line prints. Then check.

```python
print(repr(0 and 1))
print(repr(1 and 0))
print(repr("a" and "b"))
print(repr([] and None))
print(repr(None and []))
print(repr(2 and 3 and 4))
print(repr(2 and 0 and 4))
print(repr(True and "yes"))
```

### Exercise 2: First character, safely

Write a one-line function `first_char(text)` that returns the first character of `text`. For an empty string it must return `""`, and for `None` it must return `None`, without raising an exception and without an `if` statement.

### Exercise 3: Fix the crash

This function decides whether a cart qualifies for a discount (average price per item above 50). It crashes for an empty cart. Fix it by changing only the order of the conditions, and test it with an empty cart.

```python
def has_discount(cart):
    return cart["total"] / cart["items"] > 50 and cart["items"] > 0


print(has_discount({"total": 120, "items": 2}))
print(has_discount({"total": 0, "items": 0}))
```

### Exercise 4: Password strength

Write `is_strong(password)` that returns `True` only if the password is at least 8 characters long **and** contains at least one digit, one uppercase letter and one lowercase letter. Use a single `return` with `and` and `any()`. Test it with `"short1A"`, `"longpassword"`, `"LongPassword"` and `"LongPassw0rd"`.

## Solutions

### Exercise 1

Output:

```text
0
0
'b'
[]
None
4
0
'yes'
```

`and` returns the first falsy operand (`0`, `0`, `[]`, `None`, `0`) or, if there is none, the last operand (`'b'`, `4`, `'yes'`).

### Exercise 2

```python
def first_char(text):
    return text and text[0]


print(repr(first_char("Python")))
print(repr(first_char("")))
print(repr(first_char(None)))
```

Output:

```text
'P'
''
None
```

For `""` and `None` the left operand is falsy, so it is returned as is and `text[0]` is never evaluated.

### Exercise 3

```python
def has_discount(cart):
    return cart["items"] > 0 and cart["total"] / cart["items"] > 50


print(has_discount({"total": 120, "items": 2}))
print(has_discount({"total": 120, "items": 3}))
print(has_discount({"total": 0, "items": 0}))
```

Output:

```text
True
False
False
```

With the guard first, the division is skipped when `cart["items"]` is `0`.

### Exercise 4

```python
def is_strong(password):
    return (
        len(password) >= 8
        and any(ch.isdigit() for ch in password)
        and any(ch.isupper() for ch in password)
        and any(ch.islower() for ch in password)
    )


for password in ["short1A", "longpassword", "LongPassword", "LongPassw0rd"]:
    print(f"{password:<14} {is_strong(password)}")
```

Output:

```text
short1A        False
longpassword   False
LongPassword   False
LongPassw0rd   True
```

The parentheses let the expression span several lines. Thanks to short-circuiting, the cheap length check runs first, and the character scans run only while all previous checks have passed.

---

*Source: [pythontutorial.net — Python and Logical Operator](https://www.pythontutorial.net/advanced-python/python-and/). Adapted and expanded for PyJourney.*
