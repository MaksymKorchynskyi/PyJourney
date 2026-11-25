# Raise From

Коли обробник перетворює один виняток на інший, Python автоматично пов'язує їх між собою, як показано в темі *Raise Exceptions*. Але тоді трасування стверджує, що другий виняток виник «під час обробки» першого, ніби випадково. Інструкція `raise ... from ...` явно задає зв'язок: новий виняток **спричинено** старим. А за допомогою `from None` старий виняток можна приховати, якщо він лише заплутає читача.

## Що ви дізнаєтесь

- Синтаксис `raise NewError(...) from cause` і що він робить з об'єктом винятку
- Чим неявний ланцюжок (`__context__`) відрізняється від явного (`__cause__`)
- Як кожен вид ланцюжка показується в трасуванні
- Як приховати ланцюжок за допомогою `raise ... from None` і що насправді відбувається з початковим винятком
- Коли варто перетворювати виняток, а коли приховувати причину
- Як досліджувати й обходити ланцюжок винятків у коді

## Проблема: навмисна зміна, що виглядає як випадковість

Ця `divide()` навмисно замінює `ZeroDivisionError` на `ValueError`, який пояснює викликачеві правило:

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        raise ValueError("b must not be zero")


divide(10, 0)
```

Результат:

```text
Traceback (most recent call last):
  File "app.py", line 3, in divide
    return a / b
           ~~^~~
ZeroDivisionError: division by zero

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "app.py", line 8, in <module>
    divide(10, 0)
    ~~~~~~^^^^^^^
  File "app.py", line 5, in divide
    raise ValueError("b must not be zero")
ValueError: b must not be zero
```

Ключове речення тут — «During handling of the above exception, another exception occurred» («під час обробки винятку вище виник інший виняток»). Воно означає: поки Python обробляв `ZeroDivisionError`, ще щось пішло не так. Саме так виглядає баг усередині обробника, і кожен, хто читатиме це трасування, почне його шукати. Проте бага тут немає. `ValueError` — це запланований результат.

## Інструкція `raise ... from`

Синтаксис такий:

```python
raise NewException("message") from cause
```

`cause` — зазвичай виняток, перехоплений через `except ... as`. З ним обробник каже: «новий виняток — це **наслідок** цього»:

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError as ex:
        raise ValueError("b must not be zero") from ex


divide(10, 0)
```

Результат:

```text
Traceback (most recent call last):
  File "app.py", line 3, in divide
    return a / b
           ~~^~~
ZeroDivisionError: division by zero

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "app.py", line 8, in <module>
    divide(10, 0)
    ~~~~~~^^^^^^^
  File "app.py", line 5, in divide
    raise ValueError("b must not be zero") from ex
ValueError: b must not be zero
```

Обидва трасування ті самі, але речення між ними тепер звучить як «The above exception was the direct cause of the following exception» («виняток вище став безпосередньою причиною наступного винятку»). Читач одразу розуміє, що `ValueError` — навмисне перетворення, і водночас бачить, де виникла початкова проблема.

Ланцюжкове трасування, як завжди, читайте знизу. Останній виняток — той, що дійшов до вас. Блок над ним — його причина, а в довшому ланцюжку кожен блок є причиною того, що під ним.

### Що `from` робить з об'єктом винятку

`raise ... from cause` зберігає причину в атрибуті `__cause__` нового винятку. За замовчуванням `__cause__` дорівнює `None`:

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError as ex:
        raise ValueError("b must not be zero") from ex


try:
    divide(10, 0)
except ValueError as ex:
    print("cause:", ex.__cause__)
    print("exception:", ex)
    print(repr(ex.__cause__))
    print(ValueError("fresh").__cause__)
