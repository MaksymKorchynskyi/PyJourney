# Перелік (Enum)

**Перелік** (enumeration, enum) — це фіксований набір іменованих констант, що належать до однієї групи: дні тижня, кольори світлофора, статуси замовлення. Модуль `enum` у Python дає змогу оголосити такий набір як клас, і тоді замість «магічних» чисел і рядків ваш код використовує зрозумілі й типобезпечні імена на кшталт `Color.RED` чи `OrderStatus.SHIPPED`.

## Що ви дізнаєтесь

- Чому переліки кращі за звичайні константи, числа й рядки
- Як оголосити перелік, успадкувавши від `Enum`, і що таке елементи, імена та значення
- Як порівнюються елементи (`is`, `==`) і чому елемент не дорівнює своєму значенню
- Як отримати елемент через атрибут, за іменем і за значенням і що буде, якщо такого немає
- Як перебирати перелік, перевіряти належність і використовувати елементи як ключі словника
- Чому переліки незмінювані й чому їх не можна розширити, якщо вони вже мають елементи

## Навіщо переліки?

Розгляньмо код, що зберігає статус числом:

```python
status = 2

if status == 2:
    print("shipped")
```

Результат:

```text
shipped
```

Що означає `2`? Щоб дізнатися, доведеться шукати в коді чи документації, і ніщо не завадить комусь написати `status = 7` або порівняти з неправильним числом. Рядки (`"shipped"`) трохи зрозуміліші, але одруківка на кшталт `"shiped"` непомітно перетворюється на помилку.

Перелік дає кожному допустимому значенню ім'я, збирає ці імена в одному місці й унеможливлює випадкове створення недопустимого значення.

## Оголошення переліку

Імпортуйте `Enum` з модуля `enum` і створіть його підклас. Кожен атрибут класу, якому ви присвоюєте значення, стає **елементом** (member) переліку:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


print(Color.RED)
print(repr(Color.RED))
print(Color.RED.name)
print(Color.RED.value)
```

Результат:

```text
Color.RED
<Color.RED: 1>
RED
1
```

- `Color` — це перелік.
- `RED`, `GREEN` і `BLUE` — його **елементи**.
- Кожен елемент має **ім'я** (`"RED"`) і **значення** (`1`).
- `str()` і `print()` показують `Color.RED`; `repr()` показує ще й значення.

Елементи — це константи, тому їхні імена за домовленістю пишуть `ВЕЛИКИМИ_ЛІТЕРАМИ`. Значення можуть бути будь-якого типу: цілі числа, рядки, кортежі. Часто конкретне значення взагалі не має значення — головне, щоб у кожного елемента воно було своє.

> **Зверніть увагу:** хоча `Color` записано через ключове слово `class`, поводиться він не як звичайний клас. Його атрибути перетворюються на екземпляри самого `Color`, і ви ніколи не викликаєте `Color()`, щоб створити нові об'єкти. Цю «магію» виконує метаклас переліку `EnumType` (до Python 3.11 він називався `EnumMeta`).

## Елементи є екземплярами свого переліку

Кожен елемент — це об'єкт, тип якого — перелік, до якого він належить:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


print(type(Color.RED))
print(isinstance(Color.RED, Color))
```

Результат:

```text
<enum 'Color'>
True
```

Отже, функція може перевірити `isinstance(value, Color)` і бути певною, що отримала один із трьох допустимих кольорів, а не довільне число.

## Порівняння елементів

Кожен елемент існує в єдиному екземплярі (singleton), тому для порівняння елементів працюють і `is`, і `==`. Елемент **не дорівнює** своєму значенню:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


print(Color.RED is Color.RED)
print(Color.RED is Color.BLUE)
print(Color.RED == Color.RED)
print(Color.RED == 1)
print(Color.RED.value == 1)
```

Результат:

```text
True
False
True
False
True
```

`Color.RED == 1` дає `False` навмисно: перелік — окремий тип, а `1` може означати що завгодно. Якщо потрібно порівняти з «сирим» значенням, перетворіть явно: порівняйте `.value` або перетворіть значення на елемент через `Color(1)`.

Елементи звичайного `Enum` також не підтримують упорядкування:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


print(Color.RED < Color.GREEN)
```

Результат:

```text
Traceback (most recent call last):
  ...
TypeError: '<' not supported between instances of 'Color' and 'Color'
```

Кольори не мають природного порядку. Якщо ж ваші елементи його мають, упорядкування можна додати самостійно або використати `IntEnum`; як це зробити, показано в темі про налаштування переліків.

