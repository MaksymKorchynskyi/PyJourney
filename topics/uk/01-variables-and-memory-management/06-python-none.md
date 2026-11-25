# Значення None

`None` — це спосіб Python сказати «тут немає значення». Функції повертають його, коли їм нічого повернути, змінні містять його, доки не отримають справжнє значення, а необов'язкові параметри використовують його як безпечне значення за замовчуванням. Здається, що тут усе просто, але правильне використання (і правильне порівняння) `None` запобігає цілій родині помилок.

## Що ви дізнаєтесь

- Що таке `None`: єдиний екземпляр `NoneType`
- Чому порівнювати слід через `is None` / `is not None`, а не через `==`
- Чим `None` відрізняється від `0`, `False` і порожніх значень, хоча він теж хибний
- Як використовувати `None` як початкове значення, значення параметра за замовчуванням і позначку «результату немає»
- Як `None` розв'язує проблему змінюваного аргументу за замовчуванням
- Типові помилки, до яких призводить `None`, як-от `'NoneType' object has no attribute ...`

## `None` і `NoneType`

`None` — вбудована константа і ключове слово. Його тип — `NoneType`:

```python
import types

print(type(None))
print(None == None)
print(None is None)
print(type(None)() is None)
print(types.NoneType is type(None))
```

Результат:

```text
<class 'NoneType'>
True
True
True
True
```

`None` — **синглтон**: у запущеному інтерпретаторі існує рівно один об'єкт `None`. Навіть виклик `NoneType()` не створює новий об'єкт, а повертає той самий `None`. Починаючи з Python 3.10 цей тип доступний як `types.NoneType`, що зручно для перевірок через `isinstance()`.

Оскільки `None` — ключове слово, перев'язати його неможливо:

```python
None = 1
```

Результат:

```text
  File ".../example.py", line 1
    None = 1
    ^^^^
SyntaxError: cannot assign to None
```

## Порівнюйте через `is`, а не `==`

PEP 8 каже: порівняння із синглтонами на кшталт `None` завжди слід робити через `is` або `is not`. Причин дві.

По-перше, `==` викликає метод `__eq__()` об'єкта, а клас може змусити його повертати що завгодно:

```python
class Apple:
    def __eq__(self, other):
        return True


apple = Apple()
print(apple == None)
print(apple is None)
```

Результат:

```text
True
False
```

`apple == None` стверджує, що яблуко — це `None`. Перевизначити `is` неможливо, тож `apple is None` завжди каже правду. По-друге, `is` просто перевіряє ідентичність. Оскільки `None` лише один, запитання «чи це об'єкт `None`?» — саме те, що потрібно.

```python
result = None

if result is None:
    print("no result yet")

if result is not None:
    print("got a result")
```

Результат:

```text
no result yet
```

## Чим `None` не є

`None` — це не нуль, не `False`, не порожній рядок і не порожній список. Він дорівнює лише самому собі:

```python
print(None == 0)
print(None == False)
print(None == "")
print(None == [])
print(bool(None))
print(not None)
```

Результат:

```text
False
False
False
False
False
True
```

Зверніть увагу на два останні рядки: `None` **хибний** (falsy). В інструкції `if` він поводиться як `False`, але так само поводяться `0`, `""`, `[]` і `{}`. Саме тут ховається дуже поширена помилка (див. нижче).

На відміну від Python 2, `None` також не можна порівнювати з іншими значеннями на «більше/менше»:

```python
print(None < 1)
```

Результат:

```text
Traceback (most recent call last):
  ...
TypeError: '<' not supported between instances of 'NoneType' and 'int'
```

## `if x is None` проти `if not x`

`if not x` питає: «чи `x` хибне?». `if x is None` питає: «чи `x` відсутнє?». Коли `0`, `""` чи порожній список — допустимі значення, це різні запитання:

```python
def find_index(items, target):
    for index, item in enumerate(items):
        if item == target:
            return index
    return None


position = find_index(["a", "b", "c"], "a")

if not position:
    print("not found (wrong!)")

if position is None:
    print("not found")
else:
    print("found at", position)
```

Результат:

```text
not found (wrong!)
found at 0
```

Елемент знайдено за індексом `0`, а `0` хибне, тож `if not position` дає неправильну відповідь. Пишіть `is None` щоразу, коли `None` означає «значення немає», а інші хибні значення цілком допустимі.

## `None` як початкове значення

Якщо змінна ще не має змістовного значення, ініціалізуйте її `None`, а пізніше перевірте, чи її вже встановлено:

```python
state = None

if state is None:
    state = "start"

print(state)
```

Результат:

```text
start
```

Це зрозуміліше, ніж вигадувати фальшиве значення на кшталт `""` чи `-1`, яке потім можна сплутати зі справжніми даними.

