# Дескриптори даних і не-даних

Дескриптори бувають двох видів, і різниця між ними — лише в одному методі: дескриптор, що вміє перехоплювати **присвоєння** чи **видалення**, — це *дескриптор даних* (data descriptor), а той, що перехоплює лише **читання**, — *дескриптор не-даних* (non-data descriptor). Від виду залежить, хто переможе, коли в екземпляра є власне значення з тим самим ім'ям. Одне це правило пояснює, чому метод можна перевизначити для окремого об'єкта, а властивість приховати не можна, і як працює `functools.cached_property`.

## Що ви дізнаєтесь

- За яким точним правилом дескриптор є дескриптором даних чи не-даних і як це перевірити
- У якому повному порядку Python шукає `obj.attr` і чим присвоєння та видалення відрізняються від читання
- Чому атрибут екземпляра може приховати метод, але не властивість
- Як функція стає зв'язаним методом завдяки `__get__`
- Як дескриптор не-даних може обчислити значення один раз і закешувати його, як це робить `functools.cached_property`
- Типові пастки: дескриптори «лише для читання», які такими не є, і присвоєння через клас

## Два види дескрипторів

Згадаймо з теми «Дескриптори»: дескриптор — це атрибут класу, тип якого визначає `__get__`, `__set__` та/або `__delete__`. Для класифікації важать лише два останні:

- **Дескриптор даних** визначає `__set__` чи `__delete__` (або обидва). Зазвичай він має й `__get__`.
- **Дескриптор не-даних** визначає лише `__get__`, тобто це будь-який дескриптор, що не є дескриптором даних.

`__set_name__` тут ролі не грає. Важливо лише, чи має метод **тип** дескриптора, і `inspect.isdatadescriptor()` перевіряє саме це:

```python
import inspect
from functools import cached_property


class OnlyGet:
    def __get__(self, instance, owner):
        return "value from __get__"


class GetSet:
    def __get__(self, instance, owner):
        return "value from __get__"

    def __set__(self, instance, value):
        pass


class GetDelete:
    def __get__(self, instance, owner):
        return "value from __get__"

    def __delete__(self, instance):
        pass


class Demo:
    only_get = OnlyGet()
    get_set = GetSet()
    get_delete = GetDelete()

    def method(self):
        pass

    @property
    def prop(self):
        return 42

    @cached_property
    def cached(self):
        return 42

    @classmethod
    def cmethod(cls):
        pass


for name in ("only_get", "get_set", "get_delete", "method", "prop", "cached", "cmethod"):
    raw = vars(Demo)[name]
    kind = "data" if inspect.isdatadescriptor(raw) else "non-data"
    print(f"{name:11} {type(raw).__name__:15} {kind}")
```

Результат:

```text
only_get    OnlyGet         non-data
get_set     GetSet          data
get_delete  GetDelete       data
method      function        non-data
prop        property        data
cached      cached_property non-data
cmethod     classmethod     non-data
```

Два результати заслуговують на увагу:

- `GetDelete` не має `__set__`, проте є дескриптором даних. Досить мати `__delete__`.
- `property` — дескриптор даних, навіть коли визначено лише гетер: тип `property` завжди має `__set__` і `__delete__`, які генерують `AttributeError`, якщо відповідної функції немає.

Функції, `classmethod`, `staticmethod` і `cached_property` — дескриптори не-даних.

## Дескриптори не-даних: перемагає атрибут екземпляра

Для дескриптора не-даних Python спершу заглядає у словник екземпляра `obj.__dict__`. Лише якщо імені там **немає**, він викликає `__get__` дескриптора.

Ось дескриптор, що рахує файли в теці щоразу, коли атрибут читають. Щоб результат був відтворюваним, приклад створює тимчасову теку з трьома файлами, а не рахує файли в `/`:

```python
import os
import tempfile


class FileCount:
    """Дескриптор не-даних: визначає лише __get__."""

    def __get__(self, instance, owner):
        if instance is None:
            return self
        print("FileCount.__get__ was called")
        return len(os.listdir(instance.path))


class Folder:
    count = FileCount()

    def __init__(self, path):
        self.path = path


with tempfile.TemporaryDirectory() as path:
    for name in ("a.txt", "b.txt", "c.txt"):
        open(os.path.join(path, name), "w").close()

    folder = Folder(path)
    print("file count:", folder.count)

    folder.__dict__["count"] = 100  # атрибут екземпляра з тим самим ім'ям
    print("file count:", folder.count)

    folder.count = 200  # звичайне присвоєння теж потрапляє в __dict__
    print("file count:", folder.count)

    del folder.count  # видаляємо атрибут екземпляра...
    print("file count:", folder.count)  # ...і дескриптор повертається
```

Результат:

```text
FileCount.__get__ was called
file count: 3
file count: 100
file count: 200
FileCount.__get__ was called
file count: 3
```

Що відбулося крок за кроком:

1. `folder.count`: у словнику екземпляра немає `count`, тож спрацьовує `FileCount.__get__` і рахує файли.
2. Після `folder.__dict__["count"] = 100` екземпляр має власний `count`. Python знаходить його першим і `__get__` не викликає взагалі.
3. `folder.count = 200` — звичайне присвоєння. `FileCount` не має `__set__`, тож ніщо його не перехоплює, і значення записується в `folder.__dict__`. Дескриптор не-даних не може ні перевіряти, ні блокувати присвоєння.
4. `del folder.count` видаляє атрибут екземпляра (знову без жодного перехоплення), і дескриптор знову стає видимим.

> **Зверніть увагу:** в оригінальному прикладі немає перевірки `if instance is None: return self`. Без неї читання `Folder.count` через клас викликає `__get__(None, Folder)` і завершується помилкою `AttributeError: 'NoneType' object has no attribute 'path'`.

## Дескриптори даних: перемагає дескриптор

Для дескриптора даних порядок зворотний: до дескриптора звертаються **раніше**, ніж до словника екземпляра, і під час читання, і під час запису. Запис із тим самим ім'ям в `obj.__dict__` просто ігнорується:

```python
class Coordinate:
    """Дескриптор даних: визначає __get__ і __set__."""

    def __set_name__(self, owner, name):
        self.name = name
        self.storage = "_" + name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        print(f"Coordinate.__get__ for {self.name}")
        return getattr(instance, self.storage, 0.0)

    def __set__(self, instance, value):
        print(f"Coordinate.__set__ for {self.name} = {value!r}")
        setattr(instance, self.storage, float(value))


class Point:
    x = Coordinate()
    y = Coordinate()


p = Point()
p.x = 10
print(p.x)

p.__dict__["x"] = 999  # пробуємо підсунути значення в обхід дескриптора
print(p.x)             # дескриптор однаково відповідає сам
print(p.__dict__)

try:
    del p.x  # Coordinate не має __delete__
except AttributeError as error:
    print("AttributeError:", error)
```

Результат:

```text
Coordinate.__set__ for x = 10
Coordinate.__get__ for x
10.0
Coordinate.__get__ for x
10.0
{'_x': 10.0, 'x': 999}
AttributeError: __delete__
```

- `p.x = 10` потрапило в `__set__`, який перетворив значення на `float` і зберіг його під ім'ям `_x`.
- Запис `"x": 999` лежить у словнику екземпляра, але `p.x` однаково викликає `__get__`: дескриптори даних мають пріоритет. Саме ця гарантія робить перевірку значень надійною: жоден атрибут екземпляра не може її обійти.
- `del p.x` не вдається: дескриптор перехоплює й видалення, а оскільки `__delete__` у нього немає, Python відмовляє, а не видаляє тихцем щось зі словника екземпляра.

> **Зверніть увагу:** в оригінальному посібнику це описано так: «Python спершу шукає в дескрипторі даних, а якщо не знаходить атрибута, шукає у словнику екземпляра». Насправді все не так. Якщо дескриптор даних має `__get__`, його результат остаточний, хай що він повертає. До словника екземпляра звертаються лише тоді, коли дескриптор даних **зовсім не має** `__get__` (рідкісний дескриптор лише з `__set__`), і в такому разі, якщо запису немає й у словнику, повертається сам об'єкт дескриптора.

