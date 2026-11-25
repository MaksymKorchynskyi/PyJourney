# Класи як декоратори

Досі кожен декоратор був функцією. Але декоратором може бути будь-що **викличне** (callable), зокрема екземпляр класу, у якому визначено `__call__`. Писати декоратори у вигляді класів зручно, коли декоратор має налаштування чи стан, які хочеться зберігати в атрибутах зі зрозумілими іменами. У цій темі розглянуто обидві форми декораторів на основі класів, пастку з методами та інше значення терміна «декоратор класу» (class decorator): декоратор, який застосовують **до** класу.

## Що ви дізнаєтесь

- Що робить об'єкт викличним і чому цього достатньо, щоб бути декоратором
- Як перетворити фабрику декораторів на клас: аргументи в `__init__`, декорування в `__call__`
- Як написати декоратор-клас без аргументів, що зберігає стан між викликами
- Чому декоратори-екземпляри ламаються на методах і як це виправляє `__get__`
- Як працюють декоратори, що приймають **клас** (як-от `@dataclass`)
- Коли для декоратора обрати функцію, а коли клас

## Відправна точка: фабрика декораторів на основі функції

Фабрика `star` виводить рядок символів `*` до та після виклику декорованої функції, а між ними — результат:

```python
from functools import wraps


def star(n):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            print(n * "*")
            result = fn(*args, **kwargs)
            print(result)
            print(n * "*")
            return result

        return wrapper

    return decorate


@star(5)
def add(a, b):
    return a + b


add(10, 20)
```

Результат:

```text
*****
30
*****
```

Погляньте, що повертає `star(5)`: викличний об'єкт (`decorate`), який приймає функцію `fn` і має доступ до аргументу фабрики `n`. Ніщо не вимагає, щоб цей об'єкт був саме функцією.

## Викличні об'єкти

Екземпляр класу є **викличним**, якщо клас визначає спеціальний метод `__call__`. Виклик екземпляра `obj(...)` запускає `obj.__call__(...)`:

```python
class Greeter:
    def __init__(self, greeting):
        self.greeting = greeting

    def __call__(self, name):
        return f"{self.greeting}, {name}!"


hello = Greeter("Hello")
print(hello("Olena"))
print(callable(hello))
```

Результат:

```text
Hello, Olena!
True
```

Декоратор — це просто «викличний об'єкт, який приймає функцію й повертає викличний об'єкт», тож викличний екземпляр цілком може виконувати цю роль.

## Декоратор-клас з аргументами

Перепишімо `star` як клас. Аргументи декоратора потрапляють у `__init__`, а `__call__` отримує функцію й повертає обгортку:

```python
from functools import wraps


class Star:
    def __init__(self, n):
        self.n = n

    def __call__(self, fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            print(self.n * "*")
            result = fn(*args, **kwargs)
            print(result)
            print(self.n * "*")
            return result

        return wrapper


@Star(5)
def add(a, b):
    return a + b


add(10, 20)
print(add.__name__)
```

Результат:

```text
*****
30
*****
add
```

Крок за кроком, `@Star(5)` означає `add = Star(5)(add)`:

1. `Star(5)` створює екземпляр, і `__init__` зберігає `n = 5`. Це роль виклику фабрики.
2. Python викликає цей екземпляр із функцією: `instance(add)`, тобто виконується `__call__(add)`. Це і є власне декорування.
3. `__call__` повертає `wrapper`, і ім'я `add` перев'язується на неї. Обгортка дістається до `n` через `self`, який вона захоплює в замиканні.

```text
фабрика-функція               клас
-----------------------       ---------------------------
star(n)                  <->  Star.__init__(self, n)
  decorate(fn)           <->  Star.__call__(self, fn)
    wrapper(*args, ...)  <->    wrapper(*args, ...)
```

Налаштування тепер зберігаються в іменованому атрибуті (`self.n`), а не у змінній замикання, і до декоратора можна додати допоміжні методи або змінити його поведінку через успадкування.

## Декоратор-клас без аргументів

