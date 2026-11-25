# __bool__

Будь-який об'єкт Python можна використати в умові: `if cart:`, `while queue:`, `x or default`. Чи вважається об'єкт «істинним» чи «хибним», Python вирішує за його **істинністю** (truth value). Спеціальний метод `__bool__` разом із запасним варіантом `__len__` дає змогу вашим власним класам природно брати в цьому участь.

## Що ви дізнаєтесь

- Де Python перевіряє істинність: `if`, `while`, `and`, `or`, `not`, `bool()` тощо
- Чому об'єкти власного класу за замовчуванням істинні
- Як реалізувати `__bool__` і що він має повертати
- Як `__len__` використовується як запасний варіант, коли `__bool__` немає
- Як `and` та `or` використовують істинність, але повертають операнди
- Чому `if obj:` і `if obj is not None:` — це різні запитання

## Перевірка істинності

Python запитує в об'єкта його істинність щоразу, коли потрібна відповідь «так/ні»:

- `if obj:`, `elif obj:` і `while obj:`
- `not obj`, `a and b`, `a or b`
- умовний вираз `x if obj else y`
- `bool(obj)`, `any()`, `all()`, `filter(None, items)` і `assert obj`

Вбудовані типи вже мають розумні правила. Нульові числа (`0`, `0.0`), порожні контейнери (`""`, `[]`, `{}`, `set()`), `None` і `False` — **хибні** (falsy). Усе інше — **істинне** (truthy).

## Власні об'єкти за замовчуванням істинні

Клас, що не визначає ні `__bool__`, ні `__len__`, створює об'єкти, які завжди істинні:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age


person = Person("John", 25)
print(bool(person))
if person:
    print("person is truthy")
```

Результат:

```text
True
person is truthy
```

Саме завдяки цій поведінці працює поширений шаблон `if user:`, що розрізняє «об'єкт користувача існує» і `None`.

## Реалізація `__bool__`

`__bool__(self)` має повертати рівно `True` або `False`. Python викликає його щоразу, коли потрібна істинність вашого об'єкта. Для прикладу вважатимемо людину «істинною», лише якщо їй від 18 до 65 років:

```python
class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def __bool__(self):
        if self.age < 18 or self.age > 65:
            return False
        return True


person = Person("Jane", 16)
print(bool(person))
print(bool(Person("Ann", 40)))
```

Результат:

```text
False
True
```

Конструкцію `if/else` можна скоротити до одного виразу, який і так дає `bool`:

```python
def __bool__(self):
    return 18 <= self.age <= 65
```

> **Зверніть увагу:** приклад показує механіку, але його зміст сумнівний: 16-річна людина не є «хибною». Коли умова — це бізнес-правило, явний метод на кшталт `person.is_working_age()` читається легше. Залиште `__bool__` для класів, де «порожньо», «нуль» чи «нічого» — очевидне значення.

### `__bool__` має повертати справжній `bool`

Якщо повернути `1`, `0` чи будь-яке інше значення, виникне `TypeError`. Часто це стається випадково через `or`, який повертає один зі своїх операндів:

```python
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __bool__(self):
        return self.x or self.y  # повертає число, а не bool


try:
    if Point(3, 0):
        print("non-zero")
except TypeError as error:
    print("TypeError:", error)
```

Результат:

```text
TypeError: __bool__ should return bool, returned int
```

Пишіть `return self.x != 0 or self.y != 0` або загорніть вираз у `bool(...)`.

## Запасний варіант `__len__`

Якщо в класі немає `__bool__`, Python шукає `__len__`. Об'єкт із довжиною `0` хибний, з будь-якою іншою довжиною — істинний. Саме так поводяться списки, рядки й словники, тож класи-контейнери отримують правильну істинність без зайвих зусиль:

```python
class Payroll:
    def __init__(self, length):
        self.length = length

    def __len__(self):
        print("len was called...")
        return self.length


payroll = Payroll(0)
print(bool(payroll))

payroll.length = 10
print(bool(payroll))
```

Результат:

```text
len was called...
False
len was called...
True
```

Виведені повідомлення доводять, що `bool()` викликав `__len__`. `__len__` має повертати невід'ємне ціле число; від'ємне значення спричиняє `ValueError`, а не ціле — `TypeError`.

Повний порядок пошуку такий:

```text
bool(obj)
 1. type(obj) має __bool__?  -> його результат (має бути True або False)
 2. type(obj) має __len__?   -> True, якщо len(obj) != 0, інакше False
 3. немає жодного            -> True
