# Ітератор та ітерований об'єкт

**Ітерований об'єкт** (iterable) — це те, що можна перебирати: список, рядок, файл. **Ітератор** (iterator) — це об'єкт, який власне виконує перебір і пам'ятає поточну позицію. Слова звучать схоже, але якщо сплутати ролі, вийдуть класи, які можна перебрати лише один раз, і функції, що мовчки повертають порожній результат.

## Що ви дізнаєтесь

- Чим саме ітерований об'єкт відрізняється від ітератора
- Як список і його `list_iterator` розподіляють роботу
- Чому об'єкт, який сам собі ітератор, можна перебрати лише раз
- Як розділити клас на ітерований об'єкт і окремий клас-ітератор
- Коротший спосіб написати `__iter__()` і як перевірити обидві ролі через `collections.abc`
- Чому ця різниця важлива, коли функції треба пройти дані двічі

## Дві ролі

**Ітератор.** Об'єкт, що реалізує протокол ітератора:

- `__next__()` повертає наступний елемент або генерує `StopIteration`, коли елементів більше немає;
- `__iter__()` повертає сам ітератор.

Ітератор зберігає **стан** одного проходу. Віддавши все, він вичерпується і стає непридатним.

**Ітерований об'єкт.** Об'єкт, який можна передати в `iter()` або перебрати циклом `for`. Зазвичай він реалізує `__iter__()`, і цей метод щоразу повертає **новий** ітератор. (Python також приймає об'єкти старого зразка, що реалізують лише `__getitem__()` з цілими індексами. Цей запасний механізм розглянуто в наступній темі, *Функція iter()*.)

Зручний образ: ітерований об'єкт — це **книжка**, а ітератор — **закладка**. В одну книжку можна вкласти кілька закладок на різних сторінках, і якщо вийняти закладку, з книжкою нічого не станеться.

| | Ітерований об'єкт | Ітератор |
|---|---|---|
| Обов'язкові методи | `__iter__()` (або `__getitem__()`) | `__iter__()` **і** `__next__()` |
| `__iter__()` повертає | новий ітератор | `self` |
| Скільки разів можна перебрати | багато | один |
| Пам'ятає позицію | ні | так |
| Приклади | `list`, `str`, `dict`, `range` | `iter([1, 2])`, `map(...)`, `enumerate(...)`, файли |

Оскільки `__iter__()` ітератора повертає `self`, **кожен ітератор водночас є ітерованим об'єктом**. Ітератор можна поставити в цикл `for`. Навпаки це не працює: список ітерований, але ітератором не є.

## Список і його ітератор

Список — ітерований об'єкт: його метод `__iter__()` створює `list_iterator`.

```python
numbers = [1, 2, 3]

number_iterator = numbers.__iter__()
print(type(number_iterator))
```

Результат:

```text
<class 'list_iterator'>
```

У звичайному коді замість dunder-методу викликають вбудовану функцію `iter()`. Далі ітератор просувають за допомогою `next()`:

```python
numbers = [1, 2, 3]
number_iterator = iter(numbers)

print(next(number_iterator))
print(next(number_iterator))
print(next(number_iterator))

try:
    next(number_iterator)
except StopIteration:
    print("StopIteration: the iterator is exhausted")

print(numbers)  # сам список не змінився
```

Результат:

```text
1
2
3
StopIteration: the iterator is exhausted
[1, 2, 3]
```

**Список** створюється один раз. **Ітератор** створюється щоразу, коли треба пройти список, і кожен ітератор має власну позицію:

```python
numbers = [1, 2, 3]

first = iter(numbers)
second = iter(numbers)

print(next(first), next(first))
print(next(second))
print(first is second)
print(iter(first) is first)  # ітератор повертає сам себе
```

Результат:

```text
1 2
1
False
True
```

Саме завдяки цьому розділенню працюють вкладені цикли по тому самому списку. Зовнішній і внутрішній цикли отримують незалежні ітератори:

```python
letters = ["a", "b"]

for x in letters:
    for y in letters:
        print(x + y)
```

Результат:

```text
aa
ab
ba
bb
```

## Коли один об'єкт виконує обидві ролі

Клас `Colors` нижче — ітератор: його `__iter__()` повертає `self`, а `__next__()` повертає наступний колір. Оскільки в нього є `__iter__()`, він водночас і ітерований об'єкт.

```python
class Colors:
    def __init__(self):
        self.rgb = ["red", "green", "blue"]
        self._index = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self._index >= len(self.rgb):
            raise StopIteration

        # повертаємо наступний колір
        color = self.rgb[self._index]
        self._index += 1
        return color


colors = Colors()

for color in colors:
    print(color)
```

Результат:

```text
red
green
blue
```

Це спрацьовує один раз. Дані (`rgb`) і позиція (`_index`) живуть в одному об'єкті, тож після першого циклу позиція стоїть у кінці, і ніщо її не скидає:

```python
for color in colors:
    print("second loop:", color)   # ніколи не виконується

try:
    next(colors)
except StopIteration:
    print("colors is exhausted")
```

Результат:

```text
colors is exhausted
```

З вкладеними циклами ще цікавіше. Обидва цикли ділять одну позицію, тому внутрішній цикл «з'їдає» елементи, які мав отримати зовнішній:

```python
colors = Colors()

for a in colors:
    for b in colors:
        print(a, b)
```

Результат:

```text
red green
red blue
```

Щоб пройти кольори ще раз, довелося б створити цілком новий об'єкт `Colors` разом із даними. Для великої колекції це марнотратно, а для даних, що надходять із файлу чи мережі, може бути й неможливо.

## Відокремлюємо ітерований об'єкт від ітератора

Рішення — зробити так, як це робить `list`: тримати **дані** в одному класі, а **позицію** в іншому.

Спершу колекція. Вона лише зберігає дані:

```python
class Colors:
    def __init__(self):
        self.rgb = ["red", "green", "blue"]

    def __len__(self):
        return len(self.rgb)
```

Тепер ітератор. Він зберігає посилання на колекцію і власний індекс:

```python
class ColorIterator:
    def __init__(self, colors):
        self._colors = colors
        self._index = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self._index >= len(self._colors):
            raise StopIteration

        # повертаємо наступний колір
        color = self._colors.rgb[self._index]
        self._index += 1
        return color
```

Як це працює:

- `__init__()` отримує об'єкт `Colors`, який треба обійти, і починає з індексу `0`.
- `__iter__()` повертає сам ітератор, як вимагає протокол.
- `__next__()` повертає наступний колір з об'єкта `Colors` або наприкінці генерує `StopIteration`.

Ним уже можна користуватися, створюючи ітератор вручну:

```python
colors = Colors()
color_iterator = ColorIterator(colors)

for color in color_iterator:
    print(color)
```

Результат:

```text
red
green
blue
```

Щоб пройти кольори знову, треба створити новий `ColorIterator`. Це працює, але той, хто викликає код, мусить знати про існування `ColorIterator` і щоразу не забувати його створити. Останній крок автоматизує це: `Colors` отримує метод `__iter__()`, який під час кожного виклику повертає **свіжий** `ColorIterator`.

```python
class Colors:
    def __init__(self):
        self.rgb = ["red", "green", "blue"]

    def __len__(self):
        return len(self.rgb)

    def __iter__(self):
        return ColorIterator(self)
```

Тепер `Colors` поводиться як справжня колекція:

```python
colors = Colors()

for color in colors:
    print(color)

print(list(colors))   # другий прохід працює

for a in colors:      # і вкладені цикли теж
    for b in colors:
        if a < b:
            print(a, b)
```

Результат:

```text
red
green
blue
['red', 'green', 'blue']
green red
blue red
blue green
```

Кожен цикл `for` (і кожен виклик `list()`) викликає `iter(colors)`, а та викликає `colors.__iter__()` і отримує новенький ітератор, що починає з індексу `0`.

Оскільки `ColorIterator` існує лише для того, щоб обслуговувати `Colors`, його можна вкласти всередину класу. Це суто питання організації коду: допоміжний клас не засмічує простір імен модуля, а поведінка лишається тією самою.

```python
class Colors:
    def __init__(self):
        self.rgb = ["red", "green", "blue"]

    def __len__(self):
        return len(self.rgb)

    def __iter__(self):
        return self.ColorIterator(self)

    class ColorIterator:
        def __init__(self, colors):
            self._colors = colors
            self._index = 0

        def __iter__(self):
            return self

        def __next__(self):
            if self._index >= len(self._colors):
                raise StopIteration

            # повертаємо наступний колір
            color = self._colors.rgb[self._index]
            self._index += 1
            return color


colors = Colors()
print(list(colors))
print(list(colors))
print(type(iter(colors)).__qualname__)
```

Результат:

```text
['red', 'green', 'blue']
['red', 'green', 'blue']
Colors.ColorIterator
```

## Коротші способи написати `__iter__()`

Повноцінний клас-ітератор найкраще показує, як працює перебір, але в повсякденному коді є два скорочення.

Якщо дані вже лежать у вбудованій колекції, **делегуйте** роботу ітератору цієї колекції:

```python
class Colors:
    def __init__(self):
        self.rgb = ["red", "green", "blue"]

    def __iter__(self):
        return iter(self.rgb)   # новий list_iterator під час кожного виклику


colors = Colors()
print(list(colors), list(colors))
```

Результат:

```text
['red', 'green', 'blue'] ['red', 'green', 'blue']
```

Якщо потрібна власна логіка, напишіть `__iter__()` як **генератор** з `yield`. Тоді кожен виклик `__iter__()` створює новий об'єкт-генератор, тобто ітератор із власною позицією. Генератори докладно розглянуто в розділі *Генератори*.

```python
class Colors:
    def __init__(self):
        self.rgb = ["red", "green", "blue"]

    def __iter__(self):
        for color in self.rgb:
            yield color.upper()


colors = Colors()
print(list(colors), list(colors))
```

Результат:

```text
['RED', 'GREEN', 'BLUE'] ['RED', 'GREEN', 'BLUE']
```

## Перевірка ролей через `collections.abc`

Модуль `collections.abc` містить абстрактні класи `Iterable` та `Iterator`. `isinstance()` перевіряє, які методи має об'єкт, тож вашим класам не потрібно від них успадковуватися:

```python
from collections.abc import Iterable, Iterator

for obj in ([1, 2], iter([1, 2]), "abc", range(3), enumerate("ab"), {"a": 1}, 42):
    print(f"{type(obj).__name__:14} iterable={isinstance(obj, Iterable)!s:5} "
          f"iterator={isinstance(obj, Iterator)}")
```

Результат:

```text
list           iterable=True  iterator=False
list_iterator  iterable=True  iterator=True
str            iterable=True  iterator=False
range          iterable=True  iterator=False
enumerate      iterable=True  iterator=True
dict           iterable=True  iterator=False
int            iterable=False iterator=False
```

Зверніть увагу: `range` ітерований, але **не** є ітератором. Це лінива *послідовність*: той самий об'єкт `range` можна перебирати багато разів. А от `enumerate` — одноразовий ітератор.

> **Зверніть увагу:** `isinstance(obj, Iterable)` шукає лише `__iter__()`. Для об'єктів, ітерованих через старіший протокол `__getitem__()`, вона повертає `False`. Єдина цілком надійна перевірка — викликати `iter(obj)` і перехопити `TypeError`, як показано в наступній темі.

## Чому ця різниця важлива

Функція, якій треба пройти вхідні дані **двічі**, працює з ітерованими об'єктами, але ламається на ітераторах, і ламається мовчки:

```python
def percentages(values):
    total = sum(values)                              # перший прохід
    return [round(100 * v / total) for v in values]  # другий прохід


print(percentages([1, 1, 2]))
print(percentages(iter([1, 1, 2])))
```

Результат:

```text
[25, 25, 50]
[]
```

З ітератором `sum()` спожила всі значення, тож спискове включення нічого не знайшло. Надійна версія спершу робить власну копію:

```python
def percentages(values):
    values = list(values)   # працює з будь-яким ітерованим об'єктом, навіть з одноразовим ітератором
    total = sum(values)
    return [round(100 * v / total) for v in values]


print(percentages(iter([1, 1, 2])))
print(percentages(n for n in (3, 1)))
```

Результат:

```text
[25, 25, 50]
[75, 25]
```

## Типові помилки

- **Робити колекцію власним ітератором.** Якщо `__iter__()` повертає `self`, а індекс зберігається в самій колекції, об'єкт можна перебрати лише раз, а вкладені цикли ламаються. Повертайте з `__iter__()` новий ітератор.

- **Щоразу повертати той самий ітератор.** Якщо створити ітератор один раз у `__init__()` і повертати його з `__iter__()`, проблема та сама: усі цикли ділять одну позицію.

- **Повертати список з `__iter__()`.** `__iter__()` має повертати саме *ітератор*, а не просто ітерований об'єкт:

  ```python
  class Team:
      def __init__(self):
          self.members = ["Ann", "Bob"]

      def __iter__(self):
          return self.members   # помилка: список не є ітератором


  try:
      for member in Team():
          print(member)
  except TypeError as error:
      print("TypeError:", error)
  ```

  Результат:

  ```text
  TypeError: iter() returned non-iterator of type 'list'
  ```

  Пишіть натомість `return iter(self.members)`.

- **Не додати `__iter__()` у клас-ітератор.** Цикл `for` по колекції ще працюватиме, але сам ітератор не можна буде використати там, де очікується ітерований об'єкт: `for x in iter(collection)` чи `zip(iter(collection))` завершаться помилкою `TypeError: '...' object is not iterable`.

- **Передавати ітератор у код, що перебирає дані двічі.** Генератори, `map()`, `filter()`, `zip()` і файлові об'єкти одноразові. Якщо потрібно кілька проходів, перетворіть їх на список через `list()`.

## Підсумок

- **Ітерований об'єкт** уміє створювати ітератори: його `__iter__()` щоразу повертає новий ітератор. Списки, рядки, словники, множини й `range` — ітеровані об'єкти.
- **Ітератор** видає значення: `__next__()` повертає наступний елемент, а `__iter__()` повертає `self`. Спожити його можна лише раз.
- Кожен ітератор — ітерований об'єкт, але більшість ітерованих об'єктів не є ітераторами.
- Колекцію, яка сама собі ітератор, можна перебрати лише один раз. Розділіть її на клас колекції та клас ітератора, а з `__iter__()` колекції повертайте новий ітератор.
- На практиці `__iter__()` часто просто повертає `iter(self.some_list)` або пишеться як генератор з `yield`.
- `collections.abc.Iterable` і `collections.abc.Iterator` дають змогу перевірити обидві ролі через `isinstance()`.

## Практика

### Вправа 1: Ітерований об'єкт чи ітератор?

Для кожного об'єкта визначте, чи це ітерований об'єкт, ітератор, чи ні те, ні інше. Потім перевірте відповіді за допомогою `collections.abc`.

`[1, 2]`, `iter([1, 2])`, `"hi"`, `range(3)`, `iter(range(3))`, `zip("ab", "cd")`, `{"a": 1}`, `{"a": 1}.items()`, `3.14`

### Вправа 2: Зробіть плейлист багаторазовим

Плейлист `Playlist` нижче можна відтворити лише один раз. Перепишіть його з окремим класом `PlaylistIterator`, щоб той самий плейлист можна було перебирати скільки завгодно разів, зокрема у вкладених циклах.

```python
class Playlist:
    def __init__(self, *songs):
        self.songs = list(songs)
        self.position = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self.position >= len(self.songs):
            raise StopIteration
        song = self.songs[self.position]
        self.position += 1
        return song


playlist = Playlist("Intro", "Verse", "Outro")
print(list(playlist))
print(list(playlist))
```

### Вправа 3: Статистика у два проходи

Напишіть функцію `above_average(values)`, яка повертає список значень, строго більших за середнє всіх значень. Вона має давати однаковий результат для списку, об'єкта `map` і генераторного виразу. Перевірте її на `[2, 4, 6, 8]`, `map(int, "2468")` і `(n * 2 for n in range(1, 5))`.

### Вправа 4: Власний range

Напишіть ітерований клас `MyRange(start, stop, step=1)` з окремим класом-ітератором. Він має підтримувати `len()`, бути багаторазовим і видавати незалежні ітератори. Потім поясніть різницю між цими рядками:

```python
r = MyRange(0, 6)
print(list(zip(r, r)))

it = iter(r)
print(list(zip(it, it)))
```

## Розв'язки

### Вправа 1

```python
from collections.abc import Iterable, Iterator

objects = [[1, 2], iter([1, 2]), "hi", range(3), iter(range(3)),
           zip("ab", "cd"), {"a": 1}, {"a": 1}.items(), 3.14]

for obj in objects:
    if isinstance(obj, Iterator):
        role = "iterator"
    elif isinstance(obj, Iterable):
        role = "iterable"
    else:
        role = "neither"
    print(f"{type(obj).__name__:15} {role}")
```

Результат:

```text
list            iterable
list_iterator   iterator
str             iterable
range           iterable
range_iterator  iterator
zip             iterator
dict            iterable
dict_items      iterable
float           neither
```

Тут «iterator» автоматично означає й «iterable». `dict.items()` повертає *представлення* (view): живий багаторазовий ітерований об'єкт, а не одноразовий ітератор.

### Вправа 2

```python
class PlaylistIterator:
    def __init__(self, playlist):
        self._playlist = playlist
        self._position = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self._position >= len(self._playlist.songs):
            raise StopIteration
        song = self._playlist.songs[self._position]
        self._position += 1
        return song


class Playlist:
    def __init__(self, *songs):
        self.songs = list(songs)

    def __iter__(self):
        return PlaylistIterator(self)


playlist = Playlist("Intro", "Verse", "Outro")
print(list(playlist))
print(list(playlist))

for first in playlist:
    for second in playlist:
        if first != second:
            print(first, "->", second)
```

Результат:

```text
['Intro', 'Verse', 'Outro']
['Intro', 'Verse', 'Outro']
Intro -> Verse
Intro -> Outro
Verse -> Intro
Verse -> Outro
Outro -> Intro
Outro -> Verse
```

Позиція переїхала з `Playlist` у `PlaylistIterator`, тож кожен цикл починає з початку.

### Вправа 3

```python
def above_average(values):
    values = list(values)  # один прохід, щоб зберегти, далі скільки завгодно проходів
    if not values:
        return []
    average = sum(values) / len(values)
    return [v for v in values if v > average]


print(above_average([2, 4, 6, 8]))
print(above_average(map(int, "2468")))
print(above_average(n * 2 for n in range(1, 5)))
print(above_average([]))
```

Результат:

```text
[6, 8]
[6, 8]
[6, 8]
[]
```

Без `list(values)` версії з `map` і генератором повернули б `[]`, а `len()` для них узагалі завершилася б помилкою `TypeError`.

### Вправа 4

```python
class MyRangeIterator:
    def __init__(self, start, stop, step):
        self._current = start
        self._stop = stop
        self._step = step

    def __iter__(self):
        return self

    def __next__(self):
        if self._current >= self._stop:
            raise StopIteration
        value = self._current
        self._current += self._step
        return value


class MyRange:
    def __init__(self, start, stop, step=1):
        if step <= 0:
            raise ValueError("step must be positive")
        self.start, self.stop, self.step = start, stop, step

    def __len__(self):
        return max(0, (self.stop - self.start + self.step - 1) // self.step)

    def __iter__(self):
        return MyRangeIterator(self.start, self.stop, self.step)


r = MyRange(0, 6)
print(len(r), list(r), list(r))
print(len(MyRange(1, 10, 3)), list(MyRange(1, 10, 3)))
print(len(MyRange(5, 1)), list(MyRange(5, 1)))

print(list(zip(r, r)))

it = iter(r)
print(list(zip(it, it)))
```

Результат:

```text
6 [0, 1, 2, 3, 4, 5] [0, 1, 2, 3, 4, 5]
3 [1, 4, 7]
0 []
[(0, 0), (1, 1), (2, 2), (3, 3), (4, 4), (5, 5)]
[(0, 1), (2, 3), (4, 5)]
```

`zip(r, r)` двічі викликає `iter()` для ітерованого об'єкта й отримує **два незалежні** ітератори, тому обидва стовпці синхронно йдуть 0, 1, 2, … А `zip(it, it)` двічі отримує **той самий** ітератор (`iter(it)` повертає сам `it`), тож кожен кортеж бере два послідовні значення з однієї спільної позиції. Це відомий прийом, щоб групувати елементи парами. Щоб приклад лишався коротким, цей `MyRange` підтримує лише додатний крок.

---

*Джерело: [pythontutorial.net — Python Iterator vs Iterable](https://www.pythontutorial.net/advanced-python/python-iterator-vs-iterable/). Адаптовано й доповнено для PyJourney.*