## Доступ до елементів за іменем і за значенням

Отримати елемент можна трьома способами:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


print(Color.RED)         # через атрибут: ім'я записане в коді
print(Color["RED"])      # за іменем: ім'я — рядок, напр. з конфігураційного файлу
print(Color(1))          # за значенням: напр. число, збережене в базі даних
print(Color["RED"] is Color(1))
```

Результат:

```text
Color.RED
Color.RED
Color.RED
True
```

- `Color["RED"]` працює, бо клас переліку підтримує доступ через квадратні дужки (реалізує `__getitem__`).
- `Color(1)` схоже на створення об'єкта, але нічого не створює: воно **шукає** наявний елемент зі значенням `1`.

Обидва способи явно повідомляють про невідомі дані:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


try:
    Color["PINK"]
except KeyError as error:
    print("KeyError:", error)

try:
    Color(5)
except ValueError as error:
    print("ValueError:", error)
```

Результат:

```text
KeyError: 'PINK'
ValueError: 5 is not a valid Color
```

Це перевага: некоректні дані відхиляються ще на межі програми, а не мандрують далі як безглузде число.

## Перебір і перевірка належності

Перелік є ітерованим об'єктом. Елементи повертаються в порядку оголошення:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


for color in Color:
    print(color.name, color.value)

print(list(Color))
print(len(Color))
```

Результат:

```text
RED 1
GREEN 2
BLUE 3
[<Color.RED: 1>, <Color.GREEN: 2>, <Color.BLUE: 3>]
3
```

Оператор `in` перевіряє, чи належить щось до переліку:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


print(Color.RED in Color)
print(1 in Color)
print(7 in Color)
print("RED" in Color)
print("RED" in Color.__members__)
```

Результат:

```text
True
True
False
False
True
```

- Елемент завжди належить до свого переліку.
- Починаючи з **Python 3.12**, `in` приймає й «сирі» значення: `1 in Color` дає `True`, бо в переліку є елемент зі значенням `1`. До 3.12 перевірка не-елемента генерувала `TypeError`.
- Імена — не значення, тому `"RED" in Color` дає `False`. Щоб перевірити ім'я, використовуйте відображення `__members__`, яке зіставляє кожне ім'я з його елементом.

## Елементи хешовані

Елементи можна використовувати як ключі словника й елементи множини:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


rgb = {
    Color.RED: "#ff0000",
    Color.GREEN: "#00ff00",
    Color.BLUE: "#0000ff",
}

print(rgb[Color.GREEN])
print(rgb[Color(3)])

warm = {Color.RED}
print(Color.RED in warm, Color.BLUE in warm)
```

Результат:

```text
#00ff00
#0000ff
True False
```

## Переліки незмінювані

Після оголошення переліку набір його елементів і їхні значення зафіксовано. Кожна спроба щось змінити завершується помилкою:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


try:
    Color["YELLOW"] = 4
except TypeError as error:
    print("TypeError:", error)

try:
    Color.RED = 100
except AttributeError as error:
    print("AttributeError:", error)

try:
    Color.RED.value = 100
except AttributeError as error:
    print("AttributeError:", error)
```

Результат:

```text
TypeError: 'EnumType' object does not support item assignment
AttributeError: cannot reassign member 'RED'
AttributeError: <enum 'Enum'> cannot set attribute 'value'
```

Саме в цій гарантії і полягає сенс переліку: код у будь-якому місці програми може покладатися на те, що `Color.RED` завжди означає одне й те саме.

> **Зверніть увагу:** `Color.YELLOW = 4` *не* генерує помилку, але й елемента не створює. Це просто додає звичайний атрибут класу з цілим числом `4`, а `list(Color)` і далі містить три елементи. Не робіть так.

## Перелік з елементами не можна успадкувати

Успадкуватися можна лише від переліку **без елементів**. Порожній перелік може слугувати базою зі спільними методами:

```python
from enum import Enum


class Color(Enum):
    pass


class RGB(Color):
    RED = 1
    GREEN = 2
    BLUE = 3


print(list(RGB))
```

Результат:

```text
[<RGB.RED: 1>, <RGB.GREEN: 2>, <RGB.BLUE: 3>]
```

Спроба розширити перелік, у якому вже є елементи, завершується помилкою:

```python
from enum import Enum


class RGB(Enum):
    RED = 1
    GREEN = 2
    BLUE = 3


class RGBA(RGB):
    ALPHA = 4
```

Результат:

```text
Traceback (most recent call last):
  ...
TypeError: <enum 'RGBA'> cannot extend <enum 'RGB'>
```

Причина — правило IS-A з теми про успадкування: якби `RGBA` був підкласом `RGB`, то `RGBA.ALPHA` теж був би елементом `RGB`, і в `RGB` раптом з'явився б четвертий елемент, про який його власне оголошення нічого не каже. Це порушило б обіцянку, що перелік — фіксований набір. У наступних темах показано, як ділитися поведінкою між переліками за допомогою базових класів без елементів.

## Практичний приклад: розбір відповіді

Переліки особливо корисні на межі, де зовнішні дані (JSON, база даних, введення користувача) потрапляють у програму. Припустімо, API повертає JSON-документ зі статусом:

```python
import json
from enum import Enum


class ResponseStatus(Enum):
    PENDING = "pending"
    FULFILLED = "fulfilled"
    REJECTED = "rejected"


response = """{
    "status": "fulfilled"
}"""

data = json.loads(response)
status = ResponseStatus(data["status"])

print(status)
print(status is ResponseStatus.FULFILLED)
```

Результат:

```text
ResponseStatus.FULFILLED
True
```

`ResponseStatus(data["status"])` перетворює рядок на елемент. Далі програма працює з `ResponseStatus.FULFILLED`, а не з рядком `"fulfilled"`.

Якщо API надішле статус, якого перелік не знає, перетворення згенерує `ValueError`. Обробіть його там, де дані надходять у програму:

```python
import json
from enum import Enum


class ResponseStatus(Enum):
    PENDING = "pending"
    FULFILLED = "fulfilled"
    REJECTED = "rejected"


response = """{
    "status": "ok"
}"""

data = json.loads(response)

try:
    if ResponseStatus(data["status"]) is ResponseStatus.FULFILLED:
        print("The request completed successfully")
except ValueError as error:
    print(error)
```

Результат:

```text
'ok' is not a valid ResponseStatus
```

### Скорочений запис: функціональний API

Для швидкого створення переліку `Enum` можна також викликати як функцію. Значення нумеруються з `1`:

```python
from enum import Enum

Shape = Enum("Shape", ["CIRCLE", "SQUARE", "TRIANGLE"])
print(list(Shape))
```

Результат:

```text
[<Shape.CIRCLE: 1>, <Shape.SQUARE: 2>, <Shape.TRIANGLE: 3>]
```

Синтаксис класу поширеніший, бо дає змогу ще й додавати методи та рядки документації.

## Типові помилки

- **Порівнювати елемент із його «сирим» значенням.** Для звичайного `Enum` вираз `Color.RED == 1` завжди дає `False`. Спершу перетворіть: `Color(value) is Color.RED` або порівнюйте `member.value`.
- **Зайва кома в кінці.** `RED = 1,` робить значенням кортеж `(1,)`, а не `1`, тому `Color(1)` згенерує `ValueError`.
- **Використовувати `.value` всюди.** Якщо більшість коду працює з `status.value`, ви втратили переваги переліку. Перетворюйте «сирі» значення на елементи на межах програми, а всередині працюйте з елементами.
- **Не обробляти невідомі значення.** `Color(x)` і `Color[name]` генерують `ValueError` і `KeyError` для невідомих даних. Коли дані надходять ззовні, перехоплюйте ці винятки.
- **Очікувати, що `"RED" in Color` перевіряє імена.** Цей вираз перевіряє значення (Python 3.12+). Для імен використовуйте `"RED" in Color.__members__`.
- **Намагатися розширити перелік, що має елементи.** Натомість винесіть спільні методи в базовий перелік без елементів.

## Підсумок

- Перелік — це фіксований набір іменованих констант; щоб його оголосити, успадкуйте клас від `enum.Enum`.
- Кожен елемент має `.name` і `.value` та є екземпляром свого переліку.
- Елементи існують в єдиному екземплярі: порівнюйте їх через `is` або `==`. Елемент ніколи не дорівнює своєму «сирому» значенню, а елементи звичайного `Enum` не можна впорядкувати через `<`.
- Отримуйте елементи через атрибут (`Color.RED`), за іменем (`Color["RED"]`) або за значенням (`Color(1)`); для невідомих даних виникає `KeyError` або `ValueError`.
- Переліки перебираються в порядку оголошення, підтримують `len()`, а з Python 3.12 оператор `in` приймає й «сирі» значення.
- Елементи хешовані, тож придатні як ключі словника й елементи множини.
- Переліки незмінювані: жодних нових елементів, перепризначених елементів чи змінених значень.
- Успадковуватися можна лише від переліку без елементів.

