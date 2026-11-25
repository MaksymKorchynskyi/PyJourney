# Обробка винятків

У темі *Exceptions* ви познайомилися з базовим `try...except`. Повна інструкція `try` вміє більше: у ній є блок `else` для коду, який має виконатися лише в разі успіху, і блок `finally` для прибирання, яке має відбутися за будь-яких умов. У цій темі розглянуто всі чотири блоки, як вирішити, що куди помістити, і звички обробки, завдяки яким баги лишаються помітними, а не ховаються.

## Що ви дізнаєтесь

- Чотири блоки інструкції `try` (`try`, `except`, `else`, `finally`), їхній порядок і допустимі комбінації
- Які саме блоки виконуються, коли винятку немає, коли його оброблено і коли ні
- Чому блок `try` має бути коротким і як у цьому допомагає `else`
- Чому повертати `None` у разі невдачі ризиковано і що робити натомість
- Чому `except:` без типу небезпечний і як дізнатися, який виняток зараз обробляється
- Як обробляти кілька винятків одночасно за допомогою груп винятків і `except*` (Python 3.11+)

## Інструкція `try` та її блоки

Ось повна форма інструкції:

```python
try:
    ...  # код, який може згенерувати виняток
except ExceptionType as ex:
    ...  # виконується, якщо блок try згенерував ExceptionType (або його підклас)
else:
    ...  # виконується лише тоді, коли блок try завершився без винятку
finally:
    ...  # виконується завжди й останнім, що б не сталося вище
```

Блоки мають іти **саме в такому порядку**, і в кожного свої правила:

| Блок | Скільки разів | Правила |
|---|---|---|
| `try` | рівно 1 | Містить код, який ви хочете захистити. Робіть його якомога коротшим, часто це одна інструкція. |
| `except` | 0 або більше | Кожна гілка обробляє один тип винятку (або кортеж типів). `as ex` необов'язкове. Розташовуйте гілки від найконкретнішого типу до найзагальнішого. |
| `else` | 0 або 1 | Виконується, лише якщо блок `try` нічого не згенерував. Дозволений тільки тоді, коли є хоча б одна гілка `except`. |
| `finally` | 0 або 1 | Виконується завжди, незалежно від того, чи виник виняток. Має стояти останнім. |

Інструкція `try` потребує щонайменше однієї гілки `except` або блоку `finally`. Отже, допустимі такі комбінації: `try/except`, `try/except/else`, `try/except/finally`, `try/except/else/finally` і `try/finally`.

> **Зверніть увагу:** у деяких посібниках `finally` стоїть перед `else`. Це `SyntaxError`: `else` має йти одразу після останньої гілки `except`, а `finally` завжди завершує інструкцію.

## Які блоки виконуються і коли

Правила найпростіше вивчити, якщо подивитися на них у дії. Кожен блок функції `parse()` виводить рядок:

```python
def parse(text):
    print(f"--- parse({text!r})")
    try:
        number = int(text)
        print("try: converted")
    except ValueError:
        print("except: not a number")
    else:
        print("else: got", number)
    finally:
        print("finally: done")


parse("42")
parse("abc")

try:
    parse(None)
except TypeError as e:
    print("caller caught:", e)
```

Результат:

```text
--- parse('42')
try: converted
else: got 42
finally: done
--- parse('abc')
except: not a number
finally: done
--- parse(None)
finally: done
caller caught: int() argument must be a string, a bytes-like object or a real number, not 'NoneType'
```

Тут видно три сценарії:

| Що сталося в `try` | `except` | `else` | `finally` |
|---|---|---|---|
| винятку немає (`"42"`) | пропускається | виконується | виконується |
| виняток, який перехопила гілка `except` (`"abc"`) | виконується відповідна гілка | пропускається | виконується |
| виняток, який жодна гілка не перехопила (`None` дає `TypeError`) | пропускається | пропускається | виконується, після чого виняток рухається далі |

Третій випадок показує важливу річ: виняток, який функція не обробила, **поширюється** (propagates) до викликача. Python виходить із функції, дорогою виконує `finally` і шукає обробник у коді, що її викликав. Якщо обробника немає ніде в ланцюжку викликів, програма зупиняється з трасуванням.

## Тримайте `try` коротким і використовуйте `else`

Усе всередині `try` «захищене»: виняток із будь-якого його рядка потрапляє до гілок `except`. Якщо помістити туди більше коду, ніж потрібно, обробник може перехопити виняток, для якого його ніколи не писали, і повідомити про хибну проблему:

