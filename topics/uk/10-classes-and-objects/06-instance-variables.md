# Змінні екземпляра

**Змінні екземпляра** (instance variables), які ще називають атрибутами екземпляра, зберігають дані, що належать одному конкретному об'єкту. Два екземпляри одного класу можуть мати в них зовсім різні значення. У цій темі розглянемо, де Python зберігає змінні екземпляра, як пошук атрибута переходить від екземпляра до класу і що стається, коли змінна екземпляра та змінна класу мають однакову назву.

## Що ви дізнаєтесь

- Чим змінні класу відрізняються від змінних екземпляра
- Де живуть змінні екземпляра: у власному `__dict__` кожного екземпляра
- Як Python шукає атрибут: спершу в екземплярі, потім у класі
- Як змінна екземпляра затіняє змінну класу і як `del` знову її відкриває
- Чому змінні екземпляра слід створювати в `__init__`
- Як досліджувати змінні екземпляра за допомогою `vars()`, `__dict__` і `__static_attributes__`

## Змінні класу та змінні екземпляра

Змінні класу прив'язані до класу й спільні для всіх екземплярів. Змінні екземпляра прив'язані до одного конкретного екземпляра. Почнімо з класу, що має лише змінні класу:

```python
from pprint import pprint


class HtmlDocument:
    version = 5
    extension = "html"


pprint(HtmlDocument.__dict__)
print(HtmlDocument.extension)
print(HtmlDocument.version)
```

Результат (Python 3.14):

```text
mappingproxy({'__dict__': <attribute '__dict__' of 'HtmlDocument' objects>,
              '__doc__': None,
              '__firstlineno__': 4,
              '__module__': '__main__',
              '__static_attributes__': (),
              '__weakref__': <attribute '__weakref__' of 'HtmlDocument' objects>,
              'extension': 'html',
              'version': 5})
html
5
```

Дві змінні класу, `extension` і `version`, зберігаються в `__dict__` класу. Коли ви звертаєтеся до них через клас, Python шукає їх саме там.

## Кожен екземпляр має власний `__dict__`

Тепер створімо екземпляр. Він отримує власний `__dict__`, окремий від `__dict__` класу:

```python
class HtmlDocument:
    version = 5
    extension = "html"


home = HtmlDocument()
print(home.__dict__)
print(type(home.__dict__))
print(vars(home) is home.__dict__)
```

Результат:

```text
{}
<class 'dict'>
True
```

- `__dict__` екземпляра **порожній**: у `home` поки що немає змінних екземпляра.
- На відміну від `mappingproxy` класу, доступного лише для читання, `__dict__` екземпляра — звичайний змінюваний `dict`.
- Вбудована функція `vars(obj)` повертає той самий словник. Це охайніший спосіб зазирнути всередину об'єкта.

`home.__dict__` зберігає змінні екземпляра `home` так само, як `HtmlDocument.__dict__` зберігає змінні класу `HtmlDocument`.

## Як працює пошук атрибутів

Хоча `home.__dict__` порожній, читання змінних класу через екземпляр працює:

```python
class HtmlDocument:
    version = 5
    extension = "html"


home = HtmlDocument()
print(home.extension)
print(home.version)
```

Результат:

```text
html
5
```

Коли ви читаєте `home.version`, Python шукає в такому порядку:

```text
home.version
  1. home.__dict__           {}                     -> немає
  2. HtmlDocument.__dict__   {'version': 5, ...}    -> знайдено: 5
  3. батьківські класи       (лише якщо досі не знайдено)
  4. нічого не знайдено      -> AttributeError
```

Пошук **зупиняється на першому збігу**. Якщо екземпляр має власну змінну з такою назвою, до класу справа навіть не доходить.

## Затінення змінної класу

Присвоєння через екземпляр завжди створює (або оновлює) змінну **екземпляра**. Клас воно ніколи не чіпає:

```python
class HtmlDocument:
    version = 5
    extension = "html"


home = HtmlDocument()
about = HtmlDocument()

home.version = 6
print(home.__dict__)
print(home.version)
print(about.version)
print(HtmlDocument.version)
```

Результат:

```text
{'version': 6}
6
5
5
```

Тепер `home.__dict__` містить `version`, тож пошук зупиняється на кроці 1 і повертає `6`. Змінна екземпляра **затіняє** (shadows), тобто приховує, змінну класу лише для `home`. `about` і сам клас і далі бачать `5`.

Видалення змінної екземпляра знову відкриває змінну класу. Зміни в класі видно через кожен екземпляр, який не затіняє цю назву:

```python
class HtmlDocument:
    version = 5
    extension = "html"


home = HtmlDocument()
about = HtmlDocument()
home.version = 6

HtmlDocument.version = 7
print(home.version, about.version)

del home.version
print(home.version, about.version)

HtmlDocument.media_type = "text/html"
print(home.media_type)
```

Результат:

```text
6 7
7 7
text/html
```

Поки `home` затіняв `version`, зміну класу на `7` через `home` не було видно. Після `del home.version` пошук знову доходить до класу. Змінну класу, додану пізніше (`media_type`), теж видно з уже наявних екземплярів, бо пошук відбувається в момент звернення.

## Ініціалізація змінних екземпляра в `__init__`

На практиці змінні екземпляра, потрібні кожному об'єкту, створюють у `__init__`. Кожен виклик отримує власний `self`, тож кожен об'єкт отримує власні значення:

```python
class HtmlDocument:
    version = 5
    extension = "html"

    def __init__(self, name, contents):
        self.name = name
        self.contents = contents


blank = HtmlDocument("Blank", "")
about = HtmlDocument("About", "<h1>About us</h1>")

print(vars(blank))
print(vars(about))
print(about.name, about.extension)
```

Результат:

```text
{'name': 'Blank', 'contents': ''}
{'name': 'About', 'contents': '<h1>About us</h1>'}
About html
```

Тепер, створюючи `HtmlDocument`, треба передати аргументи, яких очікує `__init__`. Змінні екземпляра (`name`, `contents`) живуть у кожному об'єкті, а змінні класу (`version`, `extension`) лишаються в класі й спільні для всіх.

### Чому саме `__init__`

Python дозволяє додавати атрибути об'єкту будь-де й будь-коли:

```python
class HtmlDocument:
    def __init__(self, name):
        self.name = name


blank = HtmlDocument("Blank")
blank.author = "Olena"
print(vars(blank))

about = HtmlDocument("About")
print(hasattr(about, "author"))
```

Результат:

```text
{'name': 'Blank', 'author': 'Olena'}
False
```

Така гнучкість має ціну: тепер одні документи мають `author`, а інші ні, і будь-який код, що читає `doc.author`, може впасти. Створення всіх змінних екземпляра в `__init__` дає:

- **Передбачуваність.** Кожен екземпляр від самого початку має однаковий набір атрибутів. Якщо значення ще невідоме, присвойте `None`.
- **Читабельність.** Усі дані об'єкта читач знаходить в одному місці.
- **Підтримку інструментів.** Лінтери (наприклад, правило pylint `attribute-defined-outside-init`) і автодоповнення в IDE розуміють атрибути, оголошені в `__init__`.
- **Економію пам'яті.** CPython дозволяє екземплярам, які отримують однакові атрибути в однаковому порядку, спільно використовувати таблицю ключів свого `__dict__` (словники зі спільними ключами, PEP 412).

### Перелік атрибутів, які присвоює клас

Починаючи з Python 3.13, кожен клас запам'ятовує назви, які його методи присвоюють через `self`. Це зручний спосіб побачити, які змінні екземпляра клас *може* створити, навіть ті, що задаються поза `__init__`:

```python
class HtmlDocument:
    def __init__(self, name, contents):
        self.name = name
        self.contents = contents

    def publish(self):
        self.published = True


print(HtmlDocument.__static_attributes__)
```

Результат (Python 3.13+):

```text
('contents', 'name', 'published')
```

## Присвоєння проти зміни: пастка спільного списку

Затінення відбувається лише під час **присвоєння**. Зміна (mutation) змінюваної змінної класу через екземпляр не створює змінної екземпляра. Вона змінює один об'єкт, спільний для всіх:

```python
class Team:
    members = []  # один список на весь клас

    def __init__(self, name):
        self.name = name

    def add(self, person):
        self.members.append(person)  # змінює Team.members


red = Team("Red")
blue = Team("Blue")
red.add("Olena")
print(blue.members)
print(vars(red))
```

Результат:

```text
['Olena']
{'name': 'Red'}
```

`self.members` знаходить змінну класу, а `append()` змінює її на місці. `vars(red)` показує, що жодної змінної екземпляра не з'явилося. Виправлення — дати кожному екземпляру власний список у `__init__`:

```python
class Team:
    def __init__(self, name):
        self.name = name
        self.members = []

    def add(self, person):
        self.members.append(person)


red = Team("Red")
blue = Team("Blue")
red.add("Olena")
print(red.members, blue.members)
```

Результат:

```text
['Olena'] []
```

> **Зверніть увагу:** клас може оголосити `__slots__ = ("x", "y")`, щоб замінити `__dict__` кожного екземпляра фіксованим набором комірок для атрибутів. Такі екземпляри займають менше пам'яті, але не можуть отримувати нові атрибути: присвоєння `p.z = 3` спричиняє `AttributeError: 'Point' object has no attribute 'z' and no __dict__ for setting new attributes`. Про слоти йтиметься в одній із наступних тем.

## Типові помилки

- **Очікувати, що присвоєння через екземпляр змінить змінну класу.** `home.version = 6` затіняє змінну класу лише для `home`. Спільні значення змінюйте через клас: `HtmlDocument.version = 6`.

- **Зберігати дані окремих екземплярів у змінюваній змінній класу.** Списки, словники й множини, оголошені в тілі класу, спільні. Створюйте їх у `__init__`.

- **Створювати атрибути поза `__init__`.** Атрибут, що задається лише в якомусь методі, з'являється тільки після виклику цього методу:

  ```python
  class User:
      def __init__(self, name):
          self.name = name

      def log_in(self):
          self.last_login = "2026-11-25"


  user = User("max")
  print(user.last_login)
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    ...
  AttributeError: 'User' object has no attribute 'last_login'
  ```

  Натомість додайте `self.last_login = None` в `__init__`.

- **Одруківки створюють нові атрибути.** `doc.contnets = "..."` непомітно додає атрибут з помилкою в назві, а `doc.contents` зберігає старе значення.

- **Читати атрибути через `obj.__dict__`.** Там лише змінні екземпляра. `home.__dict__["extension"]` спричиняє `KeyError`, хоча `home.extension` працює. Для читання використовуйте звичайну крапку або `getattr()`, а `vars()` — лише для дослідження.

## Підсумок

- Змінні екземпляра належать одному об'єкту. Змінні класу належать класу й спільні для всіх.
- Кожен екземпляр зберігає свої змінні у власному `__dict__` — звичайному змінюваному `dict`. Його повертає `vars(obj)`.
- Читання `obj.name` спершу перевіряє `__dict__` екземпляра, потім клас (і його батьківські класи), а якщо нічого не знайдено, генерує `AttributeError`.
- Присвоєння `obj.name = value` завжди створює або оновлює змінну екземпляра. Якщо в класі є змінна з такою назвою, змінна екземпляра її затіняє. `del obj.name` знову її відкриває.
- Зміна змінюваної змінної класу через `self` змінює спільний об'єкт для всіх.
- Створюйте всі змінні екземпляра в `__init__`, присвоюючи `None` значенням, які ще невідомі.

## Практика

### Вправа 1: Передбачте результат

Запишіть, що виведе кожен `print()`, а потім запустіть код.

```python
class Config:
    debug = False
    level = 1


a = Config()
b = Config()
a.debug = True
Config.level = 2
print(a.debug, b.debug, Config.debug)
print(a.level, b.level)
print(vars(a), vars(b))
del a.debug
print(a.debug)
```

### Вправа 2: Звідки береться атрибут?

Напишіть функцію `where(obj, name)`, яка повертає:

- `"instance"`, якщо `name` — змінна екземпляра `obj`;
- `"class"`, якщо це не змінна екземпляра, але її можна знайти в класі об'єкта;
- `"missing"` в інших випадках.

