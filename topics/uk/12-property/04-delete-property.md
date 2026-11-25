# Видалення властивості

Властивість може контролювати не лише читання й запис, а й **видалення**. Коли код виконує `del obj.prop`, Python викликає **делітер** (deleter) властивості. Що саме означає «видалити», вирішуєте ви: прибрати збережене значення, повернути типове, очистити кеш, закрити ресурс або взагалі заборонити видалення.

## Що ви дізнаєтесь

- Що робить `del obj.attr` для звичайного атрибута і для властивості
- Як додати делітер через `@<name>.deleter` (або `property(fdel=...)`)
- Який вигляд має об'єкт після видалення властивості і як зрозуміло про це повідомити
- Що корисного, крім видалення, може робити делітер: повертати типове значення, очищати кеш
- Чому `del obj.prop` впливає на один екземпляр, а `del Class.prop` прибирає саму властивість
- Що буває, коли у властивості немає делітера

## `del` для звичайного атрибута

Для звичайного атрибута `del obj.attr` прибирає запис зі словника `__dict__` екземпляра. Після цього прочитати атрибут не вдасться:

```python
class Point:
    def __init__(self, x):
        self.x = x


p = Point(5)
del p.x
print(p.__dict__)

try:
    print(p.x)
except AttributeError as error:
    print("AttributeError:", error)
```

Результат:

```text
{}
AttributeError: 'Point' object has no attribute 'x'
```

Будь-який код може зробити це з будь-яким звичайним атрибутом, і клас ніяк на це не впливає. Властивість це змінює: видалення проходить через написану вами функцію або взагалі заборонене.

## Додаємо делітер

Делітер — третя функція властивості поряд із гетером і сетером. Із декораторами його додають через `@<name>.deleter`, і працює він точнісінько як `@<name>.setter` (див. тему «Декоратор @property»):

```python
class Person:
    def __init__(self, name):
        self.name = name

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        if value.strip() == "":
            raise ValueError("The name cannot be empty")
        self._name = value

    @name.deleter
    def name(self):
        del self._name


person = Person("John")
print(person.__dict__)

del person.name  # викликає делітер
print(person.__dict__)
```

Результат:

```text
{'_name': 'John'}
{}
```

`del person.name` нічого не прибрав із класу. Python знайшов у класі властивість `name`, побачив, що вона має делітер, і викликав його. А делітер уже видалив атрибут **екземпляра** `_name`, у якому зберігалися справжні дані.

Без декораторів таку саму властивість створюють, передаючи делітер як `fdel`:

```python
class Person:
    def __init__(self, name):
        self._name = name

    def get_name(self):
        return self._name

    def del_name(self):
        del self._name

    name = property(get_name, fdel=del_name)


person = Person("John")
del person.name
print(person.__dict__)
print(Person.name.fdel.__name__)
```

Результат:

```text
{}
del_name
```

### Властивість лишається в класі

Словник класу так само містить рівно один запис для `name` — об'єкт властивості. Делітер, гетер і сетер живуть усередині нього:

```python
from pprint import pprint


class Person:
    def __init__(self, name):
        self.name = name

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        self._name = value

    @name.deleter
    def name(self):
        del self._name


pprint(Person.__dict__)
print(Person.name.fget.__name__, Person.name.fset.__name__, Person.name.fdel.__name__)
```

Результат (Python 3.14; адреси змінюються):

```text
mappingproxy({'__dict__': <attribute '__dict__' of 'Person' objects>,
              '__doc__': None,
              '__firstlineno__': 4,
              '__init__': <function Person.__init__ at 0x1051c5170>,
              '__module__': '__main__',
              '__static_attributes__': ('_name', 'name'),
              '__weakref__': <attribute '__weakref__' of 'Person' objects>,
              'name': <property object at 0x105144770>})
name name name
```

Оскільки властивість ніхто не чіпав, після видалення об'єкт може отримати нове значення. Сетер просто знову створить `_name`.

## Життя після видалення

Після `del person.name` гетер натрапляє на відсутній `_name`:

```python
class Person:
    def __init__(self, name):
        self.name = name

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        if value.strip() == "":
            raise ValueError("The name cannot be empty")
        self._name = value

    @name.deleter
    def name(self):
        del self._name


person = Person("John")
del person.name

try:
    print(person.name)
except AttributeError as error:
    print("AttributeError:", error)

print(hasattr(person, "name"))

try:
    del person.name
except AttributeError as error:
    print("AttributeError:", error)

person.name = "Jane"
print(person.name)
```

