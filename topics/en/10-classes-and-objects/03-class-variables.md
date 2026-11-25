# Class Variables

A **class variable** is a variable that belongs to the class object itself rather than to any single instance. Every instance can see it, so it is the natural place for data shared by the whole class. This topic shows how to read, add, change and delete class variables, where Python stores them, and why the functions you define in a class are class variables too.

## What you'll learn

- Why a class is an object that can carry its own variables
- How to read class variables with dot notation and `getattr()`, with or without a default
- How to set, add and delete class variables at run time with dot notation, `setattr()`, `delattr()` and `del`
- Where class variables are stored (`__dict__`) and why that mapping is read-only
- Why functions defined in a class are callable class attributes
- How instances see class variables

## A class is an object

When Python executes a `class` statement, it creates a **class object** and binds it to the class name. That object has attributes and a type, like any other object:

```python
class HtmlDocument:
    pass


print(HtmlDocument.__name__)
print(type(HtmlDocument))
print(isinstance(HtmlDocument, type))
```

Output:

```text
HtmlDocument
<class 'type'>
True
```

`HtmlDocument` is an instance of `type`. Since it is an object, you can attach your own variables to it. Those are class variables.

## Defining class variables

Assign a variable directly in the class body, outside any method:

```python
class HtmlDocument:
    extension = "html"
    version = "5"
```

`extension` and `version` are class variables of `HtmlDocument`. They are **bound to the class** and shared by all of its instances.

> **Note:** "Class variable" and "class attribute" mean the same thing. Python's documentation usually says *attribute* for anything reached with a dot, and the next topics use both terms.

## Reading class variables

### Dot notation

Use `ClassName.variable`:

```python
class HtmlDocument:
    extension = "html"
    version = "5"


print(HtmlDocument.extension)
print(HtmlDocument.version)
```

Output:

```text
html
5
```

Reading a class variable that does not exist raises `AttributeError`:

```python
class HtmlDocument:
    extension = "html"
    version = "5"


print(HtmlDocument.media_type)
```

Output:

```text
Traceback (most recent call last):
  ...
AttributeError: type object 'HtmlDocument' has no attribute 'media_type'
```

For a near miss, such as `HtmlDocument.extention`, Python 3.10+ adds a hint to the message: `Did you mean: 'extension'?`.

### `getattr()`

The built-in `getattr(obj, name)` does the same lookup, but the name is a **string**. That makes it useful when the name is only known at run time, for example when it comes from a configuration file or user input:

```python
class HtmlDocument:
    extension = "html"
    version = "5"


extension = getattr(HtmlDocument, "extension")
version = getattr(HtmlDocument, "version")

print(extension)
print(version)
```

Output:

```text
html
5
```

Without a default, `getattr()` raises `AttributeError` for a missing name, exactly like dot notation. Pass a third argument to get a fallback value instead:

```python
class HtmlDocument:
    extension = "html"
    version = "5"


media_type = getattr(HtmlDocument, "media_type", "text/html")
print(media_type)

for name in ("extension", "version", "charset"):
    print(name, "=", getattr(HtmlDocument, name, "<missing>"))

print(hasattr(HtmlDocument, "charset"))
```

Output:

```text
text/html
extension = html
version = 5
charset = <missing>
False
```

The default is only returned, never stored: `HtmlDocument` still has no `media_type` afterwards. `hasattr()` answers the yes/no question directly.

## Setting and adding class variables

To change a class variable, assign to it with dot notation or call `setattr(obj, name, value)`. Python is dynamic, so the same syntax also **adds** a brand-new class variable to an existing class:

```python
class HtmlDocument:
    extension = "html"
    version = "5"


HtmlDocument.version = "5.1"
print(HtmlDocument.version)

setattr(HtmlDocument, "version", "5.2")
print(HtmlDocument.version)

HtmlDocument.media_type = "text/html"
print(HtmlDocument.media_type)

setattr(HtmlDocument, "charset", "utf-8")
print(HtmlDocument.charset)
```

Output:

```text
5.1
5.2
text/html
utf-8
```

Note the quotes in `setattr(HtmlDocument, "charset", ...)`: the name must be a string. Like `getattr()`, `setattr()` is the tool of choice when the name is stored in a variable.

## Deleting class variables

Remove a class variable with `delattr(obj, name)` or the `del` statement:

```python
class HtmlDocument:
    extension = "html"
    version = "5"
    media_type = "text/html"


delattr(HtmlDocument, "version")
del HtmlDocument.media_type

print(hasattr(HtmlDocument, "version"))
print(hasattr(HtmlDocument, "media_type"))
print(HtmlDocument.extension)
```

Output:

```text
False
False
html
```

Deleting a variable that does not exist raises `AttributeError: type object 'HtmlDocument' has no attribute 'version'`.

## Where class variables live: `__dict__`

Python stores a class's variables in the class's `__dict__` attribute. Printing it reveals your variables together with a few entries Python adds on its own:

```python
from pprint import pprint


class HtmlDocument:
    extension = "html"
    version = "5"


HtmlDocument.media_type = "text/html"

pprint(HtmlDocument.__dict__)
```

Output (Python 3.14):

```text
mappingproxy({'__dict__': <attribute '__dict__' of 'HtmlDocument' objects>,
              '__doc__': None,
              '__firstlineno__': 4,
              '__module__': '__main__',
              '__static_attributes__': (),
              '__weakref__': <attribute '__weakref__' of 'HtmlDocument' objects>,
              'extension': 'html',
              'media_type': 'text/html',
              'version': '5'})
```

Besides `extension`, `version` and `media_type` (added at run time), you can see:

| Key | Meaning |
|---|---|
| `__module__` | the module in which the class was defined |
| `__doc__` | the class docstring (`None` here) |
| `__dict__`, `__weakref__` | helpers that give *instances* their own `__dict__` and support for weak references |
| `__firstlineno__` | the line number of the `class` statement (added in Python 3.13) |
| `__static_attributes__` | names assigned as `self.<name>` inside the class's methods (added in Python 3.13) |

On Python 3.12 and older the last two keys are absent.

### A read-only view

The class `__dict__` is not a plain `dict`. It is a `mappingproxy`: a **read-only view** of the real namespace. You can read from it, but you cannot assign to it:

```python
class HtmlDocument:
    extension = "html"
    version = "5"


print(type(HtmlDocument.__dict__))
print(HtmlDocument.__dict__["extension"])

try:
    HtmlDocument.__dict__["released"] = 2008
except TypeError as error:
    print("TypeError:", error)

setattr(HtmlDocument, "released", 2008)
print(HtmlDocument.__dict__["released"])
```

Output:

```text
<class 'mappingproxy'>
html
TypeError: 'mappingproxy' object does not support item assignment
2008
```

Why read-only? Python caches attribute lookups on classes to make them fast. Every change must go through `setattr()` (or dot notation), so the interpreter can invalidate those caches and enforce that the keys are strings. Writing into the mapping directly would bypass all of that.

### Prefer dot notation and `getattr()` over `__dict__`

Reading through `__dict__` works, but it is not a good habit. The mapping only holds names defined **directly in that class**. It knows nothing about inherited attributes, while normal attribute lookup searches the parent classes too:

```python
class Document:
    encoding = "utf-8"


class HtmlDocument(Document):
    extension = "html"


print(HtmlDocument.encoding)
print(getattr(HtmlDocument, "encoding"))
print("encoding" in HtmlDocument.__dict__)
print(HtmlDocument.__dict__.get("encoding", "not here"))
```

Output:

```text
utf-8
utf-8
False
not here
```

`HtmlDocument.__dict__["encoding"]` would raise `KeyError`, even though `HtmlDocument.encoding` works fine. Use `__dict__` (or the equivalent `vars(HtmlDocument)`) to *inspect* what a class itself defines, and dot notation or `getattr()` to *use* attributes.

## Callable class attributes

A class variable can hold any object, including a function. In fact, every `def` inside a class body creates a class attribute whose value is a function. Since a function is callable, it is called a **callable class attribute**:

```python
class HtmlDocument:
    extension = "html"
    version = "5"

    def render():
        print("Rendering the HTML doc...")


print("render" in HtmlDocument.__dict__)
print(callable(HtmlDocument.render))
print(HtmlDocument.render)
HtmlDocument.render()
```

Output (the address varies):

```text
True
True
<function HtmlDocument.render at 0x1044c7270>
Rendering the HTML doc...
```

`render` sits in `__dict__` next to `extension` and `version`. It is simply a class variable whose value is a function, and defining it does not run it. It runs only when you call it.

This `render()` has no `self` parameter, so it works only when called through the class. Calling it through an instance (`HtmlDocument().render()`) raises `TypeError`, because Python passes the instance automatically. The next topic, Instance Methods, explains exactly why.

You can even add a function to a class at run time, and every instance gains a new method:

```python
class HtmlDocument:
    version = "5"


def describe(self):
    return f"HTML {self.version} document"


HtmlDocument.describe = describe
page = HtmlDocument()
print(page.describe())
```

Output:

```text
HTML 5 document
```

## Class variables and instances

Instances can read class variables through dot notation. If the instance has no attribute with that name, Python looks it up on the class. Because there is only one shared value, a change made through the class is visible from every instance:

```python
class HtmlDocument:
    extension = "html"


page = HtmlDocument()
home = HtmlDocument()
print(page.extension, home.extension)

HtmlDocument.extension = "htm"
print(page.extension, home.extension)
```

Output:

```text
html html
htm htm
```

The topics on instance variables and class attributes look at this lookup in detail.

## Common mistakes

