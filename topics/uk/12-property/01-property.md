# Властивості (property)

**Властивість** (property) ззовні виглядає як звичайний атрибут (`john.age = 19`, `print(john.age)`), але за лаштунками кожне читання і кожен запис проходять через методи, які контролюєте ви. Властивості дають змогу пізніше додати до атрибута перевірку чи обчислення, не змінюючи жодного рядка коду, який уже використовує ваш клас.

## Що ви дізнаєтесь

- Чому пряме присвоєння атрибута може пропустити некоректні дані
- Як цю проблему розв'язують методи-гетери та методи-сетери і чому вони ламають наявний код
- Як вбудований клас `property()` перетворює гетер і сетер на атрибут
- Де живе об'єкт властивості, а де зберігаються справжні дані
- Чому властивість у класі має перевагу над `__dict__` екземпляра
- Що буває, коли у властивості немає сетера чи делітера, і як її задокументувати

## Проблема: атрибути без перевірки

Ось простий клас із двома публічними атрибутами:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


john = Person("John", 18)
john.age = 19
print(john.age)

john.age = -1  # технічно допустимо, але за змістом хибно
print(john.age)
```

Результат:

```text
19
-1
```

Python спокійно зберігає `-1`, бо атрибут — це просто ім'я, прив'язане до значення. Щоб дані лишалися коректними, можна перевіряти значення перед кожним присвоєнням:

```python
age = -1
if age <= 0:
    raise ValueError("The age must be positive")
else:
    john.age = age
```

Але тоді та сама перевірка повторюється в кожному місці, де присвоюється вік. Рано чи пізно хтось про неї забуде.

## Гетери й сетери

Класичне об'єктно-орієнтоване рішення — сховати дані й надати доступ до них лише через два методи:

- **гетер** (getter) повертає значення атрибута;
- **сетер** (setter) перевіряє нове значення і зберігає його.

За домовленістю їх називають `get_<attribute>()` і `set_<attribute>()`, а дані переносять в атрибут із підкресленням на початку — `_age`. Підкреслення означає «внутрішнє, ззовні не чіпати». Python цього не забороняє; це лише домовленість.

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.set_age(age)

    def set_age(self, age):
        if age <= 0:
            raise ValueError("The age must be positive")
        self._age = age

    def get_age(self):
        return self._age


john = Person("John", 18)
try:
    john.set_age(-19)
except ValueError as error:
    print("ValueError:", error)
print(john.get_age())
```

Результат:

```text
ValueError: The age must be positive
18
```

`__init__` теж викликає сетер, тож навіть новий об'єкт не може отримати некоректний вік.

### Пастка: зворотна сумісність

Припустімо, перша версія `Person` (з публічним `age`) уже якийсь час використовується, і інший код усюди читає й записує `john.age`. Після переходу на гетери й сетери цей код ламається, причому одна його частина ламається **непомітно**:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.set_age(age)

    def set_age(self, age):
        if age <= 0:
            raise ValueError("The age must be positive")
        self._age = age

    def get_age(self):
        return self._age


john = Person("John", 18)
try:
    print(john.age)  # старий клієнтський код
except AttributeError as error:
    print("AttributeError:", error)

john.age = -1        # старий клієнтський код: непомітно створює новий атрибут
print(john.get_age(), john.__dict__)
```

Результат:

```text
AttributeError: 'Person' object has no attribute 'age'
18 {'name': 'John', '_age': 18, 'age': -1}
```

Читання падає з помилкою, а от запис створює зовсім новий, неперевірений атрибут `age` поруч із `_age`. Довелося б переписати кожен виклик. Саме цю проблему розв'язує `property()`.

## Клас `property()`

`property` — вбудований клас. Його виклик створює **об'єкт властивості**, що об'єднує до трьох функцій і рядок документації:

```python
property(fget=None, fset=None, fdel=None, doc=None)
```

- `fget` — функція, що отримує значення атрибута (гетер);
- `fset` — функція, що встановлює значення (сетер);
- `fdel` — функція, що видаляє атрибут (делітер, про нього йдеться в одній із наступних тем);
- `doc` — рядок документації властивості.

Присвойте об'єкт властивості **атрибуту класу** з тим ім'ям, яке мають бачити користувачі:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def get_age(self):
        return self._age

    def set_age(self, age):
        if age <= 0:
            raise ValueError("The age must be positive")
        self._age = age

    age = property(fget=get_age, fset=set_age)


def celebrate_birthday(person):
    person.age += 1


john = Person("John", 18)
celebrate_birthday(john)
print(john.age)

try:
    john.age = -1
except ValueError as error:
    print("ValueError:", error)
print(john.age)
```