Результат:

```text
AttributeError: 'Person' object has no attribute '_name'
False
AttributeError: 'Person' object has no attribute '_name'
Jane
```

Тут відбувається кілька речей:

- Читання видаленої властивості генерує `AttributeError`. Це правильний тип винятку: завдяки йому коректно працюють `hasattr()` і `getattr(obj, name, default)`.
- Проте в повідомленні згадано `_name` — внутрішню деталь, якої користувач класу ніколи не писав.
- Повторне видалення теж завершується помилкою, бо делітер знову намагається видалити `_name`.
- Присвоєння нового значення працює, бо сетер знову створює `_name`.

Щоб повідомлення було зрозумілішим, перехопіть внутрішню помилку в гетері й згенеруйте власний `AttributeError`:

```python
class Person:
    def __init__(self, name):
        self.name = name

    @property
    def name(self):
        try:
            return self._name
        except AttributeError:
            raise AttributeError("The name has been deleted") from None

    @name.setter
    def name(self, value):
        self._name = value

    @name.deleter
    def name(self):
        del self._name


person = Person("John")
del person.name

try:
    print(person.name)
except AttributeError as error:
    print("AttributeError:", error)
print(getattr(person, "name", "<no name>"))
```

Результат:

```text
AttributeError: The name has been deleted
<no name>
```

`from None` прибирає початкову помилку про `_name` із трасування (traceback), тож користувач бачить лише зрозуміле йому повідомлення.

## Видалення як «скидання»

«Видалити» не обов'язково означає «прибрати». Поширене практичне застосування делітера — **скинути** значення до типового. Уявіть налаштування, яке користувач може змінити, а `del` повертає типове значення:

```python
class Settings:
    DEFAULT_THEME = "light"

    def __init__(self):
        self._theme = None  # None означає «користувач нічого не обрав»

    @property
    def theme(self):
        if self._theme is None:
            return self.DEFAULT_THEME
        return self._theme

    @theme.setter
    def theme(self, value):
        if value not in ("light", "dark"):
            raise ValueError(f"Unknown theme: {value!r}")
        self._theme = value

    @theme.deleter
    def theme(self):
        self._theme = None


settings = Settings()
print(settings.theme)

settings.theme = "dark"
print(settings.theme)

del settings.theme
print(settings.theme)

del settings.theme  # повторне скидання нічим не шкодить
print(settings.theme, settings.__dict__)
```

Результат:

```text
light
dark
light
light {'_theme': None}
```

Тут делітер узагалі нічого не видаляє. Він стирає вибір користувача, і гетер повертається до типового значення. Оскільки делітер лише присвоює `None`, повторне видалення безпечне, а це часто зручніше, ніж генерувати помилку.

Ще одне часте застосування — очищення кешу: `del report.total` може означати «забудь закешоване значення й обчисли його знову під час наступного читання», так само як `del obj.attr` працює для `functools.cached_property` (див. тему «Властивості лише для читання»). Таку властивість ви напишете у вправах.

## Видалення з екземпляра і з класу

Делітер виконується лише тоді, коли атрибут видаляють через **екземпляр**. Він впливає на дані цього екземпляра і ні на що інше:

```python
class Person:
    def __init__(self, name):
        self.name = name

    @property
    def name(self):
        return self._name

    @name.setter
    def name(self, value):
        if value.strip() == "":
            raise ValueError("The name cannot be empty")
        self._name = value

    @name.deleter
    def name(self):
        del self._name


john = Person("John")
jane = Person("Jane")

del john.name
print(john.__dict__, jane.__dict__)

del Person.name  # прибирає саму властивість із класу
print("name" in Person.__dict__)

jane.name = ""   # властивості більше немає: жодної перевірки
print(jane.__dict__)
```

Результат:

```text
{} {'_name': 'Jane'}
False
{'_name': 'Jane', 'name': ''}
```

- `del john.name` викликав делітер лише для `john`. У `jane` ім'я лишилося.
- `del Person.name` — звичайне видалення **атрибута класу**. Делітер *не* викликається; з класу зникає весь об'єкт властивості.
- Після цього `jane.name = ""` створює звичайний атрибут екземпляра: ні сетера, ні перевірки. Такого майже ніколи не хочуть, тож не видаляйте властивості з класів.

## Властивості без делітера

Якщо властивість не має делітера, `del` завершується помилкою, навіть коли сетер у неї є:

```python
class Account:
    def __init__(self, owner):
        self.owner = owner

    @property
    def owner(self):
        return self._owner

    @owner.setter
    def owner(self, value):
        self._owner = value


account = Account("Ann")
try:
    del account.owner
except AttributeError as error:
    print("AttributeError:", error)
print(account.owner)
```

Результат (Python 3.11+; старіші версії пишуть `can't delete attribute`):

```text
AttributeError: property 'owner' of 'Account' object has no deleter
Ann
```

Це корисна поведінка за замовчуванням. Звичайний атрибут може видалити будь-хто, і об'єкт після цього лишиться напівзламаним. Властивість робить видалення **доступним лише за явним рішенням**: воно можливе тільки тоді, коли автор класу написав делітер. Тож додавайте делітер лише тоді, коли видалення має для вашого класу чіткий зміст.

## Типові помилки

- **Видаляти саму властивість усередині делітера.** `del self.name` усередині делітера `name` знову викликає той самий делітер, і так без кінця:

  ```python
  class Person:
      def __init__(self, name):
          self._name = name

      @property
      def name(self):
          return self._name

      @name.deleter
      def name(self):
          del self.name  # помилка: має бути del self._name


  try:
      del Person("John").name
  except RecursionError as error:
      print("RecursionError:", error)
  ```

  Результат:

  ```text
  RecursionError: maximum recursion depth exceeded
  ```

  Видаляйте атрибут-сховище: `del self._name`.

- **Давати делітеру інше ім'я.** Як і з сетерами, `@name.deleter` має декорувати метод із назвою `name`. Інакше під іншою назвою з'явиться друга властивість, а в `name` делітера так і не буде.
- **Показувати у повідомленнях внутрішні імена.** Після видалення гетер падає з `... has no attribute '_name'`. Якщо користувачі можуть читати видалену властивість, генеруйте власний `AttributeError` зі зрозумілим повідомленням.
- **Генерувати не той виняток для відсутнього значення.** Якщо гетер генерує `KeyError` чи `ValueError` замість `AttributeError`, `hasattr()` і `getattr(obj, name, default)` перестають працювати й пропускають цей виняток далі.
- **Видаляти властивість із класу.** `del Person.name` прибирає властивість для всіх екземплярів і непомітно перетворює присвоєння з перевіркою на звичайні.
- **Додавати делітер «про всяк випадок».** Без делітера видалення заборонене, і зазвичай саме це вам і потрібно.

## Підсумок

- `del obj.prop` для властивості викликає її делітер (`fdel`); без делітера генерується `AttributeError: property '...' of '...' object has no deleter`.
- Делітер додають через `@prop.deleter` над методом з ім'ям властивості або через `property(fget, fset, fdel)`.
- Зазвичай делітер видаляє або скидає атрибут-сховище (`_name`); об'єкт властивості лишається в класі, тож згодом сетер може зберегти нове значення.
- Після видалення нехай гетер генерує зрозумілий `AttributeError`: так `hasattr()` і `getattr()` працюватимуть правильно.
- Замість видалення делітер може повертати типове значення або очищати кеш.
- `del instance.prop` впливає на один екземпляр; `del Class.prop` прибирає всю властивість разом із перевіркою.

## Практика

### Вправа 1: Необов'язковий номер телефону

Напишіть клас `Contact` з `name` (звичайний атрибут) і необов'язковою властивістю `phone`:

- `Contact("Ann")` не має телефону, і `contact.phone` повертає `None`;
- сетер прибирає пробіли й генерує `ValueError("Phone must contain 10 digits")`, якщо не лишилося рівно 10 цифр;
- `del contact.phone` прибирає номер, тож `contact.phone` знову повертає `None`. Видалення відсутнього номера не має спричиняти помилку.

### Вправа 2: Кеш, який можна очистити

Напишіть клас `Report`, що отримує список чисел `rows`. Додайте властивість лише для читання `total`, яка під час першого читання обчислює `sum(rows)`, виводить `"summing..."`, коли справді рахує, і кешує результат. Додайте делітер, що очищає кеш, щоб наступне читання обчислювало знову. Покажіть, що після `report.rows.append(...)` повертається старий підсумок, доки ви не виконаєте `del report.total`.

### Вправа 3: Передбачте результат

Передбачте кожен рядок, потім запустіть код.