Є й другий спосіб використати клас. Якщо написати `@CountCalls` **без** дужок, Python викличе `CountCalls(fn)`, тобто функцію отримає **конструктор**, а сам екземпляр замінить функцію. Усі подальші виклики потрапляють у `__call__`:

```python
import functools


class CountCalls:
    def __init__(self, fn):
        functools.update_wrapper(self, fn)
        self.fn = fn
        self.calls = 0

    def __call__(self, *args, **kwargs):
        self.calls += 1
        return self.fn(*args, **kwargs)


@CountCalls
def ping():
    """Answer with pong."""
    return "pong"


ping()
ping()
print(ping())
print(ping.calls)
print(ping.__name__, "-", ping.__doc__)
```

Результат:

```text
pong
3
ping - Answer with pong.
```

- `__init__(self, fn)` виконується один раз, під час декорування. Він зберігає функцію та створює стан (`calls = 0`).
- `__call__(self, *args, **kwargs)` виконується під час кожного виклику. Він оновлює стан і викликає початкову функцію.
- `functools.update_wrapper(self, fn)` — це форма `@wraps` без декоратора. Вона копіює `__name__`, `__doc__` та інші метадані на екземпляр і встановлює `__wrapped__`.

У цьому головна перевага класу: стан (`calls`) — звичайний видимий атрибут. Декоратору на основі функції знадобилося б `nonlocal` або атрибут на функції-обгортці.

Порівняймо дві форми:

| | `@Star(5)` (з аргументами) | `@CountCalls` (без аргументів) |
|---|---|---|
| `__init__` отримує | аргументи декоратора | декоровану функцію |
| `__call__` отримує | декоровану функцію | аргументи виклику |
| `__call__` виконується | один раз, під час декорування | під час кожного виклику |
| Ім'я прив'язується до | функції `wrapper` | екземпляра класу |

## Пастка: декоратори-екземпляри на методах

`CountCalls` працює зі звичайними функціями, але ламається, якщо декорує метод:

```python
import functools


class CountCalls:
    def __init__(self, fn):
        functools.update_wrapper(self, fn)
        self.fn = fn
        self.calls = 0

    def __call__(self, *args, **kwargs):
        self.calls += 1
        return self.fn(*args, **kwargs)


class Greeter:
    @CountCalls
    def greet(self, name):
        return f"Hello, {name}"


g = Greeter()
try:
    print(g.greet("Olena"))
except TypeError as error:
    print("TypeError:", error)
```

Результат:

```text
TypeError: Greeter.greet() missing 1 required positional argument: 'name'
```

Звичайні функції є **дескрипторами**: коли ви звертаєтеся до `g.greet`, метод функції `__get__` створює *зв'язаний метод* (bound method), який підставляє `g` як `self`. Екземпляр `CountCalls` не має `__get__`, тож `g.greet` повертає екземпляр без змін, `self` не передається, і `"Olena"` потрапляє в параметр `self`. Обгортка-*функція* (як у `Star`) такої проблеми не має, адже це функція, і вона зв'язується, як будь-який інший метод.

Виправлення — реалізувати `__get__` і зв'язати екземпляр самостійно через `types.MethodType`:

```python
import functools
import types


class CountCalls:
    def __init__(self, fn):
        functools.update_wrapper(self, fn)
        self.fn = fn
        self.calls = 0

    def __call__(self, *args, **kwargs):
        self.calls += 1
        return self.fn(*args, **kwargs)

    def __get__(self, instance, owner=None):
        if instance is None:
            return self
        return types.MethodType(self, instance)


class Greeter:
    @CountCalls
    def greet(self, name):
        return f"Hello, {name}"


g = Greeter()
print(g.greet("Olena"))
print(g.greet("Max"))
print(Greeter.greet.calls)
```

Результат:

```text
Hello, Olena
Hello, Max
2
```

`types.MethodType(self, instance)` створює зв'язаний метод, виклик якого перетворюється на `self(instance, *args)`, тож екземпляр `Greeter` надходить першим аргументом. Звернення до атрибута через клас (`Greeter.greet`) повертає сам декоратор, і саме так можна прочитати `calls`. Зверніть увагу: лічильник спільний для всіх екземплярів `Greeter`, бо на кожен декорований метод припадає один об'єкт-декоратор.

