# Декоратори з аргументами

Деяким декораторам потрібні налаштування: скільки разів повторити виклик, яка роль потрібна користувачу, скільки повторних спроб дозволено. Ці налаштування передають як аргументи, наприклад `@repeat(3)`. У цій темі розглянуто, як працюють такі декоратори: це **фабрики декораторів**, тобто функції, які створюють і повертають декоратор.

## Що ви дізнаєтесь

- Чому жорстко закодоване значення всередині декоратора — це проблема
- Що таке фабрика декораторів і як обчислюється `@repeat(3)`
- Як три вкладені рівні (фабрика, декоратор, обгортка) обмінюються даними через замикання
- Як писати практичні параметризовані декоратори, наприклад для перевірки доступу
- Як зробити декоратор, що працює і з аргументами, і без них
- Типові помилки з дужками та як їх розпізнати

## Проблема: жорстко закодоване налаштування

Ось функція, яка виводить повідомлення:

```python
def say(message):
    """Print the message.

    Arguments:
        message: the message to show
    """
    print(message)
```

Припустімо, що кожен виклик `say()` має виводити повідомлення п'ять разів. Звичайний декоратор із цим упорається:

```python
from functools import wraps


def repeat(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        result = None
        for _ in range(5):
            result = fn(*args, **kwargs)
        return result

    return wrapper


@repeat
def say(message):
    """Print the message."""
    print(message)


say("Hello")
```

Результат:

```text
Hello
Hello
Hello
Hello
Hello
```

Це працює, але число `5` «зашите» в декоратор. Якщо одна функція має виконуватися п'ять разів, а інша десять, знадобляться два майже однакові декоратори. Насправді хочеться передавати число під час декорування:

```python
@repeat(5)
def say(message):
    ...
```

## Як обчислюється `@repeat(5)`

Після `@` може стояти будь-який вираз, результатом якого є декоратор. Python **спершу** обчислює цей вираз, а потім застосовує результат до функції. Отже,

```python
@repeat(5)
def say(message):
    ...
```

означає те саме, що й:

```python
def say(message):
    ...


say = repeat(5)(say)
```

(Обидва — фрагменти, які припускають наявність фабрики `repeat`, її оголошено нижче.)

`repeat(5)` — це звичайний виклик функції. Він має **повернути декоратор**: функцію, яка приймає `say` і повертає обгортку. Функцію, що повертає декоратор, називають **фабрикою декораторів** (decorator factory). Строго кажучи, новий `repeat` сам не є декоратором, він його *виготовляє*.

## Як написати фабрику декораторів

Обгорніть старий декоратор ще однією функцією, яка приймає аргументи:

```python
from functools import wraps


def repeat(times):
    """Call the decorated function `times` times."""

    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            result = None
            for _ in range(times):
                result = fn(*args, **kwargs)
            return result

        return wrapper

    return decorate


@repeat(3)
def say(message):
    """Print the message."""
    print(message)


say("Hello")
```

Результат:

```text
Hello
Hello
Hello
```

Тепер маємо три рівні, і кожен має своє завдання:

```text
repeat(times)                  фабрика: отримує аргументи декоратора
  |
  +-- decorate(fn)             декоратор: отримує функцію, яку треба обгорнути
        |
        +-- wrapper(*args, **kwargs)   виконується під час кожного виклику say()
```

- `repeat(3)` виконується один раз, під час оголошення функції, і повертає `decorate`. Значення `3` зберігається в замиканні.
- Одразу після цього виконується `decorate(say)` і повертає `wrapper`. Тепер у замиканні збережено й `fn`.
- `wrapper(...)` виконується під час кожного виклику. Вона читає і `times`, і `fn` зі своїх охопних областей видимості.

Захоплені значення видно у вільних змінних обгортки:

```python
from functools import wraps


def repeat(times):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            result = None
            for _ in range(times):
                result = fn(*args, **kwargs)
            return result

        return wrapper

    return decorate


@repeat(3)
def say(message):
    print(message)


print(say.__name__)
print(say.__code__.co_freevars)
print(say.__closure__[1].cell_contents)
```

Результат:

```text
say
('fn', 'times')
3
```

Комірки в `__closure__` ідуть у тому самому порядку, що й імена в `co_freevars`, тож індекс `1` — це комірка для `times`.

Оскільки кожен виклик `repeat(...)` створює нове замикання, різні функції можуть мати різні налаштування:

