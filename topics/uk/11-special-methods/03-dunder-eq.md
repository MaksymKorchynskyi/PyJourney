# __eq__

За замовчуванням два об'єкти вашого класу рівні лише тоді, коли це той самий об'єкт. Спеціальний метод `__eq__` дає змогу визначити, що означає «рівні» саме для вашого класу, наприклад «те саме ім'я і той самий вік». Після цього оператор `==`, оператор `in` і чимало методів списку дотримуватимуться вашого правила.

## Що ви дізнаєтесь

- Що робить `==` для власних об'єктів за замовчуванням і чим він відрізняється від `is`
- Як реалізувати `__eq__` і як із нього виводиться `!=`
- Чому для незнайомих типів `__eq__` має повертати `NotImplemented`, а не `False` і не падати з помилкою
- Як Python пробує *віддзеркалене* (reflected) порівняння з боку правого операнда
- Які вбудовані операції спираються на `==` (`in`, `count()`, `index()`, `remove()`)
- Чому визначення `__eq__` робить об'єкти нехешованими

## За замовчуванням рівність — це ідентичність

Ось клас без `__eq__` і два об'єкти з однаковими даними:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age


john = Person("John", "Doe", 25)
jane = Person("Jane", "Doe", 25)
john2 = john

print(john is jane)
print(john == jane)
print(john == john2)
print(john != jane)
```

Результат:

```text
False
False
True
True
```

`john` і `jane` — два окремі об'єкти, тому `is` повертає `False`. Без власного `__eq__` оператор `==` робить те саме: метод, успадкований від `object`, вважає об'єкти рівними лише тоді, коли це один і той самий об'єкт. `john == john2` дає `True`, бо обидва імені посилаються на один об'єкт.

> **Зверніть увагу:** `is` питає «це той самий об'єкт?», а `==` — «чи рівні їхні значення?». Для ваших класів `==` означає те саме, що й `is`, доки ви не реалізуєте `__eq__`.

## Реалізація `__eq__`

Обчислюючи `a == b`, Python викликає `a.__eq__(b)`. Метод отримує інший об'єкт і повертає результат порівняння. Для першого прикладу вважатимемо двох людей рівними, якщо в них однаковий вік:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __eq__(self, other):
        return self.age == other.age


john = Person("John", "Doe", 25)
jane = Person("Jane", "Doe", 25)
mary = Person("Mary", "Doe", 27)

print(john == jane)
print(john == mary)
print(john != mary)
```

Результат:

```text
True
False
True
```

Зверніть увагу: `!=` теж працює, хоча визначено лише `__eq__`. У Python 3 типовий `__ne__` викликає `__eq__` й інвертує результат, тож писати `__ne__` самостійно майже ніколи не потрібно.

«Рівні, якщо збігається вік» — лише навчальний приклад. Справжня рівність має порівнювати всі атрибути, які визначають значення об'єкта. Зручно порівнювати кортежі:

```python
def __eq__(self, other):
    return (self.first_name, self.last_name, self.age) == (
        other.first_name,
        other.last_name,
        other.age,
    )
```

## Порівняння з іншими типами

Проста версія вище падає, щойно другий операнд виявляється не `Person`:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __eq__(self, other):
        return self.age == other.age


john = Person("John", "Doe", 25)

try:
    print(john == 20)
except AttributeError as error:
    print("AttributeError:", error)
```

Результат:

```text
AttributeError: 'int' object has no attribute 'age'
```

`==` ніколи не повинен падати. Порівняти людину з числом — цілком законне запитання, і відповідь на нього проста: «не рівні». Перше виправлення — перевірити тип через `isinstance()`:

```python
class Person:
    def __init__(self, first_name, last_name, age):
        self.first_name = first_name
        self.last_name = last_name
        self.age = age

    def __eq__(self, other):
        if isinstance(other, Person):
            return self.age == other.age

        return False


john = Person("John", "Doe", 25)
jane = Person("Jane", "Doe", 25)
mary = Person("Mary", "Doe", 27)

