# Метаклас

**Метаклас** (metaclass) — це клас, екземплярами якого є класи. Кожен ваш клас створює метаклас, зазвичай `type`. Написавши власний метаклас, ви можете втрутитися в момент створення класу і змінити його: додати атрибути, перевірити правила, зареєструвати клас у якомусь реєстрі. Це потужний інструмент, але для більшості таких завдань сучасний Python має простіші альтернативи, тож варто знати і те, і те.

## Що ви дізнаєтесь

- Як ключове слово `metaclass=` визначає метаклас класу
- Як написати власний метаклас, успадкувавшись від `type` і перевизначивши `__new__`
- Коли виконується код метакласу і чому підкласи використовують той самий метаклас
- Як передати метакласу іменовані аргументи
- Чотири гачки метакласу: `__prepare__`, `__new__`, `__init__` і `__call__`
- Коли потрібен метаклас, а коли краще обрати `__init_subclass__` чи декоратор класу

## Метаклас за замовчуванням: `type`

Коли Python виконує інструкцію `class`, він створює клас, викликаючи його метаклас. Якщо ви його не вказали, метакласом буде `type`. Ці два визначення рівнозначні:

```python
class Person:
    pass


class Person2(object, metaclass=type):
    pass


print(type(Person), type(Person2))
```

Результат:

```text
<class 'type'> <class 'type'>
```

Ключове слово `metaclass` у заголовку класу каже Python, який клас має збудувати цей клас. Передайте туди підклас `type`, і саме він вирішуватиме, як створюється клас.

```text
метаклас  --створює-->  клас    --створює-->  екземпляр
  type                  Person                Person("John", 25)
  Human                 Person                Person("John", 25)
```

## Власний метаклас

Метаклас — це клас, що успадковується від `type`. Найчастіше в ньому перевизначають гачок `__new__`, який створює об'єкт класу. Метаклас нижче додає кожному класу, який він будує, атрибут `freedom = True`:

```python
class Human(type):
    def __new__(mcs, name, bases, class_dict):
        print(f"Human.__new__: building class {name!r}")
        class_ = super().__new__(mcs, name, bases, class_dict)
        class_.freedom = True
        return class_


class Person(object, metaclass=Human):
    def __init__(self, name, age):
        self.name = name
        self.age = age


print(type(Person))
print(Person.freedom)
print(list(Person.__dict__))

john = Person("John", 25)
print(john.freedom, type(john).__name__)
```

Результат (Python 3.14):

```text
Human.__new__: building class 'Person'
<class '__main__.Human'>
True
['__module__', '__firstlineno__', '__init__', '__static_attributes__', '__dict__', '__weakref__', '__doc__', 'freedom']
True Person
```

Параметри методу `__new__` метакласу — це рівно аргументи виклику `type(name, bases, namespace)` з попередньої теми:

| Параметр | Значення | Тут |
|---|---|---|
| `mcs` | сам метаклас (як `cls` у звичайному `__new__`) | `Human` |
| `name` | назва класу, що створюється | `"Person"` |
| `bases` | кортеж базових класів | `(object,)` |
| `class_dict` | простір імен, заповнений тілом класу | `{'__init__': ..., ...}` |

`super().__new__(mcs, name, bases, class_dict)` доручає `type` створити справжній об'єкт класу. Перш ніж повернути його, `Human` додає `freedom`. Зверніть увагу на відмінність від методу `__new__` звичайного класу: `__new__` метакласу повертає новий **клас**, а не екземпляр.

> **Зверніть увагу:** перший параметр часто називають `mcs`, `mcls` або `metacls`, щоб підкреслити, що це метаклас. Назва — лише домовленість.

### Коли виконується код метакласу

Подивіться на перший рядок результату вище: `Human.__new__` виконався **під час визначення класу**, ще до того, як з'явився хоч один об'єкт `Person`. Метаклас працює в момент створення класу, один раз для кожного класу. Створення екземплярів не викликає `__new__` метакласу знову.

### Підкласи успадковують метаклас

Метаклас класу успадковують його підкласи, тому метаклас будує і кожен підклас:

```python
class Human(type):
    def __new__(mcs, name, bases, class_dict):
        print(f"Human.__new__: building class {name!r}")
        class_ = super().__new__(mcs, name, bases, class_dict)
        class_.freedom = True
        return class_


class Person(metaclass=Human):
    pass


class Student(Person):
    pass


print(type(Student).__name__)
print(Student.freedom, "freedom" in Student.__dict__)
```