## Інше значення: декоратори, які застосовують до класів

В офіційній термінології Python **декоратором класу** (class decorator) зазвичай називають декоратор, розміщений **над інструкцією `class`** (PEP 3129). Він працює так само, як декоратор функції: `@register` над `class CsvExporter` означає `CsvExporter = register(CsvExporter)`. Декоратор отримує об'єкт класу й повертає клас, зазвичай той самий, але зміненим або десь зареєстрованим:

```python
exporters = {}


def register(cls):
    exporters[cls.__name__.lower()] = cls
    return cls


def add_describe(cls):
    def describe(self):
        return f"{cls.__name__} writes {self.extension} files"

    cls.describe = describe
    return cls


@register
@add_describe
class CsvExporter:
    extension = "csv"


@register
@add_describe
class JsonExporter:
    extension = "json"


print(list(exporters))
print(exporters["jsonexporter"]().describe())
```

Результат:

```text
['csvexporter', 'jsonexporter']
JsonExporter writes json files
```

У стандартній бібліотеці таких декораторів чимало: `@dataclasses.dataclass` генерує `__init__`, `__repr__` та `__eq__`, `@functools.total_ordering` додає методи порівняння, а `@enum.unique` перевіряє, що значення переліку не повторюються.

Отже, «декоратор класу» може означати або *клас, який використовують як декоратор* (більша частина цієї теми), або *декоратор для класу* (цей розділ). Зустрівши цей термін, зважайте на контекст.

## Функція чи клас?

- Обирайте **функцію** для простих декораторів без стану. Вона коротша й одразу працює з методами.
- Обирайте **клас**, коли декоратор має кілька налаштувань, зберігає стан, який хочеться переглядати (`ping.calls`), потребує додаткових методів (наприклад, `reset()`) або має розширюватися через успадкування.
- Якщо декоратор-клас замінює функцію екземпляром, не забудьте про `functools.update_wrapper`, а якщо він може декорувати методи — і про `__get__`.

## Типові помилки

- **Плутати дві форми.** З `@Star(5)` `__init__` отримує налаштування, а `__call__` — функцію. З `@CountCalls` `__init__` отримує функцію, а `__call__` — аргументи виклику. Якщо поєднати структуру однієї форми із синтаксисом іншої, отримаєте заплутані `TypeError`.
- **Забути дужки для класу з аргументами.** `@Star` передає функцію як `n`, тож `add` стає екземпляром `Star`, чий `__call__` очікує функцію, і `add(10, 20)` завершується `TypeError`.
- **Втрачати метадані.** Використовуйте `@wraps(fn)` для функцій-обгорток і `functools.update_wrapper(self, fn)`, коли функцію замінює сам екземпляр.
- **Декорувати методи декоратором-екземпляром без `__get__`.** `self` не передається, і виклик падає або непомітно отримує не ті аргументи.
- **Очікувати зрозумілого `repr`.** `print(ping)` для функції, задекорованої `CountCalls`, показує `<__main__.CountCalls object at 0x...>`. Якщо це важливо, визначте `__repr__`.

## Підсумок

- Декоратором може бути будь-який викличний об'єкт. Екземпляр викличний, якщо його клас визначає `__call__`.
- Для декоратора з аргументами (`@Star(5)`) зберігайте аргументи в `__init__` і повертайте обгортку з `__call__(self, fn)`.
- Для декоратора без аргументів (`@CountCalls`) отримуйте функцію в `__init__`, а логіку обгортки виконуйте в `__call__(self, *args, **kwargs)`. Стан зберігається в атрибутах екземпляра.
- `functools.update_wrapper(self, fn)` копіює ім'я та docstring на екземпляр.
- Екземпляру, який замінює метод, потрібен `__get__` (із `types.MethodType`), щоб отримати `self`.
- Декоратор над інструкцією `class` отримує клас і повертає клас, як це робить `@dataclass`.