```

Результат:

```text
cause: division by zero
exception: b must not be zero
ZeroDivisionError('division by zero')
None
```

`ex.__cause__` — це сам початковий об'єкт винятку, тож викликач може його дослідити: тип, повідомлення, власні атрибути.

Приблизно `raise NewError("msg") from cause` робить таке:

```python
exc = NewError("msg")
exc.__cause__ = cause
exc.__suppress_context__ = True
raise exc
```

Варто знати дві деталі:

- Атрибути належать **екземпляру** винятку. (У деяких посібниках пишуть `ex = ExceptionType`, а потім задають `ex.__cause__`, тобто змінюють сам клас. Насправді відбувається не це.)
- Присвоєння `__cause__` також встановлює `__suppress_context__` у `True`. Цей прапорець каже Python не виводити неявний ланцюжок `__context__`, бо його замінює явна причина. (Якщо присвоїти `__cause__` вручну, прапорець так само встановлюється автоматично.)

`cause` може бути екземпляром винятку, класом винятку (тоді Python створить його екземпляр без аргументів) або `None`. Будь-що інше генерує `TypeError: exception causes must derive from BaseException`. `raise ... from` працює й поза блоком `except`, наприклад `raise RuntimeError("upload failed") from TimeoutError("no response")`, хоча на практиці його майже завжди використовують усередині обробника.

## Неявний і явний ланцюжки

Python відстежує два різні зв'язки між винятками:

| Атрибут | Хто встановлює | Значення | Речення в трасуванні |
|---|---|---|---|
| `__context__` | Python, автоматично, коли виняток генерується всередині `except` або `finally` | «цей виняток саме обробляли, коли з'явився новий» | During handling of the above exception, another exception occurred: |
| `__cause__` | `raise ... from cause` | «цей виняток — безпосередня причина нового» | The above exception was the direct cause of the following exception: |

`__context__` встановлюється **навіть тоді**, коли ви використовуєте `from`. Python завжди запам'ятовує, що саме обробляли. `from ex` лише додає явний зв'язок, а оскільки причина й контекст тут один і той самий об'єкт, трасування показує його тільки раз.

Виводячи трасування, Python для кожного винятку в ланцюжку діє за таким правилом:

1. Якщо `__cause__` не `None`, вивести причину з реченням про «direct cause».
2. Інакше, якщо `__context__` не `None`, а `__suppress_context__` дорівнює `False`, вивести контекст із реченням «during handling».
3. Інакше ланцюжок на цьому закінчується.

## Приховування причини: `raise ... from None`

Іноді початковий виняток — внутрішня деталь, яка тільки відволікатиме читача. `raise ... from None` приховує його:

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        raise ValueError("b must not be zero") from None


try:
    divide(10, 0)
except ValueError as ex:
    print("cause:", ex.__cause__)
    print("exception:", ex)
```

Результат:

```text
cause: None
exception: b must not be zero
```

Якщо прибрати `try` навколо виклику, у трасуванні буде лише `ValueError`:

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        raise ValueError("b must not be zero") from None


divide(10, 0)
```

Результат:

```text
Traceback (most recent call last):
  File "app.py", line 8, in <module>
    divide(10, 0)
    ~~~~~~^^^^^^^
  File "app.py", line 5, in divide
    raise ValueError("b must not be zero") from None
ValueError: b must not be zero
```

> **Зверніть увагу:** `from None` приховує початковий виняток, але **не** видаляє його. `__cause__` дорівнює `None`, а `__suppress_context__` — `True`, проте `__context__` і далі посилається на `ZeroDivisionError`. Інструменти налагодження можуть до нього дістатися.

Усі три варіанти поруч:

```python
def convert(kind):
    try:
        1 / 0
    except ZeroDivisionError as ex:
        if kind == "plain":
            raise ValueError("bad input")
        if kind == "from ex":
            raise ValueError("bad input") from ex
        raise ValueError("bad input") from None


for kind in ["plain", "from ex", "from None"]:
    try:
        convert(kind)
    except ValueError as e:
        print(f"{kind:9} cause={e.__cause__!r:34} "
              f"context={e.__context__!r} suppress={e.__suppress_context__}")