```

### `__bool__` має перевагу над `__len__`

Коли є обидва методи, Python викликає лише `__bool__`:

```python
class Report:
    def __init__(self, rows):
        self.rows = rows

    def __len__(self):
        print("__len__ called")
        return len(self.rows)

    def __bool__(self):
        print("__bool__ called")
        return True  # звіт існує, навіть якщо в ньому немає рядків


report = Report([])
print(len(report))
print(bool(report))
```

Результат:

```text
__len__ called
0
__bool__ called
True
```

## `and`, `or` і `not` з власними об'єктами

`not` завжди повертає `bool`. А от `and` і `or` використовують істинність лише для того, щоб вирішити, **який операнд повернути**, і повертають саме цей операнд:

- `a or b` повертає `a`, якщо `a` істинний, інакше `b`.
- `a and b` повертає `a`, якщо `a` хибний, інакше `b`.

```python
class Wallet:
    def __init__(self, amount):
        self.amount = amount

    def __bool__(self):
        return self.amount > 0

    def __repr__(self):
        return f"Wallet({self.amount})"


empty = Wallet(0)
full = Wallet(50)

print(empty or full)
print(full and empty)
print(not empty)
print(any([empty, full]))
print(all([empty, full]))
print(list(filter(None, [empty, full, Wallet(5)])))
```

Результат:

```text
Wallet(50)
Wallet(0)
True
True
False
[Wallet(50), Wallet(5)]
```

`filter(None, items)` залишає тільки істинні елементи, тож він теж використовує `__bool__`.

## `if obj:` — це не `if obj is not None:`

Щойно клас отримує `__bool__` або `__len__`, наявний об'єкт може виявитися хибним. Код, який використовує `if obj:` у значенні «чи отримав я об'єкт?», тоді тихо ламається:

```python
class Team:
    def __init__(self, name, members):
        self.name = name
        self.members = members

    def __len__(self):
        return len(self.members)


teams = {"red": Team("red", ["Ann", "Bob"]), "blue": Team("blue", [])}


def find_team(name):
    return teams.get(name)


for name in ["red", "blue", "green"]:
    team = find_team(name)
    if team:
        print(f"{name}: found")
    else:
        print(f"{name}: no such team")
```

Результат:

```text
red: found
blue: no such team
green: no such team
```

Команда `blue` існує, але в ній немає учасників, тож вона хибна й вважається відсутньою. Коли `None` означає «не знайдено», перевіряйте це явно через `is None` або `is not None`. У вправі 4 цей код виправлено.

> **Порада:** деякі бібліотеки відмовляються вгадувати. Масив NumPy з кількома елементами в `if` генерує `ValueError: The truth value of an array with more than one element is ambiguous`. Це свідоме рішення: ви маєте явно написати `arr.any()` чи `arr.all()`.

## Типові помилки

- **Повертати з `__bool__` не `bool`.** `return self.count` або `return self.x or self.y` спричиняє `TypeError`. Повертайте порівняння або загортайте значення в `bool()`.
- **Використовувати `__bool__` для бізнес-правил.** `if person:` у значенні «працездатного віку» дивує читачів. Використовуйте метод або властивість з промовистою назвою.
- **Перевіряти `None` через істинність.** Порожні, але наявні об'єкти хибні. Пишіть `if result is None:`.
- **Забувати, що `__len__` теж впливає на істинність.** Додавши класу `__len__`, ви змінюєте поведінку його об'єктів у кожному `if`.
- **Повертати від'ємне число з `__len__`.** `bool()` і `len()` згенерують `ValueError`.
- **Очікувати, що `and` / `or` повернуть `True` чи `False`.** Вони повертають один з операндів.

## Підсумок

- Кожен об'єкт має істинність, яку використовують `if`, `while`, `not`, `and`, `or`, `bool()`, `any()`, `all()` і `filter(None, ...)`.
- Об'єкти власного класу істинні, якщо клас не вказує інше.
- `__bool__` має повертати рівно `True` або `False`; будь-який інший тип спричиняє `TypeError`.
- Без `__bool__` Python використовує `__len__`: довжина `0` означає хибність.
- Якщо є обидва методи, перевагу має `__bool__`. Якщо немає жодного, об'єкт істинний.
- `and` та `or` повертають операнди, а не значення `bool`; `not` завжди повертає `bool`.
- Щоб перевірити відсутність об'єкта, використовуйте `is None`, а не істинність.

## Практика

### Вправа 1: Порожній плейлист

Напишіть клас `Playlist`, який зберігає список пісень і реалізує лише `__len__`. Напишіть функцію `play(playlist)`, яка за допомогою `if playlist:` виводить `Playing N songs` для непорожнього плейлиста і `Playlist is empty` в іншому разі.

### Вправа 2: Нульовий вектор

Напишіть клас `Vector` з `x` і `y`. Вектор хибний лише тоді, коли обидві компоненти нульові (`0` або `0.0`). Додайте `__repr__`, виведіть кожен вектор із `[Vector(0, 0), Vector(3, 0), Vector(0, -2), Vector(0.0, 0.0)]` разом з його істинністю, а потім залиште лише ненульові вектори за допомогою `filter(None, ...)`.

### Вправа 3: Передбачте результат

Використовуючи клас `Wallet` з цього уроку, передбачте кожен рядок:

```python
class Wallet:
    def __init__(self, amount):
        self.amount = amount

    def __bool__(self):
        return self.amount > 0

    def __repr__(self):
        return f"Wallet({self.amount})"