Результат:

```text
19
ValueError: The age must be positive
19
```

Код у старому стилі, `person.age += 1` і `john.age = -1`, працює без змін, але тепер кожен запис проходить через `set_age()`, а кожне читання — через `get_age()`. Навіть `self.age = age` усередині `__init__` використовує сетер, тож перевірка охоплює і створення об'єкта.

> **Порада:** саме тому програмісти на Python не пишуть гетери й сетери «про всяк випадок». Починайте зі звичайних публічних атрибутів. Якщо згодом знадобиться перевірка чи обчислення, перетворіть атрибут на властивість — і нікому з користувачів класу не доведеться нічого змінювати.

## Де живуть властивість і дані

`age` — це атрибут **класу**, що містить об'єкт властивості:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def get_age(self):
        return self._age

    def set_age(self, age):
        if age <= 0:
            raise ValueError("The age must be positive")
        self._age = age

    age = property(fget=get_age, fset=set_age)


john = Person("John", 18)
print(Person.age)
print(john.__dict__)
```

Результат (адреса змінюється):

```text
<property object at 0x100af07c0>
{'name': 'John', '_age': 18}
```

Словник екземпляра `john.__dict__` містить `name` і `_age`, тобто справжні дані, але не `age`. Словник класу `Person.__dict__` містить властивість і обидва методи. Якщо вивести його через `pprint`, який сортує ключі, він виглядає так:

```python
from pprint import pprint


class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def set_age(self, age):
        if age <= 0:
            raise ValueError("The age must be positive")
        self._age = age

    def get_age(self):
        return self._age

    age = property(fget=get_age, fset=set_age)


pprint(Person.__dict__)
```

Результат (Python 3.14; адреси змінюються):

```text
mappingproxy({'__dict__': <attribute '__dict__' of 'Person' objects>,
              '__doc__': None,
              '__firstlineno__': 4,
              '__init__': <function Person.__init__ at 0x100b77270>,
              '__module__': '__main__',
              '__static_attributes__': ('_age', 'age', 'name'),
              '__weakref__': <attribute '__weakref__' of 'Person' objects>,
              'age': <property object at 0x100af07c0>,
              'get_age': <function Person.get_age at 0x100bdba00>,
              'set_age': <function Person.set_age at 0x100bdb950>})
```

`__firstlineno__` і `__static_attributes__` з'явилися в Python 3.13; у старіших версіях їх немає.

## Як Python знаходить `john.age`

Часто пояснюють, що Python спершу шукає ім'я в `john.__dict__` і лише якщо не знаходить — у класі. Для звичайних атрибутів класу це так, але **не** для властивостей. Властивість — це *дескриптор даних* (data descriptor), тобто об'єкт, що визначає і `__get__`, і `__set__`, а дескриптори даних у класі мають перевагу над словником екземпляра:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def get_age(self):
        print("get_age() called")
        return self._age

    def set_age(self, age):
        print(f"set_age({age}) called")
        if age <= 0:
            raise ValueError("The age must be positive")
        self._age = age

    age = property(fget=get_age, fset=set_age)

    species = "human"


john = Person("John", 18)
john.__dict__["age"] = 999          # потайки кладемо значення в словник екземпляра
john.__dict__["species"] = "robot"

print(john.age)       # властивість однаково перемагає
print(john.species)   # звичайний атрибут класу програє словнику екземпляра
print(john.__dict__)
```

Результат:

```text
set_age(18) called
get_age() called
18
robot
{'name': 'John', '_age': 18, 'age': 999, 'species': 'robot'}
```

Порядок пошуку для `obj.attr` такий:

```text
1. дескриптор даних attr у type(obj) або його базових класах  (напр., property)
2. attr в obj.__dict__                                       (дані екземпляра)
3. дескриптор без __set__ або звичайний attr у класі          (методи, константи)
4. інакше: AttributeError (або __getattr__, якщо його визначено)
```

Саме ця перевага робить властивості надійними: ніщо, збережене в екземплярі, не може їх обійти.

## Властивості без сетера чи делітера

Кожна з трьох функцій необов'язкова. Якщо немає `fset`, присвоєння генерує `AttributeError`; якщо немає `fdel`, те саме робить `del`:

```python
class Person:
    def __init__(self, age):
        self._age = age

    def get_age(self):
        return self._age

    age = property(get_age)


p = Person(5)
print(p.age)

try:
    p.age = 6
except AttributeError as error:
    print("AttributeError:", error)

try:
    del p.age
except AttributeError as error:
    print("AttributeError:", error)
```

Результат (Python 3.11+; старіші версії пишуть `can't set attribute` і `can't delete attribute`):

```text
5
AttributeError: property 'age' of 'Person' object has no setter
AttributeError: property 'age' of 'Person' object has no deleter
```

Властивість лише з гетером — це властивість **лише для читання** (read-only). Властивостям лише для читання та властивостям, які можна видаляти, присвячено окремі теми далі в цьому розділі.

## Документування властивості

Якщо передати `doc`, він стане рядком документації властивості. Інакше властивість копіює docstring гетера. Його показують `help(Person)` і IDE:

```python
class Person:
    def __init__(self, age):
        self.age = age

    def get_age(self):
        """Age of the person in full years."""
        return self._age

    def set_age(self, age):
        self._age = age

    age = property(get_age, set_age)
    nickname = property(lambda self: "Johnny", doc="A friendly name.")


print(Person.age.__doc__)
print(Person.nickname.__doc__)
print(Person.age.fget.__name__, Person.age.fset.__name__, Person.age.fdel)
```

Результат:

```text
Age of the person in full years.
A friendly name.
get_age set_age None
```

Атрибути `fget`, `fset` і `fdel` повертають початкові функції.

## Типові помилки

- **Використовувати ім'я самої властивості всередині гетера чи сетера.** `self.age = age` усередині `set_age` знову викликає `set_age`, і так без кінця:

  ```python
  class Person:
      def __init__(self, age):
          self.age = age

      def get_age(self):
          return self.age  # помилка: читає саму властивість

      def set_age(self, age):
          self.age = age  # помилка: присвоює самій властивості

      age = property(get_age, set_age)


  try:
      Person(30)
  except RecursionError as error:
      print("RecursionError:", error)
  ```

  Результат:

  ```text
  RecursionError: maximum recursion depth exceeded
  ```

  Зберігайте дані під іншим ім'ям, зазвичай із підкресленням на початку (`self._age`).

- **Створювати властивість в екземплярі.** `self.age = property(...)` усередині `__init__` просто зберігає об'єкт властивості в атрибуті екземпляра; читання `p.age` поверне `<property object at 0x...>`. Властивості працюють лише як атрибути **класу**.
- **Обходити перевірку в `__init__`.** Рядок `self._age = age` в `__init__` пропускає сетер. Присвоюйте через властивість (`self.age = age`), щоб нові об'єкти теж перевірялися.
- **Робити гетери повільними чи несподіваними.** Код, що читає `obj.age`, очікує швидкого доступу до атрибута без побічних ефектів. Важка робота має бути в методі з дієсловом у назві.
- **За замовчуванням писати гетери й сетери в стилі Java.** У Python починайте з публічних атрибутів і переходьте на властивість лише тоді, коли вона справді потрібна.

## Підсумок

- Публічні атрибути приймають будь-яке значення; для перевірки потрібна контрольована точка входу.
- Методи-гетери й методи-сетери додають перевірку, але змінюють спосіб використання класу й ламають наявний код.
- `property(fget, fset, fdel, doc)` створює об'єкт властивості; присвоєний атрибуту класу, він перетворює читання, запис і видалення атрибута на виклики ваших функцій.
- Властивість живе в класі, а справжні дані зазвичай зберігаються в екземплярі під іншим ім'ям, наприклад `_age`.
- Властивість — дескриптор даних, тому вона має перевагу над `__dict__` екземпляра.
- Без `fset` чи `fdel` присвоєння або видалення генерує `AttributeError`.
- Рядок документації властивості береться з `doc` або з гетера.

## Практика

### Вправа 1: Ім'я, яке не може бути порожнім

За допомогою `property()` (не декоратора) додайте класу `Person` властивість `name`. Сетер має обрізати пробіли з обох боків і генерувати `ValueError("The name cannot be empty")`, якщо нічого не лишилося. Додайте рядок документації `"The person's name."`. Покажіть, що `Person("  Ann  ").name` дорівнює `'Ann'`, а присвоєння `"   "` завершується помилкою й не змінює ім'я.