print(john == jane)
print(john == mary)
print(john == 20)
```

Результат:

```text
True
False
False
```

Це працює, але є відповідь, ще краща за `False`.

## Повертайте `NotImplemented` для незнайомих типів

`NotImplemented` — спеціальна вбудована константа. Повернути її з `__eq__` означає сказати: «я не знаю, як порівняти себе з цим об'єктом». Тоді Python дає шанс **іншому** операнду: викликає віддзеркалений метод `other.__eq__(self)`. Лише якщо обидві сторони повернули `NotImplemented`, `==` зводиться до перевірки ідентичності, яка для різних об'єктів дає `False`.

Чому це важливо? Уявіть інший клас, який *уміє* порівнювати себе з `Person`:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return False  # не дає слова іншому операнду
        return (self.name, self.age) == (other.name, other.age)


class Badge:
    def __init__(self, owner_name):
        self.owner_name = owner_name

    def __eq__(self, other):
        if isinstance(other, Person):
            return self.owner_name == other.name
        return NotImplemented


ann = Person("Ann", 30)
badge = Badge("Ann")
print(badge == ann)
print(ann == badge)
```

Результат:

```text
True
False
```

Рівність стала **несиметричною**: `badge == ann`, але не `ann == badge`. `Person.__eq__` відповів `False`, не давши слова `Badge`. Змініть один рядок, щоб повертати `NotImplemented`:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)


class Badge:
    def __init__(self, owner_name):
        self.owner_name = owner_name

    def __eq__(self, other):
        if isinstance(other, Person):
            return self.owner_name == other.name
        return NotImplemented


ann = Person("Ann", 30)
badge = Badge("Ann")
print(badge == ann)
print(ann == badge)
print(ann == 20)
print(ann != 20)
print(ann == Person("Ann", 30))
```

Результат:

```text
True
True
False
True
True
```

Тепер обидва напрямки узгоджені, а порівняння з непов'язаним типом, як-от `int`, і далі дає `False`: обидві сторони повертають `NotImplemented`, і Python переходить до перевірки ідентичності.

> **Порада:** стандартний шаблон такий:
> `if not isinstance(other, MyClass): return NotImplemented`, а далі порівняння атрибутів.

## Як Python обчислює `a == b`

Цей протокол можна побачити, якщо виводити повідомлення всередині `__eq__`:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        print(f"__eq__ called: {self.name} vs {other!r}")
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)


ann = Person("Ann", 30)
print(ann == "Ann")
print("Ann" == ann)
```

Результат:

```text
__eq__ called: Ann vs 'Ann'
False
__eq__ called: Ann vs 'Ann'
False
```

У другому порівнянні лівий операнд — `str`. `str.__eq__` нічого не знає про `Person`, тому повертає `NotImplemented`, і Python викликає віддзеркалений `ann.__eq__("Ann")`. Повний алгоритм:

```text
a == b
 1. result = a.__eq__(b)        (якщо type(b) — підклас type(a), що
                                 перевизначає __eq__, спершу пробують b.__eq__(a))
 2. якщо result is NotImplemented: result = b.__eq__(a)
 3. якщо досі NotImplemented:      result = (a is b)
```

`!=` проходить ті самі кроки з `__ne__`, типова реалізація якого інвертує `__eq__`.

## Де `==` використовується за вас

Багато операцій порівнюють елементи через `==`, тож вони автоматично починають використовувати ваш `__eq__`: оператор `in` для списків і кортежів, `list.count()`, `list.index()` і `list.remove()`.

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)

    def __repr__(self):
        return f"Person({self.name!r}, {self.age!r})"


team = [Person("Ann", 30), Person("Bob", 25), Person("Ann", 30)]

print(Person("Bob", 25) in team)
print(team.count(Person("Ann", 30)))
print(team.index(Person("Bob", 25)))
team.remove(Person("Ann", 30))
print(team)
```

Результат:

```text
True
2
1
[Person('Bob', 25), Person('Ann', 30)]
```

`remove()` видаляє лише **перший** рівний елемент. Без `__eq__` усі ці виклики шукали б той самий об'єкт і нічого б не знаходили.

## Визначення `__eq__` робить об'єкти нехешованими

Є побічний ефект, про який треба знати. Коли клас визначає `__eq__`, але не `__hash__`, Python встановлює `__hash__` у `None`, і об'єкти вже не можуть бути елементами множини чи ключами словника:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __eq__(self, other):
        if not isinstance(other, Person):
            return NotImplemented
        return (self.name, self.age) == (other.name, other.age)


print(Person.__hash__)

try:
    {Person("Ann", 30)}
except TypeError as error:
    print("TypeError:", error)
```

