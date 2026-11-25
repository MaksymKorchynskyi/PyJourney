# Ітератори

**Ітератор** (iterator) — це об'єкт, який видає значення по одному, на запит, і пам'ятає, де зупинився. На ітераторах тримаються кожен цикл `for`, кожне спискове включення (list comprehension) і функції на кшталт `sum()`, `zip()` та `list()`, тож розуміння ітераторів пояснює, як насправді працює перебір у Python.

## Що ви дізнаєтесь

- Що таке **протокол ітератора**: методи `__iter__()` і `__next__()`
- Як вбудована функція `next()` і виняток `StopIteration` працюють разом
- Що робить цикл `for` «під капотом»
- Як написати власний клас-ітератор
- Чому ітератор **вичерпується** після одного проходу і його не можна запустити заново
- Де ітератори трапляються в стандартній бібліотеці і як поводитися з нескінченними ітераторами

## Що таке ітератор?

Ітератор — це будь-який об'єкт, що реалізує два спеціальні методи. Разом їх називають **протоколом ітератора** (iterator protocol):

| Метод | Що він має робити |
|---|---|
| `__iter__()` | Повернути сам ітератор (`return self`). |
| `__next__()` | Повернути наступний елемент. Коли елементів більше немає, згенерувати `StopIteration`. |

Напряму ці методи викликають рідко. Вбудована функція `iter(obj)` викликає `obj.__iter__()`, а `next(it)` викликає `it.__next__()`.

Список сам не є ітератором, але його можна попросити видати ітератор:

```python
colors = ["red", "green", "blue"]

it = iter(colors)
print(next(it))
print(next(it))
print(next(it))

try:
    next(it)
except StopIteration:
    print("StopIteration: no items left")
```

Результат:

```text
red
green
blue
StopIteration: no items left
```

Ітератор зберігає власну позицію. Кожен виклик `next()` пересуває його на крок уперед, і повернутися назад неможливо.

Чому перебір влаштовано саме так?

- **Один інтерфейс для всього.** Списки, рядки, словники, файли, курсори бази даних і ваші власні класи можна перебирати циклом `for`, бо циклу потрібні лише `iter()` і `next()`.
- **Лінивість.** Ітератор обчислює значення лише тоді, коли його просять. Йому не треба тримати всі значення в пам'яті, і він може навіть описувати нескінченний потік.
- **Чіткий сигнал завершення.** `StopIteration` — не помилка у звичному розумінні. Так ітератор повідомляє «я закінчив», і цикли сприймають це як нормальне завершення.

### `next()` зі значенням за замовчуванням

`next()` приймає необов'язковий другий аргумент. Якщо ітератор вичерпано, `next()` повертає це значення замість того, щоб генерувати `StopIteration`:

```python
it = iter([1])
print(next(it, "empty"))
print(next(it, "empty"))
```

Результат:

```text
1
empty
```

Це зручно, коли потрібен «перший елемент, якщо він є», і не хочеться писати `try`/`except`.

## Що насправді робить цикл `for`

Цей цикл:

```python
for number in [10, 20, 30]:
    print(number)
```

приблизно еквівалентний такому коду:

```python
numbers = [10, 20, 30]

iterator = iter(numbers)            # 1. отримуємо ітератор
while True:
    try:
        number = next(iterator)     # 2. просимо наступний елемент
    except StopIteration:           # 3. ітератор вичерпано,
        break                       #    тож цикл тихо завершується
    print(number)                   # 4. виконуємо тіло циклу
```

Обидва варіанти виводять:

```text
10
20
30
```

Цикл `for` перехоплює `StopIteration` замість вас. Саме тому ви ніколи не бачите цього винятку, коли перебираєте список.

## Власний ітератор

**Квадрат числа** — це ціле число, помножене саме на себе: квадрат 3 дорівнює 9. Клас `Square` нижче — це ітератор, що видає квадрати чисел 1, 2, …, `length`:

```python
class Square:
    def __init__(self, length):
        self.length = length    # скільки квадратів видати
        self.current = 0        # останнє використане число

    def __iter__(self):
        return self

    def __next__(self):
        if self.current >= self.length:
            raise StopIteration

        self.current += 1
        return self.current ** 2
```

Як це працює:

- `__init__()` зберігає **стан** перебору. `length` визначає, скільки значень треба видати, а `current` пам'ятає останнє число, яке підносили до квадрата.
- `__iter__()` повертає `self`, тож об'єкт можна використати всюди, де очікується ітератор, зокрема в циклі `for`.
- `__next__()` спершу перевіряє, чи вже видано всі `length` значень. Якщо так, генерує `StopIteration`. Інакше збільшує `current` і повертає його квадрат.

Використаємо його в циклі `for`:

```python
square = Square(5)

for sq in square:
    print(sq)
```

Результат:

```text
1
4
9
16
25
```

Або керуємо ним вручну через `next()`:

```python
square = Square(2)
print(next(square))
print(next(square))
print(next(square, "no more squares"))
```

Результат:

```text
1
4
no more squares
```

Оскільки `Square` дотримується протоколу, з ним працюють усі інструменти, що споживають ітератори:

```python
print(sum(Square(4)))
print(max(Square(4)))
print(list(zip("abc", Square(3))))

first, second, third = Square(3)
print(first, second, third)
```

Результат:

```text
30
16
[('a', 1), ('b', 4), ('c', 9)]
1 4 9
```

## Вичерпаний ітератор не можна перезапустити

Коли ітератор віддав усі елементи, він **вичерпаний** (exhausted). Відтоді:

- кожен виклик `next()` знову генерує `StopIteration`;
- цикл `for` по ньому виконується **нуль разів**, без жодних повідомлень;
- функції на кшталт `list()` чи `sum()` бачать порожню послідовність.

Візьмемо клас `Square`, визначений вище:

```python
square = Square(3)

print(list(square))
print(list(square))

for sq in square:
    print("this line never runs")

try:
    next(square)
except StopIteration:
    print("square is exhausted")
```

Результат:

```text
[1, 4, 9]
[]
square is exhausted
```

У протоколі ітератора немає методу «перемотати» чи «скинути». Ітератор уміє рухатися лише вперед. Щоб пройти значення ще раз, створіть **новий** ітератор: знову `Square(3)` або знову `iter(colors)`.

> **Зверніть увагу:** список можна перебирати скільки завгодно разів, бо кожен цикл `for` викликає `iter()` для списку й отримує свіжий ітератор. Як надати таку поведінку власним класам, розглянуто в наступній темі, *Ітератор та ітерований об'єкт*.

## Ітератори в стандартній бібліотеці

Чимало вбудованих функцій повертають ітератори, а не списки. Вони обчислюють результати ліниво, і спожити їх можна лише один раз:

| Вбудована функція | Що видає |
|---|---|
| `map(func, iterable)` | `func(item)` для кожного елемента |
| `filter(func, iterable)` | елементи, для яких `func(item)` істинне |
| `zip(a, b, ...)` | кортежі з елементів, узятих паралельно |
| `enumerate(iterable)` | пари `(індекс, елемент)` |
| `reversed(sequence)` | елементи у зворотному порядку |
| `open(path)` | рядки файлу |

```python
doubled = map(lambda n: n * 2, [1, 2, 3])

print(type(doubled))
print(iter(doubled) is doubled)   # ітератор повертає сам себе
print(next(doubled))
print(list(doubled))
print(list(doubled))
```

Результат:

```text
<class 'map'>
True
2
[4, 6]
[]
```

Перший `next()` забрав `2`, `list()` зібрав решту, а другий `list()` не отримав нічого.

> **Зверніть увагу:** у Python 3 `reduce()` не є вбудованою функцією. Вона живе в модулі `functools`: `from functools import reduce`. Вона приймає будь-який ітерований об'єкт, зокрема ітератор.

## Нескінченні ітератори

Ніщо не змушує ітератор закінчуватися. Ітератор, який ніколи не генерує `StopIteration`, описує нескінченний потік, і це цілком нормально, якщо брати з нього стільки елементів, скільки потрібно. У модулі `itertools` є кілька готових таких ітераторів, наприклад `count()`:

```python
from itertools import count, islice

evens = count(start=0, step=2)    # 0, 2, 4, 6, ... без кінця

print(list(islice(evens, 5)))     # беремо лише перші п'ять
print(next(evens))                # ітератор пам'ятає свою позицію
```

Результат:

```text
[0, 2, 4, 6, 8]
10
```

`islice(iterator, n)` зупиняється після `n` елементів, тож її безпечно застосовувати до нескінченних ітераторів.

> **Порада:** ніколи не викликайте `list()`, `sum()`, `sorted()` чи `max()` для нескінченного ітератора. Вони намагаються прочитати *всі* елементи, тому програма зависає (а `list()` ще й поглинає пам'ять, доки вона не скінчиться).

## Чи це ітератор?

Абстрактний клас `collections.abc.Iterator` дає змогу перевірити, чи дотримується об'єкт протоколу. Він розпізнає будь-який клас, що визначає і `__iter__()`, і `__next__()`, навіть якщо клас від нього не успадковується (`Square` — клас, визначений раніше):

```python
from collections.abc import Iterator

print(isinstance([1, 2, 3], Iterator))
print(isinstance(iter([1, 2, 3]), Iterator))
print(isinstance(Square(3), Iterator))
```

Результат:

```text
False
True
True
```

Список не є ітератором: у нього немає `__next__()`. Виклик `next()` для списку завершується помилкою `TypeError: 'list' object is not an iterator`.

## Типові помилки

- **Повторно використовувати вичерпаний ітератор.** Другий прохід не генерує помилку, він просто нічого не бачить, тож таку ваду легко проґавити:

  ```python
  prices = map(int, ["120", "75", "300"])

  print(sum(prices))
  try:
      print(max(prices))
  except ValueError as error:
      print("ValueError:", error)
  ```

  Результат:

  ```text
  495
  ValueError: max() iterable argument is empty
  ```

  Якщо значення потрібні кілька разів, спершу збережіть їх у список: `prices = list(map(...))`.

- **Забути `__iter__()`.** Клас лише з `__next__()` не є ітератором, і цикл `for` відкидає його з помилкою `TypeError: '...' object is not iterable`. Завжди додавайте `def __iter__(self): return self`.

- **Повертати `None` замість генерування `StopIteration`.** Якщо `__next__()` просто доходить до кінця тіла, він без кінця повертає `None`, і цикл ніколи не зупиняється. Сигналізуйте про завершення через `raise StopIteration`.

- **Чекати від ітератора можливостей послідовності.** Ітератори не мають довжини й індексів: `len(map(...))` генерує `TypeError: object of type 'map' has no len()`, і `it[0]` теж не спрацює. Якщо це потрібно, перетворіть ітератор на список.

- **Змінювати список під час перебору.** Ітератор списку рухається за індексом, тож після видалення елементів решта зсувається, і деякі елементи пропускаються:

  ```python
  numbers = [1, 2, 2, 3]
  for n in numbers:
      if n == 2:
          numbers.remove(n)
  print(numbers)

  numbers = [1, 2, 2, 3]
  numbers = [n for n in numbers if n != 2]
  print(numbers)
  ```

  Результат:

  ```text
  [1, 2, 3]
  [1, 3]
  ```

  Натомість будуйте новий список (або перебирайте копію, `numbers[:]`).

## Підсумок

- Ітератор реалізує **протокол ітератора**: `__iter__()` повертає `self`, а `__next__()` повертає наступний елемент або генерує `StopIteration`.
- `iter(obj)` отримує ітератор з об'єкта, а `next(it)` просуває його вперед. `next(it, default)` наприкінці повертає `default` замість винятку.
- Цикл `for` один раз викликає `iter()`, потім раз у раз `next()` і тихо зупиняється на `StopIteration`.
- Ітератори ліниві: вони видають значення на вимогу і можуть бути навіть нескінченними.
- Ітератор можна спожити лише один раз. Вичерпаний ітератор таким і лишається. Щоб перебрати значення знову, створіть новий.
- `map()`, `filter()`, `zip()`, `enumerate()`, `reversed()` і файлові об'єкти повертають ітератори.

## Практика

### Вправа 1: Передбачте результат

Не запускаючи код, запишіть, що він виведе. Потім перевірте себе.

```python
it = iter([1, 2, 3, 4, 5])
print(next(it))

for x in it:
    if x == 3:
        break

print(list(it))
print(next(it, "done"))
```

### Вправа 2: Цикл `for` без `for`

Напишіть функцію `for_each(iterable, action)`, яка викликає `action(item)` для кожного елемента `iterable`. Не використовуйте ні інструкцію `for`, ні включення (comprehension): лише `iter()`, `next()` і `StopIteration`. Перевірте її викликами `for_each("abc", print)` і `for_each(Square(3), print)`.

### Вправа 3: Зворотний відлік

Напишіть клас-ітератор `Countdown`, щоб `Countdown(3)` видавав `3`, `2`, `1` і зупинявся. Покажіть, що `list(Countdown(3))` повертає `[3, 2, 1]`, а повторне перетворення того самого об'єкта `Countdown` на список дає `[]`.

### Вправа 4: Нескінченне коло

Напишіть клас-ітератор `Cycle`, який без кінця повторює елементи списку: `Cycle(["red", "green"])` видає `red, green, red, green, ...`. Якщо список порожній, ітератор має зупинитися одразу. За допомогою `itertools.islice` виведіть перші 5 елементів і покажіть, що `list(Cycle([]))` повертає `[]`.

## Розв'язки

### Вправа 1

Результат:

```text
1
[4, 5]
done
```

`next(it)` забирає `1`. Цикл `for` продовжує **той самий ітератор** з `2`: бере `2`, потім `3` і виходить через `break`. Тепер ітератор стоїть перед `4`, тому `list(it)` збирає `[4, 5]`. Після цього ітератор вичерпано, і `next(it, "done")` повертає значення за замовчуванням.

### Вправа 2

```python
class Square:
    def __init__(self, length):
        self.length = length
        self.current = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self.current >= self.length:
            raise StopIteration
        self.current += 1
        return self.current ** 2


def for_each(iterable, action):
    iterator = iter(iterable)
    while True:
        try:
            item = next(iterator)
        except StopIteration:
            return
        action(item)


for_each("abc", print)
for_each(Square(3), print)
```

Результат:

```text
a
b
c
1
4
9
```

Тримайте блок `try` якомога меншим: всередині має бути лише `next()`. Якби `action(item)` опинився всередині `try` і згенерував власний `StopIteration`, функція тихо завершилася б і приховала помилку.

### Вправа 3

```python
class Countdown:
    def __init__(self, start):
        self.current = start

    def __iter__(self):
        return self

    def __next__(self):
        if self.current <= 0:
            raise StopIteration
        value = self.current
        self.current -= 1
        return value


countdown = Countdown(3)
print(list(countdown))
print(list(countdown))
```

Результат:

```text
[3, 2, 1]
[]
```

### Вправа 4

```python
from itertools import islice


class Cycle:
    def __init__(self, items):
        self.items = list(items)
        self.index = 0

    def __iter__(self):
        return self

    def __next__(self):
        if not self.items:
            raise StopIteration
        item = self.items[self.index]
        self.index = (self.index + 1) % len(self.items)
        return item


print(list(islice(Cycle(["red", "green"]), 5)))
print(list(Cycle([])))
```

Результат:

```text
['red', 'green', 'red', 'green', 'red']
[]
```

Вираз `% len(self.items)` повертає індекс до `0` після останнього елемента. `list(items)` створює власну копію, тож подальші зміни списку викликача не впливають на коло. У стандартній бібліотеці така сама поведінка є в `itertools.cycle()`.

---

*Джерело: [pythontutorial.net — Python Iterators](https://www.pythontutorial.net/advanced-python/python-iterators/). Адаптовано й доповнено для PyJourney.*
