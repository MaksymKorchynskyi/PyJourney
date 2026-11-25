# Одиночне успадкування

**Успадкування** (inheritance) дає змогу новому класу повторно використати атрибути й методи наявного класу, а потім додати або змінити лише те, що відрізняється. За **одиночного успадкування** (single inheritance) клас має рівно одного безпосереднього батька. Це найпоширеніша форма успадкування й основа для перевизначення методів, `super()` та абстрактних класів.

## Що ви дізнаєтесь

- Як оголосити підклас, що повторно використовує код батьківського класу
- Термінологію: батьківський / базовий клас / суперклас, дочірній / похідний клас / підклас, а також відношення IS-A («є»)
- Як Python шукає атрибут, піднімаючись ланцюжком класів
- Чим відрізняються `type()`, `isinstance()` та `issubclass()`
- Чому кожен клас зрештою успадковується від `object`
- Коли успадкування — правильний інструмент, а коли краще підходить композиція

## Проблема: дубльований код

Ось простий клас `Person`:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hi, it's {self.name}"
```

Тепер потрібен клас `Employee`. Працівник теж має ім'я і вітається так само, але додатково має посаду. Якщо написати його з нуля, половина коду `Person` повториться:

```python
class Employee:
    def __init__(self, name, job_title):
        self.name = name
        self.job_title = job_title

    def greet(self):
        return f"Hi, it's {self.name}"
```

Два методи `greet()` однакові. Якщо згодом змінити привітання, доведеться пам'ятати про обидва місця, і рано чи пізно вони розійдуться. Успадкування усуває це дублювання.

## Оголошення підкласу

Щоб успадкувати клас, вкажіть ім'я батька в дужках після імені нового класу:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hi, it's {self.name}"


class Employee(Person):
    def __init__(self, name, job_title):
        self.name = name
        self.job_title = job_title


employee = Employee("John", "Python Developer")
print(employee.greet())
print(employee.job_title)
```

Результат:

```text
Hi, it's John
Python Developer
```

`Employee` не визначає `greet()`, проте `employee.greet()` працює: метод **успадковано** від `Person`. `Employee` додає лише нове — атрибут `job_title`.

Це **одиночне успадкування**, бо `Employee` має одного безпосереднього батька — `Person`. Python підтримує й множинне успадкування (клас із кількома батьками), про нього йдеться в одному з наступних розділів.

> **Зверніть увагу:** `Employee.__init__` усе ще повторює `self.name = name` з `Person.__init__`. У темі про `super()` показано, як викликати `__init__` батька замість того, щоб копіювати його.

### Підклас може бути порожнім

Навіть якщо підклас поки нічого не додає, він отримує все від батька, зокрема й `__init__`:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hi, it's {self.name}"


class Customer(Person):
    pass


customer = Customer("Olena")
print(customer.greet())
```

Результат:

```text
Hi, it's Olena
```

### Підклас може додавати нові методи

Методи, визначені в дочірньому класі, існують лише в ньому. Батьківський клас нічого не знає про свої підкласи:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hi, it's {self.name}"


class Employee(Person):
    def __init__(self, name, job_title):
        self.name = name
        self.job_title = job_title

    def describe(self):
        return f"{self.name} works as a {self.job_title}"


print(Employee("John", "tester").describe())

person = Person("Jane")
print(hasattr(person, "describe"))
```

Результат:

```text
John works as a tester
False
```

## Як Python знаходить успадкований атрибут

Коли ви пишете `employee.greet`, Python шукає у фіксованому порядку й зупиняється на першому збігу:

1. у самому екземплярі (його `__dict__`);
2. у класі екземпляра, `Employee`;
3. у батьківському класі, `Person`;
4. у батька батька і так далі, аж до `object`.

```text
employee.greet
    |
    v
__dict__ екземпляра -> {'name': 'John', 'job_title': '...'}   немає 'greet'
    |
    v
Employee            -> __init__                                немає 'greet'
    |
    v
Person              -> __init__, greet                         знайдено
```

