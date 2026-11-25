# Булевий тип (bool)

Тип `bool` у Python має лише два значення: `True` і `False`. Проте *будь-який* об'єкт у Python може виступати булевим значенням в умові `if` чи `while`. Розуміння того, як Python вирішує, вважати об'єкт істинним чи хибним, пояснює, чому працюють ідіоми на кшталт `if items:`, і допомагає уникнути кількох класичних помилок.

## Що ви дізнаєтесь

- Чому `bool` — підклас `int` і що це означає на практиці
- Чому `True` і `False` — синглтони і як правильно порівнювати булеві значення
- Які об'єкти вважаються *хибними* (falsy), а які *істинними* (truthy)
- Як працює `bool()`: спершу `__bool__()`, потім `__len__()`, інакше `True`
- Як задати логічне значення екземплярам власних класів
- Коли досить перевірки `if value:`, а коли потрібне `is None`

## Тип bool

Для булевих значень у Python є вбудований клас `bool`. Він **успадковується від `int`**, тож кожне булеве значення водночас є цілим числом:

```python
print(issubclass(bool, int))
print(isinstance(True, bool), isinstance(False, bool))
print(isinstance(True, int))
print(type(True))
```

Результат:

```text
True
True True
True
<class 'bool'>
```

Кілька фактів про цей тип:

- `bool` має рівно два екземпляри: `True` і `False`. Це **синглтони** (singleton): кожне `True` у програмі — той самий об'єкт, і так само кожне `False`. Будь-який вираз, що дає булеве значення (`5 > 3`, `bool(x)`, `isinstance(...)`), повертає один із цих двох об'єктів.
- `True` і `False` — ключові слова, тож перев'язати їх не можна: `True = 0` дає `SyntaxError: cannot assign to True`.
- Від `bool` не можна успадковуватися. `class MyBool(bool): ...` генерує `TypeError: type 'bool' is not an acceptable base type`. Так гарантується, що ці два синглтони лишаються єдиними булевими значеннями.
- Починаючи з Python 3.12 обидва об'єкти безсмертні, тож їхній лічильник посилань ніколи не змінюється (див. тему «Посилання»).

## Булеві значення — це цілі числа

Оскільки `bool` успадковується від `int`, в арифметиці `True` поводиться як `1`, а `False` — як `0`:

```python
print(int(True))
print(int(False))

print(True + True)
print(True * 10)
print(sum([True, False, True]))

scores = [72, 45, 90, 58, 100]
passed = sum(score >= 60 for score in scores)
print(passed)
```

Результат:

```text
1
0
2
10
2
3
```

Останній приклад — поширена ідіома: кожне порівняння дає `True` або `False`, а `sum()` рахує кількість `True`. Арифметичні операції з булевими значеннями повертають звичайний `int` (`type(True + True)` — це `int`).

Проте «рівні» не означає «той самий об'єкт». `True == 1` дорівнює `True`, але `True` і `1` — різні об'єкти. А оскільки вони рівні *й* мають однаковий хеш, то як ключі словника вони конфліктують:

```python
x = 1
print(True == x)
print(True is x)

data = {1: "one", True: "yes"}
print(data)
```

Результат:

```text
True
False
{1: 'yes'}
```

Словник зберіг перший ключ (`1`) і перезаписав його значення на `"yes"`, бо для Python `1` і `True` — однаковий ключ. Те саме відбувається з множинами: `{1, True}` містить один елемент.

## Порівняння булевих значень

Оскільки `True` і `False` — синглтони, `==` та `is` дають однакову відповідь, коли обидві сторони справді булеві:

```python
a = True
b = True

print(a == b)
print(a is b)

a = False
b = False

print(a == b)
print(a is b)

print(bool(42) is True)
print((5 > 3) is True)
```

Результат:

```text
True
True
True
True
True
True
```

Утім, у повсякденному коді з `True` чи `False` майже ніколи не порівнюють. PEP 8, посібник зі стилю Python, радить перевіряти саме значення:

```python
is_ready = True

# Добре
if is_ready:
    ...

# Уникайте
if is_ready == True:
    ...

# Ще гірше
if is_ready is True:
    ...
```

Пряма форма коротша, читається як звичайна мова і працює з будь-яким істинним значенням. `is True` використовуйте лише в рідкісних випадках, коли треба відрізнити саме об'єкт `True` від інших істинних значень, наприклад для параметра, який приймає або `True`, або рядок.

## Істинність: кожен об'єкт має логічне значення

Конструктор `bool(obj)` приймає **будь-який** об'єкт і повертає `True` або `False`. Результат називають логічним значенням (truth value) об'єкта. Об'єкти з логічним значенням `False` називають **хибними** (falsy), а всі інші — **істинними** (truthy).