```

Результат:

```text
plain     cause=None                               context=ZeroDivisionError('division by zero') suppress=False
from ex   cause=ZeroDivisionError('division by zero') context=ZeroDivisionError('division by zero') suppress=True
from None cause=None                               context=ZeroDivisionError('division by zero') suppress=True
```

## Коли яку форму використовувати

**`raise ... from ex`: перетворити й зберегти причину.** Це правильний вибір у більшості випадків, коли ви перетворюєте виняток. Типовий приклад — функція, яка ховає, *як* вона працює, за винятком, що описує, *що* пішло не так на її власному рівні:

```python
import json


def load_config(text):
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise ValueError(f"config is not valid JSON (line {e.lineno}, column {e.colno})") from e


print(load_config('{"debug": true}'))

try:
    load_config('{"debug": true,}')
except ValueError as e:
    print(e)
    print("cause:", type(e.__cause__).__name__, "-", e.__cause__)
```

Результат:

```text
{'debug': True}
config is not valid JSON (line 1, column 15)
cause: JSONDecodeError - Illegal trailing comma before end of object: line 1 column 15 (char 14)
```

Викликач обробляє один задокументований тип винятку (`ValueError`), і йому не треба знати, що функція використовує модуль `json`. А той, хто налагоджуватиме код, однаково отримає точну помилку парсера через `__cause__` і в трасуванні.

**`raise ... from None`: початковий виняток нічого не додає.** Використовуйте цю форму, коли початковий виняток — деталь реалізації, яка лише вводитиме в оману. Класичний випадок — `__getattr__`, реалізований через пошук у словнику. Викликач запитував *атрибут*, тож `KeyError` зсередини вашого класу його заплутав би:

```python
class Settings:
    def __init__(self, **values):
        self._values = values

    def __getattr__(self, name):
        try:
            return self._values[name]
        except KeyError:
            raise AttributeError(f"no setting named {name!r}") from None


settings = Settings(debug=True)
print(settings.debug)
print(getattr(settings, "verbose", "default"))
print(hasattr(settings, "verbose"))
settings.verbose
```

Результат:

```text
True
default
False
Traceback (most recent call last):
  File "app.py", line 16, in <module>
    settings.verbose
  File "app.py", line 9, in __getattr__
    raise AttributeError(f"no setting named {name!r}") from None
AttributeError: no setting named 'verbose'
```

Те, що генерується саме `AttributeError` (а не `KeyError`), ще й забезпечує правильну роботу `getattr()` зі значенням за замовчуванням і `hasattr()`, бо обидві очікують `AttributeError`.

**Без `from` узагалі** — нормально, коли другий виняток справді не пов'язаний із першим і, звісно, коли він випадковий. Тоді неявний ланцюжок «during handling» чесно описує ситуацію.

> **Порада:** якщо сумніваєтеся, пишіть `from ex`. Зайва інформація рідко шкодить, а прихована першопричина збою в продакшені може коштувати годин пошуку.

## Як вивести ланцюжок самостійно

`traceback.print_exception(exc)` виводить виняток з усім ланцюжком точно так, як це зробив би Python. Передайте `chain=False`, щоб вивести лише сам виняток. `traceback.format_exception(exc)` повертає той самий текст у вигляді списку рядків (з'єднайте їх, щоб отримати один рядок), і це зручно для журналювання:

```python
import traceback


def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError as ex:
        raise ValueError("b must not be zero") from ex


try:
    divide(10, 0)
except ValueError as e:
    text = "".join(traceback.format_exception(e))
    print("ZeroDivisionError" in text, "direct cause" in text)
    print(text.splitlines()[-1])
    traceback.print_exception(e, chain=False)
```

Результат:

```text
True True
ValueError: b must not be zero
Traceback (most recent call last):
  File "app.py", line 12, in <module>
    divide(10, 0)
    ~~~~~~^^^^^^^
  File "app.py", line 8, in divide
    raise ValueError("b must not be zero") from ex
