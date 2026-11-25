# Моки (Mock)

Модульний тест має перевіряти один фрагмент коду ізольовано. Проте реальний код звертається до годинника, датчиків, баз даних і веб-API, чиї відповіді повільні, випадкові або на тестовій машині взагалі недоступні. **Мок** (mock) — це об'єкт-замінник, який удає таку залежність: ви вирішуєте, що він повертає, а потім можете запитати, як саме його використовували. Усе потрібне для цього є в стандартному модулі `unittest.mock`.

## Що ви дізнаєтесь

- Що таке тестові дублери і яке місце серед них посідають моки
- Як `Mock` створює атрибути й методи «на льоту» і як задати `return_value`
- Чим `MagicMock` відрізняється від `Mock` (магічні методи на кшталт `__len__` і `__getitem__`)
- Як перевіряти виклики: `call_count`, `call_args`, `assert_called_once_with()` тощо
- Як за допомогою `side_effect` генерувати винятки або повертати послідовність значень
- Як `spec` і `create_autospec()` не дають моку приховувати помилки

## Тестові дублери коротко

«Тестовий дублер» (test double) — загальна назва будь-якого об'єкта, що підміняє справжню залежність у тесті (як каскадер-дублер у кіно). Зазвичай розрізняють кілька видів:

| Вид | Що робить | Приклад |
|---|---|---|
| Dummy (пустушка) | Заповнює параметр, але фактично не використовується | `None` замість логера, який не потрібен |
| Stub (заглушка) | Повертає заздалегідь заготовлені відповіді | Датчик, який завжди показує 25 градусів |
| Fake (спрощена реалізація) | Робоча, але спрощена версія | Словник у пам'яті замість бази даних |
| Spy (шпигун) | Записує, як його викликали | Список, що збирає надіслані листи |
| Mock (мок) | Повертає заготовлені відповіді **і** дає змогу перевірити виклики | `unittest.mock.Mock` |

У повсякденному Python слово «мок» вживають доволі вільно, бо об'єкт `Mock` може виконувати будь-яку з цих ролей. Ця тема присвячена самому класу `Mock`. Заглушкам і `patch()` присвячено окремі теми.

## Створення мока

```python
from unittest.mock import Mock

# створюємо новий мок-об'єкт
mock = Mock()

# задаємо, що повертатиме mock.api()
mock.api.return_value = {
    'id': 1,
    'message': 'hello'
}

# викликаємо «метод» api
print(mock.api())
```

Результат:

```text
{'id': 1, 'message': 'hello'}
```

Крок за кроком:

1. `Mock()` створює об'єкт, який приймає **будь-яке** звернення до атрибута і **будь-який** виклик.
2. Атрибута `mock.api` не існувало, тож мок одразу створив для нього **дочірній мок** (child mock).
3. `return_value` визначає, що повертає дочірній мок під час виклику.
4. `mock.api()` викликає дочірній мок, і той повертає налаштований словник.

Тепер маємо два мок-об'єкти: `mock` і `mock.api`. Якщо їх вивести, це видно:

```python
from unittest.mock import Mock

mock = Mock()
print(mock)

mock.api.return_value = {'id': 1, 'message': 'hello'}
print(mock.api)
print(mock.api())

print(mock.api is mock.api)   # щоразу той самий дочірній мок
print(mock.anything.you.like)  # атрибути створюються на вимогу
print(mock.api(42) is mock.api.return_value)
```

Результат (значення `id` щоразу різні):

```text
<Mock id='4351054848'>
<Mock name='mock.api' id='4355051200'>
{'id': 1, 'message': 'hello'}
True
<Mock name='mock.anything.you.like' id='4355052544'>
True
```

Головне:

- Звернення до неіснуючого атрибута створює новий дочірній мок і запам'ятовує його, тому `mock.api` завжди повертає **той самий** об'єкт.
- Вирішуючи, що повернути, мок не зважає на аргументи виклику. `mock.api(42)` повертає те саме `return_value`, що й `mock.api()`.
- Саме ця динамічна поведінка робить `Mock` таким гнучким: він може замінити модуль, клас, екземпляр чи функцію.

