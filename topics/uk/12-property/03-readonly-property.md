# Властивості лише для читання

**Властивість лише для читання** (read-only property) має гетер, але не має сетера: код може прочитати `obj.x`, але `obj.x = ...` генерує помилку. Такі властивості — природний спосіб відкрити доступ до значень, які не можна перепризначати ззовні (наприклад, ідентифікатор), а також значення, **обчислювані** з інших атрибутів, як-от площу кола.

## Що ви дізнаєтесь

- Як зробити властивість доступною лише для читання і що буде, коли хтось спробує її змінити
- Чому «лише для читання» в Python — це домовленість, а не справжній захист
- Що таке обчислювані властивості й коли варто обрати властивість, а не метод
- Як кешувати дороге обчислення у властивості й скидати кеш, коли змінюються вхідні дані
- Як працює `functools.cached_property` і чим він відрізняється від властивості лише для читання

## Властивість лише з гетером

Якщо оголосити властивість через `@property` і не додати `@<name>.setter`, у властивості не буде `fset`. Читання працює, а присвоєння й видалення — ні:

```python
class Order:
    def __init__(self, order_id, total):
        self._order_id = order_id
        self.total = total

    @property
    def order_id(self):
        return self._order_id


order = Order("A-1001", 250)
print(order.order_id)

order.total = 300  # звичайний атрибут можна змінювати
print(order.total)

try:
    order.order_id = "B-2002"
except AttributeError as error:
    print("AttributeError:", error)

try:
    del order.order_id
except AttributeError as error:
    print("AttributeError:", error)
```

Результат:

```text
A-1001
300
AttributeError: property 'order_id' of 'Order' object has no setter
AttributeError: property 'order_id' of 'Order' object has no deleter
```

Python 3.10 і старіші версії виводять коротші повідомлення `can't set attribute` і `can't delete attribute`.

Зверніть увагу: `__init__` присвоює `self._order_id`, а не `self.order_id`. У властивості лише для читання немає сетера навіть для самого класу, тож початкове значення записується напряму в атрибут-сховище. Це саме те місце, де писати в `_order_id` безпосередньо правильно.

> **Порада:** робіть атрибут доступним лише для читання, коли його зміна після створення зробила б об'єкт неузгодженим: номер замовлення, час створення, логін користувача. Значення, які цілком законно можуть змінюватися, нехай лишаються звичайними атрибутами або отримують сетер із перевіркою.

## «Лише для читання» — домовленість, а не замок

Властивість блокує публічне ім'я, але дані й далі лежать у звичайному атрибуті екземпляра. Ніщо не заважає коду записати туди значення:

```python
class Order:
    def __init__(self, order_id):
        self._order_id = order_id

    @property
    def order_id(self):
        return self._order_id


order = Order("A-1001")
order._order_id = "HACKED"
print(order.order_id)
```

Результат:

```text
HACKED
```

У Python немає справді приватних атрибутів. Підкреслення на початку означає «внутрішнє, не чіпати», а властивість лише для читання — «це значення не призначене для присвоєння». Разом вони запобігають **випадковим** помилкам і документують намір, але не зупинять того, хто свідомо полізе всередину. Це типовий для Python підхід: захищати користувачів від помилок, а не від них самих.

> **Зверніть увагу:** якщо незмінюваним має бути весь об'єкт, погляньте на `@dataclass(frozen=True)` або `typing.NamedTuple`. Вони блокують присвоєння всім полям, і це простіше, ніж писати властивість лише для читання для кожного з них.

## Обчислювані властивості

Властивість не зобов'язана повертати збережене значення. Вона може **обчислювати** його з інших атрибутів під час кожного читання. Ось коло з методом `area()`:

```python
import math


class Circle:
    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return math.pi * self.radius ** 2


c = Circle(10)
print(c.area())
```

Результат:

```text
314.1592653589793
```

Це працює, але площа — така сама характеристика кола, як і радіус, тож природніше читати її як атрибут. Позначте метод декоратором `@property`:

```python
import math


class Circle:
    def __init__(self, radius):
        self.radius = radius

    @property
    def area(self):
        return math.pi * self.radius ** 2


c = Circle(10)
print(c.area)

c.radius = 1
print(c.area)

try:
    c.area = 100
except AttributeError as error:
    print("AttributeError:", error)
```

Результат:

```text
314.1592653589793
3.141592653589793
AttributeError: property 'area' of 'Circle' object has no setter
```

`area` — це **обчислювана** (computed, calculated) властивість. Оскільки вона щоразу перераховується з `radius`, вона завжди актуальна: немає збереженої площі, яка могла б розійтися з радіусом. До того ж вона природно доступна лише для читання, адже «встановити площу 100» не має очевидного змісту.

