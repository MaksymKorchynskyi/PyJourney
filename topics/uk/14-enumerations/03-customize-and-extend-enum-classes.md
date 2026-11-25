# Налаштування та розширення класів Enum

Перелік — це клас, тож він може мати методи, властивості та спеціальні (dunder) методи, як і будь-який інший клас. Завдяки цьому поведінку можна тримати поруч із константами, до яких вона належить: як елемент виводиться, як він порівнюється, чи вважається він «істинним». А ще можна один раз написати базовий перелік без елементів і повторно використовувати його поведінку в багатьох переліках.

## Що ви дізнаєтесь

- Як додати до переліку звичайні методи, властивості та методи класу
- Як змінити вигляд елемента під час виведення за допомогою `__str__`
- Як зробити елементи рівними «сирим» значенням через `__eq__` і чому тоді обов'язково потрібен `__hash__`
- Як зробити елементи сортованими за допомогою `__lt__` та `@functools.total_ordering` і чому порівняння мають повертати `NotImplemented`
- Як керувати істинністю через `__bool__` і як прикріпити до кожного елемента додаткові дані
- Як ділитися поведінкою через базовий перелік без елементів і коли `IntEnum` чи `StrEnum` уже розв'язують задачу

## Переліки — це класи: додаємо методи

Усе, що ви оголошуєте в тілі переліку через `def`, — це методи, а не елементи. Елементами стають лише звичайні значення. Усередині методу `self` — це елемент:

```python
from enum import Enum


class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3

    @property
    def label(self):
        return self.name.title()

    def is_final(self):
        return self is not PaymentStatus.PENDING

    @classmethod
    def from_label(cls, text):
        return cls[text.strip().upper()]


print(PaymentStatus.PENDING.label)
print(PaymentStatus.PENDING.is_final(), PaymentStatus.REFUNDED.is_final())
print(PaymentStatus.from_label("  completed "))
print(list(PaymentStatus))
```

Результат:

```text
Pending
False True
PaymentStatus.COMPLETED
[<PaymentStatus.PENDING: 1>, <PaymentStatus.COMPLETED: 2>, <PaymentStatus.REFUNDED: 3>]
```

- `label` — властивість, тож для кожного елемента вона читається як атрибут.
- `is_final()` тримає бізнес-правило «які статуси остаточні» всередині переліку, а не розкидає перевірки `if status in (...)` по всьому коду.
- `from_label()` — метод класу: його викликають на самому переліку, і він повертає елемент.
- У переліку й далі рівно три елементи; методи до них не потрапляють.

### Власний пошук через `_missing_`

`PaymentStatus(value)` шукає елемент за значенням і генерує `ValueError`, якщо нічого не знайдено. Перш ніж здатися, перелік викликає метод класу `_missing_(value)`. Перевизначте його, щоб приймати альтернативні написання:

```python
from enum import Enum


class Status(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            for member in cls:
                if member.value == value.strip().lower():
                    return member
        return None


print(Status(" Active "))
print(Status("INACTIVE"))

try:
    Status("deleted")
except ValueError as error:
    print("ValueError:", error)
```

Результат:

```text
Status.ACTIVE
Status.INACTIVE
ValueError: 'deleted' is not a valid Status
```

Якщо `_missing_` повертає `None`, це означає «однаково не знайдено», і генерується звичний `ValueError`.

## Налаштовуємо `str()`: `__str__`

За замовчуванням під час виведення елемента видно назву переліку й ім'я елемента:

```python
from enum import Enum


class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3


print(PaymentStatus.PENDING)
```

Результат:

```text
PaymentStatus.PENDING
```

Щоб показувати щось інше, перевизначте `__str__`. Його використовують `print()`, `str()`, f-рядки та `format()`:

```python
from enum import Enum


class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3

    def __str__(self):
        return f"{self.name.lower()}({self.value})"


print(PaymentStatus.PENDING)
print(f"Status: {PaymentStatus.COMPLETED}")
print(repr(PaymentStatus.PENDING))
```

Результат:

```text
pending(1)
Status: completed(2)
<PaymentStatus.PENDING: 1>
```

