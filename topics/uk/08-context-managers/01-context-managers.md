# Менеджери контексту

**Менеджер контексту** (context manager) — це об'єкт, який готує щось перед виконанням блоку коду і надійно прибирає за собою після нього, навіть якщо блок завершився винятком. Його використовують з інструкцією `with`. Так керують файлами, блокуваннями, транзакціями бази даних і тимчасовими налаштуваннями, а власні менеджери контексту дають змогу зібрати логіку підготовки та прибирання в одному місці й використовувати її повторно.

## Що ви дізнаєтесь

- Чому ручне прибирання через `close()` ненадійне і як це виправляє `try`/`finally`
- Як працює інструкція `with` і до чого прив'язується `as`
- Що таке **протокол менеджера контексту**: `__enter__()` і `__exit__()`, і коли саме викликається кожен із них
- Як `__exit__()` отримує відомості про виняток і як може його придушити
- Типові застосування: відкрити–закрити, захопити–звільнити, запустити–зупинити, змінити–відновити
- Як писати менеджери контексту у вигляді класів і за допомогою `contextlib.contextmanager`

## Підготовка файлів для прикладів

Приклади читають два невеликі текстові файли. Один раз створіть їх у робочій теці:

```python
from pathlib import Path

Path("data.txt").write_text("100\n")   # коректне число
Path("bad.txt").write_text("'100'")    # число в лапках: int() його не прийме
```

## Проблема: прибирання, яке не відбувається

Програма, що читає число з файлу, зазвичай має такий вигляд: відкрити, прочитати, перетворити, закрити.

```python
f = open("data.txt")
data = f.readlines()

# перетворюємо число на ціле й виводимо його
print(int(data[0]))

f.close()
```

Результат:

```text
100
```

Це працює, доки дані відповідають очікуванням. Якщо перетворення генерує виняток, до рядка з `f.close()` справа так і не доходить:

```python
f = open("bad.txt")
try:
    data = f.readlines()
    print(int(data[0]))
    f.close()
except ValueError as error:
    print("ValueError:", error)

print("Is the file closed?", f.closed)
```

Результат:

```text
ValueError: invalid literal for int() with base 10: "'100'"
Is the file closed? False
```

Файл лишається відкритим. У короткому скрипті операційна система прибере все після завершення програми, але програма, що працює довго (вебсервер, конвеєр обробки даних) і на кожній помилці «губить» файловий дескриптор, рано чи пізно впреться в обмеження на кількість відкритих файлів. Те саме стосується мережевих з'єднань, блокувань і транзакцій бази даних.

Класичне рішення — `finally`, чий блок виконується **хоч би як** завершився блок `try`:

```python
f = open("bad.txt")
try:
    data = f.readlines()
    # перетворюємо число на ціле й виводимо його
    print(int(data[0]))
except ValueError as error:
    print("ValueError:", error)
finally:
    f.close()

print("Is the file closed?", f.closed)
```

Результат:

```text
ValueError: invalid literal for int() with base 10: "'100'"
Is the file closed? True
```

> **Зверніть увагу:** `open()` навмисно викликано *перед* `try`. Якби він стояв усередині `try`, а файлу не існувало, змінна `f` так і не отримала б значення, і `f.close()` у `finally` впав би з `NameError`, який приховав би справжню помилку `FileNotFoundError`.

Це правильно, але багатослівно, і про цей шаблон доводиться пам'ятати щоразу.

## Інструкція `with`

Менеджер контексту вбудовує логіку `try`/`finally` у сам об'єкт. Файлові об'єкти — менеджери контексту, тож код вище перетворюється на такий:

```python
with open("data.txt") as f:
    data = f.readlines()
    print(int(data[0]))

print("Is the file closed?", f.closed)
```

Результат:

```text
100
Is the file closed? True
```

Коли блок закінчується, Python автоматично закриває файл. Те саме відбувається, якщо з блоку вийшли через виняток:

```python
try:
    with open("bad.txt") as f:
        print(int(f.read()))
except ValueError as error:
    print("ValueError:", error)

print("Is the file closed?", f.closed)
```

Результат:

```text
ValueError: invalid literal for int() with base 10: "'100'"
Is the file closed? True
```

Загальний синтаксис:

```text
with expression as target:
    body
```

1. Обчислюється `expression`. Результат має бути менеджером контексту.
2. Python викликає метод менеджера `__enter__()`. Його **повернене значення** присвоюється `target`. Частина `as target` необов'язкова.
3. Виконується `body`.
4. Коли виконання залишає тіло **з будь-якої причини** (воно завершилося, виник виняток або `return`, `break` чи `continue` вивели з нього), Python викликає метод менеджера `__exit__()`.

Блок `with` не створює нової області видимості. Ім'я `target` доступне й після блоку, як показує `f.closed` вище, але ресурс, на який воно посилається, уже звільнено.

## Протокол менеджера контексту

Об'єкт є менеджером контексту, якщо його клас визначає два методи:

| Метод | Призначення |
|---|---|
| `__enter__(self)` | Підготувати контекст. Значення, яке він повертає, прив'язується до цілі `as`. |
| `__exit__(self, exc_type, exc_value, traceback)` | Прибрати. Отримує відомості про виняток, якщо він був, і може його придушити. |

Клас-трасувальник показує порядок викликів. Приклади нижче використовують його повторно:

```python
class Tracer:
    def __init__(self, name):
        self.name = name
        print(f"{self.name}: __init__()")

    def __enter__(self):
        print(f"{self.name}: __enter__()")
        return f"resource of {self.name}"

    def __exit__(self, exc_type, exc_value, traceback):
        print(f"{self.name}: __exit__({exc_type}, {exc_value!r})")
        return False


with Tracer("demo") as value:
    print("inside the block, value =", repr(value))
print("after the block")
```

Результат:

```text
demo: __init__()
demo: __enter__()
inside the block, value = 'resource of demo'
demo: __exit__(None, None)
after the block
```

Зверніть увагу: `value` — це рядок, який повернув `__enter__()`, а не об'єкт `Tracer`. Ціль `as` завжди отримує те, що повертає `__enter__()`. Багато менеджерів контексту повертають `self` (так роблять файлові об'єкти), тому `with open(...) as f` і дає вам файл.

Тепер те саме з винятком усередині блоку:

```python
try:
    with Tracer("failing") as value:
        print("inside the block")
        raise KeyError("missing")
        print("never printed")
except KeyError as error:
    print("caught outside:", repr(error))
```

Результат:

```text
failing: __init__()
failing: __enter__()
inside the block
failing: __exit__(<class 'KeyError'>, KeyError('missing'))
caught outside: KeyError('missing')
```

Спершу відпрацював `__exit__()`, а потім виняток продовжив шлях до зовнішнього `except`.

### Що робить `with`, крок за кроком

Інструкція `with` приблизно еквівалентна такому коду (спрощено з довідника мови):

```text
manager = expression
target = manager.__enter__()
try:
    body
except BaseException as exc:
    if not manager.__exit__(type(exc), exc, exc.__traceback__):
        raise                      # __exit__ повернув хибне значення: генеруємо виняток знову
else:
    manager.__exit__(None, None, None)
```

Звідси три висновки:

- `__exit__()` викликається **щоразу, коли виконання залишає тіло**, звичайним шляхом чи через виняток, але **не** викликається, якщо виняток згенерував сам `__enter__()`, бо тіло так і не почало виконуватися.
- Без винятку `__exit__()` отримує `None, None, None`.
- З винятком він отримує клас винятку, об'єкт винятку і його трасування (traceback).

### Значення, яке повертає `__exit__()`

- Якщо `__exit__()` повертає **істинне** значення, виняток **придушується** (suppress): він зникає, і виконання продовжується після інструкції `with`.
- Якщо повертає **хибне** значення, виняток поширюється далі. `None` вважається хибним, тож метод без інструкції `return` ніколи нічого не придушує.

Не генеруйте виняток повторно всередині `__exit__()` самостійно. Поверніть `False` (або нічого), і Python згенерує його знову сам.

Ось менеджер контексту, який придушує лише ті типи винятків, які йому передали:

```python
class Ignore:
    def __init__(self, *exception_types):
        self.exception_types = exception_types

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return exc_type is not None and issubclass(exc_type, self.exception_types)


with Ignore(ZeroDivisionError):
    print("before")
    1 / 0
    print("skipped")
print("after")

try:
    with Ignore(ZeroDivisionError):
        int("abc")
except ValueError as error:
    print("not ignored:", error)
```

Результат:

```text
before
after
not ignored: invalid literal for int() with base 10: 'abc'
```

Решта тіла після винятку (`print("skipped")`) однаково пропускається: придушення винятку не відновлює виконання блоку. У стандартній бібліотеці такий самий інструмент є під назвою `contextlib.suppress`.

## Де використовують менеджери контексту

Щоразу, коли дія потребує парної «скасувальної» дії, менеджер контексту гарантує, що друга дія відбудеться.

### 1. Відкрити – закрити

Файли, мережеві сокети, з'єднання з базою даних, тимчасові теки: усе, що треба звільнити після використання.

### 2. Захопити – звільнити

`threading.Lock` — менеджер контексту. `with lock:` захоплює блокування і завжди звільняє його, навіть якщо захищений код упав, а це запобігає взаємним блокуванням (deadlocks):

```python
import threading

lock = threading.Lock()

with lock:
    print("locked inside:", lock.locked())
print("locked after:", lock.locked())
```

Результат:

```text
locked inside: True
locked after: False
```

### 3. Запустити – зупинити

Вимірювання часу, запуск і зупинка сервісу, відкриття й підтвердження транзакції. Приклад із класом `Timer` наведено нижче.

### 4. Змінити – відновити

Тимчасово змінити певний стан, попрацювати з ним, а потім повернути попередній. Наприклад, застосунок може мати типове з'єднання з базою даних, а якомусь коду потрібно деякий час працювати з іншим:

```python
settings = {"database": "main"}


class UseDatabase:
    def __init__(self, name):
        self.name = name

    def __enter__(self):
        self.previous = settings["database"]   # запам'ятовуємо старе значення
        settings["database"] = self.name       # змінюємо його
        return self.name

    def __exit__(self, exc_type, exc_value, traceback):
        settings["database"] = self.previous   # завжди відновлюємо
        return False


print(settings["database"])
with UseDatabase("reports"):
    print(settings["database"])
print(settings["database"])
```

Результат:

```text
main
reports
main
```

Стандартна бібліотека використовує ту саму ідею. `decimal.localcontext()` змінює точність десяткової арифметики лише всередині блоку:

```python
from decimal import Decimal, localcontext

with localcontext() as ctx:
    ctx.prec = 5
    print(Decimal(1) / Decimal(7))

print(Decimal(1) / Decimal(7))
```

Результат:

```text
0.14286
0.1428571428571428571428571429
```

## Реалізуємо протокол: клас `File`

Клас нижче — спрощена версія того, що дає `open()`. Він відкриває файл у `__enter__()` і закриває в `__exit__()`:

```python
class File:
    def __init__(self, filename, mode):
        self.filename = filename
        self.mode = mode
        self._file = None

    def __enter__(self):
        print(f"Opening the file {self.filename}.")
        self._file = open(self.filename, self.mode)
        return self._file

    def __exit__(self, exc_type, exc_value, exc_traceback):
        print(f"Closing the file {self.filename}.")
        if not self._file.closed:
            self._file.close()

        return False


with File("data.txt", "r") as f:
    print(int(next(f)))
```

Результат:

```text
Opening the file data.txt.
100
Closing the file data.txt.
```

Як це працює:

- `__init__()` лише зберігає ім'я файлу і режим. Нічого ще не відкрито.
- `__enter__()` відкриває файл і повертає файловий об'єкт, тож `f` — це справжній файл, а не екземпляр `File`.
- `__exit__()` закриває файл, якщо він ще відкритий, і повертає `False`, тож будь-який виняток із блоку поширюється далі.
- `next(f)` читає перший рядок, бо файловий об'єкт — ітератор по своїх рядках.

## Запустити – зупинити: клас `Timer`