- **Forgetting the quotes in `getattr()` / `setattr()`.** The name must be a string. Without quotes Python looks for a *variable* with that name:

  ```python
  class HtmlDocument:
      extension = "html"


  setattr(HtmlDocument, media_type, "text/html")
  ```

  Output:

  ```text
  Traceback (most recent call last):
    ...
  NameError: name 'media_type' is not defined
  ```

- **Writing into `__dict__`.** `HtmlDocument.__dict__["x"] = 1` raises `TypeError`. Use `setattr()` or dot notation.

- **Reading through `__dict__`.** It misses inherited attributes and raises `KeyError` where normal lookup would succeed.

- **Typos silently create new variables.** Assignment never checks that the name already exists:

  ```python
  class HtmlDocument:
      version = "5"


  HtmlDocument.verison = "6"  # typo
  print(HtmlDocument.version)
  ```

  Output:

  ```text
  5
  ```

- **Storing per-instance data in a mutable class variable.** A list defined in the class body is one list shared by every instance, so items "leak" between objects. Per-instance data belongs in `__init__`, covered in the next topics.

- **Assigning through an instance to change a class variable.** `page.extension = "htm"` creates a new attribute on `page` only. To change the shared value, assign through the class.

## Summary

- A class is an object (an instance of `type`), and variables assigned in its body are class variables shared by all instances.
- Read them with `ClassName.name` or `getattr(ClassName, "name")`. A missing name raises `AttributeError` unless you pass a default to `getattr()`.
- Change or add them with dot notation or `setattr()`, and remove them with `del` or `delattr()`. The name passed to these functions is a string.
- Class variables are stored in `ClassName.__dict__`, a read-only `mappingproxy`. It contains only names defined directly in that class.
- Use `__dict__` (or `vars()`) to inspect a class, and dot notation or `getattr()` to use its attributes.
- Every function defined in a class body is a callable class attribute.

## Practice

### Exercise 1: Settings with defaults

Create a class `Settings` with the class variables `theme = "light"` and `font_size = 14`. Write a function `get_setting(name)` that returns the value of the class variable or the string `"not set"` if it does not exist. Print the results for `"theme"`, `"font_size"` and `"language"`.

### Exercise 2: Load a configuration

Start from the same `Settings` class. Apply this configuration to the class with `setattr()` in a loop:

```python
config = {"theme": "dark", "language": "uk", "font_size": 16}
```

Then print every class variable whose name does not start with an underscore, in alphabetical order, in the form `name = value`. Use the class's `__dict__` to find them.

### Exercise 3: Remove a setting safely

Continue Exercise 2. Delete `language` with `delattr()` and print `hasattr(Settings, "language")` before and after. Then try to delete it a second time, catch the error and print its message.

### Exercise 4: Predict the output

Write down what each line prints, then run the code to check.

```python
class Base:
    color = "red"


class Child(Base):
    size = 10


print(Child.color)
print("color" in Child.__dict__)
Child.color = "blue"
print(Base.color, Child.color)
print("color" in Child.__dict__)
del Child.color
print(Child.color)
```

## Solutions

### Exercise 1

```python
class Settings:
    theme = "light"
    font_size = 14


def get_setting(name):
    return getattr(Settings, name, "not set")


print(get_setting("theme"))
print(get_setting("font_size"))
print(get_setting("language"))
```

Output:

```text
light
14
not set
```

### Exercise 2

```python
class Settings:
    theme = "light"
    font_size = 14


config = {"theme": "dark", "language": "uk", "font_size": 16}
for name, value in config.items():
    setattr(Settings, name, value)

for name in sorted(Settings.__dict__):
    if not name.startswith("_"):
        print(name, "=", getattr(Settings, name))
```

Output:

```text
font_size = 16
language = uk
theme = dark
```

`setattr()` both updated the existing variables (`theme`, `font_size`) and added a new one (`language`). Filtering out names that start with `_` hides `__module__`, `__dict__` and the other entries Python adds.

### Exercise 3

```python
class Settings:
    theme = "light"
    font_size = 14


config = {"theme": "dark", "language": "uk", "font_size": 16}
for name, value in config.items():
    setattr(Settings, name, value)

print(hasattr(Settings, "language"))
delattr(Settings, "language")
print(hasattr(Settings, "language"))

try:
    delattr(Settings, "language")
except AttributeError as error:
    print("Error:", error)
```

Output:

```text
True
False
Error: type object 'Settings' has no attribute 'language'
```

### Exercise 4

Output:

```text
red
False
red blue
True
red
```

- `Child.color` is found on `Base` through inheritance, but it is not in `Child.__dict__`.
- `Child.color = "blue"` creates a new class variable on `Child` that **shadows** the inherited one. `Base.color` is untouched.
- After `del Child.color`, the lookup falls back to `Base` again and finds `"red"`.

---

*Source: [pythontutorial.net — Python Class Variables](https://www.pythontutorial.net/python-oop/python-class-variables/). Adapted and expanded for PyJourney.*