### Вправа 2: Цельсій і Фаренгейт

Напишіть клас `Temperature`, який зберігає лише `celsius` як звичайний атрибут. Додайте властивість `fahrenheit`, створену через `property()`: її гетер перераховує градуси з Цельсія (`c * 9 / 5 + 32`), а сетер перераховує назад і оновлює `celsius`. Покажіть, що `__dict__` містить лише `celsius`.

### Вправа 3: Передбачте результат

Передбачте кожен рядок, а потім запустіть код:

```python
class Box:
    def get_size(self):
        print("getter")
        return 1

    def set_size(self, value):
        print(f"setter({value})")

    size = property(get_size, set_size)
    color = "red"


box = Box()
box.size = 5
box.color = "blue"
box.__dict__["size"] = 100
print(box.size)
print(box.color)
print(Box.color)
print(box.__dict__)
```

### Вправа 4: Оновлення без шкоди для клієнтів

Версія 1 класу `Product(name, price)` зберігала `price` як публічний атрибут, і клієнтський код робить щось на кшталт `item.price *= 1.1`. Напишіть версію 2, яка за допомогою `property()` відхиляє нечислові значення через `TypeError`, від'ємні ціни через `ValueError` і округлює збережені ціни до 2 знаків після коми, а клієнтський код при цьому працює без змін.

## Розв'язки

### Вправа 1

```python
class Person:
    def __init__(self, name):
        self.name = name

    def get_name(self):
        return self._name

    def set_name(self, value):
        value = value.strip()
        if not value:
            raise ValueError("The name cannot be empty")
        self._name = value

    name = property(get_name, set_name, doc="The person's name.")


ann = Person("  Ann  ")
print(repr(ann.name))

try:
    ann.name = "   "
except ValueError as error:
    print("ValueError:", error)
print(repr(ann.name))
print(Person.name.__doc__)
```

Результат:

```text
'Ann'
ValueError: The name cannot be empty
'Ann'
The person's name.
```

Сетер генерує виняток ще до присвоєння, тож після невдалої спроби старе значення лишається на місці.

### Вправа 2

```python
class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    def get_fahrenheit(self):
        return self.celsius * 9 / 5 + 32

    def set_fahrenheit(self, value):
        self.celsius = (value - 32) * 5 / 9

    fahrenheit = property(get_fahrenheit, set_fahrenheit)


t = Temperature(25)
print(t.fahrenheit)

t.fahrenheit = 212
print(t.celsius)

t.celsius = -40
print(t.fahrenheit)
print(t.__dict__)
```

Результат:

```text
77.0
100.0
-40.0
{'celsius': -40}
```

`fahrenheit` нічого не зберігає сам. Його обчислюють із `celsius` під час кожного читання, тож два значення ніколи не розійдуться.

### Вправа 3

Результат:

```text
setter(5)
getter
1
blue
red
{'color': 'blue', 'size': 100}
```

- `box.size = 5` викликає сетер, який виводить повідомлення й нічого не зберігає.
- `box.color = "blue"` створює атрибут екземпляра, який затуляє атрибут класу `color`.
- `box.size` однаково викликає гетер: властивість — дескриптор даних, тому вона перемагає ключ `size` у `box.__dict__`.
- `Box.color` досі дорівнює `"red"`; власний `color` є лише в екземпляра.

### Вправа 4

```python
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price

    def get_price(self):
        return self._price

    def set_price(self, value):
        if not isinstance(value, (int, float)):
            raise TypeError("The price must be a number")
        if value < 0:
            raise ValueError("The price cannot be negative")
        self._price = round(value, 2)

    price = property(get_price, set_price)


# клієнтський код, написаний для старої версії, лишається без змін
item = Product("Tea", 85)
item.price *= 1.1
print(item.name, item.price)

for bad in (-5, "free"):
    try:
        item.price = bad
    except (TypeError, ValueError) as error:
        print(type(error).__name__ + ":", error)
print(item.price)
```

Результат:

```text
Tea 93.5
ValueError: The price cannot be negative
TypeError: The price must be a number
93.5
```

`item.price *= 1.1` читає значення через гетер, множить його й записує результат назад через сетер, який округлює `93.50000000000001` до `93.5`.

---

*Джерело: [pythontutorial.net — Python Property](https://www.pythontutorial.net/python-oop/python-properties/). Адаптовано й доповнено для PyJourney.*
