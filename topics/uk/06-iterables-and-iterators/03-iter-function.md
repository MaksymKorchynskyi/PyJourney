# Функція iter()

Вбудована функція `iter()` — точка входу в перебір: кожен цикл `for` починається з її виклику. Вона має дві форми. `iter(obj)` отримує ітератор з об'єкта, а `iter(callable, sentinel)` перетворює звичайну функцію на ітератор, що зупиняється на заданому значенні. Знаючи обидві форми, легко зрозуміти, чому деякі об'єкти ітеровані без методу `__iter__()`, і отримати зручний інструмент для читання даних частинами.

## Що ви дізнаєтесь

- Як `iter(obj)` обирає між `__iter__()` і старішим протоколом послідовності `__getitem__()`
- Як протокол послідовності обходить об'єкт за індексами `0, 1, 2, …`
- Що відбувається, коли клас має обидва методи
- Як працює `iter(callable, sentinel)` і де це корисно
- Як надійно перевірити, чи об'єкт ітерований

## Перша форма: `iter(obj)`

```text
iter(obj)
```

`iter()` повертає ітератор для `obj`. Аргументом може бути ітерований об'єкт, що реалізує `__iter__()`, або *послідовність*, що реалізує `__getitem__()`. Python ухвалює рішення так:

```text
iter(obj)
  |
  +-- чи визначає тип obj метод __iter__()?
  |      так -> викликати його. Результат має бути ітератором,
  |             інакше: TypeError: iter() returned non-iterator ...
  |
  +-- ні: чи визначає він __getitem__()?
  |      так -> повернути ітератор послідовності, який викликає
  |             obj[0], obj[1], obj[2], ... до IndexError
  |
  +-- ні: TypeError: '...' object is not iterable
```

Цикл `for`, `list()`, `tuple()`, розпакування та багато інших інструментів проходять ті самі кроки, бо всі вони всередині викликають `iter()`.

### Жодного протоколу: `TypeError`

Клас без обох методів не є ітерованим:

```python
class Counter:
    def __init__(self):
        self.current = 0


counter = Counter()

try:
    iterator = iter(counter)
except TypeError as error:
    print("TypeError:", error)
```

Результат:

```text
TypeError: 'Counter' object is not iterable
```

## Протокол послідовності: `__getitem__()`

До появи протоколу ітератора цикл `for` працював через індексацію: викликав `obj[0]`, `obj[1]`, `obj[2]`, … доти, доки об'єкт не генерував `IndexError`. `iter()` і досі підтримує це заради зворотної сумісності. Якщо клас не має `__iter__()`, але має `__getitem__()`, `iter()` створює універсальний ітератор, який виконує цю індексацію замість вас.

Клас нижче показує, які індекси запитує Python:

```python
class Probe:
    def __getitem__(self, index):
        print("asked for index", index)
        if index >= 3:
            raise IndexError(index)
        return index * 10


print(list(Probe()))
```

Результат:

```text
asked for index 0
asked for index 1
asked for index 2
asked for index 3
[0, 10, 20]
```

Сигналом завершення тут є `IndexError`: він відіграє ту саму роль, що й `StopIteration` у протоколі ітератора. Найпростіше зробити все правильно, делегувавши роботу списку, який сам генерує `IndexError` за межами своїх елементів:

```python
class Weekdays:
    def __init__(self):
        self._names = ["Mon", "Tue", "Wed", "Thu", "Fri"]

    def __getitem__(self, index):
        return self._names[index]


week = Weekdays()
print(type(iter(week)))

for day in week:
    if day.startswith("T"):
        print(day)

print(list(week))
print(*week)
print("Wed" in week)
```

Результат:

```text
<class 'iterator'>
Tue
Thu
['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
Mon Tue Wed Thu Fri
True
```

Тип універсального ітератора називається просто `iterator`. Працює розпакування через `*` і навіть оператор `in`: якщо немає `__contains__()`, Python перебирає елементи й порівнює кожен із шуканим.

### `__getitem__()`, який ніколи не закінчується

Метод `__getitem__()` має враховувати отриманий індекс. Ця версія його ігнорує і просто рахує виклики:

```python
class Counter:
    def __init__(self):
        self.current = 0

    def __getitem__(self, index):
        if isinstance(index, int):
            self.current += 1
            return self.current


counter = Counter()
iterator = iter(counter)
print(type(iterator))

for _ in range(3):
    print(next(iterator))
```

Результат:

```text
<class 'iterator'>
1
2
3
```

Взяти три значення через `next()` вдається, але ця «послідовність» ніколи не генерує `IndexError`, тому `for n in counter:` чи `list(counter)` працювали б вічно. До того ж `counter[100]` повертає `4`, а `counter["a"]` повертає `None`. Справжня послідовність має повертати елемент **на** вказаній позиції і генерувати `IndexError` (для неправильної позиції) або `TypeError` (для індексу неправильного типу).

