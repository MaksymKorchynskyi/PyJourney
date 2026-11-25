# Генерування винятків

Досі винятки в цьому розділі походили від самого Python: неправильний індекс, ділення на нуль. Ваш власний код може повідомляти про проблеми так само, за допомогою інструкції `raise`. Згенерувати виняток — це спосіб функції сказати «я не можу виконати те, що ви просите», а викликач вирішує, чи обробляти його і як саме.

## Що ви дізнаєтесь

- Як згенерувати виняток за допомогою `raise` і що взагалі можна генерувати
- Як аргументи винятку потрапляють в `args` і в повідомлення
- Який вбудований тип винятку підходить для типових проблем
- Як повторно згенерувати поточний виняток «голим» `raise`, наприклад після запису в журнал
- Що відбувається, коли новий виняток генерується під час обробки іншого
- Як додати до винятку додатковий контекст за допомогою `add_note()` (Python 3.11+)

## Інструкція `raise`

Щоб згенерувати виняток, напишіть `raise`, а після нього об'єкт винятку:

```python
def set_age(age):
    if age < 0:
        raise ValueError(f"age must not be negative, got {age}")
    print("age set to", age)


set_age(30)
set_age(-5)
print("not reached")
```

Результат:

```text
age set to 30
Traceback (most recent call last):
  File "app.py", line 8, in <module>
    set_age(-5)
    ~~~~~~~^^^^
  File "app.py", line 3, in set_age
    raise ValueError(f"age must not be negative, got {age}")
ValueError: age must not be negative, got -5
```

`raise` негайно зупиняє функцію, трохи схоже на `return`, але замість того щоб повернути значення, запускає виняток. Виняток рухається вгору стеком викликів, доки його не обробить якийсь `try...except` (див. тему *Exception Handling*). Тут його ніхто не обробив, тому програма зупинилася, і `print("not reached")` так і не виконався.

### Що можна генерувати

Об'єкт після `raise` має бути екземпляром `BaseException` або одного з його підкласів. На практиці це майже завжди підклас `Exception`, прямий чи опосередкований: `FileNotFoundError` успадковується від `OSError`, а той — від `Exception`, і його так само можна згенерувати. Можна написати й саме ім'я класу. `raise ValueError` — це скорочення для `raise ValueError()`: Python сам створить екземпляр без аргументів. Будь-що інше саме по собі є помилкою:

```python
for thing in [ValueError("bad value"), ValueError, "just a string"]:
    try:
        raise thing
    except Exception as e:
        print(type(e).__name__, "-", repr(e))
```

Результат:

```text
ValueError - ValueError('bad value')
ValueError - ValueError()
TypeError - TypeError('exceptions must derive from BaseException')
```

Спроба згенерувати рядок завершується `TypeError`. (Дуже старий код на Python 2 генерував рядки. У Python 3 це заборонено.) Як визначати власні класи винятків, показано в темі *Custom Exceptions*.

## Аргументи винятку

`BaseException.__init__()` приймає будь-яку кількість позиційних аргументів (`*args`). Вони зберігаються у вигляді кортежу в атрибуті `args`:

```python
try:
    raise ValueError("The value error exception", "x", "y")
except ValueError as ex:
    print(ex.args)
    print(str(ex))
```

Результат:

```text
('The value error exception', 'x', 'y')
('The value error exception', 'x', 'y')
```

Повідомлення, яке ви бачите в трасуванні, тобто `str(ex)`, залежить від кількості аргументів:

```python
for exc in [ValueError(), ValueError("bad value"), ValueError("bad value", 42)]:
    print(repr(str(exc)))
```

Результат:

```text
''
'bad value'
"('bad value', 42)"
```

З одним аргументом повідомлення — це сам аргумент, і саме цього зазвичай і хочеться. З кількома аргументами повідомленням стає весь кортеж, а таке читається погано. Тож передавайте **одне зрозуміле повідомлення** і вставляйте в нього потрібні дані через f-рядок. Якщо викликачам потрібні дані як окремі значення (назва поля, межа, код помилки), дайте винятку повноцінні атрибути, як показано в *Custom Exceptions*.

## Вибір типу винятку

Перш ніж вигадувати щось своє, перевірте, чи не описує проблему вже якийсь вбудований виняток. Тоді викликачі оброблятимуть його звичними гілками `except`.