`Timer` запускає годинник у `__enter__()` і зупиняє його в `__exit__()`. `__enter__()` повертає `self`, тож код після блоку може прочитати виміряний час з цілі `as`:

```python
from time import perf_counter


class Timer:
    def __init__(self):
        self.elapsed = 0

    def __enter__(self):
        self.start = perf_counter()
        return self

    def __exit__(self, exc_type, exc_value, exc_traceback):
        self.stop = perf_counter()
        self.elapsed = self.stop - self.start
        return False


def fibonacci(n):
    f1 = 1
    f2 = 1
    for _ in range(n - 1):
        f1, f2 = f2, f1 + f2

    return f1


with Timer() as timer:
    for _ in range(1000):
        fibonacci(1000)

print(f"{timer.elapsed:.4f} seconds")
```

Результат (час залежить від комп'ютера і змінюється від запуску до запуску):

```text
0.0193 seconds
```

`__exit__()` не повертає виміряний час: його повернене значення лише вирішує, чи придушити виняток. Тому результат зберігається в атрибуті `elapsed`. `perf_counter()` — правильний годинник для вимірювання тривалості, бо має найвищу доступну роздільну здатність і ніколи не «стрибає» назад.

## Скорочення: `contextlib.contextmanager`

Клас із двома dunder-методами — найявніший підхід. Для простих випадків декоратор `@contextmanager` з модуля `contextlib` перетворює **генераторну функцію** на менеджер контексту:

- код **перед** `yield` виконується як `__enter__()`;
- **видане значення** прив'язується до цілі `as`;
- код **після** `yield` виконується як `__exit__()`.

```python
from contextlib import contextmanager

settings = {"database": "main"}


@contextmanager
def use_database(name):
    previous = settings["database"]
    settings["database"] = name
    try:
        yield name
    finally:
        settings["database"] = previous


with use_database("reports") as db:
    print("inside:", db, settings["database"])
print("after:", settings["database"])

try:
    with use_database("archive"):
        raise RuntimeError("query failed")
except RuntimeError as error:
    print("error:", error)
print("after the error:", settings["database"])
```

Результат:

```text
inside: reports reports
after: main
error: query failed
after the error: main
```

Якщо блок генерує виняток, той повторно генерується **всередині генератора, у місці `yield`**. Саме тому прибирання стоїть у `finally`: без нього виняток пропустив би рядок, що відновлює значення. Щоб придушити виняток, перехопіть його навколо `yield` за допомогою `except`, а не дозволяйте йому поширюватися.

> **Зверніть увагу:** менеджер контексту на основі генератора має виконати `yield` **рівно один раз**. Другий `yield` призводить до `RuntimeError: generator didn't stop`.

## Інші інструменти з `contextlib`

| Інструмент | Що робить |
|---|---|
| `suppress(*exceptions)` | Ігнорує перелічені винятки всередині блоку. |
| `redirect_stdout(file)` | Тимчасово спрямовує виведення `print()` в інший файлоподібний об'єкт. |
| `closing(obj)` | Наприкінці викликає `obj.close()` — для об'єктів, які мають `close()`, але не є менеджерами контексту. |
| `chdir(path)` | Тимчасово змінює поточну робочу теку (Python 3.11+). |
| `ExitStack()` | Керує кількома менеджерами контексту, кількість яких стає відомою лише під час виконання. |

```python
import io
import os
from contextlib import redirect_stdout, suppress

with suppress(FileNotFoundError):
    os.remove("no-such-file.txt")   # помилку тихо проігноровано
print("still running")

buffer = io.StringIO()
with redirect_stdout(buffer):
    print("this goes into the buffer")
print("captured:", repr(buffer.getvalue()))
```

Результат:

```text
still running
captured: 'this goes into the buffer\n'
```

## Кілька менеджерів контексту в одному `with`

Можна перелічити кілька менеджерів через кому. Вхід у них відбувається зліва направо, а вихід — у **зворотному** порядку, як у вкладених інструкціях `with`. Ось приклад із класом `Tracer`, визначеним вище:

```python
with Tracer("A") as a, Tracer("B") as b:
    print("body")
```

Результат:

```text
A: __init__()
A: __enter__()
B: __init__()
B: __enter__()
body
B: __exit__(None, None)
A: __exit__(None, None)
```

Починаючи з Python 3.10, довгий перелік можна взяти в круглі дужки й розбити на кілька рядків:

```python
with (
    open("data.txt") as source,
    open("copy.txt", "w") as target,
):
    target.write(source.read())

with open("copy.txt") as f:
    print(f.read().strip())
```

Результат:

```text
100
```

## Типові помилки

- **Використовувати клас замість екземпляра.** `with Timer:` передає сам клас, а він не є менеджером контексту: `TypeError: 'type' object does not support the context manager protocol (missed __exit__ method)`. Пишіть `with Timer():`.

- **Забути `return self` у `__enter__()`.** Тоді ціль `as` дорівнює `None`, і перше ж звернення до атрибута завершується помилкою `AttributeError: 'NoneType' object has no attribute ...`.

- **Випадково повертати `True` з `__exit__()`.** Це мовчки «ковтає» *кожен* виняток у блоці, зокрема справжні помилки в коді. Повертайте істинне значення лише для винятків, які ви свідомо хочете придушити.

- **Не обгортати `yield` у `try`/`finally` у функції з `@contextmanager`.** Якщо блок згенерує виняток, код після `yield` не виконається, і прибирання буде пропущено.

- **Користуватися ресурсом після блоку.** Ім'я існує й далі, але ресурс уже закрито:

  ```python
  with open("data.txt") as f:
      pass

  try:
      f.read()
  except ValueError as error:
      print("ValueError:", error)
  ```

  Результат:

  ```text
  ValueError: I/O operation on closed file.
  ```

- **Ставити `open()` всередину `try`, а закривати у `finally`.** Якщо `open()` не вдасться, `f` не існуватиме, і `finally` згенерує `NameError`. Використовуйте `with` або викликайте `open()` перед `try`.

## Підсумок

- Менеджер контексту готує контекст у `__enter__()` і прибирає в `__exit__()`. Інструкція `with` гарантує, що `__exit__()` виконається щоразу, коли виконання залишає блок, навіть через виняток.
- Ціль `as` отримує значення, яке повертає `__enter__()`, і це не обов'язково сам менеджер.
- `__exit__(exc_type, exc_value, traceback)` у разі успіху отримує тричі `None`, а в разі помилки — відомості про виняток. Істинне повернене значення придушує виняток; `False` чи `None` дозволяють йому поширитися.
- Якщо `__enter__()` згенерує виняток, ні тіло, ні `__exit__()` не виконуються.
- Типові шаблони: відкрити–закрити, захопити–звільнити, запустити–зупинити, змінити–відновити.
- `@contextlib.contextmanager` перетворює генератор з одним `yield` на менеджер контексту. Прибирання розміщуйте у `finally`.
- Кілька менеджерів можуть ділити один `with`. Виходять вони у зворотному порядку.

## Практика

### Вправа 1: Передбачте результат

Запишіть точний результат, а потім запустіть код і перевірте себе.

```python
class Guard:
    def __enter__(self):
        print("enter")
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        print("exit:", exc_type.__name__ if exc_type else None)
        return exc_type is ValueError


with Guard():
    print("step 1")
    raise ValueError("bad value")
    print("step 2")
print("after first block")

try:
    with Guard():
        raise TypeError("bad type")
except TypeError:
    print("TypeError escaped")
```

### Вправа 2: Тимчасовий атрибут

Напишіть менеджер контексту на основі класу `TemporaryAttribute(obj, name, value)`, який на час виконання блоку встановлює `obj.name = value`, а потім відновлює старе значення. Якщо атрибута раніше не було, після блоку його треба видалити. Відновлення має відбуватися й тоді, коли блок згенерує виняток.

### Вправа 3: `ignore()` на генераторі

За допомогою `@contextmanager` напишіть `ignore(*exception_types)`, який придушує лише передані типи винятків і пропускає всі інші. Покажіть, що `with ignore(KeyError): {}["x"]` нічого не виводить, а `ZeroDivisionError` усередині `with ignore(KeyError):` усе одно поширюється далі.

### Вправа 4: Усе або нічого

Напишіть менеджер контексту `Transaction(items)` для списку. Усередині блоку код працює з **копією** списку (її повертає `__enter__()`). Якщо блок завершився без винятку, зміни записуються назад в оригінальний список. Якщо виник виняток, оригінальний список лишається незмінним, а виняток поширюється далі.

## Розв'язки

### Вправа 1

Результат:

```text
enter
step 1
exit: ValueError
after first block
enter
exit: TypeError
TypeError escaped
```

`ValueError` придушено, бо для нього `__exit__()` повертає `True`, тож `"after first block"` виводиться, а `"step 2"` — ні: придушення винятку ніколи не відновлює виконання блоку. Для `TypeError` метод `__exit__()` повертає `False`, тому виняток доходить до зовнішнього `try`.

### Вправа 2

```python
class TemporaryAttribute:
    _missing = object()   # унікальна позначка «атрибута не існувало»

    def __init__(self, obj, name, value):
        self.obj = obj
        self.name = name
        self.value = value

    def __enter__(self):
        self.old_value = getattr(self.obj, self.name, self._missing)
        setattr(self.obj, self.name, self.value)
        return self.obj

    def __exit__(self, exc_type, exc_value, traceback):
        if self.old_value is self._missing:
            delattr(self.obj, self.name)
        else:
            setattr(self.obj, self.name, self.old_value)
        return False


class Config:
    debug = False


config = Config()

with TemporaryAttribute(config, "debug", True):
    print("inside:", config.debug)
print("after:", config.debug)

with TemporaryAttribute(config, "level", 3):
    print("inside:", config.level)
print("has level after:", hasattr(config, "level"))

try:
    with TemporaryAttribute(config, "debug", True):
        raise RuntimeError("boom")
except RuntimeError:
    print("after error:", config.debug)
```

Результат:

```text
inside: True
after: False
inside: 3
has level after: False
after error: False
```

`_missing = object()` створює сигнальне значення, яке неможливо сплутати з жодним справжнім значенням. Якби позначкою був `None`, код ламався б на атрибутах, чиє справжнє значення — `None`. У першому блоці `setattr()` створює атрибут *екземпляра*, який затуляє атрибут класу `Config.debug`. Після відновлення атрибут екземпляра лишається, але вже зі старим значенням `False`.

### Вправа 3

```python
from contextlib import contextmanager


@contextmanager
def ignore(*exception_types):
    try:
        yield
    except exception_types:
        pass


with ignore(KeyError):
    {}["x"]
print("KeyError was ignored")

try:
    with ignore(KeyError):
        1 / 0
except ZeroDivisionError as error:
    print("propagated:", error)
```

Результат:

```text
KeyError was ignored
propagated: division by zero
```

Виняток із блоку повторно генерується в місці `yield`. `except exception_types` приймає кортеж класів, тож перелічені винятки перехоплюються (а отже, придушуються), а всі інші виходять із генератора й доходять до викликача.

### Вправа 4

```python
class Transaction:
    def __init__(self, items):
        self.items = items

    def __enter__(self):
        self.working_copy = list(self.items)
        return self.working_copy

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type is None:
            self.items[:] = self.working_copy   # підтверджуємо: замінюємо вміст на місці
        return False                            # ніколи не придушуємо помилки


cart = ["apple"]

with Transaction(cart) as items:
    items.append("pear")
    items.append("plum")
print(cart)

try:
    with Transaction(cart) as items:
        items.append("melon")
        raise ValueError("payment declined")
except ValueError as error:
    print("rolled back:", error)
print(cart)
```

Результат:

```text
['apple', 'pear', 'plum']
rolled back: payment declined
['apple', 'pear', 'plum']
```

`self.items[:] = ...` замінює *вміст* оригінального списку, тож кожне посилання на `cart` бачить підтверджений результат. Запис `self.items = self.working_copy` лише перев'язав би атрибут, а `cart` лишився б без змін.

---

*Джерело: [pythontutorial.net — Python Context Managers](https://www.pythontutorial.net/advanced-python/python-context-managers/). Адаптовано й доповнено для PyJourney.*