### Властивість чи метод?

І `c.area`, і `c.area()` — коректні варіанти дизайну. Поширене емпіричне правило:

| Обирайте властивість, коли... | Обирайте метод, коли... |
|---|---|
| значення — характеристика об'єкта (іменник: `area`, `full_name`, `is_empty`) | виклик виконує дію (дієслово: `save()`, `send()`, `resize()`) |
| його дешево обчислити | обчислення повільне, працює з введенням-виведенням або може завершитися невдачею із зовнішніх причин |
| аргументи не потрібні | потрібні аргументи |
| читання не має побічних ефектів | виклик змінює стан |

Код, який читає `obj.area`, очікує миттєвого й безпечного доступу до атрибута. Запит до бази даних чи довге обчислення, сховані за властивістю, неприємно дивують читача.

## Кешування обчислюваної властивості

Обчислювана властивість перераховує значення під час кожного читання. Для `math.pi * r ** 2` це нічого не коштує. Але якщо обчислення дороге, наприклад розбір великого файлу чи агрегування тисяч записів, повторювати його щоразу марнотратно. Розв'язок — **кешування**:

1. Під час першого звернення зберегти обчислене значення в приватному атрибуті (кеші).
2. Під час наступних читань повертати збережене значення.
3. Скидати кеш щоразу, коли змінюються вхідні дані обчислення.

Найважчий тут крок 3. Якби `radius` був звичайним атрибутом, клас ніколи б не дізнався про його зміну. Тому `radius` теж стає властивістю, а її сетер скидає кеш. `print()` усередині `area` потрібен лише для того, щоб показати, коли обчислення справді виконується:

```python
import math


class Circle:
    def __init__(self, radius):
        self.radius = radius

    @property
    def radius(self):
        return self._radius

    @radius.setter
    def radius(self, value):
        if value < 0:
            raise ValueError("The radius cannot be negative")
        self._radius = value
        self._area = None  # скидаємо кеш

    @property
    def area(self):
        if self._area is None:
            print("computing the area...")
            self._area = math.pi * self._radius ** 2
        return self._area


c = Circle(10)
print(c.area)
print(c.area)

c.radius = 2
print(c.area)

try:
    c.radius = -1
except ValueError as error:
    print("ValueError:", error)
print(c.radius)
```

Результат:

```text
computing the area...
314.1592653589793
314.1592653589793
computing the area...
12.566370614359172
ValueError: The radius cannot be negative
2
```

Як це працює:

- `__init__` присвоює `self.radius`, тож спрацьовує сетер: він перевіряє значення і створює порожній кеш `_area = None`.
- Перше читання `area` бачить порожній кеш, обчислює значення і зберігає його. Друге читання повертає збережене значення без обчислень.
- Присвоєння нового радіуса скидає кеш, тож наступне читання знову обчислює площу.
- Некоректний радіус відхиляється ще до будь-яких змін, тож старий радіус і закешована площа лишаються правильними.

> **Зверніть увагу:** `None` тут годиться як позначка «ще не обчислено», бо справжня площа ніколи не дорівнює `None`. Якщо `None` може бути коректним результатом, використайте окремий об'єкт-позначку, наприклад `_MISSING = object()`, і перевіряйте `if self._area is _MISSING`.

## `functools.cached_property`

У стандартній бібліотеці є готовий декоратор для схеми «обчислити один раз і запам'ятати»: `functools.cached_property` (Python 3.8+). Під час першого читання він викликає ваш метод і зберігає результат у `__dict__` екземпляра **під тим самим ім'ям**. Наступні читання знаходять значення в `__dict__` і більше не викликають метод:

```python
from functools import cached_property


class Dataset:
    def __init__(self, values):
        self.values = list(values)

    @cached_property
    def mean(self):
        print("computing the mean...")
        return sum(self.values) / len(self.values)


data = Dataset([3, 5, 10])
print(data.mean)
print(data.mean)
print(data.__dict__)

data.values.append(100)
print(data.mean)  # застаріле значення: кеш нічого не знає про зміну

del data.mean     # видаляємо закешоване значення
print(data.mean)

data.mean = 0     # присвоєння дозволене
print(data.mean)
```

Результат:

```text
computing the mean...
6.0
6.0
{'values': [3, 5, 10], 'mean': 6.0}
6.0
computing the mean...
29.5
0
```

Важливі відмінності від властивості лише для читання:

- **Він не лише для читання.** `cached_property` — це дескриптор без `__set__` (non-data descriptor), тож значення в `__dict__` екземпляра має перевагу, а присвоєння просто перезаписує кеш.
- **Він ніколи не оновлюється сам.** Коли вхідні дані змінюються, закешоване значення застаріває, доки ви його не видалите через `del`. Він підходить для значень, що залежать від даних, які після створення не змінюються.
- **Йому потрібен `__dict__` екземпляра.** Класи з `__slots__` без `__dict__` генерують `TypeError` під час першого читання.

