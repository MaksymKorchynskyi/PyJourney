# __hash__

Словники й множини знаходять елементи майже миттєво, тому що шукають їх за **хешем**: цілим числом, обчисленим з об'єкта. Спеціальний метод `__hash__` обчислює це число для вашого класу. Він має працювати в парі з `__eq__`, а помилка в цій парі призводить до одних із найзаплутаніших багів у Python: дублікатів у множині або ключа словника, який «там є», але знайти його неможливо.

## Що ви дізнаєтесь

- Що повертає `hash()` і які об'єкти є хешованими
- Як працює хеш власного об'єкта за замовчуванням
- Як словники й множини разом використовують `__hash__` і `__eq__`
- Контракт між хешем і рівністю та чому визначення `__eq__` встановлює `__hash__` у `None`
- Як правильно реалізувати `__hash__` з тих самих полів, що й `__eq__`
- Чому хеш не повинен змінюватися, поки об'єкт лежить у множині чи словнику, і як тут допомагають властивості лише для читання та заморожені dataclass

## Функція `hash()`

`hash(obj)` повертає ціле число. Усередині вона викликає `type(obj).__hash__(obj)`:

```python
print(hash(42))
print(hash((1, 2)))
print(hash(1) == hash(1.0) == hash(True))

try:
    hash([1, 2])
except TypeError as error:
    print("TypeError:", error)
```

Результат:

```text
42
-3550055125485641917
True
TypeError: unhashable type: 'list'
```

Незмінювані вбудовані типи (`int`, `float`, `str`, `bytes`, `tuple` з хешованих елементів, `frozenset`) є **хешованими** (hashable). Змінювані контейнери (`list`, `dict`, `set`) — ні, бо їхній вміст, а отже й хеш, міг би змінитися.

> **Зверніть увагу:** хеш `str` і `bytes` **рандомізується** для кожного процесу (рандомізація хешів захищає вебсервери від атак зі спеціально підібраними колізіями). `hash("abc")` щоразу дає інше число. Ніколи не зберігайте хеші у файлах чи базах даних і не покладайтеся на їхні точні значення.

## Хеш ваших об'єктів за замовчуванням

Клас, що не визначає ні `__eq__`, ні `__hash__`, успадковує обидва методи від `object`:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


p1 = Person("John", 22)
p2 = Person("Jane", 22)

print(hash(p1))
print(hash(p2))
print(hash(p1) == p1.__hash__())
```

Результат (числа змінюються з кожним запуском):

```text
271196438
271192269
True
```

Типовий хеш обчислюється з ідентичності об'єкта (`id()`), а типовий `__eq__` порівнює ідентичність. Ці дві типові реалізації узгоджені: об'єкт рівний лише самому собі й завжди має той самий хеш. Тож звичайні об'єкти можна використовувати як ключі словника й елементи множини, де кожен об'єкт вважається унікальним.

## Як словники й множини використовують `__hash__` і `__eq__`

Словник чи множина — це хеш-таблиця. Пошук ключа відбувається у два кроки:

```text
lookup(key)
 1. h = hash(key)               -> за h обрати комірку таблиці
 2. для кожного запису в цій ділянці таблиці з тим самим збереженим хешем h:
        якщо entry is key або entry == key: знайдено
 3. інакше: не знайдено
```

`__hash__` звужує пошук до кількох кандидатів, а `__eq__` ухвалює остаточне рішення. Це можна побачити:

```python
class Key:
    def __init__(self, value):
        self.value = value

    def __hash__(self):
        print(f"  __hash__ of Key({self.value})")
        return hash(self.value)

    def __eq__(self, other):
        print(f"  __eq__: Key({self.value}) vs Key({other.value})")
        return isinstance(other, Key) and self.value == other.value


print("insert:")
table = {Key(1): "one"}
print("lookup:")
print(table[Key(1)])
```

Результат:

```text
insert:
  __hash__ of Key(1)