Хибними є такі об'єкти:

- `None` і `False`
- нуль будь-якого числового типу: `0`, `0.0`, `0j`, `Decimal(0)`, `Fraction(0)`
- порожні послідовності: `""`, `[]`, `()`, `range(0)`, `b""`
- порожні словники та множини: `{}`, `set()`, `frozenset()`
- екземпляри класів, у яких `__bool__()` повертає `False` або `__len__()` повертає `0`

Усе інше істинне, зокрема й значення, які лише *здаються* хибними:

```python
from decimal import Decimal
from fractions import Fraction

falsy = [None, False, 0, 0.0, 0j, Decimal(0), Fraction(0),
         "", [], (), range(0), b"", {}, set(), frozenset()]
print(all(bool(value) is False for value in falsy))

truthy = ["0", "False", " ", [0], [[]], (None,), -1, 0.001, float("nan")]
for value in truthy:
    print(f"{value!r:>10} -> {bool(value)}")
```

Результат:

```text
True
       '0' -> True
   'False' -> True
       ' ' -> True
       [0] -> True
      [[]] -> True
   (None,) -> True
        -1 -> True
     0.001 -> True
       nan -> True
```

Зверніть увагу на `"0"` і `"False"` (непорожні рядки), `[0]` (список з одним елементом) і `float("nan")` (не дорівнює нулю).

Python неявно застосовує `bool()` у багатьох місцях: в умовах `if` і `while`, в операторах `and`, `or` і `not`, а також у функціях `any()`, `all()` і `filter(None, ...)`:

```python
values = [3, 0, "", "text", None, [1]]

print([value for value in values if value])
print(list(filter(None, values)))
print(any(values), all(values))
```

Результат:

```text
[3, 'text', [1]]
[3, 'text', [1]]
True False
```

## Як bool() працює всередині

Кожен клас — сам або через успадкування — визначає, як його екземпляри перетворюються на булеве значення. `bool(obj)` діє за таким алгоритмом:

```text
bool(obj)
   |
   v
чи визначає type(obj) метод __bool__()? --так--> повернути obj.__bool__()   (має бути bool)
   | ні
   v
чи визначає type(obj) метод __len__()?  --так--> повернути obj.__len__() != 0
   | ні
   v
повернути True
```

### Метод `__bool__()`

Якщо клас об'єкта визначає `__bool__()`, Python викликає його та використовує результат. У класі `int` цей метод реалізовано мовою C, але за логікою він рівнозначний такому коду:

```python
def __bool__(self):
    return self != 0
```

Тож `bool(200)` фактично виконує `(200).__bool__()`, що повертає `200 != 0`, тобто `True`. А `bool(0)` повертає `0 != 0`, тобто `False`:

```python
print((200).__bool__())
print((0).__bool__())
print(bool(200), bool(0))
```

Результат:

```text
True
False
True False
```

> **Зверніть увагу:** дужки в `(200).__bool__()` обов'язкові. Без них `200.__bool__()` — це `SyntaxError`, бо Python сприймає `200.` як початок літерала float.

### Метод `__len__()`

Якщо `__bool__()` немає, Python звертається до `__len__()`: довжина `0` означає `False`, будь-яка інша — `True`. Саме тому порожній список хибний, а список хоча б з одним елементом істинний, навіть якщо цей елемент сам хибний (`[0]`, `[[]]`).

### Жодного з методів: завжди `True`

Екземпляри класу, який не визначає жодного з цих методів, завжди істинні. Звичайний об'єкт не має поняття «порожній» чи «нульовий», тож Python трактує його як «щось існує».

### Логічне значення для власних класів

Визначайте `__bool__()`, коли істинність залежить від певної умови, і `__len__()`, коли ваш об'єкт — контейнер:

```python
class Account:
    def __init__(self, balance):
        self.balance = balance

    def __bool__(self):
        return self.balance > 0


class Playlist:
    def __init__(self, songs):
        self.songs = list(songs)

    def __len__(self):
        return len(self.songs)


class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y


print(bool(Account(100)), bool(Account(0)))
print(bool(Playlist(["Intro", "Outro"])), bool(Playlist([])))
print(bool(Point(0, 0)))
```

Результат:

```text
True False
True False
True
```

`Point(0, 0)` істинний, хоча обидві координати нульові, бо `Point` не визначає жодного з двох методів.

Python перевіряє, що повертають ці методи. `__bool__()` має повертати саме `bool` (повернути `1` недостатньо), а `__len__()` — невід'ємне ціле число:

```python
class Broken:
    def __bool__(self):
        return 1


print(bool(Broken()))
```

Результат (останній рядок traceback):

```text
TypeError: __bool__ should return bool, returned int
```

> **Зверніть увагу:** починаючи з Python 3.14, використання спеціального значення `NotImplemented` у булевому контексті (`bool(NotImplemented)`, `if NotImplemented:`) генерує `TypeError`. Раніше це лише викликало `DeprecationWarning`.

## Істинність на практиці

Припустімо, функція повертає список користувачів, порожній список або `None`, якщо джерело недоступне:

```python
def get_list(source):
    if source == "db":
        return ["alice", "bob"]
    if source == "cache":
        return []
    return None


for source in ["db", "cache", "unknown"]:
    my_list = get_list(source)
    if my_list is not None and len(my_list) > 0:
        for element in my_list:
            print(element)
    else:
        print("List is None or empty")
```

Результат:

```text
alice
bob
List is None or empty
List is None or empty
```

І `None`, і `[]` хибні, тож умову можна записати значно простіше, а поведінка не зміниться:

```python
def get_list(source):
    if source == "db":
        return ["alice", "bob"]
    if source == "cache":
        return []
    return None


for source in ["db", "cache", "unknown"]:
    my_list = get_list(source)
    if my_list:
        for element in my_list:
            print(element)
    else:
        print("List is None or empty")
```

Результат:

```text
alice
bob
List is None or empty
List is None or empty
```

`if my_list:` — ідіоматичний Python, але пам'ятайте, що саме це означає: «не `None` і не порожній». Якщо у вашій програмі `None` і «порожньо» мають різний зміст, перевіряйте їх окремо:

```python
def get_list(source):
    if source == "db":
        return ["alice", "bob"]
    if source == "cache":
        return []
    return None


for source in ["db", "cache", "unknown"]:
    my_list = get_list(source)
    if my_list is None:
        print(f"{source}: not available")
    elif not my_list:
        print(f"{source}: no users yet")
    else:
        print(f"{source}: {', '.join(my_list)}")
```

Результат:

```text
db: alice, bob
cache: no users yet
unknown: not available
```

## Типові помилки

- **Порівнювати з `True` чи `False`.** `if flag == True:` та `if flag is True:` довші за `if flag:` і для небулевих значень можуть поводитися інакше. Пишіть `if flag:` та `if not flag:`.
- **Вважати `0` чи `""` «відсутнім значенням».** Перевірка на істинність не розрізняє хибні значення між собою. Якщо `0` — допустиме значення, явно перевіряйте на `None`:

  ```python
  def set_volume(level=None):
      if not level:          # помилка: 0 — допустимий рівень
          level = 50
      return level


  def set_volume_fixed(level=None):
      if level is None:
          level = 50
      return level


  print(set_volume(0), set_volume_fixed(0))
  ```

  Результат:

  ```text
  50 0
  ```

- **Перетворювати текст через `bool()`.** Будь-який непорожній рядок істинний, тому і `bool("False")`, і `bool("0")` дорівнюють `True`. Розбирайте рядки явно (див. вправу 4):

  ```python
  answer = "False"
  print(bool(answer))
  print(bool("0"))
  ```

  Результат:

  ```text
  True
  True
  ```

- **Заперечувати булеве значення через `~`.** `~` — це побітова інверсія цілого числа, тому `~True` дорівнює `-2`, а це істинне значення. Починаючи з Python 3.12 така операція застаріла, а в 3.16 її планують прибрати. Використовуйте `not`:

  ```python
  is_ready = True
  print(~is_ready)      # DeprecationWarning з 3.12, виводить -2
  print(not is_ready)   # False
  ```

  Результат (саме попередження `DeprecationWarning` виводиться в stderr):

  ```text
  -2
  False
  ```

- **Змішувати `True` і `1` як ключі словника чи елементи множини.** Вони рівні й мають однаковий хеш, тож зливаються в один запис.
- **Повертати з `__bool__()` не `bool`.** Python згенерує `TypeError`. Повертайте `self.something > 0`, а не `self.something`.

## Підсумок

- `bool` — підклас `int`. `True` поводиться як `1`, а `False` — як `0`, тому `sum(condition for x in items)` — зручний лічильник.
- `True` і `False` — єдині два екземпляри `bool` (синглтони). Від `bool` не можна успадковуватися.
- Кожен об'єкт має логічне значення. Хибні: `None`, `False`, числові нулі, порожні послідовності, колекції та словники, а також об'єкти, чиї `__bool__()`/`__len__()` це визначають. Усе інше істинне.
- `bool(obj)` викликає `__bool__()`, за його відсутності — `__len__()`, а якщо немає жодного, повертає `True`.
- Надавайте перевагу `if value:` замість порівнянь із `True`/`False`, але використовуйте `is None`, коли `0`, `""` чи `[]` — допустимі значення.
- `__bool__()` має повертати справжній `bool`. Починаючи з Python 3.14, `NotImplemented` не можна використовувати як булеве значення.

