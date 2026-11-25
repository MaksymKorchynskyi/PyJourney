# Декоратор @property

Декоратор `@property` — звичний спосіб створювати властивості в Python. Він робить те саме, що й `property()`, але гетер, сетер і делітер записуються як методи з **тим самим ім'ям**, що й властивість. У класі не лишається зайвих методів `get_...()` і `set_...()`, а робота з ним виглядає як звичайний доступ до атрибута.

## Що ви дізнаєтесь

- Як працює синтаксис декораторів і чому `property` можна використовувати як декоратор
- Як `@property` перетворює метод на властивість лише з гетером
- Як `@<name>.setter` додає сетер і чому гетер і сетер мусять мати однакове ім'я
- Чому `setter()`, `getter()` і `deleter()` повертають нову властивість, а не змінюють стару
- Стандартний шаблон атрибута з перевіркою і як підклас може замінити лише сетер
- Звідки береться рядок документації властивості

## Проблема дублювання

У темі «Властивості (property)» ви бачили, як створити властивість за допомогою класу `property()`:

```python
property(fget=None, fset=None, fdel=None, doc=None)
```

Ось клас `Person` з властивістю `age`, яка має лише гетер і створена саме так:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self._age = age

    def get_age(self):
        return self._age

    age = property(fget=get_age)


john = Person("John", 25)
print(john.age)
print(john.get_age())
```

Результат:

```text
25
25
```

Це працює, але тепер клас пропонує **два** способи прочитати те саме значення: властивість `age` і метод `get_age()`. Обидва водночас нікому не потрібні, а кожне зайве публічне ім'я доводиться документувати, тестувати й підтримувати незмінним.

Розв'язок — дати функції-гетеру те саме ім'я, що й властивості:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self._age = age

    def age(self):
        return self._age

    age = property(fget=age)


john = Person("John", 25)
print(john.age)
print(type(Person.__dict__["age"]).__name__)
```

Результат:

```text
25
property
```

У рядку `age = property(fget=age)` спершу обчислюється права частина. У цей момент `age` ще посилається на функцію, тож саме функція потрапляє в `property()`. Потім ім'я `age` **перев'язується** на новий об'єкт властивості. Звичайна функція більше не доступна під власним ім'ям, а лише через властивість (`Person.age.fget`).

## Декоратори за хвилину

**Декоратор** (decorator) — це об'єкт, який можна викликати: він отримує функцію і повертає щось, що використовуватиметься замість неї. Синтаксис `@` — скорочений запис саме того перев'язування, яке ви щойно бачили:

```python
@decorator
def func():
    ...
```

означає те саме, що й:

```python
def func():
    ...


func = decorator(func)
```

`property` приймає функцію першим аргументом (`fget`) і повертає об'єкт властивості, тож ідеально підходить під цю схему. Зверніть увагу: декоратор не зобов'язаний повертати функцію. Об'єкт властивості, який він повертає, навіть не можна викликати:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self._age = age

    @property
    def age(self):
        return self._age


john = Person("John", 25)
print(john.age)
print(callable(Person.age))
```

Результат:

```text
25
False
```

`@property` над `def age` — це те саме, що `age = property(age)`, тільки компактніше. Тепер у класу одне публічне ім'я, `age`, і читається воно як атрибут.

## Сетер через `@<name>.setter`

Об'єкт властивості має три методи, що створюють **нову** властивість на основі поточної:

| Метод | Що отримує нова властивість | Для чого |
|---|---|---|
| `prop.getter(func)` | `func` як `fget` | `obj.prop` |
| `prop.setter(func)` | `func` як `fset` | `obj.prop = value` |
| `prop.deleter(func)` | `func` як `fdel` | `del obj.prop` |

Усе інше (дві інші функції та рядок документації) копіюється з оригіналу. Додаймо сетер крок за кроком. Спочатку без синтаксису декоратора:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self._age = age

    @property
    def age(self):
        return self._age

    def set_age(self, value):
        if value <= 0:
            raise ValueError("The age must be positive")
        self._age = value

    age = age.setter(set_age)


john = Person("John", 25)
john.age = 26
print(john.age)
```

Результат:

```text
26
```

`age.setter(set_age)` бере властивість лише з гетером, робить її копію з `fset=set_age`, а присвоєння перев'язує `age` на цю копію. Оригінальна властивість не змінюється, і це легко перевірити:

```python
def get_age(self):
    return self._age


def set_age(self, value):
    self._age = value


read_only = property(get_age)
read_write = read_only.setter(set_age)

print(read_only is read_write)
print(read_only.fset)
print(read_write.fset.__name__)
print(read_write.fget is read_only.fget)
```