## Повний порядок пошуку

Читання `obj.attr` обробляє `object.__getattribute__`. Об'єднавши обидва правила, отримуємо:

```text
obj.attr
 0. шукаємо "attr" у type(obj) та його базових класах (MRO) -> атрибут класу, якщо є
 1. це дескриптор даних (з __get__)                         -> повертаємо його __get__(obj, type(obj))
 2. "attr" є в obj.__dict__                                 -> повертаємо це значення
 3. це дескриптор не-даних                                  -> повертаємо його __get__(obj, type(obj))
 4. це звичайний атрибут класу                              -> повертаємо його як є
 5. нічого не знайдено                                      -> AttributeError (потім __getattr__, якщо визначено)
```

Запис і видалення простіші, бо в них беруть участь лише дескриптори даних:

```text
obj.attr = value
 1. у type(obj) чи його базових класах є дескриптор даних?
      він має __set__        -> descriptor.__set__(obj, value)
      він не має __set__     -> AttributeError: __set__
 2. інакше (дескриптор не-даних, звичайний атрибут класу чи нічого)
                             -> obj.__dict__["attr"] = value

del obj.attr
 1. у type(obj) чи його базових класах є дескриптор даних?
      він має __delete__     -> descriptor.__delete__(obj)
      він не має __delete__  -> AttributeError: __delete__
 2. інакше                   -> видаляємо "attr" з obj.__dict__ (AttributeError, якщо немає)
```

Це той самий порядок, який тема «Властивості (property)» показувала для властивостей. Його можна змоделювати кількома рядками Python і порівняти результат зі справжнім `getattr()`:

```python
_NOT_FOUND = object()


def lookup(obj, name):
    """Спрощена модель object.__getattribute__ на чистому Python."""
    cls_attr = _NOT_FOUND
    for klass in type(obj).__mro__:  # 0. шукаємо в класі та його базових класах
        if name in vars(klass):
            cls_attr = vars(klass)[name]
            break

    kind = type(cls_attr)
    is_data = hasattr(kind, "__set__") or hasattr(kind, "__delete__")
    if cls_attr is not _NOT_FOUND and is_data and hasattr(kind, "__get__"):
        return kind.__get__(cls_attr, obj, type(obj))  # 1. дескриптор даних

    instance_dict = getattr(obj, "__dict__", {})
    if name in instance_dict:
        return instance_dict[name]  # 2. атрибут екземпляра

    if cls_attr is not _NOT_FOUND:
        if hasattr(kind, "__get__"):
            return kind.__get__(cls_attr, obj, type(obj))  # 3. дескриптор не-даних
        return cls_attr  # 4. звичайний атрибут класу

    raise AttributeError(name)  # 5. нічого не знайдено


class Demo:
    species = "class attribute"

    @property
    def prop(self):
        return "from the property"

    def method(self):
        return "from the method"


d = Demo()
d.__dict__.update(species="instance", prop="instance", method="instance")

for name in ("species", "prop", "method"):
    print(f"{name:8} getattr: {getattr(d, name)!r:21} lookup: {lookup(d, name)!r}")

del d.__dict__["method"]
print(lookup(d, "method")())
```

Результат:

```text
species  getattr: 'instance'            lookup: 'instance'
prop     getattr: 'from the property'   lookup: 'from the property'
method   getattr: 'instance'            lookup: 'instance'
from the method
```

Зверніть увагу на подробиці, які відтворює модель:

- Дескриптор шукають у **типі** (`type(obj).__mro__`), а не у словнику екземпляра. Об'єкт-дескриптор, збережений в екземплярі, — просто значення.
- `__get__` викликається через тип дескриптора (`kind.__get__(cls_attr, ...)`), так само як спеціальні методи.
- Справжню реалізацію написано на C, і вона ще й кешує пошук у типах, але порядок кроків той самий.

## Функції — дескриптори не-даних: звідки в методах береться `self`

