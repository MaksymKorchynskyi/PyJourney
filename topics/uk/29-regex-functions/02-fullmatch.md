# fullmatch()

`re.fullmatch()` відповідає на запитання «так чи ні»: чи збігається з шаблоном **весь** рядок? Тому це природний інструмент для перевірки введених даних — поштових індексів, імен користувачів, часу чи адрес електронної пошти, — де часткового збігу недостатньо.

## Що ви дізнаєтесь

- Сигнатуру `re.fullmatch()` і те, що вона повертає
- Як написати простий валідатор і функцію-валідатор, що генерує `ValueError`
- Чим `fullmatch()` відрізняється від `match()` та `search()`
- Чому `^...$` — не повноцінна заміна `fullmatch()`
- Як поводиться альтернація, коли збігтися має весь рядок
- Як перевірити лише частину рядка за допомогою `Pattern.fullmatch(string, pos, endpos)`

## Сигнатура

```python
re.fullmatch(pattern, string, flags=0)
```

- `pattern` — регулярний вираз (сирий рядок або скомпільований `Pattern`).
- `string` — текст, який перевіряємо.
- `flags` — необов'язковий параметр, за замовчуванням `0` (без прапорців). Приймає один прапорець або кілька, об'єднаних через `|`.

Функція повертає об'єкт `Match`, якщо шаблон збігається з рядком **від першого до останнього символу**. Інакше вона повертає `None`.

```python
import re

print(re.fullmatch(r"\d{4}", "2024"))
print(re.fullmatch(r"\d{4}", "2024a"))
print(re.fullmatch(r"\d{4}", "12024"))
```

Результат:

```text
<re.Match object; span=(0, 4), match='2024'>
None
None
```

І `"2024a"`, і `"12024"` *містять* чотири цифри, але жоден із цих рядків *не є* чотирма цифрами, тому `fullmatch()` відхиляє обидва.

Об'єкт `Match` завжди істинний, а `None` хибне, тож результат можна одразу підставляти в `if`. Запис `is not None` робить намір явним; обидва стилі поширені.

## Перевірка адреси електронної пошти

Наступний приклад перевіряє, чи схожий рядок на адресу електронної пошти:

```python
import re

email = "no-reply@pythontutorial.net"
pattern = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
match = re.fullmatch(pattern, email)

if match is not None:
    print(f'The email "{match.group()}" is valid')
else:
    print(f'The email "{email}" is not valid')
```

Результат:

```text
The email "no-reply@pythontutorial.net" is valid
```

З чого складається шаблон:

| Частина | Значення |
|---|---|
| `[A-Za-z0-9._%+-]+` | локальна частина: літери, цифри та `. _ % + -`, щонайменше один символ |
| `@` | символ «равлик» |
| `[A-Za-z0-9.-]+` | доменне ім'я: літери, цифри, крапки й дефіси |
| `\.` | буквальна крапка (екранована, бо сама `.` означає «будь-який символ») |
| `[A-Za-z]{2,}` | домен верхнього рівня: щонайменше дві літери |

> **Зверніть увагу:** цей шаблон — практичне спрощення. Офіційна граматика адрес (RFC 5322) значно ширша й складніша. У реальних формах реєстрації достатньо простої перевірки на кшталт цієї, а потім адресу підтверджують листом.

### Помилка, яку варто знати: `|` усередині символьного класу

Багато посібників, зокрема й оригінальне джерело цього уроку, записують останню частину як `[A-Z|a-z]{2,}`. Усередині квадратних дужок `|` — **не** альтернація. Це звичайний символ вертикальної риски, який стає частиною набору. Через це шаблон приймає безглуздий домен:

```python
import re

buggy = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}"
fixed = r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"

print(re.fullmatch(buggy, "user@example.c|m"))
print(re.fullmatch(fixed, "user@example.c|m"))
```

Результат:

```text
<re.Match object; span=(0, 16), match='user@example.c|m'>
None
```

Усередині набору діапазони просто пишуть поруч: `[A-Za-z]`.

### Функція-валідатор

Логіку перевірки зазвичай виносять у функцію. Найгнучкіша форма — предикат, що повертає `bool`:

```python
import re

EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def is_email(s: str) -> bool:
    return EMAIL_PATTERN.fullmatch(s) is not None


print(is_email("no-reply@pythontutorial.net"))
print(is_email("no-reply@pythontutorial"))
```

Результат:

```text
True
False
```

Інколи некоректні дані мають перервати звичайний хід програми. Тоді функція генерує `ValueError`, а викликач вирішує, що з цим робити:

```python
import re

EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def validate_email(s: str) -> str:
    if EMAIL_PATTERN.fullmatch(s) is None:
        raise ValueError(f"{s!r} is not a valid email address")
    return s


if __name__ == "__main__":
    for candidate in ["no-reply@pythontutorial.net", "no-reply@pythontutorial"]:
        try:
            print("Valid:", validate_email(candidate))
        except ValueError as e:
            print("Error:", e)
```

Результат:

```text
Valid: no-reply@pythontutorial.net
Error: 'no-reply@pythontutorial' is not a valid email address
```

Шаблон компілюється один раз на рівні модуля, і кожен виклик використовує його повторно. Повернення перевіреного значення (а не `True`) дозволяє викликачеві писати `address = validate_email(raw)`.

## `fullmatch()`, `match()` і `search()`

Усі три функції повертають об'єкт `Match` або `None`. Різниця в тому, **де** збіг може починатися й закінчуватися:

| Функція | Збіг має починатися | Збіг має закінчуватися | Типове застосування |
|---|---|---|---|
| `re.match()` | на початку рядка | будь-де | «Чи починається рядок із ...?» |
| `re.search()` | будь-де | будь-де | «Чи містить рядок ...?» |
| `re.fullmatch()` | на початку рядка | у кінці рядка | «Чи є рядок саме ...?» |

### `fullmatch()` проти `match()`

```python
import re

s = "Python 3"
pattern = r"Python"

match = re.fullmatch(pattern, s)
if match is not None:
    print("fullmatch:", match.group())

match = re.match(pattern, s)
if match is not None:
    print("match:", match.group())
```

Результат:

```text
match: Python
```

`match()` задоволена, бо рядок *починається* з `Python`. `fullmatch()` повертає `None`, бо після збігу лишається `" 3"`.

### `fullmatch()` проти `search()`

```python
import re

s = "Python 3"
pattern = r"\d"

match = re.fullmatch(pattern, s)
if match is not None:
    print("fullmatch:", match.group())

match = re.search(pattern, s)
if match is not None:
    print("search:", match.group())
```

Результат:

```text
search: 3
```

`search()` проглядає весь рядок і знаходить цифру `3` наприкінці. `fullmatch()` не спрацьовує, бо весь рядок `"Python 3"` не є однією цифрою.

## Чому б не написати просто `^...$`?

Доки в Python 3.4 не з'явилася `fullmatch()`, шаблон прив'язували вручну: `re.match(r"^\d+$", s)`. Це *майже* працює, але `$` має особливість: він збігається в кінці рядка **і ще безпосередньо перед завершальним символом нового рядка**:

```python
import re

user_input = "123\n"

print(re.match(r"^\d+$", user_input))
print(re.fullmatch(r"\d+", user_input))
```

Результат:

```text
<re.Match object; span=(0, 3), match='123'>
None
```

Варіант із `^...$` приймає `"123\n"`, і в коді перевірки це зазвичай помилка. `fullmatch()` справді вимагає, щоб збіг закінчувався на останньому символі. Еквівалентний шаблон із якорями — `\A(?:...)\Z`, де `\A` означає «початок рядка», а `\Z` — «самий кінець рядка». (Python 3.14 також приймає `\z` як синонім `\Z`.)

## Альтернація та `fullmatch()`

Рушій регулярних виразів пробує альтернативи зліва направо й бере першу, що спрацювала. З `match()` коротша альтернатива може «виграти» завчасно:

```python
import re

print(re.match(r"cat|category", "category"))
print(re.fullmatch(r"cat|category", "category"))
```

Результат:

```text
<re.Match object; span=(0, 3), match='cat'>
<re.Match object; span=(0, 8), match='category'>
```

`match()` зупиняється після `cat`, бо її не цікавить, що йде далі. `fullmatch()` бачить, що після `cat` лишаються незбіглі символи, повертається назад (backtracking) і пробує наступну альтернативу, `category`, яка покриває весь рядок.

Крім того, `fullmatch()` застосовується до альтернації **загалом**. З якорями, написаними вручну, `^cat|dog$` означає «`^cat` або `dog$`», і це поширена помилка. `re.fullmatch(r"cat|dog", s)` означає «рівно `cat` або рівно `dog`».

## Прапорці

Прапорці працюють так само, як і з будь-якою іншою функцією `re`:

```python
import re

print(re.fullmatch(r"[a-z]+", "Hello"))
print(re.fullmatch(r"[a-z]+", "Hello", flags=re.IGNORECASE))
```

Результат:

```text
None
<re.Match object; span=(0, 5), match='Hello'>
```

## Перевірка частини рядка: `Pattern.fullmatch()`

Метод `fullmatch()` скомпільованого шаблону приймає необов'язкові аргументи `pos` і `endpos`. Тоді шаблон має покрити рівно зріз `string[pos:endpos]`:

```python
import re

number = re.compile(r"\d+")
record = "ID: 12345;"

print(number.fullmatch(record))
print(number.fullmatch(record, 4, 9))
```

Результат:

```text
None
<re.Match object; span=(4, 9), match='12345'>
```

## Типові помилки

- **Перевіряти дані через `match()`.** `re.match(r"\d+", "123abc")` спрацьовує, бо перевіряється лише початок. Використовуйте `fullmatch()`.
- **Покладатися на `^...$`.** `$` збігається й перед завершальним символом нового рядка, тож `"123\n"` проходить перевірку. Використовуйте `fullmatch()` або `\A...\Z`.
- **Писати `|` усередині символьного класу.** `[A-Z|a-z]` збігається також із символом `|`. Пишіть `[A-Za-z]`.
- **Викликати `.group()` без перевірки на `None`.**

  ```python
  import re

  try:
      re.fullmatch(r"\d+", "abc").group()
  except AttributeError as e:
      print(e)
  ```

  Результат:

  ```text
  'NoneType' object has no attribute 'group'
  ```

- **Забувати, що `\w` і `\d` враховують Unicode.** `re.fullmatch(r"\w+", "Олег")` спрацьовує. Якщо поле має містити лише ASCII-літери й цифри, використовуйте явні набори на кшталт `[A-Za-z0-9_]` або передавайте `flags=re.ASCII`.

## Підсумок

- `re.fullmatch(pattern, string, flags=0)` повертає об'єкт `Match`, лише якщо шаблон збігається з усім рядком, інакше — `None`.
- Це правильний інструмент для перевірки даних: поштових індексів, імен користувачів, часу, кодів кольорів, ідентифікаторів.
- `match()` прив'язує лише початок, `search()` не прив'язує нічого, `fullmatch()` прив'язує обидва кінці.
- `^...$` не еквівалентний: `$` збігається й перед завершальним символом нового рядка.
- З `fullmatch()` рушій перебирає альтернативи, доки одна з них не покриє весь рядок.
- Усередині `[...]` символ `|` — звичайний символ, а не «або».
- `Pattern.fullmatch(string, pos, endpos)` перевіряє зріз рядка.

## Практика

### Вправа 1: Час у 24-годинному форматі

Напишіть `is_time(s)`, яка повертає `True` для коректного часу у форматі `HH:MM` (від `00:00` до `23:59`) і `False` в інших випадках. Перевірте її на `"09:30"`, `"23:59"`, `"24:00"`, `"7:05"`, `"12:60"` та `"12:30\n"`.

### Вправа 2: Правила для імені користувача

Ім'я користувача має містити від 3 до 16 символів, складатися лише з ASCII-літер, цифр і підкреслень та починатися з літери. Напишіть `is_username(s)` і перевірте її на `"max_99"`, `"9lives"`, `"ab"`, `"Олег"` та `"a" * 17`.

