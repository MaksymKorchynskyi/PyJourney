# auto(): автоматичні значення переліку

Часто конкретні значення елементів переліку неважливі. Вони мають лише відрізнятися одне від одного. Замість того щоб нумерувати елементи вручну, можна написати `auto()` і дозволити переліку самому обрати значення. Це прибирає зайвий шум і цілий клас помилок копіювання, а генератор значень можна налаштувати, коли типові числа не підходять.

## Що ви дізнаєтесь

- Навіщо потрібен `auto()` і які значення він створює за замовчуванням
- Як `auto()` поводиться після явно заданих значень і що змінилося в Python 3.13
- Що `auto()` генерує в `IntEnum`, `StrEnum` і `Flag`
- Як `auto()` працює всередині через `_generate_next_value_` і що означають його параметри
- Як перевизначити `_generate_next_value_` і поширити його через базовий перелік без елементів
- Коли `auto()` **не** варто використовувати

## Навіщо `auto()`?

Ось перелік зі значеннями, написаними вручну:

```python
from enum import Enum


class State(Enum):
    PENDING = 1
    FULFILLED = 2
    REJECTED = 3
```

Числа нічого не означають. Вони існують лише тому, що кожному елементу потрібне *якесь* значення. Писати їх вручну — марудна робота, а помилка під час копіювання, як-от два елементи зі значенням `2`, непомітно створює псевдонім (див. тему «Псевдоніми Enum і декоратор @enum.unique»).

Модуль `enum` надає `auto` (з Python 3.6). Якщо замість значення написати `auto()`, перелік згенерує його сам:

```python
from enum import Enum, auto


class State(Enum):
    PENDING = auto()
    FULFILLED = auto()
    REJECTED = auto()

    def __str__(self):
        return f"{self.name}({self.value})"


for state in State:
    print(state.name, state.value)

print(State.FULFILLED)
print(type(State.PENDING.value))
```

Результат:

```text
PENDING 1
FULFILLED 2
REJECTED 3
FULFILLED(2)
<class 'int'>
```

`auto` — це клас, а `auto()` створює об'єкт-заповнювач. Поки створюється клас переліку, кожен заповнювач замінюється справжнім значенням, тож `State.PENDING.value` — звичайний `int`, а не об'єкт `auto`.

## Які значення створює `auto()`

### Звичайний `Enum`: цілі числа від 1

У звичайному `Enum` `auto()` дає `1`, `2`, `3`, ... Нумерація навмисно починається з `1`, а не з `0`: `0` хибне, і таке значення провокувало б заплутані перевірки на кшталт `if state.value:`. (Самі елементи завжди істинні, хоч би яким було їхнє значення; див. тему «Налаштування та розширення класів Enum».)

### Після явних значень: найбільше значення плюс один

`auto()` можна поєднувати з явними значеннями. Починаючи з Python 3.13, `auto()` повертає **найбільше з уже використаних значень плюс один**:

```python
from enum import Enum, auto


class Level(Enum):
    LOW = 10
    MEDIUM = auto()
    LEGACY = 5
    HIGH = auto()


print(list(Level))
```

Результат:

```text
[<Level.LOW: 10>, <Level.MEDIUM: 11>, <Level.LEGACY: 5>, <Level.HIGH: 12>]
```

`HIGH` отримує `12` (найбільше значення, `11`, плюс один), а не `6`. До Python 3.13 `auto()` брав *останнє* значення плюс один, і тут вийшло б `6`; Python 3.12 попереджав про майбутню зміну. Якщо ваш перелік змішує обидва стилі, не покладайтеся на точні числа в різних версіях.

Типовий генератор уміє лише збільшувати числа. Після нечислового значення `auto()` завершується помилкою:

```python
from enum import Enum, auto


class Mode(Enum):
    READ = "r"
    WRITE = auto()
```

Результат:

```text
Traceback (most recent call last):
  ...
TypeError: unable to increment 'r'
```

### Явні значення можуть збігтися зі згенерованими

`auto()` не резервує числа на майбутнє. Явне значення, що дорівнює згенерованому, створює псевдонім:

```python
from enum import Enum, auto, unique


class Color(Enum):
    RED = auto()
    GREEN = auto()
    BLUE = 1


print(list(Color))
print(Color.BLUE)

try:
    @unique
    class StrictColor(Enum):
        RED = auto()
        GREEN = auto()
        BLUE = 1
except ValueError as error:
    print("ValueError:", error)
```

Результат:

```text
[<Color.RED: 1>, <Color.GREEN: 2>]
Color.RED
ValueError: duplicate values found in <enum 'StrictColor'>: BLUE -> RED
```

`@unique` ловить такі помилки. А ще краще — використовувати або всюди `auto()`, або всюди явні значення.

## `auto()` в інших типах переліків

Кожен тип переліку по-своєму розуміє, яке значення має бути наступним:

| Тип переліку | Значення від `auto()` |
|---|---|
| `Enum`, `IntEnum` | `1`, `2`, `3`, ... |
| `StrEnum` (3.11+) | ім'я елемента в нижньому регістрі |
| `Flag`, `IntFlag` | степені двійки: `1`, `2`, `4`, `8`, ... |

```python
from enum import Flag, IntEnum, StrEnum, auto


class Priority(IntEnum):
    LOW = auto()
    HIGH = auto()


class Color(StrEnum):
    RED = auto()
    DARK_BLUE = auto()


class Permission(Flag):
    READ = auto()
    WRITE = auto()
    EXECUTE = auto()


print(list(Priority))
print(list(Color), Color.DARK_BLUE == "dark_blue")
print(list(Permission))

read_write = Permission.READ | Permission.WRITE
print(read_write, read_write.value)
print(Permission.READ in read_write, Permission.EXECUTE in read_write)
```

Результат:

```text
[<Priority.LOW: 1>, <Priority.HIGH: 2>]
[<Color.RED: 'red'>, <Color.DARK_BLUE: 'dark_blue'>] True
[<Permission.READ: 1>, <Permission.WRITE: 2>, <Permission.EXECUTE: 4>]
Permission.READ|WRITE 3
True False
```

- У `StrEnum` значення — рядки, тож імена в нижньому регістрі — природний вибір за замовчуванням, і їх зручно читати в JSON чи базі даних.
- Елемент `Flag` відповідає одному біту, тому значення мають бути степенями двійки. Елементи можна поєднувати через `|`, а `in` перевіряє, чи містить комбінація певний прапорець. `auto()` позбавляє вас від потреби вручну рахувати `1`, `2`, `4`, `8`, ...

## Як працює `auto()`: `_generate_next_value_`

Коли під час виконання тіла класу переліку трапляється `auto()`, перелік викликає спеціальний статичний метод, щоб обчислити значення:

```python
_generate_next_value_(name, start, count, last_values)
```

- `name` — ім'я елемента, що оголошується, наприклад `"PENDING"`;
- `start` — початкове значення послідовності; `1`, якщо не задано інше (функціональний API приймає `start=`, наприклад `Enum("State", "A B", start=0)`);
- `count` — скільки елементів уже оголошено, **разом із псевдонімами**;
- `last_values` — список усіх уже присвоєних значень у порядку оголошення, разом із явними значеннями й повторами.

Те, що метод поверне, стане значенням елемента. Аргументи можна побачити, перевизначивши метод:

```python
from enum import Enum, auto


class State(Enum):
    @staticmethod
    def _generate_next_value_(name, start, count, last_values):
        print(f"name={name!r} start={start} count={count} last_values={last_values}")
        return name.lower()

    PENDING = auto()
    FULFILLED = auto()
    CANCELLED = 99
    REJECTED = auto()


print(list(State))
```

Результат:

```text
name='PENDING' start=1 count=0 last_values=[]
name='FULFILLED' start=1 count=1 last_values=['pending']
name='REJECTED' start=1 count=3 last_values=['pending', 'fulfilled', 99]
[<State.PENDING: 'pending'>, <State.FULFILLED: 'fulfilled'>, <State.CANCELLED: 99>, <State.REJECTED: 'rejected'>]
```