Кожна функція, визначена в тілі класу, зберігається в класі як звичайна функція. Методом вона стає лише тоді, коли її читають через екземпляр, і це робота її методу `__get__`:

```python
class Greeter:
    def __init__(self, name):
        self.name = name

    def hello(self):
        return f"Hello from {self.name}"


g = Greeter("Olena")
function = vars(Greeter)["hello"]  # звичайна функція, що зберігається в класі
print(type(function).__name__)

bound = function.__get__(g, Greeter)  # саме це робить g.hello
print(type(bound).__name__, bound.__self__ is g, bound.__func__ is function)
print(bound())

print(Greeter.hello is function)  # через клас: __get__(None, Greeter) повертає саму функцію
print(g.hello is g.hello)         # кожне звернення створює НОВИЙ об'єкт зв'язаного методу
print(g.hello == g.hello)         # ...але вони рівні між собою

g.hello = lambda: "patched on this instance"  # функції — дескриптори не-даних
print(g.hello())
print(Greeter("Max").hello())
del g.hello
print(g.hello())
```

Результат:

```text
function
method True True
Hello from Olena
True
False
True
patched on this instance
Hello from Max
Hello from Olena
```

- `function.__get__(g, Greeter)` повертає **зв'язаний метод** (bound method): об'єкт, що пам'ятає функцію (`__func__`) і екземпляр (`__self__`) та під час виклику викликає `function(g, ...)`. Саме звідси береться `self`.
- Під час читання через клас `__get__` функції повертає саму функцію, тож `Greeter.hello(g)` потребує явної передачі екземпляра.
- Новий зв'язаний метод створюється під час кожного звернення до атрибута. Два такі методи рівні, але не ідентичні, тому `is` — неправильний спосіб їх порівнювати.
- Оскільки функції — дескриптори **не-даних**, атрибут екземпляра з тим самим ім'ям має пріоритет. Саме це робить можливим «латання» (monkeypatching) окремого екземпляра, наприклад у тестах. `del g.hello` видаляє атрибут екземпляра, і метод класу знову стає видимим.

`classmethod` і `staticmethod` працюють так само: їхній `__get__` повертає метод, зв'язаний із класом, або звичайну функцію. Вправа 4 відтворює обидва.

## Чому властивість не можна приховати

Властивість — дескриптор даних, навіть без сетера. Тому присвоєння не може створити атрибут екземпляра, який би її приховав, а запис, підкинутий просто в `__dict__`, ігнорується:

```python
class Account:
    def __init__(self, balance):
        self._balance = balance

    @property
    def balance(self):  # без сетера
        return self._balance


acc = Account(100)
try:
    acc.balance = 0
except AttributeError as error:
    print("AttributeError:", error)

acc.__dict__["balance"] = 0
print(acc.balance)
print(hasattr(property, "__set__"), hasattr(property, "__delete__"))
```

Результат:

```text
AttributeError: property 'balance' of 'Account' object has no setter
100
True True
```

Порівняння в одній таблиці:

| | Дескриптор даних | Дескриптор не-даних |
|---|---|---|
| Визначає | `__set__` та/або `__delete__` (плюс `__get__`) | лише `__get__` |
| `obj.attr`, коли в `obj.__dict__` є те саме ім'я | `__get__` дескриптора | значення екземпляра |
| `obj.attr = value` | `__set__` дескриптора | запис в `obj.__dict__` |
| `del obj.attr` | `__delete__` дескриптора | видалення з `obj.__dict__` |
| Типове застосування | перевірка значень, обчислювані атрибути, поля лише для читання, `property`, члени `__slots__` | методи, `classmethod`, `staticmethod`, кешування (`cached_property`) |

## Правило не-даних на користь: обчислити один раз і закешувати

Те, що атрибут екземпляра приховує дескриптор не-даних, — не лише пастка, а й інструмент. Дескриптор не-даних може обчислити дороге значення під час першого звернення й покласти його у словник екземпляра **під власним ім'ям**. Відтоді Python знаходить значення в `__dict__` і навіть не викликає дескриптор:

```python
class lazy:
    """Дескриптор не-даних: обчислює значення один раз, а потім не заважає."""

    def __init__(self, func):
        self.func = func

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        value = self.func(instance)
        instance.__dict__[self.name] = value  # відтепер перемагає атрибут екземпляра
        return value


class Report:
    def __init__(self, rows):
        self.rows = rows

    @lazy
    def total(self):
        print("computing total...")
        return sum(self.rows)


report = Report([10, 20, 30])
print(report.total)
print(report.total)  # читаємо просто з report.__dict__, без обчислень
print(report.__dict__)

report.rows.append(40)
print(report.total)  # застаріле: кеш не знає, що rows змінилися
del report.total     # прибираємо закешоване значення
print(report.total)  # обчислюється знову
```

Результат:

```text
computing total...
60
60
{'rows': [10, 20, 30], 'total': 60}
60
computing total...
100
```

Після першого звернення дескриптор нічого не коштує: друге читання — звичайний пошук у словнику. Ціна — **застарівання**: закешоване значення не стежить за змінами в `rows`, доки ви його не видалите. Якби `lazy` мав `__set__`, він став би дескриптором даних, `__get__` виконувався б під час кожного звернення, і кеш у `__dict__` ніколи б не використовувався.

У стандартній бібліотеці саме такий інструмент є під назвою `functools.cached_property` (Python 3.8+):

```python
from functools import cached_property


class Report:
    def __init__(self, rows):
        self.rows = rows

    @cached_property
    def total(self):
        print("computing total...")
        return sum(self.rows)


report = Report([10, 20, 30])
print(report.total, report.total)
report.total = 0  # __set__ немає: присвоєння просто замінює закешоване значення
print(report.total)
del report.total
print(report.total)
```

Результат:

```text
computing total...
60 60
0
computing total...
60
```

> **Зверніть увагу:** `cached_property` потребує `__dict__` екземпляра, доступного для запису, тож не працює в класах із `__slots__` (якщо тільки `"__dict__"` не є одним зі слотів). До Python 3.12 вона ще й використовувала внутрішнє блокування (lock), одне на властивість і спільне для *всіх* екземплярів, через що непов'язані потоки могли чекати один на одного. У 3.12 це блокування прибрали, тож у багатопотоковому коді два потоки тепер можуть обчислювати те саме значення одночасно.

## Типові помилки

- **Очікувати, що дескриптор лише з `__get__` захистить атрибут.** Без `__set__` присвоєння потрапляють просто у словник екземпляра й тихо приховують дескриптор:

  ```python
  class Constant:
      """Задуманий як лише для читання, але визначає тільки __get__."""

      def __init__(self, value):
          self.value = value

      def __get__(self, instance, owner):
          return self.value


  class Circle:
      PI = Constant(3.14159)


  circle = Circle()
  circle.PI = 3  # тихо створює атрибут екземпляра
  print(circle.PI, Circle.PI)
  ```

  Результат:

  ```text
  3 3.14159
  ```

  Додайте `__set__`, який відмовляє в присвоєнні. Це перетворює дескриптор на дескриптор даних:

  ```python
  class Constant:
      def __init__(self, value):
          self.value = value  # тут одне значення на всі екземпляри — саме те, що треба

      def __set_name__(self, owner, name):
          self.name = name

      def __get__(self, instance, owner):
          return self.value

      def __set__(self, instance, value):  # робить його дескриптором даних
          raise AttributeError(f"{self.name} is read-only")


  class Circle:
      PI = Constant(3.14159)


  circle = Circle()
  try:
      circle.PI = 3
  except AttributeError as error:
      print("AttributeError:", error)
  print(circle.PI)
  ```

  Результат:

  ```text
  AttributeError: PI is read-only
  3.14159
  ```