```python
users = {1: {"name": "Olena"}, 2: {"nickname": "max"}}


def greet(user_id):
    try:
        user = users[user_id]
        print("Hello,", user["name"])
    except KeyError:
        print(f"User {user_id} not found")


greet(1)
greet(3)
greet(2)
```

Результат:

```text
Hello, Olena
User 3 not found
User 2 not found
```

Користувач 2 існує. `KeyError` виник у `user["name"]`, бо в цьому записі немає ключа `"name"`, а обробник писали для відсутнього користувача. Якщо перенести другий рядок у `else`, захищеним лишиться тільки пошук:

```python
users = {1: {"name": "Olena"}, 2: {"nickname": "max"}}


def greet(user_id):
    try:
        user = users[user_id]
    except KeyError:
        print(f"User {user_id} not found")
    else:
        print("Hello,", user["name"])


greet(1)
greet(3)
greet(2)
```

Результат:

```text
Hello, Olena
User 3 not found
Traceback (most recent call last):
  File "app.py", line 15, in <module>
    greet(2)
    ~~~~~^^^
  File "app.py", line 10, in greet
    print("Hello,", user["name"])
                    ~~~~^^^^^^^^
KeyError: 'name'
```

Тепер справжню проблему, зіпсований запис користувача, видно, а не замасковано під «not found». Код у `else` виконується лише після успішного `try`, але його винятки **не** обробляються гілками `except` тієї самої інструкції.

## `finally`: прибирання, яке виконується завжди

Використовуйте `finally` для дій, які мають відбутися незалежно від того, вдалася робота чи ні: закрити файл чи мережеве з'єднання, звільнити блокування (lock), відновити налаштування. Тут другий `write()` падає, помилку ніхто не обробляє, а файл однаково закривається:

```python
f = open("report.txt", "w")
try:
    f.write("total: ")
    f.write(100)
finally:
    f.close()
    print("file closed:", f.closed)
```

Результат:

```text
file closed: True
Traceback (most recent call last):
  File "app.py", line 4, in <module>
    f.write(100)
    ~~~~~~~^^^^^
TypeError: write() argument must be str, not int
```

Спочатку виконався `finally`, а потім `TypeError` рушив далі й зупинив програму. `finally` не обробляє виняток. Він лише гарантує, що його код буде виконано.

`finally` виконується і тоді, коли блок `try` завершується достроково через `return`, `break` чи `continue`:

```python
def fetch():
    try:
        print("fetching")
        return "data"
    finally:
        print("cleanup")


print(fetch())
```

Результат:

```text
fetching
cleanup
data
```

Спершу обчислюється значення для повернення, потім виконується `finally`, і лише після цього функція справді повертає результат.

> **Порада:** для файлів, блокувань і з'єднань інструкція `with` зазвичай краща за написаний вручну `try...finally`. `with open("report.txt", "w") as f:` закриває файл автоматично, навіть якщо виник виняток. Див. розділ про менеджери контексту.

## Повертати `None` чи генерувати виняток

Спокусливий спосіб «обробити» помилку — повернути спеціальне значення. Ця `divide()` повертає `None`, коли `b` дорівнює нулю:

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        return None


result = divide(10, 0)
if result is not None:
    print("result:", result)
else:
    print("Invalid inputs")
```

Результат:

```text
Invalid inputs
```

Тепер кожен викликач мусить не забути перевірити `None`, та ще й перевірити правильно. Хто напише коротше `if result:`, отримає баг, бо цілком коректний результат `0.0` теж хибний (falsy):

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        return None


for a, b in [(10, 0), (0, 10)]:
    result = divide(a, b)
    if result:
        print("result:", result)
    else:
        print("Invalid inputs")
```

Результат:

```text
Invalid inputs
Invalid inputs
```

`divide(0, 10)` — правильне ділення з відповіддю `0.0`, але його визнано некоректним. Краще повідомити про проблему **винятком**. Викликач не зможе випадково його проігнорувати, а звичайне значення, що повертається, завжди буде справжнім числом:

```python
def divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        raise ValueError("The second argument (b) must not be zero")


for a, b in [(10, 0), (0, 10)]:
    try:
        result = divide(a, b)
    except ValueError as e:
        print(e)
    else:
        print("result:", result)
```

Результат:

```text
The second argument (b) must not be zero
result: 0.0
```