Цей ланцюжок можна переглянути самостійно. `__bases__` містить безпосередніх батьків, а `__mro__` (method resolution order, порядок розв'язання методів) — повний порядок пошуку:

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hi, it's {self.name}"


class Employee(Person):
    def __init__(self, name, job_title):
        self.name = name
        self.job_title = job_title


print(Employee.__bases__)
print(Employee.__mro__)
print("greet" in Employee.__dict__)
print("greet" in Person.__dict__)
print(Employee.greet is Person.greet)
```

Результат:

```text
(<class '__main__.Person'>,)
(<class '__main__.Employee'>, <class '__main__.Person'>, <class 'object'>)
False
True
True
```

Метод **не копіюється** в дочірній клас. `Employee.greet` — буквально той самий об'єкт функції, що й `Person.greet`; Python просто знаходить його рівнем вище. Корисний наслідок: пошук відбувається щоразу, тому зміна в батьківському класі одразу видна всім нащадкам.

```python
class Person:
    species = "human"


class Employee(Person):
    pass


print(Employee.species)
Person.species = "Homo sapiens"
print(Employee.species)
```

Результат:

```text
human
Homo sapiens
```

## Термінологія успадкування

Різні книжки й мови програмування називають те саме по-різному. Усі ці варіанти правильні:

| `Person` — це ... | `Employee` — це ... |
|---|---|
| батьківський клас (parent class) | дочірній клас (child class) |
| базовий клас (base class) | похідний клас (derived class) |
| суперклас (superclass) | підклас (subclass) |

Також кажуть, що `Employee` **успадковується від** `Person`, **походить від** нього або **розширює** його.

Таке відношення називають **IS-A** («є»): працівник *є* людиною. Це і є перевірка, чи доречне успадкування взагалі. Якщо речення «`Child` є `Parent`» звучить безглуздо, успадкування, найімовірніше, не підходить (див. розділ про композицію нижче).

## `type()` проти `isinstance()`

`type(obj)` повертає точний клас, з якого створено об'єкт:

```python
class Person:
    def __init__(self, name):
        self.name = name


class Employee(Person):
    def __init__(self, name, job_title):
        self.name = name
        self.job_title = job_title


person = Person("Jane")
print(type(person))

employee = Employee("John", "Python Developer")
print(type(employee))
```

Результат:

```text
<class '__main__.Person'>
<class '__main__.Employee'>
```

`isinstance(obj, cls)` відповідає на інше запитання: «чи можна використовувати `obj` як `cls`?» Функція повертає `True` для екземплярів `cls` **і всіх його підкласів**:

```python
class Person:
    def __init__(self, name):
        self.name = name


class Employee(Person):
    def __init__(self, name, job_title):
        self.name = name
        self.job_title = job_title


person = Person("Jane")
employee = Employee("John", "Python Developer")

print(isinstance(person, Person))
print(isinstance(employee, Person))
print(isinstance(employee, Employee))
print(isinstance(person, Employee))
```

Результат:

```text
True
True
True
False
```

- `person` — екземпляр `Person`.
- `employee` — екземпляр `Employee` **і** `Person`, бо кожен працівник є людиною.
- `person` **не є** `Employee`: екземпляр батьківського класу не є екземпляром дочірнього.

`type()` повністю ігнорує успадкування, і це класична пастка:

```python
class Person:
    pass


class Employee(Person):
    pass


employee = Employee()
print(type(employee) == Person)
print(type(employee) is Employee)
print(isinstance(employee, Person))
```

Результат:

```text
False
True
True
```

Тож для перевірки типів віддавайте перевагу `isinstance()`. Ця функція враховує успадкування, а отже, підкласи можна використовувати всюди, де очікується батьківський клас. `type(obj) is SomeClass` застосовуйте лише тоді, коли справді потрібен точний клас.

`isinstance()` також приймає кортеж класів і повертає `True`, якщо підходить будь-який із них:

```python
value = True
print(isinstance(value, (int, float)))
print(isinstance(value, int))
print(type(value))
```

Результат:

```text
True
True
<class 'bool'>
```

`True` є `int`, бо вбудований тип `bool` — підклас `int`. Успадкування в Python усюди, навіть серед вбудованих типів.

## `issubclass()`

`issubclass(child, parent)` працює з **класами**, а не з екземплярами. Функція перевіряє весь ланцюжок, а не лише безпосередніх батьків:

```python
class Person:
    pass


class Employee(Person):
    pass


class SalesEmployee(Employee):
    pass


print(issubclass(Employee, Person))
print(issubclass(SalesEmployee, Employee))
print(issubclass(SalesEmployee, Person))
print(issubclass(Person, Employee))
print(issubclass(Person, Person))
```

Результат:

```text
True
True
True
False
True
```

Зверніть увагу на останній рядок: кожен клас вважається підкласом самого себе.

`SalesEmployee` успадковується від `Employee`, а той — від `Person`. Це все ще одиночне успадкування: кожен клас має одного безпосереднього батька, хоча ланцюжок має кілька рівнів.

```text
object
  ^
  |
Person
  ^
  |
Employee
  ^
  |
SalesEmployee
```

## Кожен клас успадковується від `object`

Клас без явно вказаного батька неявно успадковується від вбудованого `object`:

```python
class Person:
    def __init__(self, name):
        self.name = name


print(Person.__bases__)
print(issubclass(Person, object))
print(isinstance(42, object))
```

Результат:

```text
(<class 'object'>,)
True
True
```

Саме тому навіть «порожній» клас уже має `__init__`, `__repr__`, `__eq__`, `__str__` та інші спеціальні методи: вони походять від `object`. Наприклад, якщо вивести `Person` без власного `__repr__`, спрацює `object.__repr__`:

```python
class Person:
    def __init__(self, name):
        self.name = name


print(Person("Jane"))  # результат щоразу різний, напр. <__main__.Person object at 0x104735160>
```

> **Зверніть увагу:** у Python 2 доводилося писати `class Person(object):`, щоб отримати клас «нового стилю». У Python 3 усі класи нового стилю, тож `class Person:` і `class Person(object):` — одне й те саме. Сучасний код пише без `(object)`.

## Успадкування проти композиції

Успадкування — це сильний зв'язок: дочірній клас отримує *все* від батька, зокрема методи, які йому можуть бути зовсім не потрібні. Використовуйте успадкування, коли перевірка IS-A проходить і дочірній клас справді є спеціалізованим різновидом батьківського.

Коли об'єкт лише **має** інший об'єкт або **користується** ним (відношення HAS-A, «має»), зберігайте цей об'єкт як атрибут. Такий підхід називають **композицією** (composition):

```python
class Address:
    def __init__(self, city):
        self.city = city


class Employee:
    def __init__(self, name, address):
        self.name = name
        self.address = address  # Employee МАЄ Address


employee = Employee("John", Address("Kyiv"))
print(employee.address.city)
```

Результат:

```text
Kyiv
```

Працівник не є адресою, тому `class Employee(Address)` був би помилкою, хоча й «повторно використав» би атрибут `city`.

## Типові помилки

- **Перевіряти тип через `type(...) ==`.** `type(employee) == Person` дає `False`, хоча кожен працівник є людиною. Використовуйте `isinstance(employee, Person)`.
- **Забути встановити атрибути батька в `__init__` дочірнього класу.** Визначений у підкласі `__init__` *замінює* `__init__` батька; Python не викликає обидва автоматично. Через це успадковані методи ламаються:

  ```python
  class Person:
      def __init__(self, name):
          self.name = name

      def greet(self):
          return f"Hi, it's {self.name}"


  class Employee(Person):
      def __init__(self, job_title):
          self.job_title = job_title  # self.name так і не встановлено


  Employee("Developer").greet()
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    ...
  AttributeError: 'Employee' object has no attribute 'name'
  ```

  Встановіть усі атрибути, потрібні методам батька, або, ще краще, викличте `__init__` батька через `super().__init__(...)`.

- **Передавати екземпляр в `issubclass()`.** Функція очікує класи: `issubclass(employee, Person)` згенерує `TypeError: issubclass() arg 1 must be a class`. Для екземплярів є `isinstance()`.
- **Успадковувати лише заради повторного використання коду.** Якщо твердження «`Child` є `Parent`» хибне, обирайте композицію. Успадкування `Employee` від `Address` чи `Stack` від `list` відкриває методи, які новому класу не належать.
- **Очікувати, що батько знає про методи нащадків.** Метод, визначений лише в `Employee`, не існує в екземплярах `Person`.

## Підсумок

- Успадкування дає класу змогу повторно використовувати атрибути й методи іншого класу: `class Child(Parent):`.
- За одиночного успадкування клас має рівно одного безпосереднього батька, але ланцюжок може мати багато рівнів.
- Батьківський клас ще називають базовим або суперкласом, дочірній — похідним або підкласом. Відношення між ними — IS-A.
- Python шукає атрибут в екземплярі, потім у його класі, потім у кожному батьківському класі аж до `object`. `Cls.__mro__` показує цей порядок.
- `type()` повертає точний клас; `isinstance()` приймає й підкласи і є рекомендованою перевіркою.
- `issubclass()` порівнює класи й перевіряє весь ланцюжок; клас є підкласом самого себе.
- Кожен клас неявно успадковується від `object`.
- Використовуйте успадкування для відношень IS-A, а композицію — для HAS-A.

## Практика

### Вправа 1: Передбачте перевірки

Не запускаючи код, запишіть, що виведе кожен рядок. Потім запустіть і порівняйте.

```python
class Animal:
    pass


class Dog(Animal):
    pass


class Puppy(Dog):
    pass


rex = Dog()
print(isinstance(rex, Animal))
print(isinstance(rex, Puppy))
print(type(rex) is Animal)
print(issubclass(Puppy, Animal))
print(issubclass(Animal, Dog))
print(issubclass(Puppy, object))
```

### Вправа 2: Транспорт

Створіть клас `Vehicle` з атрибутом `brand` і методом `describe()`, що повертає `"Vehicle: <brand>"`. Створіть підклас `Truck`, чий `__init__` приймає `brand` і `capacity` (у тоннах) і який додає метод `load_info()`, що повертає `"<brand> can carry <capacity> t"`. Створіть вантажівку й викличте на ній обидва методи.

### Вправа 3: Покажіть ланцюжок

Напишіть функцію `chain(cls)`, яка повертає імена класу та всіх його предків, об'єднані через `" -> "`, наприклад `"SalesEmployee -> Employee -> Person -> object"`. Використайте `__bases__` (вважайте, що успадкування одиночне) і цикл, а не `__mro__`.

### Вправа 4: Виправте помилку

Код нижче падає. З'ясуйте чому й виправте `Manager.__init__`, не змінюючи `Person`.

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hi, it's {self.name}"


class Manager(Person):
    def __init__(self, name, team_size):
        self.team_size = team_size


boss = Manager("Iryna", 5)
print(boss.greet())
```

## Розв'язки

### Вправа 1

Результат:

```text
True
False
False
True
False
True
```

- `rex` — це `Dog`, а кожна собака є `Animal`, тому перша перевірка дає `True`.
- `rex` створено з `Dog`, а не з `Puppy`. Екземпляр батьківського класу не є екземпляром дочірнього.
- `type(rex)` — це саме `Dog`, тож порівняння з `Animal` дає `False`.
- `Puppy -> Dog -> Animal`, тому `Puppy` — підклас `Animal`, але не навпаки.
- Кожен клас є підкласом `object`.

### Вправа 2

```python
class Vehicle:
    def __init__(self, brand):
        self.brand = brand

    def describe(self):
        return f"Vehicle: {self.brand}"


class Truck(Vehicle):
    def __init__(self, brand, capacity):
        self.brand = brand
        self.capacity = capacity

    def load_info(self):
        return f"{self.brand} can carry {self.capacity} t"


truck = Truck("Volvo", 20)
print(truck.describe())
print(truck.load_info())
print(isinstance(truck, Vehicle))
```

Результат:

```text
Vehicle: Volvo
Volvo can carry 20 t
True
```

### Вправа 3

```python
class Person:
    pass


class Employee(Person):
    pass


class SalesEmployee(Employee):
    pass


def chain(cls):
    names = []
    while True:
        names.append(cls.__name__)
        if not cls.__bases__:  # лише object не має батьків
            break
        cls = cls.__bases__[0]
    return " -> ".join(names)


print(chain(SalesEmployee))
print(chain(Person))
print(chain(object))
```

Результат:

```text
SalesEmployee -> Employee -> Person -> object
Person -> object
object
```

`object.__bases__` — порожній кортеж, і саме так цикл дізнається, що дійшов до вершини.

### Вправа 4

`Manager.__init__` замінює `Person.__init__`, тому `self.name` ніколи не встановлюється, і `greet()` генерує `AttributeError: 'Manager' object has no attribute 'name'`. Встановіть атрибут у дочірньому класі (або, як показано в темі про `super()`, викличте `__init__` батька):

```python
class Person:
    def __init__(self, name):
        self.name = name

    def greet(self):
        return f"Hi, it's {self.name}"


class Manager(Person):
    def __init__(self, name, team_size):
        self.name = name
        self.team_size = team_size


boss = Manager("Iryna", 5)
print(boss.greet())
print(boss.team_size)
```

Результат:

```text
Hi, it's Iryna
5
```

---

*Джерело: [pythontutorial.net — Python Inheritance](https://www.pythontutorial.net/python-oop/python-inheritance/). Адаптовано й доповнено для PyJourney.*