На `repr()` це не впливає. Зазвичай саме так і треба: `str()` — для користувачів, а `repr()` і далі показує повну, однозначну форму в налагоджувачах, журналах і списках елементів. `__repr__` теж можна перевизначити, але для цього рідко є причина.

## Порівняння із «сирими» значеннями: `__eq__` і `__hash__`

Елемент звичайного `Enum` ніколи не дорівнює своєму значенню, тож цей код нічого не виведе:

```python
from enum import Enum


class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3


if PaymentStatus.PENDING == 1:
    print("The payment is pending.")
```

Так задумано (див. тему «Перелік (Enum)»), але іноді перелік має працювати з кодом, який досі передає звичайні цілі числа. Тоді можна визначити `__eq__`:

```python
from enum import Enum


class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3

    def __eq__(self, other):
        if isinstance(other, int):
            return self.value == other
        if isinstance(other, PaymentStatus):
            return self is other
        return False


if PaymentStatus.PENDING == 1:
    print("The payment is pending.")

try:
    names = {PaymentStatus.PENDING: "waiting"}
except TypeError as error:
    print("TypeError:", error)
```

Результат:

```text
The payment is pending.
TypeError: cannot use 'PaymentStatus' as a dict key (unhashable type: 'PaymentStatus')
```

Порівняння працює, але елементи більше не можуть бути ключами словника чи елементами множини. Причина — загальне правило Python: **клас, який визначає `__eq__`, але не визначає `__hash__`, отримує `__hash__ = None`**, бо Python не може вгадати хеш, узгоджений із вашим новим уявленням про рівність. А елементи переліків постійно використовують як ключі, тож це ламає чимало коду.

Правильна версія визначає ще й `__hash__`, а для незнайомих типів повертає `NotImplemented`:

```python
from enum import Enum


class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3

    def __eq__(self, other):
        if isinstance(other, PaymentStatus):
            return self is other
        if isinstance(other, int):
            return self.value == other
        return NotImplemented

    def __hash__(self):
        return hash(self.value)


print(PaymentStatus.PENDING == 1, 1 == PaymentStatus.PENDING)
print(PaymentStatus.PENDING == "pending", PaymentStatus.PENDING != 2)

names = {PaymentStatus.PENDING: "waiting", PaymentStatus.COMPLETED: "paid"}
print(names[PaymentStatus.PENDING])
print(len({1, PaymentStatus.PENDING}))
```

Результат:

```text
True True
False True
waiting
1
```

- `__hash__` повертає `hash(self.value)`. Рівні об'єкти мусять мати рівні хеші, а `PENDING == 1`, тож `PENDING` має хешуватися так само, як `1`. Тому множина `{1, PaymentStatus.PENDING}` містить один елемент.
- `NotImplemented` каже Python: «я не вмію порівнювати з цим типом». Тоді Python пробує інший операнд, а зрештою порівнює ідентичність, тож `PENDING == "pending"` просто дає `False`.

> **Зверніть увагу:** коли елементи дорівнюють звичайним числам, частина безпеки, яку дають переліки, втрачається: випадкова `2` тепер непомітно вважається `COMPLETED`. Розгляньте інший варіант: перетворювати «сирі» значення на межах програми через `PaymentStatus(value)`. Або скористайтеся `IntEnum` (див. нижче), який робить усе це за вас.

## Упорядкування: `__lt__` і `@total_ordering`

Елементи звичайного переліку не підтримують `<`. Якщо ваші елементи мають природний порядок (очікування, потім завершення, потім повернення коштів), реалізуйте `__lt__`, і нехай `functools.total_ordering` виведе з нього та з `__eq__` оператори `<=`, `>` і `>=`:

```python
from enum import Enum
from functools import total_ordering


@total_ordering
class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3

    def __eq__(self, other):
        if isinstance(other, PaymentStatus):
            return self is other
        if isinstance(other, int):
            return self.value == other
        return NotImplemented

    def __hash__(self):
        return hash(self.value)

    def __lt__(self, other):
        if isinstance(other, PaymentStatus):
            return self.value < other.value
        if isinstance(other, int):
            return self.value < other
        return NotImplemented


status = 1
if status < PaymentStatus.COMPLETED:
    print("The payment has not completed")

status = PaymentStatus.PENDING
if status >= PaymentStatus.COMPLETED:
    print("The payment is not pending")

print(sorted([PaymentStatus.REFUNDED, PaymentStatus.PENDING, PaymentStatus.COMPLETED]))
print(max(PaymentStatus))

try:
    PaymentStatus.PENDING < "abc"
except TypeError as error:
    print("TypeError:", error)
```

Результат:

```text
The payment has not completed
[<PaymentStatus.PENDING: 1>, <PaymentStatus.COMPLETED: 2>, <PaymentStatus.REFUNDED: 3>]
PaymentStatus.REFUNDED
TypeError: '<' not supported between instances of 'PaymentStatus' and 'str'
```

`1 < PaymentStatus.COMPLETED` працює, хоча ціле число стоїть ліворуч. `int` не вміє порівнювати себе з `PaymentStatus`, тож Python пробує віддзеркалену операцію `PaymentStatus.COMPLETED > 1`, яку `total_ordering` побудував із `__lt__` та `__eq__`.

### Чому `NotImplemented`, а не `False`

Повертати `False` для незнайомих типів здається безпечним. Але з `total_ordering` це дає нісенітниці, бо похідний `__gt__` обчислюється як «не менше і не дорівнює»:

```python
from enum import Enum
from functools import total_ordering


@total_ordering
class Level(Enum):
    LOW = 1
    HIGH = 2

    def __lt__(self, other):
        if isinstance(other, Level):
            return self.value < other.value
        return False  # помилка: має бути NotImplemented


print(Level.LOW < "abc")
print(Level.LOW > "abc")
```

Результат:

```text
False
True
```

Виходить, що `LOW` більший за рядок. Якщо повертати `NotImplemented`, такі порівняння генерують `TypeError`, як і належить.

## Істинність: `__bool__`

За замовчуванням кожен елемент істинний, **навіть якщо його значення `0`, `""` чи `None`**:

```python
from enum import Enum


class Light(Enum):
    OFF = 0
    ON = 1


print(bool(Light.OFF), bool(Light.ON))
```

Результат:

```text
True True
```

Це можна змінити через `__bool__`. Припустімо, `if status:` має означати «гроші надійшли», а це правда лише для `COMPLETED`:

```python
from enum import Enum


class PaymentStatus(Enum):
    PENDING = 1
    COMPLETED = 2
    REFUNDED = 3

    def __str__(self):
        return f"{self.name.lower()}({self.value})"

    def __bool__(self):
        return self is PaymentStatus.COMPLETED


for member in PaymentStatus:
    print(member, bool(member))
```

Результат:

```text
pending(1) False
completed(2) True
refunded(3) False
```

Користуйтеся цим обережно. Хибний елемент дивує кожного, хто пише `if status:` у значенні «статус передали». Метод зі зрозумілою назвою, як-от `is_paid()`, часто читається легше.

## Елементи з додатковими даними

Значенням елемента може бути кортеж. Якщо перелік визначає `__init__`, кожен кортеж розпаковується в його аргументи, тож кожен елемент отримує власні атрибути:

```python
from enum import Enum


class Plan(Enum):
    FREE = (0, 1)
    PRO = (10, 5)
    TEAM = (25, 50)

    def __init__(self, price, max_users):
        self.price = price
        self.max_users = max_users

    @property
    def price_per_user(self):
        return self.price / self.max_users


print(Plan.PRO.price, Plan.PRO.max_users, Plan.PRO.value)
print(Plan.TEAM.price_per_user)
print(Plan((10, 5)))
```

Результат:

```text
10 5 (10, 5)
0.5
Plan.PRO
```

Значенням лишається весь кортеж, тож для пошуку за значенням теж потрібен кортеж. `__init__` виконується один раз для кожного елемента, коли створюється клас переліку.

## Розширення переліків через базовий клас без елементів

Як показано в темі «Перелік (Enum)», перелік з елементами не можна успадкувати:

```python
from enum import Enum


class Status(Enum):
    ACTIVE = 1


class ExtendedStatus(Status):
    DELETED = 2
```

Результат:

```text
Traceback (most recent call last):
  ...
TypeError: <enum 'ExtendedStatus'> cannot extend <enum 'Status'>
```

Насправді це не обмеження. Винесіть спільну поведінку в перелік **без елементів** і успадковуйте від нього скільки завгодно. Ось базовий перелік, що впорядковує елементи за значенням:

```python
from enum import Enum
from functools import total_ordering


@total_ordering
class OrderedEnum(Enum):
    def __lt__(self, other):
        if type(self) is type(other):
            return self.value < other.value
        return NotImplemented


class ApprovalStatus(OrderedEnum):
    PENDING = 1
    IN_PROGRESS = 2
    APPROVED = 3


class Priority(OrderedEnum):
    LOW = 1
    HIGH = 2


status = ApprovalStatus(2)
if status < ApprovalStatus.APPROVED:
    print("The request has not been approved.")

print(sorted([Priority.HIGH, Priority.LOW]))

try:
    ApprovalStatus.PENDING < Priority.HIGH
except TypeError as error:
    print("TypeError:", error)
```

Результат:

```text
The request has not been approved.
[<Priority.LOW: 1>, <Priority.HIGH: 2>]
TypeError: '<' not supported between instances of 'ApprovalStatus' and 'Priority'
```

- `OrderedEnum` не має елементів, тож і `ApprovalStatus`, і `Priority` можуть його розширити й отримати `<`, `<=`, `>` та `>=`.
- Перевірка `type(self) is type(other)` дозволяє порівнювати лише **в межах одного переліку**. Слабша перевірка `isinstance(other, OrderedEnum)` охоче порівняла б статус погодження з пріоритетом, бо обидва значення — цілі числа, а це позбавлено сенсу.

## Готові альтернативи: `IntEnum` і `StrEnum`

У стандартній бібліотеці вже є переліки, елементи яких **є** цілими числами або рядками:

- `IntEnum`: елементи — підкласи `int`. Вони порівнюються, сортуються й хешуються як цілі числа.
- `StrEnum` (Python 3.11+): елементи — підкласи `str`. `str()` і f-рядки дають саме значення, що зручно для JSON, URL-адрес і баз даних.

```python
from enum import IntEnum, StrEnum


class Priority(IntEnum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3


class Color(StrEnum):
    RED = "red"
    GREEN = "green"


print(Priority.HIGH > Priority.LOW, Priority.MEDIUM == 2)
print(sorted([3, Priority.LOW]), Priority.HIGH + 1)
print(f"{Color.RED}", Color.RED == "red", Color.RED.upper())
```

Результат:

```text
True True
[<Priority.LOW: 1>, 3] 4
red True RED
```

Обирайте відповідний інструмент: якщо вам потрібно лише, щоб «елементи поводилися як їхні значення int чи str», `IntEnum`/`StrEnum` замінюють написані вручну `__eq__`, `__hash__` і `__lt__` з цієї теми. Ціна — типобезпека: елемент `IntEnum` дорівнює *будь-якому* цілому числу з тим самим значенням, зокрема елементам непов'язаних класів `IntEnum`, і підтримує арифметику, яка може не мати сенсу (`Priority.HIGH + 1`). Пишіть власні методи, коли потрібен точний контроль над тим, що з чим можна порівнювати.

## Типові помилки

