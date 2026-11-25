# Винятки

Коли під час роботи програми щось іде не так (індекс виходить за межі списку, ділення на нуль, файл не знайдено), Python **генерує виняток** (raises an exception). Виняток — це звичайний об'єкт, який описує помилку. Якщо його ніхто не обробить, програма зупиниться й виведе трасування (traceback). Якщо обробити, програма зможе відреагувати й працювати далі. У цій темі пояснено, що таке винятки, як організовано їхні класи і як їх перехоплювати.

## Що ви дізнаєтесь

- Що відбувається, коли виняток згенеровано, а обробника для нього немає
- Як читати трасування
- Що винятки — це об'єкти, і яку інформацію вони несуть (`type`, `args`, повідомлення)
- Як вбудовані класи винятків утворюють ієрархію під `BaseException` та `Exception`
- Як `except` перехоплює виняток разом з усіма його підкласами
- Чому винятки варто перехоплювати якомога конкретніше, від конкретних до загальних

## Що відбувається, коли виникає помилка

Цей код звертається до четвертого елемента списку з трьох елементів:

```python
colors = ["red", "green", "blue"]

print(colors[3])
print("This line never runs")
```

Результат:

```text
Traceback (most recent call last):
  File "app.py", line 3, in <module>
    print(colors[3])
          ~~~~~~^^^
IndexError: list index out of range
```

Через неправильний індекс Python **згенерував** `IndexError`. Ніхто його не обробив, тому Python зупинив програму й вивів **трасування**. Другий `print()` так і не виконався.

### Як читати трасування

Трасування читають знизу вгору:

- **Останній рядок** найважливіший: тип винятку (`IndexError`) і його повідомлення (`list index out of range`).
- Над ним розташовані **кадри** (frames): ланцюжок викликів, що привів до помилки, з файлом, номером рядка та функцією (`<module>` означає код верхнього рівня). Найсвіжіший виклик розташований унизу, саме це й означає «most recent call last».
- Починаючи з Python 3.11 позначки `~~~~~~^^^` вказують на конкретну частину рядка, де сталася помилка. А з Python 3.13 трасування ще й розфарбовується, коли виводиться в термінал.

Якщо помилка трапилася всередині функції, ви побачите по одному кадру на кожен виклик:

```python
def division(a, b):
    return a / b


c = division(10, 0)
```

Результат:

```text
Traceback (most recent call last):
  File "app.py", line 5, in <module>
    c = division(10, 0)
  File "app.py", line 2, in division
    return a / b
           ~~^~~
ZeroDivisionError: division by zero
```

Рядок 5 викликав `division()`, а всередині неї впав рядок 2. Нижній кадр показує, де саме згенеровано виняток. Кадри над ним показують, як програма туди потрапила.

## Обробка винятку за допомогою `try...except`

Щоб обробити виняток, помістіть ризикований код у блок `try`, а реакцію на помилку — у блок `except`:

```python
colors = ["red", "green", "blue"]

try:
    print(colors[3])
except IndexError as e:
    print(e)

print("Continue to run")
```

Результат:

```text
list index out of range
Continue to run
```

Python виконує блок `try`. Коли `colors[3]` генерує `IndexError`, решта блоку `try` пропускається, і Python шукає відповідну гілку `except`. `except IndexError as e` підходить, тому об'єкт винятку прив'язується до імені `e`, і виконується обробник. Після цього програма просто працює далі.

> **Зверніть увагу:** у деяких посібниках цей приклад нібито виводить `<class 'IndexError'> - list index out of range`. Насправді `print(e)` виводить лише повідомлення. Щоб побачити клас, виведіть ще й `type(e)`, як у наступному прикладі.

## Винятки — це об'єкти

`e` у `except IndexError as e` — це екземпляр класу `IndexError`, і його можна досліджувати, як будь-який інший об'єкт:

```python
colors = ["red", "green", "blue"]

try:
    print(colors[3])
except IndexError as e:
    print(type(e))
    print(type(e).__name__)
    print(e.args)
    print(str(e))
    print(repr(e))
```

Результат:

```text
<class 'IndexError'>
IndexError
('list index out of range',)
list index out of range
IndexError('list index out of range')
```

- `type(e)` (або `e.__class__`) — клас винятку.
- `e.args` — кортеж аргументів, з якими створено виняток. Зазвичай там лише повідомлення.
- `str(e)` повертає повідомлення, а `repr(e)` показує, як можна відтворити цей об'єкт.

Об'єкти винятків можна створювати самостійно, як і будь-які інші об'єкти. Саме створення не генерує виняток. Це робить інструкція `raise` (див. тему *Raise Exceptions*):

```python
error = ValueError("invalid age", -5)
print(type(error).__name__)
print(error.args)
print(isinstance(error, Exception))
```

Результат:

```text
ValueError
('invalid age', -5)
True
```

## Ієрархія винятків

Усі класи винятків успадковуються від `BaseException`. Майже всі вони, зокрема кожна помилка, яку ви зазвичай обробляєте, успадковуються від його підкласу `Exception`. Ось скорочена схема вбудованої ієрархії:

```text
BaseException
 +-- BaseExceptionGroup
 +-- GeneratorExit
 +-- KeyboardInterrupt
 +-- SystemExit
 +-- Exception
      +-- ArithmeticError
      |    +-- OverflowError
      |    +-- ZeroDivisionError
      +-- AssertionError
      +-- AttributeError
      +-- ExceptionGroup
      +-- ImportError
      |    +-- ModuleNotFoundError
      +-- LookupError
      |    +-- IndexError
      |    +-- KeyError
      +-- NameError
      |    +-- UnboundLocalError
      +-- OSError
      |    +-- FileNotFoundError
      |    +-- PermissionError
      |    +-- TimeoutError
      +-- RuntimeError
      |    +-- NotImplementedError
      |    +-- RecursionError
      +-- StopIteration
      +-- TypeError
      +-- ValueError
           +-- UnicodeError
```

Повне дерево є в документації Python (розділ «Exception hierarchy» на сторінці про вбудовані винятки). Також можна попросити Python показати предків будь-якого класу винятку:

```python
for cls in IndexError.__mro__:
    print(cls.__name__)
```

Результат:

```text
IndexError
LookupError
Exception
BaseException
object
```

### Навіщо окремо `BaseException` і `Exception`

Чотири прямі нащадки `BaseException` (окрім самого `Exception`) не є помилками програми:

- `SystemExit` генерує `sys.exit()`, щоб завершити програму.
- `KeyboardInterrupt` виникає, коли користувач натискає Ctrl+C.
- `GeneratorExit` використовується всередині Python для закриття генераторів.
- `BaseExceptionGroup` — базовий клас груп винятків (див. нижче).

«Обробляти» їх випадково майже ніколи не потрібно. Оскільки вони лежать поза `Exception`, поширений обробник `except Exception:` їх пропускає, тож Ctrl+C і `sys.exit()` працюють як слід:

```python
print(issubclass(KeyboardInterrupt, Exception))
print(issubclass(KeyboardInterrupt, BaseException))
print(issubclass(SystemExit, Exception))
print(issubclass(ExceptionGroup, Exception))
```

Результат:

```text
False
True
False
True
```

`ExceptionGroup` (Python 3.11+) об'єднує кілька винятків в один, наприклад коли одночасно падають кілька конкурентних задач. Для нього є спеціальний синтаксис `except*`, про який ідеться в наступній темі, *Exception Handling*.

### Поширені вбудовані винятки