> **Зверніть увагу:** у нових класах віддавайте перевагу `__iter__()`. Запасний механізм через `__getitem__()` корисний переважно для класів, які справді є послідовностями, де індексація і так природна операція.

## Коли є обидва методи, перемагає `__iter__()`

Якщо клас визначає обидва методи, `iter()` використовує `__iter__()` і для перебору взагалі не чіпає `__getitem__()`. Індексація через `[]` і далі викликає `__getitem__()`:

```python
class Letters:
    def __init__(self, text):
        self.text = text

    def __getitem__(self, index):
        print(f"__getitem__({index}) called")
        return self.text[index]

    def __iter__(self):
        print("__iter__() called")
        return iter(self.text)


letters = Letters("abc")
print(list(letters))
print(letters[1])
```

Результат:

```text
__iter__() called
['a', 'b', 'c']
__getitem__(1) called
b
```

Те саме правило діє, коли `__iter__()` повертає власний клас-ітератор, наприклад вкладений:

```python
class Counter:
    def __init__(self):
        self.current = 0

    def __getitem__(self, index):
        if isinstance(index, int):
            self.current += 1
            return self.current

    def __iter__(self):
        return self.CounterIterator(self)

    class CounterIterator:
        def __init__(self, counter):
            self._counter = counter

        def __iter__(self):
            return self

        def __next__(self):
            self._counter.current += 1
            return self._counter.current


counter = Counter()
iterator = iter(counter)
print(type(iterator))

for _ in range(3):
    print(next(iterator))
```

Результат:

```text
<class '__main__.Counter.CounterIterator'>
1
2
3
```

Тип — `Counter.CounterIterator`, а не універсальний `iterator`. Це доводить, що `iter()` викликала саме `__iter__()`.

> **Порада:** щоб явно зробити клас **неітерованим**, хоча він має `__getitem__()` (наприклад, клас на зразок словника, що індексується рядками), запишіть у тілі класу `__iter__ = None`. Тоді `iter()` згенерує `TypeError` замість того, щоб пробувати індекси `0, 1, 2, …`.

## Друга форма: `iter(callable, sentinel)`

```text
iter(callable, sentinel)
```

З двома аргументами `iter()` створює **ітератор виклику** (callable iterator):

- кожен виклик `next()` викликає `callable()` **без аргументів**;
- якщо результат дорівнює `sentinel` (порівняння через `==`), ітератор генерує `StopIteration`, а саме сигнальне значення **не** повертається;
- інакше результат повертається.

*Сигнальне значення* (sentinel) — це особливе значення, яке позначає кінець даних, як-от порожній рядок наприкінці файлу.

Щоб побачити, як це працює, почнемо з функції, яка повертає замикання. Кожен виклик замикання повертає наступне ціле число:

```python
def counter():
    count = 0

    def increase():
        nonlocal count
        count += 1
        return count

    return increase


cnt = counter()

while True:
    current = cnt()
    print(current)
    if current == 3:
        break
```

Результат:

```text
1
2
3
```

Логіку циклу (викликати, порівняти, зупинитися) можна запакувати в багаторазовий клас-ітератор:

```python
class CallUntil:
    def __init__(self, fn, sentinel):
        self.fn = fn
        self.sentinel = sentinel

    def __iter__(self):
        return self

    def __next__(self):
        current = self.fn()
        if current == self.sentinel:
            raise StopIteration

        return current


cnt = counter()
for count in CallUntil(cnt, 4):
    print(count)
```

Результат:

```text
1
2
3
```

`CallUntil` викликає `fn()` під час кожного `next()` і зупиняється, коли результат дорівнює сигнальному значенню. Саме це вже вміє двоаргументна форма `iter()`, тож писати клас узагалі не потрібно:

```python
cnt = counter()
iterator = iter(cnt, 4)
print(type(iterator))

for count in iterator:
    print(count)
```

Результат:

```text
<class 'callable_iterator'>
1
2
3
```

Значення `4` повернув `cnt()`, воно збіглося із сигнальним і завершило цикл, так і не потрапивши на екран.

### Практичне застосування

**Читання файлу частинами фіксованого розміру.** Наприкінці файлу `read(size)` повертає порожній рядок, тож `""` — природне сигнальне значення. Функція має бути без аргументів, тому обгорніть `read(4)` у `functools.partial` (або `lambda`). Тут `io.StringIO` слугує файлом у пам'яті, щоб приклад працював без створення файлів:

```python
import io
from functools import partial

stream = io.StringIO("abcdefghij")

for chunk in iter(partial(stream.read, 4), ""):
    print(chunk)
```

Результат:

```text
abcd
efgh
ij
```