- **Визначати `__eq__` без `__hash__`.** Елементи стають нехешованими й більше не можуть бути ключами словника чи елементами множини. Додайте `__hash__`, узгоджений з `__eq__`.
- **Повертати `False` замість `NotImplemented`** з `__eq__`/`__lt__` для незнайомих типів. Із `@total_ordering` це дає хибні відповіді, як-от `Level.LOW > "abc"`, що дорівнює `True`.
- **Порівнювати елементи різних переліків**, бо перевірка в базовому класі використовує `isinstance(other, Base)`. Використовуйте `type(self) is type(other)`.
- **Намагатися розширити перелік, який має елементи.** Натомість винесіть спільні методи в базовий перелік без елементів.
- **Випадково додати константу в тіло переліку.** Кожне звичайне значення, присвоєне в тілі, стає елементом (або псевдонімом, якщо значення повторюється). «Допоміжна» константа `DEFAULT = 1` непомітно стає псевдонімом елемента зі значенням `1`. Використайте `enum.nonmember(1)` (Python 3.11+) або оголосіть константу поза переліком.
- **Несподівана істинність.** Власний `__bool__`, через який деякі елементи стають хибними, ламає перевірки `if status:`, що мали означати лише «не `None`». Віддавайте перевагу `if status is not None:` та методам із назвами.

## Підсумок

- Переліки — це класи: до них можна додавати методи, властивості й методи класу; елементами стають лише звичайні значення.
- Перевизначте `__str__`, щоб змінити те, що показують `print()` і f-рядки; `repr()` зберігає повну форму.
- `_missing_` дає змогу `Enum(value)` приймати альтернативні вхідні дані, перш ніж згенерувати `ValueError`.
- Якщо визначаєте `__eq__`, визначте й узгоджений із ним `__hash__`, інакше елементи стануть нехешованими.
- Реалізуйте `__lt__` разом із `@total_ordering`, щоб елементи можна було сортувати, і повертайте `NotImplemented` для непідтримуваних типів.
- `__bool__` керує істинністю; за замовчуванням кожен елемент істинний.
- Завдяки значенням-кортежам і `__init__` кожен елемент може мати кілька атрибутів.
- Діліться поведінкою через базовий перелік без елементів; використовуйте `IntEnum`/`StrEnum`, коли елементи мають просто поводитися як цілі числа чи рядки.

## Практика

### Вправа 1: Дні тижня з поведінкою

Оголосіть перелік `Weekday` з елементами від `MON` до `SUN` (значення від `1` до `7`). Додайте:

- властивість `is_weekend`, що дорівнює `True` для `SAT` і `SUN`;
- метод `next()`, що повертає наступний день, причому `SUN.next()` повертає `MON`.

Виведіть `is_weekend` для `FRI` і `SAT`, а також результати `FRI.next()` і `SUN.next()`.

### Вправа 2: Меню кав'ярні

Оголосіть перелік `Coffee`, елементи якого містять ціну й об'єм у мілілітрах: `ESPRESSO = (45, 30)`, `LATTE = (70, 300)`, `CAPPUCCINO = (65, 250)`. Додайте:

- `__init__`, що зберігає `price` і `ml`;
- властивість `price_per_100ml`, округлену до 2 знаків після коми;
- `__str__`, що повертає, наприклад, `Latte (300 ml)`.

Виведіть кожну каву через `print()` разом із ціною за 100 мл, а потім виведіть найдешевшу за мілілітр каву за допомогою `min()` із `key`.

### Вправа 3: Базовий клас для впорядкування

Напишіть базовий перелік без елементів `OrderedEnum` із `@total_ordering` і методом `__lt__`, який порівнює елементи одного переліку за значенням, а в інших випадках повертає `NotImplemented`. Використайте його для двох переліків: `Severity` (`INFO = 1`, `WARNING = 2`, `ERROR = 3`) і `Size` (`S = 1`, `M = 2`, `L = 3`). Покажіть, що:

- `Severity.ERROR >= Severity.WARNING` дорівнює `True`;
- `max()` і `sorted()` працюють для `Size`;
- `Severity.INFO < Size.L` генерує `TypeError`.

### Вправа 4: Знайдіть і виправте помилки

Цей перелік мав би порівнюватися з цілими числами й підтримувати сортування. Запустіть код, поясніть обидві проблеми та виправте клас так, щоб словник працював, а порівняння з рядком генерувало `TypeError`.

