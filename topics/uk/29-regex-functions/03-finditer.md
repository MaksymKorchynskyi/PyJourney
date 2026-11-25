# finditer()

`re.finditer()` знаходить усі збіги шаблону, так само як `findall()`, але замість списку рядків повертає **ітератор об'єктів `Match`**. Кожен `Match` знає не лише *що* збіглося, а й *де* саме і що захопила кожна група. Коли потрібні позиції, іменовані групи або обробка величезного тексту по одному збігу, `finditer()` — правильний вибір.

## Що ви дізнаєтесь

- Сигнатуру `re.finditer()` і те, що видає ітератор
- Як отримати з кожного об'єкта `Match` текст, позиції та групи
- Чому результат — лінивий одноразовий ітератор і що це означає на практиці
- Чим `finditer()` відрізняється від `findall()`, особливо з групами захоплення
- Як написати невеликий токенізатор з іменованими групами та `Match.lastgroup`
- Як шукати в частині рядка за допомогою `Pattern.finditer(string, pos, endpos)`

## Сигнатура

```python
re.finditer(pattern, string, flags=0)
```

- `pattern` — регулярний вираз (сирий рядок або скомпільований `Pattern`).
- `string` — текст, у якому шукаємо.
- `flags` — необов'язковий параметр, за замовчуванням `0`. Приймає один прапорець або кілька, об'єднаних через `|`.

Функція повертає **ітератор**. На кожному кроці ітерації він видає наступний збіг, що не перекривається з попередніми, у вигляді об'єкта `Match`, проходячи рядок зліва направо. Якщо збігів немає, ітератор просто порожній: `None` він не повертає ніколи, тож цикл `for` по ньому виконається нуль разів.

## Перший приклад: усі голосні

```python
import re

s = "Readability counts."
pattern = r"[aeiou]"

for match in re.finditer(pattern, s):
    print(match)
```

Результат:

```text
<re.Match object; span=(1, 2), match='e'>
<re.Match object; span=(2, 3), match='a'>
<re.Match object; span=(4, 5), match='a'>
<re.Match object; span=(6, 7), match='i'>
<re.Match object; span=(8, 9), match='i'>
<re.Match object; span=(13, 14), match='o'>
<re.Match object; span=(14, 15), match='u'>
```

Під час виведення об'єкт `Match` показує свій `span` — пару індексів `(start, end)` — і знайдений текст. Кінцевий індекс не включається, як і у зрізах: `s[1:2]` — це `'e'`.

## Що дає об'єкт `Match`

Справжня цінність `finditer()` — саме в об'єкті `Match`. Ось його члени, якими користуються найчастіше:

| Член | Повертає |
|---|---|
| `m.group()`, `m.group(0)` або `m[0]` | увесь знайдений текст |
| `m.group(n)` або `m[n]` | текст групи `n` (`None`, якщо вона не брала участі) |
| `m.group("name")` або `m["name"]` | текст іменованої групи |
| `m.groups()` | кортеж з усіма групами |
| `m.groupdict()` | словник усіх іменованих груп |
| `m.start()`, `m.end()`, `m.span()` | позиції всього збігу |
| `m.start(n)`, `m.end(n)`, `m.span(n)` | позиції групи `n` |

Практичний приклад: витягаємо дати у форматі ISO з журналу за допомогою іменованих груп і показуємо, де знайдено кожну дату:

```python
import re

log = "Deploy 2024-03-15 ok; rollback 2024-03-17; deploy 2024-04-01 ok"
pattern = r"(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})"

for m in re.finditer(pattern, log):
    print(m[0], "at", m.span(), "->", m.groupdict())
```

Результат:

```text
2024-03-15 at (7, 17) -> {'year': '2024', 'month': '03', 'day': '15'}
2024-03-17 at (31, 41) -> {'year': '2024', 'month': '03', 'day': '17'}
2024-04-01 at (50, 60) -> {'year': '2024', 'month': '04', 'day': '01'}
```