Зі справжнім файлом схема та сама: `with open(path, "rb") as f: for block in iter(partial(f.read, 65536), b""): ...`. Для двійкових файлів сигнальним значенням має бути `b""`.

**Обробка черги до маркера зупинки.** Це поширений прийом у робочих потоках, де `None` наказує потоку зупинитися:

```python
from queue import Queue

jobs = Queue()
for job in ["resize", "compress", "upload", None]:
    jobs.put(job)

for job in iter(jobs.get, None):
    print("processing", job)
print("worker stopped")
```

Результат:

```text
processing resize
processing compress
processing upload
worker stopped
```

Щойно сигнальне значення трапилося, ітератор виклику вичерпано назавжди: подальші виклики `next()` генерують `StopIteration`, уже не викликаючи функцію.

## Як перевірити, чи об'єкт ітерований

Можна самостійно шукати `__iter__()` і `__getitem__()`, але найпростіша й найнадійніша перевірка — спитати `iter()` і подивитися, чи вона не заперечить:

```python
def is_iterable(obj):
    try:
        iter(obj)
    except TypeError:
        return False
    else:
        return True


print(is_iterable([1, 2, 3]))
print(is_iterable("Python iter"))
print(is_iterable(100))
```

Результат:

```text
True
True
False
```

`iter()` генерує `TypeError`, коли об'єкт не підтримує жодного з протоколів. На відміну від `isinstance(obj, collections.abc.Iterable)`, ця перевірка розпізнає і класи, ітеровані лише через `__getitem__()`, як-от клас `Weekdays` вище:

```python
from collections.abc import Iterable

print(is_iterable(Weekdays()))
print(isinstance(Weekdays(), Iterable))
```

Результат:

```text
True
False
```

Виклик `iter()` для ітерованого об'єкта нічого не споживає. Він лише створює ітератор, який одразу викидається. Одне застереження: якщо `__iter__()` якогось класу через помилку сам генерує `TypeError`, `is_iterable()` поверне для нього `False`.

> **Порада:** у повсякденному коді `is_iterable()` потрібна рідко. Звичний для Python стиль — просто перебирати аргумент і дозволити `TypeError` з'явитися, якщо передали щось не те. Перевірка корисна, коли функція має приймати «одне значення або колекцію значень».

## Типові помилки

- **Передавати функцію, якій потрібні аргументи.** У `iter(callable, sentinel)` функція викликається **без** аргументів. `iter(stream.read, "")` формально допустимий, але `read()` без розміру читає все одразу, тож ви отримаєте одну величезну частину. Використовуйте `partial(stream.read, 4)` або `lambda: stream.read(4)`.

- **Брати сигнальне значення не того типу.** Двійковий потік наприкінці повертає `b""`, а це не дорівнює `""`. Цикл ніколи не зупиниться:

  ```python
  import io
  from functools import partial
  from itertools import islice

  data = io.BytesIO(b"abcdef")
  chunks = iter(partial(data.read, 4), "")   # помилка: має бути b""
  print(list(islice(chunks, 5)))             # islice рятує від нескінченного циклу
  ```

  Результат:

  ```text
  [b'abcd', b'ef', b'', b'', b'']
  ```

- **Передавати першим із двох аргументів щось, що не можна викликати.** `iter([1, 2], 3)` генерує `TypeError: iter(v, w): v must be callable`. Двоаргументна форма не означає «перебирати цей список до 3».

- **Писати `__getitem__()`, який ніколи не генерує `IndexError`.** Запасний механізм послідовності зупиняється лише на `IndexError`. Без нього цикли `for` і `list()` не закінчуються.

- **Перевіряти ітерованість лише через `hasattr(obj, "__iter__")` чи `isinstance(obj, Iterable)`.** Обидва способи пропускають послідовності, що мають лише `__getitem__()`. Використовуйте `iter()` всередині `try`/`except TypeError`.

- **Затіняти вбудовані імена.** Параметр з назвою `object`, `iter`, `list` чи `str` ховає вбудовану функцію до кінця тіла функції. Беріть імена на кшталт `obj` або `items`.

## Підсумок

- `iter(obj)` повертає ітератор для `obj`. Вона викликає `__iter__()`, якщо він є, інакше переходить до `__getitem__()`, а якщо немає й цього, генерує `TypeError`.
- Запасний механізм `__getitem__()` викликає `obj[0]`, `obj[1]`, … і зупиняється на `IndexError`. Тип такого ітератора — універсальний `iterator`.
- Якщо є обидва методи, для перебору завжди використовується `__iter__()`.
- `iter()` перевіряє, що `__iter__()` повертає справжній ітератор.
- `iter(callable, sentinel)` на кожному кроці викликає `callable()` і зупиняється (не повертаючи його), коли результат дорівнює `sentinel`. Це ідеально для читання частинами і для черг.
- `try: iter(obj) except TypeError` — найнадійніший спосіб перевірити, чи об'єкт ітерований.