Якщо `return_value` не задано, виклик мока повертає ще один мок:

```python
from unittest.mock import Mock

db = Mock()
result = db.query("SELECT 1")
print(result)
print(result is db.query.return_value)
```

Результат (`id` щоразу інший):

```text
<Mock name='mock.query()' id='4304736608'>
True
```

Ім'я `mock.query()` точно показує, звідки взявся об'єкт, і це дуже допомагає, коли перевірка не проходить.

## Mock чи MagicMock

У `unittest.mock` є два основні класи:

- `Mock` підтримує звичайні атрибути й виклики.
- `MagicMock` — підклас `Mock`, у якому заздалегідь налаштовано **магічні (dunder) методи**: `__len__`, `__iter__`, `__getitem__`, `__contains__`, `__enter__`/`__exit__` і багато інших.

```python
from unittest.mock import Mock, MagicMock

plain = Mock()
magic = MagicMock()

print(len(magic))
print(list(magic))
print(5 in magic)
print(magic[0])

magic.__len__.return_value = 3
magic.__getitem__.side_effect = lambda index: index * 10
print(len(magic), magic[4])

try:
    len(plain)
except TypeError as error:
    print("TypeError:", error)
```

Результат (`id` щоразу інший):

```text
0
[]
False
<MagicMock name='mock.__getitem__()' id='4352137200'>
3 40
TypeError: object of type 'Mock' has no len()
```

`MagicMock` має розумні значення за замовчуванням (`len()` дорівнює `0`, ітерація порожня, `in` дає `False`), і кожен магічний метод можна налаштувати так само, як будь-який дочірній мок. Звичайний `Mock` генерує `TypeError`, бо Python шукає магічні методи в **типі** об'єкта, а не в екземплярі, тож `Mock` не може вигадати їх на вимогу.

> **Порада:** використовуйте `MagicMock`, коли код, що тестується, працює з об'єктом через `len()`, `for`, `[]`, `with` та подібний синтаксис. Саме тому `patch()` за замовчуванням створює `MagicMock`.

## Перевірка викликів

Мок записує кожен свій виклик. Завдяки цьому тест може перевіряти **взаємодію**: не лише що повернув код, а й що він просив зробити свої залежності.

```python
from unittest.mock import Mock, call

mailer = Mock()

mailer.send("ann@example.com", subject="Hi")
mailer.send("bob@example.com", subject="Report")

print(mailer.send.called)
print(mailer.send.call_count)
print(mailer.send.call_args)
print(mailer.send.call_args.args, mailer.send.call_args.kwargs)
print(mailer.send.call_args_list)
print(mailer.mock_calls)

# методи-перевірки генерують AssertionError, якщо умова не виконується
mailer.send.assert_called_with("bob@example.com", subject="Report")
mailer.send.assert_any_call("ann@example.com", subject="Hi")
mailer.send.assert_has_calls([
    call("ann@example.com", subject="Hi"),
    call("bob@example.com", subject="Report"),
])
mailer.close.assert_not_called()

try:
    mailer.send.assert_called_once()
except AssertionError as error:
    print("AssertionError:", error)
```

Результат (Python 3.14):

```text
True
2
call('bob@example.com', subject='Report')
('bob@example.com',) {'subject': 'Report'}
[call('ann@example.com', subject='Hi'),
 call('bob@example.com', subject='Report')]
[call.send('ann@example.com', subject='Hi'),
 call.send('bob@example.com', subject='Report')]
AssertionError: Expected 'send' to have been called once. Called 2 times.
Calls: [call('ann@example.com', subject='Hi'),
 call('bob@example.com', subject='Report')].
```

Найкорисніші інструменти:

| Атрибут / метод | Значення |
|---|---|
| `called`, `call_count` | Чи викликали і скільки разів |
| `call_args` | Аргументи **останнього** виклику (`.args`, `.kwargs`) |
| `call_args_list` | Усі виклики цього мока по порядку |
| `mock_calls` | Усі виклики мока **та його дочірніх моків** |
| `assert_called()`, `assert_called_once()` | Викликали хоча б раз / рівно один раз |
| `assert_called_with(...)` | **Останній** виклик мав такі аргументи |
| `assert_called_once_with(...)` | Рівно один виклик і саме з такими аргументами |
| `assert_any_call(...)` | Хоча б один виклик мав такі аргументи |
| `assert_has_calls([...])` | Ці виклики відбулися саме в такому порядку |
| `assert_not_called()` | Жодного виклику |
| `reset_mock()` | Забути всі записані виклики |