## Практика

### Вправа 1: Істинне чи хибне?

Передбачте, чи кожне значення істинне, чи хибне, а потім перевірте за допомогою циклу, який виводить `repr(value)` і `bool(value)`:

```text
0, "0", [], [[]], None, 0.0, -1, " ", {}, float("nan"), range(0), (0,)
```

### Вправа 2: Лічба за допомогою булевих значень

Маючи `scores = [72, 45, 90, 58, 100, 60, 33]`, порахуйте, скільки студентів склали іспит (60 балів і більше), використовуючи `sum()` над булевими значеннями, без явного лічильника та `if`. Виведіть кількість і відсоток тих, хто склав.

### Вправа 3: Кошик, який знає, що він порожній

Напишіть клас `Cart` з методом `add(item)` так, щоб для нового кошика `if not cart:` виводило `"Cart is empty"`, а після додавання товарів умова `if cart:` справджувалася. Не визначайте `__bool__()`.

### Вправа 4: Розбір булевих значень із тексту

Напишіть функцію `parse_bool(text)`, яка перетворює введений користувачем текст на булеве значення. Вона має ігнорувати регістр і пробіли на краях, повертати `True` для `"true"`, `"yes"`, `"y"`, `"on"`, `"1"`, повертати `False` для `"false"`, `"no"`, `"n"`, `"off"`, `"0"` і порожнього рядка, а для будь-чого іншого генерувати `ValueError`.

## Розв'язки

### Вправа 1

```python
values = [0, "0", [], [[]], None, 0.0, -1, " ", {}, float("nan"), range(0), (0,)]
for value in values:
    print(f"{value!r:>12} -> {bool(value)}")
```

Результат:

```text
           0 -> False
         '0' -> True
          [] -> False
        [[]] -> True
        None -> False
         0.0 -> False
          -1 -> True
         ' ' -> True
          {} -> False
         nan -> True
 range(0, 0) -> False
        (0,) -> True
```

Підступні випадки: `"0"` і `" "` — непорожні рядки; `[[]]` і `(0,)` містять по одному елементу; `nan` не дорівнює нулю; `range(0)` має довжину 0.

### Вправа 2

```python
scores = [72, 45, 90, 58, 100, 60, 33]

passed = sum(score >= 60 for score in scores)
print(f"passed: {passed} of {len(scores)}")
print(f"pass rate: {passed / len(scores):.0%}")
```

Результат:

```text
passed: 4 of 7
pass rate: 57%
```

Кожне `score >= 60` — це `True` (1) або `False` (0), тож сума дорівнює кількості успішних результатів. Формат `:.0%` множить число на 100 і додає знак відсотка.

### Вправа 3

```python
class Cart:
    def __init__(self):
        self.items = []

    def add(self, item):
        self.items.append(item)

    def __len__(self):
        return len(self.items)


cart = Cart()
if not cart:
    print("Cart is empty")

cart.add("book")
cart.add("pen")
if cart:
    print(f"Cart has {len(cart)} items")
```

Результат:

```text
Cart is empty
Cart has 2 items
```

Без `__bool__()` Python використовує `__len__()`, тож порожній кошик хибний. Бонус: тепер працює й `len(cart)`.

### Вправа 4

```python
TRUE_WORDS = {"true", "yes", "y", "on", "1"}
FALSE_WORDS = {"false", "no", "n", "off", "0", ""}


def parse_bool(text):
    word = text.strip().lower()
    if word in TRUE_WORDS:
        return True
    if word in FALSE_WORDS:
        return False
    raise ValueError(f"not a boolean: {text!r}")


for text in ["Yes", " false ", "0", "ON", ""]:
    print(repr(text), parse_bool(text))

try:
    parse_bool("maybe")
except ValueError as error:
    print(error)
```

Результат:

```text
'Yes' True
' false ' False
'0' False
'ON' True
'' False
not a boolean: 'maybe'
```

Згенерувати помилку для невідомого введення безпечніше, ніж вгадувати: одрук на кшталт `"ture"` буде помічено, а не тихо перетворено на `False`.

---

*Джерело: [pythontutorial.net — How Python bool() Constructor Works Under the Hood](https://www.pythontutorial.net/advanced-python/python-bool/). Адаптовано й доповнено для PyJourney.*
