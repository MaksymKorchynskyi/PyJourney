# assertIn()

Many tests do not need the exact value of a result, only to know that it contains something: a tag in a list, a word in a message, a key in a dict. `assertIn()` checks membership with the `in` operator, and `assertNotIn()` checks that something is absent, which is just as useful (for example, "the log must not contain the password").

## What you'll learn

- What `assertIn(member, container, msg=None)` and `assertNotIn()` check
- How their failure messages look
- How `in` behaves for lists, strings, dicts, sets, ranges and generators, and what that means for your tests
- How to check dict values, key-value pairs and "this dict contains at least these items"
- The typical traps: swapped arguments, consumed generators, unhashable members

## How `assertIn()` works

```python
assertIn(member, container, msg=None)
```

The test passes when `member in container` is true. The order of the arguments follows the `in` expression: the **member first**, the **container second**.

```python
import unittest


class TestIn(unittest.TestCase):
    def test_in_list(self):
        self.assertIn(1, [1, 2, 3])

    def test_in_string(self):
        self.assertIn("python", "python tutorial")


class TestNotIn(unittest.TestCase):
    def test_not_in_list(self):
        self.assertNotIn(0, [1, 2, 3])

    def test_not_in_string(self):
        self.assertNotIn("java", "python tutorial")
```

Output of `python3 -m unittest -v` (the file is `test_membership.py`):

```text
test_in_list (test_membership.TestIn.test_in_list) ... ok
test_in_string (test_membership.TestIn.test_in_string) ... ok
test_not_in_list (test_membership.TestNotIn.test_not_in_list) ... ok
test_not_in_string (test_membership.TestNotIn.test_not_in_string) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

`assertNotIn(member, container, msg=None)` passes when `member not in container`. For a list, `in` looks for an **element**. For a string, it looks for a **substring**, which is why `"python"` is found in `"python tutorial"`.

## Failure messages

Both methods show the member and the whole container:

```python
import unittest


class TestFailures(unittest.TestCase):
    def test_missing_item(self):
        fruits = ["apple", "banana"]
        self.assertIn("kiwi", fruits)

    def test_case_matters(self):
        self.assertIn("Python", "python tutorial")

    def test_unexpected_item(self):
        log = "user logged in; password=secret"
        self.assertNotIn("password", log, "the log must not contain credentials")
```

The `AssertionError` lines of `python3 -m unittest test_failures` (in alphabetical order of the tests):

```text
AssertionError: 'Python' not found in 'python tutorial'
AssertionError: 'kiwi' not found in ['apple', 'banana']
AssertionError: 'password' unexpectedly found in 'user logged in; password=secret' : the log must not contain credentials
```

Seeing the container is the big advantage over `assertTrue("kiwi" in fruits)`, which would only say `False is not true`. The second line is a reminder that string comparison is case-sensitive.

> **Note:** The container is printed in full, without shortening. If a list has thousands of items, the failure message has thousands of items too (a 1,000-integer list produces a message of almost 5,000 characters). For big containers, consider checking a smaller, relevant part, or add a `msg` that summarises the situation.

## What `in` means for different containers

`assertIn()` adds nothing to the `in` operator, so its behaviour depends entirely on the container:

| Container | `member in container` checks | Example that passes |
|---|---|---|
| `list`, `tuple` | an element equal to `member` (`==`) | `assertIn(2, [1, 2, 3])` |
| `str` | a substring | `assertIn("tut", "python tutorial")` |
| `dict` | a **key** | `assertIn("city", {"city": "Lviv"})` |
| `set`, `frozenset` | an element, via hashing | `assertIn("a", {"a", "b"})` |
| `range` | a number in the range, computed without iterating | `assertIn(10**9, range(0, 2 * 10**9, 2))` |
| generator, iterator | an element, by **consuming** items until one matches | see the traps below |

Because lists compare with `==`, `assertIn(1, [True])` and `assertIn(1.0, [1])` pass. And because every string contains the empty string, `assertIn("", "abc")` passes too.

A list is searched for an *element*, never a sub-sequence: `assertIn([1, 2], [1, 2, 3])` fails, because no single element of the list equals `[1, 2]`.

### Dicts: keys, values and items

With a dict, `in` checks **keys** only. To check values or key-value pairs, use the dict views:

```python
import unittest