ValueError: b must not be zero
```

## Типові помилки

- **Перетворювати виняток без `from`.** Тоді трасування пише «During handling of the above exception, another exception occurred», і навмисне перетворення виглядає як баг в обробнику. Додайте `from ex`.
- **Забути `as ex`.** `except ZeroDivisionError:`, а далі `raise ValueError(...) from ex` завершується `NameError`, бо імені `ex` немає. А якщо в тій самій області видимості є старіше `ex`, причиною непомітно стане не той виняток.
- **Писати `from None` за звичкою.** Так викидається найкорисніша для налагодження інформація: першопричина. Використовуйте цю форму лише тоді, коли початковий виняток — суто деталь реалізації.
- **Вважати, що `from None` видаляє початковий виняток.** Він лише приховує його. Початковий виняток і далі лежить у `__context__`.
- **Читати ланцюжкове трасування згори.** Верхній блок — найстаріший виняток, першопричина. Виняток, який насправді дійшов до вашого коду, розташований у самому низу.
- **Губити подробиці в новому повідомленні.** `raise ValueError("invalid config") from e` зберігає причину, але викликач, який виводить лише повідомлення, нічого не дізнається. Додайте важливі факти (рядок, поле, значення) і в нове повідомлення.

## Підсумок

- `raise NewError(...) from cause` генерує `NewError` і записує `cause` в його атрибут `__cause__` (за замовчуванням `None`).
- З `from` трасування поєднує два винятки реченням «The above exception was the direct cause of the following exception». Без нього речення таке: «During handling of the above exception, another exception occurred».
- `__context__` встановлюється автоматично щоразу, коли виняток генерується під час обробки. `__cause__` встановлює тільки `from`. Задання причини також встановлює `__suppress_context__ = True`.
- `raise ... from None` приховує початковий виняток у трасуванні, але він лишається доступним у `__context__`.
- Використовуйте `from ex`, коли перетворюєте низькорівневі винятки на змістовні; `from None` — коли початковий виняток є заплутаною деталлю реалізації; і обходьтеся без `from`, коли новий виняток не пов'язаний зі старим.
- `traceback.print_exception()` і `traceback.format_exception()` виводять або форматують виняток з усім ланцюжком.

## Практика

### Вправа 1: Перетворіть помилки конфігурації

Напишіть `get_port(env)`, яка читає `env["PORT"]` зі словника й повертає значення як `int`. Відсутній ключ має перетворитися на `ValueError("PORT is not set")`, а нечислове значення — на `ValueError("PORT must be an integer, got 'abc'")` (з фактичним значенням). В обох випадках збережіть початковий виняток як причину. Перевірте на `{"PORT": "8080"}`, `{}` і `{"PORT": "abc"}`, виводячи для кожної невдачі повідомлення та `repr()` причини.

### Вправа 2: Передбачте ланцюжок

Передбачте, що виведе програма для кожного значення `mode`, а потім запустіть її.

```python
def step(mode):
    try:
        {}["user"]
    except KeyError as e:
        if mode == 1:
            raise LookupError("user missing")
        if mode == 2:
            raise LookupError("user missing") from e
        if mode == 3:
            raise LookupError("user missing") from None
        raise LookupError("user missing") from TimeoutError("db timeout")


for mode in [1, 2, 3, 4]:
    try:
        step(mode)
    except LookupError as err:
        cause = type(err.__cause__).__name__
        context = type(err.__context__).__name__
        print(mode, cause, context, err.__suppress_context__)
```

### Вправа 3: Обійдіть ланцюжок

Напишіть `explain(exc)`, яка повертає список рядків `"Type: message"` для кожного винятку в ланцюжку, який показав би Python, починаючи із самого `exc` і рухаючись до першопричини. Дотримуйтеся правила Python: переходьте до `__cause__`, якщо його задано, інакше до `__context__`, якщо `__suppress_context__` не дорівнює `True`. Перевірте на ланцюжку з трьох рівнів: `read_file()` генерує `FileNotFoundError`, `load_user()` перетворює його на `LookupError` через `from`, а `show_profile()` перетворює той на `RuntimeError` теж через `from`.

### Вправа 4: Доступ до полів як до атрибутів

Напишіть клас `Record`, який обгортає словник так, що `Record({"name": "Olena"}).name` повертає `"Olena"`. Відсутній ключ має генерувати `AttributeError("Record has no field 'age'")`, а `KeyError` має бути прихований. Покажіть, що `getattr(record, "age", None)` повертає `None`, а в самого винятку `__cause__` дорівнює `None`, тоді як `__context__` — це `KeyError`.

## Розв'язки

### Вправа 1

```python
def get_port(env):
    try:
        raw = env["PORT"]
    except KeyError as e:
        raise ValueError("PORT is not set") from e
    try:
        return int(raw)
    except ValueError as e:
        raise ValueError(f"PORT must be an integer, got {raw!r}") from e