lookup:
  __hash__ of Key(1)
  __eq__: Key(1) vs Key(1)
one
```

Ключ для пошуку — інший об'єкт, тож Python спершу знайшов збіг за хешем, а потім підтвердив рівність через `__eq__`.

## Контракт: рівні об'єкти мусять мати рівні хеші

З наведеного алгоритму випливає єдине правило, якого має дотримуватися кожен хешований клас:

> Якщо `a == b`, то `hash(a) == hash(b)`.

Якби рівні об'єкти мали різні хеші, пошук ішов би не в ту комірку й навіть не викликав би `__eq__`. Зворотне твердження **не** обов'язкове: різні об'єкти можуть мати однаковий хеш (це *колізія*). Колізії лише трохи сповільнюють пошук, бо остаточно їх розв'язує `__eq__`:

```python
print(hash(-1) == hash(-2))  # True: колізія в CPython
print(-1 == -2)              # False: це все одно різні ключі

prices = {1: "int", 1.0: "float", True: "bool"}
print(prices)
```

Результат:

```text
True
False
{1: 'bool'}
```

`1 == 1.0 == True`, і їхні хеші теж рівні, тож словник вважає їх **одним ключем**. Лишається перший об'єкт-ключ (`1`), а значення перезаписується двічі.

## Визначення `__eq__` прибирає типовий хеш

Тепер дамо `Person` рівність за значенням:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        return isinstance(other, Person) and self.age == other.age


print(Person.__hash__)

try:
    hash(Person("John", 22))
except TypeError as error:
    print("TypeError:", error)

try:
    members = {Person("John", 22), Person("Jane", 22)}
except TypeError as error:
    print("TypeError:", error)
```

Результат (Python 3.14; старіші версії в обох випадках виводять лише `unhashable type: 'Person'`):

```text
None
TypeError: unhashable type: 'Person'
TypeError: cannot use 'Person' as a set element (unhashable type: 'Person')
```

Коли клас визначає `__eq__` без `__hash__`, Python записує в клас `__hash__ = None`. Це зроблено свідомо: успадкований хеш на основі ідентичності дав би двом рівним людям різні хеші й непомітно порушив би контракт. Python віддає перевагу гучному `TypeError` перед тихим багом.

## Реалізація `__hash__`

`__hash__(self)` має повертати ціле число й будуватися з **тих самих даних, які порівнює `__eq__`**. Найпростіший правильний спосіб — хешувати кортеж цих полів:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        return isinstance(other, Person) and self.age == other.age

    def __hash__(self):
        return hash(self.age)


p1 = Person("John", 22)
p2 = Person("Jane", 22)
p3 = Person("Mary", 30)

print(hash(p1), hash(p2), hash(p3))
members = {p1, p2, p3}
print(len(members))
print([p.name for p in members])
```

Результат:

```text
22 22 30
2
['John', 'Mary']
```

Тут `__eq__` порівнює лише `age`, тому й `__hash__` хешує лише `age`. John і Jane «рівні», тож множина зберігає тільки першого з них. У реальному коді рівність зазвичай охоплює кілька полів, і хеш використовує той самий кортеж:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)

    def __hash__(self):
        return hash((self.name, self.age))

    def __repr__(self):
        return f"Person({self.name!r}, {self.age!r})"


people = [Person("Ann", 30), Person("Bob", 25), Person("Ann", 30)]
print(len(set(people)))

roles = {Person("Ann", 30): "admin"}
print(roles[Person("Ann", 30)])
print(Person("Bob", 25) in roles)
```

Результат:

```text
2
admin
False
```

> **Порада:** хешувати *підмножину* полів, які порівнює `__eq__`, теж коректно (рівні об'єкти все одно збігаються на цій підмножині), просто колізій буде більше. А от хешувати поле, яке `__eq__` ігнорує, — **помилка**.

## Що буває, коли контракт порушено

Припустімо, хтось «виправив» `TypeError`, повертаючи хеш на основі ідентичності:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)

    def __hash__(self):
        return id(self)  # неправильно: рівні об'єкти отримують різні хеші


