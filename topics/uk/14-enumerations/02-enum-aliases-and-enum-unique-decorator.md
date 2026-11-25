# Псевдоніми Enum і декоратор @enum.unique

Два імені в переліку можуть мати однакове значення. У такому разі Python не створює двох елементів: друге ім'я стає **псевдонімом** (alias) першого. Псевдоніми зручні, коли кілька написань треба звести до одного значення, але випадковий псевдонім — це непомітна помилка. Декоратор `@enum.unique` дає змогу їх заборонити.

## Що ви дізнаєтесь

- Що таке псевдонім у переліку і який елемент є «справжнім» (канонічним)
- Як псевдоніми поводяться під час пошуку за значенням і за іменем, під час перебору та в `__members__`
- Як знайти всі псевдоніми переліку
- Практичне застосування псевдонімів: уніфікація кодів статусів із різних систем
- Як заборонити псевдоніми за допомогою `@enum.unique` або `@enum.verify(UNIQUE)` (Python 3.11+)
- Чому значення на кшталт `1`, `1.0` і `True` можуть створити небажані псевдоніми

## Що таке псевдонім

Значення елементів не мусять бути унікальними. Коли пізніше ім'я отримує значення, яке вже має попередній елемент, це ім'я стає псевдонімом:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    CRIMSON = 1
    SALMON = 1
    GREEN = 2
    BLUE = 3


print(Color.RED is Color.CRIMSON)
print(Color.RED is Color.SALMON)
print(Color.CRIMSON)
print(Color.CRIMSON.name)
```

Результат:

```text
True
True
Color.RED
RED
```

`RED` — це **канонічний елемент** (перше ім'я, оголошене зі значенням `1`), а `CRIMSON` і `SALMON` — лише інші імена того самого об'єкта. Тому `Color.CRIMSON` виводиться як `Color.RED`, а його `.name` дорівнює `"RED"`: окремого об'єкта `CRIMSON` не існує.

```text
імена                 елементи
RED     ----+
CRIMSON ----+---->  <Color.RED: 1>
SALMON  ----+
GREEN   --------->  <Color.GREEN: 2>
BLUE    --------->  <Color.BLUE: 3>
```

## Як поводяться псевдоніми

### Пошук повертає канонічний елемент

Пошук за значенням завжди повертає канонічний елемент. Пошук за іменем псевдоніма теж працює й повертає той самий об'єкт:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    CRIMSON = 1
    SALMON = 1
    GREEN = 2
    BLUE = 3


print(Color(1))
print(Color["SALMON"])
print(Color["SALMON"] is Color.RED)
```

Результат:

```text
Color.RED
Color.RED
True
```

### Перебір пропускає псевдоніми

Перебір переліку (і `len()`) враховує лише канонічні елементи:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    CRIMSON = 1
    SALMON = 1
    GREEN = 2
    BLUE = 3


for color in Color:
    print(color)

print(len(Color))
```

Результат:

```text
Color.RED
Color.GREEN
Color.BLUE
3
```

### `__members__` містить псевдоніми

Щоб побачити всі імена разом із псевдонімами, використовуйте атрибут `__members__`. Це відображення лише для читання (`mappingproxy`), що зіставляє імена з елементами в порядку оголошення:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    CRIMSON = 1
    SALMON = 1
    GREEN = 2
    BLUE = 3


for name, member in Color.__members__.items():
    print(name, "->", repr(member))
```

Результат:

```text
RED -> <Color.RED: 1>
CRIMSON -> <Color.RED: 1>
SALMON -> <Color.RED: 1>
GREEN -> <Color.GREEN: 2>
BLUE -> <Color.BLUE: 3>
```

`CRIMSON` і `SALMON` вказують на той самий об'єкт, що й `RED`.

> **Порада:** `pprint(Color.__members__)` теж працює, але `pprint` за замовчуванням сортує ключі словника за абеткою, тож порядок оголошення в його виведенні губиться.

### Як знайти псевдоніми

Псевдонім — це ім'я, чий елемент має *інше* `.name`. Звідси однорядковий спосіб отримати всі псевдоніми:

```python
from enum import Enum


class Color(Enum):
    RED = 1
    CRIMSON = 1
    SALMON = 1
    GREEN = 2
    BLUE = 3


aliases = [name for name, member in Color.__members__.items() if name != member.name]
print(aliases)
```

Результат:

```text
['CRIMSON', 'SALMON']
```

## Коли псевдоніми корисні

Припустімо, ваша програма працює з двома зовнішніми системами, і кожна має власні коди для тих самих трьох станів запиту:

| Система 1 | Система 2 | Значення |
|---|---|---|
| `REQUESTING` | `PENDING` | Запит виконується |
| `OK` | `FULFILLED` | Запит успішно завершено |
| `NOT_OK` | `REJECTED` | Запит завершився помилкою |

Усередині власного коду ви хочете мати один набір статусів і простий спосіб перекладати в нього коди обох систем:

| Ваша система | Система 1 | Система 2 |
|---|---|---|
| `IN_PROGRESS` | `REQUESTING` | `PENDING` |
| `SUCCESS` | `OK` | `FULFILLED` |
| `ERROR` | `NOT_OK` | `REJECTED` |

Саме це й роблять псевдоніми. Поставте власне ім'я першим, щоб воно стало канонічним елементом, а після нього перелічіть зовнішні коди з тим самим значенням:

```python
from enum import Enum


class ResponseStatus(Enum):
    # виконується
    IN_PROGRESS = 1
    REQUESTING = 1
    PENDING = 1

    # успіх
    SUCCESS = 2
    OK = 2
    FULFILLED = 2

    # помилка
    ERROR = 3
    NOT_OK = 3
    REJECTED = 3


for code in ["OK", "FULFILLED", "REJECTED"]:
    status = ResponseStatus[code]
    if status is ResponseStatus.SUCCESS:
        print(f"{code}: the request completed successfully")
    else:
        print(f"{code}: {status.name}")
```

Результат:

```text
OK: the request completed successfully
FULFILLED: the request completed successfully
REJECTED: ERROR
```

`ResponseStatus["OK"]` і `ResponseStatus["FULFILLED"]` обидва повертають канонічний `ResponseStatus.SUCCESS`, тож решта вашого коду завжди має справу лише з трьома елементами, незалежно від того, з якої системи надійшов код. Перебір `ResponseStatus` теж дає лише ваші три статуси.

## Заборона псевдонімів: `@enum.unique`

Зазвичай кожен елемент має мати власне значення. Тоді помилка під час копіювання може створити псевдонім без жодного попередження:

```python
from enum import Enum


class Day(Enum):
    MON = "Monday"
    TUE = "Monday"  # помилка копіювання
    WED = "Wednesday"
    THU = "Thursday"
    FRI = "Friday"
    SAT = "Saturday"
    SUN = "Sunday"


print(len(Day))
print(Day.TUE)
```

Результат:

```text
6
Day.MON
```

Перелік непомітно має лише шість елементів, а `Day.TUE` — це понеділок. Помилка може проявитися значно пізніше й далеко від свого джерела.

Щоб Python перевіряв це за вас, позначте перелік декоратором `@enum.unique`. Якщо є хоча б один псевдонім, уже саме оголошення класу генерує `ValueError`:

```python
import enum
from enum import Enum


@enum.unique
class Day(Enum):
    MON = "Monday"
    TUE = "Monday"
    WED = "Wednesday"
    THU = "Thursday"
    FRI = "Friday"
    SAT = "Saturday"
    SUN = "Sunday"
```

Результат:

```text
Traceback (most recent call last):
  ...
ValueError: duplicate values found in <enum 'Day'>: TUE -> MON
```

Повідомлення перелічує кожен псевдонім і елемент, на який він указує, наприклад `CRIMSON -> RED, SALMON -> RED`, якщо їх кілька. Оскільки помилка виникає під час імпорту модуля, вона не потрапить у робочу версію непоміченою. Декоратор можна імпортувати й напряму: `from enum import Enum, unique` і писати `@unique`.

### `@verify(UNIQUE)` (Python 3.11+)

У Python 3.11 з'явився загальніший декоратор `enum.verify`, який уміє виконувати кілька перевірок. `UNIQUE` — одна з них:

```python
from enum import Enum, verify, UNIQUE


@verify(UNIQUE)
class Color(Enum):
    RED = 1
    CRIMSON = 1
    GREEN = 2
```

Результат:

```text
Traceback (most recent call last):
  ...
ValueError: aliases found in <enum 'Color'>: CRIMSON -> RED
```

Щодо унікальності обидва декоратори роблять одне й те саме. `@unique` працює в усіх версіях Python 3; `@verify` корисний, коли потрібні й інші перевірки (як-от `CONTINUOUS` для цілих значень без пропусків).

## Рівні значення теж створюють псевдоніми

Python визначає, чи значення «те саме», через `==` (і хешування), а не за типом. Оскільки `1 == 1.0 == True`, усі ці значення збігаються:

```python
from enum import Enum


class Number(Enum):
    ONE = 1
    UNO = 1.0
    YES = True


print(list(Number))
print(Number.YES)
```

Результат:

```text
[<Number.ONE: 1>]
Number.ONE
```

`UNO` і `YES` — псевдоніми `ONE`, тож перелік має лише один елемент. Будьте обережні, змішуючи як значення числа й булеві значення, і використовуйте `@unique`, щоб ловити такі несподіванки.

## Типові помилки

- **Очікувати, що псевдонім — окремий елемент.** `Color.CRIMSON` *і є* `Color.RED`; його `.name` дорівнює `"RED"`, і під час перебору він не з'являється.
- **Оголосити псевдонім перед «головним» іменем.** Канонічним стає перше ім'я з певним значенням. Якби в прикладі зі статусами `OK = 2` стояло перед `SUCCESS = 2`, елементи виводилися б як `ResponseStatus.OK`.
- **Шукати псевдоніми в `list(Enum)`.** Перебір пропускає псевдоніми. Використовуйте `Enum.__members__`.
- **Випадкові дублікати через копіювання.** Додавайте `@unique` (або `@verify(UNIQUE)`) до кожного переліку, значення якого мають бути різними.
- **Змішувати `1`, `1.0` і `True` як значення.** Вони рівні між собою й зливаються в один елемент.
- **Писати `__member__` замість `__members__`.** Ім'я атрибута — у множині; однина генерує `AttributeError`.

