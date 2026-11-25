# patch()

Замінити функцію моком уручну (`module.func = Mock()`) можна, але тоді треба не забути повернути оригінал на місце, інакше мок «протече» в інші тести. `unittest.mock.patch()` робить обидва кроки за вас: **тимчасово** підміняє ціль моком і **завжди відновлює** оригінал після завершення, навіть якщо тест не пройшов.

## Що ви дізнаєтесь

- Як описати ціль для `patch()` і чому підміняти треба ім'я **там, де воно використовується**, а не там, де визначене
- Три способи застосувати `patch()`: декоратор, менеджер контексту та ручні `start()`/`stop()`
- Як порядок декораторів пов'язаний із порядком аргументів-моків
- Корисні варіанти: `patch.object()`, `patch.dict()`, `new=`, `return_value=`, `side_effect=`, `autospec=True`
- Як імітувати файли за допомогою `mock_open()`

## Що робить patch()

`patch(target)` знаходить об'єкт, названий у `target`, підміняє його новим `MagicMock` і віддає вам цей мок. Коли дія patch закінчується, оригінальний об'єкт повертається на місце.

**Ціль** (target) — це рядок у форматі `'package.module.attribute'`:

```text
'total.read'                 # функція read у модулі total
'shapes.circle.Circle'       # клас Circle у модулі shapes.circle
'builtins.open'              # вбудована функція open()
'os.environ'                 # словник у модулі os (для нього є patch.dict)
```

Два правила щодо цілі:

1. Її має бути можливо **імпортувати**. `patch()` імпортує все до останньої крапки, а потім підміняє атрибут після неї.
2. Підміняйте ім'я **там, де його шукають** (використовують), а не там, де його спочатку визначили. Це правило плутає людей найчастіше, тому нижче йому присвячено окремий розділ.

## Модуль, який тестуємо

Приклади використовують модуль `total.py`:

```python
def read(filename):
    """Read a text file and return a list of numbers."""
    with open(filename) as f:
        lines = f.readlines()
        return [float(line.strip()) for line in lines]


def calculate_total(filename):
    """Return the sum of numbers in a text file."""
    numbers = read(filename)
    return sum(numbers)
```

- `read()` читає текстовий файл, перетворює кожен рядок на `float` і повертає список.
- `calculate_total()` викликає `read()` і повертає суму.

Для файлу `numbers.txt` із рядками `1`, `2` і `3`:

```python
import total

print(total.read('numbers.txt'))
print(total.calculate_total('numbers.txt'))
```

Результат:

```text
[1.0, 2.0, 3.0]
6.0
```

Зверніть увагу: числа дійсні (`float`), бо `read()` викликає `float()`. Щоб протестувати `calculate_total()` модульним тестом без звернення до диска, треба підмінити `read()`.

## Без patch(): ручна заміна

Ось `test_total_mock.py`, що підміняє `read()` уручну:

```python
import unittest
from unittest.mock import MagicMock

import total


class TestTotal(unittest.TestCase):
    def test_calculate_total(self):
        total.read = MagicMock()
        total.read.return_value = [1, 2, 3]
        result = total.calculate_total('')
        self.assertEqual(result, 6)
```

```bash
python -m unittest test_total_mock.py -v
```

Результат:

```text
test_calculate_total (test_total_mock.TestTotal.test_calculate_total) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Тест проходить, але `total.read` лишається `MagicMock` до кінця запуску. Кожен наступний тест, якому потрібна справжня `read()`, отримає мок. Саме цю проблему й розв'язує `patch()`.

## 1) patch() як декоратор

`test_total_patch_decorator.py`:

```python
import unittest
from unittest.mock import patch

import total


class TestTotal(unittest.TestCase):
    @patch('total.read')
    def test_calculate_total(self, mock_read):
        mock_read.return_value = [1, 2, 3]
        result = total.calculate_total('')
        self.assertEqual(result, 6)
        mock_read.assert_called_once_with('')