a = Person("Ann", 30)
b = Person("Ann", 30)
print(a == b)
print(hash(a) == hash(b))
print(len({a, b}))
print(b in {a})
```

Результат:

```text
True
False
2
False
```

`a` і `b` рівні, проте множина зберігає обидва, а `b in {a}` дає `False`. Жодної помилки немає — дані просто тихо стають неправильними.

## Хеш не повинен змінюватися

Словник або множина запам'ятовує хеш кожного ключа в момент вставлення. Якщо об'єкт потім змінить поле, від якого залежить хеш, він опиниться «записаним» під неправильним хешем:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)

    def __hash__(self):
        return hash((self.name, self.age))


ann = Person("Ann", 30)
visitors = {ann}
print(ann in visitors)

ann.age = 31  # змінюємо ключ після того, як його збережено
print(ann in visitors)
print(Person("Ann", 30) in visitors)
print(list(visitors)[0] is ann)
```

Результат:

```text
True
False
False
True
```

Об'єкт фізично лежить у множині, але ні він сам, ні «Ann, 30» більше не можуть його знайти. Саме тому хешованими мають бути лише ті об'єкти, чиї хешовані дані ніколи не змінюються.

### Зробіть хешовані поля доступними лише для читання

Один зі способів — зберігати дані в «приватних» атрибутах і відкривати їх через властивості лише для читання (докладно властивості розглядаються в наступному розділі курсу):

```python
class Person:
    def __init__(self, name, age):
        self._name = name
        self._age = age

    @property
    def name(self):
        return self._name

    @property
    def age(self):
        return self._age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)

    def __hash__(self):
        return hash((self.name, self.age))


ann = Person("Ann", 30)
try:
    ann.age = 31
except AttributeError as error:
    print("AttributeError:", error)

print(ann in {Person("Ann", 30)})
```

Результат:

```text
AttributeError: property 'age' of 'Person' object has no setter
True
```

Це домовленість, а не замок: код усе ще може присвоїти `ann._age`. Підкреслення означає «не чіпати».

### Або використайте заморожений dataclass

`@dataclass(frozen=True)` генерує `__eq__` і відповідний йому `__hash__` з усіх полів, а також забороняє присвоєння після створення:

```python
from dataclasses import dataclass, FrozenInstanceError


@dataclass(frozen=True)
class Point:
    x: int
    y: int


p = Point(1, 2)
print(hash(p) == hash(Point(1, 2)))
print(len({p, Point(1, 2), Point(2, 1)}))

try:
    p.x = 10
except FrozenInstanceError as error:
    print("FrozenInstanceError:", error)


@dataclass
class MutablePoint:
    x: int
    y: int


print(MutablePoint.__hash__)
```

Результат:

```text
True
2
FrozenInstanceError: cannot assign to field 'x'
None
```

Звичайний `@dataclass` генерує `__eq__`, а отже за тим самим правилом встановлює `__hash__` у `None`.

## Свідомо нехешовані класи та успадкування

Змінювані об'єкти-значення, як-от банківський рахунок зі змінним балансом, зазвичай **не** повинні бути хешованими. Скажіть про це явно: `__hash__ = None`. Те саме правило діє й під час успадкування: підклас, що перевизначає `__eq__`, втрачає успадкований хеш, якщо явно його не відновить:

```python
import collections.abc


class Base:
    pass


class Child(Base):
    def __eq__(self, other):
        return NotImplemented


class FixedChild(Base):
    def __eq__(self, other):
        return NotImplemented

    __hash__ = Base.__hash__


class Account:
    __hash__ = None  # явно нехешований


print(Child.__hash__)
print(FixedChild.__hash__ is object.__hash__)
print(isinstance(Account(), collections.abc.Hashable))

try:
    hash(Account())
except TypeError as error:
    print("TypeError:", error)
```