class TestUser(unittest.TestCase):
    def setUp(self):
        self.user = {"name": "olena", "city": "Lviv", "roles": ["editor"]}

    def test_has_key(self):
        self.assertIn("city", self.user)

    def test_value_is_not_a_key(self):
        self.assertIn("Lviv", self.user)

    def test_has_value(self):
        self.assertIn("Lviv", self.user.values())

    def test_has_item(self):
        self.assertIn(("city", "Lviv"), self.user.items())

    def test_contains_subset(self):
        expected = {"city": "Lviv", "roles": ["editor"]}
        self.assertLessEqual(expected.items(), self.user.items())

    def test_missing_key(self):
        self.assertNotIn("password", self.user)
```

Output of `python3 -m unittest test_user -v` (paths shortened):

```text
test_contains_subset (test_user.TestUser.test_contains_subset) ... ok
test_has_item (test_user.TestUser.test_has_item) ... ok
test_has_key (test_user.TestUser.test_has_key) ... ok
test_has_value (test_user.TestUser.test_has_value) ... ok
test_missing_key (test_user.TestUser.test_missing_key) ... ok
test_value_is_not_a_key (test_user.TestUser.test_value_is_not_a_key) ... FAIL

======================================================================
FAIL: test_value_is_not_a_key (test_user.TestUser.test_value_is_not_a_key)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../test_user.py", line 12, in test_value_is_not_a_key
    self.assertIn("Lviv", self.user)
    ~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^
AssertionError: 'Lviv' not found in {'name': 'olena', 'city': 'Lviv', 'roles': ['editor']}

----------------------------------------------------------------------
Ran 6 tests in 0.000s

FAILED (failures=1)
```

- `"Lviv"` is a value, not a key, so `assertIn("Lviv", self.user)` fails, even though the message clearly shows `'Lviv'` inside the dict.
- `user.values()` and `user.items()` make values and `(key, value)` pairs searchable.
- To check that a dict contains **at least** some key-value pairs (and possibly more), compare the item views with `assertLessEqual()`: `dict.items()` behaves like a set, so `<=` means "is a subset of". It works even when the values are lists. On failure, the message shows both views, for example `dict_items([('host', 'localhost'), ('port', 5433)]) not less than or equal to dict_items([...])`.

> **Note:** Older code may use `assertDictContainsSubset()` for the last check. That method was deprecated for years and removed in Python 3.12.

## Traps

```python
import unittest


def even_numbers(limit):
    return (n for n in range(limit) if n % 2 == 0)


class TestPitfalls(unittest.TestCase):
    def test_generator_is_consumed(self):
        numbers = even_numbers(10)
        self.assertIn(4, numbers)
        self.assertIn(2, numbers)

    def test_swapped_arguments(self):
        self.assertIn([1, 2, 3], 1)

    def test_unhashable_member(self):
        self.assertIn([1, 2], {(1, 2), (3, 4)})
```

The `FAIL`/`ERROR` lines and the last line of each traceback from `python3 -m unittest test_pitfalls` (the generator address varies):

```text
ERROR: test_swapped_arguments (test_pitfalls.TestPitfalls.test_swapped_arguments)
TypeError: argument of type 'int' is not a container or iterable

ERROR: test_unhashable_member (test_pitfalls.TestPitfalls.test_unhashable_member)
TypeError: cannot use 'list' as a set element (unhashable type: 'list')