`findall()` із трьома групами дав би лише кортежі `('2024', '03', '15')`: без позицій і без назв груп.

## Лінивий одноразовий ітератор

`finditer()` не шукає по всьому рядку заздалегідь. Наступний збіг знаходиться лише тоді, коли цикл його запитує. Звідси три наслідки.

**1. Можна зупинитися раніше.** Якщо потрібні лише кілька перших збігів, вийдіть із циклу, і решта рядка навіть не проглядатиметься. Для одного першого збігу простіше взяти `re.search()`, але `next()` зі значенням за замовчуванням теж працює:

```python
import re

first = next(re.finditer(r"\d+", "no numbers"), None)
print(first)
```

Результат:

```text
None
```

**2. Його можна пройти лише один раз.** Після повного циклу ітератор вичерпано, і другий цикл нічого не виведе:

```python
import re

matches = re.finditer(r"\d+", "10 apples, 20 pears")

print([m[0] for m in matches])
print([m[0] for m in matches])
```

Результат:

```text
['10', '20']
[]
```

Якщо збіги потрібні кілька разів, збережіть їх у список: `matches = list(re.finditer(...))`.

**3. У нього немає довжини й зрозумілого виведення.** `len()` з ітератором не працює, а `print()` показує лише його тип і адресу:

```python
import re

matches = re.finditer(r"\d+", "10 apples, 20 pears")
print(matches)  # результат щоразу різний, напр. <callable_iterator object at 0x102f953c0>

try:
    print(len(matches))
except TypeError as e:
    print(e)
```

Результат (адреса змінюється від запуску до запуску):

```text
<callable_iterator object at 0x102f953c0>
object of type 'callable_iterator' has no len()
```

Щоб порахувати збіги, використовуйте `len(re.findall(...))` або `sum(1 for _ in re.finditer(...))`.

## `finditer()` чи `findall()`

Обидві функції знаходять усі збіги, що не перекриваються, зліва направо. Різниця в тому, що ви отримуєте:

| | `findall()` | `finditer()` |
|---|---|---|
| Повертає | `list` | ітератор |
| Кожен елемент | `str` або `tuple` рядків, якщо груп 2+ | завжди об'єкт `Match` |
| З однією групою | лише текст цієї групи | повний збіг **і** групу |
| Необов'язкова група без збігу | `''` | `None` |
| Позиції | ні | так |
| Пам'ять | усі результати одразу | по одному збігу |

Найважливіша відмінність — вплив груп. У `findall()` додавання групи змінює тип результату. У `finditer()` нічого не змінюється: ви завжди отримуєте повний `Match` і самі обираєте потрібні частини.

```python
import re

s = "width=800 height=600"
pattern = r"(\w+)=(\d+)"

print(re.findall(pattern, s))

for m in re.finditer(pattern, s):
    print(m[0], "|", m[1], "|", m[2], "|", m.span())
```

Результат:

```text
[('width', '800'), ('height', '600')]
width=800 | width | 800 | (0, 9)
height=600 | height | 600 | (10, 20)
```

**Просте правило:** беріть `findall()`, коли потрібен лише текст, і `finditer()`, коли потрібно ще щось.

## Використання позицій

Позиції дозволяють робити позначки в початковому тексті. Наприклад, можна підкреслити кожен збіг:

```python
import re

text = "Call 555-1234 or 555-9876 today"
markers = [" "] * len(text)

for m in re.finditer(r"\d{3}-\d{4}", text):
    for i in range(m.start(), m.end()):
        markers[i] = "^"

print(text)
print("".join(markers).rstrip())
```

Результат:

```text
Call 555-1234 or 555-9876 today
     ^^^^^^^^    ^^^^^^^^
```

## Приклад: маленький токенізатор