> **Зверніть увагу:** `assert_called_with()` перевіряє лише **останній** виклик. Якщо код викликає мок кілька разів і вам важливі всі виклики, використовуйте `assert_has_calls()` або порівнюйте `call_args_list`.

## side_effect: винятки, послідовності та функції

`return_value` завжди повертає одне й те саме. `side_effect` дає більше контролю. Це може бути:

```python
from unittest.mock import Mock

# 1) виняток: мок генерує його під час виклику
fetch = Mock(side_effect=ConnectionError("server is down"))
try:
    fetch()
except ConnectionError as error:
    print("raised:", error)

# 2) ітерований об'єкт: кожен виклик повертає наступний елемент
dice = Mock(side_effect=[6, 1, ValueError("dice fell off the table")])
print(dice(), dice())
try:
    dice()
except ValueError as error:
    print("raised:", error)

# 3) функція: викликається з тими самими аргументами, її результат повертається
square = Mock(side_effect=lambda x: x * x)
print(square(7))
print(square.call_args)
```

Результат:

```text
raised: server is down
6 1
raised: dice fell off the table
49
call(7)
```

- **Виняток** (клас або екземпляр) генерується під час виклику. Це найпростіший спосіб перевірити обробку помилок: «що зробить мій код, якщо мережа впаде?»
- **Ітерований об'єкт** видає по одному елементу на виклик. Якщо елемент є винятком, його буде згенеровано, а не повернуто. Коли елементи закінчаться, наступний виклик згенерує `StopIteration`.
- **Функція** отримує аргументи виклику, а її результат стає значенням, що повертається. Це зручно, коли відповідь залежить від вхідних даних.

Якщо задано обидва параметри, перемагає `side_effect`:

```python
from unittest.mock import Mock

dice = Mock(side_effect=[1, 2])
dice(); dice()
try:
    dice()
except StopIteration:
    print("StopIteration: the side_effect list is exhausted")

m = Mock(return_value=1, side_effect=lambda: 2)
print(m())
```

Результат:

```text
StopIteration: the side_effect list is exhausted
2
```

(Єдиний виняток із правила: якщо функція в `side_effect` повертає спеціальне значення `unittest.mock.DEFAULT`, мок повертає `return_value`.)

## Обмеження мока: spec і autospec

Гнучкість мока — водночас і його найбільша слабкість. Він охоче приймає методи з одруківками в назві й неправильні аргументи, тож тест може проходити, хоча справжній код упав би. **Специфікація** (spec) обмежує мок тим, що справді є в реального об'єкта:

```python
from unittest.mock import Mock, create_autospec


class PaymentGateway:
    def charge(self, amount, currency="USD"):
        ...


loose = Mock()
print(loose.chrage(100))  # одруківка, але жодної помилки!

strict = Mock(spec=PaymentGateway)
try:
    strict.chrage(100)
except AttributeError as error:
    print("AttributeError:", error)

print(strict.charge(100, "EUR", "extra"))  # spec не перевіряє аргументи

auto = create_autospec(PaymentGateway, instance=True)
auto.charge(100, currency="EUR")
try:
    auto.charge(100, "EUR", "extra")
except TypeError as error:
    print("TypeError:", error)
print(isinstance(strict, PaymentGateway), isinstance(auto, PaymentGateway))
```

Результат (значення `id` щоразу різні):

```text
<Mock name='mock.chrage()' id='4315713888'>
AttributeError: Mock object has no attribute 'chrage'
<Mock name='mock.charge()' id='4315714896'>
TypeError: too many positional arguments
True True
```

- `Mock(spec=SomeClass)` дозволяє лише ті атрибути, що існують у `SomeClass`, і проходить перевірки `isinstance()`. Сигнатури викликів він **не** перевіряє.
- `create_autospec(SomeClass, instance=True)` іде далі: кожен метод звіряє аргументи зі справжньою сигнатурою, точно як це зробив би реальний метод.
- `spec_set=SomeClass` додатково забороняє **присвоювати** атрибути, яких немає в класі.