Метод викликається лише для `auto()`; `CANCELLED = 99` присвоюється напряму, але для наступних елементів воно все одно враховується в `count` і `last_values`.

## Перевизначення `_generate_next_value_`

Перевизначення методу змінює те, що `auto()` створює для всього переліку. Поширений варіант — виводити значення з імені елемента:

```python
from enum import Enum, auto


class State(Enum):
    @staticmethod
    def _generate_next_value_(name, start, count, last_values):
        return name.lower()

    PENDING = auto()
    FULFILLED = auto()
    REJECTED = auto()


for state in State:
    print(state.name, state.value)

print(State("fulfilled"))
```

Результат:

```text
PENDING pending
FULFILLED fulfilled
REJECTED rejected
State.FULFILLED
```

Значення на основі імен стабільні (вони не змінюються, коли ви переставляєте елементи) і зрозумілі без пояснень у журналах і збережених даних.

Діють два правила:

1. **Оголошуйте метод до першого `auto()`.** Генератор потрібен переліку саме в той момент, коли обчислюється `auto()`. Пізніше оголошення — помилка:

   ```python
   from enum import Enum, auto


   class State(Enum):
       PENDING = auto()

       @staticmethod
       def _generate_next_value_(name, start, count, last_values):
           return name.lower()

       FULFILLED = auto()
   ```

   Результат:

   ```text
   Traceback (most recent call last):
     ...
   TypeError: _generate_next_value_ must be defined before members
   ```

2. **Позначайте його декоратором `@staticmethod`.** Він не отримує ні `self`, ні `cls`. У старіших посібниках його оголошують як звичайну функцію всередині класу, і це теж працює, але `@staticmethod` — задокументована форма, яка ще й чітко показує намір.

### Спільний генератор через базовий перелік

Генератор можна винести в базовий перелік без елементів, і кожен перелік, що його розширює, успадкує цю поведінку (той самий прийом, що й у темі «Налаштування та розширення класів Enum»):

```python
from enum import Enum, auto


class NameEnum(Enum):
    @staticmethod
    def _generate_next_value_(name, start, count, last_values):
        return name.lower()


class State(NameEnum):
    PENDING = auto()
    FULFILLED = auto()


class Role(NameEnum):
    ADMIN = auto()
    GUEST = auto()


print(list(State))
print(list(Role))
```

Результат:

```text
[<State.PENDING: 'pending'>, <State.FULFILLED: 'fulfilled'>]
[<Role.ADMIN: 'admin'>, <Role.GUEST: 'guest'>]
```

## Коли не варто використовувати `auto()`

`auto()` ідеальний, коли значення — внутрішня деталь. Будьте обережні, коли вони виходять за межі програми: зберігаються в базі даних, записуються у файл чи передаються через API. Числові значення `auto()` залежать від **порядку** елементів, тож новий елемент посередині непомітно перенумеровує все, що йде після нього:

```python
from enum import Enum, auto


class StateV1(Enum):
    PENDING = auto()
    FULFILLED = auto()
    REJECTED = auto()


class StateV2(Enum):  # посередині додали новий стан
    PENDING = auto()
    IN_REVIEW = auto()
    FULFILLED = auto()
    REJECTED = auto()


saved = StateV1.FULFILLED.value  # збережено старою версією
print(saved, StateV2(saved))
```

Результат:

```text
2 StateV2.IN_REVIEW
```

Запис, збережений як «виконано», тепер читається як «на перевірці». Для значень, які зберігаються чи передаються, пишіть явні значення або генеруйте їх з імен (`StrEnum` чи власний `_generate_next_value_`) — такі значення від порядку не залежать. Також не використовуйте `auto()`, коли значення мають власний зміст, як-от коди стану HTTP (`OK = 200`, `NOT_FOUND = 404`).

## Типові помилки

- **Забути дужки.** `A = auto` присвоює значенням сам клас `auto`. Тоді другий рядок `B = auto` стає псевдонімом `A`:

  ```python
  from enum import Enum, auto


  class Broken(Enum):
      A = auto
      B = auto


  print(list(Broken))
  ```

  Результат:

  ```text
  [<Broken.A: <class 'enum.auto'>>]
  ```

