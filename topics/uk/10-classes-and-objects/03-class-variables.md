# Змінні класу

**Змінна класу** (class variable) — це змінна, що належить самому об'єкту класу, а не окремому екземпляру. Її бачить кожен екземпляр, тож це природне місце для даних, спільних для всього класу. У цій темі розглянемо, як читати, додавати, змінювати й видаляти змінні класу, де Python їх зберігає і чому функції, оголошені в класі, теж є змінними класу.

## Що ви дізнаєтесь

- Чому клас — це об'єкт, який може мати власні змінні
- Як читати змінні класу через крапку та `getattr()`, зі значенням за замовчуванням і без нього
- Як змінювати, додавати й видаляти змінні класу під час виконання за допомогою крапки, `setattr()`, `delattr()` і `del`
- Де зберігаються змінні класу (`__dict__`) і чому це відображення доступне лише для читання
- Чому функції, оголошені в класі, є атрибутами класу, які можна викликати
- Як екземпляри бачать змінні класу

## Клас — це об'єкт

Виконуючи інструкцію `class`, Python створює **об'єкт класу** й прив'язує його до назви класу. Цей об'єкт має атрибути й тип, як і будь-який інший:

```python
class HtmlDocument:
    pass


print(HtmlDocument.__name__)
print(type(HtmlDocument))
print(isinstance(HtmlDocument, type))
```

Результат:

```text
HtmlDocument
<class 'type'>
True
```

`HtmlDocument` — екземпляр `type`. А оскільки це об'єкт, до нього можна прикріпити власні змінні. Це і є змінні класу.

## Оголошення змінних класу

Присвойте змінну безпосередньо в тілі класу, поза будь-яким методом:

```python
class HtmlDocument:
    extension = "html"
    version = "5"
```

`extension` і `version` — змінні класу `HtmlDocument`. Вони **прив'язані до класу** й спільні для всіх його екземплярів.

> **Зверніть увагу:** «змінна класу» й «атрибут класу» означають те саме. Документація Python зазвичай називає *атрибутом* усе, до чого звертаються через крапку, а в наступних темах вживаються обидва терміни.

## Читання змінних класу

### Через крапку

Використовуйте запис `ClassName.variable`:

```python
class HtmlDocument:
    extension = "html"
    version = "5"


print(HtmlDocument.extension)
print(HtmlDocument.version)
```

Результат:

```text
html
5
```

Спроба прочитати змінну класу, якої не існує, спричиняє `AttributeError`:

```python
class HtmlDocument:
    extension = "html"
    version = "5"


print(HtmlDocument.media_type)
```

Результат:

```text
Traceback (most recent call last):
  ...
AttributeError: type object 'HtmlDocument' has no attribute 'media_type'
```

Якщо назву написано майже правильно, наприклад `HtmlDocument.extention`, Python 3.10+ додає до повідомлення підказку: `Did you mean: 'extension'?`.

### `getattr()`

Вбудована функція `getattr(obj, name)` виконує такий самий пошук, але назву передають **рядком**. Це зручно, коли назва відома лише під час виконання, наприклад коли вона надходить із конфігураційного файлу чи від користувача:

```python
class HtmlDocument:
    extension = "html"
    version = "5"


extension = getattr(HtmlDocument, "extension")
version = getattr(HtmlDocument, "version")

print(extension)
print(version)
```

Результат:

```text
html
5
```

Без значення за замовчуванням `getattr()` для відсутньої назви генерує `AttributeError`, так само як і запис через крапку. Передайте третій аргумент, щоб натомість отримати запасне значення:

```python
class HtmlDocument:
    extension = "html"
    version = "5"


media_type = getattr(HtmlDocument, "media_type", "text/html")
print(media_type)

for name in ("extension", "version", "charset"):
    print(name, "=", getattr(HtmlDocument, name, "<missing>"))

print(hasattr(HtmlDocument, "charset"))
```

Результат:

```text
text/html
extension = html
version = 5
charset = <missing>
False
```

Значення за замовчуванням лише повертається, але не зберігається: `HtmlDocument` і після цього не має `media_type`. Функція `hasattr()` прямо відповідає на запитання «так чи ні».

## Зміна й додавання змінних класу