Інструкція `raise` створює й генерує новий виняток. Їй присвячено наступну тему, *Raise Exceptions*, а в темі *Raise From* показано, як пов'язати новий `ValueError` з початковим `ZeroDivisionError`.

Часто найпростіше рішення — взагалі не перехоплювати виняток. Якщо `divide()` нічого корисного не може зробити з нульовим дільником, цілком нормально дати `ZeroDivisionError` поширитися далі. Обробляйте виняток там, де справді можете щось із ним зробити.

## Порядок гілок `except`

Як пояснено в темі *Exceptions*, Python виконує **першу** гілку `except`, що підходить, а гілка підходить для вказаного класу й усіх його підкласів. Для `IndexError`, `LookupError` і `Exception` (кожен є підкласом наступного) правильний порядок такий: `IndexError`, потім `LookupError`, потім `Exception`:

```python
colors = ["red", "green", "blue"]

try:
    print(colors[3])
except IndexError as e:
    print(type(e), "Index error")
except LookupError as e:
    print(type(e), "Lookup error")
```

Результат:

```text
<class 'IndexError'> Index error
```

Якщо поміняти гілки місцями, повідомлення стане оманливим. Виняток так само `IndexError`, але гілка `LookupError` перехоплює його першою, і гілка `IndexError` ніколи не виконається:

```python
colors = ["red", "green", "blue"]

try:
    print(colors[3])
except LookupError as e:
    print(type(e), "Lookup error")
except IndexError as e:
    print(type(e), "Index error")
```

Результат:

```text
<class 'IndexError'> Lookup error
```

### Групування винятків

Коли кілька типів винятків обробляються однаково, перелічіть їх в одній гілці як кортеж, замість того щоб повторювати той самий код:

```python
def to_number(value):
    try:
        return float(value)
    except (TypeError, ValueError) as ex:
        print("cannot convert:", ex)


to_number("3.5x")
to_number([1, 2])
```

Результат:

```text
cannot convert: could not convert string to float: '3.5x'
cannot convert: float() argument must be a string or a real number, not 'list'
```

Починаючи з Python 3.14 дужки можна не писати, якщо немає частини `as` (PEP 758):

```python
try:
    float("abc")
except TypeError, ValueError:
    print("cannot convert")
```

Результат:

```text
cannot convert
```

З `as` дужки й далі обов'язкові. У коді, який має працювати на Python 3.13 або старіших версіях, вони потрібні завжди.

## `except:` без типу і перехоплення всього

Гілка `except` без жодного типу винятку — це «порожній» обробник (bare except):

```python
try:
    ...
except:
    ...
```

Він рівнозначний `except BaseException:`, тож перехоплює *все*, включно з `SystemExit` (його генерує `sys.exit()`) і `KeyboardInterrupt` (Ctrl+C). Через це програму може бути неможливо зупинити:

```python
import sys

for attempt in range(3):
    try:
        print("attempt", attempt)
        sys.exit("stop now")
    except:
        print("swallowed:", repr(sys.exception()))

print("still running")
```

Результат:

```text
attempt 0
swallowed: SystemExit('stop now')
attempt 1
swallowed: SystemExit('stop now')
attempt 2
swallowed: SystemExit('stop now')
still running
```

Програма тричі просила завершитися і тричі сама себе проігнорувала. Порожній обробник ще й приховує кожен баг у блоці `try`, від одруківок (`NameError`) до неправильних типів (`TypeError`). Якщо вам справді треба перехопити всі *помилки програми*, наприклад на верхньому рівні довготривалого циклу, який має записати збій у журнал і працювати далі, використовуйте `except Exception:`. Він пропускає `SystemExit` і `KeyboardInterrupt`:

```python
import sys

for attempt in range(3):
    try:
        print("attempt", attempt)
        sys.exit("stop now")
    except Exception:
        print("not reached")

print("still running")
```

Результат:

```text
attempt 0
stop now
```

`sys.exit("stop now")` виводить своє повідомлення в стандартний потік помилок і завершує програму з кодом виходу 1.

> **Порада:** якщо ви не знаєте, які винятки генерує певний код, не вгадуйте за допомогою широкого обробника. Дайте коду впасти, прочитайте трасування, а тоді обробіть саме той виняток, який побачили.

## Як дізнатися, який виняток обробляється

Усередині блоку `except` виняток зазвичай отримують через `as ex`. Коли імені для нього немає (у порожньому обробнику або в допоміжній функції, яку викликають з обробника), модуль `sys` може сказати, який виняток зараз обробляється.