Перевірте її на `HtmlDocument` зі змінною класу `extension`, змінною екземпляра `name`, затіненою `version` і назвою, якої не існує.

### Вправа 3: Виправте облік товарів

Кожен склад нижче показує товари всіх складів. Виправте клас так, щоб кожен склад мав власні запаси, і покажіть, що додавання на один склад не впливає на інший.

```python
class Warehouse:
    stock = {}

    def __init__(self, city):
        self.city = city

    def add(self, product, quantity):
        self.stock[product] = self.stock.get(product, 0) + quantity


kyiv = Warehouse("Kyiv")
lviv = Warehouse("Lviv")
kyiv.add("laptop", 5)
print(lviv.stock)
```

### Вправа 4: Порівняйте два об'єкти

Напишіть функцію `diff(a, b)`, яка порівнює **змінні екземпляра** двох об'єктів і повертає словник `{name: (value_in_a, value_in_b)}` для кожної назви, значення якої відрізняються. Назва, якої немає з одного боку, має з'являтися з `None` для цього боку. Перевірте функцію на двох об'єктах `Person` з `name`, `age` і `city`, один з яких має ще й додатковий атрибут `email`.

## Розв'язки

### Вправа 1

Результат:

```text
True False False
2 2
{'debug': True} {}
False
```

- `a.debug = True` створює змінну екземпляра лише в `a`.
- `Config.level = 2` змінює змінну класу, і жоден екземпляр не затіняє `level`, тож обидва бачать `2`.
- `vars()` показує, що змінну екземпляра має лише `a`.
- Після `del a.debug` пошук знову доходить до класу й знаходить `False`.

### Вправа 2

```python
class HtmlDocument:
    extension = "html"
    version = 5

    def __init__(self, name):
        self.name = name


def where(obj, name):
    if name in vars(obj):
        return "instance"
    if hasattr(type(obj), name):
        return "class"
    return "missing"


doc = HtmlDocument("About")
doc.version = 6

for attr in ["extension", "name", "version", "author"]:
    print(attr, "->", where(doc, attr))
```

Результат:

```text
extension -> class
name -> instance
version -> instance
author -> missing
```

`version` є в обох місцях, і функція повертає `"instance"`, що відповідає порядку, в якому шукає сам Python.

### Вправа 3

```python
class Warehouse:
    def __init__(self, city):
        self.city = city
        self.stock = {}

    def add(self, product, quantity):
        self.stock[product] = self.stock.get(product, 0) + quantity


kyiv = Warehouse("Kyiv")
lviv = Warehouse("Lviv")
kyiv.add("laptop", 5)
kyiv.add("laptop", 2)
lviv.add("phone", 3)
print(kyiv.stock)
print(lviv.stock)
```

Результат:

```text
{'laptop': 7}
{'phone': 3}
```

Початковий `stock = {}` був одним словником, спільним через клас, а `self.stock[product] = ...` змінював його замість того, щоб створити змінну екземпляра. Створення словника в `__init__` дає кожному складу власний.

### Вправа 4

```python
class Person:
    def __init__(self, name, age, city):
        self.name = name
        self.age = age
        self.city = city


def diff(a, b):
    left, right = vars(a), vars(b)
    result = {}
    for name in sorted(left.keys() | right.keys()):
        value_a = left.get(name)
        value_b = right.get(name)
        if value_a != value_b:
            result[name] = (value_a, value_b)
    return result


first = Person("Olena", 30, "Kyiv")
second = Person("Olena", 31, "Lviv")
second.email = "olena@example.com"
print(diff(first, second))
```

Результат:

```text
{'age': (30, 31), 'city': ('Kyiv', 'Lviv'), 'email': (None, 'olena@example.com')}
```

`vars()` дає змінні екземпляра кожного об'єкта у вигляді словника, а оператор `|` над двома поданнями ключів утворює об'єднання всіх назв. Сортування робить порядок виведення передбачуваним.

---

*Джерело: [pythontutorial.net — Python Instance Variables](https://www.pythontutorial.net/python-oop/python-instance-variables/). Адаптовано й доповнено для PyJourney.*