> **Порада:** якщо справжній клас доступний, віддавайте перевагу `spec`/`autospec`. Тоді моки лишаються чесними, навіть коли реальний API змінюється.

## Приклад: тестуємо сигнал одометра

Припустімо, у вас є модуль `odometer.py`:

```python
from random import randint


def speed():
    return randint(40, 120)


def alert():
    s = speed()
    if s < 60 or s > 100:
        return True
    return False
```

- `speed()` повертає поточну швидкість автомобіля. Тут це випадкове число від 40 до 120, а в реальному житті функція читала б апаратний датчик.
- `alert()` повертає `True`, коли швидкість **менша за 60** або **більша за 100** км/год, і `False` в інших випадках. Швидкість вона отримує, викликаючи `speed()`.

Тестувати `alert()` напряму важко, бо `speed()` щоразу повертає інше значення. Тест, який то проходить, то ні, гірший за відсутність тесту. Рішення — замінити `speed` моком, значення якого ви контролюєте.

### Перший тест

Створіть `test_odometer.py` поруч із `odometer.py`:

```python
import unittest
from unittest.mock import Mock

import odometer


class TestOdometer(unittest.TestCase):
    def test_alert_normal(self):
        odometer.speed = Mock()
        odometer.speed.return_value = 70
        self.assertFalse(odometer.alert())
```

Як це працює:

1. `odometer.speed = Mock()` замінює атрибут модуля `speed` моком.
2. `return_value = 70` змушує кожен виклик `speed()` повертати 70.
3. Під час виконання `alert()` шукає глобальне ім'я `speed` у своєму модулі, тож знаходить і викликає мок замість справжньої функції.

Запустіть тест:

```bash
python -m unittest test_odometer.py -v
```

Результат:

```text
test_alert_normal (test_odometer.TestOdometer.test_alert_normal) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

### Прихована проблема: мок «протікає»

Тест вище так і не повертає справжню `speed()` на місце. Заміна лишається до кінця запуску й непомітно впливає на всі тести, що виконуються пізніше. Додайте другий тест, який перевіряє справжню функцію:

```python
import unittest
from unittest.mock import Mock

import odometer


class TestOdometer(unittest.TestCase):
    def test_alert_normal(self):
        odometer.speed = Mock()
        odometer.speed.return_value = 70
        self.assertFalse(odometer.alert())

    def test_real_speed_varies(self):
        speeds = {odometer.speed() for _ in range(100)}
        self.assertGreater(len(speeds), 1)
```

Результат (абсолютні шляхи скорочено):

```text
test_alert_normal (test_odometer.TestOdometer.test_alert_normal) ... ok
test_real_speed_varies (test_odometer.TestOdometer.test_real_speed_varies) ... FAIL

======================================================================
FAIL: test_real_speed_varies (test_odometer.TestOdometer.test_real_speed_varies)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "test_odometer.py", line 15, in test_real_speed_varies
    self.assertGreater(len(speeds), 1)
    ~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^^^^
AssertionError: 1 not greater than 1

----------------------------------------------------------------------
Ran 2 tests in 0.001s

FAILED (failures=1)
```

`unittest` запускає тестові методи в алфавітному порядку, тому першим виконався `test_alert_normal` і залишив мок по собі. Потім `test_real_speed_varies` сто разів викликав мок і щоразу отримував 70. Тести не повинні так залежати один від одного.

### Безпечно покриваємо всі випадки

Повертайте оригінальну функцію на місце після **кожного** тесту. `addCleanup()` спрацьовує навіть тоді, коли тест не пройшов:

```python
import unittest
from unittest.mock import Mock

import odometer


