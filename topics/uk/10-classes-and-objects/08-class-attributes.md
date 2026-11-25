# Атрибути класу

**Атрибут класу** (class attribute) визначається один раз, у тілі класу, і спільний для всіх екземплярів цього класу. Теми «Змінні класу» та «Змінні екземпляра» показали, як атрибути класу зберігаються і як Python їх шукає. Ця тема про те, як ними правильно користуватися: як вирішити, що належить класу, а що кожному об'єкту, як правильно читати атрибути класу всередині методів і які три класичні задачі вони розв'язують.

## Що ви дізнаєтесь

- Як визначити, чи мають дані бути атрибутом екземпляра, чи атрибутом класу
- Як Python знаходить атрибут, коли ви читаєте його через екземпляр або через клас
- Три типові застосування: константи класу, дані, спільні для всіх екземплярів, і типові значення
- Чим відрізняються `self.attr`, `ClassName.attr` і `type(self).attr` усередині методів і чому це важливо для підкласів
- Як реєстр екземплярів може спричинити витік пам'яті і як це виправляє `weakref.WeakSet`
- Чим атрибути класу відрізняються від статичних полів у Java чи C# і як позначати їх через `ClassVar`

## Атрибути екземпляра чи атрибути класу?

Ось простий клас `Circle`:

```python
class Circle:
    def __init__(self, radius):
        self.pi = 3.14159
        self.radius = radius

    def area(self):
        return self.pi * self.radius**2

    def circumference(self):
        return 2 * self.pi * self.radius


small = Circle(1)
big = Circle(10)
print(vars(small))
print(vars(big))
print(big.area(), big.circumference())

small.pi = 3  # ніщо не заважає одному колу мати інше значення pi
print(small.area(), Circle(1).area())
```

Результат:

```text
{'pi': 3.14159, 'radius': 1}
{'pi': 3.14159, 'radius': 10}
314.159 62.8318
3 3.14159
```

І `pi`, і `radius` — **атрибути екземпляра**: `__init__` присвоює їх через `self`, тож кожне коло зберігає власну копію. Для `radius` це логічно, бо радіус справді різний у різних кіл. Для `pi` це не має сенсу:

- кожне коло носить копію одного й того самого числа;
- одне з кіл може отримати інше значення pi, а це явна помилка.

Поставте щодо кожного елемента даних одне запитання: **він описує саме цей об'єкт чи клас загалом?** Дані про клас загалом належать класу. Щоб зробити `pi` атрибутом класу, присвойте його в тілі класу, поза будь-яким методом:

```python
class Circle:
    pi = 3.14159

    def __init__(self, radius):
        self.radius = radius

    def area(self):
        return self.pi * self.radius**2

    def circumference(self):
        return 2 * self.pi * self.radius


c = Circle(10)
print(c.pi)
print(Circle.pi)
print(vars(c))
print(c.area(), c.circumference())
```

Результат:

```text
3.14159
3.14159
{'radius': 10}
314.159 62.8318
```

Тепер `pi` існує в одному примірнику, на класі, а `vars(c)` показує, що екземпляр зберігає лише свій радіус. Прочитати атрибут класу можна двома способами:

```text
екземпляр.атрибут_класу      c.pi
Клас.атрибут_класу           Circle.pi
```

Методи так само пишуть `self.pi`. Це працює, бо читання атрибута через екземпляр, не знайшовши його в екземплярі, переходить до класу, про що нагадує наступний розділ.

> **Порада:** у реальному коді використовуйте `math.pi`. `3.14159` тут лише приклад константи, що належить класу.

## Як Python знаходить атрибут

Коли ви читаєте атрибут **через екземпляр**, Python спершу шукає його серед власних атрибутів екземпляра, потім у його класі, потім у батьківських класах. Коли ви читаєте атрибут **через клас**, екземпляр узагалі не бере участі: Python починає із самого класу й продовжує в батьківських. Якщо нічого не знайдено, виникає `AttributeError`.