Результат:

```text
False
None
set_age
True
```

Оскільки `setter()` приймає функцію і повертає об'єкт на заміну, його теж можна використати як декоратор. В ідіоматичному варіанті сетер має **те саме ім'я**, що й властивість:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    @property
    def age(self):
        return self._age

    @age.setter
    def age(self, value):
        if value <= 0:
            raise ValueError("The age must be positive")
        self._age = value


john = Person("John", 25)
john.age += 1
print(john.age)

try:
    john.age = -5
except ValueError as error:
    print("ValueError:", error)

try:
    Person("Baby", 0)
except ValueError as error:
    print("ValueError:", error)
```

Результат:

```text
26
ValueError: The age must be positive
ValueError: The age must be positive
```

Ось що відбувається з `@age.setter` по черзі:

1. Python обчислює вираз декоратора `age.setter`. У цей момент `age` — ще властивість лише з гетером.
2. Створюється нова функція, яка теж називається `age`.
3. Викликається `age.setter(<нова функція>)`, і він повертає властивість і з гетером, і з сетером.
4. Результат прив'язується до імені функції, `age`, і замінює властивість лише з гетером.

Зверніть увагу й на те, що в `__init__` тепер написано `self.age = age`, а не `self._age = age`. Присвоєння проходить через сетер, тож перевірка захищає і нові об'єкти. Саме тому `Person("Baby", 0)` завершується помилкою.

## Чому імена мусять збігатися

Спокусливо на проміжному кроці залишити сетеру старе ім'я:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self._age = age

    @property
    def age(self):
        return self._age

    @age.setter
    def set_age(self, value):
        if value <= 0:
            raise ValueError("The age must be positive")
        self._age = value


john = Person("John", 25)
print(type(Person.set_age).__name__)

john.set_age = 30
print(john.age)

try:
    john.age = 31
except AttributeError as error:
    print("AttributeError:", error)
```

Результат:

```text
property
30
AttributeError: property 'age' of 'Person' object has no setter
```

Крок 4 вище прив'язує результат до імені **декорованої функції**. Тут це ім'я `set_age`, тож у класі опиняються дві властивості:

- `age` — початкова властивість лише з гетером, її ніхто не змінював;
- `set_age` — нова властивість і з гетером, *і* з сетером.

`john.age = 31` завершується помилкою, а дивний на вигляд `john.set_age = 30` працює. Завжди давайте гетеру, сетеру й делітеру те саме ім'я, що й властивості.

## Стандартний шаблон

Якщо зібрати все разом, атрибут із перевіркою зазвичай виглядає так:

```python
class MyClass:
    def __init__(self, value):
        self.prop = value          # проходить через сетер

    @property
    def prop(self):
        return self._prop          # справжні дані зберігаються в _prop

    @prop.setter
    def prop(self, value):
        # тут перевіряємо або перетворюємо value
        self._prop = value


obj = MyClass(10)
print(obj.prop, obj.__dict__)
```

Результат:

```text
10 {'_prop': 10}
```

- `prop` — публічне ім'я. Воно живе в класі як об'єкт властивості.
- `_prop` — сховище даних. Воно живе в кожному екземплярі. Одне підкреслення на початку позначає його як внутрішнє.

> **Зверніть увагу:** іноді сховище записують із двома підкресленнями, `self.__prop`. Тоді вмикається *спотворення імен* (name mangling, див. тему «Приватні атрибути»): Python зберігає атрибут як `_MyClass__prop`. Це працює, але до такого атрибута незручно діставатися з підкласів та інструментів налагодження. Зазвичай обирають одне підкреслення.

Ось клас із двома властивостями з перевіркою:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    @property
    def age(self):
        return self._age

    @age.setter
    def age(self, value):
        if value <= 0:
            raise ValueError("The age must be positive")
        self._age = value

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        if value.strip() == "":
            raise ValueError("The name cannot be empty")
        self._name = value


john = Person("John", 25)
print(john.name, john.age)
print(john.__dict__)

for bad in [("   ", 30), ("Jane", -1)]:
    try:
        Person(*bad)
    except ValueError as error:
        print("ValueError:", error)
```

Результат:

```text
John 25
{'_name': 'John', '_age': 25}
ValueError: The name cannot be empty
ValueError: The age must be positive
```

Делітер додається так само, через `@age.deleter`. Про нього йдеться в темі «Видалення властивості».

## Рядок документації властивості

Рядок документації (docstring) **гетера** стає рядком документації властивості. `setter()` і `deleter()` копіюють його в нову властивість, тож достатньо задокументувати гетер. Його показують `help()` та IDE:

```python
class Person:
    def __init__(self, age):
        self.age = age

    @property
    def age(self):
        """Age of the person in full years."""
        return self._age

    @age.setter
    def age(self, value):
        """This docstring is ignored."""
        self._age = value