Класичне застосування `finditer()` — розбиття вихідного коду чи формули на **токени**. Кожен вид токена отримує іменовану групу, усі групи об'єднуються через `|`, а `m.lastgroup` підказує, яка з альтернатив збіглася:

```python
import re

TOKEN_SPEC = [
    ("NUMBER", r"\d+(?:\.\d+)?"),
    ("NAME", r"[A-Za-z_]\w*"),
    ("OP", r"[+\-*/=()]"),
    ("SKIP", r"\s+"),
    ("MISMATCH", r"."),
]
TOKEN_RE = re.compile("|".join(f"(?P<{name}>{regex})" for name, regex in TOKEN_SPEC))


def tokenize(code):
    for m in TOKEN_RE.finditer(code):
        kind = m.lastgroup
        if kind == "SKIP":
            continue
        if kind == "MISMATCH":
            raise SyntaxError(f"Unexpected {m[0]!r} at position {m.start()}")
        yield kind, m[0]


print(list(tokenize("price = 2.5 * (qty + 10)")))

try:
    list(tokenize("x = 3 $ 4"))
except SyntaxError as e:
    print(e)
```

Результат:

```text
[('NAME', 'price'), ('OP', '='), ('NUMBER', '2.5'), ('OP', '*'), ('OP', '('), ('NAME', 'qty'), ('OP', '+'), ('NUMBER', '10'), ('OP', ')')]
Unexpected '$' at position 6
```

Як це працює:

- Альтернативи перевіряються зліва направо, тож для цифр `NUMBER` спрацьовує раніше за `MISMATCH`, а `MISMATCH` (будь-який один символ) підхоплює все інше.
- `m.lastgroup` — назва останньої групи, що збіглася; тут це якраз вид токена.
- Оскільки `tokenize()` — генератор поверх лінивого ітератора, він може обробляти великі вхідні дані, не будуючи великих списків.

## Пошук у частині рядка: `Pattern.finditer()`

Скомпільований шаблон має власний метод `finditer()`, який приймає необов'язкові `pos` і `endpos`. Позиції в отриманих об'єктах `Match` усе одно рахуються від початку **всього** рядка:

```python
import re

word = re.compile(r"\w+")
text = "one two three four"

for m in word.finditer(text, 4, 13):
    print(m[0], m.span())
```

Результат:

```text
two (4, 7)
three (8, 13)
```

## Порожні збіги

Якщо шаблон може збігтися з порожнім рядком, `finditer()` видає й такі порожні збіги. Їхній `span` має однакові початок і кінець:

```python
import re

for m in re.finditer(r"\d*", "a1"):
    print(m.span(), repr(m[0]))
```

Результат:

```text
(0, 0) ''
(1, 2) '1'
(2, 2) ''
```

Якщо потрібен лише реальний вміст, використовуйте `+` замість `*`.

## Типові помилки

- **Двічі проходити той самий ітератор.** Другий цикл нічого не побачить. Якщо збіги потрібні знову, перетворіть ітератор на список.
- **Викликати `len()` або виводити ітератор.** Ітератор не має довжини й не показує свого вмісту. Використовуйте `list()` або рахуйте через `sum(1 for _ in ...)`.
- **Звертатися до групи, якої немає.** `m.group(1)` для шаблону без груп генерує `IndexError: no such group`.
- **Забувати, що групи без збігу — це `None`.** У `findall()` необов'язкова група, що не збіглася, дає `''`, а `m.group(n)` повертає `None`. Перевіряйте значення, перш ніж викликати на ньому методи рядків.
- **Використовувати `finditer()` лише для збирання рядків.** Для шаблону без груп `[m[0] for m in re.finditer(p, s)]` — те саме, що `re.findall(p, s)`. Обирайте простіший варіант.

## Підсумок