| Ситуація | Який виняток генерувати |
|---|---|
| Аргумент має правильний тип, але неприйнятне значення | `ValueError` |
| Аргумент має неправильний тип | `TypeError` |
| Ключ або індекс не знайдено у вашому об'єкті-контейнері | `KeyError` або `IndexError` |
| Запитаного атрибута не існує (у `__getattr__`) | `AttributeError` |
| Метод має реалізувати підклас | `NotImplementedError` |
| Об'єкт перебуває в неправильному стані для цієї операції | `RuntimeError`, а краще власний виняток |

Функція, яка перевіряє і тип, і значення аргументу:

```python
def repeat(text, times):
    if not isinstance(times, int):
        raise TypeError(f"times must be an int, not {type(times).__name__}")
    if times < 0:
        raise ValueError(f"times must be >= 0, got {times}")
    return text * times


print(repeat("ab", 3))
for bad in [2.5, -1]:
    try:
        repeat("ab", bad)
    except (TypeError, ValueError) as e:
        print(type(e).__name__, "-", e)
```

Результат:

```text
ababab
TypeError - times must be an int, not float
ValueError - times must be >= 0, got -1
```

Добре повідомлення каже, що очікувалося і що отримано насправді. Помилку «times must be >= 0, got -1» можна виправити, навіть не відкриваючи вихідний код, а «invalid input» — ні.

> **Порада:** перевіряйте аргументи на початку функції й генеруйте винятки якомога раніше («захисні умови», guard clauses). Тоді решта функції може вважати дані коректними, а трасування вказує прямо на виклик із поганим аргументом.

## Повторне генерування поточного винятку

Іноді треба відреагувати на виняток, не обробляючи його по-справжньому: записати в журнал, відкотити напівзроблену зміну, а потім дати йому піти далі до викликача. Саме це робить «голий» `raise` (без аргументів) усередині блоку `except`. Він повторно генерує виняток, який зараз обробляється:

```python
def division(a, b):
    try:
        return a / b
    except ZeroDivisionError as ex:
        print("Logging exception:", ex)
        raise


division(1, 0)
```

Результат:

```text
Logging exception: division by zero
Traceback (most recent call last):
  File "app.py", line 9, in <module>
    division(1, 0)
    ~~~~~~~~^^^^^^
  File "app.py", line 3, in division
    return a / b
           ~~^~~
ZeroDivisionError: division by zero
```

Видно і запис у журнал, і початковий виняток з початковим трасуванням, яке вказує на `return a / b`, тобто на рядок, де виникла проблема.

«Голим» `raise` також зручно обробляти *частину* випадків, а решту передавати далі:

```python
def parse_port(text):
    try:
        return int(text)
    except ValueError:
        if text.strip() == "":
            return 8080
        raise


print(parse_port("5000"))
print(parse_port("  "))
print(parse_port("http"))
```

Результат:

```text
5000
8080
Traceback (most recent call last):
  File "app.py", line 12, in <module>
    print(parse_port("http"))
          ~~~~~~~~~~^^^^^^^^
  File "app.py", line 3, in parse_port
    return int(text)
ValueError: invalid literal for int() with base 10: 'http'
```

Для порожнього рядка є розумне значення за замовчуванням, тож цей випадок оброблено. Будь-який інший некоректний текст — справжня помилка, і вона повертається до викликача без змін.

### `raise` чи `raise ex`

`raise ex` теж повторно генерує той самий об'єкт винятку, але додає до трасування ще й сам рядок `raise ex`:

```python
def division(a, b):
    try:
        return a / b
    except ZeroDivisionError as ex:
        print("Logging exception:", ex)
        raise ex


division(1, 0)
```

Результат:

```text
Logging exception: division by zero
Traceback (most recent call last):
  File "app.py", line 9, in <module>
    division(1, 0)
    ~~~~~~~~^^^^^^
  File "app.py", line 6, in division
    raise ex
  File "app.py", line 3, in division
    return a / b
           ~~^~~
ZeroDivisionError: division by zero
```

Інформація нікуди не зникла, але трасування стало захаращенішим, до того ж винятку потрібне ім'я. Для повторного генерування віддавайте перевагу «голому» `raise`. «Голий» `raise`, коли жоден виняток не обробляється, — це помилка: `RuntimeError: No active exception to reraise`.