Щоб змінити змінну класу, присвойте їй значення через крапку або викличте `setattr(obj, name, value)`. Python — динамічна мова, тож той самий синтаксис **додає** й зовсім нову змінну до наявного класу:

```python
class HtmlDocument:
    extension = "html"
    version = "5"


HtmlDocument.version = "5.1"
print(HtmlDocument.version)

setattr(HtmlDocument, "version", "5.2")
print(HtmlDocument.version)

HtmlDocument.media_type = "text/html"
print(HtmlDocument.media_type)

setattr(HtmlDocument, "charset", "utf-8")
print(HtmlDocument.charset)
```

Результат:

```text
5.1
5.2
text/html
utf-8
```

Зверніть увагу на лапки в `setattr(HtmlDocument, "charset", ...)`: назва має бути рядком. Як і `getattr()`, функція `setattr()` найкраще підходить тоді, коли назва зберігається в змінній.

## Видалення змінних класу

Видалити змінну класу можна функцією `delattr(obj, name)` або інструкцією `del`:

```python
class HtmlDocument:
    extension = "html"
    version = "5"
    media_type = "text/html"


delattr(HtmlDocument, "version")
del HtmlDocument.media_type

print(hasattr(HtmlDocument, "version"))
print(hasattr(HtmlDocument, "media_type"))
print(HtmlDocument.extension)
```

Результат:

```text
False
False
html
```

Спроба видалити змінну, якої немає, спричиняє `AttributeError: type object 'HtmlDocument' has no attribute 'version'`.

## Де живуть змінні класу: `__dict__`

Python зберігає змінні класу в атрибуті `__dict__` цього класу. Якщо його вивести, ви побачите свої змінні разом із кількома записами, які Python додає сам:

```python
from pprint import pprint


class HtmlDocument:
    extension = "html"
    version = "5"


HtmlDocument.media_type = "text/html"

pprint(HtmlDocument.__dict__)
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
              'media_type': 'text/html',
              'version': '5'})
```

Крім `extension`, `version` і `media_type` (доданої під час виконання), тут є:

| Ключ | Значення |
|---|---|
| `__module__` | модуль, у якому оголошено клас |
| `__doc__` | рядок документації класу (тут `None`) |
| `__dict__`, `__weakref__` | допоміжні об'єкти, що дають *екземплярам* власний `__dict__` і підтримку слабких посилань |
| `__firstlineno__` | номер рядка інструкції `class` (з'явився в Python 3.13) |
| `__static_attributes__` | назви, які присвоюються як `self.<name>` у методах класу (з'явився в Python 3.13) |

У Python 3.12 і старіших версіях двох останніх ключів немає.

### Відображення лише для читання

`__dict__` класу — не звичайний `dict`. Це `mappingproxy`: **подання лише для читання** (read-only view) справжнього простору імен. Читати з нього можна, а присвоювати — ні:

```python
class HtmlDocument:
    extension = "html"
    version = "5"


print(type(HtmlDocument.__dict__))
print(HtmlDocument.__dict__["extension"])

try:
    HtmlDocument.__dict__["released"] = 2008
except TypeError as error:
    print("TypeError:", error)

setattr(HtmlDocument, "released", 2008)
print(HtmlDocument.__dict__["released"])
```

Результат:

```text
<class 'mappingproxy'>
html
TypeError: 'mappingproxy' object does not support item assignment
2008
```

Чому лише для читання? Python кешує пошук атрибутів у класах, щоб він був швидким. Кожна зміна мусить проходити через `setattr()` (або запис через крапку), щоб інтерпретатор міг скинути ці кеші й перевірити, що ключі є рядками. Прямий запис у відображення обійшов би все це.

### Надавайте перевагу крапці та `getattr()`, а не `__dict__`

Читання через `__dict__` працює, але це погана звичка. Відображення містить лише назви, оголошені **безпосередньо в цьому класі**. Про успадковані атрибути воно нічого не знає, тоді як звичайний пошук атрибутів перевіряє й батьківські класи:

```python
class Document:
    encoding = "utf-8"


class HtmlDocument(Document):
    extension = "html"


print(HtmlDocument.encoding)
print(getattr(HtmlDocument, "encoding"))
print("encoding" in HtmlDocument.__dict__)
print(HtmlDocument.__dict__.get("encoding", "not here"))
```

Результат:

```text
utf-8
utf-8
False
not here
```

`HtmlDocument.__dict__["encoding"]` згенерував би `KeyError`, хоча `HtmlDocument.encoding` працює без проблем. Використовуйте `__dict__` (або рівнозначний виклик `vars(HtmlDocument)`), щоб *дослідити*, що оголошує сам клас, а крапку чи `getattr()` — щоб *користуватися* атрибутами.

## Атрибути класу, які можна викликати

Змінна класу може зберігати будь-який об'єкт, зокрема функцію. Насправді кожен `def` у тілі класу створює атрибут класу, значенням якого є функція. Оскільки функцію можна викликати, такий атрибут називають **викликуваним атрибутом класу** (callable class attribute):

```python
class HtmlDocument:
    extension = "html"
    version = "5"

    def render():
        print("Rendering the HTML doc...")


print("render" in HtmlDocument.__dict__)
print(callable(HtmlDocument.render))
print(HtmlDocument.render)
HtmlDocument.render()
```

Результат (адреса щоразу різна):

```text
True
True
<function HtmlDocument.render at 0x1044c7270>
Rendering the HTML doc...
```

`render` лежить у `__dict__` поруч з `extension` і `version`. Це просто змінна класу, значенням якої є функція, і саме оголошення її не запускає. Вона виконується лише тоді, коли її викликають.

Цей `render()` не має параметра `self`, тому працює лише під час виклику через клас. Виклик через екземпляр (`HtmlDocument().render()`) спричиняє `TypeError`, бо Python автоматично передає екземпляр. Наступна тема, «Методи екземпляра», пояснює, чому так відбувається.

Функцію можна навіть додати до класу під час виконання, і кожен екземпляр отримає новий метод:

```python
class HtmlDocument:
    version = "5"


def describe(self):
    return f"HTML {self.version} document"


HtmlDocument.describe = describe
page = HtmlDocument()
print(page.describe())
```

Результат:

```text
HTML 5 document
```

## Змінні класу та екземпляри

Екземпляри можуть читати змінні класу через крапку. Якщо в екземпляра немає атрибута з такою назвою, Python шукає його в класі. Оскільки значення одне й спільне, зміну, зроблену через клас, видно з кожного екземпляра:

```python
class HtmlDocument:
    extension = "html"


page = HtmlDocument()
home = HtmlDocument()
print(page.extension, home.extension)

HtmlDocument.extension = "htm"
print(page.extension, home.extension)
```

Результат:

```text
html html
htm htm
```

Теми про змінні екземпляра та атрибути класу розглядають цей пошук докладніше.

## Типові помилки

- **Забути лапки в `getattr()` / `setattr()`.** Назва має бути рядком. Без лапок Python шукає *змінну* з такою назвою:

  ```python
  class HtmlDocument:
      extension = "html"


  setattr(HtmlDocument, media_type, "text/html")
  ```

  Результат:

  ```text
  Traceback (most recent call last):
    ...
  NameError: name 'media_type' is not defined
  ```

- **Писати в `__dict__`.** `HtmlDocument.__dict__["x"] = 1` спричиняє `TypeError`. Використовуйте `setattr()` або крапку.

- **Читати через `__dict__`.** Так пропускаються успадковані атрибути, і виникає `KeyError` там, де звичайний пошук спрацював би.

- **Одруківки непомітно створюють нові змінні.** Присвоєння ніколи не перевіряє, чи назва вже існує:

  ```python
  class HtmlDocument:
      version = "5"


  HtmlDocument.verison = "6"  # одруківка
  print(HtmlDocument.version)
  ```

  Результат:

  ```text
  5
  ```

- **Зберігати дані окремих екземплярів у змінюваній змінній класу.** Список, оголошений у тілі класу, — це один список на всі екземпляри, тож елементи «перетікають» між об'єктами. Дані окремого екземпляра мають створюватися в `__init__`, про що йдеться в наступних темах.

- **Присвоювати через екземпляр, щоб змінити змінну класу.** `page.extension = "htm"` створює новий атрибут лише в `page`. Щоб змінити спільне значення, присвоюйте через клас.

## Підсумок

- Клас — це об'єкт (екземпляр `type`), а змінні, присвоєні в його тілі, — це змінні класу, спільні для всіх екземплярів.
- Читайте їх через `ClassName.name` або `getattr(ClassName, "name")`. Відсутня назва спричиняє `AttributeError`, якщо не передати `getattr()` значення за замовчуванням.
- Змінюйте або додавайте їх через крапку чи `setattr()`, а видаляйте через `del` або `delattr()`. Назву в ці функції передають рядком.
- Змінні класу зберігаються в `ClassName.__dict__` — відображенні `mappingproxy`, доступному лише для читання. Воно містить тільки назви, оголошені безпосередньо в цьому класі.
- Використовуйте `__dict__` (або `vars()`), щоб досліджувати клас, а крапку чи `getattr()` — щоб користуватися його атрибутами.
- Кожна функція, оголошена в тілі класу, — це атрибут класу, який можна викликати.

## Практика

### Вправа 1: Налаштування зі значеннями за замовчуванням

Створіть клас `Settings` зі змінними класу `theme = "light"` і `font_size = 14`. Напишіть функцію `get_setting(name)`, яка повертає значення змінної класу або рядок `"not set"`, якщо такої змінної немає. Виведіть результати для `"theme"`, `"font_size"` і `"language"`.

### Вправа 2: Завантаження конфігурації

Візьміть той самий клас `Settings`. Застосуйте до класу таку конфігурацію за допомогою `setattr()` у циклі:

```python
config = {"theme": "dark", "language": "uk", "font_size": 16}
```

Потім виведіть в алфавітному порядку кожну змінну класу, назва якої не починається з підкреслення, у форматі `name = value`. Знайдіть їх через `__dict__` класу.

### Вправа 3: Безпечне видалення налаштування

Продовжте вправу 2. Видаліть `language` за допомогою `delattr()` і виведіть `hasattr(Settings, "language")` до й після цього. Потім спробуйте видалити її вдруге, перехопіть помилку й виведіть її повідомлення.

### Вправа 4: Передбачте результат

Запишіть, що виведе кожен рядок, а потім запустіть код для перевірки.

```python
class Base:
    color = "red"


class Child(Base):
    size = 10


print(Child.color)
print("color" in Child.__dict__)
Child.color = "blue"
print(Base.color, Child.color)
print("color" in Child.__dict__)
del Child.color
print(Child.color)
```

## Розв'язки

### Вправа 1

```python
class Settings:
    theme = "light"
    font_size = 14


def get_setting(name):
    return getattr(Settings, name, "not set")


print(get_setting("theme"))
print(get_setting("font_size"))
print(get_setting("language"))
```

Результат:

```text
light
14
not set
```

### Вправа 2

```python
class Settings:
    theme = "light"
    font_size = 14


config = {"theme": "dark", "language": "uk", "font_size": 16}
for name, value in config.items():
    setattr(Settings, name, value)

for name in sorted(Settings.__dict__):
    if not name.startswith("_"):
        print(name, "=", getattr(Settings, name))
```

Результат:

```text
font_size = 16
language = uk
theme = dark
```

`setattr()` і оновив наявні змінні (`theme`, `font_size`), і додав нову (`language`). Відсіювання назв, що починаються з `_`, приховує `__module__`, `__dict__` та інші записи, які додає Python.

### Вправа 3

```python
class Settings:
    theme = "light"
    font_size = 14


config = {"theme": "dark", "language": "uk", "font_size": 16}
for name, value in config.items():
    setattr(Settings, name, value)

print(hasattr(Settings, "language"))
delattr(Settings, "language")
print(hasattr(Settings, "language"))

try:
    delattr(Settings, "language")
except AttributeError as error:
    print("Error:", error)
```

Результат:

```text
True
False
Error: type object 'Settings' has no attribute 'language'
```

### Вправа 4

Результат:

```text
red
False
red blue
True
red
```

- `Child.color` знаходиться в `Base` завдяки успадкуванню, але в `Child.__dict__` його немає.
- `Child.color = "blue"` створює в `Child` нову змінну класу, яка **затіняє** (shadows) успадковану. `Base.color` не змінюється.
- Після `del Child.color` пошук знову доходить до `Base` і знаходить `"red"`.

---

*Джерело: [pythontutorial.net — Python Class Variables](https://www.pythontutorial.net/python-oop/python-class-variables/). Адаптовано й доповнено для PyJourney.*