## `None` проти змінюваного аргументу за замовчуванням

Ця функція додає колір до списку:

```python
def append(color, colors=[]):
    colors.append(color)
    return colors


colors = ["red", "green"]
append("blue", colors)
print(colors)

hsl = append("hue")
print(hsl)

rgb = append("red")
print(rgb)

print(hsl is rgb)
print(append.__defaults__)
```

Результат:

```text
['red', 'green', 'blue']
['hue']
['hue', 'red']
True
(['hue', 'red'],)
```

Якщо передати власний список, усе працює. Але два виклики, що покладаються на значення за замовчуванням, **ділять один список**, і в `rgb` несподівано опиняється `'hue'`.

Чому? Значення за замовчуванням обчислюються **один раз** — коли виконується інструкція `def` — і зберігаються в об'єкті функції (`append.__defaults__`). Кожен виклик без `colors` отримує той самий об'єкт-список, а `colors.append()` його змінює. Список росте від виклику до виклику.

Стандартне виправлення — зробити значенням за замовчуванням `None` і створювати новий список усередині функції:

```python
def append(color, colors=None):
    if colors is None:
        colors = []

    colors.append(color)
    return colors


hsl = append("hue")
print(hsl)

rgb = append("red")
print(rgb)
```

Результат:

```text
['hue']
['red']
```

`None` незмінюваний, тож ділити його між викликами безпечно. Новий список створюється під час кожного виклику, якому він потрібен.

> **Порада:** застосовуйте цей шаблон до будь-якого змінюваного значення за замовчуванням: списків, словників, множин і власних змінюваних об'єктів. Незмінювані значення, як-от `0`, `""`, `None` чи кортеж, безпечні.

## `None` як значення, що повертає функція

Функція без інструкції `return` або з порожнім `return` повертає `None`:

```python
def say(something):
    print(something)


def stop_early(value):
    if value < 0:
        return
    return value * 2


result = say("Hello")
print(result)
print(stop_early(-1))
print(stop_early(5))
```

Результат:

```text
Hello
None
None
10
```

`say()` виводить `Hello`, але нічого не повертає, тож `result` дорівнює `None`. `stop_early(-1)` доходить до порожнього `return`.

`None` — це й звичний спосіб повідомити, що пошук нічого не дав. Так роблять багато стандартних функцій: `dict.get()` повертає `None` для відсутнього ключа, `re.match()` повертає `None`, якщо шаблон не збігся. В анотаціях типів це записують як `X | None` (або `Optional[X]` у старішому коді):

```python
def find_user(users, user_id: int) -> str | None:
    return users.get(user_id)


users = {1: "Olena", 2: "Taras"}
print(find_user(users, 1))
print(find_user(users, 3))

name = find_user(users, 3)
if name is not None:
    print(name.upper())
else:
    print("no such user")
```

Результат:

```text
Olena
None
no such user
```

Перш ніж використовувати результат, код, що викликає функцію, має перевірити його на `None`. Виклик `name.upper()` для `None` призвів би до аварійного завершення.

## Методи, що повертають `None`

Методи, які змінюють об'єкт на місці, як-от `list.sort()`, `list.append()` і `dict.update()`, повертають `None`. Присвоювати їхній результат — класична помилка:

```python
numbers = [3, 1, 2]
numbers = numbers.sort()
print(numbers)
numbers.append(4)
```

Результат:

```text
None
Traceback (most recent call last):
  ...
AttributeError: 'NoneType' object has no attribute 'append'
```

Список відсортувався, але потім ім'я `numbers` перев'язали на `None`, який повернув `sort()`. Пишіть `numbers.sort()` окремим рядком або `numbers = sorted(numbers)`, якщо вам потрібен новий список.

## Типові помилки

- **Порівнювати через `== None`.** Власний `__eq__` може збрехати. Пишіть `is None` / `is not None`.
- **Використовувати `if not x`, коли `0`, `""` чи `[]` — допустимі значення.** Вони теж хибні. Пишіть `if x is None`.
- **Використовувати змінюваний аргумент за замовчуванням.** `def f(items=[])` ділить один список між викликами. Пишіть `items=None` і створюйте список усередині.
- **Присвоювати результат методу, що змінює об'єкт на місці.** `items = items.sort()` перетворює `items` на `None`.
- **Забувати `return`.** Функція, яка обчислює значення, але не повертає його, повертає `None`, а помилка (`'NoneType' object has no attribute ...` або `unsupported operand type(s) ... 'NoneType'`) з'являється пізніше, далеко від справжньої причини.
- **Сортувати чи порівнювати дані, що містять `None`.** `sorted([3, None, 1])` генерує `TypeError`. Відфільтруйте `None` або використайте функцію `key`.