FAIL: test_generator_is_consumed (test_pitfalls.TestPitfalls.test_generator_is_consumed)
AssertionError: 2 not found in <generator object even_numbers.<locals>.<genexpr> at 0x104a9c930>
```

- **A generator is consumed by `in`.** To find `4`, `in` takes `0`, `2` and `4` out of the generator. The second check starts at `6` and never sees `2`. The message does not help either: a generator's `repr()` does not show its items. Convert to a list first: `numbers = list(even_numbers(10))`.
- **Swapped arguments** turn the check into `[1, 2, 3] in 1`, which raises `TypeError`, so the test ends with `ERROR`. With two strings, swapped arguments do not crash. They just check the opposite: `assertIn("python tutorial", "python")` fails, because the long string is not inside the short one.
- **An unhashable member with a set or dict** (`[1, 2]` is a list) raises `TypeError`. Use a tuple, `(1, 2)`, which is how the set stores it.

## Common mistakes

- **Expecting `assertIn()` to search dict values.** For a dict it checks keys. Use `.values()` or `.items()`.
- **Swapping `member` and `container`.** The member comes first, as in `member in container`.
- **Checking a generator or iterator more than once.** Each `in` consumes items. Convert to a list first.
- **Expecting a sub-list check.** `assertIn([1, 2], [1, 2, 3])` fails. To check that several items are present, use a loop with `subTest()`, or compare sets: `assertLessEqual({1, 2}, set(result))`.
- **Forgetting that strings are case-sensitive and that `""` is in every string.** Normalise case explicitly when it should not matter, and never use an empty string as an expected member.
- **Using `assertTrue(x in items)`.** It hides both values. `assertIn(x, items)` shows them.
- **Using the removed `assertDictContainsSubset()`.** Use `assertLessEqual(expected.items(), actual.items())`.

## Summary

- `assertIn(member, container, msg=None)` passes when `member in container`. `assertNotIn()` passes when `member not in container`.
- Failure messages show the member and the full container: `'kiwi' not found in ['apple', 'banana']` and `'password' unexpectedly found in '...'`.
- The meaning of `in` depends on the container: element (list, tuple, set), substring (str), key (dict), number (range).
- For dicts, use `.values()` and `.items()` to check values and pairs, and `assertLessEqual(expected.items(), actual.items())` for "contains at least these items".
- Generators are consumed by `in`: convert them to a list before several checks.
- Swapped arguments and unhashable members raise `TypeError`, so the test ends with `ERROR`, not `FAIL`.

## Practice

### Exercise 1: Hashtags

`hashtags.py` contains:

```python
import re


def extract_hashtags(text):
    return [tag.lower() for tag in re.findall(r"#(\w+)", text)]
```

For the text `"Learning #Python and #unittest today"`, write tests that check: `"python"` and `"unittest"` are among the tags; the plain word `"learning"` is not; the tags are normalised (neither `"Python"` nor `"#python"` appears). Add a test that a text without hashtags gives an empty list.

### Exercise 2: Check a configuration

`config.py` contains:

```python
def load_config():
    return {
        "debug": False,
        "database": {"host": "localhost", "port": 5432, "pool_size": 5},
        "features": ["search", "export"],
    }
```

Write tests that check: the config has a `"database"` section; `"export"` is one of the features; there is no `"secret_key"` key; the database settings contain at least `host="localhost"` and `port=5432` (more keys may be added later, so do not compare the whole dict).

### Exercise 3: The test that cannot see

`ids.py` contains a generator function:

```python
def read_ids(lines):
    for line in lines:
        line = line.strip()
        if line.isdigit():
            yield int(line)
```

This test passes, although its second assertion is wrong (`5` *is* one of the IDs):

```python
import unittest

from ids import read_ids


class TestReadIds(unittest.TestCase):
    def test_ids(self):
        ids = read_ids(["3", "x", "5", "7"])
        self.assertIn(7, ids)
        self.assertNotIn(5, ids)
```

Explain why it passes, then rewrite the tests so that they check the real result.

## Solutions

### Exercise 1

```python
import unittest

from hashtags import extract_hashtags