### Вправа 3: Шістнадцяткові кольори

Напишіть `is_hex_color(s)`, яка приймає CSS-кольори в короткій формі `#RGB` і довгій формі `#RRGGBB` із шістнадцятковими цифрами будь-якого регістру. `"#fff"`, `"#1A2b3C"` коректні. `"#ffff"`, `"fff"`, `"#12345g"` — ні.

### Вправа 4: Передбачте результати

Не запускаючи код, передбачте, яка з трьох функцій знайде збіг для кожного рядка. Потім запустіть код і перевірте себе.

```python
import re

pattern = r"\d+"
for s in ["2024", "2024 year", "year 2024", "year"]:
    results = [
        name
        for name, func in [("match", re.match), ("search", re.search), ("fullmatch", re.fullmatch)]
        if func(pattern, s)
    ]
    print(f"{s!r:12} {results}")
```

## Розв'язки

### Вправа 1

```python
import re

TIME = re.compile(r"([01]\d|2[0-3]):[0-5]\d")


def is_time(s):
    return TIME.fullmatch(s) is not None


for s in ["09:30", "23:59", "24:00", "7:05", "12:60", "12:30\n"]:
    print(repr(s), is_time(s))
```

Результат:

```text
'09:30' True
'23:59' True
'24:00' False
'7:05' False
'12:60' False
'12:30\n' False
```

Година — це або `0` чи `1` і будь-яка цифра (`00`–`19`), або `2` і цифра від `0` до `3` (`20`–`23`). Хвилини починаються з цифри від `0` до `5`. Завдяки `fullmatch()` завершальний символ нового рядка в останньому тесті відхиляється.

### Вправа 2

```python
import re

USERNAME = re.compile(r"[A-Za-z][A-Za-z0-9_]{2,15}")


def is_username(s):
    return USERNAME.fullmatch(s) is not None


for s in ["max_99", "9lives", "ab", "Олег", "a" * 17]:
    print(repr(s), is_username(s))
```

Результат:

```text
'max_99' True
'9lives' False
'ab' False
'Олег' False
'aaaaaaaaaaaaaaaaa' False
```

Одна початкова літера плюс ще від 2 до 15 символів дають загальну довжину від 3 до 16. Явні ASCII-набори відхиляють `"Олег"`, який `\w` прийняв би.

### Вправа 3

```python
import re

HEX_COLOR = re.compile(r"#(?:[0-9a-fA-F]{3}){1,2}")


def is_hex_color(s):
    return HEX_COLOR.fullmatch(s) is not None


for s in ["#fff", "#1A2b3C", "#ffff", "fff", "#12345g"]:
    print(repr(s), is_hex_color(s))
```

Результат:

```text
'#fff' True
'#1A2b3C' True
'#ffff' False
'fff' False
'#12345g' False
```

`(?:[0-9a-fA-F]{3}){1,2}` означає «три шістнадцяткові цифри, один або два рази», тобто рівно 3 або 6 цифр. Чотири цифри так не розбити, тому `"#ffff"` відхиляється.

### Вправа 4

```python
import re

pattern = r"\d+"
for s in ["2024", "2024 year", "year 2024", "year"]:
    results = [
        name
        for name, func in [("match", re.match), ("search", re.search), ("fullmatch", re.fullmatch)]
        if func(pattern, s)
    ]
    print(f"{s!r:12} {results}")
```

Результат:

```text
'2024'       ['match', 'search', 'fullmatch']
'2024 year'  ['match', 'search']
'year 2024'  ['search']
'year'       []
```

- `"2024"`: цифри становлять увесь рядок, тому спрацьовують усі три функції.
- `"2024 year"`: рядок починається з цифр (`match`, `search`), але після них є текст (`fullmatch` не спрацьовує).
- `"year 2024"`: цифри не на початку, тож їх знаходить лише `search`.
- `"year"`: цифр немає взагалі.

---

*Джерело: [pythontutorial.net — Python Regex fullmatch()](https://www.pythontutorial.net/python-regex/python-regex-fullmatch/). Адаптовано й доповнено для PyJourney.*