## Генерування іншого винятку під час обробки

Часто низькорівневий виняток варто перетворити на інший, змістовніший для викликача. Тут `ZeroDivisionError` перетворюється на `ValueError`:

```python
def division(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        raise ValueError("b must not be zero")


division(1, 0)
```

Результат:

```text
Traceback (most recent call last):
  File "app.py", line 3, in division
    return a / b
           ~~^~~
ZeroDivisionError: division by zero

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "app.py", line 8, in <module>
    division(1, 0)
    ~~~~~~~~^^^^^^
  File "app.py", line 5, in division
    raise ValueError("b must not be zero")
ValueError: b must not be zero
```

Python виводить **два** трасування. Спершу `ZeroDivisionError`, який обробляли, а потім `ValueError`, згенерований в обробнику. Python запам'ятовує початковий виняток автоматично: щоразу, коли виняток генерується всередині блоку `except` (або `finally`), виняток, що обробляється, зберігається в атрибуті `__context__` нового винятку. Це називається **неявним ланцюжком винятків** (implicit exception chaining):

```python
def division(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        raise ValueError("b must not be zero")


try:
    division(1, 0)
except ValueError as e:
    print(repr(e))
    print(repr(e.__context__))
```

Результат:

```text
ValueError('b must not be zero')
ZeroDivisionError('division by zero')
```

Неявний ланцюжок особливо корисний, коли другий виняток — це **випадковість**, баг у самому обробнику. Тоді трасування показує і початкову проблему, і баг:

```python
default_config = {"debug": False}

try:
    config = open("settings.ini").read()
except FileNotFoundError:
    config = defualt_config
```

Результат:

```text
Traceback (most recent call last):
  File "app.py", line 4, in <module>
    config = open("settings.ini").read()
             ~~~~^^^^^^^^^^^^^^^^
FileNotFoundError: [Errno 2] No such file or directory: 'settings.ini'

During handling of the above exception, another exception occurred:

Traceback (most recent call last):
  File "app.py", line 6, in <module>
    config = defualt_config
             ^^^^^^^^^^^^^^
NameError: name 'defualt_config' is not defined. Did you mean: 'default_config'?
```

Формулювання «During handling of the above exception, another exception occurred» («під час обробки винятку вище виник інший виняток») пасує до такої випадковості, як ця одруківка. А от у прикладі з `division()` `ValueError` був навмисним, і повідомлення змушує його виглядати як баг. Наступна тема, *Raise From*, показує, як сказати «цей виняток **спричинено** тим» за допомогою `raise ... from ...`.

## Додавання контексту через `add_note()` (Python 3.11+)

Буває, що тип і повідомлення винятку правильні, але тому, хто читатиме трасування, знадобився б додатковий контекст: який файл, який рядок вхідних даних, який користувач. Починаючи з Python 3.11 кожен виняток має метод `add_note()`. Примітки зберігаються у списку `__notes__` і виводяться під повідомленням:

```python
def load_settings(lines):
    settings = {}
    for number, line in enumerate(lines, start=1):
        try:
            key, value = line.split("=")
        except ValueError as e:
            e.add_note(f"while parsing line {number}: {line!r}")
            raise
        settings[key.strip()] = value.strip()
    return settings


print(load_settings(["host = localhost", "port = 8080"]))
load_settings(["host = localhost", "port 8080"])
```

Результат:

```text
{'host': 'localhost', 'port': '8080'}
Traceback (most recent call last):
  File "app.py", line 14, in <module>
    load_settings(["host = localhost", "port 8080"])
    ~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  File "app.py", line 5, in load_settings
    key, value = line.split("=")
    ^^^^^^^^^^
ValueError: not enough values to unpack (expected 2, got 1)
while parsing line 2: 'port 8080'
```

Викликач і далі отримує початковий `ValueError`, тож наявні `except ValueError` працюють як раніше, а трасування тепер точно вказує, який рядок вхідних даних зіпсований.

## Типові помилки