- `re.finditer(pattern, string, flags=0)` повертає лінивий ітератор об'єктів `Match` для всіх збігів, що не перекриваються.
- Якщо збігів немає, ітератор порожній; `None` не повертається ніколи.
- Кожен `Match` надає знайдений текст, усі групи (за номером чи назвою) та їхні позиції.
- На відміну від `findall()`, групи не змінюють того, що ви отримуєте: завжди повний `Match`.
- Ітератор можна пройти лише один раз, і `len()` для нього не працює.
- Іменовані групи разом із `m.lastgroup` перетворюють `finditer()` на простий токенізатор.
- `Pattern.finditer(string, pos, endpos)` шукає у зрізі, але позиції повідомляє відносно всього рядка.

## Практика

### Вправа 1: Числа та їхні позиції

Для рядка `"Order 66 shipped 3 boxes, 120 kg total"` виведіть кожне ціле число разом з його початковим і кінцевим індексами, по одному в рядку, наприклад `66 6 8`.

### Вправа 2: Слова з великої літери

Напишіть `capitalised(text)`, яка повертає список кортежів `(word, start)` для кожного слова, що починається з великої ASCII-літери. Перевірте її на `"Alice met Bob in Paris last May"`.

### Вправа 3: Записи у словники

Перетворіть рядок нижче на список словників `[{'user': 'ann', 'age': 31}, ...]`, де `age` має тип `int`. Використайте іменовані групи та `groupdict()`.

```python
data = "user=ann age=31; user=bob age=27; user=eve age=45"
```

### Вправа 4: Підсвічування без `sub()`

Напишіть `highlight(text, pattern)`, яка бере кожен збіг у квадратні дужки, використовуючи лише `finditer()`, позиції та зрізи (без `re.sub()`). Наприклад, `highlight("Call 555-1234 or 555-9876", r"\d{3}-\d{4}")` має повернути `"Call [555-1234] or [555-9876]"`.

## Розв'язки

### Вправа 1

```python
import re

text = "Order 66 shipped 3 boxes, 120 kg total"
for m in re.finditer(r"\d+", text):
    print(m[0], m.start(), m.end())
```

Результат:

```text
66 6 8
3 17 18
120 26 29
```

### Вправа 2

```python
import re


def capitalised(text):
    return [(m[0], m.start()) for m in re.finditer(r"\b[A-Z]\w*", text)]


print(capitalised("Alice met Bob in Paris last May"))
```

Результат:

```text
[('Alice', 0), ('Bob', 10), ('Paris', 17), ('May', 28)]
```

### Вправа 3

```python
import re

data = "user=ann age=31; user=bob age=27; user=eve age=45"
pattern = r"user=(?P<user>\w+) age=(?P<age>\d+)"

records = []
for m in re.finditer(pattern, data):
    record = m.groupdict()
    record["age"] = int(record["age"])
    records.append(record)

print(records)
```

Результат:

```text
[{'user': 'ann', 'age': 31}, {'user': 'bob', 'age': 27}, {'user': 'eve', 'age': 45}]
```

### Вправа 4

```python
import re


def highlight(text, pattern):
    parts = []
    last_end = 0
    for m in re.finditer(pattern, text):
        parts.append(text[last_end:m.start()])
        parts.append(f"[{m[0]}]")
        last_end = m.end()
    parts.append(text[last_end:])
    return "".join(parts)


print(highlight("Call 555-1234 or 555-9876", r"\d{3}-\d{4}"))
print(highlight("no phone numbers here", r"\d{3}-\d{4}"))
```

Результат:

```text
Call [555-1234] or [555-9876]
no phone numbers here
```

Функція без змін копіює текст між збігами й обгортає кожен збіг. По суті, так усередині працює `re.sub()`, а сам прийом корисний, коли заміна залежить від сусіднього тексту чи позицій.

---

*Джерело: [pythontutorial.net — Python Regex finditer()](https://www.pythontutorial.net/python-regex/python-regex-finditer/). Адаптовано й доповнено для PyJourney.*