Результат (Python 3.14; старіші версії виводять лише `unhashable type: 'Person'`):

```text
None
TypeError: cannot use 'Person' as a set element (unhashable type: 'Person')
```

Це запобіжник: рівні об'єкти мусять мати однакові хеші, а типовий хеш на основі ідентичності порушив би це правило. Наступна тема, `__hash__`, показує, як правильно це виправити.

## Правила доброго `__eq__`

- **Рефлексивність:** `a == a` дає `True`.
- **Симетричність:** якщо `a == b`, то `b == a`. Повернення `NotImplemented` замість `False` допомагає дотриматися цього правила.
- **Транзитивність:** якщо `a == b` і `b == c`, то `a == c`.
- **Узгодженість із `__hash__`:** якщо `a == b`, то `hash(a) == hash(b)`.
- **Ніколи не генерує виняток** для неочікуваних типів.
- **Повертає `bool`** (або `NotImplemented`). Бібліотеки на кшталт NumPy свідомо повертають інше, але ваші класи зазвичай не повинні.

`isinstance(other, Person)` приймає й підкласи. Якщо підклас додає атрибути, важливі для рівності, використовуйте суворішу перевірку, наприклад `type(other) is type(self)`, інакше `Person` може виявитися «рівним» `Employee` з тим самим ім'ям і віком.

## Доручіть це `dataclasses`

`@dataclass` генерує `__eq__`, який по черзі порівнює всі поля й повертає `NotImplemented` для об'єктів іншого класу:

```python
from dataclasses import dataclass


@dataclass
class Point:
    x: int
    y: int


print(Point(1, 2) == Point(1, 2))
print(Point(1, 2) == Point(2, 1))
print(Point(1, 2) == (1, 2))
```

Результат:

```text
True
False
False
```

## Типові помилки

- **Звертатися до атрибутів `other` без перевірки типу.** `john == 20` падає з `AttributeError`. Спершу перевірте `isinstance()`.
- **Повертати `False` замість `NotImplemented`.** Це блокує віддзеркалене порівняння і може зробити рівність несиметричною.
- **Порівнювати замало.** «Рівні, якщо збігається вік» робить рівними двох різних людей. Порівнюйте всі атрибути, що визначають значення.
- **Порівнювати значення через `is`.** `a is b` перевіряє ідентичність. Для значень використовуйте `==`, а `is` залиште для `None` та інших об'єктів-одинаків (singleton).
- **Забувати про хешування.** Після додавання `__eq__` об'єкти не можна класти в множини чи використовувати як ключі словника, доки ви не визначите `__hash__`.
- **Точно порівнювати числа з рухомою комою.** `0.1 + 0.2 == 0.3` дає `False`. Для атрибутів типу `float` подумайте про `math.isclose()`.

## Підсумок

- Без `__eq__` оператор `==` для власних об'єктів означає ідентичність, тобто те саме, що й `is`.
- `a == b` викликає `a.__eq__(b)`. Якщо результат — `NotImplemented`, Python пробує `b.__eq__(a)`, а наостанок переходить до `a is b`.
- `!=` використовує типовий `__ne__`, який інвертує `__eq__`.
- Перевіряйте тип через `isinstance()` і повертайте `NotImplemented` для незнайомих типів.
- Порівнюйте всі атрибути, що визначають значення; зручно робити це кортежами.
- `in`, `count()`, `index()` і `remove()` використовують `__eq__`.
- Визначення `__eq__` встановлює `__hash__` у `None`; якщо об'єкти мають бути хешованими, реалізуйте й `__hash__`.

## Практика

### Вправа 1: Рівні гроші

Напишіть клас `Money` з `amount` і `currency`. Два об'єкти `Money` рівні, коли збігаються і сума, і валюта. Порівняння з будь-яким іншим типом має повертати `NotImplemented`. Перевірте `==` і `!=` між об'єктами `Money`, а також `Money(10, "USD") == 10`.

### Вправа 2: Передбачте результат

Передбачте кожен рядок, зокрема ті, що виводять методи, перш ніж запускати код:

```python
class A:
    def __eq__(self, other):
        print("A.__eq__")
        return NotImplemented


class B:
    def __eq__(self, other):
        print("B.__eq__")
        return True


a, b = A(), B()
print(a == b)
print(b == a)
print(a == A())
```

### Вправа 3: Адреса пошти без урахування регістру

Напишіть клас `Email`, об'єкти якого рівні без урахування регістру літер. `Email` також має порівнюватися зі звичайним рядком в **обох** напрямках: і `Email("Ann@Example.com") == "ann@example.com"`, і `"ann@example.com" == Email("Ann@Example.com")` мають давати `True`. Порівняння з іншими типами дає `False`.

### Вправа 4: Приберіть дублікати

Сканер штрихкодів створив список об'єктів `Product(sku, name)` із дублікатами. Товари рівні, коли збігається `sku`; назва може відрізнятися. Приберіть дублікати, залишивши перше входження й початковий порядок, а потім порахуйте, скільки разів відскановано `"A-1"`. Товари нехешовані, тож `set` використати не вийде.

## Розв'язки

### Вправа 1

```python
class Money:
    def __init__(self, amount, currency):
        self.amount = amount
        self.currency = currency

    def __eq__(self, other):
        if not isinstance(other, Money):
            return NotImplemented
        return (self.amount, self.currency) == (other.amount, other.currency)


print(Money(10, "USD") == Money(10, "USD"))
print(Money(10, "USD") == Money(10, "EUR"))
print(Money(10, "USD") != Money(5, "USD"))
print(Money(10, "USD") == 10)
```

Результат:

```text
True
False
True
False
```

### Вправа 2

Результат:

```text
A.__eq__
B.__eq__
True
B.__eq__
True
A.__eq__
A.__eq__
False
```

- `a == b`: `A.__eq__` повертає `NotImplemented`, тому Python викликає віддзеркалений `b.__eq__(a)`, який повертає `True`.
- `b == a`: `B.__eq__` відповідає одразу, тож `A.__eq__` узагалі не викликається.
- `a == A()`: обидва операнди мають тип `A`, обидва виклики повертають `NotImplemented`, і Python переходить до перевірки ідентичності. Це різні об'єкти, тому результат `False`.

### Вправа 3

```python
class Email:
    def __init__(self, address):
        self.address = address

    def __eq__(self, other):
        if isinstance(other, Email):
            other = other.address
        if not isinstance(other, str):
            return NotImplemented
        return self.address.lower() == other.lower()


print(Email("Ann@Example.com") == Email("ann@example.COM"))
print(Email("Ann@Example.com") == "ann@example.com")
print("ann@example.com" == Email("Ann@Example.com"))
print(Email("ann@example.com") == Email("bob@example.com"))
print(Email("ann@example.com") == 42)
```

Результат:

```text
True
True
True
False
False
```

Третій рядок працює завдяки віддзеркаленню: `str.__eq__` повертає `NotImplemented` для `Email`, тож Python викликає `Email.__eq__` з операндами, поміняними місцями. Для повної нечутливості до регістру в Unicode `casefold()` ще надійніший за `lower()`.

### Вправа 4

```python
class Product:
    def __init__(self, sku, name):
        self.sku = sku
        self.name = name

    def __eq__(self, other):
        if not isinstance(other, Product):
            return NotImplemented
        return self.sku == other.sku

    def __repr__(self):
        return f"Product({self.sku!r}, {self.name!r})"


scanned = [
    Product("A-1", "Pen"),
    Product("B-7", "Notebook"),
    Product("A-1", "Pen (blue)"),
    Product("C-3", "Eraser"),
    Product("B-7", "Notebook"),
]

unique = []
for product in scanned:
    if product not in unique:
        unique.append(product)

print(unique)
print(scanned.count(Product("A-1", "")))
```

Результат:

```text
[Product('A-1', 'Pen'), Product('B-7', 'Notebook'), Product('C-3', 'Eraser')]
2
```

І `not in`, і `count()` викликають `__eq__`. Цей цикл має складність O(n²); щойно ви додасте `__hash__` (наступна тема), множина чи словник зроблять те саме за лінійний час.

---

*Джерело: [pythontutorial.net — Python __eq__](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__eq__/). Адаптовано й доповнено для PyJourney.*