```

Як це працює:

1. `@patch('total.read')` підміняє `total.read` на `MagicMock` безпосередньо перед запуском тестового методу.
2. Мок передається в метод як **додатковий аргумент** після `self`. Назвати його можна як завгодно, зазвичай пишуть `mock_<назва>`.
3. Усередині методу `calculate_total()` викликає мок замість справжньої `read()`, тож ім'я файлу неважливе й жоден файл не відкривається.
4. Коли метод завершується (або генерує виняток), `patch()` повертає справжню `read()`.

```bash
python -m unittest test_total_patch_decorator -v
```

Результат:

```text
test_calculate_total (test_total_patch_decorator.TestTotal.test_calculate_total) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

### Декорування цілого класу

`@patch` може декорувати й клас `TestCase`. Тоді patch застосовується до **кожного методу, назва якого починається з `test`**, і кожен із них отримує мок. Допоміжні методи та `setUp()` не підміняються.

```python
import unittest
from unittest.mock import patch

import total


@patch('total.read', autospec=True)
class TestTotal(unittest.TestCase):
    def test_sum(self, mock_read):
        mock_read.return_value = [1, 2, 3]
        self.assertEqual(total.calculate_total('a.txt'), 6)

    def test_empty_file(self, mock_read):
        mock_read.return_value = []
        self.assertEqual(total.calculate_total('empty.txt'), 0)

    def test_wrong_call_is_caught(self, mock_read):
        with self.assertRaises(TypeError):
            total.read('a.txt', 'extra')
```

Результат `python -m unittest test_class_patch -v`:

```text
test_empty_file (test_class_patch.TestTotal.test_empty_file) ... ok
test_sum (test_class_patch.TestTotal.test_sum) ... ok
test_wrong_call_is_caught (test_class_patch.TestTotal.test_wrong_call_is_caught) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.001s

OK
```

`autospec=True` будує мок за справжньою `read()`, тому виклик із неправильною кількістю аргументів генерує `TypeError`, як і справжня функція.

### Кілька patch: зважайте на порядок

Декоратори застосовуються знизу вгору, тому **нижній** декоратор дає **перший** аргумент-мок:

```python
import os
import unittest
from unittest.mock import patch


class TestOrder(unittest.TestCase):
    @patch('os.getcwd')   # зовнішній декоратор -> останній аргумент-мок
    @patch('os.listdir')  # внутрішній декоратор -> перший аргумент-мок
    def test_order(self, mock_listdir, mock_getcwd):
        mock_getcwd.return_value = '/home/ann'
        mock_listdir.return_value = ['notes.txt']
        self.assertEqual(os.getcwd(), '/home/ann')
        self.assertEqual(os.listdir('.'), ['notes.txt'])
```

Результат `python -m unittest test_order -v`:

```text
test_order (test_order.TestOrder.test_order) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Читайте список аргументів від декоратора, найближчого до `def`, і вгору.

## 2) patch() як менеджер контексту

`test_total_patch_ctx_mgr.py`:

```python
import unittest
from unittest.mock import patch

import total


class TestTotal(unittest.TestCase):
    def test_calculate_total(self):
        with patch('total.read') as mock_read:
            mock_read.return_value = [1, 2, 3]
            result = total.calculate_total('')
        self.assertEqual(result, 6)
```

`with patch(...) as mock_read:` підміняє `total.read` лише **всередині блоку `with`**, а частина `as` дає вам мок. Ця форма зручна, коли заміну має бачити тільки частина тесту.

```bash
python -m unittest test_total_patch_ctx_mgr -v
```

Результат:

```text
test_calculate_total (test_total_patch_ctx_mgr.TestTotal.test_calculate_total) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Підміну й відновлення можна побачити на власні очі:

```python
from unittest.mock import patch

import total

print(total.read)
with patch('total.read') as mock_read:
    print(total.read is mock_read)
    print(mock_read)
print(total.read)
```