## Підсумок

- `None` — єдиний екземпляр `NoneType`, він означає «значення немає».
- Порівнюйте через `is None` та `is not None`: це надійно та ідіоматично.
- `None` не дорівнює `0`, `False`, `""` чи `[]`, але він хибний, тож `if x is None` і `if not x` — різні перевірки.
- Використовуйте `None` як початкове значення-заповнювач, як позначку «результату немає» та як значення необов'язкових параметрів за замовчуванням, особливо замість змінюваних значень.
- Функції без `return` (або з порожнім `return`) повертають `None`, як і методи, що змінюють об'єкт на місці, наприклад `list.sort()`.
- `None` не можна порівнювати з числами чи рядками на «більше/менше»: `None < 1` генерує `TypeError`.

## Практика

### Вправа 1: Передбачте результат

Запишіть, що виведе кожен рядок, а потім перевірте.

```python
print(None == 0)
print(None is None)
print(bool(None), bool(0), bool(""))
print(None == False, not None)
print(print("hi"))
print([].append(1))
```

### Вправа 2: Спільний кошик

Двоє покупців отримують той самий кошик. Запустіть код, поясніть причину й виправте `add_item()` так, щоб кожен виклик без кошика починав із порожнього, а передавання наявного кошика й далі працювало.

```python
def add_item(item, cart=[]):
    cart.append(item)
    return cart


first_customer = add_item("apple")
second_customer = add_item("bread")
print(first_customer)
print(second_customer)
```

### Вправа 3: Середнє з пропущеними показами

Датчик повертає покази, де `None` означає «даних немає»: `[10, None, 0, 20, None]`. Напишіть `average(values)`, яка ігнорує `None`, але враховує `0` (відповідь — `10.0`). Якщо справжніх показів немає, поверніть `None`. Також поясніть, чому фільтр `if value` дає `15.0`.

### Вправа 4: Сортування з `None` наприкінці

`sorted([3, None, 1, None, 2])` генерує `TypeError`. Напишіть функцію-ключ `none_last(value)`, щоб `sorted(scores, key=none_last)` повертав `[1, 2, 3, None, None]`.

## Розв'язки

### Вправа 1

Результат:

```text
False
True
False False False
False True
hi
None
None
```

`None` дорівнює лише самому собі, але він хибний, як `0` і `""`. `print()` повертає `None` (після того як виведе `hi`), і `list.append()` теж повертає `None`.

### Вправа 2

Початковий код двічі виводить той самий список:

```text
['apple', 'bread']
['apple', 'bread']
```

Список за замовчуванням створюється один раз, коли виконується `def`, і обидва виклики додають елементи саме до нього. Виправлена версія:

```python
def add_item(item, cart=None):
    if cart is None:
        cart = []
    cart.append(item)
    return cart


first_customer = add_item("apple")
second_customer = add_item("bread")
print(first_customer)
print(second_customer)

shared = ["milk"]
add_item("eggs", shared)
print(shared)
```

Результат:

```text
['apple']
['bread']
['milk', 'eggs']
```

### Вправа 3

```python
def average(values):
    numbers = [value for value in values if value is not None]
    if not numbers:
        return None
    return sum(numbers) / len(numbers)


def average_wrong(values):
    numbers = [value for value in values if value]   # відкидає ще й 0!
    return sum(numbers) / len(numbers)


readings = [10, None, 0, 20, None]
print(average(readings))
print(average_wrong(readings))
print(average([None, None]))
print(average([]))
```

Результат:

```text
10.0
15.0
None
None
```

`if value` відкидає всі хибні значення, зокрема допустимий показ `0`, тож неправильна версія усереднює лише `10` і `20`. А от `if not numbers` тут доречне, бо порожній список справді означає «показів немає».

### Вправа 4

```python
def none_last(value):
    return (value is None, value)


scores = [3, None, 1, None, 2]

try:
    print(sorted(scores))
except TypeError as error:
    print("TypeError:", error)

print(sorted(scores, key=none_last))
```

Результат:

```text
TypeError: '<' not supported between instances of 'NoneType' and 'int'
[1, 2, 3, None, None]
```

Кожне значення сортується за кортежем `(чи це None?, значення)`. Числа отримують `(False, n)` і йдуть першими, бо `False < True`. Два ключі для `None` — це `(True, None)` і `(True, None)`: кортежі порівнюються поелементно до першої відмінності, а оскільки ці кортежі рівні, `None` ніколи не порівнюється через `<`.

---

*Джерело: [pythontutorial.net — Python None](https://www.pythontutorial.net/advanced-python/python-none/). Адаптовано й доповнено для PyJourney.*