| Виняток | Типова причина |
|---|---|
| `ValueError` | тип правильний, значення ні: `int("abc")` |
| `TypeError` | неправильний тип: `"10" / 2`, виклик функції з неправильними аргументами |
| `IndexError` | індекс послідовності поза межами: `[1, 2][5]` |
| `KeyError` | у словнику немає ключа: `{}["x"]` |
| `ZeroDivisionError` | ділення або остача від ділення на нуль |
| `AttributeError` | немає атрибута чи методу: `None.upper()` |
| `NameError` | використання імені, яке не визначено |
| `FileNotFoundError` | відкриття файлу, якого не існує |
| `ModuleNotFoundError` | імпорт модуля, який не встановлено |

## Перехоплення цілої родини винятків

Гілка `except` перехоплює вказаний клас **і всі його підкласи**. `IndexError` — підклас `LookupError`, а той — підклас `Exception`, тому всі три обробники нижче його перехоплять:

```python
colors = ["red", "green", "blue"]

try:
    print(colors[3])
except LookupError as e:
    print(e.__class__, "-", e)

try:
    print(colors[3])
except Exception as e:
    print(e.__class__, "-", e)

print("Continue to run")
```

Результат:

```text
<class 'IndexError'> - list index out of range
<class 'IndexError'> - list index out of range
Continue to run
```

Виняток і далі залишається `IndexError`. Перехоплювати `LookupError` зручно, коли відсутній індекс і відсутній ключ словника (`KeyError`) треба обробити однаково.

## Перехоплюйте якомога конкретніше

Функція, що ділить два числа, падає, коли `b` дорівнює нулю:

```python
def division(a, b):
    try:
        return {"success": True, "message": "OK", "result": a / b}
    except ZeroDivisionError:
        return {"success": False, "message": "b cannot be zero", "result": None}


print(division(10, 2))
print(division(10, 0))
```

Результат:

```text
{'success': True, 'message': 'OK', 'result': 5.0}
{'success': False, 'message': 'b cannot be zero', 'result': None}
```

В обох випадках функція повертає словник: `success` показує, чи вдалося ділення, `message` пояснює результат, а `result` містить частку або `None`. (У наступних темах ви побачите, чому згенерувати виняток часто краще, ніж повертати такий словник.)

Тепер припустімо, що хтось «спростив» обробник до `except Exception`:

```python
def division(a, b):
    try:
        return {"success": True, "message": "OK", "result": a / b}
    except Exception:
        return {"success": False, "message": "b cannot be zero", "result": None}


print(division(10, 0))
print(division("10", "2"))
```

Результат:

```text
{'success': False, 'message': 'b cannot be zero', 'result': None}
{'success': False, 'message': 'b cannot be zero', 'result': None}
```

Другий виклик упав із `TypeError` (рядки не можна ділити), але широкий обробник перехопив його й повідомив **хибну причину**. Широкі обробники приховують баги. Правильно обробляти кожен очікуваний виняток окремо, **від найконкретнішого до найзагальнішого**:

```python
def division(a, b):
    try:
        return {"success": True, "message": "OK", "result": a / b}
    except TypeError:
        return {"success": False, "message": "Both a & b must be numbers", "result": None}
    except ZeroDivisionError:
        return {"success": False, "message": "b cannot be zero", "result": None}
    except Exception as e:
        return {"success": False, "message": str(e), "result": None}


print(division(10, 4))
print(division("10", "2"))
print(division(10, 0))
```

Результат:

```text
{'success': True, 'message': 'OK', 'result': 2.5}
{'success': False, 'message': 'Both a & b must be numbers', 'result': None}
{'success': False, 'message': 'b cannot be zero', 'result': None}
```

Python перевіряє гілки `except` згори донизу й виконує **першу**, що підходить. Тому загальна гілка на кшталт `except Exception` має стояти останньою, інакше вона перехопить усе раніше, ніж до справи дійдуть конкретні гілки.

Якщо кілька винятків потребують однакової реакції, перелічіть їх в одній гілці як кортеж:

```python
def division(a, b):
    try:
        return {"success": True, "message": "OK", "result": a / b}
    except (TypeError, ZeroDivisionError) as e:
        return {"success": False, "message": str(e), "result": None}


print(division(10, 0))
print(division("10", "2"))
```