- **`raise NotImplemented` замість `raise NotImplementedError`.** `NotImplemented` — це спеціальне значення, яке повертають методи операторів на кшталт `__eq__`, а не виняток. Спроба його згенерувати завершується `TypeError: exceptions must derive from BaseException`.
- **Генерувати звичайний `Exception`.** `raise Exception("bad age")` змушує викликачів писати `except Exception`, а такий обробник перехоплює й усі сторонні баги. Генеруйте найконкретніший тип, який підходить, вбудований чи власний.
- **Розмиті повідомлення.** `raise ValueError("invalid")` нічого не каже. Пишіть, що очікувалося і що отримано.
- **Кілька аргументів замість одного повідомлення.** `ValueError("bad value", 42)` виводиться як `('bad value', 42)`. Краще сформувати один рядок.
- **Перевіряти вхідні дані через `assert`.** Коли Python запускають з опцією `-O`, твердження (assertions) вилучаються, і перевірка тихо зникає:

  ```python
  def set_age(age):
      assert age >= 0, "age must not be negative"
      print("age set to", age)


  set_age(-5)
  ```

  ```bash
  python3 -O app.py
  ```

  Результат:

  ```text
  age set to -5
  ```

  Використовуйте `assert` для внутрішніх перевірок під час розробки, а `if ...: raise ValueError(...)` — для перевірки даних, що надходять ззовні.

- **`raise ex` замість `raise`.** Це працює, але засмічує трасування. «Голий» `raise` чисто повторно генерує поточний виняток.
- **Перетворювати один виняток на інший без `from`.** Тоді трасування стверджує, що новий виняток виник «під час обробки» старого, ніби випадково. Використовуйте `raise NewError(...) from ex` (див. *Raise From*).

## Підсумок

- `raise SomeError("message")` генерує виняток. Функція зупиняється, а виняток поширюється до викликачів, доки його не оброблять.
- Генерувати можна лише екземпляри або підкласи `BaseException`, на практиці — `Exception`. `raise ValueError` — це скорочення для `raise ValueError()`.
- Аргументи винятку зберігаються в `args`. З одним аргументом `str(e)` — це сам аргумент, тож передавайте одне зрозуміле повідомлення.
- Віддавайте перевагу відповідному вбудованому типу, як-от `ValueError` чи `TypeError`, і пишіть повідомлення, які називають очікуване та фактичне значення.
- «Голий» `raise` усередині `except` повторно генерує поточний виняток із початковим трасуванням. Він стає в пригоді, щоб записати помилку в журнал і передати далі або щоб обробити лише частину випадків.
- Новий виняток, згенерований в обробнику, неявно утворює ланцюжок зі старим: старий зберігається в `__context__`, а трасування пише «During handling of the above exception...».
- `add_note()` (3.11+) додає до винятку контекст, не змінюючи його типу.

## Практика

### Вправа 1: Перевірка зняття коштів

Напишіть `withdraw(balance, amount)`, яка повертає новий баланс. Генеруйте `TypeError`, якщо `amount` не є `int` чи `float`; `ValueError`, якщо `amount` не додатне; і `ValueError` з повідомленням на зразок `"insufficient funds: balance 100, requested 150"`, якщо `amount` більше за `balance`. Перевірте функцію на значеннях `50`, `"50"`, `-10` і `150` при балансі `100`, виводячи тип винятку й повідомлення для кожної невдачі.

### Вправа 2: Передбачте повідомлення

Передбачте, що виведе цей код, а потім запустіть його. Один із чотирьох рядків, найімовірніше, вас здивує.

```python
for exc in [KeyError("id"), ValueError(), ValueError("a", "b"), OSError(2, "No such file")]:
    print(type(exc).__name__, exc.args, repr(str(exc)))
```

### Вправа 3: Повторити, а потім здатися

Напишіть `retry(func, attempts)`, яка викликає `func()` і повертає її результат. Якщо виклик генерує `ConnectionError`, виведіть `"attempt N failed: <message>"` і спробуйте ще раз. Коли невдалою виявиться остання спроба, повторно згенеруйте цей останній виняток без змін. Винятки інших типів не повторюйте взагалі. Перевірте на функції, яка двічі падає, а потім спрацьовує, і на функції, яка падає завжди.

### Вправа 4: Вкажіть на поганий рядок