print(Person.age.__doc__)
print(Person.age.fget.__name__, Person.age.fset.__name__)
```

Результат:

```text
Age of the person in full years.
age age
```

Починаючи з Python 3.13, властивість має ще й атрибут `__name__` (`Person.age.__name__` дорівнює `'age'`).

## Перевизначення сетера в підкласі

Оскільки `setter()` повертає копію, підклас може взяти властивість батьківського класу, замінити в ній лише одну функцію і не зачепити батька. Звертайтеся до батьківської властивості через батьківський клас:

```python
class Account:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    @property
    def balance(self):
        """Current balance."""
        return self._balance

    @balance.setter
    def balance(self, value):
        if value < 0:
            raise ValueError("The balance cannot be negative")
        self._balance = value


class SavingsAccount(Account):
    MINIMUM = 100

    @Account.balance.setter
    def balance(self, value):
        if value < self.MINIMUM:
            raise ValueError(f"A savings account needs at least {self.MINIMUM}")
        Account.balance.fset(self, value)  # повторно використовуємо батьківський сетер


regular = Account("Ann", 50)
regular.balance = 0
print(regular.balance)

savings = SavingsAccount("Bob", 500)
try:
    savings.balance = 50
except ValueError as error:
    print("ValueError:", error)
print(savings.balance)

print(Account.balance is SavingsAccount.balance)
print(Account.balance.fget is SavingsAccount.balance.fget)
```

Результат:

```text
0
ValueError: A savings account needs at least 100
500
False
True
```

- `@Account.balance.setter` копіює батьківську властивість, зберігає її гетер і рядок документації та встановлює новий сетер. Результат потрапляє лише в `SavingsAccount`.
- `Account.balance.fset(self, value)` напряму викликає функцію-сетер батьківського класу, тож його перевірки й логіку збереження не доводиться дублювати.
- `Account.__init__` присвоює `self.balance`, і для екземпляра `SavingsAccount` це проходить через властивість **підкласу**, тож мінімум перевіряється й під час створення.

## Типові помилки

- **Давати сетеру інше ім'я.** `@age.setter` над `def set_age` створює нову властивість `set_age`, а `age` лишається доступною лише для читання. Усі декоровані методи мають називатися так само, як властивість.
- **Оголошувати сетер раніше за гетер.** `@age.setter` потребує вже наявної властивості з ім'ям `age`. Якщо сетер стоїть першим, клас не створюється: `NameError: name 'age' is not defined`.
- **Викликати властивість як метод.** `john.age()` спершу читає властивість, яка повертає `int`, а потім викликає цей `int`: `TypeError: 'int' object is not callable`.
- **Забути `@property`.** Без нього `john.age` — це зв'язаний метод, і `print(john.age)` покаже `<bound method Person.age of ...>` замість значення.
- **Зберігати значення під ім'ям самої властивості.** `self.age = value` усередині сетера `age` знову викликає сетер і закінчується `RecursionError` (див. тему «Властивості (property)»). Зберігайте значення в `self._age`.
- **Обходити сетер в `__init__`.** `self._age = age` в `__init__` пропускає некоректні значення через конструктор. Пишіть `self.age = age`.

## Підсумок

- `@decorator` над `def f` — скорочений запис `f = decorator(f)`; `@property` — скорочений запис `name = property(name)`.
- `@property` перетворює метод на гетер властивості з тим самим ім'ям, тож у класі немає зайвого методу `get_...()`.
- `@name.setter` і `@name.deleter` додають сетер і делітер. Декоровані методи мусять мати те саме ім'я, що й властивість.
- `getter()`, `setter()` і `deleter()` повертають **нову** властивість; оригінал ніколи не змінюється.
- Зберігайте дані в атрибуті з підкресленням (`_age`) і присвоюйте через властивість в `__init__`, щоб перевірка охоплювала і створення об'єкта.
- Рядок документації гетера стає рядком документації властивості.
- Підклас може замінити одну частину успадкованої властивості за допомогою `@Parent.name.setter`.

## Практика

### Вправа 1: Від `property()` до декораторів

Перепишіть цей клас із `@property` та `@price.setter`. Збережіть поведінку і переконайтеся, що в класі більше немає атрибутів `get_price` і `set_price`.

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    def get_price(self):
        return self._price

    def set_price(self, value):
        if value < 0:
            raise ValueError("The price cannot be negative")
        self._price = value

    price = property(get_price, set_price)
```

