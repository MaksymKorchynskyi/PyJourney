# Stubs

A **stub** is a test double that returns hard-coded values. Its only job is to put the code under test into a specific, known state: "the sensor reports 25 degrees", "the user is not found", "the API says the item is out of stock". With a stub in place, a test becomes repeatable, and you can even test code whose real dependencies do not exist yet.

## What you'll learn

- What a stub is and how it differs from a mock
- How to write a stub class by hand and inject it into the code under test
- How to test every branch of a class that depends on a random or hardware value
- How to build stubs quickly with `MagicMock(spec=...)` and `PropertyMock`
- How to use `patch()` correctly when the code creates its own dependency

## Stubs vs. mocks

Both are test doubles, but they answer different questions:

| | Stub | Mock |
|---|---|---|
| Purpose | Feed the code fixed **input** | Verify the code's **interactions** |
| The test checks | The result or state of the code under test | How the double was called (`assert_called_with` and so on) |
| Typical question | "What does `Alarm` do when it is 25 degrees?" | "Did `Alarm` read the sensor exactly once?" |

In practice the line is blurry: a `MagicMock` that you configure with a `return_value` and never inspect is used as a stub. What matters is the role the object plays in the test.

Stubs are useful because:

- they return **consistent** results, so tests are deterministic;
- they make tests **easy to write**, because you set up a state in one line instead of arranging a real environment;
- tests can run even if the real component is **not ready** or not available (hardware, a paid API, a database).

## The example: a temperature alarm

Imagine an alarm system for a server room. A sensor measures the temperature, and the alarm turns on when the temperature leaves the safe range.

`sensor.py`:

```python
import random


class Sensor:
    @property
    def temperature(self):
        return random.randint(10, 45)
```

The `temperature` property returns a random value from 10 to 45. A real implementation would talk to a device.

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

- A new alarm is off: `is_on` is `False`.
- `check()` reads the sensor and turns the alarm on if the temperature is **below 18** or **above 24**. Exactly 18 and exactly 24 are still safe.
- Once on, the alarm stays on. `check()` never switches it off.
- The constructor accepts an optional `sensor`. If none is given, it creates a real `Sensor()`. This **dependency injection** is what makes the class easy to test: the test can hand in any object that has a `temperature` attribute.

With the real sensor, `check()` gives a different answer on every run, so you cannot reliably test the "too hot", "too cold" and "normal" branches. A stub fixes that.

## Writing a stub by hand

`stubs.py`:

```python
class StubSensor:
    def __init__(self, temperature) -> None:
        self._temperature = temperature

    @property
    def temperature(self):
        return self._temperature
```

`StubSensor` looks like `Sensor` from the outside: it has a `temperature` property. But instead of reading a device, it returns whatever value was passed to the constructor. This is called **duck typing**: `Alarm` does not care about the class, only that `sensor.temperature` works.

> **Note:** Do not name a stub class `TestSomething` or put it in a module named `test_*.py`. Test runners treat such names specially: pytest, for example, tries to collect `Test*` classes as test classes and warns when they have an `__init__()`. Names like `StubSensor` or `FakeSensor` in a module such as `stubs.py` keep things clear.

### Step 1: the alarm is off by default

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

Run all tests in the folder (unittest discovers `test_*.py` files):

```bash
python -m unittest -v
```

Output:

```text
test_is_alarm_off_by_default (test_alarm.TestAlarm.test_is_alarm_off_by_default) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

This test does not read the sensor, so the real `Sensor` is harmless here. Still, `Alarm()` creates one, and in a real system that might open a device. The final version below passes a stub here too.

### Step 2: too hot

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

The test creates a stub that always reports 25 degrees, passes it to `Alarm`, calls `check()` and asserts that the alarm is on.

Output:

```text
test_check_temperature_too_high (test_alarm.TestAlarm.test_check_temperature_too_high) ... ok
test_is_alarm_off_by_default (test_alarm.TestAlarm.test_is_alarm_off_by_default) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

### Step 3: too cold and normal

The complete test module covers all three branches:

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

Output of `python -m unittest -v`:

```text
test_check_normal_temperature (test_alarm.TestAlarm.test_check_normal_temperature) ... ok
test_check_temperature_too_high (test_alarm.TestAlarm.test_check_temperature_too_high) ... ok
test_check_temperature_too_low (test_alarm.TestAlarm.test_check_temperature_too_low) ... ok
test_is_alarm_off_by_default (test_alarm.TestAlarm.test_is_alarm_off_by_default) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.000s

OK
```

Notice the improved first test: it uses a stub that reports 30 degrees, which is out of range. The alarm is still off, which proves that it only turns on after `check()`.