```python
from functools import wraps


def repeat(times):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            result = None
            for _ in range(times):
                result = fn(*args, **kwargs)
            return result

        return wrapper

    return decorate


@repeat(2)
def beep():
    print("beep")


@repeat(4)
def dot():
    print(".", end="")


beep()
dot()
print()
```

Результат:

```text
beep
beep
....
```

> **Зверніть увагу:** рядок `result = None` перед циклом важливий. Без нього `@repeat(0)` ніколи не присвоїть `result`, і `return result` згенерує `UnboundLocalError`.

## Практичний приклад: контроль доступу

Аргументи декоратора часто задають правила, які відрізняються від функції до функції. Цей декоратор перевіряє, що користувач, переданий першим аргументом, має певну роль:

```python
from functools import wraps


def require_role(role):
    def decorate(fn):
        @wraps(fn)
        def wrapper(user, *args, **kwargs):
            if role not in user["roles"]:
                raise PermissionError(f"{user['name']} needs role {role!r}")
            return fn(user, *args, **kwargs)

        return wrapper

    return decorate


@require_role("admin")
def delete_note(user, note_id):
    return f"note {note_id} deleted by {user['name']}"


@require_role("editor")
def edit_note(user, note_id, text):
    return f"note {note_id} now says {text!r}"


admin = {"name": "Olena", "roles": {"admin", "editor"}}
guest = {"name": "Max", "roles": {"viewer"}}

print(delete_note(admin, 42))
print(edit_note(admin, 7, text="Hi"))
try:
    delete_note(guest, 42)
except PermissionError as error:
    print("PermissionError:", error)
```

Результат:

```text
note 42 deleted by Olena
note 7 now says 'Hi'
PermissionError: Max needs role 'admin'
```

Вебфреймворки використовують той самий шаблон: `@app.route("/notes", methods=["GET"])` — це виклик фабрики декораторів.

Ви вже користувалися фабриками декораторів зі стандартної бібліотеки: і `@functools.wraps(fn)`, і `@functools.lru_cache(maxsize=128)` приймають аргументи й повертають справжній декоратор.

## Декоратори з необов'язковими аргументами

Іноді хочеться, щоб працювали обидві форми: `@repeat` (зі значенням за замовчуванням) і `@repeat(times=3)`. Хитрість у тому, щоб перевірити, чи отримав декоратор функцію першим аргументом:

```python
from functools import wraps


def repeat(fn=None, *, times=2):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            result = None
            for _ in range(times):
                result = fn(*args, **kwargs)
            return result

        return wrapper

    if fn is None:
        # форма @repeat(times=...): повертаємо декоратор
        return decorate
    # форма @repeat: одразу декоруємо функцію
    return decorate(fn)


@repeat
def ping():
    print("ping")


@repeat(times=3)
def pong():
    print("pong")


ping()
pong()
```

Результат:

```text
ping
ping
pong
pong
pong
```

Символ `*` робить `times` **суто іменованим** (keyword-only) аргументом. Це принципово: якби `times` був позиційним, `@repeat(3)` передав би `3` як `fn`, і перевірка `fn is None` не змогла б відрізнити число від функції.

## Типові помилки

- **Забути дужки.** Якщо декоратор — фабрика, то `@repeat` (без `(3)`) передає саму функцію як `times`. Під час оголошення Python не скаржиться, а помилка проявляється пізніше й дуже заплутано:

  ```python
  from functools import wraps


  def repeat(times):
      def decorate(fn):
          @wraps(fn)
          def wrapper(*args, **kwargs):
              result = None
              for _ in range(times):
                  result = fn(*args, **kwargs)
              return result

          return wrapper

      return decorate


  @repeat
  def say(message):
      print(message)


  result = say("Hello")
  print(say.__name__)
  print(result.__name__)
  ```

  Результат:

  ```text
  decorate
  wrapper
  ```

  Тепер `say` — це внутрішня функція `decorate`. Її виклик нічого не виводить: вона «декорує» рядок `"Hello"` і повертає обгортку.