- **Оголошувати `_generate_next_value_` після елементів, що використовують `auto()`.** Це генерує `TypeError`. Розміщуйте метод на початку тіла класу або в базовому переліку.
- **Генерувати однакові значення.** Власний генератор мусить повертати для кожного елемента інше значення. Наприклад, якщо повертати `name.split("_")[0]`, то `GET_USER` і `GET_ORDER` отримають однакове значення `"GET"`, і другий елемент непомітно стане псевдонімом першого.
- **Зберігати числові значення `auto()` за межами програми.** Перестановка або вставлення елементів їх змінює. Для збережених даних використовуйте явні значення або значення на основі імен.
- **Поєднувати `auto()` з нечисловими значеннями у звичайному `Enum`.** Типовий генератор не вміє збільшувати рядок і генерує `TypeError: unable to increment ...`.
- **Очікувати, що `auto()` почне з 0.** Він починає з `1` (або з `start` у функціональному API).
- **Викликати `self.name` як метод.** `__str__`, записаний як `f"{self.name(self.value)}"`, падає під час першого ж виведення елемента: `self.name` — рядок, і його виклик генерує `TypeError: 'str' object is not callable`. Пишіть `f"{self.name}({self.value})"`.

## Підсумок

- `auto()` дає переліку змогу самому генерувати значення елементів, коли важливо лише те, щоб вони різнилися.
- У `Enum` та `IntEnum` значення — `1`, `2`, `3`, ...; у `StrEnum` — імена в нижньому регістрі; у `Flag` — степені двійки.
- Починаючи з Python 3.13, після явних значень `auto()` повертає найбільше вже використане значення плюс один і генерує `TypeError`, якщо це значення неможливо збільшити.
- Явне значення, що збігається зі згенерованим, створює псевдонім; `@unique` це виявляє.
- `auto()` викликає `_generate_next_value_(name, start, count, last_values)`; те, що він поверне, стає значенням елемента.
- Перевизначайте його як `@staticmethod` до першого `auto()` або успадковуйте з базового переліку без елементів.
- Не використовуйте числові значення `auto()` для даних, що зберігаються чи передаються: вони змінюються, коли елементи переставляють.

## Практика

### Вправа 1: Передбачте значення

Не запускаючи код, запишіть, що він виведе. Потім запустіть його.

```python
from enum import Enum, auto


class Level(Enum):
    LOW = auto()
    MEDIUM = auto()
    HIGH = 10
    CRITICAL = auto()
    MINIMAL = 1


print(list(Level))
print(Level.MINIMAL)
print(len(Level.__members__))
```

### Вправа 2: Назви подій у kebab-case

Оголосіть перелік `Event` з елементами `USER_CREATED`, `USER_DELETED` і `ORDER_PAID`, усі через `auto()`. Перевизначте `_generate_next_value_` так, щоб значеннями були імена в нижньому регістрі, де `_` замінено на `-` (наприклад, `"user-created"`). Виведіть усі значення та знайдіть елемент через `Event("order-paid")`.

### Вправа 3: Числа з проміжками

Напишіть базовий перелік без елементів `StepEnum`, чий `_generate_next_value_` повертає `10`, `20`, `30`, ... (використайте `count`). Застосуйте його до переліку `Stage` з елементами `DRAFT`, `REVIEW` і `PUBLISHED` та виведіть його елементи. Задум у тому, щоб лишити проміжки для майбутніх етапів. Потім напишіть другу версію `Stage` з додатковим елементом `SPELLCHECK = 15` між `DRAFT` і `REVIEW`, виведіть її елементи, відсортовані за значенням, і перевірте: чи збереглися значення наявних етапів? Поясніть результат.

### Вправа 4: Права доступу до файлів