Результат:

```text
Human.__new__: building class 'Person'
Human.__new__: building class 'Student'
Human
True True
```

`Student` ніде не згадує `Human`, проте саме `Human` його збудував і записав `freedom` безпосередньо в його `__dict__`. Це головне, що може метаклас і чого не може простий декоратор класу: він автоматично охоплює **всю ієрархію**.

## Передавання аргументів метакласу

Додаткові іменовані аргументи в заголовку класу, крім `metaclass=`, передаються метакласу. Тут кожен такий аргумент стає атрибутом класу:

```python
class Human(type):
    def __new__(mcs, name, bases, class_dict, **kwargs):
        class_ = super().__new__(mcs, name, bases, class_dict)
        for key, value in kwargs.items():
            setattr(class_, key, value)
        return class_


class Person(object, metaclass=Human, country="USA", freedom=True):
    def __init__(self, name, age):
        self.name = name
        self.age = age


print(Person.country, Person.freedom)
print(list(Person.__dict__))
```

Результат (Python 3.14):

```text
USA True
['__module__', '__firstlineno__', '__init__', '__static_attributes__', '__dict__', '__weakref__', '__doc__', 'country', 'freedom']
```

Тут важливі дві деталі:

- `Human.__new__` **забирає** ці аргументи собі й не передає їх далі в `type.__new__`. Якщо їх передати, `type.__new__` віддасть їх гачку `__init_subclass__` базового класу, а `object.__init_subclass__` не приймає іменованих аргументів (див. розділ *Типові помилки*).
- Змінна циклу називається `key`, а не `name`. Якби ми повторно використали `name`, то непомітно перезаписали б параметр із назвою класу всередині методу.

## Чотири гачки метакласу

`__new__` — лише один із методів, які може перевизначити метаклас. Цей «трасувальник» показує всі чотири в тому порядку, в якому їх викликає Python:

```python
class Tracer(type):
    @classmethod
    def __prepare__(mcs, name, bases, **kwargs):
        print(f"1. __prepare__: namespace for {name}")
        return {}

    def __new__(mcs, name, bases, namespace, **kwargs):
        own = [key for key in namespace if not key.startswith("__")]
        print(f"2. __new__: creating class {name} with {own}")
        return super().__new__(mcs, name, bases, namespace)

    def __init__(cls, name, bases, namespace, **kwargs):
        print(f"3. __init__: class {name} is ready")
        super().__init__(name, bases, namespace)

    def __call__(cls, *args, **kwargs):
        print(f"4. __call__: creating an instance of {cls.__name__}")
        return super().__call__(*args, **kwargs)


print("Defining the class...")


class Point(metaclass=Tracer):
    dimensions = 2

    def __init__(self, x, y):
        self.x = x
        self.y = y


print("Creating an instance...")
p = Point(1, 2)
print(p.x, p.y)
```

Результат:

```text
Defining the class...
1. __prepare__: namespace for Point
2. __new__: creating class Point with ['dimensions']
3. __init__: class Point is ready
Creating an instance...
4. __call__: creating an instance of Point
1 2
```

| Гачок | Коли виконується | Для чого |
|---|---|---|
| `__prepare__(mcs, name, bases, **kw)` | до виконання тіла класу | повертає відображення, що слугуватиме простором імен класу (має бути `classmethod`) |
| `__new__(mcs, name, bases, ns, **kw)` | після виконання тіла | створює й повертає об'єкт класу; може попередньо змінити `ns` |
| `__init__(cls, name, bases, ns, **kw)` | одразу після `__new__` | доналаштовує вже створений клас |
| `__call__(cls, *args, **kw)` | щоразу, коли **викликають клас** | запускає `cls.__new__` і `cls.__init__`, щоб створити екземпляр |

Останній рядок пов'язує цю тему з темою про метод `__new__`: виклик класу запускає `type.__call__`, і саме там живе двокроковий процес «спершу `__new__`, потім `__init__`». Метаклас, що перевизначає `__call__`, керує створенням *екземплярів*, наприклад кешує їх.

`__prepare__` сьогодні потрібен рідко. Починаючи з Python 3.6 простір імен класу — звичайний словник, який зберігає порядок визначення, а саме це колись було головною причиною його перевизначати.

## Практичний приклад: реєстр плагінів