Напишіть `parse_people(rows)`, яка перетворює рядки на кшталт `"Olena,34"` на кортежі `("Olena", 34)`. Якщо рядок не вдається розібрати, додайте до винятку примітку `"row N: <row>"` і повторно згенеруйте його. Перевірте на `["Olena,34", "Max,abc"]` у блоці `try`, який виводить тип винятку, повідомлення та `e.__notes__`.

## Розв'язки

### Вправа 1

```python
def withdraw(balance, amount):
    if not isinstance(amount, (int, float)):
        raise TypeError(f"amount must be a number, not {type(amount).__name__}")
    if amount <= 0:
        raise ValueError(f"amount must be positive, got {amount}")
    if amount > balance:
        raise ValueError(f"insufficient funds: balance {balance}, requested {amount}")
    return balance - amount


for amount in [50, "50", -10, 150]:
    try:
        print("new balance:", withdraw(100, amount))
    except (TypeError, ValueError) as e:
        print(f"{type(e).__name__}: {e}")
```

Результат:

```text
new balance: 50
TypeError: amount must be a number, not str
ValueError: amount must be positive, got -10
ValueError: insufficient funds: balance 100, requested 150
```

Перевірка типу йде першою: порівняння `"50" <= 0` саме по собі згенерувало б `TypeError` із набагато менш корисним повідомленням.

### Вправа 2

Результат:

```text
KeyError ('id',) "'id'"
ValueError () ''
ValueError ('a', 'b') "('a', 'b')"
FileNotFoundError (2, 'No such file') '[Errno 2] No such file'
```

- `KeyError` показує свій ключ у лапках (`'id'`), бо його `str()` використовує `repr()` ключа. Так навіть порожній рядок у ролі ключа помітний у трасуванні.
- `ValueError()` не має аргументів, тож його повідомлення порожнє.
- З двома аргументами повідомленням стає кортеж.
- `OSError(2, ...)` перетворився на `FileNotFoundError`: `OSError` дивиться на номер помилки (`2` — це `ENOENT`, «no such file or directory») і створює відповідний підклас. Його повідомлення має вигляд `[Errno N] text`.

### Вправа 3

```python
def retry(func, attempts):
    for attempt in range(1, attempts + 1):
        try:
            return func()
        except ConnectionError as e:
            print(f"attempt {attempt} failed: {e}")
            if attempt == attempts:
                raise


def make_flaky(failures):
    calls = 0

    def fetch():
        nonlocal calls
        calls += 1
        if calls <= failures:
            raise ConnectionError(f"timeout #{calls}")
        return "payload"

    return fetch


print(retry(make_flaky(2), attempts=3))

try:
    retry(make_flaky(5), attempts=3)
except ConnectionError as e:
    print("gave up:", repr(e))
```

Результат:

```text
attempt 1 failed: timeout #1
attempt 2 failed: timeout #2
payload
attempt 1 failed: timeout #1
attempt 2 failed: timeout #2
attempt 3 failed: timeout #3
gave up: ConnectionError('timeout #3')
```

«Голий» `raise` повторно генерує саме третій `ConnectionError`, тож викликач бачить справжню останню невдачу. `ValueError` із `func()` гілка `except ConnectionError` не перехоплює, і він одразу, з першої ж спроби, іде до викликача.

### Вправа 4

```python
def parse_people(rows):
    people = []
    for number, row in enumerate(rows, start=1):
        try:
            name, age = row.split(",")
            people.append((name, int(age)))
        except ValueError as e:
            e.add_note(f"row {number}: {row}")
            raise
    return people


print(parse_people(["Olena,34", "Max,28"]))

try:
    parse_people(["Olena,34", "Max,abc"])
except ValueError as e:
    print(type(e).__name__, "-", e)
    print(e.__notes__)
```

Результат:

```text
[('Olena', 34), ('Max', 28)]
ValueError - invalid literal for int() with base 10: 'abc'
['row 2: Max,abc']
```

Обидві можливі невдачі, рядок без коми (розпакування) і нечисловий вік (`int()`), генерують `ValueError`, тож їх покриває один обробник. Примітка не змінює `str(e)`. Її видно в трасуванні, і вона зберігається в `e.__notes__`.

---

*Джерело: [pythontutorial.net — Python Raise Exceptions](https://www.pythontutorial.net/python-oop/python-raise-exception/). Адаптовано й доповнено для PyJourney.*