### Вправа 2: Нормалізована адреса пошти

Напишіть клас `User` із властивістю `email`. Сетер має обрізати пробіли з обох боків, переводити адресу в нижній регістр і генерувати `ValueError("Invalid email")`, якщо результат не містить рівно одного `@`. Використайте властивість в `__init__`. Покажіть, що `User("  Ann@Example.COM ").email` дорівнює `'ann@example.com'`, а `"ann.example.com"` відхиляється.

### Вправа 3: Передбачте результат

Передбачте кожен рядок, потім запустіть код і поясніть результат.

```python
class Thermostat:
    def __init__(self):
        self._target = 20

    @property
    def target(self):
        return self._target

    snapshot = target

    @target.setter
    def target(self, value):
        self._target = max(10, min(value, 30))


t = Thermostat()
t.target = 50
print(t.target)
print(t.snapshot)
print(Thermostat.snapshot is Thermostat.target)
print(Thermostat.snapshot.fset)
try:
    t.snapshot = 15
except AttributeError as error:
    print("AttributeError:", error)
```

### Вправа 4: Суворіший підклас

Візьміть клас `Person` із властивістю `age` з перевіркою з цієї теми і напишіть підклас `Adult`, чий сетер `age` додатково відхиляє вік менше 18 через `ValueError("An adult must be at least 18")`. Повторно використайте батьківський гетер і викличте батьківський сетер замість того, щоб самостійно зберігати `_age`. Покажіть, що сам `Person` і далі приймає `10`.

## Розв'язки

### Вправа 1

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    @property
    def price(self):
        return self._price

    @price.setter
    def price(self, value):
        if value < 0:
            raise ValueError("The price cannot be negative")
        self._price = value


tea = Product("Tea", 85)
tea.price = 90
print(tea.price)

try:
    tea.price = -1
except ValueError as error:
    print("ValueError:", error)

print(hasattr(Product, "get_price"), hasattr(Product, "set_price"))
```

Результат:

```text
90
ValueError: The price cannot be negative
False False
```

### Вправа 2

```python
class User:
    def __init__(self, email):
        self.email = email

    @property
    def email(self):
        return self._email

    @email.setter
    def email(self, value):
        value = value.strip().lower()
        if value.count("@") != 1:
            raise ValueError("Invalid email")
        self._email = value


ann = User("  Ann@Example.COM ")
print(repr(ann.email))

try:
    ann.email = "ann.example.com"
except ValueError as error:
    print("ValueError:", error)
print(ann.email)
```

Результат:

```text
'ann@example.com'
ValueError: Invalid email
ann@example.com
```

Сетер нормалізує значення ще до перевірки й збереження, тож будь-який спосіб задати адресу, зокрема конструктор, дає ту саму охайну форму.

### Вправа 3

Результат:

```text
30
30
False
None
AttributeError: property 'snapshot' of 'Thermostat' object has no setter
```

- `snapshot = target` прив'язує ще один атрибут класу до властивості **лише з гетером**, на яку в той момент посилалося `target`.
- `@target.setter` створює *нову* властивість і перев'язує на неї `target`. Об'єкт, на який посилається `snapshot`, не змінюється, тож `snapshot` лишається доступною лише для читання й не має `fset`.
- `t.target = 50` проходить через сетер, який обрізає значення до `30`. Обидві властивості використовують той самий гетер, тому обидві повертають `30`.

### Вправа 4

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    @property
    def age(self):
        return self._age

    @age.setter
    def age(self, value):
        if value <= 0:
            raise ValueError("The age must be positive")
        self._age = value


class Adult(Person):
    @Person.age.setter
    def age(self, value):
        if value < 18:
            raise ValueError("An adult must be at least 18")
        Person.age.fset(self, value)


anna = Adult("Anna", 30)
anna.age += 1
print(anna.age)

for age in (16, -3):
    try:
        Adult("Kid", age)
    except ValueError as error:
        print("ValueError:", error)

print(Person("Tim", 10).age)
```

Результат:

```text
31
ValueError: An adult must be at least 18
ValueError: An adult must be at least 18
10
```

`-3` відхиляє перевірка підкласу ще до того, як спрацює батьківська. `Person.age` — інший об'єкт властивості, ніж `Adult.age`, тож `Person` зберігає свої початкові правила.

---

*Джерело: [pythontutorial.net — Python Property Decorator](https://www.pythontutorial.net/python-oop/python-property-decorator/). Адаптовано й доповнено для PyJourney.*