Фреймворкам часто потрібен перелік усіх підкласів певного базового класу, наприклад усіх експортерів чи всіх моделей бази даних. Метаклас може записувати кожен клас, який він будує:

```python
class PluginMeta(type):
    registry = {}

    def __new__(mcs, name, bases, namespace):
        cls = super().__new__(mcs, name, bases, namespace)
        if bases:  # пропускаємо сам базовий клас
            mcs.registry[name.lower()] = cls
        return cls


class Plugin(metaclass=PluginMeta):
    pass


class CsvExporter(Plugin):
    pass


class JsonExporter(Plugin):
    pass


print(PluginMeta.registry)
exporter = PluginMeta.registry["jsonexporter"]()
print(type(exporter).__name__)
```

Результат:

```text
{'csvexporter': <class '__main__.CsvExporter'>, 'jsonexporter': <class '__main__.JsonExporter'>}
JsonExporter
```

Щоб зареєструвати підклас, досить його визначити. Немає жодного списку, який треба оновлювати вручну.

## Простіші альтернативи

Більшість того, що колись робили метакласами, тепер має легші інструменти.

### `__init_subclass__` (Python 3.6+)

Базовий клас може визначити `__init_subclass__`. Python викликає його щоразу, коли створюється підклас, і жоден метаклас для цього не потрібен. Реєстр вище перетворюється на:

```python
class Plugin:
    registry = {}

    def __init_subclass__(cls, **kwargs):
        super().__init_subclass__(**kwargs)
        Plugin.registry[cls.__name__.lower()] = cls


class CsvExporter(Plugin):
    pass


class JsonExporter(Plugin):
    pass


print(Plugin.registry)
print(type(CsvExporter))
```

Результат:

```text
{'csvexporter': <class '__main__.CsvExporter'>, 'jsonexporter': <class '__main__.JsonExporter'>}
<class 'type'>
```

Поведінка та сама, але класи зберігають звичайний метаклас `type`, тож їх вільно можна поєднувати з іншими класами. `__init_subclass__` також уміє приймати іменовані аргументи із заголовка класу (як саме — показано у вправі 4).

### Декоратори класів

Щоб змінити **один** клас після створення, досить декоратора класу:

```python
def free(cls):
    cls.freedom = True
    return cls


@free
class Person:
    pass


class Student(Person):
    pass


print(Person.freedom, type(Person).__name__)
print(Student.freedom, "freedom" in Student.__dict__)
```

Результат:

```text
True type
True False
```

Декоратор спрацював лише для `Person`. `Student` просто *успадковує* атрибут, і для нього декоратор не запускався б. Використовуйте декоратор, коли зміна локальна, а метаклас (або `__init_subclass__`) — коли вона має стосуватися кожного підкласу.

### Метакласи, якими ви вже користуєтеся

Стандартна бібліотека використовує метакласи, щоб вам не довелося писати їх самостійно:

```python
import abc
import enum

print(type(abc.ABC))
print(type(enum.Enum))
print(issubclass(abc.ABCMeta, type), issubclass(enum.EnumType, type))
```

Результат:

```text
<class 'abc.ABCMeta'>
<class 'enum.EnumType'>
True True
```

Абстрактні базові класи та переліки (enum) отримують свою особливу поведінку саме від цих метакласів.

## Коли використовувати метакласи

Тім Пітерс (Tim Peters), автор «Дзену Python», сказав так:

> Metaclasses are deeper magic than 99% of users should ever worry about. If you wonder whether you need them, you don't (the people who actually need them know with certainty that they need them, and don't need an explanation about why).

Тобто: метакласи — це глибша магія, ніж те, про що має турбуватися 99% користувачів. Якщо ви сумніваєтеся, чи потрібні вони вам, то вони вам не потрібні (ті, кому вони справді потрібні, знають це напевно і не потребують пояснень чому).

Практичний порядок вибору:

1. Звичайний клас, функція або `@dataclass`.
2. Декоратор класу, якщо треба підлаштувати один клас.
3. `__init_subclass__`, якщо кожен підклас базового класу треба перевірити чи зареєструвати.
4. Метаклас, якщо потрібне те, що вміє лише метаклас: керувати простором імен класу (`__prepare__`), змінювати створення екземплярів для цілої ієрархії (`__call__`) або налаштовувати поведінку самого об'єкта класу. Зазвичай таке трапляється всередині фреймворків і бібліотек, наприклад ORM.