## Практика

### Вправа 1: `Repeat` у вигляді класу

Перепишіть фабрику декораторів `repeat(times)` із попередньої теми як клас `Repeat`, який використовують так: `@Repeat(3)`. Збережіть ім'я функції за допомогою `functools.wraps`. Перевірте його на функції `say(message)` і виведіть `say.__name__`.

### Вправа 2: Лічильник викликів зі скиданням

Напишіть декоратор-клас `CallCounter` (без аргументів), який рахує виклики в `self.calls` і має метод `reset()`. Використайте `functools.update_wrapper`. Викличте задекоровану функцію тричі, виведіть лічильник, скиньте його, викличте ще раз і знову виведіть лічильник.

### Вправа 3: Декоратор для класів

Напишіть функцію `auto_repr(cls)`, яка додає класу метод `__repr__`. Метод має показувати ім'я класу й усі атрибути екземпляра, наприклад `Point(x=1, y=2)`. Застосуйте її до класу `Point` з атрибутами `x` і `y` та до класу `User` з атрибутами `name` і `email`.

### Вправа 4: Нехай працює на методах

Клас `Star` вище повертає обгортку-*функцію*, тож працює з методами без додаткового коду. Доведіть це: задекоруйте метод `Cart.total(self)` за допомогою `@Star(3)` і викличте його. Потім одним реченням поясніть, чому `CountCalls` знадобився `__get__`, а `Star` — ні.

## Розв'язки

### Вправа 1

```python
from functools import wraps


class Repeat:
    def __init__(self, times):
        self.times = times

    def __call__(self, fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            result = None
            for _ in range(self.times):
                result = fn(*args, **kwargs)
            return result

        return wrapper


@Repeat(3)
def say(message):
    print(message)


say("Hi")
print(say.__name__)
```

Результат:

```text
Hi
Hi
Hi
say
```

### Вправа 2

```python
import functools


class CallCounter:
    def __init__(self, fn):
        functools.update_wrapper(self, fn)
        self.fn = fn
        self.calls = 0

    def __call__(self, *args, **kwargs):
        self.calls += 1
        return self.fn(*args, **kwargs)

    def reset(self):
        self.calls = 0


@CallCounter
def square(x):
    return x * x


square(2)
square(3)
square(4)
print(square.calls)

square.reset()
print(square(5))
print(square.calls)
```

Результат:

```text
3
25
1
```

### Вправа 3

```python
def auto_repr(cls):
    def __repr__(self):
        fields = ", ".join(f"{key}={value!r}" for key, value in vars(self).items())
        return f"{type(self).__name__}({fields})"

    cls.__repr__ = __repr__
    return cls


@auto_repr
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y


@auto_repr
class User:
    def __init__(self, name, email):
        self.name = name
        self.email = email


print(Point(1, 2))
print(User("Olena", "olena@example.com"))
```

Результат:

```text
Point(x=1, y=2)
User(name='Olena', email='olena@example.com')
```

`vars(self)` повертає словник атрибутів екземпляра в порядку їх присвоєння. `type(self).__name__` дає правильне ім'я й для підкласів.

### Вправа 4

```python
from functools import wraps


class Star:
    def __init__(self, n):
        self.n = n

    def __call__(self, fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            print(self.n * "*")
            result = fn(*args, **kwargs)
            print(result)
            print(self.n * "*")
            return result

        return wrapper


class Cart:
    def __init__(self, prices):
        self.prices = prices

    @Star(3)
    def total(self):
        return sum(self.prices)


Cart([10, 15, 5]).total()
```

Результат:

```text
***
30
***
```

`Star.__call__` повертає звичайну функцію, а функції — це дескриптори, які автоматично зв'язують `self`, тоді як `CountCalls` ставить на місце методу екземпляр класу, а екземпляри без `__get__` не зв'язуються.

---

*Джерело: [pythontutorial.net — Python Class Decorators](https://www.pythontutorial.net/advanced-python/python-class-decorators/). Адаптовано й доповнено для PyJourney.*