`sys.exc_info()` повертає кортеж із трьох значень:

- `type`: клас винятку, підклас `BaseException`;
- `value`: екземпляр винятку;
- `traceback`: об'єкт трасування зі стеком викликів у точці, де виняток згенеровано.

Починаючи з Python 3.11 є ще `sys.exception()`, яка повертає лише екземпляр. Два інші значення можна отримати з нього як `type(exc)` і `exc.__traceback__`, тому `sys.exception()` — сучасніший вибір.

```python
import sys

try:
    "20" / 2
except:
    print(sys.exc_info())
    exc = sys.exception()
    print(repr(exc))
    print(type(exc).__name__, exc.__traceback__.tb_lineno)
```

Результат (адреса об'єкта трасування щоразу інша):

```text
(<class 'TypeError'>, TypeError("unsupported operand type(s) for /: 'str' and 'int'"), <traceback object at 0x1031d2b40>)
TypeError("unsupported operand type(s) for /: 'str' and 'int'")
TypeError 4
```

З результату видно тип винятку, тож порожній обробник можна замінити конкретним:

```python
try:
    "20" / 2
except TypeError as e:
    print(e)
```

Результат:

```text
unsupported operand type(s) for /: 'str' and 'int'
```

Поза будь-яким блоком `except` функція `sys.exception()` повертає `None`, а `sys.exc_info()` — `(None, None, None)`.

Щоб вивести повне трасування, **не** зупиняючи програму, скористайтеся модулем `traceback`:

```python
import traceback

try:
    "20" / 2
except TypeError:
    traceback.print_exc()

print("program continues")
```

Результат:

```text
Traceback (most recent call last):
  File "app.py", line 4, in <module>
    "20" / 2
    ~~~~~^~~
TypeError: unsupported operand type(s) for /: 'str' and 'int'
program continues
```

`traceback.format_exc()` повертає той самий текст у вигляді рядка. У реальних застосунках `logging.exception("message")` усередині блоку `except` записує в журнал повідомлення разом із трасуванням.

## Групи винятків і `except*` (Python 3.11+)

Іноді кілька незалежних помилок трапляються разом: ви перевіряєте форму й знаходите три некоректні поля або падають кілька конкурентних задач (як у `asyncio.TaskGroup`). У Python 3.11 з'явилися `ExceptionGroup` — виняток, що містить список інших винятків, — і гілка `except*`, яка обробляє частини групи:

```python
def validate(user):
    errors = []
    if not user.get("name"):
        errors.append(ValueError("name is required"))
    if not isinstance(user.get("age"), int):
        errors.append(TypeError("age must be an int"))
    if user.get("email", "").count("@") != 1:
        errors.append(ValueError("email is invalid"))
    if errors:
        raise ExceptionGroup("invalid user", errors)


try:
    validate({"name": "", "age": "42", "email": "max"})
except* ValueError as group:
    for e in group.exceptions:
        print("value problem:", e)
except* TypeError as group:
    for e in group.exceptions:
        print("type problem:", e)
```

Результат:

```text
value problem: name is required
value problem: email is invalid
type problem: age must be an int
```

`except*` працює не так, як `except`:

- Для однієї групи можуть виконатися **кілька** гілок `except*`. Кожна отримує нову `ExceptionGroup`, у якій є лише відповідні винятки, доступні в атрибуті `.exceptions`.
- Винятки, яких не перехопила жодна гілка, після роботи обробників **генеруються знову** у вигляді групи.
- Якщо блок `try` генерує звичайний виняток, `except*` загортає його в групу, тож `group.exceptions` однаково буде кортежем.
- `except` і `except*` не можна змішувати в одній інструкції `try`.

Тут для `KeyError` немає обробника, тому він виходить назовні в новій, меншій групі:

```python
try:
    raise ExceptionGroup("batch failed", [ValueError("bad value"), KeyError("id")])
except* ValueError as group:
    print("handled:", group.exceptions)
```

Результат:

```text
handled: (ValueError('bad value'),)
  + Exception Group Traceback (most recent call last):
  |   File "app.py", line 2, in <module>
  |     raise ExceptionGroup("batch failed", [ValueError("bad value"), KeyError("id")])
  | ExceptionGroup: batch failed (1 sub-exception)
  +-+---------------- 1 ----------------
    | KeyError: 'id'
    +------------------------------------
```

## Типові помилки

- **Забагато коду в `try`.** Обробник, написаний для одного рядка, перехоплює такий самий тип винятку з усіх інших рядків і називає хибну причину. Захищайте лише операцію, яка може впасти, а решту переносьте в `else`.
- **Ставити `else` після `finally`.** Порядок фіксований: `try`, `except`, `else`, `finally`. Будь-який інший — це `SyntaxError`.
- **Використовувати ім'я винятку після блоку `except`.** Python видаляє ім'я з `as`, коли обробник завершується (так розривається цикл посилань між винятком і його трасуванням):

  ```python
  try:
      1 / 0
  except ZeroDivisionError as e:
      pass

  print(e)
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    File "app.py", line 6, in <module>
      print(e)
            ^
  NameError: name 'e' is not defined
  ```

  Якщо виняток знадобиться пізніше, збережіть його під іншим ім'ям усередині обробника: `error = e`.

- **`return` усередині `finally`.** Він підміняє значення з `try` і непомітно відкидає виняток, який саме поширюється. Python 3.14 попереджає про це (PEP 765):

  ```python
  def risky():
      try:
          return 1 / 0
      finally:
          return "finally wins"


  print(risky())
  ```

  Результат:

  ```text
  app.py:5: SyntaxWarning: 'return' in a 'finally' block
    return "finally wins"
  finally wins
  ```

  `ZeroDivisionError` зник без сліду. `break` і `continue` усередині `finally` діють так само й отримують таке саме попередження.

- **`except:` без типу або `except BaseException:`.** Вони перехоплюють `SystemExit` і `KeyboardInterrupt` та приховують усі баги. Використовуйте конкретні типи або `except Exception:` на верхньому рівні.
- **Ковтати помилки через `except: pass`.** Програма працює далі в зламаному стані, і ніхто не знає чому. Принаймні запишіть виняток у журнал.
- **Повертати `None` (або `-1`, або `False`), щоб повідомити про невдачу.** Викликачі забувають перевіряти або перевіряють через `if result:` і плутають коректні хибні (falsy) результати з помилками. Натомість генеруйте виняток.

## Підсумок

- Інструкція `try` має до чотирьох блоків у фіксованому порядку: `try`, `except` (скільки завгодно), `else` і `finally` (щонайбільше по одному). Їй потрібна хоча б одна гілка `except` або блок `finally`, а `else` вимагає наявності `except`.
- `except` виконується, коли виникає відповідний виняток, `else` — коли винятку не було, а `finally` — завжди, навіть після `return`, `break` чи `continue`.
- Необроблений виняток поширюється до викликача, а `finally` виконується дорогою.
- Тримайте `try` коротким. Код, який має виконатися лише в разі успіху, належить до `else`.
- Розташовуйте гілки `except` від конкретних до загальних, а винятки з однаковою обробкою об'єднуйте в кортеж (з Python 3.14 — без дужок, якщо немає `as`).
- Уникайте `except:` без типу. Він рівнозначний `except BaseException:` і перехоплює `SystemExit` та `KeyboardInterrupt`.
- `sys.exception()` (3.11+) і `sys.exc_info()` повертають виняток, що обробляється, а `traceback.print_exc()` виводить його трасування.
- `ExceptionGroup` об'єднує кілька винятків, а `except*` обробляє кожен тип у групі окремо.

## Практика

### Вправа 1: Простежте блоки

Передбачте, що виведе програма, а потім запустіть її, щоб перевірити себе.

```python
def load(key):
    data = {"a": "1", "b": "two"}
    try:
        value = int(data[key])
    except KeyError:
        print(key, "-> missing")
        return "missing"
    else:
        print(key, "-> value", value)
        return value
    finally:
        print(key, "-> finally")


for key in ["a", "c", "b"]:
    try:
        print("returned:", load(key))
    except ValueError as e:
        print("caller:", e)
```

### Вправа 2: Виправте оманливий обробник

Функція нижче має повертати довжину першого слова з `words[index]` або `"no such item"`, якщо такого індексу немає. Викличте її для `["hello world", ""]` з індексами `0`, `5` і `1`: одна з відповідей неправильна. Перепишіть функцію так, щоб захищеним був лише пошук у списку, а для порожнього рядка поверталося `"empty item"`.

```python
def first_word_length(words, index):
    try:
        item = words[index]
        return len(item.split()[0])
    except IndexError:
        return "no such item"
```

### Вправа 3: Цикл, який завжди рахує

Напишіть `process(items)`, яка проходить списком рядків. Кожен елемент вона перетворює на `int` і виводить `100 / number`. Якщо елемент не є числом, виводить `"<item>: not a number"`, а для нуля — `"<item>: zero"`. В обох обробниках помилок використайте `continue`. Рахуйте **кожен** опрацьований елемент, зокрема й невдалі, у блоці `finally`, а наприкінці виведіть лічильник. Перевірте на `["4", "x", "0", "8"]`.

### Вправа 4: Зберіть усі проблеми

Напишіть `check_order(order)` для словника з ключами `"qty"` і `"price"`. Функція збирає проблеми в список і, якщо вони є, генерує `ExceptionGroup("invalid order", problems)`. Відсутній ключ дає `KeyError(key)`. Значення `"qty"`, яке не є додатним `int`, дає `ValueError`. Від'ємне `"price"` теж дає `ValueError`. Обробіть групу двома гілками `except*`: одна виводить `"missing: ..."` для кожного `KeyError`, інша — `"bad value: ..."` для кожного `ValueError`. Перевірте на `{"qty": 0}` і на `{"qty": 2, "price": 9.5}`.

## Розв'язки

### Вправа 1

Результат:

```text
a -> value 1
a -> finally
returned: 1
c -> missing
c -> finally
returned: missing
b -> finally
caller: invalid literal for int() with base 10: 'two'
```

Для `"a"` блок `try` завершується успішно, тож виконується `else` і повертає `1`, а `finally` встигає виконатися до фактичного повернення з функції. Для `"c"` `KeyError` обробляється. Для `"b"` `int("two")` генерує `ValueError`, який `load()` не обробляє: не виконуються ні `except`, ні `else`, виконується `finally`, і виняток поширюється до обробника у викликача.

### Вправа 2

Початкова версія повертає `"no such item"` для індексу `1`: елемент існує, але `"".split()` — порожній список, і `[0]` на ньому генерує `IndexError`, який обробник помилково вважає відсутнім елементом.

```python
def first_word_length(words, index):
    try:
        item = words[index]
    except IndexError:
        return "no such item"
    else:
        parts = item.split()
        if not parts:
            return "empty item"
        return len(parts[0])


words = ["hello world", ""]
for index in [0, 5, 1]:
    print(index, first_word_length(words, index))
```

Результат:

```text
0 5
5 no such item
1 empty item
```

### Вправа 3

```python
def process(items):
    count = 0
    for item in items:
        try:
            number = int(item)
            result = 100 / number
        except ValueError:
            print(f"{item}: not a number")
            continue
        except ZeroDivisionError:
            print(f"{item}: zero")
            continue
        else:
            print(f"{item}: {result}")
        finally:
            count += 1
    print("processed:", count)


process(["4", "x", "0", "8"])
```

Результат:

```text
4: 25.0
x: not a number
0: zero
8: 12.5
processed: 4
```

`continue` завершує поточну ітерацію, але перед цим однаково виконується `finally`, тож невдалі елементи теж враховано.

### Вправа 4

```python
def check_order(order):
    problems = []
    for key in ("qty", "price"):
        if key not in order:
            problems.append(KeyError(key))
    qty = order.get("qty")
    if qty is not None and (not isinstance(qty, int) or qty <= 0):
        problems.append(ValueError(f"qty must be a positive int, got {qty!r}"))
    price = order.get("price")
    if price is not None and price < 0:
        problems.append(ValueError(f"price must not be negative, got {price!r}"))
    if problems:
        raise ExceptionGroup("invalid order", problems)


for order in [{"qty": 0}, {"qty": 2, "price": 9.5}]:
    print("checking", order)
    try:
        check_order(order)
    except* KeyError as group:
        for e in group.exceptions:
            print("  missing:", e)
    except* ValueError as group:
        for e in group.exceptions:
            print("  bad value:", e)
```

Результат:

```text
checking {'qty': 0}
  missing: 'price'
  bad value: qty must be a positive int, got 0
checking {'qty': 2, 'price': 9.5}
```

У першому замовленні дві проблеми різних типів, тому виконуються обидві гілки `except*`. Друге замовлення коректне: `check_order()` нічого не генерує, і жоден обробник не виконується.

---

*Джерело: [pythontutorial.net — Python Exception Handling](https://www.pythontutorial.net/python-oop/python-exception-handling/). Адаптовано й доповнено для PyJourney.*