> **Зверніть увагу:** до Python 3.12 `cached_property` використовував внутрішнє блокування (lock), щоб метод виконувався лише раз навіть за наявності багатьох потоків. У 3.12 блокування прибрали; тепер у багатопотоковому коді метод може виконатися для того самого об'єкта більше одного разу, тож якщо це важливо, додайте власне блокування.

Як вибрати з трьох інструментів:

| Інструмент | Коли обчислюється | Чи можна присвоїти | Чи оновлюється після зміни вхідних даних |
|---|---|---|---|
| `@property` (лише гетер) | під час кожного читання | ні | завжди актуальна |
| `@property` з ручним кешем | один раз, до скидання | ні | якщо ваші сетери скидають кеш |
| `@cached_property` | один раз | так | лише після `del obj.name` |

## Типові помилки

- **Присвоювати властивість лише для читання в `__init__`.** `self.order_id = order_id` проходить через властивість, а сетера в неї немає:

  ```python
  class Order:
      def __init__(self, order_id):
          self.order_id = order_id

      @property
      def order_id(self):
          return self._order_id


  try:
      Order("A-1001")
  except AttributeError as error:
      print("AttributeError:", error)
  ```

  Результат:

  ```text
  AttributeError: property 'order_id' of 'Order' object has no setter
  ```

  Натомість присвоюйте атрибут-сховище (`self._order_id = order_id`).

- **Кешувати без скидання.** Якщо вхідні дані обчислення — звичайний атрибут, його зміна не скидає кеш, і властивість повертає застаріле значення:

  ```python
  import math


  class Circle:
      def __init__(self, radius):
          self.radius = radius  # звичайний атрибут, без сетера
          self._area = None

      @property
      def area(self):
          if self._area is None:
              self._area = math.pi * self.radius ** 2
          return self._area


  c = Circle(10)
  print(round(c.area, 2))
  c.radius = 1
  print(round(c.area, 2))  # досі площа для радіуса 10
  ```

  Результат:

  ```text
  314.16
  314.16
  ```

  Кожне вхідне значення закешованого результату має змінюватися лише через код, що скидає кеш.

- **Вважати «лише для читання» захистом.** Атрибут із підкресленням однаково можна змінити. Властивості лише для читання запобігають випадковостям, а не свідомим змінам.
- **Класти у властивість повільний код або код із побічними ефектами.** Для цього краще підходить метод із дієсловом у назві.
- **Очікувати, що `cached_property` доступний лише для читання чи оновлюється сам.** Його можна перезаписати, а скидати доводиться вручну через `del`.
- **Кешувати дешеві значення.** Кеш додає стан і ризик застарілих даних. Кешуйте лише справді дорогі обчислення.

## Підсумок

- Властивість без сетера доступна лише для читання: присвоєння генерує `AttributeError: property '...' of '...' object has no setter`, а `del` завершується так само.
- Ініціалізуйте атрибут-сховище (`self._x`) напряму в `__init__`, бо у властивості немає сетера.
- «Лише для читання» — це домовленість: атрибут із підкресленням усе одно можна змінити навмисно.
- Обчислювана властивість виводить своє значення з інших атрибутів під час кожного читання, тож вона завжди з ними узгоджена.
- Властивості підходять для дешевих характеристик без аргументів, методи — для дій і важкої роботи.
- Щоб кешувати дороге обчислення, зберігайте результат у приватному атрибуті та скидайте його в сетерах усіх вхідних даних.
- `functools.cached_property` обчислює значення один раз і зберігає його в `__dict__` екземпляра; його можна перезаписати, він ніколи не оновлюється сам і скидається через `del`.

## Практика

### Вправа 1: Прямокутник

Напишіть клас `Rectangle` зі звичайними атрибутами `width` і `height` та двома обчислюваними властивостями лише для читання: `area` і `perimeter`. Покажіть, що обидві оновлюються після зміни `width`, а `r.area = 10` генерує `AttributeError`.

### Вправа 2: Банківський рахунок

Напишіть клас `BankAccount`, у якого є:

- властивість лише для читання `number` (задається один раз в `__init__`);
- властивість лише для читання `balance`, що спочатку дорівнює `0`;
- методи `deposit(amount)` і `withdraw(amount)`, які змінюють баланс. Обидва відхиляють недодатні суми через `ValueError("Amount must be positive")`, а `withdraw` генерує `ValueError("Insufficient funds")`, якщо баланс став би від'ємним.

Покажіть, що баланс змінюється лише через методи, а `account.balance = 1_000_000` завершується помилкою.