## Типові помилки

- **Передавати власні іменовані аргументи в `type.__new__`.** Вони потрапляють у `__init_subclass__`, який їх не приймає:

  ```python
  class Human(type):
      def __new__(mcs, name, bases, class_dict, **kwargs):
          return super().__new__(mcs, name, bases, class_dict, **kwargs)


  class Person(metaclass=Human, country="USA"):
      pass
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    File "app.py", line 6, in <module>
      class Person(metaclass=Human, country="USA"):
          pass
    File "app.py", line 3, in __new__
      return super().__new__(mcs, name, bases, class_dict, **kwargs)
             ~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  TypeError: Person.__init_subclass__() takes no keyword arguments
  ```

- **Забути повернути клас із `__new__`.** Тоді інструкція `class` прив'язує ім'я до `None`:

  ```python
  class Human(type):
      def __new__(mcs, name, bases, class_dict):
          class_ = super().__new__(mcs, name, bases, class_dict)
          class_.freedom = True
          # забули: return class_


  class Person(metaclass=Human):
      pass


  print(Person)
  ```

  Результат:

  ```text
  None
  ```

- **Змішувати класи з непов'язаними метакласами.** Клас може мати лише один метаклас, і той має бути сумісним із метакласами всіх базових класів:

  ```python
  class MetaA(type):
      pass


  class MetaB(type):
      pass


  class A(metaclass=MetaA):
      pass


  class B(metaclass=MetaB):
      pass


  class C(A, B):
      pass
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    File "app.py", line 17, in <module>
      class C(A, B):
          pass
  TypeError: metaclass conflict: the metaclass of a derived class must be a (non-strict) subclass of the metaclasses of all its bases
  ```

  Виправлення — метаклас, що успадковується від обох (`class MetaAB(MetaA, MetaB): pass`). Такі конфлікти — вагома причина віддавати перевагу `__init_subclass__`, адже з ним метакласом лишається звичайний `type`.

- **Плутати два різні `__new__`.** `__new__` метакласу створює *клас* і виконується один раз для кожного визначення класу. Власний `__new__` класу створює *екземпляри* і виконується під час кожного виклику.
- **Хапатися за метаклас першим.** Якщо задачу розв'язує декоратор або `__init_subclass__`, код буде коротшим і легше поєднуватиметься з іншими класами.

## Підсумок

- Метаклас — це клас класу. Метаклас за замовчуванням — `type`, і `class Person:` означає `class Person(object, metaclass=type):`.
- Власний метаклас успадковується від `type`. Його `__new__(mcs, name, bases, namespace)` створює об'єкт класу і має його повернути.
- Код метакласу виконується під час **визначення** класу, один раз для кожного класу, а сам метаклас успадковують усі підкласи.
- Додаткові іменовані аргументи в заголовку класу (`class A(metaclass=M, key=value)`) потрапляють у гачки метакласу. Не передавайте їх далі в `type.__new__`.
- Гачки виконуються в такому порядку: `__prepare__`, `__new__`, `__init__` під час визначення класу, а потім `__call__` під час кожного виклику класу.
- `__init_subclass__` і декоратори класів покривають більшість колишніх застосувань метакласів із меншим ризиком.
- На метакласах побудовані `abc.ABC` і `enum.Enum`. Пишіть власний, лише коли простіші інструменти не впораються.

## Практика

### Вправа 1: Передбачте результат

Не запускаючи код, запишіть, що він виведе і в якому порядку.

```python
class Loud(type):
    def __new__(mcs, name, bases, namespace):
        print("creating class", name)
        return super().__new__(mcs, name, bases, namespace)


print("start")


class Base(metaclass=Loud):
    pass


class Child(Base):
    pass


print("instances")
a = Base()
b = Child()
print(type(Child).__name__, type(b).__name__)
```

### Вправа 2: Фінальний клас

Напишіть метаклас `Final`. Клас, створений із `metaclass=Final`, має працювати як звичайно, але будь-яка спроба успадкуватися від нього має генерувати `TypeError("cannot inherit from final class <Name>")` у момент визначення підкласу.

### Вправа 3: Документація обов'язкова