Результат:

```text
None
True
False
TypeError: unhashable type: 'Account'
```

## Типові помилки

- **Визначити `__eq__` і забути про `__hash__`.** Об'єкти стають нехешованими й не працюють у множинах та як ключі словника.
- **Хешувати інші поля, ніж ті, що порівнює `__eq__`.** Якщо хеш використовує поле, яке рівність ігнорує, рівні об'єкти отримують різні хеші, і множини зберігають «дублікати».
- **Повертати з `__hash__` `id(self)` або випадкове число.** Це прибирає `TypeError`, але порушує контракт.
- **Змінювати об'єкт, поки він є ключем чи елементом множини.** Він стає недосяжним. Хешуйте лише дані, які ніколи не змінюються.
- **Покладатися на значення хешів.** Хеші рядків змінюються між запусками, а хеші цілих чисел мають особливості (`hash(-1) == -2`). Порівнюйте об'єкти, а не хеші.
- **Вважати, що однакові хеші означають рівні об'єкти.** Колізії — це нормально; рівність завжди підтверджує `__eq__`.

## Підсумок

- `hash(obj)` викликає `__hash__` і повертає ціле число, за яким словники й множини швидко знаходять елементи.
- За замовчуванням `__hash__` обчислюється з ідентичності об'єкта, а `__eq__` порівнює ідентичність, тож кожен об'єкт — унікальний ключ.
- Пошук використовує хеш, щоб знайти кандидатів, і `__eq__`, щоб підтвердити збіг.
- Контракт: якщо `a == b`, то `hash(a) == hash(b)`. Колізії дозволені.
- Визначення `__eq__` без `__hash__` встановлює `__hash__` у `None`, і об'єкти стають нехешованими.
- Реалізуйте `__hash__` як `hash((field1, field2, ...))` з полів, які порівнює `__eq__`.
- Хешовані дані не повинні змінюватися, поки об'єкт лежить у множині чи словнику: використовуйте властивості лише для читання або `@dataclass(frozen=True)`.
- Позначайте змінювані класи-значення як нехешовані через `__hash__ = None`.

## Практика

### Вправа 1: Унікальні кліки

Напишіть клас `Point` з `x` і `y`, рівний за координатами та хешований. Використайте його, щоб за допомогою множини порахувати унікальні точки в `[Point(0, 0), Point(3, 4), Point(0, 0), Point(3, 4), Point(1, 1)]`, а також як ключі словника `{Point(0, 0): "origin", Point(3, 4): "target"}`. Знайдіть `Point(3, 4)` і через `.get()` — відсутню `Point(9, 9)`.

### Вправа 2: Знайдіть порушений контракт

Два товари з однаковим SKU рівні, проте множина зберігає обидва. Поясніть чому і виправте клас, змінивши один рядок.

```python
class Product:
    def __init__(self, sku, name):
        self.sku = sku
        self.name = name

    def __eq__(self, other):
        if not isinstance(other, Product):
            return NotImplemented
        return self.sku == other.sku

    def __hash__(self):
        return hash((self.sku, self.name))


a = Product("A-1", "Pen")
b = Product("A-1", "Pen (blue)")
print(a == b)
print(len({a, b}))
```

### Вправа 3: Загублений квиток

Передбачте чотири виведені значення, а потім поясніть їх. Наостанок змініть клас так, щоб цей баг став неможливим.

```python
class Ticket:
    def __init__(self, code):
        self.code = code

    def __eq__(self, other):
        if not isinstance(other, Ticket):
            return NotImplemented
        return self.code == other.code

    def __hash__(self):
        return hash(self.code)


ticket = Ticket("A1")
used = {ticket}
ticket.code = "B2"

print(ticket in used)
print(Ticket("A1") in used)
print(Ticket("B2") in used)
print(len(used))
```