class TestAlert(unittest.TestCase):
    def setUp(self):
        # повертаємо справжню speed() після кожного тесту, навіть невдалого
        self.addCleanup(setattr, odometer, "speed", odometer.speed)
        odometer.speed = Mock()

    def test_alert_normal(self):
        odometer.speed.return_value = 70
        self.assertFalse(odometer.alert())
        odometer.speed.assert_called_once_with()

    def test_alert_at_limits(self):
        for limit in (60, 100):
            odometer.speed.return_value = limit
            self.assertFalse(odometer.alert())

    def test_alert_overspeed(self):
        odometer.speed.return_value = 101
        self.assertTrue(odometer.alert())

    def test_alert_underspeed(self):
        odometer.speed.return_value = 59
        self.assertTrue(odometer.alert())


class TestSpeed(unittest.TestCase):
    def test_real_speed_varies(self):
        speeds = {odometer.speed() for _ in range(100)}
        self.assertGreater(len(speeds), 1)
```

Запустіть тести:

```bash
python -m unittest test_odometer.py -v
```

Результат:

```text
test_alert_at_limits (test_odometer.TestAlert.test_alert_at_limits) ... ok
test_alert_normal (test_odometer.TestAlert.test_alert_normal) ... ok
test_alert_overspeed (test_odometer.TestAlert.test_alert_overspeed) ... ok
test_alert_underspeed (test_odometer.TestAlert.test_alert_underspeed) ... ok
test_real_speed_varies (test_odometer.TestSpeed.test_real_speed_varies) ... ok

----------------------------------------------------------------------
Ran 5 tests in 0.000s

OK
```

Що змінилося:

- `setUp()` встановлює свіжий мок перед кожним тестом, а `addCleanup()` потім повертає справжню `speed`. Зверніть увагу: `odometer.speed` у виклику `addCleanup()` обчислюється **до** встановлення мока, тож зберігається саме справжня функція.
- Граничні значення `60` і `100` перевіряються явно. Саме тут найімовірніша помилка «на одиницю» (`<` замість `<=`).
- `assert_called_once_with()` перевіряє ще й взаємодію: `alert()` має запитати швидкість рівно один раз.

> **Зверніть увагу:** заміну атрибутів і їхнє відновлення вручну автоматизує `unittest.mock.patch()`. У наступній темі ті самі тести написано з одним декоратором.

## Коли використовувати моки

Моки найкорисніші для залежностей, які:

- **непередбачувані:** випадкові числа, поточний час, часові пояси;
- **повільні або зовнішні:** мережеві виклики, бази даних, файлова система, системні виклики;
- **важко відтворювані:** переповнений диск, тайм-аут, відповідь сервера з кодом 500;
- **ще не готові:** компонент, який інша команда тільки пише.

Переваги:

- Тести працюють швидко, бо нічого справжнього не зачіпають.
- Тести ізольовані від зовнішніх систем, тож зламаний Wi-Fi не ламає набір тестів.
- Непередбачувані результати стають передбачуваними й відтворюваними.

Проте не варто підміняти моками все підряд. Підміняйте **межі** свого коду (введення-виведення, мережу, час), а не прості чисті функції та класи даних усередині нього. Тест, у якому кожну залежність замінено моком, зрештою перевіряє лише те, що код викликає те, що викликає, і ламається від кожного безневинного рефакторингу.

## Типові помилки

- **Забути відновити замінений атрибут.** Присвоєння `module.func = Mock()` без відновлення «протікає» в наступні тести. Використовуйте `addCleanup()` або, ще краще, `patch()`.
- **Довіряти одрукам.** Без специфікації метод з одруківкою в назві мовчки повертає новий мок, і атрибут з одруківкою теж:

  ```python
  from unittest.mock import Mock

  m = Mock()
  print(bool(m.caled))  # одруківка створює новий (істинний) дочірній мок

  try:
      m.assert_called_onse()
  except AttributeError as error:
      print("AttributeError:", error)
  ```

  Результат:

  ```text
  True
  AttributeError: 'assert_called_onse' is not a valid assertion. Use a spec for the mock if 'assert_called_onse' is meant to be an attribute.
  ```

  `self.assertTrue(m.caled)` проходив би завжди. Mock захищає від одруківок у назвах `assert_*` (а з Python 3.12 — і від форм на кшталт `called_once_with` без префікса `assert_`), але не від інших одруківок. Використовуйте `spec` або `create_autospec()`.
- **Використовувати `assert_called_with()` у значенні «колись викликали з такими аргументами».** Цей метод перевіряє лише останній виклик. Для такої перевірки є `assert_any_call()`.
- **Плутати мок із його значенням, що повертається.** `mock.api` — це функція, а `mock.api()` (або `mock.api.return_value`) — те, що вона повертає. Якщо код викликає `mock.api().json()`, а ви налаштовуєте `mock.api.json.return_value`, ви налаштовуєте не той об'єкт.
- **Брати `Mock` там, де потрібні магічні методи.** `len()`, ітерація і `with` не працюють зі звичайним `Mock`. Використовуйте `MagicMock`.
- **Надмірне використання моків.** Якщо тесту потрібно десять моків, можливо, у коду забагато залежностей або ви підміняєте те, що дешево й безпечно використовувати по-справжньому.

## Підсумок

- Мок — це тестовий дублер, який повертає те, що ви налаштували, і записує, як його використовували. У Python він є в модулі `unittest.mock`.
- `Mock` створює дочірній мок для будь-якого атрибута під час першого звернення. `return_value` визначає, що повертає виклик.
- `MagicMock` додатково підтримує магічні методи (`len()`, ітерацію, `[]`, `with`).
- Взаємодію перевіряють через `call_count`, `call_args`, `call_args_list` і методи `assert_called*` / `assert_any_call()` / `assert_has_calls()`.
- `side_effect` генерує винятки, повертає послідовність значень або обчислює результат функцією. Він має пріоритет над `return_value`.
- `spec` обмежує набір атрибутів, а `create_autospec()` ще й перевіряє сигнатури викликів. Обидва ловлять помилки, які звичайний мок приховує.
- Завжди скасовуйте заміну після тесту. Підійде `addCleanup()`, а `patch()` зробить це за вас.

## Практика

### Вправа 1: Налаштуйте мок

Створіть `Mock` з назвою `weather` так, щоб `weather.today()` повертав `{"temp": 21}`, а `weather.forecast(days=3)` — `[20, 22, 19]`. Викличте обидва методи й виведіть результати. Потім перевірте, що `forecast` викликали рівно один раз із `days=3`, і виведіть `weather.mock_calls`.

### Вправа 2: Ненадійний датчик

Напишіть `average_reading(read, attempts)`, яка викликає `read()` `attempts` разів, пропускає показання, що згенерували `OSError`, і повертає середнє успішних показань (або `None`, якщо всі спроби невдалі). Перевірте її з моком, у якого `side_effect` дорівнює `[20, OSError("glitch"), 22]`, і з моком, що завжди генерує `OSError`. Виведіть результати та `call_count` моків.

### Вправа 3: Мок репозиторію

Дано модуль `greeting.py`:

```python
class UserRepository:
    def get(self, user_id):
        raise NotImplementedError("talks to a real database")