- **Поставити дужки, але не передати аргументів.** `@repeat()` викликає фабрику без обов'язкового аргументу й завершується помилкою `TypeError: repeat() missing 1 required positional argument: 'times'`.
- **Переплутати рівні.** Аргументи декоратора (`times`) належать зовнішній функції, декорована функція (`fn`) — середній, а аргументи виклику (`*args, **kwargs`) — найглибшій. Найчастіша помилка — поставити `fn` у зовнішню функцію.
- **Забути повернути один із рівнів.** Кожна з двох зовнішніх функцій має повернути наступну (`return wrapper`, `return decorate`). Якщо пропустити будь-який `return`, декороване ім'я стане `None`.
- **Не ініціалізувати результат.** Цикл, який може не виконатися жодного разу, залишає `result` без значення. Ініціалізуйте змінну перед циклом.

## Підсумок

- Декоратор з аргументами — це насправді **фабрика декораторів**: функція, яка приймає аргументи й повертає декоратор.
- `@factory(args)` над `def f` означає `f = factory(args)(f)`.
- Параметризований декоратор має три рівні: фабрику (отримує аргументи), декоратор (отримує функцію) та обгортку (виконується під час кожного виклику).
- Замикання переносять в обгортку і аргументи, і функцію, а кожен виклик фабрики створює незалежне замикання.
- І далі використовуйте `functools.wraps(fn)` на найглибшому рівні.
- Щоб підтримати і `@deco`, і `@deco(option=...)`, приймайте `fn=None` разом із суто іменованими параметрами й перевіряйте, яку форму використано.

## Практика

### Вправа 1: Округлення результату

Напишіть фабрику декораторів `round_result(digits)`, яка округлює число, повернене декорованою функцією, до `digits` знаків після коми. Задекоруйте `average(*numbers)` за допомогою `@round_result(2)` і виведіть `average(1, 2, 2)` та `average.__name__`.

### Вправа 2: Повторні спроби

Напишіть `retry(attempts, exceptions=(Exception,))`. Обгортка викликає функцію до `attempts` разів. Якщо виклик генерує один із винятків `exceptions`, виведіть `attempt N failed: <error>` і спробуйте ще раз. Якщо й остання спроба невдала, згенеруйте її виняток повторно. Перевірте декоратор на функції, яка двічі падає, а з третьої спроби спрацьовує, і на функції, яка падає завжди.

### Вправа 3: Необов'язкові аргументи

Напишіть декоратор `exclaim`, який додає знаки оклику до рядка, поверненого функцією. Він має працювати в обох формах: `@exclaim` додає один `"!"`, а `@exclaim(count=3)` — три. Зробіть `count` суто іменованим параметром.

## Розв'язки

### Вправа 1

```python
from functools import wraps


def round_result(digits):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            return round(fn(*args, **kwargs), digits)

        return wrapper

    return decorate


@round_result(2)
def average(*numbers):
    return sum(numbers) / len(numbers)


print(average(1, 2, 2))
print(average.__name__)
```

Результат:

```text
1.67
average
```

### Вправа 2

```python
from functools import wraps


def retry(attempts, exceptions=(Exception,)):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            for attempt in range(1, attempts + 1):
                try:
                    return fn(*args, **kwargs)
                except exceptions as error:
                    print(f"attempt {attempt} failed: {error}")
                    if attempt == attempts:
                        raise

        return wrapper

    return decorate


calls = 0


@retry(3, exceptions=(ConnectionError,))
def fetch():
    global calls
    calls += 1
    if calls < 3:
        raise ConnectionError("server busy")
    return "data"


@retry(2)
def broken():
    raise ValueError("bad input")


print(fetch())
try:
    broken()
except ValueError as error:
    print("gave up:", error)
```

Результат:

```text
attempt 1 failed: server busy
attempt 2 failed: server busy
data
attempt 1 failed: bad input
attempt 2 failed: bad input
gave up: bad input
```

`raise` без аргументів повторно генерує виняток, який зараз обробляється, зі збереженням початкового трасування. `global calls` тут потрібне лише для імітації нестабільного сервера.

### Вправа 3

```python
from functools import wraps


def exclaim(fn=None, *, count=1):
    def decorate(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            return fn(*args, **kwargs) + "!" * count

        return wrapper

    if fn is None:
        return decorate
    return decorate(fn)


@exclaim
def hello(name):
    return f"Hello, {name}"


@exclaim(count=3)
def warn(text):
    return text.upper()


print(hello("Max"))
print(warn("careful"))
print(warn.__name__)
```

Результат:

```text
Hello, Max!
CAREFUL!!!
warn
```

---

*Джерело: [pythontutorial.net — Python Decorator with Arguments](https://www.pythontutorial.net/advanced-python/python-decorator-arguments/). Адаптовано й доповнено для PyJourney.*