### Вправа 4: Підрахунок відвідувань із замороженим dataclass

Визначте заморожений dataclass `Coordinate(lat, lon)` і використайте його як ключ словника, щоб порахувати, скільки разів кожне місце трапляється в маршруті: Київ `(50.45, 30.52)` тричі, Львів `(49.84, 24.03)` один раз, Одеса `(46.48, 30.73)` один раз. Виведіть кожну координату з її кількістю в порядку першого відвідування.

## Розв'язки

### Вправа 1

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __eq__(self, other):
        if not isinstance(other, Point):
            return NotImplemented
        return (self.x, self.y) == (other.x, other.y)

    def __hash__(self):
        return hash((self.x, self.y))


clicks = [Point(0, 0), Point(3, 4), Point(0, 0), Point(3, 4), Point(1, 1)]
print(len(set(clicks)))

labels = {Point(0, 0): "origin", Point(3, 4): "target"}
print(labels[Point(3, 4)])
print(labels.get(Point(9, 9), "unknown"))
```

Результат:

```text
3
target
unknown
```

### Вправа 2

Хеш містить `name`, а `__eq__` його ігнорує. `a` і `b` рівні, але їхні хеші різні, тож множина навіть не порівнює їх і зберігає обидва (програма виводить `True` і `2`). Хеш має використовувати лише ті поля, які порівнює `__eq__`:

```python
class Product:
    def __init__(self, sku, name):
        self.sku = sku
        self.name = name

    def __eq__(self, other):
        if not isinstance(other, Product):
            return NotImplemented
        return self.sku == other.sku

    def __hash__(self):
        return hash(self.sku)


a = Product("A-1", "Pen")
b = Product("A-1", "Pen (blue)")
print(a == b)
print(len({a, b}))
```

Результат:

```text
True
1
```

### Вправа 3

Результат початкового коду:

```text
False
False
False
1
```

- `ticket in used`: множина шукає під `hash("B2")`, а квиток записано під `hash("A1")`.
- `Ticket("A1") in used`: хеш збігається зі збереженим, але `__eq__` порівнює `"A1"` з поточним кодом квитка `"B2"` і повертає `False`.
- `Ticket("B2") in used`: знову не та комірка, бо збережений хеш досі `hash("A1")`.
- `len(used)`: квиток і далі лежить у множині, просто знайти його неможливо.

Зробіть код доступним лише для читання, щоб хешовані дані не могли змінитися:

```python
class Ticket:
    def __init__(self, code):
        self._code = code

    @property
    def code(self):
        return self._code

    def __eq__(self, other):
        if not isinstance(other, Ticket):
            return NotImplemented
        return self.code == other.code

    def __hash__(self):
        return hash(self.code)


ticket = Ticket("A1")
used = {ticket}

try:
    ticket.code = "B2"
except AttributeError as error:
    print("AttributeError:", error)

print(Ticket("A1") in used)
```

Результат:

```text
AttributeError: property 'code' of 'Ticket' object has no setter
True
```

### Вправа 4

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Coordinate:
    lat: float
    lon: float


visits = {}
route = [
    Coordinate(50.45, 30.52),
    Coordinate(49.84, 24.03),
    Coordinate(50.45, 30.52),
    Coordinate(46.48, 30.73),
    Coordinate(50.45, 30.52),
]
for place in route:
    visits[place] = visits.get(place, 0) + 1

for place, count in visits.items():
    print(place, count)
```

Результат:

```text
Coordinate(lat=50.45, lon=30.52) 3
Coordinate(lat=49.84, lon=24.03) 1
Coordinate(lat=46.48, lon=30.73) 1
```

Словники зберігають порядок вставлення, тому місця з'являються в порядку першого відвідування. `collections.Counter(route)` дав би ту саму кількість одним рядком.

---

*Джерело: [pythontutorial.net — Python __hash__](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__hash__/). Адаптовано й доповнено для PyJourney.*