Результат:

```text
{'success': False, 'message': 'division by zero', 'result': None}
{'success': False, 'message': "unsupported operand type(s) for /: 'str' and 'str'", 'result': None}
```

> **Зверніть увагу:** в оригінальному посібнику написано `except (TypeError, ZeroDivisionError, Exception)`. Якщо додати `Exception` у кортеж, інші два елементи втрачають сенс, бо `Exception` і так перехоплює обидва. До того ж повертається проблема «приховуємо будь-який баг».

## Два стилі: LBYL та EAFP

Ситуацію, яка може закінчитися помилкою, можна обробити двома способами:

```python
prices = {"apple": 1.2, "pear": 0.9}

# LBYL: «look before you leap», тобто «подивись, перш ніж стрибати»
if "plum" in prices:
    print(prices["plum"])
else:
    print("no price for plum")

# EAFP: «easier to ask forgiveness than permission», тобто «легше попросити вибачення, ніж дозволу»
try:
    print(prices["plum"])
except KeyError:
    print("no price for plum")
```

Результат:

```text
no price for plum
no price for plum
```

У Python частіше віддають перевагу EAFP: просто виконайте операцію й обробіть виняток. Так не доводиться перевіряти двічі, і це єдиний надійний варіант, коли ситуація може змінитися між перевіркою та дією (наприклад, інша програма видалила файл одразу після того, як ви перевірили, що він існує). Для простих випадків, як цей, ще коротше написати `prices.get("plum")`.

## Типові помилки

- **Перехоплювати `Exception` (або взагалі все), коли очікуєте одну конкретну помилку.** Так непомітно ковтаються сторонні баги, як-от `TypeError` вище, про який повідомлено як про «b cannot be zero».
- **Ставити загальний `except` перед конкретним.** Конкретна гілка стає недосяжною, бо Python виконує першу гілку, що підходить.
- **Перехоплювати `BaseException` або писати порожній `except:`.** Так перехоплюються й `KeyboardInterrupt` та `SystemExit`, тож програма може ігнорувати Ctrl+C або відмовлятися завершуватися.
- **Читати трасування згори.** Починайте з останнього рядка: там назва винятку й повідомлення. Кадри над ним показують, як ви туди потрапили.
- **Виводити лише `e` і губити тип.** `print(e)` показує тільки повідомлення. Коли записуєте помилку в журнал, додавайте й `type(e).__name__` або використовуйте `repr(e)`.

## Підсумок

- Виняток — це об'єкт, який описує помилку. Якщо виняток згенеровано і не оброблено, програма зупиняється й виводить трасування.
- Трасування читають знизу: спочатку тип винятку й повідомлення, потім ланцюжок викликів, що до нього привів.
- `try...except` обробляє виняток, і програма продовжує роботу після інструкції `try`.
- Кожен клас винятку успадковується від `BaseException`. Помилки програми успадковуються від `Exception`, а `SystemExit`, `KeyboardInterrupt` і `GeneratorExit` — ні.
- Гілка `except` перехоплює вказаний клас і всі його підкласи.
- Перехоплюйте винятки якомога конкретніше, розташовуйте гілки `except` від конкретних до загальних, а винятки з однаковою обробкою об'єднуйте в кортеж.

## Практика

### Вправа 1: Який обробник спрацює?

Передбачте результат, а потім запустіть код, щоб перевірити себе.

```python
def check(value):
    data = {"a": 1}
    try:
        if value == 1:
            return data["b"]
        if value == 2:
            return int("x")
        return 10 / 0
    except LookupError:
        return "lookup problem"
    except ArithmeticError:
        return "math problem"
    except Exception as e:
        return f"other problem: {type(e).__name__}"


for v in (1, 2, 3):
    print(v, check(v))
```

### Вправа 2: Безпечне перетворення