```python
from enum import Enum
from functools import total_ordering


@total_ordering
class Grade(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3

    def __eq__(self, other):
        if isinstance(other, int):
            return self.value == other
        return self is other

    def __lt__(self, other):
        if isinstance(other, Grade):
            return self.value < other.value
        if isinstance(other, int):
            return self.value < other
        return False


print(Grade.MEDIUM == 2)
print(Grade.HIGH >= "A")
try:
    colors = {Grade.LOW: "red", Grade.HIGH: "green"}
except TypeError as error:
    print("TypeError:", error)
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

    @property
    def is_weekend(self):
        return self in (Weekday.SAT, Weekday.SUN)

    def next(self):
        return Weekday(self.value % 7 + 1)


print(Weekday.FRI.is_weekend, Weekday.SAT.is_weekend)
print(Weekday.FRI.next(), Weekday.SUN.next())
```

Результат:

```text
False True
Weekday.SAT Weekday.MON
```

`self.value % 7 + 1` перетворює `1..6` на `2..7`, а `7` — знову на `1`, і `Weekday(...)` перетворює число на елемент.

### Вправа 2

```python
from enum import Enum


class Coffee(Enum):
    ESPRESSO = (45, 30)
    LATTE = (70, 300)
    CAPPUCCINO = (65, 250)

    def __init__(self, price, ml):
        self.price = price
        self.ml = ml

    @property
    def price_per_100ml(self):
        return round(self.price / self.ml * 100, 2)

    def __str__(self):
        return f"{self.name.title()} ({self.ml} ml)"


for coffee in Coffee:
    print(coffee, coffee.price_per_100ml)

print("Best value:", min(Coffee, key=lambda c: c.price / c.ml))
```

Результат:

```text
Espresso (30 ml) 150.0
Latte (300 ml) 23.33
Cappuccino (250 ml) 26.0
Best value: Latte (300 ml)
```

### Вправа 3

```python
from enum import Enum
from functools import total_ordering


@total_ordering
class OrderedEnum(Enum):
    def __lt__(self, other):
        if type(self) is type(other):
            return self.value < other.value
        return NotImplemented


class Severity(OrderedEnum):
    INFO = 1
    WARNING = 2
    ERROR = 3


class Size(OrderedEnum):
    S = 1
    M = 2
    L = 3


print(Severity.ERROR >= Severity.WARNING)
print(max(Size), sorted([Size.L, Size.S, Size.M]))

try:
    Severity.INFO < Size.L
except TypeError as error:
    print("TypeError:", error)
```

Результат:

```text
True
Size.L [<Size.S: 1>, <Size.M: 2>, <Size.L: 3>]
TypeError: '<' not supported between instances of 'Severity' and 'Size'
```

### Вправа 4

Початковий код виводить:

```text
True
True
TypeError: cannot use 'Grade' as a dict key (unhashable type: 'Grade')
```

- `Grade.HIGH >= "A"` дорівнює `True`: `total_ordering` обчислює `>=` як «не менше», а `__lt__` для рядка повертає `False` замість `NotImplemented`.
- Словник не створюється, бо клас визначає `__eq__` без `__hash__`, тож Python встановив `__hash__` у `None`.

Виправлений клас:

```python
from enum import Enum
from functools import total_ordering


@total_ordering
class Grade(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3

    def __eq__(self, other):
        if isinstance(other, Grade):
            return self is other
        if isinstance(other, int):
            return self.value == other
        return NotImplemented

    def __hash__(self):
        return hash(self.value)

    def __lt__(self, other):
        if isinstance(other, Grade):
            return self.value < other.value
        if isinstance(other, int):
            return self.value < other
        return NotImplemented


print(Grade.MEDIUM == 2)
try:
    Grade.HIGH >= "A"
except TypeError as error:
    print("TypeError:", error)

colors = {Grade.LOW: "red", Grade.HIGH: "green"}
print(colors[Grade.HIGH], sorted(Grade, reverse=True))
```

Результат:

```text
True
TypeError: '>=' not supported between instances of 'Grade' and 'str'
green [<Grade.HIGH: 3>, <Grade.MEDIUM: 2>, <Grade.LOW: 1>]
```

---

*Джерело: [pythontutorial.net — Customizing and Extending Python Enum Class](https://www.pythontutorial.net/python-oop/python-enum-class/). Адаптовано й доповнено для PyJourney.*