Результат (адреси щоразу різні):

```text
<function read at 0x103978040>
True
<MagicMock name='read' id='4353887600'>
<function read at 0x103978040>
```

## 3) patch() із ручними start() і stop()

`patch()` повертає об'єкт-**патчер** (patcher). `start()` застосовує підміну й повертає мок, `stop()` її скасовує:

```python
import unittest
from unittest.mock import patch

import total


class TestTotal(unittest.TestCase):
    def test_calculate_total(self):
        # створюємо патчер і починаємо підміну
        patcher = patch('total.read')
        mock_read = patcher.start()

        mock_read.return_value = [1, 2, 3]
        result = total.calculate_total('')

        # завершуємо підміну
        patcher.stop()

        self.assertEqual(result, 6)
```

Результат `python -m unittest test_total_patch_manual_inline -v`:

```text
test_calculate_total (test_total_patch_manual_inline.TestTotal.test_calculate_total) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Це працює, але якщо між `start()` і `stop()` щось згенерує виняток, до `stop()` виконання не дійде, і підміна «протече». Насправді ручна форма призначена для `setUp()` у парі з `addCleanup()`:

```python
import unittest
from unittest.mock import patch

import total


class TestTotal(unittest.TestCase):
    def setUp(self):
        patcher = patch('total.read')
        self.mock_read = patcher.start()
        # зупиняємо патчер після тесту, навіть якщо тест не пройшов
        self.addCleanup(patcher.stop)

    def test_calculate_total(self):
        self.mock_read.return_value = [1, 2, 3]
        result = total.calculate_total('')
        self.assertEqual(result, 6)
```

Результат `python -m unittest test_total_patch_manual -v`:

```text
test_calculate_total (test_total_patch_manual.TestTotal.test_calculate_total) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Тепер кожен тест класу отримує свіжий мок у `self.mock_read`, а функції очищення спрацьовують, навіть якщо тест не пройшов або далі в `setUp()` сталася помилка.

| Форма | Область дії підміни | Типове застосування |
|---|---|---|
| `@patch(...)` на методі | Увесь тестовий метод | Найпоширеніший варіант |
| `@patch(...)` на класі | Кожен метод `test*` | Усім тестам потрібна та сама підміна |
| `with patch(...)` | Блок `with` | Лише частина тесту або код поза тестами |
| `start()` / `stop()` | До виклику `stop()` | У `setUp()` разом з `addCleanup()` |

## Де підміняти: найпоширеніша пастка

Розгляньмо два модулі:

```python
# rates.py
def get_rate(currency):
    raise RuntimeError("calls a real exchange-rate service")
```

```python
# checkout.py
from rates import get_rate


def to_eur(amount_usd):
    return round(amount_usd * get_rate("EUR"), 2)
```

`from rates import get_rate` створює **друге ім'я**, `checkout.get_rate`, прив'язане до того самого об'єкта-функції. Patch підміняє ім'я лише в **одному** просторі імен:

```text
до підміни:
  rates.get_rate     ──┐
                       ├──> function get_rate
  checkout.get_rate  ──┘

після patch('rates.get_rate'):
  rates.get_rate     ───> MagicMock
  checkout.get_rate  ───> function get_rate   <- to_eur() і далі бере цю
```

```python
import unittest
from unittest.mock import patch

import checkout


class TestToEur(unittest.TestCase):
    @patch('rates.get_rate')  # неправильно: там, де get_rate визначено
    def test_wrong_target(self, mock_get_rate):
        mock_get_rate.return_value = 0.9
        self.assertEqual(checkout.to_eur(100), 90.0)

    @patch('checkout.get_rate')  # правильно: там, де get_rate шукають
    def test_right_target(self, mock_get_rate):
        mock_get_rate.return_value = 0.9
        self.assertEqual(checkout.to_eur(100), 90.0)
        mock_get_rate.assert_called_once_with("EUR")
```

Результат (шляхи скорочено):