Напишіть функцію `safe_int(text, default=0)`, яка перетворює `text` на `int` і повертає `default`, якщо перетворення не вдалося. Вона має впоратися і з неправильними рядками (як-от `"abc"` чи `"4.5"`), і з `None`. Перехоплюйте лише ті винятки, які справді можуть виникнути.

### Вправа 3: Де його місце?

Напишіть функцію `exception_path(exc)`, яка приймає клас винятку **або** екземпляр винятку й повертає його предків у вигляді рядка, зупиняючись на `BaseException`. Наприклад, `exception_path(KeyError)` повертає `"KeyError -> LookupError -> Exception -> BaseException"`. Перевірте її на `ModuleNotFoundError`, `KeyboardInterrupt` і на винятку, який виникає під час відкриття неіснуючого файлу.

### Вправа 4: Середнє значення з повідомленням про помилку

У стилі функції `division()` напишіть `average(values)`, яка повертає словник із ключами `success`, `message` і `result`. Для порожнього списку повідомляйте `"no values"`, а якщо в списку є щось, що не є числом, — `"all values must be numbers"`.

## Розв'язки

### Вправа 1

Результат:

```text
1 lookup problem
2 other problem: ValueError
3 math problem
```

`data["b"]` генерує `KeyError`, підклас `LookupError`. `int("x")` генерує `ValueError`, який не підходить під жодну з перших двох гілок і потрапляє в `Exception`. `10 / 0` генерує `ZeroDivisionError`, підклас `ArithmeticError`.

### Вправа 2

```python
def safe_int(text, default=0):
    try:
        return int(text)
    except (ValueError, TypeError):
        return default


for value in ["42", " 7 ", "4.5", "abc", None]:
    print(repr(value), "->", safe_int(value))
print(safe_int("oops", default=-1))
```

Результат:

```text
'42' -> 42
' 7 ' -> 7
'4.5' -> 0
'abc' -> 0
None -> 0
-1
```

`int()` генерує `ValueError` для рядків, які не є цілими числами (пробіли навколо числа він пропускає), і `TypeError` для `None`.

### Вправа 3

```python
def exception_path(exc):
    cls = exc if isinstance(exc, type) else type(exc)
    names = []
    for klass in cls.__mro__:
        names.append(klass.__name__)
        if klass is BaseException:
            break
    return " -> ".join(names)


print(exception_path(KeyError))
print(exception_path(ModuleNotFoundError))
print(exception_path(KeyboardInterrupt))

try:
    open("missing.txt")
except OSError as error:
    print(exception_path(error))
```

Результат:

```text
KeyError -> LookupError -> Exception -> BaseException
ModuleNotFoundError -> ImportError -> Exception -> BaseException
KeyboardInterrupt -> BaseException
FileNotFoundError -> OSError -> Exception -> BaseException
```

`isinstance(exc, type)` дає змогу відрізнити клас від екземпляра. Зверніть увагу, що `except OSError` перехопив `FileNotFoundError`, тобто підклас.

### Вправа 4

```python
def average(values):
    try:
        result = sum(values) / len(values)
    except ZeroDivisionError:
        return {"success": False, "message": "no values", "result": None}
    except TypeError:
        return {"success": False, "message": "all values must be numbers", "result": None}
    return {"success": True, "message": "OK", "result": result}


print(average([4, 5, 9]))
print(average([]))
print(average([1, "2", 3]))
```

Результат:

```text
{'success': True, 'message': 'OK', 'result': 6.0}
{'success': False, 'message': 'no values', 'result': None}
{'success': False, 'message': 'all values must be numbers', 'result': None}
```

Для порожнього списку `sum()` повертає `0`, і `len()` повертає `0`, тож ділення генерує `ZeroDivisionError`. Додавання рядка до числа всередині `sum()` генерує `TypeError`.

---

*Джерело: [pythontutorial.net — Python Exceptions](https://www.pythontutorial.net/python-oop/python-exceptions/). Адаптовано й доповнено для PyJourney.*