## Практика

### Вправа 1: Дні тижня

Оголосіть перелік `Weekday` з елементами від `MON` до `SUN` і значеннями від `1` до `7`. Потім:

1. в одному циклі виведіть ім'я та значення кожного елемента;
2. виведіть елемент зі значенням `3`;
3. виведіть елемент з іменем `"SUN"`;
4. виведіть кількість елементів переліку.

### Вправа 2: Світлофор

Оголосіть перелік `Light` з елементами `RED`, `GREEN`, `YELLOW` (значення — рядки `"red"`, `"green"`, `"yellow"`). Напишіть функцію `next_light(light)`, яка повертає наступний сигнал у циклі `RED -> GREEN -> YELLOW -> RED`, використавши словник з елементами як ключами. Почніть з `Light.RED` і виведіть п'ять сигналів поспіль.

### Вправа 3: Перевірка вхідних даних

Із зовнішньої системи надходить список статусів замовлень у вигляді рядків:

```python
raw = ["new", "paid", "shipped", "lost", "paid", "NEW"]
```

Оголосіть перелік `OrderStatus` зі значеннями `"new"`, `"paid"` і `"shipped"`. Напишіть функцію `count_statuses(raw)`, яка повертає словник, що зіставляє кожен елемент `OrderStatus` з кількістю його появ, а також окремо кількість некоректних рядків. Рядки, які не збігаються зі значенням точно, вважаються некоректними. Виведіть результат.

### Вправа 4: Передбачте результат

Не запускаючи код, передбачте, що він виведе.

```python
from enum import Enum


class Size(Enum):
    S = "small"
    M = "medium"
    L = "large"


print(Size("medium"))
print(Size["L"].value)
print(Size.S == "small")
print("small" in Size)
print(Size.M in Size)
print([size.name for size in Size])
```

## Розв'язки

### Вправа 1

```python
from enum import Enum


class Weekday(Enum):
    MON = 1
    TUE = 2
    WED = 3
    THU = 4
    FRI = 5
    SAT = 6
    SUN = 7


for day in Weekday:
    print(day.name, day.value)

print(Weekday(3))
print(Weekday["SUN"])
print(len(Weekday))
```

Результат:

```text
MON 1
TUE 2
WED 3
THU 4
FRI 5
SAT 6
SUN 7
Weekday.WED
Weekday.SUN
7
```

### Вправа 2

```python
from enum import Enum


class Light(Enum):
    RED = "red"
    GREEN = "green"
    YELLOW = "yellow"


NEXT = {
    Light.RED: Light.GREEN,
    Light.GREEN: Light.YELLOW,
    Light.YELLOW: Light.RED,
}


def next_light(light):
    return NEXT[light]


light = Light.RED
for _ in range(5):
    print(light.name)
    light = next_light(light)
```

Результат:

```text
RED
GREEN
YELLOW
RED
GREEN
```

### Вправа 3

```python
from enum import Enum


class OrderStatus(Enum):
    NEW = "new"
    PAID = "paid"
    SHIPPED = "shipped"


def count_statuses(raw):
    counts = {status: 0 for status in OrderStatus}
    invalid = 0
    for text in raw:
        try:
            counts[OrderStatus(text)] += 1
        except ValueError:
            invalid += 1
    return counts, invalid


raw = ["new", "paid", "shipped", "lost", "paid", "NEW"]
counts, invalid = count_statuses(raw)
for status, count in counts.items():
    print(status.name, count)
print("invalid", invalid)
```

Результат:

```text
NEW 1
PAID 2
SHIPPED 1
invalid 2
```

`"lost"` — невідомий статус, а `"NEW"` не збігається з `"new"`, бо пошук за значенням чутливий до регістру. Обидва рядки генерують `ValueError` і зараховуються до некоректних.

### Вправа 4

Результат:

```text
Size.M
large
False
True
True
['S', 'M', 'L']
```

- `Size("medium")` шукає елемент за значенням.
- `Size["L"]` шукає за іменем; його значення — `"large"`.
- Елемент ніколи не дорівнює своєму «сирому» значенню.
- `"small" in Size` перевіряє значення (Python 3.12+), а `"small"` — це значення `Size.S`.
- Елемент завжди належить до свого переліку.
- Перебір повертає елементи в порядку оголошення.

---

*Джерело: [pythontutorial.net — Python Enumeration](https://www.pythontutorial.net/python-oop/python-enumeration/). Адаптовано й доповнено для PyJourney.*