```text
test_right_target (test_checkout.TestToEur.test_right_target) ... ok
test_wrong_target (test_checkout.TestToEur.test_wrong_target) ... ERROR

======================================================================
ERROR: test_wrong_target (test_checkout.TestToEur.test_wrong_target)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../unittest/mock.py", line 1432, in patched
    return func(*newargs, **newkeywargs)
  File "test_checkout.py", line 11, in test_wrong_target
    self.assertEqual(checkout.to_eur(100), 90.0)
                     ~~~~~~~~~~~~~~~^^^^^
  File "checkout.py", line 5, in to_eur
    return round(amount_usd * get_rate("EUR"), 2)
                              ~~~~~~~~^^^^^^^
  File "rates.py", line 2, in get_rate
    raise RuntimeError("calls a real exchange-rate service")
RuntimeError: calls a real exchange-rate service

----------------------------------------------------------------------
Ran 2 tests in 0.001s

FAILED (errors=1)
```

Просте правило:

- Код робить `from rates import get_rate` → підміняйте `'checkout.get_rate'` (модуль, що імпортує).
- Код робить `import rates` і викликає `rates.get_rate(...)` → підміняйте `'rates.get_rate'`, бо пошук іде через об'єкт модуля `rates` у момент виклику.

## Налаштування мока у виклику patch()

`patch()` передає додаткові іменовані аргументи моку, який створює, а ще має кілька власних параметрів:

```python
import os
from unittest.mock import patch

import total

# patch.object: ціль — це об'єкт плюс назва атрибута
with patch.object(total, 'read', return_value=[10, 20]) as mock_read:
    print(total.calculate_total('any.txt'))
    print(mock_read.call_args)

# new=...: підміна конкретним об'єктом, мок у тест не передається
with patch('total.read', new=lambda filename: [1.5, 2.5]):
    print(total.calculate_total('any.txt'))

# patch.dict: тимчасова зміна словника, наприклад os.environ
with patch.dict(os.environ, {'APP_MODE': 'test'}):
    print(os.environ['APP_MODE'])
print('APP_MODE' in os.environ)
```

Результат:

```text
30
call('any.txt')
4.0
test
False
```

- `return_value=...` і `side_effect=...` одразу налаштовують мок, і в тесті стає на рядок менше.
- `patch.object(obj, 'name')` підміняє атрибут об'єкта, який у вас уже є. Рядка з шляхом імпорту немає, тож і одрукуватися в ньому неможливо.
- `new=obj` використовує вашу власну заміну. Якщо задано `new`, декоратор **не** передає тесту додатковий аргумент.
- `patch.dict(d, values)` додає або змінює ключі на час дії, а потім точно відновлює словник, видаляючи додані ключі. `clear=True` дає змогу почати з порожнього словника.
- `autospec=True` створює мок із тією самою сигнатурою, що й справжній об'єкт (див. приклад із декоруванням класу вище).

## Імітація файлів через mock_open()

Щоб протестувати саму `read()` без справжнього файлу, підмініть вбудовану `open()` за допомогою `mock_open()`:

```python
import unittest
from unittest.mock import mock_open, patch

import total


class TestRead(unittest.TestCase):
    def test_read(self):
        fake_file = mock_open(read_data='1\n2.5\n-3\n')
        with patch('builtins.open', fake_file):
            numbers = total.read('data.txt')
        self.assertEqual(numbers, [1.0, 2.5, -3.0])
        fake_file.assert_called_once_with('data.txt')
```

Результат `python -m unittest test_read -v`:

```text
test_read (test_read.TestRead.test_read) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.001s

OK
```

`mock_open()` створює мок, який поводиться як `open()`: працює як менеджер контексту й підтримує `read()`, `readline()`, `readlines()` та ітерацію по `read_data`. Вбудовані функції живуть у модулі `builtins`, звідси й ціль `'builtins.open'`.

## Типові помилки