Тож атрибут екземпляра з тим самим іменем **затіняє** (shadows) атрибут класу для цього одного екземпляра:

```python
class Test:
    x = 10

    def __init__(self):
        self.x = 20


test = Test()
print(test.x)  # 20
print(Test.x)  # 10
```

`Test` має два атрибути з іменем `x`: один на класі (`10`) і по одному на кожному екземплярі (`20`). `test.x` першим знаходить атрибут екземпляра. `Test.x` звертається безпосередньо до класу. Тема «Змінні екземпляра» розбирає цей пошук крок за кроком.

## Читання атрибутів класу в методах

Метод має три способи дістатися до атрибута класу, і вони дають різні відповіді, щойно з'являються підкласи чи атрибути екземпляра:

```python
class Product:
    default_discount = 0

    def __init__(self, price):
        self.price = price

    def discounts(self):
        return (
            Product.default_discount,     # завжди значення з Product
            type(self).default_discount,  # значення з класу об'єкта
            self.default_discount,        # спершу об'єкт, потім його клас
        )


class SaleProduct(Product):
    default_discount = 0.1  # перевизначає успадковане значення


item = SaleProduct(100)
print(item.discounts())

item.default_discount = 0.5  # атрибут екземпляра затіняє обидва класи
print(item.discounts())
```

Результат:

```text
(0, 0.1, 0.1)
(0, 0.1, 0.5)
```

| Вираз | Де шукає | Коли використовувати |
|---|---|---|
| `self.attr` | в екземплярі, потім у його класі, потім у батьківських | коли потрібне найконкретніше значення і підклас чи окремий об'єкт можуть його перевизначити. Це звичайний вибір для **читання** |
| `type(self).attr` | у справжньому класі об'єкта, потім у батьківських, ігноруючи екземпляр | коли потрібне значення рівня класу, навіть якщо екземпляр його затіняє |
| `ClassName.attr` | саме в цьому класі, потім у його батьківських | коли маєте на увазі одне конкретне спільне значення, яке підкласи не повинні підміняти, наприклад глобальний лічильник |

Для **запису** ніколи не використовуйте `self.attr = ...` чи `self.attr += 1`: так створюється атрибут екземпляра, а атрибут класу лишається незмінним (див. «Типові помилки»). Присвоюйте через клас. Через який саме — залежить від того, що ви хочете рахувати:

```python
class Shape:
    created = 0

    def __init__(self):
        Shape.created += 1        # один лічильник для всіх фігур
        type(self).made += 1      # окремий лічильник для кожного класу


class Square(Shape):
    made = 0


class Triangle(Shape):
    made = 0


Square()
Square()
Triangle()
print(Shape.created, Square.made, Triangle.made)
```

Результат:

```text
3 2 1
```

`Shape.created` завжди оновлює один лічильник на `Shape`. `type(self).made` оновлює лічильник того класу, екземпляр якого створено. Тут кожен підклас визначає власний `made`, а сам `Shape` призначений для використання лише через підкласи.

## Застосування 1: константи класу

Значення, однакове для всіх екземплярів, яке ніколи не змінюється, — природний атрибут класу. Розміщене на класі, воно отримує ім'я, одне місце для змін і зрозумілого власника:

```text
class Circle:            class HttpClient:            class Password:
    pi = 3.14159             TIMEOUT = 10                 MIN_LENGTH = 12
                             RETRIES = 3
```

Справжніх констант у Python немає. За домовленістю імена у `ВЕРХНЬОМУ_РЕГІСТРІ` означають «не змінюйте це». Інструменти перевірки типів, як-от mypy і pyright, можуть це контролювати, якщо анотувати атрибут через `typing.Final`, але під час виконання присвоєнню ніщо не заважає:

```python
from typing import Final


class Circle:
    PI: Final = 3.14159  # константа: інструменти перевірки типів забороняють її перевизначати


Circle.PI = 3  # mypy/pyright повідомлять тут про помилку, але Python це виконає
print(Circle.PI)
```

Результат:

```text
3
```

## Застосування 2: дані, спільні для всіх екземплярів

Іноді клас має знати про всі свої екземпляри або про щось, що їх об'єднує. Ця версія `Circle` веде список усіх створених кіл:

```python
class Circle:
    circle_list = []
    pi = 3.14159

    def __init__(self, radius):
        self.radius = radius
        # додаємо екземпляр до списку кіл
        self.circle_list.append(self)

    def area(self):
        return self.pi * self.radius**2

    def circumference(self):
        return 2 * self.pi * self.radius


c1 = Circle(10)
c2 = Circle(20)

print(len(Circle.circle_list))  # 2
print([c.radius for c in Circle.circle_list])
print(vars(c1))
```

Результат:

```text
2
[10, 20]
{'radius': 10}
```

`self.circle_list.append(self)` не створює атрибута екземпляра, бо нічого не *присвоює* `self.circle_list`. Він знаходить список класу й **змінює** його. `Circle.circle_list.append(self)` робить те саме, але одразу показує читачеві, що список спільний.

### Реєстр тримає об'єкти живими

Список зберігає **сильні посилання** (див. тему «Посилання»). Поки коло лежить у `circle_list`, його неможливо знищити, навіть коли решта програми про нього забула. У програмі, що працює довго, такий реєстр поступово з'їдає пам'ять. Якщо реєстр має відстежувати лише ті об'єкти, які ще використовуються, зберігайте в ньому **слабкі посилання** (weak references) за допомогою `weakref.WeakSet`:

```python
import weakref


class Circle:
    circle_list = []  # сильні посилання: тримає кожне коло живим

    def __init__(self, radius):
        self.radius = radius
        Circle.circle_list.append(self)


class TrackedCircle:
    alive = weakref.WeakSet()  # слабкі посилання: не тримає кола живими

    def __init__(self, radius):
        self.radius = radius
        TrackedCircle.alive.add(self)


c1, c2 = Circle(10), Circle(20)
t1, t2 = TrackedCircle(10), TrackedCircle(20)
del c2, t2

print("list:   ", [c.radius for c in Circle.circle_list])
print("WeakSet:", [t.radius for t in TrackedCircle.alive])
```

Результат (CPython):

```text
list:    [10, 20]
WeakSet: [10]
```

Після `del c2` друге коло й далі досяжне через список. Після `del t2` на той об'єкт більше ніщо не посилалося, тож його знищено, і він автоматично зник із `WeakSet`.

### Видача унікальних ідентифікаторів

Ще одне класичне спільне значення — лічильник, що дає кожному новому об'єкту унікальний номер:

```python
class Ticket:
    _next_id = 1  # ідентифікатор, який отримає наступний квиток

    def __init__(self, title):
        self.id = Ticket._next_id
        Ticket._next_id += 1
        self.title = title


tickets = [Ticket("Login fails"), Ticket("Typo on home page"), Ticket("Slow search")]
for t in tickets:
    print(t.id, t.title)
print("next id:", Ticket._next_id)
```

Результат:

```text
1 Login fails
2 Typo on home page
3 Slow search
next id: 4
```

`id` зберігається в кожному екземплярі (це дані конкретного квитка), а лічильник живе на класі (це дані про всі квитки). Підкреслення на початку позначає `_next_id` як внутрішній атрибут, як описано в темі «Приватні атрибути». Такий простий лічильник не потокобезпечний: якщо квитки створюють кілька потоків одночасно, захистіть збільшення блокуванням (див. тему «Блокування потоків: Lock»).

## Застосування 3: типові значення

Атрибут класу може задавати типове значення (default), з яким стартує кожен екземпляр. Тут кожен товар під час створення отримує типову знижку:

```python
class Product:
    default_discount = 0

    def __init__(self, price):
        self.price = price
        self.discount = Product.default_discount

    def set_discount(self, discount):
        self.discount = discount

    def net_price(self):
        return self.price * (1 - self.discount)


p1 = Product(100)
print(p1.net_price())

p2 = Product(200)
p2.set_discount(0.05)
print(p2.net_price())
```

Результат:

```text
100
190.0
```

Другий результат — `190.0`, а не `190`: `1 - 0.05` має тип `float`, тож і добуток теж `float`. Перший лишається `int`, бо `1 - 0` — це ціле число `1`.

Є й другий спосіб використати атрибут класу як типове значення: не копіювати його в `__init__` узагалі, а дозволити пошуку атрибута **переходити** до класу, доки екземпляр не встановить власне значення:

```python
class Product:
    discount = 0  # типове значення для кожного товару без власної знижки

    def __init__(self, price):
        self.price = price

    def net_price(self):
        return self.price * (1 - self.discount)


book = Product(100)
lamp = Product(200)
lamp.discount = 0.05  # лампа отримує власне значення

print(vars(book), vars(lamp))
print(book.net_price(), lamp.net_price())

Product.discount = 0.2  # розпродаж у всьому магазині
print(book.net_price(), lamp.net_price())
```

Результат:

```text
{'price': 100} {'price': 200, 'discount': 0.05}
100 190.0
80.0 190.0
```

Ці два стилі поводяться по-різному, коли атрибут класу згодом змінюється:

- **Перехід до класу** (цей приклад): кожен товар без власної знижки слідує за значенням класу, зокрема й товари, створені до зміни. Розпродаж одразу поширився на `book`.
- **Копіювання в `__init__`** (попередній приклад): кожен товар зберігає значення, отримане під час створення. Зміна типового значення впливає лише на товари, створені після неї:

```python
class Product:
    default_discount = 0

    def __init__(self, price):
        self.price = price
        self.discount = self.default_discount  # копіюється один раз, під час створення


book = Product(100)
Product.default_discount = 0.2
pen = Product(10)
print(book.discount, pen.discount)
```

Результат:

```text
0 0.2
```

Обирайте ту поведінку, яка вам потрібна. В обох випадках типові значення на рівні класу безпечні лише для **незмінюваних** значень: чисел, рядків, кортежів, `None`. Змінюване типове значення, наприклад список, — це один об'єкт, спільний для всіх екземплярів, тобто пастка, описана в темі «Змінні екземпляра».

## Атрибути класу та статичні поля в Java і C#

Атрибути класу схожі на поля `static` у Java чи C#, але це не те саме:

- **Присвоєння через екземпляр не змінює атрибута класу.** У Java `obj.count = 5` записує статичне поле. У Python `obj.count = 5` створює атрибут екземпляра, який його затіняє.
- **Підкласи можуть їх перевизначати.** Підклас, що присвоює те саме ім'я, отримує власний атрибут. Код, який читає `self.attr`, тоді бачить значення підкласу, як показав `SaleProduct`.
- **Це звичайні об'єкти, створені під час виконання.** Тіло класу виконується один раз, коли виконується інструкція `class`. Атрибути класу можна згодом додавати, змінювати чи видаляти, і жоден компілятор не перевіряє їхніх типів.

Те, що тіло класу виконується **один раз**, має наслідок, який дивує багатьох:

```python
import time
from datetime import datetime


class Order:
    created_at = datetime.now()  # обчислюється ОДИН раз, під час визначення класу

    def __init__(self, item):
        self.item = item


first = Order("book")
time.sleep(1.1)
second = Order("lamp")
print(first.created_at == second.created_at)
```

Результат:

```text
True
```

Обидва замовлення показують момент визначення класу, а не момент свого створення. Значення, які треба обчислювати для кожного об'єкта окремо, як-от позначку часу, слід задавати в `__init__`: `self.created_at = datetime.now()`.