Оголосіть `Flag` з назвою `Permission` та елементами `READ`, `WRITE` і `EXECUTE` через `auto()`. Напишіть функцію `describe(perms)`, яка повертає рядок на кшталт `"rw-"`: по одному символу на кожне право (`r`, `w`, `x`) або `-`, якщо права немає. Виведіть результат для `READ`, `READ | WRITE` і для всіх трьох разом, а також ціле значення кожної комбінації.

## Розв'язки

### Вправа 1

Результат:

```text
[<Level.LOW: 1>, <Level.MEDIUM: 2>, <Level.HIGH: 10>, <Level.CRITICAL: 11>]
Level.LOW
5
```

- `LOW` і `MEDIUM` отримують `1` і `2`.
- `CRITICAL` іде після явного `10`, тож отримує найбільше значення плюс один, `11`.
- `MINIMAL = 1` повторює значення `LOW`, тож це псевдонім: `Level.MINIMAL` — це `Level.LOW`, і в переліку чотири елементи.
- `__members__` містить усі п'ять імен, разом із псевдонімом.

### Вправа 2

```python
from enum import Enum, auto


class Event(Enum):
    @staticmethod
    def _generate_next_value_(name, start, count, last_values):
        return name.lower().replace("_", "-")

    USER_CREATED = auto()
    USER_DELETED = auto()
    ORDER_PAID = auto()


print([event.value for event in Event])
print(Event("order-paid"))
```

Результат:

```text
['user-created', 'user-deleted', 'order-paid']
Event.ORDER_PAID
```

### Вправа 3

```python
from enum import Enum, auto


class StepEnum(Enum):
    @staticmethod
    def _generate_next_value_(name, start, count, last_values):
        return (count + 1) * 10


class Stage(StepEnum):
    DRAFT = auto()
    REVIEW = auto()
    PUBLISHED = auto()


print(list(Stage))


class Stage(StepEnum):  # версія 2: новий етап між DRAFT і REVIEW
    DRAFT = auto()
    SPELLCHECK = 15
    REVIEW = auto()
    PUBLISHED = auto()


print(sorted(Stage, key=lambda stage: stage.value))
```

Результат:

```text
[<Stage.DRAFT: 10>, <Stage.REVIEW: 20>, <Stage.PUBLISHED: 30>]
[<Stage.DRAFT: 10>, <Stage.SPELLCHECK: 15>, <Stage.REVIEW: 30>, <Stage.PUBLISHED: 40>]
```

Значення **змінилися**: `REVIEW` був `20`, а став `30`. `count` враховує новий явний елемент `SPELLCHECK`, тож кожен наступний `auto()` зсувається на один крок. Проміжки допомагають лише тоді, коли генератор не залежить від позиції, і саме тому значення, що зберігаються, краще задавати явно. Версія, яка справді зберігає старі числа, записує їх вручну:

```python
from enum import Enum


class Stage(Enum):
    DRAFT = 10
    SPELLCHECK = 15
    REVIEW = 20
    PUBLISHED = 30


print(sorted(Stage, key=lambda stage: stage.value))
```

Результат:

```text
[<Stage.DRAFT: 10>, <Stage.SPELLCHECK: 15>, <Stage.REVIEW: 20>, <Stage.PUBLISHED: 30>]
```

### Вправа 4

```python
from enum import Flag, auto


class Permission(Flag):
    READ = auto()
    WRITE = auto()
    EXECUTE = auto()


def describe(perms):
    letters = {Permission.READ: "r", Permission.WRITE: "w", Permission.EXECUTE: "x"}
    return "".join(char if flag in perms else "-" for flag, char in letters.items())


for perms in (Permission.READ,
              Permission.READ | Permission.WRITE,
              Permission.READ | Permission.WRITE | Permission.EXECUTE):
    print(describe(perms), perms.value)
```

Результат:

```text
r-- 1
rw- 3
rwx 7
```

Оскільки `auto()` дає кожному прапорцю власний біт (`1`, `2`, `4`), кожна комбінація має унікальне ціле значення — та сама ідея, що й у правах доступу до файлів в Unix.

---

*Джерело: [pythontutorial.net — Python enum auto](https://www.pythontutorial.net/python-oop/python-enum-auto/). Адаптовано й доповнено для PyJourney.*