- **Підміняти там, де об'єкт визначено**, а не там, де його використовують. Див. приклад із `rates`/`checkout`. Якщо patch «нічого не робить», перевірте, як код, що тестується, імпортує це ім'я.
- **Плутати порядок аргументів** у декораторах, розташованих один над одним. Нижній декоратор дає перший аргумент.
- **Викликати `start()` без гарантованого `stop()`.** Використовуйте `addCleanup(patcher.stop)` або `patch.stopall()` у функції очищення.
- **Одруківка в цілі.** `patch()` генерує помилку, а не створює новий атрибут, і це добре:

  ```python
  from unittest.mock import patch

  import total

  try:
      with patch('total.reed'):
          pass
  except AttributeError as error:
      print('AttributeError:', error)
  ```

  Результат (шлях скорочено):

  ```text
  AttributeError: <module 'total' from '.../total.py'> does not have the attribute 'reed'
  ```

  Передавайте `create=True`, лише якщо справді треба додати атрибут, якого не існує.
- **Підміняти атрибути вбудованих типів.** Типи, написані мовою C, як-от `datetime.date`, не дозволяють присвоювати атрибути:

  ```python
  from unittest.mock import patch

  try:
      with patch('datetime.date.today'):
          pass
  except TypeError as error:
      print('TypeError:', error)
  ```

  Результат:

  ```text
  TypeError: cannot set 'today' attribute of immutable type 'datetime.date'
  ```

  Натомість підмініть ім'я `date` у **своєму** модулі (див. вправу 3) або передавайте поточну дату у функцію як параметр.
- **Перевіряти результат поза надто коротким блоком `with`.** Код після блоку вже знову працює зі справжнім об'єктом. Тримайте всередині блоку всі виклики, яким потрібен мок.

## Підсумок

- `patch()` тимчасово підміняє ціль на `MagicMock` і завжди відновлює оригінал.
- Ціль — це рядок із крапками, який можна імпортувати, наприклад `'package.module.name'`.
- Підміняйте ім'я там, де код, що тестується, **його шукає**: для `from x import y` у модулі `m` підміняйте `'m.y'`.
- Застосовуйте patch як декоратор методу чи класу (мок приходить аргументом), як менеджер контексту (`with ... as mock`) або через `start()`/`stop()` разом з `addCleanup()`.
- Коли декораторів кілька, нижній дає перший аргумент-мок.
- `return_value=`, `side_effect=`, `autospec=True`, `new=`, `patch.object()`, `patch.dict()` і `mock_open()` покривають більшість практичних потреб.

## Практика

### Вправа 1: Файлу немає

За допомогою `@patch` і `side_effect` напишіть тест, який перевіряє, що `total.calculate_total('missing.txt')` пропускає далі `FileNotFoundError` із `read()`. Також перевірте, що `read()` викликали з `'missing.txt'`.

### Вправа 2: Повторні спроби без очікування

Модуль `downloader.py` повторює невдалий виклик із паузою:

```python
from time import sleep


def download(fetch, attempts=3, delay=2):
    for attempt in range(1, attempts + 1):
        try:
            return fetch()
        except ConnectionError:
            if attempt == attempts:
                raise
            sleep(delay)
```

Напишіть тести, що виконуються миттєво (без справжнього `sleep`):

- `fetch` двічі падає, а потім повертає `'data'`: `download()` повертає `'data'`, `fetch` викликано 3 рази, а `sleep(2)` — двічі.
- `fetch` падає завжди: `download()` генерує `ConnectionError` після 3 спроб і 2 пауз.

Яку ціль треба підміняти і чому?

### Вправа 3: Заморозьте сьогоднішню дату

Модуль `calendar_utils.py`:

```python
from datetime import date


def days_until_new_year():
    today = date.today()
    return (date(today.year + 1, 1, 1) - today).days
```