## Анотації типів: `ClassVar`

У звичайному класі анотоване ім'я зі значенням у тілі класу однаково лишається атрибутом класу. Але деякі інструменти сприймають анотації як оголошення полів **екземпляра**. Найважливіший із них — `@dataclass` (згадується в темі «`__init__`: ініціалізація атрибутів екземпляра»), який перетворює кожне анотоване ім'я на параметр конструктора. Щоб оголосити там справжній атрибут класу, анотуйте його через `typing.ClassVar`:

```python
from dataclasses import dataclass
from typing import ClassVar


@dataclass
class Circle:
    radius: float
    pi: ClassVar[float] = 3.14159  # атрибут класу, а не поле

    def area(self):
        return self.pi * self.radius**2


@dataclass
class BrokenCircle:
    radius: float = 1.0
    pi: float = 3.14159  # халепа: це стає полем кожного екземпляра


print(Circle(2), Circle(2).area())
print(BrokenCircle(2))
print(BrokenCircle(2, 3))
```

Результат:

```text
Circle(radius=2) 12.56636
BrokenCircle(radius=2, pi=3.14159)
BrokenCircle(radius=2, pi=3)
```

З `ClassVar` атрибут `pi` не є полем: його немає ні в `__init__`, ні в `repr`. Без `ClassVar` `pi` став звичайним полем, яке будь-хто може перевизначити під час виклику. Імена в тілі класу **без** анотації ніколи не стають полями, тож `pi = 3.14159` теж працювало б у dataclass. `ClassVar` робить намір явним і для читачів, і для інструментів перевірки типів.

## Типові помилки