### Вправа 3: Ліниве обчислення кількості слів

Напишіть клас `Document` із властивістю `text` (гетер і сетер) та властивістю лише для читання `word_count`, яка обчислюється ліниво й кешується. Рахуйте в атрибуті `computations`, скільки разів слова справді підраховувалися. Два читання `word_count` мають дати один підрахунок; присвоєння нового `text` має скидати кеш.

### Вправа 4: Передбачте результат

Передбачте кожен рядок, потім запустіть код.

```python
from functools import cached_property


class Profile:
    def __init__(self, first, last):
        self.first = first
        self.last = last

    @property
    def full_name(self):
        return f"{self.first} {self.last}"

    @cached_property
    def initials(self):
        return self.first[0] + self.last[0]


p = Profile("Ada", "Lovelace")
print(p.full_name, p.initials)

p.first = "Grace"
print(p.full_name, p.initials)

p.initials = "??"
print(p.initials)

try:
    p.full_name = "Alan Turing"
except AttributeError as error:
    print("AttributeError:", error)

del p.initials
print(p.initials)
```

## Розв'язки

### Вправа 1

```python
class Rectangle:
    def __init__(self, width, height):
        self.width = width
        self.height = height

    @property
    def area(self):
        return self.width * self.height

    @property
    def perimeter(self):
        return 2 * (self.width + self.height)


r = Rectangle(3, 4)
print(r.area, r.perimeter)

r.width = 10
print(r.area, r.perimeter)

try:
    r.area = 10
except AttributeError as error:
    print("AttributeError:", error)
```

Результат:

```text
12 14
40 28
AttributeError: property 'area' of 'Rectangle' object has no setter
```

### Вправа 2

```python
class BankAccount:
    def __init__(self, number):
        self._number = number
        self._balance = 0

    @property
    def number(self):
        return self._number

    @property
    def balance(self):
        return self._balance

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("Amount must be positive")
        self._balance += amount

    def withdraw(self, amount):
        if amount <= 0:
            raise ValueError("Amount must be positive")
        if amount > self._balance:
            raise ValueError("Insufficient funds")
        self._balance -= amount


account = BankAccount("UA-001")
account.deposit(500)
account.withdraw(200)
print(account.number, account.balance)

for action in (lambda: account.withdraw(1000),
               lambda: account.deposit(-5)):
    try:
        action()
    except ValueError as error:
        print("ValueError:", error)

try:
    account.balance = 1_000_000
except AttributeError as error:
    print("AttributeError:", error)
print(account.balance)
```

Результат:

```text
UA-001 300
ValueError: Insufficient funds
ValueError: Amount must be positive
AttributeError: property 'balance' of 'BankAccount' object has no setter
300
```

Для користувачів класу баланс доступний лише для читання, але власні методи класу змінюють `_balance`. Так кожна зміна проходить через перевірки в `deposit()` і `withdraw()`.

### Вправа 3

```python
class Document:
    def __init__(self, text):
        self.computations = 0
        self.text = text

    @property
    def text(self):
        return self._text

    @text.setter
    def text(self, value):
        self._text = value
        self._word_count = None  # скидаємо кеш

    @property
    def word_count(self):
        if self._word_count is None:
            self.computations += 1
            self._word_count = len(self._text.split())
        return self._word_count


doc = Document("Readonly properties are simple")
print(doc.word_count, doc.word_count, doc.computations)

doc.text = "Now the text is a bit longer than before"
print(doc.word_count, doc.word_count, doc.computations)

try:
    doc.word_count = 0
except AttributeError as error:
    print("AttributeError:", error)
```

Результат:

```text
4 4 1
9 9 2
AttributeError: property 'word_count' of 'Document' object has no setter
```

`computations` задається раніше за `self.text`, тож коли спрацьовує сетер, цей атрибут уже існує. Кожен текст підраховується рівно один раз, хоч би скільки разів читали `word_count`.

### Вправа 4

Результат:

```text
Ada Lovelace AL
Grace Lovelace AL
??
AttributeError: property 'full_name' of 'Profile' object has no setter
GL
```

- `full_name` — звичайна обчислювана властивість, тож вона одразу відображає нове значення `first`.
- `initials` закешувалося під час першого читання й не помічає зміни, тож досі показує `AL`.
- `cached_property` можна присвоювати, тому `p.initials = "??"` просто замінює закешоване значення.
- У `full_name` немає сетера, тож присвоєння завершується помилкою.
- `del p.initials` видаляє закешоване значення, і наступне читання обчислює `GL` з поточних імен.

---

*Джерело: [pythontutorial.net — Python Readonly Property](https://www.pythontutorial.net/python-oop/python-readonly-property/). Адаптовано й доповнено для PyJourney.*