def greet_user(repo, user_id):
    user = repo.get(user_id)
    if user is None:
        return "Unknown user"
    return f"Hello, {user['name']}!"
```

Напишіть `test_greeting.py` із двома тестами (відомий і невідомий користувач). Використайте `Mock(spec=UserRepository)` і перевірте як повернутий текст, так і те, що `get()` викликали один раз із правильним id.

### Вправа 4: Помилка, яку приховує звичайний мок

У функції `remind()` нижче є помилка: вона забуває передати повідомлення.

```python
class Notifier:
    def notify(self, user, message):
        ...


def remind(notifier, user):
    notifier.notify(user)
```

Напишіть два тести для `remind()`: один зі звичайним `Mock()`, другий із `create_autospec(Notifier, instance=True)`. Обидва мають викликати `remind(notifier, "ann")`, а потім `notifier.notify.assert_called_once()`. Запустіть їх і поясніть результат, потім виправте `remind()` і запустіть знову.

## Розв'язки

### Вправа 1

```python
from unittest.mock import Mock

weather = Mock()
weather.today.return_value = {"temp": 21}
weather.forecast.return_value = [20, 22, 19]

print(weather.today())
print(weather.forecast(days=3))

weather.forecast.assert_called_once_with(days=3)
print(weather.mock_calls)
```

Результат:

```text
{'temp': 21}
[20, 22, 19]
[call.today(), call.forecast(days=3)]
```

`mock_calls` батьківського мока містить виклики всіх його дочірніх моків у порядку їх виконання.

### Вправа 2

```python
from unittest.mock import Mock