class TestExtractHashtags(unittest.TestCase):
    def setUp(self):
        self.tags = extract_hashtags("Learning #Python and #unittest today")

    def test_contains_tags(self):
        self.assertIn("python", self.tags)
        self.assertIn("unittest", self.tags)

    def test_plain_words_are_not_tags(self):
        self.assertNotIn("learning", self.tags)

    def test_tags_are_normalised(self):
        self.assertNotIn("Python", self.tags)
        self.assertNotIn("#python", self.tags)

    def test_no_tags(self):
        self.assertEqual(extract_hashtags("no tags here"), [])
```

Output of `python3 -m unittest test_hashtags -v`:

```text
test_contains_tags (test_hashtags.TestExtractHashtags.test_contains_tags) ... ok
test_no_tags (test_hashtags.TestExtractHashtags.test_no_tags) ... ok
test_plain_words_are_not_tags (test_hashtags.TestExtractHashtags.test_plain_words_are_not_tags) ... ok
test_tags_are_normalised (test_hashtags.TestExtractHashtags.test_tags_are_normalised) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

`self.tags` is a list, so `assertIn()` looks for whole elements: `"pyth"` would *not* be found, unlike in a string. For the empty case, `assertEqual(..., [])` is the precise check: there is no member to look for.

### Exercise 2

```python
import unittest

from config import load_config


class TestConfig(unittest.TestCase):
    def setUp(self):
        self.config = load_config()

    def test_has_database_section(self):
        self.assertIn("database", self.config)

    def test_export_enabled(self):
        self.assertIn("export", self.config["features"])

    def test_no_secret_key(self):
        self.assertNotIn("secret_key", self.config)

    def test_database_settings(self):
        expected = {"host": "localhost", "port": 5432}
        self.assertLessEqual(expected.items(), self.config["database"].items())
```

Output of `python3 -m unittest test_config -v`:

```text
test_database_settings (test_config.TestConfig.test_database_settings) ... ok
test_export_enabled (test_config.TestConfig.test_export_enabled) ... ok
test_has_database_section (test_config.TestConfig.test_has_database_section) ... ok
test_no_secret_key (test_config.TestConfig.test_no_secret_key) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

`test_database_settings` ignores `pool_size`, so adding new settings later will not break it. If the port changed to `5433`, it would fail with `dict_items([('host', 'localhost'), ('port', 5433)]) not less than or equal to dict_items([('host', 'localhost'), ('port', 5432), ('pool_size', 5)])`.

### Exercise 3

`read_ids()` returns a generator. To find `7`, `assertIn()` consumes `3`, `5` and `7`, so the generator is exhausted. `assertNotIn(5, ids)` then searches an empty generator, and "5 is not in nothing" is true. The wrong expectation passes unnoticed.

Collect the IDs into a list once and check the list:

```python
import unittest

from ids import read_ids


class TestReadIds(unittest.TestCase):
    def setUp(self):
        self.ids = list(read_ids(["3", "x", "5", "7"]))

    def test_contains_ids(self):
        self.assertIn(7, self.ids)
        self.assertIn(5, self.ids)
        self.assertNotIn(0, self.ids)

    def test_exact_result(self):
        self.assertEqual(self.ids, [3, 5, 7])
```

Output of `python3 -m unittest test_ids_solution -v`:

```text
test_contains_ids (test_ids_solution.TestReadIds.test_contains_ids) ... ok
test_exact_result (test_ids_solution.TestReadIds.test_exact_result) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

With the list, the original wrong assertion `assertNotIn(5, self.ids)` would now fail, as it should: `5 unexpectedly found in [3, 5, 7]`. When you know the complete expected result, `assertEqual()` is stronger than several `assertIn()` calls, because it also checks order and that nothing extra is there.

---

*Source: [pythontutorial.net — Python assertIn()](https://www.pythontutorial.net/python-unit-testing/python-assertin/). Adapted and expanded for PyJourney.*
