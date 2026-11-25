# Заглушки (stubs)

**Заглушка** (stub) — це тестовий дублер, який повертає жорстко задані значення. Її єдине завдання — привести код, що тестується, у певний відомий стан: «датчик показує 25 градусів», «користувача не знайдено», «API каже, що товару немає в наявності». Із заглушкою тест стає відтворюваним, і можна тестувати навіть код, чиїх справжніх залежностей ще не існує.

## Що ви дізнаєтесь

- Що таке заглушка і чим вона відрізняється від мока
- Як написати клас-заглушку вручну і передати її в код, що тестується
- Як протестувати кожну гілку класу, що залежить від випадкового чи апаратного значення
- Як швидко створювати заглушки за допомогою `MagicMock(spec=...)` і `PropertyMock`
- Як правильно використовувати `patch()`, коли код сам створює свою залежність

## Заглушки та моки

І те, і те — тестові дублери, але вони відповідають на різні запитання:

| | Заглушка (stub) | Мок (mock) |
|---|---|---|
| Призначення | Подати коду фіксовані **вхідні дані** | Перевірити **взаємодію** коду із залежністю |
| Тест перевіряє | Результат або стан коду, що тестується | Як викликали дублера (`assert_called_with` тощо) |
| Типове запитання | «Що зробить `Alarm` при 25 градусах?» | «Чи прочитав `Alarm` датчик рівно один раз?» |

На практиці межа розмита: `MagicMock`, якому ви задали `return_value` і який потім не перевіряєте, використовується як заглушка. Важить роль, яку об'єкт відіграє в тесті.

Заглушки корисні, бо:

- повертають **сталі** результати, тож тести детерміновані;
- спрощують **написання тестів**: стан задається одним рядком замість налаштування справжнього оточення;
- тести можна запускати, навіть якщо справжній компонент **ще не готовий** або недоступний (обладнання, платний API, база даних).

## Приклад: температурна сигналізація

Уявіть систему сигналізації для серверної. Датчик вимірює температуру, а сигналізація вмикається, коли температура виходить за безпечні межі.

`sensor.py`:

```python
import random


class Sensor:
    @property
    def temperature(self):
        return random.randint(10, 45)
```

Властивість `temperature` повертає випадкове значення від 10 до 45. Справжня реалізація зверталася б до пристрою.

`alarm.py`:

```python
from sensor import Sensor


class Alarm:
    def __init__(self, sensor=None) -> None:
        self._low = 18
        self._high = 24
        self._sensor = sensor or Sensor()
        self._is_on = False

    def check(self):
        temperature = self._sensor.temperature
        if temperature < self._low or temperature > self._high:
            self._is_on = True

    @property
    def is_on(self):
        return self._is_on
```

- Нова сигналізація вимкнена: `is_on` дорівнює `False`.
- `check()` читає датчик і вмикає сигналізацію, якщо температура **нижча за 18** або **вища за 24**. Рівно 18 і рівно 24 градуси ще безпечні.
- Увімкнувшись, сигналізація лишається ввімкненою. `check()` ніколи її не вимикає.
- Конструктор приймає необов'язковий `sensor`. Якщо його не передали, створюється справжній `Sensor()`. Саме це **впровадження залежності** (dependency injection) робить клас зручним для тестування: тест може передати будь-який об'єкт з атрибутом `temperature`.

Зі справжнім датчиком `check()` щоразу дає іншу відповідь, тож надійно перевірити гілки «надто жарко», «надто холодно» і «норма» неможливо. Заглушка це виправляє.

## Заглушка, написана вручну

`stubs.py`:

```python
class StubSensor:
    def __init__(self, temperature) -> None:
        self._temperature = temperature

    @property
    def temperature(self):
        return self._temperature
```

Зовні `StubSensor` схожий на `Sensor`: у нього є властивість `temperature`. Але замість звернення до пристрою вона повертає значення, передане в конструктор. Це **качина типізація** (duck typing): `Alarm` байдуже, якого класу об'єкт, аби тільки працював `sensor.temperature`.

> **Зверніть увагу:** не називайте клас-заглушку `TestSomething` і не кладіть його в модуль із назвою `test_*.py`. Засоби запуску тестів трактують такі назви особливо: наприклад, pytest намагається зібрати класи `Test*` як тестові й видає попередження, якщо в них є `__init__()`. Назви на кшталт `StubSensor` чи `FakeSensor` у модулі `stubs.py` не викликають плутанини.