## Stubs with MagicMock

Writing a stub class is easy, but for every dependency you need another class. `unittest.mock.MagicMock` can act as a stub without any extra code. Pass the real class as the **spec**, so the stub only has the attributes the real class has:

```python
from unittest.mock import MagicMock

from sensor import Sensor

mock_sensor = MagicMock(Sensor)   # the first positional argument is spec
mock_sensor.temperature = 25
print(mock_sensor.temperature)
```

Output:

```text
25
```

`MagicMock(Sensor)` is the same as `MagicMock(spec=Sensor)`. Setting `mock_sensor.temperature = 25` replaces the attribute with a plain value, so `self._sensor.temperature` in `Alarm` reads `25`.

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

Output of `python -m unittest -v`:

```text
test_check_normal_temperature (test_alarm_magicmock.TestAlarm.test_check_normal_temperature) ... ok
test_check_temperature_too_high (test_alarm_magicmock.TestAlarm.test_check_temperature_too_high) ... ok
test_check_temperature_too_low (test_alarm_magicmock.TestAlarm.test_check_temperature_too_low) ... ok
test_is_alarm_off_by_default (test_alarm_magicmock.TestAlarm.test_is_alarm_off_by_default) ... ok

----------------------------------------------------------------------
Ran 4 tests in 0.001s

OK
```

`setUp()` runs before every test, so each test gets a fresh stub and a fresh alarm. The spec also protects against typos:

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

Output (the `id` varies):

```text
<MagicMock name='mock.temperature' id='4310357664'>
AttributeError: Mock object has no attribute 'temprature'
```

The first line also shows a trap: until you set `temperature`, it is a `MagicMock`, not a number. Forgetting to configure it makes `check()` fail with `TypeError: '<' not supported between instances of 'MagicMock' and 'int'`.

### Changing values between calls: PropertyMock

Setting `mock_sensor.temperature = 25` gives one fixed value. To make a **property** return different values on successive reads, attach a `PropertyMock` to the mock's **type**:

```python
from unittest.mock import MagicMock, PropertyMock

from sensor import Sensor

mock_sensor = MagicMock(spec=Sensor)
type(mock_sensor).temperature = PropertyMock(side_effect=[20, 17])
print(mock_sensor.temperature, mock_sensor.temperature)
print(type(Sensor.__dict__['temperature']))  # the real class is untouched
```

Output:

```text
20 17
<class 'property'>
```

Each mock instance has its own private subclass, so setting an attribute on `type(mock_sensor)` does not affect other mocks or the real `Sensor`. Exercise 3 uses this technique.

## Stubs with patch()

Sometimes you cannot pass the stub in: the code creates its dependency itself. `Alarm()` without arguments calls `Sensor()`. To control that, patch the name `Sensor` **in the `alarm` module**, because that is where `Alarm` looks it up (`alarm.py` did `from sensor import Sensor`):

```python
import unittest
from unittest.mock import patch

from alarm import Alarm


class TestAlarmDefaultSensor(unittest.TestCase):
    @patch('alarm.Sensor')
    def test_check_temperature_too_low(self, mock_sensor_class):
        # Alarm() calls Sensor(); the call returns mock_sensor_class.return_value
        mock_sensor_class.return_value.temperature = 10

        alarm = Alarm()
        alarm.check()

        self.assertTrue(alarm.is_on)
        mock_sensor_class.assert_called_once_with()
```

Output of `python -m unittest test_alarm_patch -v`:

```text
test_check_temperature_too_low (test_alarm_patch.TestAlarmDefaultSensor.test_check_temperature_too_low) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Two details matter:

- The patched object is the **class** `Sensor`. `Alarm()` calls it, and calling a mock returns its `return_value`. So the stub **instance** is `mock_sensor_class.return_value`, and that is where `temperature` must be set.
- The target is `'alarm.Sensor'`, not `'sensor.Sensor'`. Patching `'sensor.Sensor'` changes the name in the `sensor` module only, while `alarm` keeps its own reference to the real class:

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

Output:

```text
<class 'sensor.Sensor'>
<class 'unittest.mock.MagicMock'>
```

> **Note:** Some tutorials write `@patch('sensor.Sensor')` and then pass the resulting mock straight into `Alarm(sensor)`. That test passes, but the patch does nothing useful: the mock is simply used as a hand-made stub, and the target is the wrong module anyway. If you can pass the stub in, you do not need `patch()` at all. Use `patch()` only for dependencies the code creates or imports itself.

## Common mistakes

- **Configuring the class instead of the instance.** With `@patch('alarm.Sensor')`, `mock_sensor_class.temperature = 10` sets an attribute on the mock class, but `Alarm` reads the attribute from the instance `mock_sensor_class.return_value`.
- **Patching where the class is defined** (`'sensor.Sensor'`) instead of where it is used (`'alarm.Sensor'`).
- **Forgetting to set a value on a `MagicMock` stub.** The attribute is then another `MagicMock`, and comparisons such as `<` raise `TypeError`.
- **Stubs that drift from reality.** A hand-written stub can keep an old interface after the real class changes. Using `spec=RealClass` (or `create_autospec()`) makes such drift fail loudly.
- **Testing only the "interesting" values.** The boundaries `18` and `24` are where `<` vs `<=` bugs hide. Stubs make boundary tests trivial, so write them (see Exercise 1).
- **Relying on truthiness for optional dependencies.** `sensor or Sensor()` replaces any *falsy* object with a real sensor. A stub that defines `__len__()` returning `0` is silently ignored:

  ```python
  from alarm import Alarm


  class EmptyStubSensor:
      temperature = 30

      def __len__(self):  # makes the object falsy
          return 0


  alarm = Alarm(EmptyStubSensor())
  print(type(alarm._sensor).__name__)
  ```

  Output:

  ```text
  Sensor
  ```

  In your own code, prefer `self._sensor = sensor if sensor is not None else Sensor()`.

## Summary

- A stub is a test double with hard-coded answers. It sets up the state the test needs and makes the result deterministic.
- Stubs check **results**, mocks check **interactions**. A `MagicMock` you only configure plays the role of a stub.
- Design classes to receive their dependencies (dependency injection), so tests can simply pass a stub in.
- A hand-written stub just needs the same attributes and methods as the real object (duck typing). Give it a name like `StubSensor`, not `TestSensor`.
- `MagicMock(spec=RealClass)` creates a stub in one line and rejects unknown attributes. `PropertyMock` makes a property return a sequence of values.
- When the code creates its dependency itself, use `patch()` on the name in the **using** module and configure `MockClass.return_value`.

## Practice

### Exercise 1: Boundary values

Using `StubSensor`, write `test_alarm_limits.py` with two tests: the alarm must stay **off** at exactly 18 and 24 degrees, and must turn **on** at 17 and 25. Use a loop over the values and a helpful assertion message.

### Exercise 2: A stub with a sequence of readings

Write a stub `SequenceSensor(readings)` whose `temperature` property returns the next value from the list on each read. Use it to prove two facts about `Alarm`:

- after a reading of 25 followed by 20, the alarm stays on (it "latches");
- with readings 20, 21, 30 the alarm is off after two checks and on after the third.

### Exercise 3: The same with PropertyMock

Instead of a hand-written class, use `MagicMock(spec=Sensor)` with a `PropertyMock(side_effect=[20, 17])` for `temperature`. Check that the alarm is off after the first `check()` and on after the second, and that the property was read exactly twice.

## Solutions

### Exercise 1

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

Output of `python -m unittest test_alarm_limits -v`:

```text
test_just_outside_limits (test_alarm_limits.TestAlarmLimits.test_just_outside_limits) ... ok
test_limits_are_safe (test_alarm_limits.TestAlarmLimits.test_limits_are_safe) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

A new `Alarm` is created for every value, because an alarm that turned on once would stay on. The message shows which value failed. The topic on parameterized tests shows how `subTest()` reports each value separately.

### Exercise 2

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

Output of `python -m unittest test_alarm_latch -v`:

```text
test_stays_on_after_temperature_returns_to_normal (test_alarm_latch.TestAlarmLatch.test_stays_on_after_temperature_returns_to_normal) ... ok
test_turns_on_only_when_needed (test_alarm_latch.TestAlarmLatch.test_turns_on_only_when_needed) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

If `check()` is called more often than there are readings, `next()` raises `StopIteration`, which makes the test fail loudly. That is usually what you want from a stub.

### Exercise 3

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

Output of `python -m unittest test_alarm_property_mock -v`:

```text
test_second_reading_too_low (test_alarm_property_mock.TestAlarmWithPropertyMock.test_second_reading_too_low) ... ok

----------------------------------------------------------------------
Ran 1 test in 0.000s

OK
```

Each read of `mock_sensor.temperature` calls the `PropertyMock`, which takes the next item from `side_effect` and records the call. Here the object works as a stub (fixed answers) and as a mock (the `call_count` check) at the same time.

---

*Source: [pythontutorial.net — Python Stubs](https://www.pythontutorial.net/python-unit-testing/python-stubs/). Adapted and expanded for PyJourney.*