Перевірте, що функція повертає `2` 30 грудня 2024 року і `365` 1 січня 2025 року. Пам'ятайте, що `patch('datetime.date.today')` не працює, а функція ще й викликає `date(...)`, щоб створити нову дату.

## Розв'язки

### Вправа 1

```python
import unittest
from unittest.mock import patch

import total


class TestTotalErrors(unittest.TestCase):
    @patch('total.read', side_effect=FileNotFoundError('no such file'))
    def test_missing_file(self, mock_read):
        with self.assertRaises(FileNotFoundError):
            total.calculate_total('missing.txt')
        mock_read.assert_called_once_with('missing.txt')
```

Результат `python -m unittest test_total_missing -v`:

```text
test_missing_file (test_total_missing.TestTotalErrors.test_missing_file) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

### Вправа 2

`downloader.py` робить `from time import sleep`, тож `download()` шукає ім'я `sleep` у модулі `downloader`. Отже, ціль — `'downloader.sleep'`, а не `'time.sleep'`.

```python
import unittest
from unittest.mock import Mock, call, patch

from downloader import download


@patch('downloader.sleep')
class TestDownload(unittest.TestCase):
    def test_succeeds_after_retries(self, mock_sleep):
        fetch = Mock(side_effect=[ConnectionError, ConnectionError, 'data'])
        self.assertEqual(download(fetch), 'data')
        self.assertEqual(fetch.call_count, 3)
        mock_sleep.assert_has_calls([call(2), call(2)])

    def test_gives_up(self, mock_sleep):
        fetch = Mock(side_effect=ConnectionError)
        with self.assertRaises(ConnectionError):
            download(fetch, attempts=3)
        self.assertEqual(fetch.call_count, 3)
        self.assertEqual(mock_sleep.call_count, 2)
```

Результат `python -m unittest test_downloader -v`:

```text
test_gives_up (test_downloader.TestDownload.test_gives_up) ... ok
test_succeeds_after_retries (test_downloader.TestDownload.test_succeeds_after_retries) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.001s

OK
```

Без підміни ці два тести загалом «спали» б 8 секунд. З нею вони завершуються приблизно за мілісекунду (час виконання щоразу різний).

### Вправа 3

Підмініть ім'я `date` усередині `calendar_utils`. Метод `today()` мока повертає фіксовану справжню дату, а `side_effect` переадресовує виклики конструктора на кшталт `date(2025, 1, 1)` справжньому класу:

```python
import unittest
from datetime import date
from unittest.mock import patch

import calendar_utils


class TestDaysUntilNewYear(unittest.TestCase):
    @patch('calendar_utils.date')
    def test_december_30(self, mock_date):
        mock_date.today.return_value = date(2024, 12, 30)
        # виклики на кшталт date(2025, 1, 1) мають і далі створювати справжні дати
        mock_date.side_effect = lambda *args, **kwargs: date(*args, **kwargs)
        self.assertEqual(calendar_utils.days_until_new_year(), 2)

    @patch('calendar_utils.date')
    def test_january_1(self, mock_date):
        mock_date.today.return_value = date(2025, 1, 1)
        mock_date.side_effect = lambda *args, **kwargs: date(*args, **kwargs)
        self.assertEqual(calendar_utils.days_until_new_year(), 365)
```

Результат `python -m unittest test_calendar_utils -v`:

```text
test_december_30 (test_calendar_utils.TestDaysUntilNewYear.test_december_30) ... ok
test_january_1 (test_calendar_utils.TestDaysUntilNewYear.test_january_1) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.001s

OK
```

Без `side_effect` вираз `date(today.year + 1, 1, 1)` повернув би `MagicMock`, і віднімання не дало б справжньої кількості днів. Часто простіше інше проєктне рішення: `days_until_new_year(today=None)`, де тест передає дату напряму і нічого не треба підміняти.

---

*Джерело: [pythontutorial.net — Python patch](https://www.pythontutorial.net/python-unit-testing/python-patch/). Адаптовано й доповнено для PyJourney.*
