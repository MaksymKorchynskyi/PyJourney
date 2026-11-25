# Декоратори в Python

**Декоратор** (decorator) — це функція, яка приймає іншу функцію й повертає нову функцію з розширеною поведінкою, не змінюючи коду початкової. Декоратори дають змогу одним рядком додати до багатьох функцій логування, вимірювання часу, кешування, перевірку доступу чи форматування. Ви постійно зустрічатимете їх у фреймворках (`@app.route`, `@pytest.fixture`) і в стандартній бібліотеці (`@property`, `@functools.cache`).

## Що ви дізнаєтесь

- Чому функції можна передавати в інші функції й повертати з них
- Як написати декоратор із внутрішньою функцією `wrapper` та `*args, **kwargs`
- Що робить синтаксис `@decorator` і коли відбувається декорування
- Чому декоровані функції втрачають ім'я та docstring і як це виправляє `functools.wraps`
- Як комбінуються кілька декораторів і в якому порядку вони виконуються
- Типові практичні декоратори: вимірювання часу, логування, підрахунок викликів і реєстрація

## Функції — це об'єкти

Декоратори спираються на один факт: у Python функції — звичайні об'єкти. Їх можна присвоювати змінним, передавати як аргументи й повертати з інших функцій:

```python
def shout(text):
    return text.upper() + "!"


def apply(fn, value):
    return fn(value)


yell = shout
print(yell("hello"))
print(apply(shout, "decorators"))
```

Результат:

```text
HELLO!
DECORATORS!
```

Зверніть увагу на `yell = shout` без дужок: так ми прив'язуємо друге ім'я до того самого об'єкта функції. А `shout("hello")` із дужками її *викликає*. Функцію, яка приймає або повертає інші функції, називають **функцією вищого порядку** (higher-order function). Декоратор — це функція вищого порядку, яка робить і те, і те.

## Перший декоратор

Почнімо з функції, яка обчислює ціну товару з урахуванням податку:

```python
def net_price(price, tax):
    """Calculate the price including tax.

    Arguments:
        price: the selling price
        tax: value added tax or sales tax, e.g. 0.05 for 5%
    """
    return price * (1 + tax)


print(net_price(100, 0.05))
```

Результат:

```text
105.0
```

Тепер припустімо, що всі ціни треба показувати в доларах США, тобто `105.0` має перетворитися на `$105.00`. Можна відредагувати `net_price`, але тоді вона повертатиме рядок, і таку саму правку довелося б вносити в кожну іншу функцію, що працює з цінами. Декоратор додає форматування ззовні.

Декоратор — це функція, яка **приймає функцію як аргумент**:

```python
def currency(fn):
    pass
```

і **повертає іншу функцію**, яку за традицією називають `wrapper` («обгортка»):

```python
def currency(fn):
    def wrapper(*args, **kwargs):
        return fn(*args, **kwargs)

    return wrapper
```

`wrapper` приймає `*args` (будь-які позиційні аргументи) та `**kwargs` (будь-які іменовані аргументи) і передає їх далі без змін. Завдяки цьому декоратор працює з функціями з будь-якою сигнатурою. Поки що `wrapper` поводиться точнісінько як `fn`. Тепер додамо нову поведінку: викличемо `fn`, візьмемо результат і відформатуємо його:

```python
def currency(fn):
    def wrapper(*args, **kwargs):
        result = fn(*args, **kwargs)
        return f"${result:.2f}"

    return wrapper


def net_price(price, tax):
    """Calculate the price including tax."""
    return price * (1 + tax)


net_price = currency(net_price)
print(net_price(100, 0.05))
print(net_price(100, 0.1))
```

Результат:

```text
$105.00
$110.00
```

Специфікатор формату `:.2f` округлює до двох знаків після коми. Без нього `100 * 1.1` показало б похибку обчислень із рухомою комою: `$110.00000000000001`.

`net_price = currency(net_price)` передає початкову функцію в декоратор і перев'язує ім'я `net_price` на повернену `wrapper`. Відтепер виклик `net_price(...)` — це виклик `wrapper(...)`, яка викликає початкову функцію через свою вільну змінну `fn`.

```text
net_price ---> wrapper(*args, **kwargs)
                  |
                  |  вільна змінна fn
                  v
               початкова net_price(price, tax)
```

Отже, декоратор — це:

- функція, яка приймає початкову функцію як аргумент і повертає нову функцію;
- нова функція (`wrapper`) зазвичай приймає будь-яку комбінацію позиційних та іменованих аргументів;
- `wrapper` викликає початкову функцію з цими аргументами, робить щось до та/або після виклику й повертає результат.

`wrapper` — це **замикання**: вона посилається на `fn` з охопної області видимості декоратора, і це посилання зберігається після того, як `currency()` завершилася.

## Синтаксис `@`

Писати `net_price = currency(net_price)` після кожного оголошення нудно, і про це легко забути. Python пропонує коротшу форму. Ці два фрагменти рівнозначні:

```python
def fn():
    pass


fn = decorate(fn)
```

```python
@decorate
def fn():
    pass
```

(Обидва — фрагменти: `decorate` позначає будь-який декоратор.)

Із синтаксисом `@` декоратор стоїть одразу над оголошенням, тож читач відразу бачить, що функцію змінено:

```python
def currency(fn):
    def wrapper(*args, **kwargs):
        result = fn(*args, **kwargs)
        return f"${result:.2f}"

    return wrapper


@currency
def net_price(price, tax):
    """Calculate the price including tax."""
    return price * (1 + tax)


print(net_price(100, 0.05))
```

Результат:

```text
$105.00
```

### Коли відбувається декорування?

Декоратор виконується **один раз, коли виконується інструкція `def`**, зазвичай під час імпорту модуля. А обгортка виконується **під час кожного виклику**:

```python
def announce(fn):
    print(f"decorating {fn.__name__}")
    return fn


@announce
def hello():
    print("hello!")


print("before the first call")
hello()
hello()
```

Результат:

```text
decorating hello
before the first call
hello!
hello!
```

Цей декоратор також показує, що декоратор може повернути початкову функцію без змін. Це корисно для **реєстрації**, коли функцію треба лише десь записати:

```python
commands = {}


def command(fn):
    commands[fn.__name__] = fn
    return fn


@command
def start():
    return "starting"


@command
def stop():
    return "stopping"


print(list(commands))
print(commands["stop"]())
```

Результат:

```text
['start', 'stop']
stopping
```

## Збереження «особи» функції: `functools.wraps`

Декорування замінює функцію на `wrapper`, і це має побічний ефект: початкові ім'я, docstring і сигнатура втрачаються.

```python
import inspect


def currency(fn):
    def wrapper(*args, **kwargs):
        result = fn(*args, **kwargs)
        return f"${result:.2f}"

    return wrapper


@currency
def net_price(price, tax):
    """Calculate the price including tax."""
    return price * (1 + tax)


print(net_price.__name__)
print(net_price.__doc__)
print(inspect.signature(net_price))
help(net_price)
```

Результат:

```text
wrapper
None
(*args, **kwargs)
Help on function wrapper in module __main__:

wrapper(*args, **kwargs)
```

Налагоджувачі, логи, інструменти документування, `help()` і тестові фреймворки бачать `wrapper` замість `net_price`. Виправити це допомагає декоратор `wraps` зі стандартного модуля `functools`. Застосуйте його до обгортки й передайте йому початкову функцію:

```python
import inspect
from functools import wraps


def currency(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        result = fn(*args, **kwargs)
        return f"${result:.2f}"

    return wrapper


@currency
def net_price(price, tax):
    """Calculate the price including tax.

    Arguments:
        price: the selling price
        tax: value added tax or sales tax
    """
    return price * (1 + tax)


help(net_price)
print(net_price.__name__)
print(inspect.signature(net_price))
print(net_price.__wrapped__(100, 0.05))
```

Результат:

```text
Help on function net_price in module __main__:

net_price(price, tax)
    Calculate the price including tax.

    Arguments:
        price: the selling price
        tax: value added tax or sales tax

net_price
(price, tax)
105.0
```

`@wraps(fn)` копіює з `fn` у `wrapper` атрибути `__name__`, `__qualname__`, `__doc__`, `__module__` і `__dict__` (та ще кілька), а саму початкову функцію зберігає у `wrapper.__wrapped__`. `inspect.signature()` переходить за `__wrapped__` і показує справжню сигнатуру, а викликавши `__wrapped__`, можна обійти декоратор, що зручно в тестах.