### Крок 1: за замовчуванням сигналізація вимкнена

`test_alarm.py`:

```python
import unittest

from alarm import Alarm
from stubs import StubSensor


class TestAlarm(unittest.TestCase):
    def test_is_alarm_off_by_default(self):
        alarm = Alarm()
        self.assertFalse(alarm.is_on)
```

Запустіть усі тести в теці (unittest сам знаходить файли `test_*.py`):

```bash
python -m unittest -v
```

Результат:

```text
test_is_alarm_off_by_default (test_alarm.TestAlarm.test_is_alarm_off_by_default) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Цей тест не читає датчик, тому справжній `Sensor` тут нешкідливий. Утім, `Alarm()` його створює, а в реальній системі це могло б означати відкриття пристрою. Тому у фінальній версії нижче й тут передається заглушка.

### Крок 2: надто жарко

```python
import unittest

from alarm import Alarm
from stubs import StubSensor


class TestAlarm(unittest.TestCase):
    def test_is_alarm_off_by_default(self):
        alarm = Alarm()
        self.assertFalse(alarm.is_on)

    def test_check_temperature_too_high(self):
        alarm = Alarm(StubSensor(25))
        alarm.check()
        self.assertTrue(alarm.is_on)
```

Тест створює заглушку, яка завжди показує 25 градусів, передає її в `Alarm`, викликає `check()` і перевіряє, що сигналізація ввімкнулася.

Результат:

```text
test_check_temperature_too_high (test_alarm.TestAlarm.test_check_temperature_too_high) ... ok
test_is_alarm_off_by_default (test_alarm.TestAlarm.test_is_alarm_off_by_default) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

### Крок 3: надто холодно і норма

Повний тестовий модуль покриває всі три гілки:

```python
import unittest

from alarm import Alarm
from stubs import StubSensor


class TestAlarm(unittest.TestCase):
    def test_is_alarm_off_by_default(self):
        alarm = Alarm(StubSensor(30))
        self.assertFalse(alarm.is_on)

    def test_check_temperature_too_high(self):
        alarm = Alarm(StubSensor(25))
        alarm.check()
        self.assertTrue(alarm.is_on)

    def test_check_temperature_too_low(self):
        alarm = Alarm(StubSensor(17))
        alarm.check()
        self.assertTrue(alarm.is_on)

    def test_check_normal_temperature(self):
        alarm = Alarm(StubSensor(20))
        alarm.check()
        self.assertFalse(alarm.is_on)
```

Результат `python -m unittest -v`:

```text
test_check_normal_temperature (test_alarm.TestAlarm.test_check_normal_temperature) ... ok
test_check_temperature_too_high (test_alarm.TestAlarm.test_check_temperature_too_high) ... ok
test_check_temperature_too_low (test_alarm.TestAlarm.test_check_temperature_too_low) ... ok
test_is_alarm_off_by_default (test_alarm.TestAlarm.test_is_alarm_off_by_default) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

Зверніть увагу на покращений перший тест: заглушка показує 30 градусів, тобто значення поза межами. Сигналізація все одно вимкнена, а отже, вона вмикається лише після `check()`.

## Заглушки на основі MagicMock

Написати клас-заглушку легко, але для кожної залежності потрібен ще один клас. `unittest.mock.MagicMock` може слугувати заглушкою без жодного додаткового коду. Передайте справжній клас як **специфікацію** (spec), і заглушка матиме лише ті атрибути, що є в справжнього класу:

```python
from unittest.mock import MagicMock

from sensor import Sensor

mock_sensor = MagicMock(Sensor)   # перший позиційний аргумент — це spec
mock_sensor.temperature = 25
print(mock_sensor.temperature)
```

Результат:

```text
25
```

`MagicMock(Sensor)` — те саме, що `MagicMock(spec=Sensor)`. Присвоєння `mock_sensor.temperature = 25` замінює атрибут звичайним значенням, тож `self._sensor.temperature` в `Alarm` прочитає `25`.

`test_alarm_magicmock.py`:

```python
import unittest
from unittest.mock import MagicMock

from alarm import Alarm
from sensor import Sensor