- **Оновлювати спільне значення через `self`.** `self.count += 1` читає атрибут класу, але зберігає результат як новий атрибут екземпляра, тож атрибут класу ніколи не змінюється (тема «Об'єктно-орієнтоване програмування в Python» показує це крок за кроком). Пишіть `ClassName.count += 1` або `type(self).count += 1`.
- **Жорстко вписувати ім'я класу там, де підклас має мати змогу перевизначити значення.** `self.discount = Product.default_discount` ігнорує `default_discount` підкласу. Читайте через `self` (див. вправу 3).
- **Зберігати дані окремих екземплярів у змінюваному атрибуті класу.** Список чи словник у тілі класу спільний для всіх екземплярів. Створюйте його в `__init__`.
- **Дозволяти реєстру тримати всі об'єкти живими.** Список екземплярів на рівні класу — це витік пам'яті в програмі, що працює довго. Використовуйте `weakref.WeakSet` або явно видаляйте об'єкти.
- **Обчислювати значення окремих об'єктів у тілі класу.** `created_at = datetime.now()` у тілі класу виконується один раз. Перенесіть це в `__init__`.
- **Очікувати, що константи захищені.** `ВЕРХНІЙ_РЕГІСТР` і `Final` — домовленості, які перевіряють інструменти, а не Python під час виконання.
- **Забути `ClassVar` у dataclass.** Анотований атрибут класу стає полем конструктора.

## Підсумок

- Атрибут класу визначається в тілі класу, поза будь-яким методом, і спільний для всіх екземплярів. Атрибути екземпляра, присвоєні через `self`, належать одному об'єкту.
- Розміщуйте дані на класі, коли вони описують клас загалом: константи, дані про всі екземпляри, типові значення.
- Читайте атрибути класу через клас (`Circle.pi`) або через екземпляр (`c.pi`). Читання через екземпляр спершу перевіряє екземпляр, потім клас і його батьківські класи.
- Усередині методів `self.attr` враховує підкласи й перевизначення в екземплярі, `type(self).attr` — лише підкласи, а `ClassName.attr` завжди означає саме цей клас.
- Присвоюйте атрибутам класу значення через клас, ніколи через `self`.
- Типове значення на рівні класу можна скопіювати в `__init__` (фіксується під час створення) або використати як запасний варіант під час пошуку (слідує за подальшими змінами). Використовуйте лише незмінювані типові значення.
- Реєстри екземплярів тримають сильні посилання. Використовуйте `weakref.WeakSet`, коли реєстр не повинен тримати об'єкти живими.
- Тіло класу виконується один раз. У dataclass і в анотаціях типів позначайте атрибути класу через `ClassVar`.

## Практика

### Вправа 1: Передбачте результат

Запишіть чотири рядки, які виведе ця програма, а потім запустіть її й перевірте.

```python
class Animal:
    sound = "..."
    legs = 4

    def describe(self):
        return f"{type(self).__name__}: {self.sound}, {self.legs} legs (base: {Animal.sound})"


class Bird(Animal):
    sound = "tweet"
    legs = 2


class Dog(Animal):
    sound = "woof"


rex = Dog()
tweety = Bird()
tweety.legs = 1
print(rex.describe())
print(tweety.describe())
Animal.legs = 3
Animal.sound = "?"
print(rex.describe())
print(Bird().describe())
```

### Вправа 2: Номери рахунків

Створіть клас `Invoice` з константою класу `PREFIX = "INV"`, атрибутом класу `_next_number = 1001` і лічильником `issued = 0`. Кожен новий рахунок зберігає свою суму `amount` і отримує номер `number`, наприклад `"INV-1001"`, а лічильники оновлюються. Потім створіть підклас `CreditNote` з `PREFIX = "CN"`, який **використовує ту саму послідовність номерів**, що й рахунки, але має власний префікс. Створіть рахунки на 250 і 99, кредитове авізо на -99 і рахунок на 40 та виведіть їхні номери й суми, кількість виданих документів і наступний номер.

### Вправа 3: Виправте знижку на розпродаж

Товари з розпродажу мають коштувати половину ціни, але програма виводить повні ціни. Знайдіть помилку й виправте її. Потім дайте одному товару з розпродажу, кабелю за 10, особливу знижку 0,75, яка стосується лише цього об'єкта.

```python
class Product:
    default_discount = 0

    def __init__(self, name, price):
        self.name = name
        self.price = price
        self.discount = Product.default_discount

    def net_price(self):
        return self.price * (1 - self.discount)


class ClearanceItem(Product):
    default_discount = 0.5


for item in [Product("lamp", 80), ClearanceItem("old phone", 120)]:
    print(item.name, item.net_price())
```

### Вправа 4: Обмеження відкритих з'єднань

Напишіть клас `Connection` з константою класу `MAX_OPEN = 2` і атрибутом класу `_open` — множиною відкритих з'єднань `weakref.WeakSet`. `Connection(name)` генерує `RuntimeError`, якщо вже відкрито `MAX_OPEN` з'єднань. `close()` прибирає з'єднання з множини. Напишіть функцію `show_open()`, яка виводить відсортовані імена відкритих з'єднань. Продемонструйте: відкрийте `a` і `b`, невдало спробуйте відкрити `c`, закрийте `a`, відкрийте `c`, потім видаліть `b`, не закриваючи його, і відкрийте `d`.

## Розв'язки

### Вправа 1

Результат:

```text
Dog: woof, 4 legs (base: ...)
Bird: tweet, 1 legs (base: ...)
Dog: woof, 3 legs (base: ?)
Bird: tweet, 2 legs (base: ?)
```

- `Dog` перевизначає `sound`, але успадковує `legs` від `Animal`, тож `rex` показує `4`, а після зміни `Animal.legs` — `3`.
- `tweety.legs = 1` створює атрибут екземпляра, який затіняє `Bird.legs` лише для `tweety`. Новий `Bird()` і далі має 2 лапи, а зміна `Animal.legs` на птахів не впливає, бо `Bird` визначає власний `legs`.
- `Animal.sound` у `describe()` завжди читає атрибут на `Animal`, тому до зміни показує `...`, а після неї `?`.

### Вправа 2

```python
class Invoice:
    PREFIX = "INV"
    _next_number = 1001  # спільний для рахунків і кредитових авізо
    issued = 0

    def __init__(self, amount):
        self.amount = amount
        self.number = f"{self.PREFIX}-{Invoice._next_number}"
        Invoice._next_number += 1
        Invoice.issued += 1


class CreditNote(Invoice):
    PREFIX = "CN"


documents = [Invoice(250), Invoice(99), CreditNote(-99), Invoice(40)]
for doc in documents:
    print(doc.number, doc.amount)
print("issued:", Invoice.issued, "next number:", Invoice._next_number)
print("CreditNote has its own _next_number:", "_next_number" in vars(CreditNote))
```

Результат:

```text
INV-1001 250
INV-1002 99
CN-1003 -99
INV-1004 40
issued: 4 next number: 1005
CreditNote has its own _next_number: False
```

`self.PREFIX` бере префікс підкласу, а саме він і має відрізнятися. `Invoice._next_number` явно називає клас, тож кредитове авізо збільшує спільний лічильник. З `type(self)._next_number += 1` перше ж кредитове авізо створило б окремий `_next_number` на `CreditNote`, і дві послідовності номерів почали б перетинатися.

### Вправа 3

Помилка — `Product.default_discount` в `__init__`: цей вираз завжди читає значення з `Product` (`0`) і ігнорує перевизначення в `ClearanceItem`. Читання через `self` знаходить найконкретніше значення:

```python
class Product:
    default_discount = 0

    def __init__(self, name, price):
        self.name = name
        self.price = price
        self.discount = self.default_discount  # враховує підкласи

    def net_price(self):
        return self.price * (1 - self.discount)


class ClearanceItem(Product):
    default_discount = 0.5


lamp = Product("lamp", 80)
phone = ClearanceItem("old phone", 120)
cable = ClearanceItem("cable", 10)
cable.discount = 0.75  # особлива пропозиція для одного товару

for item in [lamp, phone, cable]:
    print(item.name, item.net_price())
```

Результат:

```text
lamp 80
old phone 60.0
cable 2.5
```

`type(self).default_discount` тут спрацював би так само. Особлива пропозиція — атрибут екземпляра, тож вона стосується лише `cable`.

### Вправа 4

```python
import weakref


class Connection:
    MAX_OPEN = 2
    _open = weakref.WeakSet()  # відкриті з'єднання, які множина не тримає живими

    def __init__(self, name):
        if len(Connection._open) >= Connection.MAX_OPEN:
            raise RuntimeError(f"cannot open {name!r}: limit of {Connection.MAX_OPEN} reached")
        self.name = name
        Connection._open.add(self)

    def close(self):
        Connection._open.discard(self)


def show_open():
    print("open:", sorted(c.name for c in Connection._open))


a = Connection("a")
b = Connection("b")
show_open()

try:
    c = Connection("c")
except RuntimeError as error:
    print(error)

a.close()
c = Connection("c")
show_open()

del b  # забули без close(): WeakSet його відпускає
d = Connection("d")
show_open()
```

Результат (CPython):

```text
open: ['a', 'b']
cannot open 'c': limit of 2 reached
open: ['b', 'c']
open: ['c', 'd']
```

`discard()` (на відміну від `remove()`) нічого не робить, якщо з'єднання немає в множині, тож повторний виклик `close()` безпечний. Після `del b` на те з'єднання більше ніщо не посилається, тож CPython одразу його знищує, і `WeakSet` про нього забуває. Зі звичайною множиною `set` з'єднання `b` назавжди лишилося б «відкритим» і блокувало б нові з'єднання.

---

*Джерело: [pythontutorial.net — Python Class Attributes](https://www.pythontutorial.net/python-oop/python-class-attributes/). Адаптовано й доповнено для PyJourney.*