> **Порада:** використовуйте `@wraps(fn)` у кожному декораторі, який пишете. Це один рядок, який згодом убереже від багатьох непорозумінь.

Зауважте, що `wraps(fn)` і сам є декоратором, який приймає аргумент. Як будувати такі декоратори, пояснено в наступній темі.

## Кілька декораторів одночасно

До однієї функції можна застосувати кілька декораторів. Вони застосовуються **знизу догори** (першим — найближчий до `def`), тож верхній декоратор опиняється зовнішнім шаром:

```python
from functools import wraps


def stars(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        return "**" + fn(*args, **kwargs) + "**"

    return wrapper


def brackets(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        return "[" + fn(*args, **kwargs) + "]"

    return wrapper


@stars
@brackets
def greet(name):
    return f"Hello, {name}"


print(greet("Olena"))
```

Результат:

```text
**[Hello, Olena]**
```

Такий набір рівнозначний `greet = stars(brackets(greet))`. Коли виконується `greet("Olena")`, першою запускається зовнішня обгортка `stars`, вона викликає обгортку `brackets`, а та — початкову функцію. Результати потім повертаються назовні: спершу додаються квадратні дужки, а зірочки — останніми. Поміняйте декоратори місцями, і отримаєте `[**Hello, Olena**]`.

## Практичні декоратори

### Вимірювання часу виконання

```python
import time
from functools import wraps


def timer(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        try:
            return fn(*args, **kwargs)
        finally:
            elapsed = time.perf_counter() - start
            print(f"{fn.__name__} took {elapsed:.4f} s")

    return wrapper


@timer
def slow_sum(n):
    return sum(range(n))


print(slow_sum(1_000_000))
```

Результат (час щоразу різний):

```text
slow_sum took 0.0061 s
499999500000
```

`try`/`finally` гарантує, що час буде виведено, навіть якщо функція згенерує виняток. Рядок із часом з'являється першим, бо `print(slow_sum(...))` може вивести результат лише після того, як виклик разом з обгорткою завершиться.

### Підрахунок викликів

Функція — це об'єкт, тож обгортка може зберігати дані у власних атрибутах:

```python
from functools import wraps


def count_calls(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        wrapper.calls += 1
        return fn(*args, **kwargs)

    wrapper.calls = 0
    return wrapper


@count_calls
def ping():
    return "pong"


ping()
ping()
ping()
print(ping.calls)
```

Результат:

```text
3
```

### Декоратори стандартної бібліотеки

Ви часто користуватиметеся готовими декораторами:

- `@property`, `@staticmethod`, `@classmethod` змінюють поведінку методів у класі.
- `@functools.cache` і `@functools.lru_cache` запам'ятовують результати дорогих викликів.
- `@dataclasses.dataclass` генерує для класу `__init__`, `__repr__` та `__eq__`.
- `@contextlib.contextmanager` перетворює генератор на менеджер контексту.

## Типові помилки

- **Забути повернути результат.** Якщо `wrapper` викликає `fn(*args, **kwargs)`, але не робить `return`, кожна декорована функція непомітно повертає `None`.
- **Забути повернути обгортку.** Декоратор без `return wrapper` повертає `None`, тож декороване ім'я стає `None`, а виклик генерує `TypeError: 'NoneType' object is not callable`.
- **Викликати функцію замість того, щоб передати її.** `currency(net_price())` передає *результат* виклику, а не функцію. Декоратор отримує сам об'єкт функції.
- **Жорстко задавати сигнатуру.** `def wrapper(price, tax):` працює лише для однієї функції. Використовуйте `*args, **kwargs`, щоб декоратор працював усюди, зокрема з методами, де `self` просто приходить першим позиційним аргументом.
- **Не використовувати `functools.wraps`.** Без нього кожна декорована функція називається `wrapper`, не має docstring і показує неправильну сигнатуру.
- **Писати `@currency()` із дужками.** Так спершу викликається `currency()` без аргументів, і це завершується помилкою. Дужки потрібні лише декораторам з аргументами (наступна тема).

## Підсумок