```python
class Box:
    def __init__(self, label):
        self.label = label

    @property
    def label(self):
        return self._label

    @label.setter
    def label(self, value):
        self._label = value.upper()

    @label.deleter
    def label(self):
        print("deleting", self._label)
        del self._label


box = Box("fragile")
print(box.label)
del box.label
print(hasattr(box, "label"), box.__dict__)
box.label = "glass"
print(box.label)
print(type(Box.__dict__["label"]).__name__)
```

### Вправа 4: Закриття лінивого з'єднання

Дано клас-імітацію з'єднання:

```python
class Connection:
    def __init__(self, url):
        self.url = url
        print(f"open {url}")

    def close(self):
        print(f"close {self.url}")
```

Напишіть клас `Client(url)` із властивістю `connection`:

- з'єднання відкривається ліниво, під час першого читання, а наступні читання повертають той самий об'єкт;
- `del client.connection` закриває з'єднання, і наступне читання відкриває нове;
- видалення, коли жодне з'єднання не відкрите, нічого не робить.

## Розв'язки

### Вправа 1

```python
class Contact:
    def __init__(self, name, phone=None):
        self.name = name
        self._phone = None
        if phone is not None:
            self.phone = phone

    @property
    def phone(self):
        return self._phone

    @phone.setter
    def phone(self, value):
        digits = value.replace(" ", "")
        if len(digits) != 10 or not digits.isdigit():
            raise ValueError("Phone must contain 10 digits")
        self._phone = digits

    @phone.deleter
    def phone(self):
        self._phone = None


ann = Contact("Ann")
print(ann.phone)

ann.phone = "067 123 45 67"
print(ann.phone)

try:
    ann.phone = "12-34"
except ValueError as error:
    print("ValueError:", error)

del ann.phone
del ann.phone  # видалення відсутнього номера — не проблема
print(ann.phone)
```

Результат:

```text
None
0671234567
ValueError: Phone must contain 10 digits
None
```

Якщо присвоювати `_phone = None` замість видалення атрибута, гетер лишається простим, а делітер можна безпечно викликати скільки завгодно разів.

### Вправа 2

```python
class Report:
    def __init__(self, rows):
        self.rows = rows
        self._total = None

    @property
    def total(self):
        if self._total is None:
            print("summing...")
            self._total = sum(self.rows)
        return self._total

    @total.deleter
    def total(self):
        self._total = None


report = Report([10, 20, 30])
print(report.total)
print(report.total)

report.rows.append(40)
print(report.total)  # застаріле значення

del report.total
print(report.total)

try:
    report.total = 0
except AttributeError as error:
    print("AttributeError:", error)
```

Результат:

```text
summing...
60
60
60
summing...
100
AttributeError: property 'total' of 'Report' object has no setter
```

Властивість має гетер і делітер, але не має сетера: користувачі можуть прочитати підсумок і попросити його перерахувати, але не можуть присвоїти підроблене значення.

### Вправа 3

Результат:

```text
FRAGILE
deleting FRAGILE
False {}
GLASS
property
```

- Сетер зберігає мітки у верхньому регістрі, тож `box.label` дорівнює `"FRAGILE"`.
- `del box.label` викликає делітер, який виводить повідомлення й видаляє `_label`.
- Тепер гетер генерує `AttributeError`, тому `hasattr()` повертає `False`, а словник екземпляра порожній.
- Властивість і далі живе в класі, тож присвоєння `"glass"` знову проходить через сетер.

### Вправа 4

```python
class Connection:
    def __init__(self, url):
        self.url = url
        print(f"open {url}")

    def close(self):
        print(f"close {self.url}")


class Client:
    def __init__(self, url):
        self._url = url
        self._connection = None

    @property
    def connection(self):
        if self._connection is None:
            self._connection = Connection(self._url)
        return self._connection

    @connection.deleter
    def connection(self):
        if self._connection is not None:
            self._connection.close()
            self._connection = None


client = Client("db://localhost")
print("client created")

first = client.connection
print(first is client.connection)

del client.connection
del client.connection  # нічого не відкрито: нічого не відбувається

second = client.connection
print(first is second)
```

Результат:

```text
client created
open db://localhost
True
close db://localhost
open db://localhost
False
```

Жодне з'єднання не відкривається до першого читання. Делітер звільняє ресурс і скидає кеш, тож наступне читання відкриває нове з'єднання.

---

*Джерело: [pythontutorial.net — How to Delete a Property from an Object in Python](https://www.pythontutorial.net/python-oop/python-delete-property/). Адаптовано й доповнено для PyJourney.*
