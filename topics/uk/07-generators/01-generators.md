# Генератори

**Генераторна функція** (generator function) виглядає як звичайна функція, але замість того, щоб обчислити результат і один раз його повернути, вона за допомогою `yield` видає значення по одному, призупиняючись між ними. Виклик такої функції дає **генератор** (generator) — готовий ітератор. Генератори — найкоротший і найпоширеніший спосіб писати ітератори в Python. Вони дають змогу обробляти великі чи нескінченні потоки даних, не завантажуючи все в пам'ять.

## Що ви дізнаєтесь

- Як звичайні функції виконуються до кінця і як `yield` дозволяє функції призупинитися та продовжити роботу
- Чим генераторна функція відрізняється від об'єкта-генератора
- Чому генератор є ітератором і що відбувається, коли він вичерпаний
- Як замінити цілий клас-ітератор кількома рядками генераторного коду
- Як поводяться `return` і `StopIteration` всередині генераторів
- Як будувати нескінченні генератори, конвеєри генераторів і делегувати роботу через `yield from`

## Звичайні функції виконуються до кінця

Звичайна функція працює за моделлю **виконання до завершення** (run-to-completion). Після виклику вона виконується згори донизу (або до `return`), і лише тоді керування повертається до викликача:

```python
def greeting():
    print("Hi!")
    print("How are you?")
    print("Are you there?")


greeting()
```

Результат:

```text
Hi!
How are you?
Are you there?
```

Таку функцію неможливо зупинити після першого `print()`, виконати якийсь інший код, а потім продовжити з другого `print()`. Коли функція повертає керування, її локальні змінні зникають, і наступний виклик починає все спочатку.

## Інструкція `yield`

Щоб призупинити функцію посередині, а згодом продовжити її з того самого місця, використовують `yield`. Функція, тіло якої містить хоча б один `yield`, — це **генераторна функція**:

```python
def greeting():
    print("Hi!")
    yield 1
    print("How are you?")
    yield 2
    print("Are you there?")
    yield 3
```

Виклик генераторної функції **не** виконує її тіло. Він лише створює й повертає **об'єкт-генератор** (зазвичай його називають просто *генератором*):

```python
messenger = greeting()
print(type(messenger))
print("greeting() has not printed anything yet")
```

Результат:

```text
<class 'generator'>
greeting() has not printed anything yet
```

Тіло починає виконуватися, коли ви просите в генератора значення через `next()`. Воно працює до першого `yield`, віддає значення, записане після `yield`, і **призупиняється** там:

```python
result = next(messenger)
print(result)
```

Результат:

```text
Hi!
1
```

Наступний виклик `next()` відновлює функцію одразу після того `yield`, де вона зупинилася, з усіма локальними змінними, і виконує її до наступного `yield`:

```python
result = next(messenger)
print(result)

result = next(messenger)
print(result)
```

Результат:

```text
How are you?
2
Are you there?
3
```

Після третього `yield` нічого не лишилося. Наступний виклик відновлює функцію, вона доходить до кінця тіла, і генератор генерує `StopIteration`, як і належить вичерпаному ітератору:

```python
try:
    next(messenger)
except StopIteration:
    print("StopIteration: the generator is exhausted")
```

Результат:

```text
StopIteration: the generator is exhausted
```

### `yield` проти `return`

| | `return value` | `yield value` |
|---|---|---|
| Передає значення викликачу | так, один раз | так, один раз на кожен `yield` |
| Що відбувається з функцією | завершується, локальні змінні зникають | призупиняється, локальні змінні й позиція зберігаються |
| Що робить наступний виклик | запускає функцію з початку | продовжує одразу після `yield` |

Генератор пам'ятає весь свій стан виконання між викликами: локальні змінні, поточний рядок, навіть позицію всередині циклу. Саме цей «стан» доводилося вручну зберігати в атрибутах, коли ви писали клас-ітератор.