- **Присвоювати через клас замість екземпляра.** `__set__` викликається лише для присвоєнь в екземплярі. `Point.x = 5` нічого не перевіряє: воно **замінює** дескриптор у класі, одразу для всіх екземплярів:

  ```python
  class Coordinate:
      def __set_name__(self, owner, name):
          self.storage = "_" + name

      def __get__(self, instance, owner):
          if instance is None:
              return self
          return getattr(instance, self.storage, 0.0)

      def __set__(self, instance, value):
          setattr(instance, self.storage, float(value))


  class Point:
      x = Coordinate()


  a = Point()
  a.x = "1.5"
  print(a.x)

  Point.x = 5  # через КЛАС: __set__ не викликається, дескриптор просто замінено
  b = Point()
  b.x = "1.5"  # тепер це звичайний атрибут екземпляра: жодного перетворення
  print(repr(b.x), repr(a.x), type(vars(Point)["x"]).__name__)
  ```

  Результат:

  ```text
  1.5
  '1.5' 5 int
  ```

  У `a` значення й далі лежить у `_x`, але його вже ніхто не читає: `a.x` тепер знаходить звичайний атрибут класу `5`. (Щоб перехоплювати присвоєння в самому класі, потрібен дескриптор у *метакласі*.)

- **Робити кешувальний дескриптор дескриптором даних.** Якщо «лінивий» дескриптор має ще й `__set__` (скажімо, щоб кеш можна було скидати), значення, яке він кладе в `__dict__`, ніколи не знаходиться, і дорога функція виконується під час кожного звернення.
- **Думати, що дескриптор даних робить `__get__`.** Важать лише `__set__` і `__delete__`. Дескриптор із `__get__` і `__delete__` — дескриптор даних, і оскільки `__set__` у нього немає, кожне присвоєння цьому атрибуту завершується помилкою `AttributeError: __set__`.
- **Порівнювати зв'язані методи через `is`.** `obj.method is obj.method` дає `False`, бо кожне звернення створює новий зв'язаний метод. Використовуйте `==`.
- **Забути `if instance is None: return self`.** Тоді читання атрибута через клас передає `None` у вашу логіку.

## Підсумок

- Дескриптор даних визначає `__set__` та/або `__delete__`. Дескриптор не-даних визначає лише `__get__`. `__set_name__` на вид не впливає, а перевіряє його `inspect.isdatadescriptor()`.
- Порядок пошуку `obj.attr`: дескриптор даних, потім `__dict__` екземпляра, потім дескриптор не-даних або звичайний атрибут класу, потім `AttributeError` / `__getattr__`.
- Присвоєння й видалення потрапляють до `__set__` / `__delete__` дескриптора даних, якщо він є; інакше вони працюють безпосередньо з `__dict__` екземпляра. Дескриптор не-даних не може їх заблокувати.
- `property` і члени `__slots__` — дескриптори даних, тож атрибути екземпляра не можуть їх приховати.
- Функції, `classmethod` і `staticmethod` — дескриптори не-даних. `__get__` функції створює зв'язаний метод, що підставляє `self`, а атрибут екземпляра може перевизначити метод для одного об'єкта.
- Якщо зберегти обчислене значення в `__dict__` під ім'ям самого дескриптора, дескриптор не-даних стає кешем. Саме так працює `functools.cached_property`.
- Присвоєння атрибуту класу замінює дескриптор, а не викликає `__set__`.

## Практика

### Вправа 1: Хто переможе?

Не запускаючи код, передбачте, що виведуть обидва цикли. Потім запустіть його й поясніть кожен рядок.

```python
class A:
    def __get__(self, instance, owner):
        return "A.__get__"


class B:
    def __get__(self, instance, owner):
        return "B.__get__"

    def __set__(self, instance, value):
        instance.__dict__["b_storage"] = value


class C:
    def __get__(self, instance, owner):
        return "C.__get__"

    def __delete__(self, instance):
        print("C.__delete__")


class D:
    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        return "D.__get__"


class Box:
    a = A()
    b = B()
    c = C()
    d = D()


box = Box()
for name in "abcd":
    box.__dict__[name] = "instance value"
    print(name, getattr(box, name))

for name in "abcd":
    try:
        setattr(box, name, 1)
        print(f"box.{name} = 1 -> ok")
    except AttributeError as error:
        print(f"box.{name} = 1 -> AttributeError: {error}")
```

### Вправа 2: Кеш, який знає, коли забути