print(get_port({"PORT": "8080"}))
for env in [{}, {"PORT": "abc"}]:
    try:
        get_port(env)
    except ValueError as e:
        print(e, "| cause:", repr(e.__cause__))
```

Результат:

```text
8080
PORT is not set | cause: KeyError('PORT')
PORT must be an integer, got 'abc' | cause: ValueError("invalid literal for int() with base 10: 'abc'")
```

Два окремі блоки `try` дають змогу кожному обробнику відповідати лише за одну операцію, як радить тема *Exception Handling*. Перетворювати `ValueError` на інший `ValueError` цілком нормально: повідомлення нового винятку зрозуміле викликачеві.

### Вправа 2

Результат:

```text
1 NoneType KeyError False
2 KeyError KeyError True
3 NoneType KeyError True
4 TimeoutError KeyError True
```

- Режим 1: лише неявний ланцюжок. Причини немає, контекст — `KeyError`, нічого не приховано.
- Режим 2: явна причина й контекст — той самий `KeyError`.
- Режим 3: `from None` не задає причини й приховує контекст, але контекст однаково записано.
- Режим 4: причиною може бути будь-який виняток, тут — новий `TimeoutError`. Контекстом і далі є `KeyError`, який обробляли, але його приховано, тож у трасуванні причиною було б показано лише `TimeoutError`.

### Вправа 3

```python
def explain(exc):
    steps = []
    while exc is not None:
        steps.append(f"{type(exc).__name__}: {exc}")
        if exc.__cause__ is not None:
            exc = exc.__cause__
        elif not exc.__suppress_context__:
            exc = exc.__context__
        else:
            exc = None
    return steps


def read_file(path):
    raise FileNotFoundError(f"no such file: {path}")


def load_user(user_id):
    try:
        read_file(f"users/{user_id}.json")
    except FileNotFoundError as e:
        raise LookupError(f"user {user_id} not found") from e


def show_profile(user_id):
    try:
        load_user(user_id)
    except LookupError as e:
        raise RuntimeError("cannot show profile") from e


try:
    show_profile(42)
except RuntimeError as e:
    for line in explain(e):
        print(line)
```

Результат:

```text
RuntimeError: cannot show profile
LookupError: user 42 not found
FileNotFoundError: no such file: users/42.json
```

`FileNotFoundError` не має ні причини, ні контексту, тому цикл на ньому зупиняється. Трасування Python показує ті самі три винятки у зворотному порядку, з першопричиною вгорі.

### Вправа 4

```python
class Record:
    def __init__(self, data):
        self._data = data

    def __getattr__(self, name):
        try:
            return self._data[name]
        except KeyError:
            raise AttributeError(f"Record has no field {name!r}") from None


record = Record({"name": "Olena"})
print(record.name)
print(getattr(record, "age", None))

try:
    record.age
except AttributeError as e:
    print(e)
    print(e.__cause__, repr(e.__context__), e.__suppress_context__)
```

Результат:

```text
Olena
None
Record has no field 'age'
None KeyError('age') True
```

`__getattr__` викликається лише для атрибутів, яких не вдалося знайти звичайним пошуком, тому `record._data` усередині методу працює як завжди.

---

*Джерело: [pythontutorial.net — Python raise from](https://www.pythontutorial.net/python-oop/python-raise-from/). Адаптовано й доповнено для PyJourney.*