## Практика

### Вправа 1: Які об'єкти ітеровані?

Передбачте, які з цих об'єктів прийме `is_iterable()`, а потім перевірте: `42`, `"42"`, `[4, 2]`, `{4: 2}`, `None`, `3.5`, `range(0)` та екземпляр класу `Weekdays` з прикладу вище.

### Вправа 2: Читання частинами

За допомогою `io.StringIO("The quick brown fox")` і двоаргументної форми `iter()` зберіть текст у список частин по 5 символів. Потім зробіть те саме для `io.BytesIO(b"The quick brown fox")`.

### Вправа 3: Послідовність без `__iter__()`

Напишіть клас `Squares`, екземпляри якого поводяться як послідовність квадратів `0, 1, 4, …, (n-1)**2`, доступна лише для читання. Реалізуйте тільки `__len__()` і `__getitem__()` (для індексів поза `0 … n-1` генеруйте `IndexError`). Покажіть, що працюють `for`, `list()`, оператор `in` і `reversed()`, а `isinstance(Squares(3), Iterable)` при цьому дорівнює `False`.

### Вправа 4: Сплощення

Напишіть функцію `flatten(items)`, яка повертає плаский список з ітерованих об'єктів довільної вкладеності. Наприклад, `flatten([1, [2, (3, 4)], "ab", [[5]], {6}])` повертає `[1, 2, 3, 4, 'ab', 5, 6]`. Використайте `is_iterable()`, але вважайте рядки окремими значеннями (інакше кожен однолітерний рядок ітерувався б без кінця).

## Розв'язки

### Вправа 1

```python
class Weekdays:
    def __init__(self):
        self._names = ["Mon", "Tue", "Wed", "Thu", "Fri"]

    def __getitem__(self, index):
        return self._names[index]

    def __repr__(self):
        return "Weekdays()"


def is_iterable(obj):
    try:
        iter(obj)
    except TypeError:
        return False
    return True


for value in [42, "42", [4, 2], {4: 2}, None, 3.5, range(0), Weekdays()]:
    print(f"{value!r:12} {is_iterable(value)}")
```

Результат:

```text
42           False
'42'         True
[4, 2]       True
{4: 2}       True
None         False
3.5          False
range(0, 0)  True
Weekdays()   True
```

`range(0)` порожній, але порожній не означає неітерований. Словник перебирається за ключами.

### Вправа 2

```python
import io
from functools import partial

text = io.StringIO("The quick brown fox")
print(list(iter(partial(text.read, 5), "")))

data = io.BytesIO(b"The quick brown fox")
print(list(iter(partial(data.read, 5), b"")))
```

Результат:

```text
['The q', 'uick ', 'brown', ' fox']
[b'The q', b'uick ', b'brown', b' fox']
```

Сигнальне значення має збігатися з тим, що `read()` повертає наприкінці: `""` для тексту, `b""` для байтів.

### Вправа 3

```python
from collections.abc import Iterable


class Squares:
    def __init__(self, n):
        self.n = n

    def __len__(self):
        return self.n

    def __getitem__(self, index):
        if not 0 <= index < self.n:
            raise IndexError("Squares index out of range")
        return index ** 2


squares = Squares(5)

total = 0
for value in squares:
    total += value
print(total)

print(list(squares))
print(9 in squares, 10 in squares)
print(list(reversed(squares)))
print(isinstance(squares, Iterable))
```

Результат:

```text
30
[0, 1, 4, 9, 16]
True False
[16, 9, 4, 1, 0]
False
```

`reversed()` за допомогою `__len__()` знаходить останній індекс, а потім викликає `__getitem__()` з `n-1, n-2, …, 0`. Цей клас не підтримує від'ємних індексів, тож `squares[-1]` генерує `IndexError`. Їхню підтримку (і зрізи) пропущено, щоб приклад лишався зосередженим на головному.

### Вправа 4

```python
def is_iterable(obj):
    try:
        iter(obj)
    except TypeError:
        return False
    return True


def flatten(items):
    result = []
    for item in items:
        if is_iterable(item) and not isinstance(item, (str, bytes)):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result


print(flatten([1, [2, (3, 4)], "ab", [[5]], {6}]))
print(flatten([]))
print(flatten(["x", ["y", ["z"]]]))
```

Результат:

```text
[1, 2, 3, 4, 'ab', 5, 6]
[]
['x', 'y', 'z']
```

Без перевірки на `str` рядок `"ab"` розпався б на `"a"` і `"b"`, а потім кожен односимвольний рядок перебирався б знову, видаючи сам себе, доки Python не згенерував би `RecursionError`.

---

*Джерело: [pythontutorial.net — Python iter()](https://www.pythontutorial.net/advanced-python/python-iter/). Адаптовано й доповнено для PyJourney.*