Клас `Dataset` має список `values` і два дорогі результати, `total` і `mean`, реалізовані через `functools.cached_property` (`mean` використовує `total`). Проблема: після `data.values = [...]` закешовані результати застарівають. Напишіть для `values` дескриптор даних `Field(*invalidates)`, який зберігає копію списку й під час кожного присвоєння видаляє з екземпляра перелічені закешовані результати, щоб під час наступного звернення їх було обчислено знову. Покажіть, що кожен результат обчислюється один раз на кожне присвоєння.

### Вправа 3: Атрибути з одноразовим записом

Напишіть дескриптор даних `WriteOnce`: атрибуту можна присвоїти значення рівно один раз (не обов'язково в `__init__`), будь-яке подальше присвоєння генерує `AttributeError`, читання до першого присвоєння генерує `AttributeError` зі зрозумілим повідомленням, а видаляти атрибут заборонено. Використайте його для `Order.order_id`, який задається після збереження замовлення.

### Вправа 4: Власні `classmethod` і `staticmethod`

Реалізуйте два дескриптори не-даних, `my_classmethod` і `my_staticmethod`, що поводяться як вбудовані: перший зв'язує **клас** як перший аргумент незалежно від того, звертаються до нього через клас чи через екземпляр (скористайтеся `types.MethodType`); другий повертає звичайну функцію. Перевірте їх у класі `Temperature` зі статичним `to_celsius(fahrenheit)` і альтернативним конструктором `from_fahrenheit(cls, fahrenheit)` і покажіть, що підклас отримує власні екземпляри.

## Розв'язки

### Вправа 1

Результат:

```text
a instance value
b B.__get__
c C.__get__
d instance value
box.a = 1 -> ok
box.b = 1 -> ok
box.c = 1 -> AttributeError: __set__
box.d = 1 -> ok
```

- `a` і `d` — дескриптори не-даних (лише `__get__`; `__set_name__` не рахується), тож перемагає значення екземпляра.
- `b` — дескриптор даних (`__set__`), тож `__get__` перемагає словник екземпляра.
- `c` — теж дескриптор даних, бо має `__delete__`, хоч і без `__set__`.
- Присвоєння: `box.a = 1` і `box.d = 1` просто пишуть у `box.__dict__`. `box.b = 1` обробляє `B.__set__`. `box.c = 1` перехоплює дескриптор даних `C`, у якого немає `__set__`, тож Python генерує `AttributeError: __set__`.

### Вправа 2

```python
from functools import cached_property


class Field:
    """Дескриптор даних, що скидає закешовані значення, коли поле змінюється."""

    def __init__(self, *invalidates):
        self.invalidates = invalidates

    def __set_name__(self, owner, name):
        self.storage = "_" + name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        return getattr(instance, self.storage)

    def __set__(self, instance, value):
        setattr(instance, self.storage, list(value))
        for name in self.invalidates:
            instance.__dict__.pop(name, None)  # забуваємо закешований результат, якщо він є


class Dataset:
    values = Field("total", "mean")

    def __init__(self, values):
        self.values = values

    @cached_property
    def total(self):
        print("  computing total")
        return sum(self.values)

    @cached_property
    def mean(self):
        print("  computing mean")
        return self.total / len(self.values)


data = Dataset([1, 2, 3, 4])
print(data.mean, data.mean)
data.values = [10, 20]
print(data.mean, data.total)
```

Результат:

```text
  computing mean
  computing total
2.5 2.5
  computing mean
  computing total
15.0 30
```

Тут разом працюють обидва види дескрипторів. `cached_property` — дескриптор не-даних, тож закешоване значення лежить у `__dict__` під ім'ям властивості й приховує дескриптор. `Field` — дескриптор даних, тож кожне присвоєння `values` доходить до його `__set__`, а той прибирає ці закешовані записи через `pop(name, None)` (без помилки, якщо результат ще не обчислювали). Збереження `list(value)` ще й захищає кеш від того, що хтось змінить переданий початковий список.

### Вправа 3

```python
class WriteOnce:
    """Дескриптор даних: перше присвоєння перемагає, наступні відхиляються."""

    def __set_name__(self, owner, name):
        self.name = name

    def __get__(self, instance, owner):
        if instance is None:
            return self
        try:
            return instance.__dict__[self.name]
        except KeyError:
            raise AttributeError(f"{self.name} has not been set yet") from None

    def __set__(self, instance, value):
        if self.name in instance.__dict__:
            raise AttributeError(f"{self.name} is already set and cannot be changed")
        instance.__dict__[self.name] = value

    def __delete__(self, instance):
        raise AttributeError(f"{self.name} cannot be deleted")


class Order:
    order_id = WriteOnce()

    def __init__(self, items):
        self.items = items


order = Order(["book"])
try:
    print(order.order_id)
except AttributeError as error:
    print("AttributeError:", error)

order.order_id = 1001  # присвоюється пізніше, наприклад після збереження в базу даних
print(order.order_id)

try:
    order.order_id = 2002
except AttributeError as error:
    print("AttributeError:", error)

try:
    del order.order_id
except AttributeError as error:
    print("AttributeError:", error)

print(order.order_id, Order(["pen"]).__dict__)
```

Результат:

```text
AttributeError: order_id has not been set yet
1001
AttributeError: order_id is already set and cannot be changed
AttributeError: order_id cannot be deleted
1001 {'items': ['pen']}
```

Дескриптор мусить бути саме дескриптором **даних**: версія лише з `__get__` не змогла б зупинити друге присвоєння. Зберігати значення в `__dict__` під тим самим ім'ям безпечно, бо дескриптор даних завжди перемагає, а наявність цього ключа і є ознакою «вже присвоєно». Новий `Order` такого ключа не має, тож кожен екземпляр отримує власний одноразовий запис.

### Вправа 4

```python
import types


class my_classmethod:
    """Дескриптор не-даних: зв'язує КЛАС, хоч через клас звертайся, хоч через екземпляр."""

    def __init__(self, func):
        self.func = func

    def __get__(self, instance, owner=None):
        if owner is None:
            owner = type(instance)
        return types.MethodType(self.func, owner)


class my_staticmethod:
    """Дескриптор не-даних: нічого не зв'язує й повертає звичайну функцію."""

    def __init__(self, func):
        self.func = func

    def __get__(self, instance, owner=None):
        return self.func


class Temperature:
    def __init__(self, celsius):
        self.celsius = celsius

    @my_staticmethod
    def to_celsius(fahrenheit):
        return round((fahrenheit - 32) * 5 / 9, 1)

    @my_classmethod
    def from_fahrenheit(cls, fahrenheit):
        return cls(cls.to_celsius(fahrenheit))

    def __repr__(self):
        return f"{type(self).__name__}({self.celsius})"


class LabTemperature(Temperature):
    pass


print(Temperature.from_fahrenheit(212))
print(LabTemperature.from_fahrenheit(98.6))  # cls — це підклас
print(Temperature(0).from_fahrenheit(32))    # через екземпляр: однаково клас
print(Temperature.to_celsius(50), Temperature(0).to_celsius(50))  # ні self, ні cls
print(Temperature.from_fahrenheit.__self__)
```

Результат:

```text
Temperature(100.0)
LabTemperature(37.0)
Temperature(0.0)
10.0 10.0
<class '__main__.Temperature'>
```

`types.MethodType(func, obj)` створює такий самий зв'язаний метод, як `__get__` функції, але зв'язаним об'єктом тут є клас (`owner`), а не екземпляр. Оскільки `owner` — це клас, через який шукали атрибут, `LabTemperature.from_fahrenheit` отримує `LabTemperature` і будує `LabTemperature`. `my_staticmethod.__get__` ігнорує обидва аргументи, тож ні `self`, ні `cls` не підставляються. Обидва класи — дескриптори не-даних, так само як і вбудовані.

---

*Джерело: [pythontutorial.net — Python Data Descriptors](https://www.pythontutorial.net/python-oop/python-data-descriptors/). Адаптовано й доповнено для PyJourney.*