## Підсумок

- Якщо два імені в переліку мають рівні значення, перше стає канонічним елементом, а наступні — його псевдонімами.
- Псевдонім — це той самий об'єкт, що й канонічний елемент: те саме `.name`, те саме `.value`, а `is` повертає `True`.
- `Enum(value)` повертає канонічний елемент; `Enum[alias_name]` теж повертає саме його.
- Перебір і `len()` ігнорують псевдоніми; `__members__` їх містить.
- Псевдоніми корисні, щоб звести кілька зовнішніх кодів до одного внутрішнього імені.
- `@enum.unique` (усі версії) і `@enum.verify(UNIQUE)` (3.11+) генерують `ValueError` під час створення класу, якщо є хоч один псевдонім.
- Значення порівнюються через `==`, тому `1`, `1.0` і `True` дають той самий елемент.

## Практика

### Вправа 1: Так чи ні

Оголосіть перелік `Answer` з канонічними елементами `YES = 1` і `NO = 0` та псевдонімами `Y`, `TRUE` для «так» і `N`, `FALSE` для «ні». Напишіть функцію `parse_answer(text)`, що перетворює введення користувача на кшталт `"y"`, `"True"`, `" no "` на елемент (приберіть пробіли й переведіть у верхній регістр, щоб шукати за іменем). Виведіть результат для `["y", "True", " no ", "YES", "n"]`.

### Вправа 2: Псевдоніми кожного елемента

Напишіть функцію `alias_map(enum_cls)`, що повертає словник, який зіставляє ім'я кожного канонічного елемента зі списком імен його псевдонімів (порожній список, якщо псевдонімів немає). Перевірте її на переліку `ResponseStatus` з цієї теми.

### Вправа 3: Які класи падають?

Не запускаючи код, визначте, які з трьох оголошень класів генерують `ValueError` і що виводять решта. Потім запустіть його.

```python
from enum import Enum, unique


@unique
class A(Enum):
    LOW = 1
    MID = 2
    HIGH = 3


try:
    @unique
    class B(Enum):
        ON = 1
        ENABLED = True
except ValueError as error:
    print("B:", error)


class C(Enum):
    SMALL = "s"
    TINY = "s"
    LARGE = "l"


print(len(A), len(C))
print(C.TINY)
```

## Розв'язки

### Вправа 1

```python
from enum import Enum


class Answer(Enum):
    YES = 1
    Y = 1
    TRUE = 1
    NO = 0
    N = 0
    FALSE = 0


def parse_answer(text):
    return Answer[text.strip().upper()]


for text in ["y", "True", " no ", "YES", "n"]:
    print(repr(text), "->", parse_answer(text))
```

Результат:

```text
'y' -> Answer.YES
'True' -> Answer.YES
' no ' -> Answer.NO
'YES' -> Answer.YES
'n' -> Answer.NO
```

Кожне написання зводиться лише до одного з двох елементів, тож решті програми досить обробляти `Answer.YES` і `Answer.NO`.

### Вправа 2

```python
from enum import Enum


class ResponseStatus(Enum):
    IN_PROGRESS = 1
    REQUESTING = 1
    PENDING = 1
    SUCCESS = 2
    OK = 2
    FULFILLED = 2
    ERROR = 3
    NOT_OK = 3
    REJECTED = 3


def alias_map(enum_cls):
    result = {member.name: [] for member in enum_cls}
    for name, member in enum_cls.__members__.items():
        if name != member.name:
            result[member.name].append(name)
    return result


print(alias_map(ResponseStatus))
```

Результат:

```text
{'IN_PROGRESS': ['REQUESTING', 'PENDING'], 'SUCCESS': ['OK', 'FULFILLED'], 'ERROR': ['NOT_OK', 'REJECTED']}
```

Перебір переліку дає канонічні елементи (ключі); `__members__` дає всі імена, і ті з них, що відрізняються від `.name` свого елемента, — псевдоніми.

### Вправа 3

Результат:

```text
B: duplicate values found in <enum 'B'>: ENABLED -> ON
3 2
C.SMALL
```

- `A` має три різні значення, тож `@unique` не заперечує.
- У `B` `True == 1`, тому `ENABLED` — псевдонім `ON`, і `@unique` генерує `ValueError`.
- `C` має псевдонім (`TINY` для `SMALL`), але без `@unique`, тому створюється лише з двома елементами, а `C.TINY` — це `C.SMALL`.

---

*Джерело: [pythontutorial.net — Python Enum Aliases & @enum.unique](https://www.pythontutorial.net/python-oop/python-enum-unique/). Адаптовано й доповнено для PyJourney.*