- Функції — це об'єкти: їх можна передавати в інші функції й повертати з них.
- Декоратор приймає функцію й повертає нову функцію (зазвичай замикання з іменем `wrapper`), яка додає поведінку до та/або після виклику початкової.
- `@decorator` над `def` — це скорочення для `fn = decorator(fn)`. Він виконується один раз, під час оголошення функції.
- Використовуйте в обгортці `*args, **kwargs` і повертайте результат початкової функції.
- `@functools.wraps(fn)` зберігає ім'я, docstring і сигнатуру та надає доступ до оригіналу через `__wrapped__`.
- Кілька декораторів застосовуються знизу догори, і верхній стає зовнішнім шаром.
- Типові застосування: форматування, вимірювання часу, логування, підрахунок, кешування, реєстрація та контроль доступу.

## Практика

### Вправа 1: Результат великими літерами

Напишіть декоратор `uppercase`, який перетворює рядок, повернений декорованою функцією, на верхній регістр. Використайте `functools.wraps`. Задекоруйте `greet(name)`, яка повертає `f"Hello, {name}"`, і виведіть `greet("max")` та `greet.__name__`.

### Вправа 2: Логування кожного виклику

Напишіть декоратор `log_calls`, який перед викликом виводить ім'я функції з аргументами, а після виклику — повернене значення. Для `add(2, b=3)` він має вивести:

```text
calling add(2, b=3)
add returned 5
```

Підказка: складіть список аргументів із `repr(arg)` для позиційних аргументів і `f"{key}={value!r}"` для іменованих.

### Вправа 3: Лише додатні числа

Напишіть декоратор `positive_args`, який генерує `ValueError("all arguments must be positive")`, якщо будь-який позиційний аргумент — число, менше або рівне нулю, а інакше викликає функцію. Задекоруйте `area(width, height)` і продемонструйте успішний і відхилений виклики.

### Вправа 4: Передбачте порядок

Не запускаючи код, передбачте результат. Потім запустіть і поясніть порядок рядків.

```python
def first(fn):
    print("decorating with first")

    def wrapper():
        print("first: before")
        fn()
        print("first: after")

    return wrapper


def second(fn):
    print("decorating with second")

    def wrapper():
        print("second: before")
        fn()
        print("second: after")

    return wrapper


@first
@second
def task():
    print("task runs")


print("--- calling ---")
task()
```

## Розв'язки

### Вправа 1

```python
from functools import wraps


def uppercase(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        return fn(*args, **kwargs).upper()

    return wrapper


@uppercase
def greet(name):
    return f"Hello, {name}"


print(greet("max"))
print(greet.__name__)
```

Результат:

```text
HELLO, MAX
greet
```

### Вправа 2

```python
from functools import wraps


def log_calls(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        parts = [repr(arg) for arg in args]
        parts += [f"{key}={value!r}" for key, value in kwargs.items()]
        print(f"calling {fn.__name__}({', '.join(parts)})")
        result = fn(*args, **kwargs)
        print(f"{fn.__name__} returned {result!r}")
        return result

    return wrapper


@log_calls
def add(a, b):
    return a + b


@log_calls
def greet(name, punctuation="!"):
    return f"Hi, {name}{punctuation}"


add(2, b=3)
greet("Olena")
```

Результат:

```text
calling add(2, b=3)
add returned 5
calling greet('Olena')
greet returned 'Hi, Olena!'
```

`repr()` бере рядки в лапки, тож лог стає однозначним.

### Вправа 3

```python
from functools import wraps


def positive_args(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        for arg in args:
            if isinstance(arg, (int, float)) and arg <= 0:
                raise ValueError("all arguments must be positive")
        return fn(*args, **kwargs)

    return wrapper


@positive_args
def area(width, height):
    return width * height


print(area(3, 4))
try:
    area(3, -4)
except ValueError as error:
    print("ValueError:", error)
```

Результат:

```text
12
ValueError: all arguments must be positive
```

### Вправа 4

Результат:

```text
decorating with second
decorating with first
--- calling ---
first: before
second: before
task runs
second: after
first: after
```

Декорування відбувається під час оголошення й іде знизу догори: спершу `second` обгортає `task`, потім `first` обгортає результат, тобто `task = first(second(task))`. Під час виклику першою працює зовнішня обгортка (`first`), вона викликає обгортку `second`, а та — початкову `task`. Рядки «after» з'являються у зворотному порядку, у міру того як завершується кожен виклик.

---

*Джерело: [pythontutorial.net — Python Decorators](https://www.pythontutorial.net/advanced-python/python-decorators/). Адаптовано й доповнено для PyJourney.*