class TestAlarm(unittest.TestCase):
    def setUp(self):
        self.mock_sensor = MagicMock(Sensor)
        self.alarm = Alarm(self.mock_sensor)

    def test_is_alarm_off_by_default(self):
        self.assertFalse(self.alarm.is_on)

    def test_check_temperature_too_high(self):
        self.mock_sensor.temperature = 25
        self.alarm.check()
        self.assertTrue(self.alarm.is_on)

    def test_check_temperature_too_low(self):
        self.mock_sensor.temperature = 15
        self.alarm.check()
        self.assertTrue(self.alarm.is_on)

    def test_check_normal_temperature(self):
        self.mock_sensor.temperature = 20
        self.alarm.check()
        self.assertFalse(self.alarm.is_on)
```

Результат `python -m unittest -v`:

```text
test_check_normal_temperature (test_alarm_magicmock.TestAlarm.test_check_normal_temperature) ... ok
test_check_temperature_too_high (test_alarm_magicmock.TestAlarm.test_check_temperature_too_high) ... ok
test_check_temperature_too_low (test_alarm_magicmock.TestAlarm.test_check_temperature_too_low) ... ok
test_is_alarm_off_by_default (test_alarm_magicmock.TestAlarm.test_is_alarm_off_by_default) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.001s

OK
```

`setUp()` виконується перед кожним тестом, тож кожен тест отримує свіжу заглушку і нову сигналізацію. Специфікація ще й захищає від одруківок:

```python
from unittest.mock import MagicMock

from sensor import Sensor

mock_sensor = MagicMock(Sensor)
print(mock_sensor.temperature)
try:
    mock_sensor.temprature
except AttributeError as error:
    print('AttributeError:', error)
```

Результат (`id` щоразу інший):

```text
<MagicMock name='mock.temperature' id='4310357664'>
AttributeError: Mock object has no attribute 'temprature'
```

Перший рядок показує ще й пастку: доки ви не задали `temperature`, це `MagicMock`, а не число. Якщо забути його налаштувати, `check()` впаде з `TypeError: '<' not supported between instances of 'MagicMock' and 'int'`.

### Різні значення для різних викликів: PropertyMock

`mock_sensor.temperature = 25` дає одне фіксоване значення. Щоб **властивість** (property) повертала різні значення під час послідовних читань, прикріпіть `PropertyMock` до **типу** мока:

```python
from unittest.mock import MagicMock, PropertyMock

from sensor import Sensor

mock_sensor = MagicMock(spec=Sensor)
type(mock_sensor).temperature = PropertyMock(side_effect=[20, 17])
print(mock_sensor.temperature, mock_sensor.temperature)
print(type(Sensor.__dict__['temperature']))  # справжній клас не змінився
```

Результат:

```text
20 17
<class 'property'>
```

Кожен екземпляр мока має власний прихований підклас, тому атрибут, заданий у `type(mock_sensor)`, не впливає ні на інші моки, ні на справжній `Sensor`. Цей прийом використовується у вправі 3.

## Заглушки через patch()

Іноді передати заглушку неможливо: код сам створює свою залежність. `Alarm()` без аргументів викликає `Sensor()`. Щоб це контролювати, підмініть ім'я `Sensor` **у модулі `alarm`**, бо саме там його шукає `Alarm` (у `alarm.py` написано `from sensor import Sensor`):

```python
import unittest
from unittest.mock import patch

from alarm import Alarm


class TestAlarmDefaultSensor(unittest.TestCase):
    @patch('alarm.Sensor')
    def test_check_temperature_too_low(self, mock_sensor_class):
        # Alarm() викликає Sensor(), а виклик повертає mock_sensor_class.return_value
        mock_sensor_class.return_value.temperature = 10

        alarm = Alarm()
        alarm.check()

        self.assertTrue(alarm.is_on)
        mock_sensor_class.assert_called_once_with()
```

Результат `python -m unittest test_alarm_patch -v`:

```text
test_check_temperature_too_low (test_alarm_patch.TestAlarmDefaultSensor.test_check_temperature_too_low) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Тут важливі дві деталі:

- Підмінено **клас** `Sensor`. `Alarm()` його викликає, а виклик мока повертає його `return_value`. Отже, **екземпляр**-заглушка — це `mock_sensor_class.return_value`, і саме йому треба задати `temperature`.
- Ціль — `'alarm.Sensor'`, а не `'sensor.Sensor'`. Підміна `'sensor.Sensor'` змінює ім'я лише в модулі `sensor`, а `alarm` зберігає власне посилання на справжній клас:

```python
from unittest.mock import patch

from alarm import Alarm

with patch('sensor.Sensor'):
    alarm = Alarm()
    print(type(alarm._sensor))

with patch('alarm.Sensor'):
    alarm = Alarm()
    print(type(alarm._sensor))
```

Результат:

```text
<class 'sensor.Sensor'>
<class 'unittest.mock.MagicMock'>
```

> **Зверніть увагу:** у деяких посібниках пишуть `@patch('sensor.Sensor')`, а потім передають отриманий мок просто в `Alarm(sensor)`. Такий тест проходить, але patch тут нічого корисного не робить: мок просто слугує саморобною заглушкою, та й модуль у цілі не той. Якщо заглушку можна передати, `patch()` узагалі не потрібен. Використовуйте `patch()` лише для залежностей, які код створює чи імпортує сам.

## Типові помилки

- **Налаштовувати клас замість екземпляра.** З `@patch('alarm.Sensor')` рядок `mock_sensor_class.temperature = 10` задає атрибут мок-класу, а `Alarm` читає атрибут екземпляра `mock_sensor_class.return_value`.
- **Підміняти клас там, де його визначено** (`'sensor.Sensor'`), а не там, де його використовують (`'alarm.Sensor'`).
- **Забути задати значення заглушці на основі `MagicMock`.** Тоді атрибут — це ще один `MagicMock`, і порівняння на кшталт `<` генерують `TypeError`.
- **Заглушки, що відстали від реальності.** Написана вручну заглушка може зберегти старий інтерфейс після зміни справжнього класу. `spec=RealClass` (або `create_autospec()`) змушує таку розбіжність гучно падати.
- **Перевіряти лише «цікаві» значення.** Межі `18` і `24` — саме там ховаються помилки `<` чи `<=`. Із заглушками граничні тести пишуться елементарно, тож пишіть їх (див. вправу 1).
- **Покладатися на істинність для необов'язкових залежностей.** `sensor or Sensor()` замінює справжнім датчиком будь-який *хибний* (falsy) об'єкт. Заглушку, що визначає `__len__()` із поверненням `0`, буде мовчки проігноровано:

  ```python
  from alarm import Alarm


  class EmptyStubSensor:
      temperature = 30

      def __len__(self):  # робить об'єкт хибним (falsy)
          return 0


  alarm = Alarm(EmptyStubSensor())
  print(type(alarm._sensor).__name__)
  ```

  Результат:

  ```text
  Sensor
  ```

  У власному коді краще писати `self._sensor = sensor if sensor is not None else Sensor()`.

## Підсумок

- Заглушка — тестовий дублер із заздалегідь заданими відповідями. Вона створює потрібний тесту стан і робить результат детермінованим.
- Заглушки допомагають перевіряти **результати**, моки — **взаємодію**. `MagicMock`, який ви лише налаштовуєте, виконує роль заглушки.
- Проєктуйте класи так, щоб вони отримували залежності ззовні (впровадження залежностей), і тест зможе просто передати заглушку.
- Написаній вручну заглушці достатньо мати ті самі атрибути й методи, що й справжній об'єкт (качина типізація). Називайте її `StubSensor`, а не `TestSensor`.
- `MagicMock(spec=RealClass)` створює заглушку одним рядком і відкидає невідомі атрибути. `PropertyMock` змушує властивість повертати послідовність значень.
- Коли код сам створює залежність, застосовуйте `patch()` до імені в модулі, який **її використовує**, і налаштовуйте `MockClass.return_value`.

## Практика

### Вправа 1: Граничні значення

За допомогою `StubSensor` напишіть `test_alarm_limits.py` із двома тестами: сигналізація має лишатися **вимкненою** рівно при 18 і 24 градусах і **вмикатися** при 17 і 25. Перебирайте значення в циклі й додайте зрозуміле повідомлення до перевірки.

### Вправа 2: Заглушка з послідовністю показань

Напишіть заглушку `SequenceSensor(readings)`, властивість `temperature` якої під час кожного читання повертає наступне значення зі списку. Доведіть з її допомогою два факти про `Alarm`:

- після показання 25, а потім 20 сигналізація лишається ввімкненою (вона «фіксується»);
- з показаннями 20, 21, 30 сигналізація вимкнена після двох перевірок і ввімкнена після третьої.

### Вправа 3: Те саме з PropertyMock

Замість написаного вручну класу використайте `MagicMock(spec=Sensor)` із `PropertyMock(side_effect=[20, 17])` для `temperature`. Перевірте, що після першого `check()` сигналізація вимкнена, після другого — ввімкнена, і що властивість прочитали рівно двічі.

## Розв'язки

### Вправа 1

```python
import unittest

from alarm import Alarm
from stubs import StubSensor


class TestAlarmLimits(unittest.TestCase):
    def test_limits_are_safe(self):
        for temperature in (18, 24):
            alarm = Alarm(StubSensor(temperature))
            alarm.check()
            self.assertFalse(alarm.is_on, f"alarm is on at {temperature}")

    def test_just_outside_limits(self):
        for temperature in (17, 25):
            alarm = Alarm(StubSensor(temperature))
            alarm.check()
            self.assertTrue(alarm.is_on, f"alarm is off at {temperature}")
```

Результат `python -m unittest test_alarm_limits -v`:

```text
test_just_outside_limits (test_alarm_limits.TestAlarmLimits.test_just_outside_limits) ... ok
test_limits_are_safe (test_alarm_limits.TestAlarmLimits.test_limits_are_safe) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Для кожного значення створюється нова `Alarm`, бо сигналізація, що раз увімкнулася, так і лишиться ввімкненою. Повідомлення показує, на якому значенні тест упав. Тема про параметризовані тести показує, як `subTest()` звітує про кожне значення окремо.

### Вправа 2

```python
import unittest

from alarm import Alarm


class SequenceSensor:
    """A stub that returns the given readings one by one."""

    def __init__(self, readings):
        self._readings = iter(readings)

    @property
    def temperature(self):
        return next(self._readings)


class TestAlarmLatch(unittest.TestCase):
    def test_stays_on_after_temperature_returns_to_normal(self):
        alarm = Alarm(SequenceSensor([25, 20]))
        alarm.check()
        self.assertTrue(alarm.is_on)
        alarm.check()
        self.assertTrue(alarm.is_on)

    def test_turns_on_only_when_needed(self):
        alarm = Alarm(SequenceSensor([20, 21, 30]))
        alarm.check()
        alarm.check()
        self.assertFalse(alarm.is_on)
        alarm.check()
        self.assertTrue(alarm.is_on)
```

Результат `python -m unittest test_alarm_latch -v`:

```text
test_stays_on_after_temperature_returns_to_normal (test_alarm_latch.TestAlarmLatch.test_stays_on_after_temperature_returns_to_normal) ... ok
test_turns_on_only_when_needed (test_alarm_latch.TestAlarmLatch.test_turns_on_only_when_needed) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

Якщо викликати `check()` більше разів, ніж є показань, `next()` згенерує `StopIteration`, і тест гучно впаде. Від заглушки зазвичай саме цього й хочуть.

### Вправа 3

```python
import unittest
from unittest.mock import MagicMock, PropertyMock

from alarm import Alarm
from sensor import Sensor


class TestAlarmWithPropertyMock(unittest.TestCase):
    def test_second_reading_too_low(self):
        mock_sensor = MagicMock(spec=Sensor)
        temperature = PropertyMock(side_effect=[20, 17])
        type(mock_sensor).temperature = temperature

        alarm = Alarm(mock_sensor)
        alarm.check()
        self.assertFalse(alarm.is_on)
        alarm.check()
        self.assertTrue(alarm.is_on)

        self.assertEqual(temperature.call_count, 2)
```

Результат `python -m unittest test_alarm_property_mock -v`:

```text
test_second_reading_too_low (test_alarm_property_mock.TestAlarmWithPropertyMock.test_second_reading_too_low) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Кожне читання `mock_sensor.temperature` викликає `PropertyMock`, який бере наступний елемент із `side_effect` і записує виклик. Тут об'єкт одночасно працює як заглушка (фіксовані відповіді) і як мок (перевірка `call_count`).

---

*Джерело: [pythontutorial.net — Python Stubs](https://www.pythontutorial.net/python-unit-testing/python-stubs/). Адаптовано й доповнено для PyJourney.*