> **Зверніть увагу:** словом «генератор» називають дві речі. *Генераторна функція* — це `def` з `yield`. *Генератор* (об'єкт-генератор) — це те, що повертає її виклик. `greeting` — функція, `greeting()` — генератор.

## Генератори — це ітератори

Об'єкт-генератор автоматично реалізує протокол ітератора: у нього є `__next__()`, а його `__iter__()` повертає сам генератор. Тож усе, що ви знаєте про ітератори, стосується й генераторів:

```python
def countdown(n):
    while n > 0:
        yield n
        n -= 1


gen = countdown(3)
print(iter(gen) is gen)

for value in gen:
    print(value)

print(list(gen))           # уже вичерпаний
print(list(countdown(3)))  # новий виклик створює новий генератор
```

Результат:

```text
True
3
2
1
[]
[3, 2, 1]
```

- Цикл `for` керує генератором через `next()` і тихо зупиняється на `StopIteration`.
- Генератор можна спожити **один раз**. Щоб пройти значення знову, викличте генераторну функцію ще раз.
- Кожен виклик створює незалежний генератор із власними локальними змінними, тож кілька генераторів з однієї функції ніколи не заважають один одному.

## Від класу-ітератора до генераторної функції

Ось клас-ітератор, що видає квадрати цілих чисел від `0` до `length - 1`:

```python
class Squares:
    def __init__(self, length):
        self.length = length
        self.current = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self.current >= self.length:
            raise StopIteration

        result = self.current ** 2
        self.current += 1
        return result


for s in Squares(5):
    print(s)
```

Результат:

```text
0
1
4
9
16
```

Він працює, але більша частина коду — шаблонна обв'язка: `__iter__()`, стан в атрибутах, ручний `StopIteration`. Той самий ітератор у вигляді генераторної функції:

```python
def squares(length):
    for n in range(length):
        yield n ** 2


for s in squares(5):
    print(s)
```

Результат:

```text
0
1
4
9
16
```

Python бере на себе все, що клас робив уручну:

| Клас-ітератор | Генераторна функція |
|---|---|
| `__iter__()`, що повертає `self` | надається автоматично |
| `__next__()` | кожен `next()` виконує код до наступного `yield` |
| стан у `self.current` | звичайна локальна змінна `n` |
| `raise StopIteration` | відбувається, коли функція завершується |

> **Порада:** коли клас має бути **багаторазовим** (ітерованим об'єктом, а не ітератором), напишіть його метод `__iter__()` як генератор. Тоді кожен цикл отримує свіжий генератор, як показано в темі *Ітератор та ітерований об'єкт*.

## Лінивість: значення обчислюються на вимогу

Генератор обчислює кожне значення лише тоді, коли його просять. Видно, як виробник і споживач працюють по черзі:

```python
def produce(n):
    for i in range(n):
        print(f"  producing {i}")
        yield i


for value in produce(3):
    print(f"consuming {value}")
```

Результат:

```text
  producing 0
consuming 0
  producing 1
consuming 1
  producing 2
consuming 2
```

Тому генератори й споживають дуже мало пам'яті. Список із мільйона чисел зберігає їх усі, а генератор зберігає лише свій поточний стан:

```python
import sys

numbers_list = [n * 2 for n in range(1_000_000)]


def doubled(limit):
    for n in range(limit):
        yield n * 2


numbers_gen = doubled(1_000_000)

print(sys.getsizeof(numbers_list))
print(sys.getsizeof(numbers_gen))
print(sum(numbers_list) == sum(numbers_gen))
```

Результат (Python 3.14, 64-біт; точні розміри залежать від версії Python):

```text
8448728
208
True
```

Розмір генератора однаковий незалежно від того, чи він видасть десять значень, чи десять мільярдів. А список насправді ще більший, ніж показує число: `getsizeof()` враховує лише внутрішній масив посилань списку, але не самі об'єкти-числа, що в ньому зберігаються.

## Нескінченні генератори

Генератор не зобов'язаний закінчуватися. Цикл `while True` з `yield` всередині описує нескінченну послідовність, а споживач вирішує, скільки значень узяти:

```python
from itertools import islice


def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b


print(list(islice(fibonacci(), 10)))

below_100 = []
for number in fibonacci():
    if number >= 100:
        break
    below_100.append(number)
print(below_100)
```

Результат:

```text
[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
[0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
```

Нескінченний цикл нешкідливий, бо генератор призупиняється на кожному `yield`. Просто ніколи не передавайте такий генератор у `list()`, `sum()` чи `sorted()`.

## Конвеєри генераторів

Генератори добре поєднуються: один генератор може споживати інший. Кожен етап обробляє один елемент і передає його далі, тож увесь ланцюжок працює з одним елементом за раз, хоч якими довгими були б вхідні дані:

```python
log_lines = [
    "INFO user logged in",
    "ERROR disk full",
    "INFO file saved",
    "ERROR network down",
]


def errors(lines):
    for line in lines:
        if line.startswith("ERROR"):
            yield line


def messages(lines):
    for line in lines:
        yield line.split(" ", 1)[1]


for message in messages(errors(log_lines)):
    print(message)
```

Результат:

```text
disk full
network down
```

Зі справжнім журналом замість `log_lines` можна передати відкритий файловий об'єкт: файли — це ітератори по рядках, тож конвеєр читатиме файл рядок за рядком і ніколи не завантажить його цілком.

## Делегування через `yield from`

`yield from iterable` по черзі видає кожен елемент іншого ітерованого об'єкта. Він замінює цикл `for`, єдине завдання якого — повторно видати елементи:

```python
def chain(*iterables):
    for iterable in iterables:
        yield from iterable   # те саме, що: for item in iterable: yield item


print(list(chain([1, 2], "ab", range(3))))
```

Результат:

```text
[1, 2, 'a', 'b', 0, 1, 2]
```

`yield from` особливо зручний у рекурсивних генераторах, де генератор делегує роботу виклику самого себе (див. вправу 4).

## `return` і `StopIteration` всередині генератора

Генератор завершується, коли закінчується його тіло: виконання доходить до останнього рядка або до `return`. Значення, передане в `return`, не потрапляє до виданих елементів. Воно зберігається в атрибуті `value` винятку `StopIteration`, а цикл `for` його ігнорує:

```python
def first_words(text, limit):
    for count, word in enumerate(text.split()):
        if count == limit:
            return "limit reached"
        yield word


gen = first_words("one two three four", 2)
print(next(gen))
print(next(gen))
try:
    next(gen)
except StopIteration as stop:
    print("StopIteration.value:", stop.value)

print(list(first_words("one two three four", 2)))
```

Результат:

```text
one
two
StopIteration.value: limit reached
['one', 'two']
```

**Не** завершуйте генератор через `raise StopIteration`. Починаючи з Python 3.7 (PEP 479), `StopIteration`, що вилітає з тіла генератора, перетворюється на `RuntimeError`, бо такий виняток майже завжди є помилкою, яка інакше непомітно обірвала б перебір:

```python
def broken():
    yield 1
    raise StopIteration   # помилка: використовуйте return


try:
    print(list(broken()))
except RuntimeError as error:
    print("RuntimeError:", error)
```

Результат:

```text
RuntimeError: generator raised StopIteration
```

## Стани генератора

Модуль `inspect` може показати, на якому етапі життєвого циклу перебуває генератор:

```python
import inspect


def two_steps():
    yield "first"
    yield "second"


gen = two_steps()
print(inspect.getgeneratorstate(gen))
next(gen)
print(inspect.getgeneratorstate(gen))
gen.close()   # достроково завершуємо генератор
print(inspect.getgeneratorstate(gen))
print(next(gen, "nothing left"))
```

Результат:

```text
GEN_CREATED
GEN_SUSPENDED
GEN_CLOSED
nothing left
```

- `GEN_CREATED`: створений, тіло ще не почало виконуватися.
- `GEN_SUSPENDED`: призупинений на `yield`.
- `GEN_RUNNING`: виконується саме зараз (це видно лише зсередини генератора).
- `GEN_CLOSED`: завершений — вичерпаний або закритий через `close()`.

> **Зверніть увагу:** генератори мають також методи `send()` і `throw()`, які передають *всередину* призупиненого генератора значення або виняток. Вони перетворюють генератори на прості співпрограми (coroutines) і історично лежать в основі `asyncio`. Для звичайного перебору достатньо `next()` і `for`.

## Типові помилки

- **Чекати, що тіло виконається під час виклику функції.** Функція, де будь-де є `yield`, — генераторна, тож її виклик нічого видимого не робить, доки хтось не почне перебір:

  ```python
  def save_all(items):
      for item in items:
          print("saving", item)
          yield item


  save_all(["a", "b"])          # створює генератор, нічого не зберігає
  print("after the call")
  for _ in save_all(["a", "b"]):
      pass
  ```

  Результат:

  ```text
  after the call
  saving a
  saving b
  ```

- **Перебирати вичерпаний генератор.** Другий цикл по тому самому генератору нічого не побачить. Викличте генераторну функцію ще раз або збережіть значення в список.

- **Поводитися з генератором як зі списком.** `len(gen)` генерує `TypeError: object of type 'generator' has no len()`, а `gen[0]` — `TypeError: 'generator' object is not subscriptable`. Якщо ці операції справді потрібні, використайте `list(gen)`.

- **Генерувати `StopIteration`, щоб завершити генератор.** Він перетвориться на `RuntimeError`. Використовуйте `return`.

- **Викликати `next()` без захисту всередині генератора.** Якщо внутрішній ітератор порожній, його `StopIteration` вилітає з тіла генератора й так само перетворюється на `RuntimeError`. Використовуйте `next(it, default)` або перехоплюйте `StopIteration` і робіть `return`.

- **Чекати, що `return value` видасть елемент.** Повернене значення чіпляється до `StopIteration`, і `for`, `list()` та подібні його ігнорують. Кожне значення, яке має побачити споживач, видавайте через `yield`.

## Підсумок

- Функція з `yield` — це **генераторна функція**. Її виклик повертає **об'єкт-генератор**, не виконуючи тіла.
- `next()` виконує тіло до наступного `yield`, повертає видане значення і призупиняється. Локальні змінні й позиція зберігаються між викликами.
- Генератори — це ітератори: вони працюють у циклах `for` і з `next()` та вичерпуються після одного проходу. Для нового генератора викличте функцію знову.
- Генераторна функція замінює цілий клас-ітератор: без `__iter__()`, без `__next__()`, без ручного `StopIteration`.
- Генератори ліниві, споживають сталий обсяг пам'яті, можуть бути нескінченними і з'єднуються в конвеєри.
- `yield from iterable` повторно видає всі елементи іншого ітерованого об'єкта.
- Завершуйте генератор через `return`, а не через `raise StopIteration` (з Python 3.7 це перетворюється на `RuntimeError`).

## Практика

### Вправа 1: Передбачте результат

Не запускаючи код, запишіть точний результат. Зверніть увагу на порядок рядків.

```python
def numbers():
    print("start")
    yield 1
    print("middle")
    yield 2
    print("end")


gen = numbers()
print("created")
for n in gen:
    print("got", n)
print("done")
```

### Вправа 2: Частини

Напишіть генераторну функцію `chunked(iterable, size)`, яка видає списки з `size` послідовних елементів. Останній список може бути коротшим. Наприклад, `chunked(range(7), 3)` видає `[0, 1, 2]`, `[3, 4, 5]`, `[6]`. Функція має працювати з будь-яким ітерованим об'єктом, зокрема з іншим генератором, і не повинна видавати порожній список наприкінці.

### Вправа 3: Конвеєр даних

Є такі рядки CSV-тексту:

```python
rows = ["name,score", "Ann,91", "Bob,58", "Cid,77", "Dan,49"]
```

Напишіть три невеликі генератори та з'єднайте їх у ланцюжок:

- `parse(lines)`: пропускає заголовок і видає кортежі `(name, score)`, де `score` має тип `int`;
- `passed(records, threshold)`: видає лише записи з `score >= threshold`;
- `names(records)`: видає тільки імена.

Виведіть імена всіх, хто набрав щонайменше 60 балів.

### Вправа 4: Рекурсивне сплощення з `yield from`

Напишіть генератор `flatten(items)`, який видає всі значення, що не є списками, з довільно вкладених списків, зліва направо. `list(flatten([1, [2, [3, [4]], 5], [], [[6]]]))` має повертати `[1, 2, 3, 4, 5, 6]`. Використайте рекурсію і `yield from`.

## Розв'язки

### Вправа 1

Результат:

```text
created
start
got 1
middle
got 2
end
done
```

Створення генератора нічого не виводить. Перший `next()` (його робить цикл `for`) виконує тіло до `yield 1`, тому `start` з'являється перед `got 1`. Останній `next()` виконує код від `yield 2` до кінця тіла: виводиться `end`, потім `StopIteration` завершує цикл, і далі йде `done`.

### Вправа 2

```python
def chunked(iterable, size):
    chunk = []
    for item in iterable:
        chunk.append(item)
        if len(chunk) == size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


print(list(chunked(range(7), 3)))
print(list(chunked("abcd", 2)))
print(list(chunked([], 3)))

squares = (n * n for n in range(5))
for part in chunked(squares, 2):
    print(part)
```

Результат:

```text
[[0, 1, 2], [3, 4, 5], [6]]
[['a', 'b'], ['c', 'd']]
[]
[0, 1]
[4, 9]
[16]
```

`chunk = []` після кожного `yield` створює **новий** список. Якби замість цього був `chunk.clear()`, він спорожнив би список, який споживач щойно отримав. Починаючи з Python 3.12, у стандартній бібліотеці є `itertools.batched(iterable, n)`, яка робить те саме, але видає кортежі.

### Вправа 3

```python
rows = ["name,score", "Ann,91", "Bob,58", "Cid,77", "Dan,49"]


def parse(lines):
    lines = iter(lines)
    next(lines, None)              # пропускаємо заголовок (безпечно навіть для порожніх даних)
    for line in lines:
        name, score = line.split(",")
        yield name, int(score)


def passed(records, threshold):
    for name, score in records:
        if score >= threshold:
            yield name, score


def names(records):
    for name, _ in records:
        yield name


for name in names(passed(parse(rows), 60)):
    print(name)
```

Результат:

```text
Ann
Cid
```

`parse()` пропускає заголовок через `next(lines, None)`. Значення за замовчуванням тут важливе: якби вхідні дані були порожні, звичайний `next(lines)` випустив би `StopIteration` назовні, і той перетворився б на `RuntimeError`.

### Вправа 4

```python
def flatten(items):
    for item in items:
        if isinstance(item, list):
            yield from flatten(item)
        else:
            yield item


print(list(flatten([1, [2, [3, [4]], 5], [], [[6]]])))
print(list(flatten([])))
```

Результат:

```text
[1, 2, 3, 4, 5, 6]
[]
```

Для кожного вкладеного списку `yield from flatten(item)` створює підгенератор і передає всі його значення прямо споживачу. Без `yield from` довелося б писати `for value in flatten(item): yield value`.

---

*Джерело: [pythontutorial.net — Python Generators](https://www.pythontutorial.net/advanced-python/python-generators/). Адаптовано й доповнено для PyJourney.*