Напишіть метаклас `RequireDocs`, який відмовляється створювати клас (генерує `TypeError`), якщо клас не має докстрінга (docstring) або якщо будь-який публічний метод (об'єкт, який можна викликати, і чия назва не починається з `_`), визначений у тілі класу, не має докстрінга. Перевірте його на одному повністю задокументованому класі та двох «зламаних».

### Вправа 4: Реєстр без метакласу

Перепишіть реєстр плагінів через `__init_subclass__` так, щоб кожен підклас обирав свій ключ у заголовку класу: `class CsvExporter(Exporter, key="csv")`. Зберігайте класи в `Exporter.registry`, генеруйте `ValueError` для ключа, який уже зайнятий, і напишіть функцію `export(fmt, rows)`, що обирає експортер за ключем. Реалізуйте експортери у CSV та JSON.

## Розв'язки

### Вправа 1

Результат:

```text
start
creating class Base
creating class Child
instances
Loud Child
```

Метаклас працює, поки класи *визначаються*, тому обидва рядки «creating class» з'являються до `"instances"`. `Child` успадковує метаклас `Loud` від `Base`. Створення екземплярів узагалі не викликає `Loud.__new__`.

### Вправа 2

```python
class Final(type):
    def __new__(mcs, name, bases, namespace):
        for base in bases:
            if isinstance(base, Final):
                raise TypeError(f"cannot inherit from final class {base.__name__}")
        return super().__new__(mcs, name, bases, namespace)


class Settings(metaclass=Final):
    debug = False


print(Settings.debug)

try:
    class MySettings(Settings):
        pass
except TypeError as error:
    print("Error:", error)
```

Результат:

```text
False
Error: cannot inherit from final class Settings
```

`isinstance(base, Final)` питає: «чи цей базовий клас збудував `Final`?». `Settings` збудував саме він, тож його підклас відхиляється. Для статичних аналізаторів типів у стандартній бібліотеці є декоратор `typing.final`, який позначає той самий намір, але без перевірки під час виконання.

### Вправа 3

```python
class RequireDocs(type):
    def __new__(mcs, name, bases, namespace):
        if not namespace.get("__doc__"):
            raise TypeError(f"class {name} has no docstring")
        for attr, value in namespace.items():
            if callable(value) and not attr.startswith("_") and not value.__doc__:
                raise TypeError(f"method {name}.{attr}() has no docstring")
        return super().__new__(mcs, name, bases, namespace)


class Invoice(metaclass=RequireDocs):
    """An invoice for one customer."""

    def total(self):
        """Return the total amount."""
        return 0


print("Invoice created")

try:
    class Receipt(metaclass=RequireDocs):
        """A payment receipt."""

        def print_copy(self):
            pass
except TypeError as error:
    print("Error:", error)

try:
    class Note(metaclass=RequireDocs):
        pass
except TypeError as error:
    print("Error:", error)
```

Результат:

```text
Invoice created
Error: method Receipt.print_copy() has no docstring
Error: class Note has no docstring
```

Докстрінг у тілі класу зберігається в просторі імен під ключем `__doc__`, тому метаклас може перевірити його ще до того, як клас з'явиться.

### Вправа 4

```python
import json


class Exporter:
    registry = {}

    def __init_subclass__(cls, /, key, **kwargs):
        super().__init_subclass__(**kwargs)
        if key in Exporter.registry:
            raise ValueError(f"duplicate exporter key: {key!r}")
        Exporter.registry[key] = cls


class CsvExporter(Exporter, key="csv"):
    def export(self, rows):
        return "\n".join(",".join(map(str, row)) for row in rows)


class JsonExporter(Exporter, key="json"):
    def export(self, rows):
        return json.dumps(rows)


def export(fmt, rows):
    return Exporter.registry[fmt]().export(rows)


print(sorted(Exporter.registry))
print(export("csv", [[1, 2], [3, 4]]))
print(export("json", [[1, 2], [3, 4]]))

try:
    class AnotherCsv(Exporter, key="csv"):
        pass
except ValueError as error:
    print("Error:", error)
```

Результат:

```text
['csv', 'json']
1,2
3,4
[[1, 2], [3, 4]]
Error: duplicate exporter key: 'csv'
```

`__init_subclass__` неявно є методом класу, тому `cls` — це новий підклас. Аргумент `key` із заголовка класу надходить як звичайний параметр, а решту іменованих аргументів передаємо далі ланцюжком через `super().__init_subclass__(**kwargs)`.

---

*Джерело: [pythontutorial.net — Python Metaclass](https://www.pythontutorial.net/python-oop/python-metaclass/). Адаптовано й доповнено для PyJourney.*