def average_reading(read, attempts):
    readings = []
    for _ in range(attempts):
        try:
            readings.append(read())
        except OSError:
            continue
    if not readings:
        return None
    return sum(readings) / len(readings)


read = Mock(side_effect=[20, OSError("glitch"), 22])
print(average_reading(read, 3))
print(read.call_count)

always_broken = Mock(side_effect=OSError("sensor offline"))
print(average_reading(always_broken, 2))
print(always_broken.call_count)
```

Результат:

```text
21.0
3
None
2
```

Список у `side_effect` може поєднувати звичайні значення й винятки. Один виняток у `side_effect` генерується під час кожного виклику.

### Вправа 3

```python
import unittest
from unittest.mock import Mock

from greeting import UserRepository, greet_user


class TestGreetUser(unittest.TestCase):
    def setUp(self):
        self.repo = Mock(spec=UserRepository)

    def test_known_user(self):
        self.repo.get.return_value = {"name": "Olena"}
        self.assertEqual(greet_user(self.repo, 7), "Hello, Olena!")
        self.repo.get.assert_called_once_with(7)

    def test_unknown_user(self):
        self.repo.get.return_value = None
        self.assertEqual(greet_user(self.repo, 99), "Unknown user")
        self.repo.get.assert_called_once_with(99)
```

```bash
python -m unittest test_greeting -v
```

Результат:

```text
test_known_user (test_greeting.TestGreetUser.test_known_user) ... ok
test_unknown_user (test_greeting.TestGreetUser.test_unknown_user) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Репозиторій передається як аргумент, тож нічого не треба ні підміняти, ні відновлювати. Код, який отримує свої залежності ззовні (впровадження залежностей, dependency injection), тестувати значно простіше.

### Вправа 4

```python
import unittest
from unittest.mock import Mock, create_autospec

from reminders import Notifier, remind


class TestRemind(unittest.TestCase):
    def test_with_plain_mock(self):
        notifier = Mock()
        remind(notifier, "ann")
        notifier.notify.assert_called_once()

    def test_with_autospec(self):
        notifier = create_autospec(Notifier, instance=True)
        remind(notifier, "ann")
        notifier.notify.assert_called_once()
```

```bash
python -m unittest test_reminders -v
```

Результат із помилковою `remind()` (шляхи й нутрощі `unittest.mock` скорочено):

```text
test_with_autospec (test_reminders.TestRemind.test_with_autospec) ... ERROR
test_with_plain_mock (test_reminders.TestRemind.test_with_plain_mock) ... ok

======================================================================
ERROR: test_with_autospec (test_reminders.TestRemind.test_with_autospec)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "test_reminders.py", line 15, in test_with_autospec
    remind(notifier, "ann")
    ~~~~~~^^^^^^^^^^^^^^^^^
  File "reminders.py", line 7, in remind
    notifier.notify(user)
    ~~~~~~~~~~~~~~~^^^^^^
  ...
TypeError: missing a required argument: 'message'

----------------------------------------------------------------------
Ran 2 tests in 0.002s

FAILED (errors=1)
```

Звичайний мок приймає будь-які аргументи, тому його тест проходить і приховує помилку. Мок з autospec звіряє виклик зі справжньою сигнатурою `Notifier.notify` і генерує той самий `TypeError`, що й реальний об'єкт. Після виправлення:

```python
class Notifier:
    def notify(self, user, message):
        ...


def remind(notifier, user):
    notifier.notify(user, "Don't forget your appointment")
```

Результат:

```text
test_with_autospec (test_reminders.TestRemind.test_with_autospec) ... ok
test_with_plain_mock (test_reminders.TestRemind.test_with_plain_mock) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.001s

OK
```

---

*Джерело: [pythontutorial.net — Python unittest Mock](https://www.pythontutorial.net/python-unit-testing/python-unittest-mock/). Адаптовано й доповнено для PyJourney.*