a, b, c = Wallet(0), Wallet(10), Wallet(-5)
print(a or b)
print(a or c)
print(b and c)
print(not c)
print(b and "paid")
print([w for w in (a, b, c) if w])
```

### Вправа 4: Виправте зниклу команду

Перепишіть цикл із розділу «`if obj:` — це не `if obj is not None:`» так, щоб він виводив три різні повідомлення: `red: found, 2 members`, `blue: found, but it has no members` і `green: no such team`.

## Розв'язки

### Вправа 1

```python
class Playlist:
    def __init__(self, songs=None):
        self.songs = list(songs or [])

    def __len__(self):
        return len(self.songs)


def play(playlist):
    if playlist:
        print(f"Playing {len(playlist)} songs")
    else:
        print("Playlist is empty")


play(Playlist())
play(Playlist(["Song A", "Song B", "Song C"]))
```

Результат:

```text
Playlist is empty
Playing 3 songs
```

`songs=None` разом із `list(songs or [])` дає змогу уникнути спільного змінюваного значення за замовчуванням, а заодно копіює список, переданий викликачем.

### Вправа 2

```python
class Vector:
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __bool__(self):
        return self.x != 0 or self.y != 0

    def __repr__(self):
        return f"Vector({self.x}, {self.y})"


vectors = [Vector(0, 0), Vector(3, 0), Vector(0, -2), Vector(0.0, 0.0)]
for v in vectors:
    print(v, bool(v))
print(list(filter(None, vectors)))
```

Результат:

```text
Vector(0, 0) False
Vector(3, 0) True
Vector(0, -2) True
Vector(0.0, 0.0) False
[Vector(3, 0), Vector(0, -2)]
```

Обидва порівняння повертають `bool`, тож і `or` повертає `bool`. `0.0 != 0` дає `False`, тому нульовий вектор із дробовими компонентами теж хибний.

### Вправа 3

Результат:

```text
Wallet(10)
Wallet(-5)
Wallet(-5)
True
paid
[Wallet(10)]
```

- `a or b`: `a` хибний, тож `or` повертає `b`.
- `a or c`: `a` хибний, тож `or` повертає `c`, хоча `c` теж хибний.
- `b and c`: `b` істинний, тож `and` повертає `c`.
- `not c`: сума `-5` не більша за 0, тому `c` хибний, а `not c` дає `True`.
- `b and "paid"`: `b` істинний, тож результат — рядок `"paid"`.
- Спискове включення залишає тільки істинні гаманці.

### Вправа 4

```python
class Team:
    def __init__(self, name, members):
        self.name = name
        self.members = members

    def __len__(self):
        return len(self.members)


teams = {"red": Team("red", ["Ann", "Bob"]), "blue": Team("blue", [])}


def find_team(name):
    return teams.get(name)


for name in ["red", "blue", "green"]:
    team = find_team(name)
    if team is None:
        print(f"{name}: no such team")
    elif not team:
        print(f"{name}: found, but it has no members")
    else:
        print(f"{name}: found, {len(team)} members")
```

Результат:

```text
red: found, 2 members
blue: found, but it has no members
green: no such team
```

Перевірка ідентичності `is None` відповідає на запитання «чи знайдено команду?», і лише після цього істинність відповідає на запитання «чи є в ній учасники?».

---

*Джерело: [pythontutorial.net — Python __bool__](https://web.archive.org/web/2026/https://www.pythontutorial.net/python-oop/python-__bool__/). Адаптовано й доповнено для PyJourney.*
